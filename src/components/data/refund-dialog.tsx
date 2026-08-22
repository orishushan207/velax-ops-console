'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Info } from 'lucide-react';
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
import { formatCurrency } from '@/lib/format';
import * as labels from '@/lib/labels';
import { issueRefundAction, suggestRefundAmount } from '@/server/actions/sessions';

/**
 * טופס זיכוי.
 *
 * ⚠ סעיף 11 בהנחיות: כל זיכוי חייב סיבה מובנית, הערה חופשית, סכום,
 * Session מקושר, מבצע, ומאשר מעל רף מוגדר.
 * הטופס מציע סכום לפי כללי המערכת אך לעולם אינו מבצע זיכוי אוטומטית.
 */
export function RefundDialog({
  sessionId,
  reference,
  maxAmount,
  alreadyRefunded = 0,
  trigger,
}: {
  sessionId: string;
  reference: string;
  maxAmount: number;
  alreadyRefunded?: number;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [refundType, setRefundType] = React.useState<'full' | 'partial'>('full');
  const [destination, setDestination] = React.useState<'original_method' | 'wallet'>(
    'original_method',
  );
  const [reason, setReason] = React.useState('customer_request');
  const [note, setNote] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [suggestion, setSuggestion] = React.useState<{
    amount: number;
    reason: string;
    explanation: string;
  } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const remaining = maxAmount - alreadyRefunded;

  // בעת פתיחת החלון — טוענים את הצעת הזיכוי לפי כללי המערכת
  React.useEffect(() => {
    if (!open) return;
    void suggestRefundAmount(sessionId).then((s) => {
      if (!s) return;
      setSuggestion(s);
      setReason(s.reason);
      if (s.amount < remaining) {
        setRefundType('partial');
        setAmount(s.amount.toFixed(2));
      }
    });
  }, [open, sessionId, remaining]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await issueRefundAction(formData);
      if (result.ok) {
        toast.success(result.message ?? 'הזיכוי בוצע');
        setOpen(false);
        setNote('');
        setAmount('');
      } else {
        setFormError(result.message ?? 'הזיכוי נכשל');
        setErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? 'הזיכוי נכשל');
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent size="lg">
        <form onSubmit={submit}>
          <input type="hidden" name="sessionId" value={sessionId} />
          <input type="hidden" name="refundType" value={refundType} />
          <input type="hidden" name="destination" value={destination} />
          <input type="hidden" name="reason" value={reason} />

          <DialogHeader>
            <DialogTitle className="text-[var(--signal-danger)]">זיכוי לסשן {reference}</DialogTitle>
            <DialogDescription>
              פעולה כספית. היא תירשם ב־Audit Log עם הסכום, הסיבה, שמך ושעת הביצוע.
            </DialogDescription>
          </DialogHeader>

          {suggestion && (
            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--signal-info-bg)] p-3 text-[12px] ring-1 ring-inset ring-[var(--signal-info-ring)]">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--signal-info)]" />
              <div>
                <p className="font-medium text-[var(--fg-primary)]">
                  המערכת ממליצה על זיכוי של {formatCurrency(suggestion.amount, true)}
                </p>
                <p className="mt-0.5 text-[var(--fg-secondary)]">{suggestion.explanation}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label required>סוג זיכוי</Label>
                <Select
                  value={refundType}
                  onValueChange={(v) => setRefundType(v as 'full' | 'partial')}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">
                      זיכוי מלא ({formatCurrency(remaining, true)})
                    </SelectItem>
                    <SelectItem value="partial">זיכוי חלקי</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label required>יעד הזיכוי</Label>
                <Select
                  value={destination}
                  onValueChange={(v) => setDestination(v as 'original_method' | 'wallet')}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {labels.refundDestination.options().map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {refundType === 'partial' && (
              <div>
                <Label htmlFor="refund-amount" required>
                  סכום לזיכוי (כולל מע״מ)
                </Label>
                <Input
                  id="refund-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remaining}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1.5"
                  dir="ltr"
                  aria-invalid={Boolean(errors.amount)}
                />
                <FieldHint>
                  ניתן לזכות עד {formatCurrency(remaining, true)}
                  {alreadyRefunded > 0 && ` (כבר זוכה ${formatCurrency(alreadyRefunded, true)})`}
                </FieldHint>
                <FieldError>{errors.amount}</FieldError>
              </div>
            )}

            <div>
              <Label required>סיבה מובנית</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {labels.refundReason.options().map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.reason}</FieldError>
            </div>

            <div>
              <Label htmlFor="refund-note" required>
                פירוט
              </Label>
              <Textarea
                id="refund-note"
                name="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5"
                placeholder="מה קרה בפועל ומדוע ניתן זיכוי"
                aria-invalid={Boolean(errors.note)}
              />
              <FieldError>{errors.note}</FieldError>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--signal-danger-bg)] p-3 text-[13px] text-[var(--signal-danger)] ring-1 ring-inset ring-[var(--signal-danger-ring)]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" variant="danger" loading={pending}>
              בצע זיכוי
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
