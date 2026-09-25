"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { useHover } from "@/lib/useHover";
import { ACTIVATION_CLOCK, nextChecklistStep, ttvMetrics, type TtvMetric } from "@/data/recruiterOnboarding";

const analyticsKpis = [
  { label: "Time to Hire", value: "18 days", delta: "−6 days", up: false, down: true },
  { label: "Offer Accept Rate", value: "84%", delta: "+9%", up: true, down: false },
  { label: "AI Screen Accuracy", value: "92%", delta: "+3%", up: true, down: false },
  { label: "Cost per Hire", value: "₦142k", delta: "−18%", up: false, down: true },
];

const aiBars = (() => {
  const d = [
    { m: "Jan", v: 120 }, { m: "Feb", v: 165 }, { m: "Mar", v: 210 },
    { m: "Apr", v: 240 }, { m: "May", v: 310 }, { m: "Jun", v: 380 },
  ];
  const mx = 380;
  return d.map((b, i) => ({ ...b, h: Math.round((b.v / mx) * 150), color: i === d.length - 1 ? "#16B364" : "#C9EEDC" }));
})();

const totalScreened = aiBars.reduce((s, b) => s + b.v, 0);

const funnel = [
  { label: "Applied", count: "47", pct: "100%", color: "#B7EBD1" },
  { label: "AI Screened", count: "47", pct: "100%", color: "#AF52DE" },
  { label: "Shortlisted", count: "12", pct: "30%", color: "#57CB92" },
  { label: "Interviewed", count: "5", pct: "15%", color: "#16B364" },
  { label: "Offer", count: "1", pct: "7%", color: "#16B364" },
];

const ranges = [
  { id: "6m", label: "6 months", sub: "Last 6 months · all open roles" },
  { id: "12m", label: "12 months", sub: "Last 12 months · all open roles" },
  { id: "ytd", label: "YTD", sub: "Year to date · all open roles" },
] as const;

function ExportButton({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 7, background: hovered ? "#020617" : "var(--ink)", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: "10px 16px", borderRadius: 8, cursor: "pointer" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 19h16" /></svg>
      Export
    </button>
  );
}

function RangeTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "6px 13px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (active ? "var(--ink)" : "var(--border)"), background: active ? "var(--ink)" : hovered ? "#F8FAFC" : "#fff", color: active ? "#fff" : "var(--ink2)" }}
    >
      {label}
    </button>
  );
}

/**
 * THE ACTIVATION CLOCK, MEASURED. Analytics is the only page in the app framed
 * as measurement, so the two promises the onboarding makes — first role live in
 * ~15 minutes, first ranked shortlist inside 48 hours — are held to account
 * here rather than on a new metrics screen. Every figure is derived from the
 * REAL doneAt stamps the checklist writes; each metric carries its own target,
 * so nothing is hardcoded at this call site.
 */
function ActivationBlock() {
  const { doneAt, lastImport, seats } = useWorkspace();
  const go = useGo();
  const metrics: TtvMetric[] = ttvMetrics(doneAt, lastImport, seats);
  const next = nextChecklistStep(new Set(Object.keys(doneAt)));
  const hits = metrics.filter((m) => m.hit).length;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, marginBottom: 11, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)" }}>ACTIVATION · TIME TO VALUE</div>
          <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 3 }}>{ACTIVATION_CLOCK} · {hits} of {metrics.length} targets met</div>
        </div>
        {next && (
          <button
            onClick={() => go(next.go)}
            style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "#16B364", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Next: {next.label} →
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
        {metrics.map((m) => (
          <div key={m.key} style={{ background: "#fff", border: `1px solid ${m.hit ? "#B7EBD1" : "var(--border)"}`, borderRadius: 12, padding: "15px 16px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 8, lineHeight: 1.3 }}>{m.label}</div>
            {/* ttvMetrics owns the string; a long one steps down rather than wrapping to three lines. */}
            <div style={{ fontFamily: "var(--mono)", fontSize: m.value.length > 12 ? 15 : 21, fontWeight: 700, letterSpacing: "-.4px", lineHeight: 1.15, color: "var(--ink)" }}>{m.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".3px", color: m.hit ? "#129152" : "#EBA308", background: m.hit ? "#ECF9F3" : "#FEF7E6", padding: "3px 8px", borderRadius: 5 }}>
                {m.hit ? "ON TARGET" : "BEHIND"}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink3)" }}>{m.target}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink3)", lineHeight: 1.45, marginTop: 9, flex: 1 }}>{m.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const toast = useToast();
  const [range, setRange] = useState<typeof ranges[number]["id"]>("6m");
  const [tab, setTab] = useState("overview");
  const sub = ranges.find((r) => r.id === range)!.sub;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <h1 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Hiring analytics</h1>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#AF52DE", background: "#F7EEFC", padding: "4px 11px", borderRadius: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#AF52DE"><circle cx="6" cy="6" r="2.3" /><circle cx="13" cy="5" r="2.3" /><circle cx="6.5" cy="13" r="2.3" /><rect x="11" y="11" width="9" height="3.6" rx="1.8" /><rect x="11" y="16.5" width="6" height="3.4" rx="1.7" /></svg>
            AI Insights
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {ranges.map((r) => <RangeTab key={r.id} active={range === r.id} label={r.label} onClick={() => setRange(r.id)} />)}
          </div>
          <ExportButton onClick={() => toast("Report exported as CSV")} />
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 20 }}>{sub}</div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "overview", label: "Overview" },
            { key: "screening", label: "AI screening", count: totalScreened.toLocaleString("en-US") },
            { key: "funnel", label: "Pipeline funnel", count: funnel[0].count },
          ]}
        />
      </div>

      {/* OVERVIEW — the activation clock, then the hiring KPIs */}
      {tab === "overview" && (
        <>
          <ActivationBlock />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
            {analyticsKpis.map((k) => (
              <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 10 }}>{k.label}</div>
                <div style={{ fontSize: 27, fontWeight: 700, letterSpacing: "-.7px", lineHeight: 1 }}>{k.value}</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 9, fontSize: 12, fontWeight: 600, color: "#129152", background: "#ECF9F3", padding: "3px 9px", borderRadius: 5 }}>
                  {k.up && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#129152" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>}
                  {k.down && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#129152" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7l10 10M17 9v8H9" /></svg>}
                  {k.delta}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#AF52DE", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flex: "none" }}>✦</span>
            <div style={{ fontSize: 13.5, color: "#8A3BBD", lineHeight: 1.55 }}><b style={{ color: "#7A2FA8" }}>AI insight:</b> Your shortlist-to-offer conversion is <b>22% above benchmark</b>. Roles with AI-generated scorecards are filling <b>31% faster</b> than those without.</div>
          </div>
        </>
      )}

      {/* AI SCREENING — monthly screening volume */}
      {tab === "screening" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Candidates screened by AI</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)", fontFamily: "var(--mono)" }}>LAST 6 MONTHS</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 170, padding: "0 4px" }}>
            {aiBars.map((b) => (
              <div key={b.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>{b.v}</div>
                <div style={{ width: "100%", maxWidth: 42, height: b.h, borderRadius: "6px 6px 0 0", background: b.color }} />
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink3)" }}>{b.m}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PIPELINE FUNNEL — stage conversion */}
      {tab === "funnel" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Pipeline funnel</div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>Senior Product Designer</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {funnel.map((f) => (
              <div key={f.label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink2)" }}>{f.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 700 }}>{f.count}</span>
                </div>
                <div style={{ height: 12, borderRadius: 6, background: "#F1F5F9", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 6, width: f.pct, background: f.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
