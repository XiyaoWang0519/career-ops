"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, History as HistoryIcon, PanelLeftClose, PanelLeftOpen, Plus, Settings, Sparkles, Trash2, X } from "lucide-react";
import { ThinkingOrb } from "thinking-orbs";
import { PartView, useAssistant } from "@/components/assistant/assistant-provider";
import { PromptBar } from "@/components/assistant/prompt-bar";
import { ThinkingStatus } from "@/components/assistant/thinking-status";
import { cn } from "@/lib/cn";

function formatThreadTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

const HISTORY_COLLAPSED_KEY = "career-ops:chat-history-collapsed";

function ChatHistoryPanel({ onClose, onCollapse }: { onClose?: () => void; onCollapse?: () => void }) {
  const { threads, activeThreadId, busy, resetChat, selectThread, deleteThread } = useAssistant();

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface/35">
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Assistant</p>
          <h2 className="mt-1 text-sm font-semibold tracking-tight">Chat history</h2>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Close chat history"
          >
            <X className="size-4" />
          </button>
        ) : onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
            aria-label="Collapse chat history"
            title="Collapse chat history"
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            resetChat();
            onClose?.();
          }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" />
          New chat
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4" aria-label="Chat history">
        {threads.map((thread) => {
          const active = thread.id === activeThreadId;
          return (
            <div
              key={thread.id}
              className={cn(
                "group flex items-center rounded-xl border border-transparent transition-colors",
                active ? "border-border bg-surface shadow-sm" : "hover:bg-surface-hover",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  selectThread(thread.id);
                  onClose?.();
                }}
                disabled={busy}
                className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:cursor-not-allowed"
                aria-current={active ? "page" : undefined}
              >
                <span className="block truncate text-[13px] font-medium text-foreground">{thread.title}</span>
                <span className="mt-0.5 block text-[11px] text-faint">{formatThreadTime(thread.updatedAt)}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete “${thread.title}”? This cannot be undone.`)) deleteThread(thread.id);
                }}
                disabled={busy}
                className="mr-1 rounded-lg p-2 text-faint opacity-0 transition-[color,background-color,opacity] hover:bg-red-500/10 hover:text-red-500 group-focus-within:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed max-lg:opacity-100"
                aria-label={`Delete ${thread.title}`}
                title="Delete chat"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </nav>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-4 text-faint">
        Conversations survive refresh on this device.
      </p>
    </div>
  );
}

export default function ChatPage() {
  const {
    messages,
    input,
    setInput,
    busy,
    progress,
    cliId,
    clis,
    clisPinned,
    selectCli,
    suggestions,
    send,
    resetChat,
    resolveConfirm,
    runAction,
    jobs,
  } = useAssistant();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyCollapsed, setHistoryCollapsed] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, progress]);

  useEffect(() => {
    if (!historyOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHistoryOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [historyOpen]);

  useEffect(() => {
    try {
      setHistoryCollapsed(localStorage.getItem(HISTORY_COLLAPSED_KEY) === "1");
    } catch {
      setHistoryCollapsed(false);
    }
  }, []);

  useEffect(() => {
    if (historyCollapsed === null) return;
    try {
      localStorage.setItem(HISTORY_COLLAPSED_KEY, historyCollapsed ? "1" : "0");
    } catch {
      /* localStorage unavailable */
    }
  }, [historyCollapsed]);

  const hasConversation = messages.some((message) =>
    message.parts.some((part) => part.type !== "text" || part.text.trim()),
  );

  return (
    <div className="flex h-[calc(100dvh-5rem)] min-h-0 bg-background md:h-screen">
      <aside
        className={cn(
          "hidden shrink-0 overflow-hidden border-r border-border transition-[width,border-color] duration-200 motion-reduce:transition-none lg:block",
          historyCollapsed ? "w-0 border-transparent" : "w-72",
        )}
        aria-hidden={historyCollapsed === true}
      >
        <div className="h-full w-72">
          <ChatHistoryPanel onCollapse={() => setHistoryCollapsed(true)} />
        </div>
      </aside>

      {historyOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
            onClick={() => setHistoryOpen(false)}
            aria-label="Close chat history"
          />
          <aside
            className="absolute inset-y-0 left-0 w-[min(88vw,20rem)] border-r border-border bg-background shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Chat history"
          >
            <ChatHistoryPanel onClose={() => setHistoryOpen(false)} />
          </aside>
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
              aria-label="Open chat history"
            >
              <HistoryIcon className="size-4" />
            </button>
            {historyCollapsed && (
              <button
                type="button"
                onClick={() => setHistoryCollapsed(false)}
                className="hidden rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-foreground lg:inline-flex"
                aria-label="Expand chat history"
                title="Expand chat history"
              >
                <PanelLeftOpen className="size-4" />
              </button>
            )}
            <div>
              <h1 className="text-sm font-semibold tracking-tight">Assistant</h1>
              <p className="text-[11px] text-faint">{cliId ? "Ready" : "No AI tool configured"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={resetChat}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-2 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 lg:hidden"
          >
            <Plus className="size-3.5" />
            New chat
          </button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-5 py-10 sm:px-8 sm:py-14">
            {!hasConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center pb-12 text-center">
                <div className="mb-7 flex size-28 items-center justify-center rounded-full border border-border bg-surface/60 shadow-sm">
                  <ThinkingOrb state="breathing" size={64} aria-label="Assistant is listening" />
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-brand-text">career-ops assistant</p>
                <h2 className="mt-3 max-w-xl font-display text-4xl tracking-tight text-landing sm:text-5xl">
                  What can I help you move forward?
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-muted">
                  Ask about your pipeline, evaluate a role, improve your CV, or let&apos;s decide what deserves your attention today.
                </p>
              </div>
            ) : (
              <div className="space-y-8 pb-8">
                {messages.map((message, index) => {
                  const visible = message.parts.some((part) => (part.type === "text" && part.text.trim()) || part.type !== "text");
                  const isLast = index === messages.length - 1;
                  return (
                    <div key={index} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[min(100%,42rem)]", message.role === "user" && "rounded-2xl bg-brand px-4 py-3 text-brand-foreground")}>
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap text-sm leading-6">{message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")}</p>
                        ) : !visible && busy && isLast ? (
                          <ThinkingStatus progress={progress} />
                        ) : (
                          <div className="space-y-3">
                            {message.parts.map((part, partIndex) => (
                              <PartView key={partIndex} part={part} jobs={jobs} onConfirm={resolveConfirm} onAction={runAction} onPrompt={send} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-3xl px-5 pb-5 sm:px-8 sm:pb-8">
        {cliId && !busy && suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => send(suggestion.send)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/40 hover:bg-brand-soft hover:text-brand"
              >
                <Sparkles className="size-3 text-brand/70" />
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        {!cliId && (
          <Link
            href="/config"
            className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-3 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Settings className="size-3.5" />
            Connect an AI tool in Config to enable replies
            <ArrowUpRight className="ml-auto size-3.5" />
          </Link>
        )}

        <PromptBar
          value={input}
          onChange={setInput}
          onSend={(text) => send(text)}
          disabled={!cliId}
          busy={busy}
          placeholder={cliId ? "Ask anything…" : "Connect an AI tool first"}
          cliId={cliId}
          clis={clis}
          clisPinned={clisPinned}
          onCliChange={selectCli}
        />
        </div>
      </section>
    </div>
  );
}
