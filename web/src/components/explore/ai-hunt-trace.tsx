"use client";

import { useMemo } from "react";
import { ThinkingStatus, type AssistantProgress } from "@/components/assistant/thinking-status";
import { assistantProgressForReasoning, assistantProgressForTool } from "@/lib/assistant-progress.mjs";
import type { AiTraceChunk } from "@/lib/explore-ai";

const INITIAL_PROGRESS: AssistantProgress = {
  category: "WEB SEARCH",
  text: "Preparing the open-web search…",
  orb: "searching",
};

export function AiHuntTrace({ trace }: { trace: AiTraceChunk[] }) {
  const progress = useMemo<AssistantProgress>(() => {
    const structured = [...trace].reverse().find((chunk) => chunk.kind === "tool" || chunk.kind === "reasoning");
    if (structured?.kind === "tool") {
      return assistantProgressForTool(structured) as AssistantProgress;
    }
    if (structured?.kind === "reasoning") {
      return assistantProgressForReasoning(structured.text) as AssistantProgress;
    }

    const narration = trace
      .filter((chunk): chunk is Extract<AiTraceChunk, { kind: "narration" }> => chunk.kind === "narration")
      .map((chunk) => chunk.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    return narration
      ? (assistantProgressForReasoning(narration) as AssistantProgress)
      : INITIAL_PROGRESS;
  }, [trace]);

  return (
    <div className="flex w-full max-w-2xl justify-center px-2">
      <ThinkingStatus progress={progress} />
    </div>
  );
}
