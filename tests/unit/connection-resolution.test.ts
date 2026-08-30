import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * בחירת מחרוזת החיבור למסד.
 *
 * ⚠ הבדיקה המרכזית: כתובת מקומית בסביבת אירוח נדחית. Next מעתיק את
 * קובץ ה־.env אל תוך ה־bundle, וכשהבנייה נעשית מקומית ה־DATABASE_URL
 * של הפיתוח נוסע איתה לענן. זה כבר שבר פעם אחת פרודקשן.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  for (const k of ['DATABASE_URL', 'POSTGRES_URL', 'VERCEL', 'NETLIFY', 'AWS_LAMBDA_FUNCTION_NAME']) {
    delete process.env[k];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

async function resolve() {
  const mod = await import('@/lib/db-connection');
  return mod.connectionFromEnv();
}

describe('סביבת פיתוח מקומית', () => {
  it('מקבלת כתובת מקומית', async () => {
    process.env.DATABASE_URL = 'postgresql://localhost:5432/velax_ops';
    expect(await resolve()).toBe('postgresql://localhost:5432/velax_ops');
  });
});

describe('סביבת אירוח', () => {
  it('⚠ דוחה כתובת מקומית על Vercel', async () => {
    process.env.VERCEL = '1';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/velax_ops';
    expect(await resolve()).toBeUndefined();
  });

  it('⚠ דוחה גם 127.0.0.1', async () => {
    process.env.VERCEL = '1';
    process.env.DATABASE_URL = 'postgresql://127.0.0.1:5432/velax_ops';
    expect(await resolve()).toBeUndefined();
  });

  it('מקבלת כתובת מרוחקת', async () => {
    process.env.VERCEL = '1';
    const remote = 'postgresql://u:p@ep-cool.eu-central-1.aws.neon.tech/neondb?sslmode=require';
    process.env.DATABASE_URL = remote;
    expect(await resolve()).toBe(remote);
  });

  it('מזהה גם Netlify ו־Lambda כסביבת אירוח', async () => {
    process.env.NETLIFY = 'true';
    process.env.DATABASE_URL = 'postgresql://localhost:5432/x';
    expect(await resolve()).toBeUndefined();
  });
});

describe('סדר עדיפות', () => {
  it('POSTGRES_URL משמש כגיבוי — Vercel מגדיר אותו', async () => {
    process.env.VERCEL = '1';
    const remote = 'postgresql://u:p@ep-x.aws.neon.tech/neondb';
    process.env.POSTGRES_URL = remote;
    expect(await resolve()).toBe(remote);
  });

  it('DATABASE_URL קודם ל־POSTGRES_URL', async () => {
    process.env.DATABASE_URL = 'postgresql://a@remote-a.example/db';
    process.env.POSTGRES_URL = 'postgresql://b@remote-b.example/db';
    expect(await resolve()).toContain('remote-a');
  });

  it('בלי שום הגדרה — undefined ולא קריסה', async () => {
    expect(await resolve()).toBeUndefined();
  });
});
