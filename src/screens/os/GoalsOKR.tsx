"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfAvatar, PfTabs, PfPageTabs, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { OKRS } from "@/data/talentos";

/**
 * Goals & OKRs — PRD FR-065.
 * Company → department → individual cascade, quarterly cycles, measurable KRs,
 * alignment tree, and AI assist that proposes (never disposes) KR rewrites.
 * Anatomy follows docs/refs/kit-goals-okr.png (quarter tabs, goal rows with
 * ticked progress bars, status badges, owner avatars, expandable key results);
 * the page's sections sit behind in-page tabs — Cascade / Alignment / AI assist.
 */

type GoalStatus = "on-track" | "behind" | "at-risk" | "draft" | "closed";
type KrStatus = "on-track" | "behind" | "at-risk" | "draft";
type Kr = { kr: string; progress: number; status: KrStatus };
type Goal = {
  id: string; level: "Company" | "Department" | "Individual";
  owner: string; sub: string; objective: string; progress: number;
  status: GoalStatus; quarter: string; parent?: string; krs: Kr[];
};

const LEVELS = ["Company", "Department", "Individual"] as const;
const LEVEL_TONE: Record<Goal["level"], PfTone> = { Company: "purple", Department: "blue", Individual: "green" };
const LEVEL_HEX: Record<Goal["level"], string> = { Company: "#AF52DE", Department: "#007AFF", Individual: "#16B364" };

const ST: Record<GoalStatus, { label: string; tone: PfTone }> = {
  "on-track": { label: "On track", tone: "green" },
  behind: { label: "Behind", tone: "yellow" },
  "at-risk": { label: "At risk", tone: "red" },
  draft: { label: "Draft", tone: "grey" },
  closed: { label: "Closed", tone: "green" },
};

/* Cascade context around the 3 shared OKRS — same story as Command/Attrition
   (PH turnover spike, Engineering engagement dip, Amara's payments programme). */
const SUB: Record<string, string> = { "O-01": "Company", "O-02": "Tobi Balogun", "O-03": "Senior Product Designer" };
const PARENT: Record<string, string | undefined> = { "O-02": "O-01", "O-03": "O-02" };

const EXTRA: Goal[] = [
  { id: "O-04", level: "Department", owner: "Engineering", sub: "Ngozi Adeyemi", objective: "Make the payments platform boring — reliable, fast, fully staffed", progress: 54, status: "behind", quarter: "Q3 2026", parent: "O-01", krs: [
    { kr: "Payments uptime ≥ 99.95% (now 99.91%)", progress: 72, status: "on-track" },
    { kr: "Fill 6 open payments roles (3 filled)", progress: 50, status: "behind" },
    { kr: "Engineering engagement back to ≥ 70 (now 68)", progress: 40, status: "behind" },
  ]},
  { id: "O-05", level: "Department", owner: "Field Operations", sub: "Ibrahim Sani", objective: "Turn around Port Harcourt retention", progress: 42, status: "at-risk", quarter: "Q3 2026", parent: "O-01", krs: [
    { kr: "Voluntary exits ≤ 1.6% monthly (now 3.8%)", progress: 22, status: "at-risk" },
    { kr: "Pay-band corrections approved for 12 field roles", progress: 40, status: "behind" },
    { kr: "Rotation roster redesign live at 2 sites", progress: 65, status: "on-track" },
  ]},
  { id: "O-06", level: "Individual", owner: "Amara Okonkwo", sub: "Senior Software Engineer", objective: "Land the payments reliability programme", progress: 66, status: "on-track", quarter: "Q3 2026", parent: "O-04", krs: [
    { kr: "p95 checkout latency ≤ 900ms (now 1.24s)", progress: 74, status: "on-track" },
    { kr: "Incident MTTR ≤ 45 min (now 68 min)", progress: 58, status: "behind" },
  ]},
  { id: "O-07", level: "Individual", owner: "Zainab Yusuf", sub: "Growth Marketing Manager", objective: "Make partner marketing a measurable pipeline engine", progress: 0, status: "draft", quarter: "Q3 2026", krs: [
    { kr: "Qualified partner leads per month (baseline TBD)", progress: 0, status: "draft" },
    { kr: "Campaign → demo conversion (baseline TBD)", progress: 0, status: "draft" },
  ]},
  { id: "O-Q2-1", level: "Company", owner: "Unrealabs", sub: "Company", objective: "Prove the OS with 3 lighthouse energy partners", progress: 100, status: "closed", quarter: "Q2 2026", krs: [
    { kr: "3 lighthouse partners live on Recruit + Manage", progress: 100, status: "on-track" },
    { kr: "Weekly active manager usage ≥ 70% (hit 74%)", progress: 100, status: "on-track" },
  ]},
  { id: "O-Q2-2", level: "Department", owner: "Product & Design", sub: "Tobi Balogun", objective: "Ship review cycles v1 to every partner", progress: 92, status: "closed", quarter: "Q2 2026", parent: "O-Q2-1", krs: [
    { kr: "Cycle completion rate ≥ 90% (hit 94%)", progress: 100, status: "on-track" },
    { kr: "Manager time-per-review ≤ 25 min", progress: 84, status: "on-track" },
  ]},
];

const SEED: Goal[] = [
  ...OKRS.map((o): Goal => ({ ...o, sub: SUB[o.id] ?? "", parent: PARENT[o.id], krs: o.krs.map((k) => ({ ...k })) })),
  ...EXTRA,
];

/* AI-suggested measurable KRs per level (baseline → target, dated). */
const SUGGEST: Record<Goal["level"], [string, string]> = {
  Company: ["Partner NRR 108% → ≥ 120% by Sep 30", "Signed design partners 7 → 10 (contract, not LOI)"],
  Department: ["Cycle time 9.2 → 6.0 days by quarter close", "Quality score ≥ 4.5/5 on 90% of releases"],
  Individual: ["Adoption of owned surface 61% → 75% by Sep 30", "Stakeholder NPS ≥ 40 (baseline 28)"],
};

type Rewrite = { goal: string; idx: number; before: string; after: string; conf: number };
const REWRITES: Rewrite[] = [
  { goal: "O-03", idx: 0, before: "Review-packet UI shipped to 2 partners", after: "2 partners complete a full review cycle in-product (≥ 80% adoption)", conf: 87 },
  { goal: "O-05", idx: 2, before: "Rotation roster redesign live at 2 sites", after: "Rota-cited exit reasons ≤ 5% at the 2 pilot sites", conf: 82 },
];

const initials = (n: string) => {
  const w = n.trim().split(/\s+/).filter((x) => /[A-Za-z0-9]/.test(x[0]));
  return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase();
};
const short = (s: string, n = 38) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const krStatusFor = (p: number): KrStatus => (p >= 60 ? "on-track" : p >= 45 ? "behind" : "at-risk");
const goalStatusFor = (p: number): GoalStatus => (p >= 60 ? "on-track" : p >= 45 ? "behind" : "at-risk");

const INPUT: CSSProperties = { fontFamily: "inherit", fontSize: 13.5, color: "var(--pf-n900)", padding: "9px 12px", border: "1px solid var(--pf-n100)", borderRadius: 8, outline: "none", width: "100%", background: "var(--pf-n0)" };

function Lab({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 6 }}>{children}</div>;
}

/** The kit's goal bar: solid tone fill + finely-ticked remainder. */
function GoalBar({ pct, tone }: { pct: number; tone: PfTone }) {
  return (
    <div style={{ display: "flex", alignItems: "center", height: 7, borderRadius: 4, overflow: "hidden" }}>
      <span style={{ width: `${Math.min(pct, 100)}%`, minWidth: pct > 0 ? 8 : 0, height: "100%", borderRadius: 4, background: TONE[tone].bg, transition: "width .3s ease", flex: "none" }} />
      <span style={{ flex: 1, height: "100%", backgroundImage: "repeating-linear-gradient(90deg, var(--pf-n100) 0 3px, transparent 3px 6px)" }} />
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ fontFamily: "inherit", width: 26, height: 26, borderRadius: 7, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", color: "var(--pf-n600)", fontSize: 15, fontWeight: 600, cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {label}
    </button>
  );
}

/* ------------------------------ Goal card ------------------------------ */

function GoalCard({ g, expanded, onToggle, ck, onCkOpen, onCkStep, onCkSave, onCkClose, onSuggest }: {
  g: Goal; expanded: boolean; onToggle: () => void;
  ck: { goal: string; idx: number; val: number } | null;
  onCkOpen: (idx: number) => void; onCkStep: (d: number) => void; onCkSave: () => void; onCkClose: () => void;
  onSuggest: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const st = ST[g.status];
  const onTrackKrs = g.krs.filter((k) => k.status === "on-track").length;
  const barTone: PfTone = g.status === "draft" ? "grey" : st.tone;
  return (
    <div style={{ position: "relative" }}>
      {/* stub from the cascade rail to the card */}
      <span style={{ position: "absolute", left: -17, top: 31, width: 17, height: 2, background: "var(--pf-n50)" }} />
      <PfCard style={{ boxShadow: hovered ? "0 4px 14px rgba(2,6,23,.06)" : "0 1px 3px 0 #F3F3F3", transition: "box-shadow .15s ease" }}>
        <div {...hoverProps} onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", cursor: "pointer" }}>
          <PfAvatar init={initials(g.owner)} tone={LEVEL_HEX[g.level]} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <PfBadge tone={LEVEL_TONE[g.level]}>{g.level}</PfBadge>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.objective}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4, fontSize: 12, color: "var(--pf-n400)" }}>
              <span>{g.owner}</span>
              {g.sub && <><span style={{ color: "var(--pf-n300)" }}>·</span><span>{g.sub}</span></>}
              <PfBadge tone="grey">{g.quarter}</PfBadge>
              <span>{g.krs.length} KR{g.krs.length === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div style={{ width: 180, flex: "none" }}><GoalBar pct={g.progress} tone={barTone} /></div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums", flex: "none" }}>{g.progress}%</span>
          <PfBadge tone={st.tone} dot>{st.label}</PfBadge>
          <span style={{ display: "inline-flex", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s ease", color: "var(--pf-n300)" }}><Ic name="caretright" size={14} /></span>
        </div>

        {expanded && (
          <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "10px 16px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 8px" }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Key results</span>
              <span style={{ flex: 1 }} />
              {g.krs.length > 0 && <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{onTrackKrs} of {g.krs.length} on track</span>}
            </div>
            {g.krs.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 9, padding: "10px 12px" }}>
                <span style={{ fontSize: 13, color: "var(--pf-n400)", flex: 1 }}>No key results yet — a goal without measures is a wish.</span>
                <PfBtn small variant="secondary" icon="sparkle" onClick={onSuggest} style={{ color: "var(--pf-purple-500)" }}>Suggest key results</PfBtn>
              </div>
            )}
            {g.krs.map((k, i) => {
              const ks = ST[k.status];
              const stepping = ck && ck.goal === g.id && ck.idx === i;
              return (
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0" }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: k.status === "draft" ? "var(--pf-n100)" : TONE[ks.tone].bg, flex: "none", marginLeft: 5 }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--pf-n600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.kr}</span>
                    <div style={{ width: 120, flex: "none" }}><PfProgress pct={k.progress} tone={k.status === "draft" ? "grey" : ks.tone} height={6} /></div>
                    <span style={{ width: 36, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{k.progress}%</span>
                    <PfBadge tone={ks.tone}>{ks.label}</PfBadge>
                    {g.status !== "closed" && <PfBtn small variant="secondary" onClick={() => onCkOpen(i)}>Check-in</PfBtn>}
                  </div>
                  {stepping && ck && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 12px", margin: "2px 0 8px 22px" }}>
                      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>New progress</span>
                      <StepBtn label="−" onClick={() => onCkStep(-5)} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)", width: 44, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{ck.val}%</span>
                      <StepBtn label="+" onClick={() => onCkStep(5)} />
                      <div style={{ width: 110 }}><PfProgress pct={ck.val} tone={ST[krStatusFor(ck.val)].tone} height={6} /></div>
                      <PfBadge tone={ST[krStatusFor(ck.val)].tone}>{ST[krStatusFor(ck.val)].label}</PfBadge>
                      <span style={{ flex: 1 }} />
                      <PfBtn small variant="primary" onClick={onCkSave}>Save check-in</PfBtn>
                      <PfBtn small variant="ghost" icon="x" onClick={onCkClose} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PfCard>
    </div>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function GoalsOKR() {
  const go = useGo();
  const toast = useToast();

  const [quarter, setQuarter] = useState("Q3 2026");
  const [tab, setTab] = useState("cascade");
  const [goals, setGoals] = useState<Goal[]>(SEED);
  const [open, setOpen] = useState<string | null>("O-02");
  const [ck, setCk] = useState<{ goal: string; idx: number; val: number } | null>(null);
  const [rewrites, setRewrites] = useState<Rewrite[]>(REWRITES);

  // inline create panel
  const [creating, setCreating] = useState(false);
  const [fObjective, setFObjective] = useState("");
  const [fLevel, setFLevel] = useState<Goal["level"]>("Individual");
  const [fOwner, setFOwner] = useState("Adaeze Okafor");
  const [fKrs, setFKrs] = useState<string[]>([]);

  const ownerOptions = fLevel === "Company" ? ["Unrealabs"] : fLevel === "Department"
    ? ["Engineering", "Product & Design", "Field Operations", "Commercial"]
    : ["Adaeze Okafor", "Amara Okonkwo", "Zainab Yusuf", "Ngozi Obi", "Funke Adebayo"];

  const visible = goals.filter((g) => g.quarter === quarter);

  const stat = quarter === "Q3 2026"
    ? { track: "21", trackU: "/ 27 goals", trackD: "78%", risk: "4", riskD: "2 escalated", drafts: "2", avg: "62%", avgU: "wk 8 of 13", avgD: "+6pp" }
    : {
        track: String(visible.filter((g) => g.status === "on-track" || g.status === "closed").length),
        trackU: `/ ${visible.length} goals`, trackD: undefined,
        risk: String(visible.filter((g) => g.status === "at-risk").length), riskD: undefined,
        drafts: String(visible.filter((g) => g.status === "draft").length),
        avg: visible.length ? `${Math.round(visible.reduce((a, g) => a + g.progress, 0) / visible.length)}%` : "—",
        avgU: quarter === "Q2 2026" ? "closed quarter" : "not started", avgD: undefined,
      };

  /* ------------------------------ actions ------------------------------ */

  const resetForm = () => { setFObjective(""); setFLevel("Individual"); setFOwner("Adaeze Okafor"); setFKrs([]); };

  const aiSuggest = () => {
    const add = SUGGEST[fLevel].filter((s) => !fKrs.includes(s));
    if (add.length === 0) { toast("Those key results are already drafted", "ai"); return; }
    setFKrs((prev) => [...prev, ...add]);
    toast(`Measurability check passed — ${add.length} KRs carry baseline → target`, "ai");
  };

  const saveGoal = () => {
    if (!fObjective.trim()) { toast("Name the objective before saving", "danger"); return; }
    const id = `O-N${goals.length + 1}`;
    const g: Goal = { id, level: fLevel, owner: fOwner, sub: "Drafted just now", objective: fObjective.trim(), progress: 0, status: "draft", quarter, krs: fKrs.map((kr) => ({ kr, progress: 0, status: "draft" })) };
    setGoals((gs) => [g, ...gs]);
    setOpen(id);
    setCreating(false);
    setTab("cascade");
    resetForm();
    toast(`"${short(fObjective.trim())}" saved as draft — ${fKrs.length} KR${fKrs.length === 1 ? "" : "s"} attached`, "success");
  };

  const saveCheckin = () => {
    if (!ck) return;
    const target = goals.find((g) => g.id === ck.goal);
    const krText = target ? target.krs[ck.idx].kr : "";
    setGoals((gs) => gs.map((g) => {
      if (g.id !== ck.goal) return g;
      const krs = g.krs.map((k, i) => (i === ck.idx ? { ...k, progress: ck.val, status: krStatusFor(ck.val) } : k));
      const progress = krs.length ? Math.round(krs.reduce((a, k) => a + k.progress, 0) / krs.length) : 0;
      const status: GoalStatus = g.status === "draft" || g.status === "closed" ? g.status : goalStatusFor(progress);
      return { ...g, krs, progress, status };
    }));
    toast(`Check-in saved — "${short(krText)}" at ${ck.val}%`, "success");
    setCk(null);
  };

  const suggestForGoal = (g: Goal) => {
    setGoals((gs) => gs.map((x) => (x.id === g.id ? { ...x, krs: [...x.krs, ...SUGGEST[g.level].map((kr) => ({ kr, progress: 0, status: "draft" as KrStatus }))] } : x)));
    toast(`Measurability check passed — 2 KRs drafted for "${short(g.objective, 30)}"`, "ai");
  };

  const applyRewrite = (r: Rewrite) => {
    setGoals((gs) => gs.map((g) => (g.id === r.goal ? { ...g, krs: g.krs.map((k, i) => (i === r.idx ? { ...k, kr: r.after } : k)) } : g)));
    setRewrites((rs) => rs.filter((x) => x !== r));
    const owner = goals.find((g) => g.id === r.goal)?.owner ?? "";
    toast(`KR rewritten on ${owner}'s goal — now measures the outcome`, "ai");
  };

  /* ------------------------------ render ------------------------------- */

  const treeRow = (g: Goal) => (
    <button
      key={g.id}
      onClick={() => { setTab("cascade"); setOpen(g.id); }}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", fontFamily: "inherit", background: "var(--pf-n0)", border: `1px ${g.status === "draft" ? "dashed var(--pf-n100)" : "solid var(--pf-n50)"}`, borderRadius: 10, padding: "9px 12px", cursor: "pointer" }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: LEVEL_HEX[g.level], flex: "none" }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.objective}</span>
      <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap", flex: "none" }}>{g.owner}</span>
      <span style={{ flex: 1 }} />
      <PfBadge tone={ST[g.status].tone}>{g.progress}%</PfBadge>
      <PfBadge tone={ST[g.status].tone}>{ST[g.status].label}</PfBadge>
      <Ic name="caretright" size={12} color="var(--pf-n300)" />
    </button>
  );

  const renderNode = (g: Goal): ReactNode => {
    const kids = visible.filter((c) => c.parent === g.id);
    return (
      <div key={g.id}>
        {treeRow(g)}
        {kids.length > 0 && (
          <div style={{ marginLeft: 15, paddingLeft: 16, borderLeft: "2px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {kids.map((k) => (
              <div key={k.id} style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: -16, top: 19, width: 12, height: 2, background: "var(--pf-n50)" }} />
                {renderNode(k)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const roots = visible.filter((g) => g.level === "Company");
  const unaligned = visible.filter((g) => !g.parent && g.level !== "Company");

  const levelChip = (label: string, active: boolean, tone: PfTone, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 99, cursor: "pointer", border: `1px solid ${active ? TONE[tone].fg : "var(--pf-n100)"}`, background: active ? TONE[tone].soft : "var(--pf-n0)", color: active ? TONE[tone].fg : "var(--pf-n500)" }}>
      {label}
    </button>
  );

  /* Scope line + empty state shared by the Cascade and Alignment tabs. */
  const scopeLine = (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
        {quarter === "Q3 2026" ? `Your line of sight · ${visible.length} of 27 goals` : `${visible.length} goal${visible.length === 1 ? "" : "s"} in ${quarter}`}
      </span>
    </div>
  );

  const emptyState = (
    <PfCard pad="42px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><PfTile icon="target" tone="grey" size={38} /></div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 4 }}>No goals for {quarter} yet</div>
      <div style={{ fontSize: 13, color: "var(--pf-n400)", marginBottom: 14 }}>Carry the Q3 cascade forward or draft fresh objectives before kickoff.</div>
      <PfBtn variant="primary" icon="plus" onClick={() => setCreating(true)}>Draft {quarter.split(" ")[0]} goals</PfBtn>
    </PfCard>
  );

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------- Header -------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 260 }}>
          <PfTile icon="target" tone="green" size={34} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>Goals & OKRs</div>
            <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 1 }}>Company → department → individual, one cascade · quarterly cycles</div>
          </div>
        </div>
        <PfTabs tabs={["Q2 2026", "Q3 2026", "Q4 2026"]} active={quarter} onChange={(q) => { setQuarter(q); setOpen(null); setCk(null); }} />
        <PfBtn variant="primary" icon="plus" onClick={() => setCreating(true)}>New goal</PfBtn>
      </div>

      {/* -------- Inline create panel -------- */}
      {creating && (
        <PfCard style={{ marginBottom: 12, borderColor: "var(--pf-primary-100)" }}>
          <PfCardHead title="New goal" sub={`Drafts into ${quarter} — AI checks that key results are measurable`}>
            <PfBadge tone="grey">Draft first · publish at kickoff</PfBadge>
          </PfCardHead>
          <div style={{ padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Lab>Objective</Lab>
              <input value={fObjective} onChange={(e) => setFObjective(e.target.value)} placeholder="e.g. Make onboarding a one-week experience" style={INPUT} />
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
              <div>
                <Lab>Level</Lab>
                <div style={{ display: "flex", gap: 6 }}>
                  {LEVELS.map((lv) => levelChip(lv, fLevel === lv, LEVEL_TONE[lv], () => {
                    setFLevel(lv);
                    setFOwner(lv === "Company" ? "Unrealabs" : lv === "Department" ? "Engineering" : "Adaeze Okafor");
                  }))}
                </div>
              </div>
              <div>
                <Lab>Owner</Lab>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {ownerOptions.map((o) => levelChip(o, fOwner === o, "green", () => setFOwner(o)))}
                </div>
              </div>
            </div>
            <div>
              <Lab>Key results</Lab>
              {fKrs.length === 0 && (
                <div style={{ fontSize: 12.5, color: "var(--pf-n300)", marginBottom: 8 }}>None yet — let AI propose measurable ones (baseline → target, dated). You edit or drop them.</div>
              )}
              {fKrs.map((k) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                  <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--pf-n600)" }}>{k}</span>
                  <PfBadge tone="green">Measurable</PfBadge>
                  <PfBtn small variant="ghost" icon="x" onClick={() => setFKrs((p) => p.filter((x) => x !== k))} />
                </div>
              ))}
              <div style={{ marginTop: 8 }}>
                <PfBtn small variant="secondary" icon="sparkle" onClick={aiSuggest} style={{ color: "var(--pf-purple-500)" }}>AI-suggest key results</PfBtn>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1 }}>Saves as a draft — it joins the cascade unscored until the cycle kickoff.</span>
              <PfBtn variant="secondary" onClick={() => { setCreating(false); resetForm(); }}>Cancel</PfBtn>
              <PfBtn variant="primary" icon="check" onClick={saveGoal}>Save draft</PfBtn>
            </div>
          </div>
        </PfCard>
      )}

      {/* -------- KPI strip -------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <PfStat icon="target" tone="green" label="Goals on track" value={stat.track} unit={stat.trackU} delta={stat.trackD} deltaTone="green" />
        <PfStat icon="warning" tone="red" label="At risk" value={stat.risk} unit="goals" delta={stat.riskD} deltaTone="red" />
        <PfStat icon="file" tone="grey" label="Drafts" value={stat.drafts} unit="awaiting KRs" />
        <PfStat icon="trend" tone="blue" label="Avg progress" value={stat.avg} unit={stat.avgU} delta={stat.avgD} deltaTone="green" />
      </div>

      {/* -------- Section tabs — the page's own sections, tabbed -------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "cascade", label: "Cascade", count: String(visible.length) },
            { key: "alignment", label: "Alignment" },
            { key: "assist", label: "AI assist", count: String(rewrites.length) },
          ]}
        />
      </div>

      {/* CASCADE — the working view */}
      {tab === "cascade" && (
        <>
          {scopeLine}
          {visible.length === 0 ? emptyState : (
            <div style={{ position: "relative", paddingLeft: 26 }}>
              {/* the cascade rail */}
              <span style={{ position: "absolute", left: 8, top: 14, bottom: 14, width: 2, background: "var(--pf-n50)", borderRadius: 2 }} />
              {LEVELS.map((lv, gi) => {
                const list = visible.filter((g) => g.level === lv);
                if (list.length === 0) return null;
                const avg = Math.round(list.reduce((a, g) => a + g.progress, 0) / list.length);
                return (
                  <section key={lv}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, margin: `${gi === 0 ? 2 : 20}px 0 8px` }}>
                      <span style={{ position: "absolute", left: -22, top: "50%", transform: "translateY(-50%)", width: 10, height: 10, borderRadius: "50%", background: LEVEL_HEX[lv], boxShadow: "0 0 0 3px var(--pf-n25)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--pf-n400)" }}>{lv}</span>
                      <PfBadge tone={LEVEL_TONE[lv]}>{list.length} objective{list.length === 1 ? "" : "s"}</PfBadge>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>avg {avg}%</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {list.map((g) => (
                        <GoalCard
                          key={g.id}
                          g={g}
                          expanded={open === g.id}
                          onToggle={() => { setOpen(open === g.id ? null : g.id); setCk(null); }}
                          ck={ck}
                          onCkOpen={(idx) => setCk({ goal: g.id, idx, val: g.krs[idx].progress })}
                          onCkStep={(d) => setCk((c) => (c ? { ...c, val: Math.max(0, Math.min(100, c.val + d)) } : c))}
                          onCkSave={saveCheckin}
                          onCkClose={() => setCk(null)}
                          onSuggest={() => suggestForGoal(g)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ALIGNMENT — how work ladders up */}
      {tab === "alignment" && (
        <>
          {scopeLine}
          {visible.length === 0 ? emptyState : (
            <PfCard>
              <PfCardHead title="Alignment" sub="How individual work ladders up to the company objective" />
              <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {roots.map((r) => renderNode(r))}
                {unaligned.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", margin: "10px 0 2px" }}>Not yet aligned</div>
                    {unaligned.map((g) => treeRow(g))}
                  </>
                )}
                <div style={{ fontSize: 12, color: "var(--pf-n300)", marginTop: 8 }}>Click any objective to open it in the cascade.</div>
              </div>
            </PfCard>
          )}
        </>
      )}

      {/* AI ASSIST — rewrites + quarter rhythm */}
      {tab === "assist" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
          <PfCard>
            <PfCardHead title={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Ic name="sparkle" size={15} color="var(--pf-purple-500)" />AI assist</span>} sub="Output-vs-outcome check on this cascade">
              <PfBadge tone="purple">{rewrites.length} finding{rewrites.length === 1 ? "" : "s"}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {rewrites.length > 0 ? (
                <>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)" }}>{rewrites.length} of your KRs are outputs, not outcomes. Proposed rewrites:</div>
                  {rewrites.map((r) => (
                    <div key={r.goal + r.idx} style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", textDecoration: "line-through" }}>{r.before}</div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ marginTop: 2 }}><Ic name="arrowright" size={12} color="var(--pf-purple-500)" /></span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{r.after}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n300)", flex: 1 }}>Confidence {r.conf}% · flags an output</span>
                        <PfBtn small variant="secondary" onClick={() => applyRewrite(r)}>Apply</PfBtn>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 13, color: "var(--pf-n400)", background: "var(--pf-n25)", borderRadius: 9, padding: "12px 12px", textAlign: "center" }}>
                  All key results now measure outcomes. Clean cascade.
                </div>
              )}
            </div>
            <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "9px 16px", fontSize: 11.5, color: "var(--pf-n400)" }}>
              AI proposes · you decide. Rewrites apply only when you accept them.
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead title="Quarter rhythm" sub="Q3 2026 cycle" />
            <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 11 }}>
              {[
                { icon: "check", tone: "green" as PfTone, t: "Mid-quarter check-in", d: "Aug 12 · done" },
                { icon: "pulse", tone: "blue" as PfTone, t: "KR confidence pulse", d: "Sep 2 · all owners" },
                { icon: "clipboard", tone: "yellow" as PfTone, t: "Quarter close & scoring", d: "Sep 26 · feeds reviews" },
              ].map((m) => (
                <div key={m.t} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfTile icon={m.icon} tone={m.tone} size={26} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{m.t}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>{m.d}</div>
                  </div>
                </div>
              ))}
              <PfBtn small variant="secondary" icon="arrowright" full onClick={() => go("reviews")}>Open review cycle</PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
