import { useEffect, useState } from 'react';
import { LogIn, LogOut, Timer } from 'lucide-react';
import api from '../api';
import { useAction, useAsync } from '../lib/useApi';
import { formatTime, num } from '../lib/format';
import { useToast } from './Toast';
import { Button } from './ui';

/**
 * Clock in / clock out.
 *
 * The endpoints behind this take no employee id at all - they always act on
 * the caller's own record - so there is no field here that could clock someone
 * else in, by accident or otherwise.
 */
export function AttendanceWidget({
  onChange,
  compact = false,
}: {
  onChange?: () => void;
  /** Strip layout, for pages where clocking in is not the main event. */
  compact?: boolean;
}) {
  const { success, error } = useToast();
  const state = useAsync(() => api.attendance.active(), []);
  const { busy, run } = useAction({ onSuccess: success, onError: error });

  const [now, setNow] = useState(() => Date.now());
  const session = state.data?.session ?? null;

  // Tick only while a session is open, so an idle widget does no work.
  useEffect(() => {
    if (!session?.checkIn) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session?.checkIn]);

  const elapsed = (() => {
    if (!session?.checkIn) return null;
    const started = new Date(session.checkIn).getTime();
    const seconds = Math.max(0, Math.floor((now - started) / 1000));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(
      seconds % 60,
    )}`;
  })();

  const act = async (mode: 'in' | 'out') => {
    const result = await run(
      () => (mode === 'in' ? api.attendance.checkIn() : api.attendance.checkOut()),
      mode === 'in' ? 'Checked in' : 'Checked out',
    );
    if (result) {
      state.reload();
      onChange?.();
    }
  };

  // An account with no linked employee record cannot clock in at all; saying
  // so beats a button that always 403s.
  const notLinked = state.error?.toLowerCase().includes('not linked');

  const status = (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">Attendance</p>

      {notLinked ? (
        <p className="text-sm text-white/80 mt-2 leading-relaxed max-w-md">
          This login is not linked to an employee record, so it cannot clock in or out. An
          administrator can link it from Users &amp; roles.
        </p>
      ) : (
        <>
          <p
            className={`text-white tabular-nums ${
              compact ? 'text-[24px] font-bold leading-tight mt-0.5' : 'display-md mt-1.5'
            }`}
          >
            {session ? elapsed : num(state.data?.today.workedHours ?? 0)}
            {!session && <span className="text-lg font-semibold text-white/60 ml-1">h today</span>}
          </p>

          <p className="text-[13px] text-white/65 mt-1">
            {session
              ? `Running since ${formatTime(session.checkIn)}`
              : state.data && state.data.today.sessions > 0
                ? `${state.data.today.sessions} session${
                    state.data.today.sessions === 1 ? '' : 's'
                  } logged today`
                : 'You have not clocked in today'}
          </p>
        </>
      )}
    </div>
  );

  const controls = notLinked ? null : (
    <div className={`flex flex-wrap items-center gap-2.5 ${compact ? '' : 'mt-5'}`}>
      {session ? (
        <Button
          variant="secondary"
          className="btn-on-accent"
          loading={busy}
          icon={<LogOut size={16} />}
          onClick={() => act('out')}
        >
          Check out
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="btn-on-accent"
          loading={busy || state.loading}
          icon={<LogIn size={16} />}
          onClick={() => act('in')}
        >
          Check in
        </Button>
      )}

      {state.data && state.data.today.overtimeHours > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/85 bg-white/12 rounded-full px-3 py-1.5">
          <Timer size={13} />
          {num(state.data.today.overtimeHours)}h overtime today
        </span>
      )}
    </div>
  );

  return (
    // Full-height, so when the widget sits beside a taller card its content
    // stays centred rather than stranded at the top of a big blue block.
    <div
      className={`hero-accent relative h-full flex flex-col justify-center ${
        compact ? 'px-5 py-4' : 'p-6'
      }`}
    >
      <div
        className={`relative z-10 ${
          compact ? 'flex flex-wrap items-center justify-between gap-x-8 gap-y-3' : ''
        }`}
      >
        {status}
        {controls}
      </div>
    </div>
  );
}
