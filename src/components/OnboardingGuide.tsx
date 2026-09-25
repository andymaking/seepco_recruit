"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { personaById, type Persona, type PersonaId } from "@/data/personas";
import { NO_CHROME_PATHS } from "@/data/nav";
import { Ic } from "@/components/os/icons";
import { PfAvatar } from "@/components/os/ui";
import {
  RECRUITER_CHECKLIST,
  SEED_DONE_AT,
  nextChecklistStep,
  isChecklistStepKey,
  DESIGN_PARTNER_CONTACT,
} from "@/data/recruiterOnboarding";

/**
 * Product onboarding — PRD FR-050 (in-context guidance): a first-run welcome
 * flow plus a persistent, persona-aware "Get started" checklist with progress.
 * State persists in localStorage; the guide never renders for candidates,
 * platform admins, or on standalone flows (sign-in, portals, assessments).
 *
 * This is the app's ONE checklist. The recruiter list is the activation
 * sequence — verify → first role → import backlog → first shortlist → invite
 * team — and Brew (the assistant the app already ships as the Copilot) nudges
 * whichever step is next. Design partners get the same checklist plus a named
 * human, not a different component.
 */

type Task = { key: string; label: string; sub: string; icon: string; go?: string; action?: "tour"; nudge?: string };

/**
 * FR-077 gating contract for every `go` target below: a task may only point at a
 * stage its persona can actually open, or the user lands on the "isn't in your
 * workspace" panel. Two gates enforce it — Shell.tsx checks `persona.legacyAccess`
 * for recruit-workspace pages, OsShell.tsx checks `canOpenOsStage()` for OS stages.
 * Targets are verified against src/data/personas.ts persona-by-persona.
 */

/** Executive (Folake Coker) — osStages: "all", legacyAccess: true. Nothing is gated. */
const TASKS_EXEC: Task[] = [
  { key: "tour", label: "Take the lifecycle tour", sub: "7 stops through the 11-stage AI lifecycle", icon: "sparkle", action: "tour" },
  { key: "command", label: "Open workforce command", sub: "358 people · ₦412M cost, 5% over budget", icon: "gauge", go: "command" },
  { key: "loops", label: "Watch the loops run live", sub: "Four loops on Kafka · 1.2k events/day", icon: "orbit", go: "missioncontrol" },
  { key: "scenario", label: "Simulate before you commit", sub: "Pull the levers — nothing touches the real org", icon: "flask", go: "scenarios" },
  { key: "ask", label: "Ask in plain language", sub: "“Which location has the highest attrition?”", icon: "search", go: "ask" },
];

/**
 * Recruiter (Samuel Omosehin, Talent Lead) — the ACTIVATION sequence, not a
 * tour of the feature set: verify the workspace → open the first role →
 * import the backlog you already have → review the shortlist that produced →
 * invite the people who act on it. The clock it beats is first role live in
 * ~15 minutes, first ranked shortlist by morning.
 *
 * The list itself lives in src/data/recruiterOnboarding.ts because Analytics
 * measures the same five steps against the same keys; duplicating it here is
 * how the checklist and the time-to-value metrics would drift apart.
 *
 * FR-077 gating, persona `hr` (legacyAccess: true, osStages includes
 * talentlibrary): activation ✔ requisitions ✔ talentlibrary ✔ screening ✔.
 * Nothing here can strand the recruiter on the "isn't in your workspace" panel.
 * Deliberately NOT targeted: command, missioncontrol, scenarios, goals,
 * reviews, oneonones, growth, learning, retention, mobility, skillsgraph.
 */
const TASKS_HR: Task[] = RECRUITER_CHECKLIST.map((s) => ({
  key: s.key,
  label: s.label,
  sub: s.sub,
  icon: s.icon,
  go: s.go,
  nudge: s.nudge,
}));

/** Line manager (Ngozi Adeyemi) — legacyAccess: false; every target below is in osStages. */
const TASKS_MANAGER: Task[] = [
  { key: "team", label: "Meet your team home", sub: "Attention items, reviews due, goals behind", icon: "house", go: "manager" },
  { key: "oneonone", label: "Check today's 1-on-1", sub: "AI-prepared agenda from last week's actions", icon: "chat", go: "oneonones" },
  { key: "review", label: "Open the Q2 review cycle", sub: "Packets compiled — every claim cited", icon: "clipboard", go: "reviews" },
  { key: "mobility", label: "See internal mobility", sub: "Your people, matched before external sourcing", icon: "swap", go: "mobility" },
];

/**
 * Employee (Amara Okonkwo) — legacyAccess: FALSE, and every target below is one
 * of her Me-pillar stages. Until Aug 2026 goals/growth/learning could only be
 * targeted as `me`, because they existed solely as TABS INSIDE the phone frame
 * and the org-wide "goals"/"growth"/"learning" stages are manager surfaces that
 * would restrict. They are real pages of her own now, so each task points at the
 * page that owns it. `mobility` (a recruiter surface) is replaced by `mymobility`.
 * Still no tour task (it navigates to "planning", a recruit page) and no
 * "copilot" key (complete() special-cases it to the legacy "dashboard").
 */
const TASKS_EMPLOYEE: Task[] = [
  { key: "me", label: "Open your workspace", sub: "1-on-1 with Ngozi today · Q2 review Fri", icon: "house", go: "me" },
  { key: "goals", label: "Check in on your goals", sub: "Payments 72% on track · mentoring 58%", icon: "target", go: "mygoals" },
  { key: "growth", label: "See your growth plan", sub: "74% Staff-ready · learning module 5 of 8", icon: "trend", go: "mygrowth" },
  { key: "mobility", label: "Browse internal roles", sub: "Opt-in — managers can't see who browsed", icon: "swap", go: "mymobility" },
];

/* --------------------------- Welcome copy per persona --------------------------- */

type Pillar = { icon: string; label: string; sub: string };
type Welcome = { title: string; body: ReactNode; pillars: Pillar[] };

const Hi = ({ children }: { children: ReactNode }) => (
  <span style={{ color: "#57CB92", fontWeight: 600 }}>{children}</span>
);

/** The employer framing — executive and manager keep it. */
const EMPLOYER_PILLARS: Pillar[] = [
  { icon: "target", label: "Recruit", sub: "11-stage AI hiring" },
  { icon: "users", label: "Manage", sub: "Workforce intelligence" },
  { icon: "trend", label: "Grow", sub: "Performance & retention" },
];

function welcomeFor(p: Persona, designPartner: boolean): Welcome {
  const first = p.name.split(" ")[0];

  if (p.id === "hr") {
    return {
      title: `Welcome to Hirebrew, ${first}`,
      body: (
        <>
          Two numbers to beat: your <Hi>first role live in about 15 minutes</Hi>, and your{" "}
          <Hi>first ranked shortlist by morning</Hi>. Describe the role in a sentence and Brew drafts
          the JD, the Naira band, the knockouts and the rubric — you edit every one before it goes
          anywhere. Then point us at the applications you already have: no new applicants needed.
          {designPartner && (
            <>
              {" "}
              You&apos;re on the design-partner programme, so <Hi>{DESIGN_PARTNER_CONTACT.name}</Hi> is
              yours by name for the first three roles.
            </>
          )}
        </>
      ),
      pillars: [
        { icon: "shield", label: "Verify once", sub: "Domain + CAC · a human signs off" },
        { icon: "clipboard", label: "Role in ~15 min", sub: "Described in chat, edited by you" },
        { icon: "stack", label: "Shortlist by 04:12", sub: "Your backlog, ranked & explained" },
      ],
    };
  }

  if (p.id === "employee") {
    // Never the employer pillars: this persona's scope is themselves alone.
    return {
      title: `Your side of Hirebrew, ${first}`,
      body: (
        <>
          Your goals, your Q2 review, your growth plan and your learning — <Hi>on your own phone</Hi>.
          It opens straight from a WhatsApp nudge, works offline on 2G, and the scope is you alone:
          nothing here reports on anyone else.
        </>
      ),
      pillars: [
        { icon: "target", label: "Your goals", sub: "Check-ins, reviews & feedback" },
        { icon: "trend", label: "Your growth", sub: "Readiness, learning & coaching" },
        { icon: "swap", label: "Your next role", sub: "Internal moves — you opt in" },
      ],
    };
  }

  return {
    title: `Welcome to Hirebrew, ${first}`,
    body: (
      <>
        One platform for the whole talent lifecycle — <Hi>Recruit, Manage &amp; Grow</Hi> — every step
        powered by AI, every decision owned by a human.
      </>
    ),
    pillars: EMPLOYER_PILLARS,
  };
}

/**
 * The standalone surfaces are read from nav.ts's NO_CHROME registry rather than
 * relisted here — a hand-kept copy is how /welcome and /claim ended up showing a
 * new hire an executive first-run modal. The four additions are this component's
 * own: the candidate assessment and offer flows carry no persona, /processing is
 * a full-screen run, and /personas precedes any workspace at all.
 */
const HIDE_ON = [...NO_CHROME_PATHS, "/assessment-take", "/offer-letter", "/processing", "/personas"];

/**
 * Per-persona store. A single global key would let one persona's progress leak
 * into another's — `dismissed` would silence everyone, and the `mobility` task
 * key shared by the manager and employee lists would cross-tick. Namespacing
 * also means each persona still gets its own first-run welcome.
 */
const keyFor = (persona: PersonaId) => `hirebrew.onboarding.v1.${persona}`;

/**
 * `nudgedKey` / `nudgedAt` are what stop Brew repeating itself. One nudge per
 * step, and never two inside NUDGE_THROTTLE_MS — so walking through four pages
 * on the way to the next step doesn't produce four toasts.
 */
type SavedState = { welcomed: boolean; done: string[]; dismissed: boolean; nudgedKey?: string; nudgedAt?: number; celebrated?: boolean };
const EMPTY: SavedState = { welcomed: false, done: [], dismissed: false };

const NUDGE_THROTTLE_MS = 45_000;

function tasksFor(persona: PersonaId): Task[] {
  if (persona === "hr") return TASKS_HR;
  if (persona === "manager") return TASKS_MANAGER;
  if (persona === "employee") return TASKS_EMPLOYEE;
  // executive — candidate and sysadmin never reach here (guarded before any list is chosen).
  return TASKS_EXEC;
}

/**
 * A step counts as done when the recruiter DID it, not only when they ticked it
 * here. This checklist keeps its own per-persona record, but the real work
 * stamps `doneAt` from the screens that own it — approving the first
 * role, running an import, inviting a seat — so the two records are unioned.
 * Without this the recruiter describes and approves their first role and Brew
 * carries on nudging them to go and describe one.
 *
 * Only the recruiter's task keys are ChecklistStepKeys, so only its list can be
 * completed off-screen; the other three personas tick by hand and are unaffected.
 *
 * A stamp still equal to SEED_DONE_AT is the demo workspace's own history, not
 * this recruiter's work — the app ships an already-activated SEEPCO workspace so
 * Analytics has real time-to-value numbers to show. Counting those would open
 * the activation checklist at 5 of 5 and it would never appear at all.
 */
const doneKeysFor = (persona: PersonaId, local: string[], doneAt: Record<string, string>): Set<string> => {
  const keys = new Set(local);
  if (persona === "hr") {
    for (const [k, at] of Object.entries(doneAt)) {
      if (isChecklistStepKey(k) && at !== SEED_DONE_AT[k]) keys.add(k);
    }
  }
  return keys;
};

export default function OnboardingGuide() {
  const pathname = usePathname();
  const go = useGo();
  const toast = useToast();
  const { persona, setTourOpen, setTourStep, setCopilotOpen } = useApp();
  const { workspace, doneAt, markDone } = useWorkspace();
  const p = personaById(persona);

  const [state, setState] = useState<SavedState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false); // checklist card expanded

  /**
   * What Brew has already said, and when. Held in a ref rather than in React
   * state because nothing renders it — a nudge fired is a fact about the
   * session, not a reason to re-render. `save` carries it back into the
   * persisted record so a reload doesn't re-fire what you've already been told.
   */
  const nudged = useRef<{ key?: string; at: number }>({ at: 0 });

  /**
   * Congratulations are owed once, and only for work done in front of you.
   * `celebrated` is set synchronously so React's double-invoked mount effect in
   * development can't toast twice; `sawIncomplete` is what separates finishing
   * the checklist from arriving with it already finished — an existing user
   * shouldn't be congratulated on reload for work they did days ago.
   */
  const celebrated = useRef(false);
  const sawIncomplete = useRef(false);

  // Re-reads on persona switch so each workspace keeps its own progress.
  useEffect(() => {
    let next = EMPTY;
    try {
      const raw = window.localStorage.getItem(keyFor(persona));
      if (raw) next = { ...EMPTY, ...JSON.parse(raw) };
    } catch {}
    nudged.current = { key: next.nudgedKey, at: next.nudgedAt ?? 0 };
    celebrated.current = Boolean(next.celebrated);
    sawIncomplete.current = false;
    setState(next);
    setHydrated(true);
  }, [persona]);

  const persist = (next: SavedState) => {
    try { window.localStorage.setItem(keyFor(persona), JSON.stringify(next)); } catch {}
  };

  const save = (next: SavedState) => {
    const merged: SavedState = { ...next, nudgedKey: nudged.current.key, nudgedAt: nudged.current.at };
    setState(merged);
    persist(merged);
  };

  /**
   * BREW NUDGES THE NEXT STEP. Fires on arrival at a stage where the recruiter
   * still has an incomplete step, at most once per step and never inside the
   * throttle window. Sits above the early returns so the hook order is stable;
   * every guard the returns make is re-checked inside. It writes only to the
   * ref and to localStorage — no setState, so no cascading render.
   */
  useEffect(() => {
    if (!hydrated || persona !== "hr") return;
    if (!state.welcomed || state.dismissed) return;
    if (HIDE_ON.some((h) => pathname.startsWith(h))) return;
    const next = nextChecklistStep(doneKeysFor(persona, state.done, doneAt));
    if (!next) return;
    const at = Date.now();
    if (nudged.current.key === next.key) return;
    if (at - nudged.current.at < NUDGE_THROTTLE_MS) return;
    nudged.current = { key: next.key, at };
    persist({ ...state, nudgedKey: next.key, nudgedAt: at });
    toast(`Brew suggests next — ${next.nudge}`, "ai");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hydrated, persona, state, doneAt, toast]);

  /**
   * THE COMPLETION MOMENT. It has to fire for work done on the real screens as
   * well as for hand-ticked rows — inviting the last hiring manager stamps the
   * fifth step from WorkspaceActivation, and without this the chip would simply
   * vanish with nothing said. Dismissing the guide silences it too: the toast
   * belongs to the checklist, and a dismissed checklist has no voice.
   */
  useEffect(() => {
    if (!hydrated || !state.welcomed || state.dismissed) return;
    if (state.celebrated || celebrated.current) return;
    if (persona === "candidate" || persona === "sysadmin") return;
    const keys = doneKeysFor(persona, state.done, doneAt);
    if (!tasksFor(persona).every((t) => keys.has(t.key))) { sawIncomplete.current = true; return; }
    celebrated.current = true;
    save({ ...state, celebrated: true });
    if (sawIncomplete.current) toast("You're all set — onboarding complete 🎉", "success");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, persona, state, doneAt, toast]);

  if (!hydrated) return null;
  if (persona === "candidate" || persona === "sysadmin") return null;
  if (HIDE_ON.some((h) => pathname.startsWith(h))) return null;

  const tasks = tasksFor(persona);
  const isRecruiter = persona === "hr";
  const designPartner = isRecruiter && workspace.designPartner;
  const welcome = welcomeFor(p, designPartner);
  const doneKeys = doneKeysFor(persona, state.done, doneAt);
  const doneCount = tasks.filter((t) => doneKeys.has(t.key)).length;
  const allDone = doneCount === tasks.length;
  const pct = Math.round((doneCount / tasks.length) * 100);
  /** The step Brew leads with — the same one it toasts. */
  const nextStep = isRecruiter ? nextChecklistStep(doneKeys) : undefined;

  const complete = (t: Task) => {
    if (!doneKeys.has(t.key)) {
      const done = [...state.done, t.key];
      save({ ...state, done });
      // THE CLOCK: the recruiter's five keys are the same keys ttvMetrics()
      // measures, so ticking a step here is what stamps time-to-value. The
      // guard is the narrowing markDone now demands — this Task list spans
      // four personas, so `key` is a plain string here, and a key outside the
      // five would stamp a timestamp nothing measures.
      if (isRecruiter && isChecklistStepKey(t.key)) markDone(t.key);
      // The completion toast is the effect's, not this handler's — the last step
      // is as likely to be finished on a real screen as ticked here.
    }
    if (t.action === "tour") { setTourStep(0); setTourOpen(true); go("planning"); }
    else if (t.key === "copilot") { setCopilotOpen(true); go("dashboard"); toast("Brew is on — it proposes, you dispose", "ai"); }
    else if (t.go) go(t.go);
    setOpen(false);
  };

  const copy = (value: string, said: string) => {
    try { void navigator.clipboard?.writeText(value); } catch {}
    toast(said, "success");
  };

  /* ------------------------- First-run welcome ------------------------- */
  if (!state.welcomed) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(2,6,23,.44)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--pf-font)", padding: 20 }}>
        <div style={{ width: 520, maxWidth: "100%", background: "var(--pf-n0)", borderRadius: 16, boxShadow: "0 24px 64px rgba(2,6,23,.28)", overflow: "hidden" }}>
          <div style={{ background: "var(--pf-n900)", padding: "26px 28px 22px", color: "#fff" }}>
            <span style={{ width: 42, height: 42, borderRadius: 13, background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }}>
              <Ic name="sparkle" size={20} color="#fff" weight={2} />
            </span>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 5 }}>{welcome.title}</div>
            <div style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.55 }}>{welcome.body}</div>
          </div>
          <div style={{ padding: "18px 28px 22px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 16 }}>
              {welcome.pillars.map((c) => (
                <div key={c.label} style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "12px 12px 11px", textAlign: "center" }}>
                  <Ic name={c.icon} size={18} color="var(--pf-primary-500)" />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 6 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55, marginBottom: 16 }}>
              You&apos;re in the <b style={{ color: p.tone }}>{p.label.toLowerCase()}</b>{" "}
              workspace. A short get-started checklist will follow you until you&apos;ve seen the essentials — skip any time.
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              {/* The tour opens on "planning", a recruit-workspace page. Personas without
                  legacyAccess (manager, employee) would hit the restricted panel, so they
                  get their own home instead — same gating bug class as the task targets. */}
              <button
                onClick={() => {
                  save({ ...state, welcomed: true });
                  if (p.legacyAccess) { setTourStep(0); setTourOpen(true); go("planning"); }
                  else go(p.home);
                }}
                style={{ flex: 1, fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "11px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: "var(--pf-primary-500)", color: "#fff", boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.22)" }}
              >
                {p.legacyAccess ? "Start the tour" : "Open my workspace"}
              </button>
              <button
                onClick={() => { save({ ...state, welcomed: true }); toast("Get-started checklist is in the corner whenever you're ready", "default"); }}
                style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "11px 16px", borderRadius: 9, border: "1px solid var(--pf-n50)", cursor: "pointer", background: "var(--pf-n0)", color: "var(--pf-n600)", boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)" }}
              >
                Explore on my own
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------------- Get-started chip ------------------------- */
  if (state.dismissed || allDone) return null;

  return (
    <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 60, fontFamily: "var(--pf-font)" }}>
      {open ? (
        <div style={{ width: 330, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 14, boxShadow: "0 18px 48px rgba(2,6,23,.18)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
            <Ic name="sparkle" size={16} color="var(--pf-primary-500)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{isRecruiter ? "Activate your workspace" : "Get started"}</div>
              <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>
                {doneCount} of {tasks.length} done · {isRecruiter ? "first role in ~15 min · shortlist by morning" : `${p.label.toLowerCase()} essentials`}
              </div>
            </div>
            <span onClick={() => setOpen(false)} style={{ cursor: "pointer", display: "inline-flex", padding: 4 }}><Ic name="caretdown" size={14} color="var(--pf-n400)" /></span>
          </div>
          <div style={{ height: 4, background: "var(--pf-n50)" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--pf-primary-500)", transition: "width .3s ease" }} />
          </div>

          {/* BREW SUGGESTS NEXT — the same sentence the toast carries, in the
              one place you'd look for it. Purple is the app's AI tint. */}
          {nextStep && (
            <div
              onClick={() => complete(tasks.find((t) => t.key === nextStep.key) ?? tasks[0])}
              style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "10px 10px 2px", padding: "10px 11px", borderRadius: 10, cursor: "pointer", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)" }}
            >
              <span style={{ display: "inline-flex", paddingTop: 1, flex: "none" }}>
                <Ic name="sparkle" size={14} color="var(--pf-purple-500)" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-purple-500)", marginBottom: 3 }}>BREW SUGGESTS NEXT</div>
                <div style={{ fontSize: 12, color: "var(--pf-n900)", lineHeight: 1.45 }}>{nextStep.nudge}</div>
              </div>
              <Ic name="caretright" size={12} color="var(--pf-purple-500)" />
            </div>
          )}

          <div style={{ padding: "8px 8px 6px" }}>
            {tasks.map((t) => {
              const done = doneKeys.has(t.key);
              const isNext = nextStep?.key === t.key;
              return (
                <div
                  key={t.key}
                  onClick={() => complete(t)}
                  style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 9px", borderRadius: 9, cursor: "pointer", opacity: done ? 0.55 : 1, background: isNext ? "var(--pf-n25)" : "transparent" }}
                >
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: done ? "var(--pf-primary-50)" : isNext ? "var(--pf-purple-50)" : "var(--pf-n25)", border: `1px solid ${done ? "var(--pf-primary-100)" : isNext ? "var(--pf-purple-100)" : "var(--pf-n50)"}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                    {done ? <Ic name="check" size={14} color="var(--pf-primary-500)" weight={2.4} /> : <Ic name={t.icon} size={15} color={isNext ? "var(--pf-purple-500)" : "var(--pf-n500)"} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", textDecorationLine: done ? "line-through" : "none", textDecorationColor: "var(--pf-n300)" }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.sub}</div>
                  </div>
                  {!done && <Ic name="caretright" size={12} color={isNext ? "var(--pf-purple-500)" : "var(--pf-n300)"} />}
                </div>
              );
            })}
          </div>

          {/* THE NAMED HUMAN — design partners get the same checklist plus a
              person. The hands-on onboarding promised to SEEPCO, made concrete:
              a WhatsApp number, not a ticket queue. */}
          {designPartner && (
            <div style={{ margin: "2px 10px 8px", padding: "11px 12px", borderRadius: 10, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PfAvatar init={DESIGN_PARTNER_CONTACT.init} tone={DESIGN_PARTNER_CONTACT.tone} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{DESIGN_PARTNER_CONTACT.name}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{DESIGN_PARTNER_CONTACT.role}</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.45, margin: "8px 0 9px" }}>{DESIGN_PARTNER_CONTACT.promise}</div>
              <div style={{ display: "flex", gap: 7 }}>
                <button
                  onClick={() => copy(DESIGN_PARTNER_CONTACT.whatsapp, `WhatsApp copied — ${DESIGN_PARTNER_CONTACT.whatsapp}`)}
                  style={{ flex: 1, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, padding: "7px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--pf-primary-100)", background: "var(--pf-primary-50)", color: "var(--pf-primary-500)" }}
                >
                  WhatsApp Ifeoma
                </button>
                <button
                  onClick={() => copy(DESIGN_PARTNER_CONTACT.email, `Email copied — ${DESIGN_PARTNER_CONTACT.email}`)}
                  style={{ flex: 1, fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, padding: "7px 10px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--pf-n50)", background: "var(--pf-n0)", color: "var(--pf-n600)" }}
                >
                  Email
                </button>
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 10px" }}>
            <span onClick={() => { save({ ...state, dismissed: true }); toast("Guide dismissed — FR-050 in-context help stays on every module", "default"); }} style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n400)", cursor: "pointer" }}>
              Dismiss guide
            </span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "10px 15px", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--pf-n900)", color: "#fff", boxShadow: "0 12px 28px rgba(2,6,23,.28)" }}
        >
          <span style={{ position: "relative", width: 18, height: 18, flex: "none" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="2.5" />
              <circle cx="9" cy="9" r="7" fill="none" stroke="#57CB92" strokeWidth="2.5" strokeDasharray={`${(pct / 100) * 44} 44`} strokeLinecap="round" />
            </svg>
          </span>
          Get started · {doneCount}/{tasks.length}
        </button>
      )}
    </div>
  );
}
