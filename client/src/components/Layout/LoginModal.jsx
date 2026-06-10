import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginModal() {
  const { login, resetPassword } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login');
  const [resetUsername, setResetUsername] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Load remembered credentials on mount
  useEffect(() => {
    try {
      const remembered = localStorage.getItem('auth_remember');
      if (remembered) {
        const { username: u, password: p } = JSON.parse(remembered);
        if (u) setUsername(u);
        if (p) setPassword(p);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await login(username.trim(), password, rememberMe);
      if (!res.success) {
        setError(res.message || '登录失败');
      }
    } catch (err) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetUsername.trim()) {
      setResetMsg('请输入用户名');
      return;
    }
    try {
      const res = await resetPassword(resetUsername.trim());
      setResetMsg(res.message || '密码已重置');
    } catch (err) {
      setResetMsg(err.message || '重置失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-800 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            器件部物料数据智能管理系统
          </h1>
          <p className="text-slate-500 text-sm">
            {mode === 'login' ? '请登录以继续使用' : '重置密码为初始密码'}
          </p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                  placeholder="请输入用户名" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                    placeholder="请输入密码" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300" />
                记住密码
              </label>
            </div>

            {error && <p className="text-red-500 text-sm mt-3 bg-red-50 p-2 rounded">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full mt-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 transition">
              {loading ? '登录中...' : '登 录'}
            </button>

            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setMode('reset'); setError(''); }}
                className="text-sm text-primary hover:underline">
                忘记密码？
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">用户名</label>
              <input type="text" value={resetUsername} onChange={(e) => setResetUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition"
                placeholder="请输入用户名" autoFocus />
            </div>

            {resetMsg && <p className="text-sm mt-3 bg-blue-50 text-blue-700 p-2 rounded">{resetMsg}</p>}

            <button type="submit"
              className="w-full mt-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition">
              重置密码
            </button>

            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setMode('login'); setResetMsg(''); }}
                className="text-sm text-primary hover:underline">
                返回登录
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
