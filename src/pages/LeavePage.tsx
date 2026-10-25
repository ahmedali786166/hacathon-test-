import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Sparkles,
  Send,
  AlertCircle,
  CheckCircle,
  Clock,
  Check,
  X,
  RefreshCw,
  Users,
  Calendar,
  Languages,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const LeavePage: React.FC<Props> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<'apply' | 'smart' | 'history' | 'queue' | 'calendar'>('apply');

  // Balances & types
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<any[]>([]);
  const [teamCalendar, setTeamCalendar] = useState<any[]>([]);

  // Apply form state
  const [selectedType, setSelectedType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('2026-10-26');
  const [endDate, setEndDate] = useState<string>('2026-10-27');
  const [reason, setReason] = useState<string>('');
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Smart Leave state
  const [smartPrompt, setSmartPrompt] = useState<string>('Mujhe aglay Monday se do din ki sick leave chahiye');
  const [smartLoading, setSmartLoading] = useState<boolean>(false);
  const [smartParsed, setSmartParsed] = useState<any | null>(null);
  const [smartError, setSmartError] = useState<string | null>(null);

  // Review modal state
  const [reviewComment, setReviewComment] = useState<string>('');

  const fetchData = async () => {
    try {
      // My balances & requests
      const balRes = await apiFetch<any>('/api/leave/my-balances');
      setBalances(balRes.balances || []);

      const reqRes = await apiFetch<any>('/api/leave/my-requests');
      setMyRequests(reqRes.requests || []);

      const typesRes = await apiFetch<any>('/api/organization/leave-types');
      setLeaveTypes(typesRes.leaveTypes || []);
      if (typesRes.leaveTypes?.length > 0 && !selectedType) {
        setSelectedType(typesRes.leaveTypes[0].id);
      }

      // HR/Admin queue
      if (userRole === 'ADMIN' || userRole === 'HR') {
        const queueRes = await apiFetch<any>('/api/leave/queue');
        setApprovalQueue(queueRes.queue || []);
      }

      // Calendar
      const calRes = await apiFetch<any>('/api/leave/calendar?month=2026-10');
      setTeamCalendar(calRes.leaves || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userRole]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyLoading(true);
    setFormMsg(null);
    try {
      const res = await apiFetch<any>('/api/leave/apply', {
        method: 'POST',
        body: JSON.stringify({
          leaveTypeId: selectedType,
          startDate,
          endDate,
          reason,
        }),
      });

      setFormMsg({ type: 'success', text: res.message });
      setReason('');
      fetchData();
      setActiveTab('history');
    } catch (err: any) {
      setFormMsg({ type: 'error', text: err.message });
    } finally {
      setApplyLoading(false);
    }
  };

  const handleSmartParse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartPrompt.trim()) return;

    setSmartLoading(true);
    setSmartError(null);
    setSmartParsed(null);

    try {
      const res = await apiFetch<any>('/api/leave/smart-parse', {
        method: 'POST',
        body: JSON.stringify({ prompt: smartPrompt.trim() }),
      });

      setSmartParsed(res.parsed);
      // Auto-prefill standard form fields
      if (res.parsed.leaveTypeId) setSelectedType(res.parsed.leaveTypeId);
      if (res.parsed.startDate) setStartDate(res.parsed.startDate);
      if (res.parsed.endDate) setEndDate(res.parsed.endDate);
      if (res.parsed.reason) setReason(res.parsed.reason);
    } catch (err: any) {
      setSmartError(err.message || 'Failed to interpret leave request');
    } finally {
      setSmartLoading(false);
    }
  };

  const handleReview = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await apiFetch(`/api/leave/${requestId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          comment: reviewComment,
        }),
      });
      setReviewComment('');
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Leave Balances Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {balances.map(b => (
          <div key={b.id} className="p-4 bg-[#111827] border border-slate-800 rounded-2xl relative overflow-hidden">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">{b.leave_type_name}</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#D6B46A]">{b.remaining_days}</span>
              <span className="text-[10px] text-slate-400">/ {b.total_days} total</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
              <span>Used: {b.used_days}d</span>
              <span>Pending: {b.pending_days || 0}d</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('apply')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'apply'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Apply for Leave
        </button>
        <button
          onClick={() => setActiveTab('smart')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'smart'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#D6B46A]" />
          <span>Smart Leave (Roman Urdu)</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          My Requests ({myRequests.length})
        </button>
        {(userRole === 'ADMIN' || userRole === 'HR') && (
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'queue'
                ? 'border-[#D6B46A] text-[#D6B46A]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>HR Approval Queue</span>
            {approvalQueue.filter(q => q.status === 'PENDING').length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                {approvalQueue.filter(q => q.status === 'PENDING').length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('calendar')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'calendar'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Team Leave Calendar
        </button>
      </div>

      {/* Tab 1: Apply Form */}
      {activeTab === 'apply' && (
        <div className="max-w-xl bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-[#D6B46A]" /> Leave Application Form
          </h3>

          {formMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                formMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {formMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{formMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleApply} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Leave Type <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                required
                className="w-full bg-[#162032] border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
              >
                {leaveTypes.map(lt => (
                  <option key={lt.id} value={lt.id}>
                    {lt.name} ({lt.is_paid ? 'Paid' : 'Unpaid - Unlimited'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  Start Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  End Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Reason for Leave <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="State reason clearly for reviewer..."
                className="w-full bg-[#162032] border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>

            <div className="text-[11px] text-slate-400 bg-[#0B1120] p-2.5 rounded-xl border border-slate-800">
              Note: Weekends (Saturday & Sunday) and public holidays are automatically excluded from leave deductions.
            </div>

            <button
              type="submit"
              disabled={applyLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs rounded-xl hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {applyLoading ? 'Submitting Application...' : 'Submit Leave Application'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Smart Leave Assistant (Roman Urdu & English) */}
      {activeTab === 'smart' && (
        <div className="max-w-2xl bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D6B46A] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI Leave Assistant
              </span>
              <h3 className="text-base font-bold text-white tracking-tight">Smart Leave Natural Language Parser</h3>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              English & Roman Urdu
            </span>
          </div>

          <p className="text-xs text-slate-300">
            Type your request naturally in Roman Urdu or English. Gemini extracts the leave type, dates, and reason, verifies your balance against actual records, and prefills the application for your review. AI never autonomously submits leave!
          </p>

          {/* Prompt Form */}
          <form onSubmit={handleSmartParse} className="space-y-3">
            <div className="relative">
              <textarea
                rows={3}
                value={smartPrompt}
                onChange={e => setSmartPrompt(e.target.value)}
                placeholder="e.g. Mujhe aglay Monday se do din ki sick leave chahiye"
                className="w-full bg-[#162032] border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>

            {/* Quick Suggestions */}
            <div className="flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setSmartPrompt('Mujhe aglay Monday se do din ki sick leave chahiye')}
                className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:text-[#D6B46A] hover:bg-slate-700"
              >
                "Mujhe aglay Monday se do din ki sick leave chahiye"
              </button>
              <button
                type="button"
                onClick={() => setSmartPrompt('Kal ghar mein zaroori kaam hai, casual leave apply karni hai')}
                className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 hover:text-[#D6B46A] hover:bg-slate-700"
              >
                "Kal ghar mein zaroori kaam hai, casual leave apply karni hai"
              </button>
            </div>

            <button
              type="submit"
              disabled={smartLoading || !smartPrompt.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-[#D6B46A]/20 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {smartLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>{smartLoading ? 'Interpreting...' : 'Parse & Prefill Application'}</span>
            </button>
          </form>

          {smartError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
              {smartError}
            </div>
          )}

          {/* Parsed Result Display */}
          {smartParsed && (
            <div className="p-5 bg-[#0B1120] border border-[#D6B46A]/40 rounded-2xl space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#D6B46A] flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Interpreted Leave Proposal
                </span>
                <span className="text-slate-400">Review before confirming</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-[#162032] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Leave Type</span>
                  <span className="font-bold text-slate-100">{smartParsed.leaveTypeName}</span>
                </div>
                <div className="p-2.5 bg-[#162032] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Start Date</span>
                  <span className="font-mono text-slate-100">{smartParsed.startDate}</span>
                </div>
                <div className="p-2.5 bg-[#162032] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">End Date</span>
                  <span className="font-mono text-slate-100">{smartParsed.endDate}</span>
                </div>
                <div className="p-2.5 bg-[#162032] rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Working Days</span>
                  <span className="font-black text-[#D6B46A]">{smartParsed.totalWorkingDays} days</span>
                </div>
              </div>

              <div className="p-3 bg-[#162032] rounded-xl text-xs space-y-1">
                <span className="text-[10px] text-slate-400 font-semibold block">Reason</span>
                <p className="text-slate-200">{smartParsed.reason}</p>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-slate-400">
                  Available Balance: <strong className="text-emerald-400">{smartParsed.availableBalance} days</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('apply');
                  }}
                  className="px-4 py-2 bg-[#D6B46A] text-slate-950 font-bold text-xs rounded-xl shadow hover:opacity-90"
                >
                  Review in Standard Form & Submit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: My Requests History */}
      {activeTab === 'history' && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">From</th>
                <th className="py-3 px-4">To</th>
                <th className="py-3 px-4">Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Reviewer Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    You have not submitted any leave requests yet.
                  </td>
                </tr>
              ) : (
                myRequests.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-slate-200">{r.leave_type_name}</td>
                    <td className="py-3 px-4 font-mono">{r.start_date}</td>
                    <td className="py-3 px-4 font-mono">{r.end_date}</td>
                    <td className="py-3 px-4 font-bold text-[#D6B46A]">{r.total_days}d</td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{r.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          r.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : r.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {r.review_comment || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 4: HR Approval Queue */}
      {activeTab === 'queue' && (userRole === 'ADMIN' || userRole === 'HR') && (
        <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Working Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {approvalQueue.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No leave requests in queue.
                  </td>
                </tr>
              ) : (
                approvalQueue.map(q => (
                  <tr key={q.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{q.first_name} {q.last_name}</div>
                      <div className="text-[10px] text-slate-400">{q.department_name} ({q.employee_code})</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-200">{q.leave_type_name}</td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      {q.start_date} to {q.end_date}
                    </td>
                    <td className="py-3 px-4 font-black text-[#D6B46A]">{q.total_days}d</td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs">{q.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          q.status === 'APPROVED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : q.status === 'REJECTED'
                            ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {q.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleReview(q.id, 'APPROVE')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(q.id, 'REJECT')}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] rounded cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Team Leave Calendar */}
      {activeTab === 'calendar' && (
        <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-[#D6B46A]" /> Approved Leaves Calendar (October 2026)
          </h3>
          <div className="divide-y divide-slate-800">
            {teamCalendar.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No colleagues currently on approved leave.</p>
            ) : (
              teamCalendar.map(c => (
                <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-100">{c.first_name} {c.last_name}</span>
                    <span className="text-[10px] text-slate-400 block">{c.department_name} • {c.leave_type_name}</span>
                  </div>
                  <span className="font-mono text-[#D6B46A] text-[11px]">
                    {c.start_date} to {c.end_date} ({c.total_days} days)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
