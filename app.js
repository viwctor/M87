/* modelo de dados (chave localStorage: "m87.data")
   {
     version, activeSemester,
     semesters: {
       "2026.1": {
         label, start:"YYYY-MM-DD", end:"YYYY-MM-DD",
         subjects: [{ id, name, prof, profEmail, credits, color,
                      meetings:[{ weekday:1-6, slot, room }] }]
       }
     },
     occ:   { "2026.1": { "YYYY-MM-DD": { "n1":"falta"|"prof", ... } } },
     marks: { "2026.1": { "YYYY-MM-DD": "holiday"|"noclass" } },
     notes: { "2026.1": { "YYYY-MM-DD": "texto da observação" } }
   }
  slots (horários): manhã (m1/m2/mi), tarde (t1/t2/ti), noite (n1/n2) e personalizado (c:HH:MM-HH:MM).
  cada slot com status; prof. faltou não conta;
  limite: 4 créditos = 8 faltas; 2 créditos = 4 faltas; */

const STORE_KEY = "m87.data";
const APP_VERSION = "1.1";

/* id único deste aparelho (para ignorar o eco das próprias escritas no tempo real) */
const DEVICE_ID = (() => {
  let id = localStorage.getItem("m87.device");
  if (!id) { id = "d_" + Math.random().toString(36).slice(2, 10); localStorage.setItem("m87.device", id); }
  return id;
})();

/* paleta de cores (gradientes) das matérias */
const PALETTE = [
  "linear-gradient(135deg, #ff8a1e, #ff6a00)",  // laranja
  "linear-gradient(135deg, #ffd23f, #ffae00)",  // amarelo
  "linear-gradient(135deg, #2dce89, #7be36b)",  // verde
  "linear-gradient(135deg, #12d8c5, #1fb6ff)",  // ciano
  "linear-gradient(135deg, #3b5bdb, #5c8cff)",  // azul
  "linear-gradient(135deg, #9d6bff, #6a3df0)",  // roxo
  "linear-gradient(135deg, #ff5edf, #c850ff)",  // rosa
  "linear-gradient(135deg, #ff4d4d, #ff2d6f)",  // vermelho
];

/* limite de horários (encontros) por matéria, para não inflar o armazenamento */
const MAX_MEETINGS = 8;

/* horários possíveis, em ordem cronológica */
const SLOT_DEFS = [
  { id: "m1", time: "08:00 – 09:40", short: "08h",   start: "08:00", label: "1ª aula", shift: "Manhã" },
  { id: "m2", time: "10:00 – 11:40", short: "10h",   start: "10:00", label: "2ª aula", shift: "Manhã" },
  { id: "mi", time: "08:00 – 12:00", short: "08h",   start: "08:00", label: "Integral", shift: "Manhã" },
  { id: "t1", time: "13:00 – 14:40", short: "13h",   start: "13:00", label: "1ª aula", shift: "Tarde" },
  { id: "t2", time: "15:00 – 16:40", short: "15h",   start: "15:00", label: "2ª aula", shift: "Tarde" },
  { id: "ti", time: "13:00 – 17:00", short: "13h",   start: "13:00", label: "Integral", shift: "Tarde" },
  { id: "n1", time: "19:00 – 20:40", short: "19h",   start: "19:00", label: "1ª aula", shift: "Noite" },
  { id: "n2", time: "20:50 – 22:30", short: "20h50", start: "20:50", label: "2ª aula", shift: "Noite" },
];
const SLOT_BY_ID = Object.fromEntries(SLOT_DEFS.map(s => [s.id, s]));

/* resolve um slot, seja preset ou personalizado ("c:HH:MM-HH:MM") */
function slotInfo(id) {
  if (SLOT_BY_ID[id]) return SLOT_BY_ID[id];
  if (typeof id === "string" && id.startsWith("c:")) {
    const [a, b] = id.slice(2).split("-");
    const h = parseInt(a, 10) || 0;
    const shift = h < 12 ? "Manhã" : h < 18 ? "Tarde" : "Noite";
    return { id, time: `${a} – ${b}`, short: a, start: a, label: "Personalizado", shift };
  }
  return { id, time: id, short: id, start: "99:99", label: String(id), shift: "" };
}

/* dias da semana: usar weekdayName(wd) / weekdayShort(wd) do i18n.js */

/* estado vazio: todo usuário (novo ou deslogado) começa sem semestre e escolhe o seu */
function emptyData() {
  return { version: 2, activeSemester: null, semesters: {}, occ: {}, marks: {}, notes: {}, lastCustomTime: "" };
}
/* compatibilidade: o app sempre inicia vazio (a grade real vem da nuvem após o login) */
function seedData() { return emptyData(); }

/* estado */
let data = loadData();
let calRef = null;
let lastSwipe = 0;
let autoSwitched = false; // calendário trocou de semestre automaticamente ao navegar
let activeView = "dashboard";
let _dataVer = 0;         // contador para invalidar o cache da grade de horários

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return seedData();
    return migrate(JSON.parse(raw));
  } catch (e) {
    console.error("Falha ao ler dados, recriando.", e);
    return seedData();
  }
}

/* migra dados antigos (slots numéricos 1/2 = noite) para o novo formato */
function migrate(d) {
  d.occ = d.occ || {};
  d.marks = d.marks || {};
  d.notes = d.notes || {};
  const slotMap = { "1": "n1", "2": "n2", 1: "n1", 2: "n2" };
  for (const sem of Object.values(d.semesters || {})) {
    if (sem.label) sem.label = sem.label.replace(/\s*[–—]\s*/g, " - "); // normaliza travessões
    for (const s of sem.subjects || []) {
      for (const m of s.meetings || []) {
        if (slotMap[m.slot]) m.slot = slotMap[m.slot];
      }
    }
  }
  for (const occSem of Object.values(d.occ)) {
    for (const date of Object.keys(occSem)) {
      const slots = occSem[date];
      for (const k of Object.keys(slots)) {
        if (slotMap[k] && k !== slotMap[k]) { slots[slotMap[k]] = slots[k]; delete slots[k]; }
      }
    }
  }
  // garante que o semestre ativo realmente existe (protege contra dados corrompidos)
  if (d.semesters && !d.semesters[d.activeSemester]) {
    d.activeSemester = Object.keys(d.semesters)[0];
  }
  d.version = 2;
  return d;
}

let cloudUserId = null;       // id do usuário logado (null = modo local)
let cloudUsername = "";
let cloudEmail = "";
let cloudSaveTimer = null;
function saveData() {
  _dataVer++;
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  if (cloudUserId) { clearTimeout(cloudSaveTimer); cloudSaveTimer = setTimeout(pushCloud, 700); }
}

/* helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function activeSem() { return data.semesters[data.activeSemester]; }
function semOcc()    { return (data.occ[data.activeSemester]   ||= {}); }
function semMarks()  { return (data.marks[data.activeSemester] ||= {}); }
function semNotes()  { return (data.notes[data.activeSemester] ||= {}); }
function maxFor(subject) { return subject.credits === 4 ? 8 : 4; }

function fmtDate(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function parseDate(str) { const [y, m, d] = str.split("-").map(Number); return new Date(y, m - 1, d); }
function isoWeekday(dateObj) { const wd = dateObj.getDay(); return wd === 0 ? 7 : wd; }

/* mapa weekday -> { slotId: subject } */
let _ttCache = null, _ttVer = -1, _ttSem = null;
function buildTimetable() {
  if (_ttCache && _ttVer === _dataVer && _ttSem === data.activeSemester) return _ttCache;
  const tt = {};
  for (const s of (activeSem()?.subjects || [])) {
    for (const m of (s.meetings || [])) {
      (tt[m.weekday] ||= {})[m.slot] = s;
    }
  }
  _ttCache = tt; _ttVer = _dataVer; _ttSem = data.activeSemester;
  return tt;
}
/* slots de um dia da semana, em ordem cronológica (inclui horários personalizados) */
function slotsForWeekday(wd) {
  const day = buildTimetable()[wd] || {};
  return Object.keys(day)
    .map(id => ({ id, subj: day[id], start: slotInfo(id).start }))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map(({ id, subj }) => ({ id, subj }));
}
function subjectAt(weekday, slotId) {
  const tt = buildTimetable();
  return tt[weekday] ? tt[weekday][slotId] : null;
}

/* conta as faltas de TODAS as matérias do semestre ativo numa só passada
   (mapa id -> nº de faltas), evitando recalcular por matéria a cada chamada */
function absenceCounts() {
  const occ = semOcc(), marks = semMarks();
  const counts = {};
  for (const [date, slots] of Object.entries(occ)) {
    if (marks[date]) continue;
    const wd = isoWeekday(parseDate(date));
    for (const slotId of Object.keys(slots)) {
      if (slots[slotId] === "falta") {
        const subj = subjectAt(wd, slotId);
        if (subj) counts[subj.id] = (counts[subj.id] || 0) + 1;
      }
    }
  }
  return counts;
}

function meetingsText(s) {
  return (s.meetings || []).length
    ? s.meetings.map(m => `${weekdayShort(m.weekday)} ${slotInfo(m.slot).short}`).join(" · ")
    : t("subjects.no_schedule");
}
/* limita o tamanho de um texto para preservar o armazenamento por usuário */
function clampText(str, n) { return String(str == null ? "" : str).slice(0, n); }

function toast(msg, ms = 2200) {
  const el = $("#toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(el._tid);
  el._tid = setTimeout(() => (el.hidden = true), ms);
}
const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function esc(str = "") { return String(str).replace(/[&<>"]/g, c => ESC_MAP[c]); }

function copyText(txt) {
  if (!txt) return;
  const done = () => toast(t("misc.copied_email"));
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(done).catch(() => toast(txt));
  } else {
    const ta = document.createElement("textarea");
    ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch { toast(txt); }
    ta.remove();
  }
}

/* notificação quando uma matéria fica com só 1 falta de margem */
const _notified = new Set();
function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "./icons/icon-192.png" }); } catch {}
  } else if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}
function maybeNotifyLimit() {
  const sem = activeSem();
  if (!sem) return;
  const counts = absenceCounts();
  for (const s of sem.subjects) {
    const remaining = maxFor(s) - (counts[s.id] || 0);
    const key = data.activeSemester + ":" + s.id;
    if (remaining === 1) {
      if (!_notified.has(key + ":1")) { _notified.add(key + ":1"); _notified.delete(key + ":0"); notify(t("notify.one_left_title"), s.name); }
    } else if (remaining <= 0) {
      if (!_notified.has(key + ":0")) { _notified.add(key + ":0"); _notified.delete(key + ":1"); notify(t("notify.none_left_title"), s.name); }
    } else {
      _notified.delete(key + ":1"); _notified.delete(key + ":0");
    }
  }
}

/* conexão (dot + texto no desktop) */
let _connState = "online";
function setConn(state) {            // "online" | "saving" | "offline"
  _connState = state;
  const dot = $("#connDot");
  if (dot) dot.className = "conn-dot " + state;
  const txt = $("#connText");
  if (txt) { txt.className = "conn-text " + state; txt.textContent = t("conn." + state); }
  const bar = $("#offlineBar");
  if (bar) bar.hidden = state !== "offline";
}

/* instalar app (PWA) — detecta se já está instalado / aberto como app */
let _deferredInstall = null;
let _relatedInstalled = false;
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function isInstalled() {
  return isStandalone() || _relatedInstalled;
}
/* mesmo aberto no navegador, detecta se o PWA já está instalado (Chromium) */
async function checkInstalled() {
  if (isStandalone() || !navigator.getInstalledRelatedApps) return;
  try {
    const apps = await navigator.getInstalledRelatedApps();
    if (Array.isArray(apps) && apps.length) { _relatedInstalled = true; renderInstallButton(); }
  } catch (e) {}
}
/* escolhe a instrução de instalação certa para cada navegador/sistema */
function installHintKey() {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS) return "app.hint_ios";                      // iOS: todos os navegadores usam o WebKit
  const isAndroid = /android/.test(ua);
  if (/firefox|fxios/.test(ua)) return isAndroid ? "app.hint_menu" : "app.hint_firefox";
  if (/safari/.test(ua) && !/chrome|chromium|crios|edg|edgios|opr|opera|brave/.test(ua)) return "app.hint_safari";
  return isAndroid ? "app.hint_menu" : "app.hint_chromium";   // Chrome/Edge/Opera/Brave/etc.
}
function renderInstallButton() {
  const btn = $("#installBtn");
  if (!btn) return;
  if (isInstalled()) {
    btn.disabled = true;
    btn.textContent = t("app.installed");
    btn.onclick = null;
    return;
  }
  btn.disabled = false;
  btn.textContent = t("app.install");
  btn.onclick = async () => {
    if (_deferredInstall) {                     // Chrome/Edge/Android: instala na hora
      _deferredInstall.prompt();
      try { await _deferredInstall.userChoice; } catch (e) {}
      _deferredInstall = null;
      renderInstallButton();
    } else {
      toast(t(installHintKey()), 6500);         // sem prompt programático -> instrução por navegador (tempo p/ ler)
    }
  };
}

/* fundo animado: poeira branca. modo "orbit" (login: cai no centro) ou "drift" (app: linear) */
function startParticles(canvas, opts = {}) {
  if (!canvas || !canvas.getContext) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const drift = opts.mode === "drift";
  const areaPer = opts.areaPer || 16000;   // maior = menos partículas
  const maxN = opts.max || 90;
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, cx = 0, cy = 0, parts = [], raf = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const targetCount = () => Math.max(6, Math.min(maxN, Math.round((window.innerWidth * window.innerHeight) / areaPer)));
  /* spread=true -> distribuída (preenche já); false -> entra pela borda/topo (renascimento) */
  function makeDrift(spread) {
    return {
      x: rnd(0, w), y: spread ? rnd(0, h) : rnd(-12, -2),
      vx: rnd(-0.06, 0.06), vy: rnd(0.05, 0.18),
      size: rnd(0.5, 1.6), al: rnd(0.1, 0.5),
      tw: rnd(0.004, 0.016), tp: rnd(0, Math.PI * 2),
    };
  }
  function makeOrbit(spread) {
    const far = Math.max(w, h);
    return {
      a: rnd(0, Math.PI * 2),
      r: spread ? rnd(30, far * 0.78) : far * rnd(0.55, 0.8),
      sp: rnd(0.0008, 0.0026) * (Math.random() < 0.5 ? 1 : -1),
      vr: rnd(0.05, 0.20),
      size: rnd(0.5, 1.7), al: rnd(0.12, 0.7),
      tw: rnd(0.004, 0.018), tp: rnd(0, Math.PI * 2),
    };
  }
  const make = (spread) => (drift ? makeDrift(spread) : makeOrbit(spread));
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2; cy = h * 0.42;
    const n = targetCount();
    while (parts.length < n) parts.push(make(true));   // preenche distribuído -> aparece na hora
    parts.length = n;
  }
  function step() {
    raf = requestAnimationFrame(step);
    if (!canvas.getClientRects().length) return;   // oculto (display:none): não desenha
    if (!w || !h) { resize(); if (!w || !h) return; }
    ctx.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.tp += p.tw;
      let x, y;
      if (drift) {
        p.x += p.vx; p.y += p.vy;
        if (p.y > h + 6 || p.x < -6 || p.x > w + 6) Object.assign(p, make(false));
        x = p.x; y = p.y;
      } else {
        p.a += p.sp; p.r -= p.vr;
        if (p.r < 22) Object.assign(p, make(false));   // sugado -> renasce na borda
        x = cx + Math.cos(p.a) * p.r;
        y = cy + Math.sin(p.a) * p.r * 0.92;
      }
      ctx.globalAlpha = Math.max(0, p.al * (0.6 + 0.4 * Math.sin(p.tp)));
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  window.addEventListener("resize", resize);
  resize();
  raf = requestAnimationFrame(step);
}
function updateConn() {
  setConn(navigator.onLine ? "online" : "offline");
  if (navigator.onLine && cloudUserId) pushCloud();
}
/* bloqueia alterações quando offline (modo nuvem) */
function blockedOffline() {
  if (cloudUserId && !navigator.onLine) { setConn("offline"); toast(t("misc.offline")); return true; }
  return false;
}
/* envia ao supabase com retry limitado; mantém a dot amarela enquanto tenta */
let _pushTries = 0;
function pushCloud() {
  if (!cloudUserId) return;
  if (!navigator.onLine) { setConn("offline"); return; }
  setConn("saving");
  data._device = DEVICE_ID;
  M87Cloud.saveData(cloudUserId, data)
    .then(() => { setConn("online"); _pushTries = 0; })
    .catch(() => {
      setConn(navigator.onLine ? "saving" : "offline");
      clearTimeout(cloudSaveTimer);
      // tenta de novo por ~24s; depois desiste (a próxima edição reinicia o ciclo)
      if (++_pushTries <= 6) cloudSaveTimer = setTimeout(pushCloud, 4000);
      else _pushTries = 0;
    });
}

/* dashboard */
function renderDashboard() {
  const sem = activeSem();
  if (!sem) {
    $("#semesterBanner").textContent = "";
    $("#dashboardGrid").innerHTML = `<div class="empty-state">${t("dash.no_semester")}</div>`;
    $("#semesterSummary").innerHTML = "";
    return;
  }
  $("#semesterBanner").textContent = tn("dash.subjects", sem.subjects.length);

  const grid = $("#dashboardGrid");
  grid.innerHTML = "";

  if (!sem.subjects.length) {
    grid.innerHTML = `<div class="empty-state">${t("dash.no_subjects")}</div>`;
    $("#semesterSummary").innerHTML = "";
    return;
  }

  const counts = absenceCounts();
  const sorted = [...sem.subjects].sort((a, b) =>
    ((counts[b.id] || 0) / maxFor(b)) - ((counts[a.id] || 0) / maxFor(a)));

  for (const s of sorted) {
    const used = counts[s.id] || 0;
    const max = maxFor(s);
    const ratio = max ? used / max : 0;
    const remaining = max - used;

    let level = "safe";
    if (used >= max) level = "critical";
    else if (remaining <= 1) level = "danger";
    else if (ratio >= 0.5) level = "warn";

    const numColor = level === "safe" ? "var(--text)" : `var(--${level})`;

    let alertHtml = "";
    if (remaining === 1) alertHtml = `<div class="sc-alert a-warn">${t("dash.alert_one")}</div>`;
    else if (remaining === 0) alertHtml = `<div class="sc-alert a-critical">${t("dash.alert_reached")}</div>`;
    else if (remaining < 0) alertHtml = `<div class="sc-alert a-critical">${t("dash.alert_over", { n: -remaining })}</div>`;

    const card = document.createElement("div");
    card.className = "subject-card";
    card.style.setProperty("--card-accent", s.color);
    card.innerHTML = `
      <div class="sc-top">
        <div>
          <div class="sc-name">${esc(s.name)}</div>
          <div class="sc-meta">${meetingsText(s)}</div>
        </div>
        <div class="sc-count">
          <span class="label">${t("dash.faltas")}</span>
          <b style="color:${numColor}">${used}</b><span class="max">/${max}</span>
        </div>
      </div>
      <div class="bar"><div class="bar-fill fill-${level}" style="width:${Math.min(100, ratio * 100)}%"></div></div>
      <div class="sc-foot">
        <span class="muted">${remaining > 0 ? t("dash.can_miss", { n: remaining }) : t("dash.no_margin")}</span>
      </div>
      ${alertHtml}`;
    grid.appendChild(card);
  }
  renderSummary(counts);
}

/* nº de aulas (sessões) que ainda vão acontecer da matéria, de hoje até o fim do semestre */
function remainingSessions(subject) {
  const sem = activeSem();
  const marks = semMarks();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = parseDate(sem.start), end = parseDate(sem.end);
  let cur = today > start ? new Date(today) : new Date(start);
  let count = 0;
  for (; cur <= end; cur.setDate(cur.getDate() + 1)) {
    const dateStr = fmtDate(cur.getFullYear(), cur.getMonth(), cur.getDate());
    if (marks[dateStr]) continue; // feriado / sem aula não conta
    const wd = isoWeekday(cur);
    for (const m of (subject.meetings || [])) if (m.weekday === wd) count++;
  }
  return count;
}

function renderSummary(counts = absenceCounts()) {
  const sem = activeSem();
  const wrap = $("#semesterSummary");
  if (!sem.subjects.length) { wrap.innerHTML = ""; return; }

  let usedTotal = 0, maxTotal = 0, creditsTotal = 0;
  const rows = sem.subjects.map(s => {
    const used = counts[s.id] || 0, max = maxFor(s);
    usedTotal += used; maxTotal += max; creditsTotal += (Number(s.credits) || 0);
    return { s, rest: remainingSessions(s) };
  });

  const list = rows.map(({ s, rest }) => `
    <div class="sum-item">
      <span class="sum-dot" style="background:${s.color}"></span>
      <span class="sum-name">${esc(s.name)}</span>
      <span class="sum-rest">${tn("sum.classes", rest)}</span>
    </div>`).join("");

  wrap.innerHTML = `
    <div class="summary-card">
      <div class="summary-head">
        <h3>${t("sum.title")}</h3>
        <span class="muted small">${t("sum.credits_faltas", { c: creditsTotal, u: usedTotal, m: maxTotal })}</span>
      </div>
      <div class="sum-subtitle muted small">${t("sum.remaining")}</div>
      ${list}
    </div>`;
}

/* calendário */
function initCalRef() {
  const sem = activeSem();
  const today = new Date();
  const start = parseDate(sem.start), end = parseDate(sem.end);
  let ref = (today >= start && today <= end) ? today : start;
  calRef = { year: ref.getFullYear(), month: ref.getMonth() };
}

function renderCalendar() {
  const sem = activeSem();
  if (!sem) { $("#calGrid").innerHTML = ""; $("#calTitle").textContent = "—"; return; }
  if (!calRef) initCalRef();
  const { year, month } = calRef;
  const occ = semOcc(), marks = semMarks(), notes = semNotes();

  const calLabel = new Date(year, month, 1).toLocaleDateString(localeTag(), { month: "long", year: "numeric" });
  $("#calTitle").textContent = calLabel.charAt(0).toUpperCase() + calLabel.slice(1);

  const grid = $("#calGrid");
  grid.innerHTML = "";

  const startWd = isoWeekday(new Date(year, month, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const semStart = parseDate(sem.start), semEnd = parseDate(sem.end);
  const now = new Date();
  const todayStr = fmtDate(now.getFullYear(), now.getMonth(), now.getDate());

  for (let i = 1; i < startWd; i++) {
    const c = document.createElement("div");
    c.className = "cal-cell empty";
    grid.appendChild(c);
  }

  // slots por dia da semana, calculados uma vez (e não a cada célula)
  const wdSlots = {};
  for (let w = 1; w <= 7; w++) wdSlots[w] = slotsForWeekday(w);

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = fmtDate(year, month, d);
    const wd = isoWeekday(dateObj);
    const inSem = dateObj >= semStart && dateObj <= semEnd;
    const slots = wdSlots[wd];
    const hasClass = slots.length > 0 && inSem;

    const cell = document.createElement("div");
    cell.className = "cal-cell";
    if (dateStr === todayStr) cell.classList.add("today");

    const mark = marks[dateStr];
    if (mark === "holiday") cell.classList.add("holiday");
    else if (mark === "noclass") cell.classList.add("noclass-mark");
    else if (!hasClass) cell.classList.add("noclassday");

    if (!mark && hasClass) {
      const slotsWrap = document.createElement("div");
      slotsWrap.className = "cal-slots";
      for (const { id } of slots) {
        const seg = document.createElement("div");
        seg.className = "cal-slot";
        const st = occ[dateStr] && occ[dateStr][id];
        if (st === "falta") seg.classList.add("s-falta");
        else if (st === "prof") seg.classList.add("s-prof");
        slotsWrap.appendChild(seg);
      }
      cell.appendChild(slotsWrap);
    }

    const num = document.createElement("div");
    num.className = "cal-day-num";
    num.textContent = d;
    cell.appendChild(num);

    if (notes[dateStr]) cell.classList.add("has-note");

    if (inSem) {
      cell.classList.add("classday");
      cell.dataset.date = dateStr;   // clique tratado por delegação em #calGrid
    }
    grid.appendChild(cell);
  }
}

/* semestre que contém hoje (ou o ativo, se nenhum) */
function currentSemesterKey() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const [key, sem] of Object.entries(data.semesters)) {
    if (today >= parseDate(sem.start) && today <= parseDate(sem.end)) return key;
  }
  return data.activeSemester || Object.keys(data.semesters)[0];
}

/* semestre cujo período cruza o mês exibido (null se nenhum) */
function semesterForMonth(year, month) {
  const mStart = new Date(year, month, 1), mEnd = new Date(year, month + 1, 0);
  for (const [key, sem] of Object.entries(data.semesters)) {
    if (parseDate(sem.start) <= mEnd && parseDate(sem.end) >= mStart) return key;
  }
  return null;
}

function calShift(delta) {
  if (!calRef) return;   // sem semestre ativo: não há mês para navegar
  let m = calRef.month + delta, y = calRef.year;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  calRef = { year: y, month: m };
  // troca automaticamente de semestre se o mês pertencer a outro
  const semKey = semesterForMonth(y, m);
  if (semKey && semKey !== data.activeSemester) {
    data.activeSemester = semKey;
    autoSwitched = true;
    updateSemesterButton();
    renderDashboard();
    toast(t("cal.changed_to", { label: semDisplayLabel(data.semesters[semKey]) }));
  }
  renderCalendar();
}

/* volta para o mês/semestre de hoje */
function goToday() {
  data.activeSemester = currentSemesterKey();
  autoSwitched = false;
  updateSemesterButton();
  const now = new Date();
  calRef = { year: now.getFullYear(), month: now.getMonth() };
  renderDashboard();
  renderCalendar();
}

/* modal de dia */
let dayModalState = null;

function openDayModal(dateStr) {
  dayModalState = { date: dateStr };
  $("#dayDate").value = dateStr;
  buildDayModalBody(dateStr);
  showModal("#dayModal");
}

function buildDayModalBody(dateStr) {
  const occ = semOcc(), marks = semMarks();
  const dateObj = parseDate(dateStr);
  const wd = isoWeekday(dateObj);

  $("#dayModalTitle").textContent =
    `${weekdayName(wd)}, ${dateObj.toLocaleDateString(localeTag(), { day: "2-digit", month: "long" })}`;

  const wrap = $("#daySlots");
  wrap.innerHTML = "";
  const mark = marks[dateStr];
  const slots = slotsForWeekday(wd);

  if (!slots.length) {
    wrap.innerHTML = `<p class="muted small">${t("day.no_classes")}</p>`;
  } else {
    let lastShift = null;
    for (const { id, subj } of slots) {
      const def = slotInfo(id);
      if (def.shift !== lastShift) {
        const h = document.createElement("div");
        h.className = "slot-shift muted small";
        h.textContent = tShift(def.shift);
        wrap.appendChild(h);
        lastShift = def.shift;
      }
      const cur = (occ[dateStr] && occ[dateStr][id]) || "presente";
      const div = document.createElement("div");
      div.className = `slot ${mark ? "disabled" : ""}`;
      div.dataset.slot = id;
      div.innerHTML = `
        <div class="slot-head">
          <span class="slot-color" style="background:${subj.color}"></span>
          <div>
            <div class="slot-subj">${esc(subj.name)}</div>
            <div class="slot-time">${tSlotLabel(def.label)} · ${def.time}</div>
          </div>
        </div>
        <div class="slot-options">
          <button class="seg-btn ${cur === "presente" ? "active" : ""}" data-val="presente">${t("day.present")}</button>
          <button class="seg-btn ${cur === "falta" ? "active" : ""}" data-val="falta">${t("day.absent")}</button>
          <button class="seg-btn ${cur === "prof" ? "active" : ""}" data-val="prof">${t("day.prof_absent")}</button>
        </div>`;
      wrap.appendChild(div);
    }
  }

  $$("#dayModal .chip[data-mark]").forEach(ch => {
    ch.classList.toggle("active",
      (ch.dataset.mark === "holiday" && mark === "holiday") ||
      (ch.dataset.mark === "noclass" && mark === "noclass"));
  });

  $$("#daySlots .seg-btn").forEach(btn => {
    btn.onclick = () => {
      $$(".seg-btn", btn.parentElement).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    };
  });

  $("#dayNote").value = semNotes()[dateStr] || "";
}

function saveDayModal() {
  if (blockedOffline()) return;
  const newDate = $("#dayDate").value;
  if (!newDate) return;
  const occ = semOcc(), marks = semMarks();

  const notes = semNotes();
  const oldDate = dayModalState.date;
  if (newDate !== oldDate) { delete occ[oldDate]; delete marks[oldDate]; delete notes[oldDate]; dayModalState.date = newDate; }
  const date = newDate;

  const markActive = $$("#dayModal .chip[data-mark]").find(c => c.classList.contains("active"));
  if (markActive) {
    marks[date] = markActive.dataset.mark;
    delete occ[date];
  } else {
    delete marks[date];
    const result = {};
    $$("#daySlots .slot").forEach(slotEl => {
      const active = $(".seg-btn.active", slotEl);
      const val = active ? active.dataset.val : "presente";
      if (val !== "presente") result[slotEl.dataset.slot] = val;
    });
    if (Object.keys(result).length) occ[date] = result; else delete occ[date];
  }

  const noteVal = clampText($("#dayNote").value.trim(), 200);
  if (noteVal) notes[date] = noteVal; else delete notes[date];

  saveData();
  closeModals();
  renderAll();
  maybeNotifyLimit();
  toast(t("day.saved"));
}

function clearDay() {
  if (blockedOffline()) return;
  const date = $("#dayDate").value;
  delete semOcc()[date];
  delete semMarks()[date];
  delete semNotes()[date];
  saveData();
  buildDayModalBody(date); // atualiza o modal mostrando o dia zerado
  renderAll();
  toast(t("day.cleared"));
}

/* guia matérias + config */
function renderSubjectsTab() {
  renderSubjectsByDay();
  renderSubjectList();
}

/* informações das matérias agrupadas por dia da semana (seg–sex) */
function renderSubjectsByDay() {
  const wrap = $("#subjectsByDay");
  wrap.innerHTML = "";
  let any = false;
  for (let wd = 1; wd <= 6; wd++) {
    const slots = slotsForWeekday(wd);
    if (!slots.length) continue;
    any = true;
    const block = document.createElement("div");
    block.className = "day-block";
    block.innerHTML = `<h3 class="day-title">${weekdayName(wd)}</h3>`;
    for (const { id, subj } of slots) {
      const def = slotInfo(id);
      const meeting = (subj.meetings || []).find(m => m.weekday === wd && m.slot === id);
      const room = meeting && meeting.room ? meeting.room : "";
      const card = document.createElement("div");
      card.className = "matter-card";
      card.style.setProperty("--card-accent", subj.color);
      card.innerHTML = `
        <div class="mc-top">
          <span class="mc-name">${esc(subj.name)}</span>
          ${room ? `<span class="mc-room">${esc(room)}</span>` : ""}
        </div>
        <div class="mc-line">${def.time}</div>
        ${(subj.prof || subj.profEmail) ? `<div class="mc-prof">
          ${subj.prof ? `<span>${esc(subj.prof)}</span>` : ""}
          ${subj.profEmail ? `<span class="mc-email" data-email="${esc(subj.profEmail)}" role="button" title="${t("subjects.copy_email")}">${esc(subj.profEmail)}</span>` : ""}
        </div>` : ""}`;
      block.appendChild(card);
    }
    wrap.appendChild(block);
  }
  if (!any) wrap.innerHTML = `<p class="muted small" style="padding:4px 2px 14px">${t("subjects.none_scheduled")}</p>`;
}

/* config / conta */
function renderSettings() { renderAccount(); }

function renderAccount() {
  const card = $("#accountCard");
  if (!card) return;
  if (cloudUserId) {
    card.hidden = false;
    const initial = (cloudUsername || "U").charAt(0).toUpperCase();
    $("#accountAvatar").textContent = initial;
    $("#accountName").textContent = cloudUsername || t("set.account");
    $("#accountAvatarLg").textContent = initial;
    $("#accountNameLg").textContent = cloudUsername || t("set.account");
    $("#accountEmail").textContent = cloudEmail || "";
  } else {
    card.hidden = true; // modo local não tem conta
  }
}

function openAccountModal() { showModal("#accountModal"); }

async function deleteAccount() {
  const ok = await uiConfirm(t("acc.delete_confirm"), { danger: true, yesLabel: t("acc.delete_yes"), countdown: 10 });
  if (!ok) return;
  try { if (cloudUserId) await M87Cloud.deleteData(cloudUserId); } catch (e) { console.error(e); }
  // remove de fato o usuário do Auth (via função no banco)
  let removed = false;
  try { await M87Cloud.deleteAccount(); removed = true; } catch (e) { console.error(e); }
  try { await M87Cloud.signOut(); } catch (e) { console.error(e); }
  cloudUserId = null;
  data = emptyData();
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  closeModals();
  showAuth();
  authMsg(removed ? t("acc.deleted") : t("acc.delete_partial"));
}

function renderSubjectList() {
  const list = $("#subjectList");
  list.innerHTML = "";
  const subs = activeSem()?.subjects || [];
  if (!subs.length) { list.innerHTML = `<p class="muted small">${t("subjects.none_yet")}</p>`; return; }
  for (const s of subs) {
    const row = document.createElement("div");
    row.className = "subject-row";
    row.innerHTML = `
      <span class="sr-color" style="background:${s.color}"></span>
      <div class="sr-info">
        <div class="sr-name">${esc(s.name || t("subjects.no_name"))}</div>
        <div class="sr-meta">${t("subjects.meta", { credits: s.credits, meetings: meetingsText(s) })}</div>
      </div>
      <button class="icon-btn" aria-label="${t("subj.edit")}">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
      </button>`;
    row.querySelector("button").onclick = () => openSubjectEditor(s.id);
    list.appendChild(row);
  }
}

/* editor de matéria */
let editingSubjectId = null;
let editingColor = PALETTE[0];

function openSubjectEditor(id) {
  const sem0 = activeSem();
  if (!sem0) { toast(t("subj.create_sem_first")); return; }
  if (!id && sem0.subjects.length >= 14) { toast(t("subj.limit")); return; }
  editingSubjectId = id;
  const s = id ? activeSem().subjects.find(x => x.id === id) : null;
  $("#subjectModalTitle").textContent = s ? t("subj.edit") : t("subj.new");
  $("#subjName").value = s?.name || "";
  $("#subjProf").value = s?.prof || "";
  $("#subjEmail").value = s?.profEmail || "";
  $("#subjCredits").value = String(s?.credits || 4);
  editingColor = s?.color || PALETTE[activeSem().subjects.length % PALETTE.length];
  renderColorPalette(editingColor);
  $("#deleteSubjectBtn").style.display = s ? "" : "none";
  renderMeetingEditor(s?.meetings || []);
  showModal("#subjectModal");
}

function renderColorPalette(selected) {
  const wrap = $("#colorPalette");
  wrap.innerHTML = "";
  for (const c of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (c === selected ? " selected" : "");
    b.style.background = c;
    b.onclick = () => { editingColor = c; renderColorPalette(c); };
    wrap.appendChild(b);
  }
}

function renderMeetingEditor(meetings) {
  const list = $("#meetingList");
  list.innerHTML = "";
  meetings.forEach(m => list.appendChild(meetingRow(m)));
}

function meetingRow(m) {
  const row = document.createElement("div");
  row.className = "meeting-row";
  const isCustom = typeof m.slot === "string" && m.slot.startsWith("c:");
  const wdOpts = [1, 2, 3, 4, 5, 6].map(w =>
    `<option value="${w}" ${m.weekday === w ? "selected" : ""}>${weekdayName(w)}</option>`).join("");
  let slotOpts = "", curShift = "";
  for (const sd of SLOT_DEFS) {
    if (sd.shift !== curShift) { if (curShift) slotOpts += "</optgroup>"; slotOpts += `<optgroup label="${tShift(sd.shift)}">`; curShift = sd.shift; }
    slotOpts += `<option value="${sd.id}" ${m.slot === sd.id ? "selected" : ""}>${tSlotLabel(sd.label)} (${sd.time})</option>`;
  }
  slotOpts += `</optgroup><option value="custom" ${isCustom ? "selected" : ""}>${t("subj.custom_opt")}</option>`;
  let cStart = "08:00", cEnd = "09:40";
  if (isCustom) { const p = m.slot.slice(2).split("-"); cStart = p[0] || cStart; cEnd = p[1] || cEnd; }
  row.innerHTML = `
    <div class="meet-line">
      <select class="meet-wd">${wdOpts}</select>
      <select class="meet-slot">${slotOpts}</select>
      <button class="icon-btn del-meet" type="button" aria-label="${t("subj.remove_meeting")}">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-3h6l1 2h4v2H4V6h4l1-2Z"/></svg>
      </button>
    </div>
    <div class="meet-custom" ${isCustom ? "" : "hidden"}>
      <input type="time" class="meet-start" value="${cStart}" />
      <span>–</span>
      <input type="time" class="meet-end" value="${cEnd}" />
    </div>
    <input type="text" class="meet-room" maxlength="40" placeholder="${t("subj.room_ph")}" value="${m.room ? esc(m.room) : ""}" />`;
  const slotSel = row.querySelector(".meet-slot");
  const custom = row.querySelector(".meet-custom");
  slotSel.onchange = () => { custom.hidden = slotSel.value !== "custom"; };
  row.querySelector(".del-meet").onclick = () => row.remove();
  return row;
}

function collectMeetings() {
  return $$("#meetingList .meeting-row").slice(0, MAX_MEETINGS).map(r => {
    let slot = $(".meet-slot", r).value;
    if (slot === "custom") {
      const s = $(".meet-start", r).value || "08:00";
      const e = $(".meet-end", r).value || "09:40";
      slot = `c:${s}-${e}`;
      data.lastCustomTime = slot; // memoriza o último horário personalizado
    }
    return { weekday: Number($(".meet-wd", r).value), slot, room: clampText($(".meet-room", r).value.trim(), 40) };
  });
}

function saveSubject() {
  if (blockedOffline()) return;
  const name = clampText($("#subjName").value.trim(), 80);
  if (!name) { toast(t("subj.name_required")); return; }
  const sem = activeSem();
  if (!sem) { closeModals(); return; }   // semestre sumiu (ex: removido em outro aparelho)
  const payload = {
    name,
    prof: clampText($("#subjProf").value.trim(), 80),
    profEmail: clampText($("#subjEmail").value.trim(), 120),
    credits: Number($("#subjCredits").value) === 2 ? 2 : 4,
    color: editingColor,
    meetings: collectMeetings(),
  };
  if (editingSubjectId) {
    const existing = sem.subjects.find(s => s.id === editingSubjectId);
    if (existing) Object.assign(existing, payload);
    else sem.subjects.push({ id: editingSubjectId, ...payload });   // removida durante a edição -> recria
  } else {
    sem.subjects.push({ id: "s_" + Date.now().toString(36), ...payload });
  }
  saveData();
  closeModals(); renderAll();
  toast(t("subj.saved"));
}

async function deleteSubject() {
  if (!editingSubjectId || blockedOffline()) return;
  const ok = await uiConfirm(t("subj.delete_confirm"), { danger: true, yesLabel: t("subj.delete") });
  if (!ok) return;
  const sem = activeSem();
  sem.subjects = sem.subjects.filter(s => s.id !== editingSubjectId);
  saveData();
  closeModals(); renderAll();
}

/* editor de semestre (modal customizado) */
let editingSemesterKey = null;
function semNumberFromLabel(label) { return parseInt(label, 10) || 1; }
/* rótulo do semestre montado no idioma atual (a partir de campos estruturados;
   cai no parsing do label antigo para semestres criados antes do i18n) */
function semParts(sem) {
  if (sem && sem.num) return { num: sem.num, period: sem.period || "fev", year: sem.year || new Date().getFullYear() };
  const num = semNumberFromLabel(sem && sem.label);
  const year = sem && sem.start ? Number(sem.start.slice(0, 4)) : new Date().getFullYear();
  const period = sem && sem.start && Number(sem.start.slice(5, 7)) <= 7 ? "fev" : "ago";
  return { num, period, year };
}
function semShort(sem) { return t("sem.nth", { n: semParts(sem).num }); }
function semRange(sem) { const p = semParts(sem); return t(p.period === "ago" ? "sem.period_aug_short" : "sem.period_feb_short") + " " + p.year; }
function semDisplayLabel(sem) { return `${semShort(sem)} (${semRange(sem)})`; }

function openSemesterEditor(key, welcome) {
  if (!key && Object.keys(data.semesters).length >= 18) { toast(t("sem.limit")); return; }
  editingSemesterKey = key;
  const sem = key ? data.semesters[key] : null;
  $("#semEditTitle").textContent = welcome
    ? t("sem.welcome", { name: cloudUsername || "USP" })
    : (sem ? t("sem.edit") : t("sem.new"));

  $("#semNumber").innerHTML = Array.from({ length: 18 }, (_, i) => `<option value="${i + 1}">${t("sem.nth", { n: i + 1 })}</option>`).join("");
  const yNow = new Date().getFullYear();
  const ySel = $("#semYear");
  const years = [];
  for (let y = yNow - 2; y <= yNow + 5; y++) years.push(`<option value="${y}">${y}</option>`);
  ySel.innerHTML = years.join("");

  if (sem) {
    $("#semNumber").value = String(semParts(sem).num);
    $("#semPeriod").value = semParts(sem).period;
    ySel.value = sem.start ? sem.start.slice(0, 4) : String(yNow);
    $("#semDeleteBtn").hidden = false;
  } else {
    const nums = Object.values(data.semesters).map(s => semParts(s).num);
    $("#semNumber").value = String(nums.length ? Math.min(18, Math.max(...nums) + 1) : 1);
    $("#semPeriod").value = "fev";
    ySel.value = String(yNow);
    $("#semDeleteBtn").hidden = true;
  }
  showModal("#semEditModal");
}

function periodDates(period, year) {
  return period === "ago"
    ? { start: `${year}-08-01`, end: `${year}-12-20` }
    : { start: `${year}-02-01`, end: `${year}-06-30` };
}

function saveSemesterFromModal() {
  if (blockedOffline()) return;
  const num = Number($("#semNumber").value);
  const period = $("#semPeriod").value;
  const year = Number($("#semYear").value);
  const { start, end } = periodDates(period, year);
  // label canônico (pt) só como reserva; a exibição usa semDisplayLabel() no idioma atual
  const label = `${num}º Semestre (${period === "ago" ? "Ago - Dez" : "Fev - Jun"} ${year})`;
  if (editingSemesterKey && data.semesters[editingSemesterKey]) {
    Object.assign(data.semesters[editingSemesterKey], { label, start, end, num, period, year });
  } else {
    let key = `${year}.${period === "fev" ? 1 : 2}`;
    while (data.semesters[key]) key += "x";
    data.semesters[key] = { label, start, end, num, period, year, subjects: [] };
    data.occ[key] = {}; data.marks[key] = {}; data.notes[key] = {};
    data.activeSemester = key;
  }
  saveData();
  updateSemesterButton();
  calRef = null;
  closeModals();
  renderAll();
  toast(editingSemesterKey ? t("sem.updated") : t("sem.created"));
}

async function deleteSemester(key) {
  if (blockedOffline()) return;
  const ok = await uiConfirm(t("sem.delete_confirm", { label: semDisplayLabel(data.semesters[key]) }), { danger: true, yesLabel: t("sem.delete") });
  if (!ok) return;
  delete data.semesters[key];
  delete data.occ[key]; delete data.marks[key]; delete data.notes[key];
  if (data.activeSemester === key) data.activeSemester = Object.keys(data.semesters)[0] || null;
  saveData();
  updateSemesterButton();
  calRef = null; renderAll();
  toast(t("sem.deleted"));
}

/* diálogos personalizados (substituem alert/confirm/prompt do SO) */
let _confirmCb = null, _confirmIsPrompt = false, _cdTimer = null;
function _openConfirm({ title = t("confirm.title"), message, yesLabel = t("confirm.yes"), danger = false, prompt = false, placeholder = "", countdown = 0 }) {
  return new Promise(resolve => {
    _confirmCb = resolve; _confirmIsPrompt = prompt;
    $("#confirmTitle").textContent = title;
    $("#confirmMsg").textContent = message;
    const inp = $("#confirmInput");
    inp.hidden = !prompt; inp.value = ""; inp.placeholder = placeholder;
    const yes = $("#confirmYes");
    yes.classList.toggle("btn-danger-fill", danger);
    clearInterval(_cdTimer);
    if (countdown > 0) {
      let left = countdown;
      yes.disabled = true;
      yes.textContent = `${yesLabel} (${left})`;
      _cdTimer = setInterval(() => {
        left--;
        if (left <= 0) { clearInterval(_cdTimer); yes.disabled = false; yes.textContent = yesLabel; }
        else yes.textContent = `${yesLabel} (${left})`;
      }, 1000);
    } else { yes.disabled = false; yes.textContent = yesLabel; }
    showModal("#confirmModal");
    if (prompt) setTimeout(() => inp.focus(), 60);
  });
}
function uiConfirm(message, opts = {}) { return _openConfirm({ message, ...opts }); }
function uiPrompt(message, opts = {}) { return _openConfirm({ message, prompt: true, ...opts }); }
function resolveConfirm(val) {
  clearInterval(_cdTimer);
  $("#confirmModal").hidden = true;
  const cb = _confirmCb; _confirmCb = null;
  if (cb) cb(val);
}

/* apagar dados / sobre */
async function wipeAllData() {
  const ok = await uiConfirm(t("acc.wipe_confirm"), { danger: true, yesLabel: t("acc.wipe_yes"), countdown: 10 });
  if (!ok) return;
  data = emptyData();
  saveData();
  updateSemesterButton();
  calRef = null;
  closeModals();
  renderAll();
  renderSettings();
  toast(t("acc.wiped"));
  if (cloudUserId) openSemesterEditor(null, true);
}

function openAbout() {
  $("#aboutVersion").textContent = "v" + APP_VERSION;
  showModal("#aboutModal");
}

/* modais / nav */
function showModal(sel) { $(sel).hidden = false; }
function closeModals() {
  clearInterval(_cdTimer);   // evita vazar o timer da contagem regressiva ao fechar pelo X / fora
  $$(".modal-overlay").forEach(m => (m.hidden = true));
  if (_confirmCb) { const cb = _confirmCb; _confirmCb = null; cb(_confirmIsPrompt ? null : false); }
}

function updateSemesterButton() {
  const el = $("#semesterBtnLabel");
  if (!el) return;
  const sem = activeSem();
  el.textContent = sem ? semShort(sem) : t("header.no_semester");
}

function openSemesterPicker() {
  const list = $("#semesterPickerList");
  list.innerHTML = "";
  for (const [key, sem] of Object.entries(data.semesters)) {
    const detail = semRange(sem);
    const row = document.createElement("div");
    row.className = "picker-row";
    const b = document.createElement("button");
    b.className = "picker-item" + (key === data.activeSemester ? " active" : "");
    b.innerHTML = `<span class="pi-name">${esc(semShort(sem))}</span>` +
                  (detail ? `<span class="pi-detail">${esc(detail)}</span>` : "");
    b.onclick = () => { selectSemester(key); closeModals(); };
    const edit = document.createElement("button");
    edit.className = "icon-btn picker-edit";
    edit.setAttribute("aria-label", t("sem.edit_aria"));
    edit.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>`;
    edit.onclick = () => { closeModals(); openSemesterEditor(key); };
    row.appendChild(b); row.appendChild(edit);
    list.appendChild(row);
  }
  const create = document.createElement("button");
  create.className = "btn btn-sm btn-ghost";
  create.style.marginTop = "4px";
  create.textContent = t("sem.new_semester");
  create.onclick = () => { closeModals(); openSemesterEditor(null); };
  list.appendChild(create);
  showModal("#semesterModal");
}

function selectSemester(key) {
  data.activeSemester = key;
  autoSwitched = false;
  saveData();
  calRef = null;
  updateSemesterButton();
  renderAll();
}

function switchView(view) {
  // retorno de segurança ao sair do calendário
  if (view !== "calendar" && autoSwitched) {
    autoSwitched = false;
    data.activeSemester = currentSemesterKey();
    updateSemesterButton();
    calRef = null;
  }
  activeView = view;
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#view-${view}`).classList.add("active");
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") renderDashboard();
  if (view === "subjects") renderSubjectsTab();
  if (view === "calendar") renderCalendar();
  if (view === "settings") renderSettings();
  $("#fab").hidden = (view === "settings" || view === "subjects"); // FAB só no painel/calendário
  if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
}

/* renderiza apenas a guia visível; as demais são re-renderizadas ao trocar de guia
   (switchView), evitando trabalho com views ocultas a cada edição */
function renderAll() {
  if (activeView === "subjects") renderSubjectsTab();
  else if (activeView === "calendar") renderCalendar();
  else if (activeView === "settings") renderSettings();
  else renderDashboard();
}

/* idioma */
function applyLang() {
  document.documentElement.lang = getLang() === "pt" ? "pt-BR" : getLang();
  applyStaticI18n();
  // cabeçalho do calendário (seg..dom = dias 1..7)
  $$(".cal-weekdays span").forEach((el, i) => (el.textContent = weekdayShort(i + 1).toLowerCase()));
  $$("#langSeg .lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === getLang()));
  if ($("#aboutVersion")) $("#aboutVersion").textContent = "v" + APP_VERSION;
  if (!$("#auth").hidden) setAuthMode(authMode);     // reaplica os rótulos do login
  updateSemesterButton();
  if (cloudUserId) renderAccount();
  buildKbdHints();
  setConn(_connState);          // reaplica o texto de conexão no idioma atual
  renderInstallButton();
  renderAll();
}
function setLanguage(l) {
  setLang(l);
  applyLang();
  toast(t("misc.lang_changed"));
}

/* menu lateral recolhível (desktop) */
function applyNavCollapsed(state) {
  document.documentElement.classList.toggle("nav-collapsed", !!state);
  localStorage.setItem("m87.navCollapsed", state ? "1" : "0");
  const btn = $("#navCollapse");
  if (btn) btn.setAttribute("aria-label", t(state ? "nav.expand" : "nav.collapse"));
}
function toggleNav() {
  applyNavCollapsed(!document.documentElement.classList.contains("nav-collapsed"));
}

/* barra de atalhos de teclado (só aparece no desktop, via CSS) */
function buildKbdHints() {
  let el = $("#kbdHints");
  if (!el) {
    el = document.createElement("div");
    el.id = "kbdHints";
    el.className = "kbd-hints";
    document.body.appendChild(el);
  }
  const groups = [
    { keys: ["1", "2", "3", "4"], label: t("kbd.tabs") },
    { keys: ["←", "→"], label: t("kbd.month") },
    { keys: ["H"], label: t("kbd.today") },
    { keys: ["N"], label: t("kbd.new") },
    { keys: ["Esc"], label: t("kbd.esc") },
  ];
  el.innerHTML =
    `<span class="kbd-title">${t("kbd.title")}</span>` +
    groups.map(g =>
      `<span class="kbd-group">${g.keys.map(k => `<kbd class="kbd">${k}</kbd>`).join("")}<span class="kbd-label">${g.label}</span></span>`
    ).join("");
}

/* eventos */
function bindEvents() {
  $("#semesterBtn").onclick = openSemesterPicker;
  $$(".nav-btn").forEach(b => b.onclick = () => switchView(b.dataset.view));
  $("#calPrev").onclick = () => calShift(-1);
  $("#calNext").onclick = () => calShift(1);
  $("#calToday").onclick = goToday;

  const cg = $("#calGrid");
  cg.addEventListener("click", e => {
    const cell = e.target.closest(".cal-cell.classday");
    if (cell && Date.now() - lastSwipe >= 400) openDayModal(cell.dataset.date); // ignora clique logo após deslizar
  });

  $("#fab").onclick = () => {
    const sem = activeSem();
    if (!sem) { openSemesterEditor(null); return; }   // sem semestre ativo: leva a criar um
    const today = new Date();
    const d = (today >= parseDate(sem.start) && today <= parseDate(sem.end)) ? today : parseDate(sem.start);
    openDayModal(fmtDate(d.getFullYear(), d.getMonth(), d.getDate()));
  };

  $("#dayDate").onchange = e => buildDayModalBody(e.target.value);
  $("#daySaveBtn").onclick = saveDayModal;
  $$("#dayModal .chip[data-mark]").forEach(ch => {
    ch.onclick = () => {
      const m = ch.dataset.mark;
      if (m === "clear") { clearDay(); return; }
      const wasActive = ch.classList.contains("active");
      $$("#dayModal .chip[data-mark]").forEach(c => c.classList.remove("active"));
      if (!wasActive) ch.classList.add("active");
      $$("#daySlots .slot").forEach(s => s.classList.toggle("disabled", !wasActive));
    };
  });

  $("#subjectsByDay").addEventListener("click", e => {
    const el = e.target.closest(".mc-email");
    if (el) copyText(el.dataset.email);
  });

  $("#addSubjectBtn").onclick = () => openSubjectEditor(null);
  $("#subjectSaveBtn").onclick = saveSubject;
  $("#deleteSubjectBtn").onclick = deleteSubject;
  $("#addMeetingBtn").onclick = () => {
    if ($$("#meetingList .meeting-row").length >= MAX_MEETINGS) { toast(t("subj.meeting_limit", { n: MAX_MEETINGS })); return; }
    $("#meetingList").appendChild(meetingRow({ weekday: 1, slot: data.lastCustomTime || "n1", room: "" }));
  };
  $("#semSaveBtn").onclick = saveSemesterFromModal;
  $("#semDeleteBtn").onclick = () => { const k = editingSemesterKey; closeModals(); deleteSemester(k); };

  $("#confirmYes").onclick = () => resolveConfirm(_confirmIsPrompt ? $("#confirmInput").value : true);
  $("#confirmNo").onclick = () => resolveConfirm(_confirmIsPrompt ? null : false);
  $("#confirmInput").addEventListener("keydown", e => { if (e.key === "Enter") $("#confirmYes").click(); });

  $("#wipeBtn").onclick = wipeAllData;
  $("#aboutBtn").onclick = openAbout;
  $("#accountCard").onclick = openAccountModal;
  $("#deleteAccountBtn").onclick = deleteAccount;
  $("#creditViwctor").onclick = () => window.open("https://github.com/viwctor/m87", "_blank", "noopener");
  $("#retryConn").onclick = updateConn;
  $$("#langSeg .lang-btn").forEach(b => b.onclick = () => setLanguage(b.dataset.lang));
  $("#navCollapse").onclick = toggleNav;

  // gesto de deslizar: dentro da grade do calendário = troca o mês; fora dela = troca a guia
  const swipeOrder = ["subjects", "dashboard", "calendar", "settings"];
  let _gx = null, _gy = null, _gt = null;
  document.addEventListener("touchstart", e => {
    _gx = e.changedTouches[0].clientX; _gy = e.changedTouches[0].clientY; _gt = e.target;
  }, { passive: true });
  document.addEventListener("touchend", e => {
    if (_gx === null) return;
    const dx = e.changedTouches[0].clientX - _gx, dy = e.changedTouches[0].clientY - _gy;
    const startY = _gy, tgt = _gt; _gx = _gy = _gt = null;
    if (!tgt || !tgt.closest) return;
    if (tgt.closest(".modal-overlay") || tgt.closest(".bottom-nav") || !$("#auth").hidden) return;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;   // não é horizontal o suficiente
    // dentro da faixa vertical da grade do calendário (e na guia calendário) -> troca o mês
    const r = $("#calGrid").getBoundingClientRect();
    if (activeView === "calendar" && r.height && startY >= r.top && startY <= r.bottom) {
      lastSwipe = Date.now();
      calShift(dx < 0 ? 1 : -1);
      return;
    }
    // fora -> troca a guia
    const cur = swipeOrder.indexOf(activeView);
    const next = Math.max(0, Math.min(swipeOrder.length - 1, cur + (dx < 0 ? 1 : -1)));
    if (next !== cur) switchView(swipeOrder[next]);
  }, { passive: true });

  $$("[data-close-modal]").forEach(b => b.onclick = closeModals);
  $$(".modal-overlay").forEach(ov => ov.addEventListener("click", e => { if (e.target === ov) closeModals(); }));

  // atalhos de teclado (desktop)
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.matches("input, select, textarea")) return;
    const modalOpen = $$(".modal-overlay").some(m => !m.hidden);
    if (e.key === "Escape" && modalOpen) { closeModals(); return; }
    if (modalOpen || !$("#auth").hidden) return;
    const views = { "1": "subjects", "2": "dashboard", "3": "calendar", "4": "settings" };
    if (views[e.key]) { switchView(views[e.key]); return; }
    if (activeView === "calendar") {
      if (e.key === "ArrowLeft") calShift(-1);
      else if (e.key === "ArrowRight") calShift(1);
      else if (e.key.toLowerCase() === "h") goToday();
    }
    if (e.key.toLowerCase() === "n" && !$("#fab").hidden) $("#fab").click();
  });
}

/* autenticação / nuvem (supabase) — opcional */
let authMode = "login";
function authMsg(msg) { $("#authMsg").textContent = msg || ""; }

let _authFxStarted = false;
function showAuth() {
  $("#auth").hidden = false;
  if (!_authFxStarted) { _authFxStarted = true; startParticles($("#authFx"), { mode: "orbit", areaPer: 16000, max: 90 }); }   // canvas só tem tamanho com o login visível
  setAuthMode("login");
}
function setAuthMode(mode) {
  authMode = mode;
  $("#authUsername").hidden = mode !== "signup";
  $("#authPrimary").textContent = mode === "login" ? t("auth.enter") : t("auth.create");
  $("#authSecondary").textContent = mode === "login" ? t("auth.create") : t("auth.have");
  authMsg("");
}

/* traduz as mensagens de erro do supabase para o idioma atual */
function translateAuthError(e) {
  const msg = ((e && (e.message || e.error_description)) || "") + "";
  const code = (e && e.code) || "";
  const low = msg.toLowerCase();
  if (low.includes("invalid login") || code === "invalid_credentials") return t("auth.invalid");
  if (low.includes("rate limit") || code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return t("auth.rate");
  if (low.includes("already registered") || low.includes("already been registered") || code === "user_already_exists" || code === "email_exists") return t("auth.exists");
  if (low.includes("at least 6") || low.includes("password should be") || code === "weak_password") return t("auth.pass_min");
  if (low.includes("not confirmed") || code === "email_not_confirmed") return t("auth.not_confirmed");
  // falha no envio do e-mail (SMTP/Brevo mal configurado, remetente não verificado, etc.)
  if (low.includes("sending") || low.includes("smtp") || (low.includes("email") && low.includes("error")) || code === "unexpected_failure") return t("auth.email_send_fail");
  if (low.includes("usp")) return t("auth.usp_only"); // exceção do gatilho do banco
  return t("auth.generic");
}

async function doAuthPrimary() {
  const email = $("#authEmail").value.trim();
  const pw = $("#authPassword").value;
  if (!email || !pw) { authMsg(t("auth.fill")); return; }
  if (authMode === "signup" && pw.length < 6) { authMsg(t("auth.pass_min")); return; }
  authMsg(t("auth.wait"));
  try {
    if (authMode === "login") {
      const res = await M87Cloud.signIn(email, pw);
      await enterApp(res.user);
    } else {
      const username = clampText($("#authUsername").value.trim(), 24);
      if (!username) { authMsg(t("auth.choose_user")); return; }
      if (!/@([a-z0-9-]+\.)*usp\.br$/i.test(email)) { authMsg(t("auth.usp_only")); return; }
      const res = await M87Cloud.signUp(email, pw, username);
      // O supabase devolve "sucesso" mesmo quando o e-mail já existe (proteção contra descoberta de contas): nesse caso, user.identities vem vazio.
      const jaExiste = res.user && Array.isArray(res.user.identities) && res.user.identities.length === 0;
      if (jaExiste) { setAuthMode("login"); authMsg(t("auth.exists")); return; }
      if (res.session && res.user) await enterApp(res.user);
      else { setAuthMode("login"); authMsg(t("auth.created")); }
    }
  } catch (e) {
    authMsg(translateAuthError(e));
  }
}
let _lastForgot = 0;
async function doForgot() {
  const email = $("#authEmail").value.trim();
  if (!email) { authMsg(t("auth.forgot_need_email")); return; }
  // evita disparar vários e-mails seguidos (e o erro "rate limit" do supabase)
  if (Date.now() - _lastForgot < 60000) { authMsg(t("auth.rate")); return; }
  _lastForgot = Date.now();
  try { await M87Cloud.resetPassword(email); authMsg(t("auth.forgot_sent")); }
  catch (e) { authMsg(translateAuthError(e)); }
}
async function doLogout() {
  const ok = await uiConfirm(t("acc.logout_confirm"), { yesLabel: t("acc.logout_yes") });
  if (!ok) return;
  try { await M87Cloud.signOut(); } catch (e) { console.error(e); }
  cloudUserId = null;
  data = seedData();                                  // limpa o cache local (evita vazar dados ao próximo login)
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  closeModals();
  showAuth();
}
async function handlePasswordRecovery() {
  $("#auth").hidden = false;
  const np = await uiPrompt(t("auth.new_pass"), { yesLabel: t("auth.save"), placeholder: t("auth.new_pass_ph") });
  if (!np) return;
  if (np.length < 6) { toast(t("auth.pass_too_short")); return; }
  try { await M87Cloud.updatePassword(np); toast(t("auth.pass_updated")); }
  catch (e) { toast(translateAuthError(e)); }
}

async function enterApp(user) {
  cloudUserId = user.id;
  cloudUsername = (user.user_metadata && user.user_metadata.username) ||
                  (user.email ? user.email.split("@")[0] : "Usuário");
  cloudEmail = user.email || "";
  try {
    const remote = await M87Cloud.loadData(user.id);
    if (remote && remote.semesters && Object.keys(remote.semesters).length) {
      data = migrate(remote);
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } else {
      data = emptyData();                              // novo usuário começa vazio
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
      await M87Cloud.saveData(user.id, data);
    }
  } catch (e) {
    console.error("Falha ao carregar dados da nuvem:", e); // segue com o cache local
  }
  _dataVer++;
  updateSemesterButton();
  calRef = null;
  renderAll();
  renderAccount();
  applyHashView();
  $("#auth").hidden = true;
  hideSplash();
  if (!activeSem()) openSemesterEditor(null, true);    // boas-vindas: escolher o semestre
  if ("Notification" in window && Notification.permission === "default") { try { Notification.requestPermission(); } catch (e) {} }
  try { M87Cloud.subscribe(user.id, handleRealtime); } catch (e) { console.error(e); }
  maybeShowUpdateNotes();
}

/* mudança vinda de outro aparelho (tempo real) */
function handleRealtime(row) {
  if (!row || !row.data || row.data._device === DEVICE_ID) return; // ignora o próprio eco
  try {
    data = migrate(row.data);
    if (!data.semesters[data.activeSemester]) data.activeSemester = Object.keys(data.semesters)[0] || null;
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    _dataVer++;
    updateSemesterButton();
    calRef = null;
    renderAll();
    renderAccount();
    toast(t("misc.updated_other"));
  } catch (e) { console.error("realtime", e); }
}

function bindAuthEvents() {
  if (!$("#authPrimary")) return;
  $("#authPrimary").onclick = doAuthPrimary;
  $("#authSecondary").onclick = () => setAuthMode(authMode === "login" ? "signup" : "login");
  $("#authForgot").onclick = doForgot;
  $("#logoutBtn").onclick = doLogout;
  $("#authPassword").addEventListener("keydown", e => { if (e.key === "Enter") doAuthPrimary(); });
}

/* init */
function applyHashView() {
  const hv = location.hash.slice(1);
  if (["subjects", "calendar", "settings"].includes(hv)) switchView(hv);
}
function hideSplash() {
  const sp = $("#splash");
  if (sp) { sp.classList.add("hide"); setTimeout(() => sp.remove(), 450); }
}
/* aviso de nova versão disponível (PWA) */
function showUpdateBanner() {
  if ($("#updateBanner")) return;                 // já aberto
  const el = document.createElement("div");
  el.id = "updateBanner";
  el.className = "update-banner";
  el.innerHTML =
    `<span>${t("update.available")}</span>` +
    `<button class="btn btn-sm btn-primary" id="updateReload">${t("update.reload")}</button>` +
    `<button class="btn btn-sm btn-ghost" id="updateDismiss">${t("update.dismiss")}</button>`;
  document.body.appendChild(el);
  $("#updateReload").onclick = () => { localStorage.setItem("m87.updated", "1"); location.reload(); };
  $("#updateDismiss").onclick = () => el.remove();
}
/* após recarregar por uma atualização, mostra as notas da versão uma vez */
function maybeShowUpdateNotes() {
  if (localStorage.getItem("m87.updated")) {
    localStorage.removeItem("m87.updated");
    setTimeout(() => { if (!$("#auth") || $("#auth").hidden) openAbout(); }, 500);
  }
}
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  // se já havia um SW controlando ao carregar, uma troca de controlador = nova versão publicada
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) showUpdateBanner();
    hadController = true;
  });
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(reg => {
      // procura atualização de tempos em tempos e ao voltar para a aba
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}

async function cloudInit() {
  M87Cloud.onAuthChange((event) => {
    if (event === "PASSWORD_RECOVERY") handlePasswordRecovery();
    else if (event === "SIGNED_OUT") showAuth();
  });
  let session = null;
  try { session = await M87Cloud.getSession(); } catch (e) { console.error(e); }
  if (session && session.user) await enterApp(session.user);
  else setTimeout(() => { hideSplash(); showAuth(); }, 1100);
}

async function init() {
  bindEvents();
  bindAuthEvents();
  registerSW();
  applyLang();
  applyNavCollapsed(localStorage.getItem("m87.navCollapsed") === "1");
  setConn(navigator.onLine ? "online" : "offline");
  window.addEventListener("online", updateConn);
  window.addEventListener("offline", () => setConn("offline"));
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); _deferredInstall = e; renderInstallButton(); });
  window.addEventListener("appinstalled", () => { _deferredInstall = null; _relatedInstalled = true; renderInstallButton(); });
  checkInstalled();
  startParticles($("#bgFx"), { mode: "drift", areaPer: 46000, max: 24 });   // app: poucas partículas, movimento linear
  if (typeof M87Cloud !== "undefined" && M87Cloud.configured()) {
    const ok = await M87Cloud.ensureLib();
    if (ok) { cloudInit(); return; }   // login + dados na nuvem configurado, mas a biblioteca não carregou: mostra o login com aviso (não usa o seed)
    hideSplash();
    showAuth();
    authMsg(t("auth.lib_fail"));
    return;
  }
  // modo local (nuvem não configurada)
  updateSemesterButton();
  renderAll();
  applyHashView();
  setTimeout(hideSplash, 1100);
  maybeShowUpdateNotes();
}
init();
