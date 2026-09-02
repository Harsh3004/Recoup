import React from 'react';
import { Shield, Sparkles, Cpu, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  activeModel: string;
  auditEventsCount: number;
  onOpenAiSettings: () => void;
  onOpenVerifyModal: () => void;
  onOpenTamperModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModel,
  auditEventsCount,
  onOpenAiSettings,
  onOpenVerifyModal,
  onOpenTamperModal,
}) => {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 mb-8 border-b border-white/[0.08]">
      {/* Brand Identity */}
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center font-extrabold text-2xl text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/20">
          R
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Recoup</h1>
            <span className="px-2 py-0.5 text-xs font-bold tracking-wide uppercase bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-md">
              Autonomous Recovery
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-normal mt-0.5">
            Multi-Surface Failed Payment Recovery &amp; Autonomous Compliance Engine
          </p>
        </div>
      </div>

      {/* Global Actions & Status Indicators */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Active AI Model Badge */}
        <div
          onClick={onOpenAiSettings}
          className="flex items-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/25 px-3 py-1.5 rounded-full text-xs text-indigo-300 cursor-pointer transition-all duration-200 group"
          title="Click to configure AI reasoning model"
        >
          <div className="w-2 h-2 rounded-full bg-indigo-400 radar-pulse-indigo"></div>
          <span>
            AI: <strong className="text-white font-semibold group-hover:text-indigo-200">{activeModel || 'minimax/minimax-m3:free'}</strong>
          </span>
        </div>

        {/* Audit Chain Status Badge */}
        <div
          onClick={onOpenVerifyModal}
          className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-3 py-1.5 rounded-full text-xs text-emerald-300 cursor-pointer transition-all duration-200 group"
          title="Click to verify cryptographic hash chain"
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400 radar-pulse"></div>
          <span>
            Chain: <strong className="text-white font-semibold group-hover:text-emerald-200">{auditEventsCount.toLocaleString()}</strong> Verified
          </span>
        </div>

        {/* AI Settings Button */}
        <button
          onClick={onOpenAiSettings}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] hover:border-white/[0.18] transition-all duration-200 shadow-sm"
        >
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>AI Settings</span>
        </button>

        {/* Verify Chain Button */}
        <button
          onClick={onOpenVerifyModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md shadow-indigo-600/30 transition-all duration-200 hover:-translate-y-0.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200" />
          <span>Verify Chain</span>
        </button>

        {/* Tamper Test Button */}
        <button
          onClick={onOpenTamperModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/30 transition-all duration-200"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          <span>Test Tamper Proof</span>
        </button>
      </div>
    </header>
  );
};
