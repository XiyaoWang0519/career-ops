import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  artifactsForCvPdf,
  artifactsForEvaluation,
  artifactsForKind,
  artifactsForPortalFix,
  artifactsForResearch,
  companyLabelFromSlug,
  parseArtifactsFromLog,
  parseReportFilename,
  parseVerdictLine,
  portalLiveFromText,
  serializeArtifactsForLog,
} from "../../src/lib/job-artifacts.mjs";

describe("parseReportFilename", () => {
  it("parses numbered report filenames", () => {
    assert.deepEqual(parseReportFilename("007-viggle-ai-2026-08-12.md"), {
      reportNum: "007",
      companySlug: "viggle-ai",
    });
  });

  it("handles missing file", () => {
    assert.deepEqual(parseReportFilename(null), { reportNum: null, companySlug: null });
  });
});

describe("artifactsForEvaluation", () => {
  it("returns empty when no report", () => {
    assert.deepEqual(artifactsForEvaluation({ reportFile: null, score: null }), []);
  });

  it("builds a report artifact from persistence", () => {
    const arts = artifactsForEvaluation({
      reportFile: "007-viggle-ai-2026-08-12.md",
      score: 5,
      trackerRecorded: true,
    });
    assert.equal(arts.length, 1);
    assert.equal(arts[0].type, "report");
    assert.equal(arts[0].reportNum, "007");
    assert.equal(arts[0].score, 5);
    assert.equal(arts[0].company, "Viggle Ai");
  });
});

describe("artifactsForCvPdf", () => {
  it("builds href for company", () => {
    const arts = artifactsForCvPdf({ reportNum: "7", company: "Viggle AI" });
    assert.equal(arts[0].type, "cv-pdf");
    assert.equal(arts[0].href, "/api/cv-pdf?company=Viggle%20AI");
  });
});

describe("artifactsForKind", () => {
  it("builds portal-fix from input + verdict", () => {
    const arts = artifactsForKind({
      kind: "fix-portal",
      input: "Anthropic",
      text: "VERDICT: 5/5 — slug live on Greenhouse\n",
    });
    assert.equal(arts[0].type, "portal-fix");
    assert.equal(arts[0].status, "live");
  });

  it("builds research from verdict", () => {
    const arts = artifactsForKind({
      kind: "research",
      input: "https://example.com",
      text: "VERDICT: 4/5 — Strong portfolio signal\n",
    });
    assert.equal(arts[0].type, "research");
    assert.equal(arts[0].score, 4);
  });

  it("builds cv-pdf for pdf kind", () => {
    const arts = artifactsForKind({
      kind: "pdf",
      input: "018",
      pdfCompany: "Acme",
      pdfReportNum: "018",
    });
    assert.equal(arts[0].href, "/api/cv-pdf?company=Acme");
  });
});

describe("verdict helpers", () => {
  it("parseVerdictLine", () => {
    assert.deepEqual(parseVerdictLine("VERDICT: 3.5/5 — borderline fit"), {
      score: 3.5,
      summary: "borderline fit",
    });
  });

  it("portalLiveFromText", () => {
    assert.equal(portalLiveFromText("VERDICT: 5/5 — now live"), true);
    assert.equal(portalLiveFromText("VERDICT: 1/5 — no slug found"), false);
  });

  it("companyLabelFromSlug", () => {
    assert.equal(companyLabelFromSlug("viggle-ai"), "Viggle Ai");
  });

  it("artifactsForPortalFix / research direct", () => {
    assert.equal(artifactsForPortalFix("X", false)[0].status, "unverified");
    assert.equal(artifactsForResearch({ score: 2, summary: "weak" })[0].summary, "weak");
  });
});

describe("log serialize/parse", () => {
  it("round-trips artifacts in run markdown", () => {
    const arts = artifactsForEvaluation({
      reportFile: "001-acme-2026-01-01.md",
      score: 4,
    });
    const json = serializeArtifactsForLog(arts);
    const md = `- artifacts: ${json}\n`;
    const parsed = parseArtifactsFromLog(md);
    assert.deepEqual(parsed, arts);
  });

  it("returns undefined for missing artifacts line", () => {
    assert.equal(parseArtifactsFromLog("- kind: evaluate\n"), undefined);
  });
});
