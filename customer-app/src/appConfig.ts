/**
 * UniFood / Restaurant White-Label Master Configuration
 * ====================================================
 * يمكنك تغيير نمط التطبيق من هذا الملف بسهولة:
 * 1. نمط 'SINGLE_RESTAURANT': يعمل التطبيق بالكامل لصالح مطعم واحد محدد، ويفتح فوراً على المنيو الخاص به.
 * 2. نمط 'MULTI_RESTAURANT': يعمل كمنصة متعددة المطاعم للحرم الجامعي (الوضع الأصلي).
 */

export interface RestaurantAppConfig {
  // نمط تشغيل التطبيق
  mode: 'SINGLE_RESTAURANT' | 'MULTI_RESTAURANT';
  
  // معرّف المطعم المستهدف عند تفعيل نمط SINGLE_RESTAURANT
  // (يمكن نسخه بضغطة زر واحدة من لوحة تحكم الإدارة العليا عبر زر "كود الـ APK")
  singleRestaurant: {
    branchId?: string;
    slug?: string;
  };

  // الهوية البصرية والبراند المخصص
  brand: {
    name: string;
    tagline: string;
    subTagline?: string;
    logoUrl?: string;
    themeColor?: string;
    accentColor?: string;
  };

  // معلومات التواصل
  contact: {
    phone?: string;
    whatsappNumber?: string;
    currency: string;
  };
}

export const APP_CONFIG: RestaurantAppConfig = {
  // غيّر هذه القيمة إلى 'SINGLE_RESTAURANT' لتشغيل التطبيق لمطعم منفرد فوراً
  mode: 'MULTI_RESTAURANT',

  singleRestaurant: {
    branchId: '',
    slug: '',
  },

  brand: {
    name: 'UniFood',
    tagline: 'وجبتك السخنة لحد عندك في ثواني! 🍔',
    subTagline: 'مطاعم الحرم الجامعي متجمعة لك في تطبيق واحد',
    logoUrl: '',
    themeColor: '#4f46e5',
  },

  contact: {
    phone: '',
    whatsappNumber: '',
    currency: 'ج.م',
  },
};
