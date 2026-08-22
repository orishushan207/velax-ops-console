import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { round2 } from '@/lib/money';

export interface LeadRow {
  id: string;
  clubName: string;
  stage: string;
  city: string | null;
  region: string | null;
  courtCount: number | null;
  stationPotential: number | null;
  audienceType: string | null;
  offPeakAvailabilityHours: number | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  source: string | null;
  ownerId: string | null;
  ownerName: string | null;
  closeProbability: number;
  dealValue: number;
  weightedValue: number;
  expectedCloseDate: string | null;
  nextFollowUpAt: Date | null;
  lostReason: string | null;
  clubId: string | null;
  activityCount: number;
  openTaskCount: number;
  createdAt: Date;
}

export async function listLeads(filters: { stage?: string; owner?: string; q?: string }) {
  const conditions = [sql`l.deleted_at IS NULL`];
  if (filters.stage && filters.stage !== 'all') conditions.push(sql`l.stage = ${filters.stage}`);
  if (filters.owner && filters.owner !== 'all') {
    conditions.push(sql`l.owner_id = ${filters.owner}::uuid`);
  }
  if (filters.q) {
    const like = `%${filters.q}%`;
    conditions.push(sql`(l.club_name ILIKE ${like} OR l.city ILIKE ${like})`);
  }
  const where = sql.join(conditions, sql` AND `);

  const rows = await db.execute(sql`
    SELECT l.*, u.full_name AS owner_name,
      (SELECT COUNT(*)::int FROM crm_activities a WHERE a.lead_id = l.id) AS activity_count,
      (SELECT COUNT(*)::int FROM tasks t WHERE t.lead_id = l.id AND t.status IN ('open','in_progress')
        AND t.deleted_at IS NULL) AS open_task_count
    FROM leads l
    LEFT JOIN users u ON u.id = l.owner_id
    WHERE ${where}
    ORDER BY l.close_probability DESC, l.created_at DESC
  `);

  return rows.rows.map((r) => {
    const row = r as Record<string, unknown>;
    const dealValue = round2(Number(row.deal_value ?? 0));
    const prob = Number(row.close_probability ?? 0);
    return {
      id: String(row.id),
      clubName: String(row.club_name),
      stage: String(row.stage),
      city: row.city ? String(row.city) : null,
      region: row.region ? String(row.region) : null,
      courtCount: row.court_count === null ? null : Number(row.court_count),
      stationPotential: row.station_potential === null ? null : Number(row.station_potential),
      audienceType: row.audience_type ? String(row.audience_type) : null,
      offPeakAvailabilityHours:
        row.off_peak_availability_hours === null
          ? null
          : Number(row.off_peak_availability_hours),
      contactName: row.contact_name ? String(row.contact_name) : null,
      contactPhone: row.contact_phone ? String(row.contact_phone) : null,
      contactEmail: row.contact_email ? String(row.contact_email) : null,
      source: row.source ? String(row.source) : null,
      ownerId: row.owner_id ? String(row.owner_id) : null,
      ownerName: row.owner_name ? String(row.owner_name) : null,
      closeProbability: prob,
      dealValue,
      weightedValue: round2(dealValue * prob),
      expectedCloseDate: row.expected_close_date ? String(row.expected_close_date) : null,
      nextFollowUpAt: row.next_follow_up_at ? new Date(row.next_follow_up_at as string) : null,
      lostReason: row.lost_reason ? String(row.lost_reason) : null,
      clubId: row.club_id ? String(row.club_id) : null,
      activityCount: Number(row.activity_count ?? 0),
      openTaskCount: Number(row.open_task_count ?? 0),
      createdAt: new Date(row.created_at as string),
    } satisfies LeadRow;
  });
}

export async function getLeadDetail(leadId: string) {
  const rows = await db.execute(sql`
    SELECT l.*, u.full_name AS owner_name, c.name AS linked_club_name
    FROM leads l
    LEFT JOIN users u ON u.id = l.owner_id
    LEFT JOIN clubs c ON c.id = l.club_id
    WHERE l.id = ${leadId}::uuid AND l.deleted_at IS NULL LIMIT 1
  `);
  const lead = rows.rows[0] as Record<string, unknown> | undefined;
  if (!lead) return null;

  const [activities, tasks] = await Promise.all([
    db.execute(sql`
      SELECT a.*, u.full_name AS performer_name FROM crm_activities a
      LEFT JOIN users u ON u.id = a.performed_by
      WHERE a.lead_id = ${leadId}::uuid ORDER BY a.occurred_at DESC
    `),
    db.execute(sql`
      SELECT t.*, u.full_name AS assignee_name FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.lead_id = ${leadId}::uuid AND t.deleted_at IS NULL
      ORDER BY t.due_at NULLS LAST
    `),
  ]);

  return {
    lead,
    activities: activities.rows as Record<string, unknown>[],
    tasks: tasks.rows as Record<string, unknown>[],
  };
}

export async function listSalesOwners() {
  const rows = await db.execute(sql`
    SELECT DISTINCT u.id, u.full_name FROM leads l
    JOIN users u ON u.id = l.owner_id WHERE l.deleted_at IS NULL ORDER BY u.full_name
  `);
  return rows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { value: String(row.id), label: String(row.full_name) };
  });
}
