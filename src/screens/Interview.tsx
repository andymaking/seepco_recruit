"use client";
import { useToast } from "@/state/toast";

const liveRubric = [
  { dim: "Portfolio depth", val: 94, color: "#16B364", tag: "Strong" },
  { dim: "Systems thinking", val: 90, color: "#16B364", tag: "Strong" },
  { dim: "Visual craft", val: 85, color: "#16B364", tag: "Good" },
  { dim: "Communication", val: 82, color: "#16B364", tag: "Good" },
  { dim: "Collaboration", val: 30, color: "#EBA308", tag: "Needs ev." },
];

export default function Interview() {
  const toast = useToast();
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#E81E17", marginBottom: 5 }}>STAGE 06 · INTERVIEWING</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Round 2 · Adaeze Okafor</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>Hiring-manager panel · scored live against the rubric · transcribed with consent</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FDE8E8", border: "1px solid #FAD2D1", color: "#E81E17", fontWeight: 700, fontSize: 12.5, padding: "8px 13px", borderRadius: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#E81E17", animation: "pulseDot 1.4s infinite" }} />RECORDING · 14:22
        </div>
      </div>

      <div style={{ background: "#F4FBF7", border: "1px solid #DAF3E6", borderRadius: 12, padding: "13px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#16B364", letterSpacing: ".5px" }}>60-SEC BRIEF</span>
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>Top shortlist (role-fit 92). Strong on portfolio &amp; systems. <b>Probe needed on:</b> collaboration under conflict, B2B exposure.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Live transcript</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>Speaker separation · ASR</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#16B364", marginBottom: 3 }}>INTERVIEWER · 14:01</div>
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>Walk me through a time a design decision of yours was wrong.</div>
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#AF52DE", marginBottom: 3 }}>ADAEZE · 14:02</div>
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>On the payments dashboard I optimised for density and the data showed confusion at onboarding. I rolled back, ran 5 tests, and shipped a progressive-disclosure version that lifted activation 18%.</div>
            </div>
            <div style={{ opacity: 0.55 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "#16B364", marginBottom: 3 }}>INTERVIEWER · 14:03</div>
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.55 }}>How did the eng team react to the rollback?</div>
            </div>
          </div>
          <div style={{ marginTop: 16, background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 11, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ color: "#AF52DE" }}>✦</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: "#AF52DE", letterSpacing: ".4px" }}>SUGGESTED FOLLOW-UP</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>&quot;Tell me about a cross-functional conflict you didn&apos;t win.&quot; — <i>Collaboration still needs evidence on the scorecard.</i></div>
            <button onClick={() => toast("Follow-up added to the interview script", "ai")} style={{ marginTop: 9, background: "#AF52DE", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 11.5, padding: "6px 12px", borderRadius: 7, cursor: "pointer" }}>Insert question</button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Live rubric scoring</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {liveRubric.map((r) => (
                <div key={r.dim} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 118, fontSize: 12.5, fontWeight: 600 }}>{r.dim}</div>
                  <div style={{ flex: 1, height: 7, borderRadius: 5, background: "var(--border2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.val}%`, background: r.color, borderRadius: 5 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: r.color, width: 62, textAlign: "right" }}>{r.tag}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
              <span style={{ color: "#EBA308" }}>⚠</span>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: "#8F6304" }}>Bias flag — privately to interviewer</div>
            </div>
            <div style={{ fontSize: 12.5, color: "#8F6304", lineHeight: 1.55 }}>You&apos;re at <b>61% talk-time</b> vs. a 35% panel average. Consider giving the candidate more space on the next question.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
