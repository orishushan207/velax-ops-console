'use client';

import * as React from 'react';
import { RefreshCw, Scale, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmAction, QuickAction } from '@/components/data/confirm-action';
import {
  addEarnBackAdjustmentAction,
  recalculateEarnBackAction,
  settleEarnBackAction,
  updateEarnBackConditionAction,
} from '@/server/actions/earn-back';

export function EarnBackActions({
  agreementId,
  status,
  maxSettlement,
  can,
}: {
  agreementId: string;
  status: string;
  maxSettlement: number;
  can: { adjust: boolean; manage: boolean };
}) {
  const [adjustmentType, setAdjustmentType] = React.useState('revenue_credit');
  const [amount, setAmount] = React.useState('');
  const [days, setDays] = React.useState('');
  const [settlementOutcome, setSettlementOutcome] = React.useState<
    'settled_topup' | 'settled_buyback'
  >('settled_topup');
  const [settlementAmount, setSettlementAmount] = React.useState(String(maxSettlement.toFixed(2)));

  const isSettled = status.startsWith('settled');

  return (
    <div className="flex flex-wrap gap-2">
      <QuickAction
        label="חישוב מחדש"
        icon={<RefreshCw />}
        onRun={() => recalculateEarnBackAction(agreementId)}
      />

      {can.adjust && !isSettled && (
        <ConfirmAction
          trigger={
            <Button variant="outline" size="sm">
              <SlidersHorizontal />
              התאמה לחישוב
            </Button>
          }
          title="התאמה ידנית לחישוב הערבות"
          description="התאמה משנה את תוצאת הערבות ולכן נשמרת כרשומה נפרדת עם שמך כמאשר, ונרשמת ב־Audit Log."
          confirmLabel="רשום התאמה"
          reasonLabel="נימוק"
          minReasonLength={15}
          destructive
          extraFields={
            <>
              <div>
                <Label required>סוג ההתאמה</Label>
                <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue_credit">זיכוי הכנסה — הוספה לזכות המועדון</SelectItem>
                    <SelectItem value="revenue_debit">חיוב הכנסה — הפחתה</SelectItem>
                    <SelectItem value="period_extension">הארכת תקופה (ימי השבתה)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {adjustmentType.startsWith('revenue') ? (
                <div>
                  <Label htmlFor="adj-amount" required>
                    סכום (₪, לפני מע״מ)
                  </Label>
                  <Input
                    id="adj-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    className="mt-1.5 text-start"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="adj-days" required>
                    ימים להארכה
                  </Label>
                  <Input
                    id="adj-days"
                    name="days"
                    type="number"
                    min="1"
                    dir="ltr"
                    className="mt-1.5 text-start"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  />
                </div>
              )}
            </>
          }
          onConfirm={(reason, formData) => {
            formData.set('agreementId', agreementId);
            formData.set('adjustmentType', adjustmentType);
            formData.set('reason', reason);
            if (adjustmentType.startsWith('revenue')) formData.set('amount', amount);
            else formData.set('days', days);
            return addEarnBackAdjustmentAction(formData);
          }}
        />
      )}

      {can.manage && !isSettled && (
        <ConfirmAction
          trigger={
            <Button variant="dangerOutline" size="sm">
              <Scale />
              הסדרת הערבות
            </Button>
          }
          title="הסדרת ערבות Earn-Back"
          description="פעולה כספית סופית. השלמת פער היא תשלום למועדון; Buyback הוא רכישה חזרה של העמדה. הסכום מוגבל בתקרת החשיפה שנקבעה בהסכם."
          confirmLabel="בצע הסדרה"
          destructive
          minReasonLength={15}
          extraFields={
            <>
              <div>
                <Label required>סוג ההסדרה</Label>
                <Select
                  value={settlementOutcome}
                  onValueChange={(v) =>
                    setSettlementOutcome(v as 'settled_topup' | 'settled_buyback')
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="settled_topup">השלמת פער — תשלום למועדון</SelectItem>
                    <SelectItem value="settled_buyback">Buyback — רכישת העמדה חזרה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="settle-amount" required>
                  סכום ההסדרה (₪)
                </Label>
                <Input
                  id="settle-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  dir="ltr"
                  className="mt-1.5 text-start"
                  value={settlementAmount}
                  onChange={(e) => setSettlementAmount(e.target.value)}
                />
              </div>
            </>
          }
          onConfirm={(reason) =>
            settleEarnBackAction(
              agreementId,
              settlementOutcome,
              Number.parseFloat(settlementAmount) || 0,
              reason,
            )
          }
        />
      )}
    </div>
  );
}

/** עדכון סטטוס תנאי סף */
export function ConditionControl({
  conditionId,
  nameHe,
  currentStatus,
  canManage,
}: {
  conditionId: string;
  nameHe: string;
  currentStatus: string;
  canManage: boolean;
}) {
  const [nextStatus, setNextStatus] = React.useState<'met' | 'not_met' | 'waived'>('met');
  if (!canManage) return null;

  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="sm">
          עדכון
        </Button>
      }
      title="עדכון תנאי סף"
      description={nameHe}
      confirmLabel="עדכן"
      reasonLabel="נימוק"
      extraFields={
        <div>
          <Label required>סטטוס חדש</Label>
          <Select
            value={nextStatus}
            onValueChange={(v) => setNextStatus(v as 'met' | 'not_met' | 'waived')}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="met">עומד בתנאי</SelectItem>
              <SelectItem value="not_met">אינו עומד</SelectItem>
              <SelectItem value="waived">ויתור מסחרי</SelectItem>
            </SelectContent>
          </Select>
          {currentStatus === 'waived' && (
            <p className="mt-1 text-[11px] text-[var(--signal-warning)]">
              התנאי כבר בסטטוס ויתור. שינוי יבטל את הוויתור הקיים.
            </p>
          )}
        </div>
      }
      onConfirm={(reason) => updateEarnBackConditionAction(conditionId, nextStatus, reason)}
    />
  );
}
