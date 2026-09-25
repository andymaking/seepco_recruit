"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  MY_REWARD_COMPONENTS, MY_REWARDS, MY_COVER, MY_REWARD_HISTORY, REWARDS_EXCLUSIONS,
  MY_REWARDS_ACCESS_LOG, REWARDS_ACCESS_NOTE, REWARDS_TODAY,
  EXPENSE_POLICY, PER_DIEM_LIST, CLAIMS, POLICY_AUDIT,
  RECEIPT_THRESHOLD, CLAIM_WINDOW_DAYS, PAYMENT_DAY, APPROVAL_THRESHOLD,
  HANDOFF_NOTE, PAYROLL_ROUTE, nairaExact,
  ANNUAL_CASH, PENSIONABLE_EMOLUMENTS, EMPLOYER_PENSION_PCT, EMPLOYER_PENSION,
  HMO_COVER, LIFE_PREMIUM, LIFE_COVER, LEAVE_VALUE,
  type RewardComponent, type ExpenseLine,
} from "@/data/rewards";
import {
  WORKERS, WORKER_TYPE_LABEL, ALL_WORKERS, workerById, companyById, countsByType,
  type WorkerType,
} from "@/data/workforce";
import { onLeave } from "@/data/presence";
import { DEPARTMENTS, EMPLOYEES } from "@/data/talentos";
import { LND_ENTITLEMENT } from "@/data/onboarding";
import { naira } from "@/data/requisitions";
import { MODEL_CARDS, AI_SURFACES, type WhyThis } from "@/data/trust";

/**
 * Reward programme — the HR / Reward-team surface for FR-097.
 *
 * MyRewards is one person reading her own statement. THIS page is the other
 * side of the same wall: the people who design the programme, pay for it, and
 * have to get it in front of everyone it covers. Three questions, three tabs.
 *
 *   1. PROGRAMME   — what the company offers, what the rule actually says, and
 *                    who each component reaches. FR-082 worker types make the
 *                    last one expressible for the first time: a contractor does
 *                    not get the L&D pool or the HMO, and until now the product
 *                    had no way to say so without saying it in a footnote.
 *   2. COST & TAKE-UP — what it costs, who is using it, and where the spend is
 *                    not landing. NOTHING on that tab is a model. Every figure
 *                    is either a read off the spine or an arithmetic step over
 *                    one, and each one shows its working. R2 in rewards.ts says
 *                    the expense engine is a rule check and not a model; the
 *                    same discipline applies to a cost model.
 *   3. DELIVERY    — who has actually opened their statement. The register
 *                    holds RECEIPTS, never contents. It can tell you Amara
 *                    opened hers at 08:31; it cannot tell you what is on it,
 *                    and there is no accessor in this module that could —
 *                    MY_REWARDS is one statement, reachable one way (R4).
 *
 * WHERE BANDS LIVE. Market position is legitimately HR's work and it belongs
 * here. It does NOT belong on an employee's own statement — REWARDS_EXCLUSIONS
 * says why, in the data layer, and this page renders that fence rather than
 * quietly leaning on it.
 *
 * VENDOR-NEUTRAL. Cost figures here are a planning read, not a ledger. Money
 * leaves through the payroll_connector contract and the ledger lives in your
 * payroll system. No vendor is named on this page.
 *
 * Deterministic: no Date.now(), no Math.random(). Reference day is Aug 28, 2026.
 */

/* ================================= helpers ================================= */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const ACTOR = "People Ops · Funke Adebayo";
const CYCLE = "Aug 2026";
const NEXT_CYCLE = "Sep 2026";

/**
 * `naira()` renders millions and has no billion scale — it turns the org cash
 * figure into "₦5376M". This delegates to it below a billion and adds the one
 * scale it is missing. It is not a second formatter for anything smaller.
 */
const nairaBn = (n: number): string =>
  n >= 1_000_000_000 ? `₦${(n / 1_000_000_000).toFixed(2)}bn` : naira(n);

const pct = (a: number, b: number): number => (b === 0 ? 0 : Math.round((a / b) * 100));

const fieldStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 10px", outline: "none", width: "100%",
};

/* ---------------------------- the org cash read ---------------------------- */

/** DEPARTMENTS.cost is a MONTHLY figure (Headcount.tsx labels it "Cost / month"). */
const DEPT_ROWS = DEPARTMENTS.map((d) => {
  const monthly = Number(d.cost.replace(/[^\d]/g, "")) * 1_000_000;
  return {
    name: d.name, head: d.head, loc: d.loc, headcount: d.headcount, target: d.target,
    monthly, annual: monthly * 12, perHead: Math.round((monthly * 12) / d.headcount),
  };
});

const TOTAL_HEADS = DEPT_ROWS.reduce((a, d) => a + d.headcount, 0);
const ANNUAL_CASH_ORG = DEPT_ROWS.reduce((a, d) => a + d.annual, 0);

/** The published rules, expressed as ratios so they can be applied to a payroll. */
const PENSIONABLE_RATIO = PENSIONABLE_EMOLUMENTS / ANNUAL_CASH; // 0.9667 — data allowance sits outside
const LIFE_RATIO = LIFE_PREMIUM / ANNUAL_CASH; // 0.75% of cash
const HMO_FAMILY = HMO_COVER;
/** The single-cover price, read off the January uplift rather than typed in again. */
const HMO_SINGLE = MY_REWARD_HISTORY.find((h) => h.id === "RH-04")?.fromNaira ?? 540_000;

/** The only worker-type mix the platform holds: 14 rows, 8 of them employees. */
const MIX_ROWS = WORKERS.filter((w) => w.analytics.headcount);
const MIX_EMPLOYEES = MIX_ROWS.filter((w) => w.workerType === "employee");
const DEFAULT_ELIGIBLE = Math.round((TOTAL_HEADS * MIX_EMPLOYEES.length) / MIX_ROWS.length);

/* ------------------------------ the L&D pool ------------------------------- */

const POOL = LND_ENTITLEMENT.poolNaira;
/** 38% — the figure the learning hub already runs on. Kept identical on purpose. */
const POOL_DRAWN_PCT = 38;
const POOL_DRAWN = Math.round(POOL * (POOL_DRAWN_PCT / 100));
const POOL_LEFT = POOL - POOL_DRAWN;
const MONTHS_LEFT = 4; // Aug 28 → 31 Dec

/* ------------------------- claims, read as take-up ------------------------- */

type CatTakeUp = {
  key: string; name: string; icon: string; cap: number; capBasis: string;
  lines: (ExpenseLine & { claimId: string; claimant: string })[];
  total: number;
};

const CATEGORY_TAKEUP: CatTakeUp[] = EXPENSE_POLICY.map((p) => {
  const lines = CLAIMS.flatMap((c) =>
    c.lines.filter((l) => l.category === p.key).map((l) => ({ ...l, claimId: c.id, claimant: c.claimant })),
  );
  return {
    key: p.key, name: p.name, icon: p.icon, cap: p.cap, capBasis: p.capBasis,
    lines, total: lines.reduce((a, l) => a + l.amountNaira, 0),
  };
});

const CLAIMED_TOTAL = CATEGORY_TAKEUP.reduce((a, c) => a + c.total, 0);
const CLAIMED_LINES = CATEGORY_TAKEUP.reduce((a, c) => a + c.lines.length, 0);
const PER_DIEM_ROW = CATEGORY_TAKEUP.find((c) => c.key === "per-diem")!;
const MEDICAL_ROW = CATEGORY_TAKEUP.find((c) => c.key === "medical")!;
const AUDIT = POLICY_AUDIT();

/** The largest claim on file, found rather than named. It belongs to a contractor. */
const BIGGEST_CLAIM = CLAIMS.reduce((a, c) => (c.totalNaira > a.totalNaira ? c : a), CLAIMS[0]);

/** Who has ever put a claim in, by worker type. */
const TYPE_TAKEUP = countsByType().map((t) => {
  const claimants = new Set(
    CLAIMS.filter((c) => workerById(c.claimantId)?.workerType === t.type).map((c) => c.claimantId),
  );
  return { type: t.type, n: t.n, claimants: claimants.size, claims: CLAIMS.filter((c) => workerById(c.claimantId)?.workerType === t.type).length };
});

/* ========================== programme definition =========================== */

type Reach = "yes" | "no" | "elsewhere";
type Cell = { v: Reach; why: string };
type ProgKind = "Cash" | "Non-cash" | "Reimbursement";

type ProgrammeRow = {
  id: string; name: string; icon: string; tone: PfTone; kind: ProgKind;
  rule: string;
  refValue?: number;
  refNote?: string;
  byType: Record<WorkerType, Cell>;
};

const REACH_META: Record<Reach, { label: string; tone: PfTone; icon: string }> = {
  yes: { label: "Covered", tone: "green", icon: "check" },
  no: { label: "Not covered", tone: "red", icon: "x" },
  elsewhere: { label: "Held by their employer", tone: "blue", icon: "swap" },
};

/**
 * The eligibility matrix. The rule is the company's; the worker-type column is
 * what FR-082 added. Every cell carries its reason, because a matrix of ticks
 * with no reasons is how a programme ends up with rules nobody chose.
 */
const PROGRAMME: ProgrammeRow[] = [
  {
    id: "P-cash", name: "Cash pay & allowances", icon: "wallet", tone: "green", kind: "Cash",
    rule: `Basic, housing, transport and the data allowance, paid on the ${PAYMENT_DAY}th. PAYE and pension come off at source.`,
    refValue: ANNUAL_CASH,
    refNote: "The L5 worked example — basic ₦14.4M, housing ₦4.32M, transport ₦2.16M, data ₦720k.",
    byType: {
      employee: { v: "yes", why: "Held here as contract terms and paid through the connected payroll source. This platform records the terms; it does not run the payroll." },
      contractor: { v: "elsewhere", why: "Their rate is a term of the service contract and sits with their contracting company. Hirebrew does not hold it, and should not — a platform that holds a contractor's rate has quietly become a second employer of record." },
      agency: { v: "elsewhere", why: "Paid by the agency against a placement rate. We hold the assignment and the site clearance, not the pay." },
      nysc: { v: "elsewhere", why: "The federal allowance plus whatever the PPA adds. Neither figure is a company reward line, and neither belongs in this cost model." },
      alumni: { v: "no", why: "Employment ended. Nothing accrues after the exit date, which is the one date an exit letter must get right." },
    },
  },
  {
    id: "P-pension", name: `Employer pension — ${EMPLOYER_PENSION_PCT}%`, icon: "shield", tone: "blue", kind: "Non-cash",
    rule: "Pension Reform Act 2014 · 10% of basic + housing + transport. The data allowance is outside the pension base, which is why the pensionable figure is never the gross.",
    refValue: EMPLOYER_PENSION,
    refNote: `10% of ${nairaExact(PENSIONABLE_EMOLUMENTS)} pensionable emoluments, paid on top of salary and not out of it.`,
    byType: {
      employee: { v: "yes", why: "Remitted into the employee's RSA on top of salary. It is theirs, and it moves with them to the next employer." },
      contractor: { v: "elsewhere", why: "Remitted by their contracting company. Two employers cannot both remit against the same RSA, and the one that should is the one holding the contract of employment." },
      agency: { v: "elsewhere", why: "The agency is the employer of record and carries the obligation. Check it at onboarding — that is a compliance question, not a reward one." },
      nysc: { v: "no", why: "NYSC service is not pensionable employment. There is often no RSA open at all, which is worth saying out loud at the end of the service year rather than discovering at the first payslip." },
      alumni: { v: "no", why: "Contributions stop at exit. The balance is theirs and needs nothing from us." },
    },
  },
  {
    id: "P-hmo", name: "Medical cover — HMO", icon: "heart", tone: "blue", kind: "Non-cash",
    rule: "Company-paid plan, single or family. The company pays the provider directly; the employee never sees an invoice.",
    refValue: HMO_FAMILY,
    refNote: `Family plan — employee plus registered dependants. Single cover is ${nairaExact(HMO_SINGLE)}; the gap between the two is the whole cost question on this line.`,
    byType: {
      employee: { v: "yes", why: "Employee plus registered dependants, on the plan they are enrolled on." },
      contractor: { v: "no", why: "Not covered. HSE arranges a fitness-to-work medical for site access and workers read that as cover — it is a clearance, and it pays for nothing when someone is ill." },
      agency: { v: "no", why: "Not covered. Same conflation with the site medical, same correction needed at induction." },
      nysc: { v: "no", why: "Not covered — the scheme carries its own health provision. A one-line note at posting would stop the question being asked in month three." },
      alumni: { v: "no", why: "Ends on the exit date. The date, not the month — this is the single most-argued line in an exit conversation." },
    },
  },
  {
    id: "P-life", name: "Group life assurance", icon: "shield", tone: "blue", kind: "Non-cash",
    rule: "Premium paid by the company; cover restated at 3× annual emoluments, the statutory minimum under the Pension Reform Act.",
    refValue: LIFE_PREMIUM,
    refNote: `The premium. The cover it buys is ${naira(LIFE_COVER)} — a benefit whose size is nothing like its cost, which is why both numbers have to be shown.`,
    byType: {
      employee: { v: "yes", why: "Cover recalculated whenever emoluments change, so a promotion moves it without anyone asking." },
      contractor: { v: "no", why: "Their contracting company's policy. Ask for the certificate at mobilisation — it is a contract term to verify, not a reward line to publish." },
      agency: { v: "no", why: "The agency's policy, verified at mobilisation like the contractor's." },
      nysc: { v: "no", why: "Not covered by the company scheme." },
      alumni: { v: "no", why: "Cover ends with employment." },
    },
  },
  {
    id: "P-lnd", name: "Learning & development entitlement", icon: "book", tone: "purple", kind: "Non-cash",
    rule: `Company pool of ${naira(POOL)} for the year, drawn as an entitlement rather than expensed. The manager approves anything over ${nairaExact(LND_ENTITLEMENT.approverThreshold)}.`,
    refValue: LND_ENTITLEMENT.yourDraw,
    refNote: "Valued at what has actually been drawn, which on the L5 example is ₦0. An entitlement nobody draws costs nothing and is worth nothing.",
    byType: {
      employee: { v: "yes", why: "Drawn against the company pool. Courses are never expensed, so nobody is ever out of pocket waiting for a reimbursement." },
      contractor: { v: "no", why: "Excluded. Their development is their contracting company's cost, and that is a defensible line to hold." },
      agency: { v: "no", why: "Excluded on the same reasoning." },
      nysc: { v: "no", why: "Excluded — and this one is not a decision anybody made. It is what the phrase “employee entitlement” does by default. An intern posted for a year is the cheapest development this company will ever buy, and the rule currently says no. Worth a decision either way." },
      alumni: { v: "no", why: "Ends at exit, along with access to the catalogue." },
    },
  },
  {
    id: "P-leave", name: "Paid annual leave", icon: "calendar", tone: "grey", kind: "Non-cash",
    rule: "20 days, plus up to 5 carried and expiring 31 March. Already inside base salary — valued for visibility and never added to a total.",
    refValue: LEAVE_VALUE,
    refNote: "Shown, never counted. Adding it would inflate every statement by the same money twice, and someone would eventually quote the inflated figure in a negotiation.",
    byType: {
      employee: { v: "yes", why: "Accrued and recorded against the leave register." },
      contractor: { v: "no", why: "Off-tour time on a 28/28 rotation is not leave and must never be recorded as leave. It is the half of the rotation they are not working, and calling it leave creates an entitlement out of a roster." },
      agency: { v: "no", why: "Same rule. Rotation off-days are roster, not entitlement." },
      nysc: { v: "elsewhere", why: "The scheme sets the days, not the company. We record the absence; we do not grant it." },
      alumni: { v: "no", why: "Accrual stops at exit; any balance is settled in the final payment by the payroll source." },
    },
  },
  {
    id: "P-perdiem", name: "Per-diem at the zone rate", icon: "swap", tone: "yellow", kind: "Reimbursement",
    rule: "A published daily rate by zone — offshore ₦35,000, onshore ₦25,000, city ₦18,000 — paid for every day of the posting whether or not it is spent. A rate is not a reimbursement, so there is no receipt to chase.",
    byType: {
      employee: { v: "yes", why: "At the zone rate for wherever they are posted." },
      contractor: { v: "yes", why: "Proved rather than asserted: EX-2078 is a contractor's 28-day Bonga tour at ₦35,000 a day. The largest single routine claim in the company belongs to someone the v2.0 person record could not even represent." },
      agency: { v: "yes", why: "Eligible on identical terms. Three agency workers sit on the roster and have claimed nothing all year — see the take-up tab, because eligible on paper is not the same as reached." },
      nysc: { v: "yes", why: "Eligible when posted away from base. Also the population least likely to know it, and least likely to ask." },
      alumni: { v: "no", why: "No postings after exit." },
    },
  },
  {
    id: "P-expenses", name: "Expense reimbursement", icon: "clipboard", tone: "green", kind: "Reimbursement",
    rule: `Nine categories with published caps. Receipts above ${nairaExact(RECEIPT_THRESHOLD)}, claims inside ${CLAIM_WINDOW_DAYS} days of the spend, manager approval, and Finance as a genuinely separate second approval over ${nairaExact(APPROVAL_THRESHOLD)}.`,
    byType: {
      employee: { v: "yes", why: "Full category list, subject to the caps and the exclusions." },
      contractor: { v: "yes", why: "Yes for cost incurred doing the work — the heliport transfer on EX-2078 is exactly that." },
      agency: { v: "yes", why: "Same terms. Zero claims on file, which is a finding rather than a fact about their spending." },
      nysc: { v: "yes", why: "Same terms, and the same silence: no claim has ever been filed by an intern." },
      alumni: { v: "no", why: "The claim window closes with the employment. A late claim from an alumnus is a payroll conversation, not a platform one." },
    },
  },
  {
    id: "P-homeoffice", name: "Home-office equipment", icon: "stack", tone: "green", kind: "Reimbursement",
    rule: "₦350,000 per calendar year for desk, chair, monitor and peripherals. Laptops and phones are provisioned by IT and never claimed (PX-05).",
    byType: {
      employee: { v: "yes", why: "Once a calendar year, against the cap." },
      contractor: { v: "no", why: "Site kit arrives through the contract, not through expenses." },
      agency: { v: "no", why: "Provided by the agency or by the site." },
      nysc: { v: "no", why: "Provisioned if at all. An intern buying their own desk is a policy failure, not a claim to process." },
      alumni: { v: "no", why: "Equipment returns at exit; nothing is bought after it." },
    },
  },
];

const WORKER_TYPES: WorkerType[] = ["employee", "contractor", "agency", "nysc", "alumni"];

/* ------------------------------ grade bands -------------------------------- */

type GradeBand = {
  grade: string; median?: number; source?: string; n?: number; note: string;
};

/**
 * The benchmarks the company actually holds. Two of them. Both are lifted from
 * the retention analysis (PB-31 and PB-29) rather than re-sourced here, so a
 * band figure has exactly one home in the product.
 */
const BANDS: GradeBand[] = [
  { grade: "L3", note: "No benchmark held. The band is an internal ladder position and nothing more." },
  { grade: "L4", note: "No benchmark held. Two people sit on it." },
  { grade: "L5", median: 24_500_000, source: "Lagos tech market · Jun 2026", n: 142, note: "The worked example sits at ₦21.6M against this median — 12% below band. That is HR's read, held for a pay decision the company has not made." },
  { grade: "M1", note: "No benchmark held, and three people sit on it — the largest unbenchmarked grade in the sample." },
  { grade: "M2", median: 18_200_000, source: "PH energy market · Jun 2026", n: 87, note: "The one grade where the company is at band: ₦18.4M against a ₦18.2M median, +1%." },
  { grade: "C2", note: "Contractor grade. There is no company band to be at or below — the rate is a contract term held by the contracting company." },
];

const gradeCount = (g: string) => EMPLOYEES.filter((e) => e.grade === g).length;

/* ------------------------------- findings ---------------------------------- */

type Finding = {
  id: string; title: string; figure: string; tone: PfTone;
  body: string; inputs: string[]; action: string;
};

/* ================================ small parts ============================== */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase" }}>{children}</div>;
}

/** FR-093, rendered identically wherever a model produced something. */
function WhyThisPanel({ why, card }: { why: WhyThis; card: string }) {
  const go = useGo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-purple-500)" />
        Why this?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{why.claim}</div>
          <div style={{ margin: "11px 0 6px" }}><Label>Basis</Label></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {why.basis.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
            <button
              onClick={() => go("trust")}
              title="Model card index — Trust center"
              style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
            >
              <Ic name="robot" size={12} color="var(--pf-purple-500)" />
              Model card {why.modelCard} · {card}
            </button>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Human gate: {why.humanGate.toLowerCase()}</span>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The counterweight, and the more common one on this page. A deterministic
 * figure gets its working shown in green — visually unmistakable from anything
 * a model touched, which is purple everywhere in this product.
 */
function HowPanel({ claim, steps, note }: { claim: string; steps: string[]; note?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-600)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-primary-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="gauge" size={12} color="var(--pf-primary-600)" />
        How this is computed
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-primary-600)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{claim}</div>
          <div style={{ margin: "11px 0 6px" }}><Label>Working</Label></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {steps.map((s, i) => (
              <div key={s} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: "var(--pf-n300)", paddingTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-primary-100)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
            {note ?? "No model was involved. This is arithmetic over the rows named above, and it will produce the same answer every time it runs."}
          </div>
        </div>
      )}
    </>
  );
}

/** Anything a model produced is purple and labelled. Nothing else on this page is. */
function AiBlock({ label, chip, children, why }: { label: string; chip?: string; children: ReactNode; why?: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--pf-purple-100)", background: "var(--pf-purple-50)", borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>{label}</span>
        {chip && <PfBadge tone="purple">{chip}</PfBadge>}
        <span style={{ flex: 1 }} />
        {why}
      </div>
      {children}
    </div>
  );
}

function Stepper({ label, value, hint, onDec, onInc }: {
  label: string; value: string; hint: string; onDec: () => void; onInc: () => void;
}) {
  return (
    <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px", background: "var(--pf-n0)" }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
        <button onClick={onDec} style={{ fontFamily: "inherit", width: 26, height: 26, borderRadius: 7, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", color: "var(--pf-n600)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Ic name="x" size={11} />
        </button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{value}</span>
        <button onClick={onInc} style={{ fontFamily: "inherit", width: 26, height: 26, borderRadius: 7, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", color: "var(--pf-n600)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Ic name="plus" size={12} />
        </button>
      </div>
      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}

function MatrixCell({ cell, dim, on, onPick }: { cell: Cell; dim: boolean; on: boolean; onPick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const m = REACH_META[cell.v];
  return (
    <button
      {...hoverProps}
      onClick={onPick}
      title={cell.why}
      style={{
        fontFamily: "inherit", cursor: "pointer", border: "none", borderLeft: "1px solid var(--pf-n50)",
        padding: "10px 8px", display: "flex", alignItems: "center", justifyContent: "center",
        background: on ? TONE[m.tone].soft : hovered ? "var(--pf-n25)" : "transparent",
        opacity: dim ? 0.3 : 1, transition: "background .12s ease, opacity .12s ease",
        boxShadow: on ? `inset 0 0 0 1.5px ${TONE[m.tone].fg}` : "none",
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 6, background: TONE[m.tone].soft, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <Ic name={m.icon} size={12} color={TONE[m.tone].fg} weight={2.3} />
      </span>
    </button>
  );
}

function Bar({ pctOf, tone, label, value, on, onPick }: {
  pctOf: number; tone: PfTone; label: string; value: string; on: boolean; onPick: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onPick}
      style={{
        fontFamily: "inherit", textAlign: "left", width: "100%", cursor: "pointer", border: "none",
        background: on || hovered ? "var(--pf-n25)" : "transparent", padding: "9px 20px",
        borderTop: "1px solid var(--pf-n50)", display: "block", transition: "background .12s ease",
        boxShadow: on ? "inset 3px 0 0 var(--pf-n900)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: on ? 600 : 500, color: "var(--pf-n900)", width: 210, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ flex: 1 }}>
          <PfProgress pct={pctOf} tone={pctOf === 0 ? "grey" : tone} height={8} />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: pctOf === 0 ? "var(--pf-n300)" : "var(--pf-n900)", width: 96, textAlign: "right", flex: "none" }}>{value}</span>
      </div>
    </button>
  );
}

/* ================================== screen ================================= */

export default function Rewards() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("programme");

  /* --- programme tab --- */
  const [progRow, setProgRow] = useState<string>(PROGRAMME[4].id);
  const [progType, setProgType] = useState<WorkerType | "all">("all");
  const [diffOnly, setDiffOnly] = useState(false);
  const [cell, setCell] = useState<{ row: string; type: WorkerType } | null>(null);
  const [grade, setGrade] = useState("L5");
  const [comp, setComp] = useState<RewardComponent | null>(null);

  /* --- cost tab --- */
  const [eligible, setEligible] = useState(DEFAULT_ELIGIBLE);
  const [familyPct, setFamilyPct] = useState(50);
  const [sortKey, setSortKey] = useState<"headcount" | "annual" | "perHead">("annual");
  const [cat, setCat] = useState<string | null>("medical");
  const [openFinding, setOpenFinding] = useState<string | null>("F-2");

  /* --- delivery tab --- */
  const OPENED_AT = MY_REWARDS_ACCESS_LOG.find((r) => r.who.startsWith("You"))?.at ?? "Aug 28 · 08:31";
  const GENERATED_AT = MY_REWARDS_ACCESS_LOG.find((r) => r.action.includes("generated"))?.at ?? "Aug 26 · 14:12";

  const [reminded, setReminded] = useState<string[]>([]);
  const [dFilter, setDFilter] = useState<"all" | "opened" | "waiting">("all");
  const [cycleState, setCycleState] = useState<"Not started" | "Generated" | "Published">("Not started");
  const [note, setNote] = useState("");
  const [noteApproved, setNoteApproved] = useState(false);
  const [log, setLog] = useState(MY_REWARDS_ACCESS_LOG);

  /* ------------------------------ derived ---------------------------------- */

  const model = useMemo(() => {
    const employeeCash = ANNUAL_CASH_ORG * (eligible / TOTAL_HEADS);
    const pension = Math.round(employeeCash * PENSIONABLE_RATIO * (EMPLOYER_PENSION_PCT / 100));
    const hmo = Math.round(eligible * ((familyPct / 100) * HMO_FAMILY + (1 - familyPct / 100) * HMO_SINGLE));
    const life = Math.round(employeeCash * LIFE_RATIO);
    const lnd = POOL;
    const nonCash = pension + hmo + life + lnd;
    const total = ANNUAL_CASH_ORG + nonCash;
    return {
      employeeCash: Math.round(employeeCash), pension, hmo, life, lnd, nonCash, total,
      nonCashPct: Math.round((nonCash / total) * 1000) / 10,
      uncovered: TOTAL_HEADS - eligible,
      perHeadPool: Math.round(POOL / eligible),
    };
  }, [eligible, familyPct]);

  const eligibleRoster = useMemo(
    () =>
      WORKERS.filter((w) => w.workerType === "employee")
        .map((w) => ALL_WORKERS.find((p) => p.id === w.id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [],
  );

  const notEligible = useMemo(
    () =>
      WORKERS.filter((w) => w.workerType !== "employee")
        .map((w) => ({ w, p: ALL_WORKERS.find((x) => x.id === w.id) }))
        .filter((r): r is { w: (typeof WORKERS)[number]; p: NonNullable<(typeof ALL_WORKERS)[number]> } => Boolean(r.p)),
    [],
  );

  /**
   * The one receipt the platform genuinely holds: the subject opened her own
   * statement, and the access log says so. Publishing the next cycle resets the
   * count, because nobody has opened the new one yet — which is the truth, not
   * a regression.
   */
  const AUG_OPENED = MY_REWARDS_ACCESS_LOG.filter((r) => r.action.includes("opened your total reward statement")).length;
  const openedIds = cycleState === "Published" ? [] : ["E-0214"];
  const publishedCount = eligibleRoster.length;
  const openedCount = openedIds.length;
  const liveCycle = cycleState === "Published" ? NEXT_CYCLE : CYCLE;

  const deliveryRows = eligibleRoster
    .map((p) => {
      const opened = openedIds.includes(p.id);
      const emp = EMPLOYEES.find((e) => e.id === p.id);
      const away = onLeave(p.id, "2026-08-28");
      let flag = "";
      if (emp?.status === "onboarding") flag = "First statement — one month of the year, annualised, and the covering note has to say so or it reads as a pay cut.";
      else if (emp?.status === "notice") flag = "On notice. Still entitled to the statement, and this is the last one they will get.";
      else if (away) flag = "On leave today. The reminder will sit until they are back — a nudge into an out-of-office is a nudge nobody reads.";
      return { p, emp, opened, away, flag };
    })
    .filter((r) => (dFilter === "all" ? true : dFilter === "opened" ? r.opened : !r.opened));

  const FINDINGS: Finding[] = useMemo(
    () => [
      {
        id: "F-1",
        title: "Medical (non-covered) — a category nobody has ever used",
        figure: `0 claims · ${nairaExact(MEDICAL_ROW.cap)} cap`,
        tone: "red",
        body:
          "Either the HMO has declined nothing in writing all year, or nobody knows the category exists and people are paying for declined treatment themselves. Only one of those is good news, and the claims register cannot tell you which — it only records what arrived.",
        inputs: [
          `${CLAIMED_LINES} expense lines across ${CLAIMS.length} claims on file.`,
          "Zero of them sit in the medical (non-covered) category.",
          "The category requires a written HMO decline as its receipt — a document the employee has to have been given.",
        ],
        action: "Ask the provider for this year's declines file",
      },
      {
        id: "F-2",
        title: "The learning pool is a tenth of its own approval threshold",
        figure: `${nairaExact(model.perHeadPool)} a head vs a ${nairaExact(LND_ENTITLEMENT.approverThreshold)} threshold`,
        tone: "red",
        body:
          "The manager-approval line was set at ₦120,000 to catch the expensive requests. Divided across the eligible population the pool is worth about a tenth of that per person — so the control guards a budget the company does not have. 38% take-up is not the finding here. The size of the pool is the finding.",
        inputs: [
          `Pool: ${naira(POOL)} for the year (LND_ENTITLEMENT — the company-wide figure, not a departmental one).`,
          `Eligible population in the model: ${eligible} employees.`,
          `${naira(POOL)} ÷ ${eligible} = ${nairaExact(model.perHeadPool)} per employee per year.`,
          `Against annual cash of ${nairaBn(ANNUAL_CASH_ORG)}, the pool is ${(POOL / ANNUAL_CASH_ORG * 100).toFixed(2)}% of reward.`,
        ],
        action: "Put a pool figure in the next budget round",
      },
      {
        id: "F-3",
        title: "Per-diem is the biggest cash-out in the programme, on three lines",
        figure: `${pct(PER_DIEM_ROW.total, CLAIMED_TOTAL)}% of everything claimed`,
        tone: "yellow",
        body:
          "Move a zone rate and you move more money than any other cap in the programme can. One offshore tour carried ₦980,000 on a single line. Every other category put together is smaller than this one, and per-diem is the category with no receipts to audit — by design, because a rate is not a reimbursement.",
        inputs: [
          `${nairaExact(PER_DIEM_ROW.total)} across ${PER_DIEM_ROW.lines.length} lines, out of ${nairaExact(CLAIMED_TOTAL)} across ${CLAIMED_LINES}.`,
          "Three zones are in use: offshore ₦35,000, onshore ₦25,000 and city ₦18,000 a day.",
          "The largest single line is a 28-day offshore tour at the top zone rate.",
        ],
        action: "Schedule the zone-rate review",
      },
      {
        id: "F-4",
        title: `Non-cash reaches ${MY_REWARDS.nonCashPct}% of a statement and ${model.nonCashPct}% of the programme`,
        figure: `${MY_REWARDS.nonCashPct}% vs ${model.nonCashPct}%`,
        tone: "blue",
        body:
          `The gap is not an accounting artefact. It is ${model.uncovered} heads the benefit programme does not cover at all — contractors, agency staff and interns whose pension, cover and learning sit with somebody else. Every per-head benefit average this company quotes is quietly computed over the wrong denominator.`,
        inputs: [
          `The L5 worked example: ${nairaExact(MY_REWARDS.nonCashNaira)} non-cash on ${nairaExact(MY_REWARDS.totalNaira)} total — ${MY_REWARDS.nonCashPct}%.`,
          `The modelled programme: ${nairaBn(model.nonCash)} non-cash on ${nairaBn(model.total)} — ${model.nonCashPct}%.`,
          `${TOTAL_HEADS} in headcount, ${eligible} of them inside the benefit programme.`,
        ],
        action: "Restate the benefit averages over eligible heads",
      },
      {
        id: "F-5",
        title: "Eligible on paper, silent in practice",
        figure: "0 claims from agency and NYSC workers",
        tone: "yellow",
        body:
          "Agency staff and the NYSC intern are eligible for per-diem and for expense reimbursement on identical terms to everyone else. Not one of them has filed a claim this year. That is either four people who have incurred nothing, or four people nobody told.",
        inputs: [
          `Roster: ${TYPE_TAKEUP.find((t) => t.type === "agency")?.n ?? 0} agency workers, ${TYPE_TAKEUP.find((t) => t.type === "nysc")?.n ?? 0} NYSC intern.`,
          "Claims filed by either group: zero.",
          "The eligibility matrix on the programme tab marks both groups covered for per-diem and expenses.",
        ],
        action: "Add the claim route to the site induction",
      },
      {
        id: "F-6",
        title: `${POOL_DRAWN_PCT}% of the pool drawn with ${MONTHS_LEFT} months left`,
        figure: `${nairaExact(POOL_LEFT)} unspent`,
        tone: "yellow",
        body:
          "Unspent learning budget does not roll over and does not come back as anything. The L5 on the staff-engineer track has drawn ₦0 of it — which is the same person the retention analysis is holding a pay case open for. Development is the cheaper half of that conversation and it is going unused.",
        inputs: [
          `${naira(POOL)} pool, ${POOL_DRAWN_PCT}% consumed — ${nairaExact(POOL_DRAWN)} drawn, ${nairaExact(POOL_LEFT)} left.`,
          `The worked example's own draw this year: ${nairaExact(LND_ENTITLEMENT.yourDraw)}.`,
          "Aug 28 to 31 December is four months of a twelve-month pool.",
        ],
        action: "Send the unspent-entitlement nudge",
      },
    ],
    [eligible, model],
  );

  /* ------------------------------ mutations -------------------------------- */

  const stamp = (n: number) => {
    const mins = 15 + n * 9;
    return `Aug 28 · ${String(9 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  };

  const audit = (action: string, basis: string) =>
    setLog((prev) => [{ at: stamp(prev.length), who: ACTOR, action, lawfulBasis: basis }, ...prev]);

  const generateCycle = () => {
    setCycleState("Generated");
    audit(`generated ${eligibleRoster.length} statements for the ${NEXT_CYCLE} cycle`, "Contract administration");
    toast(`${eligibleRoster.length} statements generated for ${NEXT_CYCLE} — nothing is visible to anyone until you publish`, "success");
  };

  const draftNote = () => {
    setNote(
      `Your ${NEXT_CYCLE} total reward statement is ready.\n\n` +
        `It sets out what the company provides for you this year — your cash pay, and what the company spends on your behalf on pension, medical cover, life assurance and your learning entitlement. On a Grade L5 example, ${MY_REWARDS.nonCashPct}% of the total is the second kind, and most people have never seen that number in one place.\n\n` +
        `${MY_REWARDS.caveat.replace(" (R6)", "")}\n\n` +
        `Nothing on the statement is a decision about your pay. If a line looks wrong, reply to this and People Ops will check it against your record.`,
    );
    setNoteApproved(false);
    toast("Cover note drafted by MC-05 — read it before it goes to anyone", "ai");
  };

  const approveNote = () => {
    if (!note.trim()) { toast("There is nothing to approve — draft or write the note first"); return; }
    setNoteApproved(true);
    audit("approved the cycle cover note", "Contract administration");
    toast(`Cover note approved by ${ACTOR} — attached to the ${NEXT_CYCLE} cycle`, "success");
  };

  const publishCycle = () => {
    if (cycleState === "Not started") { toast("Generate the statements first — there is nothing to publish"); return; }
    if (!noteApproved) { toast("The cover note has not been approved. A statement lands better with a sentence than without one."); return; }
    setCycleState("Published");
    audit(`published the ${NEXT_CYCLE} cycle to ${eligibleRoster.length} employees`, "Contract administration");
    toast(`${NEXT_CYCLE} published to ${eligibleRoster.length} employees — every open from here is logged and shown to the subject`, "success");
  };

  const remind = (id: string, name: string, away: boolean) => {
    if (reminded.includes(id)) { toast(`${name.split(" ")[0]} has already had one reminder. A second one is pressure, not a service.`); return; }
    setReminded((r) => [...r, id]);
    audit(`sent a statement reminder to ${name}`, "Contract administration");
    toast(
      away
        ? `Reminder queued for ${name} — held until they are back, not delivered into an out-of-office`
        : `Reminder sent to ${name} — receipt only, the message carries no figures`,
      "success",
    );
  };

  const regenerate = (name: string) => {
    audit(`regenerated the statement for ${name}`, "Contract administration");
    toast(`Statement regenerated for ${name} — the previous version stays on file with its own timestamp`, "success");
  };

  /* -------------------------------- lookups -------------------------------- */

  const row = PROGRAMME.find((r) => r.id === progRow) ?? PROGRAMME[0];
  const cellRow = cell ? PROGRAMME.find((r) => r.id === cell.row) : null;
  const cellData = cellRow && cell ? cellRow.byType[cell.type] : null;
  const band = BANDS.find((b) => b.grade === grade) ?? BANDS[2];
  const catRow = CATEGORY_TAKEUP.find((c) => c.key === cat);
  const sortedDepts = [...DEPT_ROWS].sort((a, b) => b[sortKey] - a[sortKey]);
  const maxDept = Math.max(...DEPT_ROWS.map((d) => d[sortKey]));

  const MC05 = MODEL_CARDS.find((m) => m.id === "MC-05")!;
  const AS10 = AI_SURFACES.find((s) => s.id === "AS-10")!;

  const noteWhy: WhyThis = {
    claim: `Draft cover note for the ${NEXT_CYCLE} statement cycle — one paragraph that goes to ${eligibleRoster.length} people identically.`,
    basis: [
      "Inputs: the published component catalogue, the cycle month, and the statement's own caveat text. Nothing else.",
      "Not used: any individual's pay, grade, band position, benchmark or person record. There is nothing personal in a note that is identical for every recipient, so the model was given nothing personal to read.",
      "The sentences about what a total-reward figure is are lifted verbatim from MY_REWARDS.caveat — the model did not write them and cannot soften them.",
      `The ${MY_REWARDS.nonCashPct}% figure was handed to the model as a fact from this page. It did not compute it.`,
    ],
    modelCard: "MC-05",
    humanGate: "People Ops edits and approves before publish; nothing publishes on an unapproved draft",
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Reward programme</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            What the company offers, what it costs, who it actually reaches, and who has read their statement. The employee-facing statement is one person’s own record; this is the programme behind it (FR-097).
          </div>
        </div>
        <PfBtn variant="secondary" icon="book" onClick={() => go("learning")}>Learning hub</PfBtn>
        <PfBtn variant="primary" icon="paperplane" onClick={() => setTab("delivery")}>Statement cycle</PfBtn>
      </div>

      {/* boundary strip — this page announces where it stops */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "9px 14px", marginBottom: 12 }}>
        <Ic name="wallet" size={15} color="var(--pf-n900)" />
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>reward_programme · planning read</span>
        <PfBadge tone="blue" dot>Not a ledger</PfBadge>
        <PfBadge tone="grey" dot>{PAYROLL_ROUTE}</PfBadge>
        <span style={{ fontSize: 12, color: "var(--pf-n500)", flex: 1, minWidth: 280 }}>
          Cost figures here plan a budget. They do not pay anyone — money leaves through the payroll_connector contract and the ledger stays in your payroll system.
        </span>
        <PfBtn small variant="secondary" icon="shield" onClick={() => go("trust")}>Trust center</PfBtn>
      </div>

      {/* KPIs — every number a read off the spine or arithmetic over one */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 4 }}>
        <PfStat
          icon="wallet" tone="green" label="Total reward cost" value={nairaBn(model.total)} unit="a year, modelled"
          delta={`${nairaBn(ANNUAL_CASH_ORG)} of it cash`} deltaTone="grey"
        />
        <PfStat
          icon="shield" tone="blue" label="Non-cash provision" value={nairaBn(model.nonCash)} unit="on top of cash"
          delta={`${model.nonCashPct}% of the programme`} deltaTone="blue"
        />
        <PfStat
          icon="book" tone="purple" label="L&D pool drawn" value={`${POOL_DRAWN_PCT}%`} unit={`of ${naira(POOL)}`}
          delta={`${nairaExact(POOL_LEFT)} unspent`} deltaTone="red"
        />
        <PfStat
          icon="paperplane" tone="yellow" label="Statements opened" value={`${openedCount} of ${publishedCount}`} unit={`${liveCycle} cycle`}
          delta={reminded.length ? `${reminded.length} reminded` : `${publishedCount - openedCount} waiting`} deltaTone={reminded.length ? "green" : "yellow"}
        />
      </div>

      {/* lead insight — the single most important true thing here */}
      <div style={{ marginTop: 12 }}>
        <PfBanner tone="red" icon="warning">
          The learning pool is {naira(POOL)} against {nairaBn(ANNUAL_CASH_ORG)} of annual cash — {(POOL / ANNUAL_CASH_ORG * 100).toFixed(2)}% of reward,
          or about {nairaExact(model.perHeadPool)} per eligible employee for the year. It is {POOL_DRAWN_PCT}% drawn with {MONTHS_LEFT} months left.
          Low take-up is not the finding. The size of the pool is.
        </PfBanner>
      </div>

      {/* tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "programme", label: "Programme design", count: String(PROGRAMME.length) },
            { key: "cost", label: "Cost & take-up", mono: nairaBn(model.total) },
            { key: "delivery", label: "Statement delivery", count: `${openedCount}/${publishedCount}` },
          ]}
        />
      </div>

      {/* ============================= PROGRAMME ============================= */}
      {tab === "programme" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* the eligibility matrix */}
          <PfCard>
            <PfCardHead
              title="What each component is, and who it reaches"
              sub="Nine components, five worker types. The rule column is the company’s policy; the worker-type columns are what FR-082 made expressible — before it, this table could only be written as a footnote."
            >
              <PfBtn
                small
                variant={diffOnly ? "primary" : "secondary"}
                icon="filter"
                onClick={() => { setDiffOnly((v) => !v); setProgType("all"); }}
              >
                {diffOnly ? "Showing differences" : "Differences from Employee"}
              </PfBtn>
            </PfCardHead>

            {/* column heads */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 92px)", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ padding: "10px 20px" }}><PfTh>COMPONENT</PfTh></div>
              {WORKER_TYPES.map((t) => {
                const n = countsByType().find((c) => c.type === t)?.n ?? 0;
                const on = progType === t;
                return (
                  <button
                    key={t}
                    onClick={() => setProgType((p) => (p === t ? "all" : t))}
                    style={{
                      fontFamily: "inherit", cursor: "pointer", border: "none", borderLeft: "1px solid var(--pf-n50)",
                      background: on ? "var(--pf-n0)" : "transparent", padding: "8px 6px", textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 11.5, fontWeight: on ? 700 : 500, color: on ? "var(--pf-n900)" : "var(--pf-n400)", lineHeight: 1.3 }}>
                      {WORKER_TYPE_LABEL[t]}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: "var(--pf-n300)", marginTop: 3 }}>{n} on file</div>
                  </button>
                );
              })}
            </div>

            {/* rows */}
            {PROGRAMME.map((r) => {
              const selected = progRow === r.id;
              return (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr repeat(5, 92px)", borderTop: "1px solid var(--pf-n50)", background: selected ? "var(--pf-n25)" : "transparent" }}>
                  <button
                    onClick={() => setProgRow(r.id)}
                    style={{ fontFamily: "inherit", textAlign: "left", cursor: "pointer", border: "none", background: "transparent", padding: "11px 20px", display: "flex", alignItems: "center", gap: 10, boxShadow: selected ? "inset 3px 0 0 var(--pf-n900)" : "none" }}
                  >
                    <PfTile icon={r.icon} tone={r.tone} size={26} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: selected ? 600 : 500, color: "var(--pf-n900)" }}>{r.name}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                        {r.kind}
                        {r.refValue !== undefined && ` · ${nairaExact(r.refValue)} at L5`}
                      </span>
                    </span>
                  </button>
                  {WORKER_TYPES.map((t) => {
                    const c = r.byType[t];
                    const differs = t !== "employee" && c.v !== r.byType.employee.v;
                    const dim = (progType !== "all" && progType !== t) || (diffOnly && t !== "employee" && !differs);
                    return (
                      <MatrixCell
                        key={t}
                        cell={c}
                        dim={dim}
                        on={cell?.row === r.id && cell?.type === t}
                        onPick={() => { setCell({ row: r.id, type: t }); setProgRow(r.id); }}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* the cell reason */}
            {cellRow && cellData && cell ? (
              <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "14px 20px", background: "var(--pf-n25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <PfBadge tone={REACH_META[cellData.v].tone} dot>{REACH_META[cellData.v].label}</PfBadge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{cellRow.name}</span>
                  <Ic name="caretright" size={12} color="var(--pf-n300)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{WORKER_TYPE_LABEL[cell.type]}</span>
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="ghost" icon="x" onClick={() => setCell(null)}>Close</PfBtn>
                </div>
                <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 9 }}>{cellData.why}</div>
              </div>
            ) : (
              <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "16px 20px", background: "var(--pf-n25)", display: "flex", alignItems: "center", gap: 10 }}>
                <Ic name="search" size={15} color="var(--pf-n300)" />
                <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>
                  Click any cell for the reason it holds. Every cell has one — a matrix of ticks with no reasons is how a programme ends up with rules nobody chose.
                </span>
              </div>
            )}
            <Foot icon="users">
              Reading the contractor and agency columns downward is the fastest description of the company’s liability there is: pay, pension and cover sit with the{" "}
              <b style={{ color: "var(--pf-n600)" }}>contracting company</b> ({companyById("CC-01")?.name}, {companyById("CC-02")?.name}, {companyById("CC-03")?.name} between them),
              while per-diem and expenses sit with us. Getting that boundary wrong in either direction is expensive.
            </Foot>
          </PfCard>

          {/* the selected row, in full */}
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title={row.name} sub={`${row.kind} component · ${row.id}`}>
                <PfBadge tone={row.tone}>{row.kind}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "14px 20px" }}>
                <Label>The rule</Label>
                <div style={{ fontSize: 13.5, color: "var(--pf-n900)", lineHeight: 1.7, marginTop: 7 }}>{row.rule}</div>
                {row.refValue !== undefined && (
                  <div style={{ marginTop: 14, border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{nairaExact(row.refValue)}</span>
                      <PfBadge tone="grey">Worked example · Grade L5</PfBadge>
                    </div>
                    {row.refNote && <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 8 }}>{row.refNote}</div>}
                  </div>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                  {WORKER_TYPES.map((t) => {
                    const c = row.byType[t];
                    const m = REACH_META[c.v];
                    return (
                      <button
                        key={t}
                        onClick={() => setCell({ row: row.id, type: t })}
                        style={{ fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: TONE[m.tone].fg, background: TONE[m.tone].soft, border: `0.6px solid ${TONE[m.tone].line}`, borderRadius: 5, padding: "3px 8px" }}
                      >
                        <Ic name={m.icon} size={11} color={TONE[m.tone].fg} weight={2.3} />
                        {WORKER_TYPE_LABEL[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Foot icon="info">
                The only statement this platform holds in full belongs to one person, so every figure above is that one worked example at Grade L5. The rule beside it is what generalises; the number is an illustration of it.
              </Foot>
            </PfCard>

            <PfCard>
              <PfCardHead title="The rules employees actually meet" sub="Four numbers people have to remember. Keeping them identical across expenses and learning was a design decision, not a coincidence." />
              <div style={{ padding: "6px 20px 14px" }}>
                {[
                  { k: "Receipt threshold", v: nairaExact(RECEIPT_THRESHOLD), n: "Above this, attach one. Below it, nobody asks." },
                  { k: "Claim window", v: `${CLAIM_WINDOW_DAYS} days`, n: "From the spend, not from the month end. A line older than this is outside policy on its date alone." },
                  { k: "Approval threshold", v: nairaExact(APPROVAL_THRESHOLD), n: "The same figure as the L&D approval line. One number, applied the same way in both places." },
                  { k: "Payment day", v: `The ${PAYMENT_DAY}th`, n: "Approved claims ride the monthly run. Miss the batch cut-off and it is a month, not a day." },
                ].map((r2) => (
                  <div key={r2.k} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r2.k}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{r2.n}</div>
                    </div>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: "none" }}>{r2.v}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  <Label>Per-diem zones</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {PER_DIEM_LIST.map((z) => (
                      <button
                        key={z.zone}
                        onClick={() => toast(`${z.name} · ${nairaExact(z.rate)} a day — ${z.applies}`)}
                        style={{ fontFamily: "inherit", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "8px 10px", background: "var(--pf-n0)" }}
                      >
                        <PfTile icon="orbit" tone={z.zone === "offshore" ? "red" : z.zone === "onshore" ? "yellow" : "blue"} size={24} />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{z.name}</span>
                        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{nairaExact(z.rate)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <Foot icon="warning">
                A day on an FPSO, a day at Bonny and a day in Ikoyi are three different economic events. One flat rate for all three is either an underpayment offshore or a windfall in Lagos.
              </Foot>
            </PfCard>
          </div>

          {/* the component catalogue */}
          <PfCard>
            <PfCardHead
              title="The statement’s own components"
              sub={`${MY_REWARD_COMPONENTS.filter((c) => c.inTotal).length} counted, ${MY_REWARD_COMPONENTS.filter((c) => !c.inTotal).length} shown and deliberately never added. Click one for the basis line the employee reads.`}
            >
              <PfBadge tone="grey">{MY_REWARDS.cashPct}% cash · {MY_REWARDS.nonCashPct}% non-cash</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              {MY_REWARD_COMPONENTS.map((c, i) => {
                const on = comp?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setComp(on ? null : c)}
                    style={{
                      fontFamily: "inherit", textAlign: "left", cursor: "pointer", border: "none",
                      borderTop: "1px solid var(--pf-n50)", borderLeft: i % 2 === 1 ? "1px solid var(--pf-n50)" : "none",
                      background: on ? "var(--pf-n25)" : "transparent", padding: "12px 20px",
                      display: "flex", alignItems: "center", gap: 11,
                      boxShadow: on ? "inset 3px 0 0 var(--pf-n900)" : "none",
                    }}
                  >
                    <PfTile icon={c.icon} tone={c.tone} size={28} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{c.name}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                        {c.kind === "cash" ? "Cash" : "Non-cash"}{c.inTotal ? "" : " · shown, never counted"}
                      </span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: c.inTotal ? "var(--pf-n900)" : "var(--pf-n300)", flex: "none" }}>
                      {nairaExact(c.amountNaira)}
                    </span>
                  </button>
                );
              })}
            </div>
            {comp ? (
              <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "14px 20px", background: "var(--pf-n25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{comp.name}</span>
                  <PfBadge tone={comp.inTotal ? "green" : "grey"}>{comp.inTotal ? "Counted in the total" : "Shown, never added"}</PfBadge>
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="ghost" icon="x" onClick={() => setComp(null)}>Close</PfBtn>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 8 }}>{comp.basis}</div>
                {comp.detail && <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65, marginTop: 7 }}>{comp.detail}</div>}
              </div>
            ) : (
              <Foot icon="check">
                Two components are shown and never added: paid leave, because it is already inside base salary, and the employee’s own 8% pension contribution, because a deduction is not a reward.
                Counting either would inflate every statement by the same money twice — and somebody would eventually quote the inflated figure in a negotiation.
              </Foot>
            )}
          </PfCard>

          {/* bands */}
          <PfCard>
            <PfCardHead
              title="Grades and market position"
              sub="This belongs to HR and it stays with HR. It is the company’s read of its own exposure, held for pay decisions it has not made."
            >
              <PfBadge tone="yellow" dot>2 of {BANDS.length} grades benchmarked</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--pf-n50)", overflowX: "auto" }}>
              {BANDS.map((b) => {
                const on = grade === b.grade;
                return (
                  <button
                    key={b.grade}
                    onClick={() => setGrade(b.grade)}
                    style={{
                      fontFamily: "inherit", cursor: "pointer", border: "none", flex: 1, minWidth: 108,
                      borderLeft: b.grade === BANDS[0].grade ? "none" : "1px solid var(--pf-n50)",
                      background: on ? "var(--pf-n25)" : "transparent", padding: "12px 14px", textAlign: "left",
                      boxShadow: on ? "inset 0 -2px 0 var(--pf-n900)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>{b.grade}</span>
                      {b.median ? <PfBadge tone="green" dot>Held</PfBadge> : <PfBadge tone="grey">None</PfBadge>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5 }}>{gradeCount(b.grade)} on the roster</div>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: "14px 20px" }}>
              {band.median ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                    <div>
                      <PfTh>{`${band.grade} BAND MEDIAN`}</PfTh>
                      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", marginTop: 5, letterSpacing: "-.3px" }}>{naira(band.median)}</div>
                    </div>
                    <div>
                      <PfTh>SAMPLE</PfTh>
                      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", marginTop: 5, letterSpacing: "-.3px" }}>n={band.n}</div>
                    </div>
                    <div>
                      <PfTh>SOURCE</PfTh>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 7, lineHeight: 1.5 }}>{band.source}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65, marginTop: 12 }}>{band.note}</div>
                  <div style={{ marginTop: 12 }}>
                    <PfBtn small variant="secondary" icon="lifebuoy" onClick={() => go("retention")}>Open the retention analysis</PfBtn>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11, border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "16px 18px" }}>
                  <PfTile icon="search" tone="grey" size={30} />
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>No benchmark held for {band.grade}</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65, marginTop: 5 }}>
                      {band.note} Two of {BANDS.length} grades have a market figure behind them. A reward programme with two benchmarked grades is not a benchmarked programme — it is two benchmarks and a lot of confidence.
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Foot icon="shield">
              None of this appears on an employee’s own statement, and the fence is in the data layer rather than in this page’s good manners.
              Telling someone “you are below market” on a page they opened to see what they have is the employer opening a negotiation against itself. When a pay decision is made, it appears in their history as a change — which is the honest moment to say it.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ============================ COST & TAKE-UP ========================= */}
      {tab === "cost" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* the cost model */}
          <PfCard>
            <PfCardHead
              title="What the programme costs"
              sub="Cash is a read. Everything else is the published rule applied to that read — a model with its inputs on the surface, not a figure from a system nobody can question."
            >
              <PfBadge tone="grey" dot>No model, no AI</PfBadge>
            </PfCardHead>

            <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
                <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px", background: "var(--pf-n25)" }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Annual cash — a read</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", marginTop: 7, letterSpacing: "-.4px" }}>{nairaBn(ANNUAL_CASH_ORG)}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.5 }}>
                    {DEPT_ROWS.length} departments, {TOTAL_HEADS} in headcount, at {naira(ANNUAL_CASH_ORG / 12)} a month. Not adjustable — it is what the department records say.
                  </div>
                </div>
                <Stepper
                  label="Employees inside the benefit programme"
                  value={String(eligible)}
                  hint={`Default ${DEFAULT_ELIGIBLE} — the only worker-type mix the platform holds is a ${MIX_ROWS.length}-row sample, ${MIX_EMPLOYEES.length} of them employees. Set it to your real figure. This is an assumption, and it is labelled as one.`}
                  onDec={() => setEligible((v) => Math.max(20, v - 5))}
                  onInc={() => setEligible((v) => Math.min(TOTAL_HEADS, v + 5))}
                />
                <Stepper
                  label="HMO family-plan share"
                  value={`${familyPct}%`}
                  hint={`Family ${nairaExact(HMO_FAMILY)} against single ${nairaExact(HMO_SINGLE)} — the gap between the two is the whole cost question on this line. Set it from your provider’s enrolment file.`}
                  onDec={() => setFamilyPct((v) => Math.max(0, v - 5))}
                  onInc={() => setFamilyPct((v) => Math.min(100, v + 5))}
                />
              </div>

              {/* the stack */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 9 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{nairaBn(model.total)}</span>
                  <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>total reward cost a year</span>
                  <span style={{ flex: 1 }} />
                  <PfBadge tone="blue">{model.nonCashPct}% non-cash</PfBadge>
                </div>
                <div style={{ display: "flex", height: 22, borderRadius: 7, overflow: "hidden", border: "1px solid var(--pf-n50)" }}>
                  {[
                    { k: "Cash", v: ANNUAL_CASH_ORG, tone: "green" as PfTone },
                    { k: "Pension", v: model.pension, tone: "blue" as PfTone },
                    { k: "HMO", v: model.hmo, tone: "purple" as PfTone },
                    { k: "Life", v: model.life, tone: "yellow" as PfTone },
                    { k: "L&D", v: model.lnd, tone: "red" as PfTone },
                  ].map((s) => (
                    <span
                      key={s.k}
                      title={`${s.k} — ${nairaBn(s.v)}`}
                      style={{ width: `${(s.v / model.total) * 100}%`, background: TONE[s.tone].bg, minWidth: s.v > 0 ? 2 : 0 }}
                    />
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8, marginTop: 12 }}>
                  {[
                    { k: "Cash pay", v: ANNUAL_CASH_ORG, tone: "green" as PfTone, n: "A read off the department cost records." },
                    { k: `Employer pension ${EMPLOYER_PENSION_PCT}%`, v: model.pension, tone: "blue" as PfTone, n: "Of pensionable emoluments, which are 96.7% of cash — the data allowance sits outside the base." },
                    { k: "Medical — HMO", v: model.hmo, tone: "purple" as PfTone, n: `${eligible} employees at a ${familyPct}% family-plan mix.` },
                    { k: "Group life", v: model.life, tone: "yellow" as PfTone, n: "The premium runs at 0.75% of cash on the worked example." },
                    { k: "L&D pool", v: model.lnd, tone: "red" as PfTone, n: "A fixed company pool. It does not scale with headcount, which is most of the problem." },
                  ].map((s) => (
                    <div key={s.k} style={{ borderTop: `2px solid ${TONE[s.tone].bg}`, paddingTop: 8 }}>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.35, minHeight: 30 }}>{s.k}</div>
                      <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", marginTop: 3 }}>{nairaBn(s.v)}</div>
                      <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 5, lineHeight: 1.45 }}>{s.n}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <HowPanel
                    claim={`${nairaBn(model.total)} total reward cost — ${nairaBn(ANNUAL_CASH_ORG)} cash plus ${nairaBn(model.nonCash)} of provision.`}
                    steps={[
                      `Cash: the ${DEPT_ROWS.length} department monthly cost figures, summed and multiplied by twelve. ${naira(ANNUAL_CASH_ORG / 12)} a month across ${TOTAL_HEADS} heads.`,
                      `Employee cash: ${eligible} of ${TOTAL_HEADS} heads → ${nairaBn(model.employeeCash)}. Contractor and agency pay is not ours to carry benefits against.`,
                      `Pension: employee cash × 96.67% pensionable ratio × ${EMPLOYER_PENSION_PCT}% = ${nairaBn(model.pension)}.`,
                      `HMO: ${eligible} × (${familyPct}% at ${nairaExact(HMO_FAMILY)} + ${100 - familyPct}% at ${nairaExact(HMO_SINGLE)}) = ${nairaBn(model.hmo)}.`,
                      `Life: employee cash × 0.75%, the premium-to-cash ratio on the worked example = ${nairaBn(model.life)}.`,
                      `L&D: ${naira(POOL)}, flat. It is a pool, not a per-head entitlement.`,
                    ]}
                    note="Two of these are assumptions and both are on the surface as controls: the eligible population and the plan mix. Everything else is a published rule or a stored figure. Where this model and your payroll system disagree, the payroll system is right — it paid the money and this did not."
                  />
                </div>
              </div>
            </div>
            <Foot icon="wallet">
              {HANDOFF_NOTE.body}
            </Foot>
          </PfCard>

          {/* department cost */}
          <PfCard>
            <PfCardHead title="Where the cash sits" sub="Sort it three ways. Cost per head is the one that changes the conversation — it is the only column that is not just a proxy for size.">
              <div style={{ display: "flex", gap: 6 }}>
                {([["annual", "By cost"], ["headcount", "By headcount"], ["perHead", "By cost / head"]] as const).map(([k, l]) => (
                  <PfBtn key={k} small variant={sortKey === k ? "primary" : "secondary"} onClick={() => setSortKey(k)}>{l}</PfBtn>
                ))}
              </div>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 1fr 120px", padding: "10px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>DEPARTMENT</PfTh><PfTh style={{ textAlign: "right" }}>HEADS</PfTh><PfTh style={{ paddingLeft: 12 }}>ANNUAL CASH</PfTh><PfTh style={{ textAlign: "right" }}>PER HEAD</PfTh>
            </div>
            {sortedDepts.map((d) => (
              <div key={d.name} style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 1fr 120px", alignItems: "center", padding: "11px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{d.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{d.head} · {d.loc}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: "var(--pf-n600)", textAlign: "right" }}>{d.headcount}</div>
                <div style={{ paddingLeft: 12 }}>
                  <PfProgress pct={(d[sortKey] / maxDept) * 100} tone={d.perHead > 18_000_000 ? "purple" : "green"} height={7} />
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", textAlign: "right" }}>
                  {sortKey === "perHead" ? naira(d.perHead) : nairaBn(d.annual)}
                </div>
              </div>
            ))}
            <Foot icon="trend">
              Engineering costs {naira(DEPT_ROWS.find((d) => d.name === "Engineering")!.perHead)} a head and Field Operations {naira(DEPT_ROWS.find((d) => d.name === "Field Operations")!.perHead)},
              on {DEPT_ROWS.find((d) => d.name === "Engineering")!.headcount} and {DEPT_ROWS.find((d) => d.name === "Field Operations")!.headcount} heads. That is not a pay-equity finding — it is two different labour markets in one company, and any single reward rule applied across both will be wrong somewhere.
            </Foot>
          </PfCard>

          {/* take-up */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="Learning entitlement take-up" sub={`${naira(POOL)} pool · ${POOL_DRAWN_PCT}% drawn · ${MONTHS_LEFT} months of the year left`} />
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginBottom: 10 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{nairaExact(POOL_DRAWN)}</span>
                  <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>drawn of {naira(POOL)}</span>
                </div>
                <PfProgress pct={POOL_DRAWN_PCT} tone="purple" height={10} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11.5, color: "var(--pf-n400)" }}>
                  <span>{POOL_DRAWN_PCT}% consumed</span>
                  <span>{nairaExact(POOL_LEFT)} unspent</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Per eligible employee</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", marginTop: 4 }}>{nairaExact(model.perHeadPool)}</div>
                  </div>
                  <div style={{ border: "1px solid var(--pf-red-100)", background: "var(--pf-red-50)", borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ fontSize: 11.5, color: "var(--pf-red-500)" }}>Approval threshold</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-red-500)", marginTop: 4 }}>{nairaExact(LND_ENTITLEMENT.approverThreshold)}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65, marginTop: 12 }}>
                  The control is ten times the average entitlement. A manager approval gate exists for requests the budget cannot fund in the first place —
                  and the L5 on the staff-engineer track has drawn {nairaExact(LND_ENTITLEMENT.yourDraw)} of hers.
                </div>
              </div>
              <Foot icon="book">Unspent learning budget does not roll over and does not come back as anything else.</Foot>
            </PfCard>

            <PfCard>
              <PfCardHead title="Who has ever claimed" sub="Worker type against the claims register. Eligibility is on the programme tab; this is what actually arrived." />
              <div style={{ padding: "6px 20px 14px" }}>
                {TYPE_TAKEUP.map((t) => (
                  <div key={t.type} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                    <PfTile icon={t.type === "employee" ? "user" : t.type === "alumni" ? "door" : "users"} tone={t.claimants ? "green" : "grey"} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{WORKER_TYPE_LABEL[t.type]}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                        {t.claimants} of {t.n} {t.n === 1 ? "worker has" : "workers have"} claimed{t.claims ? ` · ${t.claims} ${t.claims === 1 ? "claim" : "claims"}` : ""}
                      </div>
                    </div>
                    {t.claimants === 0
                      ? <PfBadge tone={t.type === "alumni" ? "grey" : "yellow"} dot>{t.type === "alumni" ? "Not eligible" : "Silent"}</PfBadge>
                      : <PfBadge tone="green" dot>{pct(t.claimants, t.n)}%</PfBadge>}
                  </div>
                ))}
              </div>
              <Foot icon="warning">
                The largest claim on file — {nairaExact(BIGGEST_CLAIM.totalNaira)}, {BIGGEST_CLAIM.claimant}’s 28-day Bonga tour — belongs to a{" "}
                {WORKER_TYPE_LABEL[workerById(BIGGEST_CLAIM.claimantId)?.workerType ?? "contractor"].toLowerCase()} the v2.0 person record could not represent at all.
                The {TYPE_TAKEUP.find((t) => t.type === "agency")?.n ?? 0} agency workers and the intern beside him have filed nothing.
              </Foot>
            </PfCard>
          </div>

          {/* category take-up */}
          <PfCard>
            <PfCardHead
              title="Category take-up"
              sub={`${nairaExact(CLAIMED_TOTAL)} claimed across ${CLAIMED_LINES} lines and ${CLAIMS.length} claims. Click a category for the lines behind it — including the one with none.`}
            >
              <PfBadge tone={AUDIT.clean ? "green" : "red"} dot>{AUDIT.flagged} of {AUDIT.lines} lines flagged</PfBadge>
            </PfCardHead>
            {CATEGORY_TAKEUP.map((c) => (
              <Bar
                key={c.key}
                label={c.name}
                pctOf={pct(c.total, CLAIMED_TOTAL)}
                tone={c.key === "per-diem" ? "purple" : "green"}
                value={c.total ? nairaExact(c.total) : "— nothing"}
                on={cat === c.key}
                onPick={() => setCat((v) => (v === c.key ? null : c.key))}
              />
            ))}
            {catRow && (
              <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "14px 20px", background: "var(--pf-n25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
                  <PfTile icon={catRow.icon} tone={catRow.lines.length ? "green" : "red"} size={26} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{catRow.name}</span>
                  <PfBadge tone="grey">Cap {nairaExact(catRow.cap)} {catRow.capBasis}</PfBadge>
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="ghost" icon="x" onClick={() => setCat(null)}>Close</PfBtn>
                </div>
                {catRow.lines.length ? (
                  catRow.lines.map((l) => (
                    <div key={`${l.claimId}-${l.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--pf-n50)" }}>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", width: 64, flex: "none" }}>{l.claimId}</span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.merchant}</span>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 130, flex: "none" }}>{l.claimant} · {l.date}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", width: 96, textAlign: "right", flex: "none" }}>{nairaExact(l.amountNaira)}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11, border: "1px dashed var(--pf-red-100)", borderRadius: 10, padding: "14px 16px" }}>
                    <PfTile icon="search" tone="red" size={28} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Not one claim, all year</div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65, marginTop: 5 }}>
                        A published cap of {nairaExact(catRow.cap)} {catRow.capBasis} and nothing against it. The register records what arrived; it cannot tell you whether that is because nothing happened or because nobody knew.
                        For this category the receipt is a written HMO decline — a document the employee has to have been handed first.
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <PfBtn small variant="secondary" icon="paperplane" onClick={() => toast("Request logged with the HMO provider — this year’s declines file, so the gap can be measured instead of guessed", "success")}>
                          Ask the provider for the declines file
                        </PfBtn>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <Foot icon="info">
              Per-diem is {pct(PER_DIEM_ROW.total, CLAIMED_TOTAL)}% of everything claimed on {PER_DIEM_ROW.lines.length} of {CLAIMED_LINES} lines. It is also the only category with no receipts to audit —
              by design, because a rate is not a reimbursement. Both facts are true and they point in opposite directions.
            </Foot>
          </PfCard>

          {/* findings */}
          <PfCard>
            <PfCardHead
              title="Where the spend is not landing"
              sub="Six readings of the same register. None of them is a model, none carries a confidence score, and each one shows its arithmetic."
            >
              <PfBadge tone="grey" dot>Deterministic</PfBadge>
            </PfCardHead>
            {FINDINGS.map((f) => {
              const on = openFinding === f.id;
              return (
                <div key={f.id} style={{ borderTop: "1px solid var(--pf-n50)" }}>
                  <button
                    onClick={() => setOpenFinding(on ? null : f.id)}
                    style={{ fontFamily: "inherit", textAlign: "left", width: "100%", cursor: "pointer", border: "none", background: on ? "var(--pf-n25)" : "transparent", padding: "13px 20px", display: "flex", alignItems: "center", gap: 11 }}
                  >
                    <PfTile icon={f.tone === "red" ? "warning" : f.tone === "blue" ? "info" : "pulse"} tone={f.tone} size={28} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{f.title}</span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, fontFamily: MONO }}>{f.figure}</span>
                    </span>
                    <Ic name={on ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
                  </button>
                  {on && (
                    <div style={{ padding: "0 20px 16px 59px", background: "var(--pf-n25)" }}>
                      <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.7 }}>{f.body}</div>
                      <div style={{ margin: "12px 0 6px" }}><Label>What this was read from</Label></div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {f.inputs.map((i) => (
                          <div key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                            <Ic name="check" size={12} color="var(--pf-primary-500)" weight={2.2} />
                            <span>{i}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <PfBtn small variant="secondary" icon="arrowright" onClick={() => toast(`${f.action} — logged against the ${CYCLE} reward review`, "success")}>{f.action}</PfBtn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <Foot icon="shield">
              Nothing on this tab is AI. Every figure is a count, a sum or a ratio over rows you can open, and it will produce the same answer every time it runs.
              The one model on this page writes a paragraph, on the delivery tab, and it has never seen a single one of these numbers.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ============================== DELIVERY ============================= */}
      {tab === "delivery" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* the cycle */}
          <PfCard>
            <PfCardHead
              title={`The ${NEXT_CYCLE} statement cycle`}
              sub={`${CYCLE} went out on ${GENERATED_AT.split(" · ")[0]} to ${publishedCount} employees and ${AUG_OPENED} has been opened. This is the next one — generate, write the note, publish, in that order.`}
            >
              <PfBadge tone={cycleState === "Published" ? "green" : cycleState === "Generated" ? "yellow" : "grey"} dot>{cycleState}</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {[
                { n: "01", t: "Generate", d: `One statement per eligible employee — ${publishedCount} of them. Nothing is visible to anyone yet.`, done: cycleState !== "Not started" },
                { n: "02", t: "Approve the note", d: "One paragraph, identical for every recipient. A statement with no covering sentence gets read as a payslip.", done: noteApproved },
                { n: "03", t: "Publish", d: "Statements become visible and every open from that moment is logged and shown to the subject.", done: cycleState === "Published" },
              ].map((s, i) => (
                <div key={s.n} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: s.done ? "var(--pf-primary-500)" : "var(--pf-n300)" }}>{s.n}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{s.t}</span>
                    {s.done && <PfBadge tone="green" dot>Done</PfBadge>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55 }}>{s.d}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "13px 20px", borderTop: "1px solid var(--pf-n50)" }}>
              <PfBtn variant={cycleState === "Not started" ? "primary" : "secondary"} icon="stack" onClick={generateCycle}>
                {cycleState === "Not started" ? `Generate ${publishedCount} statements` : "Regenerate the cycle"}
              </PfBtn>
              <PfBtn variant="secondary" icon="sparkle" onClick={draftNote}>Draft the cover note</PfBtn>
              <PfBtn variant={noteApproved && cycleState === "Generated" ? "primary" : "secondary"} icon="paperplane" onClick={publishCycle}>Publish to {publishedCount}</PfBtn>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Every step writes an audit entry attributed to {ACTOR}.</span>
            </div>
          </PfCard>

          {/* the AI surface — the only one on this page */}
          <PfCard>
            <PfCardHead
              title="The covering note"
              sub="The one model on this page. It writes a paragraph that goes to every recipient identically — which is exactly why it can be given nothing personal to read."
            >
              <PfBadge tone={noteApproved ? "green" : "purple"} dot>{noteApproved ? "Approved" : "Draft"}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 20px" }}>
              {note ? (
                <AiBlock
                  label={`AI draft · ${MC05.name}`}
                  chip={`${MC05.id} · ${AS10.id}`}
                  why={<WhyThisPanel why={noteWhy} card={MC05.name} />}
                >
                  <textarea
                    value={note}
                    onChange={(e) => { setNote(e.target.value); setNoteApproved(false); }}
                    rows={10}
                    style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.7, border: "1px solid var(--pf-purple-100)" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <PfBtn small variant="primary" icon="check" onClick={approveNote}>Approve for the cycle</PfBtn>
                    <PfBtn small variant="ghost" icon="x" onClick={() => { setNote(""); setNoteApproved(false); }}>Discard</PfBtn>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Edit it freely — what publishes is whatever is in this box when you approve.</span>
                  </div>
                </AiBlock>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "18px 20px" }}>
                  <PfTile icon="sparkle" tone="purple" size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>No note yet</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65, marginTop: 5 }}>
                      Draft one, or type your own. The model is given the component catalogue, the cycle month and the statement’s own caveat — no pay figure, no grade, no person record.
                      There is nothing personal in a paragraph that is identical for {publishedCount} people, so it was given nothing personal to read.
                    </div>
                    <div style={{ marginTop: 11 }}>
                      <PfBtn small variant="secondary" icon="sparkle" onClick={draftNote}>Draft with {MC05.id}</PfBtn>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Foot icon="robot">
              Registry position, stated rather than assumed: {MC05.id} is registered as {AS10.id} for the HR-letters surface. This is a second surface for the same model on the same gate,
              and FR-093 audits AI-surface coverage at 100% — so it needs its own registry row before GA. That is a governance task with a name on it, not a footnote.
            </Foot>
          </PfCard>

          {/* the register */}
          <PfCard>
            <PfCardHead
              title="Delivery register"
              sub={`${publishedCount} eligible employees. This register holds receipts — who opened, and when. It does not hold, and cannot reach, what any statement says.`}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {([["all", "All"], ["opened", "Opened"], ["waiting", "Not opened"]] as const).map(([k, l]) => (
                  <PfBtn key={k} small variant={dFilter === k ? "primary" : "secondary"} onClick={() => setDFilter(k)}>{l}</PfBtn>
                ))}
              </div>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 110px 1fr 190px", padding: "10px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>EMPLOYEE</PfTh><PfTh>GRADE</PfTh><PfTh>RECEIPT</PfTh><PfTh style={{ textAlign: "right" }}>ACTION</PfTh>
            </div>
            {deliveryRows.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "26px 20px" }}>
                <PfTile icon="check" tone="green" size={30} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                    {dFilter === "opened" ? "Nobody has opened one yet" : "Everybody has opened theirs"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 4 }}>
                    {dFilter === "opened"
                      ? "The cycle has just published. Give it a day before reading anything into that."
                      : "Which has never happened on a first cycle, so enjoy it."}
                  </div>
                </div>
              </div>
            ) : (
              deliveryRows.map((r) => (
                <div key={r.p.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 110px 1fr 190px", alignItems: "center", padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <PfAvatar init={r.p.init} tone={r.p.tone} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{r.p.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.p.role} · {r.p.dept}</div>
                    </div>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--pf-n600)" }}>{r.emp?.grade ?? "—"}</div>
                  <div style={{ minWidth: 0 }}>
                    {r.opened
                      ? <PfBadge tone="green" dot>Opened {OPENED_AT}</PfBadge>
                      : <PfBadge tone={reminded.includes(r.p.id) ? "blue" : "yellow"} dot>{reminded.includes(r.p.id) ? "Reminded" : "Not opened"}</PfBadge>}
                    {r.flag && <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{r.flag}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <PfBtn small variant="ghost" icon="stack" onClick={() => regenerate(r.p.name)}>Regenerate</PfBtn>
                    {!r.opened && <PfBtn small variant="secondary" icon="bell" onClick={() => remind(r.p.id, r.p.name, r.away)}>Remind</PfBtn>}
                  </div>
                </div>
              ))
            )}
            <Foot icon="shield">
              A receipt is not a read. This page can tell you that {ALL_WORKERS.find((w) => w.id === "E-0214")?.name} opened hers at {OPENED_AT.split(" · ")[1]};
              it cannot tell you what is on it, and there is no accessor in this module that could. A statement for an arbitrary employee id is a comp database with a friendly face,
              so the data layer does not have one — not as a map, not as a list, not as an extra argument.
            </Foot>
          </PfCard>

          {/* who gets no statement */}
          <PfCard>
            <PfCardHead
              title="Who gets no statement, and why"
              sub={`${notEligible.length} workers on the roster with no total-reward statement. Each one for a stated reason, not by omission.`}
            />
            {notEligible.map(({ w, p }) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <PfAvatar init={p.init} tone={p.tone} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                    {p.role} · {companyById(w.contractingCompanyId)?.name ?? p.dept}
                  </div>
                </div>
                <PfBadge tone="grey">{WORKER_TYPE_LABEL[w.workerType]}</PfBadge>
                <span style={{ width: 300, flex: "none", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                  {w.workerType === "alumni"
                    ? "Employment ended. Nothing accrues and nothing is issued."
                    : w.workerType === "nysc"
                      ? "The scheme sets the allowance, not the company. There is no company reward to state."
                      : "Their reward is the contract rate, held by their contracting company. Issuing them a statement would mean holding pay we have no business holding."}
                </span>
              </div>
            ))}
            <Foot icon="users">
              This list is the honest cost of the eligibility matrix. {notEligible.filter((r) => r.w.workerType !== "alumni").length} people currently work here and get no statement,
              and every one of those exclusions is defensible except possibly the intern’s — which is sitting on the programme tab as a decision worth actually making.
            </Foot>
          </PfCard>

          {/* exclusions + access log */}
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="What a statement never contains" sub="Five things HR holds that do not go on a statement, and the reason for each. This is the fence, written down." />
              {REWARDS_EXCLUSIONS.map((x) => (
                <div key={x.item} style={{ padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Ic name="x" size={13} color="var(--pf-red-500)" weight={2.4} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{x.item}</span>
                    <PfBadge tone="grey">{x.livesIn}</PfBadge>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 6 }}>{x.why}</div>
                </div>
              ))}
              <Foot icon="info">
                The first row is the band conversation on the programme tab. It is HR’s to hold and HR’s to act on — and it is not the employee’s to discover on a money page.
              </Foot>
            </PfCard>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PfCard>
                <PfCardHead title="Access log" sub="Every open of a statement, including the subject’s own — and the subject sees this list." />
                {log.slice(0, 6).map((a, i) => (
                  <div key={`${a.at}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", width: 84, flex: "none", paddingTop: 2 }}>{a.at}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--pf-n900)" }}>{a.who}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>{a.action}</div>
                    </div>
                    <PfBadge tone="grey">{a.lawfulBasis}</PfBadge>
                  </div>
                ))}
                <Foot icon="shield">{REWARDS_ACCESS_NOTE}</Foot>
              </PfCard>

              <PfCard>
                <PfCardHead title="Cover, at its own scale" sub="Two of these are benefits whose size has nothing to do with what they cost." />
                <div style={{ padding: "6px 20px 14px" }}>
                  {MY_COVER.map((c) => (
                    <div key={c.name} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                      <PfTile icon={c.icon} tone="blue" size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{c.basis}</div>
                      </div>
                      <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: "none" }}>{naira(c.value)}</span>
                    </div>
                  ))}
                </div>
                <Foot icon="info">As at {REWARDS_TODAY}.</Foot>
              </PfCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
