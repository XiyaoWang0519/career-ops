"use client";

import { Send, Lock } from "lucide-react";
import { useJobs } from "@/components/jobs/job-store";

// The "Apply" CTA — brand orange, paper-plane. Enabled ONLY when the tailored CV
// for THIS offer is ready (the tracker's PDF column is ✅, or a pdf worker for
// this #n just finished). On click it opens the live browser in assistant chat
// (where the user reviews and submits it themselves — never auto-submit).
//
export function ApplyButton({ n, url, company, pdfReady }: { n: string; url?: string; company: string; pdfReady: boolean }) {
  const { jobs } = useJobs();

  const pdfJobDone = jobs.some((j) => j.kind === "pdf" && j.input === n && j.status === "done");
  const hasUrl = !!url && /^https?:\/\//i.test(url);
  const ready = (pdfReady || pdfJobDone) && hasUrl;

  if (!ready) {
    return (
      <button
        type="button"
        disabled
        title={!hasUrl ? "No application URL on this report" : "Generate the tailored CV (PDF) first to apply"}
        className="inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-full border border-border bg-surface/40 px-3.5 py-1 text-xs font-medium text-faint max-sm:min-h-[44px]"
      >
        <Lock className="size-3.5" /> Apply
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("co-assistant-apply", { detail: { url, company } }));
      }}
      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-3.5 py-1 text-xs font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-200 max-sm:min-h-[44px]"
      title="Apply in chat — the agent fills, you take over and submit"
    >
      <Send className="size-3.5" /> Apply
    </button>
  );
}
