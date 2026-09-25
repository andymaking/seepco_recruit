"use client";
import { useState } from "react";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useLifecycle } from "@/state/lifecycle";
import { personaById } from "@/data/personas";
import { useHover } from "@/lib/useHover";

const DEPARTMENTS = ["Design", "Engineering", "Product", "Marketing", "Operations"];
const SENIORITIES = ["Junior", "Mid", "Senior", "Lead", "Principal"];

const mustHaves = ["6+ yrs product design", "Shipped fintech products", "Design-systems depth"];

function Breadcrumb({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: hovered ? "#16B364" : "var(--ink3)", cursor: "pointer", marginBottom: 14 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> Dashboard
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const borderColor = active ? "#16B364" : hovered ? "#CBD5E1" : "var(--border)";
  return (
    <span
      {...hoverProps}
      onClick={onClick}
      style={{
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        padding: "7px 13px",
        borderRadius: 8,
        background: active ? "#ECF9F3" : "#fff",
        color: active ? "#16B364" : "var(--ink2)",
        border: `1px solid ${borderColor}`,
        cursor: "pointer",
      }}
    >
      {label}
    </span>
  );
}

function OpenInRole({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ background: hovered ? "#129152" : "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 17px", borderRadius: 8, cursor: "pointer" }}
    >
      Create role · Draft →
    </button>
  );
}

function RegenButton({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ background: hovered ? "#FBFCFD" : "#fff", color: "var(--ink2)", border: "1px solid var(--border)", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 15px", borderRadius: 8, cursor: "pointer" }}
    >
      Regenerate
    </button>
  );
}

export default function NewRole() {
  const go = useGo();
  const toast = useToast();
  const { persona } = useApp();
  const { createRole } = useLifecycle();
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState("Design");
  const [seniority, setSeniority] = useState("Senior");
  const [desc, setDesc] = useState(
    "Owns design for our payments product. Needs strong systems thinking, fintech context, and the ability to mentor juniors."
  );
  const [jdGenerated, setJdGenerated] = useState(false);
  const { hovered: genHover, hoverProps: genHoverProps } = useHover();

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100 }}>
      <Breadcrumb onClick={() => go("dashboard")} />
      <h1 style={{ margin: "0 0 18px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Create a new role</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {/* Left: role details form */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 24px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>Role details</div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 18 }}>Give the basics and a rough description — AI handles the rest.</div>

          <div style={{ marginBottom: 15 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 7 }}>Job title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Product Designer"
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13, color: "var(--ink)", padding: "10px 13px", border: "1px solid var(--border)", borderRadius: 8, background: "#FBFCFD", outline: "none" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#16B364")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          <div style={{ marginBottom: 15 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 7 }}>Department</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {DEPARTMENTS.map((d) => (
                <Chip key={d} label={d} active={dept === d} onClick={() => setDept(d)} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 15 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 7 }}>Seniority</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {SENIORITIES.map((s) => (
                <Chip key={s} label={s} active={seniority === s} onClick={() => setSeniority(s)} />
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 7 }}>Describe what this person will do</div>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: 13, color: "var(--ink)", lineHeight: 1.55, padding: "12px 13px", border: "1px solid var(--border)", borderRadius: 8, background: "#FBFCFD", minHeight: 72, outline: "none", resize: "vertical" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#16B364")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
          </div>

          <button
            {...genHoverProps}
            onClick={() => setJdGenerated(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: genHover ? "#9741CE" : "#AF52DE", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13.5, padding: "12px 20px", borderRadius: 10, cursor: "pointer" }}
          >
            ✦ Generate with AI
          </button>
        </div>

        {/* Right: AI-generated JD panel */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 24px", minHeight: 300 }}>
          {jdGenerated ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "3px 10px", borderRadius: 5 }}>✦ GENERATED IN 38S</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.3px", marginBottom: 8 }}>Senior Product Designer</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 14 }}>
                Own end-to-end design for Hirebrew&apos;s payments product — flows used by thousands of Nigerian businesses. Partner with product and engineering, raise the bar on the design system, and mentor junior designers.
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)", marginBottom: 8 }}>MUST-HAVE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 15 }}>
                {mustHaves.map((m) => (
                  <span key={m} style={{ fontSize: 11.5, fontWeight: 600, background: "#FBFCFD", border: "1px solid var(--border)", color: "var(--ink2)", padding: "4px 10px", borderRadius: 5 }}>{m}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, padding: "13px 15px", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: 10, marginBottom: 18 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Salary band</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, fontFamily: "var(--mono)" }}>₦9.5–13.2M</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Scoring rubric</div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>5 weighted dimensions</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <OpenInRole
                  onClick={() => {
                    const name = title.trim() || "Untitled role";
                    createRole(name, dept, "Draft", `${personaById(persona).name} (${personaById(persona).title})`);
                    toast(`Draft role created — ${name} added to Open roles`, "success");
                    go("jobs");
                  }}
                />
                <RegenButton onClick={() => setJdGenerated(false)} />
              </div>
            </>
          ) : (
            <div style={{ height: "100%", minHeight: 256, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "#F7EEFC", color: "#AF52DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 14 }}>✦</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>AI will generate your job description here</div>
              <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.55, maxWidth: 300 }}>Fill in the details and hit &quot;Generate with AI&quot;. You&apos;ll get a full JD, requirements, salary band, and a scoring rubric.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
