"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { PfPageTabs } from "@/components/os/ui";
import { SEAT_LIMIT, toolMoment } from "@/data/recruiterOnboarding";

type PrefKey = "email" | "digest" | "mentions" | "sms" | "slack";

const SLACK_MOMENT = toolMoment("slack");

const profileFields = [
  { label: "Name", value: "Samuel Omosehin" },
  { label: "Role", value: "Talent Lead" },
  { label: "Email", value: "samuel.omosehin@hirebrew.com" },
  { label: "Phone", value: "+234 801 234 5678" },
];

/**
 * `slack` is the one channel whose availability is not a preference but a
 * connection — so it renders from the workspace store: connected shows the
 * channel and a toggle, disconnected shows a Connect that writes to the store
 * and is instantly true in Integrations and Screening too.
 */
const prefDefs: { key: PrefKey; label: string; sub: string; connector?: "slack" }[] = [
  { key: "email", label: "Email alerts", sub: "Shortlists, approvals, offers" },
  { key: "digest", label: "Weekly digest", sub: "Monday pipeline summary" },
  { key: "mentions", label: "@mentions", sub: "When a teammate tags you" },
  { key: "sms", label: "SMS for urgent", sub: "SLA breaches & escalations" },
  { key: "slack", label: "Slack", sub: SLACK_MOMENT?.unlocks ?? "Overnight shortlists in your team channel", connector: "slack" },
];

const settingsTeam = [
  { name: "Samuel Omosehin", role: "Talent Lead", init: "SO", tone: "#020617" },
  { name: "Tosin Adeyemi", role: "Head of Design", init: "TA", tone: "#AF52DE" },
  { name: "Kemi Salami", role: "Engineering Lead", init: "KS", tone: "#16B364" },
  { name: "David Mensah", role: "VP Product", init: "DM", tone: "#16B364" },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ width: 38, height: 22, borderRadius: 5, cursor: "pointer", flex: "none", position: "relative", background: on ? "#16B364" : "#CBD5E1" }}
    >
      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

export default function Settings() {
  const toast = useToast();
  const go = useGo();
  const { seats, isConnected, connect } = useWorkspace();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({ email: true, digest: true, mentions: true, sms: false, slack: true });
  const [tab, setTab] = useState("profile");
  const toggle = (key: PrefKey) => setPrefs((p) => ({ ...p, [key]: !p[key] }));
  const slackOn = isConnected("slack");
  /** A preference you can't receive isn't on. Slack only counts once it's wired. */
  const prefsOn = prefDefs.filter((d) => prefs[d.key] && (!d.connector || slackOn)).length;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 860 }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Settings</h1>
      <div style={{ fontSize: 13, color: "var(--ink2)" }}>Your profile, notification preferences and workspace team</div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "profile", label: "Profile" },
            { key: "notifications", label: "Notifications", count: `${prefsOn}/${prefDefs.length}` },
            { key: "team", label: "Team", count: String(settingsTeam.length) },
          ]}
        />
      </div>

      {/* PROFILE */}
      {tab === "profile" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Profile</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#020617", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 18 }}>SO</div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {profileFields.map((f) => (
                <div key={f.label}>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "#FBFCFD" }}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NOTIFICATIONS */}
      {tab === "notifications" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Notification preferences</div>
          {prefDefs.map((t) => {
            const gated = t.connector === "slack" && !slackOn;
            return (
              <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>
                    {t.label}
                    {t.connector === "slack" && slackOn && (
                      <span style={{ marginLeft: 7, fontSize: 10.5, fontWeight: 600, color: "#129152", background: "#ECF9F3", padding: "2px 7px", borderRadius: 5 }}>#hiring</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink3)", lineHeight: 1.4 }}>{t.sub}</div>
                </div>
                {gated ? (
                  <button
                    onClick={() => { connect("slack"); toast(`Slack connected — ${SLACK_MOMENT?.proof ?? "shortlists post to #hiring"}`, "success"); }}
                    style={{ flex: "none", background: "#fff", border: "1px solid var(--border)", color: "#16B364", fontFamily: "inherit", fontWeight: 600, fontSize: 12, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}
                  >
                    Connect
                  </button>
                ) : (
                  <Toggle on={prefs[t.key]} onClick={() => toggle(t.key)} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TEAM */}
      {tab === "team" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Team</div>
            {/* The lightweight in-workspace echo — not a second seat list. Inviting
                is owned by Workspace activation, the one writable seats surface. */}
            <button
              onClick={() => go("activation")}
              style={{ background: "#fff", border: "1px solid var(--border)", color: "#16B364", fontFamily: "inherit", fontWeight: 600, fontSize: 12, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}
            >
              + Invite
            </button>
          </div>
          {settingsTeam.map((p) => (
            <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--border2)" }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: p.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 11, flex: "none" }}>{p.init}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 12.5 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>{p.role}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border2)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--ink3)" }}>Seats</span>
            <span style={{ fontWeight: 600 }}>{seats.length} of {SEAT_LIMIT} · design-partner plan</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8 }}>
            <span style={{ color: "var(--ink3)" }}>Organisation</span>
            <span style={{ fontWeight: 600 }}>Hirebrew · Lagos, NG</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8 }}>
            <span style={{ color: "var(--ink3)" }}>Data region</span>
            <span style={{ fontWeight: 600, color: "#129152" }}>af-west-1 (NDPR)</span>
          </div>
        </div>
      )}
    </div>
  );
}
