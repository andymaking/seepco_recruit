"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

const refDims = [
  { label: "Would re-hire", rag: "GREEN", dot: "#16B364", bg: "#ECF9F3" },
  { label: "Ownership & impact", rag: "GREEN", dot: "#16B364", bg: "#ECF9F3" },
  { label: "Collaboration", rag: "GREEN", dot: "#16B364", bg: "#ECF9F3" },
  { label: "Tenure claim", rag: "AMBER", dot: "#EBA308", bg: "#FEF7E6" },
];

const bgChecks = [
  { name: "Identity (NIN)", partner: "Smile ID", status: "Verified", color: "#129152", bg: "#ECF9F3" },
  { name: "Employment history", partner: "VerifyMe", status: "In progress", color: "#16B364", bg: "#ECF9F3" },
  { name: "Education credentials", partner: "Youverify", status: "Verified", color: "#129152", bg: "#ECF9F3" },
  { name: "Adverse-media / sanctions", partner: "Global watchlists", status: "Clear", color: "#129152", bg: "#ECF9F3" },
];

function OutlineButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        background: hovered ? "#FBFCFD" : "#fff",
        border: "1px solid var(--border)",
        color: "var(--ink2)",
        fontFamily: "inherit",
        fontWeight: 600,
        fontSize: 13,
        padding: "10px 16px",
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function PrimaryButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        background: "var(--ink)",
        color: "#fff",
        border: "none",
        fontFamily: "inherit",
        fontWeight: 600,
        fontSize: 13,
        padding: "10px 16px",
        borderRadius: 8,
        cursor: "pointer",
        opacity: hovered ? 0.92 : 1,
      }}
    >
      {label}
    </button>
  );
}

export default function Reference() {
  const go = useGo();
  const toast = useToast();
  const [tab, setTab] = useState("calls");
  const cleared = bgChecks.filter((b) => b.status !== "In progress").length;
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>
        STAGE 08 · REFERENCE &amp; BACKGROUND CHECKS
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 260 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>
            Verified in under 48 hours, not dropped on the floor
          </h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>
            AI runs reference calls with consent, orchestrates background-check partners, and verifies right-to-work — all NDPR-compliant.
          </div>
        </div>
        <div style={{ flex: "none" }}>
          <PrimaryButton label="Proceed to offer →" onClick={() => go("offer")} />
        </div>
      </div>

      {/* Section tabs — the stage's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "calls", label: "Reference calls", count: "1" },
            { key: "checks", label: "Background checks", count: `${cleared}/${bgChecks.length}` },
            { key: "rtw", label: "Right-to-work" },
          ]}
        />
      </div>

      {/* REFERENCE CALLS */}
      {tab === "calls" && (
        <div style={{ maxWidth: 660 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
              <span style={{ color: "#AF52DE" }}>☎</span>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Reference call · scored</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", marginLeft: "auto" }}>10 min · consented · transcribed</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 13 }}>
              <b style={{ color: "var(--ink)" }}>Referee:</b> Chioma A. — former Design Director · 2 yrs
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {refDims.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 11px", borderRadius: 8, background: r.bg }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.dot }} />
                  <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{r.label}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.dot }}>{r.rag}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "11px 12px", background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 10, fontSize: 12, color: "#8F6304", lineHeight: 1.5 }}>
              <b>⚠ Contradiction:</b> candidate stated 3 yrs tenure; referee recalls ~2.5. Worth a clarifying question — amber, not red.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <PrimaryButton label="Start call" onClick={() => toast("Reference call scheduled", "success")} />
              <OutlineButton label="Contact referee" onClick={() => toast("Reference call scheduled", "success")} />
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND CHECKS */}
      {tab === "checks" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 13 }}>Background-check orchestration</div>
            {bgChecks.map((b) => (
              <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600 }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)" }}>{b.partner}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: b.color, background: b.bg, padding: "4px 10px", borderRadius: 5 }}>{b.status}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <PrimaryButton label="Run background check" onClick={() => toast("Background check initiated", "success")} />
            </div>
          </div>
        </div>
      )}

      {/* RIGHT-TO-WORK */}
      {tab === "rtw" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "#ECF9F3", border: "1px solid #B7EBD1", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <span style={{ color: "#16B364" }}>⛉</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#129152" }}>Right-to-work verified</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#129152", marginLeft: "auto" }}>97% match</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#129152", lineHeight: 1.55 }}>
              NIN slip OCR + liveness face-match via Smile ID. No expiry concerns. Identity documents encrypted at rest under NDPR retention rules.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
