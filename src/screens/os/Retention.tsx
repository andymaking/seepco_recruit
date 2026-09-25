"use client";
import { useState } from "react";
import { PfCard, PfBadge, PfBtn, PfPageTabs, PfTile, PfStat, PfProgress, PfAvatar, PfTh, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { PLAYBOOKS, MOBILITY, type Playbook } from "@/data/talentos";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

/* ------------------------------------------------------------------ */
/* Retention Playbooks — FR-072: acknowledging a risk flag opens a    */
/* guided playbook (pay check · growth conversation · mobility scan · */
/* workload review). Save rate per playbook feeds the risk model —    */
/* the loop closes. No automated actions (FR-056/077).                */
/* ------------------------------------------------------------------ */

type StepState = "done" | "active" | "todo";

const PAY: Record<string, { band: string; median: string; current: string; gap: string; below: boolean; src: string; ask?: string }> = {
  "PB-31": { band: "L5 band median", median: "₦24.5M", current: "₦21.6M", gap: "−12%", below: true, src: "Lagos tech market · Jun 2026 · n=142 datapoints", ask: "₦2.9M/yr" },
  "PB-29": { band: "M2 band median", median: "₦18.2M", current: "₦18.4M", gap: "+1%", below: false, src: "PH energy market · Jun 2026 · n=87 datapoints" },
};

const TALKING: Record<string, string[]> = {
  "PB-31": [
    "Name the timeline: 14 months since promotion — put the Staff Engineer step on a date (growth plan target: Q1 2027).",
    "Walk the 2 open growth-plan milestones: payments-platform tech-lead rotation · mentoring circle for 2 mid-level engineers.",
    "Ask what makes the next 6 months compelling — last 1-on-1 flagged timeline clarity over title.",
  ],
  "PB-29": [
    "Acknowledge 22 months since promotion and 4y 1m on site — put the M3 site-manager track on the table (growth plan: leadership step).",
    "Growth-plan blocker: NEBOSH IGC renewal (Sep 2026) — offer sponsored renewal plus a study rotation.",
    "Probe rotation fatigue directly — his crew's exits cite rotation; ask what a sustainable pattern looks like.",
  ],
};

const STEP_CTX: Record<string, string> = {
  "Workload review": "Payments crunch: 2 on-call rotations in 4 weeks — compare Amara's load vs the squad median before the conversation.",
  "Rotation-pattern review": "Rotation is the top PH exit driver (5 of 6 exits cite it) — 2-on/1-off proposal drafted with the site director.",
  "Retention bonus assessment": "Guardrail: retention bonuses need CFO sign-off and are audit-logged — the system never pays out automatically (FR-077).",
};

const OUTCOME_BARS: { type: string; pct: number; n: string; tone: PfTone }[] = [
  { type: "Growth-led", pct: 61, n: "14/23", tone: "green" },
  { type: "Pay-led", pct: 52, n: "11/21", tone: "blue" },
  { type: "Workload-led", pct: 31, n: "5/16", tone: "yellow" },
];

type SaveRow = { name: string; init: string; tone: string; type: string; when: string; risk: string; fresh?: boolean };

const RECENT_SAVES: SaveRow[] = [
  { name: "Ngozi Obi", init: "NO", tone: "#16B364", type: "Growth-led", when: "12 May", risk: "68 → 24" },
  { name: "Halima Sule", init: "HS", tone: "#AF52DE", type: "Pay-led", when: "28 Apr", risk: "74 → 31" },
];

const RISK_FROM: Record<string, number> = { "PB-31": 78, "PB-29": 71 };

function kindOf(step: string): "pay" | "growth" | "mobility" | "generic" {
  const t = step.toLowerCase();
  if (t.includes("pay check")) return "pay";
  if (t.includes("growth conversation")) return "growth";
  if (t.includes("mobility")) return "mobility";
  return "generic";
}

/* ------------------------------ atoms ------------------------------ */

function StateDot({ st }: { st: StepState }) {
  if (st === "done")
    return (
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "inset 0 1.5px 1.5px rgba(255,255,255,.15), inset 0 -1.5px 1.5px rgba(0,0,0,.1)" }}>
        <Ic name="check" size={11} color="#fff" weight={2.8} />
      </span>
    );
  if (st === "active")
    return (
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-n0)", border: "2px solid var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "pfStepPulse 1.7s ease-out infinite" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pf-primary-500)" }} />
      </span>
    );
  return <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-n0)", border: "1.6px solid var(--pf-n300)", flex: "none" }} />;
}

function OddsRing({ pct, saved }: { pct: number; saved: boolean }) {
  const c = saved || pct >= 65 ? "var(--pf-primary-500)" : "var(--pf-yellow-500)";
  return (
    <span style={{ width: 54, height: 54, borderRadius: "50%", background: `conic-gradient(${c} ${saved ? 100 : pct}%, var(--pf-n50) 0)`, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <span style={{ width: 41, height: 41, borderRadius: "50%", background: "var(--pf-n0)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>
        {saved ? <Ic name="check" size={17} color="var(--pf-primary-500)" weight={2.6} /> : `${pct}%`}
      </span>
    </span>
  );
}

/* ---------------------------- step item ---------------------------- */

function StepItem({ p, name, note, st, isLast, expanded, onToggle, onStart, onComplete }: {
  p: Playbook; name: string; note?: string; st: StepState; isLast: boolean;
  expanded: boolean; onToggle: () => void; onStart: () => void; onComplete: (silent?: boolean) => void;
}) {
  const go = useGo();
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const [tplOpen, setTplOpen] = useState(false);
  const [drafted, setDrafted] = useState(false);

  const kind = kindOf(name);
  const first = p.for.split(" ")[0];
  const pay = PAY[p.id];
  const match = MOBILITY.find((m) => m.candidate === p.for);

  const draftCase = () => {
    setDrafted(true);
    toast(`✦ Adjustment case drafted for ${first} — ${pay?.ask} to ${pay?.band} vs ₦38M backfill · routed to CFO, no automated change`, "ai");
  };
  const rerun = () => toast(`Benchmark re-run for ${first} — ${pay?.band} ${pay?.median}, ${first} is within band · check logged to the audit trail`);
  const schedule = () => {
    if (st !== "done") onComplete(true);
    toast(`Growth conversation scheduled into ${first}'s next 1-on-1 — template + talking points attached`, "success");
    go("oneonones");
  };

  const stateActions =
    st === "todo" ? (
      <PfBtn small variant="secondary" icon="play" onClick={onStart}>Start step</PfBtn>
    ) : st === "active" ? (
      <PfBtn small variant={kind === "generic" ? "primary" : "secondary"} icon="check" onClick={() => onComplete()}>Mark complete</PfBtn>
    ) : null;

  const panel: React.CSSProperties = { background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: 12 };

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flex: "none" }}>
        <StateDot st={st} />
        {!isLast && <div style={{ width: 2, flex: 1, minHeight: 12, background: st === "done" ? "var(--pf-primary-100)" : "var(--pf-n100)", margin: "4px 0", borderRadius: 2 }} />}
      </div>

      {/* content */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 13 }}>
        <div {...hoverProps} onClick={onToggle} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderRadius: 8, margin: "-3px -6px", padding: "3px 6px", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: st === "todo" ? "var(--pf-n500)" : "var(--pf-n900)" }}>{name}</span>
              {st === "done" && <PfBadge tone="green">Done</PfBadge>}
              {st === "active" && <PfBadge tone="green" dot>In progress</PfBadge>}
              {st === "todo" && <PfBadge tone="grey">To do</PfBadge>}
              {kind === "mobility" && match && <PfBadge tone="blue">{match.match}% match found</PfBadge>}
            </div>
            {note && <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>{note}</div>}
          </div>
          <span style={{ display: "inline-flex", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
            <Ic name="caretdown" size={13} color="var(--pf-n300)" />
          </span>
        </div>

        {expanded && (
          <div style={{ marginTop: 9 }}>
            {/* -------- Pay check vs benchmark -------- */}
            {kind === "pay" && pay && (
              <div style={panel}>
                <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.1fr", gap: 8, background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)", padding: "7px 12px" }}>
                    <PfTh>{pay.band.toUpperCase()}</PfTh><PfTh>CURRENT</PfTh><PfTh>GAP</PfTh>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.1fr", gap: 8, alignItems: "center", padding: "9px 12px" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", letterSpacing: "-.12px" }}>{pay.median}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", letterSpacing: "-.12px" }}>{pay.current}</span>
                    <span><PfBadge tone={pay.below ? "red" : "green"}>{pay.gap} {pay.below ? "below band" : "within band"}</PfBadge></span>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 7 }}>Benchmark: {pay.src} — evidence shown with every model claim</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {pay.below ? (
                    drafted ? (
                      <PfBadge tone="purple">✦ Case drafted — pending CFO approval</PfBadge>
                    ) : (
                      <PfBtn small variant="primary" icon="sparkle" onClick={draftCase}>Draft adjustment case</PfBtn>
                    )
                  ) : (
                    <PfBtn small variant="secondary" icon="target" onClick={rerun}>Re-run benchmark</PfBtn>
                  )}
                  {stateActions}
                </div>
              </div>
            )}

            {/* -------- Growth conversation -------- */}
            {kind === "growth" && (
              <div style={panel}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="file" onClick={() => setTplOpen((v) => !v)}>{tplOpen ? "Hide template" : "Open template"}</PfBtn>
                  {stateActions}
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>The conversation happens before the resignation letter</span>
                </div>
                {tplOpen && (
                  <div style={{ marginTop: 10, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "11px 13px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)", marginBottom: 8 }}>
                      ✦ Growth-conversation template — 3 talking points from {first}&apos;s growth plan
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {(TALKING[p.id] ?? []).map((t, i) => (
                        <div key={i} style={{ display: "flex", gap: 9 }}>
                          <span style={{ width: 17, height: 17, flex: "none", borderRadius: "50%", background: "var(--pf-purple-100)", color: "var(--pf-purple-500)", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>{i + 1}</span>
                          <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{t}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)", flexWrap: "wrap" }}>
                      <PfBtn small variant="primary" icon="calendar" onClick={schedule}>Schedule into 1-on-1</PfBtn>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>AI proposes the points — you lead the conversation</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* -------- Internal mobility scan -------- */}
            {kind === "mobility" && (
              match ? (
                <div style={panel}>
                  <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
                    <PfTile icon="swap" tone="blue" size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{match.role}</span>
                        <PfBadge tone="green">{match.match}% match</PfBadge>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>{match.dept} · {match.loc} · posted {match.posted} · internal posting</div>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                        {match.dims.slice(0, 3).map(([d, v]) => (
                          <span key={d} style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 99, padding: "2px 8px" }}>{d} · {v}%</span>
                        ))}
                      </div>
                      {match.risk && (
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7 }}>
                          <Ic name="warning" size={12} color="var(--pf-yellow-500)" />
                          <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-yellow-500)" }}>{match.risk}</span>
                        </div>
                      )}
                    </div>
                    <PfBtn small variant="secondary" icon="arrowright" onClick={() => go("mobility")}>View match</PfBtn>
                  </div>
                  {stateActions && <div style={{ marginTop: 10 }}>{stateActions}</div>}
                </div>
              ) : (
                <div style={panel}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>No internal match above the 70% threshold yet — the scan re-runs as roles open.</div>
                  <div style={{ marginTop: 10 }}>{stateActions}</div>
                </div>
              )
            )}

            {/* -------- Generic steps -------- */}
            {kind === "generic" && (
              <div style={panel}>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                  {STEP_CTX[name] ?? note ?? "Work this step with the employee — progress is tracked into the save rate."}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  {stateActions ?? <PfBadge tone="green">Completed</PfBadge>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------- playbook card -------------------------- */

function PlaybookCard({ p, saved, onSaved }: { p: Playbook; saved: boolean; onSaved: (p: Playbook) => void }) {
  const toast = useToast();
  const first = p.for.split(" ")[0];
  const [steps, setSteps] = useState<StepState[]>(p.steps.map((s) => s.state));
  const [openIdx, setOpenIdx] = useState<number | null>(() => {
    const a = p.steps.findIndex((s) => s.state === "active");
    return a >= 0 ? a : null;
  });

  const doneN = steps.filter((s) => s === "done").length;
  const allDone = doneN === steps.length;
  const pct = Math.round((doneN / steps.length) * 100);

  const start = (i: number) => {
    setSteps((prev) => prev.map((s, j) => (j === i ? "active" : s)));
    toast(`“${p.steps[i].step}” started for ${first} — you own the next move`);
  };

  const complete = (i: number, silent = false) => {
    const next = steps.slice();
    next[i] = "done";
    let adv = -1;
    if (!next.includes("active")) {
      adv = next.findIndex((s) => s === "todo");
      if (adv >= 0) next[adv] = "active";
    }
    setSteps(next);
    if (adv >= 0) setOpenIdx(adv);
    if (!silent)
      toast(
        adv >= 0
          ? `“${p.steps[i].step}” completed for ${first} — next step activated: ${p.steps[adv].step}`
          : `“${p.steps[i].step}” completed for ${first} — playbook ready to close`,
        "success"
      );
  };

  return (
    <PfCard style={saved ? { borderColor: "var(--pf-primary-100)", boxShadow: "0 0 0 3px var(--pf-primary-50)" } : undefined}>
      {/* person header */}
      <div style={{ display: "flex", gap: 13, padding: "16px 18px 13px", alignItems: "flex-start" }}>
        <PfAvatar init={p.init} tone={p.tone} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{p.for}</span>
            <PfBadge tone="grey">{p.id}</PfBadge>
            {saved && <PfBadge tone="green" dot>Saved</PfBadge>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 1 }}>{p.role}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
            <Ic name="warning" size={13} color="var(--pf-yellow-500)" />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-yellow-500)" }}>{p.trigger}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
            <Ic name="shield" size={12} color="var(--pf-n300)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Opened from an acknowledged risk flag — access permissioned &amp; logged (FR-056)</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <OddsRing pct={p.saveOdds} saved={saved} />
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--pf-n400)" }}>{saved ? "saved" : "save odds"}</span>
        </div>
      </div>

      {/* progress */}
      <div style={{ padding: "0 18px 13px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <PfTh>GUIDED PLAYBOOK</PfTh>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n500)" }}>{doneN}/{steps.length} steps · {pct}%</span>
        </div>
        <PfProgress pct={pct} />
      </div>

      {/* step rail */}
      <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "15px 18px 16px" }}>
        {p.steps.map((s, i) => (
          <StepItem
            key={s.step}
            p={p}
            name={s.step}
            note={s.note}
            st={steps[i]}
            isLast={i === p.steps.length - 1}
            expanded={openIdx === i}
            onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            onStart={() => start(i)}
            onComplete={(silent) => complete(i, silent)}
          />
        ))}
      </div>

      {/* outcome footer */}
      {allDone && !saved && (
        <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "13px 18px 14px" }}>
          <PfBtn variant="primary" full icon="check" onClick={() => onSaved(p)}>Mark saved — record outcome</PfBtn>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", textAlign: "center", marginTop: 7 }}>
            All steps complete — the outcome feeds the save rate and retrains the risk model
          </div>
        </div>
      )}
      {saved && (
        <div style={{ borderTop: "1px solid var(--pf-n50)", background: "var(--pf-primary-50)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 8 }}>
          <Ic name="check" size={15} color="var(--pf-primary-600)" weight={2.4} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-600)" }}>Saved — outcome recorded · feeding the risk model (retention loop)</span>
        </div>
      )}
    </PfCard>
  );
}

/* ------------------------------ loop strip ------------------------------ */

function LoopStrip({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, width: "calc(100% - 36px)", margin: "2px 18px 14px", textAlign: "left", background: hovered ? "var(--pf-purple-100)" : "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", transition: "background .15s" }}
    >
      <span style={{ fontSize: 13, color: "var(--pf-purple-500)", flex: "none" }}>✦</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: "var(--pf-purple-500)", lineHeight: 1.45 }}>
        Outcomes feed the risk model — the loop closes in Mission Control
      </span>
      <Ic name="arrowright" size={14} color="var(--pf-purple-500)" />
    </button>
  );
}

/* -------------------------------- screen -------------------------------- */

export default function Retention() {
  const go = useGo();
  const toast = useToast();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [recent, setRecent] = useState<SaveRow[]>(RECENT_SAVES);
  const [tab, setTab] = useState("playbooks");

  const onSaved = (p: Playbook) => {
    setSavedIds((ids) => [...ids, p.id]);
    setRecent((r) => [
      { name: p.for, init: p.init, tone: p.tone, type: p.id === "PB-31" ? "Growth-led" : "Workload-led", when: "Today", risk: `${RISK_FROM[p.id] ?? 70} → recalibrating`, fresh: true },
      ...r,
    ]);
    toast("Outcome recorded — retrains the risk model (retention loop)", "success");
  };

  const openN = PLAYBOOKS.length - savedIds.length;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <style>{`
        @keyframes pfStepPulse {
          0% { box-shadow: 0 0 0 0 rgba(22,179,100,.35); }
          70% { box-shadow: 0 0 0 7px rgba(22,179,100,0); }
          100% { box-shadow: 0 0 0 0 rgba(22,179,100,0); }
        }
      `}</style>

      {/* ------------------------------ header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Retention playbooks</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Acknowledging a risk flag opens a guided playbook — pay, growth, mobility, workload. Save rate per playbook feeds the risk model (FR-072)
          </div>
        </div>
        <PfBtn variant="secondary" icon="pulse" onClick={() => go("attrition")}>Flagged population</PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "playbooks", label: "Playbooks", count: String(openN) },
            { key: "outcomes", label: "Outcomes", count: String(recent.length) },
          ]}
        />
      </div>

      {/* ---------------- PLAYBOOKS — KPI pulse + guided flows ---------------- */}
      {tab === "playbooks" && (<>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="lifebuoy" tone="yellow" label="Open playbooks" value={openN} unit={openN === 1 ? "guided flow" : "guided flows"} delta={savedIds.length > 0 ? `${savedIds.length} saved today` : "2 high-risk flags"} deltaTone={savedIds.length > 0 ? "green" : "red"} />
        <PfStat icon="target" tone="green" label="Save rate (6mo)" value="43%" unit="of closed playbooks" delta="≥ 40% target" deltaTone="green" />
        <PfStat icon="trend" tone="blue" label="Regretted attrition" value="−18%" unit="since playbooks" delta="target −30% by mo 18" deltaTone="yellow" />
        <PfStat icon="check" tone="green" label="Flags acknowledged" value="9/9" unit="this quarter" delta="all within 48h" deltaTone="green" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, alignItems: "start" }}>
        {PLAYBOOKS.map((p) => (
          <PlaybookCard key={p.id} p={p} saved={savedIds.includes(p.id)} onSaved={onSaved} />
        ))}
      </div>
      </>)}

      {/* ---------------- OUTCOMES — save rates + governance ------------------ */}
      {tab === "outcomes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="trend" tone="green" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>Outcomes → risk model</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Save rate by playbook type · trailing 6 months</div>
              </div>
            </div>

            <div style={{ padding: "14px 18px 4px", display: "flex", flexDirection: "column", gap: 12 }}>
              {OUTCOME_BARS.map((b) => (
                <div key={b.type}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{b.type}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{b.pct}%</span> · {b.n} saved
                    </span>
                  </div>
                  <PfProgress pct={b.pct} tone={b.tone} />
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, paddingBottom: 8 }}>
                Growth conversations before the resignation letter remain the strongest lever — 61% of growth-led playbooks end in a save.
              </div>
            </div>

            <LoopStrip onClick={() => go("missioncontrol")} />

            <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "12px 18px 13px" }}>
              <PfTh style={{ marginBottom: 8 }}>RECENT SAVES</PfTh>
              {recent.map((r) => (
                <div key={`${r.name}-${r.when}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0" }}>
                  <PfAvatar init={r.init} tone={r.tone} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{r.type} · saved {r.when}</div>
                  </div>
                  {r.fresh ? <PfBadge tone="purple">✦ risk {r.risk}</PfBadge> : <PfBadge tone="green">risk {r.risk}</PfBadge>}
                </div>
              ))}
            </div>
          </PfCard>

          {/* governance footnote */}
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <Ic name="shield" size={15} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
              Risk flags and pay data are permissioned; every access is logged (FR-056). Playbooks guide managers — the system takes no automated action on any individual (FR-077). Save rate per playbook is the model&apos;s ground truth.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
