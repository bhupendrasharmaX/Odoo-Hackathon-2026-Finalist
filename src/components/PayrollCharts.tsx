import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money, moneyCompact } from '../lib/format';

/**
 * The two Recharts panels on the payroll dashboard.
 *
 * Kept apart from `charts.tsx` so the charting library is only pulled in by
 * the screen that plots anything - it is the single largest dependency in the
 * bundle, and the employee workspace never needs it.
 *
 * Both plots carry ONE series, so identity never rides on colour: a single
 * hue, a hairline grid, values read off the axis or the hover tooltip rather
 * than a label on every point.
 */

const INK = '#0B1424';
const MUTED = '#8C95A8';
const GRID = '#E4E8F2';
const SERIES = '#2B50F5';

const AXIS_TICK = { fill: MUTED, fontSize: 11.5 } as const;

/** Shared tooltip chrome, so every chart in the app hovers identically. */
function TooltipCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="bg-white border border-[var(--line)] rounded-[var(--r-md)] shadow-[var(--shadow-lg)] px-3 py-2.5 text-[12px]">
      <p className="font-bold text-[var(--ink)] mb-1">{title}</p>
      {rows.map(([label, value]) => (
        <p key={label} className="flex items-center justify-between gap-6 text-[var(--slate)]">
          <span>{label}</span>
          <span className="font-semibold text-[var(--ink)] tabular-nums">{value}</span>
        </p>
      ))}
    </div>
  );
}

function ChartFrame({ height, children }: { height: number; children: ReactNode }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as never}
      </ResponsiveContainer>
    </div>
  );
}

/** Salary cost by department - magnitude across nominal categories. */
export function DepartmentSalaryChart({
  data,
}: {
  data: Array<{ department: string; headcount: number; totalSalary: number }>;
}) {
  return (
    <ChartFrame height={Math.max(200, data.length * 46 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis
          type="number"
          tickFormatter={(value: number) => moneyCompact(value)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="department"
          width={104}
          tick={{ ...AXIS_TICK, fill: INK }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(43, 80, 245, 0.06)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as {
              department: string;
              headcount: number;
              totalSalary: number;
            };
            return (
              <TooltipCard
                title={row.department}
                rows={[
                  ['Net paid', money(row.totalSalary)],
                  ['Employees', String(row.headcount)],
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="totalSalary"
          fill={SERIES}
          radius={[0, 4, 4, 0]}
          barSize={18}
          isAnimationActive={false}
          label={{
            position: 'right',
            formatter: (value: unknown) => moneyCompact(Number(value)),
            fill: MUTED,
            fontSize: 11.5,
            fontWeight: 600,
          }}
        />
      </BarChart>
    </ChartFrame>
  );
}

/** Monthly net trend - change over time, one series. */
export function NetTrendChart({ data }: { data: Array<{ period: string; net: number }> }) {
  const short = (period: string) => {
    const [year, month] = period.split('-');
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString('en-IN', {
      month: 'short',
      timeZone: 'UTC',
    });
  };

  return (
    <ChartFrame height={250}>
      <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="period"
          tickFormatter={short}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => moneyCompact(value)}
          tick={AXIS_TICK}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip
          cursor={{ stroke: GRID, strokeWidth: 1 }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const [year, month] = String(label).split('-');
            const title = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString(
              'en-IN',
              { month: 'long', year: 'numeric', timeZone: 'UTC' },
            );
            return (
              <TooltipCard title={title} rows={[['Net paid', money(Number(payload[0].value))]]} />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="net"
          stroke={SERIES}
          strokeWidth={2}
          isAnimationActive={false}
          dot={{ r: 4, fill: SERIES, stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: SERIES, stroke: '#fff', strokeWidth: 2 }}
        />
      </LineChart>
    </ChartFrame>
  );
}
