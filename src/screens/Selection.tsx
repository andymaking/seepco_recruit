"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";

const matrix = [
  { dim: "Role-fit (screen)", a: "92", b: "88", c: "85", c1: "#16B364", c2: "#16B364", c3: "#16B364" },
  { dim: "Assessment", a: "94", b: "88", c: "85", c1: "#16B364", c2: "#16B364", c3: "#16B364" },
  { dim: "Systems thinking", a: "93", b: "85", c: "91", c1: "#16B364", c2: "#16B364", c3: "#16B364" },
  { dim: "Visual craft", a: "90", b: "92", c: "78", c1: "#16B364", c2: "#16B364", c3: "#EBA308" },
  { dim: "Collaboration", a: "82", b: "84", c: "88", c1: "#16B364", c2: "#16B364", c3: "#16B364" },
  { dim: "B2B / payments", a: "70", b: "86", c: "74", c1: "#EBA308", c2: "#16B364", c3: "#EBA308" },
];

export default function Selection() {
  const go = useGo();
  const toast = useToast();
  const [tab, setTab] = useState("matrix");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>STAGE 07 · SELECTION &amp; DECISION</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Decide with the whole panel — not the loudest voice</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>Every signal aggregated into one matrix, a devil&apos;s-advocate pass on each finalist, and a fairness check at decision time.</div>
        </div>
        <button onClick={() => go("reference")} style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "11px 18px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>Confirm Adaeze → references</button>
      </div>

      {/* Section tabs — the stage's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "matrix", label: "Decision matrix", count: "3" },
            { key: "devil", label: "Devil's advocate" },
            { key: "fairness", label: "Fairness & confidence", count: "83%" },
            { key: "rationale", label: "Rationale & sign-off" },
          ]}
        />
      </div>

      {/* DECISION MATRIX */}
      {tab === "matrix" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "15px 20px", borderBottom: "1px solid var(--border2)", fontWeight: 700, fontSize: 15 }}>Comparison matrix · 3 finalists</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr" }}>
            <div style={{ padding: "11px 20px", fontSize: 11, fontWeight: 700, color: "var(--ink3)", letterSpacing: ".3px", borderBottom: "1px solid var(--border2)" }}>DIMENSION</div>
            <div style={{ padding: "11px 14px", textAlign: "center", borderBottom: "1px solid var(--border2)", borderLeft: "1px solid var(--border2)", background: "#F7EEFC" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#AF52DE" }}>Adaeze O.</div>
              <div style={{ fontSize: 10, color: "var(--ink3)", fontWeight: 600 }}>FRONTRUNNER</div>
            </div>
            <div style={{ padding: "11px 14px", textAlign: "center", borderBottom: "1px solid var(--border2)", borderLeft: "1px solid var(--border2)" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Tunde B.</div>
              <div style={{ fontSize: 10, color: "var(--ink3)", fontWeight: 600 }}>RUNNER-UP</div>
            </div>
            <div style={{ padding: "11px 14px", textAlign: "center", borderBottom: "1px solid var(--border2)", borderLeft: "1px solid var(--border2)" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Chiamaka E.</div>
              <div style={{ fontSize: 10, color: "var(--ink3)", fontWeight: 600 }}>FINALIST</div>
            </div>
            {matrix.map((m) => (
              <div key={m.dim} style={{ display: "contents" }}>
                <div style={{ padding: "11px 20px", fontSize: 12.5, fontWeight: 600, borderBottom: "1px solid var(--border2)", display: "flex", alignItems: "center" }}>{m.dim}</div>
                <div style={{ padding: "11px 14px", textAlign: "center", borderBottom: "1px solid var(--border2)", borderLeft: "1px solid var(--border2)", background: "#FBF7FD" }}><span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14, color: m.c1 }}>{m.a}</span></div>
                <div style={{ padding: "11px 14px", textAlign: "center", borderBottom: "1px solid var(--border2)", borderLeft: "1px solid var(--border2)" }}><span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14, color: m.c2 }}>{m.b}</span></div>
                <div style={{ padding: "11px 14px", textAlign: "center", borderBottom: "1px solid var(--border2)", borderLeft: "1px solid var(--border2)" }}><span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 14, color: m.c3 }}>{m.c}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DEVIL'S ADVOCATE */}
      {tab === "devil" && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><span style={{ color: "#EBA308" }}>⚑</span><div style={{ fontWeight: 700, fontSize: 14, color: "#8F6304" }}>Devil&apos;s advocate</div></div>
            <div style={{ fontSize: 12.5, color: "#8F6304", lineHeight: 1.6, marginBottom: 10 }}><b>Against Adaeze:</b> limited direct B2B experience vs. Tunde; most impact is consumer-facing.</div>
            <div style={{ fontSize: 12.5, color: "#8F6304", lineHeight: 1.6 }}><b>For Tunde (runner-up):</b> strongest craft scores and the only finalist with payments-specific shipping history.</div>
          </div>
        </div>
      )}

      {/* FAIRNESS & CONFIDENCE */}
      {tab === "fairness" && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 14 }}>Decision confidence</div><span style={{ fontSize: 11, fontWeight: 600, color: "#16B364" }}>High agreement</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 38, fontWeight: 700, color: "#16B364", lineHeight: 1 }}>83<span style={{ fontSize: 18 }}>%</span></div>
              <div style={{ flex: 1, fontSize: 12, color: "var(--ink2)", lineHeight: 1.5 }}>Low inter-rater variance across 4 rounds. <span style={{ color: "#16B364", fontWeight: 600 }}>⚖ Fairness check passed</span> — selection not correlated with protected attributes vs. the runner-up cohort.</div>
            </div>
          </div>
        </div>
      )}

      {/* RATIONALE & SIGN-OFF */}
      {tab === "rationale" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Capture decision rationale <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>· required for audit</span></div>
          <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "13px 14px", fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 14 }}>Adaeze selected: highest role-fit, strongest systems thinking and consistent panel agreement. B2B gap is addressable via a structured 30-day payments ramp. Tunde held as a strong backup.</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => go("reference")} style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "11px 18px", borderRadius: 8, cursor: "pointer" }}>Confirm Adaeze → references</button>
            <button onClick={() => toast("Decision kept open")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "11px 16px", borderRadius: 8, cursor: "pointer" }}>Keep deciding</button>
            <div style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--ink3)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "#16B364" }}>⚖</span>Named approver · timestamp · rationale logged</div>
          </div>
        </div>
      )}
    </div>
  );
}
