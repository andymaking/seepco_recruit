"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MY_GOALS, MY_SELF_SCORES, ME_PUBLIC, type MyGoal } from "@/data/me";

/**
 * The employee's own store — the write side of the Me pillar.
 *
 * Before this existed every employee action was ephemeral `useState` inside the
 * phone-frame mockup: a goal check-in, a queued outbox item and a cache clear all
 * vanished on navigation, because there was nowhere else to navigate TO. Eleven
 * pages that share state make that untenable — /my-goals, /me and the phone
 * preview on /my-mobile must all agree about the same check-in.
 *
 * `audit` is not bookkeeping. It renders on /my-privacy as "every change you
 * made, timestamped" — the subject's half of a transparency page whose other
 * half is what the company holds about her. That is the page's whole point.
 *
 * WRITE SCOPE (invariant R6): every mutation here targets a record whose subject
 * is E-0214. No setter takes an owner or subject argument — which is precisely
 * why GoalsOKR's colleague owner-picker and ReviewCycles' submit() could not be
 * reused as-is on the Me pages.
 */

export type MeAudit = { at: string; action: string; subject: string };

export type Outbox = { id: string; label: string; at: string };

export type LndRequest = { id: string; item: string; cost: number; state: "Pending" | "Approved"; at: string };

export type Correction = { field: string; from: string; to: string; at: string; state: "Submitted" };

export type ExplanationRequest = { what: string; at: string; dueBy: string };

type MeState = {
  goals: MyGoal[];
  checkins: { goalId: string; at: string; from: number; to: number }[];
  agendaAdds: string[];
  actionsDone: string[];
  selfScores: number[];
  selfNarrative: string;
  feedbackSent: { to: string; competency: string; text: string; at: string }[];
  fbRequests: { from: string; at: string }[];
  milestonesDone: string[];
  learningEnrolled: string[];
  lndRequests: LndRequest[];
  optIn: boolean;
  applications: string[];
  corrections: Correction[];
  explanationRequests: ExplanationRequest[];
  notifRead: string[];
  channels: { whatsapp: boolean; sms: boolean; emailDigest: boolean };
  outbox: Outbox[];
  online: boolean;
  audit: MeAudit[];
};

type MeApi = MeState & {
  hydrated: boolean;
  checkIn: (goalId: string, pct: number) => void;
  addGoal: (g: MyGoal) => void;
  addAgendaItem: (item: string) => void;
  toggleAction: (item: string) => void;
  scoreSelf: (index: number, score: number) => void;
  setNarrative: (text: string) => void;
  sendFeedback: (to: string, competency: string, text: string) => void;
  requestFeedback: (from: string) => void;
  completeMilestone: (title: string) => void;
  enroll: (title: string, cost: number, threshold: number) => "enrolled" | "requested";
  setOptIn: (on: boolean) => void;
  apply: (role: string) => void;
  submitCorrection: (field: string, from: string, to: string) => void;
  requestExplanation: (what: string, slaDays: number) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setChannel: (k: "whatsapp" | "sms" | "emailDigest", on: boolean) => void;
  setOnline: (on: boolean) => void;
  queue: (label: string) => void;
  flush: () => void;
  clearCache: () => void;
  resetMe: () => void;
};

const SEED: MeState = {
  goals: MY_GOALS,
  checkins: [],
  agendaAdds: [],
  actionsDone: [],
  selfScores: MY_SELF_SCORES,
  selfNarrative: "",
  feedbackSent: [],
  fbRequests: [],
  milestonesDone: [],
  learningEnrolled: [],
  lndRequests: [],
  /** Consent clause c5 was accepted at conversion — which is why a mobility scan was lawful. */
  optIn: true,
  applications: [],
  corrections: [],
  explanationRequests: [],
  notifRead: [],
  channels: { whatsapp: true, sms: true, emailDigest: true },
  outbox: [],
  online: true,
  audit: [],
};

const KEY = "hirebrew.me.v1";

const now = () =>
  new Date().toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
};

const Ctx = createContext<MeApi | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MeState>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as MeState;
        if (saved && Array.isArray(saved.goals)) setState({ ...SEED, ...saved });
      }
    } catch {}
    skipPersist.current = false;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skipPersist.current) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const api = useMemo<MeApi>(() => {
    /** Offline writes queue instead of applying — the outbox the phone preview shows. */
    const log = (s: MeState, action: string, subject: string): MeAudit[] =>
      [{ at: now(), action, subject }, ...s.audit].slice(0, 60);

    return {
      ...state,
      hydrated,

      checkIn: (goalId, pct) =>
        setState((s) => {
          const g = s.goals.find((x) => x.id === goalId);
          if (!g || g.pct === pct) return s;
          const status = pct >= 100 ? "Done" : pct >= g.pct ? "On track" : "Behind";
          const tone: MyGoal["tone"] = pct >= 100 ? "green" : pct >= g.pct ? "green" : "yellow";
          return {
            ...s,
            goals: s.goals.map((x) => (x.id === goalId ? { ...x, pct, status, tone, fresh: false } : x)),
            checkins: [{ goalId, at: now(), from: g.pct, to: pct }, ...s.checkins],
            outbox: s.online ? s.outbox : [{ id: `o-${goalId}-${pct}`, label: `Check-in · ${g.title}`, at: now() }, ...s.outbox],
            audit: log(s, `checked in at ${pct}%`, g.title),
          };
        }),

      addGoal: (g) =>
        setState((s) => (s.goals.some((x) => x.id === g.id) ? s : {
          ...s, goals: [...s.goals, g], audit: log(s, "added goal", g.title),
        })),

      addAgendaItem: (item) =>
        setState((s) => ({ ...s, agendaAdds: [...s.agendaAdds, item], audit: log(s, "added a 1-on-1 agenda item", item) })),

      toggleAction: (item) =>
        setState((s) => ({
          ...s,
          actionsDone: s.actionsDone.includes(item) ? s.actionsDone.filter((x) => x !== item) : [...s.actionsDone, item],
          audit: log(s, s.actionsDone.includes(item) ? "reopened action item" : "completed action item", item),
        })),

      scoreSelf: (index, score) =>
        setState((s) => ({
          ...s,
          selfScores: s.selfScores.map((v, i) => (i === index ? score : v)),
          audit: log(s, `scored self ${score}/5`, `competency ${index + 1}`),
        })),

      setNarrative: (text) => setState((s) => ({ ...s, selfNarrative: text })),

      sendFeedback: (to, competency, text) =>
        setState((s) => ({
          ...s,
          feedbackSent: [{ to, competency, text, at: now() }, ...s.feedbackSent],
          audit: log(s, "sent feedback", to),
        })),

      requestFeedback: (from) =>
        setState((s) => ({ ...s, fbRequests: [{ from, at: now() }, ...s.fbRequests], audit: log(s, "requested feedback from", from) })),

      completeMilestone: (title) =>
        setState((s) => (s.milestonesDone.includes(title) ? s : {
          ...s, milestonesDone: [...s.milestonesDone, title], audit: log(s, "completed milestone", title),
        })),

      /** Under the threshold it enrols; over it, it becomes a request her manager approves. */
      enroll: (title, cost, threshold) => {
        const needsApproval = cost > threshold;
        setState((s) =>
          needsApproval
            ? { ...s, lndRequests: [{ id: `LR-${s.lndRequests.length + 3}`, item: title, cost, state: "Pending", at: `Requested ${now()}` }, ...s.lndRequests], audit: log(s, "requested approval for", title) }
            : { ...s, learningEnrolled: [...s.learningEnrolled, title], audit: log(s, "enrolled in", title) }
        );
        return needsApproval ? "requested" : "enrolled";
      },

      setOptIn: (on) =>
        setState((s) => ({ ...s, optIn: on, audit: log(s, on ? "opted in to internal matching" : "withdrew consent c5 — internal matching", ME_PUBLIC.name) })),

      apply: (role) =>
        setState((s) => (s.applications.includes(role) ? s : {
          ...s, applications: [...s.applications, role], audit: log(s, "applied to internal role", role),
        })),

      submitCorrection: (field, from, to) =>
        setState((s) => ({
          ...s,
          corrections: [{ field, from, to, at: now(), state: "Submitted" }, ...s.corrections],
          audit: log(s, `submitted a correction — ${from} → ${to}`, field),
        })),

      requestExplanation: (what, slaDays) =>
        setState((s) => (s.explanationRequests.some((r) => r.what === what) ? s : {
          ...s,
          explanationRequests: [{ what, at: now(), dueBy: plusDays(slaDays) }, ...s.explanationRequests],
          audit: log(s, "requested an explanation", what),
        })),

      markRead: (id) => setState((s) => (s.notifRead.includes(id) ? s : { ...s, notifRead: [...s.notifRead, id] })),
      markAllRead: () => setState((s) => ({ ...s, notifRead: ["N-1", "N-2", "N-3", "N-4", "N-5", "N-6"] })),

      setChannel: (k, on) =>
        setState((s) => ({ ...s, channels: { ...s.channels, [k]: on }, audit: log(s, `${on ? "enabled" : "disabled"} ${k} nudges`, "Channels") })),

      setOnline: (on) =>
        setState((s) => (on
          ? { ...s, online: true, outbox: [] , audit: s.outbox.length ? log(s, `synced ${s.outbox.length} queued change${s.outbox.length > 1 ? "s" : ""}`, "Outbox") : s.audit }
          : { ...s, online: false })),

      queue: (label) => setState((s) => ({ ...s, outbox: [{ id: `o-${s.outbox.length}`, label, at: now() }, ...s.outbox] })),
      flush: () => setState((s) => ({ ...s, outbox: [], audit: log(s, "synced the outbox", "Outbox") })),
      clearCache: () => setState((s) => ({ ...s, outbox: [], audit: log(s, "cleared the offline cache", "Mobile companion") })),

      resetMe: () => {
        try { window.localStorage.removeItem(KEY); } catch {}
        setState(SEED);
      },
    };
  }, [state, hydrated]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useMe(): MeApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMe must be used within <MeProvider>");
  return ctx;
}
