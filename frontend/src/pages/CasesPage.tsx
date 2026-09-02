import React from 'react';
import { CaseExplorer } from '../components/CaseExplorer';
import { CaseSummary } from '../types';

interface CasesPageProps {
  cases: CaseSummary[];
  total: number;
  showing: number;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCohort: string;
  onCohortChange: (c: string) => void;
  selectedState: string;
  onStateChange: (s: string) => void;
  onSelectCase: (caseId: string) => void;
}

export const CasesPage: React.FC<CasesPageProps> = ({
  cases,
  total,
  showing,
  loading,
  searchQuery,
  onSearchChange,
  selectedCohort,
  onCohortChange,
  selectedState,
  onSelectCase,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/[0.08]">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Case Explorer &amp; Forensic Triage</h2>
          <p className="text-xs text-slate-400">
            Real-time portfolio management across 1,314 risk-bearing customer payment failures
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
        selectedCohort={selectedCohort}
        onCohortChange={onCohortChange}
        selectedState={selectedState}
        onStateChange={onStateChange}
        onSelectCase={onSelectCase}
      />
    </div>
  );
};
