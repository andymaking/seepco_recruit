"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useMe } from "@/state/me";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfSegments,
  PfAvatar, PfBanner, PfPageTabs, PfTh, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  MY_COMPETENCIES, MY_CYCLE, MY_NEXT_CYCLE, MY_REVIEW_ROW, MY_REVIEW_RELEASE,
  MY_REVIEW_HISTORY, MY_VISIBILITY, MY_EXPLANATION, MY_MANAGER, MY_RETENTION_NOTE,
} from "@/data/me";

/**
 * My review — the subject's side of the review cycle (Me pillar, /my-review).
 *
 * ReviewCycles.tsx renders the same cycle from the employer's side: a six-row
 * team table, five colleagues' AI packets, the calibration spread and a 67%
 * completion figure. None of that is hers to see, so none of it is here.
 *
 * The page has exactly one job — the self-assessment — and exactly one gate:
 * MY_REVIEW_RELEASE.released is false, so her manager's narrative, the evidence
 * packet and the recommendation do not render. The branch is coded, not omitted:
 * flip the flag and the released view appears in the same card.
 */

/* ---------------------------------- types ---------------------------------- */

type LaneState = "done" | "in-progress" | "pending";

type Phase = {
  key: string; label: string; when: string; icon: string;
  state: "done" | "active" | "upcoming";
  who: string; what: string; youCan: string;
};

/* ---------------------------------- data ----------------------------------- */

/** The five phases of MY_CYCLE, from the subject's side. Two run in parallel:
 *  her window is still open while her manager writes theirs. */
const PHASES: Phase[] = [
  {
    key: "self", label: "Your self-assessment", when: `Open until ${MY_CYCLE.closes}`,
    icon: "clipboard", state: "active", who: "You",
    what: "You score the five competencies against their written anchors and write the narrative your manager reads next to them.",
    youCan: "Score, revise and submit. Nothing is final until the window closes — you can change any answer until then.",
  },
  {
    key: "peer", label: "Peer input", when: "Complete", icon: "users", state: "done",
    who: "The people you and your manager named",
    what: "Structured input on craft and collaboration, collected once per cycle. Named, never anonymous.",
    youCan: "Nothing to submit. Anything written about you lands on your feedback page — there is no separate silo.",
  },
  {
    key: "manager", label: "Manager review", when: "In progress", icon: "user", state: "active",
    who: MY_MANAGER.name,
    what: "Your manager scores the same five competencies against the same anchors you used — one scale, not two.",
    youCan: "Nothing to submit here. What they write reaches you after calibration, not before.",
  },
  {
    key: "calibration", label: "Calibration", when: "Jul 15", icon: "gauge", state: "upcoming",
    who: "Your manager and HR",
    what: "Ratings are levelled so the same score means the same thing across the group.",
    youCan: "Nothing to submit. Afterwards you can ask what your packet was assembled from, and a person answers.",
  },
  {
    key: "release", label: "Released to you", when: `After ${MY_REVIEW_RELEASE.sharedAfter}`,
    icon: "shield", state: "upcoming", who: "You",
    what: "Your manager's write-up, the evidence packet behind it and the recommendation open on this page.",
    youCan: "Read it, then bring what you disagree with to your next 1-on-1.",
  },
];

/** Furthest phase still in flight — drives the tab's count chip. */
const PHASE_NOW = PHASES.map((p) => p.state).lastIndexOf("active");

const PHASE_TONE: Record<Phase["state"], PfTone> = { done: "green", active: "blue", upcoming: "grey" };

/** The recorded state of the cycle, as the company holds it — shown honestly. */
const LANES: { key: string; label: string; state: LaneState; icon: string; who: string; init?: string; tone?: string }[] = [
  { key: "self", label: "Your self-assessment", state: MY_REVIEW_ROW.self, icon: "clipboard", who: "You" },
  { key: "peer", label: "Peer input", state: MY_REVIEW_ROW.peer ?? "pending", icon: "users", who: "Named, never anonymous" },
  { key: "manager", label: "Your manager's review", state: MY_REVIEW_ROW.manager, icon: "user", who: MY_MANAGER.name, init: MY_MANAGER.init, tone: MY_MANAGER.tone },
];

const LANE_LABEL: Record<LaneState, string> = { done: "Complete", "in-progress": "In progress", pending: "Not started" };
const LANE_TONE: Record<LaneState, PfTone> = { done: "green", "in-progress": "yellow", pending: "grey" };

/** Narrative starters — each one appends a heading, it never writes her words for her. */
const PROMPTS: { label: string; line: string }[] = [
  { label: "What went well", line: "What went well:" },
  { label: "What was hard", line: "What was hard:" },
  { label: "Evidence to weigh", line: "Evidence to weigh:" },
  { label: "What you want next", line: "What I want next:" },
];

/** The four MY_VISIBILITY rows that decide what a review can and cannot show. */
const VIS_PICKS: { item: string; you: string }[] = [
  { item: "Your review scores and recommendation", you: "After release" },
  { item: "Your goals and check-in progress", you: "Always" },
  { item: "Feedback others give about you", you: "Always" },
  { item: "Your skills baseline", you: "Always" },
];

type VisRow = (typeof MY_VISIBILITY)[number];

const REVIEW_VIS = VIS_PICKS
  .map((p) => ({ ...p, row: MY_VISIBILITY.find((v) => v.item === p.item) }))
  .filter((p): p is { item: string; you: string; row: VisRow } => p.row !== undefined);

const SEE_LABEL: Record<VisRow["manager"], string> = { sees: "Sees it", "sees-summary": "Summary only", no: "Cannot see it" };
/** Read from her side: private is the good outcome, so "no" is the green one. */
const SEE_TONE: Record<VisRow["manager"], PfTone> = { sees: "yellow", "sees-summary": "blue", no: "green" };

const EXPLAIN_WHAT = `How your ${MY_CYCLE.name} packet is assembled`;

const ratingOf = (rating: string) => parseFloat(rating) || 0;

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, lineHeight: 1.6, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 10,
  padding: "11px 13px", outline: "none", width: "100%", resize: "vertical",
} as const;

const linkStyle = {
  display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "inherit",
  fontSize: 12, fontWeight: 500, color: "var(--pf-n500)", background: "none",
  border: "none", padding: 0, cursor: "pointer",
} as const;

/* ------------------------------ competency row ------------------------------ */

function CompetencyRow({ c, score, onScore, last }: {
  c: { name: string; anchors: string[] }; score: number; onScore: (n: number) => void; last: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { hovered, hoverProps } = useHover();
  const scored = score > 0;
  return (
    <div
      {...hoverProps}
      style={{ padding: "14px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <PfTile icon={scored ? "check" : "star"} tone={scored ? "green" : "yellow"} size={30} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.name}</div>
          <div style={{ fontSize: 12, color: scored ? "var(--pf-n400)" : "var(--pf-yellow-500)", marginTop: 2 }}>
            {scored ? `You scored this ${score} of 5` : "Not scored — this one is holding up your submission"}
          </div>
        </div>
        <PfSegments score={score} tone={scored ? "green" : "grey"} />
        <PfBadge tone={scored ? "green" : "yellow"} dot={!scored}>{scored ? `${score}/5` : "Unscored"}</PfBadge>
      </div>

      {/* the 1–5 scale — hover a level for its anchor, click to score */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = score === n;
          return (
            <button
              key={n}
              onClick={() => onScore(n)}
              title={c.anchors[n - 1]}
              style={{
                fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, minWidth: 40,
                padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                border: `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
                background: on ? "var(--pf-primary-500)" : "var(--pf-n0)",
                color: on ? "#fff" : "var(--pf-n500)",
                boxShadow: on ? "0 6px 12px -6px rgba(22,179,100,.5)" : "0 0 0 0.5px rgba(42,42,42,.08)",
                transition: "background .12s ease, color .12s ease, border-color .12s ease",
              }}
            >
              {n}
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <button onClick={() => setOpen(!open)} style={linkStyle}>
          {open ? "Hide the scale" : "Show all five anchors"}
          <Ic name={open ? "caretdown" : "caretright"} size={12} color="var(--pf-n300)" />
        </button>
      </div>

      {/* what the chosen number actually means */}
      <div
        style={{
          display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10, padding: "9px 12px", borderRadius: 9,
          background: scored ? "var(--pf-primary-50)" : "var(--pf-n25)",
          border: `1px solid ${scored ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
        }}
      >
        <Ic name={scored ? "check" : "info"} size={14} color={scored ? "var(--pf-primary-500)" : "var(--pf-n300)"} />
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: scored ? "var(--pf-primary-600)" : "var(--pf-n500)" }}>
          {scored ? (
            <>
              <span style={{ fontWeight: 700 }}>{score} of 5</span> — &ldquo;{c.anchors[score - 1]}&rdquo;
            </>
          ) : (
            <>Pick a level. Every number carries a written anchor, so your 4 and your manager&rsquo;s 4 mean the same thing.</>
          )}
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 8, border: "1px solid var(--pf-n50)", borderRadius: 9, overflow: "hidden" }}>
          {c.anchors.map((a, i) => {
            const n = i + 1;
            const on = score === n;
            return (
              <button
                key={a}
                onClick={() => onScore(n)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  fontFamily: "inherit", padding: "8px 12px", cursor: "pointer", border: "none",
                  borderTop: i ? "1px solid var(--pf-n50)" : "none",
                  background: on ? "var(--pf-primary-50)" : "var(--pf-n0)",
                }}
              >
                <span
                  style={{
                    width: 20, height: 20, borderRadius: 6, flex: "none", display: "inline-flex",
                    alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                    color: on ? "#fff" : "var(--pf-n500)", background: on ? "var(--pf-primary-500)" : "var(--pf-n50)",
                  }}
                >
                  {n}
                </span>
                <span style={{ fontSize: 12.5, color: on ? "var(--pf-n900)" : "var(--pf-n500)", fontWeight: on ? 600 : 400 }}>{a}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- lane summary ------------------------------- */

function LaneCard({ lane, note }: { lane: (typeof LANES)[number]; note: string }) {
  return (
    <PfCard pad={14}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfTile icon={lane.icon} tone={LANE_TONE[lane.state]} size={28} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{lane.label}</span>
        <PfBadge tone={LANE_TONE[lane.state]} dot>{LANE_LABEL[lane.state]}</PfBadge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        {lane.init && <PfAvatar init={lane.init} tone={lane.tone} size={18} />}
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{lane.who}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 8, lineHeight: 1.5 }}>{note}</div>
    </PfCard>
  );
}

/* -------------------------------- the gate --------------------------------- */

/**
 * THE GATE. `released` is false today, so the locked branch renders. The
 * released branch below is live code, not a comment: flipping
 * MY_REVIEW_RELEASE.released to true swaps this card over.
 */
function ManagerSide({ requested, onExplain }: { requested: boolean; onExplain: () => void }) {
  const go = useGo();
  const toast = useToast();
  const released = MY_REVIEW_RELEASE.released;

  return (
    <PfCard>
      <PfCardHead
        title="Your manager's side"
        sub={released ? `Released to you — ${MY_CYCLE.name}` : `Sealed until ${MY_REVIEW_RELEASE.sharedAfter}`}
      >
        <PfBadge tone={released ? "green" : "grey"} dot>{released ? "Released" : "Not released yet"}</PfBadge>
      </PfCardHead>

      {released ? (
        /* ---- released view (not reachable while the flag is false) ---- */
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={30} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_MANAGER.name}</div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{MY_MANAGER.role} · scored against the same five anchors you used</div>
            </div>
            {MY_REVIEW_ROW.recommendation && <PfBadge tone="green">{MY_REVIEW_ROW.recommendation}</PfBadge>}
            <PfBadge tone="blue">Goal attainment {MY_REVIEW_ROW.goalAttainment}%</PfBadge>
          </div>
          <PfBtn variant="secondary" icon="file" onClick={() => toast(`Opening your ${MY_CYCLE.name} packet — written narrative and the evidence behind it`)}>
            Read the write-up and its evidence
          </PfBtn>
        </div>
      ) : (
        /* ---- locked view ---- */
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ border: "1px dashed var(--pf-n100)", background: "var(--pf-n25)", borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ic name="shield" size={15} color="var(--pf-n300)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n500)" }}>
                Their write-up, the evidence packet and the recommendation open here after {MY_REVIEW_RELEASE.sharedAfter}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[92, 78, 55].map((w) => (
                <span key={w} style={{ height: 9, width: `${w}%`, borderRadius: 5, background: "var(--pf-n100)" }} />
              ))}
            </div>
          </div>

          {[
            { icon: "clipboard", tone: "blue" as PfTone, title: "What is being written now", body: `${MY_MANAGER.name} is scoring the same five competencies against the same anchors you are using. There is no second, hidden scale.` },
            { icon: "clock", tone: "yellow" as PfTone, title: "When it reaches you", body: `After ${MY_REVIEW_RELEASE.sharedAfter}. Nothing is released to you before then — not the narrative, not the packet, not the recommendation.` },
            { icon: "gauge", tone: "purple" as PfTone, title: "Why the wait", body: "Calibration levels ratings first. Showing you a rating that then moves would be worse than showing you nothing yet." },
          ].map((r) => (
            <div key={r.title} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <PfTile icon={r.icon} tone={r.tone} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{r.body}</div>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 2 }}>
            <PfBtn variant="secondary" icon="question" onClick={onExplain}>
              {requested ? "Explanation requested" : "Ask what your packet is assembled from"}
            </PfBtn>
            <PfBtn variant="ghost" icon="shield" onClick={() => go("myprivacy")}>Who sees your review</PfBtn>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>A person answers within {MY_EXPLANATION.slaDays} days, not a model.</span>
          </div>
        </div>
      )}
    </PfCard>
  );
}

/* -------------------------------- stepper ---------------------------------- */

function PhaseStepper({ sel, onSelect }: { sel: string; onSelect: (k: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {PHASES.map((p, i) => {
        const done = p.state === "done";
        const active = p.state === "active";
        const isSel = p.key === sel;
        const lineAfter = PHASES[i].state === "done" ? TONE.green.bg : "var(--pf-n100)";
        const lineBefore = i > 0 && PHASES[i - 1].state === "done" ? TONE.green.bg : "var(--pf-n100)";
        return (
          <button
            key={p.key}
            onClick={() => onSelect(p.key)}
            style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ flex: 1, height: 2, background: i === 0 ? "transparent" : lineBefore }} />
              <span
                style={{
                  width: 30, height: 30, borderRadius: "50%", flex: "none", display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                  background: done ? "var(--pf-primary-500)" : "var(--pf-n0)",
                  border: `2px solid ${done ? "var(--pf-primary-500)" : active ? "var(--pf-blue-500)" : "var(--pf-n100)"}`,
                  boxShadow: isSel ? "0 0 0 4px var(--pf-n50)" : "none",
                  transition: "box-shadow .12s ease",
                }}
              >
                {done ? (
                  <Ic name="check" size={14} color="#fff" weight={2.4} />
                ) : (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "var(--pf-blue-500)" : "var(--pf-n100)" }} />
                )}
              </span>
              <span style={{ flex: 1, height: 2, background: i === PHASES.length - 1 ? "transparent" : lineAfter }} />
            </div>
            <div style={{ padding: "9px 6px 0", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: isSel ? 600 : 500, color: isSel ? "var(--pf-n900)" : "var(--pf-n500)", lineHeight: 1.3 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 3, lineHeight: 1.3 }}>{p.when}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------- visibility comparison -------------------------- */

function VisibilityStrip() {
  const go = useGo();
  return (
    <PfCard>
      <PfCardHead
        title="What you see, and what they see"
        sub="The four transparency rows that govern a review cycle — quoted from the same matrix HR holds."
      >
        <PfBadge tone="grey">4 of {MY_VISIBILITY.length} rows</PfBadge>
      </PfCardHead>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 108px 122px 122px", gap: 10, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTh>What it is</PfTh>
        <PfTh>You</PfTh>
        <PfTh>Your manager</PfTh>
        <PfTh>HR</PfTh>
      </div>
      {REVIEW_VIS.map((v, i) => (
        <div
          key={v.item}
          style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 108px 122px 122px", gap: 10, padding: "12px 20px", alignItems: "start", borderBottom: i === REVIEW_VIS.length - 1 ? "none" : "1px solid var(--pf-n50)" }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{v.item}</div>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{v.row.why}</div>
            <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>Source · {v.row.source}</div>
          </div>
          <div><PfBadge tone={v.you === "Always" ? "green" : "yellow"}>{v.you}</PfBadge></div>
          <div><PfBadge tone={SEE_TONE[v.row.manager]}>{SEE_LABEL[v.row.manager]}</PfBadge></div>
          <div><PfBadge tone={SEE_TONE[v.row.hr]}>{SEE_LABEL[v.row.hr]}</PfBadge></div>
        </div>
      ))}
      <div style={{ padding: 14, borderTop: "1px solid var(--pf-n50)" }}>
        <PfBanner tone="green" icon="shield" cta="open" onCta={() => go("myprivacy")}>
          All {MY_VISIBILITY.length} rows — including the ones you will not enjoy reading — are on your Data &amp; privacy page.
        </PfBanner>
      </div>
    </PfCard>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function MyReview() {
  const go = useGo();
  const toast = useToast();
  const { selfScores, selfNarrative, scoreSelf, setNarrative, explanationRequests, requestExplanation } = useMe();

  const [tab, setTab] = useState("self");
  const [phase, setPhase] = useState("self");
  const [submitted, setSubmitted] = useState(false);

  const scores = MY_COMPETENCIES.map((_, i) => selfScores[i] ?? 0);
  const scoredCount = scores.filter((n) => n > 0).length;
  const unscored = MY_COMPETENCIES.length - scoredCount;
  const avg = scoredCount ? scores.reduce((a, b) => a + b, 0) / scoredCount : 0;
  const words = selfNarrative.trim() ? selfNarrative.trim().split(/\s+/).length : 0;

  const selPhase = PHASES.find((p) => p.key === phase) ?? PHASES[0];
  const selfPhaseOpen = PHASES[0].state === "active";
  const explained = explanationRequests.some((r) => r.what === EXPLAIN_WHAT);

  const score = (i: number, n: number) => {
    scoreSelf(i, n);
    setSubmitted(false);
    toast(`${MY_COMPETENCIES[i].name} scored ${n}/5 — “${MY_COMPETENCIES[i].anchors[n - 1]}”`, "success");
  };

  const addPrompt = (line: string) => {
    if (selfNarrative.includes(line)) {
      toast(`“${line}” is already in your narrative`);
      return;
    }
    setNarrative(selfNarrative.trim() ? `${selfNarrative.trim()}\n\n${line} ` : `${line} `);
    toast(`Starter added — “${line}” · the words stay yours`);
  };

  const submit = () => {
    if (!selfPhaseOpen) {
      toast(`The self-assessment window for ${MY_CYCLE.name} is closed — nothing to submit in this phase`, "danger");
      return;
    }
    if (unscored > 0) {
      toast(`Score all five competencies first — ${unscored} still unscored in ${MY_CYCLE.name}`, "danger");
      setTab("self");
      return;
    }
    if (!selfNarrative.trim()) {
      toast("Add a few lines of narrative — your manager reads it beside the scores", "danger");
      return;
    }
    setSubmitted(true);
    toast(`Self-assessment submitted — ${MY_CYCLE.name} · 5 of 5 scored, ${words} words`, "success");
  };

  const explain = () => {
    if (explained) {
      toast(`Already asked — a person answers by ${explanationRequests.find((r) => r.what === EXPLAIN_WHAT)?.dueBy ?? "the SLA date"}`);
      return;
    }
    requestExplanation(EXPLAIN_WHAT, MY_EXPLANATION.slaDays);
    toast(`Explanation requested — ${MY_EXPLANATION.slaDays}-day SLA, and the request itself is logged on your Data & privacy page`, "ai");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your review</span>
            <PfBadge tone="blue">{MY_CYCLE.name}</PfBadge>
            {unscored > 0 && <PfBadge tone="yellow" dot>{unscored} unscored</PfBadge>}
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Your side of the cycle — you score the same five competencies your manager scores, against the same written anchors. Their side opens to you after calibration.
          </div>
        </div>
        <PfBtn variant="secondary" icon="target" onClick={() => go("mygoals")}>Your goals</PfBtn>
        <PfBtn variant="secondary" icon="shield" onClick={() => go("myprivacy")}>Who sees this</PfBtn>
      </div>

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "self", label: "Self-assessment", count: `${scoredCount}/${MY_COMPETENCIES.length}` },
            { key: "cycle", label: "Cycle & timeline", count: `${PHASE_NOW + 1}/${PHASES.length}` },
            { key: "history", label: "Past reviews", count: String(MY_REVIEW_HISTORY.length) },
          ]}
        />
      </div>

      {/* ============================ SELF-ASSESSMENT ============================ */}
      {tab === "self" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            <PfStat
              icon="clipboard" tone={unscored ? "yellow" : "green"} label="Competencies scored"
              value={`${scoredCount}/${MY_COMPETENCIES.length}`} unit="by you"
              delta={unscored ? `${unscored} to go` : "Complete"} deltaTone={unscored ? "yellow" : "green"}
            />
            <PfStat
              icon="star" tone="blue" label="Your average so far" value={avg ? avg.toFixed(1) : "—"} unit="/ 5"
              delta={`${scoredCount} counted`} deltaTone="blue"
            />
            <PfStat
              icon="target" tone="purple" label="Your goal attainment" value={`${MY_REVIEW_ROW.goalAttainment}%`}
              unit="your 2 goals" delta="Due Sep 30" deltaTone="blue"
            />
            <PfStat
              icon="clock" tone="yellow" label="Your window closes" value={MY_CYCLE.closes}
              delta="Revisable" deltaTone="green"
            />
          </div>

          {unscored > 0 ? (
            <PfBanner tone="yellow" icon="warning">
              {unscored} of {MY_COMPETENCIES.length} competencies are still unscored — {MY_COMPETENCIES.filter((_, i) => scores[i] === 0).map((c) => c.name).join(" and ")}. You cannot submit until every one has a level.
            </PfBanner>
          ) : submitted ? (
            <PfBanner tone="green" icon="check">
              Submitted for {MY_CYCLE.name} — all five scored, {words} words of narrative. You can still revise until {MY_CYCLE.closes}.
            </PfBanner>
          ) : (
            <PfBanner tone="green" icon="check">
              All five competencies scored. Add your narrative and submit — the window stays open until {MY_CYCLE.closes}.
            </PfBanner>
          )}

          {/* Where the cycle actually stands */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            <LaneCard
              lane={LANES[0]}
              note={unscored > 0
                ? `Recorded as submitted — but your draft has ${unscored} unscored competenc${unscored === 1 ? "y" : "ies"}. Revise and resubmit before ${MY_CYCLE.closes}.`
                : `All ${MY_COMPETENCIES.length} competencies scored against their anchors.`}
            />
            <LaneCard lane={LANES[1]} note="Collected once, from the people you and your manager named. Anything written about you is on your feedback page." />
            <LaneCard lane={LANES[2]} note={`Being written now. It reaches you after ${MY_REVIEW_RELEASE.sharedAfter} — not before.`} />
          </div>

          {/* The scorer */}
          <PfCard>
            <PfCardHead
              title="Score yourself against the anchors"
              sub="Five competencies, 1–5. Every level has written wording — hover a number or open the scale to read it."
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 190 }}>
                <div style={{ flex: 1 }}><PfProgress pct={(scoredCount / MY_COMPETENCIES.length) * 100} tone={unscored ? "yellow" : "green"} height={6} /></div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n600)", whiteSpace: "nowrap" }}>{scoredCount} of {MY_COMPETENCIES.length}</span>
              </div>
            </PfCardHead>
            {MY_COMPETENCIES.map((c, i) => (
              <CompetencyRow key={c.name} c={c} score={scores[i]} onScore={(n) => score(i, n)} last={i === MY_COMPETENCIES.length - 1} />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              The same 1–5 taxonomy as your hiring scorecard, your skills baseline and your growth plan — one scale, so nothing needs re-mapping.
            </div>
          </PfCard>

          {/* Narrative */}
          <PfCard>
            <PfCardHead title="Your narrative" sub="The part scores cannot carry. Your manager reads this next to their own notes.">
              <PfBadge tone={words ? "green" : "grey"}>{words} {words === 1 ? "word" : "words"}</PfBadge>
            </PfCardHead>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 11 }}>
                {PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => addPrompt(p.line)}
                    style={{
                      fontFamily: "inherit", fontSize: 12, fontWeight: 500, color: "var(--pf-n600)",
                      background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 999,
                      padding: "5px 11px", cursor: "pointer", boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)",
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}
                  >
                    <Ic name="plus" size={12} color="var(--pf-n300)" />
                    {p.label}
                  </button>
                ))}
              </div>
              <textarea
                value={selfNarrative}
                onChange={(e) => { setNarrative(e.target.value); setSubmitted(false); }}
                rows={7}
                placeholder="Write in your own words — what you shipped, what you learned, what you want weighed. Starters above add a heading, never a sentence."
                style={fieldStyle}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n400)" }}>
                  <Ic name="shield" size={13} color="var(--pf-n300)" />
                  Saved to your record as you type — nobody reads it until you submit.
                </span>
                <span style={{ flex: 1 }} />
                <PfBtn variant="secondary" icon="file" onClick={() => toast(`Draft saved — ${MY_CYCLE.name} self-assessment, ${scoredCount} of ${MY_COMPETENCIES.length} scored`)}>Save draft</PfBtn>
                <PfBtn variant="primary" icon="paperplane" onClick={submit}>
                  {submitted ? "Resubmit self-assessment" : "Submit self-assessment"}
                </PfBtn>
              </div>
            </div>
          </PfCard>

          {/* The gate */}
          <ManagerSide requested={explained} onExplain={explain} />
        </div>
      )}

      {/* ============================ CYCLE & TIMELINE =========================== */}
      {tab === "cycle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead
              title={MY_CYCLE.name}
              sub={`Your window closes ${MY_CYCLE.closes} · your manager's side is released after ${MY_REVIEW_RELEASE.sharedAfter}`}
            >
              <PfBadge tone="blue" dot>Phase {PHASE_NOW + 1} of {PHASES.length}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "22px 20px 20px" }}>
              <PhaseStepper sel={phase} onSelect={setPhase} />

              <div style={{ display: "flex", gap: 12, marginTop: 20, padding: 16, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10 }}>
                <PfTile icon={selPhase.icon} tone={PHASE_TONE[selPhase.state]} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{selPhase.label}</span>
                    <PfBadge tone={PHASE_TONE[selPhase.state]}>{selPhase.when}</PfBadge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.55 }}>{selPhase.what}</div>
                  <div style={{ display: "flex", gap: 22, marginTop: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 150 }}>
                      <PfTh>Who runs this phase</PfTh>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", marginTop: 3 }}>{selPhase.who}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <PfTh>Your move</PfTh>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.5 }}>{selPhase.youCan}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {selPhase.key === "self" && (
                      <PfBtn small variant="primary" icon="clipboard" onClick={() => setTab("self")}>Open your self-assessment</PfBtn>
                    )}
                    {selPhase.key === "peer" && (
                      <PfBtn small variant="secondary" icon="megaphone" onClick={() => go("myfeedback")}>See feedback about you</PfBtn>
                    )}
                    {selPhase.key === "manager" && (
                      <PfBtn small variant="secondary" icon="chat" onClick={() => go("myoneonones")}>Raise it in your 1-on-1</PfBtn>
                    )}
                    {selPhase.key === "calibration" && (
                      <PfBtn small variant="secondary" icon="question" onClick={explain}>
                        {explained ? "Explanation requested" : "Ask what your packet is assembled from"}
                      </PfBtn>
                    )}
                    {selPhase.key === "release" && (
                      <PfBtn small variant="secondary" icon="bell" onClick={() => toast(`You'll be nudged when your ${MY_CYCLE.name} review is released — after ${MY_REVIEW_RELEASE.sharedAfter}`, "success")}>
                        Nudge me when it opens
                      </PfBtn>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* Next cycle */}
          <PfCard>
            <PfCardHead title={MY_NEXT_CYCLE.name} sub="Far enough away to actually prepare for.">
              <PfBadge tone="grey">Not open yet</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {[
                { icon: "calendar", tone: "blue" as PfTone, label: "Your window", value: MY_NEXT_CYCLE.window, sub: "Self-assessment opens and closes inside it" },
                { icon: "clipboard", tone: "purple" as PfTone, label: "What you'll do", value: "The same five", sub: "Same competencies, same anchors, same 1–5 scale" },
                { icon: "target", tone: "green" as PfTone, label: "What carries in", value: "Your check-ins", sub: "Goal progress you log between now and then" },
              ].map((cell, i) => (
                <div key={cell.label} style={{ padding: "16px 20px", borderLeft: i ? "1px solid var(--pf-n50)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PfTile icon={cell.icon} tone={cell.tone} size={26} />
                    <PfTh>{cell.label}</PfTh>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", marginTop: 9 }}>{cell.value}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>{cell.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                Nothing to do yet. The strongest thing you can bring to it is a trail of check-ins rather than a memory of the quarter.
              </span>
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" icon="target" onClick={() => go("mygoals")}>Check in on a goal</PfBtn>
              <PfBtn small variant="secondary" icon="bell" onClick={() => toast(`Reminder set — ${MY_NEXT_CYCLE.name} opens ${MY_NEXT_CYCLE.window}`, "success")}>Remind me</PfBtn>
            </div>
          </PfCard>

          <VisibilityStrip />
        </div>
      )}

      {/* ============================== PAST REVIEWS ============================= */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead title="Your released reviews" sub="Cycles that finished calibration and were released to you. These are yours to keep.">
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`Your review record exported — ${MY_REVIEW_HISTORY.length} released cycles (PDF)`)}>Export</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 120px 140px", gap: 10, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Cycle</PfTh>
              <PfTh>Your rating</PfTh>
              <PfTh>Goal attainment</PfTh>
              <PfTh>Outcome</PfTh>
            </div>
            {MY_REVIEW_HISTORY.map((h) => (
              <HistoryRow key={h.cycle} h={h} />
            ))}
            {/* the cycle in flight — same table, honestly redacted */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 120px 140px", gap: 10, padding: "13px 20px", alignItems: "center", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n500)" }}>{MY_CYCLE.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 3 }}>In flight · your window closes {MY_CYCLE.closes}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <PfSegments score={0} tone="grey" />
                <span style={{ fontSize: 12.5, color: "var(--pf-n300)" }}>—</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n500)" }}>{MY_REVIEW_ROW.goalAttainment}%</div>
              <div><PfBadge tone="grey" dot>Sealed until Jul 15</PfBadge></div>
            </div>
          </PfCard>

          {/* Rating trajectory — released cycles only */}
          <PfCard>
            <PfCardHead title="Your rating over time" sub="Only released ratings appear here. The cycle in flight is a dashed placeholder until calibration lets it out." />
            <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[...MY_REVIEW_HISTORY].reverse().map((h) => {
                const r = ratingOf(h.rating);
                return (
                  <div key={h.cycle} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 150, flex: "none", fontSize: 12.5, color: "var(--pf-n500)" }}>{h.cycle}</span>
                    <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--pf-n50)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(r / 5) * 100}%`, borderRadius: 5, background: "var(--pf-primary-500)", transition: "width .3s ease" }} />
                    </div>
                    <span style={{ width: 52, flex: "none", textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>{h.rating}</span>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 150, flex: "none", fontSize: 12.5, color: "var(--pf-n300)" }}>{MY_CYCLE.name}</span>
                <div style={{ flex: 1, height: 10, borderRadius: 5, border: "1px dashed var(--pf-n100)", background: "var(--pf-n25)" }} />
                <span style={{ width: 52, flex: "none", textAlign: "right", fontSize: 13, fontWeight: 700, color: "var(--pf-n300)" }}>—</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              A rating is only ever a released rating. Anything mid-calibration can still move, so it is not shown to you as a number.
            </div>
          </PfCard>

          <PfBanner tone="grey" icon="file" cta="open" onCta={() => go("myprivacy")}>
            Your review records follow the retention rule on the rest of your record — {MY_RETENTION_NOTE.toLowerCase()}. Every request you make about your own record is audit-logged, and the log is yours to read.
          </PfBanner>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- history row -------------------------------- */

function HistoryRow({ h }: { h: (typeof MY_REVIEW_HISTORY)[number] }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const r = ratingOf(h.rating);
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`Opening your ${h.cycle} review — ${h.rating}, goal attainment ${h.attain}, outcome ${h.rec}`)}
      style={{
        display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 120px 140px", gap: 10,
        padding: "13px 20px", alignItems: "center", cursor: "pointer",
        borderBottom: "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{h.cycle}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 3 }}>Released to you · calibrated</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfSegments score={r} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)" }}>{h.rating}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{h.attain}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PfBadge tone={h.recTone}>{h.rec}</PfBadge>
        <Ic name="caretright" size={13} color="var(--pf-n300)" />
      </div>
    </div>
  );
}
