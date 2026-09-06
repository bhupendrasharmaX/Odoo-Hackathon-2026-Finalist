import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Topbar } from '../components/Topbar';

export function AppLayout() {
  const { pathname } = useLocation();

  // A route change starts at the top. Without this, moving from the bottom of
  // a long directory into a detail page lands you mid-record.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--canvas)]">
      <Topbar />

      <main className="flex-1">
        {/* Keyed on the path so each screen fades in on arrival. */}
        <div key={pathname} className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-7 animate-rise">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-[var(--line)] mt-4">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 text-[11.5px] text-[var(--muted)]">
          PeoplePay360
        </div>
      </footer>
    </div>
  );
}
