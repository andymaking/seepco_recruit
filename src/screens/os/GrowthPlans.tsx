"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfBanner, PfPageTabs, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { EMPLOYEES, type Employee } from "@/data/talentos";

/**
 * Growth Plans — PRD FR-070. Target-role progression per employee: the
 * performing-vs-target gap on the unified skill taxonomy, estimated
 * time-to-ready, named assessments and typed learning milestones.
 * Anatomy mirrors docs/refs/kit-growth-plan.png (target-role header with
 * gap/estimate cells → assessments → milestone list).
 */

/* --------------------------------- types ---------------------------------- */

type MilestoneType = "Course" | "Stretch" | "Mentoring" | "Certification";

type Milestone = {
  type: MilestoneType; title: string; state: "done" | "active" | "todo";
  meta: string; pct?: number; fromHub?: boolean;
};

type Gap = { skill: string; have: number; want: number };

type Assessment = {
  title: string; assessor: string; init?: string; tone?: string;
  status: "done" | "scheduled"; score?: string; when: string;
  action: "View" | "Reschedule";
};

type Plan = {
  emp: Employee; target: string; track: string; readiness: number; est: string;
  sponsor: string; seed: string; seedGo: string;
  gaps: Gap[]; assessments: Assessment[]; milestones: Milestone[];
  ai: { insight: string; suggestion: string; type: MilestoneType; confidence: number; evidence: string };
};

/* ---------------------------------- data ---------------------------------- */

const byId = (id: string): Employee => EMPLOYEES.find((e) => e.id === id)!;

/** Three live plans off the person spine — Amara is the PRD's worked example. */
const PLANS: Plan[] = [
  {
    emp: byId("E-0214"), target: "Staff Engineer", track: "L5 → L6 · Engineering", readiness: 74,
    est: "2 quarters", sponsor: "Ngozi Adeyemi",
    seed: "Created from Stage-11 QoH 4.6 seed", seedGo: "employee",
    gaps: [
      { skill: "Distributed systems", have: 4.6, want: 4.5 },
      { skill: "Payments domain", have: 4.4, want: 4.0 },
      { skill: "Technical leadership", have: 3.2, want: 4.0 },
      { skill: "Mentoring & coaching", have: 3.6, want: 4.0 },
      { skill: "Org-level influence", have: 2.9, want: 4.0 },
    ],
    assessments: [
      { title: "Technical deep-dive", assessor: "Ngozi Adeyemi", init: "NA", tone: "#16B364", status: "done", score: "4.1/5", when: "Assessed Jun 28", action: "View" },
      { title: "Leadership readiness", assessor: "External panel (2 assessors)", status: "scheduled", when: "Aug 12", action: "Reschedule" },
    ],
    milestones: [
      { type: "Course", title: "Architecting payment systems at scale", state: "done", meta: "Completed Jun 20 · 6h", fromHub: true },
      { type: "Stretch", title: "Lead payments v2 replatform", state: "active", pct: 60, meta: "Due Sep 30" },
      { type: "Mentoring", title: "Mentor Chidi Okeke (L4, Payments)", state: "active", meta: "3 of 6 sessions" },
      { type: "Certification", title: "AWS Solutions Architect — Professional", state: "todo", meta: "Target Nov 2026" },
    ],
    ai: {
      insight: "Q2 review flags “time management” at-risk while the Technical-leadership gap is 0.8 — a delegation pattern.",
      suggestion: "Delegation workshop (2-day)", type: "Course",
      confidence: 82, evidence: "Q2 review + gap map",
    },
  },
  {
    emp: byId("E-0129"), target: "HSE Manager", track: "L3 → M1 · HSE & Compliance", readiness: 68,
    est: "3 quarters", sponsor: "Chinedu Eze",
    seed: "Seeded from mobility match 81%", seedGo: "mobility",
    gaps: [
      { skill: "Incident investigation", have: 4.5, want: 4.5 },
      { skill: "Audit leadership", have: 4.2, want: 4.0 },
      { skill: "Regulatory strategy (NCDMB/DPR)", have: 3.1, want: 4.0 },
      { skill: "Team leadership", have: 3.4, want: 4.0 },
      { skill: "Budget ownership", have: 2.4, want: 3.5 },
    ],
    assessments: [
      { title: "HSE technical assessment", assessor: "Chinedu Eze", init: "CE", tone: "#16B364", status: "done", score: "4.3/5", when: "Assessed Jun 30", action: "View" },
      { title: "Leadership readiness", assessor: "External panel (2 assessors)", status: "scheduled", when: "Sep 3", action: "Reschedule" },
    ],
    milestones: [
      { type: "Course", title: "ISO 45001 lead-implementer course", state: "done", meta: "Completed May 30 · 12h", fromHub: true },
      { type: "Stretch", title: "Run the PH site audit cycle end-to-end", state: "active", pct: 45, meta: "Due Oct 15" },
      { type: "Mentoring", title: "Shadow Chinedu Eze on regulator visits", state: "active", meta: "2 of 5 visits" },
      { type: "Certification", title: "Renew First Aid at Work (expired Jul 2026)", state: "todo", meta: "Book by Sep 15" },
    ],
    ai: {
      insight: "Budget-ownership gap is 1.1 and the plan has no finance exposure yet.",
      suggestion: "Co-own the Q4 HSE budget draft with Finance", type: "Stretch",
      confidence: 76, evidence: "gap map + HSE Manager role profile",
    },
  },
  {
    emp: byId("E-0165"), target: "Head of Growth", track: "M1 → M2 · Commercial", readiness: 61,
    est: "3 quarters", sponsor: "Aisha Bello",
    seed: "Seeded from Q2 review · QoH 4.1", seedGo: "reviews",
    gaps: [
      { skill: "Lifecycle marketing", have: 4.3, want: 4.0 },
      { skill: "Analytics & experimentation", have: 4.0, want: 4.5 },
      { skill: "Team leadership", have: 3.2, want: 4.0 },
      { skill: "P&L ownership", have: 2.7, want: 4.0 },
      { skill: "Brand strategy", have: 3.8, want: 4.0 },
    ],
    assessments: [
      { title: "Growth strategy case", assessor: "Aisha Bello", init: "AB", tone: "#EBA308", status: "done", score: "3.9/5", when: "Assessed Jul 8", action: "View" },
      { title: "Leadership readiness", assessor: "External panel (2 assessors)", status: "scheduled", when: "Aug 28", action: "Reschedule" },
    ],
    milestones: [
      { type: "Course", title: "Marketing analytics with SQL", state: "done", meta: "Completed Jun 5 · 8h", fromHub: true },
      { type: "Stretch", title: "Own the Q4 revenue-experiment roadmap", state: "active", pct: 30, meta: "Due Nov 30" },
      { type: "Mentoring", title: "Monthly growth reviews with Aisha Bello", state: "active", meta: "2 of 6 sessions" },
      { type: "Certification", title: "CIM Level 6 diploma", state: "todo", meta: "Cohort starts Oct" },
    ],
    ai: {
      insight: "P&L-ownership gap of 1.3 is the biggest blocker to Head-of-Growth readiness.",
      suggestion: "Finance for non-finance leaders (LBS Exec)", type: "Course",
      confidence: 79, evidence: "gap map + market role profiles",
    },
  },
];

const TYPE_TONE: Record<MilestoneType, PfTone> = {
  Course: "blue", Stretch: "purple", Mentoring: "green", Certification: "yellow",
};

const MILESTONE_TYPES: MilestoneType[] = ["Course", "Stretch", "Mentoring", "Certification"];

const first = (name: string) => name.split(" ")[0];

const gapOf = (g: Gap) => Math.max(0, Math.round((g.want - g.have) * 10) / 10);

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none",
} as const;

/* ------------------------------- readiness ring ---------------------------- */

function ReadinessRing({ pct }: { pct: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", width: 84, height: 84, flex: "none" }}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={42} cy={42} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={8} />
        <circle
          cx={42} cy={42} r={R} fill="none" stroke="var(--pf-primary-500)" strokeWidth={8}
          strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`}
          transform="rotate(-90 42 42)" style={{ transition: "stroke-dasharray .4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 10, color: "var(--pf-n400)", marginTop: 3 }}>ready</span>
      </div>
    </div>
  );
}

/* ------------------------------- plan selector ----------------------------- */

function PersonCard({ plan, selected, onSelect }: { plan: Plan; selected: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  const e = plan.emp;
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        background: "var(--pf-n0)", borderRadius: 12, padding: 14, cursor: "pointer",
        border: `1px solid ${selected ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
        boxShadow: selected ? "0 0 0 1px var(--pf-primary-500), 0 1px 3px 0 #f3f3f3" : "0 1px 3px 0 #f3f3f3",
        transition: "border-color .12s ease, box-shadow .12s ease, background .12s ease",
        ...(hovered && !selected ? { background: "var(--pf-n25)" } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PfAvatar init={e.init} tone={e.tone} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", whiteSpace: "nowrap" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{e.role}</span>
            <Ic name="arrowright" size={11} color="var(--pf-n300)" />
            <span style={{ fontWeight: 500, color: "var(--pf-n600)", flex: "none" }}>{plan.target}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: selected ? "var(--pf-primary-500)" : "var(--pf-n900)", letterSpacing: "-.2px" }}>{plan.readiness}%</div>
          <div style={{ fontSize: 10.5, color: "var(--pf-n300)" }}>ready</div>
        </div>
      </div>
      <div style={{ marginTop: 11 }}><PfProgress pct={plan.readiness} height={5} /></div>
    </div>
  );
}

/* ------------------------------- gap-to-target ----------------------------- */

function GapRow({ g, target, personFirst, last }: { g: Gap; target: string; personFirst: string; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const gap = gapOf(g);
  const met = gap === 0;
  const tone: PfTone = met ? "green" : gap >= 1 ? "red" : "yellow";
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`${g.skill} — ${personFirst} performing ${g.have.toFixed(1)} (Q2 review) vs ${g.want.toFixed(1)} on the ${target} profile`)}
      style={{ padding: "11px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.skill}</span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: "none" }}>
          <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{g.have.toFixed(1)}</span>
          {" → "}
          <span style={{ fontWeight: 600, color: "var(--pf-blue-500)" }}>{g.want.toFixed(1)}</span>
        </span>
        <PfBadge tone={tone}>{met ? "Met" : `Gap ${gap.toFixed(1)}`}</PfBadge>
      </div>
      {/* double bar — performing (green) vs target (blue) on the same /5 scale */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
        {[[g.have, "var(--pf-primary-500)"], [g.want, "var(--pf-blue-500)"]].map(([v, color], i) => (
          <div key={i} style={{ height: 6, borderRadius: 3, background: "var(--pf-n50)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((v as number) / 5) * 100}%`, borderRadius: 3, background: String(color), transition: "width .3s ease" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- assessments ------------------------------ */

function AssessmentRow({ a, person, last }: { a: Assessment; person: string; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const done = a.status === "done";
  return (
    <div
      {...hoverProps}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfTile icon={done ? "clipboard" : "users"} tone={done ? "blue" : "purple"} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 12, color: "var(--pf-n400)" }}>
          {a.init && <PfAvatar init={a.init} tone={a.tone} size={16} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.assessor} · {a.when}</span>
        </div>
      </div>
      <PfBadge tone={done ? "green" : "yellow"}>{done ? `Done · ${a.score}` : a.when}</PfBadge>
      <PfBtn
        small variant="secondary"
        onClick={() =>
          a.action === "View"
            ? toast(`Opening ${a.title} write-up — ${a.score} by ${a.assessor} (${person})`)
            : toast(`Reschedule request sent to the ${a.assessor.toLowerCase()} — ${a.title} for ${person}`)
        }
      >
        {a.action}
      </PfBtn>
    </div>
  );
}

/* -------------------------------- milestones ------------------------------- */

function MilestoneRow({ m, person, onToggle }: { m: Milestone; person: string; onToggle: () => void }) {
  const go = useGo();
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const stateIcon =
    m.state === "done" ? (
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Ic name="check" size={11} color="#fff" weight={2.4} />
      </span>
    ) : (
      <span style={{ width: 18, height: 18, borderRadius: "50%", border: `1.6px solid ${m.state === "active" ? "var(--pf-blue-500)" : "var(--pf-n100)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        {m.state === "active" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-blue-500)" }} />}
      </span>
    );
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`Opening milestone — “${m.title}” (${person}'s plan)`)}
      style={{ padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={m.state === "done" ? "Mark not done" : "Mark done"}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", marginTop: 1 }}
        >
          {stateIcon}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: m.state === "done" ? "var(--pf-n400)" : "var(--pf-n900)", textDecoration: m.state === "done" ? "line-through" : "none" }}>{m.title}</span>
            <PfBadge tone={TYPE_TONE[m.type]}>{m.type}</PfBadge>
            {m.fromHub && (
              <button
                onClick={(e) => { e.stopPropagation(); go("learning"); }}
                style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
              >
                ✦ from Learning hub
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{m.meta}</div>
          {m.state === "active" && m.pct != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
              <div style={{ flex: 1 }}><PfProgress pct={m.pct} height={6} /></div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)" }}>{m.pct}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function GrowthPlans() {
  const go = useGo();
  const toast = useToast();

  const [sel, setSel] = useState(PLANS[0].emp.id); // default: Amara (PRD worked example)
  const [milestones, setMilestones] = useState<Record<string, Milestone[]>>(
    () => Object.fromEntries(PLANS.map((p) => [p.emp.id, p.milestones]))
  );
  const [aiOpen, setAiOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PLANS.map((p) => [p.emp.id, true]))
  );
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState<MilestoneType>("Course");
  const [newTitle, setNewTitle] = useState("");
  const [tab, setTab] = useState("plan");

  const plan = PLANS.find((p) => p.emp.id === sel) ?? PLANS[0];
  const fname = first(plan.emp.name);
  const list = milestones[sel] ?? [];
  const doneCount = list.filter((m) => m.state === "done").length;
  const openGaps = plan.gaps.filter((g) => gapOf(g) > 0).length;

  const selectPerson = (id: string) => {
    setSel(id);
    setAddOpen(false);
    setNewTitle("");
  };

  const appendMilestone = (m: Milestone) =>
    setMilestones((prev) => ({ ...prev, [sel]: [...(prev[sel] ?? []), m] }));

  const toggleMilestone = (idx: number) => {
    const m = list[idx];
    const nowDone = m.state !== "done";
    setMilestones((prev) => ({
      ...prev,
      [sel]: (prev[sel] ?? []).map((x, i) =>
        i === idx ? { ...x, state: nowDone ? "done" : x.pct != null ? "active" : "todo" } : x
      ),
    }));
    toast(nowDone ? `Milestone done — “${m.title}” (${fname}'s plan)` : `“${m.title}” moved back to in-progress`, nowDone ? "success" : "default");
  };

  const saveMilestone = () => {
    const title = newTitle.trim();
    if (!title) { toast("Give the milestone a title first"); return; }
    appendMilestone({ type: newType, title, state: "todo", meta: "Added today · unscheduled" });
    toast(`Milestone added to ${fname}'s plan — “${title}”`, "success");
    setNewTitle("");
    setAddOpen(false);
  };

  const acceptAi = () => {
    appendMilestone({ type: plan.ai.type, title: plan.ai.suggestion, state: "todo", meta: "AI-suggested · pending schedule" });
    setAiOpen((prev) => ({ ...prev, [sel]: false }));
    toast(`Added “${plan.ai.suggestion}” to ${fname}'s plan — you approved the suggestion`, "ai");
  };

  const dismissAi = () => {
    setAiOpen((prev) => ({ ...prev, [sel]: false }));
    toast(`Suggestion dismissed — ${fname}'s plan unchanged (logged for model feedback)`);
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Growth plans</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Target-role progression on the unified skill taxonomy — gap, time-to-ready and the milestones that close it (FR-070).
          </div>
        </div>
        <PfBtn variant="secondary" icon="download" onClick={() => toast("Growth-plan pack exported — 3 selected plans (PDF)")}>Export</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => toast("Plan builder opened — pick a target role to seed the gap map", "success")}>New plan</PfBtn>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="trend" tone="green" label="Live plans" value="214" unit="active" delta="≥70% by month 12" deltaTone="blue" />
        <PfStat icon="clock" tone="blue" label="Avg time-to-ready" value="2.3" unit="quarters" delta="−0.4 vs H1" deltaTone="green" />
        <PfStat icon="check" tone="purple" label="Milestones done" value="41" unit="this quarter" delta="↗ +9 QoQ" deltaTone="green" />
        <PfStat icon="swap" tone="yellow" label="Internal fills from plans" value="6" unit="roles YTD" delta="↗ 2 this Q" deltaTone="green" />
      </div>

      {/* Plan selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        {PLANS.map((p) => (
          <PersonCard key={p.emp.id} plan={p} selected={p.emp.id === sel} onSelect={() => selectPerson(p.emp.id)} />
        ))}
      </div>

      {/* --------------- Section tabs — the selected plan's sections --------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "plan", label: "Plan & gap map", count: String(openGaps) },
            { key: "assessments", label: "Assessments", count: String(plan.assessments.length) },
            { key: "milestones", label: "Milestones", count: `${doneCount}/${list.length}` },
          ]}
        />
      </div>

      {/* ---------------------- Plan — readiness + gap map ---------------------- */}
      {tab === "plan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Selected-plan header */}
          <PfCard pad={20}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              <ReadinessRing pct={plan.readiness} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n400)" }}>{plan.emp.role}</span>
                  <Ic name="arrowright" size={15} color="var(--pf-n300)" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>{plan.target}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5 }}>
                  {plan.track} · Sponsor <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{plan.sponsor}</span> · {plan.emp.loc}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => go(plan.seedGo)}
                    title="One person record across hiring, reviews and growth (FR-075)"
                    style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                  >
                    ✦ {plan.seed}
                  </button>
                  <PfBadge tone="grey">{plan.emp.grade} · {plan.emp.dept}</PfBadge>
                </div>
              </div>
              {/* gap + estimate cells (kit-growth-plan anatomy) */}
              <div style={{ borderLeft: "1px solid var(--pf-n50)", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 14, flex: "none", minWidth: 148 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Gap to target</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>
                      {100 - plan.readiness}%<span style={{ fontSize: 12, fontWeight: 400, color: "var(--pf-n300)" }}>/100</span>
                    </span>
                    <PfBadge tone={plan.readiness >= 70 ? "green" : "yellow"}>{plan.readiness >= 70 ? "On plan" : "Building"}</PfBadge>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Estimated time</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", marginTop: 3 }}>
                    {plan.est} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--pf-n300)" }}>from now</span>
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* Gap-to-target */}
          <PfCard>
            <PfCardHead title="Gap to target" sub={`Performing vs ${plan.target} bar — click a competency for the evidence.`}>
              <div style={{ display: "flex", gap: 12 }}>
                {[["Performing", "var(--pf-primary-500)"], ["Target", "var(--pf-blue-500)"]].map(([label, color]) => (
                  <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n600)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </PfCardHead>
            {plan.gaps.map((g, i) => (
              <GapRow key={g.skill} g={g} target={plan.target} personFirst={fname} last={i === plan.gaps.length - 1} />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Same 5-point taxonomy as hiring scorecards &amp; review ratings — gaps need no re-mapping across modules.
            </div>
          </PfCard>
        </div>
      )}

      {/* ------------------------------ Assessments ------------------------------ */}
      {tab === "assessments" && (
          <PfCard>
            <PfCardHead title="Assessments" sub="Structured checkpoints with named assessors.">
              <PfBtn small variant="secondary" icon="plus" onClick={() => toast(`Assessment request drafted for ${fname} — pick an assessor to send`)}>Request</PfBtn>
            </PfCardHead>
            {plan.assessments.map((a, i) => (
              <AssessmentRow key={a.title} a={a} person={fname} last={i === plan.assessments.length - 1} />
            ))}
          </PfCard>
      )}

      {/* ------------------- Milestones + review hand-off ------------------- */}
      {tab === "milestones" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Learning milestones */}
          <PfCard>
            <PfCardHead title="Learning milestones" sub="Courses, certifications, mentoring, stretch projects.">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n600)" }}>{doneCount}/{list.length} done</span>
              <div style={{ width: 56 }}><PfProgress pct={list.length ? (doneCount / list.length) * 100 : 0} height={6} /></div>
            </PfCardHead>

            {list.map((m, i) => (
              <MilestoneRow key={`${m.title}-${i}`} m={m} person={fname} onToggle={() => toggleMilestone(i)} />
            ))}

            {/* inline add */}
            {addOpen ? (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={newType} onChange={(e) => setNewType(e.target.value as MilestoneType)} style={{ ...fieldStyle, flex: "none" }}>
                    {MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveMilestone(); }}
                    placeholder={`e.g. Present at ${plan.emp.dept} town hall`}
                    style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
                  />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                  <PfBtn small variant="ghost" onClick={() => { setAddOpen(false); setNewTitle(""); }}>Cancel</PfBtn>
                  <PfBtn small variant="primary" onClick={saveMilestone}>Save</PfBtn>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddOpen(true)}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "12px 20px", background: "none", border: "none", borderBottom: "1px solid var(--pf-n50)", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--pf-n500)" }}
              >
                <Ic name="plus" size={14} color="var(--pf-n400)" /> Add milestone
              </button>
            )}

            {/* AI recommends — proposes, you dispose */}
            {aiOpen[sel] && (
              <div style={{ background: "var(--pf-purple-50)", padding: "13px 20px" }}>
                <div style={{ display: "flex", gap: 9 }}>
                  <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>AI recommends</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.5 }}>
                      {plan.ai.insight} Suggests <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>&ldquo;{plan.ai.suggestion}&rdquo;</span> as a {plan.ai.type.toLowerCase()} milestone.
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4 }}>
                      Confidence {plan.ai.confidence}% · evidence: {plan.ai.evidence}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                      <PfBtn
                        small variant="primary" tone={TONE.purple.bg as string}
                        style={{ boxShadow: "0 6px 12px -6px rgba(175,82,222,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
                        onClick={acceptAi}
                      >
                        Accept
                      </PfBtn>
                      <PfBtn small variant="secondary" onClick={dismissAi}>Dismiss</PfBtn>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </PfCard>

          {/* FR-067 footer link */}
          <PfBanner cta="open" onCta={() => go("reviews")}>
            <span style={{ fontWeight: 600 }}>Next review checks this plan (FR-067) — </span>
            <span style={{ fontWeight: 400 }}>{fname}&rsquo;s readiness and milestone completion feed the Q3 2026 cycle automatically.</span>
          </PfBanner>
        </div>
      )}
    </div>
  );
}
