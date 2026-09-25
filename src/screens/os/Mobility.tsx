"use client";
import { Fragment, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { EMPLOYEES, MOBILITY, type MobilityMatch } from "@/data/talentos";
import { PfAvatar, PfBadge, PfBanner, PfBtn, PfCard, PfCardHead, PfPageTabs, PfProgress, PfStat, PfTh, PfTile, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------- Helpers ------------------------------- */

const byName = (n: string) => EMPLOYEES.find((e) => e.name === n);
const matchTone = (p: number): PfTone => (p >= 80 ? "green" : p >= 65 ? "yellow" : "red");
const dimTone = (v: number): PfTone => (v >= 85 ? "green" : v >= 70 ? "blue" : "yellow");

/* ------------------------------ Match ring ------------------------------ */

function MatchRing({ pct, tone, size = 50 }: { pct: number; tone: PfTone; size?: number }) {
  const r = (size - 9) / 2;
  const C = 2 * Math.PI * r;
  return (
    <span style={{ position: "relative", width: size, height: size, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-n50)" strokeWidth={4.5} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TONE[tone].bg} strokeWidth={4.5} strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`} />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 700, color: TONE[tone].fg, letterSpacing: "-.2px" }}>{pct}%</span>
    </span>
  );
}

/* -------------------------------- Switch -------------------------------- */

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{ boxSizing: "border-box", width: 38, height: 22, borderRadius: 999, border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n100)"}`, background: on ? "var(--pf-primary-500)" : "var(--pf-n100)", position: "relative", cursor: "pointer", transition: "background .18s ease", padding: 0, flex: "none" }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(2,6,23,.25)", transition: "left .18s ease" }} />
    </button>
  );
}

/* ------------------------------ Match card ------------------------------ */

function MatchCard({ m, invited, onInvite, expanded, onToggle }: {
  m: MobilityMatch; invited: boolean; onInvite: () => void; expanded: boolean; onToggle: () => void;
}) {
  const go = useGo();
  const toast = useToast();
  const e = byName(m.candidate);
  const tone = matchTone(m.match);

  return (
    <PfCard>
      {/* Role header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTile icon="target" tone="green" size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.3 }}>{m.role}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>{m.dept} · {m.loc} · Posted {m.posted}</div>
        </div>
        <PfBadge tone="grey">Internal-first</PfBadge>
      </div>

      {/* Matched person */}
      <div style={{ padding: "14px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PfAvatar init={m.init} tone={m.tone} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>{m.candidate}</span>
              {m.risk && (
                <button
                  onClick={() => toast(e?.risk ? `Leave-risk ${e.risk.score} (${e.risk.horizon}) — ${e.risk.reasons[0]}. Matched proactively before external sourcing.` : `${m.risk} — matched before external sourcing starts.`, "danger")}
                  style={{ display: "inline-flex", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
                >
                  <PfBadge tone="red"><Ic name="warning" size={11} /> {m.risk}</PfBadge>
                </button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>
              {e ? `${e.role} · ${e.dept} · ${e.tenure} tenure` : `${m.dept} · ${m.loc}`}
            </div>
            {e && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                {e.skills.slice(0, 3).map((s) => (
                  <span key={s} style={{ fontSize: 11, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{s}</span>
                ))}
              </div>
            )}
          </div>
          <MatchRing pct={m.match} tone={tone} />
        </div>

        {/* Evidence toggle */}
        <button
          onClick={onToggle}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--pf-blue-500)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{ display: "inline-flex", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>
            <Ic name="caretdown" size={12} />
          </span>
          Why {m.match}% — per-dimension evidence
        </button>

        {/* Per-dimension evidence bars */}
        {expanded && (
          <div style={{ marginTop: 10, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {m.dims.map(([d, v]) => (
              <div key={d} style={{ display: "grid", gridTemplateColumns: "160px 1fr 34px", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d}</span>
                <PfProgress pct={v} tone={dimTone(v)} height={6} />
                <span style={{ fontSize: 12, fontWeight: 600, color: TONE[dimTone(v)].fg, textAlign: "right" }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 3, paddingTop: 9, borderTop: "1px solid var(--pf-n50)" }}>
              <Ic name="info" size={12} color="var(--pf-n400)" />
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                Explainable like every score — FR-042. Dimension weights come from the skills taxonomy; same matcher as Stage 3, scoped to opted-in employees.
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          {invited ? (
            <PfBtn small variant="secondary" icon="check" onClick={() => toast(`Already invited — ${m.candidate} sees it in the Me portal`)}>Invited ✓</PfBtn>
          ) : (
            <PfBtn small variant="primary" icon="paperplane" onClick={onInvite}>Invite to apply</PfBtn>
          )}
          <PfBtn small variant="secondary" icon="user" onClick={() => { go("employee"); toast(`Opening record — ${m.candidate}`); }}>Open profile</PfBtn>
          {m.risk && (
            <PfBtn
              small variant="secondary" icon="heart"
              onClick={() => { go("retention"); toast(`Growth conversation — opening retention playbooks for ${m.candidate}`); }}
              style={{ color: "var(--pf-red-500)", border: "1px solid var(--pf-red-100)", background: "var(--pf-red-50)" }}
            >
              Start growth conversation
            </PfBtn>
          )}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
            {m.risk ? "Retention-driven proactive match" : "External sourcing not started"}
          </span>
        </div>
      </div>
    </PfCard>
  );
}

/* --------------------------- Pipeline (4 stages) ------------------------ */

type StageState = "done" | "current" | "todo";
const STAGES: { label: string; state: StageState; count: string }[] = [
  { label: "Internal match", state: "done", count: "1" },
  { label: "Invited", state: "current", count: "1" },
  { label: "Internal interview", state: "todo", count: "0" },
  { label: "Decision", state: "todo", count: "—" },
];

function StageNode({ s }: { s: (typeof STAGES)[number] }) {
  const style: Record<StageState, React.CSSProperties> = {
    done: { background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", color: "var(--pf-primary-500)" },
    current: { background: "var(--pf-n0)", border: "1.6px solid var(--pf-blue-500)", color: "var(--pf-blue-500)", boxShadow: "0 0 0 4px var(--pf-blue-50)" },
    todo: { background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", color: "var(--pf-n400)" },
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 66, flex: "none" }}>
      <span style={{ boxSizing: "border-box", width: 30, height: 30, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, ...style[s.state] }}>
        {s.state === "done" ? <Ic name="check" size={13} /> : s.count}
      </span>
      <span style={{ fontSize: 10.5, fontWeight: s.state === "current" ? 600 : 500, color: s.state === "current" ? "var(--pf-n900)" : "var(--pf-n400)", textAlign: "center", lineHeight: 1.3 }}>{s.label}</span>
    </div>
  );
}

function PipelineCandidate() {
  const go = useGo();
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={() => { go("employee"); toast("Opening record — Amara Okonkwo"); }}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", marginTop: 13, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "var(--pf-n0)", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
    >
      <PfAvatar init="AO" tone="#AF52DE" size={27} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Amara Okonkwo</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>Invited 2d ago · streamlined application — awaiting response</span>
      </span>
      <Ic name="caretright" size={12} color="var(--pf-n400)" />
    </button>
  );
}

/* --------------------------- Applications table ------------------------- */

type InternalApp = { id: string; name: string; from: string; to: string; note: string; stage: string; stageTone: PfTone; day: number };

const APPLICATIONS: InternalApp[] = [
  { id: "IA-102", name: "Ngozi Obi", from: "Finance Analyst", to: "Product Ops Lead", note: "Panel Thursday · evidence pack auto-built from the profile spine", stage: "Internal interview", stageTone: "blue", day: 6 },
  { id: "IA-104", name: "Emeka Nwosu", from: "Field Operations Lead", to: "HSE Manager", note: "Auto-screened — meets 4/5 must-haves · manager sees it only after acceptance", stage: "Applied", stageTone: "grey", day: 2 },
  { id: "IA-099", name: "Seyi Ajayi", from: "Contract Rig Technician", to: "Drilling Ops Coordinator (Perm)", note: "Contract-to-perm conversion — zero agency fee", stage: "Offer extended", stageTone: "green", day: 9 },
];

const APP_COLS = "minmax(170px,1.5fr) minmax(280px,2.4fr) 150px 80px 20px";

function AppRow({ a, last }: { a: InternalApp; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const e = byName(a.name);
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`Application ${a.id} — ${a.name}: ${a.from} → ${a.to} (${a.stage.toLowerCase()}, day ${a.day})`)}
      style={{ display: "grid", gridTemplateColumns: APP_COLS, gap: 12, alignItems: "center", padding: "12px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PfAvatar init={e?.init ?? a.name.split(" ").map((w) => w[0]).join("")} tone={e?.tone ?? "#475569"} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {a.name}
            {e?.risk && <span title="Leave-risk flagged — internal move is the retention play" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pf-red-500)", flex: "none" }} />}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{a.id}</div>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--pf-n600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.from}
          <Ic name="arrowright" size={12} color="var(--pf-n300)" />
          <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{a.to}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.note}</div>
      </div>
      <div><PfBadge tone={a.stageTone} dot>{a.stage}</PfBadge></div>
      <div style={{ fontSize: 13, color: "var(--pf-n500)" }}>Day {a.day}</div>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </div>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function Mobility() {
  const go = useGo();
  const toast = useToast();
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({ [MOBILITY[0].role]: true });
  const [released, setReleased] = useState(false);
  const [optIn, setOptIn] = useState(true);
  const [tab, setTab] = useState("matches");

  const invite = (m: MobilityMatch) => {
    setInvited((s) => ({ ...s, [m.role]: true }));
    toast(`Invitation sent to ${m.candidate} — streamlined internal application`, "success");
  };
  const release = () => {
    setReleased(true);
    toast("Released — Stage 3 begins (logged) · external sourcing live for Staff Engineer (Platform)", "danger");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0, lineHeight: 1.2 }}>Internal Mobility</h1>
            <PfBadge tone="green">Mobility loop · FR-073</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Open roles match opted-in internal profiles first — invitations, streamlined applications and proactive retention moves before external sourcing spends a naira.
          </div>
        </div>
        <PfBtn variant="secondary" icon="plus" onClick={() => toast("Internal posting drafted — opted-in employees see it 14 days before external release", "success")}>
          Post internal role
        </PfBtn>
      </div>

      {/* Mobility loop banner — page-wide */}
      <div style={{ marginTop: 16 }}>
        <PfBanner tone="green" icon="swap" cta="open" onCta={() => go("skillsgraph")}>
          <span style={{ fontWeight: 700, letterSpacing: ".3px" }}>MOBILITY LOOP</span> — Internal candidates surface <span style={{ fontWeight: 700 }}>before</span> external sourcing begins — the same matcher as Stage 3, scoped to opted-in employees.
        </PfBanner>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "matches", label: "Matches", count: String(MOBILITY.length) },
            { key: "pipeline", label: "Pipeline & governance" },
            { key: "applications", label: "Applications", count: String(APPLICATIONS.length) },
          ]}
        />
      </div>

      {/* ---------------- MATCHES — KPI pulse + internal match cards ---------------- */}
      {tab === "matches" && (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat icon="swap" tone="green" label="Internal fill rate" value="25%" unit="of fills" delta="✓ ≥25% target" deltaTone="green" />
        <PfStat icon="target" tone="blue" label="Roles matching internally" value="3" unit="open roles" delta="external on hold" deltaTone="yellow" />
        <PfStat icon="users" tone="purple" label="Opted-in employees" value="214" unit="/ 358" delta="60% this qtr" deltaTone="purple" />
        <PfStat icon="clock" tone="yellow" label="Avg internal time-to-fill" value="11d" unit="vs 34d external" delta="−23d faster" deltaTone="green" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {MOBILITY.map((m) => (
          <MatchCard
            key={m.role}
            m={m}
            invited={!!invited[m.role]}
            onInvite={() => invite(m)}
            expanded={!!open[m.role]}
            onToggle={() => setOpen((s) => ({ ...s, [m.role]: !s[m.role] }))}
          />
        ))}
      </div>
      </>)}

      {/* ---------------- PIPELINE & GOVERNANCE — internal-first loop ---------------- */}
      {tab === "pipeline" && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, alignItems: "start" }}>
          {/* Internal-first pipeline */}
          <PfCard>
            <PfCardHead title="Internal-first pipeline" sub="Staff Engineer (Platform) — Engineering · Lagos">
              {released ? <PfBadge tone="blue" dot>External: sourcing</PfBadge> : <PfBadge tone="yellow" dot>External: on hold</PfBadge>}
            </PfCardHead>
            <div style={{ padding: "16px 20px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                {STAGES.map((s, i) => (
                  <Fragment key={s.label}>
                    {i > 0 && <div style={{ flex: 1, height: 2, borderRadius: 2, background: STAGES[i - 1].state === "done" ? "var(--pf-primary-100)" : "var(--pf-n100)", marginTop: 14, minWidth: 10 }} />}
                    <StageNode s={s} />
                  </Fragment>
                ))}
              </div>

              <PipelineCandidate />

              {released ? (
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
                  <Ic name="play" size={14} color="var(--pf-blue-500)" />
                  <div style={{ fontSize: 12, color: "var(--pf-blue-500)", fontWeight: 500, lineHeight: 1.5 }}>
                    Released — Stage 3 external sourcing now runs in parallel. Decision logged to the audit trail.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
                  <Ic name="pause" size={14} color="var(--pf-yellow-500)" />
                  <div style={{ fontSize: 12, color: "var(--pf-yellow-500)", fontWeight: 500, lineHeight: 1.5 }}>
                    External sourcing HOLDS until internal review completes — no agency fees, no external ads yet.
                  </div>
                </div>
              )}

              {released ? (
                <PfBtn full variant="secondary" icon="check" onClick={() => toast("Already released — Stage 3 external sourcing is running")} style={{ marginTop: 10 }}>
                  Released to external ✓
                </PfBtn>
              ) : (
                <PfBtn
                  full variant="secondary" icon="arrowsq" onClick={release}
                  style={{ marginTop: 10, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", color: "var(--pf-yellow-500)" }}
                >
                  Release to external sourcing
                </PfBtn>
              )}
            </div>
          </PfCard>

          {/* Opt-in governance */}
          <PfCard>
            <PfCardHead title="Opt-in governance" sub="Employees control visibility — 60% opted in this quarter">
              <PfTile icon="shield" tone="purple" size={30} />
            </PfCardHead>
            <div style={{ padding: "16px 20px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                <Switch
                  on={optIn}
                  onClick={() => {
                    const next = !optIn;
                    setOptIn(next);
                    toast(next ? "Opt-in ON — profile joins the internal match pool instantly" : "Opt-out — removed from the matcher · browsing history stays private", next ? "success" : "default");
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Visible to internal matching</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>
                    The exact control each employee holds —{" "}
                    <button onClick={() => go("me")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--pf-blue-500)" }}>
                      see it in the Me portal →
                    </button>
                  </div>
                </div>
                <PfBadge tone={optIn ? "green" : "grey"} dot>{optIn ? "Opted in" : "Hidden"}</PfBadge>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: "var(--pf-n500)", fontWeight: 500 }}>214 of 358 opted in</span>
                  <span style={{ color: "var(--pf-primary-500)", fontWeight: 600 }}>60%</span>
                </div>
                <PfProgress pct={60} tone="green" />
              </div>

              <div style={{ borderTop: "1px solid var(--pf-n50)", marginTop: 14, paddingTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  ["check", "Opt-in is granular — employees choose which functions can browse their profile."],
                  ["shield", "Managers cannot see who browsed, matched or declined — only accepted invitations surface."],
                  ["file", "Consent travels with the profile spine — NDPR-aligned, revocable any time."],
                ].map(([icon, text]) => (
                  <div key={icon} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Ic name={icon} size={13} color="var(--pf-n400)" />
                    <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </PfCard>
      </div>
      )}

      {/* ---------------- APPLICATIONS — streamlined internal moves ---------------- */}
      {tab === "applications" && (
        <PfCard>
          <PfCardHead title="Internal applications" sub="Streamlined — no cover letter; the profile spine carries evidence forward">
            <PfBadge tone="blue">3 active</PfBadge>
          </PfCardHead>
          <div style={{ display: "grid", gridTemplateColumns: APP_COLS, gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
            <PfTh>Person</PfTh>
            <PfTh>Move</PfTh>
            <PfTh>Stage</PfTh>
            <PfTh>In stage</PfTh>
            <PfTh />
          </div>
          {APPLICATIONS.map((a, i) => (
            <AppRow key={a.id} a={a} last={i === APPLICATIONS.length - 1} />
          ))}
        </PfCard>
      )}
    </div>
  );
}
