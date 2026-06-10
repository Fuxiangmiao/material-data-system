import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 lg:p-6 pt-14 lg:pt-6">{children}</div>
      </main>
    </div>
  );
}
