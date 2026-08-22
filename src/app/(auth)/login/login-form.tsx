'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { loginAction, type LoginState } from '@/server/actions/auth';

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-control)] bg-[var(--signal-danger-bg)] p-3 text-[13px] text-[var(--signal-danger)] ring-1 ring-inset ring-[var(--signal-danger-ring)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="email" required>
          אימייל
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          dir="ltr"
          className="mt-1.5 text-start"
          placeholder="name@velax.co.il"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        <FieldError>{state.fieldErrors?.email}</FieldError>
      </div>

      <div>
        <Label htmlFor="password" required>
          סיסמה
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          className="mt-1.5 text-start"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <FieldError>{state.fieldErrors?.password}</FieldError>
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={pending}>
        כניסה
      </Button>
    </form>
  );
}
