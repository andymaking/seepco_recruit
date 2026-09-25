"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

type Convo = {
  init: string;
  tone: string;
  name: string;
  preview: string;
  time: string;
  unread: boolean;
  role: string;
};

const convos: Convo[] = [
  { init: "AO", tone: "#AF52DE", name: "Adaeze Obi", preview: "Thank you! Tuesday at 11 works perfectly.", time: "9:24", unread: false, role: "Senior Product Designer · Interview stage" },
  { init: "CO", tone: "#16B364", name: "Chidi Okafor", preview: "Could we reschedule to next week?", time: "Yest", unread: true, role: "Backend Engineer · Screening stage" },
  { init: "FA", tone: "#16B364", name: "Funmi Alabi", preview: "I’ve signed the offer — thank you!", time: "Mon", unread: false, role: "Finance Analyst · Offer stage" },
  { init: "TB", tone: "#E81E17", name: "Tunde Bakare", preview: "Sharing my portfolio link here.", time: "Mon", unread: false, role: "Growth Marketing Lead · Sourcing stage" },
];

type Msg = { side: "me" | "them"; text: string; time: string; ai: boolean };

const thread: Msg[] = [
  { side: "them", text: "Hi! Thanks for reaching out about the Senior Product Designer role.", time: "9:02", ai: false },
  { side: "me", text: "Hi Adaeze — your Paystack checkout work really stood out. Could we do a 20-min intro call this week?", time: "9:10", ai: true },
  { side: "them", text: "Absolutely. I’m free Tuesday or Wednesday.", time: "9:18", ai: false },
  { side: "me", text: "Tuesday 11:00 works — sending a calendar invite + video link now.", time: "9:22", ai: false },
  { side: "them", text: "Thank you! Tuesday at 11 works perfectly. Looking forward to it.", time: "9:24", ai: false },
];

function ConvoRow({ c, active, onClick }: { c: Convo; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", cursor: "pointer", borderRadius: 10, background: active ? "#ECF9F3" : hovered ? "#F8FAFC" : undefined }}
    >
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: c.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flex: "none" }}>{c.init}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 12.5 }}>{c.name}</span>
          <span style={{ fontSize: 10.5, color: "var(--ink3)" }}>{c.time}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.preview}</div>
      </div>
      {c.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16B364", flex: "none" }} />}
    </div>
  );
}

export default function Messages() {
  const go = useGo();
  const toast = useToast();
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState("");

  const active = convos[selected];

  const send = () => {
    toast("Message sent", "success");
    setDraft("");
  };

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <div style={{ width: 300, flex: "none", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-.3px" }}>Messages</h1>
          <button
            onClick={() => toast("New conversation started")}
            style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 11.5, padding: "7px 11px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}
          >
            + New
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
          {convos.map((c, i) => (
            <ConvoRow key={c.name} c={c} active={i === selected} onClick={() => setSelected(i)} />
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#FBFCFD" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: active.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>{active.init}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{active.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{active.role}</div>
          </div>
          <button onClick={() => go("profile")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 12, padding: "8px 13px", borderRadius: 8, cursor: "pointer" }}>View profile</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {thread.map((m, i) => {
            const isMe = m.side === "me";
            return (
              <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                <div>
                  {m.ai && <div style={{ fontSize: 10, fontWeight: 600, color: "#AF52DE", textAlign: "right", marginBottom: 3 }}>✦ AI-drafted</div>}
                  <div
                    style={{
                      maxWidth: "72%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      fontSize: 13,
                      lineHeight: 1.5,
                      ...(isMe
                        ? { background: "#16B364", color: "#fff", borderBottomRightRadius: 4 }
                        : { background: "#fff", color: "var(--ink)", border: "1px solid var(--border)", borderBottomLeftRadius: 4 }),
                    }}
                  >
                    {m.text}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink3)", marginTop: 3, textAlign: "right" }}>{m.time}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Type a message…"
            style={{ flex: 1, fontSize: 12.5, color: "var(--ink)", padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "#FBFCFD", outline: "none", fontFamily: "inherit" }}
          />
          <button onClick={() => toast("AI draft generated", "ai")} style={{ background: "#F7EEFC", color: "#AF52DE", border: "1px solid var(--aibd)", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "11px 13px", borderRadius: 10, cursor: "pointer" }}>✦ Draft</button>
          <button onClick={send} style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "11px 18px", borderRadius: 10, cursor: "pointer" }}>Send</button>
        </div>
      </div>
    </div>
  );
}
