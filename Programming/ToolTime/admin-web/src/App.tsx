import { useState, useEffect, useMemo } from 'react';
import { FolderPlus, Plus } from 'lucide-react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import type { TabType } from './components/Sidebar';
import { MaterialTable } from './components/MaterialTable';
import { GaebVsDwgView } from './components/GaebVsDwgView';
import { RoomManager } from './components/RoomManager';
import { LiveFeed } from './components/LiveFeed';
import { AddendumsView } from './components/AddendumsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ReordersView } from './components/ReordersView';
import { AufmassView } from './components/AufmassView';
import { ProjectSettingsView } from './components/ProjectSettingsView';
import { UserManagementView } from './components/UserManagementView';
import { GaebUploader } from './components/GaebUploader';
import { NewProjectModal } from './components/NewProjectModal';
import { LoginView } from './components/LoginView';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { DeleteProjectConfirmModal } from './components/DeleteProjectConfirmModal';
import { exportMaterialReportToExcel } from './services/excelExporter';
import { 
  DEFAULT_PROJECT_ID,
  listenToProjects,
  listenToProject,
  listenToPositions,
  listenToRooms,
  listenToBookings,
  listenToAddendums,
  listenToAlerts,
  listenToUsers,
  getCurrentAuthUser,
  setCurrentAuthUser,
  getLocalUsers,
  getLocalProjects,
  getMaterialActualQty,
  deleteProject
} from './services/firestoreService';
import type { Project, Position, Room, Booking, Addendum, Alert, User } from './types';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentAuthUser());
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>(() => getLocalProjects());
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    const saved = localStorage.getItem('burk_tooltime_active_project_id');
    if (saved) return saved;
    const initial = getLocalProjects();
    return initial.length > 0 ? initial[0].id : DEFAULT_PROJECT_ID;
  });

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [addendums, setAddendums] = useState<Addendum[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<User[]>(() => getLocalUsers());

  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [searchTerm] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false);

  // 1. Listen to all projects & users
  useEffect(() => {
    const unsubProjects = listenToProjects((list) => {
      setProjects(list);
    });

    const unsubUsers = listenToUsers((list) => {
      setUsers(list);
    });

    return () => {
      unsubProjects();
      unsubUsers();
    };
  }, []);

  // Compute accessible projects based on current user role (including deputy managers when primary is on leave)
  const accessibleProjects = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return projects;
    return projects.filter(p => {
      // 1. Primary project manager or deputy project manager
      const matchPmId = p.projectManagerId === currentUser.id || p.deputyProjectManagerId === currentUser.id;
      const matchPmEmail = Boolean(
        (p.projectManagerEmail && currentUser.email && p.projectManagerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (p.deputyProjectManagerEmail && currentUser.email && p.deputyProjectManagerEmail.toLowerCase() === currentUser.email.toLowerCase())
      );
      const matchPmName = Boolean(
        (p.projectManager && currentUser.name && p.projectManager.toLowerCase().includes(currentUser.name.toLowerCase())) ||
        (p.deputyProjectManager && currentUser.name && p.deputyProjectManager.toLowerCase().includes(currentUser.name.toLowerCase()))
      );

      // 2. Primary commercial manager or deputy commercial manager
      const matchCmId = p.commercialManagerId === currentUser.id || p.deputyCommercialManagerId === currentUser.id;
      const matchCmEmail = Boolean(
        (p.commercialManagerEmail && currentUser.email && p.commercialManagerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (p.deputyCommercialManagerEmail && currentUser.email && p.deputyCommercialManagerEmail.toLowerCase() === currentUser.email.toLowerCase())
      );
      const matchCmName = Boolean(
        (p.commercialManager && currentUser.name && p.commercialManager.toLowerCase().includes(currentUser.name.toLowerCase())) ||
        (p.deputyCommercialManager && currentUser.name && p.deputyCommercialManager.toLowerCase().includes(currentUser.name.toLowerCase()))
      );

      return matchPmId || matchPmEmail || matchPmName || matchCmId || matchCmEmail || matchCmName;
    });
  }, [projects, currentUser]);

  // Keep selected project aligned with accessible projects
  useEffect(() => {
    if (!currentUser) return;
    if (accessibleProjects.length > 0) {
      if (!selectedProjectId || !accessibleProjects.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(accessibleProjects[0].id);
      }
    } else {
      setSelectedProjectId('');
      setActiveProject(null);
    }
  }, [accessibleProjects, selectedProjectId, currentUser]);

  // Guard against non-admin accessing 'users' tab
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin' && activeTab === 'users') {
      setActiveTab('positions');
    }
  }, [currentUser, activeTab]);

  // 2. Listen to active project data whenever selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) {
      localStorage.removeItem('burk_tooltime_active_project_id');
      setActiveProject(null);
      setPositions([]);
      setRooms([]);
      setBookings([]);
      setAddendums([]);
      setAlerts([]);
      return;
    }

    localStorage.setItem('burk_tooltime_active_project_id', selectedProjectId);

    const unsubProject = listenToProject(selectedProjectId, setActiveProject);
    const unsubPositions = listenToPositions(selectedProjectId, setPositions);
    const unsubRooms = listenToRooms(selectedProjectId, setRooms);
    const unsubBookings = listenToBookings(selectedProjectId, setBookings);
    const unsubAddendums = listenToAddendums(selectedProjectId, setAddendums);
    const unsubAlerts = listenToAlerts(selectedProjectId, setAlerts);

    return () => {
      unsubProject();
      unsubPositions();
      unsubRooms();
      unsubBookings();
      unsubAddendums();
      unsubAlerts();
    };
  }, [selectedProjectId]);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
  };

  const handleProjectCreated = (newProjectId: string) => {
    setSelectedProjectId(newProjectId);
    setActiveTab('positions');
  };

  const handleExport = () => {
    exportMaterialReportToExcel(
      activeProject?.name || 'Hallenbad Weingarten',
      positions,
      bookings,
      rooms,
      alerts,
      addendums
    );
  };

  const handleRequestDeleteProject = () => {
    if (!activeProject) return;
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteProject = async () => {
    if (!activeProject) return;
    setIsDeletingProject(true);
    const deletedId = activeProject.id;
    try {
      // 1. Immediate optimistic UI update
      setProjects(prev => prev.filter(p => p.id !== deletedId));
      setIsDeleteModalOpen(false);

      const remaining = accessibleProjects.filter(p => p.id !== deletedId);
      if (remaining.length > 0) {
        setSelectedProjectId(remaining[0].id);
        setActiveProject(remaining[0]);
      } else {
        setSelectedProjectId('');
        setActiveProject(null);
      }

      // 2. Perform background delete in Firestore & local caches
      await deleteProject(deletedId);
    } catch (err: any) {
      console.error('Fehler beim Löschen des Projekts:', err);
      alert('Fehler beim Löschen des Projekts: ' + (err?.message || err));
    } finally {
      setIsDeletingProject(false);
    }
  };

  const openAddendumsCount = addendums.filter(a => a.status === 'pending').length;
  
  // Reorders and deviation count (distinct positions with overconsumption or active alert)
  const reordersCount = useMemo(() => {
    const deviationPositions = new Set<string>();
    rooms.forEach(room => {
      (room.materials || []).forEach(m => {
        const actual = getMaterialActualQty(m, room, bookings);
        const planned = Number(m.plannedQty) || 0;
        if (actual > planned) {
          deviationPositions.add(m.posNr || m.positionId || m.shortText);
        }
      });
    });
    alerts.forEach(a => {
      if (a.status === 'open' || a.status === 'reordered') {
        deviationPositions.add(a.materialPos || a.materialId || a.materialName);
      }
    });
    return deviationPositions.size;
  }, [rooms, bookings, alerts]);

  // GAEB vs DWG deviations count (positions where verplante Menge in Räumen != GAEB LV-Menge)
  const gaebVsDwgDeviationsCount = useMemo(() => {
    let count = 0;
    positions.forEach(pos => {
      const gaebQty = Number(pos.qty) || 0;
      let dwgQty = 0;
      rooms.forEach(r => {
        (r.materials || []).forEach(m => {
          const isMatch = 
            (m.positionId && m.positionId === pos.id) ||
            (m.posNr && m.posNr === pos.posNr) ||
            (m.shortText && pos.shortText && m.shortText.trim().toLowerCase() === pos.shortText.trim().toLowerCase());
          if (isMatch) {
            dwgQty += Number(m.plannedQty) || 0;
          }
        });
      });
      // Wenn in den Räumen verplant und es weicht vom GAEB-Soll ab
      if (dwgQty > 0 && dwgQty !== gaebQty) {
        count++;
      }
    });
    return count;
  }, [positions, rooms]);

  if (!currentUser) {
    return (
      <LoginView
        users={users}
        onLogin={(user) => {
          setCurrentUser(user);
          setCurrentAuthUser(user);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Top Navigation: Streamlined with Project Switcher, New Project & Alerts */}
      <Header
        projects={accessibleProjects}
        activeProject={activeProject}
        currentUser={currentUser}
        alerts={alerts}
        onSelectProject={handleSelectProject}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={() => {
          setCurrentUser(null);
          setCurrentAuthUser(null);
        }}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden max-w-[1920px] w-full mx-auto">
        {/* Sidebar with PROJEKT and ACCOUNT categories */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          openAddendumsCount={openAddendumsCount}
          totalPositionsCount={positions.length}
          totalRoomsCount={rooms.length}
          reordersCount={reordersCount}
          gaebVsDwgDeviationsCount={gaebVsDwgDeviationsCount}
          currentUser={currentUser}
          onExport={handleExport}
          hasActiveProject={Boolean(activeProject)}
          onDeleteProject={handleRequestDeleteProject}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="w-full space-y-6">
            
            {/* If no project is selected and not on User-Admin tab */}
            {!activeProject && activeTab !== 'users' ? (
              <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-14 text-center max-w-2xl mx-auto shadow-sm space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#3B82C4] flex items-center justify-center mx-auto shadow-inner">
                  <FolderPlus className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                    Kein aktives Bauvorhaben
                  </h2>
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                    Alle Testdaten wurden geleert. Sie können jetzt ein komplett frisches Projekt (z. B. das Einfamilienhaus) in 3 einfachen Schritten anlegen.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setIsNewProjectOpen(true)}
                    className="inline-flex items-center space-x-2 bg-[#3B82C4] hover:bg-[#2B6EB0] text-white px-7 py-3.5 rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Neues Projekt anlegen (3 Schritte)</span>
                  </button>
                </div>
              </div>
            ) : (
              <>

                {/* TAB: Positions */}
                {activeTab === 'positions' && (
                  <MaterialTable
                    positions={positions}
                    bookings={bookings}
                    rooms={rooms}
                    searchTerm={searchTerm}
                  />
                )}

                {/* TAB: GAEB vs DWG (Planungsvergleich) */}
                {activeTab === 'gaeb_vs_dwg' && (
                  <GaebVsDwgView
                    projectId={selectedProjectId}
                    projectName={activeProject?.name}
                    positions={positions}
                    rooms={rooms}
                    currentUser={currentUser}
                    onNavigateToAddendums={() => setActiveTab('addendums')}
                  />
                )}

                {/* TAB: Rooms & Floors */}
                {activeTab === 'rooms' && (
                  <RoomManager
                    projectId={selectedProjectId}
                    projectName={activeProject?.name}
                    rooms={rooms}
                    positions={positions}
                    bookings={bookings}
                  />
                )}

                {/* TAB: Bookings Live Feed */}
                {activeTab === 'bookings' && (
                  <LiveFeed
                    bookings={bookings}
                    rooms={rooms}
                    positions={positions}
                  />
                )}

                {/* TAB: Addendums */}
                {activeTab === 'addendums' && (
                  <AddendumsView
                    addendums={addendums}
                    projectId={selectedProjectId}
                    project={activeProject}
                    rooms={rooms}
                    positions={positions}
                    bookings={bookings}
                  />
                )}

                {/* TAB: Reorders Log (NEW) */}
                {activeTab === 'reorders' && (
                  <ReordersView
                    projectId={selectedProjectId}
                    projectName={activeProject?.name || 'Neues Projekt'}
                    rooms={rooms}
                    positions={positions}
                    bookings={bookings}
                    alerts={alerts}
                    project={activeProject}
                  />
                )}

                {/* TAB: Aufmaß erstellen (NEW) */}
                {activeTab === 'aufmass' && (
                  <AufmassView
                    projectId={selectedProjectId}
                    project={activeProject}
                    positions={positions}
                    rooms={rooms}
                    bookings={bookings}
                    alerts={alerts}
                    addendums={addendums}
                    currentUser={currentUser}
                  />
                )}

                {/* TAB: Analytics */}
                {activeTab === 'analytics' && (
                  <AnalyticsView
                    positions={positions}
                    bookings={bookings}
                  />
                )}

                {/* TAB: Project Settings (NEW) */}
                {activeTab === 'project_settings' && (
                  <ProjectSettingsView
                    project={activeProject}
                    users={users}
                    currentUser={currentUser}
                    onDeleteProject={handleRequestDeleteProject}
                  />
                )}
              </>
            )}

            {/* TAB: User & Role Admin (Admin only) */}
            {activeTab === 'users' && currentUser.role === 'admin' && (
              <UserManagementView
                users={users}
                projects={projects}
              />
            )}

          </div>
        </main>
      </div>

      {/* GAEB Upload Modal (to existing project) */}
      <GaebUploader
        projectId={selectedProjectId}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => setActiveTab('positions')}
      />

      {/* New Project Wizard Modal (3 Steps) - Admin only */}
      {currentUser.role === 'admin' && (
        <NewProjectModal
          isOpen={isNewProjectOpen}
          onClose={() => setIsNewProjectOpen(false)}
          onProjectCreated={handleProjectCreated}
          users={users}
        />
      )}

      {/* Change Password Modal (for all logged in users, including Bauleiter) */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        currentUser={currentUser}
      />

      {/* Delete Project Confirmation Modal */}
      <DeleteProjectConfirmModal
        isOpen={isDeleteModalOpen}
        projectName={activeProject?.name || ''}
        isDeleting={isDeletingProject}
        onConfirm={handleConfirmDeleteProject}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}

export default App;
