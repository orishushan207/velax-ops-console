import { cn } from '@/lib/utils';

/**
 * לוגו VELA-X.
 *
 * הלוגו נבנה כ־SVG מונו־ליין ולא כקובץ תמונה, מכיוון ש:
 *   • הוא נשאר חד בכל גודל ובכל צפיפות מסך
 *   • הצבעים נשלפים מטוקני המותג ולא מוטמעים בפיקסלים
 *   • אין בקשת רשת נוספת ואין הבהוב בטעינה
 *
 * חלוקת הצבעים לפי שפת המותג: VELA- בלבן, X ב־Lime.
 */

const STROKE = 26;

/** סימן ה־X בלבד — לשימוש בסרגל מצומצם, ב־Favicon ובכותרת המובייל */
export function VelaXMark({
  className,
  title = 'VELA-X',
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="200" height="200" rx="44" fill="var(--accent, #c6f24e)" />
      <path
        d="M58 58 L142 142 M142 58 L58 142"
        stroke="var(--accent-fg, #0a0a0b)"
        strokeWidth="26"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * הלוגוטייפ המלא.
 *
 * @param tagline  מציג את המשפט המוביל מתחת לשם
 * @param mono     מרנדר את כל האותיות בצבע אחד (לשימוש על רקע צבעוני)
 */
export function VelaXLogo({
  className,
  tagline = false,
  mono = false,
  title = 'VELA-X',
}: {
  className?: string;
  tagline?: boolean;
  mono?: boolean;
  title?: string;
}) {
  const wordColor = mono ? 'currentColor' : 'var(--fg-primary, #fafafa)';
  const accentColor = mono ? 'currentColor' : 'var(--accent, #c6f24e)';

  return (
    <svg
      viewBox={tagline ? '0 0 920 300' : '0 0 920 200'}
      role="img"
      aria-label={tagline ? `${title} — TRAIN SMARTER. PERFORM BETTER.` : title}
      className={cn('h-auto', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        stroke={wordColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* V */}
        <path d="M30 40 L92 160 L154 40" />
        {/* E */}
        <path d="M200 40 L200 160" />
        <path d="M200 40 L296 40" />
        <path d="M200 100 L278 100" />
        <path d="M200 160 L296 160" />
        {/* L */}
        <path d="M342 40 L342 160" />
        <path d="M342 160 L432 160" />
        {/* A */}
        <path d="M478 160 L540 40 L602 160" />
        <path d="M504 112 L576 112" />
        {/* מקף */}
        <path d="M648 100 L714 100" />
      </g>

      {/* X — צבע הפעולה של המותג */}
      <g
        stroke={accentColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M762 40 L884 160" />
        <path d="M884 40 L762 160" />
      </g>

      {tagline && (
        <text
          x="460"
          y="256"
          textAnchor="middle"
          fill={accentColor}
          fontSize="46"
          fontWeight="700"
          letterSpacing="2"
          fontFamily="var(--font-sans, 'Assistant', system-ui, sans-serif)"
          /* המסמך כולו RTL; בלי כפייה ל־LTR הנקודה הסופית קופצת לתחילת השורה */
          direction="ltr"
          style={{ direction: 'ltr', unicodeBidi: 'isolate' }}
        >
          TRAIN SMARTER. PERFORM BETTER.
        </text>
      )}
    </svg>
  );
}

/** המשפט המוביל בלבד, כטקסט — לשימוש בכותרות ובתחתיות */
export function VelaXTagline({ className }: { className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn(
        'block font-bold uppercase tracking-[0.12em] text-[var(--accent)]',
        className,
      )}
      style={{ unicodeBidi: 'isolate' }}
    >
      Train smarter. Perform better.
    </span>
  );
}
