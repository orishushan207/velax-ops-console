import { FlaskConical } from 'lucide-react';

/**
 * באנר נתוני הדגמה.
 *
 * ⚠ סעיף 28 בהנחיות: "סמן בבירור שמדובר ב־Demo Data."
 * וסעיף 4: "אין להציג נתוני Mock כאילו הגיעו ממערכת אמיתית."
 *
 * הבאנר מוצג כל עוד קיימות במסד שורות עם is_demo = true.
 */
export function DemoBanner({ mockIntegrations }: { mockIntegrations: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-500/20 bg-[var(--signal-warning-bg)] px-4 py-2 text-[12px] text-[var(--signal-warning)]/90">
      <span className="flex items-center gap-1.5 font-semibold">
        <FlaskConical className="size-3.5" />
        נתוני הדגמה
      </span>
      <span className="text-[var(--signal-warning)]/70">
        המסד מכיל נתוני Demo שנוצרו על ידי Seed ואינם פעילות אמיתית.
      </span>
      {mockIntegrations.length > 0 && (
        <span className="text-[var(--signal-warning)]/70">
          אינטגרציות במצב Mock: {mockIntegrations.join(' · ')}
        </span>
      )}
    </div>
  );
}
