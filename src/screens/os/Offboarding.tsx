"use client";
import { useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfBanner, PfAvatar, PfPageTabs } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { EMPLOYEES, EXIT_REASONS, SYSTEMS, type SystemName } from "@/data/talentos";

/**
 * Offboarding & Alumni — PRD FR-063.
 * Structured exit workflow: AI-assisted exit interview scored into attrition
 * analytics (FR-055), deprovisioning mirroring onboarding, NDPR-safe archive
 * (never hard-delete), and an alumni network feeding the boomerang pool.
 */

const tunde = EMPLOYEES.find((e) => e.status === "notice")!; // Tunde Bakare
const bola = EMPLOYEES.find((e) => e.status === "alumni")!; // Bola Adeyemi

const STAGES = [
  { label: "Notice received", date: "Jul 14", note: "Resignation logged by HRBP · risk flag AN-104 closed as materialised." },
  { label: "Exit interview", date: "In progress", note: "AI-led with human review — summary lands in attrition analytics on sign-off." },
  { label: "Knowledge handover", date: "Due Jul 25", note: "3 handover items — 1 complete, 1 scheduled, 1 awaiting reassignment." },
  { label: "Deprovisioning", date: "Jul 31", note: "Auto-runs on last day 04:00 WAT — mirrors the onboarding checklist in reverse." },
  { label: "Alumni", date: "Aug 1", note: "Record flips to alumni on the same person-record spine (FR-075)." },
] as const;
const CURRENT_STAGE = 1;

const INTERVIEW_QA = [
  { q: "What most influenced your decision to leave?", a: "My scope shrank after the reorg and there was no path to Senior PM — the band stayed flat for 16 months." },
  { q: "Would anything have changed your mind?", a: "A concrete growth plan six months ago. By the time the counter-offer came, I had already signed." },
  { q: "Would you consider returning?", a: "Yes — for a Senior PM or platform role. Keep me in the alumni network." },
] as const;

/**
 * The onboarding checklist run backwards — the same `SYSTEMS` rows the joiner
 * was granted, read through `revokeVia`. Mapping rather than re-typing is what
 * makes "mirrors onboarding" true instead of a promise somebody has to keep.
 */
type DeprovItem = { sys: SystemName; via: string; done: boolean };
const REVOKED: SystemName[] = ["Google Workspace", "Slack"];
const DEPROV_INIT: DeprovItem[] = SYSTEMS.map((s) => ({
  sys: s.sys,
  via: s.revokeVia,
  done: REVOKED.includes(s.sys),
}));

const ALUMNI = [
  { name: bola.name, init: bola.init, tone: bola.tone, exit: "Exited 2024", now: "Now Seplat Energy · Ops", open: true },
  { name: "Ifeoma Chukwu", init: "IC", tone: "#AF52DE", exit: "Exited 2023", now: "Now Dangote Refinery · Planning", open: true },
  { name: "Segun Alade", init: "SL", tone: "#16B364", exit: "Exited 2022", now: "Now TotalEnergies · HSE", open: false },
] as const;

/* ------------------------------ tiny pieces ------------------------------ */

function StageDot({ i, label, date, note }: { i: number; label: string; date: string; note: string }) {
  const toast = useToast();
  const state = i < CURRENT_STAGE ? "done" : i === CURRENT_STAGE ? "current" : "todo";
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={() => toast(`${label} — ${note}`, state === "current" ? "ai" : "default")}
      style={{ flex: 1, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, minWidth: 0 }}
    >
      <span
        style={{
          width: 24, height: 24, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box",
          background: state === "done" ? "var(--pf-primary-500)" : "var(--pf-n0)",
          border: state === "done" ? "1px solid var(--pf-primary-500)" : state === "current" ? "2px solid var(--pf-primary-500)" : "2px solid var(--pf-n100)",
          boxShadow: state === "current" ? "0 0 0 4px var(--pf-primary-50)" : hovered ? "0 0 0 3px var(--pf-n50)" : "none",
          transition: "box-shadow .15s ease",
        }}
      >
        {state === "done" && <Ic name="check" size={13} color="#fff" weight={2.4} />}
        {state === "current" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--pf-primary-500)" }} />}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: state === "todo" ? 500 : 600, color: state === "todo" ? "var(--pf-n400)" : "var(--pf-n900)", lineHeight: 1.2, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: 11, color: state === "current" ? "var(--pf-primary-600)" : "var(--pf-n300)", fontWeight: state === "current" ? 600 : 400, marginTop: -3 }}>{date}</span>
    </button>
  );
}

function QaRow({ q, a }: { q: string; a: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-purple-500)" }}>Q · {q}</div>
      <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.5, borderLeft: "2px solid var(--pf-purple-100)", paddingLeft: 10 }}>&ldquo;{a}&rdquo;</div>
    </div>
  );
}

function AlumniRow({ a }: { a: (typeof ALUMNI)[number] }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`${a.name} — alumni record opened · same person-record spine as candidate + employee (FR-075)`)}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfAvatar init={a.init} tone={a.tone} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.name}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>{a.exit} · {a.now}</div>
      </div>
      {a.open ? <PfBadge tone="green" dot>Open to return</PfBadge> : <PfBadge tone="grey">Connected</PfBadge>}
    </div>
  );
}

function ExitReasonsCard() {
  const go = useGo();
  return (
    <PfCard>
      <PfCardHead title="Why people leave" sub="Structured exit interviews · YTD" />
      <div style={{ padding: "14px 16px 6px", display: "flex", flexDirection: "column", gap: 11 }}>
        {EXIT_REASONS.map((r) => (
          <div key={r.reason}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", flex: 1 }}>{r.reason}</span>
              {r.reason === "Career growth stalled" && <PfBadge tone="purple">✦ Tunde&apos;s driver</PfBadge>}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", letterSpacing: "-.12px" }}>{r.pct}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 6, background: "var(--pf-n50)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${r.pct}%`, borderRadius: 6, background: r.tone }} />
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => go("attrition")}
        style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "none", border: "none", borderTop: "1px solid var(--pf-n50)", marginTop: 10, padding: "11px 16px", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-600)" }}>Feeds attrition analytics · FR-055</span>
        <Ic name="arrowright" size={14} color="var(--pf-primary-600)" />
      </button>
    </PfCard>
  );
}

/* -------------------------------- screen -------------------------------- */

export default function Offboarding() {
  const go = useGo();
  const toast = useToast();
  const [deprov, setDeprov] = useState<DeprovItem[]>(DEPROV_INIT);
  const [okrOwner, setOkrOwner] = useState<string | null>(null);
  const [tab, setTab] = useState("active");

  const revoked = deprov.filter((d) => d.done).length;
  const deprovPct = Math.round((revoked / deprov.length) * 100);

  const toggleDeprov = (i: number) => {
    const item = deprov[i];
    setDeprov((list) => list.map((d, j) => (j === i ? { ...d, done: !d.done } : d)));
    if (!item.done) toast(`${item.sys} access revoked for ${tunde.name} · logged for SOC 2`, "success");
    else toast(`${item.sys} access restored — revocation reversed, audit entry kept`);
  };

  const handovers = [
    { what: "Q3 roadmap & discovery docs", sub: "Walkthrough held Jul 21 · 4 docs shared", owner: "Ngozi Adeyemi", init: "NA", tone: "#16B364", badge: <PfBadge tone="green">Handed over</PfBadge> },
    { what: "Partner & stakeholder calls", sub: "Intro calls booked Jul 25 · 6 contacts", owner: "Zainab Yusuf", init: "ZY", tone: "#EBA308", badge: <PfBadge tone="yellow">Scheduled</PfBadge> },
  ];

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Offboarding & Alumni</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Structured exits (FR-063) — every departure interviewed, archived under NDPR, and folded back into the talent network.
          </div>
        </div>
        <PfBtn variant="secondary" icon="file" onClick={() => toast("Exit playbook — 5-stage FR-063 workflow with NDPR checkpoints at interview, archive and alumni steps")}>Exit playbook</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => toast("Start offboarding — pick an employee to open the structured exit workflow")}>Start offboarding</PfBtn>
      </div>

      {/* Banner */}
      <div>
        <PfBanner tone="yellow" icon="calendar" cta="open" onCta={() => go("oneonones")}>
          Exit conversation with {tunde.name} — Fri 11:00. Agenda: handover map, knowledge-transfer sessions, alumni-network invite.
        </PfBanner>
      </div>

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "active", label: "Active offboarding", count: "1" },
            { key: "archive", label: "Archive & retention" },
            { key: "alumni", label: "Alumni & boomerang", count: "87" },
          ]}
        />
      </div>

      {tab === "active" && (
      <>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 12 }}>
        <PfStat icon="door" tone="yellow" label="In offboarding" value="1" unit="employee" delta="Tunde B." deltaTone="yellow" />
        <PfStat icon="trend" tone="blue" label="Exits YTD" value="14" unit="since Jan" delta="+0.4pp vs bench" deltaTone="red" />
        <PfStat icon="heart" tone="red" label="Regretted" value="4" unit="of 14" delta="29%" deltaTone="red" />
        <PfStat icon="users" tone="green" label="Alumni network" value="87" unit="members" delta="+6 this qtr" deltaTone="green" />
        <PfStat icon="swap" tone="purple" label="Boomerang hires" value="3" unit="YTD" delta="₦9.4M saved" deltaTone="green" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 348px", gap: 12, alignItems: "start" }}>
          {/* Active offboarding */}
          <PfCard>
            <PfCardHead
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <PfAvatar init={tunde.init} tone={tunde.tone} size={30} />
                  {tunde.name}
                  <PfBadge tone="red" dot>Notice · regretted</PfBadge>
                </span>
              }
              sub={`${tunde.id} · ${tunde.role} · ${tunde.dept} · ${tunde.loc} · Last day Jul 31, 2026`}
            >
              <PfBtn variant="secondary" small icon="user" onClick={() => go("employee")}>Open record</PfBtn>
            </PfCardHead>

            {/* Stage rail */}
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--pf-n50)", position: "relative" }}>
              <div style={{ position: "absolute", top: 29, left: "10%", right: "10%", height: 2, background: "var(--pf-n100)" }} />
              <div style={{ position: "absolute", top: 29, left: "10%", width: `${(CURRENT_STAGE / (STAGES.length - 1)) * 80}%`, height: 2, background: "var(--pf-primary-500)" }} />
              <div style={{ display: "flex", position: "relative" }}>
                {STAGES.map((s, i) => <StageDot key={s.label} i={i} label={s.label} date={s.date} note={s.note} />)}
              </div>
            </div>

            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* AI exit interview */}
              <div style={{ border: "1px solid var(--pf-purple-100)", borderRadius: 10, background: "linear-gradient(180deg, var(--pf-purple-50) 0%, var(--pf-n0) 34%)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                  <PfTile icon="sparkle" tone="purple" size={26} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>AI exit interview</span>
                  <PfBadge tone="purple">AI-assisted · human review</PfBadge>
                  <span style={{ flex: 1 }} />
                  <PfBadge tone="yellow" dot>In progress</PfBadge>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginBottom: 12, lineHeight: 1.5 }}>
                  Consent recorded Jul 18 — Tunde chose the AI-led format. Raw transcript stays with the HRBP; analytics receive de-identified drivers only (NDPR).
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  {INTERVIEW_QA.map((qa) => <QaRow key={qa.q} q={qa.q} a={qa.a} />)}
                </div>
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Primary driver</span>
                  <PfBadge tone="yellow" dot>Career growth stalled</PfBadge>
                  <PfBadge tone="red">Regretted</PfBadge>
                  <PfBadge tone="green">Would return · likely</PfBadge>
                  <PfBadge tone="purple">Sentiment · constructive</PfBadge>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-n50)" }}>
                  <Ic name="target" size={14} color="var(--pf-purple-500)" />
                  <span style={{ fontSize: 12, color: "var(--pf-n500)", flex: 1, lineHeight: 1.45 }}>
                    On sign-off this interview is <b>scored into attrition analytics (FR-055)</b> — driver &ldquo;Career growth stalled&rdquo; · confidence 87% · evidence: 14 answers, engagement −0.9pt, 16 months since promotion.
                  </span>
                  <PfBtn variant="secondary" small icon="file" onClick={() => toast("Full transcript — 14 questions · 22 min · consent and processing purpose logged (NDPR)", "ai")}>View full transcript</PfBtn>
                </div>
              </div>

              {/* Deprovisioning + Handover */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {/* Deprovisioning checklist */}
                <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <PfTile icon="shield" tone="blue" size={26} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Deprovisioning</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Mirrors onboarding — same systems, reverse order</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", letterSpacing: "-.12px" }}>{revoked}/{deprov.length}</span>
                  </div>
                  <div style={{ margin: "11px 0 10px" }}><PfProgress pct={deprovPct} tone={deprovPct === 100 ? "green" : "blue"} /></div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {deprov.map((d, i) => (
                      <button
                        key={d.sys}
                        onClick={() => toggleDeprov(i)}
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 2px", background: "none", border: "none", borderBottom: i < deprov.length - 1 ? "1px solid var(--pf-n25)" : "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                      >
                        <span style={{ width: 17, height: 17, borderRadius: 5, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", background: d.done ? "var(--pf-primary-500)" : "var(--pf-n0)", border: d.done ? "1px solid var(--pf-primary-500)" : "1.5px solid var(--pf-n100)", transition: "background .12s ease" }}>
                          {d.done && <Ic name="check" size={11} color="#fff" weight={2.6} />}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: d.done ? "var(--pf-n400)" : "var(--pf-n900)", textDecoration: d.done ? "line-through" : "none" }}>{d.sys}</span>
                        <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{d.done ? "revoked" : d.via}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 9, display: "flex", alignItems: "center", gap: 6 }}>
                    <Ic name="clock" size={12} color="var(--pf-n300)" /> Unchecked items auto-run on last day · Jul 31, 04:00 WAT
                  </div>
                </div>

                {/* Handover map */}
                <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
                    <PfTile icon="swap" tone="green" size={26} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Handover map</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Nothing leaves with the leaver</div>
                    </div>
                  </div>
                  {handovers.map((h) => (
                    <div
                      key={h.what}
                      onClick={() => toast(`${h.what} — handover pack shared with ${h.owner} · access expires on archive`)}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: "1px solid var(--pf-n25)", cursor: "pointer" }}
                    >
                      <PfAvatar init={h.init} tone={h.tone} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{h.what}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>→ {h.owner} · {h.sub}</div>
                      </div>
                      {h.badge}
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0 2px" }}>
                    {okrOwner ? <PfAvatar init="TB" tone="#16B364" size={26} /> : <PfTile icon="warning" tone="red" size={26} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>OKR O-02 — design-system adoption KR</div>
                      <div style={{ fontSize: 11.5, color: okrOwner ? "var(--pf-n400)" : "var(--pf-red-500)", marginTop: 1 }}>
                        {okrOwner ? `→ ${okrOwner} · reassigned just now` : "Owner leaving · KR at 65% — needs a new owner"}
                      </div>
                    </div>
                    {okrOwner ? (
                      <PfBadge tone="green">Reassigned</PfBadge>
                    ) : (
                      <PfBtn variant="primary" small onClick={() => { setOkrOwner("Tobi Balogun"); toast("OKR O-02 KR reassigned to Tobi Balogun (Product & Design head) — goal history preserved", "success"); }}>Reassign</PfBtn>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* Exit reasons — rail of the active exit */}
          <ExitReasonsCard />
      </div>
      </>
      )}

      {/* Archive & retention */}
      {tab === "archive" && (
          <PfCard>
            <PfCardHead title="Archive & retention" sub="What happens to the record after the last day">
              <PfBadge tone="grey">NDPR schedule · 6y</PfBadge>
            </PfCardHead>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <PfTile icon="file" tone="grey" size={28} />
                <div style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                  On completion the record <b style={{ color: "var(--pf-n900)" }}>archives under the NDPR retention schedule (6 years from exit)</b> — it is <b style={{ color: "var(--pf-n900)" }}>never hard-deleted</b>. The file goes read-only, every prior action stays in the audit history, and after the schedule elapses the record is anonymised, not erased.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--pf-n50)", background: "var(--pf-n25)", borderRadius: 9, padding: "10px 12px" }}>
                <Ic name="stack" size={16} color="var(--pf-n400)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{tunde.id} · {tunde.name} — personnel file, payroll history, exit interview</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>Archives Jul 31, 2026 → anonymises Jul 31, 2032 · access logged per view</div>
                </div>
                <PfBadge tone="grey">Read-only after archive</PfBadge>
                <PfBtn variant="secondary" small onClick={() => toast(`Archive preview — ${tunde.name}'s record locks read-only on Jul 31; audit trail and NDPR access log preserved end-to-end`)}>Preview</PfBtn>
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 12, paddingLeft: 10, borderLeft: "2px solid var(--pf-n100)", lineHeight: 1.5 }}>
                What we cut: <b style={{ color: "var(--pf-n500)" }}>hard-delete (Section 7)</b> — deliberately not built. NDPR erasure requests run through anonymisation so the audit history survives.
              </div>
            </div>
          </PfCard>
      )}

      {/* ------------------------- Alumni & boomerang ------------------------- */}
      {tab === "alumni" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, alignItems: "start", maxWidth: 760 }}>
          {/* Alumni network */}
          <PfCard>
            <PfCardHead title="Alumni network" sub="87 members · 21 open to return">
              <PfTile icon="users" tone="green" size={26} />
            </PfCardHead>
            <div style={{ padding: "8px 8px 12px" }}>
              {ALUMNI.map((a) => <AlumniRow key={a.name} a={a} />)}
              <div style={{ padding: "8px 8px 0" }}>
                <PfBtn variant="primary" full icon="paperplane" onClick={() => toast(`Alumni-network invite sent to ${tunde.name} — he joins on his last day, contact prefs his to edit (NDPR)`, "success")}>
                  Invite Tunde to alumni network
                </PfBtn>
              </div>
            </div>
          </PfCard>

          {/* Boomerang pool */}
          <PfCard style={{ background: "var(--pf-n25)" }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                <PfTile icon="swap" tone="purple" size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Boomerang pool · 21</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Alumni open to return, ranked by quality-of-hire at exit</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5, marginBottom: 11 }}>
                3 boomerang hires YTD (incl. {bola.name}) — avg QoH 4.4, 41% faster ramp, ₦9.4M agency fees saved. Pool feeds Pillar 1 sourcing directly.
              </div>
              <PfBtn variant="secondary" full icon="stack" onClick={() => go("talentlibrary")}>Open in Talent library</PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
