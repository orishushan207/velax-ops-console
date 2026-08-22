import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { CurrentUser } from '@/server/auth/session';

export interface SearchResult {
  type:
    | 'session'
    | 'player'
    | 'club'
    | 'station'
    | 'device'
    | 'payment'
    | 'ticket'
    | 'coach'
    | 'lead';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: string;
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  session: 'Session',
  player: 'שחקן',
  club: 'מועדון',
  station: 'עמדה',
  device: 'מכונה',
  payment: 'תשלום',
  ticket: 'תקלה',
  coach: 'מאמן',
  lead: 'ליד',
};

export function searchTypeLabel(type: SearchResult['type']): string {
  return TYPE_LABELS[type];
}

/**
 * מגביל שאילתה למועדונים שהמשתמש רשאי לראות.
 * משתמש גלובלי מקבל TRUE; משתמש ללא היקף כלל מקבל FALSE (ולא "הכל").
 */
function scopeFor(user: CurrentUser, column: string) {
  if (user.isGlobal) return sql`TRUE`;
  const ids = user.clubIds ?? [];
  if (ids.length === 0) return sql`FALSE`;
  return sql`${sql.raw(column)} IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

/**
 * חיפוש גלובלי — סעיף 5 בהנחיות.
 *
 * מאתר: Session, שחקן, מועדון, עמדה, מכונה, תשלום, תקלה,
 * מספר טלפון, מספר סידורי ומזהה עסקה.
 *
 * ⚠ התוצאות מסוננות לפי היקף המועדונים של המשתמש. מנהל מועדון
 * לא יראה בחיפוש ישויות ממועדונים שאינם שלו.
 */
export async function globalSearch(query: string, user: CurrentUser): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const like = `%${q}%`;

  const canSeePii = user.permissions.has('players.view_pii');
  const results: SearchResult[] = [];

  // ─── Sessions: לפי reference או מזהה עסקה ───
  if (user.permissions.has('sessions.view')) {
    const rows = await db.execute(sql`
      SELECT s.id, s.reference, s.status, s.started_at, c.name AS club_name, st.code AS station_code
      FROM sessions s
      JOIN clubs c ON c.id = s.club_id
      JOIN stations st ON st.id = s.station_id
      WHERE s.deleted_at IS NULL
        AND (s.reference ILIKE ${like} OR s.guest_phone ILIKE ${like})
        AND ${scopeFor(user, 's.club_id')}
      ORDER BY s.started_at DESC NULLS LAST
      LIMIT 6
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'session',
        id: String(r.id),
        title: String(r.reference),
        subtitle: `${r.club_name} · ${r.station_code}`,
        href: `/sessions/${r.id}`,
        badge: String(r.status),
      });
    }
  }

  // ─── שחקנים: שם, טלפון, אימייל ───
  if (user.permissions.has('players.view')) {
    const rows = await db.execute(sql`
      SELECT u.id, u.full_name, u.phone, u.email, p.level
      FROM users u
      JOIN player_profiles p ON p.user_id = u.id
      WHERE u.deleted_at IS NULL
        AND (u.full_name ILIKE ${like} OR u.phone ILIKE ${like} OR u.email ILIKE ${like})
      ORDER BY u.full_name
      LIMIT 6
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'player',
        id: String(r.id),
        title: String(r.full_name),
        subtitle: canSeePii ? String(r.phone ?? r.email ?? '') : `רמה ${r.level}`,
        href: `/players/${r.id}`,
      });
    }
  }

  // ─── מועדונים ───
  if (user.permissions.has('clubs.view')) {
    const rows = await db.execute(sql`
      SELECT id, name, code, city, status FROM clubs
      WHERE deleted_at IS NULL
        AND (name ILIKE ${like} OR code ILIKE ${like} OR city ILIKE ${like})
        AND ${scopeFor(user, 'id')}
      ORDER BY name LIMIT 5
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'club',
        id: String(r.id),
        title: String(r.name),
        subtitle: `${r.code} · ${r.city}`,
        href: `/clubs/${r.id}`,
        badge: String(r.status),
      });
    }
  }

  // ─── עמדות ───
  if (user.permissions.has('stations.view')) {
    const rows = await db.execute(sql`
      SELECT st.id, st.code, st.name, st.status, c.name AS club_name
      FROM stations st JOIN clubs c ON c.id = st.club_id
      WHERE st.deleted_at IS NULL
        AND (st.code ILIKE ${like} OR st.name ILIKE ${like} OR st.nfc_tag_id ILIKE ${like})
        AND ${scopeFor(user, 'st.club_id')}
      ORDER BY st.code LIMIT 5
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'station',
        id: String(r.id),
        title: String(r.code),
        subtitle: `${r.name} · ${r.club_name}`,
        href: `/stations/${r.id}`,
        badge: String(r.status),
      });
    }
  }

  // ─── מכונות: Device ID או מספר סידורי ───
  if (user.permissions.has('devices.view')) {
    const rows = await db.execute(sql`
      SELECT d.id, d.device_id, d.serial_number, d.status, c.name AS club_name
      FROM devices d LEFT JOIN clubs c ON c.id = d.current_club_id
      WHERE d.deleted_at IS NULL
        AND (d.device_id ILIKE ${like} OR d.serial_number ILIKE ${like})
        AND ${scopeFor(user, 'd.current_club_id')}
      ORDER BY d.device_id LIMIT 5
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'device',
        id: String(r.id),
        title: String(r.device_id),
        subtitle: `${r.serial_number} · ${r.club_name ?? 'במלאי'}`,
        href: `/stations/devices/${r.id}`,
        badge: String(r.status),
      });
    }
  }

  // ─── תשלומים: reference או מזהה עסקה אצל הסולק ───
  if (user.permissions.has('payments.view')) {
    const rows = await db.execute(sql`
      SELECT p.id, p.reference, p.provider_transaction_id, p.amount_gross, p.status, p.session_id
      FROM payments p
      WHERE p.deleted_at IS NULL
        AND (p.reference ILIKE ${like} OR p.provider_transaction_id ILIKE ${like})
        AND ${scopeFor(user, 'p.club_id')}
      ORDER BY p.captured_at DESC NULLS LAST LIMIT 5
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'payment',
        id: String(r.id),
        title: String(r.reference),
        subtitle: `${Number(r.amount_gross).toFixed(2)} ₪ · ${r.provider_transaction_id ?? ''}`,
        href: r.session_id ? `/sessions/${r.session_id}` : '/payments',
        badge: String(r.status),
      });
    }
  }

  // ─── תקלות ───
  if (user.permissions.has('tickets.view')) {
    const rows = await db.execute(sql`
      SELECT t.id, t.reference, t.title, t.status, t.severity, c.name AS club_name
      FROM support_tickets t LEFT JOIN clubs c ON c.id = t.club_id
      WHERE t.deleted_at IS NULL
        AND (t.reference ILIKE ${like} OR t.title ILIKE ${like})
        AND ${scopeFor(user, 't.club_id')}
      ORDER BY t.created_at DESC LIMIT 5
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'ticket',
        id: String(r.id),
        title: String(r.reference),
        subtitle: `${r.title} · ${r.club_name ?? ''}`,
        href: `/tickets/${r.id}`,
        badge: String(r.severity),
      });
    }
  }

  // ─── מאמנים ───
  if (user.permissions.has('coaches.view')) {
    const rows = await db.execute(sql`
      SELECT co.id, co.display_name, co.referral_code, co.verification
      FROM coaches co
      WHERE co.deleted_at IS NULL
        AND (co.display_name ILIKE ${like} OR co.referral_code ILIKE ${like})
      LIMIT 4
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'coach',
        id: String(r.id),
        title: String(r.display_name),
        subtitle: `קוד: ${r.referral_code}`,
        href: `/coaches/${r.id}`,
        badge: String(r.verification),
      });
    }
  }

  // ─── לידים ───
  if (user.permissions.has('crm.view')) {
    const rows = await db.execute(sql`
      SELECT id, club_name, city, stage FROM leads
      WHERE deleted_at IS NULL AND (club_name ILIKE ${like} OR city ILIKE ${like})
      LIMIT 4
    `);
    for (const r of rows.rows as Record<string, unknown>[]) {
      results.push({
        type: 'lead',
        id: String(r.id),
        title: String(r.club_name),
        subtitle: String(r.city ?? ''),
        href: `/crm/${r.id}`,
        badge: String(r.stage),
      });
    }
  }

  return results;
}
