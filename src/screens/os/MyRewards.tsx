"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfSegments,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ANNUAL_CASH, APPROVAL_THRESHOLD, BASIC, DATA_ALLOWANCE,
  EMPLOYEE_PENSION, EMPLOYEE_PENSION_PCT, EMPLOYER_PENSION, EMPLOYER_PENSION_PCT,
  HMO_COVER, HOUSING, LEAVE_DAYS_CARRIED, LEAVE_DAYS_ENTITLED, LEAVE_DAY_VALUE, LEAVE_VALUE,
  LIFE_COVER, LIFE_PREMIUM, MY_COVER, MY_REWARDS, MY_REWARDS_ACCESS_LOG, MY_REWARD_COMPONENTS,
  MY_REWARD_HISTORY, PENSIONABLE_EMOLUMENTS, REWARDS_ACCESS_NOTE, REWARDS_EXCLUSIONS,
  REWARDS_SUBJECT, REWARDS_TODAY, TRANSPORT, WORKING_DAYS_PER_YEAR,
  cashComponents, contextComponents, nairaExact, nonCashComponents, recentRewardHistory,
  type RewardChange, type RewardComponent, type RewardExclusion,
} from "@/data/rewards";
import { naira } from "@/data/requisitions";
import { ME_PUBLIC, ME_FIRST, MY_DOCS, MY_ENTITLEMENT, MY_HANDBOOK, MY_LND_REQUESTS, MY_MANAGER } from "@/data/me";

/**
 * My total rewards — FR-097. The first page in the product that shows Amara her
 * own money, which makes it the page with the least room to be clever.
 *
 * What it is: a STATEMENT, generated from the record. It reads what the company
 * already owes and already provides, adds it up, and shows her the total. It
 * computes nothing anyone will be paid from. It is not a payslip — a payslip is
 * a month, net of PAYE and pension, and it comes from your payroll system. It is
 * not a promise — nothing here says what next year holds.
 *
 * Four rules inherited from `@/data/rewards` that this screen must not soften:
 *
 *  · R4 — SELF-SCOPED, HARD. `MY_REWARDS` is E-0214 and there is no accessor
 *    that takes an id. Nothing on this page can be pointed at a colleague.
 *  · R5 — THE MARKET POSITION IS NOT A REWARD. Her band median and her gap to it
 *    are HR's retention analysis, held for a decision the company has not made.
 *    They appear here as a NAMED ABSENCE with no figure attached, which is the
 *    honest way to withhold something: say you are withholding it and say where
 *    it lives. This screen never imports Retention.tsx.
 *  · R6 — A TOTAL-REWARD FIGURE IS NOT A SALARY. ₦24.6M is cash plus what the
 *    company pays other people on her behalf. Nobody will ever pay her that
 *    number, and the page says so above the fold rather than in a footnote.
 *  · Deductions are not rewards. Her own 8% pension is her money leaving her
 *    pay. It is shown, and it is not added — with the arithmetic of the
 *    inflation it would cause made available, because "trust me" is not a
 *    control and a reader who can see the wrong total is likelier to believe
 *    the right one.
 *
 * Nothing on this page is AI. Every figure is arithmetic on a contract, a
 * statute or a provider invoice, and every one of them carries a "Why this?"
 * naming its inputs (FR-093). Vendor-neutral throughout: the payroll decision is
 * open, so payment is "your payroll system" and never a name.
 *
 * Deterministic — reference day is Aug 28, 2026 (REWARDS_TODAY).
 */

/* --------------------------------- subject --------------------------------- */

const ME = ME_PUBLIC;
const R = MY_REWARDS;

const CASH = cashComponents();
const NONCASH = nonCashComponents();
const CONTEXT = contextComponents();
const IN_TOTAL: RewardComponent[] = [...CASH, ...NONCASH];

/** DERIVED — what the two `inTotal: false` lines would add if anyone added them. */
const NOT_ADDED = CONTEXT.reduce((a, c) => a + c.amountNaira, 0);
const INFLATED_TOTAL = R.totalNaira + NOT_ADDED;
const INFLATION_PCT = ((NOT_ADDED / R.totalNaira) * 100).toFixed(1);

/** DERIVED — the RSA sees both halves; only one of them is a reward. */
const RSA_ANNUAL = EMPLOYER_PENSION + EMPLOYEE_PENSION;

/** DERIVED — the counterfactual the PRA 2014 definition rules out. */
const GROSS_BASE_EMPLOYER = Math.round((ANNUAL_CASH * EMPLOYER_PENSION_PCT) / 100);
const GROSS_BASE_EMPLOYEE = Math.round((ANNUAL_CASH * EMPLOYEE_PENSION_PCT) / 100);

const LND_POOL = MY_COVER.find((c) => c.name === "L&D company pool")?.value ?? 0;

const PAYROLL_CARD = MY_HANDBOOK.find((h) => h.id === "hb-payroll");
const CONTRACT_DOC = MY_DOCS.find((d) => d.name.startsWith("Employment contract v2"));

const first = (n: string) => n.split(" ")[0];

/* ------------------------------- money format ------------------------------ */

/**
 * Two formatters, on purpose, and the header of `@/data/rewards` explains why:
 * `naira()` rounds to ₦0.1M and is right for a headline; `nairaExact()` is right
 * for a line item, because a ₦162,000 premium rendered as "₦0.2M" is a figure
 * the reader cannot check against anything.
 */
const pctOf = (n: number, of: number): number => (of === 0 ? 0 : (n / of) * 100);
const pct1 = (n: number, of: number): string => `${pctOf(n, of).toFixed(1)}%`;

type Period = "year" | "month";
const per = (n: number, p: Period): number => (p === "year" ? n : Math.round(n / 12));
const perLabel: Record<Period, string> = { year: "a year", month: "a month" };

/* ------------------------------ derived: history --------------------------- */

const PROMO = MY_REWARD_HISTORY.find((h) => h.id === "RH-05");
const DATA_UPLIFT = MY_REWARD_HISTORY.find((h) => h.id === "RH-01");

/**
 * DERIVED, not seeded. Two of the five history rows carry cash figures; walked
 * forward they should land exactly on ANNUAL_CASH, and RECONCILES proves it.
 * If it ever goes false the history is telling a different story from the
 * statement above it, which is the one failure this page cannot survive.
 */
type CashStep = { at: string; value: number; what: string; delta?: number };

const PROMO_FROM = PROMO?.fromNaira ?? 0;
const PROMO_TO = PROMO?.toNaira ?? 0;
const UPLIFT_DELTA = (DATA_UPLIFT?.toNaira ?? 0) - (DATA_UPLIFT?.fromNaira ?? 0);

const CASH_STEPS: CashStep[] = [
  { at: "Before May 2025", value: PROMO_FROM, what: "Grade L4 · annual cash" },
  { at: PROMO?.effective ?? "May 1, 2025", value: PROMO_TO, what: "Promotion to L5", delta: PROMO_TO - PROMO_FROM },
  { at: DATA_UPLIFT?.effective ?? "Aug 1, 2026", value: PROMO_TO + UPLIFT_DELTA, what: "Data allowance uplift", delta: UPLIFT_DELTA },
];

const RECONCILES = CASH_STEPS[CASH_STEPS.length - 1].value === ANNUAL_CASH;

/** DERIVED — the only cash change inside the 12-month window, and how small it is. */
const RECENT = recentRewardHistory();
const RECENT_CASH = RECENT.filter((c) => c.kind === "cash");
const RECENT_CASH_DELTA = RECENT_CASH.reduce((a, c) => a + ((c.toNaira ?? 0) - (c.fromNaira ?? 0)), 0);

/** What a from→to pair on a history row actually measures. Four rows, four units. */
const measuresOf = (c: RewardChange): string =>
  c.kind === "cash"
    ? "annual cash pay — money that reaches your account"
    : c.id === "RH-03"
      ? "cover payable to your beneficiaries — not a cost, and not pay"
      : c.fromNaira !== undefined || c.toNaira !== undefined
        ? "what the company pays a provider on your behalf"
        : "an entitlement you may draw — not a figure added to your total";

const changeTone = (c: RewardChange): PfTone =>
  c.kind === "cash" ? "green" : c.id === "RH-03" ? "purple" : "blue";

const changeIcon = (c: RewardChange): string =>
  c.kind === "cash" ? "wallet" : c.id === "RH-03" ? "shield" : c.id === "RH-04" ? "heart" : "book";

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
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</span>
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

function Switch({ on, onToggle, label, tone = "grey" }: { on: boolean; onToggle: () => void; label: ReactNode; tone?: PfTone }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onToggle}
      style={{
        display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "inherit", cursor: "pointer",
        background: on ? TONE[tone].soft : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${on ? TONE[tone].line : "var(--pf-n50)"}`, borderRadius: 9, padding: "8px 12px", textAlign: "left",
      }}
    >
      <span style={{ width: 30, height: 17, borderRadius: 999, background: on ? TONE[tone].bg : "var(--pf-n100)", flex: "none", position: "relative", transition: "background .2s ease" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 15 : 2, width: 13, height: 13, borderRadius: "50%", background: "#fff", transition: "left .2s ease", boxShadow: "0 1px 2px rgba(2,6,23,.25)" }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: on ? TONE[tone].fg : "var(--pf-n500)", lineHeight: 1.4 }}>{label}</span>
    </button>
  );
}

/** A row of arithmetic, written out so the reader can check it rather than trust it. */
function Calc({ steps, result, resultLabel, tone = "green" }: {
  steps: { label: string; value: string; op?: string }[];
  result: string; resultLabel: string; tone?: PfTone;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: 8 }}>
      {steps.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
          {i > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: "var(--pf-n300)" }}>{s.op ?? "+"}</span>
          )}
          <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 11px", minWidth: 96 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".2px", textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", marginTop: 3 }}>{s.value}</div>
          </div>
        </div>
      ))}
      <span style={{ display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 700, color: "var(--pf-n300)" }}>=</span>
      <div style={{ background: TONE[tone].soft, border: `1px solid ${TONE[tone].line}`, borderRadius: 9, padding: "8px 11px", minWidth: 96 }}>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: TONE[tone].fg, letterSpacing: ".2px", textTransform: "uppercase" }}>{resultLabel}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TONE[tone].fg, marginTop: 3 }}>{result}</div>
      </div>
    </div>
  );
}

/**
 * The FR-093 affordance. Nothing on this page is a model output, so the panel
 * closes by saying which model card applies — none, because none ran — and
 * names the inputs instead. A figure about someone's pay that cannot be traced
 * to a document is a rumour with a currency symbol.
 */
function WhyFigure({ claim, basis, source, gate }: { claim: string; basis: string[]; source: string; gate?: string }) {
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
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>What it is computed from</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {basis.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                <Ic name="check" size={12} color="var(--pf-primary-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 5px" }}>Source</div>
          <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{source}</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
            <Ic name="robot" size={14} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1, minWidth: 230, lineHeight: 1.45 }}>
              No model card, because no model ran. This is arithmetic on a document — same inputs, same answer, every time.
              {gate ? ` ${gate}` : ""}
            </span>
            <PfBtn small variant="secondary" icon="robot" onClick={() => go("aisurfaces")}>AI surface audit</PfBtn>
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------------------- split bar -------------------------------- */

type Seg = { id: string; name: string; value: number; tone: PfTone; kind: string };

/**
 * The proportion bar. Built from the real percentages the data layer computed —
 * 88 cash / 12 non-cash — never from a hand-tuned width. In component mode it
 * splits into all eight lines that are actually in the total, so the reader can
 * see that four cash lines carry the statement and the smallest line on it is a
 * ₦162,000 insurance premium.
 */
function SplitBar({ segs, total, hot, onHot, period }: {
  segs: Seg[]; total: number; hot: string | null; onHot: (id: string | null) => void; period: Period;
}) {
  return (
    <div>
      <div style={{ display: "flex", height: 34, borderRadius: 9, overflow: "hidden", border: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
        {segs.map((s) => {
          const w = pctOf(s.value, total);
          const dim = hot !== null && hot !== s.id;
          return (
            <button
              key={s.id}
              onMouseEnter={() => onHot(s.id)}
              onMouseLeave={() => onHot(null)}
              title={`${s.name} — ${nairaExact(per(s.value, period))} ${perLabel[period]} · ${pct1(s.value, total)} of the total`}
              style={{
                width: `${w}%`, minWidth: w > 0 ? 3 : 0, border: "none", padding: 0, cursor: "pointer",
                background: TONE[s.tone].bg, opacity: dim ? 0.35 : 1, transition: "opacity .18s ease",
                borderRight: "1px solid rgba(255,255,255,.55)", fontFamily: "inherit",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 16px", marginTop: 12 }}>
        {segs.map((s) => {
          const dim = hot !== null && hot !== s.id;
          return (
            <button
              key={s.id}
              onMouseEnter={() => onHot(s.id)}
              onMouseLeave={() => onHot(null)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, background: "none", border: "none",
                padding: 0, cursor: "pointer", fontFamily: "inherit", opacity: dim ? 0.45 : 1, transition: "opacity .18s ease",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, background: TONE[s.tone].bg, flex: "none" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{s.name}</span>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{pct1(s.value, total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- component row ------------------------------ */

function CompRow({ c, total, period, hot, onHot, open, onToggle, onAsk }: {
  c: RewardComponent; total: number; period: Period; hot: string | null;
  onHot: (id: string | null) => void; open: boolean; onToggle: () => void; onAsk: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const lit = hot === c.id;
  const zero = c.amountNaira === 0;
  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onMouseEnter={() => onHot(c.id)}
        onMouseLeave={() => onHot(null)}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "1.5fr 120px 128px 74px 26px", alignItems: "center",
          gap: 12, padding: "13px 20px", cursor: "pointer",
          background: open || hovered || lit ? "var(--pf-n25)" : "var(--pf-n0)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <PfTile icon={c.icon} tone={c.tone} size={28} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name}
            </span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.basis}
            </span>
          </span>
        </span>
        <span>
          <PfBadge tone={c.kind === "cash" ? "green" : "blue"}>{c.kind === "cash" ? "Cash" : "Non-cash"}</PfBadge>
        </span>
        <span style={{ fontSize: 14, fontWeight: 700, color: zero ? "var(--pf-n300)" : "var(--pf-n900)", textAlign: "right", letterSpacing: "-.2px" }}>
          {nairaExact(per(c.amountNaira, period))}
        </span>
        <span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ flex: 1 }}>
              <PfProgress pct={pctOf(c.amountNaira, total)} tone={c.tone === "grey" ? "grey" : c.tone} height={5} />
            </span>
            <span style={{ fontSize: 10.5, color: "var(--pf-n400)", width: 30, textAlign: "right" }}>{pctOf(c.amountNaira, total).toFixed(0)}%</span>
          </div>
        </span>
        <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
          <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
        </span>
      </div>

      {open && (
        <div style={{ padding: "0 20px 16px", background: "var(--pf-n25)" }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
            {c.detail && (
              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, marginBottom: 11 }}>{c.detail}</div>
            )}
            {zero && (
              <div style={{ marginBottom: 11 }}>
                <PfBanner tone="yellow" icon="warning">
                  This is the only line on your statement worth nothing, and it is the only one you can change today. The pool
                  exists whether or not you draw on it; the statement values what you have actually drawn.
                </PfBanner>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center" }}>
              <PfBadge tone="grey">{pct1(c.amountNaira, total)} of your total</PfBadge>
              <PfBadge tone="grey">{nairaExact(Math.round(c.amountNaira / 12))} a month</PfBadge>
              <PfBadge tone={c.kind === "cash" ? "green" : "blue"}>
                {c.kind === "cash" ? "Reaches your account" : "Paid to someone else on your behalf"}
              </PfBadge>
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" icon="chat" onClick={(() => onAsk())}>Question this figure</PfBtn>
            </div>
            <div style={{ marginTop: 12 }}>
              <WhyFigure
                claim={`${c.name} — ${nairaExact(c.amountNaira)} a year, ${pct1(c.amountNaira, total)} of your total reward.`}
                basis={[
                  `Counted as ${c.kind === "cash" ? "cash" : "non-cash"}: ${c.kind === "cash" ? "it is paid to you and appears on your payslip before deductions." : "the company pays it to a provider, so it never passes through your account."}`,
                  `Included in the total: ${c.inTotal ? "yes." : "no — see the shown-not-added section."}`,
                  `Annual figure ${nairaExact(c.amountNaira)}; monthly ${nairaExact(Math.round(c.amountNaira / 12))} is that figure divided by twelve, not a payslip line.`,
                  "Read from the record. Nothing about it was estimated, modelled or inferred.",
                ]}
                source={c.basis}
                gate="If the figure looks wrong to you, question it — a person at People Ops answers, and the answer lands in writing."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =================================== screen ================================= */

type Tab = "statement" | "parts" | "history";
type KindFilter = "all" | "cash" | "non-cash";
type SortKey = "listed" | "largest";
type SplitMode = "kind" | "component";
type HistFilter = "all" | "12m" | "cash" | "non-cash";
type Purpose = "records" | "lender" | "visa";

type Query = { id: string; componentId: string; component: string; text: string; at: string };

const PURPOSE_LABEL: Record<Purpose, string> = {
  records: "My own records",
  lender: "A mortgage or loan application",
  visa: "A visa or embassy file",
};

export default function MyRewards() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("statement");

  /* ------------------------------ the statement --------------------------- */
  const [period, setPeriod] = useState<Period>("year");
  const [splitMode, setSplitMode] = useState<SplitMode>("kind");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("listed");
  const [hot, setHot] = useState<string | null>(null);
  const [openComp, setOpenComp] = useState<string | null>(null);
  const [showInflated, setShowInflated] = useState(false);
  const [openContext, setOpenContext] = useState<string | null>("RC-pension-ee");
  const [openCover, setOpenCover] = useState<string | null>(null);
  const [openExcl, setOpenExcl] = useState<string | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  /* -------------------------------- questions ------------------------------ */
  const [queries, setQueries] = useState<Query[]>([]);
  const [qComponent, setQComponent] = useState<string>(MY_REWARD_COMPONENTS[0].id);
  const [qText, setQText] = useState("");
  const [askLit, setAskLit] = useState(false);

  /* --------------------------------- export -------------------------------- */
  const [purpose, setPurpose] = useState<Purpose>("records");
  const [include, setInclude] = useState({ cash: true, nonCash: true, cover: true, history: true });

  /* ------------------------------- explainers ------------------------------ */
  const [pensionPeriod, setPensionPeriod] = useState<Period>("year");
  const [pensionBase, setPensionBase] = useState<"law" | "gross">("law");
  const [drawAmt, setDrawAmt] = useState(45_000);
  const [leaveDays, setLeaveDays] = useState(LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED);
  const [openPart, setOpenPart] = useState<string | null>("pension");

  /* --------------------------------- history ------------------------------- */
  const [histFilter, setHistFilter] = useState<HistFilter>("all");
  const [openChange, setOpenChange] = useState<string | null>("RH-05");

  /* ------------------------------ derivations ------------------------------ */

  const segs: Seg[] = useMemo(() => {
    if (splitMode === "kind") {
      return [
        { id: "seg-cash", name: "Cash to you", value: R.cashNaira, tone: "green" as PfTone, kind: "cash" },
        { id: "seg-noncash", name: "Paid on your behalf", value: R.nonCashNaira, tone: "blue" as PfTone, kind: "non-cash" },
      ];
    }
    return IN_TOTAL.filter((c) => c.amountNaira > 0).map((c) => ({
      id: c.id, name: c.name, value: c.amountNaira, tone: c.tone, kind: c.kind,
    }));
  }, [splitMode]);

  const rows: RewardComponent[] = useMemo(() => {
    const base = kindFilter === "all" ? IN_TOTAL : IN_TOTAL.filter((c) => c.kind === kindFilter);
    return sortKey === "largest" ? [...base].sort((a, b) => b.amountNaira - a.amountNaira) : base;
  }, [kindFilter, sortKey]);

  const rowsTotal = rows.reduce((a, c) => a + c.amountNaira, 0);

  const headline = showInflated ? INFLATED_TOTAL : R.totalNaira;

  const changes: RewardChange[] = useMemo(() => {
    if (histFilter === "12m") return MY_REWARD_HISTORY.filter((c) => c.withinLast12Months);
    if (histFilter === "cash") return MY_REWARD_HISTORY.filter((c) => c.kind === "cash");
    if (histFilter === "non-cash") return MY_REWARD_HISTORY.filter((c) => c.kind === "non-cash");
    return MY_REWARD_HISTORY;
  }, [histFilter]);

  /* pension explainer, recomputed live from the two controls */
  const pensionBaseValue = pensionBase === "law" ? PENSIONABLE_EMOLUMENTS : ANNUAL_CASH;
  const erShare = pensionBase === "law" ? EMPLOYER_PENSION : GROSS_BASE_EMPLOYER;
  const eeShare = pensionBase === "law" ? EMPLOYEE_PENSION : GROSS_BASE_EMPLOYEE;

  /* L&D draw simulator */
  const drawNeedsApproval = drawAmt > APPROVAL_THRESHOLD;
  const simNonCash = R.nonCashNaira - (MY_ENTITLEMENT.yourDraw ?? 0) + drawAmt;
  const simTotal = R.cashNaira + simNonCash;
  const simCashPct = pctOf(R.cashNaira, simTotal);

  /* leave simulator — the value moves, the total never does. That is the lesson. */
  const simLeaveValue = LEAVE_DAY_VALUE * leaveDays;

  /* export */
  const allowed: Record<Purpose, { cash: boolean; nonCash: boolean; cover: boolean; history: boolean }> = {
    records: { cash: true, nonCash: true, cover: true, history: true },
    lender: { cash: true, nonCash: false, cover: false, history: true },
    visa: { cash: true, nonCash: false, cover: false, history: false },
  };
  const eff = {
    cash: include.cash && allowed[purpose].cash,
    nonCash: include.nonCash && allowed[purpose].nonCash,
    cover: include.cover && allowed[purpose].cover,
    history: include.history && allowed[purpose].history,
  };
  const exportFigure = eff.nonCash ? R.totalNaira : ANNUAL_CASH;
  const exportLines = (eff.cash ? CASH.length : 0) + (eff.nonCash ? NONCASH.length : 0);

  /* ------------------------------- interactions ---------------------------- */

  const askAbout = (componentId: string, prompt: string) => {
    setQComponent(componentId);
    setQText(prompt);
    setTab("statement");
    setAskLit(true);
    toast(`Drafted a question about ${MY_REWARD_COMPONENTS.find((c) => c.id === componentId)?.name ?? "this figure"} — check it before you send it`, "default");
  };

  const sendQuery = () => {
    if (!qText.trim()) {
      toast("Write the question first — an empty query gives People Ops nothing to answer", "danger");
      return;
    }
    const c = MY_REWARD_COMPONENTS.find((x) => x.id === qComponent);
    const q: Query = {
      id: `RQ-${1200 + queries.length + 1}`,
      componentId: qComponent,
      component: c?.name ?? "This statement",
      text: qText.trim(),
      at: REWARDS_TODAY,
    };
    setQueries((v) => [q, ...v]);
    setQText("");
    setAskLit(false);
    toast(`${q.id} raised with People Ops — ${q.component}, ${REWARDS_TODAY}. You will get a written answer.`, "success");
  };

  const withdrawQuery = (id: string) => {
    setQueries((v) => v.filter((q) => q.id !== id));
    toast(`${id} withdrawn — nothing was sent to anyone`, "default");
  };

  const setPurposeSafely = (p: Purpose) => {
    setPurpose(p);
    if (p !== "records") {
      toast(
        p === "lender"
          ? `Non-cash lines removed. A lender asks what you are paid — quoting ${naira(R.totalNaira)} would overstate it by ${nairaExact(R.nonCashNaira)}.`
          : "Non-cash lines and cover figures removed. An embassy wants employment facts, not a benefits valuation.",
        "default",
      );
    }
  };

  const generateExport = () => {
    toast(
      `Statement prepared for ${PURPOSE_LABEL[purpose].toLowerCase()} — ${exportLines} lines, headline ${nairaExact(exportFigure)}${eff.nonCash ? " total reward" : " annual gross cash"}`,
      "success",
    );
  };

  /* ---------------------------------- view --------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* --------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My total rewards</div>
            <PfBadge tone="grey">{REWARDS_SUBJECT.id}</PfBadge>
            <PfBadge tone="grey">{REWARDS_SUBJECT.grade}</PfBadge>
            <PfBadge tone="blue" dot>As at {R.asAt}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55 }}>
            A statement of what you receive, generated from your record. It is not a payslip &mdash; a payslip is one month,
            after PAYE and your pension, and it comes from your payroll system. It is not a promise about future pay either.
            It is this year&rsquo;s cash plus what Unrealabs spends on your behalf, added up once, with every figure traceable.
          </div>
        </div>
        <PfBtn variant="secondary" icon="wallet" onClick={() => go("myexpenses")}>My expenses</PfBtn>
        <PfBtn variant="secondary" icon="file" onClick={() => go("myletters")}>My letters</PfBtn>
      </div>

      {/* -------------------------------- KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="star" tone="green" label="Total reward"
          value={naira(R.totalNaira)} unit="a year"
          delta="not a salary" deltaTone="yellow"
        />
        <PfStat
          icon="wallet" tone="green" label="Cash to you"
          value={naira(R.cashNaira)} unit={`${CASH.length} components`}
          delta={`${R.cashPct}% of total`} deltaTone="green"
        />
        <PfStat
          icon="shield" tone="blue" label="Paid on your behalf"
          value={nairaExact(R.nonCashNaira)} unit="never reaches your account"
          delta={`${R.nonCashPct}% of total`} deltaTone="blue"
        />
        <PfStat
          icon="x" tone="grey" label="Shown, not added"
          value={nairaExact(NOT_ADDED)} unit={`${CONTEXT.length} lines`}
          delta="deliberately excluded" deltaTone="grey"
        />
      </div>

      {/* ------------------------------ lead insight ----------------------------- */}
      <div style={{ marginTop: 12 }}>
        <PfBanner tone="blue" icon="info" cta="What each part means" onCta={() => setTab("parts")}>
          {nairaExact(R.nonCashNaira)} of this statement &mdash; {R.nonCashPct}% &mdash; is money Unrealabs pays other people so
          that you have a pension, an HMO plan and life cover. It is real, and it is not yours to spend. The other {R.cashPct}%
          is cash, and PAYE and your own {EMPLOYEE_PENSION_PCT}% pension come out of it before it reaches you.
        </PfBanner>
      </div>

      {/* -------------------------------- page tabs ------------------------------ */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: "statement", label: "The statement", count: String(IN_TOTAL.length) },
            { key: "parts", label: "What each part means", count: "5" },
            { key: "history", label: "How it changed", count: String(MY_REWARD_HISTORY.length) },
          ]}
        />
      </div>

      {/* ================================ STATEMENT =============================== */}
      {tab === "statement" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ------------------------------ the headline ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="Your total reward for the year"
              sub={`${REWARDS_SUBJECT.name} · ${REWARDS_SUBJECT.role} · ${ME.dept}, ${ME.loc} · generated ${R.asAt}`}
            >
              <PfTabs tabs={["Per year", "Per month"]} active={period === "year" ? "Per year" : "Per month"} onChange={(t) => setPeriod(t === "Per year" ? "year" : "month")} />
            </PfCardHead>

            <div style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
                <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-1.2px", lineHeight: 1, color: showInflated ? "var(--pf-red-500)" : "var(--pf-n900)" }}>
                  {nairaExact(per(headline, period))}
                </div>
                <div style={{ fontSize: 13, color: "var(--pf-n400)", paddingBottom: 4 }}>{perLabel[period]}</div>
                {showInflated && (
                  <div style={{ paddingBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, color: "var(--pf-n300)", textDecoration: "line-through" }}>{nairaExact(per(R.totalNaira, period))}</span>
                    <PfBadge tone="red" dot>+{INFLATION_PCT}% overstated</PfBadge>
                  </div>
                )}
                <span style={{ flex: 1 }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <PfSegments score={IN_TOTAL.length} outOf={MY_REWARD_COMPONENTS.length} tone="green" />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                    {IN_TOTAL.length} of {MY_REWARD_COMPONENTS.length} lines are added · {CONTEXT.length} are shown and not added
                  </span>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 11, flexWrap: "wrap" }}>
                  <PfTh style={{ flex: 1, minWidth: 180 }}>
                    How it splits &mdash; {R.cashPct}% cash, {R.nonCashPct}% non-cash, computed from the figures below and not drawn to taste
                  </PfTh>
                  <PfTabs
                    tabs={["Cash vs non-cash", "Every line"]}
                    active={splitMode === "kind" ? "Cash vs non-cash" : "Every line"}
                    onChange={(t) => setSplitMode(t === "Cash vs non-cash" ? "kind" : "component")}
                  />
                </div>
                <SplitBar segs={segs} total={R.totalNaira} hot={hot} onHot={setHot} period={period} />
              </div>
            </div>

            <div style={{ padding: "0 20px 18px" }}>
              <div style={{ background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "13px 15px" }}>
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                  <Ic name="warning" size={15} color="var(--pf-yellow-500)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 4 }}>Read this before you quote the number</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>{R.caveat}</div>
                  </div>
                </div>
                <div style={{ marginTop: 11 }}>
                  <WhyFigure
                    claim={R.headline}
                    basis={[
                      `Cash ${nairaExact(R.cashNaira)} — basic, housing, transport and the data allowance, from employment contract v2.`,
                      `Non-cash ${nairaExact(R.nonCashNaira)} — the employer pension contribution, the HMO premium, the life premium and what you have drawn from the L&D pool.`,
                      `Added: ${nairaExact(R.cashNaira)} + ${nairaExact(R.nonCashNaira)} = ${nairaExact(R.totalNaira)}.`,
                      `Excluded on purpose: your own ${EMPLOYEE_PENSION_PCT}% pension (${nairaExact(EMPLOYEE_PENSION)}) and the value of your paid leave (${nairaExact(LEAVE_VALUE)}).`,
                      "No projection, no market comparison, no estimate of your take-home. None of those are on this page.",
                    ]}
                    source="Employment contract v2 (1 May 2025) · Pension Reform Act 2014 · HMO and group life provider invoices · the L&D pool ledger."
                    gate="Nothing here was decided by this platform. It reads documents other people signed."
                  />
                </div>
              </div>
            </div>
          </PfCard>

          {/* --------------------------- the component table ------------------------ */}
          <PfCard>
            <PfCardHead
              title="What makes it up"
              sub={`${rows.length} of ${IN_TOTAL.length} lines shown · every figure carries the document it came from`}
            >
              <PfTabs
                tabs={["All", "Cash", "Non-cash"]}
                active={kindFilter === "all" ? "All" : kindFilter === "cash" ? "Cash" : "Non-cash"}
                onChange={(t) => setKindFilter(t === "All" ? "all" : t === "Cash" ? "cash" : "non-cash")}
              />
              <PfBtn
                small
                variant="secondary"
                icon="filter"
                onClick={() => setSortKey((s) => (s === "listed" ? "largest" : "listed"))}
              >
                {sortKey === "listed" ? "As listed" : "Largest first"}
              </PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 120px 128px 74px 26px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Component and its source</PfTh>
              <PfTh>Kind</PfTh>
              <PfTh style={{ textAlign: "right" }}>{period === "year" ? "Per year" : "Per month"}</PfTh>
              <PfTh>Share</PfTh>
              <PfTh />
            </div>

            {rows.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center" }}>
                <PfTile icon="filter" tone="grey" size={34} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>No lines match that filter</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>Your statement has {CASH.length} cash lines and {NONCASH.length} non-cash lines.</div>
              </div>
            ) : (
              rows.map((c) => (
                <CompRow
                  key={c.id}
                  c={c}
                  total={R.totalNaira}
                  period={period}
                  hot={hot}
                  onHot={setHot}
                  open={openComp === c.id}
                  onToggle={() => setOpenComp((v) => (v === c.id ? null : c.id))}
                  onAsk={() => askAbout(c.id, `I would like to understand how ${c.name.toLowerCase()} was calculated for this statement.`)}
                />
              ))
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 120px 128px 74px 26px", gap: 12, padding: "13px 20px", borderTop: "1px solid var(--pf-n100)", background: "var(--pf-n25)", alignItems: "center" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                {kindFilter === "all" ? "Total reward" : kindFilter === "cash" ? "Cash subtotal" : "Non-cash subtotal"}
              </span>
              <span />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)", textAlign: "right", letterSpacing: "-.2px" }}>
                {nairaExact(per(rowsTotal, period))}
              </span>
              <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{pctOf(rowsTotal, R.totalNaira).toFixed(0)}%</span>
              <span />
            </div>

            <Foot icon="info">
              Monthly figures are the annual figure divided by twelve. They are not your payslip: PAYE and your{" "}
              {EMPLOYEE_PENSION_PCT}% pension are deducted before you are paid, and neither is computed here.{" "}
              {PAYROLL_CARD ? `${PAYROLL_CARD.title} · ${PAYROLL_CARD.owner} · updated ${PAYROLL_CARD.updated}.` : ""}
            </Foot>
          </PfCard>

          {/* -------------------------- shown, not added --------------------------- */}
          <PfCard>
            <PfCardHead
              title="Shown here, and not added to the total"
              sub="Two lines that belong on your statement and do not belong in the sum. Both would inflate it with money that is already counted, or money that is not a reward at all."
            />
            {CONTEXT.map((c) => {
              const isDeduction = c.id === "RC-pension-ee";
              const open = openContext === c.id;
              return (
                <div key={c.id} style={{ borderTop: "1px solid var(--pf-n50)" }}>
                  <button
                    onClick={() => setOpenContext((v) => (v === c.id ? null : c.id))}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                      fontFamily: "inherit", background: open ? "var(--pf-n25)" : "var(--pf-n0)", border: "none",
                      padding: "13px 20px", cursor: "pointer",
                    }}
                  >
                    <PfTile icon={c.icon} tone="grey" size={28} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.name}</span>
                        <PfBadge tone={isDeduction ? "red" : "yellow"}>
                          {isDeduction ? "A deduction, not a reward" : "Already inside your base salary"}
                        </PfBadge>
                      </span>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{c.basis}</span>
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n300)", textDecoration: "line-through", textDecorationColor: "var(--pf-n100)" }}>
                      {nairaExact(c.amountNaira)}
                    </span>
                    <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
                  </button>

                  {open && (
                    <div style={{ padding: "0 20px 16px", background: "var(--pf-n25)" }}>
                      <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>{c.detail}</div>
                        <div style={{ marginTop: 13 }}>
                          {isDeduction ? (
                            <Calc
                              tone="grey"
                              steps={[
                                { label: "Pensionable", value: naira(PENSIONABLE_EMOLUMENTS) },
                                { label: `Your share`, value: `${EMPLOYEE_PENSION_PCT}%`, op: "×" },
                              ]}
                              result={nairaExact(EMPLOYEE_PENSION)}
                              resultLabel="Out of your pay"
                            />
                          ) : (
                            <Calc
                              tone="grey"
                              steps={[
                                { label: "Daily rate", value: nairaExact(LEAVE_DAY_VALUE) },
                                { label: "Days", value: `${LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED}`, op: "×" },
                              ]}
                              result={nairaExact(LEAVE_VALUE)}
                              resultLabel="Value of your leave"
                            />
                          )}
                        </div>
                        <div style={{ marginTop: 13 }}>
                          <WhyFigure
                            claim={`${c.name} is on your statement and is excluded from the ${nairaExact(R.totalNaira)} total.`}
                            basis={
                              isDeduction
                                ? [
                                    `${EMPLOYEE_PENSION_PCT}% of ${nairaExact(PENSIONABLE_EMOLUMENTS)} pensionable emoluments = ${nairaExact(EMPLOYEE_PENSION)}.`,
                                    "It is deducted from pay the company already counts as your basic, housing and transport.",
                                    "Counting it as a reward would count that same salary a second time.",
                                    `It does reach your RSA: ${nairaExact(EMPLOYER_PENSION)} from Unrealabs plus ${nairaExact(EMPLOYEE_PENSION)} from you is ${nairaExact(RSA_ANNUAL)} a year into your own account.`,
                                  ]
                                : [
                                    `${nairaExact(ANNUAL_CASH)} ÷ ${WORKING_DAYS_PER_YEAR} working days = ${nairaExact(LEAVE_DAY_VALUE)} a day.`,
                                    `${LEAVE_DAYS_ENTITLED} days entitlement + ${LEAVE_DAYS_CARRIED} carried = ${LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED} days.`,
                                    `${LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED} × ${nairaExact(LEAVE_DAY_VALUE)} = ${nairaExact(LEAVE_VALUE)}.`,
                                    "You are paid your salary while on leave. The salary is already in the total, so the leave value cannot be.",
                                  ]
                            }
                            source={c.basis}
                            gate={isDeduction ? "Your RSA statement, not this page, is the record of your fund balance." : "The 5 carried days expire on 31 March."}
                          />
                        </div>
                        {!isDeduction && (
                          <div style={{ marginTop: 12, display: "flex", gap: 9, flexWrap: "wrap" }}>
                            <PfBtn small variant="secondary" icon="calendar" onClick={() => go("myleave")}>Book or check leave</PfBtn>
                            <PfBtn small variant="ghost" icon="arrowright" onClick={() => { setTab("parts"); setOpenPart("leave"); }}>See the calculation</PfBtn>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <Switch
                on={showInflated}
                tone="red"
                onToggle={() => {
                  setShowInflated((v) => !v);
                  toast(
                    showInflated
                      ? `Back to ${nairaExact(R.totalNaira)} — the figure your record supports`
                      : `Headline now shows ${nairaExact(INFLATED_TOTAL)} — ${INFLATION_PCT}% too high, and this is how a total-reward figure gets inflated`,
                    showInflated ? "default" : "danger",
                  );
                }}
                label={showInflated ? "Showing the inflated total — switch it back" : "Show what the total would look like if these two were added"}
              />
              <div style={{ flex: 1, minWidth: 240 }}>
                <Note icon="warning" tone={showInflated ? "red" : "grey"}>
                  {nairaExact(R.totalNaira)} + {nairaExact(EMPLOYEE_PENSION)} + {nairaExact(LEAVE_VALUE)} ={" "}
                  {nairaExact(INFLATED_TOTAL)}, which is {INFLATION_PCT}% higher and wrong twice over. Statements that quietly do
                  this are common. This one shows you the arithmetic instead of asking you to take its word.
                </Note>
              </div>
            </div>
          </PfCard>

          {/* -------------------------------- cover -------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Cover and pools — size is not cost"
              sub="Three figures that are large and are not money you have. They are what a benefit is worth if you need it, or what a pool holds before anyone draws on it."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, padding: "16px 20px" }}>
              {MY_COVER.map((c) => {
                const open = openCover === c.name;
                return (
                  <button
                    key={c.name}
                    onClick={() => setOpenCover((v) => (v === c.name ? null : c.name))}
                    style={{
                      textAlign: "left", fontFamily: "inherit", cursor: "pointer",
                      background: open ? "var(--pf-n25)" : "var(--pf-n0)",
                      border: `1px solid ${open ? "var(--pf-n100)" : "var(--pf-n50)"}`, borderRadius: 11, padding: "14px 15px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <PfTile icon={c.icon} tone={c.name.includes("life") ? "purple" : c.name.includes("HMO") ? "blue" : "green"} size={28} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 0 }}>{c.name}</span>
                      <Ic name={open ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px", marginTop: 11 }}>
                      {naira(c.value)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>{nairaExact(c.value)}</div>
                    {open && (
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                        {c.basis}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <Foot icon="shield">
              The {naira(LIFE_COVER)} life cover is what your named beneficiaries receive. The company pays{" "}
              {nairaExact(LIFE_PREMIUM)} a year to buy it, and {nairaExact(LIFE_PREMIUM)} is what is on your statement above.
              Putting the cover in your total reward would be the most flattering possible lie about your pay.
            </Foot>
          </PfCard>

          {/* ------------------------- question a figure --------------------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            <PfCard style={askLit ? { borderColor: "var(--pf-primary-100)", boxShadow: "0 0 0 3px var(--pf-primary-50)" } : undefined}>
              <PfCardHead
                title="Question a figure"
                sub="If a number on this page does not match what you believe you were told, say so. It goes to People Ops as a written query against a named line."
              />
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div>
                  <Label hint="the line you are asking about">Which figure</Label>
                  <select value={qComponent} onChange={(e) => setQComponent(e.target.value)} style={{ ...INPUT, cursor: "pointer" }}>
                    {MY_REWARD_COMPONENTS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {nairaExact(c.amountNaira)}{c.inTotal ? "" : " (shown, not added)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label hint="plain words are fine">Your question</Label>
                  <textarea
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    rows={4}
                    placeholder={`e.g. my contract says the data allowance changed in August — does this statement use the new figure?`}
                    style={{ ...INPUT, resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap", alignItems: "center" }}>
                  <PfBtn variant="primary" icon="paperplane" onClick={sendQuery}>Send to People Ops</PfBtn>
                  {qText.trim().length > 0 && (
                    <PfBtn variant="ghost" icon="x" onClick={() => { setQText(""); setAskLit(false); }}>Clear</PfBtn>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{qText.trim().length} characters</span>
                </div>
                <Note icon="user">
                  Your manager is not copied. A query about your own pay is between you and People Ops, and{" "}
                  {MY_MANAGER.name} has no view of this statement at all.
                </Note>
              </div>

              {queries.length === 0 ? (
                <Foot icon="check">
                  You have not questioned anything on this statement. That is the normal state, not an omission &mdash; the
                  button exists so that disagreeing is a one-minute action rather than a meeting you have to ask for.
                </Foot>
              ) : (
                <div>
                  {queries.map((q) => (
                    <div key={q.id} style={{ borderTop: "1px solid var(--pf-n50)", padding: "12px 20px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <PfTile icon="chat" tone="blue" size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{q.id}</span>
                          <PfBadge tone="yellow" dot>With People Ops</PfBadge>
                          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{q.component} · {q.at}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.5 }}>{q.text}</div>
                      </div>
                      <PfBtn small variant="ghost" icon="x" onClick={() => withdrawQuery(q.id)}>Withdraw</PfBtn>
                    </div>
                  ))}
                </div>
              )}
            </PfCard>

            {/* --------------------------- export the statement -------------------- */}
            <PfCard>
              <PfCardHead
                title="Take this statement somewhere"
                sub="What you are using it for changes what should be in it. This is not a formatting preference — quoting the wrong figure to a bank is a problem you carry, not us."
              />
              <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
                <div>
                  <Label>What is it for</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {(Object.keys(PURPOSE_LABEL) as Purpose[]).map((p) => {
                      const on = purpose === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setPurposeSafely(p)}
                          style={{
                            display: "flex", alignItems: "center", gap: 9, fontFamily: "inherit", cursor: "pointer",
                            textAlign: "left", background: on ? "var(--pf-primary-50)" : "var(--pf-n0)",
                            border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n50)"}`, borderRadius: 9, padding: "10px 12px",
                          }}
                        >
                          <span style={{ width: 15, height: 15, borderRadius: "50%", flex: "none", border: `1.5px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-primary-500)" }} />}
                          </span>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{PURPOSE_LABEL[p]}</span>
                            <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>
                              {p === "records"
                                ? "Everything on this page, exactly as you see it."
                                : p === "lender"
                                  ? `Cash only. A lender asks what you are paid; the total would overstate that by ${nairaExact(R.nonCashNaira)}.`
                                  : "Cash and employment facts. A letter of employment is the right instrument for an embassy."}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label hint={purpose === "records" ? "all four available" : "some are locked by the purpose"}>What goes in</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {([
                      ["cash", `Cash components (${CASH.length} lines, ${nairaExact(ANNUAL_CASH)})`],
                      ["nonCash", `Non-cash components (${NONCASH.length} lines, ${nairaExact(R.nonCashNaira)})`],
                      ["cover", `Cover and pool figures (${MY_COVER.length})`],
                      ["history", `Change history (${MY_REWARD_HISTORY.length} entries)`],
                    ] as [keyof typeof include, string][]).map(([k, lbl]) => {
                      const locked = !allowed[purpose][k];
                      const on = eff[k];
                      return (
                        <button
                          key={k}
                          disabled={locked}
                          onClick={() => setInclude((v) => ({ ...v, [k]: !v[k] }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 9, fontFamily: "inherit",
                            cursor: locked ? "not-allowed" : "pointer", textAlign: "left",
                            background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 8,
                            padding: "8px 11px", opacity: locked ? 0.55 : 1,
                          }}
                        >
                          <span style={{ width: 15, height: 15, borderRadius: 4, flex: "none", border: `1.5px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, background: on ? "var(--pf-primary-500)" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                            {on && <Ic name="check" size={10} color="#fff" weight={3} />}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n600)", flex: 1 }}>{lbl}</span>
                          {locked && <PfBadge tone="grey">Locked</PfBadge>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase" }}>The figure it will quote</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{nairaExact(exportFigure)}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{eff.nonCash ? "total reward" : "annual gross cash"}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 7, lineHeight: 1.55 }}>
                    {eff.nonCash
                      ? "The full statement, non-cash included. Correct for your own records and misleading almost anywhere else."
                      : `Gross cash before PAYE and your ${EMPLOYEE_PENSION_PCT}% pension. It is the figure a third party actually means when they ask what you earn.`}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="download" onClick={generateExport}>Prepare the statement</PfBtn>
                  <PfBtn variant="secondary" icon="file" onClick={() => go("myletters")}>Request a letter instead</PfBtn>
                </div>
                <Note icon="info">
                  Nothing here is a payslip and nothing here is stamped by your payroll system. If the recipient needs a
                  document with an employer&rsquo;s signature on it, a letter of employment is what you want.
                </Note>
              </div>
            </PfCard>
          </div>

          {/* ------------------------- what is not on this page --------------------- */}
          <PfCard>
            <PfCardHead
              title="What this statement deliberately does not tell you"
              sub={`${REWARDS_EXCLUSIONS.length} things exist about your reward that are not on this page. Naming them is the point — a withheld figure you do not know is withheld is just a gap.`}
            >
              <PfBadge tone="grey">No figures in this list</PfBadge>
            </PfCardHead>
            {REWARDS_EXCLUSIONS.map((x: RewardExclusion) => {
              const open = openExcl === x.item;
              return (
                <div key={x.item} style={{ borderTop: "1px solid var(--pf-n50)" }}>
                  <button
                    onClick={() => setOpenExcl((v) => (v === x.item ? null : x.item))}
                    style={{
                      display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left",
                      fontFamily: "inherit", background: open ? "var(--pf-n25)" : "var(--pf-n0)",
                      border: "none", padding: "13px 20px", cursor: "pointer",
                    }}
                  >
                    <Ic name="x" size={14} color="var(--pf-n300)" weight={2.2} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{x.item}</span>
                    <PfBadge tone="grey">{x.livesIn}</PfBadge>
                    <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
                  </button>
                  {open && (
                    <div style={{ padding: "0 20px 15px 45px", background: "var(--pf-n25)" }}>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>{x.why}</div>
                    </div>
                  )}
                </div>
              );
            })}
            <Foot icon="shield">
              Your market position in particular. HR holds a read of where your grade sits against the external market, and it
              is not on this page in any form &mdash; not as a number, not as a percentage, not as a hint. It is the
              company&rsquo;s own view of its exposure, held for a pay decision it has not made. If that decision is ever made,
              it will show up in your history as a change, which is the honest moment to tell you.
            </Foot>
          </PfCard>

          {/* ------------------------------ access log ------------------------------ */}
          <PfCard>
            <PfCardHead
              title="Who has opened your statement"
              sub={`${MY_REWARDS_ACCESS_LOG.length} reads on record · every open is logged, including your own`}
            >
              <PfBtn small variant="secondary" icon={logOpen ? "caretdown" : "caretright"} onClick={() => setLogOpen((v) => !v)}>
                {logOpen ? "Hide the log" : "Show the log"}
              </PfBtn>
              <PfBtn small variant="secondary" icon="shield" onClick={() => go("myprivacy")}>My data &amp; privacy</PfBtn>
            </PfCardHead>
            {logOpen && (
              <div>
                {MY_REWARDS_ACCESS_LOG.map((a) => (
                  <div key={a.at} style={{ display: "grid", gridTemplateColumns: "108px 1.2fr 1.4fr 1fr", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)" }}>{a.at}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.who}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>{a.action}</span>
                    <span><PfBadge tone="blue">{a.lawfulBasis}</PfBadge></span>
                  </div>
                ))}
              </div>
            )}
            <Foot icon="shield">{REWARDS_ACCESS_NOTE}</Foot>
          </PfCard>
        </div>
      )}

      {/* ============================ WHAT EACH PART MEANS ======================== */}
      {tab === "parts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="book" cta="Back to the statement" onCta={() => setTab("statement")}>
            Five things on your statement are easy to misread, and every one of them costs somebody money or trust when they
            are misread. Here is what each one is, in the plainest words available, with the arithmetic shown.
          </PfBanner>

          {/* --------------------------------- pension ------------------------------ */}
          <PfCard>
            <PfCardHead
              title="Pension — 10% from Unrealabs, 8% from you"
              sub="Two contributions, one account, and only one of them is a reward. Both land in the same Retirement Savings Account with your name on it."
            >
              <PfTabs tabs={["Per year", "Per month"]} active={pensionPeriod === "year" ? "Per year" : "Per month"} onChange={(t) => setPensionPeriod(t === "Per year" ? "year" : "month")} />
              <PfBtn small variant="ghost" icon={openPart === "pension" ? "caretdown" : "caretright"} onClick={() => setOpenPart((v) => (v === "pension" ? null : "pension"))}>
                {openPart === "pension" ? "Collapse" : "Expand"}
              </PfBtn>
            </PfCardHead>

            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 10 }}>
                What the percentage is taken from
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { name: "Basic salary", v: BASIC, inBase: true },
                  { name: "Housing allowance", v: HOUSING, inBase: true },
                  { name: "Transport allowance", v: TRANSPORT, inBase: true },
                  { name: "Data & telecoms allowance", v: DATA_ALLOWANCE, inBase: false },
                ].map((b) => {
                  const counted = b.inBase || pensionBase === "gross";
                  return (
                    <div key={b.name} style={{ display: "grid", gridTemplateColumns: "200px 1fr 118px 92px", gap: 12, alignItems: "center" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: counted ? "var(--pf-n900)" : "var(--pf-n300)" }}>{b.name}</span>
                      <span>
                        <div style={{ height: 9, borderRadius: 9, background: "var(--pf-n50)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pctOf(b.v, ANNUAL_CASH)}%`, background: counted ? "var(--pf-primary-500)" : "var(--pf-n100)", borderRadius: 9, transition: "background .25s ease" }} />
                        </div>
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: counted ? "var(--pf-n900)" : "var(--pf-n300)", textAlign: "right" }}>
                        {nairaExact(per(b.v, pensionPeriod))}
                      </span>
                      <span>
                        {counted
                          ? <PfBadge tone="green">In the base</PfBadge>
                          : <PfBadge tone="grey">Outside it</PfBadge>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 15, paddingTop: 14, borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <PfTh style={{ flex: 1, minWidth: 200 }}>The base the law defines, and the base people assume</PfTh>
                  <PfTabs
                    tabs={["The law's base", "If the data allowance counted"]}
                    active={pensionBase === "law" ? "The law's base" : "If the data allowance counted"}
                    onChange={(t) => setPensionBase(t === "The law's base" ? "law" : "gross")}
                  />
                </div>

                <Calc
                  tone={pensionBase === "law" ? "green" : "yellow"}
                  steps={[
                    { label: pensionBase === "law" ? "Basic + housing + transport" : "All four cash lines", value: nairaExact(per(pensionBaseValue, pensionPeriod)) },
                    { label: "Employer", value: `${EMPLOYER_PENSION_PCT}%`, op: "×" },
                  ]}
                  result={nairaExact(per(erShare, pensionPeriod))}
                  resultLabel="Into your RSA, from Unrealabs"
                />
                <div style={{ height: 9 }} />
                <Calc
                  tone="grey"
                  steps={[
                    { label: pensionBase === "law" ? "Basic + housing + transport" : "All four cash lines", value: nairaExact(per(pensionBaseValue, pensionPeriod)) },
                    { label: "You", value: `${EMPLOYEE_PENSION_PCT}%`, op: "×" },
                  ]}
                  result={nairaExact(per(eeShare, pensionPeriod))}
                  resultLabel="Into your RSA, out of your pay"
                />

                {pensionBase === "gross" && (
                  <div style={{ marginTop: 12 }}>
                    <PfBanner tone="yellow" icon="warning">
                      This is the version that is not true. The Pension Reform Act 2014 defines monthly emoluments as basic,
                      housing and transport &mdash; the data allowance sits outside it. If it counted, Unrealabs would pay{" "}
                      {nairaExact(GROSS_BASE_EMPLOYER - EMPLOYER_PENSION)} more a year and{" "}
                      {nairaExact(GROSS_BASE_EMPLOYEE - EMPLOYEE_PENSION)} more would come out of your pay.
                    </PfBanner>
                  </div>
                )}

                {openPart === "pension" && (
                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "13px 15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <PfTile icon="shield" tone="green" size={26} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>The employer 10% is on your statement</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                        {nairaExact(EMPLOYER_PENSION)} a year, paid on top of your salary rather than out of it. It is yours,
                        it sits in your own RSA, and it moves with you if you leave. That is why it counts as a reward.
                      </div>
                    </div>
                    <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <PfTile icon="arrowright" tone="grey" size={26} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Your 8% is not</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                        {nairaExact(EMPLOYEE_PENSION)} a year, deducted at source and remitted for you. It ends in the same
                        account, and it is still your own salary moving. A statement that counted it would be counting your
                        pay twice.
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 13, display: "flex", flexWrap: "wrap", gap: 9, alignItems: "center" }}>
                  <PfBadge tone="blue">{nairaExact(per(RSA_ANNUAL, pensionPeriod))} into your RSA {perLabel[pensionPeriod]} in total</PfBadge>
                  <PfBadge tone="grey">Your RSA PIN is on your record</PfBadge>
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="secondary" icon="chat" onClick={() => askAbout("RC-pension-er", "Please confirm the pensionable emoluments used for my employer pension contribution on this statement.")}>
                    Question the pension figures
                  </PfBtn>
                </div>

                <div style={{ marginTop: 12 }}>
                  <WhyFigure
                    claim={`${nairaExact(EMPLOYER_PENSION)} employer and ${nairaExact(EMPLOYEE_PENSION)} employee contributions a year, on a base of ${nairaExact(PENSIONABLE_EMOLUMENTS)}.`}
                    basis={[
                      `Base: basic ${nairaExact(BASIC)} + housing ${nairaExact(HOUSING)} + transport ${nairaExact(TRANSPORT)} = ${nairaExact(PENSIONABLE_EMOLUMENTS)}.`,
                      `The data allowance ${nairaExact(DATA_ALLOWANCE)} is excluded from that base by the statutory definition, which is why the base is not the same as your ${nairaExact(ANNUAL_CASH)} gross.`,
                      `${EMPLOYER_PENSION_PCT}% of the base = ${nairaExact(EMPLOYER_PENSION)}; ${EMPLOYEE_PENSION_PCT}% = ${nairaExact(EMPLOYEE_PENSION)}.`,
                      "Both are remitted to your Retirement Savings Account. This platform does not hold the fund, compute the remittance or see your balance.",
                    ]}
                    source={`Pension Reform Act 2014 · employment contract v2${PAYROLL_CARD ? ` · ${PAYROLL_CARD.title} (${PAYROLL_CARD.owner}, updated ${PAYROLL_CARD.updated})` : ""}.`}
                    gate="Your RSA statement from your pension administrator is the authority on your balance. This page only shows the contributions."
                  />
                </div>
              </div>
            </div>
          </PfCard>

          {/* ---------------------------------- PAYE -------------------------------- */}
          <PfCard>
            <PfCardHead
              title="PAYE — deducted before you see it, and not computed here"
              sub="The most common misreading of a page like this is treating the cash figure as take-home. It is not, and there is no take-home figure anywhere on this page."
            />
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                {[
                  { icon: "wallet", tone: "green" as PfTone, t: "What this page shows", b: `Gross annual cash of ${nairaExact(ANNUAL_CASH)} — the contractual figure, before anything is taken off.` },
                  { icon: "swap", tone: "yellow" as PfTone, t: "What comes off it", b: `PAYE, assessed on your income, and your ${EMPLOYEE_PENSION_PCT}% pension of ${nairaExact(EMPLOYEE_PENSION)}. Both are deducted at source and remitted for you.` },
                  { icon: "file", tone: "blue" as PfTone, t: "Where the real number is", b: "Your monthly payslip, issued by your payroll system on the 25th. That document carries the tax figure; this one deliberately does not." },
                ].map((x) => (
                  <div key={x.t} style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "14px 15px" }}>
                    <PfTile icon={x.icon} tone={x.tone} size={28} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>{x.t}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.6 }}>{x.b}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Why there is no tax number on this page</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>
                  A PAYE figure depends on reliefs, on your consolidated relief allowance, on your pension contribution and on
                  the month. This platform does not run payroll and does not hold those inputs, so any tax figure it printed
                  would be a guess wearing a decimal point. It is better to show you nothing than a number you might plan
                  around. Salaries are paid on the 25th; PAYE and pension are already deducted and remitted by then.
                </div>
                <div style={{ marginTop: 12 }}>
                  <WhyFigure
                    claim="This statement carries no tax figure and no take-home figure, by design."
                    basis={[
                      "The platform runs the claim, the record and the statement. It does not compute pay.",
                      "PAYE is assessed and remitted by the employer through the connected payroll source, on inputs this platform does not hold.",
                      `The only deduction named here is your ${EMPLOYEE_PENSION_PCT}% pension, ${nairaExact(EMPLOYEE_PENSION)}, because it is a fixed percentage of a base written on your contract.`,
                      "Every other deduction belongs on the payslip that your payroll system issues.",
                    ]}
                    source={PAYROLL_CARD ? `${PAYROLL_CARD.title} · ${PAYROLL_CARD.owner} · updated ${PAYROLL_CARD.updated}.` : "Handbook · Payroll, payslips & statutory deductions."}
                    gate="If your payslip and this statement disagree, the payslip is the record and People Ops is the route."
                  />
                </div>
              </div>
            </div>
          </PfCard>

          {/* ------------------------------- L&D pool ------------------------------- */}
          <PfCard>
            <PfCardHead
              title={`Learning & development — a ${naira(LND_POOL)} pool, and ${nairaExact(MY_ENTITLEMENT.yourDraw)} drawn`}
              sub="The only line on your statement worth nothing today, and the only one you can move this week."
            />
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.7 }}>
                    {MY_ENTITLEMENT.body} The company holds a {naira(LND_POOL)} pool for the year and you draw against it;
                    nothing comes out of your pocket, so there is never anything to expense afterwards. Your statement values
                    this line at what you have actually drawn &mdash; which is {nairaExact(MY_ENTITLEMENT.yourDraw)}, so it
                    contributes nothing to your {naira(R.totalNaira)}.
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Your draw against the pool</span>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>
                        {nairaExact(MY_ENTITLEMENT.yourDraw)} of {naira(LND_POOL)}
                      </span>
                    </div>
                    <PfProgress pct={pctOf(MY_ENTITLEMENT.yourDraw, LND_POOL)} tone="purple" height={8} />
                  </div>

                  <div style={{ marginTop: 15 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>Requests on your record</div>
                    {MY_LND_REQUESTS.map((r) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--pf-n50)" }}>
                        <PfTile icon="book" tone={r.state === "Approved" ? "green" : "yellow"} size={26} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.item}</span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{r.at}</span>
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{nairaExact(r.cost)}</span>
                        <PfBadge tone={r.state === "Approved" ? "green" : "yellow"} dot>{r.state}</PfBadge>
                      </div>
                    ))}
                    <div style={{ marginTop: 10 }}>
                      <Note icon="warning" tone="yellow">
                        Approved is not drawn. {MY_LND_REQUESTS.filter((r) => r.state === "Approved").length} request is
                        approved and the statement still values this line at {nairaExact(MY_ENTITLEMENT.yourDraw)}, because
                        the money leaves the pool when the course is booked and paid, not when the approval lands. That gap is
                        real and it is the honest reading of both records.
                      </Note>
                    </div>
                  </div>
                </div>

                <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "15px 16px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>What a draw would do to this statement</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>
                    Move the amount and watch the line, the non-cash subtotal and the split move with it.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 13 }}>
                    <PfBtn small variant="secondary" icon="x" onClick={() => setDrawAmt((v) => Math.max(0, v - 25_000))}>25k less</PfBtn>
                    <span style={{ flex: 1, textAlign: "center", fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>
                      {nairaExact(drawAmt)}
                    </span>
                    <PfBtn small variant="secondary" icon="plus" onClick={() => setDrawAmt((v) => Math.min(LND_POOL, v + 25_000))}>25k more</PfBtn>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
                    {MY_LND_REQUESTS.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setDrawAmt(r.cost)}
                        style={{
                          fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                          background: drawAmt === r.cost ? "var(--pf-purple-50)" : "var(--pf-n0)",
                          color: drawAmt === r.cost ? "var(--pf-purple-500)" : "var(--pf-n500)",
                          border: `1px solid ${drawAmt === r.cost ? "var(--pf-purple-100)" : "var(--pf-n50)"}`,
                          borderRadius: 999, padding: "5px 11px",
                        }}
                      >
                        {nairaExact(r.cost)}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>Approval needed</span>
                      <PfBadge tone={drawNeedsApproval ? "yellow" : "green"} dot>
                        {drawNeedsApproval ? `${first(MY_MANAGER.name)} approves` : "Under the threshold"}
                      </PfBadge>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>Non-cash would become</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{nairaExact(simNonCash)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>Total reward would become</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-primary-500)" }}>{nairaExact(simTotal)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>Cash share would fall to</span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{simCashPct.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div style={{ marginTop: 13, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <PfBtn small variant="primary" icon="book" onClick={() => go("mylearning")}>Go and draw it</PfBtn>
                    <PfBtn
                      small variant="ghost" icon="info"
                      onClick={() => toast(
                        drawNeedsApproval
                          ? `${nairaExact(drawAmt)} is over the ${nairaExact(APPROVAL_THRESHOLD)} threshold — ${MY_MANAGER.name} approves it`
                          : `${nairaExact(drawAmt)} is under the ${nairaExact(APPROVAL_THRESHOLD)} threshold — no approval step`,
                        "default",
                      )}
                    >
                      Check the threshold
                    </PfBtn>
                  </div>
                  <div style={{ marginTop: 11 }}>
                    <Note icon="info">
                      A simulation, not a request. Nothing here books anything and nothing here changes your statement.
                    </Note>
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* ------------------------------ leave value ----------------------------- */}
          <PfCard>
            <PfCardHead
              title="Leave value — shown, and never added"
              sub={`${LEAVE_DAYS_ENTITLED} days entitlement plus ${LEAVE_DAYS_CARRIED} carried, valued at your daily rate. Worth seeing; impossible to add without counting your salary twice.`}
            >
              <PfBtn small variant="ghost" icon={openPart === "leave" ? "caretdown" : "caretright"} onClick={() => setOpenPart((v) => (v === "leave" ? null : "leave"))}>
                {openPart === "leave" ? "Collapse" : "Expand"}
              </PfBtn>
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              <Calc
                tone="grey"
                steps={[
                  { label: "Annual cash", value: nairaExact(ANNUAL_CASH) },
                  { label: "Working days", value: String(WORKING_DAYS_PER_YEAR), op: "÷" },
                ]}
                result={nairaExact(LEAVE_DAY_VALUE)}
                resultLabel="Your daily rate"
              />
              <div style={{ height: 9 }} />
              <Calc
                tone="grey"
                steps={[
                  { label: "Daily rate", value: nairaExact(LEAVE_DAY_VALUE) },
                  { label: "Days", value: String(leaveDays), op: "×" },
                ]}
                result={nairaExact(simLeaveValue)}
                resultLabel="Value of the leave"
              />

              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Days</span>
                <PfBtn small variant="secondary" icon="x" onClick={() => setLeaveDays((v) => Math.max(0, v - 1))}>One fewer</PfBtn>
                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", minWidth: 34, textAlign: "center" }}>{leaveDays}</span>
                <PfBtn small variant="secondary" icon="plus" onClick={() => setLeaveDays((v) => Math.min(40, v + 1))}>One more</PfBtn>
                {leaveDays !== LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED && (
                  <PfBtn small variant="ghost" icon="swap" onClick={() => setLeaveDays(LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED)}>
                    Back to your {LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED}
                  </PfBtn>
                )}
                <span style={{ flex: 1 }} />
                <PfBadge tone="green" dot>Total reward stays {nairaExact(R.totalNaira)}</PfBadge>
              </div>

              <div style={{ marginTop: 14 }}>
                <PfBanner tone="green" icon="check">
                  Move the days as far as you like: the total above never changes. That is the whole point of the line. You are
                  paid your salary while you are on leave, so the money is already inside your base &mdash; the value is here to
                  tell you what the days are worth, not to make the statement bigger.
                </PfBanner>
              </div>

              {openPart === "leave" && (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Where {WORKING_DAYS_PER_YEAR} comes from</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                      Five working days a week across fifty-two weeks. Public holidays are not deducted from the divisor,
                      which makes the daily rate marginally conservative &mdash; deliberately, because a rate that flatters is
                      worse than one that is a little low.
                    </div>
                  </div>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>The {LEAVE_DAYS_CARRIED} carried days expire</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                      They roll into this year and lapse on 31 March. At {nairaExact(LEAVE_DAY_VALUE)} a day that is{" "}
                      {nairaExact(LEAVE_DAY_VALUE * LEAVE_DAYS_CARRIED)} of paid time you either take or lose. Nobody pays it
                      out.
                    </div>
                    <div style={{ marginTop: 11 }}>
                      <PfBtn small variant="secondary" icon="calendar" onClick={() => go("myleave")}>Plan the carried days</PfBtn>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 13 }}>
                <WhyFigure
                  claim={`${nairaExact(LEAVE_VALUE)} of paid leave, shown on your statement and excluded from the ${nairaExact(R.totalNaira)} total.`}
                  basis={[
                    `${nairaExact(ANNUAL_CASH)} annual cash ÷ ${WORKING_DAYS_PER_YEAR} working days = ${nairaExact(LEAVE_DAY_VALUE)} a day.`,
                    `${LEAVE_DAYS_ENTITLED} days entitlement + ${LEAVE_DAYS_CARRIED} carried = ${LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED} days.`,
                    `${LEAVE_DAYS_ENTITLED + LEAVE_DAYS_CARRIED} days × ${nairaExact(LEAVE_DAY_VALUE)} = ${nairaExact(LEAVE_VALUE)}.`,
                    "Not added: the salary paid during leave is already counted inside basic, housing and transport.",
                  ]}
                  source="Employment contract v2 · Handbook, Leave & time off (hb-leave)."
                  gate="The days themselves live on your leave page; this is only their value."
                />
              </div>
            </div>
          </PfCard>

          {/* --------------------------- cash vs non-cash --------------------------- */}
          <PfCard>
            <PfCardHead
              title="Cash and non-cash — what the difference actually means"
              sub="Non-cash is not a discount on your pay and it is not money you could take instead. It is what the benefit costs Unrealabs to give you."
            />
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 11, padding: "15px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <PfTile icon="wallet" tone="green" size={30} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Cash &mdash; {nairaExact(R.cashNaira)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 10 }}>
                  Paid to you monthly on the 25th. It appears on your payslip as gross, and PAYE and your pension come off
                  before it reaches your account. Four lines: basic, housing, transport and the data allowance.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
                  {CASH.map((c) => <PfBadge key={c.id} tone="green">{c.name}</PfBadge>)}
                </div>
              </div>
              <div style={{ background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", borderRadius: 11, padding: "15px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <PfTile icon="shield" tone="blue" size={30} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Non-cash &mdash; {nairaExact(R.nonCashNaira)}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 10 }}>
                  Paid to a pension administrator, an HMO and an insurer, on your behalf: {nairaExact(EMPLOYER_PENSION)} into
                  your RSA, {nairaExact(HMO_COVER)} for the family plan, {nairaExact(LIFE_PREMIUM)} for the life premium. You
                  cannot ask for any of it in cash and nobody will hand it to you. It is on the statement because it is
                  genuinely spent on you, and leaving it out would understate what you have.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 11 }}>
                  {NONCASH.map((c) => <PfBadge key={c.id} tone="blue">{c.name}</PfBadge>)}
                </div>
              </div>
            </div>
            <Foot icon="warning">
              This is the distinction that makes {naira(R.totalNaira)} unquotable as a salary. Roughly{" "}
              {nairaExact(R.nonCashNaira)} of it is an invoice paid to somebody else. Say {naira(ANNUAL_CASH)} when a person
              asks what you are paid, and keep {naira(R.totalNaira)} for the question of what the job is worth in total.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ================================= HISTORY ================================ */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ------------------------------ cash line ------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Your cash pay, walked forward"
              sub="Two changes moved it since 2025. Everything else on your statement moved around them."
            >
              <PfBadge tone={RECONCILES ? "green" : "red"} dot>
                {RECONCILES ? "Reconciles with the statement" : "Does not reconcile"}
              </PfBadge>
            </PfCardHead>

            <div style={{ padding: "18px 20px 8px" }}>
              <svg viewBox="0 0 560 150" width="100%" height="170" style={{ display: "block" }}>
                {[16_000_000, 18_000_000, 20_000_000, 22_000_000].map((v) => {
                  const y = 112 - ((v - 15_500_000) / 7_000_000) * 92;
                  return (
                    <g key={v}>
                      <line x1={64} y1={y} x2={548} y2={y} stroke="var(--pf-n50)" strokeWidth={1} />
                      <text x={58} y={y + 3.5} textAnchor="end" fontSize={9} fill="var(--pf-n300)">{naira(v)}</text>
                    </g>
                  );
                })}
                {(() => {
                  const yOf = (v: number) => 112 - ((v - 15_500_000) / 7_000_000) * 92;
                  const xs = [64, 236, 408, 548];
                  const d = [
                    `M${xs[0]},${yOf(CASH_STEPS[0].value)}`,
                    `H${xs[1]}`, `V${yOf(CASH_STEPS[1].value)}`,
                    `H${xs[2]}`, `V${yOf(CASH_STEPS[2].value)}`,
                    `H${xs[3]}`,
                  ].join(" ");
                  return (
                    <>
                      <path d={d} fill="none" stroke="var(--pf-primary-500)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                      {CASH_STEPS.map((s, i) => (
                        <g key={s.at}>
                          <circle cx={xs[i]} cy={yOf(s.value)} r={4.5} fill="var(--pf-n0)" stroke="var(--pf-primary-500)" strokeWidth={2.4} />
                          <text x={xs[i] + (i === 0 ? 2 : 6)} y={yOf(s.value) - 11} fontSize={10.5} fontWeight={700} fill="var(--pf-n900)">{naira(s.value)}</text>
                          <text x={xs[i] + (i === 0 ? 2 : 6)} y={131} fontSize={9.5} fill="var(--pf-n400)">{s.at}</text>
                        </g>
                      ))}
                      <text x={548} y={yOf(CASH_STEPS[2].value) - 11} textAnchor="end" fontSize={9.5} fill="var(--pf-n300)">today</text>
                    </>
                  );
                })()}
              </svg>
            </div>

            <div style={{ padding: "6px 20px 16px" }}>
              <Calc
                tone={RECONCILES ? "green" : "red"}
                steps={[
                  { label: "L4 cash", value: naira(CASH_STEPS[0].value) },
                  { label: "L5 promotion", value: `+${naira(CASH_STEPS[1].value - CASH_STEPS[0].value)}` },
                  { label: "Data uplift", value: `+${nairaExact(UPLIFT_DELTA)}` },
                ]}
                result={nairaExact(ANNUAL_CASH)}
                resultLabel="Cash on your statement"
              />
              <div style={{ marginTop: 13 }}>
                <Note icon={RECONCILES ? "check" : "warning"} tone={RECONCILES ? "green" : "red"}>
                  {RECONCILES
                    ? `The history walks exactly onto the ${nairaExact(ANNUAL_CASH)} cash figure on your statement. If it ever stopped doing so, the two pages would be telling you different things about the same money, and this badge would say so.`
                    : "The history does not walk onto the statement figure. Do not rely on either until People Ops has looked at it."}
                </Note>
              </div>
            </div>

            <Foot icon="info">
              In the last twelve months your cash pay moved once, by {nairaExact(RECENT_CASH_DELTA)} &mdash;{" "}
              {pct1(RECENT_CASH_DELTA, CASH_STEPS[1].value)} of it, on the data allowance. Basic, housing and transport have
              not changed since the May 2025 promotion. That is a plain fact about your record and this page is not going to
              dress it up.
            </Foot>
          </PfCard>

          {/* ------------------------------- the entries ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="Every change on your record"
              sub={`${changes.length} of ${MY_REWARD_HISTORY.length} shown · ${RECENT.length} inside the last twelve months, with the promotion pinned because it is the largest change you have`}
            >
              <PfTabs
                tabs={["All", "Last 12 months", "Cash", "Non-cash"]}
                active={histFilter === "all" ? "All" : histFilter === "12m" ? "Last 12 months" : histFilter === "cash" ? "Cash" : "Non-cash"}
                onChange={(t) => setHistFilter(t === "All" ? "all" : t === "Last 12 months" ? "12m" : t === "Cash" ? "cash" : "non-cash")}
              />
            </PfCardHead>

            {changes.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center" }}>
                <PfTile icon="clock" tone="grey" size={34} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>Nothing under that filter</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>
                  Your record holds {MY_REWARD_HISTORY.length} changes in total. Try &ldquo;All&rdquo;.
                </div>
              </div>
            ) : (
              changes.map((c, i) => {
                const open = openChange === c.id;
                const tone = changeTone(c);
                const delta = c.fromNaira !== undefined && c.toNaira !== undefined ? c.toNaira - c.fromNaira : undefined;
                const deltaPct = c.fromNaira ? ((c.toNaira ?? 0) - c.fromNaira) / c.fromNaira * 100 : undefined;
                return (
                  <div key={c.id} style={{ borderTop: "1px solid var(--pf-n50)" }}>
                    <button
                      onClick={() => setOpenChange((v) => (v === c.id ? null : c.id))}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
                        fontFamily: "inherit", background: open ? "var(--pf-n25)" : "var(--pf-n0)",
                        border: "none", padding: "14px 20px", cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                        <PfTile icon={changeIcon(c)} tone={tone} size={30} />
                        {i < changes.length - 1 && <span style={{ width: 1.5, flex: 1, minHeight: 14, background: "var(--pf-n50)", marginTop: 5 }} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.title}</span>
                          <PfBadge tone={c.kind === "cash" ? "green" : "blue"}>{c.kind === "cash" ? "Cash" : "Non-cash"}</PfBadge>
                          {!c.withinLast12Months && <PfBadge tone="purple">Pinned · outside 12 months</PfBadge>}
                        </span>
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>
                          Effective {c.effective} · measures {measuresOf(c)}
                        </span>
                      </span>
                      <span style={{ textAlign: "right", flex: "none" }}>
                        {c.fromNaira !== undefined && c.toNaira !== undefined ? (
                          <>
                            <span style={{ display: "block", fontSize: 12, color: "var(--pf-n300)", textDecoration: "line-through" }}>{naira(c.fromNaira)}</span>
                            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--pf-n900)" }}>{naira(c.toNaira)}</span>
                          </>
                        ) : c.toNaira !== undefined ? (
                          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--pf-n900)" }}>{naira(c.toNaira)}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--pf-n300)" }}>no figure</span>
                        )}
                      </span>
                      <span style={{ flex: "none", width: 78, textAlign: "right" }}>
                        {deltaPct !== undefined && (
                          <PfBadge tone={deltaPct > 0 ? "green" : "grey"}>{deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%</PfBadge>
                        )}
                      </span>
                      <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
                    </button>

                    {open && (
                      <div style={{ padding: "0 20px 16px 62px", background: "var(--pf-n25)" }}>
                        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                          <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>{c.detail}</div>

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
                            {delta !== undefined && <PfBadge tone={tone}>{delta > 0 ? "+" : ""}{nairaExact(delta)}</PfBadge>}
                            <PfBadge tone="grey">Effective {c.effective}</PfBadge>
                            {c.document && <PfBadge tone="blue"><Ic name="file" size={11} /> {c.document}</PfBadge>}
                            <span style={{ flex: 1 }} />
                            {c.document && (
                              <PfBtn small variant="secondary" icon="file" onClick={() => { toast(`${CONTRACT_DOC?.name ?? c.document} — opening from your documents`, "default"); go("myprofile"); }}>
                                Open the document
                              </PfBtn>
                            )}
                            <PfBtn small variant="ghost" icon="chat" onClick={() => askAbout(c.kind === "cash" ? "RC-data" : "RC-hmo", `About the change effective ${c.effective} — ${c.title}. I would like to understand how it was applied to my statement.`)}>
                              Ask about this
                            </PfBtn>
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <WhyFigure
                              claim={`${c.title}, effective ${c.effective}.`}
                              basis={[
                                `This row measures ${measuresOf(c)}.`,
                                c.fromNaira !== undefined && c.toNaira !== undefined
                                  ? `From ${nairaExact(c.fromNaira)} to ${nairaExact(c.toNaira)} — a change of ${nairaExact((c.toNaira ?? 0) - c.fromNaira)}.`
                                  : c.toNaira !== undefined
                                    ? `Restated at ${nairaExact(c.toNaira)}. There is no prior figure on the record to compare it with.`
                                    : "No figure attached — this row records a confirmation, not an amount.",
                                c.withinLast12Months
                                  ? "Inside the twelve-month window this page reports on."
                                  : "Outside the twelve-month window, and pinned anyway because it is the largest change on your record.",
                                "Shown because it has happened. A pay decision under discussion is not a reward change and does not appear here until it is one.",
                              ]}
                              source={c.document ?? "Company-wide change applied to your record by People Ops."}
                              gate="Nothing on this timeline is a forecast. Every row already happened."
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            <Foot icon="info">
              These are the changes you are entitled to see, which is a narrower set than the changes that exist. A pay
              decision still under discussion is not a reward change and stays off this list until it becomes one &mdash; at
              which point it appears here as a change, with its date and its document.
            </Foot>
          </PfCard>

          {/* -------------------------- what this cannot show ----------------------- */}
          <PfCard>
            <PfCardHead
              title="What a change history cannot tell you"
              sub="The obvious next question after a timeline is whether the number is any good. This page will not answer it, and it is better to say so than to imply the silence means nothing."
            />
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "14px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PfTile icon="x" tone="grey" size={27} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Not here: where you sit against the market</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 9 }}>
                  {REWARDS_EXCLUSIONS[0].why}
                </div>
                <div style={{ marginTop: 10 }}>
                  <PfBadge tone="grey">Lives in: {REWARDS_EXCLUSIONS[0].livesIn}</PfBadge>
                </div>
              </div>
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "14px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PfTile icon="x" tone="grey" size={27} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Not here: what happens next year</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 9 }}>
                  {REWARDS_EXCLUSIONS[4].why}
                </div>
                <div style={{ marginTop: 10 }}>
                  <PfBadge tone="grey">Lives in: {REWARDS_EXCLUSIONS[4].livesIn}</PfBadge>
                </div>
              </div>
            </div>
            <div style={{ padding: "0 20px 16px", display: "flex", gap: 9, flexWrap: "wrap" }}>
              <PfBtn variant="secondary" icon="arrowright" onClick={() => { setTab("statement"); setOpenExcl(REWARDS_EXCLUSIONS[0].item); }}>
                See all {REWARDS_EXCLUSIONS.length} exclusions
              </PfBtn>
              <PfBtn variant="secondary" icon="chat" onClick={() => askAbout("RC-basic", `I would like to talk about my pay. My last change to basic pay was ${PROMO?.effective ?? "May 1, 2025"}.`)}>
                Raise a pay conversation
              </PfBtn>
              <PfBtn variant="ghost" icon="clipboard" onClick={() => go("myreview")}>My review</PfBtn>
            </div>
            <Foot icon="shield">
              {ME_FIRST}, the honest version is this: a reward statement is very good at telling you what you have and
              structurally incapable of telling you whether it is enough. The second question is a conversation with{" "}
              {MY_MANAGER.name} and People Ops, and this page exists to make sure you walk into it holding the real numbers.
            </Foot>
          </PfCard>
        </div>
      )}
    </div>
  );
}
