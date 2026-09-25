"use client";
import { usePathname } from "next/navigation";
import { stageForPath } from "@/data/nav";
import { copilotFor, type CopilotItem } from "@/data/copilot";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { Ic } from "@/components/os/icons";

const NAV_ACTIONS: Record<string, string> = {
  "Open shortlist": "shortlist",
  "Open profile": "profile",
  "Open brief for review": "assessment",
  "Review forecast": "planning",
  "Generate requisition": "requisitions",
  "Fix sourcing": "sourcing",
  "Review drafts": "sourcing",
  "Surface warm list": "sourcing",
};

function Card({ it }: { it: CopilotItem }) {
  const go = useGo();
  const toast = useToast();
  const runAction = () => {
    if (!it.action) return;
    const target = NAV_ACTIONS[it.action];
    if (target) go(target);
    else toast(`${it.action} — done`, "ai");
  };
  return (
    <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderLeft: `3px solid ${it.tint}`, borderRadius: 10, boxShadow: "0 1px 3px 0 #f3f3f3", padding: "12px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
        <span style={{ fontSize: 12 }}>{it.icon}</span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".5px", color: it.tint, background: it.bg, border: `0.6px solid ${it.tint}2E`, padding: "1px 6px", borderRadius: 4 }}>{it.kind}</span>
        <span style={{ flex: 1 }} />
        {it.confidence != null && (
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)" }}>{it.confidence}% conf.</span>
        )}
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, lineHeight: 1.3, color: "var(--pf-n900)" }}>{it.title}</div>
      <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{it.body}</div>
      {it.confidence != null && (
        <div style={{ height: 5, borderRadius: 4, background: "var(--pf-n50)", marginTop: 9, overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 4, width: `${it.confidence}%`, background: it.tint }} />
        </div>
      )}
      {it.action && (
        <div style={{ display: "flex", gap: 7, marginTop: 11 }}>
          <button onClick={runAction} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", background: it.tint, color: "#fff", border: "1px solid transparent", fontFamily: "inherit", fontWeight: 500, fontSize: 12, padding: "6px 10px", borderRadius: 8, cursor: "pointer", boxShadow: `0 6px 12px -6px ${it.tint}80, inset 0 1px 0 rgba(255,255,255,.22)` }}>{it.action}</button>
          <button onClick={() => toast("AI suggestion overridden — logged for audit")} style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", color: "var(--pf-n600)", fontFamily: "inherit", fontWeight: 500, fontSize: 12, padding: "6px 10px", borderRadius: 8, cursor: "pointer", boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)" }}>Override</button>
        </div>
      )}
    </div>
  );
}

export default function CopilotRail() {
  const pathname = usePathname();
  const cop = copilotFor(stageForPath(pathname));

  return (
    <aside style={{ width: 350, flex: "none", background: "var(--pf-n0)", borderLeft: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", height: "100%", fontFamily: "var(--pf-font)" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
        </span>
        <div style={{ flex: 1, lineHeight: 1.15, minWidth: 0 }}>
          {/* "Brew" — the diminutive of Hirebrew. A DISPLAY STRING ONLY: the
              assistant, its 11 stage-keyed panels, `copilotOpen`, `copilotFor`
              and every localStorage key are unchanged. One assistant, one name. */}
          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--pf-n900)" }}>Brew</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cop.stage}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 600, fontSize: 14, color: "var(--pf-purple-500)" }}>{cop.assist}%</div>
          <div style={{ fontSize: 9.5, color: "var(--pf-n400)", fontWeight: 500, letterSpacing: ".3px" }}>ASSIST RATE</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {cop.items.map((it, i) => <Card key={i} it={it} />)}
        <div style={{ marginTop: "auto", paddingTop: 8 }} />
      </div>

      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 8, background: "#FBFCFD" }}>
        <Ic name="shield" size={14} color="var(--pf-purple-500)" />
        <div style={{ fontSize: 11, color: "var(--pf-n500)", fontWeight: 500, lineHeight: 1.35 }}>
          AI proposes · <b style={{ color: "var(--pf-n900)" }}>you dispose.</b> Every signal is logged &amp; explainable.
        </div>
      </div>
    </aside>
  );
}
