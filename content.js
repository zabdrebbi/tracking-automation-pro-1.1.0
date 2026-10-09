// ===== TRACKING AUTOMATION PRO - CONTENT.JS =====
// الآلية: لكل رقم → اكتب في الحقل → اضغط Enter → انتظر حتى يفرغ الحقل → التالي
// الإرسال النهائي: يدوي من المستخدم (أو تلقائي إذا فُعِّل)

'use strict';

// ===== الاستماع للرسائل من popup.js =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {

        case 'PING':
          // التحقق من وجود حقل الإدخال في الصفحة
          const input = findTrackingInput();
          sendResponse({ ready: true, hasField: !!input });
          break;

        case 'INJECT_TRACKING':
          // إدخال رقم واحد ثم الضغط على Enter
          const result = await injectTracking(message.number);
          sendResponse(result);
          break;

        case 'FINAL_SUBMIT':
          // إرسال نهائي بعد إدخال كل الأرقام
          const submitResult = await triggerFinalSubmit();
          sendResponse(submitResult);
          break;

        case 'STOP':
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'نوع رسالة غير معروف' });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // رد غير متزامن
});

// ===== الدالة الرئيسية: إدخال رقم + Enter =====
async function injectTracking(trackingNumber) {
  const input = findTrackingInput();

  if (!input) {
    return { success: false, error: 'لم يتم العثور على حقل الإدخال #tracking' };
  }

  try {
    // 1. التأكد أن الحقل فارغ أولاً
    input.focus();
    await sleep(30);
    clearInputValue(input);
    await sleep(30);

    // 2. كتابة الرقم في الحقل
    await typeValue(input, trackingNumber);
    await sleep(60);

    // 3. التحقق أن القيمة ظهرت فعلاً في الحقل
    if (input.value !== trackingNumber) {
      // محاولة ثانية بطريقة مختلفة
      forceSetValue(input, trackingNumber);
      await sleep(60);
    }

    // 4. الضغط على Enter لإضافة الرقم للقائمة
    await pressEnter(input);

    // 5. انتظار حتى يفرغ الحقل (علامة نجاح الإضافة للقائمة)
    const cleared = await waitForFieldClear(input, 2000);

    return {
      success: true,
      fieldCleared: cleared, // هل أفرغت الصفحة الحقل تلقائياً؟
      time: Date.now(),
    };

  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== البحث عن حقل الإدخال =====
function findTrackingInput() {
  // البحث بالـ id أولاً (الأولوية القصوى)
  const byId = document.querySelector('#tracking');
  if (byId && isVisible(byId)) return byId;

  // بحث احتياطي بالـ name
  const byName = document.querySelector('input[name="tracking"]');
  if (byName && isVisible(byName)) return byName;

  // بحث بالـ placeholder
  const byPlaceholder = document.querySelector(
    'input[placeholder*="tracking" i], input[placeholder*="تتبع"], input[placeholder*="Tracking"]'
  );
  if (byPlaceholder && isVisible(byPlaceholder)) return byPlaceholder;

  return null;
}

// ===== التحقق من ظهور العنصر =====
function isVisible(el) {
  const s = window.getComputedStyle(el);
  return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 0;
}

// ===== مسح قيمة الحقل (متوافق مع React/Vue) =====
function clearInputValue(input) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, '');
  else input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ===== كتابة القيمة في الحقل (متوافق مع React/Vue/Angular) =====
async function typeValue(input, value) {
  // الطريقة الأفضل لدعم الأطر الحديثة
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;

  // إطلاق أحداث التغيير الضرورية
  input.dispatchEvent(new Event('input',  { bubbles: true, cancelable: true }));
  await sleep(15);
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
  await sleep(15);
}

// ===== تعيين القيمة بالقوة (طريقة احتياطية) =====
function forceSetValue(input, value) {
  // محاولة عبر execCommand (قديمة لكن تعمل على بعض الصفحات)
  input.focus();
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, value);

  // إذا لم تنجح
  if (!input.value) {
    input.value = value;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
  }
}

// ===== الضغط على Enter (المفتاح الذي يضيف الرقم للقائمة) =====
async function pressEnter(input) {
  const enterProps = {
    bubbles: true, cancelable: true,
    key: 'Enter', code: 'Enter', keyCode: 13, which: 13
  };

  input.dispatchEvent(new KeyboardEvent('keydown',  enterProps));
  await sleep(20);
  input.dispatchEvent(new KeyboardEvent('keypress', enterProps));
  await sleep(20);
  input.dispatchEvent(new KeyboardEvent('keyup',    enterProps));
}

// ===== انتظار إفراغ الحقل (تأكيد أن الصفحة استقبلت الرقم) =====
async function waitForFieldClear(input, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (input.value === '' || input.value === null) return true;
    await sleep(50);
  }
  // لم يُفرَغ الحقل تلقائياً — بعض الصفحات لا تفرغه، هذا طبيعي
  return false;
}

// ===== الإرسال النهائي (يُستدعى بعد إدخال كل الأرقام) =====
async function triggerFinalSubmit() {
  try {
    // البحث عن زر الإرسال بعدة طرق
    const submitBtn = findSubmitButton();
    if (submitBtn) {
      submitBtn.focus();
      await sleep(50);
      submitBtn.click();
      return { success: true, method: 'button_click' };
    }

    // إذا لم يوجد زر، محاولة إرسال الفورم مباشرة
    const input = findTrackingInput();
    const form = input?.closest('form');
    if (form) {
      form.requestSubmit?.() ?? form.submit();
      return { success: true, method: 'form_submit' };
    }

    return { success: false, error: 'لم يتم العثور على زر الإرسال' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== البحث عن زر الإرسال النهائي =====
function findSubmitButton() {
  // أولاً: زر submit داخل الفورم
  const input = findTrackingInput();
  const form = input?.closest('form');
  if (form) {
    const btn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (btn) return btn;
  }

  // ثانياً: بحث بالنص الشائع لأزرار الإرسال
  const allButtons = [...document.querySelectorAll('button, input[type="submit"], input[type="button"]')];
  const keywords = ['إرسال', 'submit', 'send', 'confirm', 'تأكيد', 'حفظ', 'save', 'ok', 'موافق', 'بحث', 'search'];
  
  for (const btn of allButtons) {
    const text = (btn.textContent || btn.value || btn.title || '').toLowerCase().trim();
    if (keywords.some(k => text.includes(k)) && isVisible(btn)) return btn;
  }

  // ثالثاً: أي زر submit في الصفحة
  const anySubmit = document.querySelector('button[type="submit"], input[type="submit"]');
  if (anySubmit && isVisible(anySubmit)) return anySubmit;

  return null;
}

// ===== مساعد: الانتظار =====
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('[Tracking Automation Pro] Content script loaded ✓');
