"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { Compass, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { CostBadge } from "@/components/cost/cost-badge";
import type { ExploreMode } from "@/lib/explore";

// Cost honesty rendered at the POINT OF CHOICE: free deterministic Scan (default)
// vs token-spending AI search. The AI segment stays selectable even with no CLI —
// selecting it reveals the blocked state (more discoverable than a dead tab).
export function ExploreModeToggle({
  mode,
  onChange,
  cliConfigured,
}: {
  mode: ExploreMode;
  onChange: (m: ExploreMode) => void;
  cliConfigured: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const initialized = useRef(false);

  const movePill = (animate: boolean) => {
    const bar = barRef.current;
    const pill = pillRef.current;
    const tab = bar?.querySelector<HTMLButtonElement>('.t-tab[aria-selected="true"]');
    if (!pill || !tab) return;
    if (!animate) {
      const previous = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${tab.offsetLeft}px)`;
      pill.style.width = `${tab.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = previous;
      return;
    }
    pill.style.transform = `translateX(${tab.offsetLeft}px)`;
    pill.style.width = `${tab.offsetWidth}px`;
  };

  useLayoutEffect(() => {
    movePill(initialized.current);
    initialized.current = true;
  }, [mode]);

  useEffect(() => {
    const onResize = () => movePill(false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div ref={barRef} className="t-tabs co-explore-tabs w-full border border-border sm:w-auto" role="tablist" aria-label="Explore mode">
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      <button
        type="button"
        onClick={() => onChange("scan")}
        role="tab"
        aria-selected={mode === "scan"}
        className={cn(
          "t-tab flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap text-sm sm:flex-none sm:gap-2 max-sm:h-11 max-sm:min-h-[44px]",
          mode === "scan" && "font-medium",
        )}
      >
        <Compass className="size-4" />
        <span className="font-medium">Scan</span>
        <span className="hidden sm:inline-flex">
          <CostBadge kind="free-network" size="xs" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("ai")}
        role="tab"
        aria-selected={mode === "ai"}
        className={cn(
          "t-tab flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap text-sm sm:flex-none sm:gap-2 max-sm:h-11 max-sm:min-h-[44px]",
          mode === "ai" && "font-medium",
        )}
      >
        <Sparkles className="size-4" />
        <span className="font-medium">AI search</span>
        <span className="hidden sm:inline-flex">
          <CostBadge kind="spend" size="xs" />
        </span>
        {!cliConfigured && <span className="text-[10px] text-faint">needs setup</span>}
      </button>
    </div>
  );
}
