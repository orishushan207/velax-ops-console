/**
 * מכונת המצבים של Session.
 *
 * מוגדרת כמודול טהור כדי שניתן יהיה לבדוק אותה, ולמנוע מצב שבו מעברי
 * סטטוס "מתפזרים" בין קומפוננטות ושאילתות.
 */

export type SessionStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'paid'
  | 'authorized'
  | 'connecting'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed_to_start'
  | 'interrupted'
  | 'cancelled'
  | 'partially_refunded'
  | 'fully_refunded'
  | 'disputed';

/** המעברים החוקיים בלבד. כל מעבר שאינו כאן נחסם. */
export const ALLOWED_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['authorized', 'failed_to_start', 'cancelled', 'fully_refunded'],
  authorized: ['connecting', 'failed_to_start', 'fully_refunded'],
  connecting: ['active', 'failed_to_start'],
  active: ['paused', 'completed', 'interrupted'],
  paused: ['active', 'completed', 'interrupted'],
  completed: ['partially_refunded', 'fully_refunded', 'disputed'],
  failed_to_start: ['fully_refunded', 'partially_refunded', 'disputed'],
  interrupted: ['partially_refunded', 'fully_refunded', 'completed', 'disputed'],
  cancelled: [],
  partially_refunded: ['fully_refunded', 'disputed'],
  fully_refunded: ['disputed'],
  disputed: ['fully_refunded', 'partially_refunded'],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** סטטוסים שבהם הסשן נחשב "פעיל עכשיו" */
export const RUNNING_STATUSES: SessionStatus[] = ['connecting', 'authorized', 'active', 'paused'];

/** סטטוסים שנספרים כ"סשן בתשלום" — לפני בדיקת סכום הזיכוי */
export const PAID_STATUSES: SessionStatus[] = [
  'active',
  'paused',
  'completed',
  'partially_refunded',
];

/**
 * האם סשן נספר כ־Paid Session.
 *
 * ⚠ סעיף 33 בהנחיות: "אל תספור זיכוי מלא כ־Paid Session."
 * שלושת התנאים חייבים להתקיים יחד.
 */
export function isPaidSession(params: {
  status: SessionStatus;
  amountGross: number;
  refundedAmount: number;
}): boolean {
  return (
    PAID_STATUSES.includes(params.status) &&
    params.amountGross > 0 &&
    params.refundedAmount < params.amountGross
  );
}

/** האם הסשן תורם למונה Start Success */
export function countsTowardStartSuccess(params: {
  status: SessionStatus;
  startedWithoutStaffHelp: boolean | null;
}): boolean {
  if (params.status === 'failed_to_start') return false;
  return params.startedWithoutStaffHelp === true;
}

/** האם ניתן לזכות את הסשן, ומה הסכום המרבי */
export function refundableAmount(params: {
  amountGross: number;
  refundedAmount: number;
}): number {
  return Math.max(0, Number((params.amountGross - params.refundedAmount).toFixed(2)));
}

/**
 * הסטטוס שאליו הסשן עובר לאחר זיכוי.
 * זיכוי חלקי אינו מבטל את הסשן; זיכוי מלא כן.
 */
export function statusAfterRefund(
  amountGross: number,
  totalRefunded: number,
): 'partially_refunded' | 'fully_refunded' {
  return totalRefunded >= amountGross ? 'fully_refunded' : 'partially_refunded';
}
