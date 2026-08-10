/** Resolve which AI tool id the browser should send. Prefers a server-pinned
 *  default (CAREER_OPS_DEFAULT_CLI); otherwise the Config localStorage choice. */
export function resolveClientCliId(pinnedDefault: string | null | undefined): string | null {
  if (pinnedDefault) return pinnedDefault;
  try {
    const raw = localStorage.getItem("career-ops:config");
    return raw ? JSON.parse(raw).cliId || null : null;
  } catch {
    return null;
  }
}
