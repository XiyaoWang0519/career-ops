const BILLING_MODES = new Set(["plan", "metered", "unknown"]);

/** @typedef {{ tokens: number, usd?: number, billing?: "plan"|"metered"|"unknown" }} RunCost */

/** @param {unknown} value @returns {RunCost|undefined} */
export function normalizeRunCost(value) {
  if (!value || typeof value !== "object") return undefined;
  const tokens = Number(value.tokens);
  if (!Number.isFinite(tokens) || tokens <= 0) return undefined;

  const normalized = { tokens: Math.round(tokens) };
  const usd = Number(value.usd);
  if (Number.isFinite(usd) && usd >= 0) normalized.usd = usd;
  if (BILLING_MODES.has(value.billing)) normalized.billing = value.billing;
  return normalized;
}

/** @param {unknown} value */
export function formatRunCost(value) {
  const cost = normalizeRunCost(value);
  return [
    `- tokens: ${cost?.tokens ?? "-"}`,
    `- cost-usd: ${cost?.usd ?? "-"}`,
    `- billing: ${cost?.billing ?? "-"}`,
  ].join("\n");
}

/** @param {string} md @returns {RunCost|undefined} */
export function parseRunCost(md) {
  const tokens = (md.match(/^- tokens:\s*(.+)$/m) || [])[1]?.trim();
  const usd = (md.match(/^- cost-usd:\s*(.+)$/m) || [])[1]?.trim();
  const billing = (md.match(/^- billing:\s*(.+)$/m) || [])[1]?.trim();
  return normalizeRunCost({
    tokens,
    ...(usd && usd !== "-" ? { usd } : {}),
    ...(billing && billing !== "-" ? { billing } : {}),
  });
}
