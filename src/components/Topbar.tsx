"use client";
import { usePathname } from "next/navigation";
import { stageForPath, STAGES, WORKSPACE } from "@/data/nav";
import { useApp, useGo } from "@/state/app";
import { useHover } from "@/lib/useHover";
import { Ic } from "@/components/os/icons";

export default function Topbar() {
  const go = useGo();
  const pathname = usePathname();
  const stage = stageForPath(pathname);
  const stageLabel = [...STAGES, ...WORKSPACE].find((s) => s.stage === stage)?.label ?? "Workspace";
  const { copilotOpen, setCopilotOpen, setTourOpen, setTourStep } = useApp();
  const search = useHover();
  const tour = useHover();
  const bell = useHover();

  return (
    <header style={{ height: 60, flex: "none", background: "var(--pf-n0)", borderBottom: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 12, padding: "0 24px", fontFamily: "var(--pf-font)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, minWidth: 0 }}>
        <span style={{ color: "var(--pf-n300)", fontWeight: 500 }}>Recruit</span>
        <span style={{ color: "var(--pf-n300)" }}>/</span>
        <span style={{ color: "var(--pf-n600)", fontWeight: 500, whiteSpace: "nowrap" }}>{stageLabel}</span>
        <span style={{ width: 1, height: 16, background: "var(--pf-n50)", margin: "0 6px" }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n600)", whiteSpace: "nowrap" }}>Senior Product Designer</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n400)", background: "var(--pf-n25)", border: "0.6px solid var(--pf-n100)", padding: "1px 6px", borderRadius: 4 }}>SPD-2026</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: "var(--pf-primary-500)", background: "var(--pf-primary-50)", border: "0.6px solid var(--pf-primary-100)", padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-primary-500)" }} />
          Screening
        </span>
      </div>

      <span style={{ flex: 1 }} />

      <div
        {...search.hoverProps}
        onClick={() => go("search")}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: `1px solid ${search.hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`, borderRadius: 9, padding: "7px 12px", width: 230, cursor: "pointer" }}
      >
        <Ic name="search" size={14} color="var(--pf-n400)" />
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden" }}>Search candidates, roles…</span>
      </div>

      <button
        {...tour.hoverProps}
        onClick={() => { setTourStep(0); setTourOpen(true); go("planning"); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 8, cursor: "pointer", background: "var(--pf-n0)", color: "var(--pf-n600)", border: `1px solid ${tour.hovered ? "var(--pf-n300)" : "var(--pf-n50)"}`, boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)" }}
      >
        <Ic name="sparkle" size={14} color="var(--pf-n500)" /> Tour
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>
        <Ic name="calendar" size={15} color="var(--pf-n400)" />
        08/07/2026
      </div>

      <div
        {...bell.hoverProps}
        onClick={() => go("notifications")}
        style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--pf-n100)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", background: bell.hovered ? "var(--pf-n25)" : undefined }}
      >
        <Ic name="bell" size={16} color="var(--pf-n500)" />
        <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: "var(--pf-red-500)", border: "1.5px solid #fff" }} />
      </div>

      <button
        onClick={() => setCopilotOpen(!copilotOpen)}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 8, cursor: "pointer", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", color: "var(--pf-purple-500)" }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-purple-500)", animation: "pulseDot 1.8s infinite" }} />
        {/* Label text only — `copilotOpen` and every other identifier are untouched. */}
        Brew {copilotOpen ? "on" : "off"}
      </button>
    </header>
  );
}
