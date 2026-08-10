import { LayoutDashboard, Compass, ListChecks, Send, Radar, BarChart3, FileText, Settings, Activity } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Single source of truth for the app's primary destinations — shared by the
// desktop sidebar and the mobile nav so they can never drift.
export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  chip?: string;
  /** Hidden when CAREER_OPS_SIMPLE=1 (friend-ready trimmed nav). */
  advanced?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Compass, chip: "New" },
  { href: "/pipeline", label: "Pipeline", icon: ListChecks },
  { href: "/followups", label: "Follow-ups", icon: Send },
  { href: "/jobs", label: "Activity", icon: Activity },
  { href: "/portals", label: "Portals", icon: Radar, advanced: true },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/cv", label: "CV", icon: FileText },
  { href: "/config", label: "Config", icon: Settings, advanced: true },
];

/** Nav items visible for the current mode. `simple` hides advanced entries. */
export function visibleNavItems(simple: boolean): NavItem[] {
  if (!simple) return NAV_ITEMS;
  // Simple mode: Today · Explore · Pipeline · Follow-ups · Analytics · CV
  // (Activity stays — friends need to see what ran; Portals/Config hide.)
  return NAV_ITEMS.filter((i) => !i.advanced);
}

export function isActivePath(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
