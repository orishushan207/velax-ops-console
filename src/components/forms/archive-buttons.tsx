'use client';

import { Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/data/confirm-action';
import { archiveClubAction, archiveStationAction } from '@/server/actions/records';

/**
 * ארכוב מועדון או עמדה.
 *
 * ⚠ המערכת אינה מוחקת רשומות פיזית. הרשומה מסומנת כמחוקה ונעלמת מכל המסכים,
 * אבל ההיסטוריה הכספית שתלויה בה — סשנים, תשלומים, זיכויים ו־Earn-Back —
 * נשארת שלמה, כדי שדוח היסטורי לא ישתנה בדיעבד.
 * הניסוח בממשק אומר "ארכוב" ולא "מחיקה" בדיוק בגלל זה.
 */

export function ArchiveStationButton({
  stationId,
  code,
  name,
}: {
  stationId: string;
  code: string;
  name: string;
}) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="dangerOutline" size="sm">
          <Archive />
          ארכוב עמדה
        </Button>
      }
      title={`ארכוב עמדה ${code}`}
      description={`העמדה "${name}" תוסר מכל המסכים ותסומן כגרוטה. היסטוריית האימונים והתשלומים שלה נשמרת במלואה לצורכי דיווח וביקורת. לא ניתן לארכב עמדה שיש עליה אימון פעיל או מכונה משויכת.`}
      confirmLabel="ארכב עמדה"
      destructive
      minReasonLength={10}
      reasonLabel="סיבת הארכוב"
      onConfirm={(reason) => archiveStationAction(stationId, reason)}
      redirectTo="/stations"
    />
  );
}

export function ArchiveClubButton({
  clubId,
  code,
  name,
}: {
  clubId: string;
  code: string;
  name: string;
}) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="dangerOutline" size="sm">
          <Archive />
          ארכוב מועדון
        </Button>
      }
      title={`ארכוב מועדון ${code}`}
      description={`המועדון "${name}" יוסר מכל המסכים ויסומן כנטוש. כל ההיסטוריה הכספית נשמרת. הארכוב חסום כל עוד יש במועדון עמדות פעילות, אימונים פעילים או התחייבות Earn-Back פתוחה.`}
      confirmLabel="ארכב מועדון"
      destructive
      minReasonLength={10}
      reasonLabel="סיבת הארכוב"
      onConfirm={(reason) => archiveClubAction(clubId, reason)}
      redirectTo="/clubs"
    />
  );
}
