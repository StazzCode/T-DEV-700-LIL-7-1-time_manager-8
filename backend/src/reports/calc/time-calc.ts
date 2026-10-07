export interface TimeEntry {
  clockIn: Date;
  clockOut: Date | null;
}

export interface ScheduleSlot {
  weekday: number;
  startTime: string;
}

export interface CalcOptions {
  timeZone: string;
  maxSessionHours?: number;
}

export interface ComplianceAlert {
  rule: 'daily_max' | 'weekly_max' | 'daily_rest';
  period: string;
  minutes: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const DEFAULT_MAX_SESSION_HOURS = 12;

const MAX_DAILY_MINUTES = 10 * 60;
const MAX_WEEKLY_MINUTES = 48 * 60;
const MIN_DAILY_REST_MS = 11 * HOUR;

export const DEFAULT_SCHEDULE: ScheduleSlot[] = [1, 2, 3, 4, 5].map(
  (weekday) => ({ weekday, startTime: '09:00' }),
);

const formatters = new Map<string, Intl.DateTimeFormat>();

function localParts(instant: Date, timeZone: string) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, fmt);
  }
  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(instant)) p[type] = value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    secondsOfDay: +p.hour * 3600 + +p.minute * 60 + +p.second,
  };
}

export function localDate(instant: Date, timeZone: string): string {
  return localParts(instant, timeZone).date;
}

export function isoWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

export function isoWeek(date: string): string {
  const thursday = new Date(`${date}T00:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - isoWeekday(date));
  const year = thursday.getUTCFullYear();
  const week =
    Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function isSuspicious(
  entry: TimeEntry,
  now: Date,
  maxSessionHours = DEFAULT_MAX_SESSION_HOURS,
): boolean {
  const end = entry.clockOut ?? now;
  return end.getTime() - entry.clockIn.getTime() > maxSessionHours * HOUR;
}

function countedEntries(entries: TimeEntry[], opts: CalcOptions) {
  const max = (opts.maxSessionHours ?? DEFAULT_MAX_SESSION_HOURS) * HOUR;
  return entries.filter(
    (e): e is TimeEntry & { clockOut: Date } =>
      e.clockOut !== null && e.clockOut.getTime() - e.clockIn.getTime() <= max,
  );
}

function totalsBy(
  entries: TimeEntry[],
  opts: CalcOptions,
  key: (localDay: string) => string,
): Map<string, number> {
  const ms = new Map<string, number>();
  for (const e of countedEntries(entries, opts)) {
    const k = key(localDate(e.clockIn, opts.timeZone));
    ms.set(k, (ms.get(k) ?? 0) + e.clockOut.getTime() - e.clockIn.getTime());
  }
  return new Map([...ms].map(([k, v]) => [k, Math.round(v / MINUTE)]));
}

export function dailyMinutes(entries: TimeEntry[], opts: CalcOptions) {
  return totalsBy(entries, opts, (day) => day);
}

export function weeklyMinutes(entries: TimeEntry[], opts: CalcOptions) {
  return totalsBy(entries, opts, isoWeek);
}

export function contractGapMinutes(workedMinutes: number, weeklyHours: number) {
  return workedMinutes - Math.round(weeklyHours * 60);
}

export function punctuality(
  entries: TimeEntry[],
  opts: CalcOptions & { schedule?: ScheduleSlot[]; toleranceMinutes?: number },
): { onTime: number; worked: number } {
  const schedule = opts.schedule?.length ? opts.schedule : DEFAULT_SCHEDULE;
  const tolerance = opts.toleranceMinutes ?? 5;

  const firstArrival = new Map<string, number>();
  for (const e of entries) {
    const { date, secondsOfDay } = localParts(e.clockIn, opts.timeZone);
    const prev = firstArrival.get(date);
    if (prev === undefined || secondsOfDay < prev)
      firstArrival.set(date, secondsOfDay);
  }

  let onTime = 0;
  let worked = 0;
  for (const [date, arrival] of firstArrival) {
    const slot = schedule.find((s) => s.weekday === isoWeekday(date));
    if (!slot) continue;
    worked++;
    const [h, m] = slot.startTime.split(':').map(Number);
    if (arrival <= (h * 60 + m + tolerance) * 60) onTime++;
  }
  return { onTime, worked };
}

export function complianceAlerts(
  entries: TimeEntry[],
  opts: CalcOptions,
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  for (const [period, minutes] of dailyMinutes(entries, opts)) {
    if (minutes > MAX_DAILY_MINUTES)
      alerts.push({ rule: 'daily_max', period, minutes });
  }
  for (const [period, minutes] of weeklyMinutes(entries, opts)) {
    if (minutes > MAX_WEEKLY_MINUTES)
      alerts.push({ rule: 'weekly_max', period, minutes });
  }

  const sorted = countedEntries(entries, opts).sort(
    (a, b) => a.clockIn.getTime() - b.clockIn.getTime(),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const day = localDate(sorted[i].clockIn, opts.timeZone);
    if (day === localDate(prev.clockIn, opts.timeZone)) continue;
    const rest = sorted[i].clockIn.getTime() - prev.clockOut.getTime();
    if (rest < MIN_DAILY_REST_MS) {
      alerts.push({
        rule: 'daily_rest',
        period: day,
        minutes: Math.round(rest / MINUTE),
      });
    }
  }
  return alerts;
}

export function workingDays(from: string, to: string): number {
  let count = 0;
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += DAY) {
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

export function teamAverage(
  totalMinutes: number,
  members: number,
  periods: number,
) {
  const slots = members * periods;
  return slots === 0 ? 0 : Math.round(totalMinutes / slots);
}
