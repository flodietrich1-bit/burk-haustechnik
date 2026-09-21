import React, { useState, useRef, useEffect } from 'react';
import { 
  Wrench, Plus, ShieldCheck, ChevronDown, Check, Bell, AlertTriangle
} from 'lucide-react';
import type { Project, Alert } from '../types';

interface HeaderProps {
  projects: Project[];
  activeProject: Project | null;
  alerts?: Alert[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProject,
  alerts = [],
  onSelectProject,
  onOpenNewProject
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  const openAlerts = alerts.filter(a => a.status === 'open');

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setIsAlertsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#1C2A3B] text-white border-b border-slate-700 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Project Selector */}
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B82C4] to-[#2FA36B] flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Wrench className="w-5 h-5 text-white" />
          </div>

          {/* Project Switcher Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl hover:bg-slate-800/90 border border-transparent hover:border-slate-700 transition-all text-left group"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base tracking-wide text-white">BURK</span>
                  <span className="text-[10px] bg-[#3B82C4] text-white px-2 py-0.2 rounded-full font-bold">
                    TOOL-TIME
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                <div className="flex items-center space-x-2 text-xs text-slate-300 font-medium truncate max-w-[220px] sm:max-w-xs md:max-w-md">
                  <span className="text-white font-semibold truncate">
                    {activeProject?.name || 'Kein Projekt gewählt'}
                  </span>
                  {activeProject?.projectNumber && (
                    <span className="text-slate-400 font-mono text-[11px]">
                      ({activeProject.projectNumber})
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 mb-1">
                  <span>Bauvorhaben / Projekte</span>
                  <span className="text-slate-500">{projects.length} aktiv</span>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 py-1">
                  {projects.map((p) => {
                    const isSelected = p.id === activeProject?.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-start justify-between space-x-2 ${
                          isSelected
                            ? 'bg-[#3B82C4]/20 border border-[#3B82C4]/60 text-white'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div className="space-y-1 truncate">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs truncate text-white">{p.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#3B82C4] shrink-0" />}
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                            {p.projectNumber && (
                              <span className="font-mono text-slate-400">Nr: {p.projectNumber}</span>
                            )}
                            {p.location && (
                              <span className="text-slate-300">{p.location}</span>
                            )}
                          </div>
                        </div>

                        <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded shrink-0">
                          {p.totalPositions} Pos.
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-800 mt-1">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      onOpenNewProject();
                    }}
                    className="w-full flex items-center justify-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Neues Projekt anlegen</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Only New Project button, Notification Bell & Live badge */}
        <div className="flex items-center space-x-3">
          {/* Primary Action: New Project */}
          <button
            onClick={onOpenNewProject}
            className="flex items-center space-x-1.5 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Neues Projekt anlegen"
          >
            <Plus className="w-4 h-4" />
            <span>Neues Projekt</span>
          </button>

          {/* Alert Notification Bell */}
          <div className="relative" ref={alertsRef}>
            <button
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              className="relative p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
              title="Material-Überschreitungen & Alerts"
            >
              <Bell className="w-4 h-4" />
              {openAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm">
                  {openAlerts.length}
                </span>
              )}
            </button>

            {/* Alerts Dropdown Flyout */}
            {isAlertsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Akute Warnungen & Nachbestellungen
                    </span>
                  </div>
                  <span className="text-[11px] font-bold bg-red-600 text-white px-2 py-0.2 rounded-full">
                    {openAlerts.length} offen
                  </span>
                </div>

                {openAlerts.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Keine offenen Überschreitungsmeldungen.
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 py-1">
                    {openAlerts.map(alert => (
                      <div 
                        key={alert.id}
                        className="bg-slate-800/90 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-700 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white truncate mr-2">
                            {alert.roomName}
                          </span>
                          <span className="font-mono text-[#3B82C4] font-bold shrink-0">
                            Pos. {alert.materialPos}
                          </span>
                        </div>
                        <div className="text-slate-300 text-[11px] truncate">
                          {alert.materialName}
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[11px]">
                          <span className="text-red-400 font-bold">
                            +{alert.exceededBy} {alert.qu} Mehrbedarf
                          </span>
                          <span className="text-slate-400">
                            {alert.monteurName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-700 mx-0.5 hidden sm:block" />

          {/* Sync Status Badge */}
          <div className="flex items-center space-x-1.5 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full shrink-0">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden lg:inline font-medium">Firestore Live</span>
          </div>
        </div>
      </div>
    </header>
  );
};
