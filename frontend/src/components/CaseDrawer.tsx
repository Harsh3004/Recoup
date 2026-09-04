import React, { useState, useEffect } from 'react';
import { X, ExternalLink, ShieldCheck, Zap, Copy, Check, Cpu, FileCheck, RefreshCw } from 'lucide-react';
import { CaseDetail } from '../types';
import { formatInr, formatDateTime } from '../utils/formatters';

interface CaseDrawerProps {
  caseData: CaseDetail | null;
  loading: boolean;
  onClose: () => void;
  onVerifyChain: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onCaseUpdated: (caseId: string) => void;
}

type TabType = 'overview' | 'payments' | 'diagnosis' | 'policy' | 'gate' | 'comms' | 'audit';

export const CaseDrawer: React.FC<CaseDrawerProps> = ({
  caseData,
  loading,
  onClose,
  onVerifyChain,
  showToast,
  onCaseUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  
  // Razorpay Live Rail States
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{
    shortUrl: string;
    paymentLinkId: string;
    isMock: boolean;
    amountPaise?: number;
    totalExposurePaise?: number;
    remainingPaise?: number;
    isStaggered?: boolean;
  } | null>(null);
  const [isSimulatingWebhook, setIsSimulatingWebhook] = useState(false);

  // Reset generated payment link when switching cases
  useEffect(() => {
    setGeneratedLink(null);
  }, [caseData?.riskItemId]);

  if (!caseData && !loading) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    showToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleGeneratePaymentLink = async (forceNew = false) => {
    if (!caseData) return;
    setIsGeneratingLink(true);
    try {
      const res = await fetch(`/api/case/${caseData.riskItemId}/payment-link${forceNew ? '?forceNew=1' : ''}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payment link');
      
      setGeneratedLink({
        shortUrl: data.shortUrl,
        paymentLinkId: data.paymentLinkId,
        isMock: data.isMock,
        amountPaise: data.amountPaise,
        totalExposurePaise: data.totalExposurePaise,
        remainingPaise: data.remainingPaise,
        isStaggered: data.isStaggered,
      });
      showToast(
        data.isMock
          ? 'Generated deterministic mock payment link'
          : forceNew
          ? '⚡ Fresh Razorpay Test Payment Link generated!'
          : '⚡ Real Razorpay Test Payment Link generated!',
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!caseData) return;
    setIsSimulatingWebhook(true);
    try {
      const res = await fetch(`/api/case/${caseData.riskItemId}/simulate-payment`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to simulate payment');
      
      showToast('🎉 Webhook processed! Case resolved into audit ledger.', 'success');
      onCaseUpdated(caseData.riskItemId);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSimulatingWebhook(false);
    }
  };

  const paymentsCount = caseData?.recoveries?.length ?? (caseData?.recoveredPaise ? 1 : 0);
  const planStepsCount = (caseData?.policy || caseData?.interventionPlan)?.steps?.length;

  const tabs: Array<{ id: TabType; label: string; count?: number }> = [
    { id: 'overview', label: 'Case Overview' },
    { id: 'payments', label: 'Payment History', count: paymentsCount },
    { id: 'diagnosis', label: 'Diagnosis & LLM' },
    { id: 'policy', label: 'Playbook & EV', count: planStepsCount },
    { id: 'gate', label: 'Gate Rails', count: caseData?.gateDecisions?.length },
    { id: 'comms', label: 'Comms', count: caseData?.communications?.length },
    { id: 'audit', label: 'SHA-256 Audit Trail', count: caseData?.auditTrail?.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl h-full bg-[#0d1322] border-l border-white/[0.1] shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-bold text-sm">
              {caseData?.riskItemId || (caseData as any)?.id || 'Loading…'}
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>{caseData?.customerName || (caseData as any)?.name || 'Case Drilldown'}</span>
                {caseData?.resolvedVia === 'razorpay_live_webhook' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/40">
                    ⚡ LIVE RZP RECOVERED
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Surface {caseData?.surface} · {caseData?.segment || (caseData as any)?.customerSegment} Segment · Exposure: <strong className="text-emerald-400 font-mono">{caseData ? formatInr(caseData.exposurePaise ?? (caseData as any)?.exposure_paise, true) : '—'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 border-b border-white/[0.08] bg-slate-950/40 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3.5 text-xs font-semibold whitespace-nowrap transition-all border-b-2 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'text-indigo-400 border-indigo-500 bg-indigo-500/[0.05]'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/[0.06] text-slate-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 skeleton-shimmer h-28"></div>
              ))}
            </div>
          ) : !caseData ? null : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Razorpay Test-Mode Payment Rail Card */}
                  <div className="glass-card rounded-2xl p-5 border border-sky-500/30 bg-gradient-to-br from-sky-950/30 via-slate-900/60 to-indigo-950/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-sm">
                          ⚡
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white tracking-tight">Razorpay Test-Mode Payment Rail</h4>
                          <p className="text-[11px] text-slate-400">Mint test-mode payment links &amp; test webhook resolution</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        {(caseData.currentState || caseData.state) === 'RECOVERED' ? 'Resolved' : 'Ready'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-white/[0.08]">
                      {!generatedLink ? (
                        <button
                          onClick={handleGeneratePaymentLink}
                          disabled={isGeneratingLink}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30 transition-all"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{isGeneratingLink ? 'Minting Link…' : '⚡ Generate Razorpay Link'}</span>
                        </button>
                      ) : (
                        <div className="w-full space-y-2.5">
                          {/* Payment Link URL Bar */}
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-sky-500/40">
                            <span className="font-mono text-xs text-sky-300 truncate max-w-[320px]">
                              {generatedLink.shortUrl}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <a
                                href={generatedLink.shortUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 shadow"
                              >
                                <span>Pay Test</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                              <button
                                onClick={() => handleGeneratePaymentLink(true)}
                                disabled={isGeneratingLink}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.08] text-slate-200 hover:text-white font-bold text-xs hover:bg-white/[0.15] border border-white/[0.1]"
                                title="Mint a fresh active link to make another payment"
                              >
                                <RefreshCw className={`w-3 h-3 ${isGeneratingLink ? 'animate-spin' : ''}`} />
                                <span>Pay Again</span>
                              </button>
                            </div>
                          </div>

                          {/* Staggered Tranche & Remaining Balance Breakdown */}
                          {(generatedLink.isStaggered || ((caseData.exposurePaise ?? (caseData as any)?.exposure_paise ?? 0) > 5000000)) && (
                            <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/15">
                                  ⚡ Staggered Payment Plan (Tranche 1)
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  Razorpay Test Cap: ₹50,000 / link
                                </span>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                                <div className="p-2 rounded bg-white/[0.03] border border-white/[0.05]">
                                  <span className="text-[10px] text-slate-400 block">Tranche 1 Link</span>
                                  <strong className="text-sky-300 font-bold">
                                    {formatInr(generatedLink.amountPaise ?? 5000000, true)}
                                  </strong>
                                </div>
                                <div className="p-2 rounded bg-white/[0.03] border border-white/[0.05]">
                                  <span className="text-[10px] text-slate-400 block">Remaining Due</span>
                                  <strong className="text-amber-400 font-bold">
                                    {formatInr(
                                      generatedLink.remainingPaise ??
                                        Math.max(0, (caseData.exposurePaise ?? (caseData as any)?.exposure_paise ?? 0) - 5000000),
                                      true
                                    )}
                                  </strong>
                                </div>
                                <div className="p-2 rounded bg-white/[0.03] border border-white/[0.05]">
                                  <span className="text-[10px] text-slate-400 block">Total Exposure</span>
                                  <strong className="text-white font-bold">
                                    {formatInr(generatedLink.totalExposurePaise ?? (caseData.exposurePaise ?? (caseData as any)?.exposure_paise), true)}
                                  </strong>
                                </div>
                              </div>

                              <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                                Due to Razorpay test-mode transaction limits, this link collects Tranche 1. The remaining balance will be scheduled in subsequent dunning stages.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {(caseData.currentState || caseData.state) !== 'RECOVERED' && (
                        <button
                          onClick={handleSimulateWebhook}
                          disabled={isSimulatingWebhook}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isSimulatingWebhook ? 'Simulating…' : 'Simulate payment_link.paid'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Core Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="glass-card p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Remaining Due</div>
                      <div className="text-base font-mono font-bold text-white mt-1">
                        {formatInr(caseData.exposurePaise ?? (caseData as any)?.exposure_paise, true)}
                      </div>
                    </div>
                    <div className="glass-card p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Recovered</div>
                      <div className="text-base font-mono font-bold text-emerald-400 mt-1">
                        {formatInr(caseData.totalRecoveredPaise ?? (caseData as any)?.recoveredPaise ?? 0, true)}
                      </div>
                    </div>
                    <div className="glass-card p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Risk Score</div>
                      <div className="text-base font-mono font-bold text-amber-400 mt-1">
                        {caseData.riskScore?.toLocaleString() || (caseData as any)?.risk_score?.toLocaleString() || '—'}
                      </div>
                    </div>
                    <div className="glass-card p-3 rounded-xl">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Case State</div>
                      <div className="mt-1">
                        {(caseData.currentState === 'RECOVERED' || caseData.state === 'RECOVERED') ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            FULLY RECOVERED
                          </span>
                        ) : (caseData.currentState === 'PARTIALLY_RECOVERED' || caseData.state === 'PARTIALLY_RECOVERED') ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            PARTIALLY RECOVERED
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {caseData.currentState || caseData.state}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Payment History / Tranche Settlement History Card */}
                  <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-slate-950/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Settled Payments & Tranches ({caseData.recoveries?.length ?? (caseData.recoveredPaise ? 1 : 0)})</span>
                      </h4>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        Total Collected: {formatInr(caseData.totalRecoveredPaise ?? (caseData as any)?.recoveredPaise ?? 0, true)}
                      </span>
                    </div>

                    {caseData.recoveries && caseData.recoveries.length > 0 ? (
                      <div className="space-y-2">
                        {caseData.recoveries.map((rec, idx) => (
                          <div key={rec.id || idx} className="p-3 rounded-xl bg-slate-900/90 border border-white/[0.06] flex items-center justify-between">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-emerald-300">
                                  + {formatInr(rec.amountPaise, true)}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                                  {rec.channel || 'PAYMENT_LINK'}
                                </span>
                                {rec.resolvedVia && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                                    {rec.resolvedVia === 'razorpay_live_webhook' ? 'Razorpay Live' : rec.resolvedVia}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                                <span>Ref: {rec.paymentRef || rec.id}</span>
                                <span>·</span>
                                <span>{rec.recoveredAt ? formatDateTime(rec.recoveredAt) : 'Recent'}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => copyToClipboard(rec.paymentRef || rec.id, `rec_${idx}`)}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors"
                              title="Copy Payment Reference"
                            >
                              {copiedHash === `rec_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-slate-900/40 border border-dashed border-white/[0.08] text-center text-xs text-slate-500">
                        No payment tranches settled yet for this case.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: PAYMENT HISTORY (DEDICATED STATEMENT VIEW) */}
              {activeTab === 'payments' && (
                <div className="space-y-4">
                  {/* Financial Summary KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="glass-card p-4 rounded-xl border border-emerald-500/30">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Total Collected So Far</div>
                      <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                        {formatInr(caseData.totalRecoveredPaise ?? (caseData as any)?.recoveredPaise ?? 0, true)}
                      </div>
                    </div>
                    <div className="glass-card p-4 rounded-xl border border-white/[0.08]">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Remaining Exposure Balance</div>
                      <div className="text-xl font-mono font-bold text-white mt-1">
                        {formatInr(caseData.exposurePaise ?? (caseData as any)?.exposure_paise, true)}
                      </div>
                    </div>
                    <div className="glass-card p-4 rounded-xl border border-sky-500/30">
                      <div className="text-xs text-slate-400 uppercase font-semibold">Tranches Settled</div>
                      <div className="text-xl font-mono font-bold text-sky-400 mt-1">
                        {caseData.recoveries?.length ?? (caseData.recoveredPaise ? 1 : 0)}
                      </div>
                    </div>
                  </div>

                  {/* Itemized Transactions Table */}
                  <div className="glass-card rounded-2xl p-5 border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Itemized Payment Tranches Ledger
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Chained into SQLite & SHA-256 Ledger
                      </span>
                    </div>

                    {caseData.recoveries && caseData.recoveries.length > 0 ? (
                      <div className="divide-y divide-white/[0.06] overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="text-slate-400 border-b border-white/[0.08]">
                              <th className="pb-2">Date / Time</th>
                              <th className="pb-2">Payment Ref (UTR)</th>
                              <th className="pb-2">Channel</th>
                              <th className="pb-2 text-right">Amount Paid</th>
                              <th className="pb-2 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.04]">
                            {caseData.recoveries.map((r, i) => (
                              <tr key={r.id || i} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 text-slate-300">
                                  {r.recoveredAt ? formatDateTime(r.recoveredAt) : 'Recent'}
                                </td>
                                <td className="py-2.5 text-sky-300 font-bold">
                                  {r.paymentRef || r.id}
                                </td>
                                <td className="py-2.5 text-slate-400">
                                  {r.channel || 'PAYMENT_LINK'}
                                </td>
                                <td className="py-2.5 text-right font-bold text-emerald-400">
                                  +{formatInr(r.amountPaise, true)}
                                </td>
                                <td className="py-2.5 text-right">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                    Settled
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 text-xs">
                        No payments recorded yet for this invoice.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: DIAGNOSIS & LLM */}
              {activeTab === 'diagnosis' && (
                <div className="space-y-4">
                  {caseData.diagnosis ? (
                    <>
                      <div className="glass-card rounded-2xl p-5 border border-indigo-500/30">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                            Diagnosed Root Cause
                          </span>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Confidence: {((caseData.diagnosis.confidenceBps || 0) / 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-lg font-mono font-bold text-white mb-2">
                          {caseData.diagnosis.rootCause}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-white/[0.05]">
                          {caseData.diagnosis.rationale}
                        </p>
                      </div>

                      {/* Evidence Spans */}
                      {caseData.diagnosis.evidenceSpans && caseData.diagnosis.evidenceSpans.length > 0 && (
                        <div className="glass-card rounded-2xl p-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Extracted Evidence Spans
                          </h4>
                          <div className="space-y-1.5">
                            {caseData.diagnosis.evidenceSpans.map((span, idx) => (
                              <div key={idx} className="text-xs font-mono text-cyan-300 bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-500/20">
                                ❝ {span} ❞
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Model Provenance Metadata */}
                      <div className="glass-card rounded-2xl p-4 text-xs">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                          LLM Diagnostic Inference Provenance
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-300">
                          <div className="bg-white/[0.03] p-2 rounded">
                            <span className="text-slate-500 block">Model:</span>
                            <strong className="text-indigo-300">{caseData.diagnosis.model}</strong>
                          </div>
                          <div className="bg-white/[0.03] p-2 rounded">
                            <span className="text-slate-500 block">Latency:</span>
                            <strong>{caseData.diagnosis.latencyMs ? `${caseData.diagnosis.latencyMs}ms` : 'Cached'}</strong>
                          </div>
                          <div className="bg-white/[0.03] p-2 rounded">
                            <span className="text-slate-500 block">Tokens:</span>
                            <strong>{caseData.diagnosis.tokenUsage?.totalTokens || '—'}</strong>
                          </div>
                          <div className="bg-white/[0.03] p-2 rounded">
                            <span className="text-slate-500 block">Path:</span>
                            <strong>{caseData.diagnosis.llmUsed ? 'Live LLM NLU' : 'Rules Fallback'}</strong>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">No diagnosis record attached.</div>
                  )}
                </div>
              )}

              {/* TAB 3: POLICY & EV */}
              {activeTab === 'policy' && (
                <div className="space-y-4">
                  {(caseData.policy || caseData.interventionPlan) ? (
                    (() => {
                      const plan = (caseData.policy || caseData.interventionPlan)!;
                      const steps = plan.steps || [];
                      const evPaise = plan.expectedValuePaise ?? (plan as any).evPaise ?? 0;
                      const reasoning = plan.reasoning || (plan as any).rationale || 'EV-maximizing intervention strategy calibrated for customer segment and root-cause.';
                      return (
                        <>
                          <div className="glass-card rounded-2xl p-5 border border-purple-500/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                                Selected Playbook
                              </span>
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                EV: {formatInr(evPaise, true)}
                              </span>
                            </div>
                            <div className="text-base font-mono font-bold text-white mb-2">
                              {plan.playbook}
                            </div>
                            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-white/[0.05] leading-relaxed">
                              {reasoning}
                            </p>
                          </div>

                          {/* Scheduled Steps */}
                          <div className="glass-card rounded-2xl p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                              Intervention Plan Steps ({steps.length})
                            </h4>
                            <div className="space-y-2">
                              {steps.map((step, idx) => (
                                <div key={step.stepOrder ?? (step as any).stepNo ?? idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05] text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-mono font-bold text-[10px]">
                                      {step.stepOrder ?? (step as any).stepNo ?? idx + 1}
                                    </span>
                                    <span className="font-semibold text-slate-200">{step.channel} · {step.action}</span>
                                  </div>
                                  <span className="font-mono text-[11px] text-slate-400">
                                    {formatDateTime(step.scheduledAt)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">No policy plan recorded for this case.</div>
                  )}
                </div>
              )}

              {/* TAB 4: GATE DECISIONS */}
              {activeTab === 'gate' && (
                <div className="space-y-3">
                  {caseData.gateDecisions && caseData.gateDecisions.length > 0 ? (
                    caseData.gateDecisions.map((gate, idx) => {
                      const reasons = (gate.reasonCodes && gate.reasonCodes.length > 0)
                        ? gate.reasonCodes
                        : gate.reasonCode
                        ? [gate.reasonCode]
                        : [];
                      const timestamp = gate.evaluatedAt || gate.decidedAt || 0;
                      return (
                        <div key={gate.id || idx} className="glass-card rounded-xl p-4 border border-white/[0.08]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                gate.allowed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                              }`}>
                                {gate.allowed ? 'PASS' : 'BLOCKED'}
                              </span>
                              <span className="text-xs font-semibold text-white">
                                Step #{gate.stepOrder ?? (gate as any).stepNo ?? idx + 1}: {gate.channel || 'COMMUNICATION'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">{formatDateTime(timestamp)}</span>
                          </div>
                          {gate.details && (
                            <p className="text-xs text-slate-300 leading-relaxed mb-2 font-sans">
                              {gate.details}
                            </p>
                          )}
                          {reasons.length > 0 && (
                            <div className="text-xs text-slate-400 flex flex-wrap gap-1">
                              {reasons.map((rc, rIdx) => (
                                <span key={rIdx} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-300">
                                  {rc}
                                </span>
                              ))}
                            </div>
                          )}
                          {gate.passportSignature && (
                            <div className="mt-2 text-[10px] font-mono text-slate-500 truncate">
                              Passport: {gate.passportSignature}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">No gate decisions evaluated for this case.</div>
                  )}
                </div>
              )}

              {/* TAB 5: COMMS */}
              {activeTab === 'comms' && (
                <div className="space-y-3">
                  {caseData.communications && caseData.communications.length > 0 ? (
                    caseData.communications.map((msg, idx) => {
                      let text = msg.payloadText;
                      if (!text && msg.payload) {
                        try {
                          const p = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
                          text = p.body || p.text || p.message || (typeof p === 'string' ? p : JSON.stringify(p, null, 2));
                        } catch {
                          text = msg.payload;
                        }
                      }
                      return (
                        <div key={msg.id || idx} className="glass-card rounded-xl p-4 border border-white/[0.08] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-indigo-300">{msg.channel} Dispatch</span>
                            <span className="text-[10px] text-slate-500 font-mono">{formatDateTime(msg.sentAt)}</span>
                          </div>
                          <div className="text-xs text-slate-200 bg-slate-950/60 p-3 rounded-lg border border-white/[0.05] whitespace-pre-wrap font-sans leading-relaxed">
                            {text || 'Dispatched via compliance-gated communication adapter.'}
                          </div>
                          {msg.customerReplied && (
                            <div className="text-xs text-emerald-300 bg-emerald-950/30 p-2.5 rounded border border-emerald-500/20">
                              <strong>Customer Reply:</strong> {msg.replyText || 'Acknowledged'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs">No outbound communications recorded.</div>
                  )}
                </div>
              )}

              {/* TAB 6: VERTICAL BLOCKCHAIN AUDIT TIMELINE */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                    <div className="text-xs text-slate-400">
                      <strong>SHA-256 Cryptographic Hash Chain</strong> · Formatted as <code className="text-indigo-300 font-mono">H_i = SHA-256(H_prev || P_i)</code>
                    </div>
                    <button
                      onClick={onVerifyChain}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verify Chain</span>
                    </button>
                  </div>

                  {/* Vertical Blockchain Spine */}
                  <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-indigo-500 before:via-cyan-500 before:to-emerald-500">
                    {caseData.auditTrail?.map((evt) => (
                      <div key={evt.seq} className="relative glass-card rounded-xl p-4 border border-white/[0.08] hover:border-indigo-500/40 transition-all">
                        {/* Dot on spine */}
                        <div className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-[#0d1322] border-2 border-indigo-400 shadow-sm shadow-indigo-500/50"></div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-300">BLOCK #{evt.seq}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/[0.06] text-slate-300">
                              {evt.action}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">{formatDateTime(evt.timestamp || evt.ts || 0)}</span>
                        </div>

                        {/* Prev Hash & Block Hash */}
                        <div className="space-y-1 font-mono text-[10px] bg-slate-950/70 p-2.5 rounded-lg border border-white/[0.05]">
                          <div className="flex items-center justify-between text-slate-400">
                            <span>PREV HASH:</span>
                            <span className="truncate max-w-[280px]">{evt.prevHash}</span>
                          </div>
                          <div className="flex items-center justify-between text-indigo-300 pt-1 border-t border-white/[0.05]">
                            <span>BLOCK HASH:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[280px] font-bold">{evt.hash}</span>
                              <button
                                onClick={() => copyToClipboard(evt.hash, `hash-${evt.seq}`)}
                                className="p-1 hover:text-white"
                                title="Copy Hash"
                              >
                                {copiedHash === `hash-${evt.seq}` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
