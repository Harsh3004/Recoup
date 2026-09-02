import React, { useState } from 'react';
import { ShieldCheck, AlertOctagon, ExternalLink, Activity } from 'lucide-react';

interface IncidentTimelineProps {
  onViewOutageCase: (caseId: string) => void;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ onViewOutageCase }) => {
  const [hoveredBar, setHoveredBar] = useState<{
    label: string;
    rate: number;
    phase: string;
    txCount: number;
  } | null>(null);

  const hourData = [
    { label: '08:00', rate: 0.81, phase: 'normal', txCount: 142 },
    { label: '09:00', rate: 0.79, phase: 'normal', txCount: 188 },
    { label: '10:00', rate: 0.58, phase: 'outage', txCount: 220 },
    { label: '11:00', rate: 0.34, phase: 'outage', txCount: 245 },
    { label: '12:00', rate: 0.27, phase: 'outage', txCount: 260 },
    { label: '13:00', rate: 0.22, phase: 'outage', txCount: 215 },
    { label: '14:00', rate: 0.29, phase: 'outage', txCount: 230 },
    { label: '15:00', rate: 0.31, phase: 'outage', txCount: 195 },
    { label: '16:00', rate: 0.52, phase: 'recovery', txCount: 180 },
    { label: '17:00', rate: 0.74, phase: 'normal', txCount: 165 },
  ];

  const getColor = (phase: string) => {
    switch (phase) {
      case 'normal': return '#10b981'; // emerald
      case 'outage': return '#f43f5e'; // rose
      case 'recovery': return '#f59e0b'; // amber
      default: return '#6366f1';
    }
  };

  const getGradient = (phase: string) => {
    switch (phase) {
      case 'normal': return 'linear-gradient(180deg, #34d399 0%, #059669 100%)';
      case 'outage': return 'linear-gradient(180deg, #fb7185 0%, #e11d48 100%)';
      case 'recovery': return 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)';
      default: return 'linear-gradient(180deg, #818cf8 0%, #4f46e5 100%)';
    }
  };

  return (
    <div className="glass-card rounded-2xl p-5 border border-rose-500/20 relative overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-bold text-white tracking-tight">
              Injected Outage Replay &amp; Contact Suppression
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm shadow-rose-500/10">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            Razorpay × HDFC Outage
          </span>
        </div>

        {/* Timeline Chart Container */}
        <div className="bg-slate-950/70 rounded-xl p-4 border border-white/[0.06] mb-3 relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-white/[0.05]">
            <span className="font-semibold text-rose-300">Incident Window: 2026-08-19 (10:00 – 16:00 IST)</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Outage</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Recovery</span>
            </div>
          </div>

          {/* Reference baseline line */}
          <div className="relative h-28 w-full pt-2 pb-1">
            {/* 80% Baseline guide */}
            <div className="absolute top-[20%] left-0 right-0 border-b border-dashed border-emerald-500/20 pointer-events-none flex justify-end">
              <span className="text-[9px] font-mono text-emerald-500/60 pr-1 -mt-3.5">80% Baseline</span>
            </div>

            {/* 30% Outage threshold guide */}
            <div className="absolute top-[70%] left-0 right-0 border-b border-dashed border-rose-500/20 pointer-events-none flex justify-end">
              <span className="text-[9px] font-mono text-rose-500/60 pr-1 -mt-3.5">30% Outage Floor</span>
            </div>

            {/* Bar chart flex container */}
            <div className="h-full w-full flex items-end gap-2 relative z-10">
              {hourData.map((h, i) => {
                const heightPct = Math.max(12, Math.round(h.rate * 100));
                const gradient = getGradient(h.phase);
                const color = getColor(h.phase);
                const isHovered = hoveredBar?.label === h.label;

                return (
                  <div
                    key={i}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                    onMouseEnter={() => setHoveredBar(h)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Percentage Pill over bar on hover or key points */}
                    <div className={`text-[9px] font-mono font-bold mb-1 transition-all ${
                      isHovered ? 'text-white scale-110 opacity-100' : 'text-slate-400 opacity-80'
                    }`}>
                      {(h.rate * 100).toFixed(0)}%
                    </div>

                    {/* Bar Element */}
                    <div
                      className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-125"
                      style={{
                        height: `${heightPct}%`,
                        background: gradient,
                        boxShadow: h.phase === 'outage'
                          ? '0 0 12px rgba(244, 63, 94, 0.45)'
                          : isHovered
                          ? `0 0 10px ${color}`
                          : undefined,
                      }}
                    ></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hour labels */}
          <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-2 pt-1.5 border-t border-white/[0.06]">
            {hourData.map((h, i) => (
              <span key={i} className={`text-center flex-1 transition-colors ${
                hoveredBar?.label === h.label ? 'text-white font-bold' : ''
              }`}>
                {h.label}
              </span>
            ))}
          </div>

          {/* Hover details badge */}
          <div className="min-h-[22px] mt-2.5 flex items-center justify-center text-xs">
            {hoveredBar ? (
              <div className="text-slate-200 font-mono bg-white/[0.08] px-3 py-1 rounded-lg border border-white/[0.12] shadow-sm">
                <strong>{hoveredBar.label} IST</strong>: {(hoveredBar.rate * 100).toFixed(0)}% Success Rate ({hoveredBar.phase.toUpperCase()}) · {hoveredBar.txCount} attempts recorded
              </div>
            ) : (
              <span className="text-[11px] text-slate-500 italic">
                Hover over hourly bars to inspect live gateway anomaly telemetry
              </span>
            )}
          </div>
        </div>

        {/* Mini Stats Summary */}
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.05]">
            <div className="text-base font-extrabold text-rose-400 font-mono">26.7%</div>
            <div className="text-[10px] text-slate-400 font-medium">Outage Success Rate</div>
          </div>
          <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.05]">
            <div className="text-base font-extrabold text-rose-400 font-mono">-7.14</div>
            <div className="text-[10px] text-slate-400 font-medium">Anomaly Z-Score</div>
          </div>
          <div className="bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.05]">
            <div className="text-base font-extrabold text-amber-300 font-mono">21 / 21</div>
            <div className="text-[10px] text-slate-400 font-medium">Cases Suppressed</div>
          </div>
        </div>
      </div>

      {/* Compliance Action Banner */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/25">
        <div className="flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-300 leading-tight">
            <strong className="text-rose-200">Compliance Rail #1 Active:</strong> Zero customer harassment during upstream gateway downtime. 100% of outbound touches suppressed.
          </div>
        </div>
        <button
          onClick={() => onViewOutageCase('rsk_A_000313')}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-all flex-shrink-0"
        >
          <span>View Case</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
