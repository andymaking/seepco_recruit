"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CAC_PROVIDERS,
  DEFAULT_PILLARS,
  SEED_BACKLOG,
  SEED_DONE_AT,
  SEED_SEATS,
  SEED_WORKSPACE,
  domainOf,
  isPillarLocked,
  isWorkEmail,
  type BacklogImport,
  type ChecklistStepKey,
  type ConnectorId,
  type PillarKey,
  type Seat,
  type SeatRole,
  type WorkspaceRecord,
} from "@/data/recruiterOnboarding";
import type { AuditEntry } from "@/state/lifecycle";

/**
 * The workspace data layer — everything that is a fact about THIS workspace:
 * verification state, seats, pillar entitlements, tool connections, the
 * activation clock, the backlog imports and the sandbox flag.
 *
 * Deliberately ONE store, not several. Splitting connections or timestamps out
 * would mean two localStorage keys, two hydrate/persist pairs and two audit
 * trails for a single record. Modelled line-for-line on state/lifecycle.tsx:
 * typed state + API, a SEED const, one KEY, hydrate-after-mount behind a
 * skipPersist ref, persist-on-change, now()-stamped audit entries, a reset
 * escape hatch and a throwing hook.
 *
 * Read by: WorkspaceActivation (writes all of it), OsShell + PersonaHub (pillar
 * entitlement), Signin (signup + sandbox), and — once their builders land —
 * TalentLibrary / Processing (imports), Integrations / Schedule / Calendar /
 * Sequences / Screening / Settings (connections), OnboardingGuide + Analytics
 * (the clock).
 */

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

type WorkspaceState = {
  workspace: WorkspaceRecord;
  seats: Seat[];
  pillars: PillarKey[];
  connections: Record<ConnectorId, boolean>;
  /** Checklist step key → ISO-8601 stamp. ISO so ttvMetrics() can Date.parse it. */
  doneAt: Record<string, string>;
  /**
   * When the owner first settled the pillar question — step 3 of activation's
   * own three-step rail. Not a checklist step: "keep Recruit only" is a real
   * answer, so the entitlement itself can never tell you it was decided.
   */
  pillarsChosenAt?: string;
  /** Newest first. The head is what Processing.tsx screens overnight. */
  imports: BacklogImport[];
  audit: AuditEntry[];
};

export type WorkspaceApi = WorkspaceState & {
  hydrated: boolean;
  /** The import Processing screens — the newest one, or the seeded backlog. */
  lastImport: BacklogImport;

  /* verification */
  submitSignup: (orgName: string, workEmail: string, fullName?: string) => void;
  submitCac: (rc: string) => void;
  submitForReview: () => void;
  reviewDecision: (to: "verified" | "rejected", reviewer: string) => void;

  /* seats */
  inviteSeat: (email: string, role: SeatRole) => void;
  changeSeatRole: (email: string, role: SeatRole) => void;
  removeSeat: (email: string) => void;

  /* pillars */
  togglePillar: (k: PillarKey) => void;
  hasPillar: (k: PillarKey) => boolean;
  markPillarsChosen: () => void;

  /* tools */
  connect: (id: ConnectorId) => void;
  disconnect: (id: ConnectorId) => void;
  isConnected: (id: ConnectorId) => boolean;

  /* clock */
  /**
   * Keyed to the five checklist steps only. Anything else writes a stamp that
   * ttvMetrics() and RECRUITER_CHECKLIST never read — use `isChecklistStepKey`
   * to cross over from a widened string.
   */
  markDone: (stepKey: ChecklistStepKey) => void;

  /* backlog */
  recordImport: (imp: BacklogImport) => void;

  /* sandbox */
  startSandbox: () => void;
  exitSandbox: () => void;

  /* reset */
  resetWorkspace: () => void;
};

/**
 * Connection seed. The ATS / job-board / identity rows carry Integrations.tsx's
 * own `connected` literals so nothing already claimed in the app becomes a lie;
 * Greenhouse is on because SEED_BACKLOG arrived through it and Youverify is on
 * because it ran the CAC lookup behind step 1.
 *
 * The four in-flow tools (Calendar ×2, Slack, WhatsApp) start OFF on purpose —
 * those connect moments are the product, and a pre-connected tool can never be
 * "framed by what it unlocks" at the moment it's needed.
 */
const SEED_CONNECTIONS: Record<ConnectorId, boolean> = {
  "google-calendar": false,
  outlook: false,
  slack: false,
  whatsapp: false,
  greenhouse: true,
  lever: false,
  seamlesshr: false,
  workday: false,
  bamboohr: true,
  "sap-sf": false,
  youverify: true,
  verifyme: true,
  "smile-id": true,
  paystack: false,
  linkedin: true,
  indeed: true,
  jobberman: true,
  myjobmag: false,
  okta: false,
  entra: true,
  "google-workspace": true,
};

/**
 * The seeded workspace is a full Talent OS design partner — every pillar on.
 * A brand-new signup drops to DEFAULT_PILLARS ("Recruit" + "Me"), which is what
 * makes step 3 of activation a real climb rather than a decoration.
 */
const SEED_PILLARS: PillarKey[] = ["Command", "Recruit", "Manage", "Grow", "Me"];

const SEED: WorkspaceState = {
  workspace: SEED_WORKSPACE,
  seats: SEED_SEATS,
  pillars: SEED_PILLARS,
  connections: SEED_CONNECTIONS,
  doneAt: { ...SEED_DONE_AT },
  imports: [SEED_BACKLOG],
  audit: [
    { at: "Jun 18, 11:40", actor: "Ifeoma Nwachukwu · Trust & Safety", action: "approved manual review — workspace verified", subject: "SEEPCO Energy Ltd" },
    { at: "Jun 18, 09:04", actor: "Youverify · CAC registry lookup", action: "returned RC 1042887 — registered name matched", subject: "SEEPCO Energy Ltd" },
    { at: "Jun 18, 09:02", actor: "samuel.omosehin@seepco.ng", action: "created workspace — work-email domain matched", subject: "seepco.ng" },
  ],
};

const KEY = "hirebrew.workspace.v1";
const Ctx = createContext<WorkspaceApi | null>(null);

/** Display stamp — identical format to lifecycle.tsx's now(). */
const now = () =>
  new Date().toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Machine stamp — ISO-8601, the only thing ttvMetrics() can measure with. */
const iso = () => new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** "samuel.omosehin@seepco.ng" → { name: "Samuel Omosehin", init: "SO" } */
export function personFromEmail(email: string): { name: string; init: string } {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ") || email;
  const init = (parts.length > 1 ? parts[0].charAt(0) + parts[1].charAt(0) : local.slice(0, 2)).toUpperCase();
  return { name, init: init || "??" };
}

const SEAT_TONES = ["#007AFF", "#16B364", "#AF52DE", "#EBA308", "#475569", "#C21A14"];
const toneFor = (email: string) => {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return SEAT_TONES[h % SEAT_TONES.length];
};

/**
 * The demo CAC registry behind Youverify's lookup. RC 1042887 is the real
 * expansion of SEEPCO; anything else comes back unmatched, which is the honest
 * outcome — and an unmatched RC still reaches a human rather than a dead end.
 */
const CAC_REGISTRY: Record<string, string> = {
  "1042887": "Sino Energy Exploration & Production Company Ltd",
};

const CAC_UNMATCHED = "No active registration found for that RC number";

/** Who the audit log names for a self-service action. */
const actorOf = (s: WorkspaceState) =>
  s.seats.find((x) => x.state === "Owner")?.name ?? s.workspace.workEmail;

const log = (s: WorkspaceState, action: string, subject: string, actor?: string): AuditEntry[] => [
  { at: now(), actor: actor ?? actorOf(s), action, subject },
  ...s.audit,
];

/* -------------------------------------------------------------------------- */
/* Provider                                                                    */
/* -------------------------------------------------------------------------- */

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  // Hydrate after mount (SSR-safe), then persist every change.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<WorkspaceState>;
        if (saved && saved.workspace && Array.isArray(saved.seats)) {
          // Merge over SEED so a field added after a user last saved still exists.
          setState({
            ...SEED,
            ...saved,
            workspace: { ...SEED.workspace, ...saved.workspace },
            connections: { ...SEED.connections, ...(saved.connections ?? {}) },
            doneAt: { ...(saved.doneAt ?? {}) },
          });
        }
      }
    } catch {}
    skipPersist.current = false;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skipPersist.current) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const api = useMemo<WorkspaceApi>(() => ({
    ...state,
    hydrated,
    lastImport: state.imports[0] ?? SEED_BACKLOG,

    /* ---------------------------- verification ---------------------------- */

    /**
     * Work-email signup. The FIRST RECRUITER IN BECOMES WORKSPACE ADMIN: the
     * new workspace is created with exactly one seat — theirs, as Owner — and
     * drops to the "Recruit only" pillar default so activation can scale it up.
     */
    submitSignup: (orgName, workEmail, fullName) =>
      setState((s) => {
        const email = workEmail.trim().toLowerCase();
        const person = personFromEmail(email);
        const name = fullName?.trim() || person.name;
        const init = (name.split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2) || person.init).toUpperCase();
        const owner: Seat = {
          email,
          name,
          init,
          tone: "#007AFF",
          role: "Workspace admin",
          state: "Owner",
          lastSeen: "Now",
        };
        return {
          ...s,
          workspace: {
            orgName: orgName.trim() || s.workspace.orgName,
            workEmail: email,
            domain: domainOf(email),
            domainMatch: isWorkEmail(email),
            cacNumber: "",
            cacName: "",
            cacProvider: CAC_PROVIDERS[0],
            cacStatus: "pending",
            state: "domain_matched",
            submittedAt: undefined,
            reviewer: undefined,
            decidedAt: undefined,
            isWorkspaceOwner: true,
            designPartner: s.workspace.designPartner,
            sandbox: false,
          },
          seats: [owner],
          pillars: [...DEFAULT_PILLARS],
          doneAt: {},
          pillarsChosenAt: undefined,
          audit: [
            { at: now(), actor: email, action: `created workspace — work-email domain ${isWorkEmail(email) ? "matched" : "rejected"}`, subject: domainOf(email) },
          ],
        };
      }),

    /** The Youverify CAC registry lookup behind step 1. */
    submitCac: (rc) =>
      setState((s) => {
        const digits = rc.replace(/\D/g, "");
        if (digits.length < 6 || digits.length > 8) {
          return {
            ...s,
            workspace: {
              ...s.workspace,
              cacNumber: rc.trim(),
              cacName: "RC number must be 6–8 digits — check the certificate",
              cacStatus: "mismatch",
            },
            audit: log(s, "CAC lookup rejected — malformed RC number", rc.trim() || "—"),
          };
        }
        const found = CAC_REGISTRY[digits];
        return {
          ...s,
          workspace: {
            ...s.workspace,
            cacNumber: `RC ${digits}`,
            cacName: found ?? CAC_UNMATCHED,
            cacProvider: CAC_PROVIDERS[0],
            cacStatus: found ? "matched" : "mismatch",
            state: "cac_submitted",
          },
          audit: log(
            s,
            found ? `CAC registry returned “${found}” — matched` : "CAC registry returned no match — routed to manual review",
            `RC ${digits}`,
            CAC_PROVIDERS[0],
          ),
        };
      }),

    /** Hand the record to a human. Manual review at launch: low volume, high trust. */
    submitForReview: () =>
      setState((s) => ({
        ...s,
        workspace: { ...s.workspace, state: "in_review", submittedAt: now(), reviewer: SEED_WORKSPACE.reviewer },
        audit: log(s, "submitted workspace for manual review", s.workspace.orgName),
      })),

    reviewDecision: (to, reviewer) =>
      setState((s) => ({
        ...s,
        workspace: { ...s.workspace, state: to, reviewer, decidedAt: now() },
        doneAt: to === "verified" && !s.doneAt.verify ? { ...s.doneAt, verify: iso() } : s.doneAt,
        audit: log(
          s,
          to === "verified" ? "approved manual review — workspace verified" : "rejected manual review — employer not confirmed",
          s.workspace.orgName,
          reviewer,
        ),
      })),

    /* -------------------------------- seats -------------------------------- */

    inviteSeat: (email, role) =>
      setState((s) => {
        const addr = email.trim().toLowerCase();
        if (!addr || s.seats.some((x) => x.email === addr)) return s;
        const person = personFromEmail(addr);
        const seat: Seat = {
          email: addr,
          name: person.name,
          init: person.init,
          tone: toneFor(addr),
          role,
          state: "Invited",
          invitedAt: now(),
        };
        const seats = [...s.seats, seat];
        return {
          ...s,
          seats,
          // Inviting the hiring team is checklist step 5 — stamp the clock once.
          doneAt: s.doneAt.invite ? s.doneAt : { ...s.doneAt, invite: iso() },
          audit: log(s, `invited a seat as ${role}`, addr),
        };
      }),

    changeSeatRole: (email, role) =>
      setState((s) => {
        const seat = s.seats.find((x) => x.email === email);
        if (!seat || seat.role === role || seat.state === "Owner") return s;
        return {
          ...s,
          seats: s.seats.map((x) => (x.email === email ? { ...x, role } : x)),
          audit: log(s, `changed role ${seat.role} → ${role}`, seat.name ?? email),
        };
      }),

    removeSeat: (email) =>
      setState((s) => {
        const seat = s.seats.find((x) => x.email === email);
        if (!seat || seat.state === "Owner") return s; // the owner seat can't be removed
        return {
          ...s,
          seats: s.seats.filter((x) => x.email !== email),
          audit: log(s, `removed the ${seat.role} seat`, seat.name ?? email),
        };
      }),

    /* ------------------------------- pillars ------------------------------- */

    togglePillar: (k) =>
      setState((s) => {
        if (isPillarLocked(k)) return s; // Recruit and Me are the floor
        const on = s.pillars.includes(k);
        return {
          ...s,
          pillars: on ? s.pillars.filter((p) => p !== k) : [...s.pillars, k],
          pillarsChosenAt: s.pillarsChosenAt ?? iso(),
          audit: log(s, `switched the ${k} pillar ${on ? "off" : "on"}`, s.workspace.orgName),
        };
      }),

    hasPillar: (k) => state.pillars.includes(k),

    /** Leaving the entitlement as it stands is also an answer. Idempotent. */
    markPillarsChosen: () =>
      setState((s) => (s.pillarsChosenAt ? s : { ...s, pillarsChosenAt: iso() })),

    /* -------------------------------- tools -------------------------------- */

    connect: (id) =>
      setState((s) =>
        s.connections[id]
          ? s
          : { ...s, connections: { ...s.connections, [id]: true }, audit: log(s, "connected a tool", id) },
      ),

    disconnect: (id) =>
      setState((s) =>
        !s.connections[id]
          ? s
          : { ...s, connections: { ...s.connections, [id]: false }, audit: log(s, "disconnected a tool", id) },
      ),

    isConnected: (id) => Boolean(state.connections[id]),

    /* -------------------------------- clock -------------------------------- */

    /** Idempotent — the first stamp is the one that counts. */
    markDone: (stepKey) =>
      setState((s) => (s.doneAt[stepKey] ? s : { ...s, doneAt: { ...s.doneAt, [stepKey]: iso() } })),

    /* ------------------------------- backlog ------------------------------- */

    recordImport: (imp) =>
      setState((s) => ({
        ...s,
        imports: [imp, ...s.imports.filter((i) => i.id !== imp.id)],
        doneAt: s.doneAt.import ? s.doneAt : { ...s.doneAt, import: iso() },
        audit: log(s, `imported ${imp.imported} of ${imp.received} applications from ${imp.source}`, imp.targetRole),
      })),

    /* ------------------------------- sandbox ------------------------------- */

    startSandbox: () =>
      setState((s) => ({ ...s, workspace: { ...s.workspace, sandbox: true } })),

    exitSandbox: () =>
      setState((s) => ({ ...s, workspace: { ...s.workspace, sandbox: false } })),

    /* -------------------------------- reset -------------------------------- */

    resetWorkspace: () => {
      try { window.localStorage.removeItem(KEY); } catch {}
      setState(SEED);
    },
  }), [state, hydrated]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used within <WorkspaceProvider>");
  return ctx;
}
