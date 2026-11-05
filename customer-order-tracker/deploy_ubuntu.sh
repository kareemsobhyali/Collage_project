#!/bin/bash
set -e

DOMAIN="trackorder.unifood.store"
APP_DIR="/opt/customer-order-tracker"
PORT="8005"
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "===================================================="
echo "🚀 تثبيت وتشغيل نظام متابعة الطلبات على: $DOMAIN"
echo "===================================================="

# 1. تنظيف الكاش المؤقت لتوفير المساحة
rm -rf /root/.cache/puccinialin /root/.cache/pip /root/.cargo /root/.rustup /tmp/pip-*

# 2. تثبيت المتطلبات الأساسية
apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx

# 3. نسخ ملفات المشروع إلى /opt/customer-order-tracker
mkdir -p "$APP_DIR"
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
    cp -r "$CURRENT_DIR"/* "$APP_DIR/"
fi
cd "$APP_DIR"

# 4. إنشاء البيئة الافتراضية وتثبيت الحزم الجاهزة (بدون بناء Rust)
python3 -m venv venv
./venv/bin/pip install --no-cache-dir --upgrade pip
./venv/bin/pip install --no-cache-dir --prefer-binary "fastapi>=0.115.0" "uvicorn>=0.32.0" "sqlalchemy>=2.0.36" "aiosqlite>=0.20.0" "pydantic>=2.10.0" "python-dotenv>=1.0.1" "pywebpush>=2.0.1"

# 5. تفعيل خدمة Systemd لتعمل تلقائياً في الخلفية وعلى بورت 8005
cp customer-tracker.service /etc/systemd/system/customer-tracker.service
systemctl daemon-reload
systemctl enable customer-tracker
systemctl restart customer-tracker

# 6. إعداد Nginx للـ Subdomain
cp nginx-trackorder.unifood.store.conf /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl reload nginx

echo "===================================================="
echo "✅ تم تشغيل السيرفر بنجاح على http://$DOMAIN"
echo "🔒 لتفعيل شهادة SSL (HTTPS) مجاناً، نفّذ الأمر التالي:"
echo "   sudo certbot --nginx -d $DOMAIN"
echo "===================================================="
