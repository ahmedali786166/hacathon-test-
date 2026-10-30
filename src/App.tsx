import React, { useState, useEffect } from 'react';
import { apiFetch } from './api/client.js';
import { FirstRunSetup } from './pages/FirstRunSetup.js';
import { LoginPage } from './pages/LoginPage.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { AiAssistantDrawer } from './components/AiAssistantDrawer.js';

// Page components
import { DashboardPage } from './pages/DashboardPage.js';
import { EmployeePage } from './pages/EmployeePage.js';
import { AttendancePage } from './pages/AttendancePage.js';
import { LeavePage } from './pages/LeavePage.js';
import { PayrollPage } from './pages/PayrollPage.js';
import { OrganizationPage } from './pages/OrganizationPage.js';
import { AnnouncementsPage } from './pages/AnnouncementsPage.js';
import { AuditPage } from './pages/AuditPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { RefreshCw } from 'lucide-react';

export function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [companyInfo, setCompanyInfo] = useState<any | null>(null);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [forceLoginView, setForceLoginView] = useState<boolean>(false);
  const [forceSetupView, setForceSetupView] = useState<boolean>(false);

  // App Layout State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);

  const checkStatus = async () => {
    try {
      const res = await apiFetch<any>('/api/auth/status');
      setIsSetupComplete(res.isSetupComplete);
      setCompanyInfo(res.company);
      if (res.currentUser) {
        setCurrentUser(res.currentUser);
      } else {
        const token = localStorage.getItem('hcm_token');
        if (token) {
          try {
            const meRes = await apiFetch<any>('/api/auth/me');
            setCurrentUser(meRes.user);
          } catch {
            localStorage.removeItem('hcm_token');
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
    } catch (err) {
      console.error('Status check error:', err);
      setIsSetupComplete(false);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    localStorage.removeItem('hcm_token');
    setCurrentUser(null);
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#D6B46A]" />
        <span className="text-xs text-slate-400 font-medium tracking-wide">
          Connecting to HCM Lite Database...
        </span>
      </div>
    );
  }

  // 1. First-Run Setup Wizard
  if ((!isSetupComplete || forceSetupView) && !forceLoginView) {
    return (
      <FirstRunSetup
        onSetupComplete={(user, token) => {
          setIsSetupComplete(true);
          setCurrentUser(user);
          setForceSetupView(false);
        }}
        onGoToLogin={() => {
          setForceSetupView(false);
          setForceLoginView(true);
        }}
      />
    );
  }

  // 2. Login Page
  if (!currentUser) {
    return (
      <LoginPage
        companyName={companyInfo?.name || 'HCM Lite'}
        onLoginSuccess={(user, token) => {
          setCurrentUser(user);
        }}
        onGoToSetup={() => setForceSetupView(true)}
      />
    );
  }

  // 3. Authenticated App Layout
  return (
    <div className="flex h-screen bg-[#080D1A] text-slate-100 overflow-hidden font-sans selection:bg-[#D6B46A] selection:text-slate-950">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={tab => {
          if (tab === 'ai') {
            setIsAiOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        userRole={currentUser.role}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onLogout={handleLogout}
        companyName={companyInfo?.name}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          title={activeTab}
          user={currentUser}
          onOpenAi={() => setIsAiOpen(true)}
        />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {activeTab === 'dashboard' && (
            <DashboardPage
              userRole={currentUser.role}
              userName={currentUser.full_name}
              onNavigateTab={tab => setActiveTab(tab)}
              onOpenAi={() => setIsAiOpen(true)}
            />
          )}

          {activeTab === 'employees' && (
            <EmployeePage
              userRole={currentUser.role}
              onNavigateToOrgSettings={() => setActiveTab('organization')}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendancePage userRole={currentUser.role} />
          )}

          {activeTab === 'leave' && (
            <LeavePage userRole={currentUser.role} />
          )}

          {activeTab === 'payroll' && (
            <PayrollPage userRole={currentUser.role} />
          )}

          {activeTab === 'organization' && (
            <OrganizationPage userRole={currentUser.role} />
          )}

          {activeTab === 'announcements' && (
            <AnnouncementsPage userRole={currentUser.role} />
          )}

          {activeTab === 'audit' && (
            <AuditPage />
          )}

          {activeTab === 'profile' && (
            <ProfilePage user={currentUser} />
          )}
        </main>
      </div>

      {/* Interactive AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        userRole={currentUser.role}
      />
    </div>
  );
}

export default App;
