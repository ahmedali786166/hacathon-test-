import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Upload,
  Download,
  Building2,
  Briefcase,
  Eye,
  Edit2,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { apiFetch } from '../api/client.js';
import { EmployeeModal } from '../components/EmployeeModal.js';
import { Employee360Drawer } from '../components/Employee360Drawer.js';
import { CsvImportModal } from '../components/CsvImportModal.js';
import { formatPKR } from '../../server/services/payrollCalculations.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
  onNavigateToOrgSettings: () => void;
}

export const EmployeePage: React.FC<Props> = ({ userRole, onNavigateToOrgSettings }) => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<any>({ total: 0, totalPages: 1 });

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<any | null>(null);
  const [selected360Id, setSelected360Id] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);

  const fetchDepartments = async () => {
    try {
      const res = await apiFetch<any>('/api/organization/departments');
      setDepartments(res.departments || []);
    } catch {}
  };

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        search,
        departmentId,
        status,
        page: page.toString(),
        limit: '15',
      });
      const res = await apiFetch<any>(`/api/employees?${params.toString()}`);
      setEmployees(res.employees || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, departmentId, status, page]);

  const handleExportCsv = () => {
    if (employees.length === 0) return;
    const isPrivileged = userRole === 'ADMIN' || userRole === 'HR';
    const headers = isPrivileged
      ? ['Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Designation', 'Join Date', 'Status', 'Basic Salary']
      : ['Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Department', 'Designation', 'Join Date', 'Status'];

    const rows = employees.map(e => {
      const row = [
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.phone || '',
        e.department_name || '',
        e.designation_title || '',
        e.join_date,
        e.status,
      ];
      if (isPrivileged) {
        row.push(e.basic_salary?.toString() || '0');
      }
      return row.join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canManage = userRole === 'ADMIN' || userRole === 'HR';

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#D6B46A]" /> Employee Directory
          </h2>
          <p className="text-xs text-slate-400">
            {pagination.total} registered staff members across all departments
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            disabled={employees.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {canManage && (
            <>
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import CSV</span>
              </button>

              <button
                onClick={() => {
                  setEmployeeToEdit(null);
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-[#D6B46A]/20 hover:opacity-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register Employee</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, employee code, or email..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#162032] border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
          />
        </div>

        {/* Department Filter */}
        <div className="w-full md:w-56">
          <select
            value={departmentId}
            onChange={e => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#162032] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#D6B46A]"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-36">
          <select
            value={status}
            onChange={e => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#162032] border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#D6B46A]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {error && (
          <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Department & Designation</th>
                <th className="py-3.5 px-4">Join Date</th>
                <th className="py-3.5 px-4">Status</th>
                {canManage && <th className="py-3.5 px-4">Basic Salary</th>}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#D6B46A] mb-2" />
                    <span>Loading verified employee directory...</span>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 7 : 6} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-300 mb-1">Zero employee records found.</p>
                    <p className="text-xs text-slate-400">
                      {search || departmentId
                        ? 'Try clearing your search query or filters.'
                        : 'Register your first employee or configure departments in Organization Settings.'}
                    </p>
                    {canManage && !search && !departmentId && (
                      <button
                        onClick={() => {
                          setEmployeeToEdit(null);
                          setIsModalOpen(true);
                        }}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D6B46A]/20 hover:bg-[#D6B46A]/30 text-[#D6B46A] border border-[#D6B46A]/40 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Register First Employee
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100">{emp.first_name} {emp.last_name}</div>
                          <div className="text-[10px] text-slate-400">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#D6B46A] font-semibold">
                      {emp.employee_code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{emp.department_name || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400">{emp.designation_title || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {emp.join_date}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          emp.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {emp.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3 px-4 font-mono font-semibold text-slate-200">
                        {emp.basic_salary !== undefined ? formatPKR(emp.basic_salary) : '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelected360Id(emp.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="View Employee 360"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button
                            onClick={() => {
                              setEmployeeToEdit(emp);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-[#D6B46A]/20 text-slate-300 hover:text-[#D6B46A] transition-colors cursor-pointer"
                            title="Edit Employee"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-3.5 bg-[#0B1120] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals & Drawers */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchEmployees();
        }}
        employeeToEdit={employeeToEdit}
        onNavigateToOrgSettings={onNavigateToOrgSettings}
      />

      <Employee360Drawer
        employeeId={selected360Id}
        onClose={() => setSelected360Id(null)}
        userRole={userRole}
      />

      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        onSuccess={() => {
          fetchEmployees();
        }}
      />
    </div>
  );
};
