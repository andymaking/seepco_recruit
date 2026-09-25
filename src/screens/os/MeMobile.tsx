"use client";
import { useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast, type ToastTone } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfPageTabs, PfTh, PfBanner, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_ONEONONE, MY_CYCLE, MY_PLAN, MY_MATCHES,
  MY_LEARNING, MY_UP_NEXT, MY_PAYSLIPS, MY_NUDGE_GOAL, MY_NOTIFICATIONS,
  MY_CONSENT, MY_CACHED_COUNT, MY_SHELL_KB, type MyGoal,
} from "@/data/me";

/**
 * Mobile companion — /my-mobile (PRD FR-078), the Me pillar's eleventh page.
 *
 * The 375×740 phone frame used to BE the employee's entire product surface: one
 * mockup standing in for a person who had no web pages. Now that she has ten,
 * the frame is what it always was — a preview of a companion, not the product.
 *
 * The structural change that makes it worth previewing: its state is no longer
 * local `useState`. Connectivity, the outbox and the goals all come from
 * `useMe()`, so a check-in tapped on the phone here is the SAME check-in that
 * renders on /my-goals, survives navigation and shows up in the /my-privacy
 * audit trail. A preview that forgets is a screenshot; this one remembers.
 *
 * Nothing on this page is an org rollup — no delivery %, no adoption %, no
 * opt-in %, no headcount. Those belong to whoever runs the rollout, not to the
 * person holding the phone. What is hers: her shell size, her cached surfaces,
 * her outbox and her consent under clause c4.
 */

/* --------------------------------- consts ---------------------------------- */

const MGR_FIRST = MY_MANAGER.name.split(" ")[0];

/** Clause c4 is the lawful basis for every nudge this page can send. */
const C4 = MY_CONSENT.clauses.find((c) => c.id === "c4")!;

type PhoneTab = "home" | "goals" | "learn" | "me";

const PHONE_TABS: { id: PhoneTab; icon: string; label: string }[] = [
  { id: "home", icon: "house", label: "Home" },
  { id: "goals", icon: "target", label: "Goals" },
  { id: "learn", icon: "book", label: "Learn" },
  { id: "me", icon: "user", label: "Me" },
];

type ChannelKey = "whatsapp" | "sms" | "emailDigest";

const CHANNEL_ROWS: { key: ChannelKey; icon: string; tone: PfTone; label: string; sub: string; off: string }[] = [
  { key: "whatsapp", icon: "chat", tone: "green", label: "WhatsApp", sub: "Goal, review and learning nudges that deep-link into the companion.", off: "Nudges stop reaching WhatsApp — they wait for you in the app instead." },
  { key: "sms", icon: "megaphone", tone: "yellow", label: "SMS fallback", sub: "Sent 15 minutes after a WhatsApp nudge that never delivered.", off: "An undelivered WhatsApp nudge will simply not arrive." },
  { key: "emailDigest", icon: "file", tone: "blue", label: "Weekly email digest", sub: "One Monday summary to your work email — never per-event mail.", off: "No Monday summary; per-event nudges are unaffected." },
];

/** What the phone carries vs where the whole thing lives. */
const MIRRORS: { icon: string; tone: PfTone; label: string; phone: string; web: string; go: string }[] = [
  { icon: "target", tone: "green", label: "Goals", phone: "Check in with the ± stepper", web: "Key results, your ladder and check-in history", go: "mygoals" },
  { icon: "clipboard", tone: "yellow", label: "Review", phone: `A reminder that it closes ${MY_CYCLE.closes}`, web: "Scoring yourself against the five competencies", go: "myreview" },
  { icon: "book", tone: "purple", label: "Learning", phone: "Resume the module you downloaded", web: "Your entitlement, approvals and recommendations", go: "mylearning" },
  { icon: "trend", tone: "blue", label: "Growth", phone: "The readiness ring, nothing more", web: "Gap map, milestones and assessments", go: "mygrowth" },
  { icon: "megaphone", tone: "green", label: "Feedback", phone: "Give or request in two taps", web: "The full thread, and who can see each note", go: "myfeedback" },
];

/** The four surfaces the service worker keeps — this list IS MY_CACHED_COUNT. */
const CACHED_SURFACES: { icon: string; tone: PfTone; label: string; sub: string; go: string }[] = [
  { icon: "house", tone: "green", label: "My week", sub: `Your 1-on-1 with ${MGR_FIRST} and the ${MY_CYCLE.name} close date`, go: "me" },
  { icon: "target", tone: "blue", label: "My goals & check-ins", sub: "Editable offline — every check-in queues in your outbox", go: "mygoals" },
  { icon: "book", tone: "purple", label: MY_LEARNING[0].title, sub: `${MY_LEARNING[0].module} · downloaded for offline`, go: "mylearning" },
  { icon: "wallet", tone: "yellow", label: `${MY_PAYSLIPS[0].period} payslip`, sub: "Index only — the document itself opens via SeamlessHR online", go: "myprofile" },
];

const BANDWIDTH_FACTS: [string, string][] = [
  ["Shell — HTML, CSS and JS", `${MY_SHELL_KB}KB`],
  ["Payload budget", "500KB"],
  ["First paint on 2G", "under 6s"],
  ["Install route", "Add to home screen — no app store"],
];

const SMS_MOCK = "TALENT-OS: Your Q2 self-review closes Fri. Open: t-os.ng/r/8kq2";

const shortName = (t: string) => t.split(" — ")[0];

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/* --------------------------- phone-frame primitives ------------------------ */
/* The small type scale (11–12.5px) below is deliberate: it is phone type, and
   it stays phone type inside the bezel. Page-level type resumes outside it.   */

/** White card inside the phone screen. */
function PCard({ title, right, children, pad = 12 }: { title?: ReactNode; right?: ReactNode; children: ReactNode; pad?: number | string }) {
  return (
    <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 12, boxShadow: "0 1px 3px 0 #f3f3f3" }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 0" }}>
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</span>
          {right}
        </div>
      )}
      <div style={{ padding: pad, paddingTop: title ? 8 : pad }}>{children}</div>
    </div>
  );
}

function WeekRow({ icon, tone, title, sub, chip, chipTone, onClick, last }: {
  icon: string; tone: PfTone; title: string; sub: string; chip: string; chipTone: PfTone; onClick: () => void; last?: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 6px", borderRadius: 8, cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfTile icon={icon} tone={tone} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{sub}</div>
      </div>
      <PfBadge tone={chipTone}>{chip}</PfBadge>
    </div>
  );
}

/** Goal row with the tap-to-open ±2pp stepper — the companion's whole reason to exist. */
function GoalItem({ g, highlighted, onSave, last }: { g: MyGoal; highlighted: boolean; onSave: (g: MyGoal, pct: number) => void; last?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(g.pct);
  const { hovered, hoverProps } = useHover();

  const openEditor = () => { setPending(g.pct); setEditing(!editing); };
  const stepBtn = (dir: -1 | 1, disabled: boolean) => (
    <button
      onClick={() => setPending((p) => Math.max(0, Math.min(100, p + dir * 2)))}
      disabled={disabled}
      style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", color: disabled ? "var(--pf-n300)" : "var(--pf-n900)", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", lineHeight: 1 }}
    >
      {dir < 0 ? "−" : "+"}
    </button>
  );

  return (
    <div
      {...hoverProps}
      style={{ padding: "9px 6px", borderRadius: 8, borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: highlighted ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "transparent", transition: "background .15s ease", boxShadow: highlighted ? "inset 0 0 0 1px var(--pf-primary-100)" : "none" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", minWidth: 0 }}>{g.title}</span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{g.pct}%</span>
      </div>
      <div style={{ marginTop: 7 }}><PfProgress pct={g.pct} tone={g.tone} height={6} /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
        <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Due {g.due}</span>
        <PfBadge tone={g.tone}>{g.status}</PfBadge>
        {g.fresh && <PfBadge tone="blue">via WhatsApp</PfBadge>}
        <span style={{ flex: 1 }} />
        <PfBtn small variant={editing ? "ghost" : "secondary"} onClick={openEditor}>{editing ? "Close" : "Check-in"}</PfBtn>
      </div>
      {editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, animation: "scIn .18s ease" }}>
          {stepBtn(-1, pending <= 0)}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", width: 38, textAlign: "center" }}>{pending}%</span>
          {stepBtn(1, pending >= 100)}
          <span style={{ flex: 1, fontSize: 10.5, color: "var(--pf-n400)" }}>{pending === g.pct ? "no change" : `${pending > g.pct ? "+" : ""}${pending - g.pct}pp this week`}</span>
          <PfBtn small variant="primary" onClick={() => { onSave(g, pending); setEditing(false); }}>Save</PfBtn>
        </div>
      )}
    </div>
  );
}

/** Staff-readiness donut (SVG ring). */
function Ring({ pct, size = 74 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-n50)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-primary-500)" strokeWidth={8} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .4s ease" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{pct}%</span>
    </div>
  );
}

function PayslipRow({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", borderRadius: 8, padding: 2, background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfTile icon="wallet" tone="green" size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_PAYSLIPS[0].period} payslip</div>
        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>via SeamlessHR ↗ · issued {MY_PAYSLIPS[0].at}</div>
      </div>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </div>
  );
}

/* ------------------------------ page primitives ---------------------------- */

/** WhatsApp bubble — her side of the thread, with the read receipt. */
function Bubble({ text, time }: { text: string; time: string }) {
  return (
    <div style={{ alignSelf: "flex-end", maxWidth: "88%", background: "var(--pf-primary-50)", border: "0.6px solid var(--pf-primary-100)", borderRadius: 10, borderTopRightRadius: 3, padding: "8px 10px" }}>
      <div style={{ fontSize: 12.5, color: "var(--pf-n900)", lineHeight: 1.45 }}>{text}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 3, fontSize: 10, color: "var(--pf-n400)" }}>
        {time} <span style={{ color: "var(--pf-primary-500)", fontWeight: 600 }}>✓✓</span>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{ position: "relative", width: 38, height: 22, borderRadius: 99, flex: "none", cursor: "pointer", padding: 0, background: on ? "var(--pf-primary-500)" : "var(--pf-n50)", border: `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`, transition: "background .15s ease, border-color .15s ease" }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(2,6,23,.25)", transition: "left .15s ease" }} />
    </button>
  );
}

/** Clickable row that leaves the companion for the full web page. */
function LinkRow({ icon, tone, title, sub, cta, onClick, last }: {
  icon: string; tone: PfTone; title: ReactNode; sub: ReactNode; cta?: string; onClick: () => void; last?: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfTile icon={icon} tone={tone} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>{sub}</div>
      </div>
      {cta && <span style={{ fontSize: 12, fontWeight: 500, color: hovered ? "var(--pf-n600)" : "var(--pf-n400)", flex: "none" }}>{cta}</span>}
      <Ic name="caretright" size={14} color={hovered ? "var(--pf-n500)" : "var(--pf-n300)"} />
    </div>
  );
}

function FactRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n500)" }}>{k}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{v}</span>
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function MeMobile() {
  const go = useGo();
  const toast = useToast();

  /* One store, two surfaces: the phone below and your web pages share it. */
  const { goals, checkIn, addGoal, selfScores, online, setOnline, outbox, queue, flush, clearCache, channels, setChannel } = useMe();

  const [tab, setTab] = useState("preview");
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("home");
  const [nudgePending, setNudgePending] = useState(false);
  const [nudgesSent, setNudgesSent] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(null);

  const channelsOn = CHANNEL_ROWS.filter((c) => channels[c.key]).length;
  const unscored = selfScores.filter((s) => s === 0).length;
  const queued = outbox.length;

  /* An action taken in the preview either lands or waits — never silently fails. */
  const actOrQueue = (label: string, msg: string, tone: ToastTone = "success") => {
    if (online) { toast(msg, tone); return; }
    queue(label);
    toast(`Queued — syncs when you are back online · ${label}`);
  };

  const toggleOnline = () => {
    if (online) {
      setOnline(false);
      toast(`Offline — your companion is serving ${MY_CACHED_COUNT} cached surfaces`);
      return;
    }
    const n = queued;
    setOnline(true);
    toast(n ? `Back online — ${n} queued ${plural(n, "change", "changes")} synced` : "Back online — nothing was waiting in your outbox", "success");
  };

  /* The point of the split: this check-in is the one /my-goals renders. */
  const saveCheckin = (g: MyGoal, pct: number) => {
    if (pct === g.pct) { toast("Nothing to save — the percentage has not moved"); return; }
    checkIn(g.id, pct);
    setHighlight((h) => (h === g.id ? null : h));
    if (online) toast(`Check-in saved — ${shortName(g.title)} at ${pct}% · now on your goals page`, "success");
    else toast(`Queued — check-in · ${shortName(g.title)} → ${pct}%`);
  };

  const sendNudge = () => {
    if (nudgePending) {
      setTab("preview");
      toast("A nudge is already waiting on the phone — tap the banner to deep-link");
      return;
    }
    setNudgePending(true);
    setNudgesSent((n) => n + 1);
    addGoal(MY_NUDGE_GOAL);
    setTab("preview");
    toast(`Test nudge delivered — “${MY_NUDGE_GOAL.title}” is on your phone preview`, "success");
  };

  const openNudge = () => {
    setNudgePending(false);
    setPhoneTab("goals");
    setHighlight(MY_NUDGE_GOAL.id);
    toast("Deep-link opened Goals in the companion — no app store in the way", "success");
  };

  const flipChannel = (c: (typeof CHANNEL_ROWS)[number]) => {
    const next = !channels[c.key];
    setChannel(c.key, next);
    toast(next ? `${c.label} nudges on — under consent clause c4` : `${c.label} off — ${c.off}`, next ? "success" : "danger");
  };

  const syncOutbox = () => {
    if (!queued) { toast("Your outbox is already empty"); return; }
    flush();
    toast(`Synced ${queued} queued ${plural(queued, "change", "changes")} — logged in your privacy trail`, "success");
  };

  const wipeCache = () => {
    clearCache();
    toast(`Offline cache cleared — your ${MY_CACHED_COUNT} surfaces re-download on the next connection`, "danger");
  };

  /* ------------------------------ phone content ----------------------------- */

  const goalsCard = (sub?: string) => (
    <PCard title="My goals" right={<span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{goals.length} active</span>}>
      {sub && <div style={{ fontSize: 11, color: "var(--pf-n400)", margin: "0 0 4px 6px" }}>{sub}</div>}
      {goals.map((g, i) => (
        <GoalItem key={g.id} g={g} highlighted={highlight === g.id} onSave={saveCheckin} last={i === goals.length - 1} />
      ))}
    </PCard>
  );

  const learningCard = (
    <PCard title="Learning" right={MY_LEARNING[0].offline ? <PfBadge tone="grey">Offline-ready</PfBadge> : undefined}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_LEARNING[0].title}</div>
      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{MY_LEARNING[0].module} · downloaded for offline</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <div style={{ flex: 1 }}><PfProgress pct={MY_LEARNING[0].pct} height={6} /></div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_LEARNING[0].pct}%</span>
        <PfBtn small variant="primary" icon="play" onClick={() => actOrQueue(
          `learning progress · ${shortName(MY_LEARNING[0].title)}`,
          `Resuming ${shortName(MY_LEARNING[0].title)} — ${MY_LEARNING[0].module}`,
        )}>Resume</PfBtn>
      </div>
    </PCard>
  );

  const payslipCard = (
    <PCard>
      <PayslipRow onClick={() =>
        online
          ? toast(`Opening your ${MY_PAYSLIPS[0].period} payslip via SeamlessHR — secure tab`, "success")
          : toast("Your payslip needs a connection — the link is saved for when you are back")
      } />
    </PCard>
  );

  const homeTab = (
    <>
      <PCard title="My week" right={<PfBadge tone="grey">2 items</PfBadge>}>
        <WeekRow
          icon="calendar" tone="blue"
          title={`1-on-1 with ${MGR_FIRST}`}
          sub={`${MY_ONEONONE.time} — ${MY_ONEONONE.agenda.length} agenda items`}
          chip="Agenda ready" chipTone="blue"
          onClick={() => toast(`Your agenda with ${MY_MANAGER.name} — ${MY_ONEONONE.agenda[0]}`)}
        />
        <WeekRow
          icon="file" tone="yellow"
          title="Your review closes"
          sub={`${MY_CYCLE.closes} — ${MY_CYCLE.name}`}
          chip={unscored ? `${unscored} to score` : "Self done ✓"} chipTone={unscored ? "yellow" : "green"} last
          onClick={() => toast(unscored ? `${unscored} ${plural(unscored, "competency", "competencies")} still unscored — finish on My review` : "Your self-assessment is complete")}
        />
      </PCard>
      {goalsCard()}
      <PCard title="My growth">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Ring pct={MY_PLAN.readiness} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_PLAN.target} readiness</div>
            <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.4 }}>An estimate — you can ask what it was based on</div>
            <button
              onClick={() => toast(`${MY_MATCHES[0].role} — ${MY_MATCHES[0].match}% match on your own skills · open Internal roles for the breakdown`, "ai")}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, fontFamily: "inherit", fontSize: 11, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
            >
              <Ic name="sparkle" size={11} color="var(--pf-purple-500)" />
              Next: {MY_MATCHES[0].role} · {MY_MATCHES[0].match}% match
            </button>
          </div>
        </div>
      </PCard>
      {learningCard}
      <PCard title="Feedback">
        <div style={{ display: "flex", gap: 8 }}>
          <PfBtn small variant="secondary" icon="chat" full onClick={() => actOrQueue("feedback draft", "Feedback composer opened — pick who it goes to", "default")}>Give</PfBtn>
          <PfBtn small variant="secondary" icon="megaphone" full onClick={() => actOrQueue("feedback request", "Feedback request drafted — choose who to ask")}>Request</PfBtn>
        </div>
      </PCard>
      {payslipCard}
    </>
  );

  const learnTab = (
    <>
      {learningCard}
      <PCard title="Up next" right={<span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>from your growth plan</span>}>
        {MY_UP_NEXT.map((u, i) => (
          <div key={u.title} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 4px", borderBottom: i === MY_UP_NEXT.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
            <PfTile icon="book" tone="blue" size={26} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{u.title}</div>
              <div style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{u.meta}</div>
            </div>
            <PfBtn small variant="secondary" onClick={() => actOrQueue(`start · ${u.title}`, `Opening ${u.title} — enrolment happens on My learning`)}>Start</PfBtn>
          </div>
        ))}
      </PCard>
    </>
  );

  const meTab = (
    <>
      <PCard>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 42, height: 42, borderRadius: "50%", background: `${ME_PUBLIC.tone}1A`, color: ME_PUBLIC.tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, border: `1px solid ${ME_PUBLIC.tone}33`, flex: "none" }}>{ME_PUBLIC.init}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{ME_PUBLIC.name}</div>
            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{ME_PUBLIC.role}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 10, flexWrap: "wrap" }}>
          <PfBadge tone="grey">{ME_PUBLIC.grade}</PfBadge>
          <PfBadge tone="grey">{ME_PUBLIC.loc}</PfBadge>
          <PfBadge tone="grey">{ME_PUBLIC.tenure} tenure</PfBadge>
          <PfBadge tone="green">{ME_PUBLIC.contract}</PfBadge>
        </div>
      </PCard>
      {payslipCard}
      <PCard title="My skills">
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {ME_PUBLIC.skills.map((s) => <PfBadge key={s} tone="grey">{s}</PfBadge>)}
        </div>
      </PCard>
      <PCard title="App">
        {([["Shell size", `${MY_SHELL_KB}KB`], ["Cached surfaces", `${MY_CACHED_COUNT}`], ["Offline outbox", queued ? `${queued} queued` : "empty"]] as [string, string][]).map(([k, v], i) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 2px", borderBottom: i === 2 ? "none" : "1px solid var(--pf-n50)", fontSize: 11.5 }}>
            <span style={{ color: "var(--pf-n400)" }}>{k}</span>
            <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{v}</span>
          </div>
        ))}
        <div style={{ marginTop: 8 }}>
          <PfBtn small variant="secondary" full onClick={wipeCache}>Clear cache</PfBtn>
        </div>
      </PCard>
    </>
  );

  const PHONE_CONTENT: Record<PhoneTab, ReactNode> = {
    home: homeTab,
    goals: goalsCard(`Weekly check-ins keep ${MGR_FIRST} current — no status meeting needed.`),
    learn: learnTab,
    me: meTab,
  };

  /* -------------------------------- the phone -------------------------------- */

  const phone = (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 375, height: 740, background: "#020617", borderRadius: 48, border: "1px solid var(--pf-n100)", boxShadow: "0 24px 48px -20px rgba(2,6,23,.28), 0 2px 8px rgba(2,6,23,.08)", padding: 10, flex: "none" }}>
        <div style={{ position: "relative", width: "100%", height: "100%", background: "var(--pf-n25)", borderRadius: 38, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* status bar — the signal bars go grey with your connection */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px 4px", background: "var(--pf-n0)" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>9:41</span>
            <span style={{ position: "absolute", left: "50%", top: 8, transform: "translateX(-50%)", width: 74, height: 18, borderRadius: 99, background: "#020617" }} />
            <span style={{ display: "flex", alignItems: "flex-end", gap: 5 }}>
              <span style={{ display: "flex", alignItems: "flex-end", gap: 1.5 }}>
                {[4, 6, 8, 10].map((h) => (
                  <span key={h} style={{ width: 3, height: h, borderRadius: 1, background: online ? "var(--pf-n900)" : "var(--pf-n100)" }} />
                ))}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: online ? "var(--pf-n900)" : "var(--pf-n300)", lineHeight: 1 }}>{online ? "2G" : "—"}</span>
              <span style={{ width: 18, height: 9, borderRadius: 2.5, border: "1px solid var(--pf-n300)", padding: 1, display: "inline-flex" }}>
                <span style={{ width: "72%", borderRadius: 1, background: "var(--pf-primary-500)" }} />
              </span>
            </span>
          </div>

          {/* PWA topbar */}
          <div style={{ background: "var(--pf-n0)", padding: "8px 14px 0", borderBottom: "1px solid var(--pf-n50)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                onClick={() => setPhoneTab("me")}
                style={{ width: 32, height: 32, borderRadius: "50%", background: `${ME_PUBLIC.tone}1A`, color: ME_PUBLIC.tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, border: `1px solid ${ME_PUBLIC.tone}33`, cursor: "pointer", flex: "none" }}
              >{ME_PUBLIC.init}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Hi {ME_PUBLIC.name.split(" ")[0]} 👋</div>
                <div style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{ME_PUBLIC.role} · {ME_PUBLIC.loc}</div>
              </div>
              <button
                onClick={() => toast(nudgePending ? "2 notifications — your review closes Friday · a new goal nudge" : "1 notification — your review closes Friday")}
                style={{ position: "relative", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--pf-n50)", background: "var(--pf-n0)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <Ic name="bell" size={15} color="var(--pf-n600)" />
                {nudgePending && <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "var(--pf-red-500)", border: "1.5px solid #fff" }} />}
              </button>
            </div>
            {/* connectivity chip — the same `online` your Offline tab flips */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 9px" }}>
              <button
                onClick={toggleOnline}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", borderRadius: 99, padding: "3px 9px",
                  color: online ? "var(--pf-primary-500)" : "var(--pf-yellow-500)",
                  background: online ? "var(--pf-primary-50)" : "var(--pf-yellow-50)",
                  border: `0.6px solid ${online ? "var(--pf-primary-100)" : "var(--pf-yellow-100)"}`,
                }}
              >
                {online ? "● Online" : `◌ Offline — ${MY_CACHED_COUNT} items cached`}
              </button>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: "var(--pf-n300)" }}>PWA · {MY_SHELL_KB}KB shell</span>
            </div>
          </div>

          {/* offline banner */}
          {!online && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--pf-yellow-50)", borderBottom: "1px solid var(--pf-yellow-100)", padding: "7px 14px", fontSize: 11, fontWeight: 500, color: "var(--pf-yellow-500)", animation: "scIn .2s ease" }}>
              <Ic name="warning" size={13} color="var(--pf-yellow-500)" />
              Changes sync when you&rsquo;re back online{queued > 0 && ` · ${queued} queued`}
            </div>
          )}

          {/* WhatsApp notification — dropped by "Send test nudge" */}
          {nudgePending && (
            <div
              onClick={openNudge}
              style={{ position: "absolute", left: 12, right: 12, top: 40, zIndex: 5, display: "flex", alignItems: "center", gap: 9, background: "#020617", borderRadius: 14, padding: "10px 12px", cursor: "pointer", boxShadow: "0 12px 28px rgba(15,23,41,.35)", animation: "scIn .25s ease" }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Ic name="chat" size={16} color="#fff" />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9.5, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".4px" }}>WhatsApp · Talent OS · now</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginTop: 1 }}>🎯 New goal assigned — tap to view</div>
              </div>
              <Ic name="caretright" size={13} color="#94A3B8" />
            </div>
          )}

          {/* scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {PHONE_CONTENT[phoneTab]}
          </div>

          {/* bottom tab bar */}
          <div style={{ display: "flex", background: "var(--pf-n0)", borderTop: "1px solid var(--pf-n50)", padding: "6px 6px 10px" }}>
            {PHONE_TABS.map((t) => {
              const active = phoneTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setPhoneTab(t.id)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontFamily: "inherit" }}
                >
                  <Ic name={t.icon} size={18} color={active ? "var(--pf-primary-500)" : "var(--pf-n400)"} weight={active ? 2 : 1.7} />
                  <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? "var(--pf-primary-500)" : "var(--pf-n400)" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  /* --------------------------------- render --------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Mobile companion</span>
            <PfBadge tone={online ? "green" : "yellow"} dot>{online ? "Online" : "Offline"}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            A {MY_SHELL_KB}KB companion for your phone — the few things that are time-sensitive, on 2G or with no signal at all. Your full workspace stays on the web.
          </div>
        </div>
        <PfBtn variant="secondary" icon={online ? "swap" : "arrowup"} onClick={toggleOnline}>
          {online ? "Demo offline" : "Bring back online"}
        </PfBtn>
        <PfBtn variant="secondary" onClick={() => go("me")}>
          My workspace <Ic name="caretright" size={12} />
        </PfBtn>
      </div>

      {/* KPI strip — all four are yours: your shell, your cache, your outbox, your consent */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginTop: 16 }}>
        <PfStat icon="download" tone="blue" label="Shell size" value={MY_SHELL_KB} unit="KB first load" delta="Works on 2G" deltaTone="green" />
        <PfStat icon="stack" tone="green" label="Cached for offline" value={MY_CACHED_COUNT} unit="surfaces" delta={online ? "Kept fresh" : "Serving cache"} deltaTone={online ? "green" : "yellow"} />
        <PfStat icon="swap" tone={queued ? "yellow" : "grey"} label="Your outbox" value={queued} unit={plural(queued, "change waiting", "changes waiting")} delta={queued ? "Syncs on reconnect" : "All synced"} deltaTone={queued ? "yellow" : "green"} />
        <PfStat icon="bell" tone="purple" label="Nudge channels" value={`${channelsOn}/3`} unit="on" delta="Consent c4" deltaTone="grey" />
      </div>

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "preview", label: "Preview" },
            { key: "channels", label: "Nudges & channels", count: `${channelsOn}/3` },
            { key: "offline", label: "Offline & install", count: String(MY_CACHED_COUNT) },
          ]}
        />
      </div>

      {/* ============================== PREVIEW ============================== */}
      {tab === "preview" && (
        <div style={{ display: "grid", gridTemplateColumns: "405px minmax(0,1fr)", gap: 20, alignItems: "start" }}>
          <div style={{ position: "sticky", top: 24 }}>
            {phone}
            <div style={{ textAlign: "center", fontSize: 11.5, color: "var(--pf-n300)", marginTop: 10, lineHeight: 1.5 }}>
              Live preview of the mobile companion — it shares state with your web workspace.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfCard>
              <PfCardHead
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PfTile icon="chat" tone="green" size={26} />What the companion is for</span>}
                sub="Two surfaces, one record — and a clear line between them."
              />
              <div style={{ padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                  The companion carries the handful of things that will not wait: a check-in due this week, a review that closes {MY_CYCLE.closes}, the module you left at {MY_LEARNING[0].pct}%. It finds you on WhatsApp, opens in a browser tab, and works on the network you actually have.
                </div>
                <div style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                  Everything that needs room — scoring yourself, reading the gap map, seeing who can view which field — stays on your web workspace. The phone never becomes a smaller version of it.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <PfBtn variant="primary" icon="house" onClick={() => go("me")}>Open my workspace</PfBtn>
                  <PfBtn variant="secondary" icon="bell" onClick={() => setTab("channels")}>Nudges &amp; channels</PfBtn>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="On the phone vs. on the web" sub="Tap a row to open the full page behind it.">
                <PfBadge tone="grey">{MIRRORS.length} surfaces</PfBadge>
              </PfCardHead>
              {MIRRORS.map((m, i) => (
                <LinkRow
                  key={m.label}
                  icon={m.icon} tone={m.tone}
                  title={m.label}
                  sub={<><span style={{ color: "var(--pf-n500)" }}>Phone —</span> {m.phone} <span style={{ color: "var(--pf-n300)" }}>·</span> <span style={{ color: "var(--pf-n500)" }}>Web —</span> {m.web}</>}
                  onClick={() => go(m.go)}
                  last={i === MIRRORS.length - 1}
                />
              ))}
            </PfCard>

            <PfBanner
              tone={online ? "green" : "yellow"}
              icon={online ? "check" : "warning"}
              cta="open"
              onCta={() => go("mygoals")}
            >
              {online
                ? "Online — a check-in you tap in the preview saves straight to your goals."
                : `Offline — a check-in you tap in the preview waits in your outbox${queued ? ` (${queued} there now)` : ""}.`}
            </PfBanner>
          </div>
        </div>
      )}

      {/* ============================== CHANNELS ============================== */}
      {tab === "channels" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
          {/* -------- left column -------- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfCard>
              <PfCardHead
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PfTile icon="chat" tone="green" size={26} />WhatsApp deep-links</span>}
                sub="Nudges land where you already are — and open the exact screen."
              >
                {nudgesSent > 0 && <PfBadge tone="green">{nudgesSent} sent</PfBadge>}
              </PfCardHead>
              <div style={{ padding: "14px 20px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 12 }}>
                  <span style={{ alignSelf: "center", fontSize: 10.5, fontWeight: 500, color: "var(--pf-n400)", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 99, padding: "2px 10px" }}>Today</span>
                  <Bubble text="📋 Your Q2 self-assessment closes Friday — tap to complete" time="09:12" />
                  <Bubble text="🎯 New goal assigned — tap to view" time="11:47" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: "var(--pf-n500)" }}>
                  <Ic name="check" size={13} color="var(--pf-primary-500)" />
                  Opens directly in the companion — no app store
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontSize: 12, color: "var(--pf-n500)" }}>
                  <Ic name="shield" size={13} color="var(--pf-primary-500)" />
                  Your number is used for nudges only, under clause c4
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <PfBtn variant="primary" icon="paperplane" onClick={sendNudge}>Send test nudge</PfBtn>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>lands on your phone preview and deep-links into Goals</span>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PfTile icon="megaphone" tone="yellow" size={26} />SMS fallback</span>}
                sub="When WhatsApp cannot deliver, the same nudge arrives as plain text."
              >
                <PfBadge tone={channels.sms ? "green" : "grey"} dot>{channels.sms ? "On" : "Off"}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "14px 20px 16px" }}>
                <div style={{ background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                  {SMS_MOCK}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 8 }}>
                  That link is the same {MY_SHELL_KB}KB page — it opens on a feature phone and on 2G.
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                  <PfBtn small variant="secondary" icon="paperplane" onClick={() =>
                    channels.sms
                      ? toast("Test SMS sent to your registered number — Talent OS never prints it back on screen", "success")
                      : toast("SMS fallback is off — switch it on to send yourself a test", "danger")
                  }>Send test SMS</PfBtn>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>15 min after an undelivered WhatsApp nudge</span>
                </div>
              </div>
            </PfCard>
          </div>

          {/* -------- right column -------- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfCard>
              <PfCardHead
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PfTile icon="bell" tone="purple" size={26} />Your channel preferences</span>}
                sub="Yours to change here, and yours to withdraw entirely."
              >
                <PfBadge tone={channelsOn ? "green" : "yellow"}>{channelsOn} of 3 on</PfBadge>
              </PfCardHead>
              {CHANNEL_ROWS.map((c, i) => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i === CHANNEL_ROWS.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <PfTile icon={c.icon} tone={channels[c.key] ? c.tone : "grey"} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.label}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>{channels[c.key] ? c.sub : c.off}</div>
                  </div>
                  <Toggle on={channels[c.key]} onClick={() => flipChannel(c)} />
                </div>
              ))}
              <div style={{ padding: "12px 20px 14px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <Ic name="shield" size={15} color="var(--pf-n400)" />
                  <div style={{ flex: 1, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                    <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Clause c4 — {C4.purpose}.</span>{" "}
                    Originally for {C4.wasFor.toLowerCase()}; now for {C4.nowFor.toLowerCase()}. Lawful basis: {C4.lawfulBasis.toLowerCase()}, not required for your job. Recorded at {MY_CONSENT.at.toLowerCase()} by {MY_CONSENT.recordedBy}.
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <PfBtn small variant="secondary" icon="shield" onClick={() => go("myprivacy")}>
                    Withdraw consent on My data &amp; privacy
                  </PfBtn>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="What reaches your phone" sub="Every nudge is an event on a record of yours — tap one to open it.">
                <PfBadge tone="grey">{MY_NOTIFICATIONS.length} recent</PfBadge>
              </PfCardHead>
              {MY_NOTIFICATIONS.map((n, i) => (
                <LinkRow
                  key={n.id}
                  icon={n.icon} tone={n.tone}
                  title={n.title}
                  sub={n.sub}
                  cta={n.at}
                  onClick={() => go(n.go)}
                  last={i === MY_NOTIFICATIONS.length - 1}
                />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
                <Ic name="info" size={13} color="var(--pf-n300)" />
                Nudges never carry the content of a review or a rating — only that something is waiting for you.
              </div>
            </PfCard>
          </div>
        </div>
      )}

      {/* ============================== OFFLINE ============================== */}
      {tab === "offline" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead
                title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PfTile icon="download" tone="blue" size={26} />Built for low bandwidth</span>}
                sub={`A ${MY_SHELL_KB}KB shell that paints on 2G — the network most of your week actually runs on.`}
              />
              <div style={{ padding: "14px 20px 16px" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <PfBadge tone="grey">First load {MY_SHELL_KB}KB</PfBadge>
                  <PfBadge tone="grey">Works on 2G</PfBadge>
                  <PfBadge tone={queued ? "yellow" : "grey"}>Offline outbox{queued > 0 && ` · ${queued} queued`}</PfBadge>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--pf-n400)", marginBottom: 6 }}>
                    <span>Payload budget</span>
                    <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{MY_SHELL_KB}KB of 500KB</span>
                  </div>
                  <PfProgress pct={Math.round((MY_SHELL_KB / 500) * 100)} tone="blue" />
                </div>
                <div style={{ marginTop: 12 }}>
                  {BANDWIDTH_FACTS.map(([k, v], i) => (
                    <FactRow key={k} k={k} v={v} last={i === BANDWIDTH_FACTS.length - 1} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                  <PfBtn variant={online ? "secondary" : "primary"} onClick={toggleOnline}>
                    {online ? "Demo offline" : "Bring back online"}
                  </PfBtn>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>the preview flips with it — same state</span>
                </div>
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="Cached for offline" sub="Kept on your device so they open with no signal at all.">
                <PfBadge tone="green">{MY_CACHED_COUNT} surfaces</PfBadge>
              </PfCardHead>
              {CACHED_SURFACES.map((s, i) => (
                <LinkRow
                  key={s.label}
                  icon={s.icon} tone={s.tone}
                  title={s.label}
                  sub={s.sub}
                  onClick={() => go(s.go)}
                  last={i === CACHED_SURFACES.length - 1}
                />
              ))}
              <div style={{ padding: "12px 20px 14px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                  Clearing also drops anything still waiting in your outbox — sync first if something is queued.
                </div>
                <PfBtn small variant="secondary" icon="x" onClick={wipeCache}>Clear cache</PfBtn>
              </div>
            </PfCard>
          </div>

          {/* Outbox */}
          <PfCard>
            <PfCardHead
              title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><PfTile icon="swap" tone={queued ? "yellow" : "green"} size={26} />Your offline outbox</span>}
              sub={queued
                ? "Changes you made without a connection. They keep the time you made them, not the time they land."
                : "Nothing waiting — every change you have made is already on the server."}
            >
              <PfBadge tone={queued ? "yellow" : "green"}>{queued ? `${queued} queued` : "Empty"}</PfBadge>
              <PfBtn small variant={queued ? "primary" : "secondary"} icon="arrowup" onClick={syncOutbox}>Sync now</PfBtn>
            </PfCardHead>
            {queued > 0 ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 120px", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                  <PfTh>Change</PfTh>
                  <PfTh>Made at</PfTh>
                  <PfTh style={{ textAlign: "right" }}>State</PfTh>
                </div>
                {outbox.map((o, i) => (
                  <div key={o.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px 120px", gap: 12, alignItems: "center", padding: "12px 20px", borderBottom: i === outbox.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <PfTile icon="clock" tone="yellow" size={26} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{o.at}</span>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <PfBadge tone={online ? "blue" : "yellow"} dot>{online ? "Ready to sync" : "Waiting for signal"}</PfBadge>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px" }}>
                <PfTile icon="check" tone="green" size={34} />
                <div style={{ flex: 1, fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                  Go offline and tap a check-in in the preview — it will queue here instead of failing, and land on your goals page when you reconnect.
                </div>
                <PfBtn small variant="secondary" icon="target" onClick={() => { setTab("preview"); setPhoneTab("goals"); }}>Try it in the preview</PfBtn>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Every sync is written to the change log on your data &amp; privacy page — including the ones you made offline.
            </div>
          </PfCard>

          {/* Install */}
          <PfCard>
            <PfCardHead title="Add to home screen" sub="An icon on your phone, no app store account, no download queue." />
            <div style={{ padding: "16px 20px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ width: 62, height: 62, borderRadius: 15, background: "#020617", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 8px 18px -8px rgba(2,6,23,.45)" }}>
                <Ic name="sparkle" size={28} color="var(--pf-primary-500)" />
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Talent OS</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>t-os.ng · {MY_SHELL_KB}KB · installs from the browser</div>
                <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                  <PfBadge tone="grey">No app store</PfBadge>
                  <PfBadge tone="grey">Updates arrive with the page</PfBadge>
                  <PfBadge tone="grey">Uninstall = remove the icon</PfBadge>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                <PfBtn variant="ghost" onClick={() => toast("Not now — you can install any time from the browser menu")}>Not now</PfBtn>
                <PfBtn variant="primary" icon="download" onClick={() => toast("Talent OS added to your home screen — it opens straight into your week", "success")}>Add to home screen</PfBtn>
              </div>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
