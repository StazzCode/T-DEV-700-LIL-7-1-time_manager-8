import {
  complianceAlerts,
  contractGapMinutes,
  dailyMinutes,
  isoWeek,
  isoWeekCount,
  isoWeekday,
  isSuspicious,
  localDate,
  punctuality,
  teamAverage,
  weeklyMinutes,
  workingDays,
  type TimeEntry,
} from './time-calc.js';

const TZ = 'Europe/Paris';
const opts = { timeZone: TZ };

const entry = (clockIn: string, clockOut: string | null): TimeEntry => ({
  clockIn: new Date(clockIn),
  clockOut: clockOut ? new Date(clockOut) : null,
});

describe('calendar helpers (R-04)', () => {
  it('groups by the local day in the company time zone, not the UTC day', () => {
    expect(localDate(new Date('2026-10-05T23:30:00Z'), TZ)).toBe('2026-10-06');
  });

  it('numbers weekdays the ISO way (Monday = 1, Sunday = 7)', () => {
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(isoWeekday('2026-10-11')).toBe(7);
  });

  it.each([
    ['2026-10-05', '2026-W41'],
    ['2026-01-01', '2026-W01'],
    ['2025-12-29', '2026-W01'],
    ['2026-12-31', '2026-W53'],
    ['2027-01-01', '2026-W53'],
    ['2027-01-04', '2027-W01'],
  ])('isoWeek(%s) = %s', (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
});

describe('daily and weekly totals', () => {
  it('sums several sessions of the same day (R-08)', () => {
    const entries = [
      entry('2026-10-05T07:00:00Z', '2026-10-05T10:30:00Z'),
      entry('2026-10-05T11:30:00Z', '2026-10-05T15:00:00Z'),
    ];
    expect(dailyMinutes(entries, opts)).toEqual(new Map([['2026-10-05', 420]]));
  });

  it('attributes a session crossing midnight to the arrival day (R-05)', () => {
    const entries = [entry('2026-10-05T20:00:00Z', '2026-10-06T00:00:00Z')];
    expect(dailyMinutes(entries, opts)).toEqual(new Map([['2026-10-05', 240]]));
  });

  it('ignores open sessions in totals (R-06)', () => {
    const entries = [
      entry('2026-10-05T07:00:00Z', '2026-10-05T11:00:00Z'),
      entry('2026-10-05T12:00:00Z', null),
    ];
    expect(dailyMinutes(entries, opts).get('2026-10-05')).toBe(240);
  });

  it('excludes sessions longer than 12 h until they are corrected (R-07)', () => {
    const entries = [entry('2026-10-05T07:00:00Z', '2026-10-06T03:00:00Z')];
    expect(dailyMinutes(entries, opts).size).toBe(0);
  });

  it('rounds to the minute once per day, not once per session (R-06)', () => {
    const entries = [
      entry('2026-10-05T07:00:00Z', '2026-10-05T07:01:20Z'),
      entry('2026-10-05T08:00:00Z', '2026-10-05T08:01:20Z'),
      entry('2026-10-05T09:00:00Z', '2026-10-05T09:01:20Z'),
    ];
    expect(dailyMinutes(entries, opts).get('2026-10-05')).toBe(4);
  });

  it('counts real elapsed time when clocks go back (R-12)', () => {
    const entries = [entry('2026-10-24T22:30:00Z', '2026-10-25T03:30:00Z')];
    expect(dailyMinutes(entries, opts)).toEqual(new Map([['2026-10-25', 300]]));
  });

  it('counts real elapsed time when clocks go forward (R-12)', () => {
    const entries = [entry('2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z')];
    expect(dailyMinutes(entries, opts)).toEqual(new Map([['2026-03-29', 60]]));
  });

  it('makes the weekly total equal to the sum of the rounded daily totals', () => {
    const entries = [5, 6, 7, 8, 9].map((d) =>
      entry(`2026-10-0${d}T07:00:00Z`, `2026-10-0${d}T07:00:30Z`),
    );
    expect(weeklyMinutes(entries, opts)).toEqual(new Map([['2026-W41', 5]]));
  });

  it('counts a long session once a manager has verified it (R-07)', () => {
    const long = entry('2026-10-05T05:00:00Z', '2026-10-05T17:30:00Z');
    expect(dailyMinutes([{ ...long, verified: true }], opts)).toEqual(
      new Map([['2026-10-05', 750]]),
    );
  });

  it('groups weeks from Monday to Sunday', () => {
    const entries = [
      entry('2026-10-05T07:00:00Z', '2026-10-05T15:00:00Z'),
      entry('2026-10-11T07:00:00Z', '2026-10-11T09:00:00Z'),
      entry('2026-10-12T07:00:00Z', '2026-10-12T08:00:00Z'),
    ];
    expect(weeklyMinutes(entries, opts)).toEqual(
      new Map([
        ['2026-W41', 600],
        ['2026-W42', 60],
      ]),
    );
  });
});

describe('isSuspicious (R-07)', () => {
  const now = new Date('2026-10-05T20:00:00Z');

  it('flags an open session older than 12 h', () => {
    expect(isSuspicious(entry('2026-10-05T07:00:00Z', null), now)).toBe(true);
  });

  it('does not flag a session in progress', () => {
    expect(isSuspicious(entry('2026-10-05T12:00:00Z', null), now)).toBe(false);
  });

  it('flags a closed session longer than 12 h', () => {
    expect(
      isSuspicious(entry('2026-10-05T07:00:00Z', '2026-10-06T03:00:00Z'), now),
    ).toBe(true);
  });

  it('does not flag a long session verified by a manager', () => {
    const long = entry('2026-10-05T05:00:00Z', '2026-10-05T17:30:00Z');
    expect(isSuspicious({ ...long, verified: true }, now)).toBe(false);
  });

  it('accepts exactly 12 h', () => {
    expect(
      isSuspicious(entry('2026-10-05T06:00:00Z', '2026-10-05T18:00:00Z'), now),
    ).toBe(false);
  });
});

describe('contractGapMinutes (R-10)', () => {
  it('is positive for overtime and negative below the contract', () => {
    expect(contractGapMinutes(38 * 60, 35)).toBe(180);
    expect(contractGapMinutes(30 * 60, 35)).toBe(-300);
    expect(contractGapMinutes(17.5 * 60, 17.5)).toBe(0);
  });
});

describe('punctuality – KPI 1 (R-09)', () => {
  it('is on time up to start + 5 min, late one second after', () => {
    const entries = [
      entry('2026-10-05T07:05:00Z', '2026-10-05T15:00:00Z'),
      entry('2026-10-06T07:05:01Z', '2026-10-06T15:00:00Z'),
    ];
    expect(punctuality(entries, opts)).toEqual({ onTime: 1, worked: 2 });
  });

  it('only looks at the first arrival of the day', () => {
    const entries = [
      entry('2026-10-05T06:55:00Z', '2026-10-05T10:00:00Z'),
      entry('2026-10-05T12:30:00Z', '2026-10-05T15:00:00Z'),
    ];
    expect(punctuality(entries, opts)).toEqual({ onTime: 1, worked: 1 });
  });

  it('counts an arrival even if the session is still open', () => {
    const entries = [entry('2026-10-05T07:30:00Z', null)];
    expect(punctuality(entries, opts)).toEqual({ onTime: 0, worked: 1 });
  });

  it('skips unscheduled days such as weekends with the default schedule', () => {
    const entries = [entry('2026-10-10T09:00:00Z', '2026-10-10T12:00:00Z')];
    expect(punctuality(entries, opts)).toEqual({ onTime: 0, worked: 0 });
  });

  it('uses the personal schedule when there is one', () => {
    const schedule = [{ weekday: 1, startTime: '10:00' }];
    const entries = [entry('2026-10-05T07:55:00Z', '2026-10-05T15:00:00Z')];
    expect(punctuality(entries, { ...opts, schedule })).toEqual({
      onTime: 1,
      worked: 1,
    });
  });

  it('honours a custom tolerance', () => {
    const entries = [entry('2026-10-05T07:03:00Z', '2026-10-05T15:00:00Z')];
    expect(punctuality(entries, { ...opts, toleranceMinutes: 0 })).toEqual({
      onTime: 0,
      worked: 1,
    });
  });
});

describe('complianceAlerts – KPI 3', () => {
  it('reports a day over 10 h, not a day of exactly 10 h', () => {
    const entries = [
      entry('2026-10-05T06:00:00Z', '2026-10-05T16:00:00Z'),
      entry('2026-10-07T06:00:00Z', '2026-10-07T16:01:00Z'),
    ];
    expect(complianceAlerts(entries, opts)).toEqual([
      { rule: 'daily_max', period: '2026-10-07', minutes: 601 },
    ]);
  });

  it('reports a verified session over 12 h', () => {
    const long = entry('2026-10-05T05:00:00Z', '2026-10-05T17:30:00Z');
    expect(complianceAlerts([{ ...long, verified: true }], opts)).toEqual([
      { rule: 'daily_max', period: '2026-10-05', minutes: 750 },
    ]);
  });

  it('reports a week over 48 h', () => {
    const entries = [5, 6, 7, 8, 9].map((d) =>
      entry(`2026-10-0${d}T05:00:00Z`, `2026-10-0${d}T14:45:00Z`),
    );
    expect(complianceAlerts(entries, opts)).toContainEqual({
      rule: 'weekly_max',
      period: '2026-W41',
      minutes: 2925,
    });
  });

  it('reports less than 11 h of rest between two working days', () => {
    const entries = [
      entry('2026-10-05T12:00:00Z', '2026-10-05T20:00:00Z'),
      entry('2026-10-06T06:00:00Z', '2026-10-06T10:00:00Z'),
      entry('2026-10-06T11:00:00Z', '2026-10-06T15:00:00Z'),
      entry('2026-10-07T02:00:00Z', '2026-10-07T06:00:00Z'),
    ];
    expect(complianceAlerts(entries, opts)).toEqual([
      { rule: 'daily_rest', period: '2026-10-06', minutes: 600 },
    ]);
  });

  it('returns nothing for a normal week', () => {
    const entries = [5, 6, 7, 8, 9].map((d) =>
      entry(`2026-10-0${d}T07:00:00Z`, `2026-10-0${d}T15:00:00Z`),
    );
    expect(complianceAlerts(entries, opts)).toEqual([]);
  });
});

describe('team averages (R-13)', () => {
  it('counts Monday to Friday days, bounds included', () => {
    expect(workingDays('2026-10-05', '2026-10-11')).toBe(5);
    expect(workingDays('2026-10-10', '2026-10-11')).toBe(0);
    expect(workingDays('2026-09-28', '2026-10-09')).toBe(10);
  });

  it('counts the ISO weeks touched by a period', () => {
    expect(isoWeekCount('2026-10-05', '2026-10-18')).toBe(2);
    expect(isoWeekCount('2026-10-07', '2026-10-13')).toBe(2);
  });

  it('averages per member and per period', () => {
    expect(teamAverage(6300, 3, 5)).toBe(420);
  });

  it('returns 0 for an empty team or period', () => {
    expect(teamAverage(0, 0, 5)).toBe(0);
    expect(teamAverage(100, 3, 0)).toBe(0);
  });
});
