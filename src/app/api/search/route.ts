import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth/session';
import { globalSearch } from '@/server/queries/search';

/**
 * חיפוש גלובלי. נקרא מה־Command Palette ומשורת החיפוש בכותרת.
 *
 * ⚠ התוצאות מסוננות לפי הרשאות והיקף מועדונים של המשתמש המחובר.
 * אין כאן פרמטר "clubId" שלקוח יכול לשלוט בו — היקף הגישה נקבע בשרת בלבד.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ results: [] }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get('q') ?? '';
  if (query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await globalSearch(query, user);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('שגיאה בחיפוש גלובלי:', error);
    return NextResponse.json({ results: [], error: 'החיפוש נכשל' }, { status: 500 });
  }
}
