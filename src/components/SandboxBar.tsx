"use client";
import { usePathname } from "next/navigation";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useLifecycle } from "@/state/lifecycle";
import { useWorkspace } from "@/state/workspace";
import { SANDBOX_COPY, SANDBOX_ROLE } from "@/data/recruiterOnboarding";
import { NO_CHROME_PATHS } from "@/data/nav";

/**
 * SandboxBar — the sample-workspace marker.
 *
 * The pre-commitment sandbox is an ENTRY, not an app: a skeptical HR manager
 * lands on the same seeded Senior Product Designer role that Processing,
 * Screening and Shortlist already carry, feels the ranked shortlist in ~90
 * seconds, and never touches real data. All that needs to exist on top of the
 * app is a permanent marker saying so — and a way out.
 *
 * A slim strip rather than a Topbar chip, because it must also show over the
 * OS shell, which has its own header.
 *
 * "Reset sample data" finally calls useLifecycle().resetDemo() — implemented at
 * lifecycle.tsx:167 and, until now, called from no UI in the app.
 */

/**
 * The standalone surfaces are read from nav.ts's NO_CHROME registry rather than
 * relisted here: a persona-switching pill has no business on a route whose
 * audience — a candidate, a new hire on a token link, an imported employee —
 * holds no persona to switch. The two additions are this component's own: the
 * candidate assessment and offer flows.
 */
const HIDE_ON = [...NO_CHROME_PATHS, "/assessment-take", "/offer-letter"];

export default function SandboxBar() {
  const pathname = usePathname();
  const go = useGo();
  const toast = useToast();
  const { persona, setTourOpen } = useApp();
  const { resetDemo } = useLifecycle();
  const { workspace, hydrated, exitSandbox } = useWorkspace();

  if (!hydrated || !workspace.sandbox) return null;
  if (persona === "candidate" || persona === "sysadmin") return null;
  if (HIDE_ON.some((h) => pathname.startsWith(h))) return null;

  return (
    <div
      style={{
        /* A floating pill in the header's empty middle rather than a full-width
           strip — the app chrome is a 100vh flex column, so a top band would sit
           on top of the topbar's own controls. */
        position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 70,
        display: "flex", alignItems: "center", gap: 10, maxWidth: "calc(100vw - 40px)",
        padding: "6px 8px 6px 12px", borderRadius: 999, background: "#020617", color: "#fff",
        boxShadow: "0 10px 26px rgba(2,6,23,.28)", fontFamily: "var(--pf-font)",
      }}
    >
      <span
        style={{
          fontSize: 10, fontWeight: 700, letterSpacing: ".6px", padding: "3px 8px", borderRadius: 5,
          background: "rgba(175,82,222,.22)", color: "#D9A9F2", border: "1px solid rgba(175,82,222,.45)", whiteSpace: "nowrap",
        }}
      >
        {SANDBOX_COPY.chip}
      </span>
      <span style={{ fontSize: 12, color: "#CBD5E1", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <b style={{ color: "#fff" }}>{SANDBOX_ROLE.title}</b> · {SANDBOX_ROLE.applicants} → {SANDBOX_ROLE.shortlisted} ranked · nothing here touches real data
      </span>
      <button
        onClick={() => {
          resetDemo();
          setTourOpen(false);
          toast("Sample data reset — the 47-applicant role is back to its starting state", "default");
        }}
        style={{
          fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 7, cursor: "pointer",
          background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,.28)", whiteSpace: "nowrap",
        }}
      >
        {SANDBOX_COPY.exit}
      </button>
      <button
        onClick={() => {
          exitSandbox();
          setTourOpen(false);
          toast("Leaving the sample workspace — create yours with a work email", "default");
          go("signin");
        }}
        style={{
          fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "5px 13px", borderRadius: 7, cursor: "pointer",
          background: "var(--pf-primary-500)", color: "#fff", border: "1px solid transparent", whiteSpace: "nowrap",
        }}
      >
        {SANDBOX_COPY.cta} →
      </button>
    </div>
  );
}
