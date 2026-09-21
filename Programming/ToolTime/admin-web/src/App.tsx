import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import type { TabType } from './components/Sidebar';
import { MaterialTable } from './components/MaterialTable';
import { RoomManager } from './components/RoomManager';
import { LiveFeed } from './components/LiveFeed';
import { AddendumsView } from './components/AddendumsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ReordersView } from './components/ReordersView';
import { ProjectSettingsView } from './components/ProjectSettingsView';
import { UserManagementView } from './components/UserManagementView';
import { GaebUploader } from './components/GaebUploader';
import { NewProjectModal } from './components/NewProjectModal';
import { AlertsBanner } from './components/AlertsBanner';
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
  listenToUsers
} from './services/firestoreService';
import type { Project, Position, Room, Booking, Addendum, Alert, User } from './types';

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return localStorage.getItem('burk_tooltime_active_project_id') || DEFAULT_PROJECT_ID;
  });

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [addendums, setAddendums] = useState<Addendum[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [activeTab, setActiveTab] = useState<TabType>('positions');
  const [searchTerm] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState<boolean>(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false);

  // 1. Listen to all projects & users
  useEffect(() => {
    const unsubProjects = listenToProjects((list) => {
      setProjects(list);
      if (list.length > 0 && !list.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(list[0].id);
      }
    });

    const unsubUsers = listenToUsers((list) => {
      setUsers(list);
    });

    return () => {
      unsubProjects();
      unsubUsers();
    };
  }, []);

  // 2. Listen to active project data whenever selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) return;

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
      rooms
    );
  };

  const openAddendumsCount = addendums.filter(a => a.status === 'pending').length;
  const reordersCount = alerts.filter(a => a.status === 'reordered' || a.actionNote?.includes('Großhändler')).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col antialiased">
      {/* Top Navigation: Streamlined with Project Switcher, New Project & Alerts */}
      <Header
        projects={projects}
        activeProject={activeProject}
        alerts={alerts}
        onSelectProject={handleSelectProject}
        onOpenNewProject={() => setIsNewProjectOpen(true)}
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
          onExport={handleExport}
        />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Live Material Alerts Banner (default collapsed, with 5 decision metrics & mail modal) */}
            <AlertsBanner
              projectId={selectedProjectId}
              alerts={alerts}
              project={activeProject}
              positions={positions}
              rooms={rooms}
            />

            {/* TAB: Positions */}
            {activeTab === 'positions' && (
              <MaterialTable
                positions={positions}
                searchTerm={searchTerm}
              />
            )}

            {/* TAB: Rooms & Floors */}
            {activeTab === 'rooms' && (
              <RoomManager
                projectId={selectedProjectId}
                projectName={activeProject?.name}
                rooms={rooms}
                positions={positions}
              />
            )}

            {/* TAB: Bookings Live Feed */}
            {activeTab === 'bookings' && (
              <LiveFeed
                bookings={bookings}
                rooms={rooms}
              />
            )}

            {/* TAB: Addendums */}
            {activeTab === 'addendums' && (
              <AddendumsView
                addendums={addendums}
              />
            )}

            {/* TAB: Reorders Log (NEW) */}
            {activeTab === 'reorders' && (
              <ReordersView
                projectId={selectedProjectId}
                projectName={activeProject?.name || 'Hallenbad Weingarten'}
                alerts={alerts}
                project={activeProject}
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
              />
            )}

            {/* TAB: User & Role Admin (NEW) */}
            {activeTab === 'users' && (
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

      {/* New Project Wizard Modal (3 Steps) */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onProjectCreated={handleProjectCreated}
        users={users}
      />
    </div>
  );
}

export default App;
