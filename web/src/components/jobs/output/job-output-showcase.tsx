"use client";

import { Loader2 } from "lucide-react";
import type { Application } from "@/lib/career-ops";
import type { Job } from "@/components/jobs/job-store";
import { outputWidgetsFor, type WidgetSpec } from "./registry";
import { ScorecardWidget } from "./scorecard-widget";
import { CvPdfWidget } from "./cv-pdf-widget";
import { PortalFixWidget } from "./portal-fix-widget";
import { ResearchNotesWidget } from "./research-notes-widget";
import {
  AnalysisReportWidget,
  DocumentDraftWidget,
  ListResultWidget,
  MessageDraftWidget,
  PrepDocWidget,
  TrackerDeltaWidget,
} from "./stub-widgets";

function renderSpec(spec: WidgetSpec) {
  switch (spec.widget) {
    case "building":
      return (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface/40 px-5 py-6 text-sm text-muted">
          <Loader2 className="size-4 animate-spin text-brand" />
          Building your {spec.kindLabel}…
        </div>
      );
    case "scorecard":
      return (
        <ScorecardWidget
          score={spec.score}
          summary={spec.summary}
          legitimacy={spec.legitimacy}
          href={spec.href}
          reportNum={spec.reportNum}
        />
      );
    case "report-preview":
      // Evaluations use the clickable scorecard only — full report lives on /pipeline/[n].
      return null;
    case "cv-pdf":
      return <CvPdfWidget company={spec.company} href={spec.href} reportNum={spec.reportNum} />;
    case "portal-fix":
      return <PortalFixWidget company={spec.company} status={spec.status} />;
    case "research-notes":
      return <ResearchNotesWidget summary={spec.summary} score={spec.score} text={spec.text} />;
    case "document-draft":
      return <DocumentDraftWidget title={spec.title} markdown={spec.markdown} pdfHref={spec.pdfHref} />;
    case "prep-doc":
      return <PrepDocWidget title={spec.title} path={spec.path} markdown={spec.markdown} />;
    case "list-result":
      return <ListResultWidget label={spec.label} count={spec.count} samples={spec.samples} />;
    case "tracker-delta":
      return (
        <TrackerDeltaWidget
          reportNum={spec.reportNum}
          status={spec.status}
          previousStatus={spec.previousStatus}
          archivePath={spec.archivePath}
        />
      );
    case "message-draft":
      return <MessageDraftWidget subject={spec.subject} body={spec.body} />;
    case "analysis-report":
      return <AnalysisReportWidget title={spec.title} path={spec.path} summary={spec.summary} />;
    case "worker-log":
      return null;
    default: {
      const _exhaustive: never = spec;
      void _exhaustive;
      return null;
    }
  }
}

export function JobOutputShowcase({
  job,
  related = null,
}: {
  job: Job;
  related?: Application | null;
}) {
  const specs = outputWidgetsFor(job, related);
  const rendered = specs
    .map((spec) => {
      const node = renderSpec(spec);
      return node ? (
        <div key={`${spec.widget}-${"reportNum" in spec && spec.reportNum ? spec.reportNum : spec.widget}`}>
          {node}
        </div>
      ) : null;
    })
    .filter(Boolean);

  const showEmpty = job.status !== "running" && !rendered.length;

  return (
    <div className="mt-8">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Output</h2>
      <div className="mt-3 space-y-3">
        {showEmpty ? (
          <p className="rounded-2xl border border-border bg-surface/40 px-5 py-4 text-sm text-muted">
            No showcase artifacts for this run.
          </p>
        ) : (
          rendered
        )}
      </div>
    </div>
  );
}
