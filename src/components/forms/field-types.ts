/**
 * תיאור שדה טופס — מבנה נתונים בלבד, ללא פונקציות וללא רכיבי React.
 *
 * ⚠ הקובץ הזה נטען גם ב־Server Components וגם ב־Client Components.
 * כל שדה חייב להיות Serializable כדי לעבור את גבול השרת→לקוח.
 * זו הסיבה שאין כאן `render` או `component` — רק `kind` שהלקוח ממפה לרכיב.
 */

export type FieldKind =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'date'
  | 'time'
  | 'textarea'
  | 'select'
  | 'switch';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** ltr לשדות שמכילים מזהים, קודים או מספרים באנגלית */
  dir?: 'rtl' | 'ltr';
  defaultValue?: string;
  defaultChecked?: boolean;
  options?: SelectOption[];
  step?: string;
  min?: string;
  max?: string;
  maxLength?: number;
  /** רוחב בעמודות רשת של 2. ברירת מחדל: שדה מלא */
  half?: boolean;
  disabled?: boolean;
}

/** קבוצת שדות עם כותרת, לטפסים ארוכים */
export interface FieldSection {
  title?: string;
  description?: string;
  fields: FieldDef[];
}

export function section(title: string | undefined, fields: FieldDef[]): FieldSection {
  return { title, fields };
}

/** ממיר enum + מילון עברי לרשימת אפשרויות ל־select */
export function optionsFrom<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): SelectOption[] {
  return values.map((v) => ({ value: v, label: labels[v] ?? v }));
}
