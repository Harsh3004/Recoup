import React from 'react';
import { ShieldCheck, ShieldAlert, Clock, FileCheck, Lock, CheckCircle2, AlertOctagon } from 'lucide-react';
import { OverviewData } from '../types';

interface CompliancePageProps {
  overviewData: OverviewData | null;
}

export const CompliancePage: React.FC<CompliancePageProps> = ({ overviewData }) => {
  const stoppingRules = [
    { code: 'STOPPING_RULE_OPTED_OUT', name: 'Opted Out / DND Active', desc: 'Customer requested DND or unsubscribed. Zero outreach permitted.', count: 18, severity: 'CRITICAL' },
    { code: 'STOPPING_RULE_SYSTEMIC_INCIDENT', name: 'Systemic Outage Suppression', desc: 'Upstream gateway downtime detected. 100% communications suppressed.', count: 21, severity: 'CRITICAL' },
    { code: 'STOPPING_RULE_FRAUD_OR_BANKRUPTCY', name: 'Fraud / Bankruptcy Flag', desc: 'Active insolvency or risk alert flagged in ledger.', count: 12, severity: 'CRITICAL' },
    { code: 'STOPPING_RULE_DISPUTE_OPEN', name: 'Formal Dispute Open', desc: 'Chargeback or formal commercial dispute filed. Halts automated dunning.', count: 42, severity: 'HIGH' },
    { code: 'STOPPING_RULE_PROMISE_TO_PAY_ACTIVE', name: 'Active Promise-to-Pay (PTP)', desc: 'Valid payment commitment window active. Suppresses aggressive outreach.', count: 114, severity: 'MEDIUM' },
    { code: 'STOPPING_RULE_PAID', name: 'Item Already Recovered', desc: 'Payment link or mandate settled. Immediately terminates dunning sequence.', count: 428, severity: 'CRITICAL' },
    { code: 'STOPPING_RULE_MAX_ATTEMPTS_REACHED', name: 'Max Touchpoint Threshold', desc: 'RBI & TRAI caps on total daily outreach touches exceeded.', count: 19, severity: 'MEDIUM' },
    { code: 'STOPPING_RULE_HUMAN_TAKEOVER', name: 'Escalated to Account Executive', desc: 'Enterprise account manager assigned for manual resolution.', count: 24, severity: 'MEDIUM' },
    { code: 'STOPPING_RULE_NEGATIVE_EV', name: 'Negative Expected Value (EV)', desc: 'Channel dispatch cost exceeds statistical recovery probability.', count: 4, severity: 'LOW' },
  ];

  const dltTemplates = [
    { id: 'DLT-RECOUP-SUB-01', channel: 'SMS', purpose: 'Pre-debit Mandate Reminder (RBI 24h)', text: 'Dear {#var#}, your autopay for {#var#} of Rs.{#var#} will be processed on {#var#}. Ensure sufficient balance.' },
    { id: 'DLT-RECOUP-B2B-PTP', channel: 'WHATSAPP', purpose: 'Promise-to-Pay Confirmation', text: 'Hi {#var#}, confirming your promise to pay invoice {#var#} by {#var#}. Here is your secure payment link: {#var#}' },
    { id: 'DLT-RECOUP-DROP-02', channel: 'SMS', purpose: 'Cart Drop-Off Instant Recovery', text: 'Your payment of Rs.{#var#} on {#var#} was interrupted. Complete your order securely here: {#var#}' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-black text-white tracking-tight">Compliance Rails &amp; The 9 Stopping Rules</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically enforced choke point (`gate()`) implementing RBI, TRAI DLT, and quiet hours boundary proofs.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>{overviewData?.headline.gateSuppressed.toLocaleString() || '682'} Harassment Actions Blocked</span>
        </span>
      </div>

      {/* The 9 Stopping Rules Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
          <span>The 9 Non-Bypassable Stopping Rules</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stoppingRules.map((rule) => (
            <div key={rule.code} className="glass-card p-4 rounded-xl border border-white/[0.08] hover:border-amber-500/30 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold text-amber-300 px-2 py-0.5 rounded bg-amber-500/15">
                  {rule.code}
                </span>
                <span className="text-xs font-mono font-bold text-white bg-white/[0.06] px-2 py-0.5 rounded">
                  {rule.count} Blocked
                </span>
              </div>
              <div className="text-xs font-bold text-white">{rule.name}</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{rule.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quiet Hours & TRAI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quiet Hours Radar */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Quiet Hours Timezone Enforcement</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
              Zero Breaches
            </span>
          </div>

          <div className="bg-slate-950/70 p-4 rounded-xl border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.05]">
              <span className="text-slate-300">Commercial Comms Window:</span>
              <strong className="text-emerald-400 font-mono">08:00 – 21:00 IST</strong>
            </div>
            <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.05]">
              <span className="text-slate-300">Voice Call Restriction Window:</span>
              <strong className="text-amber-400 font-mono">08:00 – 19:00 IST</strong>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300">Touches Blocked Outside Hours:</span>
              <strong className="text-indigo-300 font-mono">29 Dispatches Suppressed</strong>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Strictly enforces boundary conditions at the millisecond level (e.g. 07:59:59 is rejected, 08:00:00 is allowed).
          </p>
        </div>

        {/* TRAI DLT Registry */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">TRAI DLT Template Registry</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.06] text-slate-300">
              3 Registered Templates
            </span>
          </div>

          <div className="space-y-2.5">
            {dltTemplates.map((t) => (
              <div key={t.id} className="bg-slate-950/70 p-3 rounded-xl border border-white/[0.06] space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-indigo-300">{t.id}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-400">{t.channel}</span>
                </div>
                <div className="text-slate-200 font-medium text-[11px]">{t.purpose}</div>
                <p className="text-[11px] text-slate-400 font-mono bg-white/[0.02] p-2 rounded">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cryptographic GatePassport Invariant Proof */}
      <div className="glass-card p-5 rounded-2xl border border-indigo-500/30 space-y-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Non-Bypassability &amp; GatePassport HMAC Token Security Proof</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The communication adapters (<code className="font-mono text-indigo-300">adapters/whatsapp.ts</code>, <code className="font-mono text-indigo-300">adapters/sms.ts</code>, <code className="font-mono text-indigo-300">adapters/voice.ts</code>) strictly demand a valid <code className="font-mono text-emerald-400">GatePassport</code> cryptographically signed with HMAC-SHA256 by <code className="font-mono text-indigo-300">gate()</code>. Any direct invocation outside the gate triggers an immediate <code className="font-mono text-rose-400">SecurityException</code>.
        </p>
      </div>
    </div>
  );
};
