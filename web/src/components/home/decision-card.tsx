"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
import { CompanyLogo } from "@/components/company-logo";
import { ApprovalCard } from "@/components/agent-ui/approval-card";
import { SemanticTag, toneForScore } from "@/components/agent-ui/semantic-tag";
import { scoreNum } from "@/lib/format";
import type { Application } from "@/lib/career-ops";

/** Awaiting-decision → Approval Card (Beautiful UI #04). */
export function DecisionCard({ app }: { app: Application }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const score = scoreNum(app.score);

  const setStatus = async (status: "Applied" | "Discarded") => {
    setBusy(true);
    try {
      await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n: app.n, status }),
      });
      setDone(true);
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  if (done) return null;

  return (
    <ApprovalCard
      question={`What next for ${app.company}?`}
      options={[
        {
          id: "Applied",
          label: "Mark applied",
          hint: "You've sent the application — track follow-ups from here.",
        },
        {
          id: "need-intel",
          label: "Need more intel",
          hint: "Open the full A–F report before deciding.",
        },
        {
          id: "Discarded",
          label: "Skip",
          hint: "Not a fit — discard from the active queue.",
        },
      ]}
      value={choice}
      onChange={setChoice}
      busy={busy}
      confirmLabel={busy ? "Saving…" : choice === "need-intel" ? "Open report" : "Confirm"}
      onConfirm={() => {
        if (choice === "need-intel") {
          window.location.href = `/pipeline/${app.n}`;
          return;
        }
        if (choice === "Applied" || choice === "Discarded") void setStatus(choice);
      }}
      onSkip={() => void setStatus("Discarded")}
      skipLabel="Skip"
    >
      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border bg-background/40 px-3 py-2">
        <CompanyLogo name={app.company} size={24} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{app.company}</p>
          <p className="truncate text-[13px] text-muted">{app.role}</p>
        </div>
        {Number.isFinite(score) && score > 0 && (
          <SemanticTag tone={toneForScore(score)}>{app.score}</SemanticTag>
        )}
        <a
          href={`/pipeline/${app.n}`}
          title="Open report"
          aria-label="Open report"
          className="inline-flex shrink-0 items-center justify-center rounded p-1.5 text-faint transition hover:text-brand max-sm:min-h-[44px] max-sm:min-w-[44px]"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
        </a>
      </div>
    </ApprovalCard>
  );
}
