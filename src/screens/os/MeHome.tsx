"use client";
import { useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfBanner, PfPageTabs, PfTh, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, ME_FIRST, MY_MANAGER, MY_SQUAD, MY_ONEONONE, MY_ACTIONS, MY_CYCLE,
  MY_REVIEW_ROW, MY_REVIEW_RELEASE, THEIR_ACTIONS, MY_FEEDBACK, MY_FEEDBACK_GIVEN, canSubjectSee, MY_PLAN,
  MY_LEARNING, MY_UP_NEXT, MY_ASSESSMENTS, MY_NOTIFICATIONS, MY_MATCHES,
  MY_DOCS, MY_PAYSLIPS, MY_VISIBILITY, MY_CACHED_COUNT, MY_SHELL_KB,
  type MyGoal, type MyNotification,
} from "@/data/me";

/**
 * My workspace — the employee's home (PRD FR-078, Me pillar).
 *
 * The page answers two questions and nothing else: what do you owe, and what is
 * owed to you. Every other Talent OS home is a rollup written from the
 * employer's side; this one is written from the subject's, in the second person,
 * off `@/data/me` only. No pay figure, no leave-risk score, no team completion
 * bar, no colleague's record — and nothing about her the company has not
 * released (her manager's narrative stays sealed until calibration).
 *
 * Three sections: Today (the four things live right now), Inbox (the bell's real
 * destination — read/unread through `useMe()`), This week (a dated strip).
 */

/* --------------------------------- derived --------------------------------- */

/** The predicate lives in me.ts — apply it rather than trusting the array order. */
const VISIBLE_FEEDBACK = MY_FEEDBACK.filter(canSubjectSee);
const LATEST_FEEDBACK = VISIBLE_FEEDBACK[0];

const OVERDUE = MY_ACTIONS[0];

const COURSE = MY_LEARNING[0];
const SELF_PACED = MY_UP_NEXT.filter((u) => u.meta.includes("self-paced"));
const DATED_LEARNING = MY_UP_NEXT.filter((u) => !u.meta.includes("self-paced"));
const BOOKED = MY_ASSESSMENTS.filter((a) => a.status === "scheduled");

/** "Fri, Jul 10" → "Fri"; "Thu · 16:00 WAT" → "Thu". */
const dayLabel = (s: string) => s.split(/[,·]/)[0].trim();

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sort key for "Aug 12" / "Sep 30" so the Ahead group stays in date order. */
const dayKey = (s: string): number => {
  const m = MONTHS.indexOf(s.slice(0, 3));
  const d = parseInt(s.slice(4), 10);
  return m < 0 || Number.isNaN(d) ? 999 : m * 31 + d;
};

const REVIEW_CHIP =
  MY_REVIEW_ROW.manager === "done" ? "Manager done"
    : MY_REVIEW_ROW.manager === "in-progress" ? "Manager in progress"
      : "Manager not started";

/* ---------------------------------- types ---------------------------------- */

/** A thing on her plate today. `open` = still owed by her; `tick` = she can close it here. */
type Attention = {
  key: string; icon: string; tone: PfTone; title: string; sub: string;
  quote?: string; chip: string; chipTone: PfTone; stage: string; open: boolean; tick?: string;
};

type WeekGroup = "Overdue" | "This week" | "Ahead";

type WeekItem = { when: string; group: WeekGroup; icon: string; tone: PfTone; title: string; sub: string; stage: string };

const GROUPS: WeekGroup[] = ["Overdue", "This week", "Ahead"];

const GROUP_NOTE: Record<WeekGroup, string> = {
  Overdue: "Past its date — nobody else can close it for you.",
  "This week": "Dated, and inside the next seven days.",
  Ahead: "Booked or due later — no action needed today.",
};

/* -------------------------------- builders --------------------------------- */

const buildAttention = (actionDone: boolean, unscored: number): Attention[] => [
  {
    key: "overdue",
    icon: actionDone ? "check" : "warning",
    tone: actionDone ? "green" : "red",
    title: OVERDUE.item,
    sub: `Due ${OVERDUE.due} · you own this — agreed in your 1-on-1 with ${MY_MANAGER.name}`,
    chip: actionDone ? "Done" : "Overdue",
    chipTone: actionDone ? "green" : "red",
    stage: "myoneonones",
    open: !actionDone,
    tick: OVERDUE.item,
  },
  {
    key: "oneonone",
    icon: "chat",
    tone: "purple",
    title: `1-on-1 with ${MY_MANAGER.name}`,
    sub: `${MY_ONEONONE.time} · ${MY_MANAGER.role} · ${MY_ONEONONE.agenda.length} agenda items, and you can add your own`,
    chip: dayLabel(MY_ONEONONE.time),
    chipTone: "purple",
    stage: "myoneonones",
    open: true,
  },
  {
    key: "review",
    icon: "clipboard",
    tone: unscored ? "yellow" : "green",
    title: `Your self-assessment closes ${MY_CYCLE.closes}`,
    sub: unscored
      ? `${MY_CYCLE.name} · ${unscored} competenc${unscored === 1 ? "y" : "ies"} still unscored`
      : `${MY_CYCLE.name} · all five competencies scored — your words go in with it`,
    chip: `${5 - unscored}/5 scored`,
    chipTone: unscored ? "yellow" : "green",
    stage: "myreview",
    open: unscored > 0,
  },
  {
    key: "feedback",
    icon: "megaphone",
    tone: "green",
    title: `${LATEST_FEEDBACK.giver} sent you feedback`,
    sub: `${LATEST_FEEDBACK.competency} · ${LATEST_FEEDBACK.type} · ${LATEST_FEEDBACK.time} · ${LATEST_FEEDBACK.visibility.replace("them", "you")}`,
    quote: LATEST_FEEDBACK.text,
    chip: "New",
    chipTone: "green",
    stage: "myfeedback",
    open: false,
  },
];

/**
 * The other half of the page: commitments pointed AT her. `THEIR_ACTIONS` is
 * what her manager owes her; the review write-up is the thing she is owed and
 * has not been given — and naming the date it opens is the honest version of a
 * gate. The narrative itself stays behind MY_REVIEW_RELEASE.released (false).
 */
const OWED_TO_YOU: Attention[] = [
  ...THEIR_ACTIONS.map((a): Attention => ({
    key: `owed-${a.item}`,
    icon: "clipboard",
    tone: "blue",
    title: a.item,
    sub: `${MY_MANAGER.name} owns this · due ${a.due} — visible to you, not yours to tick`,
    chip: a.done ? "Done" : "With your manager",
    chipTone: a.done ? "green" : "blue",
    stage: "myoneonones",
    open: false,
  })),
  {
    key: "sealed",
    icon: "shield",
    tone: MY_REVIEW_RELEASE.released ? "green" : "yellow",
    title: "Your manager's write-up of your review",
    sub: MY_REVIEW_RELEASE.released
      ? `Released to you after ${MY_REVIEW_RELEASE.sharedAfter} — read it on your review.`
      : `Shared with you after ${MY_REVIEW_RELEASE.sharedAfter}. Until then it is not on this page, and no other page will show it to you early.`,
    chip: MY_REVIEW_RELEASE.released ? "Released" : "Sealed until calibration",
    chipTone: MY_REVIEW_RELEASE.released ? "green" : "yellow",
    stage: "myreview",
    open: false,
  },
];

const buildWeek = (goals: MyGoal[], actionDone: boolean): WeekItem[] => {
  const items: WeekItem[] = [];

  if (!actionDone) {
    items.push({
      when: OVERDUE.due, group: "Overdue", icon: "warning", tone: "red",
      title: OVERDUE.item, sub: `Owed by you · agreed with ${MY_MANAGER.name}`, stage: "myoneonones",
    });
  }

  items.push({
    when: dayLabel(MY_ONEONONE.time), group: "This week", icon: "chat", tone: "purple",
    title: `1-on-1 with ${MY_MANAGER.name}`, sub: `${MY_ONEONONE.time} · ${MY_ONEONONE.agenda.length} agenda items`, stage: "myoneonones",
  });

  DATED_LEARNING.forEach((u) => items.push({
    when: dayLabel(u.meta), group: "This week", icon: "book", tone: "blue",
    title: u.title, sub: u.meta, stage: "mylearning",
  }));

  items.push({
    when: dayLabel(MY_CYCLE.closes), group: "This week", icon: "clipboard", tone: "yellow",
    title: "Self-assessment closes", sub: `${MY_CYCLE.name} · closes ${MY_CYCLE.closes}`, stage: "myreview",
  });

  BOOKED.forEach((a) => items.push({
    when: a.when, group: "Ahead", icon: "users", tone: "purple",
    title: a.title, sub: `${a.assessor} · part of your Staff-track plan`, stage: "mygrowth",
  }));

  goals.forEach((g) => items.push({
    when: g.due, group: "Ahead", icon: "target", tone: g.tone,
    title: g.title, sub: `${g.pct}% · ${g.status}`, stage: "mygoals",
  }));

  return items;
};

/* ------------------------------ readiness ring ------------------------------ */

function ReadinessRing({ pct }: { pct: number }) {
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ position: "relative", width: 74, height: 74, flex: "none" }}>
      <svg width={74} height={74} viewBox="0 0 74 74">
        <circle cx={37} cy={37} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={7} />
        <circle
          cx={37} cy={37} r={R} fill="none" stroke="var(--pf-purple-500)" strokeWidth={7}
          strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`}
          transform="rotate(-90 37 37)" style={{ transition: "stroke-dasharray .4s ease" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 10, color: "var(--pf-n400)", marginTop: 2 }}>ready</span>
      </div>
    </div>
  );
}

/* --------------------------------- KPI link -------------------------------- */

/** PfStat, made navigational — every number on this page opens the page that owns it. */
function StatLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ cursor: "pointer", borderRadius: 12, transition: "transform .12s ease, box-shadow .12s ease", transform: hovered ? "translateY(-1px)" : "none", boxShadow: hovered ? "0 6px 16px -10px rgba(2,6,23,.35)" : "none" }}
    >
      {children}
    </div>
  );
}

/* ------------------------------ attention rows ------------------------------ */

function AttentionRow({ a, done, onOpen, onTick, last }: {
  a: Attention; done: boolean; onOpen: () => void; onTick: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  const lead = a.tone === "red";
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        borderLeft: `3px solid ${lead ? "var(--pf-red-500)" : "transparent"}`,
        background: hovered ? "var(--pf-n25)" : lead ? "var(--pf-red-50)" : "transparent",
        transition: "background .12s ease",
      }}
    >
      <PfTile icon={a.icon} tone={a.tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>{a.sub}</div>
        {a.quote && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5, borderLeft: "2px solid var(--pf-primary-100)", paddingLeft: 10 }}>
            &ldquo;{a.quote}&rdquo;
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
        <PfBadge tone={a.chipTone} dot={a.open}>{a.chip}</PfBadge>
        {a.tick && (
          <span onClick={(e) => e.stopPropagation()}>
            <PfBtn small variant={done ? "secondary" : "primary"} icon="check" onClick={onTick}>
              {done ? "Done" : "Mark done"}
            </PfBtn>
          </span>
        )}
        <Ic name="caretright" size={15} color="var(--pf-n300)" />
      </div>
    </div>
  );
}

/* -------------------------------- goal rows -------------------------------- */

function GoalRow({ g, onOpen, last }: { g: MyGoal; onOpen: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ padding: "13px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)", flex: "none" }}>{g.pct}%</span>
        <PfBadge tone={g.tone}>{g.status}</PfBadge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 9 }}>
        <div style={{ flex: 1 }}><PfProgress pct={g.pct} tone={g.tone === "yellow" ? "yellow" : "green"} height={6} /></div>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: "none" }}>Due {g.due}</span>
      </div>
    </div>
  );
}

/* ------------------------------- inbox rows -------------------------------- */

function NotifRow({ n, unread, onOpen, last }: { n: MyNotification; unread: boolean; onOpen: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 11, padding: "13px 20px 13px 14px", cursor: "pointer",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : unread ? "var(--pf-n0)" : "var(--pf-n25)",
        transition: "background .12s ease",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: unread ? "var(--pf-primary-500)" : "transparent", flex: "none" }} />
      <span style={{ opacity: unread ? 1 : 0.55, display: "inline-flex" }}>
        <PfTile icon={n.icon} tone={n.tone} size={32} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: unread ? 600 : 500, color: unread ? "var(--pf-n900)" : "var(--pf-n500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {n.title}
        </div>
        <div style={{ fontSize: 12.5, color: unread ? "var(--pf-n400)" : "var(--pf-n300)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {n.sub}
        </div>
      </div>
      <span style={{ fontSize: 11.5, color: "var(--pf-n300)", flex: "none" }}>{n.at}</span>
      {unread && <PfBadge tone="green">Unread</PfBadge>}
      <Ic name="caretright" size={15} color="var(--pf-n300)" />
    </div>
  );
}

/* -------------------------------- week rows -------------------------------- */

function WeekRow({ w, onOpen, last }: { w: WeekItem; onOpen: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <span style={{ width: 74, flex: "none", fontSize: 12, fontWeight: 600, color: "var(--pf-n600)" }}>{w.when}</span>
      <span style={{ width: 1, alignSelf: "stretch", background: "var(--pf-n50)", flex: "none" }} />
      <PfTile icon={w.icon} tone={w.tone} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.sub}</div>
      </div>
      <Ic name="caretright" size={15} color="var(--pf-n300)" />
    </div>
  );
}

/* --------------------------------- hub tile -------------------------------- */

function HubTile({ icon, tone, label, sub, onClick }: { icon: string; tone: PfTone; label: string; sub: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        background: hovered ? "var(--pf-n25)" : "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 12,
        boxShadow: "0 1px 3px 0 #f3f3f3", padding: 14, cursor: "pointer", transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfTile icon={icon} tone={tone} size={28} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{label}</span>
        <Ic name="arrowright" size={15} color="var(--pf-n300)" />
      </div>
      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function MeHome() {
  const go = useGo();
  const toast = useToast();
  const me = useMe();
  const [tab, setTab] = useState("today");

  const goals = me.goals;
  const avg = goals.length ? Math.round(goals.reduce((a, g) => a + g.pct, 0) / goals.length) : 0;
  const unscored = me.selfScores.filter((v) => v === 0).length;
  const actionDone = me.actionsDone.includes(OVERDUE.item);

  const unread = MY_NOTIFICATIONS.filter((n) => !me.notifRead.includes(n.id));
  const attention = buildAttention(actionDone, unscored);
  const openCount = attention.filter((a) => a.open).length;
  const week = buildWeek(goals, actionDone);

  const channels = [
    me.channels.whatsapp ? "WhatsApp" : null,
    me.channels.sms ? "SMS" : null,
    me.channels.emailDigest ? "the email digest" : null,
  ].filter(Boolean) as string[];

  const openAttention = (a: Attention) => go(a.stage);

  const tickOverdue = () => {
    me.toggleAction(OVERDUE.item);
    toast(
      actionDone
        ? `Reopened — “${OVERDUE.item}” is back on your 1-on-1 with ${MY_MANAGER.name}`
        : `Closed — “${OVERDUE.item}” is marked done on your 1-on-1 with ${MY_MANAGER.name}`,
      actionDone ? "default" : "success",
    );
  };

  const openNotification = (n: MyNotification) => {
    me.markRead(n.id);
    go(n.go);
  };

  const markAll = () => {
    if (!unread.length) { toast("Your inbox is already clear — nothing unread"); return; }
    me.markAllRead();
    toast(`${unread.length} notification${unread.length > 1 ? "s" : ""} marked read`, "success");
  };

  const HUB: { stage: string; icon: string; tone: PfTone; label: string; sub: string }[] = [
    {
      stage: "myfeedback", icon: "megaphone", tone: "green", label: "Your feedback",
      sub: `${VISIBLE_FEEDBACK.length} notes you are party to · ${MY_FEEDBACK_GIVEN.length} you have written for others.`,
    },
    {
      stage: "mymobility", icon: "swap", tone: "blue", label: "Internal roles",
      sub: me.optIn
        ? `Matching is on — ${MY_MATCHES.length} open roles scored against your skills, honest scores included.`
        : "Matching is off — nothing about you is scored against open roles until you turn it back on.",
    },
    {
      stage: "myprofile", icon: "user", tone: "purple", label: "Profile & documents",
      sub: `${MY_DOCS.length} documents and ${MY_PAYSLIPS.length} payslip periods — and a field you can correct.`,
    },
    {
      stage: "myprivacy", icon: "shield", tone: "yellow", label: "Data & privacy",
      sub: `${MY_VISIBILITY.length} fields, who sees each one and why — plus every change you have made.`,
    },
  ];

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Greeting */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <PfAvatar init={ME_PUBLIC.init} tone={ME_PUBLIC.tone} size={42} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Good morning, {ME_FIRST}</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            {ME_PUBLIC.role} · {MY_SQUAD} · your manager is <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{MY_MANAGER.name}</span>
          </div>
        </div>
        <PfBtn variant="secondary" icon="bell" onClick={() => setTab("inbox")}>
          {unread.length ? `${unread.length} unread` : "Inbox"}
        </PfBtn>
        <PfBtn variant="primary" icon="target" onClick={() => go("mygoals")}>Check in on a goal</PfBtn>
      </div>

      {/* The one thing that is late — everything else on the page can wait */}
      <PfBanner
        tone={actionDone ? "green" : "red"}
        icon={actionDone ? "check" : "warning"}
        cta="open"
        onCta={() => go("myoneonones")}
      >
        {actionDone ? (
          <>
            <span style={{ fontWeight: 600 }}>Nothing of yours is overdue — </span>
            <span style={{ fontWeight: 400 }}>you closed &ldquo;{OVERDUE.item}&rdquo;. Next up is your 1-on-1, {MY_ONEONONE.time.toLowerCase()}.</span>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600 }}>One thing of yours is overdue — </span>
            <span style={{ fontWeight: 400 }}>&ldquo;{OVERDUE.item}&rdquo;, due {OVERDUE.due}. It is the only item on this page anyone is waiting on you for.</span>
          </>
        )}
      </PfBanner>

      {/* Your four live numbers — each one opens the page that owns it */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginTop: 12 }}>
        <StatLink onClick={() => go("mygoals")}>
          <PfStat icon="target" tone="green" label="Your goals" value={avg} unit="% average" delta={`${goals.length} live`} deltaTone="blue" />
        </StatLink>
        <StatLink onClick={() => go("mygrowth")}>
          <PfStat icon="trend" tone="purple" label="Staff-track readiness" value={MY_PLAN.readiness} unit="% ready" delta={MY_PLAN.est} deltaTone="grey" />
        </StatLink>
        <StatLink onClick={() => go("mylearning")}>
          <PfStat icon="book" tone="blue" label="Your learning" value={COURSE.pct} unit="% complete" delta={COURSE.module} deltaTone="grey" />
        </StatLink>
        <StatLink onClick={() => go("myreview")}>
          <PfStat icon="clipboard" tone="yellow" label="Your review" value={`${5 - unscored}/5`} unit="self-scored" delta={REVIEW_CHIP} deltaTone="yellow" />
        </StatLink>
      </div>

      {/* --------------------------- Page sections --------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "today", label: "Today", count: String(openCount) },
            { key: "inbox", label: "Inbox", count: String(unread.length) },
            { key: "week", label: "This week", count: String(week.length) },
          ]}
        />
      </div>

      {/* ------------------------------- Today ------------------------------- */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="Needs you today"
              sub={openCount ? `${openCount} of these are owed by you — the rest are yours to read.` : "Nothing is owed by you right now — the rest is yours to read."}
            >
              <PfBadge tone={actionDone ? "green" : "red"} dot>{actionDone ? "Clear" : "1 overdue"}</PfBadge>
            </PfCardHead>
            {attention.map((a, i) => (
              <AttentionRow
                key={a.key}
                a={a}
                done={actionDone}
                onOpen={() => openAttention(a)}
                onTick={tickOverdue}
                last={i === attention.length - 1}
              />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
              <Ic name="shield" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n400)" }}>
                This list is yours. Who else sees each item — and why — is written down field by field.
              </span>
              <PfBtn small variant="ghost" onClick={() => go("myprivacy")}>Who sees what</PfBtn>
            </div>
          </PfCard>

          {/* The other direction — what other people owe you about your own record */}
          <PfCard>
            <PfCardHead title="Owed to you" sub="Commitments other people made about your record. Visible to you, not yours to tick.">
              <PfBadge tone="blue">{OWED_TO_YOU.length} waiting on someone else</PfBadge>
            </PfCardHead>
            {OWED_TO_YOU.map((a, i) => (
              <AttentionRow
                key={a.key}
                a={a}
                done={false}
                onOpen={() => openAttention(a)}
                onTick={tickOverdue}
                last={i === OWED_TO_YOU.length - 1}
              />
            ))}
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            {/* Goals */}
            <PfCard>
              <PfCardHead title="Your goals" sub={`${goals.length} live · averaging ${avg}%`}>
                <PfBtn small variant="secondary" icon="plus" onClick={() => go("mygoals")}>Check in</PfBtn>
              </PfCardHead>
              {goals.map((g, i) => (
                <GoalRow key={g.id} g={g} onOpen={() => go("mygoals")} last={i === goals.length - 1} />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
                <Ic name="clock" size={13} color="var(--pf-n300)" />
                {me.checkins.length
                  ? `Your last check-in was ${me.checkins[0].at} — ${me.checkins[0].from}% → ${me.checkins[0].to}%.`
                  : "No check-in from you yet this week — it takes about a minute."}
              </div>
            </PfCard>

            {/* Growth + learning */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PfCard pad={18}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <ReadinessRing pct={MY_PLAN.readiness} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_PLAN.target}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{MY_PLAN.track}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>
                      Sponsor <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{MY_PLAN.sponsor}</span> · est. {MY_PLAN.est}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                  <PfBtn small variant="secondary" onClick={() => go("mygrowth")}>Open your plan</PfBtn>
                  {BOOKED.map((a) => (
                    <PfBadge key={a.title} tone="purple">{a.title} · {a.when}</PfBadge>
                  ))}
                </div>
              </PfCard>

              <PfCard pad={18}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfTile icon="book" tone="blue" size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{COURSE.title}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{COURSE.provider} · {COURSE.module}</div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", flex: "none" }}>{COURSE.pct}%</span>
                </div>
                <div style={{ marginTop: 12 }}><PfProgress pct={COURSE.pct} tone="blue" height={6} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13 }}>
                  <PfBtn small variant="secondary" icon="play" onClick={() => go("mylearning")}>Continue</PfBtn>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                    {MY_LEARNING.filter((l) => l.pct < 100).length} in progress{COURSE.offline ? " · downloaded for offline" : ""}
                  </span>
                </div>
              </PfCard>
            </div>
          </div>

          {/* The rest of your pillar */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            {HUB.map((h) => (
              <HubTile key={h.stage} icon={h.icon} tone={h.tone} label={h.label} sub={h.sub} onClick={() => go(h.stage)} />
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------- Inbox ------------------------------- */}
      {tab === "inbox" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!unread.length && (
            <PfBanner tone="green" icon="check">
              <span style={{ fontWeight: 600 }}>You are all caught up — </span>
              <span style={{ fontWeight: 400 }}>nothing unread. Everything below stays here so you can go back to it.</span>
            </PfBanner>
          )}

          <PfCard>
            <PfCardHead
              title="Inbox"
              sub="Everything the system has told you about your record — this is where the bell goes."
            >
              <PfBadge tone={unread.length ? "green" : "grey"} dot={unread.length > 0}>
                {unread.length} unread · {MY_NOTIFICATIONS.length} total
              </PfBadge>
              <PfBtn small variant="secondary" icon="check" onClick={markAll}>Mark all read</PfBtn>
            </PfCardHead>

            {MY_NOTIFICATIONS.map((n, i) => (
              <NotifRow
                key={n.id}
                n={n}
                unread={!me.notifRead.includes(n.id)}
                onOpen={() => openNotification(n)}
                last={i === MY_NOTIFICATIONS.length - 1}
              />
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n400)" }}>
                {channels.length
                  ? `These also reach you on ${channels.join(", ")} — opening one here marks it read everywhere.`
                  : "No nudge channels are on, so these only ever appear here."}
              </span>
              <PfBtn small variant="ghost" onClick={() => go("mymobile")}>Channels</PfBtn>
            </div>
          </PfCard>
        </div>
      )}

      {/* ----------------------------- This week ----------------------------- */}
      {tab === "week" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead title="Your week" sub="Everything of yours with a date on it, in the order it lands.">
              <PfBadge tone="grey">{week.length} dated items</PfBadge>
            </PfCardHead>

            {GROUPS.map((grp) => {
              const rows = week.filter((w) => w.group === grp);
              if (!rows.length) return null;
              const ordered = grp === "Ahead" ? [...rows].sort((a, b) => dayKey(a.when) - dayKey(b.when)) : rows;
              return (
                <div key={grp}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
                    <PfTh style={{ fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase", fontSize: 11, color: grp === "Overdue" ? "var(--pf-red-500)" : "var(--pf-n400)" }}>
                      {grp}
                    </PfTh>
                    <PfTh style={{ flex: 1 }}>{GROUP_NOTE[grp]}</PfTh>
                    <PfTh style={{ fontWeight: 600 }}>{ordered.length}</PfTh>
                  </div>
                  {ordered.map((w, i) => (
                    <WeekRow key={`${grp}-${w.title}-${i}`} w={w} onOpen={() => go(w.stage)} last={i === ordered.length - 1 && grp === "Ahead"} />
                  ))}
                </div>
              );
            })}
          </PfCard>

          <PfCard>
            <PfCardHead title="No date, whenever you want it" sub="Self-paced learning that is already paid for — nothing here expires this week.">
              <PfBtn small variant="secondary" onClick={() => go("mylearning")}>Your learning</PfBtn>
            </PfCardHead>
            {SELF_PACED.map((u) => (
              <WeekRow
                key={u.title}
                w={{ when: "Anytime", group: "Ahead", icon: "play", tone: "blue", title: u.title, sub: u.meta, stage: "mylearning" }}
                onOpen={() => go("mylearning")}
                last={false}
              />
            ))}
            <WeekRow
              w={{ when: "In progress", group: "Ahead", icon: "book", tone: "green", title: COURSE.title, sub: `${COURSE.module} · ${COURSE.pct}% complete`, stage: "mylearning" }}
              onOpen={() => go("mylearning")}
              last
            />
          </PfCard>
        </div>
      )}

      {/* Quiet footer — the same workspace, on her phone */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--pf-n50)" }}>
        <Ic name="download" size={14} color="var(--pf-n300)" />
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)" }}>
          The same workspace fits on your phone — a {MY_SHELL_KB}KB shell with {MY_CACHED_COUNT} surfaces cached, so a bad signal on the road does not cost you a check-in.
        </span>
        <PfBtn small variant="ghost" onClick={() => go("mymobile")}>Mobile companion</PfBtn>
      </div>
    </div>
  );
}
