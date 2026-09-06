import { useState } from 'react';
import { CalendarClock, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../auth/AuthContext';
import { CAN } from '../auth/permissions';
import { useAction, useAsync } from '../lib/useApi';
import { DAY_NAMES, DAY_SHORT, num } from '../lib/format';
import { useToast } from '../components/Toast';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Modal,
  PageHeader,
  Section,
  SkeletonRows,
} from '../components/ui';
import type { ScheduleLine, WorkingSchedule } from '../types';

/** Weekly hours, derived exactly the way the API derives them. */
function weeklyHours(lines: ScheduleLine[]): number {
  const minutes = (value: string) => {
    const [hour = '0', minute = '0'] = value.split(':');
    return Number(hour) * 60 + Number(minute);
  };
  const total = lines.reduce((sum, line) => {
    const span = minutes(line.endTime) - minutes(line.startTime) - (line.breakMinutes || 0);
    return sum + Math.max(span, 0);
  }, 0);
  return Math.round((total / 60) * 100) / 100;
}

const DEFAULT_LINES: ScheduleLine[] = [1, 2, 3, 4, 5].map((day) => ({
  dayOfWeek: day,
  startTime: '09:00',
  endTime: '18:00',
  breakMinutes: 60,
}));

export function SchedulesPage() {
  const { role } = useAuth();
  const { success } = useToast();
  const canWrite = CAN.writePeople(role);

  const [editing, setEditing] = useState<WorkingSchedule | null>(null);
  const [creating, setCreating] = useState(false);

  const schedules = useAsync(() => api.schedules.list({ limit: 50 }), []);

  return (
    <div className="animate-fade-in">
      <PageHeader
        icon={<CalendarClock size={19} />}
        title="Working schedules"
        actions={
          canWrite && (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
              New schedule
            </Button>
          )
        }
      />

      {schedules.error ? (
        <ErrorState message={schedules.error} onRetry={schedules.reload} />
      ) : schedules.loading ? (
        <div className="card">
          <SkeletonRows rows={4} cols={3} />
        </div>
      ) : (schedules.data?.data.length ?? 0) === 0 ? (
        <div className="card">
          <EmptyState
            title="No working schedules yet"
            message="A schedule defines the weekly pattern an employee is expected to work."
            icon={<CalendarClock size={22} />}
            action={
              canWrite && (
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                  New schedule
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {schedules.data?.data.map((schedule) => (
            <Section
              key={schedule.id}
              title={schedule.name}
              description={`${num(schedule.weeklyHours)} hours/week · ${
                schedule.employeeCount ?? 0
              } employee${schedule.employeeCount === 1 ? '' : 's'}`}
              actions={
                canWrite && (
                  <Button size="sm" onClick={() => setEditing(schedule)}>
                    Edit
                  </Button>
                )
              }
              bodyClassName="p-0"
            >
              <div className="px-5 pt-4 pb-2 flex gap-1.5">
                {DAY_SHORT.map((day, index) => {
                  const worked = schedule.lines.some((line) => line.dayOfWeek === index);
                  return (
                    <span
                      key={day}
                      className={`flex-1 text-center py-1.5 rounded-[var(--r-sm)] text-[11px] font-bold uppercase tracking-wide ${
                        worked
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'bg-[var(--canvas)] text-[var(--muted)]'
                      }`}
                    >
                      {day}
                    </span>
                  );
                })}
              </div>

              <table className="w-full">
                <tbody>
                  {[...schedule.lines]
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                    .map((line, index) => (
                      <tr key={line.id ?? index} className="border-t border-[var(--line)]">
                        <td className="px-5 py-2.5 text-[13px] font-semibold text-[var(--ink)]">
                          {DAY_NAMES[line.dayOfWeek]}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--slate)] tabular-nums">
                          {line.startTime.slice(0, 5)} – {line.endTime.slice(0, 5)}
                        </td>
                        <td className="px-5 py-2.5 text-[13px] text-[var(--muted)] text-right tabular-nums">
                          {line.breakMinutes} min break
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </Section>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ScheduleModal
          schedule={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            success(editing ? 'Schedule updated' : 'Schedule created');
            setCreating(false);
            setEditing(null);
            schedules.reload();
          }}
        />
      )}
    </div>
  );
}

function ScheduleModal({
  schedule,
  onClose,
  onSaved,
}: {
  schedule: WorkingSchedule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { error } = useToast();
  const { busy, run } = useAction({ onError: error });

  const [name, setName] = useState(schedule?.name ?? '');
  const [lines, setLines] = useState<ScheduleLine[]>(
    schedule
      ? schedule.lines.map((line) => ({
          dayOfWeek: line.dayOfWeek,
          startTime: line.startTime.slice(0, 5),
          endTime: line.endTime.slice(0, 5),
          breakMinutes: line.breakMinutes,
        }))
      : DEFAULT_LINES,
  );
  const [touched, setTouched] = useState(false);

  const setLine = (index: number, patch: Partial<ScheduleLine>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const invalidName = !name.trim();
  const invalidLines = lines.some((line) => line.endTime <= line.startTime);

  const submit = async () => {
    setTouched(true);
    if (invalidName || invalidLines) return;

    const payload = {
      name: name.trim(),
      lines: lines.map((line) => ({
        dayOfWeek: Number(line.dayOfWeek),
        startTime: line.startTime,
        endTime: line.endTime,
        breakMinutes: Number(line.breakMinutes) || 0,
      })),
    };

    const saved = await run(() =>
      schedule ? api.schedules.update(schedule.id, payload) : api.schedules.create(payload),
    );
    if (saved) onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={schedule ? `Edit ${schedule.name}` : 'New working schedule'}
      width="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-[13px] text-[var(--slate)]">
            <span className="font-bold text-[var(--ink)] tabular-nums">
              {num(weeklyHours(lines))}
            </span>{' '}
            hours per week
          </span>
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {schedule ? 'Save changes' : 'Create schedule'}
          </Button>
        </>
      }
    >
      <Field
        label="Schedule name"
        required
        error={touched && invalidName ? 'Name is required' : undefined}
        className="mb-5"
      >
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="40 hours / week"
        />
      </Field>

      <div className="space-y-2">
        <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3 px-1 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
          <span>Day</span>
          <span>Start</span>
          <span>End</span>
          <span>Break (min)</span>
          <span />
        </div>

        {lines.map((line, index) => (
          <div
            key={index}
            className="grid sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-3 items-center rounded-[var(--r-md)] border border-[var(--line)] p-2.5 sm:p-2 sm:border-0"
          >
            <select
              value={line.dayOfWeek}
              onChange={(event) => setLine(index, { dayOfWeek: Number(event.target.value) })}
              className="input h-9 cursor-pointer"
            >
              {DAY_NAMES.map((day, dayIndex) => (
                <option key={day} value={dayIndex}>
                  {day}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={line.startTime}
              onChange={(event) => setLine(index, { startTime: event.target.value })}
              className="input h-9"
            />
            <input
              type="time"
              value={line.endTime}
              onChange={(event) => setLine(index, { endTime: event.target.value })}
              className={`input h-9 ${
                touched && line.endTime <= line.startTime ? 'border-[var(--danger)]' : ''
              }`}
            />
            <input
              type="number"
              min="0"
              step="5"
              value={line.breakMinutes}
              onChange={(event) => setLine(index, { breakMinutes: Number(event.target.value) })}
              className="input h-9"
            />
            <button
              type="button"
              onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
              className="text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-soft)] p-2 rounded-[var(--r-sm)] transition-colors justify-self-start sm:justify-self-auto"
              aria-label="Remove line"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {touched && invalidLines && (
        <p className="text-xs text-[var(--danger)] mt-3 font-medium">
          Every line must end after it starts.
        </p>
      )}

      <Button
        size="sm"
        icon={<Plus size={14} />}
        className="mt-4"
        onClick={() =>
          setLines((current) => [
            ...current,
            { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', breakMinutes: 60 },
          ])
        }
      >
        Add line
      </Button>
    </Modal>
  );
}
