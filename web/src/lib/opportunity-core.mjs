const STATUS_ALIASES = {
  evaluada: "EVALUATED",
  evaluado: "EVALUATED",
  shortlisted: "PURSUING",
  pursue: "PURSUING",
  aplicada: "APPLIED",
  aplicado: "APPLIED",
  enviada: "APPLIED",
  sent: "APPLIED",
  respondida: "RESPONDED",
  respondido: "RESPONDED",
  entrevista: "INTERVIEW",
  oferta: "OFFER",
  rechazada: "REJECTED",
  rechazado: "REJECTED",
  descartada: "DISCARDED",
  descartado: "DISCARDED",
  monitor: "SKIP",
  no_aplicar: "SKIP",
  "no aplicar": "SKIP",
  contratado: "HIRED",
  contratada: "HIRED",
  accepted: "HIRED",
};

export const OPPORTUNITY_STAGES = [
  "Discover",
  "Review",
  "Evaluate",
  "Prepare",
  "Apply",
  "Follow up",
  "Interview",
  "Offer",
  "Outcome",
];

function canonicalStatus(status) {
  const key = String(status ?? "").trim().toLowerCase();
  return STATUS_ALIASES[key] ?? key.toUpperCase();
}

export function stageIndexForStatus(status) {
  const canonical = canonicalStatus(status);
  if (/HIRED|REJECTED|DISCARDED|SKIP/.test(canonical)) return 8;
  if (canonical.includes("OFFER")) return 7;
  if (canonical.includes("INTERVIEW")) return 6;
  if (canonical.includes("RESPONDED")) return 5;
  if (canonical.includes("APPLIED")) return 4;
  if (canonical.includes("PURSUING")) return 3;
  if (canonical.includes("EVALUATED")) return 2;
  return 1;
}

export function nextActionForOpportunity({ id, status, score, url, pdfReady }) {
  const canonical = canonicalStatus(status);
  if (canonical.includes("HIRED")) return { id: "celebrate", label: "Review the win", description: "Capture what worked and close the search loop." };
  if (/REJECTED|DISCARDED|SKIP/.test(canonical)) return { id: "closed", label: "Opportunity closed", description: "Review the activity timeline or record a learning." };
  if (canonical.includes("OFFER")) return { id: "offer-prep", label: "Review the offer", description: "Walk through terms, questions, and negotiation points." };
  if (canonical.includes("INTERVIEW")) return { id: "interview-prep", label: "Prepare for the interview", description: "Build a focused plan from this role and your story bank." };
  if (canonical.includes("RESPONDED")) return { id: "prepare-conversation", label: "Prepare for the conversation", description: "Research the team and line up your strongest stories." };
  if (canonical.includes("APPLIED")) return { id: "follow-up", label: "Plan the follow-up", description: "Keep the application warm without losing track of timing.", href: `/followups?app=${encodeURIComponent(id)}` };
  if (score != null && score < 4) return { id: "review", label: "Decide whether to continue", description: "This is below the apply line. Review the gaps before spending more time." };
  if (!pdfReady) return { id: "generate-pdf", label: "Tailor your CV", description: "Prepare the role-specific CV before opening the application." };
  if (url) return { id: "start-application", label: "Start the application", description: "Review every answer; career-ops never submits for you." };
  return { id: "review", label: "Review the evaluation", description: "The report has no application URL. Open the original posting or add its URL." };
}
