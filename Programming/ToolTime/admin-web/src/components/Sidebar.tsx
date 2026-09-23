import React from 'react';
import { 
  Package, 
  LayoutGrid, 
  Activity, 
  AlertCircle, 
  BarChart3, 
  Settings, 
  Users, 
  Download, 
  ShoppingCart,
  Building2,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';

import type { User } from '../types';
import { ADMIN_PANEL_VERSION } from '../version';

export type TabType = 
  | 'positions' 
  | 'rooms' 
  | 'bookings' 
  | 'addendums' 
  | 'reorders'
  | 'aufmass'
  | 'analytics' 
  | 'project_settings' 
  | 'users';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  openAddendumsCount: number;
  totalPositionsCount: number;
  totalRoomsCount: number;
  reordersCount?: number;
  currentUser: User | null;
  onExport: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openAddendumsCount,
  totalPositionsCount,
  totalRoomsCount,
  reordersCount = 0,
  currentUser,
  onExport
}) => {
  const projectItems = [
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
      label: 'Mehrbedarf / Unklar',
      icon: AlertCircle,
      badge: openAddendumsCount > 0 ? String(openAddendumsCount) : undefined,
      badgeColor: 'bg-amber-500 text-white'
    },
    {
      id: 'reorders' as TabType,
      label: 'Abweichungen',
      icon: ShoppingCart,
      badge: reordersCount > 0 ? String(reordersCount) : undefined,
      badgeColor: 'bg-blue-600 text-white'
    },
    {
      id: 'aufmass' as TabType,
      label: 'Aufmaß erstellen',
      icon: FileSpreadsheet
    },
    {
      id: 'analytics' as TabType,
      label: 'Kennzahlen & Werte',
      icon: BarChart3
    },
    {
      id: 'project_settings' as TabType,
      label: 'Projekteinstellungen',
      icon: Settings
    }
  ];

  const accountItems = [
    {
      id: 'users' as TabType,
      label: 'Benutzer & Rollen',
      icon: Users
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] border-r border-slate-800 p-4 shrink-0 flex flex-col justify-between select-none">
      <div className="space-y-6">
        
        {/* BLOCK 1: PROJEKT */}
        <div className="space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center space-x-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#3B82C4]" />
            <span>Projekt</span>
          </div>

          {projectItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#3B82C4] text-white shadow-md shadow-blue-500/20'
                    : 'hover:bg-slate-800/90 text-slate-300 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                    item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Action: Excel Export directly in Project menu */}
          <div className="pt-2">
            <button
              onClick={onExport}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:text-white hover:bg-emerald-600/20 border border-emerald-500/30 transition-all group"
              title="Material- und Buchungsbericht als Excel exportieren"
            >
              <div className="flex items-center space-x-2.5">
                <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Excel Export</span>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                .xlsx
              </span>
            </button>
          </div>
        </div>

        {/* BLOCK 2: ACCOUNT (Admin Only) */}
        {currentUser?.role === 'admin' && (
          <div className="space-y-1 pt-4 border-t border-slate-800">
            <div className="px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-[#2FA36B]" />
              <span>Account</span>
            </div>

            {accountItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#3B82C4] text-white shadow-md shadow-blue-500/20'
                      : 'hover:bg-slate-800/90 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      </div>

      {/* Footer Info Box */}
      <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-800 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <span>BURK HAUSTECHNIK</span>
          <span className="text-emerald-400 font-bold text-[10px] bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/40">
            Live
          </span>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-slate-400 font-medium">Version</span>
          <span className="bg-[#3B82C4]/25 text-[#60A5FA] border border-[#3B82C4]/50 px-2 py-0.5 rounded font-mono text-xs font-bold tracking-wide">
            {ADMIN_PANEL_VERSION}
          </span>
        </div>
      </div>
    </aside>
  );
};
