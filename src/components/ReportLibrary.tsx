import React, { useEffect } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { FileText, Trash2, Clock, CheckCircle2, ChevronRight, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, Button } from './ui/base';

export function ReportLibrary() {
  const { 
    savedReports, 
    loadSavedReports, 
    selectReport, 
    deleteReport, 
    dashboardId 
  } = useDashboardStore();

  useEffect(() => {
    loadSavedReports();
  }, [loadSavedReports]);

  return (
    <div className="w-[320px] h-full bg-white border-l border-gray-100 flex flex-col shadow-2xl shadow-black/[0.02]">
      <div className="p-6 border-b border-gray-50 bg-gray-50/30">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
            <HardDrive className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">Бібліотека звітів</h2>
        </div>
        <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider ml-10">
          Збережені документи ({savedReports.length})
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-3">
        {savedReports.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-50 rounded-3xl">
            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
               <FileText className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-400">Звітів поки немає</p>
            <p className="text-[11px] text-gray-300 mt-1">Завантажте файл, щоб побачити його тут</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {savedReports.map((report) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={report.id}
                className={cn(
                  "group relative p-4 rounded-2xl transition-all border-2 cursor-pointer",
                  dashboardId === report.id
                    ? "bg-primary/5 border-primary shadow-sm"
                    : "bg-white border-transparent hover:border-gray-100 hover:shadow-lg hover:shadow-black/5"
                )}
                onClick={() => selectReport(report.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                    dashboardId === report.id ? "bg-primary text-white" : "bg-gray-50 text-gray-400"
                  )}>
                    {report.logoUrl ? (
                      <img src={report.logoUrl} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-6">
                    <h3 className={cn(
                      "text-[13px] font-bold truncate mb-1",
                      dashboardId === report.id ? "text-gray-900" : "text-gray-700"
                    )}>
                      {report.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-semibold">
                      <Clock className="w-3 h-3" />
                      {report.updated}
                    </div>
                  </div>

                  {dashboardId === report.id && (
                    <div className="absolute top-4 right-4">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this report?')) deleteReport(report.id);
                    }}
                    className="absolute bottom-4 right-4 p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                   <div className="flex -space-x-1">
                      {[1,2,3].map(i => (
                        <div key={i} className="w-3 h-3 rounded-full border-2 border-white bg-gray-100" />
                      ))}
                   </div>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-primary group-hover:translate-x-1 transition-transform">
                      Переглянути метрики
                      <ChevronRight className="w-3 h-3" />
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="p-6 bg-gray-50/50 border-t border-gray-50 mt-auto">
        <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
           <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">СИНХРОНІЗАЦІЯ З ХМАРОЮ</p>
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-700">Спільна робота в режимі реального часу</span>
           </div>
           <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
             Аналітики можуть завантажувати звіти сюди. Зміни миттєво стають доступні всім.
           </p>
        </div>
      </div>
    </div>
  );
}
