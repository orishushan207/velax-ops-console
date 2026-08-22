'use client';

import * as React from 'react';
import {
  Ban,
  CircleCheck,
  Link2,
  Radio,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmAction, QuickAction } from '@/components/data/confirm-action';
import {
  assignDeviceAction,
  pingDeviceAction,
  quarantineDeviceAction,
  releaseDeviceAction,
  retireDeviceAction,
  updateFirmwareAction,
} from '@/server/actions/devices';

export interface StationOption {
  id: string;
  code: string;
  clubName: string;
  occupied: boolean;
}

export interface FirmwareOption {
  id: string;
  version: string;
  channel: string;
  isCurrent: boolean;
}

export function DeviceControls({
  deviceId,
  deviceLabel,
  status,
  isAssigned,
  stations,
  firmwares,
  can,
}: {
  deviceId: string;
  deviceLabel: string;
  status: string;
  isAssigned: boolean;
  stations: StationOption[];
  firmwares: FirmwareOption[];
  can: {
    assign: boolean;
    quarantine: boolean;
    firmware: boolean;
    retire: boolean;
    telemetry: boolean;
  };
}) {
  const available = stations.filter((s) => !s.occupied);
  const [targetStation, setTargetStation] = React.useState(available[0]?.id ?? '');
  const [targetFirmware, setTargetFirmware] = React.useState(
    firmwares.find((f) => !f.isCurrent && f.channel === 'stable')?.id ?? '',
  );
  const [retireOutcome, setRetireOutcome] = React.useState<'retired' | 'lost'>('retired');

  const isQuarantined = status === 'quarantined';
  const isRetired = status === 'retired' || status === 'lost';

  return (
    <div className="flex flex-wrap gap-2">
      {can.telemetry && !isRetired && (
        <QuickAction
          label="משיכת טלמטריה"
          icon={<Radio />}
          onRun={() => pingDeviceAction(deviceId)}
        />
      )}

      {can.assign && !isRetired && !isQuarantined && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Link2 />
              {isAssigned ? 'העברה או שחרור' : 'שיוך לעמדה'}
            </Button>
          }
          title={`שיוך מכונה ${deviceLabel}`}
          description="שיוך מכונה לעמדה יסגור את השיוך הקודם וירשום רשומה חדשה בהיסטוריה."
          confirmLabel="שייך"
          extraFields={
            <div>
              <Label htmlFor="target-station" required>
                עמדת יעד
              </Label>
              <Select value={targetStation} onValueChange={setTargetStation}>
                <SelectTrigger id="target-station" className="mt-1.5">
                  <SelectValue placeholder="בחר עמדה" />
                </SelectTrigger>
                <SelectContent>
                  {isAssigned && <SelectItem value="__unassign__">שחרור למלאי</SelectItem>}
                  {available.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} · {s.clubName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {available.length === 0 && (
                <p className="mt-1 text-[11px] text-[var(--signal-warning)]">
                  אין עמדות פנויות. יש לשחרר מכונה קיימת קודם.
                </p>
              )}
            </div>
          }
          onConfirm={(reason) =>
            assignDeviceAction(
              deviceId,
              targetStation === '__unassign__' ? null : targetStation,
              reason,
            )
          }
        />
      )}

      {can.firmware && !isRetired && firmwares.length > 0 && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Upload />
              עדכון Firmware
            </Button>
          }
          title={`עדכון Firmware — ${deviceLabel}`}
          description="⚠ שכבת ה־BLE נמצאת במצב Mock. הפעולה תירשם בהיסטוריית ה־Firmware אך לא תישלח פקודה אמיתית למכשיר."
          confirmLabel="עדכן"
          extraFields={
            <div>
              <Label htmlFor="target-firmware" required>
                גרסת יעד
              </Label>
              <Select value={targetFirmware} onValueChange={setTargetFirmware}>
                <SelectTrigger id="target-firmware" className="mt-1.5">
                  <SelectValue placeholder="בחר גרסה" />
                </SelectTrigger>
                <SelectContent>
                  {firmwares
                    .filter((f) => !f.isCurrent)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.version} · {f.channel}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          }
          onConfirm={(reason) => updateFirmwareAction(deviceId, targetFirmware, reason, false)}
        />
      )}

      {can.firmware && !isRetired && firmwares.length > 0 && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <RotateCcw />
              Rollback
            </Button>
          }
          title={`Rollback Firmware — ${deviceLabel}`}
          description="חזרה לגרסה קודמת. השתמש בזה כאשר גרסה חדשה גרמה לתקלה בשטח."
          confirmLabel="בצע Rollback"
          destructive
          minReasonLength={10}
          extraFields={
            <div>
              <Label htmlFor="rollback-firmware" required>
                גרסה לחזרה
              </Label>
              <Select value={targetFirmware} onValueChange={setTargetFirmware}>
                <SelectTrigger id="rollback-firmware" className="mt-1.5">
                  <SelectValue placeholder="בחר גרסה" />
                </SelectTrigger>
                <SelectContent>
                  {firmwares
                    .filter((f) => !f.isCurrent)
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.version} · {f.channel}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          }
          onConfirm={(reason) => updateFirmwareAction(deviceId, targetFirmware, reason, true)}
        />
      )}

      {can.quarantine && !isRetired && !isQuarantined && (
        <ConfirmAction
          trigger={
            <Button variant="dangerOutline" size="sm">
              <Ban />
              בידוד
            </Button>
          }
          title={`בידוד מכונה ${deviceLabel}`}
          description="המכונה תאבד את הרשאת ההפעלה ולא תוכל לקבל Session Token. השתמש בזה בחשד לתקלת בטיחות, לפגיעה או לשימוש לא מורשה."
          confirmLabel="בודד מכונה"
          destructive
          minReasonLength={10}
          onConfirm={(reason) => quarantineDeviceAction(deviceId, reason)}
        />
      )}

      {can.quarantine && isQuarantined && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <CircleCheck />
              החזרה מבידוד
            </Button>
          }
          title={`החזרת ${deviceLabel} לפעילות`}
          description="המכונה תקבל שוב הרשאת הפעלה. ודא שהבעיה שגרמה לבידוד טופלה."
          confirmLabel="החזר לפעילות"
          onConfirm={(reason) => releaseDeviceAction(deviceId, reason)}
        />
      )}

      {can.retire && !isRetired && (
        <ConfirmAction
          trigger={
            <Button variant="dangerOutline" size="sm">
              <Trash2 />
              גריעה
            </Button>
          }
          title={`גריעת מכונה ${deviceLabel}`}
          description="פעולה כמעט בלתי הפיכה. המכונה תוסר מכל עמדה, תאבד הרשאה ותצא מהצי הפעיל. ההיסטוריה נשמרת במלואה."
          confirmLabel="גרע מכונה"
          destructive
          minReasonLength={10}
          extraFields={
            <div>
              <Label htmlFor="retire-outcome" required>
                סוג הגריעה
              </Label>
              <Select
                value={retireOutcome}
                onValueChange={(v) => setRetireOutcome(v as 'retired' | 'lost')}
              >
                <SelectTrigger id="retire-outcome" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retired">גריעה — סוף חיי שירות</SelectItem>
                  <SelectItem value="lost">אבודה או נגנבה</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          onConfirm={(reason) => retireDeviceAction(deviceId, reason, retireOutcome)}
        />
      )}
    </div>
  );
}
