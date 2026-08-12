"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createShader, playSweep, accentChain, ACCENTS } from "glimm";
import { cn } from "@/lib/cn";

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
]);

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, ReactNode> = {
  clip: <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  layers: (
    <g>
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </g>
  ),
  globe: (
    <g>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </g>
  ),
  file: (
    <g>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </g>
  ),
  search: (
    <g>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </g>
  ),
};

type Source = {
  key: string;
  name: string;
  desc: string;
  glyph?: string;
  attach?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add photos & files", desc: "Upload from your computer", glyph: "clip", attach: true },
  { key: "pipeline", name: "Pipeline", desc: "Inbox and tracked applications", glyph: "layers" },
  { key: "cv", name: "CV", desc: "Your cv.md and profile", glyph: "file" },
  { key: "reports", name: "Reports", desc: "Evaluation write-ups", glyph: "chart" },
  { key: "tracker", name: "Tracker", desc: "Statuses across applications", glyph: "search" },
  { key: "web", name: "Web search", desc: "Company or role research", glyph: "globe" },
];

const COMMANDS = [
  { key: "evaluate", name: "/evaluate", desc: "Score a job posting" },
  { key: "scan", name: "/scan", desc: "Search configured portals" },
  { key: "triage", name: "/triage", desc: "Prioritize the inbox" },
  { key: "cover", name: "/cover", desc: "Draft a cover letter" },
  { key: "tracker", name: "/tracker", desc: "Summarize application status" },
  { key: "followup", name: "/followup", desc: "Who needs a nudge" },
];

const FLAGSHIP_CLIS = new Set(["claude", "codex"]);

type CliOption = {
  key: string;
  name: string;
  tag: string;
};

type PromptBarProps = {
  variant?: "Rounded" | "Pill";
  value: string;
  onChange: (value: string) => void;
  onSend: (text?: string) => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  cliId?: string | null;
  clis?: CliOption[];
  clisPinned?: boolean;
  onCliChange?: (id: string) => void;
  className?: string;
};

function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function PromptBar({
  variant = "Rounded",
  value,
  onChange,
  onSend,
  disabled = false,
  busy = false,
  placeholder = "Ask anything…",
  cliId = null,
  clis = [],
  clisPinned = false,
  onCliChange,
  className,
}: PromptBarProps) {
  const pill = variant === "Pill";
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null);
  const sweepingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const models = clis.length > 0 ? clis : cliId ? [{ key: cliId, name: cliId, tag: "Active" }] : [];
  const model = models.find((m) => m.key === cliId) ?? models[0] ?? null;
  const modelIndex = model ? models.findIndex((m) => m.key === model.key) : -1;
  const showModelPicker = Boolean(model && !clisPinned && models.length > 0);

  const token = dismissed ? null : parseToken(value);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: { key: string; name: string; desc: string }[] =
    menu === "at"
      ? SOURCES.filter((s) => s.name.toLowerCase().includes(query))
      : menu === "slash"
        ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query))
        : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, rows.length]);

  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? Math.max(modelIndex, 0)];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  const makeShader = () => {
    const canvas = glimmRef.current;
    if (!canvas) return null;
    const random = Math.random;
    Math.random = () => 0;
    try {
      return createShader({
        canvas,
        palette: RAINBOW,
        direction: "ltr",
        bandTight: 10,
        swellAmount: 0.85,
      });
    } finally {
      Math.random = random;
    }
  };

  useEffect(() => {
    shaderRef.current = makeShader();
    return () => {
      shaderRef.current?.destroy();
      shaderRef.current = null;
      recognitionRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebrate = () => {
    if (sweepingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    shaderRef.current?.destroy();
    const shader = makeShader();
    shaderRef.current = shader;
    if (!shader) return;
    sweepingRef.current = true;
    const sweep = playSweep(shader, {
      palette: RAINBOW,
      direction: "ltr",
      sweepMs: 950,
      outroMs: 130,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.3,
      easing: "easeOutExpo",
    });
    void sweep.done.finally(() => {
      sweepingRef.current = false;
    });
  };

  const selectModel = (next: CliOption) => {
    setModelOpen(false);
    onCliChange?.(next.key);
    if (FLAGSHIP_CLIS.has(next.key)) celebrate();
  };

  useEffect(() => {
    if (!listening) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      const fallback = "What should I prioritize in my pipeline today?";
      const t = setTimeout(() => {
        const current = valueRef.current;
        onChangeRef.current(current ? `${current.trimEnd()} ${fallback}` : fallback);
        setListening(false);
        inputRef.current?.focus();
      }, 900);
      return () => clearTimeout(t);
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (!transcript) return;
      const current = valueRef.current;
      onChangeRef.current(current ? `${current.trimEnd()} ${transcript}` : transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => {
      setListening(false);
      inputRef.current?.focus();
    };
    recognitionRef.current = recognition;
    recognition.start();
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [listening]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!input || !controls || !measure) return;

    const fixedControlsWidth = 28 * 3 + (modelButton?.offsetWidth ?? 0);
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = value.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) setExpanded(needsFullWidth);

    const minHeight = 28;
    const maxHeight = 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [value, expanded, showModelPicker, model?.name]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (row: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === row.key);
    if (source?.attach) {
      fileRef.current?.click();
      if (token) onChange(value.slice(0, token.start));
    } else if (menu === "at") {
      onChange(`${token ? value.slice(0, token.start) : value}@${row.name} `);
    } else {
      onChange(`${token ? value.slice(0, token.start) : value}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = !disabled && !busy && (value.trim().length > 0 || attachments.length > 0);

  const send = () => {
    if (!canSend) return;
    const attachmentNote =
      attachments.length > 0 ? `\n\n[Attached: ${attachments.join(", ")}]` : "";
    const text = `${value.trim()}${attachmentNote}`.trim();
    onSend(text);
    onChange("");
    setAttachments([]);
    closeMenus();
  };

  return (
    <div className={cn("relative w-full", className)}>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).map((file) => file.name);
          if (files.length) setAttachments((current) => [...current, ...files]);
          event.target.value = "";
          inputRef.current?.focus();
        }}
      />

      {menu && (
        <div
          onMouseLeave={() => setEngaged(false)}
          className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] border border-border bg-surface p-1 shadow-lg shadow-black/[0.06]"
          style={{ animation: "prompt-bar-pop-in var(--duration-quick) var(--ease-smooth-out) both", transformOrigin: "bottom center" }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-surface-hover"
            style={{
              top: rowBox?.top ?? 0,
              height: rowBox?.height ?? 0,
              opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
              transition:
                "top var(--duration-fast) var(--ease-smooth-out), height var(--duration-fast) var(--ease-smooth-out), opacity var(--duration-quick) var(--ease-out)",
            }}
          />
          {rows.map((row, i) => {
            const source = menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
            return (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                {source && (
                  <span className="flex size-5 shrink-0 items-center justify-center text-muted">
                    <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>
                  </span>
                )}
                <span className="shrink-0 text-[12.5px] font-medium text-foreground">{row.name}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-faint">{row.desc}</span>
              </button>
            );
          })}
          {rows.length === 0 && (
            <div className="flex h-9 items-center px-2 text-[12px] text-faint">No matches for “{query}”</div>
          )}
          <div className="mt-1 border-t border-border px-2 pb-1 pt-1.5 text-[11px] text-faint">
            {menu === "at" ? "Type to search sources & files" : "Type to search commands"}
          </div>
        </div>
      )}

      {modelOpen && showModelPicker && (
        <div
          onMouseLeave={() => setModelHovered(null)}
          className="absolute right-0 bottom-full z-10 mb-2 w-48 rounded-[10px] border border-border bg-surface p-1 shadow-lg shadow-black/[0.06]"
          style={{ animation: "prompt-bar-pop-in var(--duration-quick) var(--ease-smooth-out) both", transformOrigin: "bottom right" }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-surface-hover"
            style={{
              top: modelBox?.top ?? 0,
              height: modelBox?.height ?? 0,
              opacity: modelBox && modelHovered !== null ? 1 : 0,
              transition:
                "top var(--duration-fast) var(--ease-smooth-out), height var(--duration-fast) var(--ease-smooth-out), opacity var(--duration-quick) var(--ease-out)",
            }}
          />
          {models.map((m, i) => (
            <button
              key={m.key}
              type="button"
              ref={(el) => {
                modelRowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setModelHovered(i)}
              onClick={() => {
                selectModel(m);
                inputRef.current?.focus();
              }}
              className="relative z-10 flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">{m.name}</span>
              <span className="shrink-0 text-[11px] text-faint">{m.tag}</span>
              <span className={cn("shrink-0 text-foreground", m.key === model?.key ? "" : "invisible")}>
                <Icon size={13} strokeWidth={2.5}>
                  <path d="M20 6L9 17l-5-5" />
                </Icon>
              </span>
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          "relative isolate flex flex-col gap-1.5 overflow-hidden border border-border bg-surface p-1.5 shadow-lg shadow-black/[0.03] transition-[border-color,border-radius] duration-quick focus-within:border-brand/40",
          pill ? (attachments.length > 0 || expanded ? "rounded-[24px]" : "rounded-full") : "rounded-[14px]",
          disabled && "opacity-60",
        )}
      >
        <canvas
          ref={glimmRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          style={{ borderRadius: "inherit" }}
        />
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute whitespace-pre text-[13px] leading-[18px]"
        >
          {value}
        </span>

        {attachments.length > 0 && (
          <div className={cn("flex flex-wrap gap-1.5 pt-0.5", pill ? "px-1" : "px-0.5")}>
            {attachments.map((file, i) => (
              <span
                key={`${file}-${i}`}
                className={cn(
                  "flex h-6 items-center gap-1.5 border border-border bg-background py-1 pl-1.5 pr-1 text-[11.5px] text-muted",
                  pill ? "rounded-full" : "rounded-md",
                )}
                style={{ animation: "prompt-bar-pop-in var(--duration-fast) var(--ease-smooth-out) both" }}
              >
                <Icon size={12}>{GLYPHS.file}</Icon>
                <span className="max-w-36 truncate">{file}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file}`}
                  onClick={() => setAttachments((current) => current.filter((_, j) => j !== i))}
                  className={cn(
                    "flex size-4 items-center justify-center text-faint transition-colors duration-micro hover:bg-surface-hover hover:text-foreground",
                    pill ? "rounded-full" : "rounded-[4px]",
                  )}
                >
                  <Icon size={10} strokeWidth={2.5}>
                    <path d="M18 6L6 18M6 6l12 12" />
                  </Icon>
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          ref={controlsRef}
          className={cn(
            "grid items-end gap-x-1 gap-y-1.5",
            expanded
              ? showModelPicker
                ? "grid-cols-[minmax(0,1fr)_auto_28px_28px]"
                : "grid-cols-[minmax(0,1fr)_28px_28px]"
              : showModelPicker
                ? "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"
                : "grid-cols-[28px_minmax(0,1fr)_28px_28px]",
          )}
        >
          <button
            type="button"
            aria-label="Add attachments and sources"
            aria-expanded={plusOpen}
            disabled={disabled}
            onClick={() => {
              setModelOpen(false);
              setPlusOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center justify-self-start text-faint transition-[background-color,color,transform] duration-quick hover:bg-surface-hover hover:text-foreground active:scale-large disabled:pointer-events-none",
              pill ? "rounded-full" : "rounded-[8px]",
              plusOpen && "bg-surface-hover text-foreground",
              expanded ? "col-start-1 row-start-2" : "col-start-1 row-start-1",
            )}
          >
            <Icon size={16} strokeWidth={2}>
              <path d="M12 5v14M5 12h14" />
            </Icon>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              onChange(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (menu && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape") {
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={listening ? "Listening…" : placeholder}
            aria-label="Prompt"
            className={cn(
              "min-h-7 min-w-0 w-full resize-none bg-transparent px-1 py-[5px] text-[13px] leading-[18px] text-foreground outline-none [overflow-wrap:anywhere] placeholder:text-faint disabled:cursor-not-allowed",
              expanded ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1",
            )}
          />

          {showModelPicker && model && (
            <button
              ref={modelRef}
              type="button"
              aria-expanded={modelOpen}
              aria-label="Choose AI tool"
              disabled={disabled}
              onClick={() => {
                setPlusOpen(false);
                setModelOpen((current) => !current);
              }}
              className={cn(
                "flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-muted transition-colors duration-quick hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none",
                pill ? "rounded-full" : "rounded-[8px]",
                expanded ? "col-start-2 row-start-2" : "col-start-3 row-start-1",
              )}
            >
              {model.name}
              <span className="text-faint">
                <Icon size={11} strokeWidth={2.4}>
                  <path d="M6 9l6 6 6-6" />
                </Icon>
              </span>
            </button>
          )}

          <button
            type="button"
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            aria-pressed={listening}
            disabled={disabled}
            onClick={() => setListening((current) => !current)}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-quick active:scale-large disabled:pointer-events-none",
              pill ? "rounded-full" : "rounded-[8px]",
              listening ? "bg-brand-soft text-brand-text" : "text-faint hover:bg-surface-hover hover:text-foreground",
              expanded
                ? showModelPicker
                  ? "col-start-3 row-start-2"
                  : "col-start-2 row-start-2"
                : showModelPicker
                  ? "col-start-4 row-start-1"
                  : "col-start-3 row-start-1",
            )}
          >
            {listening ? (
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animation: `prompt-bar-eq-bounce 900ms var(--ease-in-out) calc(${i} * var(--duration-stagger)) infinite` }}
                  />
                ))}
              </span>
            ) : (
              <Icon size={15} strokeWidth={2}>
                <g>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </g>
              </Icon>
            )}
          </button>

          <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={send}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-fast enabled:active:scale-large",
              pill ? "rounded-full" : "rounded-[8px]",
              expanded
                ? showModelPicker
                  ? "col-start-4 row-start-2"
                  : "col-start-3 row-start-2"
                : showModelPicker
                  ? "col-start-5 row-start-1"
                  : "col-start-4 row-start-1",
              canSend ? "bg-brand text-brand-foreground hover:bg-brand-200" : "bg-surface-hover text-muted",
            )}
          >
            {busy ? (
              <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
            ) : (
              <Icon size={16} strokeWidth={2.4}>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </Icon>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
