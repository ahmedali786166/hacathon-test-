import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Lock,
  Download,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  FileText,
  Calculator,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { formatPKR } from '../../server/services/payrollCalculations.js';
import { generatePayslipPdf } from '../utils/pdfGenerator.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const PayrollPage: React.FC<Props> = ({ userRole }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [runs, setRuns] = useState<any[]>([]);
  const [currentRun, setCurrentRun] = useState<any | null>(null);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [myPayslips, setMyPayslips] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [locking, setLocking] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRuns = async () => {
    try {
      if (userRole === 'ADMIN' || userRole === 'HR') {
        const res = await apiFetch<any>('/api/payroll/runs');
        setRuns(res.runs || []);
        if (res.runs?.length > 0) {
          fetchDraftDetails(res.runs[0].month);
        }
      } else {
        const res = await apiFetch<any>('/api/payroll/my-payslips');
        setMyPayslips(res.payslips || []);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchDraftDetails = async (month: string) => {
    setLoading(true);
    setFeedbackMsg(null);
    try {
      const res = await apiFetch<any>(`/api/payroll/draft/${month}`);
      setCurrentRun(res.run);
      setPayslips(res.payslips || []);
      setSelectedMonth(month);
    } catch (err: any) {
      setCurrentRun(null);
      setPayslips([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [userRole]);

  // HR / Admin generate draft
  const handleGenerateDraft = async () => {
    setGenerating(true);
    setFeedbackMsg(null);
    try {
      const res = await apiFetch<any>('/api/payroll/generate-draft', {
        method: 'POST',
        body: JSON.stringify({ month: selectedMonth }),
      });
      setFeedbackMsg({ type: 'success', text: res.message });
      setCurrentRun(res.run);
      setPayslips(res.payslips || []);
      fetchRuns();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setGenerating(false);
    }
  };

  // ADMIN ONLY lock
  const handleLockPayroll = async () => {
    if (userRole !== 'ADMIN') {
      alert('Only Administrator has authority to finalize and lock payroll.');
      return;
    }

    if (!window.confirm(`Are you sure you want to finalize and lock payroll for ${selectedMonth}? Once locked, records are legally finalized and cannot be recalculated.`)) {
      return;
    }

    setLocking(true);
    setFeedbackMsg(null);
    try {
      const res = await apiFetch<any>(`/api/payroll/lock/${selectedMonth}`, { method: 'POST' });
      setFeedbackMsg({ type: 'success', text: res.message });
      fetchDraftDetails(selectedMonth);
      fetchRuns();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setLocking(false);
    }
  };

  const handleDownloadPdf = (p: any) => {
    generatePayslipPdf({
      companyName: 'Saylani Technology Solutions',
      companyAddress: 'Shahrah-e-Faisal, Karachi, Pakistan',
      month: p.month,
      employeeCode: p.employee_code,
      employeeName: `${p.first_name} ${p.last_name}`,
      department: p.department_name || 'Engineering',
      designation: p.designation_title || 'Staff',
      basicSalary: p.basic_salary,
      grossSalary: p.gross_salary,
      hra: p.hra,
      medicalAllowance: p.medical_allowance,
      otherAllowance: p.other_allowance,
      workingDays: p.working_days,
      presentDays: p.present_days,
      absentDays: p.absent_days,
      halfDays: p.half_days,
      leaveDays: p.leave_days,
      absentDeduction: p.absent_deduction,
      halfDayDeduction: p.half_day_deduction,
      taxDeduction: p.tax_deduction,
      otherDeductions: p.other_deductions,
      netSalary: p.net_salary,
      generatedAt: p.generated_at,
    });
  };

  return (
    <div className="space-y-6">
      {/* Employee View */}
      {userRole === 'EMPLOYEE' ? (
        <div className="space-y-4">
          <div className="p-6 bg-gradient-to-r from-[#111827] via-[#162032] to-[#1E293B] border border-slate-800 rounded-3xl shadow-xl flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D6B46A] flex items-center gap-1.5 mb-1">
                <Receipt className="w-3.5 h-3.5" /> Confidential Payslips
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">My Finalized Payslips</h2>
              <p className="text-xs text-slate-400 mt-1">
                Download your official computer-generated monthly salary slips in PDF.
              </p>
            </div>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Pay Period</th>
                  <th className="py-3.5 px-4">Gross Salary</th>
                  <th className="py-3.5 px-4">Total Deductions</th>
                  <th className="py-3.5 px-4">Net Salary</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {myPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No finalized payslips available yet. Once Admin finalizes payroll, your slip will appear here.
                    </td>
                  </tr>
                ) : (
                  myPayslips.map(p => {
                    const totalDeds = p.absent_deduction + p.half_day_deduction + p.tax_deduction + p.other_deductions;
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-slate-100">{p.month}</td>
                        <td className="py-3 px-4 font-mono">{formatPKR(p.gross_salary)}</td>
                        <td className="py-3 px-4 font-mono text-rose-400">-{formatPKR(totalDeds)}</td>
                        <td className="py-3 px-4 font-mono font-black text-[#D6B46A]">{formatPKR(p.net_salary)}</td>
                        <td className="py-3 px-4">
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                            FINALIZED
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDownloadPdf(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D6B46A]/20 hover:bg-[#D6B46A]/30 text-[#D6B46A] border border-[#D6B46A]/40 text-xs font-semibold cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* HR / ADMIN Management View */
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="p-6 bg-[#111827] border border-slate-800 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#D6B46A] flex items-center gap-1.5 mb-1">
                <Receipt className="w-3.5 h-3.5" /> Payroll Engine & Pakistan Tax Ordinance
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Payroll Processing</h2>
              <p className="text-xs text-slate-400 mt-1">
                Gross = 1.5× Basic (HRA 40%, Medical 10%). Slabs: 0-600k (0%), 600k-1.2m (5%), 1.2m-2.4m (15%), 2.4m-3.6m (25%), &gt;3.6m (35%).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  fetchDraftDetails(e.target.value);
                }}
                className="bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono"
              />

              <button
                onClick={handleGenerateDraft}
                disabled={generating || (currentRun && currentRun.status === 'LOCKED')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                <span>{generating ? 'Calculating...' : 'Prepare Draft'}</span>
              </button>

              {/* ADMIN ONLY LOCK BUTTON */}
              {userRole === 'ADMIN' && (
                <button
                  onClick={handleLockPayroll}
                  disabled={locking || !currentRun || currentRun.status === 'LOCKED'}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 text-xs font-black shadow-md shadow-[#D6B46A]/20 hover:opacity-95 disabled:opacity-40 cursor-pointer transition-all"
                  title={currentRun?.status === 'LOCKED' ? 'Already Locked' : 'Finalize & Lock Payroll'}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{currentRun?.status === 'LOCKED' ? 'Payroll Locked' : 'Finalize & Lock'}</span>
                </button>
              )}
            </div>
          </div>

          {feedbackMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {feedbackMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Current Run KPI summary */}
          {currentRun && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Gross</span>
                <span className="text-lg font-black text-slate-100">{formatPKR(currentRun.total_gross)}</span>
              </div>
              <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Income Tax Withheld</span>
                <span className="text-lg font-black text-rose-400">{formatPKR(currentRun.total_tax)}</span>
              </div>
              <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Deductions</span>
                <span className="text-lg font-black text-amber-400">{formatPKR(currentRun.total_deductions)}</span>
              </div>
              <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Net Payable</span>
                <span className="text-lg font-black text-[#D6B46A]">{formatPKR(currentRun.total_net)}</span>
              </div>
            </div>
          )}

          {/* Payslips Table */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Basic</th>
                    <th className="py-3 px-4">Gross (1.5x)</th>
                    <th className="py-3 px-4">Attendance Deds</th>
                    <th className="py-3 px-4">Tax (Monthly)</th>
                    <th className="py-3 px-4">Net Salary</th>
                    <th className="py-3 px-4 text-right">PDF Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#D6B46A] mb-2" />
                        <span>Loading payroll review items...</span>
                      </td>
                    </tr>
                  ) : payslips.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No payroll draft prepared for {selectedMonth}. Click "Prepare Draft" above to compute.
                      </td>
                    </tr>
                  ) : (
                    payslips.map(p => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-100">{p.first_name} {p.last_name}</div>
                          <div className="text-[10px] text-[#D6B46A] font-mono">{p.employee_code}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{p.department_name}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{formatPKR(p.basic_salary)}</td>
                        <td className="py-3 px-4 font-mono text-slate-100">{formatPKR(p.gross_salary)}</td>
                        <td className="py-3 px-4 font-mono text-rose-400">
                          -{formatPKR(p.absent_deduction + p.half_day_deduction)}
                        </td>
                        <td className="py-3 px-4 font-mono text-rose-400">-{formatPKR(p.tax_deduction)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#D6B46A]">{formatPKR(p.net_salary)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDownloadPdf(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D6B46A]/20 hover:bg-[#D6B46A]/30 text-[#D6B46A] border border-[#D6B46A]/40 text-xs font-semibold cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
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
    </div>
  );
};
