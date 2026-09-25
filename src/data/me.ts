/**
 * me.ts — the employee-scoped selector layer. ONE person: E-0214, Amara Okonkwo.
 *
 * Every Talent OS page before this one is written from the employer's side —
 * manager rollups, HR calibration, recruiter pipelines. The Me pages are the
 * first surfaces written from the subject's side, and that inverts what may be
 * rendered. This module is the boundary where that inversion is enforced ONCE,
 * so no individual page has to remember it.
 *
 * IMPORT FENCE — this module must never import from Retention.tsx, Attrition.tsx,
 * DeptHealth.tsx, ManagerHome.tsx, Mobility.tsx or SkillsGraph.tsx, and must never
 * re-export `risk`, `perf`, `engagement`, `qoh` or `monthsSincePromo`. Those are
 * the employer's read of her, not hers. `ME_PUBLIC` drops them at the TYPE level
 * so a Me page cannot render the leave-risk badge even by accident — which is the
 * bug that shipped on /mobility, where Amara could read her own score of 78.
 *
 * The rule, in one sentence: a Me page renders exactly one person's record, only
 * the parts of it that are hers to see, and never a value the company has not
 * released to her.
 */
import { EMPLOYEES, OKRS, ONE_ON_ONES, REVIEW_CYCLE, MOBILITY, SKILL_CLUSTERS, type OneOnOne } from "@/data/talentos";
import {
  CONSENT_RECORDS, ORG_PLACEMENT, IMPORTED_PROFILE, GROWTH_SKELETON,
  LND_ENTITLEMENT, VISIBILITY, VISIBILITY_CALLOUT_INDEX, RIGHT_TO_EXPLANATION,
  NEXT_CYCLE, HANDBOOK,
} from "@/data/onboarding";
import type { PfTone } from "@/components/os/ui";

export const ME_ID = "E-0214";

const RAW = EMPLOYEES[0];

/**
 * The subject's own view of her record. `risk`, `perf`, `engagement`, `qoh` and
 * `monthsSincePromo` are deliberately absent — see the import fence above.
 */
export type MePublic = {
  id: string; name: string; init: string; tone: string;
  role: string; dept: string; loc: string; grade: string;
  tenure: string; contract: string; status: string;
  skills: string[]; hiredVia?: string;
};

export const ME_PUBLIC: MePublic = {
  id: RAW.id, name: RAW.name, init: RAW.init, tone: RAW.tone,
  role: RAW.role, dept: RAW.dept, loc: RAW.loc,
  /** L5 — IMPORTED_PROFILE still carries the wrong L4, which /my-profile lets her correct. */
  grade: RAW.grade, tenure: RAW.tenure, contract: RAW.contract, status: RAW.status,
  skills: RAW.skills, hiredVia: RAW.hiredVia,
};

export const ME_FIRST = "Amara";

export const MY_MANAGER = ORG_PLACEMENT.manager;
export const MY_SKIP = ORG_PLACEMENT.skip;
export const MY_SQUAD = ORG_PLACEMENT.squad;

/* ------------------------------- goals & OKRs ------------------------------ */

export type MyGoal = { id: string; title: string; pct: number; due: string; status: string; tone: PfTone; fresh?: boolean };

/** Two live goals averaging 65% — the same 65 as REVIEW_CYCLE.rows[0].goalAttainment. */
export const MY_GOALS: MyGoal[] = [
  { id: "g1", title: "Payments reliability — 99.95% uptime", pct: 72, due: "Sep 30", status: "On track", tone: "green" },
  { id: "g2", title: "Mentor 2 engineers to L4 readiness", pct: 58, due: "Sep 30", status: "Behind", tone: "yellow" },
];

/** Assigned by the WhatsApp nudge — ties to the overdue action item in MY_ONEONONE. */
export const MY_NUDGE_GOAL: MyGoal = { id: "g3", title: "Design-system migration — plan & rollout", pct: 0, due: "Aug 15", status: "New", tone: "blue", fresh: true };

/** Her individual objective. OKRS holds Company O-01 and Department O-02 as the ladder above it. */
export const MY_OKR = {
  id: "O-06", level: "Individual" as const, owner: ME_PUBLIC.name, quarter: "Q3 2026",
  objective: "Land the payments reliability programme", progress: 66, status: "on-track" as const,
  krs: [
    { kr: "p95 checkout latency ≤ 900ms", progress: 74, status: "on-track" as const },
    { kr: "Incident MTTR ≤ 45min", progress: 58, status: "behind" as const },
  ],
};

/** Only her chain — company → department → hers. Never sibling ICs' objectives. */
export const MY_LADDER = {
  company: OKRS.find((o) => o.level === "Company")!,
  department: OKRS.find((o) => o.level === "Department")!,
  mine: MY_OKR,
};

/** ★ INVENTED — 4 prior check-ins back-derived from the current percentages. */
export const MY_CHECKINS: { goalId: string; at: string; from: number; to: number }[] = [
  { goalId: "g1", at: "Jul 22", from: 66, to: 72 },
  { goalId: "g2", at: "Jul 22", from: 56, to: 58 },
  { goalId: "g1", at: "Jul 15", from: 60, to: 66 },
  { goalId: "g2", at: "Jul 08", from: 50, to: 56 },
];

/* --------------------------------- 1-on-1s --------------------------------- */

/**
 * ONE_ON_ONES[0] INVERTED. The fixture is written from Ngozi's side — `with` is
 * "Amara Okonkwo" and actions owned by the manager say `owner: "You"`. From the
 * subject's side the counterparty is the MANAGER, and "You" means Amara.
 */
export const MY_ONEONONE: OneOnOne = {
  ...ONE_ON_ONES[0],
  with: MY_MANAGER.name, init: MY_MANAGER.init, tone: MY_MANAGER.tone, role: MY_MANAGER.role,
};

/** Commitments SHE owns. The manager's own items are not hers to tick. */
export const MY_ACTIONS = ONE_ON_ONES[0].actions.filter((a) => a.owner === ME_FIRST);
/** What her manager committed to — visible, not actionable. */
export const THEIR_ACTIONS = ONE_ON_ONES[0].actions.filter((a) => a.owner !== ME_FIRST);

/* ---------------------------------- review --------------------------------- */

export const MY_REVIEW_ROW = REVIEW_CYCLE.rows[0];
export const MY_CYCLE = { name: REVIEW_CYCLE.name, closes: REVIEW_CYCLE.closes };
export const MY_NEXT_CYCLE = NEXT_CYCLE;

/** The 5-point competency scale with its anchors — the same taxonomy the manager scores against. */
export const MY_COMPETENCIES = [
  { name: "Craft & technical depth", anchors: ["Needs close support", "Solid on routine work", "Strong across the stack", "Deep expertise, raises the bar", "Recognised authority"] },
  { name: "Execution & ownership", anchors: ["Misses commitments", "Delivers with reminders", "Reliable end-to-end", "Owns outcomes beyond scope", "Multiplies team delivery"] },
  { name: "Collaboration", anchors: ["Works apart from the team", "Cooperates when asked", "Reliable partner", "Actively unblocks others", "Builds bridges across teams"] },
  { name: "Communication", anchors: ["Hard to follow", "Clear in routine updates", "Clear and concise", "Tailors to any audience", "Sets the standard"] },
  { name: "Leadership & mentoring", anchors: ["Not yet visible", "Supports peers ad hoc", "Mentors consistently", "Grows others deliberately", "Force multiplier"] },
];

/** Two still unscored — which is exactly the page's job. */
export const MY_SELF_SCORES = [4, 5, 4, 0, 0];

export const MY_REVIEW_HISTORY: { cycle: string; rating: string; attain: string; rec: string; recTone: PfTone }[] = [
  { cycle: "Q1 2026 · Annual", rating: "4.5/5", attain: "80%", rec: "Promote-track", recTone: "green" },
  { cycle: "Q3 2025 · Mid-year", rating: "4.2/5", attain: "74%", rec: "Retain", recTone: "blue" },
];

/**
 * ★ INVENTED — one flag. ReviewCycles' own copy says the manager narrative is
 * shared only AFTER calibration, so the subject's page must honour that: her
 * manager's narrative, the AI packet and `recommendation: "Promote"` render only
 * when this is true. It is false, and the page says why.
 */
export const MY_REVIEW_RELEASE = { released: false, sharedAfter: "calibration · Jul 15" };

/* -------------------------------- feedback --------------------------------- */

export type MyFeedbackItem = {
  id: string; giver: string; receiver: string; init: string; tone: string;
  rel?: string; competency: string; type: "Praise" | "Constructive"; time: string;
  visibility: string; text: string;
};

/**
 * Only items she is party to. FeedbackHub renders the whole org stream and
 * filters by TYPE, never by viewer — which is why four peer-to-peer notes marked
 * "Private to them" between other people are visible there today.
 */
export const MY_FEEDBACK: MyFeedbackItem[] = [
  { id: "F-106", giver: MY_MANAGER.name, receiver: ME_PUBLIC.name, init: "NA", tone: "#16B364", rel: "Manager", competency: "Technical depth", type: "Praise", time: "2h ago", visibility: "Private to them", text: "Your payments-incident writeup was the clearest I have read all year — root cause, blast radius and the fix on one page. Exactly the Staff-track signal we talked about in our 1-on-1." },
  { id: "F-101", giver: MY_MANAGER.name, receiver: ME_PUBLIC.name, init: "NA", tone: "#16B364", rel: "Manager", competency: "Technical leadership", type: "Praise", time: "Jul 2026", visibility: "Private to them", text: "Ran the payments-incident review end to end — calm comms under pressure, remediation shipped in 48h. Exactly the Staff-level bar." },
  { id: "F-098", giver: "Chidi Okeke", receiver: ME_PUBLIC.name, init: "CO", tone: "#E81E17", rel: "Peer · mentee", competency: "Mentoring", type: "Praise", time: "Jun 2026", visibility: "Private to them", text: "Amara's pairing sessions got me productive on the Go services in my first month. Best onboarding I've had." },
  { id: "F-094", giver: MY_SKIP.name, receiver: ME_PUBLIC.name, init: "OK", tone: "#16B364", rel: "Skip-level · VP Engineering", competency: "Communication", type: "Constructive", time: "May 2026", visibility: "Private to them", text: "Design docs are excellent; would love more of that framing surfaced in cross-team forums, not just inside the squad." },
  { id: "F-090", giver: "Adaeze Okafor", receiver: ME_PUBLIC.name, init: "AD", tone: "#16B364", rel: "Peer", competency: "Collaboration", type: "Praise", time: "Apr 2026", visibility: "Visible to your manager", text: "Unblocked the design-system migration spike for us in an afternoon after it had been stuck for a week." },
];

export const MY_FEEDBACK_GIVEN: MyFeedbackItem[] = [
  { id: "F-088", giver: ME_PUBLIC.name, receiver: "Chidi Okeke", init: "CO", tone: "#E81E17", rel: "Mentee", competency: "Execution & ownership", type: "Praise", time: "Jun 2026", visibility: "Private to them", text: "Took the payment-retry ticket end to end including the runbook update — nobody asked for the runbook. That is the habit to keep." },
  { id: "F-085", giver: ME_PUBLIC.name, receiver: "Adaeze Okafor", init: "AD", tone: "#16B364", rel: "Peer", competency: "Collaboration", type: "Praise", time: "May 2026", visibility: "Private to them", text: "The review-packet spec saved us a whole round of back-and-forth. Thank you for writing it down." },
];

/**
 * F-106 is marked "Private to them" — "them" IS the subject, so she sees it.
 * Anything whose visibility excludes the subject is dropped even where she is
 * the subject. The predicate is here, once, rather than in each page.
 */
export const canSubjectSee = (f: MyFeedbackItem): boolean =>
  f.receiver === ME_PUBLIC.name ? f.visibility !== "Private to manager" : f.giver === ME_PUBLIC.name;

/* --------------------------------- growth ---------------------------------- */

export const MY_PLAN = {
  target: "Staff Engineer", track: "L5 → L6 · Engineering", readiness: 74,
  est: "2 quarters", sponsor: MY_MANAGER.name,
  seed: "Created from your Stage-11 quality-of-hire seed",
};

export const MY_GAPS = [
  { skill: "Distributed systems", have: 4.6, want: 4.5 },
  { skill: "Payments domain", have: 4.4, want: 4.0 },
  { skill: "Technical leadership", have: 3.2, want: 4.0 },
  { skill: "Mentoring & coaching", have: 3.6, want: 4.0 },
  { skill: "Org-level influence", have: 2.9, want: 4.0 },
];

export const MY_ASSESSMENTS = [
  { title: "Technical deep-dive", assessor: MY_MANAGER.name, init: MY_MANAGER.init, tone: MY_MANAGER.tone, status: "done" as const, score: "4.1/5", when: "Assessed Jun 28" },
  { title: "Leadership readiness", assessor: "External panel (2 assessors)", status: "scheduled" as const, when: "Aug 12" },
];

export const MY_MILESTONES = [
  { type: "Course", title: "Architecting payment systems at scale", state: "done" as const, meta: "Completed Jun 20 · 6h" },
  { type: "Stretch", title: "Lead payments v2 replatform", state: "active" as const, pct: 60, meta: "Due Sep 30" },
  { type: "Mentoring", title: "Mentor Chidi Okeke (L4, Payments)", state: "active" as const, meta: "3 of 6 sessions" },
  { type: "Certification", title: "AWS Solutions Architect — Professional", state: "todo" as const, meta: "Target Nov 2026" },
];

export const MY_AI_SUGGESTION = {
  insight: "Q2 review flags “time management” at-risk while the Technical-leadership gap is 0.8 — a delegation pattern.",
  suggestion: "Delegation workshop (2-day)", type: "Course", confidence: 82, evidence: "Q2 review + gap map",
};

/** Today vs the Stage-6 hiring score — the same person, two years apart. */
export const MY_SKILL_TRACK = [
  { name: "Distributed systems", score: 95, hire: 88 },
  { name: "Payments", score: 92, hire: 82 },
  { name: "Technical leadership", score: 81, hire: 70 },
  { name: "Mentoring", score: 88, hire: 78 },
  { name: "Communication", score: 84, hire: 80 },
];

/** Her claim-time baseline — "where you started" against MY_SKILL_TRACK's "where you are". */
export const MY_BASELINE_GAPS = GROWTH_SKELETON.gaps;

/** Market demand only. Holder counts and holder NAMES (SkillsGraph.HOLDERS) never appear. */
export const MY_DEMAND = SKILL_CLUSTERS;

/**
 * Her journey WITHOUT the risk event. EmployeeRecord's TIMELINE third entry is
 * "Leave-risk flag raised — HRBP visibility only · score 78" — HRBP-only by its
 * own label, so it is filtered out here rather than at each call site.
 */
export const MY_TIMELINE_SELF: { icon: string; tone: PfTone; title: string; date: string; sub: string }[] = [
  { icon: "arrowsq", tone: "green", title: "Hired via Recruit", date: "Nov 2023", sub: "Offer accepted · your hiring artifacts are attached to your record" },
  { icon: "arrowup", tone: "blue", title: "Promoted to L5 — Senior Software Engineer", date: "May 2025", sub: "Q1 review 4.5/5 · Promote-track · contract v2 issued" },
  { icon: "target", tone: "purple", title: "Staff-track growth plan opened", date: "Jun 2026", sub: `Sponsor ${MY_MANAGER.name} · readiness ${MY_PLAN.readiness}% · est. ${MY_PLAN.est}` },
];

/* -------------------------------- learning --------------------------------- */

export const NAIRA = (n: number) => `₦${n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `${Math.round(n / 1000)}k`}`;

export const MY_LEARNING = [
  { title: "Technical Leadership — Staff Track", provider: "Doronstack", module: "Module 5 of 8", pct: 68, offline: true },
  { title: "Architecting payment systems at scale", provider: "Doronstack", module: "Complete", pct: 100 },
  { title: "Incident command fundamentals", provider: "Doronstack", module: "Module 2 of 4", pct: 45 },
];

export const MY_UP_NEXT = [
  { title: "Payments domain masterclass", meta: "2h · self-paced" },
  { title: "Mentoring clinic — live session", meta: "Thu · 16:00 WAT" },
];

/** SEED_RECS R-1 and R-2 only. R-3 is Halima Sule's competency gap — not hers to see. */
export const MY_RECS = [
  { id: "R-1", title: "Deep Work — Time Management for Senior ICs", type: "Course", provider: "Doronstack ✦", time: "3h 15m", reason: "Time management scored at-risk in your Q2 review", source: "Q2 2026 review packet", confidence: 0.84 },
  { id: "R-2", title: "Distributed Systems Design Masterclass", type: "Course", provider: "Doronstack ✦", time: "6h 30m", reason: "Systems design is your open Staff-track gap", source: "Staff-track readiness scan", confidence: 0.79 },
];

/** HER entitlement — never the company's pool position (₦2.4M / 38% consumed). */
export const MY_ENTITLEMENT = {
  approverThreshold: LND_ENTITLEMENT.approverThreshold,
  yourDraw: LND_ENTITLEMENT.yourDraw,
  approver: MY_MANAGER.name,
  body: "Courses and coaching are drawn as entitlements — you never pay out of pocket.",
};

/** ★ INVENTED — 2 rows, so the ₦120k approval threshold is legible rather than abstract. */
export const MY_LND_REQUESTS = [
  { id: "LR-2", item: "Staff-track Career Coaching", cost: 120_000, state: "Pending" as const, at: "Requested Jul 24 · with " + MY_MANAGER.name },
  { id: "LR-1", item: "Architecting payment systems at scale", cost: 45_000, state: "Approved" as const, at: "Auto-approved Jun 12 · under threshold" },
];

/* -------------------------------- mobility --------------------------------- */

/**
 * ★ INVENTED — the scoring FUNCTION only. MOBILITY scores each role against one
 * pre-chosen person; from her side all three roles need HER match. Deterministic
 * overlap of her skills with the role's dimensions. Her honest low score on
 * HSE Manager is the point: an internal market that only ever shows you strong
 * matches is a brochure, not a market.
 */
export const matchFor = (dims: [string, number][]): number => {
  const mine = new Set(ME_PUBLIC.skills.map((s) => s.toLowerCase()));
  const hit = (d: string) => {
    const k = d.toLowerCase();
    for (const s of mine) if (k.includes(s) || s.includes(k.split(" ")[0])) return true;
    return false;
  };
  const total = dims.reduce((a, [d, v]) => a + (hit(d) ? v : Math.round(v * 0.35)), 0);
  return Math.round(total / dims.length);
};

export type MyMatch = { role: string; dept: string; loc: string; posted: string; match: number; dims: [string, number][] };

/** All three open roles, each scored for HER. `risk` is not on the type — see the fence. */
export const MY_MATCHES: MyMatch[] = MOBILITY.map((m) => ({
  role: m.role, dept: m.dept, loc: m.loc, posted: m.posted,
  match: m.candidate === ME_PUBLIC.name ? m.match : matchFor(m.dims),
  dims: m.dims,
}));

/** ★ INVENTED — 1 seed row. Deliberately not from lifecycle.SEED_ROLES: those are
 *  SEEPCO oil-and-gas requisitions, a different company's story from her squad. */
export const MY_APPLICATIONS = [
  { id: "MA-1", role: "Staff Engineer (Platform)", stage: "Internal interview", stageTone: "blue" as PfTone, day: 4, note: "Panel Thursday · your evidence pack was auto-built from your profile" },
];

/* --------------------------- profile & documents --------------------------- */

/** Includes the row the app already knows is wrong — Grade L4 → L5. */
export const MY_PROFILE_FIELDS = IMPORTED_PROFILE;

export const MY_DOCS = [
  { icon: "file", name: "Offer letter — signed", meta: "PDF · Nov 2023 · carried from your offer" },
  { icon: "file", name: "Employment contract v2 (L5 promotion)", meta: "PDF · May 2025" },
  { icon: "shield", name: "NDA & IP assignment", meta: "PDF · Nov 2023" },
];

export const MY_RETENTION_NOTE = "Retain 6y post-exit";

/** ★ INVENTED — a 3-period index. NO AMOUNTS: payroll is offsite (SeamlessHR)
 *  by the app's own model, so an outbound rail is the honest surface. */
export const MY_PAYSLIPS = [
  { period: "Jun 2026", state: "Issued", at: "Jun 25" },
  { period: "May 2026", state: "Issued", at: "May 25" },
  { period: "Apr 2026", state: "Issued", at: "Apr 25" },
];

export const MY_HANDBOOK_KEYS = ["hb-payroll", "hb-leave", "hb-expenses", "hb-remote", "hb-devices"];
export const MY_HANDBOOK = HANDBOOK.filter((h) => MY_HANDBOOK_KEYS.includes(h.id));

/* ------------------------------ data & privacy ----------------------------- */

/** All 12 rows — the transparency matrix that exists in the data and that the
 *  subject has never been able to reach (it renders only in HR's /onboarding-hub). */
export const MY_VISIBILITY = VISIBILITY;
export const MY_VISIBILITY_CALLOUT = VISIBILITY_CALLOUT_INDEX;
export const MY_EXPLANATION = RIGHT_TO_EXPLANATION;
export const MY_CONSENT = CONSENT_RECORDS[ME_ID];

/* ------------------------------- notifications ----------------------------- */

/** ★ INVENTED — the ENVELOPE only (id, when, read, where it goes). Every payload
 *  is derived from a record that already exists, so no new facts enter here. */
export type MyNotification = { id: string; icon: string; tone: PfTone; title: string; sub: string; at: string; go: string };

export const MY_NOTIFICATIONS: MyNotification[] = [
  { id: "N-1", icon: "target", tone: "blue", title: "New goal assigned", sub: `${MY_NUDGE_GOAL.title} · due ${MY_NUDGE_GOAL.due}`, at: "2h ago", go: "mygoals" },
  { id: "N-2", icon: "megaphone", tone: "green", title: `${MY_MANAGER.name} sent you feedback`, sub: "Technical depth · Praise", at: "2h ago", go: "myfeedback" },
  { id: "N-3", icon: "clipboard", tone: "yellow", title: "Your self-assessment closes Friday", sub: `${MY_CYCLE.name} · closes ${MY_CYCLE.closes} · 2 competencies unscored`, at: "Yesterday", go: "myreview" },
  { id: "N-4", icon: "warning", tone: "red", title: "Action item overdue", sub: `${MY_ACTIONS[0]?.item ?? "Share design-system migration plan"} · due ${MY_ACTIONS[0]?.due ?? "Jul 5"}`, at: "Yesterday", go: "myoneonones" },
  { id: "N-5", icon: "chat", tone: "purple", title: `1-on-1 with ${MY_MANAGER.name}`, sub: `${MY_ONEONONE.time} · 3 agenda items`, at: "Today", go: "myoneonones" },
  { id: "N-6", icon: "book", tone: "blue", title: "Module 5 ready", sub: `${MY_LEARNING[0].title} · ${MY_LEARNING[0].pct}% complete`, at: "2d ago", go: "mylearning" },
];

/* ----------------------------- mobile companion ---------------------------- */

export const MY_CACHED_COUNT = 4; // My week · goals · learning module · June payslip
export const MY_SHELL_KB = 180;
