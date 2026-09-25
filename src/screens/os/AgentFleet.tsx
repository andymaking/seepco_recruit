"use client";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { FLEET, type FleetAgent } from "@/data/talentos";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfTile, PfStat, PfTh, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------------------------------------------ */
/* Agent Builder & Fleet Console — FR-048                              */
/* Template gallery → 4-step wizard → launch; fleet stats, pause/      */
/* resume, run log drawer with approve + replay. Human approval        */
/* before outbound is ON by default — the operating principle          */
/* rendered as a checkbox.                                             */
/* ------------------------------------------------------------------ */

type Template = "Auto-sourcer" | "Re-engagement" | "Reference-chaser" | "Interview-prep";

const TEMPLATES: { id: Template; icon: string; tone: PfTone; desc: string; defaultName: string }[] = [
  { id: "Auto-sourcer", icon: "search", tone: "blue", desc: "Scans pools + boards on schedule, ranks by Role-DNA fit, drafts first-touch outreach.", defaultName: "Payments bench scout" },
  { id: "Re-engagement", icon: "swap", tone: "purple", desc: "Wakes silver medalists and dormant pool members with context-aware nudges.", defaultName: "Dormant pool re-engager" },
  { id: "Reference-chaser", icon: "clipboard", tone: "yellow", desc: "Chases referees at Stage 8 until forms come back — polite, persistent, logged.", defaultName: "Stage-8 reference chaser" },
  { id: "Interview-prep", icon: "book", tone: "green", desc: "Sends candidates prep packs + logistics ahead of every Stage-6 loop.", defaultName: "Loop prep sender" },
];

const TPL_TONE: Record<string, PfTone> = {
  "Auto-sourcer": "blue",
  "Re-engagement": "purple",
  "Reference-chaser": "yellow",
  "Interview-prep": "green",
};

const SCHEDULES = ["Nightly", "Hourly", "On-event"] as const;
type Schedule = (typeof SCHEDULES)[number];

const ROLE_CHIPS = ["SPD-2026", "BE-2031", "GRAD-01", "All stage-6 roles", "All stage-8 roles"];

const TRIGGERS = [
  { id: "jd", icon: "file", title: "New JD published", sub: "Wake when a role goes live in intake (FR-010)" },
  { id: "fresh", icon: "pulse", title: "Pool freshness < 60%", sub: "Wake when a linked pool goes stale below threshold" },
  { id: "silver", icon: "star", title: "Stage-7 silver medalist added", sub: "Wake when a runner-up is auto-pooled" },
];

const WIZ_STEPS = [
  { label: "Template", sub: "What the agent does" },
  { label: "Configure", sub: "Name · schedule · roles" },
  { label: "Triggers", sub: "When it wakes up" },
  { label: "Review & launch", sub: "The approval checkbox" },
];

/* ---------------------------- Run log data --------------------------- */

type Outcome = "hit" | "no-match" | "awaiting";
type RunEntry = { id: string; time: string; summary: string; outcome: Outcome };

const RUN_COPY: Record<Template, { awaiting: string; nomatch: string; hits: [string, string, string] }> = {
  "Auto-sourcer": {
    awaiting: "Found 2 matches ≥80 Role-DNA fit — WhatsApp outreach drafted, held for approval",
    nomatch: "Scanned 189 pool profiles · none ≥75 fit threshold — no action taken",
    hits: [
      "Scanned 214 profiles · 1 match at 86 fit → added to shortlist",
      "Cross-matched silver-medal pool · 1 candidate resurfaced at 82 fit",
      "Board sweep · 1 new profile deduped + pooled with consent trail",
    ],
  },
  "Re-engagement": {
    awaiting: "3 dormant members warm again — 2 WhatsApp nudges drafted, held for approval",
    nomatch: "Checked 41 dormant members · no engagement signals — cooling off 14d",
    hits: [
      "Kelechi U. replied “open to chat” → routed to recruiter inbox",
      "2 pool members re-confirmed availability + updated CVs",
      "Boomerang alum clicked role link → flagged interested",
    ],
  },
  "Reference-chaser": {
    awaiting: "Referee silent 5 days — escalation SMS drafted, held for approval",
    nomatch: "1 referee bounced (number changed) — flagged to recruiter, no send",
    hits: [
      "Referee form returned for BE-2031 finalist · identity verified",
      "2nd referee completed after gentle nudge · file complete",
      "Referee scheduled a call slot → calendar hold created",
    ],
  },
  "Interview-prep": {
    awaiting: "Loop moved up 1 day — reschedule notice drafted, held for approval",
    nomatch: "Candidate already fully prepped — duplicate send suppressed",
    hits: [
      "Prep pack sent · candidate confirmed logistics for Stage-6 loop",
      "Panel brief + scorecards delivered to 3 interviewers",
      "Reminder landed · candidate uploaded portfolio ahead of loop",
    ],
  },
};

function makeRuns(agent: FleetAgent, idx: number): RunEntry[] {
  if (agent.runs === 0) return [];
  const copy = RUN_COPY[(agent.template as Template) in RUN_COPY ? (agent.template as Template) : "Auto-sourcer"];
  const base = (idx + 1) * 100;
  return [
    { id: `RUN-${base + 5}`, time: agent.last, summary: copy.awaiting, outcome: "awaiting" },
    { id: `RUN-${base + 4}`, time: "Today 02:04", summary: copy.hits[0], outcome: "hit" },
    { id: `RUN-${base + 3}`, time: "Yesterday 02:03", summary: copy.nomatch, outcome: "no-match" },
    { id: `RUN-${base + 2}`, time: "Mon 02:05", summary: copy.hits[1], outcome: "hit" },
    { id: `RUN-${base + 1}`, time: "Sun 02:02", summary: copy.hits[2], outcome: "hit" },
  ];
}

/* ----------------------------- Micro UI ------------------------------ */

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: 36, height: 20, borderRadius: 999, border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n100)"}`, background: on ? "var(--pf-primary-500)" : "var(--pf-n50)", position: "relative", cursor: "pointer", padding: 0, transition: "background .15s ease", flex: "none" }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(2,6,23,.25)", transition: "left .15s ease" }} />
    </button>
  );
}

function SelChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "5px 11px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
        background: active ? "var(--pf-primary-50)" : "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
        color: active ? "var(--pf-primary-600)" : "var(--pf-n500)",
      }}
    >
      {label}
    </button>
  );
}

function StepChip({ n, label, sub, state, onClick }: { n: number; label: string; sub: string; state: "done" | "current" | "todo"; onClick?: () => void }) {
  const palette: Record<string, CSSProperties> = {
    done: { background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", color: "var(--pf-primary-600)" },
    current: { background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", color: "var(--pf-blue-500)" },
    todo: { background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", color: "var(--pf-n400)" },
  };
  return (
    <div
      onClick={onClick}
      style={{ ...palette[state], borderRadius: 9, padding: "8px 12px", display: "flex", alignItems: "center", gap: 9, flex: "1 1 0", minWidth: 0, cursor: state === "done" ? "pointer" : "default" }}
    >
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-n0)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none", border: "1px solid currentcolor" }}>
        {state === "done" ? <Ic name="check" size={11} weight={2.4} /> : n}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.75, lineHeight: 1.3, whiteSpace: "nowrap" }}>{sub}</span>
      </span>
    </div>
  );
}

function StateBadge({ running }: { running: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, lineHeight: 1.35, padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", color: running ? "var(--pf-primary-600)" : "var(--pf-n500)", background: running ? "var(--pf-primary-50)" : "var(--pf-n50)", border: `0.6px solid ${running ? "var(--pf-primary-100)" : "var(--pf-n100)"}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: running ? "var(--pf-primary-500)" : "var(--pf-n300)", animation: running ? "pulseDot 1.6s ease-in-out infinite" : "none" }} />
      {running ? "Running" : "Paused"}
    </span>
  );
}

function HitBar({ runs, hits }: { runs: number; hits: number }) {
  const rate = runs > 0 ? Math.round((hits / runs) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{hits}</span>
      {runs > 0 ? (
        <>
          <span style={{ width: 46, height: 5, borderRadius: 4, background: "var(--pf-n50)", overflow: "hidden", flex: "none" }}>
            <span style={{ display: "block", height: "100%", width: `${rate}%`, borderRadius: 4, background: "var(--pf-primary-500)" }} />
          </span>
          <span style={{ fontSize: 11, color: "var(--pf-n300)", whiteSpace: "nowrap" }}>{rate}%</span>
        </>
      ) : (
        <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>—</span>
      )}
    </div>
  );
}

/* ------------------------- Template gallery card ---------------------- */

function TplCard({ tpl, selected, onSelect }: { tpl: (typeof TEMPLATES)[number]; selected: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        position: "relative", border: `1.5px solid ${selected ? "var(--pf-primary-500)" : hovered ? "var(--pf-n100)" : "var(--pf-n50)"}`,
        background: selected ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        borderRadius: 10, padding: 12, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, transition: "background .15s ease, border-color .15s ease",
      }}
    >
      {selected && (
        <span style={{ position: "absolute", top: 9, right: 9, width: 18, height: 18, borderRadius: "50%", background: "var(--pf-primary-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Ic name="check" size={10} weight={2.6} />
        </span>
      )}
      <PfTile icon={tpl.icon} tone={tpl.tone} size={30} />
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{tpl.id}</div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.45 }}>{tpl.desc}</div>
    </div>
  );
}

/* ------------------------------ Fleet row ----------------------------- */

const GRID = "minmax(190px,1.5fr) 114px 138px 48px 122px 68px minmax(92px,0.8fr) 158px";

function FleetRow({ a, flash, onToggle, onRuns, onRole }: {
  a: FleetAgent; flash: boolean; onToggle: () => void; onRuns: () => void; onRole: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const running = a.state === "running";
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)",
        background: flash ? "var(--pf-yellow-50)" : hovered ? "var(--pf-n25)" : "transparent", transition: "background .35s ease",
      }}
    >
      {/* agent */}
      <div onClick={onRuns} style={{ minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecorationLine: hovered ? "underline" : "none", textDecorationColor: "var(--pf-n300)", textUnderlineOffset: 3 }}>{a.name}</div>
        <div style={{ marginTop: 4 }}><PfBadge tone={TPL_TONE[a.template] ?? "grey"}>{a.template}</PfBadge></div>
      </div>
      {/* state */}
      <div>
        <StateBadge running={running} />
        <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4, whiteSpace: "nowrap" }}>last {a.last}</div>
      </div>
      {/* approval */}
      <div>
        {a.approval === "Require human approval" ? (
          <PfBadge tone="green"><Ic name="shield" size={11} />Human approval</PfBadge>
        ) : (
          <PfBadge tone="yellow"><Ic name="pulse" size={11} />Auto · logged</PfBadge>
        )}
      </div>
      {/* runs */}
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.runs}</div>
      {/* hits */}
      <HitBar runs={a.runs} hits={a.hits} />
      {/* saved */}
      <div style={{ fontSize: 13, color: "var(--pf-n500)", whiteSpace: "nowrap" }}>{a.saved}</div>
      {/* linked role */}
      <div style={{ minWidth: 0 }}>
        <button
          onClick={onRole}
          title="Open outreach sequences for this role"
          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 6, cursor: "pointer", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", color: "var(--pf-n500)", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {a.linked}
        </button>
      </div>
      {/* actions */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <PfBtn small variant="secondary" icon={running ? "pause" : "play"} onClick={onToggle}>{running ? "Pause" : "Resume"}</PfBtn>
        <PfBtn small variant="ghost" onClick={onRuns}>View runs</PfBtn>
      </div>
    </div>
  );
}

/* ================================ Screen ================================ */

export default function AgentFleet() {
  const go = useGo();
  const toast = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const [fleet, setFleet] = useState<FleetAgent[]>(FLEET);
  const [flash, setFlash] = useState<string | null>(null);

  /* section tab (fleet | builder) */
  const [tab, setTab] = useState("fleet");

  /* wizard state */
  const [step, setStep] = useState(0);
  const [tpl, setTpl] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<Schedule>("Nightly");
  const [roles, setRoles] = useState<string[]>([]);
  const [trig, setTrig] = useState<Record<string, boolean>>({ jd: true, fresh: false, silver: false });
  const [approval, setApproval] = useState(true);

  /* drawer state */
  const [drawer, setDrawer] = useState<string | null>(null);
  const [approved, setApproved] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    const active = fleet.filter((a) => a.state === "running").length;
    const runs = fleet.reduce((s, a) => s + a.runs, 0);
    const hits = fleet.reduce((s, a) => s + a.hits, 0);
    const saved = fleet.reduce((s, a) => s + (parseInt(a.saved.replace(/[^0-9]/g, ""), 10) || 0), 0);
    const paused = fleet.length - active;
    return { active, runs, hits, saved, paused, rate: runs > 0 ? Math.round((hits / runs) * 100) : 0 };
  }, [fleet]);

  const resetWizard = () => {
    setStep(0); setTpl(null); setName(""); setSchedule("Nightly"); setRoles([]);
    setTrig({ jd: true, fresh: false, silver: false }); setApproval(true);
  };

  const pickTpl = (t: Template) => {
    setTpl(t);
    const def = TEMPLATES.find((x) => x.id === t)?.defaultName ?? "";
    setName((n) => (n.trim() === "" || TEMPLATES.some((x) => x.defaultName === n) ? def : n));
  };

  const next = () => {
    if (step === 0 && !tpl) { toast("Pick a template to continue — 4 recruiting patterns available", "default"); return; }
    if (step === 1 && !name.trim()) { toast("Name your agent to continue", "default"); return; }
    setStep((s) => Math.min(s + 1, 3));
  };

  const toggleApproval = () => {
    if (approval) toast("Auto mode enabled — outbound sends without sign-off · every run still logged & replayable", "default");
    setApproval((v) => !v);
  };

  const launch = () => {
    const agent: FleetAgent = {
      name: name.trim(),
      template: tpl ?? "Auto-sourcer",
      state: "running",
      approval: approval ? "Require human approval" : "Auto (logged)",
      runs: 0,
      hits: 0,
      saved: "—",
      last: schedule === "Nightly" ? "first run 02:00" : schedule === "Hourly" ? "first run <1h" : "runs on trigger",
      linked: roles.length ? roles.join(" · ") : "All open roles",
    };
    setFleet((f) => [...f, agent]);
    setTab("fleet");
    resetWizard();
    setFlash(agent.name);
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    window.setTimeout(() => setFlash(null), 1800);
    toast("Agent live — first run scheduled", "success");
  };

  const togglePause = (a: FleetAgent) => {
    const toRunning = a.state === "paused";
    setFleet((f) => f.map((x) => (x.name === a.name ? { ...x, state: toRunning ? "running" : "paused" } : x)));
    if (toRunning) toast(`${a.name} resumed — next run picks up from its last logged step`, "success");
    else toast(`${a.name} paused — mid-flight runs finish safely, nothing new starts`, "default");
  };

  const drawerAgent = drawer ? fleet.find((a) => a.name === drawer) ?? null : null;
  const drawerIdx = drawerAgent ? fleet.findIndex((a) => a.name === drawerAgent.name) : 0;
  const runs = drawerAgent ? makeRuns(drawerAgent, drawerIdx) : [];

  const activeTriggers = TRIGGERS.filter((t) => trig[t.id]);

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ------------------------------- Header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Agent Builder &amp; Fleet Console</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Build recruiting agents from templates, watch the fleet work, pause anything instantly · FR-048
          </div>
        </div>
        <PfBtn icon="file" onClick={() => toast("Full run archive opened — 1,204 logged runs, every one replayable", "default")}>Run archive</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { if (tab === "builder") setTab("fleet"); else { resetWizard(); setTab("builder"); } }}>
          {tab === "builder" ? "Close builder" : "New agent"}
        </PfBtn>
      </div>

      {/* ---------------------------- Section tabs ----------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "fleet", label: "Fleet", count: String(fleet.length) },
            { key: "builder", label: "Builder" },
          ]}
        />
      </div>

      {/* ------------------------------ KPI strip ----------------------------- */}
      {tab === "fleet" && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        <PfStat icon="robot" tone="green" label="Active agents" value={totals.active} unit={`of ${fleet.length} agents`} delta={totals.paused > 0 ? `${totals.paused} paused` : "All running"} deltaTone={totals.paused > 0 ? "yellow" : "green"} />
        <PfStat icon="pulse" tone="blue" label="Runs this week" value={totals.runs} unit="across the fleet" delta="+18% WoW" deltaTone="green" />
        <PfStat icon="target" tone="purple" label="Hits" value={totals.hits} unit="actioned outcomes" delta={`${totals.rate}% hit rate`} deltaTone="green" />
        <PfStat icon="clock" tone="yellow" label="Est. time saved" value={`≈ ${totals.saved}h`} unit="recruiter time" delta="this week" deltaTone="grey" />
      </div>
      )}

      {/* ---------------------------- Builder wizard -------------------------- */}
      {tab === "builder" && (
        <PfCard style={{ marginBottom: 12, animation: "scIn .2s ease" }}>
          <PfCardHead title="New agent" sub="4 steps — nothing sends without the checkbox on the last one">
            <PfBadge tone="blue">Step {step + 1} / 4</PfBadge>
            <PfBtn small variant="ghost" icon="x" onClick={() => { resetWizard(); setTab("fleet"); }}>Cancel</PfBtn>
          </PfCardHead>

          {/* stepper */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
            {WIZ_STEPS.map((s, si) => (
              <div key={s.label} style={{ display: "contents" }}>
                <StepChip n={si + 1} label={s.label} sub={s.sub} state={step > si ? "done" : step === si ? "current" : "todo"} onClick={() => { if (step > si) setStep(si); }} />
                {si < WIZ_STEPS.length - 1 && <Ic name="caretright" size={13} color="var(--pf-n300)" />}
              </div>
            ))}
          </div>

          <div style={{ padding: 20 }}>
            {/* ---- step 1 · template gallery ---- */}
            {step === 0 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                  {TEMPLATES.map((t) => (
                    <TplCard key={t.id} tpl={t} selected={tpl === t.id} onSelect={() => pickTpl(t.id)} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, fontSize: 12, color: "var(--pf-n400)" }}>
                  <Ic name="shield" size={13} color="var(--pf-n400)" />
                  Recruiting work only — no marketing templates (PRD §7).
                </div>
              </>
            )}

            {/* ---- step 2 · configure ---- */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)", marginBottom: 6 }}>Agent name</div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Payments bench scout"
                    style={{ fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 11px", width: "100%", outline: "none" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)", marginBottom: 6 }}>Schedule</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {SCHEDULES.map((s) => (
                      <SelChip key={s} label={s} active={schedule === s} onClick={() => setSchedule(s)} />
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)", marginBottom: 6 }}>Linked roles</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {ROLE_CHIPS.map((r) => (
                      <SelChip key={r} label={r} active={roles.includes(r)} onClick={() => setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 6 }}>None selected = the agent watches all open roles.</div>
                </div>
              </div>
            )}

            {/* ---- step 3 · triggers ---- */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 620 }}>
                {TRIGGERS.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "11px 14px", background: trig[t.id] ? "var(--pf-primary-50)" : "var(--pf-n0)", transition: "background .15s ease" }}>
                    <PfTile icon={t.icon} tone={trig[t.id] ? "green" : "grey"} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{t.title}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{t.sub}</div>
                    </div>
                    <Switch on={!!trig[t.id]} onClick={() => setTrig((cur) => ({ ...cur, [t.id]: !cur[t.id] }))} />
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>
                  <Ic name="info" size={13} />
                  Triggers stack with the {schedule.toLowerCase()} schedule — whichever fires first wakes the agent.
                </div>
              </div>
            )}

            {/* ---- step 4 · review + THE checkbox ---- */}
            {step === 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
                {/* summary */}
                <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 9 }}>Summary</div>
                  {[
                    ["Template", tpl ?? "—"],
                    ["Name", name.trim() || "—"],
                    ["Schedule", schedule],
                    ["Linked roles", roles.length ? roles.join(" · ") : "All open roles"],
                    ["Triggers", activeTriggers.length ? activeTriggers.map((t) => t.title).join(" · ") : "Schedule only"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "5px 0", borderBottom: "1px dashed var(--pf-n100)" }}>
                      <span style={{ color: "var(--pf-n400)", flex: "none" }}>{k}</span>
                      <span style={{ color: "var(--pf-n900)", fontWeight: 500, textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 11.5, color: "var(--pf-n400)" }}>
                    <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
                    Runs as a LangGraph graph — every step stored, every run replayable.
                  </div>
                </div>

                {/* the operating principle, rendered as a checkbox */}
                <div style={{ border: `1.5px solid ${approval ? "var(--pf-primary-500)" : "var(--pf-yellow-500)"}`, background: approval ? "var(--pf-primary-50)" : "var(--pf-yellow-50)", borderRadius: 10, padding: 14, transition: "border-color .15s ease, background .15s ease" }}>
                  <div onClick={toggleApproval} style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: "pointer" }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, flex: "none", marginTop: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", background: approval ? "var(--pf-primary-500)" : "var(--pf-n0)", border: `1.5px solid ${approval ? "var(--pf-primary-500)" : "var(--pf-n300)"}`, color: "#fff", boxShadow: approval ? "0 4px 8px -3px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.25)" : "none", transition: "background .15s ease" }}>
                      {approval && <Ic name="check" size={12} weight={2.8} />}
                    </span>
                    <span>
                      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: approval ? "var(--pf-primary-600)" : "var(--pf-n900)" }}>
                        Require human approval before outbound
                      </span>
                      <span style={{ display: "block", fontSize: 12, color: approval ? "var(--pf-primary-600)" : "var(--pf-n500)", opacity: 0.85, marginTop: 3, lineHeight: 1.5 }}>
                        The operating principle, rendered as a checkbox — the agent drafts, a human sends. On by default.
                      </span>
                    </span>
                  </div>
                  {!approval && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 11, background: "var(--pf-n0)", border: "1px solid var(--pf-yellow-100)", borderRadius: 8, padding: "8px 11px", animation: "scIn .18s ease" }}>
                      <Ic name="warning" size={14} color="var(--pf-yellow-500)" />
                      <span style={{ fontSize: 12, color: "var(--pf-yellow-500)", fontWeight: 500, lineHeight: 1.5 }}>
                        Auto mode — outbound sends without sign-off. Every run is still logged &amp; replayable.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---- wizard footer ---- */}
            <div style={{ display: "flex", gap: 8, marginTop: 18, alignItems: "center" }}>
              {step > 0 && <PfBtn variant="secondary" onClick={() => setStep((s) => Math.max(s - 1, 0))}>Back</PfBtn>}
              <span style={{ flex: 1 }} />
              {step < 3 ? (
                <PfBtn variant="primary" icon="arrowright" onClick={next} style={(step === 0 && !tpl) || (step === 1 && !name.trim()) ? { opacity: 0.55 } : undefined}>
                  Continue
                </PfBtn>
              ) : (
                <PfBtn variant="primary" icon="robot" onClick={launch}>Launch agent</PfBtn>
              )}
            </div>
          </div>
        </PfCard>
      )}

      {/* ------------------------------ Fleet table ---------------------------- */}
      {tab === "fleet" && (
      <div ref={tableRef} style={{ scrollMarginTop: 16 }}>
        <PfCard style={{ overflow: "hidden" }}>
          <PfCardHead title="Fleet" sub="Pause takes effect instantly — mid-flight runs finish safely · every run logged">
            <PfBadge tone="grey">{fleet.length} agents</PfBadge>
          </PfCardHead>

          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTh>Agent</PfTh>
            <PfTh>State</PfTh>
            <PfTh>Approval mode</PfTh>
            <PfTh>Runs</PfTh>
            <PfTh>Hits · rate</PfTh>
            <PfTh>Saved</PfTh>
            <PfTh>Linked role</PfTh>
            <PfTh style={{ textAlign: "right" }}>Actions</PfTh>
          </div>

          {fleet.map((a) => (
            <FleetRow
              key={a.name}
              a={a}
              flash={flash === a.name}
              onToggle={() => togglePause(a)}
              onRuns={() => setDrawer(a.name)}
              onRole={() => go("sequences")}
            />
          ))}

          <div style={{ padding: "11px 20px", fontSize: 12, color: "var(--pf-n300)", display: "flex", alignItems: "center", gap: 6 }}>
            <Ic name="shield" size={13} />
            Agents draft and chase — recruiters decide. Outbound with approval on waits in the run log for a human.
          </div>
        </PfCard>
      </div>
      )}

      {/* -------------------------------- Footer ------------------------------- */}
      <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12, color: "var(--pf-n300)" }}>
        <Ic name="robot" size={13} />
        Agents run on the LangGraph orchestration layer · every run logged &amp; replayable (v1.1 principle).
      </div>

      {/* ------------------------------ Run log drawer -------------------------- */}
      {drawerAgent && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={() => setDrawer(null)} style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,.32)" }} />
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 440, maxWidth: "92vw", background: "var(--pf-n0)", borderLeft: "1px solid var(--pf-n100)", boxShadow: "-16px 0 44px rgba(2,6,23,.14)", overflowY: "auto", padding: 22, animation: "scIn .18s ease" }}>
            {/* head */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <PfTile icon="robot" tone={TPL_TONE[drawerAgent.template] ?? "grey"} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{drawerAgent.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{drawerAgent.template} · {drawerAgent.linked}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 8, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--pf-n500)" }}>
                <Ic name="x" size={15} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <StateBadge running={drawerAgent.state === "running"} />
              {drawerAgent.approval === "Require human approval"
                ? <PfBadge tone="green"><Ic name="shield" size={11} />Human approval before outbound</PfBadge>
                : <PfBadge tone="yellow"><Ic name="pulse" size={11} />Auto · logged</PfBadge>}
            </div>

            {/* stats strip */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
              {[
                ["Runs", String(drawerAgent.runs)],
                ["Hits", drawerAgent.runs > 0 ? `${drawerAgent.hits} · ${Math.round((drawerAgent.hits / drawerAgent.runs) * 100)}%` : "—"],
                ["Time saved", drawerAgent.saved],
              ].map(([k, v], i) => (
                <div key={k} style={{ padding: "10px 12px", borderLeft: i > 0 ? "1px solid var(--pf-n50)" : "none", background: "var(--pf-n25)" }}>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{k}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--pf-n900)", marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 9 }}>
              Run log {runs.length > 0 ? `— last ${runs.length} of ${drawerAgent.runs}` : ""}
            </div>

            {runs.length === 0 && (
              <div style={{ background: "var(--pf-n25)", borderRadius: 8, padding: "18px 12px", textAlign: "center", fontSize: 13, color: "var(--pf-n300)", marginBottom: 14 }}>
                No runs yet — {drawerAgent.last === "runs on trigger" ? "waiting on its first trigger." : `${drawerAgent.last} is on the schedule.`}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {runs.map((r) => {
                const isApproved = r.outcome === "awaiting" && approved[drawerAgent.name];
                return (
                  <div key={r.id} style={{ border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "10px 12px", background: r.outcome === "awaiting" && !isApproved ? "var(--pf-yellow-50)" : "var(--pf-n0)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)" }}>{r.id}</span>
                      <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{r.time}</span>
                      <span style={{ flex: 1 }} />
                      {r.outcome === "hit" && <PfBadge tone="green" dot>Hit</PfBadge>}
                      {r.outcome === "no-match" && <PfBadge tone="grey">No match</PfBadge>}
                      {r.outcome === "awaiting" && (isApproved ? <PfBadge tone="green" dot>Approved · queued</PfBadge> : <PfBadge tone="yellow" dot>Awaiting approval</PfBadge>)}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{r.summary}</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {r.outcome === "awaiting" && !isApproved && (
                        <PfBtn small variant="primary" icon="check" onClick={() => { setApproved((m) => ({ ...m, [drawerAgent.name]: true })); toast("Approved — 2 WhatsApp messages queued", "success"); }}>
                          Approve outbound
                        </PfBtn>
                      )}
                      <PfBtn small variant="ghost" icon="play" onClick={() => toast("Run replayed step-by-step — LangGraph trace opened", "ai")}>Replay</PfBtn>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "9px 12px", marginBottom: 14 }}>
              <Ic name="sparkle" size={14} color="var(--pf-purple-500)" />
              <span style={{ fontSize: 12, color: "var(--pf-purple-500)", lineHeight: 1.5 }}>
                Every run is a LangGraph trace — inputs, tool calls and outputs stored, NDPR-scoped, replayable step-by-step.
              </span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <PfBtn variant={drawerAgent.state === "running" ? "secondary" : "primary"} icon={drawerAgent.state === "running" ? "pause" : "play"} onClick={() => togglePause(drawerAgent)}>
                {drawerAgent.state === "running" ? "Pause agent" : "Resume agent"}
              </PfBtn>
              <PfBtn icon="arrowsq" onClick={() => toast("LangGraph console opened — full trace explorer for this agent", "ai")}>Open trace console</PfBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
