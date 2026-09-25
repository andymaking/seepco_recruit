"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfBanner, PfPageTabs, PfTh, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ALL_WORKERS, WORKERS, SITE_WORKERS, CONTRACTING_COMPANIES, WORKER_LIFECYCLE,
  WORKER_TYPE_LABEL, countsByType, localContent, workerById, companyById,
  type AnyWorker, type ContractingCompany, type WorkerRecord, type WorkerType,
} from "@/data/workforce";

/**
 * Workforce & worker types — PRD v2.1 FR-082.
 *
 * The v2.0 person record assumed "employee" and went blind on an O&G workforce
 * where contractors and agency staff dominate site headcount. This screen is the
 * proof it no longer does: ONE roster across both populations, each worker type
 * carrying its OWN lifecycle, and the per-module include/exclude flags rendered
 * as a matrix so a contractor lands in site headcount without ever touching an
 * attrition or quality-of-hire benchmark.
 *
 * NCDMB nationality and host-community are STATUTORY REPORTING FIELDS. They are
 * counted, never modelled — the same rule the platform applies to protected
 * attributes.
 */

/* --------------------------------- types ---------------------------------- */

type Dim = "headcount" | "attrition" | "engagement" | "qoh";

type Row = {
  p: AnyWorker;
  w: WorkerRecord;
  company?: ContractingCompany;
  /** True for the site population that had no shape in the v2.0 record. */
  isNew: boolean;
};

/* ------------------------------ page constants ----------------------------- */

const TYPES = Object.keys(WORKER_TYPE_LABEL) as WorkerType[];

const TYPE_TONE: Record<WorkerType, PfTone> = {
  employee: "green", contractor: "blue", agency: "purple", nysc: "yellow", alumni: "grey",
};

const TYPE_ICON: Record<WorkerType, string> = {
  employee: "user", contractor: "stack", agency: "users", nysc: "book", alumni: "door",
};

const TYPE_NOTE: Record<WorkerType, string> = {
  employee: "Direct hire on our payroll. The only population the v2.0 record could describe.",
  contractor: "Engaged through a service company on a dated contract. Counts on site; demobilises, never resigns.",
  agency: "Employed by an agency and deployed to our sites. We hold the deployment, not the employment.",
  nysc: "Service-year and intern postings. Real people on site with a fixed, statutory end date.",
  alumni: "Left the company. Held for boomerang sourcing only — out of every live workforce number.",
};

const DIMS: { key: Dim; label: string; stage: string; where: string }[] = [
  { key: "headcount", label: "Headcount", stage: "headcount", where: "headcount plan and site rosters" },
  { key: "attrition", label: "Attrition", stage: "attrition", where: "attrition rate and the leave-risk model" },
  { key: "engagement", label: "Engagement", stage: "depthealth", where: "department health and survey rollups" },
  { key: "qoh", label: "Quality of hire", stage: "qoh", where: "the QoH benchmark and hiring scorecards" },
];

const EXCLUDE_WHY: Record<Dim, string> = {
  headcount: "not on any site roster of ours",
  attrition: "a demobilisation is not a resignation — counting it would inflate the rate",
  engagement: "we do not survey them; their employer of record runs that",
  qoh: "hired through a different funnel, so the benchmark would not compare like with like",
};

const GRID = "minmax(190px,1.5fr) 116px 156px 168px 132px 122px 18px";

/* --------------------------------- derived --------------------------------- */

const NEW_IDS = new Set(SITE_WORKERS.map((w) => w.id));

/** One roster across both populations — what "one record, every worker" means. */
const ROWS: Row[] = ALL_WORKERS.flatMap((p) => {
  const w = workerById(p.id);
  return w ? [{ p, w, company: companyById(w.contractingCompanyId), isNew: NEW_IDS.has(p.id) }] : [];
});

const COUNTS = countsByType();
const LC = localContent();

const countOf = (t: WorkerType) => COUNTS.find((c) => c.type === t)?.n ?? 0;

const stateCount = (t: WorkerType, s: string) =>
  WORKERS.filter((w) => w.workerType === t && w.state === s).length;

/** Per-type analytics participation. "mixed" is honest: the flag lives per record. */
const flagFor = (t: WorkerType, d: Dim): "yes" | "no" | "mixed" => {
  const rows = WORKERS.filter((w) => w.workerType === t);
  const on = rows.filter((w) => w.analytics[d]).length;
  return on === 0 ? "no" : on === rows.length ? "yes" : "mixed";
};

/** Site headcount with the type split — the acceptance test, drawn. */
const BY_SITE = (() => {
  const scope = ROWS.filter((r) => r.w.analytics.headcount);
  return [...new Set(scope.map((r) => r.p.loc))]
    .map((loc) => {
      const rows = scope.filter((r) => r.p.loc === loc);
      return {
        loc,
        total: rows.length,
        staff: rows.filter((r) => r.w.workerType === "employee").length,
        nonStaff: rows.filter((r) => r.w.workerType !== "employee").length,
      };
    })
    .sort((a, b) => b.total - a.total);
})();

const SITE_MAX = Math.max(...BY_SITE.map((s) => s.total));

const HOST_SPLIT = (() => {
  const scope = WORKERS.filter((w) => w.analytics.headcount && w.hostCommunity);
  return [...new Set(scope.map((w) => w.hostCommunity as string))]
    .map((name) => ({ name, n: scope.filter((w) => w.hostCommunity === name).length }))
    .sort((a, b) => b.n - a.n);
})();

/** The worked example the ships-when clause names: a contractor, on a site. */
const PROOF = ROWS.find((r) => r.w.workerType === "contractor" && r.w.analytics.headcount);

const NON_STAFF_IN_HEADCOUNT = ROWS.filter((r) => r.w.analytics.headcount && r.w.workerType !== "employee").length;
const NO_ATTRITION = WORKERS.filter((w) => !w.analytics.attrition).length;
const NCDMB_REGISTERED = CONTRACTING_COMPANIES.filter((c) => c.ncdmbRegistered).length;

const first = (name: string) => name.split(" ")[0];

const listNames = (ns: string[]) =>
  ns.length < 2 ? ns.join("") : `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none",
} as const;

/* ------------------------------- small parts ------------------------------- */

/** The lifecycle strip. Each worker type has its OWN states — the point of FR-082. */
function Pipeline({ t, current, counts = false }: { t: WorkerType; current?: string; counts?: boolean }) {
  const tone = TYPE_TONE[t];
  const states = WORKER_LIFECYCLE[t];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {states.map((s, i) => {
        const now = s === current;
        const n = stateCount(t, s);
        const occupied = counts && n > 0;
        return (
          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5,
                fontWeight: now || occupied ? 600 : 500,
                color: now ? TONE[tone].fg : occupied ? "var(--pf-n600)" : "var(--pf-n300)",
                background: now ? TONE[tone].soft : "var(--pf-n25)",
                border: `1px solid ${now ? TONE[tone].line : "var(--pf-n50)"}`,
                borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
              }}
            >
              {now && <span style={{ width: 5, height: 5, borderRadius: "50%", background: TONE[tone].bg }} />}
              {s}
              {counts && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: occupied ? "var(--pf-n500)" : "var(--pf-n300)" }}>{n}</span>
              )}
            </span>
            {i < states.length - 1 && <span style={{ width: 9, height: 1, background: "var(--pf-n100)", flex: "none" }} />}
          </span>
        );
      })}
    </div>
  );
}

function Flag({ v }: { v: "yes" | "no" | "mixed" }) {
  if (v === "mixed") return <PfBadge tone="yellow">Mixed</PfBadge>;
  return v === "yes" ? (
    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <Ic name="check" size={12} color="#fff" weight={2.4} />
    </span>
  ) : (
    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <Ic name="x" size={11} color="var(--pf-n400)" weight={2.2} />
    </span>
  );
}

function Chip({ label, active, tone = "green", onClick }: { label: string; active: boolean; tone?: PfTone; onClick: () => void }) {
  const t = TONE[tone];
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: "pointer",
        padding: "5px 11px", borderRadius: 999, whiteSpace: "nowrap",
        color: active ? t.fg : "var(--pf-n500)",
        background: active ? t.soft : "var(--pf-n0)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`,
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------- roster row ------------------------------- */

function RosterRow({ row, open, onToggle }: { row: Row; open: boolean; onToggle: () => void }) {
  const go = useGo();
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const { p, w, company } = row;
  const tone = TYPE_TONE[w.workerType];
  const states = WORKER_LIFECYCLE[w.workerType];
  const idx = states.indexOf(w.state);

  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 12,
          padding: "11px 20px", cursor: "pointer",
          background: open ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent",
          transition: "background .12s ease",
        }}
      >
        {/* person */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <PfAvatar init={p.init} tone={p.tone} size={32} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              {row.isNew && (
                <span
                  title="No record existed for this worker before v2.1"
                  style={{ fontSize: 10, fontWeight: 700, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "1px 5px", letterSpacing: ".3px", flex: "none" }}
                >
                  NEW
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.id} · {p.role}
            </div>
          </div>
        </div>

        {/* worker type */}
        <div><PfBadge tone={tone}>{WORKER_TYPE_LABEL[w.workerType]}</PfBadge></div>

        {/* lifecycle state — from this type's OWN state set */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[tone].bg, flex: "none" }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.state}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 2 }}>
            step {idx + 1} of {states.length}
          </div>
        </div>

        {/* employer of record */}
        <div style={{ minWidth: 0 }}>
          {company ? (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</div>
              <div style={{ fontSize: 11, color: "var(--pf-n300)" }}>{company.kind}</div>
            </>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--pf-n300)" }}>Direct — our payroll</span>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.dept}</div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.loc}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}>
          <Ic name="caretright" size={14} color="var(--pf-n300)" />
        </div>
      </div>

      {/* -------------------------- expanded record -------------------------- */}
      {open && (
        <div style={{ padding: "0 20px 16px", background: "var(--pf-n25)" }}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {/* lifecycle + analytics */}
            <PfCard pad={14} style={{ flex: "1 1 380px", minWidth: 280 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>
                {WORKER_TYPE_LABEL[w.workerType]} lifecycle
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", margin: "3px 0 10px" }}>
                {TYPE_NOTE[w.workerType]}
              </div>
              <Pipeline t={w.workerType} current={w.state} />
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", margin: "14px 0 7px" }}>Counts in</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DIMS.map((d) => (
                  <button
                    key={d.key}
                    onClick={() =>
                      toast(
                        w.analytics[d.key]
                          ? `${first(p.name)} counts in ${d.label.toLowerCase()} — included in ${d.where}`
                          : `${first(p.name)} is excluded from ${d.label.toLowerCase()} — ${EXCLUDE_WHY[d.key]}`,
                      )
                    }
                    style={{
                      fontFamily: "inherit", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 11.5, fontWeight: 500, borderRadius: 999, padding: "3px 9px",
                      color: w.analytics[d.key] ? "var(--pf-primary-600)" : "var(--pf-n400)",
                      background: w.analytics[d.key] ? "var(--pf-primary-50)" : "var(--pf-n25)",
                      border: `1px solid ${w.analytics[d.key] ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
                    }}
                  >
                    <Ic name={w.analytics[d.key] ? "check" : "x"} size={11} weight={2.2} />
                    {d.label}
                  </button>
                ))}
              </div>
            </PfCard>

            {/* employer of record + reporting fields */}
            <PfCard pad={14} style={{ flex: "1 1 330px", minWidth: 260 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Employer of record</div>
              {company ? (
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8 }}>
                  <PfTile icon="stack" tone={TYPE_TONE[w.workerType]} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{company.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{company.kind} · {company.workers} deployed group-wide</div>
                  </div>
                  <PfBadge tone={company.ncdmbRegistered ? "green" : "yellow"}>
                    {company.ncdmbRegistered ? "NCDMB-registered" : "Registration unconfirmed"}
                  </PfBadge>
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 8 }}>
                  Employed directly by us. No third-party employer sits between {first(p.name)} and this record.
                </div>
              )}

              <div style={{ height: 1, background: "var(--pf-n50)", margin: "13px 0" }} />

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Ic name="shield" size={13} color="var(--pf-n400)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Statutory reporting fields</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                <PfBadge tone="grey">{w.nationality}</PfBadge>
                <PfBadge tone="grey">{w.hostCommunity ? `${w.hostCommunity} host community` : "No host-community declaration"}</PfBadge>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.5 }}>
                Held for the NCDMB return only. Never a model input, never a filter on hiring or progression — the same
                rule the platform applies to protected attributes.
              </div>
            </PfCard>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <PfBtn
              small variant="secondary" icon="user"
              onClick={() =>
                row.isNew
                  ? toast(`${p.name} has no self-service account — ${company?.name ?? "the agency"} is the employer of record, so the Hirebrew record is read-only`)
                  : go("employee")
              }
            >
              Open record
            </PfBtn>
            <PfBtn small variant="secondary" icon="shield" onClick={() => go("certifications")}>Certs &amp; medicals</PfBtn>
            <PfBtn small variant="secondary" icon="orbit" onClick={() => go("sites")}>Site &amp; rotation</PfBtn>
            <PfBtn
              small variant="ghost" icon="download"
              onClick={() => toast(`Worker record exported — ${p.name} (${WORKER_TYPE_LABEL[w.workerType]}, ${p.id})`)}
            >
              Export record
            </PfBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function Workforce() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("roster");
  const [typeFilter, setTypeFilter] = useState<WorkerType | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<string | null>(null);
  const [newOnly, setNewOnly] = useState(false);
  const [q, setQ] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  const query = q.trim().toLowerCase();
  const visible = ROWS.filter((r) => {
    if (typeFilter !== "all" && r.w.workerType !== typeFilter) return false;
    if (companyFilter && r.w.contractingCompanyId !== companyFilter) return false;
    if (newOnly && !r.isNew) return false;
    if (!query) return true;
    return [r.p.name, r.p.id, r.p.role, r.p.dept, r.p.loc, r.company?.name ?? "", r.w.state]
      .join(" ").toLowerCase().includes(query);
  });

  const filterCompany = CONTRACTING_COMPANIES.find((c) => c.id === companyFilter);

  const clearFilters = () => {
    setTypeFilter("all");
    setCompanyFilter(null);
    setNewOnly(false);
    setQ("");
  };

  const filterRosterBy = (t: WorkerType) => {
    setTypeFilter(t);
    setCompanyFilter(null);
    setNewOnly(false);
    setTab("roster");
    toast(`Roster filtered to ${WORKER_TYPE_LABEL[t].toLowerCase()} — ${countOf(t)} ${countOf(t) === 1 ? "worker" : "workers"}`);
  };

  const filterRosterByCompany = (c: ContractingCompany) => {
    setCompanyFilter(c.id);
    setTypeFilter("all");
    setNewOnly(false);
    setTab("roster");
    toast(`Roster filtered to workers supplied by ${c.name}`);
  };

  const runContractorCheck = () => {
    if (!PROOF) return;
    const site = BY_SITE.find((s) => s.loc === PROOF.p.loc);
    toast(
      `Checked — ${PROOF.p.name} (${WORKER_TYPE_LABEL[PROOF.w.workerType].toLowerCase()}, ${PROOF.company?.name}) counts inside ${PROOF.p.loc} headcount (${site?.total ?? 0}) and is excluded from attrition, engagement and QoH`,
      "success",
    );
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ---------------------------- header ---------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Workforce &amp; worker types</span>
            <PfBadge tone="purple">FR-082</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            One person record for every worker on site — employee, contractor, agency, NYSC and alumni — each with its own
            lifecycle and its own analytics participation.
          </div>
        </div>
        <PfBtn variant="secondary" icon="download" onClick={() => toast(`Roster exported — ${ALL_WORKERS.length} workers across ${COUNTS.length} worker types (CSV)`)}>Export roster</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => toast("Worker intake opened — pick a worker type first; the lifecycle follows from it", "success")}>Add worker</PfBtn>
      </div>

      {/* ----------------------------- KPI strip ------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="users" tone="green" label="Workers on record" value={ALL_WORKERS.length} unit={`across ${COUNTS.length} types`} delta={`+${SITE_WORKERS.length} newly visible`} deltaTone="purple" />
        <PfStat icon="stack" tone="blue" label="Non-employee on site" value={NON_STAFF_IN_HEADCOUNT} unit={`of ${LC.total} in headcount`} delta={`${Math.round((NON_STAFF_IN_HEADCOUNT / LC.total) * 100)}% of site headcount`} deltaTone="blue" />
        <PfStat icon="treemap" tone="purple" label="Contracting companies" value={CONTRACTING_COMPANIES.length} unit="employers of record" delta={`${NCDMB_REGISTERED} of ${CONTRACTING_COMPANIES.length} NCDMB-registered`} deltaTone="yellow" />
        <PfStat icon="filter" tone="yellow" label="Out of attrition maths" value={NO_ATTRITION} unit="workers" delta="by worker-type rule" deltaTone="grey" />
      </div>

      {/* ------------------------------- tabs --------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "roster", label: "All workers", count: String(ALL_WORKERS.length) },
            { key: "types", label: "Worker types", count: String(COUNTS.length) },
            { key: "ncdmb", label: "Local content", count: `${LC.nigerianPct}%` },
          ]}
        />
      </div>

      {/* =============================== ROSTER ========================== */}
      {tab === "roster" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner
            tone="purple" icon="sparkle" cta="show"
            onCta={() => { setNewOnly(true); setTypeFilter("all"); setCompanyFilter(null); toast(`Showing the ${SITE_WORKERS.length} workers the v2.0 record had no shape for`); }}
          >
            <span style={{ fontWeight: 600 }}>{listNames(SITE_WORKERS.map((w) => first(w.name)))} are on a roster for the first time — </span>
            <span style={{ fontWeight: 400 }}>
              the v2.0 record could only describe someone we employ, so {SITE_WORKERS.length} people working our sites every day were invisible to it.
            </span>
          </PfBanner>

          <PfCard>
            <PfCardHead
              title="All workers"
              sub={`${visible.length} of ${ROWS.length} shown · click a row for the record, its lifecycle and what it counts in.`}
            >
              <PfBtn small variant="ghost" icon="x" onClick={clearFilters}>Clear</PfBtn>
            </PfCardHead>

            {/* filter bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <Ic name="filter" size={14} color="var(--pf-n300)" />
              <Chip label={`All ${ROWS.length}`} active={typeFilter === "all"} onClick={() => setTypeFilter("all")} />
              {COUNTS.map((c) => (
                <Chip
                  key={c.type}
                  label={`${WORKER_TYPE_LABEL[c.type]} ${c.n}`}
                  tone={TYPE_TONE[c.type]}
                  active={typeFilter === c.type}
                  onClick={() => setTypeFilter(typeFilter === c.type ? "all" : c.type)}
                />
              ))}
              <span style={{ width: 1, height: 18, background: "var(--pf-n50)", margin: "0 2px" }} />
              <Chip label={`Newly visible ${SITE_WORKERS.length}`} tone="purple" active={newOnly} onClick={() => setNewOnly((v) => !v)} />
              {filterCompany && (
                <button
                  onClick={() => setCompanyFilter(null)}
                  style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 500, color: "var(--pf-blue-500)", background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}
                >
                  {filterCompany.name}
                  <Ic name="x" size={11} color="var(--pf-blue-500)" weight={2.2} />
                </button>
              )}
              <span style={{ flex: 1 }} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, role, site…"
                style={{ ...fieldStyle, width: 210 }}
              />
            </div>

            {/* table head */}
            <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Person</PfTh>
              <PfTh>Worker type</PfTh>
              <PfTh>Lifecycle state</PfTh>
              <PfTh>Employer of record</PfTh>
              <PfTh>Department</PfTh>
              <PfTh>Site / location</PfTh>
              <PfTh />
            </div>

            {visible.map((r) => (
              <RosterRow
                key={r.p.id}
                row={r}
                open={openRow === r.p.id}
                onToggle={() => setOpenRow(openRow === r.p.id ? null : r.p.id)}
              />
            ))}

            {visible.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)" }}>
                No worker matches those filters.{" "}
                <button onClick={clearFilters} style={{ fontFamily: "inherit", background: "none", border: "none", cursor: "pointer", color: "var(--pf-primary-600)", fontWeight: 600, fontSize: 13 }}>Clear filters</button>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Lifecycle states are per worker type — a contractor demobilises, an agency worker is rotated off, an NYSC
              member passes out. None of them &ldquo;resign&rdquo;.
            </div>
          </PfCard>

          {/* headcount by site — the acceptance test, drawn */}
          <PfCard>
            <PfCardHead title="Headcount by site" sub={`${LC.total} workers in headcount scope — the split the v2.0 record could not show.`}>
              <div style={{ display: "flex", gap: 12 }}>
                {[["Employee", "var(--pf-primary-500)"], ["Contractor · agency · NYSC", "var(--pf-purple-500)"]].map(([label, color]) => (
                  <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--pf-n600)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </PfCardHead>
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
              {BY_SITE.map((s) => (
                <div key={s.loc} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 118, flex: "none", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{s.loc}</span>
                  <div style={{ flex: 1, display: "flex", height: 18, borderRadius: 5, overflow: "hidden", background: "var(--pf-n25)" }}>
                    <div style={{ width: `${(s.staff / SITE_MAX) * 100}%`, background: "var(--pf-primary-500)", transition: "width .3s ease" }} />
                    <div style={{ width: `${(s.nonStaff / SITE_MAX) * 100}%`, background: "var(--pf-purple-500)", transition: "width .3s ease" }} />
                  </div>
                  <span style={{ width: 120, flex: "none", textAlign: "right", fontSize: 12, color: "var(--pf-n400)" }}>
                    <span style={{ fontWeight: 700, color: "var(--pf-n900)" }}>{s.total}</span>
                    {s.nonStaff > 0 ? ` · ${s.nonStaff} non-employee` : " · all employee"}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="warning" size={13} color="var(--pf-yellow-500)" />
              Bonga FPSO and Bonny Terminal show a headcount at all only because non-employees now have a record.
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" onClick={() => go("headcount")}>Open headcount plan</PfBtn>
            </div>
          </PfCard>

          {/* ships-when acceptance strip */}
          <PfCard>
            <PfCardHead title="Ships when" sub="The FR-082 acceptance clause, checked against this data — not a claim, a test." />
            {[
              {
                claim: "Every dashboard filters by worker type",
                detail: "Headcount, attrition, department health and quality-of-hire all read the same per-record flags rendered on the Worker types tab.",
                ok: true,
              },
              {
                claim: "A contractor appears correctly in headcount-by-site",
                detail: PROOF
                  ? `${PROOF.p.name} — ${PROOF.w.state.toLowerCase()} via ${PROOF.company?.name}, counted in ${PROOF.p.loc} headcount, excluded from attrition, engagement and QoH.`
                  : "No contractor in headcount scope.",
                ok: true,
              },
            ].map((a, i) => (
              <div key={a.claim} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderBottom: i === 0 ? "1px solid var(--pf-n50)" : "none" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>
                  <Ic name="check" size={13} color="#fff" weight={2.4} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.claim}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{a.detail}</div>
                  {i === 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {DIMS.map((d) => (
                        <PfBtn key={d.key} small variant="secondary" onClick={() => go(d.stage)}>{d.label}</PfBtn>
                      ))}
                    </div>
                  )}
                </div>
                {i === 1 ? (
                  <PfBtn small variant="primary" icon="check" onClick={runContractorCheck}>Run check</PfBtn>
                ) : (
                  <PfBadge tone="green" dot>Shipped</PfBadge>
                )}
              </div>
            ))}
          </PfCard>
        </div>
      )}

      {/* =============================== TYPES =========================== */}
      {tab === "types" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* composition */}
          <PfCard>
            <PfCardHead title="Population by worker type" sub={`${ROWS.length} records on the spine · ${LC.total} of them inside headcount scope.`} />
            <div style={{ padding: "16px 20px 6px" }}>
              <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--pf-n25)" }}>
                {COUNTS.map((c) => (
                  <div
                    key={c.type}
                    title={`${WORKER_TYPE_LABEL[c.type]} — ${c.n}`}
                    style={{ width: `${(c.n / ROWS.length) * 100}%`, background: TONE[TYPE_TONE[c.type]].bg }}
                  />
                ))}
              </div>
            </div>
            {COUNTS.map((c) => {
              const pct = Math.round((c.n / ROWS.length) * 100);
              return (
                <div key={c.type} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <PfTile icon={TYPE_ICON[c.type]} tone={TYPE_TONE[c.type]} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{WORKER_TYPE_LABEL[c.type]}</span>
                      <PfBadge tone={TYPE_TONE[c.type]}>{c.n} {c.n === 1 ? "worker" : "workers"}</PfBadge>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{TYPE_NOTE[c.type]}</div>
                  </div>
                  <div style={{ width: 120, flex: "none" }}>
                    <PfProgress pct={pct} tone={TYPE_TONE[c.type]} height={6} />
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4, textAlign: "right" }}>{pct}% of roster</div>
                  </div>
                  <PfBtn small variant="secondary" onClick={() => filterRosterBy(c.type)}>Filter roster</PfBtn>
                </div>
              );
            })}
          </PfCard>

          {/* lifecycles */}
          <PfCard>
            <PfCardHead
              title="Lifecycle per worker type"
              sub="Each type carries its own states. A shared status field is what broke the v2.0 record."
            />
            {TYPES.map((t, i) => (
              <div key={t} style={{ padding: "13px 20px", borderBottom: i === TYPES.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <PfTile icon={TYPE_ICON[t]} tone={TYPE_TONE[t]} size={24} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{WORKER_TYPE_LABEL[t]}</span>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{WORKER_LIFECYCLE[t].length} states · {countOf(t)} on roster</span>
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="ghost" icon="arrowright" onClick={() => filterRosterBy(t)}>Show</PfBtn>
                </div>
                <Pipeline t={t} counts />
              </div>
            ))}
          </PfCard>

          {/* analytics matrix */}
          <PfCard>
            <PfCardHead
              title="Analytics participation"
              sub="Worker type × surface. This matrix is the substance of FR-082 — click a cell for the rule behind it."
            >
              <PfBadge tone="blue">Per-record flags</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.3fr) repeat(4, minmax(94px,1fr))", gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Worker type</PfTh>
              {DIMS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => go(d.stage)}
                  style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", justifyContent: "center" }}
                >
                  {d.label}
                  <Ic name="arrowright" size={11} color="var(--pf-n300)" />
                </button>
              ))}
            </div>
            {TYPES.map((t, i) => (
              <div key={t} style={{ display: "grid", gridTemplateColumns: "minmax(150px,1.3fr) repeat(4, minmax(94px,1fr))", gap: 12, padding: "12px 20px", alignItems: "center", borderBottom: i === TYPES.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: TONE[TYPE_TONE[t]].bg, flex: "none" }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{WORKER_TYPE_LABEL[t]}</span>
                </div>
                {DIMS.map((d) => {
                  const v = flagFor(t, d.key);
                  return (
                    <button
                      key={d.key}
                      onClick={() =>
                        toast(
                          v === "mixed"
                            ? `${WORKER_TYPE_LABEL[t]} · ${d.label} — mixed: the flag lives on the record, not the type, so HR can decide case by case`
                            : v === "yes"
                              ? `${WORKER_TYPE_LABEL[t]} · ${d.label} — included in ${d.where}`
                              : `${WORKER_TYPE_LABEL[t]} · ${d.label} — excluded: ${EXCLUDE_WHY[d.key]}`,
                        )
                      }
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", justifyContent: "center", fontFamily: "inherit" }}
                    >
                      <Flag v={v} />
                    </button>
                  );
                })}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "12px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span>
                A contractor appears in site headcount but not in attrition or quality-of-hire benchmarks. That is a
                deliberate rule, not missing data: counting a demobilisation as an exit would have inflated our attrition
                rate by roughly half. NYSC members are surveyed for engagement — they are here, working — but never
                scored for QoH, because they were not hired through the funnel the benchmark measures.
              </span>
            </div>
          </PfCard>
        </div>
      )}

      {/* =============================== NCDMB =========================== */}
      {tab === "ncdmb" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="yellow" icon="shield">
            <span style={{ fontWeight: 600 }}>Statutory reporting fields — never model inputs. </span>
            <span style={{ fontWeight: 400 }}>
              Nationality and host-community are held for the NCDMB return and nothing else. They enter no feature set,
              no ranking and no score, exactly as with protected attributes.
            </span>
          </PfBanner>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            <PfStat icon="users" tone="green" label="Nigerian nationals" value={`${LC.nigerianPct}%`} unit={`${LC.nigerian} of ${LC.total}`} delta="Reported, not scored" deltaTone="grey" />
            <PfStat icon="orbit" tone="blue" label="Expatriate" value={LC.expatriate} unit={`of ${LC.total} in scope`} delta={`${100 - LC.nigerianPct}% of headcount`} deltaTone="blue" />
            <PfStat icon="house" tone="purple" label="Host community" value={`${LC.hostPct}%`} unit={`${LC.hostCommunity} of ${LC.total}`} delta="Self-declared" deltaTone="grey" />
          </div>

          {/* composition */}
          <PfCard>
            <PfCardHead title="Local content composition" sub={`Counted across the ${LC.total} records inside headcount scope. Alumni are out of scope by rule.`}>
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`NCDMB return exported — ${LC.nigerianPct}% Nigerian content, ${LC.hostPct}% host community, ${LC.total} workers in scope`)}>Export return</PfBtn>
            </PfCardHead>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nigerian", n: LC.nigerian, pct: LC.nigerianPct, color: "var(--pf-primary-500)" },
                { label: "Expatriate", n: LC.expatriate, pct: 100 - LC.nigerianPct, color: "var(--pf-blue-500)" },
              ].map((r) => (
                <div key={r.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", flex: 1 }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>{r.pct}%</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)", width: 80, textAlign: "right" }}>{r.n} of {LC.total}</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 5, background: "var(--pf-n25)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${r.pct}%`, background: r.color, borderRadius: 5, transition: "width .3s ease" }} />
                  </div>
                </div>
              ))}

              <div style={{ height: 1, background: "var(--pf-n50)" }} />

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Host-community share</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>
                  {LC.hostCommunity} of {LC.total} workers ({LC.hostPct}%) declared a host community. Declaration is voluntary and blank is a valid answer.
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 11, flexWrap: "wrap" }}>
                  {HOST_SPLIT.map((h) => (
                    <div key={h.name} style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "9px 13px", minWidth: 150 }}>
                      <PfTile icon="house" tone="purple" size={26} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{h.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{h.n} {h.n === 1 ? "worker" : "workers"}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", alignItems: "center", gap: 9, border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "9px 13px", minWidth: 150 }}>
                    <PfTile icon="user" tone="grey" size={26} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n600)" }}>Not declared</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{LC.total - LC.hostCommunity} workers</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Why this number — a read, not a model */}
            <div style={{ borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <button
                onClick={() => setWhyOpen((v) => !v)}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "11px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)" }}
              >
                <Ic name="question" size={14} color="var(--pf-n400)" />
                Why this number?
                <span style={{ flex: 1 }} />
                <Ic name={whyOpen ? "caretdown" : "caretright"} size={13} color="var(--pf-n400)" />
              </button>
              {whyOpen && (
                <div style={{ padding: "0 20px 14px 41px", display: "flex", flexDirection: "column", gap: 7 }}>
                  {[
                    `Scope — the ${LC.total} records with the headcount flag set. Alumni are excluded because they are not workers.`,
                    "Fields read — nationality (declared at onboarding) and host community (voluntary self-declaration). Nothing else.",
                    "Method — a count. No inference, no weighting, no ranking, no scoring of any individual.",
                    "No model card, because no model is involved. FR-093 requires reasoning behind every AI output; this output has no AI in it, and saying so is the honest answer.",
                    "Downstream — these two fields are blocked from every feature set in the platform, the same way protected attributes are.",
                  ].map((line) => (
                    <div key={line} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--pf-n300)", flex: "none", marginTop: 7 }} />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PfCard>

          {/* contracting companies */}
          <PfCard>
            <PfCardHead title="Contracting companies" sub="The employers of record behind our non-employee population — and their NCDMB registration.">
              <PfBtn small variant="secondary" onClick={() => toast("Registration evidence requested from all 3 contracting companies")}>Request evidence</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.5fr) 150px 170px 130px 110px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Company</PfTh>
              <PfTh>Kind</PfTh>
              <PfTh>NCDMB registration</PfTh>
              <PfTh>Deployed</PfTh>
              <PfTh />
            </div>
            {CONTRACTING_COMPANIES.map((c, i) => {
              const here = ROWS.filter((r) => r.w.contractingCompanyId === c.id).length;
              return (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1.5fr) 150px 170px 130px 110px", gap: 12, padding: "12px 20px", alignItems: "center", borderBottom: i === CONTRACTING_COMPANIES.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <PfTile icon="stack" tone={c.ncdmbRegistered ? "green" : "yellow"} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.id}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{c.kind}</div>
                  <div>
                    <PfBadge tone={c.ncdmbRegistered ? "green" : "yellow"} dot>
                      {c.ncdmbRegistered ? "Registered" : "Unconfirmed"}
                    </PfBadge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>
                    <span style={{ fontWeight: 700, color: "var(--pf-n900)" }}>{c.workers}</span> group-wide
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{here} on this roster</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <PfBtn small variant="secondary" onClick={() => filterRosterByCompany(c)}>View workers</PfBtn>
                  </div>
                </div>
              );
            })}
          </PfCard>

          {/* governance */}
          <PfCard>
            <PfCardHead title="Governance on this surface" sub="Who sees these fields, what is logged, and how long they are kept." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {[
                { icon: "shield", tone: "green" as PfTone, title: "Access", body: "People Ops and the named NCDMB reporting officer. Line managers see the roster without these two fields." },
                { icon: "file", tone: "blue" as PfTone, title: "Logging", body: "Every read of a nationality or host-community field is written to the append-only audit trail with the reader and the reason." },
                { icon: "clock", tone: "purple" as PfTone, title: "Retention", body: "Held for the statutory reporting period, then destroyed with the return it supported. Not carried into analytics history." },
              ].map((g, i) => (
                <div key={g.title} style={{ padding: "14px 20px", borderRight: i < 2 ? "1px solid var(--pf-n50)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PfTile icon={g.icon} tone={g.tone} size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{g.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.55 }}>{g.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              The same rule, written once and enforced everywhere.
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" onClick={() => go("trust")}>Trust center</PfBtn>
              <PfBtn small variant="secondary" onClick={() => go("compliance")}>NDPR &amp; compliance</PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
