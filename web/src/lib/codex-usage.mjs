/**
 * Parse ChatGPT Codex plan rate limits from `/backend-api/wham/usage`.
 * Same undocumented endpoint Codex CLI / aistat use for 5h + weekly % left.
 *
 * Shared by /api/usage and unit tests. Keep dependency-free (.mjs).
 */

/** @typedef {{ label: string, usedPercent: number, resetsAt: number | null, resetAfterSeconds: number | null }} CodexUsageWindow */
/** @typedef {{ source: "codex", planType: string | null, windows: CodexUsageWindow[], computedAt: number }} CodexUsage */

/**
 * Map limit_window_seconds to a short UI label (±5% tolerance).
 * @param {number} limitWindowSeconds
 * @returns {string}
 */
export function windowLabel(limitWindowSeconds) {
  const n = Number(limitWindowSeconds) || 0;
  const buckets = [
    { center: 18_000, label: "5h" },
    { center: 604_800, label: "7d" },
    { center: 2_592_000, label: "30d" },
  ];
  for (const b of buckets) {
    const lo = b.center - b.center / 20;
    const hi = b.center + b.center / 20;
    if (n >= lo && n <= hi) return b.label;
  }
  if (n > 0) {
    const hours = Math.round(n / 3600);
    return hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;
  }
  return "limit";
}

/**
 * @param {{ used_percent?: number, limit_window_seconds?: number, reset_after_seconds?: number, reset_at?: number } | null | undefined} w
 * @param {number} [nowMs]
 * @returns {CodexUsageWindow | null}
 */
export function windowFromApi(w, nowMs = Date.now()) {
  if (!w || typeof w !== "object") return null;
  const resetsAt = typeof w.reset_at === "number" && w.reset_at > 0 ? w.reset_at : null;
  // Inactive / never-used windows often arrive with reset_at=0 — omit them.
  if (resetsAt == null) return null;
  const used = Number(w.used_percent);
  const usedPercent = Number.isFinite(used) ? Math.max(0, Math.min(100, used)) : 0;
  let resetAfterSeconds =
    typeof w.reset_after_seconds === "number" && Number.isFinite(w.reset_after_seconds)
      ? Math.max(0, Math.floor(w.reset_after_seconds))
      : null;
  if (resetAfterSeconds == null && resetsAt != null) {
    resetAfterSeconds = Math.max(0, Math.floor(resetsAt - nowMs / 1000));
  }
  return {
    label: windowLabel(w.limit_window_seconds ?? 0),
    usedPercent,
    resetsAt,
    resetAfterSeconds,
  };
}

/**
 * Normalize a `/wham/usage` JSON body into meter rows.
 * Prefers duration-based labels over primary/secondary slot names (free plans
 * put the weekly cap in primary).
 *
 * @param {Record<string, unknown>} raw
 * @param {{ nowMs?: number }} [opts]
 * @returns {CodexUsage}
 */
export function parseCodexUsageResponse(raw, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const rate = raw && typeof raw === "object" ? /** @type {Record<string, any>} */ (raw).rate_limit : null;
  /** @type {CodexUsageWindow[]} */
  const windows = [];
  if (rate && typeof rate === "object") {
    for (const key of ["primary_window", "secondary_window"]) {
      const row = windowFromApi(rate[key], nowMs);
      if (row) windows.push(row);
    }
  }
  const review = windowFromApi(/** @type {any} */ (raw)?.code_review_rate_limit, nowMs);
  if (review) {
    windows.push({ ...review, label: `review ${review.label}` });
  }
  const planType =
    typeof raw?.plan_type === "string" && raw.plan_type.trim() ? raw.plan_type.trim() : null;
  return { source: "codex", planType, windows, computedAt: nowMs };
}
