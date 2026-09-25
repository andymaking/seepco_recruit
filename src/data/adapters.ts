/**
 * adapters.ts — PRD v2.1 §6 adapter contracts (FR-084, 085, 086, 089, 091).
 *
 * The release doctrine is adapter-first: every feature that touches an external
 * system is specified against a provider-abstracted contract with a CSV/manual
 * adapter that ships on day one, so no requirement waits on a partner's API.
 * The CSV adapter is a supported product surface, not a stopgap — most Nigerian
 * mid-market payroll still ends in a spreadsheet.
 *
 * Each contract is versioned and carries a reference implementation here. When a
 * partner API lands, a second adapter implements the SAME interface and the
 * feature switches over with no surface change — the FR-081 pattern.
 *
 * THE LINE THIS FILE DOES NOT CROSS (v2.1 §2.2): reads, not engines. Nothing
 * here computes pay, accrues leave, or lends money.
 */
import type { PfTone } from "@/components/os/ui";

export type AdapterState = "live" | "ready" | "awaiting-access";

export type AdapterInfo = {
  contract: string; version: string; provider: string; state: AdapterState;
  note: string;
};

/** §6: each contract, each with a reference CSV/mock implementation in the repo. */
export const ADAPTERS: AdapterInfo[] = [
  { contract: "payroll_connector", version: "v1", provider: "CSV / SFTP drop", state: "live", note: "Ships day one. Works with any payroll, including a spreadsheet." },
  { contract: "payroll_connector", version: "v1", provider: "Manual HR upload", state: "live", note: "The fallback that needs no counterparty at all." },
  { contract: "payroll_connector", version: "v1", provider: "SeamlessHR", state: "awaiting-access", note: "Built to the same contract; activates when API access lands." },
  { contract: "payroll_connector", version: "v1", provider: "PaidHR", state: "awaiting-access", note: "Parallel path — sequenced by what target tenants actually run." },
  { contract: "attendance_source", version: "v1", provider: "CSV upload", state: "live", note: "Clock events in, derived signals out." },
  { contract: "attendance_source", version: "v1", provider: "Biometric export", state: "ready", note: "Same contract; needs a device export schedule." },
  { contract: "ewa_provider", version: "v1", provider: "Mock provider", state: "live", note: "Full flow against a mock — offers, decline, accept." },
  { contract: "ewa_provider", version: "v1", provider: "Earnipay-class partner", state: "awaiting-access", note: "Activates on contract (§5 gate)." },
  { contract: "letter_verify", version: "v1", provider: "Public QR resolver", state: "live", note: "No third party involved — we are the issuer." },
];

export const adapterFor = (contract: string) => ADAPTERS.filter((a) => a.contract === contract);
export const activeAdapter = (contract: string) => adapterFor(contract).find((a) => a.state === "live");

/* --------------------------- payroll_connector v1 -------------------------- */

/**
 * FR-084/085. The platform NEVER computes pay: it lists payslip references,
 * fetches the document, reads balances and passes a leave request through.
 */
export type PayslipRef = {
  id: string; workerId: string; period: string; issued: string;
  /** Deliberately no amounts — the platform holds a REFERENCE, not the pay data. */
  source: string; state: "Issued" | "Pending";
};

export type LeaveBalance = { workerId: string; kind: string; entitled: number; taken: number; carried: number; expires?: string };

export type LeaveRequestRow = {
  id: string; workerId: string; kind: string; from: string; to: string; days: number;
  state: "Draft" | "Submitted" | "Approved" | "Declined"; approver: string; note?: string;
  /** FR-090: a site worker's leave books against the rotation calendar, not the office one. */
  againstRotation?: string;
};

export interface PayrollConnector {
  readonly provider: string;
  listPayslips(workerId: string): PayslipRef[];
  fetchPayslipUrl(id: string): string;
  leaveBalances(workerId: string): LeaveBalance[];
  submitLeave(req: Omit<LeaveRequestRow, "id" | "state">): LeaveRequestRow;
}

const SEED_PAYSLIPS: PayslipRef[] = [
  { id: "PS-2606", workerId: "E-0214", period: "Jun 2026", issued: "Jun 25", source: "CSV drop · Jun batch", state: "Issued" },
  { id: "PS-2605", workerId: "E-0214", period: "May 2026", issued: "May 25", source: "CSV drop · May batch", state: "Issued" },
  { id: "PS-2604", workerId: "E-0214", period: "Apr 2026", issued: "Apr 25", source: "CSV drop · Apr batch", state: "Issued" },
];

/**
 * The internal policy table FR-085 falls back to when NO payroll system is
 * connected — sourced from the handbook's own leave policy so the two cannot
 * drift: 20 days, 5 carry-over, expiring 31 March.
 */
export const POLICY_LEAVE: LeaveBalance[] = [
  { workerId: "E-0214", kind: "Annual leave", entitled: 20, taken: 6, carried: 5, expires: "31 Mar" },
  { workerId: "E-0214", kind: "Compassionate", entitled: 5, taken: 0, carried: 0 },
  { workerId: "E-0214", kind: "Study leave", entitled: 3, taken: 0, carried: 0 },
];

export const CSV_PAYROLL: PayrollConnector = {
  provider: "CSV / SFTP drop",
  listPayslips: (workerId) => SEED_PAYSLIPS.filter((p) => p.workerId === workerId),
  fetchPayslipUrl: (id) => `/vault/payslips/${id}.pdf`,
  leaveBalances: (workerId) => POLICY_LEAVE.filter((b) => b.workerId === workerId),
  submitLeave: (req) => ({ ...req, id: `LV-${Math.abs(req.from.length * 97 + req.days)}`, state: "Submitted" }),
};

export const SEED_LEAVE_REQUESTS: LeaveRequestRow[] = [
  { id: "LV-221", workerId: "E-0214", kind: "Annual leave", from: "Sep 14", to: "Sep 18", days: 5, state: "Approved", approver: "Ngozi Adeyemi" },
  { id: "LV-208", workerId: "E-0231", kind: "Annual leave", from: "Sep 02", to: "Sep 15", days: 14, state: "Submitted", approver: "Ibrahim Sani", againstRotation: "14/14 terminal" },
];

/* --------------------------- attendance_source v1 -------------------------- */

/**
 * FR-089. We do NOT build time-and-attendance — we ingest its signals.
 * Governance: attendance signals never trigger automated discipline, and
 * individual-level views are permissioned and access-logged.
 */
export type AttendanceEvent = { workerId: string; date: string; clockIn?: string; clockOut?: string; kind: "present" | "late" | "absent" | "overtime" };

export type AttendanceSignal = {
  workerId: string; absenceRate: number; latenessPattern: string; overtimeLoad: string;
  /** What the anomaly feed is allowed to say — never a disciplinary conclusion. */
  note: string; tone: PfTone;
};

export interface AttendanceSource {
  readonly provider: string;
  ingest(csv: string): AttendanceEvent[];
  signals(): AttendanceSignal[];
}

export const SEED_ATTENDANCE_SIGNALS: AttendanceSignal[] = [
  { workerId: "W-3305", absenceRate: 11.4, latenessPattern: "Late 4 of last 10 tours", overtimeLoad: "62h over 4 weeks", note: "Absence and overtime both elevated — a workload pattern, not a conduct finding.", tone: "red" },
  { workerId: "E-0231", absenceRate: 6.2, latenessPattern: "Within normal range", overtimeLoad: "48h over 4 weeks", note: "Sick-day cluster around changeover — matches the AN-101 anomaly already in the feed.", tone: "yellow" },
  { workerId: "W-3301", absenceRate: 2.1, latenessPattern: "Within normal range", overtimeLoad: "31h over 4 weeks", note: "Nothing anomalous.", tone: "green" },
  { workerId: "W-3302", absenceRate: 4.0, latenessPattern: "Late 2 of last 10 tours", overtimeLoad: "22h over 4 weeks", note: "Lateness clusters on crew-boat days — a logistics signal.", tone: "yellow" },
];

/** The reference CSV the day-one adapter accepts. */
export const ATTENDANCE_CSV_SAMPLE = `worker_id,date,clock_in,clock_out
W-3301,2026-08-05,05:52,17:31
W-3305,2026-08-05,,
W-3302,2026-08-05,06:19,17:04`;

export const CSV_ATTENDANCE: AttendanceSource = {
  provider: "CSV upload",
  ingest: (csv) =>
    csv.trim().split("\n").slice(1).filter(Boolean).map((line) => {
      const [workerId, date, clockIn, clockOut] = line.split(",");
      const kind: AttendanceEvent["kind"] = !clockIn ? "absent" : clockIn > "06:00" ? "late" : "present";
      return { workerId, date, clockIn: clockIn || undefined, clockOut: clockOut || undefined, kind };
    }),
  signals: () => SEED_ATTENDANCE_SIGNALS,
};

/* ----------------------------- ewa_provider v1 ----------------------------- */

/**
 * FR-091. Employee opt-in only; usage never feeds adverse inference; usage data
 * enters no model without its own DPIA. Mock provider ships now.
 */
export type EwaEligibility = { workerId: string; eligible: boolean; accruedNaira: number; capPct: number; reason?: string };
export type EwaOffer = { id: string; workerId: string; kind: "Earned-wage access" | "Salary advance"; maxNaira: number; feeNaira: number; state: "Offered" | "Accepted" | "Declined" };

export interface EwaProvider {
  readonly provider: string;
  checkEligibility(workerId: string): EwaEligibility;
  makeOffer(workerId: string, kind: EwaOffer["kind"]): EwaOffer;
}

export const MOCK_EWA: EwaProvider = {
  provider: "Mock provider",
  checkEligibility: (workerId) => ({ workerId, eligible: true, accruedNaira: 420_000, capPct: 50, reason: "Accrued earnings this cycle, capped at 50% by policy" }),
  makeOffer: (workerId, kind) => ({
    id: `EWA-${workerId.slice(-3)}`, workerId, kind,
    maxNaira: kind === "Earned-wage access" ? 210_000 : 400_000,
    feeNaira: kind === "Earned-wage access" ? 2_500 : 6_000,
    state: "Offered",
  }),
};

/* ----------------------------- letter_verify v1 ---------------------------- */

/**
 * FR-086. The QR resolves to a PUBLIC page confirming authenticity — the
 * anti-forgery feature no local incumbent offers. The public page must confirm
 * the letter is genuine WITHOUT disclosing its contents to whoever scans it.
 */
export type LetterVerification = {
  token: string; issued: string; kind: string; subject: string; issuer: string;
  valid: boolean; revoked?: boolean;
};

export interface LetterVerify {
  readonly provider: string;
  resolve(token: string): LetterVerification | null;
  publicUrl(token: string): string;
}

export const VERIFICATIONS: LetterVerification[] = [
  { token: "HB-7K2Q-9F4L", issued: "Aug 26, 2026", kind: "Employment confirmation", subject: "Amara Okonkwo", issuer: "Unrealabs · People Ops", valid: true },
  { token: "HB-3M8T-1P0R", issued: "Aug 12, 2026", kind: "Bank reference", subject: "Ngozi Obi", issuer: "Unrealabs · People Ops", valid: true },
  { token: "HB-5X1V-6C7B", issued: "Jun 04, 2026", kind: "Embassy / visa introduction", subject: "Emeka Nwosu", issuer: "Unrealabs · People Ops", valid: false, revoked: true },
];

export const QR_VERIFY: LetterVerify = {
  provider: "Public QR resolver",
  resolve: (token) => VERIFICATIONS.find((v) => v.token === token.toUpperCase().trim()) ?? null,
  publicUrl: (token) => `https://verify.unrealabs.ng/l/${token}`,
};
