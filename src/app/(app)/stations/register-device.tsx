'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { registerDeviceAction } from '@/server/actions/devices';

export function RegisterDeviceButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isSpare, setIsSpare] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    if (isSpare) formData.set('isSpare', 'on');
    startTransition(async () => {
      const result = await registerDeviceAction(formData);
      if (result.ok) {
        toast.success(result.message ?? 'המכשיר נרשם');
        setOpen(false);
        router.refresh();
      } else {
        setFormError(result.message ?? 'הרישום נכשל');
        setErrors(result.fieldErrors ?? {});
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        רישום מכשיר
      </Button>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>רישום מכשיר חדש</DialogTitle>
            <DialogDescription>
              המכשיר ייכנס למלאי עם מפתח הרשאה שנוצר ומוצפן אוטומטית. המפתח אינו ניתן לצפייה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="deviceId" required>
                Device ID
              </Label>
              <Input
                id="deviceId"
                name="deviceId"
                dir="ltr"
                className="mt-1.5 text-start"
                placeholder="VX-DEV-1012"
                required
                aria-invalid={Boolean(errors.deviceId)}
              />
              <FieldHint>מזהה ייחודי שאינו ניתן לשינוי לאחר הרישום.</FieldHint>
              <FieldError>{errors.deviceId}</FieldError>
            </div>

            <div>
              <Label htmlFor="serialNumber" required>
                מספר סידורי
              </Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                dir="ltr"
                className="mt-1.5 text-start"
                placeholder="PT9001-240501"
                required
                aria-invalid={Boolean(errors.serialNumber)}
              />
              <FieldError>{errors.serialNumber}</FieldError>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="model">דגם</Label>
                <Input
                  id="model"
                  name="model"
                  className="mt-1.5"
                  defaultValue="PT-9001 · VELA-X ELITE"
                />
              </div>
              <div>
                <Label htmlFor="hardwareVersion">גרסת חומרה</Label>
                <Input id="hardwareVersion" name="hardwareVersion" dir="ltr" className="mt-1.5 text-start" placeholder="HW-2.1" />
              </div>
            </div>

            <div>
              <Label htmlFor="purchaseCost">עלות רכישה (₪, לפני מע״מ)</Label>
              <Input
                id="purchaseCost"
                name="purchaseCost"
                type="number"
                step="0.01"
                dir="ltr"
                className="mt-1.5 text-start"
                placeholder="3000"
              />
              <FieldHint>לפי המודל: 3,000 ₪ עד המחסן בישראל.</FieldHint>
            </div>

            <div className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
              <div>
                <Label htmlFor="isSpare">מכונה חלופית</Label>
                <FieldHint>מוחזקת במלאי להחלפה מהירה לפי SLA.</FieldHint>
              </div>
              <Switch id="isSpare" checked={isSpare} onCheckedChange={setIsSpare} />
            </div>

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              רשום מכשיר
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
