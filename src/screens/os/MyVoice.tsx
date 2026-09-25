"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, PfSegments, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ANONYMITY_LABEL, ANONYMITY_PROMISE, COMMENT_THEMES, ENGAGE_AI_SURFACES,
  ENGAGE_MODEL_CARDS, ENGAGE_TODAY, LIKERT_ANCHORS, MIN_REPORTING_N, SURVEY_ACCESS_LOG,
  SURVEY_TYPE_LABEL, SUPPRESSION_AUDIT, canReport, commentStats, commentsFor, deltaTone,
  driverMeta, driverTone, enpsBand, enpsScore, invitesFor, inviteNudge, pendingInvitesFor,
  rateOf, releasedComments, runStateTone, slice, sliceReport, slicesFor,
  surveyDef, surveyRun, themeWhy,
  type AnonymityMode, type CommentTheme, type DriverKey, type ResultSlice,
  type SurveyComment, type SurveyDef, type SurveyQuestion, type SurveyRun,
} from "@/data/engage";
import { ME_ID, ME_PUBLIC, ME_FIRST, MY_MANAGER, MY_SKIP, MY_SQUAD } from "@/data/me";
import type { WhyThis } from "@/data/trust";

/**
 * My voice — FR-094 from the ONE SIDE THAT MATTERS: the person being asked.
 *
 * Every other engagement screen in this product is a reader's screen. This one
 * is the respondent's, and the only thing it has to earn is that she answers
 * honestly. So the anonymity contract is rendered BEFORE the first question,
 * in the plainest words the rules can be written in, with the enforcement
 * mechanism visible underneath each promise rather than asserted above it.
 *
 * Three claims are made at the top of the take-flow, and all three are read out
 * of engage.ts rather than written into this file:
 *   · a team score reaches her manager only at MIN_REPORTING_N respondents —
 *     `canReport()` refuses below it and `sliceReport()` is the only accessor;
 *   · free text is held until a named human releases it — every SurveyComment
 *     starts `released: false` and carries the reviewer's note either way;
 *   · her name is never attached to a Likert answer — SURVEY_INVITES is a
 *     receipt table and nothing in the module joins it to RESULT_SLICES (E3).
 *
 * The demonstration this page exists for: Amara sits in a squad of six. SL-10
 * is that squad. It carries no `result` object at all, and the access log holds
 * the moment on Aug 27 at 14:03 when her manager tried to open it and the
 * platform refused. That refusal is the product.
 *
 * Nothing here is invented. Where a number could not be read directly it is
 * derived and labelled: the Q2 comparison is `score − delta` off the published
 * SR-31 deltas, and ROUND_ACTIONS is a local rollup in which every row names
 * the engage.ts record it was read from. There is no actions table in the spine.
 *
 * Deterministic — no Date.now(), no Math.random(). Reference day: ENGAGE_TODAY.
 */

/* ---------------------------------- subject -------------------------------- */

const ME = ME_PUBLIC;

/** The two open runs she still owes an answer to. Receipts only — never answers. */
const MY_PENDING = pendingInvitesFor(ME_ID);
const MY_INVITES = invitesFor(ME_ID);
/** Her Q2 receipt — the last round she actually answered. */
const MY_LAST = MY_INVITES.find((i) => i.responded && i.runId === "SR-28");

/** Her squad, as the results table sees it. No `result` key. That is the point. */
const MY_SQUAD_SLICE: ResultSlice | undefined = slice("SL-10");
const SQUAD_SIZE = MY_SQUAD_SLICE?.invited ?? 6;
const SQUAD_ANSWERED = MY_SQUAD_SLICE?.responded ?? 4;

/** The refusal, verbatim from the access log. The single best row in the module. */
const REFUSAL = SURVEY_ACCESS_LOG.find((a) => a.action.includes("refused"));

const AUDIT = SUPPRESSION_AUDIT();
const COMMENTS = commentStats();

const ORG_SLICE = slice("SL-01");
const ENG_SLICE = slice("SL-02");
const ENG_ANSWERED = ENG_SLICE?.responded ?? 52;

/** The two runs the loop tab compares. Read once, so nothing downstream has to guess. */
const RUN_Q2 = surveyRun("SR-28");
const RUN_Q3 = surveyRun("SR-31");
const RATE_Q2 = RUN_Q2 ? rateOf(RUN_Q2) : 71;
const RATE_Q3 = RUN_Q3 ? rateOf(RUN_Q3) : 60;

const TODAY_SHORT = ENGAGE_TODAY.replace(", 2026", "");

/* ------------------------------ derived: Q2 → Q3 ---------------------------- */

/**
 * SR-28's own scores are not in RESULT_SLICES — only SR-31's, each carrying the
 * delta it moved by. The prior figure is therefore `score − delta`, to one
 * decimal, and the page says so wherever it renders.
 */
const priorOf = (score: number, delta: number): number => Math.round((score - delta) * 10) / 10;

/* --------------------------- derived: round actions ------------------------- */

type ActionState = "Done" | "In flight" | "Not moved";

type RoundAction = {
  id: string;
  title: string;
  detail: string;
  state: ActionState;
  owner: string;
  when: string;
  /** The engage.ts record this row was read out of. Rendered, not implied. */
  source: string;
};

const ACTION_TONE: Record<ActionState, PfTone> = { Done: "green", "In flight": "blue", "Not moved": "red" };

/**
 * DERIVED. engage.ts has no actions table for a survey round, so this rollup is
 * assembled here — and every row names the record it came from, so nothing on
 * this list is a claim the data cannot support.
 */
const ROUND_ACTIONS: RoundAction[] = [
  {
    id: "RA-1",
    title: "A targeted workload check went out to Engineering",
    detail:
      "Five questions, one dimension, one department — not a second pulse. 39 of 84 have answered. You are one of the 45 who have not.",
    state: "In flight",
    owner: "Engineering · Ngozi Adeyemi, run by People Ops",
    when: "Opened Aug 26 · closes Sep 2",
    source: "SURVEY_RUNS SR-30 — run by People Ops on purpose, so the department does not hold its own team's raw answers.",
  },
  {
    id: "RA-2",
    title: "Every free-text comment was read by a named person before any of it moved",
    detail: `Five released, four held, one still unreviewed. Nothing appears in a report until someone signs for it, and the reason is written down both ways.`,
    state: "Done",
    owner: "People Ops · Funke Adebayo",
    when: "Aug 27 · 09:31",
    source: "SURVEY_ACCESS_LOG — 'released 5 comments, held 4' · SURVEY_COMMENTS review notes.",
  },
  {
    id: "RA-3",
    title: "A team-level filter was refused",
    detail:
      "Your manager opened Engineering's results, then tried to narrow to the Payments squad. Four responses. The platform refused and logged the attempt.",
    state: "Done",
    owner: "Refused by the platform · attempted by Engineering · Ngozi Adeyemi",
    when: "Aug 27 · 14:03",
    source: "SURVEY_ACCESS_LOG — 'attempted team filter — refused, below threshold'.",
  },
  {
    id: "RA-4",
    title: "Themes were built from released comments only",
    detail:
      "Four themes over five released comments. The four held comments were not summarised, not quoted and not counted — which is why the theme totals do not add up to the comment total.",
    state: "Done",
    owner: "MC-09 · Comment theme summary, over text People Ops had already cleared",
    when: "Aug 27",
    source: "COMMENT_THEMES + ENGAGE_MODEL_CARDS MC-09.",
  },
  {
    id: "RA-5",
    title: "Workload",
    detail:
      "Org 3.5 → 3.1. Engineering 3.1 → 2.4. It is the one driver that fell in both cuts, it is the reason SR-30 exists, and nothing that happened after the last round has moved it yet.",
    state: "Not moved",
    owner: "Engineering · Ngozi Adeyemi",
    when: "Q2 → Q3",
    source: "SL-01 and SL-02 workload scores, less their published deltas (−0.4 and −0.7).",
  },
];

const ACTION_STATES: (ActionState | "All")[] = ["All", "Done", "In flight", "Not moved"];

/* ----------------------------- free-text rule check ------------------------- */

type DetailFlag = { id: string; label: string; detail: string; tone: PfTone };

/** Capitalised words that are not names. Keeps the rule from crying wolf. */
const NOT_NAMES = new Set([
  "I", "It", "The", "We", "They", "This", "That", "My", "A", "An", "If", "In", "On", "At",
  "But", "And", "So", "Not", "No", "You", "There", "When", "What", "Why", "How", "Nobody",
  "Everyone", "Someone", "Nothing", "Our", "Their", "His", "Her", "Also", "Then", "Because",
  "People", "Ops", "HR", "Engineering", "Lagos",
]);

/**
 * A RULE, not a model. It runs in the browser as you type, reads only the box it
 * is attached to, sends nothing anywhere, and cannot block a submission. It
 * exists because the honest warning under a free-text box on a team of six is
 * not "be constructive" — it is "this paragraph can identify you".
 */
function detailFlags(raw: string): DetailFlag[] {
  const t = raw.trim();
  if (!t) return [];
  const out: DetailFlag[] = [];

  const tokens = t.split(/\s+/);
  const propers: string[] = [];
  let atSentenceStart = true;
  for (const tok of tokens) {
    const w = tok.replace(/^[^A-Za-z']+/, "").replace(/[^A-Za-z']+$/, "");
    if (w && !atSentenceStart && /^[A-Z][a-z']{1,}$/.test(w) && !NOT_NAMES.has(w)) propers.push(w);
    atSentenceStart = /[.!?]$/.test(tok);
  }
  if (propers.length > 0) {
    out.push({
      id: "names",
      label: `${propers.length === 1 ? "A name" : `${propers.length} names`} in the text`,
      detail: `"${propers.slice(0, 3).join('", "')}" reads like a person. A comment that names someone is held — releasing it identifies them and, on a team this size, usually identifies you too.`,
      tone: "red",
    });
  }

  if (/\b(squad|my team|our team|the six of us|stand-?up|our pod)\b/i.test(t)) {
    out.push({
      id: "squad",
      label: "Narrows to your squad",
      detail: `You are one of ${SQUAD_SIZE} on the Payments squad. A comment scoped to the squad belongs to a slice that can never be reported — People Ops will hold it on the count alone, whatever it says.`,
      tone: "yellow",
    });
  }

  if (/\b(last (week|month|monday|tuesday|wednesday|thursday|friday)|yesterday|on the \d{1,2}(st|nd|rd|th)?|in the (meeting|stand-?up|review|retro|1:1|one-on-one))\b/i.test(t)) {
    out.push({
      id: "incident",
      label: "A specific occasion",
      detail:
        "An incident with a date and a room narrows the author to whoever was in it. Describe the pattern rather than the day and it survives review.",
      tone: "yellow",
    });
  }

  if (t.length > 320) {
    out.push({
      id: "length",
      label: `${t.length} characters`,
      detail:
        "Long free text carries writing style, and style is an identifier on a small team. Shorter usually gets released; longer usually gets held.",
      tone: "yellow",
    });
  }

  return out;
}

/* -------------------------------- small pieces ------------------------------ */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 10,
  padding: "12px 13px", width: "100%", outline: "none", lineHeight: 1.55, resize: "vertical",
};

function Note({ icon = "info", tone = "grey", children }: { icon?: string; tone?: PfTone; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Ic name={icon} size={13} color={TONE[tone].fg} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

/** The one FR-093 affordance, rendered identically everywhere it appears. */
function WhyThisPanel({ why }: { why: WhyThis }) {
  const go = useGo();
  const [open, setOpen] = useState(false);
  const card = ENGAGE_MODEL_CARDS.find((m) => m.id === why.modelCard);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-purple-500)" />
        Why this?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{why.claim}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>Basis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {why.basis.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
            <button
              onClick={() => go("trust")}
              title="Model card index — Trust center"
              style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
            >
              <Ic name="robot" size={12} color="var(--pf-purple-500)" />
              Model card {why.modelCard}{card ? ` · ${card.name}` : ""}
            </button>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1, minWidth: 220, lineHeight: 1.45 }}>
              Human gate: {why.humanGate.toLowerCase()}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** Anything a model produced is purple and labelled. Nothing else on this page is. */
function AiBlock({ label, chip, children, why }: { label: string; chip?: string; children: ReactNode; why?: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--pf-purple-100)", background: "var(--pf-purple-50)", borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>{label}</span>
        {chip && <PfBadge tone="purple">{chip}</PfBadge>}
        <span style={{ flex: 1 }} />
        {why}
      </div>
      {children}
    </div>
  );
}

/** One promise in the anonymity contract, with the mechanism under it. */
function PromiseRow({ icon, tone, claim, mechanism, proof }: {
  icon: string; tone: PfTone; claim: string; mechanism: string; proof?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
      <PfTile icon={icon} tone={tone} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{claim}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.55 }}>{mechanism}</div>
        {proof && <div style={{ marginTop: 7 }}>{proof}</div>}
      </div>
    </div>
  );
}

/** One link in a chain — done / current / waiting. */
function Step({ n, last, icon, tone, title, sub, state }: {
  n: number; last?: boolean; icon: string; tone: PfTone; title: string; sub: string; state: "done" | "next" | "wait";
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: state === "wait" ? 0.72 : 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
        <PfTile icon={icon} tone={state === "wait" ? "grey" : tone} size={26} />
        {!last && <span style={{ width: 1.5, flex: 1, minHeight: 16, background: "var(--pf-n50)", marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{n}. {title}</span>
          {state === "done" && <PfBadge tone="green" dot>Done</PfBadge>}
          {state === "next" && <PfBadge tone="blue" dot>Where you are</PfBadge>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>{sub}</div>
      </div>
    </div>
  );
}

/* ------------------------------ who-sees-what ------------------------------- */

type Cell = { text: string; tone: PfTone; note?: string };

const CELL_LEGEND: { tone: PfTone; label: string }[] = [
  { tone: "blue", label: "They can see it today" },
  { tone: "yellow", label: "People Ops only" },
  { tone: "purple", label: "Only after a named person releases it" },
  { tone: "grey", label: "The platform cannot produce it for them" },
];

type ViewerRow = { who: string; role: string; cells: Cell[] };

function matrixFor(mode: AnonymityMode, squadN: number): ViewerRow[] {
  const squadOk = canReport(squadN);
  const squadCell: Cell = squadOk
    ? { text: "Yes", tone: "blue", note: `${squadN} responses clears the line of ${MIN_REPORTING_N}` }
    : { text: "No", tone: "grey", note: `${squadN} responses — under the line of ${MIN_REPORTING_N}` };

  const nameCell = (whoIsHr: boolean): Cell =>
    mode === "attributed"
      ? { text: "Yes", tone: "blue", note: "Attributed run — your name travels with the answer" }
      : mode === "confidential"
        ? whoIsHr
          ? { text: "Yes — HR only", tone: "yellow", note: "Confidential run: identity is stored and visible to People Ops" }
          : { text: "Never", tone: "grey", note: "Confidential to HR — your manager cannot, and never will" }
        : { text: "Not stored", tone: "grey", note: "Anonymous run: no identity is written with the answer at all" };

  const textCell = (whoIsHr: boolean): Cell =>
    whoIsHr
      ? { text: "Yes — they review it", tone: "yellow", note: "People Ops read every comment before anyone else can" }
      : { text: "Released only", tone: "purple", note: "And then as a theme, alongside the comment it was built from" };

  return [
    {
      who: `You · ${ME.id}`,
      role: "the person answering",
      cells: [
        { text: "Not stored", tone: "grey", note: "You cannot retrieve your own answers either. That is the cost of the promise." },
        squadCell,
        { text: "Yes", tone: "blue" },
        { text: "No copy kept", tone: "grey", note: "This page does not hold your words back for you after you submit" },
      ],
    },
    { who: MY_MANAGER.name, role: MY_MANAGER.role, cells: [nameCell(false), squadCell, { text: "Yes", tone: "blue" }, textCell(false)] },
    { who: MY_SKIP.name, role: MY_SKIP.role, cells: [nameCell(false), squadCell, { text: "Yes", tone: "blue" }, textCell(false)] },
    { who: "People Ops · Funke Adebayo", role: "HR business partner", cells: [nameCell(true), squadCell, { text: "Yes", tone: "blue" }, textCell(true)] },
    { who: "Executive · Folake Coker", role: "from the access log", cells: [nameCell(false), squadCell, { text: "Yes", tone: "blue" }, textCell(false)] },
  ];
}

/* ------------------------------- slice explorer ----------------------------- */

function SliceRow({ s, active, mine, onClick }: { s: ResultSlice; active: boolean; mine: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const ok = canReport(s.responded);
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "grid", gridTemplateColumns: "88px 1fr 74px 104px", alignItems: "center", gap: 10,
        width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        padding: "10px 14px", border: "none", borderTop: "1px solid var(--pf-n50)",
        background: active ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
      }}
    >
      <span><PfBadge tone={s.kind === "Team" ? "purple" : s.kind === "Org" ? "blue" : "grey"}>{s.kind}</PfBadge></span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: active ? 700 : 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
        {mine && <PfBadge tone="yellow">Yours</PfBadge>}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: ok ? "var(--pf-n600)" : "var(--pf-red-500)" }}>
        {s.responded}/{s.invited}
      </span>
      <span><PfBadge tone={ok ? "green" : "red"} dot>{ok ? "Reportable" : "Suppressed"}</PfBadge></span>
    </button>
  );
}

/* ---------------------------------- drivers --------------------------------- */

function DriverBar({ k, score, delta, favourable, prior }: {
  k: DriverKey; score: number; delta: number; favourable: number; prior?: number;
}) {
  const meta = driverMeta(k);
  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--pf-n50)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <Ic name={meta.icon} size={14} color={TONE[driverTone(score)].fg} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 120 }}>{meta.name}</span>
        {prior !== undefined && (
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
            {prior.toFixed(1)} <span style={{ color: "var(--pf-n300)" }}>→</span>
          </span>
        )}
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{score.toFixed(1)}</span>
        <PfBadge tone={deltaTone(delta)}>{delta > 0 ? "+" : ""}{delta.toFixed(1)}</PfBadge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 9 }}>
        <PfSegments score={score} outOf={5} tone={driverTone(score)} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{favourable}% answered Agree or Strongly agree</span>
      </div>
    </div>
  );
}

/* -------------------------------- comment card ------------------------------ */

function CommentCard({ c }: { c: SurveyComment }) {
  const meta = driverMeta(c.driver);
  return (
    <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "12px 14px", background: c.released ? "var(--pf-n0)" : "var(--pf-n25)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n400)" }}>{c.id}</span>
        <PfBadge tone={c.released ? "green" : "grey"} dot>{c.released ? "Released" : c.reviewedBy ? "Held" : "Not yet reviewed"}</PfBadge>
        <PfBadge tone="grey">{meta.name}</PfBadge>
      </div>
      <div style={{
        fontSize: 12.5, lineHeight: 1.6, fontStyle: c.released ? "normal" : "italic",
        color: c.released ? "var(--pf-n900)" : "var(--pf-n300)",
      }}>
        {c.released ? `“${c.text}”` : "This comment is not shown. Not blurred, not truncated — the page never receives it."}
      </div>
      <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--pf-n50)" }}>
        <Note icon={c.released ? "check" : "shield"} tone={c.released ? "green" : "yellow"}>
          <b>{c.reviewedBy ?? "Unreviewed"}{c.reviewedAt ? ` · ${c.reviewedAt}` : ""}</b> — {c.reviewNote}
        </Note>
      </div>
    </div>
  );
}

/* ================================== screen ================================== */

type Tab = "take" | "promise" | "loop";

export default function MyVoice() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("take");

  /* ------------------------------- the take-flow --------------------------- */
  const [runId, setRunId] = useState<string>(MY_PENDING[0]?.runId ?? "SR-31");
  const [stepByRun, setStepByRun] = useState<Record<string, number>>({});
  /** Keyed `${runId}|${questionId}`. Never leaves this component. */
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, { likert: number; choice: number; text: number; skipped: number; at: string; wroteText: boolean }>>({});
  const [contractOpen, setContractOpen] = useState(false);

  /* --------------------------- what happens tab state ---------------------- */
  const [mode, setMode] = useState<AnonymityMode>("anonymous");
  const [sliceId, setSliceId] = useState<string>("SL-10");
  const [squadWhatIf, setSquadWhatIf] = useState<number>(SQUAD_ANSWERED);
  const [logOpen, setLogOpen] = useState(true);

  /* ------------------------------- loop tab state -------------------------- */
  const [compareId, setCompareId] = useState<string>("SL-01");
  const [actionFilter, setActionFilter] = useState<ActionState | "All">("All");
  const [openTheme, setOpenTheme] = useState<string | null>(null);

  /* --------------------------------- derived ------------------------------- */

  const run: SurveyRun | undefined = surveyRun(runId);
  const def: SurveyDef | undefined = run ? surveyDef(run.defId) : undefined;
  const questions: SurveyQuestion[] = def?.questions ?? [];
  const step = stepByRun[runId] ?? 0;
  const onReview = step >= questions.length;
  const q: SurveyQuestion | undefined = questions[step];
  const isDone = Boolean(submitted[runId]);

  const answerOf = (qid: string) => answers[`${runId}|${qid}`] ?? "";
  const answeredCount = questions.filter((x) => answerOf(x.id).trim().length > 0).length;
  const missingRequired = questions.filter((x) => x.required && answerOf(x.id).trim().length === 0);
  const pct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  const freeText = q?.kind === "free-text" ? answerOf(q.id) : "";
  /** Cheap enough to run on every keystroke — four regexes over one textarea. */
  const flags = detailFlags(freeText);

  const pendingLeft = MY_PENDING.filter((i) => !submitted[i.runId]);
  const nextClose = pendingLeft.reduce<number | null>((a, i) => {
    const r = surveyRun(i.runId);
    if (!r) return a;
    return a === null || r.daysLeft < a ? r.daysLeft : a;
  }, null);

  const activeSlice = slice(sliceId);
  const report = activeSlice ? sliceReport(activeSlice) : undefined;
  const sr31Slices = slicesFor("SR-31");

  const compareSlice = slice(compareId);
  const compareReport = compareSlice ? sliceReport(compareSlice) : undefined;

  const visibleActions = actionFilter === "All" ? ROUND_ACTIONS : ROUND_ACTIONS.filter((a) => a.state === actionFilter);

  const releasedThisCycle: SurveyComment[] = [
    ...releasedComments("SR-31"),
    ...releasedComments("SR-30"),
  ];
  const heldThisCycle: SurveyComment[] = [
    ...commentsFor("SR-31").filter((c) => !c.released),
    ...commentsFor("SR-30").filter((c) => !c.released),
  ];

  const matrix = matrixFor(mode, squadWhatIf);

  /* --------------------------------- actions ------------------------------- */

  const setAnswer = (qid: string, v: string) => setAnswers((prev) => ({ ...prev, [`${runId}|${qid}`]: v }));
  const setStep = (n: number) => setStepByRun((prev) => ({ ...prev, [runId]: Math.max(0, Math.min(questions.length, n)) }));

  const pickLikert = (qid: string, anchor: string) => {
    setAnswer(qid, anchor);
    if (step < questions.length) setStep(step + 1);
  };

  const saveDraft = () => {
    setSavedAt((prev) => ({ ...prev, [runId]: TODAY_SHORT }));
    toast(`Draft kept on this device — ${answeredCount} of ${questions.length} answered. Nothing has been submitted, and no one has been told you started.`);
  };

  const submit = () => {
    if (!run || !def) return;
    if (missingRequired.length > 0) {
      const first = questions.findIndex((x) => x.id === missingRequired[0].id);
      setStep(first);
      toast(`${missingRequired.length} required ${missingRequired.length === 1 ? "question is" : "questions are"} still blank — taken to the first one`, "danger");
      return;
    }
    const likert = questions.filter((x) => x.kind === "likert5" && answerOf(x.id)).length;
    const choice = questions.filter((x) => x.kind === "single-choice" && answerOf(x.id)).length;
    const textQs = questions.filter((x) => x.kind === "free-text" && answerOf(x.id).trim().length > 0);
    setSubmitted((prev) => ({
      ...prev,
      [runId]: {
        likert, choice, text: textQs.length, at: TODAY_SHORT, wroteText: textQs.length > 0,
        skipped: questions.length - answeredCount,
      },
    }));
    toast(
      textQs.length > 0
        ? `${run.name} submitted. ${likert + choice} scored answers went into the pool without your name; your comment is with People Ops, unreleased.`
        : `${run.name} submitted. ${likert + choice} scored answers went into the pool without your name.`,
      "success",
    );
  };

  const startOther = () => {
    const other = MY_PENDING.find((i) => i.runId !== runId && !submitted[i.runId]);
    if (!other) { toast("Nothing else is open for you right now"); return; }
    setRunId(other.runId);
    toast(`Switched to ${surveyRun(other.runId)?.name ?? other.runId}`);
  };

  /* ---------------------------------- view --------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header ------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My voice</div>
            <PfBadge tone="grey">{ME.id}</PfBadge>
            <PfBadge tone="purple">{MY_SQUAD}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55 }}>
            The surveys open to you, exactly who can see what you say, and what happened to the last round&rsquo;s answers.
            Read the contract before you answer a question &mdash; every promise on it is enforced by the data, not by this page.
          </div>
        </div>
        <PfBtn variant="secondary" icon="shield" onClick={() => go("myprivacy")}>My data &amp; privacy</PfBtn>
        <PfBtn variant="primary" icon="chat" onClick={() => setTab("take")}>Answer now</PfBtn>
      </div>

      {/* ------------------------------- KPI strip ----------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="chat" tone="green" label="Open for you"
          value={pendingLeft.length} unit={pendingLeft.length === 1 ? "survey" : "surveys"}
          delta={nextClose === null ? "All answered" : `Next closes in ${nextClose} working days`}
          deltaTone={nextClose === null ? "green" : "yellow"}
        />
        <PfStat
          icon="shield" tone="blue" label="Reporting threshold"
          value={MIN_REPORTING_N} unit="responses before a slice reports"
          delta={`${AUDIT.suppressed} of ${AUDIT.total} slices held back`} deltaTone="red"
        />
        <PfStat
          icon="file" tone="purple" label="Free text released"
          value={COMMENTS.released} unit={`of ${COMMENTS.total} comments`}
          delta={`${COMMENTS.held} held by People Ops`} deltaTone="yellow"
        />
        <PfStat
          icon="clock" tone="yellow" label="Your last answer"
          value={MY_LAST?.respondedOn ?? "Never"} unit={MY_LAST ? "Q2 pulse · SR-28" : "no receipt on file"}
          delta="Receipt only — never the answer" deltaTone="grey"
        />
      </div>

      {/* ---------------------------- the lead insight ------------------------- */}
      <div style={{ marginTop: 12 }}>
        <PfBanner
          tone="red" icon="shield" cta="Show me"
          onCta={() => { setTab("promise"); setSliceId("SL-10"); }}
        >
          Your squad is {SQUAD_SIZE} people and {SQUAD_ANSWERED} of you answered. That slice carries no score at all &mdash; and on{" "}
          {REFUSAL?.at ?? "Aug 27"}, {MY_MANAGER.name} opened Engineering&rsquo;s results, tried to narrow to the Payments squad,
          and the platform refused. The refusal is in the access log, not in a policy document.
        </PfBanner>
      </div>

      {/* ------------------------------ section tabs --------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: "take", label: "The open survey", count: String(pendingLeft.length) },
            { key: "promise", label: "What happens to my answers" },
            { key: "loop", label: "Last round, and what changed", count: String(ROUND_ACTIONS.length) },
          ]}
        />
      </div>

      {/* ================================= TAKE ================================ */}
      {tab === "take" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* ------------------------- which survey ------------------------- */}
          {MY_PENDING.length === 0 ? (
            <PfCard>
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", marginBottom: 12 }}><PfTile icon="check" tone="green" size={36} /></div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing is waiting on you</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5, maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>
                  You have no open invitations. The next quarterly pulse will land in your inbox and here at the same time &mdash;
                  the platform will tell you that you have not answered, and it will never be able to tell anyone what you said.
                </div>
              </div>
            </PfCard>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(MY_PENDING.length, 2)}, minmax(0,1fr))`, gap: 12 }}>
              {MY_PENDING.map((inv) => {
                const r = surveyRun(inv.runId);
                const d = r ? surveyDef(r.defId) : undefined;
                if (!r || !d) return null;
                const active = r.id === runId;
                const done = Boolean(submitted[r.id]);
                return (
                  <button
                    key={inv.id}
                    onClick={() => setRunId(r.id)}
                    style={{
                      fontFamily: "inherit", textAlign: "left", cursor: "pointer", padding: 0,
                      background: "var(--pf-n0)", borderRadius: 12,
                      border: `1px solid ${active ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
                      boxShadow: active ? "0 6px 16px -10px rgba(22,179,100,.5)" : "0 1px 3px 0 #f3f3f3",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
                      <PfTile icon={d.type === "pulse" ? "pulse" : "target"} tone={active ? "green" : "grey"} size={26} />
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.name}</span>
                      {done ? <PfBadge tone="green" dot>Submitted</PfBadge> : <PfBadge tone={runStateTone(r.state)} dot>{r.state}</PfBadge>}
                    </div>
                    <div style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
                        <PfBadge tone="grey">{SURVEY_TYPE_LABEL[d.type]}</PfBadge>
                        <PfBadge tone={d.anonymity === "anonymous" ? "green" : "yellow"}>{ANONYMITY_LABEL[d.anonymity]}</PfBadge>
                        <PfBadge tone="grey">{d.questions.length} questions</PfBadge>
                        <PfBadge tone={r.daysLeft <= 3 ? "red" : "blue"}>{r.daysLeft} working days left</PfBadge>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{inviteNudge(inv)}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 11 }}>
                        <div style={{ flex: 1 }}><PfProgress pct={rateOf(r)} tone={active ? "green" : "grey"} height={6} /></div>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{r.responded} of {r.invited} answered</span>
                      </div>
                      {inv.remindersSent > 0 && !done && (
                        <div style={{ marginTop: 9 }}>
                          <Note icon="bell" tone="yellow">
                            {inv.remindersSent} reminder sent. The reminder knows you have not answered and nothing else &mdash; it is
                            written from the receipt table, which holds no answers.
                          </Note>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ------------------- the anonymity contract, first ------------------ */}
          {def && run && (
            <PfCard>
              <PfCardHead
                title="Before you answer, this is the deal"
                sub={`${ANONYMITY_LABEL[def.anonymity]} · owned by ${def.owner} · ${run.name}`}
              >
                <PfBadge tone={def.anonymity === "anonymous" ? "green" : "yellow"} dot>{ANONYMITY_LABEL[def.anonymity]}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 20 }}>
                <PromiseRow
                  icon="users" tone="blue"
                  claim={`Your manager sees a team score only if ${MIN_REPORTING_N} or more people answer.`}
                  mechanism={`Not a setting someone can turn off. A slice under ${MIN_REPORTING_N} responses carries no result object at all, so there is nothing for a screen to render even if it asks.`}
                  proof={
                    <PfBadge tone={canReport(SQUAD_ANSWERED) ? "green" : "red"} dot>
                      Your squad: {SQUAD_ANSWERED} of {SQUAD_SIZE} — {canReport(SQUAD_ANSWERED) ? "reportable" : "suppressed"}
                    </PfBadge>
                  }
                />
                <PromiseRow
                  icon="file" tone="purple"
                  claim="Free text is held until a named person at People Ops releases it."
                  mechanism="Every comment starts unreleased. A reviewer signs for the decision either way, and the reason is kept — including the ones that are held."
                  proof={<PfBadge tone="yellow" dot>{COMMENTS.held} of {COMMENTS.total} held this cycle</PfBadge>}
                />
                <PromiseRow
                  icon="shield" tone="green"
                  claim="Your name is never attached to a Likert answer."
                  mechanism="The platform keeps a receipt saying you answered, and a pool of answers with no identity on them. Nothing joins the two — not for HR, not for an admin, not for an export."
                  proof={<PfBadge tone="grey" dot>Receipt {MY_PENDING.find((i) => i.runId === runId)?.id ?? "—"} holds a date, not an answer</PfBadge>}
                />
              </div>

              <div style={{ padding: "0 20px 16px" }}>
                <button
                  onClick={() => setContractOpen((v) => !v)}
                  style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                >
                  <Ic name="question" size={12} color="var(--pf-n500)" />
                  Read the promise in full, and the two it is not
                  <Ic name={contractOpen ? "caretdown" : "caretright"} size={11} color="var(--pf-n500)" />
                </button>
                {contractOpen && (
                  <div style={{ marginTop: 11, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                    {(Object.keys(ANONYMITY_LABEL) as AnonymityMode[]).map((m) => {
                      const on = m === def.anonymity;
                      return (
                        <div key={m} style={{ background: on ? "var(--pf-primary-50)" : "var(--pf-n25)", border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n50)"}`, borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{ANONYMITY_LABEL[m]}</span>
                            {on && <PfBadge tone="green" dot>This survey</PfBadge>}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>{ANONYMITY_PROMISE[m]}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <Foot icon="info">
                {def.purpose}
                {def.audience.note ? ` ${def.audience.note}` : ""}
              </Foot>
            </PfCard>
          )}

          {/* ----------------------------- the receipt ------------------------- */}
          {isDone && run && def && (
            <PfCard>
              <PfCardHead
                title="Submitted — here is exactly what was recorded"
                sub={`${run.name} · ${submitted[runId].at}. Two records were written, and nothing joins them.`}
              >
                <PfBadge tone="green" dot>Recorded</PfBadge>
              </PfCardHead>
              <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ border: "1px solid var(--pf-n100)", borderRadius: 11, padding: "13px 15px", borderLeft: "3px solid var(--pf-n900)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Ic name="user" size={15} color="var(--pf-n900)" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>The receipt &mdash; this one has your name</span>
                  </div>
                  {[
                    ["Worker", `${ME.name} · ${ME.id}`],
                    ["Run", `${run.id} — ${run.name}`],
                    ["Responded", `Yes, ${submitted[runId].at}`],
                    ["Answers held here", "None. This record has no answer field."],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--pf-n50)" }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 128, flex: "none" }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.45 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10 }}>
                    <Note icon="bell" tone="grey">This is the record the reminder was written from. It is why the platform stopped nudging you, and it is the entire extent of what it now knows about you and this survey.</Note>
                  </div>
                </div>

                <div style={{ border: "1px solid var(--pf-primary-100)", background: "var(--pf-primary-50)", borderRadius: 11, padding: "13px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <Ic name="shield" size={15} color="var(--pf-primary-500)" />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-primary-600)" }}>The answers &mdash; this one does not</span>
                  </div>
                  {[
                    ["Scored answers", `${submitted[runId].likert + submitted[runId].choice} added to the ${run.name} pool`],
                    ["Attached identity", "None"],
                    ["Free text", submitted[runId].wroteText ? `${submitted[runId].text} comment — with People Ops, unreleased` : "None written"],
                    ["Skipped", `${submitted[runId].skipped} optional ${submitted[runId].skipped === 1 ? "question" : "questions"}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--pf-primary-100)" }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", width: 128, flex: "none" }}>{k}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.45 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 10 }}>
                    <Note icon="warning" tone="yellow">
                      You cannot come back and read your own answers, or change them. Any page that could show them to you could show
                      them to someone else, and then the promise on this page would be false.
                    </Note>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 20px 16px" }}>
                <PfBtn variant="secondary" icon="swap" onClick={startOther}>Answer the other open survey</PfBtn>
                <PfBtn variant="secondary" icon="trend" onClick={() => setTab("loop")}>What happened to the last round</PfBtn>
              </div>
              <Foot icon="shield">
                Submitting is logged as a receipt only. Nothing on this page told {MY_MANAGER.name.split(" ")[0]} that you answered,
                and nothing will tell her what you said.
              </Foot>
            </PfCard>
          )}

          {/* ------------------------------ the flow --------------------------- */}
          {!isDone && def && run && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, alignItems: "start" }}>
              {/* ----------------------------- question ------------------------- */}
              <PfCard>
                <PfCardHead
                  title={onReview ? "Check it over, then submit" : `Question ${step + 1} of ${questions.length}`}
                  sub={onReview
                    ? "Nothing has been sent yet. This is the last point at which you can change any of it."
                    : q?.driver ? `Rolls into ${driverMeta(q.driver).name} — ${driverMeta(q.driver).blurb}` : "Not scored against a driver"}
                >
                  {savedAt[runId] && <PfBadge tone="grey" dot>Draft saved {savedAt[runId]}</PfBadge>}
                </PfCardHead>

                <div style={{ padding: "14px 20px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}><PfProgress pct={pct} tone="green" height={7} /></div>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
                      {answeredCount} of {questions.length} answered
                      {missingRequired.length > 0 ? ` · ${missingRequired.length} required left` : ""}
                    </span>
                  </div>
                </div>

                {!onReview && q && (
                  <div style={{ padding: "18px 20px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
                      <PfBadge tone={q.required ? "red" : "grey"}>{q.required ? "Required" : "Optional"}</PfBadge>
                      <PfBadge tone="grey">{q.kind === "likert5" ? "Agreement scale" : q.kind === "single-choice" ? "Pick one" : "Free text"}</PfBadge>
                      {q.driver && <PfBadge tone="blue">{driverMeta(q.driver).name}</PfBadge>}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.45, marginBottom: 16 }}>{q.text}</div>

                    {q.kind === "likert5" && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 8 }}>
                        {LIKERT_ANCHORS.map((anchor, i) => {
                          const on = answerOf(q.id) === anchor;
                          return (
                            <AnchorBtn key={anchor} anchor={anchor} n={i + 1} on={on} onClick={() => pickLikert(q.id, anchor)} />
                          );
                        })}
                      </div>
                    )}

                    {q.kind === "single-choice" && q.choices && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {q.choices.map((c) => {
                          const on = answerOf(q.id) === c;
                          return <ChoiceBtn key={c} label={c} on={on} onClick={() => pickLikert(q.id, c)} />;
                        })}
                      </div>
                    )}

                    {q.kind === "free-text" && (
                      <div>
                        <textarea
                          value={answerOf(q.id)}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          rows={5}
                          placeholder="Optional. Describe the work, not the people."
                          style={INPUT}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{answerOf(q.id).length} characters</span>
                          <span style={{ flex: 1 }} />
                          {answerOf(q.id).trim().length > 0 && (
                            <PfBadge tone={flags.length === 0 ? "green" : flags.some((f) => f.tone === "red") ? "red" : "yellow"} dot>
                              {flags.length === 0 ? "Nothing narrows this below the department cut" : `${flags.length} thing${flags.length === 1 ? "" : "s"} to look at`}
                            </PfBadge>
                          )}
                        </div>

                        {q.hint && (
                          <div style={{ marginTop: 11, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "11px 13px" }}>
                            <Note icon="warning" tone="yellow"><b>The honest warning.</b> {q.hint}</Note>
                            <div style={{ marginTop: 7 }}>
                              <Note icon="users" tone="yellow">
                                You are one of {SQUAD_SIZE} on the Payments squad. Detail that is obvious to your team is detail that
                                identifies you &mdash; and a comment from a slice of {SQUAD_SIZE} is held on the count alone, whatever it says.
                              </Note>
                            </div>
                          </div>
                        )}

                        {flags.length > 0 && (
                          <div style={{ marginTop: 11, border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
                              <Ic name="search" size={13} color="var(--pf-n500)" />
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--pf-n900)" }}>What this text gives away</span>
                              <span style={{ flex: 1 }} />
                              <PfBadge tone="grey">Rule check, not a model</PfBadge>
                            </div>
                            {flags.map((f) => (
                              <div key={f.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "10px 13px", borderTop: "1px solid var(--pf-n50)" }}>
                                <Ic name="warning" size={13} color={TONE[f.tone].fg} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{f.label}</div>
                                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 2, lineHeight: 1.55 }}>{f.detail}</div>
                                </div>
                              </div>
                            ))}
                            <div style={{ padding: "10px 13px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                              <Note icon="robot" tone="grey">
                                No model card, because no model ran. This is four string rules executing in your browser as you type.
                                Nothing in this box has left your device, none of it can stop you submitting, and it is advice about
                                risk rather than a judgement about content.
                              </Note>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ------------------------------ review --------------------------- */}
                {onReview && (
                  <div style={{ padding: "14px 20px 18px" }}>
                    {questions.map((qq, i) => {
                      const a = answerOf(qq.id);
                      return (
                        <div key={qq.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: "1px solid var(--pf-n50)" }}>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", width: 22, flex: "none", marginTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{qq.text}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                              {a ? (
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                                  {qq.kind === "free-text" ? `“${a.length > 90 ? `${a.slice(0, 90)}…` : a}”` : a}
                                </span>
                              ) : (
                                <PfBadge tone={qq.required ? "red" : "grey"}>{qq.required ? "Required — still blank" : "Skipped"}</PfBadge>
                              )}
                              <button
                                onClick={() => setStep(i)}
                                style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                              >
                                change
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div style={{ marginTop: 14, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                      <SectionLabel>What submitting will write</SectionLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {[
                          `${questions.filter((x) => x.kind !== "free-text" && answerOf(x.id)).length} scored answers into the ${run.name} pool, with no identity attached.`,
                          `One receipt against ${ME.id} saying you responded on ${TODAY_SHORT} — and nothing else.`,
                          questions.some((x) => x.kind === "free-text" && answerOf(x.id).trim())
                            ? "Your comment goes to People Ops unreleased. A named reviewer decides, and the reason is written down whichever way it goes."
                            : "No free text — nothing goes to the review queue.",
                          `Your squad slice stays suppressed either way: ${SQUAD_ANSWERED} of ${SQUAD_SIZE} answered, and the line is ${MIN_REPORTING_N}.`,
                        ].map((b) => (
                          <div key={b} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                            <Ic name="check" size={12} color="var(--pf-primary-500)" weight={2.2} />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ------------------------------ controls -------------------------- */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                  <PfBtn variant="secondary" icon="arrowup" onClick={() => setStep(step - 1)} style={step === 0 ? { opacity: 0.45 } : undefined}>Back</PfBtn>
                  {!onReview && q && !q.required && (
                    <PfBtn variant="ghost" onClick={() => { setAnswer(q.id, ""); setStep(step + 1); }}>Skip this one</PfBtn>
                  )}
                  <span style={{ flex: 1 }} />
                  <PfBtn variant="secondary" icon="clock" onClick={saveDraft}>Save and finish later</PfBtn>
                  {onReview
                    ? <PfBtn variant="primary" icon="paperplane" onClick={submit}>Submit {questions.length} answers</PfBtn>
                    : <PfBtn variant="primary" icon="arrowright" onClick={() => setStep(step + 1)}>{step === questions.length - 1 ? "Review" : "Next"}</PfBtn>}
                </div>
                <Foot icon="shield">
                  A draft is kept on this device only. Saving does not tell anyone you started, and an unfinished survey is
                  indistinguishable from one you never opened.
                </Foot>
              </PfCard>

              {/* ------------------------------- the rail -------------------------- */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PfCard>
                  <PfCardHead title="Your questions" sub={`${answeredCount} answered · ${questions.length - answeredCount} left`} />
                  <div style={{ padding: "6px 0 8px" }}>
                    {questions.map((qq, i) => {
                      const a = answerOf(qq.id);
                      const on = i === step && !onReview;
                      return (
                        <RailRow
                          key={qq.id}
                          n={i + 1}
                          text={qq.text}
                          answered={a.trim().length > 0}
                          required={qq.required}
                          active={on}
                          onClick={() => setStep(i)}
                        />
                      );
                    })}
                    <RailRow n={questions.length + 1} text="Check it over and submit" answered={false} required active={onReview} onClick={() => setStep(questions.length)} />
                  </div>
                </PfCard>

                <PfCard>
                  <PfCardHead title="Who is asking" sub="And who is not" />
                  <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
                    <Note icon="user" tone="blue"><b>{def.owner}</b> owns this instrument. Your manager did not write these questions and does not receive your answers.</Note>
                    <Note icon="users" tone="grey"><b>{def.audience.label}</b> — {def.audience.estimated} people. {run.responded} have answered so far.</Note>
                    <Note icon="shield" tone="green">
                      No cut of this survey is taken by nationality or host community. Those are NCDMB reporting fields; they are
                      not a way to choose who gets asked, and they are not an input to anything on this page.
                    </Note>
                    <div style={{ paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                      <PfBtn small variant="secondary" icon="shield" full onClick={() => setTab("promise")}>See exactly who sees what</PfBtn>
                    </div>
                  </div>
                </PfCard>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =============================== PROMISE =============================== */}
      {tab === "promise" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="blue" icon="info">
            {AUDIT.reportable} of {AUDIT.total} slices in this round can be reported. {AUDIT.suppressed} cannot, and one of them is
            yours. The audit that proves no suppressed slice is carrying numbers behind a flag returns{" "}
            <b>{AUDIT.clean ? "clean" : `${AUDIT.leaks.length} leaks`}</b>.
          </PfBanner>

          {/* --------------------------- the answer path ---------------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="Where an answer goes" sub="Five steps. Your identity is dropped at the first one." />
              <div style={{ padding: "16px 20px" }}>
                <Step n={1} icon="chat" tone="green" state="done"
                  title="You answer"
                  sub="The answer is written to the pool. Your worker id is not written with it — this is the step everything else depends on." />
                <Step n={2} icon="file" tone="green" state="done"
                  title="A receipt is written separately"
                  sub={`Run ${runId}, worker ${ME.id}, responded — a date and a flag. It is why the reminders stop. It holds no answer field.`} />
                <Step n={3} icon="stack" tone="blue" state="next"
                  title="Answers are pooled and cut into slices"
                  sub="Org, department, site, worker type, team. Each slice knows how many people answered and nothing about which people." />
                <Step n={4} icon="shield" tone="purple" state="wait"
                  title={`Each slice is checked against ${MIN_REPORTING_N}`}
                  sub="Above the line it carries a result. Below it, it carries no result object at all — not hidden numbers, no numbers." />
                <Step n={5} icon="users" tone="grey" state="wait" last
                  title="What is left reaches a manager"
                  sub="A department score, a driver, an eNPS band. Never a name, never a small team, never your words unless a named person released them." />
              </div>
              <Foot icon="shield">
                Every sensitive read below is access-logged, and the log is on this page rather than in an admin console you cannot open.
              </Foot>
            </PfCard>

            {/* ------------------------ receipts vs answers ------------------- */}
            <PfCard>
              <PfCardHead title="Your receipts" sub="Everything the platform knows about you and these surveys, in full." />
              <div style={{ padding: "12px 20px 6px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 92px 82px", gap: 10, padding: "0 0 8px" }}>
                  <PfTh>Receipt</PfTh><PfTh>Run</PfTh><PfTh>Responded</PfTh><PfTh>Reminders</PfTh>
                </div>
                {MY_INVITES.map((i) => {
                  const r = surveyRun(i.runId);
                  const done = i.responded || Boolean(submitted[i.runId]);
                  return (
                    <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 92px 82px", gap: 10, alignItems: "center", padding: "10px 0", borderTop: "1px solid var(--pf-n50)" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--pf-n500)" }}>{i.id}</span>
                      <span style={{ fontSize: 12, color: "var(--pf-n900)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r?.name ?? i.runId}</span>
                      <span>
                        <PfBadge tone={done ? "green" : "grey"} dot>
                          {done ? (i.respondedOn ?? submitted[i.runId]?.at ?? "Yes") : "Not yet"}
                        </PfBadge>
                      </span>
                      <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>{i.remindersSent}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: "12px 20px 16px" }}>
                <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                  <SectionLabel>What is not in this table</SectionLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[
                      "Any answer, score, choice or comment you have ever given.",
                      "A key, id or timestamp precise enough to match a receipt to an answer in the pool.",
                      "Anything your manager can query. She can see her department's response rate; she cannot see this table.",
                    ].map((b) => (
                      <div key={b} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                        <Ic name="x" size={12} color="var(--pf-red-500)" weight={2.2} />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </PfCard>
          </div>

          {/* ---------------------------- who sees what ------------------------ */}
          <PfCard>
            <PfCardHead
              title="Who sees what"
              sub="Change the two things this actually depends on — the survey's mode, and how many of your six answered."
            >
              <PfTabs
                tabs={(Object.keys(ANONYMITY_LABEL) as AnonymityMode[]).map((m) => ANONYMITY_LABEL[m])}
                active={ANONYMITY_LABEL[mode]}
                onChange={(label) => {
                  const found = (Object.keys(ANONYMITY_LABEL) as AnonymityMode[]).find((m) => ANONYMITY_LABEL[m] === label);
                  if (found) setMode(found);
                }}
              />
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>How many of your {SQUAD_SIZE} answered</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[2, 3, 4, 5, 6].map((n) => {
                  const on = n === squadWhatIf;
                  return (
                    <button
                      key={n}
                      onClick={() => setSquadWhatIf(n)}
                      style={{
                        fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, width: 34, height: 30, borderRadius: 8, cursor: "pointer",
                        color: on ? "var(--pf-n0)" : "var(--pf-n500)",
                        background: on ? (canReport(n) ? "var(--pf-primary-500)" : "var(--pf-red-500)") : "var(--pf-n0)",
                        border: `1px solid ${on ? "transparent" : "var(--pf-n50)"}`,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <PfBadge tone={canReport(squadWhatIf) ? "green" : "red"} dot>
                {canReport(squadWhatIf) ? "At or above the line — the squad column opens" : "Under the line — the squad column stays shut"}
              </PfBadge>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                Actually {SQUAD_ANSWERED} of {SQUAD_SIZE} answered
              </span>
            </div>

            <div style={{ padding: "0 20px 8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr repeat(4, minmax(0,1fr))", gap: 10, padding: "12px 0 10px", borderBottom: "1px solid var(--pf-n50)" }}>
                <PfTh>Who</PfTh>
                <PfTh>Your name against an answer</PfTh>
                <PfTh>Your squad&rsquo;s score</PfTh>
                <PfTh>Engineering&rsquo;s score ({ENG_ANSWERED} answered)</PfTh>
                <PfTh>Your free text, in your words</PfTh>
              </div>
              {matrix.map((row) => (
                <div key={row.who} style={{ display: "grid", gridTemplateColumns: "1.5fr repeat(4, minmax(0,1fr))", gap: 10, alignItems: "start", padding: "12px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{row.who}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{row.role}</div>
                  </div>
                  {row.cells.map((c, i) => (
                    <div key={i}>
                      <PfBadge tone={c.tone} dot>{c.text}</PfBadge>
                      {c.note && <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>{c.note}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
              {CELL_LEGEND.map((l) => (
                <span key={l.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: TONE[l.tone].bg }} />
                  {l.label}
                </span>
              ))}
            </div>
            <Foot icon="warning">
              The mode switcher is not a setting you control &mdash; it is the difference between the three kinds of survey this
              company runs. The one open to you now is <b>{ANONYMITY_LABEL[def?.anonymity ?? "anonymous"]}</b>, and you were told
              which before the first question rather than after.
            </Foot>
          </PfCard>

          {/* --------------------------- slice explorer ------------------------ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead
                title={`Every slice of this round, and whether it reports`}
                sub={`${AUDIT.total} slices · ${AUDIT.suppressed} suppressed · threshold ${AUDIT.threshold}`}
              >
                <PfBadge tone={AUDIT.clean ? "green" : "red"} dot>{AUDIT.clean ? "Audit clean" : "Leaks found"}</PfBadge>
              </PfCardHead>
              <div style={{ maxHeight: 430, overflowY: "auto" }}>
                {sr31Slices.map((s) => (
                  <SliceRow key={s.id} s={s} active={s.id === sliceId} mine={s.id === "SL-10"} onClick={() => setSliceId(s.id)} />
                ))}
              </div>
              <Foot icon="info">
                Site cuts do not sum to the org total. Lagos and Abuja staff sit on no site, and a site&rsquo;s muster includes
                contractor headcount that is out of scope for this instrument entirely.
              </Foot>
            </PfCard>

            <PfCard>
              <PfCardHead
                title={activeSlice ? activeSlice.label : "Pick a slice"}
                sub={activeSlice ? `${activeSlice.kind} · ${activeSlice.responded} of ${activeSlice.invited} answered` : undefined}
              >
                {sliceId === "SL-10" && <PfBadge tone="yellow" dot>Your squad</PfBadge>}
              </PfCardHead>

              {report && report.reportable && (
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.6px", lineHeight: 1 }}>{report.result.overall.toFixed(1)}</span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>overall, on a 1&ndash;5 scale</span>
                    <span style={{ flex: 1 }} />
                    <PfBadge tone={deltaTone(report.result.delta)}>{report.result.delta > 0 ? "+" : ""}{report.result.delta.toFixed(1)} since Q2</PfBadge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginBottom: 8 }}>{report.result.favourable}% favourable across the instrument.</div>
                  {report.result.drivers.filter((dv) => dv.score > 0).map((dv) => (
                    <DriverBar key={dv.key} k={dv.key} score={dv.score} delta={dv.delta} favourable={dv.favourable} />
                  ))}
                  {report.result.enps && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>eNPS</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: "var(--pf-n900)" }}>{enpsScore(report.result.enps)}</span>
                      <PfBadge tone={enpsBand(enpsScore(report.result.enps)).tone} dot>{enpsBand(enpsScore(report.result.enps)).label}</PfBadge>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                        {report.result.enps.promoters}% promoters &minus; {report.result.enps.detractors}% detractors. Passives count in the base and nowhere else.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {report && !report.reportable && (
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "26px 20px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", marginBottom: 10 }}><PfTile icon="shield" tone="red" size={36} /></div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)" }}>Nothing is behind this panel</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.6, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
                      {report.reason}
                    </div>
                  </div>
                  {report.why && (
                    <div style={{ marginTop: 12 }}>
                      <SectionLabel>Why this one, specifically</SectionLabel>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>{report.why}</div>
                    </div>
                  )}
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <Note icon="shield" tone="green">
                      The slice carries no result object. This is not a number hidden behind a flag &mdash; there is no number to
                      inspect, export or accidentally read past a boolean in a future version of this screen.
                    </Note>
                    {sliceId === "SL-10" && REFUSAL && (
                      <Note icon="warning" tone="red">
                        <b>{REFUSAL.at} · {REFUSAL.who}</b> — {REFUSAL.action}. Scope: {REFUSAL.scope}.
                      </Note>
                    )}
                  </div>
                </div>
              )}

              {!report && (
                <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n300)" }}>
                  Choose a slice on the left.
                </div>
              )}
            </PfCard>
          </div>

          {/* ------------------------------ free text -------------------------- */}
          <PfCard>
            <PfCardHead
              title="What happens to the words"
              sub={`${COMMENTS.released} released · ${COMMENTS.held} held · ${COMMENTS.pending} not yet reviewed. Held means the page never receives the text.`}
            />
            <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <SectionLabel>Released — cleared by a named reviewer</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {releasedThisCycle.map((c) => <CommentCard key={c.id} c={c} />)}
                </div>
              </div>
              <div>
                <SectionLabel>Held — and the reason, which is the point</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {heldThisCycle.map((c) => <CommentCard key={c.id} c={c} />)}
                </div>
              </div>
            </div>
            <Foot icon="warning">
              One of the held comments came from your own squad and was held on the count alone &mdash; its content is unremarkable
              and it still cannot be released, because a comment from a slice of {SQUAD_SIZE} identifies whoever wrote it.
            </Foot>
          </PfCard>

          {/* ------------------------------ access log ------------------------- */}
          <PfCard>
            <PfCardHead title="Who read this data, and when" sub="Survey slices and unreleased comments are sensitive reads. Every one is logged.">
              <PfBtn small variant="secondary" icon={logOpen ? "caretdown" : "caretright"} onClick={() => setLogOpen((v) => !v)}>
                {logOpen ? "Hide" : `Show ${SURVEY_ACCESS_LOG.length}`}
              </PfBtn>
            </PfCardHead>
            {logOpen && (
              <div style={{ padding: "6px 20px 12px" }}>
                {SURVEY_ACCESS_LOG.map((a) => {
                  const refused = a.action.includes("refused");
                  return (
                    <div key={`${a.at}${a.action}`} style={{ display: "grid", gridTemplateColumns: "126px 1.1fr 1.4fr 1.1fr", gap: 10, alignItems: "center", padding: "11px 0", borderTop: "1px solid var(--pf-n50)" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n400)" }}>{a.at}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{a.who}</span>
                      <span style={{ fontSize: 12, color: refused ? "var(--pf-red-500)" : "var(--pf-n600)", fontWeight: refused ? 600 : 400 }}>{a.action}</span>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{a.scope}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <Foot icon="shield">
              The row in red is the one worth reading twice. The platform did not warn her, or ask People Ops to approve it &mdash;
              it refused, and wrote down that it refused.
            </Foot>
          </PfCard>

          {/* --------------------------- AI on this data ----------------------- */}
          <PfCard>
            <PfCardHead title="Where a model touches any of this" sub={`${ENGAGE_AI_SURFACES.length} surfaces in this module, both registered, both with a human gate.`}>
              <PfBtn small variant="secondary" icon="shield" onClick={() => go("trust")}>Trust center</PfBtn>
            </PfCardHead>
            <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {ENGAGE_AI_SURFACES.map((s) => {
                const card = ENGAGE_MODEL_CARDS.find((m) => m.id === s.modelCard);
                return (
                  <div key={s.id} style={{ border: "1px solid var(--pf-purple-100)", background: "var(--pf-purple-50)", borderRadius: 11, padding: "13px 15px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <Ic name="robot" size={15} color="var(--pf-purple-500)" />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{s.surface}</span>
                      <PfBadge tone="purple">{s.modelCard}{card ? ` · ${card.name}` : ""}</PfBadge>
                      <PfBadge tone={s.covered ? "green" : "red"} dot>{s.covered ? "Explained" : "Uncovered"}</PfBadge>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>{s.output}</div>
                    {card && (
                      <div style={{ marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--pf-purple-100)", display: "flex", flexDirection: "column", gap: 6 }}>
                        <Note icon="arrowright" tone="purple"><b>Reads:</b> {card.inputs}</Note>
                        <Note icon="user" tone="purple"><b>Human gate:</b> {card.humanGate}</Note>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Foot icon="info">
              Neither of them reads a Likert answer, a receipt or a held comment. The re-identification check under the free-text
              box on the first tab is not on this list because it is not a model &mdash; it is four string rules running in your browser.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ================================= LOOP ================================ */}
      {tab === "loop" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="yellow" icon="warning">
            You answered the Q2 pulse on {MY_LAST?.respondedOn ?? "May 21"}. Since then workload fell in both cuts that contain you
            &mdash; the org from 3.5 to 3.1, Engineering from 3.1 to 2.4. Four things happened as a result and one of them is that
            nothing happened to workload.
          </PfBanner>

          {/* --------------------------- Q2 → Q3 comparison -------------------- */}
          <PfCard>
            <PfCardHead
              title="What the numbers did between your last answer and now"
              sub="Q2 figures are derived: each Q3 score less the delta the round published. Both cuts are above the reporting threshold."
            >
              <PfTabs
                tabs={["Unrealabs — all", "Engineering"]}
                active={compareId === "SL-01" ? "Unrealabs — all" : "Engineering"}
                onChange={(t) => setCompareId(t === "Engineering" ? "SL-02" : "SL-01")}
              />
            </PfCardHead>

            {compareReport && compareReport.reportable && compareSlice && (
              <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 300px", gap: 20 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Q2 overall</span>
                    <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n400)" }}>{priorOf(compareReport.result.overall, compareReport.result.delta).toFixed(1)}</span>
                    <Ic name="arrowright" size={15} color="var(--pf-n300)" />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Q3 overall</span>
                    <span style={{ fontSize: 28, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{compareReport.result.overall.toFixed(1)}</span>
                    <PfBadge tone={deltaTone(compareReport.result.delta)}>{compareReport.result.delta > 0 ? "+" : ""}{compareReport.result.delta.toFixed(1)}</PfBadge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginBottom: 6 }}>
                    {compareSlice.responded} of {compareSlice.invited} answered this round · {compareReport.result.favourable}% favourable.
                  </div>
                  {compareReport.result.drivers.filter((dv) => dv.score > 0).map((dv) => (
                    <DriverBar key={dv.key} k={dv.key} score={dv.score} delta={dv.delta} favourable={dv.favourable} prior={priorOf(dv.score, dv.delta)} />
                  ))}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                    <SectionLabel>The round you answered</SectionLabel>
                    {[
                      ["Run", "SR-28 · Engagement Pulse Q2"],
                      ["Answered", MY_LAST?.respondedOn ?? "May 21"],
                      ["Response rate", `${RATE_Q2}% — ${RUN_Q2?.responded ?? 231} of ${RUN_Q2?.invited ?? 324}`],
                      ["This round", `${RATE_Q3}% so far — ${RUN_Q3?.responded ?? 198} of ${RUN_Q3?.invited ?? 331}`],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--pf-n50)" }}>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 100, flex: "none" }}>{k}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <Note icon="info" tone="grey">
                    Q2&rsquo;s own free text is not shown here. The comments below belong to the round that is open now &mdash; the
                    ones from May were reviewed, actioned and are held under that cycle&rsquo;s retention rule, not surfaced back to you.
                  </Note>
                  <Note icon="shield" tone="green">
                    Both cuts on this card clear the threshold: {ORG_SLICE?.responded ?? 198} and {ENG_SLICE?.responded ?? 52} responses.
                    Your squad is not offered as an option here, because it could not be rendered if it were.
                  </Note>
                </div>
              </div>
            )}
            <Foot icon="warning">
              A delta is not a diagnosis. Q3 is measured against a round with a higher response rate ({RATE_Q2}% then, {RATE_Q3}% so far),
              and who answers changes what the mean says. The comparison is honest about that rather than quiet about it.
            </Foot>
          </PfCard>

          {/* ------------------------------ the actions ------------------------ */}
          <PfCard>
            <PfCardHead
              title="What actually happened after the last round"
              sub="Five items. Each one names the record it was read from — including the one where the answer is that nothing moved."
            >
              <div style={{ display: "flex", gap: 4 }}>
                {ACTION_STATES.map((s) => {
                  const n = s === "All" ? ROUND_ACTIONS.length : ROUND_ACTIONS.filter((a) => a.state === s).length;
                  const on = s === actionFilter;
                  return (
                    <button
                      key={s}
                      onClick={() => setActionFilter(s)}
                      style={{
                        fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer",
                        color: on ? "var(--pf-n900)" : "var(--pf-n400)",
                        background: on ? "var(--pf-n0)" : "transparent",
                        border: `1px solid ${on ? "var(--pf-n100)" : "transparent"}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s} <span style={{ color: "var(--pf-n300)" }}>{n}</span>
                    </button>
                  );
                })}
              </div>
            </PfCardHead>

            {visibleActions.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing in that state</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>
                  Which is worth knowing on its own. Clear the filter to see the other {ROUND_ACTIONS.length} items.
                </div>
              </div>
            ) : (
              <div>
                {visibleActions.map((a) => (
                  <ActionRow key={a.id} a={a} />
                ))}
              </div>
            )}
            <Foot icon="info">
              This list is derived. The product has no actions table for a survey round yet, so every row here points at the
              engage.ts record it was read out of &mdash; a run, an access-log entry, a set of review notes or a pair of published
              deltas. Nothing is on the list that a record does not support.
            </Foot>
          </PfCard>

          {/* ------------------------------- themes ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="The themes People Ops published"
              sub={`${COMMENT_THEMES.length} themes over ${COMMENT_THEMES.reduce((n, t) => n + t.n, 0)} released comments. The ${COMMENTS.held} held comments are not in here.`}
            >
              <PfBadge tone="purple" dot>MC-09</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {COMMENT_THEMES.map((t) => (
                <ThemeCard key={t.theme} t={t} open={openTheme === t.theme} onToggle={() => setOpenTheme(openTheme === t.theme ? null : t.theme)} />
              ))}
            </div>
            <Foot icon="warning">
              The theme totals do not add up to the comment total, and that gap is the honest part: four comments were held and one
              is still unreviewed, so five of the ten never reached the rollup at all.
            </Foot>
          </PfCard>

          {/* ------------------------------ what to do ------------------------- */}
          <PfCard>
            <PfCardHead title="Your part of it" sub="Two surveys are open to you and the workload question is on both." />
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 320, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                {ME_FIRST}, the targeted workload check exists because the last round said workload was falling in your department.
                It closes in {surveyRun("SR-30")?.daysLeft ?? 3} working days with {surveyRun("SR-30")?.responded ?? 39} of{" "}
                {surveyRun("SR-30")?.invited ?? 84} answers in. If the department cut lands under the threshold, nobody sees it at all
                &mdash; and the reason the last one was actionable is that 39 people had already answered.
              </div>
              <PfBtn variant="primary" icon="chat" onClick={() => { setRunId("SR-30"); setTab("take"); }}>Answer the workload check</PfBtn>
            </div>
            <Foot icon="shield">
              Nothing on this card knows whether you have answered SR-30. It reads your receipt, which says you have not, and the
              run&rsquo;s totals, which are counts. It cannot read a single answer, yours included.
            </Foot>
          </PfCard>
        </div>
      )}
    </div>
  );
}

/* ============================== leaf components ============================= */

function AnchorBtn({ anchor, n, on, onClick }: { anchor: string; n: number; on: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        fontFamily: "inherit", cursor: "pointer", padding: "14px 10px", borderRadius: 11, textAlign: "center",
        background: on ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
        boxShadow: on ? "0 6px 16px -10px rgba(22,179,100,.5)" : "0 0 0 0.5px rgba(42,42,42,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <span style={{
          width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11.5, fontWeight: 700,
          background: on ? "var(--pf-primary-500)" : "var(--pf-n50)",
          color: on ? "var(--pf-n0)" : "var(--pf-n400)",
        }}>{n}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? "var(--pf-primary-600)" : "var(--pf-n600)", lineHeight: 1.35 }}>{anchor}</div>
    </button>
  );
}

function ChoiceBtn({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", fontFamily: "inherit",
        cursor: "pointer", padding: "13px 15px", borderRadius: 11,
        background: on ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
      }}
    >
      <span style={{
        width: 17, height: 17, borderRadius: "50%", flex: "none",
        border: `1.5px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        {on && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pf-primary-500)" }} />}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, color: "var(--pf-n900)" }}>{label}</span>
    </button>
  );
}

function RailRow({ n, text, answered, required, active, onClick }: {
  n: number; text: string; answered: boolean; required: boolean; active: boolean; onClick: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "flex", gap: 10, alignItems: "flex-start", width: "100%", textAlign: "left", fontFamily: "inherit",
        cursor: "pointer", padding: "9px 20px", border: "none",
        background: active ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent",
        borderLeft: `2px solid ${active ? "var(--pf-n900)" : "transparent"}`,
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: "50%", flex: "none", marginTop: 1,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: answered ? "var(--pf-primary-500)" : "var(--pf-n50)",
        color: answered ? "var(--pf-n0)" : "var(--pf-n400)", fontSize: 10, fontWeight: 700,
      }}>
        {answered ? <Ic name="check" size={11} color="var(--pf-n0)" weight={2.6} /> : n}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12, fontWeight: active ? 600 : 500, color: active ? "var(--pf-n900)" : "var(--pf-n500)", lineHeight: 1.45 }}>
          {text.length > 62 ? `${text.slice(0, 62)}…` : text}
        </span>
        {!answered && !required && <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>optional</span>}
      </span>
    </button>
  );
}

function ActionRow({ a }: { a: RoundAction }) {
  const { hovered, hoverProps } = useHover();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "grid", gridTemplateColumns: "30px 1fr 118px 26px", gap: 12, alignItems: "flex-start",
          padding: "14px 20px", cursor: "pointer",
          background: open || hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        }}
      >
        <PfTile
          icon={a.state === "Done" ? "check" : a.state === "In flight" ? "clock" : "warning"}
          tone={ACTION_TONE[a.state]}
          size={28}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{a.title}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 3, lineHeight: 1.55 }}>{a.detail}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
            <PfBadge tone="grey">{a.when}</PfBadge>
            <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{a.owner}</span>
          </div>
        </div>
        <span style={{ paddingTop: 2 }}><PfBadge tone={ACTION_TONE[a.state]} dot>{a.state}</PfBadge></span>
        <span style={{ display: "inline-flex", justifyContent: "flex-end", paddingTop: 4 }}>
          <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
        </span>
      </div>
      {open && (
        <div style={{ padding: "0 20px 16px 62px", background: "var(--pf-n25)" }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
            <SectionLabel>Read from</SectionLabel>
            <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>{a.source}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeCard({ t, open, onToggle }: { t: CommentTheme; open: boolean; onToggle: () => void }) {
  const meta = driverMeta(t.driver);
  const why: WhyThis = themeWhy(t);
  const sources = t.fromComments
    .map((id) => [...releasedComments("SR-31"), ...releasedComments("SR-30")].find((c) => c.id === id))
    .filter((c): c is SurveyComment => Boolean(c));
  return (
    <AiBlock
      label={t.theme}
      chip={`${t.n} ${t.n === 1 ? "comment" : "comments"} · ${meta.name}`}
      why={<WhyThisPanel why={why} />}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <PfBadge tone={t.tone} dot>{t.tone === "red" ? "Falling" : t.tone === "yellow" ? "Watch" : "Holding"}</PfBadge>
        <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1, minWidth: 200 }}>
          Built from {t.fromComments.join(", ")} — every source comment is readable in full.
        </span>
        <PfBtn small variant="secondary" icon={open ? "caretdown" : "caretright"} onClick={onToggle}>
          {open ? "Hide the comments" : "Read the comments it came from"}
        </PfBtn>
      </div>
      {open && (
        <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 10 }}>
          {sources.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>
              None of the source comments are readable from this page — which would itself be a defect, since a theme must be
              traceable to text a human released.
            </div>
          ) : sources.map((c) => <CommentCard key={c.id} c={c} />)}
        </div>
      )}
    </AiBlock>
  );
}
