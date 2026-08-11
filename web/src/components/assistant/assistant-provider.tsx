"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X, Settings, RotateCcw, ArrowUpRight, Sparkles } from "lucide-react";
import { CoMark } from "@/components/co-mark";
import { useJobs } from "@/components/jobs/job-store";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { useApply } from "@/components/apply/apply-provider";
import { useExplore } from "@/components/explore/explore-provider";
import { WorkerCard } from "@/components/jobs/worker-card";
import { BrowserSessionCard } from "@/components/browser-session-card";
import { dispatch, type ActionCtx, type DoneInfo } from "@/app/actions/registry";
import { scoreNum } from "@/lib/format";
import { pendingActOpenerStart } from "@/lib/act-envelope.mjs";
import { cn } from "@/lib/cn";
import { resolveClientCliId } from "@/lib/client-cli";
import { useRuntime } from "@/components/runtime-provider";
import { Button } from "@/components/ui/button";
import { stripLegacyCodexDiagnostics } from "@/lib/codex-stream.mjs";
import { explicitApplyUrl } from "@/lib/apply-intent.mjs";
import { ThinkingStatus, type AssistantProgress } from "@/components/assistant/thinking-status";
import { PromptBar } from "@/components/agent-ui/prompt-bar";
import {
  assistantProgressForReasoning,
  assistantProgressForTool,
} from "@/lib/assistant-progress.mjs";

// ── message model: messages are PART arrays so a live worker card can render
// inline next to text, both fed by the single JobsProvider store ──────────────
export type Part =
  | { type: "text"; text: string }
  | { type: "note"; text: string }
  | { type: "card"; jobId: string }
  | { type: "browser"; sessionId: string; url?: string }
  | { type: "batch"; batchId: string; jobIds: string[] }
  | { type: "confirm"; cid: string; summary: string; state: "pending" | "done" | "cancelled" };
export type Msg = { role: "user" | "assistant"; parts: Part[] };
type LegacyTracePart = { type: "trace"; items?: unknown[] };

type AssistantWireEvent =
  | { type: "text"; text: string }
  | { type: "reasoning"; id: string; text: string }
  | { type: "tool"; id: string; name: string; family?: string; detail?: string }
  | { type: "status"; label: string }
  | { type: "error"; msg: string }
  | { type: "done"; tokens?: number };

function sanitizeAssistantMessage(message: Msg): Msg {
  if (message.role !== "assistant") return message;
  let changed = false;
  const parts = (message.parts as Array<Part | LegacyTracePart>).flatMap((part): Part[] => {
    // The first activity implementation persisted a full trace card. Progress
    // is transient now, so remove those legacy parts while restoring chat.
    if (part.type === "trace") {
      changed = true;
      return [];
    }
    if (part.type !== "text") return [part];
    const text = stripLegacyCodexDiagnostics(part.text);
    if (text === part.text) return [part];
    changed = true;
    return [{ ...part, text }];
  });
  return changed ? { ...message, parts } : message;
}

function sanitizeAssistantMessages(messages: Msg[]): Msg[] {
  const sanitized = messages.map(sanitizeAssistantMessage);
  return sanitized.some((message, index) => message !== messages[index]) ? sanitized : messages;
}

function restoreBrowserLaunches(messages: Msg[]): Msg[] {
  let changed = false;
  const restored = messages.map((message, index) => {
    if (
      message.role !== "assistant" ||
      message.parts.some((part) => part.type === "browser") ||
      !message.parts.some((part) => part.type === "note" && /opening the application form/i.test(part.text))
    ) {
      return message;
    }
    const previous = messages[index - 1];
    if (previous?.role !== "user") return message;
    const match = msgText(previous).match(/https?:\/\/[^\s<>]+/i);
    if (!match) return message;
    changed = true;
    const browserPart: Part = { type: "browser", sessionId: "", url: match[0] };
    return { ...message, parts: [...message.parts, browserPart] };
  });
  return changed ? restored : messages;
}

const LEGACY_CHAT_KEY = "career-ops:chat";
const CHAT_HISTORY_KEY = "career-ops:chat-history:v1";
const MAX_CHAT_THREADS = 40;
const MAX_MESSAGES_PER_THREAD = 30;
const MIN_PROGRESS_DISPLAY_MS = 600;
// back-compat shims — the old directives still work, mapped onto the registry
const NAV_RE = /<<\s*go:\s*(\/[a-z0-9/_-]*)\s*>>/gi;
const REMEMBER_RE = /<<\s*remember:\s*([^>]+?)\s*>>/gi;

const GREETING =
  "Hi — I'm your career-ops assistant. I can walk you through onboarding, answer questions about your pipeline, or take you where you need to go. What would you like to do?";

// ── envelope parsing: act ONLY on complete <<act:ID {json}>> envelopes ────────
function codeRanges(s: string): [number, number][] {
  const ranges: [number, number][] = [];
  const re = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}
function inRanges(i: number, ranges: [number, number][]): boolean {
  return ranges.some(([a, b]) => i >= a && i < b);
}
function normalizeJson(s: string): string {
  return s
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*}$/, "}")
    .trim();
}
type Env = { start: number; end: number; id: string; argsJson: string };
function parseEnvelopes(acc: string): { complete: Env[]; hidePartialFrom: number } {
  const ranges = codeRanges(acc);
  const complete: Env[] = [];
  let hidePartialFrom = -1;
  const open = /<<act:([a-zA-Z]+)[ \t]+/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(acc))) {
    const start = m.index;
    if (inRanges(start, ranges)) continue;
    const argsStart = m.index + m[0].length;
    const close = acc.indexOf(">>", argsStart);
    if (close === -1) {
      if (hidePartialFrom === -1 || start < hidePartialFrom) hidePartialFrom = start;
      continue;
    }
    complete.push({ start, end: close + 2, id: m[1], argsJson: acc.slice(argsStart, close).trim() });
  }
  // The regex above only sees an opener once its id letters AND trailing space
  // have streamed in. Also hide a shorter trailing partial (`<<`, `<<act:sav`)
  // so it doesn't flicker into the bubble before the space arrives (#2290-class).
  const pending = pendingActOpenerStart(acc);
  if (pending >= 0 && (hidePartialFrom === -1 || pending < hidePartialFrom)) hidePartialFrom = pending;
  return { complete, hidePartialFrom };
}
function removeRanges(s: string, cuts: [number, number][]): string {
  if (!cuts.length) return s;
  const merged = [...cuts].sort((a, b) => a[0] - b[0]);
  let out = "";
  let pos = 0;
  for (const [a, b] of merged) {
    if (a > pos) out += s.slice(pos, a);
    pos = Math.max(pos, b);
  }
  out += s.slice(pos);
  return out;
}

// Page awareness: describe the route so "this offer" / "apply" resolves to what
// the user is looking at.
function describePage(p: string): string {
  if (p === "/") return "Today / home — overview of the user's pipeline.";
  if (p === "/pipeline") return "Pipeline — the applications table + the inbox of pending job URLs.";
  const m = p.match(/^\/pipeline\/([^/]+)$/);
  if (m)
    return `The user is viewing the EVALUATION REPORT for application #${m[1]}. If they say "this offer", "apply", "evaluate it", "draft a cover letter", they mean application #${m[1]} — read reports/${m[1]}-*.md or the matching data/applications.md row and act on THAT one.`;
  if (p === "/analytics") return "Analytics — funnel, score distribution, top companies.";
  if (p === "/cv") return "CV editor (cv.md).";
  if (p === "/config") return "Config — CLI / engine setup.";
  if (p === "/apply") return "Apply — the form-proxy: the user is reviewing a job application re-rendered in plain language, pre-filled from their CV. You can write/revise answers via setApplyField.";
  if (p.startsWith("/jobs/")) return "Watching a running worker / evaluation in progress.";
  return `Route ${p}.`;
}

// ── persistence migration: old {role,content:string} → parts[] ────────────────
function migrate(raw: unknown): Msg[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((m): Msg | null => {
      if (!m || typeof m !== "object") return null;
      const role = (m as { role?: string }).role === "user" ? "user" : "assistant";
      if (Array.isArray((m as { parts?: unknown }).parts)) {
        // Pending confirmations are transient. Browser parts are retained: if
        // their in-memory server session expired, the card offers a safe reopen
        // action using its durable URL.
        const parts = ((m as { parts: Array<Part | LegacyTracePart> }).parts).filter(
          (p): p is Part => p.type !== "trace" && (p.type !== "confirm" || p.state !== "pending"),
        );
        return { role, parts };
      }
      const content = (m as { content?: string }).content;
      return { role, parts: [{ type: "text", text: typeof content === "string" ? content : "" }] };
    })
    .filter((x): x is Msg => !!x)
    .map(sanitizeAssistantMessage);
}
function msgText(m: Msg): string {
  return m.parts.filter((p): p is Extract<Part, { type: "text" }> => p.type === "text").map((p) => p.text).join(" ").trim();
}

export type ChatThread = {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: number;
  updatedAt: number;
};

type StoredChatHistory = {
  version: 1;
  activeThreadId: string;
  threads: ChatThread[];
};

function createThreadId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function titleForMessages(messages: Msg[]): string {
  const firstUserMessage = messages.find((message) => message.role === "user" && msgText(message));
  const title = firstUserMessage ? msgText(firstUserMessage).replace(/\s+/g, " ") : "New conversation";
  return title.length > 52 ? `${title.slice(0, 51).trimEnd()}…` : title;
}

function serializableMessages(messages: Msg[]): Msg[] {
  return messages.slice(-MAX_MESSAGES_PER_THREAD).map((message) => ({
    role: message.role,
    parts: message.parts.filter((part) => part.type !== "confirm" || part.state !== "pending"),
  }));
}

function restoreChatHistory(raw: unknown): StoredChatHistory | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { threads?: unknown }).threads)) return null;
  const restored = (raw as { threads: unknown[] }).threads
    .map((item): ChatThread | null => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<ChatThread>;
      const messages = migrate(candidate.messages);
      if (!candidate.id || !messages) return null;
      const createdAt = Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : Date.now();
      const updatedAt = Number.isFinite(candidate.updatedAt) ? Number(candidate.updatedAt) : createdAt;
      return {
        id: candidate.id,
        title: typeof candidate.title === "string" && candidate.title.trim() ? candidate.title : titleForMessages(messages),
        messages: restoreBrowserLaunches(messages),
        createdAt,
        updatedAt,
      };
    })
    .filter((thread): thread is ChatThread => thread !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CHAT_THREADS);
  if (!restored.length) return null;
  const requestedActiveId = (raw as { activeThreadId?: unknown }).activeThreadId;
  const activeThreadId =
    typeof requestedActiveId === "string" && restored.some((thread) => thread.id === requestedActiveId)
      ? requestedActiveId
      : restored[0].id;
  return { version: 1, activeThreadId, threads: restored };
}

type Suggestion = { label: string; send: string };

type AssistantContextValue = {
  messages: Msg[];
  threads: ChatThread[];
  activeThreadId: string;
  input: string;
  setInput: (input: string) => void;
  busy: boolean;
  progress: AssistantProgress | null;
  cliId: string | null;
  suggestions: Suggestion[];
  send: (forced?: string) => void;
  resetChat: () => void;
  selectThread: (id: string) => void;
  deleteThread: (id: string) => void;
  open: boolean;
  openDock: () => void;
  closeDock: () => void;
  resolveConfirm: (cid: string, accept: boolean) => void;
  jobs: ReturnType<typeof useJobs>["jobs"];
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) throw new Error("useAssistant must be used within <AssistantProvider>");
  return context;
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [cliId, setCliId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AssistantProgress | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  const { jobs, startJob } = useJobs();
  const pipeline = usePipeline();
  const apply = useApply();
  const runtime = useRuntime();

  // refs so the streaming closure always sees the latest jobs/pipeline/apply/cli
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const pipelineRef = useRef(pipeline);
  pipelineRef.current = pipeline;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const explore = useExplore();
  const exploreRef = useRef(explore);
  exploreRef.current = explore;
  const handledRef = useRef<Set<string>>(new Set());
  const confirmRuns = useRef<Map<string, () => DoneInfo>>(new Map());
  const historyHydratedRef = useRef(false);

  // selected AI tool from Config, or server-pinned default
  useEffect(() => {
    function read() {
      setCliId(resolveClientCliId(runtime.defaultCli));
    }
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [runtime.defaultCli]);

  // Restore the multi-chat archive, migrating the original single-conversation
  // localStorage value on first load.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_HISTORY_KEY);
      const restored = stored ? restoreChatHistory(JSON.parse(stored)) : null;
      if (restored) {
        const active = restored.threads.find((thread) => thread.id === restored.activeThreadId)!;
        setThreads(restored.threads);
        setActiveThreadId(active.id);
        setMessages(active.messages);
      } else {
        const legacy = localStorage.getItem(LEGACY_CHAT_KEY);
        const legacyMessages = legacy ? migrate(JSON.parse(legacy)) : null;
        const now = Date.now();
        const thread: ChatThread = {
          id: createThreadId(),
          title: titleForMessages(legacyMessages ?? []),
          messages: restoreBrowserLaunches(legacyMessages ?? []),
          createdAt: now,
          updatedAt: now,
        };
        setThreads([thread]);
        setActiveThreadId(thread.id);
        setMessages(thread.messages);
      }
    } catch {
      const now = Date.now();
      const thread: ChatThread = {
        id: createThreadId(),
        title: "New conversation",
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      setThreads([thread]);
      setActiveThreadId(thread.id);
    }
    historyHydratedRef.current = true;
  }, []);

  // Fast Refresh preserves React state, so migration alone cannot clean a chat
  // already open in the browser. Sanitize it in place without dropping live
  // browser/card parts or resetting the conversation.
  useEffect(() => {
    setMessages((current) => restoreBrowserLaunches(sanitizeAssistantMessages(current)));
  }, []);

  // Report-page Apply buttons open the same live browser part inside chat without
  // spending an extra assistant turn just to translate a deterministic click.
  useEffect(() => {
    function onApply(e: Event) {
      const detail = (e as CustomEvent).detail as { url?: string; company?: string } | undefined;
      if (!detail?.url) return;
      setOpen(true);
      setMessages((ms) => [...ms, { role: "assistant", parts: [{ type: "text", text: `Opening ${detail.company ? `${detail.company}'s` : "the"} application in a live browser…` }] }]);
      void applyRef.current.open(detail.url, { prefill: true, company: detail.company }).then((sessionId) => {
        if (sessionId) appendParts([{ type: "browser", sessionId, url: detail.url }]);
      });
    }
    window.addEventListener("co-assistant-apply", onApply);
    return () => window.removeEventListener("co-assistant-apply", onApply);
  }, []);
  useEffect(() => {
    if (!historyHydratedRef.current || !activeThreadId) return;
    const nextMessages = serializableMessages(messages);
    setThreads((current) => {
      const existing = current.find((thread) => thread.id === activeThreadId);
      if (existing && JSON.stringify(existing.messages) === JSON.stringify(nextMessages)) return current;
      const now = Date.now();
      const updated: ChatThread = existing
        ? { ...existing, title: titleForMessages(nextMessages), messages: nextMessages, updatedAt: now }
        : {
            id: activeThreadId,
            title: titleForMessages(nextMessages),
            messages: nextMessages,
            createdAt: now,
            updatedAt: now,
          };
      return [updated, ...current.filter((thread) => thread.id !== activeThreadId)]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CHAT_THREADS);
    });
  }, [activeThreadId, messages]);

  useEffect(() => {
    if (!historyHydratedRef.current || !activeThreadId || !threads.length) return;
    try {
      const history: StoredChatHistory = {
        version: 1,
        activeThreadId,
        threads: threads.map((thread) => ({ ...thread, messages: serializableMessages(thread.messages) })),
      };
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
      localStorage.removeItem(LEGACY_CHAT_KEY);
    } catch {
      /* localStorage unavailable or full */
    }
  }, [activeThreadId, threads]);

  useEffect(() => {
    if (open && messages.length === 0) setMessages([{ role: "assistant", parts: [{ type: "text", text: GREETING }] }]);
  }, [open, messages.length]);

  // Dock panel owns scrollRef; keep it pinned to the latest message while open.
  // On /chat the dock is unmounted (ref is null) and the page scrolls itself.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, progress]);

  // ── message mutators (operate on the last assistant message) ──
  function patchLastAssistant(ms: Msg[], fn: (m: Msg) => Msg): Msg[] {
    const copy = [...ms];
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].role === "assistant") {
        copy[i] = fn(copy[i]);
        break;
      }
    }
    return copy;
  }
  const setStreamText = (text: string) =>
    setMessages((ms) =>
      patchLastAssistant(ms, (m) => {
        const visibleText = stripLegacyCodexDiagnostics(text);
        const parts = [...m.parts];
        const idx = parts.findIndex((p) => p.type === "text");
        if (idx === -1) parts.unshift({ type: "text", text: visibleText });
        else parts[idx] = { type: "text", text: visibleText };
        return { ...m, parts };
      }),
    );
  const appendParts = (newParts: Part[]) =>
    setMessages((ms) => patchLastAssistant(ms, (m) => ({ ...m, parts: [...m.parts, ...newParts] })));

  function appendCards(info: DoneInfo) {
    const ids = info.jobIds ?? [];
    if (!ids.length) {
      if (info.note) appendParts([{ type: "note", text: info.note }]);
      return;
    }
    if (info.batchId && ids.length > 1) appendParts([{ type: "batch", batchId: info.batchId, jobIds: ids }]);
    else appendParts(ids.map((jobId) => ({ type: "card" as const, jobId })));
  }

  function buildCtx(): ActionCtx {
    return {
      push: (p) => router.push(p),
      replace: (p) => router.replace(p),
      startJob,
      inbox: pipelineRef.current.inbox,
      applications: pipelineRef.current.applications,
      jobForUrl: (url) => {
        const m = jobsRef.current.filter((j) => j.input === url).sort((a, b) => b.startedAt - a.startedAt);
        return m[0];
      },
      rememberFact: (fact) => {
        fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fact }),
        }).catch(() => {});
      },
      writeStatus: (n, status) => {
        fetch("/api/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ n, status }),
        })
          .then(() => {
            router.refresh();
            pipelineRef.current.refetch();
          })
          .catch(() => {});
      },
      setApplyField: (idOrLabel, value) => applyRef.current.setAnswer(idOrLabel, value),
      startApply: (u) => {
        // Keep the real browser inside this conversation. The async session id
        // becomes a live message part as soon as Playwright has opened the page.
        void applyRef.current.open(u, { prefill: true }).then((sessionId) => {
          if (sessionId) appendParts([{ type: "browser", sessionId, url: u }]);
        });
      },
      applyExplore: (patch, opts) => exploreRef.current.applyPatch(patch, opts),
      writeProfile: (patch) => {
        fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) })
          .then(() => router.refresh())
          .catch(() => {});
      },
      writePortals: (roles, location) => {
        fetch("/api/portals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roles, location }) }).catch(() => {});
      },
    };
  }

  function runDispatch(id: string, args: Record<string, unknown>) {
    const res = dispatch(id, args, buildCtx());
    if (res.status === "done") appendCards(res);
    else if (res.status === "ignored") {
      if (res.note) appendParts([{ type: "note", text: res.note }]);
    } else if (res.status === "confirm") {
      const cid = `c-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
      confirmRuns.current.set(cid, res.run);
      appendParts([{ type: "confirm", cid, summary: res.summary, state: "pending" }]);
    }
  }

  function resolveConfirm(cid: string, accept: boolean) {
    const run = confirmRuns.current.get(cid);
    confirmRuns.current.delete(cid);
    const info = accept && run ? run() : null;
    setMessages((ms) =>
      ms.map((m) => {
        if (!m.parts.some((p) => p.type === "confirm" && p.cid === cid)) return m;
        const parts: Part[] = m.parts.map((p) =>
          p.type === "confirm" && p.cid === cid ? { ...p, state: accept ? "done" : "cancelled" } : p,
        );
        if (info?.jobIds?.length) {
          if (info.batchId && info.jobIds.length > 1) parts.push({ type: "batch", batchId: info.batchId, jobIds: info.jobIds });
          else parts.push(...info.jobIds.map((jobId) => ({ type: "card" as const, jobId })));
        }
        return { ...m, parts };
      }),
    );
  }

  // compact pipeline snapshot for the model (counts + per-company pending — lets
  // it offer/act on "all the Anthropic ones" without re-reading files)
  function pipelineContext(): string {
    const pending = pipelineRef.current.inbox.filter((j) => !j.done);
    if (!pending.length) return "";
    const counts = new Map<string, number>();
    for (const j of pending) counts.set(j.company, (counts.get(j.company) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
    return `\n\nINBOX SNAPSHOT: ${pending.length} pending postings. By company: ${top
      .map(([c, n]) => `${c} (${n})`)
      .join(", ")}. To evaluate every pending posting for one company, emit evaluateCompany with just the company name.`;
  }

  // When the user is on /apply, expose the proxy form's fields + current answers
  // so the assistant can write/revise any answer (setApplyField) on request.
  function applyContext(): string {
    const ap = applyRef.current;
    if (!pathname.startsWith("/apply") || !ap.fields.length) return "";
    const lines = ap.fields
      .map((f) => `- ${f.label || f.id}${ap.meta[f.id]?.needsConfirmation ? " (user confirms)" : ""}: ${ap.answers[f.id] ? `"${ap.answers[f.id].slice(0, 240)}"` : "(empty)"}`)
      .join("\n");
    return `\n\nAPPLY FORM — the user is filling "${ap.title}". Current answers:\n${lines}\nTo write or revise an answer, emit setApplyField {"field":"<label or id>","value":"<new text>"}. If a change reveals a durable preference or corrected fact, ALSO remember it.`;
  }

  async function send(forced?: string) {
    const text = (forced ?? input).trim();
    if (!text || busy || !cliId) return;
    if (forced === undefined) setInput("");
    const history = messages.filter((m) => msgText(m) && msgText(m) !== GREETING).map((m) => ({ role: m.role, content: msgText(m) }));
    setMessages((m) => [...m, { role: "user", parts: [{ type: "text", text }] }, { role: "assistant", parts: [{ type: "text", text: "" }] }]);
    setBusy(true);
    setProgress(null);
    handledRef.current = new Set();
    const shimsDone = new Set<string>();
    const applyUrl = explicitApplyUrl(text);
    if (applyUrl) {
      try {
        const sessionId = await applyRef.current.open(applyUrl, { prefill: true });
        if (!sessionId) {
          setStreamText("⚠️ I couldn’t open that application browser.");
          return;
        }
        setStreamText("Application browser ready. You keep control of login, review, and final submission.");
        appendParts([{ type: "browser", sessionId, url: applyUrl }]);
      } catch {
        setStreamText("⚠️ I couldn’t open that application browser.");
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, cliId, history, pageContext: describePage(pathname) + pipelineContext() + applyContext() }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        setStreamText(`⚠️ ${err.error || "Assistant unavailable."}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let wireBuffer = "";
      let answer = "";
      let sawTerminalEvent = false;
      let progressChangedAt = 0;

      const renderAnswer = () => {
        const { complete, hidePartialFrom } = parseEnvelopes(answer);
        const cuts: [number, number][] = complete.map((e) => [e.start, e.end]);
        if (hidePartialFrom >= 0) cuts.push([hidePartialFrom, answer.length]);
        let display = removeRanges(answer, cuts);

        // back-compat shims (strip + queue) on the cleaned text
        const shimNavs: string[] = [];
        const shimRems: string[] = [];
        display = display.replace(NAV_RE, (_, p) => {
          shimNavs.push(p);
          return "";
        });
        display = display.replace(REMEMBER_RE, (_, f) => {
          shimRems.push(String(f).trim());
          return "";
        });
        setStreamText(display.trimStart());

        for (const e of complete) {
          const key = `${e.start}|${e.id}|${e.argsJson}`;
          if (handledRef.current.has(key)) continue;
          handledRef.current.add(key);
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(normalizeJson(e.argsJson));
          } catch {
            continue;
          }
          runDispatch(e.id, args);
        }
        for (const p of shimNavs) {
          const k = `go:${p}`;
          if (!shimsDone.has(k)) {
            shimsDone.add(k);
            runDispatch("navigate", { path: p });
          }
        }
        for (const f of shimRems) {
          const k = `rem:${f}`;
          if (f && !shimsDone.has(k)) {
            shimsDone.add(k);
            runDispatch("remember", { fact: f });
          }
        }
      };

      const handleEvent = async (event: AssistantWireEvent) => {
        if (event.type === "text") {
          sawTerminalEvent = true;
          const remaining = progressChangedAt
            ? Math.max(0, MIN_PROGRESS_DISPLAY_MS - (Date.now() - progressChangedAt))
            : 0;
          if (remaining) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
          }
          setProgress(null);
          progressChangedAt = 0;
          answer += event.text;
          renderAnswer();
        } else if (event.type === "reasoning") {
          setProgress(assistantProgressForReasoning(event.text) as AssistantProgress);
          progressChangedAt = Date.now();
        } else if (event.type === "tool") {
          setProgress(assistantProgressForTool(event) as AssistantProgress);
          progressChangedAt = Date.now();
        } else if (event.type === "error") {
          sawTerminalEvent = true;
          setProgress(null);
          progressChangedAt = 0;
          setStreamText(`⚠️ ${event.msg}`);
        } else if (event.type === "done") {
          setProgress(null);
          progressChangedAt = 0;
        }
      };

      const drainEvents = async () => {
        let nl: number;
        while ((nl = wireBuffer.indexOf("\n")) !== -1) {
          const line = wireBuffer.slice(0, nl).trim();
          wireBuffer = wireBuffer.slice(nl + 1);
          if (!line) continue;
          try {
            await handleEvent(JSON.parse(line) as AssistantWireEvent);
          } catch {
            /* malformed transport line — keep the rest of the stream alive */
          }
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        wireBuffer += dec.decode(value, { stream: true });
        await drainEvents();
      }
      wireBuffer += dec.decode();
      if (wireBuffer.trim()) wireBuffer += "\n";
      await drainEvents();
      if (!sawTerminalEvent) setStreamText("_(no output — is the AI tool signed in?)_");
    } catch {
      setStreamText("⚠️ Connection error.");
    } finally {
      setProgress(null);
      setBusy(false);
      router.refresh();
      pipelineRef.current.refetch();
    }
  }

  function resetChat() {
    if (busy) return;
    applyRef.current.reset();
    setProgress(null);
    setInput("");
    confirmRuns.current.clear();
    const now = Date.now();
    const thread: ChatThread = {
      id: createThreadId(),
      title: "New conversation",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setThreads((current) => [thread, ...current].slice(0, MAX_CHAT_THREADS));
    setActiveThreadId(thread.id);
    setMessages([]);
  }

  function selectThread(id: string) {
    if (busy || id === activeThreadId) return;
    const thread = threads.find((candidate) => candidate.id === id);
    if (!thread) return;
    applyRef.current.reset();
    setProgress(null);
    setInput("");
    confirmRuns.current.clear();
    setActiveThreadId(thread.id);
    setMessages(restoreBrowserLaunches(sanitizeAssistantMessages(thread.messages)));
  }

  function deleteThread(id: string) {
    if (busy) return;
    const remaining = threads.filter((thread) => thread.id !== id);
    if (id !== activeThreadId) {
      setThreads(remaining);
      return;
    }
    applyRef.current.reset();
    setProgress(null);
    setInput("");
    confirmRuns.current.clear();
    const next = remaining.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (next) {
      setThreads(remaining);
      setActiveThreadId(next.id);
      setMessages(next.messages);
      return;
    }
    const now = Date.now();
    const replacement: ChatThread = {
      id: createThreadId(),
      title: "New conversation",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    setThreads([replacement]);
    setActiveThreadId(replacement.id);
    setMessages([]);
  }

  // Other surfaces (e.g. the onboarding banner) can open the assistant and kick
  // off a turn via a window event.
  const sendRef = useRef<(m?: string) => void>(() => {});
  sendRef.current = send;
  useEffect(() => {
    function onOpen(e: Event) {
      setOpen(true);
      const msg = (e as CustomEvent).detail?.message as string | undefined;
      if (msg) setTimeout(() => sendRef.current(msg), 80);
    }
    window.addEventListener("co-assistant", onOpen);
    return () => window.removeEventListener("co-assistant", onOpen);
  }, []);

  useEffect(() => {
    function onBrowserSession(e: Event) {
      const detail = (e as CustomEvent).detail as { oldSessionId?: string; newSessionId?: string; url?: string } | undefined;
      if (!detail?.newSessionId) return;
      const newSessionId = detail.newSessionId;
      setMessages((current) =>
        current.map((message) => ({
          ...message,
          parts: message.parts.map((part) =>
            part.type === "browser" &&
            part.sessionId === (detail.oldSessionId ?? "") &&
            (!detail.url || !part.url || part.url === detail.url)
              ? { ...part, sessionId: newSessionId, url: detail.url || part.url }
              : part,
          ),
        })),
      );
    }
    window.addEventListener("co-assistant-browser-session", onBrowserSession);
    return () => window.removeEventListener("co-assistant-browser-session", onBrowserSession);
  }, []);

  // ── proactive suggestion chips (onboarding + offer-driven next steps) ──
  const suggestions = useMemo(() => {
    const chips: { label: string; send: string }[] = [];
    const rep = pathname.match(/^\/pipeline\/(.+)$/);
    if (rep) {
      chips.push({ label: "Why this score?", send: "Walk me through why this offer scored the way it did — strengths and red flags." });
      chips.push({ label: "Should I apply?", send: "Given my profile, should I apply to this one? Be honest." });
      chips.push({ label: "Draft a cover letter", send: "Draft a short, sharp cover letter for this role." });
      return chips;
    }
    const pending = pipeline.inbox.filter((j) => !j.done);
    if (!pipeline.applications.length && !pending.length) {
      return [];
    }
    if (pending.length) {
      const counts = new Map<string, number>();
      for (const j of pending) counts.set(j.company, (counts.get(j.company) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] > 1) chips.push({ label: `Evaluate all ${top[0]} (${top[1]})`, send: `Evaluate all the pending ${top[0]} postings in my inbox.` });
      chips.push({ label: `Triage inbox (${pending.length})`, send: `I have ${pending.length} postings in my inbox — which should I evaluate first, and why?` });
    }
    const strong = pipeline.applications.filter((a) => scoreNum(a.score) >= 4.5).length;
    if (strong) chips.push({ label: "Strong matches to act on", send: "Show me my strongest matches (4.5+) I haven't applied to yet, and tell me which to prioritise." });
    chips.push({ label: "What should I do today?", send: "Look at my pipeline and tell me the 3 highest-leverage things I should do today." });
    return chips.slice(0, 4);
  }, [pathname, pipeline.inbox, pipeline.applications]);

  const hasBrowser = messages.some((m) => m.parts.some((p) => p.type === "browser"));

  const value: AssistantContextValue = {
    messages,
    threads,
    activeThreadId,
    input,
    setInput,
    busy,
    progress,
    cliId,
    suggestions,
    send,
    resetChat,
    selectThread,
    deleteThread,
    open,
    openDock: () => setOpen(true),
    closeDock: () => setOpen(false),
    resolveConfirm,
    jobs,
  };

  return (
    <AssistantContext.Provider value={value}>
      {children}
      {pathname !== "/chat" && (
        <div className={cn("t-morph co-assistant-morph", hasBrowser && "has-browser")} data-open={String(open)}>
          <div className="t-morph-menu flex flex-col" inert={!open} aria-hidden={!open} role="dialog" aria-modal="true" aria-label="Assistant">
          <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <CoMark size={26} />
            <div className="flex-1">
              <div className="text-sm font-semibold tracking-tight">Assistant</div>
              <div className="text-xs text-faint">{cliId ? "ready" : "no AI tool configured"}</div>
            </div>
            <Button variant="ghost" size="icon" onClick={resetChat} className="text-muted" aria-label="New chat" title="New chat">
              <RotateCcw className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="text-muted" aria-label="Close assistant">
              <X className="size-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => {
              const hasVisible = m.parts.some((p) => (p.type === "text" && p.text.trim()) || p.type !== "text");
              const isLast = i === messages.length - 1;
              const progressOnly = m.role === "assistant" && !hasVisible && busy && isLast;
              return (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl text-sm",
                      m.role === "user"
                        ? "bg-brand px-3.5 py-2 text-brand-foreground"
                        : progressOnly
                          ? "bg-transparent p-0"
                          : "w-full bg-surface-hover px-3.5 py-2 text-foreground",
                    )}
                  >
                    {m.role === "user" ? (
                      msgText(m)
                    ) : progressOnly ? (
                      <ThinkingStatus progress={progress} />
                    ) : (
                      <div className="space-y-2">
                        {m.parts.map((p, j) => (
                          <PartView key={j} part={p} jobs={jobs} onConfirm={resolveConfirm} onOpen={() => {}} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* proactive suggestion chips — onboarding + offer-driven next steps */}
          {cliId && !busy && suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-1 pt-0.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s.send)}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-2.5 py-1 text-xs text-muted transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
                >
                  <Sparkles className="size-3 text-brand/70" />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {!cliId && (
            <Link
              href="/config"
              onClick={() => setOpen(false)}
              className="mx-4 mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Settings className="size-3.5" /> Connect an AI tool in Config to enable the assistant →
            </Link>
          )}

          <div className="border-t border-border p-3">
            <PromptBar
              value={input}
              onChange={setInput}
              onSubmit={() => send()}
              disabled={!cliId}
              busy={busy}
              placeholder={cliId ? "Ask anything…" : "Connect an AI tool first"}
              cost="spend"
              submitLabel="Send"
              commands={[
                { id: "evaluate", label: "evaluate", hint: "Score a job URL" },
                { id: "scan", label: "scan", hint: "Free portal scan" },
                { id: "pipeline", label: "pipeline", hint: "Open pipeline" },
              ]}
              onCommand={(id) => {
                if (id === "scan") {
                  setOpen(false);
                  window.location.href = "/explore?run=1";
                  return;
                }
                if (id === "pipeline") {
                  setOpen(false);
                  window.location.href = "/pipeline";
                  return;
                }
                if (id === "evaluate") setInput("Evaluate this job URL: ");
              }}
              sources={["cv.md", "pipeline", "profile"]}
              onPickSource={(s) => setInput(`${input}${input && !input.endsWith(" ") ? " " : ""}@${s} `)}
            />
          </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="t-morph-plus flex items-center justify-center gap-2 bg-surface/90 py-1.5 pl-1.5 pr-4 backdrop-blur hover:bg-surface-hover max-sm:min-h-[44px]"
            aria-label="Open assistant"
            aria-expanded={open}
            aria-hidden={open}
            tabIndex={open ? -1 : 0}
          >
            <CoMark size={26} />
            <span className="text-sm font-medium">Ask</span>
          </button>
        </div>
      )}
    </AssistantContext.Provider>
  );
}

// ── part renderers ──
export function PartView({
  part,
  jobs,
  onConfirm,
}: {
  part: Part;
  jobs: ReturnType<typeof useJobs>["jobs"];
  onConfirm: (cid: string, accept: boolean) => void;
  onOpen?: () => void;
}) {
  if (part.type === "text") {
    if (!part.text.trim()) return null;
    return (
      <div className="report-prose text-sm [&_*]:my-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }
  if (part.type === "note") {
    return <div className="text-xs italic text-faint">{part.text}</div>;
  }
  if (part.type === "card") {
    const job = jobs.find((j) => j.id === part.jobId);
    if (!job)
      return (
        <Link href={`/jobs/${part.jobId}`} className="block rounded-xl border border-border bg-surface/40 p-2.5 text-xs text-faint hover:text-foreground">
          Worker finished earlier — open log →
        </Link>
      );
    return (
      <WorkerCard
        job={job}
        variant="inline"
        trailing={
          <Link href={`/jobs/${job.id}`} className="text-faint transition-colors hover:text-brand" aria-label="Open worker">
            <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />
    );
  }
  if (part.type === "browser") {
    return <BrowserSessionCard sessionId={part.sessionId} url={part.url} />;
  }
  if (part.type === "batch") {
    const children = part.jobIds.map((id) => jobs.find((j) => j.id === id)).filter(Boolean);
    const done = children.filter((j) => j!.status === "done").length;
    return (
      <div className="rounded-xl border border-border bg-surface/40 p-2.5">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="size-3.5 text-brand" />
          {part.jobIds.length} evaluations
          <span className="ml-auto tabular-nums text-faint">
            {done}/{part.jobIds.length} done
          </span>
        </div>
        <div className="space-y-1.5">
          {children.map((j) => (
            <WorkerCard
              key={j!.id}
              job={j!}
              variant="inline"
              trailing={
                <Link href={`/jobs/${j!.id}`} className="text-faint transition-colors hover:text-brand" aria-label="Open worker">
                  <ArrowUpRight className="size-3.5" />
                </Link>
              }
            />
          ))}
        </div>
      </div>
    );
  }
  if (part.type === "confirm") {
    return (
      <div className="rounded-xl border border-brand/40 bg-brand-soft p-2.5">
        <div className="text-xs font-medium text-foreground">{part.summary}</div>
        {part.state === "pending" ? (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onConfirm(part.cid, true)}
              className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-foreground transition-colors hover:bg-brand-200"
            >
              Confirm
            </button>
            <button
              onClick={() => onConfirm(part.cid, false)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-1 text-xs text-faint">{part.state === "done" ? "✓ started" : "cancelled"}</div>
        )}
      </div>
    );
  }
  return null;
}
