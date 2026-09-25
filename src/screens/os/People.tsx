"use client";
import { useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { EMPLOYEES, type Employee } from "@/data/talentos";
import { PfAvatar, PfBadge, PfBanner, PfBtn, PfCard, PfSegments, PfTabs, PfTh, PfTile, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------ Tone maps ------------------------------ */

const CONTRACT_TONE: Record<Employee["contract"], PfTone> = {
  Permanent: "grey", "Fixed-term": "blue", Contractor: "purple", "NYSC/Intern": "yellow",
};
const STATUS_TONE: Record<Employee["status"], PfTone> = {
  active: "green", onboarding: "blue", notice: "yellow", alumni: "grey",
};
const STATUS_LABEL: Record<Employee["status"], string> = {
  active: "Active", onboarding: "Onboarding", notice: "Notice", alumni: "Alumni",
};
const STATUSES: Employee["status"][] = ["active", "onboarding", "notice", "alumni"];

const scoreTone = (score: number): PfTone => (score >= 4 ? "green" : score >= 3 ? "yellow" : "red");

/* ------------------------------ Filter chip ---------------------------- */

function Chip({ label, active, dot, onClick }: { label: string; active: boolean; dot?: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
        border: `1px solid ${active ? "var(--pf-n900)" : "var(--pf-n100)"}`,
        background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        color: active ? "#fff" : "var(--pf-n500)", whiteSpace: "nowrap", lineHeight: 1.3,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "none" }} />}
      {label}
    </button>
  );
}

/* ---------------------------- Risk flag chip ---------------------------- */

function RiskChip({ e, style }: { e: Employee; style?: React.CSSProperties }) {
  const toast = useToast();
  if (!e.risk) return null;
  const r = e.risk;
  return (
    <button
      onClick={(ev) => {
        ev.stopPropagation();
        toast(`Leave-risk ${r.score} (${r.horizon}) — ${r.reasons[0]}. View access-logged for audit.`, "danger");
      }}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11.5,
        fontWeight: 600, color: "var(--pf-red-500)", background: "var(--pf-red-50)",
        border: "1px solid transparent", padding: "3px 9px", borderRadius: 999, cursor: "pointer",
        whiteSpace: "nowrap", lineHeight: 1.35, ...style,
      }}
    >
      <Ic name="warning" size={12} />
      Leave-risk · access-logged
    </button>
  );
}

/* ------------------------------ Person card ----------------------------- */

function PersonCard({ e, onOpen }: { e: Employee; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  const score = e.perf / 20;
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        background: "var(--pf-n0)", border: `1px solid ${hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`,
        borderRadius: 12, padding: "22px 16px 16px", cursor: "pointer", textAlign: "center",
        display: "flex", flexDirection: "column", alignItems: "center",
        boxShadow: hovered ? "0 8px 22px rgba(2,6,23,.07)" : "none",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "box-shadow .15s ease, border-color .15s ease, transform .15s ease",
      }}
    >
      <span style={{ position: "relative", display: "inline-flex" }}>
        <PfAvatar init={e.init} tone={e.tone} size={56} />
        {e.perf > 0 && (
          <span style={{ position: "absolute", right: -12, top: -4, background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 999, padding: "1px 7px", fontSize: 11, fontWeight: 700, color: TONE[scoreTone(score)].fg, boxShadow: "0 1px 3px rgba(2,6,23,.10)" }}>
            {score.toFixed(1)}
          </span>
        )}
      </span>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 11, lineHeight: 1.3 }}>{e.name}</div>
      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 2 }}>{e.role}</div>
      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{e.dept} · {e.loc}</div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 11 }}>
        <PfBadge tone={CONTRACT_TONE[e.contract]}>{e.contract}</PfBadge>
        <PfBadge tone={STATUS_TONE[e.status]} dot>{STATUS_LABEL[e.status]}</PfBadge>
      </div>

      <div style={{ marginTop: 11, minHeight: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {e.perf > 0
          ? <PfSegments score={score} tone={scoreTone(score)} />
          : <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Ramping — first 90 days</span>}
      </div>

      {e.risk && <RiskChip e={e} style={{ marginTop: 10 }} />}

      <span style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
        {e.skills.slice(0, 2).map((s) => (
          <span key={s} style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- Table row ------------------------------ */

const COLS = "minmax(170px,2fr) minmax(150px,1.9fr) 0.9fr 1.1fr 0.7fr 1.5fr 1fr";

function PersonRow({ e, last, onOpen }: { e: Employee; last: boolean; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  const score = e.perf / 20;
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        display: "grid", gridTemplateColumns: COLS, gap: 12, alignItems: "center",
        padding: "11px 20px", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <PfAvatar init={e.init} tone={e.tone} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
            {e.name}
            {e.risk && <span title="Leave-risk flagged" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pf-red-500)", flex: "none" }} />}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{e.id}</div>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--pf-n600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.role}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{e.dept}</div>
      </div>
      <div style={{ fontSize: 13, color: "var(--pf-n500)" }}>{e.loc}</div>
      <div><PfBadge tone={CONTRACT_TONE[e.contract]}>{e.contract}</PfBadge></div>
      <div style={{ fontSize: 13, color: "var(--pf-n500)" }}>{e.tenure}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {e.perf > 0 ? (
          <>
            <PfSegments score={score} tone={scoreTone(score)} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: TONE[scoreTone(score)].fg }}>{score.toFixed(1)}</span>
          </>
        ) : (
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Ramping</span>
        )}
      </div>
      <div><PfBadge tone={STATUS_TONE[e.status]} dot>{STATUS_LABEL[e.status]}</PfBadge></div>
    </div>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function People() {
  const go = useGo();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState<Employee["status"] | "all">("all");
  const [view, setView] = useState("Grid");

  const depts = useMemo(() => ["All", ...Array.from(new Set(EMPLOYEES.map((e) => e.dept)))], []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return EMPLOYEES.filter((e) => {
      const matchQ = !t || e.name.toLowerCase().includes(t) || e.role.toLowerCase().includes(t) || e.dept.toLowerCase().includes(t);
      return matchQ && (dept === "All" || e.dept === dept) && (status === "all" || e.status === status);
    });
  }, [q, dept, status]);

  const openRecord = (e: Employee) => {
    go("employee");
    toast(`Opening record — ${e.name}`);
  };
  const clearFilters = () => {
    setQ(""); setDept("All"); setStatus("all");
    toast("Filters cleared");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header: title + count · view toggle */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0, lineHeight: 1.2 }}>People</h1>
            <PfBadge tone="green">358 employees</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Employee records & directory — search, filter and open any profile spine.
          </div>
        </div>
        <PfTabs tabs={["Grid", "Table"]} active={view} onChange={setView} />
      </div>

      {/* Toolbar: search + status filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "8px 12px", width: 300 }}>
          <Ic name="search" size={15} color="var(--pf-n400)" />
          <input
            value={q}
            onChange={(ev) => setQ(ev.target.value)}
            placeholder="Search name, role or dept…"
            style={{ border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", flex: 1, padding: 0, minWidth: 0 }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--pf-n400)", display: "flex" }}>
              <Ic name="x" size={13} />
            </button>
          )}
        </div>
        <span style={{ flex: 1 }} />
        <Chip label="All statuses" active={status === "all"} onClick={() => setStatus("all")} />
        {STATUSES.map((s) => (
          <Chip key={s} label={STATUS_LABEL[s]} dot={TONE[STATUS_TONE[s]].bg} active={status === s} onClick={() => setStatus(s)} />
        ))}
      </div>

      {/* Dept chips + result count */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {depts.map((d) => (
          <Chip key={d} label={d} active={dept === d} onClick={() => setDept(d)} />
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
          {filtered.length} on this page · 358 total
        </span>
      </div>

      {/* One-spine sub-strip + add employee */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 12px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <PfBanner
            tone="green"
            icon="swap"
            cta="open"
            onCta={() => { go("employee"); toast("Opening a profile spine — Amara Okonkwo"); }}
          >
            One profile spine — candidate ↔ employee ↔ alumni is one record; hiring artifacts carry forward. Consent states travel with the record.
          </PfBanner>
        </div>
        <PfBtn variant="secondary" icon="plus" onClick={() => toast("New employee draft opened — spine will carry hiring artifacts forward", "success")}>
          Add employee
        </PfBtn>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <PfCard pad="42px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><PfTile icon="search" tone="grey" size={38} /></div>
          <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 3 }}>No people match</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginBottom: 14 }}>
            Nothing on this page matches{q.trim() ? <> &ldquo;{q.trim()}&rdquo;</> : " the current filters"} — try a different name, role or dept.
          </div>
          <PfBtn variant="secondary" onClick={clearFilters}>Clear filters</PfBtn>
        </PfCard>
      ) : view === "Grid" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(252px, 1fr))", gap: 12 }}>
          {filtered.map((e) => (
            <PersonCard key={e.id} e={e} onOpen={() => openRecord(e)} />
          ))}
        </div>
      ) : (
        <PfCard>
          <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 12, padding: "11px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)", borderRadius: "12px 12px 0 0" }}>
            <PfTh>Employee</PfTh>
            <PfTh>Role &amp; dept</PfTh>
            <PfTh>Location</PfTh>
            <PfTh>Contract</PfTh>
            <PfTh>Tenure</PfTh>
            <PfTh>Performance</PfTh>
            <PfTh>Status</PfTh>
          </div>
          {filtered.map((e, i) => (
            <PersonRow key={e.id} e={e} last={i === filtered.length - 1} onOpen={() => openRecord(e)} />
          ))}
        </PfCard>
      )}
    </div>
  );
}
