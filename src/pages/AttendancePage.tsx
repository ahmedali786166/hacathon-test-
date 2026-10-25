import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Edit3,
  Filter,
  Check,
  X,
  Building2,
  FileText,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const AttendancePage: React.FC<Props> = ({ userRole }) => {
  // Employee personal state
  const [todayAtt, setTodayAtt] = useState<any>(null);
  const [myHistory, setMyHistory] = useState<any[]>([]);
  const [punchLoading, setPunchLoading] = useState<boolean>(false);
  const [punchMsg, setPunchMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // HR / Admin log state
  const [allAttendance, setAllAttendance] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('2026-10-24');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [logLoading, setLogLoading] = useState<boolean>(false);

  // Correction Modal State
  const [correctionTarget, setCorrectionTarget] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<string>('PRESENT');
  const [newCheckIn, setNewCheckIn] = useState<string>('09:00:00');
  const [newCheckOut, setNewCheckOut] = useState<string>('18:00:00');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionLoading, setCorrectionLoading] = useState<boolean>(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  // Fetch employee's today record
  const fetchMyAttendance = async () => {
    try {
      const todayRes = await apiFetch<any>('/api/attendance/today');
      setTodayAtt(todayRes.attendance);
      const histRes = await apiFetch<any>('/api/attendance/my-history?month=2026-10');
      setMyHistory(histRes.history || []);
    } catch {}
  };

  // Fetch HR/Admin log
  const fetchAllAttendance = async () => {
    setLogLoading(true);
    try {
      const params = new URLSearchParams({
        date: selectedDate,
        departmentId: selectedDept,
        status: selectedStatus,
      });
      const res = await apiFetch<any>(`/api/attendance/all?${params.toString()}`);
      setAllAttendance(res.attendance || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    fetchMyAttendance();
    if (userRole === 'ADMIN' || userRole === 'HR') {
      apiFetch<any>('/api/organization/departments').then(res => setDepartments(res.departments || []));
      fetchAllAttendance();
    }
  }, [userRole, selectedDate, selectedDept, selectedStatus]);

  const handleCheckIn = async () => {
    setPunchLoading(true);
    setPunchMsg(null);
    try {
      const res = await apiFetch<any>('/api/attendance/check-in', { method: 'POST' });
      setPunchMsg({ type: 'success', text: res.message });
      fetchMyAttendance();
    } catch (err: any) {
      setPunchMsg({ type: 'error', text: err.message });
    } finally {
      setPunchLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setPunchLoading(true);
    setPunchMsg(null);
    try {
      const res = await apiFetch<any>('/api/attendance/check-out', { method: 'POST' });
      setPunchMsg({ type: 'success', text: res.message });
      fetchMyAttendance();
    } catch (err: any) {
      setPunchMsg({ type: 'error', text: err.message });
    } finally {
      setPunchLoading(false);
    }
  };

  const handleOpenCorrection = (attRecord: any) => {
    setCorrectionTarget(attRecord);
    setNewStatus(attRecord.status || 'PRESENT');
    setNewCheckIn(attRecord.check_in_time || '09:00:00');
    setNewCheckOut(attRecord.check_out_time || '18:00:00');
    setCorrectionReason('');
    setCorrectionError(null);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      setCorrectionError('Mandatory reason is required to submit an attendance correction.');
      return;
    }

    setCorrectionLoading(true);
    setCorrectionError(null);
    try {
      await apiFetch('/api/attendance/correction', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: correctionTarget.employee_id,
          date: correctionTarget.date,
          newStatus,
          newCheckIn,
          newCheckOut,
          reason: correctionReason,
        }),
      });

      setCorrectionTarget(null);
      fetchAllAttendance();
      fetchMyAttendance();
    } catch (err: any) {
      setCorrectionError(err.message || 'Failed to submit correction');
    } finally {
      setCorrectionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Employee Punch Clock Card */}
      <div className="p-6 bg-gradient-to-r from-[#111827] via-[#162032] to-[#1E293B] border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D6B46A] flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5" /> Server-Validated Time Clock
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">Today's Attendance</h2>
          <p className="text-xs text-slate-400 mt-1">
            Office hours: 09:00 AM (15m grace period, marked Late after 09:15). Half-day below 5 hours.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="px-4 py-2 bg-[#0B1120] border border-slate-800 rounded-xl text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Today's Status</span>
            <span
              className={`text-xs font-black uppercase ${
                todayAtt?.status === 'PRESENT'
                  ? 'text-emerald-400'
                  : todayAtt?.status === 'LATE'
                  ? 'text-amber-400'
                  : todayAtt?.status === 'HALF_DAY'
                  ? 'text-indigo-400'
                  : 'text-slate-400'
              }`}
            >
              {todayAtt?.status || 'NOT CHECKED IN'}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCheckIn}
              disabled={punchLoading || Boolean(todayAtt?.check_in_time)}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              {punchLoading ? 'Processing...' : 'Check In'}
            </button>
            <button
              onClick={handleCheckOut}
              disabled={punchLoading || !todayAtt?.check_in_time || Boolean(todayAtt?.check_out_time)}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wide shadow-md shadow-rose-600/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              {punchLoading ? 'Processing...' : 'Check Out'}
            </button>
          </div>
        </div>
      </div>

      {punchMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            punchMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {punchMsg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{punchMsg.text}</span>
        </div>
      )}

      {/* HR & ADMIN Management Table */}
      {(userRole === 'ADMIN' || userRole === 'HR') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D6B46A]" /> Company Attendance Records & Corrections
            </h3>
          </div>

          {/* Filters */}
          <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl flex flex-wrap gap-3">
            <div className="w-full sm:w-44">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100"
              />
            </div>
            <div className="w-full sm:w-56">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Department</label>
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late (&gt;09:15)</option>
                <option value="HALF_DAY">Half-Day (&lt;5h)</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Check-In</th>
                    <th className="py-3 px-4">Check-Out</th>
                    <th className="py-3 px-4">Hours</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Correct</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {logLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto text-[#D6B46A] mb-1" />
                        <span>Loading records...</span>
                      </td>
                    </tr>
                  ) : allAttendance.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No attendance entries recorded for {selectedDate}.
                      </td>
                    </tr>
                  ) : (
                    allAttendance.map(att => (
                      <tr key={att.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100">{att.first_name} {att.last_name}</div>
                          <div className="text-[10px] text-[#D6B46A] font-mono">{att.employee_code}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{att.department_name || 'N/A'}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">{att.date}</td>
                        <td className="py-3 px-4 font-mono text-slate-200">{att.check_in_time || '--:--:--'}</td>
                        <td className="py-3 px-4 font-mono text-slate-200">{att.check_out_time || '--:--:--'}</td>
                        <td className="py-3 px-4 font-mono font-medium">{att.total_working_hours}h</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              att.status === 'PRESENT'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : att.status === 'LATE'
                                ? 'bg-amber-500/20 text-amber-400'
                                : att.status === 'HALF_DAY'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {att.status}
                          </span>
                          {att.is_corrected === 1 && (
                            <span className="ml-1 text-[8px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded">
                              Corrected
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenCorrection(att)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D6B46A]/20 text-slate-300 hover:text-[#D6B46A] cursor-pointer"
                            title="Attendance correction with audit reason"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Employee's Personal Monthly Log */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#D6B46A]" /> My Attendance History (October 2026)
        </h3>
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {myHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No attendance records logged for you in this period.
                  </td>
                </tr>
              ) : (
                myHistory.map(h => (
                  <tr key={h.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono">{h.date}</td>
                    <td className="py-2.5 px-4 font-mono">{h.check_in_time || '--:--:--'}</td>
                    <td className="py-2.5 px-4 font-mono">{h.check_out_time || '--:--:--'}</td>
                    <td className="py-2.5 px-4 font-mono">{h.total_working_hours}h</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          h.status === 'PRESENT'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : h.status === 'LATE'
                            ? 'bg-amber-500/20 text-amber-400'
                            : h.status === 'HALF_DAY'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attendance Correction Modal */}
      {correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Submit Attendance Correction</h3>
                <p className="text-[11px] text-slate-400">
                  {correctionTarget.first_name} {correctionTarget.last_name} ({correctionTarget.date})
                </p>
              </div>
              <button onClick={() => setCorrectionTarget(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {correctionError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-300">
                {correctionError}
              </div>
            )}

            <form onSubmit={handleSaveCorrection} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Corrected Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="LATE">LATE</option>
                  <option value="HALF_DAY">HALF_DAY</option>
                  <option value="ABSENT">ABSENT</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Check-In Time</label>
                  <input
                    type="text"
                    value={newCheckIn}
                    onChange={e => setNewCheckIn(e.target.value)}
                    placeholder="HH:mm:ss"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Check-Out Time</label>
                  <input
                    type="text"
                    value={newCheckOut}
                    onChange={e => setNewCheckOut(e.target.value)}
                    placeholder="HH:mm:ss"
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Mandatory Audit Reason <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Employee biometric machine glitch confirmed by manager"
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectionTarget(null)}
                  className="px-3 py-1.5 bg-slate-800 text-xs text-slate-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctionLoading}
                  className="px-4 py-1.5 bg-[#D6B46A] text-slate-950 font-bold text-xs rounded hover:opacity-90"
                >
                  {correctionLoading ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
