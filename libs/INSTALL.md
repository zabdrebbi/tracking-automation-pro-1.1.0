# تثبيت مكتبة SheetJS

لتفعيل ميزة استيراد Excel، يجب إضافة مكتبة SheetJS:

## الطريقة 1: التنزيل المباشر
1. افتح الرابط: https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js
2. احفظ المحتوى في ملف: `libs/xlsx.full.min.js`

## الطريقة 2: عبر npm
```bash
npm install xlsx
cp node_modules/xlsx/dist/xlsx.full.min.js libs/
```

## الطريقة 3: عبر CDN (للتطوير فقط)
يمكنك تعديل popup.html لاستخدام CDN مباشرة، لكن هذا غير موصى به للإضافات.
