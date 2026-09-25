"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  MY_LEARNING, MY_UP_NEXT, MY_RECS, MY_ENTITLEMENT, MY_LND_REQUESTS,
  MY_MANAGER, NAIRA,
} from "@/data/me";
import { useMe } from "@/state/me";

/**
 * My learning — the Me-pillar half of the Learning Hub (FR-071 · FR-081).
 *
 * The Hub is written from L&D's side: it shows the company credit pool, how much
 * of it has been consumed, a consolidated invoice to Finance, and AI proposals
 * across a WHOLE TEAM (including one that names a colleague's competency gap).
 * None of that is hers. This page renders the same catalogue and the same rule
 * from the subject's side: what YOU are learning, what YOU may draw, and who
 * signs off above your threshold. Her entitlement, never the employer's budget.
 *
 * The catalogue rows are duplicated locally on purpose — same titles, providers,
 * times, tags and costs as the Hub, so it is one story everywhere — minus the
 * per-item enrolment counts, which are an org rollup, and minus the company
 * lessons belonging to other departments' compliance tracks.
 */

/* --------------------------------- catalogue -------------------------------- */

type ItemType = "Course" | "Coaching session";

const TYPE_TONE: Record<ItemType, PfTone> = { Course: "blue", "Coaching session": "purple" };

const COURSE_COST = 45_000;
const COACHING_COST = 120_000;

type CatalogItem = {
  id: string; type: ItemType; title: string; attribution: string;
  time: string; tag: string; cost: number; perSession?: boolean;
};

/** The six partner items from the shared catalogue, priced identically. */
const CATALOG: CatalogItem[] = [
  { id: "C-01", type: "Course", title: "Distributed Systems Design Masterclass", attribution: "Doronstack · Kora AI Practice Studio", time: "6h 30m", tag: "Distributed systems", cost: COURSE_COST },
  { id: "C-02", type: "Course", title: "Deep Work — Time Management for Senior ICs", attribution: "Doronstack ✦", time: "3h 15m", tag: "Time management", cost: COURSE_COST },
  { id: "K-01", type: "Coaching session", title: "Staff-track Career Coaching", attribution: "1:1 with a Doronstack specialist", time: "45m / session", tag: "Leadership", cost: COACHING_COST, perSession: true },
  { id: "C-03", type: "Course", title: "Payments Domain Bootcamp", attribution: "Doronstack · Kora AI Practice Studio", time: "8h 00m", tag: "Payments", cost: COURSE_COST },
  { id: "K-02", type: "Coaching session", title: "New-Manager Transition Coaching", attribution: "1:1 with a Doronstack specialist", time: "60m / session", tag: "Leadership", cost: COACHING_COST, perSession: true },
  { id: "C-04", type: "Course", title: "Data Storytelling with Power BI", attribution: "Doronstack ✦", time: "4h 00m", tag: "Analytics", cost: COURSE_COST },
];

const FILTERS = ["All", "Courses", "Coaching"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_TYPE: Record<Filter, ItemType | null> = { All: null, Courses: "Course", Coaching: "Coaching session" };

/** NAIRA() renders 0 as "₦0k" — her draw is a flat zero and should read like one. */
const money = (n: number) => (n === 0 ? "₦0" : NAIRA(n));

const costOf = (title: string) => CATALOG.find((c) => c.title === title)?.cost ?? COURSE_COST;

/** Each recommendation's evidence lives on one of her own pages — never a team page. */
const REC_SOURCE_GO: Record<string, string> = { "R-1": "myreview", "R-2": "mygrowth" };

const THRESHOLD = MY_ENTITLEMENT.approverThreshold;
const APPROVER = MY_ENTITLEMENT.approver;
const APPROVER_FIRST = APPROVER.split(" ")[0];

/* --------------------------------- my rows ---------------------------------- */

type Row = { title: string; provider: string; module: string; pct: number; offline?: boolean };

const whenOf = (meta: string) => {
  const [head, ...rest] = meta.split(" · ");
  const scheduled = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(head);
  return { chip: scheduled ? head : "Any time", detail: scheduled ? rest.join(" · ") : meta, scheduled };
};

/* ------------------------------- small pieces ------------------------------- */

function ProviderChip({ children, dashed, onClick }: { children: ReactNode; dashed?: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
        color: dashed ? "var(--pf-n400)" : "var(--pf-n900)", background: hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        border: `1px ${dashed ? "dashed var(--pf-n300)" : "solid var(--pf-n100)"}`, borderRadius: 999,
        padding: "7px 13px", cursor: "pointer", lineHeight: 1.3, whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function TagChip({ tag, onClick }: { tag: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title="Same skill taxonomy as your growth plan — click to filter"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500,
        color: hovered ? "var(--pf-n900)" : "var(--pf-n500)", background: hovered ? "var(--pf-n100)" : "var(--pf-n50)",
        border: "0.6px solid var(--pf-n100)", borderRadius: 999, padding: "3px 9px", cursor: "pointer",
        whiteSpace: "nowrap", lineHeight: 1.35,
      }}
    >
      <Ic name="graph" size={11} />
      {tag}
    </button>
  );
}

/* ------------------------------ in-progress row ----------------------------- */

function CourseRow({ r, last, onContinue, onOffline, onSave }: {
  r: Row; last: boolean; onContinue: () => void; onOffline: () => void; onSave: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const done = r.pct >= 100;
  return (
    <div
      {...hoverProps}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease" }}
    >
      <PfTile icon={done ? "check" : "book"} tone={done ? "green" : r.pct === 0 ? "grey" : "blue"} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{r.title}</span>
          {done && <PfBadge tone="green">Complete</PfBadge>}
          {r.offline && (
            <button
              onClick={onOffline}
              title="Saved on your phone — open your mobile companion"
              style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500, color: "var(--pf-blue-500)", background: "var(--pf-blue-50)", border: "0.6px solid var(--pf-blue-100)", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
            >
              <Ic name="download" size={11} /> Saved offline
            </button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{r.provider} · {r.module}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8 }}>
          <div style={{ flex: 1, maxWidth: 360 }}>
            <PfProgress pct={r.pct} tone={done ? "green" : r.pct === 0 ? "grey" : "green"} height={6} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)" }}>{r.pct}%</span>
        </div>
      </div>
      {!done && !r.offline && (
        <PfBtn small variant="ghost" icon="download" onClick={onSave}>Save offline</PfBtn>
      )}
      <PfBtn small variant={done ? "secondary" : "primary"} icon={done ? "star" : "play"} onClick={onContinue}>
        {done ? "Certificate" : r.pct === 0 ? "Start" : "Continue"}
      </PfBtn>
    </div>
  );
}

/* --------------------------------- up next ---------------------------------- */

function UpNextTile({ title, meta, onOpen }: { title: string; meta: string; onOpen: (scheduled: boolean) => void }) {
  const { hovered, hoverProps } = useHover();
  const w = whenOf(meta);
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "center", gap: 11, flex: "1 1 260px", minWidth: 0,
        border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px",
        background: hovered ? "var(--pf-n25)" : "var(--pf-n0)", transition: "background .12s ease",
      }}
    >
      <div style={{ width: 46, flex: "none", textAlign: "center", borderRight: "1px solid var(--pf-n50)", paddingRight: 11 }}>
        <div style={{ display: "flex", justifyContent: "center", color: w.scheduled ? "var(--pf-purple-500)" : "var(--pf-blue-500)" }}>
          <Ic name={w.scheduled ? "calendar" : "clock"} size={15} />
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--pf-n900)", marginTop: 3, letterSpacing: "-.1px" }}>{w.chip}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{w.detail}</div>
      </div>
      <PfBtn small variant="secondary" icon={w.scheduled ? "calendar" : "play"} onClick={() => onOpen(w.scheduled)}>
        {w.scheduled ? "Remind me" : "Start"}
      </PfBtn>
    </div>
  );
}

/* ----------------------------- recommendation card --------------------------- */

type RecState = "open" | "enrolled" | "dismissed";

function RecCard({ rec, state, cost, onEnrol, onDismiss, onSource, onOpenMine }: {
  rec: (typeof MY_RECS)[number]; state: RecState; cost: number;
  onEnrol: () => void; onDismiss: () => void; onSource: () => void; onOpenMine: () => void;
}) {
  const enrolled = state === "enrolled";
  return (
    <PfCard pad="14px 16px" style={{ display: "flex", flexDirection: "column", gap: 10, background: enrolled ? "var(--pf-primary-50)" : "var(--pf-n0)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PfBadge tone={TYPE_TONE[rec.type as ItemType] ?? "blue"} dot>{rec.type}</PfBadge>
        <span style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
          <Ic name="clock" size={12} /> {rec.time}
        </span>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{rec.title}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>{rec.provider} · {money(cost)} entitlement</div>
      </div>

      <div style={{ background: enrolled ? "var(--pf-n0)" : "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "9px 11px" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
          <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
          <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
            <span style={{ fontWeight: 600 }}>Why you&rsquo;re seeing this:</span> {rec.reason}.
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginLeft: 18 }}>
          <div style={{ width: 46, flex: "none" }}><PfProgress pct={rec.confidence * 100} tone="purple" height={5} /></div>
          <span style={{ fontSize: 11, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>confidence {rec.confidence.toFixed(2)}</span>
        </div>
        <button
          onClick={onSource}
          style={{ background: "none", border: "none", padding: 0, marginTop: 6, marginLeft: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: "var(--pf-n400)", display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          Read the evidence — {rec.source} <Ic name="arrowright" size={10} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
        {enrolled ? (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--pf-primary-500)" }}>
              <Ic name="check" size={13} /> Enrolled
            </span>
            <span style={{ flex: 1 }} />
            <PfBtn small variant="secondary" onClick={onOpenMine}>Open it</PfBtn>
          </>
        ) : (
          <>
            <PfBtn
              small variant="primary" icon="plus" tone={TONE.purple.bg}
              style={{ boxShadow: "0 6px 12px -6px rgba(175,82,222,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
              onClick={onEnrol}
            >
              Enrol · {money(cost)}
            </PfBtn>
            <PfBtn small variant="ghost" icon="x" onClick={onDismiss}>Not now</PfBtn>
          </>
        )}
      </div>
    </PfCard>
  );
}

/* ------------------------------- threshold rail ------------------------------ */

/** The whole rule on one axis: where ₦120,000 sits, and which side you land on. */
function ThresholdRail({ onExplain }: { onExplain: () => void }) {
  const MAX = 240_000;
  const at = (n: number) => `${(n / MAX) * 100}%`;
  return (
    <PfCard pad="14px 18px 16px">
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <PfTile icon="wallet" tone="green" size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Your approval line sits at {money(THRESHOLD)}</div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>
            At or under it, you enrol yourself. Over it, it becomes a request {APPROVER} approves — and either way you pay {money(0)}.
          </div>
        </div>
        <PfBtn small variant="secondary" icon="question" onClick={onExplain}>How it works</PfBtn>
      </div>

      <div style={{ position: "relative", paddingTop: 22, paddingBottom: 26 }}>
        {/* markers above the rail */}
        {[
          { at: COURSE_COST, label: `Courses · ${money(COURSE_COST)}`, color: "var(--pf-primary-500)" },
          { at: COACHING_COST, label: `Coaching · ${money(COACHING_COST)}/session`, color: "var(--pf-n900)" },
        ].map((m) => (
          <div key={m.label} style={{ position: "absolute", top: 0, left: at(m.at), transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: m.color }}>{m.label}</span>
            <div style={{ width: 1, height: 8, background: "var(--pf-n100)", margin: "3px auto 0" }} />
          </div>
        ))}

        <div style={{ position: "relative", height: 12, borderRadius: 7, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-n50)", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: `${100 - (THRESHOLD / MAX) * 100}%`, background: "var(--pf-primary-50)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: at(COURSE_COST), width: 8, marginLeft: -4, borderRadius: 4, background: "var(--pf-primary-500)" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: at(THRESHOLD), width: 2, background: "var(--pf-n900)" }} />
        </div>

        {/* zone captions below the rail */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", gap: 8 }}>
          <div style={{ width: `${(THRESHOLD / MAX) * 100}%`, paddingRight: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-500)" }}>
              <Ic name="check" size={12} /> Enrols instantly
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-yellow-500)" }}>
              <Ic name="shield" size={12} /> {APPROVER} approves
            </span>
          </div>
        </div>
      </div>
    </PfCard>
  );
}

/* ------------------------------- catalogue card ------------------------------ */

function CatalogCard({ c, status, sessions, onSessions, onTake, onTag }: {
  c: CatalogItem; status: "open" | "enrolled" | "requested";
  sessions: number; onSessions: (n: number) => void; onTake: (cost: number, sessions: number) => void; onTag: () => void;
}) {
  const coaching = !!c.perSession;
  const cost = coaching ? c.cost * sessions : c.cost;
  const overLine = cost > THRESHOLD;

  const step = (dir: -1 | 1) => (
    <button
      onClick={() => onSessions(Math.max(1, Math.min(6, sessions + dir)))}
      disabled={dir < 0 ? sessions <= 1 : sessions >= 6}
      style={{
        width: 22, height: 22, borderRadius: 6, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)",
        color: (dir < 0 ? sessions <= 1 : sessions >= 6) ? "var(--pf-n300)" : "var(--pf-n900)",
        fontSize: 13, fontWeight: 600, fontFamily: "inherit", lineHeight: 1,
        cursor: (dir < 0 ? sessions <= 1 : sessions >= 6) ? "default" : "pointer",
      }}
    >
      {dir < 0 ? "−" : "+"}
    </button>
  );

  return (
    <PfCard pad="13px 14px" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PfBadge tone={TYPE_TONE[c.type]} dot>{c.type}</PfBadge>
        <span style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
          <Ic name="clock" size={12} /> {c.time}
        </span>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{c.title}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ color: "var(--pf-primary-500)", fontSize: 11, lineHeight: 1 }}>✦</span>
          {c.attribution}
        </div>
      </div>

      <div><TagChip tag={c.tag} onClick={onTag} /></div>

      {/* cost + the threshold verdict, recomputed live for coaching blocks */}
      <div style={{ borderTop: "1px solid var(--pf-n50)", paddingTop: 9, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", lineHeight: 1.1 }}>{money(cost)}</div>
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>
            {coaching ? `${money(c.cost)} × ${sessions} session${sessions > 1 ? "s" : ""}` : "drawn as an entitlement"}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        {coaching && status === "open" && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: "none" }}>
            {step(-1)}
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", minWidth: 12, textAlign: "center" }}>{sessions}</span>
            {step(1)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
        {status === "requested" ? (
          <PfBadge tone="yellow" dot>With {APPROVER_FIRST}</PfBadge>
        ) : status === "enrolled" ? (
          <PfBadge tone="green" dot>Yours</PfBadge>
        ) : (
          <PfBadge tone={overLine ? "yellow" : "green"}>
            {overLine ? `${APPROVER_FIRST} approves` : "Enrols instantly"}
          </PfBadge>
        )}
        <span style={{ flex: 1 }} />
        {status === "open" ? (
          <PfBtn small variant="primary" icon={coaching ? "calendar" : "play"} onClick={() => onTake(cost, sessions)}>
            {coaching ? "Book" : "Enrol"}
          </PfBtn>
        ) : (
          <PfBtn small variant="secondary" icon="check" onClick={() => onTake(cost, sessions)}>
            {status === "enrolled" ? "Enrolled" : "Requested"}
          </PfBtn>
        )}
      </div>
    </PfCard>
  );
}

/* ------------------------------- approvals row ------------------------------- */

type ReqRow = { id: string; item: string; cost: number; state: "Pending" | "Approved"; at: string };

function RequestRow({ r, last, onNudge, onOpen }: { r: ReqRow; last: boolean; onNudge: () => void; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  const pending = r.state === "Pending";
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{
        display: "grid", gridTemplateColumns: "minmax(0,1fr) 92px 120px 40px", alignItems: "center", gap: 12,
        padding: "12px 20px", cursor: "pointer", borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.at}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{money(r.cost)}</div>
      <div><PfBadge tone={pending ? "yellow" : "green"} dot>{pending ? `With ${APPROVER_FIRST}` : "Approved"}</PfBadge></div>
      <div style={{ display: "flex", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
        {pending ? (
          <PfBtn small variant="ghost" icon="bell" onClick={onNudge} />
        ) : (
          <Ic name="check" size={15} color="var(--pf-primary-500)" />
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- screen ----------------------------------- */

export default function MyLearning() {
  const go = useGo();
  const toast = useToast();
  const { learningEnrolled, lndRequests, enroll } = useMe();

  const [tab, setTab] = useState("mine");
  const [cat, setCat] = useState<Filter>("All");
  const [q, setQ] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [sessions, setSessions] = useState<Record<string, number>>({});

  /* ------------------------------- derived state ------------------------------ */

  const rows: Row[] = useMemo(
    () => [
      ...MY_LEARNING,
      ...learningEnrolled.map((t) => ({ title: t, provider: "Doronstack ✦", module: "Just enrolled", pct: 0 })),
    ],
    [learningEnrolled],
  );

  const inProgress = rows.filter((r) => r.pct < 100);
  const completed = rows.filter((r) => r.pct >= 100);
  const offlineCount = rows.filter((r) => r.offline).length;

  const requests: ReqRow[] = useMemo(() => [...lndRequests, ...MY_LND_REQUESTS], [lndRequests]);
  const pendingCount = requests.filter((r) => r.state === "Pending").length;

  const statusOf = (title: string): "open" | "enrolled" | "requested" => {
    if (learningEnrolled.some((t) => t.startsWith(title))) return "enrolled";
    if (requests.some((r) => r.item.startsWith(title))) return "requested";
    return "open";
  };

  const recState = (title: string): RecState =>
    learningEnrolled.some((t) => t.startsWith(title)) ? "enrolled" : dismissed.includes(title) ? "dismissed" : "open";

  const openRecs = MY_RECS.filter((r) => recState(r.title) !== "dismissed");

  const shown = useMemo(() => {
    const t = FILTER_TYPE[cat];
    const needle = q.trim().toLowerCase();
    return CATALOG.filter(
      (c) =>
        (!t || c.type === t) &&
        (needle === "" || `${c.title} ${c.tag} ${c.attribution} ${c.type}`.toLowerCase().includes(needle)),
    );
  }, [cat, q]);

  /* -------------------------------- interactions ------------------------------ */

  /** The one rule the page exists to make legible — and the only write it makes. */
  const take = (title: string, cost: number) => {
    const result = enroll(title, cost, THRESHOLD);
    if (result === "requested") {
      toast(`Sent to ${APPROVER} — “${title}” at ${money(cost)} is over your ${money(THRESHOLD)} line, so she approves it. Track it under Budget & approvals.`);
    } else if (cost === THRESHOLD) {
      toast(`Booked “${title}” — ${money(cost)} sits exactly on your line, so it went straight through. ${money(0)} from you.`, "success");
    } else {
      toast(`Enrolled in “${title}” — ${money(cost)} drawn as your entitlement, ${money(0)} out of pocket.`, "success");
    }
  };

  const takeCatalog = (c: CatalogItem, cost: number, n: number) => {
    const status = statusOf(c.title);
    if (status === "requested") {
      toast(`“${c.title}” is already with ${APPROVER} — you'll get a notification the moment she approves it.`);
      return;
    }
    if (status === "enrolled") {
      setTab("mine");
      toast(`“${c.title}” is already yours — picking up where you left off.`);
      return;
    }
    take(c.perSession && n > 1 ? `${c.title} — ${n} sessions` : c.title, cost);
  };

  const enrolRec = (title: string) => take(title, costOf(title));

  const dismissRec = (title: string) => {
    setDismissed((d) => [...d, title]);
    toast(`Hidden — “${title}” won't be suggested again this quarter. Your gap map is unchanged.`);
  };

  const explainThreshold = () =>
    toast(`Anything at or under ${money(THRESHOLD)} enrols the moment you click. Above it, ${APPROVER} sees the request and the reason. You are never invoiced.`);

  /* ---------------------------------- render ---------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My learning</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            What you have open, the full catalogue you can draw on, and who signs off above your {money(THRESHOLD)} line — you never pay out of pocket.
          </div>
        </div>
        <PfBtn variant="secondary" icon="trend" onClick={() => go("mygrowth")}>Your growth plan</PfBtn>
        <PfBtn variant="primary" icon="search" onClick={() => setTab("catalog")}>Browse catalogue</PfBtn>
      </div>

      {/* -------------------------------- KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="book" tone="green" label="In progress" value={inProgress.length} unit={inProgress.length === 1 ? "course" : "courses"} delta="Yours only" deltaTone="grey" />
        <PfStat icon="check" tone="blue" label="Completed" value={completed.length} unit="this year" delta="Feeds your plan" deltaTone="green" />
        <PfStat icon="download" tone="purple" label="Saved offline" value={offlineCount} unit="module" delta="On your phone" deltaTone="blue" />
        <PfStat icon="wallet" tone="yellow" label="You have paid" value={money(MY_ENTITLEMENT.yourDraw)} unit="out of pocket" delta="Company-funded" deltaTone="green" />
      </div>

      {/* ------------------------------ section tabs ----------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "mine", label: "In progress", count: String(inProgress.length) },
            { key: "catalog", label: "Catalog", count: String(CATALOG.length) },
            { key: "budget", label: "Budget & approvals", count: String(pendingCount) },
          ]}
        />
      </div>

      {/* ================================== MINE ================================= */}
      {tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* keep going */}
          <PfCard>
            <PfCardHead title="Keep going" sub="Your own enrolments — progress syncs back from the provider each night.">
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n600)" }}>{completed.length}/{rows.length} done</span>
              <div style={{ width: 56 }}><PfProgress pct={rows.length ? (completed.length / rows.length) * 100 : 0} height={6} /></div>
            </PfCardHead>
            {rows.map((r, i) => (
              <CourseRow
                key={`${r.title}-${i}`}
                r={r}
                last={i === rows.length - 1}
                onContinue={() =>
                  r.pct >= 100
                    ? toast(`Certificate opened — “${r.title}” · the completion is already on your growth plan.`, "success")
                    : toast(`Resuming “${r.title}” at ${r.pct}% — ${r.module}.`)
                }
                onOffline={() => go("mymobile")}
                onSave={() => toast(`“${r.title}” saved to your phone — the module plays with no data, and progress syncs when you're back online.`, "success")}
              />
            ))}
          </PfCard>

          {/* up next — dated strip */}
          <PfCard>
            <PfCardHead title="Up next" sub="Queued off your growth plan — one self-paced, one live.">
              <PfBtn small variant="secondary" icon="calendar" onClick={() => toast(`Both sessions added to your calendar — ${MY_UP_NEXT.map((u) => u.title).join(" and ")}.`, "success")}>
                Add both
              </PfBtn>
            </PfCardHead>
            <div style={{ display: "flex", gap: 10, padding: "14px 20px", flexWrap: "wrap" }}>
              {MY_UP_NEXT.map((u) => (
                <UpNextTile
                  key={u.title}
                  title={u.title}
                  meta={u.meta}
                  onOpen={(scheduled) =>
                    scheduled
                      ? toast(`Reminder set — “${u.title}” · ${u.meta}. You'll get a nudge 30 minutes before.`, "success")
                      : toast(`Starting “${u.title}” — ${u.meta}. Your place is kept if you stop.`)
                  }
                />
              ))}
            </div>
          </PfCard>

          {/* recommendations — HER gaps */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 6, marginBottom: 2 }}>
            <PfTile icon="sparkle" tone="purple" size={26} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>✦ Suggested for your own gaps</div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1 }}>
                Read off your record and nobody else&rsquo;s — your review packet and your Staff-track readiness scan. Nothing enrols unless you say so.
              </div>
            </div>
            <PfBadge tone="purple">AI · {openRecs.length} open</PfBadge>
          </div>

          {openRecs.length === 0 ? (
            <PfCard pad="26px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing suggested right now</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>
                The scan re-runs when your next review packet or readiness scan lands.
              </div>
            </PfCard>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
              {openRecs.map((r) => (
                <RecCard
                  key={r.id}
                  rec={r}
                  state={recState(r.title)}
                  cost={costOf(r.title)}
                  onEnrol={() => enrolRec(r.title)}
                  onDismiss={() => dismissRec(r.title)}
                  onSource={() => go(REC_SOURCE_GO[r.id] ?? "mygrowth")}
                  onOpenMine={() => toast(`“${r.title}” is in Keep going, right above — start any time.`)}
                />
              ))}
            </div>
          )}

          <PfBanner cta="open" onCta={() => go("mygrowth")}>
            <span style={{ fontWeight: 600 }}>Finishing something moves your plan — </span>
            <span style={{ fontWeight: 400 }}>completions tick off the Staff-track milestones on your growth plan without you filing anything.</span>
          </PfBanner>
        </div>
      )}

      {/* ================================ CATALOG ================================ */}
      {tab === "catalog" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <ThresholdRail onExplain={explainThreshold} />

          {/* providers */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)" }}>Provider</span>
            <ProviderChip onClick={() => toast("Doronstack — the launch partner: courses, Kora practice studio and 1:1 specialist coaching. You sign in over SSO and only your name and work email cross, under the NDPR data-processing agreement.", "ai")}>
              <span style={{ color: "var(--pf-primary-500)", fontSize: 13, lineHeight: 1 }}>✦</span>
              Doronstack
              <PfBadge tone="green">Launch partner</PfBadge>
            </ProviderChip>
            <ProviderChip onClick={() => go("myprivacy")}>
              <Ic name="shield" size={13} color="var(--pf-n500)" />
              What the provider gets
            </ProviderChip>
            <ProviderChip dashed onClick={() => toast(`Request drafted to ${APPROVER} — say what you need and why. Anything the catalogue doesn't carry goes through the same approval.`)}>
              <Ic name="plus" size={12} />
              Ask for something else
            </ProviderChip>
          </div>

          {/* filters */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <PfTabs tabs={[...FILTERS]} active={cat} onChange={(t) => setCat(t as Filter)} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "6px 11px", flex: 1, minWidth: 160, maxWidth: 240 }}>
              <Ic name="search" size={14} color="var(--pf-n400)" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search the catalogue…"
                style={{ border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "var(--pf-n900)", width: "100%" }}
              />
              {q !== "" && (
                <button onClick={() => setQ("")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--pf-n400)", display: "flex" }}>
                  <Ic name="x" size={12} />
                </button>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{shown.length} of {CATALOG.length} items</span>
          </div>

          {shown.length === 0 ? (
            <PfCard pad="34px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><PfTile icon="search" tone="grey" size={34} /></div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 3 }}>Nothing matches &ldquo;{q}&rdquo;</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 12 }}>Try another skill tag, or ask for something the catalogue doesn&rsquo;t carry yet.</div>
              <PfBtn variant="secondary" onClick={() => { setQ(""); setCat("All"); toast("Filters cleared — all six items back."); }}>Clear filters</PfBtn>
            </PfCard>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
              {shown.map((c) => (
                <CatalogCard
                  key={c.id}
                  c={c}
                  status={statusOf(c.title)}
                  sessions={sessions[c.id] ?? 1}
                  onSessions={(n) => setSessions((s) => ({ ...s, [c.id]: n }))}
                  onTake={(cost, n) => takeCatalog(c, cost, n)}
                  onTag={() => { setCat("All"); setQ(c.tag); }}
                />
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n400)", padding: "2px 2px 0" }}>
            <Ic name="info" size={13} color="var(--pf-n300)" />
            Coaching is priced per session — step the count up and watch which side of your {money(THRESHOLD)} line the booking lands on.
          </div>
        </div>
      )}

      {/* ================================ BUDGET ================================= */}
      {tab === "budget" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* entitlement */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", flexWrap: "wrap" }}>
              <PfTile icon="wallet" tone="green" size={38} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>Your learning is paid for</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5, maxWidth: 520 }}>
                  {MY_ENTITLEMENT.body}
                </div>
              </div>
              <div style={{ display: "flex", gap: 26, flexWrap: "wrap", borderLeft: "1px solid var(--pf-n50)", paddingLeft: 20 }}>
                <div>
                  <PfTh>You have drawn</PfTh>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", marginTop: 4 }}>{money(MY_ENTITLEMENT.yourDraw)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 2 }}>out of pocket, 2026</div>
                </div>
                <div>
                  <PfTh>Your approval line</PfTh>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", marginTop: 4 }}>{money(THRESHOLD)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 2 }}>per item</div>
                </div>
                <div>
                  <PfTh>Who approves</PfTh>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
                    <PfAvatar init={MY_MANAGER.init} tone={MY_MANAGER.tone} size={26} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{MY_MANAGER.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>{MY_MANAGER.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* how it works — four steps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
            {[
              { icon: "search", tone: "blue" as PfTone, step: "1", title: "You pick it", body: "Anything in the catalogue, whenever you want it. No form to fill." },
              { icon: "check", tone: "green" as PfTone, step: "2", title: `At or under ${money(THRESHOLD)}`, body: "It enrols on the spot and the entitlement is drawn for you." },
              { icon: "shield", tone: "yellow" as PfTone, step: "3", title: `Over ${money(THRESHOLD)}`, body: `It becomes a request ${APPROVER} sees, with what you asked for and why.` },
              { icon: "wallet", tone: "purple" as PfTone, step: "4", title: `You pay ${money(0)}`, body: "The provider invoices the company. Nothing touches your payslip." },
            ].map((s) => (
              <PfCard key={s.step} pad="14px 16px">
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <PfTile icon={s.icon} tone={s.tone} size={28} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", letterSpacing: ".4px" }}>STEP {s.step}</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{s.body}</div>
              </PfCard>
            ))}
          </div>

          {/* approvals table */}
          <PfCard>
            <PfCardHead title="Your requests" sub={`Everything you have asked for, and where it got to. ${pendingCount} waiting on ${APPROVER_FIRST}.`}>
              <PfBtn small variant="secondary" icon="plus" onClick={() => setTab("catalog")}>Request something</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 92px 120px 40px", gap: 12, padding: "9px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Item</PfTh>
              <PfTh>Cost</PfTh>
              <PfTh>Status</PfTh>
              <PfTh />
            </div>
            {requests.map((r, i) => (
              <RequestRow
                key={r.id}
                r={r}
                last={i === requests.length - 1}
                onOpen={() =>
                  r.state === "Pending"
                    ? toast(`“${r.item}” · ${money(r.cost)} — with ${APPROVER} since it crossed your ${money(THRESHOLD)} line. ${r.at}.`)
                    : toast(`“${r.item}” · ${money(r.cost)} — approved. ${r.at}.`, "success")
                }
                onNudge={() => toast(`Reminder sent to ${APPROVER} — “${r.item}” at ${money(r.cost)} is still waiting.`, "success")}
              />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="clock" size={13} color="var(--pf-n300)" />
              Approved items appear under In progress the same day — you do not need to enrol a second time.
            </div>
          </PfCard>

          {/* the invariant, said out loud */}
          <PfCard pad="13px 16px" style={{ background: "var(--pf-n25)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <Ic name="shield" size={15} color="var(--pf-n400)" />
              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>
                <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>This is your entitlement, not the company&rsquo;s budget.</span>{" "}
                You are seeing what you may draw and what you have asked for. The size of the company pool, how much of it is spent and what anyone else has taken from it are not part of your record — and are not shown here.
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* -------------------------------- footer --------------------------------- */}
      <button
        onClick={() => go("myprivacy")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 24, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: "var(--pf-n400)" }}
      >
        <Ic name="shield" size={13} />
        Enrolments hand off to the provider over SSO with the minimum personal data, under the NDPR agreement — see exactly what leaves
        <Ic name="arrowright" size={12} />
      </button>
    </div>
  );
}
