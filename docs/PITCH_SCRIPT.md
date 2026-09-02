# Recoup — 3-Minute Stage Pitch Script

**Target Duration:** 3:00 minutes  
**Target Audience:** Razorpay Hackathon Judges, Fintech Executives, CFOs

---

## Word-for-Word Presentation Script

### [0:00 – 0:40] The Problem & The Holdout-Backed Headline
*(Speaker is standing at the podium. Dashboard is open on the main screen showing top headline metrics.)*

> *"Judges, every year, Indian businesses lose over ₹45,000 Crore to failed transactions across subscriptions, checkout drop-offs, broken e-mandates, and disputed B2B invoices.
> 
> Most dunning tools are dumb: they spam customers with generic emails, send voice calls during dinner, and take credit for payments customers would have made anyway.
> 
> Meet **Recoup** — the autonomous, compliance-first failed payment recovery engine.
> 
> Look at the headline on screen: Across a simulated economy of 1,200 businesses and ₹16.2 Crore in treatment exposure, Recoup generated **₹2.38 Crore of net incremental recovered cash** — a **+317.0% lift** backed by an inviolable 15% randomized holdout.
> 
> Our 1,000-sample bootstrap confidence interval proves a non-zero lower bound of **₹87.90 Lakh** at 95% statistical significance — and our sensitivity band confirms the lift holds even under small-strata variation."*

---

### [0:40 – 1:15] Universality Across 4 Surfaces & Meaningful AI
*(Speaker clicks through Surface A, B, C, and D tabs on the dashboard.)*

> *"Payment failure in India is not a single problem. Recoup is built with a universal architecture covering all 4 failure surfaces:
> 
> - **Surface A: Subscription Autopay** — Salary-cycle aware smart retries and 1-tap card updaters.
> - **Surface B: Checkout Drop-Off** — Re-engaging abandoned carts with dynamic UPI intent deep-links.
> - **Surface C: Mandate Failures** — Enforcing strict RBI 24-hour pre-debit notices and AFA re-authorization.
> - **Surface D: B2B High-Value Invoices** — Structured LLM NLU diagnosis on complex AP email threads, resolving GRN mismatches and capturing structured Promises-to-Pay for ₹10 Lakh to ₹35 Lakh invoices.
> 
> In fact, our independent NLU diagnostic evaluation proves **95.8% accuracy vs 20.8% on regex rules**, demonstrating true semantic reasoning on unkeyworded AP correspondence."*

---

### [1:15 – 1:55] Compliance Rails & Cryptographic GatePassport
*(Speaker points to the Outage Replay panel, then clicks "View Suppressed Case".)*

> *"In recovery, **the contacts you don't send are just as important as the ones you do**.
> 
> Look at our compliance metrics: **682 contacts were suppressed by our guardrails**.
> 
> During our simulated 6-hour HDFC gateway degradation, the success rate plummeted to 26.7% with a -7.14 z-score spike. Traditional dunning bots would have spammed 21 customers for a bank outage.
> 
> Recoup's anomaly detector caught the incident in real time. Notice case `rsk_A_000313`: Gate decision was an immediate **BLOCK: SYSTEMIC_INCIDENT**.
> 
> And our compliance gate is architecturally non-bypassable: dispatchMockAdapter is the only exported dispatch entry point in the codebase, and it strictly requires an HMAC-SHA256 signed **GatePassport token** binding the specific action and step. Any attempt to dispatch without gate authorization throws a fatal security exception."*

---

### [1:55 – 2:30] 1-Click Case Drilldown & Mid-Ladder Cancellation
*(Speaker clicks case `rsk_A_000004` (Tanvi Nair), opening the multi-tab drilldown modal.)*

> *"Let's drill into a single live case in 1 click.
> 
> Customer Tanvi Nair had an issuer soft decline on a ₹199 subscription. 
> 
> 1. **Diagnosis:** `ISSUER_SOFT` with 94% confidence.
> 2. **Expected Value Rationale:** Selected `ONE_TAP_UPI` because UPI has a 78% conversion probability in India with ₹151 expected net value.
> 3. **Gate Approval:** Verified quiet hours (12:30 PM local time) and valid TRAI DLT template registration, minting a signed GatePassport.
> 4. **Dispatch:** Formatted dynamic WhatsApp message with one-tap payment link.
> 
> The moment Tanvi paid on Step 1, Recoup's continuous re-evaluator **immediately cancelled Step 2**. We cancelled **339 unnecessary follow-ups** across the batch the second cash was captured — saving customer goodwill and channel cost."*

---

### [2:30 – 3:00] Playbook Ablation & Cryptographic Audit Proof
*(Speaker clicks the "Verify Audit Chain" button, then points to the Ablation metrics.)*

> *"Finally, trust requires mathematical and cryptographic proof.
> 
> Did our agent's intelligence actually drive this recovery? We ran a formal **Playbook Ablation Study**: when we replace Recoup's EV optimization with a generic naive dunning ladder, recovery **collapses by -51.6%** — mathematically proving our routing causally unlocks ₹2.18 Crore.
> 
> And every single detection, diagnosis, EV plan, gate decision, and recovery is chained into an append-only, SHA-256 hash-chained audit ledger with SQLite database triggers.
> 
> Click **'Verify Audit Chain'**: **8,319 audit events verified in milliseconds** with 100% cryptographic integrity.
> 
> Maximum recovery, mathematical honesty, and cryptographic accountability. That is Recoup. Thank you."*
