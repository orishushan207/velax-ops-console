'use client';

import * as React from 'react';
import { Columns3, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export interface ToolbarColumn {
  key: string;
  header: string;
  hideable: boolean;
  defaultHidden: boolean;
}

/**
 * סרגל הכלים של הטבלה — בחירת עמודות וייצוא.
 *
 * ⚠ זהו החלק היחיד בטבלה שהוא Client Component.
 * הטבלה עצמה מרונדרת בשרת, ולכן פונקציות render ו־exportValue
 * אינן חוצות את גבול Server → Client (שאינו מאפשר העברת פונקציות).
 * הייצוא מקבל מטריצת ערכים מוכנה מהשרת, לא פונקציות.
 */
export function TableToolbar({
  columns,
  exportHeaders,
  exportRows,
  exportName,
  summary,
  tableId,
}: {
  columns: ToolbarColumn[];
  exportHeaders: string[];
  exportRows: (string | number)[][];
  exportName: string;
  summary: React.ReactNode;
  /** מזהה הטבלה — משמש להסתרת עמודות ב־CSS */
  tableId: string;
}) {
  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [exporting, setExporting] = React.useState(false);

  // הסתרת עמודות מתבצעת ב־CSS על עמודות שכבר מרונדרות בשרת
  const hideCss = React.useMemo(() => {
    if (hidden.size === 0) return '';
    return [...hidden]
      .map((key) => `#${tableId} [data-col="${key}"]{display:none}`)
      .join('');
  }, [hidden, tableId]);

  const toggleColumn = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const visibleIndexes = React.useMemo(
    () => columns.map((c, i) => (hidden.has(c.key) ? -1 : i)).filter((i) => i >= 0),
    [columns, hidden],
  );

  const runExport = (format: 'csv' | 'xlsx') => {
    setExporting(true);
    try {
      const headers = visibleIndexes.map((i) => exportHeaders[i] ?? '');
      const rows = exportRows.map((r) => visibleIndexes.map((i) => r[i] ?? ''));
      if (format === 'csv') downloadCsv(`${exportName}.csv`, headers, rows);
      else void downloadXlsx(`${exportName}.xlsx`, headers, rows);
    } finally {
      setExporting(false);
    }
  };

  const hideableColumns = columns.filter((c) => c.hideable);

  return (
    <>
      {hideCss && <style dangerouslySetInnerHTML={{ __html: hideCss }} />}
      <div className="flex items-center justify-between gap-2 pb-2">
        <p className="text-[12px] text-[var(--fg-tertiary)]">{summary}</p>
        <div className="flex items-center gap-1">
          {hideableColumns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="בחירת עמודות">
                  <Columns3 />
                  עמודות
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>עמודות מוצגות</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hideableColumns.map((c) => (
                  <DropdownMenuItem
                    key={c.key}
                    onSelect={(e) => {
                      e.preventDefault();
                      toggleColumn(c.key);
                    }}
                  >
                    <span
                      className={cn(
                        'size-3.5 rounded-[4px] ring-1 ring-inset ring-[var(--border-strong)]',
                        !hidden.has(c.key) && 'bg-[var(--accent)] ring-[var(--accent)]',
                      )}
                    />
                    {c.header}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" loading={exporting} aria-label="ייצוא">
                <Download />
                ייצוא
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => runExport('csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runExport('xlsx')}>XLSX</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// ייצוא קבצים
// ─────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(fileName: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  // BOM כדי ש־Excel יזהה UTF-8 ויציג עברית נכון
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, fileName);
}

/**
 * כתיבת XLSX מינימלית (OOXML + zip).
 * נכתב ידנית במקום ספרייה חיצונית, כי חבילת SheetJS ב־npm נושאת פגיעויות ידועות
 * (Prototype Pollution, ReDoS) ואינה מתוחזקת.
 */
async function downloadXlsx(fileName: string, headers: string[], rows: (string | number)[][]) {
  const { zipSync, strToU8 } = await import('fflate');

  const escapeXml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const colName = (i: number) => {
    let n = i + 1;
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const buildRow = (values: (string | number)[], rowIndex: number) => {
    const cells = values
      .map((v, i) => {
        const ref = `${colName(i)}${rowIndex}`;
        if (typeof v === 'number' && Number.isFinite(v)) {
          return `<c r="${ref}"><v>${v}</v></c>`;
        }
        return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(v ?? ''))}</t></is></c>`;
      })
      .join('');
    return `<row r="${rowIndex}">${cells}</row>`;
  };

  const sheetRows = [buildRow(headers, 1), ...rows.map((r, i) => buildRow(r, i + 2))].join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="VELA-X" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypes),
    '_rels/.rels': strToU8(rootRels),
    'xl/workbook.xml': strToU8(workbookXml),
    'xl/_rels/workbook.xml.rels': strToU8(workbookRels),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
  });

  triggerDownload(
    new Blob([zipped as unknown as BlobPart], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName,
  );
}
