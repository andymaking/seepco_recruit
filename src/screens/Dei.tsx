"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";

const deiKpis = [
  { label: "Female applicants", value: "47", unit: "%", delta: "+4%", deltaColor: "#129152", deltaBg: "#ECF9F3", sub: "Target: 50% parity", bar: 47, barColor: "#AF52DE", tone: "#AF52DE", tBg: "#F7EEFC" },
  { label: "Adverse impact ratio", value: "0.94", unit: "", delta: "Pass", deltaColor: "#129152", deltaBg: "#ECF9F3", sub: "Threshold: ≥ 0.80 (4/5 rule)", bar: 94, barColor: "#16B364", tone: "#16B364", tBg: "#ECF9F3" },
  { label: "Ethnic groups represented", value: "6", unit: "", delta: "+2%", deltaColor: "#8F6304", deltaBg: "#FEF7E6", sub: "Across shortlisted candidates", bar: 70, barColor: "#EBA308", tone: "#EBA308", tBg: "#FEF7E6" },
  { label: "Active bias flags", value: "0", unit: "", delta: "Clear", deltaColor: "#129152", deltaBg: "#ECF9F3", sub: "No adverse impact detected", bar: 100, barColor: "#16B364", tone: "#16B364", tBg: "#ECF9F3" },
];

const deiFunnel = [
  { stage: "Applied", total: "3,842", pct: "100%", f: "47.2%", fn: "1,813", fw: "47%", m: "52.8%", mn: "2,029", mw: "53%", air: "—", airColor: "var(--ink3)" },
  { stage: "AI Screened", total: "3,791", pct: "98.7%", f: "47.1%", fn: "1,785", fw: "47%", m: "52.9%", mn: "2,006", mw: "53%", air: "0.99", airColor: "#129152" },
  { stage: "Human Review", total: "1,204", pct: "31.3%", f: "45.8%", fn: "551", fw: "46%", m: "54.2%", mn: "653", mw: "54%", air: "0.96", airColor: "#129152" },
  { stage: "Shortlisted", total: "487", pct: "12.7%", f: "44.6%", fn: "217", fw: "45%", m: "55.4%", mn: "270", mw: "55%", air: "0.94", airColor: "#129152" },
  { stage: "Interviewed", total: "186", pct: "4.8%", f: "43.0%", fn: "80", fw: "43%", m: "57.0%", mn: "106", mw: "57%", air: "0.91", airColor: "#129152" },
  { stage: "Offered", total: "62", pct: "1.6%", f: "41.9%", fn: "26", fw: "42%", m: "58.1%", mn: "36", mw: "58%", air: "0.88", airColor: "#8F6304" },
  { stage: "Hired", total: "47", pct: "1.2%", f: "40.4%", fn: "19", fw: "40%", m: "59.6%", mn: "28", mw: "60%", air: "0.85", airColor: "#8F6304" },
];

const deiAge = [
  { label: "18–24", pct: "8.2%", w: "8%" },
  { label: "25–34", pct: "41.5%", w: "42%" },
  { label: "35–44", pct: "32.1%", w: "32%" },
  { label: "45–54", pct: "14.7%", w: "15%" },
  { label: "55+", pct: "3.5%", w: "4%" },
];

const deiRegions = [
  { label: "Lagos", pct: "68%", w: "68%" },
  { label: "Abuja", pct: "14%", w: "14%" },
  { label: "Port Harcourt", pct: "8%", w: "8%" },
  { label: "Kano", pct: "5%", w: "5%" },
  { label: "Ibadan", pct: "3%", w: "3%" },
  { label: "Other", pct: "2%", w: "2%" },
];

const deiRoles = [
  { role: "Senior Software Engineer", dept: "Engineering", applied: "842", f: "38.2%", m: "61.8%", short: "35.7%", hired: "28.6%", hiredColor: "#8F6304", air: "0.82", status: "Monitor", sColor: "#8F6304", sBg: "#FEF7E6" },
  { role: "Product Manager", dept: "Product", applied: "524", f: "51.3%", m: "48.7%", short: "49.8%", hired: "50.0%", hiredColor: "#129152", air: "0.97", status: "Pass", sColor: "#129152", sBg: "#ECF9F3" },
  { role: "UX Designer", dept: "Design", applied: "387", f: "62.5%", m: "37.5%", short: "60.2%", hired: "57.1%", hiredColor: "#129152", air: "0.94", status: "Pass", sColor: "#129152", sBg: "#ECF9F3" },
  { role: "Data Scientist", dept: "Engineering", applied: "612", f: "34.8%", m: "65.2%", short: "33.1%", hired: "18.2%", hiredColor: "#C21A14", air: "0.71", status: "Flag", sColor: "#C21A14", sBg: "#FDE8E8" },
  { role: "Sales Executive", dept: "Sales", applied: "478", f: "48.1%", m: "51.9%", short: "46.9%", hired: "42.9%", hiredColor: "#129152", air: "0.91", status: "Pass", sColor: "#129152", sBg: "#ECF9F3" },
];

const deiTests = [
  { name: "4/5 Rule", verdict: "Pass", vColor: "#129152", dot: "#16B364", note: "AIR ≥ 0.80 across all groups", sub: "Screening stage only" },
  { name: "Statistical Parity", verdict: "Monitor", vColor: "#8F6304", dot: "#EBA308", note: "Δ 6.8pp gap at Hired stage", sub: "Female vs Male" },
  { name: "Equal Opportunity", verdict: "Flag", vColor: "#C21A14", dot: "#E81E17", note: "Data Scientist role: AIR 0.71", sub: "Requires review" },
  { name: "Calibration Test", verdict: "Pass", vColor: "#129152", dot: "#16B364", note: "AI scores consistent across groups", sub: "Rubric-level audit" },
];

export default function Dei() {
  const go = useGo();
  const [tab, setTab] = useState("funnel");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "var(--ink3)", marginBottom: 5 }}>ANALYTICS</div>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Diversity &amp; inclusion dashboard</h1>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#129152", background: "#ECF9F3", padding: "6px 12px", borderRadius: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16B364" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z" /><path d="M9 12l2 2 4-4" /></svg> NDPR compliant
        </span>
      </div>

      <div style={{ background: "#ECF9F3", border: "1px solid #DAF3E6", borderRadius: 12, padding: "14px 18px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 11 }}>
        <span style={{ color: "#16B364", fontSize: 16, flex: "none" }}>⛉</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#129152", marginBottom: 3 }}>NDPR data compliance notice</div>
          <div style={{ fontSize: 12, color: "#129152", lineHeight: 1.5 }}>All diversity metrics are aggregated and anonymised per the Nigeria Data Protection Regulation. No individual-level demographic data is shown; aggregations with fewer than 5 individuals are suppressed to prevent re-identification.</div>
        </div>
        <span style={{ fontSize: 11, color: "#129152", whiteSpace: "nowrap" }}>Last audited: Jun 1, 2026</span>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "funnel", label: "Funnel & KPIs" },
            { key: "representation", label: "Representation" },
            { key: "roles", label: "Roles", count: String(deiRoles.length) },
            { key: "tests", label: "Bias tests", count: String(deiTests.length) },
          ]}
        />
      </div>

      {/* FUNNEL & KPIS */}
      {tab === "funnel" && (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
            {deiKpis.map((k) => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "17px 19px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: k.tBg, color: k.tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>◔</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: k.deltaColor, background: k.deltaBg, padding: "3px 9px", borderRadius: 5 }}>{k.delta}</span>
                </div>
                <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.7px", lineHeight: 1 }}>{k.value}<span style={{ fontSize: 15, color: "var(--ink3)" }}>{k.unit}</span></div>
                <div style={{ fontSize: 12, color: "var(--ink2)", fontWeight: 600, marginTop: 6 }}>{k.label}</div>
                <div style={{ height: 5, borderRadius: 4, background: "#F1F5F9", overflow: "hidden", marginTop: 11 }}><div style={{ height: "100%", borderRadius: 4, width: `${k.bar}%`, background: k.barColor }} /></div>
                <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 7 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {/* FUNNEL DROP-OFF */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", maxWidth: 900 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>▽ Diversity drop-off by funnel stage</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 16 }}>Aggregated gender representation at each stage — NDPR anonymised</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 2fr 2fr 0.6fr", gap: 10, paddingBottom: 9, borderBottom: "1px solid var(--border2)", fontSize: 10, fontWeight: 700, letterSpacing: ".3px", color: "var(--ink3)" }}>
              <div>STAGE</div><div>TOTAL</div><div style={{ color: "#AF52DE" }}>FEMALE</div><div style={{ color: "#16B364" }}>MALE</div><div style={{ textAlign: "right" }}>AIR</div>
            </div>
            {deiFunnel.map((r) => (
              <div key={r.stage} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.6fr 2fr 2fr 0.6fr", gap: 10, padding: "11px 0", borderBottom: "1px solid var(--border2)", alignItems: "center" }}>
                <div><div style={{ fontWeight: 600, fontSize: 12.5 }}>{r.stage}</div><div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--ink3)" }}>{r.total}</div></div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--ink2)" }}>{r.pct}</div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE" }}>{r.f}</span><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink3)" }}>{r.fn}</span></div>
                  <div style={{ height: 6, borderRadius: 4, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, width: r.fw, background: "#C77DE8" }} /></div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 11, fontWeight: 600, color: "#16B364" }}>{r.m}</span><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink3)" }}>{r.mn}</span></div>
                  <div style={{ height: 6, borderRadius: 4, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 4, width: r.mw, background: "#57CB92" }} /></div>
                </div>
                <div style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: r.airColor }}>{r.air}</div>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "12px 14px", background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 11, fontSize: 12, color: "#8F6304", lineHeight: 1.5 }}><b>⚠ Female drop-off detected (Applied → Hired):</b> representation declined from 47.2% to 40.4% — a 6.8pp drop. AIR at Hired is 0.85, approaching the 0.80 threshold. Review interview &amp; offer stages.</div>
          </div>
        </>
      )}

      {/* REPRESENTATION — gender, age, regions */}
      {tab === "representation" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Gender at shortlist</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginBottom: 16 }}>Aggregated — NDPR compliant · 487 total</div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div style={{ width: 120, height: 120, borderRadius: "50%", flex: "none", background: "conic-gradient(#AF52DE 0 44.6%, #16B364 44.6% 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 74, height: 74, borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}><div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>487</div><div style={{ fontSize: 9, color: "var(--ink3)", fontWeight: 600 }}>Total</div></div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "#AF52DE" }} /><span style={{ flex: 1, color: "var(--ink2)", fontWeight: 600 }}>Female</span><span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>217</span><span style={{ color: "var(--ink3)", fontSize: 11 }}>44.6%</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "#16B364" }} /><span style={{ flex: 1, color: "var(--ink2)", fontWeight: 600 }}>Male</span><span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>270</span><span style={{ color: "var(--ink3)", fontSize: 11 }}>55.4%</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: "#CBD5E1" }} /><span style={{ flex: 1, color: "var(--ink3)" }}>Not disclosed</span><span style={{ color: "var(--ink3)", fontSize: 11 }}>Suppressed</span></div>
              </div>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Age group · shortlisted</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginBottom: 14 }}>Aggregated cohorts only</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {deiAge.map((a) => (
                <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ width: 46, fontSize: 11.5, fontWeight: 600, color: "var(--ink2)" }}>{a.label}</span><div style={{ flex: 1, height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 5, width: a.w, background: "#16B364" }} /></div><span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, width: 40, textAlign: "right" }}>{a.pct}</span></div>
              ))}
            </div>
          </div>

          {/* REGIONAL */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Regional representation</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginBottom: 15 }}>Shortlisted candidates by region (aggregated)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {deiRegions.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 11 }}><span style={{ width: 90, fontSize: 12, fontWeight: 600, color: "var(--ink2)" }}>{r.label}</span><div style={{ flex: 1, height: 8, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 5, width: r.w, background: "#16B364" }} /></div><span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, width: 34, textAlign: "right" }}>{r.pct}</span></div>
              ))}
            </div>
            <div style={{ marginTop: 15, padding: "11px 13px", background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 10, fontSize: 11.5, color: "#8F6304", lineHeight: 1.45 }}><b>⚠ High Lagos concentration (68%)</b> — consider geo-diverse sourcing.</div>
          </div>
        </div>
      )}

      {/* ROLES — diversity metrics by role */}
      {tab === "roles" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "15px 20px 13px", fontWeight: 700, fontSize: 15 }}>Diversity metrics by role</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.7fr 0.8fr 0.6fr 0.8fr", gap: 10, padding: "10px 20px", borderTop: "1px solid var(--border2)", borderBottom: "1px solid var(--border2)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".2px", color: "var(--ink3)" }}>
            <div>ROLE</div><div>APPLIED</div><div style={{ color: "#AF52DE" }}>F%</div><div style={{ color: "#16B364" }}>M%</div><div>SHORT F%</div><div>AIR</div><div>STATUS</div>
          </div>
          {deiRoles.map((r) => (
            <div key={r.role} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.7fr 0.8fr 0.6fr 0.8fr", gap: 10, padding: "12px 20px", borderBottom: "1px solid var(--border2)", alignItems: "center" }}>
              <div><div style={{ fontWeight: 600, fontSize: 12.5 }}>{r.role}</div><div style={{ fontSize: 11, color: "var(--ink3)" }}>{r.dept}</div></div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600 }}>{r.applied}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "#AF52DE" }}>{r.f}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "#16B364" }}>{r.m}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: r.hiredColor }}>{r.hired}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>{r.air}</div>
              <div><span style={{ fontSize: 10.5, fontWeight: 600, color: r.sColor, background: r.sBg, padding: "3px 9px", borderRadius: 5 }}>{r.status}</span></div>
            </div>
          ))}
        </div>
      )}

      {/* BIAS TESTS — adverse-impact harness */}
      {tab === "tests" && (
        <div style={{ background: "#FBF7FD", border: "1px solid var(--aibd)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>✦ Bias &amp; adverse-impact test harness</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", background: "#fff", border: "1px solid var(--border)", padding: "4px 11px", borderRadius: 5 }}>Last run: 2h ago</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 16 }}>Automated fairness checks run against each screening batch — results are NDPR-compliant aggregates</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
            {deiTests.map((t) => (
              <div key={t.name} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "15px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>{t.name}</span><span style={{ width: 8, height: 8, borderRadius: "50%", background: t.dot }} /></div>
                <div style={{ fontSize: 18, fontWeight: 700, color: t.vColor, marginBottom: 7 }}>{t.verdict}</div>
                <div style={{ fontSize: 11, color: "var(--ink2)", lineHeight: 1.4, marginBottom: 3 }}>{t.note}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink3)" }}>{t.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", background: "#FDE8E8", border: "1px solid #FAD2D1", borderRadius: 11 }}>
            <span style={{ color: "#C21A14", fontSize: 16, flex: "none" }}>⚠</span>
            <div style={{ flex: 1, fontSize: 12.5, color: "#8F130E", lineHeight: 1.5 }}><b>Action required — Data Scientist role · Equal Opportunity flag:</b> female hire rate (18.2%) is well below male (81.8%). AIR 0.71 falls below the 0.80 threshold. Recommend immediate rubric review &amp; bias audit for this role.</div>
            <button onClick={() => go("role")} style={{ background: "#C21A14", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>Review now</button>
          </div>
        </div>
      )}
    </div>
  );
}
