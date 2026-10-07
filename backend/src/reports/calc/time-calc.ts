export interface TimeEntry {
  clockIn: Date;
  clockOut: Date | null;
  verified?: boolean;
}

export interface ScheduleSlot {
  weekday: number;
  startTime: string;
}

export interface ComplianceAlert {
  rule: 'daily_max' | 'weekly_max' | 'daily_rest';
  period: string;
  minutes: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const MAX_SESSION_MS = 12 * HOUR;
const LATE_TOLERANCE_MINUTES = 5;
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

export function isSuspicious(entry: TimeEntry, now: Date): boolean {
  if (entry.verified) return false;
  const end = entry.clockOut ?? now;
  return end.getTime() - entry.clockIn.getTime() > MAX_SESSION_MS;
}

function countedEntries(entries: TimeEntry[]) {
  return entries.filter(
    (e): e is TimeEntry & { clockOut: Date } =>
      e.clockOut !== null && !isSuspicious(e, e.clockOut),
  );
}

export function dailyMinutes(
  entries: TimeEntry[],
  timeZone: string,
): Map<string, number> {
  const ms = new Map<string, number>();
  for (const e of countedEntries(entries)) {
    const day = localDate(e.clockIn, timeZone);
    ms.set(
      day,
      (ms.get(day) ?? 0) + e.clockOut.getTime() - e.clockIn.getTime(),
    );
  }
  return new Map([...ms].map(([day, v]) => [day, Math.round(v / MINUTE)]));
}

export function weeklyMinutes(daily: Map<string, number>): Map<string, number> {
  const weekly = new Map<string, number>();
  for (const [day, minutes] of daily) {
    const week = isoWeek(day);
    weekly.set(week, (weekly.get(week) ?? 0) + minutes);
  }
  return weekly;
}

export function contractGapMinutes(workedMinutes: number, weeklyHours: number) {
  return workedMinutes - Math.round(weeklyHours * 60);
}

export function punctuality(
  entries: TimeEntry[],
  timeZone: string,
  schedule: ScheduleSlot[] = DEFAULT_SCHEDULE,
): { onTime: number; worked: number } {
  if (!schedule.length) schedule = DEFAULT_SCHEDULE;

  const firstArrival = new Map<string, number>();
  for (const e of entries) {
    const { date, secondsOfDay } = localParts(e.clockIn, timeZone);
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
    if (arrival <= (h * 60 + m + LATE_TOLERANCE_MINUTES) * 60) onTime++;
  }
  return { onTime, worked };
}

export function complianceAlerts(
  entries: TimeEntry[],
  timeZone: string,
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  const daily = dailyMinutes(entries, timeZone);
  for (const [period, minutes] of daily) {
    if (minutes > MAX_DAILY_MINUTES)
      alerts.push({ rule: 'daily_max', period, minutes });
  }
  for (const [period, minutes] of weeklyMinutes(daily)) {
    if (minutes > MAX_WEEKLY_MINUTES)
      alerts.push({ rule: 'weekly_max', period, minutes });
  }

  const sorted = countedEntries(entries)
    .map((e) => ({ ...e, day: localDate(e.clockIn, timeZone) }))
    .sort((a, b) => a.clockIn.getTime() - b.clockIn.getTime());
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.day === prev.day) continue;
    const rest = cur.clockIn.getTime() - prev.clockOut.getTime();
    if (rest < MIN_DAILY_REST_MS) {
      alerts.push({
        rule: 'daily_rest',
        period: cur.day,
        minutes: Math.round(rest / MINUTE),
      });
    }
  }
  return alerts;
}

function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += DAY) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

export function workingDays(from: string, to: string): number {
  return daysBetween(from, to).filter((day) => isoWeekday(day) <= 5).length;
}

export function isoWeekCount(from: string, to: string): number {
  return new Set(daysBetween(from, to).map(isoWeek)).size;
}

export function teamAverage(
  totalMinutes: number,
  members: number,
  periods: number,
) {
  const slots = members * periods;
  return slots === 0 ? 0 : Math.round(totalMinutes / slots);
}
