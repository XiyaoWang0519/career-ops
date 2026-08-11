"use client";

import { useRef, type KeyboardEvent } from "react";
import { ArrowRight, AtSign, Command, Mic, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { CostBadge } from "@/components/cost/cost-badge";

export type PromptBarCommand = { id: string; label: string; hint?: string };

/**
 * Composer with @ sources, / commands, and action (Beautiful UI #08).
 * Visual + interaction shell — callers own submit semantics.
 */
export function PromptBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Ask or paste a job URL…",
  disabled,
  busy,
  cost = "spend",
  commands = [],
  onCommand,
  sources = [],
  onPickSource,
  submitLabel = "Go",
  className,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  cost?: "free" | "spend" | null;
  commands?: PromptBarCommand[];
  onCommand?: (id: string) => void;
  sources?: string[];
  onPickSource?: (s: string) => void;
  submitLabel?: string;
  className?: string;
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const slash = value.trim().startsWith("/");
  const at = /(^|\s)@$/.test(value) || /(^|\s)@[\w.-]*$/.test(value);

  const grow = () => {
    const t = ref.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !busy && value.trim()) onSubmit();
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "rounded-2xl border border-border bg-surface/80 p-3 shadow-sm transition",
          "focus-within:border-brand/45 focus-within:shadow-md",
          disabled && "opacity-60",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-text">
            <Sparkles className="size-3" /> Prompt
          </span>
          {cost && <CostBadge kind={cost} size="xs" />}
          {hint && <span className="text-[11px] text-faint">{hint}</span>}
        </div>

        <textarea
          ref={ref}
          rows={2}
          value={value}
          disabled={disabled || busy}
          onChange={(e) => {
            onChange(e.target.value);
            grow();
          }}
          onKeyDown={onKey}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />

        {(slash && commands.length > 0) && (
          <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-border bg-background/80 py-1">
            {commands
              .filter((c) => c.label.toLowerCase().includes(value.trim().slice(1).toLowerCase()) || value.trim() === "/")
              .slice(0, 6)
              .map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover max-sm:min-h-[44px]"
                    onClick={() => {
                      onCommand?.(c.id);
                      onChange("");
                    }}
                  >
                    <Command className="size-3.5 text-faint" />
                    <span className="font-medium">/{c.label}</span>
                    {c.hint && <span className="ml-auto text-xs text-faint">{c.hint}</span>}
                  </button>
                </li>
              ))}
          </ul>
        )}

        {at && sources.length > 0 && (
          <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-border bg-background/80 py-1">
            {sources.slice(0, 6).map((s) => (
              <li key={s}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover max-sm:min-h-[44px]"
                  onClick={() => onPickSource?.(s)}
                >
                  <AtSign className="size-3.5 text-faint" />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-faint hover:bg-surface-hover hover:text-muted max-sm:min-h-[44px]"
            title="@ sources"
            onClick={() => {
              onChange(value.endsWith("@") || value.endsWith("@ ") ? value : `${value}${value && !value.endsWith(" ") ? " " : ""}@`);
              ref.current?.focus();
            }}
          >
            <AtSign className="size-3.5" /> Source
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-faint hover:bg-surface-hover hover:text-muted max-sm:min-h-[44px]"
            title="/ commands"
            onClick={() => {
              onChange("/");
              ref.current?.focus();
            }}
          >
            <Command className="size-3.5" /> Command
          </button>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-faint" title="Dictation coming later">
            <Mic className="size-3.5 opacity-40" />
          </span>
          <button
            type="button"
            disabled={disabled || busy || !value.trim()}
            onClick={onSubmit}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-brand-foreground transition hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
          >
            {submitLabel} <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
