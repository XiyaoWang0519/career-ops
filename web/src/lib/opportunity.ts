import type { Application } from "@/lib/career-ops";
import { parseReport, scoreNum } from "@/lib/format";
import {
  OPPORTUNITY_STAGES as CORE_STAGES,
  nextActionForOpportunity as coreNextAction,
  stageIndexForStatus as coreStageIndex,
} from "@/lib/opportunity-core.mjs";

export const OPPORTUNITY_STAGES = CORE_STAGES as unknown as readonly ["Discover", "Review", "Evaluate", "Prepare", "Apply", "Follow up", "Interview", "Offer", "Outcome"];

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type OpportunityActionId =
  | "review"
  | "generate-pdf"
  | "start-application"
  | "follow-up"
  | "prepare-conversation"
  | "interview-prep"
  | "offer-prep"
  | "celebrate"
  | "closed";

export type OpportunityAction = {
  id: OpportunityActionId;
  label: string;
  description: string;
  href?: string;
};

export type OpportunityView = {
  id: string;
  company: string;
  role: string;
  status: string;
  score: number | null;
  url: string | null;
  pdfReady: boolean;
  stageIndex: number;
  stage: OpportunityStage;
  terminal: boolean;
  nextAction: OpportunityAction;
};

function reportField(report: string | null | undefined, label: string): string | null {
  if (!report) return null;
  return parseReport(report).fields.find((field) => field.label === label)?.value ?? null;
}

export function stageIndexForStatus(status: string): number {
  return coreStageIndex(status);
}

export function nextActionForOpportunity({
  id,
  status,
  score,
  url,
  pdfReady,
}: Pick<OpportunityView, "id" | "status" | "score" | "url" | "pdfReady">): OpportunityAction {
  return coreNextAction({ id, status, score, url, pdfReady }) as OpportunityAction;
}

export function buildOpportunity(app: Application, report?: string | null): OpportunityView {
  const parsedScore = scoreNum(app.score || reportField(report, "Score") || "");
  const score = Number.isFinite(parsedScore) ? parsedScore : null;
  const rawUrl = reportField(report, "URL");
  const url = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : null;
  const stageIndex = stageIndexForStatus(app.status);
  const view: OpportunityView = {
    id: app.n,
    company: app.company,
    role: app.role,
    status: app.status,
    score,
    url,
    pdfReady: app.pdf.includes("✅"),
    stageIndex,
    stage: OPPORTUNITY_STAGES[stageIndex],
    terminal: stageIndex === OPPORTUNITY_STAGES.length - 1,
    nextAction: { id: "review", label: "Review", description: "Review this opportunity." },
  };
  view.nextAction = nextActionForOpportunity(view);
  return view;
}

type JobLike = { kind?: string; input?: string; page?: string; title?: string; subtitle?: string };

function normalized(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Resolve a worker back to the stable tracker opportunity it belongs to. */
export function relatedApplicationForJob(job: JobLike, applications: Application[]): Application | null {
  const pageId = job.page?.match(/^\/pipeline\/([^/?#]+)/)?.[1];
  if (pageId) return applications.find((app) => app.n === pageId) ?? null;
  if (job.kind === "pdf" && job.input) return applications.find((app) => app.n === job.input) ?? null;

  const title = normalized(job.title);
  const subtitle = normalized(job.subtitle);
  return (
    applications.find((app) => {
      const company = normalized(app.company);
      const role = normalized(app.role);
      return company && title.includes(company) && (!subtitle || !role || subtitle === role || subtitle.includes(role) || role.includes(subtitle));
    }) ?? null
  );
}
