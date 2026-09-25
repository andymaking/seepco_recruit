"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { useHover } from "@/lib/useHover";
import { PfBanner, PfBtn } from "@/components/os/ui";
import { toolMoment } from "@/data/recruiterOnboarding";

const calDays = [
  { d: "Mon", n: "16" },
  { d: "Tue", n: "17" },
  { d: "Wed", n: "18" },
  { d: "Thu", n: "19" },
  { d: "Fri", n: "20" },
];

const calLegend = [
  { label: "Video", color: "#16B364" },
  { label: "Panel", color: "#AF52DE" },
  { label: "Screening", color: "#475569" },
  { label: "Offer", color: "#16B364" },
];

type EvtCell = {
  has: true;
  empty: false;
  name: string;
  sub: string;
  nameColor: string;
  bg: string;
  borderColor: string;
};
type EmptyCell = { has: false; empty: true };
type Cell = EvtCell | EmptyCell;
type CalRow = { time: string; cells: Cell[] };

const calRows: CalRow[] = (() => {
  const hours = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"];
  const tc: Record<string, [string, string, string]> = {
    video: ["#ECF9F3", "#16B364", "#129152"],
    panel: ["#F7EEFC", "#AF52DE", "#8A3BBD"],
    screen: ["#F1F5F9", "#475569", "#334155"],
    offer: ["#ECF9F3", "#16B364", "#129152"],
  };
  const evts = [
    { day: 0, h: "10:00", name: "Adaeze Obi", sub: "Round 1 · Video", type: "video" },
    { day: 0, h: "14:00", name: "Chidi Okafor", sub: "Screening call", type: "screen" },
    { day: 1, h: "11:00", name: "David Mensah", sub: "Panel · Product Mgr", type: "panel" },
    { day: 2, h: "09:00", name: "Tunde Bakare", sub: "Round 2 · Video", type: "video" },
    { day: 2, h: "13:00", name: "Funmi Alabi", sub: "Offer discussion", type: "offer" },
    { day: 3, h: "10:00", name: "Zainab Bello", sub: "Round 1 · Video", type: "video" },
    { day: 3, h: "15:00", name: "Ibrahim Sani", sub: "Screening call", type: "screen" },
    { day: 4, h: "11:00", name: "Adaeze Obi", sub: "Final panel", type: "panel" },
  ];
  return hours.map((h) => ({
    time: h,
    cells: [0, 1, 2, 3, 4].map<Cell>((di) => {
      const e = evts.find((x) => x.day === di && x.h === h);
      if (e) {
        const c = tc[e.type];
        return { has: true, empty: false, name: e.name, sub: e.sub, nameColor: c[2], bg: c[0], borderColor: c[1] };
      }
      return { has: false, empty: true };
    }),
  }));
})();

function EventCell({ cell, onClick }: { cell: EvtCell; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        height: 58,
        borderRadius: 8,
        padding: "7px 9px",
        background: cell.bg,
        borderLeft: `3px solid ${cell.borderColor}`,
        boxSizing: "border-box",
        overflow: "hidden",
        cursor: "pointer",
        filter: hovered ? "brightness(0.97)" : undefined,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, color: cell.nameColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {cell.name}
      </div>
      <div style={{ fontSize: 10.5, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
        {cell.sub}
      </div>
    </div>
  );
}

/**
 * Same in-flow moment as Schedule.tsx, at the other end of the same job: these
 * eight events are samples until a calendar is wired. Both sentences are read
 * from TOOL_MOMENTS, so the prompt here, the prompt on /schedule and the card
 * in /integrations are one string in one place.
 */
function CalendarConnect() {
  const { isConnected, connect } = useWorkspace();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const google = toolMoment("google-calendar");
  const outlook = toolMoment("outlook");
  if (!google || !outlook) return null;

  const live = isConnected("google-calendar") ? google.name : isConnected("outlook") ? outlook.name : null;
  if (live) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 12.5, fontWeight: 600, color: "#129152" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16B364" }} />
        {live} connected — this week is your real diary, not a sample
      </div>
    );
  }
  if (hidden) return null;

  const wire = (id: "google-calendar" | "outlook", name: string, unlocks: string) => {
    connect(id);
    toast(`${name} connected — ${unlocks}`, "success");
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <PfBanner tone="yellow" icon="calendar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260, lineHeight: 1.45 }}>
            <div style={{ color: "var(--pf-n900)", fontWeight: 600, fontSize: 13.5 }}>{google.unlocks}.</div>
            <div style={{ color: "var(--pf-n500)", fontWeight: 500, fontSize: 12.5, marginTop: 2 }}>
              These eight events are samples until a calendar is wired. {google.proof}.
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flex: "none" }}>
            <PfBtn variant="primary" icon="calendar" onClick={() => wire("google-calendar", google.name, google.unlocks)}>
              Connect Google Calendar
            </PfBtn>
            <PfBtn variant="secondary" onClick={() => wire("outlook", outlook.name, outlook.unlocks)}>
              Outlook
            </PfBtn>
            <PfBtn variant="ghost" onClick={() => setHidden(true)}>Not now</PfBtn>
          </div>
        </div>
      </PfBanner>
    </div>
  );
}

export default function Calendar() {
  const go = useGo();
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Interview calendar</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>
            <b style={{ color: "var(--ink)" }}>8 interviews</b> · week of June 16–20, 2026
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginRight: 6 }}>
            {calLegend.map((l) => (
              <span key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--ink3)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
          <button
            onClick={() => go("schedule")}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>{" "}
            Schedule
          </button>
        </div>
      </div>

      <CalendarConnect />

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ width: 52, flex: "none" }} />
          {calDays.map((d) => (
            <div key={d.n} style={{ flex: 1, textAlign: "center", paddingBottom: 8, borderBottom: "2px solid var(--border2)" }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink3)" }}>{d.d}</span>{" "}
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{d.n}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {calRows.map((row) => (
            <div key={row.time} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 52, flex: "none", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink3)", textAlign: "right" }}>
                {row.time}
              </div>
              {row.cells.map((cell, ci) =>
                cell.has ? (
                  <EventCell key={ci} cell={cell} onClick={() => go("schedule")} />
                ) : (
                  <div key={ci} style={{ flex: 1, minWidth: 0, height: 58, borderRadius: 8, border: "1px solid #F1F5F9", boxSizing: "border-box" }} />
                )
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
