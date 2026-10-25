import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Bot, User, AlertCircle, Wrench, RefreshCw, Languages } from 'lucide-react';
import { apiFetch } from '../api/client.js';

interface Message {
  role: 'user' | 'model';
  text: string;
  toolsCalled?: string[];
  timestamp: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userRole: 'ADMIN' | 'HR' | 'EMPLOYEE';
}

export const AiAssistantDrawer: React.FC<Props> = ({ isOpen, onClose, userRole }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text:
        userRole === 'EMPLOYEE'
          ? 'Assalam-o-Alaikum! Main HCM Lite AI Assistant hoon. Aap mujh se Roman Urdu ya English mein apne leave balance, attendance aur policies ke baray mein pooch sakte hain.'
          : 'Assalam-o-Alaikum! Main HCM Lite AI Assistant hoon. Aap mujh se Roman Urdu ya English mein aaj ki attendance, late employees, chuttiyan (leaves), headcount ya payroll summary ke baray mein pooch sakte hain.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<Array<{ label: string; text: string; lang: string }>>([]);
  const [statusInfo, setStatusInfo] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      fetchSuggested();
      fetchStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const fetchSuggested = async () => {
    try {
      const res = await apiFetch<any>('/api/ai/suggested-prompts');
      setSuggestedPrompts(res.prompts || []);
    } catch {}
  };

  const fetchStatus = async () => {
    try {
      const res = await apiFetch<any>('/api/ai/status');
      setStatusInfo(res);
    } catch {}
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: Message = {
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Send message along with history
      const historyPayload = messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await apiFetch<{ reply?: string; response?: string; text?: string; toolsCalled: string[]; timestamp: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          prompt: text,
          history: historyPayload,
        }),
      });

      const replyText = res.reply || res.response || res.text || '';
      const modelMsg: Message = {
        role: 'model',
        text: replyText,
        toolsCalled: res.toolsCalled,
        timestamp: new Date(res.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, modelMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        role: 'model',
        text: `Error: ${err.message || 'Unable to connect to Gemini Assistant. Please try again.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-[#0F172A] border-l border-slate-700/80 shadow-2xl flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-[#0B1120] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D6B46A] to-amber-600 flex items-center justify-center text-[#0B1120] font-bold shadow-md shadow-[#D6B46A]/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">Gemini AI Assistant</h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {statusInfo?.model || 'Gemini Flash'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Languages className="w-3 h-3 text-[#D6B46A]" /> English & Roman Urdu
              </span>
              <span>•</span>
              <span>20 req/hr</span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                m.role === 'user'
                  ? 'bg-slate-700 text-white'
                  : 'bg-[#D6B46A]/20 text-[#D6B46A] border border-[#D6B46A]/30'
              }`}
            >
              {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
            </div>

            <div className={`max-w-[82%] space-y-1.5 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed inline-block ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-amber-600 to-[#D6B46A] text-slate-950 font-medium rounded-tr-none'
                    : 'bg-[#1E293B] text-slate-200 border border-slate-700/80 rounded-tl-none shadow-md'
                }`}
              >
                {/* Tools called badge */}
                {m.toolsCalled && m.toolsCalled.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {m.toolsCalled.map((tool, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900/90 text-[#D6B46A] border border-[#D6B46A]/30"
                      >
                        <Wrench className="w-2.5 h-2.5" />
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>
              <div className="text-[9px] text-slate-400 px-1">{m.timestamp}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-[#D6B46A]/20 text-[#D6B46A] border border-[#D6B46A]/30 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="p-3 rounded-2xl bg-[#1E293B] border border-slate-700/80 rounded-tl-none flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-[#D6B46A] animate-spin" />
              <span className="text-xs text-slate-400">Gemini is querying verified database tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts Pills */}
      {suggestedPrompts.length > 0 && (
        <div className="px-4 py-2 border-t border-slate-800/80 bg-[#0B1120]/50 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-2">
          {suggestedPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p.text)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 hover:bg-[#D6B46A]/20 border border-slate-700 hover:border-[#D6B46A]/40 text-slate-300 hover:text-[#D6B46A] transition-all flex-shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 border-t border-slate-800 bg-[#0B1120]">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Type in Roman Urdu or English..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-[#1A253A] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#D6B46A]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-xl bg-gradient-to-r from-[#D6B46A] to-amber-600 text-slate-950 font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-1 text-[9px] text-center text-slate-400">
          Answers are strictly verified against authorized backend records.
        </div>
      </div>
    </div>
  );
};
