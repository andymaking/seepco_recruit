"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

const auditKpis = [
  { label: "Total events", value: "14,832", delta: "+128 today", color: "#16B364" },
  { label: "Rubric changes", value: "247", delta: "Last 30 days", color: "#AF52DE" },
  { label: "Overrides", value: "89", delta: "Human-in-loop", color: "#EBA308" },
  { label: "Approvals", value: "1,204", delta: "Finalized", color: "#16B364" },
  { label: "Report dispatches", value: "563", delta: "Delivered", color: "#16B364" },
];

type AuditType = "rubric" | "override" | "approval" | "report" | "user";

const TYPE_META: Record<AuditType, { color: string; bg: string; label: string }> = {
  rubric: { color: "#8F6304", bg: "#FEF7E6", label: "Rubric change" },
  override: { color: "#C21A14", bg: "#FDE8E8", label: "Override" },
  approval: { color: "#129152", bg: "#ECF9F3", label: "Approval" },
  report: { color: "#16B364", bg: "#ECF9F3", label: "Report dispatch" },
  user: { color: "#9741CE", bg: "#F7EEFC", label: "User action" },
};

type AuditEvent = {
  time: string;
  who: string;
  init: string;
  tone: string;
  type: AuditType;
  desc: string;
  entity: string;
  hash: string;
};

const rawEvents: AuditEvent[] = [
  { time: "2026-06-22 09:42:08", who: "Tosin Adeyemi", init: "TA", tone: "#AF52DE", type: "rubric", desc: 'Modified scoring weight for "Visual craft" from 20% → 25% on Senior Product Designer rubric', entity: "RBR-2041", hash: "a3f7c…d91e" },
  { time: "2026-06-22 09:12:41", who: "Samuel Omosehin", init: "SO", tone: "#16B364", type: "override", desc: 'AI role-fit overridden for Emeka Nwosu — 71 → 78, reason: "AI-assist flag false positive, original rationale"', entity: "CND-5872", hash: "b9d2a…1c44" },
  { time: "2026-06-22 08:55:05", who: "Kemi Salami", init: "KS", tone: "#16B364", type: "approval", desc: "Requisition sign-off recorded — Senior Product Designer headcount approved (Finance + Dept head)", entity: "REQ-0441", hash: "e1f0b…8a72" },
  { time: "2026-06-21 17:47:33", who: "Tosin Adeyemi", init: "TA", tone: "#AF52DE", type: "report", desc: "Shortlist dispatched to hiring panel — 12 candidates, PDF + JSON, 3 recipients", entity: "RPT-9034", hash: "f4c8d…2b11" },
  { time: "2026-06-21 16:11:19", who: "Adaeze pipeline", init: "AI", tone: "#9741CE", type: "user", desc: "AI screened 47 applicants against stage-04 model v2.3 — knockout + role-fit scoring completed", entity: "BTH-0419", hash: "7d10a…f0c3" },
  { time: "2026-06-21 14:02:55", who: "Samuel Omosehin", init: "SO", tone: "#16B364", type: "approval", desc: "Selection decision confirmed — Adaeze Okafor advanced to references, rationale captured", entity: "CND-5801", hash: "2ab44…9e17" },
  { time: "2026-06-21 11:38:02", who: "Tosin Adeyemi", init: "TA", tone: "#AF52DE", type: "rubric", desc: "JD bias rewrite applied — 2 exclusionary phrases replaced on Senior Product Designer", entity: "JD-2207", hash: "c5e91…44da" },
  { time: "2026-06-20 15:24:10", who: "Kemi Salami", init: "KS", tone: "#16B364", type: "override", desc: "Interview speaking-time flag dismissed — reviewed, within acceptable range for panel format", entity: "CND-5872", hash: "90b3f…7e22" },
];

const auditEvents = rawEvents.map((e) => ({
  ...e,
  typeColor: TYPE_META[e.type].color,
  typeBg: TYPE_META[e.type].bg,
  typeLabel: TYPE_META[e.type].label,
}));

const EVENT_TYPE_FILTERS = ["All event types", "Rubric changes", "Overrides", "Approvals", "Report dispatches"];
const USER_FILTERS = ["All users", "Tosin Adeyemi", "Samuel Omosehin", "Kemi Salami"];
const RANGE_FILTERS = ["Last 7 days", "Last 30 days", "Last 90 days", "All time"];

const caret = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

function FilterChip({ value, onCycle }: { value: string; onCycle: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onCycle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: hovered ? "#FBFCFD" : "#fff",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "9px 13px",
        fontSize: 12.5,
        color: "var(--ink2)",
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {value} {caret}
    </div>
  );
}

function EventRow({ e, onClick }: { e: typeof auditEvents[number]; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "150px 130px 160px 1fr 100px 110px",
        gap: 14,
        padding: "13px 20px",
        borderBottom: "1px solid var(--border2)",
        alignItems: "center",
        cursor: "pointer",
        background: hovered ? "#FBFCFD" : undefined,
      }}
    >
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink3)", lineHeight: 1.4 }}>{e.time}</div>
      <div>
        <span style={{ fontSize: 11, fontWeight: 600, color: e.typeColor, background: e.typeBg, padding: "4px 10px", borderRadius: 5, whiteSpace: "nowrap" }}>{e.typeLabel}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: e.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 10, flex: "none" }}>{e.init}</div>
        <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.who}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.45 }}>{e.desc}</div>
      <div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "#16B364", background: "#ECF9F3", padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>{e.entity}</span>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink3)" }}>{e.hash}</div>
    </div>
  );
}

export default function Audit() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [typeIdx, setTypeIdx] = useState(0);
  const [userIdx, setUserIdx] = useState(0);
  const [rangeIdx, setRangeIdx] = useState(0);
  const [tab, setTab] = useState("log");

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "var(--ink3)", marginBottom: 5 }}>COMPLIANCE</div>
          <h1 style={{ margin: "0 0 5px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Immutable audit trail</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#129152", fontWeight: 600 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16B364" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>{" "}
            Append-only mode active · NDPR-retained
          </div>
        </div>
        <button onClick={() => toast("Audit log exported")} style={{ display: "flex", alignItems: "center", gap: 7, background: "#020617", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{" "}
          Export log
        </button>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "log", label: "Event log", count: "14,832" },
            { key: "summary", label: "Activity summary" },
          ]}
        />
      </div>

      {/* ACTIVITY SUMMARY — event volume by type */}
      {tab === "summary" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
          {auditKpis.map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "15px 17px" }}>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 9 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 500, marginTop: 7 }}>{k.delta}</div>
            </div>
          ))}
        </div>
      )}

      {/* EVENT LOG — search, filters, records */}
      {tab === "log" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 13px", flex: 1, minWidth: 240 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" /></svg>
              <input
                value={search}
                onChange={(ev) => setSearch(ev.target.value)}
                placeholder="Search events, users, actions…"
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "var(--ink)" }}
              />
            </div>
            <FilterChip value={EVENT_TYPE_FILTERS[typeIdx]} onCycle={() => setTypeIdx((i) => (i + 1) % EVENT_TYPE_FILTERS.length)} />
            <FilterChip value={USER_FILTERS[userIdx]} onCycle={() => setUserIdx((i) => (i + 1) % USER_FILTERS.length)} />
            <FilterChip value={RANGE_FILTERS[rangeIdx]} onCycle={() => setRangeIdx((i) => (i + 1) % RANGE_FILTERS.length)} />
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderBottom: "1px solid var(--border2)" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Event records</div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink3)", background: "#F8FAFC", padding: "2px 9px", borderRadius: 5 }}>14,832 entries</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#129152", marginLeft: "auto" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16B364" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>{" "}
                Cryptographically sealed
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "150px 130px 160px 1fr 100px 110px", gap: 14, padding: "11px 20px", borderBottom: "1px solid var(--border2)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".3px", color: "var(--ink3)" }}>
              <div>TIMESTAMP</div><div>EVENT TYPE</div><div>USER</div><div>DESCRIPTION</div><div>ENTITY</div><div>HASH</div>
            </div>
            {auditEvents.map((e) => (
              <EventRow key={e.hash} e={e} onClick={() => toast("Opening audit entry…")} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
