"use client";
import { useGo } from "@/state/app";
import { useHover } from "@/lib/useHover";
import { SHORTLIST, type ShortlistCandidate } from "@/data/people";

type Tier = {
  key: "Strong" | "Good" | "Possible";
  label: string;
  color: string;
  bg: string;
  dot: string;
};

const TIERS: Tier[] = [
  { key: "Strong", label: "Strong Match", color: "#129152", bg: "#ECF9F3", dot: "#16B364" },
  { key: "Good", label: "Good Match", color: "#16B364", bg: "#ECF9F3", dot: "#16B364" },
  { key: "Possible", label: "Possible", color: "#8F6304", bg: "#FEF7E6", dot: "#EBA308" },
];

const tierOf = (s: number): Tier["key"] => (s >= 85 ? "Strong" : s >= 78 ? "Good" : "Possible");

const shortCols = TIERS.map((t) => ({
  ...t,
  cards: SHORTLIST.filter((c) => tierOf(c.score) === t.key),
}));

function BackLink({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: hovered ? "#16B364" : "var(--ink3)", cursor: "pointer", marginBottom: 14 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> Open roles
    </div>
  );
}

function ShortCard({ c, tier, onProfile, onSchedule }: { c: ShortlistCandidate; tier: Tier; onProfile: () => void; onSchedule: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} style={{ background: "#fff", border: `1px solid ${hovered ? "#CBD5E1" : "var(--border)"}`, borderRadius: 12, padding: "15px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 11 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flex: "none" }}>{c.init}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, letterSpacing: "-.2px" }}>{c.name}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>{c.title} · {c.co}</div>
        </div>
        <div style={{ textAlign: "center", background: tier.bg, borderRadius: 8, padding: "5px 9px", flex: "none" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700, lineHeight: 1, color: tier.color }}>{c.score}</div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: ".5px", color: tier.color, marginTop: 2 }}>MATCH</div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5, marginBottom: 11 }}>{c.note}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 13 }}>
        {c.tags.map((t) => (
          <span key={t} style={{ fontSize: 11, fontWeight: 600, background: "#FBFCFD", border: "1px solid var(--border)", color: "var(--ink2)", padding: "3px 9px", borderRadius: 6 }}>{t}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onProfile} style={{ flex: 1, background: "#fff", border: "1px solid var(--border)", color: "var(--ink)", fontFamily: "inherit", fontWeight: 600, fontSize: 12, padding: 8, borderRadius: 8, cursor: "pointer" }}>View Profile</button>
        <button onClick={onSchedule} style={{ flex: 1, background: "#16B364", border: "none", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: 12, padding: 8, borderRadius: 8, cursor: "pointer" }}>Move to Interview</button>
      </div>
    </div>
  );
}

export default function Shortlist() {
  const go = useGo();
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1240 }}>
      <BackLink onClick={() => go("jobs")} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 5 }}>
            <h1 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>AI Shortlist — Senior Product Designer</h1>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "4px 11px", borderRadius: 5, whiteSpace: "nowrap" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#AF52DE"><circle cx="6" cy="6" r="2.3" /><circle cx="13" cy="5" r="2.3" /><circle cx="6.5" cy="13" r="2.3" /><rect x="11" y="11" width="9" height="3.6" rx="1.8" /><rect x="11" y="16.5" width="6" height="3.4" rx="1.7" /></svg>
              AI Ranked
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}><b style={{ color: "var(--ink)" }}>47</b> screened · <b style={{ color: "var(--ink)" }}>12</b> shortlisted · ranked against the role scorecard</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
        {shortCols.map((col) => (
          <div key={col.key} style={{ flex: "none", width: 330, background: "#F8FAFC", border: "1px solid var(--border2)", borderRadius: 12, padding: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13, padding: "0 3px" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.dot }} />
              <div style={{ fontWeight: 700, fontSize: 13.5, flex: 1 }}>{col.label}</div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: col.color, background: col.bg, padding: "2px 9px", borderRadius: 5 }}>{col.cards.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {col.cards.map((c) => (
                <ShortCard key={c.name} c={c} tier={col} onProfile={() => go("profile")} onSchedule={() => go("schedule")} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
