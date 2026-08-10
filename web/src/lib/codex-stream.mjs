/**
 * Parse one line of `codex exec --json` JSONL into the web UI's NDJSON event
 * vocabulary: {type:"tool"|"text"|"status"|"error"|"tokens", ...}.
 *
 * Shared by /api/run and /api/assistant (and tested via node:test). Keep this
 * file dependency-free (.mjs) so tests don't need a TS transpile step.
 */

/**
 * @typedef {{ type: "tool", name: string }
 *   | { type: "text", text: string }
 *   | { type: "status", label: string }
 *   | { type: "error", msg: string }
 *   | { type: "tokens", tokens: number, costUsd?: number | null }} CodexUiEvent
 */

/**
 * Map a Codex item (from item.started / item.completed) to a short tool label.
 * @param {Record<string, unknown>} item
 * @returns {string | null}
 */
function toolLabel(item) {
  if (!item || typeof item !== "object") return null;
  const t = item.type;
  if (t === "command_execution") {
    const cmd = typeof item.command === "string" ? item.command : "";
    // Prefer the executable name ("node", "npm") over the full shell line.
    const bare = cmd.replace(/^bash\s+-lc\s+/, "").replace(/^['"]|['"]$/g, "");
    const first = bare.trim().split(/\s+/)[0] || "Bash";
    return first.length > 48 ? first.slice(0, 45) + "…" : first;
  }
  if (t === "file_change") return "Edit";
  if (t === "mcp_tool_call") {
    const name = typeof item.tool === "string" ? item.tool : typeof item.name === "string" ? item.name : "MCP";
    return name;
  }
  if (t === "web_search") return "WebSearch";
  if (t === "todo_list") return "Plan";
  return null;
}

/**
 * @param {string} line
 * @returns {CodexUiEvent[]}
 */
export function parseCodexLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return [];
  let ev;
  try {
    ev = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!ev || typeof ev !== "object" || typeof ev.type !== "string") return [];

  /** @type {CodexUiEvent[]} */
  const out = [];

  switch (ev.type) {
    case "thread.started":
      out.push({ type: "status", label: "Agent ready" });
      break;
    case "turn.started":
      // quiet — thread.started already signaled readiness
      break;
    case "item.started":
    case "item.updated": {
      const item = ev.item;
      const label = toolLabel(item);
      if (label) out.push({ type: "tool", name: label });
      // Some Codex builds stream agent_message text on updates.
      if (item?.type === "agent_message" && typeof item.text === "string" && item.text) {
        out.push({ type: "text", text: item.text });
      }
      break;
    }
    case "item.completed": {
      const item = ev.item;
      if (item?.type === "agent_message" && typeof item.text === "string" && item.text) {
        out.push({ type: "text", text: item.text });
      } else {
        const label = toolLabel(item);
        // Don't re-emit tools on completed if we already did on started — the
        // UI dedupes by appending steps; a completed-only item (file_change)
        // still needs a pill.
        if (label && ev.type === "item.completed" && item?.type === "file_change") {
          out.push({ type: "tool", name: label });
        }
      }
      break;
    }
    case "turn.completed": {
      const u = ev.usage || {};
      const tokens =
        (Number(u.input_tokens) || 0) +
        (Number(u.output_tokens) || 0) +
        (Number(u.cached_input_tokens) || 0) +
        (Number(u.reasoning_output_tokens) || 0);
      if (tokens > 0) out.push({ type: "tokens", tokens, costUsd: null });
      break;
    }
    case "turn.failed":
      out.push({
        type: "error",
        msg: String(ev.error?.message || ev.message || "Codex turn failed").slice(0, 200),
      });
      break;
    case "error":
      out.push({
        type: "error",
        msg: String(ev.message || ev.error?.message || "Codex error").slice(0, 200),
      });
      break;
    default:
      break;
  }
  return out;
}

/**
 * Extract assistant-visible text from a Codex JSONL line (for routes that
 * stream plain text, e.g. the chat assistant). Returns "" when the line is
 * not an agent message.
 * @param {string} line
 * @returns {string}
 */
export function codexTextDelta(line) {
  for (const ev of parseCodexLine(line)) {
    if (ev.type === "text") return ev.text;
  }
  return "";
}
