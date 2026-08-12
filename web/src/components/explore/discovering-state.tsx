"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { ApplyBackdrop } from "@/components/apply/apply-backdrop";
import { instrumentSerif } from "@/lib/fonts";
import { ATS_LABEL, ATS_SOURCES, type AtsSource } from "@/lib/explore";
import { filteredCount, sourceScanProgress } from "@/lib/scan-progress.mjs";
import { useExplore, type SourceState } from "./explore-provider";

const STYLE = `
.co-disc{position:relative;z-index:1;display:flex;min-height:78vh;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:1.15rem;padding:1.5rem 2rem}
.co-disc__counter{font-variant-numeric:tabular-nums;line-height:1;font-size:clamp(4rem,13vw,8rem)}
.co-disc__percent{font-size:.38em;color:var(--muted-foreground);margin-left:.08em}
.co-disc__overall{height:5px;width:min(28rem,80vw);overflow:hidden;border-radius:999px;background:color-mix(in srgb,var(--fg) 12%,transparent)}
.co-disc__overall-bar{height:100%;border-radius:inherit;background:hsl(26 73% 51%);transition:width .45s ease}
.co-scope{display:flex;max-width:52rem;flex-wrap:wrap;align-items:center;justify-content:center;gap:.45rem}
.co-scope__item{border:1px solid var(--border,hsl(0 0% 50% / .2));border-radius:999px;background:color-mix(in srgb,var(--bg) 74%,transparent);padding:.28rem .65rem;font-size:11px;color:var(--muted-foreground)}
.co-scope__item strong{color:var(--foreground);font-weight:600}
.co-funnel{display:grid;grid-template-columns:repeat(4,minmax(7.5rem,1fr));gap:.55rem;width:min(42rem,100%)}
.co-funnel__metric{border:1px solid var(--border,hsl(0 0% 50% / .2));border-radius:.85rem;background:color-mix(in srgb,var(--bg) 72%,transparent);padding:.65rem .8rem;text-align:left}
.co-funnel__value{font-variant-numeric:tabular-nums;font-size:1.25rem;line-height:1.15;color:var(--foreground);font-weight:650}
.co-funnel__label{margin-top:.2rem;font-size:10px;color:var(--muted-foreground)}
.co-filter-breakdown{display:flex;max-width:48rem;flex-wrap:wrap;justify-content:center;gap:.35rem .8rem;font-size:10.5px;color:var(--muted-foreground)}
.co-filter-breakdown strong{font-variant-numeric:tabular-nums;color:var(--foreground);font-weight:600}
.co-src{display:flex;flex-wrap:wrap;justify-content:center;gap:.6rem}
.co-src__chip{display:flex;align-items:center;gap:.5rem;border-radius:.8rem;border:1px solid var(--border,hsl(0 0% 50% / .2));padding:.5rem .8rem;min-width:9.5rem;background:color-mix(in srgb, var(--bg) 70%, transparent);transition:opacity .3s,border-color .3s}
.co-src__chip[data-state="queued"]{opacity:.4;border-style:dashed}
.co-src__chip[data-state="active"]{border-color:hsl(26 73% 51% / .45)}
.co-src__chip[data-state="noisy"]{border-color:hsl(38 92% 50% / .4)}
.co-src__orb{width:.55rem;height:.55rem;border-radius:50%;background:hsl(26 80% 55%);box-shadow:0 0 0 0 hsl(26 80% 55% / .5);animation:co-orb 1.4s ease-out infinite}
.co-src__bar{height:3px;border-radius:2px;background:hsl(26 73% 51%);transition:width .4s ease}
.co-src__track{height:3px;border-radius:2px;background:color-mix(in srgb, var(--fg) 14%, transparent);overflow:hidden;width:3.5rem}
.co-disc__skel{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.7rem;width:100%;max-width:46rem;margin-top:.5rem}
.co-disc__skelcard{height:4.4rem;border-radius:.8rem;border:1px solid var(--border,hsl(0 0% 50% / .15));background:color-mix(in srgb, var(--bg) 60%, transparent);overflow:hidden;position:relative}
.co-disc__skelcard::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,color-mix(in srgb, var(--fg) 8%, transparent),transparent);transform:translateX(-100%);animation:co-shimmer 1.5s infinite}
.co-ledger{display:inline-flex;align-items:center;gap:.5rem;border-radius:999px;border:1px solid hsl(160 64% 46% / .3);background:hsl(160 64% 46% / .1);color:hsl(160 60% 40%);padding:.35rem .85rem;font-size:12.5px;font-weight:600}
html.dark .co-ledger{color:hsl(158 64% 62%)}
@keyframes co-orb{0%{box-shadow:0 0 0 0 hsl(26 80% 55% / .5)}70%{box-shadow:0 0 0 .5rem hsl(26 80% 55% / 0)}100%{box-shadow:0 0 0 0 hsl(26 80% 55% / 0)}}
@keyframes co-shimmer{100%{transform:translateX(100%)}}
@media (max-width:640px){.co-funnel{grid-template-columns:repeat(2,minmax(7.5rem,1fr))}}
@media (prefers-reduced-motion: reduce){.co-src__orb,.co-disc__skelcard::after{animation:none}.co-disc__overall-bar,.co-src__bar{transition:none}}
`;

export function useCountUp(target: number): number {
  const [val, setVal] = useState(target);
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    const tick = () => {
      setVal((v) => {
        const diff = target - v;
        if (Math.abs(diff) < 0.5) return target;
        raf.current = requestAnimationFrame(tick);
        return v + diff * 0.18;
      });
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return Math.round(val);
}

function NumberPop({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const chars = value.toLocaleString().split("");

  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    group.classList.remove("is-animating");
    void group.offsetHeight;
    group.classList.add("is-animating");
  }, [value]);

  return (
    <span ref={ref} className="t-digit-group is-animating">
      {chars.map((char, index) => (
        <span
          key={`${index}-${char}`}
          className="t-digit"
          data-stagger={index === chars.length - 2 ? "1" : index === chars.length - 1 ? "2" : undefined}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  return <NumberPop value={useCountUp(value)} />;
}

function SourceChip({ ats, s }: { ats: AtsSource; s?: SourceState }) {
  const state = s?.state ?? "queued";
  const pct = s?.total ? Math.min(100, Math.round(((s.done ?? 0) / s.total) * 100)) : state === "swept" || state === "noisy" ? 100 : 0;
  return (
    <div className="co-src__chip" data-state={state}>
      {state === "active" ? (
        <span className="co-src__orb" />
      ) : state === "swept" || state === "noisy" ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <span className="size-2.5 rounded-full border border-current opacity-40" />
      )}
      <span className="text-[13px] font-medium text-foreground">{ATS_LABEL[ats]}</span>
      <div className="ml-auto flex flex-col items-end gap-1">
        {state === "active" && s?.total ? <span className="text-[10px] tabular-nums text-faint">{s.done ?? 0}/{s.total}</span> : null}
        {state === "swept" && <span className="text-[10px] text-faint">Done</span>}
        {state === "noisy" && <span className="text-[10px] text-amber-600 dark:text-amber-400">{s?.unreachable ?? 0} unreachable</span>}
        <div className="co-src__track">
          <div className="co-src__bar" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function DiscoveringState() {
  const { filters, sources, matchCount, scanFunnel, status, phase } = useExplore();
  const selectedSources = filters.ats.length ? filters.ats : ATS_SOURCES;
  const progress = sourceScanProgress(selectedSources, sources);
  const percent = useCountUp(phase === "revealing" ? 100 : progress.percent);
  const kept = Math.max(matchCount, scanFunnel.selected);
  const rejected = filteredCount(scanFunnel);
  const companiesChecked = selectedSources.reduce((sum, ats) => {
    const source = sources[ats];
    if (!source) return sum;
    if (source.state === "swept" || source.state === "noisy") return sum + (source.done ?? source.total ?? source.companies ?? 0);
    return sum + (source.done ?? 0);
  }, 0);
  const titleScope = filters.positive.length ? filters.positive.slice(0, 3).join(", ") + (filters.positive.length > 3 ? ` +${filters.positive.length - 3}` : "") : "any title";
  const locations = [...filters.allow, ...filters.alwaysAllow];
  const locationScope = locations.length ? locations.slice(0, 3).join(", ") + (locations.length > 3 ? ` +${locations.length - 3}` : "") : "any location";
  const otherFiltered = scanFunnel.filteredContent + scanFunnel.filteredInvalid + scanFunnel.filteredBlacklist;
  const activeLabel = progress.activeSource ? ATS_LABEL[progress.activeSource as AtsSource] ?? progress.activeSource : "Preparing sources";

  return (
    <>
      <ApplyBackdrop intense={phase !== "revealing"} />
      <div className="co-disc">
        <style>{STYLE}</style>

        <div className="co-ledger">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          0 tokens · $0.00 <span className="opacity-70">· live scan</span>
        </div>

        <div>
          <div className={`${instrumentSerif.className} co-disc__counter text-foreground`}>
            <NumberPop value={percent} /><span className="co-disc__percent">%</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            {phase === "revealing"
              ? `${kept.toLocaleString()} fresh role${kept === 1 ? "" : "s"} found — free`
              : progress.activeSource
                ? `Source ${progress.sourceNumber} of ${progress.sourceCount} · ${activeLabel} · ${progress.done.toLocaleString()} of ${progress.total.toLocaleString()} companies`
                : "Preparing the selected ATS sources…"}
          </p>
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Search {progress.percent}% complete. {activeLabel}. {progress.done} of {progress.total} companies in this source. {kept} matches kept.
        </p>

        <div className="co-disc__overall" role="progressbar" aria-label="Overall search progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="co-disc__overall-bar" style={{ width: `${percent}%` }} />
        </div>

        <div className="co-scope" aria-label="Active search filters">
          <span className="co-scope__item"><strong>Titles</strong> · {titleScope}</span>
          <span className="co-scope__item"><strong>Locations</strong> · {locationScope}</span>
          <span className="co-scope__item"><strong>Posted</strong> · last {filters.sinceDays} days + undated</span>
          <span className="co-scope__item"><strong>Sources</strong> · {selectedSources.length} selected</span>
        </div>

        <div className="co-src">
          {selectedSources.map((a) => (
            <SourceChip key={a} ats={a} s={sources[a]} />
          ))}
        </div>

        <div className="co-funnel" aria-label="Live search counts">
          <div className="co-funnel__metric"><div className="co-funnel__value"><AnimatedNumber value={companiesChecked} /></div><div className="co-funnel__label">Companies checked</div></div>
          <div className="co-funnel__metric"><div className="co-funnel__value"><AnimatedNumber value={scanFunnel.postingsChecked} /></div><div className="co-funnel__label">Postings inspected</div></div>
          <div className="co-funnel__metric"><div className="co-funnel__value"><AnimatedNumber value={rejected} /></div><div className="co-funnel__label">Filtered out</div></div>
          <div className="co-funnel__metric"><div className="co-funnel__value text-emerald-600 dark:text-emerald-400"><AnimatedNumber value={kept} /></div><div className="co-funnel__label">Matches kept</div></div>
        </div>

        <div className="co-filter-breakdown" aria-label="Why postings were filtered out">
          <span>Title <strong>{scanFunnel.filteredTitle.toLocaleString()}</strong></span>
          <span>Location <strong>{scanFunnel.filteredLocation.toLocaleString()}</strong></span>
          <span>Too old <strong>{scanFunnel.filteredDate.toLocaleString()}</strong></span>
          <span>Already seen <strong>{scanFunnel.filteredSeen.toLocaleString()}</strong></span>
          <span>Other rules <strong>{otherFiltered.toLocaleString()}</strong></span>
        </div>

        <p className="flex items-center gap-2 text-[13px] text-faint">
          <Loader2 className="size-3.5 animate-spin" />
          {status || "Casting the net across the ATS network…"}
        </p>

        <div className={phase === "revealing" ? "t-skel is-revealed h-[29.5rem] w-full max-w-[46rem] sm:h-[14.5rem]" : "t-skel h-[29.5rem] w-full max-w-[46rem] sm:h-[14.5rem]"} aria-hidden>
          <div className="t-skel-skeleton is-pulsing">
            <div className="co-disc__skel">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="co-disc__skelcard" />
              ))}
            </div>
          </div>
          <div className="t-skel-content grid place-items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Fresh matches ready
          </div>
        </div>
      </div>
    </>
  );
}
