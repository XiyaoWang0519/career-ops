import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWebShortlist, updateWebShortlist } from "../../src/lib/triage-format.mjs";

test("web shortlist is durable markdown that the CLI can read", () => {
  const source = "# Job Shortlist\n\n## Worth a look\n\n- Existing automation note\n";
  const next = updateWebShortlist(source, [
    { url: "https://example.com/1", company: "Acme", role: "Staff Engineer" },
    { url: "https://example.com/1", company: "Acme duplicate", role: "Duplicate" },
    { url: "javascript:alert(1)", company: "Bad", role: "Bad" },
  ]);
  assert.match(next, /Existing automation note/);
  assert.deepEqual(parseWebShortlist(next), [{ url: "https://example.com/1", company: "Acme duplicate", role: "Duplicate" }]);
});

test("updating the web block preserves human and automation-owned sections", () => {
  const first = updateWebShortlist("# Job Shortlist\n", [{ url: "https://example.com/1", company: "Acme", role: "Engineer" }]);
  const second = updateWebShortlist(`${first}\n## Maybe\n- Keep me\n`, [{ url: "https://example.com/2", company: "Beta | Inc", role: "Lead\nEngineer" }]);
  assert.match(second, /## Maybe\n- Keep me/);
  assert.deepEqual(parseWebShortlist(second), [{ url: "https://example.com/2", company: "Beta Inc", role: "Lead Engineer" }]);
  assert.equal((second.match(/career-ops:web-shortlist:start/g) ?? []).length, 1);
});
