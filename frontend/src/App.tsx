import React, { useState, useEffect, useCallback } from 'react';
import { Navigation, RouteId } from './components/Navigation';
import { DashboardPage } from './pages/DashboardPage';
import { CasesPage } from './pages/CasesPage';
import { AiStudioPage } from './pages/AiStudioPage';
import { CompliancePage } from './pages/CompliancePage';
import { AuditLedgerPage } from './pages/AuditLedgerPage';
import { AblationLabPage } from './pages/AblationLabPage';
import { RazorpayRailPage } from './pages/RazorpayRailPage';
import { CaseDrawer } from './components/CaseDrawer';
import { AiSettingsModal } from './components/AiSettingsModal';
import { VerifyChainModal } from './components/VerifyChainModal';
import { TamperDemoModal } from './components/TamperDemoModal';
import { ToastContainer } from './components/ToastContainer';
import { SurfaceId, OverviewData, CasesResponse, CaseDetail, ToastItem } from './types';

export const App: React.FC = () => {
  // 1. Core State
  const [currentRoute, setCurrentRoute] = useState<RouteId>('dashboard');
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState<boolean>(true);
  
  const [casesResponse, setCasesResponse] = useState<CasesResponse>({ cases: [], total: 0, showing: 0, page: 1, limit: 50, totalPages: 1 });
  const [loadingCases, setLoadingCases] = useState<boolean>(true);
  const [currentSurface, setCurrentSurface] = useState<SurfaceId>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  
  const [activeCaseDetail, setActiveCaseDetail] = useState<CaseDetail | null>(null);
  const [loadingCaseDetail, setLoadingCaseDetail] = useState<boolean>(false);
  const [isCaseDrawerOpen, setIsCaseDrawerOpen] = useState<boolean>(false);
  
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState<boolean>(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [isTamperModalOpen, setIsTamperModalOpen] = useState<boolean>(false);
  
  const [activeModelName, setActiveModelName] = useState<string>('minimax/minimax-m3:free');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // 2. Callbacks (Declared before use)
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

  const fetchCases = useCallback(async () => {
    setLoadingCases(true);
    try {
      const params = new URLSearchParams();
      if (currentSurface) params.set('surface', currentSurface);
      if (selectedCohort) params.set('cohort', selectedCohort);
      if (selectedState) params.set('state', selectedState);
      if (searchQuery) params.set('q', searchQuery);
      params.set('page', String(currentPage));
      params.set('limit', String(pageSize));

      const res = await fetch(`/api/cases?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCasesResponse(data);
    } catch (err: any) {
      showToast(`Failed to load cases: ${err.message}`, 'error');
    } finally {
      setLoadingCases(false);
    }
  }, [currentSurface, selectedCohort, selectedState, searchQuery, currentPage, pageSize, showToast]);

  const handleSelectCase = useCallback(async (caseId: string) => {
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
  }, [showToast]);

  const handleCaseUpdated = useCallback((caseId: string) => {
    handleSelectCase(caseId);
    fetchOverview();
    fetchCases();
  }, [handleSelectCase, fetchOverview, fetchCases]);

  const navigateTo = (route: RouteId) => {
    setCurrentRoute(route);
    window.location.hash = `#/${route}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetFilters = () => {
    setCurrentSurface('');
    setSearchQuery('');
    setSelectedCohort('');
    setSelectedState('');
    setCurrentPage(1);
  };

  const handleSurfaceChange = (s: SurfaceId) => {
    setCurrentSurface(s);
    setCurrentPage(1);
  };

  const handleCohortChange = (c: string) => {
    setSelectedCohort(c);
    setCurrentPage(1);
  };

  const handleStateChange = (st: string) => {
    setSelectedState(st);
    setCurrentPage(1);
  };

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  // 3. Effects (Declared AFTER all callbacks)
  useEffect(() => {
    const handleHashChange = () => {
      const fullHash = window.location.hash.replace('#/', '').replace('#', '');
      const [routePart, queryPart] = fullHash.split('?');
      const route = routePart as RouteId;
      const validRoutes: RouteId[] = [
        'dashboard', 'cases', 'ai-studio', 'compliance', 
        'audit-ledger', 'ablation-lab', 'razorpay-rail'
      ];
      if (validRoutes.includes(route)) {
        setCurrentRoute(route);
      }

      // Check for return from payment checkout: ?openCase=rsk_...&recovered=1
      if (queryPart) {
        const params = new URLSearchParams(queryPart);
        const openCaseId = params.get('openCase');
        const isRecovered = params.get('recovered');
        if (openCaseId) {
          handleSelectCase(openCaseId);
          if (isRecovered === '1') {
            showToast(`🎉 Razorpay Test Payment Completed! Case ${openCaseId} marked RECOVERED in ledger.`, 'success');
            fetchOverview();
            fetchCases();
          }
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [fetchOverview, fetchCases, handleSelectCase, showToast]);

  // Initial Boot
  useEffect(() => {
    fetchOverview();
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

  return (
    <div className="min-h-screen text-slate-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Header & Navigation Tabs */}
      <Navigation
        currentRoute={currentRoute}
        onRouteChange={navigateTo}
        activeModel={activeModelName}
        auditEventsCount={overviewData?.headline.auditEventsChained || 8303}
        onOpenAiSettings={() => setIsAiSettingsOpen(true)}
        onOpenVerifyModal={() => setIsVerifyModalOpen(true)}
        onOpenTamperModal={() => setIsTamperModalOpen(true)}
      />

      {/* Page Routing Switcher */}
      <main className="min-h-[600px]">
        {currentRoute === 'dashboard' && (
          <DashboardPage
            overviewData={overviewData}
            loadingOverview={loadingOverview}
            currentSurface={currentSurface}
            onSelectSurface={setCurrentSurface}
            onSelectCase={handleSelectCase}
            onNavigate={navigateTo}
          />
        )}

        {currentRoute === 'cases' && (
          <CasesPage
            cases={casesResponse.cases}
            total={casesResponse.total}
            showing={casesResponse.showing}
            loading={loadingCases}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedSurface={currentSurface}
            onSurfaceChange={handleSurfaceChange}
            selectedCohort={selectedCohort}
            onCohortChange={handleCohortChange}
            selectedState={selectedState}
            onStateChange={handleStateChange}
            onSelectCase={handleSelectCase}
            onResetFilters={handleResetFilters}
            page={currentPage}
            limit={pageSize}
            totalPages={casesResponse.totalPages || 1}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
          />
        )}

        {currentRoute === 'ai-studio' && (
          <AiStudioPage
            showToast={showToast}
            onOpenAiSettings={() => setIsAiSettingsOpen(true)}
          />
        )}

        {currentRoute === 'compliance' && (
          <CompliancePage
            overviewData={overviewData}
          />
        )}

        {currentRoute === 'audit-ledger' && (
          <AuditLedgerPage
            onOpenVerifyModal={() => setIsVerifyModalOpen(true)}
            onOpenTamperModal={() => setIsTamperModalOpen(true)}
            showToast={showToast}
          />
        )}

        {currentRoute === 'ablation-lab' && (
          <AblationLabPage
            overviewData={overviewData}
          />
        )}

        {currentRoute === 'razorpay-rail' && (
          <RazorpayRailPage
            showToast={showToast}
            onOpenCase={handleSelectCase}
          />
        )}
      </main>

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

      {/* Footer */}
      <footer className="mt-12 pt-6 pb-8 border-t border-white/[0.06] text-center text-xs text-slate-500">
        Recoup Autonomous Recovery Engine · AI Revenue Recovery
      </footer>
    </div>
  );
};
