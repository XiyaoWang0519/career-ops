/**
 * Convert live ATS source state into a stable overall scan percentage.
 *
 * Each ATS is one stage because the next source's company total is not known
 * until that source starts. The active stage then advances using its real
 * scanned / total company count.
 *
 * @param {string[]} order
 * @param {Record<string, {state?: string, done?: number, total?: number, companies?: number} | undefined>} sources
 */
export function sourceScanProgress(order, sources) {
  const sourceCount = order.length;
  if (!sourceCount) {
    return { percent: 0, sourceCount: 0, sourceNumber: 0, activeSource: "", done: 0, total: 0 };
  }

  let completed = 0;
  let activeIndex = -1;
  let activeSource = "";
  let done = 0;
  let total = 0;

  order.forEach((source, index) => {
    const current = sources[source];
    if (current?.state === "swept" || current?.state === "noisy") {
      completed += 1;
      return;
    }
    if (current?.state === "active") {
      activeIndex = index;
      activeSource = source;
      done = Math.max(0, Number(current.done) || 0);
      total = Math.max(0, Number(current.total ?? current.companies) || 0);
    }
  });

  const activeFraction = total > 0 ? Math.min(1, done / total) : 0;
  const percent = Math.min(100, Math.max(0, Math.round(((completed + activeFraction) / sourceCount) * 100)));
  const sourceNumber = activeIndex >= 0 ? activeIndex + 1 : Math.min(completed + 1, sourceCount);

  return { percent, sourceCount, sourceNumber, activeSource, done: Math.min(done, total || done), total };
}

export const EMPTY_SCAN_FUNNEL = Object.freeze({
  postingsChecked: 0,
  filteredTitle: 0,
  filteredLocation: 0,
  filteredDate: 0,
  filteredContent: 0,
  filteredSeen: 0,
  filteredInvalid: 0,
  filteredBlacklist: 0,
  selected: 0,
});

const PROGRESS_PREFIX = "@@career-ops-progress ";
const OFFER_PREFIX = "@@career-ops-offer ";

function count(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

/** Keep the UI stable when an older/newer scanner omits individual counters. */
export function normalizeScanFunnel(raw = {}) {
  return {
    postingsChecked: count(raw.postingsChecked),
    filteredTitle: count(raw.filteredTitle),
    filteredLocation: count(raw.filteredLocation),
    filteredDate: count(raw.filteredDate),
    filteredContent: count(raw.filteredContent),
    filteredSeen: count(raw.filteredSeen),
    filteredInvalid: count(raw.filteredInvalid),
    filteredBlacklist: count(raw.filteredBlacklist),
    selected: count(raw.selected),
  };
}

export function filteredCount(funnel) {
  const f = normalizeScanFunnel(funnel);
  return (
    f.filteredTitle +
    f.filteredLocation +
    f.filteredDate +
    f.filteredContent +
    f.filteredSeen +
    f.filteredInvalid +
    f.filteredBlacklist
  );
}

/**
 * Parse the optional machine progress line emitted by scan-ats-full.mjs when
 * CAREER_OPS_WEB_PROGRESS=1. Human CLI output stays unchanged.
 */
export function parseScannerProgressLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith(PROGRESS_PREFIX)) return null;
  try {
    const raw = JSON.parse(trimmed.slice(PROGRESS_PREFIX.length));
    if (!raw || typeof raw.ats !== "string") return null;
    return {
      ats: raw.ats,
      scanned: count(raw.scanned),
      total: count(raw.total),
      matches: count(raw.matches),
      funnel: normalizeScanFunnel(raw.funnel),
    };
  } catch {
    return null;
  }
}

/** Parse a selected offer streamed before the scanner's terminal JSON result. */
export function parseScannerOfferLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed.startsWith(OFFER_PREFIX)) return null;
  try {
    const raw = JSON.parse(trimmed.slice(OFFER_PREFIX.length));
    if (!raw || typeof raw.company !== "string" || typeof raw.title !== "string" || typeof raw.url !== "string") return null;
    if (!raw.company.trim() || !raw.title.trim() || !/^https?:\/\//i.test(raw.url.trim())) return null;
    return {
      company: raw.company.trim(),
      title: raw.title.trim(),
      url: raw.url.trim(),
      location: typeof raw.location === "string" ? raw.location : "",
      postedAt: typeof raw.postedAt === "string" ? raw.postedAt : "",
      source: typeof raw.source === "string" ? raw.source : "",
      dateStatus: raw.dateStatus === "dated" ? "dated" : "unknown",
      ...(raw.blacklisted === true ? { blacklisted: true } : {}),
      ...(typeof raw.note === "string" && raw.note.trim() ? { note: raw.note.trim() } : {}),
    };
  } catch {
    return null;
  }
}
