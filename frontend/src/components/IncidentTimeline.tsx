import React, { useState } from 'react';
import { ShieldCheck, AlertOctagon, ExternalLink } from 'lucide-react';

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

  return (
    <div className="glass-card rounded-2xl p-5 border border-rose-500/20 relative overflow-hidden flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white tracking-tight">
              Injected Outage Replay &amp; Contact Suppression
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3" />
            Razorpay × HDFC Outage
          </span>
        </div>

        {/* Timeline Chart Container */}
        <div className="bg-slate-950/60 rounded-xl p-3.5 border border-white/[0.06] mb-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-white/[0.05]">
            <span className="font-semibold text-rose-300">Incident Window: 2026-08-19 (10:00 – 16:00 IST)</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>Normal</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500"></span>Outage</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Recovery</span>
            </div>
          </div>

          {/* Bar chart */}
          <div className="h-20 flex items-end gap-1.5 pt-2 pb-1 relative">
            {hourData.map((h, i) => {
              const heightPct = Math.round(h.rate * 100);
              const color = getColor(h.phase);

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center group relative cursor-pointer"
                  onMouseEnter={() => setHoveredBar(h)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  <div
                    className="w-full rounded-t transition-all duration-300 group-hover:brightness-125"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: color,
                      boxShadow: h.phase === 'outage' ? '0 0 10px rgba(244, 63, 94, 0.4)' : undefined,
                    }}
                  ></div>
                </div>
              );
            })}
          </div>

          {/* Hour labels */}
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 pt-1 border-t border-white/[0.05]">
            {hourData.map((h, i) => (
              <span key={i} className="text-center flex-1">{h.label}</span>
            ))}
          </div>

          {/* Hover details badge */}
          <div className="min-h-[22px] mt-2 flex items-center justify-center text-xs">
            {hoveredBar ? (
              <div className="text-slate-300 font-mono bg-white/[0.06] px-2.5 py-0.5 rounded border border-white/[0.1]">
                <strong>{hoveredBar.label}</strong>: {(hoveredBar.rate * 100).toFixed(0)}% SR ({hoveredBar.phase.toUpperCase()}) · {hoveredBar.txCount} attempts
              </div>
            ) : (
              <span className="text-[11px] text-slate-500 italic">Hover over any hourly bar to inspect telemetry metrics</span>
            )}
          </div>
        </div>

        {/* Mini Stats Summary */}
        <div className="grid grid-cols-3 gap-2 text-center mb-3">
          <div className="bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
            <div className="text-base font-extrabold text-rose-400 font-mono">26.7%</div>
            <div className="text-[10px] text-slate-400">Outage Success Rate</div>
          </div>
          <div className="bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
            <div className="text-base font-extrabold text-rose-400 font-mono">-7.14</div>
            <div className="text-[10px] text-slate-400">Anomaly Z-Score</div>
          </div>
          <div className="bg-white/[0.03] p-2 rounded-lg border border-white/[0.05]">
            <div className="text-base font-extrabold text-amber-300 font-mono">21 / 21</div>
            <div className="text-[10px] text-slate-400">Cases Suppressed</div>
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
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition-all flex-shrink-0"
        >
          <span>View Case</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
