"use client";
import { useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfTile, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { SCENARIOS, type Scenario } from "@/data/talentos";

/* ------------------------------ Local view data ------------------------------ */

/** Effect-tone hexes used in shared data → pf badge tones. */
const TONE_HEX: Record<string, PfTone> = { "#16B364": "green", "#EBA308": "yellow", "#E81E17": "red" };
const G = "#16B364", Y = "#EBA308", R = "#E81E17", N = "#64748B";

/** Live baseline — same story as COMMAND_KPIS (358 · ₦412M · 2.1%). */
const BASE = { headcount: 358, cost: 412, turnover: 2.1, hiresPerYear: 96, leaversPerPpYear: 43 };

type RippleNode = { tone: PfTone; note: string };
type Ripple = { headcount: RippleNode; cost: RippleNode; delivery: RippleNode; risk: RippleNode };

type StudioScenario = Scenario & {
  status: "idle" | "adopted" | "archived";
  confidence: number;
  simulated?: boolean;
  ripple: Ripple;
};

/** How each seeded scenario propagates through the org (drives the ripple map). */
const SEED_RIPPLES: Record<string, Ripple> = {
  "SC-1": {
    headcount: { tone: "red", note: "−3 senior" }, cost: { tone: "yellow", note: "+₦38M backfill" },
    delivery: { tone: "red", note: "+9 wks Payments" }, risk: { tone: "red", note: "Contagion −7pt" },
  },
  "SC-2": {
    headcount: { tone: "yellow", note: "12 roles frozen" }, cost: { tone: "green", note: "−₦54M saved" },
    delivery: { tone: "yellow", note: "−8% Q1 capacity" }, risk: { tone: "red", note: "Ops coverage" },
  },
  "SC-3": {
    headcount: { tone: "green", note: "+5 in PH" }, cost: { tone: "yellow", note: "₦21M ramp" },
    delivery: { tone: "green", note: "Adoption ≈80%" }, risk: { tone: "green", note: "−0.9pp attrition" },
  },
};

const seedScenarios = (): StudioScenario[] =>
  SCENARIOS.map((s) => ({
    ...s,
    status: "idle" as const,
    confidence: 74,
    ripple: SEED_RIPPLES[s.id] ?? {
      headcount: { tone: "grey", note: "Flat" }, cost: { tone: "grey", note: "Held" },
      delivery: { tone: "grey", note: "Steady" }, risk: { tone: "grey", note: "Contained" },
    },
  }));

/* ------------------------- Simulation math (levers) ------------------------- */

const fmtSign = (v: number, unit: string) => `${v > 0 ? "+" : ""}${v}${unit}`;
const fmtPp = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}pp`;

function deriveEffects(h: number, a: number, b: number) {
  const dHc = Math.round(BASE.hiresPerYear * (h / 100)) - Math.round(BASE.leaversPerPpYear * a);
  const hcAfter = BASE.headcount + dHc;
  const costAfter = Math.round(BASE.cost * (1 + b / 100));
  const turnAfter = +(BASE.turnover + a).toFixed(1);
  const capPct = Math.round((dHc / BASE.headcount) * 100);
  const effects: Scenario["effects"] = [
    { metric: "Headcount (12 mo)", before: `${BASE.headcount}`, after: `${hcAfter} (${fmtSign(dHc, "")})`, tone: dHc > 0 ? G : dHc < 0 ? R : N },
    { metric: "Monthly cost", before: `₦${BASE.cost}M`, after: `₦${costAfter}M (${fmtSign(b, "%")})`, tone: b < 0 ? G : b > 0 ? Y : N },
    { metric: "Turnover (monthly)", before: `${BASE.turnover}%`, after: `${turnAfter}%`, tone: a > 0 ? R : a < 0 ? G : N },
    { metric: "Delivery capacity", before: "On track", after: capPct === 0 ? "Held flat" : `${fmtSign(capPct, "%")} by Q3`, tone: capPct > 0 ? G : capPct <= -4 ? R : capPct < 0 ? Y : N },
  ];
  return { dHc, effects };
}

function deriveRipple(h: number, a: number, b: number, dHc: number): Ripple {
  const idle = h === 0 && a === 0 && b === 0;
  return {
    headcount: dHc > 0 ? { tone: "green", note: `+${dHc} in 12 mo` } : dHc < 0 ? { tone: "red", note: `${dHc} in 12 mo` } : { tone: "grey", note: "Flat" },
    cost: b < 0 ? { tone: "green", note: `−₦${Math.round(BASE.cost * (-b / 100))}M/mo` } : b > 0 ? { tone: "yellow", note: `+₦${Math.round(BASE.cost * (b / 100))}M/mo` } : { tone: "grey", note: "Held" },
    delivery: idle ? { tone: "grey", note: "Steady" } : dHc >= 12 ? { tone: "green", note: "Capacity up" } : dHc <= -12 ? { tone: "red", note: "Slips likely" } : { tone: "yellow", note: "Watch load" },
    risk: a > 0.5 ? { tone: "red", note: "Attrition rising" } : a > 0 ? { tone: "yellow", note: "Mild pressure" } : idle ? { tone: "grey", note: "Contained" } : { tone: "green", note: "Contained" },
  };
}

function deriveNote(h: number, a: number, b: number): string {
  if (h === 0 && a === 0 && b === 0) return "No levers moved — this mirrors today's baseline. Pull at least one lever to see second-order effects.";
  if (a > 0) return "Attrition is the costliest lever in this mix — run retention playbooks on the 12 flagged staff before adopting.";
  if (h < 0 && b <= 0) return "The savings hold only if the 4 critical Field Ops roles stay exempt — recommend a selective variant of this slowdown.";
  if (h > 0) return "Ramp is bounded by recruiter capacity, not budget — stagger starts across 2 quarters to protect time-to-hire.";
  if (a < 0) return `Retention gains compound: ${fmtPp(a)} avoids ≈ ₦${Math.round(BASE.leaversPerPpYear * Math.abs(a) * 3.2)}M of backfill spend over 12 months.`;
  return "Budget shift lands mostly in Engineering & Field Ops pay bands — phase it to avoid compression against the L5 review.";
}

const deriveConfidence = (h: number, a: number, b: number) =>
  Math.max(58, 86 - Math.round(Math.abs(h) / 4 + Math.abs(a) * 6 + Math.abs(b)));

/* --------------------------------- Bits ---------------------------------- */

function BeforeChip({ children }: { children: string }) {
  return (
    <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function EffectRow({ e, last }: { e: Scenario["effects"][number]; last: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: last ? "none" : "1px dashed var(--pf-n50)" }}>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.metric}</span>
      <BeforeChip>{e.before}</BeforeChip>
      <Ic name="arrowright" size={12} color="var(--pf-n300)" />
      <PfBadge tone={TONE_HEX[e.tone] ?? "grey"}>{e.after}</PfBadge>
    </div>
  );
}

function Lever({ label, value, min, max, step, fmt, tone, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  fmt: (v: number) => string; tone: PfTone; onChange: (v: number) => void;
}) {
  const t = value === 0 ? TONE.grey : TONE[tone];
  return (
    <div style={{ flex: 1, minWidth: 210 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)", flex: 1 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: value === 0 ? "var(--pf-n500)" : t.fg, background: t.soft, border: `1px solid ${t.line}`, borderRadius: 5, padding: "1px 7px", minWidth: 48, textAlign: "center" }}>
          {fmt(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--pf-primary-500)", margin: 0, cursor: "pointer" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--pf-n300)", marginTop: 3 }}>
        <span>{fmt(min)}</span><span>0</span><span>{fmt(max)}</span>
      </div>
    </div>
  );
}

function ScenarioCard({ s, selected, inTray, onSelect, onAdopt, onToggleCompare, onArchive, onApprovals }: {
  s: StudioScenario; selected: boolean; inTray: boolean;
  onSelect: () => void; onAdopt: () => void; onToggleCompare: () => void; onArchive: () => void; onApprovals: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const archived = s.status === "archived";
  return (
    <div {...hoverProps} onClick={onSelect} style={{ cursor: "pointer" }}>
      <PfCard style={{
        borderColor: selected ? "var(--pf-primary-500)" : hovered ? "var(--pf-n100)" : undefined,
        boxShadow: selected ? "0 0 0 3px var(--pf-primary-50), 0 1px 3px 0 #f3f3f3" : undefined,
        opacity: archived ? 0.5 : 1,
        transition: "border-color .2s ease, box-shadow .2s ease, opacity .25s ease",
      }}>
        {/* Head */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "14px 18px 10px" }}>
          <PfTile icon="flask" tone={s.simulated ? "purple" : "green"} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 650, color: "var(--pf-n900)" }}>{s.name}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 4, padding: "1px 5px" }}>{s.id}</span>
              {s.simulated && <PfBadge tone="purple" dot>Simulated</PfBadge>}
              {s.status === "adopted" && <PfBadge tone="green" dot>Adopted</PfBadge>}
              {archived && <PfBadge>Archived</PfBadge>}
              <span style={{ flex: 1 }} />
              {selected && <PfBadge tone="blue" dot>Ripple view</PfBadge>}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>{s.desc}</div>
          </div>
        </div>

        {/* Effects table */}
        <div style={{ padding: "0 18px" }}>
          <div style={{ display: "flex", fontSize: 11, color: "var(--pf-n400)", padding: "4px 0 3px", borderBottom: "1px solid var(--pf-n50)" }}>
            <span style={{ flex: 1 }}>Metric</span><span>Before → after</span>
          </div>
          {s.effects.map((e, i) => <EffectRow key={e.metric} e={e} last={i === s.effects.length - 1} />)}
        </div>

        {/* AI recommendation */}
        <div style={{ margin: "10px 18px 12px", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "9px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-purple-500)" }}>✦ AI recommendation</span>
            <span style={{ flex: 1 }} />
            <PfBadge tone="purple">Confidence {s.confidence}%</PfBadge>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55, marginTop: 5 }}>&ldquo;{s.aiNote}&rdquo;</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 5 }}>Evidence: live HRIS + payroll feeds · backtested on 14 quarters</div>
        </div>

        {/* Actions */}
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 18px 14px", flexWrap: "wrap" }}>
          {s.status === "adopted"
            ? <PfBtn small icon="arrowsq" onClick={onApprovals}>View in approvals</PfBtn>
            : <PfBtn small variant="primary" icon="check" onClick={onAdopt}>Adopt plan</PfBtn>}
          <PfBtn small icon="swap" onClick={onToggleCompare} style={inTray ? { background: "var(--pf-purple-50)", borderColor: "var(--pf-purple-100)", color: "var(--pf-purple-500)" } : undefined}>
            {inTray ? "In tray ✓" : "Compare"}
          </PfBtn>
          <PfBtn small variant="ghost" onClick={onArchive}>{archived ? "Restore" : "Archive"}</PfBtn>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Simulated on workforce-analytics · model v2</span>
        </div>
      </PfCard>
    </div>
  );
}

/* ------------------------------- Ripple map -------------------------------- */

function RmNode({ x, y, w, label, st }: { x: number; y: number; w: number; label: string; st: RippleNode }) {
  const t = TONE[st.tone];
  return (
    <g>
      <rect x={x} y={y} width={w} height={38} rx={9} style={{ fill: t.soft, stroke: t.line, strokeWidth: 1, transition: "fill .35s ease, stroke .35s ease" }} />
      <text x={x + w / 2} y={y + 16} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 600, fill: "var(--pf-n900)" }}>{label}</text>
      <text x={x + w / 2} y={y + 29.5} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 600, fill: t.fg, transition: "fill .35s ease" }}>{st.note}</text>
    </g>
  );
}

function RippleMap({ s }: { s: StudioScenario }) {
  const name = s.name.length > 20 ? `${s.name.slice(0, 19)}…` : s.name;
  const arrow = { stroke: "var(--pf-n300)", strokeWidth: 1.3, markerEnd: "url(#rm-arr)" } as const;
  return (
    <svg viewBox="0 0 320 234" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <marker id="rm-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L8 4L0 8z" fill="var(--pf-n300)" />
        </marker>
      </defs>
      <line x1={160} y1={44} x2={160} y2={62} {...arrow} />
      <line x1={138} y1={106} x2={86} y2={126} {...arrow} />
      <line x1={182} y1={106} x2={234} y2={126} {...arrow} />
      <line x1={86} y1={170} x2={138} y2={190} {...arrow} />
      <line x1={234} y1={170} x2={182} y2={190} {...arrow} />
      <RmNode x={92} y={6} w={136} label={name} st={{ tone: "purple", note: s.id }} />
      <RmNode x={98} y={66} w={124} label="Headcount" st={s.ripple.headcount} />
      <RmNode x={20} y={128} w={112} label="Cost" st={s.ripple.cost} />
      <RmNode x={188} y={128} w={112} label="Delivery" st={s.ripple.delivery} />
      <RmNode x={98} y={190} w={124} label="Risk" st={s.ripple.risk} />
    </svg>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function Scenarios() {
  const go = useGo();
  const toast = useToast();

  const [scenarios, setScenarios] = useState<StudioScenario[]>(seedScenarios);
  const [selectedId, setSelectedId] = useState<string>(SCENARIOS[0]?.id ?? "SC-1");
  const [compare, setCompare] = useState<string[]>([]);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [tab, setTab] = useState("scenarios");

  const [composerOpen, setComposerOpen] = useState(false);
  const [simName, setSimName] = useState("");
  const [hiring, setHiring] = useState(0);   // −50…+50 %
  const [attr, setAttr] = useState(0);       // ±2 pp
  const [budget, setBudget] = useState(0);   // ±10 %
  const [simCount, setSimCount] = useState(0);

  const sel = scenarios.find((s) => s.id === selectedId) ?? scenarios[0]!;
  const tray = compare
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is StudioScenario => s !== undefined);

  const runSim = () => {
    const id = `SC-${SCENARIOS.length + simCount + 1}`;
    const { dHc, effects } = deriveEffects(hiring, attr, budget);
    const next: StudioScenario = {
      id,
      name: simName.trim() || `Custom scenario ${simCount + 1}`,
      desc: `Simulated levers: hiring pace ${fmtSign(hiring, "%")} · attrition ${fmtPp(attr)} · budget ${fmtSign(budget, "%")} — diffed against the live baseline`,
      effects,
      aiNote: deriveNote(hiring, attr, budget),
      status: "idle",
      confidence: deriveConfidence(hiring, attr, budget),
      simulated: true,
      ripple: deriveRipple(hiring, attr, budget, dHc),
    };
    setScenarios((list) => [next, ...list]);
    setSelectedId(id);
    setSimCount((c) => c + 1);
    setSimName("");
    toast("Simulated in 1.2s · model v2", "ai");
  };

  const adopt = (s: StudioScenario) => {
    setScenarios((list) => list.map((x) => (x.id === s.id ? { ...x, status: "adopted" } : x)));
    toast("Adopted — 2 requisitions drafted into approval (requisition loop)", "success");
  };

  const toggleCompare = (s: StudioScenario) => {
    if (compare.includes(s.id)) {
      setCompare((c) => c.filter((id) => id !== s.id));
      if (recommendedId === s.id) setRecommendedId(null);
    } else if (compare.length >= 3) {
      toast("Compare tray holds 3 scenarios — remove one first");
    } else {
      setCompare((c) => [...c, s.id]);
    }
  };

  const toggleArchive = (s: StudioScenario) => {
    if (s.status === "archived") {
      setScenarios((list) => list.map((x) => (x.id === s.id ? { ...x, status: "idle" } : x)));
      toast(`${s.id} restored to the studio`, "success");
    } else {
      setScenarios((list) => list.map((x) => (x.id === s.id ? { ...x, status: "archived" } : x)));
      setCompare((c) => c.filter((id) => id !== s.id));
      if (recommendedId === s.id) setRecommendedId(null);
      toast(`${s.id} archived — kept for the audit trail`);
    }
  };

  const recommendBest = () => {
    const greens = (s: StudioScenario) => s.effects.filter((e) => TONE_HEX[e.tone] === "green").length;
    const best = tray.reduce((a, b) => (greens(b) > greens(a) ? b : a), tray[0]!);
    setRecommendedId(best.id);
    setSelectedId(best.id);
    const msg = tray.some((s) => s.id === "SC-2")
      ? "Selective freeze keeps 82% of savings at a fraction of the risk"
      : `${best.name} shows the strongest upside-to-risk balance in the tray`;
    toast(`✦ ${msg}`, "ai");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Workforce Scenario Studio</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Simulations run on the workforce-analytics service — decisions stay human
          </div>
        </div>
        <PfBadge tone="purple" dot>{scenarios.length} scenarios · model v2</PfBadge>
        <PfBtn
          variant={composerOpen ? "secondary" : "primary"}
          icon={composerOpen ? "x" : "flask"}
          onClick={() => { const next = !composerOpen; setComposerOpen(next); if (next) setTab("scenarios"); }}
        >
          {composerOpen ? "Close composer" : "New scenario"}
        </PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "scenarios", label: "Scenarios", count: String(scenarios.length) },
            { key: "compare", label: "Compare", count: String(tray.length) },
            { key: "baseline", label: "Baseline & ripple" },
          ]}
        />
      </div>

      {/* Composer — lives with the scenarios tab */}
      {tab === "scenarios" && composerOpen && (
        <PfCard style={{ marginBottom: 12, borderColor: "var(--pf-primary-100)" }}>
          <PfCardHead title="Scenario composer" sub="Name it, pull the levers, run — nothing executes against the real org.">
            <PfBadge tone="purple" dot>workforce-analytics · model v2</PfBadge>
          </PfCardHead>
          <div style={{ padding: "14px 18px 16px" }}>
            <input
              value={simName}
              onChange={(e) => setSimName(e.target.value)}
              placeholder="Scenario name — e.g. Slow hiring 20% while protecting Field Ops"
              style={{ width: "100%", height: 36, border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "0 12px", fontSize: 13, fontFamily: "inherit", color: "var(--pf-n900)", background: "var(--pf-n0)", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
              <Lever label="Hiring pace" value={hiring} min={-50} max={50} step={5} fmt={(v) => fmtSign(v, "%")} tone={hiring > 0 ? "blue" : "yellow"} onChange={setHiring} />
              <Lever label="Attrition" value={attr} min={-2} max={2} step={0.5} fmt={fmtPp} tone={attr > 0 ? "red" : "green"} onChange={setAttr} />
              <Lever label="Budget" value={budget} min={-10} max={10} step={1} fmt={(v) => fmtSign(v, "%")} tone={budget > 0 ? "yellow" : "green"} onChange={setBudget} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <PfBtn variant="primary" icon="play" onClick={runSim}>Run simulation</PfBtn>
              <PfBtn variant="ghost" onClick={() => { setHiring(0); setAttr(0); setBudget(0); }}>Reset levers</PfBtn>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Diffed against the live baseline snapshot · nothing is committed</span>
            </div>
          </div>
        </PfCard>
      )}

      {/* SCENARIOS — every scenario card, newest first */}
      {tab === "scenarios" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              s={s}
              selected={s.id === selectedId}
              inTray={compare.includes(s.id)}
              onSelect={() => setSelectedId(s.id)}
              onAdopt={() => adopt(s)}
              onToggleCompare={() => toggleCompare(s)}
              onArchive={() => toggleArchive(s)}
              onApprovals={() => go("planning")}
            />
          ))}
        </div>
      )}

      {/* COMPARE — side-by-side ripple of the trayed scenarios */}
      {tab === "compare" &&
        (tray.length >= 2 ? (
          <PfCard style={{ borderColor: "var(--pf-purple-100)" }}>
            <PfCardHead title="Compare tray" sub="Side-by-side ripple of the scenarios you selected.">
              <PfBtn small variant="ghost" onClick={() => { setCompare([]); setRecommendedId(null); }}>Clear</PfBtn>
              <PfBtn small variant="primary" icon="sparkle" onClick={recommendBest}>Recommend best</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${tray.length}, minmax(0,1fr))`, gap: 14, padding: "13px 18px 15px" }}>
              {tray.map((s) => (
                <div key={s.id} style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                    {recommendedId === s.id && <PfBadge tone="purple" dot>AI pick</PfBadge>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {s.effects.map((e) => (
                      <div key={e.metric} style={{ borderBottom: "1px dashed var(--pf-n50)", paddingBottom: 6 }}>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginBottom: 3 }}>{e.metric}</div>
                        <PfBadge tone={TONE_HEX[e.tone] ?? "grey"}>{e.after}</PfBadge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PfCard>
        ) : (
          <PfCard>
            <div style={{ padding: "30px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                {tray.length === 1 ? "1 scenario in the tray — add at least one more" : "Compare tray is empty"}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 5 }}>
                Use “Compare” on a scenario card to line up 2–3 scenarios side by side, then let the AI recommend the best.
              </div>
              <PfBtn small icon="swap" onClick={() => setTab("scenarios")} style={{ marginTop: 13 }}>Browse scenarios</PfBtn>
            </div>
          </PfCard>
        ))}

      {/* BASELINE & RIPPLE — the live state every simulation diffs against */}
      {tab === "baseline" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PfCard>
              <PfCardHead title="Live baseline" sub="Every simulation diffs against this state.">
                <PfBadge>synced 12m ago</PfBadge>
              </PfCardHead>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                {[
                  { label: "Headcount", value: "358", unit: "employees" },
                  { label: "Workforce cost", value: "₦412M", unit: "per month" },
                  { label: "Turnover", value: "2.1%", unit: "monthly" },
                  { label: "Coverage", value: null, unit: "critical rotations" },
                ].map((c, i) => (
                  <div key={c.label} style={{ padding: "12px 16px", borderBottom: i < 2 ? "1px solid var(--pf-n50)" : "none", borderRight: i % 2 === 0 ? "1px solid var(--pf-n50)" : "none" }}>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.label}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 3 }}>
                      {c.value !== null
                        ? <span style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{c.value}</span>
                        : <PfBadge tone="green" dot>OK</PfBadge>}
                      <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{c.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pf-primary-500)", flex: "none" }} />
                Synced from SeamlessHR payroll &amp; HRIS feeds
              </div>
            </PfCard>

            <PfCard style={{ background: "var(--pf-n25)" }}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <Ic name="shield" size={15} color="var(--pf-primary-600)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>What happens on adopt</span>
                </div>
                {[
                  "Requisitions drafted into Stage 1 approval",
                  "Playbooks queued for the owning managers",
                  "Nothing executes without human sign-off",
                ].map((step, i) => (
                  <div key={step} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5, marginTop: i === 0 ? 0 : 5 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-primary-600)" }}>{i + 1}.</span>
                    {step}
                  </div>
                ))}
                <PfBtn full small variant="ghost" onClick={() => go("planning")} style={{ color: "var(--pf-primary-600)", marginTop: 10 }}>
                  Open requisition loop <Ic name="arrowright" size={13} />
                </PfBtn>
              </div>
            </PfCard>
          </div>

          <PfCard>
            <PfCardHead title="Ripple map" sub={`Projecting: ${sel.name}`}>
              <PfBadge tone="purple" dot>{sel.id}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "12px 14px 4px" }}>
              <RippleMap s={sel} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px 13px", flexWrap: "wrap" }}>
              <PfBadge tone="green" dot>Improves</PfBadge>
              <PfBadge tone="yellow" dot>Watch</PfBadge>
              <PfBadge tone="red" dot>Degrades</PfBadge>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>Click a card to project it</span>
            </div>
          </PfCard>
        </div>
      )}

      {/* Footer guardrail */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 22, paddingTop: 14, borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", textAlign: "center" }}>
        <Ic name="shield" size={14} color="var(--pf-n300)" />
        Scenarios never execute — adopting drafts requisitions/playbooks for human approval (AI proposes, you dispose).
      </div>
    </div>
  );
}
