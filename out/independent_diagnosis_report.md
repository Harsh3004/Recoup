# Accounts Payable Correspondence Diagnosis Benchmark

> **Methodological Disclosure:** This benchmark is an **author-curated 24-case qualitative sanity check** designed to simulate real-world accounts payable correspondence (dock disputes, ERP approval delays, missing bills, rate card conflicts, liquidity extensions). It is **not** an external held-out academic dataset.

## 1. Three-Way Accuracy Comparison

| Classifier | Mechanism | Accuracy | Correct / Total | Description |
|---|---|---:|---:|---|
| **Narrow Keyword Baseline** | Exact regex matching | **20.8%** | 5/24 | Minimal regex tuned to exact synthetic seed strings; brittle to paraphrase |
| **Fair Domain Rules** | Comprehensive domain regex | **75.0%** | 18/24 | Fair production baseline equipped with industry AP synonyms and vocabulary |
| **LLM Semantic Classifier** | Live LLM inference (`minimax/minimax-m3:free`) | **95.8%** | 23/24 | Understands conversational context, Hinglish, and multi-factor causality |

**Key Finding:** Even with substantial domain engineering, keyword rules cap at **75.0%** because real buyers use ambiguous phrasing, indirect explanations, and overlapping terms. The LLM achieves **95.8%** zero-shot accuracy (+20.8% net lift over fair rules) without needing ongoing dictionary maintenance.

## 2. Head-to-Head Performance by Root Cause

| Root Cause Class | N | Fair Rules Accuracy | LLM Accuracy | Advantage |
|---|---:|---:|---:|---:|
| `PO_GRN_MISMATCH` | 4 | 100% (4/4) | 100% (4/4) | **0%** |
| `INVOICE_NOT_RECEIVED` | 4 | 50% (2/4) | 100% (4/4) | **+50%** |
| `APPROVAL_STUCK` | 4 | 100% (4/4) | 100% (4/4) | **0%** |
| `LINE_ITEM_DISPUTE` | 4 | 75% (3/4) | 100% (4/4) | **+25%** |
| `CASH_CRUNCH` | 4 | 50% (2/4) | 100% (4/4) | **+50%** |
| `INVOICE_UNPAID` | 4 | 75% (3/4) | 75% (3/4) | **0%** |

## 3. Disagreement Analysis: Cases Where Fair Rules Failed But LLM Succeeded

| Case ID | True Cause | Fair Rules Predicted | LLM Predicted | Buyer Correspondence Snippet |
|---|---|---|---|---|
| `indep_006` | `INVOICE_NOT_RECEIVED` | `LINE_ITEM_DISPUTE` | `INVOICE_NOT_RECEIVED` | *"Our centralized accounting portal has no bill on file for this billing cycle. Please email the tax document along with y..."* |
| `indep_008` | `INVOICE_NOT_RECEIVED` | `INVOICE_UNPAID` | `INVOICE_NOT_RECEIVED` | *"Mail bounce hua hoga aapka shayad, humare records me bill nahi dikh raha hai. Ek baar accounts desk ko copy forward kar ..."* |
| `indep_013` | `LINE_ITEM_DISPUTE` | `APPROVAL_STUCK` | `LINE_ITEM_DISPUTE` | *"Your quote clearly agreed on 450 per unit, but the billing states 520 per unit across all 200 pieces. We are holding the..."* |
| `indep_019` | `CASH_CRUNCH` | `INVOICE_UNPAID` | `CASH_CRUNCH` | *"Due to slow recoveries from market distributors, our operational bank account has insufficient balance to honor the full..."* |
| `indep_020` | `CASH_CRUNCH` | `APPROVAL_STUCK` | `CASH_CRUNCH` | *"Is mahine humari market payments phasi hui hain, bank account me fund balance tight hai. Thoda samay de dijiye ya stagge..."* |
| `indep_021` | `INVOICE_UNPAID` | `APPROVAL_STUCK` | `INVOICE_UNPAID` | *"Thanks for the reminder. This has been queued for our standard Friday vendor payout run. You should receive the UTR numb..."* |

## 4. Why Semantic Reasoning Beats Rule Dictionaries

1. **Colloquial & Regional Idioms:** Phrases like *'bhaiya warehouse manager bol raha hai ki boxes receive hi nahi hue'* contain both relationship markers and receipt confirmation issues that keyword matchers easily confound.
2. **Compound Root Causes:** When an email mentions both a missing PO and an approval delay, rule engines trigger on whichever word appears first. The LLM correctly identifies the *root blocking condition*.
3. **Zero Maintenance:** Production rules require constant regex patching as customers introduce new phrasing; the LLM handles novel phrasing zero-shot.