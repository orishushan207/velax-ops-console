'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { History, Pencil } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { updateSettingAction } from '@/server/actions/settings';

export interface SettingHistoryEntry {
  value: string;
  previousValue: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  changedByName: string | null;
  changeReason: string | null;
  scenario: string | null;
}

/**
 * עורך הגדרה עסקית.
 *
 * ⚠ הטופס מחייב תאריך תחולה ונימוק. אין דרך לשנות הנחה עסקית
 * בלי להשאיר עקבות — זו דרישה מפורשת בסעיף 1.5 בהנחיות.
 */
export function SettingEditor({
  settingKey,
  nameHe,
  currentValue,
  valueType,
  unit,
  isScenarioScoped,
  minValue,
  maxValue,
  canEdit,
}: {
  settingKey: string;
  nameHe: string;
  currentValue: string | null;
  valueType: string;
  unit: string | null;
  isScenarioScoped: boolean;
  minValue: string | null;
  maxValue: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(currentValue ?? '');
  const [scenario, setScenario] = React.useState('global');
  const [effectiveMode, setEffectiveMode] = React.useState<'now' | 'future'>('now');
  const [effectiveDate, setEffectiveDate] = React.useState(
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (!canEdit) return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    formData.set('settingKey', settingKey);
    formData.set('value', value);
    formData.set(
      'effectiveFrom',
      effectiveMode === 'now' ? new Date().toISOString() : new Date(effectiveDate).toISOString(),
    );
    if (isScenarioScoped && scenario !== 'global') formData.set('scenario', scenario);
    else formData.delete('scenario');

    startTransition(async () => {
      const result = await updateSettingAction(formData);
      if (result.ok) {
        toast.success(result.message ?? 'ההגדרה עודכנה');
        setOpen(false);
        router.refresh();
      } else {
        setFormError(result.message ?? 'העדכון נכשל');
        setErrors(result.fieldErrors ?? {});
      }
    });
  };

  const isBoolean = valueType === 'boolean';
  const isPercentage = valueType === 'percentage';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="iconSm" onClick={() => setOpen(true)} aria-label={`עריכת ${nameHe}`}>
        <Pencil />
      </Button>
      <DialogContent size="lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{nameHe}</DialogTitle>
            <DialogDescription>
              <span className="mono text-[11px]">{settingKey}</span>
              <br />
              שינוי הנחה עסקית נשמר כגרסה חדשה עם תאריך תחולה. חישובים היסטוריים לפני תאריך
              התחולה לא ישתנו.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="setting-value" required>
                ערך חדש {unit ? `(${unit})` : ''}
              </Label>
              {isBoolean ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger id="setting-value" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">פעיל</SelectItem>
                    <SelectItem value="false">כבוי</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="setting-value"
                  type={valueType === 'string' || valueType === 'json' ? 'text' : 'number'}
                  step={isPercentage ? '0.001' : '0.01'}
                  min={minValue ?? undefined}
                  max={maxValue ?? undefined}
                  dir="ltr"
                  className="mt-1.5 text-start"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={Boolean(errors.value)}
                />
              )}
              <FieldHint>
                ערך נוכחי: <span className="mono">{currentValue ?? 'לא הוגדר'}</span>
                {isPercentage && ' · אחוזים נשמרים כשבר עשרוני (0.18 = 18%)'}
                {minValue && ` · מינימום ${minValue}`}
                {maxValue && ` · מקסימום ${maxValue}`}
              </FieldHint>
              <FieldError>{errors.value}</FieldError>
            </div>

            {isScenarioScoped && (
              <div>
                <Label>תחולת השינוי</Label>
                <Select value={scenario} onValueChange={setScenario}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">כל התרחישים (ערך גלובלי)</SelectItem>
                    <SelectItem value="plan">תרחיש תוכנית בלבד</SelectItem>
                    <SelectItem value="realistic">תרחיש ריאלי בלבד</SelectItem>
                    <SelectItem value="conservative">תרחיש שמרני בלבד</SelectItem>
                  </SelectContent>
                </Select>
                <FieldHint>
                  להגדרה זו יש ערכים שונים לכל תרחיש. בחר על מה השינוי חל.
                </FieldHint>
              </div>
            )}

            <div>
              <Label required>מתי השינוי נכנס לתוקף</Label>
              <div className="mt-1.5 flex gap-2">
                <Button
                  type="button"
                  variant={effectiveMode === 'now' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setEffectiveMode('now')}
                >
                  מיידית
                </Button>
                <Button
                  type="button"
                  variant={effectiveMode === 'future' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setEffectiveMode('future')}
                >
                  בתאריך עתידי
                </Button>
              </div>
              {effectiveMode === 'future' && (
                <Input
                  type="date"
                  dir="ltr"
                  className="mt-2 text-start"
                  value={effectiveDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              )}
              <FieldError>{errors.effectiveFrom}</FieldError>
            </div>

            <div>
              <Label htmlFor="change-reason" required>
                נימוק לשינוי
              </Label>
              <Textarea
                id="change-reason"
                name="changeReason"
                className="mt-1.5"
                placeholder="מדוע ההנחה משתנה, ועל סמך מה"
                aria-invalid={Boolean(errors.changeReason)}
              />
              <FieldHint>
                הנימוק נשמר בהיסטוריית ההגדרה וב־Audit Log, יחד עם שמך ושעת השינוי.
              </FieldHint>
              <FieldError>{errors.changeReason}</FieldError>
            </div>

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              שמור שינוי
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

/** צפייה בהיסטוריית שינויים של הגדרה */
export function SettingHistoryButton({
  nameHe,
  history,
}: {
  nameHe: string;
  history: SettingHistoryEntry[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="iconSm"
        onClick={() => setOpen(true)}
        aria-label={`היסטוריית ${nameHe}`}
      >
        <History />
      </Button>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>היסטוריית שינויים — {nameHe}</DialogTitle>
          <DialogDescription>
            כל גרסה עם תאריך התחולה שלה. חישובים שנעשו בתקופה של גרסה מסוימת משתמשים בערך שלה.
          </DialogDescription>
        </DialogHeader>

        {history.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--fg-tertiary)]">
            אין היסטוריית שינויים
          </p>
        ) : (
          <ol className="space-y-2">
            {history.map((h, i) => (
              <li
                key={i}
                className="rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3 text-[12px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="mono font-medium">
                    {h.previousValue && (
                      <span className="text-[var(--fg-tertiary)] line-through">
                        {h.previousValue}
                      </span>
                    )}{' '}
                    {h.value}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {h.scenario && (
                      <Badge size="sm" tone="info">
                        {h.scenario}
                      </Badge>
                    )}
                    {new Date(h.effectiveFrom) > new Date() && (
                      <Badge size="sm" tone="warning">
                        עתידי
                      </Badge>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-[var(--fg-secondary)]">{h.changeReason ?? '—'}</p>
                <p className="mt-1 text-[11px] text-[var(--fg-tertiary)]">
                  בתוקף מ־{formatDateTime(h.effectiveFrom)}
                  {h.effectiveUntil && ` עד ${formatDateTime(h.effectiveUntil)}`}
                  {h.changedByName && ` · ${h.changedByName}`}
                </p>
              </li>
            ))}
          </ol>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
