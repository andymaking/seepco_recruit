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
  PRESENCE_TODAY, PRESENCE_TODAY_ISO, NEVER_COLLECTED, PRESENCE_PROMISE,
  CHECKIN_ELIGIBILITY, eligibilityFor, MODES, modeMeta, CHECK_INS,
  WORKING_DAYS, ROSTER, rosterMember, PRESENCE_LEAVE, onLeave,
  AWAY_TONE, dayView, TEAM_TODAY, todaySplit, MY_PATTERN, MY_TODAY_PENDING, MY_PROMPT,
  TEAM_SIGNALS, MANAGER_NOT_SHOWN, schedulableToday, ROTATION_FEED_NOTE,
  PRESENCE_ACCESS_LOG, PRESENCE_ACCESS_NOTE, PRESENCE_AUDIT,
  type AwayReason, type CheckInMode, type DayEntry, type TeamDay,
} from "@/data/presence";
import { ROTATIONS, ROTATION_ASSIGNMENTS, ROTATION_REF, SITES } from "@/data/workforce";
import { auditScore } from "@/data/trust";

/**
 * Who's in — the team day view. FR-085 promised it and shipped a leave balance;
 * this is the half that was missing, sitting on the FR-098 check-in spine.
 *
 * THE ARGUMENT THIS PAGE MAKES, IN ONE LINE: a day view for a Nigerian energy
 * employer has to be true for a scaffolder as well as an engineer, and a view
 * that only reads check-ins is true for neither.
 *
 * Three surfaces:
 *   1. today   — who is in, where, and who is away AS A CATEGORY ONLY,
 *   2. the week — a coverage grid with column totals and, deliberately, no row totals,
 *   3. coverage — "can we hold this on Thursday", answered off the rotation
 *      calendar and the approved-leave window, and honest about what it cannot know.
 *
 * FOUR RULES THE CODE KEEPS, NOT JUST THE COPY
 *
 * A. AWAY CARRIES A CATEGORY, NEVER A CAUSE (P3). Every away string on this page
 *    comes out of the spine's five-value `AwayReason` union via `dayView()`. There
 *    is no other path. The leave record behind Adaeze's row genuinely holds a type,
 *    an approver and a date range; this file reads none of them and prints a mask
 *    where they would go, so the boundary is visible rather than merely respected.
 *
 * B. OFF ROTATION IS NOT ABSENT (P4). The FR-090 join is the reason this page is
 *    worth building. A 28/28 worker 24 days into an off-tour is exactly where the
 *    calendar put him. Nothing here renders him red, counts him, or chases him.
 *
 * C. NO LEAGUE TABLE (P5). The week grid totals its COLUMNS and refuses to total
 *    its ROWS, and says why in the gutter where the row total would be. A column
 *    total is a fact about a day. A row total is a fact about a person, and it
 *    becomes a ranking within a week whatever the header says.
 *
 * D. NO MODEL RUNS HERE. The coverage recommendation is a cycle length, a modulo
 *    and a leave window. It still carries the FR-093 "Why this?" affordance with
 *    its full basis — and that panel says there is no model card, because there is
 *    no model, rather than leaving a reader to assume one.
 *
 * DERIVED, AND SAID OUT LOUD. The spine's `dayView()` reads the rotation calendar
 * at the calendar's own reference day (ROTATION_REF, Fri Aug 7) and holds that
 * position across the ten-day board. For a 28/28 that is exact; for a 5/2 it is the
 * pattern rather than the day. The planner needs positions on days the calendar has
 * not reached, so it advances the cycle itself — same arithmetic as `onRotation()`,
 * plus an offset — and the UI states that where it happens.
 */

/* ================================== tokens ================================== */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 8,
  padding: "9px 11px", width: "100%", outline: "none",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86_400_000;

const first = (name: string) => name.split(" ")[0];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/* =============================== spine reads =============================== */

const ME_ID = MY_PATTERN.workerId;
const ME = rosterMember(ME_ID);
const ME_NAME = ME?.name ?? "You";

const SPLIT = todaySplit();
const AUDIT = PRESENCE_AUDIT();
const AI_AUDIT = auditScore();

const DESK = ROSTER.filter((r) => r.source === "check-in");
const SITE_CREW = ROSTER.filter((r) => r.source === "rotation");

/** Today's declared records, before anything this session writes. */
const DECLARED_TODAY = CHECK_INS.filter((c) => c.iso === PRESENCE_TODAY_ISO).length;

/** The ten-day board, one `dayView()` per working day — the sanctioned accessor. */
const WEEK: TeamDay[] = WORKING_DAYS.map((d) => dayView(d.iso));

/* --------------------------- the away vocabulary --------------------------- */

/**
 * Rule A, rendered. Five words is the entire vocabulary; the second column is
 * what each one deliberately does not say.
 */
const AWAY_MEANING: Record<AwayReason, { says: string; refuses: string }> = {
  "On leave": {
    says: "An approved leave covers today. That is the whole answer.",
    refuses: "Not the type of leave. Not a medical circumstance. Not the length of it, and not what she wrote on the request.",
  },
  "Off rotation": {
    says: "The rotation calendar has them off tour. They are where it put them.",
    refuses: "Not an absence, not a no-show, and never counted as one. Nobody is chased and nothing is escalated.",
  },
  "Off today": {
    says: "They said so themselves — one of the six answers on the check-in is not working today.",
    refuses: "The product does not ask why and has nowhere to put a reason if it did.",
  },
  "Public holiday": {
    says: "A gazetted holiday applies where they work.",
    refuses: "Not a fact about the person at all. It is a fact about the calendar.",
  },
  "Not checked in": {
    says: "There is no record for today. It is a fact about a form.",
    refuses: "Not absent. Not late. Not unreachable. No one is notified, nothing is counted, and it does not appear on any total.",
  },
};

const AWAY_ORDER: AwayReason[] = ["On leave", "Off rotation", "Off today", "Public holiday", "Not checked in"];

/**
 * What the leave record holds against what this board reads off it. The values
 * are masked on purpose — `awayReasonFor()` never reads them, so neither does
 * this file, and printing the field names with a mask makes that visible.
 */
const LEAVE_FIELDS: { field: string; read: boolean; note: string }[] = [
  { field: "kind", read: false, note: "The leave type. Discarded at the boundary — the board's five-value union has nowhere to put it." },
  { field: "from → to", read: false, note: "A range is a duration, and a duration invites inference. The board asks one question: does a leave cover today." },
  { field: "days", read: false, note: "Same objection, in a smaller number." },
  { field: "approver", read: false, note: "Belongs on the leave record. It is not a thing seven colleagues need on a board." },
  { field: "state", read: true, note: "Read indirectly, and only this far: an unapproved request produces no window and therefore no away status." },
];

/* ------------------------- derived: the planner days ----------------------- */

type PlanDay = { iso: string; date: string; weekday: string; offset: number };

const REF_MS = Date.parse(`${ROTATION_REF}T00:00:00Z`);
const TODAY_MS = Date.parse(`${PRESENCE_TODAY_ISO}T00:00:00Z`);

/**
 * DERIVED. The spine's window ends today, and a planning question is always about
 * a day that has not happened. These are the next five weekdays after Aug 28,
 * with each one's offset from the rotation calendar's own reference day.
 */
const PLAN_DAYS: PlanDay[] = (() => {
  const out: PlanDay[] = [];
  let ms = TODAY_MS + DAY_MS;
  while (out.length < 5) {
    const d = new Date(ms);
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6) {
      out.push({
        iso: d.toISOString().slice(0, 10),
        date: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`,
        weekday: WDAYS[w],
        offset: Math.round((ms - REF_MS) / DAY_MS),
      });
    }
    ms += DAY_MS;
  }
  return out;
})();

type RotAt = { rotName: string; site: string; pos: number; len: number; on: boolean; backIn: number };

/**
 * DERIVED. `onRotation()` answers for the calendar's reference day only. This is
 * the same arithmetic with an offset, so a planner can ask about next Thursday.
 */
const rotationAt = (workerId: string, offset: number): RotAt | undefined => {
  const a = ROTATION_ASSIGNMENTS.find((x) => x.workerId === workerId);
  if (!a) return undefined;
  const r = ROTATIONS.find((x) => x.id === a.rotationId);
  if (!r) return undefined;
  const len = r.onDays + r.offDays;
  const pos = (((a.dayInCycle - 1 + offset) % len) + len) % len;
  const on = pos < r.onDays;
  return {
    rotName: r.name,
    site: SITES.find((s) => s.id === r.siteId)?.name ?? r.siteId,
    pos, len, on,
    backIn: on ? 0 : len - pos,
  };
};

/** The date the spine's "back on tour in Nd" actually lands on, counted from ROTATION_REF. */
const dateFromRef = (days: number) => {
  const d = new Date(REF_MS + days * DAY_MS);
  return `${WDAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};

/* ------------------------------- activities -------------------------------- */

type Audience = "all" | "desk" | "site";

type Activity = {
  key: string; label: string; noun: string; icon: string; tone: PfTone;
  audience: Audience; strict: boolean; blurb: string;
};

const ACTIVITIES: Activity[] = [
  {
    key: "allhands", label: "All-hands · 30 min", noun: "all-hands", icon: "megaphone", tone: "blue",
    audience: "all", strict: false,
    blurb: "Everyone invited, quorum enough. The question is which day reaches the most people without writing an invitation into somebody's rest week.",
  },
  {
    key: "squad", label: "Squad review · 60 min", noun: "squad review", icon: "clipboard", tone: "green",
    audience: "desk", strict: true,
    blurb: "The five desk-based colleagues, all of them. The rotation calendar has nothing to say about this one, and neither does the check-in — which is the honest answer, not a gap.",
  },
  {
    key: "toolbox", label: "HSE toolbox talk", noun: "toolbox talk", icon: "shield", tone: "yellow",
    audience: "site", strict: true,
    blurb: "Delivered at the site to the crew on tour. A toolbox talk with a third of the crew is not a toolbox talk, so this one needs all three or it moves.",
  },
  {
    key: "handover", label: "New-starter site walk", noun: "site walk", icon: "users", tone: "purple",
    audience: "all", strict: true,
    blurb: "Chidi Okeke is in month one and has not seen a site. It needs the crew on tour AND the desk colleagues free — the hardest bar on the page, and the one where the join earns its keep.",
  },
];

type PlanRow = {
  workerId: string; name: string; init: string; tone: string; role: string; source: string;
  ok: boolean; reason?: AwayReason; detail?: string; site?: string; known: boolean;
};

/**
 * The verdict for one activity on one day. Reads the rotation calendar and the
 * approved-leave window. It deliberately does NOT read a check-in: a check-in is a
 * statement about today and cannot be made about a day that has not happened.
 */
const planFor = (act: Activity, day: PlanDay): { rows: PlanRow[]; reachable: PlanRow[]; blocked: PlanRow[]; verdict: "yes" | "partly" | "no" } => {
  const pool = act.audience === "all" ? ROSTER : act.audience === "desk" ? DESK : SITE_CREW;
  const rows: PlanRow[] = pool.map((m) => {
    const base = { workerId: m.workerId, name: m.name, init: m.init, tone: m.tone, role: m.role, source: m.source };
    if (onLeave(m.workerId, day.iso)) {
      return { ...base, ok: false, reason: "On leave" as AwayReason, detail: "An approved leave covers this day.", known: true };
    }
    const rot = rotationAt(m.workerId, day.offset);
    if (rot) {
      return rot.on
        ? { ...base, ok: true, detail: `On tour · day ${rot.pos + 1} of ${rot.len} · ${rot.rotName}`, site: rot.site, known: true }
        : { ...base, ok: false, reason: "Off rotation" as AwayReason, detail: `Day ${rot.pos + 1} of ${rot.len} — back on tour in ${rot.backIn}d`, site: rot.site, known: true };
    }
    return { ...base, ok: true, detail: "No known blocker. Not a promise they will be there.", known: false };
  });
  const reachable = rows.filter((r) => r.ok);
  const blocked = rows.filter((r) => !r.ok);
  const verdict = blocked.length === 0 ? "yes" : act.strict ? "no" : reachable.length >= Math.ceil(rows.length * 0.75) ? "partly" : "no";
  return { rows, reachable, blocked, verdict };
};

const VERDICT_TONE: Record<"yes" | "partly" | "no", PfTone> = { yes: "green", partly: "yellow", no: "red" };
const VERDICT_WORD: Record<"yes" | "partly" | "no", string> = { yes: "Yes", partly: "Partly", no: "Not this day" };

/* ================================ small parts ============================== */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
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

function Empty({ icon = "search", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--pf-n25)", borderRadius: 10, margin: "14px 20px", padding: "26px 18px", textAlign: "center" }}>
      <Ic name={icon} size={20} color="var(--pf-n300)" />
      <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.55, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>{children}</div>
    </div>
  );
}

/** A disclosure that carries a basis. Used for team signals and the omission list. */
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
      {open && (
        <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 8, paddingLeft: 2 }}>{children}</div>
      )}
    </div>
  );
}

/**
 * The FR-093 affordance, rendered exactly as it is everywhere else in the product
 * — with one difference stated inside it: there is no model card here, because
 * nothing on this page is a model.
 */
function WhyThisDay({ act, day, basis, onAudit }: { act: Activity; day: PlanDay; basis: string[]; onAudit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ minWidth: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-purple-500)" />
        Why this day?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>
            {`${day.weekday} ${day.date} is proposed for the ${act.noun}.`}
          </div>
          <div style={{ marginTop: 11 }}><SectionLabel>Basis</SectionLabel></div>
          {basis.map((b, i) => (
            <div key={b} style={{ display: "flex", gap: 9, padding: "5px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", flex: "none", marginTop: 2 }}>{i + 1}</span>
              <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>{b}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)", flexWrap: "wrap" }}>
            <Ic name="robot" size={14} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5, flex: 1, minWidth: 240 }}>
              No model card, because no model ran. A cycle position is a modulo and a leave window is a date comparison — a
              crew clerk can re-derive every line above by hand, which is the only reason anyone will trust it at 05:30.
            </span>
            <PfBtn small variant="secondary" icon="shield" onClick={onAudit}>
              {`AI surface audit · ${AI_AUDIT.covered}/${AI_AUDIT.total}`}
            </PfBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ the day board ------------------------------ */

/** Grid-width labels. Shortened to fit a 52px cell, never shortened into a new meaning. */
const CELL_WORD: Record<CheckInMode, string> = {
  office: "Office", home: "Home", "client-site": "Client", field: "Field", travelling: "Travel", off: "Off",
};

const AWAY_WORD: Record<AwayReason, string> = {
  "On leave": "Leave",
  "Off rotation": "Off tour",
  "Off today": "Off",
  "Public holiday": "Holiday",
  "Not checked in": "No record",
};

const cellOf = (e: DayEntry): { label: string; tone: PfTone; solid: boolean } => {
  if (e.status === "in") {
    if (e.mode) return { label: CELL_WORD[e.mode], tone: modeMeta(e.mode).tone, solid: true };
    return { label: "On tour", tone: "green", solid: true };
  }
  const reason = e.awayReason ?? "Not checked in";
  return { label: AWAY_WORD[reason], tone: AWAY_TONE[reason], solid: false };
};

function BoardRow({ e, open, onToggle, onGo }: { e: DayEntry; open: boolean; onToggle: () => void; onGo: (s: string) => void }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const isMe = e.workerId === ME_ID;
  const mode = e.mode ? modeMeta(e.mode) : undefined;
  const sched = schedulableToday(e.workerId);
  const accent = e.status === "in" ? "var(--pf-primary-500)" : e.awayReason === "Off rotation" ? "var(--pf-purple-500)" : "var(--pf-n300)";
  const meaning = e.awayReason ? AWAY_MEANING[e.awayReason] : undefined;

  return (
    <div style={{ borderTop: "1px solid var(--pf-n50)", background: open ? "var(--pf-n25)" : "transparent" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: "1.75fr 1.05fr 1.5fr 1fr 34px", gap: 12, alignItems: "center",
          padding: "11px 20px 11px 17px", cursor: "pointer", borderLeft: `3px solid ${accent}`,
          background: hovered && !open ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ opacity: e.status === "in" ? 1 : 0.55, display: "inline-flex" }}>
            <PfAvatar init={e.init} tone={e.tone} size={32} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
              {isMe && <PfBadge tone="grey">You</PfBadge>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ fontFamily: "var(--mono)", color: "var(--pf-n300)" }}>{e.workerId}</span> · {e.role}
            </div>
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          {e.status === "in"
            ? <PfBadge tone={mode ? mode.tone : "green"} dot>{mode ? mode.short : "On tour"}</PfBadge>
            : <PfBadge tone={AWAY_TONE[e.awayReason ?? "Not checked in"]} dot>{e.awayReason}</PfBadge>}
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.source === "rotation" ? "Derived · rotation" : "Self-declared"}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: e.status === "in" ? "var(--pf-n600)" : "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.focus ?? e.site ?? e.awayDetail ?? (e.status === "away" ? "No detail, and none is asked for" : e.loc)}
          </div>
          {e.note && (
            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</div>
          )}
        </div>

        <div>
          {sched.ok
            ? <PfBadge tone="green">Reachable</PfBadge>
            : <PfBadge tone="grey">{sched.nextWindow ?? "Next window"}</PfBadge>}
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 3 }}>{e.dept}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--pf-n300)" }}>
          <Ic name={open ? "caretdown" : "caretright"} size={15} />
        </div>
      </div>

      {open && (
        <div style={{ padding: "0 20px 16px 20px", display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
              <Ic name={e.source === "rotation" ? "orbit" : "user"} size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                {e.source === "rotation" ? "Derived from the rotation calendar" : "Written by the person"}
              </span>
              <PfBadge tone="grey">{e.source === "rotation" ? "FR-090" : "FR-098"}</PfBadge>
            </div>

            {e.source === "rotation" ? (
              <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                {e.rotationName ? `${e.rotationName} at ${e.site}. ` : ""}
                {e.status === "in"
                  ? `${first(e.name)} is on tour and reachable at the site. There is no check-in behind this row and there never will be — asking someone to declare their location on a platform they are standing on is a measurement, not a status.`
                  : `${first(e.name)} is off tour${e.awayDetail ? ` — ${e.awayDetail}` : ""}. That is the calendar working. Nothing on this page treats it as an absence, nobody is notified, and no total counts it.`}
              </div>
            ) : (
              <div>
                {[
                  { k: "Mode", v: mode ? mode.label : e.awayReason ?? "—" },
                  { k: "Note", v: e.note ?? "None. Optional, and left blank." },
                  { k: "Focus", v: e.focus ?? "None. Optional, and left blank." },
                ].map((r) => (
                  <div key={r.k} style={{ display: "flex", gap: 12, padding: "5px 0" }}>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 52, flex: "none" }}>{r.k}</span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--pf-n50)" }}>
                  Three optional fields and a date. That is the entire record — nothing was verified against a badge, a VPN
                  session or a calendar, because a statement that can be found false stops being an easy one to make honestly.
                </div>
              </div>
            )}

            {meaning && (
              <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                <SectionLabel>What this status says, and what it refuses to</SectionLabel>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                  <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{meaning.says}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Ic name="x" size={13} color="var(--pf-n300)" weight={2.2} />
                  <span style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>{meaning.refuses}</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                <Ic name="calendar" size={15} color={sched.ok ? "var(--pf-primary-500)" : "var(--pf-n400)"} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Can anything be booked today?</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                {sched.ok
                  ? `Yes. Neither the approved-leave window nor the rotation calendar blocks ${first(e.name)} on ${PRESENCE_TODAY}.`
                  : `No — ${sched.why ?? "not this window"}. ${sched.nextWindow ? `The gate returns ${sched.nextWindow}, counted from the rotation calendar's own reference day (${dateFromRef(0)}).` : ""} Nothing is dropped; the next window is proposed instead.`}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 8 }}>
                {`Presence source: ${eligibilityFor(e.workerId) === "rotation" ? "rotation calendar, ingest only" : "self-declared check-in, optional and unverified"}.`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PfBtn small variant="secondary" icon="chat" onClick={() => toast(`Message opened to ${e.name} — ${e.status === "in" ? (mode ? mode.label.toLowerCase() : `on tour at ${e.site}`) : (e.awayReason ?? "away").toLowerCase()} today.`)}>
                Say hello
              </PfBtn>
              <PfBtn
                small variant="secondary" icon="calendar"
                onClick={() => toast(
                  sched.ok
                    ? `Window found for ${e.name} — reachable today, ${PRESENCE_TODAY}.`
                    : `Held for ${e.name} — ${sched.why ?? "not this window"}. Proposed for the next open window instead; nothing was written into it.`,
                  "success",
                )}
              >
                Find a window
              </PfBtn>
              {e.source === "rotation" && (
                <PfBtn small variant="ghost" icon="orbit" onClick={() => onGo("sites")}>Rotation calendar</PfBtn>
              )}
              {isMe && <PfBtn small variant="ghost" icon="file" onClick={() => onGo("myleave")}>My leave</PfBtn>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================= screen ================================== */

export default function WhosIn() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("today");

  /* --- today: my own check-in, the live take-flow --- */
  const [mine, setMine] = useState<{ mode: CheckInMode; note: string; focus: string } | null>(null);
  const [pick, setPick] = useState<CheckInMode | null>(null);
  const [note, setNote] = useState("");
  const [focus, setFocus] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showNever, setShowNever] = useState(false);
  const [showLog, setShowLog] = useState(false);

  /* --- today: the board --- */
  const [filter, setFilter] = useState("Everyone");
  const [q, setQ] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);

  /* --- the week --- */
  const [dayIso, setDayIso] = useState<string>(PRESENCE_TODAY_ISO);
  const [weekPop, setWeekPop] = useState("Everyone");

  /* --- coverage --- */
  const [actKey, setActKey] = useState(ACTIVITIES[0].key);
  const [planIso, setPlanIso] = useState<string | null>(null);
  const [held, setHeld] = useState<{ act: string; day: string } | null>(null);

  /* ------------------------- live board (spine + mine) ---------------------- */

  const entries: DayEntry[] = useMemo(() => {
    if (!mine) return TEAM_TODAY.entries;
    return TEAM_TODAY.entries.map((e) => {
      if (e.workerId !== ME_ID) return e;
      if (mine.mode === "off") {
        return { ...e, status: "away" as const, awayReason: "Off today" as AwayReason, mode: undefined, focus: undefined, note: mine.note || undefined, awayDetail: undefined };
      }
      return { ...e, status: "in" as const, mode: mine.mode, note: mine.note || undefined, focus: mine.focus || undefined, awayReason: undefined, awayDetail: undefined };
    });
  }, [mine]);

  const liveIn = entries.filter((e) => e.status === "in");
  const liveAway = entries.filter((e) => e.status === "away");
  const declaredToday = DECLARED_TODAY + (mine ? 1 : 0);
  /** Declared modes only — a rotation row has no mode by design, so it is counted separately. */
  const liveByMode = MODES.map((m) => ({ mode: m, n: liveIn.filter((e) => e.mode === m.key).length })).filter((r) => r.n > 0);
  const liveOnTour = liveIn.filter((e) => e.source === "rotation").length;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      const passFilter =
        filter === "Everyone" ? true
          : filter === "In" ? e.status === "in"
            : filter === "Away" ? e.status === "away"
              : e.source === "rotation";
      if (!passFilter) return false;
      if (!needle) return true;
      return `${e.name} ${e.role} ${e.dept} ${e.loc} ${e.workerId}`.toLowerCase().includes(needle);
    });
  }, [entries, filter, q]);

  const myEntry = entries.find((e) => e.workerId === ME_ID);
  const showPrompt = MY_TODAY_PENDING && !mine && !skipped;

  /* ------------------------------- the week -------------------------------- */

  const weekRoster = ROSTER.filter((m) =>
    weekPop === "Everyone" ? true : weekPop === "Desk-based" ? m.source === "check-in" : m.source === "rotation",
  );
  const selectedDay = WEEK.find((d) => d.iso === dayIso) ?? WEEK[WEEK.length - 1];

  /* ------------------------------- coverage -------------------------------- */

  const act = ACTIVITIES.find((a) => a.key === actKey) ?? ACTIVITIES[0];
  const plans = useMemo(() => PLAN_DAYS.map((d) => ({ day: d, ...planFor(act, d) })), [act]);
  const best = useMemo(() => {
    const ranked = [...plans].sort((a, b) => b.reachable.length - a.reachable.length || PLAN_DAYS.indexOf(a.day) - PLAN_DAYS.indexOf(b.day));
    return ranked[0];
  }, [plans]);
  const chosen = plans.find((p) => p.day.iso === planIso) ?? best;

  const planBasis = [
    `Take each of the ${plural(chosen.rows.length, "person")} in the audience for this ${act.noun}.`,
    `Read the FR-090 rotation calendar at ${chosen.day.weekday} ${chosen.day.date} — that is day ${chosen.day.offset} after the calendar's reference day, ${dateFromRef(0)}. A position below the on-tour length is reachable; anything above it is a rest window and nothing may be written into it.`,
    "Read the approved-leave windows over the same day. Only approved leave produces a block, and the block carries the category and nothing else — this step never reads the leave type.",
    "Do NOT read a check-in. A check-in is a statement about today; it cannot be made about a day that has not happened. Desk-based colleagues therefore carry no known blocker, which is not the same thing as a promise that they will be there.",
    `Rank the five candidate days by how many of the audience are reachable, then by the earliest date. ${act.strict ? "This activity needs everyone, so a single blocker moves the day." : "This activity takes a quorum, so a day short of one or two people can still stand."}`,
  ];

  /* -------------------------------- actions -------------------------------- */

  const saveCheckIn = () => {
    if (!pick) {
      toast("Pick where you are working first — six answers, and one of them is not working today.");
      return;
    }
    const m = modeMeta(pick);
    setMine({ mode: pick, note, focus });
    setEditing(false);
    setSkipped(false);
    toast(`Checked in — ${m.label.toLowerCase()}, ${PRESENCE_TODAY}. Your team can see the mode${focus ? " and your focus line" : ""}; nothing else was recorded.`, "success");
  };

  const clearCheckIn = () => {
    setMine(null);
    setPick(null);
    setNote("");
    setFocus("");
    setEditing(false);
    toast("Today's check-in removed. Your row reads Not checked in again — a fact about a form, not about you.");
  };

  const skipToday = () => {
    setSkipped(true);
    toast("Skipped. That is a valid state: it shows as Not checked in, nobody is notified, and no total counts it.");
  };

  const holdIt = () => {
    setHeld({ act: act.label, day: `${chosen.day.weekday} ${chosen.day.date}` });
    toast(
      chosen.blocked.length === 0
        ? `${act.label} held for ${chosen.day.weekday} ${chosen.day.date} — ${chosen.reachable.length} of ${chosen.rows.length} reachable, zero invitations written into a rest window or an approved-leave day.`
        : `${act.label} held for ${chosen.day.weekday} ${chosen.day.date} — ${chosen.reachable.length} of ${chosen.rows.length} reachable. ${plural(chosen.blocked.length, "colleague")} deferred with the next open window, not dropped.`,
      "success",
    );
  };

  /* --------------------------------- render -------------------------------- */

  const awayLine = (() => {
    const rot = liveAway.filter((e) => e.awayReason === "Off rotation");
    const lv = liveAway.filter((e) => e.awayReason === "On leave");
    const blank = liveAway.filter((e) => e.awayReason === "Not checked in" || e.awayReason === "Off today");
    if (liveAway.length === 0) return "Everyone on the board is reachable today — three self-declared, two on tour, and nobody off rotation or on leave.";
    const parts: string[] = [];
    if (rot.length) parts.push(`${rot.map((e) => e.name).join(" and ")} ${rot.length === 1 ? "is" : "are"} off tour on a rotation the calendar set months ago`);
    if (lv.length) parts.push(`${lv.map((e) => e.name).join(" and ")} ${lv.length === 1 ? "is" : "are"} on approved leave`);
    if (blank.length) parts.push(`${plural(blank.length, "row")} ${blank.length === 1 ? "is" : "are"} simply an unfilled form`);
    return `${plural(liveAway.length, "colleague")} away today, and not one of them absent: ${parts.join("; ")}. This page has no word for absent and nowhere to put one.`;
  })();

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Who&rsquo;s in</span>
            <PfBadge tone="grey">FR-085</PfBadge>
            <PfBadge tone="grey">FR-098</PfBadge>
            <PfBadge tone="blue" dot>{`Board read ${PRESENCE_TODAY}`}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, maxWidth: 800, lineHeight: 1.55 }}>
            Where to find your colleagues today, and which day next week actually works. Five people declare, three are read
            off the rotation calendar, and away carries a category and never a cause.
          </div>
        </div>
        <PfBtn variant="secondary" icon="shield" onClick={() => { setTab("today"); setShowLog(true); toast("Access log open — every read of this board is recorded, including yours."); }}>
          Access log
        </PfBtn>
        <PfBtn variant="primary" icon="calendar" onClick={() => { setTab("coverage"); toast(`Coverage planner open — ${act.label}, five candidate days.`); }}>
          Find a day
        </PfBtn>
      </div>

      {/* --------------------------------- KPIs --------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat
          icon="users" tone="green" label="In today"
          value={liveIn.length} unit={`of ${TEAM_TODAY.entries.length} colleagues`}
          delta={`${liveAway.length} away`} deltaTone="grey"
        />
        <PfStat
          icon="house" tone="blue" label="Self-declared"
          value={declaredToday} unit="check-ins today"
          delta={`of ${DESK.length} desk-based`} deltaTone="grey"
        />
        <PfStat
          icon="orbit" tone="purple" label="On tour"
          value={`${SPLIT.onSite}/${SITE_CREW.length}`} unit="site colleagues"
          delta="FR-090 join" deltaTone="purple"
        />
        <PfStat
          icon="shield" tone="yellow" label="Never collected"
          value={NEVER_COLLECTED.length} unit="signals refused"
          delta="P1" deltaTone="grey"
        />
      </div>

      {/* ------------------------------ lead insight ---------------------------- */}
      <PfBanner tone={liveAway.some((e) => e.awayReason === "Off rotation") ? "purple" : "green"} icon="orbit" cta="Rotations" onCta={() => go("sites")}>
        {awayLine}
      </PfBanner>

      {/* --------------------------------- tabs --------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "today", label: "Today", count: `${liveIn.length}/${TEAM_TODAY.entries.length}` },
            { key: "week", label: "The week", count: String(WORKING_DAYS.length) },
            { key: "coverage", label: "Coverage", count: String(PLAN_DAYS.length) },
          ]}
        />
      </div>

      {/* ================================= TODAY ================================= */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* ------------------------- my check-in take-flow ---------------------- */}
          <PfCard>
            <PfCardHead
              title={showPrompt || editing ? MY_PROMPT.headline : mine ? "Your check-in today" : "You skipped today"}
              sub={showPrompt || editing ? MY_PROMPT.body : mine ? "You wrote this, you can change it, and you can remove it." : PRESENCE_PROMISE.blank}
            >
              <PfBadge tone={mine ? "green" : "grey"} dot>{mine ? "Recorded" : "Optional"}</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 0 }}>
              <div style={{ padding: "14px 20px", borderRight: "1px solid var(--pf-n50)" }}>
                {(showPrompt || editing) ? (
                  <>
                    <Label hint="One tap. Six answers, and one of them is not working today.">Where are you working?</Label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                      {MODES.map((m) => (
                        <ModeChip key={m.key} mode={m.key} active={pick === m.key} onClick={() => setPick(m.key)} />
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <Label hint="Optional">Focus for the day</Label>
                        <input
                          value={focus}
                          onChange={(ev) => setFocus(ev.target.value)}
                          placeholder="e.g. Payments reliability — p95 latency"
                          style={INPUT}
                        />
                      </div>
                      <div>
                        <Label hint="Optional">A short note</Label>
                        <input
                          value={note}
                          onChange={(ev) => setNote(ev.target.value)}
                          placeholder="e.g. In for the anchor day"
                          style={INPUT}
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                      <PfBtn variant="primary" icon="check" onClick={saveCheckIn}>{editing ? "Save the change" : "Check in"}</PfBtn>
                      {editing
                        ? <PfBtn variant="secondary" icon="x" onClick={() => setEditing(false)}>Cancel</PfBtn>
                        : <PfBtn variant="secondary" icon="pause" onClick={skipToday}>Skip today</PfBtn>}
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1, minWidth: 200, lineHeight: 1.5 }}>
                        Nothing here is checked against a badge, a login or your calendar.
                      </span>
                    </div>
                  </>
                ) : mine ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <PfTile icon={modeMeta(mine.mode).icon} tone={modeMeta(mine.mode).tone} size={38} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>{modeMeta(mine.mode).label}</div>
                        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{`${ME_NAME} · ${PRESENCE_TODAY}`}</div>
                      </div>
                      <span style={{ flex: 1 }} />
                      <PfBadge tone={modeMeta(mine.mode).counts ? "green" : "grey"} dot>
                        {modeMeta(mine.mode).counts ? "Shows as in" : "Shows as away · Off today"}
                      </PfBadge>
                    </div>
                    {[
                      { k: "Focus", v: mine.focus || "Left blank — optional, and blank is fine." },
                      { k: "Note", v: mine.note || "Left blank — optional, and blank is fine." },
                    ].map((r) => (
                      <div key={r.k} style={{ display: "flex", gap: 12, padding: "5px 0" }}>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 46, flex: "none" }}>{r.k}</span>
                        <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{r.v}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <PfBtn small variant="secondary" icon="swap" onClick={() => { setPick(mine.mode); setEditing(true); }}>Change it</PfBtn>
                      <PfBtn small variant="ghost" icon="x" onClick={clearCheckIn}>Remove it</PfBtn>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                      <PfTile icon="pause" tone="grey" size={38} />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>Not checked in</div>
                        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{`${ME_NAME} · ${PRESENCE_TODAY}`}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>{PRESENCE_PROMISE.blank}</div>
                    <div style={{ marginTop: 12 }}>
                      <PfBtn small variant="secondary" icon="plus" onClick={() => { setSkipped(false); setEditing(true); }}>Check in after all</PfBtn>
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: "14px 20px", background: "var(--pf-n25)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <Ic name="shield" size={15} color="var(--pf-primary-500)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{PRESENCE_PROMISE.headline}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>{PRESENCE_PROMISE.body}</div>
                <div style={{ marginTop: 11 }}>
                  <PfBtn small variant="secondary" icon={showNever ? "caretdown" : "caretright"} onClick={() => setShowNever((v) => !v)}>
                    {showNever ? "Hide what is never collected" : `What this never collects · ${NEVER_COLLECTED.length}`}
                  </PfBtn>
                </div>
                {showNever && (
                  <div style={{ marginTop: 10, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
                    {NEVER_COLLECTED.map((n) => (
                      <div key={n} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                        <Ic name="x" size={12} color="var(--pf-red-500)" weight={2.2} />
                        <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{n}</span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--pf-n50)" }}>
                      This list is data, not marketing copy. It renders here because a privacy promise buried in a policy PDF
                      is a promise nobody reads.
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Foot icon="info">
              {`Your row on the board right now: ${myEntry?.status === "in" ? `in — ${myEntry.mode ? modeMeta(myEntry.mode).short.toLowerCase() : "on tour"}` : `away — ${myEntry?.awayReason ?? "not checked in"}`}. `}
              {`Check-in eligibility for ${ME_NAME}: ${eligibilityFor(ME_ID) === "check-in" ? "self-declared, because a Lagos desk role genuinely varies day to day" : "derived from the rotation calendar"}.`}
            </Foot>
          </PfCard>

          {/* ------------------------------ the board ----------------------------- */}
          <PfCard>
            <PfCardHead
              title="The board"
              sub={`${liveIn.length} in, ${liveAway.length} away, ${PRESENCE_TODAY}. Away rows are shaded and carry a category only — click one to see exactly what the status says and what it refuses to say.`}
            >
              <PfTabs tabs={["Everyone", "In", "Away", "On site"]} active={filter} onChange={setFilter} />
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <div style={{ position: "relative", width: 280 }}>
                <span style={{ position: "absolute", left: 10, top: 9, pointerEvents: "none" }}>
                  <Ic name="search" size={15} color="var(--pf-n300)" />
                </span>
                <input
                  value={q}
                  onChange={(ev) => setQ(ev.target.value)}
                  placeholder="Name, role, department, location"
                  style={{ ...INPUT, paddingLeft: 32, fontSize: 12.5 }}
                />
              </div>
              {liveByMode.map((r) => (
                <PfBadge key={r.mode.key} tone={r.mode.tone}>{`${r.n} ${r.mode.short.toLowerCase()}`}</PfBadge>
              ))}
              <PfBadge tone="green">{`${liveOnTour} on tour`}</PfBadge>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{`${visible.length} of ${entries.length} shown`}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.75fr 1.05fr 1.5fr 1fr 34px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Colleague</PfTh>
              <PfTh>Where</PfTh>
              <PfTh>What they said, if anything</PfTh>
              <PfTh>Bookable today</PfTh>
              <PfTh />
            </div>

            {visible.length === 0 ? (
              <Empty icon="search">
                {q.trim()
                  ? `Nobody on the board matches “${q.trim()}”. Eight people are tracked here — this is a team view, not a directory.`
                  : "Nothing in this filter today. That is a fact about the filter, not about anybody."}
              </Empty>
            ) : (
              visible.map((e) => (
                <BoardRow
                  key={e.workerId}
                  e={e}
                  open={openRow === e.workerId}
                  onToggle={() => setOpenRow((p) => (p === e.workerId ? null : e.workerId))}
                  onGo={go}
                />
              ))
            )}

            <Foot icon="orbit">
              Two presence sources on one board, and the difference is deliberate. A desk colleague writes their own row and
              may leave it blank; a site colleague&rsquo;s row is read off the rotation calendar and there is no check-in
              button for them at all. Asking a scaffolder to declare his location on a platform he is standing on would be
              surveillance dressed as a feature.
            </Foot>
          </PfCard>

          {/* --------------------- the boundary, rendered explicitly -------------- */}
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12 }}>
            <PfCard>
              <PfCardHead
                title="What away is allowed to mean"
                sub="The entire vocabulary, five words long. Every away status on this page comes out of one function and cannot say anything else."
              >
                <PfBadge tone="grey">P3</PfBadge>
              </PfCardHead>
              <div style={{ padding: "6px 20px 14px" }}>
                {AWAY_ORDER.map((r, i) => {
                  const n = liveAway.filter((e) => e.awayReason === r).length;
                  const m = AWAY_MEANING[r];
                  return (
                    <div key={r} style={{ padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <PfBadge tone={AWAY_TONE[r]} dot>{r}</PfBadge>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 11.5, color: n > 0 ? "var(--pf-n600)" : "var(--pf-n300)" }}>
                          {n > 0 ? `${plural(n, "row")} today` : "none today"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                        <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                        <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{m.says}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Ic name="x" size={13} color="var(--pf-n300)" weight={2.2} />
                        <span style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>{m.refuses}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Foot icon="shield">
                There is no sixth value and no free-text field beside it. A leave type cannot leak onto this board because the
                board has nowhere to put one.
              </Foot>
            </PfCard>

            <PfCard>
              <PfCardHead
                title="What the leave record holds"
                sub={`${plural(PRESENCE_LEAVE.length, "approved leave record")} overlaps this window. This is every field on it, and what the board reads.`}
              >
                <PfBadge tone="blue">{PRESENCE_LEAVE.map((l) => l.id).join(" · ")}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "6px 20px 14px" }}>
                {LEAVE_FIELDS.map((f, i) => (
                  <div key={f.field} style={{ padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", width: 78, flex: "none" }}>{f.field}</span>
                      {f.read
                        ? <PfBadge tone="green">read</PfBadge>
                        : <PfBadge tone="grey">not read</PfBadge>}
                      <span
                        title="Masked here on purpose — this file never reads the value."
                        style={{ flex: 1, letterSpacing: "2px", color: "var(--pf-n300)", fontSize: 12, overflow: "hidden", whiteSpace: "nowrap" }}
                      >
                        {f.read ? "approved" : "▮▮▮▮▮▮▮▮"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 5 }}>{f.note}</div>
                  </div>
                ))}
              </div>
              <Foot icon="info">
                The record is not hidden from the person it belongs to — she can read all of it on her own leave page. It is
                masked <em>here</em>, on a board seven colleagues can see, which is a different question.
              </Foot>
            </PfCard>
          </div>

          {/* ------------------------------ access log ---------------------------- */}
          <PfCard>
            <PfCardHead title="Who has read this board" sub={PRESENCE_ACCESS_NOTE}>
              <PfBadge tone="grey">{`${PRESENCE_ACCESS_LOG.length} reads`}</PfBadge>
              <PfBtn small variant="secondary" icon={showLog ? "caretdown" : "caretright"} onClick={() => setShowLog((v) => !v)}>
                {showLog ? "Hide the log" : "Show the log"}
              </PfBtn>
            </PfCardHead>
            {showLog && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "150px 1.2fr 1.2fr 1.4fr", gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
                  <PfTh>When</PfTh><PfTh>Who</PfTh><PfTh>Action</PfTh><PfTh>Scope</PfTh>
                </div>
                {PRESENCE_ACCESS_LOG.map((a) => (
                  <div key={`${a.at}-${a.action}`} style={{ display: "grid", gridTemplateColumns: "150px 1.2fr 1.2fr 1.4fr", gap: 12, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", alignItems: "center" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n400)" }}>{a.at}</span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n900)", fontWeight: a.who.startsWith("You") ? 600 : 400 }}>{a.who}</span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{a.action}</span>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{a.scope}</span>
                  </div>
                ))}
              </>
            )}
            <Foot icon="shield">
              {`Build check: ${AUDIT.checkIns} self-declared records across ${DESK.length} desk-based colleagues, ${AUDIT.rotationMembers} colleagues read off the rotation calendar, ${AUDIT.violations.length} violations. `}
              {AUDIT.clean
                ? "Clean means no site or field worker holds a self-declared check-in — the FR-089 line is proved by the data, not asserted in a comment."
                : AUDIT.violations.join(" · ")}
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ================================ THE WEEK =============================== */}
      {tab === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead
              title="Ten working days"
              sub={`${WORKING_DAYS[0].weekday} ${WORKING_DAYS[0].date} → ${WORKING_DAYS[WORKING_DAYS.length - 1].weekday} ${WORKING_DAYS[WORKING_DAYS.length - 1].date}. Weekends are omitted rather than zeroed. Click a column for that day.`}
            >
              <PfTabs tabs={["Everyone", "Desk-based", "On site"]} active={weekPop} onChange={setWeekPop} />
            </PfCardHead>

            <div style={{ padding: "14px 20px", overflowX: "auto" }}>
              <div style={{ minWidth: 860 }}>
                {/* header */}
                <div style={{ display: "grid", gridTemplateColumns: `170px repeat(${WORKING_DAYS.length}, minmax(0,1fr)) 40px`, gap: 4, alignItems: "end", marginBottom: 6 }}>
                  <PfTh>Colleague</PfTh>
                  {WORKING_DAYS.map((d) => {
                    const sel = d.iso === dayIso;
                    return (
                      <button
                        key={d.iso}
                        onClick={() => setDayIso(d.iso)}
                        title={`${d.weekday} ${d.date}${d.isToday ? " — today" : ""}`}
                        style={{
                          fontFamily: "inherit", border: "none", cursor: "pointer", padding: "5px 2px", borderRadius: 6,
                          background: sel ? "var(--pf-n900)" : "transparent", textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: sel ? "#fff" : d.isToday ? "var(--pf-n900)" : "var(--pf-n400)" }}>{d.weekday}</div>
                        <div style={{ fontSize: 10.5, color: sel ? "rgba(255,255,255,.7)" : "var(--pf-n300)", marginTop: 1 }}>{d.date.replace("Aug ", "")}</div>
                      </button>
                    );
                  })}
                  <PfTh style={{ textAlign: "right", color: "var(--pf-n300)" }}>—</PfTh>
                </div>

                {/* rows */}
                {weekRoster.map((m) => (
                  <WeekRow key={m.workerId} workerId={m.workerId} name={m.name} init={m.init} tone={m.tone} role={m.role} onPickDay={setDayIso} dayIso={dayIso} />
                ))}

                {/* column totals */}
                <div style={{ display: "grid", gridTemplateColumns: `170px repeat(${WORKING_DAYS.length}, minmax(0,1fr)) 40px`, gap: 4, alignItems: "center", marginTop: 8, paddingTop: 9, borderTop: "1px solid var(--pf-n50)" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>In that day</span>
                  {WEEK.map((d) => {
                    const n = d.in.filter((e) => weekRoster.some((m) => m.workerId === e.workerId)).length;
                    return (
                      <div key={d.iso} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{n}</div>
                        <div style={{ marginTop: 4, padding: "0 6px" }}>
                          <PfProgress pct={(n / Math.max(1, weekRoster.length)) * 100} height={4} tone="green" />
                        </div>
                      </div>
                    );
                  })}
                  <span
                    title="There is no row total on this grid. That is not an oversight — see the note below."
                    style={{ fontSize: 15, color: "var(--pf-n300)", textAlign: "right" }}
                  >
                    —
                  </span>
                </div>
              </div>
            </div>

            {/* legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Legend</span>
              {MODES.filter((m) => m.counts).map((m) => (
                <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: TONE[m.tone].bg }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>{m.short}</span>
                </span>
              ))}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: "var(--pf-primary-500)", border: "2px solid var(--pf-primary-100)" }} />
                <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>On tour · derived</span>
              </span>
              {AWAY_ORDER.filter((r) => r !== "Public holiday" && r !== "Off today").map((r) => (
                <span key={r} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: TONE[AWAY_TONE[r]].soft, border: `1px solid ${TONE[AWAY_TONE[r]].line}` }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>{r}</span>
                </span>
              ))}
            </div>

            <Foot icon="warning">
              <strong style={{ color: "var(--pf-n900)", fontWeight: 600 }}>Totals run down the columns and never across the rows.</strong>{" "}
              A column total is a fact about a day and it helps you plan one. A row total is a fact about a person, and within
              a week it is a ranking whatever the header calls it — with the longest commute, the youngest children and the
              least reliable power supply at home sitting at the bottom of it. The empty cell in the gutter is where that
              column would go.
            </Foot>
            <Foot icon="orbit">
              One honest limit. The board reads the rotation calendar at the calendar&rsquo;s own reference day, Fri Aug 7, and
              holds that position across the ten days. For a 28/28 that is exact — a 56-day cycle does not turn over inside a
              fortnight. For the 5/2 base pattern it is the pattern rather than the day. The coverage planner advances the
              cycle properly, because a planning question is about a day the calendar has not reached yet.
            </Foot>
          </PfCard>

          {/* ------------------------------ day detail ---------------------------- */}
          <PfCard>
            <PfCardHead
              title={`${selectedDay.weekday} ${selectedDay.date}`}
              sub={`${selectedDay.in.length} in, ${selectedDay.away.length} away. Read straight off the spine's day view — the same function that draws today.`}
            >
              {selectedDay.iso === PRESENCE_TODAY_ISO && <PfBadge tone="green" dot>Today</PfBadge>}
              <PfBtn small variant="secondary" icon="calendar" onClick={() => { setDayIso(PRESENCE_TODAY_ISO); toast(`Back to ${PRESENCE_TODAY}.`); }}>Back to today</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              <div style={{ padding: "14px 20px", borderRight: "1px solid var(--pf-n50)" }}>
                <SectionLabel>In · {selectedDay.in.length}</SectionLabel>
                {selectedDay.in.length === 0 && (
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
                    Nobody in on this day. Before you read anything into that, check the date — a working day where the whole
                    board is away is almost always a holiday the calendar has not been told about.
                  </div>
                )}
                {selectedDay.in.map((e) => (
                  <div key={e.workerId} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0" }}>
                    <PfAvatar init={e.init} tone={e.tone} size={24} />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n900)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <PfBadge tone={e.mode ? modeMeta(e.mode).tone : "green"}>{e.mode ? modeMeta(e.mode).short : "On tour"}</PfBadge>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px 20px" }}>
                <SectionLabel>Away · {selectedDay.away.length}</SectionLabel>
                {selectedDay.away.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
                    Nobody away. Every colleague on the board either declared a mode or was on tour.
                  </div>
                ) : (
                  selectedDay.away.map((e) => (
                    <div key={e.workerId} style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 0" }}>
                      <span style={{ opacity: 0.55, display: "inline-flex" }}><PfAvatar init={e.init} tone={e.tone} size={24} /></span>
                      <span style={{ fontSize: 12.5, color: "var(--pf-n500)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                      {e.awayDetail && <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{e.awayDetail}</span>}
                      <PfBadge tone={AWAY_TONE[e.awayReason ?? "Not checked in"]}>{e.awayReason}</PfBadge>
                    </div>
                  ))
                )}
              </div>
            </div>
          </PfCard>

          {/* --------------------------- team-level signals ----------------------- */}
          <PfCard>
            <PfCardHead
              title="Team-level signals"
              sub="Every figure here is about the group. There is no row that names a person and a count in the same breath."
            >
              <PfBadge tone="grey">P5</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 0 }}>
              {TEAM_SIGNALS.map((s, i) => (
                <div key={s.label} style={{ padding: "14px 20px", borderTop: i > 1 ? "1px solid var(--pf-n50)" : "none", borderRight: i % 2 === 0 ? "1px solid var(--pf-n50)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: TONE[s.tone].fg, letterSpacing: "-.3px" }}>{s.value}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.label}</span>
                  </div>
                  <div style={{ marginTop: 9 }}>
                    <Disclose label="Basis" tone={s.tone}>{s.basis}</Disclose>
                  </div>
                </div>
              ))}
            </div>
            <Foot icon="info">
              Check-in participation is a health signal for the tool and not a compliance measure for the people. A low number
              means the check-in is not worth their time, and the thing to fix is the check-in.
            </Foot>
          </PfCard>

          {/* ---------------------- the deliberate omissions ---------------------- */}
          <PfCard>
            <PfCardHead
              title="What a manager is not given here, and why"
              sub="A manager should be told what is missing and for what reason, rather than left to wonder whether it is hidden or simply not built."
            >
              <PfBadge tone="red">{`${MANAGER_NOT_SHOWN.length} refusals`}</PfBadge>
            </PfCardHead>
            <div style={{ padding: "6px 20px 14px" }}>
              {MANAGER_NOT_SHOWN.map((m, i) => (
                <div key={m.item} style={{ padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Ic name="x" size={14} color="var(--pf-red-500)" weight={2.2} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>{m.item}</span>
                  </div>
                  <div style={{ marginTop: 8, paddingLeft: 23 }}>
                    <Disclose label="Why not" tone="red">{m.why}</Disclose>
                  </div>
                </div>
              ))}
            </div>
          </PfCard>

          {/* ------------------------------ my pattern ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="Your own pattern"
              sub={`${MY_PATTERN.window}. This card is the other side of the refusals above — the same number, in the hands of the person it is about.`}
            >
              <PfBadge tone="purple" dot>Only you</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 0 }}>
              <div style={{ padding: "14px 20px", borderRight: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                  {[
                    { k: "Recorded", v: `${MY_PATTERN.recorded + (mine ? 1 : 0)}/${MY_PATTERN.days}`, note: mine ? "including today, just now" : "one open day: today" },
                    { k: "Office days", v: String(MY_PATTERN.officeDays + (mine?.mode === "office" ? 1 : 0)), note: "your count, nobody else's" },
                    { k: "Longest run", v: `${MY_PATTERN.longestStreak.n}d`, note: `${modeMeta(MY_PATTERN.longestStreak.mode).short.toLowerCase()} in a row` },
                  ].map((c) => (
                    <div key={c.k}>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</div>
                      <div style={{ fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", marginTop: 3 }}>{c.v}</div>
                      <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 3, lineHeight: 1.4 }}>{c.note}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14 }}>
                  <SectionLabel>How the ten days went</SectionLabel>
                  {MY_PATTERN.byMode.map((b) => (
                    <div key={b.mode.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
                      <span style={{ fontSize: 12, color: "var(--pf-n600)", width: 78, flex: "none" }}>{b.mode.short}</span>
                      <div style={{ flex: 1 }}>
                        <PfProgress pct={(b.n / MY_PATTERN.days) * 100} tone={b.mode.tone} height={6} />
                      </div>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n400)", width: 26, textAlign: "right" }}>{b.n}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ padding: "14px 20px" }}>
                <div style={{ background: "var(--pf-n25)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>{MY_PATTERN.observation}</div>
                </div>
                <div style={{ display: "flex", gap: 9, marginTop: 12 }}>
                  <Ic name="shield" size={14} color="var(--pf-purple-500)" />
                  <span style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>{MY_PATTERN.visibility}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="file" onClick={() => go("myleave")}>My leave</PfBtn>
                  <PfBtn small variant="ghost" icon="user" onClick={() => go("myprivacy")}>My data &amp; privacy</PfBtn>
                </div>
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================ COVERAGE =============================== */}
      {tab === "coverage" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead
              title="Can we hold this on Thursday?"
              sub={`Five candidate days, ${PLAN_DAYS[0].weekday} ${PLAN_DAYS[0].date} → ${PLAN_DAYS[PLAN_DAYS.length - 1].weekday} ${PLAN_DAYS[PLAN_DAYS.length - 1].date}. Pick what you are trying to hold and the planner answers off the rotation calendar and the approved-leave window.`}
            >
              {held && <PfBadge tone="green" dot>{`${held.act} · ${held.day}`}</PfBadge>}
              {held && <PfBtn small variant="ghost" icon="x" onClick={() => { setHeld(null); toast("Hold released. Nothing was ever written into a rest window to undo."); }}>Release</PfBtn>}
            </PfCardHead>

            {/* activity picker */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              {ACTIVITIES.map((a) => (
                <ActivityCard key={a.key} act={a} active={a.key === actKey} onSelect={() => { setActKey(a.key); setPlanIso(null); setHeld(null); }} />
              ))}
            </div>

            {/* day strip */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <SectionLabel>{`${act.audience === "desk" ? DESK.length : act.audience === "site" ? SITE_CREW.length : ROSTER.length} in the audience · ${act.strict ? "everyone needed" : "quorum is enough"}`}</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${PLAN_DAYS.length}, minmax(0,1fr))`, gap: 10 }}>
                {plans.map((p) => (
                  <DayCard
                    key={p.day.iso}
                    day={p.day}
                    reachable={p.reachable.length}
                    total={p.rows.length}
                    verdict={p.verdict}
                    active={p.day.iso === chosen.day.iso}
                    isBest={p.day.iso === best.day.iso}
                    onSelect={() => setPlanIso(p.day.iso)}
                  />
                ))}
              </div>
            </div>

            {/* the answer */}
            <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 18 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9, flexWrap: "wrap" }}>
                  <PfBadge tone={VERDICT_TONE[chosen.verdict]} dot>{VERDICT_WORD[chosen.verdict]}</PfBadge>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>
                    {`${act.label} · ${chosen.day.weekday} ${chosen.day.date}`}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                    {`${chosen.reachable.length} of ${chosen.rows.length} reachable`}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "11px 13px", borderRight: "1px solid var(--pf-n50)" }}>
                    <SectionLabel>Reachable</SectionLabel>
                    {chosen.reachable.length === 0
                      ? <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Nobody in this audience is reachable on this day.</div>
                      : chosen.reachable.map((r) => (
                        <div key={r.workerId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
                          <PfAvatar init={r.init} tone={r.tone} size={22} />
                          <span style={{ fontSize: 12, color: "var(--pf-n900)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                          {!r.known && <PfBadge tone="grey">no blocker known</PfBadge>}
                          {r.known && r.site && <PfBadge tone="green">on tour</PfBadge>}
                        </div>
                      ))}
                  </div>
                  <div style={{ padding: "11px 13px" }}>
                    <SectionLabel>Not this day</SectionLabel>
                    {chosen.blocked.length === 0
                      ? <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>Nothing blocks anyone. No rest window, no approved leave.</div>
                      : chosen.blocked.map((r) => (
                        <div key={r.workerId} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0" }}>
                          <span style={{ opacity: 0.55, display: "inline-flex" }}><PfAvatar init={r.init} tone={r.tone} size={22} /></span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: 12, color: "var(--pf-n500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                              <PfBadge tone={AWAY_TONE[r.reason ?? "Not checked in"]}>{r.reason}</PfBadge>
                            </div>
                            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{r.detail}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="calendar" onClick={holdIt}>{`Hold ${chosen.day.weekday} ${chosen.day.date}`}</PfBtn>
                  <PfBtn variant="secondary" icon="orbit" onClick={() => go("sites")}>Rotation calendars</PfBtn>
                  <WhyThisDay act={act} day={chosen.day} basis={planBasis} onAudit={() => go("aisurfaces")} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "var(--pf-n25)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <Ic name="info" size={15} color="var(--pf-n400)" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>What this planner will not do</span>
                  </div>
                  {[
                    "Guess whether a desk-based colleague will be in the office next Thursday. It has no basis for that and would be inventing one.",
                    "Treat “not checked in” as a blocker. It blocks nothing, here or anywhere else.",
                    "Rank people by how available they were. The output is a day, not a shortlist of the reliable.",
                    "Drop anyone. A blocked colleague comes back with the date their window opens.",
                  ].map((t) => (
                    <div key={t} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                      <Ic name="x" size={12} color="var(--pf-n300)" weight={2.2} />
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{t}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <Ic name="orbit" size={15} color="var(--pf-purple-500)" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>The 24 days, resolved</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                    {`Today's board says Seyi Ajayi is back on tour in 24 days. That count runs from the rotation calendar's own reference day, ${dateFromRef(0)} — so it lands on ${dateFromRef(24)}, the first day in this planner. He is not lost for a month; he is back on Monday, and the planner has him.`}
                  </div>
                </div>
              </div>
            </div>

            <Foot icon="orbit">{ROTATION_FEED_NOTE}</Foot>
          </PfCard>

          {/* ------------------------ full grid for this activity ---------------- */}
          <PfCard>
            <PfCardHead
              title="Every candidate day, every person"
              sub={`${act.label}. Site colleagues are read off the advanced rotation position; desk colleagues carry no known blocker, which the grid marks rather than fills in.`}
            >
              <PfBadge tone="grey">Derived from FR-090</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 20px", overflowX: "auto" }}>
              <div style={{ minWidth: 640 }}>
                <div style={{ display: "grid", gridTemplateColumns: `200px repeat(${PLAN_DAYS.length}, minmax(0,1fr))`, gap: 5, marginBottom: 6 }}>
                  <PfTh>Colleague</PfTh>
                  {PLAN_DAYS.map((d) => (
                    <PfTh key={d.iso} style={{ textAlign: "center" }}>{`${d.weekday} ${d.date.split(" ")[1]}`}</PfTh>
                  ))}
                </div>
                {(act.audience === "desk" ? DESK : act.audience === "site" ? SITE_CREW : ROSTER).map((m) => (
                  <div key={m.workerId} style={{ display: "grid", gridTemplateColumns: `200px repeat(${PLAN_DAYS.length}, minmax(0,1fr))`, gap: 5, alignItems: "center", padding: "4px 0", borderTop: "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <PfAvatar init={m.init} tone={m.tone} size={22} />
                      <span style={{ fontSize: 12, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    </div>
                    {plans.map((p) => {
                      const row = p.rows.find((r) => r.workerId === m.workerId);
                      if (!row) return <div key={p.day.iso} />;
                      const tone: PfTone = row.ok ? (row.known ? "green" : "grey") : AWAY_TONE[row.reason ?? "Not checked in"];
                      return (
                        <div
                          key={p.day.iso}
                          title={`${row.name} · ${p.day.weekday} ${p.day.date} — ${row.ok ? "reachable" : row.reason}. ${row.detail ?? ""}`}
                          style={{
                            height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 600, letterSpacing: ".2px",
                            background: row.ok && row.known ? TONE[tone].bg : TONE[tone].soft,
                            color: row.ok && row.known ? "#fff" : TONE[tone].fg,
                            border: `1px solid ${TONE[tone].line}`,
                          }}
                        >
                          {row.ok ? (row.known ? "ON TOUR" : "OPEN") : row.reason === "On leave" ? "LEAVE" : "OFF TOUR"}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <Foot icon="info">
              <strong style={{ color: "var(--pf-n900)", fontWeight: 600 }}>OPEN is not IN.</strong>{" "}
              It means no rotation window and no approved leave stands in the way — the strongest true statement anyone can
              make about a desk-based colleague on a day that has not happened. Filling that cell with a guess would make the
              grid look more useful and be less true.
            </Foot>
          </PfCard>

          {/* --------------------------- who declares, who is derived ------------ */}
          <PfCard>
            <PfCardHead
              title="Who declares, and who is derived"
              sub="Two populations, two sources, and the line between them moved in one direction only."
            >
              <PfBadge tone="grey">FR-089 · FR-098</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {CHECKIN_ELIGIBILITY.map((r, i) => (
                <div key={r.population} style={{ padding: "14px 20px", borderRight: i === 0 ? "1px solid var(--pf-n50)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <PfTile icon={r.source === "check-in" ? "user" : "orbit"} tone={r.source === "check-in" ? "blue" : "purple"} size={28} />
                    <PfBadge tone={r.source === "check-in" ? "blue" : "purple"}>{r.source === "check-in" ? "Self-declared" : "Derived · ingest only"}</PfBadge>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                      {`${r.source === "check-in" ? DESK.length : SITE_CREW.length} on this board`}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5, marginBottom: 6 }}>{r.population}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>{r.why}</div>
                </div>
              ))}
            </div>
            <Foot icon="shield">
              A geofenced clock-in is a measurement taken of a worker; it happens whether they participate or not. A
              self-declared &ldquo;working from home today&rdquo; is a statement made by a worker to their colleagues. They
              produce similar-looking rows and they are not the same product, which is why only one of them exists here.
            </Foot>
          </PfCard>
        </div>
      )}
    </div>
  );
}

/* ============================== sub-components ============================= */

function ModeChip({ mode, active, onClick }: { mode: CheckInMode; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const m = modeMeta(mode);
  const t = TONE[m.tone];
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
        fontSize: 12.5, fontWeight: 500, padding: "8px 12px", borderRadius: 9,
        background: active ? t.soft : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        color: active ? t.fg : "var(--pf-n600)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`,
        boxShadow: active ? `0 0 0 1px ${t.line}` : "0 0 0 0.5px rgba(42,42,42,.06)",
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      <Ic name={m.icon} size={15} color={active ? t.fg : "var(--pf-n400)"} />
      {m.label}
      {!m.counts && <PfBadge tone="grey">not presence</PfBadge>}
    </button>
  );
}

function WeekRow({ workerId, name, init, tone, role, dayIso, onPickDay }: {
  workerId: string; name: string; init: string; tone: string; role: string; dayIso: string; onPickDay: (iso: string) => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: `170px repeat(${WORKING_DAYS.length}, minmax(0,1fr)) 40px`, gap: 4,
        alignItems: "center", padding: "4px 0", borderTop: "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, paddingRight: 8 }}>
        <PfAvatar init={init} tone={tone} size={24} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 10.5, color: "var(--pf-n300)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role}</div>
        </div>
      </div>
      {WEEK.map((d) => {
        const e = d.entries.find((x) => x.workerId === workerId);
        if (!e) return <div key={d.iso} />;
        const c = cellOf(e);
        const t = TONE[c.tone];
        const sel = d.iso === dayIso;
        return (
          <button
            key={d.iso}
            onClick={() => onPickDay(d.iso)}
            title={`${name} · ${d.weekday} ${d.date} — ${e.status === "in" ? (e.mode ? modeMeta(e.mode).label : `on tour at ${e.site}`) : e.awayReason}${e.awayDetail ? ` (${e.awayDetail})` : ""}`}
            style={{
              fontFamily: "inherit", cursor: "pointer", height: 28, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9.5, fontWeight: 600, letterSpacing: ".2px",
              background: c.solid ? t.bg : t.soft,
              color: c.solid ? "#fff" : t.fg,
              border: `1px solid ${sel ? "var(--pf-n900)" : c.solid ? t.bg : t.line}`,
              opacity: c.solid ? 1 : 0.92,
              overflow: "hidden", whiteSpace: "nowrap", padding: "0 3px",
            }}
          >
            {c.label}
          </button>
        );
      })}
      <span
        title="No row total. A row total is a fact about a person and becomes a ranking within a week."
        style={{ fontSize: 13, color: "var(--pf-n300)", textAlign: "right" }}
      >
        —
      </span>
    </div>
  );
}

function ActivityCard({ act, active, onSelect }: { act: Activity; active: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        background: active ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
        boxShadow: active ? "0 0 0 1px var(--pf-primary-500)" : "0 0 0 0.5px rgba(42,42,42,.06)",
        borderRadius: 11, padding: 12, cursor: "pointer", transition: "border-color .12s ease, background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <PfTile icon={act.icon} tone={act.tone} size={28} />
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35, minWidth: 0 }}>{act.label}</div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <PfBadge tone="grey">{act.audience === "all" ? "Everyone" : act.audience === "desk" ? "Desk-based" : "Site crew"}</PfBadge>
        <PfBadge tone={act.strict ? "yellow" : "blue"}>{act.strict ? "All of them" : "Quorum"}</PfBadge>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{act.blurb}</div>
    </div>
  );
}

function DayCard({ day, reachable, total, verdict, active, isBest, onSelect }: {
  day: PlanDay; reachable: number; total: number; verdict: "yes" | "partly" | "no"; active: boolean; isBest: boolean; onSelect: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[VERDICT_TONE[verdict]];
  return (
    <button
      {...hoverProps}
      onClick={onSelect}
      style={{
        fontFamily: "inherit", cursor: "pointer", textAlign: "left", borderRadius: 11, padding: "11px 12px",
        background: active ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-n900)" : "var(--pf-n50)"}`,
        boxShadow: active ? "0 0 0 1px var(--pf-n900)" : "0 0 0 0.5px rgba(42,42,42,.06)",
        transition: "border-color .12s ease, background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{day.weekday}</span>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{day.date}</span>
        {isBest && <span style={{ marginLeft: "auto" }}><Ic name="star" size={12} color="var(--pf-primary-500)" /></span>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 7 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: t.fg, letterSpacing: "-.3px" }}>{reachable}</span>
        <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>{`of ${total}`}</span>
      </div>
      <div style={{ marginTop: 7 }}>
        <PfProgress pct={(reachable / Math.max(1, total)) * 100} tone={VERDICT_TONE[verdict]} height={5} />
      </div>
      <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 6 }}>{VERDICT_WORD[verdict]}</div>
    </button>
  );
}
