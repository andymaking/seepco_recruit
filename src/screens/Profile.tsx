"use client";
import { useState } from "react";
import { useGo, useApp } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { PfPageTabs } from "@/components/os/ui";
import { CANDIDATES } from "@/data/people";

/** AI dimension scores (inlined from the design's `profDims`). */
const profDims = [
  { dim: "Portfolio depth", val: "94", w: "94%", color: "#16B364" },
  { dim: "Systems thinking", val: "90", w: "90%", color: "#16B364" },
  { dim: "Visual craft", val: "85", w: "85%", color: "#16B364" },
  { dim: "Communication", val: "82", w: "82%", color: "#16B364" },
  { dim: "Collaboration", val: "78", w: "78%", color: "#EBA308" },
];

type TimelineState = "done" | "current" | "upcoming";
const profTimeline = (
  [
    { label: "Applied", date: "Jun 2", state: "done" },
    { label: "AI screened — 92 role-fit", date: "Jun 3", state: "done" },
    { label: "Shortlisted", date: "Jun 5", state: "done" },
    { label: "Interview scheduled", date: "Jun 18", state: "current" },
    { label: "Reference & decision", date: "Pending", state: "upcoming" },
  ] as { label: string; date: string; state: TimelineState }[]
).map((t) => ({
  ...t,
  dotColor: t.state === "done" ? "#16B364" : t.state === "current" ? "#16B364" : "#CBD5E1",
  labelColor: t.state === "upcoming" ? "#64748B" : "#020617",
}));

const profFeedback = [
  { init: "TA", tone: "#AF52DE", name: "Tosin Adeyemi", role: "Head of Design", rating: "4.5", note: "Exceptional systems thinking; portfolio rationale is original and well-argued." },
  { init: "KS", tone: "#16B364", name: "Kemi Salami", role: "Engineering Lead", rating: "4.0", note: "Collaborative, communicates trade-offs clearly. Some B2B gaps but coachable." },
];

const profDocs = [
  { name: "CV — Adaeze Obi.pdf", meta: "PDF · 2.1 MB", icon: "▦", tone: "#C21A14" },
  { name: "Portfolio", meta: "figma.com/@adaeze", icon: "◇", tone: "#AF52DE" },
  { name: "Right-to-work (NIN)", meta: "Verified · Smile ID", icon: "⛉", tone: "#16B364" },
  { name: "Reference — Chioma A.", meta: "Green · completed", icon: "☎", tone: "#16B364" },
];

function DocCard({ d, onOpen }: { d: (typeof profDocs)[number]; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", border: `1px solid ${hovered ? "#CBD5E1" : "var(--border2)"}`, borderRadius: 10, cursor: "pointer" }}
    >
      <span style={{ width: 30, height: 30, borderRadius: 8, background: "#F8FAFC", color: d.tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flex: "none" }}>{d.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)" }}>{d.meta}</div>
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: hovered ? "#16B364" : "var(--ink3)", cursor: "pointer", marginBottom: 16 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> Shortlist
    </div>
  );
}

export default function Profile() {
  const go = useGo();
  const toast = useToast();
  const { selCand } = useApp();
  const c = CANDIDATES[selCand] ?? CANDIDATES[0];
  const [tab, setTab] = useState("screening");

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1180 }}>
      <BackLink onClick={() => go("shortlist")} />

      {/* Header card — identity + primary actions, above the section bar */}
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 24px", display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: c.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 22, flex: "none" }}>{c.init}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 3 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px" }}>{c.name}</h1>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "#16B364", background: "#ECF9F3", padding: "4px 11px", borderRadius: 5 }}>Interview · Round 1</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>Senior Product Designer · Paystack · {c.loc} · Applied Jun 2, 2026</div>
        </div>
        <div style={{ textAlign: "center", background: "#ECF9F3", borderRadius: 12, padding: "10px 16px", flex: "none" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 700, color: "#129152", lineHeight: 1 }}>{c.score}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#129152", letterSpacing: ".5px" }}>ROLE-FIT</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "none" }}>
          <button onClick={() => go("schedule")} style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}>Move to interview</button>
          <button onClick={() => go("messages")} style={{ background: "#fff", color: "var(--ink2)", border: "1px solid var(--border)", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}>Message</button>
        </div>
      </div>

      {/* Section tabs — the profile's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "screening", label: "AI screening" },
            { key: "feedback", label: "Feedback & documents", count: String(profFeedback.length + profDocs.length) },
            { key: "timeline", label: "Timeline" },
          ]}
        />
      </div>

      {/* AI SCREENING — summary + dimension scores, candidate details alongside */}
      {tab === "screening" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#AF52DE" }}>✦</span>
              <div style={{ fontWeight: 700, fontSize: 15 }}>AI screening summary</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "3px 9px", borderRadius: 5, marginLeft: "auto" }}>91% confidence</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.6, marginBottom: 16 }}>Strong fintech portfolio with 5 years&apos; experience. Meets all scorecard criteria; original systems-thinking rationale. Minor B2B gap, addressable via a structured ramp.</div>
            {profDims.map((d) => (
              <div key={d.dim} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{d.dim}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: d.color }}>{d.val}</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 5, width: d.w, background: d.color }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink3)" }}>Source</span><span style={{ fontWeight: 600 }}>{c.src}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink3)" }}>Email</span><span style={{ fontWeight: 600 }}>adaeze.o@email.com</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink3)" }}>Experience</span><span style={{ fontWeight: 600 }}>{c.yrs}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink3)" }}>Salary expectation</span><span style={{ fontWeight: 600, fontFamily: "var(--mono)" }}>₦11–13M</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ink3)" }}>Right-to-work</span><span style={{ fontWeight: 600, color: "#129152" }}>Verified</span></div>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK & DOCUMENTS — interviewer scores + the evidence file */}
      {tab === "feedback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 13 }}>Interview feedback</div>
            {profFeedback.map((f) => (
              <div key={f.init} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: f.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 11, flex: "none" }}>{f.init}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 12.5 }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: "var(--ink3)" }}>{f.role}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "#EBA308", marginLeft: "auto" }}>★ {f.rating}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.45, marginTop: 4 }}>{f.note}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 13 }}>Documents</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {profDocs.map((d) => <DocCard key={d.name} d={d} onOpen={() => toast(`Opening ${d.name}`, "default")} />)}
            </div>
          </div>
        </div>
      )}

      {/* TIMELINE — where the candidate sits in the pipeline */}
      {tab === "timeline" && (
        <div style={{ maxWidth: 430 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Pipeline timeline</div>
            {profTimeline.map((t) => (
              <div key={t.label} style={{ display: "flex", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", background: t.dotColor, border: "2px solid #fff", boxShadow: `0 0 0 1px ${t.dotColor}` }} />
                  <div style={{ width: 2, flex: 1, background: "var(--border2)", minHeight: 22 }} />
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5, color: t.labelColor }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)" }}>{t.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
