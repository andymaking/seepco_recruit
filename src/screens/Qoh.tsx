"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";

const qohKpis = [
  { value: "4.2", unit: "/5", label: "Avg quality-of-hire score", delta: "+0.3", dColor: "#129152", dBg: "#ECF9F3", sub: "Based on 90-day performance", bar: 84, barColor: "#AF52DE", tone: "#AF52DE", tBg: "#F7EEFC" },
  { value: "87", unit: "%", label: "90-day retention rate", delta: "+5%", dColor: "#129152", dBg: "#ECF9F3", sub: "Target: ≥ 85% retention", bar: 87, barColor: "#16B364", tone: "#16B364", tBg: "#ECF9F3" },
  { value: "74", unit: "%", label: "Survey response rate", delta: "−3%", dColor: "#8F6304", dBg: "#FEF7E6", sub: "Target: ≥ 80% response", bar: 74, barColor: "#EBA308", tone: "#EBA308", tBg: "#FEF7E6" },
  { value: "81", unit: "%", label: "AI screening accuracy", delta: "+4%", dColor: "#129152", dBg: "#ECF9F3", sub: "Predicted vs actual performance", bar: 81, barColor: "#16B364", tone: "#16B364", tBg: "#ECF9F3" },
];

const qohSurvey = [
  { label: "Role fit & job satisfaction", score: "4.4", tag: "Excellent", tColor: "#129152", tBg: "#ECF9F3", w: "88%", barColor: "#AF52DE", note: "88% report strong alignment between role expectations and actual responsibilities" },
  { label: "Performance against expectations", score: "4.1", tag: "Good", tColor: "#16B364", tBg: "#ECF9F3", w: "82%", barColor: "#16B364", note: "Manager-rated performance at 90 days vs rubric criteria used in screening" },
  { label: "Team & culture integration", score: "4.3", tag: "Excellent", tColor: "#129152", tBg: "#ECF9F3", w: "86%", barColor: "#AF52DE", note: "Self-reported ease of integration into team culture" },
  { label: "Onboarding & ramp-up speed", score: "3.8", tag: "Moderate", tColor: "#8F6304", tBg: "#FEF7E6", w: "76%", barColor: "#EBA308", note: "Time-to-productivity — lower scores indicate onboarding gaps, not screening issues" },
  { label: "Intent to stay (12-month)", score: "4.0", tag: "Good", tColor: "#16B364", tBg: "#ECF9F3", w: "80%", barColor: "#16B364", note: "Self-reported likelihood of remaining in role for next 12 months" },
];

const qohSchedule = [
  { name: "30-day check-in", sub: "Role fit, initial impressions", status: "Done", sColor: "#129152" },
  { name: "60-day check-in", sub: "Performance, team integration", status: "Done", sColor: "#129152" },
  { name: "90-day check-in", sub: "Full assessment, intent to stay", status: "Active", sColor: "#16B364" },
  { name: "6-month review", sub: "Retention risk, growth plan", status: "Upcoming", sColor: "#94A3B8" },
];

const qohRetention = [
  { role: "UX Designer", pct: "100%", w: "100%", color: "#16B364" },
  { role: "Product Manager", pct: "95%", w: "95%", color: "#AF52DE" },
  { role: "Sr. Software Eng.", pct: "88%", w: "88%", color: "#16B364" },
  { role: "Sales Executive", pct: "78%", w: "78%", color: "#EBA308" },
  { role: "Data Scientist", pct: "72%", w: "72%", color: "#EBA308" },
];

const qohTracker = [
  { name: "James Okafor", init: "JO", tone: "#AF52DE", hired: "Hired Mar 2, 2026", role: "Senior Software Engineer", ai: "91%", qoh: "4.6/5", stars: 5, retained: "Yes", retColor: "#129152", pred: "Accurate", predColor: "#129152", predBg: "#ECF9F3" },
  { name: "Amaka Chukwu", init: "AC", tone: "#16B364", hired: "Hired Mar 8, 2026", role: "Product Manager", ai: "88%", qoh: "4.3/5", stars: 4, retained: "Yes", retColor: "#129152", pred: "Accurate", predColor: "#129152", predBg: "#ECF9F3" },
  { name: "Emeka Nwosu", init: "EN", tone: "#16B364", hired: "Hired Mar 15, 2026", role: "Data Scientist", ai: "79%", qoh: "3.5/5", stars: 3, retained: "Yes", retColor: "#129152", pred: "Over-scored", predColor: "#8F6304", predBg: "#FEF7E6" },
  { name: "Fatima Bello", init: "FB", tone: "#E81E17", hired: "Hired Mar 22, 2026", role: "UX Designer", ai: "85%", qoh: "4.4/5", stars: 4, retained: "Yes", retColor: "#129152", pred: "Accurate", predColor: "#129152", predBg: "#ECF9F3" },
  { name: "Chidi Eze", init: "CE", tone: "#475569", hired: "Hired Apr 1, 2026", role: "Sales Executive", ai: "72%", qoh: "2.9/5", stars: 2, retained: "Churned", retColor: "#C21A14", pred: "Under-scored", predColor: "#C21A14", predBg: "#FDE8E8" },
];

const qohCalib = [
  { crit: "Technical skills", verdict: "High predictor", vColor: "#129152", corr: "0.82", w: "82%", barColor: "#16B364", weight: "Current weight: 35% — maintain" },
  { crit: "Communication", verdict: "Strong predictor", vColor: "#129152", corr: "0.74", w: "74%", barColor: "#16B364", weight: "Current weight: 20% — consider ↑" },
  { crit: "Experience years", verdict: "Weak predictor", vColor: "#8F6304", corr: "0.31", w: "31%", barColor: "#EBA308", weight: "Current weight: 25% — consider ↓" },
  { crit: "Problem solving", verdict: "Good predictor", vColor: "#16B364", corr: "0.68", w: "68%", barColor: "#16B364", weight: "Current weight: 20% — maintain" },
];

export default function Qoh() {
  const go = useGo();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "var(--ink3)", marginBottom: 5 }}>ANALYTICS</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Quality-of-hire &amp; retention</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => toast("Survey sent", "success")} style={{ display: "flex", alignItems: "center", gap: 7, background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg> Send check-in survey
          </button>
          <button onClick={() => toast("Report exported as CSV")} style={{ display: "flex", alignItems: "center", gap: 7, background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg> Export report
          </button>
        </div>
      </div>

      <div style={{ background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span style={{ color: "#AF52DE", fontSize: 16, flex: "none" }}>◷</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#8A3BBD", marginBottom: 3 }}>90-day check-in surveys active</div>
          <div style={{ fontSize: 12, color: "#9741CE", lineHeight: 1.5 }}>Automated surveys sent at 30, 60 and 90 days post-hire track performance, satisfaction and manager feedback. Post-hire data is linked back to AI screening scores to measure predictive accuracy and rubric quality.</div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#AF52DE", whiteSpace: "nowrap" }}>12 surveys pending</span>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "surveys", label: "Surveys", count: "12" },
            { key: "retention", label: "Retention", count: "47" },
            { key: "calibration", label: "Calibration", count: String(qohCalib.length) },
          ]}
        />
      </div>

      {/* OVERVIEW — KPIs + predictive accuracy */}
      {tab === "overview" && (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
            {qohKpis.map((k) => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "17px 19px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: k.tBg, color: k.tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>★</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: k.dColor, background: k.dBg, padding: "3px 9px", borderRadius: 5 }}>{k.delta}</span>
                </div>
                <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.7px", lineHeight: 1 }}>{k.value}<span style={{ fontSize: 15, color: "var(--ink3)" }}>{k.unit}</span></div>
                <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600, marginTop: 6 }}>{k.label}</div>
                <div style={{ height: 5, borderRadius: 4, background: "#F1F5F9", overflow: "hidden", marginTop: 11 }}><div style={{ height: "100%", borderRadius: 4, width: `${k.bar}%`, background: k.barColor }} /></div>
                <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 7 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* AI SCORE VS PERFORMANCE */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}><span style={{ color: "#AF52DE" }}>◉</span><div style={{ fontWeight: 700, fontSize: 15 }}>AI score vs post-hire performance</div></div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16 }}>Screening-score correlation to 90-day manager rating · validates predictive accuracy</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 11 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}><span style={{ fontSize: 12.5, fontWeight: 600, color: "#8A3BBD" }}>Pearson correlation (r)</span><span style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700, color: "#AF52DE" }}>0.73</span></div>
                <div style={{ height: 7, borderRadius: 5, background: "#EFDDF8", overflow: "hidden", marginBottom: 8 }}><div style={{ height: "100%", width: "73%", background: "#AF52DE", borderRadius: 5 }} /></div>
                <div style={{ fontSize: 11.5, color: "#9741CE" }}>Strong positive correlation — AI scores are a reliable predictor of post-hire performance. Higher-scored hires consistently rate higher at 90 days.</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* SURVEYS — check-in results, status & schedule */}
      {tab === "surveys" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start", marginBottom: 16 }}>
          {/* SURVEY RESULTS */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>90-day check-in survey results</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16 }}>Latest cohort — Q1 2026 (47 hires, 35 responded)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              {qohSurvey.map((s) => (
                <div key={s.label}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span><span style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700 }}>{s.score}<span style={{ fontSize: 10, color: "var(--ink3)" }}>/5</span></span><span style={{ fontSize: 10.5, fontWeight: 600, color: s.tColor, background: s.tBg, padding: "2px 9px", borderRadius: 5 }}>{s.tag}</span></span></div>
                  <div style={{ height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden", marginBottom: 5 }}><div style={{ height: "100%", borderRadius: 5, width: s.w, background: s.barColor }} /></div>
                  <div style={{ fontSize: 11, color: "var(--ink3)", lineHeight: 1.4 }}>{s.note}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 15, padding: "12px 14px", background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 11, fontSize: 12, color: "#8F6304", lineHeight: 1.5 }}><b>⚠ Onboarding gap detected:</b> Ramp-up speed (3.8/5) is below the 4.0 target. This is <b>not</b> correlated with AI screening scores — it&apos;s a post-hire process gap. Recommend reviewing onboarding for Engineering &amp; Data roles.</div>
          </div>

          {/* SURVEY STATUS + SCHEDULE */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Survey response status</div>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", marginBottom: 16 }}>Q1 2026 cohort · 47 hires</div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 110, height: 110, borderRadius: "50%", flex: "none", background: "conic-gradient(#16B364 0 74%, #EBA308 74% 91%, #CBD5E1 91% 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 70, height: 70, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>47</div><div style={{ fontSize: 9, color: "var(--ink3)", fontWeight: 600 }}>Total</div></div>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#16B364" }} /><span style={{ flex: 1, color: "var(--ink2)", fontWeight: 600 }}>Completed</span><span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>35</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#EBA308" }} /><span style={{ flex: 1, color: "var(--ink2)", fontWeight: 600 }}>Pending</span><span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>8</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#CBD5E1" }} /><span style={{ flex: 1, color: "var(--ink3)" }}>No response</span><span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>4</span></div>
                </div>
              </div>
              <button onClick={() => toast("Survey sent", "success")} style={{ width: "100%", marginTop: 15, background: "#FEF7E6", color: "#8F6304", border: "1px solid #FDEECE", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: 9, borderRadius: 8, cursor: "pointer" }}>Send reminder to 8 pending</button>
            </div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Check-in schedule</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {qohSchedule.map((c) => (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <span style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontSize: 11, fontWeight: 700, color: "#fff", background: c.sColor }}>✓</span>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 12.5 }}>{c.name}</div><div style={{ fontSize: 11, color: "var(--ink3)" }}>{c.sub}</div></div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: c.sColor }}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETENTION — 90-day retention + post-hire tracker */}
      {tab === "retention" && (
        <>
          {/* RETENTION BY ROLE */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>90-day retention by role</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16 }}>Percentage of hires retained at 90 days — Q1 2026 cohort · target 85%</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {qohRetention.map((r) => (
                <div key={r.role} style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 130, fontSize: 12.5, fontWeight: 600, color: "var(--ink2)" }}>{r.role}</span><div style={{ flex: 1, height: 14, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 5, width: r.w, background: r.color }} /></div><span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, width: 40, textAlign: "right" }}>{r.pct}</span></div>
              ))}
            </div>
          </div>

          {/* POST-HIRE PERFORMANCE TRACKER */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "16px 20px 13px" }}><div style={{ fontWeight: 700, fontSize: 15 }}>Post-hire performance tracker</div><div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>Linking AI screening scores to 90-day outcomes — for rubric validation</div></div>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 0.7fr 0.7fr 0.8fr 0.9fr 1fr", gap: 10, padding: "10px 20px", borderTop: "1px solid var(--border2)", borderBottom: "1px solid var(--border2)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".2px", color: "var(--ink3)" }}>
              <div>HIRE</div><div>ROLE</div><div>AI SCORE</div><div>QOH</div><div>RATING</div><div>RETAINED</div><div>PREDICTION</div>
            </div>
            {qohTracker.map((t) => (
              <div key={t.name} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.4fr 0.7fr 0.7fr 0.8fr 0.9fr 1fr", gap: 10, padding: "12px 20px", borderBottom: "1px solid var(--border2)", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><div style={{ width: 30, height: 30, borderRadius: "50%", background: t.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 10.5, flex: "none" }}>{t.init}</div><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div><div style={{ fontSize: 10.5, color: "var(--ink3)" }}>{t.hired}</div></div></div>
                <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600 }}>{t.role}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, color: "#16B364" }}>{t.ai}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600 }}>{t.qoh}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#EBA308", fontWeight: 600 }}>★ {t.stars}</div>
                <div><span style={{ fontSize: 11, fontWeight: 600, color: t.retColor }}>{t.retained}</span></div>
                <div><span style={{ fontSize: 10.5, fontWeight: 600, color: t.predColor, background: t.predBg, padding: "3px 9px", borderRadius: 5 }}>{t.pred}</span></div>
              </div>
            ))}
            <div style={{ padding: "11px 20px", fontSize: 11.5, color: "var(--ink3)", display: "flex", gap: 16 }}><span style={{ color: "#129152", fontWeight: 600 }}>● 37 accurate</span><span style={{ color: "#8F6304", fontWeight: 600 }}>● 6 over-scored</span><span style={{ color: "#C21A14", fontWeight: 600 }}>● 4 under-scored</span></div>
          </div>
        </>
      )}

      {/* CALIBRATION — rubric insights */}
      {tab === "calibration" && (
        <div style={{ background: "#FBF7FD", border: "1px solid var(--aibd)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>✦ Rubric calibration insights</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", background: "#fff", border: "1px solid var(--border)", padding: "4px 11px", borderRadius: 5 }}>Based on 47 hires</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 16 }}>AI screening criteria performance vs post-hire outcomes — use to refine rubric weights</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
            {qohCalib.map((c) => (
              <div key={c.crit} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "15px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>{c.crit}</span><span style={{ fontSize: 10, fontWeight: 600, color: c.vColor }}>{c.verdict}</span></div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700, marginBottom: 9 }}>{c.corr}</div>
                <div style={{ height: 5, borderRadius: 4, background: "#F1F5F9", overflow: "hidden", marginBottom: 9 }}><div style={{ height: "100%", borderRadius: 4, width: c.w, background: c.barColor }} /></div>
                <div style={{ fontSize: 10.5, color: "var(--ink3)", lineHeight: 1.4 }}>{c.weight}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 11 }}>
            <span style={{ color: "#AF52DE", fontSize: 16, flex: "none" }}>✦</span>
            <div style={{ flex: 1, fontSize: 12.5, color: "#8A3BBD", lineHeight: 1.5 }}><b>Rubric optimisation recommended:</b> &quot;Experience years&quot; has low predictive correlation (0.31) to 90-day performance. Reduce its weight from 25% → 10-15% and reallocate to &quot;Communication&quot; (0.74). Estimated to improve QoH prediction accuracy by ~6%.</div>
            <button onClick={() => go("role")} style={{ background: "#AF52DE", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>Adjust rubric</button>
          </div>
        </div>
      )}
    </div>
  );
}
