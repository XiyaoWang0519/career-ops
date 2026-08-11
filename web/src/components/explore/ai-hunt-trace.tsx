"use client";

import { useMemo } from "react";
import { ThinkingTrace, type ThinkingStep } from "@/components/agent-ui/thinking-trace";
import type { ToolChipItem } from "@/components/agent-ui/tool-chips";
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

  const { steps, tools } = useMemo(() => {
    const stepsOut: ThinkingStep[] = [];
    const toolsOut: ToolChipItem[] = [];
    let i = 0;
    for (const chunk of trace) {
      if (chunk.kind === "tool") {
        const label = chunk.detail?.trim() || chunk.name || "Tool";
        const id = chunk.id || `tool-${i++}-${label}`;
        toolsOut.push({ id, label, status: "done" });
        stepsOut.push({ id, kind: chunk.family === "search" ? "search" : "tool", label, detail: chunk.name, done: true });
      } else if (chunk.kind === "reasoning") {
        const text = chunk.text.replace(/\s+/g, " ").trim().slice(0, 160);
        if (!text) continue;
        stepsOut.push({
          id: `reason-${i++}`,
          kind: "reasoning",
          label: text,
          done: true,
        });
      } else if (chunk.kind === "narration") {
        const text = chunk.text.replace(/\s+/g, " ").trim().slice(0, 120);
        if (!text) continue;
        stepsOut.push({
          id: `narr-${i++}`,
          kind: "search",
          label: text,
          done: true,
        });
      }
    }
    // Mark the last tool as running if hunt is still streaming (last chunk is tool/reasoning without terminal).
    if (toolsOut.length > 0) {
      const last = trace[trace.length - 1];
      if (last && (last.kind === "tool" || last.kind === "reasoning" || last.kind === "narration")) {
        toolsOut[toolsOut.length - 1] = { ...toolsOut[toolsOut.length - 1], status: "running" };
        const lastStep = stepsOut[stepsOut.length - 1];
        if (lastStep) lastStep.done = false;
      }
    }
    return { steps: stepsOut.slice(-12), tools: toolsOut.slice(-8) };
  }, [trace]);

  if (steps.length === 0 && tools.length === 0) {
    return (
      <div className="flex w-full max-w-2xl justify-center px-2">
        <ThinkingStatus progress={progress} />
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-2xl justify-center px-2">
      <ThinkingTrace progress={progress} steps={steps} tools={tools} defaultOpen={steps.length >= 2} />
    </div>
  );
}
