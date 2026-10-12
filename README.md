# 🍔 UniFood — منظومة توصيل طلبات مطاعم الجامعة (Campus Food Order & Delivery System)

منظومة متكاملة لربط مطاعم وكافيهات الحرم الجامعي بالطلاب وأعضاء هيئة التدريس، تضم **4 بوابات مترابطة** تعمل من دومين واحد أو كتطبيقات مستقلة:
1. **متجر الطلاب (Student PWA)**: الطلب المسبق، سلة الشلة التشاركية، المحفظة الجامعية ونقاط الولاء، وتتبع الطلبات مع إشعارات الويب (`Web Push / Service Worker`).
2. **كاشير وبوابة المطاعم (`POS & Restaurant Portal`)**: استقبال الطلبات الحية برنة تنبيه مستمرة، طباعة الفواتير الحرارية `80mm`، جدولة الطلبات المحجوزة، إسناد الطلبات للطيارين، وإدارة المنيو والإضافات ومواعيد العمل.
3. **بوابة كباتن التوصيل (`Delivery Driver Portal`)**: متابعة حالة تجهيز الأوردر بالمطبخ، زر استلام الأوردر من الفرع، وتسليمه للطالب عبر كود التحقق الآمن (`4-Digit PIN`).
4. **لوحة تحكم الإدارة (`Super Admin Dashboard`)**: إدارة الفروع، شحن محافظ الطلاب، الإعلانات والبانرات، كوبونات الخصم المحدودة، وتقارير الأداء والـ SLA.

---

## 🌐 المسارات الموحدة عند الرفع على استضافة واحدة (Unified Routing)

عند تشغيل السيرفر في بيئة الإنتاج (`npm run build && npm start`)، يعمل المشروع بالكامل على نفس الدومين:
- **`/`** : واجهة الطلاب الرئيسية (`Student Store PWA`).
- **`/admin`** : لوحة تحكم السوبر أدمن (`Super Admin Dashboard`).
- **`/delivery`** أو **`/elviery`** : بوابة كباتن التوصيل (`Driver Portal`).
- **`/pos`** أو **`/restaurant`** : شاشة كاشير المطعم عبر الويب (`Restaurant POS`).

---

## 🛠️ التقنيات المستخدمة (Tech Stack)
- **Backend**: Node.js, Express 5, TypeScript, Socket.io, Prisma ORM, PostgreSQL, JWT, Helmet, Rate Limiting.
- **Frontend (Customer & Admin & Driver)**: React 19, TypeScript, Tailwind CSS, Vite, PWA Service Worker.
- **Restaurant POS**: React 19, TypeScript, Tailwind CSS, Electron (Desktop) & Web Build.

---

## 🚀 التشغيل المحلي السريع (Local Development)

1. انسخ ملف البيئة `.env.example` إلى `backend/.env` وقم بضبط رابط قاعدة بيانات PostgreSQL (`DATABASE_URL`).
2. ثبت الحزم وادفع الجداول لقاعدة البيانات:
```bash
npm run install:all
npm run prisma:generate
npm run prisma:push
npm run seed
```
3. شغل المنظومة بالكامل بضغطة واحدة على ويندوز عبر:
```cmd
run_all.bat
```

---

## ☁️ أوامر الرفع على Render / Railway (Production Deployment)

- **Build Command**:
```bash
npm run install:all && npm run prisma:generate && npm run build
```
- **Start Command**:
```bash
npm run prisma:push && npm start
```
- **Environment Variables**:
  - `DATABASE_URL`: رابط قاعدة بيانات PostgreSQL (مثل Neon.tech أو Supabase أو Railway).
  - `JWT_SECRET`: مفتاح سري قوي لتشفير الجلسات.
  - `PORT`: `5000` (أو يترك تلقائياً للاستضافة).
