import { Outlet } from 'react-router-dom';
import { Topbar } from '../components/Topbar';

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)]">
      <Topbar />
      <main className="flex-1">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
