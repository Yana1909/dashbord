import React, { useState, useMemo, useEffect } from 'react';
import * as aq from 'arquero';
import {
  AreaChart,
  BarChart,
  DonutChart,
  Legend,
  Title,
} from '@tremor/react';
import { useDashboardStore } from '../store/useDashboardStore';
import { Card } from './ui/base';
import {
  getTimeSeriesData,
  getBreakdownData,
  filterByPeriod,
} from '../lib/data-engine';

const MODERN_PALETTE = [
    'emerald', 'orange', 'violet', 'cyan', 'pink', 'amber', 'rose', 'blue', 'teal', 'indigo', 
    'gray' // For 'Others'
];

export function MainChartsGrid() {
  const {
    filteredTable,
    rawTable,
    tableMetadata,
    selectedMetric,
    selectedDimension,
    periodType,
    selectedPeriodKey,
    dimensionFilters,
    availablePeriods,
  } = useDashboardStore();
  
  const [visibleCount, setVisibleCount] = useState(12); // Number of points to see at once
  const [scrollIndex, setScrollIndex] = useState(0);    // Start index for the view

  if (!rawTable || !tableMetadata) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-white rounded-[32px] border-2 border-dashed border-gray-100 italic text-gray-400">
        Waiting for data to generate insights...
      </div>
    );
  }

  const metric = selectedMetric || tableMetadata.metrics[0];
  const dateCol = tableMetadata.dateCol;
  const stringDim = selectedDimension || tableMetadata.dimensions[0] || 'Category';

  // 1. Trend Line (Apply Dimension Filters only, ignore Period for full context)
  let trendSourceTable = rawTable;
  Object.entries(dimensionFilters).forEach(([col, vals]) => {
    if (vals.length > 0) {
        try {
            const rows = trendSourceTable.objects().filter((d: any) => vals.includes(String(d[col])));
            trendSourceTable = rows.length > 0 ? aq.from(rows) : aq.from([]);
        } catch (e) {
            console.error('Filtering trendSourceTable error:', e);
        }
    }
  });

  const timeSeriesDataFull = dateCol
    ? getTimeSeriesData(trendSourceTable, dateCol, [metric], periodType)
    : [];

  const timeSeriesDataRaw = timeSeriesDataFull.map(d => ({ ...d, 'Time Period': d.period }));
  
  // Apply scrolling/windowing
  const timeSeriesData = useMemo(() => {
    if (timeSeriesDataRaw.length <= visibleCount) return timeSeriesDataRaw;
    return timeSeriesDataRaw.slice(scrollIndex, scrollIndex + visibleCount);
  }, [timeSeriesDataRaw, scrollIndex, visibleCount]);

  const maxScroll = Math.max(0, timeSeriesDataRaw.length - visibleCount);

  // Keep scroll index within bounds when data changes
  useEffect(() => {
    if (scrollIndex > maxScroll) {
      setScrollIndex(maxScroll);
    }
  }, [maxScroll, scrollIndex]);

  // 2. Breakdown Data (Filtered)
  const TOP_N = 10;
  // Use a high limit (1000) to compute 'Others' correctly
  const rawBreakdownFull = stringDim && metric
    ? getBreakdownData(filteredTable, stringDim, metric, 1000) 
    : [];

  const topN = rawBreakdownFull.slice(0, TOP_N);
  const othersValue = rawBreakdownFull.length > TOP_N 
    ? rawBreakdownFull.slice(TOP_N).reduce((acc, d) => acc + d.value, 0)
    : 0;

  const barChartData = topN.map((d) => ({
    name: d.name,
    [metric]: d.value,
  }));

  // 3. Shares (Donut) with ABC Analysis
  let donutData = topN.map((d) => ({
    name: d.name,
    amount: d.value,
  }));

  if (othersValue > 0) {
    donutData.push({
        name: 'Others',
        amount: othersValue
    });
  }

  const totalAmount = donutData.reduce((acc, d) => acc + d.amount, 0);

  // 4. YoY Data
  let yoyData: Array<Record<string, any>> = [];
  let prevYearNum: number | null = null;
  let currentYearNum: number | null = null;

  if (dateCol && metric && selectedPeriodKey) {
    const [yearStr, periodStr] = selectedPeriodKey.split('-');
    currentYearNum = parseInt(yearStr, 10);
    const periodValue = parseInt(periodStr, 10);
    prevYearNum = currentYearNum - 1;

    const curTable = filterByPeriod(rawTable, dateCol, currentYearNum, periodValue, periodType);
    const prevTable = filterByPeriod(rawTable, dateCol, prevYearNum, periodValue, periodType);

    const curBD = getBreakdownData(curTable, stringDim, metric, 8);
    const prevBD = getBreakdownData(prevTable, stringDim, metric, 8);

    const allNames = Array.from(new Set([...curBD.map(d => d.name), ...prevBD.map(d => d.name)]));
    yoyData = allNames.map(name => ({
      name,
      [`${currentYearNum}`]: curBD.find(d => d.name === name)?.value ?? 0,
      [`${prevYearNum}`]: prevBD.find(d => d.name === name)?.value ?? 0,
    }));
  }

  const selectedPeriodEntry = selectedPeriodKey
    ? availablePeriods.find((p) => p.sortKey === selectedPeriodKey)
    : null;
  const selectedLabel = selectedPeriodEntry?.label ?? 'За весь період';

  return (
    <div className="flex flex-col gap-10 pb-16">
      
      {/* ─── Main Trend Chart ─── */}
      {dateCol && (
        <Card className="p-10 border-none shadow-xl shadow-black/[0.02]">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <Title className="text-xl font-bold !text-gray-900 tracking-tight">
                Динаміка: {metric}
              </Title>
              <p className="text-sm text-gray-400 font-medium">
                Групування за <span className="text-primary font-bold">{periodType === 'month' ? 'місяцями' : periodType === 'quarter' ? 'кварталами' : 'роками'}</span>
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-3">
              <div className="px-4 py-2 bg-gray-50 rounded-[14px] text-[12px] font-bold text-gray-500 uppercase tracking-widest border border-gray-100 shadow-sm">
                  Тренд за весь час
              </div>
              {timeSeriesDataRaw.length > visibleCount && (
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest leading-none mb-1">Навігація за часом</span>
                      <span className="text-[10px] font-bold text-primary truncate">
                        {timeSeriesData[0]?.['Time Period']} — {timeSeriesData[timeSeriesData.length - 1]?.['Time Period']}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min={0} 
                      max={maxScroll} 
                      value={scrollIndex} 
                      onChange={(e) => setScrollIndex(parseInt(e.target.value, 10))}
                      className="w-40 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary hover:bg-gray-300 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <AreaChart
            className="h-[360px] mt-4"
            data={timeSeriesData}
            index="Time Period"
            categories={[metric]}
            colors={['emerald']}
            yAxisWidth={100}
            showAnimation={false} // Disable animation for smoother sliding
            showLegend={false}
            showGridLines={false}
            curveType="monotone"
            valueFormatter={(number: number) => number.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          />
        </Card>
      )}

      {/* ─── Row 2: Composition & Distribution ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 h-auto">
        
        {/* Breakdown Bar Chart (Left) */}
        <Card className="p-10 lg:col-span-3 border-none flex flex-col justify-between shadow-xl shadow-black/[0.02]">
          <div className="flex flex-col gap-1 mb-10">
            <Title className="text-xl font-bold !text-gray-900 tracking-tight">
               За категорією: {stringDim}
            </Title>
            <p className="text-sm text-gray-400 font-medium">
                Топ значень за <span className="text-primary font-bold">{selectedLabel}</span>
            </p>
          </div>
          <div key={`${metric}-${stringDim}-${selectedPeriodKey}`} className="flex-1 w-full">
            <BarChart
              className="h-[320px]"
              data={barChartData}
              index="name"
              categories={[metric]}
              colors={['emerald']}
              yAxisWidth={150} 
              layout="vertical"
              showAnimation={false}
              showGridLines={false}
              valueFormatter={(number: number) => number.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            />
          </div>
        </Card>

        {/* Shares Distribution (Right) - Donut with ABC Analysis */}
        <Card className="p-10 lg:col-span-2 border-none flex flex-col shadow-xl shadow-black/[0.02]">
          <div className="flex flex-col gap-1 mb-8">
            <Title className="text-xl font-bold !text-gray-900 tracking-tight text-center">
              Розподіл часток: {stringDim}
            </Title>
            <p className="text-sm text-gray-400 font-medium text-center">
                Склад топ-10 та інших сегментів
            </p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-10">
            <div key={`${metric}-${stringDim}-donut`} className="relative w-full aspect-square max-w-[240px]">
                <DonutChart
                  className="w-full h-full"
                  data={donutData}
                  category="amount"
                  index="name"
                  colors={MODERN_PALETTE as any}
                  showAnimation={false}
                  variant="pie"
                  valueFormatter={(number: number) => {
                    if (totalAmount === 0) return '0%';
                    const percent = (number / totalAmount) * 100;
                    return `${percent.toFixed(1)}%`;
                  }}
                />
            </div>
            <div className="w-full max-h-[120px] overflow-y-auto px-4 scrollbar-hide">
                <Legend
                  className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
                  categories={donutData.map(d => d.name)}
                  colors={MODERN_PALETTE as any}
                />
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Row 3: Growth Analysis (YoY) ─── */}
      {yoyData.length > 0 && currentYearNum && prevYearNum && (
         <Card className="p-10 border-none shadow-xl shadow-black/[0.02]">
            <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <Title className="text-xl font-bold !text-gray-900 tracking-tight">
                    Порівняння приросту: {currentYearNum} vs {prevYearNum}
                  </Title>
                  <p className="text-sm text-gray-400 font-medium">
                    Аналіз змін {metric} у розрізі «{stringDim}»
                  </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-300" />
                        <span className="text-[11px] font-bold text-gray-500">{currentYearNum}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-300" />
                        <span className="text-[11px] font-bold text-gray-500">{prevYearNum}</span>
                    </div>
                </div>
            </div>
            <div key={`${currentYearNum}-${prevYearNum}-${metric}`} className="w-full">
              <BarChart
                className="h-[400px] mt-4"
                data={yoyData}
                index="name"
                categories={[String(currentYearNum), String(prevYearNum)]}
                colors={['emerald', 'orange']}
                yAxisWidth={150}
                layout="vertical"
                showAnimation={false}
                showGridLines={false}
                valueFormatter={(number: number) => number.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              />
            </div>
         </Card>
      )}

    </div>
  );
}
