"use client";
import { useEffect, useRef, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useAssessment } from "@/state/assessment";
import { personaById } from "@/data/personas";
import { PfBadge, PfBtn, PfCard, PfProgress, PfTile } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  TYPE_LABEL,
  isAnswered,
  wordCount,
  type AnswerMap,
  type AnswerValue,
  type CandidateAssessment,
} from "@/data/assessment";

/**
 * The candidate's assessment player.
 *
 * It has ONE data source: `candidateAssessment(name)`, which runs the record
 * through `toCandidateView()` and returns null for anything whose status is not
 * "sent". So an un-approved, un-dispatched brief is not merely hidden here — it
 * is unreachable, because this screen holds no questions of its own. The old
 * hardcoded `questions` / `assessCriteria` arrays are gone: the assessment a
 * recruiter sets is now literally the assessment a candidate takes.
 *
 * Everything shown is candidate-safe: `answerKey` never crosses the accessor,
 * and no scores, grades or other applicants appear anywhere on this screen.
 */

const ME = personaById("candidate");
/** Matched against the dispatch recipient list inside the store. */
const CANDIDATE = ME.name;
/** Audit actor, in the app-wide `Name (Title)` format. */
const ACTOR = `${ME.name} (${ME.title})`;

type CQ = CandidateAssessment["questions"][number];

const KIND_KICKER: Record<CQ["kind"], string> = {
  longtext: "Written answer",
  upload: "File or link",
  video: "Short recording",
  mcq: "Pick one",
};

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const timeLabel = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "3 hours" / "90 minutes" — how much work the record says this is. */
const effortLabel = (mins: number) => {
  if (mins < 90) return `${mins} minutes`;
  const h = Math.round((mins / 60) * 2) / 2;
  return `${h} hour${h === 1 ? "" : "s"}`;
};

/* ------------------------------------------------------------------ *
 * Small shared bits
 * ------------------------------------------------------------------ */

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none",
        padding: 0, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        color: hovered ? "var(--pf-primary-500)" : "var(--pf-n400)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}

function MetaDot() {
  return <span style={{ color: "var(--pf-n300)" }}>·</span>;
}

/** "Scored on: Systems thinking · 25%" — computed from the record, never typed. */
function ScoredOn({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {labels.map((l) => (
          <span
            key={l}
            style={{
              fontSize: 11, fontWeight: 600, background: "var(--pf-purple-50)", color: "var(--pf-purple-500)",
              border: "0.6px solid var(--pf-purple-100)", padding: "4px 11px", borderRadius: 5,
            }}
          >
            Scored on: {l}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.55 }}>
        These are the only things this question counts towards — the same list, at the same weights, for
        everyone doing this exercise.
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Question bodies — one per kind, because the record says which kind it is
 * ------------------------------------------------------------------ */

function LongTextBody({ q, value, onChange }: { q: CQ; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const text = value.text ?? "";
  const words = wordCount(text);
  const met = !q.minWords || words >= q.minWords;
  return (
    <>
      <textarea
        value={text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        placeholder="Start typing your answer here…"
        style={{
          display: "block", width: "100%", boxSizing: "border-box", minHeight: 180,
          border: "1px solid var(--pf-n100)", borderRadius: 10, background: "var(--pf-n25)",
          padding: "13px 14px", fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.65,
          fontFamily: "inherit", resize: "vertical", outline: "none",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: met ? "var(--pf-primary-600)" : "var(--pf-n400)" }}>
          {words}{q.minWords ? ` / ${q.minWords}` : ""} word{words === 1 ? "" : "s"}
        </span>
        {q.minWords && (
          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
            {met ? "Long enough — write more if it helps." : `Please write at least ${q.minWords} words.`}
          </span>
        )}
      </div>
    </>
  );
}

function AttachBody({ q, value, onChange }: { q: CQ; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [link, setLink] = useState("");
  const { hovered, hoverProps } = useHover();
  const files = value.files ?? [];
  const video = q.kind === "video";

  const add = (items: string[]) => {
    if (!items.length) return;
    onChange({ ...value, files: [...files, ...items] });
  };
  const addLink = () => {
    const v = link.trim();
    if (!v) return;
    add([v]);
    setLink("");
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={video ? "video/*" : ".pdf,.png,.jpg,.jpeg,.gif,.fig,.sketch,.zip"}
        onChange={(e) => {
          add(Array.from(e.target.files ?? []).map((f) => f.name));
          e.target.value = "";
        }}
        style={{ display: "none" }}
      />

      <div
        {...hoverProps}
        onClick={() => fileRef.current?.click()}
        style={{
          display: "flex", alignItems: "center", gap: 9, border: "1px dashed var(--pf-n100)",
          borderRadius: 10, padding: "14px 15px", fontSize: 12.5, color: "var(--pf-n500)",
          cursor: "pointer", background: hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        }}
      >
        <Ic name={video ? "play" : "file"} size={17} color="var(--pf-n400)" />
        <span style={{ fontWeight: 600 }}>
          {video ? `Upload your recording — max ${q.maxMinutes ?? 2} min` : `Attach ${q.accept ?? "a file"}`}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Choose from your device</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addLink();
            }
          }}
          placeholder={video ? "…or paste a link to your recording" : "…or paste a link (Figma, Drive, your site)"}
          style={{
            flex: 1, minWidth: 0, boxSizing: "border-box", border: "1px solid var(--pf-n100)", borderRadius: 9,
            background: "var(--pf-n25)", padding: "10px 13px", fontSize: 12.5, color: "var(--pf-n900)",
            fontFamily: "inherit", outline: "none",
          }}
        />
        <PfBtn onClick={addLink} icon="plus">Add link</PfBtn>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {files.map((f, i) => (
            <div
              key={`${f}-${i}`}
              style={{
                display: "flex", alignItems: "center", gap: 9, background: "var(--pf-n25)",
                border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "9px 12px",
              }}
            >
              <Ic name={f.startsWith("http") ? "arrowsq" : "file"} size={15} color="var(--pf-n400)" />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f}</span>
              <button
                onClick={() => onChange({ ...value, files: files.filter((_, j) => j !== i) })}
                aria-label={`Remove ${f}`}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2, color: "var(--pf-n400)" }}
              >
                <Ic name="x" size={15} color="var(--pf-n400)" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function McqBody({ q, value, onChange }: { q: CQ; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(q.options ?? []).map((opt, i) => {
        const picked = value.choice === i;
        return (
          <button
            key={`${q.id}-${i}`}
            onClick={() => onChange({ ...value, choice: i })}
            style={{
              display: "flex", alignItems: "flex-start", gap: 11, textAlign: "left", fontFamily: "inherit",
              background: picked ? "var(--pf-primary-50)" : "var(--pf-n0)",
              border: `1px solid ${picked ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer",
              fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.55,
            }}
          >
            <span
              style={{
                width: 17, height: 17, borderRadius: "50%", flex: "none", marginTop: 1,
                border: `1.6px solid ${picked ? "var(--pf-primary-500)" : "var(--pf-n300)"}`,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {picked && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pf-primary-500)" }} />}
            </span>
            <span style={{ flex: 1 }}>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

/** `key={q.id}` so moving between two questions of the same kind starts clean. */
function QuestionBody({ q, value, onChange }: { q: CQ; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  if (q.kind === "mcq") return <McqBody key={q.id} q={q} value={value} onChange={onChange} />;
  if (q.kind === "upload" || q.kind === "video") return <AttachBody key={q.id} q={q} value={value} onChange={onChange} />;
  return <LongTextBody key={q.id} q={q} value={value} onChange={onChange} />;
}

/** One line describing what the candidate put into a question — used on the receipt. */
function describeAnswer(q: CQ, v?: AnswerValue): string {
  if (!v) return "Left blank";
  if (q.kind === "mcq") return typeof v.choice === "number" ? (q.options?.[v.choice] ?? "Answer chosen") : "Left blank";
  if (q.kind === "upload" || q.kind === "video") {
    const n = v.files?.length ?? 0;
    return n ? `${n} item${n === 1 ? "" : "s"} attached` : "Nothing attached";
  }
  const w = wordCount(v.text ?? "");
  return w ? `${w} words written` : "Left blank";
}

/* ------------------------------------------------------------------ *
 * Screen
 * ------------------------------------------------------------------ */

export default function AssessTake() {
  const go = useGo();
  const toast = useToast();
  const { hydrated, candidateAssessment, draftFor, submissionFor, saveAnswers, submitAnswers } = useAssessment();

  // The ONLY data source. Null unless a brief was approved and dispatched to me.
  const a = candidateAssessment(CANDIDATE);
  const submission = a ? submissionFor(a.id, CANDIDATE) : undefined;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [briefOpen, setBriefOpen] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Load my saved draft once the store has read localStorage. Adjusting state
  // during render (rather than in an effect) keeps server and client output
  // identical and avoids a second paint.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const key = hydrated && a ? `${a.id}:${CANDIDATE}` : null;
  if (a && key && key !== loadedKey) {
    setLoadedKey(key);
    setAnswers(draftFor(a.id, CANDIDATE));
  }

  /* ---- the clock: a real countdown, and it survives a reload ---- */
  // A timed sitting counts down from the record's own duration; the moment the
  // candidate opened it is stamped in localStorage, so reloading the page does
  // not hand out extra time. A take-home has no ticking clock at all — its
  // chrome shows the deadline it was dispatched with instead.
  const timed = a ? a.type !== "take-home" : false;
  const durationMins = a?.durationMins ?? 0;
  const startKey = a ? `hirebrew.assessment.started.${a.id}.${CANDIDATE}` : null;

  useEffect(() => {
    if (!timed || !startKey) return;
    let startedAt: number | null = null;
    const tick = () => {
      if (startedAt === null) {
        let t = Date.now();
        try {
          const raw = window.localStorage.getItem(startKey);
          if (raw && Number.isFinite(Number(raw))) t = Number(raw);
          else window.localStorage.setItem(startKey, String(t));
        } catch {}
        startedAt = t;
      }
      setRemaining(durationMins * 60_000 - (Date.now() - startedAt));
    };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [timed, startKey, durationMins]);

  /* ---- auto-save: "your work auto-saves" is now true ---- */
  const dirty = useRef(false);
  const saveRef = useRef(saveAnswers);
  useEffect(() => {
    saveRef.current = saveAnswers;
  });
  const aid = a?.id;
  const done = Boolean(submission);
  useEffect(() => {
    if (!aid || done || !dirty.current) return;
    const id = window.setTimeout(() => {
      saveRef.current(aid, CANDIDATE, answers);
      setSavedAt(timeLabel());
    }, 1200);
    return () => window.clearTimeout(id);
  }, [answers, aid, done]);

  /* ---- nothing has been sent to me ---- */
  if (!a) {
    return (
      <div style={{ padding: "24px 28px 60px", maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <BackLink onClick={() => go("cportal")} label="Back to my application" />
        </div>
        <PfCard style={{ padding: "34px 30px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <PfTile icon="clipboard" tone="grey" size={44} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", marginBottom: 7 }}>
            No assessment has been sent to you yet
          </div>
          <div style={{ fontSize: 13.5, color: "var(--pf-n500)", lineHeight: 1.65, maxWidth: 460, margin: "0 auto 20px" }}>
            Exercises are written by the hiring team and signed off by the hiring manager before anyone is asked
            to do one. As soon as yours is sent, it will appear here with the full brief and a deadline.
          </div>
          <PfBtn variant="primary" onClick={() => go("cportal")} icon="arrowright">
            Back to my application
          </PfBtn>
        </PfCard>
      </div>
    );
  }

  const total = a.questions.length;
  const q = a.questions[Math.min(step, total - 1)];
  const answered = a.questions.filter((x) => isAnswered(x, answers[x.id])).length;
  const chips = a.rubricChips.find((c) => c.qid === q?.id)?.labels ?? [];
  const setAnswer = (v: AnswerValue) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [q.id]: v }));
  };

  /* ---- already handed in: the receipt, not the form ---- */
  if (submission) {
    return (
      <div style={{ padding: "24px 28px 60px", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <BackLink onClick={() => go("cportal")} label="Back to my application" />
        </div>

        <PfCard style={{ padding: "28px 28px 24px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <PfTile icon="check" tone="green" size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>
                Your work is in
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                {a.title} · sent {submission.submittedAt}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
            {a.questions.map((x) => (
              <div
                key={x.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10, fontSize: 12.5,
                  padding: "9px 0", borderBottom: "1px solid var(--pf-n50)",
                }}
              >
                <Ic name="check" size={15} color="var(--pf-primary-500)" />
                <span style={{ flex: 1, minWidth: 0, color: "var(--pf-n600)", fontWeight: 600 }}>{x.title}</span>
                <span style={{ color: "var(--pf-n400)" }}>{describeAnswer(x, submission.answers[x.id])}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 10 }}>
            WHAT HAPPENS NOW
          </div>
          <ol style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 9 }}>
            <li style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6 }}>
              Your answers are read and scored against the criteria that were shown on each question — nothing else.
            </li>
            <li style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6 }}>
              Written work goes through an originality check. If it flags anything, a person reads your answer
              themselves. It is never an automatic rejection.
            </li>
            <li style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6 }}>
              {a.dispatch?.dueAt
                ? `Everyone's work is due by ${a.dispatch.dueAt}. You'll hear back once the whole group has been reviewed.`
                : "You'll hear back once everyone's work has been reviewed."}
            </li>
            <li style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6 }}>
              You can ask for an explanation of any decision at any point, from your application page.
            </li>
          </ol>
        </PfCard>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PfBtn variant="primary" onClick={() => go("cportal")} icon="arrowright">
            Back to my application
          </PfBtn>
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
            Nothing more to do here — your answers are locked so they match what you were asked.
          </span>
        </div>
      </div>
    );
  }

  /* ---- the clock chip ---- */
  const expired = remaining !== null && remaining <= 0;

  const clockChip = timed ? (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600,
        padding: "6px 13px", borderRadius: 6,
        color: expired ? "var(--pf-red-500)" : "var(--pf-yellow-500)",
        background: expired ? "var(--pf-red-50)" : "var(--pf-yellow-50)",
        border: `0.6px solid ${expired ? "var(--pf-red-100)" : "var(--pf-yellow-100)"}`,
      }}
    >
      <Ic name="clock" size={15} color={expired ? "var(--pf-red-500)" : "var(--pf-yellow-500)"} />
      {remaining === null
        ? `${a.durationMins} min to do this`
        : expired
          ? "Time's up — send what you have"
          : `${clock(remaining)} left`}
    </span>
  ) : (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600,
        color: "var(--pf-n500)", background: "var(--pf-n25)", border: "0.6px solid var(--pf-n100)",
        padding: "6px 13px", borderRadius: 6,
      }}
    >
      <Ic name="calendar" size={15} color="var(--pf-n400)" />
      {a.dispatch?.dueAt ? `Due ${a.dispatch.dueAt}` : `${a.window ?? "Open"} to submit`}
    </span>
  );

  const submit = () => {
    const missing = a.questions.find((x) => x.required && !isAnswered(x, answers[x.id]));
    if (missing) {
      setStep(a.questions.findIndex((x) => x.id === missing.id));
      toast(
        missing.kind === "longtext" && missing.minWords
          ? `“${missing.title}” needs at least ${missing.minWords} words before you can send it.`
          : `“${missing.title}” still needs an answer.`,
        "danger",
      );
      return;
    }
    submitAnswers(a.id, CANDIDATE, answers, ACTOR);
    toast("Sent — we'll be in touch", "success");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 880, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <BackLink onClick={() => go("cportal")} label="Back to my application" />
        {clockChip}
      </div>

      {/* What this is */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "var(--pf-purple-500)", marginBottom: 5 }}>
          YOUR EXERCISE · {a.roleTitle.toUpperCase()}
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px", color: "var(--pf-n900)" }}>
          {a.title}
        </h1>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 12.5, color: "var(--pf-n400)" }}>
          <PfBadge tone="grey">{TYPE_LABEL[a.type]}</PfBadge>
          <MetaDot />
          <span>{a.type === "take-home" ? `About ${effortLabel(a.durationMins)} of work` : `${a.durationMins} minutes`}</span>
          <MetaDot />
          <span>{total} question{total === 1 ? "" : "s"}</span>
          {a.window && (
            <>
              <MetaDot />
              <span>{a.window} to hand it in</span>
            </>
          )}
        </div>
      </div>

      {/* The brief the recruiter wrote and the hiring manager approved */}
      <PfCard style={{ marginBottom: 14 }}>
        <button
          onClick={() => setBriefOpen((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none",
            padding: "15px 20px", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            borderBottom: briefOpen ? "1px solid var(--pf-n50)" : "none",
          }}
        >
          <PfTile icon="clipboard" tone="purple" size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>The brief</div>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>
              What you&apos;ve been asked to do, what to hand in, and how it&apos;s scored
            </div>
          </div>
          <span style={{ display: "inline-flex", transform: briefOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .15s ease" }}>
            <Ic name="caretdown" size={17} color="var(--pf-n400)" />
          </span>
        </button>

        {briefOpen && (
          <div style={{ padding: "16px 20px 18px" }}>
            <div style={{ fontSize: 13.5, color: "var(--pf-n600)", lineHeight: 1.7, marginBottom: 18 }}>{a.brief}</div>

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 9 }}>
              WHAT TO HAND IN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {a.deliverables.map((d) => (
                <div key={d.label} style={{ display: "flex", gap: 10 }}>
                  <span style={{ marginTop: 2, flex: "none" }}>
                    <Ic name="check" size={15} color="var(--pf-primary-500)" />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{d.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>{d.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 4 }}>
              HOW YOUR WORK IS SCORED
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6, marginBottom: 12 }}>
              These are the same criteria used at every step of this process — the interview included. Each
              question below tells you which ones it counts towards.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {a.rubric.map((d) => (
                <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 148, flex: "none", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)" }}>{d.dim}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <PfProgress pct={d.weight} tone="purple" height={6} />
                  </span>
                  <span style={{ width: 38, textAlign: "right", fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)" }}>
                    {d.weight}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </PfCard>

      {/* Progress through the questions */}
      <PfCard style={{ padding: "14px 18px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)" }}>
            Question {step + 1} of {total}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
            {answered} of {total} answered
          </span>
        </div>
        <PfProgress pct={(answered / total) * 100} tone="green" height={6} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
          {a.questions.map((x, i) => {
            const ok = isAnswered(x, answers[x.id]);
            const here = i === step;
            return (
              <button
                key={x.id}
                onClick={() => setStep(i)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
                  fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 7, cursor: "pointer",
                  color: here ? "var(--pf-n900)" : ok ? "var(--pf-primary-600)" : "var(--pf-n400)",
                  background: here ? "var(--pf-n50)" : ok ? "var(--pf-primary-50)" : "var(--pf-n0)",
                  border: `1px solid ${here ? "var(--pf-n100)" : ok ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                }}
              >
                {ok && <Ic name="check" size={13} color="var(--pf-primary-500)" />}
                {i + 1}. {KIND_KICKER[x.kind]}
              </button>
            );
          })}
        </div>
      </PfCard>

      {/* The question itself — rendered per its own kind */}
      <PfCard style={{ padding: "22px 24px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-purple-500)" }}>
            {q.kicker} · {step + 1} OF {total}
          </span>
          {!q.required && <PfBadge tone="grey">Optional</PfBadge>}
        </div>
        <h2 style={{ margin: "0 0 11px", fontSize: 19, fontWeight: 700, letterSpacing: "-.3px", color: "var(--pf-n900)" }}>
          {q.title}
        </h2>
        <div style={{ fontSize: 13.5, color: "var(--pf-n600)", lineHeight: 1.7, marginBottom: 16 }}>{q.prompt}</div>
        {chips.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <ScoredOn labels={chips} />
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 8 }}>Your answer</div>
        <QuestionBody q={q} value={answers[q.id] ?? {}} onChange={setAnswer} />
      </PfCard>

      {/* Move between questions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {step > 0 && (
          <PfBtn onClick={() => setStep((s) => Math.max(0, s - 1))} style={{ padding: "9px 16px", fontSize: 12.5 }}>
            Previous
          </PfBtn>
        )}
        <span style={{ flex: 1 }} />
        {step < total - 1 && (
          <PfBtn onClick={() => setStep((s) => Math.min(total - 1, s + 1))} icon="arrowright" style={{ padding: "9px 16px", fontSize: 12.5 }}>
            Next question
          </PfBtn>
        )}
      </div>

      {/* Save / send */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220, fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.6 }}>
          {savedAt ? `Saved automatically at ${savedAt}.` : "Your work saves itself as you type."} Written answers
          are checked for originality — anything flagged is read by a person, never rejected automatically, and you
          can always ask why.
        </div>
        <PfBtn
          onClick={() => {
            saveAnswers(a.id, CANDIDATE, answers);
            setSavedAt(timeLabel());
            toast("Draft saved — come back any time before the deadline");
          }}
          style={{ padding: "11px 18px", fontSize: 13 }}
        >
          Save and finish later
        </PfBtn>
        <PfBtn variant="primary" onClick={submit} icon="paperplane" style={{ padding: "11px 20px", fontSize: 13 }}>
          Send my answers
        </PfBtn>
      </div>
    </div>
  );
}
