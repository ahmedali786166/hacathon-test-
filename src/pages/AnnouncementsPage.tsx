import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, AlertCircle, CheckCircle, RefreshCw, Send, Tag } from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const AnnouncementsPage: React.FC<Props> = ({ userRole }) => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [targetAudience, setTargetAudience] = useState<string>('ALL');
  const [priority, setPriority] = useState<string>('NORMAL');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>('/api/communication/announcements');
      setAnnouncements(res.announcements || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await apiFetch('/api/communication/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          target_audience: targetAudience,
          priority,
        }),
      });
      setTitle('');
      setContent('');
      setIsCreating(false);
      setFeedback('Announcement published.');
      fetchAnnouncements();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const canPost = userRole === 'ADMIN' || userRole === 'HR';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#D6B46A]" /> Company Announcements
          </h2>
          <p className="text-xs text-slate-400">Official updates, policy notices, and corporate broadcasts</p>
        </div>

        {canPost && !isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 text-xs font-bold rounded-xl shadow cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Post Announcement</span>
          </button>
        )}
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300">
          {feedback}
        </div>
      )}

      {/* Publisher Form */}
      {isCreating && (
        <div className="p-6 bg-[#111827] border border-slate-800 rounded-3xl shadow-xl space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-100">Broadcast New Announcement</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Annual Company Townhall Meeting"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Message Body</label>
              <textarea
                rows={4}
                required
                placeholder="Type full announcement details..."
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full bg-[#162032] border border-slate-700 rounded-xl p-3 text-xs text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Target Audience</label>
                <select
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                >
                  <option value="ALL">All Staff</option>
                  <option value="EMPLOYEE">Employees Only</option>
                  <option value="HR">HR Team Only</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  className="w-full bg-[#162032] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100"
                >
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent Alert</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-slate-800 text-xs text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="px-5 py-2 bg-[#D6B46A] text-slate-950 font-bold text-xs rounded-lg"
              >
                {createLoading ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4 max-w-3xl">
        {loading ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto text-[#D6B46A] mb-2" />
            <span>Loading announcements...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 bg-[#111827] border border-slate-800 rounded-2xl">
            No announcements broadcast yet.
          </div>
        ) : (
          announcements.map(a => (
            <div key={a.id} className="p-5 bg-[#111827] border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      a.priority === 'URGENT'
                        ? 'bg-rose-500/20 text-rose-400'
                        : a.priority === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {a.priority}
                  </span>
                  <span className="text-sm font-bold text-slate-100">{a.title}</span>
                </div>
                <span className="text-[10px] text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{a.content}</p>
              <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-800/80 flex justify-between">
                <span>Posted by {a.author_name} ({a.author_role})</span>
                <span>Audience: {a.target_audience}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
