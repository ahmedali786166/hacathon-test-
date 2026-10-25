import React, { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle, FileText, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CsvImportModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [csvText, setCsvText] = useState<string>(
`employee_code,first_name,last_name,email,phone,department,designation,join_date,basic_salary
EMP-101,Hamza,Ahmed,hamza@company.com,+923001112233,Engineering,Software Engineer,2026-10-01,90000
EMP-102,Zainab,Fatima,zainab@company.com,+923002223344,Human Resources,HR Executive,2026-10-01,75000`
  );

  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parseCsvToJson = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = parts[idx] || '';
      });
      rows.push(obj);
    }
    return rows;
  };

  const handlePreview = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const rows = parseCsvToJson(csvText);
      if (rows.length === 0) {
        throw new Error('No valid CSV rows parsed. Check your CSV header and data rows.');
      }

      const res = await apiFetch<any>('/api/employees/import-csv', {
        method: 'POST',
        body: JSON.stringify({ rows, execute: false }),
      });
      setPreviewData(res);
    } catch (err: any) {
      setError(err.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    setError(null);
    setLoading(true);

    try {
      const rows = parseCsvToJson(csvText);
      const res = await apiFetch<any>('/api/employees/import-csv', {
        method: 'POST',
        body: JSON.stringify({ rows, execute: true }),
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Import execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#0F172A] border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-800 bg-[#0B1120] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D6B46A]/20 text-[#D6B46A] border border-[#D6B46A]/30 flex items-center justify-center font-bold">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Batch Employee CSV Import</h3>
              <p className="text-[11px] text-slate-400">Dry-run validation with duplicate detection & confirmation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Paste CSV Content</span>
              <span className="text-[10px] text-slate-400 font-normal">Header row required</span>
            </label>
            <textarea
              rows={6}
              value={csvText}
              onChange={e => {
                setCsvText(e.target.value);
                setPreviewData(null);
              }}
              className="w-full bg-[#111827] border border-slate-700 font-mono text-xs text-slate-200 rounded-lg p-3 focus:outline-none focus:border-[#D6B46A]"
            />
          </div>

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading || !csvText.trim()}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Run Dry-Run Validation
            </button>
          </div>

          {/* Validation Results */}
          {previewData && (
            <div className="p-4 bg-[#162032] border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Validation Summary</span>
                <div className="flex gap-3 text-[11px]">
                  <span className="text-emerald-400 font-semibold">{previewData.validCount} Valid Rows</span>
                  {previewData.errorCount > 0 && (
                    <span className="text-rose-400 font-semibold">{previewData.errorCount} Errors</span>
                  )}
                </div>
              </div>

              {previewData.errors?.length > 0 ? (
                <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
                  {previewData.errors.map((err: any, i: number) => (
                    <div key={i} className="text-rose-400 bg-rose-500/10 p-2 rounded text-[11px]">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                  All {previewData.validCount} rows passed schema, department, designation, and uniqueness checks!
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={loading || !previewData || previewData.errorCount > 0}
              className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#D6B46A] to-amber-600 rounded-lg hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Importing...' : 'Confirm & Import to Database'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
