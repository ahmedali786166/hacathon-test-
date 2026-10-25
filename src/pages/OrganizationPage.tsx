import React, { useState, useEffect } from 'react';
import {
  Building2,
  Briefcase,
  Settings,
  Calendar,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const OrganizationPage: React.FC<Props> = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState<'depts' | 'settings' | 'leaves' | 'holidays' | 'users'>('depts');

  // Departments & Designations state
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [loadingDepts, setLoadingDepts] = useState<boolean>(true);

  // New Department Form
  const [deptName, setDeptName] = useState<string>('');
  const [deptCode, setDeptCode] = useState<string>('');
  const [deptDesc, setDeptDesc] = useState<string>('');

  // New Designation Form
  const [desigDeptId, setDesigDeptId] = useState<string>('');
  const [desigTitle, setDesigTitle] = useState<string>('');
  const [desigCode, setDesigCode] = useState<string>('');
  const [desigDesc, setDesigDesc] = useState<string>('');

  // Settings State
  const [settings, setSettings] = useState<any>(null);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);

  // Leave Types State
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [newLtName, setNewLtName] = useState<string>('');
  const [newLtCode, setNewLtCode] = useState<string>('');
  const [newLtDays, setNewLtDays] = useState<number>(10);

  // Holidays State
  const [holidays, setHolidays] = useState<any[]>([]);
  const [newHolName, setNewHolName] = useState<string>('');
  const [newHolDate, setNewHolDate] = useState<string>('2026-11-09');

  // Users State (Admin only)
  const [users, setUsers] = useState<any[]>([]);
  const [newHrName, setNewHrName] = useState<string>('');
  const [newHrEmail, setNewHrEmail] = useState<string>('');
  const [newHrPassword, setNewHrPassword] = useState<string>('HR@1234');
  const [newHrRole, setNewHrRole] = useState<'HR' | 'ADMIN'>('HR');

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDeptsAndDesigs = async () => {
    setLoadingDepts(true);
    try {
      const dRes = await apiFetch<any>('/api/organization/departments');
      setDepartments(dRes.departments || []);
      const desRes = await apiFetch<any>('/api/organization/designations');
      setDesignations(desRes.designations || []);
      if (dRes.departments?.length > 0 && !desigDeptId) {
        setDesigDeptId(dRes.departments[0].id);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDepts(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await apiFetch<any>('/api/organization/settings');
      setSettings(res.settings);
    } catch {}
  };

  const fetchLeaveTypes = async () => {
    try {
      const res = await apiFetch<any>('/api/organization/leave-types');
      setLeaveTypes(res.leaveTypes || []);
    } catch {}
  };

  const fetchHolidays = async () => {
    try {
      const res = await apiFetch<any>('/api/organization/holidays');
      setHolidays(res.holidays || []);
    } catch {}
  };

  const fetchUsers = async () => {
    if (userRole === 'ADMIN') {
      try {
        const res = await apiFetch<any>('/api/users');
        setUsers(res.users || []);
      } catch {}
    }
  };

  useEffect(() => {
    fetchDeptsAndDesigs();
    fetchSettings();
    fetchLeaveTypes();
    fetchHolidays();
    fetchUsers();
  }, [userRole]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch<any>('/api/organization/departments', {
        method: 'POST',
        body: JSON.stringify({ name: deptName, code: deptCode, description: deptDesc }),
      });
      setFeedback({ type: 'success', text: `Department "${res.department.name}" created.` });
      setDeptName('');
      setDeptCode('');
      setDeptDesc('');
      fetchDeptsAndDesigs();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this department?')) return;
    try {
      await apiFetch(`/api/organization/departments/${id}`, { method: 'DELETE' });
      fetchDeptsAndDesigs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const res = await apiFetch<any>('/api/organization/designations', {
        method: 'POST',
        body: JSON.stringify({
          department_id: desigDeptId,
          title: desigTitle,
          code: desigCode,
          description: desigDesc,
        }),
      });
      setFeedback({ type: 'success', text: `Designation "${res.designation.title}" created.` });
      setDesigTitle('');
      setDesigCode('');
      setDesigDesc('');
      fetchDeptsAndDesigs();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDesignation = async (id: string) => {
    if (!window.confirm('Delete this designation?')) return;
    try {
      await apiFetch(`/api/organization/designations/${id}`, { method: 'DELETE' });
      fetchDeptsAndDesigs();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setFeedback(null);
    try {
      await apiFetch('/api/organization/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      });
      setFeedback({ type: 'success', text: 'Organization settings updated successfully.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCreateLeaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/organization/leave-types', {
        method: 'POST',
        body: JSON.stringify({ name: newLtName, code: newLtCode, annual_days: newLtDays }),
      });
      setNewLtName('');
      setNewLtCode('');
      fetchLeaveTypes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/organization/holidays', {
        method: 'POST',
        body: JSON.stringify({ name: newHolName, date: newHolDate }),
      });
      setNewHolName('');
      fetchHolidays();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          full_name: newHrName,
          email: newHrEmail,
          password: newHrPassword,
          role: newHrRole,
        }),
      });
      setNewHrName('');
      setNewHrEmail('');
      fetchUsers();
      setFeedback({ type: 'success', text: `${newHrRole} account created successfully.` });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 bg-[#111827] border border-slate-800 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D6B46A] flex items-center gap-1.5 mb-1">
            <Building2 className="w-3.5 h-3.5" /> Organization Structure & Hierarchy
          </span>
          <h2 className="text-xl font-bold text-white tracking-tight">Organization Settings</h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure Departments, linked Designations, Office Hours, Leave Types, and User Accounts.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('depts')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'depts'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Departments & Designations
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Company Profile & Office Hours
        </button>
        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'leaves'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Leave Types & Quotas
        </button>
        <button
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'holidays'
              ? 'border-[#D6B46A] text-[#D6B46A]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Company Holidays
        </button>
        {userRole === 'ADMIN' && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'border-[#D6B46A] text-[#D6B46A]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            User Accounts & Roles
          </button>
        )}
      </div>

      {/* Tab 1: Departments & Designations */}
      {activeTab === 'depts' && (
        <div className="space-y-6">
          {/* Create Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Department Creator */}
            <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-[#D6B46A]" /> Create Department
              </h3>
              <form onSubmit={handleCreateDepartment} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Engineering"
                    value={deptName}
                    onChange={e => setDeptName(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Unique Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ENG"
                    value={deptCode}
                    onChange={e => setDeptCode(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Software and Infrastructure"
                    value={deptDesc}
                    onChange={e => setDeptDesc(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
                >
                  Add Department
                </button>
              </form>
            </div>

            {/* Designation Creator (Linked to Department) */}
            <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
                <Briefcase className="w-3.5 h-3.5 text-[#D6B46A]" /> Create Designation (Linked)
              </h3>
              <form onSubmit={handleCreateDesignation} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target Department *</label>
                  <select
                    value={desigDeptId}
                    onChange={e => setDesigDeptId(e.target.value)}
                    required
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="">Select a department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Designation Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Senior Software Engineer"
                    value={desigTitle}
                    onChange={e => setDesigTitle(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Designation Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SR_SWE"
                    value={desigCode}
                    onChange={e => setDesigCode(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!desigDeptId}
                  className="w-full py-2 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow disabled:opacity-40 cursor-pointer"
                >
                  Add Designation to Department
                </button>
              </form>
            </div>
          </div>

          {/* Table: Departments and Designations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Departments List */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3.5 bg-[#0B1120] border-b border-slate-800 font-bold text-xs text-slate-200">
                Registered Departments ({departments.length})
              </div>
              <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
                {departments.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No departments added yet.</div>
                ) : (
                  departments.map(d => (
                    <div key={d.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/40">
                      <div>
                        <span className="font-semibold text-slate-100">{d.name}</span>
                        <span className="text-[10px] text-[#D6B46A] font-mono ml-2">[{d.code}]</span>
                        <div className="text-[10px] text-slate-400">
                          {d.active_employee_count || 0} employees • {d.designation_count || 0} designations
                        </div>
                      </div>
                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteDepartment(d.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded"
                          title="Delete department"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Designations List */}
            <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3.5 bg-[#0B1120] border-b border-slate-800 font-bold text-xs text-slate-200">
                Registered Designations ({designations.length})
              </div>
              <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
                {designations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No designations added yet.</div>
                ) : (
                  designations.map(des => (
                    <div key={des.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-800/40">
                      <div>
                        <span className="font-semibold text-slate-100">{des.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-2">({des.code})</span>
                        <div className="text-[10px] text-[#D6B46A]">
                          Dept: {des.department_name}
                        </div>
                      </div>
                      {userRole === 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteDesignation(des.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded"
                          title="Delete designation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Company Profile & Office Hours */}
      {activeTab === 'settings' && settings && (
        <div className="max-w-2xl bg-[#111827] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#D6B46A]" /> Company Settings & Work Policies
          </h3>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Company Name</label>
                <input
                  type="text"
                  value={settings.name || ''}
                  onChange={e => setSettings({ ...settings, name: e.target.value })}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Legal Name</label>
                <input
                  type="text"
                  value={settings.legal_name || ''}
                  onChange={e => setSettings({ ...settings, legal_name: e.target.value })}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Office Address</label>
              <input
                type="text"
                value={settings.office_address || ''}
                onChange={e => setSettings({ ...settings, office_address: e.target.value })}
                className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Office Start Time</label>
                <input
                  type="text"
                  value={settings.start_time || '09:00'}
                  onChange={e => setSettings({ ...settings, start_time: e.target.value })}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Grace Period (Minutes)</label>
                <input
                  type="number"
                  value={settings.grace_minutes || 15}
                  onChange={e => setSettings({ ...settings, grace_minutes: Number(e.target.value) })}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Half-Day Threshold (Hrs)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.half_day_hours || 5.0}
                  onChange={e => setSettings({ ...settings, half_day_hours: Number(e.target.value) })}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100"
                />
              </div>
            </div>

            {userRole === 'ADMIN' && (
              <button
                type="submit"
                disabled={saveLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveLoading ? 'Saving...' : 'Save Settings'}</span>
              </button>
            )}
          </form>
        </div>
      )}

      {/* Tab 3: Leave Types */}
      {activeTab === 'leaves' && (
        <div className="max-w-2xl space-y-4">
          {userRole === 'ADMIN' && (
            <form onSubmit={handleCreateLeaveType} className="p-4 bg-[#111827] border border-slate-800 rounded-2xl flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Type Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paternity Leave"
                  value={newLtName}
                  onChange={e => setNewLtName(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                />
              </div>
              <div className="w-28">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Code</label>
                <input
                  type="text"
                  required
                  placeholder="PAT"
                  value={newLtCode}
                  onChange={e => setNewLtCode(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-slate-100 uppercase"
                />
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Days</label>
                <input
                  type="number"
                  value={newLtDays}
                  onChange={e => setNewLtDays(Number(e.target.value))}
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#D6B46A] text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                Add Type
              </button>
            </form>
          )}

          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800">
              {leaveTypes.map(lt => (
                <div key={lt.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-100">{lt.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">({lt.code})</span>
                    <div className="text-[10px] text-slate-400">{lt.description}</div>
                  </div>
                  <span className="font-black text-[#D6B46A] text-sm">
                    {lt.annual_days > 0 ? `${lt.annual_days} days` : 'Unlimited (Unpaid)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Holidays */}
      {activeTab === 'holidays' && (
        <div className="max-w-2xl space-y-4">
          {userRole === 'ADMIN' && (
            <form onSubmit={handleCreateHoliday} className="p-4 bg-[#111827] border border-slate-800 rounded-2xl flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Iqbal Day"
                  value={newHolName}
                  onChange={e => setNewHolName(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                />
              </div>
              <div className="w-44">
                <label className="block text-[10px] text-slate-400 uppercase font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={newHolDate}
                  onChange={e => setNewHolDate(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#D6B46A] text-slate-950 font-bold text-xs rounded-lg cursor-pointer"
              >
                Add Holiday
              </button>
            </form>
          )}

          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-slate-800">
              {holidays.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No holidays registered.</div>
              ) : (
                holidays.map(h => (
                  <div key={h.id} className="p-3.5 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">{h.name}</span>
                    <span className="font-mono text-[#D6B46A]">{h.date}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Users (Admin only) */}
      {activeTab === 'users' && userRole === 'ADMIN' && (
        <div className="max-w-2xl space-y-4">
          <div className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D6B46A]" /> Create Management Account (HR / Admin)
            </h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Asma Khan"
                    value={newHrName}
                    onChange={e => setNewHrName(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="asma.hr@saylani.org"
                    value={newHrEmail}
                    onChange={e => setNewHrEmail(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={newHrPassword}
                    onChange={e => setNewHrPassword(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Role</label>
                  <select
                    value={newHrRole}
                    onChange={e => setNewHrRole(e.target.value as any)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                  >
                    <option value="HR">HR (Can register employees, review leave & attendance)</option>
                    <option value="ADMIN">ADMIN (Full access including payroll locking)</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Create Account
              </button>
            </form>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3 bg-[#0B1120] border-b border-slate-800 text-xs font-bold text-slate-200">
              Management Users ({users.length})
            </div>
            <div className="divide-y divide-slate-800">
              {users.map(u => (
                <div key={u.id} className="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-100">{u.full_name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">{u.email}</span>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      u.role === 'ADMIN'
                        ? 'bg-purple-500/20 text-purple-400'
                        : u.role === 'HR'
                        ? 'bg-[#D6B46A]/20 text-[#D6B46A]'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
