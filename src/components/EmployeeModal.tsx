import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle, RefreshCw, UserPlus, UserCheck } from 'lucide-react';
import { DepartmentDesignationCombobox } from './DepartmentDesignationCombobox.js';
import { apiFetch } from '../api/client.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employeeToEdit?: any | null;
  onNavigateToOrgSettings: () => void;
}

export const EmployeeModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  employeeToEdit,
  onNavigateToOrgSettings,
}) => {
  const [employeeCode, setEmployeeCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [joinDate, setJoinDate] = useState('2026-10-01');
  const [basicSalary, setBasicSalary] = useState<number>(80000);
  const [status, setStatus] = useState('ACTIVE');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (employeeToEdit) {
      setEmployeeCode(employeeToEdit.employee_code || '');
      setFirstName(employeeToEdit.first_name || '');
      setLastName(employeeToEdit.last_name || '');
      setEmail(employeeToEdit.email || '');
      setPhone(employeeToEdit.phone || '');
      setDepartmentId(employeeToEdit.department_id || '');
      setDesignationId(employeeToEdit.designation_id || '');
      setJoinDate(employeeToEdit.join_date || '2026-10-01');
      setBasicSalary(employeeToEdit.basic_salary ?? 80000);
      setStatus(employeeToEdit.status || 'ACTIVE');
    } else {
      // Auto-generate a clean placeholder code if new
      setEmployeeCode(`EMP-${Math.floor(100 + Math.random() * 900)}`);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setDepartmentId('');
      setDesignationId('');
      setJoinDate('2026-10-01');
      setBasicSalary(80000);
      setStatus('ACTIVE');
    }
    setError(null);
  }, [employeeToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!employeeCode || !firstName || !lastName || !email || !departmentId || !designationId) {
      setError('Please fill in all mandatory fields (Employee Code, Names, Email, Department, Designation).');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        employee_code: employeeCode.trim().toUpperCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        department_id: departmentId,
        designation_id: designationId,
        join_date: joinDate,
        basic_salary: Number(basicSalary) || 0,
        status,
      };

      if (employeeToEdit) {
        await apiFetch(`/api/employees/${employeeToEdit.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/employees', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save employee record');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0B1120] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D6B46A]/20 text-[#D6B46A] border border-[#D6B46A]/30 flex items-center justify-center font-bold">
              {employeeToEdit ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                {employeeToEdit ? 'Edit Employee Record' : 'Register New Employee'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {employeeToEdit ? `Updating profile for ${employeeCode}` : 'Create a new employee profile with department & designation'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Code and Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Employee Code <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={employeeCode}
                onChange={e => setEmployeeCode(e.target.value)}
                placeholder="e.g. EMP-001"
                disabled={Boolean(employeeToEdit)}
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Employment Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
          </div>

          {/* Row 2: Names */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                First Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="e.g. Tariq"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Last Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder="e.g. Mehmood"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          </div>

          {/* Row 3: Email and Phone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Work Email <span className="text-rose-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tariq@company.com"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+92 300 1234567"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          </div>

          {/* CRITICAL: Department and Designation Combobox */}
          <div className="p-4 bg-[#111827]/60 border border-slate-800 rounded-xl space-y-2">
            <DepartmentDesignationCombobox
              selectedDepartmentId={departmentId}
              selectedDesignationId={designationId}
              onDepartmentChange={(deptId) => setDepartmentId(deptId)}
              onDesignationChange={(desigId) => setDesignationId(desigId)}
              onNavigateToOrgSettings={() => {
                onClose();
                onNavigateToOrgSettings();
              }}
            />
          </div>

          {/* Row 4: Join Date and Basic Salary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Join Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                value={joinDate}
                onChange={e => setJoinDate(e.target.value)}
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Basic Monthly Salary (PKR) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                value={basicSalary}
                onChange={e => setBasicSalary(Number(e.target.value))}
                min="0"
                step="1000"
                placeholder="80000"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-lg px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Gross will calculate to 1.5× Basic (PKR {(basicSalary * 1.5).toLocaleString()})
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#D6B46A] to-amber-600 hover:opacity-95 rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{employeeToEdit ? 'Update Employee' : 'Save Employee'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
