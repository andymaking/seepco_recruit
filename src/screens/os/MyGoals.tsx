"use client";
import { useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfSegments,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useMe } from "@/state/me";
import {
  MY_GOALS, MY_NUDGE_GOAL, MY_OKR, MY_LADDER, MY_CHECKINS, MY_ACTIONS,
  MY_MANAGER, MY_CYCLE, type MyGoal,
} from "@/data/me";

/**
 * My goals & check-ins — the Me pillar's goal surface, written from the
 * SUBJECT's side. Everything here is one person's record: her goals, her
 * check-in ledger, and the chain her individual objective ladders into.
 *
 * What deliberately does NOT appear (all of it renders on /goals, which is the
 * manager's read of the same data): the colleague owner-picker, the AI tab that
 * proposes edits to other people's key results, the org goal strip and the
 * on-track KPI row. Nobody else's objectives, and nobody else's progress
 * against them, is hers to see — and the ladder tab says so out loud.
 */

/* --------------------------------- types ---------------------------------- */

type LedgerRow = { goalId: string; at: string; from: number; to: number; live: boolean };

type Tier = {
  key: string; rank: string; icon: string; tone: PfTone;
  id: string; owner: string; objective: string; quarter: string; mine?: boolean;
};

type Feed = { label: string; tone: PfTone; note: string };

/* ---------------------------------- data ---------------------------------- */

/** Her chain only — company → department → hers. Sibling ICs' objectives never load. */
const TIERS: Tier[] = [
  {
    key: "company", rank: "Company objective", icon: "orbit", tone: "purple",
    id: MY_LADDER.company.id, owner: MY_LADDER.company.owner,
    objective: MY_LADDER.company.objective, quarter: MY_LADDER.company.quarter,
  },
  {
    key: "department", rank: "Department objective", icon: "stack", tone: "blue",
    id: MY_LADDER.department.id, owner: MY_LADDER.department.owner,
    objective: MY_LADDER.department.objective, quarter: MY_LADDER.department.quarter,
  },
  {
    key: "mine", rank: "Your objective", icon: "target", tone: "green",
    id: MY_OKR.id, owner: "You", objective: MY_OKR.objective, quarter: MY_OKR.quarter, mine: true,
  },
];

/** Where each goal lands on the ladder. Goals you add yourself start unlinked. */
const FEEDS: Record<string, Feed> = {
  g1: {
    label: `Your objective · ${MY_OKR.id}`, tone: "green",
    note: "Uptime work moves both of your key results — p95 checkout latency and incident MTTR.",
  },
  g2: {
    label: `Your objective · ${MY_OKR.id}`, tone: "green",
    note: "Two more engineers ready for the incident rota is what takes MTTR under 45 minutes.",
  },
  g3: {
    label: `Department · ${MY_LADDER.department.id}`, tone: "blue",
    note: "Migrating your squad contributes straight to the design system every squad builds on.",
  },
};

const UNLINKED: Feed = {
  label: "Not linked yet", tone: "grey",
  note: `Goals you add yourself start unlinked — pick the objective it serves in your next check-in with ${MY_MANAGER.name}.`,
};

const STATUS: Record<string, { label: string; tone: PfTone }> = {
  "on-track": { label: "On track", tone: "green" },
  "at-risk": { label: "At risk", tone: "yellow" },
  behind: { label: "Behind", tone: "yellow" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DUE_CHOICES = ["Aug 31", "Sep 30", "Oct 31", "Dec 31"];

const FILTERS = ["All", "On track", "Needs a nudge"];

const STEP = 2;

const shortTitle = (t: string) => t.split(" — ")[0];

const dueKey = (d: string) => {
  const [m, day] = d.split(" ");
  const i = MONTHS.indexOf(m);
  return i < 0 ? 9999 : i * 100 + (Number(day) || 0);
};

const statusOf = (s: string) => STATUS[s] ?? { label: s, tone: "grey" as PfTone };

const feedFor = (id: string): Feed => FEEDS[id] ?? UNLINKED;

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none",
} as const;

/* ------------------------------ step control ------------------------------- */

function StepBtn({ dir, onClick }: { dir: -1 | 1; onClick: () => void }) {
  return (
    <PfBtn
      small variant="secondary" onClick={onClick}
      style={{ width: 26, height: 26, padding: 0, fontSize: 15, fontWeight: 700, lineHeight: 1, color: "var(--pf-n900)" }}
    >
      {dir < 0 ? "−" : "+"}
    </PfBtn>
  );
}

/* -------------------------------- goal card -------------------------------- */

function GoalCard({ g, count, lastAt }: { g: MyGoal; count: number; lastAt?: string }) {
  const me = useMe();
  const toast = useToast();
  const go = useGo();
  const { hovered, hoverProps } = useHover();
  /** null = follow the saved value; a number = an unsaved draft on the stepper. */
  const [pending, setPending] = useState<number | null>(null);

  const draft = pending ?? g.pct;
  const delta = draft - g.pct;
  const feed = feedFor(g.id);
  const nudged = g.id === MY_NUDGE_GOAL.id;

  const step = (dir: -1 | 1) =>
    setPending(Math.max(0, Math.min(100, draft + dir * STEP)));

  const save = () => {
    if (delta === 0) {
      toast(`No change to save on “${shortTitle(g.title)}” — nudge the stepper first`);
      return;
    }
    me.checkIn(g.id, draft);
    setPending(null);
    toast(
      me.online
        ? `Checked in at ${draft}% on “${shortTitle(g.title)}” — ${delta > 0 ? "+" : "−"}${Math.abs(delta)}pp logged to your history`
        : `Check-in on “${shortTitle(g.title)}” queued offline — it syncs when you are back on`,
      me.online ? "success" : "default"
    );
  };

  return (
    <PfCard style={hovered ? { boxShadow: "0 1px 3px 0 #ededed" } : undefined}>
      <div {...hoverProps}>
        {/* head */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px 12px" }}>
          <PfTile icon={nudged ? "megaphone" : "target"} tone={g.tone} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>{g.title}</span>
              <PfBadge tone={g.tone} dot>{g.status}</PfBadge>
              {nudged && <PfBadge tone="blue">via WhatsApp</PfBadge>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, fontSize: 12, color: "var(--pf-n400)", flexWrap: "wrap" }}>
              <Ic name="calendar" size={13} color="var(--pf-n300)" />
              <span>Due {g.due}</span>
              <span style={{ color: "var(--pf-n100)" }}>|</span>
              <span>{count} check-in{count === 1 ? "" : "s"}</span>
              {lastAt && <><span style={{ color: "var(--pf-n100)" }}>|</span><span>last moved {lastAt}</span></>}
              <span style={{ color: "var(--pf-n100)" }}>|</span>
              <PfBadge tone={feed.tone}>{feed.label}</PfBadge>
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, justifyContent: "flex-end" }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{g.pct}%</span>
              {delta !== 0 && (
                <>
                  <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-blue-500)", lineHeight: 1 }}>{draft}%</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 4 }}>{delta === 0 ? "saved" : "unsaved draft"}</div>
          </div>
        </div>

        {/* progress + live preview */}
        <div style={{ padding: "0 20px 14px" }}>
          <PfProgress pct={g.pct} tone={g.tone} height={8} />
          {/* the preview rail keeps its height at all times — the stepper must not
              move the Save button out from under your cursor on the first tap */}
          <div aria-hidden={delta === 0} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, opacity: delta !== 0 ? 1 : 0, transition: "opacity .15s ease" }}>
            <div style={{ flex: 1 }}><PfProgress pct={draft} tone="blue" height={4} /></div>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--pf-blue-500)", flex: "none" }}>preview</span>
          </div>
        </div>

        {/* check-in stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", borderRadius: "0 0 12px 12px" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n500)" }}>Check in</span>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <StepBtn dir={-1} onClick={() => step(-1)} />
            <span style={{ minWidth: 46, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "var(--pf-n900)" }}>{draft}%</span>
            <StepBtn dir={1} onClick={() => step(1)} />
          </div>
          {delta !== 0 ? (
            <>
              <PfBadge tone={delta > 0 ? "green" : "yellow"}>
                {delta > 0 ? "+" : "−"}{Math.abs(delta)}pp this week
              </PfBadge>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>from {g.pct}%</span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--pf-n300)" }}>{STEP}pp a tap — move it, then save</span>
          )}
          <span style={{ flex: 1 }} />
          {nudged && (
            <PfBtn small variant="ghost" icon="chat" onClick={() => go("myoneonones")}>Raise it</PfBtn>
          )}
          {delta !== 0 && (
            <PfBtn small variant="ghost" onClick={() => setPending(null)}>Reset</PfBtn>
          )}
          <PfBtn small variant={delta !== 0 ? "primary" : "secondary"} icon="check" onClick={save}>Save check-in</PfBtn>
        </div>
      </div>
    </PfCard>
  );
}

/* ------------------------------ objective card ----------------------------- */

function ObjectiveCard({ onLadder }: { onLadder: () => void }) {
  const toast = useToast();
  const s = statusOf(MY_OKR.status);
  return (
    <PfCard>
      <PfCardHead
        title={`Your objective — ${MY_OKR.id}`}
        sub={`${MY_OKR.level} · ${MY_OKR.quarter} · owned by you`}
      >
        <PfBadge tone={s.tone} dot>{s.label}</PfBadge>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{MY_OKR.progress}%</span>
      </PfCardHead>

      <div style={{ padding: "15px 20px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{MY_OKR.objective}</div>
        <div style={{ marginTop: 11 }}><PfProgress pct={MY_OKR.progress} height={8} /></div>
      </div>

      {MY_OKR.krs.map((k, i) => {
        const ks = statusOf(k.status);
        return (
          <div
            key={k.kr}
            onClick={() => toast(`Key result “${k.kr}” at ${k.progress}% — rolls into your objective ${MY_OKR.id}`)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", cursor: "pointer" }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", flex: "none", letterSpacing: ".3px" }}>KR{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{k.kr}</span>
            <div style={{ width: 110, flex: "none" }}><PfProgress pct={k.progress} tone={ks.tone} height={6} /></div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)", width: 34, textAlign: "right", flex: "none" }}>{k.progress}%</span>
            <PfBadge tone={ks.tone}>{ks.label}</PfBadge>
          </div>
        );
      })}

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", borderRadius: "0 0 12px 12px" }}>
        <Ic name="info" size={13} color="var(--pf-n300)" />
        <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n400)" }}>
          Your goals land here first — the objective is what ladders up beyond your squad.
        </span>
        <PfBtn small variant="secondary" icon="stack" onClick={onLadder}>See the ladder</PfBtn>
      </div>
    </PfCard>
  );
}

/* -------------------------------- ledger row ------------------------------- */

function LedgerRowView({ r, title }: { r: LedgerRow; title: string }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const delta = r.to - r.from;
  return (
    <div
      {...hoverProps}
      onClick={() => toast(`Check-in on “${shortTitle(title)}” — ${r.from}% to ${r.to}% on ${r.at}`)}
      style={{
        display: "grid", gridTemplateColumns: "138px 1fr 132px 108px", alignItems: "center", gap: 12,
        padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", cursor: "pointer",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.live ? "var(--pf-primary-500)" : "var(--pf-n100)", flex: "none" }} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.at}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {r.live && <PfBadge tone="green">This session</PfBadge>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--pf-n400)" }}>
        <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{r.from}%</span>
        <Ic name="arrowright" size={12} color="var(--pf-n300)" />
        <span style={{ fontWeight: 700, color: "var(--pf-n900)" }}>{r.to}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PfBadge tone={delta >= 0 ? "green" : "yellow"}>
          {delta >= 0 ? "+" : "−"}{Math.abs(delta)}pp
        </PfBadge>
      </div>
    </div>
  );
}

/* ------------------------------ trajectory bars ---------------------------- */

function Trajectory({ title, series }: { title: string; series: number[] }) {
  const bars = series.slice(-7);
  const first = bars[0] ?? 0;
  const last = bars[bars.length - 1] ?? 0;
  const move = last - first;
  return (
    <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 13, background: "var(--pf-n0)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortTitle(title)}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 58, marginTop: 11 }}>
        {bars.map((v, i) => (
          <div key={i} title={`${v}%`} style={{ flex: 1, height: `${Math.max(v, 3)}%`, borderRadius: 3, background: i === bars.length - 1 ? "var(--pf-primary-500)" : "var(--pf-n100)", transition: "height .3s ease" }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, borderTop: "1px solid var(--pf-n50)", paddingTop: 9 }}>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>{first}% to {last}% over {bars.length} points</span>
        <PfBadge tone={move >= 0 ? "green" : "yellow"}>{move >= 0 ? "+" : "−"}{Math.abs(move)}pp</PfBadge>
      </div>
    </div>
  );
}

/* -------------------------------- ladder tier ------------------------------ */

function LadderTier({ t, last, connector }: { t: Tier; last: boolean; connector?: string }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {/* rail */}
      <div style={{ width: 34, display: "flex", flexDirection: "column", alignItems: "center", flex: "none" }}>
        <PfTile icon={t.icon} tone={t.tone} size={34} />
        {!last && <span style={{ flex: 1, width: 2, borderRadius: 2, background: "var(--pf-n100)", minHeight: 40, marginTop: 5 }} />}
      </div>

      {/* tier */}
      <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 0 : 4 }}>
        <div
          {...hoverProps}
          onClick={() => toast(t.mine ? `${t.id} — yours · ${MY_OKR.progress}% this quarter` : `${t.rank} ${t.id} — ${t.owner} · ${t.quarter}`)}
          style={{
            border: `1px solid ${t.mine ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
            background: t.mine ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
            borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "background .12s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: TONE[t.tone].fg, letterSpacing: ".3px", textTransform: "uppercase" }}>{t.rank}</span>
            <PfBadge tone="grey">{t.id}</PfBadge>
            <PfBadge tone={t.mine ? "green" : "grey"}>{t.owner}</PfBadge>
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{t.quarter}</span>
          </div>
          <div style={{ fontSize: t.mine ? 15 : 14, fontWeight: 600, color: "var(--pf-n900)", marginTop: 7, lineHeight: 1.35 }}>{t.objective}</div>

          {t.mine && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}><PfProgress pct={MY_OKR.progress} height={8} /></div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)", flex: "none" }}>{MY_OKR.progress}%</span>
                <PfBadge tone={statusOf(MY_OKR.status).tone} dot>{statusOf(MY_OKR.status).label}</PfBadge>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
                {MY_OKR.krs.map((k, i) => (
                  <div key={k.kr} style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--pf-n0)", border: "1px solid var(--pf-primary-100)", borderRadius: 8, padding: "8px 10px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", flex: "none" }}>KR{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{k.kr}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n600)", flex: "none" }}>{k.progress}%</span>
                    <PfBadge tone={statusOf(k.status).tone}>{statusOf(k.status).label}</PfBadge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {connector && (
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 2px 12px" }}>
            <Ic name="arrowup" size={13} color="var(--pf-n300)" />
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{connector}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function MyGoals() {
  const go = useGo();
  const toast = useToast();
  const me = useMe();

  const [tab, setTab] = useState("active");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState(DUE_CHOICES[1]);
  const [nudgeHidden, setNudgeHidden] = useState(false);

  const goals = me.goals;
  const hasNudge = goals.some((g) => g.id === MY_NUDGE_GOAL.id);

  /** Your check-ins this session, then the four already on your record. Newest first. */
  const ledger = useMemo<LedgerRow[]>(
    () => [
      ...me.checkins.map((c) => ({ ...c, live: true })),
      ...MY_CHECKINS.map((c) => ({ ...c, live: false })),
    ],
    [me.checkins]
  );

  const titleOf = (goalId: string): string =>
    goals.find((g) => g.id === goalId)?.title
    ?? MY_GOALS.find((g) => g.id === goalId)?.title
    ?? (goalId === MY_NUDGE_GOAL.id ? MY_NUDGE_GOAL.title : `Goal ${goalId}`);

  const avg = goals.length ? Math.round(goals.reduce((a, g) => a + g.pct, 0) / goals.length) : 0;
  const ppLogged = ledger.reduce((a, r) => a + (r.to - r.from), 0);
  const dates = new Set(ledger.map((r) => r.at.split(",")[0]));
  const nextDue = goals.length ? [...goals].sort((a, b) => dueKey(a.due) - dueKey(b.due))[0].due : "—";

  const countFor = (id: string) => ledger.filter((r) => r.goalId === id).length;
  const lastFor = (id: string) => ledger.find((r) => r.goalId === id)?.at;

  const seriesFor = (id: string): number[] => {
    const rows = ledger.filter((r) => r.goalId === id).slice().reverse();
    if (!rows.length) return [];
    return [rows[0].from, ...rows.map((r) => r.to)];
  };

  const shown = goals.filter((g) =>
    filter === "On track" ? g.pct >= 60 || g.status === "Done"
    : filter === "Needs a nudge" ? g.pct < 60
    : true
  );

  const trajectories = goals.map((g) => ({ g, series: seriesFor(g.id) })).filter((x) => x.series.length > 1);

  const addNudge = () => {
    me.addGoal(MY_NUDGE_GOAL);
    toast(`“${shortTitle(MY_NUDGE_GOAL.title)}” added to your goals — due ${MY_NUDGE_GOAL.due}`, "success");
  };

  const declineNudge = () => {
    setNudgeHidden(true);
    toast(`Nothing added — raise “${shortTitle(MY_NUDGE_GOAL.title)}” with ${MY_MANAGER.name} in your next 1-on-1`);
  };

  const saveNew = () => {
    const title = newTitle.trim();
    if (!title) { toast("Give your goal a title first"); return; }
    me.addGoal({ id: `g-${Date.now().toString(36)}`, title, pct: 0, due: newDue, status: "New", tone: "blue" });
    toast(`Goal added — “${shortTitle(title)}” · due ${newDue}`, "success");
    setNewTitle("");
    setAddOpen(false);
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your goals</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Your goals for {MY_OKR.quarter}, the check-ins you have logged against them, and the chain your objective ladders into.
          </div>
        </div>
        <PfBtn variant="secondary" icon="chat" onClick={() => go("myoneonones")}>Raise in your 1-on-1</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { setTab("active"); setAddOpen(true); }}>Add goal</PfBtn>
      </div>

      {/* KPI strip — all four are values about you */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="target" tone="green" label="Average progress" value={`${avg}%`} unit="across your goals" delta={`+${ppLogged}pp logged`} deltaTone="green" />
        <PfStat icon="stack" tone="purple" label="Your objective" value={`${MY_OKR.progress}%`} unit={`${MY_OKR.id} · Q3`} delta={statusOf(MY_OKR.status).label} deltaTone={statusOf(MY_OKR.status).tone} />
        <PfStat icon="pulse" tone="blue" label="Check-ins logged" value={ledger.length} unit="since Jul 08" delta={`${dates.size} dates`} deltaTone="blue" />
        <PfStat icon="calendar" tone="yellow" label="Next due" value={nextDue} unit="soonest goal" delta={`${goals.length} live`} deltaTone="grey" />
      </div>

      {/* Page sections */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "active", label: "My goals", count: String(goals.length) },
            { key: "checkins", label: "Check-in history", count: String(ledger.length) },
            { key: "ladder", label: "How mine ladder up", count: String(TIERS.length) },
          ]}
        />
      </div>

      {/* ------------------------------- My goals ------------------------------ */}
      {tab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>
                {goals.length} live goal{goals.length === 1 ? "" : "s"} · {avg}% average
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
                Every save is timestamped into your check-in history.
              </div>
            </div>
            <PfTabs tabs={FILTERS} active={filter} onChange={setFilter} />
          </div>

          {/* WhatsApp-assigned goal, not yet on your list */}
          {!hasNudge && !nudgeHidden && (
            <PfCard style={{ border: "1px dashed var(--pf-blue-100)", background: "var(--pf-blue-50)" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "15px 20px" }}>
                <PfTile icon="megaphone" tone="blue" size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_NUDGE_GOAL.title}</span>
                    <PfBadge tone="blue">via WhatsApp</PfBadge>
                    <PfBadge tone="grey">due {MY_NUDGE_GOAL.due}</PfBadge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 5, lineHeight: 1.5 }}>
                    Assigned to you on WhatsApp and not on your list yet. It matches your open commitment
                    {" "}
                    <span style={{ fontWeight: 600 }}>&ldquo;{MY_ACTIONS[0]?.item ?? "Share design-system migration plan"}&rdquo;</span>
                    {" "}from your 1-on-1{MY_ACTIONS[0]?.due ? ` (due ${MY_ACTIONS[0].due})` : ""}.
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                    <PfBtn
                      small variant="primary" tone={TONE.blue.bg}
                      style={{ boxShadow: "0 6px 12px -6px rgba(0,122,255,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
                      icon="plus" onClick={addNudge}
                    >
                      Add to your goals
                    </PfBtn>
                    <PfBtn small variant="secondary" onClick={declineNudge}>Not mine</PfBtn>
                    <PfBtn small variant="ghost" icon="chat" onClick={() => go("myoneonones")}>Open the 1-on-1</PfBtn>
                  </div>
                </div>
              </div>
            </PfCard>
          )}

          {/* goal cards */}
          {shown.map((g) => (
            <GoalCard key={g.id} g={g} count={countFor(g.id)} lastAt={lastFor(g.id)} />
          ))}

          {!shown.length && (
            <PfCard>
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "18px 20px", fontSize: 13, color: "var(--pf-n400)" }}>
                <Ic name="filter" size={15} color="var(--pf-n300)" />
                No goal of yours matches &ldquo;{filter}&rdquo; right now.
                <PfBtn small variant="secondary" onClick={() => setFilter(FILTERS[0])}>Show all</PfBtn>
              </div>
            </PfCard>
          )}

          {/* add your own */}
          <PfCard>
            {addOpen ? (
              <div style={{ padding: "14px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 9 }}>Add a goal of your own</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveNew(); }}
                    placeholder="e.g. Publish the payments runbook the squad can rely on"
                    style={{ ...fieldStyle, flex: 1, minWidth: 220 }}
                  />
                  <select value={newDue} onChange={(e) => setNewDue(e.target.value)} style={{ ...fieldStyle, flex: "none" }}>
                    {DUE_CHOICES.map((d) => <option key={d} value={d}>Due {d}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                  <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n400)" }}>
                    It starts at 0% and unlinked — you pick the objective it serves at your next check-in.
                  </span>
                  <PfBtn small variant="ghost" onClick={() => { setAddOpen(false); setNewTitle(""); }}>Cancel</PfBtn>
                  <PfBtn small variant="primary" onClick={saveNew}>Save goal</PfBtn>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddOpen(true)}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "13px 20px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--pf-n500)" }}
              >
                <Ic name="plus" size={15} color="var(--pf-n400)" /> Add a goal of your own
              </button>
            )}
          </PfCard>

          {/* who sees this */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", flexWrap: "wrap", fontSize: 12.5, color: "var(--pf-n400)" }}>
              <Ic name="shield" size={14} color="var(--pf-n300)" />
              <span>Saved check-ins are visible to</span>
              <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={18} />
              <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{MY_MANAGER.name}</span>
              <span>in your 1-on-1 — no one else on your squad sees your goals, and you do not see theirs.</span>
              <span style={{ flex: 1 }} />
              <PfBtn small variant="ghost" icon="arrowright" onClick={() => go("myprivacy")}>Who holds what</PfBtn>
            </div>
          </PfCard>

          <ObjectiveCard onLadder={() => setTab("ladder")} />
        </div>
      )}

      {/* --------------------------- Check-in history -------------------------- */}
      {tab === "checkins" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner cta="open" onCta={() => go("myreview")}>
            <span style={{ fontWeight: 600 }}>This ledger is your evidence — </span>
            <span style={{ fontWeight: 400 }}>
              {MY_CYCLE.name} closes {MY_CYCLE.closes}, and every row below is dated, yours, and already written down.
            </span>
          </PfBanner>

          {/* summary */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 20px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Check-ins logged</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", marginTop: 3 }}>{ledger.length}</div>
              </div>
              <div style={{ borderLeft: "1px solid var(--pf-n50)", paddingLeft: 20 }}>
                <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Progress logged</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", marginTop: 3 }}>+{ppLogged}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n300)" }}>pp</span></div>
              </div>
              <div style={{ borderLeft: "1px solid var(--pf-n50)", paddingLeft: 20 }}>
                <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Cadence · {dates.size} check-in dates</div>
                <div style={{ marginTop: 8 }}><PfSegments score={Math.min(dates.size, 5)} outOf={5} /></div>
              </div>
              <span style={{ flex: 1 }} />
              <PfBtn
                variant="secondary" icon="paperplane"
                onClick={() => toast(`Check-in ledger attached to your ${MY_CYCLE.name} self-assessment — ${ledger.length} dated entries`, "success")}
              >
                Attach to self-assessment
              </PfBtn>
            </div>
          </PfCard>

          {/* trajectory */}
          {trajectories.length > 0 && (
            <PfCard>
              <PfCardHead title="Your trajectory" sub="Each bar is one saved check-in, oldest on the left." />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, padding: 16 }}>
                {trajectories.map(({ g, series }) => (
                  <Trajectory key={g.id} title={g.title} series={series} />
                ))}
              </div>
            </PfCard>
          )}

          {/* ledger */}
          <PfCard>
            <PfCardHead title="Every check-in you have saved" sub="Newest first — date, goal, movement and change.">
              <PfBadge tone="grey">{ledger.length} entries</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "138px 1fr 132px 108px", gap: 12, padding: "10px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Date</PfTh>
              <PfTh>Goal</PfTh>
              <PfTh>Movement</PfTh>
              <PfTh style={{ textAlign: "right" }}>Change</PfTh>
            </div>
            {ledger.map((r, i) => (
              <LedgerRowView key={`${r.goalId}-${r.at}-${i}`} r={r} title={titleOf(r.goalId)} />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", borderRadius: "0 0 12px 12px" }}>
              <Ic name="clock" size={13} color="var(--pf-n300)" />
              Entries from this session sit above the four already on your record. Nothing here is editable after saving — that is what makes it evidence.
            </div>
          </PfCard>
        </div>
      )}

      {/* ------------------------- How mine ladder up -------------------------- */}
      {tab === "ladder" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="How your work ladders up"
              sub={`${MY_LADDER.company.id} → ${MY_LADDER.department.id} → ${MY_OKR.id} · your chain only`}
            >
              <PfBadge tone="green" dot>Your chain</PfBadge>
            </PfCardHead>
            <div style={{ padding: 20 }}>
              {TIERS.map((t, i) => (
                <LadderTier
                  key={t.key}
                  t={t}
                  last={i === TIERS.length - 1}
                  connector={
                    i === 0 ? `${MY_LADDER.department.id} — your department objective — ladders into this`
                    : i === 1 ? `${MY_OKR.id} — yours — ladders into this`
                    : undefined
                  }
                />
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "12px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5, borderRadius: "0 0 12px 12px" }}>
              <Ic name="shield" size={14} color="var(--pf-n300)" />
              <span>
                Only the objectives you ladder into are shown, and only their statements. Progress against the company and
                department objectives is reported by the people who own them — how anyone else is tracking, on this chain or
                any other, is not on your page.
              </span>
            </div>
          </PfCard>

          {/* your contribution */}
          <PfCard>
            <PfCardHead title="What of yours feeds it" sub="Each goal you own, and where it lands on the chain above." />
            {goals.map((g, i) => {
              const feed = feedFor(g.id);
              return (
                <div
                  key={g.id}
                  onClick={() => toast(`“${shortTitle(g.title)}” at ${g.pct}% — feeds ${feed.label}`)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)", cursor: "pointer" }}
                >
                  <PfTile icon="target" tone={g.tone} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{g.title}</span>
                      <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                      <PfBadge tone={feed.tone}>{feed.label}</PfBadge>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>{feed.note}</div>
                  </div>
                  <div style={{ width: 120, flex: "none" }}>
                    <PfProgress pct={g.pct} tone={g.tone} height={6} />
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", textAlign: "right", marginTop: 5 }}>{g.pct}%</div>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", borderRadius: "0 0 12px 12px" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n400)" }}>
                Linking is yours to change — bring it to your next 1-on-1 with {MY_MANAGER.name}.
              </span>
              <PfBtn small variant="secondary" icon="chat" onClick={() => go("myoneonones")}>Add to the agenda</PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
