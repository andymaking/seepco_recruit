/**
 * rewards.ts — PRD v2.1 WS-9: FR-096 expense claims + FR-097 total rewards.
 *
 * Two money surfaces that stop in different places, and knowing exactly where
 * each one stops is the whole design.
 *
 * FR-096 owns the CLAIM LIFECYCLE, not the payment. Hirebrew runs the claim,
 * the policy check and the approval chain, then hands a cleared batch to the
 * payroll connector for payment. It does not compute pay, it does not hold a
 * bank rail, and it does not move a naira. The batch handoff in this file is a
 * file leaving the building — everything after that belongs to your payroll
 * system.
 *
 * FR-097 is a STATEMENT, not an engine. It reads what the company already owes
 * and already provides, adds it up, and shows the person their own total. It
 * calculates nothing that anyone will be paid from.
 *
 * ── BINDING INVARIANTS ─────────────────────────────────────────────────────
 *
 * R1. VENDOR-NEUTRAL (release doctrine). The payroll-vendor decision is open.
 *     No vendor is named in this file. Payment is described as "your payroll
 *     system" / "the connected payroll source" and routed through the
 *     `payroll_connector` contract in `@/data/adapters` — the CSV/SFTP adapter
 *     that ships day one works with a spreadsheet, which is what most Nigerian
 *     mid-market payroll actually is.
 *
 * R2. THE POLICY ENGINE IS A RULE CHECK, NOT A MODEL. `checkLine()` is nine
 *     lines of deterministic comparison against a published table. Nothing in
 *     FR-096 is AI, nothing carries a confidence score, and no screen may frame
 *     a verdict as "AI flagged your expense". A person who is told a model
 *     doubted their receipt cannot argue with it. A person who is told
 *     "₦14,200 is above the ₦10,000 receipt threshold" can just attach the
 *     receipt. The second is the product.
 *
 * R3. THE ENGINE FLAGS; A HUMAN DECIDES. `over-cap` is not `rejected`.
 *     `duplicate-suspected` is not `duplicate`. Every verdict is an input to an
 *     approver, never an outcome.
 *
 * R4. MY_REWARDS IS SELF-SCOPED, HARD — the ME_PUBLIC rule from `@/data/me`,
 *     applied to money. E-0214 and nobody else. There is deliberately NO map
 *     keyed by employee id, NO `rewardsFor(id)` accessor and NO array of
 *     statements: a total-reward statement for an arbitrary id is a comp
 *     database with a friendly face, and the moment one exists somebody builds
 *     a screen that lists two of them side by side. One person's statement,
 *     reachable one way.
 *
 * R5. THE MARKET POSITION IS NOT A REWARD. Her L5 band median and her gap to it
 *     are HR's retention analysis (Retention.tsx, PB-31) — the company's own
 *     negotiating position, held for a decision the company has not made. They
 *     do not appear in this file in any form, not as a figure, not as a
 *     percentage, not as a hint. This module never imports Retention.tsx.
 *     Telling an employee "you are below market" on her own reward statement is
 *     not transparency: it is the employer volunteering an argument for a raise
 *     it has not decided to give, on a page she opened to see what she has.
 *     See REWARDS_EXCLUSIONS, which names the concepts and no numbers.
 *
 * R6. A TOTAL-REWARD FIGURE IS NOT A SALARY. It sums cash and the employer's
 *     cost of non-cash provision. It is not comparable to a salary band, an
 *     offer, or anyone's idea of "what I earn", and the statement says so out
 *     loud rather than letting the reader make that mistake privately.
 *
 * Deterministic: no Date.now(), no Math.random(). Reference day is Aug 28, 2026.
 */
import { activeAdapter } from "@/data/adapters";
import { ME_ID, ME_PUBLIC } from "@/data/me";
import { LND_ENTITLEMENT } from "@/data/onboarding";
import { naira } from "@/data/requisitions";
import type { PfTone } from "@/components/os/ui";

export const REWARDS_TODAY = "Aug 28, 2026";

/**
 * `naira()` from requisitions.ts rounds to the nearest ₦100k and always renders
 * in millions — correct for a salary band, useless for a ₦16,500 data claim,
 * which it renders as "₦0M". This is the exact formatter for line items. It is
 * not a second band formatter and must never be used for one; it is the
 * `fmtNaira` already living inside ClaimPortal.tsx, lifted to the data layer so
 * the two cannot drift.
 */
export const nairaExact = (n: number): string => `₦${n.toLocaleString("en-NG")}`;

/* ==========================================================================
 * FR-096 — EXPENSE CLAIMS
 * ========================================================================== */

export type ExpenseCategoryKey =
  | "travel-air" | "travel-ground" | "accommodation" | "per-diem"
  | "entertainment" | "home-office" | "data" | "medical" | "training";

/**
 * `never`     — per-diem. A rate is not a reimbursement; there is nothing to
 *               receipt, and asking for one misunderstands the instrument.
 * `threshold` — the handbook's ₦10,000 line (hb-expenses).
 * `always`    — categories where the receipt IS the control.
 */
export type ReceiptRule = "never" | "threshold" | "always";

export type ExpensePolicy = {
  key: ExpenseCategoryKey;
  name: string;
  icon: string;
  /** Cap in naira, per `capBasis` unit. */
  cap: number;
  capBasis: string;
  receiptRule: ReceiptRule;
  note: string;
};

/** The handbook's own number (hb-expenses): anything above ₦10,000 needs a receipt. */
export const RECEIPT_THRESHOLD = 10_000;

/** The handbook's own window: claim inside 30 days of the spend. */
export const CLAIM_WINDOW_DAYS = 30;

/** Approved claims are reimbursed with the payroll run on the 25th (hb-payroll, hb-expenses). */
export const PAYMENT_DAY = 25;

export const EXPENSE_POLICY: ExpensePolicy[] = [
  { key: "travel-air", name: "Travel — flights", icon: "paperplane", cap: 450_000, capBasis: "per return trip, economy", receiptRule: "always", note: "Domestic and regional economy. Lagos ↔ Port Harcourt is booked through the ops desk and is not claimable — see the policy exclusions." },
  { key: "travel-ground", name: "Travel — ground", icon: "swap", cap: 25_000, capBasis: "per day", receiptRule: "threshold", note: "Ride-hailing, taxis, fuel on an approved road trip. The daily cap is the sum of the day's trips, not each one." },
  { key: "accommodation", name: "Accommodation", icon: "house", cap: 85_000, capBasis: "per night", receiptRule: "always", note: "Lagos, Abuja and Port Harcourt rate. Site accommodation is provided, not claimed." },
  { key: "per-diem", name: "Meals & per-diem", icon: "wallet", cap: 35_000, capBasis: "per day, at the zone rate", receiptRule: "never", note: "A published daily rate by zone, paid whether or not it is spent. The cap shown is the highest zone; the line is checked against its own zone rate." },
  { key: "entertainment", name: "Client entertainment", icon: "users", cap: 120_000, capBasis: "per event", receiptRule: "always", note: "Attendees must be named on the line. An unnamed guest list is the oldest expense problem there is." },
  { key: "home-office", name: "Home-office equipment", icon: "stack", cap: 350_000, capBasis: "per calendar year", receiptRule: "always", note: "Desk, chair, monitor, peripherals. Laptops and phones are provisioned, never claimed." },
  { key: "data", name: "Data & telecoms", icon: "orbit", cap: 18_000, capBasis: "per month", receiptRule: "threshold", note: "Mobile data for remote and field work. Sits alongside the data allowance in your pay — the allowance is for your baseline, this is for a work spike." },
  { key: "medical", name: "Medical (non-covered)", icon: "heart", cap: 150_000, capBasis: "per calendar year", receiptRule: "always", note: "Only what the HMO has declined in writing. The decline letter is the receipt." },
  { key: "training", name: "Training incidentals", icon: "book", cap: 40_000, capBasis: "per course", receiptRule: "threshold", note: "Exam fees, materials, travel to a course. The course itself is an L&D entitlement and is never expensed — you are not out of pocket for it in the first place." },
];

export const policyFor = (k: ExpenseCategoryKey): ExpensePolicy => EXPENSE_POLICY.find((p) => p.key === k)!;

/* ------------------------------- per-diem --------------------------------- */

export type PerDiemZone = "offshore" | "onshore" | "city";

export type PerDiemRate = { zone: PerDiemZone; name: string; rate: number; applies: string; note: string };

/**
 * Nigerian reality: a day on an FPSO, a day at Bonny Terminal and a day in
 * Lagos are three different economic events, and one flat rate for all three is
 * either an underpayment offshore or a windfall in Ikoyi.
 */
export const PER_DIEM: Record<PerDiemZone, PerDiemRate> = {
  offshore: {
    zone: "offshore", name: "Offshore rotation", rate: 35_000,
    applies: "Bonga FPSO and any offshore installation",
    note: "Meals are provided aboard, so this is a tour allowance rather than a meal reimbursement. It is paid for every day of the tour whether or not anything is spent.",
  },
  onshore: {
    zone: "onshore", name: "Onshore site / terminal", rate: 25_000,
    applies: "Bonny Terminal, Port Harcourt Base, and any site posting away from home base",
    note: "Covers meals and incidentals where catering is partial. Applies from the day of travel to the day of return.",
  },
  city: {
    zone: "city", name: "City travel", rate: 18_000,
    applies: "Lagos, Abuja or Port Harcourt travel away from your home base",
    note: "The lowest zone. Accommodation is claimed separately against its own cap.",
  },
};

export const PER_DIEM_LIST: PerDiemRate[] = [PER_DIEM.offshore, PER_DIEM.onshore, PER_DIEM.city];

/* ---------------------------- the policy engine --------------------------- */

export type ExpenseVerdict = "ok" | "over-cap" | "missing-receipt" | "duplicate-suspected" | "outside-policy";

export const VERDICT_LABEL: Record<ExpenseVerdict, string> = {
  ok: "Within policy",
  "over-cap": "Over cap",
  "missing-receipt": "Receipt required",
  "duplicate-suspected": "Possible duplicate",
  "outside-policy": "Outside policy",
};

export const verdictTone = (v: ExpenseVerdict): PfTone =>
  v === "ok" ? "green" : v === "missing-receipt" ? "blue" : v === "duplicate-suspected" ? "yellow" : "red";

/**
 * The named exclusions. These are the rules that are not about amounts — the
 * places where the spend was legitimate and the claim is still wrong.
 */
export type PolicyExclusion = { id: string; name: string; rule: string; source: string };

export const POLICY_EXCLUSIONS: PolicyExclusion[] = [
  {
    id: "PX-01", name: "Lagos ↔ Port Harcourt travel",
    rule: "Booked through the ops desk on a corporate account, never claimed back. A claimed ticket on this route is refused however small it is.",
    source: "Handbook · Expenses & reimbursement (hb-expenses)",
  },
  {
    id: "PX-02", name: "The 30-day claim window",
    rule: "Claim inside 30 days of the spend. A line older than that is outside policy on its date alone.",
    source: "Handbook · Expenses & reimbursement (hb-expenses)",
  },
  {
    id: "PX-03", name: "Courses and coaching",
    rule: "Drawn as an L&D entitlement against the company pool, never expensed. You are never out of pocket, so there is nothing to reimburse.",
    source: "Handbook · Learning budget (hb-learning)",
  },
  {
    id: "PX-04", name: "Certifications and medicals",
    rule: "Arranged and paid by HSE. A worker never books their own BOSIET, NEBOSH or fitness-to-work medical and claims it back.",
    source: "Handbook · HSE requirements by location (hb-hse)",
  },
  {
    id: "PX-05", name: "Laptops, phones and site accommodation",
    rule: "Provisioned, not claimed. If it arrived through IT or through the site, it does not come back through expenses.",
    source: "Handbook · Devices, accounts & access (hb-devices)",
  },
];

export type ExpenseLine = {
  id: string;
  /** Machine date, for ordering and duplicate windows. */
  iso: string;
  /** Display date in the app's style. */
  date: string;
  category: ExpenseCategoryKey;
  merchant: string;
  amountNaira: number;
  /** Nights, days or trips. Caps are per unit; defaults to 1. */
  units?: number;
  /** Per-diem lines only. */
  zone?: PerDiemZone;
  receipt: boolean;
  receiptRef?: string;
  /** Flights only — the route, for PX-01. */
  route?: string;
  /** Days between the spend and submission (or the reference day, for a draft). */
  ageDays: number;
  /** Seeded, and re-derived by `checkLine()`. POLICY_AUDIT() proves they agree. */
  verdict: ExpenseVerdict;
  reason: string;
};

/** The subset `checkLine()` reads. Written out so it is obvious what it cannot see. */
export type CheckInput = Pick<ExpenseLine, "id" | "iso" | "category" | "merchant" | "amountNaira" | "units" | "zone" | "receipt" | "route" | "ageDays" | "receiptRef">;

const dayGap = (a: string, b: string): number =>
  Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000));

const LAGOS_PH = /lagos\s*(↔|<->|-|to|and)\s*port\s*harcourt|port\s*harcourt\s*(↔|<->|-|to|and)\s*lagos/i;

/**
 * THE RULE CHECK (R2). Deterministic, inspectable, and arguable — a claimant
 * can read the rule that produced their verdict and either fix the line or
 * disagree with the rule. It reads the LINE and its siblings and nothing else:
 * not the claimant's name, grade, department, worker type, performance,
 * attendance or history. An expense check that knows who is claiming is a
 * character assessment wearing a receipt.
 *
 * Order matters. A spend that should never have been claimed is outside policy
 * whatever it cost; only then does the amount matter.
 */
export const checkLine = (line: CheckInput, siblings: CheckInput[] = []): { verdict: ExpenseVerdict; reason: string } => {
  const p = policyFor(line.category);

  // 1. Outside policy — the exclusions, which are about the spend, not the sum.
  if (line.category === "travel-air" && line.route && LAGOS_PH.test(line.route)) {
    return {
      verdict: "outside-policy",
      reason: `${POLICY_EXCLUSIONS[0].rule} (${POLICY_EXCLUSIONS[0].source})`,
    };
  }
  if (line.ageDays > CLAIM_WINDOW_DAYS) {
    return {
      verdict: "outside-policy",
      reason: `Spent ${line.ageDays} days ago. The claim window is ${CLAIM_WINDOW_DAYS} days from the spend (${POLICY_EXCLUSIONS[1].source}).`,
    };
  }

  // 2. Duplicate — an EARLIER sibling matching on category, merchant and amount
  //    inside a 3-day window. Only the later line is flagged; the first stands.
  const twin = siblings.find(
    (s) =>
      s.id !== line.id &&
      s.category === line.category &&
      s.merchant === line.merchant &&
      s.amountNaira === line.amountNaira &&
      Date.parse(s.iso) < Date.parse(line.iso) &&
      dayGap(s.iso, line.iso) <= 3,
  );
  if (twin) {
    const sameRef = twin.receiptRef && twin.receiptRef === line.receiptRef;
    return {
      verdict: "duplicate-suspected",
      reason: `Same category, same merchant and the same ${nairaExact(line.amountNaira)} as the line dated ${twin.iso.slice(5).replace("-", "/")}, ${dayGap(twin.iso, line.iso)} day(s) earlier${sameRef ? `, with the same receipt reference ${line.receiptRef}` : ""}. Suspected, not decided — the approver rules on it.`,
    };
  }

  // 3. Receipt.
  if (p.receiptRule === "always" && !line.receipt) {
    return { verdict: "missing-receipt", reason: `${p.name} always needs a receipt, at any amount. Attach it and the line clears.` };
  }
  if (p.receiptRule === "threshold" && line.amountNaira > RECEIPT_THRESHOLD && !line.receipt) {
    return {
      verdict: "missing-receipt",
      reason: `${nairaExact(line.amountNaira)} is above the ${nairaExact(RECEIPT_THRESHOLD)} receipt threshold and no receipt is attached. Attach it and the line clears — nothing else about it is out of policy.`,
    };
  }

  // 4. Cap, per unit. Per-diem is checked against its own zone rate.
  const units = line.units ?? 1;
  const cap = line.category === "per-diem" && line.zone ? PER_DIEM[line.zone].rate : p.cap;
  const perUnit = Math.round(line.amountNaira / units);
  if (perUnit > cap) {
    return {
      verdict: "over-cap",
      reason: `${nairaExact(perUnit - cap)} above the ${nairaExact(cap)} cap ${p.capBasis}. An over-cap line still goes to the approver with a note — it is not an automatic rejection.`,
    };
  }

  // 5. Clear.
  if (line.category === "per-diem" && line.zone) {
    const r = PER_DIEM[line.zone];
    return { verdict: "ok", reason: `Rate applied: ${r.name} ${nairaExact(r.rate)} per day × ${units} ${units === 1 ? "day" : "days"}. Per-diem is a rate, not a reimbursement — no receipt is required or expected.` };
  }
  if (p.receiptRule === "threshold" && line.amountNaira <= RECEIPT_THRESHOLD && !line.receipt) {
    return { verdict: "ok", reason: `Under the ${nairaExact(RECEIPT_THRESHOLD)} receipt threshold — no receipt required. Within the ${nairaExact(cap)} cap ${p.capBasis}.` };
  }
  return { verdict: "ok", reason: `Within the ${nairaExact(cap)} cap ${p.capBasis}. Receipt attached.` };
};

/* --------------------------- approval chain ------------------------------- */

/**
 * The same ₦120,000 shape as the L&D entitlement, on purpose: one number an
 * employee has to remember, applied the same way in both places. Below it, the
 * manager is the whole chain. Above it, Finance is a second, separate approval.
 */
export const APPROVAL_THRESHOLD = LND_ENTITLEMENT.approverThreshold;

export type ApprovalStep = { role: string; who: string; state: "pending" | "approved" | "rejected" | "not-required"; at?: string; note?: string };

export const approvalChainFor = (total: number): { steps: number; needsFinance: boolean; label: string } => ({
  steps: total > APPROVAL_THRESHOLD ? 2 : 1,
  needsFinance: total > APPROVAL_THRESHOLD,
  label:
    total > APPROVAL_THRESHOLD
      ? `${nairaExact(total)} — over the ${nairaExact(APPROVAL_THRESHOLD)} threshold. Manager, then Finance.`
      : `${nairaExact(total)} — under the ${nairaExact(APPROVAL_THRESHOLD)} threshold. Manager approves and it is done.`,
});

export type ClaimState = "Draft" | "Submitted" | "Approved" | "Rejected" | "Queued for payment" | "Paid";

export const CLAIM_STATES: ClaimState[] = ["Draft", "Submitted", "Approved", "Rejected", "Queued for payment", "Paid"];

export const claimStateTone = (s: ClaimState): PfTone =>
  s === "Paid" ? "green" : s === "Queued for payment" || s === "Approved" ? "blue"
    : s === "Submitted" ? "yellow" : s === "Rejected" ? "red" : "grey";

export type Claim = {
  id: string;
  claimantId: string;
  claimant: string;
  init: string;
  tone: string;
  role: string;
  period: string;
  submitted?: string;
  lines: ExpenseLine[];
  totalNaira: number;
  state: ClaimState;
  approvals: ApprovalStep[];
  approvedAt?: string;
  /** Set once the batch has left. This is a reference, not a payment record. */
  batchId?: string;
  paymentRef?: string;
  paidOn?: string;
  note?: string;
};

/* ------------------------------- the claims ------------------------------- */

const EX_2071_LINES: ExpenseLine[] = [
  { id: "L-1", iso: "2026-07-03", date: "Jul 3", category: "data", merchant: "MTN Nigeria · monthly data", amountNaira: 16_500, receipt: true, receiptRef: "RC-88120", ageDays: 15, verdict: "ok", reason: "Within the ₦18,000 cap per month. Receipt attached." },
  { id: "L-2", iso: "2026-07-09", date: "Jul 9", category: "training", merchant: "Exam voucher · payments certification", amountNaira: 12_000, receipt: true, receiptRef: "RC-88134", ageDays: 9, verdict: "ok", reason: "Within the ₦40,000 cap per course. Receipt attached." },
  { id: "L-3", iso: "2026-07-15", date: "Jul 15", category: "travel-ground", merchant: "Bolt · Lagos", amountNaira: 9_800, receipt: false, ageDays: 3, verdict: "ok", reason: "Under the ₦10,000 receipt threshold — no receipt required. Within the ₦25,000 cap per day." },
];

const EX_2085_LINES: ExpenseLine[] = [
  { id: "L-1", iso: "2026-08-14", date: "Aug 14", category: "home-office", merchant: "Slot Systems · 27-inch monitor", amountNaira: 398_000, receipt: true, receiptRef: "RC-90211", ageDays: 11, verdict: "over-cap", reason: "₦48,000 above the ₦350,000 cap per calendar year. An over-cap line still goes to the approver with a note — it is not an automatic rejection." },
  { id: "L-2", iso: "2026-08-03", date: "Aug 3", category: "data", merchant: "MTN Nigeria · monthly data", amountNaira: 16_500, receipt: true, receiptRef: "RC-90104", ageDays: 22, verdict: "ok", reason: "Within the ₦18,000 cap per month. Receipt attached." },
  { id: "L-3", iso: "2026-08-19", date: "Aug 19", category: "travel-ground", merchant: "Bolt · Ikoyi client visit", amountNaira: 14_200, receipt: false, ageDays: 6, verdict: "missing-receipt", reason: "₦14,200 is above the ₦10,000 receipt threshold and no receipt is attached. Attach it and the line clears — nothing else about it is out of policy." },
];

const EX_2090_LINES: ExpenseLine[] = [
  { id: "L-1", iso: "2026-08-20", date: "Aug 20", category: "entertainment", merchant: "Terra Kulture · client dinner (3 attendees named)", amountNaira: 86_000, receipt: true, receiptRef: "RC-90340", ageDays: 8, verdict: "ok", reason: "Within the ₦120,000 cap per event. Receipt attached." },
  { id: "L-2", iso: "2026-08-21", date: "Aug 21", category: "per-diem", merchant: "Lagos city per-diem", amountNaira: 36_000, units: 2, zone: "city", receipt: false, ageDays: 7, verdict: "ok", reason: "Rate applied: City travel ₦18,000 per day × 2 days. Per-diem is a rate, not a reimbursement — no receipt is required or expected." },
  { id: "L-3", iso: "2026-07-12", date: "Jul 12", category: "training", merchant: "GIGM · travel to course venue", amountNaira: 15_000, receipt: true, receiptRef: "RC-89002", ageDays: 47, verdict: "outside-policy", reason: "Spent 47 days ago. The claim window is 30 days from the spend (Handbook · Expenses & reimbursement (hb-expenses))." },
];

const EX_2078_LINES: ExpenseLine[] = [
  { id: "L-1", iso: "2026-08-18", date: "Aug 18", category: "per-diem", merchant: "Bonga FPSO · 28/28 tour", amountNaira: 980_000, units: 28, zone: "offshore", receipt: false, ageDays: 2, verdict: "ok", reason: "Rate applied: Offshore rotation ₦35,000 per day × 28 days. Per-diem is a rate, not a reimbursement — no receipt is required or expected." },
  { id: "L-2", iso: "2026-08-04", date: "Aug 4", category: "travel-ground", merchant: "Heliport transfer · Port Harcourt", amountNaira: 18_500, receipt: true, receiptRef: "RC-90055", ageDays: 16, verdict: "ok", reason: "Within the ₦25,000 cap per day. Receipt attached." },
];

const EX_2081_LINES: ExpenseLine[] = [
  { id: "L-1", iso: "2026-07-08", date: "Jul 8", category: "accommodation", merchant: "Golden Tulip · Port Harcourt (2 nights)", amountNaira: 164_000, units: 2, receipt: true, receiptRef: "RC-87720", ageDays: 6, verdict: "ok", reason: "₦82,000 per night across 2 nights — within the ₦85,000 cap per night. Receipt attached." },
  { id: "L-2", iso: "2026-07-11", date: "Jul 11", category: "travel-ground", merchant: "Bolt · Port Harcourt airport transfer", amountNaira: 11_400, receipt: true, receiptRef: "RC-88901 · attached Aug 5", ageDays: 3, verdict: "ok", reason: "Cleared. Flagged missing-receipt on submission — ₦11,400 is above the ₦10,000 threshold. Receipt attached 5 August and the line cleared the same day." },
];

const EX_2075_LINES: ExpenseLine[] = [
  { id: "L-1", iso: "2026-07-05", date: "Jul 5", category: "travel-air", merchant: "Air Peace · return flight", route: "Lagos ↔ Port Harcourt", amountNaira: 186_000, receipt: true, receiptRef: "RC-87401", ageDays: 15, verdict: "outside-policy", reason: "Booked through the ops desk on a corporate account, never claimed back. A claimed ticket on this route is refused however small it is. (Handbook · Expenses & reimbursement (hb-expenses))" },
  { id: "L-2", iso: "2026-07-06", date: "Jul 6", category: "per-diem", merchant: "Bonny Terminal · onshore posting", amountNaira: 125_000, units: 5, zone: "onshore", receipt: false, ageDays: 14, verdict: "ok", reason: "Rate applied: Onshore site / terminal ₦25,000 per day × 5 days. Per-diem is a rate, not a reimbursement — no receipt is required or expected." },
  { id: "L-3", iso: "2026-07-08", date: "Jul 8", category: "travel-ground", merchant: "Bolt · Port Harcourt", amountNaira: 14_000, receipt: true, receiptRef: "RC-87455", ageDays: 12, verdict: "ok", reason: "Within the ₦25,000 cap per day. Receipt attached." },
  { id: "L-4", iso: "2026-07-09", date: "Jul 9", category: "travel-ground", merchant: "Bolt · Port Harcourt", amountNaira: 14_000, receipt: true, receiptRef: "RC-87455", ageDays: 11, verdict: "duplicate-suspected", reason: "Same category, same merchant and the same ₦14,000 as the line dated 07/08, 1 day(s) earlier, with the same receipt reference RC-87455. Suspected, not decided — the approver rules on it." },
];

const sum = (ls: ExpenseLine[]): number => ls.reduce((a, l) => a + l.amountNaira, 0);

export const CLAIMS: Claim[] = [
  {
    id: "EX-2090", claimantId: "E-0214", claimant: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer",
    period: "Aug 2026", lines: EX_2090_LINES, totalNaira: sum(EX_2090_LINES), state: "Draft",
    approvals: [
      { role: "Manager", who: "Ngozi Adeyemi", state: "pending" },
      { role: "Finance", who: "Finance · second approver", state: "pending", note: "Required — the draft total is over the ₦120,000 threshold." },
    ],
    note: "Draft. The July travel line is already flagged outside the 30-day window — caught before submission, which is the point of running the check on a draft rather than at the approver.",
  },
  {
    id: "EX-2085", claimantId: "E-0214", claimant: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer",
    period: "Aug 2026", submitted: "Aug 25, 2026", lines: EX_2085_LINES, totalNaira: sum(EX_2085_LINES), state: "Submitted",
    approvals: [
      { role: "Manager", who: "Ngozi Adeyemi", state: "pending", note: "With her since Aug 25. Two flagged lines to rule on: one over cap, one missing a receipt." },
      { role: "Finance", who: "Finance · second approver", state: "pending", note: "Required — ₦428,700 is over the ₦120,000 threshold." },
    ],
    note: "Awaiting Ngozi Adeyemi. The monitor is ₦48,000 over the annual home-office cap; that is a decision for the approver, not a rejection by the system.",
  },
  {
    id: "EX-2071", claimantId: "E-0214", claimant: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer",
    period: "Jul 2026", submitted: "Jul 18, 2026", lines: EX_2071_LINES, totalNaira: sum(EX_2071_LINES), state: "Paid",
    approvals: [
      { role: "Manager", who: "Ngozi Adeyemi", state: "approved", at: "Jul 21, 2026" },
      { role: "Finance", who: "—", state: "not-required", note: "₦38,300 is under the ₦120,000 threshold. One approval, and done." },
    ],
    approvedAt: "Jul 21, 2026", batchId: "BATCH-2607", paymentRef: "PAY-2607-B14", paidOn: "Jul 25, 2026",
    note: "Cleared, batched and handed off. The payment reference came back from the payroll source — this platform recorded it, it did not create it.",
  },
  {
    id: "EX-2078", claimantId: "E-0250", claimant: "Seyi Ajayi", init: "SA", tone: "#16B364", role: "Contract Rig Technician",
    period: "Aug 2026", submitted: "Aug 20, 2026", lines: EX_2078_LINES, totalNaira: sum(EX_2078_LINES), state: "Queued for payment",
    approvals: [
      { role: "Manager", who: "Yusuf Lawal · Drilling Support", state: "approved", at: "Aug 22, 2026" },
      { role: "Finance", who: "Finance · Kemi Salami", state: "approved", at: "Aug 26, 2026", note: "₦998,500 is over the ₦120,000 threshold, so Finance is a separate approval and not a rubber stamp on the manager's." },
    ],
    approvedAt: "Aug 26, 2026", batchId: "BATCH-2609",
    note: "The site population claims too, and a full offshore tour is the largest routine claim in the company. E-0250 is engaged through a contracting company; the cleared batch still leaves through the same payroll connector, which is where the employee-vs-contractor payment route is resolved. This platform does not resolve it and does not need to.",
  },
  {
    id: "EX-2081", claimantId: "E-0187", claimant: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Finance Analyst",
    period: "Jul 2026", submitted: "Jul 14, 2026", lines: EX_2081_LINES, totalNaira: sum(EX_2081_LINES), state: "Paid",
    approvals: [
      { role: "Manager", who: "Kemi Salami · Finance", state: "approved", at: "Aug 5, 2026" },
      { role: "Finance", who: "Finance controls · second approver", state: "approved", at: "Aug 5, 2026", note: "Her manager IS the Finance head, so the manager step cannot also be the Finance step. Segregation of duties routes the second approval elsewhere." },
    ],
    approvedAt: "Aug 5, 2026", batchId: "BATCH-2608", paymentRef: "PAY-2608-B09", paidOn: "Aug 25, 2026",
    note: "Held for three weeks by one missing receipt on an ₦11,400 line, and missed the July run entirely. She raised HD-411 to ask why. The two records describe the same event from opposite sides and are not linked in code — the fix was to make the flag louder, not to join the tables.",
  },
  {
    id: "EX-2075", claimantId: "E-0231", claimant: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead",
    period: "Jul 2026", submitted: "Jul 20, 2026", lines: EX_2075_LINES, totalNaira: sum(EX_2075_LINES), state: "Submitted",
    approvals: [
      { role: "Manager", who: "Ibrahim Sani · Field Operations", state: "pending", note: "Two flagged lines: a route that should have gone through the ops desk, and a possible duplicate." },
      { role: "Finance", who: "Finance · Kemi Salami", state: "pending", note: "Required — ₦339,000 is over the ₦120,000 threshold." },
    ],
    note: "The flight is fully receipted and well under the flight cap. It is still outside policy, because the route is booked centrally. The amount was never the question.",
  },
];

export const claim = (id: string): Claim | undefined => CLAIMS.find((c) => c.id === id);

export const claimsFor = (workerId: string): Claim[] => CLAIMS.filter((c) => c.claimantId === workerId);

export const flaggedLines = (c: Claim): ExpenseLine[] => c.lines.filter((l) => l.verdict !== "ok");

/**
 * Proves the seeded verdicts equal what the engine derives. Renders as the
 * "policy engine" strip. `clean: false` means a seed row is lying about its own
 * verdict, which would make every screen built on it untrustworthy.
 */
export const POLICY_AUDIT = (): { lines: number; flagged: number; mismatches: string[]; clean: boolean } => {
  const mismatches: string[] = [];
  let lines = 0;
  let flagged = 0;
  for (const c of CLAIMS) {
    for (const l of c.lines) {
      lines += 1;
      if (l.verdict !== "ok") flagged += 1;
      const derived = checkLine(l, c.lines);
      if (derived.verdict !== l.verdict) mismatches.push(`${c.id}/${l.id}: seeded ${l.verdict}, derived ${derived.verdict}`);
    }
  }
  return { lines, flagged, mismatches, clean: mismatches.length === 0 };
};

export const claimKpis = () => {
  const paid = CLAIMS.filter((c) => c.state === "Paid");
  return {
    open: CLAIMS.filter((c) => c.state === "Submitted" || c.state === "Approved").length,
    draft: CLAIMS.filter((c) => c.state === "Draft").length,
    queued: CLAIMS.filter((c) => c.state === "Queued for payment").length,
    paid: paid.length,
    flaggedLines: CLAIMS.reduce((a, c) => a + flaggedLines(c).length, 0),
    totalOutstanding: CLAIMS.filter((c) => c.state !== "Paid" && c.state !== "Draft" && c.state !== "Rejected").reduce((a, c) => a + c.totalNaira, 0),
    note: "Outstanding is what has been approved or is awaiting approval and has not yet left in a batch. It is a workflow figure, not a liability figure — the ledger lives in your finance system.",
  };
};

/* --------------------------- the payment handoff -------------------------- */

export type BatchState = "Building" | "Exported" | "Paid";

/**
 * WHERE HIREBREW STOPS (R1). A batch is a file of cleared claims handed to the
 * `payroll_connector` contract. The connector's day-one adapter is a CSV/SFTP
 * drop, which works with any payroll system including a spreadsheet. This
 * platform does not compute the payment, hold the funds, or know the bank
 * details — `paymentRef` is a reference that came BACK from the payroll source
 * after it paid, recorded here so the claimant can be told the claim is done.
 */
export type PaymentBatch = {
  id: string;
  period: string;
  claimIds: string[];
  totalNaira: number;
  state: BatchState;
  contract: "payroll_connector";
  /** Read from ADAPTERS at render time — never a vendor name written into this file. */
  via: string;
  exportedAt?: string;
  runDate: string;
  paymentRef?: string;
  note: string;
};

/** The live adapter for the contract, whatever it currently is. Vendor decision is open. */
export const PAYROLL_ROUTE = activeAdapter("payroll_connector")?.provider ?? "CSV / SFTP drop";

export const PAYMENT_BATCHES: PaymentBatch[] = [
  {
    id: "BATCH-2609", period: "Sep 2026", claimIds: ["EX-2078"], totalNaira: 998_500,
    state: "Building", contract: "payroll_connector", via: PAYROLL_ROUTE, runDate: "Sep 25, 2026",
    note: "Open. Cleared claims accumulate until the export cut-off, then leave as one file ahead of the run on the 25th.",
  },
  {
    id: "BATCH-2608", period: "Aug 2026", claimIds: ["EX-2081"], totalNaira: 175_400,
    state: "Paid", contract: "payroll_connector", via: PAYROLL_ROUTE, exportedAt: "Aug 22, 2026", runDate: "Aug 25, 2026", paymentRef: "PAY-2608-B09",
    note: "Exported Aug 22, paid with the run on the 25th. The reference came back from the payroll source and was recorded against the claim.",
  },
  {
    id: "BATCH-2607", period: "Jul 2026", claimIds: ["EX-2071"], totalNaira: 38_300,
    state: "Paid", contract: "payroll_connector", via: PAYROLL_ROUTE, exportedAt: "Jul 23, 2026", runDate: "Jul 25, 2026", paymentRef: "PAY-2607-B14",
    note: "Exported Jul 23, paid with the run on the 25th.",
  },
];

export const batch = (id: string): PaymentBatch | undefined => PAYMENT_BATCHES.find((b) => b.id === id);

/** The CSV the day-one adapter emits. Columns only — no bank details, ever. */
export const BATCH_CSV_SAMPLE = `claim_id,worker_id,period,amount_ngn,approved_on,approver
EX-2071,E-0214,2026-07,38300,2026-07-21,manager
EX-2081,E-0187,2026-07,175400,2026-08-05,manager+finance`;

export const HANDOFF_NOTE = {
  headline: "Where this stops",
  body: "Hirebrew runs the claim, the policy check and the approval chain, then hands a cleared batch to your payroll system for payment. It does not compute pay, hold funds, store bank details or move money. The payment reference on a paid claim came back from the payroll source; it was not created here.",
  contract: "payroll_connector v1",
  fallback: "The day-one adapter is a CSV/SFTP drop, so this works before any integration exists — including where payroll is a spreadsheet.",
} as const;

/* ==========================================================================
 * FR-097 — TOTAL REWARDS  ·  E-0214 ONLY
 * ==========================================================================
 *
 * R4 RESTATED AT THE BOUNDARY. Everything below this line describes exactly one
 * person: Amara Okonkwo, E-0214. There is no accessor that takes an id, no map,
 * no list, and no way to reach a second person's statement from this module.
 * If a future requirement needs statements for everyone, it needs a different
 * module with its own access control, its own audit log and its own review —
 * not an extra argument on this one.
 */

export const REWARDS_SUBJECT = { id: ME_ID, name: ME_PUBLIC.name, grade: ME_PUBLIC.grade, role: ME_PUBLIC.role } as const;

/* --------------------------- the cash components -------------------------- */

/** Annual gross cash. Reconciles with the ₦21.6M current figure held elsewhere. */
export const ANNUAL_CASH = 21_600_000;

export const BASIC = 14_400_000;
export const HOUSING = 4_320_000;
export const TRANSPORT = 2_160_000;
export const DATA_ALLOWANCE = 720_000;

/**
 * Pension Reform Act 2014 defines "monthly emoluments" as basic + housing +
 * transport. The data allowance sits outside it, which is why the pension base
 * is not the same as the gross — a distinction that confuses people every year
 * and is worth showing rather than hiding behind a single number.
 */
export const PENSIONABLE_EMOLUMENTS = BASIC + HOUSING + TRANSPORT;

export const EMPLOYER_PENSION_PCT = 10;
export const EMPLOYEE_PENSION_PCT = 8;

export const EMPLOYER_PENSION = Math.round((PENSIONABLE_EMOLUMENTS * EMPLOYER_PENSION_PCT) / 100);
export const EMPLOYEE_PENSION = Math.round((PENSIONABLE_EMOLUMENTS * EMPLOYEE_PENSION_PCT) / 100);

export const HMO_COVER = 780_000;
export const LIFE_PREMIUM = 162_000;
/** PRA minimum: at least 3× annual total emoluments. */
export const LIFE_COVER = PENSIONABLE_EMOLUMENTS * 3;

export const WORKING_DAYS_PER_YEAR = 260;
export const LEAVE_DAY_VALUE = Math.round(ANNUAL_CASH / WORKING_DAYS_PER_YEAR);
export const LEAVE_DAYS_ENTITLED = 20;
export const LEAVE_DAYS_CARRIED = 5;
export const LEAVE_VALUE = LEAVE_DAY_VALUE * (LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED);

export type RewardKind = "cash" | "non-cash";

export type RewardComponent = {
  id: string;
  name: string;
  kind: RewardKind;
  amountNaira: number;
  /** False for components shown for context that must NOT be added to the total. */
  inTotal: boolean;
  icon: string;
  tone: PfTone;
  basis: string;
  detail?: string;
};

/**
 * The components. Two rules the statement lives by:
 *  · Employee deductions are NOT rewards. Her own 8% pension contribution is
 *    her money leaving her pay — showing it as something the company gives her
 *    would be a lie with a chart on it. It appears as context, `inTotal: false`.
 *  · Paid leave is ALREADY inside base salary. Its value is worth seeing and
 *    must not be added again, or the total inflates by the same money twice.
 */
export const MY_REWARD_COMPONENTS: RewardComponent[] = [
  {
    id: "RC-basic", name: "Basic salary", kind: "cash", amountNaira: BASIC, inTotal: true, icon: "wallet", tone: "green",
    basis: "Employment contract v2, effective 1 May 2025. Paid on the 25th of each month.",
    detail: "The pensionable core of your pay, and the figure most statutory calculations start from.",
  },
  {
    id: "RC-housing", name: "Housing allowance", kind: "cash", amountNaira: HOUSING, inTotal: true, icon: "house", tone: "green",
    basis: "Employment contract v2. Paid monthly with salary.",
  },
  {
    id: "RC-transport", name: "Transport allowance", kind: "cash", amountNaira: TRANSPORT, inTotal: true, icon: "swap", tone: "green",
    basis: "Employment contract v2. Paid monthly with salary.",
  },
  {
    id: "RC-data", name: "Data & telecoms allowance", kind: "cash", amountNaira: DATA_ALLOWANCE, inTotal: true, icon: "orbit", tone: "green",
    basis: "Uplifted from ₦600,000 effective 1 August 2026.",
    detail: "Outside the pension base by law — basic, housing and transport are the pensionable three.",
  },
  {
    id: "RC-pension-er", name: "Pension — employer contribution", kind: "non-cash", amountNaira: EMPLOYER_PENSION, inTotal: true, icon: "shield", tone: "blue",
    basis: "Pension Reform Act 2014 · 10% of ₦20,880,000 pensionable emoluments (basic + housing + transport).",
    detail: "Paid into your RSA on top of your salary, not out of it. It is yours and it moves with you between employers.",
  },
  {
    id: "RC-hmo", name: "Medical cover — HMO", kind: "non-cash", amountNaira: HMO_COVER, inTotal: true, icon: "heart", tone: "blue",
    basis: "Family plan — you plus 2 registered dependants. Upgraded from single cover on 1 January 2026.",
    detail: "The figure is what the company pays the provider for your plan, which is what the benefit costs to give you.",
  },
  {
    id: "RC-life", name: "Group life assurance", kind: "non-cash", amountNaira: LIFE_PREMIUM, inTotal: true, icon: "shield", tone: "blue",
    basis: "Annual premium. Cover restated at 3× annual emoluments on 1 April 2026 — the statutory minimum under the Pension Reform Act.",
    detail: "Premium is the cost of the benefit; the cover it buys is a much larger number and is shown separately.",
  },
  {
    id: "RC-lnd", name: "Learning & development entitlement", kind: "non-cash", amountNaira: LND_ENTITLEMENT.yourDraw, inTotal: true, icon: "book", tone: "purple",
    basis: "Company pool this year, drawn as an entitlement. Your manager approves anything over ₦120,000.",
    detail: "Valued at what you have actually drawn, which is ₦0 so far this year. Courses and coaching are never expensed and never come out of your pocket, so there is nothing to reimburse.",
  },
  {
    id: "RC-leave", name: "Paid annual leave", kind: "non-cash", amountNaira: LEAVE_VALUE, inTotal: false, icon: "calendar", tone: "grey",
    basis: "20 days entitlement plus 5 carried, valued at your daily rate of ₦83,077 across a 260-day year.",
    detail: "SHOWN, NOT ADDED. Paid leave is already inside your base salary — counting it again would inflate this statement by the same money twice. The 5 carried days expire on 31 March.",
  },
  {
    id: "RC-pension-ee", name: "Pension — your contribution", kind: "cash", amountNaira: EMPLOYEE_PENSION, inTotal: false, icon: "arrowright", tone: "grey",
    basis: "8% of ₦20,880,000 pensionable emoluments, deducted at source and remitted for you.",
    detail: "SHOWN, NOT ADDED. This is your money going into your own RSA. It is a deduction from your pay, not something the company gives you, and a total-reward statement that counted it would be counting your salary twice.",
  },
];

export type TotalRewards = {
  subjectId: string;
  subjectName: string;
  asAt: string;
  components: RewardComponent[];
  cashNaira: number;
  nonCashNaira: number;
  totalNaira: number;
  cashPct: number;
  nonCashPct: number;
  headline: string;
  caveat: string;
};

const inTotal = MY_REWARD_COMPONENTS.filter((c) => c.inTotal);
const CASH_TOTAL = inTotal.filter((c) => c.kind === "cash").reduce((a, c) => a + c.amountNaira, 0);
const NONCASH_TOTAL = inTotal.filter((c) => c.kind === "non-cash").reduce((a, c) => a + c.amountNaira, 0);
const TOTAL = CASH_TOTAL + NONCASH_TOTAL;

/**
 * THE STATEMENT. One person. See R4 — there is no second one, and no accessor
 * that could produce one.
 */
export const MY_REWARDS: TotalRewards = {
  subjectId: ME_ID,
  subjectName: ME_PUBLIC.name,
  asAt: REWARDS_TODAY,
  components: MY_REWARD_COMPONENTS,
  cashNaira: CASH_TOTAL,
  nonCashNaira: NONCASH_TOTAL,
  totalNaira: TOTAL,
  cashPct: Math.round((CASH_TOTAL / TOTAL) * 100),
  nonCashPct: Math.round((NONCASH_TOTAL / TOTAL) * 100),
  headline: `${naira(TOTAL)} total reward — ${naira(CASH_TOTAL)} in cash and ${nairaExact(NONCASH_TOTAL)} the company spends on your behalf.`,
  caveat:
    "This is not a salary and it is not comparable to one (R6). It adds your cash pay to what the company pays other people to provide your benefits. Nobody will ever pay you this figure, and quoting it as what you earn will mislead whoever hears it.",
};

export const cashComponents = (): RewardComponent[] => MY_REWARD_COMPONENTS.filter((c) => c.kind === "cash" && c.inTotal);
export const nonCashComponents = (): RewardComponent[] => MY_REWARD_COMPONENTS.filter((c) => c.kind === "non-cash" && c.inTotal);
export const contextComponents = (): RewardComponent[] => MY_REWARD_COMPONENTS.filter((c) => !c.inTotal);

/** The cover figures — a benefit whose size is not its cost. */
export const MY_COVER = [
  { name: "Group life assurance", value: LIFE_COVER, basis: "3× annual emoluments, the statutory minimum. Payable to your named beneficiaries.", icon: "shield" },
  { name: "HMO — family plan", value: HMO_COVER, basis: "You plus 2 registered dependants. The figure is the annual premium the company pays.", icon: "heart" },
  { name: "L&D company pool", value: LND_ENTITLEMENT.poolNaira, basis: `Company-wide pool for the year. Your approval threshold is ${nairaExact(LND_ENTITLEMENT.approverThreshold)}; you have drawn ${nairaExact(LND_ENTITLEMENT.yourDraw)}.`, icon: "book" },
];

/* ------------------------------- history ---------------------------------- */

export type RewardChange = {
  id: string;
  effective: string;
  title: string;
  kind: RewardKind | "both";
  fromNaira?: number;
  toNaira?: number;
  document?: string;
  detail: string;
  /** False for the promotion, which predates the 12-month window and is pinned. */
  withinLast12Months: boolean;
};

/**
 * Changes she is entitled to see, which is a narrower set than "changes that
 * happened". A pay decision under discussion is not a reward change, and does
 * not appear here until it is one.
 */
export const MY_REWARD_HISTORY: RewardChange[] = [
  {
    id: "RH-01", effective: "Aug 1, 2026", title: "Data & telecoms allowance uplifted", kind: "cash",
    fromNaira: 600_000, toNaira: 720_000,
    detail: "Company-wide uplift for remote and field roles. Applied automatically — no request needed.",
    withinLast12Months: true,
  },
  {
    id: "RH-02", effective: "Jun 12, 2026", title: "L&D entitlement confirmed for the year", kind: "non-cash",
    detail: `Company pool confirmed at ${naira(LND_ENTITLEMENT.poolNaira)}. Your manager approves anything over ${nairaExact(LND_ENTITLEMENT.approverThreshold)}; you have drawn ${nairaExact(LND_ENTITLEMENT.yourDraw)} so far.`,
    withinLast12Months: true,
  },
  {
    id: "RH-03", effective: "Apr 1, 2026", title: "Group life cover restated at 3× emoluments", kind: "non-cash",
    toNaira: LIFE_COVER,
    detail: "Cover recalculated against your current emoluments after the L5 promotion, bringing it back to the statutory minimum. The premium the company pays rose with it.",
    withinLast12Months: true,
  },
  {
    id: "RH-04", effective: "Jan 1, 2026", title: "HMO upgraded to family cover", kind: "non-cash",
    fromNaira: 540_000, toNaira: 780_000,
    detail: "Two dependants registered. The increase is what the company pays the provider, not a change to your pay.",
    withinLast12Months: true,
  },
  {
    id: "RH-05", effective: "May 1, 2025", title: "Promotion to L5 — Senior Software Engineer", kind: "cash",
    fromNaira: 17_400_000, toNaira: 21_480_000,
    document: "Employment contract v2 (L5 promotion) · PDF · May 2025",
    detail: "Following the Q1 2026 review outcome. Annual cash rose 23.4% and every statutory contribution rose with it. Contract v2 is in your documents.",
    withinLast12Months: false,
  },
];

export const recentRewardHistory = (): RewardChange[] => MY_REWARD_HISTORY.filter((c) => c.withinLast12Months);

/* ------------------------------ exclusions -------------------------------- */

/**
 * WHAT IS NOT ON THIS STATEMENT, AND WHY (R5).
 *
 * Note that this list names CONCEPTS and carries no figures. The numbers behind
 * the first row exist in Retention.tsx and are deliberately not repeated here —
 * a file that lists an excluded value "for reference" has not excluded it.
 */
export type RewardExclusion = { item: string; livesIn: string; why: string };

export const REWARDS_EXCLUSIONS: RewardExclusion[] = [
  {
    item: "Your position against the external market band for your grade",
    livesIn: "HR retention analysis",
    why: "It is the company's read of its own exposure, held for a pay decision it has not made. Putting it on your reward statement would mean the employer opening a negotiation, against itself, on a page you came to for a summary of what you have. If a pay decision is made, the change appears in your history as a change — which is the honest moment to tell you.",
  },
  {
    item: "Your leave-risk score",
    livesIn: "HR retention analysis · HRBP visibility only",
    why: "A prediction about whether you will resign is not a reward, and is not released to you. The same fence keeps it off /my-profile.",
  },
  {
    item: "Your manager's calibration narrative and rating recommendation",
    livesIn: "Review cycle, until calibration closes",
    why: "Shared with you after calibration, through the review page, by your manager. Not smuggled onto a money page ahead of that conversation.",
  },
  {
    item: "Any colleague's pay, band position, or reward statement",
    livesIn: "Nowhere reachable from this module",
    why: "There is no accessor here that takes an employee id (R4). A statement you can request for someone else is a comp database with a friendly face.",
  },
  {
    item: "What your reward will be next year",
    livesIn: "Nowhere — it does not exist yet",
    why: "A projected figure on a statement reads as a commitment. This page shows what is true today and what changed, and nothing else.",
  },
];

/* --------------------------- access logging ------------------------------- */

/**
 * A reward statement is a sensitive read, including when the reader is the
 * subject. The log is shown TO HER — it is the transparency half of /my-privacy
 * applied to money: she can see every person who has opened her statement.
 */
export type RewardAccess = { at: string; who: string; action: string; lawfulBasis: string };

export const MY_REWARDS_ACCESS_LOG: RewardAccess[] = [
  { at: "Aug 28 · 08:31", who: "You · Amara Okonkwo", action: "opened your total reward statement", lawfulBasis: "Subject access — your own record" },
  { at: "Aug 26 · 14:12", who: "People Ops · Funke Adebayo", action: "generated the statement for the August cycle", lawfulBasis: "Contract administration" },
  { at: "Aug 12 · 09:40", who: "Finance · Kemi Salami", action: "viewed benefit cost lines only — no pay detail", lawfulBasis: "Benefit provider reconciliation" },
];

export const REWARDS_ACCESS_NOTE =
  "Every open of this statement is logged, including your own, and the log is shown to you. Your manager is not on this list and cannot be — a reward statement is not a manager surface.";
