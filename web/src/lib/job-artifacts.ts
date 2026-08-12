/** Client/server TypeScript mirror of job-artifacts.mjs shapes. */

export type ReportArtifact = {
  type: "report";
  reportNum: string;
  reportFile: string;
  score: number | null;
  company?: string;
  role?: string;
};

export type CvPdfArtifact = {
  type: "cv-pdf";
  reportNum: string;
  company: string;
  href: string;
};

export type PortalFixArtifact = {
  type: "portal-fix";
  company: string;
  status: "live" | "unverified";
};

export type ResearchArtifact = {
  type: "research";
  summary: string;
  score: number | null;
};

/** Future / reserved artifact shapes for the output registry. */
export type DocumentDraftArtifact = {
  type: "document-draft";
  title: string;
  markdown: string;
  pdfHref?: string;
};

export type PrepDocArtifact = {
  type: "prep-doc";
  title: string;
  path: string;
  markdown?: string;
};

export type ListResultArtifact = {
  type: "list-result";
  label: string;
  count: number;
  samples?: string[];
};

export type TrackerDeltaArtifact = {
  type: "tracker-delta";
  reportNum: string;
  status: string;
  previousStatus?: string;
  archivePath?: string;
};

export type MessageDraftArtifact = {
  type: "message-draft";
  subject?: string;
  body: string;
};

export type AnalysisReportArtifact = {
  type: "analysis-report";
  title: string;
  path?: string;
  summary?: string;
};

export type JobArtifact =
  | ReportArtifact
  | CvPdfArtifact
  | PortalFixArtifact
  | ResearchArtifact
  | DocumentDraftArtifact
  | PrepDocArtifact
  | ListResultArtifact
  | TrackerDeltaArtifact
  | MessageDraftArtifact
  | AnalysisReportArtifact;
