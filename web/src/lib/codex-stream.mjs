/**
 * Parse one line of `codex exec --json` JSONL into the web UI's NDJSON event
 * vocabulary: {type:"tool"|"text"|"status"|"error"|"tokens", ...}.
 *
 * Shared by /api/run and /api/assistant (and tested via node:test). Keep this
 * file dependency-free (.mjs) so tests don't need a TS transpile step.
 */

/**
 * @typedef {{ type: "tool", id: string, name: string, family: "command"|"file_change"|"mcp"|"web_search"|"plan", detail?: string }
 *   | { type: "reasoning", id: string, text: string }
 *   | { type: "text", text: string, phase?: string }
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
    const bare = cmd
      .replace(/^(?:(?:\/bin\/)?(?:bash|zsh))\s+-lc\s+/, "")
      .replace(/^['"]|['"]$/g, "");
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

/** @param {Record<string, unknown>} item */
function toolFamily(item) {
  if (item?.type === "command_execution") return "command";
  if (item?.type === "file_change") return "file_change";
  if (item?.type === "mcp_tool_call") return "mcp";
  if (item?.type === "web_search") return "web_search";
  if (item?.type === "todo_list") return "plan";
  return null;
}

/**
 * Keep tool activity useful without sending a full structured payload (which
 * can contain large outputs or credentials) to the browser.
 * @param {Record<string, unknown>} item
 * @returns {string | undefined}
 */
function toolDetail(item) {
  let detail = "";
  if (item?.type === "command_execution" && typeof item.command === "string") detail = item.command;
  else if (item?.type === "web_search" && typeof item.query === "string") detail = item.query;
  else if (item?.type === "mcp_tool_call") {
    if (typeof item.server === "string" && typeof item.tool === "string") detail = `${item.server}.${item.tool}`;
    else if (typeof item.tool === "string") detail = item.tool;
  }
  const compact = detail.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  return compact.length > 180 ? `${compact.slice(0, 177)}…` : compact;
}

/**
 * Extract only model-provided reasoning summaries. Raw/encrypted reasoning is
 * intentionally ignored: the UI shows concise progress, never chain-of-thought.
 * @param {unknown} value
 * @returns {string}
 */
function summaryText(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(summaryText).filter(Boolean).join("\n").trim();
  if (!value || typeof value !== "object") return "";
  const record = /** @type {Record<string, unknown>} */ (value);
  return summaryText(record.text ?? record.summary_text ?? record.content);
}

/** @param {Record<string, unknown>} item */
function reasoningText(item) {
  if (item?.type === "agent_message" && item.phase === "commentary") {
    return typeof item.text === "string" ? item.text.trim() : "";
  }
  if (item?.type !== "reasoning") return "";
  return summaryText(item.summary ?? item.text ?? item.content);
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
      const family = toolFamily(item);
      if (label && family) {
        out.push({
          type: "tool",
          id: String(item?.id || `${item?.type || "tool"}:${label}`),
          name: label,
          family,
          ...(toolDetail(item) ? { detail: toolDetail(item) } : {}),
        });
      }
      const summary = reasoningText(item);
      if (summary) {
        out.push({ type: "reasoning", id: String(item?.id || `reasoning:${summary.slice(0, 32)}`), text: summary });
      }
      if (
        item?.type === "agent_message" &&
        item.phase !== "commentary" &&
        typeof item.text === "string" &&
        item.text
      ) {
        out.push({ type: "text", text: item.text, ...(typeof item.phase === "string" ? { phase: item.phase } : {}) });
      }
      break;
    }
    case "item.completed": {
      const item = ev.item;
      const summary = reasoningText(item);
      if (summary) {
        out.push({ type: "reasoning", id: String(item?.id || `reasoning:${summary.slice(0, 32)}`), text: summary });
      } else if (
        item?.type === "agent_message" &&
        item.phase !== "commentary" &&
        typeof item.text === "string" &&
        item.text
      ) {
        out.push({ type: "text", text: item.text, ...(typeof item.phase === "string" ? { phase: item.phase } : {}) });
      } else {
        const label = toolLabel(item);
        const family = toolFamily(item);
        // Don't re-emit tools on completed if we already did on started — the
        // UI dedupes by appending steps; a completed-only item (file_change)
        // still needs a pill.
        if (label && family && ev.type === "item.completed" && item?.type === "file_change") {
          out.push({
            type: "tool",
            id: String(item?.id || `${item?.type || "tool"}:${label}`),
            name: label,
            family,
            ...(toolDetail(item) ? { detail: toolDetail(item) } : {}),
          });
        }
      }
      break;
    }
    case "turn.completed": {
      const u = ev.usage || {};
      // Codex reports cached_input_tokens as a subset of input_tokens and
      // reasoning_output_tokens as a subset of output_tokens. Adding either
      // detail field again inflates the total. Prefer an explicit total when a
      // newer CLI supplies it; otherwise input + output is authoritative.
      const explicitTotal = Number(u.total_tokens) || 0;
      const tokens = explicitTotal || (Number(u.input_tokens) || 0) + (Number(u.output_tokens) || 0);
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

/**
 * Codex writes cache refreshes, plugin warmup failures, analytics failures, and
 * sampling retries to stderr even when the turn later succeeds. Only surface
 * stderr lines that require user action; structured turn failures arrive on
 * stdout and are handled by parseCodexLine().
 * @param {string} stderr
 * @returns {string}
 */
export function codexStderrSummary(stderr) {
  const clean = (stderr || "").replace(/\x1b\[[0-9;]*m/g, "");
  const lines = clean.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const actionable = lines.find((line) =>
    /error:\s+unexpected argument|not logged in|login required|authentication required|unauthorized|forbidden|rate limit|quota exceeded/i.test(line),
  );
  return actionable ? actionable.slice(0, 300) : "";
}

/**
 * Remove diagnostics that older web builds persisted inside assistant text.
 * This is intentionally applied only to assistant messages so a user can still
 * paste a Codex log into chat when asking for help with it.
 * @param {string} text
 * @returns {string}
 */
export function stripLegacyCodexDiagnostics(text) {
  if (!text || !text.includes("[Codex]")) return text || "";
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*\[Codex\]\s+/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
