"use client";
import { useEffect, useRef, useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfAvatar, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { ATTRITION_TREND, DEPARTMENTS, EMPLOYEES, EXIT_REASONS, NCDMB, REVIEW_CYCLE } from "@/data/talentos";

/**
 * Ask Anything (NLQ) — FR-059. Plain-language questions over workforce data,
 * answered as charts with benchmark context. Every answer states its data scope
 * (semantic layer + row-level security), refines conversationally, and exports.
 */

/* --------------------------------- Types --------------------------------- */

type RefineKey = "vol" | "12mo" | "bydept";

type BarsData = {
  kind: "bars"; yMax: number; unit: string; pre?: string;
  bench?: { v: number; label: string; anchor?: "start" | "end" };
  bars: { label: string; v: number; tone: string }[];
};
type LineData = {
  kind: "line"; unit: string; pre?: string;
  bench?: { v: number; label: string };
  pts: { m: string; v: number }[];
};
type ListData = {
  kind: "list";
  rows: { init: string; tone: string; name: string; role: string; badge: string; badgeTone: PfTone; note: string; go: string }[];
};
type Chart = BarsData | LineData | ListData;

type AnswerDef = {
  title: string; interp: string; conf: "High" | "Medium";
  chart: Chart; insight: string; scope: string;
  refines: { label: string; key: RefineKey }[];
  drill: string; drillLabel: string; exportBase: string;
};
type Answer = AnswerDef & { id: string };
type ThreadItem = { kind: "q"; text: string } | { kind: "a"; a: Answer };

/* ------------------------------ Chart tokens ------------------------------ */

const C = {
  green: "var(--pf-primary-500)", blue: "var(--pf-blue-500)", red: "var(--pf-red-500)",
  yellow: "var(--pf-yellow-500)", purple: "var(--pf-purple-500)", grey: "var(--pf-n400)",
};

const SHORT_DEPT: Record<string, string> = {
  Engineering: "Eng", "Field Operations": "Field Ops", "Product & Design": "Product",
  Commercial: "Comm", "HSE & Compliance": "HSE", Finance: "Finance", "People / HR": "People", "Drilling Support": "Drilling",
};

const tvTone = (v: number) => (v >= 2.5 ? C.red : v > 1.6 ? C.yellow : C.green);

/* ------------------------- Canned answers (governed) ------------------------- */
/* Numbers are lifted from the shared dataset so every surface tells one story. */

const A_LOC: AnswerDef = {
  title: "Attrition by location", interp: "Interpreted: monthly attrition rate by work location · June 2026", conf: "High",
  chart: {
    kind: "bars", yMax: 4, unit: "%",
    bench: { v: 1.6, label: "Nigeria benchmark 1.6%" },
    bars: [
      { label: "Port Harcourt", v: 3.8, tone: C.red },
      { label: "Lagos", v: 1.4, tone: C.green },
      { label: "Abuja", v: 1.1, tone: C.green },
    ],
  },
  insight: "Port Harcourt runs 2.4× the Nigerian benchmark — driven by Field Operations (3.8%) and Drilling Support (2.6%).",
  scope: "358 active employees · Jun 2026 · voluntary + involuntary · your row-level access ✓",
  refines: [{ label: "Voluntary only", key: "vol" }, { label: "Last 12 months", key: "12mo" }, { label: "By department", key: "bydept" }],
  drill: "attrition", drillLabel: "Drill through", exportBase: "attrition-by-location",
};

const A_VOL: AnswerDef = {
  title: "Attrition by location — voluntary only", interp: "Refined: voluntary exits only · excludes involuntary & contract-end", conf: "High",
  chart: {
    kind: "bars", yMax: 4, unit: "%",
    bench: { v: 1.6, label: "Nigeria benchmark 1.6%" },
    bars: [
      { label: "Port Harcourt", v: 3.1, tone: C.red },
      { label: "Lagos", v: 1.1, tone: C.green },
      { label: "Abuja", v: 0.8, tone: C.green },
    ],
  },
  insight: "Voluntary exits alone keep Port Harcourt at 1.9× benchmark — 5 of 6 cite pay vs market in structured exit interviews.",
  scope: "358 active employees · Jun 2026 · voluntary only · your row-level access ✓",
  refines: [{ label: "Last 12 months", key: "12mo" }, { label: "By department", key: "bydept" }],
  drill: "attrition", drillLabel: "Drill through", exportBase: "attrition-voluntary",
};

const A_12MO: AnswerDef = {
  title: "Attrition trend — last 12 months", interp: "Monthly attrition vs 1.6% benchmark · Jul 2025 – Jun 2026", conf: "High",
  chart: {
    kind: "line", unit: "%",
    bench: { v: 1.6, label: "Benchmark 1.6%" },
    pts: [
      { m: "Jul", v: 1.5 }, { m: "Aug", v: 1.6 }, { m: "Sep", v: 1.4 },
      { m: "Oct", v: 1.5 }, { m: "Nov", v: 1.4 }, { m: "Dec", v: 1.2 },
      ...ATTRITION_TREND.map((t) => ({ m: t.m, v: t.val })),
    ],
  },
  insight: "Attrition crossed the benchmark in April and has climbed three straight months — the rise is concentrated in Port Harcourt.",
  scope: "358 active employees · Jul 2025 – Jun 2026 · voluntary + involuntary · your row-level access ✓",
  refines: [{ label: "Voluntary only", key: "vol" }, { label: "By department", key: "bydept" }],
  drill: "attrition", drillLabel: "Drill through", exportBase: "attrition-trend-12mo",
};

const A_BYDEPT: AnswerDef = {
  title: "Attrition by department", interp: "Monthly attrition rate by department · top 6 · June 2026", conf: "High",
  chart: {
    kind: "bars", yMax: 4, unit: "%",
    bench: { v: 1.6, label: "Nigeria benchmark 1.6%" },
    bars: DEPARTMENTS
      .map((d) => ({ label: SHORT_DEPT[d.name] ?? d.name, v: parseFloat(d.turnover), tone: tvTone(parseFloat(d.turnover)) }))
      .sort((a, b) => b.v - a.v).slice(0, 6),
  },
  insight: "Two Port Harcourt departments sit above benchmark — Field Operations (3.8%) and Drilling Support (2.6%) account for 7 of 9 June exits.",
  scope: "358 active employees · Jun 2026 · by department · your row-level access ✓",
  refines: [{ label: "Voluntary only", key: "vol" }, { label: "Last 12 months", key: "12mo" }],
  drill: "depthealth", drillLabel: "Drill through", exportBase: "attrition-by-department",
};

const A_HCPLAN: AnswerDef = {
  title: "Headcount vs plan by department", interp: "Actual headcount as % of planned seats · June 2026", conf: "High",
  chart: {
    kind: "bars", yMax: 160, unit: "%",
    bench: { v: 100, label: "Plan = 100%", anchor: "start" },
    bars: DEPARTMENTS
      .map((d) => {
        const pct = Math.round((d.headcount / d.target) * 100);
        return { label: SHORT_DEPT[d.name] ?? d.name, v: pct, tone: pct > 110 ? C.red : pct > 100 ? C.yellow : pct === 100 ? C.green : C.blue };
      })
      .sort((a, b) => b.v - a.v),
  },
  insight: "Drilling Support runs 21% over plan while Engineering sits 8 seats under — net position is 358 filled of 362 planned.",
  scope: "8 departments · 358 active employees · Jun 2026 · your row-level access ✓",
  refines: [], drill: "headcount", drillLabel: "Open Headcount plan", exportBase: "headcount-vs-plan",
};

const amara = EMPLOYEES.find((e) => e.id === "E-0214");
const A_RISK: AnswerDef = {
  title: "Attrition risk — Engineering", interp: "Employees with an active leave-risk flag · 90-day model v2.1", conf: "Medium",
  chart: {
    kind: "list",
    rows: [
      {
        init: amara?.init ?? "AO", tone: amara?.tone ?? "#AF52DE", name: amara?.name ?? "Amara Okonkwo",
        role: amara?.role ?? "Senior Software Engineer", badge: `High · ${amara?.risk?.score ?? 78} · 30d`, badgeTone: "red",
        note: (amara?.risk?.reasons ?? []).slice(0, 2).join(" · "), go: "employee",
      },
      {
        init: "KU", tone: "#16B364", name: "Kelechi Umeh", role: "Backend Engineer · Fixed-term",
        badge: "Medium · 54 · 60d", badgeTone: "yellow", note: "Contract ends Sep 30, 2026 · no renewal decision yet", go: "contracts",
      },
    ],
  },
  insight: "Amara Okonkwo is the retention priority — playbook PB-31 is already running with a 72% save estimate.",
  scope: "84 Engineering employees · 90-day risk model v2.1 · your row-level access ✓",
  refines: [], drill: "retention", drillLabel: "Open Retention studio", exportBase: "engineering-risk",
};

const A_CPH: AnswerDef = {
  title: "Cost per hire trend", interp: "Fully-loaded cost per hire (₦M) · Jan – Jun 2026", conf: "High",
  chart: {
    kind: "line", unit: "M", pre: "₦",
    bench: { v: 1.8, label: "Market median ₦1.8M" },
    pts: [{ m: "Jan", v: 2.1 }, { m: "Feb", v: 1.9 }, { m: "Mar", v: 1.8 }, { m: "Apr", v: 1.6 }, { m: "May", v: 1.5 }, { m: "Jun", v: 1.4 }],
  },
  insight: "Cost per hire is down 33% since January — agency spend replaced by warm-pool sourcing (61% of Q2 hires).",
  scope: "23 hires closed · Jan – Jun 2026 · agency + ads + referral costs · your row-level access ✓",
  refines: [], drill: "talentlibrary", drillLabel: "Open Talent library", exportBase: "cost-per-hire-trend",
};

const A_REVIEWS: AnswerDef = {
  title: "Review completion by team", interp: "Q2 2026 mid-year cycle · % of reviews submitted", conf: "High",
  chart: {
    kind: "bars", yMax: 100, unit: "%",
    bench: { v: REVIEW_CYCLE.completion, label: `Company avg ${REVIEW_CYCLE.completion}%` },
    bars: [
      { label: "Product", v: 88, tone: C.green }, { label: "HSE", v: 79, tone: C.green },
      { label: "Eng", v: 72, tone: C.yellow }, { label: "Comm", v: 66, tone: C.yellow },
      { label: "Finance", v: 61, tone: C.yellow }, { label: "Field Ops", v: 54, tone: C.red },
    ],
  },
  insight: `Field Operations trails at 54% with the cycle closing ${REVIEW_CYCLE.closes} — nudges are queued for both site leads.`,
  scope: "358 employees in cycle · Q2 2026 · self + manager reviews · your row-level access ✓",
  refines: [], drill: "reviews", drillLabel: "Open Review cycles", exportBase: "review-completion",
};

const A_NCDMB: AnswerDef = {
  title: "NCDMB Nigerian-content ratio", interp: "Nigerian staff share by job family · Q3 2026 filing basis", conf: "High",
  chart: {
    kind: "bars", yMax: 100, unit: "%",
    bench: { v: NCDMB.target, label: `NCDMB target ${NCDMB.target}%` },
    bars: [...NCDMB.byFamily]
      .map((f) => ({ label: f.fam === "Drilling & subsurface" ? "Drilling" : f.fam === "Field operations" ? "Field Ops" : f.fam, v: f.ng, tone: f.ng >= NCDMB.target ? C.green : f.ng >= 82 ? C.yellow : C.red }))
      .sort((a, b) => b.v - a.v),
  },
  insight: `Company-wide ratio is ${NCDMB.ratio.ng}% vs the ${NCDMB.target}% target, but Management (78%) drags the filing — quarterly report due Jul 15.`,
  scope: "358 active employees · Q3 2026 quarter-to-date · NCDMB category mapping v3 · your row-level access ✓",
  refines: [], drill: "compliance", drillLabel: "Open Compliance", exportBase: "ncdmb-ratio",
};

const A_EXITS: AnswerDef = {
  title: "Exits by reason — Q2 2026", interp: "Structured exit-interview coding · share of exits", conf: "High",
  chart: {
    kind: "bars", yMax: 40, unit: "%",
    bars: EXIT_REASONS.map((r, i) => ({ label: r.reason.length > 14 ? r.reason.slice(0, 13) + "…" : r.reason, v: r.pct, tone: [C.red, C.yellow, C.blue, C.purple, C.grey][i] ?? C.grey })),
  },
  insight: "Pay vs market drives 38% of exits — the L5 band adjustment case covers the top three flight-risk names.",
  scope: "21 exits · Apr – Jun 2026 · structured exit interviews · your row-level access ✓",
  refines: [], drill: "offboarding", drillLabel: "Open Offboarding", exportBase: "exits-by-reason",
};

/** Fallback for any free-typed question — the generic headcount-trend answer. */
const genericAnswer = (q: string): AnswerDef => ({
  title: "Headcount trend", interp: `Parsed “${q}” → closest governed metric: monthly active headcount`, conf: "Medium",
  chart: {
    kind: "line", unit: "",
    bench: { v: 362, label: "Plan 362" },
    pts: [{ m: "Jan", v: 328 }, { m: "Feb", v: 334 }, { m: "Mar", v: 339 }, { m: "Apr", v: 346 }, { m: "May", v: 350 }, { m: "Jun", v: 358 }],
  },
  insight: "Headcount is +30 YTD and 4 seats under the 362 plan — 8 joined this month across Engineering and Field Operations.",
  scope: "358 active employees · Jan – Jun 2026 · permanent + contract · your row-level access ✓",
  refines: [], drill: "headcount", drillLabel: "Open Headcount plan", exportBase: "headcount-trend",
});

/** Route a plain-language question to a governed answer. */
function matchAnswer(q: string): { def: AnswerDef; key?: RefineKey } {
  const s = q.toLowerCase();
  if (s.includes("cost per hire")) return { def: A_CPH };
  if (s.includes("ncdmb") || s.includes("nigerian content")) return { def: A_NCDMB };
  if (s.includes("review")) return { def: A_REVIEWS };
  if (s.includes("risk")) return { def: A_RISK };
  if (s.includes("exit") || s.includes("reason")) return { def: A_EXITS };
  if (s.includes("attrition") || s.includes("turnover") || s.includes("voluntary")) {
    if (s.includes("voluntary")) return { def: A_VOL, key: "vol" };
    if (s.includes("12 month") || s.includes("last 12") || s.includes("trend") || s.includes("rising")) return { def: A_12MO, key: "12mo" };
    if (s.includes("department")) return { def: A_BYDEPT, key: "bydept" };
    return { def: A_LOC };
  }
  if (s.includes("headcount") && (s.includes("plan") || s.includes("department"))) return { def: A_HCPLAN };
  return { def: genericAnswer(q) };
}

const REFINE_DEFS: Record<RefineKey, { q: string; def: AnswerDef }> = {
  vol: { q: "Voluntary exits only", def: A_VOL },
  "12mo": { q: "Show the last 12 months", def: A_12MO },
  bydept: { q: "Break it down by department", def: A_BYDEPT },
};

const SUGGESTIONS = [
  "Which location has the highest attrition?",
  "Headcount vs plan by department",
  "Who's at risk in Engineering?",
  "Cost per hire trend",
  "Review completion by team",
  "NCDMB ratio this quarter",
];

const EXPORTS: { label: string; sub: string; icon: string; msg: (base: string) => string }[] = [
  { label: "PNG image", sub: "Chart snapshot", icon: "download", msg: (b) => `${b}.png exported — ready for Monday's meeting` },
  { label: "CSV data", sub: "Underlying rows", icon: "file", msg: (b) => `${b}.csv exported — governed extract, scope preserved` },
  { label: "Slide (16:9)", sub: "Adds to exec deck", icon: "arrowsq", msg: () => "Slide added to “Monday exec review” deck" },
];

const SAVED = [
  { icon: "trend", tone: "green" as PfTone, title: "Attrition by location — Jun", meta: "Pinned to Command Center · refreshes daily" },
  { icon: "shield", tone: "blue" as PfTone, title: "NCDMB ratio vs 90% target", meta: "Pinned to Compliance · refreshes weekly" },
];

const RECENT = [
  "Why is Port Harcourt turnover rising?",
  "Which departments are over cost budget?",
  "Exits by reason this quarter",
];

const PIPELINE = ["Question", "Semantic layer", "Governed SQL", "Chart"];

/* ------------------------------ SVG charts ------------------------------ */

function BarsChart({ c }: { c: BarsData }) {
  const W = 720, H = 232, padL = 38, padR = 12, padT = 24, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const y = (v: number) => padT + plotH * (1 - v / c.yMax);
  const band = plotW / c.bars.length;
  const barW = Math.min(58, band * 0.45);
  const fmt = (v: number) => (c.yMax >= 20 ? String(Math.round(v)) : v.toFixed(1));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[1, 2, 3, 4].map((i) => {
        const v = (c.yMax * i) / 4;
        return (
          <g key={i}>
            <line x1={padL} x2={padL + plotW} y1={y(v)} y2={y(v)} style={{ stroke: "var(--pf-n50)", strokeWidth: 1 }} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" style={{ fill: "var(--pf-n300)", fontSize: 10 }}>{fmt(v)}</text>
          </g>
        );
      })}
      <line x1={padL} x2={padL + plotW} y1={y(0)} y2={y(0)} style={{ stroke: "var(--pf-n100)", strokeWidth: 1 }} />
      {c.bars.map((b, i) => {
        const cx = padL + band * i + band / 2;
        return (
          <g key={b.label}>
            <rect x={cx - barW / 2} y={y(b.v)} width={barW} height={Math.max(2, y(0) - y(b.v))} rx={5} style={{ fill: b.tone }} />
            <text x={cx} y={y(b.v) - 7} textAnchor="middle" style={{ fill: "var(--pf-n900)", fontSize: 12, fontWeight: 600 }}>
              {(c.pre ?? "") + b.v + c.unit}
            </text>
            <text x={cx} y={H - 8} textAnchor="middle" style={{ fill: "var(--pf-n400)", fontSize: 11 }}>{b.label}</text>
          </g>
        );
      })}
      {c.bench && (
        <g>
          <line x1={padL} x2={padL + plotW} y1={y(c.bench.v)} y2={y(c.bench.v)} style={{ stroke: "var(--pf-blue-500)", strokeWidth: 1.5, strokeDasharray: "5 4" }} />
          <text
            x={c.bench.anchor === "start" ? padL + 4 : padL + plotW}
            y={y(c.bench.v) - 6}
            textAnchor={c.bench.anchor === "start" ? "start" : "end"}
            style={{ fill: "var(--pf-blue-500)", fontSize: 10.5, fontWeight: 600 }}
          >
            {c.bench.label}
          </text>
        </g>
      )}
    </svg>
  );
}

function LineChart({ c }: { c: LineData }) {
  const W = 720, H = 232, padL = 42, padR = 16, padT = 22, padB = 26;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const vals = [...c.pts.map((p) => p.v), ...(c.bench ? [c.bench.v] : [])];
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const span = hi0 - lo0 || 1;
  const lo = lo0 - span * 0.35, hi = hi0 + span * 0.28;
  const x = (i: number) => padL + (plotW * i) / (c.pts.length - 1);
  const y = (v: number) => padT + plotH * (1 - (v - lo) / (hi - lo));
  const fmt = (v: number) => (hi - lo >= 8 ? String(Math.round(v)) : v.toFixed(1));
  const line = c.pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ");
  const area = `${padL},${padT + plotH} ${line} ${padL + plotW},${padT + plotH}`;
  const last = c.pts[c.pts.length - 1];
  const showEvery = c.pts.length > 8 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {[1, 2, 3, 4].map((i) => {
        const v = lo + ((hi - lo) * i) / 4;
        return (
          <g key={i}>
            <line x1={padL} x2={padL + plotW} y1={y(v)} y2={y(v)} style={{ stroke: "var(--pf-n50)", strokeWidth: 1 }} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" style={{ fill: "var(--pf-n300)", fontSize: 10 }}>{fmt(v)}</text>
          </g>
        );
      })}
      <polygon points={area} style={{ fill: "rgba(22,179,100,.07)" }} />
      {c.bench && (
        <g>
          <line x1={padL} x2={padL + plotW} y1={y(c.bench.v)} y2={y(c.bench.v)} style={{ stroke: "var(--pf-blue-500)", strokeWidth: 1.5, strokeDasharray: "5 4" }} />
          <text x={padL + 4} y={y(c.bench.v) - 6} style={{ fill: "var(--pf-blue-500)", fontSize: 10.5, fontWeight: 600 }}>{c.bench.label}</text>
        </g>
      )}
      <polyline points={line} style={{ fill: "none", stroke: "var(--pf-primary-500)", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }} />
      {c.pts.map((p, i) => (
        <g key={p.m + i}>
          <circle cx={x(i)} cy={y(p.v)} r={i === c.pts.length - 1 ? 3.6 : 2.6} style={{ fill: "#fff", stroke: "var(--pf-primary-500)", strokeWidth: 1.6 }} />
          {i % showEvery === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" style={{ fill: "var(--pf-n400)", fontSize: 11 }}>{p.m}</text>}
        </g>
      ))}
      {last && (
        <text x={x(c.pts.length - 1) + 2} y={y(last.v) - 10} textAnchor="end" style={{ fill: "var(--pf-n900)", fontSize: 12, fontWeight: 600 }}>
          {(c.pre ?? "") + last.v + c.unit}
        </text>
      )}
    </svg>
  );
}

function RiskRow({ r, onOpen, last }: { r: ListData["rows"][number]; onOpen: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 6px", cursor: "pointer", borderRadius: 8, background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <PfAvatar init={r.init} tone={r.tone} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{r.role}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 2 }}>{r.note}</div>
      </div>
      <PfBadge tone={r.badgeTone} dot>{r.badge}</PfBadge>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </div>
  );
}

/* ------------------------------- Small bits ------------------------------- */

function SuggestChip({ q, onClick }: { q: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: hovered ? "var(--pf-n900)" : "var(--pf-n500)", background: "var(--pf-n0)", border: `1px solid ${hovered ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, borderRadius: 99, padding: "7px 13px", cursor: "pointer", boxShadow: "0 0 0 0.5px rgba(42,42,42,.04)" }}
    >
      <Ic name="sparkle" size={13} color="var(--pf-primary-500)" />
      {q}
    </button>
  );
}

function RefineChip({ label, used, onClick }: { label: string; used: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 12, fontWeight: 500, color: used ? "var(--pf-n300)" : hovered ? "var(--pf-n900)" : "var(--pf-n600)", background: used ? "var(--pf-n25)" : "var(--pf-n0)", border: `1px solid ${!used && hovered ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, borderRadius: 99, padding: "4px 11px", cursor: "pointer" }}
    >
      {used && <Ic name="check" size={12} color="var(--pf-primary-500)" />}
      {label}
    </button>
  );
}

function MicBtn({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title="Voice input"
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 9, border: "none", background: hovered ? "var(--pf-n25)" : "transparent", cursor: "pointer", flex: "none" }}
    >
      <Ic name="mic" size={17} color={hovered ? "var(--pf-n600)" : "var(--pf-n400)"} />
    </button>
  );
}

function MenuRow({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent" }}>
      <Ic name={icon} size={15} color="var(--pf-n500)" />
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{sub}</div>
      </div>
    </div>
  );
}

function RailRow({ icon, tone, title, meta, onClick, last }: { icon: string; tone: PfTone; title: string; meta: string; onClick: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <PfTile icon={icon} tone={tone} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>
      </div>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </div>
  );
}

function AskInput({ value, onChange, onSubmit, onMic, big, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; onMic: () => void;
  big?: boolean; placeholder: string; autoFocus?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--pf-n0)", border: `1px solid ${focused ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, borderRadius: big ? 14 : 12, padding: big ? "9px 9px 9px 16px" : "7px 7px 7px 13px", boxShadow: focused ? "0 0 0 3px rgba(22,179,100,.1)" : "0 1px 3px 0 #f3f3f3", transition: "border-color .15s ease, box-shadow .15s ease" }}>
      <Ic name="sparkle" size={big ? 18 : 15} color="var(--pf-primary-500)" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: big ? 14.5 : 13.5, color: "var(--pf-n900)", padding: "6px 2px" }}
      />
      <MicBtn onClick={onMic} />
      <PfBtn variant="primary" icon="arrowup" onClick={onSubmit} style={{ borderRadius: big ? 10 : 8 }}>Ask</PfBtn>
    </div>
  );
}

/* ------------------------------ Answer card ------------------------------ */

function AnswerCard({ a, saved, menuOpen, usedRefines, onMenu, onExport, onSave, onDrill, onGo, onRefine }: {
  a: Answer; saved: boolean; menuOpen: boolean; usedRefines: Set<RefineKey>;
  onMenu: () => void; onExport: (msg: string) => void; onSave: () => void; onDrill: () => void;
  onGo: (stage: string) => void; onRefine: (key: RefineKey, label: string, used: boolean) => void;
}) {
  const chart = a.chart;
  return (
    <PfCard style={{ overflow: "visible" }}>
      <PfCardHead
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="sparkle" tone="green" size={26} />{a.title}</span>}
        sub={a.interp}
      >
        <PfBadge tone="grey">Semantic layer</PfBadge>
        <PfBadge tone={a.conf === "High" ? "green" : "yellow"}>Confidence: {a.conf}</PfBadge>
      </PfCardHead>

      {/* Chart body */}
      <div style={{ padding: "14px 20px 4px" }}>
        {chart.kind === "bars" && <BarsChart c={chart} />}
        {chart.kind === "line" && <LineChart c={chart} />}
        {chart.kind === "list" && (
          <div style={{ paddingBottom: 8 }}>
            {chart.rows.map((r, i) => (
              <RiskRow key={r.name} r={r} last={i === chart.rows.length - 1} onOpen={() => onGo(r.go)} />
            ))}
          </div>
        )}
      </div>

      {/* AI insight + mandatory data-scope line */}
      <div style={{ padding: "0 20px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 8, padding: "8px 11px" }}>
          <span style={{ marginTop: 1 }}><Ic name="sparkle" size={14} color="var(--pf-purple-500)" /></span>
          <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{a.insight}</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "7px 11px" }}>
          <span style={{ marginTop: 1 }}><Ic name="shield" size={13} color="var(--pf-n400)" /></span>
          <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
            <b style={{ fontWeight: 600, color: "var(--pf-n600)" }}>Scope:</b> {a.scope}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 16px", borderTop: "1px solid var(--pf-n50)" }}>
        {a.refines.length > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Refine:</span>
            {a.refines.map((r) => (
              <RefineChip key={r.key} label={r.label} used={usedRefines.has(r.key)} onClick={() => onRefine(r.key, r.label, usedRefines.has(r.key))} />
            ))}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ position: "relative" }}>
          <PfBtn small icon="download" onClick={onMenu}>Export <Ic name="caretdown" size={11} /></PfBtn>
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: "calc(100% + 5px)", zIndex: 30, minWidth: 178, background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 10, boxShadow: "0 10px 28px rgba(2,6,23,.1)", overflow: "hidden", padding: "4px 0" }}>
              {EXPORTS.map((e) => (
                <MenuRow key={e.label} icon={e.icon} label={e.label} sub={e.sub} onClick={() => onExport(e.msg(a.exportBase))} />
              ))}
            </div>
          )}
        </span>
        <PfBtn small icon={saved ? "check" : "star"} onClick={onSave} style={saved ? { color: "var(--pf-primary-600)", borderColor: "var(--pf-primary-100)", background: "var(--pf-primary-50)" } : undefined}>
          {saved ? "Saved" : "Save to dashboard"}
        </PfBtn>
        <PfBtn small variant="ghost" onClick={onDrill} style={{ color: "var(--pf-primary-600)" }}>
          {a.drillLabel} <Ic name="arrowright" size={13} />
        </PfBtn>
      </div>
    </PfCard>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function AskBar() {
  const go = useGo();
  const toast = useToast();
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [draft, setDraft] = useState("");
  const [usedRefines, setUsedRefines] = useState<Set<RefineKey>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thread.length > 2) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length]);

  const append = (q: string, def: AnswerDef, key?: RefineKey, msg?: string) => {
    idRef.current += 1;
    const a: Answer = { ...def, id: `ans-${idRef.current}` };
    setThread((t) => [...t, { kind: "q", text: q }, { kind: "a", a }]);
    if (key) setUsedRefines((s) => new Set(s).add(key));
    setDraft("");
    setMenuFor(null);
    toast(msg ?? `Answered from the semantic layer — “${a.title}”, scope cited on the card`, "ai");
  };

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) { toast("Type a question or pick a suggestion below"); return; }
    const m = matchAnswer(text);
    append(text, m.def, m.key);
  };

  const refine = (key: RefineKey, label: string, used: boolean) => {
    if (used) { toast(`Already refined — the “${label}” view is in this thread above`); return; }
    const r = REFINE_DEFS[key];
    append(r.q, r.def, key, `Refined to ${label.toLowerCase()} — same governance, scope re-cited`);
  };

  const doExport = (msg: string) => {
    setMenuFor(null);
    toast(msg, "success");
  };

  const save = (a: Answer) => {
    if (savedIds.has(a.id)) { toast(`“${a.title}” is already pinned to your dashboard`); return; }
    setSavedIds((s) => new Set(s).add(a.id));
    toast(`Saved to dashboard — “${a.title}” pinned to Command Center`, "success");
  };

  const mic = () => toast("Voice input joins the Phase D pilot — type your question for now", "ai");
  const newThread = () => { setThread([]); setUsedRefines(new Set()); setMenuFor(null); setDraft(""); };

  const inThread = thread.length > 0;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 12, alignItems: "start" }}>
        {/* ------------------------------ LEFT ------------------------------ */}
        <div style={{ minWidth: 0 }}>
          {!inThread ? (
            /* Centered hero — no thread yet */
            <div style={{ minHeight: 560, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "40px 24px" }}>
              <PfTile icon="sparkle" tone="green" size={56} />
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", marginTop: 18 }}>
                Ask anything about your workforce
              </div>
              <div style={{ fontSize: 13.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 7, maxWidth: 460 }}>
                Plain language in, charted answers out — with benchmark context, conversational refine, and the data scope cited on every answer.
              </div>
              <div style={{ width: "100%", maxWidth: 640, marginTop: 22 }}>
                <AskInput
                  big
                  autoFocus
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => ask(draft)}
                  onMic={mic}
                  placeholder="Ask in plain language — “Which location has the highest attrition?”"
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, color: "var(--pf-n400)" }}>
                <Ic name="shield" size={13} color="var(--pf-n300)" />
                Governed semantic layer · row-level security applied · every answer cites its scope
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 22, maxWidth: 620 }}>
                {SUGGESTIONS.map((q) => <SuggestChip key={q} q={q} onClick={() => ask(q)} />)}
              </div>
            </div>
          ) : (
            /* Thread view */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PfTile icon="sparkle" tone="green" size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>Ask anything</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>NLQ over the governed semantic layer — refine below, export anywhere.</div>
                </div>
                <PfBadge tone="grey">{thread.filter((t) => t.kind === "q").length} question{thread.filter((t) => t.kind === "q").length > 1 ? "s" : ""}</PfBadge>
                <PfBtn small icon="plus" onClick={newThread}>New thread</PfBtn>
              </div>

              {thread.map((item, i) =>
                item.kind === "q" ? (
                  <div key={`q-${i}`} style={{ display: "flex", justifyContent: "flex-end", marginTop: i === 0 ? 0 : 4 }}>
                    <div style={{ background: "var(--pf-n900)", color: "#fff", borderRadius: "14px 14px 4px 14px", padding: "9px 15px", fontSize: 13, fontWeight: 500, maxWidth: 480, lineHeight: 1.45 }}>
                      {item.text}
                    </div>
                  </div>
                ) : (
                  <AnswerCard
                    key={item.a.id}
                    a={item.a}
                    saved={savedIds.has(item.a.id)}
                    menuOpen={menuFor === item.a.id}
                    usedRefines={usedRefines}
                    onMenu={() => setMenuFor((m) => (m === item.a.id ? null : item.a.id))}
                    onExport={doExport}
                    onSave={() => save(item.a)}
                    onDrill={() => go(item.a.drill)}
                    onGo={go}
                    onRefine={refine}
                  />
                )
              )}
              <div ref={endRef} />

              {/* Pinned bottom input */}
              <div style={{ position: "sticky", bottom: 12, zIndex: 10, background: "var(--pf-n0)", borderRadius: 14, boxShadow: "0 -8px 20px rgba(255,255,255,.9), 0 10px 28px rgba(2,6,23,.08)" }}>
                <AskInput
                  autoFocus
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => ask(draft)}
                  onMic={mic}
                  placeholder="Ask a follow-up — “compare attrition to last quarter”"
                />
              </div>
            </div>
          )}
        </div>

        {/* ------------------------------ RIGHT RAIL ------------------------------ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 16 }}>
          <PfCard>
            <PfCardHead title="How this works" sub="Every answer takes the same governed path." />
            <div style={{ padding: "13px 16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                {PIPELINE.map((step, i) => (
                  <span key={step} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{step}</span>
                    {i < PIPELINE.length - 1 && <Ic name="arrowright" size={12} color="var(--pf-n300)" />}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 11, fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                <span style={{ marginTop: 1 }}><Ic name="shield" size={13} color="var(--pf-primary-500)" /></span>
                no free-form SQL · row-level security · answers cite scope
              </div>
              <div
                onClick={() => toast("Ask-bar model card v1.2 — governed metrics only, NDPR-scoped features, answers always cite scope", "ai")}
                style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-600)", cursor: "pointer" }}
              >
                <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
                Model card v1.2 — how answers are generated
              </div>
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead title="Saved answers" sub="Pinned charts refresh on their dashboards.">
              <PfBadge tone="green">{SAVED.length}</PfBadge>
            </PfCardHead>
            {SAVED.map((s, i) => (
              <RailRow
                key={s.title}
                icon={s.icon}
                tone={s.tone}
                title={s.title}
                meta={s.meta}
                last={i === SAVED.length - 1}
                onClick={() => toast(`Opening saved answer — “${s.title}” (last refreshed 9m ago)`, "success")}
              />
            ))}
          </PfCard>

          <PfCard>
            <PfCardHead title="Recent questions" sub="Yours from the last 7 days — click to re-ask." />
            {RECENT.map((q, i) => (
              <RailRow
                key={q}
                icon="clock"
                tone="grey"
                title={q}
                meta="Re-runs against live data"
                last={i === RECENT.length - 1}
                onClick={() => ask(q)}
              />
            ))}
          </PfCard>
        </div>
      </div>

      {/* Click-away layer for the export menu */}
      {menuFor && <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 26, fontSize: 11.5, color: "var(--pf-n400)" }}>
        <Ic name="info" size={13} color="var(--pf-n300)" />
        Ask bar GA is Phase D — this is the design-partner preview.
      </div>
    </div>
  );
}
