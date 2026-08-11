"use client";

import { useState } from "react";
import { Check, ChevronDown, Code2, Search, Sparkles } from "lucide-react";
import { ThinkingStatus, type AssistantProgress } from "@/components/assistant/thinking-status";
import { ToolChips, type ToolChipItem } from "@/components/agent-ui/tool-chips";
import { cn } from "@/lib/cn";

export type ThinkingStep = {
  id: string;
  kind: "steps" | "reasoning" | "search" | "coding" | "tool";
  label: string;
  detail?: string;
  done?: boolean;
};

const KIND_ICON = {
  steps: Sparkles,
  reasoning: Sparkles,
  search: Search,
  coding: Code2,
  tool: Code2,
} as const;

/**
 * Expandable thinking traces (Beautiful UI #02) wrapping the existing orb-based
 * ThinkingStatus — orb stays; steps/chips add depth on demand.
 */
export function ThinkingTrace({
  progress,
  steps = [],
  tools = [],
  defaultOpen = false,
  className,
}: {
  progress?: AssistantProgress | null;
  steps?: ThinkingStep[];
  tools?: ToolChipItem[];
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasDepth = steps.length > 0 || tools.length > 0;

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <div className="flex flex-col items-center gap-2">
        <ThinkingStatus progress={progress} />
        {hasDepth && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1 text-[11px] font-medium text-muted transition hover:text-foreground max-sm:min-h-[44px]"
            aria-expanded={open}
          >
            {steps.length > 0 ? `${steps.length} steps` : `${tools.length} tools`}
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
        )}
      </div>

      {open && hasDepth && (
        <div className="t-acc mt-3 overflow-hidden rounded-2xl border border-border bg-surface/50" data-open="true">
          {tools.length > 0 && (
            <div className="border-b border-border px-4 py-3">
              <ToolChips items={tools} summary={`${tools.length} tool call${tools.length === 1 ? "" : "s"}`} />
            </div>
          )}
          {steps.length > 0 && (
            <ol className="divide-y divide-border">
              {steps.map((step) => {
                const Icon = KIND_ICON[step.kind];
                return (
                  <li key={step.id} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">
                      {step.done ? (
                        <Check className="size-4 text-emerald-500" />
                      ) : (
                        <Icon className="size-4 text-brand" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                        {step.kind}
                      </p>
                      <p className="text-sm text-foreground">{step.label}</p>
                      {step.detail && <p className="mt-0.5 text-xs text-muted">{step.detail}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
