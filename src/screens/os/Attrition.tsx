"use client";
import { useState, type ReactNode } from "react";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfStat, PfProgress, PfTile,
  PfPageTabs, PfTh, PfAvatar, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { ATTRITION_TREND, EXIT_REASONS, EMPLOYEES, DEPARTMENTS, type Employee } from "@/data/talentos";

/* ------------------------------ Local view data ------------------------------ */

type Tab = "Analytics" | "Predictive risk";
const BENCH = 1.6; // Nigerian energy-sector monthly benchmark (%)

type Scope = "All sites" | "Lagos" | "Port Harcourt" | "Abuja";

/** Q2 per-location turnover vs the benchmark tick (exits sum to the 9 in the KPI). */
const LOCATIONS: { loc: Exclude<Scope, "All sites">; rate: number; exits: number }[] = [
  { loc: "Lagos", rate: 1.4, exits: 2 },
  { loc: "Port Harcourt", rate: 3.8, exits: 6 },
  { loc: "Abuja", rate: 1.1, exits: 1 },
];

/** Q2 exit-reason mix per site (PH mirrors AN-104: 5 of 6 exits cite pay). */
const REASON_MIX: Record<Exclude<Scope, "All sites">, Record<string, number>> = {
  Lagos: { "Career growth stalled": 50, "Relocation / japa": 50 },
  "Port Harcourt": { "Pay vs market": 83, "Rotation / site conditions": 17 },
  Abuja: { "Relocation / japa": 100 },
};

const VOLUNTARY = 71; // % of exits, YTD

/** FR-056 — the DECLARED signal list. The model may use these and only these. */
const SIGNALS: { label: string; rx: RegExp }[] = [
  { label: "Time since promotion", rx: /promot/i },
  { label: "Pay vs benchmark", rx: /pay/i },
  { label: "Engagement trend", rx: /engagement/i },
  { label: "Absence pattern", rx: /absence/i },
];

const CONFIDENCE: Record<string, "High" | "Medium"> = { "E-0092": "High", "E-0214": "High", "E-0231": "Medium" };

const DISMISS_REASONS = ["Known context", "Already managed", "Data error"];

/** Shadow-mode candidates — run silently until precision clears the gate. */
const SHADOW = [
  { name: "Attrition v3 — gradient-boosted survival", since: "Shadowing 6 weeks", precision: 54, note: "+2pt vs last month" },
  { name: "Site-contagion early warning (PH pilot)", since: "Shadowing 3 weeks", precision: 41, note: "needs 2 more quarters of exit outcomes" },
];

const SAVE_RATE = 43; // 12-week save rate on acknowledged flags
const SAVE_TARGET = 40;

/* --------------------------------- Chart math -------------------------------- */

const CW = 600, CH = 196, PL = 44, PR = 588, PT = 22, PB = 162; // viewBox + plot box
const cx = (i: number) => PL + (i * (PR - PL)) / (ATTRITION_TREND.length - 1);
const cy = (v: number) => PB - ((v - 1) / 1.5) * (PB - PT); // y-range 1.0 → 2.5
const GRID = [1.0, 1.5, 2.0, 2.5];

/* Gauge (semicircle) */
const G_R = 44;
const G_LEN = Math.PI * G_R;
const gaugePt = (f: number, r: number) => ({ x: 52 + r * Math.cos(Math.PI * (1 - f)), y: 52 - r * Math.sin(Math.PI * (1 - f)) });
const TICK_IN = gaugePt(SAVE_TARGET / 100, 34);
const TICK_OUT = gaugePt(SAVE_TARGET / 100, 52);

/* ---------------------------------- Bits ---------------------------------- */

function Dot({ color, dashed }: { color: string; dashed?: boolean }) {
  return dashed
    ? <span style={{ width: 12, height: 0, borderTop: `2px dashed ${color}`, flex: "none" }} />
    : <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flex: "none" }} />;
}

function Chip({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", cursor: onClick ? "pointer" : "default" }}
    >
      {children}
    </span>
  );
}

/** Company vs Nigerian-benchmark line chart with kit-style hover tooltip. */
function TrendChart() {
  const [hm, setHm] = useState<number | null>(null);
  const pt = hm === null ? undefined : ATTRITION_TREND[hm];
  const companyPts = ATTRITION_TREND.map((d, i) => `${cx(i)},${cy(d.val)}`).join(" ");
  const benchPts = ATTRITION_TREND.map((d, i) => `${cx(i)},${cy(d.bench)}`).join(" ");
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHm(null)}>
      <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {GRID.map((v) => (
          <g key={v}>
            <line x1={PL} x2={PR} y1={cy(v)} y2={cy(v)} stroke="var(--pf-n100)" strokeWidth={1} strokeDasharray="2 5" />
            <text x={PL - 8} y={cy(v) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--pf-n400)">{v.toFixed(1)}%</text>
          </g>
        ))}
        {hm !== null && <line x1={cx(hm)} x2={cx(hm)} y1={PT} y2={PB} stroke="var(--pf-n100)" strokeWidth={1.4} />}
        <polyline points={benchPts} fill="none" stroke="var(--pf-n300)" strokeWidth={1.8} strokeDasharray="6 5" strokeLinecap="round" />
        <polyline points={companyPts} fill="none" stroke="var(--pf-primary-500)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {ATTRITION_TREND.map((d, i) => (
          <circle key={d.m} cx={cx(i)} cy={cy(d.val)} r={hm === i ? 4.6 : 3.2} fill="var(--pf-n0)" stroke="var(--pf-primary-500)" strokeWidth={2} />
        ))}
        {ATTRITION_TREND.map((d, i) => (
          <text key={d.m} x={cx(i)} y={CH - 12} textAnchor="middle" fontSize={10.5} fill="var(--pf-n400)">{d.m}</text>
        ))}
      </svg>
      {/* hover hit columns */}
      {ATTRITION_TREND.map((d, i) => (
        <div
          key={d.m}
          onMouseEnter={() => setHm(i)}
          style={{ position: "absolute", top: 0, bottom: 0, left: `${((cx(i) - 54.4) / CW) * 100}%`, width: `${(108.8 / CW) * 100}%` }}
        />
      ))}
      {pt && hm !== null && (
        <div style={{ position: "absolute", top: 4, left: `${(cx(hm) / CW) * 100}%`, transform: hm === 0 ? "none" : hm === ATTRITION_TREND.length - 1 ? "translateX(-100%)" : "translateX(-50%)", background: "var(--pf-n0)", border: "0.8px solid var(--pf-n50)", borderRadius: 10, padding: "9px 11px", boxShadow: "0 6px 18px -6px rgba(2,6,23,.12)", pointerEvents: "none", minWidth: 158 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>{pt.m} 2026</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n400)" }}>
            <Dot color="var(--pf-primary-500)" /> Company <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--pf-n900)" }}>{pt.val.toFixed(1)}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>
            <Dot color="var(--pf-n300)" dashed /> Benchmark <span style={{ marginLeft: "auto", fontWeight: 600, color: "var(--pf-n900)" }}>{pt.bench.toFixed(1)}%</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: pt.val > pt.bench ? "var(--pf-red-500)" : "var(--pf-primary-600)" }}>
            {pt.val > pt.bench ? "+" : ""}{(pt.val - pt.bench).toFixed(1)}pp vs benchmark
          </div>
        </div>
      )}
    </div>
  );
}

function LocationRow({ loc, rate, exits, selected, onSelect }: {
  loc: string; rate: number; exits: number; selected: boolean; onSelect: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const over = rate > BENCH;
  const color = over ? "var(--pf-red-500)" : "var(--pf-primary-500)";
  return (
    <div {...hoverProps} onClick={onSelect} style={{ padding: "9px 16px", cursor: "pointer", background: selected ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent", borderLeft: `2px solid ${selected ? color : "transparent"}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{loc}</span>
        <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{exits} exit{exits > 1 ? "s" : ""} · Q2</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: over ? "var(--pf-red-500)" : "var(--pf-n900)" }}>{rate.toFixed(1)}%</span>
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 8, background: "var(--pf-n50)" }}>
        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${(rate / 4) * 100}%`, borderRadius: 8, background: color, transition: "width .3s ease" }} />
        <div style={{ position: "absolute", top: -3, bottom: -3, left: `${(BENCH / 4) * 100}%`, borderLeft: "2px dashed var(--pf-n400)" }} title={`Benchmark ${BENCH}%`} />
      </div>
    </div>
  );
}

/** FR-056 declared-signal chip — shows whether this signal fired for the person. */
function SignalChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", background: active ? "var(--pf-blue-50)" : "var(--pf-n25)", border: `1px solid ${active ? "var(--pf-blue-100)" : "var(--pf-n100)"}`, color: active ? "var(--pf-blue-500)" : "var(--pf-n300)" }}>
      {active ? <Ic name="check" size={11} /> : <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-n300)" }} />}
      {label}{!active && <span style={{ fontWeight: 400 }}>· not used</span>}
    </span>
  );
}

function RetentionLoop({ onOpen }: { onOpen: () => void }) {
  return (
    <PfCard>
      <PfCardHead title="Retention loop" sub="Playbook outcomes, 12-week save rate.">
        <PfBadge tone="green" dot>+{SAVE_RATE - SAVE_TARGET}pp vs target</PfBadge>
      </PfCardHead>
      <div style={{ padding: "16px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
        <div style={{ position: "relative", width: 168 }}>
          <svg viewBox="0 0 104 58" style={{ width: "100%", height: "auto", display: "block" }}>
            <path d="M 8 52 A 44 44 0 0 1 96 52" fill="none" stroke="var(--pf-n50)" strokeWidth={9} strokeLinecap="round" />
            <path d="M 8 52 A 44 44 0 0 1 96 52" fill="none" stroke="var(--pf-primary-500)" strokeWidth={9} strokeLinecap="round" strokeDasharray={`${(SAVE_RATE / 100) * G_LEN} ${G_LEN}`} />
            <line x1={TICK_IN.x} y1={TICK_IN.y} x2={TICK_OUT.x} y2={TICK_OUT.y} stroke="var(--pf-n900)" strokeWidth={1.6} />
          </svg>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, textAlign: "center" }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{SAVE_RATE}%</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)", marginTop: -2 }}>save rate</span>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", textAlign: "center" }}>
          Acknowledged flags saved via playbooks · target ≥{SAVE_TARGET}% (tick)
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5, marginTop: 8, padding: "9px 11px", background: "var(--pf-n25)", borderRadius: 8, border: "1px solid var(--pf-n50)" }}>
          <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
          Outcomes retrain the risk model — every save or loss becomes a labeled training example.
        </div>
        <PfBtn full small variant="ghost" onClick={onOpen} style={{ color: "var(--pf-primary-600)", marginTop: 4 }}>
          Open Mission Control <Ic name="arrowright" size={13} />
        </PfBtn>
      </div>
    </PfCard>
  );
}

/* --------------------------------- Screen --------------------------------- */

const RISK_GRID = "minmax(0,1.3fr) minmax(0,1fr) 58px 148px 62px 302px";

export default function Attrition() {
  const go = useGo();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Analytics");
  const [scope, setScope] = useState<Scope>("All sites");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, "ack" | "dismissed">>({});

  const flagged = EMPLOYEES
    .filter((e): e is Employee & { risk: NonNullable<Employee["risk"]> } => !!e.risk)
    .sort((a, b) => b.risk.score - a.risk.score);

  const reasons = EXIT_REASONS.map((r) => ({
    ...r,
    pct: scope === "All sites" ? r.pct : REASON_MIX[scope][r.reason] ?? 0,
  }));
  const maxReason = Math.max(...reasons.map((r) => r.pct), 1);
  const scopeExits = LOCATIONS.find((l) => l.loc === scope)?.exits;
  const hotspots = [...DEPARTMENTS].sort((a, b) => parseFloat(b.turnover) - parseFloat(a.turnover)).slice(0, 3);

  const switchTab = (t: string) => {
    setTab(t as Tab);
    if (t === "Predictive risk" && tab !== "Predictive risk")
      toast("Access logged — individual risk view opened under your HRBP permission", "ai");
  };

  const acknowledge = (e: Employee) => {
    setRowState((s) => ({ ...s, [e.id]: "ack" }));
    toast("Access logged · playbook opened", "ai");
    go("retention");
  };

  const dismiss = (e: Employee, reason: string) => {
    setRowState((s) => ({ ...s, [e.id]: "dismissed" }));
    setDismissing(null);
    setExpanded((x) => (x === e.id ? null : x));
    toast(`Risk flag for ${e.name} dismissed — “${reason}” logged for the fairness audit`, "danger");
  };

  const undo = (e: Employee) => {
    setRowState((s) => { const { [e.id]: _drop, ...rest } = s; return rest; });
    toast(`Flag for ${e.name} restored to the review queue`, "success");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Attrition &amp; leave-risk</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Turnover vs the Nigerian benchmark, exit-reason intelligence and governed per-person risk — FR-055 · FR-056.
          </div>
        </div>
        <PfBtn icon="download" onClick={() => toast("Attrition pack exported — Jun 2026 board format (PDF)", "success")}>Export</PfBtn>
      </div>

      {/* Section tabs — Analytics | Predictive risk (access-logged) */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={switchTab}
          tabs={[
            { key: "Analytics", label: "Analytics" },
            { key: "Predictive risk", label: "Predictive risk", count: String(flagged.length) },
          ]}
        />
      </div>

      {tab === "Analytics" && (
        <>
          {/* KPI strip (FR-055) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            <PfStat icon="trend" tone="red" label="Turnover (monthly)" value="2.1%" unit="Jun 2026" delta="+0.4pp ↑" deltaTone="red" />
            <PfStat icon="door" tone="blue" label="Voluntary share" value="71%" unit="of exits · YTD" delta="29% involuntary" deltaTone="grey" />
            <PfStat icon="heart" tone="purple" label="Regretted exits" value="4 of 9" unit="this quarter" delta="+2 vs Q1" deltaTone="red" />
            <PfStat icon="target" tone="yellow" label="Benchmark gap" value="+0.5pp" unit="vs NG benchmark 1.6%" delta="widening" deltaTone="yellow" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 352px", gap: 12, marginTop: 12, alignItems: "start" }}>
            {/* LEFT — trend + exit reasons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <PfCard>
                <PfCardHead title="Turnover vs Nigerian industry benchmark" sub="Monthly voluntary + involuntary exits as % of headcount · hover for detail.">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n600)" }}><Dot color="var(--pf-primary-500)" /> Company</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n600)" }}><Dot color="var(--pf-n300)" dashed /> NG energy benchmark</span>
                </PfCardHead>
                <div style={{ padding: "14px 16px 8px" }}>
                  <TrendChart />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
                  <Ic name="warning" size={13} color="var(--pf-yellow-500)" />
                  Crossed the benchmark in April — the Port Harcourt spike (AN-104) accounts for 80% of the gap.
                  <span onClick={() => go("command")} style={{ color: "var(--pf-primary-600)", fontWeight: 600, cursor: "pointer", marginLeft: "auto" }}>View anomaly</span>
                </div>
              </PfCard>

              <PfCard>
                <PfCardHead
                  title="Exit reasons"
                  sub={scope === "All sites" ? "Share of primary reason · YTD, all sites." : `Share of primary reason · Q2, ${scope} (${scopeExits} exit${(scopeExits ?? 0) > 1 ? "s" : ""}).`}
                >
                  {scope !== "All sites" && (
                    <PfBadge tone="blue" dot>{scope}</PfBadge>
                  )}
                  {scope !== "All sites" && (
                    <PfBtn small variant="ghost" onClick={() => setScope("All sites")} icon="x">Clear</PfBtn>
                  )}
                </PfCardHead>
                <div style={{ padding: "12px 20px 6px" }}>
                  {reasons.map((r) => (
                    <div key={r.reason} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0", opacity: r.pct === 0 ? 0.42 : 1 }}>
                      <span style={{ width: 168, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", flex: "none" }}>{r.reason}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 8, background: "var(--pf-n50)" }}>
                        <div style={{ height: "100%", width: `${(r.pct / maxReason) * 100}%`, borderRadius: 8, background: r.tone, transition: "width .35s ease" }} />
                      </div>
                      <span style={{ width: 38, textAlign: "right", fontSize: 12.5, fontWeight: 700, color: r.pct === 0 ? "var(--pf-n300)" : "var(--pf-n900)" }}>{r.pct === 0 ? "—" : `${r.pct}%`}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
                  <Ic name="mic" size={13} color="var(--pf-purple-500)" />
                  From structured AI exit interviews (FR-063) — coded to a fixed taxonomy, quotes anonymised.
                </div>
              </PfCard>
            </div>

            {/* RIGHT rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PfCard>
                <PfCardHead title="Turnover by location" sub="Click a site to filter exit reasons." />
                <div style={{ padding: "6px 0" }}>
                  {LOCATIONS.map((l) => (
                    <LocationRow key={l.loc} {...l} selected={scope === l.loc} onSelect={() => setScope(scope === l.loc ? "All sites" : l.loc)} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 16px 10px", fontSize: 11, color: "var(--pf-n400)" }}>
                  <span style={{ width: 10, borderTop: "2px dashed var(--pf-n400)" }} /> benchmark tick · 1.6% (NG energy)
                </div>
                <div style={{ padding: "10px 16px 14px", borderTop: "1px solid var(--pf-n50)" }}>
                  <PfTh style={{ marginBottom: 8 }}>Department hotspots</PfTh>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {hotspots.map((d) => (
                      <Chip key={d.name} onClick={() => go("depthealth")}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: d.healthTone }} />
                        {d.name} · {d.turnover}
                      </Chip>
                    ))}
                  </div>
                </div>
              </PfCard>

              <PfCard>
                <PfCardHead title="Voluntary vs involuntary" sub="YTD split of all exits." />
                <div style={{ padding: "16px 16px 14px", display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ position: "relative", width: 118, height: 118, borderRadius: "50%", background: `conic-gradient(var(--pf-primary-500) 0% ${VOLUNTARY}%, var(--pf-blue-500) ${VOLUNTARY}% 100%)`, flex: "none" }}>
                    <div style={{ position: "absolute", inset: 13, borderRadius: "50%", background: "var(--pf-n0)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{VOLUNTARY}%</span>
                      <span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>voluntary</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n600)" }}>
                      <Dot color="var(--pf-primary-500)" /> Voluntary · resignations — {VOLUNTARY}%
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n600)" }}>
                      <Dot color="var(--pf-blue-500)" /> Involuntary · contract end, exits — {100 - VOLUNTARY}%
                    </div>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>9 exits in Q2 · 24 YTD</div>
                  </div>
                </div>
              </PfCard>

              <RetentionLoop onOpen={() => go("missioncontrol")} />
            </div>
          </div>
        </>
      )}

      {tab === "Predictive risk" && (
        <>
          {/* Governance banner (FR-056) */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "12px 16px" }}>
            <Ic name="shield" size={17} color="var(--pf-yellow-500)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                <b style={{ fontWeight: 600, color: "var(--pf-yellow-500)" }}>Individual predictions are permissioned &amp; access-logged.</b>{" "}
                <span style={{ color: "var(--pf-n600)" }}>
                  Your access: <b style={{ fontWeight: 600 }}>HRBP · logged</b>. Alerts capped to prevent fatigue. Never triggers automated action.
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <Chip><Ic name="sparkle" size={11} color="var(--pf-purple-500)" /> Model: survival v2</Chip>
                <Chip><Ic name="gauge" size={11} color="var(--pf-n400)" /> Precision 64% on partner data</Chip>
                <Chip><Ic name="check" size={11} color="var(--pf-primary-500)" /> Quarterly fairness audit ✓</Chip>
              </div>
            </div>
          </div>

          {/* Risk table */}
          <PfCard style={{ marginTop: 12 }}>
            <PfCardHead title="Individual leave-risk — 30 / 60 / 90 day horizons" sub="AI proposes, HRBP disposes — a flag is an invitation to a conversation, never a verdict.">
              <PfBadge tone="red" dot>3 flagged</PfBadge>
              <PfBadge tone="grey">of 358 employees</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: RISK_GRID, gap: 10, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Person</PfTh>
              <PfTh>Role · Department</PfTh>
              <PfTh>Horizon</PfTh>
              <PfTh>Risk score</PfTh>
              <PfTh>Why?</PfTh>
              <PfTh style={{ textAlign: "right" }}>Actions — human decision required</PfTh>
            </div>

            {flagged.map((e, idx) => {
              const state = rowState[e.id];
              const open = expanded === e.id;
              const hTone: PfTone = e.risk.horizon === "30d" ? "red" : e.risk.horizon === "60d" ? "yellow" : "blue";
              const conf = CONFIDENCE[e.id] ?? "Medium";
              const last = idx === flagged.length - 1;

              if (state === "dismissed") {
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                    <PfAvatar init={e.init} tone={e.tone} size={26} />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)", flex: 1 }}>
                      <b style={{ fontWeight: 600, color: "var(--pf-n500)" }}>{e.name}</b> — flag dismissed; reason logged and fed to the quarterly fairness audit.
                    </span>
                    <PfBtn small variant="ghost" onClick={() => undo(e)}>Undo</PfBtn>
                  </div>
                );
              }

              return (
                <div key={e.id} style={{ borderBottom: last && !open ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: RISK_GRID, gap: 10, alignItems: "center", padding: "12px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <PfAvatar init={e.init} tone={e.tone} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{e.id} · {e.loc}{e.status === "notice" ? " · notice given" : ""}</div>
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.role}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{e.dept} · {e.grade}</div>
                    </div>
                    <div><PfBadge tone={hTone} dot>{e.risk.horizon}</PfBadge></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1 }}><PfProgress pct={e.risk.score} tone={hTone} /></div>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)", width: 26, textAlign: "right" }}>{e.risk.score}</span>
                    </div>
                    <div>
                      <PfBtn small variant="ghost" onClick={() => { setExpanded(open ? null : e.id); setDismissing(null); }} style={{ color: open ? "var(--pf-n900)" : "var(--pf-primary-600)" }}>
                        Why? <Ic name={open ? "caretdown" : "caretright"} size={12} />
                      </PfBtn>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {dismissing === e.id ? (
                        <>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Reason:</span>
                          {DISMISS_REASONS.map((r) => (
                            <button key={r} onClick={() => dismiss(e, r)} style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>{r}</button>
                          ))}
                          <button onClick={() => setDismissing(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }} aria-label="Cancel dismiss">
                            <Ic name="x" size={12} color="var(--pf-n400)" />
                          </button>
                        </>
                      ) : state === "ack" ? (
                        <>
                          <PfBadge tone="green" dot>Acknowledged</PfBadge>
                          <PfBtn small onClick={() => go("retention")}>Open playbook <Ic name="arrowright" size={12} /></PfBtn>
                        </>
                      ) : (
                        <>
                          <PfBtn small variant="primary" onClick={() => acknowledge(e)}>Acknowledge → open playbook</PfBtn>
                          <PfBtn small onClick={() => setDismissing(e.id)} style={{ color: "var(--pf-red-500)" }}>Dismiss (reason)</PfBtn>
                        </>
                      )}
                    </div>
                  </div>

                  {open && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,1fr)", gap: 18, padding: "14px 20px 16px 61px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Why the model flagged {e.name.split(" ")[0]}</span>
                          <PfBadge tone={conf === "High" ? "green" : "yellow"}>Confidence: {conf}</PfBadge>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {e.risk.reasons.map((r) => (
                            <div key={r} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: `var(--pf-${hTone === "yellow" ? "yellow" : "red"}-500)`, marginTop: 6, flex: "none" }} />
                              {r}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>Declared signal list — FR-056</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {SIGNALS.map((s) => (
                            <SignalChip key={s.label} label={s.label} active={e.risk.reasons.some((r) => s.rx.test(r))} />
                          ))}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 8 }}>
                          The model may use these signals and only these — no messages, no health data, no union activity.
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8 }}>
                          <Ic name="shield" size={13} color="var(--pf-n400)" />
                          This explanation view was access-logged · HRBP · 26 Aug 2026
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)", flexWrap: "wrap" }}>
              <Ic name="bell" size={13} color="var(--pf-n300)" />
              Showing 3 of 3 flags · alert cap 5/week per manager to prevent fatigue ·
              <span onClick={() => toast("Model card — survival v2: trained on partner exit outcomes, declared signals only, NDPR-scoped, fairness-audited Jun 2026", "ai")} style={{ color: "var(--pf-primary-600)", fontWeight: 600, cursor: "pointer" }}>
                View model card
              </span>
            </div>
          </PfCard>

          {/* Shadow mode + retention loop */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 352px", gap: 12, marginTop: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="Shadow mode — candidate models" sub="Next-generation models run silently against real outcomes before anyone sees a prediction.">
                <PfBadge tone="purple" dot>2 in shadow</PfBadge>
              </PfCardHead>
              <div style={{ padding: "6px 0" }}>
                {SHADOW.map((m, i) => (
                  <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: i === SHADOW.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                    <PfTile icon="flask" tone="purple" size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{m.since} · {m.note}</div>
                      <div style={{ position: "relative", height: 8, borderRadius: 8, background: "var(--pf-n50)", marginTop: 7, maxWidth: 340 }}>
                        <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${m.precision}%`, borderRadius: 8, background: "var(--pf-yellow-500)" }} />
                        <div style={{ position: "absolute", top: -3, bottom: -3, left: "60%", borderLeft: "2px dashed var(--pf-n400)" }} title="Validation gate: 60%" />
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flex: "none" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{m.precision}%</div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>precision · gate 60%</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
                <Ic name="shield" size={13} color="var(--pf-n400)" />
                Names hidden until precision ≥60% validated on two consecutive quarters — until then, shadow only.
              </div>
            </PfCard>

            <RetentionLoop onOpen={() => go("missioncontrol")} />
          </div>
        </>
      )}
    </div>
  );
}
