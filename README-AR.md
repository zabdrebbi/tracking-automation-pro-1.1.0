# مُحدِّث Tracking Automation Pro (بدون Chrome Web Store)

محدّث مكتفٍ بذاته يعيش **داخل مجلد الإضافة نفسه** (`tracking-automation-pro`). ملفات المحدّث موجودة في جذر مستودع GitHub، لذا يُحدَّث المحدّث نفسه تلقائيًا مع المشروع.

## البنية
مجلد الإضافة `tracking-automation-pro` يحتوي:
- `manifest.json` وملفات الإضافة.
- `Update-TrackingAutomation.ps1` — سكربت التحديث.
- `Run-Update.bat` — تشغيل تحديث يدوي مع إظهار التقدم.
- `Run-Update-Hidden.vbs` — تشغيل التحديث في الخلفية بدون أي نافذة.
- `Install-Auto-Check.bat` — جدولة فحص تلقائي كل 6 ساعات.
- `Remove-Auto-Check.bat` — إلغاء الجدولة.

## التثبيت الأول
1. ضع ملفات المحدّث (كل ملفات هذا المشروع) داخل مجلد `tracking-automation-pro`.
2. شغّل `Run-Update.bat` — سيحمّل المشروع من GitHub إلى نفس المجلد (حتى لو كان المجلد فارغًا مع وجود ملفات المحدّث فقط).
3. لاحظ: أول تشغيل سيُزامن المجلد بالكامل مع المستودع.
4. حمّل الإضافة من `chrome://extensions/` عبر "Load unpacked".

## التحديث اليدوي
شغّل `Run-Update.bat` داخل مجلد الإضافة.

## التحديث التلقائي
شغّل `Install-Auto-Check.bat` مرة واحدة داخل مجلد الإضافة. يعمل الفحص كل 6 ساعات في الخلفية بالكامل (لا نافذة، لا فتح متصفح) ويكتب سجلًا في `.tracking-automation-pro-update.log`. لإلغائه شغّل `Remove-Auto-Check.bat`.

## كيف يعمل؟
- يفحص أحدث commit في الفرع `main` للمستودع `zabdrebbi/tracking-automation-pro-1.1.0`.
- عند وجود تغييرات ينزّل الملفات، يتأكد من صحة `manifest.json`، ثم يحدّث الملفات مباشرة دون نسخة احتياطية.
- ملف الحالة `.tracking-automation-pro-last-sha.txt` مستثنى من المزامنة.
- لا تحتاج لإنشاء GitHub Release؛ يكفي رفع التغييرات إلى `main`.
- هذا المحدّث يعمل على هذا الكمبيوتر فقط؛ كل مستخدم آخر يحتاج إلى تثبيته على جهازه.