import React, { useRef } from 'react';
import { Search, Upload, Filter, X, ChevronRight, LayoutDashboard, CalendarDays, BarChart2 } from 'lucide-react';
import { useDashboardStore } from '../store/useDashboardStore';
import { parseExcel, parsePbix } from '../lib/data-engine';
import { extractBrandingColors } from '../lib/branding';
import { cn, Button, Input } from './ui/base';
import type { PeriodType } from '../lib/data-engine';

const PERIOD_TYPES: { value: PeriodType; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export function DashboardSidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const {
    logoUrl,
    setLogo,
    setData,
    rawTable,
    tableMetadata,
    dimensionFilters,
    setDimensionFilter,
    clearFilters,
    selectedMetric,
    setSelectedMetric,
    selectedDimension,
    setSelectedDimension,
    periodType,
    setPeriodType,
    availablePeriods,
    selectedPeriodKey,
    setSelectedPeriod,
  } = useDashboardStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let data: any[] = [];
    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        data = await parseExcel(file);
      } else if (file.name.endsWith('.pbix')) {
        data = await parsePbix(file);
      }
    } catch (err: any) {
      alert(err?.message || 'Error uploading file');
      return;
    }
    if (data.length > 0) {
      await setData(data, file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const colors = await extractBrandingColors(url);
    setLogo(url, colors);
  };

  const selectedDim = selectedDimension || (tableMetadata?.dimensions?.[0]);

  // Dimensions that are good for filtering (not too many values, OR it's the currently selected grouping)
  const categoricalCols = tableMetadata?.dimensions.filter((col) => {
    try {
      if (col === selectedDim) return true; // Always include the current grouping for drill-down
      return rawTable && new Set(rawTable.array(col)).size <= 25;
    } catch { return false; }
  }) ?? [];

  // Sort categoricalCols so the selected group is always at the top
  const sortedFilters = [...categoricalCols].sort((a, b) => {
    if (a === selectedDim) return -1;
    if (b === selectedDim) return 1;
    return a.localeCompare(b);
  });

  const hasAnyFilter = Object.keys(dimensionFilters).length > 0;
  const hasPeriods = availablePeriods.length > 0;
  const hasMetrics = (tableMetadata?.metrics?.length ?? 0) > 0;

  return (
    <aside className={cn(
      'w-[300px] h-screen bg-white/60 backdrop-blur-3xl border-r border-white flex flex-col fixed left-0 top-0 z-40 transition-all duration-500 shadow-2xl shadow-black/5',
      isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:static'
    )}>
      <div className="p-8 flex flex-col gap-10 h-full overflow-y-auto">

        {/* Branding & Upload */}
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between lg:hidden mb-2">
                <span className="font-extrabold text-2xl tracking-tighter text-gray-900">Elite</span>
                <Button variant="ghost" className="p-1 h-auto" onClick={onClose}>
                    <X className="w-6 h-6 text-gray-400" />
                </Button>
            </div>
            
            <div
                className="w-full aspect-[4/1.5] bg-white rounded-[24px] flex items-center justify-center border-2 border-dashed border-gray-100 group cursor-pointer overflow-hidden transition-all hover:bg-white/80"
                onClick={() => logoInputRef.current?.click()}
            >
                {logoUrl
                ? <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain p-4 transition-transform group-hover:scale-105" />
                : <span className="text-gray-300 text-[11px] font-bold uppercase tracking-widest group-hover:text-primary transition-colors">Workspace Logo</span>
                }
                <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
            </div>
            
            <Button className="w-full h-12 gap-3" variant="primary" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 stroke-[2.5px]" />
                <span className="text-[13px] font-bold">Import Spreadsheet</span>
            </Button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.pbix" onChange={handleFileUpload} />
            
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 stroke-[2.5px]" />
                <Input className="pl-11 bg-white border-transparent shadow-sm" placeholder="Search insights..." />
            </div>
        </div>

        {/* Dynamic Controls Section */}
        <div className="flex-1 space-y-12 pb-12">
            
            {/* Metric Selection */}
            {hasMetrics && (
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest px-1">Primary Metric</h3>
                    <div className="flex flex-col gap-1.5 px-0.5">
                    {tableMetadata!.metrics.map(m => (
                        <button
                        key={m}
                        onClick={() => setSelectedMetric(m)}
                        className={cn(
                            'group relative flex items-center gap-3 px-4 py-3 rounded-[16px] text-[13px] font-semibold transition-all italic border-none',
                            selectedMetric === m
                            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                            : 'text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-md'
                        )}
                        >
                            <BarChart2 className={cn("w-4 h-4", selectedMetric === m ? "text-white" : "text-gray-200 group-hover:text-primary")} />
                            <span className="truncate">{m}</span>
                        </button>
                    ))}
                    </div>
                </div>
            )}

            {/* Dimension Selection */}
            {(tableMetadata?.dimensions?.length ?? 0) > 0 && (
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest px-1">Grouping Analysis</h3>
                    <div className="flex flex-col gap-1.5 px-0.5 max-h-[300px] overflow-y-auto custom-scroll pr-2">
                    {tableMetadata!.dimensions.map(dim => (
                        <button
                        key={dim}
                        onClick={() => setSelectedDimension(dim)}
                        className={cn(
                            'group flex items-center gap-3 px-4 py-3 rounded-[16px] text-[13px] font-semibold transition-all border-none',
                            selectedDimension === dim
                            ? 'bg-primary/10 text-primary scale-[1.02]'
                            : 'text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-md'
                        )}
                        >
                            <LayoutDashboard className={cn("w-4 h-4", selectedDimension === dim ? "text-primary" : "text-gray-200 group-hover:text-primary")} />
                            <span className="truncate">{dim}</span>
                        </button>
                    ))}
                    </div>
                </div>
            )}

            {/* Smart Filters (Drill-down) */}
            {sortedFilters.length > 0 && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Smart Filters</h3>
                        {hasAnyFilter && (
                            <button 
                                onClick={clearFilters}
                                className="text-[10px] font-bold text-primary hover:underline"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scroll">
                        {sortedFilters.map(col => {
                            const uniqueValues = Array.from(new Set(rawTable!.array(col))).filter(Boolean);
                            const activeValues = dimensionFilters[col] || [];
                            const isPrimary = col === selectedDim;
                            
                            return (
                                <div key={col} className={cn("space-y-3 p-3 rounded-[20px] transition-all", isPrimary ? "bg-primary/[0.03] border border-primary/10" : "")}>
                                    <h4 className="text-[11px] font-bold text-gray-400 flex items-center gap-2">
                                        <Filter className={cn("w-3 h-3", isPrimary ? "text-primary" : "")} /> 
                                        <span className={cn(isPrimary ? "text-gray-800" : "")}>{col}</span>
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        <button
                                            onClick={() => setDimensionFilter(col, [])}
                                            className={cn(
                                                "px-3 py-1.5 rounded-[10px] text-[10px] font-extrabold transition-all border",
                                                activeValues.length === 0 
                                                    ? "bg-gray-900 border-gray-900 text-white shadow-md shadow-black/10"
                                                    : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-600 shadow-sm"
                                            )}
                                        >
                                            All
                                        </button>
                                        {uniqueValues.map(val => {
                                            const sVal = String(val);
                                            const isActive = activeValues.includes(sVal);
                                            return (
                                                <button
                                                    key={sVal}
                                                    onClick={() => {
                                                        const next = isActive 
                                                            ? activeValues.filter(v => v !== sVal)
                                                            : [...activeValues, sVal];
                                                        setDimensionFilter(col, next);
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-[10px] text-[10px] font-bold transition-all border",
                                                        isActive 
                                                            ? "bg-primary border-primary text-white shadow-md shadow-primary/20"
                                                            : "bg-white border-gray-100 text-gray-400 hover:border-gray-300 hover:text-gray-600 shadow-sm"
                                                    )}
                                                >
                                                    {sVal}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Time Filtering */}
            {hasPeriods && (
                <div className="space-y-6">
                    <h3 className="text-[10px] font-bold text-gray-300 uppercase tracking-widest px-1">Temporal Filters</h3>
                    <div className="p-1.5 bg-gray-50/50 rounded-[20px] flex gap-1.5 border border-gray-100">
                    {PERIOD_TYPES.map(pt => (
                        <button
                        key={pt.value}
                        onClick={() => setPeriodType(pt.value)}
                        className={cn(
                            'flex-1 py-2 px-1 rounded-[14px] text-[11px] font-bold transition-all whitespace-nowrap',
                            periodType === pt.value
                            ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                            : 'text-gray-400 hover:bg-white/40'
                        )}
                        >
                        {pt.label}
                        </button>
                    ))}
                    </div>

                    <div className="flex flex-col gap-1.5 px-0.5 max-h-48 overflow-y-auto custom-scroll pr-2">
                        <button
                            onClick={() => setSelectedPeriod(null)}
                            className={cn(
                                'text-left px-4 py-2.5 rounded-[14px] text-[11px] font-bold transition-all border-none',
                                selectedPeriodKey === null
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                : 'text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-md'
                            )}
                        >
                            Full Summary
                        </button>
                        {availablePeriods.map(pe => (
                            <button
                            key={pe.sortKey}
                            onClick={() => setSelectedPeriod(pe.sortKey)}
                            className={cn(
                                'text-left px-4 py-2.5 rounded-[14px] text-[11px] font-bold transition-all border-none',
                                selectedPeriodKey === pe.sortKey
                                ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                : 'text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-md'
                            )}
                            >
                            {pe.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="pt-8 mt-auto sticky bottom-0 bg-white shadow-[0_-20px_30px_#FFF] rounded-b-[40px]">
          <div className="flex items-center gap-4 p-4 bg-[#F8F9FB] rounded-[24px] border border-gray-50">
            <div className="w-10 h-10 rounded-[14px] bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <span className="font-bold text-xs italic">EA</span>
            </div>
            <div className="flex-1 flex flex-col">
              <span className="text-[12px] font-extrabold text-gray-900 leading-tight">Elite Analytics</span>
              <span className="text-[10px] text-gray-300 font-bold uppercase tracking-tighter">Enterprise v2.5</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-200" />
          </div>
        </div>
      </div>
    </aside>
  );
}
