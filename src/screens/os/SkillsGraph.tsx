"use client";
import { useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfTile, PfTabs, PfTh, PfAvatar, PfSegments, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { SKILL_CLUSTERS, EMPLOYEES } from "@/data/talentos";

/**
 * Skills Graph — PRD FR-076, the unified skills taxonomy rendered as a living
 * constellation. One Nigerian-first taxonomy powers JDs, screening rubrics,
 * interview scorecards, review competencies, growth plans and mobility matching:
 * a rating anywhere is comparable everywhere.
 */

/* ------------------------------- geometry ------------------------------- */

const W = 740, H = 420;

const HUBS: Record<string, { x: number; y: number }> = {
  "Product & Design": { x: 185, y: 115 },
  "Engineering": { x: 545, y: 120 },
  "Operations & HSE": { x: 190, y: 315 },
  "Commercial & Finance": { x: 558, y: 318 },
};

const POS: Record<string, { x: number; y: number }> = {
  "Design systems": { x: 300, y: 62 },
  "Product strategy": { x: 85, y: 60 },
  "UX research": { x: 72, y: 180 },
  "Prototyping": { x: 238, y: 196 },
  "Distributed systems": { x: 452, y: 50 },
  "Go": { x: 652, y: 58 },
  "Payments": { x: 602, y: 208 },
  "Kafka": { x: 445, y: 172 },
  "PostgreSQL": { x: 692, y: 142 },
  "Rig operations": { x: 82, y: 348 },
  "Incident investigation": { x: 302, y: 352 },
  "Crew scheduling": { x: 128, y: 240 },
  "HSE auditing": { x: 272, y: 264 },
  "FP&A": { x: 478, y: 252 },
  "Lifecycle marketing": { x: 655, y: 252 },
  "IFRS": { x: 474, y: 375 },
  "Partnerships": { x: 642, y: 372 },
};

type SkillNode = { s: string; n: number; demand: number; cluster: string; tone: string; x: number; y: number; r: number };

const NODES: SkillNode[] = SKILL_CLUSTERS.flatMap((c) =>
  c.skills.map((k) => ({ s: k.s, n: k.n, demand: k.demand, cluster: c.name, tone: c.tone, ...POS[k.s], r: 7 + Math.sqrt(k.n) * 2.7 })),
);

const nodeOf = (s: string) => NODES.find((n) => n.s === s)!;

/** Cross-cluster taxonomy relationships — same graph, different clusters. */
const LINKS = [
  { a: "Payments", b: "FP&A", note: "Payments ↔ FP&A — revenue-critical pairing, shared money-movement anchors" },
  { a: "Kafka", b: "Incident investigation", note: "Kafka ↔ Incident investigation — rig telemetry streams feed incident review" },
  { a: "HSE auditing", b: "IFRS", note: "HSE auditing ↔ IFRS — shared audit-method competency anchors" },
];

/* ----------------------------- supply/demand ---------------------------- */

type Tier = "critical" | "gap" | "balanced" | "surplus";

const tierOf = (n: number, demand: number): Tier => {
  const cov = (n * 5) / demand;
  if (demand >= 85 && cov < 0.5) return "critical";
  if (cov < 0.65) return "gap";
  if (cov >= 1.15) return "surplus";
  return "balanced";
};

const TIER: Record<Tier, { label: string; tone: PfTone }> = {
  critical: { label: "Critical gap", tone: "red" },
  gap: { label: "Gap", tone: "yellow" },
  balanced: { label: "Balanced", tone: "grey" },
  surplus: { label: "Surplus", tone: "green" },
};

const trendOf = (demand: number): "Rising" | "Steady" | "Cooling" => (demand >= 80 ? "Rising" : demand <= 64 ? "Cooling" : "Steady");
const TREND_TONE = { Rising: "#16B364", Steady: "#475569", Cooling: "#E81E17" } as const;

const CLUSTER_PFTONE: Record<string, PfTone> = {
  "Product & Design": "purple", "Engineering": "blue", "Operations & HSE": "green", "Commercial & Finance": "yellow",
};

/** Coverage index per cluster — mean of per-skill supply coverage, capped at 100. */
const coverageOf = (cluster: string) => {
  const ks = NODES.filter((n) => n.cluster === cluster);
  return Math.round(ks.reduce((a, k) => a + Math.min((k.n * 5) / k.demand, 1) * 100, 0) / ks.length);
};

/* -------------------------------- holders ------------------------------- */

type Holder = { name: string; init: string; tone: string; real?: boolean };

const E = (id: string): Holder => {
  const e = EMPLOYEES.find((x) => x.id === id)!;
  return { name: e.name, init: e.init, tone: e.tone, real: true };
};
const P = (name: string, tone: string): Holder => ({ name, init: name.split(" ").map((w) => w[0]).join(""), tone });

const HOLDERS: Record<string, Holder[]> = {
  "Design systems": [E("E-0198"), P("Femi Alade", "#16B364"), P("Chiamaka Udo", "#AF52DE")],
  "Product strategy": [E("E-0092"), E("E-0198"), P("Efe Akpan", "#16B364")],
  "UX research": [E("E-0198"), P("Bisi Olawale", "#EBA308"), P("Kachi Nnaji", "#16B364")],
  "Prototyping": [P("Femi Alade", "#16B364"), P("Rekiya Bello", "#AF52DE"), P("Dayo Oni", "#16B364")],
  "Distributed systems": [E("E-0214"), E("E-0243"), P("Ifeanyi Mbah", "#16B364")],
  "Go": [E("E-0214"), E("E-0243"), P("Sade Balogun", "#EBA308")],
  "Payments": [E("E-0214"), P("Ifeanyi Mbah", "#16B364"), P("Sade Balogun", "#EBA308")],
  "Kafka": [E("E-0243"), P("Ifeanyi Mbah", "#16B364"), P("Tayo Adisa", "#AF52DE")],
  "PostgreSQL": [E("E-0243"), P("Sade Balogun", "#EBA308"), P("Tayo Adisa", "#AF52DE")],
  "Rig operations": [E("E-0231"), E("E-0250"), P("Yusuf Lawal", "#16B364")],
  "Incident investigation": [E("E-0129"), P("Chinedu Eze", "#16B364"), E("E-0231")],
  "Crew scheduling": [E("E-0231"), P("Ibrahim Sani", "#EBA308"), P("Yusuf Lawal", "#16B364")],
  "HSE auditing": [E("E-0129"), P("Chinedu Eze", "#16B364"), P("Amina Dikko", "#E81E17")],
  "FP&A": [E("E-0187"), P("Kemi Salami", "#AF52DE"), P("Uche Eke", "#16B364")],
  "Lifecycle marketing": [E("E-0165"), P("Aisha Bello", "#16B364"), P("Tomi Ajose", "#16B364")],
  "IFRS": [E("E-0187"), P("Kemi Salami", "#AF52DE"), P("Uche Eke", "#16B364")],
  "Partnerships": [P("Aisha Bello", "#16B364"), E("E-0165"), P("Gbenga Oyedepo", "#AF52DE")],
};

/** The six FR-076 surfaces every skill powers — one rating scale across all. */
const POWERS: { label: string; icon: string; go: string }[] = [
  { label: "JD rubrics", icon: "file", go: "planning" },
  { label: "Screening", icon: "filter", go: "screening" },
  { label: "Scorecards", icon: "clipboard", go: "shortlist" },
  { label: "Reviews", icon: "star", go: "reviews" },
  { label: "Growth", icon: "trend", go: "growth" },
  { label: "Mobility", icon: "swap", go: "mobility" },
];

/** Same skill, three surfaces, one 1–5 anchor scale (FR-076 "comparable everywhere"). */
const AT_WORK = [
  { surface: "Hiring scorecard", icon: "clipboard", tone: "blue" as PfTone, score: 4.2, src: "Panel avg · BE-2031 payments loop", go: "shortlist" },
  { surface: "Performance review", icon: "file", tone: "purple" as PfTone, score: 4.0, src: "Q2 2026 cycle · manager + peer", go: "reviews" },
  { surface: "Growth target", icon: "trend", tone: "green" as PfTone, score: 4.5, src: "Staff-track plan · gap +0.5 to close", go: "growth" },
];

const hubLines = (name: string) => (name.includes(" & ") ? [name.split(" & ")[0], "& " + name.split(" & ")[1]] : [name]);

/* -------------------------------- widgets -------------------------------- */

function DemandBar({ demand, color = "#16B364", width = "100%" }: { demand: number; color?: string; width?: number | string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width }}>
      <div style={{ flex: 1, height: 6, borderRadius: 6, background: "var(--pf-n50)", overflow: "hidden" }}>
        <div style={{ width: `${demand}%`, height: "100%", borderRadius: 6, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", letterSpacing: "-.12px", width: 22, textAlign: "right" }}>{demand}</span>
    </div>
  );
}

function SkillRow({ node, selected, onSelect }: { node: SkillNode; selected: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = TIER[tierOf(node.n, node.demand)];
  const trend = trendOf(node.demand);
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        display: "grid", gridTemplateColumns: "minmax(0,1.5fr) 90px minmax(0,1.2fr) 112px 92px", gap: 12, alignItems: "center",
        padding: "11px 20px", borderBottom: "1px solid var(--pf-n50)", cursor: "pointer",
        background: selected ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: selected ? `inset 3px 0 0 ${node.tone}` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: node.tone, flex: "none" }} />
        <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.s}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--pf-n600)" }}>
        <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{node.n}</span> <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>people</span>
      </div>
      <DemandBar demand={node.demand} />
      <div><PfBadge tone={t.tone} dot>{t.label}</PfBadge></div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: TREND_TONE[trend] }}>
        {trend === "Steady"
          ? <span style={{ width: 11, height: 2, borderRadius: 2, background: TREND_TONE[trend], flex: "none" }} />
          : <span style={{ display: "inline-flex", transform: trend === "Cooling" ? "scaleY(-1)" : "none" }}><Ic name="trend" size={12} color={TREND_TONE[trend]} /></span>}
        {trend}
      </div>
    </div>
  );
}

function AtWorkCard({ item, onGo }: { item: (typeof AT_WORK)[number]; onGo: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onGo} style={{ cursor: "pointer" }}>
      <PfCard pad={14} style={{ borderColor: hovered ? "var(--pf-n100)" : "var(--pf-n50)", boxShadow: hovered ? "0 4px 12px -4px #e8e8e8" : "0 1px 3px 0 #f3f3f3" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <PfTile icon={item.icon} tone={item.tone} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{item.surface}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{item.src}</div>
          </div>
          <Ic name="caretright" size={13} color="var(--pf-n300)" />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3, marginTop: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", lineHeight: 1 }}>{item.score.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: "var(--pf-n300)" }}>/5</span>
        </div>
        <div style={{ marginTop: 8 }}><PfSegments score={item.score} tone={item.tone} /></div>
      </PfCard>
    </div>
  );
}

/* --------------------------------- screen -------------------------------- */

export default function SkillsGraph() {
  const go = useGo();
  const toast = useToast();
  const [selected, setSelected] = useState<string>("Payments");
  const [cluster, setCluster] = useState<string>("Engineering");
  const [hover, setHover] = useState<string | null>(null);
  const [tab, setTab] = useState("constellation");

  const sel = nodeOf(selected);
  const selTier = tierOf(sel.n, sel.demand);
  const selMeta = TIER[selTier];
  const holders = HOLDERS[sel.s] ?? [];
  const needsAction = selTier === "critical" || selTier === "gap";
  const evidenceReqs = Math.max(2, Math.round(sel.demand / 25));
  const confidence = 80 + (sel.n % 10);

  const pickSkill = (s: string) => {
    setSelected(s);
    setCluster(nodeOf(s).cluster);
  };

  const openSourcing = () => {
    toast(`AI drafted a sourcing brief for ${sel.s} from the taxonomy profile — review before send`, "ai");
    go("sourcingchat");
  };
  const proposeTraining = () => {
    toast(`AI proposed a ${sel.s} upskilling track for ${holders.length > 0 ? "the nearest-adjacent holders" : "the cluster"} — pending your approval`, "ai");
    go("learning");
  };

  const isLinked = (s: string) => LINKS.some((l) => (l.a === s && l.b === selected) || (l.b === s && l.a === selected));

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0 }}>Skills graph</h1>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--pf-n900)", color: "#fff", borderRadius: 99, padding: "4px 11px", fontSize: 11.5, fontWeight: 500 }}>
              <Ic name="graph" size={12} color="var(--pf-primary-500)" /> One taxonomy · v3.2 · 184 skills
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 4 }}>
            A rating anywhere is comparable everywhere — JDs, screening, scorecards, reviews, growth and mobility draw from one graph.
          </div>
        </div>
        <PfBtn icon="plus" onClick={() => toast("Skill proposal drafted — queued for the Oct 2026 quarterly taxonomy review", "success")}>Propose skill</PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "constellation", label: "Constellation" },
            { key: "supply", label: "Supply vs demand", count: String(NODES.length) },
            { key: "atwork", label: "Taxonomy at work" },
          ]}
        />
      </div>

      {/* ---------------- CONSTELLATION — living graph + skill detail ---------------- */}
      {tab === "constellation" && (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 12, alignItems: "start" }}>
        <PfCard>
          <PfCardHead title="Skill constellation" sub="Top 17 of 184 skills by demand signal — node size = holders, ring weight = market demand">
            <PfBadge tone={CLUSTER_PFTONE[cluster]} dot>{cluster}</PfBadge>
          </PfCardHead>
          <div style={{ padding: "6px 10px 4px" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: "inherit" }}>
              {/* soft quadrant field per hub */}
              {SKILL_CLUSTERS.map((c) => {
                const h = HUBS[c.name];
                return <circle key={`f-${c.name}`} cx={h.x} cy={h.y} r={118} fill={c.tone} opacity={c.name === cluster ? 0.05 : 0.02} />;
              })}

              {/* hub → node spokes */}
              {NODES.map((k) => {
                const h = HUBS[k.cluster];
                return <line key={`l-${k.s}`} x1={h.x} y1={h.y} x2={k.x} y2={k.y} stroke={k.tone} strokeOpacity={k.cluster === cluster ? 0.28 : 0.12} strokeWidth={1} />;
              })}

              {/* cross-cluster links */}
              {LINKS.map((l) => {
                const a = nodeOf(l.a), b = nodeOf(l.b);
                const active = selected === l.a || selected === l.b;
                return (
                  <g key={`x-${l.a}`} onClick={() => toast(l.note)} style={{ cursor: "pointer" }}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={12} />
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={active ? a.tone : "var(--pf-n300)"} strokeOpacity={active ? 0.85 : 0.55} strokeWidth={active ? 1.6 : 1.1} strokeDasharray="5 4" />
                    <title>{l.note}</title>
                  </g>
                );
              })}

              {/* cluster hubs */}
              {SKILL_CLUSTERS.map((c) => {
                const h = HUBS[c.name];
                const lines = hubLines(c.name);
                const people = c.skills.reduce((a, k) => a + k.n, 0);
                const two = lines.length === 2;
                return (
                  <g key={`h-${c.name}`} onClick={() => setCluster(c.name)} style={{ cursor: "pointer" }} opacity={c.name === cluster ? 1 : 0.55}>
                    <circle cx={h.x} cy={h.y} r={34} fill="#fff" stroke={c.tone} strokeWidth={c.name === cluster ? 1.8 : 1.2} />
                    <circle cx={h.x} cy={h.y} r={34} fill={c.tone} opacity={0.08} />
                    {lines.map((ln, i) => (
                      <text key={ln} x={h.x} y={h.y + (two ? -6 + i * 13 : -1)} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={c.tone}>{ln}</text>
                    ))}
                    <text x={h.x} y={h.y + (two ? 20 : 14)} textAnchor="middle" fontSize={9} fill="var(--pf-n400)">{people} people</text>
                    <title>{c.name} — focus cluster</title>
                  </g>
                );
              })}

              {/* skill nodes */}
              {NODES.map((k) => {
                const isSel = k.s === selected;
                const isHov = k.s === hover;
                const linked = isLinked(k.s);
                const dim = k.cluster !== cluster && !isSel && !linked;
                const ring = 1 + k.demand / 26; // ring stroke ∝ demand
                return (
                  <g
                    key={k.s}
                    onClick={() => pickSkill(k.s)}
                    onMouseEnter={() => setHover(k.s)}
                    onMouseLeave={() => setHover(null)}
                    style={{ cursor: "pointer" }}
                    opacity={dim ? 0.45 : 1}
                  >
                    {(isSel || isHov) && <circle cx={k.x} cy={k.y} r={k.r + 7} fill="none" stroke={k.tone} strokeOpacity={isSel ? 0.3 : 0.18} strokeWidth={5} />}
                    <circle cx={k.x} cy={k.y} r={k.r} fill={isSel ? k.tone : "#fff"} stroke={k.tone} strokeWidth={ring} />
                    {!isSel && <circle cx={k.x} cy={k.y} r={k.r} fill={k.tone} opacity={0.08} />}
                    <text x={k.x} y={k.y + 3.5} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={isSel ? "#fff" : k.tone}>{k.n}</text>
                    <text x={k.x} y={k.y + k.r + 12} textAnchor="middle" fontSize={10} fontWeight={isSel ? 600 : 400} fill={isSel ? "var(--pf-n900)" : "var(--pf-n500)"}>{k.s}</text>
                    <title>{`${k.s} — ${k.n} holders · demand ${k.demand}/100`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 20px 13px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--pf-n100)" }} /> size = holders</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: "50%", border: "2.5px solid var(--pf-n300)" }} /> ring = demand</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 16, borderTop: "1.5px dashed var(--pf-n300)" }} /> cross-cluster link</span>
            <span style={{ marginLeft: "auto" }}>Click a hub to focus · click a node for detail</span>
          </div>
        </PfCard>

        {/* Right rail — skill detail + cluster coverage */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 16 }}>
          <PfCard>
            <PfCardHead title={sel.s} sub={`Taxonomy node · ${sel.cluster} cluster`}>
              <PfBadge tone={CLUSTER_PFTONE[sel.cluster]} dot>{selMeta.label}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 20px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{sel.n}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>verified holders</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginBottom: 5 }}>Market demand score</div>
                  <DemandBar demand={sel.demand} color={selTier === "critical" ? "#E81E17" : "#16B364"} />
                </div>
              </div>

              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", margin: "16px 0 8px" }}>Top holders</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {holders.map((h) => (
                  <button
                    key={h.name}
                    onClick={() => (h.real ? go("employee") : go("people"))}
                    style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 7px", margin: "0 -7px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pf-n25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <PfAvatar init={h.init} tone={h.tone} size={26} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{h.name}</span>
                    <Ic name="caretright" size={12} color="var(--pf-n300)" />
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", margin: "15px 0 8px" }}>Powers — six surfaces, one scale</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {POWERS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => go(p.go)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <Ic name={p.icon} size={12} color="var(--pf-n400)" /> {p.label}
                  </button>
                ))}
              </div>

              {/* Gap flag / supply note */}
              <div style={{ marginTop: 15, borderRadius: 10, border: `1px solid ${needsAction ? (selTier === "critical" ? "var(--pf-red-100)" : "var(--pf-yellow-100)") : "var(--pf-primary-100)"}`, background: needsAction ? (selTier === "critical" ? "var(--pf-red-50)" : "var(--pf-yellow-50)") : "var(--pf-primary-50)", padding: "11px 12px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Ic name={needsAction ? "warning" : "check"} size={14} color={needsAction ? (selTier === "critical" ? "var(--pf-red-500)" : "var(--pf-yellow-500)") : "var(--pf-primary-500)"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>
                      {selTier === "critical" && `${sel.s}: demand ${sel.demand} vs ${sel.n} holders — critical gap`}
                      {selTier === "gap" && `${sel.s}: demand ${sel.demand} vs ${sel.n} holders — supply stretched`}
                      {selTier === "balanced" && `${sel.s}: ${sel.n} holders track demand ${sel.demand} — balanced`}
                      {selTier === "surplus" && `${sel.s}: ${sel.n} holders vs demand ${sel.demand} — healthy surplus`}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 3, lineHeight: 1.45 }}>
                      {needsAction
                        ? `Evidence: ${evidenceReqs} open reqs reference it · rating coverage thin in reviews · confidence ${confidence}%`
                        : `Evidence: rating coverage healthy across reviews & scorecards · confidence ${confidence}%`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  {needsAction ? (
                    <>
                      <PfBtn small variant="primary" icon="search" onClick={openSourcing} style={{ flex: 1 }}>Open sourcing</PfBtn>
                      <PfBtn small icon="book" onClick={proposeTraining} style={{ flex: 1 }}>Propose training</PfBtn>
                    </>
                  ) : (
                    <PfBtn small full icon="swap" onClick={() => go("mobility")}>Find internal matches</PfBtn>
                  )}
                </div>
              </div>
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead title="Cluster coverage" sub="Supply coverage index vs demand" />
            <div style={{ padding: "12px 20px 15px", display: "flex", flexDirection: "column", gap: 11 }}>
              {SKILL_CLUSTERS.map((c) => {
                const cov = coverageOf(c.name);
                return (
                  <button
                    key={c.name}
                    onClick={() => setCluster(c.name)}
                    style={{ display: "block", width: "100%", border: "none", background: "transparent", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.tone }} />
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: cluster === c.name ? 600 : 500, color: "var(--pf-n900)" }}>{c.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cov >= 75 ? "#16B364" : cov >= 60 ? "#EBA308" : "#E81E17", letterSpacing: "-.12px" }}>{cov}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 6, background: "var(--pf-n50)", overflow: "hidden" }}>
                      <div style={{ width: `${cov}%`, height: "100%", borderRadius: 6, background: c.tone }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </PfCard>
        </div>
      </div>
      )}

      {/* ---------------- SUPPLY VS DEMAND — per-cluster coverage table ---------------- */}
      {tab === "supply" && (
      <PfCard>
        <PfCardHead title="Supply vs demand" sub="Per-cluster coverage — click a row to inspect it in the constellation">
          <PfTabs tabs={SKILL_CLUSTERS.map((c) => c.name)} active={cluster} onChange={setCluster} />
        </PfCardHead>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) 90px minmax(0,1.2fr) 112px 92px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
          <PfTh>Skill</PfTh><PfTh>Holders</PfTh><PfTh>Demand</PfTh><PfTh>Position</PfTh><PfTh>Trend</PfTh>
        </div>
        {NODES.filter((k) => k.cluster === cluster)
          .slice()
          .sort((a, b) => b.demand - a.demand)
          .map((k) => (
            <SkillRow key={k.s} node={k} selected={k.s === selected} onSelect={() => { pickSkill(k.s); setTab("constellation"); }} />
          ))}
        <div style={{ padding: "10px 20px", fontSize: 12, color: "var(--pf-n400)", display: "flex", alignItems: "center", gap: 6 }}>
          <Ic name="sparkle" size={13} color="#AF52DE" />
          AI reads demand from open reqs, market signals and review data — positions are proposals; the taxonomy council disposes.
        </div>
      </PfCard>
      )}

      {/* ---------------- TAXONOMY AT WORK — one scale, three surfaces ---------------- */}
      {tab === "atwork" && (
      <PfCard>
        <PfCardHead title="Taxonomy at work" sub="Distributed systems — the same skill node, rated on the same 1–5 anchors across three surfaces">
          <PfBadge tone="green" dot>Comparable everywhere</PfBadge>
        </PfCardHead>
        <div style={{ padding: "14px 20px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {AT_WORK.map((w) => (
              <AtWorkCard key={w.surface} item={w} onGo={() => go(w.go)} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13 }}>
            <div style={{ flex: 1, borderTop: "1px dashed var(--pf-n100)" }} />
            <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>One skill ID · one anchor scale — hiring 4.2 vs review 4.0 vs growth target 4.5 read on the same ruler</span>
            <div style={{ flex: 1, borderTop: "1px dashed var(--pf-n100)" }} />
          </div>
        </div>
      </PfCard>
      )}

      {/* Governance footer */}
      <PfCard pad="12px 16px" style={{ marginTop: 12, background: "var(--pf-n25)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Ic name="stack" size={15} color="var(--pf-n400)" />
          <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>
            Versioned taxonomy service (FR-076) · Nigerian-first — NYSC, local certs & NDPR-aware · quarterly review, next Oct 2026
          </span>
          <span style={{ flex: 1 }} />
          <PfBadge tone="grey">v3.2 · Jun 2026</PfBadge>
          <PfBtn small icon="file" onClick={() => toast("Changelog v3.2 — 9 skills added, 3 merged, 1 deprecated; all historical ratings remapped")}>Changelog</PfBtn>
        </div>
      </PfCard>
    </div>
  );
}
