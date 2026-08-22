import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-9 w-full rounded-[var(--radius-control)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg-primary)]',
        'ring-1 ring-inset ring-[var(--border-default)] placeholder:text-[var(--fg-tertiary)]',
        'transition-shadow focus:ring-2 focus:ring-[var(--accent)] focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'min-h-20 w-full rounded-[var(--radius-control)] bg-[var(--bg-input)] p-3 text-sm text-[var(--fg-primary)]',
      'ring-1 ring-inset ring-[var(--border-default)] placeholder:text-[var(--fg-tertiary)]',
      'transition-shadow focus:ring-2 focus:ring-[var(--accent)] focus:outline-none',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export function Label({
  className,
  required,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn('block text-[13px] font-medium text-[var(--fg-secondary)]', className)} {...props}>
      {children}
      {/* הכוכבית ויזואלית בלבד — חובה נמסרת למקריא מסך דרך aria-required על השדה,
          כדי שהשם הנגיש יישאר "שם מלא" ולא "שם מלא כוכבית". */}
      {required && (
        <span aria-hidden="true" className="text-[var(--signal-danger)]">
          {' *'}
        </span>
      )}
    </label>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-[12px] text-[var(--signal-danger)]">
      {children}
    </p>
  );
}

export function FieldHint({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-[12px] text-[var(--fg-tertiary)]">{children}</p>;
}
