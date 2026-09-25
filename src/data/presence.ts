/**
 * presence.ts — PRD v2.1 WS-10: FR-098 remote check-in, and the "who's in /
 * who's away" view FR-085 promised and never built.
 *
 * ── THE DOCTRINE CHANGE, STATED PLAINLY ────────────────────────────────────
 *
 * FR-089 says: ingest attendance signals, never capture them. That rule stands
 * and this module does not weaken it. FR-098 DOES capture — and the difference
 * is the act, not the data.
 *
 * A geofenced biometric clock-in is a measurement taken OF a worker: it happens
 * whether they participate or not, it is adversarial by construction, and it
 * exists to catch someone. A self-declared "I am working from home today" is a
 * statement made BY a worker to their colleagues. One is surveillance, the other
 * is a status message. They produce superficially similar rows in a database and
 * they are not the same product.
 *
 * So the line moved, in one direction only:
 *   · Remote and knowledge workers self-declare. They write the record, they can
 *     change it, they can leave it blank, and nothing verifies it.
 *   · FIELD AND SITE ATTENDANCE STAYS INGEST-ONLY, through `attendance_source`
 *     in `@/data/adapters`, exactly as FR-089 requires. There is no check-in
 *     button for a scaffolder at Bonny Terminal, and this module never writes
 *     one. Site presence in the day view below is DERIVED from the rotation
 *     calendar, not declared.
 *
 * This paragraph exists so the next reader does not conclude the boundary was
 * crossed by accident and "fix" it in either direction.
 *
 * ── BINDING INVARIANTS ─────────────────────────────────────────────────────
 *
 * P1. ANTI-SURVEILLANCE. A check-in records: who, date, mode, an optional short
 *     note, an optional focus for the day. That is the entire record — read the
 *     `CheckIn` type, there is nothing else on it. See NEVER_COLLECTED for what
 *     the product refuses to collect, which is meant to render on the page.
 *
 * P2. NOTHING IS VERIFIED. A check-in is not reconciled against a door badge, a
 *     VPN session, a calendar or a login. Verification would convert a statement
 *     into a claim that can be found false, and the moment that is possible the
 *     honest answer stops being the easy one.
 *
 * P3. AWAY CARRIES A CATEGORY, NEVER A CAUSE. The whole vocabulary is five
 *     words long: "On leave", "Off rotation", "Off today", "Public holiday",
 *     "Not checked in". Never a leave TYPE (annual,
 *     compassionate, study), never a medical reason, never a note the person
 *     wrote to HR. The leave record upstream knows the type; `awayReasonFor()`
 *     reads only that a leave EXISTS and discards the rest at this boundary.
 *
 * P4. "NOT CHECKED IN" IS NOT "ABSENT", AND "OFF ROTATION" IS NOT "ABSENT".
 *     Someone 24 days into their off-tour on a 28/28 is exactly where the
 *     rotation calendar put them. A view that renders them red has misunderstood
 *     offshore work. Nothing in this module ever emits the word "absent".
 *
 * P5. PATTERNS ARE FOR THE PERSON, NOT THE MANAGER. `MY_PATTERN` is what an
 *     individual sees about their own history. `TEAM_SIGNALS` is what a manager
 *     sees about the team, and it is deliberately team-level: no per-person
 *     office-day count, no ranking, no streak table, no "days in" leaderboard.
 *     See MANAGER_NOT_SHOWN for the list and the reason.
 *
 * P6. EVERY MANAGER READ IS LOGGED and the UI says so — PRESENCE_ACCESS_LOG.
 *
 * P7. Protected and NCDMB attributes (nationality, hostCommunity) do not appear
 *     here and are not a way to cut this data.
 *
 * Deterministic: no Date.now(), no Math.random(). Reference day is Fri Aug 28,
 * 2026; the window is the ten working days Mon Aug 17 → Fri Aug 28.
 */
import type { LeaveRequestRow } from "@/data/adapters";
import {
  ROTATIONS, ROTATION_ASSIGNMENTS, SITES, isSchedulable, onRotation, personById,
  type RotationAssignment,
} from "@/data/workforce";
import type { PfTone } from "@/components/os/ui";

export const PRESENCE_TODAY_ISO = "2026-08-28";
export const PRESENCE_TODAY = "Aug 28, 2026";

/* ==========================================================================
 * P1 — what this product refuses to collect
 * ========================================================================== */

/**
 * Written as data because it renders. A privacy promise buried in a policy PDF
 * is a promise nobody reads; a promise printed on the page next to the button
 * is one the product has to keep.
 */
export const NEVER_COLLECTED: string[] = [
  "GPS, geofence or any location coordinate — the mode you pick is the only location signal, and you write it yourself",
  "IP address or network location, including whether you are on the office wifi",
  "Idle time, active time, mouse movement or keystroke counts",
  "Screenshots, screen recording or webcam capture",
  "Application, document or website usage",
  "Login, VPN or door-badge times used to check a check-in against reality (P2)",
  "The contents of your calendar — the optional focus line is yours to write, not scraped",
  "Hours worked, start time or end time. This is not a timesheet and cannot become one",
];

export const PRESENCE_PROMISE = {
  headline: "A status, not a sensor",
  body:
    "Checking in tells your team where to find you today. It is written by you, it is never checked against anything, and you can leave it blank. Nothing here measures how long you worked or how hard.",
  blank:
    "Not checking in is a valid state. It shows as \"Not checked in\", which means exactly that and nothing more — it is not an absence, it is not counted against you anywhere, and no one is notified.",
} as const;

/* ==========================================================================
 * eligibility — who declares, and who is derived
 * ========================================================================== */

export type PresenceSource = "check-in" | "rotation";

export type EligibilityRule = {
  population: string;
  source: PresenceSource;
  why: string;
};

export const CHECKIN_ELIGIBILITY: EligibilityRule[] = [
  {
    population: "Remote and knowledge workers — Lagos, Abuja and head-office roles",
    source: "check-in",
    why: "Their day genuinely varies and their colleagues genuinely need to know. Self-declared, unverified, optional (FR-098).",
  },
  {
    population: "Field, site and rotation workers — Bonga FPSO, Bonny Terminal, Port Harcourt Base",
    source: "rotation",
    why: "Presence is already known from the rotation calendar and the attendance_source ingest. Asking a scaffolder to declare his location on a platform he is standing on would be surveillance dressed as a feature. There is no check-in button for these roles and this module never writes one (FR-089 holds).",
  },
];

export const eligibilityFor = (workerId: string): PresenceSource =>
  ROTATION_ASSIGNMENTS.some((a) => a.workerId === workerId) ? "rotation" : "check-in";

/* ==========================================================================
 * the check-in record — P1: this type IS the privacy policy
 * ========================================================================== */

export type CheckInMode = "office" | "home" | "client-site" | "field" | "travelling" | "off";

export type ModeMeta = { key: CheckInMode; label: string; short: string; icon: string; tone: PfTone; counts: boolean };

/** `counts: false` — "off" is a valid answer and is not presence. */
export const MODES: ModeMeta[] = [
  { key: "office", label: "In the office", short: "Office", icon: "house", tone: "green", counts: true },
  { key: "home", label: "Working from home", short: "Home", icon: "door", tone: "blue", counts: true },
  { key: "client-site", label: "At a client site", short: "Client", icon: "users", tone: "purple", counts: true },
  { key: "field", label: "On site / in the field", short: "Field", icon: "orbit", tone: "yellow", counts: true },
  { key: "travelling", label: "Travelling", short: "Travelling", icon: "paperplane", tone: "purple", counts: true },
  { key: "off", label: "Not working today", short: "Off", icon: "pause", tone: "grey", counts: false },
];

export const modeMeta = (m: CheckInMode): ModeMeta => MODES.find((x) => x.key === m)!;

/**
 * THE WHOLE RECORD (P1). Five fields plus an id. If a future requirement wants
 * to add a sixth, it is adding surveillance to something that currently is not,
 * and that is a product decision, not a schema change.
 */
export type CheckIn = {
  id: string;
  workerId: string;
  /** Machine date. */
  iso: string;
  /** Display date in the app's style. */
  date: string;
  mode: CheckInMode;
  /** Optional, short, written by the person. */
  note?: string;
  /** Optional. One line on what they are on today — a courtesy to the team. */
  focus?: string;
};

/* ==========================================================================
 * the window — ten working days
 * ========================================================================== */

export type WorkingDay = { iso: string; date: string; weekday: string; isToday: boolean };

/** Mon Aug 17 → Fri Aug 28, 2026. Weekends omitted, not zeroed. */
export const WORKING_DAYS: WorkingDay[] = [
  { iso: "2026-08-17", date: "Aug 17", weekday: "Mon", isToday: false },
  { iso: "2026-08-18", date: "Aug 18", weekday: "Tue", isToday: false },
  { iso: "2026-08-19", date: "Aug 19", weekday: "Wed", isToday: false },
  { iso: "2026-08-20", date: "Aug 20", weekday: "Thu", isToday: false },
  { iso: "2026-08-21", date: "Aug 21", weekday: "Fri", isToday: false },
  { iso: "2026-08-24", date: "Aug 24", weekday: "Mon", isToday: false },
  { iso: "2026-08-25", date: "Aug 25", weekday: "Tue", isToday: false },
  { iso: "2026-08-26", date: "Aug 26", weekday: "Wed", isToday: false },
  { iso: "2026-08-27", date: "Aug 27", weekday: "Thu", isToday: false },
  { iso: "2026-08-28", date: "Aug 28", weekday: "Fri", isToday: true },
];

export const workingDay = (iso: string): WorkingDay | undefined => WORKING_DAYS.find((d) => d.iso === iso);

/* ==========================================================================
 * the roster — 8 people, two presence sources
 * ========================================================================== */

export type RosterMember = {
  workerId: string;
  name: string;
  init: string;
  tone: string;
  role: string;
  dept: string;
  loc: string;
  source: PresenceSource;
  /** Rotation members only — which pattern they are on. */
  rotationId?: string;
};

/**
 * Five knowledge workers who declare, three site workers who are derived. The
 * mix is the point: a Nigerian energy employer's "team view" that only works
 * for people with laptops has solved the easy half.
 */
export const ROSTER: RosterMember[] = [
  { workerId: "E-0214", name: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer", dept: "Engineering", loc: "Lagos", source: "check-in" },
  { workerId: "E-0243", name: "Chidi Okeke", init: "CO", tone: "#E81E17", role: "Backend Engineer", dept: "Engineering", loc: "Lagos", source: "check-in" },
  { workerId: "E-0198", name: "Adaeze Okafor", init: "AD", tone: "#16B364", role: "Senior Product Designer", dept: "Product & Design", loc: "Lagos", source: "check-in" },
  { workerId: "E-0187", name: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Finance Analyst", dept: "Finance", loc: "Lagos", source: "check-in" },
  { workerId: "E-0165", name: "Zainab Yusuf", init: "ZY", tone: "#EBA308", role: "Growth Marketing Manager", dept: "Commercial", loc: "Abuja", source: "check-in" },
  { workerId: "E-0129", name: "Halima Sule", init: "HS", tone: "#AF52DE", role: "HSE Coordinator", dept: "HSE & Compliance", loc: "Port Harcourt", source: "rotation", rotationId: "R-5" },
  { workerId: "E-0231", name: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead", dept: "Field Operations", loc: "Port Harcourt", source: "rotation", rotationId: "R-14" },
  { workerId: "E-0250", name: "Seyi Ajayi", init: "SA", tone: "#16B364", role: "Contract Rig Technician", dept: "Drilling Support", loc: "Port Harcourt", source: "rotation", rotationId: "R-28" },
];

export const rosterMember = (workerId: string): RosterMember | undefined => ROSTER.find((r) => r.workerId === workerId);

/* ==========================================================================
 * the check-ins — 47 records across 5 people and 10 working days
 * ========================================================================== */

export const CHECK_INS: CheckIn[] = [
  /* ── E-0214 · Amara Okonkwo · 9 of 10 days. Today is deliberately open. ─── */
  { id: "CI-101", workerId: "E-0214", iso: "2026-08-17", date: "Aug 17", mode: "home", focus: "Payments incident writeup" },
  { id: "CI-102", workerId: "E-0214", iso: "2026-08-18", date: "Aug 18", mode: "office", note: "Squad anchor day", focus: "Design-system migration plan" },
  { id: "CI-103", workerId: "E-0214", iso: "2026-08-19", date: "Aug 19", mode: "home" },
  { id: "CI-104", workerId: "E-0214", iso: "2026-08-20", date: "Aug 20", mode: "home", focus: "Payments reliability — p95 latency" },
  { id: "CI-105", workerId: "E-0214", iso: "2026-08-21", date: "Aug 21", mode: "home" },
  { id: "CI-106", workerId: "E-0214", iso: "2026-08-24", date: "Aug 24", mode: "home", focus: "Release prep" },
  { id: "CI-107", workerId: "E-0214", iso: "2026-08-25", date: "Aug 25", mode: "home", note: "Missing the anchor day — release window" },
  { id: "CI-108", workerId: "E-0214", iso: "2026-08-26", date: "Aug 26", mode: "home" },
  { id: "CI-109", workerId: "E-0214", iso: "2026-08-27", date: "Aug 27", mode: "office", note: "1-on-1 with Ngozi", focus: "Staff-track growth plan" },
  /* Aug 28: no record. She has not checked in yet — this is the live take-flow,
     and it renders as "Not checked in", which is a fact and not a judgement. */

  /* ── E-0243 · Chidi Okeke · month 1, office-heavy while he settles. ─────── */
  { id: "CI-201", workerId: "E-0243", iso: "2026-08-17", date: "Aug 17", mode: "office", focus: "Onboarding — 60-day plan" },
  { id: "CI-202", workerId: "E-0243", iso: "2026-08-18", date: "Aug 18", mode: "office", note: "Pairing with Amara" },
  { id: "CI-203", workerId: "E-0243", iso: "2026-08-19", date: "Aug 19", mode: "home" },
  { id: "CI-204", workerId: "E-0243", iso: "2026-08-20", date: "Aug 20", mode: "office" },
  { id: "CI-205", workerId: "E-0243", iso: "2026-08-21", date: "Aug 21", mode: "home" },
  { id: "CI-206", workerId: "E-0243", iso: "2026-08-24", date: "Aug 24", mode: "office" },
  { id: "CI-207", workerId: "E-0243", iso: "2026-08-25", date: "Aug 25", mode: "office", focus: "Payment retries — runbook" },
  { id: "CI-208", workerId: "E-0243", iso: "2026-08-26", date: "Aug 26", mode: "home" },
  { id: "CI-209", workerId: "E-0243", iso: "2026-08-27", date: "Aug 27", mode: "office" },
  { id: "CI-210", workerId: "E-0243", iso: "2026-08-28", date: "Aug 28", mode: "office", note: "VPN still down at home — in the office to reach internal services" },

  /* ── E-0198 · Adaeze Okafor · 8 days. Aug 27–28 are approved leave. ─────── */
  { id: "CI-301", workerId: "E-0198", iso: "2026-08-17", date: "Aug 17", mode: "office" },
  { id: "CI-302", workerId: "E-0198", iso: "2026-08-18", date: "Aug 18", mode: "office", note: "Product anchor day" },
  { id: "CI-303", workerId: "E-0198", iso: "2026-08-19", date: "Aug 19", mode: "home" },
  { id: "CI-304", workerId: "E-0198", iso: "2026-08-20", date: "Aug 20", mode: "office" },
  { id: "CI-305", workerId: "E-0198", iso: "2026-08-21", date: "Aug 21", mode: "home" },
  { id: "CI-306", workerId: "E-0198", iso: "2026-08-24", date: "Aug 24", mode: "home", focus: "Review-cycle experience — handover notes" },
  { id: "CI-307", workerId: "E-0198", iso: "2026-08-25", date: "Aug 25", mode: "office" },
  { id: "CI-308", workerId: "E-0198", iso: "2026-08-26", date: "Aug 26", mode: "home", note: "Off from tomorrow — handover done" },

  /* ── E-0187 · Ngozi Obi · steady Tue/Thu in the office. ────────────────── */
  { id: "CI-401", workerId: "E-0187", iso: "2026-08-17", date: "Aug 17", mode: "home" },
  { id: "CI-402", workerId: "E-0187", iso: "2026-08-18", date: "Aug 18", mode: "office" },
  { id: "CI-403", workerId: "E-0187", iso: "2026-08-19", date: "Aug 19", mode: "home" },
  { id: "CI-404", workerId: "E-0187", iso: "2026-08-20", date: "Aug 20", mode: "office", focus: "Month-end close" },
  { id: "CI-405", workerId: "E-0187", iso: "2026-08-21", date: "Aug 21", mode: "home" },
  { id: "CI-406", workerId: "E-0187", iso: "2026-08-24", date: "Aug 24", mode: "home" },
  { id: "CI-407", workerId: "E-0187", iso: "2026-08-25", date: "Aug 25", mode: "office", focus: "Expense batch export" },
  { id: "CI-408", workerId: "E-0187", iso: "2026-08-26", date: "Aug 26", mode: "home" },
  { id: "CI-409", workerId: "E-0187", iso: "2026-08-27", date: "Aug 27", mode: "office" },
  { id: "CI-410", workerId: "E-0187", iso: "2026-08-28", date: "Aug 28", mode: "home" },

  /* ── E-0165 · Zainab Yusuf · Abuja remote-first, on-site week Aug 25–27. ── */
  { id: "CI-501", workerId: "E-0165", iso: "2026-08-17", date: "Aug 17", mode: "home" },
  { id: "CI-502", workerId: "E-0165", iso: "2026-08-18", date: "Aug 18", mode: "home" },
  { id: "CI-503", workerId: "E-0165", iso: "2026-08-19", date: "Aug 19", mode: "client-site", note: "Abuja — distributor visit" },
  { id: "CI-504", workerId: "E-0165", iso: "2026-08-20", date: "Aug 20", mode: "home" },
  { id: "CI-505", workerId: "E-0165", iso: "2026-08-21", date: "Aug 21", mode: "home" },
  { id: "CI-506", workerId: "E-0165", iso: "2026-08-24", date: "Aug 24", mode: "travelling", note: "Abuja → Lagos for the quarterly on-site week" },
  { id: "CI-507", workerId: "E-0165", iso: "2026-08-25", date: "Aug 25", mode: "office", focus: "Quarterly on-site week" },
  { id: "CI-508", workerId: "E-0165", iso: "2026-08-26", date: "Aug 26", mode: "office" },
  { id: "CI-509", workerId: "E-0165", iso: "2026-08-27", date: "Aug 27", mode: "office" },
  { id: "CI-510", workerId: "E-0165", iso: "2026-08-28", date: "Aug 28", mode: "home", note: "Back in Abuja" },
];

export const checkInsFor = (workerId: string): CheckIn[] =>
  CHECK_INS.filter((c) => c.workerId === workerId).sort((a, b) => a.iso.localeCompare(b.iso));

export const checkInOn = (workerId: string, iso: string): CheckIn | undefined =>
  CHECK_INS.find((c) => c.workerId === workerId && c.iso === iso);

/* ==========================================================================
 * the leave join — P3
 * ========================================================================== */

/**
 * Approved leave overlapping the window, typed against the existing
 * `payroll_connector` contract so there is one leave shape in the app rather
 * than a second one invented here. It sits alongside adapters.ts's own
 * SEED_LEAVE_REQUESTS (LV-221, LV-208) — it does not replace or duplicate them.
 *
 * `kind` is present on the row because the leave record genuinely has one.
 * It is discarded at this boundary and never reaches the day view (P3).
 */
export const PRESENCE_LEAVE: LeaveRequestRow[] = [
  { id: "LV-233", workerId: "E-0198", kind: "Annual leave", from: "Aug 27", to: "Aug 28", days: 2, state: "Approved", approver: "Tobi Balogun" },
];

const LEAVE_WINDOWS: { requestId: string; workerId: string; fromIso: string; toIso: string }[] = [
  { requestId: "LV-233", workerId: "E-0198", fromIso: "2026-08-27", toIso: "2026-08-28" },
];

/** True/false only. The caller learns that leave exists and nothing about it. */
export const onLeave = (workerId: string, iso: string): boolean =>
  LEAVE_WINDOWS.some((w) => w.workerId === workerId && iso >= w.fromIso && iso <= w.toIso);

/* ==========================================================================
 * the rotation join — FR-090
 * ========================================================================== */

export type RotationState = {
  assignment: RotationAssignment;
  rotationName: string;
  siteName: string;
  on: boolean;
  /** Present when off tour: "back on tour in 24d". Never framed as absence (P4). */
  nextWindow?: string;
};

export const rotationStateFor = (workerId: string): RotationState | undefined => {
  const a = ROTATION_ASSIGNMENTS.find((x) => x.workerId === workerId);
  if (!a) return undefined;
  const r = ROTATIONS.find((x) => x.id === a.rotationId);
  if (!r) return undefined;
  const site = SITES.find((s) => s.id === r.siteId);
  const sched = isSchedulable(workerId);
  return {
    assignment: a,
    rotationName: r.name,
    siteName: site?.name ?? r.siteId,
    on: onRotation(a),
    nextWindow: sched.ok ? undefined : sched.nextWindow,
  };
};

/* ==========================================================================
 * the day view
 * ========================================================================== */

export type AwayReason = "On leave" | "Off rotation" | "Off today" | "Public holiday" | "Not checked in";

export const AWAY_TONE: Record<AwayReason, PfTone> = {
  "On leave": "blue",
  "Off rotation": "purple",
  /** Declared: "I am not working today". The person said so; the product does not ask why. */
  "Off today": "grey",
  "Public holiday": "grey",
  "Not checked in": "grey",
};

/**
 * P3 ENFORCED IN ONE FUNCTION. Every away reason in the product comes from here.
 * Note what it returns: a member of a four-value union. It cannot return a leave
 * type because a leave type is not in the union, and it cannot leak a medical
 * reason because it never reads one.
 */
export const awayReasonFor = (workerId: string, iso: string): AwayReason | null => {
  if (onLeave(workerId, iso)) return "On leave";
  const rot = rotationStateFor(workerId);
  if (rot) return rot.on ? null : "Off rotation";
  const ci = checkInOn(workerId, iso);
  if (!ci) return "Not checked in";
  return ci.mode === "off" ? "Off today" : null;
};

export type DayEntry = {
  workerId: string;
  name: string;
  init: string;
  tone: string;
  role: string;
  dept: string;
  loc: string;
  source: PresenceSource;
  status: "in" | "away";
  /** Check-in rows only. */
  mode?: CheckInMode;
  note?: string;
  focus?: string;
  /** Rotation rows only — where they actually are. */
  site?: string;
  rotationName?: string;
  awayReason?: AwayReason;
  /** Category-safe detail: "back on tour in 24d". Never a cause (P3). */
  awayDetail?: string;
};

export type TeamDay = {
  iso: string;
  date: string;
  weekday: string;
  entries: DayEntry[];
  in: DayEntry[];
  away: DayEntry[];
};

export const dayView = (iso: string): TeamDay => {
  const wd = workingDay(iso);
  const entries: DayEntry[] = ROSTER.map((m) => {
    const base = {
      workerId: m.workerId, name: m.name, init: m.init, tone: m.tone,
      role: m.role, dept: m.dept, loc: m.loc, source: m.source,
    };
    if (m.source === "rotation") {
      const rot = rotationStateFor(m.workerId);
      if (rot && !rot.on) {
        return { ...base, status: "away" as const, awayReason: "Off rotation" as AwayReason, awayDetail: rot.nextWindow, rotationName: rot.rotationName, site: rot.siteName };
      }
      /** No `mode`: a rotation row is derived, never declared. There is no
       *  check-in behind it and the view must not imply there was one. */
      return { ...base, status: "in" as const, site: rot?.siteName, rotationName: rot?.rotationName };
    }
    const reason = awayReasonFor(m.workerId, iso);
    const ci = checkInOn(m.workerId, iso);
    if (reason) return { ...base, status: "away" as const, awayReason: reason, note: ci?.note };
    return { ...base, status: "in" as const, mode: ci!.mode, note: ci!.note, focus: ci!.focus };
  });
  return {
    iso,
    date: wd?.date ?? iso,
    weekday: wd?.weekday ?? "",
    entries,
    in: entries.filter((e) => e.status === "in"),
    away: entries.filter((e) => e.status === "away"),
  };
};

/** Today's board — the surface FR-085 promised. */
export const TEAM_TODAY: TeamDay = dayView(PRESENCE_TODAY_ISO);

export const whoIsIn = (iso: string = PRESENCE_TODAY_ISO): DayEntry[] => dayView(iso).in;
export const whoIsAway = (iso: string = PRESENCE_TODAY_ISO): DayEntry[] => dayView(iso).away;

/** Where the in-people are today, for the header count. */
export const todaySplit = () => {
  const t = TEAM_TODAY;
  const byMode = MODES.map((m) => ({ mode: m, n: t.in.filter((e) => e.mode === m.key).length })).filter((r) => r.n > 0);
  const byReason = (Object.keys(AWAY_TONE) as AwayReason[])
    .map((r) => ({ reason: r, n: t.away.filter((e) => e.awayReason === r).length }))
    .filter((r) => r.n > 0);
  return {
    total: t.entries.length,
    inCount: t.in.length,
    awayCount: t.away.length,
    /** Declared modes only — rotation rows have no mode by design. */
    byMode,
    onSite: t.in.filter((e) => e.source === "rotation").length,
    byReason,
  };
};

/* ==========================================================================
 * P5 — the person's view of themselves
 * ========================================================================== */

export type MyPattern = {
  workerId: string;
  window: string;
  days: number;
  recorded: number;
  missed: number;
  byMode: { mode: ModeMeta; n: number }[];
  officeDays: number;
  longestStreak: { mode: CheckInMode; n: number };
  observation: string;
  visibility: string;
};

const streakOf = (rows: CheckIn[]): { mode: CheckInMode; n: number } => {
  let best: { mode: CheckInMode; n: number } = { mode: "home", n: 0 };
  let cur: { mode: CheckInMode; n: number } = { mode: "home", n: 0 };
  for (const r of rows) {
    cur = r.mode === cur.mode ? { mode: cur.mode, n: cur.n + 1 } : { mode: r.mode, n: 1 };
    if (cur.n > best.n) best = { ...cur };
  }
  return best;
};

/**
 * What Amara sees about her own pattern. Note the last field: the visibility
 * line is part of the data, so a screen cannot render the pattern without also
 * rendering who can see it.
 */
export const MY_PATTERN: MyPattern = (() => {
  const rows = checkInsFor("E-0214");
  const byMode = MODES.map((m) => ({ mode: m, n: rows.filter((r) => r.mode === m.key).length })).filter((r) => r.n > 0);
  return {
    workerId: "E-0214",
    window: "Aug 17 – Aug 28, 2026",
    days: WORKING_DAYS.length,
    recorded: rows.length,
    missed: WORKING_DAYS.length - rows.length,
    byMode,
    officeDays: rows.filter((r) => r.mode === "office").length,
    longestStreak: streakOf(rows),
    observation:
      "Your squad's anchor day is Tuesday and you have made 1 of the last 2. The other office day you took was a Thursday, for your 1-on-1. Nobody is counting this but you — it is here because you might want it before you decide about next week.",
    visibility:
      "Only you see this. Your manager sees today's board and a team-level summary; there is no per-person office-day count anywhere in the product (P5).",
  };
})();

export const MY_TODAY = checkInOn("E-0214", PRESENCE_TODAY_ISO);

/** Drives the primary action on the page. */
export const MY_TODAY_PENDING = MY_TODAY === undefined;

export const MY_PROMPT = {
  headline: "Where are you working today?",
  body: "One tap. You can change it, and you can skip it — skipping shows as \"Not checked in\", which is a fact about a form and not a fact about you.",
  optional: true,
} as const;

/* ==========================================================================
 * P5 — the manager's view of the team, and what it deliberately omits
 * ========================================================================== */

export type TeamSignal = { label: string; value: string; tone: PfTone; basis: string };

/**
 * TEAM-LEVEL ONLY. Every figure here is about the group. There is no row that
 * names a person and a count in the same breath, because the moment such a row
 * exists a manager reads it as a ranking whatever the label says.
 */
export const TEAM_SIGNALS: TeamSignal[] = [
  {
    label: "In today", value: `${TEAM_TODAY.in.length} of ${TEAM_TODAY.entries.length}`, tone: "green",
    basis: "3 self-declared check-ins and 2 on-tour rotation positions, on Fri Aug 28.",
  },
  {
    label: "Team office days per week", value: "2.0 avg", tone: "blue",
    basis: "20 office days across the 5 desk-based colleagues over 2 weeks. A team figure, never a per-person one. The handbook expectation for Lagos is 3 days a week and squad leads set which days, not HR — so this is a conversation to have with the squad, not a number to hold over anyone.",
  },
  {
    label: "Check-in participation", value: "98%", tone: "green",
    basis: "47 records against 48 eligible person-days (50, less 2 approved-leave days). Participation is a health signal for the TOOL, not a compliance measure for the people — a low number means the check-in is not worth their time, and the fix is the tool.",
  },
  {
    label: "On rotation", value: "2 of 3 site colleagues", tone: "purple",
    basis: "Read from the FR-090 rotation calendar. The third is 24 days into an off-tour on a 28/28 and is exactly where the calendar put him.",
  },
];

/**
 * The list that keeps this feature honest. It renders on the manager view, above
 * the board — a manager should be told what they are not being given, and why,
 * rather than wondering whether it is hidden or simply not built.
 */
export const MANAGER_NOT_SHOWN: { item: string; why: string }[] = [
  {
    item: "A per-person count of office days",
    why: "It becomes a league table within a week, whatever the column is called. The people at the bottom of it would be the ones with the longest commute, the youngest children or the least reliable power supply at home — none of which is performance, and all of which would start being managed as if it were.",
  },
  {
    item: "Streaks, participation rates or check-in reliability per person",
    why: "The same objection. A person's own streak is theirs to see (MY_PATTERN); the same number in a manager's hands is a performance metric nobody agreed to.",
  },
  {
    item: "Any reason behind an away status beyond the category",
    why: "P3. \"On leave\" is the whole answer. The leave type, and certainly a medical circumstance, is between the person and HR.",
  },
  {
    item: "Hours, start time, end time or anything derived from them",
    why: "This is not a timesheet, it holds no times, and there is nothing in the record to derive them from (P1).",
  },
  {
    item: "History further back than the current window without a stated purpose",
    why: "A rolling two-week board answers \"where is everyone\". A twelve-month archive answers a different question, and nobody has asked it.",
  },
];

/* ==========================================================================
 * feeding the rotation calendar — the FR-085 promise, delivered
 * ========================================================================== */

/**
 * FR-085 promised a "who's in / who's away" view and shipped a leave balance.
 * This is the missing half, and the reason it belongs next to FR-090: a
 * scheduler that reads only check-ins will book a review into an off-tour
 * window, and a scheduler that reads only rotations will book one into
 * somebody's approved leave. `schedulableToday()` reads both.
 */
export const schedulableToday = (workerId: string): { ok: boolean; why?: string; nextWindow?: string } => {
  if (onLeave(workerId, PRESENCE_TODAY_ISO)) return { ok: false, why: "On leave", nextWindow: "back after Aug 28" };
  const rot = isSchedulable(workerId);
  if (!rot.ok) return rot;
  return { ok: true };
};

export const ROTATION_FEED_NOTE =
  "Off rotation is not away, and not checked in is not absent (P4). A 28/28 off-tour is the calendar working, and someone who did not fill in a form is someone who did not fill in a form. Anything that schedules a review, a 1-on-1 or an interview reads both sources before it proposes a time.";

/* ==========================================================================
 * P6 — access logging
 * ========================================================================== */

export type PresenceAccess = { at: string; who: string; action: string; scope: string };

export const PRESENCE_ACCESS_LOG: PresenceAccess[] = [
  { at: "Aug 28 · 08:05", who: "Engineering · Ngozi Adeyemi", action: "viewed today's team board", scope: "8 people · today only" },
  { at: "Aug 28 · 08:06", who: "Engineering · Ngozi Adeyemi", action: "viewed team-level summary", scope: "10 working days · aggregate, no per-person counts" },
  { at: "Aug 27 · 16:40", who: "Field Operations · Ibrahim Sani", action: "viewed rotation positions", scope: "3 site colleagues · FR-090 calendar" },
  { at: "Aug 26 · 09:12", who: "You · Amara Okonkwo", action: "viewed your own pattern", scope: "your records only" },
];

export const PRESENCE_ACCESS_NOTE =
  "Every read of this board is logged, including your manager's and your own. The log records what was opened and at what scope — it does not record what anyone was looking for.";

/**
 * A build check with the same job as the audits in engage.ts and rewards.ts:
 * prove the seed obeys the invariant rather than asserting it in a comment.
 * `clean: false` means a site or field worker has a self-declared check-in,
 * which would mean FR-089 was crossed in the data.
 */
export const PRESENCE_AUDIT = (): { checkIns: number; rotationMembers: number; violations: string[]; clean: boolean } => {
  const violations = CHECK_INS
    .filter((c) => ROTATION_ASSIGNMENTS.some((a) => a.workerId === c.workerId))
    .map((c) => `${c.id}: ${c.workerId} is a rotation worker and must not hold a self-declared check-in`);
  const orphans = CHECK_INS.filter((c) => !personById(c.workerId)).map((c) => `${c.id}: unknown worker ${c.workerId}`);
  return {
    checkIns: CHECK_INS.length,
    rotationMembers: ROSTER.filter((r) => r.source === "rotation").length,
    violations: [...violations, ...orphans],
    clean: violations.length + orphans.length === 0,
  };
};
