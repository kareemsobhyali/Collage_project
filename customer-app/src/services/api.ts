export const GITHUB_CONFIG_URL =
  'https://raw.githubusercontent.com/kareemsobhyali/Collage_project/main/server-config.json';

export async function syncRemoteServerConfig(): Promise<{ apiUrl: string; webUrl: string } | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(`${GITHUB_CONFIG_URL}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.apiUrl) {
      const cleanApi = data.apiUrl.trim().replace(/\/+$/, '');
      const cleanWeb = data.webUrl ? data.webUrl.trim().replace(/\/+$/, '') : cleanApi.replace(/\/api\/?$/, '');
      localStorage.setItem('unifood_remote_api_url', cleanApi);
      localStorage.setItem('unifood_remote_web_url', cleanWeb);
      return { apiUrl: cleanApi, webUrl: cleanWeb };
    }
  } catch (_e) {}
  return null;
}

export const getApiHost = () => (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'http://localhost:5000/api';
  try {
    const custom = localStorage.getItem('unifood_custom_api_url') || localStorage.getItem('unifood_remote_api_url');
    if (custom && custom.trim()) {
      const clean = custom.trim().replace(/\/+$/, '');
      return clean.endsWith('/api') ? clean : `${clean}/api`;
    }
  } catch {}

  if ((import.meta as any).env?.VITE_API_URL) return (import.meta as any).env.VITE_API_URL;
  if (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null') {
    return 'https://unifood.store/api';
  }
  if (window.location.port && window.location.port !== '5000' && window.location.port !== '80' && window.location.port !== '443') {
    return `http://${window.location.hostname}:5000/api`;
  }
  return `${window.location.origin}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const sanitizePromoCodeValue = (raw?: unknown): string => {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower === 'null' || lower === 'undefined' || lower === 'nan' || lower === 'false') {
    return '';
  }
  return trimmed.toUpperCase();
};

export const getFullImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (typeof window !== 'undefined' && (!window.location.port || window.location.port === '80' || window.location.port === '443') && url.includes(':5000/uploads/')) {
      const idx = url.indexOf('/uploads/');
      return `${window.location.origin}${url.substring(idx)}`;
    }
    return url;
  }
  if (typeof window !== 'undefined') {
    if (window.location.port && window.location.port !== '5000' && window.location.port !== '80' && window.location.port !== '443') {
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
  if (!openingTime || !closingTime) {
    if (typeof serverIsWithinWorkingHours === 'boolean') return serverIsWithinWorkingHours;
    return true;
  }
  const openParts = openingTime.split(':').map(Number);
  const closeParts = closingTime.split(':').map(Number);
  if (openParts.length < 2 || closeParts.length < 2 || isNaN(openParts[0]) || isNaN(closeParts[0])) {
    if (typeof serverIsWithinWorkingHours === 'boolean') return serverIsWithinWorkingHours;
    return true;
  }
  const openMins = openParts[0] * 60 + (openParts[1] || 0);
  const closeMins = closeParts[0] * 60 + (closeParts[1] || 0);
  if (openMins === closeMins) return true;

  try {
    const cairoDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
    const currentMins = cairoDate.getHours() * 60 + cairoDate.getMinutes();
    if (closeMins > openMins) {
      return currentMins >= openMins && currentMins <= closeMins;
    } else {
      return currentMins >= openMins || currentMins <= closeMins;
    }
  } catch {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    if (closeMins > openMins) {
      return currentMins >= openMins && currentMins <= closeMins;
    } else {
      return currentMins >= openMins || currentMins <= closeMins;
    }
  }
};

function getHeaders(isFormData: boolean = false): HeadersInit {
  const token =
    localStorage.getItem('customer_token') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('driver_token') ||
    localStorage.getItem('branch_token') ||
    localStorage.getItem('token');
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
  const token =
    localStorage.getItem('admin_token') ||
    localStorage.getItem('customer_token') ||
    localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getBranchHeaders(isFormData: boolean = false): HeadersInit {
  const token =
    localStorage.getItem('branch_token') ||
    localStorage.getItem('admin_token') ||
    localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getDriverHeaders(isFormData: boolean = false): HeadersInit {
  const token =
    localStorage.getItem('driver_token') ||
    localStorage.getItem('token');
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
  async register(name: string, phone: string, password: string, channel?: 'WHATSAPP' | 'SMS') {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, channel }),
    });
    const data = await res.json();
    if (!res.ok) {
      const err: any = new Error(data.error || 'فشل إنشاء الحساب');
      err.data = data;
      err.requireVerification = data.requireVerification;
      err.phone = data.phone;
      err.channel = data.channel;
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
      err.channel = data.channel;
      throw err;
    }
    return data;
  },

  // 2.1 طلب كود استعادة كلمة المرور عبر الواتساب أو SMS
  async forgotPassword(phone: string, channel?: 'WHATSAPP' | 'SMS') {
    const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, channel }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال كود التحقق');
    return data;
  },

  // 2.2 التحقق من صحة كود الواتساب أو الـ SMS
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

  // 2.3 تعيين كلمة المرور الجديدة بعد التحقق من كود الواتساب أو SMS
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

  // 2.4 تأكيد وتفعيل رقم الهاتف بواسطة كود الواتساب أو SMS
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

  // 2.6 إعادة إرسال كود ورابط التفعيل عبر الواتساب أو SMS
  async resendVerificationOtp(phone: string, channel?: 'WHATSAPP' | 'SMS') {
    const res = await fetch(`${API_BASE_URL}/auth/resend-verification-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, channel }),
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

  // 4.5 استعراض عروض الفلاش الموقوتة وقت البريك
  async getFlashDeals() {
    const res = await fetch(`${API_BASE_URL}/customer/flash-deals`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب عروض الفلاش');
    return data;
  },

  // 5. استعراض منيو الفرع
  async getBranchMenu(branchId: string) {
    const res = await fetch(`${API_BASE_URL}/customer/branches/${branchId}/menu`, {
      headers: getHeaders(),
    });
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

  // 8. سجل طلبات العميل
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

  // 8.65 تدوير عجلة الحظ وكسب مكافأة
  async spinWheel(orderId: string) {
    const res = await fetch(`${API_BASE_URL}/customer/orders/${orderId}/spin-wheel`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تدوير عجلة الحظ');
    return data;
  },

  // 8.66 الرد على اقتراح إضافة خاصة من المطعم (قبول أو رفض وتعديل الفاتورة)
  async respondOrderAddon(orderId: string, accept: boolean) {
    const res = await fetch(`${API_BASE_URL}/customer/orders/${orderId}/respond-addon`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ accept }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث الاستجابة للاقتراح');
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
  async validatePromoCode(code: string, subtotal: number, branchId?: string) {
    const res = await fetch(`${API_BASE_URL}/customer/promo-codes/validate`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ code, subtotal, branchId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'كوبون الخصم غير صالح');
    return data;
  },

  // 8.9 جلب كوبون الخصم التلقائي الافتراضي المؤهل للعميل والمطعم الحالي
  async getAutoEligiblePromo(branchId?: string, subtotal: number = 0) {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    params.set('subtotal', String(subtotal || 0));
    const res = await fetch(`${API_BASE_URL}/customer/promo-codes/auto-eligible?${params.toString()}`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, promo: null };
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

  // 9.2. رفع الملفات الصوتية لنغمات الإشعارات
  async uploadAudio(file: File) {
    const formData = new FormData();
    formData.append('audio', file);
    const res = await fetch(`${API_BASE_URL}/upload/audio`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل رفع الملف الصوتي');
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

  // حذف حساب العميل نهائياً
  async deleteAccount() {
    const res = await fetch(`${API_BASE_URL}/customer/account`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الحساب');
    return data;
  },

  // إرسال تذكرة / بلاغ دعم فني للإدارة
  async submitSupportTicket(ticket: { category: string; subject: string; message: string; orderNumber?: string }) {
    const res = await fetch(`${API_BASE_URL}/customer/support-ticket`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(ticket),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال تذكرة الدعم');
    return data;
  },

  // استعلام سجل بلاغات وشكاوى العميل ومتابعة حالتها اللحظية
  async getMySupportTickets() {
    const res = await fetch(`${API_BASE_URL}/customer/support-tickets`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع سجل الشكاوى');
    return data?.tickets || [];
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

  // 12.1 عروض الفلاش الموقوتة (Flash Deals)
  async getAdminFlashDeals() {
    const res = await fetch(`${API_BASE_URL}/admin/flash-deals`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب عروض الفلاش');
    return data;
  },

  async createAdminFlashDeal(dealData: any) {
    const res = await fetch(`${API_BASE_URL}/admin/flash-deals`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(dealData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء عرض الفلاش');
    return data;
  },

  async updateAdminFlashDeal(id: string, dealData: any) {
    const res = await fetch(`${API_BASE_URL}/admin/flash-deals/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(dealData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث عرض الفلاش');
    return data;
  },

  async deleteAdminFlashDeal(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/flash-deals/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف عرض الفلاش');
    return data;
  },

  async toggleAdminFlashDeal(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/flash-deals/${id}/toggle`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تغيير حالة عرض الفلاش');
    return data;
  },

  // استيراد منيو مجمع للفرع من لوحة تحكم الأدمن (Excel / CSV) مع حفظ الصور محلياً
  async importAdminBulkMenu(branchId: string, payload: { items: any[]; replaceExisting?: boolean }) {
    const res = await fetch(`${API_BASE_URL}/admin/branches/${branchId}/menu/import-bulk`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استيراد المنيو');
    return data;
  },

  async getAdminBranchMenu(branchId: string) {
    const res = await fetch(`${API_BASE_URL}/admin/branches/${branchId}/menu`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب منيو المطعم');
    return data;
  },

  async reorderAdminBranchMenu(
    branchId: string,
    payload: { categoryIds?: string[]; itemsByCategory?: Record<string, string[]> }
  ) {
    const res = await fetch(`${API_BASE_URL}/admin/branches/${branchId}/menu/reorder`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ ترتيب الأقسام والأصناف');
    return data;
  },

  async getAdminReviews(params?: { branchId?: string; rating?: string; hasText?: boolean }) {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.rating) query.set('rating', params.rating);
    if (params?.hasText !== undefined) query.set('hasText', String(params.hasText));
    const url = `${API_BASE_URL}/admin/reviews${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, { headers: getAdminHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب التقييمات');
    return data;
  },

  async deleteAdminReview(orderId: string) {
    const res = await fetch(`${API_BASE_URL}/admin/reviews/${orderId}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف التقييم');
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
    if (!res.ok) throw new Error(data.error || 'فشل تحديث محفظة أو بيانات العميل');
    return data;
  },

  // 12.5 المحفظة ونقاط الولاء (Customer Wallet & Loyalty Points)
  async getWallet() {
    const res = await fetch(`${API_BASE_URL}/customer/wallet`, {
      headers: getHeaders(),
      cache: 'no-store',
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

  // 13. السلة الجماعية التشاركية (الطلب الجماعي)
  async createGroupCart(branchId: string, hostName: string) {
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId, hostName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء السلة الجماعية');
    return data;
  },

  async getGroupCart(code: string) {
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع السلة الجماعية');
    return data;
  },

  async addGroupCartItem(code: string, itemData: any) {
    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة الصنف للسلة الجماعية');
    return data;
  },

  async removeGroupCartItem(code: string, itemId: string, studentName?: string) {
    const hostToken = localStorage.getItem(`group_host_token_${code}`) || '';
    const deleteKey = localStorage.getItem(`group_item_key_${itemId}`) || '';
    const query = studentName ? `?studentName=${encodeURIComponent(studentName)}` : '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (hostToken) headers['x-host-token'] = hostToken;
    if (deleteKey) headers['x-delete-key'] = deleteKey;

    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}/items/${itemId}${query}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الصنف من السلة الجماعية');
    return data;
  },

  async closeGroupCart(code: string) {
    const hostToken = localStorage.getItem(`group_host_token_${code}`) || '';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (hostToken) headers['x-host-token'] = hostToken;

    const res = await fetch(`${API_BASE_URL}/customer/group-cart/${code}/close`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ hostToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إغلاق السلة الجماعية');
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

  async driverAcceptOrder(orderId: string) {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/orders/${orderId}/accept`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل قبول الطلب');
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

  async driverReturnOrder(orderId: string, pin: string, reason?: string) {
    const token = localStorage.getItem('driver_token');
    const res = await fetch(`${API_BASE_URL}/driver/orders/${orderId}/return-to-branch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ pin, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرجاع الطلب للفرع');
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

  async getWhatsAppAccounts() {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/accounts`, {
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب حسابات الواتساب');
    return data;
  },

  async createWhatsAppAccount(payload: {
    name: string;
    sendOtp?: boolean;
    sendAdminAlerts?: boolean;
    sendCustomerOrders?: boolean;
    branchId?: string | null;
    isDefault?: boolean;
  }) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة حساب الواتساب');
    return data;
  },

  async updateWhatsAppAccount(id: string, payload: {
    name?: string;
    sendOtp?: boolean;
    sendAdminAlerts?: boolean;
    sendCustomerOrders?: boolean;
    branchId?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/accounts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل حساب الواتساب');
    return data;
  },

  async disconnectWhatsAppAccount(id: string) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/accounts/${id}/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل فصل حساب الواتساب');
    return data;
  },

  async refreshWhatsAppAccountQr(id: string) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/accounts/${id}/refresh-qr`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث رمز QR للواتساب');
    return data;
  },

  async deleteWhatsAppAccount(id: string) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/whatsapp/accounts/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف حساب الواتساب');
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

  async adminToggleUserVerify(userId: string) {
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${API_BASE_URL}/admin/users/${userId}/toggle-verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل حالة تفعيل حساب العميل');
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
  async getPublicLoyaltySettings() {
    try {
      const res = await fetch(`${API_BASE_URL}/customer/public/loyalty-settings`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch {
      return null;
    }
  },

  async getLoyaltySettings() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/loyalty`, {
      headers: getAdminHeaders(),
      cache: 'no-store',
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

  // 37.5 إعدادات قنوات التواصل (قسم انضم كشريك)
  async getPublicContactChannels() {
    try {
      const res = await fetch(`${API_BASE_URL}/customer/public/contact-channels`);
      if (res.ok) return await res.json();
    } catch (_e) {}
    return {
      whatsappEnabled: true,
      whatsappPhone: "201000000000",
      whatsappMessage: "مرحباً، أرغب في تسجيل مطعمي بالمنظومة والاستفسار عن تفاصيل الاشتراك",
      facebookEnabled: true,
      facebookUrl: "https://facebook.com",
      phoneEnabled: true,
      phoneNumber: "+201000000000",
    };
  },

  async getAdminContactChannels() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/contact-channels`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات قنوات التواصل');
    return data;
  },

  async updateAdminContactChannels(settings: {
    whatsappEnabled?: boolean;
    whatsappPhone?: string;
    whatsappMessage?: string;
    facebookEnabled?: boolean;
    facebookUrl?: string;
    phoneEnabled?: boolean;
    phoneNumber?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/admin/settings/contact-channels`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ إعدادات قنوات التواصل');
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
    driverUnacceptedAlertEnabled?: boolean;
    driverUnacceptedDelayMinutes?: number;
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

  // 40.5 حقن البيانات التجريبية الشاملة (مطاعم + منيو + بانرات + كوبونات + طيارين)
  async seedMockData() {
    const res = await fetch(`${API_BASE_URL}/admin/seed-mock-data`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حقن البيانات التجريبية');
    return data;
  },

  // 40.6 حقن وتحديث منيو مطعم ديفادو بالكامل
  async seedDivadoMenu() {
    const res = await fetch(`${API_BASE_URL}/admin/seed-divado`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استيراد منيو ديفادو');
    return data;
  },

  // 41. إعدادات الصوت العامة وإدارة النغمات المخصصة
  async getPublicSoundSettings() {
    try {
      const res = await fetch(`${API_BASE_URL}/public/sound-settings`);
      const data = await res.json();
      return data;
    } catch (_e) {
      return { success: true, enabled: true, soundUrl: '', volume: 1.0 };
    }
  },

  async getAdminSoundSettings() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/sound`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات صوت الإشعارات');
    return data;
  },

  async updateAdminSoundSettings(settings: {
    enabled?: boolean;
    soundUrl?: string;
    soundName?: string;
    volume?: number;
  }) {
    const res = await fetch(`${API_BASE_URL}/admin/settings/sound`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ إعدادات صوت الإشعارات');
    return data;
  },

  async resetAdminSoundSettings() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/sound/reset`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استعادة نغمة الإشعارات الافتراضية');
    return data;
  },

  // 42. إدارة كباتن التوصيل (الطيارين) من لوحة تحكم الأدمن
  async getAdminDrivers() {
    const res = await fetch(`${API_BASE_URL}/admin/drivers`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب قائمة كباتن التوصيل');
    return data;
  },

  async createAdminDriver(driverData: {
    name: string;
    phone: string;
    username: string;
    password: string;
    isAllBranches: boolean;
    branchIds: string[];
    primaryBranchId?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/admin/drivers`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(driverData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة كابتن التوصيل');
    return data;
  },

  async updateAdminDriver(
    id: string,
    driverData: {
      name?: string;
      phone?: string;
      username?: string;
      password?: string;
      isActive?: boolean;
      isAllBranches?: boolean;
      branchIds?: string[];
      primaryBranchId?: string;
    }
  ) {
    const res = await fetch(`${API_BASE_URL}/admin/drivers/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(driverData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل بيانات كابتن التوصيل');
    return data;
  },

  async toggleAdminDriverActive(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/drivers/${id}/toggle-active`, {
      method: 'PATCH',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تغيير حالة كابتن التوصيل');
    return data;
  },

  async deleteAdminDriver(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/drivers/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف كابتن التوصيل');
    return data;
  },

  // 46. تقرير الحسابات والمالية الشامل وحسابات الشيفتات والدليفري
  async getFinanceReport(params: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    shiftMode?: string;
    shiftDate?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params.branchId) searchParams.append('branchId', params.branchId);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate) searchParams.append('endDate', params.endDate);
    if (params.shiftMode) searchParams.append('shiftMode', params.shiftMode);
    if (params.shiftDate) searchParams.append('shiftDate', params.shiftDate);

    const res = await fetch(`${API_BASE_URL}/admin/finance/report?${searchParams.toString()}`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب التقرير المالي وحسابات الشيفتات');
    return data;
  },

  // 47. إعدادات موقع المطعم الرئيسي والخرائط الجغرافية (GPS)
  async getRestaurantLocationSettings() {
    const res = await fetch(`${API_BASE_URL}/admin/settings/restaurant-location`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب إعدادات موقع المطعم');
    return data;
  },

  async updateRestaurantLocationSettings(settings: { name?: string; address?: string; lat: number; lng: number }) {
    const res = await fetch(`${API_BASE_URL}/admin/settings/restaurant-location`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ إعدادات موقع المطعم');
    return data;
  },

  async getPublicRestaurantLocation() {
    const res = await fetch(`${API_BASE_URL}/customer/public/restaurant-location`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب موقع المطعم');
    return data;
  },

  // إدارة تذاكر الدعم الفني في لوحة الإدارة
  async getAdminSupportTickets() {
    const res = await fetch(`${API_BASE_URL}/admin/support-tickets`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب تذاكر الدعم الفني');
    return data;
  },

  async updateAdminSupportTicket(id: string, updates: { status?: string; adminNotes?: string }) {
    const res = await fetch(`${API_BASE_URL}/admin/support-tickets/${id}`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث تذكرة الدعم');
    return data;
  },

  async deleteAdminSupportTicket(id: string) {
    const res = await fetch(`${API_BASE_URL}/admin/support-tickets/${id}`, {
      method: 'DELETE',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف تذكرة الدعم');
    return data;
  },

  async getPublicSupportContact() {
    try {
      const res = await fetch(`${API_BASE_URL}/customer/public/support-contact`);
      const data = await res.json();
      return data;
    } catch {
      return {
        whatsappPhone: '01016629986',
        cleanPhone: '201016629986',
        whatsappUrl: 'https://wa.me/201016629986',
      };
    }
  },

  async getAdminSupportSettings() {
    const res = await fetch(`${API_BASE_URL}/admin/support-settings`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع إعدادات الدعم');
    return data;
  },

  async updateAdminSupportSettings(whatsappPhone: string) {
    const res = await fetch(`${API_BASE_URL}/admin/support-settings`, {
      method: 'PUT',
      headers: getAdminHeaders(),
      body: JSON.stringify({ whatsappPhone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ إعدادات الدعم');
    return data;
  },

  // ==========================================
  // Branch / Restaurant Manager API Methods
  // ==========================================
  async branchLogin(username: string, password: string, portal: string = 'MANAGER') {
    const res = await fetch(`${API_BASE_URL}/branch/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, portal }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تسجيل دخول المطعم');
    return data;
  },

  async branchChangePassword(currentPassword: string, newPassword: string) {
    const res = await fetch(`${API_BASE_URL}/branch/change-password`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تغيير كلمة المرور');
    return data;
  },

  async getBranchProfile() {
    const res = await fetch(`${API_BASE_URL}/branch/profile`, {
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب بيانات المطعم');
    return data;
  },

  async updateBranchDetails(dataObj: any) {
    const res = await fetch(`${API_BASE_URL}/branch/details`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(dataObj),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث بيانات المطعم');
    return data;
  },

  async updateBranchOperationalStatus(status: 'OPEN' | 'BUSY' | 'CLOSED', durationMinutes?: number, reason?: string) {
    const res = await fetch(`${API_BASE_URL}/branch/operational-status`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify({ status, durationMinutes, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث حالة المطعم');
    return data;
  },

  async updateBranchPaymentMethods(dataObj: any) {
    const res = await fetch(`${API_BASE_URL}/branch/payment-methods`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(dataObj),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث طرق الدفع');
    return data;
  },

  async updateBranchWorkingHours(dataObj: any) {
    const res = await fetch(`${API_BASE_URL}/branch/settings/working-hours`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(dataObj),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث مواعيد العمل');
    return data;
  },

  async updateBranchSettingsPassword(currentPassword?: string, newPassword?: string | null) {
    const res = await fetch(`${API_BASE_URL}/branch/settings-password`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث رمز حماية الإعدادات');
    return data;
  },

  async getBranchOrders(status?: string) {
    const url = status ? `${API_BASE_URL}/branch/orders?status=${status}` : `${API_BASE_URL}/branch/orders`;
    const res = await fetch(url, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع الطلبات');
    return data;
  },

  async updateBranchOrderStatus(id: string, status: string, extraData?: any) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${id}/status`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify({ status, ...extraData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث حالة الطلب');
    return data;
  },

  async proposeOrderAddon(orderId: string, payload: { name: string; price: number; note?: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/propose-addon`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال اقتراح الإضافة');
    return data;
  },

  async assignBranchDriver(orderId: string, driverId: string | null) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/assign-driver`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify({ driverId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعيين كابتن التوصيل');
    return data;
  },

  async getBranchMenuManagement() {
    const res = await fetch(`${API_BASE_URL}/branch/menu`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب قائمة المنيو');
    return data;
  },

  async createBranchCategory(name: string, displayOrder = 0, isDealsCategory = false) {
    const res = await fetch(`${API_BASE_URL}/branch/categories`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify({ name, displayOrder, isDealsCategory }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء القسم');
    return data;
  },

  async updateBranchCategory(id: string, name: string, displayOrder: number, isDealsCategory?: boolean) {
    const res = await fetch(`${API_BASE_URL}/branch/categories/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify({ name, displayOrder, isDealsCategory }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث القسم');
    return data;
  },

  async deleteBranchCategory(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/categories/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف القسم');
    return data;
  },

  async reorderBranchMenu(payload: { categoryIds?: string[]; itemsByCategory?: Record<string, string[]> }) {
    const res = await fetch(`${API_BASE_URL}/branch/menu/reorder`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ ترتيب المنيو');
    return data;
  },

  async createBranchItem(itemData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/items`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(itemData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة الوجبة');
    return data;
  },

  async updateBranchItem(id: string, itemData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(itemData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث الوجبة');
    return data;
  },

  async toggleBranchItemAvailability(id: string, isAvailable: boolean, durationMinutes?: number) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${id}/availability`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify({ isAvailable, durationMinutes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل حالة توفر الصنف');
    return data;
  },

  async deleteBranchItem(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الوجبة');
    return data;
  },

  async importBranchBulkMenu(payload: { items: any[]; replaceExisting?: boolean }) {
    const res = await fetch(`${API_BASE_URL}/branch/menu/import-bulk`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استيراد الأصناف');
    return data;
  },

  async getBranchModifierGroups() {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب مجموعات الإضافات');
    return data;
  },

  async createBranchModifierGroup(groupData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(groupData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء قسم الإضافات');
    return data;
  },

  async updateBranchModifierGroup(id: string, groupData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(groupData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث قسم الإضافات');
    return data;
  },

  async deleteBranchModifierGroup(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف قسم الإضافات');
    return data;
  },

  async addBranchModifierOption(groupId: string, optionData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${groupId}/options`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(optionData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة خيار الإضافة');
    return data;
  },

  async updateBranchModifierOption(id: string, dataObj: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-options/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(dataObj),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل خيار الإضافة');
    return data;
  },

  async deleteBranchModifierOption(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-options/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف خيار الإضافة');
    return data;
  },

  async linkBranchModifierGroupTargets(groupId: string, payload: { categoryIds?: string[]; itemIds?: string[]; action?: 'LINK' | 'UNLINK' }) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${groupId}/bulk-link-targets`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل ربط الإضافات');
    return data;
  },

  async getBranchDeliveryZones() {
    const res = await fetch(`${API_BASE_URL}/branch/delivery-zones`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع مناطق التوصيل');
    return data;
  },

  async addBranchDeliveryZone(name: string, fee: number) {
    const res = await fetch(`${API_BASE_URL}/branch/delivery-zones`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify({ name, fee }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة منطقة التوصيل');
    return data;
  },

  async deleteBranchDeliveryZone(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/delivery-zones/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف منطقة التوصيل');
    return data;
  },

  async getBranchDrivers() {
    const res = await fetch(`${API_BASE_URL}/branch/drivers`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع كباتن التوصيل');
    return data;
  },

  async createBranchDriver(driverData: { name: string; phone: string; username: string; password: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/drivers`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(driverData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة كابتن التوصيل');
    return data;
  },

  async updateBranchDriver(id: string, driverData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/drivers/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(driverData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث بيانات الكابتن');
    return data;
  },

  async deleteBranchDriver(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/drivers/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف كابتن التوصيل');
    return data;
  },

  async getBranchSupportTickets() {
    const res = await fetch(`${API_BASE_URL}/branch/support-tickets`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع بلاغات العملاء');
    return data;
  },

  async updateBranchSupportTicket(id: string, payload: { status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; branchNotes?: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/support-tickets/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث الشكوى');
    return data;
  },

  async getBranchStats() {
    const res = await fetch(`${API_BASE_URL}/branch/stats`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع إحصائيات الفرع');
    return data;
  },

  async getBranchFlashDeals() {
    const res = await fetch(`${API_BASE_URL}/branch/flash-deals`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع عروض المتجر');
    return data;
  },

  async createBranchFlashDeal(dealData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/flash-deals`, {
      method: 'POST',
      headers: getBranchHeaders(),
      body: JSON.stringify(dealData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء العرض');
    return data;
  },

  async updateBranchFlashDeal(id: string, dealData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/flash-deals/${id}`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(dealData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل العرض');
    return data;
  },

  async deleteBranchFlashDeal(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/flash-deals/${id}`, {
      method: 'DELETE',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف العرض');
    return data;
  },

  async toggleBranchFlashDeal(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/flash-deals/${id}/toggle`, {
      method: 'PATCH',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل حالة العرض');
    return data;
  },

  async getBranchCustomers() {
    const res = await fetch(`${API_BASE_URL}/branch/customers`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع عملاء المتجر');
    return data;
  },

  async updateBranchCustomerCrm(userId: string, dataObj: { isBlocked?: boolean; restaurantNotes?: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/customers/${userId}/crm`, {
      method: 'PUT',
      headers: getBranchHeaders(),
      body: JSON.stringify(dataObj),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث بيانات العميل');
    return data;
  },

  async unblockBranchCustomer(userId: string) {
    const res = await fetch(`${API_BASE_URL}/branch/customers/${userId}/unblock`, {
      method: 'POST',
      headers: getBranchHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل فك حظر العميل');
    return data;
  },

  async getBranchReviews() {
    const res = await fetch(`${API_BASE_URL}/branch/reviews`, { headers: getBranchHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع تقييمات المتجر');
    return data;
  },

  // 35. خدمات بوابة الرسائل SMS Gateway
  async getSmsConfig() {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/config`);
    const data = await res.json();
    return data;
  },

  async getSmsGatewayOverview() {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/overview`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب بيانات بوابة الرسائل');
    return data;
  },

  async updateSmsGatewaySettings(channelMode: string) {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/settings`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ channelMode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث إعدادات بوابة الرسائل');
    return data;
  },

  async regenerateSmsGatewayKey(deviceId?: string) {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/regenerate-key`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ deviceId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تجديد مفتاح الجهاز');
    return data;
  },

  async sendTestSms(phone: string, message?: string) {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/test-sms`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إرسال الرسالة التجريبية');
    return data;
  },

  async sendSmsMarketingCampaign(numbers: string[], message: string, title?: string) {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/campaign`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ numbers, message, title }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إطلاق الحملة التسويقية');
    return data;
  },

  async getRegisteredCustomerPhones() {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/registered-customer-phones`, {
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استيراد أرقام العملاء');
    return data;
  },

  async cancelPendingMarketingSms() {
    const res = await fetch(`${API_BASE_URL}/sms-gateway/admin/cancel-pending-marketing`, {
      method: 'POST',
      headers: getAdminHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إلغاء الرسائل التسويقية');
    return data;
  },
};



