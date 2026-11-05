// ── Service Worker for Background Customer Order Notifications ──────────────

self.addEventListener('push', function(event) {
    let data = { title: 'ديفادو - طلبك جاهز!', body: 'طلبك جاهز للاستلام الآن من شباك التسليم 🔔' };
    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.warn('Push data parse failed, using fallback.');
    }

    const options = {
        body: data.body || data.message || 'طلبك جاهز للاستلام الآن!',
        icon: '/static/tracker/icon-192.png',
        badge: '/static/tracker/badge-72.png',
        vibrate: [400, 200, 400, 200, 800],
        tag: 'order-ready-notification',
        renotify: true,
        requireInteraction: true,
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'ديفادو - طلبك جاهز!', options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow(event.notification.data.url || '/');
        })
    );
});
