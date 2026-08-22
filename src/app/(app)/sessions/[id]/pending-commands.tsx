import { Radio } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatRelative } from '@/lib/format';
import { listPendingRelays } from '@/server/app-api/relay';

/**
 * פקודות שהוזנו מהקונסולה ועדיין לא הגיעו למכונה.
 *
 * ⚠ קיים משום שהענן אינו מגיע למכונה. בלי התצוגה הזו מפעיל לוחץ "עצור",
 * רואה שהסטטוס השתנה, ומניח שהמכונה נעצרה — בזמן שהפקודה ממתינה לטלפון.
 */
export async function PendingCommands({ sessionId }: { sessionId: string }) {
  const pending = await listPendingRelays(sessionId);
  if (pending.length === 0) return null;

  return (
    <Card className="mt-4 border-s-2 border-s-[var(--signal-warning)] p-4">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-[var(--signal-warning)]" />
        <h3 className="text-[13px] font-semibold text-[var(--fg-primary)]">
          פקודות שטרם הגיעו למכונה
        </h3>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--fg-secondary)]">
        למכונה אין חיבור לאינטרנט. הפקודות ימתינו עד שאפליקציית הטלפון תתחבר אליה ב־BLE.
      </p>

      <ul className="mt-3 space-y-2">
        {pending.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--bg-hover)] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="mono text-[12px]">{c.command}</span>
              {c.status === 'fetched' ? (
                <Badge tone="info">נאספה — ממתינה לאישור</Badge>
              ) : (
                <Badge tone="warning" dot>
                  ממתינה לאיסוף
                </Badge>
              )}
            </div>
            <span className="text-[11px] text-[var(--fg-tertiary)]">
              פגה {formatRelative(c.expiresAt)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--fg-tertiary)]">
        ⚠ &ldquo;נאספה&rdquo; אינה &ldquo;בוצעה&rdquo;: האפליקציה קיבלה את הפקודה, אך אין ודאות
        שהמכונה קיבלה אותה עד שמגיע אישור. פקודה שתפוג בלי שנאספה מעידה שלא היה טלפון בטווח.
      </p>
    </Card>
  );
}
