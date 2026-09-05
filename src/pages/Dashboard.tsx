import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Clock3,
  FileWarning,
  MessageSquareWarning,
  Receipt,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import api from '../api';
import { useAsync } from '../lib/useApi';
import { formatPeriod, humanise, money, num, percent } from '../lib/format';
import { StatusBadge } from '../components/StatusBadge';
import { AttendanceMix } from '../components/charts';
import {
  Button,
  ErrorState,
  Field,
  FilterBar,
  KpiCard,
  Section,
  Select,
  SkeletonCards,
  StatTile,
} from '../components/ui';

// Recharts is the largest dependency in the bundle and this is the only screen
// that plots anything, so it is fetched when the dashboard first renders.
const DepartmentSalaryChart = lazy(() =>
  import('../components/PayrollCharts').then((module) => ({
    default: module.DepartmentSalaryChart,
  })),
);
const NetTrendChart = lazy(() =>
  import('../components/PayrollCharts').then((module) => ({ default: module.NetTrendChart })),
);

/**
 * Shown while the chart chunk loads. A plain tinted block was invisible on a
 * white card, so this draws bar-shaped placeholders that read as "a chart is
 * arriving" rather than as an empty panel.
 */
function ChartFallback({ height }: { height: number }) {
  return (
    <div
      className="flex flex-col justify-end gap-3 px-2"
      style={{ height }}
      role="status"
      aria-label="Loading chart"
    >
      {[70, 45, 85, 55].map((width, index) => (
        <div
          key={index}
          className="h-4 rounded-[4px] bg-[#E4E8F2] animate-pulse"
          style={{ width: `${width}%`, animationDelay: `${index * 120}ms` }}
        />
      ))}
    </div>
  );
}

/**
 * The payroll dashboard.
 *
 * Every number is read from `GET /dashboard`, and all three filters narrow all
 * of them at once - nothing on this screen is computed client-side or filled
 * with a placeholder.
 */
export function PayrollDashboard() {
  const [period, setPeriod] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeType, setEmployeeType] = useState('');

  const filters = useAsync(() => api.dashboard.filters(), []);
  const dashboard = useAsync(
    () => api.dashboard.get({ period, departmentId, employeeType }),
    [period, departmentId, employeeType],
  );

  const data = dashboard.data;
  const attendance = data?.attendanceOverview;

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Payroll dashboard</h1>
          <p className="page-subtitle">
            {data ? formatPeriod(data.period) : '—'}
          </p>
        </div>
        <Link to="/payroll/payruns/new" className="btn btn-primary">
          <Wallet size={16} />
          New payrun
        </Link>
      </div>

      <FilterBar>
        <Field label="Period" className="w-44">
          <Select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="">Latest with data</option>
            {(filters.data?.periods ?? []).map((option) => (
              <option key={option} value={option}>
                {formatPeriod(option)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Department" className="w-52">
          <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">All departments</option>
            {(filters.data?.departments ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Employee type" className="w-44">
          <Select value={employeeType} onChange={(event) => setEmployeeType(event.target.value)}>
            <option value="">All types</option>
            {(filters.data?.employeeTypes ?? []).map((type) => (
              <option key={type} value={type}>
                {humanise(type)}
              </option>
            ))}
          </Select>
        </Field>

        {(period || departmentId || employeeType) && (
          <Button
            size="sm"
            onClick={() => {
              setPeriod('');
              setDepartmentId('');
              setEmployeeType('');
            }}
          >
            Clear filters
          </Button>
        )}

        <span className="ml-auto text-[12px] text-[var(--muted)]">
          {data ? `${data.periodStart} → ${data.periodEnd}` : ''}
        </span>
      </FilterBar>

      {dashboard.error && <ErrorState message={dashboard.error} onRetry={dashboard.reload} />}

      {dashboard.loading && !data && (
        <div className="space-y-5">
          <SkeletonCards count={6} />
          <div className="grid gap-5 xl:grid-cols-2">
            <div className="card p-5">
              <div className="h-3.5 w-44 skeleton" />
              <ChartFallback height={220} />
            </div>
            <div className="card p-5">
              <div className="h-3.5 w-40 skeleton" />
              <ChartFallback height={220} />
            </div>
          </div>
        </div>
      )}

      {data && (
        <div className={dashboard.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-5">
            <KpiCard
              label="Total net paid"
              value={money(data.kpis.totalNetPaid)}
              icon={<Wallet size={17} />}
              tone="blue"
            />
            <KpiCard
              label="Payslips generated"
              value={num(data.kpis.payslipsGenerated, 0)}
              sublabel={`Average ${money(data.kpis.averageSalary)} net`}
              icon={<Receipt size={17} />}
              tone="purple"
            />
            <KpiCard
              label="Average net salary"
              value={money(data.kpis.averageSalary)}
              icon={<TrendingUp size={17} />}
              tone="green"
            />
            <KpiCard
              label="Approved time off"
              value={`${num(data.kpis.approvedTimeOffDays)} days`}
              icon={<CalendarCheck size={17} />}
              tone="amber"
            />
            <KpiCard
              label="Attendance health"
              value={percent(data.kpis.attendanceHealth)}
              icon={<Clock3 size={17} />}
              tone={data.kpis.attendanceHealth >= 0.9 ? 'green' : 'amber'}
              progress={data.kpis.attendanceHealth}
            />
            <KpiCard
              label="Open grievances"
              value={num(data.kpis.openGrievances, 0)}
              sublabel="Open or under review"
              icon={<MessageSquareWarning size={17} />}
              tone="pink"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2 mb-5">
            <Section title="Salary cost by department">
              {data.salaryByDepartment.length === 0 ? (
                <p className="text-sm text-[var(--muted)] py-8 text-center">
                  No payslips match these filters.
                </p>
              ) : (
                <Suspense fallback={<ChartFallback height={220} />}>
                  <DepartmentSalaryChart data={data.salaryByDepartment} />
                </Suspense>
              )}
            </Section>

            <Section title="Monthly net trend">
              <Suspense fallback={<ChartFallback height={250} />}>
                <NetTrendChart data={data.monthlyNetTrend} />
              </Suspense>
            </Section>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
            <Section title="Attendance overview">
              {attendance && (
                <>
                  <AttendanceMix
                    counts={{
                      present: attendance.present,
                      late: attendance.late,
                      halfDay: attendance.halfDay,
                      absent: attendance.absent,
                    }}
                  />

                  <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-[var(--line)]">
                    <StatTile
                      label="Overtime hours"
                      value={num(attendance.overtimeHours)}
                      tone="purple"
                    />
                    <StatTile
                      label="Missing checkouts"
                      value={num(attendance.missingCheckouts, 0)}
                      tone={attendance.missingCheckouts > 0 ? 'pink' : 'green'}
                    />
                    <StatTile
                      label="Manual edits"
                      value={num(attendance.manualEdits, 0)}
                      tone="amber"
                    />
                  </div>
                </>
              )}
            </Section>

            <Section
              title="Items requiring attention"
              description={`${data.alerts.length} open item${data.alerts.length === 1 ? '' : 's'}`}
              bodyClassName="p-0"
              actions={
                <Link
                  to="/payroll/payslips"
                  className="text-[12px] font-semibold text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                >
                  All payslips <ArrowRight size={13} />
                </Link>
              }
            >
              {data.alerts.length === 0 ? (
                <p className="text-sm text-[var(--muted)] py-10 text-center">
                  Nothing needs attention in this period.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--line)] max-h-[360px] overflow-y-auto">
                  {data.alerts.map((alert, index) => (
                    <li key={`${alert.type}-${index}`} className="flex items-start gap-3 px-5 py-3.5">
                      <span
                        className={`icon-tile w-8 h-8 mt-0.5 ${
                          alert.severity === 'HIGH'
                            ? 'tile-pink'
                            : alert.severity === 'MEDIUM'
                              ? 'tile-amber'
                              : 'tile-blue'
                        }`}
                      >
                        {alert.severity === 'HIGH' ? (
                          <AlertTriangle size={15} />
                        ) : (
                          <FileWarning size={15} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={alert.severity} size="sm" />
                          <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wide">
                            {humanise(alert.type)}
                          </span>
                        </div>
                        <p className="text-[13px] text-[var(--ink)] mt-1 leading-snug">
                          {alert.message}
                        </p>
                      </div>
                      {alert.payslipId && (
                        <Link
                          to={`/payroll/payslips/${alert.payslipId}`}
                          className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors mt-1"
                          title="Open payslip"
                        >
                          <ArrowRight size={15} />
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
