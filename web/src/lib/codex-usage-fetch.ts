import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseCodexUsageResponse } from "./codex-usage.mjs";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

export type CodexAuthTokens = {
  accessToken: string;
  accountId: string | null;
};

export class CodexUsageError extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "CodexUsageError";
    this.status = status;
  }
}

/** Read ChatGPT OAuth tokens written by `codex login` (~/.codex/auth.json). */
export function readCodexAuth(codexHome = path.join(os.homedir(), ".codex")): CodexAuthTokens {
  const authPath = path.join(codexHome, "auth.json");
  let raw: string;
  try {
    raw = fs.readFileSync(authPath, "utf8");
  } catch {
    throw new CodexUsageError("Codex is not signed in — run `codex login` on this machine.");
  }
  let parsed: { tokens?: { access_token?: string; account_id?: string } };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CodexUsageError("Codex auth.json is invalid — run `codex login` again.");
  }
  const accessToken = parsed.tokens?.access_token?.trim() || "";
  if (!accessToken) {
    throw new CodexUsageError("Codex access token missing — run `codex login`.");
  }
  const accountId = parsed.tokens?.account_id?.trim() || null;
  return { accessToken, accountId };
}

/**
 * Fetch live Codex plan rate limits using the local Codex login.
 * Does not print or return the access token.
 */
export async function fetchCodexUsage(opts?: {
  codexHome?: string;
  fetchImpl?: typeof fetch;
  nowMs?: number;
}): Promise<ReturnType<typeof parseCodexUsageResponse>> {
  const { accessToken, accountId } = readCodexAuth(opts?.codexHome);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    // Match Codex CLI UA so the backend treats us like a first-party client.
    "User-Agent": "codex_cli_rs",
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  const fetchImpl = opts?.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(USAGE_URL, { headers, cache: "no-store" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CodexUsageError(`Could not reach Codex usage API: ${msg}`);
  }

  const bodyText = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new CodexUsageError("Codex login expired — run `codex login`.", res.status);
  }
  if (!res.ok) {
    throw new CodexUsageError(`Codex usage API returned HTTP ${res.status}.`, res.status);
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new CodexUsageError("Codex usage API returned non-JSON.");
  }
  if (!raw.rate_limit || typeof raw.rate_limit !== "object") {
    throw new CodexUsageError("Codex usage response missing rate_limit.");
  }
  return parseCodexUsageResponse(raw, { nowMs: opts?.nowMs });
}
