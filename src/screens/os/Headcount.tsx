"use client";
import { useState, type ReactNode } from "react";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfStat, PfAvatar, PfPageTabs, PfTh, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { DEPARTMENTS, type Department } from "@/data/talentos";

/* ------------------------------ Derived data ------------------------------ */

const TOTAL = DEPARTMENTS.reduce((s, d) => s + d.headcount, 0); // 358

const byName = new Map(DEPARTMENTS.map((d) => [d.name, d]));

/** Slice-and-dice treemap: column weight = group sum, tile weight = headcount. */
const TREEMAP_COLS: string[][] = [
  ["Field Operations", "Engineering"],
  ["Commercial", "Product & Design", "Drilling Support"],
  ["HSE & Compliance", "Finance", "People / HR"],
];

/** Dept identity colors (pf palette only) — reused by treemap dots + location stacks. */
const DEPT_COLOR: Record<string, string> = {
  "Field Operations": "#16B364",
  Engineering: "#007AFF",
  "Product & Design": "#AF52DE",
  Commercial: "#EBA308",
  "HSE & Compliance": "#E81E17",
  "Drilling Support": "#334155",
  Finance: "#64748B",
  "People / HR": "#94A3B8",
};

/** Depts whose 6-month shift the AI flagged as notable (FR-053). */
const NOTABLE = new Set(["Field Operations", "Drilling Support", "Engineering"]);

/** One plausible plain-language AI annotation per department, with evidence. */
const ANNOT: Record<string, { note: string; ev: string; conf: "High" | "Medium" }> = {
  "Field Operations": { note: "Grew +6 against plan — contractor conversions ahead of the NCDMB quota review. Watch: this is also the site with the 3.8% turnover spike (AN-104).", ev: "6 conversion contracts · NCDMB filing calendar", conf: "High" },
  Engineering: { note: "8 under plan — two Payments backfills slipped to Q4 after offer declines; the offer-stage pipeline currently covers 3 of the 8 open seats.", ev: "Req ledger · offer-stage pipeline", conf: "High" },
  "Product & Design": { note: "3 under plan — design hiring paused pending the Port Harcourt pod decision (scenario SC-3). Campus pool could cover 2 of 3 seats.", ev: "Scenario SC-3 · campus pool freshness", conf: "Medium" },
  Commercial: { note: "On plan — the Abuja expansion was absorbed with 2 internal transfers instead of net adds; cost held flat at ₦48M.", ev: "Transfer log · payroll ledger", conf: "High" },
  "HSE & Compliance": { note: "3 under plan — NEBOSH-certified candidates remain scarce in-country; 2 offers out, 1 accepted, certification checks pending.", ev: "Cert registry · offer tracker", conf: "Medium" },
  Finance: { note: "On plan — transaction-volume growth was absorbed by reporting automation; no additional requisitions requested this cycle.", ev: "Req ledger · close-cycle metrics", conf: "High" },
  "People / HR": { note: "1 under plan — the HRBP offer was declined over pay band; the requisition has been re-benchmarked against peer market data.", ev: "Offer record · market benchmark set", conf: "High" },
  "Drilling Support": { note: "+5 over plan — the rig-count spike drove agency adds; contractor spend is already flagged +12% for two months (AN-102).", ev: "Agency PO ledger · anomaly AN-102", conf: "High" },
};

/** Per-dept headcount, last 6 months (column sums match ORG_TREND exactly). */
const DEPT_TREND: Record<string, number[]> = {
  "Field Operations": [90, 90, 90, 92, 94, 96],
  "Drilling Support": [24, 24, 24, 26, 28, 29],
  Engineering: [83, 83, 83, 84, 84, 84],
  "Product & Design": [37, 37, 37, 37, 38, 38],
  "HSE & Compliance": [27, 27, 27, 27, 27, 27],
  Commercial: [44, 44, 44, 44, 44, 44],
  Finance: [22, 22, 22, 22, 22, 22],
  "People / HR": [19, 19, 19, 19, 18, 18],
};

/** Org headcount + monthly hires/departures, Feb – Jul 2026 (346 → 358). */
const ORG_TREND = [
  { m: "Feb", hc: 346, hires: 4, dep: 4 },
  { m: "Mar", hc: 346, hires: 6, dep: 6 },
  { m: "Apr", hc: 346, hires: 5, dep: 5 },
  { m: "May", hc: 351, hires: 9, dep: 4 },
  { m: "Jun", hc: 355, hires: 9, dep: 5 },
  { m: "Jul", hc: 358, hires: 8, dep: 5 },
];

const Q_HIRES = ORG_TREND.slice(3).reduce((s, t) => s + t.hires, 0); // 26
const Q_DEPS = ORG_TREND.slice(3).reduce((s, t) => s + t.dep, 0); // 14
const PRIOR_HIRES = ORG_TREND.slice(0, 3).reduce((s, t) => s + t.hires, 0); // 15

type LocRow = {
  name: string; total: number; delta: string; deltaTone: PfTone; sub: string; note: string;
  mix: [string, number][];
};

/** Site split — column sums reconcile with DEPARTMENTS (358 = 214 + 118 + 26). */
const LOCATIONS: LocRow[] = [
  {
    name: "Lagos", total: 214, delta: "+1 this Q", deltaTone: "green", sub: "HQ · Victoria Island & Ikeja",
    note: "Steady — growth here is backfill, not expansion.",
    mix: [["Engineering", 84], ["Product & Design", 38], ["Commercial", 24], ["Finance", 22], ["Field Operations", 20], ["People / HR", 18], ["HSE & Compliance", 5], ["Drilling Support", 3]],
  },
  {
    name: "Port Harcourt", total: 118, delta: "+11 this Q", deltaTone: "yellow", sub: "Field base · Onne & Trans-Amadi",
    note: "Growth concentrated here — both over-plan departments are PH.",
    mix: [["Field Operations", 72], ["Drilling Support", 26], ["HSE & Compliance", 20]],
  },
  {
    name: "Abuja", total: 26, delta: "±0 this Q", deltaTone: "grey", sub: "Commercial & government affairs",
    note: "Staffed by transfer — no net adds this quarter.",
    mix: [["Commercial", 20], ["Field Operations", 4], ["HSE & Compliance", 2]],
  },
];

/** Agency roles eligible for permanent conversion (over-plan depts). */
const CONVERTIBLE: Record<string, number> = { "Field Operations": 12, "Drilling Support": 9 };

const variance = (d: Department) => d.headcount - d.target;
const variancePct = (d: Department) => ((d.headcount - d.target) / d.target) * 100;
const share = (d: Department) => ((d.headcount / TOTAL) * 100).toFixed(1);

function vMeta(d: Department): { tone: PfTone; label: string } {
  const v = variance(d);
  if (v > 0) return { tone: "red", label: `+${v} over` };
  if (v < 0) return { tone: "yellow", label: `−${-v} under` };
  return { tone: "green", label: "On plan" };
}

/* --------------------------------- Bits ---------------------------------- */

/** Variance chip that stays legible on the tinted treemap tiles. */
function VarChip({ d }: { d: Department }) {
  const m = vMeta(d);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: TONE[m.tone].fg, background: "var(--pf-n0)", border: `1px solid ${TONE[m.tone].line}`, padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap", width: "fit-content" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: TONE[m.tone].bg }} />
      {m.label}
    </span>
  );
}

function TmTile({ d, selected, onClick }: { d: Department; selected: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const m = vMeta(d);
  const t = TONE[m.tone];
  const big = d.headcount >= 80 ? 26 : d.headcount >= 38 ? 21 : d.headcount >= 27 ? 18 : 16;
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        flex: `${d.headcount} 1 0%`, minHeight: 0, overflow: "hidden", cursor: "pointer",
        display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 3,
        background: t.soft, borderRadius: 10, padding: "10px 12px",
        border: `1px solid ${selected || hovered ? t.fg : t.line}`,
        boxShadow: selected ? `0 0 0 1px ${t.fg}, 0 8px 18px rgba(2,6,23,.08)` : hovered ? "0 6px 14px rgba(2,6,23,.07)" : "none",
        transform: hovered && !selected ? "translateY(-1px)" : "none",
        transition: "border-color .16s ease, box-shadow .16s ease, transform .16s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: DEPT_COLOR[d.name] ?? "var(--pf-n400)", flex: "none" }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{d.name}</span>
        {NOTABLE.has(d.name) && <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />}
      </div>
      <div style={{ fontSize: big, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1.05 }}>{d.headcount}</div>
      <div style={{ fontSize: 11, color: "var(--pf-n500)" }}>{share(d)}% of org</div>
      <VarChip d={d} />
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--pf-n50)" }}>
      <span style={{ fontSize: 12, color: "var(--pf-n400)", width: 92, flex: "none" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>{children}</span>
    </div>
  );
}

function LegendRow({ name, n, onPick }: { name: string; n: number; onPick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onPick} style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px", margin: "0 -6px", borderRadius: 6, cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: DEPT_COLOR[name] ?? "var(--pf-n400)", flex: "none" }} />
      <span style={{ fontSize: 12, color: "var(--pf-n600)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{n}</span>
    </div>
  );
}

/** Bullet bar — actual fill + dark target tick; shortfall = yellow ticked strip, overshoot = solid red. */
function Bullet({ d }: { d: Department }) {
  const MAX = 100;
  const a = (d.headcount / MAX) * 100;
  const t = (d.target / MAX) * 100;
  const v = variance(d);
  return (
    <div style={{ position: "relative", height: 10, borderRadius: 6, background: "var(--pf-n50)", minWidth: 0 }}>
      {/* actual (to the lower of actual/target) */}
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(a, t)}%`, borderRadius: 6, background: "var(--pf-primary-500)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }} />
      {/* shortfall to target — yellow ticked strip */}
      {v < 0 && (
        <span style={{ position: "absolute", left: `${a}%`, top: 1, bottom: 1, width: `${t - a}%`, background: "repeating-linear-gradient(90deg, var(--pf-yellow-500) 0 2px, transparent 2px 5px)", opacity: 0.75 }} />
      )}
      {/* overshoot past target — solid red */}
      {v > 0 && (
        <span style={{ position: "absolute", left: `${t}%`, top: 0, bottom: 0, width: `${a - t}%`, borderRadius: "0 6px 6px 0", background: "var(--pf-red-500)" }} />
      )}
      {/* target tick */}
      <span style={{ position: "absolute", left: `calc(${t}% - 1px)`, top: -3, width: 2, height: 16, borderRadius: 1, background: "var(--pf-n900)" }} />
    </div>
  );
}

const PLAN_GRID = "1.3fr 1.75fr .42fr .42fr .78fr 1.15fr";

function PlanRow({ d, onPick, onSuggest, onReview, last }: {
  d: Department; onPick: () => void; onSuggest: () => void; onReview: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  const v = variance(d);
  const m = vMeta(d);
  const pct = variancePct(d);
  return (
    <div
      {...hoverProps}
      onClick={onPick}
      style={{ display: "grid", gridTemplateColumns: PLAN_GRID, gap: 12, alignItems: "center", padding: "11px 20px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: DEPT_COLOR[d.name] ?? "var(--pf-n400)", flex: "none" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1, paddingLeft: 13 }}>{d.head}</div>
      </div>
      <Bullet d={d} />
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{d.headcount}</div>
      <div style={{ fontSize: 13, color: "var(--pf-n500)" }}>{d.target}</div>
      <div>
        <PfBadge tone={m.tone} dot>{m.label}</PfBadge>
        <div style={{ fontSize: 11, color: Math.abs(pct) > 5 ? TONE[m.tone].fg : "var(--pf-n400)", fontWeight: Math.abs(pct) > 5 ? 600 : 400, marginTop: 3 }}>
          {pct > 0 ? "+" : ""}{pct.toFixed(1)}%{Math.abs(pct) > 5 ? " · outside target" : ""}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
        {v < 0 && <PfBtn small icon="sparkle" onClick={onSuggest}>Suggest requisition</PfBtn>}
        {v > 0 && <PfBtn small icon="swap" onClick={onReview}>Review contractor mix</PfBtn>}
        {v === 0 && <PfBadge tone="green">No action needed</PfBadge>}
      </div>
    </div>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function Headcount() {
  const go = useGo();
  const toast = useToast();
  const [selName, setSelName] = useState("Field Operations");
  const [hov, setHov] = useState<number | null>(null);
  const [tab, setTab] = useState("explorer");

  const sel = byName.get(selName) ?? DEPARTMENTS[0]!;
  const selAnnot = ANNOT[sel.name] ?? { note: "Tracking to plan — no notable shift detected this quarter.", ev: "HRIS joiners/leavers feed", conf: "Medium" as const };
  const selTrend = DEPT_TREND[sel.name] ?? [];
  const selMin = Math.min(...selTrend);
  const selMax = Math.max(...selTrend);
  const selNet = (selTrend[selTrend.length - 1] ?? 0) - (selTrend[0] ?? 0);
  const outsideCount = DEPARTMENTS.filter((d) => Math.abs(variancePct(d)) > 5).length;

  /* chart scales */
  const HC_MIN = 344, HC_MAX = 360;
  const yPct = (v: number) => 92 - ((v - HC_MIN) / (HC_MAX - HC_MIN)) * 84;
  const xPct = (i: number) => ((i + 0.5) / ORG_TREND.length) * 100;
  const linePts = ORG_TREND.map((t, i) => `${xPct(i)},${yPct(t.hc)}`).join(" ");
  const areaPts = `${xPct(0)},100 ${linePts} ${xPct(ORG_TREND.length - 1)},100`;
  const hovPt = hov !== null ? ORG_TREND[hov] : undefined;

  const requestHiring = (dept?: string) => {
    toast(dept ? `AI-drafted requisition for ${dept} opened in Stage 1 — pay band + JD pre-filled (FR-058)` : "AI-drafted requisition opened in Stage 1 (FR-058 loop)", "ai");
    go("planning");
  };
  const suggest = (d: Department) =>
    toast(`${d.name} — draft requisition with peer-benchmarked business case created (FR-019 forecast)`, "ai");
  const review = (d: Department) =>
    toast(`Contractor-mix review opened for ${d.name} — ${CONVERTIBLE[d.name] ?? 6} agency roles eligible for conversion`);
  const pickFromBelow = (name: string) => {
    setSelName(name);
    setTab("explorer");
    toast(`${name} — department detail opened in the explorer`);
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Headcount</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Explorer + workforce plan — where the organisation is growing, shrinking and drifting from plan.
          </div>
        </div>
        <PfBtn icon="download" onClick={() => toast("Workforce plan exported — CSV + NCDMB composition sheet queued to your email", "success")}>Export plan</PfBtn>
        <PfBtn variant="primary" icon="sparkle" onClick={() => requestHiring()}>New requisition</PfBtn>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginTop: 16 }}>
        <PfStat icon="users" tone="green" label="Headcount" value={String(TOTAL)} unit="employees" delta="+12" deltaTone="green" />
        <PfStat icon="arrowup" tone="blue" label="Hires this quarter" value={String(Q_HIRES)} unit="May – Jul" delta={`+${Q_HIRES - PRIOR_HIRES} vs prior`} deltaTone="green" />
        <PfStat icon="door" tone="red" label="Departures" value={String(Q_DEPS)} unit="May – Jul" delta="9 in PH" deltaTone="red" />
        <PfStat icon="trend" tone="purple" label="Net movement" value={`+${Q_HIRES - Q_DEPS}`} unit="hires − departures" delta="+3.5% QoQ" deltaTone="green" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 11.5, color: "var(--pf-n400)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pf-primary-500)", flex: "none" }} />
        Workforce plan v3 (approved May 2026) · headcount synced from SeamlessHR 12m ago
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "explorer", label: "By department", count: String(DEPARTMENTS.length) },
            { key: "locations", label: "Locations", count: String(LOCATIONS.length) },
            { key: "growth", label: "Growth trend" },
            { key: "plan", label: "Workforce plan", count: String(outsideCount) },
          ]}
        />
      </div>

      {/* BY DEPARTMENT — treemap + detail */}
      {tab === "explorer" && (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 352px", gap: 12, alignItems: "start" }}>
        <PfCard>
          <PfCardHead title="Headcount by department" sub="Tile area = share of the 358-person org · click a tile to inspect (FR-053)">
            <PfBadge tone="purple" dot>3 AI-annotated shifts</PfBadge>
          </PfCardHead>
          <div style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 6, height: 356 }}>
              {TREEMAP_COLS.map((names, ci) => {
                const depts = names.map((n) => byName.get(n)).filter((d): d is Department => Boolean(d));
                const weight = depts.reduce((s, d) => s + d.headcount, 0);
                return (
                  <div key={ci} style={{ flex: `${weight} 1 0%`, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                    {depts.map((d) => (
                      <TmTile key={d.name} d={d} selected={selName === d.name} onClick={() => setSelName(d.name)} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
            <PfBadge tone="red" dot>over plan</PfBadge>
            <PfBadge tone="yellow" dot>under plan</PfBadge>
            <PfBadge tone="green" dot>on plan</PfBadge>
            <span style={{ flex: 1 }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n400)" }}>
              <Ic name="sparkle" size={12} color="var(--pf-purple-500)" /> = notable shift, annotated in the detail panel
            </span>
          </div>
        </PfCard>

        {/* Detail side card */}
        <PfCard style={{ position: "sticky", top: 16 }}>
          <PfCardHead title={sel.name} sub={`${share(sel)}% of org · ${sel.loc}`}>
            <PfBadge tone={vMeta(sel).tone} dot>{vMeta(sel).label}</PfBadge>
          </PfCardHead>
          <div style={{ padding: "6px 16px 16px" }}>
            <DetailRow label="Head">
              <PfAvatar init={sel.head.split(" ").map((w) => w[0]).join("")} size={22} tone={DEPT_COLOR[sel.name] ?? "#16B364"} />
              {sel.head}
            </DetailRow>
            <DetailRow label="Cost / month">{sel.cost}</DetailRow>
            <DetailRow label="Location">{sel.loc}</DetailRow>
            <DetailRow label="Headcount">
              {sel.headcount}
              <span style={{ fontWeight: 400, color: "var(--pf-n400)" }}>of {sel.target} planned</span>
            </DetailRow>

            {/* mini 6-month trend */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "13px 0 7px" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n600)", flex: 1 }}>6-month headcount</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: selNet > 0 ? "var(--pf-primary-600)" : selNet < 0 ? "var(--pf-red-500)" : "var(--pf-n400)" }}>
                {selNet > 0 ? `+${selNet}` : selNet} in 6 mo
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 44 }}>
              {selTrend.map((v, i) => {
                const h = 12 + (selMax === selMin ? 0.5 : (v - selMin) / (selMax - selMin)) * 30;
                const lastBar = i === selTrend.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    {lastBar && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--pf-n900)" }}>{v}</span>}
                    <div title={`${ORG_TREND[i]?.m}: ${v}`} style={{ width: "100%", height: h, borderRadius: 4, background: lastBar ? DEPT_COLOR[sel.name] ?? "var(--pf-primary-500)" : "var(--pf-n100)" }} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
              {ORG_TREND.map((t) => (
                <span key={t.m} style={{ flex: 1, textAlign: "center", fontSize: 10, color: "var(--pf-n300)" }}>{t.m[0]}</span>
              ))}
            </div>

            {/* AI annotation */}
            <div style={{ marginTop: 13, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "11px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-purple-500)", flex: 1 }}>AI annotation</span>
                <PfBadge tone={selAnnot.conf === "High" ? "green" : "yellow"}>Confidence: {selAnnot.conf}</PfBadge>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{selAnnot.note}</div>
              <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 6 }}>Evidence: {selAnnot.ev}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
              <PfBtn full variant="primary" icon="sparkle" onClick={() => requestHiring(sel.name)}>Request hiring</PfBtn>
              <PfBtn full small variant="ghost" onClick={() => go("ask")} style={{ color: "var(--pf-primary-600)" }}>
                Ask why this moved <Ic name="arrowright" size={13} />
              </PfBtn>
            </div>
          </div>
        </PfCard>
      </div>
      )}

      {/* LOCATIONS */}
      {tab === "locations" && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
        {LOCATIONS.map((loc) => (
          <PfCard key={loc.name}>
            <div style={{ padding: "14px 16px 15px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>{loc.name}</span>
                <PfBadge tone={loc.deltaTone}>{loc.delta}</PfBadge>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "7px 0 3px" }}>
                <span style={{ fontSize: 23, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{loc.total}</span>
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{((loc.total / TOTAL) * 100).toFixed(0)}% of org</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginBottom: 10 }}>{loc.sub}</div>
              <div style={{ display: "flex", gap: 2, height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 11 }}>
                {loc.mix.map(([name, n]) => (
                  <span key={name} title={`${name}: ${n}`} style={{ width: `${(n / loc.total) * 100}%`, background: DEPT_COLOR[name] ?? "var(--pf-n300)", borderRadius: 2 }} />
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {loc.mix.slice(0, 3).map(([name, n]) => (
                  <LegendRow key={name} name={name} n={n} onPick={() => pickFromBelow(name)} />
                ))}
              </div>
              {loc.mix.length > 3 && (
                <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 3, paddingLeft: 1 }}>+ {loc.mix.length - 3} more departments</div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                <Ic name="info" size={13} color="var(--pf-n300)" />
                {loc.note}
              </div>
            </div>
          </PfCard>
        ))}
      </div>
      )}

      {/* GROWTH TREND */}
      {tab === "growth" && (
      <PfCard>
        <PfCardHead title="Growth trend" sub="Headcount, hires and departures — Feb to Jul 2026 (346 → 358)">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n600)" }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: "var(--pf-blue-500)" }} /> Headcount
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n600)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--pf-primary-500)" }} /> Hires
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n600)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--pf-red-500)" }} /> Departures
          </span>
        </PfCardHead>
        <div style={{ padding: "18px 20px 14px" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {/* y-axis */}
            <div style={{ width: 26, position: "relative", height: 128, flex: "none" }}>
              {[358, 352, 346].map((v) => (
                <span key={v} style={{ position: "absolute", right: 0, top: `${yPct(v)}%`, transform: "translateY(-50%)", fontSize: 10.5, color: "var(--pf-n300)" }}>{v}</span>
              ))}
            </div>
            {/* plot */}
            <div style={{ flex: 1, position: "relative", minWidth: 0 }} onMouseLeave={() => setHov(null)}>
              {/* hover column highlight (behind) */}
              {hov !== null && (
                <div style={{ position: "absolute", top: -6, bottom: 0, left: `${(hov / ORG_TREND.length) * 100}%`, width: `${100 / ORG_TREND.length}%`, background: "var(--pf-n25)", borderRadius: 8 }} />
              )}
              {/* line zone */}
              <div style={{ height: 128, position: "relative" }}>
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block", overflow: "visible", position: "relative" }}>
                  {[346, 352, 358].map((v) => (
                    <line key={v} x1="0" y1={yPct(v)} x2="100" y2={yPct(v)} stroke="var(--pf-n50)" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                  ))}
                  <polygon points={areaPts} fill="var(--pf-blue-50)" opacity="0.75" />
                  <polyline points={linePts} fill="none" stroke="var(--pf-blue-500)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
                {ORG_TREND.map((t, i) => (
                  <span key={t.m} style={{ position: "absolute", left: `${xPct(i)}%`, top: `${yPct(t.hc)}%`, transform: "translate(-50%,-50%)", width: hov === i ? 11 : 8, height: hov === i ? 11 : 8, borderRadius: "50%", background: "var(--pf-n0)", border: "2px solid var(--pf-blue-500)", transition: "width .12s ease, height .12s ease" }} />
                ))}
              </div>
              {/* bars zone */}
              <div style={{ height: 58, display: "flex", marginTop: 10, alignItems: "flex-end" }}>
                {ORG_TREND.map((t) => (
                  <div key={t.m} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: "100%" }}>
                    <span title={`${t.hires} hires`} style={{ width: 12, height: t.hires * 6, borderRadius: "3px 3px 0 0", background: "var(--pf-primary-500)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25)" }} />
                    <span title={`${t.dep} departures`} style={{ width: 12, height: t.dep * 6, borderRadius: "3px 3px 0 0", background: "var(--pf-red-500)", opacity: 0.85 }} />
                  </div>
                ))}
              </div>
              {/* month labels */}
              <div style={{ display: "flex", marginTop: 6 }}>
                {ORG_TREND.map((t) => (
                  <span key={t.m} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--pf-n400)" }}>{t.m}</span>
                ))}
              </div>
              {/* hover capture */}
              <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                {ORG_TREND.map((t, i) => (
                  <span key={t.m} onMouseEnter={() => setHov(i)} style={{ flex: 1 }} />
                ))}
              </div>
              {/* tooltip */}
              {hovPt && hov !== null && (
                <div style={{ position: "absolute", top: -4, left: `${Math.min(82, Math.max(15, xPct(hov)))}%`, transform: "translateX(-50%)", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "9px 11px", boxShadow: "0 8px 20px rgba(2,6,23,.08)", pointerEvents: "none", zIndex: 2, minWidth: 148 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>{hovPt.m} 2026</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)", marginBottom: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-blue-500)" }} />
                    Headcount <b style={{ color: "var(--pf-n900)", marginLeft: "auto" }}>{hovPt.hc}</b>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)", marginBottom: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--pf-primary-500)" }} />
                    Hires <b style={{ color: "var(--pf-n900)", marginLeft: "auto" }}>+{hovPt.hires}</b>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)" }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--pf-red-500)" }} />
                    Departures <b style={{ color: "var(--pf-n900)", marginLeft: "auto" }}>−{hovPt.dep}</b>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: hovPt.hires - hovPt.dep > 0 ? "var(--pf-primary-600)" : "var(--pf-n400)", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--pf-n50)" }}>
                    Net {hovPt.hires - hovPt.dep > 0 ? `+${hovPt.hires - hovPt.dep}` : hovPt.hires - hovPt.dep}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
          <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
          Net growth is Port Harcourt-led — Field Operations and Drilling Support account for +11 of the +12; contractor conversions ran ahead of the NCDMB quota review.
          <span style={{ flex: 1 }} />
          <PfBadge tone="green">Confidence: High</PfBadge>
        </div>
      </PfCard>
      )}

      {/* WORKFORCE PLAN (FR-054) */}
      {tab === "plan" && (
      <PfCard>
        <PfCardHead title="Workforce plan — actual vs target" sub="Variance flags feed requisition suggestions (FR-054) · click a row to inspect the department">
          <PfBadge tone={outsideCount > 0 ? "yellow" : "green"} dot>{outsideCount} of {DEPARTMENTS.length} outside target</PfBadge>
        </PfCardHead>
        <div style={{ display: "grid", gridTemplateColumns: PLAN_GRID, gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
          <PfTh>Department</PfTh>
          <PfTh>Actual vs target</PfTh>
          <PfTh>Actual</PfTh>
          <PfTh>Target</PfTh>
          <PfTh>Variance</PfTh>
          <PfTh style={{ textAlign: "right" }}>Suggested action</PfTh>
        </div>
        {DEPARTMENTS.map((d, i) => (
          <PlanRow
            key={d.name}
            d={d}
            last={i === DEPARTMENTS.length - 1}
            onPick={() => pickFromBelow(d.name)}
            onSuggest={() => suggest(d)}
            onReview={() => review(d)}
          />
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)", flexWrap: "wrap" }}>
          <Ic name="target" size={13} color="var(--pf-n300)" />
          Plan variance target ≤5%/quarter · <span style={{ width: 8, height: 12, display: "inline-flex", alignItems: "center" }}><span style={{ width: 2, height: 12, borderRadius: 1, background: "var(--pf-n900)" }} /></span> = plan target
          <span style={{ flex: 1 }} />
          Suggestions use role-level peer benchmarks only — no personal data leaves the HRIS (NDPR-scoped).
        </div>
      </PfCard>
      )}
    </div>
  );
}
