'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // בפרודקשן כאן ייכנס Error Monitoring (Sentry וכדומה)
    console.error('שגיאת מסך:', error);
  }, [error]);

  const isAuthError = error.message.includes('הרשאה');

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--signal-danger-bg)]">
          <AlertTriangle className="size-5 text-[var(--signal-danger)]" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">
          {isAuthError ? 'אין לך הרשאה לפעולה זו' : 'משהו השתבש'}
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-secondary)]">
          {isAuthError
            ? 'הפעולה נחסמה על ידי מערכת ההרשאות. אם אתה סבור שזו טעות, פנה למנהל המערכת.'
            : 'אירעה שגיאה בטעינת המסך. הנתונים לא נפגעו.'}
        </p>
        {error.digest && (
          <p className="mt-3 text-[11px] text-[var(--fg-tertiary)]">
            מזהה שגיאה: <span className="mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="primary" onClick={reset}>
            <RotateCcw />
            נסה שוב
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">חזרה למרכז השליטה</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
