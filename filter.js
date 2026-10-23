// ===== TRACKING AUTOMATION PRO - FILTER.JS =====
// تبويب "تصفية ياليدين" في الإضافة: يبني نموذج التصفية من filter-core.js ويفتح النتيجة في تبويب جديد

(() => {
  'use strict';

  const mount = document.getElementById('ysFilterMount');
  if (!mount || !window.TAP_FILTER) return;

  window.TAP_FILTER.createUI(mount, {
    open: url => {
      try { chrome.tabs.create({ url }); } catch (_) { window.open(url, '_blank', 'noopener'); }
    },
  });
})();
