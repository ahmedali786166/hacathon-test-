import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sparkles, User, ShieldCheck, CheckCheck } from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  title: string;
  user: {
    full_name: string;
    email: string;
    role: 'ADMIN' | 'HR' | 'EMPLOYEE';
  };
  onOpenAi: () => void;
}

export const Header: React.FC<Props> = ({ title, user, onOpenAi }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch<{ notifications: any[]; unreadCount: number }>('/api/communication/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {}
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/communication/notifications/mark-read', { method: 'PATCH', body: JSON.stringify({}) });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch {}
  };

  return (
    <header className="h-16 bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Title & Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>HCM Lite</span>
          <span>/</span>
          <span className="text-[#D6B46A] capitalize font-medium">{title}</span>
        </div>
        <h2 className="text-base font-bold text-slate-100 tracking-tight capitalize">{title}</h2>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* System Date Badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Saturday, Oct 24, 2026 (PKT)</span>
        </div>

        {/* AI Assistant Quick Launcher */}
        <button
          onClick={onOpenAi}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D6B46A]/10 hover:bg-[#D6B46A]/20 border border-[#D6B46A]/40 text-[#D6B46A] text-xs font-semibold shadow-sm transition-all cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Assistant</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#D6B46A] text-[#0B1120] text-[9px] font-extrabold flex items-center justify-center shadow">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#162032] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="p-3 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-[#D6B46A] hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`p-3 text-xs transition-colors ${
                        n.is_read ? 'opacity-70 bg-transparent' : 'bg-[#D6B46A]/5'
                      }`}
                    >
                      <div className="font-semibold text-slate-200 flex items-center justify-between">
                        <span>{n.title}</span>
                        {!n.is_read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D6B46A]" />
                        )}
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">{n.message}</p>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center text-xs font-bold text-white">
            {user.full_name?.charAt(0) || 'U'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{user.full_name}</div>
            <div className="text-[10px] text-[#D6B46A] font-bold tracking-wider">{user.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
