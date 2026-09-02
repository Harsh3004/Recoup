import React from 'react';
import { SurfaceId, OverviewData } from '../types';
import { formatInr } from '../utils/formatters';
import { Layers, RefreshCw, ShoppingCart, CreditCard, Building2 } from 'lucide-react';

interface SurfaceSelectorProps {
  currentSurface: SurfaceId;
  onSelectSurface: (surface: SurfaceId) => void;
  data: OverviewData | null;
}

export const SurfaceSelector: React.FC<SurfaceSelectorProps> = ({
  currentSurface,
  onSelectSurface,
  data,
}) => {
  const surfaces: Array<{
    id: SurfaceId;
    code: string;
    name: string;
    icon: React.ReactNode;
    key: string;
  }> = [
    {
      id: '',
      code: 'ALL SURFACES',
      name: 'Complete Portfolio',
      icon: <Layers className="w-4 h-4 text-indigo-400" />,
      key: 'ALL',
    },
    {
      id: 'A',
      code: 'SURFACE A',
      name: 'Subscription Autopay',
      icon: <RefreshCw className="w-4 h-4 text-cyan-400" />,
      key: 'A',
    },
    {
      id: 'B',
      code: 'SURFACE B',
      name: 'Checkout Drop-Off',
      icon: <ShoppingCart className="w-4 h-4 text-emerald-400" />,
      key: 'B',
    },
    {
      id: 'C',
      code: 'SURFACE C',
      name: 'Mandate Failure',
      icon: <CreditCard className="w-4 h-4 text-amber-400" />,
      key: 'C',
    },
    {
      id: 'D',
      code: 'SURFACE D',
      name: 'B2B Invoices',
      icon: <Building2 className="w-4 h-4 text-purple-400" />,
      key: 'D',
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Universal Recovery Across 4 Surfaces
          </h2>
          <p className="text-xs text-slate-400">Click any surface tab to filter telemetry and case table</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {surfaces.map((s) => {
          const isActive = currentSurface === s.id;
          const surfaceStat = s.id ? data?.bySurface?.[s.id] : null;

          return (
            <button
              key={s.id}
              onClick={() => onSelectSurface(s.id)}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden group ${
                isActive
                  ? 'bg-indigo-600/15 border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/30'
                  : 'glass-card border-white/[0.08] hover:border-white/[0.2] hover:bg-slate-800/60'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 to-cyan-400"></div>
              )}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
                  {s.code}
                </span>
                <div className="p-1 rounded-md bg-white/[0.04]">
                  {s.icon}
                </div>
              </div>
              <div className="text-sm font-bold text-white mb-1 truncate">
                {s.name}
              </div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>
                  {s.id === '' ? (
                    <span>Total: <strong className="text-emerald-400 font-semibold">{data ? formatInr(data.headline.treatmentRecoveredInr) : '—'}</strong></span>
                  ) : surfaceStat ? (
                    <span>Rec: <strong className="text-emerald-400 font-semibold">{formatInr(surfaceStat.treatmentRecoveredPaise, true)}</strong></span>
                  ) : (
                    <span>Telemetry Active</span>
                  )}
                </span>
                {surfaceStat && (
                  <span className="text-[10px] font-bold text-indigo-300 bg-indigo-500/15 px-1.5 py-0.2 rounded">
                    {surfaceStat.casesCount} cases
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
