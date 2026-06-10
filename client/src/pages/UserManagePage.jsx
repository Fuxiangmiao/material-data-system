import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';

export default function UserManagePage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    role: 'user',
    initialPassword: '123456',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.success) setUsers(res.data || []);
    } catch (err) {
      console.error('加载用户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/users', form);
      if (res.success) {
        alert('用户创建成功');
        setForm({ username: '', displayName: '', role: 'user', initialPassword: '123456' });
        setShowForm(false);
        loadUsers();
      }
    } catch (err) {
      alert(err.message || '创建失败');
    }
  };

  const handleDelete = async (id, username) => {
    if (!confirm(`确定删除用户「${username}」？`)) return;
    try {
      const res = await api.delete(`/users/${id}`);
      if (res.success) {
        loadUsers();
      }
    } catch (err) {
      alert(err.message || '删除失败');
    }
  };

  const handleResetPassword = async (id, username) => {
    if (!confirm(`确定重置用户「${username}」的密码为初始密码？`)) return;
    try {
      const res = await api.post(`/users/${id}/reset-password`);
      if (res.success) alert('密码已重置');
    } catch (err) {
      alert(err.message || '重置失败');
    }
  };

  const getRoleLabel = (role) => {
    const map = { admin: '管理员', user: '操作员', guest: '访客' };
    return map[role] || role;
  };

  const getRoleColor = (role) => {
    const map = {
      admin: 'bg-red-100 text-red-700',
      user: 'bg-blue-100 text-blue-700',
      guest: 'bg-slate-100 text-slate-600',
    };
    return map[role] || 'bg-slate-100 text-slate-600';
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="text-slate-600">权限不足，仅管理员可访问</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-800">👥 用户管理</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 transition"
        >
          {showForm ? '取消' : '+ 新增用户'}
        </button>
      </div>

      {/* 新增表单 */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">用户名 *</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">显示名</label>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">角色 *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              >
                <option value="admin">管理员</option>
                <option value="user">操作员</option>
                <option value="guest">访客</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">初始密码</label>
              <input
                type="text"
                value={form.initialPassword}
                onChange={(e) => setForm((p) => ({ ...p, initialPassword: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-3 px-6 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary-600 transition"
          >
            创建用户
          </button>
        </form>
      )}

      {/* 用户列表 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">用户名</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">显示名</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">角色</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">初始密码</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">密码状态</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">创建时间</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  暂无用户
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">{u.username}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.display_name || '-'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{u.initial_password || '123456'}</td>
                  <td className="px-4 py-2.5">
                    {u.passwordChanged ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">已修改</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">未修改</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{u._created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResetPassword(u.id, u.username)}
                        className="text-xs text-primary hover:underline"
                      >
                        重置密码
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          删除
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
