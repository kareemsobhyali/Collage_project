import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check, Image as ImageIcon, MessageSquare, Sparkles } from 'lucide-react';
import { getFullImageUrl } from '../services/api';

interface ItemCustomizeModalProps {
  item: any;
  onAddToCart: (cartItem: any) => void;
  onClose: () => void;
}

interface ComboOffer {
  id: string;
  title: string;
  description?: string;
  price: number;
  badge?: string;
}

export const ItemCustomizeModal: React.FC<ItemCustomizeModalProps> = ({
  item,
  onAddToCart,
  onClose,
}) => {
  // الحجم الافتراضي
  const [selectedSize, setSelectedSize] = useState<any | null>(
    item.sizes && item.sizes.length > 0 ? item.sizes[0] : null
  );

  // الإضافات المختارة: Record<groupId, option[]>
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, any[]>>({});
  // عروض الكومبو المخصصة للصنف من إدارة المطعم
  const [selectedComboIds, setSelectedComboIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');

  // استخراج عروض الكومبو الخاصة بهذا الصنف إن وجدت
  const comboOffers: ComboOffer[] = useMemo(() => {
    if (!item.comboItems) return [];
    try {
      const parsed = typeof item.comboItems === 'string' ? JSON.parse(item.comboItems) : item.comboItems;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((c: any) => c && c.title)
        .map((c: any, idx: number) => ({
          id: c.id || `combo-${idx}`,
          title: String(c.title),
          description: c.description ? String(c.description) : undefined,
          price: Number(c.price) || 0,
          badge: c.badge ? String(c.badge) : undefined,
        }));
    } catch {
      return [];
    }
  }, [item.comboItems]);

  // حساب سعر الوحدة
  const basePrice = selectedSize ? selectedSize.price : item.basePrice;
  let modifiersExtra = 0;
  Object.values(selectedModifiers).forEach((opts) => {
    opts.forEach((opt) => {
      modifiersExtra += opt.price || 0;
    });
  });

  const combosExtra = comboOffers
    .filter((c) => selectedComboIds.includes(c.id))
    .reduce((sum, c) => sum + (c.price || 0), 0);

  const unitPrice = basePrice + modifiersExtra + combosExtra;
  const totalPrice = unitPrice * quantity;

  // تبديل اختيار إضافة
  const handleToggleOption = (group: any, option: any) => {
    const current = selectedModifiers[group.id] || [];
    const exists = current.some((o) => o.id === option.id);

    if (exists) {
      setSelectedModifiers({
        ...selectedModifiers,
        [group.id]: current.filter((o) => o.id !== option.id),
      });
    } else {
      if (group.maxSelection === 1) {
        setSelectedModifiers({
          ...selectedModifiers,
          [group.id]: [option],
        });
      } else if (current.length < group.maxSelection) {
        setSelectedModifiers({
          ...selectedModifiers,
          [group.id]: [...current, option],
        });
      }
    }
  };

  const handleToggleCombo = (comboId: string) => {
    setSelectedComboIds((prev) =>
      prev.includes(comboId) ? prev.filter((id) => id !== comboId) : [...prev, comboId]
    );
  };

  const linkedGroups = item.modifierGroupLinks?.map((l: any) => l.group).filter(Boolean) || [];

  const handleAdd = () => {
    // التحقق من المجموعات الإجبارية
    for (const group of linkedGroups) {
      if (group.isRequired) {
        const chosen = selectedModifiers[group.id] || [];
        const minReq = Math.max(1, group.minSelection || 1);
        if (chosen.length < minReq) {
          alert(`يرجى اختيار (${group.title}) أولاً قبل إضافة الصنف للسلة.`);
          return;
        }
      }
    }

    // جمع كل الإضافات المختارة في مصفوفة واحدة
    const flatModifiers: any[] = [];
    Object.entries(selectedModifiers).forEach(([groupId, opts]) => {
      const link = item.modifierGroupLinks?.find((l: any) => l.groupId === groupId);
      const title = link?.group?.title || 'إضافة';
      opts.forEach((opt) => {
        flatModifiers.push({
          groupId,
          groupTitle: title,
          optionId: opt.id,
          optionName: opt.name,
          price: opt.price,
        });
      });
    });

    // إضافة عروض الكومبو المختارة
    comboOffers
      .filter((c) => selectedComboIds.includes(c.id))
      .forEach((c) => {
        flatModifiers.push({
          groupId: 'combo',
          groupTitle: 'عروض الكومبو',
          optionId: c.id,
          optionName: c.title,
          price: c.price,
        });
      });

    onAddToCart({
      menuItemId: item.id,
      itemName: item.name,
      imageUrl: item.imageUrl,
      sizeName: selectedSize ? selectedSize.name : null,
      sizePrice: selectedSize ? selectedSize.price : null,
      selectedModifiers: flatModifiers,
      notes: notes.trim() || undefined,
      unitPrice,
      quantity,
      totalPrice,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0 z-20" />

        {/* Top Header */}
        <div className="relative">
          {item.imageUrl ? (
            <img
              src={getFullImageUrl(item.imageUrl)}
              alt={item.name}
              className="w-full h-44 object-cover"
            />
          ) : (
            <div className="w-full h-32 bg-slate-100 flex items-center justify-center text-slate-400">
              <ImageIcon className="w-10 h-10" />
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto modal-scroll flex-1 space-y-5">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900">{item.name}</h3>
            {item.description && (
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {item.description}
              </p>
            )}
            <div className="text-base font-black text-indigo-700 mt-2">
              يبدأ من {item.basePrice} ج.م
            </div>
          </div>

          {/* Sizes Selection */}
          {item.sizes && item.sizes.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800">اختر الحجم</span>
                <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">إجباري</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {item.sizes.map((size: any) => {
                  const isSelected = selectedSize?.id === size.id;
                  return (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() => setSelectedSize(size)}
                      className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-200 text-indigo-900 font-bold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black">{size.name}</div>
                        <div className="text-[11px] text-slate-500">{size.price} ج.م</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Modifier Groups */}
          {linkedGroups.map((group: any) => {
            const currentSelected = selectedModifiers[group.id] || [];
            const availableOptions = (group.options || []).filter((o: any) => o.isAvailable !== false);

            if (availableOptions.length === 0) return null;

            return (
              <div key={group.id} className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-800">{group.title}</span>
                    <span className="text-[11px] text-slate-400 block">
                      (الحد الأقصى: {group.maxSelection})
                    </span>
                  </div>
                  {group.isRequired ? (
                    <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">إجباري</span>
                  ) : (
                    <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">اختياري</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {availableOptions.map((opt: any) => {
                    const isChecked = currentSelected.some((o) => o.id === opt.id);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleToggleOption(group, opt)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                          isChecked
                            ? 'bg-indigo-50/70 border-indigo-400 text-indigo-900 font-bold'
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{opt.name}</span>
                        </div>
                        <span className="font-black text-indigo-700 shrink-0 whitespace-nowrap">
                          {opt.price > 0 ? `+${opt.price} ج.م` : 'مجاناً'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Dynamic Restaurant-Controlled Combo / Upsell Offers */}
          {comboOffers.length > 0 && (
            <div className="space-y-2.5 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>عروض خاصة مع هذه الوجبة</span>
              </div>

              {comboOffers.map((combo) => {
                const isSelected = selectedComboIds.includes(combo.id);
                return (
                  <div
                    key={combo.id}
                    onClick={() => handleToggleCombo(combo.id)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-50/90 border-amber-500 shadow-sm'
                        : 'bg-gradient-to-r from-amber-50/40 to-orange-50/40 border-amber-200 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-5 h-5 mt-0.5 rounded-lg flex items-center justify-center border shrink-0 transition-all ${
                          isSelected ? 'bg-amber-500 border-amber-500 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-black text-slate-900 leading-snug">
                            {combo.title}
                          </span>
                          {combo.badge && (
                            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap shrink-0">
                              {combo.badge}
                            </span>
                          )}
                        </div>
                        {combo.description && (
                          <span className="text-[11px] text-slate-600 block mt-1 leading-relaxed">
                            {combo.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="font-black text-amber-900 bg-amber-100/80 border border-amber-200 px-2.5 py-1 rounded-xl text-xs whitespace-nowrap shrink-0">
                      {combo.price > 0 ? `+${combo.price} ج.م` : 'مجاناً'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Item Notes */}
          <div className="space-y-2 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <MessageSquare className="w-4 h-4 text-indigo-600" />
              <span>ملاحظات خاصة بهذا الصنف (اختياري)</span>
            </div>
            <input
              type="text"
              placeholder="مثال: بدون بصل، صوص زيادة، العيش محمص، سبايسي خفيف..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-600 focus:bg-white focus:outline-none placeholder:text-slate-400 transition-all"
              maxLength={120}
            />
          </div>
        </div>

        {/* Footer: Quantity & Add Button */}
        <div className="p-4 border-t bg-slate-50 flex items-center gap-3 pb-safe">
          {/* Quantity Selector */}
          <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="p-1 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-black text-sm text-slate-800 w-4 text-center">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart button */}
          <button
            onClick={handleAdd}
            className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-md shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-between"
          >
            <span>إضافة إلى السلة</span>
            <span>{totalPrice} ج.م</span>
          </button>
        </div>
      </div>
    </div>
  );
};
