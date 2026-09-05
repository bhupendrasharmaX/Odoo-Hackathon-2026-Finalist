import { useNavigate } from 'react-router-dom';
import { Activity, Building2, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { ROLE_GROUPS, ROLE_LABELS } from '../auth/permissions';
import { useAsync } from '../lib/useApi';
import { Avatar, Button, Chip, PageHeader, Section } from '../components/ui';
import { StatusBadge } from '../components/StatusBadge';
import type { Role } from '../types';

/** What each role may do, phrased as the API enforces it. */
const CAPABILITIES: Array<{ label: string; group: keyof typeof ROLE_GROUPS }> = [
  { label: 'People operations (employees, contracts, schedules, attendance, time off)', group: 'HR_PLUS' },
  { label: 'Payroll dashboard', group: 'DASHBOARD' },
  { label: 'Payruns and payslips', group: 'PAYROLL' },
  { label: 'Read salary structures and rules', group: 'SALARY_READ' },
  { label: 'Edit salary structures and rules', group: 'SALARY_WRITE' },
  { label: 'Resolve grievances', group: 'GRIEVANCE_RESOLVE' },
  { label: 'Manage users and roles', group: 'ADMIN_ONLY' },
];

export function SettingsPage() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const health = useAsync(() => api.health(), []);
  const role = user?.role as Role | undefined;

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <PageHeader
        icon={<UserRound size={19} />}
        title="My account"
      />

      <Section className="mb-5">
        <div className="flex items-start gap-4">
          <Avatar name={user?.name} src={profile?.employee?.avatarUrl} size={60} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="display-sm">{user?.name}</h2>
              {role && <StatusBadge status={role} />}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-[13px] text-[var(--slate)]">
              <span className="inline-flex items-center gap-1.5">
                <Mail size={14} className="text-[var(--muted)]" />
                {user?.email}
              </span>
              {profile?.employee && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound size={14} className="text-[var(--muted)]" />
                    {profile.employee.employeeCode}
                    {profile.employee.jobPosition ? ` · ${profile.employee.jobPosition}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 size={14} className="text-[var(--muted)]" />
                    {profile.employee.departmentName ?? 'Unassigned'}
                  </span>
                </>
              )}
            </div>

            {!profile?.employee && (
              <p className="text-[12.5px] text-[var(--warning)] mt-3 font-medium">
                This login is not linked to an employee record, so it cannot clock in, request time
                off or hold payslips.
              </p>
            )}

            {profile?.employee && (
              <Button
                size="sm"
                className="mt-4"
                onClick={() => navigate(`/employees/${profile.employee?.id}`)}
              >
                Open my employee record
              </Button>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="What your role can open"
        description={role ? `Signed in as ${ROLE_LABELS[role]}` : undefined}
        className="mb-5"
      >
        <ul className="space-y-2.5">
          {CAPABILITIES.map((capability) => {
            const allowed = role
              ? (ROLE_GROUPS[capability.group] as readonly Role[]).includes(role)
              : false;
            return (
              <li key={capability.label} className="flex items-start gap-3">
                <span
                  className={`w-5 h-5 rounded-full grid place-items-center flex-shrink-0 mt-0.5 text-[11px] font-bold ${
                    allowed
                      ? 'bg-[var(--success-soft)] text-[var(--success)]'
                      : 'bg-[#EDF0F6] text-[var(--muted)]'
                  }`}
                >
                  {allowed ? '✓' : '—'}
                </span>
                <span
                  className={`text-[13px] ${
                    allowed ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {capability.label}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-[12px] text-[var(--muted)] mt-5 pt-4 border-t border-[var(--line)] flex items-start gap-2">
          <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" />
          Contact an administrator to change your role.
        </p>
      </Section>

      <Section title="Connection">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              API status
            </p>
            <p className="text-[13px] font-semibold text-[var(--ink)] mt-1 inline-flex items-center gap-2">
              <Activity size={14} className="text-[var(--success)]" />
              {health.loading
                ? 'Checking…'
                : health.error
                  ? 'Unreachable'
                  : `${health.data?.status} · database ${health.data?.database}`}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
              Base URL
            </p>
            <p className="text-[13px] font-mono text-[var(--slate)] mt-1">
              {import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1'}
            </p>
          </div>

          {health.error && <Chip tone="danger">{health.error}</Chip>}
        </div>

        <Button
          variant="danger"
          icon={<LogOut size={15} />}
          className="mt-6"
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        >
          Sign out
        </Button>
      </Section>
    </div>
  );
}
