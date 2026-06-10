import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ChangePasswordDialog from '../ChangePasswordDialog';

const NAV_GROUPS = [
  {
    label: '物料数据管理',
    module: 'material',
    items: [
      { to: '/material', label: '数据检索', icon: '🔍' },
      { to: '/entry/material', label: '数据录入', icon: '✏️', roles: ['admin', 'user'] },
      { to: '/import/material', label: '文件导入', icon: '📥', roles: ['admin', 'user'] },
      { to: '/export/material', label: '文件导出', icon: '📤' },
      { to: '/compare/material', label: '差异性比对', icon: '📊', roles: ['admin', 'user'] },
    ],
  },
  {
    label: '物料选型库管理',
    module: 'selection',
    items: [
      { to: '/selection', label: '数据检索', icon: '🔍' },
      { to: '/entry/selection', label: '数据录入', icon: '✏️', roles: ['admin', 'user'] },
      { to: '/import/selection', label: '文件导入', icon: '📥', roles: ['admin', 'user'] },
      { to: '/export/selection', label: '文件导出', icon: '📤' },
      { to: '/compare/selection', label: '差异性比对', icon: '📊', roles: ['admin', 'user'] },
      { to: '/attachments', label: '附件管理', icon: '📎', roles: ['admin', 'user'] },
      { to: '/batch-attach', label: '批量附件上传', icon: '📦', roles: ['admin', 'user'] },
    ],
  },
  {
    label: '海外物料承认管理',
    module: 'overseas',
    items: [
      { to: '/overseas', label: '数据检索', icon: '🔍' },
      { to: '/entry/overseas', label: '数据录入', icon: '✏️', roles: ['admin', 'user'] },
      { to: '/import/overseas', label: '文件导入', icon: '📥', roles: ['admin', 'user'] },
      { to: '/export/overseas', label: '文件导出', icon: '📤' },
    ],
  },
  {
    label: '系统管理',
    adminOnly: true,
    items: [
      { to: '/data-init/material', label: '数据初始化', icon: '🗄️', roles: ['admin'] },
      { to: '/users', label: '用户管理', icon: '👥', roles: ['admin'] },
    ],
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'guest';
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHomePage = location.pathname === '/';

  const filteredGroups = NAV_GROUPS.map((group) => {
    const items = group.items.filter((item) => {
      if (!item.roles) return true;
      return item.roles.includes(role);
    });
    if (group.adminOnly && role !== 'admin') return null;
    return { ...group, items };
  }).filter(Boolean);

  // Auto-collapse all groups when on home page; only expand current module group (keep others as-is)
  useEffect(() => {
    if (isHomePage) {
      setCollapsedGroups(new Set(filteredGroups.map((g) => g.label)));
    } else {
      // Only expand the current module's group, don't collapse already-expanded groups
      const currentModule = location.pathname.split('/')[1];
      setCollapsedGroups((prev) => {
        const next = new Set(prev);
        const currentGroup = filteredGroups.find((g) => g.module === currentModule);
        if (currentGroup) {
          next.delete(currentGroup.label); // ensure current module is expanded
        }
        return next;
      });
    }
  }, [location.pathname]);

  const handleGoHome = () => {
    setMobileOpen(false);
    navigate('/');
  };

  const toggleCollapse = (label) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  };

  // Auto-detect which group the current route belongs to
  const currentModule = location.pathname.split('/')[1];

  const sidebarContent = (
    <>
      {/* Logo / Home Button */}
      <button
        onClick={handleGoHome}
        className={`p-4 border-b border-slate-700 text-left transition-colors w-full ${
          isHomePage ? 'bg-primary/20' : 'hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏠</span>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">器件部物料数据</h2>
            <p className="text-xs text-slate-400 mt-0.5">智能管理系统 · 点击回首页</p>
          </div>
        </div>
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {filteredGroups.map((group, gi) => {
          const isCollapsed = collapsedGroups.has(group.label);
          return (
            <div key={gi} className="mb-1">
              <button
                onClick={() => toggleCollapse(group.label)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-base font-bold text-slate-200 hover:text-white transition"
              >
                {group.label}
                <span className="text-xs">{isCollapsed ? '▶' : '▼'}</span>
              </button>
              {!isCollapsed && group.items.map((item) => {
                const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center px-4 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/20 text-primary-300 border-r-2 border-primary'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="mr-2.5 text-base">{item.icon}</span>
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-sm font-medium">{user?.displayName || user?.username}</p>
            <p className="text-xs text-slate-400">
              {role === 'admin' ? '管理员' : role === 'user' ? '操作员' : '访客'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {role !== 'guest' && (
            <button onClick={() => setShowChangePwd(true)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition">
              修改密码
            </button>
          )}
          <button onClick={logout}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition">
            退出登录
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-white flex-col min-h-screen shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-900 text-white flex flex-col min-h-full z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      <ChangePasswordDialog open={showChangePwd} onClose={() => setShowChangePwd(false)} />
    </>
  );
}
