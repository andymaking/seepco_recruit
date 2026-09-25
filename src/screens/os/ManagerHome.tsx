"use client";
import { useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfSegments,
  PfAvatar, PfTh, PfBanner, PfPageTabs, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { MANAGER_ATTENTION, REVIEW_CYCLE, ONE_ON_ONES, OKRS, EMPLOYEES } from "@/data/talentos";
import { NEW_HIRE, PLAN_30_60_90, type PlanApproval } from "@/data/onboarding";

/**
 * Manager Home — PRD FR-064. The manager persona's single starting point,
 * modeled 1:1 on the Propflow kit dashboard (docs/refs/kit-dashboard.png):
 * greeting → attention banner, then the page's sections behind in-page tabs —
 * Overview (KPIs + attention list + today's 1-on-1s), Team (employee table)
 * and Performance (trend chart + active review cycle + goals progress).
 */

/* ------------------------------- derived data ------------------------------- */

/** Attention items route to the module that resolves them (1-on-1s / reviews / goals). */
const ATTENTION_GO = ["oneonones", "reviews", "goals"] as const;

const statusOf = (att: number): { label: string; tone: PfTone } =>
  att >= 75 ? { label: "Good", tone: "green" } : att >= 65 ? { label: "Average", tone: "yellow" } : { label: "At Risk", tone: "red" };

/** QoQ score movement (review vs last cycle) — display-only, per person. */
const SCORE_DELTA: Record<string, number> = {
  "Amara Okonkwo": 2.2, "Adaeze Okafor": 1.4, "Zainab Yusuf": -0.8,
  "Ngozi Obi": 0.6, "Emeka Nwosu": -1.6, "Halima Sule": 2.0,
};

/** Team = the 6 people in Ngozi's Q2 review cycle, joined to the person spine. */
const TEAM = REVIEW_CYCLE.rows.map((r) => {
  const emp = EMPLOYEES.find((e) => e.name === r.name);
  const status = statusOf(r.goalAttainment);
  return {
    ...r,
    contract: emp?.contract ?? "Permanent",
    score: (emp?.perf ?? r.goalAttainment) / 20,
    delta: SCORE_DELTA[r.name] ?? 0,
    status,
  };
});

const PENDING_REVIEWS = REVIEW_CYCLE.rows.filter((r) => r.manager === "pending").length; // 3

/* Team performance vs target — six quarters, /5 rating scale (avg 82.4 ≈ 4.1/5). */
const QUARTERS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026", "Q2 2026"];
const TEAM_LINE = [3.4, 3.6, 3.5, 3.8, 3.9, 4.1];
const TARGET_LINE = [3.8, 3.8, 4.0, 4.0, 4.0, 4.0];
const PIN = 4; // static tooltip pinned on Q1 2026, kit-style
const xPct = (i: number) => (i / (QUARTERS.length - 1)) * 100;
const yPct = (v: number) => ((5 - v) / 4) * 100;

/* Goals-progress rail — from OKRS (Adaeze's individual OKR) + review goal attainment. */
const adaezeOkr = OKRS.find((o) => o.owner === "Adaeze Okafor");
const attOf = (name: string) => REVIEW_CYCLE.rows.find((r) => r.name === name)?.goalAttainment ?? 0;
const GOAL_ROWS: { name: string; pct: number; done: number; total: number; deadline: string; status: string; tone: PfTone }[] = [
  { name: "Halima Sule", pct: attOf("Halima Sule"), done: 3, total: 4, deadline: "15 Sep 2026", status: "On track", tone: "green" },
  { name: "Adaeze Okafor", pct: adaezeOkr?.progress ?? 71, done: 1, total: adaezeOkr?.krs.length ?? 2, deadline: "30 Sep 2026", status: "On track", tone: "green" },
  { name: "Emeka Nwosu", pct: attOf("Emeka Nwosu"), done: 1, total: 4, deadline: "22 Aug 2026", status: "At risk", tone: "red" },
];

const FILTERS = ["All", "Good", "Average", "At Risk"] as const;

/* --------------------------------- rows ---------------------------------- */

function AttentionRow({ item, target, last }: { item: (typeof MANAGER_ATTENTION)[number]; target: string; last: boolean }) {
  const go = useGo();
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={() => go(target)}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <span style={{ width: 36, height: 36, borderRadius: 10, background: `${item.tone}14`, color: item.tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, flex: "none" }}>
        {item.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{item.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.sub}</div>
      </div>
      <PfBtn small variant="secondary" onClick={() => go(target)}>{item.cta}</PfBtn>
    </div>
  );
}

const TEAM_GRID = "minmax(0,1.5fr) minmax(0,1.1fr) 118px 168px 92px";

function TeamRow({ p }: { p: (typeof TEAM)[number] }) {
  const go = useGo();
  const { hovered, hoverProps } = useHover();
  const up = p.delta >= 0;
  return (
    <div
      {...hoverProps}
      onClick={() => go("employee")}
      style={{ display: "grid", gridTemplateColumns: TEAM_GRID, alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PfAvatar init={p.init} tone={p.tone} size={30} />
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--pf-n500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.role}</div>
      <div><PfBadge tone="grey">{p.contract}</PfBadge></div>
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{p.score.toFixed(1)}</span>
          <span style={{ fontSize: 12, color: "var(--pf-n300)" }}>/5</span>
          <span style={{ fontSize: 11, fontWeight: 500, color: up ? "var(--pf-primary-500)" : "var(--pf-red-500)", marginLeft: 2 }}>
            {Math.abs(p.delta).toFixed(1)}%{up ? "↑" : "↓"}
          </span>
        </div>
        <div style={{ marginTop: 6 }}><PfSegments score={p.score} /></div>
      </div>
      <div><PfBadge tone={p.status.tone}>{p.status.label}</PfBadge></div>
    </div>
  );
}

function GoalRow({ g, last }: { g: (typeof GOAL_ROWS)[number]; last: boolean }) {
  const go = useGo();
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={() => go("goals")}
      style={{ padding: "14px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{g.name}&rsquo;s Progress</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)" }}>{g.pct}%</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>Key results {g.done} out of {g.total} completed</div>
      <div style={{ marginTop: 10 }}><PfProgress pct={g.pct} tone={g.tone === "red" ? "red" : "green"} /></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Deadline: {g.deadline}</span>
        <PfBadge tone={g.tone}>{g.status}</PfBadge>
      </div>
    </div>
  );
}

function MeetingRow() {
  const go = useGo();
  const { hovered, hoverProps } = useHover();
  const m = ONE_ON_ONES[0]; // Amara — today 10:00, AI-prepared agenda (PRD scenario)
  return (
    <div
      {...hoverProps}
      onClick={() => go("oneonones")}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10, cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfAvatar init={m.init} tone={m.tone} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--pf-n900)" }}>{m.with}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>
          <span>10:00 AM</span>
          <span style={{ width: 1, height: 10, background: "var(--pf-n100)" }} />
          <span>30 min</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 12, fontWeight: 500, color: "var(--pf-purple-500)" }}>
          <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
          AI agenda ready · {m.agenda.length} items
        </div>
      </div>
      <PfBtn small variant="primary" onClick={() => go("oneonones")}>Join</PfBtn>
    </div>
  );
}

/* --------------------------------- screen --------------------------------- */

export default function ManagerHome() {
  const go = useGo();
  const toast = useToast();
  const [attIdx, setAttIdx] = useState(-1); // -1 = summary, 0..2 = cycling items
  const [filterIdx, setFilterIdx] = useState(0);
  const [tab, setTab] = useState("overview");
  /**
   * The gate reads `state` — the same field /welcome and the cockpit read — so
   * the three surfaces cannot disagree about whether the plan is approved.
   * `planApprovedBy` is attribution only: who clicked, never whether.
   */
  const [planApproval, setPlanApproval] = useState<PlanApproval["state"]>(PLAN_30_60_90.approval.state);
  const [planApprovedBy, setPlanApprovedBy] = useState<string | null>(PLAN_30_60_90.approval.approvedBy ?? null);

  const shownTeam = filterIdx === 0 ? TEAM : TEAM.filter((t) => t.status.label === FILTERS[filterIdx]);

  /**
   * The toast describes the RECORD, not his screen. Approval lives in this
   * surface's own state, so /welcome still shows the gate until it reloads —
   * claiming "released to him now" would contradict what he actually sees.
   */
  const approvePlan = () => {
    setPlanApproval("manager-approved");
    setPlanApprovedBy(PLAN_30_60_90.approval.manager);
    toast(`30/60/90 approved for ${NEW_HIRE.name} — logged with you as the approver, and he sees it on his next load`, "success");
  };

  const requestRewrite = () => {
    toast(`Sent back to draft with your notes — People Ops notified. ${NEW_HIRE.name.split(" ")[0]} still sees nothing until you approve a version.`, "ai");
  };

  const cycleAttention = () => {
    const next = attIdx >= MANAGER_ATTENTION.length - 1 ? -1 : attIdx + 1;
    setAttIdx(next);
    if (next === -1) toast("All 3 attention items reviewed", "success");
    else toast(`Attention ${next + 1} of 3 — ${MANAGER_ATTENTION[next].title}`);
  };

  const bannerCopy: ReactNode =
    attIdx === -1 ? (
      <>
        <span style={{ fontWeight: 600 }}>You have 3 items that need your attention — </span>
        <span style={{ fontWeight: 400 }}>overdue action item, incomplete review, and a goal falling behind.</span>
      </>
    ) : (
      <>
        <span style={{ fontWeight: 600 }}>{attIdx + 1} of 3 · {MANAGER_ATTENTION[attIdx].title} — </span>
        <span style={{ fontWeight: 400 }}>{MANAGER_ATTENTION[attIdx].sub}</span>
      </>
    );

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Greeting */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Good Morning, Ngozi!</div>
        <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Here&rsquo;s your team overview.</div>
      </div>

      {/* Attention banner — arrow cycles through the three items */}
      <PfBanner cta="next" onCta={cycleAttention}>{bannerCopy}</PfBanner>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "team", label: "Team", count: String(TEAM.length) },
            { key: "performance", label: "Performance" },
          ]}
        />
      </div>

      {/* OVERVIEW — KPIs + attention list + today's 1-on-1s */}
      {tab === "overview" && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
            <PfStat icon="users" tone="green" label="Team Size" value={TEAM.length} unit="Employees" />
            <PfStat icon="star" tone="blue" label="Avg. Performance" value="82.4" unit="Average" delta="↗ 2.1%" />
            <PfStat icon="target" tone="purple" label="Goals On Track" value="21" unit="/27 Goals" />
            <PfStat icon="clipboard" tone="yellow" label="Pending Review" value={PENDING_REVIEWS} unit="of 10" />
          </div>

          {/* The 30/60/90 gate. People Ops chases it from the cockpit; only the
              named manager passes it, which is what makes the promise on the
              hire's own /welcome ("approval happens on her manager home") true. */}
          {planApproval === "ai-draft" ? (
            <PfCard style={{ marginBottom: 12, borderColor: "var(--pf-yellow-100)" }}>
              <PfCardHead
                title={`${NEW_HIRE.name}'s 30/60/90 plan is waiting on you`}
                sub={`AI-drafted ${PLAN_30_60_90.approval.draftedAt} from ${PLAN_30_60_90.approval.drafter}. He is on day ${NEW_HIRE.dayOfNinety} and has not seen a line of it.`}
              >
                <PfBadge tone="yellow" dot>AI draft</PfBadge>
              </PfCardHead>
              {PLAN_30_60_90.milestones.map((m, i) => (
                <div
                  key={m.day}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 20px", borderBottom: i === PLAN_30_60_90.milestones.length - 1 ? "none" : "1px solid var(--pf-n50)" }}
                >
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--pf-primary-50)", color: "var(--pf-primary-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, flex: "none" }}>
                    {m.day}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{m.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>{m.body}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
                <PfBtn variant="primary" icon="check" onClick={approvePlan}>Approve the plan</PfBtn>
                <PfBtn variant="secondary" onClick={requestRewrite}>Send it back for a rewrite</PfBtn>
                <span style={{ flex: 1, minWidth: 220, fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                  Approving records you as the approver and releases it to him on his next load.
                </span>
              </div>
            </PfCard>
          ) : (
            <PfCard pad={14} style={{ marginBottom: 12, background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <PfTile icon="check" tone="green" size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{NEW_HIRE.name}&rsquo;s 30/60/90 is approved</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                    {planApprovedBy ? `Signed off by ${planApprovedBy}` : "Approver not recorded"}. It reaches him on his next load, and progress is visible to both of you from there.
                  </div>
                </div>
                <PfBadge tone="green" dot>Approved</PfBadge>
              </div>
            </PfCard>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 12, alignItems: "start" }}>
            {/* Attention list */}
            <PfCard>
              <PfCardHead title="Needs your attention" sub="Pulled from your team's 1-on-1s, reviews and goals this morning.">
                <PfBadge tone="red">3 open</PfBadge>
              </PfCardHead>
              {MANAGER_ATTENTION.map((item, i) => (
                <AttentionRow key={item.title} item={item} target={ATTENTION_GO[i] ?? "manager"} last={i === MANAGER_ATTENTION.length - 1} />
              ))}
            </PfCard>

            {/* Today's 1-on-1s */}
            <PfCard>
              <PfCardHead title="Today's 1-on-1s" sub="Check today's meetings and agenda" />
              <div style={{ padding: 12 }}>
                <MeetingRow />
                <div style={{ marginTop: 8, background: "var(--pf-n25)", borderRadius: 8, padding: "12px 8px", textAlign: "center", fontSize: 13, color: "var(--pf-n300)" }}>
                  No more 1-on-1s today
                </div>
              </div>
            </PfCard>
          </div>
        </>
      )}

      {/* TEAM — employee table */}
      {tab === "team" && (
        <PfCard>
          <PfCardHead title="Employee" sub="View team's employee status.">
            <PfBtn small variant="secondary" icon="filter" onClick={() => setFilterIdx((filterIdx + 1) % FILTERS.length)}>
              {filterIdx === 0 ? "Filter" : `Filter: ${FILTERS[filterIdx]}`}
            </PfBtn>
            <PfBtn small variant="secondary" onClick={() => go("people")}>
              View Detail <Ic name="caretright" size={12} />
            </PfBtn>
          </PfCardHead>
          <div style={{ display: "grid", gridTemplateColumns: TEAM_GRID, gap: 12, padding: "10px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTh>Employee</PfTh>
            <PfTh>Role</PfTh>
            <PfTh>Contract</PfTh>
            <PfTh>Score</PfTh>
            <PfTh>Status</PfTh>
          </div>
          {shownTeam.map((p) => <TeamRow key={p.name} p={p} />)}
          {shownTeam.length === 0 && (
            <div style={{ padding: "22px 20px", fontSize: 13, color: "var(--pf-n300)", textAlign: "center" }}>
              No team members with status &ldquo;{FILTERS[filterIdx]}&rdquo;.
            </div>
          )}
        </PfCard>
      )}

      {/* PERFORMANCE — trend chart + review cycle + goals progress */}
      {tab === "performance" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 12, alignItems: "start" }}>
          {/* Team performance chart */}
          <PfCard>
            <PfCardHead title="Team Performance" sub="See how your team is performing across goals, reviews, and feedback.">
              <PfBtn small variant="secondary" onClick={() => go("depthealth")}>
                View Detail <Ic name="caretright" size={12} />
              </PfBtn>
            </PfCardHead>
            <div style={{ padding: 20 }}>
              {/* legend */}
              <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                {[["Performance", "var(--pf-primary-500)"], ["Target", "var(--pf-blue-500)"]].map(([label, color]) => (
                  <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n600)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    {label}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex" }}>
                {/* y axis */}
                <div style={{ width: 34, height: 190, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 8, textAlign: "right", fontSize: 11, color: "var(--pf-n400)", flex: "none" }}>
                  {["5.0", "4.0", "3.0", "2.0", "1.0"].map((v) => <span key={v} style={{ lineHeight: 1 }}>{v}</span>)}
                </div>
                {/* plot */}
                <div style={{ flex: 1, position: "relative", height: 190, minWidth: 0 }}>
                  <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }}>
                    {[0, 25, 50, 75, 100].map((y) => (
                      <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="var(--pf-n50)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                    ))}
                    {QUARTERS.map((q, i) => (
                      <line key={`v${q}`} x1={xPct(i)} y1="0" x2={xPct(i)} y2="100" stroke="var(--pf-n50)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                    ))}
                    <polyline
                      points={TARGET_LINE.map((v, i) => `${xPct(i)},${yPct(v)}`).join(" ")}
                      fill="none" stroke="var(--pf-blue-500)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                    />
                    <polyline
                      points={TEAM_LINE.map((v, i) => `${xPct(i)},${yPct(v)}`).join(" ")}
                      fill="none" stroke="var(--pf-primary-500)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  {/* pinned point markers */}
                  {[[TARGET_LINE[PIN], "var(--pf-blue-500)"], [TEAM_LINE[PIN], "var(--pf-primary-500)"]].map(([v, color]) => (
                    <span key={String(color)} style={{ position: "absolute", left: `${xPct(PIN)}%`, top: `${yPct(v as number)}%`, transform: "translate(-50%,-50%)", width: 9, height: 9, borderRadius: "50%", background: "var(--pf-n0)", border: `2px solid ${color}` }} />
                  ))}
                  {/* static tooltip card (kit-style) */}
                  <div style={{ position: "absolute", left: `calc(${xPct(PIN)}% - 14px)`, top: 14, transform: "translateX(-100%)", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 10, boxShadow: "0 6px 16px -8px rgba(2,6,23,.12)", minWidth: 158 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>{QUARTERS[PIN]}</div>
                    {[["Target Rating:", TARGET_LINE[PIN], "var(--pf-blue-500)"], ["Team Rating:", TEAM_LINE[PIN], "var(--pf-primary-500)"]].map(([label, v, color]) => (
                      <div key={String(label)} style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: String(color), alignSelf: "center" }} />
                        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{(v as number).toFixed(1)}</span>
                        <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>/5</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* x axis */}
              <div style={{ marginLeft: 34, display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 11, color: "var(--pf-n400)" }}>
                {QUARTERS.map((q) => <span key={q}>{q}</span>)}
              </div>
            </div>
          </PfCard>

          {/* Review cycle + goals rail — performance's companion cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Active review cycle CTA */}
            <PfCard pad={14} style={{ background: "var(--pf-n25)" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <PfTile icon="file" tone="green" size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Q2 2026 Review Active</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                    Q2 2026 is currently active — 1 of 4 reviews completed. Closes {REVIEW_CYCLE.closes}.
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <PfBtn variant="primary" full onClick={() => go("reviews")}>View Reviews</PfBtn>
              </div>
            </PfCard>

            {/* Goals progress */}
            <PfCard>
              <PfCardHead title="Goals Progress" sub="Current quarter team OKR">
                <PfBtn small variant="secondary" onClick={() => go("goals")}>
                  View Detail <Ic name="caretright" size={12} />
                </PfBtn>
              </PfCardHead>
              {GOAL_ROWS.map((g, i) => <GoalRow key={g.name} g={g} last={i === GOAL_ROWS.length - 1} />)}
            </PfCard>
          </div>
        </div>
      )}
    </div>
  );
}
