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
      } else {
        counselor.vacationDates.push(iso);
        counselor.vacationDates.sort();
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

// ---------------- PWA Service Worker ----------------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
