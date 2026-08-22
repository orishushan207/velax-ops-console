import Link from 'next/link';
import { VelaXLogo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <html lang="he" dir="rtl">
      <body className="on-dark grid min-h-dvh place-items-center bg-[#0a0a0b]">
        <div className="text-center">
          <VelaXLogo className="mx-auto w-48" />
          <h1 className="mt-6 text-5xl font-black tracking-tighter">404</h1>
          <p className="mt-3 text-sm text-[var(--fg-secondary)]">הדף שחיפשת אינו קיים.</p>
          <Button variant="primary" className="mt-6" asChild>
            <Link href="/">חזרה למרכז השליטה</Link>
          </Button>
        </div>
      </body>
    </html>
  );
}
