import Link from "next/link";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PortalFixWidget({
  company,
  status,
}: {
  company: string;
  status: "live" | "unverified";
}) {
  const live = status === "live";
  return (
    <div className="rounded-2xl border border-border bg-surface/40 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-faint">Portal repair</p>
      <p className="mt-1 font-display text-lg tracking-tight text-landing">{company}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={live ? "good" : "warn"}>
          {live ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <AlertCircle className="size-3" /> Unverified
            </span>
          )}
        </Badge>
        <span className="text-sm text-muted">
          {live ? "ATS slug updated and verifying live." : "Could not confirm a working ATS slug."}
        </span>
      </div>
      <Link
        href="/portals"
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-brand-text"
      >
        Open sources <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
