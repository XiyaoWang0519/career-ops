import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { outputWidgetsFor } from "../../src/components/jobs/output/registry.ts";

function job(partial) {
  return {
    id: "job-1",
    title: "Test",
    status: "done",
    steps: [],
    text: "",
    startedAt: 1,
    ...partial,
  };
}

describe("outputWidgetsFor", () => {
  it("shows building placeholder while running", () => {
    const specs = outputWidgetsFor(job({ status: "running", kind: "pdf" }));
    assert.deepEqual(specs, [{ widget: "building", kindLabel: "tailored CV" }]);
  });

  it("maps evaluate artifacts to a clickable scorecard only", () => {
    const specs = outputWidgetsFor(
      job({
        kind: "evaluate",
        result: { score: 5, summary: "Great fit", tone: "good" },
        artifacts: [
          {
            type: "report",
            reportNum: "007",
            reportFile: "007-viggle-ai-2026-08-12.md",
            score: 5,
            company: "Viggle AI",
          },
        ],
      }),
    );
    assert.equal(specs.length, 1);
    assert.equal(specs[0].widget, "scorecard");
    assert.equal(specs[0].href, "/pipeline/007");
    assert.equal(specs[0].reportNum, "007");
  });

  it("falls back to related application for evaluate scorecard", () => {
    const specs = outputWidgetsFor(job({ kind: "evaluate" }), {
      n: "12",
      date: "2026-01-01",
      company: "Acme",
      via: "",
      role: "Engineer",
      score: "4.2/5",
      status: "Evaluated",
      pdf: "❌",
      report: "[12](reports/12-acme.md)",
      notes: "solid",
    });
    assert.equal(specs.length, 1);
    assert.equal(specs[0].widget, "scorecard");
    assert.equal(specs[0].href, "/pipeline/12");
    assert.equal(specs[0].reportNum, "12");
  });

  it("maps pdf artifacts to cv-pdf widget", () => {
    const specs = outputWidgetsFor(
      job({
        kind: "pdf",
        artifacts: [
          {
            type: "cv-pdf",
            reportNum: "7",
            company: "Viggle AI",
            href: "/api/cv-pdf?company=Viggle%20AI",
          },
        ],
      }),
    );
    assert.equal(specs.length, 1);
    assert.equal(specs[0].widget, "cv-pdf");
  });

  it("maps fix-portal", () => {
    const specs = outputWidgetsFor(
      job({
        kind: "fix-portal",
        input: "Anthropic",
        artifacts: [{ type: "portal-fix", company: "Anthropic", status: "live" }],
      }),
    );
    assert.deepEqual(specs[0], { widget: "portal-fix", company: "Anthropic", status: "live" });
  });

  it("maps research", () => {
    const specs = outputWidgetsFor(
      job({
        kind: "research",
        text: "- Strong open-source signal across ML tooling\nVERDICT: 4/5 — useful proof\n",
        artifacts: [{ type: "research", summary: "useful proof", score: 4 }],
      }),
    );
    assert.equal(specs[0].widget, "research-notes");
    assert.equal(specs[0].score, 4);
  });

  it("unknown kind with no artifacts yields empty primary specs", () => {
    const specs = outputWidgetsFor(job({ kind: "mystery" }));
    assert.deepEqual(specs, []);
  });

  it("future cover kind surfaces document-draft artifact", () => {
    const specs = outputWidgetsFor(
      job({
        kind: "cover",
        artifacts: [
          {
            type: "document-draft",
            title: "Cover letter",
            markdown: "Dear hiring manager…",
          },
        ],
      }),
    );
    assert.equal(specs[0].widget, "document-draft");
  });
});
