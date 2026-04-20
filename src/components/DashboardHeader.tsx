import React from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { Clock, RefreshCw, ChevronDown, Menu, HardDrive } from 'lucide-react';
import { Button } from './ui/base';

export function DashboardHeader({ 
  onOpenMenu, 
  onOpenLibrary 
}: { 
  onOpenMenu: () => void;
  onOpenLibrary: () => void;
}) {
  const { dashboardTitle, lastUpdated, dataLoaded, setData } = useDashboardStore();
  
  const handleLogoRefresh = () => {
      // Mock refresh
      console.log("Refreshing data...");
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 sm:px-8 bg-[#F8F9FA] border-b border-gray-100 sticky top-0 z-20">
      <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
        <Button variant="ghost" className="lg:hidden p-2 h-auto flex-shrink-0" onClick={onOpenMenu}>
          <Menu className="w-5 h-5 text-gray-600" />
        </Button>
        <div className="flex flex-col min-w-0">
          <h1 className="text-base sm:text-xl font-bold text-gray-900 flex items-center gap-1.5 truncate">
            {dashboardTitle}
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </h1>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-medium text-gray-400 tracking-wide uppercase truncate">
              <span className="hidden xs:inline">Останнє оновлення: </span>{lastUpdated}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <Button variant="ghost" className="text-gray-500 h-9 px-2 sm:px-4" onClick={handleLogoRefresh}>
          <RefreshCw className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Синхронізація</span>
        </Button>
        <Button 
            variant="ghost" 
            className="lg:hidden text-gray-500 h-9 px-2" 
            onClick={onOpenLibrary}
        >
          <HardDrive className="w-4 h-4" />
        </Button>
        <Button variant="primary" className="h-9 px-3 sm:px-6 bg-gray-900 hover:bg-gray-800 text-white shadow-md text-xs sm:text-sm">
          <span className="hidden sm:inline">Звіт про експорт</span>
          <span className="sm:hidden">Експорт</span>
        </Button>
      </div>
    </header>
  );
}
