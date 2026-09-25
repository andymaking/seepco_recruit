"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo, useApp } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { useHover } from "@/lib/useHover";
import { CANDIDATES } from "@/data/people";
import { SANDBOX_ROLE, SEED_BACKLOG, TTV_TARGETS, toolMoment } from "@/data/recruiterOnboarding";

const SLACK_MOMENT = toolMoment("slack");

/**
 * The overnight run's own numbers. `sub` carries the target the figure is
 * being judged against — the number was always right here, the frame was
 * missing: 31h from import is comfortably inside the 48h promise.
 */
const stats = [
  { label: "Applicants", value: String(SANDBOX_ROLE.applicants), sub: "screened overnight", bg: "#fff", border: "1px solid var(--border)", labelColor: "var(--ink2)", labelWeight: 600, valColor: undefined as string | undefined },
  { label: "AI shortlisted", value: String(SANDBOX_ROLE.shortlisted), sub: "ranked & explained", bg: "#F7EEFC", border: "1px solid var(--aibd)", labelColor: "#AF52DE", labelWeight: 700, valColor: "#AF52DE" },
  { label: "Knockout-rejected", value: String(SANDBOX_ROLE.knockedOut), sub: "each with a cited reason", bg: "#fff", border: "1px solid var(--border)", labelColor: "var(--ink2)", labelWeight: 600, valColor: undefined },
  { label: "Time-to-shortlist", value: `${SEED_BACKLOG.timeToShortlistHours ?? 31}h`, sub: `target ≤ ${TTV_TARGETS.firstShortlistHours}h from import`, bg: "#fff", border: "1px solid var(--border)", labelColor: "var(--ink2)", labelWeight: 600, valColor: undefined },
];

function CandRow({ i, onClick }: { i: number; onClick: () => void }) {
  const { selCand } = useApp();
  const { hovered, hoverProps } = useHover();
  const c = CANDIDATES[i];
  const sel = i === selCand;
  const rankColor = i === 0 ? "#AF52DE" : i < 3 ? "#16B364" : "#64748B";
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 13px",
        borderRadius: 11,
        cursor: "pointer",
        border: `1px solid ${sel ? "#EFDDF8" : "transparent"}`,
        background: sel ? "#F7EEFC" : hovered ? "#F7EEFC" : "transparent",
      }}
    >
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, width: 20, color: rankColor }}>{i + 1}</div>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 13, flex: "none" }}>{c.init}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)" }}>{c.loc} · {c.yrs} · {c.src}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700, color: c.tone }}>{c.score}</div>
        <div style={{ fontSize: 9.5, fontWeight: 600, color: "var(--ink3)", letterSpacing: ".3px" }}>ROLE-FIT</div>
      </div>
    </div>
  );
}

/**
 * IN-FLOW SLACK CONNECT, at the exact moment it means something: the shortlist
 * the overnight run produced is on screen and the recruiter had to come here to
 * find it. The sentence is TOOL_MOMENTS', so /integrations quotes it identically.
 */
function SlackPrompt() {
  const { isConnected, connect } = useWorkspace();
  const toast = useToast();
  if (!SLACK_MOMENT) return null;

  if (isConnected("slack")) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12, fontWeight: 600, color: "#129152" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16B364" }} />
        Slack connected — the next run posts to #hiring at {SEED_BACKLOG.screenedAt ?? "04:12"}, reasons attached
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, color: "var(--ink3)" }}>
        Get this in Slack — {SLACK_MOMENT.unlocks.toLowerCase()}. {SLACK_MOMENT.proof}.
      </span>
      <button
        onClick={() => { connect("slack"); toast(`Slack connected — ${SLACK_MOMENT.proof}`, "success"); }}
        style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#16B364", background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        Connect Slack →
      </button>
    </div>
  );
}

export default function Screening() {
  const go = useGo();
  const toast = useToast();
  const { selCand, setSelCand } = useApp();
  const [tab, setTab] = useState("shortlist");

  const sel = CANDIDATES[selCand] || CANDIDATES[0];
  const selDims = sel.dims.map((d) => ({
    label: d[0],
    val: d[1],
    barColor: d[1] >= 88 ? "#16B364" : d[1] >= 80 ? "#16B364" : "#EBA308",
  }));

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1180 }}>
      {/* Stage header — stays above the section-tab bar */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#AF52DE", marginBottom: 5 }}>STAGE 04 · SCREENING</div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Senior Product Designer · shortlist</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>Ranked by explainable role-fit score · screened overnight against the stage-02 rubric</div>
          <SlackPrompt />
        </div>
        <button onClick={() => go("assessment")} style={{ background: "var(--ink)", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 15px", borderRadius: 8, cursor: "pointer" }}>Advance to assessment →</button>
      </div>

      {/* Section tabs — shortlist↔detail is one coupled surface, kept together */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "shortlist", label: "Ranked shortlist", count: "12" },
            { key: "knockouts", label: "Knockouts & fairness", count: "9" },
          ]}
        />
      </div>

      {/* RANKED SHORTLIST — list + candidate detail, coupled */}
      {tab === "shortlist" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: 16, alignItems: "start" }}>
          {/* ranked list */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
            <div style={{ padding: "10px 12px 9px", fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)" }}>RANKED SHORTLIST · TOP 6 OF 12</div>
            {CANDIDATES.map((c, i) => (
              <CandRow key={c.name} i={i} onClick={() => setSelCand(i)} />
            ))}
            <div style={{ padding: "11px 13px", marginTop: 4, borderTop: "1px solid var(--border2)", fontSize: 12, color: "var(--ink3)", fontWeight: 600, textAlign: "center" }}>+ 6 more shortlisted · 9 knockout-rejected with cited reasons</div>
          </div>

          {/* detail */}
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: sel.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, flex: "none" }}>{sel.init}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-.3px" }}>{sel.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{sel.loc} · {sel.yrs} experience · sourced via {sel.src}</div>
              </div>
              <div style={{ textAlign: "center", padding: "8px 14px", borderRadius: 12, background: "#F7EEFC", border: "1px solid var(--aibd)" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 26, fontWeight: 700, color: "#AF52DE", lineHeight: 1 }}>{sel.score}</div>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#AF52DE", letterSpacing: ".4px" }}>ROLE-FIT / 100</div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".5px", color: "var(--ink3)", marginBottom: 11 }}>PER-DIMENSION BREAKDOWN</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 20 }}>
              {selDims.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 118, fontSize: 12.5, fontWeight: 600, color: "var(--ink2)" }}>{d.label}</div>
                  <div style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--border2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 5, width: `${d.val}%`, background: d.barColor }} />
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600, width: 30, textAlign: "right" }}>{d.val}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 11, padding: "13px 14px", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><span style={{ color: "#AF52DE" }}>✦</span><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "#AF52DE" }}>WHY THIS RANKING — EXPLAINABILITY</span></div>
              <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.55 }}>{sel.why}</div>
            </div>

            <div style={{ background: "#FBFCFD", border: "1px solid var(--border)", borderRadius: 11, padding: "13px 14px", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><span>◉</span><span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".5px", color: "var(--ink3)" }}>ASYNC VOICE SCREEN · 5 MIN · TRANSCRIBED</span></div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.55 }}>{sel.voice}</div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => go("assessment")} style={{ flex: 1, background: "#AF52DE", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: 11, borderRadius: 10, cursor: "pointer" }}>Advance to assessment</button>
              <button onClick={() => toast("Candidate rejected — reason logged", "danger")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "11px 16px", borderRadius: 10, cursor: "pointer" }}>Reject with reason</button>
            </div>
          </div>
        </div>
      )}

      {/* KNOCKOUTS & FAIRNESS — the screening funnel and its audit trail */}
      {tab === "knockouts" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 11, marginBottom: 16 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: s.bg, border: s.border, borderRadius: 11, padding: "12px 14px" }}>
                <div style={{ fontSize: 11.5, color: s.labelColor, fontWeight: s.labelWeight }}>{s.label}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700, color: s.valColor }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: "var(--ink3)", marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
            <div style={{ background: "#ECF9F3", border: "1px solid #B7EBD1", borderRadius: 11, padding: "12px 14px" }}>
              <div style={{ fontSize: 11.5, color: "#16B364", fontWeight: 600 }}>Fairness audit</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#16B364", marginTop: 4 }}>Passed ✓</div>
            </div>
          </div>
          <div style={{ maxWidth: 720, background: "#fff", border: "1px solid var(--border)", borderRadius: 11, padding: "13px 16px", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.55 }}>
            <b style={{ color: "var(--ink)" }}>Nothing is silently dropped.</b> All 9 knockout rejections carry a cited reason and a right-to-explanation, and the fairness audit passed before this shortlist was released.
          </div>
        </>
      )}
    </div>
  );
}
