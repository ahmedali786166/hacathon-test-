import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, Check, AlertCircle, RefreshCw, PlusCircle, Building2, Briefcase } from 'lucide-react';
import { apiFetch } from '../api/client.js';

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Designation {
  id: string;
  department_id: string;
  title: string;
  code: string;
}

interface Props {
  selectedDepartmentId: string;
  selectedDesignationId: string;
  onDepartmentChange: (departmentId: string, departmentName: string) => void;
  onDesignationChange: (designationId: string, designationTitle: string) => void;
  onNavigateToOrgSettings?: () => void;
  disabled?: boolean;
}

export const DepartmentDesignationCombobox: React.FC<Props> = ({
  selectedDepartmentId,
  selectedDesignationId,
  onDepartmentChange,
  onDesignationChange,
  onNavigateToOrgSettings,
  disabled = false,
}) => {
  // Department state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState<boolean>(false);
  const [deptError, setDeptError] = useState<string | null>(null);
  const [isDeptOpen, setIsDeptOpen] = useState<boolean>(false);
  const [deptSearch, setDeptSearch] = useState<string>('');

  // Designation state
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loadingDesigs, setLoadingDesigs] = useState<boolean>(false);
  const [desigError, setDesigError] = useState<string | null>(null);
  const [isDesigOpen, setIsDesigOpen] = useState<boolean>(false);
  const [desigSearch, setDesigSearch] = useState<string>('');

  const deptDropdownRef = useRef<HTMLDivElement>(null);
  const desigDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(event.target as Node)) {
        setIsDeptOpen(false);
      }
      if (desigDropdownRef.current && !desigDropdownRef.current.contains(event.target as Node)) {
        setIsDesigOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Fetch departments on mount
  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setDeptError(null);
    try {
      const res = await apiFetch<{ departments: Department[] }>('/api/organization/departments');
      setDepartments(res.departments || []);
    } catch (err: any) {
      setDeptError(err.message || 'Failed to load departments');
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // 2. Fetch designations when selectedDepartmentId changes
  const fetchDesignations = async (deptId: string) => {
    if (!deptId) {
      setDesignations([]);
      return;
    }
    setLoadingDesigs(true);
    setDesigError(null);
    try {
      const res = await apiFetch<{ designations: Designation[] }>(`/api/organization/designations?departmentId=${deptId}`);
      setDesignations(res.designations || []);
    } catch (err: any) {
      setDesigError(err.message || 'Failed to load designations');
    } finally {
      setLoadingDesigs(false);
    }
  };

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchDesignations(selectedDepartmentId);
    } else {
      setDesignations([]);
    }
  }, [selectedDepartmentId]);

  // Selected names
  const currentDept = departments.find(d => d.id === selectedDepartmentId);
  const currentDesig = designations.find(d => d.id === selectedDesignationId);

  // Filtered lists
  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(deptSearch.toLowerCase()) ||
    d.code.toLowerCase().includes(deptSearch.toLowerCase())
  );

  const filteredDesignations = designations.filter(d =>
    d.title.toLowerCase().includes(desigSearch.toLowerCase()) ||
    d.code.toLowerCase().includes(desigSearch.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* ---------------- Department Dropdown ---------------- */}
      <div className="relative" ref={deptDropdownRef}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#D6B46A]" />
            Department <span className="text-rose-400">*</span>
          </span>
          {loadingDepts && <span className="text-[10px] text-slate-400 font-normal">Loading...</span>}
        </label>

        <button
          type="button"
          disabled={disabled || loadingDepts}
          onClick={() => {
            setIsDeptOpen(!isDeptOpen);
            setIsDesigOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-sm text-left transition-all ${
            isDeptOpen
              ? 'bg-[#111827] border-[#D6B46A] ring-1 ring-[#D6B46A]'
              : 'bg-[#111827] border-slate-700/80 hover:border-slate-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={currentDept ? 'text-slate-100 font-medium' : 'text-slate-400'}>
            {loadingDepts ? 'Loading departments...' : currentDept ? currentDept.name : 'Select Department'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDeptOpen ? 'rotate-180 text-[#D6B46A]' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isDeptOpen && (
          <div className="absolute left-0 right-0 mt-1 z-50 bg-[#162032] border border-slate-700 rounded-lg shadow-2xl overflow-hidden backdrop-blur-md">
            {/* Search Input */}
            <div className="p-2 border-b border-slate-800 bg-[#0F172A]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search department..."
                  value={deptSearch}
                  onChange={e => setDeptSearch(e.target.value)}
                  className="w-full bg-[#1A253A] border border-slate-700/80 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-800/40">
              {deptError ? (
                <div className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{deptError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchDepartments}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : filteredDepartments.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400 mb-2">
                    {departments.length === 0
                      ? 'No departments exist in the database yet.'
                      : 'No departments match your search.'}
                  </p>
                  {onNavigateToOrgSettings && departments.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeptOpen(false);
                        onNavigateToOrgSettings();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D6B46A]/20 hover:bg-[#D6B46A]/30 text-[#D6B46A] border border-[#D6B46A]/40 rounded-md text-xs font-medium transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Create Department in Settings
                    </button>
                  )}
                </div>
              ) : (
                filteredDepartments.map(dept => {
                  const isSelected = dept.id === selectedDepartmentId;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => {
                        onDepartmentChange(dept.id, dept.name);
                        // Clear previous designation since department changed
                        onDesignationChange('', '');
                        setIsDeptOpen(false);
                        setDeptSearch('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded text-left transition-colors ${
                        isSelected
                          ? 'bg-[#D6B46A]/20 text-[#D6B46A] font-semibold'
                          : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{dept.name}</div>
                        <div className="text-[10px] text-slate-400">Code: {dept.code}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#D6B46A]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Designation Dropdown ---------------- */}
      <div className="relative" ref={desigDropdownRef}>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-[#D6B46A]" />
            Designation <span className="text-rose-400">*</span>
          </span>
          {loadingDesigs && <span className="text-[10px] text-slate-400 font-normal">Loading...</span>}
        </label>

        <button
          type="button"
          disabled={disabled || !selectedDepartmentId || loadingDesigs}
          onClick={() => {
            if (!selectedDepartmentId) return;
            setIsDesigOpen(!isDesigOpen);
            setIsDeptOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-sm text-left transition-all ${
            isDesigOpen
              ? 'bg-[#111827] border-[#D6B46A] ring-1 ring-[#D6B46A]'
              : 'bg-[#111827] border-slate-700/80 hover:border-slate-600'
          } ${disabled || !selectedDepartmentId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span className={currentDesig ? 'text-slate-100 font-medium' : 'text-slate-400'}>
            {!selectedDepartmentId
              ? 'Select Department first'
              : loadingDesigs
              ? 'Loading designations...'
              : currentDesig
              ? currentDesig.title
              : 'Select Designation'}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDesigOpen ? 'rotate-180 text-[#D6B46A]' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isDesigOpen && (
          <div className="absolute left-0 right-0 mt-1 z-50 bg-[#162032] border border-slate-700 rounded-lg shadow-2xl overflow-hidden backdrop-blur-md">
            {/* Search Input */}
            <div className="p-2 border-b border-slate-800 bg-[#0F172A]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search designation..."
                  value={desigSearch}
                  onChange={e => setDesigSearch(e.target.value)}
                  className="w-full bg-[#1A253A] border border-slate-700/80 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-800/40">
              {desigError ? (
                <div className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-rose-400 text-xs mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{desigError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchDesignations(selectedDepartmentId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              ) : filteredDesignations.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400 mb-2">
                    {designations.length === 0
                      ? `No designations registered for ${currentDept?.name || 'this department'}.`
                      : 'No designations match your search.'}
                  </p>
                  {onNavigateToOrgSettings && designations.length === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDesigOpen(false);
                        onNavigateToOrgSettings();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#D6B46A]/20 hover:bg-[#D6B46A]/30 text-[#D6B46A] border border-[#D6B46A]/40 rounded-md text-xs font-medium transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add Designation in Settings
                    </button>
                  )}
                </div>
              ) : (
                filteredDesignations.map(desig => {
                  const isSelected = desig.id === selectedDesignationId;
                  return (
                    <button
                      key={desig.id}
                      type="button"
                      onClick={() => {
                        onDesignationChange(desig.id, desig.title);
                        setIsDesigOpen(false);
                        setDesigSearch('');
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded text-left transition-colors ${
                        isSelected
                          ? 'bg-[#D6B46A]/20 text-[#D6B46A] font-semibold'
                          : 'text-slate-200 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{desig.title}</div>
                        <div className="text-[10px] text-slate-400">Code: {desig.code}</div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#D6B46A]" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
