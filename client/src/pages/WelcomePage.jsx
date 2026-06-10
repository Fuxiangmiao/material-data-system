import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const MODULES = [
  {
    module: 'material',
    label: '物料数据管理',
    icon: '📦',
    color: 'from-blue-500 to-blue-600',
    desc: '管理物料基础数据，支持检索、录入、导入导出和差异性比对',
    links: [
      { to: '/material', label: '数据检索', icon: '🔍' },
      { to: '/entry/material', label: '数据录入', icon: '✏️' },
      { to: '/import/material', label: '文件导入', icon: '📥' },
      { to: '/export/material', label: '文件导出', icon: '📤' },
      { to: '/compare/material', label: '差异性比对', icon: '📊' },
    ],
  },
  {
    module: 'selection',
    label: '物料选型库管理',
    icon: '🧩',
    color: 'from-emerald-500 to-emerald-600',
    desc: '管理物料选型数据，支持附件关联和批量附件上传',
    links: [
      { to: '/selection', label: '数据检索', icon: '🔍' },
      { to: '/entry/selection', label: '数据录入', icon: '✏️' },
      { to: '/import/selection', label: '文件导入', icon: '📥' },
      { to: '/export/selection', label: '文件导出', icon: '📤' },
      { to: '/compare/selection', label: '差异性比对', icon: '📊' },
      { to: '/attachments', label: '附件管理', icon: '📎' },
      { to: '/batch-attach', label: '批量附件', icon: '📦' },
    ],
  },
  {
    module: 'overseas',
    label: '海外物料承认管理',
    icon: '🌏',
    color: 'from-purple-500 to-purple-600',
    desc: '管理海外物料承认数据，支持检索、录入和导入导出',
    links: [
      { to: '/overseas', label: '数据检索', icon: '🔍' },
      { to: '/entry/overseas', label: '数据录入', icon: '✏️' },
      { to: '/import/overseas', label: '文件导入', icon: '📥' },
      { to: '/export/overseas', label: '文件导出', icon: '📤' },
    ],
  },
];

const ADMIN_LINKS = [
  { to: '/data-init/material', label: '数据初始化', icon: '🗄️' },
  { to: '/users', label: '用户管理', icon: '👥' },
];

export default function WelcomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGuest = user?.role === 'guest';
  const isAdmin = user?.role === 'admin';

  // Guest can only see search and export
  const filterLinks = (links) => {
    if (isAdmin || user?.role === 'user') return links;
    return links.filter((l) => !l.to.includes('/entry') && !l.to.includes('/import') && !l.to.includes('/compare') && !l.to.includes('/attach'));
  };

  return (
    <div className="space-y-6">
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">器件部物料数据智能管理系统</h1>
        <p className="text-sm text-slate-500">
          欢迎回来，{user?.displayName || user?.username}
          <span className="ml-2 text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500">
            {isAdmin ? '管理员' : user?.role === 'user' ? '操作员' : '访客'}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {MODULES.map((mod) => {
          const links = filterLinks(mod.links);
          return (
            <div key={mod.module} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              {/* Header */}
              <div className={`bg-gradient-to-r ${mod.color} px-5 py-4 text-white`}>
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{mod.icon}</span>
                  <h2 className="text-lg font-semibold">{mod.label}</h2>
                </div>
                <p className="text-xs text-white/80 mt-1.5">{mod.desc}</p>
              </div>

              {/* Navigation links */}
              <div className="p-4 grid grid-cols-2 gap-2">
                {links.map((link) => (
                  <button
                    key={link.to}
                    onClick={() => navigate(link.to)}
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 bg-slate-50 rounded-lg hover:bg-primary/10 hover:text-primary transition text-left"
                  >
                    <span className="text-base">{link.icon}</span>
                    <span>{link.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <span>⚙️</span> 系统管理
          </h2>
          <div className="flex flex-wrap gap-2">
            {ADMIN_LINKS.map((link) => (
              <button
                key={link.to}
                onClick={() => navigate(link.to)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg hover:bg-primary/10 hover:text-primary transition"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
