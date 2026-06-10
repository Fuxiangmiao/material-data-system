import { useState } from 'react';

export default function DeleteConfirmDialog({ open, count, username, onConfirm, onCancel }) {
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    if (!password.trim()) { setError('请输入密码'); return; }
    setVerifying(true);
    setError('');
    try {
      await onConfirm(password);
      setPassword('');
    } catch (err) {
      setError(err?.message || '验证失败');
    } finally {
      setVerifying(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            ⚠️
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">确认删除</h3>
            <p className="text-xs text-slate-500 mt-1">
              您即将删除 <span className="text-red-600 font-semibold">{count}</span> 条记录，此操作不可撤销。
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">
              当前用户：<span className="text-slate-700 font-medium">{username}</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                onKeyDown={handleKeyDown}
                placeholder="请输入当前用户密码以确认删除"
                className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-300 outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={verifying || !password.trim()}
            className="px-4 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition font-medium"
          >
            {verifying ? '验证中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
