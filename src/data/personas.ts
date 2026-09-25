/**
 * Persona model — PRD §3 (one platform, five entry points) + FR-077 role-aware
 * access. Each persona gets a home surface, a scoped nav, and hard route gates.
 * "Top-tier management" (executive) sees the full suite; everyone else sees
 * only their workspace. A candidate never touches the OS at all.
 */

export type PersonaId = "executive" | "hr" | "manager" | "employee" | "candidate" | "sysadmin";

export type Persona = {
  id: PersonaId;
  name: string;
  init: string;
  tone: string; // accent hex
  title: string; // role title shown under the name
  label: string; // workspace label (chip in shell)
  icon: string; // os icon name
  home: string; // stage id of their home surface
  homeLabel: string;
  tagline: string;
  sees: string[]; // what this persona comes to do (PRD §3 table)
  /** OS stages this persona may open. "all" = full suite. */
  osStages: "all" | string[];
  /** May open the legacy Pillar-1 recruit workspace (the `(app)` group)? */
  legacyAccess: boolean;
  /** Pillar footprint chips shown on the hub card. */
  pillars: { label: string; on: boolean }[];
};

export const PERSONAS: Persona[] = [
  {
    id: "executive",
    name: "Folake Coker",
    init: "FC",
    tone: "#AF52DE",
    title: "Group CHRO",
    label: "EXECUTIVE",
    icon: "gauge",
    home: "command",
    homeLabel: "Workforce command",
    tagline: "Run the workforce",
    sees: [
      "Headcount, cost vs budget, attrition vs benchmark",
      "Department health & the AI anomaly feed",
      "Ask questions in plain language, export the answer",
      "Full suite visibility — every pillar, every loop",
    ],
    osStages: "all",
    legacyAccess: true,
    pillars: [
      { label: "Command", on: true }, { label: "Manage", on: true },
      { label: "Grow", on: true }, { label: "Recruit", on: true }, { label: "Me", on: true },
    ],
  },
  {
    id: "hr",
    name: "Samuel Omosehin",
    init: "SO",
    tone: "#007AFF",
    title: "Talent Lead",
    label: "HR · RECRUITER",
    icon: "users",
    home: "dashboard",
    homeLabel: "Recruit workspace",
    tagline: "Hire end-to-end",
    sees: [
      "Run searches, review AI shortlists, manage pipelines",
      "Sequences, agents and the 11-stage lifecycle",
      "Keep requisitions, contracts & compliance current",
      "People records, offboarding and the talent library",
    ],
    osStages: [
      "people", "headcount", "attrition", "depthealth", "contracts", "compliance",
      // HRIS import and claim-invite sends are HR territory; the manager's
      // onboarding surface is Manager home, so `manager` deliberately omits this.
      "onboardhub",
      "offboarding", "employee", "sourcingchat", "talentlibrary", "sequences",
      "agentfleet", "ask", "me",
      /**
       * PRD v2.1. The workforce spine, the HR rituals and the procurement armor
       * are all talent-operations territory. `cases` is the most sensitive
       * surface the platform holds — FR-088 restricts it to HR and the concerned
       * line of management, which is why `manager` below gets it and no one else.
       */
      "workforce", "certifications", "sites", "attendance",
      "letters", "confirmations", "cases", "trust", "aisurfaces",
      /**
       * FR-094-098. People Ops owns the instrument, the service desk, the
       * reward programme and the claim queue. `whosin` is shared with the line
       * manager below — it answers "who can I reach", which both need.
       */
      "surveys", "helpdesk", "expenses", "rewards", "whosin",
    ],
    legacyAccess: true,
    pillars: [
      { label: "Command", on: false }, { label: "Manage", on: true },
      { label: "Grow", on: false }, { label: "Recruit", on: true }, { label: "Me", on: true },
    ],
  },
  {
    id: "manager",
    name: "Ngozi Adeyemi",
    init: "NA",
    tone: "#16B364",
    title: "Engineering Manager",
    label: "LINE MANAGER",
    icon: "house",
    home: "manager",
    homeLabel: "Manager home",
    tagline: "Grow the team",
    sees: [
      "Attention items: overdue actions, reviews due, goals behind",
      "Today's 1-on-1s with AI-prepared agendas",
      "Team OKRs, review completion, growth plans",
      "Retention playbooks & internal mobility for your team",
    ],
    osStages: [
      "manager", "goals", "reviews", "oneonones", "feedbackhub", "growth",
      "retention", "mobility", "skillsgraph", "people", "employee", "ask", "me",
      /**
       * PRD v2.1, scoped to "your team": a manager confirms their own reports
       * (FR-087), needs their crew's rotations to schedule anything (FR-090) and
       * their site-readiness (FR-083), and is the "concerned line of management"
       * FR-088 admits to a case. They do NOT get `workforce`, `attendance` or
       * `letters` — org-wide reporting, a permissioned signal surface, and an
       * HR issuing queue respectively.
       */
      "confirmations", "sites", "certifications", "cases",
      /**
       * FR-096/098. A manager approves their team's claims and needs to know who
       * is reachable today. They do NOT get `surveys` (the instrument and its
       * action loop are HR's, and a manager reading raw slices is exactly the
       * re-identification risk MIN_REPORTING_N exists to stop), nor `rewards`
       * (band and programme design are HR's), nor `helpdesk` (an employee asking
       * HR a question is not their manager's business by default).
       */
      "expenses", "whosin",
    ],
    legacyAccess: false,
    pillars: [
      { label: "Command", on: false }, { label: "Manage", on: false },
      { label: "Grow", on: true }, { label: "Recruit", on: false }, { label: "Me", on: true },
    ],
  },
  {
    id: "employee",
    name: "Amara Okonkwo",
    init: "AO",
    tone: "#EBA308",
    title: "Senior Software Engineer",
    label: "EMPLOYEE",
    icon: "user",
    home: "me",
    homeLabel: "My workspace",
    tagline: "Own your growth",
    sees: [
      "Profile, goals, reviews, feedback & growth plan",
      "Learning — courses and coaching, never out of pocket",
      "Opt-in internal mobility: see open roles first",
      "WhatsApp nudges deep-link in · works on low bandwidth",
    ],
    /**
     * `mobility` is deliberately ABSENT. It was one of only two stages this
     * persona could open, and it is a recruiter surface: it rendered Amara her
     * own leave-risk score (78, with its reasons), two colleagues' match
     * breakdowns, and a third person's internal application annotated "manager
     * sees it only after acceptance". `mymobility` is the subject-side
     * replacement — same roles, scored for her, nobody else on the page.
     */
    osStages: [
      "me", "mygoals", "myoneonones", "myleave", "myreview", "myfeedback",
      "mygrowth", "mylearning", "mymobility", "myprofile", "myletters", "myprivacy", "mymobile",
      /** FR-094-098, subject side: answer a survey, ask HR, claim, see her rewards, check in. */
      "myvoice", "myrequests", "myexpenses", "myrewards", "mycheckin",
    ],
    legacyAccess: false,
    pillars: [
      { label: "Command", on: false }, { label: "Manage", on: false },
      { label: "Grow", on: false }, { label: "Recruit", on: false }, { label: "Me", on: true },
    ],
  },
  {
    id: "candidate",
    name: "Chidinma Eke",
    init: "CE",
    tone: "#E81E17",
    title: "Applicant · Senior Product Designer",
    label: "CANDIDATE",
    icon: "paperplane",
    home: "cportal",
    homeLabel: "Application portal",
    tagline: "Apply & track, transparently",
    sees: [
      "Apply with CV + a 2-minute video",
      "Track status through every stage",
      "Request an explanation of any AI decision (NDPR right)",
      "No access to the employer suite — ever",
    ],
    /** PRD v2.1: the compliance evidence pack and the AI surface audit are platform-level. */
    osStages: ["trust", "aisurfaces"],
    legacyAccess: false,
    pillars: [
      { label: "Command", on: false }, { label: "Manage", on: false },
      { label: "Grow", on: false }, { label: "Recruit", on: false }, { label: "Me", on: false },
    ],
  },
  {
    id: "sysadmin",
    name: "Emeka Obi",
    init: "EO",
    tone: "#475569",
    title: "Platform Administrator",
    label: "SYSTEM ADMIN",
    icon: "gear",
    home: "aportal",
    homeLabel: "Admin console",
    tagline: "Govern the platform",
    sees: [
      "Tenants, users, RBAC & field-level permissions",
      "Assessment / interview configuration",
      "Audit logs — every model run, every access",
      "System role — not a talent persona (PRD +1)",
    ],
    /** PRD v2.1: the compliance evidence pack and the AI surface audit are platform-level. */
    osStages: ["trust", "aisurfaces"],
    legacyAccess: false,
    pillars: [
      { label: "Command", on: false }, { label: "Manage", on: false },
      { label: "Grow", on: false }, { label: "Recruit", on: false }, { label: "Me", on: false },
    ],
  },
];

export const personaById = (id: PersonaId): Persona => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

/** May this persona open the given OS stage? */
/**
 * Self-service stages render ONE person's private record, so `osStages: "all"`
 * must not reach them — "all" means every module, not every person's private
 * data. Without this branch the executive persona could open /my-review and read
 * an unreleased self-assessment.
 *
 * `me` and `mymobile` stay open to the other personas as product previews: for
 * them the Me section simply renders two rows.
 */
export const ME_ONLY_STAGES = new Set([
  "mygoals", "myoneonones", "myleave", "myreview", "myfeedback", "mygrowth",
  "mylearning", "mymobility", "myprofile", "myletters", "myprivacy",
  /**
   * FR-094-098. These are the most sensitive additions the Me pillar has taken:
   * `myrewards` renders her actual salary and `myvoice` her survey answers, so
   * an osStages:"all" persona reaching either would be a serious leak, not a
   * cosmetic one. `mycheckin` carries her free-text note, which MANAGER_NOT_SHOWN
   * promises no manager ever sees.
   */
  "myvoice", "myrequests", "myexpenses", "myrewards", "mycheckin",
]);

export const canOpenOsStage = (p: Persona, stage: string): boolean =>
  ME_ONLY_STAGES.has(stage)
    ? p.id === "employee"
    : p.osStages === "all" || p.osStages.includes(stage);

/** Topbar scope line per persona (row-level security made visible, FR-059/077). */
export const SCOPE_LINE: Record<PersonaId, string> = {
  executive: "Scope: org-wide · 358 people",
  hr: "Scope: talent operations · all records",
  manager: "Scope: your team · 6 people",
  employee: "Scope: self",
  candidate: "Scope: your application",
  sysadmin: "Scope: platform",
};
