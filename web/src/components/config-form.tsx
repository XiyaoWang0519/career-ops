"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Terminal,
  Loader2,
  CircleDashed,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CadenceSettings } from "@/components/followups/cadence-settings";
import { useRuntime } from "@/components/runtime-provider";

type Cli = {
  id: string;
  name: string;
  run: string;
  url: string;
  installed: boolean;
  path: string | null;
};

const STORAGE_KEY = "career-ops:config";

export function ConfigForm() {
  const runtime = useRuntime();
  const [clis, setClis] = useState<Cli[] | null>(null);
  const [cliId, setCliId] = useState<string>("");
  const [logos, setLogos] = useState(true);
  const [saved, setSaved] = useState(false);

  // Load saved prefs
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const v = JSON.parse(raw);
        if (v.cliId) setCliId(v.cliId);
        if (typeof v.logos === "boolean") setLogos(v.logos);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Detect installed AI tools
  useEffect(() => {
    fetch("/api/clis")
      .then((r) => r.json())
      .then((d) => {
        const list: Cli[] = d.clis ?? [];
        setClis(list);
        if (d.defaultCli) {
          setCliId(d.defaultCli);
          return;
        }
        setCliId((prev) => prev || list.find((c) => c.installed)?.id || "");
      })
      .catch(() => setClis([]));
  }, []);

  function save() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode: "cli", cliId: runtime.pinned ? runtime.defaultCli || cliId : cliId, logos }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const installed = clis?.filter((c) => c.installed) ?? [];
  const pinnedName = clis?.find((c) => c.id === runtime.defaultCli)?.name || runtime.defaultCli;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl tracking-tight text-landing">Config</h1>
      <p className="mt-1 text-sm text-muted">
        Preferences for your job search dashboard. Your CV and data stay on this computer.
      </p>

      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        AI helper
      </label>

      {runtime.pinned ? (
        <div className="rounded-xl border border-border bg-surface/50 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Ready to go</p>
          <p className="mt-1 text-muted">
            Evaluations and the assistant run through <span className="text-foreground">{pinnedName}</span> — nothing to pick.
          </p>
        </div>
      ) : (
        <div>
          <p className="mb-1 text-sm text-muted">
            career-ops uses an AI tool you already have on this computer — signed in, your own usage.
          </p>
          <p className="mb-3 text-xs text-faint">Works with Claude Code, Codex, OpenCode and more.</p>
          {clis === null ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" /> Checking what&apos;s on your computer…
            </div>
          ) : installed.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4 text-sm text-muted">
              No AI tool yet? Free options like <span className="text-foreground">OpenCode</span> with Qwen or GLM work great.{" "}
              <a href="https://career-ops.org/docs/free-ai-engine" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">
                Get one free <ExternalLink className="size-3" />
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {clis.map((c) => {
                const selected = c.id === cliId;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                      selected
                        ? "border-brand/50 bg-brand-soft"
                        : c.installed
                          ? "border-border bg-surface/50"
                          : "border-border/60 bg-surface/20",
                    )}
                  >
                    {c.installed ? (
                      <Check className="size-4 shrink-0 text-emerald-400" />
                    ) : (
                      <CircleDashed className="size-4 shrink-0 text-faint" />
                    )}
                    <button
                      type="button"
                      disabled={!c.installed}
                      onClick={() => setCliId(c.id)}
                      className={cn(
                        "flex flex-1 items-center gap-2 text-left max-sm:min-h-[44px]",
                        c.installed ? "" : "cursor-default",
                      )}
                    >
                      <Terminal className={cn("size-3.5 shrink-0", selected ? "text-brand" : "text-muted")} />
                      <span
                        className={cn(
                          "font-medium",
                          selected ? "text-foreground" : c.installed ? "" : "text-muted",
                        )}
                      >
                        {c.name}
                      </span>
                    </button>
                    {c.installed ? (
                      <span className="hidden max-w-[40%] shrink-0 truncate text-xs text-faint sm:block">
                        {c.path}
                      </span>
                    ) : (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex shrink-0 items-center justify-center gap-1 text-xs text-brand hover:underline max-sm:min-h-[44px]"
                      >
                        Install <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                );
              })}
              <p className="mt-2 text-[11px] leading-relaxed text-faint">
                Claude Code and Codex both save evaluation reports to your tracker. Pick whichever you already use.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Appearance / privacy */}
      <label className="mt-8 mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        Appearance
      </label>
      <button
        type="button"
        onClick={() => setLogos((v) => !v)}
        className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-surface/50 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Company logos</span>
          <span className="mt-0.5 block text-xs text-faint">
            Show each company&apos;s real logo. Fetched once through your local server and cached on
            disk — only the employer domain is sent to a third party. Off = colored monograms only.
          </span>
        </span>
        <span
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            logos ? "bg-brand" : "bg-surface-hover",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
              logos ? "translate-x-[1.375rem]" : "translate-x-0.5",
            )}
          />
        </span>
      </button>

      {!runtime.simple && <CadenceSettings />}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200 max-sm:min-h-[44px]"
        >
          {saved ? <Check className="size-4" /> : null}
          {saved ? "Saved" : "Save"}
        </button>
        <span className="text-xs text-faint">Saved in this browser</span>
      </div>
    </div>
  );
}
