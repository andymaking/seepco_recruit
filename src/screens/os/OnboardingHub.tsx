"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfStat, PfTile, PfProgress, PfSegments,
  PfPageTabs, PfAvatar, PfBanner, PfTh, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { canOpenOsStage, personaById } from "@/data/personas";
import {
  BASELINE_COMPETENCIES, BASELINE_METHODS, BRIDGE_ARTIFACTS, IMPORT_BATCH, INVITES,
  NEW_HIRE, NEW_HIRE_PACK_KEY, NEXT_CYCLE, NUDGE_DELIVERY, ONBOARDING_METRICS,
  ORG_PLACEMENT, PLAN_30_60_90, PREBOARD_NUDGES, PREBOARD_TASKS, PULSE, REQUIRED_PACK,
  ROLLOUT, SEEDED_GOALS, inviteIdentity,
  type ClaimState, type Kpi, type PreboardTask,
} from "@/data/onboarding";

/**
 * Onboarding & rollout — the HR cockpit (stage `onboardhub`, Manage pillar).
 *
 * The surface that runs BOTH entry paths and carries every metric the spec names:
 *   Path A · the new hire (offer-signed → day 90) — cohort status, the stuck queue,
 *            preboarding-before-day-1, nudge controls, the manager approval queue.
 *   Path B · the existing workforce at rollout — HRIS import, invites by channel,
 *            the claim funnel, competency-baseline coverage, re-invite controls.
 *   FR-074 · the bridge out — first goals, first review date, baseline competency
 *            profile, manager handoff, each with a real landing screen.
 *   Metrics · all 13 KPIs across three groups, target vs actual, misses visible.
 *
 * BOUNDARY RULE (deliberate, to avoid a second copy of Stage 10):
 *   Onboarding.tsx = ONE hire. This cockpit = the cohort + the rollout.
 * So the per-hire e-sign checklist, the 30/60/90 milestone bodies and the day-one
 * activation card are NOT re-rendered here — the roster drills into /onboarding.
 * What this screen owns is the exception queue (what is NOT done), the cohort
 * roll-up, and everything Path B.
 *
 * Every number is read from `@/data/onboarding` — one source, many renders.
 * State is local to the cockpit today; the shapes below (`planApproval`,
 * `importState`, invite overrides, `bridge`) mirror the fields the shared
 * onboarding store will carry, so the swap is mechanical when it lands.
 */

/* ------------------------------- vocabulary ------------------------------ */

const CLAIM_LABEL: Record<ClaimState, string> = {
  "not-invited": "Not invited",
  invited: "Invited",
  opened: "Opened",
  claimed: "Claimed",
  baselined: "Baselined",
  bounced: "Bounced",
};

const CLAIM_TONE: Record<ClaimState, PfTone> = {
  "not-invited": "grey",
  invited: "grey",
  opened: "yellow",
  claimed: "blue",
  baselined: "green",
  bounced: "red",
};

const CHANNEL_ICON: Record<string, string> = {
  "Work email": "paperplane",
  WhatsApp: "chat",
  SMS: "megaphone",
  "—": "x",
};

const LANE_LABEL: Record<PreboardTask["lane"], string> = {
  sign: "Sign",
  collect: "Collect & verify",
  bank: "Payroll",
  welcome: "Welcome",
  logistics: "Logistics",
};

const TASK_TONE: Record<PreboardTask["state"], PfTone> = {
  done: "green",
  "in-progress": "blue",
  waiting: "yellow",
  blocked: "red",
};

const TASK_LABEL: Record<PreboardTask["state"], string> = {
  done: "Done",
  "in-progress": "In progress",
  waiting: "Waiting on hire",
  blocked: "Blocked",
};

/**
 * Presentation metadata for the metric meters: the numeric read of each KPI and
 * which direction is good. Both numbers come from the KPI's own value/target
 * strings — this map only records how to draw them.
 */
const METER: Record<string, { actual: number; target: number; better: "up" | "down"; scale: string }> = {
  "r-role-live": { actual: 6, target: 7, better: "down", scale: "days" },
  "r-shortlist": { actual: 31, target: 48, better: "down", scale: "hours" },
  "r-backlog": { actual: 68, target: 60, better: "up", scale: "%" },
  "r-seats": { actual: 72, target: 70, better: "up", scale: "% accepted" },
  "r-actions": { actual: 31, target: 20, better: "up", scale: "actions" },
  "a-preboard": { actual: 92, target: 90, better: "up", scale: "%" },
  "a-activation": { actual: 100, target: 100, better: "up", scale: "%" },
  "a-plan": { actual: 78, target: 80, better: "up", scale: "%" },
  "a-pulse": { actual: 4.2, target: 4.0, better: "up", scale: "out of 5" },
  "a-qoh": { actual: 74, target: 80, better: "up", scale: "%" },
  "b-claim": { actual: 82, target: 80, better: "up", scale: "%" },
  "b-baseline": { actual: 67, target: 80, better: "up", scale: "%" },
  "b-active": { actual: 84, target: 80, better: "up", scale: "%" },
};

/** Mirrors `PlanApproval["state"]` — the one field the approval gate turns on. */
type PlanApprovalState = "ai-draft" | "manager-approved" | "manager-edited";

/* ------------------------------ tiny pieces ------------------------------ */

function Chip({ label, active, dot, onClick }: { label: string; active: boolean; dot?: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
        border: `1px solid ${active ? "var(--pf-n900)" : "var(--pf-n100)"}`,
        background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        color: active ? "#fff" : "var(--pf-n500)", whiteSpace: "nowrap", lineHeight: 1.3,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "none" }} />}
      {label}
    </button>
  );
}

/** Small label/value pair used inside cards. */
function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "var(--pf-n300)", letterSpacing: ".2px", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: tone ?? "var(--pf-n900)", lineHeight: 1.3 }}>{value}</div>
    </div>
  );
}

/** Source citation — every claim on this screen names where it comes from. */
function Source({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>
      <Ic name="info" size={11} color="var(--pf-n300)" />
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
    </div>
  );
}

/** Actual bar with a target tick — the literal "target vs actual" read. */
function TargetMeter({ actual, target, better, hit }: { actual: number; target: number; better: "up" | "down"; hit: boolean }) {
  const max = Math.max(actual, target) * 1.2;
  const a = Math.max(2, (actual / max) * 100);
  const t = (target / max) * 100;
  const tone: PfTone = hit ? "green" : "yellow";
  return (
    <div style={{ position: "relative", paddingTop: 13 }}>
      <div style={{ position: "absolute", top: 0, left: `${t}%`, transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 600, color: "var(--pf-n400)", whiteSpace: "nowrap", letterSpacing: ".2px" }}>
        TARGET
      </div>
      <div style={{ position: "relative", height: 8, borderRadius: 8, background: "var(--pf-n50)", overflow: "visible" }}>
        <div style={{ height: 8, width: `${a}%`, borderRadius: 8, background: TONE[tone].bg, transition: "width .3s ease" }} />
        <span style={{ position: "absolute", top: -3, left: `${t}%`, width: 2, height: 14, borderRadius: 2, background: "var(--pf-n900)", transform: "translateX(-1px)" }} />
      </div>
      <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 5 }}>
        {better === "up" ? "higher is better" : "lower is better"}
      </div>
    </div>
  );
}

function KpiCard({ k, onWhere }: { k: Kpi; onWhere: () => void }) {
  const m = METER[k.key];
  const { hovered, hoverProps } = useHover();
  return (
    <PfCard style={{ borderColor: k.hit ? "var(--pf-n50)" : "var(--pf-yellow-100)" }}>
      <div style={{ padding: "13px 16px 12px", borderBottom: "1px solid var(--pf-n50)", display: "flex", alignItems: "flex-start", gap: 9 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.3 }}>{k.label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 7 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.6px", color: "var(--pf-n900)", lineHeight: 1 }}>{k.value}</span>
            {k.unit && <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>{k.unit}</span>}
          </div>
        </div>
        {k.hit
          ? <PfBadge tone="green" dot>On target</PfBadge>
          : <PfBadge tone="yellow" dot>Missed</PfBadge>}
      </div>
      <div style={{ padding: "12px 16px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
          <Ic name="target" size={13} color="var(--pf-n400)" />
          <span style={{ fontSize: 12, color: "var(--pf-n500)", fontWeight: 500 }}>Target {k.target}</span>
        </div>
        {m && <TargetMeter actual={m.actual} target={m.target} better={m.better} hit={k.hit} />}
        <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 10 }}>{k.sub}</div>
        <button
          {...hoverProps}
          onClick={onWhere}
          style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: hovered ? "var(--pf-primary-600)" : "var(--pf-n400)" }}
        >
          Where this number comes from
          <Ic name="arrowright" size={12} color={hovered ? "var(--pf-primary-600)" : "var(--pf-n400)"} />
        </button>
      </div>
    </PfCard>
  );
}

/* ================================ screen ================================= */

export default function OnboardingHub() {
  const go = useGo();
  const router = useRouter();
  const toast = useToast();
  const { persona: personaId } = useApp();
  const persona = personaById(personaId);
  const canReachManagerHome = canOpenOsStage(persona, "manager");

  const [tab, setTab] = useState("hires");

  /* ---- Path A state ---- */
  const [taskOverride, setTaskOverride] = useState<Record<string, PreboardTask["state"]>>({});
  const [nudgeOverride, setNudgeOverride] = useState<Record<string, string>>({});
  const [planApproval, setPlanApproval] = useState<PlanApprovalState>(PLAN_30_60_90.approval.state);
  /** The actor, not the role — a proxy approval must never read as her signature. */
  const [approvedBy, setApprovedBy] = useState<string | null>(PLAN_30_60_90.approval.approvedBy ?? null);
  const [approvalNudgedAt, setApprovalNudgedAt] = useState<string | null>(null);

  /* ---- Path B state ---- */
  const [importState, setImportState] = useState<"idle" | "running" | "done">("idle");
  const [importStage, setImportStage] = useState(0);
  const [inviteOverride, setInviteOverride] = useState<Record<string, { state: ClaimState; note: string }>>({});
  const [claimFilter, setClaimFilter] = useState<ClaimState | "all">("all");

  /* ---- Bridge state ---- */
  const [day90Done, setDay90Done] = useState(PLAN_30_60_90.milestones[2].state === "done");
  const [bridgeFired, setBridgeFired] = useState(false);
  const [selArtifact, setSelArtifact] = useState(BRIDGE_ARTIFACTS[0].id);

  /* ---- Metrics state ---- */
  const [metricFilter, setMetricFilter] = useState<"all" | "hit" | "miss">("all");

  /* ---- derived: Path A ---- */
  const tasks = useMemo(
    () => PREBOARD_TASKS.map((t) => ({ ...t, state: taskOverride[t.id] ?? t.state })),
    [taskOverride],
  );
  const openTasks = tasks.filter((t) => t.state !== "done");
  const required = tasks.filter((t) => t.required);
  const requiredDone = required.filter((t) => t.state === "done").length;
  const requiredPct = Math.round((requiredDone / required.length) * 100);
  const allDone = tasks.filter((t) => t.state === "done").length;
  const planPct = Math.round(
    PLAN_30_60_90.milestones.reduce((s, m) => s + (m.day === 90 && day90Done ? 100 : m.progress), 0) / 3,
  );

  /* ---- derived: Path B ---- */
  const invites = useMemo(
    () => INVITES.map((r) => {
      const o = inviteOverride[r.empId];
      const row = { ...r, ...inviteIdentity(r) };
      return o ? { ...row, state: o.state, note: o.note } : row;
    }),
    [inviteOverride],
  );
  const shownInvites = invites.filter((r) => claimFilter === "all" || r.state === claimFilter);
  const claimPct = Math.round((ROLLOUT.claimed / ROLLOUT.invited) * 100);
  const baselinePct = Math.round((ROLLOUT.baselined / ROLLOUT.cohort) * 100);

  /* ---- the import runner ---- */
  useEffect(() => {
    if (importState !== "running") return;
    if (importStage >= IMPORT_BATCH.stages.length - 1) {
      const t = setTimeout(() => {
        setImportState("done");
        toast(`${IMPORT_BATCH.source} import complete — ${IMPORT_BATCH.pulled} pulled, ${IMPORT_BATCH.merged} duplicates merged, ${IMPORT_BATCH.landed} landed on the person spine`, "success");
      }, 780);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setImportStage((s) => s + 1), 780);
    return () => clearTimeout(t);
  }, [importState, importStage, toast]);

  /* ------------------------------- actions ------------------------------- */

  const markReceived = (t: (typeof tasks)[number]) => {
    setTaskOverride((o) => ({ ...o, [t.id]: "done" }));
    toast(`${t.label} received for ${NEW_HIRE.name} — preboarding now ${requiredDone + (t.required ? 1 : 0)}/${required.length} required`, "success");
  };

  const chase = (t: (typeof tasks)[number]) => {
    const n = PREBOARD_NUDGES.find((x) => x.drives.includes(t.id));
    setTaskOverride((o) => ({ ...o, [t.id]: "in-progress" }));
    toast(
      n
        ? `WhatsApp chase sent to ${NEW_HIRE.name} on the "${n.when}" nudge — SMS takes over in ${NUDGE_DELIVERY.smsFallbackMinutes} min if undelivered`
        : `WhatsApp chase sent to ${NEW_HIRE.name} for ${t.label}`,
      "success",
    );
  };

  const sendNudge = (when: string, text: string) => {
    setNudgeOverride((o) => ({ ...o, [when]: "sent" }));
    toast(`Sent now on WhatsApp — “${text}”`, "success");
  };

  const smsFallback = (when: string) => {
    setNudgeOverride((o) => ({ ...o, [when]: "sms" }));
    toast(`Resent by SMS — the ${when.toLowerCase()} nudge went undelivered on WhatsApp`, "success");
  };

  const nudgeManager = () => {
    setApprovalNudgedAt("just now");
    toast(`${PLAN_30_60_90.approval.manager} nudged — the 30/60/90 draft has been waiting since ${PLAN_30_60_90.approval.draftedAt}. ${NEW_HIRE.name} does not see an unapproved plan.`, "ai");
  };

  const recordApproval = () => {
    setPlanApproval("manager-approved");
    setApprovedBy(`People Ops, on ${PLAN_30_60_90.approval.manager}'s behalf`);
    toast(`Approval recorded on ${PLAN_30_60_90.approval.manager}'s behalf — logged to the audit trail with People Ops as the actor, the manager as the approver`, "success");
  };

  const runImport = () => {
    setImportStage(0);
    setImportState("running");
    toast(`Re-running ${IMPORT_BATCH.id} against ${IMPORT_BATCH.source} — identities resolved before anything is written`, "ai");
  };

  const reinvite = (empId: string, name: string, state: ClaimState, channel: string) => {
    if (state === "not-invited") {
      toast(`${name} is excluded from the rollout cohort — on notice, so FR-063 offboarding owns her path, not onboarding`, "danger");
      return;
    }
    const next: ClaimState = "invited";
    const note =
      state === "bounced"
        ? "Re-invited on WhatsApp after the stale BambooHR address bounced"
        : state === "opened"
          ? `SMS fallback sent — dropped at the identity step on 2G`
          : `Invite resent on ${channel}`;
    setInviteOverride((o) => ({ ...o, [empId]: { state: next, note } }));
    toast(`${name} — ${note.toLowerCase()}`, "success");
  };

  const bulkReinvite = () => {
    const targets = invites.filter((r) => r.state === "bounced");
    if (targets.length === 0) {
      toast("Nothing bounced in this slice — the other 6 bounces sit outside the 10 rows shown");
      return;
    }
    setInviteOverride((o) => {
      const next = { ...o };
      targets.forEach((r) => { next[r.empId] = { state: "invited", note: "Re-invited on WhatsApp in the bounce sweep" }; });
      return next;
    });
    toast(`${ROLLOUT.bounced} bounced invites re-sent on WhatsApp — work-email addresses flagged stale for People Ops to fix in ${IMPORT_BATCH.source}`, "success");
  };

  const completeDay90 = () => {
    setDay90Done(true);
    toast(`Day-90 milestone closed — “${PLAN_30_60_90.milestones[2].title}”. The FR-074 bridge is now armed.`, "success");
  };

  const fireBridge = () => {
    setBridgeFired(true);
    toast("FR-074 bridge fired — first goals, first review date, baseline competency profile and the manager handoff all created", "success");
  };

  /* ------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Onboarding &amp; rollout</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>
            Two entry paths, one destination. The new hire walks in from an accepted offer; the existing workforce claims an
            imported record. Both land in the same workspace — this is where HR runs them.
          </div>
        </div>
        <PfBtn variant="secondary" icon="door" onClick={() => go("offboarding")}>The exit mirror</PfBtn>
        <PfBtn variant="primary" icon="arrowsq" onClick={() => router.push("/onboarding")}>Open Stage 10 ↗</PfBtn>
      </div>

      {/* The two doors, stated once */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 4 }}>
        <PathCard
          tone="green" icon="user" kicker="PATH A"
          title="The new hire"
          body="Offer signed → day 90. Preboarding, a day one that already knows them, an AI-drafted 30/60/90 a manager approves, then the bridge out."
          stat={`1 hire in flight · day ${NEW_HIRE.dayOfNinety} of 90`}
          active={tab === "hires"} onClick={() => setTab("hires")}
        />
        <PathCard
          tone="purple" icon="stack" kicker="PATH B"
          title="The existing workforce"
          body="The cold-start answer. Import the HRIS, invite everyone to claim, and make the first thing they see something they get — never a dashboard that smells like surveillance."
          stat={`${ROLLOUT.claimed} of ${ROLLOUT.invited} claimed · median ${ROLLOUT.medianClaimMinutes} min`}
          active={tab === "rollout"} onClick={() => setTab("rollout")}
        />
      </div>

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "hires", label: "New hires", count: "1", mono: "A" },
            { key: "rollout", label: "Workforce rollout", count: String(ROLLOUT.cohort), mono: "B" },
            { key: "bridge", label: "Bridge out", badge: "FR-074" },
            { key: "metrics", label: "Adoption & activation", count: "13" },
          ]}
        />
      </div>

      {/* ==================================================================
          TAB 1 · PATH A — the new-hire cohort
         ================================================================== */}
      {tab === "hires" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <PfStat icon="users" tone="green" label="In the 90-day window" value="1" unit="hire" delta="Jun cohort" deltaTone="green" />
            <PfStat icon="check" tone="green" label="Preboarding before day 1" value="92" unit="%" delta="target ≥ 90%" deltaTone="green" />
            <PfStat icon="clock" tone="yellow" label="Open preboarding items" value={String(openTasks.length)} unit={`of ${tasks.length}`} delta={`${requiredDone}/${required.length} required`} deltaTone={requiredDone === required.length ? "green" : "yellow"} />
            <PfStat
              icon="sparkle" tone={planApproval === "ai-draft" ? "purple" : "green"}
              label="Plans awaiting approval" value={planApproval === "ai-draft" ? "1" : "0"} unit="of 1"
              delta={planApproval === "ai-draft" ? `since ${PLAN_30_60_90.approval.draftedAt}` : "approved"}
              deltaTone={planApproval === "ai-draft" ? "purple" : "green"}
            />
          </div>

          {planApproval === "ai-draft" && (
            <div style={{ marginBottom: 12 }}>
              <PfBanner tone="purple" icon="sparkle">
                <b>{NEW_HIRE.name}&rsquo;s 30/60/90 is still an AI draft.</b>{" "}
                Waiting on {PLAN_30_60_90.approval.manager} since {PLAN_30_60_90.approval.draftedAt} — and the hire never sees an unapproved plan,
                so this is the item actually holding the ramp.
              </PfBanner>
            </div>
          )}

          {/* Cohort roster — drills into Stage 10, never re-renders it */}
          <PfCard style={{ marginBottom: 12 }}>
            <PfCardHead
              title="Jun 2026 cohort"
              sub="12 hires · 11 finished every required preboarding task before their start date. The one who didn't is the row below."
            >
              <PfBtn variant="secondary" small icon="users" onClick={() => go("people")}>People directory</PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr auto", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Hire</PfTh>
              <PfTh>Preboarding</PfTh>
              <PfTh>30/60/90 plan</PfTh>
              <PfTh>Day-90 pulse</PfTh>
              <PfTh />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr auto", gap: 12, padding: "14px 20px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <PfAvatar init={NEW_HIRE.init} tone={NEW_HIRE.tone} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{NEW_HIRE.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
                    {NEW_HIRE.empId} · {NEW_HIRE.role} {NEW_HIRE.grade} · {NEW_HIRE.loc} · started {NEW_HIRE.startDate}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{requiredDone}/{required.length}</span>
                  <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>required</span>
                </div>
                <PfProgress pct={requiredPct} tone={requiredPct === 100 ? "green" : "yellow"} height={6} />
                <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>{allDone} of {tasks.length} incl. optional</div>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{planPct}%</span>
                  <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>day {NEW_HIRE.dayOfNinety}/90</span>
                </div>
                <PfProgress pct={planPct} tone={planApproval === "ai-draft" ? "purple" : "green"} height={6} />
                <div style={{ fontSize: 11, color: planApproval === "ai-draft" ? "var(--pf-purple-500)" : "var(--pf-primary-600)", marginTop: 4, fontWeight: 500 }}>
                  {planApproval === "ai-draft"
                    ? "AI draft · unapproved"
                    : approvedBy
                      ? "Approved by " + approvedBy
                      : "Approved · approver not recorded"}
                </div>
              </div>

              <div>
                {PULSE.map((p) => (
                  <div key={p.day} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--pf-n300)", width: 18 }}>{p.day}</span>
                    {p.state === "scored"
                      ? <PfBadge tone="green">{p.score}/5</PfBadge>
                      : <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{p.state === "scheduled" ? `${p.at} · scheduled` : `${p.at} · queued`}</span>}
                  </div>
                ))}
              </div>

              <PfBtn variant="secondary" small icon="arrowright" onClick={() => router.push("/onboarding")}>Open the file</PfBtn>
            </div>

            <div style={{ padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>
              The per-hire e-sign pack, the 30/60/90 milestone detail and the day-one activation card live on{" "}
              <button onClick={() => router.push("/onboarding")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)" }}>Stage 10 · Onboarding ↗</button>{" "}
              — one hire, one file. This cockpit carries the cohort, the exceptions and the rollout.
            </div>
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 348px", gap: 12, alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Where the hire is stuck */}
              <PfCard>
                <PfCardHead
                  title="Where this hire is stuck"
                  sub={`${openTasks.length} preboarding items still open — the exception queue, not the checklist`}
                >
                  <PfBadge tone={openTasks.length === 0 ? "green" : "yellow"} dot>
                    {openTasks.length === 0 ? "Nothing open" : `${openTasks.filter((t) => t.required).length} required`}
                  </PfBadge>
                </PfCardHead>

                {openTasks.length === 0 ? (
                  <div style={{ padding: "28px 20px", textAlign: "center" }}>
                    <PfTile icon="check" tone="green" size={38} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>Preboarding complete</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>
                      Every item is in. The Jun cohort is now 12 of 12 before day one.
                    </div>
                  </div>
                ) : (
                  openTasks.map((t, i) => {
                    const n = PREBOARD_NUDGES.find((x) => x.drives.includes(t.id));
                    return (
                      <div key={t.id} style={{ padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <PfTile icon={t.lane === "sign" ? "file" : t.lane === "collect" ? "shield" : t.lane === "bank" ? "wallet" : "calendar"} tone={TASK_TONE[t.state]} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.label}</span>
                              <PfBadge tone={TASK_TONE[t.state]} dot>{TASK_LABEL[t.state]}</PfBadge>
                              {t.required
                                ? <PfBadge tone="grey">Required</PfBadge>
                                : <PfBadge tone="grey">Optional</PfBadge>}
                              {t.partner && (
                                <PfBadge tone={t.partnerStatus === "Verified" ? "green" : "blue"}>
                                  {t.partner}{t.partnerStatus ? ` · ${t.partnerStatus}` : t.esign !== undefined ? " · out for e-signature" : ""}
                                </PfBadge>
                              )}
                            </div>
                            <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{t.sub}</div>
                            <Source>{LANE_LABEL[t.lane]} · required by {t.source}</Source>
                            {n && (
                              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                                <Ic name="chat" size={12} color="var(--pf-purple-500)" />
                                Chased by the <b style={{ color: "var(--pf-purple-500)", fontWeight: 600 }}>{n.when}</b> nudge
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "none" }}>
                            <PfBtn variant="secondary" small icon="chat" onClick={() => chase(t)}>Chase</PfBtn>
                            <PfBtn variant="secondary" small icon="check" onClick={() => markReceived(t)}>Mark received</PfBtn>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </PfCard>

              {/* Nudge controls */}
              <PfCard>
                <PfCardHead
                  title="Pre-boarding nudges"
                  sub={`offer accepted → day one · ${NUDGE_DELIVERY.deliveryRate}% delivered · SMS takes over ${NUDGE_DELIVERY.smsFallbackMinutes} min after an undelivered WhatsApp`}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, padding: 16 }}>
                  {PREBOARD_NUDGES.map((n) => {
                    const ov = nudgeOverride[n.when];
                    const sent = ov === "sent" || ov === "sms" || n.state === "sent";
                    const sms = ov === "sms" || n.fellBackToSms;
                    return (
                      <div key={n.when} style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 14px", background: "var(--pf-n25)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--pf-purple-500)", letterSpacing: ".4px" }}>{n.when}</span>
                          <span style={{ flex: 1 }} />
                          <Ic name={CHANNEL_ICON[sms ? "SMS" : n.channel]} size={13} color="var(--pf-n400)" />
                          <span style={{ fontSize: 11, color: "var(--pf-n400)", fontWeight: 500 }}>{sms ? "SMS" : n.channel}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.45, minHeight: 36 }}>{n.text}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
                          {sent
                            ? <PfBadge tone={sms ? "yellow" : "green"} dot>{sms ? "Fell back to SMS" : n.opened ? "Delivered · opened" : "Sent"}</PfBadge>
                            : <PfBadge tone="grey" dot>Scheduled</PfBadge>}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 7, lineHeight: 1.4 }}>
                          Drives → {n.drives.map((d) => tasks.find((t) => t.id === d)?.label ?? d).join(" · ")}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                          {!sent && <PfBtn variant="secondary" small icon="paperplane" onClick={() => sendNudge(n.when, n.text)}>Send now</PfBtn>}
                          {sent && !sms && <PfBtn variant="secondary" small icon="megaphone" onClick={() => smsFallback(n.when)}>Resend by SMS</PfBtn>}
                          {sms && <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>Fallback already used</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PfCard>
            </div>

            {/* Right rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* The approval queue */}
              <PfCard style={{ borderColor: planApproval === "ai-draft" ? "var(--pf-purple-100)" : "var(--pf-n50)" }}>
                <PfCardHead title="Manager approval queue" sub="AI-drafted 30/60/90 plans awaiting a human" />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <PfAvatar init="NA" tone="#16B364" size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{PLAN_30_60_90.approval.manager}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Engineering Manager · {NEW_HIRE.name}&rsquo;s plan</div>
                    </div>
                    {planApproval === "ai-draft"
                      ? <PfBadge tone="purple" dot>Awaiting</PfBadge>
                      : <PfBadge tone="green" dot>Approved</PfBadge>}
                  </div>

                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 12px", marginBottom: 11 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n300)", letterSpacing: ".3px", marginBottom: 5 }}>DRAFTED FROM</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>{PLAN_30_60_90.approval.drafter}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6 }}>
                      3 milestones drafted {PLAN_30_60_90.approval.draftedAt}
                      {planApproval === "ai-draft" ? " · unapproved" : " · approved, 0 edits"}
                    </div>
                  </div>

                  {planApproval === "ai-draft" ? (
                    <>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55, marginBottom: 11 }}>
                        HR cannot make this decision — only record {PLAN_30_60_90.approval.manager.split(" ")[0]}&rsquo;s. The judgement belongs to the manager, on{" "}
                        <b style={{ color: "var(--pf-n600)" }}>Manager home</b>, which is why it is rendered there as an action and here as a queue. Record it from this side and the receipt names People Ops as the actor, with her as the approver.
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <PfBtn variant="primary" full icon="megaphone" onClick={nudgeManager}>Nudge {PLAN_30_60_90.approval.manager.split(" ")[0]}</PfBtn>
                        <PfBtn variant="secondary" full icon="check" onClick={recordApproval}>Record approval on her behalf</PfBtn>
                        <PfBtn variant="secondary" full icon="file" onClick={() => router.push("/onboarding?tab=plan")}>Read the draft ↗</PfBtn>
                        {canReachManagerHome && (
                          <PfBtn variant="ghost" full icon="house" onClick={() => go("manager")}>Open Manager home</PfBtn>
                        )}
                      </div>
                      {approvalNudgedAt && (
                        <div style={{ fontSize: 11.5, color: "var(--pf-primary-600)", fontWeight: 500, marginTop: 9, display: "flex", alignItems: "center", gap: 5 }}>
                          <Ic name="check" size={12} color="var(--pf-primary-600)" />
                          Nudged {approvalNudgedAt} · logged
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55, marginBottom: 11 }}>
                        Approved and released. {NEW_HIRE.name} can see the plan, progress is visible to both sides, and the
                        day-90 milestone can now close the FR-074 bridge.
                      </div>
                      <PfBtn variant="secondary" full icon="target" onClick={() => setTab("bridge")}>Go to the bridge</PfBtn>
                    </>
                  )}
                </div>
              </PfCard>

              {/* Preboarding-before-day-1 */}
              <PfCard>
                <PfCardHead title="Preboarding before day one" sub="The KPI that keeps a signed hire emotionally committed" />
                <div style={{ padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 9 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.7px", color: "var(--pf-n900)", lineHeight: 1 }}>92%</span>
                    <PfBadge tone="green" dot>target ≥ 90%</PfBadge>
                  </div>
                  <TargetMeter actual={92} target={90} better="up" hit />
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 11 }}>
                    11 of 12 Jun-cohort hires finished every required task before their start date. The riskiest window in
                    Nigerian hiring is between &ldquo;yes&rdquo; and day one — renege risk runs both directions.
                  </div>
                  <div style={{ borderTop: "1px solid var(--pf-n50)", marginTop: 12, paddingTop: 11 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n300)", letterSpacing: ".3px", marginBottom: 7 }}>CERT PACK DRAWN</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginBottom: 6 }}>{NEW_HIRE_PACK_KEY}</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {REQUIRED_PACK[NEW_HIRE_PACK_KEY].map((c) => <PfBadge key={c} tone="blue">{c}</PfBadge>)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.5 }}>
                      Lagos desk role — no BOSIET, no NEBOSH. The pack is drawn from Compliance, so a Port Harcourt or
                      offshore joiner pulls a different one automatically.
                    </div>
                    <button
                      onClick={() => go("compliance")}
                      style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 9, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)" }}
                    >
                      Open Certs &amp; compliance <Ic name="arrowright" size={13} color="var(--pf-primary-600)" />
                    </button>
                  </div>
                </div>
              </PfCard>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================
          TAB 2 · PATH B — workforce rollout
         ================================================================== */}
      {tab === "rollout" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <PfStat icon="users" tone="blue" label="Rollout cohort" value={String(ROLLOUT.cohort)} unit="employees" delta={`${ROLLOUT.excluded} excluded`} deltaTone="grey" />
            <PfStat icon="paperplane" tone="purple" label="Invites sent" value={String(ROLLOUT.invited)} unit="people" delta={`${ROLLOUT.bounced} bounced`} deltaTone="red" />
            <PfStat icon="check" tone="green" label="Claim rate" value={String(claimPct)} unit="%" delta="target ≥ 80%" deltaTone="green" />
            <PfStat icon="graph" tone="yellow" label="Competency-baselined" value={String(baselinePct)} unit="%" delta="target ≥ 80%" deltaTone="yellow" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <PfBanner tone="green" icon="info">
              <b>Claiming beats onboarding-by-decree.</b>{" "}
              Median claim takes {ROLLOUT.medianClaimMinutes} minutes — verify identity, confirm the imported profile, build a
              competency baseline. What lands after that is a growth plan and a learning budget, not a dashboard.
            </PfBanner>
          </div>

          {/* HRIS import */}
          <PfCard style={{ marginBottom: 12 }}>
            <PfCardHead
              title={<span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>HRIS import · {IMPORT_BATCH.id}<PfBadge tone="green" dot>{IMPORT_BATCH.source} connected</PfBadge></span>}
              sub={`The cold-start answer — ${IMPORT_BATCH.runAt}. Identities are resolved before anything is written to the person spine.`}
            >
              <PfBtn variant="secondary" small icon="swap" onClick={() => router.push("/integrations")}>Connectors</PfBtn>
              <PfBtn variant="primary" small icon={importState === "running" ? "pause" : "play"} onClick={runImport}>
                {importState === "running" ? "Running…" : "Re-run import"}
              </PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {/* Run */}
              <div style={{ padding: 16, borderRight: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                  <Fact label="PULLED" value={String(IMPORT_BATCH.pulled)} />
                  <Fact label="DUPLICATES MERGED" value={String(IMPORT_BATCH.merged)} tone="var(--pf-yellow-500)" />
                  <Fact label="LANDED" value={String(IMPORT_BATCH.landed)} tone="var(--pf-primary-600)" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {IMPORT_BATCH.stages.map((s, i) => {
                    const state = importState === "idle" || importState === "done"
                      ? "done"
                      : i < importStage ? "done" : i === importStage ? "running" : "todo";
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
                          background: state === "done" ? "var(--pf-primary-500)" : "var(--pf-n0)",
                          border: state === "done" ? "1px solid var(--pf-primary-500)" : state === "running" ? "2px solid var(--pf-primary-500)" : "2px solid var(--pf-n100)",
                          boxShadow: state === "running" ? "0 0 0 4px var(--pf-primary-50)" : "none",
                        }}>
                          {state === "done" && <Ic name="check" size={11} color="#fff" weight={2.5} />}
                        </span>
                        <span style={{ fontSize: 12.5, fontWeight: state === "todo" ? 400 : 500, color: state === "todo" ? "var(--pf-n300)" : "var(--pf-n600)" }}>{s}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 13 }}>
                  <PfProgress
                    pct={importState === "running" ? ((importStage + 1) / IMPORT_BATCH.stages.length) * 100 : 100}
                    tone="green"
                  />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 9, lineHeight: 1.5 }}>
                  {IMPORT_BATCH.merged} duplicates merged with consent states preserved — a person who already said no to
                  something does not silently say yes because a second record arrived.
                </div>
              </div>

              {/* Field map */}
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n300)", letterSpacing: ".3px", marginBottom: 10 }}>
                  FIELD MAP · {IMPORT_BATCH.fieldMap.length} FIELDS ONTO THE PERSON SPINE
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {IMPORT_BATCH.fieldMap.map((f) => {
                    const pct = Math.round((f.filled / IMPORT_BATCH.landed) * 100);
                    return (
                      <div key={f.hris} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)", width: 96, flex: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.hris}</span>
                        <Ic name="arrowright" size={11} color="var(--pf-n300)" />
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.talentos}</span>
                        <span style={{ width: 44, flex: "none" }}><PfProgress pct={pct} tone={pct === 100 ? "green" : "yellow"} height={5} /></span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: pct === 100 ? "var(--pf-primary-600)" : "var(--pf-n400)", width: 30, textAlign: "right", flex: "none" }}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 11, lineHeight: 1.5 }}>
                  The gaps are the rollout&rsquo;s real work: 17 people arrive with no work email at all, 32 with no mobile
                  number, 46 with no pay grade, 9 with no line manager.
                </div>
              </div>
            </div>
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 348px", gap: 12, alignItems: "start" }}>
            {/* Invite roster */}
            <PfCard>
              <PfCardHead
                title="Claim invites"
                sub={`Showing 10 of ${ROLLOUT.invited} — the rows that carry a decision`}
              >
                <PfBtn variant="secondary" small icon="megaphone" onClick={bulkReinvite}>Re-invite {ROLLOUT.bounced} bounced</PfBtn>
              </PfCardHead>

              <div style={{ display: "flex", gap: 7, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n300)", letterSpacing: ".3px", marginRight: 2 }}>ROLLOUT:</span>
                <Chip label="All" active={claimFilter === "all"} onClick={() => setClaimFilter("all")} />
                {(["invited", "opened", "claimed", "baselined", "bounced", "not-invited"] as ClaimState[]).map((s) => (
                  <Chip key={s} label={CLAIM_LABEL[s]} dot={TONE[CLAIM_TONE[s]].bg} active={claimFilter === s} onClick={() => setClaimFilter(s)} />
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr .9fr auto", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
                <PfTh>Person</PfTh>
                <PfTh>Channel · sent</PfTh>
                <PfTh>State</PfTh>
                <PfTh />
              </div>

              {shownInvites.length === 0 ? (
                <div style={{ padding: "34px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>No one in this state</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5 }}>
                    Nothing in the visible slice is {CLAIM_LABEL[claimFilter as ClaimState].toLowerCase()} any more.
                  </div>
                  <div style={{ marginTop: 12 }}><PfBtn variant="secondary" onClick={() => setClaimFilter("all")}>Show all</PfBtn></div>
                </div>
              ) : (
                shownInvites.map((r, i) => (
                  <div key={r.empId} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr .9fr auto", gap: 12, padding: "12px 20px", alignItems: "center", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <PfAvatar init={r.init} tone={r.tone} size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{r.dept} · {r.loc}</div>
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Ic name={CHANNEL_ICON[r.channel] ?? "x"} size={13} color="var(--pf-n400)" />
                        <span style={{ fontSize: 12.5, color: "var(--pf-n600)", fontWeight: 500 }}>{r.channel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 2 }}>{r.sentAt}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <PfBadge tone={CLAIM_TONE[r.state]} dot>{CLAIM_LABEL[r.state]}</PfBadge>
                      {r.baselineMethod && r.state === "baselined" && (
                        <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>via {r.baselineMethod}</div>
                      )}
                      {r.note && (
                        <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.4 }}>{r.note}</div>
                      )}
                    </div>
                    <div style={{ flex: "none" }}>
                      {r.state === "baselined" ? (
                        <PfBtn variant="ghost" small icon="check" onClick={() => toast(`${r.name} claimed ${r.claimedAt} and baselined via ${r.baselineMethod} — nothing left to chase`)}>Done</PfBtn>
                      ) : (
                        <PfBtn
                          variant="secondary" small
                          icon={r.state === "bounced" ? "chat" : r.state === "opened" ? "megaphone" : "paperplane"}
                          onClick={() => reinvite(r.empId, r.name, r.state, r.channel)}
                        >
                          {r.state === "bounced" ? "Retry on WhatsApp" : r.state === "opened" ? "SMS fallback" : r.state === "not-invited" ? "Invite" : "Resend"}
                        </PfBtn>
                      )}
                    </div>
                  </div>
                ))
              )}

              <div style={{ padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                Claim state is tracked here, not on the employment record — a person on notice can have claimed, and a new hire
                can be onboarding and unclaimed. Two axes, never merged.
              </div>
            </PfCard>

            {/* Right rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Funnel */}
              <PfCard>
                <PfCardHead title="Claim funnel" sub={ROLLOUT.window} />
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Invited", n: ROLLOUT.invited, tone: "grey" as PfTone, note: `${ROLLOUT.cohort} cohort − ${ROLLOUT.excluded} excluded` },
                    { label: "Opened", n: ROLLOUT.opened, tone: "yellow" as PfTone, note: `${ROLLOUT.bounced} bounced before opening` },
                    { label: "Claimed", n: ROLLOUT.claimed, tone: "green" as PfTone, note: `median ${ROLLOUT.medianClaimMinutes} min · target ≥ 80%` },
                    { label: "Baselined", n: ROLLOUT.baselined, tone: "blue" as PfTone, note: "the step people skip" },
                  ].map((s) => {
                    const pct = Math.round((s.n / ROLLOUT.invited) * 100);
                    return (
                      <div key={s.label}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", flex: 1 }}>{s.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-n900)" }}>{s.n}</span>
                          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{pct}%</span>
                        </div>
                        <PfProgress pct={pct} tone={s.tone} height={7} />
                        <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>{s.note}</div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: "1px solid var(--pf-n50)", paddingTop: 11, fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                    Baselined is {Math.round((ROLLOUT.baselined / ROLLOUT.invited) * 100)}% of those invited, but{" "}
                    <b style={{ color: "var(--pf-n600)" }}>{baselinePct}% of the {ROLLOUT.cohort}-person cohort</b> — which is the
                    figure the ≥80% target is set against, and the one that misses.
                  </div>
                </div>
              </PfCard>

              {/* Channel split */}
              <PfCard>
                <PfCardHead title="How the invite reached them" sub="Email is the default; it is not the answer for site crews" />
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
                  {(Object.entries(ROLLOUT.channelSplit) as [string, number][]).map(([ch, n]) => (
                    <div key={ch}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                        <Ic name={CHANNEL_ICON[ch]} size={14} color="var(--pf-n400)" />
                        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", flex: 1 }}>{ch}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{n}</span>
                      </div>
                      <PfProgress pct={(n / ROLLOUT.invited) * 100} tone={ch === "Work email" ? "green" : ch === "WhatsApp" ? "purple" : "yellow"} height={6} />
                    </div>
                  ))}
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, borderTop: "1px solid var(--pf-n50)", paddingTop: 11 }}>
                    Only 17 people have no work email address — but 68 were invited on WhatsApp anyway, because a Port
                    Harcourt site crew reads WhatsApp and not a corporate inbox. Having an address and reading it are
                    different things. A rollout that assumed email would have left 80 people behind.
                  </div>
                </div>
              </PfCard>

              {/* Baseline coverage */}
              <PfCard>
                <PfCardHead title="Competency baseline" sub={`${ROLLOUT.baselined} of ${ROLLOUT.cohort} profiles · ${baselinePct}%`} />
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  {BASELINE_METHODS.map((m) => (
                    <div key={m.method}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>{m.label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{m.used}</span>
                        <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>· {m.medianMinutes} min</span>
                      </div>
                      <PfProgress pct={(m.used / ROLLOUT.baselined) * 100} tone={m.method === "AI chat" ? "purple" : "blue"} height={6} />
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{m.note}</div>
                    </div>
                  ))}
                  <button
                    onClick={() => go("skillsgraph")}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", borderTop: "1px solid var(--pf-n50)", marginTop: 1, paddingTop: 11, cursor: "pointer", fontFamily: "inherit", width: "100%" }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)" }}>Writes into the skills graph · FR-076</span>
                    <Ic name="arrowright" size={13} color="var(--pf-primary-600)" />
                  </button>
                </div>
              </PfCard>
            </div>
          </div>
        </>
      )}

      {/* ==================================================================
          TAB 3 · FR-074 — the bridge out
         ================================================================== */}
      {tab === "bridge" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <PfBanner tone={bridgeFired ? "green" : "purple"} icon={bridgeFired ? "check" : "swap"}>
              {bridgeFired ? (
                <><b>The bridge has fired.</b> Onboarding ended by handing {NEW_HIRE.name} to a manager whose home screen already knows him — never into a void.</>
              ) : (
                <><b>Onboarding must not end in a void.</b> Completing the 30/60/90 auto-creates the first goals, the first review date and a baseline competency profile — then hands the hire to a manager who already has him on their team list.</>
              )}
            </PfBanner>
          </div>

          {/* The trigger */}
          <PfCard style={{ marginBottom: 12 }}>
            <PfCardHead
              title="The trigger"
              sub={`The day-90 milestone closing is what fires the bridge — nothing else does`}
            >
              <PfBadge tone={bridgeFired ? "green" : day90Done ? "yellow" : "grey"} dot>
                {bridgeFired ? "Fired" : day90Done ? "Armed" : "Not yet"}
              </PfBadge>
            </PfCardHead>

            <div style={{ padding: 16 }}>
              {/* Milestone rail — day + what it creates only; the bodies live on Stage 10 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                {PLAN_30_60_90.milestones.map((m) => {
                  const done = m.state === "done" || (m.day === 90 && day90Done);
                  const pct = m.day === 90 && day90Done ? 100 : m.progress;
                  return (
                    <div key={m.day} style={{ border: `1px solid ${done ? "var(--pf-primary-100)" : "var(--pf-n50)"}`, borderRadius: 11, padding: "12px 13px", background: done ? "var(--pf-primary-50)" : "var(--pf-n25)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: done ? "var(--pf-primary-600)" : "var(--pf-n400)" }}>DAY {m.day}</span>
                        <span style={{ flex: 1 }} />
                        {done ? <Ic name="check" size={14} color="var(--pf-primary-600)" weight={2.4} /> : <span style={{ fontSize: 11, color: "var(--pf-n400)", fontWeight: 500 }}>{pct}%</span>}
                      </div>
                      <PfProgress pct={pct} tone={done ? "green" : "yellow"} height={5} />
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8, lineHeight: 1.45 }}>
                        {m.creates ? <>Creates: <b style={{ color: "var(--pf-n600)", fontWeight: 600 }}>{m.creates}</b></> : `Due ${m.dueOn} · no bridge artifact`}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Gate + fire */}
              {planApproval === "ai-draft" ? (
                <div style={{ border: "1px solid var(--pf-purple-100)", borderRadius: 11, background: "linear-gradient(180deg, var(--pf-purple-50) 0%, var(--pf-n0) 40%)", padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
                    <PfTile icon="shield" tone="purple" size={26} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>The plan is still an AI draft</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55, marginBottom: 11 }}>
                    A bridge cannot fire off a plan nobody approved. {PLAN_30_60_90.approval.manager} has to review and approve
                    it first — on Manager home, where the gate is an action rather than a queue.
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PfBtn variant="secondary" icon="megaphone" onClick={nudgeManager}>Nudge {PLAN_30_60_90.approval.manager.split(" ")[0]}</PfBtn>
                    <PfBtn variant="secondary" icon="check" onClick={recordApproval}>Record approval on her behalf</PfBtn>
                    <PfBtn variant="ghost" icon="arrowright" onClick={() => setTab("hires")}>See the queue</PfBtn>
                  </div>
                </div>
              ) : (
                <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: 14, background: "var(--pf-n25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <PfTile icon={bridgeFired ? "check" : "target"} tone={bridgeFired ? "green" : "blue"} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                        {bridgeFired
                          ? "All four artifacts created"
                          : day90Done
                            ? "Day-90 milestone closed — the bridge is armed"
                            : `Day-90 milestone "${PLAN_30_60_90.milestones[2].title}" is still open`}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>
                        {bridgeFired
                          ? "Each one landed in a real screen. Open them below."
                          : day90Done
                            ? "Firing writes four artifacts into Goals, Reviews, the skills graph and Manager home."
                            : `${approvedBy ? `Approved by ${approvedBy}` : "Approved · approver not recorded"}. Due ${PLAN_30_60_90.milestones[2].dueOn} — the probation review sits on the same date.`}
                      </div>
                    </div>
                    {!bridgeFired && !day90Done && <PfBtn variant="secondary" icon="check" onClick={completeDay90}>Close the day-90 milestone</PfBtn>}
                    {!bridgeFired && day90Done && <PfBtn variant="primary" icon="swap" onClick={fireBridge}>Fire the bridge</PfBtn>}
                    {bridgeFired && <PfBadge tone="green" dot>FR-074 complete</PfBadge>}
                  </div>
                </div>
              )}
            </div>
          </PfCard>

          {/* Artifacts + payload */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title="What it creates" sub="Four artifacts, each with a real landing screen" />
              {BRIDGE_ARTIFACTS.map((a, i) => {
                const created = bridgeFired;
                const sel = selArtifact === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelArtifact(a.id)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 11, width: "100%", textAlign: "left",
                      padding: "13px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)",
                      border: "none", borderLeft: sel ? "3px solid var(--pf-n900)" : "3px solid transparent",
                      background: sel ? "var(--pf-n25)" : "transparent", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <PfTile icon={a.go === "goals" ? "target" : a.go === "reviews" ? "clipboard" : a.go === "skillsgraph" ? "graph" : "house"} tone={created ? "green" : "grey"} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.what}</span>
                        <PfBadge tone={created ? "green" : "grey"} dot>{created ? "Created" : "Pending"}</PfBadge>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{a.detail}</div>
                      <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 5 }}>Lands in {a.landsIn}</div>
                    </div>
                  </button>
                );
              })}
              <div style={{ padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                The same four are rendered to the hire as a receipt — what just happened for you, with no deep links. This is
                the actionable half.
              </div>
            </PfCard>

            <BridgePayload
              id={selArtifact}
              fired={bridgeFired}
              planPct={planPct}
              onOpen={(stage, label) => {
                if (!bridgeFired) { toast(`${label} has not been created yet — close the day-90 milestone and fire the bridge first`); return; }
                go(stage);
              }}
            />
          </div>

          {/* Pulse → QoH loop */}
          <PfCard style={{ marginTop: 12 }}>
            <PfCardHead
              title="Pulse checks feed quality-of-hire"
              sub="The same 5-dimension instrument Qoh already runs at 30, 60 and 90 — not a second survey"
            >
              <PfBtn variant="secondary" small icon="star" onClick={() => router.push("/qoh")}>Quality-of-hire ↗</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: 16 }}>
              {PULSE.map((p) => (
                <div key={p.day} style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 14px", background: "var(--pf-n25)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 700, color: "var(--pf-n400)" }}>DAY {p.day}</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{p.at}</span>
                  </div>
                  {p.state === "scored" && p.score !== undefined ? (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 7 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px" }}>{p.score}</span>
                        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>/ 5</span>
                      </div>
                      <PfSegments score={p.score} tone="green" />
                    </>
                  ) : (
                    <PfBadge tone={p.state === "scheduled" ? "blue" : "grey"} dot>{p.state === "scheduled" ? "Scheduled" : "Queued"}</PfBadge>
                  )}
                  {p.note && <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 8, lineHeight: 1.45 }}>{p.note}</div>}
                </div>
              ))}
            </div>
            <div style={{ padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>
              Day-90 quality-of-hire loops back into screening accuracy — the hire that worked out becomes an outcome label the
              screening model learns from. Coverage today is 74% against an ≥80% target: 12 of 47 in the Q1 cohort never answered.
            </div>
          </PfCard>
        </>
      )}

      {/* ==================================================================
          TAB 4 · Metrics
         ================================================================== */}
      {tab === "metrics" && (
        <MetricsTab
          filter={metricFilter}
          setFilter={setMetricFilter}
          onWhere={(k) => toast(`${k.label} — ${k.sub}`, k.hit ? "success" : "danger")}
          onGroup={(stage) => (stage.startsWith("/") ? router.push(stage) : go(stage))}
        />
      )}
    </div>
  );
}

/* ------------------------------ path cards ------------------------------- */

function PathCard({ tone, icon, kicker, title, body, stat, active, onClick }: {
  tone: PfTone; icon: string; kicker: string; title: string; body: string; stat: string; active: boolean; onClick: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "flex", gap: 12, textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        background: "var(--pf-n0)", borderRadius: 12, padding: "14px 16px",
        border: `1px solid ${active ? "var(--pf-n900)" : hovered ? "var(--pf-n100)" : "var(--pf-n50)"}`,
        boxShadow: active ? "0 4px 12px -6px rgba(2,6,23,.18)" : "0 1px 3px 0 #f3f3f3",
      }}
    >
      <PfTile icon={icon} tone={tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".6px", color: TONE[tone].fg }}>{kicker}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.5 }}>{body}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: TONE[tone].fg, marginTop: 6 }}>{stat}</div>
      </div>
    </button>
  );
}

/* --------------------------- bridge payload ------------------------------ */

function BridgePayload({ id, fired, planPct, onOpen }: { id: string; fired: boolean; planPct: number; onOpen: (stage: string, label: string) => void }) {
  const dim = fired ? 1 : 0.62;

  if (id === "br-goals") {
    return (
      <PfCard>
        <PfCardHead title="First goals" sub={`${SEEDED_GOALS.length} draft OKRs, seeded from the day-30 and day-60 milestones`}>
          <PfBtn variant="secondary" small icon="target" onClick={() => onOpen("goals", "First goals")}>Open Goals &amp; OKRs</PfBtn>
        </PfCardHead>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, opacity: dim }}>
          {SEEDED_GOALS.map((g) => (
            <div key={g.id} style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "12px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, fontWeight: 600, color: "var(--pf-n300)" }}>{g.id}</span>
                <PfBadge tone="grey">{g.level}</PfBadge>
                <PfBadge tone="purple">Seeded from onboarding</PfBadge>
                <span style={{ flex: 1 }} />
                <PfBadge tone={fired ? "blue" : "grey"} dot>{fired ? "Draft" : "Not written"}</PfBadge>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{g.objective}</div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>{g.owner} · {g.quarter} · from the day-{g.fromMilestone} milestone</div>
              <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 6 }}>
                {g.krs.map((k) => (
                  <div key={k.kr} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-n300)", flex: "none" }} />
                    <span style={{ fontSize: 12, color: "var(--pf-n600)", flex: 1 }}>{k.kr}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n300)" }}>{k.progress}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
            Seeded as drafts, not commitments — the first 1-on-1 action is to confirm them, which is why the manual
            &ldquo;enter starter OKRs&rdquo; step retires when this fires.
          </div>
        </div>
      </PfCard>
    );
  }

  if (id === "br-review") {
    return (
      <PfCard>
        <PfCardHead title={NEXT_CYCLE.name} sub={`Window ${NEXT_CYCLE.window} · ${NEXT_CYCLE.note}`}>
          <PfBtn variant="secondary" small icon="clipboard" onClick={() => onOpen("reviews", "First review date")}>Open Reviews</PfBtn>
        </PfCardHead>
        <div style={{ padding: 16, opacity: dim }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <Fact label="WINDOW" value={NEXT_CYCLE.window} />
            <Fact label="PARTICIPANTS" value={String(NEXT_CYCLE.participants.length)} />
            <Fact label="FIRST CYCLE" value={String(NEXT_CYCLE.participants.filter((p) => p.first).length)} tone="var(--pf-primary-600)" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {NEXT_CYCLE.participants.map((p) => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <PfAvatar init={p.init} tone={p.tone} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: p.first ? 600 : 500, color: "var(--pf-n900)" }}>{p.name}</div>
                  {p.note && <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{p.note}</div>}
                </div>
                {p.first && <PfBadge tone={fired ? "green" : "grey"} dot>{fired ? "Enrolled" : "Will enrol"}</PfBadge>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 12, borderTop: "1px solid var(--pf-n50)", paddingTop: 11 }}>
            The probation decision on {PLAN_30_60_90.milestones[2].dueOn} sits inside this window — so the first review is not a
            surprise conversation bolted onto a probation outcome.
          </div>
        </div>
      </PfCard>
    );
  }

  if (id === "br-baseline") {
    return (
      <PfCard>
        <PfCardHead title="Baseline competency profile" sub="Written at the Stage-6 interview score — not at an aspiration">
          <PfBtn variant="secondary" small icon="graph" onClick={() => onOpen("skillsgraph", "Baseline competency profile")}>Open Skills graph</PfBtn>
        </PfCardHead>
        <div style={{ padding: 16, opacity: dim }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr auto auto", gap: 10, padding: "0 0 9px", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTh>Competency</PfTh>
            <PfTh style={{ width: 120 }}>Level at hire</PfTh>
            <PfTh style={{ width: 74, textAlign: "right" }}>Cluster</PfTh>
          </div>
          {BASELINE_COMPETENCIES.map((c) => {
            const ticks = c.nowCount > c.wasCount;
            return (
              <div key={c.skill} style={{ display: "grid", gridTemplateColumns: "1.1fr auto auto", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--pf-n50)", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.skill}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 1 }}>{c.cluster}</div>
                </div>
                <div style={{ width: 120, display: "flex", alignItems: "center", gap: 7 }}>
                  <PfSegments score={c.level} tone="blue" />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--pf-n400)" }}>{c.level}</span>
                </div>
                <div style={{ width: 74, textAlign: "right", fontSize: 11.5, color: ticks ? "var(--pf-primary-600)" : "var(--pf-n300)", fontWeight: ticks ? 600 : 400 }}>
                  {ticks ? `${c.wasCount} → ${fired ? c.nowCount : c.wasCount}` : `${c.wasCount}`}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 11 }}>
            Three cluster counts tick when this writes — Go, PostgreSQL and Kafka. Distributed systems and Payments were already
            counted from his screening match, so they do not double-count.
          </div>
        </div>
      </PfCard>
    );
  }

  return (
    <PfCard>
      <PfCardHead title="Manager handoff" sub="The failure this whole bridge exists to prevent">
        <PfBtn variant="secondary" small icon="house" onClick={() => onOpen("manager", "Manager handoff")}>Open Manager home</PfBtn>
      </PfCardHead>
      <div style={{ padding: 16, opacity: dim }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <PfAvatar init={ORG_PLACEMENT.manager.init} tone={ORG_PLACEMENT.manager.tone} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{ORG_PLACEMENT.manager.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{ORG_PLACEMENT.manager.role} · {ORG_PLACEMENT.squad}</div>
          </div>
          <PfBadge tone="grey">skip: {ORG_PLACEMENT.skip.name}</PfBadge>
        </div>

        <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "12px 13px", background: "var(--pf-n25)" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n300)", letterSpacing: ".3px", marginBottom: 8 }}>
            THE ROW THAT APPEARS ON HER TEAM LIST
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PfAvatar init={NEW_HIRE.init} tone={NEW_HIRE.tone} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{NEW_HIRE.name}</div>
              <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>Day {NEW_HIRE.dayOfNinety} of 90 · 30/60/90 at {planPct}%</div>
            </div>
            <PfBadge tone="blue" dot>Ramping</PfBadge>
            <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>no review score</span>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 12 }}>
          He carries no review score, because he has had no cycle — showing one would be an invention. &ldquo;Ramping&rdquo; is the
          honest state, and it is the state a manager can actually act on.
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 9, borderTop: "1px solid var(--pf-n50)", paddingTop: 11 }}>
          Squad of {ORG_PLACEMENT.squadSize} inside a {ORG_PLACEMENT.deptHeadcount}-person Engineering org. Without this handoff the
          only employee in onboarding is the one employee a manager&rsquo;s home screen never mentions.
        </div>
      </div>
    </PfCard>
  );
}

/* ------------------------------ metrics tab ------------------------------ */

function MetricsTab({ filter, setFilter, onWhere, onGroup }: {
  filter: "all" | "hit" | "miss";
  setFilter: (f: "all" | "hit" | "miss") => void;
  onWhere: (k: Kpi) => void;
  onGroup: (target: string) => void;
}) {
  const groups = [
    {
      key: "recruiter",
      label: "Recruiter activation",
      sub: "Does a new employer get value in week one?",
      icon: "sparkle", tone: "purple" as PfTone,
      kpis: ONBOARDING_METRICS.recruiter,
      link: "/analytics", linkLabel: "Also on Analytics · Adoption & activation",
    },
    {
      key: "pathA",
      label: "Path A · the new hire",
      sub: "Offer signed → day 90",
      icon: "user", tone: "green" as PfTone,
      kpis: ONBOARDING_METRICS.pathA,
      link: "/onboarding", linkLabel: "Also on Stage 10 · Onboarding",
    },
    {
      key: "pathB",
      label: "Path B · the existing workforce",
      sub: "Import → claim → baseline → habit",
      icon: "stack", tone: "blue" as PfTone,
      kpis: ONBOARDING_METRICS.pathB,
      link: "me", linkLabel: "Also on My workspace · Rollout & adoption",
    },
  ];

  const all = [...ONBOARDING_METRICS.recruiter, ...ONBOARDING_METRICS.pathA, ...ONBOARDING_METRICS.pathB];
  const missed = all.filter((k) => !k.hit);
  const show = (k: Kpi) => filter === "all" || (filter === "hit" ? k.hit : !k.hit);

  return (
    <>
      {/* Scoreboard */}
      <PfCard style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, padding: "16px 20px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.9px", color: "var(--pf-n900)", lineHeight: 1 }}>{all.length - missed.length}</span>
            <span style={{ fontSize: 16, color: "var(--pf-n300)", fontWeight: 600 }}>/ {all.length}</span>
            <span style={{ fontSize: 13, color: "var(--pf-n400)", marginLeft: 4 }}>targets met</span>
          </div>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {all.map((k) => (
              <span
                key={k.key}
                title={`${k.label} — ${k.value}${k.unit ? " " + k.unit : ""} vs ${k.target}`}
                style={{ flex: 1, height: 26, borderRadius: 5, background: k.hit ? "var(--pf-primary-500)" : "var(--pf-yellow-500)" }}
              />
            ))}
          </div>
        </div>
        {missed.length > 0 && (
          <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "13px 20px", background: "var(--pf-yellow-50)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Ic name="warning" size={15} color="var(--pf-yellow-500)" />
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{missed.length} targets missed</span>
              <span style={{ fontSize: 12.5, color: "var(--pf-n500)" }}>— stated, not smoothed</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {missed.map((k) => (
                <div key={k.key} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5 }}>
                  <span style={{ fontWeight: 600, color: "var(--pf-n900)", minWidth: 210 }}>{k.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--pf-yellow-500)" }}>{k.value}{k.unit ? ` ${k.unit}` : ""}</span>
                  <span style={{ color: "var(--pf-n400)" }}>vs {k.target}</span>
                  <span style={{ color: "var(--pf-n400)", flex: 1, minWidth: 0 }}>· {k.sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </PfCard>

      {/* Filter */}
      <div style={{ display: "flex", gap: 7, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Chip label={`All ${all.length}`} active={filter === "all"} onClick={() => setFilter("all")} />
        <Chip label={`On target ${all.length - missed.length}`} dot={TONE.green.bg} active={filter === "hit"} onClick={() => setFilter("hit")} />
        <Chip label={`Missed ${missed.length}`} dot={TONE.yellow.bg} active={filter === "miss"} onClick={() => setFilter("miss")} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>One source · read by the cockpit, Stage 10, Analytics, My workspace and Quality-of-hire</span>
      </div>

      {groups.map((g) => {
        const kpis = g.kpis.filter(show);
        if (kpis.length === 0) return null;
        return (
          <div key={g.key} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <PfTile icon={g.icon} tone={g.tone} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>{g.label}</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>{g.sub}</div>
              </div>
              <button
                onClick={() => onGroup(g.link)}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)" }}
              >
                {g.linkLabel} <Ic name="arrowright" size={13} color="var(--pf-primary-600)" />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {kpis.map((k) => <KpiCard key={k.key} k={k} onWhere={() => onWhere(k)} />)}
            </div>
          </div>
        );
      })}
    </>
  );
}
