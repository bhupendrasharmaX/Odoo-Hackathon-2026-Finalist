import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import type { Role } from '../types';

const DEMO_ACCOUNTS: { email: string; password: string; role: Role; name: string }[] = [
  { email: 'admin@peoplepay360.com',    password: 'admin123',   role: 'super_admin',     name: 'Super Admin' },
  { email: 'hr@peoplepay360.com',       password: 'hr123',      role: 'hr_manager',      name: 'HR Manager' },
  { email: 'hrexec@peoplepay360.com',   password: 'hrexec123',  role: 'hr_executive',    name: 'HR Executive' },
  { email: 'payroll@peoplepay360.com',  password: 'payroll123', role: 'payroll_manager', name: 'Payroll Manager' },
  { email: 'employee@peoplepay360.com', password: 'emp123',     role: 'employee',        name: 'Employee' },
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      addToast('success', 'Logged in successfully');
      navigate(from, { replace: true });
    } catch (err: any) {
      addToast('error', 'Login failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[var(--ink)] tracking-tight">
            People<span className="text-[var(--accent)]">Pay</span>360
          </h1>
          <p className="text-sm text-[var(--slate)] mt-1">
            HR & Payroll Operations
          </p>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-[var(--line)] rounded p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-[var(--slate)] uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-[var(--line)] rounded bg-white text-[var(--ink)] placeholder:text-[var(--slate)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--slate)] uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 text-sm border border-[var(--line)] rounded bg-white text-[var(--ink)] placeholder:text-[var(--slate)] focus:outline-none focus:border-[var(--accent)]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-[var(--accent)] text-white text-sm font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Quick login (mock mode) */}
        <div className="mt-6">
          <p className="text-xs text-[var(--slate)] text-center mb-3 uppercase tracking-wider">
            Quick Login (Demo)
          </p>
          <div className="grid grid-cols-1 gap-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                onClick={() => handleQuickLogin(account)}
                className="flex items-center justify-between px-3 py-2 text-xs bg-white border border-[var(--line)] rounded hover:bg-[var(--canvas)] transition-colors"
              >
                <span className="text-[var(--ink)] font-medium">
                  {account.name}
                </span>
                <span className="text-[var(--slate)] capitalize">
                  {account.role.replace(/_/g, ' ')}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
