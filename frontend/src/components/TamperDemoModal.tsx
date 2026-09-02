import React, { useState } from 'react';
import { X, AlertTriangle, Play, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface TamperDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TamperDemoModal: React.FC<TamperDemoModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [testing, setTesting] = useState(false);
  const [tamperResult, setTamperResult] = useState<any>(null);

  const runTamperTest = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/tamper-test', { method: 'POST' });
      const data = await res.json();
      setTamperResult(data);
      showToast('🛡️ Tamper detected & caught live by engine!', 'info');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-[#0d1322] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Cryptographic Tamper Attack Proof</h3>
              <p className="text-xs text-slate-400">Simulate adversarial byte mutation on an immutable audit block</p>
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
          <div className="glass-card p-4 rounded-xl space-y-3 border border-rose-500/20">
            <p className="text-xs text-slate-300 leading-relaxed">
              This demo attempts an adversarial in-memory modification of a single byte inside sequence event payload <code className="font-mono text-rose-300">P_n</code> to prove that the SHA-256 hash chain verification fails instantly with an alert.
            </p>

            <button
              onClick={runTamperTest}
              disabled={testing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              <span>{testing ? 'Executing Attack Simulation…' : 'Simulate 1-Byte Payload Mutation'}</span>
            </button>
          </div>

          {/* Tamper Results */}
          {tamperResult && (
            <div className="bg-slate-950/90 rounded-xl p-4 border border-rose-500/30 space-y-2.5 font-mono text-xs animate-fadeIn">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Tamper Caught Live by Chain Engine</span>
              </div>

              <div className="text-[11px] text-slate-300 space-y-1 pt-2 border-t border-white/[0.06]">
                <div>Mutated Block: <strong className="text-rose-300">Seq #{tamperResult.tamperedSeq}</strong></div>
                <div className="truncate text-slate-400">Original Hash: <span className="text-emerald-400">{tamperResult.originalHash}</span></div>
                <div className="truncate text-slate-400">Recomputed Hash: <span className="text-rose-400">{tamperResult.tamperedHash}</span></div>
                <div className="text-rose-300 pt-1">Alert: <strong>{tamperResult.errorMessage}</strong></div>
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
