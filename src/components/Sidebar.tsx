import React from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarDays,
  Receipt,
  Sparkles,
  Megaphone,
  Settings,
  ShieldAlert,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Building,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'employees'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'ai'
  | 'announcements'
  | 'organization'
  | 'audit'
  | 'profile';

interface Props {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onLogout: () => void;
  companyName?: string;
  pendingLeaveCount?: number;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  setActiveTab,
  userRole,
  collapsed,
  setCollapsed,
  onLogout,
  companyName = 'HCM Lite',
  pendingLeaveCount = 0,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { id: 'employees' as NavTab, label: 'Employees', icon: Users, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { id: 'attendance' as NavTab, label: 'Attendance', icon: Clock, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    {
      id: 'leave' as NavTab,
      label: 'Leave Management',
      icon: CalendarDays,
      roles: ['ADMIN', 'HR', 'EMPLOYEE'],
      badge: (userRole === 'ADMIN' || userRole === 'HR') && pendingLeaveCount > 0 ? pendingLeaveCount : undefined,
    },
    { id: 'payroll' as NavTab, label: 'Payroll & Tax', icon: Receipt, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    {
      id: 'ai' as NavTab,
      label: 'Gemini Assistant',
      icon: Sparkles,
      roles: ['ADMIN', 'HR', 'EMPLOYEE'],
      highlight: true,
    },
    { id: 'announcements' as NavTab, label: 'Announcements', icon: Megaphone, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { id: 'profile' as NavTab, label: 'My Profile', icon: UserCircle, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { id: 'organization' as NavTab, label: 'Organization', icon: Settings, roles: ['ADMIN', 'HR'] },
    { id: 'audit' as NavTab, label: 'Audit Trail', icon: ShieldAlert, roles: ['ADMIN'] },
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(userRole));

  return (
    <aside
      className={`h-screen bg-[#0B1120] border-r border-slate-800 flex flex-col transition-all duration-300 z-30 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
        {!collapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D6B46A] to-[#997931] flex items-center justify-center shadow-lg shadow-[#D6B46A]/10 flex-shrink-0">
              <Building className="w-5 h-5 text-[#0B1120]" />
            </div>
            <div className="truncate">
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                HCM Lite
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#D6B46A]/20 text-[#D6B46A] border border-[#D6B46A]/30">
                  v2.0
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 truncate">{companyName}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-9 h-9 rounded-lg bg-gradient-to-br from-[#D6B46A] to-[#997931] flex items-center justify-center">
            <Building className="w-5 h-5 text-[#0B1120]" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-gradient-to-r from-slate-800 to-[#162032] text-white shadow-sm border border-slate-700/80'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {/* Active gold indicator on left border */}
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#D6B46A] rounded-r-full shadow-sm shadow-[#D6B46A]" />
              )}

              <Icon
                className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  item.highlight
                    ? 'text-[#D6B46A]'
                    : isActive
                    ? 'text-[#D6B46A]'
                    : 'text-slate-400 group-hover:text-slate-300'
                }`}
              />

              {!collapsed && (
                <span className="flex-1 text-left truncate flex items-center justify-between">
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                  {item.highlight && (
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#D6B46A]/20 text-[#D6B46A]">
                      AI
                    </span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Sign Out */}
      <div className="p-3 border-t border-slate-800/80">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-rose-400/90 hover:bg-rose-500/10 hover:text-rose-300 transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
