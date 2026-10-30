import React, { useState } from 'react';
import { Building, ShieldCheck, Clock, CheckCircle, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  onSetupComplete: (user: any, token: string) => void;
  onGoToLogin?: () => void;
  requireCurrentPassword?: boolean;
}

export const FirstRunSetup: React.FC<Props> = ({ onSetupComplete, onGoToLogin, requireCurrentPassword = false }) => {
  const [companyName, setCompanyName] = useState('Saylani Technology Solutions');
  const [legalName, setLegalName] = useState('Saylani Technology Solutions (Pvt.) Ltd.');
  const [officeAddress, setOfficeAddress] = useState('Shahrah-e-Faisal, Karachi, Pakistan');
  const [startTime, setStartTime] = useState('09:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [halfDayHours, setHalfDayHours] = useState(5.0);

  const [adminName, setAdminName] = useState('System Administrator');
  const [adminEmail, setAdminEmail] = useState('admin@saylani.org');
  const [adminPassword, setAdminPassword] = useState('Admin@1234');
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<any>('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify({
          companyName,
          legalName,
          officeAddress,
          startTime,
          graceMinutes,
          halfDayHours,
          adminName,
          adminEmail,
          adminPassword,
          currentAdminPassword: requireCurrentPassword ? currentAdminPassword : undefined,
        }),
      });

      localStorage.setItem('hcm_token', res.token);
      onSetupComplete(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-center items-center p-6 selection:bg-[#D6B46A] selection:text-slate-950">
      <div className="w-full max-w-2xl bg-[#0F172A] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D6B46A] to-amber-600 items-center justify-center shadow-lg shadow-[#D6B46A]/20 mb-2">
            <Building className="w-6 h-6 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            HCM Lite Setup Wizard
          </h1>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Saylani Hackathon Edition. Initialize your company settings and create the primary Administrator account. The fresh database will contain zero dummy business records.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {onGoToLogin && (
              <button
                type="button"
                onClick={onGoToLogin}
                className="self-start mt-1 px-3 py-1.5 rounded-lg bg-[#D6B46A] text-slate-950 font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer"
              >
                Go to Sign In →
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Company Profile */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D6B46A] uppercase tracking-wider">
              <Building className="w-3.5 h-3.5" />
              <span>1. Company Profile</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Legal Name</label>
                <input
                  type="text"
                  value={legalName}
                  onChange={e => setLegalName(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Office Address</label>
              <input
                type="text"
                value={officeAddress}
                onChange={e => setOfficeAddress(e.target.value)}
                className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          </div>

          {/* Section 2: Office & Attendance Rules */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D6B46A] uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5" />
              <span>2. Office Attendance Rules</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Start Time</label>
                <input
                  type="text"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">09:00 AM default</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Grace Period</label>
                <input
                  type="number"
                  value={graceMinutes}
                  onChange={e => setGraceMinutes(Number(e.target.value))}
                  className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">15 min (Late after 09:15)</span>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Half-Day Threshold</label>
                <input
                  type="number"
                  step="0.5"
                  value={halfDayHours}
                  onChange={e => setHalfDayHours(Number(e.target.value))}
                  className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">Under 5.0 hours worked</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              Default Leave Quotas: <strong>Annual: 14 days</strong>, <strong>Sick: 8 days</strong>, <strong>Casual: 10 days</strong>, <strong>Unpaid: Unlimited</strong>.
            </div>
          </div>

          {/* Section 3: Primary Admin User */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D6B46A] uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{requireCurrentPassword ? '3. Update Administrator Credentials' : '3. Primary Administrator Credentials'}</span>
            </div>
            {requireCurrentPassword && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-300">
                System is already initialized. Enter the <strong>current admin password</strong> below to update the company settings and set a new login email/password.
              </div>
            )}
            <div className={`grid grid-cols-1 gap-3 ${requireCurrentPassword ? '' : 'md:grid-cols-3'}`}>
              <div className={requireCurrentPassword ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : ''}>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={e => setAdminEmail(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
              </div>
              <div className={requireCurrentPassword ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : ''}>
                {requireCurrentPassword && (
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-300 mb-1">Current Admin Password</label>
                    <input
                      type="password"
                      required
                      value={currentAdminPassword}
                      onChange={e => setCurrentAdminPassword(e.target.value)}
                      placeholder="Password you currently sign in with"
                      className="w-full bg-[#111827] border border-amber-500/50 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    {requireCurrentPassword ? 'New Password' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="w-full bg-[#111827] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-[#D6B46A]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#D6B46A] via-amber-500 to-[#D6B46A] text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-[#D6B46A]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{loading ? (requireCurrentPassword ? 'Updating Credentials...' : 'Initializing System...') : (requireCurrentPassword ? 'Update Credentials & Enter HCM Lite' : 'Complete Initialization & Enter HCM Lite')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              {requireCurrentPassword
                ? 'Your new email and password will be used for all future sign ins.'
                : 'Public Admin registration will be permanently closed once initialized.'}
            </p>
            {onGoToLogin && (
              <div className="text-center pt-3 border-t border-slate-800/80 mt-3">
                <button
                  type="button"
                  onClick={onGoToLogin}
                  className="text-xs text-[#D6B46A] hover:underline font-semibold cursor-pointer"
                >
                  Already initialized? Sign In to your account →
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
