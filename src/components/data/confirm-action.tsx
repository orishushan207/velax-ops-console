'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldError, FieldHint, Label, Textarea } from '@/components/ui/input';
import type { ActionResult } from '@/server/actions/_helpers';
import { cn } from '@/lib/utils';

/**
 * חלון אישור לפעולה רגישה.
 *
 * ⚠ סעיף 7 בהנחיות: "כל פעולה רגישה דורשת הרשאה מתאימה, חלון אישור,
 * סיבה, ורישום ב־Audit Log."
 * הקומפוננטה הזו אוכפת את שני האמצעיים — היא לא מאפשרת שליחה בלי סיבה.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = 'אישור',
  destructive,
  requireReason = true,
  reasonLabel = 'סיבה',
  reasonHint,
  minReasonLength = 5,
  extraFields,
  onConfirm,
  redirectTo,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonHint?: string;
  minReasonLength?: number;
  /** שדות נוספים; מקבלים גישה ל־FormData בשליחה */
  extraFields?: React.ReactNode;
  onConfirm: (reason: string, formData: FormData) => Promise<ActionResult<unknown>>;
  /** ניווט לאחר הצלחה. נדרש כשהרשומה הנוכחית כבר לא תהיה נגישה — למשל ארכוב. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const formRef = React.useRef<HTMLFormElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requireReason && reason.trim().length < minReasonLength) {
      setError(`נא לפרט סיבה של ${minReasonLength} תווים לפחות`);
      return;
    }

    const formData = new FormData(formRef.current ?? undefined);
    startTransition(async () => {
      const result = await onConfirm(reason.trim(), formData);
      if (result.ok) {
        toast.success(result.message ?? 'הפעולה בוצעה');
        setOpen(false);
        setReason('');
        // ארכוב מסיר את הרשומה מהתצוגה — יש לצאת מהעמוד שלה, לא רק לרענן
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        setError(result.message ?? 'הפעולה נכשלה');
        toast.error(result.message ?? 'הפעולה נכשלה');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent>
        <form ref={formRef} onSubmit={submit}>
          <DialogHeader>
            <DialogTitle
              className={cn('flex items-center gap-2', destructive && 'text-[var(--signal-danger)]')}
            >
              {destructive && <AlertTriangle className="size-4 shrink-0" />}
              {title}
            </DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-4">
            {extraFields}

            {requireReason && (
              <div>
                <Label htmlFor="confirm-reason" required>
                  {reasonLabel}
                </Label>
                <Textarea
                  id="confirm-reason"
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1.5"
                  placeholder="הסיבה תישמר ב־Audit Log ותהיה גלויה לביקורת"
                  autoFocus
                />
                <FieldHint>
                  {reasonHint ?? 'הסיבה נרשמת ב־Audit Log יחד עם שמך, השעה וכתובת ה־IP.'}
                </FieldHint>
              </div>
            )}

            {error && <FieldError>{error}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" variant={destructive ? 'danger' : 'primary'} loading={pending}>
              {confirmLabel}
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

/** כפתור פעולה פשוט ללא חלון אישור, עם Toast */
export function QuickAction({
  label,
  icon,
  variant = 'outline',
  size = 'sm',
  onRun,
}: {
  label: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  onRun: () => Promise<ActionResult<unknown>>;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await onRun();
          if (result.ok) toast.success(result.message ?? 'בוצע');
          else toast.error(result.message ?? 'הפעולה נכשלה');
        })
      }
    >
      {icon}
      {label}
    </Button>
  );
}
