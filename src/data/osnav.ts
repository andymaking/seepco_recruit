/**
 * Talent OS navigation model — the Propflow-styled OS shell (route group `(os)`).
 * Pillars per PRD v2.0: Command · Manage · Grow · Recruit v2, plus Me.
 * Legacy Pillar-1 recruit screens keep the Hirebrew shell at `/` (stage ids in nav.ts).
 */

export type OsNavItem = {
  stage: string; label: string; icon: string; badge?: string;
  /**
   * Sub-pillar this item sits under. Kept as the semantic grouping of the Me
   * pillar even though the rail now carries every page directly.
   */
  group?: string;
  /**
   * Short name for when this item sits DIRECTLY on the 76px icon rail (a persona
   * scoped to one pillar gets every page on the rail rather than a panel). The
   * rail caption is 10px and centre-wrapped, so "My data & privacy" has to
   * become "Privacy" or it wraps to three lines and the icons stop lining up.
   */
  rail?: string;
  /** Recruit-workspace page in the `(app)` group — gated by persona.legacyAccess. */
  legacy?: boolean;
  /** Live count from the lifecycle store. */
  countKey?: "requisitions" | "roles" | "candidates";
  count?: string;
};
export type OsNavSection = { label: string; items: OsNavItem[] };

/** stage id → URL path for OS routes (merged into the global PATHS registry). */
export const OS_PATHS: Record<string, string> = {
  command: "/command",
  missioncontrol: "/mission-control",
  ask: "/ask",
  scenarios: "/scenarios",
  headcount: "/headcount",
  attrition: "/attrition",
  depthealth: "/dept-health",
  people: "/people",
  employee: "/employee",
  contracts: "/contracts",
  compliance: "/compliance",
  /** The two-path onboarding cockpit — `onboarding` is the legacy Stage-10 route. */
  onboardhub: "/onboarding-hub",
  offboarding: "/offboarding",
  manager: "/manager",
  goals: "/goals",
  reviews: "/reviews",
  oneonones: "/one-on-ones",
  feedbackhub: "/feedback-hub",
  growth: "/growth",
  learning: "/learning",
  retention: "/retention",
  mobility: "/mobility",
  skillsgraph: "/skills-graph",
  sourcingchat: "/sourcing-chat",
  talentlibrary: "/talent-library",
  sequences: "/sequences",
  agentfleet: "/agent-fleet",
  surveys: "/surveys",
  helpdesk: "/helpdesk",
  expenses: "/expenses",
  rewards: "/rewards",
  whosin: "/whos-in",
  myvoice: "/my-voice",
  myrequests: "/my-requests",
  myexpenses: "/my-expenses",
  myrewards: "/my-rewards",
  mycheckin: "/my-checkin",
  me: "/me",
  mygoals: "/my-goals",
  myoneonones: "/my-one-on-ones",
  myreview: "/my-review",
  myfeedback: "/my-feedback",
  mygrowth: "/my-growth",
  mylearning: "/my-learning",
  mymobility: "/my-mobility",
  myprofile: "/my-profile",
  myprivacy: "/my-privacy",
  mymobile: "/my-mobile",
  /* PRD v2.1 gap closure — FR-082-093 */
  workforce: "/workforce",
  certifications: "/certifications",
  sites: "/sites",
  attendance: "/attendance",
  letters: "/letters",
  confirmations: "/confirmations",
  cases: "/cases",
  trust: "/trust",
  aisurfaces: "/ai-surfaces",
  myleave: "/my-leave",
  myletters: "/my-letters",
  personas: "/personas",
};

/** Icon names are keys into the OS icon set (components/os/icons.tsx). */
export const OS_NAV: OsNavSection[] = [
  {
    label: "Command",
    items: [
      { stage: "command", label: "Command center", icon: "gauge" },
      { stage: "missioncontrol", label: "Mission control", icon: "orbit", badge: "LIVE" },
      { stage: "scenarios", label: "Scenario studio", icon: "flask" },
      { stage: "ask", label: "Ask anything", icon: "sparkle", badge: "⌘K" },
      { stage: "trust", label: "Trust center", icon: "shield", badge: "v2.1" },
      { stage: "aisurfaces", label: "AI surface audit", icon: "robot" },
    ],
  },
  // Pillars in the PRD's canonical order: Recruit. Manage. Grow.
  {
    label: "Recruit",
    items: [
      // The staging app's workspace userflow, 1:1 — lifecycle stages drill through.
      { stage: "dashboard", label: "Recruitment overview", icon: "house", legacy: true, group: "Workspace" },
      { group: "Workspace", stage: "requisitions", label: "Requisitions", icon: "clipboard", legacy: true, countKey: "requisitions" },
      { group: "Workspace", stage: "jobs", label: "Open roles", icon: "file", legacy: true, countKey: "roles" },
      { group: "Workspace", stage: "candidates", label: "Candidates", icon: "users", legacy: true, countKey: "candidates" },
      { group: "Workspace", stage: "calendar", label: "Calendar", icon: "calendar", legacy: true, count: "8" },
      { group: "Workspace", stage: "messages", label: "Messages", icon: "chat", legacy: true, count: "3" },
      { group: "Workspace", stage: "analytics", label: "Analytics", icon: "trend", legacy: true },
      { group: "Workspace", stage: "audit", label: "Audit log", icon: "shield", legacy: true },
      { group: "Workspace", stage: "dei", label: "Diversity & inclusion", icon: "heart", legacy: true },
      { group: "Workspace", stage: "qoh", label: "Quality-of-hire & retention", icon: "star", legacy: true },
      { group: "Workspace", stage: "integrations", label: "Integrations & access", icon: "swap", legacy: true },
      // Recruit v2 AI tools (OS modules)
      { group: "AI tools", stage: "sourcingchat", label: "AI sourcing", icon: "sparkle" },
      { group: "AI tools", stage: "talentlibrary", label: "Talent library", icon: "stack" },
      { group: "AI tools", stage: "sequences", label: "Sequences", icon: "paperplane" },
      { group: "AI tools", stage: "agentfleet", label: "Agent fleet", icon: "robot" },
    ],
  },
  {
    label: "Manage",
    items: [
      { group: "Workforce", stage: "people", label: "People", icon: "users" },
      { group: "Workforce", stage: "workforce", label: "Workforce & worker types", icon: "treemap", badge: "v2.1" },
      { group: "Workforce", stage: "certifications", label: "Certs & medicals", icon: "shield" },
      { group: "Workforce", stage: "sites", label: "Sites & rotations", icon: "orbit", badge: "v2.1" },
      { group: "Workforce", stage: "attendance", label: "Attendance signals", icon: "pulse" },
      // FR-098. Presence sits with the workforce, not with Grow: it answers
      // "who can I reach today", which is a roster question, not a growth one.
      { group: "Workforce", stage: "whosin", label: "Who's in today", icon: "house" },

      { group: "HR operations", stage: "letters", label: "HR letters", icon: "file", badge: "QR" },
      { group: "HR operations", stage: "confirmations", label: "Probation & confirmation", icon: "check" },
      { group: "HR operations", stage: "cases", label: "Queries & cases", icon: "clipboard" },
      // FR-095. Deliberately adjacent to `cases` in the rail and firewalled from
      // it in the data — a ticket is the employee asking, a case is HR issuing.
      { group: "HR operations", stage: "helpdesk", label: "Employee helpdesk", icon: "chat" },
      { group: "HR operations", stage: "surveys", label: "Engagement surveys", icon: "megaphone" },
      { group: "HR operations", stage: "expenses", label: "Expense claims", icon: "wallet" },
      { group: "HR operations", stage: "rewards", label: "Reward programme", icon: "star" },

      { group: "Intelligence", stage: "headcount", label: "Headcount & plan", icon: "treemap" },
      { group: "Intelligence", stage: "attrition", label: "Attrition & risk", icon: "pulse" },
      { group: "Intelligence", stage: "depthealth", label: "Department health", icon: "heart" },

      { group: "Records & lifecycle", stage: "contracts", label: "Contracts & docs", icon: "file" },
      { group: "Records & lifecycle", stage: "compliance", label: "Certs & compliance", icon: "shield" },
      { group: "Records & lifecycle", stage: "onboardhub", label: "Onboarding & rollout", icon: "arrowsq", badge: "2 PATHS" },
      { group: "Records & lifecycle", stage: "offboarding", label: "Offboarding & alumni", icon: "door" },
    ],
  },
  {
    label: "Grow",
    items: [
      { group: "My team", stage: "manager", label: "Manager home", icon: "house" },
      { group: "My team", stage: "goals", label: "Goals & OKRs", icon: "target" },
      { group: "My team", stage: "reviews", label: "Reviews", icon: "clipboard" },
      { group: "My team", stage: "oneonones", label: "1-on-1s", icon: "chat" },
      { group: "My team", stage: "feedbackhub", label: "Feedback", icon: "megaphone" },

      { group: "Development", stage: "growth", label: "Growth plans", icon: "trend" },
      { group: "Development", stage: "learning", label: "Learning hub", icon: "book" },
      { group: "Development", stage: "skillsgraph", label: "Skills graph", icon: "graph" },

      { group: "Retention & moves", stage: "retention", label: "Retention playbooks", icon: "lifebuoy" },
      { group: "Retention & moves", stage: "mobility", label: "Internal mobility", icon: "swap" },
    ],
  },
  /**
   * Me — the employee's own pillar. Until Aug 2026 this held ONE item, and that
   * item was a 375x740 phone mockup: the employee was the only persona in the
   * product with no web surface. These eleven are the web equivalents, and the
   * phone frame now lives on `mymobile` as what it always was — a preview of the
   * companion, not the product.
   */
  {
    label: "Me",
    items: [
      { group: "Day to day", stage: "me", rail: "Workspace", label: "My workspace", icon: "house" },
      { group: "Day to day", stage: "mygoals", rail: "Goals", label: "My goals", icon: "target" },
      { group: "Day to day", stage: "myoneonones", rail: "1-on-1s", label: "My 1-on-1s", icon: "chat" },
      { group: "Day to day", stage: "myleave", rail: "Leave", label: "My leave", icon: "calendar" },
      { group: "Day to day", stage: "mycheckin", rail: "Check-in", label: "My check-in", icon: "house" },
      { group: "Day to day", stage: "myexpenses", rail: "Expenses", label: "My expenses", icon: "wallet" },
      { group: "Day to day", stage: "myrequests", rail: "Requests", label: "My requests", icon: "chat" },
      { group: "Day to day", stage: "myvoice", rail: "Voice", label: "My voice", icon: "megaphone" },
      { group: "My record", stage: "myletters", rail: "Letters", label: "My letters", icon: "file" },
      { group: "My record", stage: "myrewards", rail: "Rewards", label: "My total rewards", icon: "star" },
      { group: "Growth", stage: "myreview", rail: "Review", label: "My review", icon: "clipboard" },
      { group: "Growth", stage: "myfeedback", rail: "Feedback", label: "My feedback", icon: "megaphone" },
      { group: "Growth", stage: "mygrowth", rail: "Growth", label: "My growth plan", icon: "trend" },
      { group: "Growth", stage: "mylearning", rail: "Learning", label: "My learning", icon: "book" },
      { group: "Growth", stage: "mymobility", rail: "Roles", label: "Internal roles", icon: "swap", badge: "OPT-IN" },
      { group: "My record", stage: "myprofile", rail: "Profile", label: "My profile", icon: "user" },
      { group: "My record", stage: "myprivacy", rail: "Privacy", label: "My data & privacy", icon: "shield" },
      { group: "My record", stage: "mymobile", rail: "Mobile", label: "Mobile companion", icon: "download" },
    ],
  },
];

/**
 * Icons for sub-pillars. When a persona is scoped to a SINGLE pillar the shell
 * promotes that pillar's groups to icon-rail entries, so a scoped persona still
 * gets the product's real double-rail shape (icons + labels, contextual panel)
 * instead of one lonely icon over a long flat list.
 */
export const SUBPILLAR_ICON: Record<string, string> = {
  "Day to day": "house",
  Growth: "trend",
  "My record": "user",
  Workspace: "clipboard",
  "AI tools": "sparkle",
};

/** Breadcrumb labels per OS stage. */
export const OS_TITLES: Record<string, [string, string]> = {
  command: ["Command", "Workforce overview"],
  missioncontrol: ["Command", "Mission control"],
  ask: ["Command", "Ask anything"],
  scenarios: ["Command", "Scenario studio"],
  people: ["Manage", "People directory"],
  headcount: ["Manage", "Headcount & plan"],
  attrition: ["Manage", "Attrition & risk"],
  depthealth: ["Manage", "Department health"],
  contracts: ["Manage", "Contracts & documents"],
  compliance: ["Manage", "Certifications & compliance"],
  onboardhub: ["Manage", "Onboarding & rollout"],
  offboarding: ["Manage", "Offboarding & alumni"],
  employee: ["Manage", "Employee record"],
  manager: ["Grow", "Manager home"],
  goals: ["Grow", "Goals & OKRs"],
  reviews: ["Grow", "Review cycles"],
  oneonones: ["Grow", "1-on-1s"],
  feedbackhub: ["Grow", "Feedback"],
  growth: ["Grow", "Growth plans"],
  learning: ["Grow", "Learning hub"],
  retention: ["Grow", "Retention playbooks"],
  mobility: ["Grow", "Internal mobility"],
  skillsgraph: ["Grow", "Skills graph"],
  sourcingchat: ["Recruit", "AI sourcing workspace"],
  talentlibrary: ["Recruit", "Talent library"],
  sequences: ["Recruit", "Outreach sequences"],
  agentfleet: ["Recruit", "Agent fleet"],
  workforce: ["Manage", "Workforce & worker types"],
  certifications: ["Manage", "Certifications & medicals"],
  sites: ["Manage", "Sites & rotations"],
  attendance: ["Manage", "Attendance signals"],
  letters: ["Manage", "HR letters"],
  confirmations: ["Manage", "Probation & confirmation"],
  cases: ["Manage", "Queries & disciplinary cases"],
  trust: ["Command", "Trust center"],
  aisurfaces: ["Command", "AI surface audit"],
  myleave: ["Me", "My leave"],
  myletters: ["Me", "My letters"],
  surveys: ["Manage", "Engagement surveys"],
  helpdesk: ["Manage", "Employee helpdesk"],
  expenses: ["Manage", "Expense claims"],
  rewards: ["Manage", "Reward programme"],
  whosin: ["Manage", "Who's in today"],
  myvoice: ["Me", "My voice"],
  myrequests: ["Me", "My requests"],
  myexpenses: ["Me", "My expenses"],
  myrewards: ["Me", "My total rewards"],
  mycheckin: ["Me", "My check-in"],
  me: ["Me", "My workspace"],
  mygoals: ["Me", "My goals & check-ins"],
  myoneonones: ["Me", "My 1-on-1s"],
  myreview: ["Me", "My review"],
  myfeedback: ["Me", "My feedback"],
  mygrowth: ["Me", "My growth plan"],
  mylearning: ["Me", "My learning"],
  mymobility: ["Me", "Internal roles"],
  myprofile: ["Me", "My profile & documents"],
  myprivacy: ["Me", "My data & privacy"],
  mymobile: ["Me", "Mobile companion"],
};
