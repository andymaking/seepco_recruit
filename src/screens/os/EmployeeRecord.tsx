"use client";
import { useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfProgress, PfSegments,
  PfAvatar, PfPageTabs, PfTh, PfBanner, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { EMPLOYEES, ONE_ON_ONES, MOBILITY } from "@/data/talentos";
import { CONSENT_RECORDS } from "@/data/onboarding";

/**
 * Employee Record — the "one profile spine" flagship (PRD FR-075, FR-060, FR-061).
 * The candidate record from Pillar 1 became this employee record; hiring artifacts
 * (screening video, scorecards, QoH) stay attached and every talent surface hangs
 * off the same spine.
 */

const EMP = EMPLOYEES[0]; // Amara Okonkwo — Senior Software Engineer, L5
const MEET = ONE_ON_ONES[0]; // today's 1-on-1 with Amara
const MATCH = MOBILITY[0]; // Staff Engineer (Platform) — 87% internal match
/** Her own re-consent record — consent does not carry across a purpose change. */
const CONSENT = CONSENT_RECORDS[EMP.id];

/* ------------------------------ Local data ------------------------------ */

const SPINE_ARTIFACTS = [
  { icon: "play", label: "Screening video", sub: "Stage 4" },
  { icon: "clipboard", label: "Interview scorecards", sub: "Stage 6" },
  { icon: "star", label: "QoH 4.6/5", sub: "Stage 11" },
];

/** Unified competency taxonomy — today's score vs the Stage-6 hiring score. */
const COMPETENCIES = [
  { name: "Distributed systems", score: 95, hire: 88 },
  { name: "Payments", score: 92, hire: 82 },
  { name: "Technical leadership", score: 81, hire: 70 },
  { name: "Mentoring", score: 88, hire: 78 },
  { name: "Communication", score: 84, hire: 80 },
];

const REVIEWS: { cycle: string; rating: string; attain: string; rec: string; recTone: PfTone; current?: boolean }[] = [
  { cycle: "Q2 2026 · Mid-year", rating: "In progress", attain: "65% to date", rec: "Promote (draft)", recTone: "green", current: true },
  { cycle: "Q1 2026 · Annual", rating: "4.5/5", attain: "80%", rec: "Promote-track", recTone: "green" },
  { cycle: "Q3 2025 · Mid-year", rating: "4.2/5", attain: "74%", rec: "Retain", recTone: "blue" },
];

const EMP_OKRS: { obj: string; progress: number; status: string; tone: PfTone; krs: { kr: string; p: number }[] }[] = [
  {
    obj: "Ship payments platform v2 to 100% of merchants", progress: 78, status: "On track", tone: "green",
    krs: [{ kr: "Cut over 80% of transaction volume", p: 82 }, { kr: "p95 checkout latency under 250ms", p: 74 }],
  },
  {
    obj: "Mentor 2 mid-level engineers toward L5 readiness", progress: 50, status: "Behind", tone: "yellow",
    krs: [{ kr: "Weekly pairing cadence held all quarter", p: 70 }, { kr: "Each mentee leads one production feature", p: 30 }],
  },
];

const FEEDBACK: { from: string; init: string; avTone: string; rel: string; when: string; tag: string; kind: string; kindTone: PfTone; text: string }[] = [
  { from: "Ngozi Adeyemi", init: "NA", avTone: "#16B364", rel: "Manager", when: "Jul 2026", tag: "Technical leadership", kind: "Praise", kindTone: "green", text: "Ran the payments-incident review end to end — calm comms under pressure, remediation shipped in 48h. Exactly the Staff-level bar." },
  { from: "Chidi Okeke", init: "CO", avTone: "#E81E17", rel: "Peer · mentee", when: "Jun 2026", tag: "Mentoring", kind: "Praise", kindTone: "green", text: "Amara's pairing sessions got me productive on the Go services in my first month. Best onboarding I've had." },
  { from: "Obinna Kalu", init: "OK", avTone: "#16B364", rel: "Skip-level · VP Engineering", when: "May 2026", tag: "Communication", kind: "Constructive", kindTone: "yellow", text: "Design docs are excellent; would love more of that framing surfaced in cross-team forums, not just inside the squad." },
];

const GAP_TARGETS: Record<string, number> = {
  "Distributed systems": 90, "Payments domain": 85, "Technical leadership": 92, Mentoring: 92,
};

const MILESTONES: { m: string; when: string; state: "done" | "active" | "todo" }[] = [
  { m: "Advanced distributed-systems course completed", when: "May 2026", state: "done" },
  { m: "Stretch project — lead payments v2 cutover", when: "In progress · Q3 2026", state: "active" },
  { m: "Mentor 2 mid-level engineers (OKR-linked)", when: "Starts Aug 2026", state: "todo" },
];

const MS_STYLE: Record<"done" | "active" | "todo", { icon: string; tone: PfTone; badge: string }> = {
  done: { icon: "check", tone: "green", badge: "Done" },
  active: { icon: "clock", tone: "blue", badge: "In progress" },
  todo: { icon: "calendar", tone: "grey", badge: "Not started" },
};

const DOCS = [
  { icon: "file", name: "Offer letter — signed", meta: "PDF · Nov 2023 · carried from Pillar 1 offer flow" },
  { icon: "file", name: "Employment contract v2 (L5 promotion)", meta: "PDF · May 2025" },
  { icon: "shield", name: "NDA & IP assignment", meta: "PDF · Nov 2023" },
];

const TIMELINE: { icon: string; tone: PfTone; title: string; date: string; sub: string }[] = [
  { icon: "arrowsq", tone: "green", title: "Hired via Pillar 1 — Recruit", date: "Nov 2023", sub: "Offer accepted · QoH predicted 4.4 · hiring artifacts attached to this record" },
  { icon: "arrowup", tone: "blue", title: "Promoted to L5 — Senior Software Engineer", date: "May 2025", sub: "Q1 review 4.5/5 · Promote-track · contract v2 issued" },
  { icon: "warning", tone: "yellow", title: "Leave-risk flag raised — HRBP visibility only", date: "Jul 2026", sub: "30d horizon · score 78 · retention playbook PB-31 opened" },
];

const SPARK = [4.0, 4.15, 4.2, 4.35, 4.5, 4.55];

/* ---------------------------- Small components --------------------------- */

function BackLink({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button onClick={onClick} {...hoverProps} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: hovered ? "var(--pf-n900)" : "var(--pf-n500)", padding: 0 }}>
      ← People
    </button>
  );
}

function SpineChip({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button onClick={onClick} {...hoverProps} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "var(--pf-n0)", border: `1px solid ${hovered ? "var(--pf-primary-500)" : "var(--pf-primary-100)"}`, borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", boxShadow: hovered ? "0 2px 8px rgba(22,179,100,.16)" : "none", transition: "border-color .12s ease" }}>
      <Ic name={icon} size={15} color="var(--pf-primary-600)" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.25 }}>{label}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)" }}>{sub}</span>
      </span>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </button>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
      <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

function ContactRow({ icon, value, onCopy }: { icon: string; value: string; onCopy: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button onClick={onCopy} {...hoverProps} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: hovered ? "var(--pf-n25)" : "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "7px 20px" }}>
      <Ic name={icon} size={15} color="var(--pf-n400)" />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n600)" }}>{value}</span>
      <span style={{ fontSize: 11.5, color: hovered ? "var(--pf-n500)" : "var(--pf-n300)" }}>copy</span>
    </button>
  );
}

function DocRow({ icon, name, meta, onDownload, last }: { icon: string; name: string; meta: string; onDownload: () => void; last?: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 20px", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <PfTile icon={icon} tone="grey" size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{name}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>{meta}</div>
      </div>
      <PfBtn small icon="download" onClick={onDownload}>PDF</PfBtn>
    </div>
  );
}

/** Competency bar on the unified taxonomy — grey tick marks the Stage-6 hiring score. */
function CompBar({ name, score, hire }: { name: string; score: number; hire: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n600)" }}>{name}</span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
          <b style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{(score / 20).toFixed(1)}</b>/5 · at hire {(hire / 20).toFixed(1)}
        </span>
      </div>
      <div style={{ position: "relative", height: 7, borderRadius: 4, background: "var(--pf-n50)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${score}%`, borderRadius: 4, background: "var(--pf-primary-500)" }} />
        <span title={`Hiring score (Stage 6): ${(hire / 20).toFixed(1)}/5`} style={{ position: "absolute", left: `${hire}%`, top: -2, width: 2, height: 11, borderRadius: 1, background: "var(--pf-n400)" }} />
      </div>
    </div>
  );
}

/** Gap-to-target bar — dark tick is the Staff-level bar for that dimension. */
function GapBar({ name, score, target }: { name: string; score: number; target: number }) {
  const met = score >= target;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n600)" }}>{name}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n400)" }}>
          {score} / target {target}
          <PfBadge tone={met ? "green" : "red"}>{met ? "Met" : `Gap ${target - score}`}</PfBadge>
        </span>
      </div>
      <div style={{ position: "relative", height: 7, borderRadius: 4, background: "var(--pf-n50)" }}>
        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${score}%`, borderRadius: 4, background: met ? "var(--pf-primary-500)" : "var(--pf-blue-500)" }} />
        <span title={`Staff-level bar: ${target}`} style={{ position: "absolute", left: `${target}%`, top: -2, width: 2, height: 11, borderRadius: 1, background: "var(--pf-n900)" }} />
      </div>
    </div>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function EmployeeRecord() {
  const go = useGo();
  const toast = useToast();
  const [tab, setTab] = useState("Overview");
  const [actions, setActions] = useState([
    { item: "Share design-system migration plan", owner: "Amara", due: "Jul 5", done: false, overdue: true },
    { item: "Draft Staff-engineer growth plan", owner: "Ngozi (manager)", due: "Jul 12", done: false, overdue: false },
  ]);
  const risk = EMP.risk;
  const openActions = actions.filter((a) => !a.done).length;

  const toggleAction = (i: number) => {
    setActions((prev) => prev.map((a, j) => (j === i ? { ...a, done: !a.done } : a)));
    const a = actions[i];
    toast(a.done ? `Reopened “${a.item}”` : `“${a.item}” marked done — synced to the 1-on-1 thread`, a.done ? "default" : "success");
  };

  const sparkPts = SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * 128 + 4},${30 - ((v - 3.9) / 0.75) * 24}`).join(" ");

  const label = (t: string) => (
    <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--pf-n400)", marginBottom: 8 }}>{t}</div>
  );

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Back link */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <BackLink onClick={() => go("people")} />
          <span style={{ fontSize: 12, color: "var(--pf-n300)" }}>Record {EMP.id} · one spine since Nov 2023</span>
        </div>

        {/* ------------------------- Header + spine strip ------------------------- */}
        <PfCard style={{ overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            {/* Identity */}
            <div style={{ flex: 1, minWidth: 0, padding: "20px 22px", display: "flex", gap: 16 }}>
              <PfAvatar init={EMP.init} tone={EMP.tone} size={56} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{EMP.name}</span>
                  <PfBadge tone="green" dot>Active</PfBadge>
                  <PfBadge tone="purple">QoH {EMP.qoh ?? 4.6}/5</PfBadge>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--pf-n400)", marginTop: 3 }}>{EMP.role} · Payments platform squad</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {[EMP.dept, EMP.loc, EMP.grade, `Tenure ${EMP.tenure}`, EMP.contract].map((c) => (
                    <span key={c} style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", padding: "3px 9px", borderRadius: 6 }}>{c}</span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="megaphone" onClick={() => go("feedbackhub")}>Give feedback</PfBtn>
                  <PfBtn icon="calendar" onClick={() => go("oneonones")}>Schedule 1-on-1</PfBtn>
                  <PfBtn icon="dots" style={{ padding: "8px 9px" }} onClick={() => toast("More actions — export record (audit-logged), transfer, offboard")} />
                </div>
              </div>
            </div>

            {/* Spine strip — the PRD's signature idea */}
            <div style={{ width: 302, flex: "none", background: "var(--pf-primary-50)", borderLeft: "1px solid var(--pf-primary-100)", padding: "16px 16px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Ic name="arrowsq" size={15} color="var(--pf-primary-600)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>Candidate → Employee</span>
                <PfBadge tone="green">one record</PfBadge>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n500)", margin: "5px 0 10px", lineHeight: 1.45 }}>
                Hired via {EMP.hiredVia} — the hiring artifacts below carried forward to this profile (FR-075).
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {SPINE_ARTIFACTS.map((a) => (
                  <SpineChip key={a.label} icon={a.icon} label={a.label} sub={a.sub}
                    onClick={() => toast(`${a.label} · ${a.sub} — opens the Stage artifact, consent state attached`)} />
                ))}
              </div>
            </div>
          </div>
        </PfCard>

        {/* --------------------- Permissioned risk panel (FR-056/077) --------------------- */}
        {risk && (
          <div style={{ background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 18px 0" }}>
              <PfTile icon="warning" tone="yellow" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Leave-risk signal</span>
                <span style={{ fontSize: 12.5, color: "#B87F06", marginLeft: 8 }}>Visible to HRBP+ only — access is logged</span>
              </div>
              <PfBadge tone="red">Tier High · {risk.horizon} horizon</PfBadge>
            </div>
            <div style={{ display: "flex", gap: 22, alignItems: "flex-start", padding: "12px 18px 14px", flexWrap: "wrap" }}>
              <div style={{ width: 190, flex: "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{risk.score}</span>
                  <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>/100 · leave-risk 30d</span>
                </div>
                <div style={{ marginTop: 7 }}><PfProgress pct={risk.score} tone="red" /></div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase", color: "#B87F06", marginBottom: 6 }}>Declared reasons (explainable)</div>
                {risk.reasons.map((r) => (
                  <div key={r} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, color: "var(--pf-n600)", marginBottom: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-red-500)", flex: "none", transform: "translateY(-2px)" }} />
                    {r}
                  </div>
                ))}
              </div>
              <div style={{ flex: "none", textAlign: "right" }}>
                <PfBtn icon="lifebuoy" onClick={() => { toast("Access logged · playbook opened", "ai"); go("retention"); }}>
                  Acknowledge → open retention playbook
                </PfBtn>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6 }}>Playbook PB-31 drafted · save odds 72%</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderTop: "1px solid var(--pf-yellow-100)", fontSize: 12, color: "var(--pf-n500)" }}>
              <Ic name="shield" size={14} color="#B87F06" />
              Never triggers automated action — the model proposes, an HRBP decides (FR-056 · FR-077).
            </div>
          </div>
        )}

        {/* ----------------------- Section tabs (underline bar) ----------------------- */}
        <div style={{ margin: "4px -28px" }}>
          <PfPageTabs
            active={tab}
            onSelect={setTab}
            tabs={[
              { key: "Overview", label: "Overview" },
              { key: "Performance", label: "Performance" },
              { key: "Goals & OKR", label: "Goals & OKR", count: String(EMP_OKRS.length) },
              { key: "Feedback", label: "Feedback", count: String(FEEDBACK.length) },
              { key: "1-on-1s", label: "1-on-1s", count: String(openActions) },
              { key: "Growth plan", label: "Growth plan" },
              { key: "Contract", label: "Contract", count: String(DOCS.length) },
            ]}
          />
        </div>

        {/* ------------------------------- Overview ------------------------------- */}
        {tab === "Overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="About" sub="Skills, contacts and org placement" />
              <div style={{ padding: "14px 20px 6px" }}>
                {label("Skills")}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {EMP.skills.map((s) => <PfBadge key={s} tone="blue">{s}</PfBadge>)}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "8px 0" }}>
                <ContactRow icon="paperplane" value="amara.okonkwo@hirebrew.ng" onCopy={() => toast("Copied amara.okonkwo@hirebrew.ng", "success")} />
                <ContactRow icon="chat" value="+234 803 555 0192 · WhatsApp" onCopy={() => toast("Copied +234 803 555 0192", "success")} />
              </div>
              <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "12px 20px 16px" }}>
                {label("Org")}
                <button onClick={() => go("people")} style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0" }}>
                  <PfAvatar init="NA" tone="#16B364" size={26} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>Reports to Ngozi Adeyemi — Head of Engineering</span>
                  <Ic name="caretright" size={13} color="var(--pf-n300)" />
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0 2px" }}>
                  <Ic name="users" size={16} color="var(--pf-n400)" />
                  <span style={{ fontSize: 13, color: "var(--pf-n500)" }}>Payments platform squad · 6 engineers · Lagos</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0 0" }}>
                  <Ic name="heart" size={16} color="var(--pf-n400)" />
                  <span style={{ fontSize: 13, color: "var(--pf-n500)" }}>Mentoring Chidi Okeke +1 mid-level — OKR-linked</span>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Record timeline" sub="One spine — recruit events stay attached" />
              <div style={{ padding: "16px 20px 18px" }}>
                {TIMELINE.map((t, i) => (
                  <div key={t.title} style={{ display: "flex", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <PfTile icon={t.icon} tone={t.tone} size={30} />
                      {i < TIMELINE.length - 1 && <div style={{ width: 2, flex: 1, background: "var(--pf-n50)", margin: "4px 0" }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingBottom: i < TIMELINE.length - 1 ? 18 : 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.title}</span>
                        <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{t.date}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.45 }}>{t.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </PfCard>
          </div>
        )}

        {/* ------------------------------ Performance ------------------------------ */}
        {tab === "Performance" && (
          <>
            <PfCard>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ padding: "16px 22px" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 4 }}>Performance score</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px" }}>{EMP.perf}</span>
                    <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>/100</span>
                    <span style={{ marginLeft: 6 }}><PfBadge tone="green">Top 10% · Engineering</PfBadge></span>
                  </div>
                  <div style={{ marginTop: 8 }}><PfSegments score={EMP.perf / 20} /></div>
                </div>
                <div style={{ padding: "16px 22px", borderLeft: "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 6 }}>Rating trend since hire</div>
                  <svg width={136} height={34} viewBox="0 0 136 34">
                    <polyline points={sparkPts} fill="none" stroke="var(--pf-primary-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx={132} cy={30 - ((SPARK[SPARK.length - 1] - 3.9) / 0.75) * 24} r={3} fill="var(--pf-primary-500)" />
                  </svg>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>4.0 at hire → 4.55 now</div>
                </div>
                <div style={{ padding: "16px 22px", borderLeft: "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 4 }}>Quality of hire (Stage 11)</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)" }}>{EMP.qoh ?? 4.6}</span>
                    <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>/5</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4 }}>Predicted 4.4 → actual {EMP.qoh ?? 4.6} — fed back to sourcing models</div>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Competencies" sub="Same 5-point taxonomy used at hiring — the grey tick is her Stage-6 interview score" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 26px", padding: "16px 20px 18px" }}>
                {COMPETENCIES.map((c) => <CompBar key={c.name} {...c} />)}
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Review history" sub="Calibrated cycles on this record" />
              <div style={{ padding: "10px 20px 6px", display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 10 }}>
                <PfTh>Cycle</PfTh><PfTh>Rating</PfTh><PfTh>Goal attainment</PfTh><PfTh style={{ textAlign: "right" }}>Recommendation</PfTh>
              </div>
              {REVIEWS.map((r, i) => (
                <div key={r.cycle} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 10, alignItems: "center", padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", background: r.current ? "var(--pf-n25)" : "transparent", borderRadius: i === REVIEWS.length - 1 ? "0 0 12px 12px" : 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.cycle}{r.current && <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n400)" }}> · current</span>}</span>
                  <span style={{ fontSize: 13, color: "var(--pf-n600)" }}>{r.rating}</span>
                  <span style={{ fontSize: 13, color: "var(--pf-n600)" }}>{r.attain}</span>
                  <span style={{ textAlign: "right" }}><PfBadge tone={r.recTone}>{r.rec}</PfBadge></span>
                </div>
              ))}
            </PfCard>
          </>
        )}

        {/* ------------------------------ Goals & OKR ------------------------------ */}
        {tab === "Goals & OKR" && (
          <>
            {EMP_OKRS.map((o) => (
              <PfCard key={o.obj}>
                <PfCardHead title={o.obj} sub="Q3 2026 · Individual OKR · rolls up to the Engineering objective">
                  <PfBadge tone={o.tone} dot>{o.status}</PfBadge>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>{o.progress}%</span>
                </PfCardHead>
                <div style={{ padding: "14px 20px 16px" }}>
                  <PfProgress pct={o.progress} tone={o.tone} />
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    {o.krs.map((k) => (
                      <div key={k.kr} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Ic name="target" size={15} color="var(--pf-n300)" />
                        <span style={{ flex: 1, fontSize: 13, color: "var(--pf-n600)" }}>{k.kr}</span>
                        <div style={{ width: 160 }}><PfProgress pct={k.p} tone={k.p >= 60 ? "green" : "yellow"} height={6} /></div>
                        <span style={{ width: 36, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{k.p}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PfCard>
            ))}
            <PfBanner icon="target" cta="Open Goals & OKR" onCta={() => go("goals")}>
              The behind OKR is the mentoring goal — it also gates her Staff-track milestone (see Growth plan).
            </PfBanner>
          </>
        )}

        {/* -------------------------------- Feedback -------------------------------- */}
        {tab === "Feedback" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>Competency-tagged feedback on the unified taxonomy · visible to Amara + manager</span>
              <PfBtn icon="plus" small onClick={() => toast("Feedback request sent to 3 peers — competency-tagged form", "success")}>Request feedback</PfBtn>
            </div>
            {FEEDBACK.map((f) => (
              <PfCard key={f.from} pad="14px 18px">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfAvatar init={f.init} tone={f.avTone} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{f.from}</span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}> · {f.rel} · {f.when}</span>
                  </div>
                  <PfBadge tone="blue">{f.tag}</PfBadge>
                  <PfBadge tone={f.kindTone}>{f.kind}</PfBadge>
                </div>
                <div style={{ fontSize: 13.5, color: "var(--pf-n600)", lineHeight: 1.55, marginTop: 9 }}>{f.text}</div>
              </PfCard>
            ))}
          </>
        )}

        {/* -------------------------------- 1-on-1s -------------------------------- */}
        {tab === "1-on-1s" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="Next 1-on-1" sub="With Ngozi Adeyemi · weekly recurring">
                <PfBadge tone="green" dot>Today</PfBadge>
              </PfCardHead>
              <div style={{ padding: "14px 20px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <PfTile icon="clock" tone="green" size={32} />
                  <span style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)" }}>{MEET.time}</span>
                </div>
                <div style={{ margin: "14px 0 4px" }}>{label("Agenda")}</div>
                {MEET.agenda.map((a) => (
                  <div key={a} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, color: "var(--pf-n600)", marginBottom: 6 }}>
                    <Ic name="caretright" size={12} color="var(--pf-primary-600)" />{a}
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  <PfBtn full icon="chat" onClick={() => go("oneonones")}>Open in 1-on-1s</PfBtn>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Last 1-on-1 · Jul 1 · 32 min" sub="AI summary + action items — human-approved notes" />
              <div style={{ padding: "14px 20px 16px" }}>
                {MEET.aiSummary && (
                  <PfBanner icon="sparkle"><b>AI summary · </b>{MEET.aiSummary}</PfBanner>
                )}
                <div style={{ margin: "14px 0 6px" }}>{label("Action items (2)")}</div>
                {actions.map((a, i) => (
                  <div key={a.item} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < actions.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                    <button onClick={() => toggleAction(i)} title={a.done ? "Reopen" : "Mark done"} style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${a.done ? "var(--pf-primary-500)" : "var(--pf-n300)"}`, background: a.done ? "var(--pf-primary-500)" : "var(--pf-n0)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", padding: 0 }}>
                      {a.done && <Ic name="check" size={12} color="#fff" weight={2.4} />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: a.done ? "var(--pf-n400)" : "var(--pf-n900)", textDecoration: a.done ? "line-through" : "none" }}>{a.item}</div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Owner {a.owner}</div>
                    </div>
                    {a.done ? <PfBadge tone="green">Done</PfBadge> : a.overdue ? <PfBadge tone="red">Overdue · was due {a.due}</PfBadge> : <PfBadge tone="grey">Due {a.due}</PfBadge>}
                  </div>
                ))}
              </div>
            </PfCard>
          </div>
        )}

        {/* ------------------------------- Growth plan ------------------------------- */}
        {tab === "Growth plan" && (
          <>
            <PfCard>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
                <PfTile icon="trend" tone="green" size={36} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--pf-n900)" }}>Target role · {MATCH.role}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>{MATCH.risk ?? "Internal mobility match"} · sourced from the Mobility engine</div>
                </div>
                <PfBadge tone="green">{MATCH.match}% match</PfBadge>
                <PfBadge tone="blue">Est. time-to-ready · 2 quarters</PfBadge>
                <PfBtn icon="arrowright" onClick={() => go("growth")}>Open growth plan</PfBtn>
              </div>
            </PfCard>

            <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12, alignItems: "start" }}>
              <PfCard>
                <PfCardHead title="Gap to target" sub="Dark tick = Staff-level bar · 2 dimensions short" />
                <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 20px 18px" }}>
                  {MATCH.dims.map(([d, s]) => <GapBar key={d} name={d} score={s} target={GAP_TARGETS[d] ?? 90} />)}
                </div>
              </PfCard>

              <PfCard>
                <PfCardHead title="Milestones" sub="1 of 3 complete" />
                <div style={{ padding: "6px 0 8px" }}>
                  {MILESTONES.map((m, i) => {
                    const st = MS_STYLE[m.state];
                    return (
                      <div key={m.m} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 20px", borderBottom: i < MILESTONES.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                        <PfTile icon={st.icon} tone={st.tone} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{m.m}</div>
                          <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>{m.when}</div>
                        </div>
                        <PfBadge tone={st.tone}>{st.badge}</PfBadge>
                      </div>
                    );
                  })}
                </div>
              </PfCard>
            </div>
          </>
        )}

        {/* --------------------------------- Contract --------------------------------- */}
        {tab === "Contract" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="Terms" sub="Permanent · since Nov 2023" />
              <div style={{ paddingBottom: 4 }}>
                <Row k="Contract type" v="Permanent" />
                <Row k="Start date" v="Nov 6, 2023" />
                <Row k="Probation" v="Completed · Feb 2024" />
                <Row k="Notice period" v="1 month" />
                <Row k="Work mode" v="Hybrid · Lagos HQ" />
                <Row k="Comp band" v={<PfBadge tone="red">L5 · 12% below band median — flag</PfBadge>} />
              </div>
              <button onClick={() => go("retention")} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "10px 20px 14px", fontSize: 12.5, fontWeight: 500, color: "var(--pf-primary-600)" }}>
                Adjustment case drafted in retention playbook PB-31 <Ic name="arrowright" size={13} />
              </button>
            </PfCard>

            <PfCard>
              <PfCardHead title="Documents vault" sub="Access audit-logged · NDPR retention schedule" />
              <div>
                {DOCS.map((d, i) => (
                  <DocRow key={d.name} {...d} last={i === DOCS.length - 1}
                    onDownload={() => toast(`${d.name} — download started · NDPR retention schedule applies`)} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "10px 20px 13px", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
                <span style={{ flex: "none", display: "inline-flex", marginTop: 2 }}>
                  <Ic name="shield" size={14} color="var(--pf-n400)" />
                </span>
                <span style={{ flex: 1, lineHeight: 1.55 }}>
                  {CONSENT.ndprNote}
                  <span style={{ display: "block", color: "var(--pf-n300)", marginTop: 3 }}>{CONSENT.retention}</span>
                </span>
              </div>
            </PfCard>
          </div>
        )}

      </div>
    </div>
  );
}
