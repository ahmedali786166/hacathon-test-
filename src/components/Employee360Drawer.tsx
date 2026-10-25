import React, { useState, useEffect } from 'react';
import { X, Building2, Briefcase, Mail, Phone, Calendar, Key, CheckCircle, RefreshCw, AlertCircle, FileText, Download } from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { formatPKR } from '../../server/services/payrollCalculations.js';
import { generatePayslipPdf } from '../utils/pdfGenerator.js';

interface Props {
  employeeId: string | null;
  onClose: () => void;
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const Employee360Drawer: React.FC<Props> = ({ employeeId, onClose, userRole }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Provisioning account state
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [tempPassword, setTempPassword] = useState<string>('Pass@1234');
  const [accountRole, setAccountRole] = useState<'EMPLOYEE' | 'HR'>('EMPLOYEE');
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null);
  const [provisionLoading, setProvisionLoading] = useState<boolean>(false);

  const fetchProfile = async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>(`/api/employees/${employeeId}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load employee 360 profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [employeeId]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionLoading(true);
    setProvisionSuccess(null);
    try {
      await apiFetch(`/api/employees/${employeeId}/create-account`, {
        method: 'POST',
        body: JSON.stringify({
          password: tempPassword,
          role: accountRole,
        }),
      });
      setProvisionSuccess(`User account created with initial password "${tempPassword}".`);
      setIsProvisioning(false);
      fetchProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProvisionLoading(false);
    }
  };

  if (!employeeId) return null;

  const emp = data?.employee;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-[#0F172A] border-l border-slate-700/80 shadow-2xl flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-5 border-b border-slate-800 bg-[#0B1120] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#D6B46A] to-amber-600 text-slate-950 font-bold flex items-center justify-center text-sm shadow">
            {emp ? `${emp.first_name[0]}${emp.last_name[0]}` : 'E'}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">{emp ? `${emp.first_name} ${emp.last_name}` : 'Loading...'}</h3>
            <span className="text-xs text-slate-400 font-mono">{emp?.employee_code}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#D6B46A]" />
            <span className="text-xs">Loading Employee 360 profile...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : emp ? (
          <>
            {/* Quick Status / Details Card */}
            <div className="p-4 bg-[#162032] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Employment Status</span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    emp.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {emp.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-[#D6B46A]" />
                  <span className="truncate">{emp.department_name}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Briefcase className="w-3.5 h-3.5 text-[#D6B46A]" />
                  <span className="truncate">{emp.designation_title}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-[#D6B46A]" />
                  <span className="truncate">{emp.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-[#D6B46A]" />
                  <span className="truncate">{emp.phone || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-[#D6B46A]" />
                  <span>Joined: {emp.join_date}</span>
                </div>
              </div>
            </div>

            {/* Salary Breakdown (Only visible if authorized) */}
            {emp.basic_salary !== undefined && (
              <div className="p-4 bg-gradient-to-br from-[#162032] to-[#111827] border border-slate-800 rounded-xl space-y-2.5">
                <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Salary Structure (Confidential)</span>
                  <span className="text-[10px] text-[#D6B46A] uppercase font-semibold">Authorized View</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-[#0B1120] rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Basic Salary</span>
                    <span className="font-semibold text-slate-100">{formatPKR(emp.basic_salary)}</span>
                  </div>
                  <div className="p-2.5 bg-[#0B1120] rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Gross Salary (1.5×)</span>
                    <span className="font-bold text-[#D6B46A]">{formatPKR(emp.basic_salary * 1.5)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* User Account Login Status */}
            <div className="p-4 bg-[#162032] border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#D6B46A]" /> Portal Login Account
                </span>
                {emp.user_id ? (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Provisioned ({emp.user_role})
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400">Not Created Yet</span>
                )}
              </div>

              {provisionSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
                  {provisionSuccess}
                </div>
              )}

              {!emp.user_id && (userRole === 'ADMIN' || userRole === 'HR') && (
                <div>
                  {!isProvisioning ? (
                    <button
                      onClick={() => setIsProvisioning(true)}
                      className="mt-2 w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-lg border border-slate-700 transition-colors"
                    >
                      Provision Login Access for Employee
                    </button>
                  ) : (
                    <form onSubmit={handleCreateAccount} className="space-y-2 mt-2 pt-2 border-t border-slate-800">
                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1">Temporary Password</label>
                        <input
                          type="text"
                          value={tempPassword}
                          onChange={e => setTempPassword(e.target.value)}
                          className="w-full bg-[#0B1120] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-slate-400 mb-1">Role</label>
                        <select
                          value={accountRole}
                          onChange={e => setAccountRole(e.target.value as any)}
                          className="w-full bg-[#0B1120] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100"
                        >
                          <option value="EMPLOYEE">EMPLOYEE</option>
                          <option value="HR">HR</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsProvisioning(false)}
                          className="flex-1 py-1.5 bg-slate-800 text-xs text-slate-300 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={provisionLoading}
                          className="flex-1 py-1.5 bg-[#D6B46A] text-slate-950 text-xs font-bold rounded"
                        >
                          {provisionLoading ? 'Provisioning...' : 'Confirm'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {/* Leave Balances Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200">Leave Quotas & Balances</h4>
              <div className="bg-[#162032] border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                {data.leaveBalances?.map((b: any) => (
                  <div key={b.id} className="p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">{b.leave_type_name}</div>
                      <div className="text-[10px] text-slate-400">Total: {b.total_days} days</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#D6B46A]">{b.total_days - b.used_days} remaining</div>
                      <div className="text-[10px] text-slate-400">{b.used_days} used</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attendance */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-200">Recent Attendance (Last 10 Records)</h4>
              <div className="bg-[#162032] border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
                {data.recentAttendance?.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No attendance logs yet.</div>
                ) : (
                  data.recentAttendance?.map((a: any) => (
                    <div key={a.id} className="p-2.5 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-200">{a.date}</span>
                        <div className="text-[10px] text-slate-400">
                          {a.check_in_time || '--:--'} - {a.check_out_time || '--:--'} ({a.total_working_hours}h)
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          a.status === 'PRESENT'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : a.status === 'LATE'
                            ? 'bg-amber-500/20 text-amber-400'
                            : a.status === 'HALF_DAY'
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
