# Detection Report — Recoup Signal & Anomaly Extraction

- **As-of:** 2026-08-20T06:30:00.000Z
- **Seed:** `42`
- **Total Risk Items Detected:** **1314**
- **Total ₹ at Risk:** **₹18,64,72,663.00**

## Acceptance Verification

> **Plan Acceptance Criterion:** *every seeded loss event maps to exactly one risk item; the injected outage is flagged as an incident, not 40 angry dunning emails.*

| Check | Target | Actual | Status |
|---|---|---|---|
| Seeded Loss Events Mapped | 1,314 | **1314** | **PASS** |
| Systemic Incident Flagged | ≥ 1 | **1** (razorpay × HDFC) | **PASS** |
| Incident Affected Items Tagged | 88 | **21** (₹51,679.00) | **PASS** |
| Ground Truth Isolation | 0 reads | **0 reads** (verified) | **PASS** |

## 1. ₹ at Risk by Surface

| Surface | Description | Items | Exposure (₹) | Share of Total ₹ |
|---|---|---:|---:|---:|
| **A** | Payment failure / involuntary churn | 471 | ₹9,15,329.00 | 0.49% |
| **B** | Checkout abandonment | 380 | ₹20,53,120.00 | 1.10% |
| **C** | Mandate / subscription breakage | 186 | ₹2,80,414.00 | 0.15% |
| **D** | B2B receivables past due | 277 | ₹18,32,23,800.00 | 98.26% |
| **Total** | **All 4 Surfaces Combined** | **1314** | **₹18,64,72,663.00** | **100.00%** |

## 2. Systemic Degradation & Outage Detection

### Incident `inc_000001`: RAZORPAY × HDFC
- **Status:** `OPEN` (Source: `GATEWAY_ISSUER_DEGRADATION`)
- **Window:** 2026-08-19T04:00:00.000Z → 2026-08-19T11:00:00.000Z (7 hours)
- **Degradation Magnitude:** Success rate dropped to **26.7%** vs. baseline **80.6%**
- **Statistical Anomaly:** **z-score = -7.14** (Threshold: z < -2.0)
- **Total Failed Attempts in Window:** **88 / 120**
- **Risk Items Linked & Tagged for Suppression:** **21** (₹51,679.00)

## 3. Stratified Cohort Split (Treatment vs. Holdout)

| Cohort | Items | Target % | Actual % | Exposure (₹) | Exposure % |
|---|---:|---:|---:|---:|---:|
| **TREATMENT** (Active Recovery) | 1117 | 85.0% | 85.0% | ₹16,20,97,869.00 | 86.9% |
| **HOLDOUT** (Control / Baseline) | 197 | 15.0% | 15.0% | ₹2,43,74,794.00 | 13.1% |
| **Total** | **1314** | **100.0%** | **100.0%** | **₹18,64,72,663.00** | **100.0%** |

### Stratification Balance by Surface

| Surface | Treatment Items | Treatment ₹ | Holdout Items | Holdout ₹ | Holdout Item % |
|---|---:|---:|---:|---:|---:|
| Surface **A** | 400 | ₹7,68,800.00 | 71 | ₹1,46,529.00 | 15.1% |
| Surface **B** | 323 | ₹17,68,077.00 | 57 | ₹2,85,043.00 | 15.0% |
| Surface **C** | 158 | ₹2,48,342.00 | 28 | ₹32,072.00 | 15.1% |
| Surface **D** | 236 | ₹15,93,12,650.00 | 41 | ₹2,39,11,150.00 | 14.8% |

## 4. Top 10 Highest Risk Items Detected

| Risk Item ID | Surface | Customer | Exposure (₹) | p_loss | Urgency | Risk Score | Cohort | Tag |
|---|---|---|---:|---:|---:|---:|---|---|
| `rsk_D_000979` | D | `cus_001146` | ₹50,00,000.00 | 80% | 65% | **260,000,000** | `TREATMENT` | — |
| `rsk_D_001047` | D | `cus_001192` | ₹50,00,000.00 | 80% | 65% | **260,000,000** | `TREATMENT` | — |
| `rsk_D_001001` | D | `cus_001158` | ₹50,00,000.00 | 65% | 78% | **253,500,000** | `TREATMENT` | — |
| `rsk_D_001012` | D | `cus_001166` | ₹50,00,000.00 | 65% | 78% | **253,500,000** | `TREATMENT` | — |
| `rsk_D_001031` | D | `cus_001184` | ₹50,00,000.00 | 65% | 78% | **253,500,000** | `TREATMENT` | — |
| `rsk_D_001041` | D | `cus_001188` | ₹50,00,000.00 | 65% | 78% | **253,500,000** | `HOLDOUT` | — |
| `rsk_D_001051` | D | `cus_001197` | ₹50,00,000.00 | 65% | 78% | **253,500,000** | `TREATMENT` | — |
| `rsk_D_000984` | D | `cus_001150` | ₹35,00,000.00 | 75% | 78% | **204,750,000** | `TREATMENT` | — |
| `rsk_D_000977` | D | `cus_001145` | ₹50,00,000.00 | 45% | 88% | **198,000,000** | `TREATMENT` | — |
| `rsk_D_001026` | D | `cus_001177` | ₹50,00,000.00 | 45% | 88% | **198,000,000** | `TREATMENT` | — |
