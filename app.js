/* ============================================================
   M87 — Controle de Faltas
   Vanilla JS · localStorage · PWA
   ------------------------------------------------------------
   Modelo de dados (chave localStorage: "m87.data")
   {
     version, activeSemester,
     semesters: {
       "2026.1": {
         label, start:"YYYY-MM-DD", end:"YYYY-MM-DD",
         subjects: [{ id, code, name, prof, credits, color,
                      meetings:[{ weekday:1-6, slot:"m1|m2|n1|n2" }] }]
       }
     },
     occ:   { "2026.1": { "YYYY-MM-DD": { "n1":"falta"|"prof", ... } } },
     marks: { "2026.1": { "YYYY-MM-DD": "holiday"|"noclass" } }
   }
   Slots (horários): manhã m1/m2, noite n1/n2.
   Cada slot com status "falta" = 1 falta. "prof" não conta.
   Limite: 4 créditos = 8 faltas · 2 créditos = 4 faltas.
   ============================================================ */

const STORE_KEY = "m87.data";

/* Horários possíveis, em ordem cronológica */
const SLOT_DEFS = [
  { id: "m1", time: "08:00 – 09:40", short: "08h",   label: "1ª aula · manhã", shift: "Manhã" },
  { id: "m2", time: "10:00 – 11:40", short: "10h",   label: "2ª aula · manhã", shift: "Manhã" },
  { id: "n1", time: "19:00 – 20:40", short: "19h",   label: "1ª aula · noite", shift: "Noite" },
  { id: "n2", time: "20:50 – 22:30", short: "20h50", label: "2ª aula · noite", shift: "Noite" },
];
const SLOT_BY_ID = Object.fromEntries(SLOT_DEFS.map(s => [s.id, s]));
const SLOT_ORDER = SLOT_DEFS.map(s => s.id);

const WEEKDAYS = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const WD_SHORT = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/* ---------- Dados iniciais: grade 2026.1 (noite) ---------- */
function seedData() {
  return {
    version: 2,
    activeSemester: "2026.1",
    semesters: {
      "2026.1": {
        label: "3º Semestre (Fev - Jun 2026)",
        start: "2026-02-02",
        end: "2026-06-30",
        subjects: [
          { id: "rad1604", code: "RAD1604", name: "Desenvolvimento de Sistemas de Informação", prof: "Ildeberto Aparecido Rodello", credits: 4, color: "#ff9e2c",
            meetings: [{ weekday: 1, slot: "n1" }, { weekday: 3, slot: "n2" }] },
          { id: "rad1307", code: "RAD1307", name: "Comportamento Organizacional", prof: "Clarissa Dourado Freire", credits: 4, color: "#ff5e3a",
            meetings: [{ weekday: 1, slot: "n2" }, { weekday: 2, slot: "n2" }] },
          { id: "rad1618", code: "RAD1618", name: "Direito Tributário", prof: "Alexandre Ganan de Brites Figueiredo", credits: 2, color: "#ffd23f",
            meetings: [{ weekday: 2, slot: "n1" }] },
          { id: "rad1301", code: "RAD1301", name: "Matemática Financeira", prof: "Tabajara Pimenta Júnior", credits: 4, color: "#f7773d",
            meetings: [{ weekday: 3, slot: "n1" }, { weekday: 4, slot: "n2" }] },
          { id: "rec2403", code: "REC2403", name: "Introdução à Economia Brasileira", prof: "Marcio Bobik Braga", credits: 4, color: "#ffb347",
            meetings: [{ weekday: 4, slot: "n1" }, { weekday: 5, slot: "n2" }] },
          { id: "rad1408", code: "RAD1408", name: "Estatística Aplicada à Administração", prof: "Evandro Marcos Saidel Ribeiro", credits: 2, color: "#e8552d",
            meetings: [{ weekday: 5, slot: "n1" }] },
        ],
      },
      "2026.2": {
        label: "4º Semestre (Ago - Dez 2026)",
        start: "2026-08-03",
        end: "2026-12-18",
        subjects: [
          { id: "s_arh",   code: "", name: "Administração de Recursos Humanos", prof: "", credits: 4, color: "#ff9e2c", meetings: [] },
          { id: "s_anfin", code: "", name: "Análise Financeira", prof: "", credits: 2, color: "#ffd23f", meetings: [] },
          { id: "s_mkt",   code: "", name: "Marketing I", prof: "", credits: 4, color: "#ff5e3a", meetings: [] },
          { id: "s_ops",   code: "", name: "Administração de Operações I", prof: "", credits: 4, color: "#f7773d", meetings: [] },
          { id: "s_dcom",  code: "", name: "Direito Comercial", prof: "", credits: 2, color: "#e8552d", meetings: [] },
        ],
      },
    },
    occ: { "2026.1": {}, "2026.2": {} },
    marks: { "2026.1": {}, "2026.2": {} },
  };
}

/* ---------- Estado ---------- */
let data = loadData();
let calRef = null;

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

/* Migra dados antigos (slots numéricos 1/2 = noite) para o novo formato */
function migrate(d) {
  d.occ = d.occ || {};
  d.marks = d.marks || {};
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
  d.version = 2;
  return d;
}

function saveData() {
  data._updatedAt = Date.now();
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  if (window.M87Sync && M87Sync.getCfg()) M87Sync.push(data);
}

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function activeSem() { return data.semesters[data.activeSemester]; }
function semOcc()    { return (data.occ[data.activeSemester]   ||= {}); }
function semMarks()  { return (data.marks[data.activeSemester] ||= {}); }
function maxFor(subject) { return subject.credits === 4 ? 8 : 4; }

function fmtDate(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function parseDate(str) { const [y, m, d] = str.split("-").map(Number); return new Date(y, m - 1, d); }
function isoWeekday(dateObj) { const wd = dateObj.getDay(); return wd === 0 ? 7 : wd; }

/* mapa weekday -> { slotId: subject } */
function buildTimetable() {
  const tt = {};
  for (const s of activeSem().subjects) {
    for (const m of (s.meetings || [])) {
      (tt[m.weekday] ||= {})[m.slot] = s;
    }
  }
  return tt;
}
/* slots de um dia da semana, em ordem cronológica */
function slotsForWeekday(wd) {
  const day = buildTimetable()[wd] || {};
  return SLOT_ORDER.filter(id => day[id]).map(id => ({ id, subj: day[id] }));
}
function subjectAt(weekday, slotId) {
  const tt = buildTimetable();
  return tt[weekday] ? tt[weekday][slotId] : null;
}

function countAbsences(subjectId) {
  const occ = semOcc(), marks = semMarks();
  let count = 0;
  for (const [date, slots] of Object.entries(occ)) {
    if (marks[date]) continue;
    const wd = isoWeekday(parseDate(date));
    for (const slotId of SLOT_ORDER) {
      if (slots[slotId] === "falta") {
        const subj = subjectAt(wd, slotId);
        if (subj && subj.id === subjectId) count++;
      }
    }
  }
  return count;
}

function meetingsText(s) {
  return (s.meetings || []).length
    ? s.meetings.map(m => `${WD_SHORT[m.weekday]} ${SLOT_BY_ID[m.slot]?.short || "?"}`).join(" · ")
    : "sem horário definido";
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(t._tid);
  t._tid = setTimeout(() => (t.hidden = true), 2200);
}
function esc(str = "") {
  return str.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard() {
  const sem = activeSem();
  $("#semesterBanner").textContent = `${sem.label} · ${sem.subjects.length} matéria(s)`;

  const grid = $("#dashboardGrid");
  grid.innerHTML = "";

  if (!sem.subjects.length) {
    grid.innerHTML = `<div class="empty-state"><div class="big">🕳️</div>
      Nenhuma matéria neste semestre.<br/>Toque no menu (⋮) → "+ Matéria".</div>`;
    return;
  }

  const sorted = [...sem.subjects].sort((a, b) =>
    (countAbsences(b.id) / maxFor(b)) - (countAbsences(a.id) / maxFor(a)));

  for (const s of sorted) {
    const used = countAbsences(s.id);
    const max = maxFor(s);
    const ratio = max ? used / max : 0;
    const remaining = max - used;

    let level = "safe";
    if (used >= max) level = "critical";
    else if (remaining <= 1) level = "danger";
    else if (ratio >= 0.5) level = "warn";

    const numColor = level === "safe" ? "var(--text)" : `var(--${level})`;

    let alertHtml = "";
    if (remaining === 1) alertHtml = `<div class="sc-alert a-danger">⚠️ Véspera do limite — só pode faltar mais 1</div>`;
    else if (remaining === 0) alertHtml = `<div class="sc-alert a-critical">🚫 Limite de faltas atingido</div>`;
    else if (remaining < 0) alertHtml = `<div class="sc-alert a-critical">🚫 Limite ultrapassado em ${-remaining}</div>`;

    const card = document.createElement("div");
    card.className = "subject-card";
    card.style.setProperty("--card-accent", s.color);
    card.innerHTML = `
      <div class="sc-top">
        <div>
          <div class="sc-name">${esc(s.name)}</div>
          <div class="sc-meta">${s.code ? esc(s.code) + " · " : ""}${meetingsText(s)}</div>
        </div>
        <div class="sc-count">
          <span class="label">Faltas</span>
          <b style="color:${numColor}">${used}</b><span class="max">/${max}</span>
        </div>
      </div>
      <div class="bar"><div class="bar-fill fill-${level}" style="width:${Math.min(100, ratio * 100)}%"></div></div>
      <div class="sc-foot">
        <span class="muted">${remaining > 0 ? `Pode faltar mais ${remaining}` : "Sem margem"}</span>
      </div>
      ${alertHtml}`;
    grid.appendChild(card);
  }
}

/* ============================================================
   CALENDÁRIO
   ============================================================ */
function initCalRef() {
  const sem = activeSem();
  const today = new Date();
  const start = parseDate(sem.start), end = parseDate(sem.end);
  let ref = (today >= start && today <= end) ? today : start;
  calRef = { year: ref.getFullYear(), month: ref.getMonth() };
}

function renderCalendar() {
  if (!calRef) initCalRef();
  const { year, month } = calRef;
  const sem = activeSem();
  const occ = semOcc(), marks = semMarks();

  const calLabel = new Date(year, month, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
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

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const dateStr = fmtDate(year, month, d);
    const wd = isoWeekday(dateObj);
    const inSem = dateObj >= semStart && dateObj <= semEnd;
    const slots = slotsForWeekday(wd);
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
      for (const { id, subj } of slots) {
        const seg = document.createElement("div");
        seg.className = "cal-slot";
        const st = occ[dateStr] && occ[dateStr][id];
        if (st === "falta") { seg.classList.add("s-falta"); seg.style.background = subj.color; }
        else if (st === "prof") seg.classList.add("s-prof");
        slotsWrap.appendChild(seg);
      }
      cell.appendChild(slotsWrap);
    }

    const num = document.createElement("div");
    num.className = "cal-day-num";
    num.textContent = d;
    cell.appendChild(num);

    if (inSem) {
      cell.classList.add("classday");
      cell.addEventListener("click", () => openDayModal(dateStr));
    }
    grid.appendChild(cell);
  }
}

function calShift(delta) {
  let m = calRef.month + delta, y = calRef.year;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  calRef = { year: y, month: m };
  renderCalendar();
}

/* ============================================================
   MODAL DE DIA
   ============================================================ */
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
    `${WEEKDAYS[wd]}, ${dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}`;

  const wrap = $("#daySlots");
  wrap.innerHTML = "";
  const mark = marks[dateStr];
  const slots = slotsForWeekday(wd);

  if (!slots.length) {
    wrap.innerHTML = `<p class="muted small">Sem aulas cadastradas neste dia. Você ainda pode marcá-lo como feriado/sem aula abaixo.</p>`;
  } else {
    let lastShift = null;
    for (const { id, subj } of slots) {
      const def = SLOT_BY_ID[id];
      if (def.shift !== lastShift) {
        const h = document.createElement("div");
        h.className = "slot-shift muted small";
        h.textContent = def.shift;
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
            <div class="slot-time">${def.label} · ${def.time}</div>
          </div>
        </div>
        <div class="slot-options">
          <button class="seg-btn ${cur === "presente" ? "active" : ""}" data-val="presente">Presente</button>
          <button class="seg-btn ${cur === "falta" ? "active" : ""}" data-val="falta">Falta</button>
          <button class="seg-btn ${cur === "prof" ? "active" : ""}" data-val="prof">Prof. faltou</button>
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
}

function saveDayModal() {
  const newDate = $("#dayDate").value;
  if (!newDate) return;
  const occ = semOcc(), marks = semMarks();

  const oldDate = dayModalState.date;
  if (newDate !== oldDate) { delete occ[oldDate]; delete marks[oldDate]; dayModalState.date = newDate; }
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

  saveData();
  closeModals();
  renderAll();
  toast("Salvo ✓");
}

function clearDay() {
  const date = $("#dayDate").value;
  delete semOcc()[date];
  delete semMarks()[date];
  saveData();
  buildDayModalBody(date); // atualiza o modal mostrando o dia zerado
  renderAll();
  toast("Dia limpo ✓");
}

/* ============================================================
   GERENCIAR
   ============================================================ */
function openManage() {
  $("#manageSemLabel").textContent = activeSem().label;
  renderSubjectList();
  renderSemesterList();
  renderSyncStatus();
  showModal("#manageModal");
}

function renderSubjectList() {
  const list = $("#subjectList");
  list.innerHTML = "";
  const subs = activeSem().subjects;
  if (!subs.length) { list.innerHTML = `<p class="muted small">Nenhuma matéria ainda.</p>`; return; }
  for (const s of subs) {
    const row = document.createElement("div");
    row.className = "subject-row";
    row.innerHTML = `
      <span class="sr-color" style="background:${s.color}"></span>
      <div class="sr-info">
        <div class="sr-name">${esc(s.name || "(sem nome)")}</div>
        <div class="sr-meta">${s.credits} créditos · máx ${maxFor(s)} · ${meetingsText(s)}</div>
      </div>
      <button class="icon-btn" aria-label="Editar">
        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
      </button>`;
    row.querySelector("button").onclick = () => openSubjectEditor(s.id);
    list.appendChild(row);
  }
}

function renderSemesterList() {
  const list = $("#semesterList");
  list.innerHTML = "";
  for (const [key, sem] of Object.entries(data.semesters)) {
    const row = document.createElement("div");
    row.className = "semester-row" + (key === data.activeSemester ? " active-sem" : "");
    row.innerHTML = `
      <div><div class="sr-name">${esc(sem.label)}</div>
        <div class="sr-meta muted small">${sem.subjects.length} matérias</div></div>
      <button class="btn btn-sm btn-ghost">${key === data.activeSemester ? "Ativo" : "Ativar"}</button>`;
    row.querySelector("button").onclick = () => {
      data.activeSemester = key; saveData();
      $("#semesterSelect").value = key;
      calRef = null; renderAll(); openManage();
    };
    list.appendChild(row);
  }
}

/* ---- Editor de matéria ---- */
let editingSubjectId = null;

function openSubjectEditor(id) {
  editingSubjectId = id;
  const s = id ? activeSem().subjects.find(x => x.id === id) : null;
  $("#subjectModalTitle").textContent = s ? "Editar matéria" : "Nova matéria";
  $("#subjCode").value = s?.code || "";
  $("#subjName").value = s?.name || "";
  $("#subjProf").value = s?.prof || "";
  $("#subjCredits").value = String(s?.credits || 4);
  $("#subjColor").value = s?.color || "#ff9e2c";
  $("#deleteSubjectBtn").style.display = s ? "" : "none";
  renderMeetingEditor(s?.meetings || []);
  showModal("#subjectModal");
}

function renderMeetingEditor(meetings) {
  const list = $("#meetingList");
  list.innerHTML = "";
  meetings.forEach(m => list.appendChild(meetingRow(m)));
}

function meetingRow(m) {
  const row = document.createElement("div");
  row.className = "meeting-row";
  const wdOpts = [1, 2, 3, 4, 5, 6].map(w =>
    `<option value="${w}" ${m.weekday === w ? "selected" : ""}>${WEEKDAYS[w]}</option>`).join("");
  const slotOpts = SLOT_DEFS.map(sd =>
    `<option value="${sd.id}" ${m.slot === sd.id ? "selected" : ""}>${sd.shift} · ${sd.time}</option>`).join("");
  row.innerHTML = `
    <select class="meet-wd">${wdOpts}</select>
    <select class="meet-slot">${slotOpts}</select>
    <button class="icon-btn del-meet" type="button" aria-label="Remover">
      <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-3h6l1 2h4v2H4V6h4l1-2Z"/></svg>
    </button>`;
  row.querySelector(".del-meet").onclick = () => row.remove();
  return row;
}

function collectMeetings() {
  return $$("#meetingList .meeting-row").map(r => ({
    weekday: Number($(".meet-wd", r).value),
    slot: $(".meet-slot", r).value,
  }));
}

function saveSubject() {
  const sem = activeSem();
  const payload = {
    code: $("#subjCode").value.trim(),
    name: $("#subjName").value.trim() || "(sem nome)",
    prof: $("#subjProf").value.trim(),
    credits: Number($("#subjCredits").value),
    color: $("#subjColor").value,
    meetings: collectMeetings(),
  };
  if (editingSubjectId) {
    Object.assign(sem.subjects.find(s => s.id === editingSubjectId), payload);
  } else {
    sem.subjects.push({ id: "s_" + Date.now().toString(36), ...payload });
  }
  saveData();
  closeModals(); renderAll(); openManage();
  toast("Matéria salva ✓");
}

function deleteSubject() {
  if (!editingSubjectId) return;
  if (!confirm("Excluir esta matéria? As faltas dela serão desconsideradas.")) return;
  const sem = activeSem();
  sem.subjects = sem.subjects.filter(s => s.id !== editingSubjectId);
  saveData();
  closeModals(); renderAll(); openManage();
}

/* ---- Novo semestre ---- */
function addSemester() {
  const key = prompt("Identificador do semestre (ex: 2027.1):");
  if (!key) return;
  if (data.semesters[key]) { alert("Esse semestre já existe."); return; }
  const label = prompt("Nome para exibir (ex: 5º Semestre):", key) || key;
  const start = prompt("Data de início (AAAA-MM-DD):", "2027-02-01") || "2027-02-01";
  const end = prompt("Data de fim (AAAA-MM-DD):", "2027-06-30") || "2027-06-30";
  data.semesters[key] = { label, start, end, subjects: [] };
  data.occ[key] = {}; data.marks[key] = {};
  data.activeSemester = key;
  saveData();
  buildSemesterSelect();
  calRef = null; renderAll(); openManage();
  toast("Semestre criado ✓");
}

/* ---- Backup ---- */
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `m87-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.semesters) throw new Error("arquivo inválido");
      if (!confirm("Importar substituirá TODOS os dados atuais. Continuar?")) return;
      data = migrate(imported);
      saveData();
      buildSemesterSelect();
      calRef = null; closeModals(); renderAll();
      toast("Dados importados ✓");
    } catch (e) { alert("Arquivo inválido: " + e.message); }
  };
  reader.readAsText(file);
}

/* ============================================================
   SINCRONIZAÇÃO (Firebase, opcional)
   ============================================================ */
function renderSyncStatus() {
  const cfg = window.M87Sync && M87Sync.getCfg();
  const el = $("#syncStatus");
  if (el) el.textContent = cfg ? `Ativada · código “${cfg.code}” · ${M87Sync.status()}` : "Desativada";
  const btn = $("#syncToggleBtn");
  if (btn) btn.textContent = cfg ? "Gerenciar" : "Ativar";
}

function openSyncModal() {
  const cfg = M87Sync.getCfg();
  $("#syncCode").value = cfg?.code || "";
  $("#syncConfig").value = cfg ? JSON.stringify(cfg.config, null, 2) : "";
  $("#syncDisconnectBtn").style.display = cfg ? "" : "none";
  $("#syncMsg").textContent = "";
  showModal("#syncModal");
}

function parseFirebaseConfig(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Cole o objeto firebaseConfig do console do Firebase.");
  return Function('"use strict";return (' + m[0] + ")")();
}

async function saveSync() {
  try {
    const code = $("#syncCode").value.trim();
    if (!code) throw new Error("Defina um código de sincronização.");
    const config = parseFirebaseConfig($("#syncConfig").value);
    if (!config.projectId) throw new Error("Configuração inválida (faltou projectId).");
    M87Sync.setCfg({ config, code });
    $("#syncMsg").textContent = "Conectando…";
    await M87Sync.connect({ config, code }, handleRemote,
      st => { $("#syncMsg").textContent = "Status: " + st; renderSyncStatus(); });
    renderSyncStatus();
    toast("Sincronização ativada ✓");
  } catch (e) {
    $("#syncMsg").textContent = "Erro: " + e.message;
  }
}

function disconnectSync() {
  M87Sync.disconnect();
  renderSyncStatus();
  closeModals();
  toast("Sincronização desativada");
}

/* recebe o documento remoto e decide se aplica (mais novo) ou reenvia (local mais novo) */
function handleRemote(remote) {
  if (!remote || !remote.payload) {            // nuvem vazia → envia o que já existe aqui
    data._updatedAt = data._updatedAt || Date.now();
    M87Sync.push(data);
    return;
  }
  const rUp = remote.updatedAt || 0, lUp = data._updatedAt || 0;
  if (rUp > lUp) applyRemote(remote);
  else if (rUp < lUp) M87Sync.push(data);
}

function applyRemote(remote) {
  try {
    const incoming = migrate(JSON.parse(remote.payload));
    incoming._updatedAt = remote.updatedAt;
    data = incoming;
    localStorage.setItem(STORE_KEY, JSON.stringify(data)); // grava sem reenviar
    if (!data.semesters[data.activeSemester]) data.activeSemester = Object.keys(data.semesters)[0];
    buildSemesterSelect();
    calRef = null;
    renderAll();
    toast("Sincronizado ⟳");
  } catch (e) { console.error("applyRemote", e); }
}

/* ============================================================
   MODAIS / NAV
   ============================================================ */
function showModal(sel) { $(sel).hidden = false; }
function closeModals() { $$(".modal-overlay").forEach(m => (m.hidden = true)); }

function buildSemesterSelect() {
  const sel = $("#semesterSelect");
  sel.innerHTML = "";
  for (const [key, sem] of Object.entries(data.semesters)) {
    const o = document.createElement("option");
    o.value = key; o.textContent = sem.label;
    sel.appendChild(o);
  }
  sel.value = data.activeSemester;
}

function switchView(view) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#view-${view}`).classList.add("active");
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "calendar") renderCalendar();
  if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
}

function renderAll() { renderDashboard(); renderCalendar(); }

/* ============================================================
   EVENTOS
   ============================================================ */
function bindEvents() {
  $("#semesterSelect").onchange = e => {
    data.activeSemester = e.target.value; saveData();
    calRef = null; renderAll();
  };
  $("#menuBtn").onclick = openManage;
  $$(".nav-btn").forEach(b => b.onclick = () => switchView(b.dataset.view));
  $("#calPrev").onclick = () => calShift(-1);
  $("#calNext").onclick = () => calShift(1);

  $("#fab").onclick = () => {
    const today = new Date();
    const sem = activeSem();
    let d = (today >= parseDate(sem.start) && today <= parseDate(sem.end)) ? today : parseDate(sem.start);
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

  $("#addSubjectBtn").onclick = () => openSubjectEditor(null);
  $("#subjectSaveBtn").onclick = saveSubject;
  $("#deleteSubjectBtn").onclick = deleteSubject;
  $("#addMeetingBtn").onclick = () => $("#meetingList").appendChild(meetingRow({ weekday: 1, slot: "n1" }));
  $("#addSemesterBtn").onclick = addSemester;

  $("#exportBtn").onclick = exportData;
  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = e => e.target.files[0] && importData(e.target.files[0]);

  $("#syncToggleBtn").onclick = openSyncModal;
  $("#syncSaveBtn").onclick = saveSync;
  $("#syncDisconnectBtn").onclick = disconnectSync;

  $$("[data-close-modal]").forEach(b => b.onclick = closeModals);
  $$(".modal-overlay").forEach(ov => ov.addEventListener("click", e => { if (e.target === ov) closeModals(); }));
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  buildSemesterSelect();
  bindEvents();
  renderAll();
  if (location.hash.slice(1) === "calendar") switchView("calendar");

  // reconecta a sincronização se já estiver configurada
  if (window.M87Sync && M87Sync.getCfg()) {
    M87Sync.connect(M87Sync.getCfg(), handleRemote, () => renderSyncStatus()).catch(() => {});
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}
init();
