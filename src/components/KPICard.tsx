import React from 'react';
import { Card } from './ui/base';
import { TrendingUp, TrendingDown, LucideIcon } from 'lucide-react';
import { cn } from './ui/base';

interface KPICardProps {
  title: string;
  value: string;
  previousValue?: string;
  trend: number | null;
  icon?: LucideIcon;
  iconClassName?: string;
  suffix?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function KPICard({
  title,
  value,
  previousValue,
  trend,
  icon: Icon,
  iconClassName,
  suffix,
  isActive,
  onClick,
}: KPICardProps) {
  const hasTrend = trend !== null;
  const isPositive = hasTrend && trend! >= 0;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-7 flex flex-col gap-5 border-none transition-all duration-300',
        onClick && 'cursor-pointer',
        isActive
          ? 'ring-2 ring-primary/40 bg-primary/[0.03] scale-[1.03] shadow-lg shadow-primary/10'
          : 'hover:bg-white hover:scale-[1.01] hover:shadow-xl'
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn(
          'w-12 h-12 rounded-[18px] flex items-center justify-center transition-all duration-300',
          isActive
            ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30'
            : cn('border border-transparent', iconClassName || 'bg-primary/10 text-primary')
        )}>
          {Icon && <Icon className="w-6 h-6 stroke-[2.5px]" />}
        </div>

        {hasTrend && (
          <div className={cn(
            "flex items-center gap-1 text-[11px] font-bold transition-all",
            isPositive ? "text-emerald-500" : "text-rose-500"
          )}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {isPositive ? '+' : ''}{trend!.toFixed(1)}% <span className="font-medium text-gray-300 ml-0.5">vs last month</span>
          </div>
        )}
      </div>
      
      <div className="mt-1 space-y-1.5">
        <h4 className="text-[13px] font-semibold text-gray-400 capitalize tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
          {title}
        </h4>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-gray-900 tracking-tighter tabular-nums">
            {value}
          </span>
          {suffix && <span className="text-sm font-medium text-gray-400">{suffix}</span>}
        </div>
        {previousValue && (
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-gray-300">
                <span>Last month:</span>
                <span className="text-gray-400">{previousValue}</span>
            </div>
        )}
      </div>
    </Card>
  );
}
