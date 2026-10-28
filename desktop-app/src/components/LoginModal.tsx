import React, { useState, useEffect } from 'react';
import { Lock, User, ArrowLeft, AlertCircle } from 'lucide-react';
import { api, syncRemoteServerConfig } from '../services/api';
import { Logo } from './Logo';

interface LoginModalProps {
  onLoginSuccess: (branchData: any, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // التأكد من المزامنة التلقائية مع GitHub وحذف أي رابط يدوي قديم
  useEffect(() => {
    try {
      localStorage.removeItem('unifood_pos_api_url');
      syncRemoteServerConfig();
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.login(username, password);
      localStorage.setItem('branch_token', res.token);
      localStorage.setItem('branch_info', JSON.stringify(res.branch));
      onLoginSuccess(res.branch, res.token);
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول، تأكد من صحة بيانات الفرع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-800">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <Logo size="lg" />
          </div>
          <p className="text-xs text-slate-500 mt-2 font-bold">منظومة إدارة وتوصيل طلبات المطاعم (Branch POS)</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم مستخدم الفرع</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="مثال: pizza_pos"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{loading ? 'جاري التحقق...' : 'دخول لوحة تحكم الفرع'}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">يتم إنشاء وتعيين حسابات الفروع من لوحة الإدارة المركزية</p>
        </div>
      </div>
    </div>
  );
};
