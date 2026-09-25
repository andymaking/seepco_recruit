/**
 * Navigation model + route registry — the single source of truth for the
 * sidebar and routing. `stage` is the design's internal screen id; `path` is
 * the URL segment we expose (matches the App Router folder names).
 */

export type NavItem = {
  stage: string;
  num: string; // glyph icon, or "—"/"01".."11" for stage rows
  size: 13 | 17; // mono size: stage numbers are 13px, glyph icons are 17px
  label: string;
  count: string;
  badge?: "blue"; // messages uses a white-on-blue count badge
};

/** The 12-row lifecycle list: dashboard + 11 numbered stages. */
export const STAGES: NavItem[] = [
  { stage: "dashboard", num: "—", size: 13, label: "Dashboard", count: "" },
  { stage: "planning", num: "01", size: 13, label: "Workforce Planning", count: "3" },
  { stage: "role", num: "02", size: 13, label: "Role Definition", count: "" },
  { stage: "sourcing", num: "03", size: 13, label: "Sourcing", count: "128" },
  { stage: "screening", num: "04", size: 13, label: "Screening", count: "47" },
  { stage: "assessment", num: "05", size: 13, label: "Assessment", count: "12" },
  { stage: "interview", num: "06", size: 13, label: "Interviewing", count: "6" },
  { stage: "selection", num: "07", size: 13, label: "Selection", count: "3" },
  { stage: "reference", num: "08", size: 13, label: "Reference & BG", count: "2" },
  { stage: "offer", num: "09", size: 13, label: "Offer", count: "1" },
  { stage: "onboarding", num: "10", size: 13, label: "Onboarding", count: "1" },
  { stage: "posthire", num: "11", size: 13, label: "Post-Hire", count: "4" },
];

/**
 * The sidebar — a single flat WORKSPACE list, replicating the live staging app
 * (seepco-hr-frontend-staging) exactly: no lifecycle group in the nav; the 11
 * stage pages remain drill-through routes reached from the dashboard funnel
 * and in-flow CTAs.
 */
export const WORKSPACE: NavItem[] = [
  STAGES[0], // Dashboard
  { stage: "requisitions", num: "▦", size: 17, label: "Requisitions", count: "10" },
  { stage: "jobs", num: "▤", size: 17, label: "Open roles", count: "10" },
  { stage: "candidates", num: "◍", size: 17, label: "Candidates", count: "214" },
  { stage: "calendar", num: "▦", size: 17, label: "Calendar", count: "8" },
  { stage: "messages", num: "✉", size: 17, label: "Messages", count: "3", badge: "blue" },
  { stage: "analytics", num: "▥", size: 17, label: "Analytics", count: "" },
  { stage: "audit", num: "⛉", size: 17, label: "Audit log", count: "" },
  { stage: "dei", num: "◓", size: 17, label: "Diversity & inclusion", count: "" },
  { stage: "qoh", num: "★", size: 17, label: "Quality-of-hire & retention", count: "" },
  { stage: "integrations", num: "⚯", size: 17, label: "Integrations & access", count: "" },
  // Settings deliberately absent — it's a platform-level section (Talent OS shell).
];

/** The 11 numbered lifecycle stages (drill-through routes; tab strip in-page). */
export const LIFECYCLE: NavItem[] = STAGES.slice(1);

import { OS_PATHS } from "./osnav";

/** stage id → URL path (must match the App Router folder structure). */
export const PATHS: Record<string, string> = {
  ...OS_PATHS,
  /** FR-086: the PUBLIC QR resolution page. Scanned by a bank or an embassy — no persona, no chrome. */
  verify: "/verify",
  dashboard: "/",
  planning: "/planning",
  role: "/role",
  sourcing: "/sourcing",
  screening: "/screening",
  assessment: "/assessment",
  interview: "/interview",
  selection: "/selection",
  reference: "/reference",
  offer: "/offer",
  onboarding: "/onboarding",
  posthire: "/posthire",
  // Workspace verification, seats and pillars — the recruiter activation
  // checklist's first and last steps (verify, invite) route here by stage id.
  activation: "/workspace-activation",
  requisitions: "/requisitions",
  jobs: "/jobs",
  candidates: "/candidates",
  calendar: "/calendar",
  messages: "/messages",
  analytics: "/analytics",
  audit: "/audit",
  dei: "/dei",
  qoh: "/qoh",
  integrations: "/integrations",
  settings: "/settings",
  shortlist: "/shortlist",
  schedule: "/schedule",
  profile: "/profile",
  newrole: "/new-role",
  notifications: "/notifications",
  search: "/search",
  offerletter: "/offer-letter",
  assesstake: "/assessment-take",
  processing: "/processing",
  signin: "/signin",
  cportal: "/candidate-portal",
  aportal: "/admin-portal",
  portal: "/candidate-portal", // legacy alias
  // Employee onboarding, Path B — the existing workforce claims the account HR
  // imported. Standalone like the candidate portal: no persona, no shell.
  claim: "/claim",
  // Employee onboarding, Path A — the new hire's own surface, offer-signed to
  // day 90. Standalone for the same reason: the hire has no account (and so no
  // persona) until day one creates one. Not an OS stage — nothing in osnav.ts.
  welcome: "/welcome",
};

/** Stages that render WITHOUT the app chrome (sidebar / topbar / copilot). */
export const NO_CHROME = new Set(["signin", "cportal", "aportal", "portal", "claim", "welcome", "verify"]);

/**
 * The same standalone surfaces, as paths. The chrome mounted globally in
 * providers.tsx — the onboarding guide, the sandbox bar — matches against this
 * instead of keeping its own list, so registering a stage in NO_CHROME above is
 * the whole of what a new standalone surface needs to stay free of
 * persona-scoped chrome. Their audiences (a candidate, a new hire on a token
 * link, an imported employee) have no persona at all, so persona-scoped chrome
 * is not merely noise on those routes — it is addressed to the wrong person.
 */
export const NO_CHROME_PATHS: readonly string[] = [
  ...new Set([...NO_CHROME].map((stage) => PATHS[stage]).filter(Boolean)),
];

export const pathFor = (stage: string): string => PATHS[stage] ?? "/";

const PATH_TO_STAGE: Record<string, string> = Object.fromEntries(
  Object.entries(PATHS).map(([stage, path]) => [path, stage]),
);
export const stageForPath = (path: string): string => PATH_TO_STAGE[path] ?? "dashboard";
