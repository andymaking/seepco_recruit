/**
 * engage.ts — PRD v2.1 WS-8: FR-094 engagement surveys + FR-095 HR helpdesk.
 *
 * Two surfaces that look adjacent and are governed by opposite rules.
 *
 * FR-094 is the LISTENING instrument. Its hard problem is not question design,
 * it is re-identification: a "team" filter on a squad of six turns an anonymous
 * pulse into a named accusation. Anonymity is therefore modelled in the DATA,
 * not in the chrome — a slice below MIN_REPORTING_N carries no `result` object
 * at all, so there is nothing for a screen to render even if it tries.
 *
 * FR-095 is the ASKING channel. An employee raises a ticket; HR answers it.
 *
 * ── BINDING INVARIANTS ─────────────────────────────────────────────────────
 *
 * E1. THE FIREWALL. A helpdesk ticket is the EMPLOYEE ASKING. A disciplinary
 *     case (FR-088, `@/data/hrops` DISCIPLINARY_CASES) is HR ISSUING. They are
 *     different objects, with different subjects, different access rules and
 *     different retention. A ticket MUST NEVER escalate — automatically or by a
 *     single click — into a case. There is no `caseId` on Ticket, no `ticketId`
 *     on DisciplinaryCase, and this module does not import hrops.ts. If HR
 *     decides a conduct matter exists, they open a case from scratch, from
 *     evidence, under FR-088's own governance. Asking a question about your
 *     payslip is not the first step of a disciplinary process, and a product
 *     that lets it become one has taught its employees never to ask.
 *     (W-3305 Musa Bello holds BOTH a closed ticket here and an open case in
 *     hrops.ts. The two records do not link, do not cross-reference and do not
 *     appear in each other's views. That he holds both is the reason E1 exists.)
 *
 * E2. MIN_REPORTING_N = 5. No slice of survey results is reportable below five
 *     respondents — not to HR, not to the executive, not to the manager who
 *     owns the team. Suppressed slices in this file carry `result: undefined`.
 *     `SUPPRESSION_AUDIT()` proves it and is meant to render.
 *
 * E3. RESPONSE RECEIPTS ARE NEVER JOINED TO ANSWERS. The platform knows THAT
 *     Amara has not yet answered SR-31 (so it can remind her) and never WHAT
 *     anyone answered. `SURVEY_INVITES` is the receipt table; `RESULT_SLICES`
 *     is the answer table; nothing keys one to the other.
 *
 * E4. FREE TEXT IS THE RE-IDENTIFICATION SURFACE. Every comment carries
 *     `released: false` until a named human clears it, with `reviewNote` saying
 *     why. Health circumstances are never released at any n.
 *
 * E5. AI PROPOSES, HUMANS DECIDE (FR-093). The triage suggestion carries a
 *     `WhyThis` and a human `decision`. Nothing here auto-assigns, auto-closes
 *     or auto-categorises. `ENGAGE_AI_SURFACES` is the registry row this module
 *     adds to trust.ts's 100% coverage gate.
 *
 * E6. PROTECTED AND NCDMB ATTRIBUTES (nationality, hostCommunity) are reporting
 *     fields only. No survey slice in this file cuts by them, and no triage
 *     input reads them.
 *
 * E7. VENDOR-NEUTRAL. Where a helpdesk answer touches payment, it says "your
 *     payroll system" / "the connected payroll source". The payroll vendor
 *     decision is open.
 *
 * Deterministic: no Date.now(), no Math.random(). Reference day is Aug 28, 2026.
 */
import { HANDBOOK, type HandbookDoc } from "@/data/onboarding";
import type { AiSurface, ModelCard, WhyThis } from "@/data/trust";
import type { PfTone } from "@/components/os/ui";

/** The day every "elapsed" and "closes in" figure in this file is measured from. */
export const ENGAGE_TODAY = "Aug 28, 2026";

/* ==========================================================================
 * FR-094 — SURVEYS
 * ========================================================================== */

export type SurveyType = "pulse" | "onboarding" | "exit" | "enps" | "custom";

export const SURVEY_TYPE_LABEL: Record<SurveyType, string> = {
  pulse: "Engagement pulse",
  onboarding: "Onboarding 30/60/90",
  exit: "Exit survey",
  enps: "eNPS",
  custom: "Custom",
};

export type SurveyCadence = "Weekly" | "Monthly" | "Quarterly" | "Event-triggered" | "One-off";

/**
 * Three modes, and the difference is not cosmetic.
 *  · anonymous   — no identity is stored with the answer, at all. Reportable
 *                  only in slices of MIN_REPORTING_N or more.
 *  · confidential— identity is stored, visible to HR only, never to the manager.
 *  · attributed  — the respondent's name travels with the answer and they are
 *                  told so before the first question.
 */
export type AnonymityMode = "anonymous" | "confidential" | "attributed";

export const ANONYMITY_LABEL: Record<AnonymityMode, string> = {
  anonymous: "Anonymous",
  confidential: "Confidential to HR",
  attributed: "Attributed",
};

export const ANONYMITY_PROMISE: Record<AnonymityMode, string> = {
  anonymous:
    "Your name is not stored with your answers. Results are only ever shown for groups of 5 or more respondents, so no one can work out who said what.",
  confidential:
    "People Ops can see who said what. Your manager cannot, and never will. Results reach your manager only as a group score.",
  attributed:
    "Your name travels with your answer. You are seeing this notice before the first question because that is the deal.",
};

export type QuestionKind = "likert5" | "single-choice" | "free-text";

/** The five dimensions every pulse rolls up to. Stable keys — trends depend on it. */
export type DriverKey = "manager" | "workload" | "recognition" | "growth" | "trust";

export type DriverMeta = { key: DriverKey; name: string; icon: string; blurb: string };

export const DRIVERS: DriverMeta[] = [
  { key: "manager", name: "Manager support", icon: "users", blurb: "Does your manager back you, unblock you and know what you are working on?" },
  { key: "workload", name: "Workload", icon: "pulse", blurb: "Is the volume of work sustainable at the pace it is being asked for?" },
  { key: "recognition", name: "Recognition", icon: "star", blurb: "Is good work seen and said out loud?" },
  { key: "growth", name: "Growth", icon: "trend", blurb: "Is there a next step, and a route to it?" },
  { key: "trust", name: "Trust in leadership", icon: "shield", blurb: "Do people believe what leadership tells them?" },
];

export const driverMeta = (key: DriverKey): DriverMeta => DRIVERS.find((d) => d.key === key)!;

export type SurveyQuestion = {
  id: string;
  kind: QuestionKind;
  text: string;
  /** Likert questions roll into a driver. Free-text and demographics do not. */
  driver?: DriverKey;
  choices?: string[];
  required: boolean;
  /** Rendered under free-text boxes — the honesty the anonymity promise requires. */
  hint?: string;
};

/**
 * Audience rules. NOTE E6: `dept`, `site` and `worker-type` are the only cuts.
 * There is deliberately no `nationality` or `hostCommunity` audience kind —
 * those are NCDMB reporting fields and never a way to select who gets asked.
 */
export type AudienceRule = {
  kind: "all" | "dept" | "site" | "worker-type";
  values?: string[];
  label: string;
  /** Eligible population after the FR-082 analytics.engagement exclusions. */
  estimated: number;
  note?: string;
};

export type SurveyDef = {
  id: string;
  name: string;
  type: SurveyType;
  cadence: SurveyCadence;
  anonymity: AnonymityMode;
  /** How long a run stays open, in working days. */
  windowDays: number;
  owner: string;
  audience: AudienceRule;
  questions: SurveyQuestion[];
  purpose: string;
};

const LIKERT_SCALE = ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"];

export const LIKERT_ANCHORS: string[] = LIKERT_SCALE;

export const SURVEY_DEFS: SurveyDef[] = [
  {
    id: "SD-01",
    name: "Quarterly Engagement Pulse",
    type: "pulse",
    cadence: "Quarterly",
    anonymity: "anonymous",
    windowDays: 10,
    owner: "People / HR · Funke Adebayo",
    audience: {
      kind: "all",
      label: "All employees and NYSC interns",
      estimated: 331,
      note: "Contractor and agency workers are out of scope — their FR-082 engagement flag is false, and they answer their contracting company's instrument, not ours.",
    },
    purpose: "The company-wide read on the five drivers, plus eNPS. The instrument every trend in the product is measured against.",
    questions: [
      { id: "q1", kind: "likert5", text: "My manager gives me the support I need to do my job well.", driver: "manager", required: true },
      { id: "q2", kind: "likert5", text: "The amount of work I am asked to do is sustainable.", driver: "workload", required: true },
      { id: "q3", kind: "likert5", text: "Work I do well is noticed and acknowledged.", driver: "recognition", required: true },
      { id: "q4", kind: "likert5", text: "I can see a next step for my career here.", driver: "growth", required: true },
      { id: "q5", kind: "likert5", text: "I trust what leadership tells us about the direction of the company.", driver: "trust", required: true },
      { id: "q6", kind: "single-choice", text: "How likely are you to recommend Unrealabs as a place to work?", choices: ["0–6 · Not likely", "7–8 · Neutral", "9–10 · Very likely"], required: true },
      {
        id: "q7",
        kind: "free-text",
        text: "What is the one thing you would change?",
        required: false,
        hint: "Free text is read by People Ops before any of it is shared. Comments that could identify you or anyone else are not released. Please do not include names.",
      },
    ],
  },
  {
    id: "SD-02",
    name: "Onboarding 30 / 60 / 90",
    type: "onboarding",
    cadence: "Event-triggered",
    anonymity: "confidential",
    windowDays: 5,
    owner: "People / HR · Funke Adebayo",
    audience: {
      kind: "worker-type",
      values: ["employee", "nysc"],
      label: "Joiners at day 30, 60 and 90",
      estimated: 14,
      note: "Fires off the FR-087 probation clock, so a joiner is asked on the same schedule their confirmation evidence is compiled on.",
    },
    purpose: "Catches a bad start while it is still fixable. Confidential rather than anonymous, because a joiner's answer is only useful if someone can follow it up with them.",
    questions: [
      { id: "q1", kind: "likert5", text: "I had what I needed on day one — laptop, accounts, access.", required: true },
      { id: "q2", kind: "likert5", text: "I understand what is expected of me in this role.", driver: "manager", required: true },
      { id: "q3", kind: "likert5", text: "The job matches what I was told during hiring.", driver: "trust", required: true },
      { id: "q4", kind: "single-choice", text: "Have you met your buddy?", choices: ["Yes, regularly", "Once", "Not yet"], required: true },
      { id: "q5", kind: "free-text", text: "What would have made your first weeks easier?", required: false, hint: "Shared with People Ops. Your manager sees a summary, not your words, unless you ask us to pass them on." },
    ],
  },
  {
    id: "SD-03",
    name: "Exit survey",
    type: "exit",
    cadence: "Event-triggered",
    anonymity: "confidential",
    windowDays: 14,
    owner: "People / HR · Funke Adebayo",
    audience: {
      kind: "all",
      label: "Leavers, from notice to last day",
      estimated: 11,
      note: "Structured reasons feed EXIT_REASONS in aggregate only. A named exit reason never reaches a manager's dashboard.",
    },
    purpose: "The structured leaving reason. Free text here is the highest re-identification risk in the product — a leaver describes exactly one job.",
    questions: [
      { id: "q1", kind: "single-choice", text: "What is the main reason you are leaving?", choices: ["Pay vs market", "Career growth stalled", "Relocation / japa", "Manager relationship", "Rotation / site conditions", "Other"], required: true },
      { id: "q2", kind: "likert5", text: "I would recommend this company to someone I respect.", driver: "trust", required: true },
      { id: "q3", kind: "likert5", text: "My manager gave me a fair chance to grow here.", driver: "growth", required: true },
      { id: "q4", kind: "free-text", text: "What could we have done differently?", required: false, hint: "Held by People Ops. Nothing you write is shared with your manager or shown in a report while you can still be identified from it." },
    ],
  },
  {
    id: "SD-04",
    name: "Payments programme — workload check",
    type: "custom",
    cadence: "One-off",
    anonymity: "anonymous",
    windowDays: 5,
    owner: "Engineering · Ngozi Adeyemi (with People Ops)",
    audience: {
      kind: "dept",
      values: ["Engineering"],
      label: "Engineering — Lagos",
      estimated: 84,
      note: "Raised against AN-103. Runs at DEPARTMENT scope on purpose: a squad-level cut of 6 people could not be reported anyway (E2).",
    },
    purpose: "A targeted read on the one driver AN-103 says is moving. Not a second pulse — five questions, one dimension, one department.",
    questions: [
      { id: "q1", kind: "likert5", text: "The current release schedule is sustainable.", driver: "workload", required: true },
      { id: "q2", kind: "likert5", text: "I have been able to take my time off as planned.", driver: "workload", required: true },
      { id: "q3", kind: "likert5", text: "Priorities have been clear enough to say no to things.", driver: "manager", required: true },
      { id: "q4", kind: "single-choice", text: "How many weekends have you worked in the last eight weeks?", choices: ["None", "1–2", "3–4", "5 or more"], required: true },
      { id: "q5", kind: "free-text", text: "What would take the most pressure off, soonest?", required: false, hint: "Anonymous. Please describe the work, not the people." },
    ],
  },
];

export const surveyDef = (id: string): SurveyDef | undefined => SURVEY_DEFS.find((d) => d.id === id);

export type SurveyRunState = "Draft" | "Open" | "Closing" | "Closed" | "Reporting";

export type SurveyRun = {
  id: string;
  defId: string;
  name: string;
  opened: string;
  closes: string;
  invited: number;
  responded: number;
  /** Always Math.round(responded / invited * 100) — `rateOf()` recomputes it. */
  responseRate: number;
  state: SurveyRunState;
  /** Working days left on the reference day. Negative once closed. */
  daysLeft: number;
  note?: string;
};

export const SURVEY_RUNS: SurveyRun[] = [
  {
    id: "SR-31",
    defId: "SD-01",
    name: "Engagement Pulse · Q3 2026",
    opened: "Aug 24, 2026",
    closes: "Sep 4, 2026",
    invited: 331,
    responded: 198,
    responseRate: 60,
    state: "Open",
    daysLeft: 5,
    note: "Open now. 133 people have not answered — including E-0214.",
  },
  {
    id: "SR-30",
    defId: "SD-04",
    name: "Payments programme — workload check",
    opened: "Aug 26, 2026",
    closes: "Sep 2, 2026",
    invited: 84,
    responded: 39,
    responseRate: 46,
    state: "Open",
    daysLeft: 3,
    note: "Raised off AN-103 by the Engineering manager, run by People Ops so the department does not hold its own team's raw answers.",
  },
  {
    id: "SR-28",
    defId: "SD-01",
    name: "Engagement Pulse · Q2 2026",
    opened: "May 18, 2026",
    closes: "May 29, 2026",
    invited: 324,
    responded: 231,
    responseRate: 71,
    state: "Reporting",
    daysLeft: -63,
    note: "The comparison every delta in this module is measured against.",
  },
  {
    id: "SR-27",
    defId: "SD-02",
    name: "Onboarding 30/60/90 · rolling",
    opened: "Jul 1, 2026",
    closes: "Sep 30, 2026",
    invited: 14,
    responded: 9,
    responseRate: 64,
    state: "Open",
    daysLeft: 23,
    note: "Rolling — each joiner is invited on their own day 30, 60 and 90.",
  },
];

export const surveyRun = (id: string): SurveyRun | undefined => SURVEY_RUNS.find((r) => r.id === id);

export const rateOf = (r: SurveyRun): number => Math.round((r.responded / r.invited) * 100);

export const runStateTone = (s: SurveyRunState): PfTone =>
  s === "Open" ? "green" : s === "Closing" ? "yellow" : s === "Draft" ? "grey" : "blue";

/* ------------------------- anonymity & suppression ------------------------ */

/**
 * THE NUMBER (E2). Five. Not four, not "manager's discretion".
 *
 * The failure this prevents is concrete: Amara sits in a Payments squad of six.
 * If a manager can filter results to that squad, four responses and a Workload
 * score of 2.1 identify who is unhappy on a team where everyone knows everyone.
 * The suppression is not a courtesy to the respondent — it is the only thing
 * that makes an anonymous answer true.
 */
export const MIN_REPORTING_N = 5;

export const canReport = (n: number): boolean => n >= MIN_REPORTING_N;

export const suppressionNote = (n: number): string =>
  `Suppressed — ${n} ${n === 1 ? "response" : "responses"}. Results are only shown for ${MIN_REPORTING_N} or more, so no one can work out who said what. Widen the filter (department, site or org) to see this data.`;

export type SliceKind = "Org" | "Department" | "Site" | "Team" | "Worker type" | "Tenure band";

export type DriverScore = {
  key: DriverKey;
  /** Mean on the 1–5 Likert scale, one decimal. */
  score: number;
  /** Change against SR-28. Negative is a fall. */
  delta: number;
  /** Percentage of respondents choosing Agree or Strongly agree. */
  favourable: number;
};

export type EnpsBreakdown = { promoters: number; passives: number; detractors: number };

/** eNPS = %promoters − %detractors. Passives count in the base and nowhere else. */
export const enpsScore = (e: EnpsBreakdown): number => e.promoters - e.detractors;

export const enpsBand = (score: number): { tone: PfTone; label: string } =>
  score >= 30 ? { tone: "green", label: "Strong" }
    : score >= 10 ? { tone: "blue", label: "Healthy" }
      : score >= 0 ? { tone: "yellow", label: "Fragile" }
        : { tone: "red", label: "Negative" };

export type SliceResult = {
  /** Overall mean on the 1–5 scale. */
  overall: number;
  delta: number;
  /** Favourable %, reconciled with DEPARTMENTS.engagement in talentos.ts. */
  favourable: number;
  drivers: DriverScore[];
  enps?: EnpsBreakdown;
};

/**
 * A slice of one run's results.
 *
 * `result` is OPTIONAL and that is the whole mechanism (E2). A slice under
 * MIN_REPORTING_N does not carry suppressed numbers behind a flag — it carries
 * no numbers. There is nothing to leak, nothing to inspect in a devtools panel,
 * nothing for a future screen to accidentally read past a boolean.
 */
export type ResultSlice = {
  id: string;
  runId: string;
  kind: SliceKind;
  label: string;
  invited: number;
  responded: number;
  result?: SliceResult;
  /** Present only on suppressed slices — why this one is small. */
  suppressedBecause?: string;
};

const d = (key: DriverKey, score: number, delta: number, favourable: number): DriverScore => ({ key, score, delta, favourable });

export const RESULT_SLICES: ResultSlice[] = [
  {
    id: "SL-01", runId: "SR-31", kind: "Org", label: "Unrealabs — all", invited: 331, responded: 198,
    result: {
      overall: 3.5, delta: -0.2, favourable: 70,
      drivers: [d("manager", 3.9, 0.1, 78), d("workload", 3.1, -0.4, 58), d("recognition", 3.4, -0.1, 66), d("growth", 3.5, 0.0, 68), d("trust", 3.7, -0.2, 74)],
      enps: { promoters: 41, passives: 34, detractors: 25 },
    },
  },
  {
    id: "SL-02", runId: "SR-31", kind: "Department", label: "Engineering", invited: 84, responded: 52,
    result: {
      overall: 3.3, delta: -0.3, favourable: 68,
      /** Workload −0.7 is AN-103's "pulse score fell 0.7pt in 30 days", from the source. */
      drivers: [d("manager", 4.0, 0.1, 82), d("workload", 2.4, -0.7, 41), d("recognition", 3.3, -0.2, 63), d("growth", 3.4, -0.1, 66), d("trust", 3.6, -0.2, 71)],
      enps: { promoters: 34, passives: 33, detractors: 33 },
    },
  },
  {
    id: "SL-03", runId: "SR-31", kind: "Department", label: "Field Operations", invited: 74, responded: 34,
    result: {
      overall: 2.9, delta: -0.4, favourable: 54,
      drivers: [d("manager", 3.2, -0.2, 58), d("workload", 2.9, -0.3, 52), d("recognition", 2.8, -0.4, 49), d("growth", 2.7, -0.3, 46), d("trust", 3.0, -0.5, 55)],
      enps: { promoters: 22, passives: 31, detractors: 47 },
    },
  },
  {
    id: "SL-04", runId: "SR-31", kind: "Department", label: "Product & Design", invited: 38, responded: 27,
    result: {
      overall: 4.0, delta: 0.1, favourable: 81,
      drivers: [d("manager", 4.2, 0.1, 88), d("workload", 3.6, 0.0, 72), d("recognition", 3.9, 0.2, 79), d("growth", 4.0, 0.1, 82), d("trust", 4.1, 0.1, 84)],
      enps: { promoters: 48, passives: 33, detractors: 19 },
    },
  },
  {
    id: "SL-05", runId: "SR-31", kind: "Department", label: "Commercial", invited: 44, responded: 26,
    result: {
      overall: 3.8, delta: 0.0, favourable: 76,
      drivers: [d("manager", 4.0, 0.0, 80), d("workload", 3.4, -0.1, 68), d("recognition", 3.7, 0.1, 74), d("growth", 3.8, 0.0, 77), d("trust", 3.9, 0.0, 79)],
    },
  },
  {
    id: "SL-06", runId: "SR-31", kind: "Department", label: "HSE & Compliance", invited: 27, responded: 17,
    result: {
      overall: 3.6, delta: -0.1, favourable: 72,
      drivers: [d("manager", 3.8, 0.0, 76), d("workload", 3.2, -0.2, 63), d("recognition", 3.4, -0.1, 68), d("growth", 3.5, 0.0, 70), d("trust", 3.9, 0.0, 78)],
    },
  },
  {
    id: "SL-07", runId: "SR-31", kind: "Department", label: "Finance", invited: 22, responded: 15,
    result: {
      overall: 4.1, delta: 0.1, favourable: 84,
      drivers: [d("manager", 4.3, 0.1, 89), d("workload", 3.7, 0.0, 74), d("recognition", 4.0, 0.2, 82), d("growth", 4.1, 0.1, 84), d("trust", 4.2, 0.1, 86)],
    },
  },
  {
    id: "SL-08", runId: "SR-31", kind: "Department", label: "People / HR", invited: 18, responded: 14,
    result: {
      overall: 4.0, delta: 0.0, favourable: 80,
      drivers: [d("manager", 4.1, 0.0, 82), d("workload", 3.5, -0.2, 70), d("recognition", 3.9, 0.1, 78), d("growth", 4.0, 0.0, 80), d("trust", 4.2, 0.1, 85)],
    },
  },
  {
    id: "SL-09", runId: "SR-31", kind: "Department", label: "Drilling Support", invited: 24, responded: 13,
    result: {
      overall: 3.1, delta: -0.3, favourable: 61,
      drivers: [d("manager", 3.4, -0.1, 66), d("workload", 2.8, -0.4, 51), d("recognition", 3.0, -0.3, 58), d("growth", 3.0, -0.3, 57), d("trust", 3.2, -0.4, 62)],
    },
  },
  /* ── THE SUPPRESSED SLICES. No `result` key. There is nothing here. ─────── */
  {
    id: "SL-10", runId: "SR-31", kind: "Team", label: "Payments squad · Engineering", invited: 6, responded: 4,
    suppressedBecause:
      "A team of 6 with 4 responses. Two people did not answer, which by itself narrows the field. Any score shown at this level is attributable, and everyone on the squad knows it.",
  },
  {
    id: "SL-11", runId: "SR-31", kind: "Worker type", label: "NYSC / Intern", invited: 4, responded: 3,
    suppressedBecause:
      "Four interns in the whole company. This slice can never be reported at the current population, whatever the response rate — the cut itself is the identifier.",
  },
  /* ── Site cuts. These do NOT sum to the org total: Lagos and Abuja staff sit
   *    on no site, and site musters include contractor headcount that is out of
   *    scope for this instrument entirely. ─────────────────────────────────── */
  {
    id: "SL-12", runId: "SR-31", kind: "Site", label: "Bonny Terminal", invited: 19, responded: 11,
    result: {
      overall: 3.0, delta: -0.3, favourable: 58,
      drivers: [d("manager", 3.3, -0.1, 64), d("workload", 2.9, -0.4, 52), d("recognition", 2.9, -0.3, 53), d("growth", 2.8, -0.3, 50), d("trust", 3.1, -0.4, 59)],
    },
  },
  {
    id: "SL-13", runId: "SR-31", kind: "Site", label: "Bonga FPSO", invited: 11, responded: 6,
    result: {
      overall: 3.2, delta: -0.2, favourable: 62,
      drivers: [d("manager", 3.5, 0.0, 68), d("workload", 2.7, -0.5, 47), d("recognition", 3.1, -0.2, 60), d("growth", 3.2, -0.1, 62), d("trust", 3.4, -0.2, 66)],
    },
  },
  /* ── SR-30, the targeted workload check. Department scope only, by design. ─ */
  {
    id: "SL-20", runId: "SR-30", kind: "Department", label: "Engineering", invited: 84, responded: 39,
    result: {
      overall: 2.6, delta: -0.6, favourable: 44,
      drivers: [d("manager", 3.4, -0.2, 66), d("workload", 2.2, -0.8, 36), d("recognition", 0, 0, 0), d("growth", 0, 0, 0), d("trust", 0, 0, 0)],
    },
  },
];

export const slicesFor = (runId: string): ResultSlice[] => RESULT_SLICES.filter((s) => s.runId === runId);

export const slice = (id: string): ResultSlice | undefined => RESULT_SLICES.find((s) => s.id === id);

export type SliceReport =
  | { reportable: true; slice: ResultSlice; result: SliceResult; n: number }
  | { reportable: false; slice: ResultSlice; n: number; reason: string; why?: string };

/**
 * The ONE way a screen may read a slice. Never read `s.result` directly — this
 * refuses on the count, so it holds even if a future seed row is careless.
 */
export const sliceReport = (s: ResultSlice): SliceReport => {
  if (!canReport(s.responded) || !s.result) {
    return { reportable: false, slice: s, n: s.responded, reason: suppressionNote(s.responded), why: s.suppressedBecause };
  }
  return { reportable: true, slice: s, result: s.result, n: s.responded };
};

/**
 * Renders as the "anonymity holding" strip on the results page. `clean: false`
 * is a build failure, not a warning — it means a slice under the threshold is
 * carrying numbers.
 */
export const SUPPRESSION_AUDIT = (): {
  total: number; suppressed: number; reportable: number; leaks: string[]; clean: boolean; threshold: number;
} => {
  const leaks = RESULT_SLICES.filter((s) => !canReport(s.responded) && s.result !== undefined).map((s) => s.id);
  const suppressed = RESULT_SLICES.filter((s) => !canReport(s.responded)).length;
  return {
    total: RESULT_SLICES.length,
    suppressed,
    reportable: RESULT_SLICES.length - suppressed,
    leaks,
    clean: leaks.length === 0,
    threshold: MIN_REPORTING_N,
  };
};

export const driverTone = (score: number): PfTone =>
  score >= 3.8 ? "green" : score >= 3.2 ? "blue" : score >= 2.8 ? "yellow" : "red";

export const deltaTone = (delta: number): PfTone => (delta > 0.05 ? "green" : delta < -0.05 ? "red" : "grey");

/* ------------------------------- free text -------------------------------- */

export type CommentSentiment = "positive" | "mixed" | "critical";

/**
 * A single free-text answer (E4). `released` starts false for every comment in
 * the product. HR clears them one at a time, and `reviewNote` records the
 * reasoning either way — which is also the training set for the next reviewer.
 */
export type SurveyComment = {
  id: string;
  runId: string;
  /** The slice the comment came from — used to enforce E2 on release, not to display. */
  sliceId: string;
  questionId: string;
  driver: DriverKey;
  sentiment: CommentSentiment;
  text: string;
  released: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Why it was released, or why it is being held. Always present once reviewed. */
  reviewNote: string;
};

export const SURVEY_COMMENTS: SurveyComment[] = [
  {
    id: "CM-01", runId: "SR-31", sliceId: "SL-02", questionId: "q7", driver: "workload", sentiment: "critical",
    text: "Three release weekends in a row on payments, and the fourth is already on the calendar. Nobody has said when it stops.",
    released: true, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "Released. Describes a schedule, not a person, and applies to the whole department. No detail narrows it below the department cut.",
  },
  {
    id: "CM-02", runId: "SR-31", sliceId: "SL-02", questionId: "q7", driver: "manager", sentiment: "critical",
    text: "[held]",
    released: false, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "HELD. Names a colleague and describes an exchange only four people witnessed. Releasing it identifies the author and the person named. Passed to the HRBP as a conversation, not as a published comment.",
  },
  {
    id: "CM-03", runId: "SR-31", sliceId: "SL-10", questionId: "q7", driver: "workload", sentiment: "critical",
    text: "[held]",
    released: false, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "HELD on the count. From a squad of 6 with 4 responses — releasing any single comment from that slice identifies its author regardless of what it says. Held even though the content itself is unremarkable.",
  },
  {
    id: "CM-04", runId: "SR-31", sliceId: "SL-03", questionId: "q7", driver: "recognition", sentiment: "critical",
    text: "Site crews hear about the company's results from the news before anyone tells us. Then we are asked why morale is low.",
    released: true, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "Released. A general observation about communication from a 34-response department slice.",
  },
  {
    id: "CM-05", runId: "SR-31", sliceId: "SL-03", questionId: "q7", driver: "workload", sentiment: "critical",
    text: "[held]",
    released: false, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "HELD permanently. Discloses a health circumstance. Health detail is never released at any response count, in any slice, in any run — this is not a threshold decision.",
  },
  {
    id: "CM-06", runId: "SR-31", sliceId: "SL-07", questionId: "q7", driver: "growth", sentiment: "positive",
    text: "The learning budget is real and it is easy to draw. That is rarer than it sounds.",
    released: true, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "Released. Positive, general, and about a policy rather than a person.",
  },
  {
    id: "CM-07", runId: "SR-31", sliceId: "SL-04", questionId: "q7", driver: "recognition", sentiment: "mixed",
    text: "Good work gets a message in a channel and then disappears. It would mean more if it reached the people deciding promotions.",
    released: true, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "Released. Describes a process gap. No individual is identifiable from a 27-response slice.",
  },
  {
    id: "CM-08", runId: "SR-31", sliceId: "SL-03", questionId: "q7", driver: "trust", sentiment: "critical",
    text: "[held]",
    released: false, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 27",
    reviewNote: "HELD. Describes a role held by exactly one person at one site. The role is the identifier — the slice size does not help.",
  },
  {
    id: "CM-09", runId: "SR-30", sliceId: "SL-20", questionId: "q5", driver: "workload", sentiment: "critical",
    text: "Cut the scope of the September release, or move the date. Adding people to it in August will make it slower.",
    released: true, reviewedBy: "People Ops · Funke Adebayo", reviewedAt: "Aug 28",
    reviewNote: "Released. A concrete proposal about the work, from an 84-invited department slice.",
  },
  {
    id: "CM-10", runId: "SR-30", sliceId: "SL-20", questionId: "q5", driver: "workload", sentiment: "mixed",
    text: "[held — awaiting review]",
    released: false,
    reviewNote: "Not yet reviewed. Comments are unreleased by default; nothing appears in a report until a named reviewer clears it.",
  },
];

export const commentsFor = (runId: string): SurveyComment[] => SURVEY_COMMENTS.filter((c) => c.runId === runId);

/** The ONLY safe accessor. Everything else stays behind HR's review queue. */
export const releasedComments = (runId: string): SurveyComment[] =>
  SURVEY_COMMENTS.filter((c) => c.runId === runId && c.released);

export const commentReviewQueue = (): SurveyComment[] => SURVEY_COMMENTS.filter((c) => !c.released);

export const commentStats = () => {
  const released = SURVEY_COMMENTS.filter((c) => c.released).length;
  return {
    total: SURVEY_COMMENTS.length,
    released,
    held: SURVEY_COMMENTS.length - released,
    pending: SURVEY_COMMENTS.filter((c) => !c.reviewedBy).length,
  };
};

/* ------------------------------ my invites -------------------------------- */

/**
 * The RECEIPT table (E3). It records that a person was invited and whether they
 * have responded. It carries no answer, no score and no slice id, and nothing
 * in this module joins it to RESULT_SLICES or SURVEY_COMMENTS. That separation
 * is what lets the product say "you have not answered yet" without ever being
 * able to say "you answered 2 on workload".
 */
export type SurveyInvite = {
  id: string;
  runId: string;
  workerId: string;
  invitedOn: string;
  responded: boolean;
  respondedOn?: string;
  remindersSent: number;
};

export const SURVEY_INVITES: SurveyInvite[] = [
  { id: "IV-3101", runId: "SR-31", workerId: "E-0214", invitedOn: "Aug 24", responded: false, remindersSent: 1 },
  { id: "IV-3102", runId: "SR-31", workerId: "E-0243", invitedOn: "Aug 24", responded: true, respondedOn: "Aug 24", remindersSent: 0 },
  { id: "IV-3103", runId: "SR-31", workerId: "E-0198", invitedOn: "Aug 24", responded: true, respondedOn: "Aug 26", remindersSent: 0 },
  { id: "IV-3104", runId: "SR-31", workerId: "E-0187", invitedOn: "Aug 24", responded: true, respondedOn: "Aug 25", remindersSent: 0 },
  { id: "IV-3105", runId: "SR-31", workerId: "E-0231", invitedOn: "Aug 24", responded: false, remindersSent: 1 },
  { id: "IV-3106", runId: "SR-31", workerId: "E-0129", invitedOn: "Aug 24", responded: true, respondedOn: "Aug 27", remindersSent: 1 },
  { id: "IV-3107", runId: "SR-31", workerId: "E-0165", invitedOn: "Aug 24", responded: true, respondedOn: "Aug 24", remindersSent: 0 },
  { id: "IV-3001", runId: "SR-30", workerId: "E-0214", invitedOn: "Aug 26", responded: false, remindersSent: 0 },
  { id: "IV-3002", runId: "SR-30", workerId: "E-0243", invitedOn: "Aug 26", responded: true, respondedOn: "Aug 27", remindersSent: 0 },
  { id: "IV-2801", runId: "SR-28", workerId: "E-0214", invitedOn: "May 18", responded: true, respondedOn: "May 21", remindersSent: 0 },
  { id: "IV-2701", runId: "SR-27", workerId: "E-0243", invitedOn: "Jul 1", responded: true, respondedOn: "Jul 2", remindersSent: 0 },
];

export const invitesFor = (workerId: string): SurveyInvite[] => SURVEY_INVITES.filter((i) => i.workerId === workerId);

/** The live take-flow: what this person still owes, open runs only. */
export const pendingInvitesFor = (workerId: string): SurveyInvite[] =>
  SURVEY_INVITES.filter((i) => {
    const r = surveyRun(i.runId);
    return i.workerId === workerId && !i.responded && (r?.state === "Open" || r?.state === "Closing");
  });

/** The reminder copy. Never says what anyone answered, because it cannot know. */
export const inviteNudge = (i: SurveyInvite): string => {
  const r = surveyRun(i.runId);
  const def = r ? surveyDef(r.defId) : undefined;
  if (!r || !def) return "You have a survey waiting.";
  return `${r.name} closes ${r.closes} — ${r.daysLeft} working ${r.daysLeft === 1 ? "day" : "days"} left. ${ANONYMITY_PROMISE[def.anonymity]}`;
};

/* --------------------------- access logging (E) --------------------------- */

export type EngageAccess = { at: string; who: string; action: string; scope: string };

/**
 * Survey slices and unreleased comments are sensitive reads. Every one is
 * logged and the UI says so — the same rule hrops.ts applies to case files.
 */
export const SURVEY_ACCESS_LOG: EngageAccess[] = [
  { at: "Aug 27 · 09:14", who: "People Ops · Funke Adebayo", action: "opened comment review queue", scope: "SR-31 · 10 comments" },
  { at: "Aug 27 · 09:31", who: "People Ops · Funke Adebayo", action: "released 5 comments, held 4", scope: "SR-31" },
  { at: "Aug 27 · 14:02", who: "Engineering · Ngozi Adeyemi", action: "viewed department results", scope: "SR-31 · Engineering (52 responses)" },
  { at: "Aug 27 · 14:03", who: "Engineering · Ngozi Adeyemi", action: "attempted team filter — refused, below threshold", scope: "SR-31 · Payments squad (4 responses)" },
  { at: "Aug 28 · 08:40", who: "Executive · Folake Coker", action: "viewed org results", scope: "SR-31 · all (198 responses)" },
];

/* ==========================================================================
 * FR-095 — HELPDESK
 * ========================================================================== */

/**
 * ── E1 RESTATED WHERE IT MATTERS ──────────────────────────────────────────
 * Everything below is the employee's side of the conversation. A ticket is a
 * QUESTION. It has no sanction, no panel, no retention clock tied to conduct,
 * and no route into DISCIPLINARY_CASES. The absence of an `escalateToCase()`
 * function in this file is deliberate and load-bearing.
 */
export const HELPDESK_FIREWALL = {
  headline: "A question is not a case",
  ticket: "A helpdesk ticket is the employee ASKING. They open it, they can close it, and they see everything on it.",
  disciplinary: "A disciplinary case (FR-088) is HR ISSUING. HR opens it from evidence, under its own governance, DPIA and access log.",
  rule: "There is no path from one to the other. No auto-escalation, no one-click convert, no shared id. If a conduct matter exists, HR opens a case from scratch.",
  why: "A helpdesk that can turn into a disciplinary file is a helpdesk nobody uses. The deflection rate would look excellent and the reason would be fear.",
} as const;

export type TicketCategory =
  | "Pay & payslips" | "Leave" | "Benefits" | "IT & devices" | "Policy" | "Onboarding" | "Other";

export const TICKET_CATEGORIES: TicketCategory[] =
  ["Pay & payslips", "Leave", "Benefits", "IT & devices", "Policy", "Onboarding", "Other"];

export const CATEGORY_ICON: Record<TicketCategory, string> = {
  "Pay & payslips": "wallet",
  Leave: "calendar",
  Benefits: "heart",
  "IT & devices": "stack",
  Policy: "book",
  Onboarding: "door",
  Other: "question",
};

export type SlaPolicy = {
  category: TicketCategory;
  firstResponseHours: number;
  resolutionHours: number;
  rationale: string;
};

/** Targets in WORKING hours, not wall-clock. A ticket raised Friday 17:00 is not breached by Monday. */
export const SLA_POLICY: SlaPolicy[] = [
  { category: "IT & devices", firstResponseHours: 2, resolutionHours: 8, rationale: "A blocked laptop is a blocked day. Fastest target in the book." },
  { category: "Pay & payslips", firstResponseHours: 4, resolutionHours: 24, rationale: "Money questions do not wait. Most are answered from the record; the rest go to the connected payroll source." },
  { category: "Onboarding", firstResponseHours: 4, resolutionHours: 24, rationale: "A joiner has no other route in yet — they have not learned who to ask." },
  { category: "Leave", firstResponseHours: 8, resolutionHours: 48, rationale: "Usually a policy read, occasionally a balance correction." },
  { category: "Policy", firstResponseHours: 8, resolutionHours: 48, rationale: "Answerable from the handbook in most cases — see the deflection numbers." },
  { category: "Benefits", firstResponseHours: 8, resolutionHours: 72, rationale: "Often needs the provider, so the resolution target allows for a third party." },
  { category: "Other", firstResponseHours: 8, resolutionHours: 72, rationale: "The catch-all. High resolution target because triage happens first." },
];

export const slaFor = (c: TicketCategory): SlaPolicy => SLA_POLICY.find((s) => s.category === c)!;

export type TicketState = "New" | "Open" | "Waiting on you" | "Resolved" | "Closed";

export const TICKET_STATES: TicketState[] = ["New", "Open", "Waiting on you", "Resolved", "Closed"];

export const stateTone = (s: TicketState): PfTone =>
  s === "New" ? "purple" : s === "Open" ? "blue" : s === "Waiting on you" ? "yellow" : s === "Resolved" ? "green" : "grey";

export type MessageAuthor = "Employee" | "HR" | "System";

export type TicketMessage = {
  id: string;
  at: string;
  author: string;
  role: MessageAuthor;
  body: string;
};

export type Ticket = {
  id: string;
  subject: string;
  body: string;
  category: TicketCategory;
  raisedBy: string;
  raisedByName: string;
  init: string;
  tone: string;
  raisedAt: string;
  state: TicketState;
  assignee?: string;
  /** Working hours since the ticket was raised, on the reference day. */
  elapsedHours: number;
  /** Working hours to the first HR reply. Undefined while still unanswered. */
  firstResponseHours?: number;
  resolvedAt?: string;
  /** 1–5, asked once on resolution. Never asked twice, never chased. */
  satisfaction?: number;
  thread: TicketMessage[];
  /** The handbook article this was answered from, if any. */
  kbId?: string;
  note?: string;
};

export const TICKETS: Ticket[] = [
  {
    id: "HD-415",
    subject: "Laptop will not rejoin the VPN after the Entra reset",
    body: "Since the account reset yesterday the VPN client rejects my credentials. I can reach mail and Slack but not the internal services. Second day of this.",
    category: "IT & devices",
    raisedBy: "E-0243", raisedByName: "Chidi Okeke", init: "CO", tone: "#E81E17",
    raisedAt: "Aug 28 · 08:12",
    state: "New",
    elapsedHours: 1,
    thread: [
      { id: "m1", at: "Aug 28 · 08:12", author: "Chidi Okeke", role: "Employee", body: "Since the account reset yesterday the VPN client rejects my credentials. I can reach mail and Slack but not the internal services. Second day of this." },
    ],
    note: "Unassigned. The triage suggestion below is a proposal — a human picks the assignee.",
  },
  {
    id: "HD-412",
    subject: "My RSA PIN is not showing on my record",
    body: "The pension section of my profile is blank. I have an RSA PIN from my previous employer — does it carry over, and where do I put it so it reaches the right place?",
    category: "Pay & payslips",
    raisedBy: "E-0214", raisedByName: "Amara Okonkwo", init: "AO", tone: "#AF52DE",
    raisedAt: "Aug 26 · 10:40",
    state: "Waiting on you",
    assignee: "People Ops · Funke Adebayo",
    elapsedHours: 14,
    firstResponseHours: 3,
    kbId: "hb-payroll",
    thread: [
      { id: "m1", at: "Aug 26 · 10:40", author: "Amara Okonkwo", role: "Employee", body: "The pension section of my profile is blank. I have an RSA PIN from my previous employer — does it carry over, and where do I put it so it reaches the right place?" },
      { id: "m2", at: "Aug 26 · 13:35", author: "Funke Adebayo", role: "HR", body: "It carries over — an RSA PIN belongs to you, not to an employer, so you keep the same one for life. Yours is on your record but masked, which is why the section looks blank. PAYE and pension are deducted at source and remitted for you either way." },
      { id: "m3", at: "Aug 26 · 13:36", author: "Funke Adebayo", role: "HR", body: "To confirm the digits match what your PFA holds, could you send the RSA number from your last PFA statement? Reply here — please do not put it in an email." },
      { id: "m4", at: "Aug 26 · 13:36", author: "Helpdesk", role: "System", body: "Waiting on Amara Okonkwo. This ticket will not be closed automatically — it stays open until you reply or close it yourself." },
    ],
    note: "The one waiting on E-0214. The clock is paused while it waits on the employee: SLA does not run against the person who asked.",
  },
  {
    id: "HD-414",
    subject: "My First Aid certificate has expired — who books the renewal?",
    body: "Site access flagged it this morning. Do I book the course myself and claim it back, or does HSE arrange it?",
    category: "Policy",
    raisedBy: "E-0129", raisedByName: "Halima Sule", init: "HS", tone: "#AF52DE",
    raisedAt: "Aug 27 · 07:55",
    state: "Open",
    assignee: "HSE & Compliance · Chinedu Eze",
    elapsedHours: 9,
    firstResponseHours: 2,
    kbId: "hb-hse",
    thread: [
      { id: "m1", at: "Aug 27 · 07:55", author: "Halima Sule", role: "Employee", body: "Site access flagged it this morning. Do I book the course myself and claim it back, or does HSE arrange it?" },
      { id: "m2", at: "Aug 27 · 09:40", author: "Chinedu Eze", role: "HR", body: "HSE books it — certifications are never an expense claim. I have put you on the 4 September cohort at the Port Harcourt base. Your site-access flag clears the day the certificate is uploaded." },
      { id: "m3", at: "Aug 27 · 09:41", author: "Halima Sule", role: "Employee", body: "Perfect. Does the flag block me from the base in the meantime?" },
    ],
  },
  {
    id: "HD-413",
    subject: "What is the per-diem rate on the 14/14 terminal rotation?",
    body: "I have been paid two different rates on my last two tours and I cannot find the table anywhere.",
    category: "Benefits",
    raisedBy: "W-3302", raisedByName: "Grace Etim", init: "GE", tone: "#AF52DE",
    raisedAt: "Aug 25 · 16:20",
    state: "Open",
    assignee: "Finance · Kemi Salami",
    elapsedHours: 21,
    firstResponseHours: 6,
    kbId: "hb-expenses",
    thread: [
      { id: "m1", at: "Aug 25 · 16:20", author: "Grace Etim", role: "Employee", body: "I have been paid two different rates on my last two tours and I cannot find the table anywhere." },
      { id: "m2", at: "Aug 26 · 09:10", author: "Kemi Salami", role: "HR", body: "The rate depends on the site class, not the rotation length — onshore terminal and offshore are different lines. I am checking which class each of your two tours was booked against before I answer, so I give you the right number rather than a fast one." },
    ],
    note: "A rate question, not a payment question. The answer comes from the expense policy table; any correction to what was actually paid goes through the connected payroll source.",
  },
  {
    id: "HD-411",
    subject: "My July expense claim has not been reimbursed",
    body: "Claim submitted 14 July, still nothing on the July payslip. Was it approved?",
    category: "Pay & payslips",
    raisedBy: "E-0187", raisedByName: "Ngozi Obi", init: "NO", tone: "#16B364",
    raisedAt: "Aug 4 · 11:02",
    state: "Resolved",
    assignee: "Finance · Kemi Salami",
    elapsedHours: 20,
    firstResponseHours: 2,
    resolvedAt: "Aug 5 · 15:30",
    satisfaction: 4,
    kbId: "hb-expenses",
    thread: [
      { id: "m1", at: "Aug 4 · 11:02", author: "Ngozi Obi", role: "Employee", body: "Claim submitted 14 July, still nothing on the July payslip. Was it approved?" },
      { id: "m2", at: "Aug 4 · 13:15", author: "Kemi Salami", role: "HR", body: "It was held, not rejected — one line was over the ₦10,000 receipt threshold with no receipt attached, so the whole claim stopped at that check. Approved claims go out with the run on the 25th, so it missed July's." },
      { id: "m3", at: "Aug 5 · 09:20", author: "Ngozi Obi", role: "Employee", body: "Receipt attached now. Sorry — I did not see the flag." },
      { id: "m4", at: "Aug 5 · 15:30", author: "Kemi Salami", role: "HR", body: "Cleared and added to the August batch, which hands off to your payroll system ahead of the 25th. The flag should have been louder — I have raised that." },
    ],
    note: "The claim behind this ticket is EX-2081 in rewards.ts. The two records describe the same event from opposite sides and are not linked in code.",
  },
  {
    id: "HD-408",
    subject: "Can I carry more than 5 leave days into next year?",
    body: "I have 9 days left and a family thing in April. Is the 5-day cap firm?",
    category: "Leave",
    raisedBy: "E-0214", raisedByName: "Amara Okonkwo", init: "AO", tone: "#AF52DE",
    raisedAt: "Aug 12 · 09:05",
    state: "Resolved",
    assignee: "People Ops · Funke Adebayo",
    elapsedHours: 5,
    firstResponseHours: 1,
    resolvedAt: "Aug 12 · 14:10",
    satisfaction: 5,
    kbId: "hb-leave",
    thread: [
      { id: "m1", at: "Aug 12 · 09:05", author: "Amara Okonkwo", role: "Employee", body: "I have 9 days left and a family thing in April. Is the 5-day cap firm?" },
      { id: "m2", at: "Aug 12 · 10:02", author: "Funke Adebayo", role: "HR", body: "The cap is firm — 5 days carry over and they expire on 31 March, so an April booking would have to come out of next year's 20. The four days above the cap are use-or-lose this year." },
      { id: "m3", at: "Aug 12 · 14:10", author: "Amara Okonkwo", role: "Employee", body: "Understood. Booking the four in September then." },
    ],
    note: "The September booking this ends with is LV-221 in adapters.ts — Sep 14–18, approved.",
  },
  {
    id: "HD-410",
    subject: "Which days is Product expected in the office?",
    body: "Starting on a cross-team project and I want to line my days up with theirs.",
    category: "Policy",
    raisedBy: "E-0198", raisedByName: "Adaeze Okafor", init: "AD", tone: "#16B364",
    raisedAt: "Jul 30 · 14:44",
    state: "Closed",
    assignee: "People Ops · Funke Adebayo",
    elapsedHours: 2,
    firstResponseHours: 1,
    resolvedAt: "Jul 30 · 16:30",
    satisfaction: 5,
    kbId: "hb-remote",
    thread: [
      { id: "m1", at: "Jul 30 · 14:44", author: "Adaeze Okafor", role: "Employee", body: "Starting on a cross-team project and I want to line my days up with theirs." },
      { id: "m2", at: "Jul 30 · 15:20", author: "Funke Adebayo", role: "HR", body: "Lagos is 3 days a week and squad leads pick which days, not HR — so the answer is whatever the Product lead has set. Sending you the handbook article and the lead's name rather than a number, because the number would be wrong next month." },
      { id: "m3", at: "Jul 30 · 16:30", author: "Adaeze Okafor", role: "Employee", body: "That is the better answer. Closing this." },
    ],
    note: "Closed by the employee, not by HR. A resolved ticket is HR's opinion; a closed one is the asker's.",
  },
  {
    id: "HD-409",
    subject: "How do I get a copy of my employment letter?",
    body: "The bank is asking for one for an account application.",
    category: "Other",
    raisedBy: "W-3305", raisedByName: "Musa Bello", init: "MB", tone: "#475569",
    raisedAt: "Jul 22 · 10:15",
    state: "Closed",
    assignee: "People Ops · Funke Adebayo",
    elapsedHours: 6,
    firstResponseHours: 3,
    resolvedAt: "Jul 23 · 11:00",
    satisfaction: 3,
    kbId: "hb-payroll",
    thread: [
      { id: "m1", at: "Jul 22 · 10:15", author: "Musa Bello", role: "Employee", body: "The bank is asking for one for an account application." },
      { id: "m2", at: "Jul 22 · 13:30", author: "Funke Adebayo", role: "HR", body: "You want a bank reference rather than a plain employment letter — it confirms employment and tenure and states no salary. You can request it yourself from Letters; it carries a QR the bank can verify without seeing anything else about you." },
      { id: "m3", at: "Jul 23 · 11:00", author: "Musa Bello", role: "Employee", body: "Requested. Took me a while to find the button." },
    ],
    note:
      "E1 IN THE FLESH. W-3305 is also the subject of DC-14 in hrops.ts. This ticket does not reference that case, that case does not reference this ticket, and neither appears in the other's view. He asked a question in July; HR issued a query in August. Those are two unrelated facts about one person and the product must keep them that way.",
  },
];

export const ticket = (id: string): Ticket | undefined => TICKETS.find((t) => t.id === id);

export const ticketsFor = (workerId: string): Ticket[] => TICKETS.filter((t) => t.raisedBy === workerId);

export const openTickets = (): Ticket[] => TICKETS.filter((t) => t.state !== "Resolved" && t.state !== "Closed");

/**
 * SLA read. "Waiting on you" stops the clock — the target measures HR's
 * responsiveness, not the employee's, and a product that penalised the asker
 * for taking a day to reply would be measuring the wrong party.
 */
export const ticketSla = (t: Ticket): { tone: PfTone; label: string; breached: boolean } => {
  const p = slaFor(t.category);
  if (t.state === "Resolved" || t.state === "Closed") {
    const within = t.elapsedHours <= p.resolutionHours;
    return { tone: within ? "green" : "yellow", label: within ? `Resolved in ${t.elapsedHours}h` : `Resolved in ${t.elapsedHours}h · over target`, breached: !within };
  }
  if (t.state === "Waiting on you") return { tone: "grey", label: "Clock paused — waiting on the employee", breached: false };
  if (t.firstResponseHours === undefined) {
    const left = p.firstResponseHours - t.elapsedHours;
    if (left < 0) return { tone: "red", label: `First response ${Math.abs(left)}h overdue`, breached: true };
    return { tone: left <= 1 ? "yellow" : "blue", label: `First response due in ${left}h`, breached: false };
  }
  const left = p.resolutionHours - t.elapsedHours;
  if (left < 0) return { tone: "red", label: `Resolution ${Math.abs(left)}h overdue`, breached: true };
  return { tone: left <= 4 ? "yellow" : "blue", label: `Resolution due in ${left}h`, breached: false };
};

/* ------------------------------ knowledge base ---------------------------- */

/**
 * KB articles are a WRAPPER around HANDBOOK, never a copy of it. The handbook
 * is the single source of policy text (owner, updated date and all) and this
 * layer adds only what a helpdesk needs to know about it. If a policy changes,
 * it changes in one place and every KB article is already correct.
 *
 * `body` is deliberately absent from KbArticle. Read it with `kbBody(id)`.
 */
export type KbArticle = {
  id: string;
  /** Always equal to `id` — kept explicit so the derivation is visible in the type. */
  handbookId: string;
  title: string;
  section: string;
  owner: string;
  updated: string;
  views: number;
  helpful: number;
  unhelpful: number;
  /**
   * THE KPI. Sessions where someone opened this article and did NOT go on to
   * raise a ticket in the following hour. Tickets avoided, not tickets closed —
   * a helpdesk that only counts closures is rewarded for being needed.
   */
  deflected: number;
  /** Sessions where they read it and raised a ticket anyway. The denominator. */
  ticketsAfter: number;
  relatedTickets: string[];
};

const KB_META: Record<string, { views: number; helpful: number; unhelpful: number; deflected: number; ticketsAfter: number; relatedTickets: string[] }> = {
  "hb-leave": { views: 1631, helpful: 288, unhelpful: 14, deflected: 141, ticketsAfter: 24, relatedTickets: ["HD-408"] },
  "hb-payroll": { views: 1284, helpful: 212, unhelpful: 19, deflected: 96, ticketsAfter: 22, relatedTickets: ["HD-412", "HD-409"] },
  "hb-remote": { views: 1102, helpful: 199, unhelpful: 22, deflected: 83, ticketsAfter: 17, relatedTickets: ["HD-410"] },
  "hb-expenses": { views: 947, helpful: 154, unhelpful: 31, deflected: 68, ticketsAfter: 29, relatedTickets: ["HD-411", "HD-413"] },
  "hb-devices": { views: 869, helpful: 141, unhelpful: 27, deflected: 61, ticketsAfter: 19, relatedTickets: ["HD-415"] },
  "hb-learning": { views: 738, helpful: 160, unhelpful: 11, deflected: 52, ticketsAfter: 8, relatedTickets: [] },
  "hb-hse": { views: 612, helpful: 121, unhelpful: 9, deflected: 44, ticketsAfter: 11, relatedTickets: ["HD-414"] },
  "hb-conduct": { views: 402, helpful: 74, unhelpful: 6, deflected: 18, ticketsAfter: 4, relatedTickets: [] },
};

export const KB_ARTICLES: KbArticle[] = HANDBOOK.map((h: HandbookDoc): KbArticle => {
  const m = KB_META[h.id] ?? { views: 0, helpful: 0, unhelpful: 0, deflected: 0, ticketsAfter: 0, relatedTickets: [] };
  return {
    id: h.id, handbookId: h.id, title: h.title, section: h.section, owner: h.owner, updated: h.updated,
    views: m.views, helpful: m.helpful, unhelpful: m.unhelpful,
    deflected: m.deflected, ticketsAfter: m.ticketsAfter, relatedTickets: m.relatedTickets,
  };
}).sort((a, b) => b.views - a.views);

export const kbArticle = (id: string): KbArticle | undefined => KB_ARTICLES.find((a) => a.id === id);

/** The policy text itself — read from HANDBOOK at call time, never duplicated. */
export const kbBody = (id: string): string => HANDBOOK.find((h) => h.id === id)?.body ?? "";

export const kbDoc = (id: string): HandbookDoc | undefined => HANDBOOK.find((h) => h.id === id);

export const deflectionRate = (a: KbArticle): number =>
  a.deflected + a.ticketsAfter === 0 ? 0 : Math.round((a.deflected / (a.deflected + a.ticketsAfter)) * 100);

export const helpfulRate = (a: KbArticle): number =>
  a.helpful + a.unhelpful === 0 ? 0 : Math.round((a.helpful / (a.helpful + a.unhelpful)) * 100);

export const helpdeskKpis = () => {
  const resolved = TICKETS.filter((t) => t.state === "Resolved" || t.state === "Closed");
  const rated = resolved.filter((t) => t.satisfaction !== undefined);
  const totalDeflected = KB_ARTICLES.reduce((a, k) => a + k.deflected, 0);
  const totalAfter = KB_ARTICLES.reduce((a, k) => a + k.ticketsAfter, 0);
  const firstResponses = TICKETS.filter((t) => t.firstResponseHours !== undefined).map((t) => t.firstResponseHours!);
  return {
    open: openTickets().length,
    total: TICKETS.length,
    breached: TICKETS.filter((t) => ticketSla(t).breached).length,
    medianFirstResponse: firstResponses.length
      ? [...firstResponses].sort((a, b) => a - b)[Math.floor(firstResponses.length / 2)]
      : 0,
    satisfaction: rated.length
      ? Math.round((rated.reduce((a, t) => a + (t.satisfaction ?? 0), 0) / rated.length) * 10) / 10
      : 0,
    deflected: totalDeflected,
    deflectionRate: Math.round((totalDeflected / (totalDeflected + totalAfter)) * 100),
    kpiNote:
      "Deflection is the number that matters. 563 questions answered by an article are 563 tickets nobody had to raise — and the only lever that scales a two-person People Ops team past 358 workers.",
  };
};

export const byCategory = (): { category: TicketCategory; n: number; open: number }[] =>
  TICKET_CATEGORIES.map((c) => ({
    category: c,
    n: TICKETS.filter((t) => t.category === c).length,
    open: TICKETS.filter((t) => t.category === c && t.state !== "Resolved" && t.state !== "Closed").length,
  })).filter((r) => r.n > 0);

/* --------------------------------- triage --------------------------------- */

/**
 * AI TRIAGE (E5). It reads the subject and body of the ticket and nothing else.
 * It does not read the person record, their department, their performance, their
 * attendance, their case history or any protected or NCDMB attribute (E6) — a
 * category suggestion has no business knowing who is asking.
 *
 * It PROPOSES. `decision` is a human's, and until a human makes it the ticket is
 * unassigned and uncategorised in every count.
 */
export type TriageDecision = "pending" | "accepted" | "overridden";

export type TriageSuggestion = {
  ticketId: string;
  suggestedCategory: TicketCategory;
  suggestedKbId: string;
  suggestedAssignee: string;
  /** 0–1. */
  confidence: number;
  basis: string;
  decision: TriageDecision;
  decidedBy?: string;
  decidedAt?: string;
  /** Set when a human overrode it — the correction record, and the honest part. */
  overrodeTo?: TicketCategory;
  overrideReason?: string;
};

export const TRIAGE: TriageSuggestion[] = [
  {
    ticketId: "HD-415",
    suggestedCategory: "IT & devices",
    suggestedKbId: "hb-devices",
    suggestedAssignee: "Platform · Emeka Obi",
    confidence: 0.94,
    basis: "Subject and body contain 'VPN', 'credentials' and 'Entra reset'. 41 of the last 43 tickets containing an identity-provider term were IT & devices. The 2-hour first-response target is the tightest in the SLA book, which is why this one is surfaced first.",
    decision: "pending",
  },
  {
    ticketId: "HD-413",
    suggestedCategory: "Pay & payslips",
    suggestedKbId: "hb-payroll",
    suggestedAssignee: "Finance · Kemi Salami",
    confidence: 0.61,
    basis: "Body contains 'paid' and 'rates', which cluster with pay tickets.",
    decision: "overridden",
    decidedBy: "Finance · Kemi Salami",
    decidedAt: "Aug 25 · 16:48",
    overrodeTo: "Benefits",
    overrideReason:
      "It reads like a pay question and is not one. She is asking what the per-diem RATE is — a policy answer from the expense table. Nothing about her actual pay is in question, and routing it to pay would have sent it to the payroll source for no reason. Confidence was 0.61 and the model was right to be unsure.",
  },
  {
    ticketId: "HD-414",
    suggestedCategory: "Policy",
    suggestedKbId: "hb-hse",
    suggestedAssignee: "HSE & Compliance · Chinedu Eze",
    confidence: 0.88,
    basis: "'First Aid certificate' and 'expired' match the certification section of the HSE article; site-access phrasing routes to the HSE owner rather than People Ops.",
    decision: "accepted",
    decidedBy: "People Ops · Funke Adebayo",
    decidedAt: "Aug 27 · 08:05",
  },
];

export const triageFor = (ticketId: string): TriageSuggestion | undefined => TRIAGE.find((t) => t.ticketId === ticketId);

/** FR-093: the "Why this?" affordance, in the standard shape. */
export const triageWhy = (t: TriageSuggestion): WhyThis => ({
  claim: `Suggested category: ${t.suggestedCategory} · suggested article: ${kbArticle(t.suggestedKbId)?.title ?? t.suggestedKbId}`,
  basis: [
    t.basis,
    "Inputs: the subject line and body text of this ticket only.",
    "Not used: who raised it, their department, worker type, performance, attendance, case history, nationality or host community.",
  ],
  modelCard: "MC-08",
  confidence: t.confidence,
  humanGate: "A person assigns and categorises. The suggestion is never applied on its own, and an overridden suggestion is kept with its reason.",
});

export const triageAccuracy = () => {
  const decided = TRIAGE.filter((t) => t.decision !== "pending");
  const accepted = decided.filter((t) => t.decision === "accepted").length;
  return {
    decided: decided.length,
    accepted,
    overridden: decided.length - accepted,
    pct: decided.length ? Math.round((accepted / decided.length) * 100) : 0,
    note: "Overrides are the point of the record, not a defect in it. Each one carries the human's reason and that is what the next version is calibrated against.",
  };
};

/* --------------------------- FR-093 registry rows ------------------------- */

/**
 * The rows this module contributes to trust.ts's registries. FR-093 audits AI
 * surface coverage at 100%, so a new AI surface arrives with its model card and
 * its registry entry or it breaks a shipped gate. Exported here rather than
 * edited into trust.ts so the screens can render the addition explicitly.
 */
export const ENGAGE_MODEL_CARDS: ModelCard[] = [
  {
    id: "MC-08",
    name: "Helpdesk triage",
    purpose: "Suggests a category, a knowledge-base article and an assignee for a new ticket",
    inputs: "Ticket subject and body text only",
    humanGate: "A person assigns; overrides are recorded with a reason. Never auto-assigns, auto-closes or auto-categorises.",
    surface: "Helpdesk",
  },
  {
    id: "MC-09",
    name: "Comment theme summary",
    purpose: "Groups RELEASED survey comments into themes for a results page",
    inputs: "Released comment text only — never a held comment, never a slice below the reporting threshold",
    humanGate: "Themes are shown alongside the comments they came from; HR releases every comment first.",
    surface: "Survey results",
  },
];

export const ENGAGE_AI_SURFACES: AiSurface[] = [
  { id: "AS-13", pillar: "Engage", surface: "Helpdesk", output: "Triage suggestion (category + article + assignee)", modelCard: "MC-08", covered: true, where: "Suggestion card → 'Why this?' → inputs used and inputs refused" },
  { id: "AS-14", pillar: "Engage", surface: "Survey results", output: "Comment themes", modelCard: "MC-09", covered: true, where: "Theme chip → the released comments it was built from" },
];

/**
 * The theme rollup MC-09 produces. Built ONLY from released comments — the held
 * ones do not reach it, which is why the count below is 5 and not 10.
 */
export type CommentTheme = { theme: string; driver: DriverKey; n: number; tone: PfTone; fromComments: string[] };

export const COMMENT_THEMES: CommentTheme[] = [
  { theme: "Release cadence with no visible end date", driver: "workload", n: 2, tone: "red", fromComments: ["CM-01", "CM-09"] },
  { theme: "Company news reaches site crews last", driver: "recognition", n: 1, tone: "yellow", fromComments: ["CM-04"] },
  { theme: "Recognition stops at the channel it happens in", driver: "recognition", n: 1, tone: "yellow", fromComments: ["CM-07"] },
  { theme: "Learning entitlement works as promised", driver: "growth", n: 1, tone: "green", fromComments: ["CM-06"] },
];

export const themeWhy = (t: CommentTheme): WhyThis => ({
  claim: `Theme: ${t.theme} (${t.n} ${t.n === 1 ? "comment" : "comments"})`,
  basis: [
    `Built from released comments ${t.fromComments.join(", ")}. Every source comment is readable in full.`,
    `Held comments are not summarised, quoted or counted — ${commentStats().held} of ${commentStats().total} comments in this cycle did not reach this rollup.`,
    "No comment from a slice below the 5-respondent threshold is available to summarise.",
  ],
  modelCard: "MC-09",
  humanGate: "People Ops releases each comment before it can be themed. The theme is a reading aid over text a human already cleared.",
});
