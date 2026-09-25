"use client";
import { useGo } from "@/state/app";
import { useLifecycle, type OpenRole } from "@/state/lifecycle";
import { useHover } from "@/lib/useHover";
import { PfBadge, PfBtn, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* Open roles — live from the lifecycle store: publishing a requisition adds a
   role here, "+ New Role" creates one, applicant counts derive from the real
   candidate pipeline. State persists across reloads. */

const STATUS_TONE: Record<OpenRole["status"], PfTone> = { Open: "green", Draft: "grey" };

function RoleCard({ r, applicants, onClick }: { r: OpenRole; applicants: number; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        background: "var(--pf-n0)", border: `1px solid ${hovered ? "var(--pf-n300)" : "var(--pf-n50)"}`,
        borderRadius: 12, boxShadow: hovered ? "0 8px 20px -10px rgba(2,6,23,.12)" : "0 1px 3px 0 #f3f3f3",
        padding: "16px 18px", cursor: "pointer", transition: "border-color .15s ease, box-shadow .15s ease",
        display: "flex", flexDirection: "column", gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.3 }}>{r.title}</div>
        <PfBadge tone={STATUS_TONE[r.status]} dot>{r.status}</PfBadge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{r.dept}</span>
        {r.fromReq && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--pf-n300)", background: "var(--pf-n25)", border: "0.6px solid var(--pf-n100)", padding: "0 5px", borderRadius: 4 }}>{r.fromReq}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, borderTop: "1px solid var(--pf-n50)", paddingTop: 10 }}>
        <Ic name="users" size={14} color="var(--pf-n400)" />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n500)" }}>{applicants} applicants</span>
        <span style={{ flex: 1 }} />
        <Ic name="caretright" size={13} color={hovered ? "var(--pf-n500)" : "var(--pf-n300)"} />
      </div>
    </div>
  );
}

export default function Jobs() {
  const go = useGo();
  const { roles, candidates } = useLifecycle();
  const applicantsFor = (title: string) => candidates.filter((c) => c.role === title).length;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100, fontFamily: "var(--pf-font)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Open roles</h1>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>
            {roles.length} open roles · {roles.filter((r) => r.status === "Open").length} published · fed by the requisition chain
          </div>
        </div>
        <PfBtn variant="primary" icon="plus" onClick={() => go("newrole")}>New Role</PfBtn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {roles.map((r) => (
          <RoleCard key={r.id} r={r} applicants={applicantsFor(r.title)} onClick={() => go("role")} />
        ))}
      </div>
    </div>
  );
}
