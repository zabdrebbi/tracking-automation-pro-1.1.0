// ===== TRACKING AUTOMATION PRO - SHORTCUTS-UI.JS =====
// مسؤول عن: التبديل بين التبويبين + إدارة الاختصارات (إضافة / تعديل / حذف / استعادة الافتراضية)

(() => {
  'use strict';

  const KEY = 'shortcuts';
  const TAB_KEY = 'activeTab';
  const byId = id => document.getElementById(id);

  const els = {
    tabs: document.querySelectorAll('.tab'),
    panels: { tracking: byId('tab-tracking'), shortcuts: byId('tab-shortcuts') },
    formTitle: byId('scFormTitle'),
    abbr: byId('scAbbr'),
    fieldId: byId('scFieldId'),
    text: byId('scText'),
    save: byId('scSaveBtn'),
    cancel: byId('scCancelBtn'),
    reset: byId('scResetBtn'),
    error: byId('scError'),
    body: byId('scTableBody'),
    count: byId('scCount'),
  };

  let list = [];
  let editingUid = null;

  const toast = msg => { if (typeof showToast === 'function') showToast(msg); };
  const genUid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const cloneDefaults = () => TAP_DEFAULT_SHORTCUTS.map(s => ({ ...s }));

  // ---------- التبويبات ----------
  function selectTab(name) {
    if (!els.panels[name]) name = 'tracking';
    els.tabs.forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.tab === name)));
    Object.entries(els.panels).forEach(([key, panel]) => { panel.hidden = key !== name; });
    chrome.storage.local.set({ [TAB_KEY]: name });
  }

  // ---------- التخزين ----------
  async function load() {
    const data = await chrome.storage.local.get([KEY, TAB_KEY]);
    if (Array.isArray(data[KEY])) {
      list = data[KEY];
    } else {
      list = cloneDefaults();            // أول تشغيل: نحفظ الافتراضية
      await persist();
    }
    return data[TAB_KEY];
  }

  const persist = () => chrome.storage.local.set({ [KEY]: list });

  // ---------- العرض ----------
  function iconBtn(cls, title, svg, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn ' + cls;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg; // أيقونات ثابتة فقط
    b.addEventListener('click', onClick);
    return b;
  }

  const EDIT_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  const DEL_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/></svg>';

  function cell(cls, text, title) {
    const td = document.createElement('td');
    td.className = cls;
    td.textContent = text;
    if (title) td.title = title;
    return td;
  }

  function render() {
    els.body.replaceChildren();
    els.count.textContent = list.length ? String(list.length) : '';

    if (!list.length) {
      const tr = document.createElement('tr');
      const td = cell('sc-empty', 'لا توجد اختصارات. أضف أول اختصار من النموذج أعلاه.');
      td.colSpan = 4;
      tr.appendChild(td);
      els.body.appendChild(tr);
      return;
    }

    list.forEach(sc => {
      const tr = document.createElement('tr');
      if (sc.uid === editingUid) tr.className = 'editing';

      const tdAbbr = cell('cell-abbr', sc.abbr, sc.abbr);
      if (sc.isDefault) {
        const badge = document.createElement('div');
        badge.className = 'badge badge-default';
        badge.textContent = 'افتراضي';
        tdAbbr.appendChild(badge);
        tdAbbr.style.overflow = 'visible';
      }

      const tdActions = document.createElement('td');
      tdActions.className = 'cell-actions';
      const wrap = document.createElement('div');
      wrap.className = 'sc-actions-wrap';
      wrap.append(
        iconBtn('edit', 'تعديل', EDIT_SVG, () => startEdit(sc.uid)),
        iconBtn('del', 'حذف', DEL_SVG, () => remove(sc.uid))
      );
      tdActions.appendChild(wrap);

      tr.append(
        tdAbbr,
        cell('cell-text', sc.text.replace(/\s+/g, ' '), sc.text),
        cell('cell-id', sc.fieldId || '—', sc.fieldId ? 'id="' + sc.fieldId + '"' : ''),
        tdActions
      );
      els.body.appendChild(tr);
    });
  }

  // ---------- النموذج ----------
  function showError(msg) { els.error.textContent = msg || ''; }

  function resetForm() {
    editingUid = null;
    els.abbr.value = '';
    els.fieldId.value = '';
    els.text.value = '';
    els.formTitle.textContent = 'إضافة اختصار';
    els.save.textContent = 'إضافة';
    els.cancel.hidden = true;
    showError('');
  }

  function startEdit(uid) {
    const sc = list.find(s => s.uid === uid);
    if (!sc) return;
    editingUid = uid;
    els.abbr.value = sc.abbr;
    els.fieldId.value = sc.fieldId || '';
    els.text.value = sc.text;
    els.formTitle.textContent = 'تعديل الاختصار';
    els.save.textContent = 'حفظ التعديل';
    els.cancel.hidden = false;
    showError('');
    render();
    window.scrollTo({ top: 0 });
    els.text.focus();
  }

  // الاختصار لا يحتوي مسافات، ولا يكون بدايةً لاختصار آخر (وإلا لن يمكن كتابة الأطول)
  function validate(abbr, text) {
    if (!abbr) return 'اكتب الاختصار أولًا.';
    if (/\s/.test(abbr)) return 'الاختصار لا يجوز أن يحتوي على مسافات.';
    if (!text.trim()) return 'اكتب النص الذي سيُلصق.';
    for (const s of list) {
      if (s.uid === editingUid) continue;
      if (s.abbr === abbr) return 'هذا الاختصار مستخدم مسبقًا.';
      if (s.abbr.startsWith(abbr) || abbr.startsWith(s.abbr)) {
        return `يتعارض مع الاختصار «${s.abbr}»: أحدهما يبدأ بالآخر. غيّر أحدهما.`;
      }
    }
    return '';
  }

  async function save() {
    const abbr = els.abbr.value.trim();
    const text = els.text.value;
    const fieldId = els.fieldId.value.trim().replace(/^#/, '');

    const err = validate(abbr, text);
    if (err) { showError(err); return; }

    if (editingUid) {
      const sc = list.find(s => s.uid === editingUid);
      if (sc) Object.assign(sc, { abbr, text, fieldId });
    } else {
      list.push({ uid: genUid(), abbr, text, fieldId, isDefault: false });
    }

    await persist();
    const wasEditing = !!editingUid;
    resetForm();
    render();
    toast(wasEditing ? 'تم حفظ التعديل' : 'تمت إضافة الاختصار');
  }

  async function remove(uid) {
    const sc = list.find(s => s.uid === uid);
    if (!sc || !confirm(`حذف الاختصار «${sc.abbr}»؟`)) return;
    list = list.filter(s => s.uid !== uid);
    if (editingUid === uid) resetForm();
    await persist();
    render();
    toast('تم الحذف');
  }

  async function restoreDefaults() {
    if (!confirm('استعادة الاختصارات الافتراضية؟ ستعود الافتراضية لنصها الأصلي، وتبقى اختصاراتك الخاصة كما هي.')) return;
    TAP_DEFAULT_SHORTCUTS.forEach(def => {
      const i = list.findIndex(s => s.uid === def.uid);
      if (i !== -1) { list[i] = { ...def }; return; }
      // لا نضيف الافتراضي إذا كان اختصاره يتعارض مع اختصار خاص بالمستخدم
      const clash = list.some(s => s.abbr.startsWith(def.abbr) || def.abbr.startsWith(s.abbr));
      if (!clash) list.push({ ...def });
    });
    resetForm();
    await persist();
    render();
    toast('تمت استعادة الاختصارات الافتراضية');
  }

  // ---------- تشغيل ----------
  async function init() {
    els.tabs.forEach(btn => btn.addEventListener('click', () => selectTab(btn.dataset.tab)));
    els.save.addEventListener('click', save);
    els.cancel.addEventListener('click', () => { resetForm(); render(); });
    els.reset.addEventListener('click', restoreDefaults);
    els.text.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
    });
    [els.abbr, els.fieldId].forEach(inp => inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
    }));

    const lastTab = await load();
    render();
    selectTab(lastTab === 'shortcuts' ? 'shortcuts' : 'tracking');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
