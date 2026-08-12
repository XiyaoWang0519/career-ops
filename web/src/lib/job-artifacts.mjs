/**
 * Build structured JobArtifact payloads for the Activity OUTPUT showcase.
 * Plain .mjs so node --test can cover builders without a TS build step.
 */

/**
 * Core web-run artifacts (evaluate / pdf / fix-portal / research).
 * Broader future shapes live in job-artifacts.ts — serialize/parse treat them as opaque JSON.
 * @typedef {{ type: "report"; reportNum: string; reportFile: string; score: number | null; company?: string; role?: string }} ReportArtifact
 * @typedef {{ type: "cv-pdf"; reportNum: string; company: string; href: string }} CvPdfArtifact
 * @typedef {{ type: "portal-fix"; company: string; status: "live" | "unverified" }} PortalFixArtifact
 * @typedef {{ type: "research"; summary: string; score: number | null }} ResearchArtifact
 * @typedef {ReportArtifact | CvPdfArtifact | PortalFixArtifact | ResearchArtifact | Record<string, unknown>} JobArtifact
 */

/**
 * Parse `007-viggle-ai-2026-08-12.md` → { reportNum, companySlug }.
 * @param {string | null | undefined} reportFile
 */
export function parseReportFilename(reportFile) {
  if (!reportFile) return { reportNum: null, companySlug: null };
  const m = String(reportFile).match(/^(\d+)-(.+)-\d{4}-\d{2}-\d{2}\.md$/);
  if (!m) {
    const numOnly = String(reportFile).match(/^(\d+)/);
    return { reportNum: numOnly ? numOnly[1] : null, companySlug: null };
  }
  return { reportNum: m[1], companySlug: m[2] };
}

/** "viggle-ai" → "Viggle Ai" for display / cv-pdf company matching. */
export function companyLabelFromSlug(slug) {
  if (!slug) return "";
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * @param {{ reportFile: string | null; score: number | null; trackerRecorded?: boolean }} persisted
 * @param {{ company?: string; role?: string }} [extras]
 * @returns {ReportArtifact[]}
 */
export function artifactsForEvaluation(persisted, extras = {}) {
  if (!persisted?.reportFile) return [];
  const { reportNum, companySlug } = parseReportFilename(persisted.reportFile);
  if (!reportNum) return [];
  /** @type {ReportArtifact} */
  const art = {
    type: "report",
    reportNum,
    reportFile: persisted.reportFile,
    score: persisted.score ?? null,
  };
  const company = extras.company || (companySlug ? companyLabelFromSlug(companySlug) : undefined);
  const role = extras.role;
  if (company) art.company = company;
  if (role) art.role = role;
  return [art];
}

/**
 * @param {{ reportNum: string; company: string }} args
 * @returns {CvPdfArtifact[]}
 */
export function artifactsForCvPdf({ reportNum, company }) {
  if (!reportNum || !company) return [];
  return [
    {
      type: "cv-pdf",
      reportNum: String(reportNum),
      company,
      href: `/api/cv-pdf?company=${encodeURIComponent(company)}`,
    },
  ];
}

/**
 * Derive company label from a final PDF path like
 * `…/output/cv-jane-doe-viggle-ai-2026-08-12.pdf` when report filename is known.
 * @param {string} finalPdf
 * @param {string} companySlug
 */
export function companyFromPdfPath(finalPdf, companySlug) {
  if (companySlug) return companyLabelFromSlug(companySlug);
  const base = String(finalPdf).split(/[/\\]/).pop() || "";
  const m = base.match(/^cv-(.+)-(\d{4}-\d{2}-\d{2})\.pdf$/i);
  if (!m) return "company";
  // Drop candidate slug prefix heuristically — prefer companySlug path above.
  return companyLabelFromSlug(m[1]);
}

/**
 * @param {string} company
 * @param {boolean} live
 * @returns {PortalFixArtifact[]}
 */
export function artifactsForPortalFix(company, live) {
  const c = String(company || "").trim();
  if (!c) return [];
  return [{ type: "portal-fix", company: c, status: live ? "live" : "unverified" }];
}

/**
 * @param {{ score: number | null; summary: string }} verdict
 * @returns {ResearchArtifact[]}
 */
export function artifactsForResearch(verdict) {
  return [
    {
      type: "research",
      summary: (verdict?.summary || "").trim().slice(0, 200),
      score: verdict?.score ?? null,
    },
  ];
}

/**
 * Parse a VERDICT line from worker stream text.
 * @param {string} text
 * @returns {{ score: number | null; summary: string }}
 */
export function parseVerdictLine(text) {
  const m = String(text || "").match(/VERDICT:\s*([\d.]+)\s*\/\s*5\s*[—:|-]+\s*(.+)/i);
  if (m) {
    const score = parseFloat(m[1]);
    return {
      score: Number.isFinite(score) ? score : null,
      summary: m[2].trim().replace(/\s+/g, " ").slice(0, 90),
    };
  }
  return { score: null, summary: "" };
}

/**
 * Infer whether a fix-portal VERDICT implies the portal is live.
 * @param {string} text
 */
export function portalLiveFromText(text) {
  const v = parseVerdictLine(text);
  if (v.score != null && v.score >= 4.5) return true;
  if (/\blive\b/i.test(v.summary)) return true;
  return false;
}

/**
 * Build artifacts for non-evaluate kinds at stream close when we only have
 * kind + input + accumulated text (and optional pdf path info).
 *
 * @param {{
 *   kind: string;
 *   input: string;
 *   text?: string;
 *   pdfCompany?: string;
 *   pdfReportNum?: string;
 * }} args
 * @returns {JobArtifact[]}
 */
export function artifactsForKind({ kind, input, text = "", pdfCompany, pdfReportNum }) {
  if (kind === "pdf") {
    const reportNum = pdfReportNum || String(input);
    const company = pdfCompany || "company";
    return artifactsForCvPdf({ reportNum, company });
  }
  if (kind === "fix-portal") {
    return artifactsForPortalFix(input, portalLiveFromText(text));
  }
  if (kind === "research") {
    return artifactsForResearch(parseVerdictLine(text));
  }
  return [];
}

/**
 * Serialize artifacts for the runs markdown log (one JSON line).
 * @param {unknown} artifacts
 * @returns {string}
 */
export function serializeArtifactsForLog(artifacts) {
  if (!Array.isArray(artifacts) || !artifacts.length) return "";
  try {
    return JSON.stringify(artifacts);
  } catch {
    return "";
  }
}

/**
 * @param {string} md
 * @returns {unknown[] | undefined}
 */
export function parseArtifactsFromLog(md) {
  const line = (md.match(/^- artifacts:\s*(.+)$/m) || [])[1]?.trim();
  if (!line || line === "-" || line === "[]") return undefined;
  try {
    const parsed = JSON.parse(line);
    if (!Array.isArray(parsed)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
