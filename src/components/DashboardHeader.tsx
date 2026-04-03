import React from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { Clock, RefreshCw, ChevronDown, Menu } from 'lucide-react';
import { Button } from './ui/base';

export function DashboardHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { dashboardTitle, lastUpdated, dataLoaded, setData } = useDashboardStore();
  
  const handleLogoRefresh = () => {
      // Mock refresh
      console.log("Refreshing data...");
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-[#F8F9FA] border-b border-gray-100">
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="lg:hidden p-2 h-auto" onClick={onOpenMenu}>
          <Menu className="w-5 h-5 text-gray-600" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            {dashboardTitle}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </h1>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-[10px] font-medium text-gray-400 tracking-wide uppercase">
              Last updated: {lastUpdated}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="text-gray-500 h-9" onClick={handleLogoRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync
        </Button>
        <Button variant="primary" className="h-9 px-6 bg-gray-900 hover:bg-gray-800 text-white shadow-md">
          Export Report
        </Button>
      </div>
    </header>
  );
}
