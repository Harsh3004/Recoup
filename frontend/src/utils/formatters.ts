export function formatInr(paiseOrRupees: number | null | undefined, isPaise = false): string {
  if (paiseOrRupees == null || typeof paiseOrRupees !== 'number' || isNaN(paiseOrRupees)) {
    return '₹0.00';
  }
  const inr = isPaise ? paiseOrRupees / 100 : paiseOrRupees;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(inr);
}

export function formatInrCompact(inr: number): string {
  if (inr >= 10000000) {
    return `₹${(inr / 10000000).toFixed(2)} Cr`;
  }
  if (inr >= 100000) {
    return `₹${(inr / 100000).toFixed(2)} L`;
  }
  return formatInr(inr);
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
