'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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
import { Switch } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import type { ActionResult } from '@/server/actions/_helpers';
import type { FieldDef, FieldSection } from './field-types';

/**
 * טופס גנרי ליצירה ולעריכה של רשומה.
 *
 * מקבל תיאור שדות (מבנה נתונים) ו־Server Action. שניהם Serializable:
 * Server Action עובר כהפניה, ותיאור השדות הוא JSON טהור.
 * זה מה שמאפשר להגדיר את הטפסים בצד השרת בלי לשכפל קוד לקוח לכל ישות.
 */

const controlClass =
  'h-9 w-full rounded-[var(--radius-control)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg-primary)] ' +
  'ring-1 ring-inset ring-[var(--border-default)] transition-shadow ' +
  'focus:ring-2 focus:ring-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

function FieldControl({
  field,
  error,
  switchState,
  onSwitchChange,
}: {
  field: FieldDef;
  error?: string;
  switchState: boolean;
  onSwitchChange: (v: boolean) => void;
}) {
  const invalid = Boolean(error);
  const ltr = field.dir === 'ltr';

  if (field.kind === 'switch') {
    return (
      <div className="flex items-center justify-between rounded-[var(--radius-control)] bg-[var(--bg-hover)] p-3">
        <div>
          <Label htmlFor={field.name}>{field.label}</Label>
          <FieldHint>{field.hint}</FieldHint>
        </div>
        <Switch
          id={field.name}
          name={field.name}
          checked={switchState}
          onCheckedChange={onSwitchChange}
          disabled={field.disabled}
        />
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={field.name} required={field.required}>
        {field.label}
      </Label>

      {field.kind === 'textarea' ? (
        <Textarea
          id={field.name}
          name={field.name}
          className="mt-1.5"
          placeholder={field.placeholder}
          defaultValue={field.defaultValue}
          required={field.required}
          maxLength={field.maxLength}
          disabled={field.disabled}
          aria-invalid={invalid}
        />
      ) : field.kind === 'select' ? (
        /* select נייטיב ולא Radix: הערך נכנס ל־FormData ישירות, בלי שדה נסתר */
        <select
          id={field.name}
          name={field.name}
          className={cn(controlClass, 'mt-1.5 appearance-none bg-[length:0] pe-3')}
          defaultValue={field.defaultValue ?? ''}
          required={field.required}
          disabled={field.disabled}
          aria-invalid={invalid}
        >
          {!field.required && <option value="">— ללא —</option>}
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={field.name}
          name={field.name}
          type={field.kind === 'text' ? 'text' : field.kind}
          dir={ltr ? 'ltr' : undefined}
          className={cn('mt-1.5', ltr && 'text-start')}
          placeholder={field.placeholder}
          defaultValue={field.defaultValue}
          required={field.required}
          step={field.step}
          min={field.min}
          max={field.max}
          maxLength={field.maxLength}
          disabled={field.disabled}
          aria-invalid={invalid}
        />
      )}

      <FieldHint>{field.hint}</FieldHint>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export interface RecordFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  sections: FieldSection[];
  action: (formData: FormData) => Promise<ActionResult<{ id: string }>>;
  /** ניווט לנתיב לאחר הצלחה. `:id` מוחלף במזהה שחזר מהפעולה. */
  redirectTo?: string;
}

export function RecordFormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  sections,
  action,
  redirectTo,
}: RecordFormDialogProps) {
  const router = useRouter();
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const allFields = React.useMemo(() => sections.flatMap((s) => s.fields), [sections]);

  const [switches, setSwitches] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      allFields.filter((f) => f.kind === 'switch').map((f) => [f.name, Boolean(f.defaultChecked)]),
    ),
  );

  // איפוס בכל פתיחה, כדי שטופס עריכה לא ישמור מצב מטופס קודם
  React.useEffect(() => {
    if (open) {
      setErrors({});
      setFormError(null);
      setSwitches(
        Object.fromEntries(
          allFields
            .filter((f) => f.kind === 'switch')
            .map((f) => [f.name, Boolean(f.defaultChecked)]),
        ),
      );
    }
  }, [open, allFields]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    // Radix Switch אינו מזין FormData בעצמו
    for (const [name, value] of Object.entries(switches)) {
      formData.set(name, value ? 'on' : '');
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message ?? 'נשמר');
        onOpenChange(false);
        if (redirectTo && result.data?.id) {
          router.push(redirectTo.replace(':id', result.data.id));
        } else {
          router.refresh();
        }
      } else {
        setFormError(result.message ?? 'השמירה נכשלה');
        setErrors(result.fieldErrors ?? {});
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          <div className="space-y-5">
            {sections.map((s, si) => (
              <div key={s.title ?? si} className="space-y-4">
                {s.title && (
                  <div className="border-b border-[var(--border-subtle)] pb-1.5">
                    <p className="text-[12px] font-semibold tracking-wide text-[var(--fg-secondary)]">
                      {s.title}
                    </p>
                    {s.description && (
                      <p className="mt-0.5 text-[12px] text-[var(--fg-tertiary)]">{s.description}</p>
                    )}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {s.fields.map((f) => (
                    <div key={f.name} className={f.half ? 'sm:col-span-1' : 'sm:col-span-2'}>
                      <FieldControl
                        field={f}
                        error={errors[f.name]}
                        switchState={switches[f.name] ?? false}
                        onSwitchChange={(v) => setSwitches((prev) => ({ ...prev, [f.name]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {formError && <FieldError>{formError}</FieldError>}
          </div>

          <DialogFooter>
            <Button type="submit" variant="primary" loading={pending}>
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              ביטול
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
