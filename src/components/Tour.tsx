"use client";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { SAMPLE_TOUR, SANDBOX_COPY } from "@/data/recruiterOnboarding";

export const TOUR = [
  { stage: "planning", title: "Workforce planning", body: "AI predicts the hiring need from attrition, growth and workload — then drafts the requisition before it becomes a fire." },
  { stage: "role", title: "Role definition", body: "From a one-line brief, AI writes the full JD, flags biased phrasing, and builds the scoring rubric that drives everything downstream." },
  { stage: "screening", title: "AI screening", body: "47 applicants screened overnight and ranked by an explainable role-fit score against that same rubric." },
  { stage: "shortlist", title: "AI shortlist", body: "The ranked shortlist, tiered Strong / Good / Possible, with a plain-English rationale for every candidate." },
  { stage: "schedule", title: "Interview", body: "Schedule structured interviews in a couple of clicks — the same rubric scores them live, no drift." },
  { stage: "offer", title: "Offer", body: "AI predicts acceptance likelihood, benchmarks comp, and drafts the offer letter ready for e-signature." },
  { stage: "posthire", title: "Post-hire", body: "Quality-of-hire is tracked at 90 days and fed back to recalibrate the screening model. The loop closes." },
];

/**
 * One tour component, two scripts.
 *
 * The 7-stop lifecycle TOUR is untouched. In a SAMPLE WORKSPACE it runs the
 * 3-stop SAMPLE_TOUR instead — the brief → the overnight run → the explained
 * 12, about 90 seconds — and finishes on "Create your workspace" rather than a
 * plain Finish. Same card, same progress bar, same Back/Next/Skip.
 */
export default function Tour() {
  const { tourOpen, setTourOpen, tourStep, setTourStep } = useApp();
  const { workspace, exitSandbox } = useWorkspace();
  const toast = useToast();
  const go = useGo();
  if (!tourOpen) return null;

  const sample = workspace.sandbox;
  const script = sample ? SAMPLE_TOUR : TOUR;
  const idx = Math.min(tourStep, script.length - 1);
  const step = script[idx];
  const isFirst = idx === 0;
  const isLast = idx === script.length - 1;
  const goStep = (n: number) => { setTourStep(n); go(script[n].stage); };

  const finish = () => {
    setTourOpen(false);
    if (!sample) return;
    exitSandbox();
    toast("That's the whole loop — create your workspace with a work email and bring your own backlog", "success");
    go("signin");
  };

  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 24, display: "flex", justifyContent: "center", zIndex: 50, pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", width: 460, maxWidth: "calc(100vw - 48px)", background: "#020617", color: "#fff", borderRadius: 12, padding: "20px 22px", boxShadow: "0 16px 44px rgba(15,23,41,.32)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, color: "#B7EBD1" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#57CB92" }} />
            {sample ? `${SANDBOX_COPY.chip} · ` : ""}Step {idx + 1} of {script.length}
          </span>
          <span onClick={() => setTourOpen(false)} style={{ fontSize: 12, color: "#64748B", cursor: "pointer", fontWeight: 600 }}>Skip tour ✕</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6 }}>{step.title}</div>
        <div style={{ fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, marginBottom: 16 }}>{step.body}</div>
        <div style={{ height: 4, borderRadius: 3, background: "rgba(255,255,255,.15)", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${Math.round(((idx + 1) / script.length) * 100)}%`, background: "linear-gradient(90deg,#AF52DE,#57CB92)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          {isFirst && <div style={{ flex: 1 }} />}
          {!isFirst && (
            <>
              <button onClick={() => goStep(Math.max(idx - 1, 0))} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.25)", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}>Back</button>
              <div style={{ flex: 1 }} />
            </>
          )}
          {!isLast && (
            <button onClick={() => goStep(Math.min(idx + 1, script.length - 1))} style={{ background: "#fff", color: "#020617", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 20px", borderRadius: 8, cursor: "pointer" }}>Next →</button>
          )}
          {isLast && (
            <button onClick={finish} style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 20px", borderRadius: 8, cursor: "pointer" }}>
              {sample ? `${SANDBOX_COPY.cta} →` : "Finish ✓"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
