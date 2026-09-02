# Diagnosis Report — Root-Cause & Systemic Classifier

- **Total Diagnosed Risk Items:** **2**
- **Systemic Incidents Flagged:** **0** (100% suppressed from outbound customer contact)
- **Real LLM-Assisted Diagnoses:** **0** (unstructured B2B email threads & dispute notes)
- **LLM Skipped (Rules Fallback):** **1**

## Acceptance Verification

> **Plan Acceptance Criterion:** *≥85% root-cause self-consistency on seeded synthetic corpus; 100% of outage-window failures marked systemic. (Note: For out-of-distribution NLU generalization on unkeyworded text, see out/independent_diagnosis_eval.md)*

## 1. Root-Cause Distribution by Surface

### Surface A
| Root Cause | Count | Share |
|---|---:|---:|

### Surface B
| Root Cause | Count | Share |
|---|---:|---:|

### Surface C
| Root Cause | Count | Share |
|---|---:|---:|

### Surface D
| Root Cause | Count | Share |
|---|---:|---:|
| `INVOICE_UNPAID` | 1 | 50.0% |
| `PO_GRN_MISMATCH` | 1 | 50.0% |

## 3. Sample Diagnostic Evidence Chains

### Diagnosis for `rsk_unstructured` (PO_GRN_MISMATCH)
- **Confidence:** 94.0%
- **Systemic Flag:** `NO`
- **LLM Used:** `NO (Skipped: no_api_key)`
- **Evidence Chain:**
  - Rules classifier fallback (LLM skipped: no_api_key)
  - Email thread cites missing Goods Receipt Note (GRN) against PO PO_9999
  - AP team requested delivery challan confirmation from stores before payment release
  - Outstanding amount: ₹1,20,000.00 (PAST_DUE)
