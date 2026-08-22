import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { VelaXLogo, VelaXMark } from '@/components/brand/logo';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'התחברות' };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/');

  const isDev = process.env.APP_ENV !== 'production';

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* צד המותג */}
      <section className="on-dark relative hidden flex-col justify-between overflow-hidden bg-[#0a0a0b] p-10 lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, #c6f24e 0%, transparent 45%), radial-gradient(circle at 80% 70%, #c6f24e 0%, transparent 40%)',
          }}
        />
        <div className="relative">
          <VelaXMark className="size-10" />
        </div>
        <div className="relative">
          <VelaXLogo className="w-full max-w-lg" tagline />
          <p className="mt-8 max-w-md text-[13px] leading-relaxed text-[var(--fg-secondary)]">
            Ops Console — מרכז השליטה הפנימי שמנהל את כל הפעילות מאחורי הקלעים:
            מועדונים, עמדות, מכונות, Sessions, כספים, שירות ותחזוקה.
          </p>
        </div>
        <div className="relative flex gap-6 text-[11px] uppercase tracking-widest text-[var(--fg-tertiary)]">
          <span>Station-as-a-Service</span>
          <span>Authorized Device Network</span>
        </div>
      </section>

      {/* צד ההתחברות */}
      <section className="flex items-center justify-center bg-[var(--bg-base)] p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <VelaXLogo className="w-44" />
            <h1 className="mt-3 text-sm font-medium tracking-tight text-[var(--fg-secondary)]">
              Ops Console
            </h1>
          </div>

          <h2 className="text-xl font-semibold tracking-tight">התחברות למערכת</h2>
          <p className="mt-1.5 text-[13px] text-[var(--fg-secondary)]">
            הזן את פרטי המשתמש שלך כדי להיכנס למרכז השליטה.
          </p>

          <LoginForm />

          {isDev && (
            <div className="mt-8 rounded-[var(--radius-card)] bg-[var(--bg-raised)] p-4 ring-1 ring-inset ring-[var(--border-subtle)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-tertiary)]">
                סביבת פיתוח · משתמשי הדגמה
              </p>
              <ul className="mt-2 space-y-1 text-[12px] text-[var(--fg-secondary)]">
                <li>
                  <span className="mono">admin@velax.co.il</span> — Super Admin
                </li>
                <li>
                  <span className="mono">ops@velax.co.il</span> — מנהל תפעול
                </li>
                <li>
                  <span className="mono">finance@velax.co.il</span> — כספים
                </li>
                <li>
                  <span className="mono">club.tlv@velax.co.il</span> — מנהל מועדון (תל אביב בלבד)
                </li>
                <li>
                  <span className="mono">auditor@velax.co.il</span> — צפייה בלבד
                </li>
              </ul>
              <p className="mt-2 text-[12px] text-[var(--fg-tertiary)]">
                סיסמה: <span className="mono">Velax!2026</span>
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
