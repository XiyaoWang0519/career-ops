"use client";

import { ChartNoAxesCombined, GraduationCap, Route } from "lucide-react";

const ACTIONS = [
  {
    label: "Diagnose my funnel",
    description: "Find rejection and conversion patterns, then suggest a targeting change.",
    icon: ChartNoAxesCombined,
    message: "Analyze my application patterns and funnel. Identify the strongest evidence-backed targeting improvement I should make next.",
  },
  {
    label: "Map skill gaps",
    description: "Compare recurring job requirements with skills already supported by my CV.",
    icon: GraduationCap,
    message: "Run a skill-gap analysis across my tracked opportunities. Separate existing skills, resume-supported skills, and genuine gaps.",
  },
  {
    label: "Broaden role titles",
    description: "Find adjacent titles that fit the same evidence without inventing experience.",
    icon: Route,
    message: "Suggest adjacent job titles grounded in my CV and current pipeline, ranked by fit and search usefulness.",
  },
] as const;

export function InsightsActions() {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Turn insight into action</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {ACTIONS.map(({ label, description, icon: Icon, message }) => (
          <button
            key={label}
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("co-assistant", { detail: { message } }))}
            className="group rounded-2xl border border-border bg-surface/40 p-4 text-left transition-colors hover:border-brand/40 hover:bg-brand-soft/20"
          >
            <Icon className="size-4 text-brand" />
            <span className="mt-3 block text-sm font-medium text-foreground">{label}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
