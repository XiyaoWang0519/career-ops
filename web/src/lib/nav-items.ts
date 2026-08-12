import { LayoutDashboard, Compass, ListChecks, Send, Radar, BarChart3, FileText, Settings, Activity, MessageCircle } from "lucide-react";
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
  group: "Work" | "Manage" | "Learn" | "System";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: LayoutDashboard, group: "Work" },
  { href: "/explore", label: "Find roles", icon: Compass, chip: "New", group: "Work" },
  { href: "/pipeline", label: "Opportunities", icon: ListChecks, group: "Work" },
  { href: "/followups", label: "Conversations", icon: Send, group: "Manage" },
  { href: "/jobs", label: "Activity", icon: Activity, group: "Manage" },
  { href: "/chat", label: "Assistant", icon: MessageCircle, group: "Manage" },
  { href: "/analytics", label: "Insights", icon: BarChart3, group: "Learn" },
  { href: "/cv", label: "Career profile", icon: FileText, group: "Learn" },
  { href: "/portals", label: "Sources", icon: Radar, advanced: true, group: "System" },
  { href: "/config", label: "Settings", icon: Settings, advanced: true, group: "System" },
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
