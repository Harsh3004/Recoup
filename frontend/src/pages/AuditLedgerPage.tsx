import React, { useState } from 'react';
import { Blocks, ShieldCheck, AlertTriangle, Check, Copy, RefreshCw, Lock, Terminal } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

interface AuditLedgerPageProps {
  onOpenVerifyModal: () => void;
  onOpenTamperModal: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuditLedgerPage: React.FC<AuditLedgerPageProps> = ({
  onOpenVerifyModal,
  onOpenTamperModal,
  showToast,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const sampleBlocks = [
    { seq: 8303, action: 'EXECUTION_COMPLETED', actor: 'ADAPTER_DISPATCHER', decision: 'DELIVERED', timestamp: Date.now() - 30000, prevHash: 'b4a8e99120cfa72910d8a556d4981120', hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' },
    { seq: 8302, action: 'PASSPORT_MINTED', actor: 'COMPLIANCE_GATE', decision: 'ALLOW', timestamp: Date.now() - 60000, prevHash: '72c9a101488daee5019284ba01490212', hash: 'b4a8e99120cfa72910d8a556d4981120' },
    { seq: 8301, action: 'POLICY_SELECTED', actor: 'EV_POLICY_ENGINE', decision: 'PROMISE_TO_PAY', timestamp: Date.now() - 90000, prevHash: '1940acdf129038ba98201fae019248aa', hash: '72c9a101488daee5019284ba01490212' },
    { seq: 8300, action: 'DIAGNOSIS_COMMITTED', actor: 'LLM_NLU_AGENT', decision: 'PO_GRN_MISMATCH', timestamp: Date.now() - 120000, prevHash: 'fa902188ba019488da018274aee98120', hash: '1940acdf129038ba98201fae019248aa' },
    { seq: 8299, action: 'RISK_DETECTED', actor: 'SURFACE_D_SENSOR', decision: 'INGESTED', timestamp: Date.now() - 150000, prevHash: '018928374aee89102488a01847120194', hash: 'fa902188ba019488da018274aee98120' },
  ];

  const copyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(id);
    showToast('Hash copied to clipboard', 'info');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <Blocks className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-black text-white tracking-tight">Cryptographic SHA-256 Audit Ledger</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable, tamper-evident hash chain protected by SQLite abort triggers ensuring verifiable auditability (R4).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenVerifyModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify All 8,303 Events</span>
          </button>
          <button
            onClick={onOpenTamperModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/[0.08] transition-all"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Tamper Attack Proof</span>
          </button>
        </div>
      </div>

      {/* Ledger Formula & Invariant Card */}
      <div className="glass-card rounded-2xl p-5 border border-indigo-500/30 bg-gradient-to-r from-indigo-950/30 via-slate-900/60 to-purple-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            R4 Invariant Formula
          </span>
          <div className="text-sm font-mono font-bold text-white mt-1">
            H_i = SHA-256( H_{'{i-1}'} || canonical(P_i) )
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Protected by database triggers rejecting any <code className="text-rose-300 font-mono">UPDATE</code> or <code className="text-rose-300 font-mono">DELETE</code> statements.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/[0.06] text-center">
            <div className="text-slate-400 text-[10px]">TOTAL BLOCKS</div>
            <div className="text-base font-extrabold text-white">8,303</div>
          </div>
          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/[0.06] text-center">
            <div className="text-slate-400 text-[10px]">INTEGRITY</div>
            <div className="text-base font-extrabold text-emerald-400">100.0%</div>
          </div>
        </div>
      </div>

      {/* Vertical Blockchain Explorer Spine */}
      <div className="glass-card rounded-2xl p-6 border border-white/[0.08] space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <span>Recent Blockchain Sequence Timeline</span>
        </h3>

        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-emerald-400 via-indigo-500 to-cyan-500">
          {sampleBlocks.map((b) => (
            <div
              key={b.seq}
              className="relative glass-card rounded-xl p-4 border border-white/[0.08] hover:border-indigo-500/40 transition-all space-y-2.5"
            >
              {/* Dot on spine */}
              <div className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-[#0d1322] border-2 border-indigo-400 shadow-sm shadow-indigo-500/50"></div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-300">BLOCK #{b.seq}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/[0.06] text-slate-200">
                    {b.action}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Actor: {b.actor}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">{formatDateTime(b.timestamp)}</span>
              </div>

              {/* Hash Chain Values */}
              <div className="space-y-1 font-mono text-[10px] bg-slate-950/80 p-3 rounded-lg border border-white/[0.05]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>PREV HASH:</span>
                  <span className="truncate max-w-[340px] text-slate-400">{b.prevHash}</span>
                </div>
                <div className="flex items-center justify-between text-indigo-300 pt-1 border-t border-white/[0.05]">
                  <span>BLOCK HASH:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate max-w-[340px] font-bold text-cyan-300">{b.hash}</span>
                    <button
                      onClick={() => copyHash(b.hash, `b-${b.seq}`)}
                      className="p-1 hover:text-white"
                      title="Copy Block Hash"
                    >
                      {copiedHash === `b-${b.seq}` ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
