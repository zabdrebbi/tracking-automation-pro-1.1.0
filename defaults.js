// ===== الاختصارات الافتراضية (مشتركة بين النافذة المنبثقة وسكربت الصفحة) =====
// uid: معرّف داخلي ثابت | abbr: الاختصار | text: النص الذي يُلصق
// fieldId: قيمة id لحقل الإدخال الذي يُقترح عنده النص (اختياري)
var TAP_DEFAULT_SHORTCUTS = [
  { uid: 'tracking colis', abbr: 'yy',   text: 'yal-', fieldId: 'tracking', isDefault: true },
  { uid: 'tracking colis', abbr: 'YY',   text: 'yal-', fieldId: 'keywords', isDefault: true },
  { uid: 'tracking colis', abbr: 'cc',   text: 'cmp-', fieldId: '', isDefault: true },
  { uid: 'tracking colis', abbr: 'CC',   text: 'cmp-', fieldId: '', isDefault: true },
  { uid: 'tracking sac',    abbr: 'ss',  text: 'sac-', fieldId: '',         isDefault: true },
  { uid: 'tracking sac',    abbr: 'SS',  text: 'sac-', fieldId: '',         isDefault: true },
]