/**
 * Employee onboarding — two entry paths, one destination.
 *
 * PATH A · the new hire, offer-signed → day 90. Chidi Okeke (E-0243), the only
 * employee in `EMPLOYEES` with status "onboarding", hired via "Pillar 1 · Jun 2026"
 * on contract CT-901. Preboarding → day-1 activation + NDPR consent re-confirmation
 * → the AI-drafted 30/60/90 plan a manager approves → the FR-074 bridge out.
 *
 * PATH B · the existing workforce at rollout. HR imports the HRIS (BambooHR — the
 * only connected HRIS in Integrations.tsx), 358 employees land, everyone gets a
 * claim invite by work email / WhatsApp / SMS, and claiming takes about five
 * minutes. What they see first is VALUE, never surveillance.
 *
 * Every number here is grounded in a number already in the app:
 *   358 employees            COMMAND_KPIS (talentos.ts)
 *   84 Engineering headcount DEPARTMENTS
 *   ₦2.4M L&D pool           LearningHub.tsx POOL_TOTAL · FR-081
 *   47 hires / 35 responded  Qoh.tsx Q1 2026 cohort → 74% coverage
 *   31h time-to-shortlist    Screening.tsx
 *   212 pulled / 14 merged   TalentLibrary.tsx ATS import
 *   84% weekly active        OnboardingHub · adoption (was MePortal)
 *   98% delivery / 15-min    OnboardingHub · SMS fallback
 *   60% mobility opt-in      Mobility.tsx opt-in governance
 *   4.2/5 day-30 QoH         MissionControl.tsx · Posthire.tsx
 *
 * No React in this file. It is read by the HR cockpit (`onboardhub`), the
 * Stage-10 recruiter screen (Onboarding.tsx), /welcome, /claim, MeMobile,
 * ManagerHome and Qoh — one source, many renders.
 */

import { EMPLOYEES, SYSTEMS, type SystemName } from "@/data/talentos";

/* ============================================================================
 * Shared vocabulary
 * ==========================================================================*/

/** Structurally identical to PfTone — data must never import from components. */
export type KpiTone = "green" | "blue" | "purple" | "yellow" | "red" | "grey";

/** Verification & payroll partners already modelled in Reference.tsx + Integrations.tsx. */
export type Partner =
  | "Smile ID"
  | "Youverify"
  | "VerifyMe"
  | "Paystack"
  | "SeamlessHR"
  | "DocuSign";

/** The four labels already in Contracts.tsx STAGE_LABEL, plus the terminal state. */
export const ESIGN_STAGES = [
  "not started",
  "draft ready — awaiting approvals",
  "approved — awaiting e-sign",
  "out for e-signature",
  "signed — countersigned by HR Ops",
] as const;

export type EsignStage = 0 | 1 | 2 | 3 | 4;

/**
 * The one hire Path A follows — his EMPLOYEES row plus the fields only
 * onboarding needs. Identity is never re-typed here: a name, tone or grade
 * edited on the person spine has to reach /welcome and the cockpit unaided.
 */
const chidi = EMPLOYEES.find((e) => e.id === "E-0243")!;

export const NEW_HIRE = {
  ...chidi,
  empId: chidi.id,
  contractId: "CT-901",
  offerSigned: "Jun 3, 2026",
  startDate: "Mon Jul 1, 2026",
  dayOfNinety: 34,
  roleReq: "BE-2031",
} as const;

/* ============================================================================
 * PATH A · 1 — Preboarding (the moment the offer is signed)
 * ==========================================================================*/

export type PreboardTask = {
  id: string;
  lane: "sign" | "collect" | "bank" | "welcome" | "logistics";
  label: string;
  sub: string;
  required: boolean;
  /** Where the requirement comes from — cited, never invented. */
  source: string;
  state: "waiting" | "in-progress" | "done" | "blocked";
  partner?: Partner;
  partnerStatus?: "Verified" | "In progress" | "Clear" | "Name mismatch" | "Not started";
  /** AI field extraction off the uploaded document (OCR + confidence). */
  extract?: { field: string; value: string; conf: number }[];
  esign?: EsignStage;
  doneAt?: string;
};

export const PREBOARD_TASKS: PreboardTask[] = [
  {
    id: "pb-contract",
    lane: "sign",
    label: "Employment contract",
    sub: "Permanent · Backend Engineer L4 · Lagos",
    required: true,
    source: "Stage 9 offer · CT-901",
    state: "done",
    partner: "DocuSign",
    esign: 4,
    doneAt: "Jun 3 · 14:22",
  },
  {
    id: "pb-nda",
    lane: "sign",
    label: "NDA & IP assignment",
    sub: "Standard engineering pack — no side-letter",
    required: true,
    source: "Contracts · document vault",
    state: "done",
    partner: "DocuSign",
    esign: 4,
    doneAt: "Jun 3 · 14:24",
  },
  {
    id: "pb-esop",
    lane: "sign",
    label: "ESOP grant letter",
    sub: "4-year vest, 1-year cliff — board-approved Jun 10",
    required: false,
    source: "Stage 10 · Onboarding document pack",
    state: "in-progress",
    partner: "DocuSign",
    esign: 3,
  },
  {
    id: "pb-nin",
    lane: "collect",
    label: "National ID (NIN slip)",
    sub: "NIN slip OCR + liveness face-match",
    required: true,
    source: "Reference · Stage 8 partner set",
    state: "done",
    partner: "Smile ID",
    partnerStatus: "Verified",
    doneAt: "Jun 8 · 11:07",
    extract: [
      { field: "NIN", value: "•••• 7412", conf: 0.99 },
      { field: "Full name", value: "Chidi Emeka Okeke", conf: 0.97 },
      { field: "Date of birth", value: "14 Mar 1996", conf: 0.96 },
    ],
  },
  {
    id: "pb-degree",
    lane: "collect",
    label: "B.Eng Computer Engineering, UNILAG",
    sub: "Credential check against the institution register",
    required: true,
    source: "Reference · education credentials",
    state: "done",
    partner: "Youverify",
    partnerStatus: "Verified",
    doneAt: "Jun 11 · 09:31",
    extract: [
      { field: "Institution", value: "University of Lagos", conf: 0.98 },
      { field: "Class of degree", value: "Second Class Upper", conf: 0.94 },
      { field: "Year", value: "2018", conf: 0.99 },
    ],
  },
  {
    id: "pb-nysc",
    lane: "collect",
    label: "NYSC discharge certificate",
    sub: "Statutory for Nigerian graduates under 30 at call-up",
    required: true,
    source: "Reference · credential checks",
    state: "in-progress",
    partner: "Youverify",
    partnerStatus: "In progress",
  },
  {
    id: "pb-medical",
    lane: "collect",
    label: "Pre-employment medical — fitness to work",
    sub: "Lagos HQ desk role — no offshore pack required",
    required: true,
    source: "Compliance · Fitness-to-work medical · FR-062",
    state: "waiting",
  },
  {
    id: "pb-bank",
    lane: "bank",
    label: "Bank account for payroll",
    sub: "Account-name match, then handed to SeamlessHR",
    required: true,
    source: "Payroll onboarding · FR-080",
    state: "done",
    partner: "Paystack",
    partnerStatus: "Verified",
    doneAt: "Jun 12 · 16:44",
    extract: [
      { field: "Bank", value: "Guaranty Trust Bank", conf: 1 },
      { field: "Account", value: "•••••• 3081", conf: 1 },
      { field: "Account name", value: "OKEKE CHIDI EMEKA — matched", conf: 0.98 },
    ],
  },
  {
    id: "pb-pension",
    lane: "bank",
    label: "Pension RSA PIN",
    sub: "PenCom RSA — or we open one with the default PFA",
    required: true,
    source: "Statutory forms (PAYE, pension) · Onboarding.tsx",
    state: "waiting",
  },
  {
    id: "pb-video",
    lane: "welcome",
    label: "Meet the payments squad",
    sub: "2:14 · Ngozi, Tobi, Amara + 3",
    required: false,
    source: "Stage 10 · pre-boarding nudge (offer + 1 day)",
    state: "done",
    doneAt: "Jun 4 · 20:12",
  },
  {
    id: "pb-day1",
    lane: "logistics",
    label: "Your day-one itinerary",
    sub: "Mon Jul 1 · 09:00 Lagos HQ, 4th floor",
    required: false,
    source: "promoted from Onboarding.tsx's \"DAY ONE · 9AM\" nudge",
    state: "done",
    doneAt: "Jun 28 · 17:00",
  },
];

/** Which certification pack a joiner draws — cert names verbatim from Compliance.tsx MATRIX. */
export const REQUIRED_PACK: Record<string, string[]> = {
  "Lagos · desk": ["Fitness-to-work medical"],
  "Port Harcourt · site": ["Fitness-to-work medical", "NEBOSH IGC", "First Aid at Work"],
  "Offshore rotation": ["Fitness-to-work medical", "OPITO BOSIET"],
  "Drilling & subsurface": ["Fitness-to-work medical", "OPITO BOSIET", "H2S Awareness"],
};

/** Chidi is Lagos/desk — so BOSIET and NEBOSH are correctly absent. That is the point. */
export const NEW_HIRE_PACK_KEY = "Lagos · desk";

export type PreboardNudge = {
  /** The four cadence labels — Onboarding.tsx and /welcome both render these. */
  when: string;
  channel: "WhatsApp" | "SMS" | "Email";
  /** The message itself. One copy: no screen keeps its own wording. */
  text: string;
  state: "sent" | "scheduled" | "draft";
  delivered?: boolean;
  opened?: boolean;
  /** MeMobile: SMS takes over 15 min after an undelivered WhatsApp. */
  fellBackToSms?: boolean;
  /** PreboardTask ids this nudge chases. */
  drives: string[];
};

export const PREBOARD_NUDGES: PreboardNudge[] = [
  {
    when: "OFFER + 1 DAY",
    channel: "WhatsApp",
    text: "Welcome! Here's your team and what we're shipping this quarter.",
    state: "sent",
    delivered: true,
    opened: true,
    drives: ["pb-video"],
  },
  {
    when: "1 WEEK BEFORE",
    channel: "WhatsApp",
    text: "3 short docs to skim before Monday — no pressure.",
    state: "sent",
    delivered: true,
    opened: true,
    drives: ["pb-nysc", "pb-medical"],
  },
  {
    when: "2 DAYS BEFORE",
    channel: "WhatsApp",
    text: "Your day-one schedule + how to reach your buddies.",
    state: "sent",
    delivered: false,
    opened: true,
    fellBackToSms: true,
    drives: ["pb-day1"],
  },
  {
    when: "DAY ONE · 9AM",
    channel: "WhatsApp",
    text: "Laptop, accounts and coffee sorted. People Ops at 9:30.",
    state: "scheduled",
    drives: ["pb-pension", "pb-medical"],
  },
];

export const NUDGE_DELIVERY = {
  deliveryRate: 98,
  smsFallbackMinutes: 15,
  note: "Falls back automatically 15 min after an undelivered WhatsApp — the same rail the mobile companion uses.",
} as const;

/* ============================================================================
 * PATH A · 2 — Day one: "we already know you"
 * ==========================================================================*/

export type ProvisionItem = {
  sys: SystemName;
  via: string;
  grantedAt?: string;
  state: "scheduled" | "active" | "failed";
};

/**
 * Grant timestamps — the only thing provisioning adds to the shared list.
 * Typed by `SystemName` so a rename in `SYSTEMS` cannot quietly leave a row
 * here unmatched and flip it from "active" to "scheduled".
 */
const GRANTED_AT: Partial<Record<SystemName, string>> = {
  "Google Workspace": "Jul 1 · 08:41",
  Slack: "Jul 1 · 08:41",
  Figma: "Jul 1 · 08:52",
  GitHub: "Jul 1 · 09:03",
  "Payroll (HRIS)": "Jul 1 · 10:15",
};

/**
 * Both directions of the FR-063 mirror map over `SYSTEMS` — same six systems,
 * same order, guaranteed rather than hand-kept. Provisioning takes `grantVia`;
 * Offboarding.tsx takes `revokeVia` off the same rows, which is how payroll can
 * be granted through SeamlessHR and revoked by hand without the lists drifting.
 */
export const PROVISIONING: ProvisionItem[] = SYSTEMS.map((s) => ({
  sys: s.sys,
  via: s.grantVia,
  grantedAt: GRANTED_AT[s.sys],
  state: GRANTED_AT[s.sys] ? "active" : "scheduled",
}));

export const ACTIVATION = {
  workEmail: "chidi.okeke@unrealabs.ng",
  /** Integrations.tsx — the connected SSO/SAML provider. */
  idp: "Microsoft Entra ID",
  firstSignIn: "Jul 1 · 08:47 · Lagos",
  device: "Windows laptop · issued Jun 28",
  mfa: "Authenticator enrolled",
  state: "active" as const,
};

/** What arrives pre-filled from the candidate record — nothing re-entered (A2). */
export type PrefilledField = { field: string; value: string; from: string; stage: string };

export const PREFILLED: PrefilledField[] = [
  { field: "Name, phone, address", value: "Chidi Okeke · +234 ••• 3312 · Yaba, Lagos", from: "Application form", stage: "Stage 3 · Application" },
  { field: "CV & work history", value: "4 years — 2 employers, payments & backend", from: "CV parse", stage: "Stage 3 · Application" },
  { field: "Skills", value: "Go · PostgreSQL · Kafka", from: "Skills taxonomy match", stage: "Stage 4 · Screening" },
  { field: "Assessment results", value: "Technical 88 · take-home passed", from: "Assessment engine", stage: "Stage 5 · Assessment" },
  { field: "Interview scorecards", value: "Panel avg 4.2/5 · BE-2031 payments loop", from: "Structured scorecards", stage: "Stage 6 · Interviews" },
  { field: "Identity & credentials", value: "NIN verified · UNILAG B.Eng verified", from: "Smile ID · Youverify", stage: "Stage 8 · References" },
  { field: "Offer & contract", value: "Permanent L4 · signed Jun 3", from: "Offer letter · CT-901", stage: "Stage 9 · Offer" },
];

/* ---- NDPR consent re-confirmation at candidate → employee conversion ------ */

export type ConsentClause = {
  id: string;
  purpose: string;
  wasFor: string;
  nowFor: string;
  lawfulBasis: "Consent" | "Contract" | "Legal obligation";
  required: boolean;
  /**
   * The HISTORICAL answer, never a live default. /welcome starts every
   * Consent-basis switch off and lets the subject turn it on: a pre-ticked box
   * is not a specific affirmative act, so it is not consent (NDPR 2019 §2.5,
   * NDPA 2023). Nothing reads the value today — /welcome counts its own live
   * switches — so it is purely the stored answer a receipt would be rendered
   * against, and must never be wired to a control's initial state.
   */
  accepted: boolean;
};

export type ConsentRecord = {
  at: string;
  subject: string;
  recordedBy: string;
  ndprNote: string;
  clauses: ConsentClause[];
  retention: string;
};

/**
 * The purpose of processing CHANGES at candidate → employee conversion, so we
 * ask again rather than carrying the application-stage consent forward.
 *
 * Keyed by employee because the record outlives the conversion moment, but
 * /welcome is currently the only surface that reads it — E-0243 is the live
 * self-service capture; E-0214 is the pre-self-service record kept so the shape
 * covers a consent taken on the subject's behalf by People Ops, and so a
 * declined clause (c2) has a worked example.
 */
export const CONSENT_RECORDS: Record<string, ConsentRecord> = {
  "E-0243": {
    at: "Candidate → employee conversion · Jul 1, 08:49",
    subject: "Chidi Okeke",
    recordedBy: "Self-service · /welcome",
    ndprNote:
      "Your data was collected to assess a job application. It is now processed to employ you — a different purpose under the NDPR, so we ask again in plain words.",
    clauses: [
      {
        id: "c1",
        purpose: "Your CV, skills and interview scorecards become your employee record",
        wasFor: "Assessing your application",
        nowFor: "Your profile, growth plan and competency baseline",
        lawfulBasis: "Consent",
        required: false,
        accepted: true,
      },
      {
        id: "c2",
        purpose: "Your screening video and assessment results stay attached",
        wasFor: "Shortlisting",
        nowFor: "Quality-of-hire measurement at day 90 — and improving our screening model",
        lawfulBasis: "Consent",
        required: false,
        accepted: true,
      },
      {
        id: "c3",
        purpose: "Identity, bank and pension details",
        wasFor: "—",
        nowFor: "Payroll through SeamlessHR and statutory filings (PAYE, pension)",
        lawfulBasis: "Legal obligation",
        required: true,
        accepted: true,
      },
      {
        id: "c4",
        purpose: "WhatsApp and SMS nudges to your personal number",
        wasFor: "Interview logistics",
        nowFor: "Goal, review and learning reminders — revocable any time",
        lawfulBasis: "Consent",
        required: false,
        accepted: true,
      },
      {
        id: "c5",
        purpose: "Your profile in the internal mobility matcher",
        wasFor: "—",
        nowFor: "Being matched to internal roles",
        lawfulBasis: "Consent",
        required: false,
        accepted: false, // left off at conversion — ties to Mobility's 60% opt-in
      },
    ],
    retention: "Screening media retained 24 months from conversion, then deleted — NDPR schedule.",
  },
  "E-0214": {
    at: "Candidate → employee conversion · Nov 14, 2023",
    subject: "Amara Okonkwo",
    recordedBy: "People Ops · Funke Adebayo (on her behalf, pre-self-service)",
    ndprNote:
      "Consent was re-confirmed at the candidate → employee conversion — the purpose of processing changed, so we asked again (NDPR).",
    clauses: [
      {
        id: "c1",
        purpose: "Your CV, skills and interview scorecards become your employee record",
        wasFor: "Assessing your application",
        nowFor: "Your profile, growth plan and competency baseline",
        lawfulBasis: "Consent",
        required: false,
        accepted: true,
      },
      {
        id: "c2",
        purpose: "Your screening video and assessment results stay attached",
        wasFor: "Shortlisting",
        nowFor: "Quality-of-hire measurement at day 90",
        lawfulBasis: "Consent",
        required: false,
        accepted: false, // she declined — screening media deleted Nov 2025
      },
      {
        id: "c3",
        purpose: "Identity, bank and pension details",
        wasFor: "—",
        nowFor: "Payroll through SeamlessHR and statutory filings (PAYE, pension)",
        lawfulBasis: "Legal obligation",
        required: true,
        accepted: true,
      },
      {
        id: "c4",
        purpose: "WhatsApp and SMS nudges to your personal number",
        wasFor: "Interview logistics",
        nowFor: "Goal, review and learning reminders — revocable any time",
        lawfulBasis: "Consent",
        required: false,
        accepted: true,
      },
      {
        id: "c5",
        purpose: "Your profile in the internal mobility matcher",
        wasFor: "—",
        nowFor: "Being matched to internal roles",
        lawfulBasis: "Consent",
        required: false,
        accepted: true, // opted in — which is why PB-31 could scan her for Staff Engineer
      },
    ],
    retention:
      "Screening media deleted Nov 2025 on the 24-month schedule — clause 2 was declined at conversion.",
  },
};

/* ---- Org placement, buddies, first meetings ------------------------------ */

export const ORG_PLACEMENT = {
  manager: { name: "Ngozi Adeyemi", init: "NA", tone: "#16B364", role: "Engineering Manager" },
  skip: { name: "Obinna Kalu", init: "OK", tone: "#16B364", role: "VP Engineering" },
  squad: "Payments squad · Engineering · Lagos",
  squadSize: 6,
  /** DEPARTMENTS · Engineering headcount. */
  deptHeadcount: 84,
} as const;

export const BUDDIES = [
  {
    name: "Ngozi Adeyemi",
    init: "NA",
    tone: "#16B364",
    kind: "Culture buddy",
    why: "Manager — team graph + working-style alignment",
  },
  {
    name: "Tobi Balogun",
    init: "TB",
    tone: "#EBA308",
    kind: "Domain buddy",
    why: "Product & Design head — cross-pod context",
  },
  {
    name: "Amara Okonkwo",
    init: "AO",
    tone: "#AF52DE",
    kind: "Pairing mentor",
    why: "Already mentoring Chidi — see her Jun 2026 feedback on his record",
  },
] as const;

export const MEET_THE_TEAM = [
  { name: "Ngozi Adeyemi", init: "NA", tone: "#16B364", role: "Engineering Manager", note: "Your manager · runs the payments pod", firstMeeting: "Day 1 · 09:30" },
  { name: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer", note: "Your pairing mentor on the Go services", firstMeeting: "Day 1 · 14:00" },
  { name: "Tobi Balogun", init: "TB", tone: "#EBA308", role: "Head of Product & Design", note: "Domain buddy · owns the checkout surface", firstMeeting: "Day 3 · 11:00" },
  { name: "Adaeze Okafor", init: "AD", tone: "#16B364", role: "Senior Product Designer", note: "Designs the flows your services back", firstMeeting: "Day 4 · 10:00" },
  { name: "Obinna Kalu", init: "OK", tone: "#16B364", role: "VP Engineering", note: "Skip-level · monthly office hours", firstMeeting: "Day 10 · 16:00" },
] as const;

export type FirstMeeting = {
  with: string;
  init: string;
  tone: string;
  when: string;
  template: string;
  state: "scheduled" | "held";
};

/**
 * The last row IS `ONE_ON_ONES[1]` — "Chidi Okeke", "Tomorrow · 14:30", the
 * upcoming 30-day check-in — written through OneOnOnes' existing "Onboarding
 * 30-day" template. Not a new meeting, not a new scheduler.
 */
export const FIRST_MEETINGS: FirstMeeting[] = [
  { with: "Ngozi Adeyemi", init: "NA", tone: "#16B364", when: "Day 1 · 09:30", template: "Manager intro", state: "held" },
  { with: "Amara Okonkwo", init: "AO", tone: "#AF52DE", when: "Day 1 · 14:00", template: "Pairing kickoff", state: "held" },
  { with: "Tobi Balogun", init: "TB", tone: "#EBA308", when: "Day 3 · 11:00", template: "Domain buddy", state: "held" },
  { with: "Obinna Kalu", init: "OK", tone: "#16B364", when: "Day 10 · 16:00", template: "Skip-level intro", state: "scheduled" },
  { with: "Ngozi Adeyemi", init: "NA", tone: "#16B364", when: "Tomorrow · 14:30", template: "Onboarding 30-day", state: "scheduled" },
];

/* ============================================================================
 * PATH A · 3 — The 30/60/90 plan (the spine) + the manager approval gate
 * ==========================================================================*/

export type PlanMilestone = {
  day: 30 | 60 | 90;
  title: string;
  body: string;
  /** Provenance — what the AI draft was written FROM. */
  from: { source: string; detail: string }[];
  progress: number;
  state: "not-started" | "in-progress" | "done";
  dueOn: string;
  onTime?: boolean;
  /** What completing this milestone contributes to the FR-074 bridge. */
  creates?: string;
};

export type PlanApproval = {
  state: "ai-draft" | "manager-approved" | "manager-edited";
  drafter: string;
  draftedAt: string;
  manager: string;
  approvedAt?: string;
  /**
   * WHO clicked, which is not always the manager — People Ops can record an
   * approval on her behalf from the cockpit. Kept separate from `manager` so a
   * receipt can never claim she signed off when somebody else did.
   */
  approvedBy?: string;
  edits: { field: string; was: string; now: string }[];
};

export const PLAN_30_60_90: { approval: PlanApproval; milestones: PlanMilestone[] } = {
  /**
   * Seeded as "ai-draft" on purpose. The gate is clickable by the manager on
   * ManagerHome, shown as status on Onboarding.tsx, and chased — not approved —
   * in the cockpit. The hire never sees an unapproved plan.
   */
  approval: {
    state: "ai-draft",
    drafter: "Talent OS · role definition (Stage 2) + hiring scorecards (Stage 6)",
    draftedAt: "Jun 5",
    manager: "Ngozi Adeyemi",
    edits: [],
  },
  milestones: [
    {
      day: 30,
      title: "Learn the payments path end to end",
      body: "Ship two reviewed PRs in the Go services; own one on-call shadow rotation.",
      from: [
        { source: "Stage 2 role definition · BE-2031", detail: "\"Go services + payments domain\" as the primary competency" },
        { source: "Stage 6 interview scorecards", detail: "Kafka rated 3/5 — the lowest of five, so ramp starts there" },
      ],
      progress: 100,
      state: "done",
      dueOn: "Jul 31",
      onTime: true,
      creates: "Baseline competency profile written to the taxonomy",
    },
    {
      day: 60,
      title: "Own a service",
      body: "Take primary ownership of the reconciliation service; lead one incident review.",
      from: [
        { source: "Stage 2 role definition", detail: "L4 expectation: single-service ownership by month 3" },
        { source: "Team graph", detail: "Reconciliation is the least-bussed service in the pod" },
      ],
      progress: 55,
      state: "in-progress",
      dueOn: "Aug 30",
    },
    {
      day: 90,
      title: "Make the pod faster",
      body: "Propose one platform improvement with a measured before/after; complete probation review.",
      from: [{ source: "Stage 6 scorecards", detail: "\"Systems thinking\" scored 4/5 — stretch, not remedial" }],
      progress: 0,
      state: "not-started",
      dueOn: "Sep 29",
      creates: "First goals + first review date",
    },
  ],
};

/* ---- Brew · the onboarding buddy (RAG over the company handbook) ---------- */

export type HandbookDoc = {
  id: string;
  section: string;
  title: string;
  owner: string;
  updated: string;
  body: string;
};

/** The first policy corpus in the app — 8 documents, the whole of Brew's scope. */
export const HANDBOOK: HandbookDoc[] = [
  {
    id: "hb-expenses",
    section: "Money",
    title: "Expenses & reimbursement",
    owner: "Finance · Kemi Salami",
    updated: "Mar 2026",
    body:
      "Claim inside 30 days of the spend. Anything above ₦10,000 needs a receipt attached. Lagos ↔ Port Harcourt travel is booked through the ops desk, not claimed back. Approved claims are reimbursed with the payroll run on the 25th.",
  },
  {
    id: "hb-leave",
    section: "Time",
    title: "Leave & public holidays",
    owner: "People / HR · Funke Adebayo",
    updated: "Mar 2026",
    body:
      "20 working days of annual leave, plus all Nigerian public holidays. Up to 5 unused days carry into the next year and expire on 31 March. Site rotations book leave against the rotation calendar, not the office one.",
  },
  {
    id: "hb-payroll",
    section: "Money",
    title: "Payroll, payslips & statutory deductions",
    owner: "Finance · Kemi Salami",
    updated: "Mar 2026",
    body:
      "Salaries are paid on the 25th of each month. Payslips are issued through SeamlessHR — the same place reimbursements appear. PAYE and pension are deducted at source and remitted for you; your RSA PIN sits on your record.",
  },
  {
    id: "hb-remote",
    section: "Ways of working",
    title: "Where we work",
    owner: "People / HR · Funke Adebayo",
    updated: "Mar 2026",
    body:
      "Lagos HQ teams are in the office 3 days a week. Port Harcourt is site-based on the published rotation. Abuja is remote-first with a quarterly on-site week. Squad leads set which days, not HR.",
  },
  {
    id: "hb-hse",
    section: "Safety",
    title: "HSE requirements by location",
    owner: "HSE & Compliance · Chinedu Eze",
    updated: "Mar 2026",
    body:
      "Offshore rotations require OPITO BOSIET and a current fitness-to-work medical before boarding. Port Harcourt site roles add NEBOSH IGC for site leads. Lagos desk roles need the fitness-to-work medical only — no BOSIET, no NEBOSH.",
  },
  {
    id: "hb-learning",
    section: "Growth",
    title: "Learning budget & how to draw it",
    owner: "People / HR · Funke Adebayo",
    updated: "Mar 2026",
    body:
      "There is a ₦2.4M company L&D pool this year (FR-081). Courses and coaching are drawn as entitlements against it — you are never out of pocket and never expense them. Your manager approves anything above ₦120,000.",
  },
  {
    id: "hb-devices",
    section: "Ways of working",
    title: "Devices, accounts & access",
    owner: "Platform · Emeka Obi",
    updated: "Mar 2026",
    body:
      "Your laptop and accounts are provisioned through Microsoft Entra ID on day one — Google Workspace, Slack, Figma and GitHub arrive with your work email. Report a lost or stolen device inside 24 hours so access can be revoked.",
  },
  {
    id: "hb-conduct",
    section: "Conduct",
    title: "Code of conduct & speaking up",
    owner: "People / HR · Funke Adebayo",
    updated: "Mar 2026",
    body:
      "Gifts above ₦25,000 from a supplier are declared. Conflicts of interest are declared, not avoided in silence. Concerns can go to your manager, People Ops, or the anonymous channel — retaliation is itself a conduct breach.",
  },
];

export type BrewQA = {
  q: string;
  a: string;
  /** HandbookDoc ids the answer is grounded in — cited, like AskBar.tsx. */
  cites: string[];
  /** A PreboardTask id this answer can act on, where one exists. */
  task?: string;
  escalate?: string;
};

export const BREW_QA: BrewQA[] = [
  {
    q: "How do I claim expenses?",
    a: "Submit inside 30 days, with a receipt for anything over ₦10,000. It's reimbursed with the next payroll run on the 25th, through SeamlessHR — the same place as your payslip.",
    cites: ["hb-expenses", "hb-payroll"],
  },
  {
    q: "When do I get paid, and where's my payslip?",
    a: "The 25th of every month. Payslips are in SeamlessHR — PAYE and pension are already deducted and remitted for you, so the number you see is take-home.",
    cites: ["hb-payroll"],
  },
  {
    q: "How much leave do I have?",
    a: "20 working days plus Nigerian public holidays. Up to 5 unused days roll into next year and expire 31 March. As a July starter your first year is pro-rated — 10 days to 31 December.",
    cites: ["hb-leave"],
  },
  {
    q: "Do I need BOSIET?",
    a: "No. BOSIET is for offshore rotations and NEBOSH IGC for Port Harcourt site leads. You're a Lagos desk role, so the only requirement is the fitness-to-work medical — which is still open on your checklist.",
    cites: ["hb-hse"],
    task: "pb-medical",
  },
  {
    q: "Can the company pay for a Kafka course?",
    a: "Yes — courses come out of the ₦2.4M L&D pool as an entitlement, so you never pay and never expense it. Anything above ₦120,000 needs Ngozi's approval; a course sits well under that.",
    cites: ["hb-learning", "hb-expenses"],
  },
  {
    q: "How many days a week am I in the office?",
    a: "Three, at Lagos HQ — your squad lead picks which days, not HR. Port Harcourt and Abuja work differently, so ignore what you hear from those teams.",
    cites: ["hb-remote"],
  },
];

export const BREW_SCOPE =
  "Brew answers from the company handbook only — 8 documents, last updated Mar 2026. It cannot see your pay, your review, or anyone's record.";

export const BREW_ESCALATE = "Not what you needed? Ask People Ops →";

export const BREW_INTRO = "Brew · your onboarding buddy";

/* ============================================================================
 * PATH A · 4 — Pulse checks + the FR-074 bridge out
 * ==========================================================================*/

/**
 * Pointers into Posthire / Qoh — NOT a second survey instrument. The 5-dimension
 * QoH check-in that already runs at 30/60/90 IS the pulse.
 */
export const PULSE = [
  { day: 30, at: "Jul 31", state: "scored" as const, score: 4.2, note: "MissionControl: \"Chidi Okeke day-30 QoH check-in scored 4.2/5\"" },
  { day: 60, at: "Aug 30", state: "scheduled" as const },
  { day: 90, at: "Sep 29", state: "queued" as const, note: "MissionControl: \"Day-90 QoH survey sent for Chidi Okeke\"" },
];

export type BridgeArtifact = {
  id: string;
  what: string;
  detail: string;
  /** OS stage id the artifact lands in — the `go()` target. */
  go: string;
  landsIn: string;
  state: "pending" | "created";
};

export const BRIDGE_ARTIFACTS: BridgeArtifact[] = [
  {
    id: "br-goals",
    what: "First goals",
    detail: "Two draft OKRs seeded from the day-30 and day-60 milestones, owned by Chidi, Q4 2026.",
    go: "goals",
    landsIn: "Goals & OKRs",
    state: "pending",
  },
  {
    id: "br-review",
    what: "First review date",
    detail: "Enrolled in the Q4 2026 cycle — window Oct 5–16. The Sep 29 probation decision sits inside it.",
    go: "reviews",
    landsIn: "Review cycles",
    state: "pending",
  },
  {
    id: "br-baseline",
    what: "Baseline competency profile",
    detail: "Five competencies written at their Stage-6 interview score, into the same taxonomy the company uses.",
    go: "skillsgraph",
    landsIn: "Skills graph · People",
    state: "pending",
  },
  {
    id: "br-manager",
    what: "Manager handoff",
    detail: "Chidi joins Ngozi's team list and attention feed — onboarding ends into a person, never a void.",
    go: "manager",
    landsIn: "Manager home",
    state: "pending",
  },
];

/** Seeded on bridge-fire into GoalsOKR.tsx — badged "Seeded from onboarding". */
export const SEEDED_GOALS = [
  {
    id: "O-04",
    level: "Individual" as const,
    owner: "Chidi Okeke",
    objective: "Get to L4-independent on the Go services",
    progress: 0,
    status: "draft" as const,
    quarter: "Q4 2026",
    sub: "Seeded from onboarding",
    fromMilestone: 30 as const,
    krs: [
      { kr: "8 reviewed PRs merged without pairing", progress: 0, status: "on-track" as const },
      { kr: "Lead one incident review end to end", progress: 0, status: "on-track" as const },
    ],
  },
  {
    id: "O-05",
    level: "Individual" as const,
    owner: "Chidi Okeke",
    objective: "Own the reconciliation service end to end",
    progress: 0,
    status: "draft" as const,
    quarter: "Q4 2026",
    sub: "Seeded from onboarding",
    fromMilestone: 60 as const,
    krs: [
      { kr: "Zero attributable P1s for a quarter", progress: 0, status: "on-track" as const },
      { kr: "Reconciliation lag p95 40s → under 10s", progress: 0, status: "on-track" as const },
    ],
  },
];

/** ReviewCycles.tsx "Next cycle · Q4 2026" card. */
export const NEXT_CYCLE = {
  name: "Next cycle · Q4 2026",
  window: "Oct 5 – 16",
  note: "Probation decision Sep 29 sits inside it.",
  participants: [
    { name: "Chidi Okeke", init: "CO", tone: "#E81E17", first: true, note: "First cycle — enrolled by the 30/60/90 bridge" },
    { name: "Amara Okonkwo", init: "AO", tone: "#AF52DE", first: false },
    { name: "Adaeze Okafor", init: "AD", tone: "#16B364", first: false },
    { name: "Ngozi Obi", init: "NO", tone: "#16B364", first: false },
    { name: "Emeka Nwosu", init: "EN", tone: "#16B364", first: false },
    { name: "Halima Sule", init: "HS", tone: "#AF52DE", first: false },
  ],
};

/**
 * The baseline written at bridge-fire. Levels are the Stage-6 interview scores,
 * not aspirations — so EmployeeRecord's grey "at hire" tick has something under it.
 * Skill names are verbatim `SKILL_CLUSTERS` entries so SkillsGraph counts tick.
 */
export const BASELINE_COMPETENCIES = [
  { skill: "Go", cluster: "Engineering", level: 4, wasCount: 18, nowCount: 19 },
  { skill: "PostgreSQL", cluster: "Engineering", level: 4, wasCount: 22, nowCount: 23 },
  { skill: "Kafka", cluster: "Engineering", level: 3, wasCount: 10, nowCount: 11 },
  { skill: "Distributed systems", cluster: "Engineering", level: 3, wasCount: 12, nowCount: 12 },
  { skill: "Payments", cluster: "Engineering", level: 3, wasCount: 8, nowCount: 8 },
];

/* ============================================================================
 * PATH B · Existing workforce at rollout
 * ==========================================================================*/

export type ImportBatch = {
  id: string;
  source: string;
  runAt: string;
  pulled: number;
  merged: number;
  landed: number;
  stages: string[];
  fieldMap: { hris: string; talentos: string; filled: number }[];
};

export const IMPORT_BATCH: ImportBatch = {
  id: "IMP-BAM-01",
  /** The only HRIS with connected: true in Integrations.tsx. */
  source: "BambooHR",
  runAt: "Jun 15, 2026 · 21:40 WAT",
  pulled: 371,
  merged: 13,
  /** 358 — exactly COMMAND_KPIS' total-employee figure. */
  landed: 358,
  stages: [
    "Pulling profiles from BambooHR…",
    "Resolving identities — email + phone + fuzzy name…",
    "Merging duplicates · preserving consent states…",
    "Mapping 10 fields onto the person spine…",
  ],
  fieldMap: [
    { hris: "Legal name", talentos: "Name", filled: 358 },
    { hris: "Work email", talentos: "Work email", filled: 341 },
    { hris: "Mobile", talentos: "Personal phone", filled: 326 },
    { hris: "Job title", talentos: "Role", filled: 358 },
    { hris: "Department", talentos: "Dept", filled: 358 },
    { hris: "Work location", talentos: "Loc — Lagos 214 · PH 108 · Abuja 36", filled: 358 },
    { hris: "Pay grade", talentos: "Grade", filled: 312 },
    { hris: "Hire date", talentos: "Tenure", filled: 358 },
    { hris: "Employment type", talentos: "Contract", filled: 358 },
    { hris: "Reports to", talentos: "Line manager", filled: 349 },
  ],
};

export type InviteChannel = "Work email" | "WhatsApp" | "SMS";

/** Account-claim state. Deliberately NOT merged into Employee.status — orthogonal axes. */
export type ClaimState = "not-invited" | "invited" | "opened" | "claimed" | "baselined" | "bounced";

/** How a person renders on an invite roster — five fields, one owner. */
export type InviteIdentity = { name: string; init: string; tone: string; dept: string; loc: string };

export type InviteRow = {
  empId: string;
  /**
   * ONLY for the two invitees the app knows without an `EMPLOYEES` row. Anyone
   * with a row is resolved through it, so a tone or department edited on the
   * person spine reaches /claim and the cockpit without a second edit here.
   */
  identity?: InviteIdentity;
  channel: InviteChannel | "—";
  sentAt: string;
  state: ClaimState;
  claimedAt?: string;
  baselineMethod?: "AI chat" | "CV upload";
  note?: string;
};

/**
 * Ten real people. Eight are `EMPLOYEES` rows by id; Ngozi Adeyemi (Engineering
 * head, the manager persona) and Kelechi Umeh (CT-871, fixed-term Engineering)
 * exist in the app without an EMPLOYEES row, so they carry their own identity.
 */
export const INVITES: InviteRow[] = [
  { empId: "E-0214", channel: "Work email", sentAt: "Jun 16 · 08:00", state: "baselined", claimedAt: "Jun 16 · 09:12", baselineMethod: "AI chat" },
  { empId: "E-0176", identity: { name: "Ngozi Adeyemi", init: "NA", tone: "#16B364", dept: "Engineering", loc: "Lagos" }, channel: "Work email", sentAt: "Jun 16 · 08:00", state: "baselined", claimedAt: "Jun 16 · 08:31", baselineMethod: "CV upload", note: "Managers invited first — manager adoption is the critical path (PRD §12)" },
  { empId: "E-0231", channel: "WhatsApp", sentAt: "Jun 16 · 08:05", state: "baselined", claimedAt: "Jun 17 · 19:40", baselineMethod: "AI chat", note: "No work email — site crew reached on WhatsApp" },
  { empId: "E-0129", channel: "WhatsApp", sentAt: "Jun 16 · 08:05", state: "opened", note: "Opened on 2G, dropped at identity step — SMS fallback queued" },
  { empId: "E-0250", channel: "SMS", sentAt: "Jun 16 · 08:10", state: "invited", note: "Contractor — feature phone, SMS only" },
  { empId: "E-0165", channel: "Work email", sentAt: "Jun 16 · 08:00", state: "baselined", claimedAt: "Jun 18 · 11:05", baselineMethod: "CV upload" },
  { empId: "E-0187", channel: "Work email", sentAt: "Jun 16 · 08:00", state: "claimed", claimedAt: "Jun 19 · 15:22", note: "Claimed but not yet baselined — skipped the skills step" },
  { empId: "E-0198", channel: "Work email", sentAt: "Jun 16 · 08:00", state: "baselined", claimedAt: "Jun 16 · 10:47", baselineMethod: "AI chat" },
  { empId: "E-0092", channel: "—", sentAt: "—", state: "not-invited", note: "On notice — excluded from the cohort; FR-063 owns his path" },
  { empId: "E-0221", identity: { name: "Kelechi Umeh", init: "KU", tone: "#16B364", dept: "Engineering", loc: "Lagos" }, channel: "Work email", sentAt: "Jun 16 · 08:00", state: "bounced", note: "BambooHR address stale — WhatsApp retry queued" },
];

/** Resolves an invite onto the person spine — the roster's only identity source. */
export const inviteIdentity = (r: InviteRow): InviteIdentity => {
  const e = EMPLOYEES.find((x) => x.id === r.empId);
  if (e) return { name: e.name, init: e.init, tone: e.tone, dept: e.dept, loc: e.loc };
  if (r.identity) return r.identity;
  // Matching no EMPLOYEES id and carrying no inline identity means a mistyped
  // empId, not a real person. Loud in development so the seed gets fixed; soft
  // in production, because one bad roster row should not take /claim down.
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`inviteIdentity: ${r.empId} matches no EMPLOYEES row and carries no inline identity`);
  }
  return { name: r.empId, init: "??", tone: "#475569", dept: "—", loc: "—" };
};

export const ROLLOUT = {
  cohort: 358,
  excluded: 3,
  invited: 351,
  channelSplit: { "Work email": 271, WhatsApp: 68, SMS: 12 },
  opened: 322,
  claimed: 289,
  baselined: 241,
  bounced: 7,
  window: "two weeks from Jun 16",
  /** The spec's "about five minutes", measured. */
  medianClaimMinutes: 4.6,
} as const;

export type ClaimStep = {
  id: string;
  title: string;
  sub: string;
  minutes: number;
  partner?: Partner;
  detail: string[];
};

export const CLAIM_STEPS: ClaimStep[] = [
  {
    id: "verify",
    title: "Verify it's you",
    sub: "NIN slip + a liveness selfie",
    minutes: 1.5,
    partner: "Smile ID",
    detail: [
      "The same check the hiring side runs at Stage 8",
      "Your selfie is matched, then discarded — only the match result is kept",
    ],
  },
  {
    id: "confirm",
    title: "Check what we imported",
    sub: "9 fields from BambooHR — fix anything wrong",
    minutes: 2,
    detail: [
      "Nothing here was typed by you",
      "Anything you correct raises a change request to People Ops — it does not silently overwrite",
    ],
  },
  {
    id: "baseline",
    title: "Build your skills baseline",
    sub: "A 6-question chat, or upload your CV",
    minutes: 1.5,
    detail: [
      "Writes to the same skills taxonomy the whole company uses (FR-076)",
      "You can edit or delete any skill afterwards",
    ],
  },
];

/**
 * Step 2's field list, straight off Amara's EMPLOYEES row — with ONE field
 * imported wrong on purpose (grade L4; she is L5), so "confirm or correct" has
 * teeth and the change-request path actually gets exercised.
 */
export const IMPORTED_PROFILE: { field: string; imported: string; correct?: string; wrong?: boolean }[] = [
  { field: "Name", imported: "Amara Okonkwo" },
  { field: "Role", imported: "Senior Software Engineer" },
  { field: "Department", imported: "Engineering" },
  { field: "Location", imported: "Lagos" },
  { field: "Grade", imported: "L4", correct: "L5", wrong: true },
  { field: "Contract", imported: "Permanent" },
  { field: "Hire date", imported: "Nov 2023 · 2y 8m" },
  { field: "Line manager", imported: "Ngozi Adeyemi" },
  { field: "Work email", imported: "amara.okonkwo@unrealabs.ng" },
];

/** The 6-question baseline chat. `writes` uses SKILL_CLUSTERS names verbatim. */
export const BASELINE_CHAT: {
  q: string;
  hint?: string;
  sample: string;
  writes: { skill: string; cluster: string; level: number }[];
}[] = [
  {
    q: "What kind of work have you spent the most time on in the last year?",
    hint: "One or two sentences is plenty",
    sample: "Mostly backend — the payments services, and the ledger reconciliation that sits under them.",
    writes: [
      { skill: "Payments", cluster: "Engineering", level: 5 },
      { skill: "Distributed systems", cluster: "Engineering", level: 4 },
    ],
  },
  {
    q: "Which languages or tools do you reach for first?",
    sample: "Go for services, PostgreSQL for anything with money in it.",
    writes: [
      { skill: "Go", cluster: "Engineering", level: 5 },
      { skill: "PostgreSQL", cluster: "Engineering", level: 4 },
    ],
  },
  {
    q: "Tell me about something you built that other teams now depend on.",
    sample: "The idempotency layer in the payments gateway — three squads call it now.",
    writes: [{ skill: "Distributed systems", cluster: "Engineering", level: 5 }],
  },
  {
    q: "Where do you feel least confident?",
    hint: "Honest answers make the plan useful — nobody is scored on this",
    sample: "Kafka. I can operate it, but I would not want to design the topology from scratch.",
    writes: [{ skill: "Kafka", cluster: "Engineering", level: 3 }],
  },
  {
    q: "Do you mentor, review or lead anyone today?",
    sample: "I pair with Chidi weekly and review most of the payments PRs.",
    writes: [{ skill: "Mentoring", cluster: "Engineering", level: 4 }],
  },
  {
    q: "What would you like to be doing in 18 months?",
    hint: "This shapes your growth plan, not your review",
    sample: "Staff-level platform work — owning the payments architecture rather than services inside it.",
    writes: [],
  },
];

export const BASELINE_METHODS = [
  { method: "AI chat" as const, label: "6-question chat", used: 138, medianMinutes: 3.1, note: "Richer signal — picks up mentoring and leadership that a CV omits" },
  { method: "CV upload" as const, label: "Upload your CV", used: 103, medianMinutes: 1.4, note: "About 2× faster than the chat — which is why baselining trails claiming" },
];

/* ---- The value-first landing (the single most important Path-B decision) --- */

/**
 * The ORDER IS THE PRODUCT DECISION. Nothing that reads as monitoring appears
 * above the fold — the first three cards are things the employee GETS.
 *
 * NEGATIVE CONSTRAINT: this screen shows no score about the employee, no
 * ranking, no activity metric, and nothing their manager set. Do not add one.
 */
export const CLAIM_LANDING_ORDER = ["growth", "learning", "feedback", "transparency"] as const;

export const GROWTH_SKELETON = {
  headline: "Your growth plan — first draft",
  from: "Your 6-answer baseline + your role",
  /** No ring: a freshly claimed profile has no review history to compute one from. */
  readiness: null as number | null,
  readinessNote:
    "No readiness score yet — that needs one review cycle. Here's the shape of the plan instead.",
  targets: [{ role: "Staff Engineer (Platform)", match: 87 }],
  gaps: [
    { skill: "Technical leadership", have: 3, need: 5 },
    { skill: "Kafka", have: 3, need: 4 },
  ],
  next: [
    "Pick a target role",
    "Add one milestone",
    "Your manager sees it only when you share it",
  ],
};

/**
 * Draws on the same ₦2.4M FR-081 pool LearningHub.tsx renders — no second pool.
 * BUILD NOTE: step 1 of the build order moves LearningHub's POOL_TOTAL /
 * COURSE_COST / COACHING_COST into talentos.ts as LND_POOL. When it lands,
 * import it here and delete `poolNaira` + `approverThreshold` below.
 */
export const LND_ENTITLEMENT = {
  headline: "Your learning is paid for",
  body: "₦2.4M company pool this year. Courses and coaching are drawn as entitlements — you never pay out of pocket.",
  approver: "Your manager approves anything over ₦120,000.",
  yourDraw: 0,
  poolNaira: 2_400_000,
  approverThreshold: 120_000,
};

export const FEEDBACK_INVITE = {
  headline: "Say something, to anyone",
  body: "Give feedback, or ask for it. Requests are visible to you and the person asked — nothing anonymous, per PRD §7.",
  actions: ["Give feedback", "Request feedback"],
};

/* ============================================================================
 * The transparency layer — what a manager sees vs what stays private
 * ==========================================================================*/

export type VisibilityRow = {
  item: string;
  manager: "sees" | "sees-summary" | "no";
  hr: "sees" | "sees-summary" | "no";
  why: string;
  /** The existing surface this sentence is assembled FROM — every row is cited. */
  source: string;
};

export const VISIBILITY: VisibilityRow[] = [
  {
    item: "Your goals and check-in progress",
    manager: "sees",
    hr: "sees-summary",
    why: "Your manager needs the detail to help; HR sees completion rates, not your wording.",
    source: "My goals · check-ins",
  },
  {
    item: "Your review scores and recommendation",
    manager: "sees",
    hr: "sees",
    why: "Both sit in the calibration room — that is what calibration is.",
    source: "ReviewCycles · calibration",
  },
  {
    item: "Feedback you give about someone",
    manager: "no",
    hr: "no",
    why: "It goes to the person you wrote it about, and nobody else. Requests are visible to you and the person asked — nothing anonymous, per PRD §7.",
    source: "FeedbackHub · PRD §7",
  },
  {
    item: "Feedback others give about you",
    manager: "sees",
    hr: "sees",
    why: "It lands on your profile and feeds your review packet — there is no separate silo.",
    source: "EmployeeRecord · Feedback",
  },
  {
    item: "Your 1-on-1 notes",
    manager: "sees",
    hr: "no",
    why: "Both participants, and only after both consent to the AI summary. Recording stays locked until then, and the consent itself is audit-logged.",
    source: "OneOnOnes · consent gate + NDPR audit entry",
  },
  {
    item: "Which internal roles you browsed",
    manager: "no",
    hr: "no",
    why: "Managers cannot see who browsed, matched or declined — only accepted invitations surface.",
    source: "Mobility · opt-in governance",
  },
  {
    item: "Whether you're opted into internal matching",
    manager: "no",
    hr: "sees-summary",
    why: "HR sees the org-wide opt-in rate (60% this quarter). Your individual choice is not attached to your name for your manager.",
    source: "Mobility · opt-in governance",
  },
  {
    item: "Learning enrolments and credits drawn",
    manager: "sees-summary",
    hr: "sees",
    why: "Your manager approves spend over ₦120,000, so they see the amount — not the subject you chose.",
    source: "LearningHub · FR-081",
  },
  {
    item: "Your payslip and pay band",
    manager: "no",
    hr: "sees",
    why: "Payslips are yours, through SeamlessHR. Your manager sees a band for planning, never your slip.",
    source: "My profile · SeamlessHR · FR-080",
  },
  {
    item: "Your leave-risk score",
    manager: "no",
    hr: "sees",
    why: "Visible to HRBP+ only — access is logged, every single view. It never triggers automated action: the model proposes, an HRBP decides.",
    source: "EmployeeRecord · People · Attrition — all three say access-logged",
  },
  {
    item: "Your skills baseline",
    manager: "sees",
    hr: "sees",
    why: "It is the same 1–5 taxonomy used for JD rubrics, scorecards, reviews, growth and mobility — one scale everywhere.",
    source: "SkillsGraph · FR-076",
  },
  {
    item: "Exit-interview answers, if you ever leave",
    manager: "no",
    hr: "sees-summary",
    why: "Answers are scored into attrition themes; the verbatim goes to People Ops with consent recorded, never to your manager.",
    source: "Offboarding · FR-063",
  },
];

/** Row 10 is the one that earns trust — it states the uncomfortable thing plainly. */
export const VISIBILITY_CALLOUT_INDEX = 9;

export const RIGHT_TO_EXPLANATION = {
  headline: "Every automated call about you can be explained",
  body:
    "If an AI-assisted decision affects you — a leave-risk flag, a mobility match, a screening score — you can ask what it was based on and who saw it. A person answers, not a model.",
  mirrors:
    "The same right candidates get at Stage 4 (Screening — every knockout rejection carries a cited reason and a right-to-explanation).",
  decisions: [
    {
      what: "Leave-risk score",
      who: "HRBP · Funke Adebayo",
      basis: "Tenure since promotion, pay vs band, engagement trend",
      yourMove: "Request the reasons + the model card",
    },
    {
      what: "Internal mobility match %",
      who: "You only",
      basis: "Skills-taxonomy overlap with the role's requirement set",
      yourMove: "See the four dimensions and their weights",
    },
    {
      what: "Growth readiness estimate",
      who: "You + your manager",
      basis: "Review history, skill coverage, mentoring signals",
      yourMove: "Ask which signal moved it",
    },
    {
      what: "Quality-of-hire score, day 90",
      who: "HR + your manager",
      basis: "Manager rating, peer feedback, output velocity, engagement",
      yourMove: "See your own composite",
    },
  ],
  slaDays: 7,
  logged: "Every request is audit-logged — and so is every view of your risk score.",
};

/* ============================================================================
 * Metrics — ONE source, four renders
 * (Analytics tab · the cockpit · Onboarding.tsx strip · MeHome + Qoh)
 * ==========================================================================*/

export type Kpi = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  target?: string;
  hit: boolean;
  sub: string;
  tone: KpiTone;
};

export const ONBOARDING_METRICS: { recruiter: Kpi[]; pathA: Kpi[]; pathB: Kpi[] } = {
  recruiter: [
    { key: "r-role-live", label: "Time to first role live", value: "6", unit: "days", target: "≤ 7 days", hit: true, sub: "Signup → first requisition published", tone: "green" },
    { key: "r-shortlist", label: "Time to first shortlist", value: "31", unit: "hours", target: "≤ 48 hours", hit: true, sub: "Screening's own time-to-shortlist figure", tone: "green" },
    { key: "r-backlog", label: "Backlog-import adoption", value: "68", unit: "%", target: "≥ 60% in week 1", hit: true, sub: "212 profiles pulled · 14 duplicates merged", tone: "green" },
    { key: "r-seats", label: "Seats invited / accepted", value: "42 / 58", target: "≥ 70% accepted", hit: true, sub: "72% of provisioned seats activated", tone: "green" },
    { key: "r-actions", label: "Shortlist actions, week one", value: "31", target: "≥ 20", hit: true, sub: "Counted from the audit log's candidate moves", tone: "green" },
  ],
  pathA: [
    { key: "a-preboard", label: "Preboarding before day 1", value: "92", unit: "%", target: "≥ 90%", hit: true, sub: "11 of 12 Jun-cohort hires finished every required task", tone: "green" },
    { key: "a-activation", label: "Day-1 activation", value: "100", unit: "%", target: "same-day", hit: true, sub: "Work email + SSO at 08:47 · 5 of 6 systems live by 10:15", tone: "green" },
    { key: "a-plan", label: "30/60/90 on-time completion", value: "78", unit: "%", target: "≥ 80%", hit: false, sub: "Day-60 is where it slips — ownership milestones run late", tone: "yellow" },
    { key: "a-pulse", label: "New-hire pulse", value: "4.2", unit: "/ 5", target: "≥ 4.0", hit: true, sub: "The same 5-dimension instrument Qoh runs at 30/60/90", tone: "green" },
    { key: "a-qoh", label: "QoH coverage at day 90", value: "74", unit: "%", target: "≥ 80%", hit: false, sub: "35 of 47 in the Q1 2026 cohort responded", tone: "yellow" },
  ],
  pathB: [
    { key: "b-claim", label: "Claim rate", value: "82", unit: "%", target: "≥ 80% within two weeks", hit: true, sub: "289 of 351 invited · median 4.6 min to claim", tone: "green" },
    { key: "b-baseline", label: "Profiles competency-baselined", value: "67", unit: "%", target: "≥ 80% by month 3", hit: false, sub: "241 of 358 · CV upload runs ~2× faster than the chat", tone: "yellow" },
    { key: "b-active", label: "Weekly active, past month one", value: "84", unit: "%", target: "≥ 80%", hit: true, sub: "Held since May — Field Ops opt-in lifted +18pp after site WhatsApp groups", tone: "green" },
  ],
};

/** Convenience lookup for the surfaces that render a single tile. */
export const kpiByKey = (key: string): Kpi | undefined =>
  [...ONBOARDING_METRICS.recruiter, ...ONBOARDING_METRICS.pathA, ...ONBOARDING_METRICS.pathB].find(
    (k) => k.key === key,
  );
