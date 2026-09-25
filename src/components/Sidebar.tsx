"use client";
import { usePathname } from "next/navigation";
import { stageForPath } from "@/data/nav";
import { useApp, useGo } from "@/state/app";
import { useLifecycle } from "@/state/lifecycle";
import { personaById } from "@/data/personas";
import { useHover } from "@/lib/useHover";
import { Ic } from "@/components/os/icons";

/**
 * Recruit-shell sidebar — the staging app's WORKSPACE userflow rendered as a
 * single icon rail (talent-shell anatomy): every item is an icon with its
 * name underneath, dark-circle active state, live count bubbles from the
 * lifecycle store. Lifecycle stages stay drill-throughs; Settings lives at
 * platform level (Talent OS).
 */

type RailEntry = {
  stage: string; icon: string; label: string;
  countKey?: "requisitions" | "roles" | "candidates";
  count?: string;
  filled?: boolean; // filled (green) bubble, e.g. Messages — like staging's dark badge
};

const ITEMS: RailEntry[] = [
  { stage: "dashboard", icon: "house", label: "Dashboard" },
  { stage: "requisitions", icon: "clipboard", label: "Requisitions", countKey: "requisitions" },
  { stage: "jobs", icon: "file", label: "Open roles", countKey: "roles" },
  { stage: "candidates", icon: "users", label: "Candidates", countKey: "candidates" },
  { stage: "calendar", icon: "calendar", label: "Calendar", count: "8" },
  { stage: "messages", icon: "chat", label: "Messages", count: "3", filled: true },
  { stage: "analytics", icon: "trend", label: "Analytics" },
  { stage: "audit", icon: "shield", label: "Audit log" },
  { stage: "dei", icon: "heart", label: "D&I" },
  { stage: "qoh", icon: "star", label: "QoH" },
  { stage: "integrations", icon: "swap", label: "Integrations" },
];

/** Which rail item lights up for drill-through pages. */
const STAGE_ALIAS: Record<string, string> = {
  search: "dashboard",
  newrole: "jobs",
  shortlist: "candidates",
  profile: "candidates",
  schedule: "calendar",
  notifications: "messages",
  planning: "dashboard", role: "dashboard", sourcing: "dashboard", screening: "dashboard",
  assessment: "dashboard", interview: "dashboard", selection: "dashboard", reference: "dashboard",
  offer: "dashboard", onboarding: "dashboard", posthire: "dashboard",
};

function RailItem({ it, count, active, onClick }: { it: RailEntry; count?: string; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", padding: "2px 0", width: "100%" }}>
      <span style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "transparent", transition: "background .15s ease" }}>
        <Ic name={it.icon} size={19} color={active ? "#fff" : "var(--pf-n500)"} />
        {count && (
          <span style={{ position: "absolute", top: -3, right: -7, minWidth: 18, height: 17, borderRadius: 9, background: it.filled ? "var(--pf-primary-500)" : "var(--pf-n0)", color: it.filled ? "#fff" : "var(--pf-n500)", border: it.filled ? "2px solid #FBFCFD" : "1px solid var(--pf-n100)", fontSize: 9.5, fontWeight: 600, fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{count}</span>
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? "var(--pf-n900)" : "var(--pf-n400)", lineHeight: 1.15, textAlign: "center", maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const stage = stageForPath(pathname);
  const activeStage = STAGE_ALIAS[stage] ?? stage;
  const go = useGo();
  const { requisitions, roles, candidates } = useLifecycle();

  const liveCounts = {
    requisitions: String(requisitions.length),
    roles: String(roles.length),
    candidates: String(candidates.length),
  };
  const countFor = (it: RailEntry) => (it.countKey ? liveCounts[it.countKey] : it.count);

  return (
    <aside style={{ width: 88, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 6px 12px", background: "#FBFCFD", borderRight: "1px solid var(--pf-n50)", height: "100%", fontFamily: "var(--pf-font)" }}>
      <span
        onClick={() => go("dashboard")}
        title="Hirebrew · Recruit"
        style={{ width: 42, height: 42, borderRadius: 13, background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 6, boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.25)" }}
      >
        <Ic name="sparkle" size={20} color="#fff" weight={2} />
      </span>
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n300)", marginBottom: 10 }}>WORKSPACE</span>

      <nav className="no-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "center", flex: 1, overflowY: "auto", paddingBottom: 8, scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {ITEMS.map((it) => (
          <RailItem key={it.stage} it={it} count={countFor(it)} active={activeStage === it.stage} onClick={() => go(it.stage)} />
        ))}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
        <TalentOsLink />
        <RailItem it={{ stage: "signin", icon: "door", label: "Logout" }} active={false} onClick={() => go("signin")} />
        <PersonaDot />
      </div>
    </aside>
  );
}

function TalentOsLink() {
  const go = useGo();
  const { persona: personaId } = useApp();
  const p = personaById(personaId);
  const hasOs = p.osStages === "all" || p.osStages.length > 0;
  if (!hasOs) return null;
  // Land on the persona's OS home: full-suite → command; scoped → first allowed module.
  const target = p.osStages === "all" ? "command" : p.osStages[0];
  return <RailItem it={{ stage: "talentos", icon: "orbit", label: "Talent OS" }} active={false} onClick={() => go(target)} />;
}

function PersonaDot() {
  const go = useGo();
  const { persona: personaId } = useApp();
  const p = personaById(personaId);
  return (
    <div onClick={() => go("personas")} title={`${p.name} · ${p.title} — switch workspace`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", paddingTop: 2 }}>
      <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${p.tone}1A`, color: p.tone, border: `2px solid ${p.tone}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{p.init}</span>
      <span style={{ fontSize: 9.5, fontWeight: 500, color: "var(--pf-n400)" }}>{p.label.split(" ")[0]}</span>
    </div>
  );
}
