"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  CSV_PAYROLL, POLICY_LEAVE, SEED_LEAVE_REQUESTS, adapterFor, activeAdapter,
  type AdapterInfo, type AdapterState, type LeaveBalance, type LeaveRequestRow,
} from "@/data/adapters";
import { ROTATIONS, ROTATION_ASSIGNMENTS } from "@/data/workforce";
import { ME_ID, ME_PUBLIC, ME_FIRST, MY_MANAGER, MY_HANDBOOK } from "@/data/me";

/**
 * My leave — FR-085, the EMPLOYEE side of leave visibility and request pass-through.
 *
 * The doctrine this page exists to demonstrate (v2.1 §2.2): reads, not engines.
 * Hirebrew does not accrue a single day of Amara's leave. It reads three numbers
 * per leave kind — entitled, taken, carried — through the payroll_connector v1
 * contract, and passes a request back the other way. The only arithmetic on the
 * page is `entitled + carried − taken`, and the page says so out loud.
 *
 * The connector is adapter-first. The CSV / SFTP drop is LIVE today and needs no
 * counterparty; SeamlessHR and PaidHR are built to the same contract and are
 * awaiting API access. That is not a gap being papered over — the source selector
 * below lets you watch the same surface run on the internal POLICY_LEAVE fallback
 * with no payroll system connected at all.
 *
 * Me-pillar scope: this renders E-0214 and nobody else. The shared leave register
 * holds a site colleague's request booked against a rotation calendar; the rule is
 * explained here in copy, and the row itself is filtered out — it is not hers.
 */

/* ---------------------------------- subject -------------------------------- */

const ME = ME_PUBLIC;

const CONNECTOR: AdapterInfo | undefined = activeAdapter("payroll_connector");
const PAYROLL_LADDER: AdapterInfo[] = adapterFor("payroll_connector");

/** Read through the connector — never off a local table. */
const CONNECTED_BALANCES: LeaveBalance[] = CSV_PAYROLL.leaveBalances(ME_ID);
/** The internal table FR-085 falls back to when NO payroll system is connected. */
const FALLBACK_BALANCES: LeaveBalance[] = POLICY_LEAVE.filter((b) => b.workerId === ME_ID);

const MY_SEED_REQUESTS: LeaveRequestRow[] = SEED_LEAVE_REQUESTS.filter((r) => r.workerId === ME_ID);
/** COUNT ONLY. The rows themselves belong to other people and never render here. */
const NOT_MINE = SEED_LEAVE_REQUESTS.length - MY_SEED_REQUESTS.length;
const ROTATION_BOOKED = SEED_LEAVE_REQUESTS.filter((r) => r.againstRotation).length;

/** Her own rotation assignment, if any. There is none — she is a Lagos desk role. */
const MY_ROTATION = ROTATION_ASSIGNMENTS.find((a) => a.workerId === ME_ID);
const MY_ROTATION_CAL = MY_ROTATION ? ROTATIONS.find((r) => r.id === MY_ROTATION.rotationId) : undefined;

const LEAVE_POLICY = MY_HANDBOOK.find((h) => h.id === "hb-leave");

const KIND_TONE: Record<string, PfTone> = {
  "Annual leave": "green",
  Compassionate: "purple",
  "Study leave": "blue",
};

const KIND_ICON: Record<string, string> = {
  "Annual leave": "calendar",
  Compassionate: "heart",
  "Study leave": "book",
};

const STATE_TONE: Record<LeaveRequestRow["state"], PfTone> = {
  Draft: "grey", Submitted: "blue", Approved: "green", Declined: "red",
};

const ADAPTER_TONE: Record<AdapterState, PfTone> = {
  live: "green", ready: "blue", "awaiting-access": "yellow",
};

const ADAPTER_LABEL: Record<AdapterState, string> = {
  live: "Live", ready: "Ready", "awaiting-access": "Awaiting API access",
};

const remainingOf = (b: LeaveBalance) => b.entitled + b.carried - b.taken;
const totalOf = (b: LeaveBalance) => b.entitled + b.carried;

/* ----------------------------------- dates --------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic — no locale, no clock. Matches the register's own "Sep 14" shape. */
const fmt = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${String(d).padStart(2, "0")}`;
};

/**
 * Working days across the requested span, weekends excluded. This counts the
 * REQUEST — it is not an accrual and it does not apply Nigerian public holidays:
 * the payroll source does that, and the page says so where the number renders.
 */
const workingDays = (fromIso: string, toIso: string): number => {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const span = (b.getTime() - a.getTime()) / 86_400_000;
  if (span < 0 || span > 365) return 0;
  let n = 0;
  const cur = new Date(a);
  while (cur.getTime() <= b.getTime()) {
    const w = cur.getUTCDay();
    if (w !== 0 && w !== 6) n += 1;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
};

const calendarDays = (fromIso: string, toIso: string): number => {
  const a = new Date(`${fromIso}T00:00:00Z`);
  const b = new Date(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const span = (b.getTime() - a.getTime()) / 86_400_000;
  return span < 0 || span > 365 ? 0 : span + 1;
};

/* -------------------------------- small pieces ------------------------------ */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 8,
  padding: "9px 11px", width: "100%", outline: "none",
};

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{hint}</span>}
    </div>
  );
}

function Note({ icon = "info", tone = "grey", children }: { icon?: string; tone?: PfTone; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Ic name={icon} size={13} color={TONE[tone].fg} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function KindChip({ kind, active, onClick }: { kind: string; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[KIND_TONE[kind] ?? "grey"];
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "8px 13px", borderRadius: 999,
        color: active ? t.fg : "var(--pf-n500)",
        background: active ? t.soft : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`,
        whiteSpace: "nowrap", lineHeight: 1.3,
      }}
    >
      <Ic name={KIND_ICON[kind] ?? "calendar"} size={13} color={active ? t.fg : "var(--pf-n400)"} />
      {kind}
    </button>
  );
}

function AdapterRow({ a }: { a: AdapterInfo }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: "1px solid var(--pf-n50)" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[ADAPTER_TONE[a.state]].bg, flex: "none", marginTop: 5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.provider}</span>
          <PfBadge tone={ADAPTER_TONE[a.state]}>{ADAPTER_LABEL[a.state]}</PfBadge>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>{a.note}</div>
      </div>
    </div>
  );
}

/** One link in the pass-through chain — done / next / waiting. */
function Step({ n, icon, tone, title, sub, state }: {
  n: number; icon: string; tone: PfTone; title: string; sub: string; state: "done" | "next" | "wait";
}) {
  const dim = state === "wait";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: dim ? 0.72 : 1 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
        <PfTile icon={icon} tone={state === "wait" ? "grey" : tone} size={26} />
        {n < 4 && <span style={{ width: 1.5, flex: 1, minHeight: 16, background: "var(--pf-n50)", marginTop: 4 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: n < 4 ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</span>
          {state === "done" && <PfBadge tone="green" dot>Done</PfBadge>}
          {state === "next" && <PfBadge tone="blue" dot>Next</PfBadge>}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>{sub}</div>
      </div>
    </div>
  );
}

/* --------------------------------- balances -------------------------------- */

function BalanceCard({ b, provenance }: { b: LeaveBalance; provenance: string }) {
  const tone = KIND_TONE[b.kind] ?? "grey";
  const total = totalOf(b);
  const left = remainingOf(b);
  const pct = total === 0 ? 0 : Math.round((b.taken / total) * 100);
  return (
    <PfCard>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTile icon={KIND_ICON[b.kind] ?? "calendar"} tone={tone} size={26} />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{b.kind}</span>
        {b.carried > 0 && <PfBadge tone="yellow">{b.carried} carried</PfBadge>}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ fontSize: 26, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px", lineHeight: 1 }}>{left}</span>
          <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>days left of {total}</span>
        </div>
        <div style={{ marginTop: 11 }}>
          <PfProgress pct={pct} tone={tone} height={7} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, marginTop: 12 }}>
          {[
            { k: "Entitled", v: b.entitled },
            { k: "Carried", v: b.carried },
            { k: "Taken", v: b.taken },
          ].map((c) => (
            <div key={c.k} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 10px" }}>
              <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{c.k}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", marginTop: 1 }}>{c.v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 6 }}>
          <Note icon="swap" tone={tone}>{provenance}</Note>
          {b.expires && (
            <Note icon="clock" tone="yellow">
              {b.carried} carried {b.carried === 1 ? "day expires" : "days expire"} <b>{b.expires}</b>. Hirebrew does not expire them — it reads the rule.
            </Note>
          )}
        </div>
      </div>
    </PfCard>
  );
}

/* ---------------------------------- history -------------------------------- */

function HistoryRow({ r, mine, open, onToggle }: {
  r: LeaveRequestRow; mine: boolean; open: boolean; onToggle: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "104px 1.15fr 1fr 62px 1.05fr 110px 26px",
          alignItems: "center", gap: 10, padding: "12px 20px", cursor: "pointer",
          background: open ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--pf-n500)" }}>{r.id}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Ic name={KIND_ICON[r.kind] ?? "calendar"} size={14} color={TONE[KIND_TONE[r.kind] ?? "grey"].fg} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.kind}</span>
        </span>
        <span style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{r.from} → {r.to}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.days}d</span>
        <span style={{ fontSize: 12.5, color: "var(--pf-n500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.approver}</span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <PfBadge tone={STATE_TONE[r.state]} dot>{r.state}</PfBadge>
        </span>
        <span style={{ display: "inline-flex", justifyContent: "flex-end" }}>
          <Ic name={open ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
        </span>
      </div>

      {open && (
        <div style={{ padding: "4px 20px 18px", background: "var(--pf-n25)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 12 }}>
            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 10 }}>Where this request is</div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Step n={1} icon="paperplane" tone="green" state="done"
                  title="You submitted it"
                  sub={mine ? "Created on this page, in this session — held as a record in Hirebrew." : "Held as a record in Hirebrew from the moment it was submitted."} />
                <Step n={2} icon="user" tone={r.state === "Approved" ? "green" : "blue"}
                  state={r.state === "Approved" ? "done" : "next"}
                  title={r.state === "Approved" ? `${r.approver} approved it` : `With ${r.approver}`}
                  sub={r.state === "Approved"
                    ? "Approved in-platform. The approval chain never leaves Hirebrew."
                    : "Your manager decides in Hirebrew — on the web or from her phone. Nothing is auto-approved."} />
                <Step n={3} icon="swap" tone="purple" state={r.state === "Approved" ? "next" : "wait"}
                  title="Written back to the source"
                  sub={`payroll_connector v1 · ${CONNECTOR?.provider ?? "manual upload"} — the outcome goes back the way the balance came, or exports as a clean CSV row.`} />
                <Step n={4} icon="gauge" tone="blue" state="wait"
                  title="Your balance re-reads"
                  sub="This page then shows the source's number, not ours. Hirebrew never deducts a day on its own." />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>Booked against</div>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <PfTile icon={r.againstRotation ? "orbit" : "house"} tone={r.againstRotation ? "purple" : "blue"} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                      {r.againstRotation ?? `Office calendar · ${ME.loc}`}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
                      {r.againstRotation ? "Rotation calendar" : "Mon–Fri, weekends excluded"}
                    </div>
                  </div>
                </div>
              </div>
              {r.note && (
                <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Your note</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{r.note}</div>
                </div>
              )}
              <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                <Note icon="shield" tone="grey">
                  This row is yours. The register it sits in holds other people&rsquo;s requests too — they are filtered out by worker id, not hidden by styling.
                </Note>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================== screen ================================== */

const SOURCES = ["Connected payroll", "No payroll connected"] as const;
type SourceMode = (typeof SOURCES)[number];

export default function MyLeave() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<"balances" | "request" | "history">("balances");
  const [source, setSource] = useState<SourceMode>(SOURCES[0]);
  const [why, setWhy] = useState(false);

  /* -------------------------------- the form ------------------------------- */
  const [kind, setKind] = useState(CONNECTED_BALANCES[0]?.kind ?? "Annual leave");
  const [fromIso, setFromIso] = useState("2026-10-05");
  const [toIso, setToIso] = useState("2026-10-09");
  const [note, setNote] = useState("");

  /* ------------------------------ session rows ----------------------------- */
  const [sessionRows, setSessionRows] = useState<LeaveRequestRow[]>([]);
  /** Keyed by row position as well as id — the connector mints ids from the span, so two identical spans collide. */
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<LeaveRequestRow["state"] | null>(null);

  const connected = source === "Connected payroll";
  const balances = connected ? CONNECTED_BALANCES : FALLBACK_BALANCES;

  const provenance = connected
    ? `Read through payroll_connector v1 · ${CONNECTOR?.provider ?? "manual upload"}`
    : "Read from the internal policy table — no payroll system connected";

  const annual = balances.find((b) => b.kind === "Annual leave") ?? balances[0];
  const selected = balances.find((b) => b.kind === kind) ?? annual;

  const days = useMemo(() => workingDays(fromIso, toIso), [fromIso, toIso]);
  const span = useMemo(() => calendarDays(fromIso, toIso), [fromIso, toIso]);
  const leftNow = selected ? remainingOf(selected) : 0;
  const after = leftNow - days;
  const over = days > leftNow;

  const rows: LeaveRequestRow[] = useMemo(
    () => [...sessionRows, ...MY_SEED_REQUESTS],
    [sessionRows],
  );
  const visible = stateFilter ? rows.filter((r) => r.state === stateFilter) : rows;

  const awaiting = rows.filter((r) => r.state === "Submitted").length;
  const bookedAhead = rows.filter((r) => r.state === "Approved").reduce((a, r) => a + r.days, 0);
  const totalLeft = balances.reduce((a, b) => a + remainingOf(b), 0);

  /* -------------------------------- actions -------------------------------- */

  const submit = () => {
    if (days <= 0) { toast("Pick an end date on or after the start date before you submit", "danger"); return; }
    const row = CSV_PAYROLL.submitLeave({
      workerId: ME_ID,
      kind,
      from: fmt(fromIso),
      to: fmt(toIso),
      days,
      approver: MY_MANAGER.name,
      note: note.trim() || undefined,
    });
    setSessionRows((prev) => [row, ...prev]);
    setStateFilter(null);
    setOpenRow(`${row.id}-0`);
    setTab("history");
    setNote("");
    toast(`${days} ${days === 1 ? "day" : "days"} of ${kind.toLowerCase()} sent to ${MY_MANAGER.name} — ${row.id} is with her now`, "success");
  };

  const saveDraft = () =>
    toast(`Draft kept on your record — ${kind.toLowerCase()}, ${fmt(fromIso)} to ${fmt(toIso)}. Nothing has gone to ${MY_MANAGER.name.split(" ")[0]} yet.`);

  const exportCsv = () =>
    toast(`Exported ${rows.length} of your leave ${rows.length === 1 ? "request" : "requests"} — the same CSV shape payroll_connector v1 reads`, "success");

  const isSession = (id: string) => sessionRows.some((r) => r.id === id);

  /* ---------------------------------- view --------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My leave</div>
            <PfBadge tone="grey">{ME.id}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>
            Your balances as your payroll source reports them, a request that goes to {MY_MANAGER.name}, and everything you have
            already asked for. Hirebrew does not accrue your leave — it reads it, and passes your request back the other way.
          </div>
        </div>
        <PfBtn variant="secondary" icon="file" onClick={() => go("myletters")}>Need a letter?</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => setTab("request")}>Request leave</PfBtn>
      </div>

      {/* ------------------------------- KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="calendar" tone="green" label="Annual leave left"
          value={annual ? remainingOf(annual) : 0} unit="days"
          delta={annual && annual.carried > 0 ? `${annual.carried} carried · ${annual.expires}` : "no carry-over"}
          deltaTone={annual && annual.carried > 0 ? "yellow" : "grey"}
        />
        <PfStat
          icon="check" tone="blue" label="Booked ahead"
          value={bookedAhead} unit="days approved" delta="On your calendar" deltaTone="green"
        />
        <PfStat
          icon="clock" tone="yellow" label={`With ${MY_MANAGER.name.split(" ")[0]}`}
          value={awaiting} unit={awaiting === 1 ? "request" : "requests"}
          delta={awaiting === 0 ? "Nothing pending" : "Awaiting decision"} deltaTone={awaiting === 0 ? "grey" : "yellow"}
        />
        <PfStat
          icon="swap" tone="purple" label="Balance source"
          value={connected ? (CONNECTOR?.provider.split(" / ")[0] ?? "CSV") : "Policy table"}
          unit={connected ? "payroll_connector v1" : "internal fallback"}
          delta={connected ? "Live" : "No payroll"} deltaTone={connected ? "green" : "blue"}
        />
      </div>

      {/* ------------------------------ section tabs ---------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as typeof tab)}
          tabs={[
            { key: "balances", label: "My balances" },
            { key: "request", label: "Request leave" },
            { key: "history", label: "My requests", count: String(rows.length) },
          ]}
        />
      </div>

      {/* ================================ BALANCES =============================== */}
      {tab === "balances" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="info">
            {totalLeft} days left across {balances.length} leave kinds. Every number below was supplied by a source outside this
            page — nothing here accrues a day.
          </PfBanner>

          {/* --------------------------- where it came from -------------------------- */}
          <PfCard>
            <PfCardHead
              title="Where these numbers come from"
              sub="FR-085 · payroll_connector v1. Switch the source to see the same surface with no payroll system connected at all."
            >
              <PfTabs tabs={[...SOURCES]} active={source} onChange={(s) => setSource(s as SourceMode)} />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20, padding: "16px 20px" }}>
              {/* active source */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                  <PfTile icon={connected ? "swap" : "book"} tone={connected ? "green" : "blue"} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                      {connected ? CONNECTOR?.provider ?? "Manual HR upload" : "Internal policy table"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
                      {connected ? "payroll_connector v1 · the day-one adapter" : "The handbook's own leave policy, held in-platform"}
                    </div>
                  </div>
                  <PfBadge tone={connected ? "green" : "blue"} dot>{connected ? "Live" : "Fallback"}</PfBadge>
                </div>

                {/* the read chain */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
                  {[
                    connected ? (CONNECTOR?.provider ?? "Manual upload") : "Handbook policy",
                    "payroll_connector v1",
                    "This page",
                  ].map((s, i, arr) => (
                    <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: i === arr.length - 1 ? "var(--pf-n900)" : "var(--pf-n500)", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>{s}</span>
                      {i < arr.length - 1 && <Ic name="arrowright" size={13} color="var(--pf-n300)" />}
                    </span>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="check" tone="green">
                    {connected
                      ? `${CONNECTOR?.note ?? "Works with any payroll, including a spreadsheet."} Your employer does not need an API for you to see this.`
                      : "With nothing connected, the balance falls back to the policy table sourced from the handbook — so the page still works on day one."}
                  </Note>
                  <Note icon="warning" tone="yellow">
                    The three figures are identical under both sources today, because the CSV drop currently carries the same
                    policy numbers. What changes is who is answerable for them. When SeamlessHR goes live it becomes the payroll
                    system&rsquo;s figure — and if that ever disagrees with policy, you will see the payroll figure, labelled.
                  </Note>
                </div>

                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => setWhy((v) => !v)}
                    style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
                  >
                    <Ic name="question" size={12} color="var(--pf-n500)" />
                    Why these numbers?
                    <Ic name={why ? "caretdown" : "caretright"} size={11} color="var(--pf-n500)" />
                  </button>
                </div>

                {why && annual && (
                  <div style={{ marginTop: 11, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "13px 15px" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                      Annual leave: {remainingOf(annual)} days remaining.
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
                      {[
                        `Entitled ${annual.entitled}, carried ${annual.carried}, taken ${annual.taken} — three numbers the source supplied.`,
                        `Remaining is ${annual.entitled} + ${annual.carried} − ${annual.taken}. That subtraction is the only arithmetic on this page.`,
                        "No accrual runs here. Hirebrew does not add days as you work them; your payroll source does, and this page reads the result.",
                        "Nigerian public holidays are not counted against you here either — the source applies them.",
                      ].map((b) => (
                        <div key={b} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                          <Ic name="check" size={12} color="var(--pf-primary-500)" weight={2.2} />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                      <Ic name="robot" size={14} color="var(--pf-n400)" />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1, minWidth: 220, lineHeight: 1.45 }}>
                        No model card, because no model ran. Every input is a figure a system or a policy document supplied, and you can point at each one.
                      </span>
                      <PfBtn small variant="secondary" icon="shield" onClick={() => go("trust")}>Trust center</PfBtn>
                    </div>
                  </div>
                )}
              </div>

              {/* the ladder */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Every adapter on this contract</span>
                  <PfBadge tone="grey">{PAYROLL_LADDER.length}</PfBadge>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.45, marginBottom: 6 }}>
                  All four implement the same interface. When an API lands, the surface you are looking at does not change.
                </div>
                {PAYROLL_LADDER.map((a) => <AdapterRow key={a.provider} a={a} />)}
              </div>
            </div>
          </PfCard>

          {/* ------------------------------- balances -------------------------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            {balances.map((b) => <BalanceCard key={b.kind} b={b} provenance={provenance} />)}
          </div>

          {/* ---------------------- carry-over rule + the handbook -------------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="The carry-over rule" sub="Read from policy, applied by your payroll source — not by this page." />
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.6px", lineHeight: 1 }}>
                    {annual?.carried ?? 0}
                  </span>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                    unused days carried into this year.<br />
                    They expire <b style={{ color: "var(--pf-n900)" }}>{annual?.expires ?? "31 Mar"}</b>.
                  </div>
                </div>

                {/* the expiry window, drawn honestly */}
                <div style={{ position: "relative", height: 10, borderRadius: 999, background: "var(--pf-n50)", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "25%", background: "var(--pf-yellow-500)", opacity: 0.75 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--pf-n400)" }}>
                  <span>1 Jan</span>
                  <span style={{ fontWeight: 600, color: "var(--pf-yellow-500)" }}>31 Mar — carried days lapse</span>
                  <span>31 Dec</span>
                </div>

                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="info" tone="grey">
                    Up to <b>5</b> unused days carry over. Anything beyond 5 does not travel, and the 5 that do must be taken by 31 March.
                  </Note>
                  <Note icon="shield" tone="grey">
                    Hirebrew will not silently burn them: it shows the date, and it is your payroll source that lapses the days.
                  </Note>
                </div>
                <div style={{ marginTop: 14 }}>
                  <PfBtn variant="primary" icon="calendar" onClick={() => { setKind("Annual leave"); setTab("request"); }}>
                    Use them before they lapse
                  </PfBtn>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead
                title={LEAVE_POLICY?.title ?? "Leave & public holidays"}
                sub={LEAVE_POLICY ? `${LEAVE_POLICY.owner} · updated ${LEAVE_POLICY.updated}` : "Company handbook"}
              >
                <PfBadge tone="grey">Handbook</PfBadge>
              </PfCardHead>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.65 }}>
                  {LEAVE_POLICY?.body ??
                    "20 working days of annual leave, plus all Nigerian public holidays. Up to 5 unused days carry into the next year and expire on 31 March."}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="check" tone="green">
                    This is the same text the fallback policy table is sourced from, so the two cannot drift apart.
                  </Note>
                  <Note icon="orbit" tone="purple">
                    The last sentence is the one that matters offshore: site rotations book leave against the rotation calendar,
                    not the office one. Yours is an office calendar — see <b>Request leave</b> for what that means.
                  </Note>
                </div>
              </div>
            </PfCard>
          </div>

          {/* -------------------------- what this page is not ------------------------ */}
          <PfCard style={{ background: "var(--pf-n25)" }}>
            <div style={{ display: "flex", gap: 12, padding: "14px 20px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <PfTile icon="shield" tone="grey" size={30} />
              <div style={{ flex: 1, minWidth: 300 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>What this page does not do</div>
                <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.55 }}>
                  It does not accrue leave, calculate pay, hold a salary figure, or decide anything. It reads three numbers per
                  leave kind and moves a request between you and {MY_MANAGER.name}. If this surface ever looks like it is
                  computing your entitlement, something has gone wrong upstream of it.
                </div>
              </div>
              <PfBtn variant="secondary" icon="user" onClick={() => go("myprofile")}>Your record</PfBtn>
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================= REQUEST =============================== */}
      {tab === "request" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12, alignItems: "start" }}>
          {/* --------------------------------- form --------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Request leave"
              sub={`Goes to ${MY_MANAGER.name} the moment you submit. Nothing is auto-approved, and nothing is deducted here.`}
            />
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* kind */}
              <div>
                <Label hint="your three entitlements">Leave kind</Label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {balances.map((b) => (
                    <KindChip key={b.kind} kind={b.kind} active={b.kind === kind} onClick={() => setKind(b.kind)} />
                  ))}
                </div>
                {selected && (
                  <div style={{ marginTop: 9 }}>
                    <Note icon="wallet" tone={KIND_TONE[selected.kind] ?? "grey"}>
                      {remainingOf(selected)} of {totalOf(selected)} days left on {selected.kind.toLowerCase()} — {provenance.toLowerCase()}.
                    </Note>
                  </div>
                )}
              </div>

              {/* dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 150px", gap: 12, alignItems: "end" }}>
                <div>
                  <Label>First day off</Label>
                  <input type="date" value={fromIso} onChange={(e) => setFromIso(e.target.value)} style={INPUT} />
                </div>
                <div>
                  <Label>Last day off</Label>
                  <input type="date" value={toIso} onChange={(e) => setToIso(e.target.value)} style={INPUT} />
                </div>
                <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "9px 12px" }}>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>Working days</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 1 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: days > 0 ? "var(--pf-n900)" : "var(--pf-n300)", lineHeight: 1.1 }}>{days}</span>
                    <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>of {span} calendar</span>
                  </div>
                </div>
              </div>

              <Note icon="info" tone="grey">
                Weekends are excluded from the count. Nigerian public holidays inside your dates are applied by your payroll
                source, not by this page — so the final figure on your payslip is theirs, not ours.
              </Note>

              {/* note */}
              <div>
                <Label hint="optional — your manager sees it">Note for {MY_MANAGER.name.split(" ")[0]}</Label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Handover: payments on-call swaps to Chidi for the week; the v2 replatform cutover is already scheduled after I am back."
                  style={{ ...INPUT, resize: "vertical", lineHeight: 1.55 }}
                />
              </div>

              {/* balance preview */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
                background: over ? "var(--pf-yellow-50)" : "var(--pf-n25)",
                border: `1px solid ${over ? "var(--pf-yellow-100)" : "var(--pf-n50)"}`,
                borderRadius: 10, padding: "13px 15px",
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>Balance now</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--pf-n900)" }}>{leftNow}d</div>
                </div>
                <Ic name="arrowright" size={15} color="var(--pf-n300)" />
                <div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>If this is approved</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: over ? "var(--pf-yellow-500)" : "var(--pf-n900)" }}>{after}d</div>
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <Note icon={over ? "warning" : "info"} tone={over ? "yellow" : "grey"}>
                    {over
                      ? `That is ${days - leftNow} ${days - leftNow === 1 ? "day" : "days"} more than the balance this page read. Your request will still pass through — the source and ${MY_MANAGER.name.split(" ")[0]} decide, not this form.`
                      : "A preview against the balance this page read. It is not a hold — nothing is deducted until your source reports it."}
                  </Note>
                </div>
              </div>

              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <PfBtn variant="primary" icon="paperplane" onClick={submit}>
                  Send to {MY_MANAGER.name.split(" ")[0]}
                </PfBtn>
                <PfBtn variant="secondary" icon="file" onClick={saveDraft}>Save as draft</PfBtn>
                <span style={{ flex: 1 }} />
                <PfBtn variant="ghost" icon="clipboard" onClick={() => setTab("history")}>See your requests</PfBtn>
              </div>
            </div>
          </PfCard>

          {/* ---------------------------------- rail --------------------------------- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* approver */}
            <PfCard>
              <PfCardHead title="Who decides" sub="The approval chain runs inside Hirebrew." />
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_MANAGER.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{MY_MANAGER.role} · your approver</div>
                  </div>
                  <PfBadge tone="green" dot>In-platform</PfBadge>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="check" tone="green">
                    She approves in Hirebrew — from her desk or her phone. No email thread, no spreadsheet, no printed form.
                  </Note>
                  <Note icon="swap" tone="purple">
                    The outcome is written back through payroll_connector v1 · {CONNECTOR?.provider ?? "manual upload"}, or exports as a clean CSV row where the connector is one-way.
                  </Note>
                  <Note icon="shield" tone="grey">
                    No AI sits in this chain. Nothing scores your request, and nothing recommends a decision to your manager.
                  </Note>
                </div>
              </div>
            </PfCard>

            {/* pass-through */}
            <PfCard>
              <PfCardHead title="What happens after you submit" sub="Four links, and only the first two are ours." />
              <div style={{ padding: "16px 20px" }}>
                <Step n={1} icon="paperplane" tone="green" state="next"
                  title="Your request becomes a record"
                  sub={`Held against ${ME.id} in Hirebrew, timestamped, visible to you on My requests.`} />
                <Step n={2} icon="user" tone="blue" state="wait"
                  title={`${MY_MANAGER.name} approves or declines`}
                  sub="In-platform, with your note and your dates in front of her." />
                <Step n={3} icon="swap" tone="purple" state="wait"
                  title="The outcome goes back to the source"
                  sub="Through the same contract the balance came in on — or out as CSV." />
                <Step n={4} icon="gauge" tone="grey" state="wait"
                  title="Your balance re-reads"
                  sub="Your remaining days change because the SOURCE changed them, never because this page did." />
              </div>
            </PfCard>

            {/* calendar / rotation */}
            <PfCard>
              <PfCardHead title="Which calendar this books against" sub="FR-090 · office calendar vs rotation calendar." />
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfTile icon={MY_ROTATION_CAL ? "orbit" : "house"} tone={MY_ROTATION_CAL ? "purple" : "blue"} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                      {MY_ROTATION_CAL ? MY_ROTATION_CAL.name : `Office calendar · ${ME.loc}`}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
                      {MY_ROTATION_CAL
                        ? `${MY_ROTATION_CAL.onDays}/${MY_ROTATION_CAL.offDays} rotation — leave books against your tour`
                        : "Monday to Friday. Your record carries no rotation assignment."}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>
                    The rule, for colleagues it applies to
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55, marginBottom: 10 }}>
                    A worker on a rotation does not have five-day weeks to spend. Their leave books against the rotation
                    calendar — days off tour were never working days, so counting them would take leave the person never used.
                    These are the calendars in play:
                  </div>
                  {ROTATIONS.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--pf-n50)" }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", width: 34, flex: "none" }}>{r.id}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 0 }}>{r.name}</span>
                      <PfBadge tone="grey">{r.onDays} on · {r.offDays} off</PfBadge>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="info" tone="grey">
                    None of these is yours. If your work pattern is recorded wrongly, raise a correction on your profile — the
                    same place the imported grade was corrected.
                  </Note>
                </div>
                <div style={{ marginTop: 12 }}>
                  <PfBtn variant="secondary" full icon="user" onClick={() => go("myprofile")}>
                    Check your work pattern on your profile
                  </PfBtn>
                </div>
              </div>
            </PfCard>
          </div>
        </div>
      )}

      {/* ================================= HISTORY =============================== */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="My requests"
              sub={`Everything you have asked for, filtered to ${ME.id}. Click a row to see where it is.`}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <PfTabs
                  tabs={["All", "Submitted", "Approved"]}
                  active={stateFilter ?? "All"}
                  onChange={(t) => setStateFilter(t === "All" ? null : (t as LeaveRequestRow["state"]))}
                />
                <PfBtn small variant="secondary" icon="download" onClick={exportCsv}>Export CSV</PfBtn>
              </div>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "104px 1.15fr 1fr 62px 1.05fr 110px 26px", gap: 10, padding: "10px 20px" }}>
              <PfTh>Request</PfTh>
              <PfTh>Kind</PfTh>
              <PfTh>Dates</PfTh>
              <PfTh>Days</PfTh>
              <PfTh>Approver</PfTh>
              <PfTh>State</PfTh>
              <PfTh />
            </div>

            {visible.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing at that state</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>
                  You have {rows.length} {rows.length === 1 ? "request" : "requests"} in total.
                </div>
              </div>
            ) : (
              visible.map((r, i) => {
                const rowKey = `${r.id}-${i}`;
                return (
                  <HistoryRow
                    key={rowKey}
                    r={r}
                    mine={isSession(r.id)}
                    open={openRow === rowKey}
                    onToggle={() => setOpenRow(openRow === rowKey ? null : rowKey)}
                  />
                );
              })
            )}
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="What you can see here" sub="Me-pillar scope, stated plainly." />
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                <Note icon="shield" tone="green">
                  This page renders one person&rsquo;s leave — yours. The register behind it holds {NOT_MINE} other{" "}
                  {NOT_MINE === 1 ? "request" : "requests"} right now; {NOT_MINE === 1 ? "it is" : "they are"} filtered out by
                  worker id before anything reaches the screen.
                </Note>
                <Note icon="user" tone="grey">
                  {MY_MANAGER.name} sees your request because she is your approver. Nobody else in Engineering does.
                </Note>
                <Note icon="clock" tone="grey">
                  {sessionRows.length > 0
                    ? `${sessionRows.length} of these ${sessionRows.length === 1 ? "was" : "were"} submitted by you in this session and ${sessionRows.length === 1 ? "is" : "are"} already a record.`
                    : "Requests you submit on the Request leave tab appear here immediately — before the connector has done anything."}
                </Note>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Why some requests look different" sub="FR-090 · rotation calendars." >
                <PfBadge tone="purple">{ROTATION_BOOKED} in the register</PfBadge>
              </PfCardHead>
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                <Note icon="orbit" tone="purple">
                  {ROTATION_BOOKED} request in the shared register is booked against a rotation calendar rather than an office
                  one. It belongs to a site colleague, so it does not render here — but the rule is worth knowing.
                </Note>
                <Note icon="calendar" tone="grey">
                  On a {ROTATIONS[1]?.name ?? "14/14"} pattern, a fortnight away is not ten working days. Leave books against the
                  tour, and only days the worker would otherwise have been on site are counted.
                </Note>
                <Note icon="house" tone="blue">
                  Yours books against the {ME.loc} office calendar, Monday to Friday — which is why the form above counts working
                  days and skips weekends.
                </Note>
                <div style={{ marginTop: 4 }}>
                  <PfBtn small variant="secondary" icon="plus" onClick={() => setTab("request")}>Request leave</PfBtn>
                </div>
              </div>
            </PfCard>
          </div>

          <PfBanner tone="green" icon="check" cta="Request leave" onCta={() => setTab("request")}>
            {ME_FIRST}, this ships when a request you send from your phone is approved by {MY_MANAGER.name} and your balance
            moves — through the connected payroll source, or the policy fallback where there is none.
          </PfBanner>
        </div>
      )}
    </div>
  );
}
