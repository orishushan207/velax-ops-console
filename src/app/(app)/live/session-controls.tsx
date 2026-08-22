'use client';

import * as React from 'react';
import {
  Ban,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Receipt,
  Square,
  Wrench,
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
import { RefundDialog } from '@/components/data/refund-dialog';
import {
  extendSessionAction,
  markSessionFaultyAction,
  messagePlayerAction,
  pauseSessionAction,
  resumeSessionAction,
  stopSessionAction,
} from '@/server/actions/sessions';
import * as labels from '@/lib/labels';

/**
 * פעולות שליטה בסשן פעיל.
 * כל כפתור מוצג רק אם למשתמש יש את ההרשאה המתאימה —
 * אין כפתורים שנראים פעילים ומובילים לשגיאת הרשאה.
 */
export function SessionControls({
  sessionId,
  reference,
  status,
  amountGross,
  can,
}: {
  sessionId: string;
  reference: string;
  status: string;
  amountGross: number;
  can: {
    control: boolean;
    forceEnd: boolean;
    refund: boolean;
    message: boolean;
    markFaulty: boolean;
    createTicket: boolean;
  };
}) {
  const [extendMinutes, setExtendMinutes] = React.useState('15');
  const [faultCategory, setFaultCategory] = React.useState('ble');
  const [messageText, setMessageText] = React.useState('');

  const isActive = status === 'active';
  const isPaused = status === 'paused';
  const isRunning = isActive || isPaused;

  const anyAction = can.control || can.forceEnd || can.refund || can.message || can.markFaulty;
  if (!anyAction) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] pt-3">
      {can.control && isActive && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Pause />
              השהיה
            </Button>
          }
          title={`השהיית סשן ${reference}`}
          description="המכונה תפסיק לירות. הטיימר ייעצר והשחקן יוכל לחדש."
          confirmLabel="השהה"
          onConfirm={(reason) => pauseSessionAction(sessionId, reason)}
        />
      )}

      {can.control && isPaused && (
        <QuickAction
          label="חידוש"
          icon={<Play />}
          onRun={() => resumeSessionAction(sessionId)}
        />
      )}

      {can.control && isRunning && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Plus />
              הארכה
            </Button>
          }
          title={`הארכת סשן ${reference}`}
          description="הארכה מוסיפה זמן ללא חיוב נוסף. הסיבה תירשם ב־Audit Log."
          confirmLabel="הארך"
          extraFields={
            <div>
              <Label htmlFor="extend-minutes" required>
                דקות להארכה
              </Label>
              <Select value={extendMinutes} onValueChange={setExtendMinutes}>
                <SelectTrigger id="extend-minutes" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 דקות</SelectItem>
                  <SelectItem value="10">10 דקות</SelectItem>
                  <SelectItem value="15">15 דקות</SelectItem>
                  <SelectItem value="30">30 דקות</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          onConfirm={(reason) =>
            extendSessionAction(sessionId, Number.parseInt(extendMinutes, 10), reason)
          }
        />
      )}

      {can.control && isRunning && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Square />
              סיום
            </Button>
          }
          title={`סיום סשן ${reference}`}
          description="הסשן יסומן כהושלם והמכונה תיעצר."
          confirmLabel="סיים"
          onConfirm={(reason) => stopSessionAction(sessionId, reason, false)}
        />
      )}

      {can.forceEnd && isRunning && (
        <ConfirmAction
          trigger={
            <Button variant="dangerOutline" size="sm">
              <Ban />
              סיום כפוי
            </Button>
          }
          title={`סיום כפוי של סשן ${reference}`}
          description="הסשן יסומן כ״הופסק״ ולא כ״הושלם״. פעולה זו משפיעה על מדד Start Success ועל דוחות האיכות. השתמש בה רק כשיש סיבה תפעולית אמיתית."
          confirmLabel="סיים בכפייה"
          destructive
          minReasonLength={10}
          onConfirm={(reason) => stopSessionAction(sessionId, reason, true)}
        />
      )}

      {can.markFaulty && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <Wrench />
              סימון כתקול
            </Button>
          }
          title={`סימון סשן ${reference} כתקול`}
          description="ייפתח Ticket חדש המקושר לסשן, לעמדה ולמכונה, עם SLA לפי חומרה גבוהה."
          confirmLabel="פתח קריאת שירות"
          extraFields={
            <div>
              <Label htmlFor="fault-category" required>
                קטגוריית התקלה
              </Label>
              <Select value={faultCategory} onValueChange={setFaultCategory}>
                <SelectTrigger id="fault-category" className="mt-1.5">
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
          }
          onConfirm={(reason) => markSessionFaultyAction(sessionId, faultCategory, reason)}
        />
      )}

      {can.refund && amountGross > 0 && (
        <RefundDialog
          sessionId={sessionId}
          reference={reference}
          maxAmount={amountGross}
          trigger={
            <Button variant="dangerOutline" size="sm">
              <Receipt />
              זיכוי
            </Button>
          }
        />
      )}

      {can.message && (
        <ConfirmAction
          trigger={
            <Button variant="ghost" size="sm">
              <MessageSquare />
              הודעה לשחקן
            </Button>
          }
          title="שליחת הודעה לשחקן"
          description="⚠ ערוץ שליחה חיצוני (WhatsApp/SMS) אינו מחובר. ההודעה תירשם במערכת ותופיע במרכז ההתראות, אך לא תישלח בפועל."
          confirmLabel="שלח"
          requireReason={false}
          extraFields={
            <div>
              <Label htmlFor="player-message" required>
                תוכן ההודעה
              </Label>
              <textarea
                id="player-message"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-[var(--radius-control)] bg-[var(--bg-input)] p-3 text-sm ring-1 ring-inset ring-[var(--border-default)] focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
                placeholder="למשל: זיהינו תקלה בעמדה, אנחנו מטפלים בזה. הסשן יוארך ללא חיוב."
              />
            </div>
          }
          onConfirm={() => messagePlayerAction(sessionId, messageText)}
        />
      )}
    </div>
  );
}
