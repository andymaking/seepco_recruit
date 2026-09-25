"use client";
import { useRef, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useMe } from "@/state/me";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfAvatar,
  PfBanner, PfPageTabs, PfTh, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_ONEONONE, MY_ACTIONS, THEIR_ACTIONS, MY_NUDGE_GOAL,
} from "@/data/me";

/**
 * My 1-on-1s — the same meeting as /one-on-ones, inverted.
 *
 * On the manager's page the viewer is Ngozi Adeyemi: she holds the recording
 * control, the consent toggles for BOTH participants, five other direct reports
 * and a cross-meeting action tracker. None of that is the subject's to hold or
 * to see, so this page keeps exactly one meeting — hers — and moves three things:
 *
 *   1. the participant labels ("You — participant", her manager runs the meeting),
 *   2. the consent gate (hers is hers to withdraw; his is read-only, and the
 *      recording control is his — an employee never holds a manager's consent),
 *   3. the action items (she ticks only what she owns; his are visible, not
 *      actionable, because an item is closed by the person who owes it).
 *
 * Every write goes through useMe() so the agenda item she adds and the action she
 * closes survive navigation and land in her own audit trail on /my-privacy.
 */

/* --------------------------------- types ---------------------------------- */

type AgendaItem = { key: string; text: string; mine: boolean; note?: string; goTo?: string; goLabel?: string; tabTo?: string };

type PastNote = { icon: string; tone: PfTone; title: string; when: string; body: string; tag: string; goTo?: string; goLabel?: string; tabTo?: string };

type TabKey = "next" | "actions" | "history";

/* ---------------------------------- data ---------------------------------- */

/** The one item the app flags as overdue everywhere it appears (same set as /one-on-1s). */
const OVERDUE = new Set(["Share design-system migration plan"]);

/** Where each shared agenda line came from — no new facts, just the link back. */
const AGENDA_NOTE: Record<string, { note: string; goTo?: string; goLabel?: string; tabTo?: string }> = {
  "Follow-up: migration plan (overdue)": {
    note: "Carries the one action item you still owe — due Jul 5",
    tabTo: "actions", goLabel: "See the action item",
  },
  "Growth: Staff-track expectations": {
    note: "Standing topic while your Staff-track plan is open",
    goTo: "mygrowth", goLabel: "Open your growth plan",
  },
  "Payments crunch load check": {
    note: "A workload check on the payments programme you lead",
    goTo: "mygoals", goLabel: "Open your goals",
  },
};

/** Past notes derived from the agenda themes — deliberately thin, because thin is the truth. */
const PAST_NOTES: PastNote[] = [
  {
    icon: "sparkle", tone: "purple", title: "Summary on file", when: "Your last 1-on-1",
    body: MY_ONEONONE.aiSummary ?? "", tag: "AI summary",
  },
  {
    icon: "warning", tone: "red", title: "Follow-up: migration plan", when: "Carried into today",
    body: "Still open. It is the action item you owe, due Jul 5, and it is item one on today's agenda.",
    tag: "Open action", tabTo: "actions", goLabel: "See the action item",
  },
  {
    icon: "trend", tone: "blue", title: "Growth: Staff-track expectations", when: "Recurring theme",
    body: "Your Staff-track plan is the standing growth topic in these conversations.",
    tag: "Recurring", goTo: "mygrowth", goLabel: "Open your growth plan",
  },
  {
    icon: "pulse", tone: "yellow", title: "Payments crunch load check", when: "On today's agenda",
    body: "A load check on the payments programme — raised for today, no earlier note on file.",
    tag: "Workload", goTo: "mygoals", goLabel: "Open your goals",
  },
];

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 11px", outline: "none",
} as const;

const doneOf = (a: { item: string; done: boolean }, list: string[]) => (list.includes(a.item) ? !a.done : a.done);

/* ------------------------------- primitives -------------------------------- */

/** Consent switch. `held` renders it read-only with a shield — someone else owns it. */
function Toggle({ on, held, onClick }: { on: boolean; held?: boolean; onClick?: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title={held ? "Held by your manager — read-only for you" : on ? "Withdraw your consent" : "Give your consent"}
      style={{
        width: 38, height: 22, borderRadius: 999, padding: 2, flex: "none", position: "relative",
        border: held ? "1px dashed var(--pf-primary-500)" : `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
        background: held ? "var(--pf-primary-100)" : on ? "var(--pf-primary-500)" : "var(--pf-n50)",
        cursor: held ? "not-allowed" : "pointer",
        boxShadow: hovered && !held ? "0 0 0 3px var(--pf-primary-50)" : "none",
        transition: "background .15s ease, box-shadow .15s ease",
      }}
    >
      <span
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 16, height: 16, borderRadius: "50%", background: "var(--pf-n0)",
          transform: `translateX(${on ? 16 : 0}px)`, transition: "transform .15s ease",
          boxShadow: "0 1px 2px rgba(2,6,23,.25)",
        }}
      >
        {held && <Ic name="shield" size={10} color="var(--pf-primary-600)" weight={2} />}
      </span>
    </button>
  );
}

function Participant({ init, tone, name, role, badge, badgeTone, note }: {
  init: string; tone: string; name: string; role: string; badge: string; badgeTone: PfTone; note: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", background: "var(--pf-n0)", minWidth: 0 }}>
      <PfAvatar init={init} tone={tone} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{name}</span>
          <PfBadge tone={badgeTone}>{badge}</PfBadge>
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{role}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 5 }}>{note}</div>
      </div>
    </div>
  );
}

function AgendaRow({ item, index, flagged, onFlag, onOpen, last }: {
  item: AgendaItem; index: number; flagged: boolean; onFlag: () => void; onOpen: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 20px",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <span
        style={{
          width: 22, height: 22, borderRadius: 7, flex: "none", marginTop: 1,
          background: item.mine ? "var(--pf-primary-50)" : "var(--pf-n50)",
          border: `1px solid ${item.mine ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
          color: item.mine ? "var(--pf-primary-600)" : "var(--pf-n500)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600,
        }}
      >
        {index + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--pf-n900)" }}>{item.text}</span>
          {item.mine && <PfBadge tone="green">Added by you</PfBadge>}
          {flagged && <PfBadge tone="yellow" dot>Cover first</PfBadge>}
        </div>
        {item.note && <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4 }}>{item.note}</div>}
        {item.goLabel && (
          <button
            onClick={onOpen}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 7, fontSize: 11.5, fontWeight: 500, color: "var(--pf-blue-500)", background: "var(--pf-blue-50)", border: "0.6px solid var(--pf-blue-100)", borderRadius: 4, padding: "2px 7px", cursor: "pointer" }}
          >
            {item.goLabel}
            <Ic name="arrowright" size={11} color="var(--pf-blue-500)" />
          </button>
        )}
      </div>
      <button
        onClick={onFlag}
        title={flagged ? "Remove the cover-first flag" : "Flag to cover first"}
        style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "inline-flex", flex: "none", opacity: flagged || hovered ? 1 : 0.35, transition: "opacity .12s ease" }}
      >
        <Ic name="star" size={16} color={flagged ? "var(--pf-yellow-500)" : "var(--pf-n300)"} />
      </button>
    </div>
  );
}

function MyActionRow({ item, due, done, overdue, onToggle, last }: {
  item: string; due: string; done: boolean; overdue: boolean; onToggle: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  const hot = overdue && !done;
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 20px 14px 17px",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        borderLeft: `3px solid ${hot ? "var(--pf-red-500)" : "transparent"}`,
        background: hot ? "var(--pf-red-50)" : hovered ? "var(--pf-n25)" : "transparent",
        transition: "background .12s ease",
      }}
    >
      <button
        onClick={onToggle}
        title={done ? "Reopen this commitment" : "Mark this commitment done"}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", flex: "none" }}
      >
        {done ? (
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-primary-500)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic name="check" size={12} color="#fff" weight={2.4} />
          </span>
        ) : (
          <span style={{ width: 20, height: 20, borderRadius: "50%", border: `1.6px solid ${hot ? "var(--pf-red-500)" : "var(--pf-n300)"}`, display: "inline-flex" }} />
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: done ? "var(--pf-n400)" : "var(--pf-n900)", textDecoration: done ? "line-through" : "none" }}>
          {item}
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>
          You own this · agreed in your 1-on-1 with {MY_MANAGER.name}
        </div>
      </div>
      <div style={{ flex: "none", width: 92, fontSize: 12.5, fontWeight: 500, color: hot ? "var(--pf-red-500)" : "var(--pf-n500)" }}>{due}</div>
      <div style={{ flex: "none", width: 116, display: "flex", justifyContent: "flex-end" }}>
        {done ? <PfBadge tone="green">Closed</PfBadge> : hot ? <PfBadge tone="red" dot>Overdue</PfBadge> : <PfBadge tone="yellow">Open</PfBadge>}
      </div>
    </div>
  );
}

function TheirActionRow({ item, due, done, onAgenda, last }: {
  item: string; due: string; done: boolean; onAgenda: () => void; last: boolean;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={26} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: done ? "var(--pf-n400)" : "var(--pf-n900)", textDecoration: done ? "line-through" : "none" }}>{item}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{MY_MANAGER.name} owns this · you can see it, not close it</div>
      </div>
      <div style={{ flex: "none", width: 92, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n500)" }}>{due}</div>
      <div style={{ flex: "none", width: 116, display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
        {done ? <PfBadge tone="green">Closed</PfBadge> : <PfBadge tone="grey">Open</PfBadge>}
        <PfBtn small variant="secondary" onClick={onAgenda}>Raise it</PfBtn>
      </div>
    </div>
  );
}

function PastRow({ note, onOpen, last }: { note: PastNote; onOpen: () => void; last: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} style={{ display: "flex", gap: 13, padding: "15px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}>
      {/* rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "none", width: 32 }}>
        <PfTile icon={note.icon} tone={note.tone} size={32} />
        {!last && <span style={{ flex: 1, width: 1, background: "var(--pf-n50)", marginTop: 6, minHeight: 12 }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{note.title}</span>
          <PfBadge tone={note.tone}>{note.tag}</PfBadge>
          <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>{note.when}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 5, lineHeight: 1.55 }}>{note.body}</div>
        {note.goLabel && (
          <button
            onClick={onOpen}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
          >
            {note.goLabel}
            <Ic name="arrowright" size={11} color="var(--pf-n400)" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function MyOneOnOnes() {
  const go = useGo();
  const toast = useToast();
  const { agendaAdds, actionsDone, addAgendaItem, toggleAction } = useMe();

  const [tab, setTab] = useState<TabKey>("next");
  const [draft, setDraft] = useState("");
  const [flags, setFlags] = useState<string[]>([]);
  const [myConsent, setMyConsent] = useState(true);
  const [corrOpen, setCorrOpen] = useState(false);
  const [corr, setCorr] = useState("");
  const addRef = useRef<HTMLInputElement>(null);

  /* agenda — the shared lines, then anything she added, flagged items first */
  const agenda: AgendaItem[] = [
    ...MY_ONEONONE.agenda.map((text, i) => ({ key: `shared-${i}`, text, mine: false, ...(AGENDA_NOTE[text] ?? {}) })),
    ...agendaAdds.map((text, i) => ({ key: `mine-${i}`, text, mine: true, note: "You put this on the agenda — your manager sees it before the meeting" })),
  ];
  const ordered = [...agenda].sort((a, b) => Number(flags.includes(b.key)) - Number(flags.includes(a.key)));

  const openMine = MY_ACTIONS.filter((a) => !doneOf(a, actionsDone));
  const openTheirs = THEIR_ACTIONS.filter((a) => !a.done);
  const overdueMine = openMine.filter((a) => OVERDUE.has(a.item));

  const jump = (item: { goTo?: string; tabTo?: string }) => {
    if (item.tabTo) setTab(item.tabTo as TabKey);
    else if (item.goTo) go(item.goTo);
  };

  const submitAgenda = () => {
    const text = draft.trim();
    if (!text) { toast("Type the item you want on today's agenda first"); return; }
    addAgendaItem(text);
    setDraft("");
    toast(`Added to your 1-on-1 with ${MY_MANAGER.name} — “${text}” · marked as added by you`, "success");
  };

  const toggleFlag = (item: AgendaItem) => {
    const on = flags.includes(item.key);
    setFlags((f) => (on ? f.filter((k) => k !== item.key) : [...f, item.key]));
    toast(on ? `Flag cleared — “${item.text}”` : `“${item.text}” flagged to cover first — it moves to the top of your agenda`);
  };

  const tickAction = (a: { item: string; done: boolean }) => {
    const nowDone = !doneOf(a, actionsDone);
    toggleAction(a.item);
    toast(
      nowDone
        ? `Closed — “${a.item}”. It comes off today's agenda with ${MY_MANAGER.name}.`
        : `Reopened — “${a.item}” is back on your list`,
      nowDone ? "success" : "default"
    );
  };

  const raiseTheirs = (item: string) => {
    addAgendaItem(`Check in on: ${item}`);
    toast(`Added to today's agenda — “Check in on: ${item}” · you cannot close ${MY_MANAGER.name}'s item, but you can ask about it`, "success");
  };

  const submitCorrection = () => {
    const text = corr.trim();
    if (!text) { toast("Write what the summary got wrong first"); return; }
    addAgendaItem(`Your note on the last summary — ${text}`);
    setCorr("");
    setCorrOpen(false);
    toast("Your correction is on today's agenda under your name — the AI summary itself is unchanged until you both agree", "ai");
  };

  const focusAdd = () => {
    setTab("next");
    window.setTimeout(() => addRef.current?.focus(), 40);
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ---------------------------------- header --------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your 1-on-1s</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Your recurring conversation with {MY_MANAGER.name} — the agenda you both write, what each of you committed to,
            and what the notes captured. You hold your consent; your manager holds the recording.
          </div>
        </div>
        <PfBtn variant="secondary" icon="megaphone" onClick={() => go("myfeedback")}>Your feedback</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={focusAdd}>Add agenda item</PfBtn>
      </div>

      {/* ---------------------------------- KPI row -------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="chat" tone="purple" label="Next 1-on-1" value="Today" unit="10:00 WAT" delta={MY_MANAGER.name.split(" ")[0]} deltaTone="grey" />
        <PfStat
          icon="clipboard" tone="blue" label="Agenda items" value={agenda.length} unit="for today"
          delta={agendaAdds.length ? `${agendaAdds.length} added by you` : "none added yet"}
          deltaTone={agendaAdds.length ? "green" : "grey"}
        />
        <PfStat
          icon="check" tone={overdueMine.length ? "red" : "green"} label="Your open actions" value={openMine.length} unit="you own"
          delta={overdueMine.length ? `${overdueMine.length} overdue` : "all closed"}
          deltaTone={overdueMine.length ? "red" : "green"}
        />
        <PfStat icon="user" tone="green" label="With your manager" value={openTheirs.length} unit="open" delta="Read-only" deltaTone="grey" />
      </div>

      {/* ----------------------------------- tabs ---------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as TabKey)}
          tabs={[
            { key: "next", label: "Next 1-on-1", count: String(agenda.length) },
            { key: "actions", label: "My action items", count: String(openMine.length) },
            { key: "history", label: "Past notes", count: String(PAST_NOTES.length) },
          ]}
        />
      </div>

      {/* ================================ NEXT 1-ON-1 =============================== */}
      {tab === "next" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {overdueMine.length > 0 && (
            <PfBanner tone="red" icon="warning" cta="open" onCta={() => setTab("actions")}>
              <span style={{ fontWeight: 600 }}>One commitment is overdue going into this 1-on-1 — </span>
              <span style={{ fontWeight: 400 }}>&ldquo;{overdueMine[0].item}&rdquo;, due {overdueMine[0].due}. It is item one on the agenda.</span>
            </PfBanner>
          )}

          {/* ------------------------------ the meeting ------------------------------ */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="chat" tone="purple" size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)" }}>Your 1-on-1 with {MY_MANAGER.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                  {MY_ONEONONE.time} · {MY_MANAGER.role} · recurring
                </div>
              </div>
              <PfBadge tone="purple" dot>Today</PfBadge>
              <PfBtn variant="secondary" icon="calendar" onClick={() => toast(`Calendar reminder set — your 1-on-1 with ${MY_MANAGER.name}, ${MY_ONEONONE.time}`)}>Remind me</PfBtn>
              <PfBtn variant="primary" icon="target" onClick={() => go("mygoals")}>Prep from your goals</PfBtn>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, padding: "14px 20px 16px" }}>
              <Participant
                init={ME_PUBLIC.init} tone={ME_PUBLIC.tone} name="You — participant" badge="This is your record" badgeTone="purple"
                role={ME_PUBLIC.role} note="You write agenda items, tick your own actions and hold your own consent."
              />
              <Participant
                init={MY_MANAGER.init} tone={MY_MANAGER.tone} name={`${MY_MANAGER.name} — your manager`} badge="Runs this meeting" badgeTone="green"
                role={MY_MANAGER.role} note="Schedules the meeting, keeps the notes and holds the recording control."
              />
            </div>
          </PfCard>

          {/* -------------------------------- agenda -------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Today's agenda"
              sub="The shared list. Anything you add is marked as yours and visible to your manager before the meeting."
            >
              <PfBadge tone="grey">{agenda.length} items</PfBadge>
            </PfCardHead>

            {ordered.map((item, i) => (
              <AgendaRow
                key={item.key}
                item={item}
                index={i}
                flagged={flags.includes(item.key)}
                onFlag={() => toggleFlag(item)}
                onOpen={() => jump(item)}
                last={false}
              />
            ))}

            {/* add — the real write, straight into useMe().addAgendaItem */}
            <div style={{ display: "flex", gap: 8, padding: "12px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <input
                ref={addRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitAgenda(); }}
                placeholder="Add something you want to talk about — e.g. cover for the payments on-call week"
                style={{ ...fieldStyle, flex: 1, minWidth: 0 }}
              />
              <PfBtn variant="primary" icon="plus" onClick={submitAgenda}>Add</PfBtn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Your items stay on the agenda whether or not they get covered — nothing you add is removed by anyone else.
            </div>
          </PfCard>

          {/* ------------------------- what the notes captured ------------------------ */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="sparkle" tone="purple" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>What your manager&rsquo;s notes captured</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                  Summarised by AI from {MY_MANAGER.name}&rsquo;s notes on your last 1-on-1
                </div>
              </div>
              <PfBadge tone="purple">AI summary</PfBadge>
            </div>

            <div style={{ padding: "16px 20px" }}>
              <div style={{ borderLeft: "3px solid var(--pf-purple-500)", background: "var(--pf-purple-50)", borderRadius: "0 10px 10px 0", padding: "13px 16px" }}>
                <div style={{ fontSize: 13.5, color: "var(--pf-n900)", lineHeight: 1.6 }}>{MY_ONEONONE.aiSummary}</div>
              </div>

              <div style={{ display: "flex", gap: 9, marginTop: 13, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                <Ic name="info" size={15} color="var(--pf-n400)" />
                <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                  This is a machine reading of your manager&rsquo;s written notes — not a transcript, not a recording, and not
                  a record of what you said. The closing line is a prompt the model suggested to him; you are reading the
                  same text he is. AI proposes, the two of you dispose: it stands until one of you changes it.
                </div>
              </div>

              {corrOpen ? (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    autoFocus
                    value={corr}
                    onChange={(e) => setCorr(e.target.value)}
                    placeholder="What did the summary get wrong, or what would you put differently?"
                    rows={3}
                    style={{ ...fieldStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <PfBtn small variant="ghost" onClick={() => { setCorrOpen(false); setCorr(""); }}>Cancel</PfBtn>
                    <PfBtn small variant="primary" onClick={submitCorrection}>Put it on the agenda</PfBtn>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 13, flexWrap: "wrap" }}>
                  <PfBtn
                    variant="primary" tone={TONE.purple.bg}
                    style={{ boxShadow: "0 6px 12px -6px rgba(175,82,222,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
                    icon="check"
                    onClick={() => toast("Marked as a fair summary — noted on your side of the record", "success")}
                  >
                    That matches
                  </PfBtn>
                  <PfBtn variant="secondary" icon="chat" onClick={() => setCorrOpen(true)}>Say it differently</PfBtn>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Your reply goes on today&rsquo;s agenda under your name.</span>
                </div>
              )}
            </div>
          </PfCard>

          {/* ------------------------- consent & recording (read-only) ---------------- */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="mic" tone="red" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>Recording &amp; AI summary</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                  {MY_MANAGER.name} controls recording for this 1-on-1 — you are seeing that control, not holding it.
                </div>
              </div>
              <PfBadge tone="grey">Off · notes only</PfBadge>
            </div>

            <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11, flexWrap: "wrap" }}>
                  <Ic name="shield" size={15} color="var(--pf-primary-600)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Consent gate</span>
                  <PfBadge tone="green">Both participants must consent · NDPR</PfBadge>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <Toggle
                      on={myConsent}
                      onClick={() => {
                        const next = !myConsent;
                        setMyConsent(next);
                        toast(
                          next
                            ? "Your consent is on — an AI summary of your 1-on-1 may be generated while both consents stand. Timestamped in the audit trail."
                            : "Your consent withdrawn — no AI summary of your 1-on-1 can be generated until you turn it back on. Timestamped in the audit trail.",
                          next ? "success" : "danger"
                        );
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>You — participant</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>Yours to give or withdraw, at any time, without asking anyone.</div>
                    </div>
                    <PfBadge tone={myConsent ? "green" : "red"}>{myConsent ? "Given" : "Withdrawn"}</PfBadge>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <Toggle on held onClick={() => toast(`${MY_MANAGER.name}'s consent is his to give or withdraw — it is read-only here, exactly as yours is on his page`)} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{MY_MANAGER.name} — your manager</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>His to hold. You can see the state, you cannot set it.</div>
                    </div>
                    <PfBadge tone="grey">Read-only</PfBadge>
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 11, lineHeight: 1.6 }}>
                  A summary can only be generated while <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>both</span> consents are on —
                  one withdrawal is enough to stop it. Every consent change, yours and his, is written to the audit trail with a timestamp.
                </div>
              </div>

              {/* the manager's control, shown but not held */}
              <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                <button
                  onClick={() => toast(`Recording is ${MY_MANAGER.name}'s control — he starts and stops it. What is yours is the consent above.`)}
                  style={{
                    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 500,
                    padding: "7px 12px", borderRadius: 8, cursor: "not-allowed", color: "var(--pf-n400)",
                    background: "var(--pf-n50)", border: "1px solid var(--pf-n100)",
                  }}
                >
                  <Ic name="mic" size={15} color="var(--pf-n400)" />
                  Start recording
                  <Ic name="shield" size={13} color="var(--pf-n300)" />
                </button>
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                  Held by {MY_MANAGER.name}. Notes-only is the default, and today&rsquo;s 1-on-1 is running that way.
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "11px 14px" }}>
                <Ic name="file" size={15} color="var(--pf-primary-600)" />
                <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-primary-600)", fontWeight: 500 }}>
                  Your own audit trail — every consent change and every edit you make — is readable on your data &amp; privacy page.
                </span>
                <PfBtn small variant="secondary" onClick={() => go("myprivacy")}>Open it</PfBtn>
              </div>
            </div>
          </PfCard>

          <PfBanner cta="open" onCta={() => go("mygoals")}>
            <span style={{ fontWeight: 600 }}>Check in on your goals before 10:00 — </span>
            <span style={{ fontWeight: 400 }}>you and {MY_MANAGER.name} then read the same numbers in the meeting instead of reconciling them in it.</span>
          </PfBanner>
        </div>
      )}

      {/* =============================== ACTION ITEMS =============================== */}
      {tab === "actions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* hers — tickable */}
          <PfCard>
            <PfCardHead
              title="What you committed to"
              sub={`Yours to close. Tick one and it comes off the agenda with ${MY_MANAGER.name}.`}
            >
              <PfBadge tone={overdueMine.length ? "red" : "green"}>{openMine.length} open</PfBadge>
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 20px 9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh style={{ flex: 1 }}>Commitment</PfTh>
              <PfTh style={{ flex: "none", width: 92 }}>Due</PfTh>
              <PfTh style={{ flex: "none", width: 116, textAlign: "right" }}>Status</PfTh>
            </div>

            {MY_ACTIONS.map((a, i) => (
              <MyActionRow
                key={a.item}
                item={a.item}
                due={a.due}
                done={doneOf(a, actionsDone)}
                overdue={OVERDUE.has(a.item)}
                onToggle={() => tickAction(a)}
                last={i === MY_ACTIONS.length - 1}
              />
            ))}

            {overdueMine.length > 0 && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <Ic name="info" size={15} color="var(--pf-n400)" />
                <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                  This one has been open since {overdueMine[0].due} and it leads today&rsquo;s agenda. The work behind it now has a
                  goal of its own — <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{MY_NUDGE_GOAL.title}</span>, due {MY_NUDGE_GOAL.due}.
                  Closing the goal is the honest way to close this.
                </div>
                <PfBtn small variant="secondary" onClick={() => go("mygoals")}>Open that goal</PfBtn>
              </div>
            )}
          </PfCard>

          {/* his — read-only */}
          <PfCard>
            <PfCardHead
              title={`What ${MY_MANAGER.name} committed to`}
              sub="His side of the same conversation. Visible to you, closed only by him."
            >
              <PfBadge tone="grey">Read-only</PfBadge>
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh style={{ flex: 1 }}>Commitment</PfTh>
              <PfTh style={{ flex: "none", width: 92 }}>Due</PfTh>
              <PfTh style={{ flex: "none", width: 116, textAlign: "right" }}>Status</PfTh>
            </div>

            {THEIR_ACTIONS.map((a, i) => (
              <TheirActionRow
                key={a.item}
                item={a.item}
                due={a.due}
                done={a.done}
                onAgenda={() => raiseTheirs(a.item)}
                last={i === THEIR_ACTIONS.length - 1}
              />
            ))}

            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
              <Ic name="shield" size={15} color="var(--pf-n300)" />
              <span>
                An item is closed by whoever owes it — so there is no tick here, only a way to raise it. Both directions of the
                commitment are on this page so the record is not one-sided.
              </span>
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================ PAST NOTES ================================ */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead
              title="What is on file"
              sub="The themes and the one summary your 1-on-1s have left behind — nothing else is stored."
            >
              <PfBadge tone="grey">{PAST_NOTES.length} entries</PfBadge>
            </PfCardHead>

            {PAST_NOTES.map((n, i) => (
              <PastRow key={n.title} note={n} onOpen={() => jump(n)} last={i === PAST_NOTES.length - 1} />
            ))}
          </PfCard>

          <PfCard pad="14px 20px 16px">
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
              <PfTile icon="lifebuoy" tone="blue" size={28} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>What this list is not</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>
              These are the shared notes, not a transcript and not your manager&rsquo;s private notes — those are his, and they do
              not appear here or anywhere else you can reach. Nothing older than your last 1-on-1 is on file: a session that
              leaves no shared note leaves no record. The list is short because the gap is real, not because it is hidden from you.
            </div>
          </PfCard>

          <PfBanner tone="blue" icon="file" cta="open" onCta={() => go("myprivacy")}>
            <span style={{ fontWeight: 600 }}>Want the full record held about you? </span>
            <span style={{ fontWeight: 400 }}>Your data &amp; privacy page lists every field, who can see it, and how to ask for a copy.</span>
          </PfBanner>
        </div>
      )}
    </div>
  );
}
