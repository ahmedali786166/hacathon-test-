import React, { useState } from 'react';
import { Building, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Props {
  onLoginSuccess: (user: any, token: string) => void;
  companyName?: string;
  onGoToSetup?: () => void;
}

export const LoginPage: React.FC<Props> = ({ onLoginSuccess, companyName = 'HCM Lite', onGoToSetup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem('hcm_token', res.token);
      onLoginSuccess(res.user, res.token);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-center items-center p-6 selection:bg-[#D6B46A] selection:text-slate-950">
      <div className="w-full max-w-md bg-[#0F172A] border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D6B46A] to-amber-600 items-center justify-center shadow-lg shadow-[#D6B46A]/20 mb-2">
            <Building className="w-6 h-6 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{companyName}</h1>
          <p className="text-xs text-slate-400">Sign in to your Human Capital Management portal</p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@saylani.org"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#111827] border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-6 rounded-xl bg-gradient-to-r from-[#D6B46A] via-amber-500 to-[#D6B46A] text-slate-950 font-bold text-xs tracking-wider uppercase shadow-lg shadow-[#D6B46A]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'Signing in...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-center text-slate-400 space-y-2">
          <div>Role-based security active: Admin, HR, and Employee permissions enforced server-side.</div>
          {onGoToSetup && (
            <div>
              <button
                type="button"
                onClick={onGoToSetup}
                className="text-[#D6B46A] hover:underline cursor-pointer"
              >
                New here? Sign Up & Create Your Company →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
