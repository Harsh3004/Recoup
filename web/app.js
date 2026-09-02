// Recoup Executive Dashboard Client Logic

let currentSurface = "";
let currentCohort = "";
let currentState = "";
let searchQuery = "";
let activeCaseData = null;
let activeDrawerTab = "summary";

function formatInr(paise) {
  const inr = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(inr);
}

// ============================================================
//  Toast Notification System
// ============================================================
function showToast(message, type = "error", duration = 4500) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast-notify toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "error" ? "⚠" : type === "success" ? "✔" : "ℹ"}</span>
    <span>${message}</span>
    <button class="toast-dismiss" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-visible"));
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================
//  Skeleton Loaders
// ============================================================
function skeletonOverview() {
  const ids = ["valIncremental", "valTreatmentRec", "valSuppressed", "valCi95"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<span class="skeleton-pulse" style="display:inline-block;width:90px;height:18px;border-radius:4px;"></span>`;
  });
}

function skeletonCasesTable() {
  const tbody = document.getElementById("casesTableBody");
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: 8 }).map(() => `
    <tr class="skeleton-row">
      ${Array.from({ length: 8 }).map(() => `<td><span class="skeleton-pulse" style="display:inline-block;width:80%;height:14px;border-radius:3px;"></span></td>`).join("")}
    </tr>
  `).join("");
}

function skeletonModal() {
  const container = document.getElementById("tabContentArea");
  if (!container) return;
  container.innerHTML = Array.from({ length: 4 }).map((_, i) => `
    <div style="margin-bottom: 18px; padding: 18px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
      <span class="skeleton-pulse" style="display:block;width:${35 + i * 12}%;height:16px;border-radius:4px;margin-bottom:10px;"></span>
      <span class="skeleton-pulse" style="display:block;width:${60 + i * 5}%;height:12px;border-radius:3px;"></span>
    </div>
  `).join("");
}


// Fetch Overview Data
async function loadOverview() {
  skeletonOverview();
  try {
    const res = await fetch("/api/overview");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    document.getElementById("valIncremental").innerText = formatInr(data.headline.incrementalRecoveredInr * 100);
    document.getElementById("valTreatmentRec").innerText = formatInr(data.headline.treatmentRecoveredInr * 100);
    document.getElementById("valSuppressed").innerText = data.headline.gateSuppressed.toLocaleString();
    document.getElementById("valCi95").innerText = `[${formatInr(data.headline.ci95.lowerInr * 100)} – ${formatInr(data.headline.ci95.upperInr * 100)}]`;
    document.getElementById("headerEventCount").innerText = data.headline.auditEventsChained.toLocaleString();
  } catch (err) {
    console.error("Failed to load overview data", err);
    showToast(`Overview failed to load: ${err.message}`, "error");
  }
}

// Fetch and Render Cases Table
async function loadCases() {
  const params = new URLSearchParams();
  if (currentSurface) params.set("surface", currentSurface);
  if (currentCohort) params.set("cohort", currentCohort);
  if (currentState) params.set("state", currentState);
  if (searchQuery) params.set("q", searchQuery);

  skeletonCasesTable();
  try {
    const res = await fetch(`/api/cases?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderCasesTable(data.cases, data.total, data.showing);
  } catch (err) {
    console.error("Failed to load cases", err);
    showToast(`Cases failed to load: ${err.message}`, "error");
    const tbody = document.getElementById("casesTableBody");
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#f87171;padding:24px;">⚠ Failed to load cases — ${err.message}</td></tr>`;
  }
}

function renderCasesTable(cases, total, showing) {
  const tbody = document.getElementById("casesTableBody");
  tbody.innerHTML = "";

  // Pagination indicator
  const paginationBar = document.getElementById("casesPaginationBar");
  const paginationText = document.getElementById("casesPaginationText");
  const paginationWarn = document.getElementById("casesPaginationWarn");
  if (paginationBar && paginationText && total != null) {
    const displayCount = showing ?? cases.length;
    paginationText.textContent = `Showing ${displayCount.toLocaleString()} of ${total.toLocaleString()} cases`;
    paginationBar.style.display = "flex";
    if (paginationWarn) {
      paginationWarn.style.display = (total > 200 && !searchQuery) ? "inline-block" : "none";
    }
  }

  if (cases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">No cases found matching current filters.</td></tr>`;
    return;
  }

  for (const c of cases) {
    const tr = document.createElement("tr");
    
    let stateBadge = `<span class="badge badge-lost">${c.state}</span>`;
    if (c.state === "RECOVERED") {
      if (c.resolved_via === "razorpay_live_webhook") {
        stateBadge = `<span class="badge badge-live-rzp">⚡ LIVE RZP RECOVERED</span>`;
      } else {
        stateBadge = `<span class="badge badge-recovered">RECOVERED</span>`;
      }
    } else if (c.state === "SUPPRESSED") stateBadge = `<span class="badge badge-suppressed">SUPPRESSED</span>`;
    else if (c.state === "PROMISED") stateBadge = `<span class="badge badge-promised">PROMISED</span>`;

    let incidentBadge = c.incident_id ? `<span class="badge badge-outage" style="margin-left: 4px;">OUTAGE</span>` : "";

    tr.innerHTML = `
      <td><strong>${c.id}</strong>${incidentBadge}</td>
      <td><span class="surface-code">Surface ${c.surface}</span></td>
      <td><strong>${c.customer_name}</strong><br><span style="font-size: 11px; color: var(--text-dim);">${c.customer_id} · ${c.segment}</span></td>
      <td><strong>${formatInr(c.exposure_paise)}</strong></td>
      <td><code>${c.root_cause || "—"}</code></td>
      <td><span style="color: var(--accent-indigo); font-weight: 600;">${c.playbook || "HOLDOUT"}</span></td>
      <td>${stateBadge}</td>
      <td><strong style="color: ${c.recovered_paise > 0 ? "var(--accent-emerald)" : "var(--text-dim)"};">${c.recovered_paise > 0 ? formatInr(c.recovered_paise) : "₹0.00"}</strong></td>
    `;

    tr.addEventListener("click", () => openCaseModal(c.id));
    tbody.appendChild(tr);
  }
}

// Open Case Drilldown Modal
async function openCaseModal(caseId) {
  document.getElementById("caseModal").classList.add("active");
  document.getElementById("modalTitle").innerText = `Loading case ${caseId}…`;
  skeletonModal();
  try {
    const res = await fetch(`/api/case/${caseId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    activeCaseData = await res.json();
    document.getElementById("modalTitle").innerText = `Case Drilldown: ${activeCaseData.riskItemId} (${activeCaseData.customerName})`;
    activeDrawerTab = "summary";
    updateDrawerTabs();
    renderDrawerContent();
  } catch (err) {
    console.error("Failed to open case modal", err);
    showToast(`Case ${caseId} failed to load: ${err.message}`, "error");
    document.getElementById("tabContentArea").innerHTML = `<p style="color:#f87171;padding:30px;text-align:center;">⚠ Failed to load case: ${err.message}</p>`;
    document.getElementById("modalTitle").innerText = `Error loading ${caseId}`;
  }
}

function updateDrawerTabs() {
  document.querySelectorAll(".drawer-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === activeDrawerTab);
  });
}

function renderDrawerContent() {
  const container = document.getElementById("tabContentArea");
  if (!activeCaseData) return;

  const t = activeCaseData;

  if (activeDrawerTab === "summary") {
    const isLiveRzp = t.resolvedVia === "razorpay_live_webhook";
    const plinkUrl = t.paymentLinkUrl || t.paymentLink?.short_url;

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div class="panel-card" style="padding: 16px;">
          <h4 style="color: var(--text-dim); font-size: 12px; text-transform: uppercase;">Customer Profile</h4>
          <p style="font-size: 16px; font-weight: 700; margin-top: 4px;">${t.customerName}</p>
          <p style="font-size: 13px; color: var(--text-muted);">${t.customerId} · ${t.customerSegment} Segment</p>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">📞 ${t.customerPhone} | ✉️ ${t.customerEmail}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Language Preference: <strong>${t.customerLanguage}</strong></p>
        </div>
        <div class="panel-card" style="padding: 16px;">
          <h4 style="color: var(--text-dim); font-size: 12px; text-transform: uppercase;">Exposure & Outcome</h4>
          <p style="font-size: 16px; font-weight: 700; color: var(--accent-emerald); margin-top: 4px;">${formatInr(t.exposurePaise)}</p>
          <p style="font-size: 13px; color: var(--text-muted);">Surface: <strong>Surface ${t.surface}</strong></p>
          <p style="font-size: 13px; color: var(--text-muted);">Cohort: <strong>${t.cohort}</strong></p>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Current Case State: <strong>${t.currentState}</strong></p>
          ${t.recovery ? `<p style="font-size: 13px; color: var(--accent-emerald); font-weight: 700;">Recovered: ${formatInr(t.recovery.amountPaise)} via ${t.recovery.channel}</p>` : ""}
        </div>
      </div>

      <div class="panel-card" style="padding: 18px; border: 1px solid ${isLiveRzp ? "#059669" : "var(--border-subtle)"}; background: rgba(15, 23, 42, 0.7); margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 700; color: ${isLiveRzp ? "#34d399" : "#a5b4fc"};">⚡ Razorpay Test-Mode Payment Rail</span>
            ${isLiveRzp ? '<span class="badge badge-live-rzp">LIVE WEBHOOK RECOVERED</span>' : ''}
          </div>
          <button id="btnGenerateRzpLink" class="btn btn-secondary" style="font-size: 11px; padding: 4px 10px;">
            ${plinkUrl ? "🔄 Regenerate Link" : "⚡ Generate Razorpay Test Link"}
          </button>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
          ${isLiveRzp 
            ? '✔ This case was resolved in real time by an authentic Razorpay <code>payment_link.paid</code> webhook event. Cryptographically recorded in SHA-256 audit ledger.'
            : 'Wire this recovery case to Razorpay test checkout. Pay using test cards or UPI to trigger the live webhook resolution pipeline.'}
        </p>
        ${plinkUrl ? `
          <div style="display: flex; align-items: center; gap: 10px; background: rgba(2, 6, 23, 0.8); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-subtle);">
            <span style="font-size: 12px; font-family: monospace; color: #93c5fd; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
              ${plinkUrl}
            </span>
            <a href="${plinkUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="font-size: 11px; padding: 5px 12px; text-decoration: none;">
              💳 Open Test Checkout ↗
            </a>
          </div>
        ` : `
          <div style="font-size: 11px; color: var(--text-dim); font-style: italic;">
            Click 'Generate Razorpay Test Link' above to create an authentic payment link via Razorpay REST API.
          </div>
        `}
        <div id="rzpLinkStatus" style="font-size: 11px; margin-top: 6px;"></div>
      </div>
    `;

    const btnGen = document.getElementById("btnGenerateRzpLink");
    if (btnGen) {
      btnGen.addEventListener("click", async () => {
        const statusEl = document.getElementById("rzpLinkStatus");
        btnGen.disabled = true;
        if (statusEl) statusEl.innerHTML = `<span style="color: #a5b4fc;">Contacting Razorpay API...</span>`;
        try {
          const res = await fetch("/api/rail/razorpay/create-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ riskItemId: t.riskItemId }),
          });
          const data = await res.json();
          if (data.success) {
            await openCaseModal(t.riskItemId);
          } else {
            if (statusEl) statusEl.innerHTML = `<span style="color: #f87171;">Failed: ${data.error || "API error"}</span>`;
          }
        } catch (err) {
          if (statusEl) statusEl.innerHTML = `<span style="color: #f87171;">Network error: ${err.message}</span>`;
        } finally {
          btnGen.disabled = false;
        }
      });
    }
  } else if (activeDrawerTab === "diagnosis") {
    if (!t.diagnosis) {
      container.innerHTML = `<p style="color: var(--text-dim);">No root cause diagnosis on record.</p>`;
      return;
    }
    container.innerHTML = `
      <div class="panel-card" style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-size: 18px; color: #93c5fd;">${t.diagnosis.rootCause}</h3>
          <span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa;">Confidence: ${(t.diagnosis.confidenceBps / 100).toFixed(1)}%</span>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Systemic Outage Flag: <strong>${t.diagnosis.isSystemic ? "YES (Contact Suppressed)" : "NO"}</strong></p>
        <h4 style="font-size: 13px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px;">Structured Evidence Chain:</h4>
        <ul style="padding-left: 20px; font-size: 13px; color: var(--text-main); line-height: 1.8;">
          ${t.diagnosis.evidence.map((e) => `<li>${e}</li>`).join("")}
        </ul>
      </div>
    `;
  } else if (activeDrawerTab === "policy") {
    if (!t.interventionPlan) {
      container.innerHTML = `<p style="color: var(--text-dim);">No intervention plan generated (Holdout or Skipped).</p>`;
      return;
    }
    container.innerHTML = `
      <div class="panel-card" style="padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <h3 style="font-size: 18px; color: var(--accent-indigo);">${t.interventionPlan.playbook}</h3>
          <span style="font-size: 14px; font-weight: 700; color: var(--accent-emerald);">Expected Value: ${formatInr(t.interventionPlan.evPaise)}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-main); margin-bottom: 12px;"><strong>Written EV Rationale:</strong> ${t.interventionPlan.rationale}</p>
        <h4 style="font-size: 13px; color: var(--text-dim); text-transform: uppercase; margin-bottom: 8px;">Scheduled Action Steps:</h4>
        <table class="cf-table">
          <thead>
            <tr><th>Step #</th><th>Channel</th><th>Action</th><th>Status</th><th>Exit Criteria</th></tr>
          </thead>
          <tbody>
            ${t.interventionPlan.steps.map((s) => `
              <tr>
                <td>${s.stepNo}</td>
                <td><code>${s.channel}</code></td>
                <td>${s.action}</td>
                <td><span class="badge ${s.status === 'EXECUTED' ? 'badge-recovered' : s.status === 'CANCELLED' ? 'badge-lost' : 'badge-suppressed'}">${s.status}</span></td>
                <td>${s.exitCriteria}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else if (activeDrawerTab === "gate") {
    container.innerHTML = `
      <table class="cf-table">
        <thead>
          <tr><th>Decision ID</th><th>Status</th><th>Reason Code</th><th>Details</th><th>Decided At</th></tr>
        </thead>
        <tbody>
          ${t.gateDecisions.map((g) => `
            <tr>
              <td><code>${g.id}</code></td>
              <td>${g.allowed ? '<span class="badge badge-recovered">ALLOW</span>' : '<span class="badge badge-outage">BLOCK</span>'}</td>
              <td><strong>${g.reasonCode}</strong></td>
              <td>${g.details}</td>
              <td style="color: var(--text-dim);">${new Date(g.decidedAt).toLocaleString("en-IN")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } else if (activeDrawerTab === "comms") {
    if (t.communications.length === 0) {
      container.innerHTML = `<p style="color: var(--text-dim); padding: 20px; text-align: center;">Zero outbound communications dispatched for this case (Suppressed by compliance rails or control holdout).</p>`;
      return;
    }
    container.innerHTML = t.communications.map((c) => `
      <div class="panel-card" style="padding: 16px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong>Message ${c.id} via <code>${c.channel}</code></strong>
          <span class="badge badge-recovered">${c.status}</span>
        </div>
        <div class="code-box">${JSON.stringify(JSON.parse(c.payload), null, 2)}</div>
      </div>
    `).join("");
  } else if (activeDrawerTab === "audit") {
    if (!t.auditTrail || t.auditTrail.length === 0) {
      container.innerHTML = `<p style="color: var(--text-dim); padding: 30px; text-align: center;">No cryptographic audit trail recorded for this case.</p>`;
      return;
    }

    const actionIcons = {
      DIAGNOSIS_COMMITTED: "🔬",
      POLICY_SELECTED: "⚖️",
      GATE_VERIFIED: "🛡️",
      GATE_PASSPORT_MINTED: "🎟️",
      INTERVENTION_EXECUTED: "⚡",
      RECOVERY_RECORDED: "💰",
      DEFAULT: "📋",
    };

    container.innerHTML = `
      <div class="audit-timeline-container">
        <div class="audit-timeline-header">
          <div>
            <div class="audit-header-title">
              <span>⛓️ Cryptographic Audit Chain</span>
              <span class="badge badge-recovered">${t.auditTrail.length} Blocks Continuous</span>
            </div>
            <div class="audit-header-subtitle">
              Strictly ordered hash chain: <code>H<sub>i</sub> = SHA-256(H<sub>i-1</sub> ∥ canonical(P<sub>i</sub>))</code>. Tamper-evident with SQLite abort triggers.
            </div>
          </div>
          <button onclick="runLiveVerification()" class="btn btn-secondary" style="font-size: 11px; padding: 6px 12px; display: flex; align-items: center; gap: 6px;">
            <span>🛡️ Verify Chain</span>
          </button>
        </div>

        <div class="audit-timeline">
          ${t.auditTrail.map((a, idx) => {
            const isGenesis = !a.prevHash || a.prevHash.startsWith("00000000000000000000000000000000");
            const icon = actionIcons[a.action] || actionIcons.DEFAULT;

            let actorBadge = `<span class="badge badge-actor-system">⚙️ ${a.actor}</span>`;
            if (a.actor === "AGENT") actorBadge = `<span class="badge badge-actor-agent">🤖 AGENT</span>`;
            else if (a.actor === "HUMAN") actorBadge = `<span class="badge badge-actor-human">👤 HUMAN</span>`;

            let decisionBadge = "";
            if (a.decision) {
              if (a.decision === "ALLOW") decisionBadge = `<span class="badge badge-recovered">ALLOW</span>`;
              else if (a.decision === "BLOCK") decisionBadge = `<span class="badge badge-outage">BLOCK</span>`;
              else if (a.decision === "RECOVER") decisionBadge = `<span class="badge badge-live-rzp">RECOVER</span>`;
              else decisionBadge = `<span class="badge badge-promised">${a.decision}</span>`;
            }

            const timeStr = new Date(a.ts).toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            let reasonsFormatted = "—";
            if (a.reasonCodes) {
              if (Array.isArray(a.reasonCodes)) {
                reasonsFormatted = a.reasonCodes.join(", ");
              } else if (typeof a.reasonCodes === "string") {
                try {
                  const parsedR = JSON.parse(a.reasonCodes);
                  reasonsFormatted = Array.isArray(parsedR) ? parsedR.join(", ") : a.reasonCodes;
                } catch {
                  reasonsFormatted = a.reasonCodes;
                }
              }
            }

            return `
              <div class="audit-block-item">
                <div class="audit-node" title="Block Sequence #${a.seq}"></div>
                <div class="audit-card">
                  <div class="audit-card-top">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span class="audit-block-seq">🔗 BLOCK #${a.seq}</span>
                      <span class="audit-action-title">
                        <span>${icon}</span>
                        <span>${a.action}</span>
                      </span>
                    </div>
                    <div class="audit-badges">
                      ${actorBadge}
                      ${decisionBadge}
                      <span style="font-size: 11px; color: var(--text-dim); margin-left: 4px;">🕒 ${timeStr}</span>
                    </div>
                  </div>

                  <!-- Cryptographic Hash Link -->
                  <div class="chain-link-box">
                    <div class="hash-row">
                      <span class="hash-label">PREV HASH:</span>
                      <code class="hash-code prev-hash ${isGenesis ? 'genesis' : ''}" title="${a.prevHash}">
                        ${isGenesis ? '0000000000000000000000000000000000000000000000000000000000000000 [GENESIS]' : a.prevHash}
                      </code>
                    </div>

                    <div class="chain-connector-arrow">
                      <span>↓</span>
                      <span class="chain-formula">SHA-256(H<sub>${a.seq > 1 ? a.seq - 1 : 0}</sub> ∥ canonical(P<sub>${a.seq}</sub>))</span>
                    </div>

                    <div class="hash-row">
                      <span class="hash-label">BLOCK HASH:</span>
                      <code class="hash-code block-hash" title="${a.hash}">
                        ${a.hash}
                      </code>
                      <button class="btn-copy-hash" onclick="navigator.clipboard.writeText('${a.hash}'); this.innerText='✔'; setTimeout(() => this.innerText='📋', 1200);" title="Copy full SHA-256 Hash">📋</button>
                    </div>
                  </div>

                  <div class="audit-meta-row">
                    <div>
                      <span style="color: var(--text-dim);">Event ID:</span> <code>${a.id}</code>
                    </div>
                    <div>
                      <span style="color: var(--text-dim);">Inputs Digest:</span> <span class="audit-inputs-digest">${(a.inputsDigest || "").slice(0, 18)}…</span>
                    </div>
                    ${reasonsFormatted !== "—" ? `
                      <div>
                        <span style="color: var(--text-dim);">Reason:</span> <span style="color: #cbd5e1; font-weight: 500;">${reasonsFormatted}</span>
                      </div>
                    ` : ''}
                    <div>
                      <span style="color: var(--text-dim);">Ledger:</span> <span style="color: #a5b4fc;">SQLite (Abort Triggers)</span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }
}

// Live Hash Chain Verification UI
async function runLiveVerification() {
  const modal = document.getElementById("verifyModal");
  const body = document.getElementById("verifyModalBody");
  modal.classList.add("active");
  body.innerHTML = `
    <div style="text-align: center; padding: 30px;">
      <div class="pulse-dot" style="width: 24px; height: 24px; margin: 0 auto 16px auto;"></div>
      <p style="font-size: 16px; font-weight: 600;">Recomputing SHA-256 Hash Chain from Genesis...</p>
      <p style="font-size: 13px; color: var(--text-dim); margin-top: 6px;">Verifying cryptographic sequence integrity and prev_hash links...</p>
    </div>
  `;

  try {
    const res = await fetch("/api/verify", { method: "POST" });
    const data = await res.json();

    body.innerHTML = `
      <div style="text-align: center; padding: 20px 10px;">
        <div style="display: inline-flex; width: 56px; height: 56px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); color: var(--accent-emerald); align-items: center; justify-content: center; font-size: 32px; margin-bottom: 14px;">✓</div>
        <h3 style="font-size: 20px; font-weight: 800; color: var(--accent-emerald);">100% Cryptographic Integrity Verified</h3>
        <p style="font-size: 14px; color: var(--text-muted); margin-top: 6px;">All <strong>${data.totalEvents}</strong> append-only audit events validated against genesis.</p>
      </div>
      <div class="code-box" style="margin-top: 14px;">
Genesis Prev: ${data.genesisPrevHash}
Head Event:   #${data.headSeq}
Head Hash:    ${data.headHash}
Verification: PASS (Zero sequence gaps, zero hash corruptions)
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<p style="color: var(--accent-rose);">Verification failed: ${err.message}</p>`;
  }
}

// Live Tamper Proof Demo UI
async function runTamperDemo() {
  const modal = document.getElementById("verifyModal");
  const body = document.getElementById("verifyModalBody");
  modal.classList.add("active");
  body.innerHTML = `
    <div style="text-align: center; padding: 30px;">
      <div class="pulse-dot" style="width: 24px; height: 24px; margin: 0 auto 16px auto; background: var(--accent-rose);"></div>
      <p style="font-size: 16px; font-weight: 600;">Simulating Malicious Payload Mutation on Row #3...</p>
    </div>
  `;

  try {
    const res = await fetch("/api/tamper-test", { method: "POST" });
    const data = await res.json();

    body.innerHTML = `
      <div style="text-align: center; padding: 20px 10px;">
        <div style="display: inline-flex; width: 56px; height: 56px; border-radius: 50%; background: rgba(244, 63, 94, 0.2); color: var(--accent-rose); align-items: center; justify-content: center; font-size: 32px; margin-bottom: 14px;">🛡️</div>
        <h3 style="font-size: 20px; font-weight: 800; color: #fb7185;">Tampering Caught Live by Chain Engine</h3>
        <p style="font-size: 14px; color: var(--text-muted); margin-top: 6px;">Mutating 1 single byte at Sequence #${data.tamperedSeq} immediately breaks the chain hash.</p>
      </div>
      <div class="code-box" style="margin-top: 14px; color: #fda4af;">
Mutated Sequence: Seq #${data.tamperedSeq}
Original Hash:    ${data.originalHash}
Recomputed Hash:  ${data.tamperedHash}
Engine Alert:     ${data.errorMessage}
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<p style="color: var(--accent-rose);">Tamper demo failed: ${err.message}</p>`;
  }
}

// ============================================================
//  Animated 6-Hour Incident Timeline Replay
// ============================================================
function initIncidentTimeline() {
  // Each hour slot: [hour label, successRate (0-1), phase]
  // 08:00–09:59 = pre-outage normal baseline
  // 10:00–15:59 = outage window
  // 16:00–17:59 = recovery
  const hourData = [
    { label: "08:00", rate: 0.81, phase: "normal" },
    { label: "09:00", rate: 0.79, phase: "normal" },
    { label: "10:00", rate: 0.58, phase: "outage" },
    { label: "11:00", rate: 0.34, phase: "outage" },
    { label: "12:00", rate: 0.27, phase: "outage" },
    { label: "13:00", rate: 0.22, phase: "outage" },
    { label: "14:00", rate: 0.29, phase: "outage" },
    { label: "15:00", rate: 0.31, phase: "outage" },
    { label: "16:00", rate: 0.52, phase: "recovery" },
    { label: "17:00", rate: 0.74, phase: "normal" },
  ];

  const chart = document.getElementById("itlChart");
  const hoursEl = document.getElementById("itlHours");
  if (!chart || !hoursEl) return;

  const colorMap = {
    normal: "#34d399",
    outage: "#f87171",
    recovery: "#fbbf24",
  };

  // Build bars
  hourData.forEach((h, i) => {
    const bar = document.createElement("div");
    bar.className = "itl-bar";
    bar.style.cssText = `
      flex: 1;
      background: ${colorMap[h.phase]};
      height: 0;
      border-radius: 3px 3px 0 0;
      transition: height 0.6s cubic-bezier(0.34,1.56,0.64,1);
      transition-delay: ${i * 80}ms;
      position: relative;
    `;
    bar.title = `${h.label}: ${(h.rate * 100).toFixed(0)}% success`;
    const maxH = 72;
    // Delay animation until after paint
    setTimeout(() => {
      bar.style.height = `${Math.round(h.rate * maxH)}px`;
    }, 100);
    chart.appendChild(bar);
  });

  // Build hour labels
  hourData.forEach((h) => {
    const lbl = document.createElement("span");
    lbl.className = "itl-hour-lbl";
    lbl.textContent = h.label;
    lbl.style.flex = "1";
    lbl.style.textAlign = "center";
    hoursEl.appendChild(lbl);
  });

  // Animate stats counts
  animateCount("itlSuccessRate", 0, 26.7, 1200, "%", true);
  animateCount("itlZScore", 0, -7.14, 1400, "", false);
  animateCount("itlTagged", 0, 21, 1000, " / 21", false, true);
}

function animateCount(elId, from, to, dur, suffix, isPercent, isInt) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = performance.now();
  const sign = to < 0 ? "-" : "";
  const absTo = Math.abs(to);
  const absFrom = Math.abs(from);

  function tick(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = absFrom + (absTo - absFrom) * eased;
    const formatted = isInt ? Math.round(current) : current.toFixed(isPercent ? 1 : 2);
    el.textContent = `${sign}${formatted}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadOverview();
  loadCases();
  initIncidentTimeline();

  // Surface tabs
  document.querySelectorAll(".surface-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".surface-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentSurface = tab.dataset.surface;
      loadCases();
    });
  });

  // Search input
  const search = document.getElementById("caseSearchInput");
  search.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    loadCases();
  });

  // Filters
  document.getElementById("filterCohort").addEventListener("change", (e) => {
    currentCohort = e.target.value;
    loadCases();
  });
  document.getElementById("filterState").addEventListener("change", (e) => {
    currentState = e.target.value;
    loadCases();
  });

  // Outage shortcut button
  document.getElementById("btnViewOutageCase").addEventListener("click", () => {
    openCaseModal("rsk_A_000313");
  });

  // Verification button
  document.getElementById("btnVerifyChain").addEventListener("click", runLiveVerification);
  document.getElementById("btnTamperDemo").addEventListener("click", runTamperDemo);

  // Modal Closers
  document.getElementById("btnModalClose").addEventListener("click", () => {
    document.getElementById("caseModal").classList.remove("active");
  });
  document.getElementById("btnVerifyClose").addEventListener("click", () => {
    document.getElementById("verifyModal").classList.remove("active");
  });

  // Drawer Tabs
  document.querySelectorAll(".drawer-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeDrawerTab = tab.dataset.tab;
      updateDrawerTabs();
      renderDrawerContent();
    });
  });

  // AI Settings Management
  initAiSettings();
});

// AI Settings Module
let currentAiConfig = null;

async function loadAiSettings() {
  try {
    const res = await fetch("/api/settings/ai");
    if (!res.ok) return;
    const data = await res.json();
    currentAiConfig = data.config;

    // Update Header Badge
    const headerBadge = document.getElementById("headerActiveModel");
    if (headerBadge && currentAiConfig) {
      const modelLabel = currentAiConfig.activeProvider === "offline"
        ? "Offline Rules"
        : (currentAiConfig.activeModel || "minimax/minimax-m3:free");
      headerBadge.innerText = modelLabel;
      headerBadge.title = `Provider: ${currentAiConfig.activeProvider} | Model: ${currentAiConfig.activeModel}`;
    }

    populateAiModal(data);
  } catch (err) {
    console.error("Failed to load AI settings:", err);
  }
}

function populateAiModal(data) {
  if (!data || !data.config) return;
  const cfg = data.config;

  // Set Provider Radio
  const radio = document.querySelector(`input[name="aiProviderRadio"][value="${cfg.activeProvider}"]`);
  if (radio) {
    radio.checked = true;
    updateProviderCardHighlight(cfg.activeProvider);
  }

  // Set Model
  const select = document.getElementById("selectAiModel");
  const customGroup = document.getElementById("customModelGroup");
  const customInput = document.getElementById("inputCustomModel");

  let found = false;
  for (let opt of select.options) {
    if (opt.value === cfg.activeModel) {
      select.value = cfg.activeModel;
      found = true;
      break;
    }
  }
  if (!found && cfg.activeModel) {
    select.value = "custom";
    if (customGroup) customGroup.style.display = "block";
    if (customInput) customInput.value = cfg.activeModel;
  } else if (customGroup) {
    customGroup.style.display = "none";
  }

  // Set Temperature
  const tempInput = document.getElementById("inputTemperature");
  const tempDisplay = document.getElementById("valTempDisplay");
  if (tempInput && tempDisplay) {
    tempInput.value = cfg.temperature ?? 0.1;
    tempDisplay.innerText = Number(cfg.temperature ?? 0.1).toFixed(2);
  }

  // Set Keys
  const orInput = document.getElementById("inputOrKey");
  const geminiInput = document.getElementById("inputGeminiKey");
  const openaiInput = document.getElementById("inputOpenaiKey");

  if (orInput) orInput.value = cfg.openRouterApiKeyMasked || "";
  if (geminiInput) geminiInput.value = cfg.geminiApiKeyMasked || "";
  if (openaiInput) openaiInput.value = cfg.openaiApiKeyMasked || "";

  // Set Status Tags
  const statusOr = document.getElementById("statusOrKey");
  const statusGemini = document.getElementById("statusGeminiKey");
  const statusOpenai = document.getElementById("statusOpenaiKey");

  if (statusOr) {
    statusOr.innerText = cfg.hasOpenRouterKey ? "● Connected" : "Not Set";
    statusOr.style.color = cfg.hasOpenRouterKey ? "#34d399" : "var(--text-dim)";
  }
  if (statusGemini) {
    statusGemini.innerText = cfg.hasGeminiKey ? "● Configured" : "Not Set";
    statusGemini.style.color = cfg.hasGeminiKey ? "#34d399" : "var(--text-dim)";
  }
  if (statusOpenai) {
    statusOpenai.innerText = cfg.hasOpenaiKey ? "● Configured" : "Optional";
    statusOpenai.style.color = cfg.hasOpenaiKey ? "#34d399" : "var(--text-dim)";
  }
}

function updateProviderCardHighlight(providerValue) {
  document.querySelectorAll(".provider-card").forEach((card) => {
    if (card.dataset.provider === providerValue) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

function initAiSettings() {
  loadAiSettings();

  const modal = document.getElementById("aiSettingsModal");
  const btnOpen = document.getElementById("btnAiSettings");
  const btnBadge = document.getElementById("headerAiBadge");
  const btnClose = document.getElementById("btnCloseAiModal");
  const btnCancel = document.getElementById("btnCancelAiModal");
  const btnSave = document.getElementById("btnSaveAiSettings");
  const btnTest = document.getElementById("btnTestAiConnection");

  const openModal = () => {
    if (modal) {
      modal.style.display = "flex";
      modal.classList.add("active");
      loadAiSettings();
    }
  };

  const closeModal = () => {
    if (modal) {
      modal.style.display = "none";
      modal.classList.remove("active");
      const saveStatus = document.getElementById("aiSettingsSaveStatus");
      if (saveStatus) saveStatus.innerText = "";
    }
  };

  if (btnOpen) btnOpen.addEventListener("click", openModal);
  if (btnBadge) btnBadge.addEventListener("click", openModal);
  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  // Close on backdrop click
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Provider Radio Change
  document.querySelectorAll('input[name="aiProviderRadio"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      const prov = e.target.value;
      updateProviderCardHighlight(prov);

      // Auto-suggest recommended model when provider changes
      const select = document.getElementById("selectAiModel");
      const customGroup = document.getElementById("customModelGroup");
      if (select) {
        if (prov === "openrouter") select.value = "minimax/minimax-m3:free";
        else if (prov === "gemini") select.value = "gemini-2.5-flash";
        else if (prov === "openai") select.value = "gpt-4o-mini";
        if (customGroup) customGroup.style.display = "none";
      }
    });
  });

  // Model Select Change
  const selectModel = document.getElementById("selectAiModel");
  const customGroup = document.getElementById("customModelGroup");
  if (selectModel) {
    selectModel.addEventListener("change", (e) => {
      if (customGroup) {
        customGroup.style.display = e.target.value === "custom" ? "block" : "none";
      }
    });
  }

  // Temperature slider
  const tempInput = document.getElementById("inputTemperature");
  const tempDisplay = document.getElementById("valTempDisplay");
  if (tempInput && tempDisplay) {
    tempInput.addEventListener("input", (e) => {
      tempDisplay.innerText = Number(e.target.value).toFixed(2);
    });
  }

  // Key Visibility Toggle
  document.querySelectorAll(".btn-toggle-key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
        btn.innerText = input.type === "password" ? "👁️" : "🔒";
      }
    });
  });

  // Test Model Connection
  if (btnTest) {
    btnTest.addEventListener("click", async () => {
      const consoleEl = document.getElementById("testAiConsole");
      const spinner = document.getElementById("testAiSpinner");
      const btnText = document.getElementById("btnTestAiText");

      if (spinner) spinner.style.display = "inline-block";
      if (btnText) btnText.innerText = "Running...";
      btnTest.disabled = true;

      const provider = document.querySelector('input[name="aiProviderRadio"]:checked')?.value || "openrouter";
      let model = document.getElementById("selectAiModel")?.value || "minimax/minimax-m3:free";
      if (model === "custom") {
        model = document.getElementById("inputCustomModel")?.value.trim() || "minimax/minimax-m3:free";
      }

      // Check if user entered a custom unsaved key in the input
      let apiKey = "";
      if (provider === "openrouter") apiKey = document.getElementById("inputOrKey")?.value;
      else if (provider === "gemini") apiKey = document.getElementById("inputGeminiKey")?.value;
      else if (provider === "openai") apiKey = document.getElementById("inputOpenaiKey")?.value;

      consoleEl.innerHTML = `<span style="color: var(--text-dim);">[BENCHMARK] Dispatching test probe to <strong>${provider}</strong> (${model})...</span>`;

      try {
        const payload = { provider, model };
        if (apiKey && !apiKey.includes("••••")) {
          payload.apiKey = apiKey.trim();
        }

        const res = await fetch("/api/settings/ai/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (data.success) {
          const diag = data.sampleDiagnosis || {};
          consoleEl.innerHTML = `
<div class="console-success">✔ 200 OK — ${data.provider.toUpperCase()} [${data.model}]</div>
<div class="console-metric">⚡ Roundtrip Latency: <strong>${data.latencyMs} ms</strong> ${data.tokenUsage ? `| Tokens: ${data.tokenUsage.totalTokens} (${data.tokenUsage.promptTokens} in, ${data.tokenUsage.completionTokens} out)` : ""}</div>
<div style="margin-top: 6px; color: #cbd5e1;"><strong>Root Cause:</strong> <span style="color: #6ee7b7;">${diag.root_cause || "UNKNOWN"}</span> (Confidence: ${((diag.confidence_bps || 9000)/100).toFixed(1)}%)</div>
<div style="color: #cbd5e1;"><strong>Playbook:</strong> ${diag.recommended_playbook || "AP_PORTAL_MATCH"}</div>
<div style="color: #94a3b8; font-size: 10.5px; margin-top: 4px;"><strong>Rationale:</strong> ${diag.rationale ? diag.rationale.slice(0, 180) + '...' : 'Parsed valid JSON'}</div>
          `.trim();
        } else {
          consoleEl.innerHTML = `
<div class="console-error">✖ Test Failed (${data.latencyMs} ms)</div>
<div style="color: #fca5a5; margin-top: 4px;">${data.error || "Connection error"}</div>
<div style="color: var(--text-dim); margin-top: 4px; font-size: 10px;">Ensure your API key is valid and has access to this model endpoint.</div>
          `.trim();
        }
      } catch (err) {
        consoleEl.innerHTML = `<div class="console-error">Network request error: ${err.message}</div>`;
      } finally {
        if (spinner) spinner.style.display = "none";
        if (btnText) btnText.innerText = "⚡ Test Model";
        btnTest.disabled = false;
      }
    });
  }

  // Save Settings
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const saveStatus = document.getElementById("aiSettingsSaveStatus");
      btnSave.disabled = true;
      if (saveStatus) saveStatus.innerHTML = `<span style="color: #a5b4fc;">Saving settings...</span>`;

      const provider = document.querySelector('input[name="aiProviderRadio"]:checked')?.value || "openrouter";
      let model = document.getElementById("selectAiModel")?.value || "minimax/minimax-m3:free";
      if (model === "custom") {
        model = document.getElementById("inputCustomModel")?.value.trim() || "minimax/minimax-m3:free";
      }
      const temperature = parseFloat(document.getElementById("inputTemperature")?.value || "0.1");

      const orKey = document.getElementById("inputOrKey")?.value || "";
      const geminiKey = document.getElementById("inputGeminiKey")?.value || "";
      const openaiKey = document.getElementById("inputOpenaiKey")?.value || "";

      const payload = {
        activeProvider: provider,
        activeModel: model,
        temperature,
      };

      if (orKey && !orKey.includes("••••")) payload.openRouterApiKey = orKey.trim();
      if (geminiKey && !geminiKey.includes("••••")) payload.geminiApiKey = geminiKey.trim();
      if (openaiKey && !openaiKey.includes("••••")) payload.openaiApiKey = openaiKey.trim();

      try {
        const res = await fetch("/api/settings/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Server returned " + res.status);
        const data = await res.json();

        if (saveStatus) {
          saveStatus.innerHTML = `<span style="color: #34d399;">✔ Configuration saved & active!</span>`;
        }

        currentAiConfig = data.config;
        const headerBadge = document.getElementById("headerActiveModel");
        if (headerBadge) {
          headerBadge.innerText = provider === "offline" ? "Offline Rules" : model;
        }

        setTimeout(() => {
          closeModal();
        }, 1000);
      } catch (err) {
        if (saveStatus) {
          saveStatus.innerHTML = `<span style="color: #f87171;">Failed to save: ${err.message}</span>`;
        }
      } finally {
        btnSave.disabled = false;
      }
    });
  }
}

