"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuditEntry } from "@/state/lifecycle";
import type { PersonaId } from "@/data/personas";
import {
  SEED_ASSESSMENTS,
  SEED_SUBMISSIONS,
  SEED_AUDIT,
  MASTER_RUBRIC,
  RUBRIC_VERSION,
  ORG_POLICY,
  canApprove,
  canEditContent,
  canSend,
  canSubmitForReview,
  initialsOf,
  isAnswered,
  reviewReadiness,
  sendBlockReason,
  toCandidateView,
  type AnswerDraft,
  type AnswerMap,
  type Assessment,
  type AssessmentQuestion,
  type AssessmentStatus,
  type CandidateAssessment,
  type QuestionKind,
  type Submission,
} from "@/data/assessment";

/**
 * The assessment data layer — the record that Stage 05 authors, the hiring
 * manager approves, the recruiter dispatches and the candidate takes, held in
 * one persistent store so both ends of the chain read the same object.
 *
 * This provider is deliberately separate from lifecycle.tsx: the only thing
 * borrowed from it is the AuditEntry shape (a type-only import), so the two
 * stores can be reset independently while the app keeps one audit format.
 *
 * The dispatch gate is re-evaluated HERE, inside the reducer, using the very
 * same canSend() the button's disabled state uses. A component that forgets to
 * disable, a stale prop, a rewired Copilot action or a persona swap mid-flight
 * all bounce off this — the UI merely reflects a rule the data layer enforces.
 */

type AssessmentState = {
  assessments: Assessment[];
  submissions: Submission[];
  drafts: AnswerDraft[];
  audit: AuditEntry[];
};

export type ContentPatch = Partial<
  Pick<Assessment, "title" | "type" | "durationMins" | "window" | "brief" | "deliverables">
>;

export type QuestionPatch = Partial<Omit<AssessmentQuestion, "id">>;

type AssessmentApi = AssessmentState & {
  hydrated: boolean;

  /* reads */
  byId: (id: string) => Assessment | undefined;
  forRole: (roleId: string) => Assessment[];
  /** Stage 05's default record: the first one still in flight, else the latest sent. */
  activeForStage05: () => Assessment | undefined;
  submissionsFor: (id: string) => Submission[];
  submissionFor: (id: string, candidate: string) => Submission | undefined;
  /** The ONLY accessor the candidate side has — null unless status is "sent". */
  candidateAssessment: (name: string) => CandidateAssessment | null;
  draftFor: (id: string, candidate: string) => AnswerMap;
  auditFor: (subject: string) => AuditEntry[];

  /* authoring — hr only, each bumps version and invalidates a stale approval */
  updateDraft: (id: string, patch: ContentPatch, actor: string, persona: PersonaId) => void;
  updateQuestion: (id: string, qid: string, patch: QuestionPatch, actor: string, persona: PersonaId) => void;
  addQuestion: (id: string, kind: QuestionKind, actor: string, persona: PersonaId) => void;
  removeQuestion: (id: string, qid: string, actor: string, persona: PersonaId) => void;
  regenerate: (id: string, actor: string, persona: PersonaId) => void;

  /* the approval gate */
  submitForReview: (id: string, actor: string, persona: PersonaId) => void;
  withdrawReview: (id: string, actor: string, persona: PersonaId) => void;
  decide: (
    id: string,
    decision: "approved" | "changes_requested",
    comment: string,
    actor: string,
    persona: PersonaId,
  ) => void;
  reopen: (id: string, actor: string, persona: PersonaId) => void;
  revokeApproval: (id: string, comment: string, actor: string, persona: PersonaId) => void;
  send: (
    id: string,
    recipients: { name: string; init: string }[],
    actor: string,
    persona: PersonaId,
    dueAt?: string,
  ) => void;

  /* the candidate side */
  saveAnswers: (id: string, candidate: string, answers: AnswerMap) => void;
  submitAnswers: (id: string, candidate: string, answers: AnswerMap, actor: string) => void;

  resetDemo: () => void;
};

const KEY = "hirebrew.assessment.v1";

const SEED: AssessmentState = {
  assessments: SEED_ASSESSMENTS,
  submissions: SEED_SUBMISSIONS,
  drafts: [],
  audit: SEED_AUDIT,
};

const Ctx = createContext<AssessmentApi | null>(null);

const now = () =>
  new Date().toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const log = (s: AssessmentState, actor: string, action: string, subject: string): AuditEntry[] => [
  { at: now(), actor, action, subject },
  ...s.audit,
];

/**
 * The audit is keyed by title (the house shape, shared with lifecycle.tsx) —
 * but a Stage-05 title is editable, so renaming a brief would otherwise orphan
 * its own history. Carry the earlier entries across with it: the log belongs to
 * the record, not to the string it was called at the time.
 */
const retitle = (audit: AuditEntry[], from: string, to: string): AuditEntry[] =>
  from === to ? audit : audit.map((e) => (e.subject === from ? { ...e, subject: to } : e));

/**
 * A question id is minted from the highest suffix already used, never from the
 * list's length: removing Q2 must not free "Q3" for the next Add. Two questions
 * sharing an id would make one edit patch both, and the player keys answers,
 * rubric chips and React children by that id.
 */
const nextQid = (questions: AssessmentQuestion[]): string =>
  `Q${questions.reduce((max, q) => Math.max(max, Number(q.id.slice(1)) || 0), 0) + 1}`;

/** The floor a failed check lands on: no decision, no submission, no dispatch. */
const demoteRestored = (a: Assessment): Assessment => ({
  ...a,
  status: "editing",
  approval: {
    ...a.approval,
    decision: undefined,
    decidedAt: undefined,
    approvedVersion: undefined,
    submittedBy: undefined,
    submittedAt: undefined,
  },
  dispatch: undefined,
});

const STATUSES: ReadonlySet<string> = new Set<AssessmentStatus>([
  "drafted", "editing", "in_review", "changes_requested", "approved", "sent",
]);

/**
 * The fields the candidate side walks unguarded. toCandidateView() rebuilds
 * questions field-by-field and maps every `dimKeys` through the rubric, and
 * candidateAssessment() reads `recipients[].name` — all DURING RENDER, where a
 * TypeError white-screens the portal instead of failing closed. A status outside
 * the union fails here for the same reason: sendBlockReason's clauses are keyed
 * to the union, so an unrecognised status slips past every one of them.
 *
 * Shape can't be repaired the way a status can, so a record that fails this is
 * replaced by the seed it claims to be, never demoted in place.
 */
const shapeIsRenderable = (a: Assessment): boolean =>
  STATUSES.has(a.status) &&
  Array.isArray(a.questions) &&
  a.questions.every((q) => !!q && typeof q.id === "string" && Array.isArray(q.dimKeys)) &&
  Array.isArray(a.rubric) &&
  (!a.dispatch ||
    (Array.isArray(a.dispatch.recipients) &&
      a.dispatch.recipients.every((r) => !!r && typeof r.name === "string")));

/**
 * A restored record re-enters the app without passing a single transition, so
 * every privileged status is re-checked against the post-conditions its own
 * reducer would have written: "sent" must carry both the dispatch send() writes
 * and the version-bound approval send() demands, "approved" the decision
 * decide() records, "in_review" the submission submitForReview() stamps.
 * Anything short of that is demoted rather than trusted — "sent" above all,
 * since it is the one status toCandidateView() will hand to a candidate.
 *
 * This is a consistency check, NOT an authentication boundary: a client-side
 * store cannot authenticate its own contents. Nothing here consults the audit
 * log, submittedBy or decidedAt, so an internally consistent payload restores
 * exactly as written. It narrows a hand-edited record to a state the reducer
 * could have produced; it does not establish that anyone actually produced it.
 */
const sanitiseRestored = (a: Assessment): Assessment | null => {
  // Both gates are version-bound, and two ABSENT fields compare equal — so a
  // record whose version is not a number cannot be re-checked at all. It is
  // replaced by the seed it claims to be, never repaired in place.
  if (
    typeof a?.version !== "number" ||
    typeof a.approval?.reviewer?.personaId !== "string" ||
    !shapeIsRenderable(a)
  )
    return SEED_ASSESSMENTS.find((x) => x.id === a?.id) ?? null;

  const recipients = a.dispatch?.recipients;
  const approvalIsLive =
    a.approval.decision === "approved" &&
    typeof a.approval.approvedVersion === "number" &&
    a.approval.approvedVersion === a.version;
  const dispatchIsLive = Array.isArray(recipients) && recipients.length > 0;

  if (a.status === "sent") return approvalIsLive && dispatchIsLive ? a : demoteRestored(a);
  if (a.status === "approved") return approvalIsLive ? a : demoteRestored(a);
  if (a.status === "in_review") return a.approval.submittedBy && a.approval.submittedAt ? a : demoteRestored(a);
  return a;
};

const QUESTION_TEMPLATE: Record<QuestionKind, Omit<AssessmentQuestion, "id">> = {
  longtext: { kind: "longtext", kicker: "WRITTEN RESPONSE", title: "New written question", prompt: "", dimKeys: [], required: true, minWords: 120 },
  upload: { kind: "upload", kicker: "DESIGN EXERCISE", title: "New upload question", prompt: "", dimKeys: [], required: true, accept: "Figma link, PDF or PNG" },
  video: { kind: "video", kicker: "WALKTHROUGH", title: "New video question", prompt: "", dimKeys: [], required: true, maxMinutes: 2 },
  mcq: { kind: "mcq", kicker: "SYSTEMS JUDGEMENT", title: "New multiple-choice question", prompt: "", dimKeys: [], required: true, options: ["", "", "", ""], answerKey: 0 },
};

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AssessmentState>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  // Hydrate after mount (SSR-safe: server and first client render both use SEED).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as AssessmentState;
        if (saved && Array.isArray(saved.assessments) && Array.isArray(saved.submissions)) {
          setState({
            // A record with no seed to fall back on is dropped, not repaired.
            assessments: saved.assessments.map(sanitiseRestored).filter((a): a is Assessment => a !== null),
            submissions: saved.submissions,
            drafts: Array.isArray(saved.drafts) ? saved.drafts : [],
            audit: Array.isArray(saved.audit) ? saved.audit : SEED.audit,
          });
        }
      }
    } catch {}
    skipPersist.current = false;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skipPersist.current) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const api = useMemo<AssessmentApi>(() => {
    /* ---------- internal helpers (all pure over state) ---------- */

    const find = (s: AssessmentState, id: string) => s.assessments.find((a) => a.id === id);

    const replace = (s: AssessmentState, next: Assessment): Assessment[] =>
      s.assessments.map((a) => (a.id === next.id ? next : a));

    const refuse = (s: AssessmentState, actor: string, action: string, subject: string): AssessmentState => ({
      ...s,
      audit: log(s, actor, action, subject),
    });

    /**
     * Every content mutation goes through here: version bumps, and an approval
     * that was given for an older version is invalidated rather than inherited.
     * You cannot approve v1, swap in different questions, and dispatch v2.
     */
    const mutateContent = (
      s: AssessmentState,
      id: string,
      actor: string,
      persona: PersonaId,
      action: (a: Assessment) => Assessment,
      describe: (version: number) => string,
    ): AssessmentState => {
      const a = find(s, id);
      if (!a) return s;
      if (!canEditContent(a, persona))
        return refuse(s, actor, `edit blocked — brief is ${a.status.replace("_", " ")} (v${a.version})`, a.title);

      const wasApproved = a.status === "approved";
      const version = a.version + 1;
      const next: Assessment = {
        ...action(a),
        version,
        status: "editing",
        approval: wasApproved
          ? { ...a.approval, decision: undefined, decidedAt: undefined, approvedVersion: undefined }
          : a.approval,
      };

      const entries: AuditEntry[] = [{ at: now(), actor, action: describe(version), subject: next.title }];
      if (wasApproved)
        entries.unshift({
          at: now(),
          actor,
          action: `edited after approval — approval for v${a.version} invalidated, returned to editing (now v${version})`,
          subject: next.title,
        });

      return { ...s, assessments: replace(s, next), audit: [...entries, ...retitle(s.audit, a.title, next.title)] };
    };

    /* ---------- reads ---------- */

    const byId = (id: string) => find(state, id);
    const forRole = (roleId: string) => state.assessments.filter((a) => a.roleId === roleId);
    const activeForStage05 = () =>
      state.assessments.find((a) => a.status !== "sent") ?? state.assessments.filter((a) => a.status === "sent").at(-1);
    const submissionsFor = (id: string) => state.submissions.filter((s) => s.assessmentId === id);
    const submissionFor = (id: string, candidate: string) =>
      state.submissions.find((s) => s.assessmentId === id && s.candidate === candidate);

    const candidateAssessment = (name: string): CandidateAssessment | null => {
      // The LATEST dispatch wins. A candidate can be on the recipient list of
      // more than one sent brief, and the one they are being asked to sit is
      // the one sent last — otherwise the record the recruiter can still edit
      // and dispatch would be permanently shadowed by the already-frozen one.
      // replace() keeps a record in its slot, so array order is record order.
      const a = state.assessments
        .filter((x) => x.status === "sent" && (x.dispatch?.recipients ?? []).some((r) => r.name === name))
        .at(-1);
      return a ? toCandidateView(a) : null;
    };

    const draftFor = (id: string, candidate: string): AnswerMap =>
      state.drafts.find((d) => d.assessmentId === id && d.candidate === candidate)?.answers ?? {};

    const auditFor = (subject: string) => state.audit.filter((e) => e.subject === subject);

    return {
      ...state,
      hydrated,

      byId,
      forRole,
      activeForStage05,
      submissionsFor,
      submissionFor,
      candidateAssessment,
      draftFor,
      auditFor,

      /* ---------------- authoring ---------------- */

      updateDraft: (id, patch, actor, persona) =>
        setState((s) =>
          mutateContent(
            s,
            id,
            actor,
            persona,
            (a) => ({ ...a, ...patch }),
            (v) => `edited brief — now v${v}`,
          ),
        ),

      updateQuestion: (id, qid, patch, actor, persona) =>
        setState((s) =>
          mutateContent(
            s,
            id,
            actor,
            persona,
            (a) => ({ ...a, questions: a.questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }),
            (v) => `edited question ${qid} — now v${v}`,
          ),
        ),

      addQuestion: (id, kind, actor, persona) =>
        setState((s) =>
          mutateContent(
            s,
            id,
            actor,
            persona,
            (a) => ({
              ...a,
              questions: [...a.questions, { id: nextQid(a.questions), ...QUESTION_TEMPLATE[kind] }],
            }),
            (v) => `added a ${kind} question — now v${v}`,
          ),
        ),

      removeQuestion: (id, qid, actor, persona) =>
        setState((s) =>
          mutateContent(
            s,
            id,
            actor,
            persona,
            (a) => ({ ...a, questions: a.questions.filter((q) => q.id !== qid) }),
            (v) => `removed question ${qid} — now v${v}`,
          ),
        ),

      regenerate: (id, actor, persona) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          if (!canEditContent(a, persona))
            return refuse(s, actor, `regenerate blocked — brief is ${a.status.replace("_", " ")} (v${a.version})`, a.title);
          const version = a.version + 1;
          // A regeneration discards the recruiter's edits and returns the AI's
          // own draft — otherwise "regenerate" would just be a version bump.
          const seed = SEED_ASSESSMENTS.find((x) => x.id === a.id);
          const next: Assessment = {
            ...a,
            title: seed?.title ?? a.title,
            type: seed?.type ?? a.type,
            durationMins: seed?.durationMins ?? a.durationMins,
            window: seed?.window ?? a.window,
            brief: seed?.brief ?? a.brief,
            deliverables: seed?.deliverables ?? a.deliverables,
            questions: seed?.questions ?? a.questions,
            version,
            status: "drafted",
            rubric: MASTER_RUBRIC,
            provenance: {
              ...a.provenance,
              rubricVersion: RUBRIC_VERSION,
              generatedAt: now(),
              orgPolicy: ORG_POLICY,
            },
            approval: { ...a.approval, decision: undefined, decidedAt: undefined, approvedVersion: undefined },
          };
          const carried = { ...s, audit: retitle(s.audit, a.title, next.title) };
          return {
            ...carried,
            assessments: replace(s, next),
            audit: log(carried, actor, `regenerated the brief from the Stage-02 must-haves — now v${version}`, next.title),
          };
        }),

      /* ---------------- the approval gate ---------------- */

      submitForReview: (id, actor, persona) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          if (!canSubmitForReview(a, persona)) {
            const why = persona !== "hr" ? "only the recruiter can submit this brief" : (reviewReadiness(a).reason ?? `brief is ${a.status.replace("_", " ")}`);
            return refuse(s, actor, `submit for review blocked — ${why}`, a.title);
          }
          const next: Assessment = {
            ...a,
            status: "in_review",
            approval: {
              ...a.approval,
              submittedBy: actor,
              submittedAt: now(),
              decision: undefined,
              decidedAt: undefined,
              comment: undefined,
            },
          };
          return {
            ...s,
            assessments: replace(s, next),
            audit: log(
              s,
              actor,
              `submitted assessment for hiring-manager review (v${a.version}) — ${a.approval.reviewer.name} notified`,
              a.title,
            ),
          };
        }),

      withdrawReview: (id, actor, persona) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          if (persona !== "hr" || a.status !== "in_review")
            return refuse(s, actor, "withdraw blocked — nothing of yours is under review", a.title);
          const next: Assessment = {
            ...a,
            status: "editing",
            approval: { ...a.approval, submittedBy: undefined, submittedAt: undefined },
          };
          return {
            ...s,
            assessments: replace(s, next),
            audit: log(s, actor, `withdrew submission from review (v${a.version})`, a.title),
          };
        }),

      decide: (id, decision, comment, actor, persona) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          // No self-approval — persona AND actor are both checked.
          if (!canApprove(a, persona, actor))
            return refuse(
              s,
              actor,
              `decision blocked — only ${a.approval.reviewer.name} (${a.approval.reviewer.title}) may review v${a.version}`,
              a.title,
            );
          if (decision === "changes_requested" && !comment.trim())
            return refuse(s, actor, "changes requested without a written reason — refused", a.title);

          const next: Assessment = {
            ...a,
            status: decision === "approved" ? "approved" : "changes_requested",
            approval: {
              ...a.approval,
              decision,
              decidedAt: now(),
              comment: comment.trim() || undefined,
              approvedVersion: decision === "approved" ? a.version : undefined,
            },
          };
          const verb = decision === "approved" ? "approved" : "requested changes on";
          return {
            ...s,
            assessments: replace(s, next),
            audit: log(
              s,
              actor,
              `${verb} assessment v${a.version}${comment.trim() ? ` — "${comment.trim()}"` : ""}`,
              a.title,
            ),
          };
        }),

      reopen: (id, actor, persona) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          if (persona !== "hr" || a.status !== "changes_requested")
            return refuse(s, actor, "reopen blocked — this brief is not awaiting your changes", a.title);
          const version = a.version + 1;
          const round = a.approval.round + 1;
          const next: Assessment = {
            ...a,
            version,
            status: "editing",
            approval: {
              ...a.approval,
              round,
              decision: undefined,
              decidedAt: undefined,
              approvedVersion: undefined,
              submittedBy: undefined,
              submittedAt: undefined,
            },
          };
          return {
            ...s,
            assessments: replace(s, next),
            audit: log(s, actor, `reopened after changes requested — now v${version}, review round ${round}`, a.title),
          };
        }),

      revokeApproval: (id, comment, actor, persona) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          if (persona !== a.approval.reviewer.personaId || a.status !== "approved")
            return refuse(s, actor, "revoke blocked — there is no live approval of yours to revoke", a.title);
          if (!comment.trim()) return refuse(s, actor, "approval revoked without a written reason — refused", a.title);
          const next: Assessment = {
            ...a,
            status: "changes_requested",
            approval: {
              ...a.approval,
              decision: "changes_requested",
              decidedAt: now(),
              comment: comment.trim(),
              approvedVersion: undefined,
            },
          };
          return {
            ...s,
            assessments: replace(s, next),
            audit: log(s, actor, `revoked approval before dispatch (v${a.version}) — "${comment.trim()}"`, a.title),
          };
        }),

      /**
       * The enforcement layer. canSend() is re-evaluated here, not trusted from
       * the caller — a failed check mutates nothing and leaves a refusal on the
       * record.
       */
      send: (id, recipients, actor, persona, dueAt) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          if (!canSend(a, persona, recipients)) {
            // sendBlockReason() is written for the reader of the button; strip
            // its lead-in so the log line doesn't read "blocked — Blocked —".
            const why = (sendBlockReason(a, persona, recipients) ?? "not permitted").replace(/^Blocked — /, "");
            return refuse(s, actor, `send blocked — ${why} (v${a.version})`, a.title);
          }

          const approvalRef = `APV-${a.approval.approvedVersion} · ${a.approval.reviewer.name} · ${a.approval.decidedAt ?? "—"}`;
          const due = dueAt ?? (a.type === "take-home" ? inDays(3) : inDays(1));
          const next: Assessment = {
            ...a,
            status: "sent",
            dispatch: { sentBy: actor, sentAt: now(), recipients, dueAt: due, approvalRef },
          };
          return {
            ...s,
            assessments: replace(s, next),
            audit: log(
              s,
              actor,
              `sent to ${recipients.length} shortlisted candidate${recipients.length === 1 ? "" : "s"} · approval ${approvalRef}`,
              a.title,
            ),
          };
        }),

      /* ---------------- the candidate side ---------------- */

      saveAnswers: (id, candidate, answers) =>
        setState((s) => {
          const existing = s.drafts.find((d) => d.assessmentId === id && d.candidate === candidate);
          const draft: AnswerDraft = { assessmentId: id, candidate, answers, savedAt: now() };
          return {
            ...s,
            drafts: existing
              ? s.drafts.map((d) => (d === existing ? draft : d))
              : [...s.drafts, draft],
          };
        }),

      submitAnswers: (id, candidate, answers, actor) =>
        setState((s) => {
          const a = find(s, id);
          if (!a) return s;
          // Structurally impossible from the player (it only ever holds a sent
          // record), re-checked here because the store is the enforcement layer.
          if (a.status !== "sent")
            return refuse(s, actor, "submission blocked — this assessment has not been dispatched", a.title);
          if (s.submissions.some((x) => x.assessmentId === id && x.candidate === candidate))
            return refuse(s, actor, "submission blocked — you have already submitted this assessment", a.title);

          const answered = a.questions.filter((q) => isAnswered(q, answers[q.id])).length;
          const submission: Submission = {
            assessmentId: id,
            assessmentVersion: a.version,
            candidate,
            init: initialsOf(candidate),
            answers,
            submittedAt: now(),
            perDimension: [],
            score: undefined,
            verdict: undefined,
            originalityFlag: null,
            note: "Awaiting grading",
          };
          return {
            ...s,
            submissions: [...s.submissions, submission],
            drafts: s.drafts.filter((d) => !(d.assessmentId === id && d.candidate === candidate)),
            audit: log(
              s,
              actor,
              `submitted assessment (v${a.version}) — ${answered} of ${a.questions.length} answered`,
              a.title,
            ),
          };
        }),

      resetDemo: () => {
        try {
          window.localStorage.removeItem(KEY);
        } catch {}
        setState(SEED);
      },
    };
  }, [state, hydrated]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAssessment(): AssessmentApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAssessment must be used within <AssessmentProvider>");
  return ctx;
}
