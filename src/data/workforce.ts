/**
 * workforce.ts — PRD v2.1 Wave 0/2 workforce spine (FR-082, FR-083, FR-090).
 *
 * The v2.0 person record assumed "employee". That breaks on first contact with
 * an oil & gas workforce, where contractors and agency staff dominate site
 * headcount and NCDMB local-content reporting is a statutory fact. This module
 * adds the worker-type spine, the certifications/medicals registry and the
 * site/rotation model — the three things every other v2.1 requirement hangs off.
 *
 * DOCTRINE (v2.1 §2.2) — reads, not engines. Nothing here accrues leave, computes
 * pay or schedules a rotation; it records what the rotation IS so scheduling can
 * avoid it.
 *
 * NCDMB attributes (`nationality`, `hostCommunity`) are REPORTING FIELDS and are
 * never model inputs — the same rule the platform already applies to protected
 * attributes. `analytics` carries the per-module include/exclude flags so a
 * contractor lands in site headcount but not in an attrition benchmark.
 */
import { EMPLOYEES, type Employee } from "@/data/talentos";

/* ------------------------------- FR-082 ------------------------------------ */

export type WorkerType = "employee" | "contractor" | "agency" | "nysc" | "alumni";

export const WORKER_TYPE_LABEL: Record<WorkerType, string> = {
  employee: "Employee",
  contractor: "Contractor",
  agency: "Agency staff",
  nysc: "NYSC / Intern",
  alumni: "Alumni",
};

/** Each worker type has its OWN lifecycle states — this is the point of FR-082. */
export const WORKER_LIFECYCLE: Record<WorkerType, string[]> = {
  employee: ["Pre-boarding", "Probation", "Confirmed", "Notice", "Exited"],
  contractor: ["Mobilising", "On contract", "Demobilising", "Off contract"],
  agency: ["Requested", "Deployed", "Rotated off", "Released"],
  nysc: ["Posted", "Serving", "PPA complete", "Passed out"],
  alumni: ["Exited", "Boomerang-eligible", "Re-hired"],
};

export type ContractingCompany = { id: string; name: string; kind: "Agency" | "Service company"; ncdmbRegistered: boolean; workers: number };

export const CONTRACTING_COMPANIES: ContractingCompany[] = [
  { id: "CC-01", name: "PrimeStaff Nigeria", kind: "Agency", ncdmbRegistered: true, workers: 34 },
  { id: "CC-02", name: "RigWorks Ltd", kind: "Service company", ncdmbRegistered: true, workers: 21 },
  { id: "CC-03", name: "Delta Marine Services", kind: "Service company", ncdmbRegistered: false, workers: 12 },
];

/**
 * The worker-type overlay on the existing person spine. Held as a side table
 * keyed by employee id rather than widened onto `Employee`, so the 16 existing
 * consumers of EMPLOYEES keep compiling untouched and adopt it where they need it.
 */
export type WorkerRecord = {
  id: string;
  workerType: WorkerType;
  state: string;
  /** Non-employees only — who actually employs them. */
  contractingCompanyId?: string;
  /** NCDMB local-content REPORTING fields. Never model inputs. */
  nationality: "Nigerian" | "Expatriate";
  hostCommunity?: string;
  /** Per-module analytics participation (FR-082 include/exclude flags). */
  analytics: { headcount: boolean; attrition: boolean; engagement: boolean; qoh: boolean };
};

const STAFF = { headcount: true, attrition: true, engagement: true, qoh: true };
/** Contractors count in site headcount but must not skew attrition/QoH benchmarks. */
const NON_STAFF = { headcount: true, attrition: false, engagement: false, qoh: false };

export const WORKERS: WorkerRecord[] = [
  { id: "E-0214", workerType: "employee", state: "Confirmed", nationality: "Nigerian", analytics: STAFF },
  { id: "E-0198", workerType: "employee", state: "Probation", nationality: "Nigerian", analytics: STAFF },
  { id: "E-0231", workerType: "employee", state: "Confirmed", nationality: "Nigerian", hostCommunity: "Ogoni", analytics: STAFF },
  { id: "E-0165", workerType: "employee", state: "Confirmed", nationality: "Nigerian", analytics: STAFF },
  { id: "E-0243", workerType: "employee", state: "Probation", nationality: "Nigerian", analytics: STAFF },
  { id: "E-0129", workerType: "employee", state: "Confirmed", nationality: "Nigerian", hostCommunity: "Ikwerre", analytics: STAFF },
  { id: "E-0250", workerType: "contractor", state: "On contract", contractingCompanyId: "CC-01", nationality: "Nigerian", hostCommunity: "Ikwerre", analytics: NON_STAFF },
  { id: "E-0187", workerType: "employee", state: "Confirmed", nationality: "Nigerian", analytics: STAFF },
  { id: "E-0092", workerType: "employee", state: "Notice", nationality: "Nigerian", analytics: STAFF },
  { id: "E-0011", workerType: "alumni", state: "Boomerang-eligible", nationality: "Nigerian", analytics: { headcount: false, attrition: false, engagement: false, qoh: false } },
  /** Site population beyond the v2.0 spine — the workforce that was invisible. */
  { id: "W-3301", workerType: "agency", state: "Deployed", contractingCompanyId: "CC-01", nationality: "Nigerian", hostCommunity: "Ogoni", analytics: NON_STAFF },
  { id: "W-3302", workerType: "agency", state: "Deployed", contractingCompanyId: "CC-02", nationality: "Nigerian", hostCommunity: "Ikwerre", analytics: NON_STAFF },
  { id: "W-3303", workerType: "contractor", state: "Mobilising", contractingCompanyId: "CC-02", nationality: "Expatriate", analytics: NON_STAFF },
  { id: "W-3304", workerType: "nysc", state: "Serving", nationality: "Nigerian", analytics: { headcount: true, attrition: false, engagement: true, qoh: false } },
  { id: "W-3305", workerType: "agency", state: "Deployed", contractingCompanyId: "CC-03", nationality: "Nigerian", hostCommunity: "Ogoni", analytics: NON_STAFF },
];

/** Site workers who are NOT on the v2.0 EMPLOYEES spine — FR-082's whole point. */
export type SiteWorker = { id: string; name: string; init: string; tone: string; role: string; dept: string; loc: string };

export const SITE_WORKERS: SiteWorker[] = [
  { id: "W-3301", name: "Ibrahim Danladi", init: "ID", tone: "#16B364", role: "Rig Floorhand", dept: "Drilling Support", loc: "Port Harcourt" },
  { id: "W-3302", name: "Grace Etim", init: "GE", tone: "#AF52DE", role: "Materials Controller", dept: "Field Operations", loc: "Port Harcourt" },
  { id: "W-3303", name: "Lars Pedersen", init: "LP", tone: "#EBA308", role: "Drilling Supervisor", dept: "Drilling Support", loc: "Bonga FPSO" },
  { id: "W-3304", name: "Chiamaka Nwosu", init: "CN", tone: "#16B364", role: "HSE Intern (NYSC)", dept: "HSE & Compliance", loc: "Port Harcourt" },
  { id: "W-3305", name: "Musa Bello", init: "MB", tone: "#475569", role: "Scaffolder", dept: "Field Operations", loc: "Bonny Terminal" },
];

export type AnyWorker = { id: string; name: string; init: string; tone: string; role: string; dept: string; loc: string };

/** One roster across both populations — what "one record, every worker" means. */
export const ALL_WORKERS: AnyWorker[] = [
  ...EMPLOYEES.map((e: Employee) => ({ id: e.id, name: e.name, init: e.init, tone: e.tone, role: e.role, dept: e.dept, loc: e.loc })),
  ...SITE_WORKERS,
];

export const workerById = (id: string) => WORKERS.find((w) => w.id === id);
export const personById = (id: string) => ALL_WORKERS.find((w) => w.id === id);
export const companyById = (id?: string) => CONTRACTING_COMPANIES.find((c) => c.id === id);

/** FR-082 ships when every dashboard can filter by worker type. */
export const countsByType = (): { type: WorkerType; n: number }[] =>
  (Object.keys(WORKER_TYPE_LABEL) as WorkerType[])
    .map((t) => ({ type: t, n: WORKERS.filter((w) => w.workerType === t).length }))
    .filter((r) => r.n > 0);

/** NCDMB local-content reporting — a statutory report, computed from reporting fields only. */
export const localContent = () => {
  const inScope = WORKERS.filter((w) => w.analytics.headcount);
  const nigerian = inScope.filter((w) => w.nationality === "Nigerian").length;
  const host = inScope.filter((w) => w.hostCommunity).length;
  return {
    total: inScope.length,
    nigerian,
    expatriate: inScope.length - nigerian,
    hostCommunity: host,
    nigerianPct: Math.round((nigerian / inScope.length) * 100),
    hostPct: Math.round((host / inScope.length) * 100),
  };
};

/* ------------------------------- FR-083 ------------------------------------ */

export type CertState = "valid" | "expiring" | "expired";

export type Certification = {
  id: string; workerId: string; name: string; issuer: string; number: string;
  expires: string; daysLeft: number; state: CertState;
};

export type MedicalClearance = {
  workerId: string; fitnessClass: "Fit — unrestricted" | "Fit — with restriction" | "Temporarily unfit";
  restriction?: string; nextDue: string; daysLeft: number; state: CertState;
};

export const CERTIFICATIONS: Certification[] = [
  { id: "CE-01", workerId: "E-0231", name: "NEBOSH IGC", issuer: "NEBOSH", number: "NB-448120", expires: "Sep 2026", daysLeft: 34, state: "expiring" },
  { id: "CE-02", workerId: "E-0231", name: "OPITO BOSIET", issuer: "OPITO", number: "OP-771244", expires: "Mar 2027", daysLeft: 216, state: "valid" },
  { id: "CE-03", workerId: "E-0129", name: "First Aid at Work", issuer: "Nigerian Red Cross", number: "RC-20981", expires: "Jul 2026", daysLeft: -22, state: "expired" },
  { id: "CE-04", workerId: "E-0129", name: "IOSH Managing Safely", issuer: "IOSH", number: "IO-33410", expires: "Nov 2026", daysLeft: 96, state: "valid" },
  { id: "CE-05", workerId: "E-0250", name: "OPITO BOSIET", issuer: "OPITO", number: "OP-880913", expires: "Sep 2026", daysLeft: 21, state: "expiring" },
  { id: "CE-06", workerId: "W-3301", name: "Rigger Level 2", issuer: "LEEA", number: "LE-11902", expires: "Dec 2026", daysLeft: 128, state: "valid" },
  { id: "CE-07", workerId: "W-3303", name: "IWCF Well Control", issuer: "IWCF", number: "IW-55231", expires: "Sep 2026", daysLeft: 7, state: "expiring" },
  { id: "CE-08", workerId: "W-3305", name: "Working at Height", issuer: "NEBOSH", number: "NB-449001", expires: "Jun 2026", daysLeft: -60, state: "expired" },
];

export const MEDICALS: MedicalClearance[] = [
  { workerId: "E-0231", fitnessClass: "Fit — unrestricted", nextDue: "Feb 2027", daysLeft: 180, state: "valid" },
  { workerId: "E-0129", fitnessClass: "Fit — with restriction", restriction: "No offshore rotation > 14 days", nextDue: "Oct 2026", daysLeft: 64, state: "valid" },
  { workerId: "E-0250", fitnessClass: "Fit — unrestricted", nextDue: "Sep 2026", daysLeft: 28, state: "expiring" },
  { workerId: "W-3301", fitnessClass: "Fit — unrestricted", nextDue: "Jan 2027", daysLeft: 150, state: "valid" },
  { workerId: "W-3303", fitnessClass: "Temporarily unfit", restriction: "Cleared to return after review", nextDue: "Sep 2026", daysLeft: 5, state: "expiring" },
  { workerId: "W-3305", fitnessClass: "Fit — unrestricted", nextDue: "Aug 2026", daysLeft: -3, state: "expired" },
];

/** FR-083 alert thresholds — the person, their manager and HR at 90/30/7 days. */
export const ALERT_DAYS = [90, 30, 7] as const;

export const alertTier = (daysLeft: number): 90 | 30 | 7 | null =>
  daysLeft < 0 ? 7 : daysLeft <= 7 ? 7 : daysLeft <= 30 ? 30 : daysLeft <= 90 ? 90 : null;

/**
 * Site-access readiness — the computed flag FR-083 puts on person and site views.
 * A worker is site-ready only with every certification valid AND a valid medical.
 * "Temporarily unfit" blocks regardless of dates: fitness class is not a date test.
 */
export type Readiness = { ready: boolean; reasons: string[] };

export const readinessFor = (workerId: string): Readiness => {
  const certs = CERTIFICATIONS.filter((c) => c.workerId === workerId);
  const med = MEDICALS.find((m) => m.workerId === workerId);
  const reasons: string[] = [];
  for (const c of certs) {
    if (c.state === "expired") reasons.push(`${c.name} expired`);
    else if (c.state === "expiring") reasons.push(`${c.name} expires in ${c.daysLeft}d`);
  }
  if (!med) reasons.push("No medical clearance on file");
  else {
    if (med.fitnessClass === "Temporarily unfit") reasons.push("Medical: temporarily unfit");
    if (med.state === "expired") reasons.push("Medical clearance expired");
    else if (med.state === "expiring") reasons.push(`Medical due in ${med.daysLeft}d`);
  }
  const blocking = reasons.some((r) => /expired|unfit|No medical/.test(r));
  return { ready: !blocking, reasons };
};

/** Everything lapsing inside the widest alert window, worst first — feeds the anomaly feed. */
export const lapsing = () =>
  [
    ...CERTIFICATIONS.filter((c) => alertTier(c.daysLeft) !== null).map((c) => ({ workerId: c.workerId, what: c.name, kind: "Certification" as const, daysLeft: c.daysLeft, state: c.state })),
    ...MEDICALS.filter((m) => alertTier(m.daysLeft) !== null).map((m) => ({ workerId: m.workerId, what: "Medical clearance", kind: "Medical" as const, daysLeft: m.daysLeft, state: m.state })),
  ].sort((a, b) => a.daysLeft - b.daysLeft);

/* ------------------------------- FR-090 ------------------------------------ */

export type Site = { id: string; name: string; kind: "Offshore" | "Onshore terminal" | "Office"; loc: string; muster: number };

export const SITES: Site[] = [
  { id: "S-01", name: "Bonga FPSO", kind: "Offshore", loc: "OML 118 · offshore Bayelsa", muster: 42 },
  { id: "S-02", name: "Bonny Terminal", kind: "Onshore terminal", loc: "Bonny Island, Rivers", muster: 61 },
  { id: "S-03", name: "Port Harcourt Base", kind: "Office", loc: "Trans-Amadi, Rivers", muster: 88 },
];

/** 28/28, 14/14 and custom patterns — the thing O&G actually lives by. */
export type RotationCalendar = { id: string; name: string; onDays: number; offDays: number; siteId: string; cycleStart: string };

export const ROTATIONS: RotationCalendar[] = [
  { id: "R-28", name: "28/28 offshore", onDays: 28, offDays: 28, siteId: "S-01", cycleStart: "2026-08-03" },
  { id: "R-14", name: "14/14 terminal", onDays: 14, offDays: 14, siteId: "S-02", cycleStart: "2026-08-17" },
  { id: "R-5", name: "5/2 base", onDays: 5, offDays: 2, siteId: "S-03", cycleStart: "2026-08-24" },
];

export type RotationAssignment = { workerId: string; rotationId: string; /** Days into the cycle on the reference date. */ dayInCycle: number };

/** Reference date matches the shell's 08/07/2026 topbar so "on rotation" is legible. */
export const ROTATION_REF = "2026-08-07";

export const ROTATION_ASSIGNMENTS: RotationAssignment[] = [
  { workerId: "W-3303", rotationId: "R-28", dayInCycle: 5 },
  { workerId: "W-3301", rotationId: "R-28", dayInCycle: 5 },
  { workerId: "E-0250", rotationId: "R-28", dayInCycle: 33 },
  { workerId: "W-3302", rotationId: "R-14", dayInCycle: 3 },
  { workerId: "W-3305", rotationId: "R-14", dayInCycle: 17 },
  { workerId: "E-0231", rotationId: "R-14", dayInCycle: 2 },
  { workerId: "E-0129", rotationId: "R-5", dayInCycle: 3 },
  { workerId: "W-3304", rotationId: "R-5", dayInCycle: 3 },
];

/** True when the worker is ON their on-tour window on the reference day. */
export const onRotation = (a: RotationAssignment): boolean => {
  const r = ROTATIONS.find((x) => x.id === a.rotationId);
  if (!r) return false;
  return ((a.dayInCycle - 1) % (r.onDays + r.offDays)) < r.onDays;
};

export const daysUntilOff = (a: RotationAssignment): number => {
  const r = ROTATIONS.find((x) => x.id === a.rotationId);
  if (!r) return 0;
  const d = (a.dayInCycle - 1) % (r.onDays + r.offDays);
  return d < r.onDays ? r.onDays - d : r.onDays + r.offDays - d;
};

/**
 * FR-090's acceptance test: scheduling anything — a review, a 1-on-1, an
 * interview, training — must land zero events in an off-rotation window.
 * Returns the next date the worker is reachable, so callers propose rather
 * than silently drop.
 */
export const isSchedulable = (workerId: string): { ok: boolean; why?: string; nextWindow?: string } => {
  const a = ROTATION_ASSIGNMENTS.find((x) => x.workerId === workerId);
  if (!a) return { ok: true };
  if (onRotation(a)) return { ok: true };
  const r = ROTATIONS.find((x) => x.id === a.rotationId)!;
  const d = (a.dayInCycle - 1) % (r.onDays + r.offDays);
  const back = r.onDays + r.offDays - d;
  return { ok: false, why: `Off rotation (${r.name})`, nextWindow: `back on tour in ${back}d` };
};

/** The site roster FR-090 ships: headcount, worker type and readiness in one view. */
export const rosterFor = (siteId: string) =>
  ROTATION_ASSIGNMENTS
    .filter((a) => ROTATIONS.find((r) => r.id === a.rotationId)?.siteId === siteId)
    .map((a) => {
      const p = personById(a.workerId);
      const w = workerById(a.workerId);
      return { assignment: a, person: p, worker: w, on: onRotation(a), readiness: readinessFor(a.workerId), offIn: daysUntilOff(a) };
    })
    .filter((r) => r.person && r.worker);
