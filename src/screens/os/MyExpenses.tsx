"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  APPROVAL_THRESHOLD, CLAIM_WINDOW_DAYS, CLAIMS, EXPENSE_POLICY, HANDOFF_NOTE, PAYMENT_BATCHES,
  PAYMENT_DAY, PAYROLL_ROUTE, PER_DIEM, PER_DIEM_LIST, POLICY_AUDIT, POLICY_EXCLUSIONS,
  RECEIPT_THRESHOLD, REWARDS_TODAY, VERDICT_LABEL,
  approvalChainFor, checkLine, claimStateTone, claimsFor, flaggedLines, nairaExact,
  policyFor, verdictTone,
  type CheckInput, type Claim, type ClaimState, type ExpenseCategoryKey, type ExpenseLine,
  type PerDiemZone, type ReceiptRule,
} from "@/data/rewards";
import { ME_ID, ME_PUBLIC, ME_FIRST, MY_MANAGER, MY_HANDBOOK } from "@/data/me";

/**
 * My expenses — FR-096, the CLAIMANT side of the expense lifecycle.
 *
 * The whole design idea of this page is in one place: the policy verdict is
 * computed LIVE, on a draft, while she types. She learns the cap before she
 * submits instead of finding out three weeks later from an approver. The
 * register already holds the case for this — a claim held by one missing
 * receipt on a ₦11,400 line missed an entire payment run, and the fix was not
 * a better rejection message, it was moving the check to the moment of typing.
 *
 * Three rules this screen inherits from `@/data/rewards` and must not soften:
 *
 *  · The check is a RULE CHECK, not a model. Nothing on this page is AI, and
 *    nothing frames a verdict as something a model decided. Every verdict
 *    carries a "Why this?" with the rule, the numbers it compared and the
 *    handbook clause — and says out loud that no model card applies, because
 *    no model ran (FR-093).
 *  · The engine FLAGS; a human decides. "Over cap" is not "rejected".
 *  · Hirebrew stops at the batch. The claim, the check and the approval chain
 *    are ours; the payment is your payroll system's, through the
 *    payroll_connector contract. This page never names a payroll vendor,
 *    because that decision is open.
 *
 * Me-pillar scope: E-0214 and nobody else. `claimsFor(ME_ID)` is the only door.
 * Deterministic — reference day is Aug 28, 2026 (REWARDS_TODAY).
 */

/* --------------------------------- subject --------------------------------- */

const ME = ME_PUBLIC;
const MY_CLAIMS = claimsFor(ME_ID);
/** COUNT ONLY. Those claims belong to colleagues and never render here. */
const NOT_MINE = CLAIMS.length - MY_CLAIMS.length;

const SEED_DRAFT = MY_CLAIMS.find((c) => c.state === "Draft")!;
const OTHER_CLAIMS = MY_CLAIMS.filter((c) => c.state !== "Draft");

const EXPENSE_POLICY_CARD = MY_HANDBOOK.find((h) => h.id === "hb-expenses");
const AUDIT = POLICY_AUDIT();

const first = (n: string) => n.split(" ")[0];

/* ---------------------------------- dates ---------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** REWARDS_TODAY, parsed once. No clock, no locale — the fixtures are dated. */
const REF_ISO = "2026-08-28";
const REF_DAY = 28;
const REF_MONTH = 7; // August, zero-indexed

const fmtDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}`;
};

/** Whole days between a spend date and the reference day. Negative dates clamp to 0. */
const ageOf = (iso: string): number => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  const ref = Date.parse(`${REF_ISO}T00:00:00Z`);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((ref - t) / 86_400_000));
};

const runLabel = (monthOffset: number): string => {
  const m = REF_MONTH + monthOffset;
  return `${MONTHS[m % 12]} ${PAYMENT_DAY}, ${2026 + Math.floor(m / 12)}`;
};

/**
 * DERIVED, not seeded. The two paid batches in PAYMENT_BATCHES left 3 days
 * (Aug 22 → Aug 25) and 2 days (Jul 23 → Jul 25) before their runs. The wider
 * of the two is the honest cut-off to quote to a claimant.
 */
const dayNum = (label: string): number => Number(label.match(/\s(\d{1,2}),/)?.[1] ?? 0);
const CUTOFF_LEAD = Math.max(
  ...PAYMENT_BATCHES.filter((b) => b.exportedAt).map((b) => dayNum(b.runDate) - dayNum(b.exportedAt!)),
);
const CUTOFF_DAY = PAYMENT_DAY - CUTOFF_LEAD;

/** Aug 28 is past the 25th, so the August run has gone. Next is September. */
const NEXT_RUN = runLabel(REF_DAY >= PAYMENT_DAY ? 1 : 0);
const RUN_AFTER = runLabel(REF_DAY >= PAYMENT_DAY ? 2 : 1);
const CUTOFF_LABEL = `${MONTHS[(REF_MONTH + (REF_DAY >= PAYMENT_DAY ? 1 : 0)) % 12]} ${CUTOFF_DAY}`;

/* --------------------------------- taxonomy -------------------------------- */

const CAT_TONE: Record<ExpenseCategoryKey, PfTone> = {
  "travel-air": "blue",
  "travel-ground": "blue",
  accommodation: "purple",
  "per-diem": "green",
  entertainment: "yellow",
  "home-office": "purple",
  data: "green",
  medical: "red",
  training: "blue",
};

const RECEIPT_PLAIN: Record<ReceiptRule, string> = {
  never: "No receipt — it is a rate, not a reimbursement",
  threshold: `Receipt only above ${nairaExact(RECEIPT_THRESHOLD)}`,
  always: "Receipt always, at any amount",
};

const RECEIPT_TONE: Record<ReceiptRule, PfTone> = { never: "grey", threshold: "blue", always: "yellow" };

const capFor = (key: ExpenseCategoryKey, zone: PerDiemZone): number =>
  key === "per-diem" ? PER_DIEM[zone].rate : policyFor(key).cap;

/** The happy path. Rejected is a branch off Submitted, not a step on the way. */
const FLOW: ClaimState[] = ["Submitted", "Approved", "Queued for payment", "Paid"];

const FLOW_META: Record<string, { icon: string; tone: PfTone; what: string }> = {
  Submitted: { icon: "paperplane", tone: "yellow", what: "You sent it. It becomes a record against your worker id, timestamped." },
  Approved: { icon: "check", tone: "blue", what: "Your approver — and Finance, over the threshold — rules on every flagged line." },
  "Queued for payment": { icon: "stack", tone: "blue", what: "Cleared claims gather into one batch, which leaves as a file before the run." },
  Paid: { icon: "wallet", tone: "green", what: "Your payroll system pays it with the month's run and sends a reference back." },
};

/* ------------------------------- small pieces ------------------------------ */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 8,
  padding: "9px 11px", width: "100%", outline: "none",
};

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{hint}</span>}
    </div>
  );
}

function Note({ icon = "info", tone = "grey", children }: { icon?: string; tone?: PfTone; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Ic name={icon} size={13} color={TONE[tone].fg} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/**
 * The FR-093 affordance, applied to a rule check.
 *
 * Deliberately NOT in the purple AI idiom used on Cases and Letters: purple on
 * this codebase means a model touched it, and nothing here did. The panel still
 * carries a claim, a basis and a gate — and closes by saying which model card
 * applies, which is none, because none ran.
 */
function WhyRule({ claim, basis, gate }: { claim: string; basis: string[]; gate: string }) {
  const go = useGo();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-n500)" />
        Why this?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-n500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{claim}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>Basis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {basis.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                <Ic name="check" size={12} color="var(--pf-primary-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
            <Ic name="robot" size={14} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1, minWidth: 230, lineHeight: 1.45 }}>
              No model card, because no model ran. This is a comparison against a published table — same inputs, same answer, every time. {gate}
            </span>
            <PfBtn small variant="secondary" icon="robot" onClick={() => go("aisurfaces")}>AI surface audit</PfBtn>
          </div>
        </div>
      )}
    </>
  );
}

/** The exact rule that fired, written out so a claimant can argue with it. */
const basisFor = (l: ExpenseLine, siblings: ExpenseLine[]): string[] => {
  const p = policyFor(l.category);
  const cap = capFor(l.category, l.zone ?? "city");
  const units = l.units ?? 1;
  const perUnit = Math.round(l.amountNaira / units);
  const rows: string[] = [
    `Category read as ${p.name} — you chose it, nothing inferred it.`,
    `Published cap: ${nairaExact(cap)} ${l.category === "per-diem" && l.zone ? `per day at the ${PER_DIEM[l.zone].name.toLowerCase()} rate` : p.capBasis}.`,
    `Your line: ${nairaExact(l.amountNaira)}${units > 1 ? ` across ${units} — ${nairaExact(perUnit)} each` : ""}.`,
  ];
  if (l.verdict === "over-cap") rows.push(`${nairaExact(perUnit - cap)} above the cap. Flagged for your approver, not rejected.`);
  if (l.verdict === "missing-receipt") rows.push(`Receipt rule: ${RECEIPT_PLAIN[p.receiptRule].toLowerCase()}. Nothing else about the line is out of policy.`);
  if (l.verdict === "duplicate-suspected") {
    const twin = siblings.find((s) => s.id !== l.id && s.category === l.category && s.merchant === l.merchant && s.amountNaira === l.amountNaira);
    rows.push(`Matches your ${twin ? twin.date : "earlier"} line on category, merchant and amount inside a 3-day window. Suspected — your approver rules on it.`);
  }
  if (l.verdict === "outside-policy") rows.push(`${l.ageDays > CLAIM_WINDOW_DAYS ? `Spent ${l.ageDays} days ago; the window is ${CLAIM_WINDOW_DAYS} days.` : "The route is booked centrally, so there is nothing to claim back."} The amount was never the question.`);
  if (l.verdict === "ok") rows.push(`Receipt rule: ${RECEIPT_PLAIN[p.receiptRule].toLowerCase()} — satisfied.`);
  rows.push(`Claimed ${l.ageDays} ${l.ageDays === 1 ? "day" : "days"} after the spend. The window is ${CLAIM_WINDOW_DAYS} days.`);
  rows.push(`Source: ${EXPENSE_POLICY_CARD?.title ?? "Expenses & reimbursement"} (hb-expenses) · ${EXPENSE_POLICY_CARD?.owner ?? "Finance"} · updated ${EXPENSE_POLICY_CARD?.updated ?? "Mar 2026"}.`);
  rows.push("The check read this line and your other lines. Not your name, grade, department, worker type, performance, attendance or claim history.");
  return rows;
};

/* ------------------------------- cap meter --------------------------------- */

function CapMeter({ used, cap, tone, caption }: { used: number; cap: number; tone: PfTone; caption: string }) {
  const pct = cap === 0 ? 0 : Math.round((used / cap) * 100);
  const over = used > cap;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: over ? "var(--pf-red-500)" : "var(--pf-n900)" }}>{pct}% of cap</span>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1, minWidth: 0 }}>{caption}</span>
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 8, background: "var(--pf-n50)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(pct, 100)}%`, borderRadius: 8, background: over ? "var(--pf-red-500)" : TONE[tone].bg, transition: "width .25s ease" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: "var(--pf-n400)" }}>
        <span>{nairaExact(used)}</span>
        <span>cap {nairaExact(cap)}</span>
      </div>
    </div>
  );
}

/* ------------------------------ category chip ------------------------------ */

function CatChip({ k, active, onClick }: { k: ExpenseCategoryKey; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const p = policyFor(k);
  const t = TONE[CAT_TONE[k]];
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title={`${nairaExact(p.cap)} ${p.capBasis}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "8px 13px", borderRadius: 999,
        color: active ? t.fg : "var(--pf-n500)",
        background: active ? t.soft : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`,
        whiteSpace: "nowrap", lineHeight: 1.3,
      }}
    >
      <Ic name={p.icon} size={13} color={active ? t.fg : "var(--pf-n400)"} />
      {p.name}
    </button>
  );
}

/* --------------------------------- steps ----------------------------------- */

function Step({ icon, tone, title, sub, state, last }: {
  icon: string; tone: PfTone; title: string; sub: ReactNode; state: "done" | "next" | "wait"; last?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: state === "wait" ? 0.7 : 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
        <PfTile icon={icon} tone={state === "wait" ? "grey" : tone} size={26} />
        {!last && <span style={{ width: 1.5, flex: 1, minHeight: 18, background: "var(--pf-n50)", marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</span>
          {state === "done" && <PfBadge tone="green" dot>Done</PfBadge>}
          {state === "next" && <PfBadge tone="yellow" dot>Now</PfBadge>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>{sub}</div>
      </div>
    </div>
  );
}

/* --------------------------------- line row -------------------------------- */

function LineRow({ l, siblings, onRemove, onAttach }: {
  l: ExpenseLine; siblings: ExpenseLine[]; onRemove?: () => void; onAttach?: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const [open, setOpen] = useState(false);
  const p = policyFor(l.category);
  const flagged = l.verdict !== "ok";
  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "grid", gridTemplateColumns: "68px 1.6fr 1fr 108px 130px 26px", alignItems: "center",
          gap: 10, padding: "12px 20px", cursor: "pointer",
          background: open || hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--pf-n500)", fontWeight: 600 }}>{l.date}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Ic name={p.icon} size={14} color={TONE[CAT_TONE[l.category]].fg} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.merchant}
          </span>
        </span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {p.name}{l.units && l.units > 1 ? ` · ${l.units} units` : ""}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", textAlign: "right" }}>{nairaExact(l.amountNaira)}</span>
        <span><PfBadge tone={verdictTone(l.verdict)} dot={flagged}>{VERDICT_LABEL[l.verdict]}</PfBadge></span>
        <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
          <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
        </span>
      </div>

      {open && (
        <div style={{ padding: "0 20px 16px", background: "var(--pf-n25)" }}>
          <div style={{ background: "var(--pf-n0)", border: `1px solid ${flagged ? TONE[verdictTone(l.verdict)].line : "var(--pf-n50)"}`, borderRadius: 10, padding: "13px 15px" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Ic name={flagged ? "warning" : "check"} size={15} color={TONE[verdictTone(l.verdict)].fg} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>{l.reason}</div>
            </div>
            <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
              {l.receiptRef ? (
                <PfBadge tone="green"><Ic name="file" size={11} /> {l.receiptRef}</PfBadge>
              ) : (
                <PfBadge tone={RECEIPT_TONE[p.receiptRule]}>{RECEIPT_PLAIN[p.receiptRule]}</PfBadge>
              )}
              {l.route && <PfBadge tone="grey">{l.route}</PfBadge>}
              {l.zone && <PfBadge tone="green">{PER_DIEM[l.zone].name} · {nairaExact(PER_DIEM[l.zone].rate)}/day</PfBadge>}
              <span style={{ flex: 1 }} />
              {onAttach && l.verdict === "missing-receipt" && (
                <PfBtn small variant="primary" icon="file" onClick={onAttach}>Attach the receipt</PfBtn>
              )}
              {onRemove && <PfBtn small variant="secondary" icon="x" onClick={onRemove}>Remove line</PfBtn>}
            </div>
            <div style={{ marginTop: 12 }}>
              <WhyRule
                claim={`${VERDICT_LABEL[l.verdict]} — ${l.merchant}, ${nairaExact(l.amountNaira)} on ${l.date}.`}
                basis={basisFor(l, siblings)}
                gate={flagged ? "A person rules on this line; the check only raised it." : "Nothing to gate — the line cleared on the rule."}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================== screen ================================= */

type Tab = "new" | "claims" | "policy";
const CLAIM_FILTERS = ["All", "Open", "Paid"] as const;
type ClaimFilter = (typeof CLAIM_FILTERS)[number];

export default function MyExpenses() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("new");

  /* ------------------------------ the draft ------------------------------- */
  const [draftLines, setDraftLines] = useState<ExpenseLine[]>(SEED_DRAFT.lines);
  const [seq, setSeq] = useState(SEED_DRAFT.lines.length + 1);
  const [submitted, setSubmitted] = useState<Claim | null>(null);

  /* ------------------------------- the form ------------------------------- */
  const [cat, setCat] = useState<ExpenseCategoryKey>("travel-ground");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [dateIso, setDateIso] = useState("2026-08-26");
  const [units, setUnits] = useState(1);
  const [zone, setZone] = useState<PerDiemZone>("city");
  const [route, setRoute] = useState("");
  const [receipt, setReceipt] = useState(false);

  /* ------------------------------- my claims ------------------------------ */
  const [fixes, setFixes] = useState<Record<string, string>>({});
  const [openClaim, setOpenClaim] = useState<string | null>("EX-2085");
  const [claimFilter, setClaimFilter] = useState<ClaimFilter>("All");

  /* ------------------------------ policy tab ------------------------------ */
  const [q, setQ] = useState("");
  const [openExclusion, setOpenExclusion] = useState<string | null>(null);

  /* ------------------------------ derivations ----------------------------- */

  const amt = Math.max(0, Math.round(Number(amount.replace(/[^\d.]/g, "")) || 0));
  const p = policyFor(cat);
  const cap = capFor(cat, zone);
  const perUnit = units > 0 ? Math.round(amt / units) : amt;
  const age = ageOf(dateIso);

  const pending: CheckInput = useMemo(() => ({
    id: "NEW",
    iso: dateIso,
    category: cat,
    merchant: merchant.trim(),
    amountNaira: amt,
    units,
    zone: cat === "per-diem" ? zone : undefined,
    receipt,
    route: cat === "travel-air" ? route.trim() || undefined : undefined,
    ageDays: age,
  }), [dateIso, cat, merchant, amt, units, zone, receipt, route, age]);

  /** THE LIVE CHECK. Recomputed on every keystroke, against her own draft lines. */
  const live = useMemo(() => checkLine(pending, draftLines), [pending, draftLines]);
  const started = amt > 0 && merchant.trim().length > 0;

  const draftTotal = draftLines.reduce((a, l) => a + l.amountNaira, 0);
  const draftChain = approvalChainFor(draftTotal);
  const draftFlagged = draftLines.filter((l) => l.verdict !== "ok");

  /** A submitted or draft claim, with any receipt she attached in this session applied. */
  const resolve = (c: Claim): Claim => {
    const lines = c.lines.map((l) => {
      const ref = fixes[`${c.id}/${l.id}`];
      if (!ref) return l;
      const next: ExpenseLine = { ...l, receipt: true, receiptRef: ref };
      const v = checkLine(next, c.lines);
      return { ...next, verdict: v.verdict, reason: v.reason };
    });
    return { ...c, lines, totalNaira: lines.reduce((a, l) => a + l.amountNaira, 0) };
  };

  const liveDraft: Claim = { ...SEED_DRAFT, lines: draftLines, totalNaira: draftTotal };

  const myClaims: Claim[] = useMemo(() => {
    const head = submitted ?? liveDraft;
    return [head, ...OTHER_CLAIMS].map(resolve);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, draftLines, fixes]);

  const visibleClaims = myClaims.filter((c) =>
    claimFilter === "All" ? true : claimFilter === "Paid" ? c.state === "Paid" : c.state !== "Paid",
  );

  const awaiting = myClaims.filter((c) => c.state === "Submitted" || c.state === "Approved");
  const awaitingTotal = awaiting.reduce((a, c) => a + c.totalNaira, 0);
  const paidTotal = myClaims.filter((c) => c.state === "Paid").reduce((a, c) => a + c.totalNaira, 0);
  const allFlagged = myClaims.flatMap((c) => flaggedLines(c).map((l) => ({ c, l })));
  /** Hers to act on: a receipt she can attach, or a line she can pull from a draft. */
  const mineToFix = allFlagged.filter(({ c, l }) => l.verdict === "missing-receipt" || c.state === "Draft").length;

  const policyRows = EXPENSE_POLICY.filter((row) =>
    q.trim() === "" ? true : `${row.name} ${row.note} ${row.capBasis}`.toLowerCase().includes(q.trim().toLowerCase()),
  );

  /* --------------------------------- actions ------------------------------- */

  const resetForm = () => {
    setAmount(""); setMerchant(""); setRoute(""); setReceipt(false); setUnits(1);
  };

  const addLine = () => {
    if (amt <= 0) { toast("Put an amount on the line before you add it", "danger"); return; }
    if (!merchant.trim()) { toast("Who did you pay? The merchant is what makes a line checkable", "danger"); return; }
    const l: ExpenseLine = {
      id: `L-${seq}`,
      iso: dateIso,
      date: fmtDate(dateIso),
      category: cat,
      merchant: merchant.trim(),
      amountNaira: amt,
      units: units > 1 ? units : undefined,
      zone: cat === "per-diem" ? zone : undefined,
      receipt,
      receiptRef: receipt ? `RC-90${360 + seq}` : undefined,
      route: cat === "travel-air" ? route.trim() || undefined : undefined,
      ageDays: age,
      verdict: live.verdict,
      reason: live.reason,
    };
    setDraftLines((prev) => [...prev, l]);
    setSeq((n) => n + 1);
    resetForm();
    toast(
      l.verdict === "ok"
        ? `${nairaExact(l.amountNaira)} added and it clears policy — nothing for ${first(MY_MANAGER.name)} to rule on there`
        : `${nairaExact(l.amountNaira)} added, flagged ${VERDICT_LABEL[l.verdict].toLowerCase()}. It still submits — the flag is a note to your approver, not a rejection`,
      l.verdict === "ok" ? "success" : "default",
    );
  };

  const removeLine = (id: string) => {
    const gone = draftLines.find((l) => l.id === id);
    setDraftLines((prev) => prev.filter((l) => l.id !== id));
    if (gone) toast(`${gone.merchant} removed. Draft total is now ${nairaExact(draftTotal - gone.amountNaira)}`);
  };

  const attachReceipt = (c: Claim, l: ExpenseLine) => {
    const ref = `RC-90${412 + Object.keys(fixes).length}`;
    setFixes((prev) => ({ ...prev, [`${c.id}/${l.id}`]: `${ref} · attached Aug 28` }));
    toast(`Receipt ${ref} attached to ${l.merchant}. The line cleared — ${first(MY_MANAGER.name)} has one flag fewer to rule on`, "success");
  };

  const submitDraft = () => {
    if (draftLines.length === 0) { toast("There is nothing to submit — a claim needs at least one line", "danger"); return; }
    const chain = approvalChainFor(draftTotal);
    const c: Claim = {
      ...SEED_DRAFT,
      lines: draftLines,
      totalNaira: draftTotal,
      state: "Submitted",
      submitted: REWARDS_TODAY,
      approvals: [
        { role: "Manager", who: MY_MANAGER.name, state: "pending", note: `With her from ${REWARDS_TODAY}.${draftFlagged.length > 0 ? ` ${draftFlagged.length} flagged ${draftFlagged.length === 1 ? "line" : "lines"} to rule on.` : " Nothing flagged."}` },
        chain.needsFinance
          ? { role: "Finance", who: "Finance · second approver", state: "pending", note: `Required — ${nairaExact(draftTotal)} is over the ${nairaExact(APPROVAL_THRESHOLD)} threshold.` }
          : { role: "Finance", who: "—", state: "not-required", note: `${nairaExact(draftTotal)} is under the ${nairaExact(APPROVAL_THRESHOLD)} threshold. One approval, and done.` },
      ],
      note: "Submitted from this page in this session. Every line was checked as it was typed, so nothing in it is a surprise to you.",
    };
    setSubmitted(c);
    setOpenClaim(c.id);
    setClaimFilter("All");
    setTab("claims");
    toast(`${SEED_DRAFT.id} sent to ${MY_MANAGER.name} — ${nairaExact(draftTotal)} across ${draftLines.length} lines, ${chain.steps === 2 ? "manager then Finance" : "manager only"}`, "success");
  };

  const exportCsv = () =>
    toast(`Exported ${myClaims.length} of your claims — the same column shape the ${PAYROLL_ROUTE.toLowerCase()} adapter reads`, "success");

  /* ---------------------------------- view --------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* --------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My expenses</div>
            <PfBadge tone="grey">{ME.id}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>
            Build a claim and see the policy verdict on every line as you type it, watch where each claim actually is, and read
            your caps in naira. Hirebrew runs the claim and the approval chain; the payment leaves through your payroll system
            with the month&rsquo;s run.
          </div>
        </div>
        <PfBtn variant="secondary" icon="calendar" onClick={() => go("myleave")}>My leave</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => setTab("new")}>New claim</PfBtn>
      </div>

      {/* -------------------------------- KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="clock" tone="yellow" label={`With ${first(MY_MANAGER.name)}`}
          value={nairaExact(awaitingTotal)} unit={awaiting.length === 1 ? "1 claim" : `${awaiting.length} claims`}
          delta={awaiting.length === 0 ? "Nothing pending" : `since ${awaiting[0].submitted ?? REWARDS_TODAY}`}
          deltaTone={awaiting.length === 0 ? "grey" : "yellow"}
        />
        <PfStat
          icon="warning" tone={allFlagged.length > 0 ? "red" : "green"} label="Flagged lines"
          value={allFlagged.length} unit={allFlagged.length === 1 ? "line" : "lines"}
          delta={mineToFix > 0 ? `${mineToFix} yours to fix` : "none of them yours"}
          deltaTone={mineToFix > 0 ? "yellow" : "green"}
        />
        <PfStat
          icon="calendar" tone="blue" label="Next payment run"
          value={NEXT_RUN.replace(", 2026", "")} unit={`clear by ${CUTOFF_LABEL}`}
          delta={`every ${PAYMENT_DAY}th`} deltaTone="blue"
        />
        <PfStat
          icon="wallet" tone="green" label="Paid to you"
          value={nairaExact(paidTotal)} unit="this year"
          delta={myClaims.filter((c) => c.state === "Paid").length === 1 ? "1 claim" : `${myClaims.filter((c) => c.state === "Paid").length} claims`}
          deltaTone="green"
        />
      </div>

      {/* ------------------------------ lead insight ----------------------------- */}
      <div style={{ marginTop: 12 }}>
        <PfBanner
          tone={mineToFix > 0 ? "yellow" : "green"}
          icon={mineToFix > 0 ? "warning" : "check"}
          cta="Go to my claims"
          onCta={() => setTab("claims")}
        >
          {mineToFix > 0 ? (
            <>
              {nairaExact(awaitingTotal)} is sitting with {MY_MANAGER.name} and {mineToFix} of the {allFlagged.length} flags on
              your claims {mineToFix === 1 ? "is" : "are"} yours to clear, not hers. Today is the 28th — the {MONTHS[REF_MONTH]} run
              has gone, so the earliest anything approved now can pay is {NEXT_RUN}.
            </>
          ) : (
            <>
              Nothing on your claims is waiting on you. {nairaExact(awaitingTotal)} sits with {MY_MANAGER.name}; if it clears by{" "}
              {CUTOFF_LABEL} it pays with the {NEXT_RUN} run.
            </>
          )}
        </PfBanner>
      </div>

      {/* -------------------------------- page tabs ------------------------------ */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: "new", label: "New claim", count: submitted ? "sent" : String(draftLines.length) },
            { key: "claims", label: "My claims", count: String(myClaims.length) },
            { key: "policy", label: "What I can claim", count: String(EXPENSE_POLICY.length) },
          ]}
        />
      </div>

      {/* ================================ NEW CLAIM =============================== */}
      {tab === "new" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.42fr 1fr", gap: 12, alignItems: "start" }}>
          {/* --------------------------------- builder -------------------------------- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PfCard>
              <PfCardHead
                title="Add a line"
                sub="The policy check runs as you type. You find out about the cap here, not three weeks later from an approver."
              >
                <PfBadge tone={submitted ? "blue" : "grey"}>{submitted ? `${SEED_DRAFT.id} · sent` : `${SEED_DRAFT.id} · ${SEED_DRAFT.period}`}</PfBadge>
              </PfCardHead>

              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* category */}
                <div>
                  <Label hint="nine categories, each with its own published cap">What did you spend on?</Label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {EXPENSE_POLICY.map((row) => (
                      <CatChip key={row.key} k={row.key} active={row.key === cat} onClick={() => setCat(row.key)} />
                    ))}
                  </div>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                    <Note icon={p.icon} tone={CAT_TONE[cat]}>
                      <b>{nairaExact(p.cap)}</b> {p.capBasis}. {RECEIPT_PLAIN[p.receiptRule]}.
                    </Note>
                    <Note icon="book" tone="grey">{p.note}</Note>
                  </div>
                </div>

                {/* the line */}
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
                  <div>
                    <Label hint="who you actually paid">Merchant or description</Label>
                    <input
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      placeholder={cat === "per-diem" ? "Lagos city per-diem" : "Bolt · Ikoyi client visit"}
                      style={INPUT}
                    />
                  </div>
                  <div>
                    <Label hint="naira, no kobo">Amount</Label>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="14200"
                      style={INPUT}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <Label hint={age > CLAIM_WINDOW_DAYS ? `${age} days ago — outside the window` : `${age} days ago · ${CLAIM_WINDOW_DAYS - age} left`}>Date of spend</Label>
                    <input type="date" value={dateIso} onChange={(e) => setDateIso(e.target.value)} style={INPUT} />
                  </div>
                  <div>
                    <Label hint={p.capBasis.replace("per ", "").split(",")[0]}>Units</Label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <PfBtn small variant="secondary" onClick={() => setUnits((n) => Math.max(1, n - 1))}>−</PfBtn>
                      <div style={{ ...INPUT, textAlign: "center", padding: "9px 0", flex: 1 }}>{units}</div>
                      <PfBtn small variant="secondary" onClick={() => setUnits((n) => Math.min(60, n + 1))}>+</PfBtn>
                    </div>
                  </div>
                  <div>
                    <Label hint={p.receiptRule === "never" ? "not expected" : "clears the receipt rule"}>Receipt</Label>
                    <PfBtn
                      full
                      variant={receipt ? "primary" : "secondary"}
                      icon={receipt ? "check" : "file"}
                      onClick={() => setReceipt((v) => !v)}
                      style={{ padding: "9px 12px" }}
                    >
                      {receipt ? "Attached" : p.receiptRule === "never" ? "Not needed" : "Attach"}
                    </PfBtn>
                  </div>
                </div>

                {/* conditional fields */}
                {cat === "per-diem" && (
                  <div>
                    <Label hint="a day offshore and a day in Lagos are not the same economic event">Per-diem zone</Label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
                      {PER_DIEM_LIST.map((r) => {
                        const on = r.zone === zone;
                        return (
                          <button
                            key={r.zone}
                            onClick={() => setZone(r.zone)}
                            style={{
                              fontFamily: "inherit", textAlign: "left", cursor: "pointer",
                              background: on ? "var(--pf-primary-50)" : "var(--pf-n0)",
                              border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                              borderRadius: 10, padding: "10px 12px",
                            }}
                          >
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: on ? "var(--pf-primary-600)" : "var(--pf-n900)" }}>{r.name}</div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", marginTop: 3 }}>{nairaExact(r.rate)}</div>
                            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.4 }}>{r.applies}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {cat === "travel-air" && (
                  <div>
                    <Label hint="the route decides this line, not the fare">Route</Label>
                    <input
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      placeholder="Lagos ↔ Abuja"
                      style={INPUT}
                    />
                    <div style={{ marginTop: 7 }}>
                      <Note icon="warning" tone="yellow">
                        Type <b>Lagos ↔ Port Harcourt</b> to watch the check refuse a perfectly receipted, perfectly
                        under-cap flight. That route is booked through the ops desk and is never claimed back.
                      </Note>
                    </div>
                  </div>
                )}

                {/* ---------------------------- THE LIVE VERDICT ---------------------------- */}
                <div style={{
                  background: started ? TONE[verdictTone(live.verdict)].soft : "var(--pf-n25)",
                  border: `1px solid ${started ? TONE[verdictTone(live.verdict)].line : "var(--pf-n50)"}`,
                  borderRadius: 12, padding: "14px 16px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <Ic name={started ? (live.verdict === "ok" ? "check" : "warning") : "clock"} size={16} color={started ? TONE[verdictTone(live.verdict)].fg : "var(--pf-n400)"} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: started ? TONE[verdictTone(live.verdict)].fg : "var(--pf-n500)" }}>
                      {started ? VERDICT_LABEL[live.verdict] : "Waiting on an amount and a merchant"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <PfBadge tone="grey">live check</PfBadge>
                  </div>

                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 9 }}>
                    {started
                      ? live.reason
                      : `Nothing has been checked yet. When you put a figure in, this box tells you where the line stands against the ${nairaExact(cap)} cap ${cat === "per-diem" ? `for the ${PER_DIEM[zone].name.toLowerCase()} zone` : p.capBasis} — before you submit, not after.`}
                  </div>

                  {started && (
                    <div style={{ marginTop: 13 }}>
                      <CapMeter
                        used={perUnit}
                        cap={cap}
                        tone={CAT_TONE[cat]}
                        caption={units > 1 ? `${nairaExact(perUnit)} per unit across ${units}` : "the cap is checked per unit"}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: 13 }}>
                    <WhyRule
                      claim={started ? `${VERDICT_LABEL[live.verdict]} — ${merchant.trim()}, ${nairaExact(amt)} on ${fmtDate(dateIso)}.` : "Nothing checked yet — the rule is still waiting for a line."}
                      basis={[
                        `Category ${p.name} · published cap ${nairaExact(cap)} ${cat === "per-diem" ? `per day at the ${PER_DIEM[zone].name.toLowerCase()} rate` : p.capBasis}.`,
                        started ? `Your line: ${nairaExact(amt)}${units > 1 ? ` across ${units} units — ${nairaExact(perUnit)} each` : ""}.` : "No amount entered, so no comparison has been made.",
                        `Receipt rule: ${RECEIPT_PLAIN[p.receiptRule].toLowerCase()}. Receipt currently ${receipt ? "attached" : "not attached"}.`,
                        `Dated ${fmtDate(dateIso)} — ${age} ${age === 1 ? "day" : "days"} ago, against a ${CLAIM_WINDOW_DAYS}-day claim window.`,
                        `Duplicate window: your ${draftLines.length} existing draft ${draftLines.length === 1 ? "line was" : "lines were"} compared on category, merchant and amount inside 3 days.`,
                        `Source: ${EXPENSE_POLICY_CARD?.title ?? "Expenses & reimbursement"} (hb-expenses) · ${EXPENSE_POLICY_CARD?.owner ?? "Finance"} · updated ${EXPENSE_POLICY_CARD?.updated ?? "Mar 2026"}.`,
                        "The check read the line only — not your name, grade, department, worker type, performance or claim history.",
                      ]}
                      gate="Whatever this says, a person approves the claim. The check has no authority to reject anything."
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="plus" onClick={addLine}>Add this line</PfBtn>
                  <PfBtn variant="secondary" icon="x" onClick={resetForm}>Clear the form</PfBtn>
                  <span style={{ flex: 1 }} />
                  <PfBtn variant="ghost" icon="clipboard" onClick={() => setTab("policy")}>See every cap</PfBtn>
                </div>
              </div>

              <Foot icon="shield">
                Nothing here is AI. The verdict above is a comparison against a table Finance publishes — nine rules, run in a
                fixed order. A person who is told a model doubted their receipt cannot argue with it; a person who is told{" "}
                {nairaExact(RECEIPT_THRESHOLD)} is the threshold can just attach the receipt.
              </Foot>
            </PfCard>

            {/* ------------------------------ draft lines ------------------------------- */}
            <PfCard>
              <PfCardHead
                title={submitted ? "These lines are with your approver" : "Lines on this claim"}
                sub={submitted
                  ? `${SEED_DRAFT.id} went to ${MY_MANAGER.name} in this session. It is on My claims now.`
                  : `${draftLines.length} ${draftLines.length === 1 ? "line" : "lines"} · ${nairaExact(draftTotal)}. Click any line for the rule that judged it.`}
              >
                {draftFlagged.length > 0
                  ? <PfBadge tone="red" dot>{draftFlagged.length} flagged</PfBadge>
                  : <PfBadge tone="green" dot>All clear</PfBadge>}
              </PfCardHead>

              <div style={{ display: "grid", gridTemplateColumns: "68px 1.6fr 1fr 108px 130px 26px", gap: 10, padding: "10px 20px" }}>
                <PfTh>Date</PfTh>
                <PfTh>Merchant</PfTh>
                <PfTh>Category</PfTh>
                <PfTh style={{ textAlign: "right" }}>Amount</PfTh>
                <PfTh>Policy</PfTh>
                <PfTh />
              </div>

              {draftLines.length === 0 ? (
                <div style={{ padding: "34px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "inline-flex", marginBottom: 10 }}><PfTile icon="wallet" tone="grey" size={34} /></div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                    {submitted ? "This claim has left your hands" : "No lines yet"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 5, maxWidth: 440, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
                    {submitted
                      ? `${SEED_DRAFT.id} is with ${MY_MANAGER.name}. You can start another claim by adding a line above — it will be checked the same way.`
                      : "Nothing is a claim until it has at least one line. Add one above and it is checked the moment you type the amount."}
                  </div>
                </div>
              ) : (
                draftLines.map((l) => (
                  <LineRow key={l.id} l={l} siblings={draftLines} onRemove={submitted ? undefined : () => removeLine(l.id)} />
                ))
              )}

              {draftLines.length > 0 && !submitted && (
                <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>Claim total</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1.2 }}>
                        {nairaExact(draftTotal)}
                      </div>
                    </div>
                    <div style={{ width: 1, alignSelf: "stretch", background: "var(--pf-n50)" }} />
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <PfBadge tone={draftChain.needsFinance ? "yellow" : "green"}>
                          {draftChain.steps} {draftChain.steps === 1 ? "approval" : "approvals"}
                        </PfBadge>
                        <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{draftChain.label}</span>
                      </div>
                      {draftChain.needsFinance && draftTotal - APPROVAL_THRESHOLD < 20_000 && (
                        <div style={{ marginTop: 7 }}>
                          <Note icon="info" tone="yellow">
                            You are {nairaExact(draftTotal - APPROVAL_THRESHOLD)} over the threshold. That is not a reason to
                            split the claim — a split claim is the thing Finance is looking for.
                          </Note>
                        </div>
                      )}
                    </div>
                    <PfBtn variant="secondary" icon="file" onClick={() => toast(`Draft kept on your record — ${draftLines.length} lines, ${nairaExact(draftTotal)}. Nothing has gone to ${first(MY_MANAGER.name)}.`)}>
                      Keep as draft
                    </PfBtn>
                    <PfBtn variant="primary" icon="paperplane" onClick={submitDraft}>
                      Send to {first(MY_MANAGER.name)}
                    </PfBtn>
                  </div>
                </div>
              )}

              {draftFlagged.length > 0 && !submitted && (
                <Foot icon="warning">
                  {draftFlagged.length} flagged {draftFlagged.length === 1 ? "line" : "lines"} on this draft. A flagged line still
                  submits — it goes to {first(MY_MANAGER.name)} with the rule attached. But an out-of-window line will not be
                  approved by anyone, so pulling it now saves everybody the round trip.
                </Foot>
              )}
            </PfCard>
          </div>

          {/* ----------------------------------- rail --------------------------------- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PfCard>
              <PfCardHead title="What the check is" sub="And, more usefully, what it is not." />
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <Note icon="check" tone="green">
                  A rule check. Nine comparisons against a published table, run in a fixed order: exclusions first, then
                  duplicates, then receipts, then the cap. It is deterministic — the same line always gets the same answer.
                </Note>
                <Note icon="warning" tone="yellow">
                  It <b>flags</b>. It never decides. Over cap is not rejected, and a possible duplicate is not a duplicate —
                  both go to a person with the numbers attached.
                </Note>
                <Note icon="shield" tone="grey">
                  It reads the line and your other lines on the same claim. Not your name, your grade, your department, your
                  worker type, your attendance or anything you have claimed before.
                </Note>
                <Note icon="robot" tone="grey">
                  No model card, because no model ran. Nothing on this page appears on the AI surface register.
                </Note>
                <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>Rule table audit</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", marginTop: 1 }}>
                      {AUDIT.lines} lines · {AUDIT.mismatches.length} mismatches
                    </div>
                  </div>
                  <PfBadge tone={AUDIT.clean ? "green" : "red"} dot>{AUDIT.clean ? "Consistent" : "Drifted"}</PfBadge>
                </div>
                <Note icon="info" tone="grey">
                  Across every claim in the register, the verdict stored on a line is the verdict the rule produces when it is
                  re-run. If those two ever disagreed, nothing on this page would be worth reading.
                </Note>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Who approves this" sub={`The ${nairaExact(APPROVAL_THRESHOLD)} line — the same number as your learning threshold.`} />
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_MANAGER.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{MY_MANAGER.role} · your first approver</div>
                  </div>
                  <PfBadge tone="green" dot>In-platform</PfBadge>
                </div>
                <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 9 }}>
                  <Note icon="check" tone={draftChain.needsFinance ? "grey" : "green"}>
                    Under {nairaExact(APPROVAL_THRESHOLD)}: {first(MY_MANAGER.name)} approves and it is done. One step.
                  </Note>
                  <Note icon="users" tone={draftChain.needsFinance ? "yellow" : "grey"}>
                    Over it: Finance is a <b>second, separate</b> approval — not a rubber stamp on your manager&rsquo;s. Your
                    current draft at {nairaExact(draftTotal)} needs {draftChain.steps}.
                  </Note>
                  <Note icon="shield" tone="grey">
                    Your claim is visible to you, your approvers and Finance. Nobody else in Engineering sees it, and every
                    approver&rsquo;s open of it is logged against their name.
                  </Note>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title={HANDOFF_NOTE.headline} sub="The part of this that is not ours." />
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
                  {["Your claim", "Approvals", "Cleared batch", "Your payroll system"].map((s, i, arr) => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap", borderRadius: 999, padding: "4px 10px",
                        color: i === arr.length - 1 ? "var(--pf-n400)" : "var(--pf-n900)",
                        background: "var(--pf-n0)", border: `1px solid ${i === arr.length - 1 ? "var(--pf-n100)" : "var(--pf-n50)"}`,
                        borderStyle: i === arr.length - 1 ? "dashed" : "solid",
                      }}>{s}</span>
                      {i < arr.length - 1 && <Ic name="arrowright" size={13} color="var(--pf-n300)" />}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 12 }}>{HANDOFF_NOTE.body}</div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                  <Note icon="swap" tone="purple">
                    Contract: <b>{HANDOFF_NOTE.contract}</b>, currently routed through the {PAYROLL_ROUTE.toLowerCase()}.
                  </Note>
                  <Note icon="info" tone="grey">{HANDOFF_NOTE.fallback}</Note>
                </div>
              </div>
              <Foot icon="wallet">
                Which payroll system that is has not been decided, and this page does not need to know. It hands over a file of
                cleared claims and records the reference that comes back.
              </Foot>
            </PfCard>
          </div>
        </div>
      )}

      {/* ================================ MY CLAIMS =============================== */}
      {tab === "claims" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="My claims"
              sub={`Everything you have claimed, filtered to ${ME.id}. Click a claim to see exactly where it is and when it pays.`}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <PfTabs tabs={[...CLAIM_FILTERS]} active={claimFilter} onChange={(t) => setClaimFilter(t as ClaimFilter)} />
                <PfBtn small variant="secondary" icon="download" onClick={exportCsv}>Export CSV</PfBtn>
              </div>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "84px 1fr 112px 118px 1.15fr 148px 26px", gap: 10, padding: "10px 20px" }}>
              <PfTh>Claim</PfTh>
              <PfTh>Period</PfTh>
              <PfTh>Lines</PfTh>
              <PfTh style={{ textAlign: "right" }}>Total</PfTh>
              <PfTh>With</PfTh>
              <PfTh>State</PfTh>
              <PfTh />
            </div>

            {visibleClaims.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing in that state</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 5 }}>
                  You have {myClaims.length} claims in total — {myClaims.filter((c) => c.state === "Paid").length} paid,{" "}
                  {myClaims.length - myClaims.filter((c) => c.state === "Paid").length} still moving.
                </div>
              </div>
            ) : (
              visibleClaims.map((c) => (
                <ClaimBlock
                  key={c.id}
                  c={c}
                  open={openClaim === c.id}
                  onToggle={() => setOpenClaim(openClaim === c.id ? null : c.id)}
                  onAttach={(l) => attachReceipt(c, l)}
                  onOpenBuilder={() => setTab("new")}
                />
              ))
            )}
          </PfCard>

          {/* ------------------------- when you actually get paid ------------------------ */}
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead
                title="When you will actually be paid"
                sub="The question everybody asks, answered with the dates rather than a status word."
              />
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
                  {[
                    { k: "Approvals clear by", v: CUTOFF_LABEL, s: `${CUTOFF_LEAD} days before the run` },
                    { k: "Batch leaves", v: `${CUTOFF_LABEL}–${PAYMENT_DAY - 1}`, s: "one file, all cleared claims" },
                    { k: "Money moves", v: NEXT_RUN.replace(", 2026", ""), s: `the ${PAYMENT_DAY}th, every month` },
                  ].map((b) => (
                    <div key={b.k} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{b.k}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", marginTop: 2 }}>{b.v}</div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.4 }}>{b.s}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <Note icon="calendar" tone="blue">
                    Salaries and reimbursements ride the same run on the {PAYMENT_DAY}th. Today is the {REF_DAY}th, so the{" "}
                    {MONTHS[REF_MONTH]} run has already gone out — anything approved from here lands on <b>{NEXT_RUN}</b> at the
                    earliest.
                  </Note>
                  <Note icon="clock" tone="yellow">
                    The {CUTOFF_LABEL} figure is not a policy date, it is what the last two batches actually did: one left{" "}
                    {CUTOFF_LEAD} days before its run, the other {CUTOFF_LEAD - 1}. Clearing by the wider of the two is the safe
                    read.
                  </Note>
                  <Note icon="warning" tone="red">
                    A claim held by one missing receipt does not slip a few days — it slips a whole month, to {RUN_AFTER}. The
                    run does not wait for a claim, which is the entire reason the check now runs while you type.
                  </Note>
                  <Note icon="shield" tone="grey">
                    Hirebrew does not pay you. It hands a cleared batch to your payroll system and records the reference that
                    comes back — which is why a paid claim here shows a reference it did not invent.
                  </Note>
                </div>
              </div>
            </PfCard>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PfCard>
                <PfCardHead title="Batches your claims rode" sub="A batch is a file leaving the building, not a payment." />
                <div style={{ padding: "8px 20px 14px" }}>
                  {PAYMENT_BATCHES.filter((b) => b.claimIds.some((id) => MY_CLAIMS.some((c) => c.id === id))).length === 0 ? (
                    <div style={{ padding: "18px 0", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
                      None of your claims has been batched yet.
                    </div>
                  ) : (
                    PAYMENT_BATCHES
                      .filter((b) => b.claimIds.some((id) => MY_CLAIMS.some((c) => c.id === id)))
                      .map((b) => (
                        <div key={b.id} style={{ padding: "11px 0", borderTop: "1px solid var(--pf-n50)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--pf-n500)" }}>{b.id}</span>
                            <PfBadge tone={b.state === "Paid" ? "green" : "blue"} dot>{b.state}</PfBadge>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{nairaExact(b.totalNaira)}</span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>
                            {b.exportedAt ? `Exported ${b.exportedAt}, ` : "Not exported yet · "}run {b.runDate}
                            {b.paymentRef ? ` · reference ${b.paymentRef} came back from the payroll source` : ""}
                          </div>
                        </div>
                      ))
                  )}
                </div>
                <Foot icon="swap">
                  Routed through {HANDOFF_NOTE.contract} · {PAYROLL_ROUTE}. The batch carries claim id, worker id, period,
                  amount, approval date and approver — and no bank details, ever.
                </Foot>
              </PfCard>

              <PfCard>
                <PfCardHead title="What you can see here" sub="Me-pillar scope, stated plainly." />
                <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                  <Note icon="shield" tone="green">
                    This page renders one person&rsquo;s claims — yours. The register behind it holds {NOT_MINE} other{" "}
                    {NOT_MINE === 1 ? "claim" : "claims"} right now; {NOT_MINE === 1 ? "it is" : "they are"} filtered out by
                    worker id before anything reaches the screen, not hidden by styling.
                  </Note>
                  <Note icon="user" tone="grey">
                    {MY_MANAGER.name} sees your claim because she is your approver. Finance sees it when the total crosses{" "}
                    {nairaExact(APPROVAL_THRESHOLD)}. That is the whole list.
                  </Note>
                  <Note icon="wallet" tone="grey">
                    Your reward statement and your payslips live elsewhere. This page holds what you spent and want back —
                    nothing about what you earn.
                  </Note>
                  <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <PfBtn small variant="secondary" icon="shield" onClick={() => go("myprivacy")}>Your data &amp; privacy</PfBtn>
                    <PfBtn small variant="secondary" icon="user" onClick={() => go("myprofile")}>Your record</PfBtn>
                  </div>
                </div>
              </PfCard>
            </div>
          </div>
        </div>
      )}

      {/* =============================== POLICY TAB =============================== */}
      {tab === "policy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* the handbook card, verbatim */}
          <PfCard>
            <PfCardHead
              title={EXPENSE_POLICY_CARD?.title ?? "Expenses & reimbursement"}
              sub={EXPENSE_POLICY_CARD ? `${EXPENSE_POLICY_CARD.owner} · updated ${EXPENSE_POLICY_CARD.updated}` : "Company handbook"}
            >
              <PfBadge tone="grey">hb-expenses</PfBadge>
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 13.5, color: "var(--pf-n600)", lineHeight: 1.7 }}>
                {EXPENSE_POLICY_CARD?.body ??
                  "Claim inside 30 days of the spend. Anything above ₦10,000 needs a receipt attached. Lagos ↔ Port Harcourt travel is booked through the ops desk, not claimed back. Approved claims are reimbursed with the payroll run on the 25th."}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginTop: 16 }}>
                {[
                  { k: "Claim window", v: `${CLAIM_WINDOW_DAYS} days`, s: "from the date of the spend", icon: "clock", tone: "yellow" as PfTone },
                  { k: "Receipt threshold", v: nairaExact(RECEIPT_THRESHOLD), s: "above this, always attach one", icon: "file", tone: "blue" as PfTone },
                  { k: "Second approval", v: nairaExact(APPROVAL_THRESHOLD), s: "above this, Finance too", icon: "users", tone: "purple" as PfTone },
                  { k: "Paid on", v: `the ${PAYMENT_DAY}th`, s: "with the month's payroll run", icon: "wallet", tone: "green" as PfTone },
                ].map((b) => (
                  <div key={b.k} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PfTile icon={b.icon} tone={b.tone} size={24} />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{b.k}</span>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", marginTop: 8, letterSpacing: "-.3px" }}>{b.v}</div>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.4 }}>{b.s}</div>
                  </div>
                ))}
              </div>
            </div>
            <Foot icon="book">
              These four numbers are the whole of the policy most people need. Everything below is the same policy applied
              category by category — in naira, not in clauses.
            </Foot>
          </PfCard>

          {/* the caps table */}
          <PfCard>
            <PfCardHead title="Your caps, in naira" sub={`${policyRows.length} of ${EXPENSE_POLICY.length} categories. The cap is checked per unit, not per claim.`}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Filter categories…"
                    style={{ ...INPUT, width: 210, padding: "7px 11px 7px 30px", fontSize: 12.5 }}
                  />
                  <span style={{ position: "absolute", left: 9, top: 8 }}><Ic name="search" size={14} color="var(--pf-n300)" /></span>
                </div>
                {q && <PfBtn small variant="secondary" icon="x" onClick={() => setQ("")}>Clear</PfBtn>}
              </div>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 130px 1.1fr 1.5fr", gap: 12, padding: "10px 20px" }}>
              <PfTh>Category</PfTh>
              <PfTh style={{ textAlign: "right" }}>Cap</PfTh>
              <PfTh>Receipt</PfTh>
              <PfTh>What it means for you</PfTh>
            </div>

            {policyRows.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing matches &ldquo;{q}&rdquo;</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 5 }}>
                  If a spend has no category here, it is not claimable — see the five exclusions below before you assume it is.
                </div>
              </div>
            ) : (
              policyRows.map((row) => (
                <PolicyRow key={row.key} row={row} onUse={() => { setCat(row.key); setTab("new"); }} />
              ))
            )}
          </PfCard>

          {/* per diem + exclusions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="Per-diem is a rate, not a reimbursement" sub="Three zones, because three days are not the same day." />
              <div style={{ padding: "8px 20px 16px" }}>
                {PER_DIEM_LIST.map((r) => (
                  <div key={r.zone} style={{ padding: "13px 0", borderTop: "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 0 }}>{r.name}</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{nairaExact(r.rate)}</span>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>per day</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.5 }}>
                      <b style={{ color: "var(--pf-n600)" }}>{r.applies}.</b> {r.note}
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)" }}>
                  <Note icon="info" tone="green">
                    You will not usually claim these — they belong to site and rotation work. A full 28-day offshore tour at the
                    offshore rate is {nairaExact(PER_DIEM.offshore.rate * 28)}, which is the largest routine claim in the
                    company and the reason the cap is checked per day rather than per claim.
                  </Note>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Things that are not claims" sub="Where the spend was fine and the claim is still wrong.">
                <PfBadge tone="red">{POLICY_EXCLUSIONS.length}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "8px 20px 16px" }}>
                {POLICY_EXCLUSIONS.map((x) => {
                  const on = openExclusion === x.id;
                  return (
                    <div key={x.id} style={{ borderTop: "1px solid var(--pf-n50)" }}>
                      <button
                        onClick={() => setOpenExclusion(on ? null : x.id)}
                        style={{ fontFamily: "inherit", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 0", display: "flex", alignItems: "center", gap: 9 }}
                      >
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", width: 34, flex: "none" }}>{x.id}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 0 }}>{x.name}</span>
                        <Ic name={on ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
                      </button>
                      {on && (
                        <div style={{ paddingBottom: 13 }}>
                          <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>{x.rule}</div>
                          <div style={{ marginTop: 8 }}><Note icon="book" tone="grey">{x.source}</Note></div>
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)" }}>
                  <Note icon="warning" tone="red">
                    A fully receipted, well-under-cap flight on the wrong route is still refused. The amount was never the
                    question — which is why the check runs the exclusions before it ever looks at a number.
                  </Note>
                </div>
              </div>
            </PfCard>
          </div>

          <PfBanner tone="green" icon="check" cta="Start a line" onCta={() => setTab("new")}>
            {ME_FIRST}, this ships when you can read your cap before you spend, watch the verdict land as you type, and know the
            date the money moves — instead of finding all three out from a rejection.
          </PfBanner>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- policy row -------------------------------- */

function PolicyRow({ row, onUse }: { row: (typeof EXPENSE_POLICY)[number]; onUse: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[CAT_TONE[row.key]];
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: "1.5fr 130px 1.1fr 1.5fr", gap: 12, alignItems: "start",
        padding: "14px 20px", borderTop: "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "var(--pf-n0)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <PfTile icon={row.icon} tone={CAT_TONE[row.key]} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{row.name}</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{row.capBasis}</div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{nairaExact(row.cap)}</div>
        {row.key === "per-diem" && (
          <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 2 }}>highest zone</div>
        )}
      </div>
      <div>
        <PfBadge tone={RECEIPT_TONE[row.receiptRule]}>{RECEIPT_PLAIN[row.receiptRule]}</PfBadge>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{row.note}</div>
        {hovered && (
          <div style={{ marginTop: 8 }}>
            <PfBtn small variant="secondary" icon="plus" onClick={onUse} style={{ color: t.fg }}>
              Claim this
            </PfBtn>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- claim block ------------------------------- */

function ClaimBlock({ c, open, onToggle, onAttach, onOpenBuilder }: {
  c: Claim; open: boolean; onToggle: () => void; onAttach: (l: ExpenseLine) => void; onOpenBuilder: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const flagged = flaggedLines(c);
  const step = FLOW.indexOf(c.state);
  const pendingStep = c.approvals.find((a) => a.state === "pending");

  const holder = (() => {
    if (c.state === "Draft") return { who: "You", sub: "Not submitted — nobody is waiting on it" };
    if (c.state === "Paid") return { who: "Nobody — it is done", sub: `Paid ${c.paidOn}` };
    if (c.state === "Queued for payment") return { who: `Batch ${c.batchId}`, sub: "Cleared, waiting on the run" };
    if (pendingStep) return { who: pendingStep.who, sub: `${pendingStep.role} approval` };
    return { who: "Finance", sub: "Second approval" };
  })();

  const payLine = (() => {
    if (c.state === "Paid") return `Paid ${c.paidOn} against ${c.paymentRef}. That reference came back from your payroll system — this page recorded it, it did not create it.`;
    if (c.state === "Queued for payment") {
      const b = PAYMENT_BATCHES.find((x) => x.id === c.batchId);
      return `Cleared and sitting in ${c.batchId}. It leaves before the ${b?.runDate ?? NEXT_RUN} run and pays with it.`;
    }
    if (c.state === "Draft") return "Nothing is scheduled, because a draft is not a claim. The clock starts when you send it.";
    return `If both approvals land by ${CUTOFF_LABEL}, this pays on ${NEXT_RUN}. If they slip past the cut-off it waits for ${RUN_AFTER} — the run does not wait for a claim.`;
  })();

  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "84px 1fr 112px 118px 1.15fr 148px 26px", alignItems: "center",
          gap: 10, padding: "13px 20px", cursor: "pointer",
          background: open || hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--pf-n500)" }}>{c.id}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.period}</span>
        <span style={{ fontSize: 12.5, color: "var(--pf-n500)" }}>
          {c.lines.length}
          {flagged.length > 0 && <span style={{ color: "var(--pf-red-500)", fontWeight: 700 }}> · {flagged.length} flagged</span>}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", textAlign: "right" }}>{nairaExact(c.totalNaira)}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{holder.who}</span>
          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{holder.sub}</span>
        </span>
        <span><PfBadge tone={claimStateTone(c.state)} dot>{c.state}</PfBadge></span>
        <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
          <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
        </span>
      </div>

      {open && (
        <div style={{ padding: "4px 20px 20px", background: "var(--pf-n25)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* timeline */}
            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 12 }}>Where this claim is</div>
              {FLOW.map((s, i) => {
                const meta = FLOW_META[s];
                const state: "done" | "next" | "wait" = step > i ? "done" : step === i ? (s === "Paid" ? "done" : "next") : "wait";
                const when =
                  s === "Submitted" ? (c.submitted ? `Sent ${c.submitted}` : "Not sent yet")
                    : s === "Approved" ? (c.approvedAt ? `Approved ${c.approvedAt}` : pendingStep ? `With ${pendingStep.who}` : "Not yet")
                      : s === "Queued for payment" ? (c.batchId ? `In ${c.batchId}` : "Not batched")
                        : c.paidOn ? `Paid ${c.paidOn}` : `Earliest ${NEXT_RUN}`;
                return (
                  <Step
                    key={s}
                    icon={meta.icon}
                    tone={meta.tone}
                    state={state}
                    last={i === FLOW.length - 1}
                    title={s}
                    sub={<><b style={{ color: "var(--pf-n600)" }}>{when}.</b> {meta.what}</>}
                  />
                );
              })}
            </div>

            {/* approvals + payment */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 10 }}>The approval chain</div>
                {c.approvals.map((a) => (
                  <div key={a.role} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 0", borderTop: "1px solid var(--pf-n50)" }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", flex: "none", marginTop: 5,
                      background: a.state === "approved" ? "var(--pf-primary-500)" : a.state === "pending" ? "var(--pf-yellow-500)" : a.state === "rejected" ? "var(--pf-red-500)" : "var(--pf-n300)",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.role} · {a.who}</span>
                        <PfBadge tone={a.state === "approved" ? "green" : a.state === "pending" ? "yellow" : a.state === "rejected" ? "red" : "grey"}>
                          {a.state === "not-required" ? "Not required" : a.state === "pending" ? "Pending" : a.state === "approved" ? `Approved ${a.at ?? ""}`.trim() : "Rejected"}
                        </PfBadge>
                      </div>
                      {a.note && <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{a.note}</div>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <PfTile icon="calendar" tone={c.state === "Paid" ? "green" : "blue"} size={26} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>When you get the money</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>{payLine}</div>
                {c.note && (
                  <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                    <Note icon="info" tone="grey">{c.note}</Note>
                  </div>
                )}
                {c.state === "Draft" && (
                  <div style={{ marginTop: 12 }}>
                    <PfBtn small variant="primary" icon="arrowright" onClick={onOpenBuilder}>Continue this draft</PfBtn>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* lines */}
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 20px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>
                {c.lines.length} {c.lines.length === 1 ? "line" : "lines"} on {c.id}
              </span>
              {flagged.length > 0
                ? <PfBadge tone="red" dot>{flagged.length} flagged</PfBadge>
                : <PfBadge tone="green" dot>All clear</PfBadge>}
            </div>
            {c.lines.map((l) => (
              <LineRow
                key={l.id}
                l={l}
                siblings={c.lines}
                onAttach={c.state === "Paid" ? undefined : () => onAttach(l)}
              />
            ))}
            {flagged.length > 0 && (
              <Foot icon="warning">
                A flagged line does not stop the claim — it goes to the approver with the rule attached, and they rule on it.
                The one exception you can act on yourself is a missing receipt: attach it and the line clears on the spot.
              </Foot>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
