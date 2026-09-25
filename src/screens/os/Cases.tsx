"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  CASE_STAGES, DISCIPLINARY_CASES, caseAggregate,
  type CaseStage, type DisciplinaryCase,
} from "@/data/hrops";
import {
  ALL_WORKERS, personById, workerById, companyById, isSchedulable,
  WORKER_TYPE_LABEL,
} from "@/data/workforce";
import { SEED_ATTENDANCE_SIGNALS, activeAdapter } from "@/data/adapters";
import { MODEL_CARDS, AI_SURFACES, SECURITY_POSTURE, toneForState, type WhyThis } from "@/data/trust";
import { DEPARTMENTS } from "@/data/talentos";

/**
 * Queries & disciplinary cases — PRD v2.1 FR-088.
 *
 * The most sensitive surface the platform holds. Everything on this page is
 * built around one red line, and the line is drawn IN THE UI, not in a policy
 * document nobody opens:
 *
 *   · The AI DRAFTS and SUMMARISES. It never recommends a sanction. MC-06 has
 *     never been shown a sanction schedule — there is no field for it to fill.
 *   · The outcome and the sanction are authored by HR. They are rendered as
 *     human-authored artifacts, visually distinct from anything a model touched.
 *   · Access is restricted to HR and the concerned line of management, every
 *     open is logged, retention is stated per case, and a DPIA is a hard gate
 *     before GA on real employee data.
 *   · Only aggregated counts reach the attrition model. No narrative, no named
 *     subject, no sanction detail.
 *
 * Reads, not engines: nothing here decides anything. It records what people did.
 */

/* --------------------------------- helpers -------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const TODAY = "Aug 27, 2026";
const ACTOR = "People Ops · Funke Adebayo";

const MC06 = MODEL_CARDS.find((m) => m.id === "MC-06")!;
const MC07 = MODEL_CARDS.find((m) => m.id === "MC-07")!;
const AS11 = AI_SURFACES.find((s) => s.id === "AS-11")!;
const DPIA = SECURITY_POSTURE.find((p) => p.area === "DPIAs")!;
const LOGGING = SECURITY_POSTURE.find((p) => p.area === "Audit logging")!;
const ATT_ADAPTER = activeAdapter("attendance_source");
const AGG = caseAggregate();

const first = (n: string) => n.split(" ")[0];
const sIdx = (s: CaseStage) => CASE_STAGES.indexOf(s);

const fieldStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 10px", outline: "none", width: "100%",
};

/** Session stamps are derived from the log length so SSR and the client agree. */
const stampAt = (n: number) => {
  const mins = 20 + n * 7;
  return `Aug 27 · ${String(11 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};

/* ------------------------------ stage doctrine ----------------------------- */

type StageMeta = { icon: string; tone: PfTone; who: string; artifact: string; rule: string; clock: string };

const STAGE_META: Record<CaseStage, StageMeta> = {
  "Query issued": {
    icon: "file", tone: "yellow",
    who: "HR, on a line-manager report",
    artifact: "The query letter — dated facts, delivered in writing",
    rule: "States facts and asks for an explanation. It draws no conclusion and names no sanction.",
    clock: "Delivery starts the 48-hour clock",
  },
  "Response received": {
    icon: "chat", tone: "blue",
    who: "The employee, in writing",
    artifact: "The response, captured verbatim in-app",
    rule: "Captured unedited. A summary may sit beside the response; nothing is ever written over it.",
    clock: "Within 48 hours of receipt",
  },
  Panel: {
    icon: "users", tone: "purple",
    who: "Panel — HR and the concerned line of management, with the employee present",
    artifact: "Panel notes, typed by the panel secretary",
    rule: "The employee attends and hears the case. A panel the subject cannot attend is not a panel.",
    clock: "Convened after the response, or after the window lapses",
  },
  Outcome: {
    icon: "clipboard", tone: "green",
    who: "HR, on the panel's finding",
    artifact: "The outcome and, if any, the sanction",
    rule: "Typed by a person from the company's policy schedule. No model writes in this field.",
    clock: "Recorded with an effective date",
  },
  Closed: {
    icon: "check", tone: "grey",
    who: "HR",
    artifact: "The closed file and its retention clock",
    rule: "“No further action” closes a case exactly like any other outcome — and is logged with the same weight.",
    clock: "Retention runs from closure",
  },
};

/* ------------------------- what the draft was built on --------------------- */

/** FR-093 basis for the MC-06 draft — dated facts and a human-chosen category. */
const QUERY_FACTS: Record<string, string[]> = {
  "DC-14": [
    "Category “Attendance” — selected by People Ops, not inferred by the model",
    "No clock-in recorded on 5, 7 and 11 August 2026 (attendance_source v1 · CSV upload)",
    "No approved leave against those dates on the leave register",
    "Line-manager report filed by Ibrahim Sani, Field Operations",
  ],
  "DC-12": [
    "Category “Conduct” — selected by People Ops",
    "The dated incident report attached to the case by the reporting manager",
    "Nothing else. A query is written on its own facts.",
  ],
};

const NOT_INPUTS = [
  "Any other case, open or closed — a query is written on its own facts",
  "Performance ratings, engagement scores or leave-risk tiers",
  "Nationality and host community — NCDMB reporting fields, never model inputs",
  "The attendance signal's interpretation — the model sees dated clock events, not a conclusion",
  "Any sanction schedule. MC-06 has never been shown one, so it has no vocabulary to recommend from.",
];

/* ------------------------- summaries (never findings) ---------------------- */

const RESPONSE_SUMMARY: Record<string, { line: string; checks: string[] }> = {
  "DC-14": {
    line: "The response gives a transport cause — the crew boat did not run — and states a same-day verbal report to the materials controller. It neither admits nor disputes the three dates themselves.",
    checks: [
      "Crew-boat manifest for 5, 7 and 11 August (Bonny Terminal)",
      "Materials controller's call log — Grace Etim, Field Operations",
      "Whether other Bonny scaffolders recorded the same absence on those dates",
    ],
  },
  "DC-12": {
    line: "The response was provided in writing within the window, with supporting correspondence attached. It sets out a sequence of events and offers documents for each step.",
    checks: ["The attached correspondence, read in full by the panel", "Dates in the response against the dates in the report"],
  },
};

/* ----------------------------- outcome vocabulary -------------------------- */

type Relation = "staff" | "third-party";

/**
 * The company's policy schedule — a list HR chooses from, not a model's ranking.
 * Nothing is pre-selected, and “No further action” sits first on purpose.
 */
const OUTCOME_OPTIONS: Record<Relation, string[]> = {
  staff: ["No further action", "Counselling note on file", "Verbal caution", "Written warning", "Final written warning"],
  "third-party": ["No further action", "Site-access review", "Return to contracting company", "End assignment"],
};

const relationOf = (workerId: string): Relation => {
  const t = workerById(workerId)?.workerType;
  return t === "contractor" || t === "agency" ? "third-party" : "staff";
};

const managerFor = (c: DisciplinaryCase) => {
  const p = personById(c.workerId);
  return DEPARTMENTS.find((d) => d.name === p?.dept)?.head ?? "Ibrahim Sani";
};

const retentionUntil = (c: DisciplinaryCase) => {
  if (c.stage !== "Closed") return "Clock starts at closure";
  const year = Number((c.sanctionAt ?? c.opened).slice(-4)) + 6;
  return `Destroy after ${(c.sanctionAt ?? c.opened).slice(0, 3)} ${year}`;
};

/* --------------------------------- the lens -------------------------------- */

const LENSES = ["All access", "People Ops", "Line management"] as const;
type Lens = (typeof LENSES)[number];

const inLens = (who: string, lens: Lens) =>
  lens === "All access" ? true : lens === "People Ops" ? who.startsWith("People Ops") : !who.startsWith("People Ops");

/* =============================== small parts =============================== */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/** The one FR-093 affordance, rendered identically everywhere it appears. */
function WhyThisPanel({ why, extra }: { why: WhyThis; extra?: ReactNode }) {
  const go = useGo();
  const [open, setOpen] = useState(false);
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
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          {extra}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
            <button
              onClick={() => go("trust")}
              title="Model card index — Trust center"
              style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
            >
              <Ic name="robot" size={12} color="var(--pf-purple-500)" />
              Model card {why.modelCard} · {MC06.name}
            </button>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Human gate: {why.humanGate.toLowerCase()}.</span>
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

/** The counterweight: a human wrote this, and the page says so. */
function HumanBlock({ title, author, when, badge, children }: { title: string; author: string; when?: string; badge?: string; children: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", borderRadius: 11, padding: "13px 15px", borderLeft: "3px solid var(--pf-n900)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Ic name="user" size={15} color="var(--pf-n900)" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{title}</span>
        <PfBadge tone="grey">{badge ?? "Human-authored"}</PfBadge>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{author}{when ? ` · ${when}` : ""}</span>
      </div>
      {children}
    </div>
  );
}

/** The five stages, as an org-level pipeline that also filters the list. */
function Pipeline({ counts, filter, onPick }: { counts: Record<CaseStage, number>; filter: CaseStage | "all"; onPick: (s: CaseStage) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${CASE_STAGES.length}, minmax(0,1fr))` }}>
      {CASE_STAGES.map((s, i) => {
        const m = STAGE_META[s];
        const on = filter === s;
        const n = counts[s];
        return (
          <button
            key={s}
            onClick={() => onPick(s)}
            style={{
              fontFamily: "inherit", textAlign: "left", cursor: "pointer", position: "relative",
              background: on ? TONE[m.tone].soft : "var(--pf-n0)",
              border: "none", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)",
              padding: "14px 16px 15px", transition: "background .12s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <PfTile icon={m.icon} tone={m.tone} size={26} />
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: "var(--pf-n300)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: MONO, color: n ? TONE[m.tone].fg : "var(--pf-n300)", background: n ? TONE[m.tone].soft : "var(--pf-n50)", padding: "1px 8px", borderRadius: 999 }}>{n}</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 9 }}>{s}</div>
            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.45 }}>{m.who}</div>
            {i < CASE_STAGES.length - 1 && (
              <span style={{ position: "absolute", right: -6, top: 22, zIndex: 1, background: "var(--pf-n0)", borderRadius: "50%", display: "inline-flex" }}>
                <Ic name="caretright" size={12} color="var(--pf-n300)" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** This case's own position on the rail. */
function StageRail({ stage }: { stage: CaseStage }) {
  const at = sIdx(stage);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap" }}>
      {CASE_STAGES.map((s, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <span key={s} style={{ display: "inline-flex", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 999, background: now ? "var(--pf-n900)" : done ? "var(--pf-primary-50)" : "var(--pf-n50)", border: `1px solid ${now ? "var(--pf-n900)" : done ? "var(--pf-primary-100)" : "var(--pf-n50)"}` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: now ? "#fff" : done ? "var(--pf-primary-500)" : "var(--pf-n300)" }} />
              <span style={{ fontSize: 11.5, fontWeight: now ? 600 : 500, color: now ? "#fff" : done ? "var(--pf-primary-600)" : "var(--pf-n400)" }}>{s}</span>
            </span>
            {i < CASE_STAGES.length - 1 && <span style={{ width: 14, height: 1, background: done ? "var(--pf-primary-100)" : "var(--pf-n50)" }} />}
          </span>
        );
      })}
    </div>
  );
}

function CaseListRow({ c, on, onPick }: { c: DisciplinaryCase; on: boolean; onPick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const p = personById(c.workerId);
  const w = workerById(c.workerId);
  const m = STAGE_META[c.stage];
  return (
    <div
      {...hoverProps}
      onClick={onPick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", cursor: "pointer",
        borderTop: "1px solid var(--pf-n50)",
        background: on ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: on ? "inset 3px 0 0 var(--pf-n900)" : "none",
        transition: "background .12s ease",
      }}
    >
      <PfAvatar init={c.init} tone={c.tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.subject}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{c.id}</span>
          {w && <PfBadge tone="grey">{WORKER_TYPE_LABEL[w.workerType]}</PfBadge>}
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.role} · {p?.loc ?? "—"} · opened {c.opened}
        </div>
      </div>
      <div style={{ width: 92, flex: "none" }}>
        <PfBadge tone={c.category === "Attendance" ? "blue" : "purple"}>{c.category}</PfBadge>
      </div>
      <div style={{ width: 150, flex: "none", display: "flex", justifyContent: "flex-end" }}>
        <PfBadge tone={m.tone} dot>{c.stage}</PfBadge>
      </div>
      <span style={{ width: 34, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 11, color: "var(--pf-n300)" }}>
        <Ic name="shield" size={12} color="var(--pf-n300)" />
        {c.accessLog.length}
      </span>
      <Ic name="caretright" size={14} color="var(--pf-n300)" />
    </div>
  );
}

/* ================================= screen ================================== */

export default function Cases() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("open");
  const [cases, setCases] = useState<DisciplinaryCase[]>(DISCIPLINARY_CASES);
  const [sel, setSel] = useState(DISCIPLINARY_CASES[0].id);
  const [filter, setFilter] = useState<CaseStage | "all">("all");
  const [lens, setLens] = useState<Lens>("All access");

  /* composers — every one of them writes a human's words, never a model's */
  const [respText, setRespText] = useState("");
  const [panelText, setPanelText] = useState("");
  const [outcome, setOutcome] = useState("");
  const [sanction, setSanction] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [newSubject, setNewSubject] = useState(ALL_WORKERS[0].id);
  const [newCategory, setNewCategory] = useState("Attendance");
  const [newFacts, setNewFacts] = useState("");
  const [newDraft, setNewDraft] = useState("");

  const cur = cases.find((c) => c.id === sel) ?? cases[0];
  const curPerson = personById(cur.workerId);
  const curWorker = workerById(cur.workerId);
  const curCompany = companyById(curWorker?.contractingCompanyId);
  const curManager = managerFor(cur);
  const curRelation = relationOf(cur.workerId);
  const sch = isSchedulable(cur.workerId);
  const signal = SEED_ATTENDANCE_SIGNALS.find((s) => s.workerId === cur.workerId);
  const summary = RESPONSE_SUMMARY[cur.id];
  const facts = QUERY_FACTS[cur.id] ?? [
    `Category “${cur.category}” — selected by ${first(ACTOR.split("·")[1].trim())}, not inferred by the model`,
    "The dated facts typed into the composer when the query was raised",
  ];

  const openCases = cases.filter((c) => c.stage !== "Closed");
  const closedCases = cases.filter((c) => c.stage === "Closed");
  const listed = filter === "all" ? cases : cases.filter((c) => c.stage === filter);
  const accessCount = cases.reduce((n, c) => n + c.accessLog.length, 0);
  const counts = Object.fromEntries(CASE_STAGES.map((s) => [s, cases.filter((c) => c.stage === s).length])) as Record<CaseStage, number>;
  const fullCycle = cases.find((c) => c.id === "DC-12") ?? closedCases[0];

  /* ------------------------------- mutations ------------------------------- */

  const patch = (id: string, fn: (c: DisciplinaryCase) => DisciplinaryCase) =>
    setCases((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const logged = (c: DisciplinaryCase, action: string): DisciplinaryCase => ({
    ...c, accessLog: [...c.accessLog, { at: stampAt(c.accessLog.length), who: ACTOR, action }],
  });

  const openCase = (id: string) => {
    setSel(id);
    setRespText(""); setPanelText(""); setOutcome(""); setSanction("");
    const c = cases.find((x) => x.id === id);
    if (c) patch(id, (x) => logged(x, "opened case"));
  };

  const recordResponse = () => {
    const text = respText.trim();
    if (!text) { toast("Paste the employee's written response first — nothing is recorded from memory"); return; }
    patch(cur.id, (c) => logged({ ...c, response: text, responseAt: TODAY, stage: "Response received" }, "recorded response"));
    setRespText("");
    toast(`Response recorded verbatim on ${cur.id} — ${cur.subject}'s own words, unedited`, "success");
  };

  const convenePanel = () => {
    patch(cur.id, (c) => logged({ ...c, stage: "Panel" }, "convened panel"));
    toast(
      sch.ok
        ? `Panel convened on ${cur.id} — ${cur.subject} is on tour and can attend`
        : `Panel opened on ${cur.id} — ${first(cur.subject)} is ${sch.why?.toLowerCase()}, ${sch.nextWindow}. Book inside that window.`,
      sch.ok ? "success" : "default",
    );
  };

  const recordPanel = () => {
    const text = panelText.trim();
    if (!text) { toast("Type the panel's note — the finding is the panel's, not the platform's"); return; }
    patch(cur.id, (c) => logged({ ...c, panelNotes: text }, "recorded panel notes"));
    setPanelText("");
    toast(`Panel notes recorded on ${cur.id} — attributed to the panel secretary`, "success");
  };

  const recordOutcome = () => {
    if (!outcome) { toast("Choose the outcome from the policy schedule — nothing is pre-selected"); return; }
    patch(cur.id, (c) => logged({ ...c, outcome, sanction: sanction.trim() || "None", sanctionAt: TODAY, stage: "Outcome" }, `recorded outcome — ${outcome}`));
    toast(`Outcome recorded on ${cur.id} by ${ACTOR} — “${outcome}” for ${cur.subject}`, "success");
    setOutcome(""); setSanction("");
  };

  const closeCase = () => {
    patch(cur.id, (c) => logged({ ...c, stage: "Closed" }, "closed case · retention clock started"));
    toast(`${cur.id} closed — retention clock started: ${cur.retention.toLowerCase()}`, "success");
  };

  const generateDraft = () => {
    const f = newFacts.trim().replace(/\.$/, "");
    if (!f) { toast("Add the dated facts — a query with no dates is not a query"); return; }
    setNewDraft(
      `You are required to explain ${f}. Please respond in writing within 48 hours of receipt. This query is issued to establish the facts; no conclusion has been drawn.`,
    );
    toast("Draft generated by MC-06 — tone-guarded, and carrying no sanction", "ai");
  };

  const issueQuery = () => {
    if (!newDraft) { toast("Generate the draft first, then read it before it goes out"); return; }
    const p = ALL_WORKERS.find((w) => w.id === newSubject)!;
    const id = `DC-${15 + cases.filter((c) => c.id.startsWith("DC-")).length - DISCIPLINARY_CASES.length}`;
    const fresh: DisciplinaryCase = {
      id, workerId: p.id, subject: p.name, init: p.init, tone: p.tone, role: p.role,
      opened: TODAY, stage: "Query issued", category: newCategory, queryDraft: newDraft,
      retention: "Retain 6 years from closure, then destroy",
      accessLog: [{ at: stampAt(0), who: ACTOR, action: "issued query (draft edited and approved)" }],
    };
    setCases((prev) => [fresh, ...prev]);
    setSel(id);
    setNewOpen(false); setNewFacts(""); setNewDraft("");
    toast(`${id} issued to ${p.name} — 48-hour response window open from receipt`, "success");
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Queries &amp; disciplinary cases</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            The Nigerian query letter, run as the formal artifact it is — issued, answered in 48 hours, heard by a panel, and closed with an outcome a person typed. The AI drafts and summarises; it never recommends a sanction (FR-088).
          </div>
        </div>
        <PfBtn variant="secondary" icon="pulse" onClick={() => go("attendance")}>Attendance signals</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { setNewOpen((v) => !v); setTab("open"); }}>Raise a query</PfBtn>
      </div>

      {/* governance strip — this page announces its own restrictions */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "9px 14px", marginBottom: 12 }}>
        <Ic name="shield" size={15} color="var(--pf-n900)" />
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>case_file · restricted</span>
        <PfBadge tone="red" dot>HR + concerned line management only</PfBadge>
        <PfBadge tone="yellow" dot>DPIA gates GA</PfBadge>
        <span style={{ fontSize: 12, color: "var(--pf-n500)", flex: 1, minWidth: 260 }}>
          Every open of a case writes an audit entry — including this one. Nothing on this page escalates on its own.
        </span>
        <PfBtn small variant="secondary" icon="clipboard" onClick={() => setTab("governance")}>Access &amp; retention</PfBtn>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 4 }}>
        <PfStat
          icon="clipboard" tone="yellow" label="Open cases" value={openCases.length} unit="in progress"
          delta={`${closedCases.length} closed`} deltaTone="green"
        />
        <PfStat
          icon="clock" tone="blue" label="Response window" value="48" unit="hours, in writing"
          delta="from receipt, not issue" deltaTone="blue"
        />
        <PfStat
          icon="robot" tone="green" label="Sanctions the AI proposed" value="0" unit="by design"
          delta={`${MC06.id} hard rule`} deltaTone="green"
        />
        <PfStat
          icon="shield" tone="purple" label="Accesses logged" value={accessCount} unit="on these cases"
          delta="100% of opens" deltaTone="green"
        />
      </div>

      {/* tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "open", label: "Open cases", count: String(openCases.length) },
            { key: "lifecycle", label: "Case lifecycle" },
            { key: "governance", label: "Access & retention" },
          ]}
        />
      </div>

      {/* ================================ OPEN ================================ */}
      {tab === "open" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* the composer — a human's dated facts in, a tone-guarded draft out */}
          {newOpen && (
            <PfCard>
              <PfCardHead
                title="Raise a query"
                sub="You supply the dated facts and choose the category. The model turns them into a letter — it does not decide that there is a case."
              >
                <PfBtn small variant="ghost" icon="x" onClick={() => { setNewOpen(false); setNewDraft(""); }}>Cancel</PfBtn>
              </PfCardHead>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "14px 20px" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Subject</div>
                  <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)} style={fieldStyle}>
                    {ALL_WORKERS.map((w) => (
                      <option key={w.id} value={w.id}>{w.name} — {w.role} · {w.loc}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Category</div>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={fieldStyle}>
                    {["Attendance", "Conduct", "Safety (HSE)", "Policy breach", "Performance"].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ padding: "0 20px 14px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>The dated facts — what happened, and when</div>
                <textarea
                  value={newFacts}
                  onChange={(e) => setNewFacts(e.target.value)}
                  rows={3}
                  placeholder="e.g. your absence from duty on 5, 7 and 11 August 2026, on which dates no clock-in was recorded and no prior leave was approved"
                  style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="sparkle" onClick={generateDraft}>Draft with {MC06.id}</PfBtn>
                  <PfBtn small variant="primary" icon="paperplane" onClick={issueQuery}>Issue query</PfBtn>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>You read and edit the letter before it is issued — the draft is never sent by the model.</span>
                </div>
              </div>
              {newDraft && (
                <div style={{ padding: "0 20px 16px" }}>
                  <AiBlock label="AI draft · query letter" chip="tone-guarded">
                    <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "12px 14px", fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.7 }}>{newDraft}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {["no conclusion drawn", "no sanction named", "no adjectives about the person", "dated facts only", "48-hour window stated"].map((g) => (
                        <span key={g} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 7px" }}>
                          <Ic name="check" size={11} color="var(--pf-purple-500)" weight={2.4} />{g}
                        </span>
                      ))}
                    </div>
                  </AiBlock>
                </div>
              )}
              <Foot icon="shield">
                The tone guard is the template, not a hope. MC-06 receives a category and dated facts and returns a letter in this shape — <b style={{ color: "var(--pf-n600)" }}>there is no field in it for a sanction</b>, so there is nothing for the model to fill.
              </Foot>
            </PfCard>
          )}

          {/* pipeline */}
          <PfCard>
            <PfCardHead
              title="The pipeline"
              sub="Five stages, in order, each with an owner and an artifact. Click a stage to filter the list."
            >
              {filter !== "all" && <PfBtn small variant="ghost" icon="x" onClick={() => setFilter("all")}>Clear filter</PfBtn>}
              <PfBadge tone="grey">{cases.length} cases on file</PfBadge>
            </PfCardHead>
            <Pipeline counts={counts} filter={filter} onPick={(s) => setFilter((f) => (f === s ? "all" : s))} />
            <Foot icon="clock">
              Nothing advances by itself. A lapsed 48-hour window does not move a case to panel, and a panel does not write an outcome — a named person records each step, and the log carries their name.
            </Foot>
          </PfCard>

          {/* case list */}
          <PfCard>
            <PfCardHead
              title={filter === "all" ? "Cases" : `Cases at “${filter}”`}
              sub={`${listed.length} of ${cases.length} · selecting a case opens the file, and writes an access entry.`}
            >
              <PfBadge tone="red" dot>restricted</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px" }}>
              <PfTh style={{ width: 34 }} />
              <PfTh style={{ flex: 1 }}>Subject</PfTh>
              <PfTh style={{ width: 92 }}>Category</PfTh>
              <PfTh style={{ width: 150, textAlign: "right" }}>Stage</PfTh>
              <PfTh style={{ width: 34, textAlign: "right" }}>Log</PfTh>
              <span style={{ width: 14 }} />
            </div>
            {listed.map((c) => (
              <CaseListRow key={c.id} c={c} on={c.id === cur.id} onPick={() => openCase(c.id)} />
            ))}
            {listed.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                No case sits at “{filter}” today.
              </div>
            )}
          </PfCard>

          {/* ------------------------------ the file ----------------------------- */}
          <PfCard>
            <PfCardHead
              title={`${cur.id} — ${cur.subject}`}
              sub={`${cur.role} · ${curPerson?.dept ?? "—"} · ${curPerson?.loc ?? "—"} · opened ${cur.opened} · line manager ${curManager}`}
            >
              <PfBadge tone={cur.category === "Attendance" ? "blue" : "purple"}>{cur.category}</PfBadge>
              <PfBadge tone={STAGE_META[cur.stage].tone} dot>{cur.stage}</PfBadge>
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <PfAvatar init={cur.init} tone={cur.tone} size={38} />
              <StageRail stage={cur.stage} />
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" icon="user" onClick={() => go("employee")}>Person record</PfBtn>
            </div>

            {/* employer of record — the honest limit on a third-party worker */}
            {curRelation === "third-party" && curCompany && (
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                <PfBanner tone="yellow" icon="warning" cta="workforce" onCta={() => go("workforce")}>
                  <span style={{ fontWeight: 600 }}>{cur.subject} is {WORKER_TYPE_LABEL[curWorker!.workerType].toLowerCase()}, employed by {curCompany.name} — </span>
                  <span style={{ fontWeight: 400 }}>
                    we can record a site and assignment outcome. An employment sanction is the contracting company&rsquo;s to make, and this file will not pretend otherwise. The outcome list below is cut to what we can actually decide.
                  </span>
                </PfBanner>
              </div>
            )}

            {/* 1 — the AI draft */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>01</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Query letter</span>
                <PfBadge tone="grey">issued {cur.opened}</PfBadge>
              </div>

              {/* the guarantee, next to the draft — not in a policy PDF */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "var(--pf-n900)", borderRadius: 10, padding: "11px 14px", marginBottom: 10 }}>
                <Ic name="shield" size={16} color="#fff" />
                <div style={{ fontSize: 12.5, color: "#fff", lineHeight: 1.6 }}>
                  <b>The model drafts and summarises. It never recommends a sanction.</b>{" "}
                  <span style={{ color: "var(--pf-n300)" }}>
                    {MC06.id} takes a category and dated facts, and returns a letter. It has never been shown the company&rsquo;s sanction schedule, so it has no vocabulary to recommend from. The outcome below is typed by {ACTOR.split("·")[1].trim()}.
                  </span>
                </div>
              </div>

              <AiBlock
                label="AI draft · tone-guarded"
                chip={`${MC06.id} · ${MC06.name}`}
                why={
                  <WhyThisPanel
                    why={{
                      claim: `This letter is a formatting of facts a person supplied. Nothing in it was inferred about ${first(cur.subject)}, and nothing in it proposes what should happen next.`,
                      basis: facts,
                      modelCard: MC06.id,
                      humanGate: MC06.humanGate,
                    }}
                    extra={
                      <>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "12px 0 6px" }}>Not inputs</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {NOT_INPUTS.map((n) => (
                            <div key={n} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                              <Ic name="x" size={12} color="var(--pf-red-500)" weight={2.2} />
                              <span>{n}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    }
                  />
                }
              >
                <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "13px 15px", fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.75 }}>
                  {cur.queryDraft}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="file" onClick={() => toast(`Issued letter opened — ${cur.id}, delivered to ${cur.subject} on ${cur.opened} (PDF)`)}>Open issued letter</PfBtn>
                  <PfBtn small variant="ghost" icon="clipboard" onClick={() => toast(`Query text copied — ${cur.id} · ${cur.subject}`)}>Copy text</PfBtn>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Edited and approved by a person before issue · delivery acknowledged on the record</span>
                </div>
              </AiBlock>
            </div>

            {/* 2 — the response */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>02</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>The employee&rsquo;s response</span>
                {cur.response
                  ? <PfBadge tone="blue" dot>captured in-app · {cur.responseAt}</PfBadge>
                  : <PfBadge tone="yellow" dot>48-hour window open</PfBadge>}
              </div>

              {cur.response ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <HumanBlock title={`${cur.subject} — in his own words`} badge="Verbatim, unedited" author={`Received ${cur.responseAt}`}>
                    <div style={{ display: "flex", gap: 11 }}>
                      <PfAvatar init={cur.init} tone={cur.tone} size={30} />
                      <div style={{ flex: 1, fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.75, borderLeft: "2px solid var(--pf-n100)", paddingLeft: 12 }}>
                        &ldquo;{cur.response}&rdquo;
                      </div>
                    </div>
                  </HumanBlock>

                  {summary && (
                    <AiBlock
                      label="AI summary — a reading aid, not a finding"
                      chip="never written over the original"
                      why={
                        <WhyThisPanel
                          why={{
                            claim: "A summary of the response as given. It makes no assessment of truthfulness, offers no conclusion, and proposes nothing.",
                            basis: [
                              `The response text captured on ${cur.responseAt}, in full`,
                              "The dated facts already in the query letter",
                              "Nothing else — no history, no ratings, no other case",
                            ],
                            modelCard: MC06.id,
                            humanGate: MC06.humanGate,
                          }}
                        />
                      }
                    >
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>{summary.line}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-purple-500)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>What a person should check</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {summary.checks.map((k) => (
                          <div key={k} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                            <Ic name="search" size={12} color="var(--pf-purple-500)" />
                            <span>{k}</span>
                          </div>
                        ))}
                      </div>
                    </AiBlock>
                  )}
                </div>
              ) : (
                <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "14px 15px", background: "var(--pf-n25)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6, marginBottom: 10 }}>
                    Nothing recorded yet. The window runs 48 hours <b style={{ color: "var(--pf-n600)" }}>from receipt</b>, not from issue — and it lapsing changes nothing on its own. Paste the written response exactly as given; the platform never paraphrases into this field.
                  </div>
                  <textarea
                    value={respText}
                    onChange={(e) => setRespText(e.target.value)}
                    rows={3}
                    placeholder={`${first(cur.subject)}'s written response, word for word`}
                    style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
                  />
                  <div style={{ marginTop: 9 }}>
                    <PfBtn small variant="primary" icon="chat" onClick={recordResponse}>Record response</PfBtn>
                  </div>
                </div>
              )}
            </div>

            {/* 3 — panel */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>03</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Panel</span>
                {cur.panelNotes
                  ? <PfBadge tone="purple" dot>notes on file</PfBadge>
                  : <PfBadge tone="grey">not yet held</PfBadge>}
              </div>

              {cur.panelNotes ? (
                <HumanBlock title="Panel notes" author={`Panel secretary · ${ACTOR.split("·")[1].trim()}`} when={cur.sanctionAt ?? cur.responseAt}>
                  <div style={{ fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.7 }}>{cur.panelNotes}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, paddingTop: 9, borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
                    <Ic name="users" size={13} color="var(--pf-n300)" />
                    Heard with {first(cur.subject)} present · HR and {curManager}&rsquo;s line of management · no model attended, and none read the room.
                  </div>
                </HumanBlock>
              ) : (
                <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "14px 15px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 11 }}>
                    <Ic name="calendar" size={15} color={sch.ok ? "var(--pf-primary-500)" : "var(--pf-yellow-500)"} />
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                      {sch.ok
                        ? `${first(cur.subject)} is on tour at ${curPerson?.loc ?? "site"} and can attend this week (FR-090).`
                        : `${first(cur.subject)} is ${sch.why?.toLowerCase()} — ${sch.nextWindow}. A panel he cannot attend is not a panel: book inside the on-tour window, and let the clock wait.`}
                    </div>
                  </div>
                  {cur.stage === "Panel" ? (
                    <>
                      <textarea
                        value={panelText}
                        onChange={(e) => setPanelText(e.target.value)}
                        rows={3}
                        placeholder="What the panel heard and what it found — typed by the panel secretary"
                        style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
                      />
                      <div style={{ marginTop: 9 }}>
                        <PfBtn small variant="primary" icon="clipboard" onClick={recordPanel}>Record panel notes</PfBtn>
                      </div>
                    </>
                  ) : (
                    <PfBtn
                      small variant="secondary" icon="users"
                      onClick={cur.response ? convenePanel : () => toast(`Record ${first(cur.subject)}'s response before convening a panel — he has not been heard yet`)}
                    >
                      Convene panel
                    </PfBtn>
                  )}
                </div>
              )}
            </div>

            {/* 4 — outcome & sanction, authored by HR */}
            <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-n300)" }}>04</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Outcome &amp; sanction</span>
                <PfBadge tone="grey">HR-authored field</PfBadge>
                <span style={{ flex: 1 }} />
                {cur.stage === "Outcome" && <PfBtn small variant="secondary" icon="check" onClick={closeCase}>Close case</PfBtn>}
              </div>

              {cur.outcome ? (
                <HumanBlock title="Recorded outcome" author={ACTOR} when={cur.sanctionAt} badge="Authored by HR — no model wrote here">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                    {[
                      { k: "Outcome", v: cur.outcome, tone: cur.outcome === "No further action" ? "green" : "yellow" },
                      { k: "Sanction", v: cur.sanction ?? "None", tone: (cur.sanction ?? "None") === "None" ? "green" : "red" },
                      { k: "Recorded", v: cur.sanctionAt ?? TODAY, tone: "grey" },
                    ].map((f) => (
                      <div key={f.k} style={{ border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{f.k}</div>
                        <div style={{ marginTop: 6 }}><PfBadge tone={f.tone as PfTone} dot>{f.v}</PfBadge></div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    <Ic name="user" size={13} color="var(--pf-n400)" />
                    <span>
                      Typed by {ACTOR} from the company&rsquo;s policy schedule, after the panel. The AI summarised the response for the panel to read; it did not sit in it, and it proposed nothing here.
                      {(cur.sanction ?? "None") === "None" && <> <b style={{ color: "var(--pf-n600)" }}>&ldquo;None&rdquo; is a recorded outcome</b>, not an empty field.</>}
                    </span>
                  </div>
                </HumanBlock>
              ) : cur.stage === "Panel" ? (
                <div style={{ border: "1px solid var(--pf-n100)", borderRadius: 11, padding: "14px 15px", borderLeft: "3px solid var(--pf-n900)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, marginBottom: 11 }}>
                    The policy schedule below is the company&rsquo;s list — <b style={{ color: "var(--pf-n900)" }}>not a model&rsquo;s ranking</b>. Nothing is pre-selected, nothing is suggested, and “No further action” sits first.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>
                        Outcome {curRelation === "third-party" && <span style={{ color: "var(--pf-yellow-500)" }}>· limited to what we can decide</span>}
                      </div>
                      <select value={outcome} onChange={(e) => setOutcome(e.target.value)} style={fieldStyle}>
                        <option value="">Choose an outcome…</option>
                        {OUTCOME_OPTIONS[curRelation].map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Sanction, in your words (blank records &ldquo;None&rdquo;)</div>
                      <input value={sanction} onChange={(e) => setSanction(e.target.value)} placeholder="None" style={fieldStyle} />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <PfBtn small variant="primary" icon="check" onClick={recordOutcome}>Record outcome as {first(ACTOR.split("·")[1].trim())}</PfBtn>
                  </div>
                </div>
              ) : (
                <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "16px 15px", background: "var(--pf-n25)", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <PfTile icon="shield" tone="grey" size={30} />
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65 }}>
                    Empty until the panel has been held. Outcome and sanction are typed by HR — <b style={{ color: "var(--pf-n600)" }}>this field is not AI-fillable</b>. There is no “suggest an outcome” button on this page, and its absence is the feature.
                  </div>
                </div>
              )}
            </div>

            {/* audit preview */}
            <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--pf-n25)" }}>
              <Ic name="shield" size={14} color="var(--pf-n400)" />
              <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                <b style={{ color: "var(--pf-n600)" }}>{cur.accessLog.length} accesses logged</b> on {cur.id} · last: {cur.accessLog[cur.accessLog.length - 1]?.who} {cur.accessLog[cur.accessLog.length - 1]?.action} at {cur.accessLog[cur.accessLog.length - 1]?.at}
              </span>
              <span style={{ flex: 1 }} />
              <PfBadge tone="grey">{cur.retention}</PfBadge>
              <PfBtn small variant="secondary" icon="clipboard" onClick={() => setTab("governance")}>Full audit strip</PfBtn>
            </div>
          </PfCard>

          {/* what the platform knew, and what it deliberately did not do */}
          {signal && (
            <PfCard>
              <PfCardHead
                title="What the platform knew — and what it did not do with it"
                sub={`Attendance signals for ${cur.subject}, derived from clock events only (FR-089).`}
              >
                <PfBadge tone="green" dot>{ATT_ADAPTER?.provider ?? "CSV upload"} · live</PfBadge>
                <PfBtn small variant="secondary" icon="pulse" onClick={() => go("attendance")}>Open signals</PfBtn>
              </PfCardHead>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                {[
                  { k: "Absence rate", v: `${signal.absenceRate}%`, icon: "gauge" },
                  { k: "Lateness", v: signal.latenessPattern, icon: "clock" },
                  { k: "Overtime load", v: signal.overtimeLoad, icon: "pulse" },
                ].map((s, i) => (
                  <div key={s.k} style={{ padding: "13px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <PfTile icon={s.icon} tone="blue" size={26} />
                      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{s.k}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", marginTop: 8 }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "13px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", gap: 9, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                  <Ic name="info" size={14} color={TONE[signal.tone].fg} />
                  <span>{signal.note}</span>
                </div>
              </div>
              <Foot icon="shield">
                <b style={{ color: "var(--pf-n600)" }}>The signal did not open this case.</b> {MC07.name} ({MC07.id}) reads clock events and nothing else, and its human gate is absolute: {MC07.humanGate.toLowerCase()}. {curManager} read three dated absences and wrote a report; a person in People Ops raised the query. An absence rate is not a finding, and a pattern is not a case.
              </Foot>
            </PfCard>
          )}
        </div>
      )}

      {/* ============================== LIFECYCLE ============================= */}
      {tab === "lifecycle" && fullCycle && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="check">
            <span style={{ fontWeight: 600 }}>{fullCycle.id} ran the full cycle and ended in nothing — outcome “{fullCycle.outcome}”, sanction “{fullCycle.sanction}”. </span>
            <span style={{ fontWeight: 400 }}>
              That is the example to lead with. A process that only knows how to punish is not a process, and a platform that makes “no further action” harder to record than a warning has taken a side.
            </span>
          </PfBanner>

          {/* the worked cycle */}
          <PfCard>
            <PfCardHead
              title={`A full cycle, end to end — ${fullCycle.subject} · ${fullCycle.id}`}
              sub={`${fullCycle.category} · opened ${fullCycle.opened} · closed on the outcome of ${fullCycle.sanctionAt} · every step below is an artifact on the file.`}
            >
              <PfBadge tone="green" dot>Closed · no further action</PfBadge>
            </PfCardHead>
            {CASE_STAGES.map((s, i) => {
              const m = STAGE_META[s];
              const body =
                s === "Query issued" ? fullCycle.queryDraft
                : s === "Response received" ? `“${fullCycle.response}”`
                : s === "Panel" ? fullCycle.panelNotes ?? "—"
                : s === "Outcome" ? `${fullCycle.outcome} · sanction: ${fullCycle.sanction}`
                : `File closed. ${fullCycle.retention}.`;
              const when =
                s === "Query issued" ? fullCycle.opened
                : s === "Response received" ? fullCycle.responseAt ?? "—"
                : s === "Panel" ? "Jun 09, 2026"
                : s === "Outcome" ? fullCycle.sanctionAt ?? "—"
                : fullCycle.sanctionAt ?? "—";
              const human = s !== "Query issued";
              return (
                <div key={s} style={{ display: "flex", gap: 14, padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 34 }}>
                    <PfTile icon={m.icon} tone={m.tone} size={34} />
                    {i < CASE_STAGES.length - 1 && <span style={{ flex: 1, width: 2, background: "var(--pf-n50)", marginTop: 6, minHeight: 26 }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s}</span>
                      <PfBadge tone="grey">{when}</PfBadge>
                      <PfBadge tone={human ? "grey" : "purple"}>{human ? "Human-authored" : "AI-drafted, human-issued"}</PfBadge>
                      {s === "Response received" && <PfBadge tone="green" dot>inside 48 hours</PfBadge>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.7, marginTop: 7, borderLeft: `2px solid ${human ? "var(--pf-n100)" : "var(--pf-purple-100)"}`, paddingLeft: 12 }}>
                      {body}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 9 }}>
                      {[["Who acts", m.who], ["Artifact", m.artifact], ["Clock", m.clock]].map(([k, v]) => (
                        <span key={k} style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                          <span style={{ color: "var(--pf-n300)" }}>{k}: </span>{v}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
            <Foot icon="check">
              Five artifacts, four of them typed by people. The one the model touched — the query letter — was read, edited and issued by {ACTOR}, and carried no conclusion into the room.
            </Foot>
          </PfCard>

          {/* the 48-hour rule */}
          <PfCard>
            <PfCardHead title="The 48-hour rule" sub="The most misused clock in Nigerian HR practice. Here is exactly what it is, and what it is not." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {[
                { icon: "clock", tone: "blue" as PfTone, head: "When it starts", body: "On receipt of the query, not on the date it was written. Delivery is acknowledged on the file, and for a rotating worker that may not be the same day it was issued." },
                { icon: "chat", tone: "purple" as PfTone, head: "What it is for", body: "It gives the employee time to answer in writing, before anyone meets to discuss him. The response is the point of the query — not a formality on the way to a decision already taken." },
                { icon: "shield", tone: "yellow" as PfTone, head: "If it lapses", body: "Nothing happens automatically. No stage advances, no reminder escalates, no outcome is drafted. A person records that the window closed unanswered, and the panel is told exactly that." },
              ].map((g, i) => (
                <div key={g.head} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <PfTile icon={g.icon} tone={g.tone} size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{g.head}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>{g.body}</div>
                </div>
              ))}
            </div>
            <Foot icon="calendar">
              Rotation is part of natural justice offshore (FR-090). {first(cur.subject)} is {sch.ok ? "on tour and reachable" : `${sch.why?.toLowerCase()} — ${sch.nextWindow}`}: a hearing scheduled into an off-rotation window is a hearing the subject cannot attend, and the platform refuses to book one.
            </Foot>
          </PfCard>

          {/* stage reference */}
          <PfCard>
            <PfCardHead title="The five stages, and the rule that governs each" sub="The lifecycle is fixed. What varies is who acts and what artifact survives." />
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px" }}>
              <PfTh style={{ width: 34 }} />
              <PfTh style={{ width: 150 }}>Stage</PfTh>
              <PfTh style={{ width: 210 }}>Who acts</PfTh>
              <PfTh style={{ flex: 1 }}>The rule</PfTh>
            </div>
            {CASE_STAGES.map((s) => {
              const m = STAGE_META[s];
              return (
                <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <PfTile icon={m.icon} tone={m.tone} size={30} />
                  <div style={{ width: 150, flex: "none" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{s}</div>
                    <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 3 }}>{m.clock}</div>
                  </div>
                  <div style={{ width: 210, flex: "none", fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{m.who}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{m.rule}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                      <Ic name="file" size={12} color="var(--pf-n300)" />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{m.artifact}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </PfCard>

          {/* sanction log */}
          <PfCard>
            <PfCardHead
              title="Sanction log"
              sub="Every recorded outcome, including the ones that recorded nothing. Authored by HR, kept for the retention period, never summarised into a score."
            >
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`Sanction log exported — ${cases.filter((c) => c.outcome).length} recorded outcomes, subjects named, for HR use only (PDF)`)}>Export</PfBtn>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px" }}>
              <PfTh style={{ width: 62 }}>Case</PfTh>
              <PfTh style={{ flex: 1 }}>Subject</PfTh>
              <PfTh style={{ width: 92 }}>Category</PfTh>
              <PfTh style={{ width: 170 }}>Outcome</PfTh>
              <PfTh style={{ width: 110 }}>Sanction</PfTh>
              <PfTh style={{ width: 110, textAlign: "right" }}>Recorded</PfTh>
            </div>
            {cases.filter((c) => c.outcome).map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <span style={{ width: 62, flex: "none", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{c.id}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                  <PfAvatar init={c.init} tone={c.tone} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.subject}</div>
                    <div style={{ fontSize: 11, color: "var(--pf-n300)" }}>{c.role}</div>
                  </div>
                </div>
                <div style={{ width: 92, flex: "none" }}><PfBadge tone="grey">{c.category}</PfBadge></div>
                <div style={{ width: 170, flex: "none" }}>
                  <PfBadge tone={c.outcome === "No further action" ? "green" : "yellow"} dot>{c.outcome}</PfBadge>
                </div>
                <div style={{ width: 110, flex: "none" }}>
                  <PfBadge tone={(c.sanction ?? "None") === "None" ? "green" : "red"}>{c.sanction ?? "None"}</PfBadge>
                </div>
                <span style={{ width: 110, flex: "none", textAlign: "right", fontSize: 12, color: "var(--pf-n400)" }}>{c.sanctionAt ?? "—"}</span>
              </div>
            ))}
            {cases.filter((c) => c.outcome).length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                No outcome recorded yet.
              </div>
            )}
            <Foot icon="info">
              <b style={{ color: "var(--pf-n600)" }}>&ldquo;None&rdquo; is a first-class row.</b> A sanction log that only holds punishments tells you nothing about whether the process is fair — and the counts that leave this page (below) do not distinguish between them anyway.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ============================= GOVERNANCE ============================ */}
      {tab === "governance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="yellow" icon="warning" cta="trust" onCta={() => go("trust")}>
            <span style={{ fontWeight: 600 }}>DPIA — {DPIA.state === "in-progress" ? "in progress" : DPIA.state} · a hard gate before GA on real employee data. </span>
            <span style={{ fontWeight: 400 }}>{DPIA.answer} Until it is signed off, this module runs on demo data. That is a gate, not a caveat.</span>
          </PfBanner>

          {/* access rules */}
          <PfCard>
            <PfCardHead
              title="Who can open a case, and who cannot"
              sub="Field- and row-level permissions (FR-077). Disciplinary is the narrowest scope in the platform."
            >
              <PfBadge tone={toneForState(DPIA.state)} dot>DPIA {DPIA.state}</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {[
                { icon: "shield", tone: "green" as PfTone, head: "Can open", body: `People Ops, and the concerned line of management only — for ${cur.subject}, that is ${curManager} and no other manager. Access is per case, not per department.` },
                { icon: "x", tone: "red" as PfTone, head: "Cannot open", body: "Peers. Other departments. The wider manager population. Analytics and BI — no case row is in any warehouse export. Nobody browses this list to see who is in trouble." },
                { icon: "user", tone: "blue" as PfTone, head: "What the subject gets", body: `${first(cur.subject)} holds the query, his own response and the recorded outcome — his file is his under NDPR, and he can request it from /my-privacy. Panel deliberation notes are not released before the outcome is recorded.` },
              ].map((g, i) => (
                <div key={g.head} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <PfTile icon={g.icon} tone={g.tone} size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{g.head}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>{g.body}</div>
                </div>
              ))}
            </div>
            <Foot icon="shield">
              {LOGGING.answer} — {LOGGING.evidence.toLowerCase()} covers this table. This page is <b style={{ color: "var(--pf-n600)" }}>{AS11.id}</b> in the FR-093 surface audit ({AS11.where}), and it is marked covered.
              <span style={{ display: "inline-flex", gap: 6, marginLeft: 8 }}>
                <button onClick={() => go("aisurfaces")} style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}>Surface audit</button>
              </span>
            </Foot>
          </PfCard>

          {/* audit strips */}
          <PfCard>
            <PfCardHead
              title="Access log"
              sub="Append-only. Every open, every edit, every export — who, when, what. Including the entries this session just wrote."
            >
              <PfTabs tabs={[...LENSES]} active={lens} onChange={(t) => setLens(t as Lens)} />
            </PfCardHead>
            {cases.map((c) => {
              const rows = c.accessLog.filter((r) => inLens(r.who, lens));
              return (
                <div key={c.id} style={{ borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", background: "var(--pf-n25)", flexWrap: "wrap" }}>
                    <PfAvatar init={c.init} tone={c.tone} size={24} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.subject}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: "var(--pf-n300)" }}>{c.id}</span>
                    <PfBadge tone={STAGE_META[c.stage].tone} dot>{c.stage}</PfBadge>
                    <span style={{ flex: 1 }} />
                    <PfBadge tone="grey">{rows.length} of {c.accessLog.length} entries</PfBadge>
                    <PfBtn small variant="ghost" icon="arrowright" onClick={() => { setSel(c.id); setTab("open"); }}>Open file</PfBtn>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 20px" }}>
                    <PfTh style={{ width: 110 }}>When</PfTh>
                    <PfTh style={{ width: 240 }}>Who</PfTh>
                    <PfTh style={{ flex: 1 }}>What</PfTh>
                    <PfTh style={{ width: 96, textAlign: "right" }}>Role</PfTh>
                  </div>
                  {rows.map((r, i) => {
                    const hr = r.who.startsWith("People Ops");
                    return (
                      <div key={`${c.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                        <span style={{ width: 110, flex: "none", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{r.at}</span>
                        <div style={{ width: 240, flex: "none", display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: hr ? "var(--pf-primary-500)" : "var(--pf-blue-500)", flex: "none" }} />
                          <span style={{ fontSize: 12.5, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.who}</span>
                        </div>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n600)" }}>{r.action}</span>
                        <div style={{ width: 96, flex: "none", display: "flex", justifyContent: "flex-end" }}>
                          <PfBadge tone={hr ? "green" : "blue"}>{hr ? "HR" : "line manager"}</PfBadge>
                        </div>
                      </div>
                    );
                  })}
                  {rows.length === 0 && (
                    <div style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
                      No {lens.toLowerCase()} entries on this case.
                    </div>
                  )}
                </div>
              );
            })}
            <Foot icon="clipboard">
              A line-manager view is an entry like any other — {DISCIPLINARY_CASES[0].accessLog[2]?.who ?? "the line manager"} looking at {DISCIPLINARY_CASES[0].subject}&rsquo;s case is on the record, permanently. The log cannot be edited or deleted from this screen, by anyone, including People Ops.
            </Foot>
          </PfCard>

          {/* retention */}
          <PfCard>
            <PfCardHead title="Retention" sub="Stated per case, in the UI, not buried in a schedule. The clock starts at closure — never at opening." />
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px" }}>
              <PfTh style={{ width: 62 }}>Case</PfTh>
              <PfTh style={{ flex: 1 }}>Subject</PfTh>
              <PfTh style={{ width: 110 }}>Opened</PfTh>
              <PfTh style={{ width: 250 }}>Rule</PfTh>
              <PfTh style={{ width: 170, textAlign: "right" }}>Destruction</PfTh>
            </div>
            {cases.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <span style={{ width: 62, flex: "none", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{c.id}</span>
                <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
                  <PfAvatar init={c.init} tone={c.tone} size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.subject}</span>
                </div>
                <span style={{ width: 110, flex: "none", fontSize: 12, color: "var(--pf-n400)" }}>{c.opened}</span>
                <span style={{ width: 250, flex: "none", fontSize: 12, color: "var(--pf-n600)" }}>{c.retention}</span>
                <div style={{ width: 170, flex: "none", display: "flex", justifyContent: "flex-end" }}>
                  <PfBadge tone={c.stage === "Closed" ? "green" : "grey"} dot>{retentionUntil(c)}</PfBadge>
                </div>
              </div>
            ))}
            <Foot icon="clock">
              Six years from closure is the retention this workspace sets for disciplinary files; a note placed on file for 12 months expires on its own schedule inside that. Destruction is a scheduled job with its own audit entry — deletion is logged as carefully as access.
            </Foot>
          </PfCard>

          {/* the model boundary */}
          <PfCard>
            <PfCardHead
              title="What reaches the attrition model"
              sub="Case outcomes inform workforce analytics only in aggregate, and only through this door."
            >
              <PfBtn small variant="secondary" icon="trend" onClick={() => go("attrition")}>Where the counts land</PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {/* what goes */}
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                  <PfTile icon="check" tone="green" size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Leaves this page</span>
                  <PfBadge tone="green">counts only</PfBadge>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  {[{ k: "Open", v: AGG.open, tone: "yellow" as PfTone }, { k: "Closed", v: AGG.closed, tone: "green" as PfTone }].map((s) => (
                    <div key={s.k} style={{ flex: 1, border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{s.k}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: TONE[s.tone].fg, letterSpacing: "-.3px", marginTop: 3 }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 7 }}>By category</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {AGG.byCategory.map((b) => (
                    <div key={b.cat}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)" }}>{b.cat}</span>
                        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{b.n}</span>
                      </div>
                      <PfProgress pct={(b.n / Math.max(1, DISCIPLINARY_CASES.length)) * 100} tone="blue" height={6} />
                    </div>
                  ))}
                </div>
              </div>

              {/* what stays */}
              <div style={{ padding: "16px 20px", borderLeft: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                  <PfTile icon="x" tone="red" size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Never leaves this page</span>
                  <PfBadge tone="red">withheld</PfBadge>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    "The case narrative — query text, response, panel notes",
                    "The named subject, and any id that resolves to one",
                    "The sanction detail, including whether there was one at all",
                    "Category at person level — only the org-wide count is shared",
                    "Anything at all from an open case",
                  ].map((x) => (
                    <div key={x} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Ic name="x" size={13} color="var(--pf-red-500)" weight={2.2} />
                      <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5, textDecoration: "line-through", textDecorationColor: "var(--pf-n100)" }}>{x}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 13, paddingTop: 11, borderTop: "1px solid var(--pf-n100)" }}>
                  <Ic name="shield" size={14} color="var(--pf-n400)" />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    A disciplinary history is exactly the feature that would make an attrition model look accurate and be indefensible. It is not in the feature set, and the aggregate is permissioned on its way out.
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-primary-50)" }}>
              <Ic name="info" size={15} color="var(--pf-primary-500)" />
              <div style={{ fontSize: 12.5, color: "var(--pf-primary-600)", fontWeight: 500, lineHeight: 1.6 }}>{AGG.modelNote}</div>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
