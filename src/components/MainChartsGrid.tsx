import React from 'react';
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
  } = useDashboardStore();

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
        trendSourceTable = trendSourceTable.filter(
            aq.escape((d: any) => vals.includes(String(d[col])))
        );
    }
  });

  const timeSeriesData = dateCol
    ? getTimeSeriesData(trendSourceTable, dateCol, [metric], periodType)
    : [];

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
    ? useDashboardStore.getState().availablePeriods.find((p) => p.sortKey === selectedPeriodKey)
    : null;
  const selectedLabel = selectedPeriodEntry?.label ?? 'Full summary';

  return (
    <div className="flex flex-col gap-10 pb-16">
      
      {/* ─── Main Trend Chart ─── */}
      {dateCol && (
        <Card className="p-10 border-none shadow-xl shadow-black/[0.02]">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <Title className="text-xl font-bold !text-gray-900 tracking-tight">
                {metric} performance over time
              </Title>
              <p className="text-sm text-gray-400 font-medium">
                Showing historical trends grouped by <span className="text-primary font-bold">{periodType}s</span>
              </p>
            </div>
            <div className="px-4 py-2 bg-gray-50 rounded-[14px] text-[12px] font-bold text-gray-500 uppercase tracking-widest border border-gray-100 shadow-sm">
                Full History Trend
            </div>
          </div>
          <AreaChart
            className="h-[360px] mt-4"
            data={timeSeriesData.map(d => ({ ...d, 'Time Period': d.period }))}
            index="Time Period"
            categories={[metric]}
            colors={['emerald']}
            yAxisWidth={100}
            showAnimation={true}
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
               By {stringDim}
            </Title>
            <p className="text-sm text-gray-400 font-medium">
                Top performance breakdown for <span className="text-primary font-bold">{selectedLabel}</span>
            </p>
          </div>
          <BarChart
            className="h-[320px]"
            data={barChartData}
            index="name"
            categories={[metric]}
            colors={['emerald']}
            yAxisWidth={150} 
            layout="vertical"
            showAnimation={true}
            showGridLines={false}
            valueFormatter={(number: number) => number.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          />
        </Card>

        {/* Shares Distribution (Right) - Donut with ABC Analysis */}
        <Card className="p-10 lg:col-span-2 border-none flex flex-col shadow-xl shadow-black/[0.02]">
          <div className="flex flex-col gap-1 mb-8">
            <Title className="text-xl font-bold !text-gray-900 tracking-tight text-center">
              Share Analysis
            </Title>
            <p className="text-sm text-gray-400 font-medium text-center">
                Top-10 + Other segments composition
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
                  showAnimation={true}
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
                    Growth comparison: {currentYearNum} vs {prevYearNum}
                  </Title>
                  <p className="text-sm text-gray-400 font-medium">
                    Analysis of changes in <span className="font-bold text-gray-600">{metric}</span> across <span className="text-primary font-bold">{stringDim}</span>
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
            <BarChart
              className="h-[400px] mt-4"
              data={yoyData}
              index="name"
              categories={[String(currentYearNum), String(prevYearNum)]}
              colors={['emerald', 'orange']}
              yAxisWidth={150}
              layout="vertical"
              showAnimation={true}
              showGridLines={false}
              valueFormatter={(number: number) => number.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            />
         </Card>
      )}

    </div>
  );
}
