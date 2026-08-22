import 'server-only';
import { DEPLOY_DEVICE_KEY } from '@/generated/deploy-config';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * הצפנת סודות מכשירים.
 *
 * ⚠ סעיף 9 בהנחיות: "אל תשמור Secrets גלויים במסד הנתונים או ב־UI."
 * device_auth_key נשמר מוצפן ב־AES-256-GCM ואינו מוחזר מאף endpoint.
 * המפתח עצמו מגיע מ־DEVICE_KEY_ENCRYPTION_KEY בסביבה בלבד.
 */

function getEncryptionKey(): Buffer {
  // ⚠ משתני סביבה של Netlify אינם מגיעים ל־runtime של פונקציית Next,
  // ולכן קיים ערך שנוצר בזמן בנייה. הסביבה עדיין קודמת לו.
  const raw = process.env.DEVICE_KEY_ENCRYPTION_KEY || DEPLOY_DEVICE_KEY;
  if (!raw) {
    throw new Error('DEVICE_KEY_ENCRYPTION_KEY אינו מוגדר. ראה .env.example');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('DEVICE_KEY_ENCRYPTION_KEY חייב להיות 32 בתים ב־base64 (openssl rand -base64 32)');
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('פורמט סוד מוצפן שאינו תקין');
  }
  const [, ivB64, tagB64, dataB64] = parts as [string, string, string, string];
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** מסכה לתצוגה — לעולם לא מציגים את הסוד עצמו */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return '—';
  return '••••••••••••';
}

/** hash חד-כיווני ל־session tokens */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** השוואה עמידה בפני Timing Attack */
export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * מפתח Idempotency לפעולה כספית.
 * אותה פעולה על אותה ישות עם אותם פרמטרים תניב אותו מפתח —
 * ואינדקס ייחודי ב־DB ימנע ביצוע כפול.
 */
export function idempotencyKey(scope: string, ...parts: (string | number)[]): string {
  const raw = `${scope}:${parts.join(':')}`;
  return `${scope}_${createHash('sha256').update(raw).digest('hex').slice(0, 40)}`;
}
