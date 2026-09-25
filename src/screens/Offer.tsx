"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

const offerTerms = [
  { k: "Base salary", v: "₦11.8M / yr" },
  { k: "Equity (ESOP)", v: "0.15%" },
  { k: "Sign-on bonus", v: "₦1.2M" },
  { k: "Start date", v: "15 Jul 2026" },
  { k: "Benefits", v: "Health · pension" },
  { k: "Contingencies", v: "Refs · right-to-work" },
];

const levers = [
  { name: "Sign-on bonus", impact: 88, color: "#16B364", tag: "High" },
  { name: "Remote flexibility", impact: 64, color: "#16B364", tag: "Med" },
  { name: "Base bump", impact: 42, color: "#EBA308", tag: "Low" },
];

function SignoffBtn({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ background: "var(--ink)", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 8, cursor: "pointer", opacity: hovered ? 0.9 : 1, whiteSpace: "nowrap" }}
    >
      Send for sign-off
    </button>
  );
}

function EditPackageBtn({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ background: hovered ? "#FBFCFD" : "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}
    >
      Edit package
    </button>
  );
}

function RehearseBtn({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ marginTop: 13, width: "100%", background: hovered ? "#F7EEFC" : "#F7EEFC", color: "#AF52DE", border: "1px solid var(--aibd)", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: 9, borderRadius: 8, cursor: "pointer" }}
    >
      ✦ Rehearse the call with AI
    </button>
  );
}

export default function Offer() {
  const go = useGo();
  const toast = useToast();
  const [tab, setTab] = useState("package");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>STAGE 09 · OFFER &amp; NEGOTIATION</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Extend, benchmark live, predict acceptance</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>AI drafts the offer, benchmarks comp the moment a counter lands, and recommends the levers most likely to close.</div>
        </div>
        <div style={{ flex: "none" }}>
          <SignoffBtn onClick={() => go("offerletter")} />
        </div>
      </div>

      {/* Section tabs — the stage's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "package", label: "Offer package", count: String(offerTerms.length) },
            { key: "predictor", label: "Acceptance predictor", count: "79%" },
            { key: "counter", label: "Counter strategy", count: String(levers.length) },
          ]}
        />
      </div>

      {/* OFFER PACKAGE */}
      {tab === "package" && (
        <div style={{ maxWidth: 660 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Offer letter · draft</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "3px 9px", borderRadius: 5 }}>NG-LAW TEMPLATE · AWAITING LEGAL</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, marginBottom: 16 }}>Dear <b>Adaeze</b>, we&apos;re delighted to offer you the role of <b>Senior Product Designer</b> at Hirebrew, reporting to the Head of Design and based in Lagos (hybrid).</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              {offerTerms.map((t) => (
                <div key={t.k} style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "11px 13px" }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>{t.k}</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, fontFamily: "var(--mono)" }}>{t.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <SignoffBtn onClick={() => go("offerletter")} />
              <EditPackageBtn onClick={() => toast("Offer sent to candidate", "success")} />
            </div>
          </div>
        </div>
      )}

      {/* ACCEPTANCE PREDICTOR */}
      {tab === "predictor" && (
        <div style={{ maxWidth: 520 }}>
          <div style={{ background: "#ECF9F3", border: "1px solid #B7EBD1", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#129152" }}>Acceptance likelihood</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#129152" }}>79% conf.</span>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 40, fontWeight: 700, color: "#16B364", lineHeight: 1, marginBottom: 8 }}>79%</div>
            <div style={{ height: 8, borderRadius: 5, background: "#D0F1E0", overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: "79%", background: "#16B364", borderRadius: 5 }} />
            </div>
            <div style={{ fontSize: 11.5, color: "#129152", lineHeight: 1.5 }}>High engagement, fast responses, no competing offer detected. Above the ≥75% target.</div>
          </div>
        </div>
      )}

      {/* COUNTER STRATEGY */}
      {tab === "counter" && (
        <div style={{ maxWidth: 520 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>If she counters — strategy</div>
            {levers.map((l) => (
              <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{l.name}</div>
                <div style={{ width: 90, height: 6, borderRadius: 4, background: "var(--border2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${l.impact}%`, background: l.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: l.color, width: 42, textAlign: "right" }}>{l.tag}</span>
              </div>
            ))}
            <RehearseBtn onClick={() => toast("Negotiation rehearsal started", "ai")} />
          </div>
        </div>
      )}
    </div>
  );
}
