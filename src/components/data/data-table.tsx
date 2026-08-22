import * as React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';
import { TableToolbar, type ToolbarColumn } from './table-toolbar';

export interface Column<T> {
  key: string;
  header: string;
  /** רוחב טיילווינד, למשל 'w-40' */
  width?: string;
  align?: 'start' | 'center' | 'end';
  render: (row: T) => React.ReactNode;
  /** ערך לייצוא CSV/XLSX — טקסט או מספר בלבד */
  exportValue?: (row: T) => string | number;
  hideable?: boolean;
  defaultHidden?: boolean;
  /**
   * מאפשר גלישה לשורה נוספת. ברירת המחדל היא שורה אחת:
   * עמודה צרה שגולשת שוברת שם לשלוש שורות והופכת את הטבלה לבלתי קריאה.
   * הטבלה גוללת אופקית במקום לדחוס את התוכן.
   */
  wrap?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  exportName?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    buildHref: (page: number) => string;
  };
  dense?: boolean;
  className?: string;
}

let tableCounter = 0;

/**
 * טבלת נתונים.
 *
 * ⚠ זהו **Server Component** במכוון.
 * פונקציות `render` ו־`exportValue` אינן סריאליזביליות ולכן אינן יכולות לחצות
 * את גבול Server → Client. הפתרון: הטבלה מרונדרת בשרת, וסרגל הכלים
 * (בחירת עמודות וייצוא) הוא הרכיב היחיד שרץ בלקוח — והוא מקבל מטריצת ערכים
 * מוכנה, לא פונקציות.
 *
 * הסתרת עמודות מתבצעת ב־CSS על עמודות שכבר קיימות ב־DOM, כדי שהיא תהיה מיידית
 * ולא תדרוש הלוך־ושוב לשרת.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  emptyTitle = 'אין נתונים להצגה',
  emptyDescription,
  exportName = 'velax-export',
  pagination,
  dense,
  className,
}: DataTableProps<T>) {
  const tableId = `vx-table-${++tableCounter}`;

  const toolbarColumns: ToolbarColumn[] = columns.map((c) => ({
    key: c.key,
    header: c.header,
    hideable: Boolean(c.hideable),
    defaultHidden: Boolean(c.defaultHidden),
  }));

  // מטריצת הייצוא נבנית בשרת ועוברת ללקוח כנתונים בלבד
  const exportHeaders = columns.map((c) => c.header);
  const exportRows: (string | number)[][] = rows.map((row) =>
    columns.map((c) => {
      if (c.exportValue) return c.exportValue(row);
      const value = c.render(row);
      return typeof value === 'string' || typeof value === 'number' ? value : '';
    }),
  );

  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  const summary = pagination ? (
    <>
      מוצגות <span className="num">{rows.length}</span> מתוך{' '}
      <span className="num">{pagination.total.toLocaleString('he-IL')}</span> רשומות
    </>
  ) : (
    <>
      <span className="num">{rows.length.toLocaleString('he-IL')}</span> רשומות
    </>
  );

  return (
    <div className={cn('flex flex-col', className)}>
      <TableToolbar
        columns={toolbarColumns}
        exportHeaders={exportHeaders}
        exportRows={exportRows}
        exportName={exportName}
        summary={summary}
        tableId={tableId}
      />

      <div className="overflow-x-auto rounded-[var(--radius-card)] ring-1 ring-inset ring-[var(--border-subtle)]">
        {rows.length === 0 ? (
          <div className="bg-[var(--bg-raised)]">
            <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
          </div>
        ) : (
          <table
            id={tableId}
            className="table-sticky-head w-max min-w-full border-collapse bg-[var(--bg-raised)] text-sm"
          >
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    data-col={c.key}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-tertiary)]',
                      c.align === 'end' && 'text-end',
                      c.align === 'center' && 'text-center',
                      c.align !== 'end' && c.align !== 'center' && 'text-start',
                      c.width,
                    )}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                const href = rowHref?.(row);
                return (
                  <tr
                    key={key}
                    className={cn(
                      'border-b border-[var(--border-subtle)] transition-colors last:border-0',
                      href && 'hover:bg-[var(--bg-hover)]',
                    )}
                  >
                    {columns.map((c, i) => (
                      <td
                        key={c.key}
                        data-col={c.key}
                        className={cn(
                          dense ? 'px-3 py-1.5' : 'px-3 py-2.5',
                          'align-middle text-[13px] text-[var(--fg-primary)]',
                          c.wrap ? 'min-w-[14rem]' : 'whitespace-nowrap',
                          c.align === 'end' && 'text-end',
                          c.align === 'center' && 'text-center',
                        )}
                      >
                        {href && i === 0 ? (
                          <Link href={href} className="block font-medium hover:text-[var(--accent)]">
                            {c.render(row)}
                          </Link>
                        ) : (
                          c.render(row)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pagination && totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2 pt-3" aria-label="ניווט בין עמודים">
          {pagination.page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pagination.buildHref(pagination.page - 1)}>
                <ChevronRight />
                הקודם
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronRight />
              הקודם
            </Button>
          )}

          <span className="text-[12px] text-[var(--fg-tertiary)]">
            עמוד <span className="num">{pagination.page}</span> מתוך{' '}
            <span className="num">{totalPages}</span>
          </span>

          {pagination.page < totalPages ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pagination.buildHref(pagination.page + 1)}>
                הבא
                <ChevronLeft />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              הבא
              <ChevronLeft />
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
