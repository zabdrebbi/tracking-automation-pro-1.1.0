// ===== TRACKING AUTOMATION PRO - POPUP.JS =====
// مسؤول عن: واجهة المستخدم، تحليل الأرقام، إدارة القائمة، التواصل مع content.js

'use strict';

// ===== الحالة العامة =====
const state = {
  trackingNumbers: [],      // قائمة كل الأرقام
  queue: [],                // قائمة الانتظار (غير المعالجة)
  processed: [],            // المعالجة
  errors: [],               // الأخطاء
  isRunning: false,
  isPaused: false,
  currentIndex: 0,
  delay: 1500,
  autoSubmit: false,         // إرسال نهائي بعد إدخال كل الأرقام (وليس بعد كل رقم)
  tabId: null,
  processingTimer: null,
};

// ===== عناصر الواجهة =====
const $ = id => document.getElementById(id);
const ui = {
  textarea: $('trackingInput'),
  excelInput: $('excelInput'),
  startBtn: $('startBtn'),
  pauseBtn: $('pauseBtn'),
  stopBtn: $('stopBtn'),
  clearBtn: $('clearBtn'),
  autoSubmit: $('autoSubmit'),
  delayInput: $('delayInput'),
  logTableBody: $('logTableBody'),
  logSection: $('logSection'),
  progressSection: $('progressSection'),
  progressBar: $('progressBar'),
  progressText: $('progressText'),
  totalCount: $('totalCount'),
  processedCount: $('processedCount'),
  remainingCount: $('remainingCount'),
  errorCount: $('errorCount'),
  currentItem: $('currentItem'),
  currentNumber: $('currentNumber'),
  clearLogBtn: $('clearLogBtn'),
  connectionStatus: $('connectionStatus'),
};

// ===== تهيئة الإضافة =====
async function init() {
  loadSettings();
  bindEvents();
  await checkConnection();
  await restoreAutomationState();

  // استماع لرسائل content.js
  chrome.runtime.onMessage.addListener(handleContentMessage);

  // اختصارات لوحة المفاتيح
  chrome.commands?.onCommand?.addListener(cmd => {
    if (cmd === 'start-automation') handleStart();
    if (cmd === 'pause-automation') handlePause();
  });
}

// ===== حفظ حالة الأتمتة =====
function saveAutomationState() {
  chrome.storage.local.set({
    automationState: {
      isRunning: state.isRunning,
      isPaused: state.isPaused,
      queue: state.queue,
      processed: state.processed,
      errors: state.errors,
      trackingNumbers: state.trackingNumbers,
      currentIndex: state.currentIndex,
      delay: state.delay,
      autoSubmit: state.autoSubmit,
      tabId: state.tabId,
    }
  });
}

// ===== استعادة حالة الأتمتة =====
async function restoreAutomationState() {
  return new Promise(resolve => {
    chrome.storage.local.get(['automationState'], data => {
      const s = data.automationState;
      if (!s || (!s.isRunning && !s.isPaused)) {
        resolve();
        return;
      }

      state.isRunning = s.isRunning;
      state.isPaused = s.isPaused;
      state.queue = s.queue || [];
      state.processed = s.processed || [];
      state.errors = s.errors || [];
      state.trackingNumbers = s.trackingNumbers || [];
      state.currentIndex = s.currentIndex || 0;
      state.delay = s.delay || 1500;
      state.autoSubmit = s.autoSubmit || false;
      state.tabId = s.tabId;

      ui.delayInput.value = state.delay;
      ui.autoSubmit.checked = state.autoSubmit;

      // إعادة بناء الواجهة
      initQueueRows();
      // تحديث حالة الصفوف المعالجة سابقاً
      state.processed.forEach((num, i) => {
        const idx = state.trackingNumbers.indexOf(num);
        if (idx !== -1) updateRowStatus(idx, 'inserted');
      });
      state.errors.forEach((num, i) => {
        const idx = state.trackingNumbers.indexOf(num);
        if (idx !== -1) updateRowStatus(idx, 'error');
      });

      showProgressUI();
      updateStats();

      if (state.isRunning && !state.isPaused) {
        setButtonState('running');
        processNext();
      } else if (state.isRunning && state.isPaused) {
        setButtonState('running');
        ui.pauseBtn.textContent = '▶ استئناف';
        ui.currentItem.style.display = 'none';
      }

      resolve();
    });
  });
}

// ===== مسح حالة الأتمتة =====
function clearAutomationState() {
  chrome.storage.local.remove('automationState');
}

// ===== التحقق من الاتصال بالصفحة =====
async function checkConnection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    state.tabId = tab.id;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' }).catch(() => null);
    if (response?.ready) {
      ui.connectionStatus.className = 'status-indicator connected';
      ui.connectionStatus.querySelector('.status-label').textContent = 'متصل';
    } else {
      ui.connectionStatus.className = 'status-indicator error';
      ui.connectionStatus.querySelector('.status-label').textContent = 'غير متصل';
    }
  } catch {
    ui.connectionStatus.className = 'status-indicator error';
    ui.connectionStatus.querySelector('.status-label').textContent = 'خطأ';
  }
}

// ===== ربط الأحداث =====
function bindEvents() {
  ui.startBtn.addEventListener('click', handleStart);
  ui.pauseBtn.addEventListener('click', handlePause);
  ui.stopBtn.addEventListener('click', handleStop);
  ui.clearBtn.addEventListener('click', handleClear);
  ui.clearLogBtn.addEventListener('click', clearLog);
  ui.excelInput.addEventListener('change', handleExcelImport);
  ui.delayInput.addEventListener('change', () => {
    state.delay = Math.max(200, parseInt(ui.delayInput.value) || 1500);
    saveSettings();
  });
  ui.autoSubmit.addEventListener('change', () => {
    state.autoSubmit = ui.autoSubmit.checked;
    saveSettings();
  });
}

// ===== تحميل الإعدادات =====
function loadSettings() {
  chrome.storage.local.get(['delay', 'autoSubmit'], data => {
    if (data.delay) {
      state.delay = data.delay;
      ui.delayInput.value = data.delay;
    }
    if (data.autoSubmit) {
      state.autoSubmit = data.autoSubmit;
      ui.autoSubmit.checked = data.autoSubmit;
    }
  });
}

// ===== حفظ الإعدادات =====
function saveSettings() {
  chrome.storage.local.set({ delay: state.delay, autoSubmit: state.autoSubmit });
}

// ===== تحليل أرقام التتبع من النص =====
function parseTrackingNumbers(text) {
  if (!text?.trim()) return [];
  
  // تقسيم بناءً على: سطر جديد، مسافة، فاصلة، تاب، فاصلة منقوطة
  const raw = text.split(/[\n\r\s,;\t]+/);
  
  // تنظيف وإزالة المكررات والفارغة
  const unique = [...new Set(
    raw
      .map(n => n.trim())
      .filter(n => n.length >= 3)
  )];
  
  return unique;
}

// ===== استيراد Excel =====
async function handleExcelImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const numbers = rows
      .flat()
      .map(v => String(v ?? '').trim())
      .filter(v => v.length >= 3)
      .slice(0, 1000); // حد أقصى 1000 رقم

    if (numbers.length === 0) {
      alert('لم يتم العثور على أرقام تتبع في الملف');
      return;
    }

    // إضافة للـ textarea
    const existing = ui.textarea.value.trim();
    ui.textarea.value = existing
      ? existing + '\n' + numbers.join('\n')
      : numbers.join('\n');

    showToast(`تم استيراد ${numbers.length} رقم تتبع`);
  } catch (err) {
    alert('خطأ في قراءة ملف Excel: ' + err.message);
  } finally {
    e.target.value = '';
  }
}

// ===== بدء التشغيل =====
async function handleStart() {
  if (state.isRunning && !state.isPaused) return;

  // إذا كان مستأنفًا بعد إيقاف مؤقت
  if (state.isPaused) {
    state.isPaused = false;
    setButtonState('running');
    saveAutomationState();
    processNext();
    return;
  }

  // تحليل الأرقام
  const numbers = parseTrackingNumbers(ui.textarea.value);
  if (numbers.length === 0) {
    alert('الرجاء إدخال أرقام التتبع أولًا');
    return;
  }

  // التحقق من الاتصال
  await checkConnection();
  if (!state.tabId) {
    alert('لا يوجد اتصال بالصفحة');
    return;
  }

  // تهيئة الحالة
  state.trackingNumbers = numbers.slice(0, 1000);
  state.queue = [...state.trackingNumbers];
  state.processed = [];
  state.errors = [];
  state.currentIndex = 0;
  state.isRunning = true;
  state.isPaused = false;
  state.delay = Math.max(200, parseInt(ui.delayInput.value) || 1500);
  state.autoSubmit = ui.autoSubmit.checked;

  // إعداد الواجهة
  clearLog();
  initQueueRows();
  showProgressUI();
  setButtonState('running');
  updateStats();
  saveAutomationState();

  processNext();
}

// ===== إيقاف مؤقت =====
function handlePause() {
  if (!state.isRunning) return;

  if (!state.isPaused) {
    state.isPaused = true;
    clearTimeout(state.processingTimer);
    state.processingTimer = null;
    ui.pauseBtn.textContent = '▶ استئناف';
    ui.currentItem.style.display = 'none';
    saveAutomationState();
  } else {
    state.isPaused = false;
    ui.pauseBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> إيقاف مؤقت`;
    saveAutomationState();
    processNext();
  }
}

// ===== إيقاف كامل =====
function handleStop() {
  clearTimeout(state.processingTimer);
  state.processingTimer = null;
  state.isRunning = false;
  state.isPaused = false;
  state.queue = [];

  // إخبار content.js بالإيقاف
  sendToContent({ type: 'STOP' });

  setButtonState('idle');
  ui.currentItem.style.display = 'none';
  clearAutomationState();

  showToast(`توقف. تم معالجة ${state.processed.length} / ${state.trackingNumbers.length}`);
}

// ===== مسح القائمة =====
function handleClear() {
  handleStop();
  state.trackingNumbers = [];
  ui.textarea.value = '';
  clearLog();
  ui.progressSection.style.display = 'none';
  ui.logSection.style.display = 'none';
  ui.currentItem.style.display = 'none';
}

// ===== المعالجة الرئيسية =====
async function processNext() {
  if (!state.isRunning || state.isPaused) return;
  if (state.queue.length === 0) {
    onComplete();
    return;
  }

  const trackingNum = state.queue.shift();
  const index = state.currentIndex;
  state.currentIndex++;

  // تحديث العرض الحالي
  ui.currentNumber.textContent = trackingNum;
  ui.currentItem.style.display = 'flex';
  updateRowStatus(index, 'processing');

  try {
    // إرسال الرقم لـ content.js — يكتب الرقم ثم يضغط Enter
    const result = await sendToContent({
      type: 'INJECT_TRACKING',
      number: trackingNum,
      // لا نمرر autoSubmit هنا — الإرسال يكون بعد كل الأرقام فقط
    });

    if (result?.success) {
      state.processed.push(trackingNum);
      updateRowStatus(index, 'inserted', result.time);
    } else {
      throw new Error(result?.error || 'فشل الإدخال');
    }
  } catch (err) {
    state.errors.push(trackingNum);
    updateRowStatus(index, 'error', null);
    console.error('خطأ في رقم', trackingNum, err);
  }

  updateStats();
  saveAutomationState();

  // جدولة الرقم التالي بعد التأخير المحدد
  state.processingTimer = setTimeout(processNext, state.delay);
}

// ===== إرسال رسالة لـ content.js =====
function sendToContent(message) {
  return new Promise((resolve) => {
    if (!state.tabId) { resolve({ success: false, error: 'لا يوجد تبويب' }); return; }
    chrome.tabs.sendMessage(state.tabId, message, response => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// ===== معالجة رسائل content.js =====
function handleContentMessage(msg) {
  if (msg.type === 'STATUS_UPDATE') {
    // أي تحديث من الصفحة
  }
}

// ===== اكتمال إدخال كل الأرقام =====
async function onComplete() {
  state.isRunning = false;
  setButtonState('idle');
  ui.currentItem.style.display = 'none';
  updateStats();
  clearAutomationState();

  // إرسال نهائي إذا كان الخيار مفعلاً
  if (state.autoSubmit && state.processed.length > 0) {
    showToast('⏳ جاري الإرسال النهائي...');
    await new Promise(r => setTimeout(r, 400)); // انتظار قصير
    const submitResult = await sendToContent({ type: 'FINAL_SUBMIT' });
    if (submitResult?.success) {
      showToast(`✓ تم الإرسال النهائي! ${state.processed.length} تتبع.`);
    } else {
      showToast(`⚠️ اكتمل الإدخال لكن الإرسال النهائي فشل — اضغط الزر يدوياً`);
    }
  } else {
    const msg = state.autoSubmit
      ? `✓ اكتمل الإدخال (${state.processed.length} ناجح، ${state.errors.length} خطأ) — اضغط إرسال`
      : `✓ اكتمل الإدخال: ${state.processed.length} ناجح، ${state.errors.length} خطأ`;
    showToast(msg);
  }
}

// ===== تهيئة صفوف الجدول =====
function initQueueRows() {
  ui.logTableBody.innerHTML = '';
  state.trackingNumbers.forEach((num, i) => {
    const tr = document.createElement('tr');
    tr.id = `row-${i}`;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td style="direction:ltr">${escapeHtml(num)}</td>
      <td><span class="badge badge-pending">انتظار</span></td>
      <td>—</td>
    `;
    ui.logTableBody.appendChild(tr);
  });
}

// ===== تحديث حالة صف =====
function updateRowStatus(index, status, time) {
  const tr = $(`row-${index}`);
  if (!tr) return;

  const labels = {
    processing: ['processing', 'يُعالَج'],
    inserted:   ['inserted', 'أُدخل'],
    submitted:  ['submitted', 'أُرسل'],
    error:      ['error', 'خطأ'],
  };

  const [cls, label] = labels[status] || ['pending', 'انتظار'];
  tr.className = `status-${cls}`;
  tr.cells[2].innerHTML = `<span class="badge badge-${cls}">${label}</span>`;
  tr.cells[3].textContent = time
    ? new Date(time).toLocaleTimeString('ar-SA', { hour12: false })
    : (status === 'error' ? '✗' : '—');

  // التمرير للصف الحالي
  if (status === 'processing') {
    tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// ===== تحديث الإحصائيات =====
function updateStats() {
  const total = state.trackingNumbers.length;
  const done = state.processed.length + state.errors.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  ui.totalCount.textContent = total;
  ui.processedCount.textContent = state.processed.length;
  ui.remainingCount.textContent = Math.max(0, total - done);
  ui.errorCount.textContent = state.errors.length;
  ui.progressBar.style.width = pct + '%';
  ui.progressText.textContent = `${done} / ${total}`;
}

// ===== عرض قسم التقدم =====
function showProgressUI() {
  ui.progressSection.style.display = 'block';
  ui.logSection.style.display = 'block';
}

// ===== مسح السجل =====
function clearLog() {
  ui.logTableBody.innerHTML = '';
}

// ===== حالة الأزرار =====
function setButtonState(mode) {
  if (mode === 'running') {
    document.body.classList.add('running');
    ui.startBtn.disabled = true;
    ui.pauseBtn.disabled = false;
    ui.stopBtn.disabled = false;
    ui.startBtn.textContent = '⏳ يعمل...';
  } else {
    document.body.classList.remove('running');
    ui.startBtn.disabled = false;
    ui.pauseBtn.disabled = true;
    ui.stopBtn.disabled = true;
    ui.startBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> بدء`;
    ui.pauseBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> إيقاف مؤقت`;
  }
}

// ===== إشعار مؤقت =====
function showToast(msg) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:12px; left:50%; transform:translateX(-50%);
    background:#ffffff; color:#1e293b; border:1px solid #d5dae3;
    padding:8px 16px; border-radius:6px; font-size:12px; z-index:999;
    box-shadow:0 4px 20px rgba(0,0,0,0.08); white-space:nowrap;
    font-family:'Cairo',sans-serif; direction:rtl;
    animation: fadeIn 0.2s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== مساعد XSS =====
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===== تشغيل =====
document.addEventListener('DOMContentLoaded', init);
