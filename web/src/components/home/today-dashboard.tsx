"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CircleHelp, Sparkles, ArrowRight } from "lucide-react";
import { instrumentSerif } from "@/lib/fonts";
import { HeroGlow } from "@/components/hero-glow";
import type { InboxJob } from "@/lib/career-ops";
import type { OpportunityView } from "@/lib/opportunity";
import type { DiscoveredOffer } from "@/lib/explore";
import { DiscoveryCard } from "@/components/explore/discovery-card";
import { FollowUpCard, type FollowUp } from "@/components/home/follow-up-card";
import { DecisionCard } from "@/components/home/decision-card";
import { QuickEvaluate } from "@/components/quick-evaluate";

// The retention "Today": a dual-loop action queue (the maintainer's
// "N new matches this week · M follow-ups due"). SUPPLY loop = fresh free-scan
// matches (zero tokens, /api/whats-new); DEMAND loop = follow-ups due
// (/api/followups). Each item one-tap actionable. Home stays a VIEW over the
// canonical files — every action dispatches a real registry action / route.
export function TodayDashboard({
  opportunities,
  inbox,
  inBetween,
}: {
  opportunities: OpportunityView[];
  inbox: InboxJob[];
  inBetween: boolean;
}) {
  const [followups, setFollowups] = useState<FollowUp[]>([]);
  const [overdue, setOverdue] = useState(0);
  const [fresh, setFresh] = useState<DiscoveredOffer[]>([]);
  const router = useRouter();
  const dateLabel = useMemo(() => new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), []);

  const refetch = useCallback(() => {
    fetch("/api/followups")
      .then((r) => r.json())
      .then((d) => {
        setFollowups(Array.isArray(d.entries) ? d.entries : []);
        setOverdue(d.metadata?.overdue ?? d.entries?.length ?? 0);
      })
      .catch(() => {});
    fetch("/api/whats-new")
      .then((r) => r.json())
      .then((d) => setFresh(Array.isArray(d.offers) ? d.offers : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch();
    // A worker (evaluate/pdf) just wrote a real tracker row — refresh the server
    // snapshot (applications/inbox props) + the client loops so the freshly-scored
    // role appears in "Awaiting your decision" without a manual reload.
    const onDone = () => {
      router.refresh();
      refetch();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [refetch, router]);

  // Awaiting decision: scored (Evaluated) but no terminal status yet.
  const awaiting = useMemo(
    () => opportunities.filter((opportunity) => /^evaluat/i.test(opportunity.status)).slice(0, 6),
    [opportunities],
  );

  const inboxUrls = useMemo(() => new Set(inbox.map((j) => j.url)), [inbox]);
  const pendingInbox = useMemo(() => {
    const seen = new Set<string>();
    return inbox.filter((job) => {
      if (job.done || seen.has(job.url)) return false;
      seen.add(job.url);
      return true;
    });
  }, [inbox]);
  const freshOutsideInbox = useMemo(() => fresh.filter((offer) => !inboxUrls.has(offer.url)), [fresh, inboxUrls]);
  const rolesToReview = pendingInbox.length + freshOutsideInbox.length;
  const allClear = rolesToReview === 0 && overdue === 0 && awaiting.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 max-sm:pb-24">
      <section className="dot-bg relative overflow-hidden rounded-2xl border border-border bg-surface/40 px-7 py-10 md:px-10 md:py-12">
        <HeroGlow />
        {/* Readability scrim between the animated glow (z-0) and the copy (z-10). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-surface/55 backdrop-blur-[2px] dark:bg-background/45" />
        <div className="relative z-10">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            <span className="text-faint">//</span> today · <span className="tabular-nums">{dateLabel}</span>
          </p>
          <h1 className={`${instrumentSerif.className} mt-3 text-4xl leading-[1.05] text-landing md:text-5xl`}>
            {allClear ? (
              <>You&apos;re all caught up.</>
            ) : (
              <>
                {rolesToReview > 0 && (
                  <>
                    <span className="text-brand tabular-nums">{rolesToReview}</span> role{rolesToReview === 1 ? "" : "s"} to review
                  </>
                )}
                {rolesToReview > 0 && overdue > 0 && <span className="text-faint"> · </span>}
                {overdue > 0 && (
                  <>
                    <span className="text-brand tabular-nums">{overdue}</span> follow-up{overdue === 1 ? "" : "s"} due
                  </>
                )}
                {rolesToReview === 0 && overdue === 0 && awaiting.length > 0 && (
                  <><span className="text-brand tabular-nums">{awaiting.length}</span> decision{awaiting.length === 1 ? "" : "s"} waiting</>
                )}
              </>
            )}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted">
            {allClear ? "I'll keep scanning the market in the background and surface anything that fits." : "One queue, ordered by the next action that moves each opportunity forward."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/explore" className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-brand-foreground transition hover:bg-brand-200 max-sm:min-h-[44px]">
              Find new roles <ArrowRight className="size-4" />
            </Link>
            <Link href="/pipeline" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:border-brand/40 hover:text-brand max-sm:min-h-[44px]">
              Review opportunities
            </Link>
          </div>
          {inBetween && <QuickEvaluate />}
        </div>
      </section>

      {/* A. Follow-ups due (demand loop) */}
      {followups.length > 0 && (
        <Section icon={Bell} title="Follow-ups due" hint="Keep your applications alive — a nudge beats silence">
          <div className="grid gap-2.5">
            {followups.map((f) => (
              <FollowUpCard key={`${f.num}-${f.company}`} followup={f} onLogged={() => setOverdue((n) => Math.max(0, n - 1))} />
            ))}
          </div>
        </Section>
      )}

      {/* B. Awaiting your decision */}
      {awaiting.length > 0 && (
        <Section icon={CircleHelp} title="Awaiting your decision" hint="Evaluated — prepare, apply, or close">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {awaiting.map((a) => (
              <DecisionCard key={a.id} opportunity={a} />
            ))}
          </div>
        </Section>
      )}

      {/* C. Roles to review — never duplicate roles already represented by Inbox. */}
      {rolesToReview > 0 && (
        <Section icon={Sparkles} title="Roles to review" hint="Free discovery → inbox triage → evaluation">
          {pendingInbox.length > 0 && (
            <Link href="/pipeline" className="mb-3 flex items-center gap-4 rounded-2xl border border-brand/25 bg-brand-soft/35 px-5 py-4 transition-colors hover:border-brand/45 hover:bg-brand-soft/55">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-brand-foreground tabular-nums">{pendingInbox.length}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">Waiting in your opportunity inbox</span>
                <span className="mt-0.5 block text-xs text-muted">Shortlist the promising roles, skip the rest, then evaluate only what is worth the spend.</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-brand" />
            </Link>
          )}
          {freshOutsideInbox.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {freshOutsideInbox.slice(0, 6).map((o) => <DiscoveryCard key={o.url} offer={o} inPipeline={false} />)}
          </div>}
          {freshOutsideInbox.length > 6 && (
            <Link href="/explore?view=fresh" className="mt-3 inline-flex items-center text-sm text-muted transition hover:text-brand max-sm:min-h-[44px]">
              See all {freshOutsideInbox.length} new roles →
            </Link>
          )}
        </Section>
      )}

      {allClear && (
        <div className="mt-8 rounded-2xl border border-border bg-surface/30 px-6 py-10 text-center">
          <Sparkles className="mx-auto size-6 text-brand" />
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            Nothing needs you right now. Run a <Link href="/explore" className="text-brand hover:underline">free scan</Link> to surface this week&apos;s roles, or check your <Link href="/pipeline" className="text-brand hover:underline">pipeline</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-brand" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">{title}</h2>
        <span className="text-xs text-faint">· {hint}</span>
      </div>
      {children}
    </section>
  );
}
