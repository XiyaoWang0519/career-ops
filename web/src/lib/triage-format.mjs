export const WEB_SHORTLIST_START = "<!-- career-ops:web-shortlist:start -->";
export const WEB_SHORTLIST_END = "<!-- career-ops:web-shortlist:end -->";
const ITEM = /^- \[ \] (https?:\/\/\S+) \| ([^|]*) \| (.*)$/;

function cleanCell(value) {
  return String(value ?? "").replace(/[|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function parseWebShortlist(md) {
  const start = md.indexOf(WEB_SHORTLIST_START);
  const end = md.indexOf(WEB_SHORTLIST_END, start + WEB_SHORTLIST_START.length);
  if (start < 0 || end < 0) return [];
  const seen = new Set();
  const items = [];
  for (const line of md.slice(start + WEB_SHORTLIST_START.length, end).split("\n")) {
    const match = line.trim().match(ITEM);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    items.push({ url: match[1], company: match[2].trim(), role: match[3].trim() });
  }
  return items;
}

export function updateWebShortlist(md, items) {
  const deduped = new Map();
  for (const item of items) {
    if (!item || !/^https?:\/\//i.test(String(item.url ?? ""))) continue;
    deduped.set(item.url, { url: item.url, company: cleanCell(item.company), role: cleanCell(item.role) });
  }
  const lines = [...deduped.values()].map((item) => `- [ ] ${item.url} | ${item.company} | ${item.role}`);
  const block = `${WEB_SHORTLIST_START}\n## Saved in the web app\n\n${lines.join("\n")}\n${WEB_SHORTLIST_END}`;
  const start = md.indexOf(WEB_SHORTLIST_START);
  const end = md.indexOf(WEB_SHORTLIST_END, start + WEB_SHORTLIST_START.length);
  if (start >= 0 && end >= 0) return `${md.slice(0, start).trimEnd()}\n\n${block}${md.slice(end + WEB_SHORTLIST_END.length)}`;
  return `${md.trimEnd()}\n\n${block}\n`;
}
