// ===== TRACKING AUTOMATION PRO - SHORTCUTS.JS =====
// يعمل في كل المواقع (وفي الإطارات الداخلية):
//  1) توسيع الاختصار: عند كتابة الاختصار في أي خانة كتابة يُستبدل بالنص المحفوظ
//  2) الاقتراح: إذا كان id الحقل = fieldId لاختصار، يظهر اقتراح والضغط على Tab يلصق النص

(() => {
  'use strict';
  if (window.__tapShortcutsLoaded) return;
  window.__tapShortcutsLoaded = true;

  const STORAGE_KEY = 'shortcuts';
  let shortcuts = TAP_DEFAULT_SHORTCUTS.slice();

  // ---------- تحميل الاختصارات والاستماع للتغييرات ----------
  function applyList(v) {
    shortcuts = Array.isArray(v)
      ? v.filter(s => s && typeof s.text === 'string')
      : TAP_DEFAULT_SHORTCUTS.slice();
  }
  try {
    chrome.storage.local.get([STORAGE_KEY], d => applyList(d && d[STORAGE_KEY]));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) applyList(changes[STORAGE_KEY].newValue);
    });
  } catch (_) { /* سياق الإضافة لم يعد صالحًا (بعد إعادة التحميل) */ }

  // ---------- أدوات مساعدة ----------
  const TEXT_TYPES = new Set(['', 'text', 'search', 'url', 'tel', 'email']);

  function isTextField(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
    if (el instanceof HTMLInputElement) {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return TEXT_TYPES.has(type) && !el.readOnly && !el.disabled;
    }
    return false;
  }
  const isEditableHost = el => !!el && el.nodeType === 1 && el.isContentEditable;
  const isTarget = el => isTextField(el) || isEditableHost(el);
  const targetOf = e => (e.composedPath && e.composedPath()[0]) || e.target;

  function isEmpty(el) {
    return isTextField(el) ? el.value === '' : (el.textContent || '').trim() === '';
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
  }

  // استبدال جزء من قيمة الحقل (متوافق مع React/Vue/Angular)
  function replaceRange(el, start, end, text) {
    const v = el.value;
    setNativeValue(el, v.slice(0, start) + text + v.slice(end));
    const pos = start + text.length;
    try { el.setSelectionRange(pos, pos); } catch (_) { /* email وغيره */ }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // أطول اختصار ينتهي به النص قبل المؤشر، بشرط أن يسبقه بداية السطر أو مسافة
  function findMatch(before) {
    let best = null;
    for (const s of shortcuts) {
      const a = s.abbr;
      if (!a || !before.endsWith(a)) continue;
      const prev = before.charAt(before.length - a.length - 1);
      if (prev && !/\s/.test(prev)) continue;
      if (!best || a.length > best.abbr.length) best = s;
    }
    return best;
  }

  // ---------- 1) توسيع الاختصار أثناء الكتابة ----------
  function onInput(e) {
    const el = targetOf(e);
    // نتجاهل الأحداث غير الموثوقة (مثل حقن أرقام التتبع من الأتمتة) ولصق/حذف
    if (e.isTrusted && !e.isComposing && e.inputType === 'insertText' && shortcuts.length) {
      try {
        if (isTextField(el)) expandInField(el);
        else if (isEditableHost(el)) expandInEditable();
      } catch (_) { /* لا نكسر الصفحة أبدًا */ }
    }
    refreshTip(el);
  }

  function expandInField(el) {
    const caret = el.selectionStart; // null في بعض الأنواع مثل email
    const end = caret == null ? el.value.length : caret;
    const before = el.value.slice(0, end);
    const sc = findMatch(before);
    if (!sc) return;
    replaceRange(el, before.length - sc.abbr.length, end, sc.text);
  }

  function expandInEditable() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
    const r = sel.getRangeAt(0);
    const node = r.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
    const sc = findMatch(node.data.slice(0, r.startOffset));
    if (!sc) return;
    const rg = document.createRange();
    rg.setStart(node, r.startOffset - sc.abbr.length);
    rg.setEnd(node, r.startOffset);
    sel.removeAllRanges();
    sel.addRange(rg);
    document.execCommand('insertText', false, sc.text);
  }

  // ---------- 2) اقتراح اللصق حسب id الحقل + Tab ----------
  let tipHost = null, tip = null, tipText = null;
  let activeEl = null, activeSc = null, dismissedEl = null;

  function ensureTip() {
    if (tipHost) return;
    tipHost = document.createElement('div');
    tipHost.style.cssText = 'all:initial;position:fixed;top:0;left:0;z-index:2147483647;';
    const root = tipHost.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        .tip{position:fixed;display:none;align-items:center;gap:8px;max-width:340px;
          background:#1e293b;color:#fff;font:500 12px/1.4 system-ui,"Segoe UI",Tahoma,sans-serif;
          padding:6px 10px;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none}
        .tip.show{display:flex}
        kbd{flex:none;font:600 11px ui-monospace,Consolas,monospace;background:#dc3545;color:#fff;
          border-radius:4px;padding:2px 6px}
        .lbl{flex:none;opacity:.7}
        .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;unicode-bidi:plaintext}
      </style>
      <div class="tip"><kbd>Tab</kbd><span class="lbl">coller</span><span class="t"></span></div>`;
    tip = root.querySelector('.tip');
    tipText = root.querySelector('.t');
    document.documentElement.appendChild(tipHost);
  }

  function positionTip() {
    if (!tip || !activeEl) return;
    const r = activeEl.getBoundingClientRect();
    const h = tip.offsetHeight || 28;
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 4) top = Math.max(4, r.top - h - 4);
    const left = Math.min(Math.max(4, r.left), Math.max(4, window.innerWidth - (tip.offsetWidth || 200) - 4));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
  }

  function hideTip() {
    activeEl = null;
    activeSc = null;
    if (tip) tip.classList.remove('show');
  }

  function refreshTip(el) {
    if (!el || !shortcuts.length || !isTarget(el) || !isEmpty(el) || dismissedEl === el) { hideTip(); return; }
    const id = (el.id || '').trim().toLowerCase();
    if (!id) { hideTip(); return; }
    const sc = shortcuts.find(s => s.fieldId && s.fieldId.trim().toLowerCase() === id && s.text);
    if (!sc) { hideTip(); return; }
    ensureTip();
    activeEl = el;
    activeSc = sc;
    const preview = sc.text.replace(/\s+/g, ' ').trim();
    tipText.textContent = preview.length > 60 ? preview.slice(0, 60) + '…' : preview;
    tip.classList.add('show');
    positionTip();
  }

  function pasteInto(el, text) {
    if (isTextField(el)) {
      el.focus();
      replaceRange(el, 0, el.value.length, text);
    } else {
      el.focus();
      document.execCommand('insertText', false, text);
    }
  }

  function onKeyDown(e) {
    if (!activeEl || !activeSc) return;
    const el = targetOf(e);
    if (el !== activeEl) return;
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && isEmpty(activeEl)) {
      e.preventDefault();
      e.stopPropagation();
      const target = activeEl, text = activeSc.text;
      hideTip();
      pasteInto(target, text);
    } else if (e.key === 'Escape') {
      dismissedEl = activeEl;
      hideTip();
    }
  }

  document.addEventListener('input', onInput, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('focusin', e => {
    const el = targetOf(e);
    if (dismissedEl && dismissedEl !== el) dismissedEl = null;
    refreshTip(el);
  }, true);
  document.addEventListener('focusout', () => { dismissedEl = null; hideTip(); }, true);
  window.addEventListener('scroll', positionTip, true);
  window.addEventListener('resize', positionTip);
})();
