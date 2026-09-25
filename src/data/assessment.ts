/**
 * The assessment record — ONE record, authored at Stage 05 and taken by the
 * candidate at /assessment-take.
 *
 * Before this file existed the recruiter's "generated brief" (Assessment.tsx)
 * and the candidate's player (AssessTake.tsx) each carried their own hardcoded
 * copy, so the assessment a recruiter SET was not the assessment a candidate
 * TOOK. Both ends now import from here; neither owns a private array again.
 *
 * Two invariants live in this file, on purpose:
 *  1. The rubric is inherited verbatim from Stage 02 (Role.tsx scorecard) —
 *     MASTER_RUBRIC is the single literal in the codebase, which is what the
 *     product's "same dimensions, same weights, no drift" claim requires.
 *  2. The dispatch gate (canSend / sendBlockReason) is defined once and used
 *     verbatim by both the UI's disabled state and the store's reducer, so the
 *     button can never drift from the rule it claims to enforce.
 *
 * No React here — types, seed data and pure predicates only.
 */

import type { PersonaId } from "@/data/personas";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type AssessmentType = "take-home" | "timed-test" | "video-prompt";
export type QuestionKind = "longtext" | "upload" | "video" | "mcq";
export type AssessmentStatus =
  | "drafted"
  | "editing"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "sent";

/** Inherited verbatim from Stage 02 (Role.tsx scorecard). NOT authored here. */
export type RubricDim = {
  /** Stable id — questions reference this, never the label. */
  key: string;
  /** The Stage-02 label, e.g. "Systems thinking". */
  dim: string;
  /** Integer percent; MASTER_RUBRIC weights sum to 100. */
  weight: number;
  /** Per-dimension provenance — the JD must-have it came from. */
  fromMustHave: string;
};

export type AssessmentQuestion = {
  id: string;
  kind: QuestionKind;
  /** e.g. "DESIGN EXERCISE" — the player appends "· 1 OF 3". */
  kicker: string;
  title: string;
  prompt: string;
  /** RubricDim.key[] — drives the player's "Scored on:" chips AND grading. */
  dimKeys: string[];
  required: boolean;
  /** longtext */
  minWords?: number;
  /** upload — "Figma link, PDF or PNG" */
  accept?: string;
  /** video */
  maxMinutes?: number;
  /** mcq */
  options?: string[];
  /** mcq — STRIPPED before the record ever reaches a candidate. */
  answerKey?: number;
};

export type Deliverable = { label: string; detail: string };

export type ApprovalRecord = {
  reviewer: { personaId: "manager"; name: string; title: string; init: string };
  submittedBy?: string;
  submittedAt?: string;
  decision?: "approved" | "changes_requested";
  decidedAt?: string;
  comment?: string;
  /** THE GATE'S TEETH — which version the human actually saw. */
  approvedVersion?: number;
  /** How many times this brief has been round the review loop. */
  round: number;
};

export type DispatchRecord = {
  sentBy: string;
  sentAt: string;
  recipients: { name: string; init: string }[];
  dueAt: string;
  /** "APV-2 · Ngozi Adeyemi · Aug 20, 11:40" — the proof stamped at dispatch. */
  approvalRef: string;
};

export type OrgPolicyMirror = {
  source: "Admin · Assessment Config";
  defaultDurationMins: number;
  proctoring: boolean;
  plagiarism: boolean;
  notifyByEmail: boolean;
};

export type Assessment = {
  id: string;
  roleId: string;
  roleTitle: string;
  title: string;
  type: AssessmentType;
  durationMins: number;
  /** take-home submission window, e.g. "3 days". */
  window?: string;
  brief: string;
  deliverables: Deliverable[];
  questions: AssessmentQuestion[];
  /** = MASTER_RUBRIC at generation time (snapshotted with rubricVersion). */
  rubric: RubricDim[];
  provenance: {
    mustHaves: string[];
    rubricVersion: string;
    generatedAt: string;
    model: string;
    /**
     * READ-ONLY MIRROR of the AdminPortal → Assessment Config policy.
     * Never mutated from Stage 05 — admin policy is referenced, not duplicated.
     */
    orgPolicy: OrgPolicyMirror;
  };
  status: AssessmentStatus;
  /** Bumps on EVERY content edit; binds and invalidates approval. */
  version: number;
  approval: ApprovalRecord;
  dispatch?: DispatchRecord;
};

export type AnswerValue = { text?: string; choice?: number; files?: string[] };
export type AnswerMap = Record<string, AnswerValue>;

export type Submission = {
  assessmentId: string;
  /** Pinned to the version actually taken. */
  assessmentVersion: number;
  candidate: string;
  init: string;
  answers: AnswerMap;
  submittedAt: string;
  /** Scored against `rubric`, not private criteria. */
  perDimension: { key: string; score: number; evidence: string }[];
  score?: number;
  verdict?: "Pass" | "Borderline" | "Fail";
  originalityFlag?: string | null;
  /** Originality confidence, %, when a flag is present. */
  originalityConfidence?: number;
  /** The grader's one-line summary, as Stage 05 renders it. */
  note?: string;
};

/** In-progress work, saved by the player before submit. */
export type AnswerDraft = {
  assessmentId: string;
  candidate: string;
  answers: AnswerMap;
  savedAt: string;
};

/** The only thing a candidate is ever handed. */
export type CandidateAssessment = Omit<Assessment, "questions" | "approval" | "provenance"> & {
  questions: Omit<AssessmentQuestion, "answerKey">[];
  rubricChips: { qid: string; labels: string[] }[];
};

/* ------------------------------------------------------------------ *
 * The rubric — the ONE literal. Stage 02 renders this; Stage 05 snapshots it.
 * ------------------------------------------------------------------ */

/** The Stage-02 JD must-haves this rubric was derived from (Role.tsx). */
export const MUST_HAVES = [
  "6+ yrs product design",
  "Shipped 0→1 product work",
  "Design-systems experience",
  "Strong portfolio",
];

export const RUBRIC_VERSION = "v3";

export const MASTER_RUBRIC: RubricDim[] = [
  { key: "portfolio-depth", dim: "Portfolio depth", weight: 25, fromMustHave: "Strong portfolio" },
  { key: "systems-thinking", dim: "Systems thinking", weight: 25, fromMustHave: "Design-systems experience" },
  { key: "visual-craft", dim: "Visual craft", weight: 20, fromMustHave: "Shipped 0→1 product work" },
  { key: "communication", dim: "Communication", weight: 15, fromMustHave: "6+ yrs product design" },
  { key: "collaboration", dim: "Collaboration", weight: 15, fromMustHave: "6+ yrs product design" },
];

/** Stage 02's scorecard shape, derived — so Role.tsx holds no rubric literal. */
export const SCORECARD: { dim: string; w: string }[] = MASTER_RUBRIC.map((d) => ({
  dim: d.dim,
  w: `${d.weight}%`,
}));

export const dimByKey = (rubric: RubricDim[], key: string): RubricDim | undefined =>
  rubric.find((d) => d.key === key);

/** Labels for a question's "Scored on: Systems thinking · 25%" chips. */
export const dimLabels = (rubric: RubricDim[], keys: string[]): string[] =>
  keys
    .map((k) => dimByKey(rubric, k))
    .filter((d): d is RubricDim => Boolean(d))
    .map((d) => `${d.dim} · ${d.weight}%`);

/** Verdict chip colours, as Stage 05 already renders them. */
export const VERDICT_TONE: Record<"Pass" | "Borderline" | "Fail", { color: string; bg: string; tone: string }> = {
  Pass: { color: "#129152", bg: "#ECF9F3", tone: "#16B364" },
  Borderline: { color: "#8F6304", bg: "#FEF7E6", tone: "#EBA308" },
  Fail: { color: "#B42318", bg: "#FEF3F2", tone: "#E81E17" },
};

/* ------------------------------------------------------------------ *
 * Org policy mirror — set in Admin → Assessment Config, never written here.
 * (AdminPortal: default duration 60, proctoring off, plagiarism on, emails on.)
 * ------------------------------------------------------------------ */

export const ORG_POLICY: OrgPolicyMirror = {
  source: "Admin · Assessment Config",
  defaultDurationMins: 60,
  proctoring: false,
  plagiarism: true,
  notifyByEmail: true,
};

/** The one named human who may approve a brief on this requisition. */
export const HIRING_MANAGER: ApprovalRecord["reviewer"] = {
  personaId: "manager",
  name: "Ngozi Adeyemi",
  title: "Engineering Manager",
  init: "NA",
};

/* ------------------------------------------------------------------ *
 * Seed — ASM-01 (sent, what the candidate takes) + ASM-02 (drafted, the one
 * that walks the approval gate live in the demo).
 * ------------------------------------------------------------------ */

export const ASM_01: Assessment = {
  id: "ASM-01",
  roleId: "R-SPD",
  roleTitle: "Senior Product Designer",
  title: "Redesign a failing checkout flow",
  type: "take-home",
  durationMins: 180,
  window: "3 days",
  brief:
    "3-hour take-home. A fintech checkout loses 38% of customers at the card-entry step. Diagnose why, redesign the step, and show how the fix generalises to the design system. Candidates submit a Figma file plus a 1-page systems rationale. Mapped to the Stage-02 must-haves: portfolio depth, systems thinking, craft.",
  deliverables: [
    { label: "Figma file or prototype link", detail: "Key screens for the redesigned card-entry step, plus any component work." },
    { label: "1-page systems rationale", detail: "How the fix generalises — tokens, components, states, and what you deliberately left alone." },
    { label: "2-minute walkthrough", detail: "A screen recording talking through your diagnosis and the trade-offs you made." },
  ],
  questions: [
    {
      id: "Q1",
      kind: "longtext",
      kicker: "DIAGNOSIS",
      title: "Diagnose the drop-off",
      prompt:
        "A fintech checkout has a 38% drop-off at the card-entry step. Walk us through how you'd diagnose the problem — what you'd measure, what you'd rule out, and which two or three causes you'd bet on. Be explicit about the evidence you would need to be wrong.",
      dimKeys: ["systems-thinking", "communication"],
      required: true,
      minWords: 150,
    },
    {
      id: "Q2",
      kind: "upload",
      kicker: "DESIGN EXERCISE",
      title: "Submit your redesign",
      prompt:
        "Redesign the card-entry step and the screens either side of it. Include the component and token changes your fix implies, and attach the 1-page systems rationale that explains how it extends the design system rather than working around it.",
      dimKeys: ["portfolio-depth", "visual-craft"],
      required: true,
      accept: "Figma link, PDF or PNG",
    },
    {
      id: "Q3",
      kind: "video",
      kicker: "WALKTHROUGH",
      title: "2-minute walkthrough",
      prompt:
        "Record a short walkthrough of your redesign. Tell us what you'd hand to engineering first, what you'd need from product, and how you'd know within two weeks whether the fix worked.",
      dimKeys: ["communication", "collaboration"],
      required: true,
      maxMinutes: 2,
    },
  ],
  rubric: MASTER_RUBRIC,
  provenance: {
    mustHaves: ["Shipped 0→1 product work", "Design-systems experience", "Strong portfolio"],
    rubricVersion: RUBRIC_VERSION,
    generatedAt: "Aug 19, 16:41",
    model: "Brew",
    orgPolicy: ORG_POLICY,
  },
  status: "sent",
  version: 2,
  approval: {
    reviewer: HIRING_MANAGER,
    submittedBy: "Samuel Omosehin (Talent Lead)",
    submittedAt: "Aug 20, 09:18",
    decision: "approved",
    decidedAt: "Aug 20, 11:40",
    comment: "Rubric mapping looks right, ship it.",
    approvedVersion: 2,
    round: 1,
  },
  dispatch: {
    sentBy: "Samuel Omosehin (Talent Lead)",
    sentAt: "Aug 20, 12:05",
    recipients: [
      { name: "Adaeze Okafor", init: "AO" },
      { name: "Tunde Bakare", init: "TB" },
      { name: "Chiamaka Eze", init: "CE" },
      { name: "Emeka Nwosu", init: "EN" },
      { name: "Fatima Bello", init: "FB" },
      { name: "Chidinma Eke", init: "CE" },
    ],
    dueAt: "Aug 23, 17:00",
    approvalRef: "APV-2 · Ngozi Adeyemi · Aug 20, 11:40",
  },
};

export const ASM_02: Assessment = {
  id: "ASM-02",
  roleId: "R-SPD",
  roleTitle: "Senior Product Designer",
  title: "Design-system audit & extension",
  type: "timed-test",
  durationMins: 90,
  brief:
    "90-minute timed exercise. Candidates audit a small, drifting button and form-field set, then extend it to cover a case it does not yet handle. Tests whether portfolio depth is backed by real systems judgement rather than one-off screens.",
  deliverables: [
    { label: "Audit notes", detail: "What has drifted, what it costs, and what you would fix first." },
    { label: "Extended component", detail: "One component extended to cover the missing case, with its states." },
  ],
  questions: [
    {
      id: "Q1",
      kind: "mcq",
      kicker: "SYSTEMS JUDGEMENT",
      title: "Token or component?",
      prompt:
        "Three products each ship a slightly different destructive-action button. What is the first change you would make to the system?",
      dimKeys: ["systems-thinking"],
      required: true,
      options: [
        "Add a `danger` variant to the shared button component",
        "Add a `color-danger` token and let each product style its own button",
        "Document the three variants and leave them in place",
        "Deprecate the shared button and let each product own its own",
      ],
      answerKey: 0,
    },
    {
      id: "Q2",
      kind: "longtext",
      kicker: "AUDIT",
      title: "Audit the button set",
      prompt:
        "Review the attached button and form-field set. Name the three most expensive inconsistencies, say what each one costs the team in practice, and put them in the order you'd fix them.",
      dimKeys: ["systems-thinking", "visual-craft"],
      required: true,
      minWords: 120,
    },
    {
      id: "Q3",
      kind: "upload",
      kicker: "EXTENSION",
      title: "Extend one component",
      prompt:
        "Pick one component from the audit and extend it to cover the case the system currently cannot express. Show every state, and note what you deliberately did not change.",
      dimKeys: ["portfolio-depth", "visual-craft"],
      required: true,
      accept: "Figma link or PNG",
    },
  ],
  rubric: MASTER_RUBRIC,
  provenance: {
    mustHaves: ["Design-systems experience", "Strong portfolio", "6+ yrs product design"],
    rubricVersion: RUBRIC_VERSION,
    generatedAt: "Aug 27, 08:12",
    model: "Brew",
    orgPolicy: ORG_POLICY,
  },
  status: "drafted",
  version: 1,
  approval: { reviewer: HIRING_MANAGER, round: 1 },
};

export const SEED_ASSESSMENTS: Assessment[] = [ASM_01, ASM_02];

/**
 * The five graded submissions Stage 05 already showed, now real records on
 * ASM-01 and scored against MASTER_RUBRIC (each weighted composite reproduces
 * the score the screen displayed).
 */
export const SEED_SUBMISSIONS: Submission[] = [
  {
    assessmentId: "ASM-01",
    assessmentVersion: 2,
    candidate: "Adaeze Okafor",
    init: "AO",
    answers: {
      Q1: { text: "Drop-off concentrates on the first card-number blur, not on submit — the field validates too early and rejects spaced input. I'd instrument per-field abandonment before touching the visual design." },
      Q2: { files: ["adaeze-okafor-checkout.fig", "systems-rationale.pdf"] },
      Q3: { files: ["walkthrough.mp4"] },
    },
    submittedAt: "Aug 22, 10:12",
    perDimension: [
      { key: "portfolio-depth", score: 95, evidence: "Three shipped payments flows, each with before/after metrics." },
      { key: "systems-thinking", score: 96, evidence: "Fix expressed as a token + input-state change, not a one-off screen." },
      { key: "visual-craft", score: 93, evidence: "Error and pending states drawn at full fidelity." },
      { key: "communication", score: 94, evidence: "Rationale states what evidence would prove her wrong." },
      { key: "collaboration", score: 90, evidence: "Names the engineering hand-off order explicitly." },
    ],
    score: 94,
    verdict: "Pass",
    originalityFlag: null,
    note: "Strong systems rationale · original",
  },
  {
    assessmentId: "ASM-01",
    assessmentVersion: 2,
    candidate: "Tunde Bakare",
    init: "TB",
    answers: {
      Q1: { text: "The card-entry step asks for too much at once. I'd split it and reduce the visual weight of the CVV helper." },
      Q2: { files: ["tunde-bakare-checkout.fig"] },
      Q3: { files: ["walkthrough.mp4"] },
    },
    submittedAt: "Aug 22, 14:47",
    perDimension: [
      { key: "portfolio-depth", score: 90, evidence: "Deep payments portfolio, well documented." },
      { key: "systems-thinking", score: 82, evidence: "Rationale is thin on how the fix generalises." },
      { key: "visual-craft", score: 97, evidence: "Exceptional execution, pixel-level consistency." },
      { key: "communication", score: 84, evidence: "Walkthrough clear but skips the measurement plan." },
      { key: "collaboration", score: 88, evidence: "Good on hand-off, light on product dependencies." },
    ],
    score: 88,
    verdict: "Pass",
    originalityFlag: null,
    note: "Excellent craft, thin rationale",
  },
  {
    assessmentId: "ASM-01",
    assessmentVersion: 2,
    candidate: "Chiamaka Eze",
    init: "CE",
    answers: {
      Q1: { text: "I'd start with the error copy and focus order — the step is unusable with a screen reader, which shows up as drop-off long before it shows up as a complaint." },
      Q2: { files: ["chiamaka-eze-checkout.fig", "rationale.pdf"] },
      Q3: { files: ["walkthrough.mp4"] },
    },
    submittedAt: "Aug 23, 09:05",
    perDimension: [
      { key: "portfolio-depth", score: 84, evidence: "Solid range, fewer 0→1 examples." },
      { key: "systems-thinking", score: 88, evidence: "Treats accessibility as a system property, not a pass at the end." },
      { key: "visual-craft", score: 82, evidence: "Clean, restrained; less distinctive than the top two." },
      { key: "communication", score: 88, evidence: "Well-structured rationale, easy to act on." },
      { key: "collaboration", score: 84, evidence: "Clear about what she'd need from engineering." },
    ],
    score: 85,
    verdict: "Pass",
    originalityFlag: null,
    note: "Accessible, well-structured",
  },
  {
    assessmentId: "ASM-01",
    assessmentVersion: 2,
    candidate: "Emeka Nwosu",
    init: "EN",
    answers: {
      Q1: { text: "Checkout abandonment is a multifaceted problem that requires a holistic approach across the entire user journey, leveraging best practices in conversion rate optimisation." },
      Q2: { files: ["emeka-nwosu-checkout.fig"] },
      Q3: { files: ["walkthrough.mp4"] },
    },
    submittedAt: "Aug 23, 15:38",
    perDimension: [
      { key: "portfolio-depth", score: 74, evidence: "Portfolio real, but thin on payments." },
      { key: "systems-thinking", score: 68, evidence: "Rationale stays generic — no specifics about this checkout." },
      { key: "visual-craft", score: 76, evidence: "Competent screens, inconsistent spacing scale." },
      { key: "communication", score: 68, evidence: "Prose reads AI-assisted; walkthrough is stronger than the writing." },
      { key: "collaboration", score: 70, evidence: "Little on hand-off or dependencies." },
    ],
    score: 71,
    verdict: "Borderline",
    originalityFlag: "AI-generated",
    originalityConfidence: 64,
    note: "Rationale reads AI-assisted · 64% conf.",
  },
  {
    assessmentId: "ASM-01",
    assessmentVersion: 2,
    candidate: "Fatima Bello",
    init: "FB",
    answers: {
      Q1: { text: "The step buries the accepted-cards information below the fold, so people who are unsure whether their card works simply leave. I'd surface it and add an inline check." },
      Q2: { files: ["fatima-bello-checkout.pdf"] },
      Q3: { files: ["walkthrough.mp4"] },
    },
    submittedAt: "Aug 23, 16:52",
    perDimension: [
      { key: "portfolio-depth", score: 76, evidence: "Good UX case studies, fewer finished visuals." },
      { key: "systems-thinking", score: 78, evidence: "Sound reasoning, stops short of the component implications." },
      { key: "visual-craft", score: 62, evidence: "Execution is the weak point — type and spacing drift." },
      { key: "communication", score: 78, evidence: "Clear, concise rationale." },
      { key: "collaboration", score: 76, evidence: "Practical about what engineering would push back on." },
    ],
    score: 74,
    verdict: "Borderline",
    originalityFlag: null,
    note: "Solid UX, weaker visual execution",
  },
];

/** The history Stage 05's Approval tab renders as its transition log. */
export const SEED_AUDIT: { at: string; actor: string; action: string; subject: string }[] = [
  { at: "Aug 27, 08:12", actor: "Brew", action: "generated assessment brief from the Stage-02 must-haves (v1)", subject: ASM_02.title },
  { at: "Aug 20, 12:05", actor: "Samuel Omosehin (Talent Lead)", action: "sent to 6 shortlisted candidates · approval APV-2 (Ngozi Adeyemi, Aug 20, 11:40)", subject: ASM_01.title },
  { at: "Aug 20, 11:40", actor: "Ngozi Adeyemi (Engineering Manager)", action: 'approved assessment v2 — "Rubric mapping looks right, ship it."', subject: ASM_01.title },
  { at: "Aug 20, 09:18", actor: "Samuel Omosehin (Talent Lead)", action: "submitted assessment for hiring-manager review (v2) — Ngozi Adeyemi notified", subject: ASM_01.title },
  { at: "Aug 19, 17:02", actor: "Samuel Omosehin (Talent Lead)", action: "edited brief — now v2", subject: ASM_01.title },
  { at: "Aug 19, 16:41", actor: "Brew", action: "generated assessment brief from the Stage-02 must-haves (v1)", subject: ASM_01.title },
];

/* ------------------------------------------------------------------ *
 * The gate — defined ONCE, used verbatim by the UI and by the reducer.
 * ------------------------------------------------------------------ */

export const canSend = (
  a: Assessment,
  persona: PersonaId,
  recipients: DispatchRecord["recipients"],
): boolean =>
  persona === "hr" &&
  a.status === "approved" &&
  a.approval.decision === "approved" &&
  a.approval.approvedVersion === a.version &&
  recipients.length > 0;

export const sendBlockReason = (
  a: Assessment,
  persona: PersonaId,
  recipients: DispatchRecord["recipients"],
): string | null => {
  if (persona !== "hr") return "Only the recruiter who owns this requisition can dispatch an assessment.";
  if (a.status === "drafted" || a.status === "editing")
    return `Blocked — this brief has not been reviewed. Submit it to ${a.approval.reviewer.name} (${a.approval.reviewer.title}) first.`;
  if (a.status === "in_review")
    return `Blocked — awaiting review by ${a.approval.reviewer.name} (${a.approval.reviewer.title}). Submitted ${a.approval.submittedAt ?? "—"}.`;
  if (a.status === "changes_requested")
    return `Blocked — ${a.approval.reviewer.name} requested changes: “${a.approval.comment ?? ""}”. Reopen, address them and resubmit.`;
  if (a.status === "approved" && a.approval.approvedVersion !== a.version)
    return `Blocked — ${a.approval.reviewer.name} approved v${a.approval.approvedVersion}; this is v${a.version}. Re-submit the edited brief for review.`;
  // The complement of canSend() must be total: a status of "approved" that no
  // live decision backs would otherwise return null here while canSend() is
  // false, and null from a paired predicate reads as permission.
  if (a.approval.decision !== "approved") return "Blocked — there is no live approval on this brief.";
  if (a.status === "sent") return "Already sent — this record is frozen.";
  if (recipients.length === 0) return "Pick at least one candidate to send this to.";
  return null;
};

/** Content is editable by the author only, and never while under review or after dispatch. */
export const canEditContent = (a: Assessment, persona: PersonaId): boolean =>
  persona === "hr" && (a.status === "drafted" || a.status === "editing" || a.status === "approved");

export const editBlockReason = (a: Assessment, persona: PersonaId): string | null => {
  if (persona !== "hr") return "Read-only — you're not the recruiter who owns this requisition.";
  if (a.status === "in_review") return `Locked while ${a.approval.reviewer.name} reviews v${a.version}.`;
  if (a.status === "changes_requested") return "Reopen the brief to address the feedback before editing.";
  if (a.status === "sent") return "Sent — this record is frozen so every submission still matches what candidates saw.";
  return null;
};

/** No self-approval: only the named reviewer persona, and never the submitter. */
export const canApprove = (a: Assessment, persona: PersonaId, actor?: string): boolean =>
  persona === a.approval.reviewer.personaId &&
  a.status === "in_review" &&
  (!actor || actor !== a.approval.submittedBy);

export const approveBlockReason = (a: Assessment, persona: PersonaId, actor?: string): string | null => {
  if (persona !== a.approval.reviewer.personaId)
    return `Only ${a.approval.reviewer.name} (${a.approval.reviewer.title}) can approve this brief. You cannot approve your own draft.`;
  if (a.status !== "in_review") return "Nothing to review — the recruiter hasn't submitted this yet.";
  if (actor && actor === a.approval.submittedBy) return "You cannot approve a brief you submitted yourself.";
  return null;
};

/** A brief is only submittable when every question is mapped to the rubric. */
export const reviewReadiness = (a: Assessment): { ok: boolean; reason: string | null } => {
  if (a.questions.length === 0) return { ok: false, reason: "Add at least one question before submitting for review." };
  const unmapped = a.questions.filter((q) => q.dimKeys.length === 0);
  if (unmapped.length)
    return {
      ok: false,
      reason: `Map ${unmapped.map((q) => q.id).join(", ")} to at least one rubric dimension — the reviewer can't judge an unmapped question.`,
    };
  return { ok: true, reason: null };
};

export const canSubmitForReview = (a: Assessment, persona: PersonaId): boolean =>
  persona === "hr" && (a.status === "drafted" || a.status === "editing") && reviewReadiness(a).ok;

/* ------------------------------------------------------------------ *
 * The candidate accessor — the ONLY way a brief reaches a candidate.
 * ------------------------------------------------------------------ */

/**
 * Returns null for anything that has not passed the gate. An unapproved brief
 * is not merely hidden from the candidate UI — it is unreachable through the
 * only accessor the candidate side has.
 */
export function toCandidateView(a: Assessment): CandidateAssessment | null {
  if (a.status !== "sent") return null;
  return {
    id: a.id,
    roleId: a.roleId,
    roleTitle: a.roleTitle,
    title: a.title,
    type: a.type,
    durationMins: a.durationMins,
    window: a.window,
    brief: a.brief,
    deliverables: a.deliverables,
    rubric: a.rubric,
    status: a.status,
    version: a.version,
    dispatch: a.dispatch,
    // Rebuilt field-by-field, so `answerKey` cannot leak by omission.
    questions: a.questions.map((q) => ({
      id: q.id,
      kind: q.kind,
      kicker: q.kicker,
      title: q.title,
      prompt: q.prompt,
      dimKeys: q.dimKeys,
      required: q.required,
      minWords: q.minWords,
      accept: q.accept,
      maxMinutes: q.maxMinutes,
      options: q.options,
    })),
    rubricChips: a.questions.map((q) => ({ qid: q.id, labels: dimLabels(a.rubric, q.dimKeys) })),
  };
}

/* ------------------------------------------------------------------ *
 * Small pure helpers shared by both ends.
 * ------------------------------------------------------------------ */

export const TYPE_LABEL: Record<AssessmentType, string> = {
  "take-home": "Take-home",
  "timed-test": "Timed test",
  "video-prompt": "Video prompt",
};

export const STATUS_LABEL: Record<AssessmentStatus, string> = {
  drafted: "AI drafted",
  editing: "Draft",
  in_review: "Pending Approval",
  changes_requested: "Changes requested",
  approved: "Approved",
  sent: "Sent",
};

/** The 4-node status rail above Stage 05's tabs. */
export const RAIL_NODES: { key: string; label: string; states: AssessmentStatus[] }[] = [
  { key: "drafted", label: "Drafted", states: ["drafted", "editing"] },
  { key: "review", label: "In review", states: ["in_review", "changes_requested"] },
  { key: "approved", label: "Approved", states: ["approved"] },
  { key: "sent", label: "Sent", states: ["sent"] },
];

export const railIndex = (status: AssessmentStatus): number =>
  Math.max(0, RAIL_NODES.findIndex((n) => n.states.includes(status)));

export const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;

/** Is this answer good enough to count as answered for a required question? */
export const isAnswered = (q: Pick<AssessmentQuestion, "kind" | "minWords">, v?: AnswerValue): boolean => {
  if (!v) return false;
  if (q.kind === "mcq") return typeof v.choice === "number";
  if (q.kind === "upload" || q.kind === "video") return Boolean(v.files?.length) || Boolean(v.text?.trim());
  const words = wordCount(v.text ?? "");
  return words > 0 && (!q.minWords || words >= q.minWords);
};

/** Weighted composite from per-dimension scores — the same maths Stage 04 uses. */
export const compositeScore = (
  rubric: RubricDim[],
  perDimension: { key: string; score: number }[],
): number | undefined => {
  if (!perDimension.length) return undefined;
  let total = 0;
  let weight = 0;
  for (const d of rubric) {
    const hit = perDimension.find((p) => p.key === d.key);
    if (!hit) continue;
    total += hit.score * d.weight;
    weight += d.weight;
  }
  return weight ? Math.round(total / weight) : undefined;
};
