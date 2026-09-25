"use client";
import { useEffect, useState } from "react";
import { PfCard, PfBadge, PfBtn, PfTile, PfAvatar, PfTh, PfPageTabs } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { ONE_ON_ONES, type OneOnOne } from "@/data/talentos";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

/* ------------------------------------------------------------------ */
/* 1-on-1s — FR-068: calendar scheduling · agenda templates · consent- */
/* gated recording → transcription → AI summary → tracked action items */
/* ------------------------------------------------------------------ */

type Mtg = OneOnOne & { id: string; dur: string; tpl?: string };
type TrackRow = {
  id: string; src: string; withName: string; item: string; owner: string;
  due: string; done: boolean; ai?: boolean; overdue?: boolean;
};
type Phase = "idle" | "rec" | "gen" | "sum";

const OVERDUE = new Set(["Share design-system migration plan"]);

const INIT_MTGS: Mtg[] = ONE_ON_ONES.map((m, i) => ({
  ...m, id: `m${i}`, dur: "30 min",
  tpl: i === 1 ? "Onboarding 30-day" : i === 2 ? "Offboarding handover" : "Growth",
}));

const INIT_TRACKER: TrackRow[] = INIT_MTGS.flatMap((m) =>
  m.actions.map((a, i) => ({
    id: `${m.id}-a${i}`, src: m.id, withName: m.with, item: a.item,
    owner: a.owner, due: a.due, done: a.done, overdue: OVERDUE.has(a.item),
  }))
);

const PEOPLE = [
  { name: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer" },
  { name: "Chidi Okeke", init: "CO", tone: "#E81E17", role: "Backend Engineer" },
  { name: "Tunde Bakare", init: "TB", tone: "#EBA308", role: "Product Manager" },
  { name: "Adaeze Okafor", init: "AD", tone: "#16B364", role: "Senior Product Designer" },
  { name: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead" },
  { name: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Finance Analyst" },
];

const SLOTS = ["Today · 16:00", "Tomorrow · 09:30", "Thu · 11:00", "Fri · 14:00"];

const TEMPLATES: Record<string, string[]> = {
  "Weekly check-in": ["Wins & blockers", "Priorities for the week", "Support needed"],
  Growth: ["Career aspirations", "Skill-gap review", "Next growth step"],
  "Onboarding 30-day": ["30-day check-in", "First goals draft", "Buddy pairing feedback"],
  "Offboarding handover": ["Handover map", "Knowledge-transfer sessions", "Alumni-network invite"],
};

const SUMMARIES: Record<string, { bullets: string[]; extracted: { item: string; owner: string; due: string }[] }> = {
  m0: {
    bullets: [
      "Migration plan unblocked — Amara ships the trimmed, checkout-first plan this week; the overdue follow-up closes.",
      "Promotion path: agreed to draft Staff-track expectations plus a panel dry-run before the Q3 review cycle.",
      "Workload: payments crunch acknowledged — one on-call rotation dropped for the next two weeks.",
    ],
    extracted: [
      { item: "Send trimmed migration plan (checkout scope)", owner: "Amara", due: "Jul 3" },
      { item: "Draft Staff-track expectations doc", owner: "You", due: "Jul 8" },
      { item: "Drop one payments on-call rotation (2 wks)", owner: "You", due: "Jul 10" },
    ],
  },
  m1: {
    bullets: [
      "30-day check-in: ramp on track — staging DB access resolved, first PRs merged.",
      "First goals drafted — two starter OKRs to be entered into Goals & OKRs this week.",
      "Buddy pairing is working; cadence moves to twice-weekly through week 6.",
    ],
    extracted: [
      { item: "Enter starter OKRs into Goals & OKRs", owner: "Chidi", due: "Jul 8" },
      { item: "Book week-6 ramp review", owner: "You", due: "Jul 11" },
    ],
  },
  m2: {
    bullets: [
      "Handover map reviewed — 8 of 11 items now have named owners.",
      "Two knowledge-transfer sessions booked: payments roadmap and vendor contracts.",
      "Alumni-network invite accepted — boomerang flag set in Offboarding.",
    ],
    extracted: [
      { item: "Assign owners to remaining 3 handover items", owner: "You", due: "Jul 4" },
      { item: "File KT session notes to Talent Library", owner: "Tunde", due: "Jul 9" },
    ],
  },
};

function summaryFor(m: Mtg) {
  return (
    SUMMARIES[m.id] ?? {
      bullets: [
        `${m.agenda[0] ?? "Check-in"} covered — aligned on next steps and owners.`,
        "Sentiment steady vs the last conversation; no risk flags raised.",
        "Two commitments made in the room — owners and dates confirmed.",
      ],
      extracted: [
        { item: `Follow up: ${(m.agenda[0] ?? "check-in").toLowerCase()}`, owner: m.with.split(" ")[0], due: "Jul 9" },
        { item: "Share recap in Feedback Hub", owner: "You", due: "Jul 7" },
      ],
    }
  );
}

function liveLines(m: Mtg): { at: number; who: string; txt: string }[] {
  if (m.id === "m0")
    return [
      { at: 2, who: "AO", txt: "“The migration plan is ready — I trimmed scope to the checkout surfaces first.”" },
      { at: 5, who: "You", txt: "“Let's get concrete on Staff-track — what does the next level look like for you?”" },
      { at: 9, who: "AO", txt: "“Honestly, clarity on the timeline matters more to me than the title itself.”" },
    ];
  return [
    { at: 2, who: m.init, txt: `“${m.agenda[0] ?? "Quick check-in"} — here's where things stand this week…”` },
    { at: 5, who: "You", txt: "“Noted — let's turn that into a concrete owner and a date.”" },
    { at: 9, who: m.init, txt: "“Works for me — I can pick that up before our next session.”" },
  ];
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* ------------------------------ atoms ------------------------------ */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5,
        fontWeight: 500, padding: "7px 12px", borderRadius: 99, cursor: "pointer",
        border: `1px solid ${active ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
        background: active ? "var(--pf-primary-50)" : "var(--pf-n0)",
        color: active ? "var(--pf-primary-600)" : "var(--pf-n500)", transition: "all .12s",
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        width: 36, height: 21, borderRadius: 99, flex: "none", padding: 0, position: "relative",
        border: `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
        background: on ? "var(--pf-primary-500)" : "var(--pf-n50)",
        cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, transition: "background .15s",
      }}
    >
      <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 15, height: 15, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(2,6,23,.25)", transition: "left .15s" }} />
    </button>
  );
}

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 17, height: 17, borderRadius: 5, flex: "none", display: "inline-flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", padding: 0,
        border: `1.4px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n300)"}`,
        background: on ? "var(--pf-primary-500)" : "var(--pf-n0)", transition: "background .12s",
      }}
    >
      {on && <Ic name="check" size={11} color="#fff" weight={3} />}
    </button>
  );
}

function OwnerChip({ owner }: { owner: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 99, padding: "2px 9px 2px 3px", fontSize: 12, fontWeight: 500, color: "var(--pf-n600)", whiteSpace: "nowrap" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", background: owner === "You" ? "var(--pf-n900)" : "var(--pf-primary-500)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700 }}>
        {owner[0]}
      </span>
      {owner}
    </span>
  );
}

function MtgRow({ m, active, openActs, onClick }: { m: Mtg; active: boolean; openActs: number; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{
        cursor: "pointer", background: "var(--pf-n0)", borderRadius: 12, padding: 14,
        border: `1px solid ${active ? "var(--pf-primary-500)" : hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`,
        boxShadow: active ? "0 0 0 3px var(--pf-primary-50)" : "0 1px 3px #F3F3F3",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PfAvatar init={m.init} tone={m.tone} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.with}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.role}</div>
        </div>
        {m.state === "today" ? <PfBadge tone="green" dot>Today</PfBadge> : <PfBadge tone="grey">Upcoming</PfBadge>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "3px 8px" }}>
          <Ic name="clock" size={12} color="var(--pf-n400)" />
          {m.time}
        </span>
        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
          {m.agenda.length} agenda · {openActs} open action{openActs === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ screen ------------------------------ */

export default function OneOnOnes() {
  const go = useGo();
  const toast = useToast();

  const [meetings, setMeetings] = useState<Mtg[]>(INIT_MTGS);
  const [sel, setSel] = useState(0);
  const [tracker, setTracker] = useState<TrackRow[]>(INIT_TRACKER);
  const [agendaDone, setAgendaDone] = useState<Record<string, boolean>>({});
  const [consent, setConsent] = useState<Record<string, { me: boolean; them: boolean }>>({});
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [secs, setSecs] = useState<Record<string, number>>({});
  const [tab, setTab] = useState("meetings");

  const [panelOpen, setPanelOpen] = useState(false);
  const [schedWith, setSchedWith] = useState("Adaeze Okafor");
  const [schedTime, setSchedTime] = useState(SLOTS[1]);
  const [schedTpl, setSchedTpl] = useState("Weekly check-in");

  const m = meetings[Math.min(sel, meetings.length - 1)];
  const ph: Phase = phase[m.id] ?? "idle";
  const cons = consent[m.id] ?? { me: false, them: false };
  const bothOn = cons.me && cons.them;
  const elapsed = secs[m.id] ?? 0;
  const first = m.with.split(" ")[0];

  useEffect(() => {
    if (ph !== "rec") return;
    const t = setInterval(() => setSecs((s) => ({ ...s, [m.id]: (s[m.id] ?? 0) + 1 })), 1000);
    return () => clearInterval(t);
  }, [ph, m.id]);

  const setCons = (k: "me" | "them") => {
    const next = { ...cons, [k]: !cons[k] };
    setConsent((c) => ({ ...c, [m.id]: next }));
    if (next.me && next.them) toast("Consent logged for both participants — recording unlocked · NDPR audit entry created", "success");
  };

  const startRec = () => {
    if (!bothOn) {
      toast("Recording locked — both participants must consent first (NDPR)", "danger");
      return;
    }
    setSecs((s) => ({ ...s, [m.id]: 0 }));
    setPhase((p) => ({ ...p, [m.id]: "rec" }));
    toast(`Recording started — ${m.with}'s 1-on-1 · live transcription on (interview ASR)`, "ai");
  };

  const stopRec = () => {
    const mm = m;
    setPhase((p) => ({ ...p, [mm.id]: "gen" }));
    toast("Recording stopped — transcribing final segment…", "default");
    setTimeout(() => {
      const sum = summaryFor(mm);
      setPhase((p) => ({ ...p, [mm.id]: "sum" }));
      setTracker((t) =>
        t.some((r) => r.src === mm.id && r.ai)
          ? t
          : [
              ...t,
              ...sum.extracted.map((e, i) => ({
                id: `${mm.id}-x${i}`, src: mm.id, withName: mm.with, item: e.item,
                owner: e.owner, due: e.due, done: false, ai: true,
              })),
            ]
      );
      toast(`AI summary ready — ${sum.extracted.length} action items extracted with owners & due dates`, "ai");
    }, 1300);
  };

  const resetRec = () => {
    setPhase((p) => ({ ...p, [m.id]: "idle" }));
    setSecs((s) => ({ ...s, [m.id]: 0 }));
    toast(`Recorder reset for ${first} — previous summary kept in Action items`, "default");
  };

  const saveSchedule = () => {
    const p = PEOPLE.find((x) => x.name === schedWith);
    if (!p) return;
    const mtg: Mtg = {
      id: `m${meetings.length}-${schedWith.length}`, with: p.name, init: p.init, tone: p.tone, role: p.role,
      time: schedTime, dur: "30 min", state: schedTime.startsWith("Today") ? "today" : "upcoming",
      agenda: TEMPLATES[schedTpl], actions: [], tpl: schedTpl,
    };
    setMeetings((ms) => [...ms, mtg]);
    setSel(meetings.length);
    setPanelOpen(false);
    toast(`1-on-1 with ${p.name} scheduled — ${schedTime} · ${schedTpl} agenda applied · calendar invite sent`, "success");
  };

  const summary = summaryFor(m);
  const extractedRows = tracker.filter((r) => r.src === m.id && r.ai);
  const visibleLines = liveLines(m).filter((l) => elapsed >= l.at);
  const openTracker = tracker.filter((r) => !r.done);
  const overdueCount = openTracker.filter((r) => r.overdue).length;
  const doneCount = tracker.length - openTracker.length;
  const sortedTracker = [...tracker].sort((a, b) => Number(a.done) - Number(b.done) || Number(b.overdue ?? false) - Number(a.overdue ?? false));
  const agendaPrepped = m.agenda.filter((_, i) => agendaDone[`${m.id}::${i}`]).length;

  const quote = m.aiSummary
    ? m.aiSummary
    : m.tpl === "Onboarding 30-day"
      ? `First cycle with ${first} — agenda seeded from the Onboarding 30-day template. Themes will build from this conversation.`
      : m.tpl === "Offboarding handover"
        ? "Offboarding in motion — agenda seeded from the handover template; knowledge-transfer status pulled from Offboarding."
        : `Agenda seeded from the ${m.tpl ?? "Weekly check-in"} template — 1-on-1 themes will build after this first conversation.`;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      <style>{`
        @keyframes pfRecPulse { 0% { box-shadow: 0 0 0 0 rgba(232,30,23,.35); } 100% { box-shadow: 0 0 0 9px rgba(232,30,23,0); } }
        @keyframes pfBlink { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes pfLineIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* ------------------------------ header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>1-on-1s</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Agendas, consent-gated recordings and AI summaries — action items tracked to the next meeting
          </div>
        </div>
        <PfBtn variant="primary" icon="plus" onClick={() => setPanelOpen((v) => !v)}>
          Schedule 1-on-1
        </PfBtn>
      </div>

      {/* -------------------------- schedule panel -------------------------- */}
      {panelOpen && (
        <PfCard style={{ marginTop: 16, boxShadow: "0 1px 3px #F3F3F3" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTile icon="calendar" tone="green" size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>New 1-on-1</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Booked through your connected calendar (Google Calendar) — FR-068</div>
            </div>
            <PfBtn small variant="ghost" icon="x" onClick={() => setPanelOpen(false)} />
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 13 }}>
            <div>
              <PfTh style={{ marginBottom: 7 }}>WITH</PfTh>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {PEOPLE.map((p) => (
                  <Chip key={p.name} active={schedWith === p.name} onClick={() => setSchedWith(p.name)}>
                    <PfAvatar init={p.init} tone={p.tone} size={18} />
                    {p.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <PfTh style={{ marginBottom: 7 }}>TIME</PfTh>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {SLOTS.map((s) => (
                  <Chip key={s} active={schedTime === s} onClick={() => setSchedTime(s)}>
                    <Ic name="clock" size={13} />
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <PfTh style={{ marginBottom: 7 }}>AGENDA TEMPLATE</PfTh>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {Object.keys(TEMPLATES).map((t) => (
                  <Chip key={t} active={schedTpl === t} onClick={() => setSchedTpl(t)}>
                    <Ic name="clipboard" size={13} />
                    {t}
                  </Chip>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 7 }}>
                Template seeds: {TEMPLATES[schedTpl].join(" · ")}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid var(--pf-n50)", paddingTop: 13 }}>
              <PfBtn variant="secondary" onClick={() => setPanelOpen(false)}>Cancel</PfBtn>
              <PfBtn variant="primary" icon="paperplane" onClick={saveSchedule}>Save & send invite</PfBtn>
            </div>
          </div>
        </PfCard>
      )}

      {/* --------------------------- section tabs --------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "meetings", label: "Meetings", count: String(meetings.length) },
            { key: "actions", label: "Action items", count: String(openTracker.length) },
          ]}
        />
      </div>

      {/* --------------------- meetings — list + detail --------------------- */}
      {tab === "meetings" && (
      <div style={{ display: "grid", gridTemplateColumns: "352px 1fr", gap: 12, alignItems: "start" }}>
        {/* LEFT — schedule list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 2px 4px" }}>
            <PfTh>THIS WEEK</PfTh>
            <PfBadge tone="grey">{meetings.length} scheduled</PfBadge>
          </div>
          {meetings.map((mtg, i) => (
            <MtgRow
              key={mtg.id}
              m={mtg}
              active={i === Math.min(sel, meetings.length - 1)}
              openActs={tracker.filter((r) => r.src === mtg.id && !r.done).length}
              onClick={() => setSel(i)}
            />
          ))}
          <div style={{ fontSize: 12, color: "var(--pf-n300)", padding: "6px 4px", display: "flex", alignItems: "center", gap: 6 }}>
            <Ic name="calendar" size={13} />
            Synced from Google Calendar · updated 2 min ago
          </div>
        </div>

        {/* RIGHT — meeting detail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* meeting header */}
          <PfCard pad={18}>
            <div style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
              <PfAvatar init={m.init} tone={m.tone} size={44} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{m.with}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 1 }}>{m.role}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, flexWrap: "wrap" }}>
                  {m.state === "today" ? <PfBadge tone="green" dot>Today</PfBadge> : <PfBadge tone="grey">Upcoming</PfBadge>}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n600)" }}>{m.time} · {m.dur}</span>
                  <PfBadge tone="blue">{m.tpl ?? "Growth"} template</PfBadge>
                </div>
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <PfBtn variant="ghost" icon="user" onClick={() => go("employee")}>Profile</PfBtn>
                <PfBtn variant="secondary" icon="calendar" onClick={() => toast(`Reschedule proposed to ${first} — 3 alternative slots sent via calendar`)}>
                  Reschedule
                </PfBtn>
                <PfBtn variant="primary" icon="play" onClick={() => toast(`Joining ${m.with}'s 1-on-1 — Google Meet link opened from your calendar`)}>
                  Join
                </PfBtn>
              </div>
            </div>
          </PfCard>

          {/* AI-prepared agenda */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="sparkle" tone="purple" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>✦ AI-prepared agenda</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Prepared from last week&apos;s action items + 1-on-1 themes</div>
              </div>
              <PfBadge tone={agendaPrepped === m.agenda.length ? "green" : "grey"}>{agendaPrepped}/{m.agenda.length} prepped</PfBadge>
            </div>
            <div style={{ padding: "12px 20px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {m.agenda.map((a, i) => {
                  const k = `${m.id}::${i}`;
                  const on = !!agendaDone[k];
                  return (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < m.agenda.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                      <Check on={on} onClick={() => setAgendaDone((d) => ({ ...d, [k]: !d[k] }))} />
                      <span style={{ fontSize: 13.5, color: on ? "var(--pf-n300)" : "var(--pf-n900)", textDecoration: on ? "line-through" : "none" }}>{a}</span>
                      {a.toLowerCase().includes("overdue") && !on && <PfBadge tone="red">carried over</PfBadge>}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, background: "var(--pf-purple-50)", borderLeft: "3px solid var(--pf-purple-500)", borderRadius: 8, padding: "10px 13px" }}>
                <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.55 }}>{quote}</div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", marginTop: 6 }}>
                  ✦ Signal from last week&apos;s 1-on-1 · confidence 82% · AI proposes — you decide what to raise
                </div>
              </div>
            </div>
          </PfCard>

          {/* Recording flow */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="mic" tone="red" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>Recording & AI summary</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Consent → record → transcribe → summary → action items</div>
              </div>
              {ph === "idle" && <PfBadge tone="grey">Off</PfBadge>}
              {ph === "rec" && <PfBadge tone="red" dot>Recording · {fmt(elapsed)}</PfBadge>}
              {ph === "gen" && <PfBadge tone="yellow">Processing…</PfBadge>}
              {ph === "sum" && <PfBadge tone="green">Summary ready</PfBadge>}
            </div>

            <div style={{ padding: "14px 20px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
              {/* consent gate */}
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Ic name="shield" size={15} color="var(--pf-primary-600)" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Consent gate</span>
                  <PfBadge tone="green">Both participants must consent · NDPR</PfBadge>
                </div>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Toggle on={cons.me} onClick={() => setCons("me")} disabled={ph !== "idle"} />
                    <span style={{ fontSize: 13, color: "var(--pf-n600)" }}>You — manager</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Toggle on={cons.them} onClick={() => setCons("them")} disabled={ph !== "idle"} />
                    <span style={{ fontSize: 13, color: "var(--pf-n600)" }}>{m.with} — participant</span>
                  </div>
                </div>
                {!bothOn && ph === "idle" && (
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 9 }}>
                    Recording unlocks when both consents are on — each consent is written to the NDPR audit trail.
                  </div>
                )}
              </div>

              {/* controls / live states */}
              {ph === "idle" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfBtn
                    variant="primary"
                    icon="mic"
                    onClick={startRec}
                    style={!bothOn ? { opacity: 0.45, background: "var(--pf-n400)" } : { background: "var(--pf-red-500)" }}
                  >
                    ● Start recording
                  </PfBtn>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Optional — notes-only mode stays available without recording</span>
                </div>
              )}

              {(ph === "rec" || ph === "gen") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--pf-red-500)", animation: ph === "rec" ? "pfRecPulse 1.2s infinite" : "none", flex: "none" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                      {ph === "rec" ? `Recording · ${fmt(elapsed)}` : "Transcribing & summarizing…"}
                    </span>
                    {ph === "rec" && (
                      <PfBtn variant="danger" small icon="pause" onClick={stopRec} style={{ marginLeft: "auto" }}>
                        Stop → Generate summary
                      </PfBtn>
                    )}
                    {ph === "gen" && (
                      <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--pf-purple-500)", fontWeight: 500, animation: "pfBlink 1.1s infinite" }}>
                        ✦ interview ASR working…
                      </span>
                    )}
                  </div>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "11px 13px", display: "flex", flexDirection: "column", gap: 7 }}>
                    <PfTh>LIVE TRANSCRIPT</PfTh>
                    {visibleLines.length === 0 && <span style={{ fontSize: 13, color: "var(--pf-n300)", animation: "pfBlink 1.2s infinite" }}>Listening…</span>}
                    {visibleLines.map((l) => (
                      <div key={l.at} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--pf-n600)", animation: "pfLineIn .25s ease" }}>
                        <span style={{ fontWeight: 600, color: "var(--pf-n900)", flex: "none" }}>{l.who} · {fmt(l.at)}</span>
                        <span style={{ lineHeight: 1.5 }}>{l.txt}</span>
                      </div>
                    ))}
                    {ph === "rec" && visibleLines.length > 0 && (
                      <span style={{ fontSize: 12, color: "var(--pf-n300)", animation: "pfBlink 1.2s infinite" }}>Transcribing…</span>
                    )}
                  </div>
                </div>
              )}

              {ph === "sum" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <PfBadge tone="grey">Transcript · {fmt(elapsed)} · stored with consent receipt</PfBadge>
                    <PfBtn small variant="ghost" icon="download" onClick={() => toast(`Transcript of ${first}'s 1-on-1 exported (access-logged)`, "default")}>
                      Transcript
                    </PfBtn>
                    <PfBtn small variant="ghost" icon="arrowright" onClick={resetRec} style={{ marginLeft: "auto" }}>
                      Re-record
                    </PfBtn>
                  </div>

                  <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "13px 15px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-purple-500)", marginBottom: 8 }}>✦ AI summary</div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                      {summary.bullets.map((b, i) => (
                        <li key={i} style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.55 }}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Extracted action items</span>
                      <PfBadge tone="purple">✦ {extractedRows.length} extracted</PfBadge>
                    </div>
                    <div style={{ border: "1px solid var(--pf-n100)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 118px 64px 44px", gap: 10, alignItems: "center", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)", padding: "8px 13px" }}>
                        <PfTh>ITEM</PfTh><PfTh>OWNER</PfTh><PfTh>DUE</PfTh><PfTh>DONE</PfTh>
                      </div>
                      {extractedRows.map((r, i) => (
                        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 118px 64px 44px", gap: 10, alignItems: "center", padding: "9px 13px", borderBottom: i < extractedRows.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                          <span style={{ fontSize: 13, color: r.done ? "var(--pf-n300)" : "var(--pf-n900)", textDecoration: r.done ? "line-through" : "none" }}>{r.item}</span>
                          <OwnerChip owner={r.owner} />
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>{r.due}</span>
                          <Check on={r.done} onClick={() => setTracker((t) => t.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                      <Ic name="info" size={13} color="var(--pf-n300)" />
                      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Reuses the interview ASR stack (Stage 6) · items auto-tracked to the next meeting</span>
                      <PfBtn small variant="ghost" icon="chat" style={{ marginLeft: "auto" }} onClick={() => toast(`Summary shared to Feedback Hub — visible to you and ${m.with}`, "success")}>
                        Share to Feedback Hub
                      </PfBtn>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </PfCard>

        </div>
      </div>
      )}

      {/* ----------------------- Action-items tracker tab ----------------------- */}
      {tab === "actions" && (
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="clipboard" tone="blue" size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)" }}>Action items</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>Open items across meetings — tracked to the next meeting</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <PfBadge tone="grey">{openTracker.length} open</PfBadge>
                {overdueCount > 0 && <PfBadge tone="red">{overdueCount} overdue</PfBadge>}
                <PfBadge tone="green">{doneCount} done</PfBadge>
              </div>
            </div>
            <div style={{ padding: "6px 20px 12px" }}>
              {sortedTracker.length === 0 && (
                <div style={{ padding: "18px 0", fontSize: 13, color: "var(--pf-n300)", textAlign: "center" }}>No action items yet — record a 1-on-1 to extract some.</div>
              )}
              {sortedTracker.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: i < sortedTracker.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                  <Check on={r.done} onClick={() => setTracker((t) => t.map((x) => (x.id === r.id ? { ...x, done: !x.done } : x)))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 13.5, color: r.done ? "var(--pf-n300)" : "var(--pf-n900)", textDecoration: r.done ? "line-through" : "none" }}>{r.item}</span>
                      {r.ai && <PfBadge tone="purple">✦ extracted</PfBadge>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>1-on-1 · {r.withName}</div>
                  </div>
                  <OwnerChip owner={r.owner} />
                  {r.done ? (
                    <PfBadge tone="green">Done</PfBadge>
                  ) : r.overdue ? (
                    <PfBadge tone="red">Due {r.due} · overdue</PfBadge>
                  ) : (
                    <PfBadge tone="grey">Due {r.due}</PfBadge>
                  )}
                </div>
              ))}
            </div>
          </PfCard>
      )}
    </div>
  );
}
