// ============================================================
// מתכנן חופש גדול — Summer Camp Planner
// ============================================================

const CAMP_START = '2026-06-18';
const CAMP_END = '2026-08-26';
const STORAGE_KEY = 'summerCampPlanner_v1';

const HEBREW_MONTHS = {
  6: 'יוני 2026',
  7: 'יולי 2026',
  8: 'אוגוסט 2026',
};

const HEBREW_DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const DEFAULT_STATE = {
  counselors: [
    { id: 'c1', name: 'מדריך 1', gender: 'M', vacationDates: [] },
    { id: 'c2', name: 'מדריך 2', gender: 'M', vacationDates: [] },
    { id: 'c3', name: 'מדריכה 1', gender: 'F', vacationDates: [] },
    { id: 'c4', name: 'מדריכה 2', gender: 'F', vacationDates: [] },
  ],
  activities: [],
};

// ---------------- State ----------------
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    // Backfill missing fields
    parsed.counselors = parsed.counselors || DEFAULT_STATE.counselors;
    parsed.activities = parsed.activities || [];
    return parsed;
  } catch (e) {
    console.warn('Failed to load state, using defaults', e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  // Persist to localStorage only. Cloud sync is now per-entity (granular)
  // and is triggered explicitly by each mutation path.
  state.lastUpdate = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------- Date helpers ----------------
function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function formatHebrewDate(iso) {
  const d = parseISO(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function rangeISO(startISO, days) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addDays(startISO, i));
  return out;
}

function isInCamp(iso) {
  return iso >= CAMP_START && iso <= CAMP_END;
}

// ---------------- Conflict logic ----------------
// Returns array of conflict messages for given activity (no message → no conflict).
function detectConflicts(activity) {
  const days = rangeISO(activity.startDate, activity.days);
  const issues = [];

  // Check camp window
  const outOfRange = days.filter(d => !isInCamp(d));
  if (outOfRange.length) {
    issues.push(`התאריכים ${outOfRange.map(formatHebrewDate).join(', ')} מחוץ לטווח החופש הגדול`);
  }

  // Required counselors per activity type
  const required = requiredCounselorsForType(activity.type);
  // required is an array of counselor IDs that MUST be available
  for (const day of days) {
    if (!isInCamp(day)) continue;
    for (const c of state.counselors) {
      if (!required.has(c.id)) continue;
      if (c.vacationDates.includes(day)) {
        issues.push(`${c.name} בחופש ב-${formatHebrewDate(day)}`);
      }
    }
  }
  return issues;
}

function requiredCounselorsForType(type) {
  // Returns Set of counselor IDs required for activity type.
  const males = state.counselors.filter(c => c.gender === 'M').map(c => c.id);
  const females = state.counselors.filter(c => c.gender === 'F').map(c => c.id);
  switch (type) {
    case 'all':
    case 'split':
      return new Set(state.counselors.map(c => c.id));
    case 'boys':
      return new Set(males);
    case 'girls':
      return new Set(females);
    default:
      return new Set();
  }
}

function findFreeRange(days, type) {
  // Try each possible start date in camp range; return first free one.
  const required = requiredCounselorsForType(type);
  const start = parseISO(CAMP_START);
  const end = parseISO(CAMP_END);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const candidate = toISO(d);
    const range = rangeISO(candidate, days);
    if (!range.every(isInCamp)) break;
    const occupied = range.some(day =>
      state.counselors.some(c =>
        required.has(c.id) && c.vacationDates.includes(day)
      )
    );
    if (!occupied) return candidate;
  }
  return null;
}

// ---------------- Tabs ----------------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'vacations') renderVacationCalendar();
    if (btn.dataset.tab === 'calendar') renderSummerCalendar();
    if (btn.dataset.tab === 'activities') renderActivities();
  });
});

// ---------------- Counselors tab ----------------
function renderCounselors() {
  const list = document.getElementById('counselors-list');
  list.innerHTML = '';
  state.counselors.forEach((c, idx) => {
    const row = document.createElement('div');
    row.className = `counselor-row ${c.gender === 'M' ? 'male' : 'female'}`;
    row.innerHTML = `
      <div class="badge">${c.gender === 'M' ? '👦 מדריך' : '👧 מדריכה'}</div>
      <label>שם:
        <input type="text" data-idx="${idx}" data-field="name" value="${escapeHTML(c.name)}">
      </label>
      <label>מגדר:
        <select data-idx="${idx}" data-field="gender">
          <option value="M" ${c.gender === 'M' ? 'selected' : ''}>זכר</option>
          <option value="F" ${c.gender === 'F' ? 'selected' : ''}>נקבה</option>
        </select>
      </label>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', e => {
      const idx = +e.target.dataset.idx;
      const field = e.target.dataset.field;
      state.counselors[idx][field] = e.target.value;
      saveState();
      cloudWriteCounselor(state.counselors[idx]);
      renderCounselors();
      populateCounselorSelect();
    });
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------------- Vacations tab ----------------
function populateCounselorSelect() {
  const sel = document.getElementById('vacation-counselor-select');
  const prev = sel.value;
  sel.innerHTML = state.counselors
    .map(c => `<option value="${c.id}">${escapeHTML(c.name)} (${c.gender === 'M' ? 'מדריך' : 'מדריכה'})</option>`)
    .join('');
  if (prev && state.counselors.find(c => c.id === prev)) sel.value = prev;
}

document.getElementById('vacation-counselor-select').addEventListener('change', renderVacationCalendar);

function renderVacationCalendar() {
  const container = document.getElementById('vacation-calendar');
  const selectedId = document.getElementById('vacation-counselor-select').value;
  const counselor = state.counselors.find(c => c.id === selectedId);
  if (!counselor) {
    container.innerHTML = '<div class="empty-state">בחר מדריך</div>';
    return;
  }
  container.innerHTML = '';
  const months = monthsBetween(CAMP_START, CAMP_END);
  months.forEach(({ year, month }) => {
    container.appendChild(buildMonth(year, month, (iso, dayEl) => {
      if (!isInCamp(iso)) return;
      const isVac = counselor.vacationDates.includes(iso);
      if (isVac) {
        counselor.vacationDates = counselor.vacationDates.filter(d => d !== iso);
        cloudRemoveVacation(counselor.id, iso);
      } else {
        counselor.vacationDates.push(iso);
        counselor.vacationDates.sort();
        cloudAddVacation(counselor.id, iso);
      }
      saveState();
      renderVacationCalendar();
    }, iso => {
      if (counselor.vacationDates.includes(iso)) return { className: 'unavailable' };
      return null;
    }));
  });
}

function monthsBetween(startISO, endISO) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  const out = [];
  let y = s.getFullYear();
  let m = s.getMonth();
  while (y < e.getFullYear() || (y === e.getFullYear() && m <= e.getMonth())) {
    out.push({ year: y, month: m + 1 });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

function buildMonth(year, month, onClick, decorate) {
  const wrap = document.createElement('div');
  wrap.className = 'month';
  const header = document.createElement('div');
  header.className = 'month-header';
  header.textContent = HEBREW_MONTHS[month] || `${month}/${year}`;
  wrap.appendChild(header);

  const weekdays = document.createElement('div');
  weekdays.className = 'weekdays';
  HEBREW_DAYS.forEach(d => {
    const w = document.createElement('div');
    w.textContent = d;
    weekdays.appendChild(w);
  });
  wrap.appendChild(weekdays);

  const days = document.createElement('div');
  days.className = 'days';

  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay(); // Sunday = 0
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'day empty';
    days.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISO(new Date(year, month - 1, d));
    const cell = document.createElement('div');
    cell.className = 'day';
    if (!isInCamp(iso)) cell.classList.add('outside');

    const num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = d;
    cell.appendChild(num);

    if (decorate) {
      const deco = decorate(iso);
      if (deco) {
        if (deco.className) cell.classList.add(...deco.className.split(' '));
        if (deco.content) {
          const c = document.createElement('div');
          c.innerHTML = deco.content;
          cell.appendChild(c);
        }
      }
    }

    if (isInCamp(iso) && onClick) {
      cell.addEventListener('click', () => onClick(iso, cell));
    }
    days.appendChild(cell);
  }

  wrap.appendChild(days);
  return wrap;
}

// ---------------- Activities tab ----------------
const activityForm = document.getElementById('activity-form');

activityForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = document.getElementById('activity-id').value;
  const activity = {
    id: id || 'a_' + Math.random().toString(36).slice(2, 9),
    name: document.getElementById('activity-name').value.trim(),
    startDate: document.getElementById('activity-date').value,
    days: parseInt(document.getElementById('activity-days').value, 10),
    type: document.getElementById('activity-type').value,
    notes: document.getElementById('activity-notes').value.trim(),
  };

  if (id) {
    const idx = state.activities.findIndex(a => a.id === id);
    state.activities[idx] = activity;
  } else {
    state.activities.push(activity);
  }
  state.activities.sort((a, b) => a.startDate.localeCompare(b.startDate));
  saveState();
  cloudWriteActivity(activity);
  resetActivityForm();
  renderActivities();
});

document.getElementById('activity-cancel').addEventListener('click', resetActivityForm);

document.getElementById('activity-suggest').addEventListener('click', () => {
  const days = parseInt(document.getElementById('activity-days').value, 10) || 1;
  const type = document.getElementById('activity-type').value;
  const free = findFreeRange(days, type);
  const warningEl = document.getElementById('activity-warning');
  if (free) {
    document.getElementById('activity-date').value = free;
    warningEl.innerHTML = `<div class="warning-box info">💡 הצעה: התחל ב-${formatHebrewDate(free)} (${days} ${days === 1 ? 'יום' : 'ימים'})</div>`;
  } else {
    warningEl.innerHTML = `<div class="warning-box danger">לא נמצא חלון פנוי של ${days} ימים בקיץ עבור סוג הפעילות הזה.</div>`;
  }
});

// live conflict feedback while typing
['activity-date', 'activity-days', 'activity-type'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateLiveConflict);
});

function updateLiveConflict() {
  const date = document.getElementById('activity-date').value;
  const days = parseInt(document.getElementById('activity-days').value, 10);
  const type = document.getElementById('activity-type').value;
  const warningEl = document.getElementById('activity-warning');
  if (!date || !days) { warningEl.innerHTML = ''; return; }
  const issues = detectConflicts({ startDate: date, days, type });
  if (issues.length === 0) {
    warningEl.innerHTML = `<div class="warning-box success">✅ כל המדריכים הנדרשים פנויים בתאריכים האלה</div>`;
  } else {
    warningEl.innerHTML = `<div class="warning-box danger">⚠️ קונפליקטים:<ul>${issues.map(i => `<li>${escapeHTML(i)}</li>`).join('')}</ul></div>`;
  }
}

function resetActivityForm() {
  document.getElementById('activity-id').value = '';
  activityForm.reset();
  document.getElementById('activity-cancel').hidden = true;
  document.getElementById('activity-warning').innerHTML = '';
}

function editActivity(id) {
  const a = state.activities.find(x => x.id === id);
  if (!a) return;
  document.getElementById('activity-id').value = a.id;
  document.getElementById('activity-name').value = a.name;
  document.getElementById('activity-date').value = a.startDate;
  document.getElementById('activity-days').value = a.days;
  document.getElementById('activity-type').value = a.type;
  document.getElementById('activity-notes').value = a.notes || '';
  document.getElementById('activity-cancel').hidden = false;
  updateLiveConflict();
  document.getElementById('activity-form').scrollIntoView({ behavior: 'smooth' });
}

function deleteActivity(id) {
  if (!confirm('למחוק את הפעילות?')) return;
  state.activities = state.activities.filter(a => a.id !== id);
  saveState();
  cloudDeleteActivity(id);
  renderActivities();
}

function renderActivities() {
  const list = document.getElementById('activities-list');
  if (state.activities.length === 0) {
    list.innerHTML = '<div class="empty-state">עוד לא הוזנו פעילויות. הוסף פעילות ראשונה למעלה.</div>';
    return;
  }
  list.innerHTML = '';
  state.activities.forEach(a => {
    const issues = detectConflicts(a);
    const item = document.createElement('div');
    item.className = 'activity-item' + (issues.length ? ' conflict' : '');
    const typeLabels = { all: 'כל המחנה', split: 'מפוצל', boys: 'בנים בלבד', girls: 'בנות בלבד' };
    const endDate = addDays(a.startDate, a.days - 1);
    item.innerHTML = `
      <div>
        <div class="activity-title">${escapeHTML(a.name)}
          <span class="activity-tag ${a.type}">${typeLabels[a.type]}</span>
        </div>
        <div class="activity-meta">
          📅 ${formatHebrewDate(a.startDate)}${a.days > 1 ? ' עד ' + formatHebrewDate(endDate) : ''}
          · ${a.days} ${a.days === 1 ? 'יום' : 'ימים'}
        </div>
        ${a.notes ? `<div class="activity-meta">📝 ${escapeHTML(a.notes)}</div>` : ''}
        ${issues.length ? `<div class="activity-conflict-msg">⚠️ ${issues.join(' • ')}</div>` : ''}
      </div>
      <div class="activity-actions">
        <button onclick="editActivity('${a.id}')">✏️ עריכה</button>
        <button class="delete" onclick="deleteActivity('${a.id}')">🗑️ מחק</button>
      </div>
    `;
    list.appendChild(item);
  });
}

// expose for inline handlers
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;

// ---------------- Summer calendar (overview) ----------------
function renderSummerCalendar() {
  const container = document.getElementById('summer-calendar');
  container.innerHTML = '';
  const months = monthsBetween(CAMP_START, CAMP_END);

  // Build per-day map
  const dayMap = {}; // iso -> {unavailableCounselors:[], activities:[], conflicts:[]}
  state.counselors.forEach(c => {
    c.vacationDates.forEach(d => {
      dayMap[d] = dayMap[d] || { unavailable: [], activities: [], conflicts: [] };
      dayMap[d].unavailable.push(c);
    });
  });
  state.activities.forEach(a => {
    const range = rangeISO(a.startDate, a.days);
    const issues = detectConflicts(a);
    range.forEach(d => {
      dayMap[d] = dayMap[d] || { unavailable: [], activities: [], conflicts: [] };
      dayMap[d].activities.push(a);
      if (issues.length) dayMap[d].conflicts.push(a);
    });
  });

  months.forEach(({ year, month }) => {
    container.appendChild(buildMonth(year, month, null, iso => {
      if (!isInCamp(iso)) return null;
      const info = dayMap[iso];
      let className = '';
      let content = '';
      if (info?.conflicts?.length) {
        className = 'has-conflict';
        content = `<div class="day-activity">${escapeHTML(info.activities[0].name)}</div><div class="day-conflict">⚠️ קונפליקט</div>`;
      } else if (info?.activities?.length) {
        className = 'has-activity';
        content = `<div class="day-activity">${escapeHTML(info.activities[0].name)}</div>`;
      } else if (info?.unavailable?.length) {
        className = 'unavailable';
        const dots = info.unavailable.map(c =>
          `<div class="day-mini-dot" title="${escapeHTML(c.name)}" style="background:${c.gender === 'M' ? '#1e40af' : '#9d174d'}"></div>`
        ).join('');
        content = `<div class="day-dots">${dots}</div>`;
      }
      return { className, content };
    }));
  });

  renderStats(dayMap);
}

function renderStats(dayMap) {
  const totalDays = countCampDays();
  let freeDays = 0, activityDays = 0, unavailDays = 0, conflictDays = 0;
  for (let d = parseISO(CAMP_START); d <= parseISO(CAMP_END); d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);
    const info = dayMap[iso];
    if (!info) { freeDays++; continue; }
    if (info.conflicts.length) conflictDays++;
    else if (info.activities.length) activityDays++;
    else if (info.unavailable.length) unavailDays++;
    else freeDays++;
  }
  document.getElementById('summary-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${totalDays}</div><div class="stat-label">סה״כ ימי קיץ</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#16a34a">${activityDays}</div><div class="stat-label">ימי פעילות</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#f59e0b">${unavailDays}</div><div class="stat-label">ימים שמישהו בחופש</div></div>
    <div class="stat-card"><div class="stat-value" style="color:#dc2626">${conflictDays}</div><div class="stat-label">ימי קונפליקט</div></div>
    <div class="stat-card"><div class="stat-value">${freeDays}</div><div class="stat-label">ימים פנויים לחלוטין</div></div>
  `;
}

function countCampDays() {
  let n = 0;
  for (let d = parseISO(CAMP_START); d <= parseISO(CAMP_END); d.setDate(d.getDate() + 1)) n++;
  return n;
}

// ---------------- Export / Import ----------------
document.getElementById('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `summer-camp-plan-${toISO(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

document.getElementById('import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.counselors || !data.activities) throw new Error('bad format');
      if (!confirm('להחליף את כל הנתונים הקיימים בנתונים מהקובץ?')) return;
      state = data;
      saveState();
      cloudBulkReplace();
      initRender();
      alert('הנתונים יובאו בהצלחה');
    } catch (err) {
      alert('שגיאה בייבוא הקובץ: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// ---------------- Initial render ----------------
function initRender() {
  renderCounselors();
  populateCounselorSelect();
  renderVacationCalendar();
  renderActivities();
}

initRender();

// ---------------- Schedule Board ----------------
const ACTIVITY_COLORS = [
  { bg:'#ede9fe', text:'#5b21b6', dot:'#7c3aed' },
  { bg:'#cffafe', text:'#0e7490', dot:'#06b6d4' },
  { bg:'#dcfce7', text:'#15803d', dot:'#16a34a' },
  { bg:'#fef9c3', text:'#854d0e', dot:'#ca8a04' },
  { bg:'#fee2e2', text:'#991b1b', dot:'#dc2626' },
  { bg:'#fce7f3', text:'#9d174d', dot:'#ec4899' },
  { bg:'#dbeafe', text:'#1e40af', dot:'#3b82f6' },
  { bg:'#d1fae5', text:'#065f46', dot:'#059669' },
];

const TYPE_CLASS = { all:'act-all', split:'act-split', boys:'act-boys', girls:'act-girls' };
const TYPE_LABEL = { all:'כל המחנה', split:'מפוצל', boys:'בנים בלבד', girls:'בנות בלבד' };
const COUNSELOR_COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f97316'];

document.getElementById('btn-update-board').addEventListener('click', () => {
  renderBoard();
  document.getElementById('board-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
});

document.getElementById('btn-close-board').addEventListener('click', closeBoard);
document.getElementById('board-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBoard();
});
document.getElementById('btn-print-board').addEventListener('click', () => window.print());

function closeBoard() {
  document.getElementById('board-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function renderBoard() {
  const el = document.getElementById('board-content');

  // Build activity color map (stable per activity id)
  const actColorMap = {};
  state.activities.forEach((a, i) => {
    actColorMap[a.id] = ACTIVITY_COLORS[i % ACTIVITY_COLORS.length];
  });

  // Build day-info map
  const dayInfo = {}; // iso → { activities: [...], unavailable: [...], conflicts: [...] }
  state.activities.forEach(a => {
    const issues = detectConflicts(a);
    rangeISO(a.startDate, a.days).forEach(d => {
      if (!dayInfo[d]) dayInfo[d] = { activities: [], unavailable: [], conflicts: [] };
      dayInfo[d].activities.push(a);
      if (issues.length) dayInfo[d].conflicts.push(a);
    });
  });
  state.counselors.forEach((c, ci) => {
    c.vacationDates.forEach(d => {
      if (!dayInfo[d]) dayInfo[d] = { activities: [], unavailable: [], conflicts: [] };
      dayInfo[d].unavailable.push({ ...c, colorIndex: ci });
    });
  });

  // Count stats
  let totalAct = 0, totalConflict = 0, freeDays = 0;
  for (let d = parseISO(CAMP_START); d <= parseISO(CAMP_END); d.setDate(d.getDate() + 1)) {
    const info = dayInfo[toISO(d)];
    if (!info || (!info.activities.length && !info.unavailable.length)) freeDays++;
    if (info?.activities.length) totalAct++;
    if (info?.conflicts.length) totalConflict++;
  }

  const now = new Date();
  const generatedStr = `${now.getDate()}.${now.getMonth()+1}.${now.getFullYear()}`;

  // HTML
  let html = `
    <div class="board-header">
      <div class="board-title">🌞 לוח חופש גדול</div>
      <div class="board-subtitle">${formatHebrewDate(CAMP_START)} — ${formatHebrewDate(CAMP_END)} &nbsp;·&nbsp; ${countCampDays()} ימים</div>
      <div class="board-counselors">
        ${state.counselors.map((c,i) => `
          <div class="board-counselor-chip ${c.gender}">
            ${c.gender==='M'?'👦':'👧'} ${escapeHTML(c.name)}
            ${c.vacationDates.length ? `<span style="font-weight:400;font-size:12px;opacity:0.7">(${c.vacationDates.length} ימי חופשה)</span>` : ''}
          </div>`).join('')}
      </div>
      <div style="margin-top:12px;font-size:13px;color:#94a3b8">הופק ב-${generatedStr}</div>
    </div>
  `;

  // Month sections
  const months = monthsBetween(CAMP_START, CAMP_END);
  months.forEach(({ year, month }) => {
    html += `<div class="board-month-section">`;
    html += `<div class="board-month-title">${HEBREW_MONTHS[month] || `${month}/${year}`}</div>`;
    html += buildBoardMonthTable(year, month, dayInfo, actColorMap);
    html += `</div>`;
  });

  // Activity index
  if (state.activities.length) {
    html += `<div class="board-index">`;
    html += `<div class="board-index-title">📋 רשימת פעילויות</div>`;
    html += `<div class="board-index-grid">`;
    state.activities.forEach(a => {
      const col = actColorMap[a.id];
      const issues = detectConflicts(a);
      const endDate = addDays(a.startDate, a.days - 1);
      html += `
        <div class="board-index-item">
          <div class="board-index-dot" style="background:${col.dot}"></div>
          <div class="board-index-info">
            <div class="board-index-name">${escapeHTML(a.name)}</div>
            <div class="board-index-meta">
              ${formatHebrewDate(a.startDate)}${a.days>1?' – '+formatHebrewDate(endDate):''} · ${a.days} ${a.days===1?'יום':'ימים'}
              <br>${TYPE_LABEL[a.type]}
              ${a.notes ? `<br>📝 ${escapeHTML(a.notes)}` : ''}
            </div>
            ${issues.length ? `<div class="board-index-conflict">⚠️ ${issues[0]}${issues.length>1?` +${issues.length-1} נוספים`:''}</div>` : ''}
          </div>
        </div>`;
    });
    html += `</div></div>`;
  }

  html += `<div class="board-footer-note">
    ${totalAct} ימי פעילות · ${freeDays} ימים פנויים
    ${totalConflict ? ` · <span style="color:#dc2626">⚠️ ${totalConflict} ימי קונפליקט</span>` : ' · ✅ ללא קונפליקטים'}
  </div>`;

  el.innerHTML = html;
}

function buildBoardMonthTable(year, month, dayInfo, actColorMap) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // Sun=0

  let table = `<table class="board-cal">
    <thead><tr>
      ${HEBREW_DAYS.map(d => `<th>${d}</th>`).join('')}
    </tr></thead><tbody>`;

  let day = 1 - firstWeekday; // may go negative (days before month start)
  while (day <= daysInMonth) {
    table += '<tr>';
    for (let col = 0; col < 7; col++, day++) {
      if (day < 1 || day > daysInMonth) {
        table += '<td class="outside"></td>';
        continue;
      }
      const iso = toISO(new Date(year, month - 1, day));
      const inCamp = isInCamp(iso);
      table += `<td${!inCamp ? ' class="outside"' : ''}>`;

      if (inCamp) {
        const info = dayInfo[iso] || { activities: [], unavailable: [], conflicts: [] };
        const hasConflict = info.conflicts.length > 0;

        table += `<div class="bd-date">${day}</div>`;
        if (hasConflict) table += `<div class="bd-conflict-flag">⚠️</div>`;

        // Show all activities for this day
        info.activities.forEach(a => {
          const col = actColorMap[a.id];
          const isStart = a.startDate === iso;
          const typeClass = TYPE_CLASS[a.type];
          const contClass = isStart ? '' : ' act-cont';
          const label = isStart ? escapeHTML(a.name) : '↩ ' + escapeHTML(a.name);
          table += `<div class="bd-activity-bar ${typeClass}${contClass}" style="background:${col.bg};color:${col.text};border-right-color:${col.dot}" title="${escapeHTML(a.name)}">${label}</div>`;
        });

        // Unavailable counselor dots
        if (info.unavailable.length) {
          table += '<div class="bd-dots">';
          info.unavailable.forEach(c => {
            table += `<div class="bd-dot" style="background:${COUNSELOR_COLORS[state.counselors.findIndex(x=>x.id===c.id)%COUNSELOR_COLORS.length]}" title="${escapeHTML(c.name)} — בחופשה"></div>`;
          });
          table += '</div>';
        }
      } else {
        table += `<div class="bd-date" style="color:#cbd5e1">${day}</div>`;
      }

      table += '</td>';
    }
    table += '</tr>';
  }

  table += '</tbody></table>';
  return table;
}

// ---------------- Cloud Sync (Firebase Firestore) ----------------
const CLOUD_CFG_KEY = 'summerCampPlanner_cloudConfig_v1';
const CLOUD_GROUP_KEY = 'summerCampPlanner_groupCode_v1';

// Built-in Firebase project (created by Ariel). All 4 counselors share the
// same Firestore project and the same group code, so opening the URL is
// enough — no manual setup needed.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAqQE7B8v2J5M8Sv2VcN-sI6aWdpPP9wVE",
  authDomain: "summer-camp-8aabd.firebaseapp.com",
  projectId: "summer-camp-8aabd",
  storageBucket: "summer-camp-8aabd.firebasestorage.app",
  messagingSenderId: "77485499740",
  appId: "1:77485499740:web:52b13f0275363fe9b48d99",
};
const DEFAULT_GROUP_CODE = 'main';

let cloudState = {
  active: false,
  db: null,
  groupCode: null,
  unsubCounselors: null,
  unsubActivities: null,
  applyingRemote: false,
  fns: null,
  counselorWriteTimers: {},
};

function setCloudIndicator(status, label) {
  const dot = document.getElementById('cloud-dot');
  const labelEl = document.getElementById('cloud-label');
  if (!dot) return;
  dot.className = 'cloud-dot ' + status;
  if (label) labelEl.textContent = label;
}

async function initCloud() {
  const cfgRaw = localStorage.getItem(CLOUD_CFG_KEY);
  const groupCode = localStorage.getItem(CLOUD_GROUP_KEY) || DEFAULT_GROUP_CODE;
  try {
    const cfg = cfgRaw ? JSON.parse(cfgRaw) : DEFAULT_FIREBASE_CONFIG;
    setCloudIndicator('syncing', 'מתחבר...');
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
    const firestoreMod = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    const {
      getFirestore, doc, setDoc, deleteDoc, updateDoc,
      arrayUnion, arrayRemove, collection, onSnapshot, getDocs, writeBatch,
    } = firestoreMod;

    const app = initializeApp(cfg);
    const db = getFirestore(app);
    cloudState.db = db;
    cloudState.groupCode = groupCode;
    cloudState.fns = { doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, collection, onSnapshot, getDocs, writeBatch };
    cloudState.active = true;

    const counselorsCol = collection(db, 'camps', groupCode, 'counselors');
    const activitiesCol = collection(db, 'camps', groupCode, 'activities');

    // Seed counselors if empty (first-ever connection for this group)
    const seedSnap = await getDocs(counselorsCol);
    if (seedSnap.empty) {
      const batch = writeBatch(db);
      const seed = state.counselors.length === 4 ? state.counselors : DEFAULT_STATE.counselors;
      seed.forEach(c => {
        batch.set(doc(db, 'camps', groupCode, 'counselors', c.id), {
          id: c.id, name: c.name, gender: c.gender,
          vacationDates: c.vacationDates || [],
        });
      });
      // Also seed any local activities
      state.activities.forEach(a => {
        batch.set(doc(db, 'camps', groupCode, 'activities', a.id), a);
      });
      await batch.commit();
    }

    // Counselors live listener
    cloudState.unsubCounselors = onSnapshot(counselorsCol, snap => {
      cloudState.applyingRemote = true;
      const remote = [];
      snap.forEach(d => remote.push(d.data()));
      remote.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
      if (remote.length) {
        state.counselors = remote.map(c => ({
          id: c.id,
          name: c.name || '',
          gender: c.gender || 'M',
          vacationDates: Array.isArray(c.vacationDates) ? c.vacationDates.slice().sort() : [],
        }));
        saveState();
        renderCounselors();
        populateCounselorSelect();
        renderVacationCalendar();
        renderActivities();
        if (document.querySelector('#tab-calendar.active')) renderSummerCalendar();
      }
      cloudState.applyingRemote = false;
      setCloudIndicator('on', 'מסונכרן');
    }, err => {
      console.error('cloud counselors onSnapshot error', err);
      setCloudIndicator('error', 'שגיאה');
    });

    // Activities live listener
    cloudState.unsubActivities = onSnapshot(activitiesCol, snap => {
      cloudState.applyingRemote = true;
      const remote = [];
      snap.forEach(d => remote.push(d.data()));
      remote.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      state.activities = remote;
      saveState();
      renderActivities();
      if (document.querySelector('#tab-calendar.active')) renderSummerCalendar();
      cloudState.applyingRemote = false;
      setCloudIndicator('on', 'מסונכרן');
    }, err => {
      console.error('cloud activities onSnapshot error', err);
      setCloudIndicator('error', 'שגיאה');
    });

    setCloudIndicator('on', 'מסונכרן');
  } catch (err) {
    console.error('initCloud error', err);
    setCloudIndicator('error', 'שגיאה');
  }
}

// ---- Granular cloud writers ----
function cloudWriteCounselor(c) {
  if (!cloudState.active || cloudState.applyingRemote) return;
  // Debounce per counselor to coalesce rapid name keystrokes
  clearTimeout(cloudState.counselorWriteTimers[c.id]);
  cloudState.counselorWriteTimers[c.id] = setTimeout(async () => {
    try {
      setCloudIndicator('syncing', 'שומר...');
      const { doc, setDoc } = cloudState.fns;
      await setDoc(doc(cloudState.db, 'camps', cloudState.groupCode, 'counselors', c.id), {
        id: c.id, name: c.name, gender: c.gender,
        vacationDates: c.vacationDates || [],
      });
      setCloudIndicator('on', 'מסונכרן');
    } catch (e) {
      console.error('cloudWriteCounselor', e);
      setCloudIndicator('error', 'שגיאה');
    }
  }, 300);
}

async function cloudAddVacation(counselorId, date) {
  if (!cloudState.active || cloudState.applyingRemote) return;
  try {
    setCloudIndicator('syncing', 'שומר...');
    const { doc, updateDoc, arrayUnion } = cloudState.fns;
    await updateDoc(doc(cloudState.db, 'camps', cloudState.groupCode, 'counselors', counselorId), {
      vacationDates: arrayUnion(date),
    });
    setCloudIndicator('on', 'מסונכרן');
  } catch (e) {
    console.error('cloudAddVacation', e);
    setCloudIndicator('error', 'שגיאה');
  }
}

async function cloudRemoveVacation(counselorId, date) {
  if (!cloudState.active || cloudState.applyingRemote) return;
  try {
    setCloudIndicator('syncing', 'שומר...');
    const { doc, updateDoc, arrayRemove } = cloudState.fns;
    await updateDoc(doc(cloudState.db, 'camps', cloudState.groupCode, 'counselors', counselorId), {
      vacationDates: arrayRemove(date),
    });
    setCloudIndicator('on', 'מסונכרן');
  } catch (e) {
    console.error('cloudRemoveVacation', e);
    setCloudIndicator('error', 'שגיאה');
  }
}

async function cloudWriteActivity(a) {
  if (!cloudState.active || cloudState.applyingRemote) return;
  try {
    setCloudIndicator('syncing', 'שומר...');
    const { doc, setDoc } = cloudState.fns;
    await setDoc(doc(cloudState.db, 'camps', cloudState.groupCode, 'activities', a.id), a);
    setCloudIndicator('on', 'מסונכרן');
  } catch (e) {
    console.error('cloudWriteActivity', e);
    setCloudIndicator('error', 'שגיאה');
  }
}

async function cloudDeleteActivity(id) {
  if (!cloudState.active || cloudState.applyingRemote) return;
  try {
    setCloudIndicator('syncing', 'שומר...');
    const { doc, deleteDoc } = cloudState.fns;
    await deleteDoc(doc(cloudState.db, 'camps', cloudState.groupCode, 'activities', id));
    setCloudIndicator('on', 'מסונכרן');
  } catch (e) {
    console.error('cloudDeleteActivity', e);
    setCloudIndicator('error', 'שגיאה');
  }
}

async function cloudBulkReplace() {
  if (!cloudState.active) return;
  try {
    setCloudIndicator('syncing', 'שומר...');
    const { doc, setDoc, deleteDoc, collection, getDocs, writeBatch } = cloudState.fns;
    const db = cloudState.db;
    const group = cloudState.groupCode;
    // Delete all existing activities, then write new
    const existing = await getDocs(collection(db, 'camps', group, 'activities'));
    const batch = writeBatch(db);
    existing.forEach(d => batch.delete(d.ref));
    state.activities.forEach(a => batch.set(doc(db, 'camps', group, 'activities', a.id), a));
    state.counselors.forEach(c => batch.set(doc(db, 'camps', group, 'counselors', c.id), {
      id: c.id, name: c.name, gender: c.gender, vacationDates: c.vacationDates || [],
    }));
    await batch.commit();
    setCloudIndicator('on', 'מסונכרן');
  } catch (e) {
    console.error('cloudBulkReplace', e);
    setCloudIndicator('error', 'שגיאה');
  }
}

function disconnectCloud() {
  if (cloudState.unsubCounselors) cloudState.unsubCounselors();
  if (cloudState.unsubActivities) cloudState.unsubActivities();
  cloudState = {
    active: false, db: null, groupCode: null,
    unsubCounselors: null, unsubActivities: null,
    applyingRemote: false, fns: null, counselorWriteTimers: {},
  };
  localStorage.removeItem(CLOUD_CFG_KEY);
  localStorage.removeItem(CLOUD_GROUP_KEY);
  setCloudIndicator('off', 'סנכרון');
}

// ---- Cloud UI ----
document.getElementById('btn-cloud').addEventListener('click', () => {
  showCloudModal();
});
document.getElementById('btn-close-cloud').addEventListener('click', () => closeCloudModal());
document.getElementById('cloud-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeCloudModal();
});

function showCloudModal() {
  const overlay = document.getElementById('cloud-overlay');
  const connectedView = document.getElementById('cloud-connected-view');
  const setupView = document.getElementById('cloud-setup-view');
  const statusEl = document.getElementById('cloud-status-display');

  if (cloudState.active) {
    connectedView.hidden = false;
    setupView.hidden = true;
    document.getElementById('cloud-group-display').value = cloudState.groupCode;
    statusEl.className = 'warning-box success';
    statusEl.innerHTML = '✅ מחובר לענן — שינויים מסתנכרנים אוטומטית עם כל מי שמזין את אותו קוד קבוצה.';
  } else {
    connectedView.hidden = true;
    setupView.hidden = false;
    statusEl.className = 'warning-box info';
    statusEl.innerHTML = '💡 סנכרון בענן מאפשר ל-4 המדריכים לראות את אותם נתונים מכל מכשיר. הגדרה חד-פעמית.';
    // Pre-fill with previous values
    const cfg = localStorage.getItem(CLOUD_CFG_KEY);
    const code = localStorage.getItem(CLOUD_GROUP_KEY);
    if (cfg) document.getElementById('cloud-config-input').value = cfg;
    if (code) document.getElementById('cloud-group-input').value = code;
  }
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCloudModal() {
  document.getElementById('cloud-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('btn-connect-cloud').addEventListener('click', async () => {
  const errorEl = document.getElementById('cloud-error');
  errorEl.hidden = true;
  let cfgText = document.getElementById('cloud-config-input').value.trim();
  const groupCode = document.getElementById('cloud-group-input').value.trim();

  if (!groupCode) {
    errorEl.hidden = false;
    errorEl.textContent = 'חסר קוד קבוצה.';
    return;
  }

  try {
    // Allow JS-style config (with unquoted keys) by extracting via regex
    if (!cfgText.startsWith('{')) throw new Error('הקונפיג חייב להתחיל ב-{');
    let cfg;
    try {
      cfg = JSON.parse(cfgText);
    } catch (e) {
      // Try to convert JS object literal to JSON
      const fixed = cfgText
        .replace(/(\w+):/g, '"$1":')
        .replace(/'/g, '"')
        .replace(/,(\s*[}\]])/g, '$1');
      cfg = JSON.parse(fixed);
    }
    if (!cfg.apiKey || !cfg.projectId) throw new Error('קונפיג לא תקין — חסר apiKey או projectId');

    localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
    localStorage.setItem(CLOUD_GROUP_KEY, groupCode);
    await initCloud();
    if (cloudState.active) {
      closeCloudModal();
      alert('✅ חובר בהצלחה! שתף את קוד הקבוצה "' + groupCode + '" עם 3 המדריכים האחרים.');
    } else {
      errorEl.hidden = false;
      errorEl.textContent = 'החיבור נכשל. בדוק את הקונפיג ונסה שוב.';
    }
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = 'שגיאה: ' + err.message;
  }
});

document.getElementById('btn-disconnect-cloud').addEventListener('click', () => {
  if (!confirm('להתנתק מהסנכרון? הנתונים יישארו במכשיר הזה אבל לא יסתנכרנו יותר.')) return;
  disconnectCloud();
  closeCloudModal();
});

document.getElementById('btn-copy-group-code').addEventListener('click', () => {
  navigator.clipboard.writeText(cloudState.groupCode || '').then(() => {
    const btn = document.getElementById('btn-copy-group-code');
    const old = btn.textContent;
    btn.textContent = '✓ הועתק';
    setTimeout(() => btn.textContent = old, 1500);
  });
});

// Kick off cloud after initial render
initCloud();

// ---------------- PWA Service Worker ----------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
