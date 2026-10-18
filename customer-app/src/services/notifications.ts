// إدارة إشعارات الويب في الخلفية والـ PWA Service Worker

let swRegistration: ServiceWorkerRegistration | null = null;
let deferredInstallPrompt: any = null;

if (typeof window !== 'undefined') {
  const isAdminUrl =
    (window as any).AndroidBridge?.getFlavor?.() === 'admin' ||
    window.location.pathname.startsWith('/admin') ||
    window.location.search.includes('admin') ||
    window.location.hash.includes('admin');

  const isDriverUrl =
    (window as any).AndroidBridge?.getFlavor?.() === 'driver' ||
    window.location.pathname.startsWith('/driver') ||
    window.location.pathname.startsWith('/delivery') ||
    window.location.search.includes('driver');

  if (isAdminUrl) {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', '/manifest-admin.json');
    }
    document.title = 'UniFood Admin | لوحة الإدارة المركزية';
  } else if (isDriverUrl) {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.setAttribute('href', '/manifest-driver.json');
    }
    document.title = 'UniFood Driver | كابتن التوصيل';
  }

  window.addEventListener('beforeinstallprompt', (e: any) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });
}

export async function triggerInstallApp(fallbackApkUrl: string): Promise<void> {
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choiceResult?.outcome === 'accepted') {
        return;
      }
    } catch (_e) {
      // Fallback to APK download
    }
  }
  window.open(fallbackApkUrl, '_blank', 'noopener,noreferrer');
}

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

export function isRunningInNativeApk(): boolean {
  if (typeof window === 'undefined') return false;
  if (Boolean((window as any).AndroidBridge)) return true;
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (isRunningInNativeApk()) {
    return 'granted';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (isRunningInNativeApk()) {
    return true;
  }
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

const notifiedOrderStatuses = new Map<string, string>();

export async function sendWebNotification(
  title: string,
  body: string,
  url: string = '/',
  tag?: string
): Promise<void> {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('unifood-inapp-notify', {
        detail: { title, message: body },
      })
    );
  }

  const safeTag = tag || 'unifood_notification';

  // إذا كان التطبيق مفتوحاً وشغالاً أمام المستخدم في الواجهة، لا نرسل إشعار للنظام منعاً لأي إزعاج أو تكرار
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return;
  }

  // في تطبيق الأندرويد الناتيف (APK):
  // خدمة الخلفية UniFoodNotificationService هي المسؤولة حصرياً عن إشعارات النظام في الخلفية
  // لتجنب تكرار الإشعار مرتين (مرة من الخدمة الناتيف ومرة من كود الويب)
  if (isRunningInNativeApk()) {
    return;
  }

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
    tag: safeTag,
    renotify: true,
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
      new Notification(title, { body, icon: '/logo.png', dir: 'rtl', tag: safeTag });
    } catch (_e) {
      // Fallback ignored
    }
  }
}

export function notifyOrderStatusPush(order: any): void {
  if (!order || !order.id || !order.status) return;

  // منع التكرار لنفس الحالة
  const lastStatus = notifiedOrderStatuses.get(order.id);
  if (lastStatus === order.status) {
    return;
  }
  notifiedOrderStatuses.set(order.id, order.status);

  // إرسال تنبيه مرئي داخل واجهة التطبيق فقط (In-App Toast) بدون أي إشعارات نظام أو شريط علوي
  const orderNum = order.orderNumber || '';
  const branchName = order.branch?.name || 'المطعم';

  let title = '';
  let msg = '';

  switch (order.status) {
    case 'ACCEPTED':
      title = `✅ تم قبول طلبك #${orderNum}`;
      msg = `استلم مطعم (${branchName}) طلبك وجاري البدء في تجهيزه!`;
      break;
    case 'PREPARING':
      title = `👨‍🍳 طلبك #${orderNum} قيد التحضير`;
      msg = `الشيف يجهز وجبتك الآن في (${branchName})!`;
      break;
    case 'READY':
      title = order.orderType === 'DELIVERY' ? `🛵 طلبك #${orderNum} في الطريق إليك!` : `🎉 طلبك #${orderNum} جاهز للاستلام!`;
      msg = order.orderType === 'DELIVERY'
        ? `خرج كابتن التوصيل بالطلب الآن، رمز الاستلام PIN: (${order.pickupPin || '----'})`
        : `توجه لفرع (${branchName}) لاستلام وجبتك، رمز الاستلام: (${order.pickupPin || '----'})`;
      break;
    case 'COMPLETED':
      title = `🥳 اكتمل طلبك #${orderNum}`;
      msg = `تم تسليم الطلب بنجاح وإضافة نقاط الولاء لمحفظتك!`;
      break;
    case 'REJECTED':
      title = `⚠️ تم إلغاء الطلب #${orderNum}`;
      msg = `نعتذر، تعذر تنفيذ الطلب من (${branchName}).`;
      break;
  }

  if (title && typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('unifood-inapp-notify', {
        detail: { title, message: msg },
      })
    );
  }
}

/**
 * فتح الروابط الخارجية (مثل خرائط Google أو روابط الدفع أو واتساب)
 * بأمان تام: إذا كان يعمل داخل تطبيق الأندرويد الأصلي يستدعي الـ AndroidBridge
 * ليفتح تطبيق الخرائط أو المتصفح الخارجي فورياً بدلاً من شاشات الخطأ بالـ WebView
 */
export function openExternalLink(url: string): void {
  if (typeof window === 'undefined') return;

  try {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.openExternalUrl === 'function') {
      bridge.openExternalUrl(url);
      return;
    }
  } catch (_e) {
    // ignore bridge invocation error and fallback to window.open
  }

  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (_e) {
    window.location.href = url;
  }
}

/**
 * تسجيل جلسة المستخدم في خدمة الأندرويد الأصلية بالخلفية
 * لضمان وصول الإشعارات والرنين حتى لو التطبيق مقفول تماماً
 */
export function registerNativeBackgroundSession(
  token: string,
  role: 'STUDENT' | 'DRIVER' | 'BRANCH' | 'ADMIN',
  userId: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.registerBackgroundSession === 'function') {
      bridge.registerBackgroundSession(token, role, userId);
    }
  } catch (_e) {
  }
}

/**
 * إلغاء خدمة الخلفية عند تسجيل الخروج
 */
export function clearNativeBackgroundSession(): void {
  if (typeof window === 'undefined') return;
  try {
    const bridge = (window as any).AndroidBridge;
    if (bridge && typeof bridge.clearBackgroundSession === 'function') {
      bridge.clearBackgroundSession();
    }
  } catch (_e) {
  }
}


