import { useState, type SyntheticEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../lib/useApi';
import { Button } from '../components/ui';

/** Seeded logins, so a reviewer can walk the role matrix without a setup step. */
const DEMO_ACCOUNTS = [
  { email: 'admin@peoplepay.com', label: 'Administrator', note: 'Full access, users and roles' },
  { email: 'payrollmgr@peoplepay.com', label: 'Payroll Manager', note: 'Runs payroll end to end' },
  { email: 'payroll@peoplepay.com', label: 'Payroll User', note: 'Payroll, read-only on salary config' },
  { email: 'hr@peoplepay.com', label: 'HR Manager', note: 'People ops — walled out of payroll' },
  { email: 'aarav@peoplepay.com', label: 'Employee', note: 'Own records only' },
];

const DEMO_PASSWORD = 'demo1234';

export function LoginPage() {
  const { login, isAuthenticated, booting } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  if (!booting && isAuthenticated) return <Navigate to={from} replace />;

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const fillFromDemoAccount = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.05fr] bg-[var(--canvas)]">
      {/* Form side */}
      <div className="flex items-center justify-center px-5 sm:px-10 py-12">
        <div className="w-full max-w-[400px] animate-rise">
          <div className="flex items-center gap-2.5 mb-9">
            <span className="w-10 h-10 rounded-[12px] bg-[var(--accent)] text-white grid place-items-center font-black shadow-[var(--shadow-accent)]">
              P
            </span>
            <span className="text-[19px] font-extrabold tracking-tight text-[var(--ink)]">
              People<span className="text-[var(--accent)]">Pay</span>360
            </span>
          </div>

          <h1 className="display-md">Welcome back</h1>
          <p className="page-subtitle mb-8">Sign in to continue to your workspace.</p>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="email">
                Email address
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@peoplepay.com"
                  className="input pl-10"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-[var(--r-md)] bg-[var(--danger-soft)] px-3.5 py-3 text-[13px] text-[var(--danger)] animate-rise"
              >
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={busy}
              className="w-full"
              icon={<ArrowRight size={16} />}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-6 text-[12px] text-[var(--muted)]">
            Accounts are created by an administrator.
          </p>
        </div>
      </div>

      {/* Demo-account side */}
      <div className="hidden lg:flex items-center justify-center p-10 bg-[var(--sidebar-bg)] relative overflow-hidden">
        <div className="absolute -right-24 -top-32 w-[420px] h-[420px] rounded-full bg-white/[0.04]" />
        <div className="absolute -left-20 bottom-[-160px] w-[340px] h-[340px] rounded-full bg-[var(--accent)]/20" />

        <div className="relative w-full max-w-[420px] text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
            Demo accounts
          </p>
          <h2 className="display-md mt-2.5 text-white">Sign in as any role</h2>
          <p className="text-sm text-white/60 mt-2">
            Password:{' '}
            <code className="px-1.5 py-0.5 rounded bg-white/10 font-semibold">{DEMO_PASSWORD}</code>
          </p>

          <div className="mt-7 space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillFromDemoAccount(account.email)}
                className={`w-full text-left rounded-[var(--r-lg)] border transition-all px-4 py-3.5 group ${
                  email === account.email
                    ? 'border-[var(--accent-light)] bg-white/[0.11]'
                    : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold">{account.label}</p>
                    <p className="text-[11.5px] text-white/55 mt-0.5 truncate">{account.note}</p>
                  </div>
                  <ArrowRight
                    size={15}
                    className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all flex-shrink-0"
                  />
                </div>
                <p className="text-[11px] text-white/40 mt-1.5 font-mono">{account.email}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
