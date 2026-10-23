// ===== TRACKING AUTOMATION PRO - BACKGROUND.JS =====
// معالج أوامر لوحة المفاتيح (chrome://extensions/shortcuts):
//  - Ctrl+Shift+F => فتح نافذة بحث ياليدين السريعة فوق الصفحة الحالية
//  - Ctrl+Shift+H => فتح نافذة سجل بحث ياليدين فوق الصفحة الحالية
//  - Ctrl+Shift+S => فتح نافذة تصفية ياليدين فوق الصفحة الحالية

'use strict';

const COMMAND_TO_MESSAGE = {
  'open-yalidine-search': 'TOGGLE_QUICK_SEARCH',
  'open-yalidine-history': 'TOGGLE_HISTORY',
  'open-yalidine-filter': 'TOGGLE_FILTER',
};

const COMMAND_SCRIPTS = {
  'open-yalidine-filter': ['filter-core.js', 'quick-filter.js'],
};
const DEFAULT_SCRIPTS = ['quick-search.js'];

// فتح عدة تبويبات من سكربت المحتوى (البحث المتعدد بعدة أرقام تتبع)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'OPEN_TABS' && Array.isArray(msg.urls)) {
    const urls = msg.urls.filter(u => typeof u === 'string' && /^https:\/\//i.test(u)).slice(0, 30);
    urls.forEach(url => {
      try { chrome.tabs.create({ url }); } catch (_) { /* تجاهل */ }
    });
    sendResponse({ success: true, opened: urls.length });
  }
  return false;
});

chrome.commands?.onCommand.addListener(async (command) => {
  const msgType = COMMAND_TO_MESSAGE[command];
  if (!msgType) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // 1) محاولة إرسال أمر للـ content script الموجود مسبقًا
    try {
      await chrome.tabs.sendMessage(tab.id, { type: msgType });
      return;
    } catch (_) { /* السكربت غير محقون بعد — نحقنه */ }

    // 2) حقن السكربت ثم إعادة المحاولة (يفيد في التبويبات المفتوحة قبل التحديث)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: COMMAND_SCRIPTS[command] || DEFAULT_SCRIPTS,
      });
      await chrome.tabs.sendMessage(tab.id, { type: msgType });
    } catch (_) {
      // صفحات خاصة (chrome://, edge://, متجر الإضافات): لا يمكن الحقن —
      // نفتح صفحة ياليدين مباشرة كحل بديل
      chrome.tabs.create({ url: 'https://yalidine.app/app/colis/index.php' });
    }
  } catch (_) { /* تجاهل */ }
});
