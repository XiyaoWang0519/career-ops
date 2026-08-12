import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Identify whether Codex is using metered API billing or a ChatGPT plan.
 * This deliberately returns only a label; auth secrets never leave the server.
 */
export function codexBillingMode({ env = process.env, codexHome = path.join(os.homedir(), ".codex") } = {}) {
  if (typeof env.OPENAI_API_KEY === "string" && env.OPENAI_API_KEY.trim()) return "metered";

  let auth;
  try {
    auth = JSON.parse(fs.readFileSync(path.join(codexHome, "auth.json"), "utf8"));
  } catch {
    return "unknown";
  }

  if (typeof auth?.OPENAI_API_KEY === "string" && auth.OPENAI_API_KEY.trim()) return "metered";
  if (typeof auth?.tokens?.access_token === "string" && auth.tokens.access_token.trim()) return "plan";
  return "unknown";
}
