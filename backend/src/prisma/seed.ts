import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

config({ path: ['.env', '../.env'], quiet: true });

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed demo data in production.');
}

const TZ = 'Europe/Paris';
const DOMAIN = 'trinity-market.example';
const WEEKS = 4;

const WEEKLY_HOURS = {
  punctual: 35,
  late: 35,
  early: 35,
  partTime: 17.5,
  overtime: 39,
};
type Profile = keyof typeof WEEKLY_HOURS;

const SCHEDULES: Partial<
  Record<Profile, { weekdays: number[]; start: string; end: string }>
> = {
  early: { weekdays: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' },
  partTime: { weekdays: [1, 2, 3], start: '09:00', end: '15:00' },
};

const ARRIVAL_OFFSETS: Record<Profile, [number, number]> = {
  punctual: [-15, 4],
  late: [-5, 25],
  early: [-10, 4],
  partTime: [-15, 4],
  overtime: [-15, 4],
};

const TEAMS = [
  {
    name: 'Opérations',
    description: 'Logistique, préparation des commandes et expéditions',
    manager: { firstName: 'Karim', lastName: 'Benali' },
    members: [
      { firstName: 'Léa', lastName: 'Moreau', profile: 'punctual' },
      { firstName: 'Hugo', lastName: 'Lefèvre', profile: 'late' },
      { firstName: 'Inès', lastName: 'Garcia', profile: 'early' },
      { firstName: 'Lucas', lastName: 'Roux', profile: 'overtime' },
      { firstName: 'Chloé', lastName: 'Fournier', profile: 'punctual' },
      { firstName: 'Nathan', lastName: 'Girard', profile: 'punctual' },
      { firstName: 'Manon', lastName: 'Bonnet', profile: 'partTime' },
      { firstName: 'Théo', lastName: 'Dupuis', profile: 'late' },
      { firstName: 'Sarah', lastName: 'Lambert', profile: 'punctual' },
      { firstName: 'Yanis', lastName: 'Fontaine', profile: 'punctual' },
    ],
  },
  {
    name: 'Service client',
    description: 'Support client par téléphone, email et chat',
    manager: { firstName: 'Claire', lastName: 'Martin' },
    members: [
      { firstName: 'Camille', lastName: 'Rousseau', profile: 'punctual' },
      { firstName: 'Enzo', lastName: 'Vincent', profile: 'late' },
      { firstName: 'Jade', lastName: 'Muller', profile: 'punctual' },
      { firstName: 'Adam', lastName: 'Lefebvre', profile: 'early' },
      { firstName: 'Louise', lastName: 'Faure', profile: 'partTime' },
      { firstName: 'Rayan', lastName: 'André', profile: 'punctual' },
      { firstName: 'Zoé', lastName: 'Mercier', profile: 'overtime' },
      { firstName: 'Gabriel', lastName: 'Blanc', profile: 'punctual' },
      { firstName: 'Lina', lastName: 'Guérin', profile: 'late' },
      { firstName: 'Noah', lastName: 'Boyer', profile: 'punctual' },
    ],
  },
] as const;

const forgetsClockOut = TEAMS[0].members[0];
const hasApprovedCorrection = TEAMS[1].members[0];

const between = (min: number, max: number) =>
  Math.round(min + Math.random() * (max - min));

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function local(instant: number) {
  const p: Record<string, string> = {};
  for (const { type, value } of parts.formatToParts(instant)) p[type] = value;
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    hour: +p.hour,
    minute: +p.minute,
  };
}

function parisToIso(day: string, minutesOfDay: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutesOfDay);
  const offset = (t: number) => {
    const l = local(t);
    const [ly, lm, ld] = l.day.split('-').map(Number);
    return Date.UTC(ly, lm - 1, ld, l.hour, l.minute) - t;
  };
  return new Date(wall - offset(wall - offset(wall))).toISOString();
}

const isoWeekday = (day: string) =>
  new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const email = (p: { firstName: string; lastName: string }) =>
  `${p.firstName}.${p.lastName}@${DOMAIN}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

function demoDays(today: string): string[] {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (isoWeekday(today) - 1) - (WEEKS - 1) * 7);
  const days: string[] = [];
  for (
    ;
    d.toISOString().slice(0, 10) <= today;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.toISOString().slice(0, 10);
    if (isoWeekday(day) <= 5) days.push(day);
  }
  return days;
}

interface Entry {
  id: string;
  userId: string;
  clockIn: string;
  clockOut: string | null;
  source: 'web' | 'correction';
}

function workday(
  userId: string,
  profile: Profile,
  day: string,
  now: number,
  mayBeAbsent: boolean,
): Entry[] {
  const schedule = SCHEDULES[profile];
  if (schedule && !schedule.weekdays.includes(isoWeekday(day))) return [];
  if (mayBeAbsent && Math.random() < 0.04) return [];

  const target =
    (WEEKLY_HOURS[profile] * 60) / (schedule?.weekdays.length ?? 5);
  const arrival =
    toMinutes(schedule?.start ?? '09:00') +
    between(...ARRIVAL_OFFSETS[profile]);
  const extra =
    profile === 'overtime' && Math.random() < 0.5
      ? between(60, 150)
      : between(-10, 20);

  let sessions: [number, number][] = [[arrival, arrival + target + extra]];
  if (profile !== 'partTime') {
    const morningEnd = between(12 * 60, 12 * 60 + 30);
    const lunch = between(45, 75);
    const afternoon = target + extra - (morningEnd - arrival);
    sessions = [
      [arrival, morningEnd],
      [morningEnd + lunch, morningEnd + lunch + afternoon],
    ];
  }

  const entries: Entry[] = [];
  for (const [from, to] of sessions) {
    const clockIn = parisToIso(day, from);
    if (Date.parse(clockIn) > now) break;
    const clockOut = parisToIso(day, to);
    entries.push({
      id: randomUUID(),
      userId,
      clockIn,
      clockOut: Date.parse(clockOut) > now ? null : clockOut,
      source: 'web',
    });
  }
  return entries;
}

const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});

async function main() {
  const now = Date.now();
  const today = local(now).day;
  const days = demoDays(today);
  const lastWorkday = days.filter((d) => d < today).at(-1)!;
  const correctionDay = days[2];
  const emails = TEAMS.flatMap((t) => [t.manager, ...t.members]).map(email);

  return db.transaction(async (tx) => {
    const orm = tx.orm.public;

    const oldIds = (await orm.User.where((u) => u.email.in(emails)).all()).map(
      (u) => u.id,
    );
    if (oldIds.length) {
      await orm.CorrectionRequest.where((c) =>
        c.requesterId.in(oldIds),
      ).deleteAndCount();
      await orm.CorrectionRequest.where((c) =>
        c.reviewerId.in(oldIds),
      ).deleteAndCount();
      await orm.AuditLog.where((a) => a.actorId.in(oldIds)).deleteAndCount();
      await orm.TimeEntry.where((e) => e.userId.in(oldIds)).deleteAndCount();
      await orm.Team.where((t) => t.managerId.in(oldIds)).deleteAndCount();
    }
    await orm.Team.where((t) =>
      t.name.in(TEAMS.map((team) => team.name)),
    ).deleteAndCount();
    await orm.User.where((u) => u.email.in(emails)).deleteAndCount();

    const entries: Entry[] = [];
    const corrections: Parameters<typeof orm.CorrectionRequest.create>[0][] =
      [];
    let schedules = 0;

    for (const team of TEAMS) {
      const manager = await orm.User.create({
        email: email(team.manager),
        firstName: team.manager.firstName,
        lastName: team.manager.lastName,
        role: 'manager',
        weeklyHours: 39,
      });
      const created = await orm.Team.create({
        name: team.name,
        description: team.description,
        managerId: manager.id,
      });

      for (const person of team.members) {
        const user = await orm.User.create({
          email: email(person),
          firstName: person.firstName,
          lastName: person.lastName,
          phone: `+336${between(10000000, 99999999)}`,
          weeklyHours: WEEKLY_HOURS[person.profile],
        });
        await orm.TeamMember.create({ teamId: created.id, userId: user.id });

        const schedule = SCHEDULES[person.profile];
        if (schedule) {
          schedules += await orm.WorkSchedule.createAndCount(
            schedule.weekdays.map((weekday) => ({
              userId: user.id,
              weekday,
              startTime: schedule.start,
              endTime: schedule.end,
            })),
          );
        }

        for (const day of days) {
          if (person === forgetsClockOut && day === today) continue;
          const forgets = person === forgetsClockOut && day === lastWorkday;
          const corrected =
            person === hasApprovedCorrection && day === correctionDay;
          const dayEntries = workday(
            user.id,
            person.profile,
            day,
            now,
            !forgets && !corrected,
          );

          if (forgets) {
            const entry = dayEntries[dayEntries.length - 1];
            entry.clockOut = null;
            corrections.push({
              timeEntryId: entry.id,
              requesterId: user.id,
              requestedClockIn: entry.clockIn,
              requestedClockOut: parisToIso(day, 17 * 60 + 30),
              reason:
                "J'ai oublié de pointer en partant, je suis parti à 17h30.",
            });
          }
          if (corrected) {
            const entry = dayEntries[0];
            entry.clockIn = parisToIso(day, 8 * 60 + 55);
            entry.source = 'correction';
            corrections.push({
              timeEntryId: entry.id,
              requesterId: user.id,
              requestedClockIn: entry.clockIn,
              requestedClockOut: entry.clockOut!,
              reason: 'Badge oublié le matin, arrivée réelle à 8h55.',
              status: 'approved',
              reviewerId: manager.id,
              reviewComment: "Confirmé par l'équipe.",
              reviewedAt: new Date(now).toISOString(),
            });
          }
          entries.push(...dayEntries);
        }
      }
    }

    const timeEntries = await orm.TimeEntry.createAndCount(entries);
    for (const correction of corrections) {
      await orm.CorrectionRequest.create(correction);
    }

    return (
      `Seed OK: ${emails.length} users (${TEAMS.length} managers), ` +
      `${TEAMS.length} teams, ${schedules} schedule slots, ` +
      `${timeEntries} time entries, ${corrections.length} correction requests ` +
      `from ${days[0]} to ${today}.`
    );
  });
}

try {
  console.log(await main());
} finally {
  await db.close();
}
