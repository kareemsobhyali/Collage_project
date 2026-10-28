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
      const prevApi = localStorage.getItem('unifood_remote_api_url');
      localStorage.setItem('unifood_remote_api_url', cleanApi);
      localStorage.setItem('unifood_remote_web_url', cleanWeb);
      // إذا تغير الرابط على GitHub أثناء تشغيل التطبيق، إشعار المكونات
      if (prevApi && prevApi !== cleanApi) {
        window.dispatchEvent(new CustomEvent('unifood_server_changed', { detail: { apiUrl: cleanApi, webUrl: cleanWeb } }));
      }
      return { apiUrl: cleanApi, webUrl: cleanWeb };
    }
  } catch (_e) {}
  return null;
}

export const getPublicWebUrl = (): string => {
  if (typeof window === 'undefined') return 'https://unifood.store';
  try {
    localStorage.removeItem('unifood_pos_api_url');
    const remoteWeb = localStorage.getItem('unifood_remote_web_url');
    if (remoteWeb && remoteWeb.trim()) return remoteWeb.trim();
    const remoteApi = localStorage.getItem('unifood_remote_api_url');
    if (remoteApi && remoteApi.trim()) {
      return remoteApi.trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
    }
  } catch {}

  if (typeof window !== 'undefined' && window.location.origin && window.location.protocol !== 'file:') {
    return window.location.origin;
  }
  return 'https://unifood.store';
};

export const getApiHost = () => (typeof window !== 'undefined' ? window.location.hostname : 'localhost');

export const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return 'https://unifood.store/api';
  try {
    localStorage.removeItem('unifood_pos_api_url');
    // الرابط المحدث لحظياً من GitHub (server-config.json)
    const remote = localStorage.getItem('unifood_remote_api_url');
    if (remote && remote.trim()) {
      const clean = remote.trim().replace(/\/+$/, '');
      return clean.endsWith('/api') ? clean : `${clean}/api`;
    }
  } catch {}

  if ((import.meta as any).env?.VITE_API_URL) return `${(import.meta as any).env.VITE_API_URL}/api`;
  if (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null') {
    return 'https://unifood.store/api';
  }
  if (window.location.port === '5173' || window.location.port === '5174' || window.location.port === '3000') {
    return `http://${window.location.hostname || 'localhost'}:5000/api`;
  }
  return `${window.location.origin}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

export const getFullImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (typeof window !== 'undefined' && window.location.protocol !== 'file:' && window.location.port !== '5173' && window.location.port !== '5174' && window.location.port !== '3000' && url.includes(':5000/uploads/')) {
      const idx = url.indexOf('/uploads/');
      return `${window.location.origin}${url.substring(idx)}`;
    }
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
    if (window.location.port === '5173' || window.location.port === '5174' || window.location.port === '3000') {
      return `http://${window.location.hostname || 'localhost'}:5000${cleanPath}`;
    }
    return `${window.location.origin}${cleanPath}`;
  }
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${baseUrl}${cleanPath}`;
};

function getHeaders(isFormData: boolean = false): HeadersInit {
  const token = localStorage.getItem('branch_token');
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
  // 1. تسجيل الدخول
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE_URL}/branch/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تسجيل الدخول');
    return data;
  },

  // 2. الملف الشخصي
  async getProfile() {
    const res = await fetch(`${API_BASE_URL}/branch/profile`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع البيانات');
    return data;
  },

  // 2.5 تحديث حالة عمل الفرع (مفتوح / مغلق مؤقتاً مع مدة / مغلق تماماً)
  async updateOperationalStatus(status: 'OPEN' | 'BUSY' | 'CLOSED', durationMinutes?: number, reason?: string) {
    const res = await fetch(`${API_BASE_URL}/branch/operational-status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, durationMinutes, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث حالة عمل الفرع');
    return data;
  },

  // 2.6 تحديث بيانات المطعم (الاسم، الهاتف، العنوان، رسوم التوصيل، التوصيل والاستلام، اللوجو)
  async updateBranchDetails(data: {
    name: string;
    phone?: string;
    address?: string;
    logoUrl?: string;
    deliveryFee?: number;
    deliveryType?: 'FIXED' | 'ZONES';
    allowDelivery?: boolean;
    allowPickup?: boolean;
  }) {
    const res = await fetch(`${API_BASE_URL}/branch/details`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'فشل تحديث بيانات الفرع');
    return result;
  },

  // 2.65 إدارة مناطق التوصيل المخصصة
  async getDeliveryZones() {
    const res = await fetch(`${API_BASE_URL}/branch/delivery-zones`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب مناطق التوصيل');
    return data;
  },

  async addDeliveryZone(name: string, fee: number) {
    const res = await fetch(`${API_BASE_URL}/branch/delivery-zones`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, fee }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة منطقة التوصيل');
    return data;
  },

  async deleteDeliveryZone(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/delivery-zones/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف منطقة التوصيل');
    return data;
  },

  // 2.7 تحديث طرق الدفع الخاصة بالفرع
  async updateBranchPaymentMethods(data: {
    cashEnabled?: boolean;
    vodafoneCashEnabled?: boolean;
    vodafoneCashNumber?: string;
    instapayEnabled?: boolean;
    instapayHandle?: string;
    cardEnabled?: boolean;
  }) {
    const res = await fetch(`${API_BASE_URL}/branch/payment-methods`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'فشل تحديث طرق الدفع');
    return result;
  },

  // 3. الطلبات
  async getOrders(status?: string) {
    const url = status 
      ? `${API_BASE_URL}/branch/orders?status=${status}` 
      : `${API_BASE_URL}/branch/orders`;
    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب الطلبات');
    return data;
  },

  async updateOrderStatus(orderId: string, status: string, estimatedMinutes?: number, reason?: string) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, estimatedMinutes, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث حالة الطلب');
    return data;
  },

  // 4. المنيو
  async getMenu() {
    const res = await fetch(`${API_BASE_URL}/branch/menu`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل جلب المنيو');
    return data;
  },

  // الأقسام
  async createCategory(name: string, displayOrder: number = 0) {
    const res = await fetch(`${API_BASE_URL}/branch/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, displayOrder }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء القسم');
    return data;
  },

  async updateCategory(id: string, name: string, displayOrder: number) {
    const res = await fetch(`${API_BASE_URL}/branch/categories/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, displayOrder }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل القسم');
    return data;
  },

  async deleteCategory(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف القسم');
    return data;
  },

  // الأصناف
  async createItem(itemData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/items`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(itemData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة الصنف');
    return data;
  },

  async updateItem(id: string, itemData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(itemData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل الصنف');
    return data;
  },

  async toggleItemAvailability(id: string, isAvailable: boolean, durationMinutes?: number) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${id}/availability`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ isAvailable, durationMinutes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث حالة الصنف');
    return data;
  },

  async deleteItem(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الصنف');
    return data;
  },

  // استيراد منيو كامل مجمع (Excel / CSV) مع حفظ الصور محلياً
  async importBulkMenu(payload: { items: any[]; replaceExisting?: boolean }) {
    const res = await fetch(`${API_BASE_URL}/branch/menu/import-bulk`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استيراد المنيو');
    return data;
  },

  // تعديل جماعي ومجمع للأصناف دفعة واحدة
  async bulkUpdateItems(items: any[]) {
    const res = await fetch(`${API_BASE_URL}/branch/items/bulk-update`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حفظ التعديلات الجماعية');
    return data;
  },

  // مجموعات الإضافات
  async createModifierGroup(groupData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(groupData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إنشاء مجموعة الإضافات');
    return data;
  },

  async addModifierOption(groupId: string, optionData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${groupId}/options`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(optionData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة خيار الإضافة');
    return data;
  },

  async updateModifierOption(id: string, dataObj: any) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-options/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(dataObj),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل خيار الإضافة');
    return data;
  },

  async updateModifierGroup(id: string, groupData: { title?: string; isRequired?: boolean; minSelection?: number; maxSelection?: number }) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(groupData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تعديل مجموعة الإضافات');
    return data;
  },

  async deleteModifierGroup(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف مجموعة الإضافات');
    return data;
  },

  async deleteModifierOption(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-options/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف خيار الإضافة');
    return data;
  },

  async linkModifiersToItem(itemId: string, modifierGroupIds: string[]) {
    const res = await fetch(`${API_BASE_URL}/branch/items/${itemId}/link-modifiers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ modifierGroupIds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل ربط الإضافات بالصنف');
    return data;
  },

  // رفع الصور
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

  // إدارة الطيارين (الدليفري)
  async getDrivers() {
    const res = await fetch(`${API_BASE_URL}/branch/drivers`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع بيانات الطيارين');
    return data;
  },

  async createDriver(driverData: { name: string; phone: string; username: string; password: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/drivers`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(driverData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إضافة الطيار');
    return data;
  },

  async updateDriver(id: string, driverData: any) {
    const res = await fetch(`${API_BASE_URL}/branch/drivers/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(driverData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث بيانات الطيار');
    return data;
  },

  async deleteDriver(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/drivers/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف الطيار');
    return data;
  },

  async assignDriver(orderId: string, driverId: string | null) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/assign-driver`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ driverId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل إسناد الطلب للطيار');
    return data;
  },

  async getBranchReturnPin(orderId: string) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/return-pin`, {
      method: 'GET',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل توليد رمز استلام الطلب');
    return data;
  },

  async confirmReturnFromDriver(orderId: string) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/confirm-return-from-driver`, {
      method: 'POST',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استلام الطلب من الطيار');
    return data;
  },

  // تبديل التوفر السريع (مع دعم النفاد المؤقت لفترة للأصناف والإضافات)
  async quickToggleStock(payload: { type: 'item' | 'modifier'; id: string; isAvailable: boolean; durationMinutes?: number }) {
    const res = await fetch(`${API_BASE_URL}/branch/quick-toggle-stock`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث توفر الصنف');
    return data;
  },

  // مهلة تجهيز الطلبات المجدولة قبل موعد الاستلام
  async updateScheduledLeadMins(leadMins: number) {
    const res = await fetch(`${API_BASE_URL}/branch/settings/schedule-lead`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ leadMins }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث مهلة التجهيز المسبق');
    return data;
  },

  // مواعيد العمل الرسمية
  async updateWorkingHours(payload: { openingTime?: string; closingTime?: string; workingDays?: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/settings/working-hours`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث مواعيد العمل');
    return data;
  },

  // إدارة ملاحظات وحظر العميل (Customer CRM)
  async updateCustomerCRM(userId: string, payload: { restaurantNotes?: string; isBlocked?: boolean }) {
    const res = await fetch(`${API_BASE_URL}/branch/customers/${userId}/crm`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث ملاحظات أو حالة العميل');
    return data;
  },

  // استعلام طابعات الويندوز من السيرفر (عند تشغيله محلياً)
  async getSystemPrinters() {
    try {
      const res = await fetch(`${API_BASE_URL}/branch/system-printers`, {
        headers: getHeaders(),
      });
      const data = await res.json();
      return data?.printers || [];
    } catch (_e) {
      return [];
    }
  },

  // جلب إعدادات صوت التنبيهات المخصصة
  async getPublicSoundSettings() {
    try {
      const res = await fetch(`${API_BASE_URL}/public/sound-settings`);
      const data = await res.json();
      return data;
    } catch (_e) {
      return { success: true, enabled: true, soundUrl: '', volume: 1.0 };
    }
  },

  // 15. استعلام وتحديث شكاوى العملاء الخاصة بالفرع
  async getSupportTickets() {
    const res = await fetch(`${API_BASE_URL}/branch/support-tickets`, {
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل استرجاع بلاغات الدعم والشكاوى');
    return data.tickets || [];
  },

  async updateSupportTicket(id: string, payload: { status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; branchNotes?: string }) {
    const res = await fetch(`${API_BASE_URL}/branch/support-tickets/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل تحديث الشكوى');
    return data.ticket;
  },
};
