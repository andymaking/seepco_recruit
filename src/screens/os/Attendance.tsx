"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfSegments, PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  SEED_ATTENDANCE_SIGNALS, ATTENDANCE_CSV_SAMPLE, CSV_ATTENDANCE, adapterFor, activeAdapter,
  type AttendanceEvent, type AttendanceSignal, type AdapterInfo, type AdapterState,
} from "@/data/adapters";
import {
  ALL_WORKERS, personById, workerById, companyById, WORKER_TYPE_LABEL,
  ROTATION_ASSIGNMENTS, ROTATIONS, onRotation, daysUntilOff,
} from "@/data/workforce";
import { DISCIPLINARY_CASES } from "@/data/hrops";
import { MODEL_CARDS, SECURITY_POSTURE, AI_SURFACES, auditScore } from "@/data/trust";

/**
 * Attendance signals — PRD v2.1 FR-089.
 *
 * THE STRATEGIC POINT, stated on the page itself: we do NOT build time-and-
 * attendance. No clock, no roster, no timesheet and no shift engine lives here.
 * The clock is whatever the site already runs — a biometric reader at Bonny, a
 * supervisor's spreadsheet at Bonga. We ingest its events behind the
 * `attendance_source` contract and publish what they imply: absence rate,
 * lateness pattern, overtime load. Clock events in, derived signals out.
 *
 * DOCTRINE. Reads, not engines: nothing on this page prices a day, accrues
 * leave or schedules a tour. Adapter-first: CSV upload is live today, the
 * biometric export is ready, a vendor Time API is awaiting access — all three
 * against the same two-method interface, so the surface never changes when one
 * switches on. AI proposes, humans decide: every derived signal carries a
 * "Why this?" naming model card MC-07 and stating what the signal is NOT.
 *
 * GOVERNANCE (P0, not a footnote). Attendance signals NEVER trigger automated
 * discipline — the only path from a signal to a case runs through a named
 * human, and DC-14 is the worked example. Individual-level views are
 * permissioned and every open writes an access-log row. A DPIA gates GA on real
 * employee data; today this reads demo and consented-pilot data only.
 *
 * NCDMB / protected attributes — nationality, host community, worker type,
 * contracting employer — are REPORTING fields on the workforce spine. MC-07's
 * declared inputs are "clock events only". None of them reach the signal.
 */

/* --------------------------------- tokens --------------------------------- */

const MONO = "var(--mono), ui-monospace, SFMono-Regular, Menlo, monospace";

const ADAPTER_TONE: Record<AdapterState, PfTone> = { live: "green", ready: "blue", "awaiting-access": "yellow" };
const ADAPTER_LABEL: Record<AdapterState, string> = { live: "Live", ready: "Ready", "awaiting-access": "Awaiting API access" };

const KIND_TONE: Record<AttendanceEvent["kind"], PfTone> = { present: "green", late: "yellow", absent: "red", overtime: "purple" };

/** Absence bars are drawn on a fixed 0–12% scale so four workers compare honestly. */
const ABS_CEILING = 12;
/** The site's own overtime reference — 48h across a 4-week window. */
const OT_REFERENCE = 48;

const otHours = (s: AttendanceSignal) => parseInt(s.overtimeLoad, 10) || 0;
const first = (n: string) => n.split(" ")[0];

const SIGNALS = SEED_ATTENDANCE_SIGNALS;
const ELEVATED = SIGNALS.filter((s) => s.tone !== "green");
const MC07 = MODEL_CARDS.find((m) => m.id === "MC-07")!;
const AS12 = AI_SURFACES.find((a) => a.id === "AS-12")!;
const DPIA_ROW = SECURITY_POSTURE.find((p) => p.area === "DPIAs")!;
const ATT_CASE = DISCIPLINARY_CASES.find((c) => c.category === "Attendance")!;
const LIVE = activeAdapter("attendance_source");

/* ------------------------------- adapters ---------------------------------- */

/**
 * The registry carries CSV upload (live) and the biometric export (ready). The
 * vendor Time API is the third implementation of the SAME contract and it is
 * honestly parked: awaiting access is a state, not a failure.
 */
const VENDOR_TIME: AdapterInfo = {
  contract: "attendance_source", version: "v1", provider: "SeamlessHR Time",
  state: "awaiting-access",
  note: "Built to the same contract; activates on API access. Nothing on this page changes the day it does.",
};

const ATT_ADAPTERS: AdapterInfo[] = [...adapterFor("attendance_source"), VENDOR_TIME];

const ADAPTER_DETAIL: Record<string, { icon: string; how: string; cadence: string; cta: string }> = {
  "CSV upload": { icon: "download", how: "A site clerk drops the reader's export, or pastes it. Four columns, one header line.", cadence: "On demand · daily at Bonny Terminal", cta: "Ingest a drop" },
  "Biometric export": { icon: "shield", how: "The same four columns, written by the reader itself on a schedule. No re-keying at all.", cadence: "Needs a device export window agreed with the site", cta: "Schedule the export" },
  "SeamlessHR Time": { icon: "swap", how: "Pull against the vendor's time API, mapped onto the same AttendanceEvent shape.", cadence: "Blocked on partner API access — sequenced by what tenants actually run", cta: "Track access" },
};

/* ------------------------------- day strips -------------------------------- */

/**
 * The last 20 days per worker, read against their ROTATION — P present, L late,
 * A absent, O off tour. This is the individual-level view: permissioned, and
 * every open writes an access-log row.
 */
const DAY_STRIP: Record<string, string> = {
  "W-3305": "OOO" + "PAPALPPALPLPLP" + "OOO",
  "E-0231": "PPPPPPPPPPAA" + "OOOOOO" + "PP",
  "W-3301": "OOOOOOOOOOOOOOO" + "PPPPP",
  "W-3302": "PLPPPPPPLPPPPP" + "OOO" + "PPP",
};

const DAY_TONE: Record<string, { bg: string; label: string }> = {
  P: { bg: "var(--pf-primary-500)", label: "Present" },
  L: { bg: "var(--pf-yellow-500)", label: "Late" },
  A: { bg: "var(--pf-red-500)", label: "Absent" },
  O: { bg: "var(--pf-n100)", label: "Off rotation" },
};

/* ------------------------------ per-signal copy ---------------------------- */

type Route = { label: string; tone: PfTone; go?: string; toast?: string; hint: string };

type SignalCopy = {
  window: string; events: number; confidence: string;
  context: string;
  /** One line that only applies to this worker — the rest of the basis is derived. */
  extra: string;
  routes: Route[];
};

const COPY: Record<string, SignalCopy> = {
  "W-3305": {
    window: "20 days to 26 Aug 2026 · 14 of them on tour",
    events: 20, confidence: "Medium — one source, 14 tour days ingested",
    context:
      "Three no-clock days (5, 7 and 11 August) sit on dates Field Operations logged crew-boat cancellations. The signal says the pattern exists. It does not say why, and it does not say whose fault it is.",
    extra: "Absence and overtime move together in the same window — the shape of a workload problem, not of a conduct one.",
    routes: [
      { label: "Anomaly feed", tone: "blue", go: "command", hint: "Elevated signals surface as an anomaly card for a named owner." },
      { label: "Attrition feature set", tone: "purple", go: "attrition", hint: "Enters MC-02 as an aggregated absence feature — never the narrative." },
      { label: "DC-14 · opened by a human", tone: "grey", go: "cases", hint: "People Ops opened the case after reading this. The signal did not open it." },
    ],
  },
  "E-0231": {
    window: "20 days to 26 Aug 2026 · 14 of them on tour",
    events: 20, confidence: "Medium — matches an August 2025 pattern on the same changeover",
    context:
      "Two sick days land on the last two days of the tour, immediately before crew change. The same cluster shape the Command feed already raised as AN-101 — one story, reaching two surfaces.",
    extra: "Clusters on the changeover boundary, not spread across the tour — which is why the roster is the thing to look at first.",
    routes: [
      { label: "AN-101 · same cluster", tone: "yellow", go: "command", hint: "The anomaly is the alert. This signal is its evidence. Neither is a finding." },
      { label: "Risk reason: “Absence pattern change”", tone: "purple", go: "attrition", hint: "Already cited on Emeka's leave-risk card (MC-02). That reason is this signal." },
    ],
  },
  "W-3301": {
    window: "20 days to 26 Aug 2026 · 5 of them on tour",
    events: 20, confidence: "Low — only 5 tour days ingested since the 28/28 cycle turned",
    context:
      "Nothing anomalous. Shown anyway: a page that only renders the bad rows teaches its readers that appearing here is an accusation.",
    extra: "Five tour days is a thin window. The rate is published with its denominator so nobody over-reads it.",
    routes: [
      { label: "Anomaly feed", tone: "grey", toast: "Nothing to route — W-3301 is inside the normal band, so no anomaly card is raised.", hint: "Green signals raise nothing. Silence is the correct output." },
    ],
  },
  "W-3302": {
    window: "20 days to 26 Aug 2026 · 17 of them on tour",
    events: 20, confidence: "Medium — two lates, both on the same weekday",
    context:
      "Both late clock-ins fall on crew-boat days at Bonny Terminal. A logistics signal wearing a lateness costume — the fix is the boat schedule, not the person.",
    extra: "Lateness concentrates on one weekday. A conduct pattern would not respect a timetable.",
    routes: [
      { label: "Anomaly feed", tone: "blue", go: "command", hint: "Raised as a logistics anomaly, owned by Field Operations." },
      { label: "Crew-boat schedule", tone: "grey", toast: "Flagged to Field Operations — Grace Etim's late clock-ins cluster on crew-boat days at Bonny Terminal.", hint: "Routed to the roster owner, because that is where the cause is." },
    ],
  },
};

/** Shared across every signal — the FR-093 half that matters most. */
const IS_NOT: string[] = [
  "Not a conduct finding. No absence on this page has been judged by anything.",
  "Not a score, a ranking or a percentile against other workers. There is no leaderboard.",
  "Not an input to a sanction. MC-07 has no sanction vocabulary and cannot produce one.",
  "Not a payroll input. This page does not price a day, and never will (v2.1 §2.2).",
  "Not measured in calendar days. The denominator is scheduled tours, read off the rotation calendar (FR-090).",
];

/* --------------------------------- ingest ---------------------------------- */

/** A fuller drop for demonstrating the derivation — late, absent and clean rows. */
const BIGGER_DROP = `worker_id,date,clock_in,clock_out
W-3301,2026-08-05,05:52,17:31
W-3305,2026-08-05,,
W-3302,2026-08-05,06:19,17:04
E-0231,2026-08-05,05:41,18:55
W-3301,2026-08-06,05:48,17:22
W-3305,2026-08-06,05:58,19:40
W-3302,2026-08-06,05:55,17:01
E-0231,2026-08-06,05:44,17:38
W-3305,2026-08-07,,
W-3302,2026-08-07,06:27,17:12`;

const DERIVATION: { rule: string; kind: AttendanceEvent["kind"] | "—"; note: string }[] = [
  { rule: "clock_in is empty", kind: "absent", note: "No event beats a guessed one. An empty cell is a fact, not a zero." },
  { rule: "clock_in later than 06:00", kind: "late", note: "06:00 is the site's own muster time, not a platform default." },
  { rule: "anything else", kind: "present", note: "The overwhelming majority. Nothing further is inferred from it." },
  { rule: "long clock_out", kind: "—", note: "The v1 reference adapter does not tag overtime per event — it aggregates the clock-out side into the 4-week overtime load. Stated plainly rather than implied." },
];

const CONTRACT_SRC = `interface AttendanceSource {
  readonly provider: string
  ingest(csv: string): AttendanceEvent[]
  signals(): AttendanceSignal[]
}`;

/* -------------------------------- governance -------------------------------- */

type RbacRow = { role: string; individual: "Yes" | "Own scope" | "No"; scope: string; logged: boolean };

const RBAC: RbacRow[] = [
  { role: "People Ops · HR", individual: "Yes", scope: "Every worker on an ingested feed", logged: true },
  { role: "Line manager", individual: "Own scope", scope: "Own crew only — no cross-crew reads", logged: true },
  { role: "Contracting employer portal", individual: "Own scope", scope: "Only workers that company has deployed", logged: true },
  { role: "HSE lead", individual: "No", scope: "Site rollups and absence rates, no named rows", logged: false },
  { role: "Executive · Command center", individual: "No", scope: "Aggregate anomalies only", logged: false },
  { role: "Analytics / model training", individual: "No", scope: "Aggregated counts, permissioned (FR-088 pattern)", logged: false },
];

type AccessEntry = { at: string; who: string; action: string; subject: string; session?: boolean };

const SEED_ACCESS: AccessEntry[] = [
  { at: "Aug 26 · 07:12", who: "People Ops · Funke Adebayo", action: "opened individual attendance view", subject: "W-3305" },
  { at: "Aug 26 · 07:14", who: "People Ops · Funke Adebayo", action: "exported aggregate absence rollup — no individual rows", subject: "Bonny Terminal" },
  { at: "Aug 25 · 16:40", who: "Field Operations · Ibrahim Sani", action: "opened individual attendance view (own crew)", subject: "E-0231" },
  { at: "Aug 24 · 09:05", who: "PrimeStaff Nigeria · employer portal", action: "opened individual attendance view (own deployed worker)", subject: "W-3301" },
];

const VIEWER = "People Ops · Samuel Omosehin";

const ENFORCEMENT: { title: string; body: string; icon: string; tone: PfTone }[] = [
  {
    title: "The model has no sanction vocabulary", icon: "robot", tone: "purple",
    body: "MC-07 emits three things: a rate, a pattern description and a load. It cannot output a warning, a query, a suspension or a recommendation, because none of those exist in its output space.",
  },
  {
    title: "The only path to a case is a named human", icon: "user", tone: "blue",
    body: "No rule, threshold or workflow on this page opens a disciplinary case. A person reads the signal, decides, and their name goes on the case at the moment it opens.",
  },
  {
    title: "Every individual read is written down", icon: "shield", tone: "green",
    body: "Opening a named worker's day-level view appends an access-log row — who, when, which worker. There is no silent read of this surface, for anyone, including HR.",
  },
];

const DPIA_QUESTIONS: { q: string; state: "answered" | "open" }[] = [
  { q: "Lawful basis for processing clock events for a purpose other than paying for them", state: "answered" },
  { q: "Proportionality of individual-level retention against the derived-signal purpose", state: "answered" },
  { q: "Whether a derived signal is a “decision with legal or similarly significant effect” under NDPA", state: "open" },
  { q: "Worker-facing transparency: what each person can see of their own signal, and how they contest it", state: "open" },
  { q: "Contracting-employer disclosure limits for agency workers", state: "open" },
];

const RETENTION: { what: string; rule: string }[] = [
  { what: "Raw clock events", rule: "24 months from ingestion, then destroyed" },
  { what: "Derived signals", rule: "Not stored as history — recomputed from events on every read, so a corrected event corrects the signal" },
  { what: "Access log", rule: "6 years, append-only, never editable by the people it records" },
  { what: "On exit", rule: "Individual rows purged with the worker record + 24 months; aggregates survive without a subject" },
];

const NEVER_INPUTS = [
  "Nationality", "Host community", "Worker type", "Contracting employer",
  "Medical fitness class", "Case or query history", "Gender", "Age", "Union membership",
];

/* ================================ components =============================== */

function RotationNote({ workerId }: { workerId: string }) {
  const a = ROTATION_ASSIGNMENTS.find((x) => x.workerId === workerId);
  if (!a) return null;
  const r = ROTATIONS.find((x) => x.id === a.rotationId);
  if (!r) return null;
  const on = onRotation(a);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n400)" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: on ? "var(--pf-primary-500)" : "var(--pf-n300)" }} />
      {r.name} · {on ? `on tour, ${daysUntilOff(a)}d to crew change` : "off tour"}
    </span>
  );
}

function DayStrip({ workerId }: { workerId: string }) {
  const strip = DAY_STRIP[workerId] ?? "";
  return (
    <div>
      <div style={{ display: "flex", gap: 3 }}>
        {strip.split("").map((c, i) => (
          <span
            key={i}
            title={`Day ${i + 1} of 20 — ${DAY_TONE[c]?.label ?? "Unknown"}`}
            style={{ flex: 1, height: 26, borderRadius: 3, background: DAY_TONE[c]?.bg ?? "var(--pf-n50)", minWidth: 6 }}
          />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        {Object.entries(DAY_TONE).map(([k, v]) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n500)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: v.bg }} />
            {v.label}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Oldest → today (26 Aug)</span>
      </div>
    </div>
  );
}

/* --------------------------------- routing --------------------------------- */

function FlowNode({ icon, tone, title, sub }: { icon: string; tone: PfTone; title: string; sub: string }) {
  return (
    <div style={{ flex: 1, minWidth: 150, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PfTile icon={icon} tone={tone} size={26} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.3 }}>{title}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}

function Arrow() {
  return (
    <span style={{ flex: "none", display: "inline-flex", alignItems: "center", color: "var(--pf-n300)" }}>
      <Ic name="arrowright" size={16} color="var(--pf-n300)" />
    </span>
  );
}

function RoutingMap({ onGo }: { onGo: (stage: string) => void }) {
  return (
    <PfCard>
      <PfCardHead
        title="Where a signal goes"
        sub="Clock events in, derived signals out — and one path that is deliberately not wired."
      >
        <PfBadge tone="grey">attendance_source v1</PfBadge>
      </PfCardHead>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 10, flexWrap: "wrap" }}>
          <FlowNode icon="clock" tone="grey" title="The site's own clock" sub="Biometric reader at Bonny, supervisor export at Bonga. We did not build it and do not run it." />
          <Arrow />
          <FlowNode icon="swap" tone="blue" title="attendance_source adapter" sub={`${LIVE?.provider ?? "CSV upload"} is live today. Two methods, three implementations.`} />
          <Arrow />
          <FlowNode icon="pulse" tone="purple" title="Derived signal · MC-07" sub="Absence rate, lateness pattern, overtime load. Nothing else is inferred." />
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{ flex: "none", width: 34, display: "flex", justifyContent: "center", alignItems: "center", color: "var(--pf-n300)" }}>
            <Ic name="caretdown" size={16} color="var(--pf-n300)" />
          </div>
          <button
            onClick={() => onGo("command")}
            style={{ flex: 1, minWidth: 200, textAlign: "left", fontFamily: "inherit", cursor: "pointer", background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", borderRadius: 10, padding: "11px 13px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Ic name="gauge" size={15} color="var(--pf-blue-500)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-blue-500)" }}>Anomaly feed · Command</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.5 }}>Elevated signals raise an anomaly card with a named owner. AN-101 came from this route.</div>
          </button>
          <button
            onClick={() => onGo("attrition")}
            style={{ flex: 1, minWidth: 200, textAlign: "left", fontFamily: "inherit", cursor: "pointer", background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "11px 13px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Ic name="pulse" size={15} color="var(--pf-purple-500)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>Attrition feature set · MC-02</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.5 }}>An aggregated absence feature, nothing more. No narrative and no dates cross over.</div>
          </button>
          <div style={{ flex: 1, minWidth: 200, background: "var(--pf-red-50)", border: "1px dashed var(--pf-red-100)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Ic name="x" size={15} color="var(--pf-red-500)" weight={2.2} />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-red-500)" }}>Disciplinary case — no automated path</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.5 }}>
              This edge does not exist in the product. A named human reads the signal and decides, or nothing happens.
            </div>
          </div>
        </div>
      </div>
    </PfCard>
  );
}

/* -------------------------------- why panel -------------------------------- */

function WhyPanel({ s, copy, onGo, onClose }: { s: AttendanceSignal; copy: SignalCopy; onGo: (stage: string) => void; onClose: () => void }) {
  const basis = [
    `Absence rate ${s.absenceRate}% across ${copy.window} — clock events only, denominator is scheduled tours.`,
    `Lateness: ${s.latenessPattern.toLowerCase()}, read against the site's 06:00 muster.`,
    `Overtime load ${s.overtimeLoad}, against a ${OT_REFERENCE}h/4-week site reference.`,
    `Source: ${LIVE?.provider ?? "CSV upload"} — ${copy.events} events, last drop 26 Aug · 06:10.`,
    copy.extra,
  ];
  return (
    <PfCard style={{ background: "var(--pf-n25)", marginTop: 11 }}>
      <PfCardHead
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ic name="question" size={16} color="var(--pf-n500)" />Why this signal?</span>}
        sub="The basis in full, and the five things this signal is not."
      >
        <PfBadge tone="purple">Confidence · {copy.confidence.split(" — ")[0]}</PfBadge>
        <PfBtn small variant="ghost" icon="x" onClick={onClose}>Close</PfBtn>
      </PfCardHead>
      <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>What this signal is, and what it was computed from</div>
          {basis.map((b, i) => (
            <div key={b} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", flex: "none", marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{b}</span>
            </div>
          ))}
          <div style={{ marginTop: 12, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 5 }}>Context a rate cannot carry</div>
            <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{copy.context}</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 9 }}>Confidence: {copy.confidence}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-red-100)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <Ic name="warning" size={15} color="var(--pf-red-500)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>What this signal is NOT</span>
            </div>
            {IS_NOT.map((n) => (
              <div key={n} style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <Ic name="x" size={13} color="var(--pf-red-500)" weight={2.2} />
                <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{n}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
              <Ic name="robot" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Model card {MC07.id} · {MC07.name}</span>
            </div>
            {[
              ["Purpose", MC07.purpose],
              ["Inputs", MC07.inputs],
              ["Human gate", MC07.humanGate],
              ["Surface", MC07.surface],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 10, padding: "4px 0" }}>
                <span style={{ flex: "none", width: 74, fontSize: 11.5, color: "var(--pf-n400)" }}>{k}</span>
                <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
              <PfBtn small variant="secondary" icon="robot" onClick={() => onGo("aisurfaces")}>{AS12.id} in the audit</PfBtn>
              <PfBtn small variant="secondary" icon="shield" onClick={() => onGo("trust")}>Trust center</PfBtn>
            </div>
          </div>
        </div>
      </div>
    </PfCard>
  );
}

/* -------------------------------- signal row -------------------------------- */

const SIG_COLS = "minmax(200px,1.4fr) 132px minmax(150px,1fr) minmax(146px,1fr) minmax(230px,1.5fr)";

function SignalRow({ s, whyOpen, indOpen, onWhy, onIndividual, onGo, onToast }: {
  s: AttendanceSignal;
  whyOpen: boolean; indOpen: boolean;
  onWhy: () => void; onIndividual: () => void;
  onGo: (stage: string) => void; onToast: (m: string, t?: "default" | "success" | "ai" | "danger") => void;
}) {
  const { hovered, hoverProps } = useHover();
  const p = personById(s.workerId);
  const w = workerById(s.workerId);
  const co = companyById(w?.contractingCompanyId);
  const copy = COPY[s.workerId];
  const t = TONE[s.tone];

  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }} {...hoverProps}>
      <div style={{ display: "grid", gridTemplateColumns: SIG_COLS, gap: 12, alignItems: "center", padding: "13px 20px" }}>
        {/* worker */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <PfAvatar init={p?.init ?? "—"} tone={p?.tone ?? "#475569"} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.name ?? s.workerId}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
              <span style={{ fontFamily: MONO }}>{s.workerId}</span>
              <span>·</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.loc ?? "—"}</span>
            </div>
          </div>
        </div>

        {/* absence rate */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{s.absenceRate}%</span>
            <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>of tours</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <PfProgress pct={(s.absenceRate / ABS_CEILING) * 100} tone={s.tone} height={6} />
          </div>
        </div>

        {/* lateness */}
        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.45 }}>{s.latenessPattern}</div>

        {/* overtime */}
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{s.overtimeLoad}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
            <PfSegments score={otHours(s) / 16} tone={otHours(s) > OT_REFERENCE ? "red" : "grey"} />
          </div>
        </div>

        {/* the note */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: t.bg, flex: "none" }} />
          <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{s.note}</span>
        </div>
      </div>

      {/* routing chips + affordances */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 20px 13px", flexWrap: "wrap" }}>
        <PfBadge tone="grey">{w ? WORKER_TYPE_LABEL[w.workerType] : "Worker"}</PfBadge>
        {co && <PfBadge tone="grey">{co.name}</PfBadge>}
        <RotationNote workerId={s.workerId} />
        <span style={{ flex: 1 }} />
        {copy?.routes.map((r) => (
          <button
            key={r.label}
            title={r.hint}
            onClick={() => (r.go ? onGo(r.go) : onToast(r.toast ?? r.hint))}
            style={{
              fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11.5, fontWeight: 500, color: TONE[r.tone].fg, background: TONE[r.tone].soft,
              border: `0.6px solid ${TONE[r.tone].line}`, borderRadius: 4, padding: "2px 7px", cursor: "pointer",
            }}
          >
            <Ic name="arrowright" size={11} color={TONE[r.tone].fg} />
            {r.label}
          </button>
        ))}
        <PfBtn small variant="secondary" icon="question" onClick={onWhy}>{whyOpen ? "Hide basis" : "Why this?"}</PfBtn>
        <PfBtn small variant="secondary" icon={indOpen ? "x" : "user"} onClick={onIndividual}>
          {indOpen ? "Close individual view" : "Individual view"}
        </PfBtn>
      </div>

      {/* individual, access-logged view */}
      {indOpen && (
        <div style={{ margin: "0 20px 14px", border: "1px solid var(--pf-yellow-100)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", background: "var(--pf-yellow-50)" }}>
            <Ic name="shield" size={15} color="var(--pf-yellow-500)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-yellow-500)" }}>
              Individual-level data · this open was logged against {VIEWER}
            </span>
            <span style={{ flex: 1 }} />
            <PfBadge tone="yellow">Permissioned · HR + line manager</PfBadge>
          </div>
          <div style={{ padding: "14px 16px", background: "var(--pf-n0)" }}>
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginBottom: 9 }}>
              Last 20 days for {p ? first(p.name) : s.workerId}, drawn against the rotation calendar — {copy?.window}.
            </div>
            <DayStrip workerId={s.workerId} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1, minWidth: 220 }}>
                Off-rotation days are excluded from the denominator. A 14/14 worker is not absent on their 14 days off.
              </span>
              <PfBtn small variant="secondary" icon="user" onClick={() => onGo("employee")}>Open person record</PfBtn>
              <PfBtn small variant="secondary" icon="orbit" onClick={() => onGo("sites")}>Rotation calendar</PfBtn>
            </div>
          </div>
        </div>
      )}

      {whyOpen && copy && (
        <div style={{ padding: "0 20px 16px" }}>
          <WhyPanel s={s} copy={copy} onGo={onGo} onClose={onWhy} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------- adapter card ------------------------------- */

function AdapterCard({ a, onAct }: { a: AdapterInfo; onAct: () => void }) {
  const { hovered, hoverProps } = useHover();
  const d = ADAPTER_DETAIL[a.provider];
  const live = a.state === "live";
  return (
    <div
      {...hoverProps}
      style={{
        background: "var(--pf-n0)", borderRadius: 12, padding: 14,
        border: `1px solid ${live ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
        boxShadow: hovered ? "0 2px 8px 0 #eeeeee" : "0 1px 3px 0 #f3f3f3",
        transition: "box-shadow .12s ease",
        display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfTile icon={d?.icon ?? "swap"} tone={ADAPTER_TONE[a.state]} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{a.provider}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", fontFamily: MONO }}>{a.contract} {a.version}</div>
        </div>
        <PfBadge tone={ADAPTER_TONE[a.state]} dot>{ADAPTER_LABEL[a.state]}</PfBadge>
      </div>
      <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{d?.how ?? a.note}</div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, paddingLeft: 10, borderLeft: "2px solid var(--pf-n50)" }}>{a.note}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: "auto", paddingTop: 4 }}>
        <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n300)" }}>{d?.cadence}</span>
        <PfBtn small variant={live ? "primary" : "secondary"} onClick={onAct}>{d?.cta ?? "Open"}</PfBtn>
      </div>
    </div>
  );
}

/* --------------------------------- screen ---------------------------------- */

const EV_COLS = "minmax(190px,1.2fr) 118px 96px 100px 128px minmax(150px,1fr)";

type Parsed = { events: AttendanceEvent[]; source: string; at: string };

const stamp = () => {
  const d = new Date();
  return `Aug 27 · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function Attendance() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("signals");
  const [filter, setFilter] = useState("All signals");
  const [why, setWhy] = useState<string | null>(null);
  const [individual, setIndividual] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessEntry[]>(SEED_ACCESS);

  const [csv, setCsv] = useState(ATTENDANCE_CSV_SAMPLE);
  const [dirty, setDirty] = useState(false);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const audit = auditScore();
  const shown = SIGNALS.filter((s) =>
    filter === "All signals" ? true : filter === "Elevated" ? s.tone !== "green" : s.tone === "green"
  );

  /* ---------------------------- ingest behaviour ---------------------------- */

  const runIngest = (text: string, source: string) => {
    const events = CSV_ATTENDANCE.ingest(text);
    if (!events.length || events.some((e) => !e.workerId || !e.date)) {
      toast("That drop did not parse — expected worker_id,date,clock_in,clock_out with a header line", "danger");
      return;
    }
    setParsed({ events, source, at: stamp() });
    setDirty(false);
    const absent = events.filter((e) => e.kind === "absent").length;
    const late = events.filter((e) => e.kind === "late").length;
    toast(`${events.length} clock events ingested via ${CSV_ATTENDANCE.provider} — ${late} late, ${absent} absent derived`, "success");
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
    runIngest(text, `${f.name} · uploaded`);
    e.target.value = "";
  };

  /* --------------------------- access-log behaviour -------------------------- */

  const toggleIndividual = (s: AttendanceSignal) => {
    if (individual === s.workerId) { setIndividual(null); return; }
    setIndividual(s.workerId);
    const p = personById(s.workerId);
    setAccess((prev) => [
      { at: stamp(), who: VIEWER, action: "opened individual attendance view", subject: s.workerId, session: true },
      ...prev,
    ]);
    toast(`Access logged — you opened ${p ? p.name : s.workerId}'s individual attendance view`, "default");
  };

  const sessionReads = access.filter((a) => a.session).length;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Attendance signals</span>
            <PfBadge tone="grey">FR-089</PfBadge>
            <PfBadge tone="purple" dot>{MC07.id}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, maxWidth: 780, lineHeight: 1.5 }}>
            We do not build time-and-attendance — we ingest its signals. No clock, no roster and no timesheet lives here.
            The clock is whatever the site already runs; this page holds only what its events imply.
          </div>
        </div>
        <PfBtn variant="secondary" icon="robot" onClick={() => go("aisurfaces")}>Audit · {audit.covered}/{audit.total}</PfBtn>
        <PfBtn variant="primary" icon="download" onClick={() => setTab("ingest")}>Ingest events</PfBtn>
      </div>

      {/* --------------------------------- KPIs --------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="pulse" tone="blue" label="Workers with a signal" value={SIGNALS.length} unit={`of ${ALL_WORKERS.length} on the roster`} delta="1 site pilot" deltaTone="blue" />
        <PfStat icon="warning" tone="yellow" label="Elevated" value={ELEVATED.length} unit={`of ${SIGNALS.length}`} delta="0 conduct findings" deltaTone="grey" />
        <PfStat icon="swap" tone="purple" label="Onward routes" value="2" unit="surfaces" delta="AN-101 overlap" deltaTone="yellow" />
        <PfStat icon="shield" tone="green" label="Automated sanctions" value="0" unit="ever" delta="P0 constraint" deltaTone="green" />
      </div>

      {/* -------------------------------- tabs ---------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "signals", label: "Derived signals", count: String(SIGNALS.length) },
            { key: "ingest", label: "Ingest events" },
            { key: "governance", label: "Governance" },
          ]}
        />
      </div>

      {/* ============================== SIGNALS =============================== */}
      {tab === "signals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfBanner
            tone="yellow"
            icon="info"
            cta="open"
            onCta={() => go("command")}
          >
            One story, two surfaces — Emeka Nwosu&apos;s sick-day cluster is the same event as anomaly AN-101 in the Command
            feed. The signal is the evidence; the anomaly is the alert. Neither of them is a finding.
          </PfBanner>

          <RoutingMap onGo={go} />

          <PfCard>
            <PfCardHead
              title="Derived signals"
              sub={`Absence, lateness and overtime per worker — computed from ${LIVE?.provider ?? "CSV upload"} events only.`}
            >
              <PfTabs tabs={["All signals", "Elevated", "Normal"]} active={filter} onChange={setFilter} />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: SIG_COLS, gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Worker</PfTh>
              <PfTh>Absence rate</PfTh>
              <PfTh>Lateness pattern</PfTh>
              <PfTh>Overtime load · ref {OT_REFERENCE}h</PfTh>
              <PfTh>What the signal says — and does not</PfTh>
            </div>

            {shown.map((s) => (
              <SignalRow
                key={s.workerId}
                s={s}
                whyOpen={why === s.workerId}
                indOpen={individual === s.workerId}
                onWhy={() => setWhy((v) => (v === s.workerId ? null : s.workerId))}
                onIndividual={() => toggleIndividual(s)}
                onGo={go}
                onToast={toast}
              />
            ))}

            {shown.length === 0 && (
              <div style={{ padding: "22px 20px", fontSize: 12.5, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                No signals in this band right now.
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", flexWrap: "wrap" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1, minWidth: 260 }}>
                Signals exist only where a clock feed is ingested — Bonny Terminal and the Bonga rotation today. A worker
                with no signal is not a compliant worker; they are an un-instrumented one.
              </span>
              <PfBtn small variant="secondary" icon="shield" onClick={() => setTab("governance")}>Who can read these rows</PfBtn>
            </div>
          </PfCard>
        </div>
      )}

      {/* =============================== INGEST =============================== */}
      {tab === "ingest" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfBanner tone="green" icon="swap">
            Adapter-first. Three implementations of one two-method contract — the live one needs no counterparty at all,
            and the surface above does not change when a vendor API switches on.
          </PfBanner>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            {ATT_ADAPTERS.map((a) => (
              <AdapterCard
                key={a.provider}
                a={a}
                onAct={() =>
                  a.state === "live"
                    ? toast(`${a.provider} is live — paste or upload a drop below and run the adapter`, "success")
                    : a.state === "ready"
                      ? toast(`${a.provider}: export window request drafted for the Bonny Terminal device owner`)
                      : toast(`${a.provider}: tracked as an external dependency — the contract is already implemented on our side`)
                }
              />
            ))}
          </div>

          {/* reference CSV + paste/upload */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="The reference drop" sub="Exactly what the day-one adapter accepts. Four columns, one header line.">
                <PfBtn small variant="secondary" icon="file" onClick={() => { setCsv(ATTENDANCE_CSV_SAMPLE); setDirty(true); toast("Reference CSV loaded into the paste box"); }}>Load</PfBtn>
              </PfCardHead>
              <div style={{ padding: "14px 20px" }}>
                <pre style={{ margin: 0, fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", overflowX: "auto" }}>
{ATTENDANCE_CSV_SAMPLE}
                </pre>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 10, lineHeight: 1.55 }}>
                  A blank <span style={{ fontFamily: MONO, color: "var(--pf-n600)" }}>clock_in</span> is a fact, not a
                  missing value — most Nigerian site clocks end in a spreadsheet, and that spreadsheet is a supported
                  product surface rather than a stopgap.
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Run the adapter" sub="Paste a drop or upload a .csv — this calls CSV_ATTENDANCE.ingest() for real.">
                <PfBadge tone="green" dot>Live</PfBadge>
              </PfCardHead>
              <div style={{ padding: "14px 20px" }}>
                <textarea
                  value={csv}
                  onChange={(e) => { setCsv(e.target.value); setDirty(true); }}
                  spellCheck={false}
                  rows={7}
                  style={{
                    width: "100%", boxSizing: "border-box", resize: "vertical",
                    fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--pf-n900)",
                    background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 10,
                    padding: "11px 13px", outline: "none",
                  }}
                />
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="play" onClick={() => runIngest(csv, dirty ? "Pasted drop" : "Reference drop")}>Run adapter</PfBtn>
                  <PfBtn variant="secondary" icon="download" onClick={() => fileRef.current?.click()}>Upload .csv</PfBtn>
                  <PfBtn variant="secondary" icon="stack" onClick={() => { setCsv(BIGGER_DROP); setDirty(true); toast("A 10-event drop loaded — run the adapter to see late and absent derived"); }}>Bigger drop</PfBtn>
                  <span style={{ flex: 1 }} />
                  {dirty && <PfBadge tone="yellow">Edited — re-run to refresh</PfBadge>}
                </div>
              </div>
            </PfCard>
          </div>

          {/* parsed events */}
          <PfCard>
            <PfCardHead
              title="Parsed events"
              sub={parsed ? `${parsed.events.length} AttendanceEvents from “${parsed.source}” · ingested ${parsed.at}` : "Nothing ingested yet — run the adapter above."}
            >
              {parsed && (
                <div style={{ display: "flex", gap: 6 }}>
                  {(["present", "late", "absent"] as const).map((k) => (
                    <PfBadge key={k} tone={KIND_TONE[k]}>{parsed.events.filter((e) => e.kind === k).length} {k}</PfBadge>
                  ))}
                </div>
              )}
            </PfCardHead>

            {parsed ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: EV_COLS, gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
                  <PfTh>Worker</PfTh>
                  <PfTh>Date</PfTh>
                  <PfTh>Clock in</PfTh>
                  <PfTh>Clock out</PfTh>
                  <PfTh>Derived</PfTh>
                  <PfTh>Read against</PfTh>
                </div>
                {parsed.events.map((e, i) => {
                  const p = personById(e.workerId);
                  const a = ROTATION_ASSIGNMENTS.find((x) => x.workerId === e.workerId);
                  const r = ROTATIONS.find((x) => x.id === a?.rotationId);
                  return (
                    <div key={`${e.workerId}-${e.date}-${i}`} style={{ display: "grid", gridTemplateColumns: EV_COLS, gap: 12, alignItems: "center", padding: "10px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <PfAvatar init={p?.init ?? "??"} tone={p?.tone ?? "#475569"} size={24} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p?.name ?? "Unknown worker"}</span>
                          <span style={{ fontSize: 11, color: "var(--pf-n400)", fontFamily: MONO }}>{e.workerId}</span>
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", fontFamily: MONO }}>{e.date}</div>
                      <div style={{ fontSize: 12.5, color: e.clockIn ? "var(--pf-n600)" : "var(--pf-n300)", fontFamily: MONO }}>{e.clockIn ?? "—"}</div>
                      <div style={{ fontSize: 12.5, color: e.clockOut ? "var(--pf-n600)" : "var(--pf-n300)", fontFamily: MONO }}>{e.clockOut ?? "—"}</div>
                      <div><PfBadge tone={KIND_TONE[e.kind]} dot>{e.kind}</PfBadge></div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{r ? r.name : "No rotation on file"}</div>
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", flexWrap: "wrap" }}>
                  <Ic name="shield" size={14} color="var(--pf-n300)" />
                  <span style={{ flex: 1, minWidth: 260, fontSize: 12, color: "var(--pf-n400)" }}>
                    These events become rates. They do not become pay, a roster change or a case — nothing downstream of
                    this table writes to another system.
                  </span>
                  <PfBtn small variant="secondary" icon="pulse" onClick={() => { setTab("signals"); toast("Derived signals recomputed from the ingested events"); }}>See the derived signals</PfBtn>
                </div>
              </>
            ) : (
              <div style={{ padding: "26px 20px", textAlign: "center" }}>
                <PfTile icon="download" tone="grey" size={38} />
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>No drop ingested in this session</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>Paste a CSV above and run the adapter.</div>
              </div>
            )}
          </PfCard>

          {/* derivation rules + contract */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead title="How a kind is derived" sub="Four rules, written out. There is no model in the ingest path." />
              <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,0.9fr) 110px minmax(220px,1.5fr)", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
                <PfTh>Rule</PfTh>
                <PfTh>Derived kind</PfTh>
                <PfTh>Why it is written this way</PfTh>
              </div>
              {DERIVATION.map((d) => (
                <div key={d.rule} style={{ display: "grid", gridTemplateColumns: "minmax(150px,0.9fr) 110px minmax(220px,1.5fr)", gap: 12, alignItems: "center", padding: "11px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n900)", fontWeight: 500, fontFamily: MONO }}>{d.rule}</div>
                  <div>{d.kind === "—" ? <PfBadge tone="grey">not tagged</PfBadge> : <PfBadge tone={KIND_TONE[d.kind]} dot>{d.kind}</PfBadge>}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{d.note}</div>
                </div>
              ))}
            </PfCard>

            <PfCard>
              <PfCardHead title="The whole contract" sub="Two methods. A vendor API implements the same two." />
              <div style={{ padding: "14px 20px" }}>
                <pre style={{ margin: 0, fontFamily: MONO, fontSize: 12, lineHeight: 1.7, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", overflowX: "auto" }}>
{CONTRACT_SRC}
                </pre>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 11 }}>
                  <PfBadge tone="green" dot>{LIVE?.provider ?? "CSV upload"} bound today</PfBadge>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 10, lineHeight: 1.55 }}>
                  &ldquo;Awaiting API access&rdquo; is the honest state of a partner dependency, not a hole in the product.
                  The feature already ships against the CSV implementation.
                </div>
              </div>
            </PfCard>
          </div>
        </div>
      )}

      {/* ============================= GOVERNANCE ============================= */}
      {tab === "governance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* the P0 constraint */}
          <PfCard style={{ borderColor: "var(--pf-red-100)", overflow: "hidden" }}>
            <div style={{ display: "flex" }}>
              <span style={{ width: 4, background: "var(--pf-red-500)", flex: "none" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <PfTile icon="shield" tone="red" size={30} />
                    <span style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)" }}>Attendance signals never trigger automated discipline</span>
                    <PfBadge tone="red">P0 constraint</PfBadge>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55, maxWidth: 820 }}>
                    This is the constraint the whole surface is built around, not a caveat added underneath it. The
                    platform holds the most sensitive operational data an employer keeps about a person, and it holds it
                    without ever converting a rate into a consequence.
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, padding: "14px 20px" }}>
                  {ENFORCEMENT.map((e) => (
                    <div key={e.title} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 13px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <PfTile icon={e.icon} tone={e.tone} size={26} />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.3 }}>{e.title}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{e.body}</div>
                    </div>
                  ))}
                </div>
                {/* the worked example */}
                <div style={{ margin: "0 20px 16px", border: "1px solid var(--pf-n50)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
                    <PfAvatar init={ATT_CASE.init} tone={ATT_CASE.tone} size={26} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{ATT_CASE.id} · {ATT_CASE.subject} · {ATT_CASE.category}</span>
                    <PfBadge tone="grey">{ATT_CASE.stage}</PfBadge>
                    <span style={{ flex: 1 }} />
                    <PfBtn small variant="secondary" icon="clipboard" onClick={() => go("cases")}>Open the case</PfBtn>
                  </div>
                  <div style={{ padding: "13px 14px", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                    Musa Bello&apos;s signal has been on this page since the {LIVE?.provider ?? "CSV upload"} feed started.
                    The case opened on {ATT_CASE.opened} — because <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{ATT_CASE.accessLog[0].who}</span> read
                    the signal and decided to. The first row of that case&apos;s own audit strip is{" "}
                    <span style={{ fontFamily: MONO, color: "var(--pf-n500)" }}>{ATT_CASE.accessLog[0].at} · {ATT_CASE.accessLog[0].action}</span>. A
                    person&apos;s name is on the decision, at the moment of the decision. No signal, threshold or workflow
                    can produce that row.
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* RBAC */}
          <PfCard>
            <PfCardHead title="Who can read an individual row" sub="Role- and scope-level permissions (FR-077). Aggregate is the default; named rows are the exception.">
              <PfBadge tone="grey">{RBAC.filter((r) => r.individual !== "No").length} of {RBAC.length} roles see names</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(190px,1fr) 120px minmax(240px,1.6fr) 130px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Role</PfTh>
              <PfTh>Individual rows</PfTh>
              <PfTh>Scope</PfTh>
              <PfTh>Access logged</PfTh>
            </div>
            {RBAC.map((r) => (
              <div key={r.role} style={{ display: "grid", gridTemplateColumns: "minmax(190px,1fr) 120px minmax(240px,1.6fr) 130px", gap: 12, alignItems: "center", padding: "11px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{r.role}</div>
                <div>
                  <PfBadge tone={r.individual === "No" ? "grey" : r.individual === "Yes" ? "yellow" : "blue"}>{r.individual}</PfBadge>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{r.scope}</div>
                <div>
                  {r.logged
                    ? <PfBadge tone="green" dot>Every open</PfBadge>
                    : <PfBadge tone="grey">n/a — no named data</PfBadge>}
                </div>
              </div>
            ))}
          </PfCard>

          {/* access log */}
          <PfCard>
            <PfCardHead
              title="Access log"
              sub="Append-only. Every open of an individual attendance view writes a row — including yours."
            >
              {sessionReads > 0 && <PfBadge tone="yellow">{sessionReads} this session</PfBadge>}
              <PfBtn small variant="secondary" icon="user" onClick={() => { setTab("signals"); toast("Open any worker's individual view — the read is logged against you"); }}>Try it</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "140px minmax(200px,1.1fr) minmax(240px,1.6fr) 110px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>When</PfTh>
              <PfTh>Who</PfTh>
              <PfTh>Action</PfTh>
              <PfTh>Subject</PfTh>
            </div>
            {access.slice(0, 10).map((a, i) => {
              const p = personById(a.subject);
              return (
                <div key={`${a.at}-${a.subject}-${i}`} style={{ display: "grid", gridTemplateColumns: "140px minmax(200px,1.1fr) minmax(240px,1.6fr) 110px", gap: 12, alignItems: "center", padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", background: a.session ? "var(--pf-yellow-50)" : "transparent" }}>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", fontFamily: MONO }}>{a.at}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.who}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{a.action}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n600)", fontFamily: MONO }} title={p?.name}>{a.subject}</div>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", flexWrap: "wrap" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1, minWidth: 240 }}>
                The log is not editable by the people it records, and it outlives the data it describes — 6 years,
                append-only. Aggregate reads are not logged because they identify nobody.
              </span>
              <PfBtn small variant="secondary" icon="shield" onClick={() => go("trust")}>Audit-log coverage report</PfBtn>
            </div>
          </PfCard>

          {/* DPIA + retention + never-inputs */}
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead
                title="DPIA gate"
                sub="A data-protection impact assessment gates GA on real employee data — this is a blocker, honestly stated."
              >
                <PfBadge tone="yellow" dot>In progress</PfBadge>
              </PfCardHead>
              <div style={{ padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "11px 13px" }}>
                  <Ic name="warning" size={16} color="var(--pf-yellow-500)" />
                  <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                    Today this page reads <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>demo data and one consented pilot</span> —
                    Bonny Terminal, consent taken July 2026, workers told exactly what is derived. No production employee
                    data flows here until the DPIA is signed.
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 10, lineHeight: 1.55 }}>
                  Trust center posture · {DPIA_ROW.area}: {DPIA_ROW.answer}
                </div>
              </div>
              {DPIA_QUESTIONS.map((q) => (
                <div key={q.q} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <span style={{ marginTop: 1, flex: "none" }}>
                    {q.state === "answered"
                      ? <span style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Ic name="check" size={10} color="#fff" weight={2.4} /></span>
                      : <span style={{ width: 17, height: 17, borderRadius: "50%", border: "1.6px solid var(--pf-yellow-500)", display: "inline-block" }} />}
                  </span>
                  <span style={{ flex: 1, fontSize: 12.5, color: q.state === "answered" ? "var(--pf-n500)" : "var(--pf-n900)", lineHeight: 1.5 }}>{q.q}</span>
                  <PfBadge tone={q.state === "answered" ? "green" : "yellow"}>{q.state === "answered" ? "Answered" : "Open"}</PfBadge>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n400)" }}>{DPIA_QUESTIONS.filter((q) => q.state === "open").length} questions open · GA blocked until all are closed</span>
                <PfBtn small variant="secondary" icon="file" onClick={() => toast("DPIA pack requested for FR-089 — routed to the Data Protection Officer", "success")}>Request the pack</PfBtn>
              </div>
            </PfCard>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              <PfCard>
                <PfCardHead title="Retention" sub="What is kept, for how long, and what is deliberately not kept at all." />
                {RETENTION.map((r, i) => (
                  <div key={r.what} style={{ display: "flex", gap: 12, padding: "11px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <span style={{ flex: "none", width: 120, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.what}</span>
                    <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{r.rule}</span>
                  </div>
                ))}
              </PfCard>

              <PfCard>
                <PfCardHead title={`What never enters ${MC07.id}`} sub={`Declared inputs: ${MC07.inputs}. Everything below is a reporting field.`} />
                <div style={{ padding: "13px 20px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {NEVER_INPUTS.map((n) => (
                      <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 4, padding: "3px 7px" }}>
                        <Ic name="x" size={11} color="var(--pf-red-500)" weight={2.2} />
                        {n}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 11, lineHeight: 1.55 }}>
                    Nationality and host community exist on the workforce spine for NCDMB local-content returns. They are
                    reporting fields, and reporting fields are never model inputs — the same rule the platform applies to
                    every protected attribute.
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
                    <PfBtn small variant="secondary" icon="treemap" onClick={() => go("workforce")}>Workforce spine</PfBtn>
                    <PfBtn small variant="secondary" icon="robot" onClick={() => go("aisurfaces")}>{AS12.id} · {AS12.where}</PfBtn>
                  </div>
                </div>
              </PfCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
