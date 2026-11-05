# نظام متابعة طلبات العملاء (`trackorder.unifood.store`)

مشروع مستقل بالكامل (Standalone) لمتابعة حالة طلب العميل لحظياً عبر `QR Code` المطبوع على الفاتورة (يعتمد على `IH_SERIAL` لمنع تكرار الورديات، ويعرض للعميل رقم `ih_code`).

---

## أولاً: إعداد الدومين الفرعي (Subdomain DNS)
من لوحة تحكم الدومين الخاص بك (`unifood.store` على Cloudflare أو Namecheap أو GoDaddy):
1. أضف سجل جديد من نوع **`A Record`**:
   - **Name / Host**: `trackorder`
   - **Value / IPv4 address**: عنوان الـ `IP` الخاص بالسيرفر (VPS) بتاعك
   - **TTL**: `Auto` (أو `300`)

---

## ثانياً: تشغيل المشروع على السيرفر (Ubuntu / Debian VPS)

البرنامج مهيأ ليعمل على بورت داخلي **`8005`** حتى لا يتعارض مع أي موقع أو خدمة أخرى تعمل على بورت `8000` أو `80` على نفس السيرفر.

### الطريقة الأسرع (أمر واحد تلقائي):
ارفع فولدر `customer-order-tracker` إلى السيرفر، ثم نفّذ:
```bash
cd customer-order-tracker
chmod +x deploy_ubuntu.sh
sudo ./deploy_ubuntu.sh
```
سيقوم السكريبت تلقائياً بـ:
1. نقل المشروع إلى `/opt/customer-order-tracker` وإنشاء بيئة Python وتثبيت المكتبات.
2. تفعيل خدمة خلفية دائمة (`systemd` باسم `customer-tracker`) تعمل على بورت `127.0.0.1:8005` وتُعيد تشغيل نفسها تلقائياً لو السيرفر عمل ريستارت.
3. ربط الدومين `trackorder.unifood.store` عبر `Nginx` مع دعم كامل للـ `WebSocket`.

### تفعيل شهادة الـ HTTPS (مهم جداً للإشعارات الصوتية والـ Web Push):
بعد ربط الدومين، نفّذ الأمر التالي على السيرفر لتفعيل `https://trackorder.unifood.store` مجاناً:
```bash
sudo certbot --nginx -d trackorder.unifood.store
```

---

## ثالثاً: إعداد الرابط داخل برنامج الـ KDS
تم ضبط الرابط الافتراضي في برنامج الـ KDS بالفعل ليكون:
```text
https://trackorder.unifood.store
```
وبالتالي سيكون رابط الـ QR Code المطبوع على الفاتورة تلقائياً بالشكل التالي:
```text
https://trackorder.unifood.store/order/{IH_SERIAL}
```
وعندما يمسحه العميل بالموبايل سيظهر له رقم الطلب الخاص بالوردية (`#ih_code`).
