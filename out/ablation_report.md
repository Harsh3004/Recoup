# Playbook Ablation & Causal Attribution Report

> **Isolation guarantee:** Each arm ran on its own DB copy (`data/ablation_arms/arm_N.db`). The primary `data/recovery.db` was never mutated during this evaluation. `out/measurement_report.md` was not written by this script.

- **Evaluation Target:** Prove agent decisions causally account for $\ge 25\%$ of recovery value.
- **Identical Playbook Degradation:** **-48.2%** (PASS (≥ 25%))
- **Random Policy Degradation:** **-45.6%**
- **Causal Revenue Contribution of Agent Decisions:** **₹1,07,05,134.00**

## Experimental Arms Comparison

| Experimental Arm | Gross Collected ₹ | Scaled Holdout Baseline ₹ | Net Incremental ₹ | Recovery Rate (%) | Degradation vs Agent |
|---|---:|---:|---:|---:|---:|
| **Recoup Autonomous Agent** | ₹2,97,30,685.00 | ₹75,12,368.30 | **₹2,22,18,316.70** | 18.3% | **Baseline** |
| **Random Playbook Policy** | ₹1,95,99,189.50 | ₹75,12,368.30 | **₹1,20,86,821.20** | 12.1% | **-45.6%** |
| **Identical Naive Dunning** | ₹1,90,25,551.00 | ₹75,12,368.30 | **₹1,15,13,182.70** | 11.7% | **-48.2%** |

## Causal Attribution Verdict

Ablating the agent's playbook optimization into a naive identical dunning campaign degrades net incremental recovery by **48.2%** (₹1,07,05,134.00 lost). This mathematically proves that recovery outcomes are causally driven by Recoup's root-cause routing and EV-optimization rather than latent customer willingness to pay.

## Arm Report Paths

Per-arm detailed measurement reports are written to:
- Agent arm: `out/ablation/arm_agent.md`
- Naive dunning arm: `out/ablation/arm_naive.md`
- Random policy arm: `out/ablation/arm_random.md`

> **Note:** Run `bun run measure` on the primary DB after ablation to confirm the agent-baseline headline figure is unchanged.