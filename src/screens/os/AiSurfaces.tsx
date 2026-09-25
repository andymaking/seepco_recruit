"use client";
import { useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfAvatar,
  PfTabs, PfPageTabs, PfTh, PfBanner, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  AI_SURFACES, MODEL_CARDS, auditScore,
  type AiSurface, type ModelCard, type WhyThis,
} from "@/data/trust";
import { EMPLOYEES, MOBILITY } from "@/data/talentos";
import { LETTER_REQUESTS, caseAggregate } from "@/data/hrops";
import { SEED_ATTENDANCE_SIGNALS } from "@/data/adapters";
import { localContent } from "@/data/workforce";

/**
 * AI surface audit — PRD v2.1 FR-093.
 *
 * "We have AI" stopped differentiating the day a competitor shipped an assistant
 * layer. The counter is not a claim, it is a surface: every AI output in this
 * product carries the same "Why this?" affordance, and THIS PAGE IS THE AUDIT
 * that proves it — shipped as a checklist with a 100% gate.
 *
 * The gate is binary. A single uncovered surface is a BUILD BLOCKER, not a
 * warning, because it means an AI output would reach a user with no reasoning
 * attached. The gate drill on this page demonstrates exactly that failure mode.
 */

/* ---------------------------------- data ----------------------------------- */

const AUDIT = auditScore();

const PILLARS = ["Recruit", "Command", "Manage", "Grow", "Me"] as const;

const PILLAR_META: Record<string, { icon: string; tone: PfTone; blurb: string }> = {
  Recruit: { icon: "users", tone: "blue", blurb: "Rank and fit — the two numbers that decide who gets read" },
  Command: { icon: "gauge", tone: "purple", blurb: "What the org is told to look at this morning" },
  Manage: { icon: "treemap", tone: "green", blurb: "The sensitive surfaces — risk, letters, cases, attendance" },
  Grow: { icon: "trend", tone: "yellow", blurb: "Readiness and next-action suggestions on a person's career" },
  Me: { icon: "user", tone: "grey", blurb: "What the subject of the model is allowed to see about herself" },
};

/** Where each audited surface actually lives — every row on this page opens it. */
const SURFACE_STAGE: Record<string, string> = {
  "AS-01": "screening", "AS-02": "shortlist", "AS-03": "command", "AS-04": "attrition",
  "AS-05": "reviews", "AS-06": "growth", "AS-07": "retention", "AS-08": "mymobility",
  "AS-09": "myprivacy", "AS-10": "letters", "AS-11": "cases", "AS-12": "attendance",
};

/** The exact sentence a user reads on that surface — grounded in the shared data. */
const SAMPLE_CLAIM: Record<string, string> = {
  "AS-01": "Ranked 2 of 47 for Senior Backend Engineer — meets 6 of 7 rubric criteria",
  "AS-02": "Role fit 88% — strongest on distributed systems, weakest on payments domain",
  "AS-03": "Sick-day cluster around changeover — Field Operations, Bonny Terminal",
  "AS-04": "Amara Okonkwo — leave-risk 78 of 100, high, 30-day horizon",
  "AS-05": "Q2 packet assembled from 14 cited signals — 4 goals, 3 feedback notes, 2 assessments",
  "AS-06": "Amara Okonkwo is 74% ready for Staff Engineer — about 2 quarters",
  "AS-07": "Next step: pay-band review before the September cycle closes",
  "AS-08": "Halima Sule matches HSE Manager (Port Harcourt) at 81%",
  "AS-09": "Two automated decisions ran on your record in the last 90 days",
  "AS-10": "Employment-confirmation draft ready for Amara Okonkwo (LT-118)",
  "AS-11": "Query draft for DC-14 — attendance, three dated absences, no conclusion drawn",
  "AS-12": "Musa Bello — absence 11.4%, 62h overtime across four weeks",
};

const cardById = (id: string): ModelCard => MODEL_CARDS.find((c) => c.id === id)!;
const surfacesFor = (id: string) => AI_SURFACES.filter((s) => s.modelCard === id);

/* ------------------------------- the demos --------------------------------- */

const AMARA = EMPLOYEES.find((e) => e.id === "E-0214")!;
const AMARA_RISK = AMARA.risk!;
const HSE = MOBILITY.find((m) => m.candidate === "Halima Sule")!;
const LT118 = LETTER_REQUESTS.find((l) => l.id === "LT-118")!;
const ATT = SEED_ATTENDANCE_SIGNALS[0];
const LOCAL = localContent();
const CASE_AGG = caseAggregate();

type Demo = WhyThis & {
  id: string; label: string; surfaceId: string;
  kind: "risk" | "match" | "draft";
  /** Shown when `confidence` is deliberately absent — omitting is the lesson. */
  noConfidenceNote?: string;
  confidenceLabel?: string;
};

/** Three real outputs from three different pillars, one identical affordance. */
const DEMOS: Demo[] = [
  {
    id: "D-risk", label: "Leave-risk flag", surfaceId: "AS-04", kind: "risk",
    claim: `${AMARA.name} — leave-risk ${AMARA_RISK.score} of 100, ${AMARA_RISK.tier}, ${AMARA_RISK.horizon} horizon`,
    basis: [
      ...AMARA_RISK.reasons,
      `Compared against the L5 Engineering band in ${AMARA.loc} — 34 people, same grade, same location`,
    ],
    modelCard: "MC-02", confidence: 74,
    confidenceLabel: "Confidence in the signal — not a probability that she resigns",
    humanGate:
      "The HRBP decides what happens next. The score starts no workflow, is never shown to Amara's peers, and every open of this record is written to the access log.",
  },
  {
    id: "D-match", label: "Internal-role match", surfaceId: "AS-08", kind: "match",
    claim: `${HSE.candidate} matches ${HSE.role} (${HSE.loc}) at ${HSE.match}%`,
    basis: [
      ...HSE.dims.map(([name, weight]) => `${name} — weight ${weight}/100, on her profile`),
      "The weights belong to the role's requirement set. The coverage comes from her own profile — nothing else is read.",
    ],
    modelCard: "MC-03",
    noConfidenceNote:
      "No confidence figure — this is a deterministic overlap of two lists, not a prediction. Omit the field rather than manufacture a number.",
    humanGate:
      "Halima opted in, and only Halima sees her own match numbers. No manager can see who browsed the role, who matched it, or who decided against it — there is no such list.",
  },
  {
    id: "D-draft", label: "HR letter draft", surfaceId: "AS-10", kind: "draft",
    claim: `${LT118.kind} drafted for ${LT118.subject} (${LT118.id})`,
    basis: [
      "Full name — person record",
      `Role and grade — ${AMARA.role}, ${AMARA.grade}`,
      "Start date — November 2023, from the employment record",
      "Employment status — active, from the lifecycle state",
      "No salary figure: the bank-reference template omits it unless HR adds it explicitly",
    ],
    modelCard: "MC-05", confidence: 96,
    confidenceLabel: "Field-fill accuracy against the record — the prose is template, not invention",
    humanGate:
      "HR edits and approves before issue. Nothing is sent by the model; the QR token is minted only at the moment a human clicks Issue.",
  },
];

/* ------------------------------ the contract ------------------------------- */

const CONTRACT: { field: string; type: string; required: boolean; rule: string }[] = [
  { field: "claim", type: "string", required: true, rule: "The exact sentence the user already sees, restated. It states the OUTPUT — never a decision, never a sanction." },
  { field: "basis", type: "string[]", required: true, rule: "Inspectable facts, each traceable to a record the reader could open themselves. Two lines minimum." },
  { field: "modelCard", type: "string", required: true, rule: "An id into MODEL_CARDS. Renders as a link, so purpose, inputs and gate are always one click away." },
  { field: "confidence", type: "number", required: false, rule: "Optional on purpose. A deterministic derivation has no confidence — omit the field rather than invent a number." },
  { field: "humanGate", type: "string", required: true, rule: "Who decides, and what this output cannot do on its own. Present on every surface without exception." },
];

const RULES: string[] = [
  "The claim restates the output. It never states a decision, and no model in this product recommends a sanction.",
  "Every basis line points at a record the reader can open — a review, a clock event, a band table, a profile.",
  "Omit confidence rather than manufacture one. A number without a meaning is worse than no number.",
  "Protected attributes and NCDMB reporting fields never appear in basis, because they are never inputs.",
];

const CHECKLIST: { step: string; detail: string }[] = [
  { step: "Write the model card first", detail: "Purpose, inputs, human gate, governed surface — added to MODEL_CARDS before a line of the feature is built." },
  { step: "Return WhyThis with the output", detail: "The explanation is constructed where the number is constructed. An explanation generated afterwards is a second model guessing at the first." },
  { step: "Put the affordance on the claim", detail: "The chip, the ring, the draft header — wherever the claim renders. Never a separate 'explanations' page nobody opens." },
  { step: "Register the surface in AI_SURFACES", detail: "Pillar, output, model card, where the affordance lives, covered:true. The registry IS the audit." },
  { step: "Ship only at 100%", detail: "auditScore().pct must read 100. A covered:false row fails the build; it does not raise a warning." },
];

const BOLT_ON: { bad: string; why: string }[] = [
  { bad: "“AI suggests: at risk”", why: "A claim with no basis. Nothing to check, nothing to appeal." },
  { bad: "“Based on your data”", why: "Names no record. The assistant does not own the lifecycle, so it cannot name the fields it read." },
  { bad: "“92% confident”", why: "Confident in what? A number with no unit, attached to no decision boundary." },
  { bad: "No human gate stated", why: "The reader cannot tell whether something already happened because of this." },
];

/* --------------------------------- helpers --------------------------------- */

const GRID_AUDIT = "58px minmax(132px,1fr) minmax(186px,1.25fr) 66px minmax(172px,1.1fr) 112px 16px";

const chipBtn = {
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
  fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)",
  border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer",
} as const;

/* ------------------------------ the affordance ----------------------------- */

/** The collapsed control. This markup is identical on all 12 surfaces. */
function WhyControl({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title="Every AI claim in this product carries this control (FR-093)"
      style={{
        fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
        fontSize: 11.5, fontWeight: 600, cursor: "pointer", borderRadius: 5, padding: "3px 8px",
        color: "var(--pf-purple-500)",
        background: open || hovered ? "var(--pf-purple-100)" : "var(--pf-purple-50)",
        border: "0.6px solid var(--pf-purple-100)", transition: "background .12s ease",
      }}
    >
      <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
      Why this?
      <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}>
        <Ic name="caretright" size={11} color="var(--pf-purple-500)" />
      </span>
    </button>
  );
}

/** The expanded panel. Also identical everywhere — only the values change. */
function WhyPanel({ w, onCard, onBasis, onFlag }: {
  w: Demo | (WhyThis & { confidenceLabel?: string; noConfidenceNote?: string });
  onCard: () => void; onBasis: (line: string) => void; onFlag: () => void;
}) {
  const card = cardById(w.modelCard);
  return (
    <div style={{ marginTop: 10, border: "1px solid var(--pf-purple-100)", borderRadius: 10, background: "var(--pf-purple-50)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--pf-purple-100)" }}>
        <Ic name="sparkle" size={14} color="var(--pf-purple-500)" />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)", flex: 1 }}>Why this?</span>
        <button onClick={onCard} style={chipBtn}>{card.id} · {card.name}</button>
      </div>

      <div style={{ background: "var(--pf-n0)", padding: "12px 14px" }}>
        <PfTh>The claim</PfTh>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 4, lineHeight: 1.45 }}>{w.claim}</div>

        <div style={{ marginTop: 13 }}><PfTh>What it is built on</PfTh></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {w.basis.map((b, i) => (
            <button
              key={b}
              onClick={() => onBasis(b)}
              style={{
                fontFamily: "inherit", textAlign: "left", display: "flex", gap: 8, alignItems: "flex-start",
                background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8,
                padding: "8px 10px", cursor: "pointer",
              }}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", borderRadius: 4, padding: "1px 5px", flex: "none", marginTop: 1 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.45 }}>{b}</span>
              <Ic name="arrowright" size={12} color="var(--pf-n300)" />
            </button>
          ))}
        </div>

        {w.confidence != null ? (
          <div style={{ marginTop: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PfTh style={{ flex: 1 }}>Confidence</PfTh>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>{w.confidence}%</span>
            </div>
            <div style={{ marginTop: 6 }}><PfProgress pct={w.confidence} tone="purple" height={6} /></div>
            {w.confidenceLabel && <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5 }}>{w.confidenceLabel}</div>}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 13, background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 8, padding: "9px 11px" }}>
            <Ic name="info" size={13} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.45 }}>{w.noConfidenceNote ?? "No confidence figure — this output is derived, not predicted."}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 13, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 8, padding: "10px 12px" }}>
          <Ic name="shield" size={15} color="var(--pf-primary-500)" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--pf-primary-600)", letterSpacing: ".2px" }}>HUMAN GATE</div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.5 }}>{w.humanGate}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <PfBtn small variant="secondary" icon="robot" onClick={onCard}>Open the model card</PfBtn>
          <PfBtn small variant="ghost" icon="warning" onClick={onFlag}>This looks wrong</PfBtn>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ demo surfaces ------------------------------ */

function MatchRing({ pct }: { pct: number }) {
  const R = 20;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", width: 50, height: 50, flex: "none" }}>
      <svg width={50} height={50} viewBox="0 0 50 50">
        <circle cx={25} cy={25} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={6} />
        <circle cx={25} cy={25} r={R} fill="none" stroke="var(--pf-primary-500)" strokeWidth={6} strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 25 25)" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--pf-n900)" }}>{pct}%</div>
    </div>
  );
}

/** The output as the user actually meets it — the affordance sits ON the claim. */
function DemoOutput({ d, open, onToggle }: { d: Demo; open: boolean; onToggle: () => void }) {
  if (d.kind === "risk") {
    return (
      <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", background: "var(--pf-n0)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PfAvatar init={AMARA.init} tone={AMARA.tone} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{AMARA.name}</div>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{AMARA.role} · {AMARA.grade} · {AMARA.loc}</div>
          </div>
          <PfBadge tone="red" dot>Leave-risk {AMARA_RISK.score} · {AMARA_RISK.tier}</PfBadge>
          <WhyControl open={open} onClick={onToggle} />
        </div>
      </div>
    );
  }
  if (d.kind === "match") {
    return (
      <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", background: "var(--pf-n0)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MatchRing pct={HSE.match} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{HSE.role}</div>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{HSE.dept} · {HSE.loc} · posted {HSE.posted}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 7, alignItems: "center" }}>
              <PfBadge tone="green" dot>Strong overlap</PfBadge>
              <WhyControl open={open} onClick={onToggle} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, background: "var(--pf-n0)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTile icon="file" tone="blue" size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{LT118.kind} · {LT118.id}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{LT118.subject} · requested {LT118.requested}</div>
        </div>
        <WhyControl open={open} onClick={onToggle} />
      </div>
      <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, background: "var(--pf-n25)" }}>
        {LT118.draft}
      </div>
    </div>
  );
}

/* ------------------------------- audit rows -------------------------------- */

function AuditRow({ s, covered, expanded, onToggle, children }: {
  s: AiSurface; covered: boolean; expanded: boolean; onToggle: () => void; children: ReactNode;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: GRID_AUDIT, gap: 12, alignItems: "center",
          padding: "11px 20px", cursor: "pointer",
          background: expanded ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent",
          transition: "background .12s ease",
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: covered ? "var(--pf-n400)" : "var(--pf-red-500)" }}>{s.id}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.surface}</span>
        <span style={{ fontSize: 12.5, color: "var(--pf-n500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.output}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--pf-purple-500)" }}>{s.modelCard}</span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.where}</span>
        {covered
          ? <PfBadge tone="green" dot>Explained</PfBadge>
          : <PfBadge tone="red" dot>BLOCKER</PfBadge>}
        <span style={{ display: "inline-flex", transform: expanded ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}>
          <Ic name="caretright" size={13} color="var(--pf-n300)" />
        </span>
      </div>
      {expanded && <div style={{ padding: "0 20px 16px", background: "var(--pf-n25)" }}>{children}</div>}
    </div>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function AiSurfaces() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("audit");
  const [pillar, setPillar] = useState("All pillars");
  const [openRow, setOpenRow] = useState<string | null>("AS-04");
  /** The gate drill — force one surface uncovered and watch the release stop. */
  const [drill, setDrill] = useState<string | null>(null);
  const [demoId, setDemoId] = useState(DEMOS[0].id);
  const [why, setWhy] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>("MC-02");

  const isCovered = (s: AiSurface) => s.covered && s.id !== drill;
  const coveredNow = AI_SURFACES.filter(isCovered).length;
  const pct = Math.round((coveredNow / AI_SURFACES.length) * 100);
  const passes = pct === 100;
  const blocked = AI_SURFACES.filter((s) => !isCovered(s));

  const demo = DEMOS.find((d) => d.id === demoId) ?? DEMOS[0];
  const shown = pillar === "All pillars" ? AI_SURFACES : AI_SURFACES.filter((s) => s.pillar === pillar);
  const groups = PILLARS.filter((p) => shown.some((s) => s.pillar === p));

  const pickDemo = (label: string) => {
    const d = DEMOS.find((x) => x.label === label);
    if (!d) return;
    setDemoId(d.id);
    setWhy(false);
  };

  const openSurface = (s: AiSurface) => {
    toast(`Opening ${s.surface} — ${s.where.split(" → ")[0]} is where the affordance lives`);
    go(SURFACE_STAGE[s.id] ?? "command");
  };

  const showCard = (id: string) => {
    setOpenCard(id);
    setTab("cards");
    toast(`${id} · ${cardById(id).name} — purpose, inputs and the human gate`, "ai");
  };

  const toggleDrill = (id: string) => {
    if (drill === id) {
      setDrill(null);
      toast(`Gate drill cleared — audit back to ${AUDIT.total} of ${AUDIT.total}, release unblocked`, "success");
      return;
    }
    setDrill(id);
    const s = AI_SURFACES.find((x) => x.id === id)!;
    toast(`BUILD BLOCKER — ${s.id} ${s.surface} marked uncovered. ${s.output} would reach a user with no reasoning attached.`, "danger");
  };

  const exportAudit = () =>
    toast(
      `FR-093 audit exported — ${coveredNow} of ${AI_SURFACES.length} surfaces explained (${pct}%), ${MODEL_CARDS.length} model cards, ${PILLARS.length} pillars, one affordance`,
      passes ? "success" : "danger",
    );

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ---------------------------------- header --------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>AI surface audit</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, maxWidth: 780, lineHeight: 1.5 }}>
            Every AI output in the product, the reasoning attached to it and the model card behind it (FR-093).
            &ldquo;We have AI&rdquo; is a claim; this is the surface that proves it. The ship gate is 100%.
          </div>
        </div>
        <PfBtn variant="secondary" icon="download" onClick={exportAudit}>Export audit</PfBtn>
        <PfBtn variant="primary" icon="shield" onClick={() => { toast("Trust center — the buyer-facing twin of this audit, with the model-card index published"); go("trust"); }}>Trust center</PfBtn>
      </div>

      {/* ----------------------------------- KPIs ---------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="sparkle" tone={passes ? "green" : "red"} label="Surfaces explained" value={`${coveredNow}/${AI_SURFACES.length}`} unit="AI outputs" delta={passes ? "Gate met" : "Gate failed"} deltaTone={passes ? "green" : "red"} />
        <PfStat icon="robot" tone="purple" label="Model cards" value={MODEL_CARDS.length} unit="published" delta="Every surface links one" deltaTone="purple" />
        <PfStat icon="shield" tone="blue" label="Human gates" value={`${AI_SURFACES.length}/${AI_SURFACES.length}`} unit="named in the UI" delta="AI proposes only" deltaTone="blue" />
        <PfStat icon="treemap" tone="yellow" label="Pillars covered" value={PILLARS.length} unit="Recruit → Me" delta="One affordance" deltaTone="green" />
      </div>

      {/* -------------------------------- ship gate -------------------------------- */}
      <PfCard style={{ marginBottom: 4, borderColor: passes ? "var(--pf-primary-100)" : "var(--pf-red-100)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px", flexWrap: "wrap", background: passes ? "var(--pf-primary-50)" : "var(--pf-red-50)", borderBottom: "1px solid var(--pf-n50)" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12 }}>
            <PfTile icon={passes ? "check" : "warning"} tone={passes ? "green" : "red"} size={40} />
            <div>
              <div style={{ fontSize: 30, fontWeight: 700, color: passes ? "var(--pf-primary-600)" : "var(--pf-red-500)", letterSpacing: "-.6px", lineHeight: 1 }}>{pct}%</div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 4 }}>{coveredNow} of {AI_SURFACES.length} surfaces</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: passes ? "var(--pf-primary-600)" : "var(--pf-red-500)", letterSpacing: ".3px" }}>
                {passes ? "GATE PASSES — FR-093 SHIPS" : "BUILD BLOCKER — RELEASE HALTED"}
              </span>
              <PfBadge tone={passes ? "green" : "red"} dot>{passes ? "100% required · 100% met" : `${blocked.length} uncovered`}</PfBadge>
            </div>
            <div style={{ marginTop: 9 }}><PfProgress pct={pct} tone={passes ? "green" : "red"} height={9} /></div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 9, lineHeight: 1.5 }}>
              {passes ? (
                <>Every AI output the product renders carries a working &ldquo;Why this?&rdquo; that expands to its basis and names its model card. Nothing ships past this row unexplained.</>
              ) : (
                <>
                  <span style={{ fontWeight: 600, color: "var(--pf-red-500)" }}>{blocked.map((b) => `${b.id} ${b.surface}`).join(", ")}</span> would render an AI output with no reasoning attached.
                  This is a build blocker, not a warning — the gate is 100% and there is no partial pass.
                </>
              )}
            </div>
          </div>
          <div style={{ flex: "none" }}>
            {drill
              ? <PfBtn variant="primary" icon="check" onClick={() => toggleDrill(drill)}>Clear the drill</PfBtn>
              : <PfBtn variant="secondary" icon="flask" onClick={() => toggleDrill("AS-04")}>Run gate drill</PfBtn>}
          </div>
        </div>

        {/* per-pillar coverage */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
          {PILLARS.map((p, i) => {
            const all = AI_SURFACES.filter((s) => s.pillar === p);
            const ok = all.filter(isCovered).length;
            const full = ok === all.length;
            return (
              <button
                key={p}
                onClick={() => { setTab("audit"); setPillar(p); toast(`${p} — ${ok} of ${all.length} AI surfaces explained`); }}
                style={{ fontFamily: "inherit", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "13px 16px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <PfTile icon={PILLAR_META[p].icon} tone={PILLAR_META[p].tone} size={22} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{p}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: full ? "var(--pf-primary-600)" : "var(--pf-red-500)" }}>{ok}/{all.length}</span>
                </div>
                <div style={{ marginTop: 8 }}><PfProgress pct={(ok / all.length) * 100} tone={full ? "green" : "red"} height={5} /></div>
              </button>
            );
          })}
        </div>
      </PfCard>

      {/* ---------------------------------- tabs ----------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "audit", label: "Surface audit", count: String(AI_SURFACES.length) },
            { key: "pattern", label: "The Why-this pattern" },
            { key: "cards", label: "Model cards", count: String(MODEL_CARDS.length) },
          ]}
        />
      </div>

      {/* ================================== AUDIT ================================== */}
      {tab === "audit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="Every AI output, by pillar"
              sub="What the model says, which card governs it, and where the reader finds the reasoning. Open a row for the full entry."
            >
              <PfTabs tabs={["All pillars", ...PILLARS]} active={pillar} onChange={setPillar} />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: GRID_AUDIT, gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>ID</PfTh><PfTh>Surface</PfTh><PfTh>AI output</PfTh><PfTh>Card</PfTh>
              <PfTh>&ldquo;Why this?&rdquo; lives</PfTh><PfTh>Audit</PfTh><PfTh />
            </div>

            {groups.map((p) => {
              const rows = shown.filter((s) => s.pillar === p);
              const ok = rows.filter(isCovered).length;
              return (
                <div key={p}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
                    <PfTile icon={PILLAR_META[p].icon} tone={PILLAR_META[p].tone} size={24} />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{p}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{PILLAR_META[p].blurb}</span>
                    <PfBadge tone={ok === rows.length ? "green" : "red"}>{ok}/{rows.length} explained</PfBadge>
                  </div>

                  {rows.map((s) => {
                    const card = cardById(s.modelCard);
                    const cov = isCovered(s);
                    return (
                      <AuditRow
                        key={s.id}
                        s={s}
                        covered={cov}
                        expanded={openRow === s.id}
                        onToggle={() => setOpenRow(openRow === s.id ? null : s.id)}
                      >
                        <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, background: "var(--pf-n0)", padding: 14 }}>
                          {!cov && (
                            <div style={{ marginBottom: 12 }}>
                              <PfBanner tone="red" icon="warning">
                                <span style={{ fontWeight: 700 }}>Uncovered — the build fails here. </span>
                                <span style={{ fontWeight: 400 }}>{s.output} would render with no basis, no card and no named human gate.</span>
                              </PfBanner>
                            </div>
                          )}

                          <PfTh>What the user reads on {s.surface}</PfTh>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{SAMPLE_CLAIM[s.id]}</span>
                            {cov
                              ? <WhyControl open={false} onClick={() => { setTab("pattern"); toast(`The affordance on ${s.surface} is the same control shown here — ${s.where}`, "ai"); }} />
                              : <PfBadge tone="red">no affordance</PfBadge>}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginTop: 14 }}>
                            {[
                              ["Affordance location", s.where],
                              ["Governing card", `${card.id} · ${card.name}`],
                              ["Model inputs", card.inputs],
                              ["Human gate", card.humanGate],
                            ].map(([label, value]) => (
                              <div key={label} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "9px 11px" }}>
                                <PfTh>{label}</PfTh>
                                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.45 }}>{value}</div>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: "flex", gap: 8, marginTop: 13, flexWrap: "wrap" }}>
                            <PfBtn small variant="secondary" icon="arrowright" onClick={() => openSurface(s)}>Open {s.surface}</PfBtn>
                            <PfBtn small variant="secondary" icon="robot" onClick={() => showCard(s.modelCard)}>{card.id} model card</PfBtn>
                            <PfBtn small variant="ghost" icon="flask" onClick={() => toggleDrill(s.id)}>
                              {drill === s.id ? "Clear gate drill" : "Gate drill — mark uncovered"}
                            </PfBtn>
                          </div>
                        </div>
                      </AuditRow>
                    );
                  })}
                </div>
              );
            })}

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              The registry is the audit. A surface is added to AI_SURFACES when it is built, and the gate reads the registry — there is no separate spreadsheet to fall out of date.
            </div>
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            {[
              { icon: "shield", tone: "green" as PfTone, title: "No sanction, ever", body: `The query drafter (MC-06) writes dated facts and stops. ${CASE_AGG.modelNote}` },
              { icon: "pulse", tone: "yellow" as PfTone, title: "Signals are not findings", body: `Attendance says what it is and is not: “${ATT.note}”` },
              { icon: "treemap", tone: "blue" as PfTone, title: "Reporting, never input", body: `Nationality and host community are NCDMB reporting fields — read by the local-content report (${LOCAL.nigerianPct}% Nigerian, ${LOCAL.hostPct}% host community across ${LOCAL.total} in-scope workers) and by no model on this page.` },
            ].map((g) => (
              <PfCard key={g.title} pad={16}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <PfTile icon={g.icon} tone={g.tone} size={28} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{g.title}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 9, lineHeight: 1.55 }}>{g.body}</div>
              </PfCard>
            ))}
          </div>
        </div>
      )}

      {/* ================================= PATTERN ================================= */}
      {tab === "pattern" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            {/* live demonstration */}
            <PfCard>
              <PfCardHead title="The affordance, live" sub="Three real outputs from three pillars. One control. Click it.">
                <PfTabs tabs={DEMOS.map((d) => d.label)} active={demo.label} onChange={pickDemo} />
              </PfCardHead>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <PfBadge tone="grey">{demo.surfaceId}</PfBadge>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                    as it renders on {AI_SURFACES.find((s) => s.id === demo.surfaceId)!.surface}
                  </span>
                  <span style={{ flex: 1 }} />
                  <PfBadge tone={why ? "purple" : "grey"} dot>{why ? "Expanded" : "Collapsed"}</PfBadge>
                </div>

                <DemoOutput d={demo} open={why} onToggle={() => setWhy(!why)} />

                {why && (
                  <WhyPanel
                    w={demo}
                    onCard={() => showCard(demo.modelCard)}
                    onBasis={(line) => toast(`Basis opened — ${line}`, "ai")}
                    onFlag={() => toast(`Flagged for review — ${demo.label} on ${AI_SURFACES.find((s) => s.id === demo.surfaceId)!.surface}. Logged against ${demo.modelCard} for model feedback; the output stays visible until a human rules on it.`, "danger")}
                  />
                )}

                {!why && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 12, background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 8, padding: "10px 12px" }}>
                    <Ic name="info" size={13} color="var(--pf-n400)" />
                    <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                      Collapsed state: the claim and the control, nothing else. The affordance costs one chip of space and never hides the output behind a modal.
                    </span>
                  </div>
                )}
              </div>
            </PfCard>

            {/* the contract */}
            <PfCard>
              <PfCardHead title="The WhyThis contract" sub="One type, imported everywhere. Five fields, three of them required." />
              {CONTRACT.map((c, i) => (
                <div key={c.field} style={{ padding: "11px 20px", borderBottom: i === CONTRACT.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--pf-n900)" }}>{c.field}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--pf-n400)" }}>{c.type}</span>
                    <span style={{ flex: 1 }} />
                    <PfBadge tone={c.required ? "green" : "grey"}>{c.required ? "required" : "optional"}</PfBadge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.5 }}>{c.rule}</div>
                </div>
              ))}
              <div style={{ padding: "12px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
                <PfTh>The four rules</PfTh>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 7 }}>
                  {RULES.map((r, i) => (
                    <div key={r} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--pf-primary-600)", background: "var(--pf-primary-50)", borderRadius: 4, padding: "1px 5px", flex: "none", marginTop: 1 }}>R{i + 1}</span>
                      <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </PfCard>
          </div>

          {/* both states, annotated */}
          <PfCard>
            <PfCardHead title="Both states, side by side" sub="What a reviewer checks in a pull request: the collapsed control on the claim, and everything the expansion must carry." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
              <div style={{ padding: 20, borderRight: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <PfBadge tone="grey">State 1</PfBadge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Collapsed — the default</span>
                </div>
                <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: 14, background: "var(--pf-n25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <PfBadge tone="red" dot>Leave-risk {AMARA_RISK.score} · high</PfBadge>
                    <WhyControl open={false} onClick={() => { setWhy(true); setDemoId("D-risk"); toast("This is the same control the live demo above expands", "ai"); }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
                  {[
                    "Sits beside the claim, never in a menu, never on a separate page.",
                    "Same label everywhere: “Why this?”. Users learn it once.",
                    "Costs one chip. It does not push the output below the fold.",
                  ].map((t) => (
                    <div key={t} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                      <Ic name="check" size={12} color="var(--pf-primary-500)" />
                      <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <PfBadge tone="purple">State 2</PfBadge>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Expanded — inline, never a modal</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    ["01", "The claim, restated verbatim — so the reader knows what is being explained."],
                    ["02", "Numbered basis lines, each opening the record it came from."],
                    ["03", "Confidence with its meaning spelled out — or an explicit note that there is none."],
                    ["04", "The human gate: who decides, and what this output cannot do alone."],
                    ["05", "A link to the model card, and a way to say the output looks wrong."],
                  ].map(([n, t]) => (
                    <div key={n} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "8px 10px" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", borderRadius: 4, padding: "1px 5px", flex: "none", marginTop: 1 }}>{n}</span>
                      <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="Implementing it on a new surface" sub="Five steps. Step one is written before the feature, step five is enforced by the build.">
                <PfBtn small variant="secondary" icon="download" onClick={() => toast("Pattern spec copied — WhyThis type, the four rules and the five-step checklist")}>Copy spec</PfBtn>
              </PfCardHead>
              {CHECKLIST.map((c, i) => (
                <button
                  key={c.step}
                  onClick={() => toast(`Step ${i + 1} — ${c.step}: ${c.detail}`)}
                  style={{ fontFamily: "inherit", textAlign: "left", width: "100%", display: "flex", gap: 11, alignItems: "flex-start", padding: "12px 20px", background: "none", border: "none", borderBottom: i === CHECKLIST.length - 1 ? "none" : "1px solid var(--pf-n50)", cursor: "pointer" }}
                >
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--pf-primary-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.step}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--pf-n500)", marginTop: 3, lineHeight: 1.5 }}>{c.detail}</span>
                  </span>
                </button>
              ))}
            </PfCard>

            <PfCard>
              <PfCardHead title="Not this" sub="What an assistant layer renders when it does not own the lifecycle." />
              {BOLT_ON.map((b, i) => (
                <div key={b.bad} style={{ padding: "11px 20px", borderBottom: i === BOLT_ON.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Ic name="x" size={13} color="var(--pf-red-500)" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n400)", textDecoration: "line-through" }}>{b.bad}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.5, paddingLeft: 21 }}>{b.why}</div>
                </div>
              ))}
              <div style={{ padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                None of these are lazy copy. They are what you can honestly write when the records the reasoning would name live in someone else&rsquo;s system.
              </div>
            </PfCard>
          </div>
        </div>
      )}

      {/* ================================== CARDS ================================== */}
      {tab === "cards" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="purple" icon="robot" cta="audit" onCta={() => setTab("audit")}>
            <span style={{ fontWeight: 600 }}>{MODEL_CARDS.length} cards govern {AI_SURFACES.length} surfaces — </span>
            <span style={{ fontWeight: 400 }}>every &ldquo;Why this?&rdquo; panel in the product links into this index, and every card names a human who decides.</span>
          </PfBanner>

          {MODEL_CARDS.map((c) => {
            const uses = surfacesFor(c.id);
            const open = openCard === c.id;
            return (
              <PfCard key={c.id} style={open ? { borderColor: "var(--pf-purple-100)", boxShadow: "0 0 0 1px var(--pf-purple-100), 0 1px 3px 0 #f3f3f3" } : undefined}>
                <PfCardHead
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px" }}>{c.id}</span>
                      {c.name}
                    </span>
                  }
                  sub={c.purpose}
                >
                  <PfBadge tone="grey">{uses.length} {uses.length === 1 ? "surface" : "surfaces"}</PfBadge>
                  <PfBtn small variant="secondary" onClick={() => setOpenCard(open ? null : c.id)}>{open ? "Collapse" : "Expand"}</PfBtn>
                </PfCardHead>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
                  {[
                    { label: "Inputs", value: c.inputs, icon: "stack", tone: "blue" as PfTone },
                    { label: "Human gate", value: c.humanGate, icon: "shield", tone: "green" as PfTone },
                    { label: "Governed surface", value: c.surface, icon: "target", tone: "purple" as PfTone },
                  ].map((f, i) => (
                    <div key={f.label} style={{ padding: "14px 20px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <PfTile icon={f.icon} tone={f.tone} size={22} />
                        <PfTh>{f.label}</PfTh>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 7, lineHeight: 1.5 }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                {open && (
                  <div style={{ padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                    <PfTh>Surfaces that link into {c.id}</PfTh>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
                      {uses.map((s) => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "9px 11px", flexWrap: "wrap" }}>
                          <PfTile icon={PILLAR_META[s.pillar].icon} tone={PILLAR_META[s.pillar].tone} size={22} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.surface}</span>
                          <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1, minWidth: 120 }}>{s.where}</span>
                          {isCovered(s) ? <PfBadge tone="green" dot>Explained</PfBadge> : <PfBadge tone="red" dot>BLOCKER</PfBadge>}
                          <PfBtn small variant="ghost" icon="arrowright" onClick={() => openSurface(s)}>Open</PfBtn>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                      <PfBtn small variant="secondary" icon="sparkle" onClick={() => { setTab("pattern"); toast(`${c.id} governs the affordance pattern shown here — same five fields, same human gate`, "ai"); }}>See the pattern</PfBtn>
                      <PfBtn small variant="ghost" icon="shield" onClick={() => { toast(`${c.id} is published on the public trust page — buyers read it without a login`); go("trust"); }}>Published version</PfBtn>
                    </div>
                  </div>
                )}
              </PfCard>
            );
          })}

          <PfCard pad={16}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <PfTile icon="warning" tone="yellow" size={30} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>What never enters a card&rsquo;s inputs</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.6 }}>
                  Protected attributes, and the NCDMB local-content fields — nationality and host community. They are reporting fields:
                  the statutory report reads them ({LOCAL.nigerian} Nigerian and {LOCAL.expatriate} expatriate across {LOCAL.total} in-scope workers,
                  {" "}{LOCAL.hostCommunity} from host communities), and no model on this page does. Disciplinary outcomes reach the attrition
                  feature set as {CASE_AGG.open + CASE_AGG.closed} aggregate counts only — no narrative, no named subject, no sanction detail.
                </div>
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* ------------------------------- positioning ------------------------------- */}
      <PfCard style={{ marginTop: 12 }}>
        <PfCardHead
          title="What this page is actually arguing"
          sub="An AI-native lifecycle with governance, against an assistant layer bolted onto workflow tools."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
          <div style={{ padding: 20, borderRight: "1px solid var(--pf-n50)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PfTile icon="sparkle" tone="green" size={26} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--pf-n900)" }}>AI-native lifecycle with governance</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {[
                "The model reads records this product owns — reviews, clock events, bands, profiles — so it can name them.",
                "The explanation is built where the number is built, in the same call, as one typed value.",
                "Every claim carries its reasoning, its card and the human who decides. All twelve, no exceptions.",
                "The audit is the registry, and the registry gates the build at 100%.",
              ].map((t) => (
                <div key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Ic name="check" size={13} color="var(--pf-primary-500)" />
                  <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PfTile icon="robot" tone="grey" size={26} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--pf-n400)" }}>An assistant layer, bolted on</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {[
                "Sits above a workflow tool and reads whatever it is handed — usually text, rarely the lifecycle.",
                "The explanation is a second generation after the fact, guessing at the first.",
                "It can say what it thinks. It cannot say which record it read, because it does not hold the record.",
                "There is no gate, because there is no registry of what the assistant is allowed to claim.",
              ].map((t) => (
                <div key={t} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <Ic name="x" size={13} color="var(--pf-n300)" />
                  <span style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
          Stated plainly: every AI claim in this product carries its reasoning. A bolt-on cannot do that — not because it is built badly,
          but because the reasoning comes from a lifecycle it does not own. That is why the answer to &ldquo;we have AI too&rdquo; is a
          {" "}{AI_SURFACES.length}-row audit with a 100% gate, and not a louder claim.
        </div>
      </PfCard>
    </div>
  );
}
