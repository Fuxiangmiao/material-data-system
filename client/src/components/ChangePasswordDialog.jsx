import { useState } from 'react';
import { changePassword } from '../api/client';

export default function ChangePasswordDialog({ open, onClose }) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setError('');
    if (!oldPwd.trim()) { setError('请输入旧密码'); return; }
    if (!newPwd.trim()) { setError('请输入新密码'); return; }
    if (newPwd.length < 4) { setError('新密码至少4位'); return; }
    if (newPwd !== confirmPwd) { setError('两次输入的新密码不一致'); return; }

    setLoading(true);
    try {
      const res = await changePassword(oldPwd, newPwd);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setOldPwd(''); setNewPwd(''); setConfirmPwd(''); setSuccess(false);
          onClose();
        }, 1500);
      } else {
        setError(res.message || '修改失败');
      }
    } catch (err) {
      setError(err?.message || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOldPwd(''); setNewPwd(''); setConfirmPwd(''); setError(''); setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-800 mb-4">🔑 修改密码</h3>

        {success ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-sm text-green-600">密码修改成功</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">旧密码</label>
              <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">新密码</label>
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">确认新密码</label>
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={handleClose} className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition">
            取消
          </button>
          {!success && (
            <button onClick={handleSubmit} disabled={loading}
              className="px-4 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition font-medium">
              {loading ? '提交中...' : '确认修改'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
