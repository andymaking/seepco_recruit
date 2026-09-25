"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  CONFIRMATION_CASES, LETTER_TEMPLATES,
  type ConfirmationCase, type ConfirmationDecision,
} from "@/data/hrops";
import {
  personById, workerById, isSchedulable,
  WORKER_TYPE_LABEL, WORKER_LIFECYCLE,
} from "@/data/workforce";
import { activeAdapter } from "@/data/adapters";
import { MODEL_CARDS, type WhyThis } from "@/data/trust";
import { DEPARTMENTS, EMPLOYEES } from "@/data/talentos";

/**
 * Probation & confirmation — PRD v2.1 FR-087.
 *
 * The clock starts at Stage 10 (offer accepted / onboarding), runs 3 or 6 months
 * by grade, and ends in exactly one of three recorded decisions. The release
 * doctrine holds throughout:
 *   · READS, NOT ENGINES — nothing here accrues anything. The pack is compiled
 *     from records that already exist; the decision is typed by a human.
 *   · The AI compiles and cites. It does NOT propose confirm, extend or exit —
 *     the same red line that keeps it off sanctions in FR-088.
 *   · The decision generates its letter through FR-086 rather than sending
 *     someone back to a template, and writes an effective date onto the record.
 */

/* --------------------------------- helpers -------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const TODAY = "Aug 27, 2026";
/** Policy: the manager is prompted 21 days AHEAD of term, never on the day. */
const PROMPT_LEAD = 21;
const HORIZON = 90;

const MC05 = MODEL_CARDS.find((m) => m.id === "MC-05")!;
const CONFIRM_LETTER = LETTER_TEMPLATES.find((t) => t.kind === "Probation confirmation")!;
const VERIFY_ADAPTER = activeAdapter("letter_verify");

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;

const first = (name: string) => name.split(" ")[0];

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);

const toIso = (human: string) => {
  const d = new Date(human);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
};

const addMonthsIso = (human: string, n: number) => {
  const d = new Date(human);
  d.setMonth(d.getMonth() + n);
  return toIso(`${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`);
};

const clockTone = (days: number): PfTone => (days <= 7 ? "red" : days <= 30 ? "yellow" : "grey");
const clockWord = (days: number) => (days <= 7 ? "Critical" : days <= 30 ? "Urgent" : "Scheduled");

/** The line manager is the head of the person's department — not a second list. */
const managerFor = (c: ConfirmationCase) => {
  const p = personById(c.workerId);
  return DEPARTMENTS.find((d) => d.name === p?.dept)?.head ?? "Funke Adebayo";
};

const gradeOf = (id: string) => EMPLOYEES.find((e) => e.id === id)?.grade;

type Band = "L1 – L4" | "L5 – L6" | "M1 and above" | "NYSC / Intern" | "Contract / agency";

const bandOf = (c: ConfirmationCase): Band => {
  const w = workerById(c.workerId);
  if (w?.workerType === "nysc") return "NYSC / Intern";
  if (w?.workerType === "contractor" || w?.workerType === "agency") return "Contract / agency";
  const g = gradeOf(c.workerId) ?? "L1";
  if (/^M/.test(g)) return "M1 and above";
  return Number(g.replace(/\D/g, "")) >= 5 ? "L5 – L6" : "L1 – L4";
};

const CONFIGURABLE: Band[] = ["L1 – L4", "L5 – L6", "M1 and above"];

const DEFAULT_POLICY: Record<string, 3 | 6> = { "L1 – L4": 3, "L5 – L6": 6, "M1 and above": 6 };

/* ------------------------------ the pack ---------------------------------- */

type ItemState = "present" | "pending" | "excluded";

type PackItem = {
  key: string; label: string; icon: string; tone: PfTone;
  value: string; source: string; stage: string; state: ItemState;
};

/**
 * Where each line CAME FROM is half the artifact. A confirmation pack that a
 * manager typed the night before is not evidence, it is a memory test.
 */
const packOf = (c: ConfirmationCase): PackItem[] => {
  const raw = c.evidence.qoh;
  const w = workerById(c.workerId);
  let qohValue: string;
  let qohState: ItemState;
  if (raw && !/pending/i.test(raw)) {
    qohValue = raw; qohState = "present";
  } else if (raw) {
    qohValue = raw; qohState = "pending";
  } else if (w && !w.analytics.qoh) {
    qohValue = `Not scored — ${WORKER_TYPE_LABEL[w.workerType]} records are held out of quality-of-hire by the FR-082 worker-type flags. A service year is not a hire, so it never enters the benchmark.`;
    qohState = "excluded";
  } else {
    qohValue = "Day-90 score pending — no quality-of-hire read is released before the 90-day milestone.";
    qohState = "pending";
  }
  return [
    {
      key: "plan", label: "30 / 60 / 90-day plan", icon: "clipboard", tone: "blue",
      value: c.evidence.plan30_60_90,
      source: "Onboarding hub · the plan agreed at Stage 10, ticked as it ran",
      stage: "onboardhub", state: "present",
    },
    {
      key: "qoh", label: "Quality of hire", icon: "star", tone: "yellow",
      value: qohValue,
      source: "Post-hire quality-of-hire · the day-90 read",
      stage: "qoh", state: qohState,
    },
    {
      key: "notes", label: "1-on-1 notes", icon: "chat", tone: "purple",
      value: c.evidence.managerNotes,
      source: "Manager 1-on-1 record — the manager's own words, carried across, not re-summarised",
      stage: "oneonones", state: "present",
    },
    {
      key: "goals", label: "Goals", icon: "target", tone: "green",
      value: c.evidence.goals,
      source: "Goals & OKRs · objectives set inside the probation window",
      stage: "goals", state: "present",
    },
  ];
};

const ITEM_TONE: Record<ItemState, PfTone> = { present: "green", pending: "yellow", excluded: "grey" };
const ITEM_WORD: Record<ItemState, string> = { present: "Compiled", pending: "Pending — reason given", excluded: "Excluded — reason given" };

const packSummary = (c: ConfirmationCase) => {
  const items = packOf(c);
  const n = items.filter((i) => i.state === "present").length;
  const gaps = items.filter((i) => i.state !== "present");
  const p = personById(c.workerId);
  return `${first(p?.name ?? c.subject)}'s pack is compiled from ${n} of ${items.length} sources, each carrying its origin. ${
    gaps.length
      ? `${gaps.length === 1 ? "One source is" : `${gaps.length} sources are`} named as ${gaps.map((g) => g.label.toLowerCase()).join(" and ")} rather than left blank — a gap you can see is evidence too.`
      : "No gaps."
  } Term falls in ${c.daysToEnd} days. Nothing in this pack was typed for the review.`;
};

const whyFor = (c: ConfirmationCase): WhyThis => ({
  claim: `Nothing here is predicted. The pack is a retrieval over four records that already existed on ${first(personById(c.workerId)?.name ?? c.subject)}'s file, each line shown with the surface it came from.`,
  basis: packOf(c).map((i) => `${i.label} — ${i.value} · ${i.source}`),
  modelCard: MC05.id,
  humanGate: MC05.humanGate,
});

/* ------------------------------ the ledger -------------------------------- */

type Ledger = {
  key: string; subject: string; init: string; tone: string; role: string;
  decision: ConfirmationDecision; decidedOn: string; effective: string;
  months: number; reasons?: string; letter: string;
  letterState: "Issued" | "In the queue"; note: string;
};

/**
 * The closed record. Every one of these people is `Confirmed` on the worker
 * spine today — this is where each of them crossed over, and the letter that
 * carried it. Codes are absent on purpose: they predate `letter_verify` v1.
 */
const HISTORY: Ledger[] = [
  {
    key: "H-04", subject: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Finance Analyst",
    decision: "confirm", decidedOn: "Oct 28, 2024", effective: "Nov 4, 2024", months: 3,
    letter: "LT-078", letterState: "Issued",
    note: "Pack complete on all four sources · QoH 4.4 at day 90.",
  },
  {
    key: "H-03", subject: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer",
    decision: "confirm", decidedOn: "Apr 29, 2024", effective: "May 6, 2024", months: 6,
    letter: "LT-061", letterState: "Issued",
    note: "Pack complete · QoH 4.6, the strongest day-90 read on the spine.",
  },
  {
    key: "H-02", subject: "Halima Sule", init: "HS", tone: "#AF52DE", role: "HSE Coordinator",
    decision: "confirm", decidedOn: "Sep 5, 2023", effective: "Sep 12, 2023", months: 3,
    letter: "LT-039", letterState: "Issued",
    note: "Pack complete · confirmed with the NEBOSH renewal booked as a condition.",
  },
  {
    key: "H-01", subject: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead",
    decision: "confirm", decidedOn: "Jan 2, 2023", effective: "Jan 9, 2023", months: 6,
    letter: "LT-024", letterState: "Issued",
    note: "Pack complete · 14/14 rotation meant the review ran on a tour week.",
  },
];

const DECISION_LABEL: Record<ConfirmationDecision, string> = {
  confirm: "Confirm", extend: "Extend", exit: "Exit",
};
const DECISION_TONE: Record<ConfirmationDecision, PfTone> = {
  confirm: "green", extend: "yellow", exit: "red",
};
const DECISION_ICON: Record<ConfirmationDecision, string> = {
  confirm: "check", extend: "clock", exit: "door",
};
const DECISION_BLURB: Record<ConfirmationDecision, string> = {
  confirm: "Probation closes at term. The record takes an effective date and the letter follows.",
  extend: "The clock is re-cut to a new end date. Both the date and the reasons are required — an extension you cannot explain is not an extension.",
  exit: "Employment ends at term under the probation notice in the contract. Reasons are required and go on the file.",
};

/* --------------------------------- bits ----------------------------------- */

const fieldStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 10px", outline: "none", width: "100%",
};

function HoverRow({ onClick, children, style }: { onClick?: () => void; children: ReactNode; style?: CSSProperties }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ ...style, background: hovered ? "var(--pf-n25)" : "transparent", cursor: onClick ? "pointer" : "default" }}
    >
      {children}
    </div>
  );
}

function Req({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 500, color: ok ? "var(--pf-primary-600)" : "var(--pf-n400)" }}>
      <span style={{ width: 15, height: 15, borderRadius: "50%", flex: "none", background: ok ? "var(--pf-primary-500)" : "var(--pf-n50)", border: ok ? "none" : "1px solid var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {ok && <Ic name="check" size={10} color="#fff" weight={2.6} />}
      </span>
      {children}
    </div>
  );
}

/** 90-day runway: today on the left, term markers where they actually fall. */
function Runway({ rows, onPick }: { rows: { c: ConfirmationCase; days: number }[]; onPick: (id: string) => void }) {
  const pos = (d: number) => Math.min(93, Math.max(4, (d / HORIZON) * 100));
  return (
    <div style={{ padding: "18px 20px 12px" }}>
      <div style={{ position: "relative", height: 108 }}>
        {/* zones */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 72, height: 12, borderRadius: 6, overflow: "hidden", display: "flex", background: "var(--pf-n25)" }}>
          <div style={{ width: `${(7 / HORIZON) * 100}%`, background: "var(--pf-red-100)" }} />
          <div style={{ width: `${(23 / HORIZON) * 100}%`, background: "var(--pf-yellow-100)" }} />
          <div style={{ flex: 1, background: "var(--pf-n50)" }} />
        </div>
        {/* gridlines */}
        {[7, 30, 60, 90].map((g) => (
          <div key={g} style={{ position: "absolute", left: `${(g / HORIZON) * 100}%`, top: 64, bottom: 0, width: 1, background: "var(--pf-n100)" }}>
            <span style={{ position: "absolute", top: 30, left: -12, fontFamily: MONO, fontSize: 10, color: "var(--pf-n300)" }}>{g}d</span>
          </div>
        ))}
        <div style={{ position: "absolute", left: 0, top: 64, bottom: 0, width: 2, background: "var(--pf-n900)" }}>
          <span style={{ position: "absolute", top: 30, left: 0, fontSize: 10, fontWeight: 600, color: "var(--pf-n900)" }}>Today</span>
        </div>
        {/* markers */}
        {rows.map((r, i) => {
          const p = personById(r.c.workerId);
          const tone = clockTone(r.days);
          return (
            <button
              key={r.c.id}
              onClick={() => onPick(r.c.id)}
              style={{
                position: "absolute", left: `${pos(r.days)}%`, top: i % 2 === 0 ? 0 : 34,
                transform: "translateX(-50%)", fontFamily: "inherit", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                background: "var(--pf-n0)", border: `1px solid ${TONE[tone].line}`, borderRadius: 999,
                padding: "3px 9px 3px 4px", boxShadow: "0 1px 3px 0 #f3f3f3",
              }}
            >
              <PfAvatar init={r.c.init} tone={r.c.tone} size={18} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{first(p?.name ?? r.c.subject)}</span>
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: TONE[tone].fg }}>{r.days}d</span>
            </button>
          );
        })}
        {rows.map((r, i) => (
          <div
            key={`s-${r.c.id}`}
            style={{
              position: "absolute", left: `${pos(r.days)}%`, top: i % 2 === 0 ? 24 : 58,
              width: 1, height: i % 2 === 0 ? 48 : 14, background: "var(--pf-n100)",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 22 }}>
        {([["red", "Inside 7 days — critical"], ["yellow", "Inside 30 days — urgent"], ["grey", "Beyond 30 days — scheduled"]] as [PfTone, string][]).map(([t, l]) => (
          <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--pf-n500)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: TONE[t].line }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ================================ screen ================================== */

export default function Confirmations() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("due");
  const [sel, setSel] = useState(CONFIRMATION_CASES[2]?.id ?? "CF-27");
  const [open, setOpen] = useState<string | null>("CF-27");
  const [prompted, setPrompted] = useState<Record<string, string>>({});
  const [recorded, setRecorded] = useState<Record<string, Ledger>>({});
  const [path, setPath] = useState<ConfirmationDecision | null>(null);
  const [newDate, setNewDate] = useState("");
  const [reasons, setReasons] = useState("");
  const [why, setWhy] = useState(false);
  const [policy, setPolicy] = useState<Record<string, 3 | 6>>(DEFAULT_POLICY);

  /* ------------------------------- derived ------------------------------- */

  const cases = [...CONFIRMATION_CASES].sort((a, b) => a.daysToEnd - b.daysToEnd);
  const live = cases.filter((c) => !recorded[c.id]);
  const critical = live.filter((c) => c.daysToEnd <= 7).length;
  const soonest = live[0];

  const allItems = cases.flatMap((c) => packOf(c));
  const compiled = allItems.filter((i) => i.state === "present").length;

  const ledger: Ledger[] = [
    ...cases.map((c) => recorded[c.id]).filter(Boolean),
    ...HISTORY,
  ];
  const sessionRows = ledger.filter((l) => l.letterState === "In the queue");

  const cur = cases.find((c) => c.id === sel) ?? cases[0];
  const curPerson = personById(cur.workerId);
  const curWorker = workerById(cur.workerId);
  const curPack = packOf(cur);
  const curWhy = whyFor(cur);
  const curManager = managerFor(cur);
  const curDecided = recorded[cur.id];
  const sched = isSchedulable(cur.workerId);
  const totalDays = Math.max(1, daysBetween(cur.startedAt, cur.endsAt));
  const elapsed = Math.max(0, totalDays - cur.daysToEnd);

  const promptDue = (c: ConfirmationCase) => c.daysToEnd - PROMPT_LEAD;

  const transition = (c: ConfirmationCase, p: ConfirmationDecision) => {
    const w = workerById(c.workerId);
    const type = w?.workerType ?? "employee";
    const lc = WORKER_LIFECYCLE[type];
    const state = w?.state ?? "Probation";
    const idx = lc.indexOf(state);
    if (p === "confirm") return `${state} → ${idx >= 0 && lc[idx + 1] ? lc[idx + 1] : "Confirmed"}`;
    if (p === "extend") return `${state} → ${state} · clock re-cut`;
    return type === "nysc" ? `${state} → service year closed early` : `${state} → Exited`;
  };

  const needsReasons = path === "extend" || path === "exit";
  const hasDate = path !== "extend" || !!newDate;
  const hasReasons = !needsReasons || reasons.trim().length > 0;
  const ready = !!path && hasDate && hasReasons;

  /* -------------------------------- actions ------------------------------ */

  const pick = (id: string) => {
    setSel(id);
    setPath(null);
    setNewDate("");
    setReasons("");
    setWhy(false);
  };

  const openPack = (id: string) => {
    pick(id);
    setTab("evidence");
  };

  const sendPrompt = (c: ConfirmationCase) => {
    const mgr = managerFor(c);
    setPrompted((p) => ({ ...p, [c.id]: `Prompted today · ${TODAY}` }));
    toast(`${first(mgr)} prompted on ${c.subject} — term ${c.endsAt}, ${c.daysToEnd} days. The pack went with it.`, "success");
  };

  const record = () => {
    if (!path) { toast("Pick confirm, extend or exit first — the record has to say which", "danger"); return; }
    if (path === "extend" && !newDate) { toast(`An extension needs a NEW end date for ${cur.subject} — it is the whole substance of the decision`, "danger"); return; }
    if (needsReasons && !reasons.trim()) {
      toast(`${DECISION_LABEL[path]} needs its reasons in writing — they go on ${first(cur.subject)}'s file and into the letter`, "danger");
      return;
    }
    const letter = `LT-${123 + sessionRows.length}`;
    const row: Ledger = {
      key: cur.id, subject: cur.subject, init: cur.init, tone: cur.tone, role: cur.role,
      decision: path, decidedOn: TODAY, effective: cur.endsAt, months: cur.months,
      reasons: reasons.trim() || undefined, letter, letterState: "In the queue",
      note: path === "extend"
        ? `Clock re-cut to ${fromIso(newDate)} — ${daysBetween(cur.endsAt, fromIso(newDate))} days beyond the original term.`
        : `Recorded against the compiled pack — ${curPack.filter((i) => i.state === "present").length} of ${curPack.length} sources.`,
    };
    setRecorded((r) => ({ ...r, [cur.id]: row }));
    toast(
      path === "extend"
        ? `${cur.subject} extended to ${fromIso(newDate)} — effective ${cur.endsAt}. Letter ${letter} drafting via FR-086 (${CONFIRM_LETTER.slaHours}h clock).`
        : `${cur.subject} ${path === "confirm" ? "confirmed" : "exiting"} — effective ${cur.endsAt}. Letter ${letter} drafting via FR-086 (${CONFIRM_LETTER.slaHours}h clock).`,
      path === "exit" ? "danger" : "success",
    );
  };

  const undo = () => {
    setRecorded((r) => {
      const next = { ...r };
      delete next[cur.id];
      return next;
    });
    setPath(null); setNewDate(""); setReasons("");
    toast(`${cur.id} reopened — this session only. A recorded decision is append-only on the real file.`);
  };

  const setBand = (band: Band, months: 3 | 6) => {
    setPolicy((p) => ({ ...p, [band]: months }));
    const running = cases.filter((c) => bandOf(c) === band).length;
    toast(
      `${band} probation set to ${months} months — applies to probations starting from today.${running ? ` The ${running} running clock${running > 1 ? "s" : ""} in this band ${running > 1 ? "are" : "is"} not re-cut.` : ""}`,
    );
  };

  const runCheck = () => {
    toast(
      `FR-087 check — ${allItems.length} sources compiled across ${cases.length} cases, 0 by hand · ${ledger.length} decisions on the ledger · ${sessionRows.length} letter${sessionRows.length === 1 ? "" : "s"} queued this session.`,
      "success",
    );
  };

  /* --------------------------------- render ------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Probation &amp; confirmation</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            The clock starts at Stage 10 and ends in one recorded decision. The pack compiles itself, the manager is prompted ahead of term, and the letter follows the decision instead of being asked for (FR-087).
          </div>
        </div>
        <PfBtn variant="secondary" icon="stack" onClick={() => go("onboardhub")}>Stage 10 · onboarding</PfBtn>
        <PfBtn variant="primary" icon="file" onClick={() => go("letters")}>HR letters</PfBtn>
      </div>

      {/* clock + adapter honesty strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "9px 14px", marginBottom: 12 }}>
        <Ic name="clock" size={15} color="var(--pf-primary-500)" />
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-600)" }}>probation_clock · Stage 10</span>
        <PfBadge tone="green" dot>{VERIFY_ADAPTER?.provider ?? "Public QR resolver"} · live</PfBadge>
        <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>
          3 or 6 months by grade, configurable. Nothing here computes anything — the decision is typed by a person, and the letter it generates carries a verifiable code.
        </span>
      </div>

      {/* --------------------------------- KPIs ------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 4 }}>
        <PfStat
          icon="clock" tone="yellow" label="Reaching term" value={live.length} unit={`in ${HORIZON} days`}
          delta={critical ? `${critical} inside 7 days` : "none critical"} deltaTone={critical ? "red" : "green"}
        />
        <PfStat
          icon="warning" tone={soonest && soonest.daysToEnd <= 7 ? "red" : "yellow"} label="Soonest term"
          value={soonest ? soonest.daysToEnd : "—"} unit="days away"
          delta={soonest ? `${first(soonest.subject)} · ${soonest.endsAt}` : "all decided"}
          deltaTone={soonest && soonest.daysToEnd <= 7 ? "red" : "green"}
        />
        <PfStat
          icon="clipboard" tone="blue" label="Evidence compiled" value={`${compiled}/${allItems.length}`} unit="sources cited"
          delta="0 hand-assembled" deltaTone="green"
        />
        <PfStat
          icon="file" tone="green" label="Decisions on record" value={ledger.length} unit="each with a letter"
          delta={sessionRows.length ? `${sessionRows.length} queued today` : "via FR-086"} deltaTone="green"
        />
      </div>

      {/* --------------------------------- tabs ------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "due", label: "Coming up", count: String(live.length) },
            { key: "evidence", label: "Evidence packs" },
            { key: "decided", label: "Decided", count: String(ledger.length) },
          ]}
        />
      </div>

      {/* ================================= DUE ================================ */}
      {tab === "due" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {critical > 0 && soonest && (
            <PfBanner tone="red" icon="warning" cta="open" onCta={() => openPack(soonest.id)}>
              <span style={{ fontWeight: 600 }}>{soonest.subject} reaches term in {soonest.daysToEnd} days ({soonest.endsAt}) — </span>
              <span style={{ fontWeight: 400 }}>
                the prompt to {managerFor(soonest)} was due {Math.abs(promptDue(soonest))} days ago. Her pack is already compiled; the decision is the only thing outstanding.
              </span>
            </PfBanner>
          )}

          <PfCard>
            <PfCardHead
              title="The 90-day runway"
              sub={`Today is ${TODAY}. Every marker is a probation clock started at Stage 10, sitting where its term actually falls.`}
            >
              <PfBadge tone="grey">prompt at {PROMPT_LEAD}d</PfBadge>
            </PfCardHead>
            <Runway rows={live.map((c) => ({ c, days: c.daysToEnd }))} onPick={openPack} />
          </PfCard>

          {/* the cases */}
          <PfCard>
            <PfCardHead
              title="Probations reaching term"
              sub="Sorted by days to term. Open a row for the prompt that goes to the line manager and the state of the pack."
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 132px 128px", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Subject &amp; role</PfTh>
              <PfTh>Probation window</PfTh>
              <PfTh>Manager prompt</PfTh>
              <PfTh style={{ textAlign: "right" }}>To term</PfTh>
            </div>
            {live.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)" }}>
                Every running clock in this window has a recorded decision. The ledger has them.
              </div>
            )}
            {live.map((c, idx) => {
              const p = personById(c.workerId);
              const w = workerById(c.workerId);
              const tone = clockTone(c.daysToEnd);
              const total = Math.max(1, daysBetween(c.startedAt, c.endsAt));
              const done = Math.round(((total - c.daysToEnd) / total) * 100);
              const mgr = managerFor(c);
              const due = promptDue(c);
              const sent = prompted[c.id];
              const isOpen = open === c.id;
              const pack = packOf(c);
              const sch = isSchedulable(c.workerId);
              return (
                <div key={c.id} style={{ borderBottom: idx === live.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <HoverRow
                    onClick={() => setOpen(isOpen ? null : c.id)}
                    style={{ display: "grid", gridTemplateColumns: "1fr 200px 132px 128px", gap: 12, padding: "13px 20px", alignItems: "center" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Ic name={isOpen ? "caretdown" : "caretright"} size={14} color="var(--pf-n300)" />
                      <PfAvatar init={c.init} tone={c.tone} size={32} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.subject}</span>
                          {w && <PfBadge tone={w.workerType === "employee" ? "grey" : "blue"}>{WORKER_TYPE_LABEL[w.workerType]}</PfBadge>}
                          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{c.id}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.role} · {p?.dept ?? "—"} · {p?.loc ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--pf-n600)" }}>
                        {c.startedAt} <span style={{ color: "var(--pf-n300)" }}>→</span> <b style={{ color: "var(--pf-n900)" }}>{c.endsAt}</b>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                        <div style={{ flex: 1 }}><PfProgress pct={done} tone={tone === "grey" ? "green" : tone} height={6} /></div>
                        <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n400)" }}>{c.months}mo</span>
                      </div>
                    </div>
                    <div>
                      {sent ? (
                        <PfBadge tone="green" dot>Prompt sent</PfBadge>
                      ) : due <= 0 ? (
                        <PfBadge tone="red" dot>Due {Math.abs(due)}d ago</PfBadge>
                      ) : (
                        <PfBadge tone="grey">Due in {due}d</PfBadge>
                      )}
                      <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>{first(mgr)}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.4px", color: TONE[tone].fg, lineHeight: 1 }}>{c.daysToEnd}d</span>
                      <PfBadge tone={tone} dot>{clockWord(c.daysToEnd)}</PfBadge>
                    </div>
                  </HoverRow>

                  {isOpen && (
                    <div style={{ padding: "0 20px 16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 12 }}>
                        {/* the prompt */}
                        <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, background: "var(--pf-n25)", padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                            <Ic name="bell" size={14} color="var(--pf-n400)" />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Prompt to {mgr}</span>
                            <PfBadge tone="grey">filled from the case record</PfBadge>
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "11px 13px" }}>
                            {first(mgr)} — {c.subject}&rsquo;s {c.months}-month probation reaches term on <b>{c.endsAt}</b>, {c.daysToEnd} days from today.
                            The evidence pack is compiled and waiting: {pack.filter((i) => i.state === "present").map((i) => i.label.toLowerCase()).join(", ")}.
                            Record <b>confirm</b>, <b>extend</b> or <b>exit</b> before the end date — an extension has to reach {first(c.subject)} in writing while the original clock is still running.
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                            <PfBtn small variant="primary" icon="paperplane" onClick={() => sendPrompt(c)}>
                              {sent ? "Prompt again" : `Prompt ${first(mgr)}`}
                            </PfBtn>
                            <PfBtn small variant="secondary" icon="clipboard" onClick={() => openPack(c.id)}>Open evidence pack</PfBtn>
                            <PfBtn small variant="ghost" icon="user" onClick={() => go("employee")}>Person record</PfBtn>
                            {sent && <span style={{ fontSize: 11.5, color: "var(--pf-primary-600)" }}>{sent}</span>}
                          </div>
                        </div>
                        {/* readiness + reachability */}
                        <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 9 }}>Pack readiness</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {pack.map((i) => (
                              <div key={i.key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[ITEM_TONE[i.state]].bg, flex: "none" }} />
                                <span style={{ fontSize: 12, color: "var(--pf-n600)", flex: 1 }}>{i.label}</span>
                                <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{i.state === "present" ? "ready" : i.state}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 7, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                            <Ic name="calendar" size={13} color={sch.ok ? "var(--pf-primary-500)" : "var(--pf-yellow-500)"} />
                            <span>
                              {sch.ok
                                ? `Reachable for the conversation — ${p?.loc ?? "on site"}, on tour today (FR-090).`
                                : `${sch.why} — ${sch.nextWindow}. The review must not be booked into an off-rotation window.`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </PfCard>

          {/* policy */}
          <PfCard>
            <PfCardHead
              title="Probation length by grade"
              sub="The clock's default, set once per band. Changing it applies to probations that START from today — a running clock is never re-cut by a policy edit."
            >
              <PfBtn small variant="secondary" icon="stack" onClick={() => go("contracts")}>Contract templates</PfBtn>
            </PfCardHead>
            {CONFIGURABLE.map((band, i) => {
              const inBand = cases.filter((c) => bandOf(c) === band);
              const drift = inBand.filter((c) => c.months !== policy[band]);
              return (
                <div key={band} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <PfTile icon="gauge" tone={policy[band] === 3 ? "blue" : "purple"} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{band}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                      {inBand.length === 0
                        ? "No running clock in this band."
                        : drift.length === 0
                          ? `${inBand.length} running clock${inBand.length > 1 ? "s" : ""} — ${inBand.map((c) => `${first(c.subject)} ${c.months}mo`).join(", ")} · matches policy.`
                          : `${drift.map((c) => `${first(c.subject)} keeps ${c.months}mo`).join(", ")} — started under the previous policy and is not re-cut.`}
                    </div>
                  </div>
                  {drift.length > 0 && <PfBadge tone="yellow" dot>not retro-applied</PfBadge>}
                  <PfTabs
                    tabs={["3 months", "6 months"]}
                    active={policy[band] === 3 ? "3 months" : "6 months"}
                    onChange={(t) => setBand(band, t === "3 months" ? 3 : 6)}
                  />
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <Ic name="info" size={14} color="var(--pf-n400)" />
              <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                <b style={{ color: "var(--pf-n600)" }}>NYSC / Intern</b> runs the service year to PPA completion, not a probation — the decision is the same three paths, the vocabulary is not.{" "}
                <b style={{ color: "var(--pf-n600)" }}>Contract &amp; agency</b> workers have no probation at all: their lifecycle is mobilise / on contract / demobilise, and putting them on this page would be a category error.
              </div>
              <PfBtn small variant="secondary" onClick={() => go("workforce")}>Worker types</PfBtn>
            </div>
          </PfCard>
        </div>
      )}

      {/* =============================== EVIDENCE ============================= */}
      {tab === "evidence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* case switcher */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cases.length}, minmax(0,1fr))`, gap: 12 }}>
            {cases.map((c) => {
              const on = c.id === cur.id;
              const done = recorded[c.id];
              const tone = clockTone(c.daysToEnd);
              return (
                <button
                  key={c.id}
                  onClick={() => pick(c.id)}
                  style={{
                    fontFamily: "inherit", textAlign: "left", cursor: "pointer",
                    background: "var(--pf-n0)", borderRadius: 12, padding: "13px 15px",
                    border: on ? "1px solid var(--pf-primary-500)" : "1px solid var(--pf-n50)",
                    boxShadow: on ? "0 6px 14px -8px rgba(22,179,100,.55)" : "0 1px 3px 0 #f3f3f3",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <PfAvatar init={c.init} tone={c.tone} size={30} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis" }}>{c.subject}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis" }}>{c.role}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9 }}>
                    {done
                      ? <PfBadge tone={DECISION_TONE[done.decision]} dot>{DECISION_LABEL[done.decision]}ed</PfBadge>
                      : <PfBadge tone={tone} dot>{c.daysToEnd}d to term</PfBadge>}
                    <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{c.id}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* the pack */}
          <PfCard>
            <PfCardHead
              title={`${cur.subject} — evidence pack`}
              sub={`${cur.months}-month probation · ${cur.startedAt} → ${cur.endsAt} · ${elapsed} of ${totalDays} days elapsed · line manager ${curManager}`}
            >
              <PfBadge tone={cur.state === "Evidence ready" ? "green" : "grey"} dot>{cur.state}</PfBadge>
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`${cur.subject}'s pack exported — ${curPack.length} sources with provenance (PDF)`)}>Export pack</PfBtn>
            </PfCardHead>

            {/* summary + why */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>Pack summary</span>
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>— compiled, not judged. No path is proposed here.</span>
                <span style={{ flex: 1 }} />
                <button
                  onClick={() => setWhy((v) => !v)}
                  style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                >
                  <Ic name="question" size={12} color="var(--pf-purple-500)" />
                  Why this?
                  <Ic name={why ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
                </button>
              </div>
              <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.6 }}>{packSummary(cur)}</div>

              {why && (
                <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 11 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{curWhy.claim}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 9 }}>
                    {curWhy.basis.map((b) => (
                      <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                        <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
                    <button
                      onClick={() => go("trust")}
                      title="Model card index — Trust center"
                      style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                    >
                      <Ic name="robot" size={12} color="var(--pf-purple-500)" />
                      Model card {curWhy.modelCard} · {MC05.name}
                    </button>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                      The only model that touches this case, and only AFTER you decide · Human gate: {curWhy.humanGate.toLowerCase()}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 7, marginTop: 9, fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                    <Ic name="shield" size={12} color="var(--pf-n400)" />
                    <span>
                      No confidence score — a retrieval has nothing to be confident about. <b>No model proposes confirm, extend or exit</b>: the same red line that keeps the AI off a sanction in FR-088. Nationality and host community are NCDMB <b>reporting</b> fields and are not in this pack.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* the four sources */}
            {curPack.map((i, idx) => (
              <div key={i.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px", borderBottom: idx === curPack.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfTile icon={i.icon} tone={i.tone} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{i.label}</span>
                    <PfBadge tone={ITEM_TONE[i.state]} dot>{ITEM_WORD[i.state]}</PfBadge>
                  </div>
                  <div style={{ fontSize: 12.5, color: i.state === "present" ? "var(--pf-n600)" : "var(--pf-n500)", marginTop: 4, lineHeight: 1.55 }}>{i.value}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                    <Ic name="arrowsq" size={12} color="var(--pf-n300)" />
                    <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{i.source}</span>
                  </div>
                </div>
                <PfBtn small variant="secondary" onClick={() => go(i.stage)}>Open source</PfBtn>
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <Ic name="check" size={14} color="var(--pf-primary-500)" weight={2.4} />
              <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>
                <b style={{ color: "var(--pf-n600)" }}>Nobody assembled this.</b> Four surfaces already held these lines; the pack is the join, made at term. A gap is stated as a gap — never rendered as a blank cell for a manager to fill from memory.
              </span>
              <span style={{ flex: 1 }} />
              <PfBadge tone="grey">{curPack.filter((x) => x.state === "present").length} of {curPack.length} compiled</PfBadge>
            </div>
          </PfCard>

          {/* governance */}
          <PfCard>
            <PfCardHead title="Who can see this, and for how long" sub="A confirmation file carries performance judgement about a named person. It is governed like one." />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {[
                { icon: "shield", tone: "green" as PfTone, head: "Access", body: `People Ops and ${curManager}'s line of management only. ${curPerson?.name ?? cur.subject} sees the decision and its reasons — never the pack's internal notes before it is recorded.` },
                { icon: "clipboard", tone: "blue" as PfTone, head: "Logging", body: "Every open of this pack writes an entry: who, when, which case. The log is append-only and reviewable in the trust center." },
                { icon: "clock", tone: "purple" as PfTone, head: "Retention", body: "Held for the duration of employment plus 6 years, then destroyed. An extension keeps its reasons for the same period." },
              ].map((g, i) => (
                <div key={g.head} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <PfTile icon={g.icon} tone={g.tone} size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{g.head}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{g.body}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <Ic name="info" size={13} color="var(--pf-n400)" />
              <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                {curWorker ? `${WORKER_TYPE_LABEL[curWorker.workerType]} · currently ${curWorker.state.toLowerCase()} on the worker spine · nationality and host community are NCDMB reporting fields and are excluded from every model on this page.` : "Worker record not on the spine."}
              </span>
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" icon="shield" onClick={() => go("trust")}>Access log</PfBtn>
            </div>
          </PfCard>

          {/* ---------------------------- the decision --------------------------- */}
          {curDecided ? (
            <PfCard>
              <PfCardHead
                title="Decision recorded"
                sub={`${curDecided.decidedOn} · ${cur.id} · the record now carries an effective date, and the letter is drafting.`}
              >
                <PfBadge tone={DECISION_TONE[curDecided.decision]} dot>{DECISION_LABEL[curDecided.decision]}</PfBadge>
                <PfBtn small variant="ghost" icon="swap" onClick={undo}>Undo (session)</PfBtn>
              </PfCardHead>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, padding: "14px 20px" }}>
                {[
                  { k: "Path", v: DECISION_LABEL[curDecided.decision] },
                  { k: "Effective", v: curDecided.effective },
                  { k: "Record moves", v: transition(cur, curDecided.decision) },
                  { k: "Letter", v: `${curDecided.letter} · ${curDecided.letterState}` },
                ].map((f) => (
                  <div key={f.k} style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{f.k}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 3 }}>{f.v}</div>
                  </div>
                ))}
              </div>
              {curDecided.reasons && (
                <div style={{ padding: "0 20px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginBottom: 4 }}>Reasons on file</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "10px 12px" }}>
                    {curDecided.reasons}
                  </div>
                </div>
              )}
              <div style={{ padding: "0 20px 16px" }}>
                <PfBanner tone="green" icon="file" cta="open" onCta={() => go("letters")}>
                  <span style={{ fontWeight: 600 }}>{curDecided.letter} is in the HR letters queue — </span>
                  <span style={{ fontWeight: 400 }}>
                    Probation confirmation is the one template FR-086 will not let anyone request by hand. It fills {CONFIRM_LETTER.fills.join(", ").toLowerCase()} off the record, runs the {CONFIRM_LETTER.slaHours}-hour clock, and mints a verifiable code on issue.
                  </span>
                </PfBanner>
              </div>
            </PfCard>
          ) : (
            <PfCard>
              <PfCardHead
                title="Record the decision"
                sub={`Three paths, one record. ${cur.daysToEnd} days remain on ${first(cur.subject)}'s clock — an extension has to reach ${first(cur.subject)} in writing before ${cur.endsAt}. ${
                  sched.ok
                    ? `The conversation can be booked today (FR-090).`
                    : `${sched.why} — ${sched.nextWindow}; book the conversation inside that window (FR-090).`
                }`}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, padding: "14px 20px" }}>
                {(["confirm", "extend", "exit"] as ConfirmationDecision[]).map((p) => {
                  const on = path === p;
                  const t = DECISION_TONE[p];
                  return (
                    <button
                      key={p}
                      onClick={() => setPath(on ? null : p)}
                      style={{
                        fontFamily: "inherit", textAlign: "left", cursor: "pointer", borderRadius: 12, padding: "13px 15px",
                        background: on ? TONE[t].soft : "var(--pf-n0)",
                        border: on ? `1px solid ${TONE[t].fg}` : "1px solid var(--pf-n50)",
                        boxShadow: on ? "none" : "0 1px 3px 0 #f3f3f3",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PfTile icon={DECISION_ICON[p]} tone={t} size={28} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{DECISION_LABEL[p]}</span>
                        <span style={{ flex: 1 }} />
                        {on && <Ic name="check" size={15} color={TONE[t].fg} weight={2.4} />}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 8, lineHeight: 1.5 }}>{DECISION_BLURB[p]}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", marginTop: 8 }}>{transition(cur, p)}</div>
                    </button>
                  );
                })}
              </div>

              {/* path detail */}
              {path && (
                <div style={{ padding: "0 20px 16px" }}>
                  <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 12, padding: "14px 16px", background: "var(--pf-n25)" }}>
                    {path === "extend" && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>New end date</span>
                          <PfBadge tone="red">required</PfBadge>
                          <span style={{ flex: 1 }} />
                          {[1, 2, 3].map((n) => (
                            <PfBtn key={n} small variant="secondary" onClick={() => setNewDate(addMonthsIso(cur.endsAt, n))}>
                              +{n} month{n > 1 ? "s" : ""}
                            </PfBtn>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12, alignItems: "center" }}>
                          <input
                            type="date"
                            value={newDate}
                            min={toIso(cur.endsAt)}
                            onChange={(e) => setNewDate(e.target.value)}
                            style={fieldStyle}
                          />
                          <span style={{ fontSize: 12, color: newDate ? "var(--pf-n600)" : "var(--pf-n400)" }}>
                            {newDate
                              ? `Extends ${first(cur.subject)}'s probation by ${daysBetween(cur.endsAt, fromIso(newDate))} days, from ${cur.endsAt} to ${fromIso(newDate)}.`
                              : `Pick the date the extended probation ends. Nothing can be recorded without it — "extended" with no end is not a decision.`}
                          </span>
                        </div>
                      </div>
                    )}

                    {needsReasons && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Reasons</span>
                          <PfBadge tone="red">required</PfBadge>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                            {path === "extend"
                              ? "What is not yet met, and what would meet it. These go to the employee in the letter."
                              : "The grounds, in the words that will stand on the file. The AI does not draft these — a person does."}
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={reasons}
                          onChange={(e) => setReasons(e.target.value)}
                          placeholder={
                            path === "extend"
                              ? `e.g. 60-day milestones 2 of 3 complete; extend to close the third and take a first quality-of-hire read before confirming.`
                              : `e.g. the grounds, dated, and what was communicated to ${first(cur.subject)} during the probation period.`
                          }
                          style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.5 }}
                        />
                      </div>
                    )}

                    {path === "confirm" && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                        <Ic name="check" size={15} color="var(--pf-primary-500)" weight={2.2} />
                        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                          Confirmation takes effect on <b>{cur.endsAt}</b>, the day the probation ends — not the day you press the button. No reasons are required to confirm; the pack above already is the reason. Add a note only if you want one on the file.
                          <textarea
                            rows={2}
                            value={reasons}
                            onChange={(e) => setReasons(e.target.value)}
                            placeholder="Optional note for the file"
                            style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.5, marginTop: 9 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* requirements + record */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <Req ok={!!path}>Path chosen</Req>
                <Req ok={!!path && hasDate}>{path === "extend" ? "New end date" : "Effective date from the record"}</Req>
                <Req ok={!!path && hasReasons}>{needsReasons ? "Reasons in writing" : "Reasons not required to confirm"}</Req>
                <span style={{ flex: 1 }} />
                <PfBtn
                  variant="primary"
                  icon="check"
                  onClick={record}
                  style={ready ? undefined : { opacity: 0.45, boxShadow: "none" }}
                >
                  Record decision
                </PfBtn>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                <Ic name="file" size={14} color="var(--pf-n400)" />
                <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                  Recording writes the effective date onto {first(cur.subject)}&rsquo;s record and generates the <b>Probation confirmation</b> letter through FR-086 — {CONFIRM_LETTER.fills.join(", ").toLowerCase()} filled straight off the record, {CONFIRM_LETTER.slaHours}-hour clock, verifiable code on issue. Nobody opens a template.
                </div>
              </div>
            </PfCard>
          )}
        </div>
      )}

      {/* =============================== DECIDED ============================== */}
      {tab === "decided" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* outcome mix */}
          <PfCard>
            <PfCardHead
              title="Outcome mix"
              sub="Every confirmation decision this workspace holds. A real read of a real ledger — not a demo distribution."
            >
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`Confirmation ledger exported — ${ledger.length} decisions with effective dates and reasons (CSV)`)}>Export</PfBtn>
            </PfCardHead>
            <div style={{ padding: "16px 20px 8px" }}>
              <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--pf-n25)" }}>
                {(["confirm", "extend", "exit"] as ConfirmationDecision[]).map((d) => {
                  const n = ledger.filter((l) => l.decision === d).length;
                  if (!n) return null;
                  return <div key={d} title={`${DECISION_LABEL[d]} — ${n}`} style={{ width: `${(n / ledger.length) * 100}%`, background: TONE[DECISION_TONE[d]].bg }} />;
                })}
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
                {(["confirm", "extend", "exit"] as ConfirmationDecision[]).map((d) => {
                  const n = ledger.filter((l) => l.decision === d).length;
                  return (
                    <span key={d} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--pf-n500)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: TONE[DECISION_TONE[d]].bg }} />
                      {DECISION_LABEL[d]}
                      <b style={{ color: "var(--pf-n900)" }}>{n}</b>
                    </span>
                  );
                })}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>
                  {ledger.every((l) => l.decision === "confirm")
                    ? "No extension or exit on record — the mix says so rather than inventing one."
                    : `${sessionRows.length} recorded this session.`}
                </span>
              </div>
            </div>
          </PfCard>

          {/* the ledger */}
          <PfCard>
            <PfCardHead title="Confirmation ledger" sub="Newest first. Each row carries the path, the effective date, the reasons where the path demanded them, and the letter it produced." />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 1fr 130px", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Subject</PfTh>
              <PfTh>Decision</PfTh>
              <PfTh>Effective</PfTh>
              <PfTh>What the record says</PfTh>
              <PfTh style={{ textAlign: "right" }}>Letter</PfTh>
            </div>
            {ledger.map((l, i) => (
              <HoverRow
                key={l.key}
                onClick={l.letterState === "In the queue" ? () => go("letters") : undefined}
                style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 1fr 130px", gap: 12, padding: "13px 20px", alignItems: "center", borderBottom: i === ledger.length - 1 ? "none" : "1px solid var(--pf-n50)" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <PfAvatar init={l.init} tone={l.tone} size={30} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{l.subject}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis" }}>{l.role} · {l.months}mo · decided {l.decidedOn}</div>
                  </div>
                </div>
                <div><PfBadge tone={DECISION_TONE[l.decision]} dot>{DECISION_LABEL[l.decision]}</PfBadge></div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{l.effective}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{l.note}</div>
                  {l.reasons && (
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Reasons: {l.reasons}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{l.letter}</span>
                  <PfBadge tone={l.letterState === "Issued" ? "green" : "blue"} dot>{l.letterState}</PfBadge>
                </div>
              </HoverRow>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <Ic name="info" size={13} color="var(--pf-n400)" />
              <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                The issued letters carry no verification code: they predate <span style={{ fontFamily: MONO, fontSize: 11 }}>letter_verify v1</span>. Everything issued from today mints one.
              </span>
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" icon="shield" onClick={() => go("letters")}>Letters &amp; verification</PfBtn>
            </div>
          </PfCard>

          {/* the flywheel */}
          <PfCard>
            <PfCardHead
              title="What a confirmation feeds"
              sub="The decision at term is the first honest verdict on a hire. It is the quality flywheel's closing turn — every one of these reads it back."
            />
            {[
              { icon: "star", tone: "yellow" as PfTone, stage: "qoh", head: "Quality of hire", body: "A confirmation at term is the day-90 truth the QoH score gets graded against. An extension is the score's disagreement showing up in public." },
              { icon: "search", tone: "blue" as PfTone, stage: "sourcing", head: "Source quality", body: "A channel that produces confirmed hires outranks one that produces extensions — the ranking is the outcome, not the interview scorecard." },
              { icon: "clipboard", tone: "purple" as PfTone, stage: "onboardhub", head: "The 30/60/90 template", body: "Extensions cluster where the plan was thin. The onboarding hub reads the pattern back into the next cohort's plan." },
              { icon: "trend", tone: "green" as PfTone, stage: "attrition", head: "Attrition benchmark", body: "Only for records the FR-082 flags admit — Chiamaka's NYSC outcome is held out of the benchmark, the same way it is held out of quality of hire." },
            ].map((f, i) => (
              <div key={f.head} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfTile icon={f.icon} tone={f.tone} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{f.head}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 3, lineHeight: 1.55 }}>{f.body}</div>
                </div>
                <PfBtn small variant="secondary" onClick={() => go(f.stage)}>Open</PfBtn>
              </div>
            ))}
          </PfCard>

          {/* ships-when */}
          <PfCard>
            <PfCardHead
              title="Ships when"
              sub="The FR-087 acceptance clause: a probation reaching term produces an evidence pack, a recorded decision and a letter — without manual assembly. Checked against this workspace."
            >
              <PfBtn small variant="primary" icon="check" onClick={runCheck}>Run check</PfBtn>
            </PfCardHead>
            {[
              {
                claim: "The evidence pack compiles itself",
                detail: `${allItems.length} sources across ${cases.length} running cases, ${compiled} compiled and the rest named with a reason. Zero assembled by hand — the pack is a join over the 30/60/90 plan, the quality-of-hire read, the 1-on-1 record and goals.`,
                ok: true,
              },
              {
                claim: "The decision is recorded with an effective date",
                detail: `${ledger.length} decisions on the ledger, each carrying its path and effective date — and, for an extension or an exit, the reasons that cannot be skipped.`,
                ok: ledger.length > 0,
              },
              {
                claim: "The letter follows without anyone requesting it",
                detail: `Probation confirmation is the one template FR-086 does not expose to a manual request — it exists only as the output of this decision. ${sessionRows.length ? `${sessionRows.length} queued this session.` : "Record a decision to queue one."}`,
                ok: true,
              },
              {
                claim: "The manager is prompted ahead of the end date",
                detail: `Prompts fire at ${PROMPT_LEAD} days before term, with the pack attached. ${critical ? `${critical} case is inside 7 days and shows the prompt as overdue rather than hiding it.` : "No case is inside the critical window."}`,
                ok: true,
              },
            ].map((a, i) => (
              <div key={a.claim} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderTop: i === 0 ? "1px solid var(--pf-n50)" : "1px solid var(--pf-n50)" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", marginTop: 1, background: a.ok ? "var(--pf-primary-500)" : "var(--pf-n50)", border: a.ok ? "none" : "1px solid var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {a.ok ? <Ic name="check" size={13} color="#fff" weight={2.4} /> : <Ic name="clock" size={12} color="var(--pf-n400)" />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.claim}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{a.detail}</div>
                </div>
                <PfBadge tone={a.ok ? "green" : "yellow"} dot>{a.ok ? "Shipped" : "Waiting"}</PfBadge>
              </div>
            ))}
          </PfCard>

          <PfBanner tone="green" icon="sparkle" cta="open" onCta={() => go("cases")}>
            <span style={{ fontWeight: 600 }}>The AI never proposed one of these outcomes — </span>
            <span style={{ fontWeight: 400 }}>
              it compiled the evidence and drafted the letter afterwards. The same line runs through queries and disciplinary cases: the model drafts and summarises, a person decides.
            </span>
          </PfBanner>
        </div>
      )}
    </div>
  );
}
