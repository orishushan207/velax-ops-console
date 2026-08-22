import type { Metadata } from 'next';
import { Suspense } from 'react';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { requireUser } from '@/server/auth/guard';
import { DashboardView } from './dashboard/dashboard-view';
import { Skeleton } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'מרכז שליטה' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const clubRows = await db.execute(sql`
    SELECT id, name, region FROM clubs
    WHERE deleted_at IS NULL
      AND ${
        user.isGlobal
          ? sql`TRUE`
          : user.clubIds && user.clubIds.length > 0
            ? sql`id IN (${sql.join(user.clubIds.map((id) => sql`${id}::uuid`), sql`, `)})`
            : sql`FALSE`
      }
    ORDER BY name
  `);

  const clubs = clubRows.rows.map((r) => {
    const row = r as Record<string, string>;
    return { id: String(row.id), name: String(row.name), region: String(row.region) };
  });

  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <DashboardView params={params} clubs={clubs} />
    </Suspense>
  );
}
