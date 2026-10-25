import React, { useState, useEffect } from 'react';
import { ShieldAlert, Search, RefreshCw, Filter } from 'lucide-react';
import { apiFetch } from '../api/client.js';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [actorEmail, setActorEmail] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pagination, setPagination] = useState<any>({ total: 0, totalPages: 1 });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: actionFilter,
        actorEmail,
        page: page.toString(),
        limit: '25',
      });
      const res = await apiFetch<any>(`/api/audit?${params.toString()}`);
      setLogs(res.logs || []);
      setPagination(res.pagination || { total: 0, totalPages: 1 });
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, actorEmail, page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#D6B46A]" /> System Audit Trail
          </h2>
          <p className="text-xs text-slate-400">
            Immutable security ledger tracking administrative, organizational, payroll, and employee modifications.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-[#111827] border border-slate-800 rounded-2xl flex flex-wrap gap-3">
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter by action (e.g. LOCK, CREATE)..."
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100"
          />
        </div>
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter by actor email..."
            value={actorEmail}
            onChange={e => {
              setActorEmail(e.target.value);
              setPage(1);
            }}
            className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100"
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#0B1120] text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">State Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#D6B46A] mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Zero audit events matched your search.
                  </td>
                </tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-semibold text-slate-200">{l.actor_email}</span>
                      <span className="text-[10px] text-[#D6B46A] block font-bold">{l.actor_role}</span>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-100">
                      {l.action}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {l.target_type}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[10px] text-slate-400 max-w-sm truncate">
                      {l.after_state || l.before_state || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="p-3 bg-[#0B1120] border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>Page {pagination.page} of {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1 bg-slate-800 rounded disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                className="px-2.5 py-1 bg-slate-800 rounded disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
