import {
  clubStatus,
  coachVerification,
  dominantHand,
  leadStage,
  membershipTier,
  playerLevel,
  stationStatus,
  stationType,
  userStatus,
} from '@/lib/labels';
import type { FieldSection, SelectOption } from './field-types';

/**
 * הגדרות הטפסים לכל ישות ליבה.
 *
 * הגדרה אחת משמשת גם ליצירה וגם לעריכה — הפרש היחיד הוא ערכי ברירת המחדל,
 * שמגיעים מהרשומה הקיימת. כך אין סיכון ששדה יתווסף לטופס אחד ולא לשני.
 *
 * ⚠ הקובץ מיובא מ־Server Components ומועבר ללקוח, לכן הוא חייב להישאר
 * נתונים טהורים — בלי פונקציות ובלי רכיבי React.
 */

/** ערך קיים לעריכה, או undefined ליצירה */
type V = Record<string, string | number | boolean | null | undefined>;

const str = (v: V, key: string): string | undefined => {
  const raw = v[key];
  return raw === null || raw === undefined ? undefined : String(raw);
};

/** time של Postgres חוזר כ־HH:MM:SS. input[type=time] רוצה HH:MM. */
const hhmm = (v: V, key: string, fallback: string): string => (str(v, key) ?? fallback).slice(0, 5);

export function clubFormSections(current: V = {}): FieldSection[] {
  return [
    {
      title: 'זיהוי המועדון',
      fields: [
        {
          name: 'name',
          label: 'שם המועדון',
          kind: 'text',
          required: true,
          half: true,
          placeholder: 'פאדל סנטר הרצליה',
          defaultValue: str(current, 'name'),
          maxLength: 200,
        },
        {
          name: 'code',
          label: 'קוד מועדון',
          kind: 'text',
          required: true,
          half: true,
          dir: 'ltr',
          placeholder: 'HRZ-01',
          hint: 'אותיות לטיניות גדולות, ספרות ומקפים.',
          defaultValue: str(current, 'code'),
          maxLength: 24,
        },
        {
          name: 'city',
          label: 'עיר',
          kind: 'text',
          required: true,
          half: true,
          placeholder: 'הרצליה',
          defaultValue: str(current, 'city'),
        },
        {
          name: 'region',
          label: 'אזור',
          kind: 'text',
          required: true,
          half: true,
          placeholder: 'מרכז',
          defaultValue: str(current, 'region'),
        },
        {
          name: 'address',
          label: 'כתובת',
          kind: 'text',
          placeholder: 'רחוב, מספר',
          defaultValue: str(current, 'address'),
        },
      ],
    },
    {
      title: 'תפעול',
      fields: [
        {
          name: 'status',
          label: 'סטטוס',
          kind: 'select',
          required: true,
          half: true,
          options: clubStatus.options(),
          defaultValue: str(current, 'status') ?? 'prospect',
        },
        {
          name: 'courtCount',
          label: 'מספר מגרשים',
          kind: 'number',
          required: true,
          half: true,
          dir: 'ltr',
          min: '0',
          step: '1',
          defaultValue: str(current, 'courtCount') ?? '0',
        },
        {
          name: 'offPeakStart',
          label: 'תחילת Off-Peak',
          kind: 'time',
          required: true,
          half: true,
          dir: 'ltr',
          defaultValue: hhmm(current, 'offPeakStart', '08:00'),
        },
        {
          name: 'offPeakEnd',
          label: 'סיום Off-Peak',
          kind: 'time',
          required: true,
          half: true,
          dir: 'ltr',
          hint: 'החלון שבו העמדה מייצרת הכנסה נוספת למועדון.',
          defaultValue: hhmm(current, 'offPeakEnd', '16:00'),
        },
        {
          name: 'notes',
          label: 'הערות',
          kind: 'textarea',
          defaultValue: str(current, 'notes'),
          maxLength: 2000,
        },
      ],
    },
  ];
}

export function stationFormSections(current: V = {}, clubOptions: SelectOption[]): FieldSection[] {
  return [
    {
      fields: [
        {
          name: 'clubId',
          label: 'מועדון',
          kind: 'select',
          required: true,
          options: clubOptions,
          defaultValue: str(current, 'clubId'),
        },
        {
          name: 'name',
          label: 'שם העמדה',
          kind: 'text',
          required: true,
          half: true,
          placeholder: 'עמדה צפונית',
          defaultValue: str(current, 'name'),
          maxLength: 120,
        },
        {
          name: 'code',
          label: 'קוד עמדה',
          kind: 'text',
          required: true,
          half: true,
          dir: 'ltr',
          placeholder: 'ST-01',
          hint: 'ייחודי בתוך המועדון.',
          defaultValue: str(current, 'code'),
          maxLength: 32,
        },
        {
          name: 'stationType',
          label: 'סוג עמדה',
          kind: 'select',
          required: true,
          half: true,
          options: stationType.options(),
          defaultValue: str(current, 'stationType') ?? 'lean',
        },
        {
          name: 'status',
          label: 'סטטוס',
          kind: 'select',
          required: true,
          half: true,
          options: stationStatus.options(),
          defaultValue: str(current, 'status') ?? 'planned',
        },
        {
          name: 'installedCost',
          label: 'עלות התקנה (₪, לפני מע״מ)',
          kind: 'number',
          dir: 'ltr',
          step: '0.01',
          min: '0',
          hint: 'לפי המודל: 5,500 ₪ עמדה רזה, 10,000 ₪ עמדה מלאה.',
          defaultValue: str(current, 'installedCost'),
        },
        {
          name: 'locationDescription',
          label: 'תיאור מיקום',
          kind: 'textarea',
          placeholder: 'ליד מגרש 3, פינת המחסן',
          defaultValue: str(current, 'locationDescription'),
        },
      ],
    },
  ];
}

export function playerFormSections(current: V = {}, clubOptions: SelectOption[]): FieldSection[] {
  return [
    {
      title: 'פרטים אישיים',
      fields: [
        {
          name: 'fullName',
          label: 'שם מלא',
          kind: 'text',
          required: true,
          defaultValue: str(current, 'fullName'),
          maxLength: 200,
        },
        {
          name: 'email',
          label: 'מייל',
          kind: 'email',
          half: true,
          dir: 'ltr',
          placeholder: 'player@example.com',
          defaultValue: str(current, 'email'),
        },
        {
          name: 'phone',
          label: 'טלפון',
          kind: 'tel',
          half: true,
          dir: 'ltr',
          placeholder: '0501234567',
          hint: 'נדרש מייל או טלפון אחד לפחות.',
          defaultValue: str(current, 'phone'),
        },
        {
          name: 'birthYear',
          label: 'שנת לידה',
          kind: 'number',
          half: true,
          dir: 'ltr',
          min: '1920',
          step: '1',
          hint: 'מתחת לגיל 18 מסומן כקטין ודורש אישור הורה.',
          defaultValue: str(current, 'birthYear'),
        },
        {
          name: 'status',
          label: 'סטטוס חשבון',
          kind: 'select',
          required: true,
          half: true,
          options: userStatus.options(),
          defaultValue: str(current, 'status') ?? 'active',
        },
      ],
    },
    {
      title: 'פרופיל שחקן',
      fields: [
        {
          name: 'level',
          label: 'רמה',
          kind: 'select',
          required: true,
          half: true,
          options: playerLevel.options(),
          defaultValue: str(current, 'level') ?? '1',
        },
        {
          name: 'dominantHand',
          label: 'יד דומיננטית',
          kind: 'select',
          required: true,
          half: true,
          options: dominantHand.options(),
          defaultValue: str(current, 'dominantHand') ?? 'unknown',
        },
        {
          name: 'membershipTier',
          label: 'מסלול מנוי',
          kind: 'select',
          required: true,
          half: true,
          options: membershipTier.options(),
          defaultValue: str(current, 'membershipTier') ?? 'X1',
        },
        {
          name: 'preferredClubId',
          label: 'מועדון מועדף',
          kind: 'select',
          half: true,
          options: clubOptions,
          defaultValue: str(current, 'preferredClubId'),
        },
        {
          name: 'notes',
          label: 'הערות פנימיות',
          kind: 'textarea',
          defaultValue: str(current, 'notes'),
          maxLength: 2000,
        },
      ],
    },
  ];
}

export function coachFormSections(current: V = {}, clubOptions: SelectOption[]): FieldSection[] {
  return [
    {
      title: 'פרטים אישיים',
      fields: [
        {
          name: 'fullName',
          label: 'שם מלא',
          kind: 'text',
          required: true,
          half: true,
          defaultValue: str(current, 'fullName'),
          maxLength: 200,
        },
        {
          name: 'displayName',
          label: 'שם תצוגה',
          kind: 'text',
          required: true,
          half: true,
          hint: 'השם שמוצג לשחקנים באפליקציה.',
          defaultValue: str(current, 'displayName'),
          maxLength: 200,
        },
        {
          name: 'email',
          label: 'מייל',
          kind: 'email',
          half: true,
          dir: 'ltr',
          defaultValue: str(current, 'email'),
        },
        {
          name: 'phone',
          label: 'טלפון',
          kind: 'tel',
          half: true,
          dir: 'ltr',
          hint: 'נדרש מייל או טלפון אחד לפחות.',
          defaultValue: str(current, 'phone'),
        },
      ],
    },
    {
      title: 'שיוך ותגמול',
      fields: [
        {
          name: 'referralCode',
          label: 'קוד הפניה',
          kind: 'text',
          required: true,
          half: true,
          dir: 'ltr',
          placeholder: 'COACH-DAN',
          hint: 'הבסיס לשיוך שחקנים ולחישוב עמלות.',
          defaultValue: str(current, 'referralCode'),
          maxLength: 40,
        },
        {
          name: 'verification',
          label: 'סטטוס אימות',
          kind: 'select',
          required: true,
          half: true,
          options: coachVerification.options(),
          defaultValue: str(current, 'verification') ?? 'pending',
        },
        {
          name: 'homeClubId',
          label: 'מועדון בית',
          kind: 'select',
          options: clubOptions,
          defaultValue: str(current, 'homeClubId'),
        },
        {
          name: 'bio',
          label: 'תיאור',
          kind: 'textarea',
          defaultValue: str(current, 'bio'),
          maxLength: 2000,
        },
      ],
    },
  ];
}

export function leadFormSections(current: V = {}): FieldSection[] {
  return [
    {
      title: 'המועדון',
      fields: [
        {
          name: 'clubName',
          label: 'שם המועדון',
          kind: 'text',
          required: true,
          half: true,
          defaultValue: str(current, 'clubName'),
          maxLength: 200,
        },
        {
          name: 'stage',
          label: 'שלב במשפך',
          kind: 'select',
          required: true,
          half: true,
          options: leadStage.options(),
          defaultValue: str(current, 'stage') ?? 'lead',
        },
        {
          name: 'city',
          label: 'עיר',
          kind: 'text',
          half: true,
          defaultValue: str(current, 'city'),
        },
        {
          name: 'region',
          label: 'אזור',
          kind: 'text',
          half: true,
          defaultValue: str(current, 'region'),
        },
        {
          name: 'courtCount',
          label: 'מספר מגרשים',
          kind: 'number',
          half: true,
          dir: 'ltr',
          min: '0',
          step: '1',
          defaultValue: str(current, 'courtCount'),
        },
        {
          name: 'source',
          label: 'מקור הליד',
          kind: 'text',
          half: true,
          placeholder: 'הפניה, תערוכה, פנייה יזומה',
          defaultValue: str(current, 'source'),
        },
      ],
    },
    {
      title: 'איש קשר',
      fields: [
        {
          name: 'contactName',
          label: 'שם',
          kind: 'text',
          half: true,
          defaultValue: str(current, 'contactName'),
        },
        {
          name: 'contactRole',
          label: 'תפקיד',
          kind: 'text',
          half: true,
          placeholder: 'מנהל מועדון',
          defaultValue: str(current, 'contactRole'),
        },
        {
          name: 'contactEmail',
          label: 'מייל',
          kind: 'email',
          half: true,
          dir: 'ltr',
          defaultValue: str(current, 'contactEmail'),
        },
        {
          name: 'contactPhone',
          label: 'טלפון',
          kind: 'tel',
          half: true,
          dir: 'ltr',
          defaultValue: str(current, 'contactPhone'),
        },
      ],
    },
    {
      title: 'עסקה',
      fields: [
        {
          name: 'dealValue',
          label: 'שווי עסקה (₪)',
          kind: 'number',
          half: true,
          dir: 'ltr',
          step: '0.01',
          min: '0',
          defaultValue: str(current, 'dealValue') ?? '0',
        },
        {
          name: 'expectedCloseDate',
          label: 'תאריך סגירה צפוי',
          kind: 'date',
          half: true,
          dir: 'ltr',
          defaultValue: str(current, 'expectedCloseDate'),
        },
        {
          name: 'notes',
          label: 'הערות',
          kind: 'textarea',
          defaultValue: str(current, 'notes'),
          maxLength: 2000,
        },
      ],
    },
  ];
}

export function deviceFormSections(current: V = {}): FieldSection[] {
  return [
    {
      description:
        'Device ID אינו ניתן לשינוי — הוא המזהה שהמכונה משדרת בשטח. שיוך לעמדה ובידוד נעשים בפעולות ייעודיות עם סיבה.',
      fields: [
        {
          name: 'serialNumber',
          label: 'מספר סידורי',
          kind: 'text',
          required: true,
          half: true,
          dir: 'ltr',
          defaultValue: str(current, 'serialNumber'),
          maxLength: 80,
        },
        {
          name: 'model',
          label: 'דגם',
          kind: 'text',
          required: true,
          half: true,
          defaultValue: str(current, 'model'),
          maxLength: 80,
        },
        {
          name: 'hardwareVersion',
          label: 'גרסת חומרה',
          kind: 'text',
          half: true,
          dir: 'ltr',
          placeholder: 'HW-2.1',
          defaultValue: str(current, 'hardwareVersion'),
          maxLength: 40,
        },
        {
          name: 'purchaseCost',
          label: 'עלות רכישה (₪, לפני מע״מ)',
          kind: 'number',
          half: true,
          dir: 'ltr',
          step: '0.01',
          min: '0',
          defaultValue: str(current, 'purchaseCost'),
        },
        {
          name: 'isSpare',
          label: 'מכונה חלופית',
          kind: 'switch',
          hint: 'מוחזקת במלאי להחלפה מהירה לפי SLA.',
          defaultChecked: current.isSpare === true || current.isSpare === 'true',
        },
        {
          name: 'notes',
          label: 'הערות',
          kind: 'textarea',
          defaultValue: str(current, 'notes'),
          maxLength: 2000,
        },
      ],
    },
  ];
}
