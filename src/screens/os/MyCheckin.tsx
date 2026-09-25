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
  PRESENCE_TODAY, PRESENCE_TODAY_ISO, PRESENCE_PROMISE, NEVER_COLLECTED,
  CHECKIN_ELIGIBILITY, eligibilityFor, MODES, modeMeta,
  MY_PATTERN, MY_TODAY, MY_TODAY_PENDING, MY_PROMPT,
  MANAGER_NOT_SHOWN, WORKING_DAYS, workingDay, checkInsFor, checkInOn,
  awayReasonFor, AWAY_TONE, TEAM_TODAY, ROSTER, rosterMember, onLeave,
  schedulableToday, ROTATION_FEED_NOTE, PRESENCE_ACCESS_LOG, PRESENCE_ACCESS_NOTE,
  PRESENCE_AUDIT,
  type AwayReason, type CheckIn, type CheckInMode, type DayEntry, type WorkingDay,
} from "@/data/presence";
import { ME_ID, ME_PUBLIC, ME_FIRST, MY_MANAGER, MY_HANDBOOK } from "@/data/me";

/**
 * My check-in — FR-098, the DECLARANT side of presence. Amara's own page.
 *
 * `WhosIn.tsx` is the team board: eight people, two presence sources, a manager
 * reading it. This is the other end of the same wire — one person, one day, one
 * act — and the two pages have opposite obligations. The board has to be useful
 * to somebody looking for a colleague. This page has to be safe for the person
 * writing the record, which mostly means being extremely specific about what
 * leaves her hands the moment she taps a button.
 *
 * THE ONE DESIGN IDEA: the confirmation is the product. A check-in is a
 * disclosure. Every disclosure UI that ends at a green tick is asking someone to
 * trust a system they cannot see, and the honest version prints the record — all
 * five fields, blanks included — plus the exact three places it went and the
 * fact that nobody was notified. That receipt is the largest thing on the page
 * and it renders in full, immediately, on submit.
 *
 * FIVE RULES INHERITED FROM `@/data/presence` AND NOT SOFTENED HERE
 *
 * P1. The `CheckIn` type IS the privacy policy. Five fields and an id. This page
 *     renders every one of them and renders NEVER_COLLECTED next to them, because
 *     a promise printed beside the button is one the product has to keep.
 * P2. Nothing is verified. No badge, no VPN session, no login, no calendar. The
 *     page says this where the button is, not in a footer, because the whole
 *     reason the honest answer is easy here is that no answer can be found false.
 * P3. Away carries a category, never a cause. Her own "Not checked in" is a fact
 *     about a form. The page never lets it read as a fact about her.
 * P5. Patterns belong to the person. Everything on the pattern tab is a count of
 *     her own days. There is no score, no target, no trend arrow and no gauge
 *     against the handbook expectation — see "the number this page will not draw",
 *     which is the most pointed card here and the reason the tab is safe to open.
 * P6. Every read is logged, including hers, and the log renders.
 *
 * NO MODEL RUNS ON THIS PAGE. FR-093 asks that every AI output name its basis;
 * the honest application of that rule to a page with no AI on it is to say so and
 * to attach the same "Why this?" affordance to the one sentence that looks like
 * inference — MY_PATTERN.observation, which is a count and a date join.
 *
 * VENDOR-NEUTRAL. The pay card names "your payroll system" and nothing else. The
 * payroll decision is open and this page has no stake in it.
 *
 * Me-pillar scope: E-0214 and nobody else. The only rows read here are hers
 * (`checkInsFor(ME_ID)`), her own board entry, and the two population-level rules
 * in CHECKIN_ELIGIBILITY, which name no people. Deterministic — Fri Aug 28, 2026.
 */

/* ================================== tokens ================================= */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 8,
  padding: "9px 11px", width: "100%", outline: "none",
};

const MONO: CSSProperties = { fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600 };

const NOTE_MAX = 90;
const FOCUS_MAX = 70;

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const first = (n: string) => n.split(" ")[0];

/* =============================== spine reads =============================== */

const ME = ME_PUBLIC;

/** The only door to check-in rows on this page. Self-scoped, nine records. */
const MY_ROWS: CheckIn[] = checkInsFor(ME_ID);

/** Her seat on the board, and the size of the audience that board has. */
const MY_SEAT = rosterMember(ME_ID);
const BOARD_SIZE = ROSTER.length;
const COLLEAGUES = BOARD_SIZE - 1;

/** Her row on today's board, before anything this session writes. */
const MY_BOARD_ROW: DayEntry | undefined = TEAM_TODAY.entries.find((e) => e.workerId === ME_ID);
const MY_REASON_TODAY: AwayReason | null = awayReasonFor(ME_ID, PRESENCE_TODAY_ISO);
const LEAVE_TODAY = onLeave(ME_ID, PRESENCE_TODAY_ISO);
const SCHEDULABLE = schedulableToday(ME_ID);
const ELIGIBILITY = eligibilityFor(ME_ID);
const AUDIT = PRESENCE_AUDIT();

const TODAY_DAY: WorkingDay | undefined = workingDay(PRESENCE_TODAY_ISO);
const TODAY_SHORT = TODAY_DAY?.date ?? "Aug 28";

const REMOTE_POLICY = MY_HANDBOOK.find((h) => h.id === "hb-remote");

/**
 * DERIVED. The spine seeds CI-101 → CI-109 for her and stops, because Aug 28 is
 * deliberately open. A record written in this session needs an id in the same
 * series rather than a made-up one, so it is the highest suffix plus one.
 */
const NEXT_ID = (() => {
  const nums = MY_ROWS.map((r) => Number(r.id.replace(/\D/g, ""))).filter((n) => Number.isFinite(n));
  return `CI-${(nums.length ? Math.max(...nums) : 100) + 1}`;
})();

/**
 * DERIVED. `CheckIn` carries an iso and a display date but no weekday, and the
 * whole anchor-day question is a weekday question. WORKING_DAYS holds the weekday,
 * so the join is by iso and nothing is invented.
 */
type MyDay = { day: WorkingDay; row?: CheckIn };
const MY_DAYS: MyDay[] = WORKING_DAYS.map((day) => ({ day, row: checkInOn(ME_ID, day.iso) }));

const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * DERIVED. The spine computes a longest run inside MY_PATTERN and does not export
 * the function, so this is the same walk — needed because a record written now
 * changes the answer and a stale streak beside a live board is worse than none.
 */
const runOf = (rows: { mode: CheckInMode }[]): { mode: CheckInMode; n: number } => {
  let best: { mode: CheckInMode; n: number } = { mode: "home", n: 0 };
  let cur: { mode: CheckInMode; n: number } = { mode: "home", n: 0 };
  for (const r of rows) {
    cur = r.mode === cur.mode ? { mode: cur.mode, n: cur.n + 1 } : { mode: r.mode, n: 1 };
    if (cur.n > best.n) best = { ...cur };
  }
  return best;
};

/* ========================= the record, field by field ====================== */

type Audience = "self" | "team" | "system";

type FieldSpec = {
  key: string;
  label: string;
  optional: boolean;
  audience: Audience;
  what: string;
};

/**
 * P1 RENDERED. Every field on the `CheckIn` type, in declaration order, with who
 * reads it. Read the type: there is no sixth field, and a sixth field would be a
 * product decision rather than a schema change.
 *
 * DERIVED — the audience column. The spine documents `focus` as "a courtesy to
 * the team" and leaves `note` without a stated audience; this page treats the note
 * as the person's own, which is the reading that makes it safe to write one.
 */
const RECORD_FIELDS: FieldSpec[] = [
  { key: "id", label: "id", optional: false, audience: "system", what: "A row identifier in the same series as your other nine. Nothing about you." },
  { key: "workerId", label: "workerId", optional: false, audience: "system", what: "Your worker id. It is how the record is scoped to you and to nobody else." },
  { key: "iso", label: "iso", optional: false, audience: "system", what: "The date, machine-readable. A date, not a time — there is no hour on this record." },
  { key: "date", label: "date", optional: false, audience: "team", what: "The same date in the shape the app prints it." },
  { key: "mode", label: "mode", optional: false, audience: "team", what: "One of six words. This is the only location signal in the product, and you wrote it." },
  { key: "note", label: "note", optional: true, audience: "self", what: "A line to yourself about the day. It sits on your record; the board does not carry it." },
  { key: "focus", label: "focus", optional: true, audience: "team", what: "One line on what you are on today, written for your colleagues. Optional, and blank is common." },
];

const AUDIENCE_META: Record<Audience, { label: string; tone: PfTone; icon: string }> = {
  self: { label: "Only you", tone: "purple", icon: "shield" },
  team: { label: "Your board", tone: "blue", icon: "users" },
  system: { label: "The record", tone: "grey", icon: "file" },
};

/**
 * The fields a check-in product usually grows and this one does not have. Written
 * beside the record so the absence is legible rather than merely true.
 */
const ABSENT_FIELDS: { label: string; why: string }[] = [
  { label: "startedAt / endedAt", why: "There are no times on the record. A timesheet cannot be derived from a date and a word." },
  { label: "lat / lng / geofenceId", why: "No coordinate is taken. The mode you pick is the whole of the location signal." },
  { label: "ipAddress / networkId", why: "The product does not learn whether you are on the office wifi." },
  { label: "verifiedBy", why: "Nothing verifies a check-in, so there is nothing to name here (P2)." },
  { label: "seenBy[]", why: "Reads are logged against the board, not stitched into your row as an audience list." },
];

/* ====================== what the refusals actually mean ==================== */

/**
 * DERIVED COMMENTARY. NEVER_COLLECTED is the spine's list and renders verbatim.
 * The second line under each is this page's: what a product that DID collect the
 * signal would end up doing with it, because "we don't collect X" only lands once
 * you can see the meeting where X gets used.
 */
const REFUSAL_CONSEQUENCE: string[] = [
  "A coordinate turns a status into a claim that can be checked, and the first time it is checked the tool has changed sides. It also makes a home address a company record, permanently.",
  "Office wifi as a presence signal quietly makes the office the unit of work. It would also read a colleague on the guest network as away and a colleague tethering from home as in.",
  "Idle-time counts measure the keyboard, not the work. Thinking, reading, drawing on paper and being on a call all register as idle, which is why the number always punishes the same roles.",
  "Screen capture is the point at which a work tool becomes a monitoring tool. There is no version of it that is proportionate to knowing whether somebody is in the office today.",
  "Application usage produces a ranking nobody asked for within a week, and it captures a great deal about a person's life that is none of the employer's business.",
  "Reconciling a check-in against a badge or a VPN log converts a statement into an accusation. The moment an honest answer can be found false, the easy answer stops being the honest one.",
  "Scraping the calendar would make the focus line accurate and worthless. It is a courtesy to colleagues precisely because a person chose the words.",
  "Hours are the thing this record cannot hold, which is why it can never become an attendance system by accident. Adding one number would do it.",
];

/* ============================ what is not checked ========================= */

/** P2, itemised. The five things the product deliberately does not reconcile against. */
const NOT_CHECKED_AGAINST: { label: string; icon: string; line: string }[] = [
  { label: "Door badge", icon: "door", line: "The office badge system knows who came through the turnstile. It is not joined to this record and there is no field for it to write into." },
  { label: "VPN and login", icon: "shield", line: "Your first login this morning is not compared against what you picked. A person on a train with no signal is not a person who lied." },
  { label: "Your calendar", icon: "calendar", line: "The focus line is yours to write. Nothing reads your meetings to fill it in or to argue with it." },
  { label: "Device or IP", icon: "graph", line: "Nothing infers a location from a network. The mode you chose is the only location signal that exists here." },
  { label: "Yesterday's answer", icon: "clock", line: "There is no consistency check. Six home days followed by an office day raises nothing, because there is nothing to raise it to." },
];

/* ============================== pay separation ============================ */

const PAY_FACTS: { k: string; v: string; icon: string; tone: PfTone; sub: string }[] = [
  {
    k: "What decides your pay", v: "Your contract", icon: "wallet", tone: "green",
    sub: "A monthly salary paid on the 25th, with PAYE and pension deducted at source and remitted for you. It is a fixed amount for a month of work — no part of it is computed from days present.",
  },
  {
    k: "What decides your leave", v: "Your leave balance", icon: "calendar", tone: "blue",
    sub: "Entitled plus carried, less taken, read through the payroll connector. An approved leave day comes off that balance. A check-in has never moved it by one day.",
  },
  {
    k: "What this page decides", v: "Where to find you", icon: "house", tone: "purple",
    sub: "Today's board, and whether a scheduler proposes you a slot. That is the entire downstream effect, and it expires at the end of the day.",
  },
];

/* ============================== viewer switcher =========================== */

type ViewerKey = "you" | "manager" | "colleagues" | "people" | "payroll";

type Viewer = {
  key: ViewerKey;
  label: string;
  who: string;
  icon: string;
  tone: PfTone;
  logged: boolean;
  gets: string[];
  never: string[];
  line: string;
};

const VIEWERS: Viewer[] = [
  {
    key: "you", label: "You", who: `${ME.name} · ${ME.id}`, icon: "user", tone: "green", logged: true,
    line: "Everything, because it is yours. Your own reads are in the access log too — a log that only records other people is a log written to protect the wrong party.",
    gets: [
      "Every field on every one of your records, including the note.",
      "Your ten-day pattern, your office-day count and your longest run.",
      "The access log, including the reads your manager made.",
      "The ability to change or remove today's record at any point today.",
    ],
    never: ["Nothing is withheld from you on this page."],
  },
  {
    key: "manager", label: "Your manager", who: `${MY_MANAGER.name} · ${MY_MANAGER.role}`, icon: "users", tone: "blue", logged: true,
    line: "In or away, and the mode. That is the whole read, and every open of the board is logged against her name.",
    gets: [
      "Whether you are in or away today, as a status.",
      "The mode you picked — office, home, client site, field, travelling, or off.",
      "Your focus line, if you wrote one. It is written for colleagues.",
      "A team-level summary of the group: no row on it names a person and a count together.",
    ],
    never: [
      "Your note. It stays on your record and does not travel to the board.",
      "A per-person count of your office days — refused by name, with the reason (P5).",
      "Any streak, participation rate or check-in reliability figure about you.",
      "Hours, start time or end time. The record holds none, so there is nothing to derive.",
      "Any reason behind an away status beyond the category itself.",
    ],
  },
  {
    key: "colleagues", label: "Colleagues on the board", who: `${COLLEAGUES} people`, icon: "chat", tone: "purple", logged: true,
    line: "The same read as your manager, minus the team summary. It is a board for finding people, and it holds today only.",
    gets: [
      "Your status and mode for today.",
      "Your focus line, if you wrote one.",
      "Whether a meeting can be proposed to you today.",
    ],
    never: [
      "Your note.",
      "Any of your other days. The board answers about today; it is not a history anyone can page back through.",
      "Anything about your leave beyond the words “On leave”, on a day one applies.",
    ],
  },
  {
    key: "people", label: "The People team", who: "People / HR", icon: "clipboard", tone: "yellow", logged: true,
    line: "Nothing routine. There is no HR report built on check-ins, and no scheduled export of them.",
    gets: [
      "The same board any colleague sees, if they open it — and the open is logged.",
      "The aggregate health of the tool: how many people find the check-in worth filling in at all.",
    ],
    never: [
      "A per-person compliance report. It does not exist and there is no screen that produces one.",
      "Your note, on any surface, at any time.",
      "A case, a conversation or a letter triggered by a blank day. Nothing in the product watches for one.",
    ],
  },
  {
    key: "payroll", label: "Your payroll system", who: "The connected payroll source", icon: "wallet", tone: "grey", logged: false,
    line: "Nothing at all. No check-in has ever been sent to a payroll source, and there is no field in the connector that would carry one.",
    gets: ["Nothing. This page is not one of its inputs."],
    never: [
      "Your check-ins, in any form, aggregated or otherwise.",
      "A count of days present, because no such count is produced here.",
      "Anything that could reduce, delay or vary a month's pay.",
    ],
  },
];

/* ================================ small parts ============================= */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{hint}</span>}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 7 }}>
      {children}
    </div>
  );
}

function Note({ icon = "info", tone = "grey", children }: { icon?: string; tone?: PfTone; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Ic name={icon} size={13} color={TONE[tone].fg} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

function Empty({ icon = "search", title, children }: { icon?: string; title: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--pf-n25)", borderRadius: 10, margin: "14px 20px", padding: "28px 18px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", marginBottom: 9 }}><PfTile icon={icon} tone="grey" size={32} /></div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55, maxWidth: 470, marginLeft: "auto", marginRight: "auto" }}>{children}</div>
    </div>
  );
}

/** A disclosure that carries a reason. Used for refusals and for the omission list. */
function Disclose({ label, tone = "grey", children }: { label: string; tone?: PfTone; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = TONE[tone];
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: t.fg, background: "var(--pf-n0)", border: `0.6px solid ${t.line}`, borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color={t.fg} />
        {label}
        <Ic name={open ? "caretdown" : "caretright"} size={11} color={t.fg} />
      </button>
      {open && <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 8, paddingLeft: 2 }}>{children}</div>}
    </div>
  );
}

/**
 * The FR-093 affordance. It appears exactly once on this page, on the one
 * sentence that reads like inference — and the first thing it says is that no
 * model produced it, because a page with no AI on it should say so rather than
 * leave a reader to assume.
 */
function WhyThis({ claim, basis, onAudit }: { claim: string; basis: string[]; onAudit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-n500)" />
        Why this?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-n500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "12px 14px", marginTop: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{claim}</div>
          <div style={{ marginTop: 11 }}><SectionLabel>Basis</SectionLabel></div>
          {basis.map((b, i) => (
            <div key={b} style={{ display: "flex", gap: 9, padding: "5px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
              <span style={{ ...MONO, fontSize: 11, color: "var(--pf-n300)", flex: "none", marginTop: 2 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
            <Ic name="robot" size={14} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5, flex: 1, minWidth: 240 }}>
              No model card, because no model ran. Every line above is a count of your own rows or a join on a date — you can
              re-derive all of it from the ten cells on this tab, which is the only reason it is worth reading.
            </span>
            <PfBtn small variant="secondary" icon="shield" onClick={onAudit}>AI surface register</PfBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- mode chip -------------------------------- */

function ModeChip({ mode, active, onClick }: { mode: CheckInMode; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const m = modeMeta(mode);
  const t = TONE[m.tone];
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        fontFamily: "inherit", textAlign: "left", cursor: "pointer", flex: "1 1 168px", minWidth: 156,
        borderRadius: 11, padding: "11px 12px",
        background: active ? t.soft : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`,
        boxShadow: active ? `0 0 0 1px ${t.line}` : "0 0 0 0.5px rgba(42,42,42,.06)",
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PfTile icon={m.icon} tone={m.tone} size={26} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? t.fg : "var(--pf-n900)", lineHeight: 1.3 }}>{m.label}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.45 }}>
        {m.counts ? `Your row reads in · ${m.short.toLowerCase()}` : "Your row reads away · Off today"}
      </div>
    </button>
  );
}

/* ------------------------------- field row -------------------------------- */

function FieldRow({ spec, value, blank }: { spec: FieldSpec; value: string; blank: boolean }) {
  const a = AUDIENCE_META[spec.audience];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "108px 1fr 108px", gap: 12, alignItems: "start", padding: "10px 0", borderTop: "1px solid var(--pf-n50)" }}>
      <span style={{ ...MONO, color: "var(--pf-n600)" }}>
        {spec.label}
        {spec.optional && <span style={{ color: "var(--pf-n300)", fontWeight: 500 }}>?</span>}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: blank ? 500 : 600, color: blank ? "var(--pf-n300)" : "var(--pf-n900)", lineHeight: 1.45, wordBreak: "break-word" }}>
          {value}
        </div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{spec.what}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PfBadge tone={a.tone}>{a.label}</PfBadge>
      </div>
    </div>
  );
}

/* -------------------------------- day cell -------------------------------- */

function DayCell({ d, row, selected, onSelect }: {
  d: WorkingDay; row?: CheckIn; selected: boolean; onSelect: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const m = row ? modeMeta(row.mode) : undefined;
  const t = m ? TONE[m.tone] : TONE.grey;
  const filled = Boolean(m);
  return (
    <button
      {...hoverProps}
      onClick={onSelect}
      title={`${d.weekday} ${d.date} — ${m ? m.label : "no record"}${row?.focus ? ` · ${row.focus}` : ""}`}
      style={{
        fontFamily: "inherit", cursor: "pointer", textAlign: "center", borderRadius: 10, padding: "9px 4px",
        background: filled ? t.soft : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${selected ? "var(--pf-n900)" : filled ? t.line : "var(--pf-n50)"}`,
        boxShadow: selected ? "0 0 0 1px var(--pf-n900)" : "none",
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 600, color: d.isToday ? "var(--pf-n900)" : "var(--pf-n400)" }}>{d.weekday}</div>
      <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 1 }}>{d.date.replace("Aug ", "")}</div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 7 }}>
        {m
          ? <PfTile icon={m.icon} tone={m.tone} size={24} />
          : <span style={{ width: 24, height: 24, borderRadius: 7, border: "1px dashed var(--pf-n100)", display: "inline-block" }} />}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: m ? t.fg : "var(--pf-n300)", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {m ? m.short : "open"}
      </div>
    </button>
  );
}

/* =================================== screen =============================== */

type Tab = "today" | "pattern" | "collected";

export default function MyCheckin() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("today");

  /* ------------------------------ the take-flow ---------------------------- */
  const [mine, setMine] = useState<CheckIn | null>(null);
  const [pick, setPick] = useState<CheckInMode | null>(null);
  const [note, setNote] = useState("");
  const [focus, setFocus] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [changes, setChanges] = useState(0);

  /* -------------------------------- pattern -------------------------------- */
  const [grouping, setGrouping] = useState("By day");
  const [modeFilter, setModeFilter] = useState<CheckInMode | "all">("all");
  const [openDay, setOpenDay] = useState<string | null>(PRESENCE_TODAY_ISO);

  /* ------------------------------- collected ------------------------------- */
  const [openRefusal, setOpenRefusal] = useState<number | null>(null);
  const [viewer, setViewer] = useState<ViewerKey>("manager");
  const [showRaw, setShowRaw] = useState(false);
  const [showLog, setShowLog] = useState(false);

  /* ------------------------------ derivations ------------------------------ */

  /** Her rows plus anything written in this session — the live version of MY_PATTERN. */
  const liveRows: CheckIn[] = useMemo(() => (mine ? [...MY_ROWS, mine] : MY_ROWS), [mine]);

  const liveByMode = useMemo(
    () => MODES.map((m) => ({ mode: m, n: liveRows.filter((r) => r.mode === m.key).length })),
    [liveRows],
  );
  const usedModes = liveByMode.filter((r) => r.n > 0);
  const unusedModes = liveByMode.filter((r) => r.n === 0);

  const recorded = liveRows.length;
  const officeDays = liveRows.filter((r) => r.mode === "office").length;
  const longest = useMemo(() => runOf(liveRows), [liveRows]);
  const openDays = WORKING_DAYS.length - recorded;

  const liveDays: MyDay[] = useMemo(
    () => MY_DAYS.map((d) => (mine && d.day.iso === mine.iso ? { ...d, row: mine } : d)),
    [mine],
  );

  const filteredDays = useMemo(
    () => (modeFilter === "all" ? liveDays.filter((d) => d.row) : liveDays.filter((d) => d.row?.mode === modeFilter)),
    [liveDays, modeFilter],
  );

  const selectedDay = liveDays.find((d) => d.day.iso === openDay);

  /** DERIVED. Weekday grouping — the join WORKING_DAYS makes possible. */
  const byWeekday = useMemo(
    () => WEEKDAY_ORDER.map((w) => ({ weekday: w, days: liveDays.filter((d) => d.day.weekday === w) })),
    [liveDays],
  );

  const anchorDays = liveDays.filter((d) => d.day.weekday === "Tue");
  const anchorKept = anchorDays.filter((d) => d.row?.mode === "office").length;

  /** Her row on the board as it stands right now — including anything unsaved as a preview. */
  const previewMode: CheckInMode | null = mine ? mine.mode : pick;
  const previewSaved = Boolean(mine);
  const previewMeta = previewMode ? modeMeta(previewMode) : undefined;
  const previewIn = Boolean(previewMeta?.counts);
  const previewFocus = mine ? mine.focus : focus.trim() || undefined;

  const showPrompt = MY_TODAY_PENDING && !mine && !skipped;
  const formOpen = showPrompt || editing;

  const statusWord = mine
    ? (modeMeta(mine.mode).counts ? modeMeta(mine.mode).short : "Off")
    : "Open";

  const viewerRow = VIEWERS.find((v) => v.key === viewer) ?? VIEWERS[1];

  /* --------------------------------- actions -------------------------------- */

  const saveCheckIn = () => {
    if (!pick) {
      toast("Pick one of the six answers first — and one of them is not working today", "danger");
      return;
    }
    const rec: CheckIn = {
      id: mine?.id ?? NEXT_ID,
      workerId: ME_ID,
      iso: PRESENCE_TODAY_ISO,
      date: TODAY_SHORT,
      mode: pick,
      note: note.trim() || undefined,
      focus: focus.trim() || undefined,
    };
    const wasEdit = Boolean(mine);
    setMine(rec);
    setEditing(false);
    setSkipped(false);
    if (wasEdit) setChanges((n) => n + 1);
    const m = modeMeta(pick);
    toast(
      `${wasEdit ? "Changed" : "Recorded"} — ${m.label.toLowerCase()}, ${PRESENCE_TODAY}. ` +
      `Your board gets the mode${rec.focus ? " and your focus line" : ""}; ` +
      `${rec.note ? "your note stays on your record" : "you left the note blank"}; nobody was notified.`,
      "success",
    );
  };

  const removeCheckIn = () => {
    setMine(null);
    setPick(null);
    setNote("");
    setFocus("");
    setEditing(false);
    setSkipped(false);
    toast(`${NEXT_ID} removed. Your row reads Not checked in again — a fact about a form, not about you.`);
  };

  const skipToday = () => {
    setSkipped(true);
    setEditing(false);
    toast("Skipped. Nobody is notified, nothing is counted, and no total anywhere moves.");
  };

  const startEdit = () => {
    if (mine) {
      setPick(mine.mode);
      setNote(mine.note ?? "");
      setFocus(mine.focus ?? "");
    }
    setSkipped(false);
    setEditing(true);
  };

  const exportMine = () =>
    toast(`Exported ${plural(recorded, "record")} — yours, ${MY_PATTERN.window}. Nothing left the page for anyone else.`, "success");

  /* ------------------------------- lead insight ----------------------------- */

  const leadLine = (() => {
    const home = liveRows.filter((r) => r.mode === "home").length;
    if (!mine && !skipped) {
      return `Nine of your ten working days carry a record and the tenth is today, still open. Seven of the nine say home and two say office — that is a description of a fortnight, not a verdict on it, and the per-person version of those two numbers is refused to ${first(MY_MANAGER.name)} by name.`;
    }
    if (skipped && !mine) {
      return `You skipped today, which is a complete answer. Your board row reads Not checked in — not late, not absent, not unreachable — and your record for the window stands at nine days, exactly where it was before you opened this page.`;
    }
    return `Today is recorded: ${modeMeta(mine!.mode).label.toLowerCase()}. That takes you to ${recorded} of ${WORKING_DAYS.length} days in the window — ${home} at home, ${officeDays} in the office, and ${recorded - home - officeDays} somewhere else. All of it is yours to see and none of it is anybody's measure of you.`;
  })();

  /* ---------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* --------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My check-in</span>
            <PfBadge tone="grey">{ME.id}</PfBadge>
            <PfBadge tone="grey">FR-098</PfBadge>
            <PfBadge tone={mine ? "green" : "blue"} dot>{`${PRESENCE_TODAY} · ${mine ? "recorded" : "open"}`}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55, maxWidth: 830 }}>
            One line that tells {COLLEAGUES} colleagues where to find you today. You write it, nothing checks it against
            anything, and you can leave it blank. It is not attendance, it holds no hours, and it has never moved a naira of
            anyone&rsquo;s pay.
          </div>
        </div>
        <PfBtn variant="secondary" icon="users" onClick={() => go("whosin")}>Who&rsquo;s in today</PfBtn>
        <PfBtn
          variant="primary"
          icon={mine ? "swap" : "check"}
          onClick={() => {
            setTab("today");
            if (mine) startEdit();
            else { setSkipped(false); setEditing(true); }
            toast(mine ? "Change today’s record — it is yours until midnight." : MY_PROMPT.headline);
          }}
        >
          {mine ? "Change today" : "Check in"}
        </PfBtn>
      </div>

      {/* --------------------------------- KPIs ---------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon={mine ? modeMeta(mine.mode).icon : "clock"}
          tone={mine ? modeMeta(mine.mode).tone : skipped ? "grey" : "yellow"}
          label="Today"
          value={statusWord}
          unit={PRESENCE_TODAY.replace(", 2026", "")}
          delta={mine ? "you wrote this" : skipped ? "left blank" : "not recorded yet"}
          deltaTone={mine ? "green" : "grey"}
        />
        <PfStat
          icon="calendar" tone="blue" label="Days you recorded"
          value={`${recorded}/${WORKING_DAYS.length}`} unit="working days"
          delta={openDays === 0 ? "none open" : `${plural(openDays, "day")} open`}
          deltaTone={openDays === 0 ? "green" : "grey"}
        />
        <PfStat
          icon="house" tone="purple" label="Longest run"
          value={`${longest.n}d`} unit={`${modeMeta(longest.mode).short.toLowerCase()} in a row`}
          delta={MY_PATTERN.window.replace(", 2026", "")} deltaTone="grey"
        />
        <PfStat
          icon="shield" tone="green" label="Never collected"
          value={NEVER_COLLECTED.length} unit="signals refused"
          delta="written as data" deltaTone="green"
        />
      </div>

      {/* ------------------------------ lead insight ----------------------------- */}
      <div style={{ marginTop: 12 }}>
        <PfBanner
          tone={mine ? "green" : skipped ? "grey" : "blue"}
          icon={mine ? "check" : skipped ? "pause" : "info"}
          cta="What is collected"
          onCta={() => setTab("collected")}
        >
          {leadLine}
        </PfBanner>
      </div>

      {/* --------------------------------- tabs ---------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: "today", label: "Today", count: mine ? "recorded" : skipped ? "skipped" : "open" },
            { key: "pattern", label: "My pattern", count: `${recorded}/${WORKING_DAYS.length}` },
            { key: "collected", label: "What is and is not collected", count: String(NEVER_COLLECTED.length) },
          ]}
        />
      </div>

      {/* ================================== TODAY ================================= */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* ---------------------------- the act / the receipt ---------------------- */}
          <PfCard>
            <PfCardHead
              title={formOpen ? MY_PROMPT.headline : mine ? `Recorded · ${PRESENCE_TODAY}` : "You left today blank"}
              sub={
                formOpen
                  ? MY_PROMPT.body
                  : mine
                    ? "This is the record, in full, exactly as it is stored. Nothing about it is summarised and nothing is hidden behind a tick."
                    : PRESENCE_PROMISE.blank
              }
            >
              <PfBadge tone={mine ? "green" : "grey"} dot>{mine ? "Recorded" : "Optional"}</PfBadge>
              {mine && changes > 0 && <PfBadge tone="grey">{`changed ${plural(changes, "time")} today`}</PfBadge>}
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: 0, alignItems: "stretch" }}>
              {/* --------------------------------- left --------------------------------- */}
              <div style={{ padding: "16px 20px", borderRight: "1px solid var(--pf-n50)", minWidth: 0 }}>
                {formOpen ? (
                  <>
                    <Label hint="six answers, and one of them is not working today">Where are you working?</Label>
                    <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 16 }}>
                      {MODES.map((m) => (
                        <ModeChip key={m.key} mode={m.key} active={pick === m.key} onClick={() => setPick(m.key)} />
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <Label hint={<>optional &middot; <span style={{ color: "var(--pf-blue-500)" }}>your board sees this</span></>}>
                          Focus for the day
                        </Label>
                        <input
                          value={focus}
                          maxLength={FOCUS_MAX}
                          onChange={(e) => setFocus(e.target.value)}
                          placeholder="e.g. Payments reliability — p95 latency"
                          style={INPUT}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>A courtesy to colleagues, not a commitment.</span>
                          <span style={{ ...MONO, fontSize: 10.5, color: focus.length > FOCUS_MAX - 10 ? "var(--pf-yellow-500)" : "var(--pf-n300)" }}>
                            {`${focus.length}/${FOCUS_MAX}`}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label hint={<>optional &middot; <span style={{ color: "var(--pf-purple-500)" }}>only you see this</span></>}>
                          A note to yourself
                        </Label>
                        <input
                          value={note}
                          maxLength={NOTE_MAX}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="e.g. Power out at home from noon"
                          style={INPUT}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Stays on your record. It does not travel.</span>
                          <span style={{ ...MONO, fontSize: 10.5, color: note.length > NOTE_MAX - 12 ? "var(--pf-yellow-500)" : "var(--pf-n300)" }}>
                            {`${note.length}/${NOTE_MAX}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 16, flexWrap: "wrap" }}>
                      <PfBtn variant="primary" icon="check" onClick={saveCheckIn}>
                        {mine ? "Save the change" : "Check in"}
                      </PfBtn>
                      {mine || skipped ? (
                        <PfBtn variant="secondary" icon="x" onClick={() => setEditing(false)}>Cancel</PfBtn>
                      ) : (
                        <PfBtn variant="secondary" icon="pause" onClick={skipToday}>Skip today</PfBtn>
                      )}
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1, minWidth: 220, lineHeight: 1.5 }}>
                        {pick
                          ? `${modeMeta(pick).label} — ${modeMeta(pick).counts ? "your row will read in" : "your row will read away, category Off today"}.`
                          : "Nothing is selected, so nothing would be written."}
                      </span>
                    </div>
                  </>
                ) : mine ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                      <PfTile icon={modeMeta(mine.mode).icon} tone={modeMeta(mine.mode).tone} size={40} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)" }}>{modeMeta(mine.mode).label}</div>
                        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{`${ME.name} · ${PRESENCE_TODAY}`}</div>
                      </div>
                      <span style={{ flex: 1 }} />
                      <PfBadge tone={modeMeta(mine.mode).counts ? "green" : "grey"} dot>
                        {modeMeta(mine.mode).counts ? "Shows as in" : "Shows as away · Off today"}
                      </PfBadge>
                    </div>

                    <SectionLabel>The record, every field</SectionLabel>
                    <div style={{ marginBottom: 6 }}>
                      {RECORD_FIELDS.map((f) => {
                        const raw = (mine as unknown as Record<string, string | undefined>)[f.key];
                        const blank = raw === undefined || raw === "";
                        return (
                          <FieldRow
                            key={f.key}
                            spec={f}
                            blank={blank}
                            value={blank ? "— left blank, and blank is a complete answer" : String(raw)}
                          />
                        );
                      })}
                    </div>

                    <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px", marginTop: 12 }}>
                      <Note icon="shield" tone="green">
                        <b style={{ color: "var(--pf-n600)" }}>That is the whole record.</b> Seven rows, two of them optional and
                        blank if you left them blank. There is no eighth row on this page because there is no eighth field on
                        the type.
                      </Note>
                    </div>

                    <div style={{ display: "flex", gap: 9, marginTop: 14, flexWrap: "wrap" }}>
                      <PfBtn small variant="secondary" icon="swap" onClick={startEdit}>Change it</PfBtn>
                      <PfBtn small variant="secondary" icon="x" onClick={removeCheckIn}>Remove it</PfBtn>
                      <PfBtn small variant="ghost" icon="users" onClick={() => go("whosin")}>See the board</PfBtn>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <PfTile icon="pause" tone="grey" size={40} />
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)" }}>Not checked in</div>
                        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{`${ME.name} · ${PRESENCE_TODAY}`}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.65 }}>{PRESENCE_PROMISE.blank}</div>
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
                      <Note icon="x" tone="grey">Nobody was notified, and nothing is queued to notify anyone later.</Note>
                      <Note icon="x" tone="grey">No counter moved. The window still reads {`${recorded} of ${WORKING_DAYS.length}`} and that is the same figure it read before.</Note>
                      <Note icon="x" tone="grey">No case, no reminder and no letter is triggered by a blank day, here or anywhere in the product.</Note>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <PfBtn small variant="secondary" icon="plus" onClick={() => { setSkipped(false); setEditing(true); }}>
                        Check in after all
                      </PfBtn>
                    </div>
                  </>
                )}
              </div>

              {/* --------------------------------- right -------------------------------- */}
              <div style={{ padding: "16px 20px", background: "var(--pf-n25)", minWidth: 0 }}>
                {mine ? (
                  <>
                    <SectionLabel>Where it went, in full</SectionLabel>
                    {[
                      {
                        icon: "file", tone: "purple" as PfTone, k: "Your own record",
                        v: "All seven fields, including the note. It is yours, you can change it today and you can remove it entirely.",
                      },
                      {
                        icon: "users", tone: "blue" as PfTone, k: `Today’s board · ${COLLEAGUES} colleagues and ${first(MY_MANAGER.name)}`,
                        v: `Status ${previewIn ? "in" : "away"}, mode ${modeMeta(mine.mode).short.toLowerCase()}${mine.focus ? `, and your focus line` : ""}. Not the note.`,
                      },
                      {
                        icon: "calendar", tone: "green" as PfTone, k: "The scheduler",
                        v: `One boolean: whether a review or a 1-on-1 can be proposed to you today. It currently reads ${SCHEDULABLE.ok ? "yes" : "no"}, and it read that before you checked in too — it comes from leave and rotation, not from this.`,
                      },
                    ].map((d) => (
                      <div key={d.k} style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: "1px solid var(--pf-n50)" }}>
                        <PfTile icon={d.icon} tone={d.tone} size={26} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{d.k}</div>
                          <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 3, lineHeight: 1.55 }}>{d.v}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--pf-n50)", paddingTop: 11, marginTop: 4 }}>
                      <Note icon="bell" tone="grey">
                        <b style={{ color: "var(--pf-n600)" }}>Nobody was notified.</b> No email, no message to {first(MY_MANAGER.name)},
                        no alert anywhere. A check-in is a thing colleagues look up, not a thing that arrives.
                      </Note>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Note icon="clock" tone="grey">
                        It expires with the day. Tomorrow&rsquo;s board asks again from scratch, and today&rsquo;s answer has no
                        bearing on what you say then.
                      </Note>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Ic name="shield" size={15} color="var(--pf-primary-500)" />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{PRESENCE_PROMISE.headline}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.65 }}>{PRESENCE_PROMISE.body}</div>

                    <div style={{ marginTop: 14 }}><SectionLabel>Before you tap anything</SectionLabel></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                      <Note icon="x" tone="red">No location is taken. The word you pick is the only location signal that exists.</Note>
                      <Note icon="x" tone="red">No hours are recorded, so this can never become a timesheet.</Note>
                      <Note icon="x" tone="red">Nothing is checked against a badge, a login or your calendar.</Note>
                      <Note icon="check" tone="green">Blank is a complete answer, and the product treats it as one.</Note>
                    </div>
                    <div style={{ marginTop: 13 }}>
                      <PfBtn small variant="secondary" icon="shield" onClick={() => setTab("collected")}>
                        {`All ${NEVER_COLLECTED.length} refusals`}
                      </PfBtn>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Foot icon="info">
              {`Your row on the board right now: ${mine ? (previewIn ? `in — ${modeMeta(mine.mode).short.toLowerCase()}` : "away — Off today") : `away — ${MY_REASON_TODAY ?? MY_BOARD_ROW?.awayReason ?? "Not checked in"}`}. `}
              {`Presence source for ${ME_FIRST}: ${ELIGIBILITY === "check-in" ? "self-declared, because a Lagos desk role genuinely varies day to day" : "derived from the rotation calendar"}. `}
              {LEAVE_TODAY
                ? "An approved leave covers today, so the board would say so whatever you picked."
                : "No approved leave covers today, so the board is not saying anything about leave either."}
            </Foot>
          </PfCard>

          {/* --------------------------- what colleagues see ------------------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead
                title="What your colleagues will see"
                sub={previewSaved
                  ? "This is your live row, exactly as it renders on the team board."
                  : previewMode
                    ? "A preview. Nothing is written until you check in — pick a different mode and watch the row change."
                    : "Pick a mode above and this preview fills in. Nothing is written until you check in."}
              >
                <PfBadge tone={previewSaved ? "green" : "grey"} dot>{previewSaved ? "Live" : "Preview"}</PfBadge>
              </PfCardHead>

              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "9px 1fr", gap: 0, border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ background: previewMode ? (previewIn ? "var(--pf-primary-500)" : "var(--pf-n300)") : "var(--pf-n100)" }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.4fr", gap: 12, alignItems: "center", padding: "12px 14px", opacity: previewSaved ? 1 : 0.82 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <span style={{ opacity: previewIn ? 1 : 0.55, display: "inline-flex" }}>
                        <PfAvatar init={ME.init} tone={ME.tone} size={32} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{ME.name}</span>
                          <PfBadge tone="grey">You</PfBadge>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <span style={{ ...MONO, fontWeight: 500, color: "var(--pf-n300)" }}>{ME.id}</span> {`· ${ME.role}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      {previewMode
                        ? <PfBadge tone={previewIn ? previewMeta!.tone : "grey"} dot>{previewIn ? previewMeta!.short : "Off today"}</PfBadge>
                        : <PfBadge tone={AWAY_TONE["Not checked in"]} dot>Not checked in</PfBadge>}
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3 }}>Self-declared</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: previewFocus ? "var(--pf-n600)" : "var(--pf-n300)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {previewFocus ?? (previewMode ? "No focus line, and none is asked for" : "No detail, and none is asked for")}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3 }}>{ME.loc}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                  <div>
                    <SectionLabel>On the row</SectionLabel>
                    {["Your name and role", "In or away, as a status", "The mode you picked", "Your focus line, if you wrote one"].map((s) => (
                      <div key={s} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                        <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                        <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <SectionLabel>Not on the row, ever</SectionLabel>
                    {["Your note", "A time of any kind", "Where you actually are", "Any of your other nine days"].map((s) => (
                      <div key={s} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                        <Ic name="x" size={13} color="var(--pf-n300)" weight={2.2} />
                        <span style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Foot icon="orbit">{ROTATION_FEED_NOTE}</Foot>
            </PfCard>

            <PfCard>
              <PfCardHead title="Nothing here is verified" sub="P2, and the reason the honest answer stays the easy one.">
                <PfBadge tone="grey">{NOT_CHECKED_AGAINST.length}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "6px 20px 14px" }}>
                {NOT_CHECKED_AGAINST.map((r, i) => (
                  <div key={r.label} style={{ display: "flex", gap: 10, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <PfTile icon={r.icon} tone="grey" size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.label}</span>
                        <PfBadge tone="grey">not read</PfBadge>
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.55 }}>{r.line}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Foot icon="shield">
                A statement that can be found false stops being an easy one to make honestly. That is the entire argument for
                verifying nothing, and it is worth more to a team than a reconciliation report nobody would trust anyway.
              </Foot>
            </PfCard>
          </div>

          {/* ------------------------------ the six answers -------------------------- */}
          <PfCard>
            <PfCardHead
              title="The six answers, and what each one does"
              sub="The whole vocabulary. Five of them put you on the board as in; the sixth says you are not working and is not a lesser answer."
            >
              <PfBadge tone="grey">{`${MODES.length} modes`}</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {MODES.map((m, i) => {
                const n = liveRows.filter((r) => r.mode === m.key).length;
                return (
                  <div
                    key={m.key}
                    style={{
                      padding: "14px 20px",
                      borderTop: i > 2 ? "1px solid var(--pf-n50)" : "none",
                      borderRight: i % 3 !== 2 ? "1px solid var(--pf-n50)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                      <PfTile icon={m.icon} tone={m.tone} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{`Board label: ${m.short}`}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <PfBadge tone={m.counts ? "green" : "grey"}>{m.counts ? "Counts as in" : "Not presence"}</PfBadge>
                      <span style={{ fontSize: 11.5, color: n > 0 ? "var(--pf-n600)" : "var(--pf-n300)" }}>
                        {n > 0 ? `${plural(n, "day")} in your window` : "you have not used it"}
                      </span>
                    </div>
                    {!m.counts && (
                      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 8, lineHeight: 1.55 }}>
                        Picking this shows away, category <b>Off today</b>. The product does not ask why and has nowhere to put a
                        reason if it did.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Foot icon="info">
              There is no &ldquo;in the office, half day&rdquo; and no &ldquo;home, but available from 2pm&rdquo;. Both would need a
              time, and a time is the one thing this record cannot hold. Six words is a smaller answer than the truth, and it is
              small enough to be safe.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ================================= PATTERN ================================ */}
      {tab === "pattern" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          <PfBanner tone="purple" icon="shield" cta="What your manager is refused" onCta={() => setTab("collected")}>
            {MY_PATTERN.visibility}
          </PfBanner>

          {/* ------------------------------ the fortnight ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="Your fortnight"
              sub={`${MY_PATTERN.window}. Ten working days, weekends omitted rather than zeroed. Click a day for the record you wrote on it.`}
            >
              <PfTabs tabs={["By day", "By weekday"]} active={grouping} onChange={setGrouping} />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              {[
                { k: "Days you recorded", v: `${recorded}/${WORKING_DAYS.length}`, s: mine ? "including today, written just now" : openDays === 1 ? "one open day: today" : `${plural(openDays, "day")} left open` },
                { k: "Office days", v: String(officeDays), s: "your count, and nobody else has it" },
                { k: "Longest run", v: `${longest.n}d`, s: `${modeMeta(longest.mode).short.toLowerCase()} in a row, consecutive working days` },
              ].map((c) => (
                <div key={c.k}>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", marginTop: 4, lineHeight: 1.1 }}>{c.v}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4, lineHeight: 1.45 }}>{c.s}</div>
                </div>
              ))}
            </div>

            {grouping === "By day" ? (
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${WORKING_DAYS.length}, minmax(0,1fr))`, gap: 7 }}>
                  {liveDays.map((d) => (
                    <DayCell
                      key={d.day.iso}
                      d={d.day}
                      row={d.row}
                      selected={openDay === d.day.iso}
                      onSelect={() => setOpenDay(openDay === d.day.iso ? null : d.day.iso)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr", gap: 10, marginBottom: 8 }}>
                  <PfTh>Weekday</PfTh>
                  <PfTh>{`Week of ${WORKING_DAYS[0].date}`}</PfTh>
                  <PfTh>{`Week of ${WORKING_DAYS[5].date}`}</PfTh>
                </div>
                {byWeekday.map((w) => (
                  <div key={w.weekday} style={{ display: "grid", gridTemplateColumns: "72px 1fr 1fr", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid var(--pf-n50)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{w.weekday}</span>
                    {w.days.map((d) => {
                      const m = d.row ? modeMeta(d.row.mode) : undefined;
                      const t = m ? TONE[m.tone] : TONE.grey;
                      return (
                        <button
                          key={d.day.iso}
                          onClick={() => setOpenDay(d.day.iso)}
                          title={`${d.day.weekday} ${d.day.date}`}
                          style={{
                            fontFamily: "inherit", cursor: "pointer", textAlign: "left", borderRadius: 8,
                            padding: "7px 10px", display: "flex", alignItems: "center", gap: 8,
                            background: m ? t.soft : "var(--pf-n25)",
                            border: `1px solid ${openDay === d.day.iso ? "var(--pf-n900)" : m ? t.line : "var(--pf-n50)"}`,
                          }}
                        >
                          <span style={{ ...MONO, fontSize: 10.5, color: "var(--pf-n300)", width: 34 }}>{d.day.date.replace("Aug ", "")}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: m ? t.fg : "var(--pf-n300)" }}>{m ? m.short : "open"}</span>
                          <span style={{ flex: 1 }} />
                          {d.row?.note && <Ic name="chat" size={12} color="var(--pf-n300)" />}
                          {d.row?.focus && <Ic name="target" size={12} color="var(--pf-n300)" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  <Note icon="calendar" tone="blue">
                    {`Your squad keeps a Tuesday anchor day and you have made ${anchorKept} of ${anchorDays.length}. Aug 18 was in the office; on Aug 25 you wrote “Missing the anchor day — release window” yourself. That is the whole of the analysis, and you already knew both halves of it.`}
                  </Note>
                </div>
              </div>
            )}

            {/* ------------------------------ day detail ---------------------------- */}
            {selectedDay && (
              <div style={{ borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                    {`${selectedDay.day.weekday} ${selectedDay.day.date}`}
                  </span>
                  {selectedDay.day.isToday && <PfBadge tone="green" dot>Today</PfBadge>}
                  {selectedDay.row
                    ? <PfBadge tone={modeMeta(selectedDay.row.mode).tone}>{modeMeta(selectedDay.row.mode).label}</PfBadge>
                    : <PfBadge tone="grey">No record</PfBadge>}
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="ghost" icon="x" onClick={() => setOpenDay(null)}>Close</PfBtn>
                </div>
                {selectedDay.row ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
                    {[
                      { k: "Mode", v: modeMeta(selectedDay.row.mode).label, blank: false },
                      { k: "Focus · your board saw this", v: selectedDay.row.focus ?? "Left blank", blank: !selectedDay.row.focus },
                      { k: "Note · only you", v: selectedDay.row.note ?? "Left blank", blank: !selectedDay.row.note },
                    ].map((r) => (
                      <div key={r.k}>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{r.k}</div>
                        <div style={{ fontSize: 12.5, color: r.blank ? "var(--pf-n300)" : "var(--pf-n600)", marginTop: 4, lineHeight: 1.55 }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                    {selectedDay.day.isToday
                      ? "Nothing written for today yet. There is no penalty attached to that and no counter waiting on it — the Today tab has the form if you want it."
                      : "No record on this day. It is a fact about a form and it stays that way; nothing backfills it and nobody was asked about it."}
                  </div>
                )}
              </div>
            )}

            <Foot icon="shield">
              Ten cells and three counts. There is no percentage on this card, no target line across it and no arrow claiming
              you are trending anywhere — all three would turn a description into a grade, and a grade is exactly what an
              optional, unverified form must never produce.
            </Foot>
          </PfCard>

          {/* -------------------------- modes + records table ------------------------ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="How the days went" sub="Counted, not scored. The order is the order the modes are declared in, not a ranking." />
              <div style={{ padding: "14px 20px" }}>
                {usedModes.map((b) => (
                  <div key={b.mode.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, width: 108, flex: "none" }}>
                      <Ic name={b.mode.icon} size={13} color={TONE[b.mode.tone].fg} />
                      <span style={{ fontSize: 12, color: "var(--pf-n600)" }}>{b.mode.short}</span>
                    </span>
                    <div style={{ flex: 1 }}>
                      <PfProgress pct={(b.n / WORKING_DAYS.length) * 100} tone={b.mode.tone} height={7} />
                    </div>
                    <span style={{ ...MONO, fontSize: 11.5, color: "var(--pf-n400)", width: 22, textAlign: "right" }}>{b.n}</span>
                  </div>
                ))}
                {unusedModes.length > 0 && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--pf-n50)" }}>
                    <SectionLabel>Not used in this window</SectionLabel>
                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                      {unusedModes.map((b) => <PfBadge key={b.mode.key} tone="grey">{b.mode.short}</PfBadge>)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 9 }}>
                      Zero is shown as zero rather than dropped. A mode you never picked is a fact about a fortnight, and hiding
                      it would make the chart tidier and the fortnight less legible.
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--pf-n50)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="download" onClick={exportMine}>Export my records</PfBtn>
                  <PfBtn small variant="ghost" icon="calendar" onClick={() => go("myleave")}>My leave</PfBtn>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead
                title="Every record you wrote"
                sub={modeFilter === "all"
                  ? `${plural(filteredDays.length, "record")} in the window. Filter by mode to read a particular kind of day back.`
                  : `Filtered to ${modeMeta(modeFilter).label.toLowerCase()}.`}
              >
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <FilterChip label="All" active={modeFilter === "all"} onClick={() => setModeFilter("all")} n={liveRows.length} />
                  {MODES.map((m) => (
                    <FilterChip
                      key={m.key}
                      label={m.short}
                      tone={m.tone}
                      active={modeFilter === m.key}
                      onClick={() => setModeFilter(m.key)}
                      n={liveRows.filter((r) => r.mode === m.key).length}
                    />
                  ))}
                </div>
              </PfCardHead>

              <div style={{ display: "grid", gridTemplateColumns: "88px 104px 1.3fr 1.1fr", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
                <PfTh>Day</PfTh>
                <PfTh>Mode</PfTh>
                <PfTh>Focus &middot; your board saw this</PfTh>
                <PfTh>Note &middot; only you</PfTh>
              </div>

              {filteredDays.length === 0 ? (
                <Empty icon="calendar" title={`No ${modeFilter === "all" ? "" : modeMeta(modeFilter).short.toLowerCase() + " "}days in this window`}>
                  {modeFilter === "all"
                    ? "You have not recorded a day in this window at all. That is unusual for this record, and it is still not a problem — nothing is waiting on it."
                    : `You never picked ${modeMeta(modeFilter).label.toLowerCase()} between ${WORKING_DAYS[0].date} and ${WORKING_DAYS[WORKING_DAYS.length - 1].date}. That is a fact about a fortnight, not a gap in your record.`}
                </Empty>
              ) : (
                filteredDays.map((d) => <RecordRow key={d.day.iso} d={d} onOpen={() => { setOpenDay(d.day.iso); setGrouping("By day"); }} />)
              )}

              <Foot icon="shield">
                Both optional columns render, blanks included. Six of your records have no note on them at all, and the page
                shows that rather than quietly collapsing the column — a blank field is evidence the field is genuinely
                optional.
              </Foot>
            </PfCard>
          </div>

          {/* ------------------------------- observation ----------------------------- */}
          <PfCard>
            <PfCardHead title="One thing you might not have noticed" sub="A count and a date join, offered once, with no follow-up and no reminder attached.">
              <PfBadge tone="grey">No model ran</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 0 }}>
              <div style={{ padding: "16px 20px", borderRight: "1px solid var(--pf-n50)" }}>
                <div style={{ background: "var(--pf-n25)", borderRadius: 10, padding: "13px 15px" }}>
                  <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.7 }}>{MY_PATTERN.observation}</div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <WhyThis
                    claim={`Two office days across ${MY_PATTERN.window}, one of them on the squad’s Tuesday anchor day.`}
                    basis={[
                      `${plural(liveRows.length, "record")} across the ${WORKING_DAYS.length} working days in the window, read from your own rows and nobody else’s.`,
                      `${plural(officeDays, "of them")} say office: ${liveRows.filter((r) => r.mode === "office").map((r) => r.date).join(" and ")}. The rest say home.`,
                      `Joined to the calendar by date, which is where the weekday comes from — the record itself carries no weekday.`,
                      `Your squad’s anchor day is a Tuesday. Aug 18 was an office day; on Aug 25 your own note reads “Missing the anchor day — release window”.`,
                      "Nothing was compared against a colleague, a team average, a target or the handbook expectation. There is no comparison in this sentence at all.",
                    ]}
                    onAudit={() => go("aisurfaces")}
                  />
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <SectionLabel>What this observation is not</SectionLabel>
                {[
                  "Not a nudge. Nothing follows it, nothing repeats it and no reminder was scheduled.",
                  "Not a flag. It was not raised to anyone and there is no surface where it could be.",
                  "Not a prediction about next week. It describes two Tuesdays that already happened.",
                  "Not a judgement about the anchor day. Your squad lead sets those days, and the release window was real.",
                ].map((s) => (
                  <div key={s} style={{ display: "flex", gap: 8, padding: "5px 0" }}>
                    <Ic name="x" size={13} color="var(--pf-n300)" weight={2.2} />
                    <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{s}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-n50)" }}>
                  <Note icon="shield" tone="purple">{MY_PATTERN.visibility}</Note>
                </div>
              </div>
            </div>
          </PfCard>

          {/* ------------------------- the number we will not draw ------------------- */}
          <PfCard>
            <PfCardHead
              title="The number this page will not draw"
              sub="There is an obvious gauge to build here. It is not built, and this is the reason."
            >
              <PfBadge tone="red">Deliberate omission</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 0 }}>
              <div style={{ padding: "16px 20px", borderRight: "1px solid var(--pf-n50)" }}>
                <SectionLabel>{REMOTE_POLICY ? `${REMOTE_POLICY.title} · ${REMOTE_POLICY.owner}` : "Where we work"}</SectionLabel>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.7 }}>
                  {REMOTE_POLICY?.body ??
                    "Lagos HQ teams are in the office 3 days a week. Squad leads set which days, not HR."}
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <PfBadge tone="grey">{`updated ${REMOTE_POLICY?.updated ?? "Mar 2026"}`}</PfBadge>
                  <PfBadge tone="grey">hb-remote</PfBadge>
                </div>
                <div style={{ marginTop: 14, background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "14px 15px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", letterSpacing: ".3px", textTransform: "uppercase", fontWeight: 600 }}>
                    Compliance gauge
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n300)", marginTop: 8, letterSpacing: "-.3px" }}>not built</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55 }}>
                    This is where a product would put your office days against the handbook expectation and colour it red.
                  </div>
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <Note icon="warning" tone="red">
                    <b style={{ color: "var(--pf-n600)" }}>The evidence would be wrong.</b> The gauge would be drawn from an
                    optional, unverified form. A colleague who fills it in honestly would score worse than one who does not fill
                    it in at all, and within a month everyone would have learned which of those to be.
                  </Note>
                  <Note icon="users" tone="yellow">
                    <b style={{ color: "var(--pf-n600)" }}>The conversation belongs to your squad.</b> The handbook says squad
                    leads set which days, not HR. A number on a screen would settle a question that is supposed to be discussed,
                    and settle it in favour of whoever reads the screen.
                  </Note>
                  <Note icon="shield" tone="grey">
                    <b style={{ color: "var(--pf-n600)" }}>The bottom of that gauge is predictable.</b> The longest commute, the
                    youngest children, the least reliable power at home. None of it is performance, and all of it would start
                    being managed as if it were.
                  </Note>
                  <Note icon="check" tone="green">
                    What is here instead: your ten days, your counts, and the handbook clause in full, so you can hold both and
                    decide about next week yourself.
                  </Note>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="chat" onClick={() => go("myoneonones")}>Raise it in a 1-on-1</PfBtn>
                  <PfBtn small variant="ghost" icon="shield" onClick={() => setTab("collected")}>What is refused, in full</PfBtn>
                </div>
              </div>
            </div>
            <Foot icon="info">
              The same argument applies to the manager view, and it is applied there: no per-person office-day count exists
              anywhere in the product, for anyone, at any level. A refusal that only holds on the employee&rsquo;s own page is not
              a refusal.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* =============================== COLLECTED ================================ */}
      {tab === "collected" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {/* ------------------------------ the refusals ----------------------------- */}
          <PfCard>
            <PfCardHead
              title="What this never collects"
              sub="Eight signals a presence product could take and this one refuses. Open any of them for what a product that did take it would end up doing with it."
            >
              <PfBadge tone="red">{`${NEVER_COLLECTED.length} refusals`}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "6px 20px 14px" }}>
              {NEVER_COLLECTED.map((n, i) => {
                const open = openRefusal === i;
                return (
                  <div key={n} style={{ borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <button
                      onClick={() => setOpenRefusal(open ? null : i)}
                      style={{ fontFamily: "inherit", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 0", display: "flex", alignItems: "flex-start", gap: 10 }}
                    >
                      <span style={{ marginTop: 1 }}><Ic name="x" size={15} color="var(--pf-red-500)" weight={2.2} /></span>
                      <span style={{ fontSize: 12.5, color: "var(--pf-n600)", flex: 1, minWidth: 0, lineHeight: 1.6 }}>{n}</span>
                      <span style={{ marginTop: 2 }}><Ic name={open ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" /></span>
                    </button>
                    {open && (
                      <div style={{ padding: "0 0 14px 25px" }}>
                        <div style={{ background: "var(--pf-red-50)", border: "1px solid var(--pf-red-100)", borderRadius: 10, padding: "11px 13px" }}>
                          <SectionLabel>What collecting it would do</SectionLabel>
                          <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.65 }}>{REFUSAL_CONSEQUENCE[i]}</div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Foot icon="shield">
              This list is an exported array in the product, not copy on a page. It renders here because a privacy promise
              buried in a policy PDF is a promise nobody reads, and one printed beside the button is one the product has to
              keep. If a future release starts collecting any of the eight, this card is where it would have to be deleted from.
            </Foot>
          </PfCard>

          {/* ------------------------------ the whole record ------------------------- */}
          <PfCard>
            <PfCardHead
              title="The whole record"
              sub="Seven rows. Two of them optional. This is not a summary of the record, it is the record."
            >
              <PfBtn small variant="secondary" icon={showRaw ? "caretdown" : "caretright"} onClick={() => setShowRaw((v) => !v)}>
                {showRaw ? "Hide it as stored" : "Show it as stored"}
              </PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 0 }}>
              <div style={{ padding: "6px 20px 16px", borderRight: "1px solid var(--pf-n50)" }}>
                {RECORD_FIELDS.map((f) => {
                  const raw = mine ? (mine as unknown as Record<string, string | undefined>)[f.key] : undefined;
                  const blank = raw === undefined || raw === "";
                  return (
                    <FieldRow
                      key={f.key}
                      spec={f}
                      blank={blank}
                      value={blank ? (mine ? "— left blank" : "— nothing recorded today yet") : String(raw)}
                    />
                  );
                })}
                {showRaw && (
                  <div style={{ marginTop: 14, background: "var(--pf-n900)", borderRadius: 10, padding: "13px 15px", overflowX: "auto" }}>
                    <pre style={{ ...MONO, fontSize: 11, color: "#E6F4EC", margin: 0, lineHeight: 1.7, whiteSpace: "pre" }}>
{mine
  ? `{
  id:       "${mine.id}",
  workerId: "${mine.workerId}",
  iso:      "${mine.iso}",
  date:     "${mine.date}",
  mode:     "${mine.mode}",${mine.note ? `\n  note:     "${mine.note}",` : ""}${mine.focus ? `\n  focus:    "${mine.focus}"` : ""}
}`
  : `// no record for ${PRESENCE_TODAY_ISO}
// MY_TODAY === ${String(MY_TODAY)}
// MY_TODAY_PENDING === ${String(MY_TODAY_PENDING)}
// this is what "Not checked in" is: the absence of a row.`}
                    </pre>
                  </div>
                )}
              </div>

              <div style={{ padding: "16px 20px", background: "var(--pf-n25)" }}>
                <SectionLabel>Fields this record does not have</SectionLabel>
                {ABSENT_FIELDS.map((f) => (
                  <div key={f.label} style={{ padding: "9px 0", borderTop: "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Ic name="x" size={13} color="var(--pf-n300)" weight={2.2} />
                      <span style={{ ...MONO, color: "var(--pf-n400)", textDecoration: "line-through" }}>{f.label}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.55, paddingLeft: 21 }}>{f.why}</div>
                  </div>
                ))}
                <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-n50)" }}>
                  <Note icon="info" tone="grey">
                    A sixth field would be adding surveillance to something that currently is not. That is a product decision,
                    not a schema change, and it would be argued in the open rather than shipped in a migration.
                  </Note>
                </div>
              </div>
            </div>
          </PfCard>

          {/* ------------------------------- who sees what --------------------------- */}
          <PfCard>
            <PfCardHead
              title="Who sees what"
              sub="Pick a reader. Each one gets exactly the list below and nothing that is not on it."
            >
              <PfBadge tone="grey">{`${VIEWERS.length} readers`}</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${VIEWERS.length}, minmax(0,1fr))`, gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              {VIEWERS.map((v) => (
                <ViewerCard key={v.key} v={v} active={v.key === viewer} onSelect={() => setViewer(v.key)} />
              ))}
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 12 }}>
                <PfTile icon={viewerRow.icon} tone={viewerRow.tone} size={30} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{viewerRow.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{viewerRow.who}</div>
                </div>
                <span style={{ flex: 1 }} />
                <PfBadge tone={viewerRow.logged ? "green" : "grey"} dot>
                  {viewerRow.logged ? "Every read logged" : "No read to log"}
                </PfBadge>
              </div>

              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65, marginBottom: 14 }}>{viewerRow.line}</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "var(--pf-n25)", borderRadius: 10, padding: "13px 15px" }}>
                  <SectionLabel>Gets</SectionLabel>
                  {viewerRow.gets.map((g) => (
                    <div key={g} style={{ display: "flex", gap: 8, padding: "5px 0" }}>
                      <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                      <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>{g}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--pf-n25)", borderRadius: 10, padding: "13px 15px" }}>
                  <SectionLabel>Never gets</SectionLabel>
                  {viewerRow.never.map((g) => (
                    <div key={g} style={{ display: "flex", gap: 8, padding: "5px 0" }}>
                      <Ic name="x" size={13} color="var(--pf-n300)" weight={2.2} />
                      <span style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>{g}</span>
                    </div>
                  ))}
                </div>
              </div>

              {viewer === "manager" && (
                <div style={{ marginTop: 14, background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", borderRadius: 10, padding: "13px 15px" }}>
                  <SectionLabel>Your row, as {first(MY_MANAGER.name)} reads it today</SectionLabel>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <PfAvatar init={ME.init} tone={ME.tone} size={28} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{ME.name}</span>
                    {mine
                      ? <PfBadge tone={modeMeta(mine.mode).counts ? modeMeta(mine.mode).tone : "grey"} dot>{modeMeta(mine.mode).counts ? modeMeta(mine.mode).short : "Off today"}</PfBadge>
                      : <PfBadge tone={AWAY_TONE["Not checked in"]} dot>Not checked in</PfBadge>}
                    {mine?.focus && <span style={{ fontSize: 12, color: "var(--pf-n600)" }}>{mine.focus}</span>}
                    <span style={{ flex: 1 }} />
                    <PfBadge tone="grey">{`${MY_SEAT?.dept ?? ME.dept} · ${MY_SEAT?.loc ?? ME.loc}`}</PfBadge>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 10, lineHeight: 1.6 }}>
                    {mine?.note
                      ? `Your note today reads “${mine.note}”. It is not in the row above and there is no control on her board that would reveal it.`
                      : "You have no note on today. If you wrote one it would still not be in the row above — the note does not travel to the board."}
                  </div>
                </div>
              )}
            </div>

            <Foot icon="shield">{PRESENCE_ACCESS_NOTE}</Foot>
          </PfCard>

          {/* --------------------------- manager refusals ---------------------------- */}
          <PfCard>
            <PfCardHead
              title={`What ${first(MY_MANAGER.name)} is refused, by name`}
              sub="Not omitted by oversight and not hidden by styling. These are listed in the product with the reason attached, on her surface as well as yours."
            >
              <PfBadge tone="red">{`${MANAGER_NOT_SHOWN.length} refusals`}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "6px 20px 14px" }}>
              {MANAGER_NOT_SHOWN.map((m, i) => (
                <div key={m.item} style={{ padding: "12px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Ic name="x" size={15} color="var(--pf-red-500)" weight={2.2} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 0 }}>{m.item}</span>
                    <PfBadge tone="grey">{`R${i + 1}`}</PfBadge>
                  </div>
                  <div style={{ marginTop: 9, paddingLeft: 25 }}>
                    <Disclose label="Why not" tone="red">{m.why}</Disclose>
                  </div>
                </div>
              ))}
            </div>
            <Foot icon="info">
              A manager is told what she is not being given and for what reason, rather than left to wonder whether it is hidden
              or simply not built. The second and third refusals are the ones that protect this page: your own streak is yours to
              see, and the same number in somebody else&rsquo;s hands is a performance metric nobody agreed to.
            </Foot>
          </PfCard>

          {/* ------------------------- not attendance for pay ------------------------ */}
          <PfCard>
            <PfCardHead
              title="A check-in is not attendance, and it is not pay"
              sub="The single most common fear about a feature like this one, answered with the mechanism rather than a reassurance."
            >
              <PfBadge tone="green" dot>No link exists</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {PAY_FACTS.map((f, i) => (
                <div key={f.k} style={{ padding: "16px 20px", borderRight: i < PAY_FACTS.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <PfTile icon={f.icon} tone={f.tone} size={28} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{f.k}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", marginTop: 10, letterSpacing: "-.3px" }}>{f.v}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.6 }}>{f.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 11 }}>
              <Note icon="wallet" tone="green">
                <b style={{ color: "var(--pf-n600)" }}>Nothing on this page reaches your payroll system.</b> Salary and approved
                reimbursements go to the connected payroll source on the 25th; a check-in is not one of its inputs and there is no
                field in the connector that would carry one.
              </Note>
              <Note icon="clock" tone="grey">
                <b style={{ color: "var(--pf-n600)" }}>It could not become a timesheet even if somebody wanted it to.</b> The
                record holds a date and a word. There is no start, no end and no duration anywhere on it, so there is nothing to
                total.
              </Note>
              <Note icon="x" tone="grey">
                A blank day does not become an unpaid day, a leave day, or anything at all. It stays a blank day.
              </Note>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <PfBtn small variant="secondary" icon="calendar" onClick={() => go("myleave")}>My leave balance</PfBtn>
                <PfBtn small variant="secondary" icon="wallet" onClick={() => go("myrewards")}>My total rewards</PfBtn>
                <PfBtn small variant="ghost" icon="shield" onClick={() => go("myprivacy")}>My data &amp; privacy</PfBtn>
              </div>
            </div>
          </PfCard>

          {/* -------------------- who declares, who is never asked ------------------- */}
          <PfCard>
            <PfCardHead
              title="Who is asked to declare, and who is never asked"
              sub="The honest version of the doctrine, because the line between ingesting attendance and capturing it did move here — in one direction only."
            >
              <PfBadge tone="grey">FR-089</PfBadge>
              <PfBadge tone="grey">FR-098</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {CHECKIN_ELIGIBILITY.map((r, i) => {
                const isMine = r.source === ELIGIBILITY;
                return (
                  <div key={r.population} style={{ padding: "16px 20px", borderRight: i === 0 ? "1px solid var(--pf-n50)" : "none", background: isMine ? "var(--pf-n25)" : "var(--pf-n0)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                      <PfTile icon={r.source === "check-in" ? "user" : "orbit"} tone={r.source === "check-in" ? "blue" : "purple"} size={28} />
                      <PfBadge tone={r.source === "check-in" ? "blue" : "purple"}>
                        {r.source === "check-in" ? "Self-declared" : "Derived · ingest only"}
                      </PfBadge>
                      {isMine && <PfBadge tone="green" dot>You are here</PfBadge>}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5, marginBottom: 7 }}>{r.population}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.65 }}>{r.why}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: "16px 20px", borderTop: "1px solid var(--pf-n50)" }}>
              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.75 }}>
                FR-089 says the product <b>ingests</b> attendance and never captures it, and that rule still stands for every
                field and site role in the company. This page captures. The difference is the act, not the row it writes: a
                geofenced biometric clock-in is a measurement taken <i>of</i> a worker, it happens whether they participate or
                not, and it exists to catch somebody. What you did on the Today tab is a statement made <i>by</i> you to your
                colleagues, which you wrote, can change, and could have left blank. The two produce similar-looking rows in a
                database and they are not the same product.
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.75, marginTop: 12 }}>
                So there is no check-in button for a scaffolder at Bonny Terminal, and this module never writes one. Site presence
                is read off the rotation calendar instead, which already knows where he is — asking him to declare his location
                on a platform he is standing on would be surveillance dressed as a feature.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginTop: 16 }}>
                {[
                  { k: "Self-declared records", v: String(AUDIT.checkIns), s: "across the desk-based colleagues on this board" },
                  { k: "Read off the rotation calendar", v: String(AUDIT.rotationMembers), s: "site colleagues, never asked to declare" },
                  { k: "Violations", v: String(AUDIT.violations.length), s: AUDIT.clean ? "proved by the data, not asserted in a comment" : "the seed crossed the line" },
                ].map((b) => (
                  <div key={b.k} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 13px" }}>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{b.k}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", marginTop: 4, letterSpacing: "-.3px" }}>{b.v}</div>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{b.s}</div>
                  </div>
                ))}
              </div>
            </div>

            <Foot icon="shield">
              {AUDIT.clean
                ? "The build check runs over the seed and fails if any site or field worker holds a self-declared check-in. It passes, which is how the FR-089 line is kept: by a test, not by a paragraph."
                : AUDIT.violations.join(" · ")}
            </Foot>
          </PfCard>

          {/* --------------------------------- access log ---------------------------- */}
          <PfCard>
            <PfCardHead title="Who has read the board you are on" sub={PRESENCE_ACCESS_NOTE}>
              <PfBadge tone="grey">{plural(PRESENCE_ACCESS_LOG.length, "read")}</PfBadge>
              <PfBtn small variant="secondary" icon={showLog ? "caretdown" : "caretright"} onClick={() => setShowLog((v) => !v)}>
                {showLog ? "Hide the log" : "Show the log"}
              </PfBtn>
            </PfCardHead>
            {showLog ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "140px 1.2fr 1.2fr 1.4fr", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
                  <PfTh>When</PfTh><PfTh>Who</PfTh><PfTh>Action</PfTh><PfTh>Scope</PfTh>
                </div>
                {PRESENCE_ACCESS_LOG.map((a) => {
                  const isYou = a.who.startsWith("You");
                  return (
                    <div key={`${a.at}-${a.action}`} style={{ display: "grid", gridTemplateColumns: "140px 1.2fr 1.2fr 1.4fr", gap: 12, padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", alignItems: "center", background: isYou ? "var(--pf-n25)" : "var(--pf-n0)" }}>
                      <span style={{ ...MONO, fontWeight: 500, color: "var(--pf-n400)" }}>{a.at}</span>
                      <span style={{ fontSize: 12.5, color: "var(--pf-n900)", fontWeight: isYou ? 600 : 400 }}>{a.who}</span>
                      <span style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{a.action}</span>
                      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{a.scope}</span>
                    </div>
                  );
                })}
              </>
            ) : (
              <div style={{ padding: "16px 20px" }}>
                <Note icon="info" tone="grey">
                  Four reads in the current window, one of them yours. The log records what was opened and at what scope; it does
                  not record what anyone was looking for, because a log of intent is a guess dressed as a record.
                </Note>
              </div>
            )}
            <Foot icon="user">
              Your own reads are in here too. A log that only records other people is a log written to protect the wrong party —
              and it is the only reason the line above about your manager&rsquo;s reads is worth anything.
            </Foot>
          </PfCard>

          <PfBanner tone="green" icon="check" cta="Back to today" onCta={() => setTab("today")}>
            {`${ME_FIRST}, this ships when the confirmation prints the record in full, the refusals sit beside the button rather than in a policy PDF, and the answer to “what does my manager see” is a list you can read in ten seconds rather than a promise you have to take.`}
          </PfBanner>
        </div>
      )}
    </div>
  );
}

/* ============================== sub-components ============================= */

function FilterChip({ label, n, active, tone = "grey", onClick }: {
  label: string; n: number; active: boolean; tone?: PfTone; onClick: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[tone];
  const empty = n === 0;
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title={empty ? `No ${label.toLowerCase()} days in this window` : `${plural(n, "day")}`}
      style={{
        fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
        fontSize: 11.5, fontWeight: 600, padding: "4px 9px", borderRadius: 999,
        background: active ? t.soft : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        color: active ? t.fg : empty ? "var(--pf-n300)" : "var(--pf-n500)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`,
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      {label}
      <span style={{ ...MONO, fontSize: 10.5, color: active ? t.fg : "var(--pf-n300)" }}>{n}</span>
    </button>
  );
}

function RecordRow({ d, onOpen }: { d: MyDay; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  const row = d.row!;
  const m = modeMeta(row.mode);
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        display: "grid", gridTemplateColumns: "88px 104px 1.3fr 1.1fr", gap: 12, alignItems: "center",
        padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", cursor: "pointer",
        background: hovered ? "var(--pf-n25)" : "var(--pf-n0)", transition: "background .12s ease",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{d.day.date}</div>
        <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 1 }}>
          {d.day.weekday}{d.day.isToday ? " · today" : ""}
        </div>
      </div>
      <div><PfBadge tone={m.tone} dot={m.counts}>{m.short}</PfBadge></div>
      <div style={{ fontSize: 12, color: row.focus ? "var(--pf-n600)" : "var(--pf-n300)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.focus ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: row.note ? "var(--pf-n600)" : "var(--pf-n300)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {row.note ?? "—"}
      </div>
    </div>
  );
}

function ViewerCard({ v, active, onSelect }: { v: Viewer; active: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onSelect}
      style={{
        fontFamily: "inherit", textAlign: "left", cursor: "pointer", borderRadius: 11, padding: "11px 12px",
        background: active ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-n900)" : "var(--pf-n50)"}`,
        boxShadow: active ? "0 0 0 1px var(--pf-n900)" : "0 0 0 0.5px rgba(42,42,42,.06)",
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      <PfTile icon={v.icon} tone={v.tone} size={26} />
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 8, lineHeight: 1.35 }}>{v.label}</div>
      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {v.who}
      </div>
      <div style={{ marginTop: 8 }}>
        <PfBadge tone={v.key === "you" ? "green" : v.key === "payroll" ? "grey" : "blue"}>
          {v.key === "you" ? "everything" : v.key === "payroll" ? "gets nothing" : `${plural(v.never.length, "refusal")}`}
        </PfBadge>
      </div>
    </button>
  );
}
