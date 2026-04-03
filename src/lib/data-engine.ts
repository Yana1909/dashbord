import * as aq from 'arquero';
import * as XLSX from 'xlsx';

/**
 * Parses an Excel file and returns an array of objects.
 * Uses cellDates to properly parse date values.
 */
export async function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'yyyy-mm-dd' });
      resolve(json as any[]);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function parsePbix(_file: File): Promise<any[]> {
  throw new Error('PBIX parsing is not implemented. Please upload an Excel (.xlsx) file.');
}

// ─── Date utilities ────────────────────────────────────────────────────────────

/** Try to coerce a value to a Date object. Returns null if unable. */
export function tryParseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === 'string') {
    const ts = Date.parse(val);
    if (!isNaN(ts)) return new Date(ts);
  }
  return null;
}

export function getYear(d: Date) { return d.getFullYear(); }
export function getMonth(d: Date) { return d.getMonth() + 1; }  // 1-12
export function getQuarter(d: Date) { return Math.ceil((d.getMonth() + 1) / 3); }

const MONTH_NAMES: Record<number, string> = {
  1: 'Янв', 2: 'Фев', 3: 'Март', 4: 'Апр',
  5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Авг',
  9: 'Сен', 10: 'Окт', 11: 'Ноя', 12: 'Дек',
};

export type PeriodType = 'month' | 'quarter' | 'year';

/** Format a period label for display */
export function formatPeriodLabel(year: number, period: number, type: PeriodType): string {
  if (type === 'month') return `${MONTH_NAMES[period]} ${year}`;
  if (type === 'quarter') return `Q${period} ${year}`;
  return String(year);
}

// ─── Table metadata ────────────────────────────────────────────────────────────

export interface TableMetadata {
  metrics: string[];       // numeric columns
  dimensions: string[];    // categorical (non-date) columns
  dateCol: string | null;  // best-guess date column
  allColumns: string[];
}

/**
 * Scans the first ~20 rows to decide column types.
 * A column is "metric" if >50% of sampled non-null values are numbers.
 * A column is "date" if it parses as dates reliably.
 * Otherwise it's a dimension.
 */
export function getTableMetadata(table: any): TableMetadata {
  const empty: TableMetadata = { metrics: [], dimensions: [], dateCol: null, allColumns: [] };
  if (!table) return empty;

  const allColumns: string[] = table.columnNames();
  const sampleRows: any[] = table.slice(0, Math.min(20, table.numRows())).objects();
  if (sampleRows.length === 0) return { ...empty, allColumns };

  const metrics: string[] = [];
  const dimensions: string[] = [];
  let dateCol: string | null = null;

  allColumns.forEach((col) => {
    const vals = sampleRows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
    if (vals.length === 0) { dimensions.push(col); return; }

    // Test for date column
    const nameLooksLikeDate = /date|дата|period|период|month|год|year|квартал|quarter/i.test(col);
    const dateCount = vals.filter(v => tryParseDate(v) !== null).length;
    const isDateCol = (dateCount / vals.length) > 0.6 || (nameLooksLikeDate && dateCount > 0);

    if (isDateCol && !dateCol) {
      dateCol = col;
      return;
    }

    // Test for numeric (metric)
    const numCount = vals.filter(v => typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')).length;
    const isNumeric = (numCount / vals.length) > 0.6;

    if (isNumeric) {
      metrics.push(col);
    } else {
      dimensions.push(col);
    }
  });

  return { metrics, dimensions, dateCol, allColumns };
}

// ─── Aggregation helpers ───────────────────────────────────────────────────────

/**
 * Returns all distinct periods from the date column, sorted ascending.
 * Each period is { year, period (month/quarter/1), label }.
 */
export interface PeriodEntry {
  year: number;
  period: number;   // month number (1-12), quarter (1-4), or 1 for year mode
  label: string;
  sortKey: string;
}

export function getAvailablePeriods(table: any, dateCol: string, periodType: PeriodType): PeriodEntry[] {
  if (!table || !dateCol) return [];
  try {
    const vals: any[] = table.array(dateCol);
    const seen = new Map<string, PeriodEntry>();
    vals.forEach(v => {
      const d = tryParseDate(v);
      if (!d) return;
      const y = getYear(d);
      const p = periodType === 'month' ? getMonth(d) : periodType === 'quarter' ? getQuarter(d) : 1;
      const label = formatPeriodLabel(y, p, periodType);
      const sortKey = `${y}-${String(p).padStart(2, '0')}`;
      if (!seen.has(sortKey)) seen.set(sortKey, { year: y, period: p, label, sortKey });
    });
    return Array.from(seen.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  } catch (e) {
    console.error('getAvailablePeriods error:', e);
    return [];
  }
}

/**
 * Filter the table to only rows within a given period.
 * If period is null, returns the full table.
 */
export function filterByPeriod(
  table: any,
  dateCol: string | null,
  year: number | null,
  period: number | null,
  periodType: PeriodType
): any {
  if (!table || !dateCol || year === null) return table;

  return table.filter(
    aq.escape((row: any) => {
      const d = tryParseDate(row[dateCol]);
      if (!d) return false;
      if (getYear(d) !== year) return false;
      if (periodType === 'month') return getMonth(d) === period;
      if (periodType === 'quarter') return getQuarter(d) === period;
      return true; // year mode, already checked year
    })
  );
}

// ─── KPI computation ───────────────────────────────────────────────────────────

export interface MetricSummary {
  name: string;
  current: number;
  previous: number;
  /** percentage change vs previous period, null if no prior period */
  trend: number | null;
  /** unique count of first dimension */
  uniqueDimCount: number;
  dimensionName: string;
}

/**
 * Full metric summary for the current and previous period.
 * "Previous" means: if viewing a month → previous month; quarter → previous quarter; year → previous year.
 */
export function computeMetricSummary(
  rawTable: any,
  metadata: TableMetadata,
  metricCol: string,
  dateCol: string | null,
  currentYear: number | null,
  currentPeriod: number | null,
  periodType: PeriodType
): MetricSummary {
  const emptyResult: MetricSummary = {
    name: metricCol,
    current: 0,
    previous: 0,
    trend: null,
    uniqueDimCount: 0,
    dimensionName: metadata.dimensions[0] || 'Rows',
  };

  if (!rawTable || !metricCol) return emptyResult;

  const sum = (tbl: any): number => {
    if (!tbl || tbl.numRows() === 0) return 0;
    try {
      const result = tbl.rollup({ val: aq.op.sum(metricCol) }).objects()[0];
      return Number(result?.val) || 0;
    } catch { return 0; }
  };

  const currentTable = filterByPeriod(rawTable, dateCol, currentYear, currentPeriod, periodType);
  const currentVal = sum(currentTable);

  // Compute "previous" period automatically
  let prevYear = currentYear;
  let prevPeriod = currentPeriod;
  if (currentYear !== null && currentPeriod !== null) {
    if (periodType === 'month') {
      if (currentPeriod === 1) { prevYear = currentYear! - 1; prevPeriod = 12; }
      else { prevPeriod = currentPeriod - 1; }
    } else if (periodType === 'quarter') {
      if (currentPeriod === 1) { prevYear = currentYear! - 1; prevPeriod = 4; }
      else { prevPeriod = currentPeriod - 1; }
    } else {
      prevYear = currentYear! - 1; prevPeriod = 1;
    }
  }

  const prevTable = filterByPeriod(rawTable, dateCol, prevYear, prevPeriod, periodType);
  const prevVal = sum(prevTable);

  let trend: number | null = null;
  if (prevVal !== 0) {
    trend = Math.round(((currentVal - prevVal) / Math.abs(prevVal)) * 1000) / 10;
  } else if (currentVal > 0) {
    trend = null; // new metric, no historical comparison
  }

  // Unique dimension count in current period
  let uniqueDimCount = 0;
  const dim = metadata.dimensions[0];
  if (dim && currentTable && currentTable.numRows() > 0) {
    try {
      uniqueDimCount = new Set(currentTable.array(dim)).size;
    } catch { /* noop */ }
  }

  return {
    name: metricCol,
    current: currentVal,
    previous: prevVal,
    trend,
    uniqueDimCount,
    dimensionName: dim || 'Rows',
  };
}

// ─── Chart data ────────────────────────────────────────────────────────────────

/**
 * Returns time-series data for a given metric, grouped by period.
 */
export function getTimeSeriesData(
  table: any,
  dateCol: string,
  metricCols: string[],
  periodType: PeriodType
): Array<Record<string, any>> {
  if (!table || !dateCol || metricCols.length === 0) return [];
  try {
    // Derive a period label column
    const withPeriod = table.derive({
      __period__: aq.escape((row: any) => {
        const d = tryParseDate(row[dateCol]);
        if (!d) return null;
        const y = getYear(d);
        const p = periodType === 'month' ? getMonth(d) : periodType === 'quarter' ? getQuarter(d) : 1;
        return formatPeriodLabel(y, p, periodType);
      }),
      __sortKey__: aq.escape((row: any) => {
        const d = tryParseDate(row[dateCol]);
        if (!d) return '';
        const y = getYear(d);
        const p = periodType === 'month' ? getMonth(d) : periodType === 'quarter' ? getQuarter(d) : 1;
        return `${y}-${String(p).padStart(2, '0')}`;
      }),
    }).filter(aq.escape((row: any) => row.__period__ !== null));

    const rollupSpec: Record<string, any> = {};
    metricCols.forEach(col => { rollupSpec[col] = aq.op.sum(col); });
    rollupSpec['__sortKey__'] = aq.op.max('__sortKey__');

    const grouped = withPeriod
      .groupby('__period__')
      .rollup(rollupSpec)
      .orderby('__sortKey__')
      .objects() as Array<Record<string, any>>;

    return grouped.map(row => {
      const obj: Record<string, any> = { period: row['__period__'] };
      metricCols.forEach(col => { obj[col] = row[col] ?? 0; });
      return obj;
    });
  } catch (e) {
    console.error('getTimeSeriesData error:', e);
    return [];
  }
}

/**
 * Returns breakdown data grouped by a given dimension column.
 */
export function getBreakdownData(
  table: any,
  dimension: string,
  metricCol: string,
  topN = 10
): Array<{ name: string; value: number }> {
  if (!table || !dimension || !metricCol) return [];
  try {
    return table
      .groupby(dimension)
      .rollup({ value: aq.op.sum(metricCol) })
      .orderby(aq.desc('value'))
      .slice(0, topN)
      .objects()
      .map((row: any) => ({ name: String(row[dimension]), value: row['value'] ?? 0 }));
  } catch (e) {
    console.error('getBreakdownData error:', e);
    return [];
  }
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

export function generateMockData() {
  const regions = ['Север', 'Юг', 'Запад', 'Восток'];
  const categories = ['Оборудование', 'Программы', 'Услуги', 'Консалтинг'];
  const clients = Array.from({ length: 30 }, (_, i) => `Клиент ${i + 1}`);

  const data: any[] = [];
  // Generate 18 months of data: Jan 2024 – Jun 2025
  for (let m = 0; m < 18; m++) {
    const year = m < 12 ? 2024 : 2025;
    const month = (m % 12) + 1;
    const dateStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const rowsPerMonth = Math.floor(Math.random() * 40) + 20;
    for (let i = 0; i < rowsPerMonth; i++) {
      data.push({
        Дата: dateStr,
        Регион: regions[Math.floor(Math.random() * regions.length)],
        Категория: categories[Math.floor(Math.random() * categories.length)],
        Клиент: clients[Math.floor(Math.random() * clients.length)],
        Выручка: Math.floor(Math.random() * 450_000) + 50_000,
        Прибыль: Math.floor(Math.random() * 120_000) + 10_000,
        Расходы: Math.floor(Math.random() * 200_000) + 30_000,
        Сделки: Math.floor(Math.random() * 10) + 1,
      });
    }
  }
  return data;
}
