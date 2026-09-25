"use client";
import { useState } from "react";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import type { DirCandidate } from "@/data/people";
import { useLifecycle } from "@/state/lifecycle";
import { personaById } from "@/data/personas";

// Stage → [dot/accent color, badge background]. Inlined from the design's `sm` map.
const STAGE_META: Record<string, [string, string]> = {
  Sourcing: ["#16B364", "#ECF9F3"],
  Screening: ["#AF52DE", "#F7EEFC"],
  Assessment: ["#AF52DE", "#F7EEFC"],
  Interview: ["#E81E17", "#FDE8E8"],
  Offer: ["#16B364", "#ECF9F3"],
};
const STAGES = ["Sourcing", "Screening", "Assessment", "Interview", "Offer"] as const;

const scoreColor = (n: number) => (n >= 88 ? "#16B364" : n >= 80 ? "#16B364" : "#EBA308");

function CandCard({
  c,
  onClick,
  onDragStart,
}: {
  c: DirCandidate;
  onClick: () => void;
  onDragStart: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: "#fff",
        border: `1px solid ${hovered ? "#CBD5E1" : "var(--border)"}`,
        borderRadius: 11,
        padding: "12px 13px",
        cursor: "grab",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: c.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 11, flex: "none" }}>{c.init}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
          <div style={{ fontSize: 11, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.role}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 9, borderTop: "1px solid var(--border2)" }}>
        <span style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>{c.source}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".3px", color: "var(--ink3)" }}>FIT</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, color: scoreColor(c.score) }}>{c.score}</span>
        </span>
      </div>
    </div>
  );
}

export default function Candidates() {
  const go = useGo();
  const toast = useToast();
  const { persona } = useApp();
  const actor = personaById(persona).name;
  // Pipeline lives in the lifecycle store — drag moves persist across reloads.
  const { candidates: cands, moveCandidate, addCandidate } = useLifecycle();
  const [drag, setDrag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const visible = q
    ? cands.filter((c) => c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q))
    : cands;

  const dropTo = (stage: string) => {
    if (!drag) return;
    moveCandidate(drag, stage, actor);
    setDrag(null);
  };

  const quickAdd = () => {
    const n = cands.length + 1;
    const c: DirCandidate = { name: `Referred candidate ${n}`, init: "RC", tone: "#16B364", role: "Chemical Engineer", stage: "Sourcing", score: 70, source: "Referral" };
    addCandidate(c, actor);
    toast(`${c.name} added to Sourcing — Chemical Engineer`, "success");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, gap: 16 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Candidates</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}><b style={{ color: "var(--ink)" }}>{cands.length}</b> active across all open roles</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 13px", width: 280 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" /></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search candidates…"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "var(--ink)" }}
            />
          </div>
          <button
            onClick={quickAdd}
            style={{ background: "var(--ink)", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
          >+ Add candidate</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
        {STAGES.map((stage) => {
          const [color, bg] = STAGE_META[stage];
          const cards = visible.filter((c) => c.stage === stage);
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); dropTo(stage); }}
              style={{ flex: "none", width: 236, background: "#F8FAFC", border: "1px solid var(--border2)", borderRadius: 12, padding: 12 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "0 2px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <div style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{stage}</div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color, background: bg, padding: "2px 8px", borderRadius: 5 }}>{cards.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {cards.map((c) => (
                  <CandCard
                    key={c.name}
                    c={c}
                    onClick={() => go("profile")}
                    onDragStart={() => setDrag(c.name)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
