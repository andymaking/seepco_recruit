"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useHover } from "@/lib/useHover";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfStat, PfPageTabs, PfTh, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

const dashStats = [
  { icon: "file", tone: "green" as PfTone, label: "Open roles", value: "8", delta: "+2", deltaTone: "green" as PfTone, sub: "2 opened this week" },
  { icon: "users", tone: "blue" as PfTone, label: "Active candidates", value: "214", delta: "+47", deltaTone: "green" as PfTone, sub: "across all stages" },
  { icon: "calendar", tone: "purple" as PfTone, label: "Interviews this week", value: "12", delta: "4 waiting", deltaTone: "yellow" as PfTone, sub: "4 awaiting feedback" },
  { icon: "clock", tone: "yellow" as PfTone, label: "Avg time-to-hire", value: "19d", delta: "−2d", deltaTone: "green" as PfTone, sub: "target ≤21 days" },
];

const funnelDefs = [
  { num: "01", count: 3, go: "planning" }, { num: "02", count: 1, go: "role" },
  { num: "03", count: 128, go: "sourcing" }, { num: "04", count: 47, go: "screening" },
  { num: "05", count: 12, go: "assessment" }, { num: "06", count: 6, go: "interview" },
  { num: "07", count: 3, go: "selection" }, { num: "08", count: 2, go: "reference" },
  { num: "09", count: 1, go: "offer" }, { num: "10", count: 1, go: "onboarding" },
  { num: "11", count: 4, go: "posthire" },
];
const maxF = 128;

const reqs = [
  { role: "Senior Product Designer", dept: "Product", loc: "Lagos · Hybrid", stageLabel: "Screening", tone: "purple" as PfTone, cands: "47", age: "4d", ai: "12 shortlisted", go: "screening" },
  { role: "Backend Engineer (Payments)", dept: "Engineering", loc: "Remote", stageLabel: "Sourcing", tone: "blue" as PfTone, cands: "31", age: "14d", ai: "Yield below target", go: "sourcing" },
  { role: "Growth Marketing Lead", dept: "Marketing", loc: "Lagos", stageLabel: "Interview", tone: "red" as PfTone, cands: "6", age: "9d", ai: "2 panels today", go: "interview" },
  { role: "Finance Analyst", dept: "Finance", loc: "Lagos", stageLabel: "Offer", tone: "green" as PfTone, cands: "1", age: "22d", ai: "79% accept odds", go: "offer" },
  { role: "People Ops Manager", dept: "People", loc: "Hybrid", stageLabel: "Role Def", tone: "grey" as PfTone, cands: "—", age: "1d", ai: "JD drafted", go: "role" },
];

function FunnelBar({ f, i, onClick }: { f: typeof funnelDefs[number]; i: number; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const h = 18 + Math.round(82 * Math.sqrt(f.count / maxF));
  const bg = i === 3 ? "var(--pf-purple-500)" : i < 3 ? "var(--pf-primary-500)" : "var(--pf-n100)";
  return (
    <div {...hoverProps} onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", height: "100%", justifyContent: "flex-end", opacity: hovered ? 0.82 : 1 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{f.count}</div>
      <div style={{ width: "100%", borderRadius: "6px 6px 3px 3px", height: h, background: bg }} />
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 600, color: "var(--pf-n300)" }}>{f.num}</div>
    </div>
  );
}

function ReqRow({ r, onClick }: { r: typeof reqs[number]; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.1fr 1fr 1.3fr", padding: "13px 20px", alignItems: "center", borderBottom: "1px solid var(--pf-n50)", cursor: "pointer", background: hovered ? "var(--pf-n25)" : undefined }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--pf-n900)" }}>{r.role}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{r.dept} · {r.loc}</div>
      </div>
      <div><PfBadge tone={r.tone}>{r.stageLabel}</PfBadge></div>
      <div style={{ fontFamily: "var(--mono)", fontWeight: 500, fontSize: 13, color: "var(--pf-n900)" }}>{r.cands}</div>
      <div style={{ fontSize: 13, color: "var(--pf-n500)", fontWeight: 500 }}>{r.age}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "var(--pf-purple-500)" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-purple-500)" }} />{r.ai}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const go = useGo();
  const [tab, setTab] = useState("overview");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100, fontFamily: "var(--pf-font)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 3 }}>Tuesday, 21 June · Good morning</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Recruitment overview</h1>
        </div>
        <PfBtn variant="primary" icon="plus" onClick={() => go("requisitions")}>New requisition</PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "pipeline", label: "Pipeline" },
            { key: "requisitions", label: "Requisitions", count: "8" },
          ]}
        />
      </div>

      {/* OVERVIEW — KPIs + overnight AI screening */}
      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
            {dashStats.map((s) => (
              <PfStat key={s.label} icon={s.icon} tone={s.tone} label={s.label} value={s.value} unit={s.sub} delta={s.delta} deltaTone={s.deltaTone} />
            ))}
          </div>

          {/* Overnight AI screening — kit-style soft purple notice card */}
          <PfCard style={{ borderColor: "var(--pf-purple-100)", background: "var(--pf-purple-50)" }} pad={"16px 18px"}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Ic name="sparkle" size={19} color="var(--pf-purple-500)" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-purple-500)", marginBottom: 3 }}>OVERNIGHT AI SCREENING · 04:12</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--pf-n900)", lineHeight: 1.45 }}>
                  Screened <b>47 applicants</b> for Senior Product Designer — surfaced <b>12 strong shortlist matches</b> with explainable role-fit scores.
                </div>
              </div>
              <PfBtn variant="primary" tone="var(--pf-purple-500)" onClick={() => go("screening")}>Review shortlist →</PfBtn>
            </div>
          </PfCard>
        </>
      )}

      {/* PIPELINE — lifecycle funnel */}
      {tab === "pipeline" && (
        <PfCard>
          <PfCardHead title="Lifecycle pipeline" sub="All active candidates across 11 stages" />
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, padding: "16px 20px 14px" }}>
            {funnelDefs.map((f, i) => <FunnelBar key={f.num} f={f} i={i} onClick={() => go(f.go)} />)}
          </div>
        </PfCard>
      )}

      {/* REQUISITIONS — open requisitions table */}
      {tab === "requisitions" && (
        <PfCard>
          <PfCardHead title="Open requisitions" sub="5 of 8 shown — sorted by AI attention">
            <PfBtn icon="caretright" onClick={() => go("jobs")}>View all 8</PfBtn>
          </PfCardHead>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 1.1fr 1fr 1.3fr", padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
            <PfTh>Role</PfTh><PfTh>Stage</PfTh><PfTh>Candidates</PfTh><PfTh>Age</PfTh><PfTh>AI status</PfTh>
          </div>
          {reqs.map((r) => <ReqRow key={r.role} r={r} onClick={() => go(r.go)} />)}
        </PfCard>
      )}
    </div>
  );
}
