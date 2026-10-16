// ===== TRACKING AUTOMATION PRO - SEARCH.JS =====
// تبويب "بحث ياليدين": يكتشف تلقائيًا إن كان الإدخال رقم هاتف جزائري أو رقم تتبع،
// ثم يفتح صفحة البحث المناسبة في منصة Yalidine. (منقول من إضافة yalidine-search-extension)

(() => {
  'use strict';

  const YALIDINE_BASE_URL = 'https://yalidine.app/app/colis/index.php';
  const HISTORY_KEY = 'ysSearchHistory';
  const NEW_TAB_KEY = 'ysNewTabPreference';
  const HIJACK_KEY = 'ysHijackEnabled';
  const MAX_HISTORY = 50;

  const byId = id => document.getElementById(id);
  const els = {
    input: byId('ysInput'),
    clear: byId('ysClearBtn'),
    search: byId('ysSearchBtn'),
    newTab: byId('ysNewTab'),
    hijack: byId('ysHijack'),
    error: byId('ysError'),
    success: byId('ysSuccess'),
    detected: byId('ysDetected'),
    body: byId('ysHistoryBody'),
    clearHistory: byId('ysClearHistoryBtn'),
  };

  // ---------- التطبيع والتحقق ----------

  // تنظيف رقم الهاتف وتوحيده إلى 0XXXXXXXXX (يعالج +213 / 00213 / 213)
  function normalizePhoneNumber(raw) {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00213')) digits = '0' + digits.slice(5);
    else if (digits.startsWith('213')) digits = '0' + digits.slice(3);
    return digits;
  }

  const isValidAlgerianPhone = n => /^0\d{9}$/.test(n);

  // توحيد رقم التتبع إلى yal-XXXXXX (يقبل الإدخال بدون بادئة وبأي حالة أحرف)
  function normalizeTrackingNumber(raw) {
    const compact = raw.replace(/\s+/g, '');
    const lower = compact.toLowerCase();
    let code;
    if (lower.startsWith('yal-')) code = compact.slice(4);
    else if (lower.startsWith('yal')) code = compact.slice(3).replace(/^-/, '');
    else code = compact;
    return 'yal-' + code.toUpperCase();
  }

  const isValidTrackingNumber = n => /^[A-Z0-9]{4,15}$/.test(n.replace(/^yal-/, ''));

  // هل الإدخال أرقام فقط (مع احتمال + في البداية)؟ => مسار الهاتف
  const looksLikePhoneInput = raw => /^\+?\d+$/.test(raw.replace(/[\s\-()]/g, ''));

  function detectAndProcess(rawInput) {
    const trimmed = rawInput.trim();
    if (!trimmed) return { error: 'الرجاء إدخال رقم هاتف أو رقم تتبع.' };

    if (looksLikePhoneInput(trimmed)) {
      const phone = normalizePhoneNumber(trimmed);
      if (!isValidAlgerianPhone(phone)) {
        return { error: 'رقم الهاتف غير صالح. تأكد من إدخال رقم جزائري صحيح.' };
      }
      return { type: 'phone', value: phone };
    }

    const tracking = normalizeTrackingNumber(trimmed);
    if (!isValidTrackingNumber(tracking)) {
      return { error: 'رقم التتبع غير صالح. تأكد من إدخال رقم تتبع صحيح.' };
    }
    return { type: 'tracking', value: tracking };
  }

  function buildSearchUrl(type, value) {
    const params = new URLSearchParams({
      source: 'cec',
      column: type === 'phone' ? 'phone' : 'tracking',
      q: value,
    });
    return `${YALIDINE_BASE_URL}?${params.toString()}`;
  }

  // ---------- الرسائل ----------
  function clearMessages() {
    els.error.textContent = '';
    els.success.textContent = '';
    els.detected.textContent = '';
  }

  function showError(text) {
    clearMessages();
    els.error.textContent = text;
  }

  function showSuccess(type, value) {
    clearMessages();
    els.success.textContent = 'تم فتح صفحة البحث بنجاح.';
    els.detected.textContent = type === 'phone' ? 'هاتف: ' : 'تتبع: ';
    const val = document.createElement('bdi');
    val.textContent = value;
    els.detected.appendChild(val);
  }

  // ---------- السجل ----------
  async function getHistory() {
    const data = await chrome.storage.local.get([HISTORY_KEY]);
    return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  }

  async function addToHistory(type, value) {
    let history = (await getHistory()).filter(item => item.value !== value);
    history.unshift({ value, type, timestamp: Date.now() });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
    renderHistory();
  }

  async function clearHistory() {
    await chrome.storage.local.remove([HISTORY_KEY]);
    renderHistory();
  }

  const formatTime = ts =>
    new Date(ts).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

  function dateLabel(ts) {
    const d = new Date(ts);
    const now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = day(now) - day(d);
    if (diff === 0) return 'اليوم';
    if (diff === 86400000) return 'أمس';
    return d.toLocaleDateString('ar-DZ', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function cell(cls, text) {
    const td = document.createElement('td');
    td.className = cls;
    td.textContent = text;
    return td;
  }

  async function renderHistory() {
    const history = await getHistory();
    els.body.replaceChildren();

    if (!history.length) {
      const tr = document.createElement('tr');
      const td = cell('sc-empty', 'لا توجد عمليات بحث سابقة');
      td.colSpan = 3;
      tr.appendChild(td);
      els.body.appendChild(tr);
      return;
    }

    let lastDay = null;
    history.forEach(item => {
      const day = new Date(item.timestamp).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        const sep = document.createElement('tr');
        sep.className = 'ys-date';
        const td = cell('', dateLabel(item.timestamp));
        td.colSpan = 3;
        sep.appendChild(td);
        els.body.appendChild(sep);
      }

      const tr = document.createElement('tr');
      tr.className = 'ys-row';
      tr.dataset.value = item.value;
      tr.title = 'إعادة البحث';

      tr.appendChild(cell('cell-value', item.value));

      const typeTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge ' + (item.type === 'phone' ? 'badge-phone' : 'badge-tracking');
      badge.textContent = item.type === 'phone' ? 'هاتف' : 'تتبع';
      typeTd.appendChild(badge);
      tr.appendChild(typeTd);

      tr.appendChild(cell('cell-time', formatTime(item.timestamp)));
      els.body.appendChild(tr);
    });
  }

  // ---------- البحث ----------
  function performSearch() {
    const result = detectAndProcess(els.input.value);
    if (result.error) {
      showError(result.error);
      return;
    }

    const url = buildSearchUrl(result.type, result.value);
    if (els.newTab.checked) chrome.tabs.create({ url });
    else chrome.tabs.update({ url });

    addToHistory(result.type, result.value);
    showSuccess(result.type, result.value);
    els.input.value = '';
  }

  // ---------- تشغيل ----------
  async function init() {
    els.search.addEventListener('click', performSearch);
    // Ctrl+Shift+F داخل الـ popup: انتقال لتبويب البحث + تركيز الحقل
    document.addEventListener('keydown', e => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.code === 'KeyF' || e.key?.toLowerCase() === 'f')) {
        e.preventDefault();
        document.getElementById('tabBtnSearch')?.click();
        setTimeout(() => els.input.focus(), 50);
      }
    });
    els.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); performSearch(); }
    });
    els.input.addEventListener('input', clearMessages);

    els.clear.addEventListener('click', () => {
      els.input.value = '';
      clearMessages();
      els.input.focus();
    });

    els.newTab.addEventListener('change', () => {
      chrome.storage.local.set({ [NEW_TAB_KEY]: els.newTab.checked });
    });

    els.hijack.addEventListener('change', () => {
      chrome.storage.local.set({ [HIJACK_KEY]: els.hijack.checked });
    });

    els.clearHistory.addEventListener('click', clearHistory);

    els.body.addEventListener('click', e => {
      const row = e.target.closest('.ys-row');
      if (!row) return;
      els.input.value = row.dataset.value;
      performSearch();
    });

    // التركيز على حقل البحث عند فتح هذا التبويب
    document.addEventListener('tap:tabchange', e => {
      if (e.detail === 'search') els.input.focus();
    });

    const data = await chrome.storage.local.get([NEW_TAB_KEY, HIJACK_KEY]);
    if (data[NEW_TAB_KEY] !== undefined) els.newTab.checked = !!data[NEW_TAB_KEY];
    els.hijack.checked = !!data[HIJACK_KEY];
    renderHistory();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
