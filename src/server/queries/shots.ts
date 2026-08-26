import 'server-only';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { shotEvents } from '@/db/schema';

/**
 * חבטות של סשן.
 *
 * ⚠ הערכים הם מה שנשלח למכונה. אין אישור מהמכונה שהחבטה יצאה, ולכן אין
 * להציג אותם כמדידה. ראה ההערה על shot_events בסכימה.
 */

export interface ShotRow {
  sequence: number;
  firedAt: Date;
  commandedVelocity: number | null;
  commandedSpinType: number | null;
  commandedSpinAmount: number | null;
  commandedLr: number | null;
  commandedUd: number | null;
  serveMode: string | null;
  pointIndex: number | null;
  derivedSpeedKmh: number | null;
  derivedHeightLevel: number | null;
  derivedAngleDegrees: number | null;
}

export interface ShotSummary {
  total: number;
  firstAt: Date | null;
  lastAt: Date | null;
  avgSpeedKmh: number | null;
  minSpeedKmh: number | null;
  maxSpeedKmh: number | null;
  /** כמה חבטות נושאות ערכים גזורים. פחות מהסך — כיול חלקי. */
  withDerived: number;
  spinBreakdown: { none: number; topspin: number; backspin: number };
}

export async function getSessionShots(sessionId: string, limit = 500): Promise<ShotRow[]> {
  const rows = await db
    .select({
      sequence: shotEvents.sequence,
      firedAt: shotEvents.firedAt,
      commandedVelocity: shotEvents.commandedVelocity,
      commandedSpinType: shotEvents.commandedSpinType,
      commandedSpinAmount: shotEvents.commandedSpinAmount,
      commandedLr: shotEvents.commandedLr,
      commandedUd: shotEvents.commandedUd,
      serveMode: shotEvents.serveMode,
      pointIndex: shotEvents.pointIndex,
      derivedSpeedKmh: shotEvents.derivedSpeedKmh,
      derivedHeightLevel: shotEvents.derivedHeightLevel,
      derivedAngleDegrees: shotEvents.derivedAngleDegrees,
    })
    .from(shotEvents)
    .where(eq(shotEvents.sessionId, sessionId))
    .orderBy(asc(shotEvents.sequence))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    derivedSpeedKmh: r.derivedSpeedKmh === null ? null : Number(r.derivedSpeedKmh),
  }));
}

export async function getSessionShotSummary(sessionId: string): Promise<ShotSummary> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int                                                   AS total,
      MIN(fired_at)                                                   AS first_at,
      MAX(fired_at)                                                   AS last_at,
      AVG(derived_speed_kmh)                                          AS avg_speed,
      MIN(derived_speed_kmh)                                          AS min_speed,
      MAX(derived_speed_kmh)                                          AS max_speed,
      COUNT(derived_speed_kmh)::int                                   AS with_derived,
      COUNT(*) FILTER (WHERE commanded_spin_type = 0)::int            AS spin_none,
      COUNT(*) FILTER (WHERE commanded_spin_type = 1)::int            AS spin_top,
      COUNT(*) FILTER (WHERE commanded_spin_type = 2)::int            AS spin_back
    FROM shot_events
    WHERE session_id = ${sessionId}
  `);

  const r = (result.rows[0] ?? {}) as Record<string, string | number | null>;
  const num = (v: string | number | null | undefined) =>
    v === null || v === undefined ? null : Number(v);

  return {
    total: Number(r.total ?? 0),
    firstAt: r.first_at ? new Date(String(r.first_at)) : null,
    lastAt: r.last_at ? new Date(String(r.last_at)) : null,
    avgSpeedKmh: num(r.avg_speed),
    minSpeedKmh: num(r.min_speed),
    maxSpeedKmh: num(r.max_speed),
    withDerived: Number(r.with_derived ?? 0),
    spinBreakdown: {
      none: Number(r.spin_none ?? 0),
      topspin: Number(r.spin_top ?? 0),
      backspin: Number(r.spin_back ?? 0),
    },
  };
}
