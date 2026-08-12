import assert from "node:assert/strict";
import test from "node:test";
import {
  filteredCount,
  normalizeScanFunnel,
  parseScannerOfferLine,
  parseScannerProgressLine,
  sourceScanProgress,
} from "../../src/lib/scan-progress.mjs";

const order = ["greenhouse", "lever", "ashby"];

test("scan progress starts at zero while sources are queued", () => {
  assert.deepEqual(
    sourceScanProgress(order, {
      greenhouse: { state: "queued" },
      lever: { state: "queued" },
      ashby: { state: "queued" },
    }),
    { percent: 0, sourceCount: 3, sourceNumber: 1, activeSource: "", done: 0, total: 0 },
  );
});

test("active source uses its actual scanned and total company counts", () => {
  assert.deepEqual(
    sourceScanProgress(order, {
      greenhouse: { state: "swept" },
      lever: { state: "active", done: 75, total: 150 },
      ashby: { state: "queued" },
    }),
    { percent: 50, sourceCount: 3, sourceNumber: 2, activeSource: "lever", done: 75, total: 150 },
  );
});

test("completed and noisy sources count as finished stages", () => {
  assert.equal(
    sourceScanProgress(order, {
      greenhouse: { state: "swept" },
      lever: { state: "noisy" },
      ashby: { state: "active", done: 30, total: 60 },
    }).percent,
    83,
  );
});

test("reported progress is clamped to one complete stage", () => {
  assert.deepEqual(
    sourceScanProgress(["lever"], { lever: { state: "active", done: 180, total: 150 } }),
    { percent: 100, sourceCount: 1, sourceNumber: 1, activeSource: "lever", done: 150, total: 150 },
  );
});

test("structured scanner progress exposes the live filter funnel", () => {
  const event = parseScannerProgressLine(
    '@@career-ops-progress {"ats":"ashby","scanned":42,"total":150,"matches":3,"funnel":{"postingsChecked":810,"filteredTitle":700,"filteredLocation":52,"filteredDate":20,"filteredSeen":35,"selected":3}}',
  );
  assert.deepEqual(event, {
    ats: "ashby",
    scanned: 42,
    total: 150,
    matches: 3,
    funnel: {
      postingsChecked: 810,
      filteredTitle: 700,
      filteredLocation: 52,
      filteredDate: 20,
      filteredContent: 0,
      filteredSeen: 35,
      filteredInvalid: 0,
      filteredBlacklist: 0,
      selected: 3,
    },
  });
  assert.equal(filteredCount(event.funnel), 807);
});

test("malformed progress lines are ignored and counters are clamped", () => {
  assert.equal(parseScannerProgressLine("ordinary scanner output"), null);
  assert.equal(parseScannerProgressLine("@@career-ops-progress nope"), null);
  assert.deepEqual(normalizeScanFunnel({ postingsChecked: -2, selected: "4" }), {
    postingsChecked: 0,
    filteredTitle: 0,
    filteredLocation: 0,
    filteredDate: 0,
    filteredContent: 0,
    filteredSeen: 0,
    filteredInvalid: 0,
    filteredBlacklist: 0,
    selected: 4,
  });
});

test("selected offers can be recovered before the terminal scanner summary", () => {
  assert.deepEqual(
    parseScannerOfferLine(
      '@@career-ops-offer {"company":"Acme","title":"ML Engineer","url":"https://jobs.example/acme/1","location":"Toronto","postedAt":"2026-08-11","source":"ashby-full","dateStatus":"dated"}',
    ),
    {
      company: "Acme",
      title: "ML Engineer",
      url: "https://jobs.example/acme/1",
      location: "Toronto",
      postedAt: "2026-08-11",
      source: "ashby-full",
      dateStatus: "dated",
    },
  );
  assert.equal(parseScannerOfferLine("@@career-ops-offer nope"), null);
  assert.equal(parseScannerOfferLine('@@career-ops-offer {"company":"Acme","title":"ML Engineer","url":"javascript:bad"}'), null);
});
