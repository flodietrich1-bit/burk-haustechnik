import React, { useState, useRef, useEffect } from 'react';
import { 
  Wrench, Search, Download, Plus, ShieldCheck, ChevronDown, Building2, MapPin, Calendar, Check, Bell, AlertTriangle
} from 'lucide-react';
import type { Project, Alert } from '../types';

interface HeaderProps {
  projects: Project[];
  activeProject: Project | null;
  alerts?: Alert[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenImport,
  onExport,
  searchTerm,
  onSearchChange,
  alerts = []
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

  const formatDateRange = (start?: string, end?: string) => {
    if (!start && !end) return null;
    const format = (d: string) => {
      const parts = d.split('-');
      return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0].slice(2)}` : d;
    };
    if (start && end) return `${format(start)} – ${format(end)}`;
    return start ? `ab ${format(start)}` : `bis ${format(end!)}`;
  };

  const dateRangeStr = formatDateRange(activeProject?.startDate, activeProject?.endDate);

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
                <div className="flex items-center space-x-2 text-xs text-slate-300 font-medium truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
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
                    const pDates = formatDateRange(p.startDate, p.endDate);
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
                              <span className="flex items-center space-x-1 text-slate-300">
                                <MapPin className="w-3 h-3 text-[#3B82C4]" />
                                <span>{p.location}</span>
                              </span>
                            )}
                            {pDates && (
                              <span className="flex items-center space-x-1 text-slate-400">
                                <Calendar className="w-3 h-3" />
                                <span>{pDates}</span>
                              </span>
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

        {/* Project Context Badges (Location, Dates) */}
        <div className="hidden xl:flex items-center space-x-3 text-xs">
          {activeProject?.location && (
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-200 font-medium">
              <MapPin className="w-3.5 h-3.5 text-[#3B82C4]" />
              <span>Standort: <strong className="text-white">{activeProject.location}</strong></span>
            </div>
          )}
          {dateRangeStr && (
            <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-200 font-medium">
              <Calendar className="w-3.5 h-3.5 text-[#2FA36B]" />
              <span>Zeitraum: <strong className="text-white">{dateRangeStr}</strong></span>
            </div>
          )}
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex flex-1 max-w-xs lg:max-w-sm mx-4 relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Position, Materialname, DN 100..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3B82C4] transition-all"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* Primary Action: New Project */}
          <button
            onClick={onOpenNewProject}
            className="flex items-center space-x-1.5 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
            title="Neues Projekt anlegen & GAEB einlesen"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Neues Projekt</span>
          </button>

          {/* GAEB Upload to current project */}
          <button
            onClick={onOpenImport}
            className="hidden sm:flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
            title="GAEB-Datei in aktives Projekt importieren"
          >
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>GAEB Import</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={onExport}
            className="flex items-center space-x-1.5 bg-[#2FA36B] hover:bg-[#258757] text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Excel Export</span>
          </button>

          {/* Alert Notification Bell */}
          <div className="relative" ref={alertsRef}>
            <button
              onClick={() => setIsAlertsOpen(!isAlertsOpen)}
              className="relative p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
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
                            +{alert.exceededBy} {alert.qu} Mehraufwand
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

          <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block" />

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
