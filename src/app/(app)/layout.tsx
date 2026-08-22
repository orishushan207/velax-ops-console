import { redirect } from 'next/navigation';
import { sql } from 'drizzle-orm';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandPalette } from '@/components/shell/command-palette';
import { DemoBanner } from '@/components/shell/demo-banner';
import { Header } from '@/components/shell/header';
import { NAV_ITEMS } from '@/components/shell/nav-config';
import { Sidebar } from '@/components/shell/sidebar';
import { db } from '@/db/client';
import { getCurrentUser } from '@/server/auth/session';
import { logoutAction } from '@/server/actions/auth';
import { getIntegrationStatus } from '@/server/providers';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // הניווט מסונן לפי הרשאות — פריט שאין למשתמש הרשאה אליו אינו מוצג כלל,
  // ולא מוצג ומוביל למסך שגיאה.
  const navItems = NAV_ITEMS.filter((item) => user.permissions.has(item.permission));

  const [demoRow] = (
    await db.execute(sql`
      SELECT EXISTS (SELECT 1 FROM sessions WHERE is_demo = true LIMIT 1) AS has_demo
    `)
  ).rows as { has_demo: boolean }[];

  const [notifRow] = (
    await db.execute(sql`
      SELECT COUNT(*)::int AS unread FROM notifications
      WHERE status IN ('pending','sent')
        AND read_at IS NULL
        AND (recipient_user_id = ${user.id}::uuid OR recipient_user_id IS NULL)
    `)
  ).rows as { unread: number }[];

  const mockIntegrations = getIntegrationStatus()
    .filter((i) => i.isMock)
    .map((i) => i.nameHe);

  const scopeLabel = user.isGlobal
    ? 'גישה לכל הרשת'
    : `גישה מוגבלת ל־${user.clubIds?.length ?? 0} מועדונים`;

  return (
    <TooltipProvider delayDuration={200}>
      <a href="#main-content" className="skip-link">
        דילוג לתוכן הראשי
      </a>

      <div className="flex min-h-dvh bg-[var(--bg-base)]">
        <Sidebar items={navItems} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            user={{
              fullName: user.fullName,
              email: user.email,
              roleNames: user.roleNames,
              isImpersonating: Boolean(user.impersonatedByUserId),
              scopeLabel,
            }}
            navItems={navItems}
            unreadNotifications={notifRow?.unread ?? 0}
            onLogout={logoutAction}
          />

          {demoRow?.has_demo && <DemoBanner mockIntegrations={mockIntegrations} />}

          <main id="main-content" className="flex-1 px-4 py-5 lg:px-6 lg:py-6">
            {children}
          </main>
        </div>
      </div>

      <CommandPalette navItems={navItems} />
      <Toaster
        position="bottom-left"
        dir="rtl"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--bg-overlay)',
            color: 'var(--fg-primary)',
            border: '1px solid var(--border-default)',
          },
        }}
      />
    </TooltipProvider>
  );
}
