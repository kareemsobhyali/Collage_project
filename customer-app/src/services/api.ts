export const getApiHost = () => (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  if (window.location.port === '5173' || window.location.port === '5174') {
    return `http://${window.location.hostname}:5000/api`;
  }
  return `${window.location.origin}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const getFullImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (typeof window !== 'undefined' && window.location.port !== '5173' && window.location.port !== '5174' && url.includes(':5000/uploads/')) {
      const idx = url.indexOf('/uploads/');
      return `${window.location.origin}${url.substring(idx)}`;
    }
    return url;
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173' || window.location.port === '5174') {
      return `http://${window.location.hostname}:5000${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  return `http://localhost:5000${url.startsWith('/') ? '' : '/'}${url}`;
};

export const isBranchOpenByHours = (
  openingTime?: string | null,
  closingTime?: string | null,
  serverIsWithinWorkingHours?: boolean
): boolean => {
  if (typeof serverIsWithinWorkingHours === 'boolean') return serverIsWithinWorkingHours;
  if (!openingTime || !closingTime) return true;
  const openParts = openingTime.split(':').map(Number);
  const closeParts = closingTime.split(':').map(Number);
  if (openParts.length < 2 || closeParts.length < 2 || isNaN(openParts[0]) || isNaN(closeParts[0])) {
    return true;
  }
  const openMins = openParts[0] * 60 + (openParts[1] || 0);
  const closeMins = closeParts[0] * 60 + (closeParts[1] || 0);
  if (openMins === closeMins) return true;

  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  if (closeMins > openMins) {
    return currentMins >= openMins && currentMins <= closeMins;
  } else {
    return currentMins >= openMins || currentMins <= closeMins;
  }
};

function getHeaders(isFormData: boolean = false): HeadersInit {
  const token = localStorage.getItem('customer_token') || localStorage.getItem('admin_token') || localStorage.getItem('driver_token');
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getAdminHeaders(isFormData: boolean = false): HeadersInit {
  const token = localStorage.getItem('admin_token') || localStorage.getItem('customer_token');
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // 1. تسجيل مستخدم جديد
  async register(name: string, phone: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err: any = new Error(data.error || 'فشل إنشاء الحساب');
      err.data = data;
      err.requireVerification = data.requireVerification;
      err.phone = data.phone;
      throw err;
    }
    return data;
  },

  // 2. تسجيل الدخول
  async login(phone: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err: any = new Error(data.error || 'فشل تسجيل الدخول');
      err.data = data;
      err.requireVerification = data.requireVerification;
      err.phone = data.phone;
      throw err;
    }
    return data;
  },

  // 2.1 طلب كود استعادة كلمة المرور عبر الواتساب
  async forgotPassword(phone: string) {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال كود التحقق');
    return data;
  },

  // 2.2 التحقق من صحة كود الواتساب
  async verifyResetOtp(phone: string, otp: string) {
    const res = await fetch(`${API_BASE_URL}/auth/verify-reset-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'كود التحقق غير صحيح');
    return data;
  },

  // 2.3 تعيين كلمة المرور الجديدة بعد التحقق من كود الواتساب
  async resetPassword(phone: string, otp: string, newPassword: string) {
    const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعيين كلمة المرور الجديدة');
    return data;
  },

  // 2.4 تأكيد وتفعيل رقم الهاتف بواسطة كود الواتساب
  async verifyPhoneCode(phone: string, code: string) {
    const res = await fetch(`${API_BASE_URL}/auth/verify-phone-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'كود التفعيل غير صحيح');
    return data;
  },

  // 2.5 تفعيل رقم الهاتف تلقائياً عبر الرابط السريع (Magic Link)
  async verifyPhoneLink(token: string) {
    const res = await fetch(`${API_BASE_URL}/auth/verify-phone-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'رابط التفعيل غير صالح أو انتهت صلاحيته');
    return data;
  },

  // 2.6 إعادة إرسال كود ورابط التفعيل عبر الواتساب
  async resendVerificationOtp(phone: string) {
    const res = await fetch(`${API_BASE_URL}/auth/resend-verification-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إعادة إرسال كود التفعيل');
    return data;
  },

  // 3. بيانات المستخدم
  async getMe() {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب بيانات الحساب');
    return data;
  },

  // 4. استعراض الفروع النشطة
  async getBranches() {
    const res = await fetch(`${API_BASE_URL}/customer/branches`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب قائمة المطاعم');
    return data;
  },

  // 5. استعراض منيو الفرع
  async getBranchMenu(branchId: string) {
    const res = await fetch(`${API_BASE_URL}/customer/branches/${branchId}/menu`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب منيو المطعم');
    return data;
  },

  // 6. إنشاء طلب جديد
  async createOrder(orderPayload: any) {
    const res = await fetch(`${API_BASE_URL}/customer/orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(orderPayload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال الطلب');
    return data;
  },

  // 7. تتبع طلب محدد
  async getOrder(orderId: string) {
    const res = await fetch(`${API_BASE_URL}/customer/orders/${orderId}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب بيانات الطلب');
    return data;
  },

  // 8. سجل طلبات الطالب
  async getMyOrders() {
    const res = await fetch(`${API_BASE_URL}/customer/my-orders`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب سجل الطلبات');
    return data;
  },

  // 8.5 إلغاء الطلب (إذا كان معلقاً)
  async cancelOrder(orderId: string) {
    const res = await fetch(`${API_BASE_URL}/customer/orders/${orderId}/cancel`, {
      method: 'PUT',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إلغاء الطلب');
    return data;
  },

  // 8.6 تقييم الطلب بعد اكتماله
  async rateOrder(orderId: string, rating: number, review?: string) {
    const res = await fetch(`${API_BASE_URL}/customer/orders/${orderId}/rate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ rating, review }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال التقييم');
    return data;
  },

  // 8.7 جلب البانرات الإعلانية النشطة
  async getBanners() {
    const res = await fetch(`${API_BASE_URL}/customer/banners`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب البانرات الإعلانية');
    return data;
  },

  // 8.8 التحقق من كود الخصم (برومو كود)
  async validatePromoCode(code: string, subtotal: number) {
    const res = await fetch(`${API_BASE_URL}/customer/promo-codes/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, subtotal }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'كوبون الخصم غير صالح');
    return data;
  },

  // 9. رفع الصور
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل رفع الصورة');
    return data;
  },

  // 10. العناوين المحفوظة
  async getAddresses() {
    const res = await fetch(`${API_BASE_URL}/customer/addresses`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب العناوين');
    return data;
  },

  async addAddress(title: string, details: string, isDefault: boolean = false) {
    const res = await fetch(`${API_BASE_URL}/customer/addresses`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ title, details, isDefault }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة العنوان');
    return data;
  },

  async deleteAddress(id: string) {
    const res = await fetch(`${API_BASE_URL}/customer/addresses/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف العنوان');
    return data;
  },

  // 11. تحديث البروفايل
  async updateProfile(name: string) {
    const res = await fetch(`${API_BASE_URL}/customer/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث البيانات الشخصية');
    return data;
  },

  // 12. لوحة الإدارة (Banners & Promo Codes)
  async getAdminBanners() {
    const res = await fetch(`${API_BASE_URL}/admin/banners`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب البانرات');
    return data;
  },

  async createAdminBanner(bannerData: any) {
    const res = await fetch(`${API_BASE_URL}/admin/banners`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(bannerData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء البانر');
    return data;
  },

  async updateAdminBanner(id: string, bannerData: any) {
    const res = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(bannerData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث البانر');
    return data;
  },

  async deleteAdminBanner(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/banners/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف البانر');
    return data;
  },

  async getAdminPromoCodes() {
    const res = await fetch(`${API_BASE_URL}/admin/promo-codes`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب كوبونات الخصم');
    return data;
  },

  async createAdminPromoCode(promoData: any) {
    const res = await fetch(`${API_BASE_URL}/admin/promo-codes`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(promoData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء كود الخصم');
    return data;
  },

  async updateAdminPromoCode(id: string, promoData: any) {
    const res = await fetch(`${API_BASE_URL}/admin/promo-codes/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(promoData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث كود الخصم');
    return data;
  },

  async deleteAdminPromoCode(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/promo-codes/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف كود الخصم');
    return data;
  },

  async updateAdminUserWallet(
    userId: string,
    walletData: { walletBalance?: number; loyaltyPoints?: number; isBlocked?: boolean; restaurantNotes?: string }
  ) {
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/wallet`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(walletData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث محفظة أو بيانات الطالب');
    return data;
  },

  // 12.5 المحفظة الجامعية ونقاط الولاء (Student Wallet & Loyalty Points)
  async getWallet() {
    const res = await fetch(`${API_BASE_URL}/customer/wallet`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب بيانات المحفظة');
    return data;
  },

  async convertPointsToWallet(points?: number) {
    const res = await fetch(`${API_BASE_URL}/customer/wallet/convert-points`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ points }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحويل النقاط إلى المحفظة');
    return data;
  },

  // 13. السلة الجماعية التشاركية (سلة الشلة)
  async createGroupCart(branchId: string, hostName: string) {
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, hostName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء سلة الشلة');
    return data;
  },

  async getGroupCart(code: string) {
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع سلة الشلة');
    return data;
  },

  async addGroupCartItem(code: string, itemData: any) {
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة الصنف لسلة الشلة');
    return data;
  },

  async removeGroupCartItem(code: string, itemId: string, studentName?: string) {
    const query = studentName ? `?studentName=${encodeURIComponent(studentName)}` : '';
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}/items/${itemId}${query}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الصنف من سلة الشلة');
    return data;
  },

  // 14. كابتن التوصيل (الطيار)
  async driverLogin(username: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/driver/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'بيانات الدخول غير صحيحة');
    return data;
  },

  async getDriverMe() {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/me`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع بيانات الكابتن');
    return data;
  },

  async getDriverOrders() {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/orders`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع طلبات التوصيل');
    return data;
  },

  async driverRejectOrder(orderId: string, reason?: string) {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/orders/${orderId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل رفض الطلب');
    return data;
  },

  async driverPickupOrder(orderId: string) {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/orders/${orderId}/pickup`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تأكيد الاستلام من الفرع');
    return data;
  },

  async driverDeliverOrder(orderId: string, pin: string) {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/orders/${orderId}/deliver`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ pin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'رمز PIN غير صحيح أو فشل إنهاء الطلب');
    return data;
  },

  // 35. إدارة بوت الواتساب التلقائي
  async getWhatsAppStatus() {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/status`, {
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب حالة الواتساب');
    return data;
  },

  async disconnectWhatsApp() {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل فصل جلسة الواتساب');
    return data;
  },

  async adminResetUserPassword(userId: string, newPassword: string) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إعادة تعيين كلمة المرور');
    return data;
  },

  // 36. تغيير كلمة مرور الإدارة
  async changeAdminPassword(currentPassword: string, newPassword: string) {
    const res = await fetch(`${API_BASE_URL}/admin/change-password`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تغيير كلمة مرور الإدارة');
    return data;
  },

  // 37. إعدادات نظام نقاط الولاء
  async getLoyaltySettings() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/loyalty`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات نظام النقاط');
    return data;
  },

  async updateLoyaltySettings(settings: {
    enabled: boolean;
    pointsPerPound: number;
    pointsRedemptionRate: number;
    minPointsToRedeem: number;
    welcomePoints: number;
  }) {
    const res = await fetch(`${API_BASE_URL}/admin/settings/loyalty`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ إعدادات نظام النقاط');
    return data;
  },

  // 38. إعدادات تنبيهات وإشعارات الواتساب
  async getWhatsAppAlertSettings() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/whatsapp-alerts`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات تنبيهات الواتساب');
    return data;
  },

  async updateWhatsAppAlertSettings(settings: {
    cancellationAlertPhones: string;
    cancellationAlertEnabled: boolean;
    unacceptedAlertPhones: string;
    unacceptedAlertEnabled: boolean;
    unacceptedDelayMinutes: number;
    dailyReportPhones?: string;
    dailyReportEnabled?: boolean;
  }) {
    const res = await fetch(`${API_BASE_URL}/admin/settings/whatsapp-alerts`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ إعدادات تنبيهات الواتساب');
    return data;
  },

  // 39. إرسال تقرير الشيفت المالي عبر الواتساب فورياً
  async sendShiftReportNow(branchId: string = 'ALL', customPhone?: string) {
    const res = await fetch(`${API_BASE_URL}/admin/reports/send-shift-report/${branchId}`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ customPhone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال التقرير المالي للشيفت');
    return data;
  },

  // 40. إعادة ضبط المصنع وتصفير بيانات المنظومة (حالة الصفر)
  async factoryReset(adminPassword: string) {
    const res = await fetch(`${API_BASE_URL}/admin/system/factory-reset`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ adminPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تصفير بيانات المشروع');
    return data;
  },
};



