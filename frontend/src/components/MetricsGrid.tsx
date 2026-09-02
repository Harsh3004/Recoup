import React from 'react';
import { TrendingUp, Wallet, ShieldAlert, Sparkles } from 'lucide-react';
import { OverviewData } from '../types';
import { formatInr } from '../utils/formatters';

interface MetricsGridProps {
  data: OverviewData | null;
  loading: boolean;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ data, loading }) => {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 border border-white/[0.06] relative overflow-hidden">
            <div className="w-24 h-3 rounded skeleton-shimmer mb-3"></div>
            <div className="w-36 h-8 rounded skeleton-shimmer mb-2"></div>
            <div className="w-48 h-3 rounded skeleton-shimmer"></div>
          </div>
        ))}
      </div>
    );
  }

  const { headline } = data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Net Incremental Recovered (R1) */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-emerald-500/30 relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Net Incremental ₹ Recovered (R1)
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight mb-1 font-mono">
          {formatInr(headline.incrementalRecoveredInr)}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
            +{headline.incrementalLiftPct.toFixed(1)}% Lift
          </span>
          <span>over 15% holdout baseline</span>
        </div>
      </div>

      {/* 2. Gross Treatment Cash Collected */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-white/[0.08] relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Gross Treatment Cash Collected
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight mb-1 font-mono">
          {formatInr(headline.treatmentRecoveredInr)}
        </div>
        <div className="text-xs text-slate-400">
          <span>Across <strong>{headline.treatmentCases}</strong> active treatment cases</span>
        </div>
      </div>

      {/* 3. Contacts Suppressed (R2/R3) */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-amber-500/30 relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Contacts Suppressed (R2/R3)
          </span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl lg:text-3xl font-extrabold text-amber-300 tracking-tight mb-1 font-mono">
          {headline.gateSuppressed.toLocaleString()}
        </div>
        <div className="text-xs text-slate-400">
          <span>Blocked by quiet hours, DND &amp; outage rails</span>
        </div>
      </div>

      {/* 4. 95% Bootstrap Confidence Interval */}
      <div className="glass-card glass-card-hover rounded-2xl p-5 border border-purple-500/30 relative overflow-hidden group">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-purple-500 via-pink-400 to-purple-500"></div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            95% Bootstrap Confidence Interval
          </span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="text-lg lg:text-xl font-bold text-purple-200 tracking-tight mb-1 font-mono truncate">
          [{formatInr(headline.ci95.lowerInr)} – {formatInr(headline.ci95.upperInr)}]
        </div>
        <div className="text-xs text-slate-400">
          <span>1,000 resamples · Statistically significant</span>
        </div>
      </div>
    </div>
  );
};
