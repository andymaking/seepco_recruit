"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CopilotRail from "./CopilotRail";
import Tour from "./Tour";
import { useApp, useGo } from "@/state/app";
import { personaById } from "@/data/personas";

/** FR-077 gate for the recruit workspace — HR/recruiter + executive territory. */
function RecruitRestricted() {
  const go = useGo();
  const { persona: personaId } = useApp();
  const persona = personaById(personaId);
  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--ink)", fontSize: 14 }}>
      <div style={{ maxWidth: 500, width: "100%", background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: "36px 34px", textAlign: "center", boxShadow: "0 8px 24px rgba(15,23,41,.06)" }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: "var(--amberbg)", color: "var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, margin: "0 auto 14px" }}>⛉</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>The recruit workspace isn&apos;t in your role</div>
        <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 6 }}>
          You&apos;re signed in as <b style={{ color: persona.tone }}>{persona.name}</b> ({persona.title}).
          Pipelines, sequences and candidate records belong to the HR / recruiter and executive workspaces (FR-077).
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)", marginBottom: 20 }}>This access attempt was logged.</div>
        <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
          <button onClick={() => go(persona.home)} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 9, border: "none", cursor: "pointer", background: "var(--brand)", color: "#fff" }}>Go to my workspace</button>
          <button onClick={() => go("personas")} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 9, border: "1px solid var(--border)", cursor: "pointer", background: "#fff", color: "var(--ink2)" }}>Switch workspace</button>
        </div>
      </div>
    </div>
  );
}

/**
 * The named approver's lane. A hiring manager has no recruit workspace, but the
 * assessment gate names *them* — so they deep-link from a notification into the
 * one artefact they own a decision on, and nothing else. Stripped chrome: no
 * recruiter sidebar, no Copilot rail, no pipeline.
 */
const REVIEW_ONLY = ["/assessment"];

function ReviewChrome({ children }: { children: ReactNode }) {
  const go = useGo();
  const { persona: personaId } = useApp();
  const persona = personaById(personaId);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", overflow: "hidden", color: "var(--ink)", background: "var(--bg)", fontSize: 14, WebkitFontSmoothing: "antialiased" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "var(--pf-yellow-50)", borderBottom: "1px solid var(--pf-yellow-100)", flex: "none", fontFamily: "var(--pf-font)" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-yellow-500)", background: "var(--pf-n0)", border: "1px solid var(--pf-yellow-100)", padding: "3px 8px", borderRadius: 5 }}>REVIEW REQUEST</span>
        <span style={{ fontSize: 12.5, color: "var(--pf-n600)", fontWeight: 500 }}>
          You&apos;re here to approve one artefact — the rest of the recruit workspace stays closed to your role.
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{persona.name} · {persona.title}</span>
        <button
          onClick={() => go(persona.home)}
          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "6px 11px", borderRadius: 8, cursor: "pointer", background: "var(--pf-n0)", color: "var(--pf-n600)", border: "1px solid var(--pf-n100)" }}
        >
          ← Back to manager home
        </button>
      </div>
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>{children}</main>
    </div>
  );
}

/** The app chrome: sidebar + topbar + scrollable screen content + AI rail. */
export default function Shell({ children }: { children: ReactNode }) {
  const { copilotOpen, persona: personaId } = useApp();
  const persona = personaById(personaId);
  const pathname = usePathname();

  if (!persona.legacyAccess) {
    // Narrow exception, not a widened role: personas.ts is untouched, and only
    // the route carrying this persona's own approval decision opens.
    if (persona.id === "manager" && REVIEW_ONLY.includes(pathname)) return <ReviewChrome>{children}</ReviewChrome>;
    return <RecruitRestricted />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", color: "var(--ink)", background: "var(--bg)", fontSize: 14, WebkitFontSmoothing: "antialiased" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
        <Topbar />
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>{children}</main>
          {copilotOpen && <CopilotRail />}
        </div>
      </div>
      <Tour />
    </div>
  );
}
