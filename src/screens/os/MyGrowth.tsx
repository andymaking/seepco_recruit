"use client";
import { Fragment, useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfBanner, PfPageTabs, PfTh, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_SQUAD, MY_PLAN, MY_GAPS, MY_ASSESSMENTS, MY_MILESTONES,
  MY_AI_SUGGESTION, MY_SKILL_TRACK, MY_BASELINE_GAPS, MY_DEMAND, MY_TIMELINE_SELF,
  MY_EXPLANATION,
} from "@/data/me";

/**
 * My growth plan (route /my-growth) — the subject's side of FR-070.
 *
 * GrowthPlans.tsx is the manager's read of the same plan: it opens with a
 * person-selector exposing two colleagues' full gap maps and sponsors, tops the
 * page with an org strip (214 live plans · 41 milestones · 6 internal fills) and
 * offers an export-all CTA. None of that is hers to see, so none of it is here.
 * What IS hers: the readiness estimate and how it was worked out, her gap map,
 * her assessments, her milestones — and the two things the employer view never
 * shows her at all: how far she has moved since she was hired, and the baseline
 * she wrote herself the day she claimed her profile.
 *
 * Everything on this page is second person, sourced from @/data/me, and written
 * so that AI proposes and she disposes. Writes go through useMe().
 */

/* ---------------------------------- types ---------------------------------- */

type MyMilestone = {
  type: string; title: string; state: "done" | "active" | "todo";
  meta: string; pct?: number; tag?: string;
};

type MyAssessment = {
  title: string; assessor: string; init?: string; tone?: string;
  status: "done" | "scheduled"; score?: string; when: string;
};

type Gap = { skill: string; have: number; want: number };

/** Market demand only — `n` (how many people hold a skill) is deliberately not
 *  on this type, so a holder count cannot reach the page even by accident. */
type DemandCluster = { name: string; skills: readonly { s: string; demand: number }[] };

/* ------------------------------ derived data ------------------------------- */

const TYPE_TONE: Record<string, PfTone> = {
  Course: "blue", Stretch: "purple", Mentoring: "green", Certification: "yellow",
};

const MILESTONE_TYPES = ["Course", "Stretch", "Mentoring", "Certification"];

const BASE_MILESTONES: MyMilestone[] = MY_MILESTONES.map((m) => ({
  type: m.type, title: m.title, state: m.state, meta: m.meta,
  pct: "pct" in m ? m.pct : undefined,
}));

const ASSESSMENTS: MyAssessment[] = MY_ASSESSMENTS.map((a) => ({
  title: a.title, assessor: a.assessor, status: a.status, when: a.when,
  init: "init" in a ? a.init : undefined,
  tone: "tone" in a ? a.tone : undefined,
  score: "score" in a ? a.score : undefined,
}));

const gapOf = (g: Gap) => Math.max(0, Math.round((g.want - g.have) * 10) / 10);

/** Biggest shortfall first — what actually moves her readiness reads at the top. */
const GAPS: Gap[] = [...MY_GAPS].sort((a, b) => gapOf(b) - gapOf(a));
const MET_COUNT = MY_GAPS.filter((g) => gapOf(g) === 0).length;
const OPEN_COUNT = MY_GAPS.length - MET_COUNT;
const BIGGEST = GAPS[0];
const SECOND = GAPS[1];

const AVG_GROWTH =
  Math.round((MY_SKILL_TRACK.reduce((a, s) => a + (s.score - s.hire), 0) / MY_SKILL_TRACK.length) * 10) / 10;

const CLUSTERS: readonly DemandCluster[] = MY_DEMAND;
const HELD = new Set(ME_PUBLIC.skills.map((s) => s.toLowerCase()));
const ENG = CLUSTERS.find((c) => c.name === ME_PUBLIC.dept);

type DemandRowT = { skill: string; demand: number; held: boolean };
const DEMAND: DemandRowT[] = (ENG?.skills ?? [])
  .map((s) => ({ skill: s.s, demand: s.demand, held: HELD.has(s.s.toLowerCase()) }))
  .sort((a, b) => (a.held === b.held ? b.demand - a.demand : a.held ? -1 : 1));

/** Her plan's current read of a baseline skill, where the Staff profile tracks it. */
const nowFor = (skill: string) => MY_GAPS.find((g) => g.skill.toLowerCase().startsWith(skill.toLowerCase()))?.have;

/** RIGHT_TO_EXPLANATION carries this decision by name — the readiness number on this very page. */
const EXPLAIN = MY_EXPLANATION.decisions.find((d) => d.what === "Growth readiness estimate");

const AGENDA_ITEM = `Staff-track readiness — ${BIGGEST.skill} & ${SECOND.skill}`;

const pctOf5 = (v: number) => (v / 5) * 100;

const chipBtn = {
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
  fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)",
  border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer",
} as const;

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none",
} as const;

const footNote = {
  display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)",
  borderTop: "1px solid var(--pf-n50)", borderRadius: "0 0 12px 12px", fontSize: 12, color: "var(--pf-n400)",
} as const;

/* ------------------------------ readiness ring ----------------------------- */

function ReadinessRing({ pct }: { pct: number }) {
  const R = 36;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", width: 90, height: 90, flex: "none" }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={9} />
        <circle
          cx={45} cy={45} r={R} fill="none" stroke="var(--pf-primary-500)" strokeWidth={9}
          strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`}
          transform="rotate(-90 45 45)" style={{ transition: "stroke-dasharray .4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 10, color: "var(--pf-n400)", marginTop: 3 }}>ready</span>
      </div>
    </div>
  );
}

/* -------------------------------- gap rows --------------------------------- */

function GapRow({ g, last }: { g: Gap; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const gap = gapOf(g);
  const met = gap === 0;
  const tone: PfTone = met ? "green" : gap >= 0.8 ? "red" : "yellow";
  return (
    <div
      {...hoverProps}
      onClick={() =>
        toast(
          met
            ? `${g.skill} — you are at ${g.have.toFixed(1)}, already past the ${g.want.toFixed(1)} the Staff Engineer profile asks for`
            : `${g.skill} — you are at ${g.have.toFixed(1)} against a ${g.want.toFixed(1)} bar · ${gap.toFixed(1)} left to close`
        )
      }
      style={{ padding: "12px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.skill}</span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: "none" }}>
          you <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{g.have.toFixed(1)}</span>
          <span style={{ color: "var(--pf-n300)" }}>{" · bar "}</span>
          <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{g.want.toFixed(1)}</span>
        </span>
        <PfBadge tone={tone}>{met ? "Met" : `${gap.toFixed(1)} to close`}</PfBadge>
      </div>
      {/* one 5-point track: your level in green, the shortfall called out, the bar as a hard mark */}
      <div style={{ position: "relative", height: 8, borderRadius: 4, background: "var(--pf-n50)", marginTop: 9 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pctOf5(g.have)}%`, borderRadius: 4, background: "var(--pf-primary-500)", transition: "width .3s ease" }} />
        {!met && (
          <div style={{ position: "absolute", left: `${pctOf5(g.have)}%`, top: 0, bottom: 0, width: `${pctOf5(gap)}%`, borderRadius: "0 4px 4px 0", background: gap >= 0.8 ? "var(--pf-red-100)" : "var(--pf-yellow-100)" }} />
        )}
        <span style={{ position: "absolute", left: `${pctOf5(g.want)}%`, top: -3, bottom: -3, width: 2, borderRadius: 2, background: "var(--pf-n900)", transform: "translateX(-1px)" }} />
      </div>
    </div>
  );
}

/* ------------------------------- assessments ------------------------------- */

function AssessmentRow({ a, last }: { a: MyAssessment; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const done = a.status === "done";
  return (
    <div
      {...hoverProps}
      style={{ padding: "13px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <PfTile icon={done ? "clipboard" : "calendar"} tone={done ? "blue" : "purple"} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: 12, color: "var(--pf-n400)", minWidth: 0 }}>
            {a.init && <PfAvatar init={a.init} tone={a.tone} size={16} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.assessor}</span>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
        <PfBadge tone={done ? "green" : "yellow"} dot>{done ? `Assessed ${a.score}` : "Scheduled"}</PfBadge>
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{a.when.replace("Assessed ", "")}</span>
        <span style={{ flex: 1 }} />
        <PfBtn
          small
          onClick={() =>
            done
              ? toast(`Opening your ${a.title.toLowerCase()} write-up — ${a.score}, assessed by ${a.assessor} on ${a.when.replace("Assessed ", "")}`)
              : toast(`Reschedule request sent for your ${a.title.toLowerCase()} — currently ${a.when}`, "success")
          }
        >
          {done ? "Read it" : "Reschedule"}
        </PfBtn>
      </div>
    </div>
  );
}

/* -------------------------------- milestones ------------------------------- */

function MilestoneRow({ m, onComplete }: { m: MyMilestone; onComplete: () => void }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const done = m.state === "done";
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`“${m.title}” — ${m.meta.toLowerCase()} · on your Staff-track plan`)}
      style={{ padding: "12px 20px", cursor: "pointer", borderBottom: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <button
          onClick={(e) => { e.stopPropagation(); if (!done) onComplete(); }}
          title={done ? "Logged on your growth record" : "Mark this done"}
          style={{ background: "none", border: "none", padding: 4, margin: "-3px -4px 0", cursor: done ? "default" : "pointer", display: "inline-flex" }}
        >
          {done ? (
            <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Ic name="check" size={11} color="#fff" weight={2.4} />
            </span>
          ) : (
            <span style={{ width: 18, height: 18, borderRadius: "50%", border: `1.6px solid ${m.state === "active" ? "var(--pf-blue-500)" : "var(--pf-n100)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              {m.state === "active" && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-blue-500)" }} />}
            </span>
          )}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: done ? "var(--pf-n400)" : "var(--pf-n900)", textDecoration: done ? "line-through" : "none" }}>{m.title}</span>
            <PfBadge tone={TYPE_TONE[m.type] ?? "grey"}>{m.type}</PfBadge>
            {m.tag && <PfBadge tone="grey">{m.tag}</PfBadge>}
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

/* ----------------------------- skills: then vs now -------------------------- */

function GrowthBar({ s, last }: { s: { name: string; score: number; hire: number }; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const delta = s.score - s.hire;
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`${s.name} — ${s.hire} when you were hired in Nov 2023, ${s.score} today. That is ${delta} points you added.`)}
      style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.15fr) minmax(120px,1.7fr) 48px 48px 56px", alignItems: "center", gap: 12, padding: "13px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
      <div style={{ position: "relative", height: 10, borderRadius: 5, background: "var(--pf-n50)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${s.hire}%`, background: "var(--pf-blue-500)" }} />
        <div style={{ position: "absolute", left: `${s.hire}%`, top: 0, bottom: 0, width: `${delta}%`, background: "var(--pf-primary-500)", transition: "width .3s ease" }} />
        <span style={{ position: "absolute", left: `${s.hire}%`, top: 0, bottom: 0, width: 2, background: "var(--pf-n0)", transform: "translateX(-1px)" }} />
      </div>
      <span style={{ fontSize: 12, color: "var(--pf-n400)", textAlign: "right" }}>{s.hire}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", textAlign: "right", letterSpacing: "-.2px" }}>{s.score}</span>
      <span style={{ justifySelf: "end" }}><PfBadge tone="green">+{delta}</PfBadge></span>
    </div>
  );
}

/* ------------------------- skills: your own baseline ------------------------ */

function BaselineRow({ b, last }: { b: { skill: string; have: number; need: number }; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const now = nowFor(b.skill);
  const nodes: { v: string; cap: string; tone: string; hollow?: boolean }[] = [
    { v: b.have.toFixed(1), cap: "at claim time", tone: "var(--pf-n300)" },
    ...(now != null ? [{ v: now.toFixed(1), cap: "on your plan today", tone: "var(--pf-primary-500)" }] : []),
    { v: b.need.toFixed(1), cap: "the level you set", tone: "var(--pf-blue-500)", hollow: true },
  ];
  const moved = now != null ? Math.round((now - b.have) * 10) / 10 : null;
  return (
    <div
      {...hoverProps}
      onClick={() =>
        toast(
          moved != null
            ? `${b.skill} — you put yourself at ${b.have.toFixed(1)} when you claimed your profile. Your plan reads ${now?.toFixed(1)} today: +${moved.toFixed(1)}.`
            : `${b.skill} — your own claim-time baseline was ${b.have.toFixed(1)}, target ${b.need.toFixed(1)}. Nobody else has scored it since.`
        )
      }
      style={{ padding: "14px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{b.skill}</span>
        {moved != null
          ? <PfBadge tone="green" dot>+{moved.toFixed(1)} since</PfBadge>
          : <PfBadge tone="grey">Not re-scored</PfBadge>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", marginTop: 12 }}>
        {nodes.map((n, i) => (
          <Fragment key={n.cap}>
            {i > 0 && <div style={{ flex: 1, height: 2, background: "var(--pf-n50)", margin: "6px 8px 0" }} />}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: "none", width: 84 }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: n.hollow ? "var(--pf-n0)" : n.tone, border: `2px solid ${n.tone}`, flex: "none" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", lineHeight: 1 }}>{n.v}</span>
              <span style={{ fontSize: 10.5, color: "var(--pf-n400)", textAlign: "center", lineHeight: 1.3 }}>{n.cap}</span>
            </div>
          </Fragment>
        ))}
      </div>
      {moved == null && (
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8 }}>
          {b.skill} is not on the Staff Engineer profile, so your plan does not re-score it — this stays your own number until you change it.
        </div>
      )}
    </div>
  );
}

/* --------------------------------- demand ---------------------------------- */

function DemandRow({ d, last }: { d: DemandRowT; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`${d.skill} — demand ${d.demand} across open roles${d.held ? ", and it is on your profile" : ""}. Demand is about roles, never about people.`)}
      style={{ display: "grid", gridTemplateColumns: "1fr 96px 30px", alignItems: "center", gap: 12, padding: "11px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.skill}</span>
        {d.held && <PfBadge tone="green">Yours</PfBadge>}
      </span>
      <PfProgress pct={d.demand} tone={d.held ? "green" : "blue"} height={7} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)", textAlign: "right" }}>{d.demand}</span>
    </div>
  );
}

/* -------------------------------- timeline --------------------------------- */

function TimelineNode({ icon, tone, title, date, sub, cta, onOpen, line, future }: {
  icon: string; tone: PfTone; title: string; date: string; sub: string;
  cta: string; onOpen: () => void; line: boolean; future?: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ display: "flex", gap: 14, padding: "14px 20px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ position: "relative", width: 34, flex: "none" }}>
        {future ? (
          <span style={{ width: 34, height: 34, borderRadius: 10, border: "1.6px dashed var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--pf-n300)" }}>
            <Ic name={icon} size={17} />
          </span>
        ) : (
          <PfTile icon={icon} tone={tone} size={34} />
        )}
        {line && <span style={{ position: "absolute", left: 16, top: 38, bottom: -30, width: 2, background: "var(--pf-n50)" }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: future ? "var(--pf-n500)" : "var(--pf-n900)" }}>{title}</span>
          <PfBadge tone={future ? "grey" : tone}>{date}</PfBadge>
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>{sub}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", marginTop: 7 }}>
          {cta} <Ic name="arrowright" size={12} color="var(--pf-n400)" />
        </div>
      </div>
      <Ic name="caretright" size={15} color={hovered ? "var(--pf-n400)" : "var(--pf-n300)"} />
    </div>
  );
}

/* ------------------------------ connect rows ------------------------------- */

function ConnectRow({ icon, tone, label, sub, onOpen, last }: {
  icon: string; tone: PfTone; label: string; sub: string; onOpen: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfTile icon={icon} tone={tone} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{sub}</div>
      </div>
      <Ic name="caretright" size={15} color={hovered ? "var(--pf-n400)" : "var(--pf-n300)"} />
    </div>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function MyGrowth() {
  const go = useGo();
  const toast = useToast();
  const me = useMe();

  const [tab, setTab] = useState("plan");
  const [extra, setExtra] = useState<MyMilestone[]>([]);
  const [aiOpen, setAiOpen] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState(MILESTONE_TYPES[0]);
  const [newTitle, setNewTitle] = useState("");
  const [agendaAdded, setAgendaAdded] = useState(false);

  /** MY_MILESTONES is the seed; useMe().milestonesDone is what you have ticked since. */
  const list = useMemo<MyMilestone[]>(
    () => [...BASE_MILESTONES, ...extra].map((m) => (me.milestonesDone.includes(m.title) ? { ...m, state: "done" as const } : m)),
    [extra, me.milestonesDone]
  );
  const doneCount = list.filter((m) => m.state === "done").length;
  const activeCount = list.filter((m) => m.state === "active").length;

  const explained = EXPLAIN ? me.explanationRequests.some((r) => r.what === EXPLAIN.what) : false;

  const completeMilestone = (title: string) => {
    me.completeMilestone(title);
    toast(`Milestone done — “${title}” is logged on your growth record`, "success");
  };

  const saveMilestone = () => {
    const title = newTitle.trim();
    if (!title) { toast("Give your milestone a title first"); return; }
    setExtra((prev) => [...prev, { type: newType, title, state: "todo", meta: "Added today · unscheduled", tag: "Added by you" }]);
    toast(`Added to your plan — “${title}”`, "success");
    setNewTitle("");
    setAddOpen(false);
  };

  const acceptAi = () => {
    setExtra((prev) => [...prev, {
      type: MY_AI_SUGGESTION.type, title: MY_AI_SUGGESTION.suggestion, state: "todo",
      meta: "Suggested by your plan assistant · unscheduled", tag: "You accepted it",
    }]);
    setAiOpen(false);
    toast(`“${MY_AI_SUGGESTION.suggestion}” added to your plan — you accepted it`, "ai");
  };

  const dismissAi = () => {
    setAiOpen(false);
    toast("Suggestion dismissed — your plan is unchanged. Nothing is added to it without you.");
  };

  const addToAgenda = () => {
    if (agendaAdded) { go("myoneonones"); return; }
    me.addAgendaItem(AGENDA_ITEM);
    setAgendaAdded(true);
    toast(`Added to your next 1-on-1 with ${MY_MANAGER.name} — “${AGENDA_ITEM}”`, "success");
  };

  const askExplanation = () => {
    if (!EXPLAIN) return;
    me.requestExplanation(EXPLAIN.what, MY_EXPLANATION.slaDays);
    toast(`Explanation requested — “${EXPLAIN.what}”. A person replies within ${MY_EXPLANATION.slaDays} days.`, "success");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your growth plan</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Where you stand against the {MY_PLAN.target} bar, what closes the gap, and how far you have come since you were hired.
            Your manager sponsors this plan — you own it.
          </div>
        </div>
        <PfBtn icon="book" onClick={() => go("mylearning")}>Your learning</PfBtn>
        <PfBtn variant="primary" icon="chat" onClick={addToAgenda}>
          {agendaAdded ? "Open your 1-on-1" : "Add to your 1-on-1"}
        </PfBtn>
      </div>

      {/* KPI strip — every number here is about you, and only you */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="target" tone="green" label="Readiness" value={MY_PLAN.readiness} unit="% ready" delta="On plan" deltaTone="green" />
        <PfStat icon="gauge" tone="yellow" label="Gaps still open" value={OPEN_COUNT} unit={`of ${MY_GAPS.length}`} delta={`${MET_COUNT} already met`} deltaTone="green" />
        <PfStat icon="check" tone="purple" label="Milestones done" value={`${doneCount}/${list.length}`} unit="on plan" delta={`${activeCount} in progress`} deltaTone="blue" />
        <PfStat icon="trend" tone="blue" label="Growth since hire" value={`+${AVG_GROWTH}`} unit="pts avg" delta={`${MY_SKILL_TRACK.length} skills`} deltaTone="grey" />
      </div>

      {/* Page sections */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "plan", label: "Plan & milestones", count: `${doneCount}/${list.length}` },
            { key: "skills", label: "My skills", count: String(MY_SKILL_TRACK.length) },
            { key: "journey", label: "My journey", count: String(MY_TIMELINE_SELF.length) },
          ]}
        />
      </div>

      {/* ======================= PLAN & MILESTONES ======================= */}
      {tab === "plan" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Readiness header */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: 20, flexWrap: "wrap" }}>
              <ReadinessRing pct={MY_PLAN.readiness} />
              <div style={{ flex: 1, minWidth: 250 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n400)" }}>{ME_PUBLIC.role}</span>
                  <Ic name="arrowright" size={15} color="var(--pf-n300)" />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>{MY_PLAN.target}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5 }}>
                  {MY_PLAN.track} · Sponsored by <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{MY_PLAN.sponsor}</span> · {MY_SQUAD}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  <button onClick={() => go("myprofile")} title="One record across hiring, reviews and growth — and it is yours" style={chipBtn}>
                    ✦ {MY_PLAN.seed}
                  </button>
                  <PfBadge tone="grey">{ME_PUBLIC.grade} · {ME_PUBLIC.dept}</PfBadge>
                  <PfBadge tone="grey">Opened Jun 2026</PfBadge>
                </div>
              </div>
              <div style={{ borderLeft: "1px solid var(--pf-n50)", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 14, flex: "none", minWidth: 150 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Left to close</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>
                      {100 - MY_PLAN.readiness}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--pf-n300)" }}> points</span>
                    </span>
                    <PfBadge tone={MY_PLAN.readiness >= 70 ? "green" : "yellow"}>{MY_PLAN.readiness >= 70 ? "On plan" : "Building"}</PfBadge>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Estimated time</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", marginTop: 3 }}>
                    {MY_PLAN.est} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--pf-n300)" }}>from now</span>
                  </div>
                </div>
              </div>
            </div>

            {/* right to explanation — the readiness number, explained on request */}
            {EXPLAIN && (
              <div style={{ ...footNote, alignItems: "center" }}>
                <Ic name="shield" size={15} color="var(--pf-n300)" />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                  Your readiness estimate is worked out from{" "}
                  <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{EXPLAIN.basis.toLowerCase()}</span>{" "}
                  · visible to {EXPLAIN.who.toLowerCase()} · a person answers, not a model
                </div>
                {explained ? (
                  <>
                    <PfBadge tone="green" dot>Explanation requested</PfBadge>
                    <PfBtn small variant="ghost" onClick={() => go("myprivacy")}>Track it</PfBtn>
                  </>
                ) : (
                  <PfBtn small icon="question" onClick={askExplanation}>{EXPLAIN.yourMove}</PfBtn>
                )}
              </div>
            )}
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 12, alignItems: "start" }}>
            {/* ---------------- left: gaps, AI, milestones ---------------- */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <PfCard>
                <PfCardHead title={`Where you stand against the ${MY_PLAN.target} bar`} sub="Your level on the same 5-point taxonomy your reviews use. Click a competency for the read behind it.">
                  <PfBadge tone="green">{MET_COUNT} met</PfBadge>
                  <PfBadge tone="yellow">{OPEN_COUNT} to close</PfBadge>
                </PfCardHead>
                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)" }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: "var(--pf-primary-500)" }} /> You today
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)" }}>
                    <span style={{ width: 10, height: 6, borderRadius: 3, background: "var(--pf-red-100)" }} /> Still to close
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)" }}>
                    <span style={{ width: 2, height: 12, borderRadius: 2, background: "var(--pf-n900)" }} /> The {MY_PLAN.target} bar
                  </span>
                </div>
                {GAPS.map((g, i) => <GapRow key={g.skill} g={g} last={i === GAPS.length - 1} />)}
                <div style={footNote}>
                  <Ic name="info" size={13} color="var(--pf-n300)" />
                  <span style={{ lineHeight: 1.5 }}>
                    {MET_COUNT} of your {MY_GAPS.length} competencies already sit at or above the bar. What moves the remaining{" "}
                    {100 - MY_PLAN.readiness} points is {BIGGEST.skill.toLowerCase()} ({gapOf(BIGGEST).toFixed(1)}) and {SECOND.skill.toLowerCase()} ({gapOf(SECOND).toFixed(1)}).
                  </span>
                </div>
              </PfCard>

              {/* AI proposes — you dispose */}
              {aiOpen && (
                <PfBanner tone="purple" icon="sparkle">
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontWeight: 600 }}>Your plan assistant suggests one milestone</span>
                    <span style={{ fontWeight: 400, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                      {MY_AI_SUGGESTION.insight} It suggests{" "}
                      <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>&ldquo;{MY_AI_SUGGESTION.suggestion}&rdquo;</span>{" "}
                      as a {MY_AI_SUGGESTION.type.toLowerCase()} milestone.
                    </span>
                    <span style={{ fontSize: 11.5, fontWeight: 400, color: "var(--pf-n400)" }}>
                      Confidence {MY_AI_SUGGESTION.confidence}% · evidence: {MY_AI_SUGGESTION.evidence} · nothing joins your plan until you accept
                    </span>
                    <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                      <PfBtn
                        small variant="primary" tone="var(--pf-purple-500)"
                        style={{ boxShadow: "0 6px 12px -6px rgba(175,82,222,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
                        onClick={acceptAi}
                      >
                        Accept
                      </PfBtn>
                      <PfBtn small onClick={dismissAi}>Dismiss</PfBtn>
                    </div>
                  </div>
                </PfBanner>
              )}

              <PfCard>
                <PfCardHead title="Your milestones" sub="Courses, stretch work, mentoring and certifications that close the gap.">
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n600)" }}>{doneCount}/{list.length} done</span>
                  <div style={{ width: 56 }}><PfProgress pct={list.length ? (doneCount / list.length) * 100 : 0} height={6} /></div>
                </PfCardHead>

                {list.map((m, i) => (
                  <MilestoneRow key={`${m.title}-${i}`} m={m} onComplete={() => completeMilestone(m.title)} />
                ))}

                {addOpen ? (
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ ...fieldStyle, flex: "none" }}>
                        {MILESTONE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveMilestone(); }}
                        placeholder="e.g. Present the payments v2 design at the Engineering forum"
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
                    <Ic name="plus" size={14} color="var(--pf-n400)" /> Add a milestone of your own
                  </button>
                )}

                <div style={footNote}>
                  <Ic name="check" size={13} color="var(--pf-n300)" />
                  Ticking a milestone writes to your growth record and shows up in your own change log.
                </div>
              </PfCard>
            </div>

            {/* ---------------- right: assessments, sponsor ---------------- */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <PfCard>
                <PfCardHead title="Your assessments" sub="The structured checkpoints behind the readiness number." />
                {ASSESSMENTS.map((a, i) => <AssessmentRow key={a.title} a={a} last={i === ASSESSMENTS.length - 1} />)}
              </PfCard>

              <PfCard>
                <PfCardHead title="Your sponsor" sub="Backs the plan and makes the readiness call with you." />
                <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 20px" }}>
                  <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={38} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_MANAGER.name}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{MY_MANAGER.role}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, padding: "0 20px 16px" }}>
                  <PfBtn small icon="chat" onClick={() => go("myoneonones")}>Your 1-on-1</PfBtn>
                  <PfBtn small icon="megaphone" onClick={() => go("myfeedback")}>Ask for feedback</PfBtn>
                </div>
                <div style={footNote}>
                  <Ic name="shield" size={13} color="var(--pf-n300)" />
                  <span style={{ lineHeight: 1.5 }}>Your plan is shared with your sponsor. Who can see what else is on your data &amp; privacy page.</span>
                </div>
              </PfCard>

              <PfBanner cta="open" onCta={() => go("mylearning")}>
                <span style={{ fontWeight: 600 }}>Course milestones live in your learning — </span>
                <span style={{ fontWeight: 400 }}>pick up where you left off, or enrol in the next one.</span>
              </PfBanner>
            </div>
          </div>
        </div>
      )}

      {/* ============================ MY SKILLS ============================ */}
      {tab === "skills" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead title="Today, against the day you were hired" sub="Your skill profile now, beside the scores that came in with your hiring scorecard in Nov 2023.">
              <PfBadge tone="green" dot>+{AVG_GROWTH} pts on average</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(140px,1.15fr) minmax(120px,1.7fr) 48px 48px 56px", alignItems: "center", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Skill</PfTh>
              <PfTh>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 6, borderRadius: 3, background: "var(--pf-blue-500)" }} /> At hire
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 6, borderRadius: 3, background: "var(--pf-primary-500)" }} /> Added since
                  </span>
                </span>
              </PfTh>
              <PfTh style={{ textAlign: "right" }}>Hire</PfTh>
              <PfTh style={{ textAlign: "right" }}>Now</PfTh>
              <PfTh style={{ textAlign: "right" }}>Change</PfTh>
            </div>
            {MY_SKILL_TRACK.map((s, i) => <GrowthBar key={s.name} s={s} last={i === MY_SKILL_TRACK.length - 1} />)}
            <div style={footNote}>
              <Ic name="trend" size={13} color="var(--pf-n300)" />
              <span style={{ lineHeight: 1.5 }}>
                Both columns are yours: the left one came in with your offer in Nov 2023, the right one is your profile today.
                Nobody else&rsquo;s numbers appear on this page.
              </span>
            </div>
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="Where you started" sub="The six-answer baseline you wrote the day you claimed your profile.">
                <PfBadge tone="grey">{MY_BASELINE_GAPS.length} skills</PfBadge>
              </PfCardHead>
              {MY_BASELINE_GAPS.map((b, i) => <BaselineRow key={b.skill} b={b} last={i === MY_BASELINE_GAPS.length - 1} />)}
              <div style={footNote}>
                <Ic name="user" size={13} color="var(--pf-n300)" />
                <span style={{ lineHeight: 1.5 }}>
                  You set these levels and these targets yourself — they were never a rating. Your plan reads {MY_PLAN.target} at{" "}
                  {MY_GAPS.find((g) => g.skill === "Technical leadership")?.want.toFixed(1)} on technical leadership, which is the bar it measures you against.
                </span>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Market demand for your skills" sub={`How hard each ${ME_PUBLIC.dept.toLowerCase()} skill is to hire for right now.`} />
              <div style={{ padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <PfTh>Skills on your profile</PfTh>
              </div>
              {DEMAND.filter((d) => d.held).map((d, i, arr) => <DemandRow key={d.skill} d={d} last={i === arr.length - 1} />)}
              <div style={{ padding: "9px 20px", borderTop: "1px solid var(--pf-n50)", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <PfTh>Adjacent, and in demand</PfTh>
              </div>
              {DEMAND.filter((d) => !d.held).map((d, i, arr) => <DemandRow key={d.skill} d={d} last={i === arr.length - 1} />)}
              <div style={{ ...footNote, alignItems: "flex-start" }}>
                <Ic name="info" size={13} color="var(--pf-n300)" />
                <span style={{ flex: 1, lineHeight: 1.5 }}>
                  Demand is measured across open roles. It never shows how many people hold a skill, or who they are.
                </span>
                <PfBtn small variant="ghost" onClick={() => go("mymobility")}>See open roles</PfBtn>
              </div>
            </PfCard>
          </div>
        </div>
      )}

      {/* =========================== MY JOURNEY =========================== */}
      {tab === "journey" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 340px", gap: 12, alignItems: "start" }}>
          <PfCard>
            <PfCardHead title="Your journey so far" sub="Built from records already on your file — every step below is one you can open." />
            <div style={{ padding: "6px 0" }}>
              {MY_TIMELINE_SELF.map((t, i) => (
                <TimelineNode
                  key={t.title}
                  icon={t.icon}
                  tone={t.tone}
                  title={t.title}
                  date={t.date}
                  sub={t.sub}
                  line
                  cta={i === 0 ? "Your profile & documents" : i === 1 ? "Your review history" : "Open the plan"}
                  onOpen={() => (i === 0 ? go("myprofile") : i === 1 ? go("myreview") : setTab("plan"))}
                />
              ))}
              <TimelineNode
                icon="calendar"
                tone="grey"
                future
                line
                title={`${ASSESSMENTS[1]?.title ?? "Leadership readiness"} assessment`}
                date={ASSESSMENTS[1]?.when ?? "Scheduled"}
                sub={`${ASSESSMENTS[1]?.assessor ?? "External panel"} · the last checkpoint before the ${MY_PLAN.target} call`}
                cta="See it on your plan"
                onOpen={() => setTab("plan")}
              />
              <TimelineNode
                icon="target"
                tone="grey"
                future
                line={false}
                title={MY_PLAN.target}
                date={`est. ${MY_PLAN.est}`}
                sub={`${MY_PLAN.track} · ${MY_PLAN.readiness}% ready today · ${100 - MY_PLAN.readiness} points left to close`}
                cta="What closes the gap"
                onOpen={() => setTab("plan")}
              />
            </div>
            <div style={footNote}>
              <Ic name="clock" size={13} color="var(--pf-n300)" />
              <span style={{ lineHeight: 1.5 }}>
                {ME_PUBLIC.tenure} at the company, and one grade change. Anything that is not on your record is not on this timeline.
              </span>
            </div>
          </PfCard>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfCard>
              <PfCardHead title="This plan at a glance" />
              <div style={{ padding: "6px 20px 14px" }}>
                {[
                  { k: "Target", v: MY_PLAN.target },
                  { k: "Track", v: MY_PLAN.track },
                  { k: "Opened", v: "Jun 2026" },
                  { k: "Estimate", v: `${MY_PLAN.est} from now` },
                ].map((r) => (
                  <div key={r.k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                    <PfTh style={{ width: 84, flex: "none" }}>{r.k}</PfTh>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", textAlign: "right" }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                  <PfTh style={{ width: 84, flex: "none" }}>Sponsor</PfTh>
                  <span style={{ flex: 1, display: "inline-flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
                    <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={20} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{MY_PLAN.sponsor}</span>
                  </span>
                </div>
                <div style={{ paddingTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PfTh style={{ flex: 1 }}>Readiness</PfTh>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>{MY_PLAN.readiness}%</span>
                  </div>
                  <div style={{ marginTop: 7 }}><PfProgress pct={MY_PLAN.readiness} height={7} /></div>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Where this connects" sub="The same record, seen from its other sides." />
              {[
                { icon: "user", tone: "blue" as PfTone, label: "Your profile & documents", sub: "Offer, contracts, the fields you can correct", stage: "myprofile" },
                { icon: "clipboard", tone: "purple" as PfTone, label: "Your review", sub: "Self-assessment and your own history", stage: "myreview" },
                { icon: "swap", tone: "green" as PfTone, label: "Open roles inside", sub: "Where these skills are wanted today", stage: "mymobility" },
                { icon: "shield", tone: "yellow" as PfTone, label: "Your data & privacy", sub: "Who can see what, and every request you made", stage: "myprivacy" },
              ].map((r, i, arr) => (
                <ConnectRow key={r.stage} icon={r.icon} tone={r.tone} label={r.label} sub={r.sub} onOpen={() => go(r.stage)} last={i === arr.length - 1} />
              ))}
            </PfCard>
          </div>
        </div>
      )}
    </div>
  );
}
