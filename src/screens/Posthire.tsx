"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useHover } from "@/lib/useHover";

const qohParts = [
  { label: "Manager rating", val: 90 },
  { label: "Peer feedback", val: 84 },
  { label: "Output velocity", val: 78 },
  { label: "Engagement (eNPS)", val: 88 },
];

const checkins = [
  { day: "DAY 30", status: "Complete", note: "Positive · on track", color: "#16B364", bg: "#ECF9F3", bd: "#B7EBD1" },
  { day: "DAY 60", status: "Scheduled", note: "Async video", color: "#16B364", bg: "#ECF9F3", bd: "#DAF3E6" },
  { day: "DAY 90", status: "Probation", note: "Decision point", color: "#64748B", bg: "#FBFCFD", bd: "#E2E8F0" },
];

function RetroButton({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ background: hovered ? "#129152" : "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "11px 18px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      View 90-day retro
    </button>
  );
}

export default function Posthire() {
  const go = useGo();
  const [tab, setTab] = useState("qoh");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header + primary CTA */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>STAGE 11 · POST-HIRE / EVALUATION</div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Confirm the hire — and teach the machine</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>Structured 30/60/90 check-ins, a quality-of-hire score, and a feedback loop that recalibrates the screening models.</div>
        </div>
        <RetroButton onClick={() => go("qoh")} />
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "qoh", label: "Quality of hire" },
            { key: "checkins", label: "30 / 60 / 90 check-ins", count: String(checkins.length) },
            { key: "loop", label: "Feedback loop" },
          ]}
        />
      </div>

      {/* QUALITY OF HIRE — composite score + probation decision */}
      {tab === "qoh" && (
        <>
          <div style={{ background: "linear-gradient(135deg,#16B364,#129152)", borderRadius: 12, padding: 22, color: "#fff", maxWidth: 460 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.85, marginBottom: 8 }}>Quality-of-hire · day 30</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 46, fontWeight: 700, lineHeight: 1 }}>4.3</div>
              <div style={{ fontSize: 18, fontWeight: 600, opacity: 0.8 }}>/ 5.0</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.5, marginBottom: 14 }}>Composite of manager + peer feedback, output velocity, and engagement. Above the ≥4.0 target.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {qohParts.map((q) => (
                <div key={q.label} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ flex: 1, fontSize: 11.5, fontWeight: 600, opacity: 0.92 }}>{q.label}</div>
                  <div style={{ width: 80, height: 6, borderRadius: 4, background: "rgba(255,255,255,.25)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${q.val}%`, background: "#fff", borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ECF9F3", color: "#16B364", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flex: "none" }}>✓</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Probation recommendation: confirm the hire</div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>No early disengagement signals. Manager rating strong, peer feedback positive, on track against the 30-day plan.</div>
            </div>
            <RetroButton onClick={() => go("qoh")} />
          </div>
        </>
      )}

      {/* CHECK-INS — structured 30/60/90 touchpoints */}
      {tab === "checkins" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", maxWidth: 680 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>30 / 60 / 90 check-ins</div>
          <div style={{ display: "flex", gap: 10 }}>
            {checkins.map((c) => (
              <div key={c.day} style={{ flex: 1, border: `1px solid ${c.bd}`, background: c.bg, borderRadius: 11, padding: "13px 14px" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: c.color }}>{c.day}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, margin: "4px 0 3px" }}>{c.status}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>{c.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEEDBACK LOOP — outcomes recalibrate the screening models */}
      {tab === "loop" && (
        <div style={{ background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 12, padding: "18px 20px", maxWidth: 680 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "#AF52DE" }}>↻</span>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#9741CE" }}>Feedback loop → screening models</div>
          </div>
          <div style={{ fontSize: 12.5, color: "#9741CE", lineHeight: 1.6 }}>This hire&apos;s 90-day outcome feeds back into the <b>stage-04 screening model</b> and the <b>stage-02 scorecard</b>. The platform&apos;s choices improve with every cycle — audited quarterly to confirm it doesn&apos;t amplify bias.</div>
        </div>
      )}
    </div>
  );
}
