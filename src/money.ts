/**
 * Integer-paise money helpers. Currency INR.
 * A paise value MUST be a finite integer. Never store rupees as a decimal.
 */

export function assertPaise(paise: number, label = "paise"): number {
  if (!Number.isInteger(paise) || !Number.isFinite(paise)) {
    throw new Error(`${label} must be a finite integer (paise), got ${paise}`);
  }
  return paise;
}

/** Convert whole rupees (integer) to paise. Rejects fractional rupees. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isInteger(rupees) || !Number.isFinite(rupees)) {
    throw new Error(`rupees must be a whole integer, got ${rupees}`);
  }
  return rupees * 100;
}

/** Display-only. Does not return a numeric rupee value. */
export function formatInr(paise: number): string {
  assertPaise(paise);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.trunc(abs / 100);
  const remainder = abs % 100;
  const paiseStr = remainder.toString().padStart(2, "0");
  const s = rupees.toString();
  let grouped: string;
  if (s.length <= 3) {
    grouped = s;
  } else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return `${sign}₹${grouped}.${paiseStr}`;
}

export function sumPaise(values: number[]): number {
  let total = 0;
  for (const v of values) {
    total += assertPaise(v);
  }
  if (!Number.isInteger(total)) {
    throw new Error(`paise sum left the integer domain: ${total}`);
  }
  return total;
}
