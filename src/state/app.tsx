"use client";
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { pathFor } from "@/data/nav";
import type { PersonaId } from "@/data/personas";

/** Requisition lifecycle states (Role Definition demo). */
export type ReqStatus =
  | "draft" | "pending" | "approved" | "open"
  | "filled" | "closed" | "rejected" | "hold" | "cancelled";

type AppState = {
  copilotOpen: boolean;
  setCopilotOpen: (v: boolean) => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (v: boolean) => void;
  tourStep: number;
  setTourStep: (v: number) => void;
  selCand: number;
  setSelCand: (v: number) => void;
  reqStatus: ReqStatus;
  setReqStatus: (v: ReqStatus) => void;
  persona: PersonaId;
  setPersona: (v: PersonaId) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [selCand, setSelCand] = useState(0);
  const [reqStatus, setReqStatus] = useState<ReqStatus>("draft");
  // Demo stand-in for the auth session: persona survives hard reloads via
  // localStorage, read after mount so SSR and first client render agree.
  const [persona, setPersonaState] = useState<PersonaId>("executive");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("hirebrew.persona") as PersonaId | null;
      if (saved) setPersonaState(saved);
    } catch {}
  }, []);
  const setPersona = useCallback((v: PersonaId) => {
    setPersonaState(v);
    try { window.localStorage.setItem("hirebrew.persona", v); } catch {}
  }, []);

  return (
    <Ctx.Provider
      value={{
        copilotOpen, setCopilotOpen,
        navOpen, setNavOpen,
        tourOpen, setTourOpen,
        tourStep, setTourStep,
        selCand, setSelCand,
        reqStatus, setReqStatus,
        persona, setPersona,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within <AppProvider>");
  return ctx;
}

/** Mirror of the design's `go(stage)` — navigate to a stage by its id. */
export function useGo() {
  const router = useRouter();
  return (stage: string) => router.push(pathFor(stage));
}
