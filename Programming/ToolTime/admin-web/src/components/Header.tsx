import React, { useState, useRef, useEffect } from 'react';
import { 
  Wrench, Plus, ShieldCheck, ChevronDown, Check, Bell, AlertTriangle, LogOut, KeyRound, HardHat
} from 'lucide-react';
import type { Project, Alert, User } from '../types';

interface HeaderProps {
  projects: Project[];
  activeProject: Project | null;
  currentUser: User | null;
  alerts?: Alert[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onOpenChangePassword?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProject,
  currentUser,
  alerts = [],
  onSelectProject,
  onOpenNewProject,
  onOpenChangePassword,
  onLogout
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-[#1C2A3B] text-white border-b border-slate-700 sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand: Links soll nur dran stehen BURK ToolTime */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#3B82C4] to-[#2FA36B] flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-lg tracking-wide text-white">BURK</span>
            <span className="text-[11px] bg-[#3B82C4] text-white px-2 py-0.5 rounded-full font-bold">
              ToolTime
            </span>
          </div>
        </div>

        {/* Right Side: Projektname (+ Dropdown) links, daneben Neues Projekt Button rechts, Alerts, Live, User */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {/* Projektname & kleines Dropdown bei mehreren Projekten (links) */}
          {projects.length > 1 ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all text-left group shadow-sm cursor-pointer"
                title="Projekt wechseln"
              >
                <div className="flex items-center space-x-1.5 truncate max-w-[130px] sm:max-w-[180px] md:max-w-[240px]">
                  <span className="text-xs font-bold text-white truncate">
                    {activeProject?.name || 'Projekt wählen'}
                  </span>
                  {activeProject?.projectNumber && (
                    <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                      ({activeProject.projectNumber})
                    </span>
                  )}
                </div>
                <div className="flex items-center pl-1 border-l border-slate-700/80 shrink-0">
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 mb-1">
                    <span>Projekt wechseln</span>
                    <span className="text-slate-500">{projects.length} vorhanden</span>
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
                          className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between space-x-2 cursor-pointer ${
                            isSelected
                              ? 'bg-[#3B82C4]/20 border border-[#3B82C4]/60 text-white shadow-inner'
                              : 'hover:bg-slate-800/80 text-slate-300 hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="space-y-0.5 truncate">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs truncate text-white">{p.name}</span>
                              {isSelected && (
                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold flex items-center space-x-1 shrink-0">
                                  <Check className="w-3 h-3" />
                                  <span>Aktiv</span>
                                </span>
                              )}
                            </div>
                            {p.projectNumber && (
                              <span className="text-[10px] font-mono text-slate-400 block">
                                Nr: {p.projectNumber}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded shrink-0">
                            {p.totalPositions} Pos.
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {currentUser?.role === 'admin' && (
                    <div className="pt-2 border-t border-slate-800 mt-1">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onOpenNewProject();
                        }}
                        className="w-full flex items-center justify-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Neues Projekt anlegen</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Einzelnes Projekt: Nur Projektname ohne Dropdown (links) */
            activeProject && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs shadow-xs">
                <span className="font-bold text-white truncate max-w-[130px] sm:max-w-[200px] md:max-w-[260px]">
                  {activeProject.name}
                </span>
                {activeProject.projectNumber && (
                  <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                    ({activeProject.projectNumber})
                  </span>
                )}
              </div>
            )
          )}

          {/* Rechts daneben: Button Neues Projekt (Only Admin) */}
          {currentUser?.role === 'admin' && (
            <button
              onClick={onOpenNewProject}
              className="flex items-center space-x-1.5 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
              title="Neues Projekt anlegen"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Neues Projekt</span>
              <span className="sm:hidden">Neu</span>
            </button>
          )}

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
            <span className="hidden xl:inline font-medium">Firestore Live</span>
          </div>

          {/* User Profile Menu */}
          {currentUser && (
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2.5 p-1.5 pr-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 transition-all text-left cursor-pointer group"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner ${
                  currentUser.role === 'admin' 
                    ? 'bg-blue-500/20 text-[#3B82C4] border border-blue-500/40' 
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                }`}>
                  {currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <HardHat className="w-4 h-4" />
                  )}
                </div>

                <div className="hidden sm:block text-left">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-white truncate max-w-[120px]">
                      {currentUser.name}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 group-hover:text-white transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                    currentUser.role === 'admin' ? 'text-blue-400' : 'text-amber-400'
                  }`}>
                    {currentUser.role === 'admin' ? 'Eigentümer / Admin' : 'Bauleiter'}
                  </span>
                </div>
              </button>

              {/* Profile Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3 border-b border-slate-800 mb-1">
                    <span className="text-xs font-bold text-white block">
                      {currentUser.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      {currentUser.email || 'Keine E-Mail'}
                    </span>
                    <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      currentUser.role === 'admin' 
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {currentUser.role === 'admin' ? 'Eigentümer / Administrator' : 'Zuständiger Bauleiter'}
                    </span>
                  </div>

                  <div className="space-y-1 py-1">
                    {/* Change Password Button */}
                    {onOpenChangePassword && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          onOpenChangePassword();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-left cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-[#3B82C4]" />
                        <span>Passwort ändern</span>
                      </button>
                    )}

                    {/* Logout Button */}
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Abmelden</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
