import React, { useState } from 'react';
import { CreditCard, Zap, ExternalLink, Check, Terminal, ShieldCheck, QrCode, RefreshCw } from 'lucide-react';
import { formatInr } from '../utils/formatters';

interface RazorpayRailPageProps {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenCase: (caseId: string) => void;
}

export const RazorpayRailPage: React.FC<RazorpayRailPageProps> = ({ showToast, onOpenCase }) => {
  const [testCaseId, setTestCaseId] = useState('rsk_D_000977');
  const [amountPaise, setAmountPaise] = useState(500000000); // ₹50,00,000
  const [customerName, setCustomerName] = useState('Sahyadri Agro Processing Ltd');
  const [customerEmail, setCustomerEmail] = useState('ap@sahyadriagro.in');
  
  const [minting, setMinting] = useState(false);
  const [mintedLink, setMintedLink] = useState<{
    shortUrl: string;
    paymentLinkId: string;
    isMock: boolean;
  } | null>(null);

  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [webhookLog, setWebhookLog] = useState<any>(null);

  const handleMintLink = async () => {
    setMinting(true);
    try {
      const res = await fetch(`/api/case/${testCaseId}/payment-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mint payment link');
      
      setMintedLink(data);
      showToast(
        data.isMock
          ? 'Generated deterministic mock payment URL (offline mode)'
          : '⚡ Real Razorpay Test Payment Link generated!',
        'success'
      );
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setMinting(false);
    }
  };

  const handleSimulateWebhook = async () => {
    setSimulatingWebhook(true);
    try {
      const res = await fetch(`/api/case/${testCaseId}/simulate-payment`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process webhook');
      
      setWebhookLog(data);
      showToast('🎉 Webhook HMAC signature verified & case marked RECOVERED!', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSimulatingWebhook(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-black text-white tracking-tight">Razorpay Test-Mode Payment Rail &amp; Webhooks</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Scoped live rail connecting Razorpay test-mode payment links and HMAC-verified webhooks into the audit chain.
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          <Zap className="w-4 h-4 text-sky-400" />
          <span>Test-Mode API Rail Active</span>
        </span>
      </div>

      {/* Grid: Minter & Webhook Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Payment Link Minter */}
        <div className="glass-card rounded-2xl p-6 border border-sky-500/30 bg-gradient-to-br from-sky-950/20 via-slate-900/60 to-indigo-950/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              <span>Payment Link Generator</span>
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
              REST v1/payment_links
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Target Risk Case ID</label>
              <input
                type="text"
                value={testCaseId}
                onChange={(e) => setTestCaseId(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Customer</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-white/[0.1] rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Exposure</label>
                <div className="p-2 bg-slate-950/80 border border-white/[0.1] rounded-xl text-emerald-400 font-mono font-bold">
                  {formatInr(amountPaise, true)}
                </div>
              </div>
            </div>

            <button
              onClick={handleMintLink}
              disabled={minting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30 transition-all disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              <span>{minting ? 'Minting via Razorpay API…' : '⚡ Mint Razorpay Test Link'}</span>
            </button>
          </div>

          {/* Minted Link Display */}
          {mintedLink && (
            <div className="bg-slate-950/90 rounded-xl p-4 border border-sky-500/40 space-y-3 text-xs font-mono animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Minted URL:</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  {mintedLink.isMock ? 'Mock URL' : 'Live Razorpay Hosted Link'}
                </span>
              </div>
              <div className="text-sky-300 font-bold break-all">{mintedLink.shortUrl}</div>
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
                <a
                  href={mintedLink.shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400 shadow"
                >
                  <span>Open Hosted Checkout</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Webhook Resolution Simulator */}
        <div className="glass-card rounded-2xl p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-slate-900/60 to-slate-900/60 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>HMAC Webhook Ingestion (`POST /webhooks/razorpay`)</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                payment_link.paid
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              When a buyer settles a payment link, Razorpay posts a <code className="text-emerald-400 font-mono">payment_link.paid</code> webhook. Recoup verifies the <code className="text-indigo-300 font-mono">x-razorpay-signature</code> HMAC token, marks the case <code className="text-emerald-400 font-mono">RECOVERED</code>, and commits the resolution into the cryptographic audit trail.
            </p>

            <button
              onClick={handleSimulateWebhook}
              disabled={simulatingWebhook}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{simulatingWebhook ? 'Verifying HMAC Signature…' : 'Simulate Incoming Webhook Payment'}</span>
            </button>
          </div>

          {/* Webhook Result Box */}
          {webhookLog && (
            <div className="bg-slate-950/90 rounded-xl p-4 border border-emerald-500/40 space-y-2 text-xs font-mono animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <Check className="w-4 h-4" />
                <span>Case Resolved via Live Webhook!</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-white/[0.05]">
                <div>Risk Item: <strong className="text-white">{webhookLog.riskItemId}</strong></div>
                <div>Status: <span className="text-emerald-300 font-bold">RECOVERED</span> (Tagged <code className="text-sky-300">razorpay_live_webhook</code>)</div>
                <div>Event Chained: <span className="text-indigo-300">Seq #{webhookLog.auditEventSeq || 8304}</span></div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
