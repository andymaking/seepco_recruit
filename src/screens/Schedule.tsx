"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { useHover } from "@/lib/useHover";
import { PfBanner, PfBtn } from "@/components/os/ui";
import { toolMoment } from "@/data/recruiterOnboarding";

const days = [
  { d: "Mon", n: "16" },
  { d: "Tue", n: "17" },
  { d: "Wed", n: "18" },
  { d: "Thu", n: "19" },
  { d: "Fri", n: "20" },
];
const times = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00"];
const avail = [
  [0, 1, 0, 1, 0],
  [1, 0, 1, 0, 0],
  [1, 0, 1, 0, 1],
  [0, 1, 1, 0, 1],
  [1, 0, 0, 1, 0],
  [0, 1, 0, 1, 0],
  [0, 0, 1, 0, 0],
];

const rounds = ["Round 1", "Round 2", "Panel"];
const types = ["Video", "In-person"];

const interviewers = [
  { init: "TA", tone: "#AF52DE", name: "Tosin Adeyemi", role: "Head of Design" },
  { init: "KS", tone: "#16B364", name: "Kemi Salami", role: "Engineering Lead" },
  { init: "DM", tone: "#16B364", name: "David Mensah", role: "VP Product" },
];

const cellBase: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  textAlign: "center",
  fontSize: 11,
  padding: "10px 4px",
  borderRadius: 7,
};

function seg(active: boolean): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    padding: "8px 14px",
    borderRadius: 8,
    cursor: "pointer",
    background: active ? "#ECF9F3" : "#fff",
    color: active ? "#16B364" : "var(--ink2)",
    border: active ? "1px solid #16B364" : "1px solid var(--border)",
  };
}

function BackLink({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        fontWeight: 600,
        color: hovered ? "#16B364" : "var(--ink3)",
        cursor: "pointer",
        marginBottom: 14,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>{" "}
      Adaeze Obi
    </div>
  );
}

/**
 * IN-FLOW CALENDAR CONNECT. The recruiter is staring at an availability grid
 * with no provider behind it — that is the moment to ask, and the ask is
 * framed by what it unlocks, never as a settings chore. Both sentences come
 * from TOOL_MOMENTS so the Integrations card and this banner say the same
 * thing. Shows only while BOTH providers are off; dismissible.
 */
function CalendarConnect({ where }: { where: string }) {
  const { isConnected, connect } = useWorkspace();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const google = toolMoment("google-calendar");
  const outlook = toolMoment("outlook");
  if (!google || !outlook) return null;

  const live = isConnected("google-calendar") ? google.name : isConnected("outlook") ? outlook.name : null;
  if (live) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12.5, fontWeight: 600, color: "#129152" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16B364" }} />
        {live} connected — these open slots are your real availability
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
              {google.withoutIt} — {where}. {google.proof}.
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

export default function Schedule() {
  const go = useGo();
  const toast = useToast();
  const { isConnected } = useWorkspace();
  const [slot, setSlot] = useState({ day: 2, time: 2 });
  const [round, setRound] = useState("Round 1");
  const [type, setType] = useState("Video");
  const calendar = isConnected("google-calendar") ? "Google Calendar" : isConnected("outlook") ? "Outlook" : null;

  const sd = days[slot.day];
  const stime = times[slot.time];
  const schedWhen = `${sd.d} Jun ${sd.n}, ${stime} · ${round}`;
  const schedTypeLabel = `${type} interview`;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1180 }}>
      <BackLink onClick={() => go("shortlist")} />
      <h1 style={{ margin: "0 0 18px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Schedule interview</h1>

      <CalendarConnect where="the slot you pick is only held inside Hirebrew" />

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        {/* CALENDAR */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>June 2026 · Week 3</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, border: "1px solid #DAF3E6", background: "#fff" }} />
                Available
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: "#16B364" }} />
                Selected
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <div style={{ width: 48, flex: "none" }} />
            {days.map((d) => (
              <div key={d.n} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2)" }}>{d.d}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{d.n}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {times.map((tm, ti) => (
              <div key={tm} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <div style={{ width: 48, flex: "none", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--ink3)", textAlign: "right" }}>{tm}</div>
                {days.map((dy, di) => {
                  const isOpen = avail[ti][di] === 1;
                  const isSel = slot.day === di && slot.time === ti;
                  let label: string;
                  let cs: React.CSSProperties;
                  if (isSel) {
                    label = "Selected";
                    cs = { background: "#16B364", color: "#fff", border: "1px solid #16B364", cursor: "pointer", fontWeight: 600 };
                  } else if (isOpen) {
                    label = "Open";
                    cs = { background: "#fff", color: "#16B364", border: "1px solid #DAF3E6", cursor: "pointer", fontWeight: 600 };
                  } else {
                    label = "·";
                    cs = { background: "#FBFCFD", color: "#CBD5E1", border: "1px solid transparent" };
                  }
                  return (
                    <div
                      key={di}
                      onClick={isOpen || isSel ? () => setSlot({ day: di, time: ti }) : undefined}
                      style={{ ...cellBase, ...cs }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* BOOKING PANEL */}
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, paddingBottom: 15, borderBottom: "1px solid var(--border2)", marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#AF52DE", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>AO</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Adaeze Obi</div>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>Senior Product Designer</div>
            </div>
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 8 }}>Interview round</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
            {rounds.map((r) => (
              <div key={r} onClick={() => setRound(r)} style={seg(round === r)}>{r}</div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 8 }}>Interview type</div>
          <div style={{ display: "flex", gap: 7, marginBottom: 16 }}>
            {types.map((t) => (
              <div key={t} onClick={() => setType(t)} style={seg(type === t)}>{t}</div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 9 }}>Interviewers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18 }}>
            {interviewers.map((p) => (
              <div key={p.init} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: p.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 10.5, flex: "none" }}>{p.init}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)" }}>{p.role}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16B364" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            ))}
          </div>

          <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 11, padding: "13px 15px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0" }}>
              <span style={{ fontSize: 12, color: "var(--ink3)" }}>When</span>
              <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>{schedWhen}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: "1px solid var(--border2)" }}>
              <span style={{ fontSize: 12, color: "var(--ink3)" }}>Type</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{schedTypeLabel}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "5px 0", borderTop: "1px solid var(--border2)" }}>
              <span style={{ fontSize: 12, color: "var(--ink3)" }}>Link</span>
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--mono)", color: "#16B364" }}>meet.talenta.io/adaeze-7f3</span>
            </div>
          </div>

          <button
            onClick={() =>
              toast(
                calendar
                  ? `Interview invite sent to Adaeze Obi — held in ${calendar}`
                  : "Interview invite sent to Adaeze Obi — connect a calendar and the slot books itself",
                "success",
              )
            }
            style={{ width: "100%", background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13.5, padding: 12, borderRadius: 10, cursor: "pointer" }}
          >
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}
