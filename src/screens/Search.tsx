"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useHover } from "@/lib/useHover";

type Row = { go: string; title: string; sub: string };
type CandRow = Row & { init: string; tone: string };

const searchCands: CandRow[] = [
  { name: "Adaeze Obi", sub: "Senior Product Designer · Interview", init: "AO", tone: "#AF52DE", go: "profile" },
  { name: "Funmi Alabi", sub: "Product Manager · Offer", init: "FA", tone: "#16B364", go: "candidates" },
  { name: "Chidi Okafor", sub: "Product Designer · Shortlist", init: "CO", tone: "#16B364", go: "shortlist" },
].map((c) => ({ ...c, title: c.name }));

const searchRoles: Row[] = [
  { title: "Senior Product Designer", sub: "Design · Screening · 47 applicants", go: "jobs" },
  { title: "Backend Engineer (Go)", sub: "Engineering · Sourcing · 63 applicants", go: "jobs" },
  { title: "Product Manager", sub: "Product · Interviewing · 38 applicants", go: "jobs" },
];

const searchPages: Row[] = [
  { title: "AI Shortlist", sub: "Senior Product Designer", go: "shortlist" },
  { title: "Diversity & Inclusion", sub: "Analytics", go: "dei" },
  { title: "Audit log", sub: "Compliance", go: "audit" },
  { title: "Quality-of-hire & retention", sub: "Analytics", go: "qoh" },
];

const matches = (title: string, sub: string, q: string) =>
  (title + " " + sub).toLowerCase().includes(q.toLowerCase());

const Chevron = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

function CandidateRow({ c, onClick }: { c: CandRow; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#fff", border: hovered ? "1px solid #CBD5E1" : "1px solid var(--border)", borderRadius: 11, cursor: "pointer" }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flex: "none" }}>{c.init}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{c.sub}</div>
      </div>
      <Chevron />
    </div>
  );
}

function ItemRow({ r, icon, iconBg, iconColor, iconRadius, onClick }: { r: Row; icon: string; iconBg: string; iconColor: string; iconRadius: number; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#fff", border: hovered ? "1px solid #CBD5E1" : "1px solid var(--border)", borderRadius: 11, cursor: "pointer" }}>
      <div style={{ width: 34, height: 34, borderRadius: iconRadius, background: iconBg, color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flex: "none" }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{r.sub}</div>
      </div>
      <Chevron />
    </div>
  );
}

const groupLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)", marginBottom: 9 };

export default function Search() {
  const go = useGo();
  const [searchQ, setSearchQ] = useState("");

  const cands = searchCands.filter((x) => matches(x.title, x.sub, searchQ));
  const roles = searchRoles.filter((x) => matches(x.title, x.sub, searchQ));
  const pages = searchPages.filter((x) => matches(x.title, x.sub, searchQ));

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", border: "1px solid #16B364", borderRadius: 12, padding: "14px 16px", marginBottom: 8, boxShadow: "0 2px 10px rgba(26,80,200,.08)" }}>
        <span style={{ color: "#16B364", fontSize: 17 }}>⌕</span>
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search candidates, roles, pages…"
          style={{ flex: 1, fontSize: 15, color: "var(--ink)", fontWeight: 500, border: "none", outline: "none", background: "transparent", fontFamily: "inherit" }}
        />
        <span style={{ fontSize: 11, color: "var(--ink3)", fontFamily: "var(--mono)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 6 }}>ESC</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 18, paddingLeft: 4 }}>Results across candidates, roles & pages</div>

      <div style={groupLabel}>CANDIDATES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {cands.map((c) => <CandidateRow key={c.title} c={c} onClick={() => go(c.go)} />)}
      </div>

      <div style={groupLabel}>ROLES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        {roles.map((r) => <ItemRow key={r.title} r={r} icon="▤" iconBg="#ECF9F3" iconColor="#16B364" iconRadius={9} onClick={() => go(r.go)} />)}
      </div>

      <div style={groupLabel}>PAGES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {pages.map((p) => <ItemRow key={p.title} r={p} icon="▥" iconBg="#F7EEFC" iconColor="#AF52DE" iconRadius={9} onClick={() => go(p.go)} />)}
      </div>
    </div>
  );
}
