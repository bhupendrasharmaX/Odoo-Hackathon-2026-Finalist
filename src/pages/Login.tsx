import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
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

const HIGHLIGHTS = [
  'Onboard, track and pay your whole team in one place',
  'Approve payroll runs with a full audit trail',
  'Attendance and leave that reconcile themselves',
  'Role-based access for every kind of teammate',
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
    <div className="min-h-screen flex">
      {/* ---------- Left: blue hero panel ---------- */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-[linear-gradient(135deg,#2B50F5_0%,#1E3ED4_55%,#1A34B0_100%)]">
        {/* Decorative orbs */}
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-white/[0.07]" />
        <div className="absolute bottom-[-160px] right-24 w-[320px] h-[320px] rounded-full bg-white/[0.05]" />
        <div className="absolute top-1/3 -left-20 w-[240px] h-[240px] rounded-full bg-white/[0.04]" />

        <div className="relative flex flex-col justify-between p-14 xl:p-16 text-white w-full">
          {/* Logo */}
          <span className="text-lg font-bold tracking-tight">
            People<span className="text-white/60">Pay</span>360
          </span>

          {/* Headline */}
          <div className="max-w-lg">
            <h1 className="display-lg">
              HR and payroll
              <br />
              people actually love
            </h1>
            <p className="text-base text-white/70 mt-5 leading-relaxed">
              PeoplePay360 is the internal operations tool where your team can
              run headcount, attendance, leave and payroll — without a single
              spreadsheet changing hands.
            </p>

            <ul className="mt-9 space-y-3.5">
              {HIGHLIGHTS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="text-sm text-white/85 leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer stats — echoes the reference's trust strip */}
          <div className="flex items-center gap-10">
            {[
              { value: '15', label: 'Employees' },
              { value: '5', label: 'Roles' },
              { value: '₹16.8L', label: 'Monthly gross' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-white/55 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Right: form ---------- */}
      <div className="flex-1 flex items-center justify-center bg-white px-6 py-12 overflow-y-auto">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <span className="text-lg font-bold tracking-tight text-[var(--ink)]">
              People<span className="text-[var(--accent)]">Pay</span>360
            </span>
          </div>

          <h2 className="display-sm text-[var(--ink)]">Welcome back</h2>
          <p className="page-subtitle">
            Sign in to your PeoplePay360 workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="label">Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Signing in…' : 'Sign in'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          {/* Quick login (mock mode) */}
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-[var(--line)]" />
              <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                Or try a demo role
              </span>
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => handleQuickLogin(account)}
                  className="group flex items-center justify-between px-4 h-11 rounded-[var(--r-md)] border border-[var(--line)] bg-white hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors text-left"
                >
                  <span className="text-[13px] font-semibold text-[var(--ink)]">
                    {account.name}
                  </span>
                  <span className="text-xs text-[var(--slate)] group-hover:text-[var(--accent)] transition-colors">
                    {account.email.split('@')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
