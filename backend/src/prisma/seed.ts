import { config } from 'dotenv';
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

type Profile = 'punctual' | 'late' | 'early' | 'partTime' | 'overtime';

interface Person {
  firstName: string;
  lastName: string;
  profile: Profile;
}

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
] satisfies {
  name: string;
  description: string;
  manager: Omit<Person, 'profile'>;
  members: Person[];
}[];

const WEEKLY_HOURS: Record<Profile, number> = {
  punctual: 35,
  late: 35,
  early: 35,
  partTime: 17.5,
  overtime: 39,
};

const SCHEDULES: Partial<
  Record<Profile, { weekdays: number[]; start: string; end: string }>
> = {
  early: { weekdays: [1, 2, 3, 4, 5], start: '08:00', end: '16:00' },
  partTime: { weekdays: [1, 2, 3], start: '09:00', end: '15:00' },
};

let seed = 42;
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (min: number, max: number) =>
  Math.round(min + random() * (max - min));

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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

function demoDays(now: number): string[] {
  const today = local(now).day;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (isoWeekday(today) - 1) - WEEKS * 7);
  const days: string[] = [];
  for (
    const d = start;
    d.toISOString().slice(0, 10) <= today;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.toISOString().slice(0, 10);
    if (isoWeekday(day) <= 5) days.push(day);
  }
  return days;
}

interface Entry {
  userId: string;
  clockIn: string;
  clockOut: string | null;
}

function workday(
  userId: string,
  profile: Profile,
  day: string,
  now: number,
): Entry[] {
  const schedule = SCHEDULES[profile];
  if (schedule && !schedule.weekdays.includes(isoWeekday(day))) return [];
  if (random() < 0.04) return [];

  const start = toMinutes(schedule?.start ?? '09:00');
  const target =
    (WEEKLY_HOURS[profile] * 60) / (schedule?.weekdays.length ?? 5);
  const arrival =
    start +
    (profile === 'late'
      ? between(-5, 25)
      : profile === 'early'
        ? between(-10, 4)
        : between(-15, 4));
  const extra =
    profile === 'overtime' && random() < 0.5
      ? between(60, 150)
      : between(-10, 20);

  const sessions: [number, number][] =
    profile === 'partTime'
      ? [[arrival, arrival + target + extra]]
      : (() => {
          const morningEnd = between(12 * 60, 12 * 60 + 30);
          const lunch = between(45, 75);
          const afternoon = target + extra - (morningEnd - arrival);
          return [
            [arrival, morningEnd],
            [morningEnd + lunch, morningEnd + lunch + afternoon],
          ];
        })();

  const entries: Entry[] = [];
  for (const [from, to] of sessions) {
    const clockIn = parisToIso(day, from);
    if (Date.parse(clockIn) > now) break;
    const clockOut = parisToIso(day, to);
    entries.push({
      userId,
      clockIn,
      clockOut: Date.parse(clockOut) > now ? null : clockOut,
    });
  }
  return entries;
}

const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
const orm = db.orm.public;

async function reset(emails: string[]) {
  for (const address of emails) {
    const user = await orm.User.first({ email: address });
    if (!user) continue;
    await orm.CorrectionRequest.where({
      requesterId: user.id,
    }).deleteAndCount();
    await orm.TimeEntry.where({ userId: user.id }).deleteAndCount();
    await orm.Team.where({ managerId: user.id }).deleteAndCount();
  }
  for (const address of emails) {
    await orm.User.where({ email: address }).deleteAndCount();
  }
}

async function main() {
  const now = Date.now();
  const days = demoDays(now);
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];

  const everyone = TEAMS.flatMap((t) => [t.manager, ...t.members]);
  await reset(everyone.map(email));

  const entries: Entry[] = [];
  let users = 0;
  let schedules = 0;
  let forgotten: Entry | undefined;
  let corrected: Entry | undefined;

  for (const team of TEAMS) {
    const manager = await orm.User.create({
      email: email(team.manager),
      firstName: team.manager.firstName,
      lastName: team.manager.lastName,
      role: 'manager',
      weeklyHours: 39,
    });
    users++;
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
        phone: `+336${String(between(10000000, 99999999))}`,
        weeklyHours: WEEKLY_HOURS[person.profile],
      });
      users++;
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

      const forgetsClockOut = person === TEAMS[0].members[0];
      for (const day of days) {
        if (forgetsClockOut && day === today) continue;
        const dayEntries = workday(user.id, person.profile, day, now);
        if (forgetsClockOut && day === yesterday && dayEntries.length) {
          forgotten = dayEntries[dayEntries.length - 1];
          forgotten.clockOut = null;
        }
        if (
          person === TEAMS[1].members[0] &&
          day === days[3] &&
          dayEntries.length
        ) {
          corrected = dayEntries[0];
        }
        entries.push(...dayEntries);
      }
    }
  }

  const timeEntries = await orm.TimeEntry.createAndCount(entries);

  const supportManager = await orm.User.first({
    email: email(TEAMS[1].manager),
  });
  let corrections = 0;
  if (forgotten) {
    const row = await orm.TimeEntry.first({
      userId: forgotten.userId,
      clockIn: forgotten.clockIn,
    });
    await orm.CorrectionRequest.create({
      timeEntryId: row?.id,
      requesterId: forgotten.userId,
      requestedClockIn: forgotten.clockIn,
      requestedClockOut: parisToIso(yesterday, 17 * 60 + 30),
      reason: "J'ai oublié de pointer en partant, je suis parti à 17h30.",
    });
    corrections++;
  }
  if (corrected && supportManager) {
    const row = await orm.TimeEntry.first({
      userId: corrected.userId,
      clockIn: corrected.clockIn,
    });
    await orm.CorrectionRequest.create({
      timeEntryId: row?.id,
      requesterId: corrected.userId,
      requestedClockIn: parisToIso(days[3], 8 * 60 + 55),
      requestedClockOut: corrected.clockOut ?? parisToIso(days[3], 12 * 60),
      reason: 'Badge oublié le matin, arrivée réelle à 8h55.',
      status: 'approved',
      reviewerId: supportManager.id,
      reviewComment: "Confirmé par l'équipe.",
      reviewedAt: new Date(now).toISOString(),
    });
    corrections++;
  }

  console.log(
    `Seed OK: ${users} users (${TEAMS.length} managers), ${TEAMS.length} teams, ` +
      `${schedules} schedule slots, ${timeEntries} time entries, ${corrections} correction requests ` +
      `from ${days[0]} to ${today}.`,
  );
}

try {
  await main();
} finally {
  await db.close();
}
