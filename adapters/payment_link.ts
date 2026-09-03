import { createHash } from "node:crypto";
import type { Database } from "bun:sqlite";

export interface CreatePaymentLinkOptions {
  riskItemId: string;
  amountPaise: number;
  customerName?: string;
  email?: string;
  phone?: string;
  description?: string;
  callbackUrl?: string;
  forceNew?: boolean;
  db?: Database;
}

export interface PaymentLinkResult {
  id: string;
  shortUrl: string;
  isLive: boolean;
  status: string;
  amountPaise: number;
  totalExposurePaise: number;
  remainingPaise: number;
  isStaggered: boolean;
}

// In-memory cache of generated live payment links for quick synchronous lookup
const activePaymentLinks = new Map<string, string>();

export function hasRazorpayCredentials(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET,
  );
}

/**
 * Deterministic Mock Payment Link Generator (Baseline Fallback)
 */
export function generateMockPaymentLink(riskItemId: string, amountPaise: number): string {
  const hash = createHash("sha256")
    .update(`${riskItemId}:${amountPaise}:secret_salt`)
    .digest("hex")
    .slice(0, 10);
  return `https://rzp.io/i/rec_${riskItemId.replace("rsk_", "")}_${hash}`;
}

/**
 * Synchronous Payment Link Resolver
 *
 * Checks if an authentic live Razorpay link was minted for this risk item.
 * If so, returns that real link. Otherwise, falls back to the deterministic mock URL.
 * Preserves synchronous signature for all existing downstream adapters.
 */
export function generatePaymentLink(riskItemId: string, amountPaise: number, db?: Database): string {
  if (activePaymentLinks.has(riskItemId)) {
    return activePaymentLinks.get(riskItemId)!;
  }

  if (db) {
    try {
      const row = db
        .query(`SELECT short_url FROM payment_links WHERE risk_item_id = ? AND status != 'paid' ORDER BY created_at DESC LIMIT 1`)
        .get(riskItemId) as { short_url: string } | null;
      if (row?.short_url) {
        activePaymentLinks.set(riskItemId, row.short_url);
        return row.short_url;
      }
    } catch {}
  }

  return generateMockPaymentLink(riskItemId, amountPaise);
}

/**
 * Creates an authentic Razorpay Test-Mode Payment Link via REST API.
 *
 * If RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are provided in the environment,
 * dispatches a live POST request to https://api.razorpay.com/v1/payment_links.
 * If credentials are missing or call fails, gracefully falls back to mock link.
 */
export async function createRazorpayPaymentLink(
  options: CreatePaymentLinkOptions,
): Promise<PaymentLinkResult> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  const totalExposure = Math.round(options.amountPaise);
  const MAX_RAZORPAY_TEST_PAISE = 5000000; // ₹50,000 max per link for Razorpay test mode accounts
  const linkAmountPaise = Math.min(MAX_RAZORPAY_TEST_PAISE, Math.max(100, totalExposure));
  const remainingPaise = Math.max(0, totalExposure - linkAmountPaise);
  const isStaggered = totalExposure > MAX_RAZORPAY_TEST_PAISE;

  // 1. Check if an active UNPAID live Razorpay link was already generated for this case in the database
  if (options.db && !options.forceNew) {
    try {
      const existing = options.db
        .query(
          `SELECT id, short_url, is_live, status, amount_paise FROM payment_links WHERE risk_item_id = ? AND is_live = 1 AND status != 'paid' ORDER BY created_at DESC LIMIT 1`
        )
        .get(options.riskItemId) as any;
      if (existing && existing.short_url && !existing.short_url.includes('/i/rec_')) {
        const storedAmt = existing.amount_paise ?? linkAmountPaise;
        return {
          id: existing.id,
          shortUrl: existing.short_url,
          isLive: true,
          status: existing.status || "created",
          amountPaise: storedAmt,
          totalExposurePaise: totalExposure,
          remainingPaise: Math.max(0, totalExposure - storedAmt),
          isStaggered: totalExposure > storedAmt,
        };
      }
    } catch {}
  }

  if (!keyId || !keySecret) {
    const mockUrl = generateMockPaymentLink(options.riskItemId, linkAmountPaise);
    return {
      id: `plink_mock_${options.riskItemId.replace("rsk_", "")}`,
      shortUrl: mockUrl,
      isLive: false,
      status: "created",
      amountPaise: linkAmountPaise,
      totalExposurePaise: totalExposure,
      remainingPaise,
      isStaggered,
    };
  }

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  try {
    const uniqueRef = `${options.riskItemId}_${Date.now()}`;
    const description = options.description ?? (
      isStaggered
        ? `Recoup Tranche 1: ₹${(linkAmountPaise / 100).toLocaleString('en-IN')} of ₹${(totalExposure / 100).toLocaleString('en-IN')} (Remaining: ₹${(remainingPaise / 100).toLocaleString('en-IN')}) - ${options.riskItemId}`
        : `Recoup Payment Recovery: ${options.riskItemId}`
    );

    const payload: any = {
      amount: linkAmountPaise,
      currency: "INR",
      accept_partial: false,
      description,
      customer: {
        name: options.customerName || "Valued Customer",
        email: options.email || "accounts@example.com",
        contact: options.phone || "+919876543210",
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        risk_item_id: options.riskItemId,
        total_exposure_paise: String(totalExposure),
        tranche_amount_paise: String(linkAmountPaise),
        remaining_balance_paise: String(remainingPaise),
        is_staggered: isStaggered ? "true" : "false",
      },
      reference_id: uniqueRef,
    };

    if (options.callbackUrl) {
      payload.callback_url = options.callbackUrl;
      payload.callback_method = "get";
    }

    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[RAZORPAY_API_WARN] Payment Link creation returned ${res.status}: ${errText}`);
      const mockUrl = generateMockPaymentLink(options.riskItemId, linkAmountPaise);
      return {
        id: `plink_mock_${options.riskItemId.replace("rsk_", "")}`,
        shortUrl: mockUrl,
        isLive: false,
        status: "fallback_mock",
        amountPaise: linkAmountPaise,
        totalExposurePaise: totalExposure,
        remainingPaise,
        isStaggered,
      };
    }

    const data = (await res.json()) as {
      id: string;
      short_url: string;
      status: string;
    };

    activePaymentLinks.set(options.riskItemId, data.short_url);

    // Persist to database if provided
    if (options.db) {
      try {
        options.db.prepare(`
          INSERT INTO payment_links (id, risk_item_id, short_url, amount_paise, status, is_live, created_at)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `).run(data.id, options.riskItemId, data.short_url, linkAmountPaise, data.status, Date.now());

        options.db.prepare(`
          UPDATE risk_items SET payment_link_url = ? WHERE id = ?
        `).run(data.short_url, options.riskItemId);
      } catch (dbErr) {
        console.warn("[WARN] Could not persist payment_link to DB:", dbErr);
      }
    }

    return {
      id: data.id,
      shortUrl: data.short_url,
      isLive: true,
      status: data.status,
      amountPaise: linkAmountPaise,
      totalExposurePaise: totalExposure,
      remainingPaise,
      isStaggered,
    };
  } catch (err: any) {
    console.error("[RAZORPAY_API_ERROR] Failed to reach Razorpay:", err.message);
    const mockUrl = generateMockPaymentLink(options.riskItemId, linkAmountPaise);
    return {
      id: `plink_mock_${options.riskItemId.replace("rsk_", "")}`,
      shortUrl: mockUrl,
      isLive: false,
      status: "fallback_mock",
      amountPaise: linkAmountPaise,
      totalExposurePaise: totalExposure,
      remainingPaise,
      isStaggered,
    };
  }
}
