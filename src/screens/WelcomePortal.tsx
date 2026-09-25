"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfProgress, PfAvatar, PfPageTabs,
  type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import BrewDock from "@/components/BrewDock";
import {
  ACTIVATION, BRIDGE_ARTIFACTS, BUDDIES, CONSENT_RECORDS, ESIGN_STAGES,
  FIRST_MEETINGS, MEET_THE_TEAM, NEW_HIRE, NEW_HIRE_PACK_KEY, NUDGE_DELIVERY,
  ORG_PLACEMENT, PLAN_30_60_90, PREBOARD_NUDGES, PREBOARD_TASKS, PREFILLED,
  PROVISIONING, PULSE, REQUIRED_PACK,
  type EsignStage, type PreboardTask, type ProvisionItem,
} from "@/data/onboarding";
import type { SystemName } from "@/data/talentos";

/**
 * /welcome — PATH A, the new hire's own side of onboarding.
 *
 * Standalone by design: it sits outside both `(app)` and `(os)`, so neither
 * Shell nor OsShell wraps it and NO PERSONA IS REQUIRED. That is the product
 * story, not a shortcut — Chidi has no account until day one creates it, so the
 * surface he is sent a link to on the day he signs cannot be persona-gated.
 * It renders its own slim chrome the way the candidate portal does.
 *
 * Three sections, Brew docked beside all three:
 *   Before you start   the offer→day-one window — e-sign, AI-read documents,
 *                      partner verification, Paystack-validated bank details,
 *                      the welcome video, day-one logistics, WhatsApp cadence
 *   Your first day     "we already know you" — the pre-filled candidate record,
 *                      the plain-language NDPR re-consent, activation,
 *                      provisioning, org placement, people, first meetings
 *   Your first 90 days the AI-drafted plan behind its manager-approval gate,
 *                      pulse checks, buddies, and the FR-074 bridge receipt
 *
 * Everything rendered here is read from @/data/onboarding — one source, many
 * renders. State is local to this surface and persists in localStorage, so the
 * checklist a hire works through survives a reload.
 */

/* ============================== Screen state ============================== */

const KEY = "hirebrew.welcome.v2";
/**
 * v1 payloads were written when the optional consent clauses seeded ON, so a
 * saved `consent` map from one can put the pre-ticked answers back. The
 * checklist work inside a v1 payload is the hire's own and worth carrying
 * across; the consent answers are not consent, so they are dropped on the way
 * and re-derived from lawfulBasis.
 */
const PRIOR_KEY = "hirebrew.welcome.v1";
const CONSENT = CONSENT_RECORDS[NEW_HIRE.empId];

/** Sub-steps are split off each milestone's own `body` — never invented. */
const stepsOf = (body: string) =>
  body.split(";").map((s) => s.trim().replace(/\.$/, "")).filter(Boolean);

type WelcomeState = {
  task: Record<string, PreboardTask["state"]>;
  esign: Record<string, EsignStage>;
  /** Tasks whose partner check completed HERE — shown as freshly verified. */
  freshly: Record<string, boolean>;
  consent: Record<string, boolean>;
  consentAt: string | null;
  /**
   * Keyed by SystemName, not by string — a widened key here is how the badge
   * write below would keep compiling after a rename in talentos.ts while
   * silently ceasing to reach the row it names.
   */
  prov: Record<SystemName, ProvisionItem["state"]>;
  planApproved: boolean;
  /** Who signed off — the receipt names the actor, never just the role. */
  approvedBy: string | null;
  steps: Record<string, boolean[]>;
  bridge: boolean;
};

const seed = (): WelcomeState => ({
  task: Object.fromEntries(PREBOARD_TASKS.map((t) => [t.id, t.state])),
  esign: Object.fromEntries(
    PREBOARD_TASKS.filter((t) => t.esign !== undefined).map((t) => [t.id, t.esign as EsignStage]),
  ),
  freshly: {},
  /**
   * Every optional clause starts OFF. Consent under NDPR 2019 §2.5 / NDPA 2023
   * has to be a specific affirmative act, so a pre-ticked switch is not consent
   * at all — only the Legal-obligation clause, which is not a choice, starts on.
   * `c.accepted` stays the historical record of what was answered, never the
   * live default.
   */
  consent: Object.fromEntries(CONSENT.clauses.map((c) => [c.id, c.lawfulBasis === "Legal obligation"])),
  consentAt: null,
  prov: Object.fromEntries(PROVISIONING.map((p) => [p.sys, p.state])) as Record<SystemName, ProvisionItem["state"]>,
  planApproved: PLAN_30_60_90.approval.state !== "ai-draft",
  approvedBy: PLAN_30_60_90.approval.approvedBy ?? null,
  steps: Object.fromEntries(
    PLAN_30_60_90.milestones.map((m) => {
      const n = stepsOf(m.body).length || 1;
      return [String(m.day), Array.from({ length: n }, (_, i) => m.progress >= ((i + 1) * 100) / n)];
    }),
  ),
  bridge: false,
});

/**
 * What the AI reads off a document uploaded ON THIS SCREEN. The tasks that
 * already carry `extract` in the data layer are the ones already read; these
 * three are still open, so their extraction has not happened yet — it happens
 * here, when the hire acts. No task appears in both places.
 */
const ON_SUBMIT: Record<
  string,
  { verifier: string; status: string; fields: { field: string; value: string; conf: number }[]; wait: string }
> = {
  "pb-nysc": {
    verifier: "Youverify",
    status: "Verified",
    wait: "Checking the NYSC register…",
    fields: [
      { field: "Certificate no.", value: "NYSC/••••/2019", conf: 0.97 },
      { field: "Service year", value: "2018 / 2019", conf: 0.99 },
      { field: "State of service", value: "Kaduna", conf: 0.95 },
    ],
  },
  "pb-medical": {
    verifier: "Lagoon Hospitals, Ikoyi",
    status: "Fit to work",
    wait: "Reading your medical report…",
    fields: [
      { field: "Outcome", value: "Fit to work — no restrictions", conf: 0.98 },
      { field: "Examined", value: "26 Jun 2026", conf: 0.99 },
      { field: "Valid to", value: "Jun 2027", conf: 0.97 },
    ],
  },
  "pb-pension": {
    verifier: "PenCom register",
    status: "Active",
    wait: "Matching your RSA PIN with PenCom…",
    fields: [
      { field: "PFA", value: "Stanbic IBTC Pension", conf: 0.99 },
      { field: "RSA PIN", value: "PEN•••••8804", conf: 0.99 },
      { field: "Status", value: "Active — matched on the register", conf: 0.96 },
    ],
  },
};

const LANES: { key: PreboardTask["lane"]; title: string; sub: string; icon: string; tone: PfTone }[] = [
  { key: "sign", title: "Your paperwork", sub: "E-signed through DocuSign. Nothing printed, nothing couriered.", icon: "file", tone: "green" },
  { key: "collect", title: "Documents we need from you", sub: "Uploaded once. Read by AI, then checked with the same partners the hiring side used on you.", icon: "shield", tone: "blue" },
  { key: "bank", title: "Getting you paid", sub: "Validated before it ever reaches payroll — a wrong digit here is a missed salary.", icon: "wallet", tone: "purple" },
];

const STATE_BADGE: Record<PreboardTask["state"], { label: string; tone: PfTone }> = {
  done: { label: "Done", tone: "green" },
  "in-progress": { label: "In progress", tone: "yellow" },
  waiting: { label: "Not started", tone: "grey" },
  blocked: { label: "Blocked", tone: "red" },
};

const CHANNEL_TONE: Record<string, PfTone> = { WhatsApp: "green", SMS: "blue", Email: "grey" };

/* ============================== Small pieces ============================== */

function Ring({ pct, size = 78 }: { pct: number; size?: number }) {
  const r = (size - 9) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-n50)" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 100 ? "var(--pf-primary-500)" : "var(--pf-primary-500)"}
        strokeWidth={8} strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray .5s ease" }}
      />
      <text x={size / 2} y={size / 2 + 6} textAnchor="middle" style={{ fill: "var(--pf-n900)", fontSize: 17, fontWeight: 700, fontFamily: "var(--pf-font)" }}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function Conf({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
      <span style={{ width: 34, height: 4, borderRadius: 4, background: "var(--pf-n100)", overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${pct}%`, borderRadius: 4, background: pct >= 95 ? "var(--pf-primary-500)" : "var(--pf-yellow-500)" }} />
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n400)", width: 26 }}>{pct}%</span>
    </span>
  );
}

function ExtractPanel({ title, rows, note }: { title: string; rows: { field: string; value: string; conf: number }[]; note?: string }) {
  return (
    <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>{title}</span>
      </div>
      {rows.map((r) => (
        <div key={r.field} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", borderTop: "1px solid rgba(175,82,222,.14)" }}>
          <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 118, flex: "none" }}>{r.field}</span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: "var(--pf-n900)", minWidth: 0 }}>{r.value}</span>
          <Conf v={r.conf} />
        </div>
      ))}
      <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.5 }}>
        {note ?? "You did not type any of this. Anything below 95% is checked by a person before it lands on your record."}
      </div>
    </div>
  );
}

function EsignLadder({ stage }: { stage: EsignStage }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {ESIGN_STAGES.map((label, i) => {
        const past = i < stage;
        const now = i === stage;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 15, height: 15, borderRadius: "50%", flex: "none",
              background: past || now ? "var(--pf-primary-500)" : "var(--pf-n0)",
              border: `1.5px solid ${past || now ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {past && <Ic name="check" size={9} color="#fff" weight={3} />}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: now ? 600 : 400, color: now ? "var(--pf-n900)" : past ? "var(--pf-n500)" : "var(--pf-n300)", textTransform: "capitalize" }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Switch({ on, locked, onClick }: { on: boolean; locked?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      title={locked ? "Required — this one cannot be switched off" : on ? "Switch off" : "Switch on"}
      style={{
        width: 40, height: 23, borderRadius: 23, flex: "none", position: "relative",
        cursor: locked ? "not-allowed" : "pointer", border: "none", padding: 0,
        background: on ? (locked ? "var(--pf-n400)" : "var(--pf-primary-500)") : "var(--pf-n100)",
        opacity: locked ? 0.75 : 1, transition: "background .2s ease",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(2,6,23,.25)", transition: "left .18s ease",
      }} />
    </button>
  );
}

function Row({ children, onClick, style, last, id }: { children: ReactNode; onClick?: () => void; style?: CSSProperties; last?: boolean; id?: string }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      id={id}
      {...(onClick ? hoverProps : {})}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 11, padding: "12px 18px",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        cursor: onClick ? "pointer" : "default",
        background: onClick && hovered ? "var(--pf-n25)" : "transparent",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHero({ eyebrow, title, body, right }: { eyebrow: string; title: string; body: string; right?: ReactNode }) {
  return (
    <PfCard style={{ background: "linear-gradient(180deg, var(--pf-primary-50) 0%, var(--pf-n0) 88%)", borderColor: "var(--pf-primary-100)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "20px 22px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".7px", color: "var(--pf-primary-600)", marginBottom: 6 }}>{eyebrow}</div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-.5px", color: "var(--pf-n900)", lineHeight: 1.2 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 7, maxWidth: 560 }}>{body}</div>
        </div>
        {right}
      </div>
    </PfCard>
  );
}

/* ================================ Screen ================================= */

export default function WelcomePortal() {
  const toast = useToast();
  const [tab, setTab] = useState("before");
  const [s, setS] = useState<WelcomeState>(seed);
  const [hydrated, setHydrated] = useState(false);
  const skip = useRef(true);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [focusTask, setFocusTask] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [videoPct, setVideoPct] = useState(0);
  const [consentEditing, setConsentEditing] = useState(false);
  const [brewOpen, setBrewOpen] = useState(true);
  const [openProv, setOpenProv] = useState(false);
  const [openFrom, setOpenFrom] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /**
   * Hydrate after mount, then persist every change — the same hydrate/persist/
   * skip shape as src/state/lifecycle.tsx. The read has to happen in an effect
   * rather than a lazy initialiser so the server render and the first client
   * render agree; that is exactly what the set-state-in-effect rule flags, and
   * it is the deliberate trade (correct hydration over one extra render).
   */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as WelcomeState;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (saved && saved.task && saved.steps) setS({ ...seed(), ...saved });
      } else {
        const prior = window.localStorage.getItem(PRIOR_KEY);
        if (prior) {
          const saved = JSON.parse(prior) as WelcomeState;
          if (saved && saved.task && saved.steps) {
            const fresh = seed();
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setS({ ...fresh, ...saved, consent: fresh.consent, consentAt: null });
          }
          window.localStorage.removeItem(PRIOR_KEY);
        }
      }
    } catch {}
    skip.current = false;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skip.current) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s]);

  const localTimers = timers;
  useEffect(() => {
    const list = localTimers;
    return () => { list.current.forEach(clearTimeout); list.current = []; };
  }, [localTimers]);

  /* Deep-link from Brew / a nudge into a specific checklist item. */
  useEffect(() => {
    if (!focusTask) return;
    const a = setTimeout(() => document.getElementById(`task-${focusTask}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 70);
    const b = setTimeout(() => setFocusTask(null), 3400);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [focusTask]);

  const openTask = (id: string) => { setTab("before"); setExpanded(id); setFocusTask(id); };

  /* ------------------------------- Derived ------------------------------- */

  const required = PREBOARD_TASKS.filter((t) => t.required);
  const requiredDone = required.filter((t) => s.task[t.id] === "done").length;
  const allDone = PREBOARD_TASKS.filter((t) => s.task[t.id] === "done").length;
  const prePct = (requiredDone / required.length) * 100;
  const openRequired = required.filter((t) => s.task[t.id] !== "done");

  const msPct = useMemo(
    () =>
      Object.fromEntries(
        PLAN_30_60_90.milestones.map((m) => {
          const arr = s.steps[String(m.day)] ?? [];
          return [String(m.day), arr.length ? (arr.filter(Boolean).length / arr.length) * 100 : 0];
        }),
      ) as Record<string, number>,
    [s.steps],
  );
  const planPct = PLAN_30_60_90.milestones.reduce((a, m) => a + (msPct[String(m.day)] ?? 0), 0) / PLAN_30_60_90.milestones.length;

  const consentOn = CONSENT.clauses.filter((c) => s.consent[c.id]).length;
  const provLive = PROVISIONING.filter((p) => s.prov[p.sys] === "active").length;

  /* ------------------------------- Actions ------------------------------- */

  const patch = (fn: (d: WelcomeState) => WelcomeState) => setS(fn);

  const stamp = () =>
    new Date().toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  /** Upload / check-status: a real partner round-trip, with a real waiting state. */
  const submitDoc = (t: PreboardTask) => {
    if (busy) return;
    const cfg = ON_SUBMIT[t.id];
    setBusy(t.id);
    setExpanded(t.id);
    patch((d) => ({ ...d, task: { ...d.task, [t.id]: "in-progress" } }));
    toast(cfg ? cfg.wait : "Sent for checking…", "ai");
    const timer = setTimeout(() => {
      patch((d) => ({ ...d, task: { ...d.task, [t.id]: "done" }, freshly: { ...d.freshly, [t.id]: true } }));
      setBusy(null);
      toast(
        cfg ? `${t.label} — ${cfg.status.toLowerCase()} via ${cfg.verifier}` : `${t.label} — done`,
        "success",
      );
    }, 1500);
    timers.current.push(timer);
  };

  const signDoc = (t: PreboardTask) => {
    patch((d) => ({ ...d, esign: { ...d.esign, [t.id]: 4 }, task: { ...d.task, [t.id]: "done" }, freshly: { ...d.freshly, [t.id]: true } }));
    setExpanded(t.id);
    toast(`${t.label} signed — countersigned by HR Ops, copy in your documents`, "success");
  };

  const playVideo = () => {
    if (videoPct > 0) return;
    toast("Playing — 2:14 with Ngozi, Tobi, Amara and three of the squad", "default");
    let p = 0;
    const tick = setInterval(() => {
      p += 9;
      setVideoPct(Math.min(p, 100));
      if (p >= 100) {
        clearInterval(tick);
        patch((d) => ({ ...d, task: { ...d.task, "pb-video": "done" } }));
      }
    }, 95);
    timers.current.push(setTimeout(() => clearInterval(tick), 4000));
  };

  const toggleClause = (id: string, required: boolean) => {
    if (required) {
      toast("This one is a legal obligation, not a choice — we cannot run payroll or file PAYE without it");
      return;
    }
    patch((d) => ({ ...d, consent: { ...d.consent, [id]: !d.consent[id] } }));
  };

  const recordConsent = () => {
    const at = stamp();
    patch((d) => ({ ...d, consentAt: at }));
    setConsentEditing(false);
    toast(`Consent recorded ${at} — ${consentOn} of ${CONSENT.clauses.length} clauses accepted, logged to your record`, "success");
  };

  const collectBadge = () => {
    patch((d) => ({ ...d, prov: { ...d.prov, "Site access badge": "active" } }));
    toast("Site access badge marked collected — Facilities notified, access live from the 4th-floor turnstile", "success");
  };

  /**
   * The button that reaches this sits on the HIRE's screen, so the person
   * clicking it is not the manager. The receipt has to name who actually
   * clicked — the same honesty the cockpit keeps when People Ops records an
   * approval on her behalf.
   */
  const approvePlan = () => {
    const actor = `${PLAN_30_60_90.approval.manager} · recorded from the walkthrough stand-in`;
    patch((d) => ({ ...d, planApproved: true, approvedBy: actor }));
    toast(`30/60/90 marked approved from the walkthrough stand-in — the receipt records that, not ${PLAN_30_60_90.approval.manager.split(" ")[0]}'s own click`, "success");
  };

  const toggleStep = (day: number, i: number) => {
    patch((d) => {
      const key = String(day);
      const arr = [...(d.steps[key] ?? [])];
      arr[i] = !arr[i];
      const next = { ...d, steps: { ...d.steps, [key]: arr } };
      const complete = PLAN_30_60_90.milestones.every((m) => (next.steps[String(m.day)] ?? []).every(Boolean));
      if (complete && !d.bridge) next.bridge = true;
      return next;
    });
  };

  useEffect(() => {
    if (s.bridge) {
      toast("Ninety days done — your goals, your first review date and your competency baseline just came into being", "success");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.bridge]);

  const resetDemo = () => {
    try { window.localStorage.removeItem(KEY); } catch {}
    setS(seed());
    setVideoPct(0);
    setExpanded(null);
    setConsentEditing(false);
    toast("Journey reset — walk it again from the day the offer was signed");
  };

  /* ------------------------------ Task row -------------------------------
   * A render function, deliberately — NOT a nested component. Declaring a
   * component inside the body would mint a new component type on every render,
   * so React would unmount and remount every task row (and its hover state)
   * each time a checkbox moved. */

  const renderTask = (t: PreboardTask, last: boolean) => {
    const st = s.task[t.id];
    const open = expanded === t.id;
    const focused = focusTask === t.id;
    const badge = STATE_BADGE[st];
    const es = s.esign[t.id];
    const cfg = ON_SUBMIT[t.id];
    const fresh = s.freshly[t.id];
    const working = busy === t.id;

    return (
      <div
        key={t.id}
        id={`task-${t.id}`}
        style={{
          borderBottom: last ? "none" : "1px solid var(--pf-n50)",
          background: focused ? "var(--pf-primary-50)" : "transparent",
          boxShadow: focused ? "inset 3px 0 0 var(--pf-primary-500)" : "none",
          transition: "background .3s ease",
        }}
      >
        <Row onClick={() => setExpanded(open ? null : t.id)} last>
          <span style={{
            width: 22, height: 22, borderRadius: "50%", flex: "none",
            background: st === "done" ? "var(--pf-primary-500)" : st === "in-progress" ? "var(--pf-yellow-50)" : "var(--pf-n0)",
            border: `1.5px solid ${st === "done" ? "var(--pf-primary-500)" : st === "in-progress" ? "var(--pf-yellow-500)" : "var(--pf-n100)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {st === "done" && <Ic name="check" size={12} color="#fff" weight={3} />}
            {working && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-yellow-500)", animation: "pulseDot 1s ease-in-out infinite" }} />}
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{t.label}</span>
              {!t.required && <PfBadge tone="grey">Optional</PfBadge>}
              {fresh && <PfBadge tone="green" dot>Just now</PfBadge>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{t.sub}</div>
          </div>

          {t.partner && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" }}>
              <Ic name="shield" size={11} color="var(--pf-n400)" />
              {t.partner}
            </span>
          )}
          <PfBadge tone={badge.tone} dot={st !== "waiting"}>{working ? "Checking…" : badge.label}</PfBadge>
          <Ic name={open ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
        </Row>

        {open && (
          <div style={{ padding: "0 18px 15px 51px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, color: "var(--pf-n400)", display: "flex", alignItems: "center", gap: 6 }}>
              <Ic name="info" size={12} color="var(--pf-n300)" />
              Required by: {t.source}
            </div>

            {es !== undefined && <EsignLadder stage={es} />}

            {t.extract && <ExtractPanel title="What we read off your document" rows={t.extract} />}
            {!t.extract && cfg && s.task[t.id] === "done" && (
              <ExtractPanel
                title={`What we read off your document — checked with ${cfg.verifier}`}
                rows={cfg.fields}
                note={`${cfg.verifier} returned “${cfg.status}”. Nothing was retyped by hand.`}
              />
            )}
            {working && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 9, padding: "9px 12px" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-yellow-500)", animation: "pulseDot 1s ease-in-out infinite" }} />
                <span style={{ fontSize: 12, color: "var(--pf-n600)" }}>{cfg?.wait ?? "Checking…"}</span>
              </div>
            )}

            {t.partnerStatus && !working && (
              <div style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                {t.partner} status: <b style={{ fontWeight: 600, color: t.partnerStatus === "Verified" ? "var(--pf-primary-600)" : "var(--pf-n600)" }}>{s.task[t.id] === "done" ? "Verified" : t.partnerStatus}</b>
              </div>
            )}

            {t.doneAt && s.task[t.id] === "done" && !fresh && (
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Completed {t.doneAt}</div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {st !== "done" && es !== undefined && (
                <PfBtn variant="primary" small icon="check" onClick={() => signDoc(t)}>Review &amp; sign</PfBtn>
              )}
              {st !== "done" && es === undefined && (
                <PfBtn variant="primary" small icon={t.state === "in-progress" ? "clock" : "download"} onClick={() => submitDoc(t)}>
                  {working ? "Checking…" : t.state === "in-progress" ? "Check the status" : "Upload it now"}
                </PfBtn>
              )}
              {st === "done" && (
                <PfBtn small icon="file" onClick={() => toast(`${t.label} — copy opened. It stays in your documents for as long as you are here`)}>
                  View my copy
                </PfBtn>
              )}
              <PfBtn small variant="ghost" onClick={() => toast("Sent to People Ops · Funke Adebayo — she replies inside a working day")}>
                Something looks wrong
              </PfBtn>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ================================ Render ================================ */

  const tabs = [
    { key: "before", label: "Before you start", count: `${allDone}/${PREBOARD_TASKS.length}` },
    { key: "day1", label: "Your first day", count: s.consentAt ? "Done" : "1 to read" },
    { key: "plan", label: "Your first 90 days", count: s.planApproved ? `${Math.round(planPct)}%` : "With Ngozi" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--pf-n25)", fontFamily: "var(--pf-font)", color: "var(--pf-n900)", fontSize: 14 }}>
      {/* ------------------------------ Slim chrome ------------------------------ */}
      <header style={{ position: "sticky", top: 0, zIndex: 22, background: "var(--pf-n0)", borderBottom: "1px solid var(--pf-n50)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto", height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 22px" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.25)" }}>
            <Ic name="sparkle" size={16} color="#fff" weight={2} />
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-.3px" }}>Hirebrew</span>
          <span style={{ width: 1, height: 18, background: "var(--pf-n100)" }} />
          <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>Your onboarding</span>

          <span style={{ flex: 1 }} />

          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "5px 10px" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)" }}>
              Day {NEW_HIRE.dayOfNinety} of 90
            </span>
            <span style={{ width: 46 }}>
              <PfProgress pct={(NEW_HIRE.dayOfNinety / 90) * 100} height={4} />
            </span>
          </span>

          <span style={{ width: 1, height: 22, background: "var(--pf-n100)" }} />

          <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <PfAvatar init={NEW_HIRE.init} tone={NEW_HIRE.tone} size={30} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{NEW_HIRE.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{NEW_HIRE.role} · {NEW_HIRE.loc}</span>
            </span>
          </span>
        </div>
      </header>

      {/* -------------------------------- Sections -------------------------------- */}
      <div style={{ position: "sticky", top: 56, zIndex: 21, background: "var(--pf-n0)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <PfPageTabs tabs={tabs} active={tab} onSelect={setTab} />
        </div>
      </div>

      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "20px 22px 70px" }}>
        <div style={{ display: "grid", gridTemplateColumns: brewOpen ? "minmax(0,1fr) 330px" : "minmax(0,1fr) 56px", gap: 16, alignItems: "start" }}>
          {/* ============================== MAIN COLUMN ============================== */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ========================= 1 · BEFORE YOU START ========================= */}
            {tab === "before" && (
              <>
                <SectionHero
                  eyebrow="OFFER SIGNED JUN 3 · STARTED MON JUL 1"
                  title="Between yes and Monday"
                  body="This is the window where a new hire goes quiet and a company goes silent — and where offers quietly fall apart, in both directions. Yours did neither. Everything below was opened the hour you signed."
                  right={
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "none" }}>
                      <Ring pct={prePct} />
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", textAlign: "center", lineHeight: 1.4 }}>
                        {requiredDone} of {required.length}<br />required items
                      </div>
                    </div>
                  }
                />

                {openRequired.length > 0 ? (
                  <PfCard style={{ background: "var(--pf-yellow-50)", borderColor: "var(--pf-yellow-100)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 18px" }}>
                      <PfTile icon="warning" tone="yellow" size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                          {openRequired.length} required {openRequired.length === 1 ? "item is" : "items are"} still open
                        </div>
                        <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 3, lineHeight: 1.5 }}>
                          {openRequired.map((t) => t.label).join(" · ")}. None of them blocks you working — they block payroll and the compliance file, which is a worse thing to discover in week four.
                        </div>
                      </div>
                    </div>
                  </PfCard>
                ) : (
                  <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px" }}>
                      <PfTile icon="check" tone="green" size={28} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                        Every required item is done. Nothing is waiting on you.
                      </div>
                      <PfBadge tone="green" dot>Complete</PfBadge>
                    </div>
                  </PfCard>
                )}

                {LANES.map((lane) => {
                  const items = PREBOARD_TASKS.filter((t) => t.lane === lane.key);
                  const doneN = items.filter((t) => s.task[t.id] === "done").length;
                  return (
                    <PfCard key={lane.key}>
                      <PfCardHead
                        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon={lane.icon} tone={lane.tone} size={26} />{lane.title}</span>}
                        sub={lane.sub}
                      >
                        <PfBadge tone={doneN === items.length ? "green" : "grey"}>{doneN}/{items.length}</PfBadge>
                      </PfCardHead>
                      {items.map((t, i) => renderTask(t, i === items.length - 1))}
                    </PfCard>
                  );
                })}

                {/* The welcome video — the one item that is purely about wanting to be here */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="play" tone="purple" size={26} />Meet the payments squad</span>}
                    sub="Six people, two minutes, filmed on someone's phone. Sent the day after you signed."
                  >
                    <PfBadge tone={s.task["pb-video"] === "done" ? "green" : "grey"} dot={s.task["pb-video"] === "done"}>
                      {s.task["pb-video"] === "done" ? "Watched" : "2:14"}
                    </PfBadge>
                  </PfCardHead>
                  <div style={{ padding: "16px 18px" }}>
                    <div
                      onClick={playVideo}
                      style={{
                        position: "relative", borderRadius: 12, overflow: "hidden", cursor: videoPct > 0 ? "default" : "pointer",
                        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F766E 100%)",
                        padding: "26px 20px", display: "flex", alignItems: "center", gap: 16,
                      }}
                    >
                      <span style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <Ic name={videoPct > 0 && videoPct < 100 ? "pause" : "play"} size={22} color="#fff" />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>
                          {videoPct >= 100
                            ? "That is your pod."
                            : videoPct > 0
                              ? "Playing…"
                              : s.task["pb-video"] === "done" ? "Watch it again" : "Press play"}
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)", marginTop: 3 }}>
                          Ngozi, Tobi, Amara + 3 · what the squad is shipping this quarter
                        </div>
                        {videoPct > 0 && (
                          <div style={{ marginTop: 10, height: 4, borderRadius: 4, background: "rgba(255,255,255,.2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${videoPct}%`, background: "#fff", borderRadius: 4, transition: "width .1s linear" }} />
                          </div>
                        )}
                      </div>
                      <span style={{ display: "flex", flex: "none" }}>
                        {MEET_THE_TEAM.slice(0, 4).map((m, i) => (
                          <span key={m.name} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                            <PfAvatar init={m.init} tone="#ffffff" size={30} />
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                </PfCard>

                {/* Day-one logistics */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="calendar" tone="green" size={26} />Your day one</span>}
                    sub={`${NEW_HIRE.startDate} · 09:00 · Lagos HQ, 4th floor`}
                  >
                    <PfBtn small icon="calendar" onClick={() => toast("Day-one itinerary added to your calendar — and to your WhatsApp thread")}>Add to calendar</PfBtn>
                  </PfCardHead>
                  {FIRST_MEETINGS.filter((m) => m.when.startsWith("Day 1 ·")).map((m, i, arr) => (
                    <Row key={m.when + m.with} last={i === arr.length - 1}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-600)", width: 58, flex: "none" }}>
                        {m.when.replace("Day 1 · ", "")}
                      </span>
                      <PfAvatar init={m.init} tone={m.tone} size={28} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.with}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{m.template}</div>
                      </div>
                      <PfBadge tone="grey">Booked for you</PfBadge>
                    </Row>
                  ))}
                  <div style={{ padding: "12px 18px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    Bring nothing. Your laptop was imaged on {ACTIVATION.device.split("·")[1]?.trim() ?? "Jun 28"} and your accounts open at 08:41. Ask for People Ops at reception — they are expecting you by name.
                  </div>
                </PfCard>

                {/* The nudge cadence — with delivery truth, not just the copy */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="megaphone" tone="green" size={26} />What we sent you, and when</span>}
                    sub="Four messages between signing and Monday. On WhatsApp, because that is where you actually are."
                  >
                    <PfBadge tone="green">{NUDGE_DELIVERY.deliveryRate}% delivered</PfBadge>
                  </PfCardHead>
                  <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {PREBOARD_NUDGES.map((n) => (
                      <div key={n.when} style={{ display: "flex", gap: 12 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 18 }}>
                          <span style={{
                            width: 10, height: 10, borderRadius: "50%", marginTop: 5,
                            background: n.state === "sent" ? "var(--pf-primary-500)" : "var(--pf-n100)",
                            border: n.state === "sent" ? "none" : "1.5px solid var(--pf-n100)",
                          }} />
                          <span style={{ flex: 1, width: 1.5, background: "var(--pf-n50)", marginTop: 3 }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-n400)" }}>{n.when}</span>
                            <PfBadge tone={CHANNEL_TONE[n.channel] ?? "grey"}>{n.channel}</PfBadge>
                            {n.state === "scheduled" && <PfBadge tone="grey">Scheduled</PfBadge>}
                            {n.delivered && <span style={{ fontSize: 10.5, color: "var(--pf-primary-600)", display: "inline-flex", alignItems: "center", gap: 3 }}><Ic name="check" size={11} color="var(--pf-primary-600)" />delivered</span>}
                            {n.opened && <span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>· opened</span>}
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.5, marginTop: 4, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: "3px 10px 10px 10px", padding: "8px 11px", display: "inline-block" }}>
                            {n.text}
                          </div>
                          {n.fellBackToSms && (
                            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                              <Ic name="swap" size={12} color="var(--pf-n300)" />
                              WhatsApp did not deliver — SMS took over {NUDGE_DELIVERY.smsFallbackMinutes} minutes later, automatically.
                            </div>
                          )}
                          {n.drives.length > 0 && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                              <span style={{ fontSize: 10.5, color: "var(--pf-n300)" }}>Chasing:</span>
                              {n.drives.map((id) => {
                                const t = PREBOARD_TASKS.find((x) => x.id === id);
                                if (!t) return null;
                                const done = s.task[id] === "done";
                                return (
                                  <button
                                    key={id}
                                    onClick={() => openTask(id)}
                                    style={{
                                      fontFamily: "inherit", fontSize: 10.5, fontWeight: 500, cursor: "pointer",
                                      color: done ? "var(--pf-primary-600)" : "var(--pf-n600)",
                                      background: done ? "var(--pf-primary-50)" : "var(--pf-n0)",
                                      border: `1px solid ${done ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
                                      borderRadius: 6, padding: "2px 7px",
                                    }}
                                  >
                                    {done ? "✓ " : ""}{t.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "11px 18px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    {NUDGE_DELIVERY.note} You can turn these off at any time — they are consent, not terms.
                  </div>
                </PfCard>

                {/* Certification pack — what a Lagos desk role actually needs */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="shield" tone="blue" size={26} />What your role actually requires</span>}
                    sub={`${NEW_HIRE_PACK_KEY} — the pack is picked from where you sit, not from a company-wide list.`}
                  />
                  <div style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {REQUIRED_PACK[NEW_HIRE_PACK_KEY].map((c) => (
                        <PfBadge key={c} tone="blue" dot>{c}</PfBadge>
                      ))}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 11 }}>
                      Not required for you:{" "}
                      {Array.from(new Set(Object.entries(REQUIRED_PACK).filter(([k]) => k !== NEW_HIRE_PACK_KEY).flatMap(([, v]) => v)))
                        .filter((c) => !REQUIRED_PACK[NEW_HIRE_PACK_KEY].includes(c))
                        .join(", ")}
                      . Those belong to the Port Harcourt site and offshore rotations. Nobody is going to make you sit an offshore survival course to write Go in Yaba.
                    </div>
                  </div>
                </PfCard>
              </>
            )}

            {/* ============================ 2 · YOUR FIRST DAY ============================ */}
            {tab === "day1" && (
              <>
                <SectionHero
                  eyebrow={`DAY ONE · ${ACTIVATION.firstSignIn}`}
                  title="We already know you."
                  body="You spent weeks telling us who you are — an application, a CV, an assessment, four interviews, two reference checks. None of it is going to be asked of you again. Your profile was already built when you signed in."
                  right={
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "none" }}>
                      <Ring pct={100} />
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", textAlign: "center", lineHeight: 1.4 }}>
                        activated<br />{ACTIVATION.firstSignIn.split("·")[1]?.trim()}
                      </div>
                    </div>
                  }
                />

                {/* Pre-filled from the candidate record */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="stack" tone="green" size={26} />Carried over from your hiring record</span>}
                    sub="One record from application to employee. Not a copy — the same one."
                  >
                    <PfBadge tone="green">{PREFILLED.length} things you never typed twice</PfBadge>
                  </PfCardHead>
                  {PREFILLED.map((p, i) => (
                    <Row key={p.field} last={i === PREFILLED.length - 1}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.field}</div>
                        <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 2 }}>{p.value}</div>
                      </div>
                      <span style={{ fontSize: 10.5, color: "var(--pf-n400)", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" }}>
                        {p.stage}
                      </span>
                      <PfBtn small variant="ghost" onClick={() => toast(`Correction requested on “${p.field}” — People Ops reviews it, nothing is overwritten silently`, "success")}>
                        Not right?
                      </PfBtn>
                    </Row>
                  ))}
                </PfCard>

                {/* ---- THE NDPR CONSENT RE-CONFIRMATION ---- */}
                <PfCard style={{ borderColor: s.consentAt ? "var(--pf-n50)" : "var(--pf-purple-100)" }}>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="shield" tone="purple" size={26} />One thing we need you to read</span>}
                    sub="Ninety seconds. It is the only part of today that is legally load-bearing."
                  >
                    {s.consentAt
                      ? <PfBadge tone="green" dot>Recorded</PfBadge>
                      : <PfBadge tone="purple" dot>Needs you</PfBadge>}
                  </PfCardHead>

                  <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 5 }}>Why you are being asked again</div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>{CONSENT.ndprNote}</div>
                    </div>

                    {(!s.consentAt || consentEditing) && (
                      <>
                        {CONSENT.clauses.map((c) => {
                          const on = s.consent[c.id];
                          return (
                            <div
                              key={c.id}
                              style={{
                                border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
                                background: on ? "var(--pf-primary-50)" : "var(--pf-n0)",
                                borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 6 }}>
                                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.purpose}</span>
                                  <PfBadge tone={c.lawfulBasis === "Legal obligation" ? "grey" : "blue"}>{c.lawfulBasis}</PfBadge>
                                  {c.required && <PfBadge tone="grey">Required</PfBadge>}
                                  {!c.required && !on && <PfBadge tone="grey">Off by default</PfBadge>}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5 }}>
                                  <span style={{ color: "var(--pf-n400)" }}>
                                    <span style={{ fontWeight: 600, color: "var(--pf-n500)" }}>Was for:</span> {c.wasFor}
                                  </span>
                                  <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                                  <span style={{ color: "var(--pf-n600)" }}>
                                    <span style={{ fontWeight: 600 }}>Now for:</span> {c.nowFor}
                                  </span>
                                </div>
                              </div>
                              <Switch on={on} locked={c.required} onClick={() => toggleClause(c.id, c.required)} />
                            </div>
                          );
                        })}

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 2 }}>
                          <PfBtn variant="primary" icon="check" onClick={recordConsent}>
                            {s.consentAt ? "Save my choices" : `Confirm — ${consentOn} of ${CONSENT.clauses.length}`}
                          </PfBtn>
                          {consentEditing && <PfBtn onClick={() => setConsentEditing(false)}>Cancel</PfBtn>}
                          <span style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, flex: 1, minWidth: 200 }}>
                            You can change any of these later, from your own workspace. Turning one off does not affect your job.
                          </span>
                        </div>
                      </>
                    )}

                    {s.consentAt && !consentEditing && (
                      <div style={{ border: "1px solid var(--pf-n100)", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: "var(--pf-primary-50)", borderBottom: "1px solid var(--pf-primary-100)" }}>
                          <Ic name="check" size={15} color="var(--pf-primary-600)" />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Recorded {s.consentAt}</div>
                            <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 1 }}>{CONSENT.recordedBy} · {consentOn} of {CONSENT.clauses.length} clauses accepted</div>
                          </div>
                        </div>
                        {CONSENT.clauses.map((c, i) => (
                          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderBottom: i === CONSENT.clauses.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                            <Ic name={s.consent[c.id] ? "check" : "x"} size={13} color={s.consent[c.id] ? "var(--pf-primary-600)" : "var(--pf-n300)"} />
                            <span style={{ flex: 1, fontSize: 11.5, color: s.consent[c.id] ? "var(--pf-n600)" : "var(--pf-n300)" }}>{c.purpose}</span>
                            <span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{c.lawfulBasis}</span>
                          </div>
                        ))}
                        <div style={{ padding: "11px 14px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                          {CONSENT.retention}
                        </div>
                        <div style={{ display: "flex", gap: 8, padding: "11px 14px", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
                          <PfBtn small icon="download" onClick={() => toast("Consent receipt downloaded — timestamped, clause by clause, yours to keep", "success")}>Download my receipt</PfBtn>
                          <PfBtn small variant="ghost" onClick={() => setConsentEditing(true)}>Change my choices</PfBtn>
                        </div>
                      </div>
                    )}
                  </div>
                </PfCard>

                {/* Activation */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="user" tone="green" size={26} />Your account</span>}
                    sub={`Signed in through ${ACTIVATION.idp} — the same identity everything else trusts.`}
                  >
                    <PfBadge tone="green" dot>Active</PfBadge>
                  </PfCardHead>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 1, background: "var(--pf-n50)" }}>
                    {[
                      { k: "Work email", v: ACTIVATION.workEmail },
                      { k: "Identity provider", v: ACTIVATION.idp },
                      { k: "First sign-in", v: ACTIVATION.firstSignIn },
                      { k: "Device", v: ACTIVATION.device },
                      { k: "Multi-factor", v: ACTIVATION.mfa },
                      { k: "Employee ID", v: `${NEW_HIRE.empId} · contract ${NEW_HIRE.contractId}` },
                    ].map((r) => (
                      <div key={r.k} style={{ background: "var(--pf-n0)", padding: "12px 18px" }}>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{r.k}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 3, wordBreak: "break-word" }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                </PfCard>

                {/* Provisioning — the FR-063 mirror, said in the hire's language */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="stack" tone="blue" size={26} />What was switched on for you</span>}
                    sub="Six systems, provisioned before you arrived — not requested after."
                  >
                    <PfBadge tone={provLive === PROVISIONING.length ? "green" : "yellow"}>{provLive}/{PROVISIONING.length} live</PfBadge>
                  </PfCardHead>
                  {PROVISIONING.map((p, i) => {
                    const st = s.prov[p.sys];
                    return (
                      <Row key={p.sys} last={i === PROVISIONING.length - 1}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 6, flex: "none",
                          background: st === "active" ? "var(--pf-primary-50)" : "var(--pf-n50)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Ic name={st === "active" ? "check" : "clock"} size={12} color={st === "active" ? "var(--pf-primary-600)" : "var(--pf-n400)"} weight={2.2} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.sys}</div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{p.via}</div>
                        </div>
                        {st === "active"
                          ? <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--pf-n400)" }}>{p.grantedAt ?? "just now"}</span>
                          : <PfBtn small variant="primary" onClick={collectBadge}>I have collected it</PfBtn>}
                      </Row>
                    );
                  })}
                  <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
                    <button
                      onClick={() => setOpenProv((v) => !v)}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 18px", background: "var(--pf-n25)", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                    >
                      <Ic name="swap" size={14} color="var(--pf-n400)" />
                      <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)" }}>The same list runs backwards if you ever leave</span>
                      <Ic name={openProv ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
                    </button>
                    {openProv && (
                      <div style={{ padding: "0 18px 13px", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.6, background: "var(--pf-n25)" }}>
                        These six systems, in reverse order, on your last day — one checklist, both directions. It is written down now so that nobody has to remember it then, and so that no account of yours is left quietly open after you have gone.
                      </div>
                    )}
                  </div>
                </PfCard>

                {/* Where you sit */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="graph" tone="green" size={26} />Where you sit</span>}
                    sub={ORG_PLACEMENT.squad}
                  >
                    <PfBadge tone="grey">{ORG_PLACEMENT.squadSize} in the squad · {ORG_PLACEMENT.deptHeadcount} in Engineering</PfBadge>
                  </PfCardHead>
                  <div style={{ padding: "18px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    {[
                      { ...ORG_PLACEMENT.skip, tag: "Skip-level" },
                      { ...ORG_PLACEMENT.manager, tag: "Your manager" },
                      { name: NEW_HIRE.name, init: NEW_HIRE.init, tone: NEW_HIRE.tone, role: `${NEW_HIRE.role} · ${NEW_HIRE.grade}`, tag: "You" },
                    ].map((p, i) => (
                      <span key={p.name} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        {i > 0 && <Ic name="caretright" size={14} color="var(--pf-n300)" />}
                        <span style={{
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 16px",
                          border: `1px solid ${p.tag === "You" ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
                          background: p.tag === "You" ? "var(--pf-primary-50)" : "var(--pf-n0)",
                          borderRadius: 12, minWidth: 132,
                        }}>
                          <PfAvatar init={p.init} tone={p.tone} size={38} />
                          <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: "center" }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: "var(--pf-n400)", textAlign: "center" }}>{p.role}</span>
                          <PfBadge tone={p.tag === "You" ? "green" : "grey"}>{p.tag}</PfBadge>
                        </span>
                      </span>
                    ))}
                  </div>
                </PfCard>

                {/* Meet the team */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="users" tone="purple" size={26} />The five people you will see most</span>}
                    sub="Matched from the team graph — who you will actually work with, not the whole org chart."
                  />
                  {MEET_THE_TEAM.map((m, i) => (
                    <Row key={m.name} last={i === MEET_THE_TEAM.length - 1}>
                      <PfAvatar init={m.init} tone={m.tone} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{m.role}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 2 }}>{m.note}</div>
                      </div>
                      <PfBadge tone="grey">{m.firstMeeting}</PfBadge>
                    </Row>
                  ))}
                </PfCard>

                {/* First meetings, already in the diary */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="calendar" tone="green" size={26} />Meetings already in your diary</span>}
                    sub="You booked none of these. They came out of the onboarding templates the day your start date was set."
                  >
                    <PfBadge tone="grey">{FIRST_MEETINGS.filter((m) => m.state === "held").length} held · {FIRST_MEETINGS.filter((m) => m.state === "scheduled").length} to come</PfBadge>
                  </PfCardHead>
                  {FIRST_MEETINGS.map((m, i) => (
                    <Row key={m.when + m.with} last={i === FIRST_MEETINGS.length - 1}>
                      <PfAvatar init={m.init} tone={m.tone} size={30} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{m.with}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{m.template}</div>
                      </div>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n500)" }}>{m.when}</span>
                      {m.state === "held"
                        ? <PfBadge tone="grey">Held</PfBadge>
                        : (
                          <PfBtn small onClick={() => toast(`Question sent ahead of your ${m.template.toLowerCase()} with ${m.with.split(" ")[0]}`, "success")}>
                            Ask ahead
                          </PfBtn>
                        )}
                    </Row>
                  ))}
                </PfCard>
              </>
            )}

            {/* ========================= 3 · YOUR FIRST 90 DAYS ========================= */}
            {tab === "plan" && (
              <>
                <SectionHero
                  eyebrow="THE SPINE"
                  title="Ninety days, written down"
                  body="Drafted from the role you were hired into and the scorecards from your own interviews — so it starts where you are weakest and stretches where you are strongest. Your manager reads it before you do."
                  right={
                    s.planApproved ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: "none" }}>
                        <Ring pct={planPct} />
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", textAlign: "center", lineHeight: 1.4 }}>your plan<br />so far</div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "none", width: 120 }}>
                        <PfTile icon="clock" tone="yellow" size={44} />
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", textAlign: "center", lineHeight: 1.4 }}>with your<br />manager</div>
                      </div>
                    )
                  }
                />

                {/* THE GATE — the hire never sees an unapproved plan */}
                {!s.planApproved ? (
                  <PfCard>
                    <PfCardHead
                      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="clock" tone="yellow" size={26} />Your plan is with {PLAN_30_60_90.approval.manager} for a final look</span>}
                      sub={`You will see it Monday. Drafted ${PLAN_30_60_90.approval.draftedAt} — waiting on her since.`}
                    >
                      <PfBadge tone="yellow" dot>Awaiting approval</PfBadge>
                    </PfCardHead>
                    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.65 }}>
                        A machine drafted it. That is not enough for something that decides what your first three months look like — so it does not reach you until {PLAN_30_60_90.approval.manager.split(" ")[0]} has read every line and either approved it or rewritten it. If she changes something, you will see what changed and why.
                      </div>
                      <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 7 }}>What it was written from</div>
                        <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.6 }}>{PLAN_30_60_90.approval.drafter}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                        <PfAvatar init="NA" tone="#16B364" size={30} />
                        <span style={{ fontSize: 12.5, color: "var(--pf-n500)" }}>
                          <b style={{ color: "var(--pf-n900)", fontWeight: 600 }}>{PLAN_30_60_90.approval.manager}</b> · Engineering Manager
                        </span>
                        <span style={{ flex: 1 }} />
                        <PfBtn small onClick={() => toast(`Nudged ${PLAN_30_60_90.approval.manager.split(" ")[0]} — it is at the top of her manager home`, "success")}>
                          Nudge her, gently
                        </PfBtn>
                      </div>
                      <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "11px 13px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <Ic name="info" size={14} color="var(--pf-n300)" />
                        <span style={{ flex: 1, minWidth: 200, fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                          This gate is real — approval happens on her manager home, not here. For the walkthrough, you can stand in for her.
                        </span>
                        <PfBtn small onClick={approvePlan}>Approve as {PLAN_30_60_90.approval.manager.split(" ")[0]}</PfBtn>
                      </div>
                    </div>
                  </PfCard>
                ) : (
                  <>
                    <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 18px" }}>
                        <PfAvatar init="NA" tone="#16B364" size={30} />
                        <div style={{ flex: 1 }}>
                          {/* Never name an approver the state cannot evidence — an
                              approved plan with no actor recorded says so. */}
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                            {s.approvedBy ? `${s.approvedBy} approved this plan` : "Approved — approver not recorded"}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 2 }}>
                            Drafted {PLAN_30_60_90.approval.draftedAt} by the Talent OS{s.approvedBy ? ", read and signed off by a person" : ""}. It is yours now — progress below is what you tick, not what she reports.
                          </div>
                        </div>
                        <PfBadge tone="green" dot>Approved</PfBadge>
                      </div>
                    </PfCard>

                    {PLAN_30_60_90.milestones.map((m) => {
                      const steps = stepsOf(m.body);
                      const checks = s.steps[String(m.day)] ?? [];
                      const pct = msPct[String(m.day)] ?? 0;
                      const provOpen = openFrom === String(m.day);
                      return (
                        <PfCard key={m.day}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", borderBottom: "1px solid var(--pf-n50)" }}>
                            <span style={{
                              width: 48, height: 48, borderRadius: 13, flex: "none",
                              background: pct >= 100 ? "var(--pf-primary-500)" : "var(--pf-primary-50)",
                              color: pct >= 100 ? "#fff" : "var(--pf-primary-600)",
                              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                              fontFamily: "var(--mono)", fontWeight: 700, fontSize: 15, lineHeight: 1,
                            }}>
                              {m.day}
                              <span style={{ fontSize: 8.5, fontWeight: 500, marginTop: 2, letterSpacing: ".4px" }}>DAY</span>
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>{m.title}</span>
                                {pct >= 100 && <PfBadge tone="green" dot>Done{m.onTime ? " · on time" : ""}</PfBadge>}
                                {pct > 0 && pct < 100 && <PfBadge tone="yellow" dot>In progress</PfBadge>}
                                {pct === 0 && <PfBadge tone="grey">Not started</PfBadge>}
                              </div>
                              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.55 }}>{m.body}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                                <span style={{ flex: 1 }}><PfProgress pct={pct} /></span>
                                <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", width: 34, textAlign: "right" }}>{Math.round(pct)}%</span>
                                <span style={{ fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>due {m.dueOn}</span>
                              </div>
                            </div>
                          </div>

                          {steps.map((step, i) => (
                            <Row key={step} onClick={() => toggleStep(m.day, i)} last={i === steps.length - 1}>
                              <span style={{
                                width: 19, height: 19, borderRadius: 6, flex: "none",
                                background: checks[i] ? "var(--pf-primary-500)" : "var(--pf-n0)",
                                border: `1.5px solid ${checks[i] ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {checks[i] && <Ic name="check" size={11} color="#fff" weight={3} />}
                              </span>
                              <span style={{
                                flex: 1, fontSize: 12.5, fontWeight: 500,
                                color: checks[i] ? "var(--pf-n400)" : "var(--pf-n900)",
                                textDecoration: checks[i] ? "line-through" : "none",
                              }}>
                                {step.charAt(0).toUpperCase() + step.slice(1)}
                              </span>
                            </Row>
                          ))}

                          <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
                            <button
                              onClick={() => setOpenFrom(provOpen ? null : String(m.day))}
                              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 18px", background: "var(--pf-purple-50)", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                            >
                              <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
                              <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>Why this milestone, and not another one</span>
                              <Ic name={provOpen ? "caretdown" : "caretright"} size={13} color="var(--pf-purple-500)" />
                            </button>
                            {provOpen && (
                              <div style={{ padding: "0 18px 13px", background: "var(--pf-purple-50)", display: "flex", flexDirection: "column", gap: 8 }}>
                                {m.from.map((f) => (
                                  <div key={f.source} style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 8, padding: "9px 11px" }}>
                                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".4px", color: "var(--pf-purple-500)", textTransform: "uppercase" }}>{f.source}</div>
                                    <div style={{ fontSize: 12, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.5 }}>{f.detail}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {m.creates && (
                            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
                              <Ic name={pct >= 100 ? "check" : "arrowright"} size={13} color={pct >= 100 ? "var(--pf-primary-600)" : "var(--pf-n300)"} />
                              <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                                {pct >= 100 ? "Created: " : "Finishing this creates: "}{m.creates.toLowerCase()}
                              </span>
                            </div>
                          )}
                        </PfCard>
                      );
                    })}
                  </>
                )}

                {/* The bridge receipt — what just came into being, no deep links */}
                {s.bridge && (
                  <PfCard style={{ borderColor: "var(--pf-primary-100)" }}>
                    <PfCardHead
                      title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="stack" tone="green" size={26} />Ninety days done — here is what that made</span>}
                      sub="Onboarding does not end in a void. It ends by handing you to a manager who already knows you, with four things that now exist."
                    >
                      <PfBadge tone="green" dot>Complete</PfBadge>
                    </PfCardHead>
                    {BRIDGE_ARTIFACTS.map((b, i) => (
                      <Row key={b.id} last={i === BRIDGE_ARTIFACTS.length - 1}>
                        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                          <Ic name="check" size={12} color="#fff" weight={3} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.what}</div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 2, lineHeight: 1.5 }}>{b.detail}</div>
                        </div>
                      </Row>
                    ))}
                  </PfCard>
                )}

                {/* Pulse checks */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="pulse" tone="blue" size={26} />We ask you three times how it is going</span>}
                    sub="Day 30, 60 and 90 — the same five questions each time. Your answers change how we hire, not what we think of you."
                  />
                  {PULSE.map((p, i) => {
                    const score = p.state === "scored" ? p.score : null;
                    return (
                      <Row key={p.day} last={i === PULSE.length - 1}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--pf-n400)", width: 44, flex: "none" }}>Day {p.day}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.at}</div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
                            {p.state === "scored" ? "You answered it" : p.state === "scheduled" ? "Scheduled — it will arrive on WhatsApp" : "Queued with your probation review"}
                          </div>
                        </div>
                        {score !== null && score !== undefined
                          ? <PfBadge tone="green" dot>{score} / 5</PfBadge>
                          : (
                            <PfBtn small onClick={() => toast(`Day-${p.day} check-in opened early — five questions, about two minutes`, "success")}>
                              Answer it early
                            </PfBtn>
                          )}
                      </Row>
                    );
                  })}
                  <div style={{ padding: "11px 18px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    Your manager sees the score, not the sentences. A bad one is a signal about us, and it is treated that way.
                  </div>
                </PfCard>

                {/* Buddies */}
                <PfCard>
                  <PfCardHead
                    title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}><PfTile icon="lifebuoy" tone="purple" size={26} />Three people whose job it is to answer you</span>}
                    sub="Matched on the team graph and working style — not on who had a free slot."
                  />
                  {BUDDIES.map((b, i) => (
                    <Row key={b.name} last={i === BUDDIES.length - 1}>
                      <PfAvatar init={b.init} tone={b.tone} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.name}</span>
                          <PfBadge tone="purple">{b.kind}</PfBadge>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 2 }}>{b.why}</div>
                      </div>
                      <PfBtn small icon="chat" onClick={() => toast(`Message sent to ${b.name.split(" ")[0]} — buddies are asked to reply the same day`, "success")}>Message</PfBtn>
                    </Row>
                  ))}
                </PfCard>
              </>
            )}

            {/* --------------------------------- Footer --------------------------------- */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6, padding: "14px 18px", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 12 }}>
              <Ic name="info" size={14} color="var(--pf-n300)" />
              <span style={{ flex: 1, minWidth: 220, fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                This is your side of onboarding. Your recruiter and People Ops see the same journey from Stage 10 — the same checklist, the same plan, the same consent receipt. Nothing here is hidden from you that is visible to them.
              </span>
              <PfBtn small variant="ghost" onClick={resetDemo}>Start the walkthrough over</PfBtn>
              <span style={{ fontSize: 10.5, color: "var(--pf-n300)", fontFamily: "var(--mono)" }}>
                {hydrated ? "saved on this device" : "loading…"}
              </span>
            </div>
          </div>

          {/* ============================== BREW RAIL ============================== */}
          <div style={{ minWidth: 0 }}>
            <BrewDock open={brewOpen} onToggle={() => setBrewOpen((v) => !v)} onOpenTask={openTask} />
          </div>
        </div>
      </div>
    </div>
  );
}
