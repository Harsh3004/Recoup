# Recoup — 3-Minute Demo Walkthrough Guide

The 3-minute executive demonstration script for presenting Recoup live on stage or to judges.

---

## Quick Start (Single Command)

```bash
# Clean deterministic pipeline run
bun run seed && bun run detect && bun run diagnose && bun run policy && bun run gate && bun run execute && bun run verify && bun run measure && bun run ablate

# Launch interactive executive demo dashboard
bun run demo
# Open browser at http://localhost:3000
```

---

## 3-Minute Walkthrough Flow (< 3 Clicks per Moment)

### Moment 1: The Headline Number & Randomized Holdout (0:00 – 0:45)
- **What to show:**
  - The top metric banner showing **₹2,38,17,692.70 net incremental ₹ recovered** (+317.0% lift).
  - The **95% Bootstrap Confidence Interval** tile: `[₹87.90 Lakh – ₹4.12 Cr]`.
  - The **Counterfactual Comparison table** in the center panel, contrasting Recoup against Pure Organic Holdout (₹75.12L) and Naive 3-Email Dunning.
- **Speaker Line:**
  > *"Every recovery platform claims massive collection numbers, but most of those customers would have paid anyway. Recoup is built with an inviolable 15% randomized holdout. On ₹16.2 Crore of treatment exposure, Recoup generated ₹2.38 Crore of true incremental cash — in our simulated economy. The non-zero lower bound of ₹87.90 Lakh is the statistically defensible claim."*

---

### Moment 2: The 4 Surfaces Universality & LLM NLU (0:45 – 1:15)
- **What to show:**
  - Click on each of the 4 surface tabs:
    - **Surface A:** Subscription Autopay (Smart Retry & Card Updater)
    - **Surface B:** Checkout Drop-Off (Cart Recovery & One-Tap UPI)
    - **Surface C:** Mandates (RBI-compliant pre-debit reauth)
    - **Surface D:** B2B Invoices (PTP & Human Escalation with Structured LLM NLU)
  - Point out that Surface D uses structured language understanding on complex AP email threads, achieving **100% accuracy vs 80.1% rules baseline**.
- **Speaker Line:**
  > *"Recovery isn't just dunning emails. In India, payment failure spans consumer UPI, e-mandates, and enterprise ERP invoices. Recoup is a universal recovery engine: it handles high-volume ₹199 micro-subscriptions and ₹35 Lakh corporate invoices with purpose-built playbooks."*

---

### Moment 3: The Outage Simulator & GatePassport (1:15 – 1:50)
- **What to show:**
  - Point to the **Injected Outage Replay** card: Razorpay × HDFC degradation (z = -7.14, 88 failures).
  - Click the **"View Suppressed Case"** shortcut button (opens case `rsk_A_000313`).
  - Highlight the Gate decision: `BLOCK: SYSTEMIC_INCIDENT` and 0 outbound communications.
  - Explain the HMAC-SHA256 `GatePassport` choke point architecture (`dispatchMockAdapter` as the only exported dispatch interface).
- **Speaker Line:**
  > *"When HDFC gateway degraded, traditional dunning bots harassed customers for banking infrastructure downtime. Recoup's anomaly detector caught the spike in real time, flagged all 21 affected customers, and automatically suppressed 100% of outbound contact. Zero customer complaints; zero brand damage."*

---

### Moment 4: 1-Click Case Drilldown & Mid-Ladder Cancellation (1:50 – 2:30)
- **What to show:**
  - Click on case `rsk_A_000004` (Tanvi Nair, ₹199.00).
  - Tab through **Root Cause & Evidence** → **Intervention Plan & EV** → **Dispatched Messages** (interactive WhatsApp payload with dynamic UPI intent link).
  - Point out that Step 1 succeeded, and Step 2 was immediately marked `CANCELLED` (mid-ladder payment cancellation).
- **Speaker Line:**
  > *"Every single decision has a written expected value rationale. The engine selected a One-Tap UPI intent link in English. The moment Tanvi paid on Step 1, all subsequent reminders were cancelled instantly — 339 unnecessary follow-ups eliminated across the batch."*

---

### Moment 5: Playbook Ablation & Cryptographic Hash Chain Audit (2:30 – 3:00)
- **What to show:**
  - Point to the **Playbook Ablation Result**: -51.6% degradation when EV optimization is replaced by generic dunning.
  - Click the **"Verify Audit Chain"** button: Live green checkmark showing **8,319 verified events** with genesis hash.
  - Click the **"Test Tamper Proof"** button: Demonstrates live detection of an attack mutating a single byte on row #3.
- **Speaker Line:**
  > *"Every diagnosis, gate block, and recovery is recorded in a tamper-evident SHA-256 hash chain with database-level immutability triggers. If a regulator or CFO asks 'Why did the AI contact this customer at 6pm?', we can prove the complete decision chain across 8,319 events with 100% cryptographic integrity."*

---

## Pre-Demo Checklist

- [ ] Run `bun test` to confirm all 20 unit and security invariant tests pass (20/20 PASS in ~200ms)
- [ ] Run clean pipeline: `bun run seed; bun run detect; bun run diagnose; bun run policy; bun run gate; bun run execute; bun run verify; bun run measure; bun run ablate`
- [ ] Run `bun run demo` and confirm `http://localhost:3000` loads
- [ ] Verify headline metrics match `out/measurement_report.md` (₹4.24 Cr net incremental / +564.2% lift)
- [ ] Have `out/ablation_report.md` and `out/audit_verification_report.md` open as backup
