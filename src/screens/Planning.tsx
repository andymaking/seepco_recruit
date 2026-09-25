"use client";
import { useState } from "react";
import { useGo, useApp, type ReqStatus } from "@/state/app";
import { useHover } from "@/lib/useHover";
import { PfPageTabs } from "@/components/os/ui";

/* ============================================================
   STEP 1 · SIGNAL ANALYSIS data
   ============================================================ */
const plannerInputs = [
  { icon: "⊞", name: "Org chart & headcount", detail: "HRIS · 142 people across 11 teams", status: "Synced 2h ago", statusColor: "#16B364" },
  { icon: "⚡", name: "Team velocity", detail: "Jira / Linear · throughput per sprint", status: "Live", statusColor: "#16B364" },
  { icon: "↘", name: "Attrition history", detail: "24 months of exits & tenure", status: "Synced daily", statusColor: "#16B364" },
  { icon: "▤", name: "Project backlog", detail: "Ticket & roadmap queue depth", status: "Live", statusColor: "#16B364" },
  { icon: "◎", name: "Strategic priorities", detail: "H2 OKRs & roadmap weighting", status: "Updated", statusColor: "#16B364" },
];

const plannerSteps = [
  { icon: "✓", title: "Demand prediction", status: "DONE", dotBg: "#ECF9F3", dotColor: "#16B364", desc: "Forecasts hiring need from attrition trend, growth and workload per team.", result: "→ +2 net-new hires, Product, Q3" },
  { icon: "✓", title: "Headcount justification", status: "DONE", dotBg: "#ECF9F3", dotColor: "#16B364", desc: "Builds the business case from team metrics + comparable peer-team benchmarks.", result: "→ 1:9 designer:PM ratio vs. 1:6 peer benchmark" },
  { icon: "✓", title: "Budget estimation", status: "DONE", dotBg: "#ECF9F3", dotColor: "#16B364", desc: "Predicts cost-to-hire from salary band × time-to-fill × tooling.", result: "→ ₦9.5–13.2M envelope · ~19-day fill" },
  { icon: "✓", title: "Attrition risk flagging", status: "DONE", dotBg: "#ECF9F3", dotColor: "#16B364", desc: "Surfaces teams at elevated departure risk so the org hires proactively.", result: "→ Design pod flagged at 74% risk" },
  { icon: "⟳", title: "Skill gap analysis", status: "RUNNING", dotBg: "#F7EEFC", dotColor: "#AF52DE", desc: "Maps the current team skill graph against strategic priorities.", result: "→ Gap: systems-design depth for H2" },
];

const plannerSignals = [
  { label: "Backlog growth (MoM)", value: "+12%", color: "#EBA308" },
  { label: "Designer : PM ratio", value: "1:9", color: "#EBA308" },
  { label: "Pod load vs. sustainable", value: "1.3×", color: "#EBA308" },
  { label: "ICs at attrition risk", value: "2", color: "#EBA308" },
  { label: "Forecast confidence", value: "71%", color: "#16B364" },
];

/* ============================================================
   REQUISITION STATE MACHINE (REQMODEL)
   ============================================================ */
type VTone = "primary" | "warn" | "danger";
type Action = { label: string; to: ReqStatus; v: VTone };
type Model = { label: string; sub: string; badge: [string, string]; actions: Action[] };

const REQMODEL: Record<ReqStatus, Model> = {
  draft: { label: "Draft", sub: "Manager drafting role", badge: ["#16B364", "#ECF9F3"], actions: [{ label: "Submit for approval →", to: "pending", v: "primary" }] },
  pending: { label: "Pending Approval", sub: "Awaiting sign-offs", badge: ["#16B364", "#ECF9F3"], actions: [{ label: "Record sign-offs · Approve", to: "approved", v: "primary" }, { label: "Reject", to: "rejected", v: "danger" }] },
  approved: { label: "Approved", sub: "Funded & authorized", badge: ["#16B364", "#ECF9F3"], actions: [{ label: "Publish → Open", to: "open", v: "primary" }] },
  open: { label: "Open", sub: "Live to recruiting", badge: ["#16B364", "#ECF9F3"], actions: [{ label: "Mark Filled", to: "filled", v: "primary" }, { label: "Pause · On Hold", to: "hold", v: "warn" }, { label: "Cancel", to: "cancelled", v: "danger" }] },
  filled: { label: "Filled", sub: "Offer accepted", badge: ["#16B364", "#ECF9F3"], actions: [{ label: "Complete → Close", to: "closed", v: "primary" }] },
  closed: { label: "Closed", sub: "Requisition complete", badge: ["#475569", "#F1F5F9"], actions: [] },
  rejected: { label: "Rejected", sub: "Sent back / denied", badge: ["#EBA308", "#FEF7E6"], actions: [{ label: "Revise → Draft", to: "draft", v: "primary" }] },
  hold: { label: "On Hold", sub: "Paused temporarily", badge: ["#EBA308", "#FEF7E6"], actions: [{ label: "Resume → Open", to: "open", v: "primary" }, { label: "Cancel", to: "cancelled", v: "danger" }] },
  cancelled: { label: "Cancelled", sub: "Withdrawn", badge: ["#475569", "#F1F5F9"], actions: [] },
};

const vStyle: Record<VTone, { background: string; color: string; border: string }> = {
  primary: { background: "#020617", color: "#fff", border: "1px solid #020617" },
  warn: { background: "#fff", color: "#B87F06", border: "1px solid #EBA308" },
  danger: { background: "#fff", color: "#E81E17", border: "1px solid #F7B6B3" },
};

const ORDER: ReqStatus[] = ["draft", "pending", "approved", "open", "filled", "closed"];
const TRANS_IN: Partial<Record<ReqStatus, string>> = { pending: "Submit", approved: "Sign-off", open: "Publish", filled: "Hired", closed: "Complete" };
const EX_BRANCH: Partial<Record<ReqStatus, number>> = { rejected: 1, hold: 3, cancelled: 3 };

const soMeta = {
  done: ["Signed", "#16B364", "#ECF9F3"],
  active: ["Reviewing", "#EBA308", "#FEF7E6"],
  todo: ["Awaiting", "#64748B", "#F1F5F9"],
  denied: ["Denied", "#E81E17", "#FDE8E8"],
} as const;
type SoKey = keyof typeof soMeta;

const signoffBase = [
  { name: "Finance", role: "Budget approval", init: "F" },
  { name: "Dept. Head", role: "Headcount approval", init: "D" },
  { name: "HR Business Partner", role: "Requisition owner", init: "H" },
];

const exChipsBase = [
  { key: "rejected" as ReqStatus, label: "Rejected", sub: "Sent back / denied", trans: "Reject", terminal: false },
  { key: "hold" as ReqStatus, label: "On Hold", sub: "Paused temporarily", trans: "Pause / Resume", terminal: false },
  { key: "cancelled" as ReqStatus, label: "Cancelled", sub: "Withdrawn", trans: "Cancel", terminal: true },
];

function scrollTop() {
  if (typeof window !== "undefined") window.scrollTo({ top: 0 });
}

/* --- small presentational pieces --- */

function TransitionButton({ a, onClick }: { a: Action; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const v = vStyle[a.v];
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "10px 15px",
        borderRadius: 8, cursor: "pointer", background: v.background, color: v.color, border: v.border,
        opacity: hovered ? 0.9 : 1,
      }}
    >
      {a.label}
    </button>
  );
}

function PrimaryCardButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        width: "100%", background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit",
        fontWeight: 600, fontSize: 13, padding: 11, borderRadius: 8, cursor: "pointer", opacity: hovered ? 0.92 : 1,
      }}
    >
      {children}
    </button>
  );
}

function ReviewDraftButton({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        background: "#fff", color: "#16B364", border: "none", fontFamily: "inherit", fontWeight: 700,
        fontSize: 13, padding: "11px 18px", borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap",
        flex: "none", opacity: hovered ? 0.92 : 1,
      }}
    >
      Review requisition draft →
    </button>
  );
}

export default function Planning() {
  const go = useGo();
  const { reqStatus, setReqStatus } = useApp();
  const [planStep, setPlanStep] = useState<"analyze" | "requisition">("analyze");

  const goAnalyze = () => setPlanStep("analyze");
  const goReq = () => { setPlanStep("requisition"); scrollTop(); };
  const transition = (to: ReqStatus) => { setReqStatus(to); scrollTop(); };

  /* ---- derive state-machine view values (mirrors reqVals) ---- */
  const rs = reqStatus;
  const isEx = rs in EX_BRANCH;
  const activeIdx = isEx ? -1 : ORDER.indexOf(rs);
  const reached = isEx ? (EX_BRANCH[rs] as number) : activeIdx;
  const front = isEx ? reached : activeIdx;

  const railNodes = ORDER.map((k, i) => {
    const terminal = k === "closed";
    let st: "done" | "active" | "upcoming";
    if (isEx) st = i <= reached ? "done" : "upcoming";
    else st = i < activeIdx ? "done" : i === activeIdx ? "active" : "upcoming";
    let bColor: string, bg: string, labelColor: string, subColor: string, badge = "", badgeColor = "#16B364";
    if (st === "active") { bColor = "#16B364"; bg = "#ECF9F3"; labelColor = "#16B364"; subColor = "#2FBF74"; badge = "● NOW"; badgeColor = "#16B364"; }
    else if (st === "done") { bColor = "#A9E4C6"; bg = "#F4FBF7"; labelColor = "#16B364"; subColor = "#475569"; badge = "✓"; }
    else { bColor = "#CBD5E1"; bg = "#fff"; labelColor = "#64748B"; subColor = "#94A3B8"; }
    const bw = st === "active" ? "2px" : "1.5px";
    const bs = terminal ? "dashed" : "solid";
    const m = REQMODEL[k];
    return {
      key: k, label: m.label, sub: m.sub, labelColor, subColor, badge, badgeColor,
      boxStyle: { flex: 1, minWidth: 0, borderRadius: 11, padding: "11px 12px", border: `${bw} ${bs} ${bColor}`, background: bg },
      arrow: i > 0, transIn: TRANS_IN[k] || "", arrowColor: i <= front ? "#16B364" : "#CBD5E1",
    };
  });

  const exChips = exChipsBase.map((c) => {
    const active = rs === c.key;
    const accent = c.terminal ? "#475569" : "#EBA308";
    const bs = c.terminal ? "dashed" : "solid";
    const bg = active ? (c.terminal ? "#F1F5F9" : "#FEF7E6") : "#fff";
    return {
      ...c, accent, active,
      labelColor: active ? accent : c.terminal ? "#64748B" : "#B87F06",
      boxStyle: { flex: 1, minWidth: 0, borderRadius: 11, padding: "11px 13px", border: `${active ? "2px" : "1.5px"} ${bs} ${accent}`, background: bg },
    };
  });

  const cur = REQMODEL[rs];
  const hasActions = cur.actions.length > 0;

  let sg: SoKey[];
  if (rs === "draft") sg = ["todo", "todo", "todo"];
  else if (rs === "pending") sg = ["done", "active", "todo"];
  else if (rs === "rejected") sg = ["done", "denied", "todo"];
  else sg = ["done", "done", "done"];
  const signoffs = signoffBase.map((p, i) => {
    const meta = soMeta[sg[i]];
    return { ...p, status: meta[0], color: meta[1], bg: meta[2] };
  });

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>STAGE 01 · WORKFORCE PLANNING / REQUISITION</div>
      <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Predict the need before it becomes a fire</h1>
      <div style={{ fontSize: 13, color: "var(--ink2)" }}>Before a requisition exists, the AI Workforce Planner ingests the org&apos;s signals, runs its analysis, and only then drafts the business case.</div>

      {/* Section tabs — the two planner steps, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={planStep}
          onSelect={(k) => (k === "requisition" ? goReq() : goAnalyze())}
          tabs={[
            { key: "analyze", label: "Signal analysis", mono: "1", count: String(plannerInputs.length) },
            { key: "requisition", label: "Requisition draft", mono: "2", badge: cur.label },
          ]}
        />
      </div>

      {/* STEP 1 · SIGNAL ANALYSIS */}
      {planStep === "analyze" && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--ink3)", marginBottom: 11 }}>SIGNALS THE PLANNER INGESTS · 5 SOURCES</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 11, marginBottom: 18 }}>
            {plannerInputs.map((i) => (
              <div key={i.name} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "#ECF9F3", color: "#16B364", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, marginBottom: 10 }}>{i.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 2, lineHeight: 1.2 }}>{i.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)", lineHeight: 1.35, marginBottom: 9 }}>{i.detail}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: i.statusColor }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: i.statusColor }} />{i.status}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start", marginBottom: 16 }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "#F7EEFC", color: "#AF52DE", display: "flex", alignItems: "center", justifyContent: "center" }}>✦</span>
                <div style={{ fontWeight: 700, fontSize: 15 }}>What the planner runs autonomously</div>
              </div>
              {plannerSteps.map((s) => (
                <div key={s.title} style={{ display: "flex", gap: 13, padding: "12px 0", borderBottom: "1px solid var(--border2)" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.dotBg, color: s.dotColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{s.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".3px", color: s.dotColor, background: s.dotBg, padding: "2px 7px", borderRadius: 5 }}>{s.status}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink2)", lineHeight: 1.45, marginTop: 3 }}>{s.desc}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink)", fontWeight: 600, marginTop: 4 }}>{s.result}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Signals detected</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {plannerSignals.map((g) => (
                  <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color, flex: "none" }} />
                    <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink2)" }}>{g.label}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: g.color }}>{g.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: "11px 12px", background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 10, fontSize: 11.5, color: "#8F6304", lineHeight: 1.5 }}>
                <b>Net read:</b> demand is real, not noise. A proactive hire beats a Q3 scramble.
              </div>
            </div>
          </div>

          <div style={{ background: "linear-gradient(110deg,#16B364,#129152)", borderRadius: 12, padding: "20px 22px", color: "#fff", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 8px 22px rgba(26,80,200,.18)" }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(255,255,255,.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flex: "none" }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 5 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", background: "rgba(255,255,255,.18)", padding: "3px 8px", borderRadius: 5 }}>RECOMMENDATION READY · 71% CONFIDENCE</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>Open <b>1 requisition</b> now — Senior Product Designer, Product pod, Q3. The business case, budget envelope and time-to-fill are drafted and ready for your review.</div>
            </div>
            <ReviewDraftButton onClick={goReq} />
          </div>
          <div style={{ marginTop: 13, fontSize: 11.5, color: "var(--ink3)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#16B364" }}>⚖</span> The planner&apos;s output is advisory. Headcount stays a human approval; every signal and its reasoning trace is logged.
          </div>
        </>
      )}

      {/* STEP 2 · REQUISITION */}
      {planStep === "requisition" && (
        <>
          {/* STATUS LIFECYCLE TRACKER */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Requisition status</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: cur.badge[0], background: cur.badge[1], padding: "3px 11px", borderRadius: 5 }}>{cur.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, border: "1.5px solid #16B364", borderRadius: 3 }} />Standard</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, border: "1.5px solid #EBA308", borderRadius: 3 }} />Exception</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 11, height: 11, border: "1.5px dashed #475569", borderRadius: 3 }} />Terminal</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "stretch", marginBottom: 18 }}>
              {railNodes.map((n) => (
                <div key={n.key} style={{ display: "contents" }}>
                  {n.arrow && (
                    <div style={{ flex: "none", width: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, paddingBottom: 14 }}>
                      <div style={{ fontSize: 8.5, fontWeight: 600, color: "var(--ink3)", letterSpacing: ".2px", whiteSpace: "nowrap" }}>{n.transIn}</div>
                      <div style={{ width: "100%", height: 2, borderRadius: 2, background: n.arrowColor }} />
                    </div>
                  )}
                  <div style={n.boxStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 5, marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: n.labelColor, lineHeight: 1.1 }}>{n.label}</span>
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: n.badgeColor, whiteSpace: "nowrap" }}>{n.badge}</span>
                    </div>
                    <div style={{ fontSize: 10, color: n.subColor, lineHeight: 1.3 }}>{n.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)", marginBottom: 9 }}>EXCEPTION &amp; TERMINAL STATES</div>
              <div style={{ display: "flex", gap: 12 }}>
                {exChips.map((c) => (
                  <div key={c.key} style={c.boxStyle}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: c.labelColor }}>{c.label}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: c.accent, border: `1px solid ${c.accent}`, padding: "1px 7px", borderRadius: 5, whiteSpace: "nowrap" }}>{c.trans}</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 2 }}>{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CURRENT STATUS + ACTIONS + SIGN-OFFS + BUSINESS CASE */}
          <div style={{ display: "grid", gridTemplateColumns: "1.12fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--ink3)", marginBottom: 9 }}>CURRENT STATUS</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 11, marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 21, letterSpacing: "-.4px", color: cur.badge[0] }}>{cur.label}</span>
                  <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>{cur.sub}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)", marginBottom: 10 }}>AVAILABLE TRANSITIONS</div>
                {hasActions ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                    {cur.actions.map((a) => (
                      <TransitionButton key={a.label} a={a} onClick={() => transition(a.to)} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>
                    Terminal state — no further transitions.{" "}
                    <span onClick={() => transition("draft")} style={{ color: "#16B364", fontWeight: 600, cursor: "pointer" }}>↻ Reset to Draft</span>
                  </div>
                )}
                <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid var(--border2)", fontSize: 11.5, color: "var(--ink3)", display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.45 }}>
                  <span style={{ color: "#AF52DE" }}>✦</span>
                  <span>AI advisory only — headcount stays a human approval. Every transition is logged with approver &amp; timestamp.</span>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Sign-offs required</div>
                {signoffs.map((s) => (
                  <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--border2)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#020617", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 11.5, flex: "none" }}>{s.init}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink3)" }}>{s.role}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: s.color, background: s.bg, padding: "4px 11px", borderRadius: 5, whiteSpace: "nowrap" }}>{s.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: "#F7EEFC", color: "#AF52DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✦</span>
                <div style={{ fontWeight: 700, fontSize: 14 }}>AI-drafted business case</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Role</div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>Senior Product Designer</div>
                </div>
                <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Level / Location</div>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>Senior · Lagos (Hybrid)</div>
                </div>
                <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Budget envelope</div>
                  <div style={{ fontWeight: 600, fontSize: 12.5, fontFamily: "var(--mono)" }}>₦9.5–13.2M</div>
                </div>
                <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Time-to-fill</div>
                  <div style={{ fontWeight: 600, fontSize: 12.5, fontFamily: "var(--mono)" }}>~19 days</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 16 }}>The Product design pod is at 1.3× sustainable load with a backlog growing 12% MoM. Two ICs show elevated departure risk. A senior hire closes the systems-design gap and de-risks Q3 roadmap delivery — peer teams run 1:6 designer-to-PM; Hirebrew is at 1:9.</div>
              <PrimaryCardButton onClick={() => go("role")}>Open role definition →</PrimaryCardButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
