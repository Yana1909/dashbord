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
    dimTable,
    tableMetadata,
    selectedMetric,
    selectedDimension,
    periodType,
    selectedPeriodKey,
    dimensionFilters,
    availablePeriods,
  } = useDashboardStore();
  
  // Dynamic visible count based on period type
  const visibleCount = useMemo(() => {
    if (periodType === 'month') return 24;    // 2 years
    if (periodType === 'quarter') return 8;   // 2 years (8 quarters)
    return 5;                                // 5 years
  }, [periodType]);

  const [scrollIndex, setScrollIndex] = useState(0);

  if (!dimTable || !tableMetadata) {
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
  const timeSeriesDataFull = useMemo(() => {
    return dateCol && dimTable
      ? getTimeSeriesData(dimTable, dateCol, [metric], periodType)
      : [];
  }, [dimTable, dateCol, metric, periodType]);

  const timeSeriesDataRaw = useMemo(() => 
    timeSeriesDataFull.map(d => ({ ...d, 'Time Period': d.period })),
    [timeSeriesDataFull]
  );

  const maxScroll = Math.max(0, timeSeriesDataRaw.length - visibleCount);
  
  // Apply scrolling/windowing
  const timeSeriesData = useMemo(() => {
    if (timeSeriesDataRaw.length <= visibleCount) return timeSeriesDataRaw;
    const safeIndex = Math.min(scrollIndex, maxScroll);
    return timeSeriesDataRaw.slice(safeIndex, safeIndex + visibleCount);
  }, [timeSeriesDataRaw, scrollIndex, visibleCount, maxScroll]);

  // AUTO-SCROLL to selected period
  useEffect(() => {
    if (selectedPeriodKey && timeSeriesDataRaw.length > visibleCount) {
        // Try to find the index of the selected period in the raw data
        // Key format: "2024-03"
        const [y, p] = selectedPeriodKey.split('-');
        const year = parseInt(y, 10);
        const period = parseInt(p, 10);
        const label = periodType === 'month' 
            ? `${['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'][period-1]} ${year}`
            : periodType === 'quarter'
            ? `Q${period} ${year}`
            : String(year);
        
        const index = timeSeriesDataRaw.findIndex(d => d.period === label);
        if (index !== -1) {
            // Center the selected point OR at least make sure it's in the window
            // Setting it to be toward the end of the window usually feels natural
            const newScroll = Math.max(0, Math.min(index - Math.floor(visibleCount / 2), maxScroll));
            setScrollIndex(newScroll);
        }
    }
  }, [selectedPeriodKey, timeSeriesDataRaw, visibleCount, maxScroll, periodType]);

  // Keep scroll index within bounds when data changes
  useEffect(() => {
    if (scrollIndex > maxScroll) {
      setScrollIndex(maxScroll);
    }
  }, [maxScroll, scrollIndex]);

  const TOP_N = 10;

  // 2. Breakdown Data (Smart Dimension Switching)
  const { barChartData, donutData, totalAmount, breakdownDim, breakdownTitle } = useMemo(() => {
    // Detect if the current stringDim is filtered to a single value
    const activeFilters = dimensionFilters[stringDim] || [];
    const isFiltered = activeFilters.length === 1;
    const singleValue = activeFilters[0];

    // If filtered to one value, pivot to the next dimension for more insights
    let targetDim = stringDim;
    let title = `За категорією: ${stringDim}`;
    
    if (isFiltered) {
        const nextDim = tableMetadata.dimensions.find(d => d !== stringDim && (dimensionFilters[d] || []).length === 0);
        if (nextDim) {
            targetDim = nextDim;
            title = `${nextDim} для: ${singleValue}`;
        }
    }

    const rawBreakdownFull = targetDim && metric
      ? getBreakdownData(filteredTable, targetDim, metric, 1000) 
      : [];

    const topN = rawBreakdownFull.slice(0, TOP_N);
    const othersValue = rawBreakdownFull.length > TOP_N 
      ? rawBreakdownFull.slice(TOP_N).reduce((acc, d) => acc + d.value, 0)
      : 0;

    const bcd = topN.map((d) => ({
      name: d.name,
      [metric]: d.value,
    }));

    const dd = topN.map((d) => ({
      name: d.name,
      amount: d.value,
    }));

    if (othersValue > 0) {
      dd.push({
          name: 'Інші',
          amount: othersValue
      });
    }

    const total = dd.reduce((acc, d) => acc + d.amount, 0);

    return { 
        barChartData: bcd, 
        donutData: dd, 
        totalAmount: total, 
        breakdownDim: targetDim,
        breakdownTitle: title
    };
  }, [filteredTable, stringDim, metric, tableMetadata.dimensions, dimensionFilters]);

  // 4. YoY Data (Intelligent Drill-down)
  const { yoyData, currentYearNum, prevYearNum, isDrillDown, yoyTitle, yoySubtitle } = useMemo(() => {
    if (!dateCol || !metric || !selectedPeriodKey || !dimTable) {
      return { yoyData: [], currentYearNum: null, prevYearNum: null, isDrillDown: false, yoyTitle: '', yoySubtitle: '' };
    }

    const [yearStr, periodStr] = selectedPeriodKey.split('-');
    const curYear = parseInt(yearStr, 10);
    const pValue = parseInt(periodStr, 10);
    const pYear = curYear - 1;

    // DRILL-DOWN DETECTION:
    // If ANY dimension is filtered to ONE value, we show its dynamics.
    // However, if the currently SELECTED dimension has 1 value, that's the primary indicator.
    const activeFilters = dimensionFilters[stringDim] || [];
    let isSingle = activeFilters.length === 1;
    let singleValue = activeFilters[0];

    // Fallback: If current dimension is not filtered, but another one is
    if (!isSingle) {
        const otherSingle = Object.entries(dimensionFilters).find(([_, vals]) => vals.length === 1);
        if (otherSingle) {
            isSingle = true;
            singleValue = otherSingle[1][0];
        }
    }

    if (isSingle) {
      // DRILL-DOWN MODE: Show time dynamics (Monthly) for the focus item
      const curYearTable = filterByPeriod(dimTable, dateCol, curYear, null, 'year');
      const prevYearTable = filterByPeriod(dimTable, dateCol, pYear, null, 'year');

      const curTS = getTimeSeriesData(curYearTable, dateCol, [metric], 'month');
      const prevTS = getTimeSeriesData(prevYearTable, dateCol, [metric], 'month');

      const monthNames = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
      const data = monthNames.map(mName => {
          const curPoint = curTS.find(d => d.period.startsWith(mName));
          const prevPoint = prevTS.find(d => d.period.startsWith(mName));
          return {
              name: mName,
              [`${curYear}`]: curPoint?.[metric] ?? 0,
              [`${pYear}`]: prevPoint?.[metric] ?? 0,
          };
      });

      return { 
        yoyData: data, 
        currentYearNum: curYear, 
        prevYearNum: pYear,
        isDrillDown: true,
        yoyTitle: `Динаміка: ${singleValue}`,
        yoySubtitle: `Порівняння ${curYear} vs ${pYear} по місяцях`
      };
    } else {
      // BREAKDOWN MODE: Compare categories within the selected period
      const curTable = filterByPeriod(dimTable, dateCol, curYear, pValue, periodType);
      const prevTable = filterByPeriod(dimTable, dateCol, pYear, pValue, periodType);

      const curBD = getBreakdownData(curTable, stringDim, metric, 8);
      const prevBD = getBreakdownData(prevTable, stringDim, metric, 8);

      const allNames = Array.from(new Set([...curBD.map(d => d.name), ...prevBD.map(d => d.name)]));
      const data = allNames.map(name => ({
        name,
        [`${curYear}`]: curBD.find(d => d.name === name)?.value ?? 0,
        [`${pYear}`]: prevBD.find(d => d.name === name)?.value ?? 0,
      }));

      return { 
        yoyData: data, 
        currentYearNum: curYear, 
        prevYearNum: pYear,
        isDrillDown: false,
        yoyTitle: `Порівняння приросту: ${curYear} vs ${pYear}`,
        yoySubtitle: `Аналіз змін ${metric} у розрізі «${stringDim}»`
      };
    }
  }, [dimTable, dateCol, metric, selectedPeriodKey, stringDim, periodType, dimensionFilters]);

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
                Динаміка: <span>{metric}</span>
              </Title>
              <p className="text-sm text-gray-400 font-medium">
                Групування за <span className="text-primary font-bold">
                  {periodType === 'month' ? 'місяцями' : periodType === 'quarter' ? 'кварталами' : 'роками'}
                </span>
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
               {breakdownTitle}
            </Title>
            <p className="text-sm text-gray-400 font-medium">
                Топ значень за <span className="text-primary font-bold">{selectedLabel}</span>
            </p>
          </div>
          <div className="flex-1 w-full">
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
              Розподіл часток: <span>{breakdownDim}</span>
            </Title>
            <p className="text-sm text-gray-400 font-medium text-center">
                Склад сегментів для обраного фільтра
            </p>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-10">
            <div className="relative w-full aspect-square max-w-[240px]">
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
                    {yoyTitle}
                  </Title>
                  <p className="text-sm text-gray-400 font-medium">
                    {yoySubtitle}
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
            <div className="w-full">
              <BarChart
                className="h-[400px] mt-4"
                data={yoyData}
                index="name"
                categories={[String(currentYearNum), String(prevYearNum)]}
                colors={['emerald', 'orange']}
                yAxisWidth={150}
                layout={isDrillDown ? "horizontal" : "vertical"}
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
