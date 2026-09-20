import React from 'react';
import { 
  Package, LayoutGrid, Activity, AlertCircle, BarChart3
} from 'lucide-react';

export type TabType = 'positions' | 'rooms' | 'bookings' | 'addendums' | 'analytics';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  openAddendumsCount: number;
  totalPositionsCount: number;
  totalRoomsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openAddendumsCount,
  totalPositionsCount,
  totalRoomsCount
}) => {
  const navItems = [
    {
      id: 'positions' as TabType,
      label: 'LV Material-Bilanz',
      icon: Package,
      badge: totalPositionsCount > 0 ? String(totalPositionsCount) : undefined
    },
    {
      id: 'rooms' as TabType,
      label: 'Räume & Etagen',
      icon: LayoutGrid,
      badge: totalRoomsCount > 0 ? String(totalRoomsCount) : undefined
    },
    {
      id: 'bookings' as TabType,
      label: 'Live-Buchungsfeed',
      icon: Activity
    },
    {
      id: 'addendums' as TabType,
      label: 'Nachträge / Unklar',
      icon: AlertCircle,
      badge: openAddendumsCount > 0 ? String(openAddendumsCount) : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'analytics' as TabType,
      label: 'Kennzahlen & Werte',
      icon: BarChart3
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          ToolTime Cockpit
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#3B82C4] text-white shadow-md shadow-blue-500/20'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400')
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info Box */}
      <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Backend</span>
          <span className="text-emerald-400 font-bold">Firebase</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>Projekt</span>
          <span className="text-slate-200 truncate">burk-haustechnik</span>
        </div>
      </div>
    </aside>
  );
};
