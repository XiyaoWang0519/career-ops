import { test } from "node:test";
import assert from "node:assert/strict";
import { nextActionForOpportunity, stageIndexForStatus } from "../../src/lib/opportunity-core.mjs";

test("canonical lifecycle statuses map onto one opportunity journey", () => {
  assert.equal(stageIndexForStatus("Evaluated"), 2);
  assert.equal(stageIndexForStatus("Pursuing"), 3);
  assert.equal(stageIndexForStatus("Applied"), 4);
  assert.equal(stageIndexForStatus("Responded"), 5);
  assert.equal(stageIndexForStatus("Interview"), 6);
  assert.equal(stageIndexForStatus("Offer"), 7);
  assert.equal(stageIndexForStatus("Hired"), 8);
  assert.equal(stageIndexForStatus("rechazada"), 8);
});

test("evaluated opportunities expose the real next action instead of marking Applied", () => {
  assert.equal(nextActionForOpportunity({ id: "42", status: "Evaluated", score: 4.4, url: "https://example.com/job", pdfReady: false }).id, "generate-pdf");
  assert.equal(nextActionForOpportunity({ id: "42", status: "Evaluated", score: 4.4, url: "https://example.com/job", pdfReady: true }).id, "start-application");
  assert.equal(nextActionForOpportunity({ id: "42", status: "Evaluated", score: 3.6, url: "https://example.com/job", pdfReady: false }).id, "review");
});

test("pursuing is a truthful pre-submission state with the same preparation actions", () => {
  assert.equal(nextActionForOpportunity({ id: "42", status: "Pursuing", score: 4.4, url: "https://example.com/job", pdfReady: false }).id, "generate-pdf");
  assert.equal(nextActionForOpportunity({ id: "42", status: "Pursuing", score: 4.4, url: "https://example.com/job", pdfReady: true }).id, "start-application");
});

test("later statuses route to follow-up, interview, offer, and outcome work", () => {
  const base = { id: "7", score: 4.5, url: "https://example.com", pdfReady: true };
  assert.deepEqual(nextActionForOpportunity({ ...base, status: "Applied" }).href, "/followups?app=7");
  assert.equal(nextActionForOpportunity({ ...base, status: "Interview" }).id, "interview-prep");
  assert.equal(nextActionForOpportunity({ ...base, status: "Offer" }).id, "offer-prep");
  assert.equal(nextActionForOpportunity({ ...base, status: "Rejected" }).id, "closed");
});
