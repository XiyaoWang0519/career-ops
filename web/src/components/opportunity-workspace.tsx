"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Search,
  Send,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { ApplyButton } from "@/components/apply-button";
import { OPPORTUNITY_STAGES, type OpportunityView } from "@/lib/opportunity";
import { cn } from "@/lib/cn";

function askAssistant(message: string) {
  window.dispatchEvent(new CustomEvent("co-assistant", { detail: { message } }));
}

function AssistantAction({
  icon: Icon,
  label,
  description,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  message: string;
}) {
  return (
    <button
      type="button"
      onClick={() => askAssistant(message)}
      className="group flex min-h-[76px] items-start gap-3 rounded-xl border border-border bg-surface/30 px-3.5 py-3 text-left transition-colors hover:border-brand/35 hover:bg-brand-soft/30"
    >
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-surface-hover text-muted transition-colors group-hover:bg-brand-soft group-hover:text-brand">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
    </button>
  );
}

export function OpportunityWorkspace({ opportunity }: { opportunity: OpportunityView }) {
  const context = `${opportunity.company} — ${opportunity.role} (application #${opportunity.id})`;
  const next = opportunity.nextAction;

  const nextControl = (() => {
    if (next.id === "generate-pdf") {
      return <GeneratePdfButton n={opportunity.id} company={opportunity.company} pdfReady={opportunity.pdfReady} />;
    }
    if (next.id === "start-application") {
      return <ApplyButton n={opportunity.id} url={opportunity.url ?? undefined} company={opportunity.company} pdfReady={opportunity.pdfReady} />;
    }
    if (next.href) {
      return (
        <Link href={next.href} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200">
          {next.label} <ArrowRight className="size-4" />
        </Link>
      );
    }
    if (next.id === "closed") {
      return (
        <Link href={`/jobs#opportunity-${encodeURIComponent(opportunity.id)}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand/40 hover:text-brand">
          View timeline <ArrowRight className="size-4" />
        </Link>
      );
    }
    if (next.id === "review") {
      return (
        <a href="#evaluation" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200">
          Review evaluation <ArrowRight className="size-4" />
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={() => askAssistant(`${next.label} for ${context}. Keep every claim grounded in my career-ops files.`)}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
      >
        {next.label} <ArrowRight className="size-4" />
      </button>
    );
  })();

  return (
    <section aria-labelledby="opportunity-workspace-title" className="mt-7 overflow-hidden rounded-2xl border border-border bg-surface/35">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Opportunity workflow</p>
            <h2 id="opportunity-workspace-title" className="mt-1 text-sm font-semibold text-foreground">
              {opportunity.stage} · {next.label}
            </h2>
          </div>
          <Link href={`/jobs#opportunity-${encodeURIComponent(opportunity.id)}`} className="inline-flex min-h-[44px] items-center gap-1.5 text-xs text-muted transition-colors hover:text-brand">
            <Activity className="size-3.5" /> Activity
          </Link>
        </div>

        <ol aria-label="Opportunity lifecycle" className="mt-4 flex min-w-max items-start overflow-x-auto pb-1 sm:min-w-0 sm:overflow-visible">
          {OPPORTUNITY_STAGES.map((stage, index) => {
            const complete = index < opportunity.stageIndex;
            const current = index === opportunity.stageIndex;
            return (
              <li key={stage} className="flex min-w-[76px] flex-1 items-start last:min-w-[62px]">
                <div className="flex w-full items-center">
                  <span
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-semibold tabular-nums",
                      complete && "border-brand bg-brand text-brand-foreground",
                      current && "border-brand bg-brand-soft text-brand",
                      !complete && !current && "border-border bg-surface text-faint",
                    )}
                  >
                    {complete ? <Check className="size-3" aria-hidden /> : index + 1}
                  </span>
                  {index < OPPORTUNITY_STAGES.length - 1 && <span className={cn("h-px flex-1", index < opportunity.stageIndex ? "bg-brand/60" : "bg-border")} />}
                </div>
                <span className={cn("mt-6 -ml-5 block w-16 -translate-x-1/2 text-center text-[10px] leading-tight", current ? "font-medium text-foreground" : "text-faint")}>{stage}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="space-y-5 px-5 py-5">
        <div className="rounded-xl border border-brand/25 bg-brand-soft/40 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground"><Sparkles className="size-4" /></span>
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand/80">Next best action</p>
              <h3 className="mt-1 font-display text-xl text-landing">{next.label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{next.description}</p>
              <div className="mt-4">{nextControl}</div>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Continue this opportunity</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <AssistantAction icon={Search} label="Company research" description="Strategy, culture, risks" message={`Research ${context} using the career-ops deep-research workflow.`} />
            <AssistantAction icon={UserRoundSearch} label="Find contacts" description="Recruiter, manager, peers" message={`Find the best contact for ${context} and draft a role-appropriate outreach message.`} />
            <AssistantAction icon={FileText} label="Cover letter" description="Grounded in your evidence" message={`Draft a concise cover letter for ${context}. Use only my approved career-ops sources.`} />
            <AssistantAction icon={Mail} label="Application email" description="Subject, body, checklist" message={`Draft the formal application email for ${context}; do not send it.`} />
            <AssistantAction icon={BookOpenCheck} label="Interview prep" description="Plan, stories, practice" message={`Prepare me for interviews for ${context}, starting with the highest-leverage gaps.`} />
            {opportunity.stageIndex < 4 ? (
              <AssistantAction icon={MessageCircle} label="Review evaluation" description="Challenge the score and gaps" message={`Walk me through the evaluation for ${context}. Challenge the score and identify the decision-driving gaps.`} />
            ) : (
              <AssistantAction icon={MessageCircle} label="Review replies" description="Classify and choose next step" message={`Help me review any reply for ${context} and recommend the correct tracker update.`} />
            )}
            {opportunity.stageIndex < 4 ? (
              <AssistantAction icon={Send} label="Application plan" description="Sequence materials and outreach" message={`Create a concise application plan for ${context}, including materials, contact strategy, and what I should verify before submitting.`} />
            ) : (
              <AssistantAction icon={CheckCircle2} label="Record outcome" description="Archive artifacts and capture learning" message={`Help me record the outcome for ${context}. Show me the proposed update before changing anything.`} />
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><Send className="size-3.5 text-brand" /> Application, follow-up, interview, and outcome stay attached to this opportunity.</span>
        {next.id !== "generate-pdf" && <GeneratePdfButton n={opportunity.id} company={opportunity.company} pdfReady={opportunity.pdfReady} />}
        {opportunity.url && <a href={opportunity.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex min-h-[44px] items-center gap-1 text-brand hover:underline">Original posting <ExternalLink className="size-3" /></a>}
      </div>
    </section>
  );
}
