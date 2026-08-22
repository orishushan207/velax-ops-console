'use client';

import * as React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecordFormDialog } from './record-form';
import type { FieldSection } from './field-types';
import {
  createClubAction,
  createCoachAction,
  createLeadAction,
  createPlayerAction,
  createStationAction,
  updateClubAction,
  updateCoachAction,
  updateDeviceAction,
  updateLeadAction,
  updatePlayerAction,
  updateStationAction,
} from '@/server/actions/records';

/**
 * כפתורי יצירה ועריכה לכל ישות.
 *
 * ⚠ פעולות העריכה מקבלות מזהה כפרמטר ראשון. לא ניתן לקשור אותו בצד השרת
 * (closure אינו Serializable), לכן הקשירה נעשית כאן, בצד הלקוח.
 * זו הסיבה לקובץ הזה במקום להעביר `action` ישירות מדפי השרת.
 */

interface CreateProps {
  sections: FieldSection[];
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

interface EditProps {
  id: string;
  sections: FieldSection[];
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

function useDialog() {
  const [open, setOpen] = React.useState(false);
  return { open, setOpen };
}

function Trigger({
  label,
  variant,
  mode,
  onClick,
}: {
  label: string;
  variant: CreateProps['variant'];
  mode: 'create' | 'edit';
  onClick: () => void;
}) {
  return (
    <Button variant={variant ?? (mode === 'create' ? 'primary' : 'secondary')} size="sm" onClick={onClick}>
      {mode === 'create' ? <Plus /> : <Pencil />}
      {label}
    </Button>
  );
}

// ─── מועדונים ───

export function CreateClubButton({ sections, label = 'מועדון חדש', variant }: CreateProps) {
  const { open, setOpen } = useDialog();
  return (
    <>
      <Trigger label={label} variant={variant} mode="create" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="מועדון חדש"
        description="המועדון ייווצר בסטטוס שנבחר. חוזה, מגרשים ועמדות נוספים בהמשך מתוך כרטיס המועדון."
        submitLabel="צור מועדון"
        sections={sections}
        action={createClubAction}
        redirectTo="/clubs/:id"
      />
    </>
  );
}

export function EditClubButton({ id, sections, label = 'עריכה', variant }: EditProps) {
  const { open, setOpen } = useDialog();
  const action = React.useCallback((fd: FormData) => updateClubAction(id, fd), [id]);
  return (
    <>
      <Trigger label={label} variant={variant} mode="edit" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עריכת מועדון"
        description="כל שינוי נרשם ב־Audit Log עם הערך הקודם והחדש."
        submitLabel="שמור שינויים"
        sections={sections}
        action={action}
      />
    </>
  );
}

// ─── עמדות ───

export function CreateStationButton({ sections, label = 'עמדה חדשה', variant }: CreateProps) {
  const { open, setOpen } = useDialog();
  return (
    <>
      <Trigger label={label} variant={variant} mode="create" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עמדה חדשה"
        description="העמדה היא יחידת המדידה העסקית. שיוך מכונה נעשה בנפרד ממסך הצי."
        submitLabel="צור עמדה"
        sections={sections}
        action={createStationAction}
        redirectTo="/stations/:id"
      />
    </>
  );
}

export function EditStationButton({ id, sections, label = 'עריכה', variant }: EditProps) {
  const { open, setOpen } = useDialog();
  const action = React.useCallback((fd: FormData) => updateStationAction(id, fd), [id]);
  return (
    <>
      <Trigger label={label} variant={variant} mode="edit" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עריכת עמדה"
        description="השבתה מלאה עם סיבה נעשית מפעולות העמדה, לא מכאן."
        submitLabel="שמור שינויים"
        sections={sections}
        action={action}
      />
    </>
  );
}

// ─── שחקנים ───

export function CreatePlayerButton({ sections, label = 'שחקן חדש', variant }: CreateProps) {
  const { open, setOpen } = useDialog();
  return (
    <>
      <Trigger label={label} variant={variant} mode="create" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="שחקן חדש"
        description="נדרש מייל או טלפון ליצירת קשר. שחקן מתחת לגיל 18 מסומן כקטין אוטומטית."
        submitLabel="הוסף שחקן"
        sections={sections}
        action={createPlayerAction}
        redirectTo="/players/:id"
      />
    </>
  );
}

export function EditPlayerButton({ id, sections, label = 'עריכה', variant }: EditProps) {
  const { open, setOpen } = useDialog();
  const action = React.useCallback((fd: FormData) => updatePlayerAction(id, fd), [id]);
  return (
    <>
      <Trigger label={label} variant={variant} mode="edit" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עריכת שחקן"
        description="שינוי פרטים מזהים נרשם ב־Audit Log."
        submitLabel="שמור שינויים"
        sections={sections}
        action={action}
      />
    </>
  );
}

// ─── מאמנים ───

export function CreateCoachButton({ sections, label = 'מאמן חדש', variant }: CreateProps) {
  const { open, setOpen } = useDialog();
  return (
    <>
      <Trigger label={label} variant={variant} mode="create" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="מאמן חדש"
        description="תעריפי העמלה מגיעים מההגדרות העסקיות וניתן לשנותם בכרטיס המאמן."
        submitLabel="הוסף מאמן"
        sections={sections}
        action={createCoachAction}
        redirectTo="/coaches/:id"
      />
    </>
  );
}

export function EditCoachButton({ id, sections, label = 'עריכה', variant }: EditProps) {
  const { open, setOpen } = useDialog();
  const action = React.useCallback((fd: FormData) => updateCoachAction(id, fd), [id]);
  return (
    <>
      <Trigger label={label} variant={variant} mode="edit" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עריכת מאמן"
        description="שינוי סטטוס האימות משפיע על זכאות לעמלות."
        submitLabel="שמור שינויים"
        sections={sections}
        action={action}
      />
    </>
  );
}

// ─── לידים ───

export function CreateLeadButton({ sections, label = 'ליד חדש', variant }: CreateProps) {
  const { open, setOpen } = useDialog();
  return (
    <>
      <Trigger label={label} variant={variant} mode="create" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="ליד חדש"
        description="הליד ישויך אליך כבעלים. ניתן להעביר בעלות מתוך כרטיס הליד."
        submitLabel="צור ליד"
        sections={sections}
        action={createLeadAction}
        redirectTo="/crm/:id"
      />
    </>
  );
}

export function EditLeadButton({ id, sections, label = 'עריכה', variant }: EditProps) {
  const { open, setOpen } = useDialog();
  const action = React.useCallback((fd: FormData) => updateLeadAction(id, fd), [id]);
  return (
    <>
      <Trigger label={label} variant={variant} mode="edit" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עריכת ליד"
        description="מעבר לשלב 'נסגר בהצלחה' או 'אבד' מסמן את מועד הסגירה למדדי המשפך."
        submitLabel="שמור שינויים"
        sections={sections}
        action={action}
      />
    </>
  );
}

// ─── מכונות ───

export function EditDeviceButton({ id, sections, label = 'עריכה', variant }: EditProps) {
  const { open, setOpen } = useDialog();
  const action = React.useCallback((fd: FormData) => updateDeviceAction(id, fd), [id]);
  return (
    <>
      <Trigger label={label} variant={variant} mode="edit" onClick={() => setOpen(true)} />
      <RecordFormDialog
        open={open}
        onOpenChange={setOpen}
        title="עריכת מכונה"
        description="מפתח ההרשאה של המכונה אינו ניתן לצפייה או לעריכה מכאן."
        submitLabel="שמור שינויים"
        sections={sections}
        action={action}
      />
    </>
  );
}
