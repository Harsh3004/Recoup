# Independent Out-of-Distribution Diagnosis Evaluation Report

## Overview & Methodology

This benchmark tests true **out-of-distribution semantic generalization**. Unlike the synthetic corpus self-consistency check (`scripts/seed.ts`), this evaluation dataset contains 24 realistic, varied Accounts Payable correspondence snippets that **strictly avoid all literal regex keywords** matched by the rules baseline.

- **Total Independent Cases:** **24** (4 per class across 6 B2B root causes)
- **Language Diversity:** Formal English, Indian AP procurement jargon, and Hinglish dialogue
- **Rules Classifier Accuracy:** **20.8%** (5/24)
- **LLM Classifier Accuracy:** **95.8%** (23/24)
- **Semantic Generalization Lift:** **+75.0%**

## 1. Head-to-Head Comparison by Root Cause

| Root Cause Class | N | Rules Accuracy | LLM Accuracy | Advantage |
|---|---:|---:|---:|---:|
| `PO_GRN_MISMATCH` | 4 | 0% (0/4) | 100% (4/4) | **+100%** |
| `INVOICE_NOT_RECEIVED` | 4 | 0% (0/4) | 100% (4/4) | **+100%** |
| `APPROVAL_STUCK` | 4 | 0% (0/4) | 100% (4/4) | **+100%** |
| `LINE_ITEM_DISPUTE` | 4 | 25% (1/4) | 100% (4/4) | **+75%** |
| `CASH_CRUNCH` | 4 | 0% (0/4) | 100% (4/4) | **+100%** |
| `INVOICE_UNPAID` | 4 | 100% (4/4) | 75% (3/4) | **-25%** |

## 2. Disagreement Analysis (Where Rules Failed vs Where LLM Succeeded)

| Case ID | True Cause | Rules Prediction | LLM Prediction | Snippet Context |
|---|---|---|---|---|
| `indep_001` | `PO_GRN_MISMATCH` | ❌ `INVOICE_UNPAID` | ✅ `PO_GRN_MISMATCH` | *"Warehouse team at Bhiwandi facility says materials were not accepted at the..."* |
| `indep_002` | `PO_GRN_MISMATCH` | ❌ `INVOICE_UNPAID` | ✅ `PO_GRN_MISMATCH` | *"Physical count at gate 3 is pending because your driver unloaded after 6 PM..."* |
| `indep_003` | `PO_GRN_MISMATCH` | ❌ `INVOICE_UNPAID` | ✅ `PO_GRN_MISMATCH` | *"Stock intake register does not show these cartons. Please coordinate with l..."* |
| `indep_004` | `PO_GRN_MISMATCH` | ❌ `INVOICE_UNPAID` | ✅ `PO_GRN_MISMATCH` | *"Bhaiya, warehouse manager bol raha hai ki boxes receive hi nahi hue. Unload..."* |
| `indep_005` | `INVOICE_NOT_RECEIVED` | ❌ `INVOICE_UNPAID` | ✅ `INVOICE_NOT_RECEIVED` | *"We searched our shared finance mailbox and found zero emails from your doma..."* |
| `indep_006` | `INVOICE_NOT_RECEIVED` | ❌ `INVOICE_UNPAID` | ✅ `INVOICE_NOT_RECEIVED` | *"Our centralized accounting portal has no bill on file for this billing cycl..."* |
| `indep_007` | `INVOICE_NOT_RECEIVED` | ❌ `INVOICE_UNPAID` | ✅ `INVOICE_NOT_RECEIVED` | *"The previous attachment was a corrupt 0-byte file that our antivirus quaran..."* |
| `indep_008` | `INVOICE_NOT_RECEIVED` | ❌ `INVOICE_UNPAID` | ✅ `INVOICE_NOT_RECEIVED` | *"Mail bounce hua hoga aapka shayad, humare records me bill nahi dikh raha ha..."* |
| `indep_009` | `APPROVAL_STUCK` | ❌ `INVOICE_UNPAID` | ✅ `APPROVAL_STUCK` | *"The VP of Marketing is currently on international leave until Monday. Her d..."* |
| `indep_010` | `APPROVAL_STUCK` | ❌ `INVOICE_UNPAID` | ✅ `APPROVAL_STUCK` | *"The bill has passed initial audit and is currently parked in the department..."* |
| `indep_011` | `APPROVAL_STUCK` | ❌ `LINE_ITEM_DISPUTE` | ✅ `APPROVAL_STUCK` | *"We are waiting on the regional director to clear his internal portal backlo..."* |
| `indep_012` | `APPROVAL_STUCK` | ❌ `INVOICE_UNPAID` | ✅ `APPROVAL_STUCK` | *"Sirji, bill verify ho chuka hai, bas senior management ka sign-off bacha ha..."* |
| `indep_013` | `LINE_ITEM_DISPUTE` | ❌ `INVOICE_UNPAID` | ✅ `LINE_ITEM_DISPUTE` | *"Your quote clearly agreed on 450 per unit, but the billing states 520 per u..."* |
| `indep_014` | `LINE_ITEM_DISPUTE` | ❌ `INVOICE_UNPAID` | ✅ `LINE_ITEM_DISPUTE` | *"Our inspection team only counted 84 working units instead of the billed 100..."* |
| `indep_015` | `LINE_ITEM_DISPUTE` | ❌ `INVOICE_UNPAID` | ✅ `LINE_ITEM_DISPUTE` | *"You billed 18% IGST instead of 5% CGST/SGST for intrastate supply within Ma..."* |
| `indep_017` | `CASH_CRUNCH` | ❌ `INVOICE_UNPAID` | ✅ `CASH_CRUNCH` | *"We had a delayed receivable cycle from our hospital clients this quarter an..."* |
| `indep_018` | `CASH_CRUNCH` | ❌ `INVOICE_UNPAID` | ✅ `CASH_CRUNCH` | *"Our working capital limits are exhausted with SBI until our next trade loan..."* |
| `indep_019` | `CASH_CRUNCH` | ❌ `INVOICE_UNPAID` | ✅ `CASH_CRUNCH` | *"Due to slow recoveries from market distributors, our operational bank accou..."* |
| `indep_020` | `CASH_CRUNCH` | ❌ `INVOICE_UNPAID` | ✅ `CASH_CRUNCH` | *"Is mahine humari market payments phasi hui hain, bank account me fund balan..."* |
| `indep_024` | `INVOICE_UNPAID` | ✅ `INVOICE_UNPAID` | ❌ `CASH_CRUNCH` | *"Payment schedule me lined up hai. Monday ko treasury batch execute hoga to ..."* |

## 3. Confusion Matrix — Rules Classifier

| True Cause | Predicted as `PO_GRN` | `INVOICE_NOT_REC` | `APPROVAL` | `LINE_ITEM` | `CASH_CRUNCH` | `INVOICE_UNPAID` |
|---|---:|---:|---:|---:|---:|---:|
| `PO_GRN_MISMATCH` | 0 | 0 | 0 | 0 | 0 | 4 |
| `INVOICE_NOT_RECEIVED` | 0 | 0 | 0 | 0 | 0 | 4 |
| `APPROVAL_STUCK` | 0 | 0 | 0 | 1 | 0 | 3 |
| `LINE_ITEM_DISPUTE` | 0 | 0 | 0 | 1 | 0 | 3 |
| `CASH_CRUNCH` | 0 | 0 | 0 | 0 | 0 | 4 |
| `INVOICE_UNPAID` | 0 | 0 | 0 | 0 | 0 | 4 |

## 4. Confusion Matrix — LLM NLU Classifier

| True Cause | Predicted as `PO_GRN` | `INVOICE_NOT_REC` | `APPROVAL` | `LINE_ITEM` | `CASH_CRUNCH` | `INVOICE_UNPAID` |
|---|---:|---:|---:|---:|---:|---:|
| `PO_GRN_MISMATCH` | 4 | 0 | 0 | 0 | 0 | 0 |
| `INVOICE_NOT_RECEIVED` | 0 | 4 | 0 | 0 | 0 | 0 |
| `APPROVAL_STUCK` | 0 | 0 | 4 | 0 | 0 | 0 |
| `LINE_ITEM_DISPUTE` | 0 | 0 | 0 | 4 | 0 | 0 |
| `CASH_CRUNCH` | 0 | 0 | 0 | 0 | 4 | 0 |
| `INVOICE_UNPAID` | 0 | 0 | 0 | 0 | 1 | 3 |
