"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { PfPageTabs } from "@/components/os/ui";
import { CONNECTOR_CATEGORIES, CONNECTORS } from "@/data/connectors";
import { SEAT_LIMIT, SEAT_ROLES, seatRole, type Seat, type SeatRole } from "@/data/recruiterOnboarding";

const TABS = ["API Access", "ATS Integrations", "User Roles", "Tenant Endpoints"] as const;
type Tab = (typeof TABS)[number];

const apiKeys = [
  { name: "Production API Key", token: "unrl_prod_k8x2m…9fQz", created: "Created Jan 12, 2026", status: "Active", dot: "#16B364", sColor: "#129152", sBg: "#ECF9F3" },
  { name: "Staging API Key", token: "unrl_stg_p3nR7…2aKw", created: "Created Feb 3, 2026", status: "Active", dot: "#16B364", sColor: "#16B364", sBg: "#ECF9F3" },
  { name: "Legacy Dev Key", token: "unrl_dev_xQ9p1…mNvT", created: "Expired Dec 1, 2025", status: "Expired", dot: "#CBD5E1", sColor: "#64748B", sBg: "#F1F5F9" },
];

const hookDefs = [
  { key: "batch", label: "Batch completed" },
  { key: "scored", label: "Candidate scored" },
  { key: "shortlist", label: "Shortlist ready" },
  { key: "review", label: "Review flagged" },
] as const;

const secDefs = [
  { key: "ip", label: "IP allowlisting", sub: "Restrict API to known IPs" },
  { key: "rate", label: "Rate limiting", sub: "Max 1000 req/min per key" },
  { key: "rot", label: "Key rotation", sub: "Auto-rotate every 90 days" },
] as const;

/**
 * The connector catalogue moved to src/data/connectors.ts and connection state
 * moved to the workspace store, so a tool wired here is wired everywhere —
 * Schedule, Calendar, Sequences, Screening and Settings all read the same flag.
 * The old module-scope `connected: boolean` literal was the reason an in-flow
 * connect moment was impossible; it is gone.
 *
 * `roleCards` is gone too. Seats are now a real record with one writable home
 * (Workspace activation); the User Roles tab below is its READ-OUT, which is a
 * duplicate removed rather than a third seat vocabulary added.
 */

const SEAT_TONE_HEX: Record<string, { color: string; bg: string }> = {
  red: { color: "#C21A14", bg: "#FDE8E8" },
  purple: { color: "#AF52DE", bg: "#F7EEFC" },
  green: { color: "#16B364", bg: "#ECF9F3" },
  yellow: { color: "#EBA308", bg: "#FEF7E6" },
  grey: { color: "#475569", bg: "#F1F5F9" },
  blue: { color: "#007AFF", bg: "#E8F1FE" },
};

const tenantRows = [
  { env: "Production", region: "Lagos · af-west-1", url: "api.hirebrew.talenta.io", latency: "24ms", status: "Healthy", sColor: "#129152", sBg: "#ECF9F3" },
  { env: "Staging", region: "Lagos · af-west-1", url: "staging.hirebrew.talenta.io", latency: "31ms", status: "Healthy", sColor: "#129152", sBg: "#ECF9F3" },
  { env: "DR / Backup", region: "Cape Town · af-south-1", url: "dr.hirebrew.talenta.io", latency: "88ms", status: "Standby", sColor: "#16B364", sBg: "#ECF9F3" },
  { env: "Analytics replica", region: "Lagos · af-west-1", url: "analytics.hirebrew.talenta.io", latency: "19ms", status: "Healthy", sColor: "#129152", sBg: "#ECF9F3" },
];

const TENANT_COLS = "1.1fr 1.3fr 1.6fr 0.8fr 0.9fr";

const Check = ({ size = 13, stroke }: { size?: number; stroke: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const Plus = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export default function Integrations() {
  const toast = useToast();
  const go = useGo();
  const { seats, connect, disconnect, isConnected } = useWorkspace();
  const [intTab, setIntTab] = useState<Tab>("API Access");
  const [hooks, setHooks] = useState<Record<string, boolean>>({ batch: true, scored: true, shortlist: false, review: false });
  const [sec, setSec] = useState<Record<string, boolean>>({ ip: true, rate: true, rot: false });

  const connectedCount = CONNECTORS.filter((c) => isConnected(c.id)).length;

  /** Seats grouped in SEAT_ROLES order — one vocabulary, read-only here. */
  const seatGroups: { role: SeatRole; perms: string; unlocks: string; members: Seat[]; color: string; bg: string }[] =
    SEAT_ROLES.map((r) => {
      const hex = SEAT_TONE_HEX[r.tone] ?? SEAT_TONE_HEX.grey;
      return { role: r.role, perms: r.perms, unlocks: r.unlocks, members: seats.filter((s) => s.role === r.role), color: hex.color, bg: hex.bg };
    }).filter((g) => g.members.length > 0);

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Integrations &amp; access</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>Manage API keys, tenant endpoints, user roles, and ATS integrations</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#129152", background: "#ECF9F3", padding: "6px 12px", borderRadius: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#16B364" }} />All systems operational
        </span>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={intTab}
          onSelect={(k) => setIntTab(k as Tab)}
          tabs={[
            { key: "API Access", label: "API Access", count: String(apiKeys.length) },
            { key: "ATS Integrations", label: "ATS Integrations", count: `${connectedCount}/${CONNECTORS.length}` },
            { key: "User Roles", label: "User Roles", count: `${seats.length}/${SEAT_LIMIT}` },
            { key: "Tenant Endpoints", label: "Tenant Endpoints", count: String(tenantRows.length) },
          ]}
        />
      </div>

      {/* TAB: API ACCESS */}
      {intTab === "API Access" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, background: "#ECF9F3", color: "#16B364", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚿</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>API keys</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>Authenticated access tokens</div>
                  </div>
                </div>
                <button
                  onClick={() => toast("New API key generated", "success")}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}
                >
                  <Plus size={13} /> Generate key
                </button>
              </div>
              {apiKeys.map((k) => (
                <div key={k.name} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 14px", border: "1px solid var(--border2)", borderRadius: 11, marginBottom: 9, background: "#FBFCFD" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: k.dot, flex: "none" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{k.name}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink3)" }}>{k.token}</div>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{k.created}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: k.sColor, background: k.sBg, padding: "3px 10px", borderRadius: 5 }}>{k.status}</span>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, background: "#F7EEFC", color: "#AF52DE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚯</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Webhook configuration</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>Event-driven callbacks to your system</div>
                </div>
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 7 }}>Webhook endpoint URL</div>
              <div style={{ display: "flex", gap: 9, marginBottom: 16 }}>
                <div style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 12.5, color: "var(--ink2)", padding: "10px 13px", border: "1px solid var(--border)", borderRadius: 8, background: "#FBFCFD" }}>https://api.hirebrew.io/webhooks/talenta</div>
                <button
                  onClick={() => toast("Settings saved", "success")}
                  style={{ background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "0 18px", borderRadius: 8, cursor: "pointer" }}
                >
                  Save
                </button>
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", marginBottom: 9 }}>Trigger events</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                {hookDefs.map((e) => {
                  const on = hooks[e.key];
                  return (
                    <div
                      key={e.key}
                      onClick={() => setHooks((h) => ({ ...h, [e.key]: !h[e.key] }))}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: "1px solid var(--border2)", borderRadius: 8, cursor: "pointer" }}
                    >
                      <span style={{ width: 18, height: 18, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", background: on ? "#16B364" : "#fff", border: `1px solid ${on ? "#16B364" : "var(--border)"}` }}>
                        {on && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{e.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>API usage <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink3)" }}>· 30 days</span></div>
              <div style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
                  <span style={{ color: "var(--ink2)", fontWeight: 600 }}>Requests used</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>84,320 / 100k</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", width: "84%", background: "#16B364", borderRadius: 5 }} /></div>
              </div>
              <div style={{ marginBottom: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
                  <span style={{ color: "var(--ink2)", fontWeight: 600 }}>Data transfer</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>2.1 / 5 GB</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", width: "42%", background: "#AF52DE", borderRadius: 5 }} /></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 6 }}>
                  <span style={{ color: "var(--ink2)", fontWeight: 600 }}>Error rate</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "#129152" }}>0.3%</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}><div style={{ height: "100%", width: "6%", background: "#16B364", borderRadius: 5 }} /></div>
              </div>
              <div style={{ display: "flex", gap: 12, paddingTop: 15, borderTop: "1px solid var(--border2)" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700 }}>99.8%</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Uptime</div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700 }}>142ms</div>
                  <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>Avg latency</div>
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Security settings</div>
              {secDefs.map((t) => {
                const on = sec[t.key];
                return (
                  <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--border2)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{t.sub}</div>
                    </div>
                    <div
                      onClick={() => setSec((s) => ({ ...s, [t.key]: !s[t.key] }))}
                      style={{ width: 38, height: 22, borderRadius: 5, cursor: "pointer", flex: "none", position: "relative", transition: "background .2s", background: on ? "#16B364" : "#CBD5E1" }}
                    >
                      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ATS INTEGRATIONS — catalogue from src/data/connectors.ts, state from the workspace store */}
      {intTab === "ATS Integrations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 11, padding: "12px 16px", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--ink)" }}>{connectedCount} of {CONNECTORS.length} connected.</b> Each card says what wiring it unlocks, not what
            category it belongs to — and a connection made here is the same one Schedule, Sequences, Screening and Settings read.
          </div>
          {CONNECTOR_CATEGORIES.map((cat) => (
            <div key={cat.title}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)", marginBottom: 11 }}>{cat.title}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {cat.items.map((i) => {
                  const on = isConnected(i.id);
                  return (
                    <div key={i.id} style={{ background: "#fff", border: `1px solid ${on ? "#B7EBD1" : "var(--border)"}`, borderRadius: 12, padding: "15px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 34, height: 34, borderRadius: 8, background: i.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>{i.init}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.name}</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink3)", fontFamily: "var(--mono)" }}>{i.sub}</div>
                        </div>
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "var(--ink2)", lineHeight: 1.45 }}>{i.unlocks}</div>
                      {on ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, fontSize: 11.5, fontWeight: 600, color: "#129152" }}>
                            <Check stroke="#16B364" /> Connected
                          </span>
                          <button
                            onClick={() => { disconnect(i.id); toast(`${i.name} disconnected — logged`, "default"); }}
                            style={{ background: "none", border: "none", color: "var(--ink3)", fontFamily: "inherit", fontWeight: 600, fontSize: 11.5, cursor: "pointer", padding: 0 }}
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { connect(i.id); toast(`${i.name} connected — ${i.unlocks}`, "success"); }}
                          style={{ background: "#fff", border: "1px solid var(--border)", color: "#16B364", fontFamily: "inherit", fontWeight: 600, fontSize: 12, padding: 7, borderRadius: 8, cursor: "pointer" }}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB: USER ROLES — a READ-OUT of the real seat record. The only place
          seats can be changed is Workspace activation, so there is exactly one
          writable surface and one role vocabulary in the app. */}
      {intTab === "User Roles" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: "var(--ink2)" }}>
              <b style={{ color: "var(--ink)" }}>{seats.length} of {SEAT_LIMIT} seats</b> across {seatGroups.length} role{seatGroups.length === 1 ? "" : "s"} · design-partner plan
            </div>
            <button
              onClick={() => go("activation")}
              style={{ display: "flex", alignItems: "center", gap: 7, background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}
            >
              <Plus size={14} /> Manage seats &amp; permissions
            </button>
          </div>
          <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 11, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5 }}>
            Read-only here. Seats, roles and invitations are owned by{" "}
            <span onClick={() => go("activation")} style={{ color: "#16B364", fontWeight: 600, cursor: "pointer" }}>Workspace activation →</span>{" "}
            so a permission can never be true in one screen and false in another.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
            {seatGroups.map((g) => (
              <div key={g.role} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "17px 19px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 11, background: g.bg, color: g.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, flex: "none" }}>{g.members.length}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{g.role}</div>
                    <div style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.4 }}>{g.perms}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--border2)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {g.members.map((m) => (
                    <div key={m.email} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: `${m.tone}1A`, color: m.tone, border: `1px solid ${m.tone}33`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 10, flex: "none" }}>{m.init}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name ?? m.email}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.email}</div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: m.state === "Invited" ? "#EBA308" : "#129152", background: m.state === "Invited" ? "#FEF7E6" : "#ECF9F3", padding: "3px 8px", borderRadius: 5, flex: "none" }}>{m.state}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink3)", fontStyle: "italic" }}>{g.unlocks}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--ink3)" }}>
            Unfilled roles ({SEAT_ROLES.filter((r) => !seatGroups.some((g) => g.role === r.role)).map((r) => r.role).join(" · ") || "none"}) appear the moment a seat is invited into them —{" "}
            {seatRole("Recruiter").perms.toLowerCase()} is what a Recruiter gets.
          </div>
        </div>
      )}

      {/* TAB: TENANT ENDPOINTS */}
      {intTab === "Tenant Endpoints" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#ECF9F3", border: "1px solid #B7EBD1", borderRadius: 12, padding: "15px 18px", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ color: "#16B364", fontSize: 16 }}>⛉</span>
            <div style={{ fontSize: 12.5, color: "#129152", lineHeight: 1.5 }}><b>Data residency:</b> all candidate data is stored and processed in-region (Lagos, af-west-1) to satisfy NDPR. Cross-border replication is limited to encrypted DR backups.</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: TENANT_COLS, gap: 14, padding: "12px 20px", borderBottom: "1px solid var(--border2)", fontSize: 10.5, fontWeight: 700, letterSpacing: ".3px", color: "var(--ink3)" }}>
              <div>ENVIRONMENT</div><div>REGION</div><div>ENDPOINT</div><div>LATENCY</div><div>STATUS</div>
            </div>
            {tenantRows.map((t) => (
              <div key={t.env} style={{ display: "grid", gridTemplateColumns: TENANT_COLS, gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--border2)", alignItems: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t.env}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{t.region}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#16B364" }}>{t.url}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600 }}>{t.latency}</div>
                <div><span style={{ fontSize: 11, fontWeight: 600, color: t.sColor, background: t.sBg, padding: "3px 10px", borderRadius: 5 }}>{t.status}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
