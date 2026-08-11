"use client";

import { PromptBar } from "@/components/agent-ui/prompt-bar";

const EXAMPLES = [
  "AI infra roles at climate startups, remote EU",
  "Forward-deployed engineer at Series A devtools, US-remote",
  "Head of Applied AI at healthtech, posted this week",
];

/** AI hunt composer — Prompt Bar shell (Beautiful UI #08). */
export function AiSearchBox({
  intent,
  onIntent,
  onSubmit,
  cliConfigured,
  cliName,
  onRunScan,
}: {
  intent: string;
  onIntent: (s: string) => void;
  onSubmit: () => void;
  cliConfigured: boolean;
  cliName?: string;
  onRunScan: () => void;
}) {
  return (
    <div>
      <PromptBar
        value={intent}
        onChange={onIntent}
        onSubmit={() => {
          if (intent.trim()) onSubmit();
        }}
        disabled={!cliConfigured}
        placeholder="“AI infra at climate startups, remote EU, not staff-level” — plain language"
        cost="spend"
        hint={
          cliConfigured
            ? `Reads the public web with ${cliName || "your AI tool"} — your tokens.`
            : "Connect an AI tool in Config to use AI search."
        }
        submitLabel="Hunt"
        commands={[
          { id: "hunt", label: "hunt", hint: "Open-web AI search" },
          { id: "scan", label: "scan", hint: "Free portal scan" },
        ]}
        onCommand={(id) => {
          if (id === "scan") onRunScan();
          if (id === "hunt" && intent.trim()) onSubmit();
        }}
        sources={["cv.md", "portals.yml", "profile"]}
        onPickSource={(s) => onIntent(`${intent}${intent && !intent.endsWith(" ") ? " " : ""}@${s} `)}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onIntent(ex)}
            className="rounded-full border border-border bg-surface/40 px-3 py-1.5 text-[12px] text-muted transition hover:border-brand/40 hover:text-brand max-sm:min-h-[44px]"
          >
            {ex}
          </button>
        ))}
        <button
          type="button"
          onClick={onRunScan}
          className="ml-auto inline-flex items-center gap-1 text-[12px] text-faint transition hover:text-foreground max-sm:min-h-[44px]"
        >
          or run the free Scan instead →
        </button>
      </div>
    </div>
  );
}
