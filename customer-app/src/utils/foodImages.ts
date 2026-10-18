/**
 * صور طعام احترافية بديلة عالية الجودة للأصناف التي لم يرفع المطعم صورة لها
 * مصنفة بدقة حسب كلمات الصنف أو القسم أو نشاط المطعم للحفاظ على التناسق والجاذبية البصرية
 */

export const FOOD_FALLBACK_IMAGES: Record<string, string> = {
  // برجر بأنواعه ولحوم مشوية
  burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  // بيتزا وفطائر
  pizza: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
  // دجاج مقلي، بروستد، استربس، كرسبي
  chicken: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600&auto=format&fit=crop&q=80',
  // شاورما، كريب، ساندوتشات رول، سوري
  wrap: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=600&auto=format&fit=crop&q=80',
  // مكرونات، باستا، لازانيا، صوصات
  pasta: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281781?w=600&auto=format&fit=crop&q=80',
  // قهوة، كافيه ومشروبات ساخنة
  coffee: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600&auto=format&fit=crop&q=80',
  // عصائر، سموذي ومشروبات منعشة باردة
  drink: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=600&auto=format&fit=crop&q=80',
  // حلويات، وافل، آيس كريم، قشطوطة، بلبن
  dessert: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=600&auto=format&fit=crop&q=80',
  // مقبلات، بطاطس مقلية، سلطات، صوصات
  fries: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80',
  // فطور، كرواسون، مخبوزات وتوست
  bakery: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&auto=format&fit=crop&q=80',
  // وجبات رئيسية متكاملة، أطباق، كبسة، مشاوي
  meal: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
};

export function getItemFallbackImage(
  itemName?: string,
  categoryName: string = '',
  branchName: string = ''
): string {
  const text = `${itemName || ''} ${categoryName || ''} ${branchName || ''}`.toLowerCase();

  if (/برجر|burger|سماش|smash|بيف|beef|تشيز|cheese|لحم/.test(text)) {
    return FOOD_FALLBACK_IMAGES.burger;
  }
  if (/بيتزا|pizza|مارجريتا|بيبروني|فطير|calzone/.test(text)) {
    return FOOD_FALLBACK_IMAGES.pizza;
  }
  if (/تشيكن|دجاج|فراخ|chicken|بروستد|كرسبي|crispy|استربس|strips|زنجر|zinger|بانيه|wings/.test(text)) {
    return FOOD_FALLBACK_IMAGES.chicken;
  }
  if (/شاورما|shawarma|كريب|crepe|سوري|ساندوتش|wrap|رول|صاج|حواوشي/.test(text)) {
    return FOOD_FALLBACK_IMAGES.wrap;
  }
  if (/باستا|pasta|مكرونة|سباجيتي|لازانيا|نجرسكو|بشاميل/.test(text)) {
    return FOOD_FALLBACK_IMAGES.pasta;
  }
  if (/قهوة|كافيه|coffee|لاتيه|latte|كابتشينو|اسبريسو|espresso|شاي|tea|موكا|نسكافيه/.test(text)) {
    return FOOD_FALLBACK_IMAGES.coffee;
  }
  if (/عصير|juice|سموذي|smoothie|موهيتو|mojito|بارد|بيبسي|كولا|soda|مشروب/.test(text)) {
    return FOOD_FALLBACK_IMAGES.drink;
  }
  if (/حلى|حلو|حلويات|dessert|كيك|cake|وافل|waffle|دونات|donut|شوكولاتة|نوتيلا|بلبن|رز بلبن|قشطوطة|ايس كريم|ice cream/.test(text)) {
    return FOOD_FALLBACK_IMAGES.dessert;
  }
  if (/بطاطس|fries|بطاطا|صوص|sauce|سلطة|salad|حلقات بصل|مقبلات|appetizer/.test(text)) {
    return FOOD_FALLBACK_IMAGES.fries;
  }
  if (/فطور|breakfast|كرواسون|مخبوزات|توست|فطيرة|فول|طعمية/.test(text)) {
    return FOOD_FALLBACK_IMAGES.bakery;
  }

  return FOOD_FALLBACK_IMAGES.meal;
}
