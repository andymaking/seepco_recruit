"use client";
import { PERSONAS, type Persona } from "@/data/personas";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useWorkspace } from "@/state/workspace";
import type { PillarKey } from "@/data/recruiterOnboarding";
import { Ic } from "@/components/os/icons";
import { PfBadge } from "@/components/os/ui";

function PersonaCard({ p, active, orgPillars, onEnter }: { p: Persona; active: boolean; orgPillars: PillarKey[]; onEnter: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        background: "var(--pf-n0)",
        border: `1px solid ${active ? p.tone : hovered ? "var(--pf-n300)" : "var(--pf-n50)"}`,
        borderRadius: 14,
        boxShadow: hovered ? "0 12px 28px -12px rgba(2,6,23,.14)" : "0 1px 3px 0 #f3f3f3",
        padding: "20px 20px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 13,
        transition: "box-shadow .15s ease, border-color .15s ease, transform .15s ease",
        transform: hovered ? "translateY(-2px)" : "none",
        position: "relative",
      }}
    >
      {active && (
        <span style={{ position: "absolute", top: 14, right: 14, fontSize: 10.5, fontWeight: 600, color: p.tone, background: `${p.tone}14`, border: `0.6px solid ${p.tone}33`, padding: "2px 7px", borderRadius: 5, letterSpacing: ".4px" }}>
          CURRENT VIEW
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: "50%", background: `${p.tone}1A`, color: p.tone, border: `1px solid ${p.tone}33`, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, flex: "none" }}>
          {p.init}
        </span>
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--pf-n900)" }}>{p.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{p.title}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".5px", color: p.tone, background: `${p.tone}12`, border: `0.6px solid ${p.tone}2E`, padding: "2px 8px", borderRadius: 5 }}>{p.label}</span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>· {p.tagline}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {p.sees.map((s) => (
          <div key={s} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Ic name="check" size={13} color={p.tone} weight={2.2} />
            <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.45 }}>{s}</span>
          </div>
        ))}
      </div>

      {/* Persona footprint ∩ what the org actually switched on in activation. */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: "auto" }}>
        {p.pillars.map((pl) => {
          const on = pl.on && orgPillars.includes(pl.label as PillarKey);
          const offBecauseOrg = pl.on && !on;
          return (
            <span
              key={pl.label}
              title={offBecauseOrg ? `${pl.label} is switched off for this workspace` : undefined}
              style={{ fontSize: 10.5, fontWeight: 500, padding: "2px 8px", borderRadius: 5, border: "0.6px solid", borderColor: on ? "var(--pf-primary-100)" : "var(--pf-n100)", background: on ? "var(--pf-primary-50)" : "var(--pf-n25)", color: on ? "var(--pf-primary-500)" : "var(--pf-n300)", textDecorationLine: on ? "none" : "line-through" }}
            >
              {pl.label}
            </span>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, borderTop: "1px solid var(--pf-n50)", paddingTop: 13 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n400)" }}>
          <Ic name={p.icon} size={14} color="var(--pf-n400)" />
          {p.homeLabel}
        </div>
        <button
          onClick={onEnter}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "7px 14px", borderRadius: 8, border: "1px solid transparent", cursor: "pointer", background: p.tone, color: "#fff", boxShadow: `0 6px 12px -6px ${p.tone}80, inset 0 1px 0 rgba(255,255,255,.22)` }}
        >
          Enter workspace <Ic name="arrowright" size={13} color="#fff" />
        </button>
      </div>
    </div>
  );
}

export default function PersonaHub() {
  const go = useGo();
  const toast = useToast();
  const { persona, setPersona } = useApp();
  const { pillars, workspace } = useWorkspace();

  const enter = (p: Persona) => {
    setPersona(p.id);
    toast(`Switched to the ${p.label.toLowerCase()} workspace — ${p.name}`, "success");
    go(p.home);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--pf-n25)", fontFamily: "var(--pf-font)", color: "var(--pf-n900)", padding: "0 0 60px" }}>
      {/* Top strip */}
      <header style={{ background: "var(--pf-n0)", borderBottom: "1px solid var(--pf-n50)", padding: "14px 28px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Ic name="sparkle" size={15} color="#fff" weight={2} />
        </span>
        <div style={{ lineHeight: 1.1 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>Hirebrew Talent OS</span>
          <span style={{ fontSize: 11, color: "var(--pf-n400)", marginLeft: 8 }}>One platform · one record · five entry points</span>
        </div>
        <span style={{ flex: 1 }} />
        <PfBadge tone="grey">FR-077 · Role-aware access</PfBadge>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 28px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 26, fontWeight: 700, letterSpacing: "-.4px" }}>Choose your workspace</h1>
          <div style={{ fontSize: 13.5, color: "var(--pf-n400)", maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
            Each persona lands on a home built for their decisions — not six dashboards, one workspace per role.
            Navigation, records and AI answers are scoped by role with field-level permissions; a candidate never
            sees the employer suite.
          </div>
        </div>

        {/* The pillar chips below are the org's entitlement, not a brochure. */}
        <div
          onClick={() => go("activation")}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 16, fontSize: 12, color: "var(--pf-n400)", cursor: "pointer" }}
        >
          <Ic name="shield" size={13} color="var(--pf-primary-500)" />
          <span>
            Pillars switched on for <b style={{ color: "var(--pf-n900)" }}>{workspace.orgName}</b>:{" "}
            <b style={{ color: "var(--pf-primary-600)" }}>{pillars.join(" · ") || "none"}</b>
          </span>
          <span style={{ fontWeight: 600, color: "var(--pf-primary-600)" }}>manage in Workspace activation →</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {PERSONAS.map((p) => (
            <PersonaCard key={p.id} p={p} active={persona === p.id} orgPillars={pillars} onEnter={() => enter(p)} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 26, fontSize: 12, color: "var(--pf-n400)" }}>
          <Ic name="shield" size={14} color="var(--pf-n400)" />
          Persona views enforce FR-077: field-level permissions, permissioned risk scores, access logging.
          Aggregate analytics never expose protected attributes. Blocked routes show a logged access notice — nothing is merely hidden.
        </div>
      </div>
    </div>
  );
}
