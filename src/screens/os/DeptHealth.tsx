"use client";
import { useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfSegments, PfTh, PfTabs, PfPageTabs, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { DEPARTMENTS, type Department } from "@/data/talentos";

/**
 * Department Health Scorecard (FR-057) — composite score per department ×
 * location from performance, engagement, absence and turnover; org roll-up,
 * widest-gap callout, drill-down to teams. Feeds FR-052 + Mission Control.
 */

/* ------------------------------ Local view data ------------------------------ */

const ORG_HEALTH = 74; // composite, amber band
const ORG_TARGET = 80;

/** 8-quarter org-health trend (ends at the current 74). */
const TREND: { q: string; v: number }[] = [
  { q: "Q4 '24", v: 78 }, { q: "Q1 '25", v: 79 }, { q: "Q2 '25", v: 77 }, { q: "Q3 '25", v: 76 },
  { q: "Q4 '25", v: 77 }, { q: "Q1 '26", v: 75 }, { q: "Q2 '26", v: 73 }, { q: "Q3 '26", v: ORG_HEALTH },
];

/** Headcount-weighted org component values (computed from the shared data). */
const HC_TOTAL = DEPARTMENTS.reduce((s, d) => s + d.headcount, 0);
const wavg = (f: (d: Department) => number) => DEPARTMENTS.reduce((s, d) => s + f(d) * d.headcount, 0) / HC_TOTAL;

const FORMULA: { label: string; weight: string; dot: string; org: string; src: string }[] = [
  { label: "Performance", weight: "35%", dot: "var(--pf-primary-500)", org: `${Math.round(wavg((d) => d.performance))}/100`, src: "Q2 2026 review-cycle scores" },
  { label: "Engagement", weight: "30%", dot: "var(--pf-blue-500)", org: `${Math.round(wavg((d) => d.engagement))}/100`, src: "monthly pulse (118 responses)" },
  { label: "Turnover", weight: "20%", dot: "var(--pf-red-500)", org: `${wavg((d) => parseFloat(d.turnover)).toFixed(1)}%`, src: "12-mo rolling exits vs 1.6% benchmark" },
  { label: "Absence", weight: "15%", dot: "var(--pf-yellow-500)", org: `${wavg((d) => parseFloat(d.absence)).toFixed(1)}%`, src: "absence register vs 2.0% benchmark" },
];

const LOCS = ["All", "Lagos", "Port Harcourt", "Abuja"];

/** Teams inside each department — averages reconcile exactly to the dept composite. */
type Team = { name: string; lead: string; n: number; health: number };
const TEAMS: Record<string, Team[]> = {
  "Engineering": [
    { name: "Payments Platform", lead: "Amara Okonkwo", n: 26, health: 64 },
    { name: "Core Infrastructure", lead: "Efe Akpan", n: 31, health: 75 },
    { name: "Data & Integrations", lead: "Lanre Ogunleye", n: 27, health: 74 },
  ],
  "Field Operations": [
    { name: "Rig Crew Alpha", lead: "Emeka Nwosu", n: 34, health: 49 },
    { name: "Rig Crew Bravo", lead: "Musa Danjuma", n: 33, health: 58 },
    { name: "Logistics & Maintenance", lead: "Blessing Etim", n: 29, health: 67 },
  ],
  "Product & Design": [
    { name: "Design Systems", lead: "Adaeze Okafor", n: 14, health: 88 },
    { name: "Product Management", lead: "Tunde Bakare", n: 12, health: 80 },
    { name: "UX Research", lead: "Ifeoma Chukwu", n: 12, health: 84 },
  ],
  "Commercial": [
    { name: "Enterprise Sales", lead: "Segun Adewale", n: 16, health: 81 },
    { name: "Growth Marketing", lead: "Zainab Yusuf", n: 14, health: 76 },
    { name: "Partnerships", lead: "Nneka Eze", n: 14, health: 80 },
  ],
  "HSE & Compliance": [
    { name: "Site HSE (PH)", lead: "Halima Sule", n: 9, health: 68 },
    { name: "Compliance & Audit", lead: "Obinna Kalu", n: 10, health: 79 },
    { name: "Training & Certification", lead: "Fatima Abdullahi", n: 8, health: 75 },
  ],
  "Finance": [
    { name: "FP&A", lead: "Ngozi Obi", n: 8, health: 90 },
    { name: "Treasury", lead: "Dayo Fashola", n: 6, health: 87 },
    { name: "Payroll Ops", lead: "Chiamaka Udo", n: 8, health: 87 },
  ],
  "People / HR": [
    { name: "Talent Acquisition", lead: "Rotimi Alade", n: 7, health: 84 },
    { name: "People Ops", lead: "Hauwa Bello", n: 6, health: 81 },
    { name: "Learning & Development", lead: "Uche Nnamdi", n: 5, health: 81 },
  ],
  "Drilling Support": [
    { name: "Rig Maintenance", lead: "Gbenga Oni", n: 11, health: 57 },
    { name: "Well Services", lead: "Amina Mohammed", n: 10, health: 64 },
    { name: "Equipment & Stores", lead: "Tari Briggs", n: 8, health: 68 },
  ],
};

/** AI diagnosis per department — plain language, with evidence + confidence (PRD). */
const DIAG: Record<string, { text: string; ev: string; conf: "High" | "Medium" }> = {
  "Engineering": { text: "Composite is dragged by engagement (68) after the payments-platform crunch — anomaly AN-103 flagged a −0.7pt pulse drop in 30 days. Performance holds at 82, so the risk is burnout, not output; Payments Platform carries the dip.", ev: "118 pulse responses · absence records", conf: "Medium" },
  "Field Operations": { text: "Turnover is the driver: 3.8% vs the 1.6% benchmark — the AN-104 turnover-spike anomaly traced the Port Harcourt exits here, with 5 of 6 citing pay vs market. Rig Crew Alpha is the epicentre; engagement (54) and absence (4.6%) compound it.", ev: "6 structured exit interviews · payroll benchmark set", conf: "High" },
  "Product & Design": { text: "Healthiest large unit: engagement 81, performance 88, turnover 1.1%. Its 26-point lead over Field Operations sets the org's widest gap — the rituals behind it (design crits, visible growth paths) are the template worth exporting.", ev: "Pulse + Q2 review-cycle scores", conf: "High" },
  "Commercial": { text: "Stable on all four inputs; absence (1.9%) sits just under benchmark. Watch the Abuja pod's next pulse — a 14-person sample flips this tone easily, and two enterprise renewals land the same month.", ev: "Pulse (44 responses) · absence register", conf: "Medium" },
  "HSE & Compliance": { text: "Absence (3.2%) is the drag — anomaly AN-101 found a sick-day cluster on the Site HSE team around rotation changeover, 4 of 9 staff, same pattern as August 2025. Performance stays strong at 85: fix the roster, not the people.", ev: "Rotation roster · absence log (Aug '25 match)", conf: "Medium" },
  "Finance": { text: "Best composite in the org — turnover 0.8%, absence 1.1%, engagement 84. No intervention needed; used as the control group when calibrating the other benchmarks.", ev: "Payroll + pulse feeds, 12-mo window", conf: "High" },
  "People / HR": { text: "Healthy and steady: engagement 80, turnover 1.0%. Capacity is the quiet risk — 18 seats are carrying three open programmes (review cycle, NCDMB filing, onboarding wave).", ev: "Programme tracker · pulse (18 responses)", conf: "Medium" },
  "Drilling Support": { text: "Over plan on seats (29 vs 24) yet under-delivering: performance 71, turnover 2.6%, absence 3.9%. Contractor churn links to AN-102's agency-spend overrun — convert the two strongest contractors before the Aug 30 expiries.", ev: "Agency PO ledger · 2 payroll cycles", conf: "High" },
};

/* ------------------------------ Metric helpers ------------------------------ */

const statusOf = (h: number): { label: string; tone: PfTone } =>
  h >= 78 ? { label: "Healthy", tone: "green" } : h >= 65 ? { label: "Watch", tone: "yellow" } : { label: "At risk", tone: "red" };

const perfTone = (v: number): PfTone => (v >= 80 ? "green" : v >= 70 ? "yellow" : "red");
const engTone = (v: number): PfTone => (v >= 75 ? "green" : v >= 60 ? "yellow" : "red");
const toTone = (v: number): PfTone => (v <= 1.6 ? "green" : v <= 2.5 ? "yellow" : "red");
const absTone = (v: number): PfTone => (v <= 2.0 ? "green" : v <= 3.5 ? "yellow" : "red");

type HeatMetric = { label: string; weight: string; bench: string; val: (d: Department) => string; tone: (d: Department) => PfTone };
const HEAT: HeatMetric[] = [
  { label: "Performance", weight: "35%", bench: "80", val: (d) => `${d.performance}`, tone: (d) => perfTone(d.performance) },
  { label: "Engagement", weight: "30%", bench: "75", val: (d) => `${d.engagement}`, tone: (d) => engTone(d.engagement) },
  { label: "Turnover", weight: "20%", bench: "1.6%", val: (d) => d.turnover, tone: (d) => toTone(parseFloat(d.turnover)) },
  { label: "Absence", weight: "15%", bench: "2.0%", val: (d) => d.absence, tone: (d) => absTone(parseFloat(d.absence)) },
];

const deptId = (name: string) => `dept-card-${name.replace(/[^a-zA-Z]/g, "-")}`;

/* ---------------------------------- Bits ---------------------------------- */

function Ring({ value, color }: { value: number; color: string }) {
  const size = 138, stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const targetAngle = ((ORG_TARGET / 100) * 360 - 90) * (Math.PI / 180);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-n50)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {/* target marker at 80 */}
        <circle cx={size / 2 + r * Math.cos(targetAngle)} cy={size / 2 + r * Math.sin(targetAngle)} r={3.2} fill="var(--pf-n400)" stroke="#fff" strokeWidth={1.5} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 30, fontWeight: 700, color, letterSpacing: "-.6px", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 3 }}>of 100 · target {ORG_TARGET}</div>
      </div>
    </div>
  );
}

function Spark() {
  const W = 320, H = 58, min = 68, max = 82;
  const x = (i: number) => 6 + (i * (W - 12)) / (TREND.length - 1);
  const y = (v: number) => 8 + ((max - v) / (max - min)) * (H - 18);
  const pts = TREND.map((t, i) => `${x(i)},${y(t.v)}`).join(" ");
  const last = TREND[TREND.length - 1] ?? { q: "", v: ORG_HEALTH };
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <line x1={6} y1={y(ORG_TARGET)} x2={W - 6} y2={y(ORG_TARGET)} stroke="var(--pf-n100)" strokeWidth={1} strokeDasharray="4 4" />
      <text x={W - 8} y={y(ORG_TARGET) - 4} textAnchor="end" fontSize={9} fill="var(--pf-n300)">target {ORG_TARGET}</text>
      <polyline points={pts} fill="none" stroke="#EBA308" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {TREND.map((t, i) => <circle key={t.q} cx={x(i)} cy={y(t.v)} r={1.8} fill="#EBA308" opacity={0.55} />)}
      <circle cx={x(TREND.length - 1)} cy={y(last.v)} r={3.6} fill="#EBA308" stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

function FormulaChip({ f, onClick }: { f: (typeof FORMULA)[number]; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <span
      {...hoverProps} onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--pf-n600)", background: hovered ? "var(--pf-n50)" : "var(--pf-n25)", border: `1px solid ${hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`, padding: "3px 9px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: f.dot, flex: "none" }} />
      {f.label} <span style={{ color: "var(--pf-n400)", fontWeight: 500 }}>{f.weight}</span>
    </span>
  );
}

function GapCallout({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps} onClick={onClick}
      style={{ background: "var(--pf-red-50)", border: `1px solid ${hovered ? "var(--pf-red-500)" : "var(--pf-red-100)"}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "border-color .15s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Ic name="warning" size={14} color="var(--pf-red-500)" />
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".6px", color: "var(--pf-red-500)" }}>WIDEST GAP</span>
        <span style={{ flex: 1 }} />
        <Ic name="arrowright" size={15} color="var(--pf-red-500)" />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-red-500)", lineHeight: 1.55 }}>
        Field Operations trails Product &amp; Design by 26 points — largest gap in 4 quarters
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 5 }}>84 vs 58 · open the Field Operations drill-down</div>
    </div>
  );
}

function WatchlineNote({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 500, color: hovered ? "var(--pf-n900)" : "var(--pf-n500)", cursor: "pointer", padding: "7px 10px", borderRadius: 8, background: hovered ? "var(--pf-n25)" : "transparent" }}
    >
      <Ic name="filter" size={13} color="var(--pf-n400)" />
      <span style={{ flex: 1 }}>2 departments sit below the 65 watchline — both Port Harcourt. Filter to site</span>
      <Ic name="caretright" size={12} color="var(--pf-n300)" />
    </div>
  );
}

function MetricBar({ label, value, tone }: { label: string; value: number; tone: PfTone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 82, flex: "none" }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 6, background: "var(--pf-n50)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, borderRadius: 6, background: TONE[tone].bg }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", width: 40, textAlign: "right", flex: "none" }}>{value}</span>
    </div>
  );
}

/** Inverse metric (lower = better): value marker on a track with a benchmark tick. */
function BenchRow({ label, value, scale, bench, tone }: { label: string; value: string; scale: number; bench: number; tone: PfTone }) {
  const v = parseFloat(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }} title={`Benchmark ${bench}%`}>
      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 82, flex: "none" }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 6, background: "var(--pf-n50)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min((v / scale) * 100, 100)}%`, borderRadius: 6, background: TONE[tone].bg }} />
        <span style={{ position: "absolute", left: `${(bench / scale) * 100}%`, top: -3, width: 2, height: 12, borderRadius: 2, background: "var(--pf-n400)" }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: TONE[tone].fg, width: 40, textAlign: "right", flex: "none" }}>{value}</span>
    </div>
  );
}

function TeamRow({ t }: { t: Team }) {
  const st = statusOf(t.health);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
      <div style={{ width: 178, flex: "none", minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.lead} · {t.n} people</div>
      </div>
      <div style={{ flex: 1, height: 6, borderRadius: 6, background: "var(--pf-n100)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${t.health}%`, borderRadius: 6, background: TONE[st.tone].bg }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: TONE[st.tone].fg, width: 26, textAlign: "right", flex: "none" }}>{t.health}</span>
    </div>
  );
}

function DeptCard({ d, open, onToggle, onAttrition, onMessage }: {
  d: Department; open: boolean; onToggle: () => void; onAttrition: () => void; onMessage: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const st = statusOf(d.health);
  const teams = [...(TEAMS[d.name] ?? [])].sort((a, b) => a.health - b.health);
  const diag = DIAG[d.name] ?? { text: "Composite within expected range across all four inputs.", ev: "HRIS + payroll feeds", conf: "Medium" as const };
  return (
    <div id={deptId(d.name)}>
    <PfCard style={{ overflow: "hidden" }}>
      {/* Clickable summary → drill-down toggle */}
      <div {...hoverProps} onClick={onToggle} style={{ padding: "14px 16px 13px", cursor: "pointer", background: hovered && !open ? "var(--pf-n25)" : "transparent", transition: "background .15s ease" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{d.head} · {d.loc}</div>
          </div>
          <PfBadge tone={st.tone} dot>{st.label}</PfBadge>
          <span style={{ display: "inline-flex", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s ease", marginTop: 2 }}>
            <Ic name="caretdown" size={14} color="var(--pf-n300)" />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
          <span style={{ fontSize: 27, fontWeight: 700, color: d.healthTone, letterSpacing: "-.5px", lineHeight: 1 }}>
            {d.health}<span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n300)", letterSpacing: 0 }}>/100</span>
          </span>
          <PfSegments score={d.health / 20} tone={st.tone} />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{d.headcount} people</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
          <MetricBar label="Performance" value={d.performance} tone={perfTone(d.performance)} />
          <MetricBar label="Engagement" value={d.engagement} tone={engTone(d.engagement)} />
          <BenchRow label="Turnover" value={d.turnover} scale={5} bench={1.6} tone={toTone(parseFloat(d.turnover))} />
          <BenchRow label="Absence" value={d.absence} scale={6} bench={2.0} tone={absTone(parseFloat(d.absence))} />
        </div>
      </div>

      {/* Drill-down: teams + AI diagnosis + actions */}
      {open && (
        <div style={{ borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", padding: "12px 16px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <PfTh>Teams inside {d.name}</PfTh>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>worst first</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {teams.map((t) => <TeamRow key={t.name} t={t} />)}
          </div>
          <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "10px 12px", marginTop: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-purple-500)" }}>✦ AI diagnosis</span>
              <span style={{ flex: 1 }} />
              <PfBadge tone={diag.conf === "High" ? "green" : "yellow"}>Confidence: {diag.conf}</PfBadge>
            </div>
            <div style={{ fontSize: 12.2, color: "var(--pf-n600)", lineHeight: 1.6 }}>{diag.text}</div>
            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 6 }}>Evidence: {diag.ev}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <PfBtn small icon="door" onClick={onAttrition}>Open attrition</PfBtn>
            <PfBtn small icon="chat" onClick={onMessage}>Message head</PfBtn>
          </div>
        </div>
      )}
    </PfCard>
    </div>
  );
}

function HeatCell({ d, m, onClick }: { d: Department; m: HeatMetric; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const tone = m.tone(d);
  return (
    <div
      {...hoverProps} onClick={onClick}
      style={{ height: 34, borderRadius: 7, background: TONE[tone].soft, border: `1px solid ${hovered ? TONE[tone].bg : TONE[tone].line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 600, color: TONE[tone].fg, cursor: "pointer", transition: "border-color .15s ease" }}
    >
      {m.val(d)}
    </div>
  );
}

function HeatDeptLabel({ d, onClick }: { d: Department; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", minWidth: 0, padding: "0 2px" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: hovered ? "var(--pf-primary-600)" : "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: d.healthTone, flex: "none" }}>{d.health}</span>
    </div>
  );
}

function Legend({ tone, label }: { tone: PfTone; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n500)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: TONE[tone].soft, border: `1px solid ${TONE[tone].line}`, display: "inline-block" }} />
      {label}
    </span>
  );
}

/* --------------------------------- Screen --------------------------------- */

const HEAT_GRID = "1.5fr .9fr .9fr .9fr .9fr";

export default function DeptHealth() {
  const go = useGo();
  const toast = useToast();
  const [loc, setLoc] = useState("All");
  const [open, setOpen] = useState<string | null>("Field Operations"); // single-select drill-down
  const [tab, setTab] = useState("health");

  const visible = loc === "All" ? DEPARTMENTS : DEPARTMENTS.filter((d) => d.loc.includes(loc));
  const trendFirst = TREND[0] ?? { q: "", v: 0 };
  const trendLast = TREND[TREND.length - 1] ?? { q: "", v: ORG_HEALTH };

  const openAndScroll = (name: string) => {
    setTab("health");
    setLoc("All");
    setOpen(name);
    setTimeout(() => document.getElementById(deptId(name))?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const filterPH = () => {
    setLoc("Port Harcourt");
    toast("Filtered to Port Harcourt — 3 departments, 2 below the watchline", "default");
  };

  const messageHead = (d: Department) =>
    toast(`Message drafted to ${d.head} — ${d.name} health pack attached`, "success");

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Page head */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Department health</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            One composite per department × location — performance, engagement, absence and turnover (FR-057).
          </div>
        </div>
        <PfTabs tabs={LOCS} active={loc} onChange={setLoc} />
        <PfBtn icon="download" onClick={() => toast("Scorecard exported — dept-health-aug-2026.pdf shared with People leadership", "success")}>Export</PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "health", label: "Org health & scorecards", count: String(visible.length) },
            { key: "heatmap", label: "Metric heatmap" },
          ]}
        />
      </div>

      {/* ORG HEALTH + SCORECARDS */}
      {tab === "health" && (
      <>
      <PfCard>
        <PfCardHead title="Org health" sub={`Composite of 8 departments · ${HC_TOTAL} employees · weights set by People leadership, Jul 2026`}>
          <PfBadge tone="yellow" dot>Watch band · 65–77</PfBadge>
        </PfCardHead>
        <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) 316px", gap: 24, padding: "16px 20px 18px", alignItems: "center" }}>
          {/* Ring */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Ring value={ORG_HEALTH} color="#EBA308" />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11.5, fontWeight: 600, color: "#16B364" }}>
              <Ic name="arrowup" size={12} color="#16B364" /> +1 pt vs Q2 &apos;26
            </span>
          </div>
          {/* Formula + sparkline */}
          <div style={{ minWidth: 0 }}>
            <PfTh style={{ marginBottom: 7 }}>Composite formula</PfTh>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {FORMULA.map((f) => (
                <FormulaChip key={f.label} f={f} onClick={() => toast(`${f.label} — ${f.weight} of composite · org ${f.org} · ${f.src}`, "default")} />
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <PfTh style={{ marginBottom: 5 }}>8-quarter trend</PfTh>
              <Spark />
              <div style={{ display: "flex", justifyContent: "space-between", width: 320, fontSize: 10.5, color: "var(--pf-n300)", marginTop: 2 }}>
                <span>{trendFirst.q}</span>
                <span>{trendLast.q} · today</span>
              </div>
            </div>
          </div>
          {/* Widest gap + watchline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <GapCallout onClick={() => openAndScroll("Field Operations")} />
            <WatchlineNote onClick={filterPH} />
          </div>
        </div>
      </PfCard>

      {/* SCORECARD GRID */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 10px" }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>Scorecards</span>
        <PfBadge tone="grey">{visible.length} of {DEPARTMENTS.length} departments</PfBadge>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Click a card to drill into its teams</span>
      </div>
      {visible.length === 0 ? (
        <PfCard pad={"30px 20px"} style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>No departments at this location — clear the filter to see all 8.</div>
        </PfCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, alignItems: "start" }}>
          {visible.map((d) => (
            <DeptCard
              key={d.name}
              d={d}
              open={open === d.name}
              onToggle={() => setOpen(open === d.name ? null : d.name)}
              onAttrition={() => go("attrition")}
              onMessage={() => messageHead(d)}
            />
          ))}
        </div>
      )}
      </>
      )}

      {/* HEATMAP */}
      {tab === "heatmap" && (
      <PfCard>
        <PfCardHead title="Metric heatmap" sub="Department × metric, tinted against Nigerian energy-sector benchmarks — click any cell for the comparison.">
          <div style={{ display: "flex", gap: 12 }}>
            <Legend tone="green" label="On benchmark" />
            <Legend tone="yellow" label="Watch" />
            <Legend tone="red" label="Off benchmark" />
          </div>
        </PfCardHead>
        <div style={{ padding: "12px 20px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: HEAT_GRID, gap: 6, marginBottom: 8 }}>
            <PfTh>Department</PfTh>
            {HEAT.map((m) => (
              <PfTh key={m.label} style={{ textAlign: "center" }}>
                {m.label} <span style={{ color: "var(--pf-n300)", fontWeight: 400 }}>· {m.weight}</span>
              </PfTh>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visible.map((d) => (
              <div key={d.name} style={{ display: "grid", gridTemplateColumns: HEAT_GRID, gap: 6, alignItems: "center" }}>
                <HeatDeptLabel d={d} onClick={() => openAndScroll(d.name)} />
                {HEAT.map((m) => {
                  const tone = m.tone(d);
                  const state = tone === "green" ? "on benchmark" : tone === "yellow" ? "watch" : "off benchmark";
                  return (
                    <HeatCell
                      key={m.label} d={d} m={m}
                      onClick={() => toast(`${d.name} ${m.label.toLowerCase()} ${m.val(d)} vs ${m.bench} benchmark — ${state}`, tone === "red" ? "danger" : "default")}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </PfCard>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 14, fontSize: 11.5, color: "var(--pf-n400)" }}>
        <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
        <span>
          Composite recomputed nightly · feeds the{" "}
          <span onClick={() => go("command")} style={{ color: "var(--pf-primary-600)", fontWeight: 600, cursor: "pointer" }}>anomaly detector (FR-052)</span>
          {" "}and{" "}
          <span onClick={() => go("missioncontrol")} style={{ color: "var(--pf-primary-600)", fontWeight: 600, cursor: "pointer" }}>Mission Control</span>
        </span>
      </div>
    </div>
  );
}
