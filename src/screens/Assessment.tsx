"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { personaById, type PersonaId } from "@/data/personas";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useAssessment } from "@/state/assessment";
import { CANDIDATES } from "@/data/people";
import {
  RAIL_NODES,
  STATUS_LABEL,
  TYPE_LABEL,
  VERDICT_TONE,
  approveBlockReason,
  canEditContent,
  canSend,
  canSubmitForReview,
  dimLabels,
  editBlockReason,
  railIndex,
  reviewReadiness,
  sendBlockReason,
  type Assessment,
  type AssessmentQuestion,
  type AssessmentStatus,
  type AssessmentType,
  type QuestionKind,
  type RubricDim,
  type Submission,
} from "@/data/assessment";

/**
 * Stage 05 · Assessment — the authoring end of ONE record.
 *
 * Two things this screen exists to make true:
 *  1. The assessment a recruiter SETS is the assessment a candidate TAKES.
 *     Every field here is the same object the player at /assessment-take
 *     renders; nothing on this page is a hardcoded illustration of a record.
 *  2. An AI-drafted artefact passes a NAMED human before any candidate sees it.
 *     "Send to shortlist" is gated on Ngozi Adeyemi's sign-off, at the exact
 *     version she signed — and the gate is enforced in the store, not here.
 */

/* ------------------------------------------------------------------ *
 * Small shared bits
 * ------------------------------------------------------------------ */

const STATUS_TONE: Record<AssessmentStatus, PfTone> = {
  drafted: "purple",
  editing: "grey",
  in_review: "yellow",
  changes_requested: "red",
  approved: "green",
  sent: "green",
};

const KIND_LABEL: Record<QuestionKind, string> = {
  longtext: "Written",
  upload: "Upload",
  video: "Video",
  mcq: "Multiple choice",
};

const TYPES: AssessmentType[] = ["take-home", "timed-test", "video-prompt"];

const RAIL_SUB: Record<string, string> = {
  drafted: "AI draft · recruiter-owned",
  review: "Named hiring manager decides",
  approved: "Signed off at a version",
  sent: "Dispatched & frozen",
};

/** The Stage-04 shortlist this brief would be dispatched to. */
const SHORTLIST: { name: string; init: string }[] = [
  ...CANDIDATES.slice(0, 5).map((c) => ({ name: c.name, init: c.init })),
  { name: "Chidinma Eke", init: "CE" },
];

const fieldBase: CSSProperties = {
  width: "100%",
  fontFamily: "inherit",
  fontSize: 13,
  color: "var(--pf-n900)",
  border: "1px solid var(--pf-n100)",
  borderRadius: 9,
  padding: "9px 11px",
  outline: "none",
};

function Lab({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--pf-n400)", marginBottom: 6 }}>
      {children}
    </div>
  );
}

const chipStyle = (active: boolean, locked: boolean, accent = "var(--pf-primary-500)", soft = "var(--pf-primary-50)", line = "var(--pf-primary-100)"): CSSProperties => ({
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  padding: "5px 11px",
  borderRadius: 7,
  cursor: locked ? "default" : "pointer",
  background: active ? soft : "var(--pf-n0)",
  color: active ? accent : "var(--pf-n500)",
  border: `1px solid ${active ? line : "var(--pf-n100)"}`,
  opacity: locked && !active ? 0.55 : 1,
  whiteSpace: "nowrap",
});

/** Text input / textarea that commits to the store on blur (each edit = a version). */
function TextField({
  value,
  onCommit,
  readOnly,
  rows,
  placeholder,
  style,
}: {
  value: string;
  onCommit: (v: string) => void;
  readOnly?: boolean;
  rows?: number;
  placeholder?: string;
  style?: CSSProperties;
}) {
  // Re-sync from the store when the record (or its version) changes — done in
  // render rather than an effect so there is never a stale frame.
  const [prev, setPrev] = useState(value);
  const [v, setV] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setV(value);
  }
  const commit = () => {
    if (v !== value) onCommit(v);
  };
  const shared: CSSProperties = {
    ...fieldBase,
    background: readOnly ? "var(--pf-n25)" : "var(--pf-n0)",
    color: readOnly ? "var(--pf-n500)" : "var(--pf-n900)",
    ...style,
  };
  if (rows) {
    return (
      <textarea
        value={v}
        rows={rows}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        style={{ ...shared, resize: "vertical", lineHeight: 1.6 }}
      />
    );
  }
  return (
    <input
      value={v}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      style={shared}
    />
  );
}

function NumberField({
  value,
  onCommit,
  readOnly,
  min = 1,
  max = 1440,
  width = 92,
}: {
  value: number;
  onCommit: (v: number) => void;
  readOnly?: boolean;
  min?: number;
  max?: number;
  width?: number;
}) {
  const [prev, setPrev] = useState(value);
  const [v, setV] = useState(String(value));
  if (prev !== value) {
    setPrev(value);
    setV(String(value));
  }
  const commit = () => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || !v.trim()) {
      setV(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, n));
    if (clamped !== value) onCommit(clamped);
    else setV(String(value));
  };
  return (
    <input
      inputMode="numeric"
      value={v}
      readOnly={readOnly}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      style={{
        ...fieldBase,
        width,
        fontFamily: "var(--mono)",
        background: readOnly ? "var(--pf-n25)" : "var(--pf-n0)",
        color: readOnly ? "var(--pf-n500)" : "var(--pf-n900)",
      }}
    />
  );
}

/**
 * A control that is natively disabled when the rule says no — and whose wrapper
 * catches the eager click so the user gets a spoken reason (and the store gets a
 * logged refusal) instead of silence.
 */
function GateBtn({
  children,
  reason,
  onRun,
  onBlocked,
  variant = "secondary",
  tone,
}: {
  children: ReactNode;
  reason: string | null;
  onRun: () => void;
  onBlocked: () => void;
  variant?: "primary" | "secondary" | "danger";
  tone?: string;
}) {
  const blocked = reason !== null;
  const skin: Record<string, CSSProperties> = {
    primary: { background: tone ?? "var(--pf-primary-500)", color: "#fff", border: "1px solid transparent" },
    secondary: { background: "var(--pf-n0)", color: "var(--pf-n600)", border: "1px solid var(--pf-n100)" },
    danger: { background: "var(--pf-red-500)", color: "#fff", border: "1px solid transparent" },
  };
  return (
    <div onClick={blocked ? onBlocked : undefined} style={{ display: "inline-flex", cursor: blocked ? "not-allowed" : "default" }}>
      <button
        disabled={blocked}
        onClick={blocked ? undefined : onRun}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 500,
          padding: "7px 12px",
          borderRadius: 8,
          whiteSpace: "nowrap",
          ...skin[variant],
          opacity: blocked ? 0.45 : 1,
          cursor: blocked ? "not-allowed" : "pointer",
          pointerEvents: blocked ? "none" : "auto",
        }}
      >
        {children}
      </button>
    </div>
  );
}

function BlockLine({ text, tone = "red" }: { text: string; tone?: "red" | "amber" }) {
  const fg = tone === "red" ? "var(--pf-red-500)" : "var(--pf-yellow-500)";
  const bg = tone === "red" ? "var(--pf-red-50)" : "var(--pf-yellow-50)";
  const line = tone === "red" ? "var(--pf-red-100)" : "var(--pf-yellow-100)";
  return (
    <div style={{ display: "flex", gap: 7, alignItems: "flex-start", background: bg, border: `1px solid ${line}`, borderRadius: 9, padding: "9px 11px", marginTop: 9 }}>
      <span style={{ flex: "none", marginTop: 1 }}>
        <Ic name="warning" size={14} color={fg} />
      </span>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: fg, fontWeight: 500 }}>{text}</span>
    </div>
  );
}

function statusBadge(a: Assessment) {
  switch (a.status) {
    case "drafted":
      return <PfBadge tone="purple">✦ AI DRAFTED</PfBadge>;
    case "editing":
      return <PfBadge tone="grey">Draft · v{a.version}</PfBadge>;
    case "in_review":
      return <PfBadge tone="yellow" dot>Pending Approval</PfBadge>;
    case "changes_requested":
      return <PfBadge tone="red" dot>Changes requested</PfBadge>;
    case "approved":
      return (
        <PfBadge tone={a.approval.approvedVersion === a.version ? "green" : "yellow"} dot>
          Approved by {a.approval.reviewer.name} · v{a.approval.approvedVersion}
        </PfBadge>
      );
    default:
      return <PfBadge tone="green" dot>Sent · {a.dispatch?.recipients.length ?? 0} candidates</PfBadge>;
  }
}

/* ------------------------------------------------------------------ *
 * Status rail — the Requisitions treatment, four nodes
 * ------------------------------------------------------------------ */

function Rail({ a }: { a: Assessment }) {
  const idx = railIndex(a.status);
  const sentBack = a.status === "changes_requested";
  return (
    <PfCard style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, padding: "14px 16px" }}>
        {RAIL_NODES.map((n, i) => {
          const done = i < idx;
          const now = i === idx;
          const red = sentBack && now;
          const accent = red ? "var(--pf-red-500)" : "var(--pf-primary-500)";
          return (
            <div
              key={n.key}
              style={{
                flex: 1,
                border: `1px solid ${now ? accent : done ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                background: now ? (red ? "var(--pf-red-50)" : "var(--pf-primary-50)") : "var(--pf-n0)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: now ? (red ? "var(--pf-red-500)" : "var(--pf-primary-600)") : done ? "var(--pf-primary-600)" : "var(--pf-n400)" }}>
                {done ? (
                  <Ic name="check" size={12} weight={2.4} color="var(--pf-primary-500)" />
                ) : now ? (
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
                ) : null}
                {red ? "Changes requested" : n.label}
                {now && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".4px", marginLeft: 2 }}>· NOW</span>}
              </div>
              <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>
                {red ? `Sent back by ${a.approval.reviewer.name}` : RAIL_SUB[n.key]}
              </div>
            </div>
          );
        })}
      </div>
    </PfCard>
  );
}

/* ------------------------------------------------------------------ *
 * Brief & questions — the editable record
 * ------------------------------------------------------------------ */

function DimChips({
  a,
  q,
  editable,
  onToggle,
}: {
  a: Assessment;
  q: AssessmentQuestion;
  editable: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {a.rubric.map((d) => {
        const on = q.dimKeys.includes(d.key);
        return (
          <button
            key={d.key}
            disabled={!editable}
            onClick={() => onToggle(d.key)}
            style={chipStyle(on, !editable, "var(--pf-purple-500)", "var(--pf-purple-50)", "var(--pf-purple-100)")}
          >
            {on ? "✓ " : ""}
            {d.dim} · {d.weight}%
          </button>
        );
      })}
    </div>
  );
}

function QuestionEditor({
  a,
  q,
  idx,
  editable,
  actor,
  persona,
}: {
  a: Assessment;
  q: AssessmentQuestion;
  idx: number;
  editable: boolean;
  actor: string;
  persona: PersonaId;
}) {
  const { updateQuestion, removeQuestion } = useAssessment();
  const toast = useToast();
  const patch = (p: Partial<Omit<AssessmentQuestion, "id">>) => updateQuestion(a.id, q.id, p, actor, persona);

  return (
    <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "14px 16px", background: "var(--pf-n0)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 700, color: "var(--pf-primary-600)", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", padding: "2px 7px", borderRadius: 6 }}>
          {q.id} · {idx + 1} OF {a.questions.length}
        </span>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => (
            <button key={k} disabled={!editable} onClick={() => patch({ kind: k })} style={chipStyle(q.kind === k, !editable)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {editable && a.questions.length > 1 && (
          <button
            onClick={() => {
              removeQuestion(a.id, q.id, actor, persona);
              toast(`${q.id} removed — brief now at a new version, approval reset`, "default");
            }}
            style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, color: "var(--pf-red-500)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 7, padding: "4px 9px", cursor: "pointer" }}
          >
            Remove
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <Lab>KICKER</Lab>
          <TextField value={q.kicker} readOnly={!editable} onCommit={(v) => patch({ kicker: v.toUpperCase() })} />
        </div>
        <div>
          <Lab>QUESTION TITLE</Lab>
          <TextField value={q.title} readOnly={!editable} onCommit={(v) => patch({ title: v })} />
        </div>
      </div>

      <Lab>PROMPT — WHAT THE CANDIDATE READS</Lab>
      <TextField value={q.prompt} rows={3} readOnly={!editable} onCommit={(v) => patch({ prompt: v })} placeholder="Write the prompt exactly as the candidate should see it." />

      {/* Kind-specific settings — these drive the player's question body. */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
        {q.kind === "longtext" && (
          <div>
            <Lab>MINIMUM WORDS</Lab>
            <NumberField value={q.minWords ?? 100} readOnly={!editable} min={0} max={2000} onCommit={(n) => patch({ minWords: n })} />
          </div>
        )}
        {q.kind === "upload" && (
          <div style={{ flex: 1, minWidth: 220 }}>
            <Lab>ACCEPTED FORMATS</Lab>
            <TextField value={q.accept ?? ""} readOnly={!editable} onCommit={(v) => patch({ accept: v })} placeholder="Figma link, PDF or PNG" />
          </div>
        )}
        {q.kind === "video" && (
          <div>
            <Lab>MAX MINUTES</Lab>
            <NumberField value={q.maxMinutes ?? 2} readOnly={!editable} min={1} max={30} onCommit={(n) => patch({ maxMinutes: n })} />
          </div>
        )}
        <div>
          <Lab>REQUIRED</Lab>
          <button disabled={!editable} onClick={() => patch({ required: !q.required })} style={chipStyle(q.required, !editable)}>
            {q.required ? "✓ Required" : "Optional"}
          </button>
        </div>
      </div>

      {q.kind === "mcq" && (
        <div style={{ marginTop: 12 }}>
          <Lab>OPTIONS · SELECT THE ANSWER KEY</Lab>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(q.options ?? []).map((opt, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <button
                  disabled={!editable}
                  onClick={() => patch({ answerKey: i })}
                  title="Mark as the correct answer"
                  style={{
                    width: 18,
                    height: 18,
                    flex: "none",
                    borderRadius: "50%",
                    border: `1.5px solid ${q.answerKey === i ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
                    background: q.answerKey === i ? "var(--pf-primary-500)" : "var(--pf-n0)",
                    cursor: editable ? "pointer" : "default",
                  }}
                />
                <TextField
                  value={opt}
                  readOnly={!editable}
                  onCommit={(v) => patch({ options: (q.options ?? []).map((o, j) => (j === i ? v : o)) })}
                />
                {editable && (q.options?.length ?? 0) > 2 && (
                  <button
                    onClick={() =>
                      patch({
                        options: (q.options ?? []).filter((_, j) => j !== i),
                        answerKey: Math.min(q.answerKey ?? 0, (q.options?.length ?? 1) - 2),
                      })
                    }
                    style={{ fontFamily: "inherit", fontSize: 11, color: "var(--pf-n400)", background: "none", border: "none", cursor: "pointer" }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <button
              onClick={() => patch({ options: [...(q.options ?? []), ""] })}
              style={{ marginTop: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
            >
              + Add option
            </button>
          )}
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.5 }}>
            The answer key is stripped by <span style={{ fontFamily: "var(--mono)" }}>toCandidateView()</span> — it never reaches the player.
          </div>
        </div>
      )}

      <div style={{ marginTop: 13, paddingTop: 12, borderTop: "1px solid var(--pf-n50)" }}>
        <Lab>SCORED ON · STAGE-02 RUBRIC DIMENSIONS</Lab>
        <DimChips
          a={a}
          q={q}
          editable={editable}
          onToggle={(key) =>
            patch({ dimKeys: q.dimKeys.includes(key) ? q.dimKeys.filter((k) => k !== key) : [...q.dimKeys, key] })
          }
        />
        {q.dimKeys.length === 0 && (
          <div style={{ fontSize: 11.5, color: "var(--pf-red-500)", fontWeight: 500, marginTop: 7 }}>
            Unmapped — {a.approval.reviewer.name} can&apos;t judge a question that scores nothing.
          </div>
        )}
      </div>
    </div>
  );
}

function BriefTab({
  a,
  persona,
  actor,
  onGoApproval,
}: {
  a: Assessment;
  persona: PersonaId;
  actor: string;
  onGoApproval: () => void;
}) {
  const { updateDraft, addQuestion, regenerate, submissionsFor } = useAssessment();
  const toast = useToast();
  const go = useGo();
  const editable = canEditContent(a, persona);
  const lock = editBlockReason(a, persona);
  const patch = (p: Parameters<typeof updateDraft>[1]) => updateDraft(a.id, p, actor, persona);
  const done = submissionsFor(a.id).length;
  const policy = a.provenance.orgPolicy;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {persona === "manager" && a.status === "in_review" && (
          <PfCard pad={"12px 16px"} style={{ background: "var(--pf-yellow-50)", borderColor: "var(--pf-yellow-100)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <Ic name="shield" size={16} color="var(--pf-yellow-500)" />
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--pf-yellow-500)" }}>Your decision is outstanding</b> — {a.approval.submittedBy} submitted v{a.version} on {a.approval.submittedAt}.
              </div>
              <PfBtn small variant="primary" onClick={onGoApproval}>Review &amp; decide →</PfBtn>
            </div>
          </PfCard>
        )}

        {lock && (
          <PfCard pad={"11px 15px"} style={{ background: "var(--pf-n25)", borderColor: "var(--pf-n100)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <Ic name="shield" size={15} color="var(--pf-n400)" />
              <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{lock}</div>
            </div>
          </PfCard>
        )}

        <PfCard>
          <PfCardHead
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Ic name="sparkle" size={15} color="var(--pf-purple-500)" /> The brief
              </span>
            }
            sub={editable ? "AI drafted it. You own it — every edit is versioned and resets the approval." : "Read-only"}
          >
            {statusBadge(a)}
          </PfCardHead>
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Lab>TITLE</Lab>
              <TextField value={a.title} readOnly={!editable} onCommit={(v) => patch({ title: v })} />
            </div>

            <div>
              <Lab>FORMAT</Lab>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TYPES.map((t) => (
                  <button key={t} disabled={!editable} onClick={() => patch({ type: t })} style={chipStyle(a.type === t, !editable)}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div>
                <Lab>DURATION (MIN)</Lab>
                <NumberField value={a.durationMins} readOnly={!editable} onCommit={(n) => patch({ durationMins: n })} />
              </div>
              {a.type === "take-home" && (
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Lab>SUBMISSION WINDOW</Lab>
                  <TextField value={a.window ?? ""} readOnly={!editable} onCommit={(v) => patch({ window: v })} placeholder="e.g. 3 days" />
                </div>
              )}
            </div>

            <div>
              <Lab>BRIEF — THE PROSE THE CANDIDATE READS</Lab>
              <TextField value={a.brief} rows={5} readOnly={!editable} onCommit={(v) => patch({ brief: v })} />
            </div>

            <div>
              <Lab>DELIVERABLES</Lab>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {a.deliverables.map((d, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr auto", gap: 8, alignItems: "center" }}>
                    <TextField
                      value={d.label}
                      readOnly={!editable}
                      onCommit={(v) => patch({ deliverables: a.deliverables.map((x, j) => (j === i ? { ...x, label: v } : x)) })}
                    />
                    <TextField
                      value={d.detail}
                      readOnly={!editable}
                      onCommit={(v) => patch({ deliverables: a.deliverables.map((x, j) => (j === i ? { ...x, detail: v } : x)) })}
                    />
                    {editable ? (
                      <button
                        onClick={() => patch({ deliverables: a.deliverables.filter((_, j) => j !== i) })}
                        style={{ fontFamily: "inherit", fontSize: 11, color: "var(--pf-n400)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
                      >
                        ✕
                      </button>
                    ) : (
                      <span style={{ width: 18 }} />
                    )}
                  </div>
                ))}
              </div>
              {editable && (
                <button
                  onClick={() => patch({ deliverables: [...a.deliverables, { label: "New deliverable", detail: "" }] })}
                  style={{ marginTop: 8, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
                >
                  + Add deliverable
                </button>
              )}
            </div>
          </div>
        </PfCard>

        <PfCard>
          <PfCardHead title="Questions" sub="This exact list is what the candidate's player renders — there is no second copy.">
            <PfBadge tone="grey">{a.questions.length} question{a.questions.length === 1 ? "" : "s"}</PfBadge>
          </PfCardHead>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {a.questions.map((q, i) => (
              <QuestionEditor key={q.id} a={a} q={q} idx={i} editable={editable} actor={actor} persona={persona} />
            ))}
            {a.questions.length === 0 && (
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", padding: "10px 2px" }}>
                No questions yet — a brief with nothing to answer can&apos;t be submitted for review.
              </div>
            )}
            {editable && (
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", paddingTop: 2 }}>
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>ADD QUESTION</span>
                {(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      addQuestion(a.id, k, actor, persona);
                      toast(`${KIND_LABEL[k]} question added — map it to the rubric before submitting`, "default");
                    }}
                    style={chipStyle(false, false)}
                  >
                    + {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </PfCard>

        {persona === "hr" && (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>AI CONTROLS</span>
              <GateBtn
                reason={lock}
                variant="primary"
                tone="var(--pf-purple-500)"
                onRun={() => {
                  regenerate(a.id, actor, persona);
                  toast("Regenerated from the Stage-02 must-haves — your edits were discarded", "ai");
                }}
                onBlocked={() => {
                  regenerate(a.id, actor, persona);
                  toast(lock ?? "Not permitted", "danger");
                }}
              >
                ✦ Regenerate with AI
              </GateBtn>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Discards your edits and returns the AI draft.</span>
            </div>
            {lock && <BlockLine text={lock} tone="amber" />}
          </div>
        )}
      </div>

      {/* ------------------------- right column ------------------------- */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PfCard>
          <PfCardHead title="Rubric" sub="Inherited from Stage 02 — not authored here">
            <PfBadge tone="purple">RUBRIC {a.provenance.rubricVersion}</PfBadge>
          </PfCardHead>
          <div style={{ padding: "12px 20px 8px" }}>
            {a.rubric.map((d: RubricDim) => (
              <div key={d.key} style={{ padding: "8px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{d.dim}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", padding: "2px 8px", borderRadius: 5 }}>
                    {d.weight}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>from &ldquo;{d.fromMustHave}&rdquo;</div>
              </div>
            ))}
          </div>
          <div style={{ padding: "4px 20px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <PfBtn small icon="arrowsq" onClick={() => go("role")}>View scorecard →</PfBtn>
            <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Weights are Stage 02&apos;s. Read-only here.</span>
          </div>
        </PfCard>

        <PfCard>
          <PfCardHead title="Provenance" sub="Where this brief came from" divider />
          <div style={{ padding: "12px 20px 16px" }}>
            <Lab>GENERATED FROM MUST-HAVES</Lab>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {a.provenance.mustHaves.map((m) => (
                <span key={m} style={{ fontSize: 11.5, fontWeight: 500, background: "var(--pf-primary-50)", color: "var(--pf-primary-600)", border: "1px solid var(--pf-primary-100)", padding: "3px 9px", borderRadius: 5 }}>
                  {m}
                </span>
              ))}
            </div>
            {[
              ["Record", `${a.id} · ${a.roleTitle}`],
              ["Model", a.provenance.model],
              ["Drafted", a.provenance.generatedAt],
              ["Version", `v${a.version}`],
              ["Review round", String(a.approval.round)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ color: "var(--pf-n400)" }}>{k}</span>
                <span style={{ fontWeight: 500, color: "var(--pf-n900)" }}>{v}</span>
              </div>
            ))}
          </div>
        </PfCard>

        <PfCard>
          <PfCardHead title="Org policy" sub="Set in Admin → Assessment Config" />
          <div style={{ padding: "12px 20px 16px", opacity: 0.75 }}>
            {[
              ["Default duration", `${policy.defaultDurationMins} min`],
              ["Proctoring", policy.proctoring ? "On" : "Off"],
              ["Plagiarism detection", policy.plagiarism ? "On" : "Off"],
              ["Email notifications", policy.notifyByEmail ? "On" : "Off"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ color: "var(--pf-n400)" }}>{k}</span>
                <span style={{ fontWeight: 500, color: "var(--pf-n500)" }}>{v}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 8 }}>
              Platform policy, mirrored read-only. Stage 05 references it and never writes to it.
            </div>
          </div>
        </PfCard>

        <PfCard>
          <PfCardHead title="Dispatch" sub={a.dispatch ? `Sent ${a.dispatch.sentAt}` : "Not yet sent"} />
          <div style={{ padding: "12px 20px 16px" }}>
            {a.dispatch ? (
              [
                ["Sent to shortlist", String(a.dispatch.recipients.length)],
                ["Completed", String(done)],
                ["Due", a.dispatch.dueAt],
                ["Sent by", a.dispatch.sentBy],
                ["Approval", a.dispatch.approvalRef],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 12.5, borderBottom: "1px solid var(--pf-n50)" }}>
                  <span style={{ color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{k}</span>
                  <span style={{ fontWeight: 500, color: "var(--pf-n900)", textAlign: "right" }}>{v}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                Not yet sent — {a.status === "approved" ? "approved and ready to dispatch." : "awaiting hiring-manager approval."} No candidate can reach this brief until it is.
              </div>
            )}
          </div>
        </PfCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Approval — the gate
 * ------------------------------------------------------------------ */

function LedgerRow({ a }: { a: Assessment }) {
  const r = a.approval.reviewer;
  const stale = a.status === "approved" && a.approval.approvedVersion !== a.version;
  const badge: { tone: PfTone; label: string } =
    a.status === "in_review"
      ? { tone: "yellow", label: "Awaiting" }
      : a.status === "changes_requested"
        ? { tone: "red", label: "Changes requested" }
        : stale
          ? { tone: "yellow", label: `Signed v${a.approval.approvedVersion} · stale` }
          : a.status === "approved" || a.status === "sent"
            ? { tone: "green", label: "Signed" }
            : { tone: "grey", label: "—" };

  const sub =
    a.status === "in_review"
      ? `${a.approval.submittedBy} submitted v${a.version} · ${a.approval.submittedAt}`
      : a.approval.decidedAt
        ? `Hiring manager · decided ${a.approval.decidedAt}`
        : "Hiring manager · nothing submitted yet";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", flex: "none" }}>
        {r.init}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{sub}</div>
      </div>
      <PfBadge tone={badge.tone}>{badge.label}</PfBadge>
    </div>
  );
}

function ReviewQuestionList({ a }: { a: Assessment }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {a.questions.map((q, i) => (
        <div key={q.id} style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "var(--pf-n400)" }}>
              {q.kicker} · {i + 1} OF {a.questions.length}
            </span>
            <PfBadge tone="grey">{KIND_LABEL[q.kind]}</PfBadge>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 4 }}>{q.title}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55, marginBottom: 8 }}>{q.prompt}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {dimLabels(a.rubric, q.dimKeys).map((l) => (
              <span key={l} style={{ fontSize: 11, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", padding: "2px 8px", borderRadius: 5 }}>
                {l}
              </span>
            ))}
            {q.dimKeys.length === 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--pf-red-500)" }}>Scores nothing on the rubric</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalTab({ a, persona, actor }: { a: Assessment; persona: PersonaId; actor: string }) {
  const { submitForReview, withdrawReview, decide, reopen, revokeApproval, send, auditFor } = useAssessment();
  const toast = useToast();
  const [comment, setComment] = useState("");
  const [picked, setPicked] = useState<string[]>(SHORTLIST.map((r) => r.name));

  const isReviewer = persona === a.approval.reviewer.personaId;
  const isAuthor = persona === "hr";
  const log = auditFor(a.title);

  const recipients = SHORTLIST.filter((r) => picked.includes(r.name));

  /* ---- the gate, quoted from the shared predicates ---- */
  const sendReason = canSend(a, persona, recipients) ? null : (sendBlockReason(a, persona, recipients) ?? "Not permitted.");
  const submitReason = canSubmitForReview(a, persona)
    ? null
    : !isAuthor
      ? "Only the recruiter who owns this requisition can submit it for review."
      : a.status !== "drafted" && a.status !== "editing"
        ? `Nothing to submit — this brief is ${STATUS_LABEL[a.status].toLowerCase()}.`
        : (reviewReadiness(a).reason ?? "Not ready for review.");
  const decideReason = approveBlockReason(a, persona, actor);
  const changesReason = decideReason ?? (comment.trim() ? null : "Write what needs to change — a rejection without a reason isn't reviewable.");
  const revokeReason =
    !isReviewer
      ? `Only ${a.approval.reviewer.name} can revoke her own approval.`
      : a.status !== "approved"
        ? "There is no live approval to revoke."
        : comment.trim()
          ? null
          : "Say why you're pulling the approval — it goes on the record.";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* The reviewer's own decision surface — rendered ONLY for the named approver. */}
        {isReviewer && (
          <PfCard>
            <PfCardHead
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Ic name="shield" size={15} color="var(--pf-primary-500)" /> Your decision
                </span>
              }
              sub={
                a.status === "in_review"
                  ? `${a.approval.submittedBy} submitted v${a.version} on ${a.approval.submittedAt}`
                  : "Nothing to review — the recruiter hasn't submitted this yet."
              }
            >
              <PfBadge tone="yellow">ROUND {a.approval.round}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6, marginBottom: 14 }}>
                You&apos;re judging whether these questions actually test the must-haves, at the weights Stage 02 set. Nothing reaches a candidate until you say so.
              </div>
              <ReviewQuestionList a={a} />

              <div style={{ marginTop: 16 }}>
                <Lab>COMMENT {a.status === "approved" ? "· REQUIRED TO REVOKE" : "· REQUIRED TO REQUEST CHANGES"}</Lab>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="e.g. Q2 doesn't actually test systems thinking — it rewards visual polish."
                  style={{ ...fieldBase, background: "var(--pf-n0)", resize: "vertical", lineHeight: 1.6 }}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                {a.status === "approved" ? (
                  <GateBtn
                    variant="danger"
                    reason={revokeReason}
                    onRun={() => {
                      revokeApproval(a.id, comment, actor, persona);
                      setComment("");
                      toast("Approval revoked — the recruiter can no longer dispatch", "danger");
                    }}
                    onBlocked={() => {
                      revokeApproval(a.id, comment, actor, persona);
                      toast(revokeReason ?? "Not permitted", "danger");
                    }}
                  >
                    Revoke approval
                  </GateBtn>
                ) : (
                  <>
                    <GateBtn
                      variant="primary"
                      reason={decideReason}
                      onRun={() => {
                        decide(a.id, "approved", comment, actor, persona);
                        setComment("");
                        toast(`Approved v${a.version} — the recruiter can now dispatch`, "success");
                      }}
                      onBlocked={() => {
                        decide(a.id, "approved", comment, actor, persona);
                        toast(decideReason ?? "Not permitted", "danger");
                      }}
                    >
                      Approve brief
                    </GateBtn>
                    <GateBtn
                      variant="danger"
                      reason={changesReason}
                      onRun={() => {
                        decide(a.id, "changes_requested", comment, actor, persona);
                        setComment("");
                        toast("Sent back to the recruiter with your comment", "danger");
                      }}
                      onBlocked={() => {
                        decide(a.id, "changes_requested", comment, actor, persona);
                        toast(changesReason ?? "Not permitted", "danger");
                      }}
                    >
                      Request changes
                    </GateBtn>
                  </>
                )}
              </div>
              {(a.status === "approved" ? revokeReason : (decideReason ?? changesReason)) && (
                <BlockLine text={(a.status === "approved" ? revokeReason : (decideReason ?? changesReason)) as string} tone={decideReason || a.status === "approved" ? "amber" : "red"} />
              )}
              <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 10, lineHeight: 1.5 }}>
                An approval is bound to v{a.version}. If the recruiter edits the brief afterwards it is invalidated and comes back to you.
              </div>
            </div>
          </PfCard>
        )}

        {/* Feedback, verbatim, wherever it's the live state. */}
        {a.status === "changes_requested" && a.approval.comment && (
          <PfCard pad={"14px 16px"} style={{ background: "var(--pf-red-50)", borderColor: "var(--pf-red-100)" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Ic name="warning" size={16} color="var(--pf-red-500)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--pf-red-500)", marginBottom: 5 }}>
                  CHANGES REQUESTED · {a.approval.reviewer.name.toUpperCase()} · {a.approval.decidedAt}
                </div>
                <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.6, fontStyle: "italic" }}>
                  &ldquo;{a.approval.comment}&rdquo;
                </div>
              </div>
            </div>
          </PfCard>
        )}

        {/* The recruiter's transitions + the dispatch gate. */}
        <PfCard>
          <PfCardHead title="Approval status" sub="Every transition is logged with actor & timestamp">
            {statusBadge(a)}
          </PfCardHead>
          <div style={{ padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>AVAILABLE TRANSITIONS</span>

              {isAuthor && (a.status === "drafted" || a.status === "editing") && (
                <GateBtn
                  variant="primary"
                  reason={submitReason}
                  onRun={() => {
                    submitForReview(a.id, actor, persona);
                    toast(`Submitted for review — ${a.approval.reviewer.name} notified`, "success");
                  }}
                  onBlocked={() => {
                    submitForReview(a.id, actor, persona);
                    toast(submitReason ?? "Not permitted", "danger");
                  }}
                >
                  Submit for hiring-manager review
                </GateBtn>
              )}

              {isAuthor && a.status === "in_review" && (
                <PfBtn
                  small
                  onClick={() => {
                    withdrawReview(a.id, actor, persona);
                    toast("Submission withdrawn — the brief is yours to edit again", "default");
                  }}
                >
                  Withdraw submission
                </PfBtn>
              )}

              {isAuthor && a.status === "changes_requested" && (
                <PfBtn
                  small
                  variant="primary"
                  onClick={() => {
                    reopen(a.id, actor, persona);
                    toast(`Reopened — review round ${a.approval.round + 1}`, "default");
                  }}
                >
                  Reopen &amp; address feedback
                </PfBtn>
              )}

              {!isAuthor && !isReviewer && (
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                  You&apos;re not the named reviewer on this requisition.
                </span>
              )}
              {isReviewer && (
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                  Dispatch belongs to the recruiter — your decision is above.
                </span>
              )}
            </div>

            {isAuthor && submitReason && (a.status === "drafted" || a.status === "editing") && <BlockLine text={submitReason} tone="amber" />}

            {/* Send to shortlist — three layers: disabled, intercepted, refused. */}
            {isAuthor && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--pf-n50)" }}>
                <Lab>DISPATCH</Lab>
                {a.dispatch ? (
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6, marginBottom: 10 }}>
                    Sent {a.dispatch.sentAt} to {a.dispatch.recipients.length} candidates by {a.dispatch.sentBy}. Proof of approval stamped at dispatch:{" "}
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n900)" }}>{a.dispatch.approvalRef}</span>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginBottom: 8 }}>
                      Shortlist · {recipients.length} of {SHORTLIST.length} selected
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                      {SHORTLIST.map((r) => {
                        const on = picked.includes(r.name);
                        return (
                          <button
                            key={r.name}
                            onClick={() => setPicked((p) => (on ? p.filter((n) => n !== r.name) : [...p, r.name]))}
                            style={chipStyle(on, false)}
                          >
                            {on ? "✓ " : ""}
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <GateBtn
                    variant="primary"
                    reason={sendReason}
                    onRun={() => {
                      send(a.id, recipients, actor, persona);
                      toast(`Sent to ${recipients.length} shortlisted candidates · approval on record`, "success");
                    }}
                    onBlocked={() => {
                      // The store re-runs canSend() and refuses, logging the attempt.
                      send(a.id, recipients, actor, persona);
                      toast(sendReason ?? "Not permitted", "danger");
                    }}
                  >
                    Send to shortlist{a.dispatch ? "" : ` (${recipients.length})`}
                  </GateBtn>
                  {!sendReason && (
                    <span style={{ fontSize: 11.5, color: "var(--pf-primary-600)", fontWeight: 500 }}>
                      Approved by {a.approval.reviewer.name} at v{a.approval.approvedVersion} — cleared to dispatch.
                    </span>
                  )}
                </div>
                {sendReason && <BlockLine text={sendReason} />}

                {/* No self-approve control is rendered for the author at all. */}
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 12, lineHeight: 1.55, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "9px 11px" }}>
                  Only {a.approval.reviewer.name} ({a.approval.reviewer.title}) can approve this brief. You cannot approve your own draft.
                </div>
              </div>
            )}
          </div>
        </PfCard>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <PfCard>
          <PfCardHead title="Sign-off required" sub="An AI-drafted test passes a named human first" />
          <div style={{ padding: "14px 20px 16px" }}>
            <LedgerRow a={a} />
          </div>
        </PfCard>

        <PfCard pad={"12px 16px"} style={{ background: "var(--pf-purple-50)", borderColor: "var(--pf-purple-100)" }}>
          <div style={{ display: "flex", gap: 9 }}>
            <Ic name="shield" size={15} color="var(--pf-purple-500)" />
            <div style={{ fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>
              <b style={{ color: "var(--pf-purple-500)" }}>AI drafts, humans decide</b> — the brief is generated, but no candidate sees it until {a.approval.reviewer.name} signs off on the exact version being sent.
            </div>
          </div>
        </PfCard>

        {log.length > 0 && (
          <PfCard pad={"12px 16px"}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 8 }}>TRANSITION LOG</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {log.slice(0, 9).map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: e.action.startsWith("send blocked") || e.action.includes("blocked") || e.action.includes("refused") ? "var(--pf-red-500)" : "var(--pf-primary-500)", marginTop: 5, flex: "none" }} />
                  <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--pf-n500)" }}>
                    <b style={{ color: "var(--pf-n900)" }}>{e.actor}</b> {e.action}
                    <span style={{ color: "var(--pf-n300)" }}> · {e.at}</span>
                  </div>
                </div>
              ))}
            </div>
          </PfCard>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Graded submissions + anti-cheat
 * ------------------------------------------------------------------ */

function SubRow({ s, rubric }: { s: Submission; rubric: RubricDim[] }) {
  const [open, setOpen] = useState(false);
  const v = s.verdict ? VERDICT_TONE[s.verdict] : null;
  const tone = v?.tone ?? "var(--pf-n400)";
  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 13px", borderRadius: 11, cursor: "pointer" }}
      >
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flex: "none" }}>
          {s.init}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--pf-n900)" }}>{s.candidate}</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>
            {s.note ?? "Awaiting grading"} · v{s.assessmentVersion} · {s.submittedAt}
          </div>
        </div>
        {s.originalityFlag && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-yellow-500)", background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", padding: "3px 9px", borderRadius: 5, whiteSpace: "nowrap" }}>
            ⚠ {s.originalityFlag}
            {s.originalityConfidence != null ? ` · ${s.originalityConfidence}%` : ""}
          </span>
        )}
        <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, width: 34, textAlign: "right", color: tone }}>
          {s.score ?? "—"}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: v?.color ?? "var(--pf-n500)", background: v?.bg ?? "var(--pf-n50)", padding: "4px 10px", borderRadius: 5, width: 92, textAlign: "center" }}>
          {s.verdict ?? "Ungraded"}
        </span>
        <Ic name={open ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
      </div>
      {open && (
        <div style={{ padding: "4px 13px 16px 60px" }}>
          {s.perDimension.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>
              Submitted {s.submittedAt} — not graded yet. Scores appear against the same rubric dimensions once grading runs.
            </div>
          ) : (
            s.perDimension.map((p) => {
              const d = rubric.find((x) => x.key === p.key);
              return (
                <div key={p.key} style={{ display: "grid", gridTemplateColumns: "150px 46px 1fr", gap: 10, alignItems: "start", padding: "6px 0" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>
                    {d?.dim ?? p.key}
                    <span style={{ fontSize: 10.5, color: "var(--pf-n400)", fontWeight: 500 }}> · {d?.weight ?? 0}%</span>
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--pf-n600)" }}>{p.score}</span>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{p.evidence}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function NotDispatched({ a }: { a: Assessment }) {
  return (
    <PfCard pad={"36px 28px"} style={{ maxWidth: 780, textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>
        Nothing yet — this assessment hasn&apos;t been dispatched.
      </div>
      <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6, maxWidth: 420, margin: "0 auto" }}>
        {a.id} is {STATUS_LABEL[a.status].toLowerCase()}. Submissions can only exist for a brief that passed the approval gate and went out.
      </div>
    </PfCard>
  );
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export default function Assessment() {
  const { persona } = useApp();
  const p = personaById(persona);
  const actor = `${p.name} (${p.title})`;
  const { assessments, activeForStage05, submissionsFor } = useAssessment();
  const [tab, setTab] = useState("brief");
  const [openId, setOpenId] = useState<string | null>(null);

  const active = assessments.find((x) => x.id === openId) ?? activeForStage05();

  if (!active) {
    return (
      <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
        <PfCard pad={"36px 28px"} style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>No assessment on this requisition yet.</div>
        </PfCard>
      </div>
    );
  }

  const subs = submissionsFor(active.id);
  const flagged = subs.filter((s) => s.originalityFlag);
  const isReviewer = persona === active.approval.reviewer.personaId;

  // The reviewer's lane is deliberately narrow: read the brief, make the call.
  const tabs = isReviewer
    ? [
        { key: "brief", label: "Brief & questions" },
        { key: "approval", label: "Approval" },
      ]
    : [
        { key: "brief", label: "Brief & questions", count: String(active.questions.length) },
        { key: "approval", label: "Approval" },
        { key: "submissions", label: "Graded submissions", count: String(subs.length) },
        { key: "anticheat", label: "Anti-cheat", count: String(flagged.length) },
      ];
  const view = tabs.some((t) => t.key === tab) ? tab : "brief";

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "var(--pf-purple-500)", marginBottom: 5 }}>
        STAGE 05 · ASSESSMENT
      </div>
      <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px", color: "var(--pf-n900)" }}>
        {isReviewer ? "Approve the brief before anyone sits it" : "Generate, grade — and catch the cheating"}
      </h1>
      <div style={{ fontSize: 13, color: "var(--pf-n500)" }}>
        {isReviewer
          ? `You are the named reviewer on ${active.roleTitle}. AI drafted this test; nothing goes to a candidate until you sign off on the exact version.`
          : "AI builds a role-specific brief, grades submissions against the rubric, and flags AI-generated or plagiarised work for your review."}
      </div>

      {/* Record switcher — the demo has one in flight and one already sent. */}
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "14px 0 12px", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--pf-n400)" }}>RECORD</span>
        {assessments.map((x) => (
          <button key={x.id} onClick={() => setOpenId(x.id)} style={chipStyle(x.id === active.id, false)}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{x.id}</span> · {STATUS_LABEL[x.status]}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <PfBadge tone={STATUS_TONE[active.status]} dot>
          {active.title}
        </PfBadge>
      </div>

      <Rail a={active} />

      <div style={{ margin: "0 -28px 16px" }}>
        <PfPageTabs active={view} onSelect={setTab} tabs={tabs} />
      </div>

      {view === "brief" && (
        <BriefTab a={active} persona={persona} actor={actor} onGoApproval={() => setTab("approval")} />
      )}

      {view === "approval" && <ApprovalTab key={active.id} a={active} persona={persona} actor={actor} />}

      {view === "submissions" &&
        (subs.length === 0 ? (
          <NotDispatched a={active} />
        ) : (
          <PfCard style={{ maxWidth: 860, padding: 8 }}>
            <div style={{ padding: "11px 13px", fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--pf-n400)" }}>
              GRADED SUBMISSIONS · RUBRIC {active.provenance.rubricVersion} · {active.id}
            </div>
            {subs.map((s) => (
              <SubRow key={s.candidate} s={s} rubric={active.rubric} />
            ))}
            <div style={{ padding: "11px 13px", fontSize: 11.5, color: "var(--pf-n400)", fontWeight: 500, lineHeight: 1.5 }}>
              Every score is scored against the Stage-02 rubric this brief snapshotted — open a row for the per-dimension evidence.
            </div>
          </PfCard>
        ))}

      {view === "anticheat" &&
        (subs.length === 0 ? (
          <NotDispatched a={active} />
        ) : (
          <PfCard style={{ maxWidth: 860, padding: 8 }}>
            <div style={{ padding: "11px 13px", fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--pf-n400)" }}>
              FLAGGED FOR REVIEW · {flagged.length} OF {subs.length} SUBMISSIONS
            </div>
            {flagged.map((s) => (
              <SubRow key={s.candidate} s={s} rubric={active.rubric} />
            ))}
            <div style={{ margin: "10px 13px 4px", padding: "10px 12px", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, fontSize: 12, color: "var(--pf-primary-600)", fontWeight: 600 }}>
              ✓ {subs.length - flagged.length} of {subs.length} submissions show no originality flags.
            </div>
            <div style={{ padding: "11px 13px", fontSize: 11.5, color: "var(--pf-n400)", fontWeight: 600, lineHeight: 1.5 }}>
              ⚠ AI-generated flags are surfaced for review — <b>never auto-rejection.</b> Candidates can appeal via right-to-explanation.
            </div>
          </PfCard>
        ))}
    </div>
  );
}
