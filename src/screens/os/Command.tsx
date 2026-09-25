"use client";
import { useState, type ReactNode } from "react";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfStat, PfSegments, PfAvatar,
  PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { COMMAND_KPIS, ANOMALIES, DEPARTMENTS, type Anomaly, type Department } from "@/data/talentos";

/* ------------------------------ Local view data ------------------------------ */

type Period = "30d" | "Quarter" | "YTD";
const PERIODS: Period[] = ["30d", "Quarter", "YTD"];

/** Per-KPI presentation (icon/tone) + short unit line, zipped with COMMAND_KPIS. */
const KPI_META: { icon: string; tone: PfTone; unit: string }[] = [
  { icon: "users", tone: "green", unit: "8 joined this month" },
  { icon: "target", tone: "blue", unit: "3 in final stages" },
  { icon: "pulse", tone: "purple", unit: "benchmark 1.6%" },
  { icon: "wallet", tone: "yellow", unit: "vs ₦392M" },
];

/** Period selector re-frames the movement columns (values are point-in-time). */
const PERIOD_DELTAS: Record<Period, [string, string, string, string]> = {
  "30d": ["+12", "4 critical", "+0.4pp", "+5% over"],
  Quarter: ["+31", "4 critical", "+0.7pp", "+5% over"],
  YTD: ["+64", "4 critical", "+0.9pp", "+5% over"],
};

const DELTA_TONE: Record<string, PfTone> = { "#16B364": "green", "#E81E17": "red", "#EBA308": "yellow" };

const SEV: Record<Anomaly["severity"], { label: string; tone: PfTone }> = {
  critical: { label: "Critical", tone: "red" },
  warning: { label: "Warning", tone: "yellow" },
  info: { label: "Info", tone: "grey" },
};

const STATUS_META: Record<Anomaly["status"], { label: string; tone: PfTone }> = {
  new: { label: "New", tone: "blue" },
  acknowledged: { label: "Acknowledged", tone: "grey" },
  assigned: { label: "Assigned", tone: "purple" },
};

/** Suggested owner per anomaly (dept heads / HR lead from DEPARTMENTS). */
const OWNER: Record<string, string> = {
  "AN-104": "Ibrahim Sani", "AN-103": "Ngozi Adeyemi", "AN-102": "Funke Adebayo", "AN-101": "Emeka Obi",
};

/** PRD principle: every AI claim carries evidence + confidence. */
const EVIDENCE: Record<string, { ev: string; conf: "High" | "Medium" }> = {
  "AN-104": { ev: "6 structured exit interviews · payroll benchmark set", conf: "High" },
  "AN-103": { ev: "118 pulse responses · absence records", conf: "Medium" },
  "AN-102": { ev: "2 payroll cycles · agency PO ledger", conf: "High" },
  "AN-101": { ev: "Rotation roster · absence log (Aug '25 pattern match)", conf: "Medium" },
};

/** Data drill ids not in the stage registry → nearest OS screen. */
const DRILL_FIX: Record<string, string> = { workforceplan: "headcount" };

/** 12 open positions by funnel stage — 4 critical (matches COMMAND_KPIS). */
const FUNNEL: { stage: string; n: number; crit: number }[] = [
  { stage: "Sourcing", n: 5, crit: 2 },
  { stage: "Screening", n: 2, crit: 0 },
  { stage: "Interviewing", n: 2, crit: 1 },
  { stage: "Offer", n: 3, crit: 1 },
];

const REQS: { role: string; meta: string; stage: string; tone: PfTone; note: string }[] = [
  { role: "Staff Engineer (Platform)", meta: "Engineering · Lagos", stage: "Approval", tone: "yellow", note: "2 of 3 approvers signed · day 3 of 5-day SLA" },
  { role: "Field Ops rotation cover (×2)", meta: "Field Operations · Port Harcourt · critical", stage: "AI draft", tone: "purple", note: "JD + pay band drafted from market data" },
  { role: "Finance Analyst backfill", meta: "Finance · Lagos", stage: "Posted", tone: "green", note: "Live on 4 channels · 11 applicants" },
];

const ASK_QS = ["Why is Port Harcourt turnover rising?", "Which departments are over cost budget?"];

const FILTERS: ("all" | Anomaly["severity"])[] = ["all", "critical", "warning", "info"];

/* --------------------------------- Bits ---------------------------------- */

function Chip({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", padding: "2px 8px", borderRadius: 6, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function AnomalyRow({ a, onAck, onAssign, onNudge, onDrill, last }: {
  a: Anomaly; onAck: () => void; onAssign: () => void; onNudge: () => void; onDrill: () => void; last: boolean;
}) {
  const sev = SEV[a.severity];
  const st = STATUS_META[a.status];
  const ev = EVIDENCE[a.id] ?? { ev: "HRIS + payroll feeds", conf: "Medium" as const };
  const dim = a.status === "acknowledged";
  return (
    <div style={{ padding: "14px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", opacity: dim ? 0.55 : 1, transition: "opacity .25s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: TONE[sev.tone].soft, color: TONE[sev.tone].fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, flex: "none" }}>{a.icon}</span>
        <PfBadge tone={sev.tone} dot>{sev.label}</PfBadge>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n400)", flex: "none" }}>
          <Ic name="clock" size={13} color="var(--pf-n300)" />{a.detected}
        </span>
        <PfBadge tone={st.tone}>{st.label}</PfBadge>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55, margin: "7px 0 9px", paddingLeft: 36 }}>{a.body}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 36, flexWrap: "wrap" }}>
        <Chip><Ic name="trend" size={12} color="var(--pf-n400)" />{a.metric}</Chip>
        <PfBadge tone={ev.conf === "High" ? "green" : "yellow"}>Confidence: {ev.conf}</PfBadge>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Evidence: {ev.ev}</span>
        <span style={{ flex: 1 }} />
        {a.status === "new" && <PfBtn small onClick={onAck} icon="check">Acknowledge</PfBtn>}
        {!a.assignee && <PfBtn small onClick={onAssign} icon="user">Assign</PfBtn>}
        {a.assignee && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <PfAvatar init={a.assignee.split(" ").map((w) => w[0]).join("")} size={20} tone="#AF52DE" />
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n600)" }}>{a.assignee}</span>
            <PfBtn small variant="ghost" onClick={onNudge}>Nudge</PfBtn>
          </span>
        )}
        <PfBtn small variant="ghost" onClick={onDrill} style={{ color: "var(--pf-primary-600)" }}>
          Drill through <Ic name="arrowright" size={13} />
        </PfBtn>
      </div>
    </div>
  );
}

const DEPT_GRID = "1.5fr .8fr .6fr .7fr 1.05fr .8fr";

function DeptRow({ d, onClick, last }: { d: Department; onClick: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  const status: { label: string; tone: PfTone } =
    d.health >= 78 ? { label: "Healthy", tone: "green" } : d.health >= 65 ? { label: "Watch", tone: "yellow" } : { label: "At risk", tone: "red" };
  const hcColor = d.headcount > d.target ? "#B87F06" : d.headcount < d.target ? "var(--pf-blue-500)" : "var(--pf-n900)";
  const tv = parseFloat(d.turnover);
  const tvColor = tv >= 2.5 ? "var(--pf-red-500)" : tv > 1.6 ? "#B87F06" : "var(--pf-n600)";
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "grid", gridTemplateColumns: DEPT_GRID, gap: 10, alignItems: "center", padding: "11px 20px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.head} · {d.loc}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>
        <span style={{ color: hcColor }}>{d.headcount}</span>
        <span style={{ color: "var(--pf-n300)", fontWeight: 500 }}>/{d.target}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--pf-n600)" }}>{d.cost}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: tvColor }}>{d.turnover}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PfSegments score={d.health / 20} tone={status.tone} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)" }}>{d.health}</span>
      </div>
      <div><PfBadge tone={status.tone} dot>{status.label}</PfBadge></div>
    </div>
  );
}

function ReqRow({ r, onClick, last }: { r: (typeof REQS)[number]; onClick: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.role}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{r.meta}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 3 }}>{r.note}</div>
      </div>
      <PfBadge tone={r.tone} dot>{r.stage}</PfBadge>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </div>
  );
}

function AskChip({ q, onClick }: { q: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 11px", borderRadius: 9, background: "var(--pf-n0)", border: `1px solid ${hovered ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: hovered ? "var(--pf-n900)" : "var(--pf-n500)" }}>
      <Ic name="sparkle" size={13} color="var(--pf-primary-500)" />
      <span style={{ flex: 1 }}>{q}</span>
      <Ic name="arrowright" size={13} color={hovered ? "var(--pf-primary-600)" : "var(--pf-n300)"} />
    </div>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function Command() {
  const go = useGo();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>("30d");
  const [rows, setRows] = useState<Anomaly[]>(() => ANOMALIES.map((a) => ({ ...a })));
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [tab, setTab] = useState("overview");

  const deltas = PERIOD_DELTAS[period];
  const newCount = rows.filter((a) => a.status === "new").length;
  const critNew = rows.filter((a) => a.severity === "critical" && a.status === "new").length;
  const visible = filter === "all" ? rows : rows.filter((a) => a.severity === filter);
  const funnelMax = Math.max(...FUNNEL.map((f) => f.n));

  const attention = [
    critNew > 0 ? `${critNew} critical anomal${critNew > 1 ? "ies" : "y"}` : null,
    "1 contract expiring in 28 days",
    "4 critical roles open",
  ].filter((x): x is string => x !== null);

  const requestHiring = () => {
    toast("AI-drafted requisition opened in Stage 1", "ai");
    go("planning");
  };

  const ack = (id: string) => {
    const a = rows.find((r) => r.id === id);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: "acknowledged" } : r)));
    toast(`${id} acknowledged — ${a?.title ?? "anomaly"} marked as reviewed`, "success");
  };

  const assign = (id: string) => {
    const owner = OWNER[id] ?? "Funke Adebayo";
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status: "assigned", assignee: owner } : r)));
    toast(`${id} assigned to ${owner} — 48h SLA to respond`);
  };

  const nudge = (a: Anomaly) => toast(`Reminder sent to ${a.assignee ?? "owner"} about ${a.id}`, "success");
  const drill = (a: Anomaly) => go(DRILL_FIX[a.drill] ?? a.drill);
  const cycleFilter = () => setFilter((f) => FILTERS[(FILTERS.indexOf(f) + 1) % FILTERS.length] ?? "all");

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Greeting + period + primary action */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Good morning, Samuel</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Wednesday, 8 July 2026 — here&apos;s where your workforce stands.</div>
        </div>
        <PfTabs tabs={PERIODS} active={period} onChange={(t) => setPeriod(t as Period)} />
        <PfBtn variant="primary" icon="sparkle" onClick={requestHiring}>Request hiring</PfBtn>
      </div>

      {/* Attention strip — reacts to anomaly triage below */}
      <div style={{ marginTop: 16 }}>
        <PfBanner cta="open" onCta={() => go("missioncontrol")}>
          <b style={{ fontWeight: 600 }}>{attention.length} items need your attention</b>
          <span style={{ fontWeight: 400 }}> — {attention.join(", ")}.</span>
        </PfBanner>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "anomalies", label: "Anomaly feed", count: String(newCount) },
            { key: "departments", label: "Departments", count: String(DEPARTMENTS.length) },
            { key: "funnel", label: "Hiring funnel", count: "12" },
          ]}
        />
      </div>

      {/* OVERVIEW — KPIs + Ask anything */}
      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            {COMMAND_KPIS.map((k, i) => {
              const m = KPI_META[i] ?? KPI_META[0]!;
              return (
                <PfStat
                  key={k.label}
                  icon={m.icon}
                  tone={m.tone}
                  label={k.label}
                  value={k.value}
                  unit={m.unit}
                  delta={deltas[i] ?? k.delta}
                  deltaTone={DELTA_TONE[k.deltaColor] ?? "grey"}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5, color: "var(--pf-n400)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pf-primary-500)", flex: "none" }} />
            Synced from SeamlessHR · 12m ago · payroll &amp; pulse feeds healthy
          </div>
          <div style={{ maxWidth: 430, marginTop: 12 }}>
            <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
              <div style={{ padding: "16px 16px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Ic name="sparkle" size={16} color="var(--pf-primary-600)" />
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>Ask anything</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 5, padding: "1px 6px" }}>⌘K</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5, margin: "6px 0 11px" }}>
                  Plain-language answers over your live workforce data — every answer cites its evidence.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {ASK_QS.map((q) => <AskChip key={q} q={q} onClick={() => go("ask")} />)}
                </div>
              </div>
            </PfCard>
          </div>
        </>
      )}

      {/* ANOMALY FEED */}
      {tab === "anomalies" && (
          <PfCard>
            <PfCardHead title="AI anomaly feed" sub="Why the numbers moved — plain language, with evidence. AI proposes, you decide.">
              {newCount > 0 && <PfBadge tone="blue" dot>{newCount} new</PfBadge>}
              <PfBtn small icon="filter" onClick={cycleFilter}>
                {filter === "all" ? "All severities" : SEV[filter].label}
              </PfBtn>
            </PfCardHead>
            {visible.length === 0 ? (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
                No {filter !== "all" ? `${filter} ` : ""}anomalies right now — baselines look steady.
              </div>
            ) : (
              visible.map((a, i) => (
                <AnomalyRow
                  key={a.id}
                  a={a}
                  last={i === visible.length - 1}
                  onAck={() => ack(a.id)}
                  onAssign={() => assign(a.id)}
                  onNudge={() => nudge(a)}
                  onDrill={() => drill(a)}
                />
              ))
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
              <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
              Detected against a 90-day seasonal baseline · flags beyond 2σ ·
              <span
                onClick={() => toast("Anomaly model card v1.3 — 90-day baseline, seasonally adjusted, NDPR-scoped features only", "ai")}
                style={{ color: "var(--pf-primary-600)", fontWeight: 600, cursor: "pointer" }}
              >
                View methodology
              </span>
            </div>
          </PfCard>
      )}

      {/* DEPARTMENTS */}
      {tab === "departments" && (
          <PfCard>
            <PfCardHead title="Department snapshot" sub="Headcount vs plan, cost and health — click a row to open Department health.">
              <PfBtn small onClick={() => go("depthealth")}>
                All departments <Ic name="caretright" size={12} />
              </PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: DEPT_GRID, gap: 10, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Department</PfTh>
              <PfTh>Headcount</PfTh>
              <PfTh>Cost / mo</PfTh>
              <PfTh>Turnover</PfTh>
              <PfTh>Health</PfTh>
              <PfTh>Status</PfTh>
            </div>
            {DEPARTMENTS.map((d, i) => (
              <DeptRow key={d.name} d={d} last={i === DEPARTMENTS.length - 1} onClick={() => go("depthealth")} />
            ))}
          </PfCard>
      )}

      {/* HIRING FUNNEL — funnel + requisition loop */}
      {tab === "funnel" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
          <PfCard>
            <PfCardHead title="Hiring funnel" sub="12 open positions · 4 critical">
              <PfBadge tone="red" dot>4 critical</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {FUNNEL.map((f) => (
                <div key={f.stage}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", flex: 1 }}>{f.stage}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{f.n} open</span>
                    {f.crit > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-red-500)" }}>· {f.crit} critical</span>}
                  </div>
                  <div style={{ height: 8, borderRadius: 8, background: "var(--pf-n50)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(f.n / funnelMax) * 100}%`, display: "flex", borderRadius: 8, overflow: "hidden" }}>
                      <span style={{ width: `${((f.n - f.crit) / f.n) * 100}%`, background: "var(--pf-primary-500)" }} />
                      <span style={{ width: `${(f.crit / f.n) * 100}%`, background: "var(--pf-red-500)" }} />
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                <Ic name="clock" size={13} color="var(--pf-n300)" />
                Requisition SLA: gap → approved opening in ≤ 5 business days
              </div>
              <PfBtn full icon="sparkle" onClick={requestHiring}>Request hiring</PfBtn>
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead title="Requisition loop" sub="Gap → AI draft → approval → posted">
              <PfBadge tone="green" dot>3 in flight</PfBadge>
            </PfCardHead>
            {REQS.map((r, i) => (
              <ReqRow key={r.role} r={r} last={i === REQS.length - 1} onClick={() => go("planning")} />
            ))}
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--pf-n50)" }}>
              <PfBtn full small variant="ghost" onClick={() => go("planning")} style={{ color: "var(--pf-primary-600)" }}>
                Open Stage 1 workspace <Ic name="arrowright" size={13} />
              </PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
