'use client';

import { CirclePause, CirclePlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmAction } from '@/components/data/confirm-action';
import { reactivateStationAction, suspendStationAction } from '@/server/actions/sessions';

export function StationControls({
  stationId,
  code,
  status,
  canSuspend,
}: {
  stationId: string;
  code: string;
  status: string;
  canSuspend: boolean;
}) {
  if (!canSuspend) return null;

  if (status === 'suspended') {
    return (
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="sm">
            <CirclePlay />
            החזרה לפעילות
          </Button>
        }
        title={`החזרת עמדה ${code} לפעילות`}
        description="העמדה תחזור לקבל סשנים חדשים. ודא שהתקלה טופלה ושהעמדה בטוחה לשימוש."
        confirmLabel="החזר לפעילות"
        onConfirm={(reason) => reactivateStationAction(stationId, reason)}
      />
    );
  }

  if (status === 'active') {
    return (
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="sm">
            <CirclePause />
            השבתה
          </Button>
        }
        title={`השבתת עמדה ${code}`}
        description="העמדה תפסיק לקבל סשנים חדשים. סשנים פעילים ימשיכו עד לסיומם. ההשבתה נספרת כ־Downtime ומשפיעה על מדד הזמינות ועל Earn-Back."
        confirmLabel="השבת עמדה"
        destructive
        minReasonLength={10}
        onConfirm={(reason) => suspendStationAction(stationId, reason)}
      />
    );
  }

  return null;
}
