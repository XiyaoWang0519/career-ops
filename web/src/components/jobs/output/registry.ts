import type { Application } from "@/lib/career-ops";
import type { JobArtifact } from "@/lib/job-artifacts";

/** Minimal job shape for the OUTPUT registry (avoids importing the client store). */
export type JobLike = {
  kind?: string;
  status: "running" | "done" | "error";
  input?: string;
  text: string;
  result?: { score: number | null; summary: string };
  artifacts?: JobArtifact[];
};

/** Known web `/api/run` kinds — fully wired widgets. */
export type WebJobKind = "evaluate" | "pdf" | "fix-portal" | "research";

/** Future Activity kinds — typed so new workers plug into the same showcase. */
export type FutureJobKind =
  | "cover"
  | "latex"
  | "interview-prep"
  | "scan"
  | "email"
  | "contacto"
  | "outcome"
  | "upskill"
  | "deep"
  | "triage";

export type JobKind = WebJobKind | FutureJobKind | (string & {});

export type WidgetSpec =
  | { widget: "scorecard"; score: number | null; summary: string; legitimacy?: string | null; href?: string; reportNum?: string }
  | { widget: "report-preview"; reportNum: string; company?: string; role?: string }
  | { widget: "cv-pdf"; reportNum: string; company: string; href: string }
  | { widget: "portal-fix"; company: string; status: "live" | "unverified" }
  | { widget: "research-notes"; summary: string; score: number | null; text: string }
  | { widget: "document-draft"; title: string; markdown: string; pdfHref?: string }
  | { widget: "prep-doc"; title: string; path: string; markdown?: string }
  | { widget: "list-result"; label: string; count: number; samples?: string[] }
  | { widget: "tracker-delta"; reportNum: string; status: string; previousStatus?: string; archivePath?: string }
  | { widget: "message-draft"; subject?: string; body: string }
  | { widget: "analysis-report"; title: string; path?: string; summary?: string }
  | { widget: "worker-log"; text: string }
  | { widget: "building"; kindLabel: string };

function kindLabel(kind: string | undefined): string {
  switch (kind) {
    case "evaluate":
      return "evaluation report";
    case "pdf":
    case "latex":
      return "tailored CV";
    case "fix-portal":
      return "portal fix";
    case "research":
    case "deep":
      return "research notes";
    case "cover":
      return "cover letter";
    case "interview-prep":
      return "interview prep";
    case "scan":
      return "scan results";
    case "email":
    case "contacto":
      return "message draft";
    case "outcome":
      return "outcome archive";
    case "upskill":
      return "skill-gap analysis";
    case "triage":
      return "triage";
    default:
      return "result";
  }
}

function firstOfType<T extends JobArtifact["type"]>(
  artifacts: JobArtifact[] | undefined,
  type: T,
): Extract<JobArtifact, { type: T }> | undefined {
  return artifacts?.find((a): a is Extract<JobArtifact, { type: T }> => a.type === type);
}

function fallbackReport(job: JobLike, related: Application | null): WidgetSpec[] {
  const fromArt = firstOfType(job.artifacts, "report");
  if (fromArt) {
    return [
      {
        widget: "scorecard",
        score: fromArt.score ?? job.result?.score ?? null,
        summary: job.result?.summary || "",
        reportNum: fromArt.reportNum,
        href: `/pipeline/${fromArt.reportNum}`,
      },
    ];
  }
  if (related?.n) {
    const scoreRaw = related.score.match(/([\d.]+)/)?.[1];
    const score = scoreRaw != null ? parseFloat(scoreRaw) : job.result?.score ?? null;
    return [
      {
        widget: "scorecard",
        score: Number.isFinite(score as number) ? (score as number) : null,
        summary: job.result?.summary || related.notes || "",
        reportNum: related.n,
        href: `/pipeline/${related.n}`,
      },
    ];
  }
  if (job.result?.score != null) {
    return [{ widget: "scorecard", score: job.result.score, summary: job.result.summary || "" }];
  }
  return [];
}

function fallbackPdf(job: JobLike, related: Application | null): WidgetSpec[] {
  const fromArt = firstOfType(job.artifacts, "cv-pdf");
  if (fromArt) {
    return [
      {
        widget: "cv-pdf",
        reportNum: fromArt.reportNum,
        company: fromArt.company,
        href: fromArt.href,
      },
    ];
  }
  if (related?.company) {
    return [
      {
        widget: "cv-pdf",
        reportNum: related.n,
        company: related.company,
        href: `/api/cv-pdf?company=${encodeURIComponent(related.company)}`,
      },
    ];
  }
  return [];
}

function specsFromArtifact(a: JobArtifact, job: JobLike): WidgetSpec | null {
  switch (a.type) {
    case "report":
      return null; // handled in evaluate bundle
    case "cv-pdf":
      return { widget: "cv-pdf", reportNum: a.reportNum, company: a.company, href: a.href };
    case "portal-fix":
      return { widget: "portal-fix", company: a.company, status: a.status };
    case "research":
      return {
        widget: "research-notes",
        summary: a.summary || job.result?.summary || "",
        score: a.score ?? job.result?.score ?? null,
        text: job.text,
      };
    case "document-draft":
      return { widget: "document-draft", title: a.title, markdown: a.markdown, pdfHref: a.pdfHref };
    case "prep-doc":
      return { widget: "prep-doc", title: a.title, path: a.path, markdown: a.markdown };
    case "list-result":
      return { widget: "list-result", label: a.label, count: a.count, samples: a.samples };
    case "tracker-delta":
      return {
        widget: "tracker-delta",
        reportNum: a.reportNum,
        status: a.status,
        previousStatus: a.previousStatus,
        archivePath: a.archivePath,
      };
    case "message-draft":
      return { widget: "message-draft", subject: a.subject, body: a.body };
    case "analysis-report":
      return { widget: "analysis-report", title: a.title, path: a.path, summary: a.summary };
    default: {
      const _exhaustive: never = a;
      void _exhaustive;
      return null;
    }
  }
}

/**
 * Map a finished (or running) job to ordered Output widgets.
 * Primary artifacts first; Worker log is appended by the showcase when text exists.
 */
export function outputWidgetsFor(job: JobLike, related: Application | null = null): WidgetSpec[] {
  if (job.status === "running") {
    return [{ widget: "building", kindLabel: kindLabel(job.kind) }];
  }

  const kind = (job.kind || "evaluate") as JobKind;
  const specs: WidgetSpec[] = [];

  switch (kind) {
    case "evaluate": {
      specs.push(...fallbackReport(job, related));
      break;
    }
    case "pdf":
    case "latex": {
      specs.push(...fallbackPdf(job, related));
      break;
    }
    case "fix-portal": {
      const art = firstOfType(job.artifacts, "portal-fix");
      if (art) specs.push({ widget: "portal-fix", company: art.company, status: art.status });
      else if (job.input) {
        const live = job.result?.score != null && job.result.score >= 4.5;
        specs.push({
          widget: "portal-fix",
          company: job.input,
          status: live ? "live" : "unverified",
        });
      }
      break;
    }
    case "research":
    case "deep":
    case "triage": {
      const art = firstOfType(job.artifacts, "research");
      specs.push({
        widget: "research-notes",
        summary: art?.summary || job.result?.summary || "",
        score: art?.score ?? job.result?.score ?? null,
        text: job.text,
      });
      break;
    }
    case "cover": {
      const art = firstOfType(job.artifacts, "document-draft");
      if (art) specs.push(specsFromArtifact(art, job)!);
      break;
    }
    case "interview-prep": {
      const art = firstOfType(job.artifacts, "prep-doc");
      if (art) specs.push(specsFromArtifact(art, job)!);
      break;
    }
    case "scan": {
      const art = firstOfType(job.artifacts, "list-result");
      if (art) specs.push(specsFromArtifact(art, job)!);
      break;
    }
    case "email":
    case "contacto": {
      const art = firstOfType(job.artifacts, "message-draft");
      if (art) specs.push(specsFromArtifact(art, job)!);
      break;
    }
    case "outcome": {
      const art = firstOfType(job.artifacts, "tracker-delta");
      if (art) specs.push(specsFromArtifact(art, job)!);
      break;
    }
    case "upskill": {
      const art = firstOfType(job.artifacts, "analysis-report");
      if (art) specs.push(specsFromArtifact(art, job)!);
      break;
    }
    default: {
      // Unknown kind: surface any recognized artifacts, else scorecard if present.
      for (const a of job.artifacts ?? []) {
        const s = specsFromArtifact(a, job);
        if (s) specs.push(s);
      }
      if (!specs.length && job.result?.score != null) {
        specs.push({
          widget: "scorecard",
          score: job.result.score,
          summary: job.result.summary || "",
        });
      }
      break;
    }
  }

  return specs;
}

export function buildingKindLabel(kind: string | undefined): string {
  return kindLabel(kind);
}
