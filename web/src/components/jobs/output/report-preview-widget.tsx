"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { ReportMarkdown } from "@/components/report-markdown";
import { ScorecardWidget } from "./scorecard-widget";
import { parseReport } from "@/lib/format";

type ReportPayload = {
  content: string;
  file: string;
  meta: { title: string | null; legitimacy: string | null; fields: { label: string; value: string }[] };
};

export function ReportPreviewWidget({
  reportNum,
  company,
  role,
  score,
  summary,
}: {
  reportNum: string;
  company?: string;
  role?: string;
  score?: number | null;
  summary?: string;
}) {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/report/${encodeURIComponent(reportNum)}`);
        if (!res.ok) {
          if (!cancelled) setError(res.status === 404 ? "Report not found on disk yet." : "Could not load report.");
          return;
        }
        const json = (await res.json()) as ReportPayload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Could not load report.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reportNum]);

  const legitimacy = data?.meta.legitimacy ?? null;
  const metaScoreRaw = data?.meta.fields.find((f) => f.label === "Score")?.value;
  const metaScore = metaScoreRaw?.match(/([\d.]+)/)?.[1];
  const resolvedScore = score ?? (metaScore != null ? parseFloat(metaScore) : null);
  const body = data ? parseReport(data.content).body : "";
  // Keep the preview lean: first ~sections only (cap length).
  const previewBody = body.length > 6000 ? body.slice(0, 6000).trimEnd() + "\n\n…" : body;

  return (
    <div className="space-y-3">
      {(resolvedScore != null || summary || legitimacy) && (
        <ScorecardWidget score={resolvedScore} summary={summary || ""} legitimacy={legitimacy} />
      )}
      <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Evaluation report</p>
            <p className="mt-1 font-display text-lg tracking-tight text-landing">
              {company || data?.meta.title || `Report #${reportNum}`}
            </p>
            {role ? <p className="text-sm text-muted">{role}</p> : null}
          </div>
          <Link
            href={`/pipeline/${reportNum}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-text"
          >
            Open full opportunity <ArrowRight className="size-3.5" />
          </Link>
        </div>
        {error && <p className="mt-4 text-sm text-muted">{error}</p>}
        {!error && !data && (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
            <Loader2 className="size-3.5 animate-spin" /> Loading report…
          </p>
        )}
        {data && previewBody && (
          <div className="report-prose mt-4 max-h-[28rem] overflow-y-auto border-t border-border/70 pt-4">
            <ReportMarkdown>{previewBody}</ReportMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
