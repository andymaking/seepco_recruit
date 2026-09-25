"use client";
import { useEffect, useRef, useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfTile, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { PLAYBOOKS, MOBILITY } from "@/data/talentos";

/* ---------------------------------- Loops ----------------------------------
   PRD §2.3 — the four loops that compound. Point tools break these loops;
   owning all three pillars closes them. Each loop renders as an SVG ring of
   stage nodes with directional arrows and an orbiting "packet" of data.      */

type LoopId = "req" | "quality" | "mobility" | "retention";
type Focus = LoopId | "all";

type LoopNode = { label: string; go: string };
type Loop = {
  id: LoopId; name: string; short: string; icon: string; tone: PfTone;
  sub: string; badge: string; badgeTone: PfTone;
  nodes: LoopNode[];
  stat: { value: string; sub: string; tag: string; tagTone: PfTone };
  dur: number; delay: number; // packet orbit speed / phase
};

const REQ_LOOP: Loop = {
  id: "req", name: "Requisition loop", short: "Requisition", icon: "target", tone: "blue",
  sub: "3 requisitions in flight this week", badge: "On SLA", badgeTone: "green",
  nodes: [
    { label: "Gap detected", go: "headcount" },
    { label: "AI business case", go: "planning" },
    { label: "Approval", go: "planning" },
    { label: "Stage-1 role", go: "planning" },
  ],
  stat: { value: "3.8d", sub: "gap → opening · target ≤ 5d", tag: "✓ On target", tagTone: "green" },
  dur: 7, delay: 0,
};

const QUALITY_LOOP: Loop = {
  id: "quality", name: "Quality flywheel", short: "Quality", icon: "star", tone: "purple",
  sub: "141 outcome labels fed back YTD", badge: "Learning", badgeTone: "purple",
  nodes: [
    { label: "Hire", go: "onboarding" },
    { label: "90-day QoH", go: "posthire" },
    { label: "Outcome labels", go: "posthire" },
    { label: "Screening model", go: "screening" },
  ],
  stat: { value: "+5pp", sub: "screening lift, YoY", tag: "Compounding", tagTone: "purple" },
  dur: 9, delay: -3.2,
};

const MOBILITY_LOOP: Loop = {
  id: "mobility", name: "Mobility loop", short: "Mobility", icon: "swap", tone: "green",
  sub: `${MOBILITY.length} internal matches live`, badge: "On target", badgeTone: "green",
  nodes: [
    { label: "Growth plan", go: "growth" },
    { label: "Internal match", go: "mobility" },
    { label: "Internal fill", go: "mobility" },
  ],
  stat: { value: "25%", sub: "internal fill rate", tag: "✓ On target", tagTone: "green" },
  dur: 6, delay: -1.4,
};

const RETENTION_LOOP: Loop = {
  id: "retention", name: "Retention loop", short: "Retention", icon: "lifebuoy", tone: "yellow",
  sub: `${PLAYBOOKS.length} playbooks running now`, badge: `${PLAYBOOKS.length} in play`, badgeTone: "yellow",
  nodes: [
    { label: "Risk flag", go: "attrition" },
    { label: "Playbook", go: "retention" },
    { label: "Save", go: "retention" },
    { label: "Model retrains", go: "attrition" },
  ],
  stat: { value: "43%", sub: "save rate on flagged risks", tag: "✓ Healthy", tagTone: "green" },
  dur: 8, delay: -5.1,
};

const LOOPS: Loop[] = [REQ_LOOP, QUALITY_LOOP, MOBILITY_LOOP, RETENTION_LOOP];
const LOOP_BY_ID: Record<LoopId, Loop> = { req: REQ_LOOP, quality: QUALITY_LOOP, mobility: MOBILITY_LOOP, retention: RETENTION_LOOP };

/** Loop-health chips for the KPI footer (values mirror the ring centers). */
const FOOT: Record<LoopId, { value: string; note: string }> = {
  req: { value: "3.8d", note: "≤ 5d ✓" },
  quality: { value: "+5pp", note: "lift YoY" },
  mobility: { value: "25%", note: "fill ✓" },
  retention: { value: "43%", note: "saves ✓" },
};

/* ------------------------------- Event stream ------------------------------ */

type LoopEvent = { t: string; loop: LoopId; text: string; go: string };

/** Today's stream, newest first — names/numbers match the shared story. */
const INITIAL_EVENTS: LoopEvent[] = [
  { t: "09:38", loop: "retention", text: "Save recorded: L5 band adjustment approved — model retrain queued", go: "retention" },
  { t: "09:15", loop: "mobility", text: "87% match surfaced: Amara Okonkwo ↔ Staff Engineer (Platform)", go: "mobility" },
  { t: "09:02", loop: "mobility", text: "Growth plan opened for Halima Sule — HSE Manager track", go: "growth" },
  { t: "08:47", loop: "quality", text: "Chidi Okeke day-30 QoH check-in scored 4.2/5 — label queued", go: "posthire" },
  { t: "08:22", loop: "req", text: "Staff Engineer (Platform) — approval 2 of 3 signed", go: "planning" },
  { t: "08:05", loop: "req", text: "Field Ops gap (−4 rotation cover) → AI business case drafted", go: "planning" },
  { t: "07:40", loop: "retention", text: "Amara playbook PB-31 — growth-conversation step completed", go: "retention" },
  { t: "06:48", loop: "retention", text: "Risk rescore: Emeka Nwosu 71 → 68 after rotation proposal", go: "attrition" },
  { t: "05:30", loop: "quality", text: "Screening model v2.4 nightly eval — precision +0.3pp", go: "screening" },
  { t: "04:12", loop: "quality", text: "47 screened, 12 shortlisted — overnight batch", go: "screening" },
];

/** Rotating pool the live stream draws from while auto-refresh is on. */
const POOL: Omit<LoopEvent, "t">[] = [
  { loop: "quality", text: "QoH labels (3) fed to screening model — retrain scheduled 02:00", go: "screening" },
  { loop: "req", text: "Approval complete: Staff Engineer (Platform) → opening in Stage 1", go: "planning" },
  { loop: "mobility", text: "Internal fill confirmed: Product Ops Lead — Zainab Yusuf (74% match)", go: "mobility" },
  { loop: "retention", text: "New risk flag: Drilling Support technician · 60d horizon (score 64)", go: "attrition" },
  { loop: "quality", text: "Day-90 QoH survey sent for Chidi Okeke — manager + peer raters", go: "posthire" },
  { loop: "req", text: "Field Ops rotation cover (×2) posted — live on 4 channels", go: "planning" },
];

const SERVICES = [
  { name: "workforce-analytics", note: "anomaly & risk scoring", detail: "workforce-analytics · 99.98% uptime (30d) · p95 210ms — consumers healthy" },
  { name: "performance", note: "reviews · goals · QoH labels", detail: "performance · 99.95% uptime (30d) · p95 140ms — consumers healthy" },
  { name: "learning", note: "growth plans · skills graph", detail: "learning · 99.97% uptime (30d) · p95 180ms — consumers healthy" },
];

/* -------------------------------- Geometry --------------------------------- */

const R = 76; // ring radius inside the 200×200 SVG
const rad = (d: number) => (d * Math.PI) / 180;
/** Node angles: 4-node loops sit on the diagonals (labels clear the center stat); 3-node loops sit top + lower flanks. */
const angleAt = (n: number, i: number): number => (n === 3 ? [-90, 40, 140] : [-45, 45, 135, 225])[i] ?? -90;

/* ---------------------------------- Bits ----------------------------------- */

function NodePill({ label, x, y, tone, onGo }: { label: string; x: number; y: number; tone: PfTone; onGo: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[tone];
  return (
    <button
      {...hoverProps}
      onClick={(e) => { e.stopPropagation(); onGo(); }}
      style={{
        position: "absolute", left: `calc(50% + ${x.toFixed(1)}px)`, top: `calc(50% + ${y.toFixed(1)}px)`,
        transform: "translate(-50%,-50%)", zIndex: 2,
        fontFamily: "inherit", fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: "nowrap",
        color: hovered ? "#fff" : "var(--pf-n600)",
        background: hovered ? t.bg : "var(--pf-n0)",
        border: `1px solid ${hovered ? t.bg : t.line}`,
        borderRadius: 999, padding: "3.5px 9px", cursor: "pointer",
        boxShadow: "0 1px 3px rgba(2,6,23,.07)", transition: "all .15s ease",
      }}
    >
      {label}
    </button>
  );
}

function LoopCard({ loop, focus, live, onSelect, onNode }: {
  loop: Loop; focus: Focus; live: boolean; onSelect: (id: LoopId) => void; onNode: (stage: string) => void;
}) {
  const t = TONE[loop.tone];
  const sel = focus === loop.id;
  const dim = focus !== "all" && !sel;
  const n = loop.nodes.length;
  const playState = live ? "running" : "paused";
  return (
    <div
      onClick={() => onSelect(loop.id)}
      style={{
        background: "var(--pf-n0)",
        border: `1px solid ${sel ? t.fg : "var(--pf-n50)"}`,
        borderRadius: 12, overflow: "hidden", cursor: "pointer",
        boxShadow: sel ? `0 0 0 3px ${t.soft}, 0 1px 3px 0 #f3f3f3` : "0 1px 3px 0 #f3f3f3",
        opacity: dim ? 0.55 : 1,
        transition: "opacity .25s ease, border-color .2s ease, box-shadow .2s ease",
      }}
    >
      {/* Head */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTile icon={loop.icon} tone={loop.tone} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loop.name}</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loop.sub}</div>
        </div>
        <PfBadge tone={loop.badgeTone} dot>{loop.badge}</PfBadge>
      </div>

      {/* Ring diagram */}
      <div style={{ position: "relative", height: 224 }}>
        <svg width={200} height={200} viewBox="0 0 200 200" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          {/* track + flowing ticks */}
          <circle cx={100} cy={100} r={R} fill="none" stroke={t.line} strokeWidth={1.5} />
          <circle
            cx={100} cy={100} r={R} fill="none" stroke={t.fg} strokeWidth={1.5}
            strokeDasharray="3 7" opacity={0.35}
            style={{ animation: "mcFlow 1s linear infinite", animationPlayState: playState }}
          />
          {/* directional arrowheads at segment midpoints */}
          {loop.nodes.map((_, i) => {
            const a1 = angleAt(n, i);
            const a2 = angleAt(n, (i + 1) % n);
            const mid = a1 + ((a2 - a1 + 360) % 360) / 2;
            const x = 100 + R * Math.cos(rad(mid));
            const y = 100 + R * Math.sin(rad(mid));
            return (
              <path
                key={i} d="M-4.4 -3.4 L4.8 0 L-4.4 3.4 Z" fill={t.fg} opacity={0.9}
                transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(mid + 90).toFixed(1)})`}
              />
            );
          })}
          {/* orbiting data packet */}
          <g style={{ animation: `mcOrbit ${loop.dur}s linear infinite`, animationDelay: `${loop.delay}s`, animationPlayState: playState, transformOrigin: "50% 50%", transformBox: "view-box" }}>
            <circle cx={100} cy={100 - R} r={8} fill={t.fg} opacity={0.16} style={{ animation: "pulseDot 1.5s infinite" }} />
            <circle cx={100} cy={100 - R} r={3.6} fill={t.fg} stroke="var(--pf-n0)" strokeWidth={1.2} />
          </g>
        </svg>

        {/* stage nodes (clickable → module) */}
        {loop.nodes.map((node, i) => {
          const a = angleAt(n, i);
          return (
            <NodePill
              key={node.label} label={node.label} tone={loop.tone}
              x={R * Math.cos(rad(a))} y={R * Math.sin(rad(a))}
              onGo={() => onNode(node.go)}
            />
          );
        })}

        {/* center stat */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 124, textAlign: "center", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)", lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{loop.stat.value}</div>
          <div style={{ fontSize: 10.5, color: "var(--pf-n400)", lineHeight: 1.4 }}>{loop.stat.sub}</div>
          <PfBadge tone={loop.stat.tagTone}>{loop.stat.tag}</PfBadge>
        </div>
      </div>
    </div>
  );
}

function FeedChip({ label, tone, active, onClick }: { label: string; tone?: PfTone; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = tone ? TONE[tone] : null;
  return (
    <button
      {...hoverProps} onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit",
        fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, cursor: "pointer",
        background: active ? (t ? t.soft : "var(--pf-n900)") : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        color: active ? (t ? t.fg : "#fff") : "var(--pf-n500)",
        border: `1px solid ${active ? (t ? t.line : "var(--pf-n900)") : "var(--pf-n100)"}`,
        transition: "all .15s ease",
      }}
    >
      {t && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.bg }} />}
      {label}
    </button>
  );
}

function FeedRow({ e, onClick, last }: { e: LoopEvent; onClick: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  const loop = LOOP_BY_ID[e.loop];
  const t = TONE[loop.tone];
  return (
    <div
      {...hoverProps} onClick={onClick}
      style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 16px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)", animation: "scIn .25s ease" }}
    >
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--pf-n300)", fontVariantNumeric: "tabular-nums", marginTop: 2, flex: "none" }}>{e.t}</span>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.bg, marginTop: 5, flex: "none" }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: hovered ? "var(--pf-n900)" : "var(--pf-n600)", lineHeight: 1.5 }}>
        <b style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{loop.short}</b> · {e.text}
      </span>
      <span style={{ marginTop: 2 }}><Ic name="arrowright" size={12} color={hovered ? "var(--pf-primary-600)" : "transparent"} /></span>
    </div>
  );
}

function FootChip({ loop, active, onClick }: { loop: Loop; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[loop.tone];
  const f = FOOT[loop.id];
  return (
    <button
      {...hoverProps} onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", cursor: "pointer",
        background: active ? t.soft : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${active ? t.line : "var(--pf-n100)"}`,
        borderRadius: 9, padding: "6px 11px", transition: "all .15s ease",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.bg, flex: "none" }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{loop.short}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: t.fg, fontVariantNumeric: "tabular-nums" }}>{f.value}</span>
      <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{f.note}</span>
    </button>
  );
}

function ServiceRow({ name, note, right, delay, onClick, last }: {
  name: string; note: string; right: React.ReactNode; delay: number; onClick: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps} onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pf-primary-500)", animation: "pulseDot 2s infinite", animationDelay: `${delay}s`, flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{note}</div>
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------- Screen --------------------------------- */

export default function MissionControl() {
  const go = useGo();
  const toast = useToast();
  const [focus, setFocus] = useState<Focus>("all");
  const [live, setLive] = useState(true);
  const [tab, setTab] = useState("loops");
  const [events, setEvents] = useState<LoopEvent[]>(INITIAL_EVENTS);
  const minuteRef = useRef(9 * 60 + 41); // next injected timestamp: 09:41
  const poolRef = useRef(0);

  // Live stream — while auto-refresh is on, a new loop event lands every 7s.
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => {
      const p = POOL[poolRef.current % POOL.length];
      if (!p) return;
      poolRef.current += 1;
      const m = minuteRef.current;
      minuteRef.current += 3;
      const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      setEvents((ev) => [{ ...p, t }, ...ev].slice(0, 16));
    }, 7000);
    return () => clearInterval(id);
  }, [live]);

  const visible = focus === "all" ? events : events.filter((e) => e.loop === focus);

  const toggleLive = () => {
    const next = !live;
    setLive(next);
    toast(
      next ? "Live stream resumed — subscribed to loop events on Kafka" : "Live stream paused — packets frozen, feed holds at last event",
      next ? "success" : "default",
    );
  };

  const selectLoop = (id: LoopId) => {
    const next: Focus = focus === id ? "all" : id;
    setFocus(next);
    toast(next === "all" ? "Showing events from all four loops" : `Event feed filtered to the ${LOOP_BY_ID[id].name}`);
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <style>{`
        @keyframes mcOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes mcFlow { to { stroke-dashoffset: -10; } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Mission control</span>
            <button
              onClick={toggleLive}
              title={live ? "Pause the live stream" : "Resume the live stream"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", cursor: "pointer",
                fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", padding: "3px 9px", borderRadius: 999,
                color: live ? "var(--pf-primary-600)" : "var(--pf-n400)",
                background: live ? "var(--pf-primary-50)" : "var(--pf-n50)",
                border: `0.6px solid ${live ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "var(--pf-primary-500)" : "var(--pf-n300)", animation: live ? "pulseDot 1.4s infinite" : "none" }} />
              {live ? "LIVE" : "PAUSED"}
            </button>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>The four loops that compound — watch them run.</div>
        </div>
        <PfBtn icon="flask" onClick={() => go("scenarios")}>Scenario studio</PfBtn>
        <PfBtn variant="primary" icon="gauge" onClick={() => go("command")}>Command center</PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "loops", label: "Loop board", count: String(LOOPS.length) },
            { key: "feed", label: "Event feed", count: String(events.length) },
            { key: "status", label: "System status" },
          ]}
        />
      </div>

      {/* LOOP BOARD — the four rings + loop health */}
      {tab === "loops" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            {LOOPS.map((l) => (
              <LoopCard key={l.id} loop={l} focus={focus} live={live} onSelect={selectLoop} onNode={(s) => go(s)} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 11.5, color: "var(--pf-n400)" }}>
            <Ic name="orbit" size={13} color="var(--pf-n300)" />
            Point tools break these loops — owning all three pillars closes them. Click a loop to filter the feed; click a stage to open its module.
          </div>

          {/* KPI footer — loop health */}
          <PfCard style={{ marginTop: 12 }} pad="12px 16px">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {LOOPS.map((l) => (
                <FootChip key={l.id} loop={l} active={focus === l.id} onClick={() => selectLoop(l.id)} />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, color: "var(--pf-n500)" }}>
              <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
              <span><b style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Flywheel effect:</b> every closed loop makes the next hire smarter.</span>
            </div>
          </PfCard>
        </div>
      )}

      {/* EVENT FEED — the live loop stream */}
      {tab === "feed" && (
        <div style={{ maxWidth: 680 }}>
          <PfCard>
            <PfCardHead
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Live event feed
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: live ? "var(--pf-primary-500)" : "var(--pf-n300)", animation: live ? "pulseDot 1.4s infinite" : "none" }} />
                </span>
              }
              sub={live ? "Kafka stream · newest first" : "Paused — holding last events"}
            >
              <PfBadge tone="grey">{visible.length}</PfBadge>
              <PfBtn small icon={live ? "pause" : "play"} onClick={toggleLive}>{live ? "Pause" : "Resume"}</PfBtn>
            </PfCardHead>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "10px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
              <FeedChip label="All" active={focus === "all"} onClick={() => setFocus("all")} />
              {LOOPS.map((l) => (
                <FeedChip key={l.id} label={l.short} tone={l.tone} active={focus === l.id} onClick={() => setFocus(l.id)} />
              ))}
            </div>
            {visible.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--pf-n400)" }}>
                No {focus !== "all" ? `${LOOP_BY_ID[focus].short.toLowerCase()} ` : ""}events in the current window.
              </div>
            ) : (
              visible.map((e, i) => (
                <FeedRow key={`${e.t}-${e.loop}-${i}`} e={e} last={i === visible.length - 1} onClick={() => go(e.go)} />
              ))
            )}
          </PfCard>
        </div>
      )}

      {/* SYSTEM STATUS — loop infrastructure */}
      {tab === "status" && (
        <div style={{ maxWidth: 640 }}>
          <PfCard>
            <PfCardHead title="System status" sub="Loop infrastructure — all pillars connected">
              <PfBadge tone="green" dot>Operational</PfBadge>
            </PfCardHead>
            {SERVICES.map((s, i) => (
              <ServiceRow
                key={s.name} name={s.name} note={s.note} delay={i * 0.5} last={false}
                right={<PfBadge tone="green" dot>Operational</PfBadge>}
                onClick={() => toast(s.detail, "success")}
              />
            ))}
            <ServiceRow
              name="Event bus — Kafka" note="loop events, exactly-once" delay={1.5} last
              right={<PfBadge tone="grey">1.2k events/day</PfBadge>}
              onClick={() => toast("Kafka event bus — 1,214 loop events in the last 24h · consumer lag 0")}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <Ic name="shield" size={14} color="var(--pf-n400)" />
              <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n500)" }}>Every AI run logged &amp; replayable</span>
              <PfBtn small variant="ghost" onClick={() => go("audit")} style={{ color: "var(--pf-primary-600)" }}>
                Audit log <Ic name="arrowright" size={12} />
              </PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
