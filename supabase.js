/* supabase: login e dados por usuário */
const SUPABASE_URL = "https://fxuxkzpwwknhofhajvkk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4dXhrenB3d2tuaG9maGFqdmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyODIxNTgsImV4cCI6MjA5Njg1ODE1OH0.Kt51uwGtZgmrPiO0DvAnxEi6nJ9TWPMK51NcL_aTdtw";

const M87Cloud = (() => {
  let client = null;

  function configured() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); }
  function enabled() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient);
  }
  function getClient() {
    if (!client && enabled()) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return client;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error(src));
      document.head.appendChild(s);
    });
  }
  // garante que a biblioteca do Supabase carregou (tenta UMD; se falhar, usa ESM)
  async function ensureLib() {
    if (window.supabase && window.supabase.createClient) return true;
    const umd = [
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
      "https://unpkg.com/@supabase/supabase-js@2",
    ];
    for (const url of umd) {
      try { await loadScript(url); if (window.supabase && window.supabase.createClient) return true; } catch (e) {}
    }
    try {
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      if (mod && mod.createClient) { window.supabase = mod; return true; }
    } catch (e) {}
    return !!(window.supabase && window.supabase.createClient);
  }

  async function getSession() {
    if (!enabled()) return null;
    const { data } = await getClient().auth.getSession();
    return data.session || null;
  }
  function onAuthChange(cb) {
    if (!enabled()) return;
    getClient().auth.onAuthStateChange((event, session) => cb(event, session));
  }

  async function signIn(email, password) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data; // { user, session }
  }
  async function signUp(email, password, username) {
    const { data, error } = await getClient().auth.signUp({
      email, password,
      options: { data: { username: username || "" } },
    });
    if (error) throw error;
    return data; // { user, session } (session é null se exigir confirmação por email)
  }
  async function resetPassword(email) {
    const redirectTo = location.href.split("#")[0];
    const { error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }
  async function updatePassword(password) {
    const { error } = await getClient().auth.updateUser({ password });
    if (error) throw error;
  }
  async function signOut() {
    if (enabled()) await getClient().auth.signOut();
  }

  /* uma linha por usuário na tabela app_data (coluna data jsonb) */
  async function loadData(userId) {
    const { data, error } = await getClient()
      .from("app_data").select("data").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }
  async function saveData(userId, payload) {
    const { error } = await getClient().from("app_data")
      .upsert({ user_id: userId, data: payload, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  async function deleteData(userId) {
    const { error } = await getClient().from("app_data").delete().eq("user_id", userId);
    if (error) throw error;
  }
  // remove a própria conta do auth (precisa da função delete_user criada no banco)
  async function deleteAccount() {
    const { error } = await getClient().rpc("delete_user");
    if (error) throw error;
  }

  /* avisa quando a linha do usuário muda (de outro aparelho) */
  function subscribe(userId, cb) {
    if (!enabled()) return null;
    return getClient()
      .channel("m87-" + userId)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "app_data", filter: `user_id=eq.${userId}` },
        payload => cb(payload.new))
      .subscribe();
  }

  return {
    configured, enabled, ensureLib, getSession, onAuthChange,
    signIn, signUp, resetPassword, updatePassword, signOut,
    loadData, saveData, deleteData, deleteAccount, subscribe,
  };
})();
window.M87Cloud = M87Cloud;
