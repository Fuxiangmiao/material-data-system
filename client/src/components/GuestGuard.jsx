import { useAuth } from '../contexts/AuthContext';

export default function GuestGuard({ children }) {
  const { user } = useAuth();

  if (user?.role === 'guest') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-slate-700">权限不足</h2>
          <p className="text-sm text-slate-500 mt-1">访客账号无法访问此页面</p>
        </div>
      </div>
    );
  }

  return children;
}
