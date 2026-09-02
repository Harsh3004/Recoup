import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricsGrid } from './components/MetricsGrid';
import { SurfaceSelector } from './components/SurfaceSelector';
import { IncidentTimeline } from './components/IncidentTimeline';
import { Counterfactuals } from './components/Counterfactuals';
import { CaseExplorer } from './components/CaseExplorer';
import { CaseDrawer } from './components/CaseDrawer';
import { AiSettingsModal } from './components/AiSettingsModal';
import { VerifyChainModal } from './components/VerifyChainModal';
import { TamperDemoModal } from './components/TamperDemoModal';
import { ToastContainer } from './components/ToastContainer';
import { SurfaceId, OverviewData, CasesResponse, CaseDetail, ToastItem } from './types';

export const App: React.FC = () => {
  // Global State
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  
  const [casesResponse, setCasesResponse] = useState<CasesResponse>({ cases: [], total: 0, showing: 0 });
  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  
  const [currentSurface, setCurrentSurface] = useState<SurfaceId>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  
  const [activeCaseDetail, setActiveCaseDetail] = useState<CaseDetail | null>(null);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState<boolean>(false);
  const [isCaseDrawerOpen, setIsCaseDrawerOpen] = useState<boolean>(false);
  
  // Modals State
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState<boolean>(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [isTamperModalOpen, setIsTamperModalOpen] = useState<boolean>(false);
  
  const [activeModelName, setActiveModelName] = useState<string>('minimax/minimax-m3:free');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Toast Helper
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch Overview Metrics
  const fetchOverview = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetch('/api/overview');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOverviewData(data);
    } catch (err: any) {
      showToast(`Failed to load overview telemetry: ${err.message}`, 'error');
    } finally {
      setLoadingOverview(false);
    }
  }, [showToast]);

  // Fetch Cases with Reactive Filters
  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const params = new URLSearchParams();
      if (currentSurface) params.set('surface', currentSurface);
      if (selectedCohort) params.set('cohort', selectedCohort);
      if (selectedState) params.set('state', selectedState);
      if (searchQuery) params.set('q', searchQuery);

      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCasesResponse(data);
    } catch (err: any) {
      showToast(`Failed to load cases: ${err.message}`, 'error');
    } finally {
      setLoadingCases(false);
    }
  }, [currentSurface, selectedCohort, selectedState, searchQuery, showToast]);

  // Initial Boot
  useEffect(() => {
    fetchOverview();
    // Also load active AI config model name
    fetch('/api/settings/ai')
      .then((res) => res.json())
      .then((data) => {
        if (data.activeModel) setActiveModelName(data.activeModel);
      })
      .catch(() => {});
  }, [fetchOverview]);

  // Debounced / Reactive Case Loading
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCases();
    }, 150);
    return () => clearTimeout(timer);
  }, [fetchCases]);

  // Open Case Drilldown Drawer
  const handleSelectCase = async (caseId: string) => {
    setIsCaseDrawerOpen(true);
    setLoadingCaseDetail(true);
    try {
      const res = await fetch(`/api/case/${caseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setActiveCaseDetail(data);
    } catch (err: any) {
      showToast(`Failed to load case ${caseId}: ${err.message}`, 'error');
    } finally {
      setLoadingCaseDetail(false);
    }
  };

  const handleCaseUpdated = (caseId: string) => {
    handleSelectCase(caseId);
    fetchOverview();
    fetchCases();
  };

  return (
    <div className="min-h-screen text-slate-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header */}
      <Header
        activeModel={activeModelName}
        auditEventsCount={overviewData?.headline.auditEventsChained || 8303}
        onOpenAiSettings={() => setIsAiSettingsOpen(true)}
        onOpenVerifyModal={() => setIsVerifyModalOpen(true)}
        onOpenTamperModal={() => setIsTamperModalOpen(true)}
      />

      {/* 1. Headline Financial Metrics Banner */}
      <MetricsGrid data={overviewData} loading={loadingOverview} />

      {/* 2. Universal 4-Surfaces Selector */}
      <SurfaceSelector
        currentSurface={currentSurface}
        onSelectSurface={(surface) => setCurrentSurface(surface)}
        data={overviewData}
      />

      {/* 3. Split Grid: Injected Outage Replay & Counterfactual Comparison Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <IncidentTimeline onViewOutageCase={handleSelectCase} />
        <Counterfactuals data={overviewData} />
      </div>

      {/* 4. Interactive Case Explorer Data Table */}
      <CaseExplorer
        cases={casesResponse.cases}
        total={casesResponse.total}
        showing={casesResponse.showing}
        loading={loadingCases}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCohort={selectedCohort}
        onCohortChange={setSelectedCohort}
        selectedState={selectedState}
        onStateChange={setSelectedState}
        onSelectCase={handleSelectCase}
      />

      {/* Slide-Over Case Drilldown Drawer */}
      {isCaseDrawerOpen && (
        <CaseDrawer
          caseData={activeCaseDetail}
          loading={loadingCaseDetail}
          onClose={() => setIsCaseDrawerOpen(false)}
          onVerifyChain={() => {
            setIsCaseDrawerOpen(false);
            setIsVerifyModalOpen(true);
          }}
          showToast={showToast}
          onCaseUpdated={handleCaseUpdated}
        />
      )}

      {/* AI Settings Modal */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        showToast={showToast}
        onConfigSaved={(model) => setActiveModelName(model)}
      />

      {/* Audit Chain Verification Modal */}
      <VerifyChainModal
        isOpen={isVerifyModalOpen}
        onClose={() => setIsVerifyModalOpen(false)}
        showToast={showToast}
      />

      {/* Tamper Demo Modal */}
      <TamperDemoModal
        isOpen={isTamperModalOpen}
        onClose={() => setIsTamperModalOpen(false)}
        showToast={showToast}
      />

      {/* Footer Branding */}
      <footer className="pt-6 pb-8 border-t border-white/[0.06] text-center text-xs text-slate-500">
        Recoup Autonomous Recovery Engine · Built for Razorpay AI Buildathon · Track 03: AI Revenue Recovery
      </footer>
    </div>
  );
};
