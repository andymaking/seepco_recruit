"use client";
import { useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfSegments, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_SQUAD, MY_MATCHES, MY_APPLICATIONS,
  MY_CONSENT, MY_EXPLANATION, MY_PLAN, MY_REVIEW_HISTORY, MY_REVIEW_RELEASE,
} from "@/data/me";

/**
 * Internal roles (route /my-mobility) — the subject's side of the internal market.
 *
 * Mobility.tsx is the recruiter's read of the same three requisitions, and almost
 * nothing on it is hers: it opens with a fleet strip (opt-in rate, internal-fill
 * share, days-to-fill), scores ONE pre-chosen person per role — two of them her
 * colleagues, with their dimension breakdowns spelled out — annotates her row with
 * her leave-risk score and its reasons, and carries a third person's in-flight
 * application labelled "manager sees it only after acceptance" on a page her own
 * manager can open. This page is the replacement, and the unit inverts: the CARD
 * is the role, the match is an attribute of it, and the only person on the page
 * is you.
 *
 * Three rules hold everywhere below. Every open role is listed, including the two
 * you overlap badly with — a market that only shows you strong matches is a
 * brochure. Every match number is derived from your own profile skills and shown
 * with its working. And the promise Mobility.tsx broke — that your manager learns
 * nothing until you accept an interview — is stated in plain words and enforced
 * by the accept step itself.
 */

/* ---------------------------------- types ---------------------------------- */

/** A dimension of the ROLE's requirement set and its weight — never a person's score.
 *  `covered` is your own profile skills read against it, and nobody else's. */
type Requirement = { name: string; weight: number; covered: boolean };

type RoleMatch = {
  role: string; dept: string; loc: string; posted: string; days: number;
  match: number; reqs: Requirement[]; covered: number;
};

type MyApp = { id: string; role: string; stage: string; stageTone: PfTone; day: number; note: string };

type PackItem = { key: string; icon: string; tone: PfTone; label: string; meta: string; stage: string };

/* ------------------------------ derived data ------------------------------- */

const SKILLS = ME_PUBLIC.skills;

/**
 * The same overlap predicate matchFor() runs inside @/data/me, so the ticks on
 * this page and the percentage on this page cannot drift apart. A requirement is
 * covered when it meets a skill that is already on your profile.
 */
const covers = (dim: string): boolean => {
  const k = dim.toLowerCase();
  return SKILLS.some((s) => {
    const m = s.toLowerCase();
    return k.includes(m) || m.includes(k.split(" ")[0]);
  });
};

const daysAgo = (posted: string): number => {
  const n = parseInt(posted, 10) || 0;
  return posted.includes("w") ? n * 7 : posted.includes("mo") ? n * 30 : n;
};

/** All three open roles — no filtering by score, ever. */
const ROLES: RoleMatch[] = MY_MATCHES.map((m) => {
  const reqs: Requirement[] = m.dims.map(([name, weight]) => ({ name, weight, covered: covers(name) }));
  return {
    role: m.role, dept: m.dept, loc: m.loc, posted: m.posted, days: daysAgo(m.posted),
    match: m.match, reqs, covered: reqs.filter((r) => r.covered).length,
  };
});

const BEST = [...ROLES].sort((a, b) => b.match - a.match)[0];
const WEAKEST = [...ROLES].sort((a, b) => a.match - b.match)[0];

const DEPT_ICON: Record<string, string> = {
  Engineering: "stack", "Product & Design": "treemap", "HSE & Compliance": "shield",
};
const DEPT_TONE: Record<string, PfTone> = {
  Engineering: "purple", "Product & Design": "blue", "HSE & Compliance": "yellow",
};

const matchTone = (m: number): PfTone => (m >= 75 ? "green" : m >= 50 ? "blue" : "grey");
const matchWord = (m: number) => (m >= 75 ? "Strong overlap" : m >= 50 ? "Partial overlap" : "Low overlap");

const SORTS = ["Best match", "Recently posted"];

/** The audit promise, scoped to this page — requests and views of these scores. */
const LOGGED = "Every explanation you ask for is audit-logged, and so is every view of the scores on this page.";

/** RIGHT_TO_EXPLANATION names this exact decision — and names you as its only reader. */
const EXPLAIN = MY_EXPLANATION.decisions.find((d) => d.what === "Internal mobility match %") ?? MY_EXPLANATION.decisions[1];

/** Consent clause c5 — the lawful basis this entire page stands on. */
const C5 = MY_CONSENT.clauses[4];
/** The record was taken on her behalf before self-service existed, so its own
 *  wording is third-person. The parts are used, the framing is rewritten to you. */
const RECORDED_BY = MY_CONSENT.recordedBy.split(" (")[0];
const CONSENT_EVENT = MY_CONSENT.at.split(" · ")[0].toLowerCase();
const CONSENT_WHEN = MY_CONSENT.at.split(" · ")[1] ?? MY_CONSENT.at;

const STAGES = ["Applied", "Internal interview", "Decision"];

const SEED_APPS: MyApp[] = MY_APPLICATIONS.map((a) => ({
  id: a.id, role: a.role, stage: a.stage, stageTone: a.stageTone, day: a.day, note: a.note,
}));

/** What the matcher assembled out of records you can already open yourself. */
const PACK: PackItem[] = [
  {
    key: "skills", icon: "graph", tone: "purple",
    label: `Your profile skills (${SKILLS.length})`,
    meta: SKILLS.join(" · "), stage: "myprofile",
  },
  {
    key: "growth", icon: "target", tone: "green",
    label: "Your growth plan",
    meta: `${MY_PLAN.track} · ${MY_PLAN.readiness}% ready · est. ${MY_PLAN.est}`, stage: "mygrowth",
  },
  {
    key: "review", icon: "clipboard", tone: "blue",
    label: `Released review cycles (${MY_REVIEW_HISTORY.length})`,
    meta: MY_REVIEW_HISTORY.map((r) => r.cycle).join(", "), stage: "myreview",
  },
];

const PACK_EXCLUDED: { label: string; meta: string }[] = [
  {
    label: "Your in-flight review",
    meta: `Not released to you yet — it is shared after ${MY_REVIEW_RELEASE.sharedAfter}. If you cannot read it, it does not go in your pack.`,
  },
  {
    label: "Anything written about you in private",
    meta: "Notes whose visibility excludes you are never assembled into an evidence pack, here or anywhere else.",
  },
];

/** What opting in does and does not do — the honest four lines. */
const OPTIN_TERMS: { yes: boolean; text: string }[] = [
  { yes: true, text: "Your profile skills are scanned against every open internal role, and scored for you." },
  { yes: true, text: `Only you see your match numbers — the decision record names its audience as “${EXPLAIN.who}”, and there is no manager view of it anywhere.` },
  { yes: false, text: "No manager can see who browsed a role, who matched it, or who decided against it. There is no such list." },
  { yes: true, text: `An interview you accept is the first thing that surfaces — and it surfaces to ${MY_MANAGER.name}, only then.` },
];

const OFF_TERMS: { keeps: boolean; text: string }[] = [
  { keeps: false, text: "Your profile stops being scanned. No new matches are computed and your scores disappear from this page." },
  { keeps: true, text: "Open roles stay visible and you can still apply to any of them directly — turning matching off does not close the door." },
  { keeps: true, text: "Applications already in flight carry on exactly as they are." },
  { keeps: true, text: "Nothing about your review, your growth plan or your standing changes. This switch is not a signal to anyone." },
];

/* --------------------------------- styles ---------------------------------- */

const chipBtn = {
  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4,
  fontSize: 11.5, fontWeight: 500, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)",
  border: "0.6px solid var(--pf-purple-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer",
} as const;

const footNote = {
  display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)",
  borderTop: "1px solid var(--pf-n50)", borderRadius: "0 0 12px 12px", fontSize: 12, color: "var(--pf-n400)",
} as const;

/* --------------------------------- toggle ---------------------------------- */

function Toggle({ on, onChange, label, small }: { on: boolean; onChange: (v: boolean) => void; label: string; small?: boolean }) {
  const w = small ? 34 : 44;
  const h = small ? 20 : 25;
  const k = h - 6;
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{
        width: w, height: h, borderRadius: 999, position: "relative", cursor: "pointer", padding: 0, flex: "none",
        border: `1px solid ${on ? "var(--pf-primary-500)" : "var(--pf-n100)"}`,
        background: on ? "var(--pf-primary-500)" : "var(--pf-n50)",
        transition: "background .16s ease, border-color .16s ease",
      }}
    >
      <span
        style={{
          position: "absolute", top: 2, left: on ? w - k - 4 : 2, width: k, height: k, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(2,6,23,.25)", transition: "left .16s ease",
        }}
      />
    </button>
  );
}

/* -------------------------------- match ring -------------------------------- */

function MatchRing({ pct, on }: { pct: number; on: boolean }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const tone = matchTone(pct);
  return (
    <div style={{ position: "relative", width: 84, height: 84, flex: "none" }}>
      <svg width={84} height={84} viewBox="0 0 84 84">
        <circle cx={42} cy={42} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={8} />
        {on && (
          <circle
            cx={42} cy={42} r={R} fill="none" stroke={TONE[tone].fg} strokeWidth={8}
            strokeLinecap="round" strokeDasharray={`${(pct / 100) * C} ${C}`}
            transform="rotate(-90 42 42)" style={{ transition: "stroke-dasharray .4s ease" }}
          />
        )}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {on ? (
          <>
            <span style={{ fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", lineHeight: 1 }}>{pct}%</span>
            <span style={{ fontSize: 10, color: "var(--pf-n400)", marginTop: 3 }}>match</span>
          </>
        ) : (
          <>
            <Ic name="shield" size={17} color="var(--pf-n300)" />
            <span style={{ fontSize: 10, color: "var(--pf-n400)", marginTop: 3 }}>not scored</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- requirement row ------------------------------ */

function ReqRow({ r, on, roleName, last }: { r: Requirement; on: boolean; roleName: string; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={() =>
        toast(
          r.covered
            ? `“${r.name}” is on your profile — it carries the full weight of ${r.weight} toward your ${roleName} score`
            : `“${r.name}” is not on your profile yet — it carries a fraction of its ${r.weight} weight until it is`
        )
      }
      style={{
        padding: "10px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.name}
        </span>
        <span style={{ width: 74, textAlign: "right", fontSize: 12, color: "var(--pf-n400)", flex: "none" }}>
          <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{r.weight}</span>/100
        </span>
        <span style={{ width: 128, display: "flex", justifyContent: "flex-end", flex: "none" }}>
          {on ? (
            <PfBadge tone={r.covered ? "green" : "grey"} dot>{r.covered ? "On your profile" : "Not yet yours"}</PfBadge>
          ) : (
            <PfBadge tone="grey">Not scored</PfBadge>
          )}
        </span>
      </div>
      {/* Green = already yours · blue = the role wants it and it is not yours yet.
          With matching off the bar is drained rather than removed — the weight is
          the role's either way, only the read of you stops. */}
      <div style={{ marginTop: 7, opacity: on ? 1 : 0.4 }}>
        <PfProgress pct={r.weight} tone={!on ? "grey" : r.covered ? "green" : "blue"} height={6} />
      </div>
    </div>
  );
}

/* --------------------------------- role card -------------------------------- */

function RoleCard({ r, on, open, applied, onToggle, onApply }: {
  r: RoleMatch; on: boolean; open: boolean; applied: boolean;
  onToggle: () => void; onApply: () => void;
}) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const tone = matchTone(r.match);
  return (
    <PfCard style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 20, flexWrap: "wrap" }}>
        <MatchRing pct={r.match} on={on} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <PfTile icon={DEPT_ICON[r.dept] ?? "swap"} tone={DEPT_TONE[r.dept] ?? "grey"} size={28} />
            <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{r.role}</span>
            {applied && <PfBadge tone="blue" dot>Applied</PfBadge>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 6 }}>
            {r.dept} · {r.loc} · posted {r.posted}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {on ? (
              <>
                <PfBadge tone={tone} dot>{matchWord(r.match)}</PfBadge>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--pf-n400)" }}>
                  <PfSegments score={r.covered} outOf={r.reqs.length} tone={tone} />
                  {r.covered} of {r.reqs.length} requirements on your profile
                </span>
              </>
            ) : (
              <PfBadge tone="grey">Matching off — you can still apply</PfBadge>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: "none", minWidth: 132 }}>
          <PfBtn
            variant={applied ? "secondary" : "primary"} icon={applied ? "check" : "paperplane"}
            onClick={onApply} full
          >
            {applied ? "Applied" : "Apply"}
          </PfBtn>
          <div {...hoverProps}>
            <PfBtn
              variant="secondary" icon={open ? "caretdown" : "caretright"} onClick={onToggle} full
              style={hovered ? { background: "var(--pf-n25)" } : undefined}
            >
              {open ? "Hide requirements" : "Requirements"}
            </PfBtn>
          </div>
        </div>
      </div>

      {open && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
            <PfTh style={{ flex: 1 }}>The role&rsquo;s requirement set</PfTh>
            <PfTh style={{ width: 74, textAlign: "right" }}>Weight</PfTh>
            <PfTh style={{ width: 128, textAlign: "right" }}>Your coverage</PfTh>
          </div>
          {r.reqs.map((q, i) => (
            <ReqRow key={q.name} r={q} on={on} roleName={r.role} last={i === r.reqs.length - 1} />
          ))}
          <div style={footNote}>
            <Ic name="info" size={13} color="var(--pf-n300)" />
            <span style={{ flex: 1 }}>
              {on
                ? `${EXPLAIN.basis} — the weights belong to the role, the coverage comes from your profile. Visible to ${EXPLAIN.who.toLowerCase()}.`
                : `${EXPLAIN.basis} — nothing is computed while matching is off.`}
            </span>
            <button onClick={() => toast(`Requirement set for ${r.role} — ${r.reqs.map((q) => `${q.name} (${q.weight})`).join(", ")}`)} style={chipBtn}>
              ✦ See the weights
            </button>
          </div>
        </>
      )}
    </PfCard>
  );
}

/* ----------------------------- application row ------------------------------ */

function AppRow({ a, accepted, withdrawn, onAccept, onWithdraw }: {
  a: MyApp; accepted: boolean; withdrawn: boolean; onAccept: () => void; onWithdraw: () => void;
}) {
  const go = useGo();
  const idx = Math.max(0, STAGES.indexOf(a.stage));
  const canAccept = a.stage === "Internal interview" && !withdrawn;
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)", opacity: withdrawn ? 0.62 : 1, transition: "opacity .16s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 200, fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", textDecoration: withdrawn ? "line-through" : "none" }}>
          {a.role}
        </span>
        <PfBadge tone={withdrawn ? "grey" : a.stageTone} dot>{withdrawn ? "Withdrawn" : a.stage}</PfBadge>
        <PfBadge tone="grey">Day {a.day}</PfBadge>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--pf-n300)" }}>{a.id}</span>
      </div>

      {/* stage stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginTop: 12 }}>
        {STAGES.map((s, i) => {
          const done = !withdrawn && i <= idx;
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: i === STAGES.length - 1 ? "none" : 1, minWidth: 0 }}>
              <span
                style={{
                  width: 17, height: 17, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: done ? "var(--pf-primary-500)" : "var(--pf-n0)",
                  border: done ? "none" : "1.6px solid var(--pf-n100)",
                }}
              >
                {done && <Ic name="check" size={10} color="#fff" weight={2.6} />}
              </span>
              <span style={{ fontSize: 12, fontWeight: done ? 600 : 500, color: done ? "var(--pf-n900)" : "var(--pf-n400)", marginLeft: 7, whiteSpace: "nowrap" }}>{s}</span>
              {i < STAGES.length - 1 && (
                <span style={{ flex: 1, height: 2, borderRadius: 2, margin: "0 10px", background: !withdrawn && i < idx ? "var(--pf-primary-500)" : "var(--pf-n50)", minWidth: 14 }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 11 }}>{a.note}</div>

      {/* who can see this application, right now */}
      <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap", alignItems: "center" }}>
        <PfBadge tone="green" dot>Visible to you</PfBadge>
        <PfBadge tone="blue" dot>Visible to the hiring team for this role</PfBadge>
        <PfBadge tone={accepted ? "yellow" : "grey"} dot>
          {accepted ? `${MY_MANAGER.name} notified today — you accepted` : `Not visible to ${MY_MANAGER.name}`}
        </PfBadge>
        <span style={{ flex: 1 }} />
        {canAccept && !accepted && (
          <PfBtn small variant="primary" icon="calendar" onClick={onAccept}>Accept the interview</PfBtn>
        )}
        {!withdrawn && (
          <PfBtn small variant="secondary" icon="x" onClick={onWithdraw}>Withdraw</PfBtn>
        )}
        <PfBtn small variant="ghost" icon="target" onClick={() => go("mygrowth")}>Prepare</PfBtn>
      </div>
    </div>
  );
}

/* ---------------------------------- screen ---------------------------------- */

export default function MyMobility() {
  const go = useGo();
  const toast = useToast();
  const me = useMe();

  const [tab, setTab] = useState("roles");
  const [sort, setSort] = useState(SORTS[0]);
  const [open, setOpen] = useState<string[]>([BEST.role]);
  const [accepted, setAccepted] = useState<string[]>([]);
  const [withdrawn, setWithdrawn] = useState<string[]>([]);
  const [packOff, setPackOff] = useState<string[]>([]);

  const on = me.optIn;

  /** MY_APPLICATIONS is the seed row; useMe().applications is what you have sent since. */
  const apps = useMemo<MyApp[]>(() => {
    const extra: MyApp[] = me.applications
      .filter((role) => !SEED_APPS.some((a) => a.role === role))
      .map((role, i) => ({
        id: `MA-${i + 2}`, role, stage: "Applied", stageTone: "blue" as PfTone, day: 0,
        note: "Sent by you today · your evidence pack was auto-built from your profile",
      }));
    return [...extra, ...SEED_APPS];
  }, [me.applications]);

  const liveApps = apps.filter((a) => !withdrawn.includes(a.id));
  const appliedRoles = useMemo(() => new Set(apps.map((a) => a.role)), [apps]);

  const sorted = useMemo(
    () => [...ROLES].sort((a, b) => (sort === SORTS[0] ? b.match - a.match : a.days - b.days)),
    [sort]
  );

  const explained = me.explanationRequests.some((r) => r.what === EXPLAIN.what);
  const optInLog = me.audit.filter((a) => a.action.includes("internal matching")).slice(0, 3);

  /* --------------------------------- actions -------------------------------- */

  const toggleOpen = (role: string) =>
    setOpen((prev) => (prev.includes(role) ? prev.filter((x) => x !== role) : [...prev, role]));

  const apply = (r: RoleMatch) => {
    if (appliedRoles.has(r.role)) {
      setTab("apps");
      toast(`You already have an application open for ${r.role} — opening it`);
      return;
    }
    me.apply(r.role);
    toast(`Applied to ${r.role} — your evidence pack went with it. ${MY_MANAGER.name} is not told.`, "success");
  };

  const acceptInterview = (a: MyApp) => {
    if (accepted.includes(a.id)) return;
    setAccepted((prev) => [...prev, a.id]);
    toast(`Interview accepted for ${a.role} — from today ${MY_MANAGER.name} can see this application. Nothing before this point was shared.`, "success");
  };

  const withdraw = (a: MyApp) => {
    setWithdrawn((prev) => [...prev, a.id]);
    toast(`Withdrawn from ${a.role} — the hiring team is told you stepped back, and nobody else is.`, "danger");
  };

  const togglePack = (item: PackItem) => {
    const off = packOff.includes(item.key);
    setPackOff((prev) => (off ? prev.filter((x) => x !== item.key) : [...prev, item.key]));
    toast(off ? `${item.label} added back to your evidence pack` : `${item.label} left out of your evidence pack — future applications go without it`);
  };

  const setOptIn = (v: boolean) => {
    me.setOptIn(v);
    toast(
      v
        ? "Internal matching is on — your profile is scanned for open roles, and only you see the scores."
        : "Internal matching is off — nothing about you is scored against a role, and your scores are gone from this page.",
      v ? "success" : "danger"
    );
  };

  const askExplanation = () => {
    if (explained) { go("myprivacy"); return; }
    me.requestExplanation(EXPLAIN.what, MY_EXPLANATION.slaDays);
    toast(`Explanation requested — “${EXPLAIN.what}”. A person replies within ${MY_EXPLANATION.slaDays} days, not a model.`, "success");
  };

  /* ---------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Internal roles</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Every open role inside the company, scored against your own profile — the strong ones and the weak ones.
            You are the only person who sees these numbers, and nobody learns you looked.
          </div>
        </div>
        <PfBtn icon="user" onClick={() => go("myprofile")}>Your profile</PfBtn>
        <PfBtn variant="primary" icon="target" onClick={() => go("mygrowth")}>Your growth plan</PfBtn>
      </div>

      {/* KPI strip — every number here is about you, and only you */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat
          icon="swap" tone={on ? "green" : "grey"} label="Matching"
          value={on ? "On" : "Off"} unit={`consent ${C5.id}`}
          delta={on ? "You can switch it off" : "Nothing is scanned"} deltaTone={on ? "green" : "grey"}
        />
        <PfStat
          icon="orbit" tone="blue" label="Open to you"
          value={ROLES.length} unit="roles" delta="All of them, all scores" deltaTone="blue"
        />
        <PfStat
          icon="star" tone="purple" label="Your best match"
          value={on ? `${BEST.match}%` : "—"} unit={on ? "match" : "matching off"}
          delta={on ? BEST.role.split(" (")[0] : "not scored"} deltaTone={on ? "green" : "grey"}
        />
        <PfStat
          icon="paperplane" tone="yellow" label="Your applications"
          value={liveApps.length} unit="in flight"
          delta={liveApps[0] ? liveApps[0].stage : "none open"} deltaTone={liveApps[0] ? "blue" : "grey"}
        />
      </div>

      {/* Page sections */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "roles", label: "Open roles", count: String(ROLES.length) },
            { key: "apps", label: "My applications", count: String(liveApps.length) },
            { key: "optin", label: "Visibility & opt-in", count: on ? "On" : "Off" },
          ]}
        />
      </div>

      {/* ============================== OPEN ROLES ============================== */}
      {tab === "roles" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {on ? (
            <PfBanner tone="green" icon="shield">
              Matching is on. Your profile is scanned against open roles and scored for you alone — browsing a role,
              matching a role and passing on a role are all invisible to everyone else.
            </PfBanner>
          ) : (
            <PfBanner tone="yellow" icon="warning" cta="Turn matching on" onCta={() => setTab("optin")}>
              Matching is off, so nothing about you is being scored. The roles below are still yours to read and apply to directly.
            </PfBanner>
          )}

          {/* Sort — your view of the market, nobody else's */}
          <PfCard>
            <PfCardHead
              title="Open roles"
              sub={
                on
                  ? `Scored against the ${SKILLS.length} skills on your profile. Weak matches stay on the list — a market that only shows you your strong ones is a brochure.`
                  : "Listed without scores while matching is off. The list itself never depended on your opt-in."
              }
            >
              <PfTabs tabs={SORTS} active={sort} onChange={setSort} />
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px" }}>
              <Ic name="info" size={15} color="var(--pf-n300)" />
              <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)" }}>
                {on
                  ? <>Your strongest overlap is <b style={{ color: "var(--pf-n600)" }}>{BEST.role}</b> at {BEST.match}%; your weakest is <b style={{ color: "var(--pf-n600)" }}>{WEAKEST.role}</b> at {WEAKEST.match}%. Both are shown because both are true.</>
                  : <>Three roles are open across {ROLES.map((r) => r.dept).filter((d, i, a) => a.indexOf(d) === i).length} departments. Turn matching on to see how your own profile reads against them.</>}
              </span>
              <PfBadge tone="grey">{MY_SQUAD.split(" · ")[0]} today</PfBadge>
            </div>
          </PfCard>

          {sorted.map((r) => (
            <RoleCard
              key={r.role}
              r={r}
              on={on}
              open={open.includes(r.role)}
              applied={appliedRoles.has(r.role)}
              onToggle={() => toggleOpen(r.role)}
              onApply={() => apply(r)}
            />
          ))}

          {/* How the number was worked out — the right-to-explanation, on the page it applies to */}
          <PfCard>
            <PfCardHead title="How your match is worked out" sub="Every automated call about you can be explained — including this one.">
              <PfBadge tone="purple" dot>Right to explanation</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {[
                { k: "What is decided", v: EXPLAIN.what, icon: "gauge", tone: "blue" as PfTone },
                { k: "Who sees it", v: EXPLAIN.who, icon: "shield", tone: "green" as PfTone },
                { k: "What it is based on", v: EXPLAIN.basis, icon: "graph", tone: "purple" as PfTone },
              ].map((c, i) => (
                <div key={c.k} style={{ padding: "16px 20px", borderRight: i < 2 ? "1px solid var(--pf-n50)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <PfTile icon={c.icon} tone={c.tone} size={26} />
                    <PfTh>{c.k}</PfTh>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", marginTop: 9, lineHeight: 1.45 }}>{c.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)" }}>
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)" }}>
                {EXPLAIN.yourMove} — they are on each role card above. {LOGGED}
              </div>
              <PfBtn variant="secondary" icon={explained ? "check" : "question"} onClick={askExplanation}>
                {explained ? "Requested — see your receipt" : "Ask for the model card"}
              </PfBtn>
            </div>
          </PfCard>
        </div>
      )}

      {/* =========================== MY APPLICATIONS =========================== */}
      {tab === "apps" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfBanner tone="green" icon="shield">
            {MY_MANAGER.name} learns about an internal application at exactly one moment — when you accept an interview.
            Not when you browse, not when you match, not when you apply.
          </PfBanner>

          <PfCard>
            <PfCardHead
              title="Your applications"
              sub={`${liveApps.length} open · every stage below is yours to see the day it changes.`}
            >
              <PfBtn small variant="secondary" icon="swap" onClick={() => setTab("roles")}>Browse open roles</PfBtn>
            </PfCardHead>
            {apps.length === 0 ? (
              <div style={{ padding: "34px 20px", textAlign: "center" }}>
                <PfTile icon="paperplane" tone="grey" size={38} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>No applications open</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>
                  Applying is the only act on this page anyone else can see — and only the hiring team, until you accept an interview.
                </div>
              </div>
            ) : (
              apps.map((a) => (
                <AppRow
                  key={a.id}
                  a={a}
                  accepted={accepted.includes(a.id)}
                  withdrawn={withdrawn.includes(a.id)}
                  onAccept={() => acceptInterview(a)}
                  onWithdraw={() => withdraw(a)}
                />
              ))
            )}
            <div style={footNote}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Day counts run from the day you applied. Nothing on this page is timed to your review cycle or your manager&rsquo;s calendar.
            </div>
          </PfCard>

          {/* Who can see an application, and when */}
          <PfCard>
            <PfCardHead title="Who can see an application, and when" sub="The whole rule, in three lines. It does not change per role.">
              <PfBadge tone="green" dot>Enforced by the accept step</PfBadge>
            </PfCardHead>
            {[
              {
                icon: "user", tone: "green" as PfTone, who: "You",
                when: "From the moment you open the role",
                what: "Every stage, every date, the full requirement breakdown and your own evidence pack.",
              },
              {
                icon: "users", tone: "blue" as PfTone, who: "The hiring team for that role",
                when: "From the moment you apply",
                what: "Your application and the evidence pack you sent with it — nothing about your current squad or your standing in it.",
              },
              {
                icon: "shield", tone: "yellow" as PfTone, who: `${MY_MANAGER.name}, your manager`,
                when: "Only after you accept an interview",
                what: "That you are in an internal process, so the conversation can be an honest one. Never before that, and never automatically.",
              },
            ].map((row, i) => (
              <div key={row.who} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px", borderBottom: i < 2 ? "1px solid var(--pf-n50)" : "none" }}>
                <PfTile icon={row.icon} tone={row.tone} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{row.who}</span>
                    <PfBadge tone={row.tone}>{row.when}</PfBadge>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>{row.what}</div>
                </div>
              </div>
            ))}
            <div style={footNote}>
              <Ic name="shield" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1 }}>There is no fourth line. No report lists who browsed a role, matched it or stepped back from it.</span>
              <button onClick={() => go("myprivacy")} style={chipBtn}>✦ See it on your privacy page</button>
            </div>
          </PfCard>

          {/* Evidence pack */}
          <PfCard>
            <PfCardHead
              title="Your evidence pack"
              sub="Auto-built from your own profile — assembled from records you can already open yourself, and nothing else."
            >
              <PfBadge tone="purple" dot>{PACK.length - packOff.length} of {PACK.length} included</PfBadge>
            </PfCardHead>
            {PACK.map((p, i) => {
              const included = !packOff.includes(p.key);
              return (
                <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < PACK.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                  <PfTile icon={p.icon} tone={included ? p.tone : "grey"} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: included ? "var(--pf-n900)" : "var(--pf-n400)" }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.meta}</div>
                  </div>
                  <PfBtn small variant="ghost" icon="arrowright" onClick={() => go(p.stage)}>Open</PfBtn>
                  <Toggle small on={included} label={`Include ${p.label} in your evidence pack`} onChange={() => togglePack(p)} />
                </div>
              );
            })}
            <div style={{ padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh style={{ marginBottom: 9 }}>Deliberately not in the pack</PfTh>
              {PACK_EXCLUDED.map((x) => (
                <div key={x.label} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 8 }}>
                  <span style={{ width: 17, height: 17, borderRadius: "50%", border: "1.6px solid var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>
                    <Ic name="x" size={10} color="var(--pf-n300)" weight={2.2} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)" }}>{x.label}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>{x.meta}</div>
                  </div>
                </div>
              ))}
            </div>
          </PfCard>
        </div>
      )}

      {/* ========================= VISIBILITY & OPT-IN ========================= */}
      {tab === "optin" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* The switch itself */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 20, flexWrap: "wrap" }}>
              <PfTile icon="swap" tone={on ? "green" : "grey"} size={44} />
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15.5, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>Internal role matching</span>
                  <PfBadge tone={on ? "green" : "grey"} dot>{on ? "On" : "Off"}</PfBadge>
                  <PfBadge tone="grey">Clause {C5.id}</PfBadge>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 6, lineHeight: 1.55 }}>
                  {C5.purpose} — now used for {C5.nowFor.toLowerCase()}. It is yours to switch, both ways, as often as you like.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--pf-n900)" : "var(--pf-n400)" }}>{on ? "Matching on" : "Matching off"}</span>
                <Toggle on={on} label="Internal role matching" onChange={setOptIn} />
              </div>
            </div>
            <div style={footNote}>
              <Ic name="shield" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1 }}>
                Lawful basis: <b style={{ color: "var(--pf-n600)" }}>{C5.lawfulBasis}</b>
                {C5.required ? " · required to employ you" : " · never required — declining costs you nothing"}.
                Recorded on {CONSENT_WHEN} at your {CONSENT_EVENT} by {RECORDED_BY}, on your behalf, before self-service existed. You hold the switch now.
              </span>
            </div>
          </PfCard>

          {/* What it means — both directions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            <PfCard>
              <PfCardHead title="What being opted in means" sub="Four lines, and there is no fifth.">
                <PfBadge tone={on ? "green" : "grey"}>{on ? "Live now" : "Not active"}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "6px 20px 16px" }}>
                {OPTIN_TERMS.map((t) => (
                  <div key={t.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12 }}>
                    <span
                      style={{
                        width: 18, height: 18, borderRadius: "50%", flex: "none", marginTop: 1,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: t.yes ? "var(--pf-primary-50)" : "var(--pf-n50)",
                        border: `1px solid ${t.yes ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
                      }}
                    >
                      <Ic name={t.yes ? "check" : "x"} size={10} color={t.yes ? "var(--pf-primary-500)" : "var(--pf-n400)"} weight={2.4} />
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{t.text}</span>
                  </div>
                ))}
              </div>
            </PfCard>

            <PfCard>
              <PfCardHead title="What switching it off does" sub="And, just as importantly, what it does not touch.">
                <PfBadge tone={on ? "grey" : "yellow"}>{on ? "If you switch off" : "In effect now"}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "6px 20px 16px" }}>
                {OFF_TERMS.map((t) => (
                  <div key={t.text} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 12 }}>
                    <span
                      style={{
                        width: 18, height: 18, borderRadius: "50%", flex: "none", marginTop: 1,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: t.keeps ? "var(--pf-blue-50)" : "var(--pf-n50)",
                        border: `1px solid ${t.keeps ? "var(--pf-blue-100)" : "var(--pf-n100)"}`,
                      }}
                    >
                      <Ic name={t.keeps ? "check" : "pause"} size={10} color={t.keeps ? "var(--pf-blue-500)" : "var(--pf-n400)"} weight={2.4} />
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{t.text}</span>
                  </div>
                ))}
              </div>
            </PfCard>
          </div>

          {/* The clause, as it was recorded */}
          <PfCard>
            <PfCardHead title={`Consent clause ${C5.id}, as it was recorded`} sub={MY_CONSENT.ndprNote}>
              <PfBadge tone={C5.accepted ? "green" : "grey"} dot>{C5.accepted ? "Accepted at conversion" : "Declined at conversion"}</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh style={{ flex: 1 }}>What you agreed to</PfTh>
              <PfTh style={{ width: 168 }}>Collected for</PfTh>
              <PfTh style={{ width: 188 }}>Used for now</PfTh>
              <PfTh style={{ width: 96, textAlign: "right" }}>Lawful basis</PfTh>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{C5.purpose}</span>
              <span style={{ width: 168, fontSize: 12.5, color: "var(--pf-n400)" }}>{C5.wasFor === "—" ? "Nothing — this is new since you joined" : C5.wasFor}</span>
              <span style={{ width: 188, fontSize: 12.5, color: "var(--pf-n600)" }}>{C5.nowFor}</span>
              <span style={{ width: 96, textAlign: "right" }}><PfBadge tone="blue">{C5.lawfulBasis}</PfBadge></span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)" }}>
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)" }}>
                Your consent receipt lists all {MY_CONSENT.clauses.length} clauses and every change you have made to them.
                Withdrawing {C5.id} there turns this switch off — it is the same switch, read from the other side.
              </div>
              <PfBtn variant="primary" icon="shield" onClick={() => go("myprivacy")}>Your consent receipt</PfBtn>
            </div>
          </PfCard>

          {/* Your own log */}
          <PfCard>
            <PfCardHead
              title="Your changes to this setting"
              sub="Logged for you, not about you — the same log that records every view of your record."
            >
              <PfBadge tone="grey">{optInLog.length} change{optInLog.length === 1 ? "" : "s"}</PfBadge>
            </PfCardHead>
            {optInLog.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
                <PfTile icon="clock" tone="grey" size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>No changes yet in this session</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>
                    The standing record is the one taken at your {CONSENT_EVENT} on {CONSENT_WHEN}.
                  </div>
                </div>
                <PfBadge tone={on ? "green" : "grey"} dot>{on ? "On" : "Off"}</PfBadge>
              </div>
            ) : (
              optInLog.map((a, i) => (
                <div key={`${a.at}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: i < optInLog.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                  <PfTile icon="clock" tone={a.action.startsWith("opted in") ? "green" : "yellow"} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>You {a.action}</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{a.at}</div>
                  </div>
                  <PfBadge tone="grey">Recorded</PfBadge>
                </div>
              ))
            )}
            <div style={footNote}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              <span style={{ flex: 1 }}>{LOGGED}</span>
              <button onClick={() => go("myprivacy")} style={chipBtn}>✦ Open your full log</button>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
