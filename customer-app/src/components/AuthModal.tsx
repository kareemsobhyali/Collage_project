import React, { useState } from 'react';
import { User, Phone, Lock, X, ArrowLeft, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface AuthModalProps {
  onSuccess: (user: any, token: string) => void;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await api.login(phone.trim(), password);
      } else {
        if (!name.trim()) throw new Error('الرجاء إدخال الاسم بالكامل');
        const cleanPhone = phone.trim();
        if (!/^01[0125][0-9]{8}$/.test(cleanPhone)) {
          throw new Error('يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015');
        }
        res = await api.register(name.trim(), cleanPhone, password);
      }

      localStorage.setItem('customer_token', res.token);
      localStorage.setItem('customer_user', JSON.stringify(res.user));
      onSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء المعالجة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 animate-fadeIn backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto modal-scroll p-6 shadow-2xl relative pb-safe">
        {/* Mobile drag handle */}
        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0" />
        <button
          onClick={onClose}
          className="absolute left-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center font-black text-xl mb-3">
            🎓
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {isLogin ? 'تسجيل الدخول' : 'حساب طالب جديد'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isLogin ? 'سجل دخولك لتتمكن من إتمام الطلب ومتابعته' : 'أنشئ حسابك في ثوانٍ برقم موبايل مصري'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالكامل</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  placeholder="مثال: أحمد محمود"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                  required={!isLogin}
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">رقم الهاتف (موبايل مصري)</label>
              {!isLogin && (
                <span className="text-[10px] font-mono text-indigo-600 font-bold">010 / 011 / 012 / 015</span>
              )}
            </div>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="tel"
                maxLength={11}
                placeholder="010XXXXXXXX (11 رقماً)"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white font-mono tracking-wider"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'جاري التحقق...' : isLogin ? 'دخول الحساب' : 'إنشاء الحساب الآن'}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-xs font-bold text-indigo-600 hover:underline block mx-auto"
          >
            {isLogin ? 'ليس لديك حساب؟ أنشئ حساباً الآن' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
          </button>
        </div>
      </div>
    </div>
  );
};
