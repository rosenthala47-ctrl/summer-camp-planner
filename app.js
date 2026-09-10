// ============================================================
// ג'פטו אומנות בעץ — Woodcraft & Judaica business site + admin dashboard
// ============================================================

const STORAGE_KEY = 'woodcraftSite_state_v1';
const CLOUD_CFG_KEY = 'woodcraftSite_cloudConfig_v1';
const SESSION_ADMIN_KEY = 'woodcraftSite_adminSession_v1';
const DEFAULT_ADMIN_PASSWORD = '6767';
const LEADS_LOCAL_CAP = 300;

const DEFAULT_STATE = {
  site: {
    businessName: 'ג\'פטו אומנות בעץ',
    tagline: 'מזוזות ייחודיות משילוב עץ זית ואפוקסי — כל יצירה היא גזע אחר, סיפור אחר, מזוזה אחת בלבד בעולם.',
    about: 'כמו ג\'פטו שנפח חיים בכל חתיכת עץ, כל מזוזה כאן נולדת משילוב של עץ זית טבעי ואפוקסי צבעוני, כך שכל פריט הוא יצירה יחידה שלא תיוצר פעם נוספת. בין הדגמים אפשר למצוא עיצובים בהשראת מפת ארץ ישראל, גימורי פנינה ותכלת, ועיטורי שם קדוש בציפוי זהב או כסף. כל מזוזה נבנית ונגמרת ביד, מהבחירה של פלח העץ ועד הליטוש האחרון.',
    phone: '0556850155',
    address: '',
    hours: '',
    instagram: '',
    logo: 'images/logo.png',
    leadsTotal: 0,
  },
  gallery: [
    { id: 'g1', img: 'images/gallery-1.jpg', caption: 'מזוזות זית ואפוקסי בגוון תכלת — כל גזע עץ יוצר תבנית שונה' },
    { id: 'g2', img: 'images/gallery-2.jpg', caption: 'גימור פנינה לבן, מוכן לאריזת מתנה מהודרת' },
    { id: 'g3', img: 'images/gallery-3.jpg', caption: 'סדרת מזוזות בעיצוב מפת ארץ ישראל' },
  ],
  prices: [
    { id: 'p1', name: 'מזוזה מעץ זית ואפוקסי בעיצוב אישי', price: 220, unit: 'ומעלה', note: 'בחירת גוון אפוקסי וגזע עץ' },
    { id: 'p2', name: 'מזוזה בעיצוב מפת ארץ ישראל', price: 280, unit: 'ומעלה', note: '' },
    { id: 'p3', name: 'מזוזה בגימור פנינה עם עיטור זהב/כסף', price: 250, unit: '', note: '' },
    { id: 'p4', name: 'מארז מתנה למזוזה + ברכה', price: 180, unit: '', note: 'אריזה מהודרת, מוכנה למתנה' },
    { id: 'p5', name: 'סדנת יצירה בשילוב עץ ואפוקסי', price: 180, unit: 'לאדם', note: '2 שעות, כולל חומרים' },
  ],
  leads: [],
  adminPasswordHash: '',
};

let state = loadState();
let cloud = { active: false, db: null, fns: null, unsubs: [], applyingRemote: false };

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      site: { ...DEFAULT_STATE.site, ...(parsed.site || {}) },
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : structuredClone(DEFAULT_STATE.gallery),
      prices: Array.isArray(parsed.prices) ? parsed.prices : structuredClone(DEFAULT_STATE.prices),
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      adminPasswordHash: parsed.adminPasswordHash || '',
    };
  } catch (e) {
    console.warn('Failed to load state, using defaults', e);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureDefaultPassword() {
  if (!state.adminPasswordHash) {
    state.adminPasswordHash = await sha256(DEFAULT_ADMIN_PASSWORD);
    saveState();
  }
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------------- WhatsApp helpers ----------------
function normalizedPhoneDigits(raw) {
  let digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

function buildWhatsAppUrl(message) {
  const digits = normalizedPhoneDigits(state.site.phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function defaultWaMessage() {
  return `שלום! ראיתי את האתר של ${state.site.businessName} ואשמח לשמוע פרטים על הזמנת יצירה בעץ.`;
}

function formatPrice(n) {
  return '₪' + Number(n).toLocaleString('he-IL');
}

// ---------------- Rendering: public site ----------------
function renderSite() {
  const s = state.site;
  document.getElementById('page-title').textContent = `${s.businessName} | מזוזות עץ זית ואפוקסי בעבודת יד`;
  document.getElementById('meta-description').setAttribute('content', s.tagline);
  document.getElementById('og-title').setAttribute('content', s.businessName);
  document.getElementById('og-description').setAttribute('content', s.tagline);
  document.getElementById('brand-name-header').textContent = s.businessName;
  document.getElementById('hero-name').textContent = s.businessName;
  document.getElementById('hero-tagline').textContent = s.tagline;
  document.getElementById('about-text').textContent = s.about;
  document.getElementById('footer-name').textContent = '© ' + new Date().getFullYear() + ' ' + s.businessName;

  const ld = document.getElementById('ld-json');
  try {
    const data = JSON.parse(ld.textContent);
    data.name = s.businessName;
    data.description = s.tagline;
    if (s.phone) data.telephone = '+' + normalizedPhoneDigits(s.phone);
    if (s.address) data.address = s.address;
    ld.textContent = JSON.stringify(data);
  } catch (e) { /* ignore */ }

  const logoImg = document.getElementById('brand-logo');
  const logoFallback = document.getElementById('brand-logo-fallback');
  if (s.logo) {
    logoImg.src = s.logo; logoImg.hidden = false; logoFallback.hidden = true;
  } else {
    logoImg.hidden = true; logoFallback.hidden = false;
    logoFallback.textContent = s.businessName.trim().slice(0, 2);
  }

  setRow('row-phone', 'contact-phone', s.phone, v => v);
  setRow('row-address', 'contact-address', s.address, v => v);
  setRow('row-hours', 'contact-hours', s.hours, v => v);
  const igRow = document.getElementById('row-instagram');
  const igLink = document.getElementById('contact-instagram');
  if (s.instagram) {
    igRow.hidden = false; igLink.href = s.instagram; igLink.textContent = 'עקבו אחרינו באינסטגרם';
  } else { igRow.hidden = true; }

  renderGallery();
  renderPrices();
  updateLeadButtonsState();
}

function setRow(rowId, spanId, value, fmt) {
  const row = document.getElementById(rowId);
  if (value) { row.hidden = false; document.getElementById(spanId).textContent = fmt(value); }
  else { row.hidden = true; }
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';
  state.gallery.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    const posX = item.posX ?? 50, posY = item.posY ?? 50, zoom = item.zoom ?? 100;
    const media = item.img
      ? `<div class="gallery-photo-frame"><img class="gallery-photo" src="${item.img}" alt="${escapeHtml(item.caption || '')}" style="object-position:${posX}% ${posY}%; transform:scale(${zoom / 100});"></div>`
      : `<div class="gallery-photo-placeholder">${escapeHtml(item.caption || 'תמונה לדוגמה')}</div>`;
    card.innerHTML = `<figure>${media}${item.caption ? `<figcaption class="gallery-caption">${escapeHtml(item.caption)}</figcaption>` : ''}</figure>`;
    grid.appendChild(card);
  });
}

function renderPrices() {
  const list = document.getElementById('price-list');
  list.innerHTML = '';
  state.prices.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="price-item-name">${escapeHtml(p.name)}${p.note ? `<span class="price-item-note">${escapeHtml(p.note)}</span>` : ''}</span>
      <span class="price-leader"></span>
      <span class="price-item-value">${formatPrice(p.price)}${p.unit ? ' ' + escapeHtml(p.unit) : ''}</span>`;
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function updateLeadButtonsState() {
  const hasPhone = !!normalizedPhoneDigits(state.site.phone);
  document.querySelectorAll('[data-lead-place]').forEach(el => {
    el.classList.toggle('is-unconfigured', !hasPhone);
  });
}

// ---------------- Lead tracking ----------------
function showToast(msg, ms = 3200) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { t.hidden = true; }, ms);
}

function logLead(place) {
  const entry = { id: uid('lead'), ts: Date.now(), place };
  state.leads.unshift(entry);
  if (state.leads.length > LEADS_LOCAL_CAP) state.leads.length = LEADS_LOCAL_CAP;
  state.site.leadsTotal = (state.site.leadsTotal || 0) + 1;
  saveState();
  cloudLogLead(entry);
  renderAdminOverview();
}

function wireLeadButtons() {
  document.querySelectorAll('[data-lead-place]').forEach(el => {
    el.addEventListener('click', e => {
      const digits = normalizedPhoneDigits(state.site.phone);
      if (!digits) {
        e.preventDefault();
        showToast('מספר הוואטסאפ עדיין לא הוגדר. יש להגדיר אותו בלוח הניהול (הגדרות → פרטי התקשרות).');
        return;
      }
      const place = el.getAttribute('data-lead-place');
      const url = buildWhatsAppUrl(defaultWaMessage());
      logLead(place);
      window.open(url, '_blank', 'noopener');
    });
  });
}

// ============================================================
// ADMIN
// ============================================================
function isAdminLoggedIn() {
  return sessionStorage.getItem(SESSION_ADMIN_KEY) === '1';
}

function setPublicSiteVisible(visible) {
  document.getElementById('site-header').hidden = !visible;
  document.getElementById('top').hidden = !visible;
  document.querySelector('.site-footer').hidden = !visible;
  document.getElementById('fab-wa').hidden = !visible;
}

function showAdminGate() {
  setPublicSiteVisible(false);
  document.getElementById('admin-gate').hidden = false;
  document.getElementById('admin-shell').hidden = true;
  document.getElementById('admin-password-input').focus();
}

function showAdminShell() {
  setPublicSiteVisible(false);
  document.getElementById('admin-gate').hidden = true;
  document.getElementById('admin-shell').hidden = false;
  renderAdminAll();
}

function hideAdmin() {
  setPublicSiteVisible(true);
  document.getElementById('admin-gate').hidden = true;
  document.getElementById('admin-shell').hidden = true;
}

function handleRoute() {
  const hash = location.hash;
  if (hash === '#admin-gate' || hash === '#admin') {
    if (isAdminLoggedIn()) showAdminShell(); else showAdminGate();
  } else {
    hideAdmin();
  }
}

document.getElementById('admin-login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pw = document.getElementById('admin-password-input').value;
  const hash = await sha256(pw);
  const err = document.getElementById('admin-login-error');
  if (hash === state.adminPasswordHash) {
    err.hidden = true;
    sessionStorage.setItem(SESSION_ADMIN_KEY, '1');
    document.getElementById('admin-password-input').value = '';
    showAdminShell();
  } else {
    err.hidden = false;
    document.getElementById('admin-password-input').value = '';
  }
});

const pinInput = document.getElementById('admin-password-input');
pinInput.addEventListener('input', () => {
  pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
  if (pinInput.value.length === 4) {
    document.getElementById('admin-login-form').requestSubmit();
  }
});

// ---- Secret gesture: 5 clicks on the logo within 1.5s opens the admin gate ----
let logoClickCount = 0;
let logoClickTimer = null;
function handleLogoSecretClick(e) {
  logoClickCount += 1;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
  if (logoClickCount >= 5) {
    e.preventDefault();
    logoClickCount = 0;
    location.hash = '#admin';
  }
}
document.getElementById('brand-logo').addEventListener('click', handleLogoSecretClick);
document.getElementById('brand-logo-fallback').addEventListener('click', handleLogoSecretClick);

document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.admin-panel[data-panel="${btn.dataset.panel}"]`).classList.add('active');
  });
});

function renderAdminAll() {
  document.getElementById('admin-brand-name').textContent = state.site.businessName;
  renderAdminOverview();
  renderAdminContentForm();
  renderAdminGalleryList();
  renderAdminPriceList();
  renderCloudPanel();
}

function renderAdminOverview() {
  const total = cloud.active ? (state.site.leadsTotal || 0) : state.leads.length;
  document.getElementById('stat-leads-total').textContent = total;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCount = state.leads.filter(l => l.ts >= weekAgo).length;
  document.getElementById('stat-leads-week').textContent = weekCount;
  document.getElementById('stat-gallery-count').textContent = state.gallery.length;
  document.getElementById('stat-prices-count').textContent = state.prices.length;

  const list = document.getElementById('leads-list');
  const emptyHint = document.getElementById('leads-empty-hint');
  list.innerHTML = '';
  const placeLabels = { header: 'כותרת עליונה', hero: 'עמוד הבית', contact: 'יצירת קשר', floating: 'כפתור צף' };
  const recent = state.leads.slice(0, 20);
  emptyHint.hidden = recent.length > 0;
  recent.forEach(l => {
    const li = document.createElement('li');
    const date = new Date(l.ts);
    li.innerHTML = `<span>פנייה מ${placeLabels[l.place] || l.place}</span><time>${date.toLocaleDateString('he-IL')} ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</time>`;
    list.appendChild(li);
  });
}

function renderAdminContentForm() {
  document.getElementById('f-business-name').value = state.site.businessName;
  document.getElementById('f-tagline').value = state.site.tagline;
  document.getElementById('f-about').value = state.site.about;
  document.getElementById('f-phone').value = state.site.phone;
  document.getElementById('f-address').value = state.site.address;
  document.getElementById('f-hours').value = state.site.hours;
  document.getElementById('f-instagram').value = state.site.instagram;
  const preview = document.getElementById('logo-preview');
  const fallback = document.getElementById('logo-preview-fallback');
  if (state.site.logo) { preview.src = state.site.logo; preview.hidden = false; fallback.hidden = true; }
  else { preview.hidden = true; fallback.hidden = false; }
}

document.getElementById('content-form').addEventListener('submit', e => {
  e.preventDefault();
  state.site.businessName = document.getElementById('f-business-name').value.trim() || DEFAULT_STATE.site.businessName;
  state.site.tagline = document.getElementById('f-tagline').value.trim();
  state.site.about = document.getElementById('f-about').value.trim();
  saveState();
  renderSite();
  document.getElementById('admin-brand-name').textContent = state.site.businessName;
  cloudWriteSite();
  flashConfirm('content-save-confirm');
});

document.getElementById('contact-form').addEventListener('submit', e => {
  e.preventDefault();
  state.site.phone = document.getElementById('f-phone').value.trim();
  state.site.address = document.getElementById('f-address').value.trim();
  state.site.hours = document.getElementById('f-hours').value.trim();
  state.site.instagram = document.getElementById('f-instagram').value.trim();
  saveState();
  renderSite();
  cloudWriteSite();
  flashConfirm('contact-save-confirm');
});

document.getElementById('logo-upload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await compressImage(file, 500, 0.85);
  state.site.logo = dataUrl;
  saveState();
  renderSite();
  renderAdminContentForm();
  cloudWriteSite();
});

document.getElementById('logo-remove').addEventListener('click', () => {
  state.site.logo = '';
  saveState();
  renderSite();
  renderAdminContentForm();
  cloudWriteSite();
});

function flashConfirm(id) {
  const el = document.getElementById(id);
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2200);
}

function compressImage(file, maxDim = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---- Gallery admin ----
function renderAdminGalleryList() {
  const list = document.getElementById('admin-gallery-list');
  list.innerHTML = '';
  state.gallery.forEach((item, idx) => {
    const li = document.createElement('li');
    const media = item.img ? `<img src="${item.img}" alt="">` : `<div class="gallery-photo-placeholder" style="width:90px;height:68px;font-size:.6rem;padding:.3rem;">ללא תמונה</div>`;
    const posX = item.posX ?? 50, posY = item.posY ?? 50, zoom = item.zoom ?? 100;
    const adjustRow = item.img ? `
      <div class="gallery-adjust">
        <label>מיקום אופקי
          <input type="range" min="0" max="100" value="${posX}" data-role="posX">
        </label>
        <label>מיקום אנכי
          <input type="range" min="0" max="100" value="${posY}" data-role="posY">
        </label>
        <label>זום
          <input type="range" min="100" max="200" value="${zoom}" data-role="zoom">
        </label>
        <button type="button" class="btn btn-ghost btn-sm" data-role="reset-view">איפוס תצוגה</button>
      </div>` : '';
    li.innerHTML = `
      <div class="admin-gallery-row-top">
        ${media}
        <input type="text" value="${escapeHtml(item.caption || '')}" placeholder="כיתוב לתמונה" data-role="caption">
        <div class="row-actions">
          <button type="button" data-role="up" title="הזזה למעלה" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-role="down" title="הזזה למטה" ${idx === state.gallery.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-role="delete" class="danger" title="מחיקה">✕</button>
        </div>
      </div>
      ${adjustRow}`;
    li.querySelector('[data-role="caption"]').addEventListener('input', e => {
      item.caption = e.target.value; saveState(); renderGallery(); cloudWriteGalleryItem(item);
    });
    li.querySelector('[data-role="delete"]').addEventListener('click', () => {
      state.gallery.splice(idx, 1); saveState(); renderAdminGalleryList(); renderGallery(); renderAdminOverview();
      cloudDeleteGalleryItem(item.id);
    });
    li.querySelector('[data-role="up"]').addEventListener('click', () => {
      if (idx === 0) return;
      [state.gallery[idx - 1], state.gallery[idx]] = [state.gallery[idx], state.gallery[idx - 1]];
      saveState(); renderAdminGalleryList(); renderGallery(); cloudWriteGalleryOrder();
    });
    li.querySelector('[data-role="down"]').addEventListener('click', () => {
      if (idx === state.gallery.length - 1) return;
      [state.gallery[idx + 1], state.gallery[idx]] = [state.gallery[idx], state.gallery[idx + 1]];
      saveState(); renderAdminGalleryList(); renderGallery(); cloudWriteGalleryOrder();
    });

    if (item.img) {
      const posXInput = li.querySelector('[data-role="posX"]');
      const posYInput = li.querySelector('[data-role="posY"]');
      const zoomInput = li.querySelector('[data-role="zoom"]');
      const applyLive = () => {
        item.posX = Number(posXInput.value);
        item.posY = Number(posYInput.value);
        item.zoom = Number(zoomInput.value);
        renderGallery();
      };
      const commitView = () => { saveState(); cloudWriteGalleryItem(item); };
      [posXInput, posYInput, zoomInput].forEach(input => {
        input.addEventListener('input', applyLive);
        input.addEventListener('change', commitView);
      });
      li.querySelector('[data-role="reset-view"]').addEventListener('click', () => {
        item.posX = 50; item.posY = 50; item.zoom = 100;
        posXInput.value = 50; posYInput.value = 50; zoomInput.value = 100;
        renderGallery(); commitView();
      });
    }

    list.appendChild(li);
  });
}

document.getElementById('gallery-upload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  const dataUrl = await compressImage(file, 1100, 0.72);
  const item = { id: uid('g'), img: dataUrl, caption: '', posX: 50, posY: 50, zoom: 100 };
  state.gallery.push(item);
  saveState();
  renderAdminGalleryList();
  renderGallery();
  renderAdminOverview();
  cloudWriteGalleryItem(item);
  e.target.value = '';
});

// ---- Prices admin ----
function renderAdminPriceList() {
  const list = document.getElementById('admin-price-list');
  list.innerHTML = '';
  state.prices.forEach((item, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <input type="text" value="${escapeHtml(item.name)}" placeholder="שם הפריט" data-role="name">
      <input type="number" min="0" value="${item.price}" placeholder="מחיר" data-role="price">
      <input type="text" value="${escapeHtml(item.unit || '')}" placeholder="יחידה (אופציונלי)" data-role="unit">
      <div class="row-actions">
        <button type="button" data-role="delete" class="danger" title="מחיקה">✕</button>
      </div>`;
    const commitPrices = () => { saveState(); renderPrices(); cloudWritePriceItem(item); };
    li.querySelector('[data-role="name"]').addEventListener('input', e => { item.name = e.target.value; commitPrices(); });
    li.querySelector('[data-role="price"]').addEventListener('input', e => { item.price = Number(e.target.value) || 0; commitPrices(); });
    li.querySelector('[data-role="unit"]').addEventListener('input', e => { item.unit = e.target.value; commitPrices(); });
    li.querySelector('[data-role="delete"]').addEventListener('click', () => {
      state.prices.splice(idx, 1); saveState(); renderAdminPriceList(); renderPrices(); renderAdminOverview();
      cloudDeletePriceItem(item.id);
    });
    list.appendChild(li);
  });
}

document.getElementById('price-add-btn').addEventListener('click', () => {
  const item = { id: uid('p'), name: 'פריט חדש', price: 0, unit: '', note: '' };
  state.prices.push(item);
  saveState();
  renderAdminPriceList();
  renderPrices();
  renderAdminOverview();
  cloudWritePriceItem(item);
});

// ---- Password change ----
document.getElementById('password-form').addEventListener('submit', async e => {
  e.preventDefault();
  const current = document.getElementById('f-current-password').value;
  const next = document.getElementById('f-new-password').value;
  const err = document.getElementById('password-error');
  const hash = await sha256(current);
  if (hash !== state.adminPasswordHash) {
    err.textContent = 'הקוד הנוכחי שגוי.'; err.hidden = false; return;
  }
  state.adminPasswordHash = await sha256(next);
  saveState();
  cloudWriteSite();
  err.hidden = true;
  document.getElementById('password-form').reset();
  flashConfirm('password-save-confirm');
});

// ============================================================
// CLOUD SYNC (optional, per-business Firebase project)
// ============================================================
function renderCloudPanel() {
  const banner = document.getElementById('sync-banner');
  if (cloud.active) {
    banner.hidden = false;
    banner.textContent = '☁ מחובר לסנכרון בענן — כל השינויים כאן מופיעים באתר החי לכל המבקרים, מכל מכשיר.';
  } else {
    banner.hidden = false;
    banner.textContent = '⚠ סנכרון בענן לא מחובר. השינויים נשמרים בדפדפן הזה בלבד ולא יופיעו למבקרים אחרים. ראו הסבר בלשונית "סנכרון וסיסמה".';
  }
  document.getElementById('cloud-disconnected-view').hidden = cloud.active;
  document.getElementById('cloud-connected-view').hidden = !cloud.active;
}

async function connectCloud(cfg) {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
  const mod = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
  const { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, addDoc, query, orderBy, limit, increment } = mod;
  const app = initializeApp(cfg);
  const db = getFirestore(app);
  cloud.db = db;
  cloud.fns = { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, addDoc, query, orderBy, limit, increment };

  const siteRef = doc(db, 'content', 'site');
  const siteSnap = await getDoc(siteRef);
  if (siteSnap.exists()) {
    applySiteDocData(siteSnap.data());
  } else {
    await setDoc(siteRef, siteDocPayload());
  }

  const pricesCol = collection(db, 'prices');
  const galleryCol = collection(db, 'gallery');
  const [pricesSnap, gallerySnap] = await Promise.all([getDocs(pricesCol), getDocs(galleryCol)]);
  if (!pricesSnap.empty) {
    state.prices = pricesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  } else {
    for (const p of state.prices) await setDoc(doc(db, 'prices', p.id), p);
  }
  if (!gallerySnap.empty) {
    state.gallery = gallerySnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
  } else {
    for (let i = 0; i < state.gallery.length; i++) await setDoc(doc(db, 'gallery', state.gallery[i].id), { ...state.gallery[i], order: i });
  }

  cloud.active = true;
  saveState();
  localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));

  cloud.unsubs.push(onSnapshot(siteRef, snap => {
    if (!snap.exists()) return;
    cloud.applyingRemote = true;
    applySiteDocData(snap.data());
    saveState(); renderSite(); renderAdminAll();
    cloud.applyingRemote = false;
  }));
  cloud.unsubs.push(onSnapshot(pricesCol, snap => {
    state.prices = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    saveState(); renderPrices(); renderAdminPriceList(); renderAdminOverview();
  }));
  cloud.unsubs.push(onSnapshot(galleryCol, snap => {
    state.gallery = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    saveState(); renderGallery(); renderAdminGalleryList(); renderAdminOverview();
  }));
  const leadsQuery = query(collection(db, 'leads'), orderBy('ts', 'desc'), limit(20));
  cloud.unsubs.push(onSnapshot(leadsQuery, snap => {
    const remoteLeads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.leads = remoteLeads;
    renderAdminOverview();
  }));

  renderSite(); renderAdminAll();
}

function disconnectCloud() {
  cloud.unsubs.forEach(u => u());
  cloud.unsubs = [];
  cloud.active = false;
  cloud.db = null;
  localStorage.removeItem(CLOUD_CFG_KEY);
  renderCloudPanel();
}

function siteDocPayload() {
  return { ...state.site, adminPasswordHash: state.adminPasswordHash };
}
function applySiteDocData(data) {
  const { adminPasswordHash, ...siteFields } = data;
  Object.assign(state.site, siteFields);
  if (adminPasswordHash) state.adminPasswordHash = adminPasswordHash;
}
function cloudWriteSite() {
  if (!cloud.active || cloud.applyingRemote) return;
  const { doc, setDoc } = cloud.fns;
  setDoc(doc(cloud.db, 'content', 'site'), siteDocPayload()).catch(e => console.error('cloudWriteSite', e));
}
function cloudWritePriceItem(item) {
  if (!cloud.active) return;
  const { doc, setDoc } = cloud.fns;
  const order = state.prices.findIndex(p => p.id === item.id);
  setDoc(doc(cloud.db, 'prices', item.id), { ...item, order }).catch(e => console.error('cloudWritePriceItem', e));
}
function cloudDeletePriceItem(id) {
  if (!cloud.active) return;
  const { doc, deleteDoc } = cloud.fns;
  deleteDoc(doc(cloud.db, 'prices', id)).catch(e => console.error('cloudDeletePriceItem', e));
}
function cloudWriteGalleryItem(item) {
  if (!cloud.active) return;
  const { doc, setDoc } = cloud.fns;
  const order = state.gallery.findIndex(g => g.id === item.id);
  setDoc(doc(cloud.db, 'gallery', item.id), { ...item, order }).catch(e => console.error('cloudWriteGalleryItem', e));
}
function cloudDeleteGalleryItem(id) {
  if (!cloud.active) return;
  const { doc, deleteDoc } = cloud.fns;
  deleteDoc(doc(cloud.db, 'gallery', id)).catch(e => console.error('cloudDeleteGalleryItem', e));
}
function cloudWriteGalleryOrder() {
  if (!cloud.active) return;
  const { doc, setDoc } = cloud.fns;
  state.gallery.forEach((g, i) => {
    setDoc(doc(cloud.db, 'gallery', g.id), { ...g, order: i }).catch(e => console.error('cloudWriteGalleryOrder', e));
  });
}
function cloudLogLead(entry) {
  if (!cloud.active) return;
  const { doc, addDoc, collection, updateDoc, increment } = cloud.fns;
  addDoc(collection(cloud.db, 'leads'), entry).catch(e => console.error('cloudLogLead', e));
  updateDoc(doc(cloud.db, 'content', 'site'), { leadsTotal: increment(1) }).catch(e => console.error('cloudLogLead total', e));
}

document.getElementById('btn-connect-cloud').addEventListener('click', async () => {
  const errEl = document.getElementById('cloud-error');
  errEl.hidden = true;
  const raw = document.getElementById('cloud-config-input').value.trim();
  let cfg;
  try { cfg = JSON.parse(raw); }
  catch (e) { errEl.textContent = 'זה לא JSON תקין. הדביקו את כל האובייקט firebaseConfig כפי שהוא, כולל הסוגריים המסולסלים.'; errEl.hidden = false; return; }
  if (!cfg.projectId || !cfg.apiKey) { errEl.textContent = 'חסרים שדות ב-config (נדרש לפחות apiKey ו-projectId).'; errEl.hidden = false; return; }
  try {
    await connectCloud(cfg);
  } catch (e) {
    console.error(e);
    errEl.textContent = 'ההתחברות נכשלה. ודאו שה-config תקין ושיצרתם Firestore Database בפרויקט (במצב Test mode).';
    errEl.hidden = false;
  }
});

document.getElementById('btn-disconnect-cloud').addEventListener('click', () => {
  if (confirm('לנתק את הסנכרון בענן? השינויים ימשיכו להישמר בדפדפן הזה בלבד.')) disconnectCloud();
});

async function initCloudFromSaved() {
  const raw = localStorage.getItem(CLOUD_CFG_KEY);
  if (!raw) return;
  try { await connectCloud(JSON.parse(raw)); }
  catch (e) { console.error('auto cloud connect failed', e); }
}

// ---------------- Nav toggle ----------------
document.getElementById('nav-toggle').addEventListener('click', () => {
  const nav = document.querySelector('.main-nav');
  const open = nav.classList.toggle('open');
  document.getElementById('nav-toggle').setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('.main-nav a').forEach(a => {
  a.addEventListener('click', () => document.querySelector('.main-nav').classList.remove('open'));
});

// ---------------- Boot ----------------
window.addEventListener('hashchange', handleRoute);

(async function init() {
  await ensureDefaultPassword();
  renderSite();
  wireLeadButtons();
  handleRoute();
  initCloudFromSaved();
})();
