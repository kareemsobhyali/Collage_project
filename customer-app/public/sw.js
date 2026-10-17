// UniFood PWA & Web Push Notification Service Worker
const CACHE_NAME = 'unifood-pwa-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// مطلوب لتفعيل التثبيت الفوري الموثق من جوجل كروم (WebAPK) بدون تحذيرات Play Protect
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  try {
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
      return;
    }
  } catch (_e) {}
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// استقبال إشعارات الدفع في الخلفية
self.addEventListener('push', (event) => {
  let payload = {
    title: 'UniFood | يونيفود',
    body: 'لديك تحديث جديد في طلبك الجامعي!',
    url: '/',
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/logo.png',
    badge: '/logo.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [250, 100, 250, 100, 400],
    data: { url: payload.url || '/' },
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// عند الضغط على الإشعار على الهاتف أو المتصفح
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
