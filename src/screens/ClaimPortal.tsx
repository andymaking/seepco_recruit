"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard,
  PfCardHead,
  PfBadge,
  PfBtn,
  PfTile,
  PfProgress,
  PfSegments,
  PfBanner,
  TONE,
  type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  BASELINE_CHAT,
  BASELINE_METHODS,
  CLAIM_LANDING_ORDER,
  CLAIM_STEPS,
  FEEDBACK_INVITE,
  GROWTH_SKELETON,
  IMPORT_BATCH,
  IMPORTED_PROFILE,
  INVITES,
  inviteIdentity,
  LND_ENTITLEMENT,
  RIGHT_TO_EXPLANATION,
  ROLLOUT,
  VISIBILITY,
  VISIBILITY_CALLOUT_INDEX,
  type ClaimStep,
  type InviteChannel,
  type VisibilityRow,
} from "@/data/onboarding";

/**
 * PATH B · /claim — the existing employee claiming the account HR imported.
 *
 * Standalone by design: it sits outside `(app)` and `(os)` so neither Shell nor
 * OsShell wraps it, and it requires NO persona — Amara has no session until she
 * finishes. The final CTA is the hand-off: setPersona("employee") → go("me").
 *
 * The five-minute claim, per CLAIM_STEPS: verify identity (Smile ID + Youverify),
 * confirm the BambooHR import field by field, then build a competency baseline
 * either way the spec names — a 6-question AI chat OR a CV upload.
 *
 * Then the beat that decides whether an employee-side rollout lives or dies:
 * the landing leads with what she GETS. CLAIM_LANDING_ORDER drives the render
 * order literally (growth → learning → feedback → transparency), so the
 * negative constraint written beside it in the data survives future edits.
 * Nothing on the landing scores her, ranks her or reports her activity.
 *
 * The transparency screen is a full surface, not a footnote: the 12-row matrix
 * (you / your manager / HR) with every row citing the rule it comes from, the
 * leave-risk row called out rather than buried, and the right-to-explanation
 * panel where each of the four automated decisions can actually be challenged.
 */

/* ============================== the claimer ================================= */

/** Amara Okonkwo — INVITES[0], the demo claim subject, named off the person spine. */
const ME = { ...INVITES[0], ...inviteIdentity(INVITES[0]) };

/** BambooHR's least-complete field — the honest reason to look twice at Grade. */
const WEAKEST_IMPORT = IMPORT_BATCH.fieldMap.reduce((a, b) => (b.filled < a.filled ? b : a));

const CHANNELS: { id: InviteChannel; icon: string; label: string }[] = [
  { id: "Work email", icon: "paperplane", label: "Work email" },
  { id: "WhatsApp", icon: "chat", label: "WhatsApp" },
  { id: "SMS", icon: "bell", label: "SMS" },
];

/** Colleagues she can address feedback to — real people from the invite roster. */
const COLLEAGUES = INVITES.filter((i) => i.empId !== ME.empId && i.state !== "not-invited")
  .slice(0, 5)
  .map((i) => ({ ...i, ...inviteIdentity(i) }));

type Phase = "invite" | "verify" | "confirm" | "baseline" | "landing" | "transparency";
type Check = "idle" | "running" | "done";
type Parse = "idle" | "parsing" | "done";
type Skill = { skill: string; cluster: string; level: number; via: string };

const STEP_PHASES: Phase[] = ["verify", "confirm", "baseline"];

const fmtElapsed = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${s % 60}s` : `${s}s`;
};

const fmtNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

/**
 * What a CV can evidence. Same skills the chat writes — minus mentoring, which
 * a CV genuinely does not show. Not inventing it is the honest behaviour, and
 * it is why BASELINE_METHODS calls the chat the richer signal.
 */
const cvSkills = (): Skill[] => {
  const merged: Skill[] = [];
  BASELINE_CHAT.forEach((q) =>
    q.writes.forEach((w) => {
      if (w.skill === "Mentoring") return;
      const found = merged.find((m) => m.skill === w.skill);
      if (found) found.level = Math.max(found.level, w.level);
      else merged.push({ ...w, via: "read from your CV" });
    }),
  );
  return merged;
};

/* ============================== small pieces ================================ */

function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }}>{children}</div>;
}

function Eyebrow({ children, tone = "grey" }: { children: ReactNode; tone?: PfTone }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".9px", textTransform: "uppercase", color: TONE[tone].fg }}>
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>{children}</div>;
}

/** A single reassurance bullet — the sentences CLAIM_STEPS carries per step. */
function Assure({ children }: { children: ReactNode }) {
  return (
    <Row style={{ alignItems: "flex-start", gap: 8 }}>
      <span style={{ marginTop: 2, flex: "none" }}>
        <Ic name="shield" size={14} color="var(--pf-n300)" />
      </span>
      <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{children}</span>
    </Row>
  );
}

function Field({ value, onChange, placeholder, area, onEnter }: {
  value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean; onEnter?: () => void;
}) {
  const base: CSSProperties = {
    width: "100%", fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)",
    background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 9,
    padding: "9px 11px", outline: "none", resize: "none", lineHeight: 1.5,
  };
  return area ? (
    <textarea value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} style={base} />
  ) : (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
      style={base}
    />
  );
}

/** Hidden real file input behind a button — the picked filename is actual state. */
function FilePick({ label, accept, onPick, icon = "file" }: {
  label: string; accept: string; onPick: (name: string) => void; icon?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f.name);
          e.target.value = "";
        }}
      />
      <PfBtn icon={icon} onClick={() => ref.current?.click()}>{label}</PfBtn>
    </>
  );
}

/** Partner check row — Smile ID / Youverify state, live. */
function CheckRow({ partner, what, state, result, last }: {
  partner: string; what: string; state: Check; result?: string; last?: boolean;
}) {
  return (
    <Row style={{ padding: "11px 0", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <span
        style={{
          width: 22, height: 22, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
          background: state === "done" ? "var(--pf-primary-500)" : state === "running" ? "var(--pf-blue-50)" : "var(--pf-n50)",
          border: state === "running" ? "1px solid var(--pf-blue-100)" : "1px solid transparent",
          animation: state === "running" ? "pulseDot 1.1s ease-in-out infinite" : undefined,
        }}
      >
        {state === "done" ? <Ic name="check" size={12} color="#fff" weight={2.6} /> : <Ic name="clock" size={12} color={state === "running" ? "var(--pf-blue-500)" : "var(--pf-n300)"} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Row style={{ gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{what}</span>
          <PfBadge tone={state === "done" ? "green" : "grey"}>{partner}</PfBadge>
        </Row>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
          {state === "done" ? result : state === "running" ? "Running…" : "Waiting on you"}
        </div>
      </div>
      {state === "done" && <PfBadge tone="green" dot>Verified</PfBadge>}
    </Row>
  );
}

/** Extracted-field line with an OCR confidence. */
function Extract({ field, value, conf }: { field: string; value: string; conf: number }) {
  return (
    <Row style={{ gap: 8, padding: "5px 0" }}>
      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 104, flex: "none" }}>{field}</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{value}</span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n300)" }}>{Math.round(conf * 100)}%</span>
    </Row>
  );
}

/** Editable skill row — level stepper + remove. "You can edit or delete any skill." */
function SkillRow({ s, onLevel, onRemove }: { s: Skill; onLevel: (d: -1 | 1) => void; onRemove: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{ padding: "9px 8px", borderRadius: 9, background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <Row>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.skill}</div>
          <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 1 }}>{s.cluster} · {s.via}</div>
        </div>
        <PfSegments score={s.level} outOf={5} tone="green" />
        <Row style={{ gap: 3 }}>
          <button onClick={() => onLevel(-1)} style={stepper(s.level <= 1)} disabled={s.level <= 1}>−</button>
          <button onClick={() => onLevel(1)} style={stepper(s.level >= 5)} disabled={s.level >= 5}>+</button>
          <button onClick={onRemove} title="Remove this skill" style={{ ...stepper(false), color: "var(--pf-n300)" }}>×</button>
        </Row>
      </Row>
    </div>
  );
}

const stepper = (disabled: boolean): CSSProperties => ({
  width: 22, height: 22, borderRadius: 6, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)",
  color: disabled ? "var(--pf-n300)" : "var(--pf-n900)", fontSize: 13, fontWeight: 600,
  cursor: disabled ? "default" : "pointer", fontFamily: "inherit", lineHeight: 1, flex: "none",
});

/** The three-column visibility verdict glyph. */
function Verdict({ v }: { v: "sees" | "sees-summary" | "no" | "request" }) {
  const map = {
    sees: { icon: "check", tone: "green" as PfTone, label: "Sees it" },
    "sees-summary": { icon: "filter", tone: "yellow" as PfTone, label: "Summary only" },
    no: { icon: "x", tone: "grey" as PfTone, label: "Not visible" },
    request: { icon: "question", tone: "blue" as PfTone, label: "On request" },
  }[v];
  return (
    <Row style={{ gap: 6 }}>
      <span
        style={{
          width: 19, height: 19, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
          background: v === "no" ? "var(--pf-n50)" : TONE[map.tone].soft,
          border: `1px solid ${v === "no" ? "var(--pf-n100)" : TONE[map.tone].line}`,
        }}
      >
        <Ic name={map.icon} size={11} color={v === "no" ? "var(--pf-n300)" : TONE[map.tone].fg} weight={2.2} />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 500, color: v === "no" ? "var(--pf-n300)" : "var(--pf-n600)" }}>{map.label}</span>
    </Row>
  );
}

/* ================================ the screen ================================ */

export default function ClaimPortal() {
  const go = useGo();
  const toast = useToast();
  const { setPersona } = useApp();

  const [phase, setPhase] = useState<Phase>("invite");
  const [channel, setChannel] = useState<InviteChannel>("Work email");
  const [notMe, setNotMe] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  /* step 1 — identity */
  const [ninFile, setNinFile] = useState<string | null>(null);
  const [nin, setNin] = useState<Check>("idle");
  const [selfie, setSelfie] = useState<Check>("idle");
  const [xcheck, setXcheck] = useState<Check>("idle");

  /* step 2 — the import */
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  /* step 3 — the baseline */
  const [method, setMethod] = useState<"AI chat" | "CV upload" | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState<{ q: string; a: string }[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [cvFile, setCvFile] = useState<string | null>(null);
  const [cv, setCv] = useState<Parse>("idle");
  const [cvStage, setCvStage] = useState(0);
  const [mentoringAdded, setMentoringAdded] = useState(false);

  /* landing */
  const [targetPicked, setTargetPicked] = useState(false);
  const [milestones, setMilestones] = useState<string[]>([]);
  const [milestoneDraft, setMilestoneDraft] = useState("");
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseCost, setCourseCost] = useState("");
  const [requests, setRequests] = useState<{ name: string; cost: number }[]>([]);
  const [fbMode, setFbMode] = useState<"give" | "request" | null>(null);
  const [fbTo, setFbTo] = useState(COLLEAGUES[0]?.name ?? "");
  const [fbText, setFbText] = useState("");
  const [fbSent, setFbSent] = useState<{ mode: string; to: string }[]>([]);

  /* transparency */
  const [vFilter, setVFilter] = useState<"all" | "manager" | "private">("all");
  const [explained, setExplained] = useState<Record<string, boolean>>({});

  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((id) => window.clearTimeout(id)); };
  }, []);

  /**
   * The Youverify cross-check runs itself the moment BOTH captures land — the
   * employee never presses a third button for it. Refs mirror the two capture
   * states so the timer callback that finishes one can see the other.
   */
  const ninRef = useRef<Check>("idle");
  const selfieRef = useRef<Check>("idle");
  const captureDone = (which: "nin" | "selfie") => {
    if (which === "nin") { ninRef.current = "done"; setNin("done"); }
    else { selfieRef.current = "done"; setSelfie("done"); }
    if (ninRef.current === "done" && selfieRef.current === "done") {
      setXcheck("running");
      later(() => setXcheck("done"), 1500);
    }
  };

  /* CV parse — three visible stages, then the extracted skills. */
  const runCvParse = (name: string) => {
    setCvFile(name);
    setCvStage(0);
    setCv("parsing");
    later(() => setCvStage(1), 700);
    later(() => setCvStage(2), 1400);
    later(() => setCvStage(3), 2100);
    later(() => {
      const merged = cvSkills();
      setSkills(merged);
      setCv("done");
      toast(`${merged.length} skills read from ${name}`, "ai");
    }, 2800);
  };

  const verified = xcheck === "done";
  const chatDone = qIdx >= BASELINE_CHAT.length;
  const baselineDone = skills.length > 0 && (method === "CV upload" ? cv === "done" : true);
  const correctionCount = Object.keys(corrections).length;

  const stepIndex = STEP_PHASES.indexOf(phase);
  const minutesLeft = useMemo(() => {
    if (stepIndex < 0) return CLAIM_STEPS.reduce((a, s) => a + s.minutes, 0);
    return CLAIM_STEPS.slice(stepIndex).reduce((a, s) => a + s.minutes, 0);
  }, [stepIndex]);

  const begin = () => {
    setStartedAt(Date.now());
    setPhase("verify");
    toast("Claim started — about five minutes", "default");
  };

  const finishClaim = () => {
    setElapsed(startedAt ? Date.now() - startedAt : null);
    setPhase("landing");
    toast(`Account claimed · ${skills.length} skills baselined`, "success");
  };

  const enterWorkspace = () => {
    setPersona("employee");
    toast("Signed in as Amara Okonkwo — employee workspace", "success");
    go("me");
  };

  const restart = () => {
    setPhase("invite"); setNotMe(false); setStartedAt(null); setElapsed(null);
    setNinFile(null); setNin("idle"); setSelfie("idle"); setXcheck("idle");
    ninRef.current = "idle"; selfieRef.current = "idle";
    setCorrections({}); setEditing(null);
    setMethod(null); setQIdx(0); setAnswer(""); setTranscript([]); setSkills([]);
    setCvFile(null); setCv("idle"); setCvStage(0); setMentoringAdded(false);
    setTargetPicked(false); setMilestones([]); setRequests([]); setFbSent([]); setFbMode(null);
    setVFilter("all"); setExplained({});
    toast("Claim reset", "default");
  };

  const addSkills = (writes: { skill: string; cluster: string; level: number }[], via: string) => {
    if (writes.length === 0) return;
    setSkills((prev) => {
      const next = [...prev];
      writes.forEach((w) => {
        const at = next.findIndex((m) => m.skill === w.skill);
        if (at >= 0) next[at] = { ...next[at], level: Math.max(next[at].level, w.level) };
        else next.push({ ...w, via });
      });
      return next;
    });
  };

  const submitAnswer = (text: string, skipped: boolean) => {
    const q = BASELINE_CHAT[qIdx];
    setTranscript((t) => [...t, { q: q.q, a: skipped ? "— skipped —" : text }]);
    if (!skipped) addSkills(q.writes, "from your answers");
    setAnswer("");
    setQIdx((i) => i + 1);
  };

  /* ------------------------------- chrome ---------------------------------- */

  const bar = (
    <header
      style={{
        position: "sticky", top: 0, zIndex: 20, height: 60, flex: "none", background: "var(--pf-n0)",
        borderBottom: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 12, padding: "0 24px",
      }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 12px -6px rgba(22,179,100,.5)" }}>
        <Ic name="sparkle" size={16} color="#fff" weight={2} />
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.3px", color: "var(--pf-n900)" }}>Hirebrew</span>
      <span style={{ width: 1, height: 20, background: "var(--pf-n100)" }} />
      <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>
        {phase === "transparency" ? "What’s visible" : phase === "landing" ? "Your workspace" : "Claim your account"}
      </span>
      <span style={{ flex: 1 }} />
      {stepIndex >= 0 && (
        <>
          <PfBadge tone="grey">Step {stepIndex + 1} of {CLAIM_STEPS.length}</PfBadge>
          <Row style={{ gap: 5 }}>
            <Ic name="clock" size={14} color="var(--pf-n300)" />
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>≈ {minutesLeft} min left</span>
          </Row>
        </>
      )}
      {(phase === "landing" || phase === "transparency") && (
        <Row style={{ gap: 8 }}>
          <span
            style={{ width: 28, height: 28, borderRadius: "50%", background: `${ME.tone}1A`, color: ME.tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, border: `1px solid ${ME.tone}33` }}
          >
            {ME.init}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{ME.name}</span>
          <PfBadge tone="green" dot>Claimed</PfBadge>
        </Row>
      )}
      {phase !== "invite" && <PfBtn variant="ghost" small onClick={restart}>Start over</PfBtn>}
    </header>
  );

  /* ------------------------------ step rail -------------------------------- */

  const rail = (
    <PfCard style={{ position: "sticky", top: 84 }}>
      <div style={{ padding: "16px 18px" }}>
        <Eyebrow tone="green">About five minutes</Eyebrow>
        <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55 }}>
          Median across {ROLLOUT.claimed} colleagues who have already claimed: {ROLLOUT.medianClaimMinutes} minutes.
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "6px 12px 12px" }}>
        {CLAIM_STEPS.map((s, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "now" : "next";
          return (
            <Row key={s.id} style={{ alignItems: "flex-start", gap: 10, padding: "11px 6px", borderBottom: i === CLAIM_STEPS.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: "50%", flex: "none", marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  background: state === "done" ? "var(--pf-primary-500)" : state === "now" ? "var(--pf-n900)" : "var(--pf-n50)",
                  color: state === "next" ? "var(--pf-n300)" : "#fff", fontSize: 11, fontWeight: 600,
                }}
              >
                {state === "done" ? <Ic name="check" size={12} color="#fff" weight={2.6} /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: state === "now" ? 600 : 500, color: state === "next" ? "var(--pf-n400)" : "var(--pf-n900)" }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 2 }}>{s.sub}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n300)", flex: "none", marginTop: 2 }}>{s.minutes}m</span>
            </Row>
          );
        })}
      </div>
    </PfCard>
  );

  /* ============================== PHASE · invite ============================ */

  const inviteBody = (
    <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 20, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PfCard>
          <div style={{ padding: "26px 28px" }}>
            <Eyebrow tone="green">Invite · {ME.sentAt}</Eyebrow>
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.8px", color: "var(--pf-n900)", margin: "10px 0 0", lineHeight: 1.2 }}>
              {ME.name.split(" ")[0]}, your account is here — it just needs claiming.
            </h1>
            <p style={{ fontSize: 14.5, color: "var(--pf-n500)", lineHeight: 1.65, margin: "12px 0 0", maxWidth: 560 }}>
              People Ops moved everyone onto Hirebrew on {IMPORT_BATCH.runAt.split(" · ")[0]}. Your profile came across from {IMPORT_BATCH.source} —
              your role, your team, your history. Claiming it takes about five minutes and puts your growth plan, your learning
              budget and your feedback in your own hands.
            </p>
            <Row style={{ gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              {CLAIM_STEPS.map((s, i) => (
                <Row key={s.id} style={{ gap: 7, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 12px" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--pf-primary-500)" }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{s.title}</span>
                  <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{s.minutes}m</span>
                </Row>
              ))}
            </Row>
            {notMe ? (
              <div style={{ marginTop: 20, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "14px 16px" }}>
                <Row style={{ gap: 8 }}>
                  <Ic name="warning" size={16} color="var(--pf-yellow-500)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Flagged to People Ops — reminders stopped.</span>
                </Row>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.55 }}>
                  Nothing on the record changes and no data was shown. A person reviews the invite before it is re-sent.
                </div>
                <div style={{ marginTop: 10 }}>
                  <PfBtn small onClick={() => setNotMe(false)}>Actually, it is me</PfBtn>
                </div>
              </div>
            ) : (
              <Row style={{ gap: 10, marginTop: 22 }}>
                <PfBtn variant="primary" icon="arrowright" onClick={begin} style={{ fontSize: 13.5, padding: "11px 18px" }}>
                  Claim my account
                </PfBtn>
                <PfBtn onClick={() => { setNotMe(true); toast("Reported to People Ops — invite paused", "danger"); }}>
                  This isn&rsquo;t me
                </PfBtn>
              </Row>
            )}
          </div>
        </PfCard>

        <PfCard>
          <PfCardHead title="What you get on the other side" sub="Before the work, the reason for it." />
          <div style={{ padding: "6px 20px 16px" }}>
            {[
              { icon: "target", tone: "green" as PfTone, t: "A growth plan that is yours", s: "Drafted from your own answers, shared with your manager only when you choose to share it." },
              { icon: "book", tone: "blue" as PfTone, t: "A learning budget already paid for", s: `${LND_ENTITLEMENT.body.split(".")[0]}. You never pay out of pocket.` },
              { icon: "megaphone", tone: "purple" as PfTone, t: "A way to say something", s: "Give feedback or ask for it — nothing anonymous, in either direction." },
              { icon: "shield", tone: "yellow" as PfTone, t: "The honest list of who sees what", s: "Twelve data categories, three columns, every line citing the rule behind it." },
            ].map((r, i) => (
              <Row key={r.t} style={{ alignItems: "flex-start", gap: 12, padding: "13px 0", borderBottom: i === 3 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfTile icon={r.icon} tone={r.tone} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.t}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.55 }}>{r.s}</div>
                </div>
              </Row>
            ))}
          </div>
        </PfCard>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PfCard>
          <PfCardHead title="Your invite, as it arrived" sub="Same link, three channels." />
          <div style={{ padding: 16 }}>
            <Row style={{ gap: 4, background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: 4, marginBottom: 14 }}>
              {CHANNELS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setChannel(c.id)}
                  style={{
                    flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
                    fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "6px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: channel === c.id ? "var(--pf-n0)" : "transparent",
                    color: channel === c.id ? "var(--pf-n900)" : "var(--pf-n400)",
                    boxShadow: channel === c.id ? "0 1px 3px rgba(2,6,23,.08)" : "none",
                  }}
                >
                  <Ic name={c.icon} size={13} />
                  {c.label}
                </button>
              ))}
            </Row>

            {channel === "Work email" && (
              <div style={{ border: "1px solid var(--pf-n100)", borderRadius: 11, overflow: "hidden" }}>
                <div style={{ padding: "11px 14px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Claim your Hirebrew account</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>People Ops &lt;peopleops@unrealabs.ng&gt; · to amara.okonkwo@unrealabs.ng</div>
                </div>
                <div style={{ padding: "14px", fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65 }}>
                  Hi Amara — we&rsquo;ve moved People onto Hirebrew. Your profile is already there; claim it to set your growth plan,
                  draw on the learning pool and see exactly what your manager can and cannot see.
                  <div style={{ marginTop: 12 }}>
                    <PfBtn variant="primary" small onClick={begin}>Claim my account</PfBtn>
                  </div>
                  <div style={{ marginTop: 12, fontSize: 11, color: "var(--pf-n300)" }}>Link expires in 14 days · {ROLLOUT.window}</div>
                </div>
              </div>
            )}

            {channel === "WhatsApp" && (
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 11, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--pf-n300)", textAlign: "center" }}>Unrealabs People Ops · business account</div>
                <div style={{ alignSelf: "flex-start", maxWidth: "92%", background: "var(--pf-n0)", border: "0.6px solid var(--pf-n100)", borderRadius: 10, borderTopLeftRadius: 3, padding: "9px 11px" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.5 }}>
                    Hi Amara 👋 People has moved to Hirebrew. Tap to claim your account — about 5 minutes. Your growth plan and
                    learning budget are inside.
                  </div>
                  <div
                    onClick={begin}
                    style={{ marginTop: 9, paddingTop: 8, borderTop: "1px solid var(--pf-n50)", textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-500)", cursor: "pointer" }}
                  >
                    Claim my account
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 4, fontSize: 10, color: "var(--pf-n400)" }}>
                    08:00 <span style={{ color: "var(--pf-primary-500)", fontWeight: 600 }}>✓✓</span>
                  </div>
                </div>
                <Note>Site crews have no work email — {ROLLOUT.channelSplit.WhatsApp} colleagues were reached here instead.</Note>
              </div>
            )}

            {channel === "SMS" && (
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 11, padding: 14 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.7, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "11px 12px" }}>
                  UNREALABS: Claim your Hirebrew account (5 min). Growth plan + learning budget inside. hbrw.ng/c/AO7K2 — reply
                  STOP to opt out.
                </div>
                <div style={{ marginTop: 10 }}>
                  <PfBtn small variant="primary" onClick={begin}>Open the link</PfBtn>
                </div>
                <div style={{ marginTop: 10 }}>
                  <Note>
                    {ROLLOUT.channelSplit.SMS} contractors are on feature phones. The page the link opens is 40KB and works on 2G —
                    an undelivered WhatsApp falls back here automatically.
                  </Note>
                </div>
              </div>
            )}
          </div>
        </PfCard>

        <PfCard>
          <div style={{ padding: "16px 18px" }}>
            <Row style={{ gap: 8, marginBottom: 8 }}>
              <Ic name="shield" size={16} color="var(--pf-n400)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>What this is not</span>
            </Row>
            <Note>
              Not a monitoring tool. Hirebrew does not track your hours, your keystrokes or your location, and nothing you do in
              here is scored without you being told what it was based on. The full list of who sees what is one click from the end
              of this flow — and you can read it before you commit to anything.
            </Note>
          </div>
        </PfCard>
      </div>
    </div>
  );

  /* ============================== PHASE · verify =========================== */

  const stepHead = (s: ClaimStep) => (
    <div style={{ marginBottom: 16 }}>
      <Eyebrow tone="green">Step {STEP_PHASES.indexOf(phase) + 1} · about {s.minutes} minutes</Eyebrow>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.5px", color: "var(--pf-n900)", margin: "8px 0 4px" }}>{s.title}</h2>
      <div style={{ fontSize: 13.5, color: "var(--pf-n400)" }}>{s.sub}</div>
    </div>
  );

  const verifyBody = (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
      {rail}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stepHead(CLAIM_STEPS[0])}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <PfCard>
            <PfCardHead title="Your NIN slip" sub="Photograph it, or pick the file" />
            <div style={{ padding: 18 }}>
              {nin === "done" ? (
                <>
                  <Row style={{ gap: 8, marginBottom: 10 }}>
                    <PfBadge tone="green" dot>Read</PfBadge>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ninFile}</span>
                  </Row>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 12px" }}>
                    <Extract field="NIN" value="•••• 5106" conf={0.99} />
                    <Extract field="Full name" value="Amara Chinwe Okonkwo" conf={0.97} />
                    <Extract field="Date of birth" value="02 Sep 1994" conf={0.95} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Note>Read by Smile ID, the same partner the hiring side uses at Stage 8.</Note>
                  </div>
                </>
              ) : (
                <div
                  style={{ border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "26px 16px", textAlign: "center", background: "var(--pf-n25)" }}
                >
                  <PfTile icon="file" tone={nin === "running" ? "blue" : "grey"} size={38} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>
                    {nin === "running" ? "Reading the slip…" : "NIN slip"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, marginBottom: 12 }}>JPG, PNG or PDF · under 5MB</div>
                  {nin === "idle" && (
                    <Row style={{ justifyContent: "center", gap: 8 }}>
                      <FilePick
                        label="Choose file"
                        accept="image/*,.pdf"
                        onPick={(name) => { setNinFile(name); setNin("running"); later(() => captureDone("nin"), 1300); }}
                      />
                      <PfBtn
                        variant="ghost"
                        onClick={() => { setNinFile("NIN_slip_camera.jpg"); setNin("running"); later(() => captureDone("nin"), 1300); }}
                      >
                        Use my camera
                      </PfBtn>
                    </Row>
                  )}
                </div>
              )}
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead title="A liveness selfie" sub="Matched, then discarded" />
            <div style={{ padding: 18 }}>
              <div
                style={{
                  border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "26px 16px", textAlign: "center",
                  background: selfie === "done" ? "var(--pf-primary-50)" : "var(--pf-n25)",
                }}
              >
                <PfTile icon="user" tone={selfie === "done" ? "green" : selfie === "running" ? "blue" : "grey"} size={38} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>
                  {selfie === "done" ? "Face matched · 98.4%" : selfie === "running" ? "Checking you’re live…" : "Liveness check"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, marginBottom: 12 }}>
                  {selfie === "done" ? "The selfie was discarded — only the match result was kept" : "Blink twice when the frame turns green"}
                </div>
                {selfie === "idle" && (
                  <PfBtn variant="primary" onClick={() => { setSelfie("running"); later(() => captureDone("selfie"), 1600); }}>
                    Take the selfie
                  </PfBtn>
                )}
              </div>
            </div>
          </PfCard>
        </div>

        <PfCard>
          <PfCardHead title="The checks themselves" sub="Two partners, three results — nothing hidden behind a spinner">
            <PfBadge tone={verified ? "green" : "grey"}>{verified ? "All clear" : "In progress"}</PfBadge>
          </PfCardHead>
          <div style={{ padding: "4px 20px 16px" }}>
            <CheckRow partner="Smile ID" what="NIN slip · OCR" state={nin} result="NIN, name and date of birth read · 3 fields" />
            <CheckRow partner="Smile ID" what="Liveness face-match" state={selfie} result="Match 98.4% · selfie discarded on completion" />
            <CheckRow partner="Youverify" what="Employment record cross-check" state={xcheck} result="Name and hire date agree with the BambooHR record · Clear" last />
          </div>
        </PfCard>

        <PfCard>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {CLAIM_STEPS[0].detail.map((d) => <Assure key={d}>{d}</Assure>)}
            <Assure>Every check on this page is written to the audit log with your name on it — including this one.</Assure>
          </div>
        </PfCard>

        <Row style={{ justifyContent: "flex-end", gap: 10 }}>
          <PfBtn variant="ghost" onClick={() => setPhase("invite")}>Back</PfBtn>
          <PfBtn
            variant="primary"
            icon="arrowright"
            onClick={() => { if (verified) { setPhase("confirm"); } else { toast("Finish both captures first — the cross-check runs itself", "danger"); } }}
            style={{ opacity: verified ? 1 : 0.45 }}
          >
            Continue
          </PfBtn>
        </Row>
      </div>
    </div>
  );

  /* ============================== PHASE · confirm ========================== */

  const confirmBody = (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
      {rail}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stepHead(CLAIM_STEPS[1])}

        <PfBanner tone="blue" icon="info">
          Nothing here was typed by you — it came from {IMPORT_BATCH.source} on {IMPORT_BATCH.runAt}. Correcting a field raises a
          change request to People Ops; it never silently overwrites your record.
        </PfBanner>

        <PfCard>
          <PfCardHead title={`${IMPORTED_PROFILE.length} imported fields`} sub="Confirm what is right, fix what is not">
            {correctionCount > 0 && <PfBadge tone="blue">{correctionCount} change request{correctionCount > 1 ? "s" : ""}</PfBadge>}
          </PfCardHead>
          <div style={{ padding: "4px 20px 8px" }}>
            {IMPORTED_PROFILE.map((f, i) => {
              const fixed = corrections[f.field];
              const isEditing = editing === f.field;
              const weak = f.field === WEAKEST_IMPORT.talentos;
              return (
                <div key={f.field} style={{ padding: "12px 0", borderBottom: i === IMPORTED_PROFILE.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <Row style={{ gap: 12 }}>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)", width: 120, flex: "none" }}>{f.field}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {fixed ? (
                        <Row style={{ gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{fixed}</span>
                          <span style={{ fontSize: 12, color: "var(--pf-n300)", textDecoration: "line-through" }}>{f.imported}</span>
                          <PfBadge tone="blue">Change request · People Ops</PfBadge>
                        </Row>
                      ) : (
                        <Row style={{ gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{f.imported}</span>
                          {weak && <PfBadge tone="yellow">Least complete field in the import</PfBadge>}
                        </Row>
                      )}
                      {weak && !fixed && (
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4 }}>
                          {IMPORT_BATCH.source}&rsquo;s {WEAKEST_IMPORT.hris.toLowerCase()} was filled for {WEAKEST_IMPORT.filled} of{" "}
                          {IMPORT_BATCH.landed} people — worth a second look.
                        </div>
                      )}
                    </div>
                    {fixed ? (
                      <PfBtn
                        variant="ghost"
                        small
                        onClick={() => { setCorrections((c) => { const n = { ...c }; delete n[f.field]; return n; }); toast(`Change request withdrawn · ${f.field}`, "default"); }}
                      >
                        Undo
                      </PfBtn>
                    ) : (
                      <PfBtn small onClick={() => { setEditing(isEditing ? null : f.field); setDraft(f.imported); }}>
                        {isEditing ? "Cancel" : "Fix this"}
                      </PfBtn>
                    )}
                  </Row>
                  {isEditing && !fixed && (
                    <Row style={{ gap: 8, marginTop: 10, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: 10, animation: "scIn .18s ease" }}>
                      <div style={{ flex: 1 }}>
                        <Field
                          value={draft}
                          onChange={setDraft}
                          placeholder={`Correct ${f.field.toLowerCase()}`}
                          onEnter={() => {
                            if (!draft.trim() || draft.trim() === f.imported) return;
                            setCorrections((c) => ({ ...c, [f.field]: draft.trim() }));
                            setEditing(null);
                            toast(`Change request raised · ${f.field} → ${draft.trim()}`, "success");
                          }}
                        />
                      </div>
                      <PfBtn
                        variant="primary"
                        onClick={() => {
                          if (!draft.trim() || draft.trim() === f.imported) { toast("Nothing changed — the value is the same", "danger"); return; }
                          setCorrections((c) => ({ ...c, [f.field]: draft.trim() }));
                          setEditing(null);
                          toast(`Change request raised · ${f.field} → ${draft.trim()}`, "success");
                        }}
                      >
                        Raise change request
                      </PfBtn>
                    </Row>
                  )}
                </div>
              );
            })}
          </div>
        </PfCard>

        <PfCard>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
            {CLAIM_STEPS[1].detail.map((d) => <Assure key={d}>{d}</Assure>)}
            <Assure>A change request is a request. Until People Ops accepts it, the imported value stays on your record — and you can see both.</Assure>
          </div>
        </PfCard>

        <Row style={{ justifyContent: "flex-end", gap: 10 }}>
          <PfBtn variant="ghost" onClick={() => setPhase("verify")}>Back</PfBtn>
          <PfBtn
            variant="primary"
            icon="arrowright"
            onClick={() => {
              setPhase("baseline");
              if (correctionCount > 0) toast(`${correctionCount} change request${correctionCount > 1 ? "s" : ""} sent to People Ops`, "success");
            }}
          >
            {correctionCount > 0 ? `Save ${correctionCount} correction${correctionCount > 1 ? "s" : ""} and continue` : "This all looks right"}
          </PfBtn>
        </Row>
      </div>
    </div>
  );

  /* ============================= PHASE · baseline ========================== */

  const skillsPanel = (
    <PfCard style={{ position: "sticky", top: 84 }}>
      <PfCardHead title="Your skills, so far" sub={`${skills.length} written to the company taxonomy`}>
        <PfBadge tone={skills.length ? "green" : "grey"}>{skills.length ? "Building" : "Empty"}</PfBadge>
      </PfCardHead>
      <div style={{ padding: "6px 12px 12px", maxHeight: 340, overflowY: "auto" }}>
        {skills.length === 0 ? (
          <div style={{ padding: "22px 8px", textAlign: "center" }}>
            <Note>Nothing yet. Answer a question or drop in your CV and skills appear here — editable before you finish.</Note>
          </div>
        ) : (
          skills.map((s, i) => (
            <SkillRow
              key={s.skill}
              s={s}
              onLevel={(d) => setSkills((prev) => prev.map((x, j) => (j === i ? { ...x, level: Math.max(1, Math.min(5, x.level + d)) } : x)))}
              onRemove={() => { setSkills((prev) => prev.filter((_, j) => j !== i)); toast(`Removed ${s.skill}`, "default"); }}
            />
          ))
        )}
      </div>
      <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "12px 16px" }}>
        <Note>
          Levels are the same 1–5 scale the whole company uses (FR-076) — the one behind job rubrics, scorecards and internal
          mobility. Nothing here is a rating of you by anyone else.
        </Note>
      </div>
    </PfCard>
  );

  const chatRoute = (
    <PfCard>
      <PfCardHead
        title="Six questions"
        sub={chatDone ? "All six answered" : `Question ${qIdx + 1} of ${BASELINE_CHAT.length}`}
      >
        <PfBtn variant="ghost" small onClick={() => { setMethod(null); setQIdx(0); setTranscript([]); setSkills([]); }}>Switch method</PfBtn>
      </PfCardHead>
      <div style={{ padding: "0 20px" }}>
        <div style={{ paddingTop: 14 }}>
          <PfProgress pct={(qIdx / BASELINE_CHAT.length) * 100} tone="purple" height={5} />
        </div>
      </div>
      <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {transcript.map((t, i) => (
          <div key={i} style={{ opacity: 0.62 }}>
            <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>{t.q}</div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, fontStyle: t.a.startsWith("—") ? "italic" : "normal" }}>{t.a}</div>
          </div>
        ))}

        {!chatDone ? (
          <div style={{ animation: "scIn .2s ease" }}>
            <Row style={{ alignItems: "flex-start", gap: 10 }}>
              <PfTile icon="sparkle" tone="purple" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.45 }}>{BASELINE_CHAT[qIdx].q}</div>
                {BASELINE_CHAT[qIdx].hint && (
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>{BASELINE_CHAT[qIdx].hint}</div>
                )}
              </div>
            </Row>
            <div style={{ marginTop: 12 }}>
              <Field value={answer} onChange={setAnswer} area placeholder="Type your answer — a sentence or two" />
            </div>
            <Row style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <PfBtn
                variant="primary"
                onClick={() => {
                  if (!answer.trim()) { toast("Write something, or skip the question", "danger"); return; }
                  const wrote = BASELINE_CHAT[qIdx].writes;
                  submitAnswer(answer.trim(), false);
                  if (wrote.length) toast(`${wrote.map((w) => w.skill).join(", ")} added to your baseline`, "ai");
                }}
              >
                Answer
              </PfBtn>
              <PfBtn onClick={() => setAnswer(BASELINE_CHAT[qIdx].sample)}>Use a sample answer</PfBtn>
              <PfBtn variant="ghost" onClick={() => submitAnswer("", true)}>Skip this one</PfBtn>
            </Row>
          </div>
        ) : (
          <PfBanner tone="green" icon="check">
            Six for six. {skills.length} skills went into your baseline — edit any of them on the right before you finish.
          </PfBanner>
        )}
      </div>
    </PfCard>
  );

  const cvRoute = (
    <PfCard>
      <PfCardHead title="Upload your CV" sub={BASELINE_METHODS[1].note}>
        <PfBtn variant="ghost" small onClick={() => { setMethod(null); setCv("idle"); setCvStage(0); setCvFile(null); setSkills([]); setMentoringAdded(false); }}>Switch method</PfBtn>
      </PfCardHead>
      <div style={{ padding: 20 }}>
        {cv === "idle" && (
          <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 12, padding: "34px 20px", textAlign: "center", background: "var(--pf-n25)" }}>
            <PfTile icon="file" tone="grey" size={44} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", marginTop: 12 }}>Drop in a CV and we read the skills out of it</div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5, marginBottom: 16 }}>PDF or Word · median {BASELINE_METHODS[1].medianMinutes} minutes</div>
            <Row style={{ justifyContent: "center", gap: 8 }}>
              <FilePick label="Choose a file" accept=".pdf,.doc,.docx" onPick={(name) => runCvParse(name)} />
              <PfBtn variant="ghost" onClick={() => runCvParse("Amara_Okonkwo_CV.pdf")}>
                Use the CV already on my record
              </PfBtn>
            </Row>
          </div>
        )}

        {cv === "parsing" && (
          <div style={{ padding: "10px 4px" }}>
            <Row style={{ gap: 10, marginBottom: 14 }}>
              <PfTile icon="robot" tone="purple" size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{cvFile}</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>Reading it now — this is the same parser the hiring side uses on applications.</div>
              </div>
            </Row>
            {["Extracting text and structure…", "Matching phrases to the skills taxonomy…", "Estimating a level per skill…"].map((s, i) => (
              <Row key={s} style={{ gap: 9, padding: "8px 0", opacity: cvStage >= i ? 1 : 0.35 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: cvStage > i ? "var(--pf-primary-500)" : "var(--pf-n50)" }}>
                  {cvStage > i && <Ic name="check" size={11} color="#fff" weight={2.6} />}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{s}</span>
              </Row>
            ))}
          </div>
        )}

        {cv === "done" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PfBanner tone="green" icon="check">
              {skills.length} skills read from {cvFile}. They are on the right, and every one of them is yours to change.
            </PfBanner>
            <div style={{ background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 11, padding: "14px 16px" }}>
              <Row style={{ gap: 8, marginBottom: 6 }}>
                <Ic name="warning" size={16} color="var(--pf-yellow-500)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>A CV misses the things you do for other people</span>
              </Row>
              <Note>
                {BASELINE_METHODS[0].note}. Mentoring, review and leadership rarely make it onto a CV — so we did not invent them
                from yours.
              </Note>
              {!mentoringAdded ? (
                <Row style={{ gap: 8, marginTop: 11 }}>
                  <PfBtn
                    small
                    onClick={() => { addSkills([{ skill: "Mentoring", cluster: "Engineering", level: 4 }], "added by you"); setMentoringAdded(true); toast("Mentoring added at level 4 — adjust it on the right", "success"); }}
                  >
                    Add mentoring
                  </PfBtn>
                  <PfBtn variant="ghost" small onClick={() => { setMethod("AI chat"); setCv("idle"); toast("Switched to the six-question chat", "ai"); }}>
                    Answer the six questions instead
                  </PfBtn>
                </Row>
              ) : (
                <div style={{ marginTop: 11 }}><PfBadge tone="green" dot>Mentoring added</PfBadge></div>
              )}
            </div>
          </div>
        )}
      </div>
    </PfCard>
  );

  const baselineBody = (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20, alignItems: "start" }}>
      {rail}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {stepHead(CLAIM_STEPS[2])}

        {method === null ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {BASELINE_METHODS.map((m) => (
                <MethodCard
                  key={m.method}
                  icon={m.method === "AI chat" ? "chat" : "file"}
                  tone={m.method === "AI chat" ? "purple" : "blue"}
                  title={m.label}
                  minutes={m.medianMinutes}
                  used={m.used}
                  note={m.note}
                  onPick={() => { setMethod(m.method); toast(`${m.label} — ${m.medianMinutes} min median`, "default"); }}
                />
              ))}
            </div>
            <PfCard>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                {CLAIM_STEPS[2].detail.map((d) => <Assure key={d}>{d}</Assure>)}
                <Assure>Either route writes the same thing. Pick whichever you have the patience for right now.</Assure>
              </div>
            </PfCard>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {method === "AI chat" ? chatRoute : cvRoute}
              <PfCard>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {CLAIM_STEPS[2].detail.map((d) => <Assure key={d}>{d}</Assure>)}
                </div>
              </PfCard>
            </div>
            {skillsPanel}
          </div>
        )}

        <Row style={{ justifyContent: "flex-end", gap: 10 }}>
          <PfBtn variant="ghost" onClick={() => setPhase("confirm")}>Back</PfBtn>
          {method === "AI chat" && !chatDone && skills.length > 0 && (
            <PfBtn onClick={() => { setQIdx(BASELINE_CHAT.length); toast("Stopped early — you can add more any time", "default"); }}>
              That&rsquo;s enough for now
            </PfBtn>
          )}
          <PfBtn
            variant="primary"
            icon="arrowright"
            onClick={() => { if (baselineDone) finishClaim(); else toast("Add at least one skill — or switch to the CV upload", "danger"); }}
            style={{ opacity: baselineDone ? 1 : 0.45 }}
          >
            Finish and claim
          </PfBtn>
        </Row>
      </div>
    </div>
  );

  /* ============================== PHASE · landing ========================== */

  const growthCard = (
    <PfCard key="growth">
      <PfCardHead title={GROWTH_SKELETON.headline} sub={`From: ${GROWTH_SKELETON.from}`}>
        <PfTile icon="target" tone="green" size={30} />
      </PfCardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
          <Note>{GROWTH_SKELETON.readinessNote}</Note>
        </div>

        <div>
          <Eyebrow>Where this could go</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {GROWTH_SKELETON.targets.map((t) => (
              <Row key={t.role} style={{ background: targetPicked ? "var(--pf-primary-50)" : "var(--pf-n0)", border: `1px solid ${targetPicked ? "var(--pf-primary-100)" : "var(--pf-n100)"}`, borderRadius: 10, padding: "12px 14px" }}>
                <PfTile icon="swap" tone="green" size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.role}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{t.match}% of the skills this role asks for are already on your baseline</div>
                </div>
                <PfBtn
                  variant={targetPicked ? "secondary" : "primary"}
                  small
                  onClick={() => { setTargetPicked(!targetPicked); toast(targetPicked ? "Target cleared" : `${t.role} set as your target`, targetPicked ? "default" : "success"); }}
                >
                  {targetPicked ? "Chosen" : "Make this my target"}
                </PfBtn>
              </Row>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>What would need to grow</Eyebrow>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {GROWTH_SKELETON.gaps.map((g) => (
              <Row key={g.skill} style={{ gap: 12 }}>
                <span style={{ fontSize: 12.5, color: "var(--pf-n600)", width: 150, flex: "none" }}>{g.skill}</span>
                <PfSegments score={g.have} outOf={5} tone="green" />
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>now {g.have} · the role wants {g.need}</span>
              </Row>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>Your next three moves</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {GROWTH_SKELETON.next.map((n, i) => (
              <Row key={n} style={{ gap: 9, padding: "7px 0" }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: i === 0 && targetPicked ? "var(--pf-primary-500)" : i === 1 && milestones.length > 0 ? "var(--pf-primary-500)" : "var(--pf-n50)" }}>
                  {((i === 0 && targetPicked) || (i === 1 && milestones.length > 0)) && <Ic name="check" size={11} color="#fff" weight={2.6} />}
                </span>
                <span style={{ fontSize: 12.5, color: i === 2 ? "var(--pf-n900)" : "var(--pf-n600)", fontWeight: i === 2 ? 600 : 400 }}>{n}</span>
              </Row>
            ))}
          </div>
          <Row style={{ gap: 8, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <Field
                value={milestoneDraft}
                onChange={setMilestoneDraft}
                placeholder="Add a milestone — e.g. lead the Kafka topology redesign"
                onEnter={() => {
                  if (!milestoneDraft.trim()) return;
                  setMilestones((m) => [...m, milestoneDraft.trim()]);
                  setMilestoneDraft("");
                  toast("Milestone added to your plan — private until you share it", "success");
                }}
              />
            </div>
            <PfBtn
              onClick={() => {
                if (!milestoneDraft.trim()) { toast("Write the milestone first", "danger"); return; }
                setMilestones((m) => [...m, milestoneDraft.trim()]);
                setMilestoneDraft("");
                toast("Milestone added to your plan — private until you share it", "success");
              }}
            >
              Add
            </PfBtn>
          </Row>
          {milestones.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {milestones.map((m, i) => (
                <Row key={i} style={{ gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "9px 11px" }}>
                  <Ic name="target" size={14} color="var(--pf-primary-500)" />
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n900)" }}>{m}</span>
                  <PfBadge tone="grey">Private</PfBadge>
                  <button onClick={() => setMilestones((x) => x.filter((_, j) => j !== i))} style={{ ...stepper(false), color: "var(--pf-n300)" }}>×</button>
                </Row>
              ))}
            </div>
          )}
        </div>
      </div>
    </PfCard>
  );

  const courseCostNum = Number(courseCost.replace(/[^0-9]/g, "")) || 0;
  const needsApproval = courseCostNum > LND_ENTITLEMENT.approverThreshold;
  const drawn = requests.reduce((a, r) => a + r.cost, 0);
  /** Her approver — read off the imported record, and off her correction if she made one. */
  const lineManager =
    corrections["Line manager"] ?? IMPORTED_PROFILE.find((f) => f.field === "Line manager")?.imported ?? "your manager";

  const learningCard = (
    <PfCard key="learning">
      <PfCardHead title={LND_ENTITLEMENT.headline} sub={`${lineManager} approves anything over ${fmtNaira(LND_ENTITLEMENT.approverThreshold)}.`}>
        <PfTile icon="book" tone="blue" size={30} />
      </PfCardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 14, color: "var(--pf-n600)", lineHeight: 1.6 }}>{LND_ENTITLEMENT.body}</div>

        <div>
          <Row style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <span style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>Company pool this year</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{fmtNaira(LND_ENTITLEMENT.poolNaira)}</span>
          </Row>
          <PfProgress pct={(drawn / LND_ENTITLEMENT.poolNaira) * 100} tone="blue" />
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 7 }}>
            You have drawn {fmtNaira(drawn)} of it. There is no personal cap — the pool is drawn against, and no course is ever
            expensed back to you.
          </div>
        </div>

        {requests.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {requests.map((r, i) => (
              <Row key={i} style={{ gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}>
                <Ic name="book" size={14} color="var(--pf-blue-500)" />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{r.name}</span>
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{fmtNaira(r.cost)}</span>
                <PfBadge tone={r.cost > LND_ENTITLEMENT.approverThreshold ? "yellow" : "green"}>
                  {r.cost > LND_ENTITLEMENT.approverThreshold ? "With your manager" : "Auto-approved"}
                </PfBadge>
              </Row>
            ))}
          </div>
        )}

        {courseOpen ? (
          <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14, animation: "scIn .18s ease" }}>
            <Row style={{ gap: 8, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}><Field value={courseName} onChange={setCourseName} placeholder="What do you want to learn?" /></div>
              <div style={{ width: 140 }}><Field value={courseCost} onChange={setCourseCost} placeholder="Cost in ₦" /></div>
            </Row>
            <Row style={{ gap: 8, marginTop: 10 }}>
              <PfBtn
                variant="primary"
                onClick={() => {
                  if (!courseName.trim() || courseCostNum <= 0) { toast("Give it a name and a cost", "danger"); return; }
                  setRequests((r) => [...r, { name: courseName.trim(), cost: courseCostNum }]);
                  toast(
                    needsApproval
                      ? `Sent to ${lineManager.split(" ")[0]} — over ${fmtNaira(LND_ENTITLEMENT.approverThreshold)}`
                      : "Approved from the pool — no manager sign-off needed",
                    "success",
                  );
                  setCourseName(""); setCourseCost(""); setCourseOpen(false);
                }}
              >
                Request it
              </PfBtn>
              <PfBtn variant="ghost" onClick={() => setCourseOpen(false)}>Cancel</PfBtn>
              <span style={{ flex: 1 }} />
              {courseCostNum > 0 && (
                <PfBadge tone={needsApproval ? "yellow" : "green"}>
                  {needsApproval ? `Over ${fmtNaira(LND_ENTITLEMENT.approverThreshold)} — needs your manager` : "Under the threshold — straight through"}
                </PfBadge>
              )}
            </Row>
          </div>
        ) : (
          <Row style={{ gap: 8 }}>
            <PfBtn variant="primary" icon="plus" onClick={() => setCourseOpen(true)}>Request a course or coaching</PfBtn>
            {/* Learning lives in HER workspace, not the L&D admin hub: `learning`
                is the org-wide L&D surface and would land on OsShell's restricted
                panel. `mylearning` is her own catalogue and entitlement. */}
            <PfBtn onClick={() => { setPersona("employee"); toast("Opening your catalogue — courses and coaching, never out of pocket", "default"); go("mylearning"); }}>
              Browse the catalogue
            </PfBtn>
          </Row>
        )}
      </div>
    </PfCard>
  );

  const feedbackCard = (
    <PfCard key="feedback">
      <PfCardHead title={FEEDBACK_INVITE.headline} sub={FEEDBACK_INVITE.body}>
        <PfTile icon="megaphone" tone="purple" size={30} />
      </PfCardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        {fbSent.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {fbSent.map((f, i) => (
              <Row key={i} style={{ gap: 8, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 9, padding: "10px 12px" }}>
                <Ic name="check" size={14} color="var(--pf-primary-500)" />
                <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n900)" }}>
                  {f.mode === "give" ? "Feedback sent to" : "Feedback requested from"} <b>{f.to}</b>
                </span>
                <PfBadge tone="green">Visible to you both</PfBadge>
              </Row>
            ))}
          </div>
        )}

        {fbMode ? (
          <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14, animation: "scIn .18s ease" }}>
            <Row style={{ gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{fbMode === "give" ? "To" : "From"}</span>
              <select
                value={fbTo}
                onChange={(e) => setFbTo(e.target.value)}
                style={{ flex: 1, fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "8px 10px" }}
              >
                {COLLEAGUES.map((c) => <option key={c.empId} value={c.name}>{c.name} · {c.dept}</option>)}
              </select>
            </Row>
            <Field
              value={fbText}
              onChange={setFbText}
              area
              placeholder={fbMode === "give" ? "What did they do, and what did it change?" : "What would you like their read on?"}
            />
            <Row style={{ gap: 8, marginTop: 10 }}>
              <PfBtn
                variant="primary"
                onClick={() => {
                  if (!fbText.trim()) { toast("Write something first", "danger"); return; }
                  setFbSent((s) => [...s, { mode: fbMode, to: fbTo }]);
                  setFbText(""); setFbMode(null);
                  toast(fbMode === "give" ? `Sent to ${fbTo} — they see it, and so do you` : `Request sent to ${fbTo}`, "success");
                }}
              >
                {fbMode === "give" ? "Send it" : "Ask"}
              </PfBtn>
              <PfBtn variant="ghost" onClick={() => setFbMode(null)}>Cancel</PfBtn>
              <span style={{ flex: 1 }} />
              <Note>Nothing anonymous, in either direction.</Note>
            </Row>
          </div>
        ) : (
          <Row style={{ gap: 8 }}>
            <PfBtn variant="primary" icon="paperplane" onClick={() => setFbMode("give")}>{FEEDBACK_INVITE.actions[0]}</PfBtn>
            <PfBtn icon="chat" onClick={() => setFbMode("request")}>{FEEDBACK_INVITE.actions[1]}</PfBtn>
          </Row>
        )}
      </div>
    </PfCard>
  );

  const transparencyTeaser = (
    <PfCard key="transparency" style={{ borderColor: "var(--pf-n100)" }}>
      <PfCardHead title="Now the honest part" sub="What your manager can see, and what stays yours">
        <PfTile icon="shield" tone="yellow" size={30} />
      </PfCardHead>
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 14, color: "var(--pf-n600)", lineHeight: 1.65, marginBottom: 14 }}>
          Twelve data categories, three columns, and the rule behind every line. It includes the parts that are uncomfortable to
          write down — because a list that only contains the flattering rows is not worth reading.
        </div>
        <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
          {/* One row her manager DOES see, first — a three-row preview of nothing
              but reassurances would not evidence the sentence above it. */}
          {[VISIBILITY[1], VISIBILITY[5], VISIBILITY[VISIBILITY_CALLOUT_INDEX]].map((r, i) => (
            <Row key={r.item} style={{ gap: 12, padding: "11px 14px", borderBottom: i === 2 ? "none" : "1px solid var(--pf-n50)", background: i === 2 ? "var(--pf-yellow-50)" : "var(--pf-n0)" }}>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{r.item}</span>
              <Verdict v={r.manager} />
            </Row>
          ))}
        </div>
        <PfBtn variant="primary" icon="shield" onClick={() => setPhase("transparency")}>See all twelve, in full</PfBtn>
      </div>
    </PfCard>
  );

  const LANDING_CARDS: Record<(typeof CLAIM_LANDING_ORDER)[number], ReactNode> = {
    growth: growthCard,
    learning: learningCard,
    feedback: feedbackCard,
    transparency: transparencyTeaser,
  };

  const landingBody = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PfCard>
        <div style={{ padding: "26px 28px" }}>
          <Row style={{ gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <PfBadge tone="green" dot>Account claimed</PfBadge>
            {elapsed !== null && <PfBadge tone="grey">{fmtElapsed(elapsed)} · median is {ROLLOUT.medianClaimMinutes} min</PfBadge>}
            <PfBadge tone="blue">{skills.length} skills baselined</PfBadge>
            {correctionCount > 0 && <PfBadge tone="yellow">{correctionCount} change request{correctionCount > 1 ? "s" : ""} with People Ops</PfBadge>}
          </Row>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.8px", color: "var(--pf-n900)", margin: 0, lineHeight: 1.2 }}>
            Welcome in, {ME.name.split(" ")[0]}. Here is what is now yours.
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--pf-n500)", lineHeight: 1.65, margin: "12px 0 0", maxWidth: 640 }}>
            No dashboard about you, no score waiting on the other side of this page. Three things you can use today — and then the
            full, unflattering list of who can see what.
          </p>
        </div>
      </PfCard>

      {/* The order is the product decision — driven literally by CLAIM_LANDING_ORDER. */}
      {CLAIM_LANDING_ORDER.map((k) => LANDING_CARDS[k])}

      <PfCard>
        <div style={{ padding: "20px 24px" }}>
          <Row style={{ gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>Your workspace is ready</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.55 }}>
                Goals, learning, feedback and your payslip — scoped to you and nobody else. It works offline and WhatsApp nudges
                deep-link straight into it.
              </div>
            </div>
            <Row style={{ gap: 10 }}>
              <PfBtn onClick={() => setPhase("transparency")}>Read what&rsquo;s visible first</PfBtn>
              <PfBtn variant="primary" icon="arrowright" onClick={enterWorkspace} style={{ fontSize: 13.5, padding: "11px 18px" }}>
                Open my workspace
              </PfBtn>
            </Row>
          </Row>
        </div>
      </PfCard>
    </div>
  );

  /* =========================== PHASE · transparency ======================== */

  const visRows: { row: VisibilityRow; i: number }[] = VISIBILITY.map((row, i) => ({ row, i })).filter(({ row }) =>
    vFilter === "all" ? true : vFilter === "manager" ? row.manager !== "no" : row.manager === "no",
  );

  const managerSees = VISIBILITY.filter((r) => r.manager !== "no").length;

  const transparencyBody = (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PfCard>
        <div style={{ padding: "26px 28px" }}>
          <Eyebrow tone="yellow">The adoption unlock</Eyebrow>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.7px", color: "var(--pf-n900)", margin: "10px 0 0", lineHeight: 1.2 }}>
            What&rsquo;s visible, and to whom
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--pf-n500)", lineHeight: 1.65, margin: "12px 0 0", maxWidth: 680 }}>
            Twelve data categories. Three columns. Every line cites the rule it comes from, so you can check it against the screen
            that enforces it rather than taking this page&rsquo;s word for it. Your manager can see{" "}
            <b style={{ color: "var(--pf-n900)" }}>{managerSees} of the {VISIBILITY.length}</b> — in full or in summary. The other{" "}
            {VISIBILITY.length - managerSees} are not theirs to see.
          </p>
          <Row style={{ gap: 4, marginTop: 18, background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: 4, width: "fit-content" }}>
            {([
              { id: "all" as const, label: `All ${VISIBILITY.length}` },
              { id: "manager" as const, label: `Your manager sees · ${managerSees}` },
              { id: "private" as const, label: `Not visible to your manager · ${VISIBILITY.length - managerSees}` },
            ]).map((f) => (
              <button
                key={f.id}
                onClick={() => setVFilter(f.id)}
                style={{
                  fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: vFilter === f.id ? "var(--pf-n0)" : "transparent",
                  color: vFilter === f.id ? "var(--pf-n900)" : "var(--pf-n400)",
                  boxShadow: vFilter === f.id ? "0 1px 3px rgba(2,6,23,.08)" : "none",
                }}
              >
                {f.label}
              </button>
            ))}
          </Row>
        </div>
      </PfCard>

      <PfCard>
        <PfCardHead title="The matrix" sub="You · your manager · HR">
          <Row style={{ gap: 12, flexWrap: "wrap" }}>
            <Verdict v="sees" />
            <Verdict v="sees-summary" />
            <Verdict v="no" />
          </Row>
        </PfCardHead>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 860 }}>
            <Row style={{ gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Data about you</span>
              <span style={{ width: 130, fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>You</span>
              <span style={{ width: 130, fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Your manager</span>
              <span style={{ width: 130, fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>HR</span>
            </Row>
            {visRows.map(({ row, i }) => {
              const callout = i === VISIBILITY_CALLOUT_INDEX;
              /* You see everything about you — except the risk score, which is HRBP-only
                 and reachable only through the right-to-explanation below. Saying
                 otherwise on a transparency page would be the one unforgivable lie. */
              const you: "sees" | "request" = callout ? "request" : "sees";
              return (
                <div
                  key={row.item}
                  style={{
                    padding: "14px 20px",
                    borderBottom: "1px solid var(--pf-n50)",
                    background: callout ? "var(--pf-yellow-50)" : "var(--pf-n0)",
                    borderLeft: callout ? "3px solid var(--pf-yellow-500)" : "3px solid transparent",
                  }}
                >
                  <Row style={{ gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Row style={{ gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{row.item}</span>
                        {callout && <PfBadge tone="yellow" dot>The uncomfortable one</PfBadge>}
                      </Row>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.55, maxWidth: 460 }}>{row.why}</div>
                      <Row style={{ gap: 6, marginTop: 7 }}>
                        <Ic name="file" size={12} color="var(--pf-n300)" />
                        <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{row.source}</span>
                      </Row>
                    </div>
                    <div style={{ width: 130, flex: "none", paddingTop: 2 }}><Verdict v={you} /></div>
                    <div style={{ width: 130, flex: "none", paddingTop: 2 }}><Verdict v={row.manager} /></div>
                    <div style={{ width: 130, flex: "none", paddingTop: 2 }}><Verdict v={row.hr} /></div>
                  </Row>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: "14px 20px" }}>
          <Note>
            Showing {visRows.length} of {VISIBILITY.length}. Nothing is hidden behind a filter — the filters only reorder your
            reading.
          </Note>
        </div>
      </PfCard>

      <PfCard>
        <PfCardHead title={RIGHT_TO_EXPLANATION.headline} sub={`A person answers within ${RIGHT_TO_EXPLANATION.slaDays} days — not a model`}>
          <PfTile icon="question" tone="purple" size={30} />
        </PfCardHead>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 14, color: "var(--pf-n600)", lineHeight: 1.65 }}>{RIGHT_TO_EXPLANATION.body}</div>
          <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px" }}>
            <Row style={{ gap: 8, alignItems: "flex-start" }}>
              <Ic name="swap" size={15} color="var(--pf-purple-500)" />
              <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{RIGHT_TO_EXPLANATION.mirrors}</span>
            </Row>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {RIGHT_TO_EXPLANATION.decisions.map((d) => {
              const asked = explained[d.what];
              return (
                <div key={d.what} style={{ border: `1px solid ${asked ? "var(--pf-primary-100)" : "var(--pf-n100)"}`, background: asked ? "var(--pf-primary-50)" : "var(--pf-n0)", borderRadius: 11, padding: 16 }}>
                  <Row style={{ gap: 8, marginBottom: 10 }}>
                    <PfTile icon="sparkle" tone={asked ? "green" : "purple"} size={26} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{d.what}</span>
                  </Row>
                  {[
                    { k: "Who sees it", v: d.who },
                    { k: "What it is based on", v: d.basis },
                    { k: "What you can ask for", v: d.yourMove },
                  ].map((r) => (
                    <Row key={r.k} style={{ gap: 8, alignItems: "flex-start", padding: "4px 0" }}>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 118, flex: "none" }}>{r.k}</span>
                      <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.5 }}>{r.v}</span>
                    </Row>
                  ))}
                  <div style={{ marginTop: 12 }}>
                    {asked ? (
                      <PfBadge tone="green" dot>Requested · answer within {RIGHT_TO_EXPLANATION.slaDays} days</PfBadge>
                    ) : (
                      <PfBtn
                        small
                        onClick={() => { setExplained((e) => ({ ...e, [d.what]: true })); toast(`Explanation requested · ${d.what} — ${RIGHT_TO_EXPLANATION.slaDays}-day SLA`, "success"); }}
                      >
                        Request an explanation
                      </PfBtn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
            <Row style={{ gap: 8 }}>
              <Ic name="shield" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{RIGHT_TO_EXPLANATION.logged}</span>
            </Row>
          </div>
        </div>
      </PfCard>

      <PfCard>
        <div style={{ padding: "20px 24px" }}>
          <Row style={{ gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>That is the whole list</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.55 }}>
                It does not change quietly. If a category moves columns, you are told before it does — and this page carries the date it last changed.
              </div>
            </div>
            <Row style={{ gap: 10 }}>
              <PfBtn onClick={() => setPhase("landing")}>Back to what&rsquo;s mine</PfBtn>
              <PfBtn variant="primary" icon="arrowright" onClick={enterWorkspace}>Open my workspace</PfBtn>
            </Row>
          </Row>
        </div>
      </PfCard>
    </div>
  );

  /* ================================= render ================================ */

  return (
    <div style={{ minHeight: "100vh", background: "var(--pf-n25)", fontFamily: "var(--pf-font)", color: "var(--pf-n900)", fontSize: 14 }}>
      {bar}
      <main style={{ maxWidth: phase === "transparency" ? 1120 : 1080, margin: "0 auto", padding: "28px 24px 72px" }}>
        {phase === "invite" && inviteBody}
        {phase === "verify" && verifyBody}
        {phase === "confirm" && confirmBody}
        {phase === "baseline" && baselineBody}
        {phase === "landing" && landingBody}
        {phase === "transparency" && transparencyBody}
      </main>
    </div>
  );
}

/* --------------------------- baseline method card -------------------------- */

function MethodCard({ icon, tone, title, minutes, used, note, onPick }: {
  icon: string; tone: PfTone; title: string; minutes: number; used: number; note: string; onPick: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onPick}
      style={{
        background: "var(--pf-n0)", border: `1px solid ${hovered ? TONE[tone].line : "var(--pf-n50)"}`, borderRadius: 12,
        boxShadow: hovered ? "0 8px 20px -12px rgba(2,6,23,.22)" : "0 1px 3px 0 #f3f3f3", padding: 20, cursor: "pointer",
        transition: "box-shadow .15s ease, border-color .15s ease",
      }}
    >
      <PfTile icon={icon} tone={tone} size={38} />
      <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 12 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55 }}>{note}</div>
      <Row style={{ gap: 8, marginTop: 14 }}>
        <PfBadge tone={tone}>≈ {minutes} min</PfBadge>
        <PfBadge tone="grey">{used} colleagues chose this</PfBadge>
        <span style={{ flex: 1 }} />
        <Ic name="arrowright" size={16} color={TONE[tone].fg} />
      </Row>
    </div>
  );
}
