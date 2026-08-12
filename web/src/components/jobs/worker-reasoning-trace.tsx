"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Circle, Search, X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import type { Job, JobStep } from "@/components/jobs/job-store";
import { type AssistantProgress } from "@/components/assistant/thinking-status";
import { assistantProgressForReasoning, assistantProgressForTool } from "@/lib/assistant-progress.mjs";
import { cn } from "@/lib/cn";

const COMMAND_NAME_RE =
  /^(rg|grep|find|fd|cat|sed|awk|head|tail|less|more|wc|ls|pwd|mkdir|cp|mv|rm|touch|chmod|chown|node|npm|npx|pnpm|yarn|python|python3|pip|for|bash|sh|zsh|echo|printf|tee|xargs|sort|uniq|tr|cut|jq|curl|wget|git|which|test|true|false|cd|export|source|env|date|sleep|diff|patch|tar|unzip|zip|open|pbcopy|pbpaste|osascript)$/i;

export type EvidenceRow = {
  primary: string;
  secondary?: string;
  mono?: boolean;
  href?: string;
};

function inferToolFamily(name: string): string | undefined {
  const lowered = name.toLowerCase();
  if (COMMAND_NAME_RE.test(lowered) || lowered.includes("=") || lowered.startsWith("./")) {
    return "command";
  }
  if (/^(edit|write|patch|apply_patch|notebookedit|multiedit)$/i.test(lowered)) {
    return "file_change";
  }
  if (/^(websearch|web_search|search_web|webfetch|web_fetch)$/i.test(lowered)) {
    return "web_search";
  }
  if (/^(plan|todowrite)$/i.test(lowered)) {
    return "plan";
  }
  if (lowered.includes("mcp")) {
    return "mcp";
  }
  return undefined;
}

function shortPath(value: string): string {
  const clean = value.replace(/^['"]|['"]$/g, "").trim();
  const parts = clean.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return clean;
  return parts.slice(-2).join("/");
}

function stripShellWrapper(command: string): string {
  return command
    .replace(/^(?:(?:\/bin\/)?(?:bash|zsh|sh))\s+-lc\s+/, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function pathTokens(text: string): string[] {
  const matches = text.match(/(?:\.\/|\/|~\/)?[\w.@+-]+(?:\/[\w.@+-]+)+/g) || [];
  return [...new Set(matches)].slice(0, 6);
}

export function evidenceForStep(step: JobStep): EvidenceRow[] {
  if (step.kind !== "tool" || !step.detail?.trim()) return [];
  const detail = step.detail.trim();
  const family = (step.family || inferToolFamily(step.label) || "").toLowerCase();
  const name = step.label.toLowerCase();

  if (family === "web_search" || /websearch|web_fetch|webfetch/.test(name)) {
    if (/^https?:\/\//i.test(detail)) {
      try {
        const url = new URL(detail);
        return [{ primary: url.hostname.replace(/^www\./, ""), secondary: url.hostname, href: detail }];
      } catch {
        /* fall through */
      }
    }
    return [{ primary: "Query", secondary: detail }];
  }

  if (family === "file_change" || /^(edit|write|patch)$/.test(name)) {
    return detail
      .split(/,\s*/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((path) => ({ primary: "Edit", secondary: shortPath(path), mono: true }));
  }

  const bare = stripShellWrapper(detail);
  if (family === "command" || COMMAND_NAME_RE.test(name)) {
    const paths = pathTokens(bare);
    if (/^(cat|sed|awk|head|tail|less|more|wc|bat)$/.test(name) || /\b(cat|sed|head|tail)\b/.test(bare)) {
      const targets = paths.length ? paths : [bare];
      return targets.slice(0, 4).map((path) => ({ primary: "Read", secondary: shortPath(path), mono: true }));
    }
    if (/^(rg|grep|find|fd)$/.test(name) || /\b(rg|grep|find|fd)\b/.test(bare)) {
      const rows: EvidenceRow[] = [];
      const pattern = bare.match(
        /(?:rg|grep|fd|find)\s+(?:-[A-Za-z0-9=]+(?:=[^\s]+)?\s+)*(?:--\s+)?(?:['"]([^'"]+)['"]|([^\s-]+))/,
      );
      const query = (pattern?.[1] || pattern?.[2] || "").trim();
      if (query && !query.startsWith("-")) rows.push({ primary: "Query", secondary: query.slice(0, 96) });
      for (const path of paths.slice(0, 3)) {
        rows.push({ primary: "In", secondary: shortPath(path), mono: true });
      }
      if (rows.length) return rows;
      return [{ primary: "Search", secondary: bare.slice(0, 120), mono: true }];
    }
    return [{ primary: "Run", secondary: bare.slice(0, 140), mono: true }];
  }

  return [{ primary: step.label, secondary: detail.slice(0, 140), mono: true }];
}

export function progressForJobStep(step: JobStep): AssistantProgress {
  if (step.kind === "status") {
    if (/^done\.?$/i.test(step.label)) {
      return { category: "DONE", text: "Finished this run", orb: "working" };
    }
    if (/error|fail|interrupted/i.test(step.label)) {
      return { category: "ERROR", text: step.label, orb: "working" };
    }
    return assistantProgressForReasoning(step.label) as AssistantProgress;
  }
  return assistantProgressForTool({
    name: step.label,
    family: step.family || inferToolFamily(step.label),
    detail: step.detail,
  }) as AssistantProgress;
}

function StepCopy({
  progress,
  live,
}: {
  progress: AssistantProgress;
  live?: boolean;
}) {
  const needsWrappedWidth = progress.text.length > 56;
  return (
    <span className="block min-w-0 flex-1 text-left">
      <span className="block text-[10px] font-semibold uppercase leading-3 tracking-[0.16em] text-faint">
        {progress.category}
      </span>
      <span
        className={cn(
          "co-progress-copy mt-0.5 block text-[13px] leading-[18px]",
          live ? "t-shimmer text-muted" : "text-muted",
          live && (needsWrappedWidth ? "w-[min(64vw,34rem)]" : "w-fit max-w-[min(64vw,34rem)]"),
          !live && "truncate",
        )}
        data-text={live ? progress.text : undefined}
        title={progress.text}
      >
        {progress.text}
      </span>
    </span>
  );
}

function EvidenceList({ rows }: { rows: EvidenceRow[] }) {
  return (
    <div className="relative ml-[1.35rem] border-l border-border pl-4">
      <ul className="flex flex-col gap-1 py-1">
        {rows.map((row, index) => {
          const body = (
            <>
              {row.href ? (
                <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Search className="size-2" aria-hidden />
                </span>
              ) : null}
              <span className="min-w-0 truncate text-[12.5px] font-medium text-foreground">{row.primary}</span>
              {row.secondary && (
                <span className={cn("min-w-0 truncate text-[11.5px] text-faint", row.mono && "font-mono")}>
                  {row.secondary}
                </span>
              )}
            </>
          );
          const className =
            "flex min-h-7 w-full items-center gap-2 rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-surface-hover";
          if (row.href) {
            return (
              <li key={`${row.primary}-${row.secondary}-${index}`}>
                <a href={row.href} target="_blank" rel="noreferrer" className={className}>
                  {body}
                </a>
              </li>
            );
          }
          return (
            <li key={`${row.primary}-${row.secondary}-${index}`} className={className}>
              {body}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TraceStep({
  step,
  progress,
  live,
  failed,
  starter,
  defaultOpen,
  onToggle,
}: {
  step: JobStep;
  progress: AssistantProgress;
  live?: boolean;
  failed?: boolean;
  starter?: boolean;
  defaultOpen?: boolean;
  onToggle?: () => void;
}) {
  const evidence = useMemo(() => evidenceForStep(step), [step]);
  const expandable = evidence.length > 0;
  const [expanded, setExpanded] = useState(Boolean(defaultOpen && expandable));

  useEffect(() => {
    if (live && expandable) setExpanded(true);
  }, [live, expandable, step.detail, step.label]);

  const toggle = () => {
    if (!expandable) return;
    setExpanded((value) => !value);
    onToggle?.();
  };

  return (
    <li className="px-1 py-0.5" aria-current={live ? "step" : undefined}>
      <button
        type="button"
        onClick={toggle}
        disabled={!expandable}
        className={cn(
          "flex w-full min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 text-left",
          expandable && "hover:bg-surface-hover/70",
          !expandable && "cursor-default",
        )}
        aria-expanded={expandable ? expanded : undefined}
      >
        <span className="grid size-8 shrink-0 place-items-center">
          {live ? (
            <ThinkingOrb
              state={progress.orb}
              size={64}
              style={{ width: 32, height: 32 }}
              aria-label={`${progress.category.toLowerCase()} in progress`}
            />
          ) : failed ? (
            <X className="size-3.5 text-red-400" aria-hidden />
          ) : starter ? (
            <Circle className="size-3 text-faint" aria-hidden />
          ) : (
            <Check className="size-3.5 text-emerald-500" aria-hidden />
          )}
        </span>
        <StepCopy progress={progress} live={live} />
        {expandable && (
          <span
            className={cn(
              "inline-flex shrink-0 text-faint transition-transform duration-200",
              expanded && "scale-y-[-1]",
            )}
          >
            <ChevronDown className="size-3.5" />
          </span>
        )}
      </button>
      {expanded && expandable ? <EvidenceList rows={evidence} /> : null}
    </li>
  );
}

export function WorkerReasoningTrace({ job }: { job: Job }) {
  const running = job.status === "running";
  const failed = job.status === "error";
  const [open, setOpen] = useState(running);
  const [evidenceEpoch, setEvidenceEpoch] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (running) setOpen(true);
  }, [running, job.id]);

  const rows = useMemo(
    () => job.steps.map((step) => ({ step, progress: progressForJobStep(step) })),
    [job.steps],
  );

  const liveIndex = running ? rows.length - 1 : -1;
  const live = liveIndex >= 0 ? rows[liveIndex] : null;
  const past = liveIndex >= 0 ? rows.slice(0, liveIndex) : rows;
  const summary = live?.progress ?? rows[rows.length - 1]?.progress;

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => setHeight(Math.ceil(content.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, rows.length, live?.progress.text, live?.progress.category, evidenceEpoch]);

  useLayoutEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = list.scrollHeight;
    if (typeof list.scrollTo === "function") {
      list.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      list.scrollTop = top;
    }
  }, [open, rows.length, live?.progress.text, evidenceEpoch]);

  if (rows.length === 0) return null;

  return (
    <div
      className="t-resize mt-6 w-full max-w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-sm"
      style={height != null ? { height } : undefined}
    >
      <div ref={contentRef}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          aria-expanded={open}
        >
          <span className="grid size-8 shrink-0 place-items-center">
            {running && live ? (
              <ThinkingOrb
                state={live.progress.orb}
                size={64}
                style={{ width: 28, height: 28 }}
                aria-label={`${live.progress.category.toLowerCase()} in progress`}
              />
            ) : failed ? (
              <X className="size-3.5 text-red-400" aria-hidden />
            ) : (
              <Check className="size-3.5 text-emerald-500" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">
              {running ? "Reasoning" : failed ? "Trace" : "Completed"}
              <span className="ml-2 font-medium normal-case tracking-normal text-faint/80">
                · {rows.length} step{rows.length === 1 ? "" : "s"}
              </span>
            </span>
            {!open && summary && (
              <span className="mt-0.5 block truncate text-[13px] text-muted" title={summary.text}>
                {summary.text}
              </span>
            )}
          </span>
          <span className={cn("inline-flex shrink-0 transition-transform duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]", open && "scale-y-[-1]")}>
            <ChevronDown className="size-4 text-muted" />
          </span>
        </button>

        {open && (
          <ol
            ref={listRef}
            className="max-h-[22rem] space-y-0.5 overflow-y-auto border-t border-border px-2 py-2"
          >
            {past.map(({ step, progress }, index) => {
              const stepFailed =
                failed && index === past.length - 1 && !running && /error|fail|interrupted/i.test(step.label);
              const starter = step.kind === "status" && /start|ready/i.test(step.label);
              return (
                <TraceStep
                  key={`${step.ts}-${index}`}
                  step={step}
                  progress={progress}
                  failed={stepFailed}
                  starter={starter}
                  onToggle={() => setEvidenceEpoch((value) => value + 1)}
                />
              );
            })}

            {live && (
              <TraceStep
                step={live.step}
                progress={live.progress}
                live
                defaultOpen
                onToggle={() => setEvidenceEpoch((value) => value + 1)}
              />
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
