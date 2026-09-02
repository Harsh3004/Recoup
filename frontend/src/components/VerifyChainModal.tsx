import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, RefreshCw, Lock } from 'lucide-react';

interface VerifyChainModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const VerifyChainModal: React.FC<VerifyChainModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [verificationData, setVerificationData] = useState<any>(null);

  const runVerification = async () => {
    setVerifying(true);
    try {
      const res = await fetch('/api/verify', { method: 'POST' });
      const data = await res.json();
      setVerificationData(data);
      if (data.valid) {
        showToast(`✓ All ${data.totalEvents?.toLocaleString()} events cryptographically verified!`, 'success');
      } else {
        showToast('Chain integrity check failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-[#0d1322] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">SHA-256 Audit Chain Verification</h3>
              <p className="text-xs text-slate-400">Cryptographic hash-chain integrity proof across all audit events</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="glass-card p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Cryptographic Invariant Proof
                </span>
              </div>
              <button
                onClick={runVerification}
                disabled={verifying}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
                <span>{verifying ? 'Verifying…' : 'Run Full Verification'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Iterates through every block from Genesis (<code className="font-mono text-emerald-400">0000...0000</code>) to the chain head, recomputing canonical SHA-256 hashes: <code className="font-mono text-indigo-300">H_i = SHA-256(H_{'{i-1}'} || P_i)</code>.
            </p>
          </div>

          {/* Verification Results */}
          {verificationData && (
            <div className="bg-slate-950/80 rounded-xl p-4 border border-white/[0.08] space-y-2.5 font-mono text-xs animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Chain Status:</span>
                <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  verificationData.valid
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {verificationData.valid ? '✓ 100% CRYPTOGRAPHICALLY VALID' : '✗ CORRUPT / TAMPER DETECTED'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Total Events Verified:</span>
                <strong className="text-white">{verificationData.totalEvents?.toLocaleString()}</strong>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Genesis Previous Hash:</span>
                <span className="text-slate-400 font-mono text-[10px] truncate max-w-[240px]">
                  {verificationData.genesisHash || '0000000000000000000000000000000000000000000000000000000000000000'}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Chain Head Hash:</span>
                <span className="text-indigo-300 font-mono text-[10px] truncate max-w-[240px]">
                  {verificationData.headHash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.08] flex items-center justify-end bg-slate-900/60">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-300"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
