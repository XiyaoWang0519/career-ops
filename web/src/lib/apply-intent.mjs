/**
 * Return the explicit URL from a direct "apply to <url>" chat request.
 * Keep this intentionally narrow: ordinary discussion about applying should
 * still go through the assistant, while a concrete command can open the safe
 * browser handoff without spending an AI turn.
 * @param {string} text
 * @returns {string}
 */
export function explicitApplyUrl(text) {
  const match = (text || "").trim().match(/^apply(?:\s+to)?\s+(https?:\/\/\S+)\s*[.!?]?$/i);
  if (!match) return "";
  const candidate = match[1].replace(/[),.;!?]+$/, "");
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}
