import React, { useState, useEffect } from 'react';
import { User, Phone, Lock, X, ArrowLeft, AlertCircle, KeyRound, MessageSquare, Check, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface AuthModalProps {
  onSuccess: (user: any, token: string) => void;
  onClose: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PHONE' | 'FORGOT_OTP' | 'VERIFY_PHONE';

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, onClose }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // عداد تنازلي لإعادة إرسال كود الواتساب
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const cleanPhone = phone.trim().replace(/\s+/g, '');

  // معالجة تسجيل الدخول أو إنشاء الحساب
  const handleSubmitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let res;
      if (mode === 'LOGIN') {
        res = await api.login(cleanPhone, password);
      } else {
        if (!name.trim()) throw new Error('الرجاء إدخال الاسم بالكامل');
        if (!/^01[0125][0-9]{8}$/.test(cleanPhone)) {
          throw new Error('يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015');
        }
        res = await api.register(name.trim(), cleanPhone, password);
      }

      if (res.requireVerification) {
        setMode('VERIFY_PHONE');
        setSuccessMsg(res.message || 'تم إرسال كود ورابط التفعيل السريع إلى رقم الواتساب الخاص بك 💬');
        setResendCooldown(60);
        return;
      }

      localStorage.setItem('customer_token', res.token);
      localStorage.setItem('customer_user', JSON.stringify(res.user));
      onSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      if (err.requireVerification) {
        setMode('VERIFY_PHONE');
        setSuccessMsg(err.message || 'يرجى تفعيل رقم الهاتف أولاً. تم إرسال كود ورابط التفعيل إلى الواتساب 💬');
        setResendCooldown(60);
      } else {
        setError(err.message || 'حدث خطأ أثناء المعالجة');
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. طلب كود الواتساب
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!cleanPhone || !/^01[0125][0-9]{8}$/.test(cleanPhone)) {
      setError('يرجى إدخال رقم هاتف مصري صحيح (11 رقماً)');
      return;
    }

    try {
      setLoading(true);
      const res = await api.forgotPassword(cleanPhone);
      setSuccessMsg(res.message || 'تم إرسال كود التحقق إلى واتساب الخاص بك!');
      setMode('FORGOT_OTP');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'فشل إرسال كود التحقق');
    } finally {
      setLoading(false);
    }
  };

  // 2. إعادة إرسال الكود
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      setLoading(true);
      const res = await api.forgotPassword(cleanPhone);
      setSuccessMsg(res.message || 'تمت إعادة إرسال كود جديد إلى واتساب');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'فشل إعادة الإرسال');
    } finally {
      setLoading(false);
    }
  };

  // 3. تأكيد الكود وتعيين كلمة المرور الجديدة
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim().replace(/\s+/g, '');
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('يرجى إدخال كود التحقق المكون من 6 أرقام');
      return;
    }

    if (newPassword.length < 6) {
      setError('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين، يرجى التأكد');
      return;
    }

    try {
      setLoading(true);
      const res = await api.resetPassword(cleanPhone, cleanOtp, newPassword);
      localStorage.setItem('customer_token', res.token);
      localStorage.setItem('customer_user', JSON.stringify(res.user));
      onSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'فشل تعيين كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  // 4. تفعيل رقم الهاتف بواسطة كود الواتساب
  const handleVerifyPhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanVerifyCode = verifyCode.trim().replace(/\s+/g, '');
    if (!cleanVerifyCode || cleanVerifyCode.length !== 6) {
      setError('يرجى إدخال كود التفعيل المكون من 6 أرقام');
      return;
    }

    try {
      setLoading(true);
      const res = await api.verifyPhoneCode(cleanPhone, cleanVerifyCode);
      localStorage.setItem('customer_token', res.token);
      localStorage.setItem('customer_user', JSON.stringify(res.user));
      onSuccess(res.user, res.token);
      onClose();
    } catch (err: any) {
      setError(err.message || 'كود التفعيل غير صحيح أو انتهت صلاحيته');
    } finally {
      setLoading(false);
    }
  };

  // 5. إعادة إرسال كود ورابط التفعيل عبر الواتساب
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    try {
      setLoading(true);
      const res = await api.resendVerificationOtp(cleanPhone);
      setSuccessMsg(res.message || 'تم إرسال كود ورابط تفعيل جديد إلى واتساب الرقم 💬');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'فشل إعادة إرسال كود التفعيل');
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

        {/* Header Icon & Title */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center font-black text-xl mb-3">
            {mode === 'LOGIN' && '🍔'}
            {mode === 'REGISTER' && '✨'}
            {mode === 'FORGOT_PHONE' && '📲'}
            {mode === 'FORGOT_OTP' && '🔐'}
            {mode === 'VERIFY_PHONE' && '💬'}
          </div>
          <h2 className="text-xl font-black text-slate-900">
            {mode === 'LOGIN' && 'تسجيل الدخول'}
            {mode === 'REGISTER' && 'إنشاء حساب جديد'}
            {mode === 'FORGOT_PHONE' && 'استعادة كلمة المرور'}
            {mode === 'FORGOT_OTP' && 'تأكيد كود الواتساب'}
            {mode === 'VERIFY_PHONE' && 'تفعيل رقم الهاتف'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'LOGIN' && 'سجل دخولك لتتمكن من إتمام الطلب ومتابعته'}
            {mode === 'REGISTER' && 'أنشئ حسابك في ثوانٍ برقم موبايل مصري'}
            {mode === 'FORGOT_PHONE' && 'أدخل رقم هاتفك وسنرسل كود التحقق إلى واتساب فوراً'}
            {mode === 'FORGOT_OTP' && `تم إرسال كود التأكيد إلى واتساب الرقم ${cleanPhone}`}
            {mode === 'VERIFY_PHONE' && `تم إرسال كود ورابط التفعيل إلى واتساب الرقم ${cleanPhone}`}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. LOGIN / REGISTER FORM */}
        {(mode === 'LOGIN' || mode === 'REGISTER') && (
          <form onSubmit={handleSubmitAuth} className="space-y-3.5">
            {mode === 'REGISTER' && (
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
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">رقم الهاتف (موبايل مصري)</label>
                {mode === 'REGISTER' && (
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">كلمة المرور</label>
                {mode === 'LOGIN' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('FORGOT_PHONE');
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </button>
                )}
              </div>
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
              <span>{loading ? 'جاري التحقق...' : mode === 'LOGIN' ? 'دخول الحساب' : 'إنشاء الحساب الآن'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* 2. FORGOT PASSWORD - STEP 1: ENTER PHONE */}
        {mode === 'FORGOT_PHONE' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف المسجل بالحساب</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="tel"
                  maxLength={11}
                  placeholder="010XXXXXXXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 11))}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white font-mono tracking-wider"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>سيصلك كود مكون من 6 أرقام على تطبيق الواتساب الخاص بك.</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'جاري الإرسال...' : 'إرسال كود التحقق عبر واتساب 📲'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError(null);
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              العودة لتسجيل الدخول
            </button>
          </form>
        )}

        {/* 3. FORGOT PASSWORD - STEP 2: ENTER OTP & NEW PASSWORD */}
        {mode === 'FORGOT_OTP' && (
          <form onSubmit={handleResetPassword} className="space-y-3.5">
            {/* كود التحقق */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">كود التحقق (OTP)</label>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendOtp}
                  className={`text-[11px] font-bold flex items-center gap-1 ${
                    resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-600 hover:underline'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `إعادة الإرسال بعد (${resendCooldown} ث)` : 'إعادة الإرسال'}</span>
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono tracking-widest font-black focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                  required
                />
              </div>
            </div>

            {/* كلمة المرور الجديدة */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="password"
                  placeholder="6 أحرف أو أرقام على الأقل"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white font-mono"
                  required
                />
              </div>
            </div>

            {/* تأكيد كلمة المرور الجديدة */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="password"
                  placeholder="أعد كتابة كلمة المرور"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
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
              <span>{loading ? 'جاري الحفظ...' : 'تأكيد وتعيين كلمة المرور الجديدة 🔐'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('FORGOT_PHONE');
                setError(null);
                setSuccessMsg(null);
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              تغيير رقم الهاتف
            </button>
          </form>
        )}

        {/* 4. VERIFY PHONE - OTP & MAGIC LINK */}
        {mode === 'VERIFY_PHONE' && (
          <form onSubmit={handleVerifyPhoneCode} className="space-y-4">
            {/* بطاقة التفعيل الفوري بضغطة واحدة */}
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs">
              <div className="flex items-center gap-2 font-black text-emerald-800 mb-1">
                <span className="text-base">⚡</span>
                <span>تفعيل فوري بضغطة واحدة:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-emerald-700">
                أرسلنا لك رسالة عبر <strong>الواتساب</strong>، يمكنك الضغط مباشرة على <strong>رابط التفعيل</strong> في الرسالة لتفعيل حسابك والدخول فوراً دون الحاجة لكتابة أي كود!
              </p>
            </div>

            {/* إدخال كود الـ 6 أرقام يدوياً */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">أو اكتب كود التفعيل (6 أرقام)</label>
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResendVerification}
                  className={`text-[11px] font-bold flex items-center gap-1 ${
                    resendCooldown > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-600 hover:underline'
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>{resendCooldown > 0 ? `إعادة الإرسال بعد (${resendCooldown} ث)` : 'إعادة الإرسال'}</span>
                </button>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono tracking-widest font-black focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{loading ? 'جاري التحقق...' : 'تأكيد كود التفعيل والدخول 🚀'}</span>
              <ArrowLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError(null);
                setSuccessMsg(null);
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
            >
              العودة لتسجيل الدخول / تغيير الرقم
            </button>
          </form>
        )}

        {/* Footer switch between Login / Register */}
        {(mode === 'LOGIN' || mode === 'REGISTER') && (
          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs font-bold text-indigo-600 hover:underline block mx-auto"
            >
              {mode === 'LOGIN' ? 'ليس لديك حساب؟ أنشئ حساباً الآن' : 'لديك حساب بالفعل؟ تسجيل الدخول'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
