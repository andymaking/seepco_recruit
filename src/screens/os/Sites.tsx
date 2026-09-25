"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  SITES, ROTATIONS, ROTATION_ASSIGNMENTS, ROTATION_REF,
  rosterFor, onRotation, isSchedulable, lapsing, companyById, WORKERS,
  WORKER_TYPE_LABEL, type Site, type RotationCalendar, type WorkerType,
} from "@/data/workforce";
import { adapterFor, activeAdapter, CSV_ATTENDANCE, type AdapterState } from "@/data/adapters";
import { auditScore } from "@/data/trust";

/**
 * Sites & rotations — PRD v2.1 FR-090.
 *
 * The join no HR system in this market makes: a person, a site, and the tour
 * they are actually on. An office calendar assumes five-day weeks. A 28/28
 * offshore rotation does not have them, so a review booked "next Tuesday" is
 * booked at somebody on a boat. Three surfaces close that:
 *
 *   1. the site roster — who is on tour, who is musterable, who lapses next,
 *   2. the rotation calendars — the 28/28, 14/14 and 5/2 cycles, drawn,
 *   3. rotation-aware scheduling — the FR-090 acceptance test, made clickable.
 *
 * DOCTRINE. Reads, not engines. Nothing here rosters anybody, moves a crew
 * change or computes a tour allowance. It records what the rotation IS so every
 * other pillar can avoid it. The scheduling gate is arithmetic on a cycle
 * length — deterministic, no model, no score, no confidence.
 *
 * The gate NEVER drops a person. Off rotation is not "unavailable", it is "not
 * this window" — so every blocked placement carries the next window it can take
 * instead. Zero events in off-rotation windows is the ship gate; silently
 * losing the person would pass that test and fail the point of it.
 *
 * ADAPTER-FIRST. Rotation assignments arrive as crew-change manifests — an
 * upload today, an API when a logistics partner opens one. Coverage is stated
 * honestly against each site's own muster number rather than implied.
 */

/* --------------------------------- tokens --------------------------------- */

const SITE_ICON: Record<Site["kind"], string> = {
  Offshore: "lifebuoy",
  "Onshore terminal": "stack",
  Office: "house",
};

const SITE_TONE: Record<Site["kind"], PfTone> = {
  Offshore: "blue",
  "Onshore terminal": "purple",
  Office: "green",
};

const TYPE_TONE: Record<WorkerType, PfTone> = {
  employee: "green", contractor: "blue", agency: "purple", nysc: "yellow", alumni: "grey",
};

const ADAPTER_TONE: Record<AdapterState, PfTone> = { live: "green", ready: "blue", "awaiting-access": "yellow" };
const ADAPTER_LABEL: Record<AdapterState, string> = { live: "Live", ready: "Ready", "awaiting-access": "Awaiting API access" };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const REF_MS = Date.parse(`${ROTATION_REF}T00:00:00Z`);
const DAY_MS = 86_400_000;

/** Every date on this page is ROTATION_REF ± n days — deterministic, never "now". */
const dateAt = (offsetDays: number) => {
  const d = new Date(REF_MS + offsetDays * DAY_MS);
  return `${WEEKDAYS[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`;
};

const REF_LABEL = `${dateAt(0)} ${new Date(REF_MS).getUTCFullYear()}`;

const cycleLen = (r: RotationCalendar) => r.onDays + r.offDays;

/** A 28/28 worker flies home; a 5/2 base worker goes home. Same model, different words. */
const CYCLE_WORDS: Record<Site["kind"], { start: string; leave: string; goes: string; returns: string }> = {
  Offshore: { start: "board", leave: "fly home", goes: "flies home", returns: "back on tour" },
  "Onshore terminal": { start: "on site", leave: "days off", goes: "goes off tour", returns: "back on tour" },
  Office: { start: "week starts", leave: "days off", goes: "days off start", returns: "back at work" },
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const first = (name: string) => name.split(" ")[0];

/** Mirrors the rule inside readinessFor() so a block reads differently from a warning. */
const BLOCKING_RE = /expired|unfit|No medical/;

/* -------------------------------- the roster ------------------------------- */

type RosterRow = {
  id: string; name: string; init: string; tone: string; role: string; dept: string; loc: string;
  siteId: string; siteKind: Site["kind"];
  workerType: WorkerType; typeLabel: string; state: string;
  company?: string; ncdmb?: boolean;
  nationality: string; hostCommunity?: string;
  rot: RotationCalendar; pos: number; on: boolean; offIn: number;
  ready: boolean; blocking: string[]; advisory: string[];
};

/** The FR-090 join, per site: assignment × worker record × FR-083 readiness. */
const buildRows = (siteId: string): RosterRow[] =>
  rosterFor(siteId)
    .map((r) => {
      const p = r.person;
      const w = r.worker;
      const rot = ROTATIONS.find((x) => x.id === r.assignment.rotationId);
      const site = SITES.find((x) => x.id === siteId);
      if (!p || !w || !rot || !site) return null;
      const co = companyById(w.contractingCompanyId);
      const row: RosterRow = {
        id: p.id, name: p.name, init: p.init, tone: p.tone, role: p.role, dept: p.dept, loc: p.loc,
        siteId, siteKind: site.kind,
        workerType: w.workerType, typeLabel: WORKER_TYPE_LABEL[w.workerType], state: w.state,
        company: co?.name, ncdmb: co?.ncdmbRegistered,
        nationality: w.nationality, hostCommunity: w.hostCommunity,
        rot, pos: (r.assignment.dayInCycle - 1) % cycleLen(rot),
        on: r.on, offIn: r.offIn,
        ready: r.readiness.ready,
        blocking: r.readiness.reasons.filter((x) => BLOCKING_RE.test(x)),
        advisory: r.readiness.reasons.filter((x) => !BLOCKING_RE.test(x)),
      };
      return row;
    })
    .filter((x): x is RosterRow => x !== null)
    /** Blocked first, then on tour, then whoever changes over soonest. */
    .sort((a, b) => Number(a.ready) - Number(b.ready) || Number(b.on) - Number(a.on) || a.offIn - b.offIn);

const ROWS_BY_SITE: Record<string, RosterRow[]> = Object.fromEntries(SITES.map((s) => [s.id, buildRows(s.id)]));
const ALL_ROWS: RosterRow[] = SITES.flatMap((s) => ROWS_BY_SITE[s.id]);

/** The spine population the gate could apply to — office-calendar people are simply out of scope. */
const SPINE_IN_SCOPE = WORKERS.filter((w) => w.analytics.headcount).length;

const ON_NOW = ROTATION_ASSIGNMENTS.filter(onRotation).length;
const OFF_NOW = ROTATION_ASSIGNMENTS.length - ON_NOW;
const READY_NOW = ALL_ROWS.filter((r) => r.ready).length;

/** Where a worker sits in their cycle `shift` days from the reference date. */
const posAt = (row: RosterRow, shift: number) => {
  const len = cycleLen(row.rot);
  return (((row.pos + shift) % len) + len) % len;
};
const onAt = (row: RosterRow, shift: number) => posAt(row, shift) < row.rot.onDays;

/* ------------------------- lapses against changeover ----------------------- */

type Lapse = { what: string; kind: string; daysLeft: number };

const NEXT_LAPSE = new Map<string, Lapse>();
for (const l of lapsing()) {
  if (!NEXT_LAPSE.has(l.workerId)) NEXT_LAPSE.set(l.workerId, { what: l.what, kind: l.kind, daysLeft: l.daysLeft });
}

/**
 * The read a site clerk cannot get anywhere else: a ticket's expiry date read
 * against the tour it falls inside. "Expires in 21 days" is a diary note.
 * "Expires 3 days before he flies home, and he cannot re-board after that" is
 * a crew-change decision.
 */
type ChangeoverRisk = { row: RosterRow; lapse: Lapse; verdict: string; tone: PfTone };

/** Offshore language stops making sense at a Trans-Amadi office. The rule does not change; the noun does. */
const gateVerb = (k: Site["kind"]) => (k === "Office" ? "pass the gate" : "re-board");

const CHANGEOVER_RISK: ChangeoverRisk[] = ALL_ROWS
  .map((row): ChangeoverRisk | null => {
    const lapse = NEXT_LAPSE.get(row.id);
    if (!lapse || lapse.daysLeft > 30) return null;
    const before = lapse.daysLeft <= row.offIn;
    const verdict = lapse.daysLeft < 0
      ? row.on
        ? `Already lapsed — on tour on a document that is ${Math.abs(lapse.daysLeft)}d out of date. Cannot ${gateVerb(row.siteKind)} at the next changeover.`
        : `Already lapsed while off tour. The gate is closed for the ${dateAt(row.offIn)} return.`
      : row.on
        ? before
          ? `Lapses ${dateAt(lapse.daysLeft)} — inside this tour, ${plural(row.offIn - lapse.daysLeft, "day")} before changeover on ${dateAt(row.offIn)}.`
          : `Lapses ${dateAt(lapse.daysLeft)} — after changeover. Renew during the off-tour window, not at the gate.`
        : before
          ? `Lapses ${dateAt(lapse.daysLeft)} — before they are back on tour on ${dateAt(row.offIn)}. Renew, or they cannot ${gateVerb(row.siteKind)}.`
          : `Lapses ${dateAt(lapse.daysLeft)} — shortly after they return. Book the renewal into the off-tour window.`;
    const tone: PfTone = lapse.daysLeft < 0 ? "red" : before ? "yellow" : "blue";
    return { row, lapse, verdict, tone };
  })
  .filter((x): x is ChangeoverRisk => x !== null)
  .sort((a, b) => a.lapse.daysLeft - b.lapse.daysLeft);

/* -------------------------- where the roster comes from -------------------- */

type RosterSource = { name: string; what: string; state: AdapterState; note: string };

const ROSTER_SOURCES: RosterSource[] = [
  { name: "Manual roster upload", what: "Crew-change manifest · CSV or XLSX", state: "live", note: "The day-one path. A site clerk uploads the manifest the logistics team already produces." },
  { name: "Contracting-employer file", what: "PrimeStaff · RigWorks · Delta Marine", state: "live", note: "Each employer files its own crew list — the reason contractor coverage grows without an integration." },
  { name: "Biometric muster export", what: "POB reader at the gate", state: "ready", note: "Same attendance contract as the clock events. Needs a device export schedule, not a build." },
  { name: "Logistics manifest API", what: "Heli and crew-boat bookings", state: "awaiting-access", note: "Built to the contract; activates when the aviation partner opens access. Nothing on this page waits on it." },
];

const ATTENDANCE_ADAPTERS = adapterFor("attendance_source");
const LIVE_ATTENDANCE = activeAdapter("attendance_source");
const SIGNALS = CSV_ATTENDANCE.signals();
const signalFor = (id: string) => SIGNALS.find((s) => s.workerId === id);

/* ------------------------------- scheduling -------------------------------- */

type Activity = {
  key: string; label: string; noun: string; icon: string; tone: PfTone;
  onSite: boolean; where: string; stage: string; blurb: string;
};

const ACTIVITIES: Activity[] = [
  {
    key: "review", noun: "performance review", label: "Performance review", icon: "clipboard", tone: "blue", onSite: false,
    where: "Any location · 60 min", stage: "reviews",
    blurb: "Cycle conversations. A review needs the person at work and reachable — not at the site. Off tour is still off.",
  },
  {
    key: "oneonone", noun: "1-on-1", label: "1-on-1", icon: "chat", tone: "green", onSite: false,
    where: "Any location · 30 min", stage: "oneonones",
    blurb: "The most-booked event in the platform, and the one most often booked into a rest week by a calendar that does not know better.",
  },
  {
    key: "interview", noun: "interview panel", label: "Interview panel", icon: "users", tone: "purple", onSite: true,
    where: "PH Base · panel room", stage: "interview",
    blurb: "Internal candidates sitting a panel at the base. On-site means the gate applies: a lapsed ticket blocks entry regardless of the tour.",
  },
  {
    key: "training", noun: "HSE training", label: "HSE training", icon: "book", tone: "yellow", onSite: true,
    where: "On site · gate access required", stage: "learning",
    blurb: "Refreshers and inductions delivered at the site. Both gates apply — on tour AND site-ready.",
  },
];

type Verdict = { kind: "now" | "window" | "gated"; head: string; detail: string; window: string; inDays: number };

/**
 * FR-090's acceptance test, as a function. Site access is tested before the
 * rotation because it is the harder block: being on tour does not open a gate
 * a lapsed ticket has closed.
 */
const verdictFor = (row: RosterRow, act: Activity): Verdict => {
  const sch = isSchedulable(row.id);
  if (act.onSite && !row.ready) {
    return {
      kind: "gated",
      head: "Site access blocked",
      detail: row.blocking[0] ?? "Not site-ready",
      window: sch.ok ? "after the renewal clears" : `after the renewal clears — and ${sch.nextWindow}`,
      inDays: row.offIn,
    };
  }
  if (!sch.ok) {
    return {
      kind: "window",
      head: sch.why ?? "Off rotation",
      detail: `Day ${row.pos + 1} of ${cycleLen(row.rot)} — off tour on ${REF_LABEL}`,
      window: sch.nextWindow ?? "",
      inDays: row.offIn,
    };
  }
  return {
    kind: "now",
    head: "On tour",
    detail: `Day ${row.pos + 1} of ${cycleLen(row.rot)} · changeover ${dateAt(row.offIn)}`,
    window: "",
    inDays: row.offIn,
  };
};

const VERDICT_TONE: Record<Verdict["kind"], PfTone> = { now: "green", window: "yellow", gated: "red" };

/** Every surface that asks the same question before it writes an event. */
const GATE_SURFACES: { label: string; stage: string; note: string }[] = [
  { label: "Review cycles", stage: "reviews", note: "Cycle invitations skip an off-tour window and land in the next one." },
  { label: "1-on-1s", stage: "oneonones", note: "Cadence holds across the tour rather than lapsing during the rest week." },
  { label: "Confirmations", stage: "confirmations", note: "A probation decision meeting already calls this gate before it proposes a date." },
  { label: "Interviewing", stage: "interview", note: "Panels for internal candidates check both the tour and the gate pass." },
  { label: "Learning hub", stage: "learning", note: "Site-delivered training is offered only to workers who can actually get through the gate." },
  { label: "My leave", stage: "myleave", note: "Leave books against the rotation calendar, not a five-day office week." },
];

/* --------------------------------- pieces ---------------------------------- */

/** The cycle, drawn: one cell per day, on-tour cells filled, today marked. */
function CycleStrip({ rot, pos, height = 18, marker = true }: { rot: RotationCalendar; pos: number; height?: number; marker?: boolean }) {
  const len = cycleLen(rot);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", gap: 1.5 }}>
        {Array.from({ length: len }, (_, i) => {
          const on = i < rot.onDays;
          const cur = marker && i === pos;
          const fill = cur ? (on ? "var(--pf-primary-500)" : "var(--pf-n400)") : on ? "var(--pf-primary-100)" : "var(--pf-n50)";
          return (
            <div
              key={i}
              title={`Day ${i + 1} of ${len} — ${on ? "on tour" : "off tour"}`}
              style={{
                flex: "1 1 0", maxWidth: 24, height, borderRadius: 3, background: fill,
                border: `1px solid ${on ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
                boxShadow: cur ? "0 0 0 1.5px var(--pf-n0), 0 0 0 3px var(--pf-n900)" : "none",
              }}
            />
          );
        })}
      </div>
      {marker && (
        <div style={{ display: "flex", gap: 1.5, marginTop: 5 }}>
          {Array.from({ length: len }, (_, i) => (
            <div key={i} style={{ flex: "1 1 0", maxWidth: 24, height: 6, display: "flex", justifyContent: "center" }}>
              {i === pos && (
                <span style={{ width: 0, height: 0, borderLeft: "4px solid transparent", borderRight: "4px solid transparent", borderBottom: "6px solid var(--pf-n900)" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SiteCard({ site, rows, selected, onSelect }: { site: Site; rows: RosterRow[]; selected: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  const on = rows.filter((r) => r.on).length;
  const blocked = rows.filter((r) => !r.ready).length;
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        background: "var(--pf-n0)", borderRadius: 12, padding: 14, cursor: "pointer",
        border: `1px solid ${selected ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
        boxShadow: selected ? "0 0 0 1px var(--pf-primary-500), 0 1px 3px 0 #f3f3f3" : "0 1px 3px 0 #f3f3f3",
        transition: "border-color .12s ease, box-shadow .12s ease, background .12s ease",
        ...(hovered && !selected ? { background: "var(--pf-n25)" } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PfTile icon={SITE_ICON[site.kind]} tone={SITE_TONE[site.kind]} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.kind} · {site.loc}</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: selected ? "var(--pf-primary-500)" : "var(--pf-n900)", letterSpacing: "-.2px" }}>{on}</div>
          <div style={{ fontSize: 10.5, color: "var(--pf-n300)" }}>on tour</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
        <PfBadge tone="grey">Muster {site.muster}</PfBadge>
        <PfBadge tone="blue">{plural(rows.length, "row")} tracked</PfBadge>
        {blocked > 0 ? <PfBadge tone="red" dot>{blocked} not site-ready</PfBadge> : <PfBadge tone="green" dot>All site-ready</PfBadge>}
      </div>
    </div>
  );
}

function RosterRowView({ row, open, onToggle, onGo, onSchedule }: {
  row: RosterRow; open: boolean; onToggle: () => void; onGo: (stage: string) => void; onSchedule: () => void;
}) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const accent = !row.ready ? "var(--pf-red-500)" : row.on ? "var(--pf-primary-500)" : "var(--pf-n300)";
  const sig = signalFor(row.id);
  const lapse = NEXT_LAPSE.get(row.id);
  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)", background: open ? "var(--pf-n25)" : row.on ? "transparent" : "var(--pf-n25)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "1.7fr 1.05fr 0.8fr 1fr 1.55fr 34px", gap: 12, alignItems: "center",
          padding: "11px 20px 11px 17px", cursor: "pointer", borderLeft: `3px solid ${accent}`,
          background: hovered && !open ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
        }}
      >
        {/* worker */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ opacity: row.on ? 1 : 0.5, display: "inline-flex" }}>
            <PfAvatar init={row.init} tone={row.tone} size={32} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: row.on ? "var(--pf-n900)" : "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontFamily: "var(--mono)", color: "var(--pf-n300)" }}>{row.id}</span> · {row.role}
            </div>
          </div>
        </div>

        {/* worker type */}
        <div style={{ minWidth: 0 }}>
          <PfBadge tone={TYPE_TONE[row.workerType]}>{row.typeLabel}</PfBadge>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.company ?? "Direct · Unrealabs"}
          </div>
        </div>

        {/* tour */}
        <div>
          {row.on
            ? <PfBadge tone="green" dot>On tour</PfBadge>
            : <PfBadge tone="grey" dot>Off tour</PfBadge>}
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3 }}>{row.rot.name}</div>
        </div>

        {/* changeover */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>
            <span style={{ fontFamily: "var(--mono)" }}>{row.offIn}d</span>
            <span style={{ fontWeight: 500, color: "var(--pf-n400)" }}> · {dateAt(row.offIn)}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3 }}>{row.on ? CYCLE_WORDS[row.siteKind].goes : CYCLE_WORDS[row.siteKind].returns}</div>
        </div>

        {/* readiness */}
        <div style={{ minWidth: 0 }}>
          {row.ready ? <PfBadge tone="green" dot>Site-ready</PfBadge> : <PfBadge tone="red" dot>Gate blocked</PfBadge>}
          <div style={{ fontSize: 11, color: row.ready ? "var(--pf-n400)" : "var(--pf-red-500)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.blocking[0] ?? row.advisory[0] ?? "Every ticket and the medical in date"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--pf-n300)" }}>
          <Ic name={open ? "caretdown" : "caretright"} size={15} />
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 20px 16px 20px", display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <Ic name="orbit" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{row.rot.name}</span>
              <PfBadge tone="grey">{row.rot.onDays} on · {row.rot.offDays} off</PfBadge>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, fontFamily: "var(--mono)", color: "var(--pf-n400)" }}>Day {row.pos + 1}/{cycleLen(row.rot)}</span>
            </div>
            <CycleStrip rot={row.rot} pos={row.pos} height={16} />
            <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55, marginTop: 10 }}>
              {row.on
                ? `${first(row.name)} is on tour and musterable today. Changeover ${dateAt(row.offIn)} — anything scheduled after that date lands in the rest window.`
                : `${first(row.name)} is off tour. Nothing on this platform will book at ${first(row.name)} before ${dateAt(row.offIn)}; it proposes that date instead.`}
            </div>
            {lapse && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                <Ic name="clock" size={14} color="var(--pf-n300)" />
                <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>
                  Next lapse: <strong style={{ color: "var(--pf-n900)", fontWeight: 600 }}>{lapse.what}</strong>{" "}
                  {lapse.daysLeft < 0 ? `${Math.abs(lapse.daysLeft)}d overdue` : `in ${lapse.daysLeft}d (${dateAt(lapse.daysLeft)})`}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                <Ic name="shield" size={15} color={row.ready ? "var(--pf-primary-500)" : "var(--pf-red-500)"} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Gate check · FR-083</span>
              </div>
              {[...row.blocking.map((r) => ({ r, block: true })), ...row.advisory.map((r) => ({ r, block: false }))].map(({ r, block }) => (
                <div key={r} style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "4px 0" }}>
                  <Ic name={block ? "x" : "warning"} size={13} color={block ? "var(--pf-red-500)" : "var(--pf-yellow-500)"} />
                  <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>{r}</span>
                </div>
              ))}
              {row.blocking.length === 0 && row.advisory.length === 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Ic name="check" size={13} color="var(--pf-primary-500)" />
                  <span style={{ fontSize: 12, color: "var(--pf-n600)" }}>Every ticket valid and a medical in date.</span>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--pf-n50)" }}>
                The flag is all this roster carries. The fitness class, any restriction and the issuer numbers sit on the
                register behind an access log — a line manager reading this roster never sees them.
              </div>
            </div>

            {sig && (
              <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                  <Ic name="pulse" size={15} color="var(--pf-n400)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Muster signal</span>
                  <PfBadge tone={sig.tone}>{sig.absenceRate}% absence</PfBadge>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{sig.latenessPattern} · {sig.overtimeLoad}. {sig.note}</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 7 }}>
                  Ingested from {LIVE_ATTENDANCE?.provider ?? "the attendance adapter"}. Never a conduct finding, never an automated sanction.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PfBtn small variant="secondary" icon="shield" onClick={() => onGo("certifications")}>Register</PfBtn>
              <PfBtn small variant="secondary" icon="users" onClick={() => onGo("workforce")}>Worker record</PfBtn>
              <PfBtn small variant="primary" icon="calendar" onClick={onSchedule}>Find a window</PfBtn>
              <PfBtn
                small variant="ghost" icon="megaphone"
                onClick={() => toast(`Crew-change note sent to ${row.company ?? "Unrealabs People Ops"} — ${row.name}, ${row.rot.name}, ${row.on ? `changeover ${dateAt(row.offIn)}` : `back on tour ${dateAt(row.offIn)}`}.`, "success")}
              >
                Notify employer
              </PfBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The proposal's basis — deterministic, and it says so rather than implying a model. */
function WhyPanel({ act, onClose, onGo }: { act: Activity; onClose: () => void; onGo: (stage: string) => void }) {
  const audit = auditScore();
  return (
    <PfCard style={{ background: "var(--pf-n25)" }}>
      <PfCardHead
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ic name="question" size={16} color="var(--pf-n500)" />Why this window?</span>}
        sub={`The rule behind every ${act.noun} proposal on this page, stated in full.`}
      >
        <PfBtn small variant="ghost" icon="x" onClick={onClose}>Close</PfBtn>
      </PfCardHead>
      <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>The rule, in order</div>
          {[
            `Read the worker's rotation assignment. No assignment means no rotation constraint — an office worker is schedulable.`,
            `Take the day in cycle at ${REF_LABEL} and reduce it modulo the cycle length (${ROTATIONS.map((r) => cycleLen(r)).join(", ")} days).`,
            `A position below the on-tour length is on tour. Anything above it is a rest window, and no event may be written into it.`,
            `${act.onSite ? "This activity is on site, so the FR-083 gate is tested first: a lapsed ticket or an out-of-date medical blocks entry whether or not the tour is open." : "This activity is not on site, so the gate pass is not tested — only the tour is."}`,
            `Where the answer is no, return the next date the window opens. The person is deferred, never dropped.`,
          ].map((r, i) => (
            <div key={r} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", flex: "none", marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Ic name="robot" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>No model runs here</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
              A cycle position is arithmetic. There is no score, no confidence and no model card, because there is nothing to
              explain beyond a date and a modulo — and a scheduling rule a crew clerk cannot re-derive by hand is a rule nobody
              will trust at 05:30.
            </div>
            <div style={{ marginTop: 9 }}>
              <PfBtn small variant="secondary" icon="shield" onClick={() => onGo("aisurfaces")}>
                AI surface audit · {audit.covered}/{audit.total} covered
              </PfBtn>
            </div>
          </div>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Ic name="shield" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>What is never an input</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
              Worker type, nationality and host community ride this roster for NCDMB returns only. They are reporting fields.
              They do not decide who gets scheduled, and no protected attribute ever will.
            </div>
          </div>
        </div>
      </div>
    </PfCard>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function Sites() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("roster");
  const [siteId, setSiteId] = useState(SITES[0].id);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [tourFilter, setTourFilter] = useState("Everyone");
  const [shift, setShift] = useState(0);
  const [actKey, setActKey] = useState(ACTIVITIES[0].key);
  const [pop, setPop] = useState("all");
  const [placed, setPlaced] = useState<Record<string, "now" | "next">>({});
  const [why, setWhy] = useState(false);

  const site = SITES.find((s) => s.id === siteId) ?? SITES[0];
  const rows = ROWS_BY_SITE[site.id];
  const onTour = rows.filter((r) => r.on);
  const offTour = rows.filter((r) => !r.on);
  const blockedHere = rows.filter((r) => !r.ready);
  const visibleRows = rows.filter((r) =>
    tourFilter === "Everyone" ? true : tourFilter === "On tour" ? r.on : tourFilter === "Off tour" ? !r.on : !r.ready,
  );
  const untracked = Math.max(0, site.muster - onTour.length);

  const act = ACTIVITIES.find((a) => a.key === actKey) ?? ACTIVITIES[0];
  const population = pop === "all" ? ALL_ROWS : ROWS_BY_SITE[pop] ?? [];
  const decided = population.map((r) => ({ row: r, v: verdictFor(r, act) }));
  const nowList = decided.filter((d) => d.v.kind === "now");
  const laterList = decided.filter((d) => d.v.kind !== "now");
  const placedNow = Object.values(placed).filter((p) => p === "now").length;
  const placedNext = Object.values(placed).filter((p) => p === "next").length;

  const flipped = ALL_ROWS.filter((r) => onAt(r, shift) !== r.on);
  const onAtShift = ALL_ROWS.filter((r) => onAt(r, shift)).length;
  /** On tour today on a document that will not open the gate again — the sharpest read on the page. */
  const onTourBlocked = ALL_ROWS.filter((r) => r.on && !r.ready);

  const pickActivity = (key: string) => { setActKey(key); setPlaced({}); };
  const pickPop = (key: string) => { setPop(key); setPlaced({}); };

  const place = (rowId: string, kind: "now" | "next") => setPlaced((p) => ({ ...p, [rowId]: kind }));

  const scheduleOne = (row: RosterRow, v: Verdict) => {
    if (v.kind === "now") {
      place(row.id, "now");
      toast(`${act.label} booked for ${row.name} — on tour at ${SITES.find((s) => s.id === row.siteId)?.name ?? row.loc} — ${v.detail}.`, "success");
      return;
    }
    place(row.id, "next");
    toast(
      v.kind === "gated"
        ? `${act.label} held for ${row.name} — ${v.detail}. Renewal chased; the invitation issues the moment the gate clears.`
        : `${act.label} proposed for ${row.name} on ${dateAt(v.inDays)} — ${v.window}. Nothing was written into the rest window.`,
      "success",
    );
  };

  const scheduleAll = () => {
    const next: Record<string, "now" | "next"> = {};
    for (const d of decided) next[d.row.id] = d.v.kind === "now" ? "now" : "next";
    setPlaced(next);
    toast(
      `${act.label} scheduled across ${plural(decided.length, "worker")} — ${nowList.length} in this tour, ${laterList.length} proposed for their next window. Zero events landed off rotation.`,
      "success",
    );
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Sites &amp; rotations</span>
            <PfBadge tone="grey">FR-090</PfBadge>
            <PfBadge tone="blue" dot>Roster read {REF_LABEL}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, maxWidth: 780 }}>
            Who is on tour, who is musterable, and whose ticket lapses before the next changeover — joined to the rotation
            calendar every other pillar has to respect. A person on a 28/28 does not have a Tuesday.
          </div>
        </div>
        <PfBtn
          variant="secondary" icon="download"
          onClick={() => toast(`Muster list exported — ${site.name}, ${plural(onTour.length, "rotation-tracked worker")} on tour against a site muster of ${site.muster}.`)}
        >
          Export muster
        </PfBtn>
        <PfBtn variant="primary" icon="calendar" onClick={() => { setTab("scheduling"); toast("Rotation-aware scheduler open — pick an activity and a population."); }}>
          Find a window
        </PfBtn>
      </div>

      {/* --------------------------------- KPIs --------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="orbit" tone="purple" label="Rotation-tracked" value={ALL_ROWS.length} unit="workers" delta={`${ROTATIONS.length} calendars`} deltaTone="grey" />
        <PfStat icon="lifebuoy" tone="blue" label="On tour today" value={`${ON_NOW}/${ROTATION_ASSIGNMENTS.length}`} delta={`${OFF_NOW} off tour`} deltaTone="grey" />
        <PfStat icon="shield" tone={READY_NOW === ALL_ROWS.length ? "green" : "red"} label="Site-ready" value={`${READY_NOW}/${ALL_ROWS.length}`} delta={`${ALL_ROWS.length - READY_NOW} gate blocks`} deltaTone="red" />
        <PfStat icon="calendar" tone="green" label="Off-rotation events" value={0} unit="written" delta="FR-090 gate holds" deltaTone="green" />
      </div>

      {/* ------------------------------- the banner ----------------------------- */}
      <PfBanner
        tone={onTourBlocked.length ? "red" : "green"}
        icon={onTourBlocked.length ? "warning" : "check"}
        cta="Register"
        onCta={() => go("certifications")}
      >
        {onTourBlocked.length
          ? `${onTourBlocked.length} workers are on tour right now on a document that will not open the gate again — ${onTourBlocked.map((r) => `${r.name} (${r.blocking[0]})`).join(" · ")}. Their papers lapsed after they boarded, which is exactly why a roster read against the tour beats a register read against a month.`
          : `Every worker on tour at ${REF_LABEL} holds a valid gate pass. The roster and the register agree.`}
      </PfBanner>

      {/* --------------------------------- tabs --------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "roster", label: "Site roster" },
            { key: "rotations", label: "Rotation calendars", count: String(ROTATIONS.length) },
            { key: "scheduling", label: "Rotation-aware scheduling" },
          ]}
        />
      </div>

      {/* ================================ ROSTER ================================= */}
      {tab === "roster" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            {SITES.map((s) => (
              <SiteCard key={s.id} site={s} rows={ROWS_BY_SITE[s.id]} selected={s.id === site.id} onSelect={() => { setSiteId(s.id); setOpenRow(null); }} />
            ))}
          </div>

          {/* ------------------------------ muster read ---------------------------- */}
          <PfCard>
            <PfCardHead
              title={`${site.name} · muster read`}
              sub={`${site.kind} · ${site.loc}. The site's own muster number against the rows Hirebrew actually holds a rotation assignment for.`}
            >
              <PfBadge tone={SITE_TONE[site.kind]} dot>{site.kind}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", border: "1px solid var(--pf-n50)" }}>
                <div style={{ width: `${(onTour.length / site.muster) * 100}%`, background: "var(--pf-primary-500)", minWidth: 6 }} title={`${onTour.length} tracked and on tour`} />
                <div style={{ flex: 1, background: "repeating-linear-gradient(135deg, var(--pf-n25) 0 6px, var(--pf-n50) 6px 12px)" }} title={`${untracked} on the muster list without a rotation assignment on file`} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginTop: 14 }}>
                {[
                  { k: "Site muster", v: site.muster, note: site.kind === "Offshore" ? "The site's own count of souls on board." : "The site's own head count at muster.", tone: "grey" as PfTone },
                  { k: "Tracked · on tour", v: onTour.length, note: "Assignment on file and inside the on-tour window today.", tone: "green" as PfTone },
                  { k: "Tracked · off tour", v: offTour.length, note: "On the spine, not musterable today. Not absent — off.", tone: "yellow" as PfTone },
                  { k: "No assignment on file", v: untracked, note: "Coverage the crew-change manifests have not reached yet.", tone: "blue" as PfTone },
                ].map((c, i) => (
                  <div key={c.k} style={{ paddingLeft: i === 0 ? 0 : 14, borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{c.v}</span>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[c.tone].bg }} />
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{c.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              The muster number belongs to the site, not to us — we do not reconcile it, we report against it. Coverage grows
              as each contracting employer files its crew list; the CSV adapter takes them today.
            </div>
          </PfCard>

          {/* -------------------------------- roster ------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Who is on rotation"
              sub={`${plural(visibleRows.length, "worker")} at ${site.name}. Off-tour rows are shaded — they are not absent, they are off. Click a row for the tour, the gate check and the muster signal.`}
            >
              {blockedHere.length > 0 && <PfBadge tone="red" dot>{blockedHere.length} gate-blocked</PfBadge>}
              <PfTabs tabs={["Everyone", "On tour", "Off tour", "Blocked"]} active={tourFilter} onChange={setTourFilter} />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.05fr 0.8fr 1fr 1.55fr 34px", gap: 12, padding: "9px 20px 9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Worker</PfTh>
              <PfTh>Worker type</PfTh>
              <PfTh>Tour</PfTh>
              <PfTh>Changeover</PfTh>
              <PfTh>Site-access readiness</PfTh>
              <PfTh />
            </div>

            {visibleRows.map((r) => (
              <RosterRowView
                key={r.id}
                row={r}
                open={openRow === r.id}
                onToggle={() => setOpenRow((p) => (p === r.id ? null : r.id))}
                onGo={go}
                onSchedule={() => { setTab("scheduling"); setPop(r.siteId); setPlaced({}); toast(`Scheduler filtered to ${site.name} — ${r.name} is ${r.on ? "on tour" : `off tour until ${dateAt(r.offIn)}`}.`); }}
              />
            ))}

            {visibleRows.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                Nobody at {site.name} matches this filter.
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="shield" size={13} color="var(--pf-n300)" />
              Worker type, contracting employer, nationality and host community are NCDMB reporting fields on this roster —
              never inputs to the readiness flag and never to a scheduling decision.
            </div>
          </PfCard>

          {/* --------------------------- changeover risk --------------------------- */}
          <PfCard>
            <PfCardHead
              title="Lapsing before the next changeover"
              sub="Every expiry inside 30 days, read against the tour it falls in. This is the read a diary reminder cannot give you."
            >
              <PfBadge tone={CHANGEOVER_RISK.some((c) => c.tone === "red") ? "red" : "yellow"}>{plural(CHANGEOVER_RISK.length, "worker")}</PfBadge>
            </PfCardHead>
            {CHANGEOVER_RISK.map((c, i) => (
              <div key={c.row.id + c.lapse.what} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.15fr 2.2fr 150px", gap: 12, alignItems: "center", padding: "12px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <PfAvatar init={c.row.init} tone={c.row.tone} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.row.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{SITES.find((s) => s.id === c.row.siteId)?.name} · {c.row.rot.name}</div>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.lapse.what}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{c.lapse.kind} · {c.row.on ? "on tour" : "off tour"}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.45 }}>{c.verdict}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <PfBadge tone={c.tone} dot>{c.lapse.daysLeft < 0 ? `${Math.abs(c.lapse.daysLeft)}d over` : `${c.lapse.daysLeft}d`}</PfBadge>
                  <PfBtn
                    small variant="secondary"
                    onClick={() => toast(`Renewal slotted for ${c.row.name} — ${c.lapse.what}, booked into the ${c.row.on ? `off-tour window after ${dateAt(c.row.offIn)}` : `days before ${dateAt(c.row.offIn)}`}. Crew planning copied.`, "success")}
                  >
                    Slot renewal
                  </PfBtn>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="clock" size={13} color="var(--pf-n300)" />
              A renewal booked into a rest window costs a day off. A renewal missed costs a flight, a bed and a shift. That is
              the whole argument for holding the rotation next to the register.
            </div>
          </PfCard>
        </div>
      )}

      {/* ============================== ROTATIONS =============================== */}
      {tab === "rotations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* --------------------------- the day scrubber -------------------------- */}
          <PfCard>
            <PfCardHead
              title="Cycle preview"
              sub={`Move the read date to see who is on tour. Reference date is ${REF_LABEL} — the date every position on this page is derived from.`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PfBtn small variant="secondary" onClick={() => setShift((s) => s - 7)}>−7d</PfBtn>
                <PfBtn small variant="secondary" onClick={() => setShift((s) => s - 1)}>−1d</PfBtn>
                <PfBtn small variant={shift === 0 ? "primary" : "secondary"} onClick={() => setShift(0)}>Today</PfBtn>
                <PfBtn small variant="secondary" onClick={() => setShift((s) => s + 1)}>+1d</PfBtn>
                <PfBtn small variant="secondary" onClick={() => setShift((s) => s + 7)}>+7d</PfBtn>
              </div>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {[
                { k: "Reading", v: dateAt(shift), note: shift === 0 ? "Today's roster read." : `${shift > 0 ? "+" : ""}${shift} days from the reference date.` },
                { k: "On tour across all sites", v: `${onAtShift} of ${ALL_ROWS.length}`, note: shift === 0 ? "Musterable somewhere right now." : `${onAtShift > ON_NOW ? "More" : onAtShift < ON_NOW ? "Fewer" : "The same"} bodies than today.` },
                { k: "Changeovers in the window", v: String(flipped.length), note: flipped.length ? flipped.map((f) => `${first(f.name)} ${onAt(f, shift) ? "on" : "off"}`).join(" · ") : "Nobody flips between the two dates." },
              ].map((c, i) => (
                <div key={c.k} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", marginTop: 4 }}>{c.v}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{c.note}</div>
                </div>
              ))}
            </div>
            {shift !== 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: TONE.yellow.soft, borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-yellow-500)", fontWeight: 500 }}>
                <Ic name="info" size={13} color="var(--pf-yellow-500)" />
                Preview only. Moving the read date changes nothing — no crew change is planned here, no event is written, no
                tour is altered. Press Today to return the page to its reference read.
              </div>
            )}
          </PfCard>

          {/* ----------------------------- the calendars --------------------------- */}
          {ROTATIONS.map((rot) => {
            const assigned = ALL_ROWS.filter((r) => r.rot.id === rot.id);
            const rotSite = SITES.find((s) => s.id === rot.siteId);
            const len = cycleLen(rot);
            return (
              <PfCard key={rot.id}>
                <PfCardHead
                  title={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--pf-n300)" }}>{rot.id}</span>
                      {rot.name}
                      <PfBadge tone="grey">{rot.onDays} on · {rot.offDays} off</PfBadge>
                      <PfBadge tone={rotSite ? SITE_TONE[rotSite.kind] : "grey"} dot>{rotSite?.name ?? rot.siteId}</PfBadge>
                    </span>
                  }
                  sub={`${len}-day cycle · started ${rot.cycleStart} · ${plural(assigned.length, "worker")} assigned. Leave, reviews and training all book against this pattern, not a five-day week.`}
                >
                  <PfBadge tone="blue">{assigned.length} assigned</PfBadge>
                  <PfBtn small variant="secondary" icon="users" onClick={() => { setTab("roster"); setSiteId(rot.siteId); setOpenRow(null); }}>Roster</PfBtn>
                </PfCardHead>

                {/* the pattern itself */}
                <div style={{ padding: "14px 20px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n400)" }}>
                      <span style={{ width: 12, height: 10, borderRadius: 3, background: "var(--pf-primary-100)", border: "1px solid var(--pf-primary-100)" }} />
                      {rot.onDays} days on tour
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n400)" }}>
                      <span style={{ width: 12, height: 10, borderRadius: 3, background: "var(--pf-n50)", border: "1px solid var(--pf-n100)" }} />
                      {rot.offDays} days off
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n400)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--pf-primary-500)" }} />
                      position on {dateAt(shift)}
                    </span>
                  </div>
                  <CycleStrip rot={rot} pos={-1} height={12} marker={false} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10.5, fontFamily: "var(--mono)", color: "var(--pf-n300)" }}>
                    <span>Day 01 · {rotSite ? CYCLE_WORDS[rotSite.kind].start : "on"}</span>
                    <span>Day {String(rot.onDays + 1).padStart(2, "0")} · {rotSite ? CYCLE_WORDS[rotSite.kind].leave : "off"}</span>
                    <span>Day {len} · cycle close</span>
                  </div>
                </div>

                {/* one strip per assignment */}
                {assigned.map((r) => {
                  const p = posAt(r, shift);
                  const isOn = onAt(r, shift);
                  return (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "190px 1fr 168px", gap: 14, alignItems: "center", padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span style={{ opacity: isOn ? 1 : 0.5, display: "inline-flex" }}>
                          <PfAvatar init={r.init} tone={r.tone} size={28} />
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: isOn ? "var(--pf-n900)" : "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.typeLabel} · {r.company ?? "Direct"}</div>
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <CycleStrip rot={rot} pos={p} height={14} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                        {isOn ? <PfBadge tone="green" dot>On tour · day {p + 1}</PfBadge> : <PfBadge tone="grey" dot>Off tour · day {p + 1}</PfBadge>}
                        <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>
                          {shift === 0
                            ? `${r.on ? CYCLE_WORDS[r.siteKind].goes : CYCLE_WORDS[r.siteKind].returns} ${dateAt(r.offIn)}`
                            : `read at ${dateAt(shift)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {assigned.length === 0 && (
                  <div style={{ padding: "22px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                    No assignments on this calendar yet — the pattern exists, the manifest has not arrived.
                  </div>
                )}
              </PfCard>
            );
          })}

          {/* ------------------------- where the roster comes from ------------------ */}
          <PfCard>
            <PfCardHead
              title="Where a rotation assignment comes from"
              sub="Adapter-first. A crew-change manifest is a file today and an API when somebody opens one — the surface does not change either way."
            >
              <PfBadge tone="grey">{ROSTER_SOURCES.filter((s) => s.state === "live").length} live · {ROSTER_SOURCES.filter((s) => s.state === "awaiting-access").length} awaiting access</PfBadge>
            </PfCardHead>
            {ROSTER_SOURCES.map((s, i) => (
              <div key={s.name} style={{ display: "grid", gridTemplateColumns: "200px 220px 1fr 150px", gap: 12, alignItems: "center", padding: "11px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PfTile icon={s.state === "live" ? "check" : s.state === "ready" ? "swap" : "clock"} tone={ADAPTER_TONE[s.state]} size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{s.name}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{s.what}</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.45 }}>{s.note}</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <PfBadge tone={ADAPTER_TONE[s.state]} dot>{ADAPTER_LABEL[s.state]}</PfBadge>
                </div>
              </div>
            ))}
            <div style={{ padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Ic name="pulse" size={14} color="var(--pf-n400)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Confirming the roster against who actually mustered</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5, marginBottom: 8 }}>
                A rotation says who should be on site. Clock events say who was. The attendance contract carries that
                comparison — and it produces a signal, never a conduct finding and never an automated sanction.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ATTENDANCE_ADAPTERS.map((a) => (
                  <PfBadge key={a.provider} tone={ADAPTER_TONE[a.state]} dot>{a.provider} · {ADAPTER_LABEL[a.state]}</PfBadge>
                ))}
                <PfBtn small variant="secondary" icon="arrowright" onClick={() => go("attendance")}>Attendance signals</PfBtn>
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* ============================== SCHEDULING =============================== */}
      {tab === "scheduling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* -------------------------------- the gate ----------------------------- */}
          <PfCard>
            <PfCardHead
              title="The gate"
              sub="FR-090's acceptance test: scheduling anything across the platform must land zero events in an off-rotation window — and must propose the next one instead of dropping the person."
            >
              <PfBtn small variant="secondary" icon="question" onClick={() => setWhy((v) => !v)}>{why ? "Hide basis" : "Why this window?"}</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 0 }}>
              {[
                { k: "Considered", v: String(decided.length), note: `${act.label} · ${pop === "all" ? "every rotation-tracked worker" : SITES.find((s) => s.id === pop)?.name}`, tone: "grey" as PfTone },
                { k: "Schedulable now", v: String(nowList.length), note: "On tour today and, where the activity needs it, through the gate.", tone: "green" as PfTone },
                { k: "Deferred with a window", v: String(laterList.length), note: "Off rotation or gate-blocked — each carries the next date it can take.", tone: "yellow" as PfTone },
                { k: "Off-rotation events", v: "0", note: "The number that has to stay zero. Dropping people would also make it zero — that is why the column above exists.", tone: "green" as PfTone },
              ].map((c, i) => (
                <div key={c.k} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: c.k === "Off-rotation events" ? "var(--pf-primary-500)" : "var(--pf-n900)", letterSpacing: "-.4px" }}>{c.v}</span>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[c.tone].bg }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{c.note}</div>
                </div>
              ))}
            </div>
          </PfCard>

          {why && <WhyPanel act={act} onClose={() => setWhy(false)} onGo={go} />}

          {/* ------------------------------ the scheduler -------------------------- */}
          <PfCard>
            <PfCardHead
              title="Schedule against the rotation"
              sub="Pick what you are booking and who it is for. The window is computed before an invitation exists — not corrected after somebody misses it."
            >
              <PfTabs
                tabs={["all", ...SITES.map((s) => s.id)].map((k) => (k === "all" ? "All sites" : SITES.find((s) => s.id === k)?.name ?? k))}
                active={pop === "all" ? "All sites" : SITES.find((s) => s.id === pop)?.name ?? "All sites"}
                onChange={(label) => pickPop(label === "All sites" ? "all" : SITES.find((s) => s.name === label)?.id ?? "all")}
              />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, padding: 14 }}>
              {ACTIVITIES.map((a) => {
                const sel = a.key === act.key;
                return (
                  <button
                    key={a.key}
                    onClick={() => pickActivity(a.key)}
                    style={{
                      fontFamily: "inherit", textAlign: "left", cursor: "pointer", padding: 13, borderRadius: 12,
                      background: sel ? TONE[a.tone].soft : "var(--pf-n0)",
                      border: `1px solid ${sel ? TONE[a.tone].line : "var(--pf-n50)"}`,
                      boxShadow: sel ? `0 0 0 1px ${TONE[a.tone].line}` : "0 1px 3px 0 #f3f3f3",
                      transition: "background .12s ease, border-color .12s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <PfTile icon={a.icon} tone={a.tone} size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{a.label}</div>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{a.where}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 9 }}>
                      <PfBadge tone={a.onSite ? "red" : "grey"}>{a.onSite ? "Tour + gate pass" : "Tour only"}</PfBadge>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon={act.icon} tone={act.tone} size={28} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{act.blurb}</div>
              <PfBtn small variant="secondary" icon="arrowright" onClick={() => go(act.stage)}>Open {act.label}</PfBtn>
              <PfBtn small variant="primary" icon="calendar" onClick={scheduleAll}>Schedule all {decided.length}</PfBtn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {/* --------------------------- schedulable now -------------------------- */}
              <div style={{ borderRight: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: TONE.green.soft }}>
                  <Ic name="check" size={14} color="var(--pf-primary-500)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-500)" }}>Can be scheduled now · {nowList.length}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{placedNow} booked</span>
                </div>
                {nowList.map(({ row, v }) => (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--pf-n50)" }}>
                    <PfAvatar init={row.init} tone={row.tone} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.detail}</div>
                    </div>
                    {placed[row.id] === "now" ? (
                      <PfBadge tone="green" dot>Booked</PfBadge>
                    ) : (
                      <PfBtn small variant="secondary" onClick={() => scheduleOne(row, v)}>Schedule</PfBtn>
                    )}
                  </div>
                ))}
                {nowList.length === 0 && (
                  <div style={{ padding: "24px 18px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                    Nobody in this population is reachable for {act.label} today.
                  </div>
                )}
              </div>

              {/* ------------------------ deferred with a window ---------------------- */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: TONE.yellow.soft }}>
                  <Ic name="clock" size={14} color="var(--pf-yellow-500)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-yellow-500)" }}>Next window proposed · {laterList.length}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{placedNext} held</span>
                </div>
                {laterList.map(({ row, v }) => (
                  <div key={row.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 18px", borderTop: "1px solid var(--pf-n50)" }}>
                    <span style={{ opacity: 0.55, display: "inline-flex" }}><PfAvatar init={row.init} tone={row.tone} size={30} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</span>
                        <PfBadge tone={VERDICT_TONE[v.kind]}>{v.head}</PfBadge>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.45 }}>{v.detail}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                        <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)" }}>
                          {v.kind === "window" ? `Proposed ${dateAt(v.inDays)} — ${v.window}` : `Held — ${v.window}`}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                      {placed[row.id] === "next" ? (
                        <PfBadge tone="blue" dot>{v.kind === "window" ? `Held ${dateAt(v.inDays)}` : "Held"}</PfBadge>
                      ) : (
                        <PfBtn small variant="secondary" onClick={() => scheduleOne(row, v)}>
                          {v.kind === "window" ? `Take ${dateAt(v.inDays)}` : "Hold the slot"}
                        </PfBtn>
                      )}
                      {v.kind === "gated" && (
                        <PfBtn small variant="ghost" icon="shield" onClick={() => go("certifications")}>Renewal</PfBtn>
                      )}
                    </div>
                  </div>
                ))}
                {laterList.length === 0 && (
                  <div style={{ padding: "24px 18px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                    Everybody in this population is reachable today — nothing to defer.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Deferred is not declined. Each held slot carries a date, the invitation issues on that date, and the worker sees
              the same window on their own leave and review pages — one rotation, one story.
            </div>
          </PfCard>

          {/* --------------------------- coverage of the gate ---------------------- */}
          <PfCard>
            <PfCardHead
              title="The same gate, everywhere the platform writes an event"
              sub="This is the differentiator: not a rota page, but a rotation the whole product is aware of. Every surface below asks this question before it books anything."
            >
              <PfBadge tone="green" dot>{GATE_SURFACES.length} surfaces wired</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {GATE_SURFACES.map((s, i) => (
                <button
                  key={s.stage}
                  onClick={() => go(s.stage)}
                  style={{
                    fontFamily: "inherit", textAlign: "left", cursor: "pointer", background: "var(--pf-n0)",
                    border: "none", borderTop: i < 3 ? "none" : "1px solid var(--pf-n50)",
                    borderLeft: i % 3 === 0 ? "none" : "1px solid var(--pf-n50)", padding: "14px 18px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.label}</span>
                    <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{s.note}</div>
                </button>
              ))}
            </div>
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <PfTile icon="orbit" tone="purple" size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 4 }}>Why this is the hard one to copy</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    A calendar that assumes a five-day week will happily book a review at somebody on a boat, and the miss
                    looks like the worker&apos;s fault. Fixing that is not a feature bolted onto a scheduler — the rotation has to
                    sit on the person record, and every surface that writes an event has to read it. That is a spine decision,
                    and spines are the expensive thing to retrofit.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <PfBtn small variant="secondary" icon="users" onClick={() => go("workforce")}>Worker spine · FR-082</PfBtn>
                    <PfBtn small variant="secondary" icon="shield" onClick={() => go("certifications")}>Gate pass · FR-083</PfBtn>
                    <PfBtn small variant="secondary" icon="star" onClick={() => go("trust")}>Trust center</PfBtn>
                  </div>
                </div>
                <div style={{ width: 190, flex: "none" }}>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginBottom: 6 }}>Rotation coverage of the tracked workforce</div>
                  <PfProgress pct={Math.round((ALL_ROWS.length / SPINE_IN_SCOPE) * 100)} tone="purple" height={8} />
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.45 }}>
                    {ALL_ROWS.length} of the {SPINE_IN_SCOPE} workers in headcount scope carry a rotation assignment. The rest
                    are office-calendar people — the gate simply does not apply to them.
                  </div>
                </div>
              </div>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
