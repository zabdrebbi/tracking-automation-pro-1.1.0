// ===== TRACKING AUTOMATION PRO - FILTER-CORE.JS =====
// نواة ميزة "التصفية" في ياليدين (منسوخة من yalisearch.html بنفس الوظائف)
// تعمل في تبويب الإضافة وفي النافذة العائمة Ctrl+Shift+G

(() => {
  'use strict';
  if (window.TAP_FILTER) return;

  const FILTER_BASE = 'https://yalidine.app/app/colis/index.php?';
  const LS_DISTRIBUTORS = 'yali_search_distributors_v1';
  const LS_STATUSES = 'yali_search_statuses_v1';
  const LS_FAVORITE_STATUSES = 'yali_search_favorite_statuses_v1';

  let calOpenFlag = false;

  const DEFAULT_DISTRIBUTORS = [
    { name: 'BASSI Mouatez Billah', id: '130514' },
    { name: 'Hafid Livreur Gpx 39', id: '11752' },
    { name: 'Ben Khalifa Imad', id: '73550' },
    { name: 'BELLABACI Belgacem', id: '148466' },
    { name: 'hassane baboukha', id: '4208' },
    { name: 'azizcom hakim', id: '27219' },
    { name: 'hocine azeb chikh', id: '4183' },
    { name: 'Berrouba Oualid', id: '4420' },
    { name: 'brahim necir', id: '4226' },
    { name: 'Khebbaz Ali', id: '4204' },
  ];

  const DEFAULT_COMMUNES = [
    { name: 'El Oued', id: '3901' },
    { name: 'Robbah', id: '3902' },
    { name: 'Oued El Alenda', id: '3903' },
    { name: 'Bayadha', id: '3904' },
    { name: 'Nakhla', id: '3905' },
    { name: 'Guemar', id: '3906' },
    { name: 'Kouinine', id: '3907' },
    { name: 'Reguiba', id: '3908' },
    { name: 'Hamraia', id: '3909' },
    { name: 'Taghzout', id: '3910' },
    { name: 'Debila', id: '3911' },
    { name: 'Hassani Abdelkrim', id: '3912' },
    { name: 'Hassi Khalifa', id: '3913' },
    { name: 'Taleb Larbi', id: '3914' },
    { name: 'Douar El Ma', id: '3915' },
    { name: 'Sidi Aoun', id: '3916' },
    { name: 'Trifaoui', id: '3917' },
    { name: 'Magrane', id: '3918' },
    { name: 'Beni Guecha', id: '3919' },
    { name: 'Ourmas', id: '3920' },
    { name: 'El Ogla', id: '3925' },
    { name: 'Mih Ouensa', id: '3926' },
  ];

  const DEFAULT_PARCEL_TYPES = [
    { name: 'E-COMMERCE', id: 'e' },
    { name: 'CLASSIQUE', id: 'c' },
    { name: 'PARTICULIER', id: 'p' },
    { name: 'INTERNE', id: 'i' },
  ];

  const DEFAULT_STATUSES = [
    'En préparation',
    'Pas encore ramassé',
    'Prêt à expédier',
    'Ramassé',
    'Transfert',
    'Expédié',
    'Bloqué',
    'Débloqué',
    'En localisation',
    'Centre',
    'Vers Wilaya',
    'Reçu à Wilaya',
    'En attente du client',
    'Prêt pour livreur',
    'Sorti en livraison',
    'En attente',
    'En alerte',
    'Alerte résolue',
    'Tentative échouée',
    'Livré',
    'Echèc livraison',
    'Retour vers centre',
    'Retourné au centre',
    'Retour transfert',
    'Retour groupé',
    'Retour à retirer',
    'Retour non retiré',
    'Colis abandonné',
    'Retour vers vendeur',
    'Retourné au vendeur',
    'Echange échoué',
  ];

  async function loadJSON(key, fallback) {
    try {
      const data = await chrome.storage.local.get([key]);
      if (data[key] !== undefined) return data[key];
    } catch (_) { /* خارج سياق الإضافة — نجرب localStorage */ }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  }

  async function saveJSON(key, value) {
    try { await chrome.storage.local.set({ [key]: value }); return; } catch (_) { /* تجاهل */ }
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* تجاهل */ }
  }

  async function getDistributors() {
    const saved = await loadJSON(LS_DISTRIBUTORS, []);
    const all = (Array.isArray(saved) ? saved : []).concat(DEFAULT_DISTRIBUTORS);
    const unique = new Map();
    all.forEach(item => {
      if (item && item.name && item.id) unique.set(String(item.id), { name: String(item.name), id: String(item.id) });
    });
    return Array.from(unique.values());
  }

  const setDistributors = list => saveJSON(LS_DISTRIBUTORS, list);

  async function getStatuses() {
    const saved = await loadJSON(LS_STATUSES, []);
    return [...new Set(DEFAULT_STATUSES.concat(Array.isArray(saved) ? saved : []))];
  }

  async function getFavoriteStatuses() {
    const saved = await loadJSON(LS_FAVORITE_STATUSES, []);
    return Array.isArray(saved) ? saved : [];
  }

  const setFavoriteStatuses = list => saveJSON(LS_FAVORITE_STATUSES, list);

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const FORM_HTML = `
    <div class="yf-form">
      <div class="yf-field">
        <label>التاريخ</label>
        <div class="yf-date-mode" role="group" aria-label="نوع التاريخ">
          <button class="yf-dm active" type="button" data-mode="single">يوم واحد</button>
          <button class="yf-dm" type="button" data-mode="range">فترة زمنية</button>
        </div>
        <input class="yf-input yf-date yf-single-date" dir="ltr" type="date" aria-label="التاريخ">
        <div class="yf-date-row" hidden>
          <input class="yf-input yf-date yf-start-date" dir="ltr" type="date" aria-label="تاريخ البداية">
          <input class="yf-input yf-date yf-end-date" dir="ltr" type="date" aria-label="تاريخ النهاية">
        </div>
      </div>
      <div class="yf-field">
        <label>نوع التسليم</label>
        <select class="yf-input yf-delivery">
          <option value="">الكل</option>
          <option value="1">Stop desk</option>
          <option value="0">à domicile</option>
        </select>
      </div>
      <div class="yf-field">
        <div class="yf-toolbar">
          <label>نوع الطرد</label>
          <div class="yf-actions">
            <button class="yf-action" type="button" data-select-all="parcel">تحديد الكل</button>
            <button class="yf-action" type="button" data-clear-all="parcel">إلغاء التحديد</button>
          </div>
        </div>
        <div class="yf-chips" data-list="parcel" aria-label="نوع الطرد"></div>
      </div>
      <div class="yf-field">
        <label>اسم الموزع</label>
        <select class="yf-input yf-distributor"></select>
      </div>
      <div class="yf-field">
        <div class="yf-toolbar">
          <label>حالة الطرد</label>
          <div class="yf-actions">
            <button class="yf-action" type="button" data-select-all="status">تحديد الكل</button>
            <button class="yf-action" type="button" data-clear-all="status">إلغاء التحديد</button>
          </div>
        </div>
        <span class="yf-heading">الحالات المفضلة</span>
        <div class="yf-chips" data-list="fav-status" aria-label="الحالات المفضلة"></div>
        <details class="yf-details">
          <summary>كل الحالات</summary>
          <div class="yf-chips" data-list="status" aria-label="كل الحالات"></div>
        </details>
      </div>
      <div class="yf-field">
        <div class="yf-toolbar">
          <label>البلدية</label>
          <div class="yf-actions">
            <button class="yf-action" type="button" data-select-all="commune">تحديد الكل</button>
            <button class="yf-action" type="button" data-clear-all="commune">إلغاء التحديد</button>
          </div>
        </div>
        <div class="yf-chips" data-list="commune" aria-label="البلديات"></div>
      </div>
      <div class="yf-actions-row">
        <button class="yf-primary" type="button">تصفية</button>
        <button class="yf-secondary" type="button">مسح</button>
      </div>
      <div class="yf-note" role="alert" hidden></div>
    </div>
    <div class="yf-confirm" hidden>
      <div class="yf-confirm-box" role="dialog" aria-modal="true">
        <h3>إزالة الحالة المفضلة؟</h3>
        <p class="yf-confirm-msg"></p>
        <div class="yf-dialog-actions">
          <button class="yf-secondary" type="button" data-confirm="cancel">إلغاء</button>
          <button class="yf-primary" type="button" data-confirm="ok">إزالة</button>
        </div>
      </div>
    </div>
    <div class="yf-dialog" hidden>
      <div class="yf-dialog-box" role="dialog" aria-modal="true">
        <h3>إضافة موزع جديد</h3>
        <label>اسم الموزع</label>
        <input class="yf-input" type="text" maxlength="50" autocomplete="off" data-d-name>
        <label>الرقم التعريفي</label>
        <input class="yf-input" type="text" inputmode="numeric" maxlength="20" autocomplete="off" data-d-id>
        <div class="yf-dialog-err" role="alert"></div>
        <div class="yf-dialog-actions">
          <button class="yf-secondary" type="button" data-d-action="cancel">إلغاء</button>
          <button class="yf-primary" type="button" data-d-action="save">حفظ الموزع</button>
        </div>
      </div>
    </div>`;

  async function createUI(container, opts) {
    opts = opts || {};
    container.innerHTML = FORM_HTML;

    const $ = sel => container.querySelector(sel);
    const singleDate = $('.yf-single-date');
    const dateRow = $('.yf-date-row');
    const startDate = $('.yf-start-date');
    const endDate = $('.yf-end-date');
    const dmBtns = Array.from(container.querySelectorAll('.yf-dm'));
    const delivery = $('.yf-delivery');
    const distributor = $('.yf-distributor');
    const parcelList = $('[data-list="parcel"]');
    const favStatusList = $('[data-list="fav-status"]');
    const allStatusList = $('[data-list="status"]');
    const communeList = $('[data-list="commune"]');
    const note = $('.yf-note');
    const confirmEl = $('.yf-confirm');
    const confirmMsg = $('.yf-confirm-msg');
    const dialogEl = $('.yf-dialog');
    const dName = $('[data-d-name]');
    const dId = $('[data-d-id]');
    const dErr = $('.yf-dialog-err');

    let pendingRemoval = '';
    let longPressTimer = null;
    let longPressTriggered = false;

    // ---------- منتقي تاريخ مدمج (كالندار احترافي بدل منتقي المتصفح) ----------
    const CAL_DOW = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
    const CAL_MONTHS = ['جانفي', 'فيفري', 'مارس', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    let calEl = null;
    let calBackdrop = null;
    let calInput = null;
    let calYear = 0;
    let calMonth = 0;

    const pad2 = n => (n < 10 ? '0' + n : String(n));
    const fmtDate = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());

    function closeCalendar() {
      if (calBackdrop) { calBackdrop.remove(); calBackdrop = null; }
      if (calEl) {
        calEl.removeEventListener('click', onCalendarClick);
        calEl.removeEventListener('keydown', onCalendarKeydown);
        (calEl.getRootNode().ownerDocument || document).removeEventListener('keydown', onCalendarKeydown, true);
        calEl.remove();
        calEl = null;
      }
      window.removeEventListener('scroll', closeCalendar, true);
      window.removeEventListener('resize', closeCalendar, true);
      calInput = null;
      calOpenFlag = false;
    }

    function renderCalendar() {
      if (!calEl) return;
      const now = new Date();
      const todayStr = fmtDate(now);
      const firstDow = new Date(calYear, calMonth, 1).getDay();
      const daysCount = new Date(calYear, calMonth + 1, 0).getDate();
      const sel = /^(\d{4})-(\d{2})-(\d{2})$/.exec(calInput && calInput.value ? calInput.value : '');

      let cells = '';
      for (let i = 0; i < firstDow; i++) cells += '<span class="yf-cal-day empty" aria-hidden="true"></span>';
      for (let d = 1; d <= daysCount; d++) {
        const val = calYear + '-' + pad2(calMonth + 1) + '-' + pad2(d);
        const cls = ['yf-cal-day'];
        if (val === todayStr) cls.push('today');
        if (sel && sel[1] === String(calYear) && +sel[2] === calMonth + 1 && +sel[3] === d) cls.push('selected');
        cells += '<button type="button" class="' + cls.join(' ') + '" data-cal-day="' + val + '">' + d + '</button>';
      }

      calEl.innerHTML =
        '<div class="yf-cal-head">' +
          '<button type="button" class="yf-cal-nav" data-cal-nav="prev" aria-label="الشهر السابق">›</button>' +
          '<span class="yf-cal-title">' + CAL_MONTHS[calMonth] + ' ' + calYear + '</span>' +
          '<button type="button" class="yf-cal-nav" data-cal-nav="next" aria-label="الشهر التالي">‹</button>' +
        '</div>' +
        '<div class="yf-cal-dows">' + CAL_DOW.map(d => '<span class="yf-cal-dow">' + d + '</span>').join('') + '</div>' +
        '<div class="yf-cal-grid">' + cells + '</div>' +
        '<div class="yf-cal-foot">' +
          '<button type="button" data-cal-foot="today">اليوم</button>' +
          '<button type="button" data-cal-foot="clear">مسح التاريخ</button>' +
        '</div>';
    }

    function openCalendar(input) {
      const toggle = calInput === input;
      closeCalendar();
      if (toggle) return;

      const root = container.getRootNode();
      const doc = root.ownerDocument || document;

      calBackdrop = doc.createElement('div');
      calBackdrop.className = 'yf-cal-backdrop';
      calBackdrop.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); closeCalendar(); });

      calEl = doc.createElement('div');
      calEl.className = 'yf-cal';
      calEl.setAttribute('role', 'dialog');
      calEl.setAttribute('aria-label', 'منتقي التاريخ');

      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.value || '');
      const now = new Date();
      calYear = m ? +m[1] : now.getFullYear();
      calMonth = m ? +m[2] - 1 : now.getMonth();
      calInput = input;

      (root === doc ? doc.body : root).appendChild(calBackdrop);
      (root === doc ? doc.body : root).appendChild(calEl);
      renderCalendar();
      calEl.addEventListener('click', onCalendarClick);
      calEl.addEventListener('keydown', onCalendarKeydown);
      doc.addEventListener('keydown', onCalendarKeydown, true);

      const rect = input.getBoundingClientRect();
      const vw = doc.documentElement.clientWidth;
      const vh = doc.documentElement.clientHeight;
      const w = calEl.offsetWidth;
      const h = calEl.offsetHeight;
      let left = Math.min(Math.max(8, rect.left), Math.max(8, vw - w - 8));
      let top = rect.bottom + 6;
      if (top + h > vh - 8) top = rect.top - h - 6;
      if (top < 8) top = 8;
      calEl.style.left = left + 'px';
      calEl.style.top = top + 'px';

      window.addEventListener('scroll', closeCalendar, true);
      window.addEventListener('resize', closeCalendar, true);
      calOpenFlag = true;
    }

    function onCalendarClick(e) {
      const nav = e.target.closest('[data-cal-nav]');
      if (nav) {
        if (nav.dataset.calNav === 'prev') { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } }
        else { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } }
        renderCalendar();
        return;
      }
      const day = e.target.closest('[data-cal-day]');
      if (day) {
        calInput.value = day.dataset.calDay;
        calInput.dispatchEvent(new Event('change', { bubbles: true }));
        closeCalendar();
        return;
      }
      const foot = e.target.closest('[data-cal-foot]');
      if (foot) {
        if (foot.dataset.calFoot === 'today') calInput.value = fmtDate(new Date());
        else calInput.value = '';
        calInput.dispatchEvent(new Event('change', { bubbles: true }));
        closeCalendar();
      }
    }

    function onCalendarKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeCalendar(); }
    }

    // الضغط في أي موضع داخل حقل التاريخ يفتح الكالندار (بدون التركيز للكتابة)
    [singleDate, startDate, endDate].forEach(inp => {
      inp.addEventListener('mousedown', e => e.preventDefault());
      inp.addEventListener('click', e => { e.preventDefault(); openCalendar(inp); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && document.activeElement === inp) { e.preventDefault(); openCalendar(inp); }
      });
    });

    const selectedStatuses = () => [...new Set(
      Array.from(container.querySelectorAll('.yf-status.selected')).map(el => el.dataset.status)
    )];
    const selectedParcelTypes = () =>
      Array.from(parcelList.querySelectorAll('.yf-chip.selected')).map(el => el.dataset.parcel);
    const selectedCommunes = () =>
      Array.from(communeList.querySelectorAll('.yf-chip.selected')).map(el => el.dataset.commune);

    function toggleStatus(status) {
      container.querySelectorAll('.yf-status').forEach(el => {
        if (el.dataset.status === status) el.classList.toggle('selected');
      });
    }

    function statusChipHTML(status, favorites) {
      const isFav = favorites.includes(status);
      return '<div class="yf-chip yf-status' + (isFav ? ' yf-fav' : '') + '" role="button" tabindex="0" data-status="' + escapeHTML(status) + '">' +
        '<span class="yf-chip-label">' + escapeHTML(status) + '</span>' +
        '<button class="yf-star' + (isFav ? ' active' : '') + '" type="button" data-star="' + escapeHTML(status) + '" aria-label="' +
        (isFav ? 'إزالة من الحالات المفضلة' : 'إضافة إلى الحالات المفضلة') + '">' + (isFav ? '★' : '☆') + '</button>' +
        '</div>';
    }

    function plainChipHTML(label, attr, value, selected) {
      return '<div class="yf-chip' + (selected ? ' selected' : '') + '" role="button" tabindex="0" data-' + attr + '="' + escapeHTML(value) + '">' +
        '<span class="yf-chip-label">' + escapeHTML(label) + '</span></div>';
    }

    async function renderOptions() {
      const selDist = distributor.value;
      const selStatuses = selectedStatuses();
      const favorites = await getFavoriteStatuses();
      const dists = await getDistributors();
      distributor.innerHTML = '<option value="">بدون تحديد</option>' +
        dists.map(d => '<option value="' + escapeHTML(d.id) + '">' + escapeHTML(d.name) + ' (' + escapeHTML(d.id) + ')</option>').join('') +
        '<option value="__add_distributor__">إضافة موزع</option>';
      distributor.value = selDist;

      const statuses = await getStatuses();
      const favList = statuses.filter(s => favorites.includes(s));
      favStatusList.innerHTML = favList.length
        ? favList.map(s => statusChipHTML(s, favorites)).join('')
        : '<div class="yf-empty">اضغط ★ على أي حالة لإضافتها إلى المفضلة.</div>';
      allStatusList.innerHTML = statuses.map(s => statusChipHTML(s, favorites)).join('');
      allStatusList.querySelectorAll('.yf-status').forEach(el => {
        el.classList.toggle('selected', selStatuses.includes(el.dataset.status));
      });
      favStatusList.querySelectorAll('.yf-status').forEach(el => {
        el.classList.toggle('selected', selStatuses.includes(el.dataset.status));
      });

      parcelList.innerHTML = DEFAULT_PARCEL_TYPES.map(p =>
        plainChipHTML(p.name, 'parcel', p.id, selectedParcelTypes().includes(p.id))
      ).join('');
      communeList.innerHTML = DEFAULT_COMMUNES.map(c =>
        plainChipHTML(c.name, 'commune', c.id, selectedCommunes().includes(c.id))
      ).join('');
    }

    function buildFilterUrl() {
      const isRange = !dateRow.hidden;
      const startInput = isRange ? startDate.value : singleDate.value;
      const endInput = isRange ? endDate.value : singleDate.value;
      const start = startInput || endInput;
      const end = endInput || startInput;
      if (start && end && start > end) {
        return { error: 'تاريخ البداية يجب أن يسبق تاريخ النهاية.' };
      }
      const params = new URLSearchParams();
      if (start && end) params.set('sd', start + ' à ' + end);
      if (delivery.value) params.append('dt', delivery.value);
      selectedParcelTypes().forEach(id => params.append('pt[]', id));
      if (distributor.value) params.append('l[]', distributor.value);
      selectedStatuses().forEach(status => params.append('ls[]', status));
      selectedCommunes().forEach(id => params.append('c[]', id));
      return { url: FILTER_BASE + params.toString() };
    }

    function doReset() {
      singleDate.value = '';
      startDate.value = '';
      endDate.value = '';
      delivery.value = '';
      distributor.value = '';
      container.querySelectorAll('.yf-chip.selected').forEach(c => c.classList.remove('selected'));
      note.hidden = true;
      note.textContent = '';
    }

    function requestFavoriteRemoval(status) {
      pendingRemoval = status;
      confirmMsg.textContent = 'هل تريد إزالة «' + status + '» من الحالات المفضلة؟';
      confirmEl.hidden = false;
    }

    function closeConfirm() {
      pendingRemoval = '';
      confirmEl.hidden = true;
    }

    dmBtns.forEach(btn => btn.addEventListener('click', () => {
      const range = btn.dataset.mode === 'range';
      dateRow.hidden = !range;
      singleDate.hidden = range;
      dmBtns.forEach(b => b.classList.toggle('active', b === btn));
    }));

    distributor.addEventListener('change', () => {
      if (distributor.value !== '__add_distributor__') return;
      distributor.value = '';
      dErr.textContent = '';
      dName.value = '';
      dId.value = '';
      dialogEl.hidden = false;
      dName.focus();
    });

    container.addEventListener('click', async e => {
      const t = e.target;
      if (!(t instanceof Element)) return;

      const act = t.closest('[data-select-all],[data-clear-all]');
      if (act) {
        const on = act.hasAttribute('data-select-all');
        const key = act.getAttribute('data-select-all') || act.getAttribute('data-clear-all');
        const listEl = { parcel: parcelList, status: allStatusList, commune: communeList }[key];
        if (listEl) listEl.querySelectorAll('.yf-chip').forEach(c => c.classList.toggle('selected', on));
        if (key === 'status') favStatusList.querySelectorAll('.yf-chip').forEach(c => c.classList.toggle('selected', on));
        return;
      }

      const star = t.closest('.yf-star');
      if (star) {
        e.stopPropagation();
        const status = star.dataset.star;
        const favorites = await getFavoriteStatuses();
        if (favorites.includes(status)) requestFavoriteRemoval(status);
        else { await setFavoriteStatuses(favorites.concat(status)); await renderOptions(); }
        return;
      }

      const statusChip = t.closest('.yf-status');
      if (statusChip) {
        if (!longPressTriggered) toggleStatus(statusChip.dataset.status);
        longPressTriggered = false;
        return;
      }

      const chip = t.closest('.yf-chip');
      if (chip) { chip.classList.toggle('selected'); return; }

      const confirmBtn = t.closest('[data-confirm]');
      if (confirmBtn) {
        if (confirmBtn.dataset.confirm === 'ok' && pendingRemoval) {
          const status = pendingRemoval;
          await setFavoriteStatuses((await getFavoriteStatuses()).filter(s => s !== status));
          await renderOptions();
        }
        closeConfirm();
        return;
      }

      const dAction = t.closest('[data-d-action]');
      if (dAction) {
        if (dAction.dataset.dAction === 'cancel') { dialogEl.hidden = true; return; }
        const name = dName.value.trim();
        const id = dId.value.trim();
        if (!name || !/^\d+$/.test(id)) {
          dErr.textContent = 'أدخل اسم الموزع ورقمًا تعريفيًا صحيحًا.';
          return;
        }
        const list = (await getDistributors()).filter(x => String(x.id) !== id);
        list.push({ name, id });
        await setDistributors(list);
        dialogEl.hidden = true;
        await renderOptions();
        distributor.value = id;
        return;
      }

      if (t.closest('.yf-primary')) {
        const result = buildFilterUrl();
        if (result.error) {
          note.textContent = result.error;
          note.hidden = false;
          return;
        }
        note.hidden = true;
        note.textContent = '';
        if (typeof opts.open === 'function') opts.open(result.url);
        return;
      }

      if (t.closest('.yf-secondary')) { doReset(); return; }
    });

    container.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!confirmEl.hidden) { closeConfirm(); e.stopPropagation(); return; }
        if (!dialogEl.hidden) { dialogEl.hidden = true; e.stopPropagation(); return; }
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const chip = e.target.closest && e.target.closest('.yf-chip');
      if (!chip || e.target.closest('.yf-star')) return;
      e.preventDefault();
      if (chip.classList.contains('yf-status')) toggleStatus(chip.dataset.status);
      else chip.classList.toggle('selected');
    });

    [allStatusList, favStatusList].forEach(list => {
      list.addEventListener('pointerdown', e => {
        const chip = e.target.closest && e.target.closest('.yf-status');
        if (!chip || (e.target.closest && e.target.closest('.yf-star'))) return;
        longPressTriggered = false;
        longPressTimer = setTimeout(() => {
          longPressTriggered = true;
          const status = chip.dataset.status;
          getFavoriteStatuses().then(favorites => {
            if (favorites.includes(status)) requestFavoriteRemoval(status);
            else return setFavoriteStatuses(favorites.concat(status)).then(renderOptions);
          });
        }, 550);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(name => {
        list.addEventListener(name, () => clearTimeout(longPressTimer));
      });
      list.addEventListener('contextmenu', e => {
        if (e.target.closest && e.target.closest('.yf-status')) e.preventDefault();
      });
    });

    confirmEl.addEventListener('click', e => { if (e.target === confirmEl) closeConfirm(); });
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.hidden = true; });

    await renderOptions();
    return { reset: doReset, buildFilterUrl };
  }

  window.TAP_FILTER = {
    createUI,
    isCalendarOpen: () => calOpenFlag,
    DEFAULT_DISTRIBUTORS,
    DEFAULT_COMMUNES,
    DEFAULT_PARCEL_TYPES,
    DEFAULT_STATUSES,
  };
})();
