/**
 * Recruiter onboarding — the shared data contract.
 *
 * The clock this whole flow exists to beat: FIRST ROLE LIVE IN ~15 MINUTES,
 * FIRST AI SHORTLIST WITHIN 48 HOURS.
 *
 * Pure data + pure helpers. No React, no store, no imports from any screen.
 * Three surfaces read from here and none of them re-declare a person, a
 * number or a sentence:
 *   · WorkspaceActivation  — verification, seats, pillars
 *   · Requisitions / TalentLibrary / Processing / Tour — first role, backlog, sandbox
 *   · OnboardingGuide / Integrations / Analytics — checklist, connectors, the clock
 *
 * Every figure below is the app's own. The overnight run (47 screened → 12
 * shortlisted, 9 knocked out, finished 04:12) is told identically in
 * Dashboard, Screening, Shortlist, MissionControl, Notifications and
 * copilot.ts; the import result (212 imported · 14 duplicates merged ·
 * consent preserved) is TalentLibrary's own result card; 214 is the sidebar's
 * active-candidate count; 31h is Screening's time-to-shortlist stat; the
 * WhatsApp 78% / 26% pair is Sequences' channel comparison; the seat
 * permission lines are Integrations' roleCards, verbatim.
 */

import { pathFor } from "./nav";
import { OS_NAV } from "./osnav";
import { REQ_DEPARTMENTS, REQ_SENIORITY } from "./requisitions";
import { SKILL_CLUSTERS } from "./talentos";

/* -------------------------------------------------------------------------- */
/* 0 · Shared primitives                                                       */
/* -------------------------------------------------------------------------- */

/** Mirrors PfTone in components/os/ui.tsx so these values drop straight into PfBadge. */
export type SeatTone = "green" | "blue" | "purple" | "yellow" | "red" | "grey";

/** "Senior Product Designer" → "senior-product-designer". */
export const slug = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* -------------------------------------------------------------------------- */
/* 1 · Workspace + verification                                                */
/* -------------------------------------------------------------------------- */

export type VerificationState =
  | "unverified"
  | "domain_matched"
  | "cac_submitted"
  | "in_review"
  | "verified"
  | "rejected";

export type WorkspaceRecord = {
  orgName: string;
  workEmail: string;
  domain: string;
  domainMatch: boolean;
  cacNumber: string;
  cacName: string;
  cacProvider: string;
  cacStatus: "pending" | "matched" | "mismatch";
  state: VerificationState;
  submittedAt?: string;
  reviewer?: string;
  decidedAt?: string;
  isWorkspaceOwner: boolean;
  designPartner: boolean;
  sandbox: boolean;
};

/**
 * Rejected at signup. "We verify the employer, not the person" — a free
 * mailbox can't prove an employer exists, so it never reaches CAC.
 */
export const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
] as const;

export const domainOf = (email: string): string => {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  return at === -1 ? "" : email.trim().toLowerCase().slice(at + 1);
};

export const isWorkEmail = (email: string): boolean => {
  const d = domainOf(email);
  if (!d || !d.includes(".")) return false;
  return !(FREE_EMAIL_DOMAINS as readonly string[]).includes(d);
};

/** The 4-node verification rail — composed with the same idiom as REQ_RAIL. */
export const VERIFY_RAIL: { key: VerificationState; label: string; sub: string }[] = [
  { key: "domain_matched", label: "Domain match", sub: "Work email ↔ company domain" },
  { key: "cac_submitted", label: "CAC check", sub: "RC number ↔ Corporate Affairs Commission" },
  { key: "in_review", label: "Manual review", sub: "A human at Hirebrew signs off — low volume, high trust" },
  { key: "verified", label: "Verified workspace", sub: "Seats, pillars and public posting unlocked" },
];

/** How far through VERIFY_RAIL a workspace has travelled (−1 = not started). */
export const verifyRailIndex = (state: VerificationState): number =>
  state === "verified" ? VERIFY_RAIL.length - 1 : VERIFY_RAIL.findIndex((n) => n.key === state);

/**
 * SEEPCO Energy Ltd — Sino Energy Exploration & Production Company, the
 * flagship design partner the app already calls out in Compliance.tsx
 * ("Oil & Gas pack · flagship design partner").
 */
export const SEED_WORKSPACE: WorkspaceRecord = {
  orgName: "SEEPCO Energy Ltd",
  workEmail: "samuel.omosehin@seepco.ng",
  domain: "seepco.ng",
  domainMatch: true,
  cacNumber: "RC 1042887",
  cacName: "Sino Energy Exploration & Production Company Ltd",
  cacProvider: "Youverify · CAC registry lookup",
  cacStatus: "matched",
  state: "verified",
  submittedAt: "Jun 18, 09:02",
  reviewer: "Ifeoma Nwachukwu · Trust & Safety",
  decidedAt: "Jun 18, 11:40",
  isWorkspaceOwner: true,
  designPartner: true,
  sandbox: false,
};

/**
 * The NG vendor family the app already integrates with. Smile ID stays
 * candidate-side KYC (NIN + liveness) and is deliberately NOT offered here —
 * verifying an employer is the opposite direction of travel.
 */
export const CAC_PROVIDERS = [
  "Youverify · CAC registry lookup",
  "VerifyMe · business verification",
] as const;

/* -------------------------------------------------------------------------- */
/* 2 · Seats & roles                                                           */
/* -------------------------------------------------------------------------- */

/**
 * One vocabulary. The spec's four names win; Interviewer and Viewer are
 * carried over from Integrations' roleCards so nothing is lost in the merge.
 */
export type SeatRole =
  | "Workspace admin"
  | "Recruiter"
  | "Hiring manager"
  | "HR admin"
  | "Interviewer"
  | "Viewer";

export type Seat = {
  email: string;
  name?: string;
  init: string;
  tone: string;
  role: SeatRole;
  state: "Owner" | "Active" | "Invited";
  invitedAt?: string;
  lastSeen?: string;
};

export const SEAT_ROLES: {
  role: SeatRole;
  perms: string;
  unlocks: string;
  tone: SeatTone;
}[] = [
  {
    role: "Workspace admin",
    perms: "Full access · billing · audit · roles · seats",
    unlocks: "Owns verification, seats and which pillars are switched on",
    tone: "red",
  },
  {
    role: "Recruiter",
    perms: "Source · screen · schedule · shortlist",
    unlocks: "Runs the pipeline day to day",
    tone: "green",
  },
  {
    role: "Hiring manager",
    perms: "Review shortlists · interview · decide",
    unlocks: "Sees only their own roles",
    tone: "purple",
  },
  {
    role: "HR admin",
    perms: "Requisitions · compliance · records · seats",
    unlocks: "Owns policy, not pipelines",
    tone: "yellow",
  },
  {
    role: "Interviewer",
    perms: "Scorecards · feedback on assigned",
    unlocks: "Scores against the rubric, sees nothing else",
    tone: "grey",
  },
  {
    role: "Viewer",
    perms: "Read-only dashboards & reports",
    unlocks: "Watches the numbers, changes nothing",
    tone: "grey",
  },
];

export const seatRole = (role: SeatRole) =>
  SEAT_ROLES.find((r) => r.role === role) ?? SEAT_ROLES[SEAT_ROLES.length - 1];

/**
 * The first six seats in the SEEPCO workspace. Everyone here already exists
 * in the app: Samuel Omosehin is the `hr` persona (Talent Lead); Tosin is the
 * approver in the lifecycle audit log; Tobi Balogun heads Product & Design —
 * the flagship Senior Product Designer role is his; Funke Adebayo heads
 * People/HR; Ngozi Adeyemi is the `manager` persona.
 */
export const SEED_SEATS: Seat[] = [
  { email: "samuel.omosehin@seepco.ng", name: "Samuel Omosehin", init: "SO", tone: "#007AFF", role: "Workspace admin", state: "Owner", lastSeen: "Now" },
  { email: "tosin.adeyemi@seepco.ng", name: "Tosin Adeyemi", init: "TA", tone: "#16B364", role: "Hiring manager", state: "Active", invitedAt: "Jun 18, 11:52", lastSeen: "2h ago" },
  { email: "tobi.balogun@seepco.ng", name: "Tobi Balogun", init: "TB", tone: "#AF52DE", role: "Hiring manager", state: "Active", invitedAt: "Jun 18, 11:52", lastSeen: "Yesterday" },
  { email: "chioma.umeh@seepco.ng", name: "Chioma Umeh", init: "CU", tone: "#16B364", role: "Recruiter", state: "Active", invitedAt: "Jun 18, 12:04", lastSeen: "18m ago" },
  { email: "funke.adebayo@seepco.ng", name: "Funke Adebayo", init: "FA", tone: "#EBA308", role: "HR admin", state: "Invited", invitedAt: "Jun 19, 08:30" },
  { email: "ngozi.adeyemi@seepco.ng", name: "Ngozi Adeyemi", init: "NA", tone: "#16B364", role: "Interviewer", state: "Invited", invitedAt: "Jun 19, 08:31" },
];

/** Design-partner plan. Drives the "6 of 25 seats" licence counter. */
export const SEAT_LIMIT = 25;

/* -------------------------------------------------------------------------- */
/* 3 · Pillar switches                                                         */
/* -------------------------------------------------------------------------- */

/** Exactly the OS_NAV section labels — the entitlement keys off the existing structure. */
export type PillarKey = "Command" | "Recruit" | "Manage" | "Grow" | "Me";

export type PillarSwitch = {
  key: PillarKey;
  label: string;
  sub: string;
  modules: number;
  locked?: boolean;
  plan: "Recruit" | "Talent OS";
  adds: string;
};

/** Module counts are DERIVED from OS_NAV so they can never drift from the rail. */
const moduleCount = (k: PillarKey): number =>
  OS_NAV.find((s) => s.label === k)?.items.length ?? 0;

export const PILLAR_SWITCHES: PillarSwitch[] = [
  {
    key: "Recruit",
    label: "Recruit",
    sub: "Requisition to offer — the 11-stage AI hiring lifecycle",
    modules: moduleCount("Recruit"),
    locked: true,
    plan: "Recruit",
    adds: "Overview, requisitions, open roles, candidates, calendar, messages, analytics, audit, D&I, quality-of-hire, integrations, AI sourcing, talent library, sequences, agent fleet",
  },
  {
    key: "Me",
    label: "Me",
    sub: "Every seat-holder's own workspace",
    modules: moduleCount("Me"),
    locked: true,
    plan: "Recruit",
    adds: "My workspace",
  },
  {
    key: "Manage",
    label: "Manage",
    sub: "The people you've already hired",
    modules: moduleCount("Manage"),
    plan: "Talent OS",
    adds: "People, headcount & plan, attrition & risk, department health, contracts & docs, certs & compliance, offboarding & alumni",
  },
  {
    key: "Grow",
    label: "Grow",
    sub: "Performance, retention and internal mobility",
    modules: moduleCount("Grow"),
    plan: "Talent OS",
    adds: "Manager home, goals & OKRs, reviews, 1-on-1s, feedback, growth plans, learning hub, retention playbooks, internal mobility, skills graph",
  },
  {
    key: "Command",
    label: "Command",
    sub: "The executive view across every pillar",
    modules: moduleCount("Command"),
    plan: "Talent OS",
    adds: "Command center, mission control, scenario studio, ask anything",
  },
];

/** "Recruit only" is the honest default — onboarding scales up, not down. */
export const DEFAULT_PILLARS: PillarKey[] = ["Recruit", "Me"];

export const isPillarLocked = (k: PillarKey): boolean =>
  PILLAR_SWITCHES.some((p) => p.key === k && p.locked === true);

export const PILLAR_FOOTER =
  "Start on Recruit only. Switch Manage, Grow and Command on when you're ready — same workspace, same records, no migration.";

/* -------------------------------------------------------------------------- */
/* 4 · First role as a conversation                                            */
/* -------------------------------------------------------------------------- */

export type IntakeField = "title" | "dept" | "seniority" | "brief" | "confirm";

export type IntakeTurn = {
  field: IntakeField;
  agent: string;
  reasoning?: string[];
  chips?: string[];
  placeholder: string;
};

export const INTAKE_OPENER =
  "Tell me what you're hiring for — a sentence is enough. I'll draft the JD, the Naira band, the knockout questions, the video prompts and the scoring rubric, and you'll edit every one of them before anything goes live.";

/** Derived so the reasoning line stays true to the taxonomy it cites. */
const SKILL_CLUSTER_COUNT = SKILL_CLUSTERS.length;
const SKILL_COUNT = SKILL_CLUSTERS.reduce((n, c) => n + c.skills.length, 0);

/** Comp comparables pulled per draft — the same 214 the workspace already holds. */
const COMP_SAMPLE = 214;

export const ROLE_INTAKE_SCRIPT: IntakeTurn[] = [
  {
    field: "title",
    agent: "What's the role called? Use the title you'd actually post — I'll normalise it against the skills taxonomy either way.",
    placeholder: "e.g. Senior Product Designer",
  },
  {
    field: "dept",
    agent: "Which function does it sit in?",
    chips: [...REQ_DEPARTMENTS],
    placeholder: "Pick a department, or type your own",
  },
  {
    field: "seniority",
    agent: "And the seniority bar? This sets the Naira band and how hard the knockouts bite.",
    chips: [...REQ_SENIORITY],
    placeholder: "Junior · Mid · Senior · Lead · Principal",
  },
  {
    field: "brief",
    agent: "Last one: what will this person actually own in their first 90 days? One line is plenty — I'd rather have the real job than a tidy job description.",
    placeholder: "e.g. Own the design system across the field-ops apps",
  },
  {
    field: "confirm",
    agent: "Drafting against the SEEPCO skills taxonomy and live NG comp data… Everything below is a proposal. Nothing publishes until you approve it.",
    reasoning: [
      `Matching to ${SKILL_CLUSTER_COUNT} skill clusters · ${SKILL_COUNT} skills`,
      `Pulling Lagos comp comparables · ${COMP_SAMPLE} data points`,
      "Writing knockouts from the must-haves",
      "Scoring rubric weighted to 100 — yours to re-weight",
    ],
    placeholder: "Type anything to adjust, or press Enter to generate",
  },
];

export const INTAKE_SUGGESTIONS = [
  "Make it hybrid Lagos",
  "Add HSE certification as a must-have",
  "Lower the seniority bar",
  "Benchmark against Flutterwave and Interswitch",
];

/** "AI proposes, humans decide" — experienced in the first ten minutes, not read in a PDF. */
export const INTAKE_APPROVAL_NOTE =
  "Brew drafts. You edit. Nothing here reaches a candidate until you approve it — and the edit is logged next to the draft.";

/* -------------------------------------------------------------------------- */
/* 5 · Backlog import — the aha moment                                         */
/* -------------------------------------------------------------------------- */

export type ImportSource = "Greenhouse" | "Lever" | "CSV" | "SeamlessHR" | "Forwarding email";

export type BacklogImport = {
  id: string;
  source: ImportSource;
  targetRole: string;
  received: number;
  imported: number;
  merged: number;
  consentPreserved: number;
  at: string;
  screenedAt?: string;
  shortlisted?: number;
  knockedOut?: number;
  timeToShortlistHours?: number;
};

export type ForwardingChannel = {
  address: string;
  aliasFor: (role: string) => string;
  verifiedDomain: string;
  lands: string[];
  note: string;
  unverifiedNote: string;
};

/**
 * The intake address is per-workspace, and it keys off the VERIFIED DOMAIN
 * rather than the display name — "SEEPCO Energy Ltd" is what the CAC register
 * calls them, `seepco.ng` is what their recruiters actually send mail from.
 * SEED_WORKSPACE therefore still produces seepco.apply@intake.hirebrew.io and
 * careers@seepco.ng, the pair the rest of this file tells.
 */
export const forwardingFor = (ws: WorkspaceRecord): ForwardingChannel => {
  const prefix = slug(ws.domain.split(".")[0] ?? "") || slug(ws.orgName) || "workspace";
  const careers = ws.domain || "your company";
  return {
    address: `${prefix}.apply@intake.hirebrew.io`,
    aliasFor: (role: string) => `${prefix}.${slug(role)}@intake.hirebrew.io`,
    verifiedDomain: careers,
    lands: [
      `CVs forwarded from careers@${careers}`,
      "Replies to your job-board posts",
      "Referrals a manager forwards from their inbox",
      "Anything a candidate sends as an attachment",
    ],
    note: "Point your careers inbox here once. Everything already in flight becomes a ranked, explained shortlist by morning — no new applicants needed.",
    unverifiedNote: "The address goes live the moment the workspace is verified — we won't accept CVs on behalf of an employer we haven't checked.",
  };
};

/**
 * The backlog that converts a recruiter. Every number is the app's own:
 * 214 received (the sidebar's active-candidate count), 212 imported and 14
 * duplicates merged (TalentLibrary's result card), 12 shortlisted / 9 knocked
 * out finishing at 04:12 (the overnight run six files already narrate).
 * Received Jun 19 at 21:12 → ranked by 04:12 on Jun 21 = the 31h that
 * Screening.tsx shows as time-to-shortlist, well inside the 48h promise.
 */
export const SEED_BACKLOG: BacklogImport = {
  id: "IMP-001",
  source: "Greenhouse",
  targetRole: "Senior Product Designer",
  received: 214,
  imported: 212,
  merged: 14,
  consentPreserved: 212,
  at: "Jun 19, 21:12",
  screenedAt: "04:12",
  shortlisted: 12,
  knockedOut: 9,
  timeToShortlistHours: 31,
};

/**
 * Shares sum to 1 so Processing.tsx can drive a real progress bar off the
 * imported count instead of a hardcoded 68%. Labels match its own procSteps.
 */
export const SCREEN_STEPS: { label: string; share: number; detail: string }[] = [
  { label: "Parsing CVs", share: 0.22, detail: "Text, tables and scanned PDFs — Nigerian CV formats included" },
  { label: "Knockout checks", share: 0.18, detail: "Authored criteria only — every rejection carries its cited reason" },
  { label: "Role-fit scoring", share: 0.34, detail: "Against the rubric you approved, dimension by dimension" },
  { label: "Fairness audit", share: 0.12, detail: "Adverse-impact check across the ranked set before it's shown" },
  { label: "Ranking shortlist", share: 0.14, detail: "Tiered Strong / Good / Possible, each score opening into its reasons" },
];

/** SeamlessHR first — the Nigerian default. */
export const HRIS_SOURCES = ["SeamlessHR", "Workday", "BambooHR", "SAP SuccessFactors"] as const;

/** The line the whole import exists to earn. */
export const BACKLOG_PROMISE =
  "214 applications you already own, ranked and explained down to 12 by morning — with zero new applicants.";

/* -------------------------------------------------------------------------- */
/* 6 · Sandbox / pre-loaded demo role                                          */
/* -------------------------------------------------------------------------- */

/**
 * No second dataset. This only PINS the story the seed already tells —
 * Processing, Screening and Shortlist all carry this exact role today.
 */
export const SANDBOX_ROLE = {
  title: "Senior Product Designer",
  applicants: 47,
  shortlisted: 12,
  knockedOut: 9,
  note: "Sample data — the same role Processing, Screening and Shortlist already carry",
} as const;

/** ≈90 seconds, three stops. Stage ids are all registered routes. */
export const SAMPLE_TOUR: { stage: string; title: string; body: string }[] = [
  {
    stage: "role",
    title: "The brief",
    body: "One line in, a full JD out — Naira band, knockout questions, video prompts and a rubric built on the skills taxonomy. You edit all of it.",
  },
  {
    stage: "processing",
    title: "The overnight run",
    body: "47 CVs parsed, knocked out, scored, fairness-audited and ranked while you slept.",
  },
  {
    stage: "screening",
    title: "The explained 12",
    body: "Twelve ranked matches, nine cited rejections, one fairness audit. Every score opens into its reasons.",
  },
];

export const SANDBOX_COPY = {
  chip: "SAMPLE WORKSPACE",
  body: "You're on sample data — nothing here touches a real candidate.",
  exit: "Reset sample data",
  cta: "Create your workspace",
  entry: "See it on a sample role — 90 seconds, no signup",
} as const;

/* -------------------------------------------------------------------------- */
/* 7 · Tool-wiring moments                                                     */
/* -------------------------------------------------------------------------- */

/** Stable ids for every vendor in the Integrations catalogue, plus the two new ones. */
export type ConnectorId =
  | "google-calendar"
  | "outlook"
  | "slack"
  | "whatsapp"
  | "greenhouse"
  | "lever"
  | "seamlesshr"
  | "workday"
  | "bamboohr"
  | "sap-sf"
  | "youverify"
  | "verifyme"
  | "smile-id"
  | "paystack"
  | "linkedin"
  | "indeed"
  | "jobberman"
  | "myjobmag"
  | "okta"
  | "entra"
  | "google-workspace";

export type ToolMoment = {
  id: ConnectorId;
  name: string;
  where: string;
  unlocks: string;
  withoutIt: string;
  proof: string;
};

/**
 * One sentence, one place. connectors.ts imports these so the in-flow prompt
 * and the catalogue card quote the SAME string — never two drifting copies.
 * Framed by what each one unlocks; never as a settings chore.
 */
export const TOOL_MOMENTS: ToolMoment[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    where: "/schedule + /calendar",
    unlocks: "Interview slots book themselves — candidates pick from your real availability",
    withoutIt: "This grid is a sample until a calendar is wired",
    proof: "Median 3 emails saved per interview",
  },
  {
    id: "outlook",
    name: "Outlook",
    where: "/schedule + /calendar",
    unlocks: "The same, for the half of SEEPCO on Microsoft 365",
    withoutIt: "Microsoft 365 diaries stay invisible to scheduling",
    proof: "Runs alongside Google — connect either, or both",
  },
  {
    id: "slack",
    name: "Slack",
    where: "/screening",
    unlocks: "The 04:12 shortlist lands in #hiring before you open your laptop",
    withoutIt: "You'll find the shortlist when you next open Hirebrew",
    proof: "47 → 12, posted with the reasons attached",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    where: "/sequences",
    unlocks: "Outreach you approve, sent where candidates actually reply",
    withoutIt: "WhatsApp steps stay drafted and unsent",
    proof: "78% open · 26% reply — your best-responding channel",
  },
  {
    id: "youverify",
    name: "Youverify",
    where: pathFor("activation"),
    unlocks: "Your RC number checks against the CAC registry in seconds, not days",
    withoutIt: "Verification waits on a manual document review",
    proof: "Behind step 1 of activation",
  },
  {
    id: "paystack",
    name: "Paystack",
    where: "/settings",
    unlocks: "Naira billing when the workspace leaves the design-partner plan",
    withoutIt: "Nothing — SEEPCO is on the design-partner plan, invoiced manually",
    proof: "Not needed while you're a design partner",
  },
];

export const toolMoment = (id: ConnectorId): ToolMoment | undefined =>
  TOOL_MOMENTS.find((t) => t.id === id);

/** "" for connectors with no authored moment — the caller supplies its own line. */
export const unlocksFor = (id: ConnectorId): string => toolMoment(id)?.unlocks ?? "";

/* -------------------------------------------------------------------------- */
/* 8 · Checklist steps + the named human                                       */
/* -------------------------------------------------------------------------- */

export type ChecklistStepKey = "verify" | "firstrole" | "import" | "shortlist" | "invite";

/**
 * Replaces OnboardingGuide's inline TASKS_HR. Shape is assignable to its Task
 * type, plus `nudge` for the "Brew suggests next" lead row.
 *
 * Every `go` below is checked TWICE: that the stage id resolves in the PATHS
 * registry (nav.ts) — an unregistered id falls through pathFor() to "/" and
 * lands the recruiter on the dashboard while the step still stamps its metric —
 * and that persona `hr` (legacyAccess: true, osStages includes talentlibrary)
 * can open it: activation ✔ registered ✔ Shell legacyAccess, requisitions ✔,
 * talentlibrary ✔, screening ✔. Nothing here can strand the recruiter on the
 * "isn't in your workspace" panel, or on the wrong one.
 */
export const RECRUITER_CHECKLIST: {
  key: ChecklistStepKey;
  label: string;
  sub: string;
  icon: string;
  go: string;
  nudge: string;
}[] = [
  {
    key: "verify",
    label: "Verify your workspace",
    sub: "Domain + CAC · a human signs off",
    icon: "shield",
    go: "activation",
    nudge: "Start here — verification unlocks seats, pillars and posting.",
  },
  {
    key: "firstrole",
    label: "Open your first role — describe it in chat",
    sub: "JD, Naira band, knockouts, video prompts, rubric",
    icon: "clipboard",
    go: "requisitions",
    nudge: "Describe the role in a sentence. You'll edit everything Brew drafts.",
  },
  {
    key: "import",
    label: "Import the backlog you already have",
    sub: "Forward your careers inbox, or drop a CSV",
    icon: "stack",
    go: "talentlibrary",
    nudge: "214 applications you already own become a ranked 12 by morning.",
  },
  {
    key: "shortlist",
    label: "Review your first AI shortlist",
    sub: "Ranked, explained, with cited rejections",
    icon: "users",
    go: "screening",
    nudge: "The overnight run finished at 04:12 — 12 strong matches are waiting.",
  },
  {
    key: "invite",
    label: "Invite your hiring team",
    sub: "Recruiter · hiring manager · HR admin",
    icon: "users",
    go: "activation",
    nudge: "Hiring managers decide faster when the shortlist is already in their seat.",
  },
];

/**
 * The only sanctioned way into `markDone`. Checklist rows reach it as plain
 * strings (OnboardingGuide's Task list spans four personas), and a key that
 * isn't one of the five stamps a timestamp nothing measures.
 */
export const isChecklistStepKey = (k: string): k is ChecklistStepKey =>
  RECRUITER_CHECKLIST.some((s) => s.key === k);

/** The first incomplete step — what Brew nudges next. `undefined` when done. */
export const nextChecklistStep = (done: Record<string, boolean> | Set<string>) => {
  const isDone = (k: string) => (done instanceof Set ? done.has(k) : Boolean(done[k]));
  return RECRUITER_CHECKLIST.find((s) => !isDone(s.key));
};

/** The hands-on onboarding already promised to SEEPCO — a name, not a ticket queue. */
export const DESIGN_PARTNER_CONTACT = {
  name: "Ifeoma Nwachukwu",
  role: "Onboarding lead · Hirebrew",
  init: "IN",
  tone: "#AF52DE",
  line: "Your named onboarding lead for the SEEPCO design-partner programme",
  whatsapp: "+234 810 555 0142",
  email: "ifeoma@hirebrew.io",
  promise: "Hands-on through your first three roles — WhatsApp her, don't file a ticket.",
} as const;

/** The clock, stated once, quoted by the activation header and the hr welcome. */
export const ACTIVATION_CLOCK = "First role live in ~15 minutes · first ranked shortlist by morning";

/* -------------------------------------------------------------------------- */
/* 9 · Time to value                                                           */
/* -------------------------------------------------------------------------- */

export const TTV_TARGETS = {
  firstRoleLiveMins: 15,
  firstShortlistHours: 48,
  seatsTarget: 8,
  weekOneActions: 12,
} as const;

export type TtvMetric = {
  key: string;
  label: string;
  value: string;
  target: string;
  hit: boolean;
  sub: string;
};

/**
 * Seeded activation stamps — the SEEPCO timeline the rest of this file tells.
 * The workspace store's `markDone` should write ISO-8601 strings; `ttvMetrics`
 * parses anything Date.parse understands and falls back to the seeded
 * durations below when a stamp is missing or unparseable, so Analytics never
 * renders empty on a cold workspace.
 */
export const SEED_DONE_AT: Record<ChecklistStepKey, string> = {
  verify: "2026-06-18T11:40:00+01:00",
  firstrole: "2026-06-18T11:52:00+01:00",
  import: "2026-06-19T21:12:00+01:00",
  shortlist: "2026-06-21T04:12:00+01:00",
  invite: "2026-06-19T08:31:00+01:00",
};

const stamp = (s?: string): number | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

const minutesBetween = (a?: string, b?: string): number | null => {
  const from = stamp(a);
  const to = stamp(b);
  if (from === null || to === null || to < from) return null;
  return Math.round((to - from) / 60000);
};

const fmtMins = (m: number): string =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

const fmtHours = (h: number): string => (h < 48 ? `${h}h` : `${Math.round((h / 24) * 10) / 10}d`);

/**
 * The activation clock, measured. Every metric carries its own target string
 * so no caller hardcodes one.
 */
export function ttvMetrics(
  doneAt: Record<string, string>,
  backlog: BacklogImport = SEED_BACKLOG,
  seats: Seat[] = SEED_SEATS,
  weekOneActions = 18,
): TtvMetric[] {
  /* 1 — verified workspace → first role live */
  const roleMins = minutesBetween(doneAt.verify, doneAt.firstrole) ?? 12;
  const roleHit = roleMins <= TTV_TARGETS.firstRoleLiveMins;

  /* 2 — backlog imported → ranked shortlist */
  const shortlistMins = minutesBetween(doneAt.import, doneAt.shortlist);
  const shortlistHours =
    shortlistMins !== null
      ? Math.round(shortlistMins / 60)
      : (backlog.timeToShortlistHours ?? 31);
  const shortlistHit = shortlistHours <= TTV_TARGETS.firstShortlistHours;

  /* 3 — how much of the backlog actually made it in */
  const adoptedPct = backlog.received > 0 ? Math.round((backlog.imported / backlog.received) * 100) : 0;

  /* 4 — seats */
  const active = seats.filter((s) => s.state !== "Invited").length;
  const invited = seats.filter((s) => s.state === "Invited").length;

  return [
    {
      key: "firstrole",
      label: "Time to first role live",
      value: fmtMins(roleMins),
      target: `≤ ${TTV_TARGETS.firstRoleLiveMins} min`,
      hit: roleHit,
      sub: "Verified workspace → JD, band, knockouts and rubric approved",
    },
    {
      key: "shortlist",
      label: "Time to first AI shortlist",
      value: fmtHours(shortlistHours),
      target: `≤ ${TTV_TARGETS.firstShortlistHours}h from import`,
      hit: shortlistHit,
      sub: `${backlog.received} applications in → ${backlog.shortlisted ?? SANDBOX_ROLE.shortlisted} ranked, ${backlog.knockedOut ?? SANDBOX_ROLE.knockedOut} knocked out with cited reasons`,
    },
    {
      key: "backlog",
      label: "Backlog adopted",
      value: `${backlog.imported} of ${backlog.received}`,
      target: `${backlog.received} received · ${backlog.source}`,
      hit: adoptedPct >= 95,
      sub: `${adoptedPct}% imported · ${backlog.merged} duplicates merged by identity resolution · consent preserved on ${backlog.consentPreserved}`,
    },
    {
      key: "seats",
      label: "Seats invited",
      value: `${seats.length} of ${SEAT_LIMIT}`,
      target: `≥ ${TTV_TARGETS.seatsTarget} seats`,
      hit: seats.length >= TTV_TARGETS.seatsTarget,
      sub: `${active} active · ${invited} invited · design-partner plan`,
    },
    {
      key: "actions",
      label: "Week-one shortlist actions",
      value: `${weekOneActions} decisions logged`,
      target: `≥ ${TTV_TARGETS.weekOneActions} in week one`,
      hit: weekOneActions >= TTV_TARGETS.weekOneActions,
      sub: "Advances, rejections and interview bookings — every one audit-logged",
    },
  ];
}

/** Cold-workspace fallback, derived so it can never contradict ttvMetrics(). */
export const SEED_TTV: TtvMetric[] = ttvMetrics(SEED_DONE_AT);
