import { create } from 'zustand';
import * as aq from 'arquero';
import { v4 as uuidv4 } from 'uuid';
import {
  getTableMetadata,
  filterByPeriod,
  getAvailablePeriods,
  normalizeData,
  type TableMetadata,
  type PeriodType,
  type PeriodEntry,
} from '../lib/data-engine';
import { saveReportData, getReportData, deleteReportData } from '../lib/storage';

export interface SavedReportMeta {
  id: string;
  title: string;
  updated: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

interface DashboardState {
  // Data
  rawTable: any | null;
  tableMetadata: TableMetadata | null;
  dataLoaded: boolean;

  // Branding
  logoUrl: string | null;
  primaryColor: string;
  chartColors: string[];

  // Metric & Dimension selection
  selectedMetric: string | null;
  selectedDimension: string | null;

  // Period filter
  periodType: PeriodType;
  availablePeriods: PeriodEntry[];
  selectedPeriodKey: string | null;  // sortKey of selected period ("2024-03")

  // Dimension filters (categorical)
  dimensionFilters: Record<string, string[]>;

  // Filtered tables
  filteredTable: any | null; // All filters (Dimension + Period)
  dimTable: any | null;      // Dimension filters only (for trends/KPI comparison)

  // Dashboard meta
  dashboardId: string;
  dashboardTitle: string;
  lastUpdated: string;
  savedReports: SavedReportMeta[];

  // Actions
  setData: (data: any[], title?: string) => Promise<void>;
  loadSavedReports: () => void;
  selectReport: (id: string) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  setLogo: (url: string, topColors: string[]) => void;
  setSelectedMetric: (metric: string) => void;
  setSelectedDimension: (dimension: string) => void;
  setPeriodType: (type: PeriodType) => void;
  setSelectedPeriod: (key: string | null) => void;
  setDimensionFilter: (column: string, values: string[]) => void;
  clearFilters: () => void;
  resetDashboard: () => void;
}

function applyDimensionFilters(table: any, filters: Record<string, string[]>): any {
  if (!table) return table;
  let result = table;
  Object.entries(filters).forEach(([col, vals]) => {
    if (vals && vals.length > 0) {
      try {
        const valsSet = new Set(vals.map(v => String(v).trim()));
        const rows = result.objects();
        const filteredRows = rows.filter((d: any) => {
          const val = d[col];
          const strVal = (val === undefined || val === null || String(val).trim() === '') 
            ? 'Не вказано' 
            : String(val).trim();
          return valsSet.has(strVal);
        });
        result = filteredRows.length > 0 ? aq.from(filteredRows) : aq.from([]);
      } catch (e) {
        console.error('applyDimensionFilters error:', e);
      }
    }
  });
  return result;
}

function applyAllFilters(
  rawTable: any,
  metadata: TableMetadata | null,
  periodType: PeriodType,
  selectedPeriodKey: string | null,
  dimensionFilters: Record<string, string[]>
): { filtered: any, dimOnly: any } {
  if (!rawTable) return { filtered: null, dimOnly: null };

  const dimOnly = applyDimensionFilters(rawTable, dimensionFilters);
  let filtered = dimOnly;

  // Apply period filter
  if (metadata?.dateCol && selectedPeriodKey) {
    const [yearStr, periodStr] = selectedPeriodKey.split('-');
    const year = parseInt(yearStr, 10);
    const period = parseInt(periodStr, 10);
    filtered = filterByPeriod(filtered, metadata.dateCol, year, period, periodType);
  }

  return { filtered, dimOnly };
}

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  rawTable: null,
  filteredTable: null,
  dimTable: null,
  tableMetadata: null,
  dataLoaded: false,

  logoUrl: null,
  primaryColor: '#3b82f6',
  chartColors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],

  selectedMetric: null,
  selectedDimension: null,

  periodType: 'month',
  availablePeriods: [],
  selectedPeriodKey: null,

  dimensionFilters: {},

  dashboardId: uuidv4(),
  dashboardTitle: 'Untitled Dashboard',
  lastUpdated: new Date().toLocaleString('ru-RU'),
  savedReports: [],

  loadSavedReports: () => {
    const listJson = localStorage.getItem('saved_reports_list');
    if (listJson) {
      try {
        set({ savedReports: JSON.parse(listJson) });
      } catch {
        set({ savedReports: [] });
      }
    }
  },

  setData: async (data: any[], title?: string) => {
    const table = aq.from(normalizeData(data));
    const metadata = getTableMetadata(table);
    const newTitle = title || 'New Dashboard';
    const targetId = uuidv4();
    const defaultMetric = metadata.metrics[0] ?? null;
    const defaultDimension = metadata.dimensions[0] ?? null;
    const periods = metadata.dateCol
      ? getAvailablePeriods(table, metadata.dateCol, 'month')
      : [];

    const defaultPeriodKey = periods.length > 0 ? periods[periods.length - 1].sortKey : null;

    const newState = {
      rawTable: table as any,
      filteredTable: table as any,
      tableMetadata: metadata,
      dataLoaded: true,
      dashboardId: targetId,
      dashboardTitle: newTitle,
      lastUpdated: new Date().toLocaleString('ru-RU'),
      selectedMetric: defaultMetric,
      selectedDimension: defaultDimension,
      periodType: 'month' as PeriodType,
      availablePeriods: periods,
      selectedPeriodKey: defaultPeriodKey,
      dimensionFilters: {},
    };

    const { filtered, dimOnly } = applyAllFilters(table, metadata, 'month', defaultPeriodKey, {});
    set({ ...newState, filteredTable: filtered, dimTable: dimOnly });

    // Persist data to IndexedDB
    try {
      await saveReportData(targetId, data);
      
      // Update saved reports list in localStorage
      const { savedReports, logoUrl, primaryColor } = get();
      const newMeta: SavedReportMeta = {
        id: targetId,
        title: newTitle,
        updated: newState.lastUpdated,
        logoUrl,
        primaryColor,
      };
      const newList = [newMeta, ...savedReports.filter(r => r.id !== targetId)];
      set({ savedReports: newList });
      localStorage.setItem('saved_reports_list', JSON.stringify(newList));
    } catch (e) {
      console.error('Failed to save report:', e);
    }
  },

  selectReport: async (id: string) => {
    const data = await getReportData(id);
    if (!data) {
      alert('Could not find report data in local storage.');
      return;
    }

    const { savedReports } = get();
    const meta = savedReports.find(r => r.id === id);
    
    // Partially reuse logic from setData but with existing ID and Title
    const table = aq.from(normalizeData(data));
    const metadata = getTableMetadata(table);
    const periods = metadata.dateCol ? getAvailablePeriods(table, metadata.dateCol, 'month') : [];
    const defaultPeriodKey = periods.length > 0 ? periods[periods.length - 1].sortKey : null;

    // Restore branding if present in meta
    if (meta?.logoUrl) {
      set({ logoUrl: meta.logoUrl, primaryColor: meta.primaryColor || '#3b82f6' });
      if (meta.primaryColor) {
        document.documentElement.style.setProperty('--primary', meta.primaryColor);
      }
    }

    const newState = {
      rawTable: table as any,
      filteredTable: table as any,
      tableMetadata: metadata,
      dataLoaded: true,
      dashboardId: id,
      dashboardTitle: meta?.title || 'Loaded Dashboard',
      lastUpdated: meta?.updated || new Date().toLocaleString('ru-RU'),
      selectedMetric: metadata.metrics[0] ?? null,
      selectedDimension: metadata.dimensions[0] ?? null,
      periodType: 'month' as PeriodType,
      availablePeriods: periods,
      selectedPeriodKey: defaultPeriodKey,
      dimensionFilters: {},
    };

    const { filtered, dimOnly } = applyAllFilters(table, metadata, 'month', defaultPeriodKey, {});
    set({ ...newState, filteredTable: filtered, dimTable: dimOnly });
  },

  deleteReport: async (id: string) => {
    await deleteReportData(id);
    const { savedReports, dashboardId } = get();
    const newList = savedReports.filter(r => r.id !== id);
    set({ savedReports: newList });
    localStorage.setItem('saved_reports_list', JSON.stringify(newList));
    
    if (dashboardId === id) {
      get().resetDashboard();
    }
  },

  setLogo: (url: string, topColors: string[]) => {
    set({
      logoUrl: url,
      primaryColor: topColors[0] || '#3b82f6',
      chartColors: topColors.length > 0
        ? topColors
        : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
    });
    if (topColors[0]) {
      document.documentElement.style.setProperty('--primary', topColors[0]);
    }
  },

  setSelectedMetric: (metric: string) => {
    set({ selectedMetric: metric });
  },

  setSelectedDimension: (dimension: string) => {
    set({ selectedDimension: dimension });
  },

  setPeriodType: (type: PeriodType) => {
    const { rawTable, tableMetadata, selectedPeriodKey: _prev, dimensionFilters } = get();
    const periods = rawTable && tableMetadata?.dateCol
      ? getAvailablePeriods(rawTable, tableMetadata.dateCol, type)
      : [];
    const defaultPeriodKey = periods.length > 0 ? periods[periods.length - 1].sortKey : null;
    const { filtered, dimOnly } = applyAllFilters(rawTable, tableMetadata, type, defaultPeriodKey, dimensionFilters);
    set({ periodType: type, availablePeriods: periods, selectedPeriodKey: defaultPeriodKey, filteredTable: filtered, dimTable: dimOnly });
  },

  setSelectedPeriod: (key: string | null) => {
    const { rawTable, tableMetadata, periodType, dimensionFilters } = get();
    const { filtered, dimOnly } = applyAllFilters(rawTable, tableMetadata, periodType, key, dimensionFilters);
    set({ selectedPeriodKey: key, filteredTable: filtered, dimTable: dimOnly });
  },

  setDimensionFilter: (column: string, values: string[]) => {
    const { rawTable, tableMetadata, periodType, selectedPeriodKey, dimensionFilters } = get();
    const newFilters = { ...dimensionFilters };
    if (values.length === 0) delete newFilters[column];
    else newFilters[column] = values;
    const { filtered, dimOnly } = applyAllFilters(rawTable, tableMetadata, periodType, selectedPeriodKey, newFilters);
    set({ dimensionFilters: newFilters, filteredTable: filtered, dimTable: dimOnly });
  },

  clearFilters: () => {
    const { rawTable, tableMetadata, periodType } = get();
    const periods = rawTable && tableMetadata?.dateCol
      ? getAvailablePeriods(rawTable, tableMetadata.dateCol, periodType)
      : [];
    const defaultPeriodKey = periods.length > 0 ? periods[periods.length - 1].sortKey : null;
    const { filtered, dimOnly } = applyAllFilters(rawTable, tableMetadata, periodType, defaultPeriodKey, {});
    set({ dimensionFilters: {}, selectedPeriodKey: defaultPeriodKey, filteredTable: filtered, dimTable: dimOnly });
  },

  resetDashboard: () => {
    set({
      rawTable: null,
      filteredTable: null,
      dimTable: null,
      tableMetadata: null,
      dataLoaded: false,
      logoUrl: null,
      dimensionFilters: {},
      selectedMetric: null,
      selectedDimension: null,
      selectedPeriodKey: null,
      availablePeriods: [],
      dashboardId: uuidv4(),
      dashboardTitle: 'Untitled Dashboard',
    });
  },
}));
