import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

export const auth = betterAuth({
  basePath: '/api/v1/auth',
  database: new Pool({ connectionString: process.env['DATABASE_URL'] }),
  // Accounts are created by managers, never through public sign-up.
  emailAndPassword: { enabled: true, disableSignUp: true },
  user: {
    modelName: 'User',
    additionalFields: {
      firstName: { type: 'string', input: false },
      lastName: { type: 'string', input: false },
      role: { type: 'string', input: false, defaultValue: 'employee' },
      weeklyHours: { type: 'number', input: false, defaultValue: 35 },
    },
  },
  session: { modelName: 'Session' },
  account: { modelName: 'Account' },
  verification: { modelName: 'Verification' },
  advanced: { database: { generateId: () => randomUUID() } },
  hooks: {},
});
