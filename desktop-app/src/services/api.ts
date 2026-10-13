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

  async updateOrderStatus(orderId: string, status: string, estimatedMinutes?: number) {
    const res = await fetch(`${API_BASE_URL}/branch/orders/${orderId}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status, estimatedMinutes }),
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

  async deleteModifierGroup(id: string) {
    const res = await fetch(`${API_BASE_URL}/branch/modifier-groups/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل حذف مجموعة الإضافات');
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
};
