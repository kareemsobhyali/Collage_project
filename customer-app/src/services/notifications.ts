// إدارة إشعارات الويب في الخلفية والـ PWA Service Worker

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('Service Worker registration failed:', err);
    return null;
  }
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    return false;
  }
}

export async function sendWebNotification(
  title: string,
  body: string,
  url: string = '/'
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const options: any = {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [250, 100, 250, 100, 400],
    data: { url },
    tag: `unifood-${Date.now()}`,
  };

  try {
    if (swRegistration && swRegistration.showNotification) {
      await swRegistration.showNotification(title, options);
      return;
    }

    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.showNotification) {
      await reg.showNotification(title, options);
      return;
    }

    new Notification(title, options);
  } catch (err) {
    try {
      new Notification(title, { body, icon: '/logo.png', dir: 'rtl' });
    } catch (_e) {
      // Fallback ignored
    }
  }
}

export function notifyOrderStatusPush(order: any): void {
  if (!order) return;
  const orderNum = order.orderNumber || '';
  const branchName = order.branch?.name || 'المطعم';

  switch (order.status) {
    case 'ACCEPTED':
      sendWebNotification(
        `✅ تم قبول طلبك #${orderNum}`,
        `استلم مطعم (${branchName}) طلبك وجاري البدء في تجهيزه الآن!`,
        '/'
      );
      break;
    case 'PREPARING':
      sendWebNotification(
        `👨‍🍳 طلبك #${orderNum} قيد التحضير`,
        `الشيف يجهز وجبتك الآن في (${branchName})!`,
        '/'
      );
      break;
    case 'READY':
      if (order.orderType === 'DELIVERY') {
        sendWebNotification(
          `🛵 طلبك #${orderNum} في الطريق إليك!`,
          `خرج كابتن التوصيل بالطلب الآن، جهز رمز الاستلام السري PIN: (${order.pickupPin || '----'})`,
          '/'
        );
      } else {
        sendWebNotification(
          `🎉 طلبك #${orderNum} جاهز للاستلام!`,
          `توجه لفرع (${branchName}) لاستلام وجبتك، رمز الاستلام: (${order.pickupPin || '----'})`,
          '/'
        );
      }
      break;
    case 'COMPLETED':
      sendWebNotification(
        `🥳 بالهنا والشفا! اكتمل طلبك #${orderNum}`,
        `تم تسليم الطلب بنجاح وإضافة نقاط الولاء لمحفظتك الجامعية!`,
        '/'
      );
      break;
    case 'REJECTED':
      sendWebNotification(
        `⚠️ تم إلغاء الطلب #${orderNum}`,
        `نعتذر، تعذر تنفيذ الطلب من (${branchName}).`,
        '/'
      );
      break;
    default:
      break;
  }
}
