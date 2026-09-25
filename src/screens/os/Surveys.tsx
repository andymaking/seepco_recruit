"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfSegments, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  SURVEY_DEFS, SURVEY_RUNS, SURVEY_TYPE_LABEL, ANONYMITY_LABEL, ANONYMITY_PROMISE,
  DRIVERS, driverMeta, RESULT_SLICES, slicesFor, sliceReport, SUPPRESSION_AUDIT,
  MIN_REPORTING_N, canReport, suppressionNote, rateOf, runStateTone,
  enpsScore, enpsBand, driverTone, SURVEY_COMMENTS, commentReviewQueue, commentStats,
  COMMENT_THEMES, themeWhy, SURVEY_ACCESS_LOG, SURVEY_INVITES, surveyDef, surveyRun,
  ENGAGE_TODAY, ENGAGE_MODEL_CARDS, ENGAGE_AI_SURFACES, LIKERT_ANCHORS,
  type ResultSlice, type SurveyComment, type DriverKey, type SliceKind,
  type CommentTheme, type EngageAccess, type SurveyDef, type AnonymityMode,
} from "@/data/engage";
import { DEPARTMENTS } from "@/data/talentos";
import { SITES } from "@/data/workforce";
import type { WhyThis } from "@/data/trust";

/**
 * Engagement surveys — PRD v2.1 FR-094, the HR/People side.
 *
 * The page is ordered around one claim: A SURVEY NOBODY ACTS ON IS WORSE THAN
 * NO SURVEY. Asking 331 people what is wrong and then publishing a dashboard
 * teaches them that answering is theatre, and the next round's response rate is
 * the receipt. So the first tab is not the score — it is what happened to the
 * last round's answers, action by action, including the one that was dropped
 * and the one nobody ever owned.
 *
 * The second load-bearing thing here is the reporting threshold. MIN_REPORTING_N
 * is not chrome: `sliceReport()` refuses on the count, and a suppressed slice in
 * engage.ts carries no `result` object at all. This screen renders the refusal
 * NEXT TO the slices that report, at the same size, because the suppression is
 * the feature — it is the only thing that makes an anonymous answer true.
 *
 * Free text is the re-identification surface, and the threshold does not cover
 * it: a slice of 39 clears n≥5 and a sentence inside it can still name exactly
 * one person. So every comment is unreleased until a named human clears it, and
 * the queue below shows a comment that proves the point.
 *
 * FR-093: MC-09 proposes comment themes. It is fed released comments only, it
 * carries a "Why this?" on every theme, and no theme reaches a report until a
 * human confirms it.
 */

/* --------------------------------- tokens --------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const ACTOR = "People Ops · Funke Adebayo";
const LIVE = "SR-31";

const RUN = surveyRun(LIVE)!;
const PRIOR = surveyRun("SR-28")!;
const AUDIT = SUPPRESSION_AUDIT();
const CSTATS = commentStats();

const ORG_SLICE = RESULT_SLICES.find((s) => s.id === "SL-01")!;
const ORG_REPORT = sliceReport(ORG_SLICE);
const ORG = ORG_REPORT.reportable ? ORG_REPORT.result : undefined;

const ENG_SLICE = RESULT_SLICES.find((s) => s.id === "SL-02")!;
const ENG_REPORT = sliceReport(ENG_SLICE);
const ENG = ENG_REPORT.reportable ? ENG_REPORT.result : undefined;

const orgDriver = (k: DriverKey) => ORG?.drivers.find((d) => d.key === k);

/** The steepest fall at org level — the page's whole argument hangs off it. */
const WORST = ORG ? [...ORG.drivers].sort((a, b) => a.delta - b.delta)[0] : undefined;

const fmtDelta = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)}`;
const dTone = (d: number): PfTone => (d > 0.05 ? "green" : d < -0.05 ? "red" : "grey");
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

const fieldStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 10px", outline: "none", width: "100%",
};

/** Session stamps derive from log length so SSR and the client agree. */
const stampAt = (n: number) => {
  const mins = 44 + n * 13;
  return `Aug 28 · ${String(9 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};

/* ============================ DERIVED: the action loop =====================
 * engage.ts holds the instrument, the runs, the slices and the comments. It
 * does not hold what anyone DID about the last round — there is no `Action`
 * type in the spine. These five rows are written here, and every one of them is
 * anchored to something the spine does hold: the driver it targeted, the org
 * delta between SR-28 and SR-31 (read live off SL-01, never typed in), and the
 * released comment or slice that is the evidence. `verdictOf()` computes the
 * outcome from the spine, so if a driver number changes the verdict changes
 * with it — an action cannot be recorded as "it worked" against a falling line.
 * ========================================================================== */

type LoopState = "Shipped" | "In flight" | "Dropped" | "Not started" | "Committed";

type LoopAction = {
  id: string; title: string; driver: DriverKey; owner: string; opened: string;
  state: LoopState; round: string; from: string; did: string; note?: string;
};

const LOOP_STATE_TONE: Record<LoopState, PfTone> = {
  Shipped: "green", "In flight": "blue", Committed: "purple", Dropped: "red", "Not started": "red",
};

const LOOP_SEED: LoopAction[] = [
  {
    id: "AC-24", title: "The date of the last 1:1 made impossible to miss", driver: "manager",
    owner: "People Ops · Funke Adebayo", opened: "Jun 3, 2026", state: "Shipped", round: `${PRIOR.id} · Q2`,
    from: "Manager support scored highest in Q2 and had the widest spread between departments — the average was hiding two different companies.",
    did: "Every manager surface now shows the date of the last 1:1 and the one before it. No new meeting was mandated. The gap was simply put where a manager cannot not see it.",
    note: "The cheapest action of the five and the only one that is still running.",
  },
  {
    id: "AC-21", title: "Learning entitlement published with the approval line stated", driver: "growth",
    owner: "People Ops · Funke Adebayo", opened: "Jun 10, 2026", state: "Shipped", round: `${PRIOR.id} · Q2`,
    from: "Growth sat flat in Q2 and the free text said people did not know what the budget was, not that there was none.",
    did: "The pool, the per-head draw and the ₦120,000 manager-approval threshold are on the handbook card and on every learning page. Nothing about the entitlement changed — only what people could see of it.",
    note: "Publishing a number is not the same as changing one. The score says so.",
  },
  {
    id: "AC-22", title: "Recognition written into the review packet", driver: "recognition",
    owner: "People Ops · Funke Adebayo", opened: "Jun 24, 2026", state: "In flight", round: `${PRIOR.id} · Q2`,
    from: "Recognition was the second-weakest driver in Q2, and the pattern in the comments was that praise stopped in the channel it happened in.",
    did: "Peer recognition now travels into the review packet as cited evidence. Live in Product & Design and Finance; not yet in Field Operations, where the shift pattern means most people are not in a channel at all.",
    note: "Half-shipped is why the org number moved by nothing. Product & Design +0.2, Field Operations −0.4, average −0.1.",
  },
  {
    id: "AC-23", title: "Quarterly results briefed at muster before the press release", driver: "trust",
    owner: "Executive · Folake Coker", opened: "Jun 5, 2026", state: "Dropped", round: `${PRIOR.id} · Q2`,
    from: "Q2 exit reasons and site free text both said the same thing: crews learn about the company from the news.",
    did: "Ran twice, in June and July. Nobody picked it up when the comms lead left in July and it was never formally closed — it simply stopped happening.",
    note: "This round CM-04 says it again, unprompted, from a 34-response department slice. Trust in Field Operations fell 0.5.",
  },
  {
    id: "AC-25", title: "Workload — nothing was ever committed", driver: "workload",
    owner: "Unassigned", opened: "—", state: "Not started", round: `${PRIOR.id} · Q2`,
    from: "Workload was already the weakest driver in Q2. It was discussed at the readout, minuted, and no owner was named.",
    did: "Nothing. SR-30 was opened this week to ask the same population a narrower question about the same thing.",
    note: "Asking again is not an action. It is the second time these people have answered a workload question and the first time anyone will owe them an answer.",
  },
];

const DRIVER_OWNERS = [
  "People Ops · Funke Adebayo",
  "Engineering · Ngozi Adeyemi",
  "Field Operations · Ibrahim Sani",
  "Executive · Folake Coker",
  "HSE & Compliance · Chinedu Eze",
];

/* ====================== DERIVED: the reviewer's raw text ====================
 * engage.ts stores held comment text as "[held]" on purpose — a shared module
 * that any screen can import must not carry the words of an unreleased comment.
 * The review queue is the one surface where a named human has to read the
 * sentence in order to judge it, so the raw text lives here, next to the queue
 * that renders it, and is never passed into a report, a theme or an export.
 * `risk` is the reviewer's classification, and it drives what the UI will let
 * them do: health detail has no release control at all.
 * ========================================================================== */

type RiskKind = "names-a-person" | "role-is-the-identifier" | "below-threshold" | "health" | "clear";

const RISK_LABEL: Record<RiskKind, string> = {
  "names-a-person": "Names a colleague",
  "role-is-the-identifier": "The role is the identifier",
  "below-threshold": `Slice under ${MIN_REPORTING_N}`,
  health: "Health detail",
  clear: "No flag raised",
};

const RISK_TONE: Record<RiskKind, PfTone> = {
  "names-a-person": "red", "role-is-the-identifier": "red", "below-threshold": "yellow", health: "purple", clear: "green",
};

const REVIEW_DRAFT: Record<string, { text: string; risk: RiskKind }> = {
  "CM-02": {
    risk: "names-a-person",
    text: "In the standup on the 14th I was told in front of the team that the migration slipping was mine to answer for. Four of us were in that room. Nobody corrected it and nobody has mentioned it since.",
  },
  "CM-03": {
    risk: "below-threshold",
    text: "Planning starts after the work has already started. Agreeing scope on the Monday instead of the Wednesday would fix most of it.",
  },
  "CM-05": {
    risk: "health",
    text: "I came off a hospital admission straight onto a 14-day tour because there was nobody to cover. I am not asking for sympathy. I am asking for a cover plan.",
  },
  "CM-08": {
    risk: "role-is-the-identifier",
    text: "As the only night-shift materials controller at the terminal, I find out about changes when the day crew mentions them the next morning.",
  },
  "CM-10": {
    risk: "role-is-the-identifier",
    text: "As the only person on the payments on-call rota, every incident night since June has been mine. The release schedule assumes somebody is awake for it and that somebody is me.",
  },
};

/* =============================== small parts =============================== */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/** The one FR-093 affordance. Every AI output on this page carries it. */
function WhyThisChip({ why, label = "Why this?" }: { why: WhyThis; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-purple-500)" />
        {label}
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{why.claim}</div>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>Basis</div>
          {why.basis.map((b, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--pf-purple-500)", marginTop: 7, flex: "none" }} />
              <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
            <PfBadge tone="purple">{why.modelCard}</PfBadge>
            {why.confidence !== undefined && <PfBadge tone="grey">Confidence {Math.round(why.confidence * 100)}%</PfBadge>}
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5, flex: 1, minWidth: 180 }}>{why.humanGate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DeltaChip({ d, suffix = "" }: { d: number; suffix?: string }) {
  return <PfBadge tone={dTone(d)}>{fmtDelta(d)}{suffix}</PfBadge>;
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 0" }}>
      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 108, flex: "none" }}>{k}</span>
      <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{v}</span>
    </div>
  );
}

/* ================================ the screen =============================== */

type Tab = "loop" | "results" | "comments" | "library";
type CommentVerdict = "released" | "held";

export default function Surveys() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("loop");

  /* ---- results ---- */
  const [runId, setRunId] = useState(LIVE);
  const [kindFilter, setKindFilter] = useState<"All cuts" | SliceKind>("All cuts");
  const [sliceId, setSliceId] = useState("SL-01");
  const [refused, setRefused] = useState<string | null>(null);
  const [hoverSlice, setHoverSlice] = useState<string | null>(null);
  const [log, setLog] = useState<EngageAccess[]>(SURVEY_ACCESS_LOG);

  /* ---- free text ---- */
  const [verdicts, setVerdicts] = useState<Record<string, CommentVerdict>>({});
  const [confirming, setConfirming] = useState<string | null>(null);
  const [holdNote, setHoldNote] = useState("");
  const [myNotes, setMyNotes] = useState<Record<string, string>>({});
  const [themeState, setThemeState] = useState<Record<string, "confirmed" | "rejected">>({});
  const [driverFilter, setDriverFilter] = useState<"All drivers" | DriverKey>("All drivers");

  /* ---- action loop ---- */
  const [actions, setActions] = useState<LoopAction[]>(LOOP_SEED);
  const [commit, setCommit] = useState({ title: "", driver: "workload" as DriverKey, owner: DRIVER_OWNERS[1], from: "" });

  /* ---- library ---- */
  const [defId, setDefId] = useState("SD-01");
  const [bAnon, setBAnon] = useState<AnonymityMode>("anonymous");
  const [bKind, setBKind] = useState<"all" | "dept" | "site" | "worker-type">("dept");
  const [bValue, setBValue] = useState("Field Operations");
  const [bName, setBName] = useState("");
  const [bWindow, setBWindow] = useState(10);
  const [bQuestions, setBQuestions] = useState<DriverKey[]>(["workload", "manager"]);
  const [drafts, setDrafts] = useState<{ name: string; audience: string; n: number; anon: AnonymityMode }[]>([]);

  const audit = (action: string, scope: string, who = ACTOR) =>
    setLog((l) => [{ at: stampAt(l.length), who, action, scope }, ...l]);

  /* ------------------------------ derived reads ---------------------------- */

  const run = surveyRun(runId) ?? RUN;
  const runSlices = slicesFor(runId);
  const filtered = kindFilter === "All cuts" ? runSlices : runSlices.filter((s) => s.kind === kindFilter);
  const sel = runSlices.find((s) => s.id === sliceId) ?? runSlices.find((s) => canReport(s.responded)) ?? runSlices[0];
  const selReport = sel ? sliceReport(sel) : undefined;
  const selResult = selReport?.reportable ? selReport.result : undefined;

  const queue = commentReviewQueue().filter((c) => verdicts[c.id] !== "released");
  const liveReleased = SURVEY_COMMENTS.filter((c) => (verdicts[c.id] ? verdicts[c.id] === "released" : c.released));
  const shownComments = driverFilter === "All drivers" ? liveReleased : liveReleased.filter((c) => c.driver === driverFilter);

  const confirmedThemes = COMMENT_THEMES.filter((t) => themeState[t.theme] === "confirmed").length;

  const shipped = actions.filter((a) => a.state === "Shipped").length;
  const openActions = actions.filter((a) => a.state === "In flight" || a.state === "Committed").length;
  const stalled = actions.filter((a) => a.state === "Dropped" || a.state === "Not started").length;

  /* --------------------------- action-loop verdicts ------------------------ */

  const verdictOf = (a: LoopAction): { tone: PfTone; label: string; line: string } => {
    const mv = orgDriver(a.driver);
    const name = driverMeta(a.driver).name;
    if (!mv) return { tone: "grey", label: "No org read", line: "This driver is not on the live org cut." };
    if (a.state === "Committed") return { tone: "purple", label: "Committed this round", line: `${name} is at ${mv.score.toFixed(1)} today. That is the number this action will be read against next quarter.` };
    if (a.state === "Not started") return { tone: "red", label: `${fmtDelta(mv.delta)} · nobody owned it`, line: `${name} fell ${fmtDelta(mv.delta)} with no action attached to it. Nothing was tried, so nothing can be said to have failed.` };
    if (a.state === "Dropped") return { tone: "red", label: `${fmtDelta(mv.delta)} · dropped mid-quarter`, line: `${name} is ${mv.score.toFixed(1)} (${fmtDelta(mv.delta)}). An action that stops without being closed still shows up in the score.` };
    if (mv.delta > 0.05) return { tone: "green", label: `${fmtDelta(mv.delta)} · it moved`, line: `${name} is the only driver that rose this round, and this is the only Q2 action still running. That is one data point, not proof.` };
    if (mv.delta < -0.05) return { tone: "yellow", label: `${fmtDelta(mv.delta)} · it did not move it`, line: `${name} fell ${fmtDelta(mv.delta)} anyway. Shipped is not the same as worked, and the loop has to be able to say so.` };
    return { tone: "grey", label: "±0.0 · flat", line: `${name} held at ${mv.score.toFixed(1)}. Publishing a number is not the same as changing one.` };
  };

  const commitAction = () => {
    if (!commit.title.trim()) { toast("Give the action a title before you commit it.", "danger"); return; }
    const id = `AC-${26 + actions.length - LOOP_SEED.length}`;
    setActions((a) => [
      { id, title: commit.title.trim(), driver: commit.driver, owner: commit.owner, opened: ENGAGE_TODAY, state: "Committed", round: `${RUN.id} · Q3`, from: commit.from.trim() || `${driverMeta(commit.driver).name} · ${RUN.name}`, did: "Not yet. This is a commitment with an owner and a date, which is the only thing that separates it from a minute.", note: "Committed this round. It will be read against the Q4 number whether or not anyone remembers it." },
      ...a,
    ]);
    audit("committed an action against the live round", `${RUN.id} · ${driverMeta(commit.driver).name} · owner ${commit.owner}`);
    toast(`${id} committed to ${commit.owner.split(" · ")[1] ?? commit.owner} — ${driverMeta(commit.driver).name}.`, "success");
    setCommit({ title: "", driver: commit.driver, owner: commit.owner, from: "" });
  };

  const draftFromTheme = (t: CommentTheme) => {
    setCommit({ title: t.theme, driver: t.driver, owner: DRIVER_OWNERS[1], from: `MC-09 theme over released comments ${t.fromComments.join(", ")} — confirmed by ${ACTOR}.` });
    setTab("loop");
    toast("Drafted into the action loop. It is not an action until somebody owns it.", "ai");
  };

  const openSlice = (s: ResultSlice) => {
    if (!canReport(s.responded)) {
      setRefused(s.id);
      audit("attempted a cut below the reporting threshold — refused", `${run.id} · ${s.label} (${s.responded} responses)`);
      toast(`Refused. ${s.label} has ${s.responded} responses; the threshold is ${MIN_REPORTING_N}.`, "danger");
      return;
    }
    setSliceId(s.id);
    setRefused(null);
    audit("viewed results cut", `${run.id} · ${s.label} (${s.responded} responses)`);
  };

  const decide = (c: SurveyComment, v: CommentVerdict) => {
    const reason = holdNote.trim();
    setVerdicts((m) => ({ ...m, [c.id]: v }));
    setMyNotes((m) => ({ ...m, [c.id]: reason || (v === "held" ? "Held. No reason typed — which is itself on the record." : "Released with no reason typed.") }));
    setConfirming(null);
    setHoldNote("");
    if (v === "released") {
      audit("released a free-text comment", `${c.runId} · ${c.id} · ${driverMeta(c.driver).name}`);
      toast(`${c.id} released under your name. It is now quotable in a readout and readable by everyone with results access.`, "danger");
    } else {
      audit("held a free-text comment", `${c.runId} · ${c.id} · reason ${reason ? "recorded" : "left blank"}`);
      toast(`${c.id} held. Your reason travels with the comment to the next reviewer.`, "success");
    }
  };

  /* --------------------------- builder computation ------------------------- */

  const smallestDept = [...DEPARTMENTS].sort((a, b) => a.headcount - b.headcount)[0];
  const siteInScope = (name: string) =>
    RESULT_SLICES.find((s) => s.runId === LIVE && s.kind === "Site" && s.label === name)?.invited;

  const bPopulation =
    bKind === "all" ? RUN.invited
      : bKind === "dept" ? DEPARTMENTS.find((d) => d.name === bValue)?.headcount ?? 0
        : bKind === "site" ? siteInScope(bValue) ?? SITES.find((s) => s.name === bValue)?.muster ?? 0
          : bValue === "NYSC / Intern" ? 4 : RUN.invited - 4;

  const bRate = rateOf(RUN) / 100;
  const bCuts = [
    { label: "Your whole audience", pop: bPopulation },
    ...(bKind === "all" ? [{ label: `Smallest department in scope · ${smallestDept.name}`, pop: smallestDept.headcount }] : []),
    { label: "Any team of 6 inside it", pop: 6 },
    { label: "NYSC / Intern · 4 in the company", pop: 4 },
  ].map((c) => {
    const expected = Math.round(c.pop * bRate);
    return { ...c, expected, ok: canReport(expected) };
  });
  const bBlocked = bCuts.filter((c) => !c.ok).length;

  const saveDraft = () => {
    if (!bName.trim()) { toast("Name the instrument first — a draft with no name is not findable.", "danger"); return; }
    setDrafts((d) => [{ name: bName.trim(), audience: bKind === "all" ? "Everyone in engagement scope" : bValue, n: bPopulation, anon: bAnon }, ...d]);
    toast(`Draft saved · ${bName.trim()} · ${bPopulation} in scope. Nothing is sent until a human schedules it.`, "success");
    setBName("");
  };

  const def = surveyDef(defId) ?? SURVEY_DEFS[0];
  const defRuns = SURVEY_RUNS.filter((r) => r.defId === def.id);

  /* =============================== render ================================= */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PfTile icon="megaphone" tone="purple" size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Engagement surveys</div>
            <PfBadge tone={runStateTone(run.state)} dot>{RUN.id} open · {RUN.daysLeft} days left</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>
            FR-094. Four instruments, {SURVEY_RUNS.filter((r) => r.state === "Open").length} runs open, {AUDIT.total} result cuts and a reporting threshold that refuses {AUDIT.suppressed} of
            them. The first tab is the action loop on purpose — a survey nobody acts on is worse than no survey, and the
            response rate is how people tell you they have worked that out.
          </div>
        </div>
        <PfBtn variant="secondary" icon="bell" onClick={() => { audit("queued reminders to non-responders", `${RUN.id} · ${RUN.invited - RUN.responded} receipts`); toast(`Reminder queued for ${RUN.invited - RUN.responded} people who have not answered ${RUN.id}. The receipt says they were asked — it cannot say what anyone answered.`); }}>
          Remind {RUN.invited - RUN.responded}
        </PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => setTab("library")}>New instrument</PfBtn>
      </div>

      {/* ------------------------------- KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="users" tone="blue" label="Response rate"
          value={`${rateOf(RUN)}%`} unit={`${RUN.responded} of ${RUN.invited}`}
          delta={`${rateOf(RUN) - rateOf(PRIOR) > 0 ? "+" : "−"}${Math.abs(rateOf(RUN) - rateOf(PRIOR))}pt vs Q2`}
          deltaTone={rateOf(RUN) >= rateOf(PRIOR) ? "green" : "red"}
        />
        <PfStat
          icon="pulse" tone={ORG ? driverTone(ORG.overall) : "grey"} label="Org score"
          value={ORG ? ORG.overall.toFixed(1) : "—"} unit={`of 5 · ${ORG?.favourable ?? 0}% favourable`}
          delta={ORG ? `${fmtDelta(ORG.delta)} vs Q2` : "—"} deltaTone={ORG ? dTone(ORG.delta) : "grey"}
        />
        <PfStat
          icon="heart" tone={ORG?.enps ? enpsBand(enpsScore(ORG.enps)).tone : "grey"} label="eNPS"
          value={ORG?.enps ? `${enpsScore(ORG.enps) > 0 ? "+" : ""}${enpsScore(ORG.enps)}` : "—"}
          unit={ORG?.enps ? `${ORG.enps.promoters}% promoters · ${ORG.enps.detractors}% detractors` : "—"}
          delta={ORG?.enps ? enpsBand(enpsScore(ORG.enps)).label : "—"} deltaTone={ORG?.enps ? enpsBand(enpsScore(ORG.enps)).tone : "grey"}
        />
        <PfStat
          icon="shield" tone="green" label="Held back by the threshold"
          value={AUDIT.suppressed} unit={`of ${AUDIT.total} cuts · n≥${AUDIT.threshold}`}
          delta={AUDIT.clean ? "0 leaks" : `${AUDIT.leaks.length} leaks`} deltaTone={AUDIT.clean ? "green" : "red"}
        />
      </div>

      {/* ------------------------------ section tabs ---------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: "loop", label: "Action loop", count: `${shipped}/${actions.length}`, badge: "LEAD" },
            { key: "results", label: "Live results", mono: RUN.id },
            { key: "comments", label: "Free text", count: `${queue.length} held` },
            { key: "library", label: "Instruments", count: String(SURVEY_DEFS.length) },
          ]}
        />
      </div>

      {/* ================================ ACTION LOOP ============================ */}
      {tab === "loop" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {WORST && (
            <PfBanner tone="red" icon="warning">
              {driverMeta(WORST.key).name} fell furthest and is the one driver last round produced no action on. Org {WORST.score.toFixed(1)} ({fmtDelta(WORST.delta)});
              Engineering {ENG?.drivers.find((x) => x.key === WORST.key)?.score.toFixed(1)} ({fmtDelta(ENG?.drivers.find((x) => x.key === WORST.key)?.delta ?? 0)}), the steepest fall in the round.
              Every other driver that fell has an owner. This one has a second survey.
            </PfBanner>
          )}

          {/* ---------------------------- loop scoreboard --------------------------- */}
          <PfCard>
            <PfCardHead
              title={`What ${PRIOR.id} asked for, and what actually happened`}
              sub="Five actions came out of the Q2 readout. The verdict on each is computed from the live org cut — an action cannot record itself as a success against a falling line."
            >
              <PfBadge tone={stalled > 0 ? "red" : "green"} dot>{shipped} shipped · {openActions} open · {stalled} not moving</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0, borderBottom: "1px solid var(--pf-n50)" }}>
              {[
                { k: "Loop closure", v: `${pct(shipped, actions.length)}%`, note: `${shipped} of ${actions.length} actions from the last round actually shipped.`, tone: "green" as PfTone },
                { k: "Drivers that rose", v: String(ORG ? ORG.drivers.filter((d) => d.delta > 0.05).length : 0), note: `Of ${ORG?.drivers.length ?? 5}. Three fell, one held flat.`, tone: "yellow" as PfTone },
                { k: "Response rate vs Q2", v: `${rateOf(RUN) - rateOf(PRIOR) > 0 ? "+" : "−"}${Math.abs(rateOf(RUN) - rateOf(PRIOR))}pt`, note: `${rateOf(RUN)}% this round against ${rateOf(PRIOR)}% in Q2. This is the number that tells you whether people still believe the exercise.`, tone: "red" as PfTone },
              ].map((c, i) => (
                <div key={c.k} style={{ padding: "14px 20px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{c.v}</span>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[c.tone].bg }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{c.note}</div>
                </div>
              ))}
            </div>

            {actions.map((a, i) => {
              const v = verdictOf(a);
              const dm = driverMeta(a.driver);
              return (
                <div key={a.id} style={{ padding: "15px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <PfTile icon={dm.icon} tone={LOOP_STATE_TONE[a.state]} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>{a.id}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.title}</span>
                        <PfBadge tone={LOOP_STATE_TONE[a.state]} dot>{a.state}</PfBadge>
                        <PfBadge tone="grey">{dm.name}</PfBadge>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55 }}>
                        <strong style={{ color: "var(--pf-n500)", fontWeight: 600 }}>Because </strong>{a.from}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 6, lineHeight: 1.55 }}>
                        <strong style={{ color: "var(--pf-n900)", fontWeight: 600 }}>So </strong>{a.did}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Owner · {a.owner}</span>
                        <span style={{ width: 1, height: 11, background: "var(--pf-n100)" }} />
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{a.round}</span>
                        <span style={{ width: 1, height: 11, background: "var(--pf-n100)" }} />
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Opened {a.opened}</span>
                      </div>
                    </div>
                    <div style={{ width: 250, flex: "none", background: TONE[v.tone].soft, border: `1px solid ${TONE[v.tone].line}`, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: TONE[v.tone].fg }}>{v.label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.5 }}>{v.line}</div>
                    </div>
                  </div>
                  {a.note && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10, marginLeft: 42, alignItems: "flex-start" }}>
                      <Ic name="info" size={13} color="var(--pf-n300)" />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55, fontStyle: "italic" }}>{a.note}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <Foot icon="pulse">
              Every verdict on this card is read live off {ORG_SLICE.label} ({ORG_SLICE.responded} responses). Nothing here stores its own
              copy of a score, which is why an action can be marked shipped and still be shown to have changed nothing.
            </Foot>
          </PfCard>

          {/* ------------------------------- commit form ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="Close the loop on this round"
              sub="An action needs a driver, an owner and a date. Without an owner it is a minute, and AC-25 is what a minute looks like a quarter later."
            >
              <PfBadge tone="purple">{RUN.id} · Q3</PfBadge>
            </PfCardHead>
            <div style={{ padding: 16, display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>What will change</div>
                  <input
                    value={commit.title}
                    onChange={(e) => setCommit({ ...commit, title: e.target.value })}
                    placeholder="e.g. Freeze the September release scope and publish the on-call rota"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Evidence it answers</div>
                  <input
                    value={commit.from}
                    onChange={(e) => setCommit({ ...commit, from: e.target.value })}
                    placeholder="A released comment, a slice, or the driver delta it is aimed at"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Driver</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {DRIVERS.map((d) => {
                      const on = commit.driver === d.key;
                      const mv = orgDriver(d.key);
                      return (
                        <button
                          key={d.key}
                          onClick={() => setCommit({ ...commit, driver: d.key })}
                          style={{
                            fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                            fontSize: 12, fontWeight: 500, padding: "6px 10px", borderRadius: 8,
                            background: on ? TONE.purple.soft : "var(--pf-n0)",
                            border: `1px solid ${on ? TONE.purple.line : "var(--pf-n50)"}`,
                            color: on ? "var(--pf-purple-500)" : "var(--pf-n600)",
                          }}
                        >
                          {d.name}
                          {mv && <span style={{ fontFamily: MONO, fontSize: 10.5, color: dTone(mv.delta) === "red" ? "var(--pf-red-500)" : "var(--pf-n300)" }}>{fmtDelta(mv.delta)}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Owner</div>
                  <select value={commit.owner} onChange={(e) => setCommit({ ...commit, owner: e.target.value })} style={fieldStyle}>
                    {DRIVER_OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <PfBtn variant="primary" icon="check" onClick={commitAction}>Commit the action</PfBtn>
                  <PfBtn variant="secondary" icon="chat" onClick={() => setTab("comments")}>Read the free text first</PfBtn>
                </div>
              </div>
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>What a commitment costs you</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                  It is written against a driver, so next quarter this page will print the delta next to your name whether the
                  action worked or not. That is the deal, and it is the reason the loop is worth keeping: an action nobody can
                  be shown to have dropped is not an action.
                </div>
                <div style={{ height: 1, background: "var(--pf-n50)", margin: "12px 0" }} />
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
                  Committing does not message anyone, publish anything or change a score. It records a name and a date.
                </div>
              </div>
            </div>
          </PfCard>

          {/* --------------------------- where it goes next ------------------------- */}
          <PfCard>
            <PfCardHead title="Where the answers go from here" sub="Aggregates only. No named answer leaves this module, and no free text reaches any of these surfaces." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {[
                { stage: "depthealth", label: "Department health", note: `Engineering engagement reads ${DEPARTMENTS.find((d) => d.name === "Engineering")?.engagement}% favourable — the same figure as ${ENG_SLICE.label} on this page, from this run.` },
                { stage: "attrition", label: "Attrition model", note: "Takes the driver aggregate and nothing else. No comment, no receipt, no named respondent, and never a protected or NCDMB field." },
                { stage: "trust", label: "Trust center", note: `MC-09 and AS-14 are registered there. FR-093 audits AI-surface coverage at 100%, so a theme with no basis breaks a shipped gate.` },
              ].map((s, i) => (
                <button
                  key={s.stage}
                  onClick={() => go(s.stage)}
                  style={{ fontFamily: "inherit", textAlign: "left", cursor: "pointer", background: "var(--pf-n0)", border: "none", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)", padding: "14px 18px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.label}</span>
                    <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{s.note}</div>
                </button>
              ))}
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================= RESULTS =============================== */}
      {tab === "results" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead title="Which run" sub={run.note ?? "Every delta on this page is measured against SR-28, the Q2 pulse."}>
              <PfTabs
                tabs={SURVEY_RUNS.map((r) => r.id)}
                active={runId}
                onChange={(id) => { setRunId(id); setRefused(null); const first = slicesFor(id).find((s) => canReport(s.responded)); if (first) setSliceId(first.id); }}
              />
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 0 }}>
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{run.name}</span>
                  <PfBadge tone={runStateTone(run.state)} dot>{run.state}</PfBadge>
                  <PfBadge tone="grey">{ANONYMITY_LABEL[surveyDef(run.defId)?.anonymity ?? "anonymous"]}</PfBadge>
                </div>
                <Row k="Window" v={`${run.opened} → ${run.closes}${run.daysLeft > 0 ? ` · ${run.daysLeft} working days left` : " · closed"}`} />
                <Row k="Owner" v={surveyDef(run.defId)?.owner ?? "—"} />
                <Row k="Audience" v={surveyDef(run.defId)?.audience.label ?? "—"} />
              </div>

              {/* ------------------------- response-rate funnel ------------------------ */}
              <div style={{ padding: "14px 20px", borderLeft: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 10 }}>From invited to publishable</div>
                {[
                  { label: "Invited", n: run.invited, of: run.invited, tone: "grey" as PfTone },
                  { label: "Answered", n: run.responded, of: run.invited, tone: "blue" as PfTone },
                  { label: "Inside a cut that can be reported", n: runSlices.filter((s) => s.kind === "Department" && canReport(s.responded)).reduce((a, s) => a + s.responded, 0), of: run.invited, tone: "green" as PfTone },
                  { label: "Free text cleared for release", n: SURVEY_COMMENTS.filter((c) => c.runId === run.id && (verdicts[c.id] ? verdicts[c.id] === "released" : c.released)).length, of: SURVEY_COMMENTS.filter((c) => c.runId === run.id).length, tone: "purple" as PfTone },
                ].map((f) => (
                  <div key={f.label} style={{ marginBottom: 9 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1 }}>{f.label}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{f.n}</span>
                      <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>/ {f.of}</span>
                    </div>
                    <PfProgress pct={pct(f.n, f.of)} tone={f.tone} height={7} />
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 8 }}>
                  The numbers survive the pipeline almost intact. The words mostly do not, and that gap is the honest cost of
                  an anonymity promise you actually keep.
                </div>
              </div>
            </div>
          </PfCard>

          {runSlices.length === 0 ? (
            <PfCard>
              <div style={{ padding: "34px 20px", textAlign: "center" }}>
                <PfTile icon="treemap" tone="grey" size={38} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>No cuts published for {run.id}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55, maxWidth: 520, margin: "6px auto 0" }}>
                  {run.id === PRIOR.id
                    ? "Q2 is the comparison every delta in this module is measured against. Its cuts are archived — this build carries the deltas, not the Q2 tables."
                    : `${run.name} is still collecting. ${run.responded} of ${run.invited} answered so far; nothing is cut until the run closes, because a partial slice moves under people as they answer.`}
                </div>
              </div>
            </PfCard>
          ) : (
            <>
              {/* --------------------------- the by-dimension heat -------------------- */}
              <PfCard>
                <PfCardHead
                  title="By dimension"
                  sub={`Five drivers across every cut of ${run.id}. The cuts that cannot be reported are printed at the same size as the ones that can — that is the point of them.`}
                >
                  <PfTabs
                    tabs={["All cuts", "Department", "Site", "Team", "Worker type"]}
                    active={kindFilter}
                    onChange={(k) => setKindFilter(k as "All cuts" | SliceKind)}
                  />
                </PfCardHead>

                <div style={{ display: "grid", gridTemplateColumns: `250px 74px 66px repeat(${DRIVERS.length}, minmax(0,1fr))`, gap: 0, background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)", padding: "9px 20px" }}>
                  <PfTh>Cut</PfTh>
                  <PfTh>Responses</PfTh>
                  <PfTh>Overall</PfTh>
                  {DRIVERS.map((d) => <PfTh key={d.key} style={{ textAlign: "center" }}>{d.name.split(" ")[0]}</PfTh>)}
                </div>

                {filtered.map((s) => {
                  const rep = sliceReport(s);
                  const isSel = s.id === sel?.id;
                  if (!rep.reportable) {
                    return (
                      <div key={s.id} style={{ borderTop: "1px solid var(--pf-n50)", background: refused === s.id ? TONE.red.soft : TONE.yellow.soft }}>
                        <div style={{ display: "grid", gridTemplateColumns: `250px 74px 1fr`, gap: 0, padding: "12px 20px", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <Ic name="shield" size={14} color="var(--pf-yellow-500)" />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--pf-n600)" }}>{s.responded} / {s.invited}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5, flex: 1 }}>
                              <strong style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{s.responded} responses</strong> — below the reporting threshold of {MIN_REPORTING_N}, so this is not shown,
                              and will not be shown even to the team&apos;s own manager.
                            </span>
                            <PfBtn small variant="secondary" onClick={() => openSlice(s)}>Try to open it</PfBtn>
                          </div>
                        </div>
                        <div style={{ padding: "0 20px 13px 42px" }}>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>{s.suppressedBecause}</div>
                          {refused === s.id && (
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10, background: "var(--pf-n0)", border: "1px solid var(--pf-red-100)", borderRadius: 9, padding: "10px 12px" }}>
                              <Ic name="x" size={14} color="var(--pf-red-500)" />
                              <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                                <strong style={{ color: "var(--pf-red-500)", fontWeight: 600 }}>Refused.</strong> {suppressionNote(s.responded)} The attempt is on the access
                                log with your name on it — not because you did anything wrong, but because a refusal nobody
                                can see is a refusal somebody will eventually route around.
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <button
                      key={s.id}
                      onClick={() => openSlice(s)}
                      onMouseEnter={() => setHoverSlice(s.id)}
                      onMouseLeave={() => setHoverSlice(null)}
                      style={{
                        fontFamily: "inherit", textAlign: "left", cursor: "pointer", width: "100%",
                        display: "grid", gridTemplateColumns: `250px 74px 66px repeat(${DRIVERS.length}, minmax(0,1fr))`,
                        gap: 0, padding: "10px 20px", alignItems: "center",
                        border: "none", borderTop: "1px solid var(--pf-n50)",
                        background: isSel ? "var(--pf-primary-50)" : hoverSlice === s.id ? "var(--pf-n25)" : "var(--pf-n0)",
                        transition: "background .12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: isSel ? "var(--pf-primary-500)" : "var(--pf-n100)", flex: "none" }} />
                        <span style={{ fontSize: 12.5, fontWeight: isSel ? 600 : 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                        <PfBadge tone="grey">{s.kind}</PfBadge>
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 12, color: "var(--pf-n500)" }}>{s.responded} / {s.invited}</div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: TONE[driverTone(rep.result.overall)].fg }}>{rep.result.overall.toFixed(1)}</span>
                        <span style={{ fontSize: 10.5, color: "var(--pf-n300)" }}>{fmtDelta(rep.result.delta)}</span>
                      </div>
                      {DRIVERS.map((dm) => {
                        const dv = rep.result.drivers.find((x) => x.key === dm.key);
                        if (!dv || dv.score === 0) {
                          return <div key={dm.key} style={{ textAlign: "center", fontSize: 11, color: "var(--pf-n300)" }}>—</div>;
                        }
                        const t = TONE[driverTone(dv.score)];
                        return (
                          <div key={dm.key} style={{ display: "flex", justifyContent: "center" }}>
                            <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, background: t.soft, border: `0.6px solid ${t.line}`, borderRadius: 6, padding: "4px 9px", minWidth: 52 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: t.fg }}>{dv.score.toFixed(1)}</span>
                              <span style={{ fontFamily: MONO, fontSize: 9.5, color: dv.delta < -0.05 ? "var(--pf-red-500)" : dv.delta > 0.05 ? "var(--pf-primary-500)" : "var(--pf-n300)" }}>{fmtDelta(dv.delta)}</span>
                            </span>
                          </div>
                        );
                      })}
                    </button>
                  );
                })}

                {filtered.length === 0 && (
                  <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                    No {String(kindFilter).toLowerCase()} cuts exist for {run.id}. {run.id === "SR-30" ? "SR-30 runs at department scope only, on purpose — a squad-level cut of six could not be reported anyway." : "Widen the filter."}
                  </div>
                )}

                <Foot icon="shield">
                  {AUDIT.reportable} of {AUDIT.total} cuts report; {AUDIT.suppressed} refuse. The refusal is enforced in the data,
                  not here — a suppressed cut carries no result object at all, so there is nothing for this table to render even
                  if it tried. {AUDIT.clean ? "0 leaks." : `${AUDIT.leaks.length} leaks — this is a build failure, not a warning.`}
                </Foot>
              </PfCard>

              {/* ------------------------------ driver detail -------------------------- */}
              {sel && selResult && (
                <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12, alignItems: "start" }}>
                  <PfCard>
                    <PfCardHead
                      title={`${sel.label} · five drivers`}
                      sub={`${sel.responded} responses of ${sel.invited} invited (${pct(sel.responded, sel.invited)}%). Deltas are against ${PRIOR.id}.`}
                    >
                      <PfBadge tone={driverTone(selResult.overall)} dot>{selResult.overall.toFixed(1)} overall</PfBadge>
                    </PfCardHead>
                    {selResult.drivers.filter((d) => d.score > 0).map((d, i) => {
                      const dm = driverMeta(d.key);
                      return (
                        <div key={d.key} style={{ padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <PfTile icon={dm.icon} tone={driverTone(d.score)} size={28} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{dm.name}</span>
                                <DeltaChip d={d.delta} />
                              </div>
                              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>{dm.blurb}</div>
                            </div>
                            <div style={{ textAlign: "right", flex: "none" }}>
                              <div style={{ display: "flex", alignItems: "baseline", gap: 2, justifyContent: "flex-end" }}>
                                <span style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{d.score.toFixed(1)}</span>
                                <span style={{ fontSize: 12, color: "var(--pf-n300)" }}>/5</span>
                              </div>
                              <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{d.favourable}% favourable</div>
                            </div>
                          </div>
                          <div style={{ marginTop: 9, marginLeft: 38 }}>
                            <PfSegments score={d.score} tone={driverTone(d.score)} />
                          </div>
                        </div>
                      );
                    })}
                    <Foot icon="info">
                      Favourable is the share choosing “{LIKERT_ANCHORS[3]}” or “{LIKERT_ANCHORS[4]}”. The mean and the
                      favourable share disagree on purpose — a 3.5 built from strong agreement and strong disagreement is not the
                      same company as a 3.5 where everybody shrugged.
                    </Foot>
                  </PfCard>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {selResult.enps ? (
                      <PfCard>
                        <PfCardHead title="eNPS" sub={`Promoters minus detractors. Passives count in the base and nowhere else.`} />
                        <div style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontSize: 30, fontWeight: 700, color: TONE[enpsBand(enpsScore(selResult.enps)).tone].fg, letterSpacing: "-.6px" }}>
                              {enpsScore(selResult.enps) > 0 ? "+" : ""}{enpsScore(selResult.enps)}
                            </span>
                            <PfBadge tone={enpsBand(enpsScore(selResult.enps)).tone} dot>{enpsBand(enpsScore(selResult.enps)).label}</PfBadge>
                          </div>
                          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", marginTop: 14 }}>
                            <div style={{ width: `${selResult.enps.promoters}%`, background: "var(--pf-primary-500)" }} />
                            <div style={{ width: `${selResult.enps.passives}%`, background: "var(--pf-n100)" }} />
                            <div style={{ width: `${selResult.enps.detractors}%`, background: "var(--pf-red-500)" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
                            {[
                              { l: "Promoters · 9–10", v: selResult.enps.promoters, c: "var(--pf-primary-500)" },
                              { l: "Passives · 7–8", v: selResult.enps.passives, c: "var(--pf-n100)" },
                              { l: "Detractors · 0–6", v: selResult.enps.detractors, c: "var(--pf-red-500)" },
                            ].map((r) => (
                              <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 10, height: 10, borderRadius: 3, background: r.c, flex: "none" }} />
                                <span style={{ fontSize: 12, color: "var(--pf-n500)", flex: 1 }}>{r.l}</span>
                                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{r.v}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Foot icon="warning">
                          {selResult.enps.detractors}% of this cut would not recommend the place they work to someone they respect. The mean
                          of {selResult.overall.toFixed(1)} does not show you that, which is why both numbers are on the page.
                        </Foot>
                      </PfCard>
                    ) : (
                      <PfCard>
                        <PfCardHead title="eNPS" sub="Not asked in this cut." />
                        <div style={{ padding: "24px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                          {sel.label} answered the pulse but the recommendation question is only cut at org, department-of-scale and
                          site level. A number here would be a rounding of fewer answers than it looks like.
                        </div>
                      </PfCard>
                    )}

                    {/* --------------------- receipts, never joined to answers -------------- */}
                    <PfCard>
                      <PfCardHead title="Receipts" sub="Who was asked and who has answered. Never what they said." />
                      {SURVEY_INVITES.filter((i) => i.runId === run.id).slice(0, 5).map((i) => (
                        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                          <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--pf-n300)", width: 58, flex: "none" }}>{i.workerId}</span>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1 }}>Invited {i.invitedOn}{i.remindersSent > 0 ? ` · ${i.remindersSent} reminder` : ""}</span>
                          <PfBadge tone={i.responded ? "green" : "yellow"} dot>{i.responded ? `Answered ${i.respondedOn}` : "Not yet"}</PfBadge>
                        </div>
                      ))}
                      {SURVEY_INVITES.filter((i) => i.runId === run.id).length === 0 && (
                        <div style={{ padding: "20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>No receipts held for {run.id} in this build.</div>
                      )}
                      <Foot icon="shield">
                        The receipt table and the answer table are not joined anywhere in this product. That is what lets the page
                        say “you have not answered yet” without ever being able to say what you answered.
                      </Foot>
                    </PfCard>
                  </div>
                </div>
              )}

              {sel && !selResult && (
                <PfCard>
                  <div style={{ padding: "30px 20px", textAlign: "center" }}>
                    <PfTile icon="shield" tone="yellow" size={38} />
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>Nothing to show for {sel.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 6, maxWidth: 520, margin: "6px auto 0", lineHeight: 1.55 }}>
                      {suppressionNote(sel.responded)}
                    </div>
                  </div>
                </PfCard>
              )}

              {/* ------------------------------- access log ---------------------------- */}
              <PfCard>
                <PfCardHead title="Who has read these results" sub="Every cut opened, every refusal, every comment released. Sensitive reads are logged and the UI says so.">
                  <PfBadge tone="grey">{log.length} entries</PfBadge>
                </PfCardHead>
                {log.slice(0, 8).map((e, i) => (
                  <div key={`${e.at}-${i}`} style={{ display: "grid", gridTemplateColumns: "112px 210px 1fr", gap: 12, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", alignItems: "baseline" }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--pf-n300)" }}>{e.at}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.who}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                      {e.action} <span style={{ color: "var(--pf-n300)" }}>— {e.scope}</span>
                    </span>
                  </div>
                ))}
              </PfCard>
            </>
          )}
        </div>
      )}

      {/* ================================ FREE TEXT ============================== */}
      {tab === "comments" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone={verdicts["CM-10"] === "released" ? "red" : "yellow"} icon="warning">
            {verdicts["CM-10"] === "released"
              ? `CM-10 is out. It came from a cut of ${RESULT_SLICES.find((s) => s.id === "SL-20")?.responded} responses that clears every threshold in this product, and it opens with a rota that has one person on it. The threshold never covered that sentence and nothing downstream can take it back.`
              : `The reporting threshold protects the score. It does not protect the sentence. ${queue.length} of ${CSTATS.total} comments are still unreleased, and one of them sits inside a cut of ${RESULT_SLICES.find((s) => s.id === "SL-20")?.responded} responses that clears every threshold in the product and still names exactly one person.`}
          </PfBanner>

          {/* ---------------------------- the review queue -------------------------- */}
          <PfCard>
            <PfCardHead
              title="Unreleased — HR clears these one at a time"
              sub="Nothing here is quotable, themeable or exportable. Default is held; a named human has to change that, and their reason travels with the comment either way."
            >
              <PfBadge tone="red" dot>{queue.length} held</PfBadge>
            </PfCardHead>

            {queue.map((c, i) => {
              const draft = REVIEW_DRAFT[c.id];
              const risk = draft?.risk ?? "clear";
              const unreviewed = !c.reviewedBy;
              const belowThreshold = risk === "below-threshold";
              const isHealth = risk === "health";
              const sliceOf = RESULT_SLICES.find((s) => s.id === c.sliceId);
              return (
                <div key={c.id} style={{ padding: "15px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)", background: confirming === c.id ? TONE.red.soft : "var(--pf-n0)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 9 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>{c.id}</span>
                    <PfBadge tone={RISK_TONE[risk]} dot>{RISK_LABEL[risk]}</PfBadge>
                    <PfBadge tone="grey">{driverMeta(c.driver).name}</PfBadge>
                    <PfBadge tone="grey">{sliceOf?.label ?? c.sliceId} · {sliceOf?.responded ?? "?"} responses</PfBadge>
                    {verdicts[c.id] === "held"
                      ? <PfBadge tone="green" dot>Held by you · just now</PfBadge>
                      : unreviewed ? <PfBadge tone="purple" dot>Awaiting a decision</PfBadge> : <PfBadge tone="grey">Reviewed {c.reviewedAt}</PfBadge>}
                  </div>

                  <div style={{ background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.6, fontStyle: "italic" }}>&ldquo;{draft?.text ?? c.text}&rdquo;</div>
                    <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 8 }}>
                      Read here because a reviewer cannot judge a sentence they cannot see. This text is not stored on the shared
                      results record, is not passed to MC-09, and does not exist in any export.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10 }}>
                    <Ic name={isHealth ? "shield" : "warning"} size={14} color={TONE[RISK_TONE[risk]].fg} />
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6, flex: 1 }}>{c.reviewNote}</div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                    {isHealth ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: TONE.purple.soft, border: `1px solid ${TONE.purple.line}`, borderRadius: 8, padding: "7px 11px" }}>
                        <Ic name="shield" size={13} color="var(--pf-purple-500)" />
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>There is no release control on this one</span>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>— health detail is never released at any response count, in any slice, in any run.</span>
                      </div>
                    ) : belowThreshold ? (
                      <>
                        <PfBtn small variant="secondary" onClick={() => toast(`Cannot release. ${sliceOf?.label} has ${sliceOf?.responded} responses — below ${MIN_REPORTING_N}. Releasing any single comment from that cut names its author whatever it says.`, "danger")}>
                          Release
                        </PfBtn>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Blocked on the count, not on the content. The sentence itself is unremarkable.</span>
                      </>
                    ) : confirming === c.id ? (
                      <div style={{ width: "100%", background: "var(--pf-n0)", border: "1px solid var(--pf-red-100)", borderRadius: 10, padding: 13 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <Ic name="warning" size={15} color="var(--pf-red-500)" />
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-red-500)" }}>Releasing this identifies its author</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6, marginBottom: 10 }}>
                          {risk === "names-a-person"
                            ? "It describes an exchange with a named witness count. Publishing it names the author to everyone who was in that room, and names the person they are describing to everyone who was not."
                            : `It opens with a role held by one person. ${sliceOf?.label} has ${sliceOf?.responded} responses and clears every threshold in this product — and the sentence still points at exactly one desk. The threshold protects the score, not the sentence.`}
                        </div>
                        <input
                          value={holdNote}
                          onChange={(e) => setHoldNote(e.target.value)}
                          placeholder="If you are holding it, say why — the reason is the record"
                          style={{ ...fieldStyle, marginBottom: 10 }}
                        />
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <PfBtn small variant="primary" icon="shield" onClick={() => decide(c, "held")}>Hold it — recommended</PfBtn>
                          <PfBtn small variant="danger" icon="warning" onClick={() => decide(c, "released")}>Release anyway, with my name on it</PfBtn>
                          <PfBtn small variant="ghost" onClick={() => { setConfirming(null); setHoldNote(""); }}>Cancel</PfBtn>
                        </div>
                      </div>
                    ) : verdicts[c.id] === "held" ? (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: TONE.green.soft, border: `1px solid ${TONE.green.line}`, borderRadius: 9, padding: "9px 12px", width: "100%" }}>
                        <Ic name="check" size={14} color="var(--pf-primary-500)" />
                        <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6, flex: 1 }}>
                          <strong style={{ color: "var(--pf-primary-500)", fontWeight: 600 }}>Held by {ACTOR}.</strong> {myNotes[c.id]}
                        </div>
                        <PfBtn small variant="ghost" onClick={() => { setVerdicts((m) => { const n = { ...m }; delete n[c.id]; return n; }); setMyNotes((m) => { const n = { ...m }; delete n[c.id]; return n; }); }}>Reopen</PfBtn>
                      </div>
                    ) : (
                      <>
                        <PfBtn small variant="secondary" icon="arrowright" onClick={() => setConfirming(c.id)}>Review for release</PfBtn>
                        <PfBtn small variant="ghost" icon="shield" onClick={() => decide(c, "held")}>Keep held</PfBtn>
                        {unreviewed && <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Nobody has looked at this one yet. Until somebody does, it counts in no theme and no report.</span>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {queue.length === 0 && (
              <div style={{ padding: "30px 20px", textAlign: "center" }}>
                <PfTile icon="check" tone="green" size={36} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>Queue clear</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55 }}>
                  Every comment in this cycle has a named reviewer and a recorded reason. That is the whole job.
                </div>
              </div>
            )}

            <Foot icon="shield">
              {CSTATS.released} released of {CSTATS.total} this cycle. A release is irreversible in practice — you cannot un-read a
              sentence for the people who saw it — which is why the default is the other way round.
            </Foot>
          </PfCard>

          {/* ------------------------------ AI themes ------------------------------ */}
          <PfCard>
            <PfCardHead
              title="Themes over the released comments"
              sub="MC-09 proposes. People Ops confirms. A theme is a reading aid over text a human already cleared — it is not a finding and it does not reach a report on its own."
            >
              <PfBadge tone={confirmedThemes === COMMENT_THEMES.length ? "green" : "purple"} dot>{confirmedThemes} of {COMMENT_THEMES.length} confirmed</PfBadge>
            </PfCardHead>

            {COMMENT_THEMES.map((t, i) => {
              const st = themeState[t.theme];
              return (
                <div key={t.theme} style={{ padding: "14px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)", opacity: st === "rejected" ? 0.55 : 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <PfTile icon={driverMeta(t.driver).icon} tone={t.tone} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", textDecoration: st === "rejected" ? "line-through" : "none" }}>{t.theme}</span>
                        <PfBadge tone={t.tone} dot>{t.n} {t.n === 1 ? "comment" : "comments"}</PfBadge>
                        <PfBadge tone="grey">{driverMeta(t.driver).name}</PfBadge>
                        {st === "confirmed" && <PfBadge tone="green" dot>Confirmed by {ACTOR.split(" · ")[1]}</PfBadge>}
                        {st === "rejected" && <PfBadge tone="red" dot>Rejected</PfBadge>}
                      </div>
                      <div style={{ marginTop: 9 }}>
                        {t.fromComments.map((cid) => {
                          const src = SURVEY_COMMENTS.find((c) => c.id === cid);
                          if (!src) return null;
                          return (
                            <div key={cid} style={{ display: "flex", gap: 9, marginBottom: 6 }}>
                              <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", flex: "none", marginTop: 2 }}>{cid}</span>
                              <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55, fontStyle: "italic" }}>&ldquo;{src.text}&rdquo;</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                        {!st && (
                          <>
                            <PfBtn small variant="secondary" icon="check" onClick={() => { setThemeState((m) => ({ ...m, [t.theme]: "confirmed" })); audit("confirmed an MC-09 theme", `${RUN.id} · ${t.theme}`); toast(`Theme confirmed. It can now appear in a readout, attributed to ${t.fromComments.length} released ${t.fromComments.length === 1 ? "comment" : "comments"}.`, "ai"); }}>Confirm</PfBtn>
                            <PfBtn small variant="ghost" icon="x" onClick={() => { setThemeState((m) => ({ ...m, [t.theme]: "rejected" })); toast(`Theme rejected. The comments stay released; the grouping does not.`); }}>Reject</PfBtn>
                          </>
                        )}
                        {st === "confirmed" && <PfBtn small variant="primary" icon="target" onClick={() => draftFromTheme(t)}>Draft an action from this</PfBtn>}
                        {st === "rejected" && <PfBtn small variant="ghost" onClick={() => setThemeState((m) => { const n = { ...m }; delete n[t.theme]; return n; })}>Undo</PfBtn>}
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>Proposed by MC-09 · not applied until confirmed</span>
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <WhyThisChip why={themeWhy(t)} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <Foot icon="robot">
              MC-09 was fed {CSTATS.released} released comments. It has never seen the other {CSTATS.held} — not to count them, not to
              weight a theme, not to decide a theme was worth proposing. That is why the totals on this card do not add up to
              the totals on the card above, and the mismatch is the safeguard working.
            </Foot>
          </PfCard>

          {/* --------------------------- released, readable ------------------------- */}
          <PfCard>
            <PfCardHead title="Released — quotable in a readout" sub="What actually reaches the room where the decisions get made.">
              <PfTabs
                tabs={["All drivers", ...DRIVERS.map((d) => d.name)]}
                active={driverFilter === "All drivers" ? "All drivers" : driverMeta(driverFilter).name}
                onChange={(l) => setDriverFilter(l === "All drivers" ? "All drivers" : (DRIVERS.find((d) => d.name === l)?.key ?? "All drivers"))}
              />
            </PfCardHead>
            {shownComments.map((c, i) => (
              <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfTile icon={c.sentiment === "positive" ? "star" : c.sentiment === "mixed" ? "swap" : "warning"} tone={c.sentiment === "positive" ? "green" : c.sentiment === "mixed" ? "yellow" : "red"} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.6 }}>&ldquo;{verdicts[c.id] === "released" && REVIEW_DRAFT[c.id] ? REVIEW_DRAFT[c.id].text : c.text}&rdquo;</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{c.id}</span>
                    <PfBadge tone="grey">{driverMeta(c.driver).name}</PfBadge>
                    <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Released by {c.reviewedBy ?? ACTOR}</span>
                  </div>
                </div>
              </div>
            ))}
            {shownComments.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                Nothing released against {driverFilter === "All drivers" ? "any driver" : driverMeta(driverFilter).name} this cycle. That is a real answer, not an
                empty table — the words about it either were not written or did not survive review.
              </div>
            )}
          </PfCard>

          {/* ---------------------------- FR-093 registry --------------------------- */}
          <PfCard>
            <PfCardHead title="The AI on this page" sub="FR-093 audits AI-surface coverage at 100%. A surface with no model card and no basis affordance breaks a shipped gate.">
              <PfBtn small variant="secondary" icon="star" onClick={() => go("trust")}>Trust center</PfBtn>
            </PfCardHead>
            {ENGAGE_MODEL_CARDS.filter((m) => m.id === "MC-09").map((m) => (
              <div key={m.id} style={{ padding: "13px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <PfBadge tone="purple">{m.id}</PfBadge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{m.name}</span>
                  <PfBadge tone="grey">{m.surface}</PfBadge>
                </div>
                <Row k="Purpose" v={m.purpose} />
                <Row k="Inputs" v={m.inputs} />
                <Row k="Human gate" v={m.humanGate} />
              </div>
            ))}
            {ENGAGE_AI_SURFACES.filter((s) => s.modelCard === "MC-09").map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <PfBadge tone={s.covered ? "green" : "red"} dot>{s.id} · {s.covered ? "covered" : "uncovered"}</PfBadge>
                <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5, flex: 1 }}>{s.output} — {s.where}</span>
              </div>
            ))}
          </PfCard>
        </div>
      )}

      {/* ================================ INSTRUMENTS ============================ */}
      {tab === "library" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="blue" icon="info" cta="open" onCta={() => setTab("results")}>
            An instrument is a promise about what happens to the answer. Change the anonymity mode and you have changed the
            promise, not a setting — so the promise text below is the exact sentence the respondent reads before question one.
          </PfBanner>

          {/* ------------------------------ the library ---------------------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            {SURVEY_DEFS.map((d) => <InstrumentCard key={d.id} def={d} on={d.id === defId} onPick={() => setDefId(d.id)} />)}
          </div>

          {/* ------------------------------ the detail ----------------------------- */}
          <PfCard>
            <PfCardHead title={def.name} sub={def.purpose}>
              <PfBadge tone={def.anonymity === "anonymous" ? "green" : def.anonymity === "confidential" ? "blue" : "yellow"} dot>{ANONYMITY_LABEL[def.anonymity]}</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              <div style={{ padding: "14px 20px" }}>
                <Row k="Type" v={SURVEY_TYPE_LABEL[def.type]} />
                <Row k="Cadence" v={def.cadence} />
                <Row k="Open for" v={`${def.windowDays} working days`} />
                <Row k="Owner" v={def.owner} />
                <Row k="Audience" v={`${def.audience.label} · ${def.audience.estimated} in scope`} />
                {def.audience.note && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <Ic name="info" size={13} color="var(--pf-n300)" />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{def.audience.note}</span>
                  </div>
                )}
              </div>
              <div style={{ padding: "14px 20px", borderLeft: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 7 }}>What the respondent is told, verbatim</div>
                <div style={{ background: TONE.green.soft, border: `1px solid ${TONE.green.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                  {ANONYMITY_PROMISE[def.anonymity]}
                </div>
                <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.55 }}>
                  This is not marketing copy for the survey. It is the constraint the data model is built to keep, and the two
                  are the same object.
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
              {def.questions.map((q, i) => (
                <div key={q.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--pf-n300)", width: 24, flex: "none", marginTop: 2 }}>{q.id}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.5 }}>{q.text}</div>
                    {q.choices && (
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        {q.choices.map((c) => <PfBadge key={c} tone="grey">{c}</PfBadge>)}
                      </div>
                    )}
                    {q.hint && (
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55, fontStyle: "italic" }}>{q.hint}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flex: "none" }}>
                    {q.driver && <PfBadge tone="purple">{driverMeta(q.driver).name}</PfBadge>}
                    <PfBadge tone={q.kind === "free-text" ? "yellow" : "grey"}>{q.kind === "likert5" ? "1–5" : q.kind === "single-choice" ? "Choice" : "Free text"}</PfBadge>
                    {!q.required && <PfBadge tone="grey">Optional</PfBadge>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", padding: "12px 20px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 8 }}>Runs of this instrument</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {defRuns.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setRunId(r.id); setTab("results"); }}
                    style={{ fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "7px 11px" }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>{r.id}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n900)" }}>{rateOf(r)}%</span>
                    <PfBadge tone={runStateTone(r.state)}>{r.state}</PfBadge>
                  </button>
                ))}
                {defRuns.length === 0 && <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Never run. An instrument that has never run is a document.</span>}
              </div>
            </div>
          </PfCard>

          {/* -------------------------------- builder ------------------------------ */}
          <PfCard>
            <PfCardHead
              title="Build a new instrument"
              sub="The only builder question that matters is whether the answers will be publishable. It is asked here, before anybody is invited, instead of at the readout."
            >
              <PfBadge tone={bBlocked > 0 ? "yellow" : "green"} dot>{bCuts.length - bBlocked} of {bCuts.length} cuts reportable</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 0 }}>
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Name</div>
                  <input value={bName} onChange={(e) => setBName(e.target.value)} placeholder="e.g. Field Operations — communication check" style={fieldStyle} />
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Anonymity — the promise</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                    {(["anonymous", "confidential", "attributed"] as AnonymityMode[]).map((m) => {
                      const on = bAnon === m;
                      return (
                        <button key={m} onClick={() => setBAnon(m)} style={{ fontFamily: "inherit", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "7px 11px", borderRadius: 8, background: on ? TONE.green.soft : "var(--pf-n0)", border: `1px solid ${on ? TONE.green.line : "var(--pf-n50)"}`, color: on ? "var(--pf-primary-500)" : "var(--pf-n600)" }}>
                          {ANONYMITY_LABEL[m]}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}>
                    {ANONYMITY_PROMISE[bAnon]}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Who gets asked</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                    {([["all", "Everyone"], ["dept", "Department"], ["site", "Site"], ["worker-type", "Worker type"]] as const).map(([k, l]) => {
                      const on = bKind === k;
                      return (
                        <button
                          key={k}
                          onClick={() => { setBKind(k); setBValue(k === "dept" ? "Field Operations" : k === "site" ? SITES[1].name : k === "worker-type" ? "Employee" : "Everyone in engagement scope"); }}
                          style={{ fontFamily: "inherit", cursor: "pointer", fontSize: 12, fontWeight: 500, padding: "7px 11px", borderRadius: 8, background: on ? TONE.blue.soft : "var(--pf-n0)", border: `1px solid ${on ? TONE.blue.line : "var(--pf-n50)"}`, color: on ? "var(--pf-blue-500)" : "var(--pf-n600)" }}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                  {bKind !== "all" && (
                    <select value={bValue} onChange={(e) => setBValue(e.target.value)} style={fieldStyle}>
                      {(bKind === "dept" ? DEPARTMENTS.map((d) => d.name) : bKind === "site" ? SITES.map((s) => s.name) : ["Employee", "NYSC / Intern"]).map((v) => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Not offered as a cut:</span>
                    {["Nationality", "Host community"].map((x) => (
                      <span key={x} style={{ fontSize: 11, color: "var(--pf-n300)", textDecoration: "line-through", background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 4, padding: "2px 6px" }}>{x}</span>
                    ))}
                    <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>— NCDMB reporting fields. They are reported on. They are never a way to choose who gets asked.</span>
                  </div>
                  {bKind === "site" && !siteInScope(bValue) && (
                    <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                      <Ic name="warning" size={13} color="var(--pf-yellow-500)" />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                        No engagement cut exists for {bValue} yet, so the estimate below uses the muster of {SITES.find((s) => s.name === bValue)?.muster}. That number
                        includes contractor headcount which is out of scope for this instrument — read it as optimistic.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 6 }}>Drivers to ask about</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {DRIVERS.map((d) => {
                      const on = bQuestions.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          onClick={() => setBQuestions((q) => (on ? q.filter((x) => x !== d.key) : [...q, d.key]))}
                          style={{ fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, padding: "7px 10px", borderRadius: 8, background: on ? TONE.purple.soft : "var(--pf-n0)", border: `1px solid ${on ? TONE.purple.line : "var(--pf-n50)"}`, color: on ? "var(--pf-purple-500)" : "var(--pf-n600)" }}
                        >
                          <Ic name={on ? "check" : "plus"} size={12} color={on ? "var(--pf-purple-500)" : "var(--pf-n300)"} />
                          {d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)" }}>Open for</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "4px 6px" }}>
                    <PfBtn small variant="ghost" onClick={() => setBWindow((w) => Math.max(3, w - 1))}>−</PfBtn>
                    <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", width: 54, textAlign: "center" }}>{bWindow}d</span>
                    <PfBtn small variant="ghost" onClick={() => setBWindow((w) => Math.min(21, w + 1))}>+</PfBtn>
                  </div>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1, lineHeight: 1.5 }}>
                    Working days. Rotation crews need a window longer than a tour or half of them never see it.
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <PfBtn variant="primary" icon="check" onClick={saveDraft}>Save as draft</PfBtn>
                  <PfBtn variant="secondary" icon="paperplane" onClick={() => toast("Scheduling is a separate, deliberate step. A draft cannot send itself.", "danger")}>Schedule</PfBtn>
                </div>
              </div>

              {/* -------------------------- reportability preview --------------------- */}
              <div style={{ borderLeft: "1px solid var(--pf-n50)", background: "var(--pf-n25)", padding: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Will you be able to publish it?</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.55 }}>
                  Expected responses use the live rate of {rateOf(RUN)}% from {RUN.id}. A cut is publishable at {MIN_REPORTING_N} or more.
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "14px 0 12px" }}>
                  <span style={{ fontSize: 26, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{bPopulation}</span>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>in scope · about {Math.round(bPopulation * bRate)} answers expected</span>
                </div>

                {bCuts.map((c) => (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pf-n0)", border: `1px solid ${c.ok ? "var(--pf-n50)" : "var(--pf-red-100)"}`, borderRadius: 9, padding: "9px 11px", marginBottom: 7 }}>
                    <Ic name={c.ok ? "check" : "shield"} size={14} color={c.ok ? "var(--pf-primary-500)" : "var(--pf-red-500)"} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--pf-n900)", lineHeight: 1.4 }}>{c.label}</div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{c.pop} invited · about {c.expected} answers</div>
                    </div>
                    <PfBadge tone={c.ok ? "green" : "red"}>{c.ok ? "Reportable" : "Never shown"}</PfBadge>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 9, marginTop: 12, alignItems: "flex-start" }}>
                  <Ic name="info" size={14} color="var(--pf-n400)" />
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                    {bBlocked === 0
                      ? "Every cut you can build from this audience will publish. Ask freely."
                      : `${bBlocked} of these cuts will never be shown to anyone, including the manager who owns the team. That is not a bug you will discover at the readout — it is the answer now, and it is the reason SL-10 exists in this quarter's results.`}
                  </div>
                </div>
              </div>
            </div>

            {drafts.length > 0 && (
              <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
                {drafts.map((d, i) => (
                  <div key={`${d.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <PfTile icon="file" tone="grey" size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>{d.name}</span>
                    <PfBadge tone="grey">{d.audience} · {d.n}</PfBadge>
                    <PfBadge tone="blue">{ANONYMITY_LABEL[d.anon]}</PfBadge>
                    <PfBadge tone="yellow" dot>Draft · nothing sent</PfBadge>
                  </div>
                ))}
              </div>
            )}

            <Foot icon="clipboard">
              {ENGAGE_TODAY}. Nothing on this card invites anybody. Drafting, scheduling and sending are three separate acts by
              three separate clicks, because a survey that goes out by accident is a promise made by accident.
            </Foot>
          </PfCard>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ library card ------------------------------ */

function InstrumentCard({ def, on, onPick }: { def: SurveyDef; on: boolean; onPick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const runs = SURVEY_RUNS.filter((r) => r.defId === def.id);
  const open = runs.filter((r) => r.state === "Open").length;
  return (
    <button
      {...hoverProps}
      onClick={onPick}
      style={{
        fontFamily: "inherit", textAlign: "left", cursor: "pointer", padding: 14, borderRadius: 12,
        background: on ? TONE.purple.soft : "var(--pf-n0)",
        border: `1px solid ${on ? TONE.purple.line : hovered ? "var(--pf-n100)" : "var(--pf-n50)"}`,
        boxShadow: on ? `0 0 0 1px ${TONE.purple.line}` : "0 1px 3px 0 #f3f3f3",
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfTile icon={def.type === "exit" ? "door" : def.type === "onboarding" ? "user" : def.type === "custom" ? "target" : "megaphone"} tone={on ? "purple" : "grey"} size={28} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def.name}</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{def.cadence} · {def.questions.length} questions</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <PfBadge tone={def.anonymity === "anonymous" ? "green" : def.anonymity === "confidential" ? "blue" : "yellow"}>{ANONYMITY_LABEL[def.anonymity]}</PfBadge>
        {open > 0 ? <PfBadge tone="green" dot>{open} open</PfBadge> : <PfBadge tone="grey">{runs.length} runs</PfBadge>}
      </div>
    </button>
  );
}
