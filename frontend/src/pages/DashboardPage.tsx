import React from 'react';
import { MetricsGrid } from '../components/MetricsGrid';
import { SurfaceSelector } from '../components/SurfaceSelector';
import { IncidentTimeline } from '../components/IncidentTimeline';
import { Counterfactuals } from '../components/Counterfactuals';
import { OverviewData, SurfaceId } from '../types';
import { ArrowRight } from 'lucide-react';
import { RouteId } from '../components/Navigation';

interface DashboardPageProps {
  overviewData: OverviewData | null;
  loadingOverview: boolean;
  currentSurface: SurfaceId;
  onSelectSurface: (surface: SurfaceId) => void;
  onSelectCase: (caseId: string) => void;
  onNavigate: (route: RouteId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  overviewData,
  loadingOverview,
  currentSurface,
  onSelectSurface,
  onSelectCase,
  onNavigate,
}) => {
  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Hero Financial Metrics Strip */}
      <MetricsGrid data={overviewData} loading={loadingOverview} />

      {/* 2. Universal 4-Surfaces Selector */}
      <SurfaceSelector
        currentSurface={currentSurface}
        onSelectSurface={onSelectSurface}
        data={overviewData}
      />

      {/* 3. Split Grid: Injected Outage Replay & Counterfactual Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncidentTimeline onViewOutageCase={onSelectCase} />
        <Counterfactuals data={overviewData} />
      </div>

      {/* 4. Quick Domain Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {/* Case Explorer Quick Link */}
        <div
          onClick={() => onNavigate('cases')}
          className="glass-card glass-card-hover p-4 rounded-xl border border-white/[0.08] cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Operations Triage</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Case Explorer (1,314 Cases)</h4>
            <p className="text-xs text-slate-400">Drill into dunning sequences, promise-to-pay tracking &amp; live Razorpay recovery flags.</p>
          </div>
        </div>

        {/* AI Studio Quick Link */}
        <div
          onClick={() => onNavigate('ai-studio')}
          className="glass-card glass-card-hover p-4 rounded-xl border border-white/[0.08] cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">NLU Intelligence</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">AI Reasoning Studio</h4>
            <p className="text-xs text-slate-400">Test live dispute prompts, benchmark 95.8% accuracy vs regex, and inspect token telemetry.</p>
          </div>
        </div>

        {/* Compliance Rails Quick Link */}
        <div
          onClick={() => onNavigate('compliance')}
          className="glass-card glass-card-hover p-4 rounded-xl border border-white/[0.08] cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Regulatory Choke Point</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">The 9 Stopping Rules</h4>
            <p className="text-xs text-slate-400">Inspect GatePassport cryptographic HMAC tokens, TRAI DLT, and quiet hours radar.</p>
          </div>
        </div>

        {/* Razorpay Rail Quick Link */}
        <div
          onClick={() => onNavigate('razorpay-rail')}
          className="glass-card glass-card-hover p-4 rounded-xl border border-white/[0.08] cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Test-Mode Rail</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Razorpay Live Links &amp; Webhooks</h4>
            <p className="text-xs text-slate-400">Mint authentic Razorpay payment links, test checkout, and trigger real webhook resolutions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
