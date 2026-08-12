import { pipelineSummary, doctorState, readReport } from "@/lib/career-ops";
import { OnboardingBanner } from "@/components/onboarding-banner";
import { FirstRunHome } from "@/components/home/first-run-home";
import { TodayDashboard } from "@/components/home/today-dashboard";
import { buildOpportunity } from "@/lib/opportunity";

export const dynamic = "force-dynamic"; // always read fresh local files at request time (never at build — CI has no user data)

export default function Home() {
  const { phase, onboardingNeeded } = doctorState();
  // First run (truly empty install): the CV-upload takeover IS the home — value
  // before commitment. The full dashboard returns once they have a CV or any data.
  if (phase === "first-run") return <FirstRunHome />;

  const { inbox, applications } = pipelineSummary();
  // Today only needs the actionable decision queue; avoid parsing/serializing the
  // user's entire tracker into a client component on every home request.
  const opportunities = applications
    .filter((app) => /^evaluat/i.test(app.status))
    .slice(0, 6)
    .map((app) => buildOpportunity(app, readReport(app.n)?.content));
  // Established / in-between: the dual-loop retention dashboard. Show the setup
  // banner whenever ANY prereq is missing (mirrors the core doctor.mjs), so a
  // portals-missing user is nudged rather than told "all caught up".
  return (
    <>
      {onboardingNeeded && <OnboardingBanner />}
      <TodayDashboard opportunities={opportunities} inbox={inbox} inBetween={phase === "in-between"} />
    </>
  );
}
