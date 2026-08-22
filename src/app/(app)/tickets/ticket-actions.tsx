'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, MessageSquarePlus, Plus, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/misc';
import { ConfirmAction } from '@/components/data/confirm-action';
import * as labels from '@/lib/labels';
import {
  addTicketCommentAction,
  assignTicketAction,
  closeTicketAction,
  createTicketAction,
  updateTicketStatusAction,
} from '@/server/actions/tickets';

export interface OptionItem {
  id: string;
  label: string;
  sub?: string;
}

/** פתיחת קריאה חדשה */
export function NewTicketButton({
  clubs,
  stations,
  devices,
}: {
  clubs: OptionItem[];
  stations: OptionItem[];
  devices: OptionItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [clubId, setClubId] = React.useState('none');
  const [stationId, setStationId] = React.useState('none');
  const [deviceId, setDeviceId] = React.useState('none');
  const [category, setCategory] = React.useState('ble');
  const [severity, setSeverity] = React.useState('medium');
  const [pending, startTransition] = React.useTransition();

  const filteredStations = clubId === 'none' ? stations : stations.filter((s) => s.sub === clubId);
  const filteredDevices = clubId === 'none' ? devices : devices.filter((d) => d.sub === clubId);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    formData.set('clubId', clubId);
    formData.set('stationId', stationId);
    formData.set('deviceId', deviceId);
    formData.set('category', category);
    formData.set('severity', severity);
    startTransition(async () => {
      const result = await createTicketAction(formData);
      if (result.ok) {
        toast.success(result.message ?? 'הקריאה נפתחה');
        setOpen(false);
        router.refresh();
        if (result.data?.id) router.push(`/tickets/${result.data.id}`);
      } else {
        setFormError(result.message ?? 'הפתיחה נכשלה');
        setErrors(result.fieldErrors ?? {});
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <Plus />
        קריאה חדשה
      </Button>
      <DialogContent size="lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>פתיחת קריאת שירות</DialogTitle>
            <DialogDescription>
              מועדי ה־SLA יחושבו אוטומטית לפי מדיניות ה־SLA של המועדון ורמת החומרה שתבחר.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title" required>
                כותרת
              </Label>
              <Input
                id="title"
                name="title"
                className="mt-1.5"
                placeholder="המכשיר לא מתחבר לאפליקציה"
                required
                aria-invalid={Boolean(errors.title)}
              />
              <FieldError>{errors.title}</FieldError>
            </div>

            <div>
              <Label htmlFor="description" required>
                תיאור התקלה
              </Label>
              <Textarea
                id="description"
                name="description"
                className="mt-1.5"
                placeholder="מה בדיוק קרה, מתי, ומה כבר נוסה"
                required
                aria-invalid={Boolean(errors.description)}
              />
              <FieldError>{errors.description}</FieldError>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>קטגוריה</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {labels.ticketCategory.options().map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label required>חומרה</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {labels.ticketSeverity.options().map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>מועדון</Label>
                <Select
                  value={clubId}
                  onValueChange={(v) => {
                    setClubId(v);
                    setStationId('none');
                    setDeviceId('none');
                  }}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>עמדה</Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {filteredStations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>מכונה</Label>
                <Select value={deviceId} onValueChange={setDeviceId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">ללא</SelectItem>
                    {filteredDevices.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              פתח קריאה
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

/** פעולות על קריאה קיימת */
export function TicketDetailActions({
  ticketId,
  reference,
  status,
  assigneeId,
  technicians,
  can,
}: {
  ticketId: string;
  reference: string;
  status: string;
  assigneeId: string | null;
  technicians: { id: string; name: string; isTechnician: boolean }[];
  can: { edit: boolean; assign: boolean; close: boolean };
}) {
  const [selectedAssignee, setSelectedAssignee] = React.useState(assigneeId ?? 'none');
  const [nextStatus, setNextStatus] = React.useState('in_progress');
  const [comment, setComment] = React.useState('');
  const [isInternal, setIsInternal] = React.useState(true);
  const isClosed = status === 'closed';

  return (
    <div className="flex flex-wrap gap-2">
      {can.assign && !isClosed && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <UserCog />
              הקצאה
            </Button>
          }
          title={`הקצאת קריאה ${reference}`}
          description="הקצאת אחראי מעבירה את הקריאה לסטטוס ״הוקצתה״ אם היא עדיין חדשה."
          confirmLabel="הקצה"
          requireReason={false}
          extraFields={
            <div>
              <Label required>אחראי</Label>
              <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא אחראי</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.isTechnician ? ' · טכנאי שדה' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
          onConfirm={() =>
            assignTicketAction(ticketId, selectedAssignee === 'none' ? null : selectedAssignee)
          }
        />
      )}

      {can.edit && !isClosed && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              שינוי סטטוס
            </Button>
          }
          title={`עדכון סטטוס — ${reference}`}
          description="שינוי הסטטוס נרשם ב־Timeline של הקריאה וב־Audit Log."
          confirmLabel="עדכן"
          reasonLabel="הערה"
          minReasonLength={3}
          extraFields={
            <div>
              <Label required>סטטוס חדש</Label>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {labels.ticketStatus
                    .options()
                    .filter((o) => o.value !== 'closed')
                    .map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          }
          onConfirm={(reason) => updateTicketStatusAction(ticketId, nextStatus, reason)}
        />
      )}

      {can.edit && (
        <ConfirmAction
          trigger={
            <Button variant="ghost" size="sm">
              <MessageSquarePlus />
              הערה
            </Button>
          }
          title="הוספת הערה"
          confirmLabel="הוסף"
          requireReason={false}
          extraFields={
            <>
              <div>
                <Label htmlFor="ticket-comment" required>
                  תוכן ההערה
                </Label>
                <Textarea
                  id="ticket-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="mt-1.5"
                  placeholder="מה בוצע, מה נמצא, מה השלב הבא"
                />
              </div>
              <div className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
                <div>
                  <Label htmlFor="internal">הערה פנימית</Label>
                  <FieldHint>הערה פנימית אינה מיועדת לשיתוף עם המועדון או הלקוח.</FieldHint>
                </div>
                <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
              </div>
            </>
          }
          onConfirm={() => addTicketCommentAction(ticketId, comment, isInternal)}
        />
      )}

      {can.close && !isClosed && <CloseTicketDialog ticketId={ticketId} reference={reference} />}
    </div>
  );
}

function CloseTicketDialog({ ticketId, reference }: { ticketId: string; reference: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [followUp, setFollowUp] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    formData.set('ticketId', ticketId);
    if (followUp) formData.set('followUpRequired', 'on');
    startTransition(async () => {
      const result = await closeTicketAction(formData);
      if (result.ok) {
        toast.success(result.message ?? 'הקריאה נסגרה');
        setOpen(false);
        router.refresh();
      } else {
        setFormError(result.message ?? 'הסגירה נכשלה');
        setErrors(result.fieldErrors ?? {});
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <CheckCircle2 />
        סגירת קריאה
      </Button>
      <DialogContent size="lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>סגירת קריאה {reference}</DialogTitle>
            <DialogDescription>
              סגירה מחייבת תיעוד מלא: Root Cause, פעולות שבוצעו וסיבת סגירה. זמן ההשבתה
              יחושב אוטומטית ויזין את מדד הזמינות.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="rootCause" required>
                Root Cause
              </Label>
              <Textarea
                id="rootCause"
                name="rootCause"
                className="mt-1.5"
                placeholder="מה גרם לתקלה בפועל"
                required
                aria-invalid={Boolean(errors.rootCause)}
              />
              <FieldError>{errors.rootCause}</FieldError>
            </div>

            <div>
              <Label htmlFor="actionsTaken" required>
                פעולות שבוצעו
              </Label>
              <Textarea
                id="actionsTaken"
                name="actionsTaken"
                className="mt-1.5"
                placeholder="מה נעשה כדי לפתור"
                required
                aria-invalid={Boolean(errors.actionsTaken)}
              />
              <FieldError>{errors.actionsTaken}</FieldError>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="closureReason" required>
                  סיבת סגירה
                </Label>
                <Input
                  id="closureReason"
                  name="closureReason"
                  className="mt-1.5"
                  placeholder="התקלה נפתרה ואומתה"
                  required
                  aria-invalid={Boolean(errors.closureReason)}
                />
                <FieldError>{errors.closureReason}</FieldError>
              </div>
              <div>
                <Label htmlFor="repairCost">עלות תיקון (₪)</Label>
                <Input
                  id="repairCost"
                  name="repairCost"
                  type="number"
                  step="0.01"
                  dir="ltr"
                  className="mt-1.5 text-start"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
              <div>
                <Label htmlFor="followUp">נדרש מעקב</Label>
                <FieldHint>סמן אם יש לחזור ולוודא שהתיקון החזיק.</FieldHint>
              </div>
              <Switch id="followUp" checked={followUp} onCheckedChange={setFollowUp} />
            </div>

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              סגור קריאה
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
