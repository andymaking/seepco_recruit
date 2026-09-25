"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  CLAIMS, PAYMENT_BATCHES, EXPENSE_POLICY, PER_DIEM, PER_DIEM_LIST, POLICY_EXCLUSIONS,
  RECEIPT_THRESHOLD, CLAIM_WINDOW_DAYS, PAYMENT_DAY, APPROVAL_THRESHOLD, PAYROLL_ROUTE,
  BATCH_CSV_SAMPLE, HANDOFF_NOTE, REWARDS_TODAY, VERDICT_LABEL,
  approvalChainFor, checkLine, claimStateTone, claimKpis, flaggedLines, nairaExact,
  policyFor, verdictTone, POLICY_AUDIT,
  type Claim, type ClaimState, type ExpenseCategoryKey, type ExpenseLine, type ExpenseVerdict,
  type PaymentBatch, type PerDiemZone, type CheckInput,
} from "@/data/rewards";
import { adapterFor } from "@/data/adapters";
import { companyById, personById, workerById, WORKER_TYPE_LABEL } from "@/data/workforce";
import { MODEL_CARDS, type WhyThis } from "@/data/trust";

/**
 * Expenses — PRD v2.1 FR-096, the APPROVER and FINANCE side of the claim.
 *
 * Three arguments, one per tab, and the page is built to make each of them
 * hard to miss:
 *
 * 1. THE VERDICT IS A RULE, NOT A MODEL. Every flag on this page came out of
 *    `checkLine()` — nine lines of comparison against a table the claimant can
 *    read. The page says so on every flag, in those words, because "AI flagged
 *    your expense" and "₦14,200 is above the ₦10,000 receipt threshold" are
 *    materially different things to say to a person. The first cannot be argued
 *    with. The second can be fixed in thirty seconds.
 *
 * 2. THE ENGINE FLAGS; A HUMAN DECIDES. Nothing here auto-rejects. Over cap is
 *    not rejected. Possible duplicate is not duplicate. A rejection needs a
 *    named person and a typed reason, and the reason travels to the claimant.
 *
 * 3. HIREBREW DOES NOT MOVE THE MONEY. The batch tab is a file leaving the
 *    building through the `payroll_connector` contract. This platform does not
 *    compute pay, hold funds, or store a bank detail. The payment reference on a
 *    paid claim came BACK from the connected payroll source.
 *
 * The one AI output on this page is the note to the claimant after a human has
 * already decided — MC-05, drafted from the approver's own typed reason, with
 * the FR-093 "Why this?" affordance attached. It writes the sentence. It does
 * not write the decision and it did not produce the verdict.
 *
 * Vendor-neutral by release doctrine: the payroll vendor decision is open, so
 * no vendor is named anywhere on this surface.
 */

/* --------------------------------- constants ------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const TODAY = REWARDS_TODAY;
const MC05 = MODEL_CARDS.find((m) => m.id === "MC-05")!;

const AUDIT = POLICY_AUDIT();

/** The worked example the exclusions copy points at — read, not retyped. */
const EXCLUDED_FLIGHT = CLAIMS.flatMap((c) => c.lines).find((l) => l.verdict === "outside-policy" && !!l.route);
const KPIS = claimKpis();

/** Count only. The providers awaiting access are deliberately NOT named while the vendor decision is open. */
const CONNECTOR_LADDER = adapterFor("payroll_connector");
const CONNECTOR_AWAITING = CONNECTOR_LADDER.filter((a) => a.state !== "live").length;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number | string) => String(n).padStart(2, "0");
/** "Aug 2026" → "2026-08", the period column the connector's CSV carries. */
const isoPeriod = (p: string) => {
  const [m, y] = p.split(" ");
  return `${y}-${pad2(MONTHS.indexOf(m) + 1)}`;
};
/** "Aug 5, 2026" → "2026-08-05". */
const isoDate = (d?: string) => {
  if (!d) return "";
  const m = MONTHS.indexOf(d.slice(0, 3));
  const day = d.slice(4).split(",")[0].trim();
  return `${d.slice(-4)}-${pad2(m + 1)}-${pad2(day)}`;
};

const first = (n: string) => n.split(" ")[0];

/** "Finance · Kemi Salami" → Kemi Salami. "Yusuf Lawal · Drilling Support" → Yusuf Lawal. */
const shortWho = (w: string): string => {
  const parts = w.split("·").map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? w;
  return /^(finance|finance controls|people ops|hr)$/i.test(parts[0]) ? parts[1] : parts[0];
};

/**
 * The two approval seats. Which one you are sitting in decides what you can
 * approve — Finance is a SECOND approval, and a second approval that can be
 * given before the first is not a control, it is a formality.
 */
const ROLES = ["Manager", "Finance"] as const;
type Role = (typeof ROLES)[number];

const stepOwner = (c: Claim, r: Role): string => {
  const raw = (c.approvals.find((a) => a.role === r)?.who ?? "").trim();
  if (!raw || raw === "—") return `${r} · unassigned`;
  return `${r} · ${shortWho(raw)}`;
};

/** Session stamps derived from ledger length so SSR and the client agree. */
const stampAt = (n: number) => {
  const mins = 5 + n * 6;
  return `Aug 28 · ${pad2(9 + Math.floor(mins / 60))}:${pad2(mins % 60)}`;
};

const fieldStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 10px", outline: "none", width: "100%",
};

/* ------------------------------ verdict doctrine --------------------------- */

type VerdictMeta = {
  icon: string;
  rule: string;
  /** The thing a person can actually do about it. */
  clears: string;
  /** The claim this verdict is NOT making. R3, stated per verdict. */
  isNot: string;
  work: "document" | "decision" | "unfixable" | "none";
};

const VERDICT_META: Record<ExpenseVerdict, VerdictMeta> = {
  ok: {
    icon: "check",
    rule: "Amount per unit is at or under the published cap, and the receipt rule for the category is satisfied.",
    clears: "Nothing to do. It goes to the approver with the rest of the claim.",
    isNot: "Within policy is not approved. A clean line still needs a person to approve the claim it sits in.",
    work: "none",
  },
  "over-cap": {
    icon: "trend",
    rule: "Amount ÷ units is above the published cap for the category. The cap is per unit, not per line.",
    clears: "The approver rules on it: approve the overage with a note, or reject the line and say why.",
    isNot: "Over cap is NOT rejected. The system has no authority to refuse a line and does not claim any.",
    work: "decision",
  },
  "missing-receipt": {
    icon: "file",
    rule: `Above the ${nairaExact(RECEIPT_THRESHOLD)} receipt threshold with no receipt attached, or in a category where the receipt is the control at any amount.`,
    clears: "Attach the receipt and the line clears itself. Nothing else about it is out of policy.",
    isNot: "A missing receipt is not a suspicion about the claimant. It is a missing document, and it is the cheapest flag on this page to clear.",
    work: "document",
  },
  "duplicate-suspected": {
    icon: "swap",
    rule: "An EARLIER line in the same claim matches on category, merchant and amount inside a 3-day window. Only the later line is flagged; the first one stands.",
    clears: "The approver rules on it. Two identical airport transfers on consecutive days is a normal week for a field lead.",
    isNot: "Suspected is not duplicate. The rule has no idea whether the same trip happened twice — it can only see that two lines look alike.",
    work: "decision",
  },
  "outside-policy": {
    icon: "warning",
    rule: "A named exclusion fired: the spend was outside the claim window, or it is on the list of things that are provisioned or booked centrally and never claimed back.",
    clears: "Nothing attached to the line will change this. The route back is the ops desk, HSE, IT or L&D — whichever should have carried the spend in the first place.",
    isNot: "Outside policy is not misconduct. Most of these are somebody using their own card because they were in a hurry.",
    work: "unfixable",
  },
};

/** What `checkLine()` reads — and, more to the point, what it cannot. */
const CHECK_READS = [
  "The line's category, merchant, amount, units and per-diem zone",
  "Whether a receipt is attached, and its reference",
  "The spend date, as days between the spend and submission",
  "The route, on a flight line only",
  "The other lines in the same claim, for the duplicate window",
];

const CHECK_NEVER_READS = [
  "The claimant's name, grade, department or location",
  "Worker type — an employee, a contractor and an NYSC intern get the identical check",
  "Nationality and host community — NCDMB reporting fields, never inputs",
  "Performance rating, engagement score or leave-risk tier",
  "Attendance signals, open cases, or anything from the helpdesk",
  "The claimant's own claim history — a line is checked on its own facts",
];

/* --------------------------------- filters --------------------------------- */

const QUEUE_VIEWS = ["Awaiting a decision", "Flagged lines only", "Cleared, not yet paid", "Everything"] as const;
type QueueView = (typeof QUEUE_VIEWS)[number];

const VERDICT_ORDER: ExpenseVerdict[] = ["over-cap", "missing-receipt", "duplicate-suspected", "outside-policy", "ok"];

/* ================================ small parts =============================== */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Money({ n, size = 13, dim }: { n: number; size?: number; dim?: boolean }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: size, fontWeight: 600, color: dim ? "var(--pf-n400)" : "var(--pf-n900)", letterSpacing: "-.2px", whiteSpace: "nowrap" }}>
      {nairaExact(n)}
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

/**
 * THE RULE TRACE. Deliberately NOT purple and deliberately not called an
 * explanation: it is a receipt for a comparison. It re-runs `checkLine()` live
 * in front of the reader and shows that the answer did not move.
 */
function RuleTrace({ line, siblings }: { line: ExpenseLine; siblings: ExpenseLine[] }) {
  const [open, setOpen] = useState(false);
  const meta = VERDICT_META[line.verdict];
  const p = policyFor(line.category);
  const rerun = checkLine(line, siblings);
  const agrees = rerun.verdict === line.verdict;
  const cap = line.category === "per-diem" && line.zone ? PER_DIEM[line.zone].rate : p.cap;
  const basis = line.category === "per-diem" && line.zone ? `per day, ${PER_DIEM[line.zone].name.toLowerCase()} zone rate` : p.capBasis;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
          color: "var(--pf-n900)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-n100)",
          borderRadius: 5, padding: "3px 8px", cursor: "pointer",
        }}
      >
        <Ic name="clipboard" size={12} color="var(--pf-n900)" />
        {line.verdict === "ok" ? "Why it cleared" : "Why flagged?"}
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-n400)" />
      </button>

      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderLeft: "3px solid var(--pf-n900)", borderRadius: 10, padding: "13px 15px", marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <PfBadge tone="grey">Deterministic rule check</PfBadge>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-n900)" }}>
              Flagged by policy rule, not by a model.
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: agrees ? "var(--pf-primary-600)" : "var(--pf-red-500)" }}>
              <Ic name={agrees ? "check" : "warning"} size={12} color={agrees ? "var(--pf-primary-500)" : "var(--pf-red-500)"} weight={2.2} />
              re-run just now · {agrees ? "same verdict" : "MISMATCH"}
            </span>
          </div>

          <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.6, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "10px 12px" }}>
            {rerun.reason}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
            <div>
              <Label>The rule that fired</Label>
              <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>{meta.rule}</div>
            </div>
            <div>
              <Label>The published number</Label>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <Money n={cap} size={14} />
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{basis}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>
                Source: {p.name} · Handbook, Expenses &amp; reimbursement (hb-expenses). The claimant reads the same table you do.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)" }}>
            <div>
              <Label>What the check read</Label>
              {CHECK_READS.map((r) => (
                <div key={r} style={{ display: "flex", gap: 7, fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.5, marginBottom: 4 }}>
                  <Ic name="check" size={11} color="var(--pf-primary-500)" weight={2.4} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
            <div>
              <Label>What it could not see</Label>
              {CHECK_NEVER_READS.map((r) => (
                <div key={r} style={{ display: "flex", gap: 7, fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5, marginBottom: 4 }}>
                  <Ic name="x" size={11} color="var(--pf-n300)" weight={2.4} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-n50)" }}>
            <Ic name="shield" size={14} color="var(--pf-n900)" />
            <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
              <b style={{ color: "var(--pf-n900)" }}>{meta.isNot}</b>{" "}
              {meta.clears} Same inputs, same verdict, every time — there is no confidence score here to argue with, only a number and where it came from.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** The one FR-093 affordance on this page, for the one AI output on this page. */
function WhyThisPanel({ why }: { why: WhyThis }) {
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
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>Basis</div>
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
              Model card {why.modelCard} · {MC05.name}
            </button>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Human gate: {why.humanGate.toLowerCase()}.</span>
          </div>
        </div>
      )}
    </>
  );
}

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

/** Manager → Finance, and whether the second step exists at all. */
function ApprovalRail({ c }: { c: Claim }) {
  const chain = approvalChainFor(c.totalNaira);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {c.approvals.map((a, i) => {
        const tone: PfTone = a.state === "approved" ? "green" : a.state === "rejected" ? "red" : a.state === "not-required" ? "grey" : "yellow";
        const dim = a.state === "not-required";
        return (
          <span key={a.role} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span
              title={a.note ?? ""}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 11px", borderRadius: 999,
                background: dim ? "var(--pf-n25)" : TONE[tone].soft, border: `1px solid ${dim ? "var(--pf-n50)" : TONE[tone].line}`,
                opacity: dim ? 0.75 : 1,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[tone].bg }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: dim ? "var(--pf-n400)" : TONE[tone].fg }}>{a.role}</span>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                {a.state === "not-required" ? "not required" : a.state === "approved" ? `${shortWho(a.who)} · ${a.at}` : a.state === "rejected" ? `rejected · ${a.at}` : `with ${shortWho(a.who)}`}
              </span>
            </span>
            {i < c.approvals.length - 1 && <span style={{ width: 16, height: 1, background: "var(--pf-n100)" }} />}
          </span>
        );
      })}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{chain.label}</span>
    </div>
  );
}

function ClaimRow({ c, on, onPick, decided }: { c: Claim; on: boolean; onPick: () => void; decided: number }) {
  const { hovered, hoverProps } = useHover();
  const flags = flaggedLines(c);
  const w = workerById(c.claimantId);
  return (
    <div
      {...hoverProps}
      onClick={onPick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", cursor: "pointer",
        borderTop: "1px solid var(--pf-n50)",
        background: on || hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: on ? "inset 3px 0 0 var(--pf-n900)" : "none",
        transition: "background .12s ease",
      }}
    >
      <PfAvatar init={c.init} tone={c.tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.claimant}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{c.id}</span>
          {w && w.workerType !== "employee" && <PfBadge tone="grey">{WORKER_TYPE_LABEL[w.workerType]}</PfBadge>}
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.role} · {c.period} · {c.lines.length} lines · {c.submitted ? `submitted ${c.submitted}` : "not submitted"}
        </div>
      </div>
      <div style={{ width: 108, flex: "none", textAlign: "right" }}>
        <Money n={c.totalNaira} />
      </div>
      <div style={{ width: 118, flex: "none", display: "flex", justifyContent: "flex-end" }}>
        {flags.length > 0 ? (
          <PfBadge tone={decided >= flags.length ? "green" : "yellow"} dot>
            {decided >= flags.length ? `${flags.length} ruled on` : `${flags.length - decided} to rule on`}
          </PfBadge>
        ) : (
          <PfBadge tone="grey">no flags</PfBadge>
        )}
      </div>
      <div style={{ width: 138, flex: "none", display: "flex", justifyContent: "flex-end" }}>
        <PfBadge tone={claimStateTone(c.state)} dot>{c.state}</PfBadge>
      </div>
      <Ic name="caretright" size={14} color="var(--pf-n300)" />
    </div>
  );
}

/* ================================== screen ================================== */

export default function Expenses() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("queue");

  /* ---- queue state ---- */
  const [claims, setClaims] = useState<Claim[]>(CLAIMS);
  const [batches, setBatches] = useState<PaymentBatch[]>(PAYMENT_BATCHES);
  const [sel, setSel] = useState("EX-2085");
  const [role, setRole] = useState<Role>("Manager");
  const [view, setView] = useState<QueueView>(QUEUE_VIEWS[0]);
  const [vFilter, setVFilter] = useState<ExpenseVerdict | "all">("all");
  const [q, setQ] = useState("");

  /* ---- per-line decisions, keyed claimId/lineId ---- */
  type LineCall = { state: "approved" | "rejected"; reason?: string; by: string; at: string };
  const [calls, setCalls] = useState<Record<string, LineCall>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [lineReason, setLineReason] = useState("");

  /* ---- claim-level decision ---- */
  const [claimReason, setClaimReason] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [draftFor, setDraftFor] = useState<string | null>(null);

  /* ---- ledger: real approvals off the spine, plus this session's own ---- */
  type LedgerRow = { at: string; who: string; action: string; tone: PfTone };
  const SEEDED_LEDGER = useMemo<LedgerRow[]>(
    () =>
      CLAIMS.flatMap((c) =>
        c.approvals
          .filter((a) => a.state === "approved" && a.at)
          .map((a) => ({ at: a.at!, who: a.who.split("·").slice(-1)[0].trim(), action: `approved ${c.id} — ${nairaExact(c.totalNaira)} (${a.role.toLowerCase()} step)`, tone: "green" as PfTone })),
      ),
    [],
  );
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  /* ---- policy checker ---- */
  const [pCat, setPCat] = useState<ExpenseCategoryKey>("travel-ground");
  const [pAmount, setPAmount] = useState("14200");
  const [pUnits, setPUnits] = useState("1");
  const [pZone, setPZone] = useState<PerDiemZone>("offshore");
  const [pReceipt, setPReceipt] = useState(false);
  const [pAge, setPAge] = useState("6");
  const [pRoute, setPRoute] = useState("Lagos ↔ Port Harcourt");
  const [openPolicy, setOpenPolicy] = useState<ExpenseCategoryKey | null>(null);

  /* ---- batch ---- */
  const [csvOpen, setCsvOpen] = useState<string | null>(null);

  /* ------------------------------- derivations ----------------------------- */

  const cur = claims.find((c) => c.id === sel) ?? claims[0];
  const curWorker = workerById(cur.claimantId);
  const curCompany = companyById(curWorker?.contractingCompanyId);
  const curPerson = personById(cur.claimantId);
  const curFlags = flaggedLines(cur);
  const actingName = stepOwner(cur, role);
  const myStep = cur.approvals.find((a) => a.role === role);
  const mgrStep = cur.approvals.find((a) => a.role === "Manager");
  /** EX-2081's problem, detected rather than hard-coded: one person in both seats. */
  const sameSeat =
    !!mgrStep &&
    !!cur.approvals.find((a) => a.role === "Finance") &&
    shortWho(mgrStep.who) === shortWho(cur.approvals.find((a) => a.role === "Finance")!.who);
  const curDecided = curFlags.filter((l) => calls[`${cur.id}/${l.id}`]).length;

  const allFlagged = useMemo(() => claims.flatMap((c) => flaggedLines(c).map((l) => ({ c, l }))), [claims]);
  const byWork = (w: VerdictMeta["work"]) => allFlagged.filter(({ l }) => VERDICT_META[l.verdict].work === w).length;

  /** The two "nothing will fix this" lines, read off the spine rather than typed into the copy. */
  const excludedRoute = allFlagged.find(({ l }) => l.verdict === "outside-policy" && !!l.route)?.l;
  const staleLine = allFlagged.find(({ l }) => l.verdict === "outside-policy" && l.ageDays > CLAIM_WINDOW_DAYS)?.l;

  const awaiting = claims.filter((c) => c.state === "Submitted");
  const awaitingTotal = awaiting.reduce((a, c) => a + c.totalNaira, 0);
  const clearedNotBatched = claims.filter((c) => c.state === "Approved" && !c.batchId);
  /** Approved or awaiting approval and not yet gone in a batch. A workflow figure, not a liability. */
  const outstanding = claims
    .filter((c) => c.state !== "Paid" && c.state !== "Draft" && c.state !== "Rejected")
    .reduce((a, c) => a + c.totalNaira, 0);

  const verdictCounts = useMemo(() => {
    const m = {} as Record<ExpenseVerdict, number>;
    for (const v of VERDICT_ORDER) m[v] = 0;
    for (const c of claims) for (const l of c.lines) m[l.verdict] += 1;
    return m;
  }, [claims]);

  const listed = useMemo(() => {
    let rows = claims;
    if (view === "Awaiting a decision") rows = rows.filter((c) => c.state === "Submitted");
    else if (view === "Flagged lines only") rows = rows.filter((c) => flaggedLines(c).length > 0);
    else if (view === "Cleared, not yet paid") rows = rows.filter((c) => c.state === "Approved" || c.state === "Queued for payment");
    if (vFilter !== "all") rows = rows.filter((c) => c.lines.some((l) => l.verdict === vFilter));
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter(
        (c) =>
          c.claimant.toLowerCase().includes(needle) ||
          c.id.toLowerCase().includes(needle) ||
          c.role.toLowerCase().includes(needle) ||
          c.lines.some((l) => l.merchant.toLowerCase().includes(needle)),
      );
    }
    return rows;
  }, [claims, view, vFilter, q]);

  /* -------------------------------- mutations ------------------------------ */

  const log = (action: string, tone: PfTone = "grey", who = actingName) =>
    setLedger((prev) => [{ at: stampAt(prev.length), who, action, tone }, ...prev]);

  const patch = (id: string, fn: (c: Claim) => Claim) =>
    setClaims((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const openClaim = (id: string) => {
    setSel(id);
    setRejecting(null); setLineReason(""); setClaimReason(""); setDraftNote(""); setDraftFor(null);
    log(`opened ${id} — claim detail, including line amounts and receipts`, "blue");
  };

  const callLine = (c: Claim, l: ExpenseLine, state: "approved" | "rejected", reason?: string) => {
    const key = `${c.id}/${l.id}`;
    setCalls((prev) => ({ ...prev, [key]: { state, reason, by: actingName, at: TODAY } }));
    log(`${state} line ${l.id} on ${c.id} — ${l.merchant} · ${nairaExact(l.amountNaira)}${reason ? ` · “${reason}”` : ""}`, state === "approved" ? "green" : "red");
  };

  const approveLine = (l: ExpenseLine) => {
    callLine(cur, l, "approved");
    setRejecting(null);
    toast(
      l.verdict === "ok"
        ? `Line ${l.id} approved on ${cur.id} — ${nairaExact(l.amountNaira)}`
        : `Line ${l.id} approved over the “${VERDICT_LABEL[l.verdict]}” flag — your name is on the override`,
      "success",
    );
  };

  const confirmRejectLine = (l: ExpenseLine) => {
    const r = lineReason.trim();
    if (!r) {
      toast("A rejection needs a reason. The claimant reads it, and “declined” on its own is not a reason.", "danger");
      return;
    }
    callLine(cur, l, "rejected", r);
    setRejecting(null); setLineReason("");
    setDraftFor(`${cur.id}/${l.id}`); setDraftNote("");
    toast(`Line ${l.id} rejected on ${cur.id} — reason recorded against your name`, "danger");
  };

  const undoLine = (l: ExpenseLine) => {
    const key = `${cur.id}/${l.id}`;
    setCalls((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (draftFor === key) { setDraftFor(null); setDraftNote(""); }
    log(`withdrew the decision on line ${l.id} of ${cur.id} — nothing was sent`, "grey");
    toast(`Decision on line ${l.id} withdrawn. Nothing left the building.`);
  };

  const approveClaim = () => {
    if (!myStep) { toast(`${cur.id} has no ${role.toLowerCase()} step at all.`); return; }
    if (myStep.state === "not-required") {
      toast(`${cur.id} is ${nairaExact(cur.totalNaira)} — under the ${nairaExact(APPROVAL_THRESHOLD)} threshold, so there is no Finance step. The manager is the whole chain.`);
      return;
    }
    if (myStep.state === "approved") { toast(`You already approved ${cur.id} on ${myStep.at}. Approving it twice does not make it more approved.`); return; }
    if (cur.state !== "Submitted") { toast(`${cur.id} is ${cur.state.toLowerCase()} — there is nothing here to approve.`); return; }

    // Finance is a SECOND approval. It cannot be given first.
    if (role === "Finance" && mgrStep && mgrStep.state === "pending") {
      toast(`Finance is a second approval, not a first. ${stepOwner(cur, "Manager")} has not ruled on ${cur.id} yet.`, "danger");
      return;
    }
    if (curDecided < curFlags.length) {
      const left = curFlags.filter((l) => !calls[`${cur.id}/${l.id}`]);
      toast(`${left.length} flagged line${left.length === 1 ? "" : "s"} still unruled on ${cur.id} — ${left.map((l) => l.id).join(", ")}. The system will not decide them for you.`, "danger");
      return;
    }

    const nextApprovals = cur.approvals.map((a) => (a.role === role ? { ...a, state: "approved" as const, at: TODAY } : a));
    const complete = nextApprovals.every((a) => a.state === "approved" || a.state === "not-required");
    patch(cur.id, (c) => ({
      ...c,
      approvals: nextApprovals,
      ...(complete ? { state: "Approved" as ClaimState, approvedAt: TODAY } : {}),
    }));
    log(`approved the ${role.toLowerCase()} step on ${cur.id} — ${nairaExact(cur.totalNaira)}`, "green");
    toast(
      complete
        ? `${cur.id} fully approved — ${nairaExact(cur.totalNaira)}. Cleared and waiting for the next batch; it has not been paid.`
        : `${role} step approved on ${cur.id}. ${approvalChainFor(cur.totalNaira).label} It still needs ${stepOwner(cur, role === "Manager" ? "Finance" : "Manager")}.`,
      "success",
    );
  };

  const rejectClaim = () => {
    const r = claimReason.trim();
    if (!r) { toast("Type the reason. It goes to the claimant with your name on it.", "danger"); return; }
    patch(cur.id, (c) => ({
      ...c,
      state: "Rejected",
      approvals: c.approvals.map((a) => (a.role === role ? { ...a, state: "rejected" as const, at: TODAY, note: r } : a)),
    }));
    log(`rejected ${cur.id} — “${r}”`, "red");
    setClaimReason("");
    toast(`${cur.id} rejected. ${first(cur.claimant)} gets your reason, not a status code.`, "danger");
  };

  const sendBack = () => {
    const missing = cur.lines.filter((l) => l.verdict === "missing-receipt");
    if (missing.length === 0) { toast(`No line on ${cur.id} is waiting on a document — sending it back would just cost ${first(cur.claimant)} a week.`); return; }
    log(`sent ${cur.id} back for ${missing.length} receipt(s) — claim stays open, nothing rejected`, "yellow");
    toast(`${cur.id} sent back to ${first(cur.claimant)} for ${missing.length} receipt${missing.length === 1 ? "" : "s"}. The claim stays open — this is not a rejection.`, "success");
  };

  /** THE ONE AI OUTPUT ON THIS PAGE. Written after the human decided, from what the human typed. */
  const draftLineNote = (l: ExpenseLine) => {
    const call = calls[`${cur.id}/${l.id}`];
    if (!call?.reason) { toast("Reject the line with a reason first — the draft is built from what you typed, not instead of it."); return; }
    setDraftNote(
      `${first(cur.claimant)}, the ${l.date} line on ${cur.id} (${l.merchant}, ${nairaExact(l.amountNaira)}) was not approved. ` +
        `${call.reason.replace(/\.?$/, ".")} ` +
        `The line was flagged “${VERDICT_LABEL[l.verdict]}” by the expense policy rule: ${l.reason} ` +
        `The rest of the claim is unaffected. If you think the rule is wrong here, reply to this note and it comes back to ${stepOwner(cur, "Finance")} with the line attached.`,
    );
    setDraftFor(`${cur.id}/${l.id}`);
    toast(`${MC05.id} drafted the note to ${first(cur.claimant)} — read it before it goes`, "ai");
  };

  const sendNote = () => {
    if (!draftNote) return;
    log(`sent the rejection note on ${cur.id} to ${cur.claimant} (draft edited and approved)`, "blue");
    setDraftNote(""); setDraftFor(null);
    toast(`Note sent to ${cur.claimant}. Your name is on it, not the model's.`, "success");
  };

  /* --------------------------------- batch --------------------------------- */

  const openBatch = batches.find((b) => b.state === "Building");

  const addToBatch = (c: Claim) => {
    if (!openBatch) { toast("No batch is open. The last one has already been exported."); return; }
    setBatches((prev) => prev.map((b) => (b.id === openBatch.id ? { ...b, claimIds: [...b.claimIds, c.id], totalNaira: b.totalNaira + c.totalNaira } : b)));
    patch(c.id, (x) => ({ ...x, state: "Queued for payment" as ClaimState, batchId: openBatch.id }));
    log(`added ${c.id} to ${openBatch.id} — ${nairaExact(c.totalNaira)}`, "blue");
    toast(`${c.id} added to ${openBatch.id}. Still not paid — the batch has not left yet.`, "success");
  };

  const removeFromBatch = (b: PaymentBatch, id: string) => {
    if (b.state !== "Building") { toast(`${b.id} has already been exported. A file that has left cannot be edited here — raise it with the payroll source.`, "danger"); return; }
    const c = claims.find((x) => x.id === id);
    setBatches((prev) => prev.map((x) => (x.id === b.id ? { ...x, claimIds: x.claimIds.filter((k) => k !== id), totalNaira: x.totalNaira - (c?.totalNaira ?? 0) } : x)));
    if (c) patch(c.id, (x) => ({ ...x, state: "Approved" as ClaimState, batchId: undefined }));
    log(`pulled ${id} out of ${b.id} before export`, "yellow");
    toast(`${id} pulled out of ${b.id} — back in the cleared pool.`);
  };

  const exportBatch = (b: PaymentBatch) => {
    if (b.claimIds.length === 0) { toast("Nothing in the batch. An empty file helps nobody."); return; }
    setBatches((prev) => prev.map((x) => (x.id === b.id ? { ...x, state: "Exported", exportedAt: TODAY } : x)));
    log(`exported ${b.id} — ${b.claimIds.length} claims, ${nairaExact(b.totalNaira)}, via ${PAYROLL_ROUTE}`, "blue");
    toast(`${b.id} handed to the connected payroll source — ${nairaExact(b.totalNaira)} across ${b.claimIds.length} claims. Payment is theirs from here.`, "success");
  };

  const csvFor = (b: PaymentBatch) =>
    ["claim_id,worker_id,period,amount_ngn,approved_on,approver"]
      .concat(
        b.claimIds.map((id) => {
          const c = claims.find((x) => x.id === id);
          if (!c) return `${id},—,—,—,—,—`;
          const approvedSteps = c.approvals.filter((a) => a.state === "approved").length;
          return [c.id, c.claimantId, isoPeriod(c.period), c.totalNaira, isoDate(c.approvedAt), approvedSteps > 1 ? "manager+finance" : "manager"].join(",");
        }),
      )
      .join("\n");

  /* ------------------------------ policy probe ----------------------------- */

  const probe: CheckInput = {
    id: "probe",
    iso: "2026-08-20",
    category: pCat,
    merchant: "probe",
    amountNaira: Math.max(0, Number(pAmount) || 0),
    units: Math.max(1, Number(pUnits) || 1),
    zone: pCat === "per-diem" ? pZone : undefined,
    receipt: pReceipt,
    route: pCat === "travel-air" ? pRoute : undefined,
    ageDays: Math.max(0, Number(pAge) || 0),
  };
  const probeResult = checkLine(probe, []);
  const probePolicy = policyFor(pCat);
  const probeCap = pCat === "per-diem" ? PER_DIEM[pZone].rate : probePolicy.cap;
  const probePerUnit = Math.round(probe.amountNaira / (probe.units ?? 1));

  /* --------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Expenses — approvals, policy &amp; the payment handoff</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            The claim lifecycle end to end: a published policy table, a deterministic check against it, a named human on every decision, and a cleared batch handed to your payroll system. Hirebrew does not compute pay and does not move money (FR-096).
          </div>
        </div>
        <PfBtn variant="secondary" icon="orbit" onClick={() => go("integrations")}>Connector</PfBtn>
        <PfBtn variant="primary" icon="wallet" onClick={() => setTab("batch")}>Payment batch</PfBtn>
      </div>

      {/* governance strip — the page states its own limits before it states anything else */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "9px 14px", marginBottom: 12 }}>
        <Ic name="clipboard" size={15} color="var(--pf-n900)" />
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>expense_policy · rule check</span>
        <PfBadge tone="green" dot>0 models on any verdict</PfBadge>
        <PfBadge tone="blue" dot>{AUDIT.lines} lines re-checked · {AUDIT.mismatches.length} mismatches</PfBadge>
        <span style={{ fontSize: 12, color: "var(--pf-n500)", flex: 1, minWidth: 240 }}>
          Every flag on this page is a comparison against a published number. Nothing auto-rejects, and nothing leaves without a named approver.
        </span>
        <PfBtn small variant="secondary" icon="book" onClick={() => setTab("policy")}>The policy table</PfBtn>
      </div>

      {/* KPIs — all four are reads off the claim spine */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 4 }}>
        <PfStat
          icon="clipboard" tone="yellow" label="Awaiting a decision" value={awaiting.length} unit="claims"
          delta={nairaExact(awaitingTotal)} deltaTone="yellow"
        />
        <PfStat
          icon="warning" tone="blue" label="Lines flagged by rule" value={allFlagged.length} unit={`of ${AUDIT.lines} lines`}
          delta="0 auto-rejected" deltaTone="green"
        />
        <PfStat
          icon="wallet" tone="purple" label="Outstanding" value={nairaExact(outstanding)} unit=""
          delta="workflow figure" deltaTone="purple"
        />
        <PfStat
          icon="robot" tone="green" label="Verdicts a model produced" value="0" unit="by design"
          delta="deterministic check" deltaTone="green"
        />
      </div>

      {/* the caveat that belongs to the third tile, in the spine's own words */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 2px 0" }}>
        <Ic name="info" size={13} color="var(--pf-n300)" />
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>
          {KPIS.note} Today that is {KPIS.open} claim(s) with an approver, {KPIS.queued} in a batch that has not left, {KPIS.draft} still a draft, and {KPIS.paid} paid and closed.
        </span>
      </div>

      {/* lead insight — the single most important true thing about this queue */}
      <div style={{ marginTop: 12 }}>
        <PfBanner tone="yellow" icon="info">
          <span style={{ fontWeight: 700 }}>
            {allFlagged.length} lines are flagged and none of them is a rejection.
          </span>{" "}
          <span style={{ fontWeight: 400 }}>
            {byWork("document")} clears the moment a receipt is attached, {byWork("decision")} are judgement calls that are yours to make, and {byWork("unfixable")} are outside policy on their facts — a fully receipted {nairaExact(excludedRoute?.amountNaira ?? 0)} flight on the {excludedRoute?.route} route, which is booked centrally and never claimed back, and a {nairaExact(staleLine?.amountNaira ?? 0)} spend submitted {(staleLine?.ageDays ?? 0) - CLAIM_WINDOW_DAYS} days past the {CLAIM_WINDOW_DAYS}-day window. On those two the amount was never the question, so nothing anyone attaches will change them.
          </span>
        </PfBanner>
      </div>

      {/* tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "queue", label: "Approval queue", count: String(awaiting.length) },
            { key: "policy", label: "Policy & caps", count: String(EXPENSE_POLICY.length) },
            { key: "batch", label: "Payment batch", count: String(batches.length) },
          ]}
        />
      </div>

      {/* ================================ QUEUE ================================ */}
      {tab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* filters */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", flexWrap: "wrap" }}>
              <PfTabs tabs={[...QUEUE_VIEWS]} active={view} onChange={(t) => setView(t as QueueView)} />
              <span style={{ flex: 1 }} />
              <div style={{ position: "relative", width: 250 }}>
                <span style={{ position: "absolute", left: 10, top: 9 }}><Ic name="search" size={14} color="var(--pf-n300)" /></span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Claimant, claim id or merchant"
                  style={{ ...fieldStyle, paddingLeft: 31 }}
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 20px 13px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)", marginRight: 2 }}>Verdict</span>
              <button
                onClick={() => setVFilter("all")}
                style={{ fontFamily: "inherit", cursor: "pointer", fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, border: `1px solid ${vFilter === "all" ? "var(--pf-n900)" : "var(--pf-n100)"}`, background: vFilter === "all" ? "var(--pf-n900)" : "var(--pf-n0)", color: vFilter === "all" ? "#fff" : "var(--pf-n500)" }}
              >
                All {AUDIT.lines}
              </button>
              {VERDICT_ORDER.map((v) => {
                const on = vFilter === v;
                const t = TONE[verdictTone(v)];
                return (
                  <button
                    key={v}
                    onClick={() => setVFilter((f) => (f === v ? "all" : v))}
                    title={VERDICT_META[v].rule}
                    style={{ fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, border: `1px solid ${on ? t.fg : t.line}`, background: on ? t.soft : "var(--pf-n0)", color: t.fg }}
                  >
                    <Ic name={VERDICT_META[v].icon} size={11} color={t.fg} weight={2} />
                    {VERDICT_LABEL[v]}
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n400)" }}>{verdictCounts[v]}</span>
                  </button>
                );
              })}
            </div>
            <Foot icon="info">
              The verdict chips filter claims, not lines — a claim with one flagged line comes into the list whole, because you approve a claim, not a spreadsheet cell.
            </Foot>
          </PfCard>

          {/* the list */}
          <PfCard>
            <PfCardHead
              title={view}
              sub={`${listed.length} of ${claims.length} claims${vFilter === "all" ? "" : ` · containing a “${VERDICT_LABEL[vFilter]}” line`}. Opening a claim writes an access entry.`}
            >
              {(vFilter !== "all" || q) && <PfBtn small variant="ghost" icon="x" onClick={() => { setVFilter("all"); setQ(""); }}>Clear</PfBtn>}
              <PfBadge tone="grey">{ledger.length + SEEDED_LEDGER.length} decisions on file</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px" }}>
              <PfTh style={{ width: 34 }} />
              <PfTh style={{ flex: 1 }}>Claimant</PfTh>
              <PfTh style={{ width: 108, textAlign: "right" }}>Total</PfTh>
              <PfTh style={{ width: 118, textAlign: "right" }}>Flags</PfTh>
              <PfTh style={{ width: 138, textAlign: "right" }}>State</PfTh>
              <span style={{ width: 14 }} />
            </div>
            {listed.map((c) => (
              <ClaimRow
                key={c.id}
                c={c}
                on={c.id === cur.id}
                decided={flaggedLines(c).filter((l) => calls[`${c.id}/${l.id}`]).length}
                onPick={() => openClaim(c.id)}
              />
            ))}
            {listed.length === 0 && (
              <div style={{ padding: "30px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing matches that.</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>
                  {view === "Awaiting a decision"
                    ? "An empty approval queue is the correct end state, not an error. Widen the view to see what has already been decided."
                    : "Try a different verdict chip, or clear the search."}
                </div>
              </div>
            )}
          </PfCard>

          {/* ---------------------------- the claim file ---------------------------- */}
          <PfCard>
            <PfCardHead
              title={`${cur.id} — ${cur.claimant}`}
              sub={`${cur.role} · ${curPerson?.dept ?? "—"} · ${curPerson?.loc ?? "—"} · ${cur.period} · ${cur.lines.length} lines${cur.submitted ? ` · submitted ${cur.submitted}` : " · never submitted"}`}
            >
              <Money n={cur.totalNaira} size={15} />
              <PfBadge tone={claimStateTone(cur.state)} dot>{cur.state}</PfBadge>
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <PfAvatar init={cur.init} tone={cur.tone} size={38} />
              <div style={{ flex: 1, minWidth: 320 }}>
                <ApprovalRail c={cur} />
              </div>
              <PfBtn small variant="secondary" icon="user" onClick={() => go("people")}>Person record</PfBtn>
            </div>

            {/* which seat you are sitting in — it changes what you are allowed to approve */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap", background: "var(--pf-n25)" }}>
              <Ic name="user" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Acting as</span>
              <PfTabs tabs={[...ROLES]} active={role} onChange={(t) => setRole(t as Role)} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{actingName}</span>
              {myStep && (
                <PfBadge tone={myStep.state === "approved" ? "green" : myStep.state === "rejected" ? "red" : myStep.state === "not-required" ? "grey" : "yellow"} dot>
                  {myStep.state === "not-required" ? "your step is not required on this claim" : `your step: ${myStep.state}`}
                </PfBadge>
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)", maxWidth: 420, textAlign: "right", lineHeight: 1.5 }}>
                {role === "Finance" && mgrStep?.state === "pending"
                  ? `Finance cannot approve ahead of ${stepOwner(cur, "Manager")}. A second approval that can be given first is not a control.`
                  : approvalChainFor(cur.totalNaira).label}
              </span>
            </div>

            {/* the chain's own notes — including why a second approval was routed away */}
            {(cur.approvals.some((a) => a.note) || sameSeat) && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 7 }}>
                {sameSeat && (
                  <div style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-red-500)", lineHeight: 1.55, fontWeight: 500 }}>
                    <Ic name="warning" size={13} color="var(--pf-red-500)" />
                    <span>Segregation of duties: the same person sits in both seats on this claim. The manager step cannot also be the Finance step.</span>
                  </div>
                )}
                {cur.approvals.filter((a) => a.note).map((a) => (
                  <div key={a.role} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n300)", width: 58, flex: "none", textTransform: "uppercase", letterSpacing: ".3px", marginTop: 1 }}>{a.role}</span>
                    <span>{a.note}</span>
                  </div>
                ))}
              </div>
            )}

            {/* the claim's own note, from the spine */}
            {cur.note && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                <Ic name="info" size={15} color="var(--pf-n400)" />
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>{cur.note}</div>
              </div>
            )}

            {/* third-party worker — the honest limit */}
            {curWorker && curWorker.workerType !== "employee" && curCompany && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                <PfBanner tone="yellow" icon="warning" cta="workforce" onCta={() => go("workforce")}>
                  <span style={{ fontWeight: 600 }}>
                    {cur.claimant} is {WORKER_TYPE_LABEL[curWorker.workerType].toLowerCase()}, engaged through {curCompany.name} —{" "}
                  </span>
                  <span style={{ fontWeight: 400 }}>
                    the policy check ran exactly as it does for an employee, because it never saw the worker type. Where the cleared money actually lands is the payroll connector&rsquo;s problem, not this platform&rsquo;s: it hands over the same batch either way.
                  </span>
                </PfBanner>
              </div>
            )}

            {/* line header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh style={{ width: 54 }}>Date</PfTh>
              <PfTh style={{ flex: 1 }}>Merchant &amp; category</PfTh>
              <PfTh style={{ width: 62, textAlign: "right" }}>Units</PfTh>
              <PfTh style={{ width: 104, textAlign: "right" }}>Amount</PfTh>
              <PfTh style={{ width: 128 }}>Policy verdict</PfTh>
              <PfTh style={{ width: 150, textAlign: "right" }}>Your call</PfTh>
            </div>

            {cur.lines.map((l) => {
              const key = `${cur.id}/${l.id}`;
              const call = calls[key];
              const t = TONE[verdictTone(l.verdict)];
              const p = policyFor(l.category);
              return (
                <div key={l.id} style={{ borderBottom: "1px solid var(--pf-n50)", background: call ? (call.state === "approved" ? "rgba(22,179,100,.035)" : "rgba(232,30,23,.035)") : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px" }}>
                    <div style={{ width: 54, flex: "none", fontSize: 12, color: "var(--pf-n400)", fontFamily: MONO }}>{l.date}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--pf-n900)", fontWeight: 500 }}>{l.merchant}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{p.name}</span>
                        {l.receipt ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--pf-n400)" }}>
                            <Ic name="file" size={11} color="var(--pf-n300)" />{l.receiptRef}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: p.receiptRule === "never" ? "var(--pf-n300)" : "var(--pf-yellow-500)" }}>
                            {p.receiptRule === "never" ? "no receipt expected — a rate, not a reimbursement" : "no receipt attached"}
                          </span>
                        )}
                        {l.route && <PfBadge tone="grey">{l.route}</PfBadge>}
                      </div>
                    </div>
                    <div style={{ width: 62, flex: "none", textAlign: "right", fontSize: 12, color: "var(--pf-n400)", fontFamily: MONO }}>
                      {l.units ?? 1}
                    </div>
                    <div style={{ width: 104, flex: "none", textAlign: "right" }}>
                      <Money n={l.amountNaira} />
                      {(l.units ?? 1) > 1 && (
                        <div style={{ fontSize: 10.5, color: "var(--pf-n300)", fontFamily: MONO, marginTop: 2 }}>
                          {nairaExact(Math.round(l.amountNaira / (l.units ?? 1)))}/unit
                        </div>
                      )}
                    </div>
                    <div style={{ width: 128, flex: "none" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: t.fg, background: t.soft, border: `0.6px solid ${t.line}`, padding: "3px 7px", borderRadius: 5 }}>
                        <Ic name={VERDICT_META[l.verdict].icon} size={11} color={t.fg} weight={2} />
                        {VERDICT_LABEL[l.verdict]}
                      </span>
                    </div>
                    <div style={{ width: 150, flex: "none", display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      {call ? (
                        <>
                          <PfBadge tone={call.state === "approved" ? "green" : "red"} dot>{call.state === "approved" ? "Approved" : "Rejected"}</PfBadge>
                          <PfBtn small variant="ghost" icon="swap" onClick={() => undoLine(l)}>Undo</PfBtn>
                        </>
                      ) : (
                        <>
                          <PfBtn small variant="secondary" icon="check" onClick={() => approveLine(l)}>Approve</PfBtn>
                          <PfBtn small variant="ghost" icon="x" onClick={() => { setRejecting(rejecting === key ? null : key); setLineReason(""); }}>Reject</PfBtn>
                        </>
                      )}
                    </div>
                  </div>

                  {/* the rule trace + the rejection composer live under the line */}
                  <div style={{ padding: "0 20px 13px 84px" }}>
                    <RuleTrace line={l} siblings={cur.lines} />

                    {call?.reason && (
                      <div style={{ marginTop: 10, border: "1px solid var(--pf-red-100)", background: "var(--pf-red-50)", borderRadius: 9, padding: "10px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <PfBadge tone="red">Rejected by a person</PfBadge>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>{call.by} · {call.at}</span>
                          <span style={{ flex: 1 }} />
                          {draftFor !== key && <PfBtn small variant="secondary" icon="sparkle" onClick={() => draftLineNote(l)}>Draft the note with {MC05.id}</PfBtn>}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.6, marginTop: 8 }}>&ldquo;{call.reason}&rdquo;</div>
                      </div>
                    )}

                    {rejecting === key && (
                      <div style={{ marginTop: 10, border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "11px 13px" }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 6 }}>
                          Why this line is not being paid — {first(cur.claimant)} reads this, so write it to her, not to the file
                        </div>
                        <textarea
                          value={lineReason}
                          onChange={(e) => setLineReason(e.target.value)}
                          rows={2}
                          placeholder={
                            l.verdict === "over-cap"
                              ? "e.g. the monitor is over the annual home-office cap and the cap has already been drawn this year — reclaim it in January"
                              : l.verdict === "duplicate-suspected"
                                ? "e.g. both transfers carry the same receipt reference, so only one of them happened"
                                : "e.g. this route is booked through the ops desk and cannot be claimed back"
                          }
                          style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                          <PfBtn small variant="danger" icon="x" onClick={() => confirmRejectLine(l)}>Reject this line</PfBtn>
                          <PfBtn small variant="ghost" onClick={() => { setRejecting(null); setLineReason(""); }}>Cancel</PfBtn>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                            A reason is required. The rule already told her what was flagged — this tells her what you decided.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* the one AI output on this page */}
                    {draftFor === key && draftNote && (
                      <div style={{ marginTop: 10 }}>
                        <AiBlock
                          label={`AI draft · note to ${first(cur.claimant)}`}
                          chip={`${MC05.id} · ${MC05.name}`}
                          why={
                            <WhyThisPanel
                              why={{
                                claim: `This note is a rewrite of the reason ${actingName} typed, plus the rule that fired. Nothing in it was inferred about ${first(cur.claimant)}, and no part of the decision was made by a model.`,
                                basis: [
                                  `The approver's own words, verbatim: “${calls[key]?.reason ?? ""}”`,
                                  `The verdict the policy rule produced on line ${l.id}: “${VERDICT_LABEL[l.verdict]}”`,
                                  `The published number the rule compared against — ${nairaExact(l.category === "per-diem" && l.zone ? PER_DIEM[l.zone].rate : policyFor(l.category).cap)} ${l.category === "per-diem" && l.zone ? "per day at the zone rate" : policyFor(l.category).capBasis}`,
                                  `The claim id, line date, merchant and amount, so she knows which line this is about`,
                                  `Nothing else. Not her rating, not her history, not her other claims.`,
                                ],
                                modelCard: MC05.id,
                                humanGate: "You edit and send. The model never sends, and it never decided.",
                              }}
                            />
                          }
                        >
                          <textarea
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            rows={5}
                            style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.7, border: "1px solid var(--pf-purple-100)" }}
                          />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            <PfBtn small variant="primary" icon="paperplane" onClick={sendNote}>Send to {first(cur.claimant)}</PfBtn>
                            <PfBtn small variant="ghost" icon="x" onClick={() => { setDraftNote(""); setDraftFor(null); }}>Discard draft</PfBtn>
                            <span style={{ fontSize: 11.5, color: "var(--pf-purple-500)", fontWeight: 500 }}>
                              The model wrote the sentence. It did not write the verdict and it did not make the decision.
                            </span>
                          </div>
                        </AiBlock>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* claim-level decision bar */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: curFlags.length ? 10 : 0 }}>
                <PfBtn variant="primary" icon="check" onClick={approveClaim}>Approve as {role.toLowerCase()} — {nairaExact(cur.totalNaira)}</PfBtn>
                <PfBtn variant="secondary" icon="file" onClick={sendBack}>Send back for a receipt</PfBtn>
                <span style={{ flex: 1 }} />
                {curFlags.length > 0 && (
                  <span style={{ fontSize: 12, color: curDecided >= curFlags.length ? "var(--pf-primary-600)" : "var(--pf-yellow-500)", fontWeight: 500 }}>
                    {curDecided} of {curFlags.length} flagged lines ruled on
                  </span>
                )}
              </div>
              {curFlags.length > 0 && <PfProgress pct={(curDecided / curFlags.length) * 100} tone={curDecided >= curFlags.length ? "green" : "yellow"} />}

              <div style={{ marginTop: 13, display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Reject the whole claim — reason required</div>
                  <input
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value)}
                    placeholder="Why the whole claim is going back, in a sentence the claimant can act on"
                    style={fieldStyle}
                  />
                </div>
                <PfBtn variant="danger" icon="x" onClick={rejectClaim}>Reject as {role.toLowerCase()}</PfBtn>
              </div>
            </div>

            <Foot icon="shield">
              &ldquo;Approve&rdquo; here means <b style={{ color: "var(--pf-n600)" }}>cleared for the next batch</b>, not paid. Payment happens on the {PAYMENT_DAY}th, in your payroll system, from a file this platform hands over. Anything over {nairaExact(APPROVAL_THRESHOLD)} needs Finance as a genuinely separate second approval — and where the claimant&rsquo;s own manager is the Finance head, segregation of duties routes that second approval elsewhere.
            </Foot>
          </PfCard>

          {/* decision ledger */}
          <PfCard>
            <PfCardHead
              title="Decision log"
              sub="Every approval, rejection and claim open, with the name attached. Seeded from the approvals already on file; this session appends to it."
            >
              <PfBadge tone="grey">{ledger.length} this session</PfBadge>
            </PfCardHead>
            {[...ledger, ...SEEDED_LEDGER].slice(0, 12).map((r, i) => (
              <div key={`${r.at}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[r.tone].bg, marginTop: 6, flex: "none" }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--pf-n300)", width: 92, flex: "none" }}>{r.at}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", width: 150, flex: "none" }}>{r.who}</span>
                <span style={{ fontSize: 12.5, color: "var(--pf-n500)", flex: 1, lineHeight: 1.5 }}>{r.action}</span>
              </div>
            ))}
            {ledger.length === 0 && SEEDED_LEDGER.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)" }}>Nothing has been decided yet.</div>
            )}
            <Foot icon="clipboard">
              A claim is money and a document trail, so an open is a read worth logging. Nothing on this page advances by itself — a lapsed approval does not become an approval, and an unruled flag does not become a rejection.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* =============================== POLICY ================================ */}
      {tab === "policy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* the three numbers everyone actually has to remember */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            {[
              { icon: "file", tone: "blue" as PfTone, k: nairaExact(RECEIPT_THRESHOLD), t: "Receipt threshold", d: "Above this, attach a receipt. Some categories need one at any amount — the receipt is the control there, not the size." },
              { icon: "clock", tone: "yellow" as PfTone, k: `${CLAIM_WINDOW_DAYS} days`, t: "Claim window", d: "From the spend, not from the month end. A line older than this is outside policy on its date alone, whatever it cost." },
              { icon: "shield", tone: "purple" as PfTone, k: nairaExact(APPROVAL_THRESHOLD), t: "Second-approval threshold", d: "Under it, the manager is the whole chain. Over it, Finance is a separate approval — the same number as the L&D threshold, on purpose." },
            ].map((x) => (
              <PfCard key={x.t}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
                  <PfTile icon={x.icon} tone={x.tone} size={26} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{x.t}</span>
                </div>
                <div style={{ padding: "13px 16px" }}>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{x.k}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 7, lineHeight: 1.55 }}>{x.d}</div>
                </div>
              </PfCard>
            ))}
          </div>

          {/* category caps */}
          <PfCard>
            <PfCardHead
              title="Category caps"
              sub="The published table. Caps are per unit — per night, per day, per trip, per event — not per line. Click a row for the rule behind it."
            >
              <PfBadge tone="grey">{EXPENSE_POLICY.length} categories</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh style={{ width: 30 }} />
              <PfTh style={{ flex: 1 }}>Category</PfTh>
              <PfTh style={{ width: 116, textAlign: "right" }}>Cap</PfTh>
              <PfTh style={{ width: 190 }}>Basis</PfTh>
              <PfTh style={{ width: 132 }}>Receipt</PfTh>
              <span style={{ width: 14 }} />
            </div>
            {EXPENSE_POLICY.map((p) => {
              const open = openPolicy === p.key;
              const rTone: PfTone = p.receiptRule === "always" ? "red" : p.receiptRule === "threshold" ? "yellow" : "grey";
              const rLabel = p.receiptRule === "always" ? "Always" : p.receiptRule === "threshold" ? `Over ${nairaExact(RECEIPT_THRESHOLD)}` : "Never — it's a rate";
              return (
                <div key={p.key} style={{ borderBottom: "1px solid var(--pf-n50)", background: open ? "var(--pf-n25)" : "transparent" }}>
                  <div
                    onClick={() => setOpenPolicy(open ? null : p.key)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", cursor: "pointer" }}
                  >
                    <PfTile icon={p.icon} tone="green" size={26} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{p.name}</div>
                    <div style={{ width: 116, textAlign: "right", flex: "none" }}><Money n={p.cap} /></div>
                    <div style={{ width: 190, flex: "none", fontSize: 12, color: "var(--pf-n400)" }}>{p.capBasis}</div>
                    <div style={{ width: 132, flex: "none" }}><PfBadge tone={rTone}>{rLabel}</PfBadge></div>
                    <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
                  </div>
                  {open && (
                    <div style={{ padding: "0 20px 14px 60px", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>
                      {p.note}
                      <div style={{ marginTop: 8 }}>
                        <PfBtn small variant="secondary" icon="flask" onClick={() => { setPCat(p.key); toast(`Checker loaded with ${p.name}. Change the amount and watch the verdict move.`); }}>
                          Test a line against this cap
                        </PfBtn>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <Foot icon="info">
              Per-diem is the one row whose cap is not the number the check uses — the table shows the highest zone, and a line is checked against its own zone rate below.
            </Foot>
          </PfCard>

          {/* per-diem */}
          <PfCard>
            <PfCardHead
              title="Per-diem, by zone"
              sub="A day on an FPSO, a day at Bonny Terminal and a day in Lagos are three different economic events. One flat rate for all three is either an underpayment offshore or a windfall in Ikoyi."
            >
              <PfBadge tone="blue">rate, not reimbursement</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {PER_DIEM_LIST.map((z, i) => (
                <div key={z.zone} style={{ padding: "15px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PfTile icon={z.zone === "offshore" ? "orbit" : z.zone === "onshore" ? "house" : "swap"} tone={z.zone === "offshore" ? "purple" : z.zone === "onshore" ? "blue" : "grey"} size={26} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{z.name}</span>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", marginTop: 11 }}>
                    {nairaExact(z.rate)}
                    <span style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 400, color: "var(--pf-n400)", marginLeft: 5 }}>per day</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 8, lineHeight: 1.55 }}>{z.applies}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.55, paddingTop: 8, borderTop: "1px solid var(--pf-n50)" }}>{z.note}</div>
                </div>
              ))}
            </div>
            <Foot icon="wallet">
              The largest routine claim in the company is a full offshore tour: {nairaExact(PER_DIEM.offshore.rate)} × 28 days = {nairaExact(PER_DIEM.offshore.rate * 28)}, with no receipt, because there is nothing to receipt. A rate is not a reimbursement, and asking for a receipt against one misunderstands the instrument.
            </Foot>
          </PfCard>

          {/* the live checker */}
          <PfCard>
            <PfCardHead
              title="Check a line against the table"
              sub="The same function that produced every verdict in the queue, run live. Change an input and the verdict moves in front of you — that is what deterministic means."
            >
              <PfBadge tone="green" dot>no model in this path</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "14px 20px" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Category</div>
                <select value={pCat} onChange={(e) => setPCat(e.target.value as ExpenseCategoryKey)} style={fieldStyle}>
                  {EXPENSE_POLICY.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Amount (₦)</div>
                <input value={pAmount} onChange={(e) => setPAmount(e.target.value.replace(/[^0-9]/g, ""))} style={fieldStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Units (nights / days / trips)</div>
                <input value={pUnits} onChange={(e) => setPUnits(e.target.value.replace(/[^0-9]/g, ""))} style={fieldStyle} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Days since the spend</div>
                <input value={pAge} onChange={(e) => setPAge(e.target.value.replace(/[^0-9]/g, ""))} style={fieldStyle} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "0 20px 14px", flexWrap: "wrap" }}>
              {pCat === "per-diem" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Zone</span>
                  <PfTabs
                    tabs={PER_DIEM_LIST.map((z) => z.name)}
                    active={PER_DIEM[pZone].name}
                    onChange={(n) => setPZone((PER_DIEM_LIST.find((z) => z.name === n)?.zone ?? "offshore") as PerDiemZone)}
                  />
                </div>
              )}
              {pCat === "travel-air" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 300 }}>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>Route</span>
                  <input value={pRoute} onChange={(e) => setPRoute(e.target.value)} style={fieldStyle} />
                </div>
              )}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--pf-n600)", cursor: "pointer" }}>
                <input type="checkbox" checked={pReceipt} onChange={(e) => setPReceipt(e.target.checked)} style={{ width: 15, height: 15, accentColor: "var(--pf-primary-500)" }} />
                Receipt attached
              </label>
            </div>

            <div style={{ margin: "0 20px 16px", border: `1px solid ${TONE[verdictTone(probeResult.verdict)].line}`, background: TONE[verdictTone(probeResult.verdict)].soft, borderRadius: 11, padding: "13px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                <Ic name={VERDICT_META[probeResult.verdict].icon} size={16} color={TONE[verdictTone(probeResult.verdict)].fg} weight={2} />
                <span style={{ fontSize: 14, fontWeight: 700, color: TONE[verdictTone(probeResult.verdict)].fg }}>{VERDICT_LABEL[probeResult.verdict]}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n500)" }}>
                  {nairaExact(probePerUnit)}/unit vs {nairaExact(probeCap)} cap
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.65, marginTop: 9 }}>{probeResult.reason}</div>
            </div>
            <Foot icon="info">
              One rule cannot fire here: <b style={{ color: "var(--pf-n600)" }}>possible duplicate</b> needs an earlier sibling line to compare against, and a single probe has no siblings. It only fires inside a claim — which is also why the first of two identical lines is never the one flagged.
            </Foot>
          </PfCard>

          {/* exclusions */}
          <PfCard>
            <PfCardHead
              title="Named exclusions"
              sub="The rules that are not about amounts — where the spend was legitimate and the claim is still wrong. Most of these are somebody using their own card because they were in a hurry."
            >
              <PfBadge tone="red">{POLICY_EXCLUSIONS.length} rules</PfBadge>
            </PfCardHead>
            {POLICY_EXCLUSIONS.map((x, i) => (
              <div key={x.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)", width: 40, flex: "none", marginTop: 2 }}>{x.id}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{x.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.6 }}>{x.rule}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 5 }}>{x.source}</div>
                </div>
              </div>
            ))}
            <Foot icon="shield">
              Order matters in the check: an excluded spend is outside policy whatever it cost, and only then does the amount get looked at. That is why a fully receipted {nairaExact(EXCLUDED_FLIGHT?.amountNaira ?? 0)} flight, comfortably under the {nairaExact(policyFor("travel-air").cap)} flight cap, still fails — the route was never claimable.
            </Foot>
          </PfCard>

          {/* the audit */}
          <PfCard>
            <PfCardHead title="Engine audit" sub="Every line in every claim, re-derived from the published table and compared against what is stored." />
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "15px 20px", flexWrap: "wrap" }}>
              <PfTile icon={AUDIT.clean ? "check" : "warning"} tone={AUDIT.clean ? "green" : "red"} size={34} />
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                  {AUDIT.lines} lines re-checked · {AUDIT.flagged} flagged · {AUDIT.mismatches.length} mismatches
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.55 }}>
                  {AUDIT.clean
                    ? "Every stored verdict equals what the rule derives right now. A stored verdict that disagreed with the live rule would make every screen built on it untrustworthy — so it is checked, not assumed."
                    : AUDIT.mismatches.join(" · ")}
                </div>
              </div>
              <PfBadge tone={AUDIT.clean ? "green" : "red"} dot>{AUDIT.clean ? "clean" : "drift"}</PfBadge>
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================ BATCH ================================ */}
      {tab === "batch" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* where this stops */}
          <PfCard style={{ background: "var(--pf-n900)", border: "1px solid var(--pf-n900)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px" }}>
              <Ic name="shield" size={20} color="#fff" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{HANDOFF_NOTE.headline}</div>
                <div style={{ fontSize: 13, color: "var(--pf-n300)", marginTop: 7, lineHeight: 1.65 }}>{HANDOFF_NOTE.body}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 5, padding: "3px 8px" }}>
                    {HANDOFF_NOTE.contract}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-500)", background: "rgba(22,179,100,.12)", border: "1px solid rgba(22,179,100,.24)", borderRadius: 5, padding: "3px 8px" }}>
                    live adapter: {PAYROLL_ROUTE}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                    {CONNECTOR_AWAITING} further adapters are built to the same contract and are awaiting access. They are not named here while the vendor decision is open.
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <Ic name="info" size={14} color="var(--pf-n400)" />
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>{HANDOFF_NOTE.fallback}</div>
            </div>
          </PfCard>

          {/* cleared, waiting for a batch */}
          <PfCard>
            <PfCardHead
              title="Cleared, not yet in a batch"
              sub="Approved claims waiting for the next export. Approved is not paid, and this pool is the gap between the two."
            >
              <PfBadge tone={clearedNotBatched.length ? "blue" : "grey"} dot>{clearedNotBatched.length} waiting</PfBadge>
            </PfCardHead>
            {clearedNotBatched.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfAvatar init={c.init} tone={c.tone} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.claimant} <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", fontWeight: 400 }}>{c.id}</span></div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{c.period} · approved {c.approvedAt ?? TODAY} · {c.approvals.filter((a) => a.state === "approved").length} approval step(s)</div>
                </div>
                <Money n={c.totalNaira} />
                <PfBtn small variant="secondary" icon="plus" onClick={() => addToBatch(c)}>Add to {openBatch?.id ?? "batch"}</PfBtn>
              </div>
            ))}
            {clearedNotBatched.length === 0 && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing is waiting for the next batch.</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.6 }}>
                  Approve a claim in the queue and it lands here first — cleared, unbatched, and not yet paid.{" "}
                  <button onClick={() => setTab("queue")} style={{ fontFamily: "inherit", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--pf-primary-600)", fontSize: 12.5, fontWeight: 600 }}>
                    Open the queue
                  </button>
                </div>
              </div>
            )}
          </PfCard>

          {/* the batches */}
          {batches.map((b) => {
            const rows = b.claimIds.map((id) => claims.find((c) => c.id === id)).filter(Boolean) as Claim[];
            const bTone: PfTone = b.state === "Paid" ? "green" : b.state === "Exported" ? "blue" : "yellow";
            return (
              <PfCard key={b.id}>
                <PfCardHead
                  title={`${b.id} — ${b.period}`}
                  sub={`${b.claimIds.length} claims · pay run ${b.runDate}${b.exportedAt ? ` · exported ${b.exportedAt}` : " · not yet exported"}${b.paymentRef ? ` · reference ${b.paymentRef} came back from the payroll source` : ""}`}
                >
                  <Money n={b.totalNaira} size={15} />
                  <PfBadge tone={bTone} dot>{b.state}</PfBadge>
                </PfCardHead>

                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
                  <PfTh style={{ width: 30 }} />
                  <PfTh style={{ flex: 1 }}>Claim</PfTh>
                  <PfTh style={{ width: 100 }}>Worker id</PfTh>
                  <PfTh style={{ width: 104, textAlign: "right" }}>Amount</PfTh>
                  <PfTh style={{ width: 132, textAlign: "right" }}>Approved</PfTh>
                  <span style={{ width: b.state === "Building" ? 84 : 0 }} />
                </div>
                {rows.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                    <PfAvatar init={c.init} tone={c.tone} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.id}</span>
                      <span style={{ fontSize: 12.5, color: "var(--pf-n500)", marginLeft: 8 }}>{c.claimant} · {c.period}</span>
                    </div>
                    <div style={{ width: 100, flex: "none", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{c.claimantId}</div>
                    <div style={{ width: 104, flex: "none", textAlign: "right" }}><Money n={c.totalNaira} /></div>
                    <div style={{ width: 132, flex: "none", textAlign: "right", fontSize: 12, color: "var(--pf-n400)" }}>{c.approvedAt ?? "—"}</div>
                    {b.state === "Building" && (
                      <div style={{ width: 84, flex: "none", display: "flex", justifyContent: "flex-end" }}>
                        <PfBtn small variant="ghost" icon="x" onClick={() => removeFromBatch(b, c.id)}>Pull</PfBtn>
                      </div>
                    )}
                  </div>
                ))}
                {rows.length === 0 && (
                  <div style={{ padding: "24px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)" }}>
                    Empty. Nothing has cleared into this batch yet.
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", flexWrap: "wrap", borderBottom: "1px solid var(--pf-n50)" }}>
                  {b.state === "Building" ? (
                    <PfBtn variant="primary" icon="paperplane" onClick={() => exportBatch(b)}>Hand over {b.claimIds.length} claims</PfBtn>
                  ) : (
                    <PfBadge tone={bTone} dot>{b.state === "Paid" ? `Paid with the run on the ${PAYMENT_DAY}th` : `Handed over ${b.exportedAt} — payment is the payroll source's from here`}</PfBadge>
                  )}
                  <PfBtn small variant="secondary" icon="file" onClick={() => setCsvOpen((v) => (v === b.id ? null : b.id))}>{csvOpen === b.id ? "Hide" : "Preview"} the file</PfBtn>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{b.note}</span>
                </div>

                {csvOpen === b.id && (
                  <div style={{ padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                    <Label>What leaves the building — {b.id}</Label>
                    <pre style={{ margin: 0, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.75, color: "var(--pf-n900)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "12px 14px", overflowX: "auto" }}>
                      {csvFor(b) || BATCH_CSV_SAMPLE}
                    </pre>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      <div>
                        <Label>Six columns, and that is the whole file</Label>
                        <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                          Claim id, worker id, period, amount, approval date, and which steps approved it. A spreadsheet can open it; that is the point of shipping the CSV adapter first.
                        </div>
                      </div>
                      <div>
                        <Label>What it deliberately does not carry</Label>
                        {["Bank account or sort code — this platform has never held one", "BVN, RSA PIN or tax identifier", "Salary, grade, or anything about the person", "Receipts and attachments — those stay in the claim", "Any instruction about when or whether to pay"].map((x) => (
                          <div key={x} style={{ display: "flex", gap: 7, fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5, marginBottom: 4 }}>
                            <Ic name="x" size={11} color="var(--pf-n300)" weight={2.4} />
                            <span>{x}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <Foot icon="wallet">
                  {b.paymentRef
                    ? <>Reference <b style={{ color: "var(--pf-n600)" }}>{b.paymentRef}</b> came back from the connected payroll source after it paid, and was recorded against the claims so the claimants could be told. It was not created here.</>
                    : <>Nothing in this batch has been paid. The pay run is {b.runDate}, it happens in your payroll system, and this platform will learn about it when a reference comes back.</>}
                </Foot>
              </PfCard>
            );
          })}

          {/* the honest limits of the handoff */}
          <PfCard>
            <PfCardHead title="What Hirebrew does and does not do with this money" sub="Worth being blunt about, because expense software that quietly becomes payment software is how tenants end up with two ledgers." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <div style={{ padding: "15px 20px" }}>
                <Label>Does</Label>
                {[
                  "Runs the claim, the policy check and the approval chain",
                  "Records who approved what, when, and on what reason",
                  "Groups cleared claims into a batch and hands it over",
                  "Records the payment reference the payroll source sends back",
                  "Tells the claimant where the claim is, in words",
                ].map((x) => (
                  <div key={x} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55, marginBottom: 6 }}>
                    <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                    <span>{x}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "15px 20px", borderLeft: "1px solid var(--pf-n50)" }}>
                <Label>Does not</Label>
                {[
                  "Compute pay, tax, PAYE or pension — none of it, ever",
                  "Hold funds, or sit on a payment rail",
                  "Store a bank account, a BVN or an RSA PIN",
                  "Decide when the run happens — that is the payroll source's calendar",
                  "Reject a claim on its own authority",
                ].map((x) => (
                  <div key={x} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55, marginBottom: 6 }}>
                    <Ic name="x" size={13} color="var(--pf-red-500)" weight={2.2} />
                    <span>{x}</span>
                  </div>
                ))}
              </div>
            </div>
            <Foot icon="orbit">
              The connector is a contract, not a partnership. One adapter is live today and needs no counterparty at all; {CONNECTOR_AWAITING} more implement the same interface and switch on without changing anything you see on this page.
            </Foot>
          </PfCard>
        </div>
      )}
    </div>
  );
}
