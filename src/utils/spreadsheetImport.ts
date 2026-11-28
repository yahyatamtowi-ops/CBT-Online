import * as XLSX from 'xlsx';

function escapeCsvCell(raw: unknown): string {
  const str = raw === null || raw === undefined ? '' : String(raw).trim();
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Pure parser converting an Excel (.xlsx / .xls) binary buffer into clean RFC-4180 CSV text
 * so all existing CBT parsers (students, teachers, questions, exam schedules) work identically
 * for both CSV and XLSX workbooks while preserving leading zeros (NISN/NIP) and formatted dates.
 */
export function parseXlsxBufferToCsv(buffer: ArrayBuffer | Uint8Array): {
  csvText: string;
  sheetName: string;
  rowCount: number;
} {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    raw: false,
    cellText: true,
    cellDates: false,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return { csvText: '', sheetName: '', rowCount: 0 };
  }

  // Pick the first worksheet that has non-empty cells
  let chosenSheetName = workbook.SheetNames[0];
  let rows: unknown[][] = [];
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const candidate = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
    const nonEmpty = candidate.filter(
      (r) => Array.isArray(r) && r.some((cell) => String(cell ?? '').trim().length > 0)
    );
    if (nonEmpty.length > 0) {
      chosenSheetName = name;
      rows = nonEmpty;
      break;
    }
  }

  const lines = rows.map((row) =>
    row.map((cell) => escapeCsvCell(cell)).join(',')
  );

  return {
    csvText: lines.join('\n'),
    sheetName: chosenSheetName,
    rowCount: rows.length,
  };
}

/**
 * Reads an uploaded .xlsx, .xls, .csv, or .txt file into delimited text ready for CBT parsers.
 */
export async function readTabularImportFile(file: File): Promise<{
  text: string;
  csvText: string;
  format: 'xlsx' | 'csv';
  sheetName?: string;
}> {
  const lower = file.name.toLowerCase();
  const isExcel =
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel';

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const { csvText, sheetName } = parseXlsxBufferToCsv(buffer);
    return { text: csvText, csvText, format: 'xlsx', sheetName };
  }

  const text = await file.text();
  return { text, csvText: text, format: 'csv' };
}

/**
 * Converts a CSV template string into a genuine .xlsx file download for Excel users.
 */
export function downloadXlsxFromCsv(
  filename: string,
  csvText: string,
  sheetName = 'Template'
): void {
  const wb = XLSX.read(csvText, { type: 'string', raw: true });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, sheet, sheetName.slice(0, 31));
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(outWb, safeName);
}

/**
 * Creates an in-memory .xlsx Uint8Array from 2D row data (handy for exports and deterministic tests).
 */
export function buildXlsxBufferFromRows(
  rows: Array<Array<string | number | boolean>>,
  sheetName = 'Data'
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}
