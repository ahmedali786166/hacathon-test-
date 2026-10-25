import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  CalendarCheck,
  Building2,
  AlertTriangle,
  Receipt,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  Megaphone,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { formatPKR } from '../../server/services/payrollCalculations.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
  userName: string;
  onNavigateTab: (tab: any) => void;
  onOpenAi: () => void;
}

export const DashboardPage: React.FC<Props> = ({ userRole, userName, onNavigateTab, onOpenAi }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checkInLoading, setCheckInLoading] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/dashboard/stats');
      setStats(res);
    } catch (err: any) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleQuickCheckIn = async () => {
    setCheckInLoading(true);
    setActionMsg(null);
    try {
      const res = await apiFetch<any>('/api/attendance/check-in', { method: 'POST' });
      setActionMsg(res.message);
      fetchStats();
    } catch (err: any) {
      setActionMsg(err.message);
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleQuickCheckOut = async () => {
    setCheckInLoading(true);
    setActionMsg(null);
    try {
      const res = await apiFetch<any>('/api/attendance/check-out', { method: 'POST' });
      setActionMsg(res.message);
      fetchStats();
    } catch (err: any) {
      setActionMsg(err.message);
    } finally {
      setCheckInLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#D6B46A]" />
        <span className="text-xs">Computing live organization analytics...</span>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Employee Personal Dashboard
  // -------------------------------------------------------------
  if (userRole === 'EMPLOYEE') {
    const todayAtt = stats?.todayAttendance;
    const leaveBalances = stats?.leaveBalances || [];

    return (
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#111827] via-[#162032] to-[#1E293B] border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#D6B46A] block mb-1">
              Employee Portal
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Welcome back, {userName}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Today is Saturday, Oct 24, 2026. Manage your attendance, leave requests, and finalized payslips.
            </p>
          </div>
          <button
            onClick={onOpenAi}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-[#D6B46A]/20 hover:opacity-95 transition-all self-start md:self-auto cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask Gemini (Roman Urdu & English)</span>
          </button>
        </div>

        {actionMsg && (
          <div className="p-3 bg-[#D6B46A]/10 border border-[#D6B46A]/30 rounded-xl text-xs text-[#D6B46A] font-medium">
            {actionMsg}
          </div>
        )}

        {/* Quick Attendance Card & Balances */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Today's Attendance Punch Card */}
          <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#D6B46A]" /> Today's Attendance
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  todayAtt?.status === 'PRESENT'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : todayAtt?.status === 'LATE'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {todayAtt?.status || 'Not Checked In'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>Check-in:</span>
                <span className="text-slate-200 font-mono font-medium">{todayAtt?.check_in_time || '--:--:--'}</span>
              </div>
              <div className="flex justify-between">
                <span>Check-out:</span>
                <span className="text-slate-200 font-mono font-medium">{todayAtt?.check_out_time || '--:--:--'}</span>
              </div>
              <div className="flex justify-between">
                <span>Hours worked:</span>
                <span className="text-slate-200 font-mono font-medium">{todayAtt?.total_working_hours || 0} hrs</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={handleQuickCheckIn}
                disabled={checkInLoading || Boolean(todayAtt?.check_in_time)}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Check In
              </button>
              <button
                onClick={handleQuickCheckOut}
                disabled={checkInLoading || !todayAtt?.check_in_time || Boolean(todayAtt?.check_out_time)}
                className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Check Out
              </button>
            </div>
          </div>

          {/* Leave Balances Quick Card */}
          <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CalendarCheck className="w-4 h-4 text-[#D6B46A]" /> Leave Balances (2026)
              </span>
              <button
                onClick={() => onNavigateTab('leave')}
                className="text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium"
              >
                Apply Leave <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {leaveBalances.map((b: any) => (
                <div key={b.id} className="p-3 bg-[#0B1120] border border-slate-800/80 rounded-xl text-center">
                  <span className="text-[10px] text-slate-400 block truncate">{b.leave_type_name}</span>
                  <span className="text-lg font-black text-[#D6B46A]">{b.remaining_days}</span>
                  <span className="text-[9px] text-slate-400 block">of {b.total_days} days</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Announcements Feed */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#D6B46A]" /> Company Announcements
          </h3>
          <div className="space-y-2">
            {stats?.announcements?.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">No announcements posted yet.</p>
            ) : (
              stats.announcements.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl bg-[#0B1120] border border-slate-800/80 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{a.title}</span>
                    <span className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-1">{a.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // HR & ADMIN Dashboard (Live Real Headcount, Attendance & Payroll)
  // -------------------------------------------------------------
  const headcount = stats?.headcount || { total: 0, active: 0 };
  const att = stats?.attendanceToday || { present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0 };
  const deptDist = stats?.departmentDistribution || [];

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Headcount */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Headcount</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{headcount.active}</span>
            <span className="text-[11px] text-slate-400 font-normal">/ {headcount.total} registered</span>
          </div>
          <button
            onClick={() => onNavigateTab('employees')}
            className="mt-3 text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            View directory <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Present Today */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Present Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400">{att.present}</span>
            <span className="text-[11px] text-slate-400 font-normal">employees present</span>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-3 text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            Attendance log <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Late Arrivals */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Late Arrivals</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{att.late}</span>
            <span className="text-[11px] text-slate-400 font-normal">arrived after 09:15</span>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-3 text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            Review latecomers <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Leave Queue */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Leaves</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-400">{stats?.leaves?.pending || 0}</span>
            <span className="text-[11px] text-slate-400 font-normal">awaiting review</span>
          </div>
          <button
            onClick={() => onNavigateTab('leave')}
            className="mt-3 text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
          >
            Approval queue <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle Section: Attendance Breakdown & Department Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today Attendance Breakdown Card */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D6B46A]" /> Today's Attendance Real-Time
            </h3>
            <span className="text-[10px] text-slate-400">2026-10-24</span>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">On Time (≤ 09:15)</span>
                <span className="font-bold text-emerald-400">{att.onTime}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${headcount.active ? (att.onTime / headcount.active) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Late Arrivals (&gt; 09:15)</span>
                <span className="font-bold text-amber-400">{att.late}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${headcount.active ? (att.late / headcount.active) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Half-Day (&lt; 5.0 hrs)</span>
                <span className="font-bold text-indigo-400">{att.halfDay}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${headcount.active ? (att.halfDay / headcount.active) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Approved Leave</span>
                <span className="font-bold text-purple-400">{att.onLeave}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full"
                  style={{ width: `${headcount.active ? (att.onLeave / headcount.active) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-300">Absent / Unrecorded</span>
                <span className="font-bold text-rose-400">{att.absent}</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{ width: `${headcount.active ? (att.absent / headcount.active) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Headcount by Department */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#D6B46A]" /> Department Headcount Distribution
            </h3>
            <button
              onClick={() => onNavigateTab('organization')}
              className="text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              Manage Departments <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {deptDist.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No departments registered yet. Use Organization Settings to add departments.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {deptDist.map((d: any, idx: number) => {
                const percent = headcount.active ? Math.round((d.count / headcount.active) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-300">
                      <span className="font-medium">{d.name}</span>
                      <span className="font-mono text-slate-400">
                        {d.count} employees ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D6B46A] to-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Latest Payroll Banner & Audits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Payroll Card */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#D6B46A]" /> Monthly Payroll Engine Status
            </h3>
            <button
              onClick={() => onNavigateTab('payroll')}
              className="text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              Open Payroll <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats?.latestPayroll ? (
            <div className="p-4 bg-[#0B1120] rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Month: {stats.latestPayroll.month}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    stats.latestPayroll.status === 'LOCKED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {stats.latestPayroll.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Gross</span>
                  <span className="font-bold text-slate-200">{formatPKR(stats.latestPayroll.total_gross)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Tax</span>
                  <span className="font-bold text-rose-400">{formatPKR(stats.latestPayroll.total_tax)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Net Pay</span>
                  <span className="font-bold text-[#D6B46A]">{formatPKR(stats.latestPayroll.total_net)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-400 bg-[#0B1120] rounded-xl border border-slate-800/80">
              No payroll run generated yet for this period. Open Payroll & Tax to generate a draft.
            </div>
          )}
        </div>

        {/* Recent System Audits */}
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              Recent Audited Actions
            </h3>
            {userRole === 'ADMIN' && (
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-[11px] text-[#D6B46A] hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                All audit logs <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
            {stats?.recentAudits?.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">No audit events recorded yet.</div>
            ) : (
              stats.recentAudits.map((aud: any, idx: number) => (
                <div key={idx} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-200">{aud.action}</span>
                    <span className="text-[10px] text-slate-400 block">{aud.actor_email} ({aud.actor_role})</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(aud.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
