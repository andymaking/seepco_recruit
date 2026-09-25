"use client";
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { CONTRACTS, EMPLOYEES, type ContractRow } from "@/data/talentos";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfBanner, PfAvatar, PfTh, PfPageTabs, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------------------------------------------ */
/* Contracts & Documents — FR-061                                      */
/* Contract types + duration timelines, 90/60/30 expiry radar,         */
/* renewal workflow (Stage 9/10 doc engine), NDPR document vault.      */
/* ------------------------------------------------------------------ */

type CType = "Permanent" | "Fixed-term" | "Contractor" | "NYSC/Intern";

const TYPE_TONE: Record<CType, PfTone> = {
  Permanent: "grey",
  "Fixed-term": "blue",
  Contractor: "purple",
  "NYSC/Intern": "yellow",
};

function typeOf(row: ContractRow): CType {
  if (row.type.startsWith("Contractor")) return "Contractor";
  if (row.type.startsWith("Fixed-term")) return "Fixed-term";
  if (row.type.startsWith("NYSC")) return "NYSC/Intern";
  return "Permanent";
}

function agencyOf(row: ContractRow): string | null {
  const m = row.type.match(/agency:\s*([^)]+)/);
  return m ? m[1] : null;
}

/** Urgency tone for the remaining-runway tint + days-left chip. */
function urgency(row: ContractRow): PfTone {
  if (row.daysLeft >= 9999) return "green";
  if (row.daysLeft <= 30) return "red";
  if (row.daysLeft <= 90) return "yellow";
  return "green";
}

const URGENCY_FILL: Record<PfTone, string> = {
  green: "var(--pf-primary-100)",
  yellow: "var(--pf-yellow-100)",
  red: "var(--pf-red-100)",
  blue: "var(--pf-blue-100)",
  purple: "var(--pf-purple-100)",
  grey: "var(--pf-n100)",
};

const DAY = 86_400_000;

/** Fallback avatar tones for people not in the EMPLOYEES directory. */
const FALLBACK_TONES = ["#16B364", "#AF52DE", "#EBA308", "#16B364", "#E81E17"];

function personOf(name: string, i: number) {
  const emp = EMPLOYEES.find((e) => e.name === name);
  if (emp) return { init: emp.init, tone: emp.tone };
  const init = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return { init, tone: FALLBACK_TONES[i % FALLBACK_TONES.length] };
}

/* ------------------------- Renewal workflow ------------------------- */
/* Per-contract step: 0 = not started · 1 = drafted · 2 = approved · 3 = e-sign out */

const STEPS = [
  { label: "Draft", sub: "Stage 9/10 doc engine" },
  { label: "Approvals", sub: "HR Ops + dept head" },
  { label: "e-sign", sub: "Both parties" },
];

const STAGE_LABEL = ["not started", "draft ready — awaiting approvals", "approved — awaiting e-sign", "out for e-signature"];

/* --------------------------- Document vault ------------------------- */

type VaultDoc = { name: string; owner: string; up: string; icon: string; tone: PfTone; retention: string; retTone: PfTone };

const VAULT: VaultDoc[] = [
  { name: "Offer letter", owner: "Amara Okonkwo", up: "Nov 12, 2023", icon: "paperplane", tone: "blue", retention: "Retain 6y post-exit", retTone: "grey" },
  { name: "Contract v2", owner: "Seyi Ajayi", up: "Jan 30, 2026", icon: "clipboard", tone: "purple", retention: "Retain 6y post-exit", retTone: "grey" },
  { name: "NDA", owner: "Kelechi Umeh", up: "Oct 1, 2025", icon: "shield", tone: "green", retention: "Archive on offboarding", retTone: "yellow" },
  { name: "ESOP letter", owner: "Ngozi Obi", up: "Apr 4, 2026", icon: "wallet", tone: "yellow", retention: "Retain 6y post-exit", retTone: "grey" },
  { name: "Medical cert", owner: "Emeka Nwosu", up: "Feb 18, 2026", icon: "heart", tone: "red", retention: "Archive on offboarding", retTone: "yellow" },
  { name: "ID verification", owner: "Maryam Garba", up: "Nov 3, 2025", icon: "user", tone: "grey", retention: "Retain 6y post-exit", retTone: "grey" },
];

/* ---------------------- Duration timeline bar ----------------------- */

function Timeline({ row }: { row: ContractRow }) {
  const tone = urgency(row);
  const open = row.end === "—";
  let pct = 0.18; // open-ended default: young evergreen contract
  if (!open) {
    const total = (Date.parse(row.end) - Date.parse(row.start)) / DAY;
    pct = Math.max(0.04, Math.min(0.97, (total - row.daysLeft) / total));
  }
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ position: "relative", height: 7, borderRadius: 5, background: open ? "var(--pf-n50)" : URGENCY_FILL[tone], overflow: "visible" }}>
        {open && (
          <div style={{ position: "absolute", inset: 0, borderRadius: 5, background: "linear-gradient(90deg, var(--pf-primary-100) 55%, transparent 100%)" }} />
        )}
        {/* elapsed */}
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%", width: `${pct * 100}%`, borderRadius: 5, background: "var(--pf-n300)" }} />
        {/* today marker */}
        <div style={{ position: "absolute", top: -2.5, left: `calc(${pct * 100}% - 1px)`, width: 2, height: 12, borderRadius: 2, background: "var(--pf-n900)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10.5, color: "var(--pf-n300)", gap: 8 }}>
        <span>{row.start}</span>
        <span>{open ? "open-ended" : row.end}</span>
      </div>
    </div>
  );
}

/* --------------------------- Step chip ------------------------------ */

function StepChip({ n, label, sub, state }: { n: number; label: string; sub: string; state: "done" | "current" | "todo" }) {
  const palette: Record<string, CSSProperties> = {
    done: { background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", color: "var(--pf-primary-600)" },
    current: { background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", color: "var(--pf-blue-500)" },
    todo: { background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", color: "var(--pf-n400)" },
  };
  return (
    <div style={{ ...palette[state], borderRadius: 9, padding: "8px 12px", display: "flex", alignItems: "center", gap: 9, flex: "1 1 0", minWidth: 0 }}>
      <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-n0)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none", border: "1px solid currentcolor" }}>
        {state === "done" ? <Ic name="check" size={11} weight={2.4} /> : n}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ display: "block", fontSize: 11, opacity: 0.75, lineHeight: 1.3, whiteSpace: "nowrap" }}>{sub}</span>
      </span>
    </div>
  );
}

/* --------------------------- Vault tile ----------------------------- */

function VaultTile({ doc, onDownload }: { doc: VaultDoc; onDownload: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{ border: "1px solid var(--pf-n100)", borderRadius: 10, padding: 12, background: hovered ? "var(--pf-n25)" : "var(--pf-n0)", display: "flex", flexDirection: "column", gap: 8, transition: "background .15s ease" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <PfTile icon={doc.icon} tone={doc.tone} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.3 }}>{doc.name}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>{doc.owner}</div>
        </div>
        <button
          onClick={onDownload}
          title="Download (access is logged)"
          style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 7, width: 26, height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--pf-n500)", flex: "none" }}
        >
          <Ic name="download" size={13} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <PfBadge tone={doc.retTone}>{doc.retention}</PfBadge>
        <span style={{ fontSize: 11, color: "var(--pf-n300)", whiteSpace: "nowrap" }}>up. {doc.up}</span>
      </div>
    </div>
  );
}

/* ---------------------------- Filter chip --------------------------- */

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "5px 11px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
        background: active ? "var(--pf-primary-50)" : "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
        color: active ? "var(--pf-primary-600)" : "var(--pf-n500)",
      }}
    >
      {label}
    </button>
  );
}

/* ---------------------------- Table row ----------------------------- */

const GRID = "minmax(180px,1.5fr) minmax(140px,1.15fr) minmax(110px,0.9fr) minmax(170px,1.5fr) 92px 108px 132px";

function ContractRowView({ row, i, flash, open, step, onToggleRenew, onView, onPerson, onAdvance }: {
  row: ContractRow; i: number; flash: boolean; open: boolean; step: number;
  onToggleRenew: () => void; onView: () => void; onPerson: () => void; onAdvance: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const t = typeOf(row);
  const agency = agencyOf(row);
  const u = urgency(row);
  const person = personOf(row.name, i);
  const evergreen = row.daysLeft >= 9999;

  const stateBadge: ReactNode =
    step > 0 ? <PfBadge tone="blue" dot>Renewal · step {Math.min(step, 3)}/3</PfBadge>
    : row.state === "active" ? <PfBadge tone="green" dot>Active</PfBadge>
    : row.state === "expiring-30" ? <PfBadge tone="red" dot>30-day alert</PfBadge>
    : row.state === "expiring-60" ? <PfBadge tone="yellow" dot>60-day alert</PfBadge>
    : row.state === "expiring-90" ? <PfBadge tone="yellow" dot>90-day alert</PfBadge>
    : <PfBadge tone="red" dot>Expired</PfBadge>;

  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        style={{
          display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 12, padding: "12px 20px",
          background: flash ? "var(--pf-yellow-50)" : hovered ? "var(--pf-n25)" : "transparent",
          transition: "background .35s ease",
        }}
      >
        {/* person */}
        <div onClick={onPerson} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0 }}>
          <PfAvatar init={person.init} tone={person.tone} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecorationLine: hovered ? "underline" : "none", textDecorationColor: "var(--pf-n300)", textUnderlineOffset: 3 }}>{row.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>{row.id}</div>
          </div>
        </div>
        {/* type */}
        <div style={{ minWidth: 0 }}>
          <PfBadge tone={TYPE_TONE[t]}>{agency ? `Contractor · ${agency}` : t === "Fixed-term" ? row.type : t}</PfBadge>
        </div>
        {/* dept */}
        <div style={{ fontSize: 13, color: "var(--pf-n500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.dept}</div>
        {/* timeline */}
        <Timeline row={row} />
        {/* days left */}
        <div><PfBadge tone={evergreen ? "green" : u}>{evergreen ? "Evergreen" : `${row.daysLeft}d left`}</PfBadge></div>
        {/* state */}
        <div>{stateBadge}</div>
        {/* actions */}
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          {!evergreen && (
            <PfBtn small variant={open ? "secondary" : row.state === "expiring-30" ? "primary" : "secondary"} onClick={onToggleRenew} style={open ? { background: "var(--pf-n50)" } : undefined}>
              Renew
            </PfBtn>
          )}
          <PfBtn small variant="ghost" icon="file" onClick={onView}>View</PfBtn>
        </div>
      </div>

      {/* ------- inline renewal workflow panel ------- */}
      {open && (
        <div style={{ margin: "0 20px 14px", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <PfTile icon="swap" tone="blue" size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Renewal workflow — {row.name}</div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Zero-surprise SLA: signed ≥7 days before expiry · currently {STAGE_LABEL[Math.min(step, 3)]}</div>
            </div>
            <button onClick={onToggleRenew} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pf-n400)", padding: 4 }}><Ic name="x" size={15} /></button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {STEPS.map((s, si) => (
              <div key={s.label} style={{ display: "contents" }}>
                <StepChip n={si + 1} label={s.label} sub={s.sub} state={step > si ? "done" : step === si ? "current" : "todo"} />
                {si < STEPS.length - 1 && <Ic name="caretright" size={13} color="var(--pf-n300)" />}
              </div>
            ))}
          </div>
          {step >= 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12, color: "var(--pf-n500)" }}>
              <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
              Draft {row.id}-R1 · Nigerian-law {typeOf(row).toLowerCase()} template v3 · engine confidence 96% · human approval required before send
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {step === 0 && <PfBtn small variant="primary" icon="sparkle" onClick={onAdvance}>Generate renewal draft</PfBtn>}
            {step === 1 && <PfBtn small variant="primary" icon="paperplane" onClick={onAdvance}>Route for approvals</PfBtn>}
            {step === 2 && <PfBtn small variant="primary" icon="clipboard" onClick={onAdvance}>Send for e-signature</PfBtn>}
            {step >= 3 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-600)", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 8, padding: "6px 11px" }}>
                <Ic name="check" size={13} weight={2.2} /> Out for e-signature — expiry surprise averted
              </span>
            )}
            <PfBtn small variant="ghost" onClick={onView}>Open contract file</PfBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Screen ============================== */

export default function Contracts() {
  const go = useGo();
  const toast = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState("register");
  const [typeF, setTypeF] = useState<"All" | CType>("All");
  const [windowF, setWindowF] = useState(0); // 0 = any · 90 / 60 / 30
  const [openRenew, setOpenRenew] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<string, number>>({});
  const [drawer, setDrawer] = useState<ContractRow | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const rows = useMemo(
    () => CONTRACTS.filter((r) => (typeF === "All" || typeOf(r) === typeF) && (windowF === 0 || r.daysLeft <= windowF)),
    [typeF, windowF],
  );

  const seyiStep = steps["CT-882"] ?? 0;

  const jumpToSeyi = () => {
    setTab("register");
    setTypeF("All");
    setWindowF(0);
    setOpenRenew("CT-882");
    setFlash("CT-882");
    window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    window.setTimeout(() => setFlash(null), 1800);
    if (seyiStep === 0) toast("Jumped to CT-882 — renewal workflow opened for Seyi Ajayi", "default");
  };

  const advance = (row: ContractRow) => {
    const cur = steps[row.id] ?? 0;
    const next = Math.min(cur + 1, 3);
    setSteps((s) => ({ ...s, [row.id]: next }));
    if (next === 1) toast("Drafted by the Stage-9 document engine · Nigerian-law template", "ai");
    if (next === 2) toast(`Renewal ${row.id}-R1 routed — HR Ops + ${row.dept} lead notified`, "success");
    if (next === 3) toast(`e-sign request sent to ${row.name} and the Hirebrew signatory`, "success");
  };

  const openDrawer = (row: ContractRow) => setDrawer(row);

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ------------------------------ Header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Contracts &amp; Documents</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Contract lifecycle, 90/60/30 expiry radar and the NDPR-governed document vault · FR-061
          </div>
        </div>
        <PfBtn icon="download" onClick={() => toast("Contract register exported — CSV + access-audit manifest", "success")}>Export register</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => toast("New contract wizard — drafted by the Stage 9/10 document engine", "ai")}>New contract</PfBtn>
      </div>

      {/* ----------------- Expiry alert (page-wide) -------------------------- */}
      <div>
        {seyiStep === 0 ? (
          <PfBanner tone="red" icon="warning" cta="go" onCta={jumpToSeyi}>
            Seyi Ajayi&apos;s contractor agreement expires in 28 days — renewal not yet started.
          </PfBanner>
        ) : (
          <PfBanner tone="green" icon="check" cta="go" onCta={jumpToSeyi}>
            Seyi Ajayi&apos;s renewal is in motion — {STAGE_LABEL[Math.min(seyiStep, 3)]}. Zero-surprise SLA on track.
          </PfBanner>
        )}
      </div>

      {/* ---------------------------- Section tabs -------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "register", label: "Contract register", count: String(rows.length) },
            { key: "vault", label: "Document vault", count: String(VAULT.length) },
            { key: "agency", label: "Agency workers", count: "21" },
          ]}
        />
      </div>

      {tab === "register" && (
      <>
      {/* ------------------------------ KPI strip --------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        <PfStat icon="clipboard" tone="green" label="Active contracts" value="358" unit="tracked" delta="+4 MoM" deltaTone="green" />
        <PfStat icon="clock" tone="yellow" label="Expiring ≤90d" value="3" unit="contracts" delta="All alerted" deltaTone="yellow" />
        <PfStat icon="warning" tone="red" label="Expiring ≤30d" value={<span style={{ color: "var(--pf-red-500)" }}>1</span>} unit="renewal due" delta="Act now" deltaTone="red" />
        <PfStat icon="target" tone="green" label="Zero-surprise target" value="100%" unit="expiries alerted ≥30d out" delta="On target" deltaTone="green" />
      </div>

      {/* --------------------------- Contract table ------------------------- */}
      <div ref={tableRef} style={{ scrollMarginTop: 16 }}>
        <PfCard style={{ marginBottom: 12, overflow: "hidden" }}>
          <PfCardHead title="Contract register" sub="358 tracked · most urgent first · alerts fire at 90/60/30 days">
            <PfBadge tone="grey">5 shown</PfBadge>
          </PfCardHead>

          {/* filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
            {(["All", "Permanent", "Fixed-term", "Contractor", "NYSC/Intern"] as const).map((t) => (
              <FilterChip key={t} label={t} active={typeF === t} onClick={() => setTypeF(t)} />
            ))}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Expiring window</span>
            <select
              value={windowF}
              onChange={(e) => setWindowF(Number(e.target.value))}
              style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "5px 8px", cursor: "pointer" }}
            >
              <option value={0}>Any</option>
              <option value={90}>≤ 90 days</option>
              <option value={60}>≤ 60 days</option>
              <option value={30}>≤ 30 days</option>
            </select>
          </div>

          {/* header row */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTh>Person</PfTh>
            <PfTh>Contract type</PfTh>
            <PfTh>Department</PfTh>
            <PfTh>Duration · today ▾</PfTh>
            <PfTh>Days left</PfTh>
            <PfTh>State</PfTh>
            <PfTh style={{ textAlign: "right" }}>Actions</PfTh>
          </div>

          {rows.map((row, i) => (
            <ContractRowView
              key={row.id}
              row={row}
              i={i}
              flash={flash === row.id}
              open={openRenew === row.id}
              step={steps[row.id] ?? 0}
              onToggleRenew={() => setOpenRenew(openRenew === row.id ? null : row.id)}
              onView={() => openDrawer(row)}
              onPerson={() => go("employee")}
              onAdvance={() => advance(row)}
            />
          ))}

          {rows.length === 0 && (
            <div style={{ margin: 16, background: "var(--pf-n25)", borderRadius: 8, padding: "18px 12px", textAlign: "center", fontSize: 13.5, color: "var(--pf-n300)" }}>
              No contracts match — permanent contracts are evergreen and never enter an expiry window.
            </div>
          )}

          <div style={{ padding: "11px 20px", fontSize: 12, color: "var(--pf-n300)", display: "flex", alignItems: "center", gap: 6 }}>
            <Ic name="info" size={13} />
            Showing 5 of 358 tracked contracts — the remaining 353 are healthy (&gt;90 days out or evergreen).
          </div>
        </PfCard>
      </div>
      </>
      )}

      {/* ---------------------- Vault + retention ---------------------------- */}
      {tab === "vault" && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, alignItems: "start" }}>
        {/* Document vault */}
        <PfCard>
          <PfCardHead title="Document vault" sub="Every access is logged · retention enforced by NDPR schedule">
            <PfBtn small icon="plus" onClick={() => toast("Upload queued — classification + retention schedule auto-assigned on ingest", "ai")}>Upload</PfBtn>
          </PfCardHead>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: 16 }}>
            {VAULT.map((doc) => (
              <VaultTile
                key={doc.name}
                doc={doc}
                onDownload={() => toast(`Access logged — ${doc.name} · ${doc.owner} · NDPR audit trail updated`, "success")}
              />
            ))}
          </div>
        </PfCard>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Retention schedules note */}
          <PfCard pad={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <PfTile icon="shield" tone="green" size={28} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Retention schedules</div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55, marginBottom: 10 }}>
              NDPR is archive-not-delete: exit never erases the record. Offboarding (FR-063) seals documents in
              a restricted archive — access revoked, audit trail intact — and purges only when the statutory
              clock (6 years post-exit) runs out.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n500)" }}>
                <Ic name="file" size={13} color="var(--pf-n400)" /> Contracts &amp; offers — retain 6y post-exit
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n500)" }}>
                <Ic name="heart" size={13} color="var(--pf-n400)" /> Medical &amp; biometric — archive on offboarding, restricted
              </div>
            </div>
            <PfBtn full icon="door" onClick={() => go("offboarding")}>Open offboarding workflow · FR-063</PfBtn>
          </PfCard>
        </div>
      </div>
      )}

      {/* ------------------ Agency-sourced workers --------------------------- */}
      {tab === "agency" && (
        <div style={{ maxWidth: 420 }}>
          {/* Agency sub-card (oil & gas pack) */}
          <PfCard pad={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
              <PfTile icon="users" tone="purple" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Agency-sourced workers</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Oil &amp; gas contractor pack</div>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              <button
                onClick={() => toast("PrimeStaff — 12 active workers · 2 flagged for permanent conversion", "default")}
                style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "6px 11px", borderRadius: 8, cursor: "pointer", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", color: "var(--pf-purple-500)" }}
              >
                PrimeStaff · 12
              </button>
              <button
                onClick={() => toast("RigWorks — 9 active workers · master service agreement renews Jan 2027", "default")}
                style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "6px 11px", borderRadius: 8, cursor: "pointer", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", color: "var(--pf-purple-500)" }}
              >
                RigWorks · 9
              </button>
              <button
                onClick={() => toast("Conversion tracking — 3 agency workers converted to permanent YTD · ₦8.4m agency fees saved", "success")}
                style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, padding: "6px 11px", borderRadius: 8, cursor: "pointer", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", color: "var(--pf-primary-600)" }}
              >
                3 converted YTD
              </button>
            </div>
          </PfCard>
        </div>
      )}

      {/* ----------------------------- Doc drawer --------------------------- */}
      {drawer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={() => setDrawer(null)} style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,.32)" }} />
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "92vw", background: "var(--pf-n0)", borderLeft: "1px solid var(--pf-n100)", boxShadow: "-16px 0 44px rgba(2,6,23,.14)", overflowY: "auto", padding: 22, animation: "scIn .18s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
              <PfTile icon="file" tone="blue" size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)" }}>Contract {drawer.id}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{drawer.name} · {drawer.dept}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 8, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--pf-n500)" }}>
                <Ic name="x" size={15} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              <PfBadge tone={TYPE_TONE[typeOf(drawer)]}>{agencyOf(drawer) ? `Contractor · ${agencyOf(drawer)}` : drawer.type}</PfBadge>
              <PfBadge tone={drawer.daysLeft >= 9999 ? "green" : urgency(drawer)}>{drawer.daysLeft >= 9999 ? "Evergreen" : `${drawer.daysLeft}d left`}</PfBadge>
              {(steps[drawer.id] ?? 0) > 0 && <PfBadge tone="blue" dot>Renewal in motion</PfBadge>}
            </div>

            <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 9 }}>Key terms</div>
              {[
                ["Term", `${drawer.start} → ${drawer.end === "—" ? "open-ended" : drawer.end}`],
                ["Notice period", "30 days written"],
                ["Compensation", "₦ ···· masked · role-based access"],
                ["Governing law", "Federal Republic of Nigeria"],
                ["NDPR basis", "Contract performance · s.2.2"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "5px 0", borderBottom: "1px dashed var(--pf-n100)" }}>
                  <span style={{ color: "var(--pf-n400)" }}>{k}</span>
                  <span style={{ color: "var(--pf-n900)", fontWeight: 500, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 8 }}>Documents in file</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 }}>
              {[`Signed contract — ${drawer.id}.pdf`, "NDA + confidentiality annex.pdf", "Right-to-work verification.pdf"].map((f) => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 11px" }}>
                  <Ic name="file" size={14} color="var(--pf-n400)" />
                  <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f}</span>
                  <button
                    onClick={() => toast(`Access logged — ${f} · NDPR audit trail updated`, "success")}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pf-n500)", padding: 2, display: "inline-flex" }}
                  >
                    <Ic name="download" size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "9px 12px", marginBottom: 16 }}>
              <Ic name="sparkle" size={14} color="var(--pf-purple-500)" />
              <span style={{ fontSize: 12, color: "var(--pf-purple-500)", lineHeight: 1.5 }}>
                Generated by the Stage 9/10 document engine — offer → contract chain intact, clause library v3 (Nigerian law).
              </span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {drawer.daysLeft < 9999 && (
                <PfBtn variant="primary" icon="swap" onClick={() => { const d = drawer; setDrawer(null); setTab("register"); setOpenRenew(d.id); setFlash(d.id); window.setTimeout(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); window.setTimeout(() => setFlash(null), 1800); }}>
                  Start renewal
                </PfBtn>
              )}
              <PfBtn icon="download" onClick={() => toast(`Contract ${drawer.id}.pdf downloading — access logged`, "success")}>Download PDF</PfBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
