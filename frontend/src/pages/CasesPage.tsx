import React from 'react';
import { CaseExplorer } from '../components/CaseExplorer';
import { CaseSummary, SurfaceId } from '../types';
import { FolderKanban } from 'lucide-react';

interface CasesPageProps {
  cases: CaseSummary[];
  total: number;
  showing: number;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSurface: SurfaceId;
  onSurfaceChange: (s: SurfaceId) => void;
  selectedCohort: string;
  onCohortChange: (c: string) => void;
  selectedState: string;
  onStateChange: (s: string) => void;
  onSelectCase: (caseId: string) => void;
  onResetFilters: () => void;
  page?: number;
  limit?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (limit: number) => void;
}

export const CasesPage: React.FC<CasesPageProps> = ({
  cases,
  total,
  showing,
  loading,
  searchQuery,
  onSearchChange,
  selectedSurface,
  onSurfaceChange,
  selectedCohort,
  onCohortChange,
  selectedState,
  onStateChange,
  onSelectCase,
  onResetFilters,
  page = 1,
  limit = 50,
  totalPages = 1,
  onPageChange,
  onPageSizeChange,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-black text-white tracking-tight">Case Explorer &amp; Operations Triage</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Dedicated portfolio queue across 1,314 risk-bearing failed payment cases with deep forensic inspection.
          </p>
        </div>
      </div>

      {/* Main Table */}
      <CaseExplorer
        cases={cases}
        total={total}
        showing={showing}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedSurface={selectedSurface}
        onSurfaceChange={onSurfaceChange}
        selectedCohort={selectedCohort}
        onCohortChange={onCohortChange}
        selectedState={selectedState}
        onStateChange={onStateChange}
        onSelectCase={onSelectCase}
        onResetFilters={onResetFilters}
        page={page}
        limit={limit}
        totalPages={totalPages}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};
