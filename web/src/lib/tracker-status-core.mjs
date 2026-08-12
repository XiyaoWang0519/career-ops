/**
 * Replace exactly one existing application's Status cell in tracker markdown.
 * Returns null when the row cannot be found or is malformed.
 */
export function replaceTrackerStatus(markdown, n, canonicalStatus) {
  const lines = String(markdown).split("\n");
  let statusIdx = 6;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((cell) => cell.trim().toLowerCase());
    const idx = cells.findIndex((cell) => cell === "status");
    if (idx > 0) {
      statusIdx = idx;
      break;
    }
    if (/^:?-{2,}:?$/.test(cells[1] ?? "")) break;
  }

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim().startsWith("|")) continue;
    const parts = lines[i].split("|");
    if (parts.length < 8 || parts[1].trim() !== String(n) || statusIdx >= parts.length - 1) continue;
    parts[statusIdx] = ` ${canonicalStatus} `;
    lines[i] = parts.join("|");
    return lines.join("\n");
  }
  return null;
}
