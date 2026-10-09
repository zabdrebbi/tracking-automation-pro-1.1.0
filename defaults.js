// ===== الاختصارات الافتراضية (مشتركة بين النافذة المنبثقة وسكربت الصفحة) =====
// uid: معرّف داخلي فريد لكل اختصار | abbr: الاختصار | text: النص الذي يُلصق
// fieldId: قيمة id لحقل الإدخال الذي يُقترح عنده النص (اختياري)
var TAP_DEFAULT_SHORTCUTS = [
  { uid: 'tracking-colis-yy', abbr: 'yy',   text: 'yal-', fieldId: 'tracking', isDefault: true },
  { uid: 'tracking-colis-YY', abbr: 'YY',   text: 'yal-', fieldId: 'keywords', isDefault: true },
  { uid: 'tracking-colis-cc', abbr: 'cc',   text: 'cmp-', fieldId: '',         isDefault: true },
  { uid: 'tracking-colis-CC', abbr: 'CC',   text: 'cmp-', fieldId: '',         isDefault: true },
  { uid: 'tracking-sac-ss',   abbr: 'ss',   text: 'sac-', fieldId: '',         isDefault: true },
  { uid: 'tracking-sac-SS',   abbr: 'SS',   text: 'sac-', fieldId: '',         isDefault: true },
]
