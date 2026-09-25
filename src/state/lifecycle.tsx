"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { REQUISITIONS, type Requisition, type ReqRecordStatus } from "@/data/requisitions";
import { CANDDIR, type DirCandidate } from "@/data/people";

/**
 * The lifecycle data layer — real, persistent functionality for the recruit
 * app (the client-side equivalent of the staging backend): requisitions,
 * open roles and the candidate pipeline live in one store, every status
 * transition is audit-logged with actor + timestamp, publishing a requisition
 * creates its open role, and the whole state survives reload (localStorage).
 */

export type OpenRole = { id: string; title: string; status: "Open" | "Draft"; dept: string; fromReq?: string };

export type AuditEntry = { at: string; actor: string; action: string; subject: string };

type LifecycleState = {
  requisitions: Requisition[];
  roles: OpenRole[];
  candidates: DirCandidate[];
  audit: AuditEntry[];
};

type LifecycleApi = LifecycleState & {
  hydrated: boolean;
  createRequisition: (r: Requisition, actor: string) => void;
  transitionRequisition: (id: string, to: ReqRecordStatus, actor: string) => void;
  createRole: (title: string, dept: string, status: "Open" | "Draft", actor: string, fromReq?: string) => void;
  moveCandidate: (name: string, toStage: string, actor: string) => void;
  addCandidate: (c: DirCandidate, actor: string) => void;
  resetDemo: () => void;
};

const SEED_ROLES: OpenRole[] = [
  { id: "R-01", title: "Petroleum Engineer", status: "Open", dept: "Engineering", fromReq: "REQ-2211" },
  { id: "R-02", title: "Chemical Engineer", status: "Open", dept: "Engineering", fromReq: "REQ-2214" },
  { id: "R-03", title: "Researcher", status: "Open", dept: "Product", fromReq: "REQ-2212" },
  { id: "R-04", title: "Junior Operations Manager", status: "Open", dept: "Engineering" },
  { id: "R-05", title: "Technical Assistant", status: "Open", dept: "Engineering" },
  { id: "R-06", title: "Maintenance Officer", status: "Draft", dept: "Engineering", fromReq: "REQ-2213" },
  { id: "R-07", title: "Accountant", status: "Open", dept: "Operations", fromReq: "REQ-2210" },
  { id: "R-08", title: ",mmm", status: "Open", dept: "Design", fromReq: "REQ-2210B" },
  { id: "R-09", title: "Customer Support", status: "Open", dept: "Design", fromReq: "REQ-2207" },
  { id: "R-10", title: "Financial Expert", status: "Open", dept: "Design", fromReq: "REQ-2206" },
  { id: "R-11", title: "Sales Representative", status: "Draft", dept: "Product" },
  { id: "R-12", title: "Quality Assurance Engineer", status: "Draft", dept: "Engineering" },
];

const SEED: LifecycleState = {
  requisitions: REQUISITIONS,
  roles: SEED_ROLES,
  candidates: CANDDIR,
  audit: [
    { at: "Jun 21, 09:14", actor: "tosin (Staff)", action: "approved & published", subject: "Chemical Engineer" },
    { at: "Jun 20, 16:02", actor: "Finance", action: "signed budget approval", subject: "Maintenance Officer" },
  ],
};

const KEY = "hirebrew.lifecycle.v1";
const Ctx = createContext<LifecycleApi | null>(null);

const now = () =>
  new Date().toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS_LABEL: Record<ReqRecordStatus, string> = {
  draft: "Draft", pending: "In review", published: "Published", rejected: "Rejected",
};

export function LifecycleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LifecycleState>(SEED);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(true);

  // Hydrate after mount (SSR-safe), then persist every change.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as LifecycleState;
        if (saved && Array.isArray(saved.requisitions)) setState(saved);
      }
    } catch {}
    skipPersist.current = false;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (skipPersist.current) return;
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const api = useMemo<LifecycleApi>(() => ({
    ...state,
    hydrated,

    createRequisition: (r, actor) =>
      setState((s) => ({
        ...s,
        requisitions: [r, ...s.requisitions],
        audit: [{ at: now(), actor, action: "created requisition draft", subject: r.role }, ...s.audit],
      })),

    transitionRequisition: (id, to, actor) =>
      setState((s) => {
        const req = s.requisitions.find((r) => r.id === id);
        if (!req) return s;
        const requisitions = s.requisitions.map((r) =>
          r.id === id
            ? {
                ...r,
                status: to,
                statusLabel: STATUS_LABEL[to],
                signoffs:
                  to === "published"
                    ? r.signoffs.map((x) => ({ ...x, state: "Signed" as const }))
                    : to === "pending"
                      ? r.signoffs.map((x, i) => ({ ...x, state: (i === 0 ? "Signed" : "Awaiting") as "Signed" | "Awaiting" }))
                      : r.signoffs,
              }
            : r,
        );
        // Publishing creates (or opens) the linked role — the requisition → role chain.
        let roles = s.roles;
        if (to === "published") {
          const existing = s.roles.find((ro) => ro.fromReq === id || ro.title === req.role);
          roles = existing
            ? s.roles.map((ro) => (ro === existing ? { ...ro, status: "Open" as const, fromReq: id } : ro))
            : [{ id: `R-${String(s.roles.length + 1).padStart(2, "0")}`, title: req.role, status: "Open" as const, dept: req.dept, fromReq: id }, ...s.roles];
        }
        return {
          ...s,
          requisitions,
          roles,
          audit: [
            { at: now(), actor, action: `transitioned to ${STATUS_LABEL[to]}${to === "published" ? " · open role created" : ""}`, subject: req.role },
            ...s.audit,
          ],
        };
      }),

    createRole: (title, dept, status, actor, fromReq) =>
      setState((s) => ({
        ...s,
        roles: [{ id: `R-${String(s.roles.length + 1).padStart(2, "0")}`, title, status, dept, fromReq }, ...s.roles],
        audit: [{ at: now(), actor, action: `created ${status.toLowerCase()} role`, subject: title }, ...s.audit],
      })),

    moveCandidate: (name, toStage, actor) =>
      setState((s) => {
        const cand = s.candidates.find((c) => c.name === name);
        if (!cand || cand.stage === toStage) return s;
        return {
          ...s,
          candidates: s.candidates.map((c) => (c.name === name ? { ...c, stage: toStage } : c)),
          audit: [{ at: now(), actor, action: `moved ${cand.stage} → ${toStage}`, subject: name }, ...s.audit],
        };
      }),

    addCandidate: (c, actor) =>
      setState((s) => ({
        ...s,
        candidates: [c, ...s.candidates],
        audit: [{ at: now(), actor, action: "added candidate", subject: c.name }, ...s.audit],
      })),

    resetDemo: () => {
      try { window.localStorage.removeItem(KEY); } catch {}
      setState(SEED);
    },
  }), [state, hydrated]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useLifecycle(): LifecycleApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLifecycle must be used within <LifecycleProvider>");
  return ctx;
}
