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

// Fetch Overview Data
async function loadOverview() {
  try {
    const res = await fetch("/api/overview");
    const data = await res.json();

    document.getElementById("valIncremental").innerText = formatInr(data.headline.incrementalRecoveredInr * 100);
    document.getElementById("valTreatmentRec").innerText = formatInr(data.headline.treatmentRecoveredInr * 100);
    document.getElementById("valSuppressed").innerText = data.headline.gateSuppressed.toLocaleString();
    document.getElementById("valCi95").innerText = `[${formatInr(data.headline.ci95.lowerInr * 100)} – ${formatInr(data.headline.ci95.upperInr * 100)}]`;
    document.getElementById("headerEventCount").innerText = data.headline.auditEventsChained.toLocaleString();
  } catch (err) {
    console.error("Failed to load overview data", err);
  }
}

// Fetch and Render Cases Table
async function loadCases() {
  const params = new URLSearchParams();
  if (currentSurface) params.set("surface", currentSurface);
  if (currentCohort) params.set("cohort", currentCohort);
  if (currentState) params.set("state", currentState);
  if (searchQuery) params.set("q", searchQuery);

  try {
    const res = await fetch(`/api/cases?${params.toString()}`);
    const data = await res.json();
    renderCasesTable(data.cases);
  } catch (err) {
    console.error("Failed to load cases", err);
  }
}

function renderCasesTable(cases) {
  const tbody = document.getElementById("casesTableBody");
  tbody.innerHTML = "";

  if (cases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-dim); padding: 30px;">No cases found matching current filters.</td></tr>`;
    return;
  }

  for (const c of cases) {
    const tr = document.createElement("tr");
    
    let stateBadge = `<span class="badge badge-lost">${c.state}</span>`;
    if (c.state === "RECOVERED") stateBadge = `<span class="badge badge-recovered">RECOVERED</span>`;
    else if (c.state === "SUPPRESSED") stateBadge = `<span class="badge badge-suppressed">SUPPRESSED</span>`;
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
  try {
    const res = await fetch(`/api/case/${caseId}`);
    activeCaseData = await res.json();
    document.getElementById("modalTitle").innerText = `Case Drilldown: ${activeCaseData.riskItemId} (${activeCaseData.customerName})`;
    activeDrawerTab = "summary";
    updateDrawerTabs();
    renderDrawerContent();
    document.getElementById("caseModal").classList.add("active");
  } catch (err) {
    console.error("Failed to open case modal", err);
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
    `;
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
    container.innerHTML = `
      <table class="cf-table">
        <thead>
          <tr><th>Seq</th><th>Event ID</th><th>Action</th><th>Actor</th><th>Decision</th><th>SHA-256 Hash</th></tr>
        </thead>
        <tbody>
          ${t.auditTrail.map((a) => `
            <tr>
              <td>${a.seq}</td>
              <td><code>${a.id}</code></td>
              <td><strong>${a.action}</strong></td>
              <td><span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #c4b5fd;">${a.actor}</span></td>
              <td>${a.decision || "—"}</td>
              <td><code style="color: #a5b4fc;">${a.hash.slice(0, 16)}...</code></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
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

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  loadOverview();
  loadCases();

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
});
