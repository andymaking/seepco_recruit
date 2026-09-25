"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfProgress, PfSegments, PfAvatar, PfTh, PfPageTabs, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { REVIEW_CYCLE, EMPLOYEES, type ReviewRow } from "@/data/talentos";

/* ------------------------------------------------------------------ */
/* Local typed content — consistent with the shared Talent OS story.   */
/* ------------------------------------------------------------------ */

type Rec = "Promote" | "Retain" | "Develop";

type PacketBullet = { text: string; value?: string; tone: PfTone; cite: string };
type Packet = { bullets: PacketBullet[]; sources: number; ai: { rec: Rec; conf: number; basis: string } };

/** FR-067 — AI-compiled review packets, every claim cited to a source record. */
const PACKETS: Record<string, Packet> = {
  "Amara Okonkwo": {
    sources: 6,
    ai: { rec: "Promote", conf: 78, basis: "QoH trend + goal attainment + 1-on-1 signals" },
    bullets: [
      { text: "Design-system objective", value: "94%", tone: "green", cite: "Goal O-02·KR1" },
      { text: "Handoff objective lagging", value: "44%", tone: "yellow", cite: "Goal O-02·KR2" },
      { text: "1-on-1 themes: promotion timeline, payments load", tone: "blue", cite: "6 transcripts" },
      { text: "Feedback received: 4 (3 praise, 1 constructive)", tone: "purple", cite: "profile timeline" },
    ],
  },
  "Adaeze Okafor": {
    sources: 5,
    ai: { rec: "Retain", conf: 81, basis: "3-month tenure + strong early goal signal" },
    bullets: [
      { text: "Review-packet UI shipped to 2 partners", value: "80%", tone: "green", cite: "Goal O-03·KR1" },
      { text: "Manager NPS on cycle tracking", value: "62%", tone: "blue", cite: "Goal O-03·KR2" },
      { text: "1-on-1 themes: research bandwidth, partner demos", tone: "blue", cite: "4 transcripts" },
      { text: "Feedback received: 5 (5 praise)", tone: "purple", cite: "profile timeline" },
    ],
  },
  "Zainab Yusuf": {
    sources: 5,
    ai: { rec: "Retain", conf: 66, basis: "Steady attainment, engagement stable at 77" },
    bullets: [
      { text: "Lifecycle reactivation objective", value: "82%", tone: "green", cite: "Goal CM-01·KR2" },
      { text: "Abuja pipeline objective behind", value: "54%", tone: "yellow", cite: "Goal CM-01·KR3" },
      { text: "1-on-1 themes: attribution tooling, Abuja travel load", tone: "blue", cite: "5 transcripts" },
      { text: "Feedback received: 3 (3 praise)", tone: "purple", cite: "profile timeline" },
    ],
  },
  "Ngozi Obi": {
    sources: 4,
    ai: { rec: "Retain", conf: 74, basis: "Consistent delivery, QoH 4.4 holding" },
    bullets: [
      { text: "Month-end close −2 days objective", value: "71%", tone: "green", cite: "Goal FIN-02·KR1" },
      { text: "Power BI self-serve rollout", value: "58%", tone: "yellow", cite: "Goal FIN-02·KR3" },
      { text: "1-on-1 themes: IFRS training, board-pack load", tone: "blue", cite: "4 transcripts" },
      { text: "Feedback received: 3 (3 praise)", tone: "purple", cite: "profile timeline" },
    ],
  },
  "Emeka Nwosu": {
    sources: 6,
    ai: { rec: "Develop", conf: 72, basis: "Attainment 58% + team turnover contagion" },
    bullets: [
      { text: "Rig uptime objective", value: "88%", tone: "green", cite: "Goal OPS-01·KR1" },
      { text: "Crew retention objective lagging", value: "31%", tone: "red", cite: "Goal OPS-01·KR3" },
      { text: "1-on-1 themes: site turnover, roster fatigue", tone: "blue", cite: "5 transcripts" },
      { text: "Feedback received: 2 (1 praise, 1 constructive)", tone: "purple", cite: "profile timeline" },
    ],
  },
  "Halima Sule": {
    sources: 4,
    ai: { rec: "Retain", conf: 84, basis: "Highest attainment on the team this cycle" },
    bullets: [
      { text: "Audit-readiness objective", value: "91%", tone: "green", cite: "Goal HSE-02·KR1" },
      { text: "Training-delivery objective", value: "76%", tone: "blue", cite: "Goal HSE-02·KR2" },
      { text: "1-on-1 themes: NEBOSH renewal, PH site audits", tone: "blue", cite: "3 transcripts" },
      { text: "Feedback received: 4 (4 praise)", tone: "purple", cite: "profile timeline" },
    ],
  },
};

/** Unified 5-point taxonomy — the same competencies scored at hiring (QoH spine). */
const COMPETENCIES = [
  { name: "Craft & technical depth", anchors: ["Needs close support", "Solid on routine work", "Strong across the stack", "Deep expertise, raises the bar", "Recognised authority"] },
  { name: "Execution & ownership", anchors: ["Misses commitments", "Delivers with reminders", "Reliable end-to-end", "Owns outcomes beyond scope", "Multiplies team delivery"] },
  { name: "Collaboration", anchors: ["Works apart from the team", "Cooperates when asked", "Reliable partner", "Actively unblocks others", "Builds bridges across teams"] },
  { name: "Communication", anchors: ["Hard to follow", "Clear in routine updates", "Clear and concise", "Tailors to any audience", "Sets the standard"] },
  { name: "Leadership & mentoring", anchors: ["Not yet visible", "Supports peers ad hoc", "Mentors consistently", "Grows others deliberately", "Force multiplier"] },
];

const REC_TONE: Record<Rec, PfTone> = { Promote: "green", Retain: "blue", Develop: "yellow" };
const scoreTone = (v: number): PfTone => (v >= 4 ? "green" : v === 3 ? "blue" : "yellow");
const goalTone = (pct: number): PfTone => (pct >= 75 ? "green" : pct >= 60 ? "blue" : "yellow");

const INIT_SCORES: Record<string, number[]> = {
  "Amara Okonkwo": [4, 5, 4, 0, 0],
  "Adaeze Okafor": [4, 4, 5, 4, 4],
  "Halima Sule": [4, 5, 4, 4, 3],
};

const INIT_NARRATIVE: Record<string, string> = {
  "Amara Okonkwo":
    "Amara carried the payments incident response end-to-end and now mentors two mid-level engineers. The promotion case is strong on craft; the handoff objective (44%) needs a recovery plan agreed before Staff calibration.",
};

const FLAGGED_WORD = "aggressive";

/* ------------------------------------------------------------------ */

function StatusBadge({ s }: { s: "done" | "pending" | "in-progress" | undefined }) {
  if (!s) return <span style={{ fontSize: 12.5, color: "var(--pf-n300)" }}>—</span>;
  if (s === "done") return <PfBadge tone="green" dot>Done</PfBadge>;
  if (s === "in-progress") return <PfBadge tone="blue" dot>In progress</PfBadge>;
  return <PfBadge tone="grey" dot>Pending</PfBadge>;
}

function CiteChip({ cite, onOpen }: { cite: string; onOpen: (c: string) => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={() => onOpen(cite)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "inherit", cursor: "pointer",
        fontSize: 11, fontWeight: 600, color: "var(--pf-purple-500)", lineHeight: 1.2,
        background: hovered ? "var(--pf-purple-50)" : "var(--pf-n0)",
        border: "1px solid var(--pf-purple-100)", borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap",
      }}
    >
      <Ic name="arrowright" size={10} /> {cite}
    </button>
  );
}

const COLS = "minmax(225px,1.55fr) 92px 112px 78px 158px 104px 122px";

function RowItem({ r, selected, onOpen }: { r: ReviewRow; selected: boolean; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        display: "grid", gridTemplateColumns: COLS, alignItems: "center", gap: 10, padding: "10px 20px",
        borderBottom: "1px solid var(--pf-n50)", cursor: "pointer",
        background: selected ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: selected ? "inset 2px 0 0 var(--pf-primary-500)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PfAvatar init={r.init} tone={r.tone} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.role}</div>
        </div>
      </div>
      <div><StatusBadge s={r.self} /></div>
      <div><StatusBadge s={r.manager} /></div>
      <div><StatusBadge s={r.peer} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", width: 34 }}>{r.goalAttainment}%</span>
        <div style={{ width: 68 }}><PfProgress pct={r.goalAttainment} tone={goalTone(r.goalAttainment)} height={6} /></div>
      </div>
      <div>{r.recommendation ? <PfBadge tone={REC_TONE[r.recommendation]}>{r.recommendation}</PfBadge> : <PfBadge tone="grey">—</PfBadge>}</div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600,
            color: selected ? "var(--pf-primary-600)" : "var(--pf-n500)",
            border: `1px solid ${selected ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
            background: selected ? "var(--pf-n0)" : "var(--pf-n0)", borderRadius: 8, padding: "5px 10px", whiteSpace: "nowrap",
          }}
        >
          {selected ? "Reviewing" : "Open review"} <Ic name="caretright" size={11} />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function ReviewCycles() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("cycle");
  const [rows, setRows] = useState<ReviewRow[]>(REVIEW_CYCLE.rows);
  const [selName, setSelName] = useState(REVIEW_CYCLE.rows[0].name); // Amara by default
  const [scores, setScores] = useState<Record<string, number[]>>(INIT_SCORES);
  const [narratives, setNarratives] = useState<Record<string, string>>(INIT_NARRATIVE);
  const [recs, setRecs] = useState<Record<string, Rec | undefined>>(() =>
    Object.fromEntries(REVIEW_CYCLE.rows.map((r) => [r.name, r.recommendation]))
  );

  const sel = rows.find((r) => r.name === selName) ?? rows[0];
  const emp = EMPLOYEES.find((e) => e.name === sel.name);
  const packet = PACKETS[sel.name] ?? PACKETS["Amara Okonkwo"];
  const selScores = scores[sel.name] ?? [0, 0, 0, 0, 0];
  const narrative = narratives[sel.name] ?? "";
  const selRec = recs[sel.name];

  const flagged = narrative.toLowerCase().includes(FLAGGED_WORD);

  // Live cycle completion — done statuses / defined statuses (starts at 67%).
  const statuses = rows.flatMap((r) => [r.self, r.manager, ...(r.peer ? [r.peer] : [])]);
  const completion = Math.round((statuses.filter((s) => s === "done").length / statuses.length) * 100);

  // Reviews already submitted by the manager — the calibration queue.
  const inCalibration = rows.filter((r) => r.manager === "done").length;

  const dist: { label: string; n: number; tone: PfTone }[] = [
    { label: "Promote", n: rows.filter((r) => r.recommendation === "Promote").length, tone: "green" },
    { label: "Retain", n: rows.filter((r) => r.recommendation === "Retain").length, tone: "blue" },
    { label: "Develop", n: rows.filter((r) => r.recommendation === "Develop").length, tone: "yellow" },
    { label: "Not set", n: rows.filter((r) => !r.recommendation).length, tone: "grey" },
  ];

  const openSource = (cite: string) => toast(`Opens source record — ${cite}`);

  const setScore = (ci: number, v: number) =>
    setScores((prev) => {
      const cur = [...(prev[sel.name] ?? [0, 0, 0, 0, 0])];
      cur[ci] = cur[ci] === v ? 0 : v;
      return { ...prev, [sel.name]: cur };
    });

  const submit = () => {
    if (!selRec) {
      toast("Pick a recommendation before submitting", "danger");
      return;
    }
    const already = sel.manager === "done";
    setRows((prev) => prev.map((r) => (r.name === sel.name ? { ...r, manager: "done", recommendation: selRec } : r)));
    toast(already ? `Review updated — ${sel.name} stays in calibration queue` : `Review submitted — ${sel.name} moves to calibration`, "success");
  };

  const phases: { label: string; mark: string; tone: PfTone; note: string }[] = [
    { label: "Self", mark: "✓", tone: "green", note: "Self-review phase closed Jun 26 — 5 of 6 submitted" },
    { label: "Manager", mark: "●", tone: "blue", note: "Manager phase in progress — closes Fri, Jul 10" },
    { label: "Calibration", mark: "○", tone: "grey", note: "Calibration panel sits Jul 14–16" },
  ];

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Page heading */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 19, fontWeight: 650, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>Review Cycles</div>
        <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 2 }}>
          Run the cycle, score on evidence — the packet is compiled before you open it.
        </div>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "cycle", label: "Cycle & team", count: String(rows.length) },
            { key: "review", label: "Review detail" },
            { key: "calibration", label: "Calibration", count: String(inCalibration) },
          ]}
        />
      </div>

      {/* CYCLE & TEAM — cycle header, team list, cycle dates */}
      {tab === "cycle" && (
        <>
          {/* ------------------------- Cycle header card ------------------------- */}
          <PfCard style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", flexWrap: "wrap" }}>
              <PfTile icon="file" tone="green" size={34} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 650, color: "var(--pf-n900)" }}>{REVIEW_CYCLE.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 1 }}>Closes {REVIEW_CYCLE.closes} · 6 reports in your span</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
                {phases.map((p, i) => (
                  <span key={p.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => toast(p.note)}
                      style={{
                        fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                        fontSize: 12, fontWeight: 600, color: TONE[p.tone].fg, background: TONE[p.tone].soft,
                        border: "1px solid transparent", borderRadius: 999, padding: "4px 11px",
                      }}
                    >
                      {p.label} <span style={{ fontSize: 10 }}>{p.mark}</span>
                    </button>
                    {i < phases.length - 1 && <Ic name="caretright" size={11} color="var(--pf-n300)" />}
                  </span>
                ))}
              </div>
              <span style={{ flex: 1 }} />
              <div style={{ minWidth: 150 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".04em", textTransform: "uppercase" }}>Completion</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{completion}%</span>
                </div>
                <PfProgress pct={completion} tone="green" />
              </div>
              <PfBtn variant="secondary" icon="gear" onClick={() => toast("Cycle settings — Q2 2026 · Mid-year cycle")}>Configure cycle</PfBtn>
            </div>
          </PfCard>

          {/* ----------------------------- Team list ----------------------------- */}
          <PfCard style={{ marginBottom: 12, overflow: "hidden" }}>
            <PfCardHead title="Team reviews" sub="FR-066 · one cycle, three phases — pick a report to open their review." />
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 10, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Employee</PfTh>
              <PfTh>Self</PfTh>
              <PfTh>Manager</PfTh>
              <PfTh>Peer</PfTh>
              <PfTh>Goal attainment</PfTh>
              <PfTh>Recommendation</PfTh>
              <PfTh style={{ textAlign: "right" }} />
            </div>
            {rows.map((r) => (
              <RowItem key={r.name} r={r} selected={r.name === sel.name} onOpen={() => { setSelName(r.name); setTab("review"); }} />
            ))}
          </PfCard>

          {/* Cycle meta */}
          <div style={{ maxWidth: 430 }}>
            <PfCard>
              <PfCardHead title="Cycle dates" sub="Q2 2026 · Mid-year" />
              <div style={{ padding: "6px 0" }}>
                {[
                  { icon: "check", tone: "green" as PfTone, label: "Self-review window", value: "Closed Jun 26" },
                  { icon: "clock", tone: "blue" as PfTone, label: "Manager reviews due", value: REVIEW_CYCLE.closes },
                  { icon: "users", tone: "grey" as PfTone, label: "Calibration panel", value: "Jul 14 – 16" },
                  { icon: "chat", tone: "grey" as PfTone, label: "Outcomes shared", value: "Jul 21" },
                ].map((m, i) => (
                  <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", borderBottom: i < 3 ? "1px solid var(--pf-n50)" : "none" }}>
                    <PfTile icon={m.icon} tone={m.tone} size={24} />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n500)", flex: 1 }}>{m.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </PfCard>
          </div>
        </>
      )}

      {/* REVIEW DETAIL — packet + scoring for the selected report */}
      {tab === "review" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 304px", gap: 12, alignItems: "start" }}>
          {/* LEFT — form sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {/* AI review packet (FR-067) */}
            <PfCard style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 18px 0" }}>
                <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "var(--pf-purple-500)" }}>✦ COMPILED BY AI · EVERY CLAIM CITED</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>recompiled 2h ago</span>
                <PfBtn small variant="secondary" onClick={() => toast(`Packet recompiled from ${packet.sources} sources — every claim re-cited`, "ai")}>Recompile</PfBtn>
              </div>
              <div style={{ padding: "12px 18px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px", lineHeight: 1 }}>{sel.goalAttainment}%</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Goal attainment · Q2 objectives</div>
                    <div style={{ width: 170, marginTop: 5 }}><PfProgress pct={sel.goalAttainment} tone={goalTone(sel.goalAttainment)} height={6} /></div>
                  </div>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)", textAlign: "right" }}>{packet.sources} source records<br />nothing leaves the workspace (NDPR)</span>
                </div>
                <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10 }}>
                  {packet.bullets.map((b, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 13px", borderBottom: i < packet.bullets.length - 1 ? "1px solid var(--pf-n50)" : "none", flexWrap: "wrap" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[b.tone].bg, flex: "none" }} />
                      <span style={{ fontSize: 13, color: "var(--pf-n600)" }}>
                        {b.text}{b.value && <b style={{ color: "var(--pf-n900)", fontWeight: 650 }}> {b.value}</b>}
                      </span>
                      <span style={{ flex: 1 }} />
                      <CiteChip cite={b.cite} onOpen={openSource} />
                    </div>
                  ))}
                </div>
              </div>
            </PfCard>

            {/* Competency scoring */}
            <PfCard>
              <PfCardHead title="Competency scoring" sub="Same 5-point taxonomy used at hiring — scores stay comparable across the record spine.">
                <PfBadge tone="grey">1–5 · unified taxonomy</PfBadge>
              </PfCardHead>
              <div>
                {COMPETENCIES.map((c, ci) => {
                  const v = selScores[ci] ?? 0;
                  return (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderBottom: ci < COMPETENCIES.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: v ? TONE[scoreTone(v)].fg : "var(--pf-n300)", marginTop: 1 }}>
                          {v ? c.anchors[v - 1] : "Not scored — tap a dot"}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {[1, 2, 3, 4, 5].map((n) => {
                          const filled = n <= v;
                          return (
                            <button
                              key={n}
                              onClick={() => setScore(ci, n)}
                              aria-label={`${c.name} — ${n} of 5`}
                              style={{
                                width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontFamily: "inherit",
                                fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center",
                                background: filled ? TONE[scoreTone(v)].bg : "var(--pf-n0)",
                                color: filled ? "#fff" : "var(--pf-n400)",
                                border: filled ? "1px solid transparent" : "1px solid var(--pf-n100)",
                                transition: "background .15s ease",
                              }}
                            >
                              {n}
                            </button>
                          );
                        })}
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: v ? "var(--pf-n900)" : "var(--pf-n300)", width: 26, textAlign: "right" }}>
                          {v || "–"}<span style={{ color: "var(--pf-n300)", fontWeight: 400 }}>/5</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </PfCard>

            {/* Narrative */}
            <PfCard>
              <PfCardHead title="Narrative" sub={`Manager summary — shared with ${sel.name.split(" ")[0]} after calibration.`} />
              <div style={{ padding: "14px 20px 16px" }}>
                <textarea
                  value={narrative}
                  onChange={(e) => setNarratives((prev) => ({ ...prev, [sel.name]: e.target.value }))}
                  placeholder="Summarise impact, growth and the support they need next…"
                  style={{
                    width: "100%", minHeight: 108, resize: "vertical", boxSizing: "border-box",
                    fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.55, color: "var(--pf-n900)",
                    border: `1px solid ${flagged ? "var(--pf-yellow-500)" : "var(--pf-n100)"}`, borderRadius: 10, padding: "11px 13px",
                    outline: "none", background: "var(--pf-n0)",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9 }}>
                  {flagged ? (
                    <>
                      <Ic name="warning" size={14} color="var(--pf-yellow-500)" />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#B87F06" }}>
                        “aggressive” flagged — gender-coded in reviews. Try “direct”, or cite the specific behaviour.
                      </span>
                    </>
                  ) : (
                    <>
                      <Ic name="check" size={14} color="var(--pf-primary-500)" />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-600)" }}>Inclusive-language check passed</span>
                    </>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Stage-2 language model · runs on the draft, nothing stored until submit</span>
                </div>
              </div>
            </PfCard>

            {/* Recommendation + submit */}
            <PfCard>
              <PfCardHead title="Recommendation" sub="AI proposes, you decide — the packet never auto-scores anyone." />
              <div style={{ padding: "14px 20px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {(["Promote", "Retain", "Develop"] as Rec[]).map((r) => {
                    const active = selRec === r;
                    const t = TONE[REC_TONE[r]];
                    return (
                      <button
                        key={r}
                        onClick={() => setRecs((prev) => ({ ...prev, [sel.name]: r }))}
                        style={{
                          fontFamily: "inherit", cursor: "pointer", fontSize: 13, fontWeight: 600,
                          padding: "7px 16px", borderRadius: 999,
                          background: active ? t.soft : "var(--pf-n0)",
                          color: active ? t.fg : "var(--pf-n500)",
                          border: `1px solid ${active ? t.fg : "var(--pf-n100)"}`,
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                  <span style={{ flex: 1 }} />
                  <PfBtn variant="primary" icon="check" onClick={submit}>{sel.manager === "done" ? "Update review" : "Submit review"}</PfBtn>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11 }}>
                  <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                    AI leans <b style={{ color: "var(--pf-purple-500)" }}>{packet.ai.rec}</b> · confidence {packet.ai.conf}% · based on {packet.ai.basis}
                  </span>
                </div>
              </div>
            </PfCard>
          </div>

          {/* RIGHT — person rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Person card */}
            <PfCard>
              <div style={{ padding: "16px 18px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <PfAvatar init={sel.init} tone={sel.tone} size={42} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 650, color: "var(--pf-n900)" }}>{sel.name}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>{sel.role}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
                  {emp && <PfBadge tone="grey">{emp.dept}</PfBadge>}
                  {emp && <PfBadge tone="grey">{emp.grade} · {emp.tenure}</PfBadge>}
                  {emp && <PfBadge tone="grey">{emp.loc}</PfBadge>}
                </div>
                <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)" }}>Quality of hire</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)" }}>
                      {emp?.qoh ? `${emp.qoh}/5` : "—"}
                    </span>
                  </div>
                  {emp?.qoh && <div style={{ marginTop: 6 }}><PfSegments score={emp.qoh} /></div>}
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.45 }}>
                    {emp?.qoh
                      ? "From the hiring scorecard — the same taxonomy this review scores against. One record spine."
                      : "Hired pre-platform — no hiring scorecard on record."}
                  </div>
                  {emp?.qoh && (
                    <button
                      onClick={() => toast(`Opens hiring scorecard — ${emp.hiredVia ?? "hiring record"}`)}
                      style={{ fontFamily: "inherit", cursor: "pointer", background: "none", border: "none", padding: 0, marginTop: 6, fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)", display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      View hiring scorecard <Ic name="arrowright" size={11} />
                    </button>
                  )}
                </div>
                <PfBtn variant="secondary" full icon="user" style={{ marginTop: 10 }} onClick={() => go("employee")}>Open full profile</PfBtn>
              </div>
            </PfCard>

            {/* Switch report */}
            <PfBtn variant="secondary" full icon="users" onClick={() => setTab("cycle")}>Pick another report</PfBtn>
          </div>
        </div>
      )}

      {/* CALIBRATION — spread across the span */}
      {tab === "calibration" && (
        <div style={{ maxWidth: 520 }}>
          <PfCard>
            <PfCardHead title="HR calibration view" sub="Recommendation spread across your 6 reports." />
            <div style={{ padding: "13px 18px 16px" }}>
              {dist.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                  <span style={{ fontSize: 12, color: "var(--pf-n500)", width: 56, flex: "none" }}>{d.label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 6, background: "var(--pf-n50)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.n / rows.length) * 100}%`, background: TONE[d.tone].bg, borderRadius: 6, transition: "width .3s ease" }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--pf-n900)", width: 14, textAlign: "right" }}>{d.n}</span>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.45, margin: "4px 0 11px" }}>
                Calibration flags outliers before outcomes lock — distribution updates as you submit.
              </div>
              <PfBtn variant="secondary" full icon="filter" onClick={() => toast(`${sel.name} flagged for the Jul 14 calibration panel`)}>Flag for calibration</PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
