#!/bin/bash
set -e

DOMAIN="trackorder.unifood.store"
APP_DIR="/opt/customer-order-tracker"
PORT="8005"
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "===================================================="
echo "🚀 تثبيت وتشغيل نظام متابعة الطلبات على: $DOMAIN"
echo "===================================================="

# 1. تثبيت المتطلبات الأساسية
apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx

# 2. نسخ ملفات المشروع إلى /opt/customer-order-tracker (إن لم تكن فيه بالفعل)
mkdir -p "$APP_DIR"
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
    cp -r "$CURRENT_DIR"/* "$APP_DIR/"
fi
cd "$APP_DIR"

# 3. إنشاء البيئة الافتراضية وتثبيت المكتبات
python3 -m venv venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 4. تفعيل خدمة Systemd لتعمل تلقائياً في الخلفية وعلى بورت 8005
cp customer-tracker.service /etc/systemd/system/customer-tracker.service
systemctl daemon-reload
systemctl enable customer-tracker
systemctl restart customer-tracker

# 5. إعداد Nginx للـ Subdomain
cp nginx-trackorder.unifood.store.conf /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t
systemctl reload nginx

echo "===================================================="
echo "✅ تم تشغيل السيرفر بنجاح على http://$DOMAIN"
echo "🔒 لتفعيل شهادة SSL (HTTPS) مجاناً، نفّذ الأمر التالي:"
echo "   sudo certbot --nginx -d $DOMAIN"
echo "===================================================="
