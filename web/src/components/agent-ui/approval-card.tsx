"use client";

import { cn } from "@/lib/cn";

export type ApprovalOption = {
  id: string;
  label: string;
  hint?: string;
};

/** Human-in-the-loop approval (Beautiful UI #04). */
export function ApprovalCard({
  question,
  options,
  value,
  onChange,
  onConfirm,
  onSkip,
  confirmLabel = "Confirm",
  skipLabel = "Skip",
  busy,
  className,
  children,
}: {
  question: string;
  options: ApprovalOption[];
  value?: string | null;
  onChange: (id: string) => void;
  onConfirm: () => void;
  onSkip?: () => void;
  confirmLabel?: string;
  skipLabel?: string;
  busy?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-border bg-surface/60 p-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-faint">Needs your call</p>
      <h3 className="mt-1.5 text-base font-medium text-foreground">{question}</h3>
      {children}
      <ul className="mt-3 space-y-1.5" role="radiogroup" aria-label={question}>
        {options.map((opt) => {
          const selected = value === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => onChange(opt.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition max-sm:min-h-[44px]",
                  selected
                    ? "border-brand/50 bg-brand-soft"
                    : "border-border hover:bg-surface-hover",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 size-4 shrink-0 rounded-full border-2",
                    selected ? "border-brand bg-brand" : "border-border",
                  )}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{opt.label}</span>
                  {opt.hint && <span className="mt-0.5 block text-xs text-muted">{opt.hint}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy || !value}
          onClick={onConfirm}
          className="inline-flex flex-1 items-center justify-center rounded-md bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:bg-brand-200 disabled:opacity-50 max-sm:min-h-[44px]"
        >
          {confirmLabel}
        </button>
        {onSkip && (
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="inline-flex items-center justify-center rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50 max-sm:min-h-[44px]"
          >
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
