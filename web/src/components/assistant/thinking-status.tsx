"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ThinkingOrb, type OrbState } from "thinking-orbs";
import { cn } from "@/lib/cn";
import { DEFAULT_ASSISTANT_PROGRESS } from "@/lib/assistant-progress.mjs";

export type AssistantProgress = { category: string; text: string; orb: OrbState };

/**
 * Shared compact progress surface for every AI-assisted workflow. It renders
 * only sanitized summaries and plain-language tool activity supplied by the
 * caller; raw model reasoning is never accepted by this component.
 */
export function ThinkingStatus({ progress }: { progress?: AssistantProgress | null }) {
  const nextProgress = progress ?? (DEFAULT_ASSISTANT_PROGRESS as AssistantProgress);
  const [displayedProgress, setDisplayedProgress] = useState<AssistantProgress>(nextProgress);
  const [phase, setPhase] = useState<"" | "is-exit" | "is-enter-start">("");
  const contentRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const nextKey = `${nextProgress.orb}|${nextProgress.category}|${nextProgress.text}`;
  const displayedKey = `${displayedProgress.orb}|${displayedProgress.category}|${displayedProgress.text}`;
  const needsWrappedWidth = displayedProgress.text.length > 56;

  useEffect(() => {
    if (nextKey === displayedKey) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const configured = Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--text-swap-dur"),
    );
    const duration = reduceMotion ? 0 : Number.isFinite(configured) ? configured : 150;
    setPhase("is-exit");
    const timer = window.setTimeout(() => {
      setDisplayedProgress(nextProgress);
      setPhase("is-enter-start");
    }, duration);
    return () => window.clearTimeout(timer);
  }, [displayedKey, nextKey, nextProgress]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => {
      const bounds = content.getBoundingClientRect();
      setSize({
        width: Math.ceil(bounds.width + 2),
        height: Math.ceil(bounds.height + 2),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [displayedProgress]);

  useLayoutEffect(() => {
    if (phase !== "is-enter-start" || !contentRef.current) return;
    void contentRef.current.offsetHeight;
    const frame = window.requestAnimationFrame(() => setPhase(""));
    return () => window.cancelAnimationFrame(frame);
  }, [displayedProgress, phase]);

  return (
    <div
      className="t-resize inline-block max-w-full overflow-hidden rounded-2xl border border-border bg-surface align-top shadow-sm"
      style={size ? { width: size.width, height: size.height } : undefined}
      role="status"
      aria-live="polite"
      aria-label={`${displayedProgress.category}: ${displayedProgress.text}`}
    >
      <span
        ref={contentRef}
        className={cn("t-text-swap block w-fit max-w-[min(72vw,40rem)] px-4 py-4", phase)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ThinkingOrb
            state={displayedProgress.orb}
            size={64}
            style={{ width: 32, height: 32 }}
            aria-label={`${displayedProgress.category.toLowerCase()} in progress`}
            className="shrink-0"
          />
          <span className="block min-w-0 max-w-[34rem] text-left">
            <span className="block text-[10px] font-semibold uppercase leading-3 tracking-[0.16em] text-faint">
              {displayedProgress.category}
            </span>
            <span
              className={cn(
                "t-shimmer co-progress-copy max-w-[min(64vw,34rem)] text-[13px] leading-[18px] text-muted",
                needsWrappedWidth ? "w-[min(64vw,34rem)]" : "w-fit",
              )}
              data-text={displayedProgress.text}
              title={displayedProgress.text}
            >
              {displayedProgress.text}
            </span>
          </span>
        </span>
      </span>
    </div>
  );
}
