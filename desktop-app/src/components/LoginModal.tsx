import React, { useState } from 'react';
import { Lock, User, ArrowLeft, AlertCircle, Server, Check, Settings, RotateCw } from 'lucide-react';
import { api, API_BASE_URL, syncRemoteServerConfig, GITHUB_CONFIG_URL } from '../services/api';
import { Logo } from './Logo';

interface LoginModalProps {
  onLoginSuccess: (branchData: any, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [syncingGithub, setSyncingGithub] = useState(false);
  const [githubSyncSuccess, setGithubSyncSuccess] = useState<string | null>(null);
  const [customServerUrl, setCustomServerUrl] = useState(() => {
    return localStorage.getItem('unifood_pos_api_url') || localStorage.getItem('unifood_remote_api_url') || 'https://collage-project-5zby.onrender.com';
  });

  const handleSyncGithub = async () => {
    try {
      setSyncingGithub(true);
      setGithubSyncSuccess(null);
      const res = await syncRemoteServerConfig();
      if (res && res.apiUrl) {
        localStorage.removeItem('unifood_pos_api_url'); // إعادة تفعيل الرابط التلقائي من GitHub
        setGithubSyncSuccess(`تم جلب الرابط من GitHub بنجاح! 🚀`);
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setGithubSyncSuccess('تعذر جلب التحديث من GitHub أو تم استخدام الرابط المحفوظ');
      }
    } catch (_e) {
      setGithubSyncSuccess('فشل الاتصال بـ GitHub');
    } finally {
      setSyncingGithub(false);
    }
  };

  const handleApplyServerUrl = (url: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    localStorage.setItem('unifood_pos_api_url', cleanUrl);
    setCustomServerUrl(cleanUrl);
    window.location.reload();
  };

  const handleResetToAuto = () => {
    localStorage.removeItem('unifood_pos_api_url');
    handleSyncGithub();
  };

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

        {/* Server Connection Indicator */}
        <div className="mb-4 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-slate-500 font-bold truncate">السيرفر:</span>
            <span className="font-mono text-[11px] text-slate-800 font-bold truncate">
              {API_BASE_URL.replace('/api', '')}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleSyncGithub}
              disabled={syncingGithub}
              className="p-1 text-slate-500 hover:text-indigo-600 transition-colors"
              title="مزامنة الرابط من GitHub فوراً"
            >
              <RotateCw className={`w-3.5 h-3.5 ${syncingGithub ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowServerSettings(!showServerSettings)}
              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
              title="تغيير إعدادات السيرفر"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {githubSyncSuccess && (
          <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2 animate-fadeIn font-bold">
            <Check className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>{githubSyncSuccess}</span>
          </div>
        )}

        {showServerSettings && (
          <div className="mb-5 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2.5 text-xs animate-fadeIn">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-slate-700">عنوان خادم المنظومة (Server URL):</label>
              <button
                type="button"
                onClick={handleResetToAuto}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
              >
                تفعيل المزامنة التلقائية مع GitHub
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyServerUrl('https://unifood.store')}
                className="py-1.5 px-2 bg-indigo-600 text-white rounded-xl font-bold text-[11px] hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1"
              >
                <span>السيرفر السحابي (Cloud)</span>
                {API_BASE_URL.includes('unifood.store') && <Check className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => handleApplyServerUrl('http://localhost:5000')}
                className="py-1.5 px-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] hover:bg-slate-300 transition-colors flex items-center justify-center gap-1"
              >
                <span>محلي (Localhost:5000)</span>
                {API_BASE_URL.includes('localhost') && <Check className="w-3 h-3" />}
              </button>
            </div>
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={customServerUrl}
                onChange={e => setCustomServerUrl(e.target.value)}
                placeholder="https://your-domain.com"
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => handleApplyServerUrl(customServerUrl)}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors shrink-0"
              >
                تطبيق
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              💡 لقراءة الدومين الجديد فور تغييره، قم بتعديل ملف <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">server-config.json</code> على GitHub، ثم اضغط على زر التحديث 🔄
            </p>
          </div>
        )}

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
