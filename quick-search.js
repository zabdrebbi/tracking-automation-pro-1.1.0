// ===== TRACKING AUTOMATION PRO - QUICK-SEARCH.JS =====
// نافذة البحث السريعة: تظهر فوق أي صفحة باختصار Ctrl+Shift+F
// تعمل حتى لو كان التركيز داخل حقل كتابة. Enter للبحث، Esc للإغلاق.

(() => {
  'use strict';
  if (window.__tapQuickSearchLoaded) return;
  window.__tapQuickSearchLoaded = true;

  const YALIDINE_BASE_URL = 'https://yalidine.app/app/colis/index.php';
  const BORDEREAU_URL = 'https://yalidine.app/app/bordereau.php';
  const HISTORY_KEY = 'ysSearchHistory';
  const HIJACK_KEY = 'ysHijackEnabled';
  const isTopFrame = window.top === window.self;

  let host = null;
  let inputEl = null;
  let msgEl = null;
  let isOpen = false;
  let lastFocus = null;
  // تفعيل "اختصار بحث ياليدين" من تبويب بحث ياليدين (افتراضيًا معطّل)
  let hijackEnabled = false;
  try {
    chrome.storage.local.get([HIJACK_KEY], d => { hijackEnabled = !!(d && d[HIJACK_KEY]); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[HIJACK_KEY]) hijackEnabled = !!changes[HIJACK_KEY].newValue;
    });
  } catch (_) { /* خارج سياق الإضافة */ }

  const isYalidineHost = () => /yalidine/i.test(location.hostname || '');

  // هل النقر على زر البحث في موقع ياليدين؟
  // <span class="text-white-50 btn pl-1 pr-1" data-original-title="Recherche"><i class="fa fa-search" onclick="showModal('searchModal')"></i></span>
  function isYalidineSearchButton(e) {
    let path = [];
    try { path = (e.composedPath && e.composedPath()) || []; } catch (_) { path = []; }
    if (!path.length && e.target) path = [e.target];
    for (const n of path) {
      if (!n || n.nodeType !== 1) continue;
      if (n.matches && n.matches('i.fa-search')) return true;
      try {
        if (n.getAttribute) {
          if (n.getAttribute('data-original-title') === 'Recherche') return true;
          const oc = n.getAttribute('onclick') || '';
          if (oc.includes('searchModal')) return true;
        }
      } catch (_) { /* تجاهل */ }
      if (n === document || n === window) break;
    }
    return false;
  }

  // ---------- منطق الكشف (مطابق لـ search.js) ----------
  function normalizePhoneNumber(raw) {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('00213')) digits = '0' + digits.slice(5);
    else if (digits.startsWith('213')) digits = '0' + digits.slice(3);
    return digits;
  }
  const isValidAlgerianPhone = n => /^0\d{9}$/.test(n);

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
  const looksLikePhoneInput = raw => /^\+?\d+$/.test(raw.replace(/[\s\-()]/g, ''));

  function detectAndProcess(rawInput) {
    const trimmed = (rawInput || '').trim();
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

  // رابط القسيمة (bordereau) — لأرقام التتبع فقط
  function buildPrintUrl(value) {
    return `${BORDEREAU_URL}?tracking=${encodeURIComponent(value)}`;
  }

  // ---------- البحث المتعدد (عدة أرقام تتبع دفعة واحدة) ----------
  const MAX_MULTI = 30;

  // يقسم الإدخال إلى رموز (فراغات/فاصلة/فاصلة منقوطة/أسطر) ويتطلب لكل رمز تتبعًا كاملًا بصيغة yal-AB12CD
  function parseMultiTrackings(rawInput) {
    const tokens = (rawInput || '').split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length < 2) return null; // رمز واحد => مسار البحث الفردي العادي

    const values = [];
    for (const t of tokens) {
      if (/^\+?\d+$/.test(t.replace(/[\s\-()]/g, ''))) {
        return { error: 'البحث المتعدد متاح لأرقام التتبع فقط. أزل أرقام الهاتف من القائمة.' };
      }
      const tracking = normalizeTrackingNumber(t);
      if (!isValidTrackingNumber(tracking)) {
        return { error: 'البحث المتعدد يتطلب أرقام تتبع كاملة بصيغة yal-AB12CD. تحقق من: ' + t };
      }
      if (!values.includes(tracking)) values.push(tracking);
    }
    if (values.length < 2) return null;
    if (values.length > MAX_MULTI) {
      return { error: 'الحد الأقصى للكتابة المجمعة هو ' + MAX_MULTI + ' رقمًا في المرة الواحدة.' };
    }
    return { list: values };
  }

  // فتح عدة تبويبات من سكربت المحتوى عبر background (لا يمكن فتح عدة نوافذ مباشرة هنا)
  function openTabs(urls) {
    if (!urls.length) return;
    try {
      chrome.runtime.sendMessage({ type: 'OPEN_TABS', urls }, resp => {
        if (chrome.runtime.lastError || !resp || !resp.success) {
          // احتياطي: فتح أول تبويب فقط إذا فشل المرور عبر background
          try { window.open(urls[0], '_blank', 'noopener'); } catch (_) { /* تجاهل */ }
        }
      });
    } catch (_) {
      try { window.open(urls[0], '_blank', 'noopener'); } catch (_) { /* تجاهل */ }
    }
  }

  async function addManyToHistory(values) {
    try {
      let history = await getHistory();
      const set = new Set(values);
      history = history.filter(h => h && !set.has(h.value));
      const now = Date.now();
      const fresh = values.map(value => ({ value, type: 'tracking', timestamp: now }));
      history = [...fresh, ...history];
      await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, 50) });
    } catch (_) { /* التخزين غير متاح */ }
  }

  // ---------- تنسيق التاريخ (مطابق لـ search.js) ----------
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

  // ---------- الخطوط المحلية (نفس خطي الإضافة، تعمل دون إنترنت ولا تتأثر بـ CSP) ----------
  function localFontCss() {
    try {
      const cairo = chrome.runtime.getURL('fonts/Cairo.ttf');
      const mono = chrome.runtime.getURL('fonts/IBMPlexMono-Var.ttf');
      return `
        @font-face{font-family:'Cairo';font-style:normal;font-weight:200 1000;font-display:swap;src:url('${cairo}') format('truetype');}
        @font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:100 700;font-display:swap;src:url('${mono}') format('truetype');}`;
    } catch (_) {
      // احتياطي: تحميل من Google Fonts عند تعذر الوصول لملفات الإضافة
      return `@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Cairo:wght@400;500;600;700&display=swap');`;
    }
  }

  // ---------- الواجهة العائمة (Shadow DOM لعزل التنسيق) ----------
  function ensureUI() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'tap-ys-quick-host';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        ${localFontCss()}
        .overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 2147483647;
          display: none; justify-content: center; padding-top: 12vh;
          background: rgba(30,41,59,0.45);
          font-family: 'Cairo','Segoe UI',Tahoma,Arial,sans-serif;
        }
        .overlay.show { display: flex; }
        .box {
          width: min(480px, calc(100vw - 32px)); height: fit-content;
          background: #ffffff; border: 1px solid #d5dae3; border-radius: 8px; overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 20px 60px rgba(0,0,0,0.22);
          direction: rtl;
          animation: tapPop 0.15s ease;
        }
        @keyframes tapPop { from { opacity: 0; transform: translateY(-8px) scale(0.99); } to { opacity: 1; transform: none; } }
        .head {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 14px 16px; background: #ffffff; border-bottom: 1px solid #d5dae3;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .logo {
          width: 34px; height: 34px; flex: none;
          background: #dc3545; border-radius: 5px;
          display: flex; align-items: center; justify-content: center; color: #ffffff;
          box-shadow: 0 0 16px rgba(220,53,69,0.25);
        }
        .logo .fa { font-size: 20px; font-style: normal; display: flex; }
        .logo .fa svg { width: 1em; height: 1em; display: block; }
        .title { font-size: 15px; font-weight: 700; color: #1e293b; letter-spacing: 0.3px; }
        .kbd {
          flex: none; direction: ltr;
          font-family: 'IBM Plex Mono',ui-monospace,Consolas,monospace; font-size: 10px; font-weight: 600;
          background: #eef1f6; border: 1px solid #c8cfd9; border-radius: 4px;
          padding: 2px 8px; color: #475569; white-space: nowrap;
        }
        .body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; background: #ffffff; }
        form.row { display: flex; gap: 8px; margin: 0; }
        input {
          flex: 1; min-width: 0; direction: ltr; text-align: left;
          background: #f5f7fa; border: 1px solid #d5dae3; border-radius: 5px; color: #1e293b;
          padding: 10px 12px; font-size: 13px; letter-spacing: 0.3px; outline: none;
          font-family: 'IBM Plex Mono',ui-monospace,Consolas,monospace;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        input::placeholder {
          color: #94a3b8; direction: rtl; text-align: right;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif; letter-spacing: 0;
        }
        input:focus { border-color: #dc3545; box-shadow: 0 0 0 3px rgba(220,53,69,0.1); }
        button.go {
          flex: none; display: flex; align-items: center; justify-content: center; gap: 6px;
          background: #dc3545; border: 1px solid #dc3545; color: #ffffff; border-radius: 5px;
          padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif;
          box-shadow: 0 2px 12px rgba(220,53,69,0.25);
          transition: background 0.2s, transform 0.2s;
        }
        button.go:hover { background: #bb2d3b; transform: translateY(-1px); }
        button.go svg { width: 14px; height: 14px; }
        button.print {
          flex: none; display: flex; align-items: center; justify-content: center;
          background: #eef1f6; border: 1px solid #c8cfd9; color: #475569; border-radius: 5px;
          padding: 0 14px; cursor: pointer; transition: all 0.2s;
          font-family: 'Cairo','Segoe UI',Tahoma,sans-serif;
        }
        button.print:hover { border-color: #dc3545; color: #dc3545; background: rgba(220,53,69,0.1); }
        button.print svg { width: 16px; height: 16px; }
        .msg { font-size: 12px; min-height: 18px; }
        .msg:empty { display: none; }
        .msg.err { color: #dc2626; }
        .msg.ok { color: #16a34a; }
        .hint { font-size: 11px; line-height: 1.7; color: #94a3b8; text-align: center; }
        .hint b {
          font-family: 'IBM Plex Mono',ui-monospace,Consolas,monospace; font-size: 10px; font-weight: 400;
          background: #eef1f6; border: 1px solid #c8cfd9; border-radius: 4px;
          padding: 0 5px; color: #475569;
        }
      </style>
      <div class="overlay">
        <div class="box" role="dialog" aria-label="البحث السريع">
          <div class="head">
            <div class="brand">
              <span class="logo"><i class="fa fa-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg></i></span>
              <span class="title">البحث السريع</span>
            </div>
            <span class="kbd">Ctrl + Shift + F</span>
          </div>
          <div class="body">
            <form class="row">
              <input type="text" placeholder="هاتف أو تتبع، أو عدة تتبعات مفصولة بفاصلة" autocomplete="off" spellcheck="false" />
              <button class="go" type="submit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>بحث</button>
              <button class="print" type="button" title="طباعة الملصق (لأرقام التتبع)" aria-label="طباعة الملصق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
            </form>
            <div class="msg"></div>
            <div class="hint"><b>Enter</b> للبحث &nbsp;•&nbsp; <b>Esc</b> للإغلاق &nbsp;•&nbsp; عدة أرقام تتبع كاملة (yal-AB12CD) مفصولة بفاصلة تُفتح دفعة واحدة</div>
          </div>
        </div>
      </div>`;
    document.documentElement.appendChild(host);

    const overlay = root.querySelector('.overlay');
    inputEl = root.querySelector('input');
    msgEl = root.querySelector('.msg');
    const form = root.querySelector('form.row');

    // submit عبر form: يعمل مع Enter بشكل موثوق حتى لو اعترضت الصفحة حدث keydown
    form.addEventListener('submit', e => { e.preventDefault(); doSearch(); });
    form.querySelector('button.print').addEventListener('click', e => { e.preventDefault(); doPrint(); });
    // Esc للإغلاق (keydown على الحقل + احتياطي على مستوى الـ shadow root بطور الفقاعة فقط)
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else e.stopPropagation();
    }, false);
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close(); });
  }

  function showMsg(text, ok) {
    msgEl.textContent = text || '';
    msgEl.className = 'msg ' + (text ? (ok ? 'ok' : 'err') : '');
  }

  function open() {
    ensureUI();
    if (histOpen) closeHistory();
    lastFocus = document.activeElement;
    host.shadowRoot.querySelector('.overlay').classList.add('show');
    isOpen = true;
    showMsg('');
    // إعطاء المتصفح لحظة لعرض العنصر قبل التركيز
    setTimeout(() => { try { inputEl.focus(); inputEl.select(); } catch (_) {} }, 30);
  }

  function close() {
    if (!host) return;
    host.shadowRoot.querySelector('.overlay').classList.remove('show');
    isOpen = false;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  async function doSearch() {
    const multi = parseMultiTrackings(inputEl.value);
    if (multi) {
      if (multi.error) { showMsg(multi.error, false); return; }
      await addManyToHistory(multi.list);
      showMsg('تم فتح ' + multi.list.length + ' نتائج بحث في تبويبات جديدة.', true);
      openTabs(multi.list.map(value => buildSearchUrl('tracking', value)));
      return;
    }

    const result = detectAndProcess(inputEl.value);
    if (result.error) { showMsg(result.error, false); return; }
    const url = buildSearchUrl(result.type, result.value);

    // حفظ في السجل (نفس مفتاح الـ popup لتظهر في تبويب بحث ياليدين)
    // البحث السريع يفتح دائمًا في نفس التبويب بغض النظر عن إعداد "فتح في تبويب جديد"
    try {
      const data = await chrome.storage.local.get([HISTORY_KEY]);
      const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
      const next = [{ value: result.value, type: result.type, timestamp: Date.now() },
        ...history.filter(h => h && h.value !== result.value)].slice(0, 50);
      await chrome.storage.local.set({ [HISTORY_KEY]: next });
    } catch (_) { /* التخزين غير متاح — نتابع البحث */ }
    showMsg('تم فتح صفحة البحث بنجاح: ' + result.value, true);
    location.href = url;
  }

  // الطباعة: لأرقام التتبع فقط، تفتح رابط bordereau في تبويب جديد دائمًا
  async function doPrint() {
    const multi = parseMultiTrackings(inputEl.value);
    if (multi) {
      if (multi.error) { showMsg(multi.error, false); return; }
      await addManyToHistory(multi.list);
      showMsg('تم فتح ' + multi.list.length + ' قسيمة طباعة في تبويبات جديدة.', true);
      openTabs(multi.list.map(value => buildPrintUrl(value)));
      return;
    }

    const result = detectAndProcess(inputEl.value);
    if (result.error) { showMsg(result.error, false); return; }
    if (result.type !== 'tracking') { showMsg('الطباعة متاحة لأرقام التتبع فقط.', false); return; }
    const url = buildPrintUrl(result.value);
    try {
      const data = await chrome.storage.local.get([HISTORY_KEY]);
      const history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
      const next = [{ value: result.value, type: result.type, timestamp: Date.now() },
        ...history.filter(h => h && h.value !== result.value)].slice(0, 50);
      await chrome.storage.local.set({ [HISTORY_KEY]: next });
    } catch (_) { /* التخزين غير متاح — نتابع الطباعة */ }
    showMsg('تم فتح صفحة الطباعة بنجاح: ' + result.value, true);
    window.open(url, '_blank', 'noopener');
  }

  // ---------- نافذة سجل البحث العائمة (Ctrl+Shift+H) ----------
  let histOpen = false;
  let histListEl = null;

  function ensureHistoryUI() {
    ensureUI();
    const root = host.shadowRoot;
    if (root.querySelector('.hovl')) return;
    const css = document.createElement('style');
    css.textContent = `
      .hovl{position:fixed;top:0;left:0;right:0;bottom:0;z-index:2147483647;
        display:none;justify-content:center;padding-top:12vh;
        background:rgba(30,41,59,0.45);direction:rtl}
      .hovl.show{display:flex}
      .head-actions{display:flex;align-items:center;gap:8px}
      .icon-btn{background:none;border:none;cursor:pointer;color:#94a3b8;
        padding:4px;border-radius:4px;display:flex;align-items:center}
      .icon-btn:hover{color:#dc2626;background:rgba(220,38,38,0.08)}
      .hlist{max-height:260px;overflow-y:auto;border:1px solid #d5dae3;border-radius:5px}
      .hdate{background:#eef1f6;color:#dc3545;font-size:10.5px;font-weight:700;padding:6px 10px}
      .hrow{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;
        padding:7px 10px;cursor:pointer;border-bottom:1px solid #eef1f6;direction:rtl}
      .hrow:last-child{border-bottom:none}
      .hrow:hover{background:#e2e6ed}
      .hv{font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace;font-size:11.5px;font-weight:600;
        color:#1e293b;direction:ltr;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .ht{font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace;font-size:10.5px;color:#94a3b8;white-space:nowrap;text-align:left}
      .badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:12px;
        font-size:10px;font-weight:600;white-space:nowrap}
      .badge.phone{background:rgba(220,53,69,0.1);color:#dc3545;border:1px solid rgba(220,53,69,0.3)}
      .badge.tracking{background:#eef1f6;color:#475569;border:1px solid #d5dae3}
      .hprint{background:none;border:none;cursor:pointer;color:#94a3b8;padding:2px;border-radius:4px;
        display:flex;align-items:center;transition:all 0.2s}
      .hprint:hover{color:#16a34a;background:rgba(22,163,74,0.1)}
      .hprint svg{width:13px;height:13px}
      .hempty{text-align:center;color:#94a3b8;font-size:12px;padding:16px 10px}`;
    root.appendChild(css);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="hovl">
        <div class="box" role="dialog" aria-label="سجل بحث ياليدين">
          <div class="head">
            <div class="brand">
              <span class="logo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span>
              <span class="title">سجل بحث ياليدين</span>
            </div>
            <div class="head-actions">
              <button class="icon-btn hclear" type="button" title="مسح السجل" aria-label="مسح السجل"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/></svg></button>
              <span class="kbd">Ctrl + Shift + H</span>
            </div>
          </div>
          <div class="body">
            <div class="hlist"></div>
            <div class="hint">اضغط على أي سطر لإعادة البحث &nbsp;•&nbsp; أيقونة الطابعة تفتح القسيمة مباشرة &nbsp;•&nbsp; <b>Esc</b> للإغلاق</div>
          </div>
        </div>
      </div>`;
    const hovl = wrap.firstElementChild;
    root.appendChild(hovl);

    histListEl = hovl.querySelector('.hlist');
    hovl.addEventListener('mousedown', e => { if (e.target === hovl) closeHistory(); });
    hovl.querySelector('.hclear').addEventListener('click', async e => {
      e.preventDefault();
      e.stopPropagation();
      try { await chrome.storage.local.remove([HISTORY_KEY]); } catch (_) {}
      renderHistoryList();
    });
    histListEl.addEventListener('click', e => {
      const row = e.target.closest && e.target.closest('.hrow');
      if (!row || !row.dataset.value) return;
      e.preventDefault();
      doHistorySearch(row.dataset.value, row.dataset.type);
    });
    // Esc داخل النافذة + منع تسرب الأحداث للصفحة (طور الفقاعة فقط حتى لا نحجب submit)
    hovl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeHistory(); }
      else e.stopPropagation();
    }, false);
  }

  async function getHistory() {
    try {
      const data = await chrome.storage.local.get([HISTORY_KEY]);
      return Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
    } catch (_) { return []; }
  }

  async function renderHistoryList() {
    if (!histListEl) return;
    const history = await getHistory();
    histListEl.replaceChildren();
    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'hempty';
      empty.textContent = 'لا توجد عمليات بحث سابقة';
      histListEl.appendChild(empty);
      return;
    }
    let lastDay = null;
    history.forEach(item => {
      if (!item || !item.value) return;
      const day = new Date(item.timestamp).toDateString();
      if (day !== lastDay) {
        lastDay = day;
        const sep = document.createElement('div');
        sep.className = 'hdate';
        sep.textContent = dateLabel(item.timestamp);
        histListEl.appendChild(sep);
      }
      const row = document.createElement('div');
      row.className = 'hrow';
      row.dataset.value = item.value;
      row.dataset.type = item.type === 'phone' ? 'phone' : 'tracking';
      row.title = 'إعادة البحث';
      const val = document.createElement('span');
      val.className = 'hv';
      val.textContent = item.value;
      const badge = document.createElement('span');
      badge.className = 'badge ' + (item.type === 'phone' ? 'phone' : 'tracking');
      badge.textContent = item.type === 'phone' ? 'هاتف' : 'تتبع';
      const time = document.createElement('span');
      time.className = 'ht';
      time.textContent = formatTime(item.timestamp);
      row.append(val, badge);
      if (item.type !== 'phone') {
        const printBtn = document.createElement('button');
        printBtn.type = 'button';
        printBtn.className = 'hprint';
        printBtn.title = 'طباعة القسيمة';
        printBtn.setAttribute('aria-label', 'طباعة القسيمة');
        printBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
        printBtn.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          doHistoryPrint(item.value);
        });
        row.appendChild(printBtn);
      }
      row.appendChild(time);
      histListEl.appendChild(row);
    });
  }

  // إعادة البحث من السجل: نفس سلوك الضغط على سطر في الإضافة (يتصدر السجل ثم يفتح بنفس التبويب)
  async function doHistorySearch(value, type) {
    const t = type === 'phone' ? 'phone' : 'tracking';
    const url = buildSearchUrl(t, value);
    try {
      const history = (await getHistory()).filter(h => h && h.value !== value);
      history.unshift({ value, type: t, timestamp: Date.now() });
      await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, 50) });
    } catch (_) { /* التخزين غير متاح — نتابع البحث */ }
    location.href = url;
  }

  // طباعة من السجل: لأرقام التتبع فقط، تفتح رابط القسيمة مباشرة في تبويب جديد
  async function doHistoryPrint(value) {
    const url = `${BORDEREAU_URL}?tracking=${encodeURIComponent(value)}`;
    try {
      const history = (await getHistory()).filter(h => h && h.value !== value);
      history.unshift({ value, type: 'tracking', timestamp: Date.now() });
      await chrome.storage.local.set({ [HISTORY_KEY]: history.slice(0, 50) });
    } catch (_) { /* التخزين غير متاح — نتابع الطباعة */ }
    window.open(url, '_blank', 'noopener');
  }

  function openHistory() {
    ensureHistoryUI();
    if (isOpen) close();
    lastFocus = document.activeElement;
    host.shadowRoot.querySelector('.hovl').classList.add('show');
    histOpen = true;
    renderHistoryList();
  }

  function closeHistory() {
    if (!host) return;
    const hovl = host.shadowRoot.querySelector('.hovl');
    if (hovl) hovl.classList.remove('show');
    histOpen = false;
    try { if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  function toggleHistory() {
    if (histOpen) closeHistory();
    else openHistory();
  }

  // تحديث القائمة تلقائيًا إذا تغير السجل وهي مفتوحة
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[HISTORY_KEY] && histOpen) renderHistoryList();
    });
  } catch (_) { /* خارج سياق الإضافة */ }

  // ---------- الاختصار العام ----------
  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    // e.code يضمن عمل الاختصار مع أي لغة لوحة مفاتيح (عربي/فرنسي/إنجليزي)
    if (mod && e.shiftKey && (e.code === 'KeyF' || e.key?.toLowerCase() === 'f')) {
      if (!isTopFrame) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    } else if (mod && e.shiftKey && (e.code === 'KeyH' || e.key?.toLowerCase() === 'h')) {
      if (!isTopFrame) return;
      e.preventDefault();
      e.stopPropagation();
      toggleHistory();
    } else if (e.key === 'Escape' && isOpen) {
      close();
    } else if (e.key === 'Escape' && histOpen) {
      closeHistory();
    }
  }, true);

  // ---------- اعتراض زر البحث في موقع ياليدين (عند تفعيل "اختصار بحث ياليدين") ----------
  // الالتقاط المبكر + stopPropagation يمنع معالج onclick الأصلي (showModal) من العمل
  document.addEventListener('click', e => {
    if (!hijackEnabled || !isTopFrame || isOpen || histOpen) return;
    if (!isYalidineHost()) return;
    try {
      if (isYalidineSearchButton(e)) {
        e.preventDefault();
        e.stopPropagation();
        open();
      }
    } catch (_) { /* لا نكسر الصفحة أبدًا */ }
  }, true);

  // ---------- رسائل من background (زر الاختصار في chrome://commands) ----------
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg && msg.type === 'TOGGLE_QUICK_SEARCH') {
        if (!isTopFrame) return false;
        ensureUI();
        toggle();
        sendResponse({ success: true, open: isOpen });
      } else if (msg && msg.type === 'TOGGLE_HISTORY') {
        if (!isTopFrame) return false;
        ensureHistoryUI();
        toggleHistory();
        sendResponse({ success: true, open: histOpen });
      }
      return false;
    });
  } catch (_) { /* خارج سياق الإضافة */ }
})();
