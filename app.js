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
     marks: { "2026.1": { "YYYY-MM-DD": "holiday"|"noclass" } },
     notes: { "2026.1": { "YYYY-MM-DD": "texto da observação" } }
   }
   Slots (horários): manhã m1/m2, noite n1/n2.
   Cada slot com status "falta" = 1 falta. "prof" não conta.
   Limite: 4 créditos = 8 faltas · 2 créditos = 4 faltas.
   ============================================================ */

const STORE_KEY = "m87.data";
const APP_VERSION = "1.3";

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
    notes: { "2026.1": {}, "2026.2": {} },
  };
}

/* ---------- Estado ---------- */
let data = loadData();
let calRef = null;
let lastSwipe = 0;

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
  d.version = 2;
  return d;
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

/* ---------- Helpers ---------- */
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
      Nenhuma matéria neste semestre.<br/>Vá em Config → "+ Matéria".</div>`;
    $("#semesterSummary").innerHTML = "";
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
  renderSummary();
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

function renderSummary() {
  const sem = activeSem();
  const wrap = $("#semesterSummary");
  if (!sem.subjects.length) { wrap.innerHTML = ""; return; }

  let usedTotal = 0, maxTotal = 0;
  const rows = sem.subjects.map(s => {
    const used = countAbsences(s.id), max = maxFor(s);
    usedTotal += used; maxTotal += max;
    return { s, rest: remainingSessions(s) };
  });

  const list = rows.map(({ s, rest }) => `
    <div class="sum-item">
      <span class="sum-dot" style="background:${s.color}"></span>
      <span class="sum-name">${esc(s.name)}</span>
      <span class="sum-rest">${rest} aula${rest === 1 ? "" : "s"}</span>
    </div>`).join("");

  wrap.innerHTML = `
    <div class="summary-card">
      <div class="summary-head">
        <h3>Resumo do semestre</h3>
        <span class="muted small">${usedTotal}/${maxTotal} faltas no total</span>
      </div>
      <div class="sum-subtitle muted small">Aulas restantes por matéria</div>
      ${list}
    </div>`;
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
  const occ = semOcc(), marks = semMarks(), notes = semNotes();

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

    if (notes[dateStr]) cell.classList.add("has-note");

    if (inSem) {
      cell.classList.add("classday");
      cell.addEventListener("click", () => {
        if (Date.now() - lastSwipe < 400) return; // ignora toque logo após deslizar
        openDayModal(dateStr);
      });
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

  $("#dayNote").value = semNotes()[dateStr] || "";
}

function saveDayModal() {
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

  const noteVal = $("#dayNote").value.trim();
  if (noteVal) notes[date] = noteVal; else delete notes[date];

  saveData();
  closeModals();
  renderAll();
  toast("Salvo ✓");
  showBackupReminder();
}

function clearDay() {
  const date = $("#dayDate").value;
  delete semOcc()[date];
  delete semMarks()[date];
  delete semNotes()[date];
  saveData();
  buildDayModalBody(date); // atualiza o modal mostrando o dia zerado
  renderAll();
  toast("Dia limpo ✓");
  showBackupReminder();
}

/* ============================================================
   GERENCIAR
   ============================================================ */
function renderSettings() {
  $("#settingsSemLabel").textContent = "· " + activeSem().label;
  renderSubjectList();
  renderSemesterList();
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
      <div style="flex:1; min-width:0">
        <div class="sr-name">${esc(sem.label)}</div>
        <div class="sr-meta muted small">${sem.subjects.length} matérias</div>
      </div>
      <div class="sem-actions">
        <button class="btn btn-sm btn-ghost sem-activate">${key === data.activeSemester ? "Ativo" : "Ativar"}</button>
        <button class="icon-btn icon-btn-sm sem-edit" aria-label="Editar semestre">
          <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>
        </button>
        <button class="icon-btn icon-btn-sm sem-del" aria-label="Excluir semestre">
          <svg viewBox="0 0 24 24" width="17" height="17"><path fill="currentColor" d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Zm3-3h6l1 2h4v2H4V6h4l1-2Z"/></svg>
        </button>
      </div>`;
    row.querySelector(".sem-activate").onclick = () => {
      data.activeSemester = key; saveData();
      $("#semesterSelect").value = key;
      calRef = null; renderAll(); renderSettings();
    };
    row.querySelector(".sem-edit").onclick = () => editSemester(key);
    row.querySelector(".sem-del").onclick = () => deleteSemester(key);
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
  closeModals(); renderAll(); renderSettings();
  toast("Matéria salva ✓");
  showBackupReminder();
}

function deleteSubject() {
  if (!editingSubjectId) return;
  if (!confirm("Excluir esta matéria? As faltas dela serão desconsideradas.")) return;
  const sem = activeSem();
  sem.subjects = sem.subjects.filter(s => s.id !== editingSubjectId);
  saveData();
  closeModals(); renderAll(); renderSettings();
  showBackupReminder();
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
  data.occ[key] = {}; data.marks[key] = {}; data.notes[key] = {};
  data.activeSemester = key;
  saveData();
  buildSemesterSelect();
  calRef = null; renderAll(); renderSettings();
  toast("Semestre criado ✓");
  showBackupReminder();
}

function editSemester(key) {
  const sem = data.semesters[key];
  const label = prompt("Nome do semestre:", sem.label);
  if (label === null) return; // cancelou
  const start = prompt("Data de início (AAAA-MM-DD):", sem.start) || sem.start;
  const end = prompt("Data de fim (AAAA-MM-DD):", sem.end) || sem.end;
  sem.label = label.trim() || sem.label;
  sem.start = start;
  sem.end = end;
  saveData();
  buildSemesterSelect();
  calRef = null; renderAll(); renderSettings();
  toast("Semestre atualizado ✓");
  showBackupReminder();
}

function deleteSemester(key) {
  if (Object.keys(data.semesters).length <= 1) {
    alert("Não é possível excluir o único semestre. Crie outro antes de excluir este.");
    return;
  }
  const sem = data.semesters[key];
  if (!confirm(`Excluir o semestre "${sem.label}" e TODAS as faltas dele? Esta ação não pode ser desfeita.`)) return;
  delete data.semesters[key];
  delete data.occ[key];
  delete data.marks[key];
  delete data.notes[key];
  if (data.activeSemester === key) data.activeSemester = Object.keys(data.semesters)[0];
  saveData();
  buildSemesterSelect();
  calRef = null; renderAll(); renderSettings();
  toast("Semestre excluído");
  showBackupReminder();
}

/* ---- Backup ---- */
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "m87-backup.json"; // nome fixo: substitui o backup anterior em vez de acumular
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

function wipeAllData() {
  const ans = prompt("Isto vai APAGAR TODOS os dados e restaurar o padrão (não pode ser desfeito).\n\nDigite APAGAR para confirmar:");
  if (ans === null) return;
  if (ans.trim().toUpperCase() !== "APAGAR") { alert("Confirmação incorreta. Nada foi apagado."); return; }
  localStorage.removeItem(STORE_KEY);
  data = seedData();
  saveData();
  buildSemesterSelect();
  calRef = null;
  renderAll();
  renderSettings();
  toast("Dados apagados. Padrão restaurado.");
}

/* Pixel art (X = pixel aceso, espaço = vazio) */
const PIX_VIWCTOR = [   // Saturno: planeta + anel (10 linhas, mesma altura do robô)
  "     XXX     ",
  "    XXXXX    ",
  "   XXXXXXX   ",
  "   XXXXXXX   ",
  "XX XXXXXXX XX",
  "XX XXXXXXX XX",
  "   XXXXXXX   ",
  "   XXXXXXX   ",
  "    XXXXX    ",
  "     XXX     ",
];
const PIX_CLAUDE = [    // robô estilo Claude Code
  " XXXXXXXXXXXX ",
  " XXXXXXXXXXXX ",
  " XXX XXXX XXX ",
  " XXX XXXX XXX ",
  "XXXXXXXXXXXXXX",
  "XXXXXXXXXXXXXX",
  " XXXXXXXXXXXX ",
  " XXXXXXXXXXXX ",
  "  X X    X X  ",
  "  X X    X X  ",
];

function renderPixel(el, rows) {
  if (!el) return;
  el.style.gridTemplateColumns = `repeat(${rows[0].length}, 6px)`;
  el.innerHTML = "";
  for (const row of rows) for (const ch of row) {
    const s = document.createElement("span");
    if (ch !== " ") s.className = "on";
    el.appendChild(s);
  }
}

function openAbout() {
  $("#aboutVersion").textContent = "v" + APP_VERSION;
  renderPixel($("#pixViwctor"), PIX_VIWCTOR);
  renderPixel($("#pixClaude"), PIX_CLAUDE);
  showModal("#aboutModal");
}

/* ============================================================
   LEMBRETE DE BACKUP
   ============================================================ */
function showBackupReminder() {
  const el = $("#backupReminder");
  if (el) el.hidden = false;
}
function hideBackupReminder() {
  const el = $("#backupReminder");
  if (el) el.hidden = true;
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
  if (view === "settings") renderSettings();
  $("#fab").hidden = (view === "settings"); // FAB só faz sentido em Painel/Calendário
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
  $$(".nav-btn").forEach(b => b.onclick = () => switchView(b.dataset.view));
  $("#calPrev").onclick = () => calShift(-1);
  $("#calNext").onclick = () => calShift(1);

  // deslizar para trocar de mês no calendário
  let _sx = null, _sy = null;
  const cg = $("#calGrid");
  cg.addEventListener("touchstart", e => { _sx = e.changedTouches[0].clientX; _sy = e.changedTouches[0].clientY; }, { passive: true });
  cg.addEventListener("touchend", e => {
    if (_sx === null) return;
    const dx = e.changedTouches[0].clientX - _sx;
    const dy = e.changedTouches[0].clientY - _sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lastSwipe = Date.now();
      calShift(dx < 0 ? 1 : -1);
    }
    _sx = _sy = null;
  }, { passive: true });

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
  $("#wipeBtn").onclick = wipeAllData;
  $("#aboutBtn").onclick = openAbout;

  $("#brBackup").onclick = () => { hideBackupReminder(); exportData(); };
  $("#brDismiss").onclick = hideBackupReminder;

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
  const hv = location.hash.slice(1);
  if (hv === "calendar" || hv === "settings") switchView(hv);

  // animação de abertura
  setTimeout(() => {
    const sp = $("#splash");
    if (sp) { sp.classList.add("hide"); setTimeout(() => sp.remove(), 450); }
  }, 1100);

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}
init();
