// UniFood Branch POS - Service Worker (Desktop & Mobile PWA)
const CACHE_NAME = 'unifood-branch-pos-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['./', './manifest.json', './icon-192.png', './icon-512.png']).catch(() => {});
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('unifood-branch-pos-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
    ])
  );
});

// Network-First: دائماً يجلب أحدث نسخة من السيرفر فوراً، مع fallback آمن عند انقطاع الشبكة اللحظي
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  try {
    const url = new URL(event.request.url);
    if (
      url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/socket.io/') ||
      url.pathname.startsWith('/uploads/')
    ) {
      return;
    }
  } catch (_e) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const shell = await caches.match('./');
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'UniFood Branch | طلب جديد',
    body: 'وصل طلب جديد للفرع بانتظار المراجعة والقبول!',
    url: './',
  };

  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch (_e) {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      dir: 'rtl',
      lang: 'ar',
      requireInteraction: true,
      data: { url: payload.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/branch') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
