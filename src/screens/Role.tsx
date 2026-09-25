"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useToast } from "@/state/toast";
import { MUST_HAVES, SCORECARD } from "@/data/assessment";

const mustHave = MUST_HAVES;
const niceHave = ["Fintech / payments", "Mentored designers", "Motion / prototyping"];
/* The ONE rubric literal lives in @/data/assessment — Stage 05 snapshots the
   same dimensions and weights, which is what "no drift" actually requires. */
const scorecard = SCORECARD;
const biasFlags = [
  { phrase: "young and energetic", issue: "Age bias", fix: "motivated and proactive" },
  { phrase: "rockstar", issue: "Narrows funnel", fix: "high-impact designer" },
];

export default function Role() {
  const toast = useToast();
  // Markup shows the generated JD state; held in local state per conventions.
  const [jdGenerated] = useState(true);
  const [tab, setTab] = useState("jd");

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Stage header — stays above the section-tab bar */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#AF52DE", marginBottom: 5 }}>STAGE 02 · ROLE DEFINITION</div>
      <h1 style={{ margin: "0 0 12px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>From one line to a complete role</h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "13px 16px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".5px" }}>BRIEF</span>
        <div style={{ flex: 1, fontSize: 14, fontStyle: "italic", color: "var(--ink)" }}>&quot;I need a senior product designer for our payments team.&quot;</div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "5px 11px", borderRadius: 5, whiteSpace: "nowrap" }}>✦ JD generated in 38s</span>
      </div>

      {jdGenerated && (
        <>
          {/* Section tabs — the page's own sections, tabbed */}
          <div style={{ margin: "16px -28px 16px" }}>
            <PfPageTabs
              active={tab}
              onSelect={setTab}
              tabs={[
                { key: "jd", label: "JD editor" },
                { key: "bias", label: "Bias flags", count: String(biasFlags.length) },
                { key: "comp", label: "Comp benchmark" },
                { key: "scorecard", label: "Scorecard", count: String(scorecard.length) },
              ]}
            />
          </div>

          {/* JD EDITOR — generated draft + the requirements it encodes */}
          {tab === "jd" && (
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Generated job description</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>v3 · human-edited · AI draft preserved</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7 }}>
                  <p style={{ margin: "0 0 11px" }}>Hirebrew is hiring a <b>Senior Product Designer</b> to own end-to-end design for our payments experiences. You&apos;ll shape flows used by thousands of Nigerian businesses, partner closely with product and engineering, and raise the bar on our design system.</p>
                  <p style={{ margin: "0 0 11px" }}>We&apos;re looking for someone who is{" "}
                    <span style={{ background: "#FEF7E6", borderBottom: "2px solid #EBA308", padding: "0 2px", borderRadius: 2, position: "relative" }}>young and energetic</span>{" "}
                    <span style={{ fontSize: 11, color: "#EBA308", fontWeight: 600 }}>⚠ age bias → &quot;motivated and proactive&quot;</span>,
                    a true{" "}
                    <span style={{ background: "#FEF7E6", borderBottom: "2px solid #EBA308", padding: "0 2px", borderRadius: 2 }}>rockstar</span>{" "}
                    <span style={{ fontSize: 11, color: "#EBA308", fontWeight: 600 }}>⚠ narrows funnel → &quot;high-impact designer&quot;</span>{" "}
                    who can work independently.</p>
                  <p style={{ margin: 0 }}>You&apos;ll lead design for new payment products from 0→1, mentor mid-level designers, and contribute to a shared system that keeps our craft consistent at scale.</p>
                </div>
                <div style={{ marginTop: 15, display: "flex", gap: 10 }}>
                  <button onClick={() => toast("Inclusive rewrites applied", "ai")} style={{ background: "#EBA308", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}>Apply 2 inclusive rewrites</button>
                  <button onClick={() => toast("JD saved", "success")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}>Edit JD</button>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 11 }}>Requirements</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#16B364", letterSpacing: ".4px", marginBottom: 7 }}>MUST-HAVE</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 13 }}>
                  {mustHave.map((m) => (
                    <span key={m} style={{ fontSize: 12, fontWeight: 600, background: "#ECF9F3", color: "#129152", border: "1px solid #B7EBD1", padding: "4px 10px", borderRadius: 5 }}>{m}</span>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".4px", marginBottom: 7 }}>NICE-TO-HAVE</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {niceHave.map((n) => (
                    <span key={n} style={{ fontSize: 12, fontWeight: 600, background: "#F8FAFC", color: "var(--ink2)", border: "1px solid var(--border)", padding: "4px 10px", borderRadius: 5 }}>{n}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BIAS FLAGS — the inline JD flags as a reviewable list */}
          {tab === "bias" && (
            <div style={{ maxWidth: 680, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Inclusive-language flags</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#8F6304", background: "#FEF7E6", padding: "3px 10px", borderRadius: 5 }}>{biasFlags.length} flags in v3 draft</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5, marginBottom: 12 }}>Every draft is scanned for biased or funnel-narrowing language. Rewrites are suggested — nothing is auto-applied.</div>
              {biasFlags.map((f, i) => (
                <div key={f.phrase} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i === biasFlags.length - 1 ? "none" : "1px solid var(--border2)", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, background: "#FEF7E6", borderBottom: "2px solid #EBA308", padding: "1px 4px", borderRadius: 2 }}>&quot;{f.phrase}&quot;</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#EBA308" }}>⚠ {f.issue}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: "var(--ink3)" }}>→</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#129152", background: "#ECF9F3", border: "1px solid #B7EBD1", padding: "3px 10px", borderRadius: 5 }}>&quot;{f.fix}&quot;</span>
                </div>
              ))}
              <div style={{ marginTop: 15, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => toast("Inclusive rewrites applied", "ai")} style={{ background: "#EBA308", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}>Apply 2 inclusive rewrites</button>
                <span style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>AI draft preserved — every change is versioned.</span>
              </div>
            </div>
          )}

          {/* COMP BENCHMARK */}
          {tab === "comp" && (
            <div style={{ maxWidth: 470, background: "#F4FBF7", border: "1px solid #DAF3E6", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#16B364" }}>Salary band</div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#16B364" }}>88% conf.</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700, color: "#16B364", marginBottom: 6 }}>₦9.5M – ₦13.2M</div>
              <div style={{ fontSize: 11.5, color: "var(--ink2)", lineHeight: 1.5 }}>Live NG + global market data · adjusted for Lagos, hybrid, senior. <span style={{ color: "#16B364", fontWeight: 600 }}>Sources cited per dimension.</span></div>
            </div>
          )}

          {/* SCORECARD — weights + the rubric that drives stages 04 & 06 */}
          {tab === "scorecard" && (
            <>
              <div style={{ maxWidth: 470, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 11 }}>Interview scorecard <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>· drives screening + interviews</span></div>
                {scorecard.map((s) => (
                  <div key={s.dim} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border2)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.dim}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--ink3)" }}>weight {s.w}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", marginTop: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5, flexWrap: "wrap" }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: "#F7EEFC", color: "#AF52DE", display: "flex", alignItems: "center", justifyContent: "center" }}>✦</span>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>One rubric drives screening &amp; interviews</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "3px 10px", borderRadius: 5 }}>JD → RUBRIC MAPPING</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5, marginBottom: 18 }}>The scorecard generated from this JD is the single source of truth — it powers AI screening (Stage 04) and structured interviews (Stage 06). Same dimensions, same weights, no drift.</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1.35fr", gap: 0, alignItems: "stretch" }}>
                  <div style={{ background: "#F7EEFC", border: "1px solid #EFDDF8", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".4px", color: "#AF52DE", marginBottom: 12 }}>MASTER SCORECARD · FROM JD</div>
                    {scorecard.map((s) => (
                      <div key={s.dim} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid #EFDDF8" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{s.dim}</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "#AF52DE", background: "#fff", border: "1px solid #EFDDF8", padding: "2px 8px", borderRadius: 5 }}>{s.w}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#9741CE", lineHeight: 1.45, marginTop: 11 }}>Version-controlled &amp; timestamped alongside the JD.</div>
                  </div>

                  <div style={{ width: 64, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: "#AF52DE" }}>DRIVES</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, color: "#AF52DE" }}><div style={{ width: 22, height: 2, background: "#AF52DE" }} /><span style={{ fontSize: 13, marginLeft: -3 }}>▸</span></div>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, color: "#AF52DE" }}><div style={{ width: 22, height: 2, background: "#AF52DE" }} /><span style={{ fontSize: 13, marginLeft: -3 }}>▸</span></div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid #AF52DE", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "#AF52DE", background: "#F7EEFC", padding: "2px 7px", borderRadius: 6 }}>STAGE 04</span>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>AI Screening</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.5, marginBottom: 10 }}>Each dimension is scored 0–100 and combined into the explainable composite role-fit score.</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {scorecard.map((s) => (
                          <span key={s.dim} style={{ fontSize: 11, fontWeight: 600, background: "#FBFCFD", color: "var(--ink2)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: 5 }}>{s.dim}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid #16B364", borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "#16B364", background: "#ECF9F3", padding: "2px 7px", borderRadius: 6 }}>STAGE 06</span>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Structured Interviews</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.5, marginBottom: 10 }}>Every dimension becomes a scored rubric line that each panelist fills in — scored live against the same weights.</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {scorecard.map((s) => (
                          <span key={s.dim} style={{ fontSize: 11, fontWeight: 600, background: "#FBFCFD", color: "var(--ink2)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: 5 }}>{s.dim}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16, padding: "11px 13px", background: "#ECF9F3", border: "1px solid #B7EBD1", borderRadius: 10, fontSize: 12, color: "#129152", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 7 }}>
                  <span>⚖</span>
                  <span><b>Consistency guarantee:</b> because both stages read the identical rubric, every candidate is screened and interviewed on exactly the same criteria — the basis for the % of scorecard dimensions actually scored (KPI).</span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
