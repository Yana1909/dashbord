import React from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { DollarSign, Wallet, Users, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { KPICard } from './KPICard';
import { MainChartsGrid } from './MainChartsGrid';
import { ReportLibrary } from './ReportLibrary';
import { computeMetricSummary, generateMockData } from '../lib/data-engine';

/** Pick a Lucide icon and color for the i-th KPI */
const KPI_CONFIG = [
    { icon: DollarSign, color: 'text-emerald-500 bg-emerald-50' },
    { icon: Wallet, color: 'text-orange-500 bg-orange-50' },
    { icon: BarChart3, color: 'text-violet-500 bg-violet-50' },
    { icon: Users, color: 'text-cyan-500 bg-cyan-50' }
];

export function Dashboard() {
  const {
    filteredTable,
    rawTable,
    dataLoaded,
    setData,
    tableMetadata,
    selectedMetric,
    periodType,
    selectedPeriodKey,
  } = useDashboardStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleViewSample = async () => {
    const data = generateMockData();
    await setData(data, 'Пример: Продажи компании');
  };

  // Build KPI cards for ALL metrics (not just 2)
  const metrics = tableMetadata?.metrics ?? [];
  const dateCol = tableMetadata?.dateCol ?? null;

  // Parse current period from selectedPeriodKey ("2024-03" → year=2024, period=3)
  let currentYear: number | null = null;
  let currentPeriod: number | null = null;
  if (selectedPeriodKey) {
    const [y, p] = selectedPeriodKey.split('-');
    currentYear = parseInt(y, 10);
    currentPeriod = parseInt(p, 10);
  }

  // Compute summary for each metric using rawTable (not filteredTable) for fair trend comparison
  const metricSummaries = metrics.map(m =>
    computeMetricSummary(rawTable, tableMetadata!, m, dateCol, currentYear, currentPeriod, periodType)
  );

  // Also compute unique dimension count for the filtered table
  const dim = tableMetadata?.dimensions[0];
  const uniqueDimCount = dim && filteredTable && filteredTable.numRows() > 0
    ? new Set(filteredTable.array(dim)).size
    : 0;

  return (
    <div className="flex h-screen w-full bg-[#F8F9FA] overflow-hidden relative">
      <DashboardSidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <DashboardHeader onOpenMenu={() => setIsMobileMenuOpen(true)} />

        <div className="flex-1 overflow-y-auto px-8 pt-6">
          {!dataLoaded ? (
            <div className="h-full flex flex-col items-center justify-center gap-6 pb-20">
              <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-xl flex flex-col items-center gap-4 max-w-md text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <BarChart3 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Добро пожаловать</h2>
                <p className="text-gray-500 text-sm">
                  Загрузите Excel-файл слева, чтобы сгенерировать интерактивный дашборд с динамикой показателей.
                </p>
                <div className="w-full h-[1px] bg-gray-100 my-2" />
                <div
                  onClick={handleViewSample}
                  className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest cursor-pointer group hover:opacity-80 transition-opacity"
                >
                  Посмотреть пример
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-8 pb-10"
            >
              {/* KPI row — один KPI на каждую метрику */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {metricSummaries.slice(0, 4).map((ms, idx) => {
                  const config = KPI_CONFIG[idx % KPI_CONFIG.length];
                  return (
                    <KPICard
                        key={ms.name}
                        title={ms.name}
                        value={ms.current.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        previousValue={ms.previous > 0 ? ms.previous.toLocaleString('en-US', { maximumFractionDigits: 0 }) : undefined}
                        trend={ms.trend}
                        icon={config.icon}
                        iconClassName={config.color}
                        isActive={selectedMetric === ms.name}
                        onClick={() => useDashboardStore.getState().setSelectedMetric(ms.name)}
                    />
                  );
                })}
                {/* Unique dimension count card */}
                {dim && (
                  <KPICard
                    title={`Унікальних ${dim}`}
                    value={uniqueDimCount.toLocaleString('en-US')}
                    trend={null}
                    icon={Users}
                    iconClassName="text-indigo-500 bg-indigo-50"
                  />
                )}
              </div>

              {/* Charts */}
              <MainChartsGrid />
            </motion.div>
          )}
        </div>
      </main>

      <ReportLibrary />
    </div>
  );
}
