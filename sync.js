/* ============================================================
   M87 — Sincronização opcional entre aparelhos (Firebase Firestore)
   ------------------------------------------------------------
   - Totalmente opcional: o app funciona 100% sem isto.
   - Guarda o JSON inteiro num documento "m87/{código}".
   - Tempo real (onSnapshot) + último-a-salvar-vence (por timestamp).
   - Os scripts do Firebase são carregados sob demanda (só ao conectar).
   ============================================================ */
const M87Sync = (() => {
  const CFG_KEY = "m87.sync";
  const FB_VER = "10.12.2";
  let docRef = null, unsub = null, ready = false, pushTimer = null;
  let onRemote = () => {};

  const deviceId = (() => {
    let id = localStorage.getItem("m87.device");
    if (!id) { id = "d_" + Math.random().toString(36).slice(2, 9); localStorage.setItem("m87.device", id); }
    return id;
  })();

  function getCfg() { try { return JSON.parse(localStorage.getItem(CFG_KEY)); } catch { return null; } }
  function setCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); }
  function clearCfg() { localStorage.removeItem(CFG_KEY); }
  function status() { return getCfg() ? (ready ? "conectado" : "conectando…") : "desativada"; }

  function loadScript(src) {
    return new Promise((res, rej) => {
      if ([...document.scripts].some(s => s.src === src)) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("sem internet p/ Firebase"));
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (window.firebase && window.firebase.firestore) return;
    await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore-compat.js`);
  }

  async function connect({ config, code }, remoteCb, statusCb) {
    onRemote = remoteCb || onRemote;
    await ensureFirebase();
    if (!firebase.apps.length) firebase.initializeApp(config);
    const db = firebase.firestore();
    docRef = db.collection("m87").doc(code);
    if (unsub) unsub();
    unsub = docRef.onSnapshot(
      snap => {
        ready = true;
        statusCb && statusCb("conectado");
        if (snap.metadata.hasPendingWrites) return; // ignora o eco da própria escrita
        onRemote(snap.data());
      },
      err => { ready = false; statusCb && statusCb("erro: " + (err.code || err.message)); }
    );
  }

  function push(data) {
    if (!docRef) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      docRef.set({
        payload: JSON.stringify(data),
        updatedAt: data._updatedAt || Date.now(),
        device: deviceId,
      }).catch(() => {});
    }, 700);
  }

  function disconnect() {
    if (unsub) unsub();
    unsub = null; docRef = null; ready = false;
    clearCfg();
  }

  return { getCfg, setCfg, connect, push, disconnect, status, deviceId };
})();
