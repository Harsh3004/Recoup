import React, { useState } from 'react';
import { Search, Filter, ArrowUpDown, ChevronRight, AlertCircle, RotateCcw } from 'lucide-react';
import { CaseSummary, SurfaceId } from '../types';
import { formatInr } from '../utils/formatters';

interface CaseExplorerProps {
  cases: CaseSummary[];
  total: number;
  showing: number;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSurface?: SurfaceId;
  onSurfaceChange?: (s: SurfaceId) => void;
  selectedCohort: string;
  onCohortChange: (c: string) => void;
  selectedState: string;
  onStateChange: (s: string) => void;
  onSelectCase: (caseId: string) => void;
  onResetFilters?: () => void;
}

export const CaseExplorer: React.FC<CaseExplorerProps> = ({
  cases,
  total,
  showing,
  loading,
  searchQuery,
  onSearchChange,
  selectedSurface = '',
  onSurfaceChange,
  selectedCohort,
  onCohortChange,
  selectedState,
  onStateChange,
  onSelectCase,
  onResetFilters,
}) => {
  const [sortField, setSortField] = useState<string>('exposurePaise');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const safeCases = Array.isArray(cases) ? cases : [];

  const sortedCases = [...safeCases].sort((a: any, b: any) => {
    let valA = a[sortField] ?? a[sortField === 'exposurePaise' ? 'exposure_paise' : sortField] ?? '';
    let valB = b[sortField] ?? b[sortField === 'exposurePaise' ? 'exposure_paise' : sortField] ?? '';
    
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();
    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  const getSurfaceBadge = (surface: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      A: { label: 'Surface A (Sub)', cls: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
      B: { label: 'Surface B (Drop)', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
      C: { label: 'Surface C (Mandate)', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
      D: { label: 'Surface D (B2B)', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
    };
    const s = map[surface] || { label: surface, cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' };
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${s.cls}`}>{s.label}</span>;
  };

  const getStateBadge = (state: string, resolvedVia?: string | null) => {
    if (resolvedVia === 'razorpay_live_webhook') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm shadow-sky-500/20">
          ⚡ LIVE RZP RECOVERED
        </span>
      );
    }

    switch (state) {
      case 'RECOVERED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            RECOVERED
          </span>
        );
      case 'SUPPRESSED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            SUPPRESSED
          </span>
        );
      case 'PROMISED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            PROMISED (PTP)
          </span>
        );
      case 'ESCALATED_TO_HUMAN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            HUMAN ESCALATION
          </span>
        );
      case 'CLOSED_LOST':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            CLOSED LOST
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            {state || 'OPEN'}
          </span>
        );
    }
  };

  const hasActiveFilters = searchQuery || selectedSurface || selectedCohort || selectedState;

  return (
    <div className="glass-card rounded-2xl p-5 border border-white/[0.08] mb-8">
      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search risk ID (e.g. rsk_D_000977), customer, root cause, playbook..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-white/[0.1] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Surface Filter */}
          {onSurfaceChange && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="text-[11px]">Surface:</span>
              <select
                value={selectedSurface}
                onChange={(e) => onSurfaceChange(e.target.value as SurfaceId)}
                className="bg-slate-900/80 border border-white/[0.1] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Surfaces</option>
                <option value="A">Surface A (Subscriptions)</option>
                <option value="B">Surface B (Checkout Drops)</option>
                <option value="C">Surface C (Mandates)</option>
                <option value="D">Surface D (B2B Invoices)</option>
              </select>
            </div>
          )}

          {/* Cohort Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[11px]">Cohort:</span>
            <select
              value={selectedCohort}
              onChange={(e) => onCohortChange(e.target.value)}
              className="bg-slate-900/80 border border-white/[0.1] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Cohorts</option>
              <option value="TREATMENT">Treatment (85%)</option>
              <option value="HOLDOUT">Holdout Control (15%)</option>
            </select>
          </div>

          {/* State Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="text-[11px]">State:</span>
            <select
              value={selectedState}
              onChange={(e) => onStateChange(e.target.value)}
              className="bg-slate-900/80 border border-white/[0.1] text-xs text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All States</option>
              <option value="RECOVERED">Recovered</option>
              <option value="SUPPRESSED">Suppressed</option>
              <option value="PROMISED">Promised (PTP)</option>
              <option value="ESCALATED_TO_HUMAN">Human Escalation</option>
              <option value="CLOSED_LOST">Closed Lost</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && onResetFilters && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Pagination Status Indicator */}
      <div className="flex items-center justify-between pb-3 text-xs text-slate-400 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-white font-mono">{showing || sortedCases.length}</strong> of <strong className="text-white font-mono">{total || sortedCases.length}</strong> cases
          </span>
          {total > 200 && !searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-medium">
              <AlertCircle className="w-3 h-3" />
              LIMIT 200 reached — filter or search to narrow
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500 hidden sm:inline">Click any case row to inspect full audit timeline &amp; live Razorpay rail</span>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.08] text-slate-400 font-semibold uppercase text-[10px] tracking-wider select-none">
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('id')}>
                <div className="flex items-center gap-1">Risk Case ID <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-3 px-3">Surface</th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('customerName')}>
                <div className="flex items-center gap-1">Customer <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-3 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('exposurePaise')}>
                <div className="flex items-center gap-1">Exposure (₹) <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-3 px-3">Diagnosed Root Cause</th>
              <th className="py-3 px-3">Selected Playbook</th>
              <th className="py-3 px-3">State</th>
              <th className="py-3 px-3 text-right cursor-pointer hover:text-white" onClick={() => handleSort('recoveredPaise')}>
                <div className="flex items-center justify-end gap-1">Recovered (₹) <ArrowUpDown className="w-3 h-3" /></div>
              </th>
              <th className="py-3 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={9} className="py-3.5 px-3">
                    <div className="h-4 bg-white/[0.05] rounded skeleton-shimmer"></div>
                  </td>
                </tr>
              ))
            ) : sortedCases.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-xs">
                  <div className="space-y-2">
                    <div>No cases found matching current filters.</div>
                    {hasActiveFilters && onResetFilters && (
                      <button
                        onClick={onResetFilters}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold hover:bg-indigo-600/30"
                      >
                        Clear Active Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedCases.map((c: any) => {
                const caseId = c.riskItemId || c.id || '';
                const customerName = c.customerName || c.customer_name || '—';
                const segment = c.segment || '';
                const exposure = c.exposurePaise ?? c.exposure_paise ?? 0;
                const rootCause = c.rootCause || c.root_cause || 'INVOICE_UNPAID';
                const playbook = c.playbook || 'DUNNING_LADDER';
                const recovered = c.recoveredPaise ?? c.recovered_paise ?? 0;
                const state = c.state || 'OPEN';
                const resolvedVia = c.resolvedVia || c.resolved_via;

                return (
                  <tr
                    key={caseId}
                    onClick={() => onSelectCase(caseId)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-indigo-300 group-hover:text-indigo-200">
                      {caseId}
                    </td>
                    <td className="py-3 px-3">
                      {getSurfaceBadge(c.surface)}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200 max-w-[180px] truncate">
                      {customerName}
                      {segment && <span className="text-[10px] text-slate-500 ml-1">({segment})</span>}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-200">
                      {formatInr(exposure, true)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300 max-w-[160px] truncate" title={rootCause}>
                      {rootCause}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400 max-w-[140px] truncate" title={playbook}>
                      {playbook}
                    </td>
                    <td className="py-3 px-3">
                      {getStateBadge(state, resolvedVia)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      {recovered > 0 ? formatInr(recovered, true) : '₹0.00'}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-500 group-hover:text-indigo-400">
                      <ChevronRight className="w-4 h-4 inline" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
