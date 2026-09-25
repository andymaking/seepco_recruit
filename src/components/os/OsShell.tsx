"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { stageForPath } from "@/data/nav";
import { OS_NAV, OS_TITLES, SUBPILLAR_ICON } from "@/data/osnav";
import { useApp, useGo } from "@/state/app";
import { personaById, canOpenOsStage, SCOPE_LINE } from "@/data/personas";
import { useWorkspace } from "@/state/workspace";
import type { PillarKey } from "@/data/recruiterOnboarding";
import { useHover } from "@/lib/useHover";
import { Ic } from "./icons";

/** Icon-rail item (DoronStack arrangement): icon in a circle + tiny caption. */
function RailItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", padding: "2px 0", width: "100%" }}>
      <span style={{ width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "transparent", transition: "background .15s ease" }}>
        <Ic name={icon} size={19} color={active ? "#fff" : "var(--pf-n500)"} />
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? "var(--pf-n900)" : "var(--pf-n400)", lineHeight: 1.1, textAlign: "center" }}>{label}</span>
    </div>
  );
}

/** Contextual-panel row: pill card when active. */
function PanelRow({ label, badge, active, onClick }: { label: string; badge?: string; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 999, cursor: "pointer",
        background: active ? "var(--pf-n0)" : hovered ? "var(--pf-n25)" : "transparent",
        border: active ? "1px solid var(--pf-n50)" : "1px solid transparent",
        boxShadow: active ? "0 4px 10px -4px rgba(2,6,23,.08)" : "none",
      }}
    >
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: active ? 600 : 500, color: active ? "var(--pf-n900)" : "var(--pf-n500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10, fontWeight: 600, color: badge === "LIVE" ? "var(--pf-primary-600)" : "var(--pf-n400)", background: badge === "LIVE" ? "var(--pf-primary-50)" : "var(--pf-n50)", padding: "1px 6px", borderRadius: 999, letterSpacing: ".3px" }}>{badge}</span>
      )}
    </div>
  );
}

const GROUP_ICON: Record<string, string> = { Command: "gauge", Manage: "users", Grow: "trend", Recruit: "sparkle", Me: "user" };

/** FR-077: the blocked-route notice — enforcement made visible, not just hidden nav. */
function RestrictedPanel({ stage, personaId }: { stage: string; personaId: string }) {
  const go = useGo();
  const persona = personaById(personaId as never);
  const [, title] = OS_TITLES[stage] ?? ["", "This module"];
  return (
    <div style={{ padding: "60px 28px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 520, width: "100%", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 14, boxShadow: "0 1px 3px 0 #f3f3f3", padding: "34px 32px", textAlign: "center" }}>
        <span style={{ width: 46, height: 46, borderRadius: 13, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
          <Ic name="shield" size={22} color="var(--pf-yellow-500)" />
        </span>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--pf-n900)", marginBottom: 6 }}>{title} isn&apos;t in your workspace</div>
        <div style={{ fontSize: 13, color: "var(--pf-n400)", lineHeight: 1.6, marginBottom: 6 }}>
          You&apos;re viewing Hirebrew as <b style={{ color: persona.tone }}>{persona.name}</b> ({persona.title}).
          Role-aware access (FR-077) scopes every surface by persona with field-level permissions.
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginBottom: 20 }}>This access attempt was logged · {SCOPE_LINE[persona.id]}</div>
        <div style={{ display: "flex", gap: 9, justifyContent: "center" }}>
          <button onClick={() => go(persona.home)} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "8px 16px", borderRadius: 8, border: "1px solid transparent", cursor: "pointer", background: "var(--pf-primary-500)", color: "#fff", boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.22)" }}>Go to my workspace</button>
          <button onClick={() => go("personas")} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--pf-n50)", cursor: "pointer", background: "var(--pf-n0)", color: "var(--pf-n600)", boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)" }}>Switch workspace</button>
        </div>
      </div>
    </div>
  );
}

export default function OsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const stage = stageForPath(pathname);
  const go = useGo();
  const { persona: personaId } = useApp();
  const persona = personaById(personaId);
  // Product-tier entitlement: which pillars the org switched on in activation.
  const { hasPillar, hydrated: wsHydrated } = useWorkspace();
  const [crumbA, crumbB] = OS_TITLES[stage] ?? ["Talent OS", "Overview"];
  const search = useHover();
  const [collapsed, setCollapsed] = useState(false);

  const canAsk = canOpenOsStage(persona, "ask");
  const allowed = canOpenOsStage(persona, stage);

  // Persona-scoped navigation (the recruit bridge lives in the promo card),
  // then narrowed again by the workspace's pillar entitlement — so switching
  // Grow off in activation genuinely removes the Grow group. Persona gating
  // still runs first, and the rail stays unfiltered until the workspace store
  // has hydrated so it can't flicker on every load.
  const sections = OS_NAV
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => it.stage !== "dashboard" && canOpenOsStage(persona, it.stage)),
    }))
    .filter((sec) => sec.items.length > 0 && (!wsHydrated || hasPillar(sec.label as PillarKey)));
  const active = sections.find((sec) => sec.items.some((it) => it.stage === stage)) ?? sections[0];

  /**
   * A persona scoped to a SINGLE pillar (the employee lives entirely in Me) puts
   * EVERY page straight onto the icon rail, and the contextual panel is dropped —
   * the recruit shell's arrangement, one rail of icons with names underneath.
   * With one pillar there is nothing for a second rail to contextualise, and a
   * 3-icon rail beside an 11-row panel reads as empty. Personas with several
   * pillars keep the double rail unchanged.
   */
  const flatRail = sections.length === 1 && sections[0].items.length > 3;
  const railItems = flatRail ? sections[0].items : [];


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); if (canAsk) go("ask"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAsk]);

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "var(--pf-n0)", color: "var(--pf-n900)", fontFamily: "var(--pf-font)", fontSize: 14 }}>
      {/* DOUBLE-RAIL NAVBAR */}
      <aside style={{ display: "flex", flex: "none", height: "100%", background: "#FBFCFD", borderRight: "1px solid var(--pf-n50)" }}>
        {/* Icon rail */}
        <div style={{ width: 76, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 6px 12px", borderRight: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
          <span
            onClick={() => go(persona.home)}
            title="Talent OS · Hirebrew v2.0"
            style={{ width: 42, height: 42, borderRadius: 13, background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 16, boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.25)" }}
          >
            <Ic name="sparkle" size={20} color="#fff" weight={2} />
          </span>

          <div className="no-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center", flex: 1, overflowY: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {flatRail
              ? railItems.map((it) => (
                  <RailItem key={it.stage} icon={it.icon} label={it.rail ?? it.label} active={stage === it.stage} onClick={() => go(it.stage)} />
                ))
              : sections.map((sec) => (
                  <RailItem key={sec.label} icon={GROUP_ICON[sec.label] ?? SUBPILLAR_ICON[sec.label] ?? "sparkle"} label={sec.label} active={active?.label === sec.label} onClick={() => go(sec.items[0].stage)} />
                ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
            {persona.legacyAccess && <RailItem icon="gear" label="Settings" active={false} onClick={() => go("settings")} />}
            <div onClick={() => go("personas")} title={`${persona.name} · ${persona.title} — switch workspace`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", paddingTop: 2 }}>
              <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${persona.tone}1A`, color: persona.tone, border: `2px solid ${persona.tone}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{persona.init}</span>
              <span style={{ fontSize: 9.5, fontWeight: 500, color: "var(--pf-n400)" }}>{persona.label.split(" ")[0]}</span>
            </div>
          </div>
        </div>

        {/* Contextual panel */}
        {!flatRail && !collapsed && (
          <div style={{ width: 218, flex: "none", display: "flex", flexDirection: "column", padding: "16px 12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px", marginBottom: 14 }}>
              <div style={{ flex: 1, lineHeight: 1.1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", color: "var(--pf-n900)" }}>Talent OS</div>
                <div style={{ fontSize: 9.5, fontWeight: 500, color: "var(--pf-n400)", letterSpacing: ".4px" }}>HIREBREW · v2.0</div>
              </div>
              <span onClick={() => setCollapsed(true)} title="Collapse panel" style={{ cursor: "pointer", display: "inline-flex", padding: 4, borderRadius: 6 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pf-n400)" strokeWidth="1.7" strokeLinecap="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><path d="M9.5 4.5v15" /></svg>
              </span>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--pf-n300)", padding: "0 8px 7px" }}>{(active?.label ?? "").toUpperCase()}</div>
            <nav className="no-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {(active?.items ?? []).map((it, i, arr) => {
                /**
                 * Sub-pillar headers. `group` was carried on OsNavItem but never
                 * rendered, so Manage read as 20 undifferentiated rows and Recruit
                 * as 15. A header prints when the group CHANGES, which means an
                 * ungrouped pillar (Command, Grow) is untouched and stays flat.
                 */
                const head = it.group && it.group !== arr[i - 1]?.group ? it.group : null;
                return (
                  <div key={it.stage} style={{ display: "contents" }}>
                    {head && (
                      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n300)", padding: i === 0 ? "2px 14px 5px" : "12px 14px 5px" }}>
                        {head.toUpperCase()}
                      </div>
                    )}
                    <PanelRow label={it.label} badge={it.badge} active={stage === it.stage} onClick={() => go(it.stage)} />
                  </div>
                );
              })}
            </nav>

            {/* Promo-card slot: the Recruit bridge (or workspace switch for scoped personas) */}
            {persona.legacyAccess ? (
              <div style={{ background: "var(--pf-n900)", borderRadius: 14, padding: "16px 16px 14px", color: "#fff", marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <Ic name="target" size={15} color="#57CB92" />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Recruit · Pillar 1</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#94A3B8", lineHeight: 1.5, marginBottom: 12 }}>
                  The 11-stage hiring lifecycle — <span style={{ color: "#57CB92", fontWeight: 600 }}>requisitions to post-hire</span>.
                </div>
                <button onClick={() => go("dashboard")} style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 999, border: "none", cursor: "pointer", background: "#fff", color: "var(--pf-n900)" }}>
                  Open Recruit
                </button>
              </div>
            ) : (
              <div style={{ background: "var(--pf-n900)", borderRadius: 14, padding: "16px 16px 14px", color: "#fff", marginTop: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                  <Ic name="swap" size={15} color="#57CB92" />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{persona.name.split(" ")[0]}&apos;s workspace</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#94A3B8", lineHeight: 1.5, marginBottom: 12 }}>
                  {persona.label} view · <span style={{ color: "#57CB92", fontWeight: 600 }}>FR-077 scoped</span>.
                </div>
                <button onClick={() => go("personas")} style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 999, border: "none", cursor: "pointer", background: "#fff", color: "var(--pf-n900)" }}>
                  Switch workspace
                </button>
              </div>
            )}
          </div>
        )}

        {!flatRail && collapsed && (
          <div onClick={() => setCollapsed(false)} title="Expand panel" style={{ width: 18, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--pf-n300)" }}>
            <Ic name="caretright" size={12} color="var(--pf-n300)" />
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* TOPBAR */}
        <header style={{ height: 60, flex: "none", background: "var(--pf-n0)", borderBottom: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 14, padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
            <span style={{ color: "var(--pf-n300)", fontWeight: 500 }}>{crumbA}</span>
            <span style={{ color: "var(--pf-n300)" }}>/</span>
            <span style={{ color: "var(--pf-n600)", fontWeight: 500 }}>{crumbB}</span>
            <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--pf-n400)", background: "var(--pf-n25)", border: "0.6px solid var(--pf-n100)", padding: "2px 8px", borderRadius: 5, marginLeft: 6, whiteSpace: "nowrap" }}>{SCOPE_LINE[persona.id]}</span>
          </div>
          <span style={{ flex: 1 }} />
          {canAsk && (
            <div
              {...search.hoverProps}
              onClick={() => go("ask")}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: `1px solid ${search.hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`, borderRadius: 9, padding: "7px 12px", width: 280, cursor: "pointer" }}
            >
              <Ic name="sparkle" size={14} color="var(--pf-primary-500)" />
              <span style={{ flex: 1, fontSize: 13, color: "var(--pf-n400)" }}>Ask anything about your workforce…</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 5, padding: "1px 5px" }}>⌘K</span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 11px", fontSize: 13, fontWeight: 500, color: "var(--pf-n600)" }}>
            <Ic name="calendar" size={15} color="var(--pf-n400)" />
            08/07/2026
          </div>
          <div onClick={() => go(persona.legacyAccess ? "notifications" : persona.home)} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--pf-n100)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" }}>
            <Ic name="bell" size={17} color="var(--pf-n500)" />
            <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--pf-red-500)", border: "1.5px solid #fff" }} />
          </div>
        </header>

        <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          {allowed ? children : <RestrictedPanel stage={stage} personaId={persona.id} />}
        </main>
      </div>
    </div>
  );
}
