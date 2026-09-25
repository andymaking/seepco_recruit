"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, PfSegments, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ENGAGE_TODAY, HELPDESK_FIREWALL,
  TICKETS, TICKET_CATEGORIES, TICKET_STATES, CATEGORY_ICON,
  stateTone, ticketSla, slaFor, SLA_POLICY, byCategory, helpdeskKpis,
  KB_ARTICLES, kbArticle, kbBody, deflectionRate, helpfulRate,
  TRIAGE, triageWhy, triageAccuracy,
  ENGAGE_MODEL_CARDS, ENGAGE_AI_SURFACES,
  type Ticket, type TicketCategory, type TicketState, type TriageSuggestion,
  type KbArticle, type EngageAccess,
} from "@/data/engage";
import { activeAdapter } from "@/data/adapters";
import type { WhyThis } from "@/data/trust";

/**
 * HR service desk — PRD v2.1 FR-095.
 *
 * The whole screen is built on one distinction and one number.
 *
 * THE DISTINCTION (FR-088 firewall). A ticket is the employee ASKING. A
 * disciplinary case is HR ISSUING. Nothing on this page escalates into one,
 * there is no convert button because there is no code path, and the strip at
 * the top says so before you have read anything else. A helpdesk that can turn
 * into a disciplinary file is a helpdesk nobody uses.
 *
 * THE NUMBER. Deflection — questions an article answered so completely that no
 * ticket was ever raised. Every other helpdesk metric rewards being needed;
 * this one rewards not being needed, which is the only way two people answer
 * for 358 workers.
 *
 * AI: MC-08 reads the subject and body of a ticket, and proposes a category, an
 * article and an assignee. A person assigns. Every proposal carries "Why this?"
 * with what it read and what it refused to read (FR-093, AS-13).
 */

/* --------------------------------- helpers -------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const DESK = "People Ops · Funke Adebayo";
const MC08 = ENGAGE_MODEL_CARDS.find((m) => m.id === "MC-08")!;
const AS13 = ENGAGE_AI_SURFACES.find((s) => s.id === "AS-13")!;
const PAYROLL = activeAdapter("payroll_connector");
const KPI = helpdeskKpis();
const ACC = triageAccuracy();

const first = (n: string) => n.split(" ")[0];
const team = (assignee?: string) => (assignee ? assignee.split("·")[0].trim() : "");
const who = (assignee?: string) => (assignee ? (assignee.split("·")[1] ?? assignee).trim() : "");

/** Every desk that appears anywhere in the seeded queue or in a suggestion. */
const DESKS = Array.from(
  new Set([...TICKETS.map((t) => t.assignee).filter(Boolean) as string[], ...TRIAGE.map((t) => t.suggestedAssignee)]),
).sort();

const fieldStyle: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 10px", outline: "none", width: "100%",
};

/** Session stamps derive from a counter so SSR and the client render the same string. */
const stampAt = (n: number) => {
  const mins = 12 + n * 9;
  return `Aug 28 · ${String(9 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
};

/**
 * DERIVED, not invented: the article → category map is read back off the desk.
 * An article's category is the category of the tickets that were actually
 * answered from it. Where no ticket has ever been answered from an article
 * there is nothing to infer from, and the answer is "Other" — a person picks.
 */
const catForArticle = (id: string): { category: TicketCategory; n: number } => {
  const a = kbArticle(id);
  const cats = (a?.relatedTickets ?? [])
    .map((tid) => TICKETS.find((t) => t.id === tid)?.category)
    .filter(Boolean) as TicketCategory[];
  return { category: cats[0] ?? "Other", n: cats.length };
};

/** A literal word match over the article text. Not a model, and the copy says so. */
const matchArticles = (text: string): { article: KbArticle; hits: string[] }[] => {
  const words = Array.from(new Set(text.toLowerCase().split(/[^a-z₦0-9]+/).filter((w) => w.length >= 4)));
  if (!words.length) return [];
  return KB_ARTICLES.map((a) => {
    const hay = `${a.title} ${a.section} ${kbBody(a.id)}`.toLowerCase();
    const hits = words.filter((w) => hay.includes(w));
    return { article: a, hits };
  })
    .filter((r) => r.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || b.article.views - a.article.views);
};

/**
 * The desk access log. The spine ships SURVEY_ACCESS_LOG for FR-094 but no
 * helpdesk equivalent, so the seed here is DERIVED from the tickets themselves —
 * an assignee who replied to a ticket read it, and the timestamp is the reply's
 * own. Nothing about the log is invented; the session appends to it live.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 26 · 13:35" → a sortable integer. Deterministic, no Date parsing. */
const stampKey = (at: string) => {
  const [d, t] = at.split(" · ");
  const [mon, day] = d.split(" ");
  return MONTHS.indexOf(mon) * 1_000_000 + Number(day) * 10_000 + Number((t ?? "00:00").replace(":", ""));
};

const SEED_LOG: EngageAccess[] = TICKETS.filter((t) => t.assignee && t.thread.length > 1)
  .map((t) => ({
    at: t.thread[1].at,
    who: t.assignee!,
    action: t.firstResponseHours !== undefined ? "opened ticket and replied" : "opened ticket",
    scope: `${t.id} · ${t.category}`,
  }))
  .sort((a, b) => stampKey(a.at) - stampKey(b.at));

/* =============================== small parts =============================== */

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

/** FR-093 — the one affordance, identical everywhere a model or a matcher speaks. */
function WhyThisPanel({ why, notInputs, extra }: { why: WhyThis; notInputs?: string[]; extra?: ReactNode }) {
  const go = useGo();
  const [open, setOpen] = useState(false);
  const card = ENGAGE_MODEL_CARDS.find((m) => m.id === why.modelCard);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-purple-500)" />
        Why this?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 10, width: "100%" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{why.claim}</div>
          {why.confidence !== undefined && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 9 }}>
              <PfSegments score={why.confidence * 5} tone={why.confidence >= 0.8 ? "green" : why.confidence >= 0.6 ? "yellow" : "red"} />
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{Math.round(why.confidence * 100)}% confidence</span>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                {why.confidence >= 0.8 ? "high — still a proposal" : "low — the model is telling you to look"}
              </span>
            </div>
          )}
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "11px 0 6px" }}>Basis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {why.basis.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          {notInputs && notInputs.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "12px 0 6px" }}>Not inputs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {notInputs.map((n) => (
                  <div key={n} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                    <Ic name="x" size={12} color="var(--pf-red-500)" weight={2.2} />
                    <span>{n}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {extra}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
            <button
              onClick={() => go("trust")}
              title="Model card index — Trust center"
              style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
            >
              <Ic name="robot" size={12} color="var(--pf-purple-500)" />
              Model card {why.modelCard} · {card?.name ?? "Helpdesk triage"}
            </button>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Human gate: {why.humanGate.toLowerCase()}</span>
          </div>
        </div>
      )}
    </>
  );
}

/** Anything a machine produced is purple and labelled. Nothing else on this page is. */
function AiBlock({ label, chip, children, why }: { label: string; chip?: string; children: ReactNode; why?: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--pf-purple-100)", background: "var(--pf-purple-50)", borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>{label}</span>
        {chip && <PfBadge tone="purple">{chip}</PfBadge>}
        <span style={{ flex: 1 }} />
        {why}
      </div>
      {children}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ic key={i} name="star" size={12} color={i <= n ? "var(--pf-yellow-500)" : "var(--pf-n100)"} weight={i <= n ? 2.2 : 1.6} />
      ))}
    </span>
  );
}

function TicketRow({ t, on, onPick }: { t: Ticket; on: boolean; onPick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const sla = ticketSla(t);
  return (
    <div
      {...hoverProps}
      onClick={onPick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", cursor: "pointer",
        borderTop: "1px solid var(--pf-n50)",
        background: on || hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: on ? "inset 3px 0 0 var(--pf-n900)" : "none",
        transition: "background .12s ease",
      }}
    >
      <PfAvatar init={t.init} tone={t.tone} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.subject}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{t.id}</span>
          {sla.breached && <PfBadge tone="red" dot>breaching</PfBadge>}
        </div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {t.raisedByName} · raised {t.raisedAt} · {t.assignee ? `${who(t.assignee)}, ${team(t.assignee)}` : "unassigned"}
        </div>
      </div>
      <div style={{ width: 128, flex: "none", display: "flex", alignItems: "center", gap: 6 }}>
        <Ic name={CATEGORY_ICON[t.category]} size={13} color="var(--pf-n400)" />
        <span style={{ fontSize: 12, color: "var(--pf-n500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.category}</span>
      </div>
      <div style={{ width: 62, flex: "none", textAlign: "right", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{t.elapsedHours}h</div>
      <div style={{ width: 186, flex: "none", display: "flex", justifyContent: "flex-end" }}>
        <PfBadge tone={sla.tone} dot>{sla.label}</PfBadge>
      </div>
      <div style={{ width: 110, flex: "none", display: "flex", justifyContent: "flex-end" }}>
        <PfBadge tone={stateTone(t.state)}>{t.state}</PfBadge>
      </div>
      <Ic name="caretright" size={14} color="var(--pf-n300)" />
    </div>
  );
}

function Msg({ m }: { m: Ticket["thread"][number] }) {
  if (m.role === "System") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 13px", background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 9 }}>
        <Ic name="info" size={13} color="var(--pf-n400)" />
        <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{m.body}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", whiteSpace: "nowrap" }}>{m.at}</span>
      </div>
    );
  }
  const hr = m.role === "HR";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <PfAvatar init={m.author.split(" ").map((w) => w[0]).slice(0, 2).join("")} tone={hr ? "#16B364" : "#AF52DE"} size={28} />
      <div style={{ flex: 1, minWidth: 0, background: hr ? "var(--pf-primary-50)" : "var(--pf-n0)", border: `1px solid ${hr ? "var(--pf-primary-100)" : "var(--pf-n100)"}`, borderRadius: 10, padding: "11px 13px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{m.author}</span>
          <PfBadge tone={hr ? "green" : "purple"}>{hr ? "HR" : "the person asking"}</PfBadge>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)" }}>{m.at}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.65 }}>{m.body}</div>
      </div>
    </div>
  );
}

/** A clickable row that lifts on hover — used wherever a list navigates somewhere. */
function HoverRow({ onClick, style, children }: { onClick: () => void; style?: CSSProperties; children: ReactNode }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ cursor: "pointer", transition: "background .12s ease", ...style, ...(hovered ? { background: "var(--pf-n25)" } : {}) }}
    >
      {children}
    </div>
  );
}

function KbRow({ a, on, onPick }: { a: KbArticle; on: boolean; onPick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const dr = deflectionRate(a);
  const tone: PfTone = dr >= 85 ? "green" : dr >= 75 ? "blue" : "yellow";
  return (
    <div
      {...hoverProps}
      onClick={onPick}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer",
        borderTop: "1px solid var(--pf-n50)",
        background: on || hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: on ? "inset 3px 0 0 var(--pf-n900)" : "none",
        transition: "background .12s ease",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9 }}>
        <PfTile icon={CATEGORY_ICON[catForArticle(a.id).category]} tone={tone} size={26} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{a.section} · {a.owner} · updated {a.updated}</div>
        </div>
      </div>
      <span style={{ width: 72, flex: "none", textAlign: "right", fontFamily: MONO, fontSize: 12, color: "var(--pf-n600)" }}>{a.views.toLocaleString()}</span>
      <span style={{ width: 96, flex: "none", textAlign: "right", fontSize: 12, color: "var(--pf-n500)" }}>{helpfulRate(a)}% of {a.helpful + a.unhelpful}</span>
      <div style={{ width: 168, flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: TONE[tone].fg }}>{dr}%</span>
          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>{a.deflected} avoided</span>
        </div>
        <PfProgress pct={dr} tone={tone} height={6} />
      </div>
      <span style={{ width: 92, flex: "none", textAlign: "right", fontFamily: MONO, fontSize: 12, color: a.ticketsAfter > 20 ? "var(--pf-red-500)" : "var(--pf-n400)" }}>{a.ticketsAfter}</span>
    </div>
  );
}

/* ================================= screen ================================== */

export default function Helpdesk() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("queue");
  const [tickets, setTickets] = useState<Ticket[]>(TICKETS);
  const [triage, setTriage] = useState<TriageSuggestion[]>(TRIAGE);
  const [sel, setSel] = useState(TICKETS[0].id);
  const [log, setLog] = useState<EngageAccess[]>(SEED_LOG);

  /* queue filters */
  const [stateF, setStateF] = useState<"All" | TicketState>("All");
  const [catF, setCatF] = useState<"All" | TicketCategory>("All");
  const [q, setQ] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);

  /* the desk's own composers */
  const [reply, setReply] = useState("");
  const [assignPick, setAssignPick] = useState(DESKS[0]);

  /* triage override */
  const [ovId, setOvId] = useState<string | null>(null);
  const [ovCat, setOvCat] = useState<TicketCategory>("Other");
  const [ovDesk, setOvDesk] = useState(DESKS[0]);
  const [ovReason, setOvReason] = useState("");

  /* the employee's composer — the deflection moment */
  const [askOpen, setAskOpen] = useState(false);
  const [askSubject, setAskSubject] = useState("");
  const [askBody, setAskBody] = useState("");
  const [askCat, setAskCat] = useState<TicketCategory>("Other");
  const [raised, setRaised] = useState(0);
  const [deflectedNow, setDeflectedNow] = useState(KPI.deflected);
  const [readOpen, setReadOpen] = useState(false);

  /* knowledge base */
  const [kbSort, setKbSort] = useState("Most read");
  const [kbSel, setKbSel] = useState(KB_ARTICLES[0].id);
  const [kbQ, setKbQ] = useState("");
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});

  /* ------------------------------- derived -------------------------------- */

  /** Every desk that can be picked — the seeded ones plus whatever a live suggestion proposes. */
  const deskOptions = useMemo(
    () => Array.from(new Set([...DESKS, ...triage.map((t) => t.suggestedAssignee)])).sort(),
    [triage],
  );

  const cur = tickets.find((t) => t.id === sel) ?? tickets[0];
  const curSla = ticketSla(cur);
  const curPolicy = slaFor(cur.category);

  const live = useMemo(() => {
    const openList = tickets.filter((t) => t.state !== "Resolved" && t.state !== "Closed");
    const breaching = tickets.filter((t) => ticketSla(t).breached);
    const atRisk = openList.filter((t) => !ticketSla(t).breached && ticketSla(t).tone === "yellow");
    const responses = tickets.filter((t) => t.firstResponseHours !== undefined).map((t) => t.firstResponseHours!);
    const sorted = [...responses].sort((a, b) => a - b);
    const rated = tickets.filter((t) => t.satisfaction !== undefined);
    return {
      openList, breaching, atRisk,
      median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
      satisfaction: rated.length ? Math.round((rated.reduce((a, t) => a + (t.satisfaction ?? 0), 0) / rated.length) * 10) / 10 : 0,
      rated: rated.length,
    };
  }, [tickets]);

  const ticketsAfter = KB_ARTICLES.reduce((a, k) => a + k.ticketsAfter, 0) + raised;
  const sessions = deflectedNow + ticketsAfter;
  const defRate = Math.round((deflectedNow / sessions) * 100);
  const totalViews = KB_ARTICLES.reduce((a, k) => a + k.views, 0);
  const worst = [...KB_ARTICLES].sort((a, b) => deflectionRate(a) - deflectionRate(b))[0];
  const best = [...KB_ARTICLES].sort((a, b) => deflectionRate(b) - deflectionRate(a))[0];
  const pending = triage.filter((t) => t.decision === "pending");

  const listed = tickets.filter((t) => {
    if (stateF !== "All" && t.state !== stateF) return false;
    if (catF !== "All" && t.category !== catF) return false;
    if (attentionOnly) {
      const s = ticketSla(t);
      const open = t.state !== "Resolved" && t.state !== "Closed";
      if (!(s.breached || (open && s.tone === "yellow"))) return false;
    }
    if (q.trim()) {
      const hay = `${t.id} ${t.subject} ${t.body} ${t.raisedByName} ${t.category} ${t.assignee ?? ""}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const kbList = useMemo(() => {
    const filtered = KB_ARTICLES.filter((a) =>
      !kbQ.trim() || `${a.title} ${a.section} ${kbBody(a.id)}`.toLowerCase().includes(kbQ.trim().toLowerCase()));
    const s = [...filtered];
    if (kbSort === "Best deflection") s.sort((a, b) => deflectionRate(b) - deflectionRate(a));
    else if (kbSort === "Worst deflection") s.sort((a, b) => deflectionRate(a) - deflectionRate(b));
    else if (kbSort === "Most helpful") s.sort((a, b) => helpfulRate(b) - helpfulRate(a));
    else s.sort((a, b) => b.views - a.views);
    return s;
  }, [kbSort, kbQ]);

  const kbCur = kbArticle(kbSel) ?? KB_ARTICLES[0];

  /* the employee-side match — a literal word match, and the copy never calls it AI */
  const askMatches = useMemo(() => matchArticles(`${askSubject} ${askBody}`), [askSubject, askBody]);
  const askTop = askMatches[0];

  /* -------------------------------- writes -------------------------------- */

  const record = (action: string, scope: string, actor = DESK) =>
    setLog((prev) => [...prev, { at: stampAt(prev.length), who: actor, action, scope }]);

  const patch = (id: string, fn: (t: Ticket) => Ticket) =>
    setTickets((prev) => prev.map((t) => (t.id === id ? fn(t) : t)));

  const openTicket = (id: string) => {
    setSel(id);
    setReply("");
    setOvId(null);
    const t = tickets.find((x) => x.id === id);
    if (t) record("opened ticket", `${t.id} · ${t.category}`);
  };

  const msgStamp = () => stampAt(log.length + 1);

  const sendReply = () => {
    const text = reply.trim();
    if (!text) { toast("Type the reply first — nothing is sent from a template on this desk"); return; }
    patch(cur.id, (t) => ({
      ...t,
      state: t.state === "New" ? "Open" : t.state,
      firstResponseHours: t.firstResponseHours ?? t.elapsedHours,
      thread: [...t.thread, { id: `m${t.thread.length + 1}`, at: msgStamp(), author: who(DESK), role: "HR", body: text }],
    }));
    record("replied to ticket", `${cur.id} · ${cur.category}`);
    setReply("");
    toast(`Reply sent on ${cur.id} — ${first(cur.raisedByName)} sees it in full, including this message`, "success");
  };

  const askEmployee = () => {
    const text = reply.trim();
    if (!text) { toast("Say what you need from them — a status change with no question is not a question"); return; }
    patch(cur.id, (t) => ({
      ...t,
      state: "Waiting on you",
      firstResponseHours: t.firstResponseHours ?? t.elapsedHours,
      thread: [
        ...t.thread,
        { id: `m${t.thread.length + 1}`, at: msgStamp(), author: who(DESK), role: "HR", body: text },
        { id: `m${t.thread.length + 2}`, at: msgStamp(), author: "Helpdesk", role: "System", body: `Waiting on ${t.raisedByName}. The SLA clock is paused — the target measures our responsiveness, not theirs — and this ticket will not be closed automatically.` },
      ],
    }));
    record("moved ticket to waiting on employee", `${cur.id} · clock paused`);
    setReply("");
    toast(`${cur.id} is waiting on ${first(cur.raisedByName)} — the clock is paused, not running against her`, "success");
  };

  const resolveTicket = () => {
    patch(cur.id, (t) => ({
      ...t,
      state: "Resolved",
      resolvedAt: msgStamp(),
      thread: [...t.thread, { id: `m${t.thread.length + 1}`, at: msgStamp(), author: "Helpdesk", role: "System", body: `Marked resolved by ${who(DESK)}. ${t.raisedByName} can reopen it, and closing it is theirs to do.` }],
    }));
    record("marked ticket resolved", `${cur.id} · ${cur.category}`);
    toast(`${cur.id} resolved — resolved is our opinion, closed is ${first(cur.raisedByName)}'s`, "success");
  };

  const assign = (deskName: string) => {
    patch(cur.id, (t) => ({ ...t, assignee: deskName, state: t.state === "New" ? "Open" : t.state }));
    record("assigned ticket", `${cur.id} → ${deskName}`);
    toast(`${cur.id} assigned to ${who(deskName)} by ${who(DESK)} — a person, on the record`, "success");
  };

  const acceptTriage = (s: TriageSuggestion) => {
    setTriage((prev) => prev.map((x) => (x.ticketId === s.ticketId
      ? { ...x, decision: "accepted", decidedBy: DESK, decidedAt: stampAt(log.length) } : x)));
    patch(s.ticketId, (t) => ({ ...t, category: s.suggestedCategory, assignee: s.suggestedAssignee, kbId: s.suggestedKbId, state: t.state === "New" ? "Open" : t.state }));
    record("accepted triage suggestion", `${s.ticketId} → ${s.suggestedCategory} · ${s.suggestedAssignee}`);
    toast(`${s.ticketId} categorised ${s.suggestedCategory} and assigned to ${who(s.suggestedAssignee)} — by ${who(DESK)}, not by MC-08`, "success");
  };

  const startOverride = (s: TriageSuggestion) => {
    setOvId(s.ticketId);
    setOvCat(s.suggestedCategory);
    setOvDesk(s.suggestedAssignee);
    setOvReason("");
  };

  const commitOverride = (s: TriageSuggestion) => {
    if (!ovReason.trim()) { toast("An override needs its reason — the reason is the record, and the next version is calibrated on it"); return; }
    setTriage((prev) => prev.map((x) => (x.ticketId === s.ticketId
      ? { ...x, decision: "overridden", decidedBy: DESK, decidedAt: stampAt(log.length), overrodeTo: ovCat, overrideReason: ovReason.trim() } : x)));
    patch(s.ticketId, (t) => ({ ...t, category: ovCat, assignee: ovDesk, state: t.state === "New" ? "Open" : t.state }));
    record("overrode triage suggestion", `${s.ticketId} → ${ovCat} · reason recorded`);
    setOvId(null);
    toast(`Override recorded on ${s.ticketId} — ${s.suggestedCategory} → ${ovCat}, with your reason attached`, "ai");
  };

  const deflect = () => {
    setDeflectedNow((n) => n + 1);
    record("article answered the question — no ticket raised", `${askTop.article.id} · ${askTop.article.title}`, "Employee · Amara Okonkwo");
    setAskOpen(false); setAskSubject(""); setAskBody(""); setReadOpen(false);
    toast(`Counted as deflection — “${askTop.article.title}” answered it and no ticket exists`, "success");
  };

  const raiseTicket = () => {
    const subject = askSubject.trim();
    if (!subject) { toast("A ticket needs a subject line — it is the only thing triage gets to read first"); return; }
    const id = `HD-${416 + raised}`;
    const suggested = askTop?.article.id;
    const cat = suggested ? catForArticle(suggested) : { category: askCat, n: 0 };
    const fresh: Ticket = {
      id,
      subject,
      body: askBody.trim() || subject,
      category: askCat,
      raisedBy: "E-0214", raisedByName: "Amara Okonkwo", init: "AO", tone: "#AF52DE",
      raisedAt: stampAt(log.length),
      state: "New",
      elapsedHours: 0,
      thread: [{ id: "m1", at: stampAt(log.length), author: "Amara Okonkwo", role: "Employee", body: askBody.trim() || subject }],
      note: "Raised in this session. Unassigned and uncategorised until a person decides — the suggestion below is a proposal.",
    };
    setTickets((prev) => [fresh, ...prev]);
    if (suggested) {
      const hits = askTop.hits;
      setTriage((prev) => [
        {
          ticketId: id,
          suggestedCategory: cat.category,
          suggestedKbId: suggested,
          suggestedAssignee: kbArticle(suggested)?.owner ?? DESKS[0],
          confidence: Math.min(0.95, 0.42 + hits.length * 0.11),
          basis: cat.n > 0
            ? `Subject and body match “${kbArticle(suggested)?.title}” on ${hits.length} word${hits.length === 1 ? "" : "s"} — ${hits.slice(0, 5).map((h) => `“${h}”`).join(", ")}. Category inferred from the ${cat.n} ticket${cat.n === 1 ? "" : "s"} this desk has previously answered from that article, all of which were ${cat.category}.`
            : `Subject and body match “${kbArticle(suggested)?.title}” on ${hits.length} word${hits.length === 1 ? "" : "s"} — ${hits.slice(0, 5).map((h) => `“${h}”`).join(", ")}. No ticket has ever been answered from that article, so there is nothing to infer a category from: it goes to Other and a person picks.`,
          decision: "pending",
        },
        ...prev,
      ]);
    }
    setRaised((n) => n + 1);
    record("raised ticket", `${id} · read ${askTop ? askTop.article.title : "no article"} first`, "Employee · Amara Okonkwo");
    setSel(id); setAskOpen(false); setAskSubject(""); setAskBody(""); setReadOpen(false); setTab("queue");
    toast(`${id} raised — and counted against the article she read first. That is what makes deflection honest.`, "success");
  };

  const vote = (id: string, v: "up" | "down") => {
    setVotes((prev) => ({ ...prev, [id]: v }));
    toast(v === "up"
      ? `Marked helpful — “${kbArticle(id)?.title}” · that vote moves the helpful rate, not the deflection rate`
      : `Marked unhelpful — “${kbArticle(id)?.title}” · routed to ${kbArticle(id)?.owner} to rewrite, not to the desk to answer`,
      v === "up" ? "success" : "default");
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>HR service desk</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Where an employee asks a question and a named person answers it (FR-095). The queue is what arrived; the knowledge base is what stopped arriving. Read as of {ENGAGE_TODAY}.
          </div>
        </div>
        <PfBtn variant="secondary" icon="book" onClick={() => setTab("kb")}>Knowledge base</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { setAskOpen((v) => !v); setTab("queue"); }}>Raise a ticket</PfBtn>
      </div>

      {/* ============================ THE FIREWALL ============================ */}
      <div style={{ background: "var(--pf-n900)", borderRadius: 12, padding: "15px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
          <Ic name="shield" size={16} color="#fff" />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{HELPDESK_FIREWALL.headline}</span>
          <PfBadge tone="red" dot>FR-088 firewall</PfBadge>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => go("cases")}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#fff", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 7, padding: "5px 10px", cursor: "pointer" }}
          >
            <Ic name="clipboard" size={13} color="#fff" />
            /cases — the separate thing this is not
            <Ic name="arrowright" size={13} color="#fff" />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          {[
            { icon: "chat", head: "A ticket", body: HELPDESK_FIREWALL.ticket, tone: "green" as PfTone },
            { icon: "clipboard", head: "A disciplinary case", body: HELPDESK_FIREWALL.disciplinary, tone: "red" as PfTone },
            { icon: "x", head: "No path between them", body: HELPDESK_FIREWALL.rule, tone: "yellow" as PfTone },
          ].map((c) => (
            <div key={c.head}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <Ic name={c.icon} size={14} color={TONE[c.tone].bg} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#fff" }}>{c.head}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n300)", lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 13, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.12)" }}>
          <Ic name="robot" size={14} color="var(--pf-purple-500)" />
          <div style={{ fontSize: 11.5, color: "var(--pf-n300)", lineHeight: 1.6 }}>
            <b style={{ color: "#fff" }}>Ticket content is not an input to any model that scores a person.</b>{" "}
            No attrition model, no performance model, no risk tier and no case file reads a word of what is asked here. The one model that reads a ticket at all is {MC08.id} — it sees the subject line and the body, proposes a category, and a human assigns.{" "}
            <b style={{ color: "#fff" }}>{HELPDESK_FIREWALL.why}</b>{" "}
            Somebody on this list may also be the subject of a disciplinary case. This page cannot tell you whether, or who — and that file cannot tell you they ever asked a question here.
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 4 }}>
        <PfStat
          icon="book" tone="green" label="Deflected" value={deflectedNow} unit="tickets never raised"
          delta={`${defRate}% of readers`} deltaTone="green"
        />
        <PfStat
          icon="chat" tone="blue" label="On the desk" value={live.openList.length} unit={`open of ${tickets.length}`}
          delta={live.breaching.length ? `${live.breaching.length} breaching` : `${live.atRisk.length} at risk · 0 breached`}
          deltaTone={live.breaching.length ? "red" : live.atRisk.length ? "yellow" : "green"}
        />
        <PfStat
          icon="clock" tone="yellow" label="Median first response" value={live.median} unit="working hours"
          delta="target 2–8h by category" deltaTone="grey"
        />
        <PfStat
          icon="star" tone="purple" label="Satisfaction" value={live.satisfaction} unit="of 5"
          delta={`${live.rated} rated, asked once`} deltaTone="grey"
        />
      </div>

      {/* lead insight — arithmetic, not a model, and it says so */}
      <div style={{ marginTop: 12, border: "1px solid var(--pf-primary-100)", background: "var(--pf-primary-50)", borderRadius: 12, padding: "14px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <PfTile icon="trend" tone="green" size={30} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-primary-600)", lineHeight: 1.55 }}>
              {tickets.length} tickets is not the workload. {deflectedNow} is — and those are the ones that never arrived.
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 6 }}>
              {totalViews.toLocaleString()} article reads produced {sessions} question-shaped sessions; {defRate}% of them ended without a ticket.
              The leak is <b style={{ color: "var(--pf-n900)" }}>{worst.title}</b> at {deflectionRate(worst)}% — the worst deflection and the worst helpful rate ({helpfulRate(worst)}%) in the base, and the article the most people read and then asked anyway ({worst.ticketsAfter} of them).
              Both tickets answered from it were about something it does not say: one asked why a claim was silently held, one asked for a rate table that is not in it.
              Rewriting that one article is worth more than any staffing change on this page. <b style={{ color: "var(--pf-n900)" }}>{best.title}</b> is the counter-proof at {deflectionRate(best)}%.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <PfBtn small variant="secondary" icon="book" onClick={() => { setTab("kb"); setKbSel(worst.id); setKbSort("Worst deflection"); }}>
                Open {worst.title}
              </PfBtn>
              <PfBtn small variant="ghost" icon="graph" onClick={() => setTab("sla")}>How deflection is counted</PfBtn>
              <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                Division, not inference — no model produced this paragraph, and the arithmetic is on the SLA tab.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "queue", label: "Ticket queue", count: String(live.openList.length) },
            { key: "kb", label: "Knowledge base", count: String(KB_ARTICLES.length) },
            { key: "sla", label: "SLA & deflection", badge: pending.length ? `${pending.length} TO TRIAGE` : undefined },
          ]}
        />
      </div>

      {/* ================================ QUEUE =============================== */}
      {tab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* the employee's composer — where a ticket gets stopped before it starts */}
          {askOpen && (
            <PfCard>
              <PfCardHead
                title="Raise a ticket"
                sub="This is the employee's side, shown on the desk so you can see what they see. Amara Okonkwo · E-0214 · Engineering, Lagos."
              >
                <PfBtn small variant="ghost" icon="x" onClick={() => { setAskOpen(false); setReadOpen(false); }}>Cancel</PfBtn>
              </PfCardHead>
              <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>What do you need?</div>
                  <input
                    value={askSubject}
                    onChange={(e) => setAskSubject(e.target.value)}
                    placeholder="e.g. can I carry unused leave days past March"
                    style={fieldStyle}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Anything else we should know</div>
                    <textarea value={askBody} onChange={(e) => setAskBody(e.target.value)} rows={3} placeholder="Optional. The desk reads this; nothing else does." style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Category, if you know it</div>
                    <select value={askCat} onChange={(e) => setAskCat(e.target.value as TicketCategory)} style={fieldStyle}>
                      {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.55 }}>
                      Leave it on Other if you are not sure. Guessing wrong costs you nothing — a person re-categorises before anyone works on it.
                    </div>
                  </div>
                </div>

                {/* the deflection prompt */}
                {askTop ? (
                  <AiBlock
                    label="This may already be answered"
                    chip={`${askTop.hits.length} word match`}
                    why={
                      <WhyThisPanel
                        why={{
                          claim: `Suggested article: ${askTop.article.title} — matched on ${askTop.hits.map((h) => `“${h}”`).join(", ")}.`,
                          basis: [
                            "This is a literal word match against the eight handbook articles — their titles, sections and body text. It is not a model and MC-08 is not involved: nothing was inferred, ranked or predicted.",
                            `Ordering is by number of matched words, then by reads. ${askMatches.length} article${askMatches.length === 1 ? "" : "s"} matched at all.`,
                            "The handbook is the single source of the text. This page never holds a second copy of a policy.",
                          ],
                          modelCard: MC08.id,
                          humanGate: "You decide whether it answered you. Nothing closes, and no ticket is suppressed, unless you say so.",
                        }}
                        notInputs={[
                          "Who you are, your department, your grade or your tenure",
                          "Anything you have asked before, or any ticket you have ever raised",
                          "Nationality and host community — NCDMB reporting fields, never inputs",
                        ]}
                      />
                    }
                  >
                    <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Ic name={CATEGORY_ICON[catForArticle(askTop.article.id).category]} size={14} color="var(--pf-n900)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{askTop.article.title}</span>
                        <PfBadge tone="grey">{askTop.article.section}</PfBadge>
                        <PfBadge tone="green">{deflectionRate(askTop.article)}% deflection</PfBadge>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{askTop.article.owner} · updated {askTop.article.updated}</span>
                      </div>
                      {readOpen && (
                        <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.75, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                          {kbBody(askTop.article.id)}
                        </div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                        <PfBtn small variant="secondary" icon={readOpen ? "caretdown" : "caretright"} onClick={() => setReadOpen((v) => !v)}>
                          {readOpen ? "Hide the article" : "Read it first"}
                        </PfBtn>
                        <PfBtn small variant="primary" icon="check" onClick={deflect}>That answers it — do not raise</PfBtn>
                        <PfBtn small variant="secondary" icon="paperplane" onClick={raiseTicket}>Raise it anyway</PfBtn>
                      </div>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-purple-500)", lineHeight: 1.6, marginTop: 10 }}>
                      Both buttons are counted. &ldquo;That answers it&rdquo; adds one to deflection; &ldquo;raise it anyway&rdquo; adds one to the tickets-after column of this exact article — which is how {worst.title.toLowerCase()} got the worst score in the base instead of hiding inside an average.
                    </div>
                  </AiBlock>
                ) : (
                  <div style={{ background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <Ic name="search" size={15} color="var(--pf-n300)" />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
                      {askSubject.trim() || askBody.trim()
                        ? "No article contains any of those words. That is a gap in the handbook, not a failure of the search — raise it, and the answer becomes an article."
                        : "Start typing and we will check the handbook before the desk ever sees this."}
                    </span>
                    <span style={{ flex: 1 }} />
                    <PfBtn small variant="primary" icon="paperplane" onClick={raiseTicket}>Raise the ticket</PfBtn>
                  </div>
                )}
              </div>
              <Foot icon="shield">
                Nothing typed here is read by anything except the desk and {MC08.id}, which sees the subject and body only. It is not a note on your record, it is not visible to your manager, and it does not begin any other process.
              </Foot>
            </PfCard>
          )}

          {/* triage lane */}
          <PfCard>
            <PfCardHead
              title="Awaiting triage"
              sub={`${pending.length} suggestion${pending.length === 1 ? "" : "s"} on the desk. ${MC08.id} proposes a category, an article and an assignee — a person assigns.`}
            >
              <PfBadge tone="purple" dot>AI proposes · human decides</PfBadge>
              <PfBtn small variant="ghost" icon="robot" onClick={() => go("aisurfaces")}>{AS13.id} in the surface audit</PfBtn>
            </PfCardHead>

            {pending.length === 0 && (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--pf-n400)" }}>Nothing waiting on a human decision.</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 5 }}>Every suggestion on this desk has been accepted or overridden by a named person. That is the only state this lane can empty into.</div>
              </div>
            )}

            {pending.map((s) => {
              const t = tickets.find((x) => x.id === s.ticketId);
              if (!t) return null;
              const art = kbArticle(s.suggestedKbId);
              const overriding = ovId === s.ticketId;
              return (
                <div key={s.ticketId} style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 11 }}>
                    <PfAvatar init={t.init} tone={t.tone} size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.subject}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{t.id} · {t.raisedByName} · raised {t.raisedAt}</div>
                    </div>
                    <span style={{ flex: 1 }} />
                    <PfBadge tone={ticketSla(t).tone} dot>{ticketSla(t).label}</PfBadge>
                    <PfBtn small variant="ghost" icon="arrowright" onClick={() => openTicket(t.id)}>Open the ticket</PfBtn>
                  </div>

                  <AiBlock
                    label={`Triage proposal · ${MC08.id}`}
                    chip="not applied"
                    why={<WhyThisPanel
                      why={triageWhy(s)}
                      notInputs={[
                        "Who raised it, their department, worker type, grade or tenure",
                        "Performance, engagement, attendance or leave-risk signals",
                        "Any disciplinary case, open or closed — this model cannot see that table",
                        "Nationality and host community — NCDMB reporting fields, never model inputs",
                      ]}
                    />}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
                      {[
                        { k: "Category", v: s.suggestedCategory, icon: CATEGORY_ICON[s.suggestedCategory] },
                        { k: "Article to answer from", v: art?.title ?? s.suggestedKbId, icon: "book" },
                        { k: "Assignee", v: s.suggestedAssignee, icon: "user" },
                      ].map((f) => (
                        <div key={f.k} style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 9, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginBottom: 5 }}>{f.k}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <Ic name={f.icon} size={14} color="var(--pf-purple-500)" />
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{f.v}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 11, flexWrap: "wrap" }}>
                      <PfSegments score={s.confidence * 5} tone={s.confidence >= 0.8 ? "green" : s.confidence >= 0.6 ? "yellow" : "red"} />
                      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{Math.round(s.confidence * 100)}%</span>
                      <span style={{ flex: 1 }} />
                      <PfBtn small variant="primary" icon="check" onClick={() => acceptTriage(s)}>Accept and assign</PfBtn>
                      <PfBtn small variant="secondary" icon="swap" onClick={() => startOverride(s)}>Assign differently</PfBtn>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-purple-500)", marginTop: 9, lineHeight: 1.6 }}>
                      Until one of those two buttons is pressed, {t.id} is uncategorised and unassigned in every count on this page. The proposal has changed nothing.
                    </div>
                  </AiBlock>

                  {overriding && (
                    <div style={{ marginTop: 11, border: "1px solid var(--pf-n100)", borderLeft: "3px solid var(--pf-n900)", borderRadius: 11, padding: "13px 15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                        <Ic name="user" size={15} color="var(--pf-n900)" />
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>Your call, and your reason</span>
                        <PfBadge tone="grey">human-authored</PfBadge>
                        <span style={{ flex: 1 }} />
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{DESK}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Category</div>
                          <select value={ovCat} onChange={(e) => setOvCat(e.target.value as TicketCategory)} style={fieldStyle}>
                            {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Assign to</div>
                          <select value={ovDesk} onChange={(e) => setOvDesk(e.target.value)} style={fieldStyle}>
                            {deskOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ marginTop: 11 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Why the suggestion was wrong — required</div>
                        <textarea
                          value={ovReason}
                          onChange={(e) => setOvReason(e.target.value)}
                          rows={2}
                          placeholder="e.g. it reads like a pay question and is not one — she is asking what the rate is, which is a policy answer"
                          style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.55 }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                        <PfBtn small variant="primary" icon="check" onClick={() => commitOverride(s)}>Record the override</PfBtn>
                        <PfBtn small variant="ghost" icon="x" onClick={() => setOvId(null)}>Cancel</PfBtn>
                        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{ACC.note}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <Foot icon="robot">
              {MC08.humanGate} The suggestion is kept whether it was right or wrong — <b style={{ color: "var(--pf-n600)" }}>an erased wrong answer cannot be learned from</b>, and the override reasons on the SLA tab are the whole calibration record.
            </Foot>
          </PfCard>

          {/* filters */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", flexWrap: "wrap" }}>
              <PfTabs
                tabs={["All", ...TICKET_STATES]}
                active={stateF}
                onChange={(t) => setStateF(t as "All" | TicketState)}
              />
              <span style={{ flex: 1 }} />
              <div style={{ position: "relative", width: 230 }}>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search subject, id, person…"
                  style={{ ...fieldStyle, paddingLeft: 30 }}
                />
                <span style={{ position: "absolute", left: 9, top: 9, pointerEvents: "none" }}>
                  <Ic name="search" size={14} color="var(--pf-n300)" />
                </span>
              </div>
              <select value={catF} onChange={(e) => setCatF(e.target.value as "All" | TicketCategory)} style={{ ...fieldStyle, width: 170 }}>
                <option value="All">All categories</option>
                {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <PfBtn
                small
                variant={attentionOnly ? "primary" : "secondary"}
                icon="warning"
                onClick={() => setAttentionOnly((v) => !v)}
              >
                Needs attention
              </PfBtn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
              <PfTh style={{ width: 34 }} />
              <PfTh style={{ flex: 1 }}>Ticket</PfTh>
              <PfTh style={{ width: 128 }}>Category</PfTh>
              <PfTh style={{ width: 62, textAlign: "right" }}>Age</PfTh>
              <PfTh style={{ width: 186, textAlign: "right" }}>SLA clock</PfTh>
              <PfTh style={{ width: 110, textAlign: "right" }}>State</PfTh>
              <span style={{ width: 14 }} />
            </div>
            {listed.map((t) => (
              <TicketRow key={t.id} t={t} on={t.id === cur.id} onPick={() => openTicket(t.id)} />
            ))}
            {listed.length === 0 && (
              <div style={{ padding: "30px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 13, color: "var(--pf-n400)" }}>
                  {attentionOnly && live.breaching.length === 0 && live.atRisk.length === 0
                    ? "Nothing is breaching and nothing is close. Rare, and worth saying out loud rather than showing an empty box."
                    : "No ticket matches those filters."}
                </div>
                <div style={{ marginTop: 10, display: "inline-flex", gap: 8 }}>
                  <PfBtn small variant="secondary" icon="x" onClick={() => { setStateF("All"); setCatF("All"); setQ(""); setAttentionOnly(false); }}>Clear filters</PfBtn>
                </div>
              </div>
            )}
            <Foot icon="clock">
              Age is working hours, not wall-clock — a ticket raised at 17:00 on Friday is not breached by Monday morning.
              &ldquo;Waiting on you&rdquo; pauses the clock entirely: the target measures <b style={{ color: "var(--pf-n600)" }}>our</b> responsiveness, and a desk that penalised the asker for taking a day to reply would be measuring the wrong party.
            </Foot>
          </PfCard>

          {/* the ticket */}
          <PfCard>
            <PfCardHead
              title={`${cur.id} — ${cur.subject}`}
              sub={`${cur.raisedByName} · raised ${cur.raisedAt} · ${cur.assignee ? `${who(cur.assignee)}, ${team(cur.assignee)}` : "unassigned"} · target ${curPolicy.firstResponseHours}h first response, ${curPolicy.resolutionHours}h resolution`}
            >
              <PfBadge tone={stateTone(cur.state)}>{cur.state}</PfBadge>
              <PfBadge tone={curSla.tone} dot>{curSla.label}</PfBadge>
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <PfAvatar init={cur.init} tone={cur.tone} size={34} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{cur.raisedByName}</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{cur.raisedBy} · the person asking</div>
              </div>
              <span style={{ width: 1, height: 26, background: "var(--pf-n50)", margin: "0 4px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Ic name={CATEGORY_ICON[cur.category]} size={15} color="var(--pf-n500)" />
                <span style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{cur.category}</span>
              </div>
              {cur.satisfaction !== undefined && (
                <>
                  <span style={{ width: 1, height: 26, background: "var(--pf-n50)", margin: "0 4px" }} />
                  <Stars n={cur.satisfaction} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>rated once, on resolution — never chased</span>
                </>
              )}
              <span style={{ flex: 1 }} />
              {!cur.assignee && (
                <>
                  <select value={assignPick} onChange={(e) => setAssignPick(e.target.value)} style={{ ...fieldStyle, width: 220 }}>
                    {deskOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <PfBtn small variant="secondary" icon="user" onClick={() => assign(assignPick)}>Assign</PfBtn>
                </>
              )}
              <PfBtn small variant="ghost" icon="book" onClick={() => { setTab("kb"); setKbSel(cur.kbId ?? KB_ARTICLES[0].id); }}>
                {cur.kbId ? `Answered from ${kbArticle(cur.kbId)?.title}` : "Find an article"}
              </PfBtn>
            </div>

            {/* the clock, spelled out */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--pf-n50)" }}>
              {[
                { k: "Raised", v: cur.raisedAt, tone: "grey" as PfTone, icon: "chat" },
                { k: "First response", v: cur.firstResponseHours !== undefined ? `${cur.firstResponseHours}h · target ${curPolicy.firstResponseHours}h` : `not yet · target ${curPolicy.firstResponseHours}h`, tone: (cur.firstResponseHours !== undefined ? (cur.firstResponseHours <= curPolicy.firstResponseHours ? "green" : "red") : "yellow") as PfTone, icon: "clock" },
                { k: "Resolution", v: cur.resolvedAt ? `${cur.resolvedAt} · ${cur.elapsedHours}h` : `open · target ${curPolicy.resolutionHours}h`, tone: (cur.resolvedAt ? "green" : "blue") as PfTone, icon: "check" },
                { k: "State", v: cur.state, tone: stateTone(cur.state), icon: "pulse" },
              ].map((c, i) => (
                <div key={c.k} style={{ flex: 1, padding: "12px 16px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <PfTile icon={c.icon} tone={c.tone} size={24} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c.v}</div>
                </div>
              ))}
            </div>

            {/* thread */}
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
              {cur.thread.map((m) => <Msg key={m.id} m={m} />)}
            </div>

            {/* the desk's reply */}
            {cur.state !== "Closed" && (
              <div style={{ padding: "0 20px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>Reply as {who(DESK)}</div>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  placeholder={cur.category === "Pay & payslips"
                    ? "Answer from the record where you can. Anything that changes a payment goes through the connected payroll source, and say so in the reply."
                    : "Plain answer, in your own words. Attach the article if there is one."}
                  style={{ ...fieldStyle, resize: "vertical", lineHeight: 1.6 }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <PfBtn small variant="primary" icon="paperplane" onClick={sendReply}>Send reply</PfBtn>
                  <PfBtn small variant="secondary" icon="question" onClick={askEmployee}>Send &amp; wait on them</PfBtn>
                  {cur.state !== "Resolved" && <PfBtn small variant="secondary" icon="check" onClick={resolveTicket}>Mark resolved</PfBtn>}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                    {first(cur.raisedByName)} sees this thread in full — there is no internal note field on this desk.
                  </span>
                </div>
              </div>
            )}

            {cur.state === "Closed" && (
              <div style={{ margin: "0 20px 16px", background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "14px 16px", fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                Closed by {cur.thread[cur.thread.length - 1]?.role === "Employee" ? cur.raisedByName : who(cur.assignee)} on {cur.resolvedAt}. A resolved ticket is the desk&rsquo;s opinion that it is done; a closed one is the asker&rsquo;s. Reopening is theirs to do and does not need a reason.
              </div>
            )}

            {/* the ticket's own note — never the E1 developer note, which names a case */}
            {cur.note && cur.id !== "HD-409" && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-primary-50)" }}>
                <Ic name="info" size={15} color="var(--pf-primary-500)" />
                <div style={{ fontSize: 12.5, color: "var(--pf-primary-600)", fontWeight: 500, lineHeight: 1.6 }}>{cur.note}</div>
              </div>
            )}

            <Foot icon="shield">
              Opening this ticket wrote an entry to the desk access log — including the one this session just wrote for {cur.id}. {log.length} entries this cycle, listed on the SLA tab.
              Nothing here escalates: there is no convert-to-case control on this page because there is no code path behind one.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ============================ KNOWLEDGE BASE =========================== */}
      {tab === "kb" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="book" cta="handbook" onCta={() => go("onboardhub")}>
            <span style={{ fontWeight: 600 }}>Eight articles, and not one of them is a copy. </span>
            <span style={{ fontWeight: 400 }}>
              The knowledge base is a wrapper around the company handbook — same text, same owner, same updated date. Change a policy once and every article here is already correct, because there is no second copy to forget.
            </span>
          </PfBanner>

          <PfCard>
            <PfCardHead
              title="Deflection by article"
              sub={`${deflectedNow} reads that ended the question · ${ticketsAfter} that did not · ${totalViews.toLocaleString()} article views in total`}
            >
              <PfTabs tabs={["Most read", "Best deflection", "Worst deflection", "Most helpful"]} active={kbSort} onChange={setKbSort} />
            </PfCardHead>
            <div style={{ position: "relative", padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <input value={kbQ} onChange={(e) => setKbQ(e.target.value)} placeholder="Search the handbook text…" style={{ ...fieldStyle, paddingLeft: 30 }} />
              <span style={{ position: "absolute", left: 29, top: 21, pointerEvents: "none" }}>
                <Ic name="search" size={14} color="var(--pf-n300)" />
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", background: "var(--pf-n25)" }}>
              <PfTh style={{ flex: 1 }}>Article</PfTh>
              <PfTh style={{ width: 72, textAlign: "right" }}>Views</PfTh>
              <PfTh style={{ width: 96, textAlign: "right" }}>Helpful</PfTh>
              <PfTh style={{ width: 168 }}>Deflection</PfTh>
              <PfTh style={{ width: 92, textAlign: "right" }}>Asked anyway</PfTh>
            </div>
            {kbList.map((a) => (
              <KbRow key={a.id} a={a} on={a.id === kbSel} onPick={() => setKbSel(a.id)} />
            ))}
            {kbList.length === 0 && (
              <div style={{ padding: "30px 20px", textAlign: "center", borderTop: "1px solid var(--pf-n50)" }}>
                <div style={{ fontSize: 13, color: "var(--pf-n400)" }}>No article contains &ldquo;{kbQ}&rdquo;.</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 5 }}>Eight articles is the whole handbook. A miss here is a gap in the policy corpus, not a search problem — and it is the strongest possible signal about what to write next.</div>
                <div style={{ marginTop: 10 }}><PfBtn small variant="secondary" icon="x" onClick={() => setKbQ("")}>Clear search</PfBtn></div>
              </div>
            )}
            <Foot icon="graph">
              Deflection = reads that ended the question ÷ (those + reads followed by a ticket within the hour). It counts <b style={{ color: "var(--pf-n600)" }}>tickets avoided, not tickets closed</b> — a desk measured only on closures is rewarded for being needed.
            </Foot>
          </PfCard>

          {/* the article */}
          <PfCard>
            <PfCardHead
              title={kbCur.title}
              sub={`${kbCur.section} · owned by ${kbCur.owner} · updated ${kbCur.updated} · handbook id ${kbCur.handbookId}`}
            >
              <PfBadge tone={deflectionRate(kbCur) >= 85 ? "green" : deflectionRate(kbCur) >= 75 ? "blue" : "yellow"}>{deflectionRate(kbCur)}% deflection</PfBadge>
              <PfBadge tone="grey">{kbCur.views.toLocaleString()} reads</PfBadge>
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "15px 17px", fontSize: 13.5, color: "var(--pf-n900)", lineHeight: 1.85 }}>
                {kbBody(kbCur.id)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Did this answer your question?</span>
                <PfBtn small variant={votes[kbCur.id] === "up" ? "primary" : "secondary"} icon="check" onClick={() => vote(kbCur.id, "up")}>Yes</PfBtn>
                <PfBtn small variant={votes[kbCur.id] === "down" ? "danger" : "secondary"} icon="x" onClick={() => vote(kbCur.id, "down")}>No</PfBtn>
                <span style={{ flex: 1 }} />
                <PfBtn small variant="ghost" icon="plus" onClick={() => { setAskOpen(true); setTab("queue"); setAskSubject(kbCur.title); }}>Still need to ask</PfBtn>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", borderTop: "1px solid var(--pf-n50)" }}>
              {[
                { k: "Reads", v: kbCur.views.toLocaleString(), s: `${Math.round((kbCur.views / totalViews) * 100)}% of all handbook traffic`, tone: "blue" as PfTone, icon: "book" },
                { k: "Ended the question", v: String(kbCur.deflected), s: "no ticket in the hour that followed", tone: "green" as PfTone, icon: "check" },
                { k: "Asked anyway", v: String(kbCur.ticketsAfter), s: "read it, then raised a ticket", tone: "yellow" as PfTone, icon: "chat" },
                { k: "Marked helpful", v: `${helpfulRate(kbCur)}%`, s: `${kbCur.helpful} up · ${kbCur.unhelpful} down`, tone: "purple" as PfTone, icon: "star" },
              ].map((c, i) => (
                <div key={c.k} style={{ padding: "13px 16px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                    <PfTile icon={c.icon} tone={c.tone} size={24} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.k}</span>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>{c.v}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.5 }}>{c.s}</div>
                </div>
              ))}
            </div>

            {/* who read it and asked anyway */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 9 }}>
                Tickets answered from this article
              </div>
              {kbCur.relatedTickets.length === 0 ? (
                <div style={{ background: "var(--pf-n25)", borderRadius: 9, padding: "14px 16px", fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.6 }}>
                  None. {kbCur.ticketsAfter} people read this and raised a ticket the desk answered from somewhere else — which is either the best article in the base or the one nobody can find. {deflectionRate(kbCur)}% deflection says it is the first.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {kbCur.relatedTickets.map((tid) => {
                    const t = tickets.find((x) => x.id === tid);
                    if (!t) return null;
                    return (
                      <HoverRow
                        key={tid}
                        onClick={() => { setTab("queue"); openTicket(tid); }}
                        style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px" }}
                      >
                        <PfAvatar init={t.init} tone={t.tone} size={26} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.subject}</div>
                          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{t.id} · {t.raisedByName} · {t.category}</div>
                        </div>
                        <PfBadge tone={stateTone(t.state)}>{t.state}</PfBadge>
                        <Ic name="caretright" size={13} color="var(--pf-n300)" />
                      </HoverRow>
                    );
                  })}
                </div>
              )}
            </div>

            <Foot icon="info">
              The body above is read from the handbook at render time — this page holds no copy of it. If {kbCur.owner} edits the policy, this article changed with it, and the {kbCur.views.toLocaleString()} reads counted here were reads of whatever it said at the time.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ========================= SLA & DEFLECTION ========================== */}
      {tab === "sla" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* the ledger */}
          <PfCard>
            <PfCardHead
              title="The deflection ledger"
              sub="The headline KPI, with its arithmetic on the table. No model produced any number in this card."
            >
              <PfBadge tone="green" dot>{defRate}% deflected</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {[
                { k: "Questions that ended at the article", v: deflectedNow, tone: "green" as PfTone, icon: "check", s: "A read with no ticket in the hour that followed. These are the tickets on this page that do not exist." },
                { k: "Questions that became a ticket", v: ticketsAfter, tone: "yellow" as PfTone, icon: "chat", s: "Read the article, asked anyway. The denominator, and the only honest one — counting deflection without it would be a marketing number." },
                { k: "Question-shaped sessions", v: sessions, tone: "blue" as PfTone, icon: "graph", s: `${deflectedNow} ÷ ${sessions} = ${defRate}%. That is the whole formula, and it is division.` },
              ].map((c, i) => (
                <div key={c.k} style={{ padding: "16px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                    <PfTile icon={c.icon} tone={c.tone} size={26} />
                    <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{c.k}</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: TONE[c.tone].fg, letterSpacing: "-.5px" }}>{c.v}</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 7, lineHeight: 1.6 }}>{c.s}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-primary-50)" }}>
              <Ic name="megaphone" size={15} color="var(--pf-primary-500)" />
              <div style={{ fontSize: 12.5, color: "var(--pf-primary-600)", fontWeight: 500, lineHeight: 1.65 }}>
                {KPI.kpiNote}
                {deflectedNow > KPI.deflected && (
                  <> Plus {deflectedNow - KPI.deflected} counted in this session, which is why the figure above reads {deflectedNow} and this sentence still says {KPI.deflected}.</>
                )}
              </div>
            </div>
            <Foot icon="warning">
              <b style={{ color: "var(--pf-n600)" }}>What this number is not.</b> It is not proof the handbook is good — a deflection rate can also rise because people gave up, or because raising a ticket feels risky.
              That second failure mode is exactly what the firewall at the top of this page exists to prevent, and it is why the rate is published next to satisfaction ({live.satisfaction} of 5) rather than on its own.
            </Foot>
          </PfCard>

          {/* SLA book */}
          <PfCard>
            <PfCardHead
              title="The SLA book"
              sub="Targets in working hours, per category, with the reason each one is set where it is. Click a row to filter the queue."
            >
              <PfBadge tone={live.breaching.length ? "red" : "green"} dot>
                {live.breaching.length ? `${live.breaching.length} breaching` : "nothing breaching"}
              </PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", background: "var(--pf-n25)" }}>
              <PfTh style={{ width: 150 }}>Category</PfTh>
              <PfTh style={{ width: 96, textAlign: "right" }}>1st response</PfTh>
              <PfTh style={{ width: 90, textAlign: "right" }}>Resolution</PfTh>
              <PfTh style={{ flex: 1 }}>Why the target sits there</PfTh>
              <PfTh style={{ width: 110, textAlign: "right" }}>On the desk</PfTh>
            </div>
            {SLA_POLICY.map((p) => {
              const row = byCategory().find((c) => c.category === p.category);
              return (
                <HoverRow
                  key={p.category}
                  onClick={() => { setCatF(p.category); setStateF("All"); setAttentionOnly(false); setTab("queue"); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}
                >
                  <div style={{ width: 150, flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
                    <Ic name={CATEGORY_ICON[p.category]} size={14} color="var(--pf-n500)" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{p.category}</span>
                  </div>
                  <span style={{ width: 96, flex: "none", textAlign: "right", fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: p.firstResponseHours <= 2 ? "var(--pf-red-500)" : "var(--pf-n900)" }}>{p.firstResponseHours}h</span>
                  <span style={{ width: 90, flex: "none", textAlign: "right", fontFamily: MONO, fontSize: 12.5, color: "var(--pf-n600)" }}>{p.resolutionHours}h</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>{p.rationale}</span>
                  <div style={{ width: 110, flex: "none", display: "flex", justifyContent: "flex-end" }}>
                    {row ? <PfBadge tone={row.open ? "blue" : "grey"}>{row.open} open of {row.n}</PfBadge> : <PfBadge tone="grey">none</PfBadge>}
                  </div>
                </HoverRow>
              );
            })}
            <Foot icon="wallet">
              Pay tickets are answered from the record wherever possible. Where an answer would change what someone is actually paid, it leaves through the connected payroll source
              (<span style={{ fontFamily: MONO }}>payroll_connector v1 · {PAYROLL?.provider ?? "the live adapter"}</span>) — this desk never edits a payment, and the reply says which of the two happened.
            </Foot>
          </PfCard>

          {/* attention board */}
          <PfCard>
            <PfCardHead
              title="Breaching and close to it"
              sub="The only two lists on this page that are allowed to interrupt someone."
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              {[
                { head: "Breaching", list: live.breaching, tone: "red" as PfTone, empty: "Nothing has breached today. Worth saying plainly rather than leaving an empty red box implying you missed something." },
                { head: "Inside an hour of breaching", list: live.atRisk, tone: "yellow" as PfTone, empty: "Nothing is close." },
              ].map((b, i) => (
                <div key={b.head} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
                    <PfTile icon={b.tone === "red" ? "warning" : "clock"} tone={b.tone} size={26} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{b.head}</span>
                    <PfBadge tone={b.list.length ? b.tone : "grey"}>{b.list.length}</PfBadge>
                  </div>
                  {b.list.length === 0 ? (
                    <div style={{ background: "var(--pf-n25)", borderRadius: 9, padding: "13px 15px", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.6 }}>{b.empty}</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {b.list.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => { setTab("queue"); openTicket(t.id); }}
                          style={{ display: "flex", alignItems: "center", gap: 9, border: `1px solid ${TONE[b.tone].line}`, background: TONE[b.tone].soft, borderRadius: 9, padding: "10px 12px", cursor: "pointer" }}
                        >
                          <PfAvatar init={t.init} tone={t.tone} size={26} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
                            <div style={{ fontSize: 11, color: "var(--pf-n500)", marginTop: 2 }}>{t.id} · {ticketSla(t).label} · {t.assignee ? who(t.assignee) : "unassigned"}</div>
                          </div>
                          <Ic name="caretright" size={13} color="var(--pf-n400)" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Foot icon="clock">
              A paused ticket never appears in either list. {tickets.filter((t) => t.state === "Waiting on you").length} ticket{tickets.filter((t) => t.state === "Waiting on you").length === 1 ? " is" : "s are"} waiting on the person who asked, and no clock is running against them.
            </Foot>
          </PfCard>

          {/* triage record */}
          <PfCard>
            <PfCardHead
              title="Triage decisions"
              sub={`${ACC.decided} decided in this cycle · ${ACC.accepted} accepted, ${ACC.overridden} overridden. The overrides are the valuable half.`}
            >
              <PfBadge tone="purple" dot>{MC08.id} · {MC08.name}</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Accepted as proposed</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", marginTop: 3 }}>{ACC.pct}%</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <PfProgress pct={ACC.pct} tone="purple" height={8} />
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.55 }}>{ACC.note}</div>
              </div>
              <PfBtn small variant="secondary" icon="robot" onClick={() => go("aisurfaces")}>{AS13.id} · covered</PfBtn>
            </div>
            {triage.map((s) => {
              const t = tickets.find((x) => x.id === s.ticketId);
              const art = kbArticle(s.suggestedKbId);
              return (
                <div key={s.ticketId} style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 9 }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n300)" }}>{s.ticketId}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{t?.subject ?? "—"}</span>
                    <PfBadge tone={s.decision === "accepted" ? "green" : s.decision === "overridden" ? "yellow" : "purple"} dot>
                      {s.decision === "pending" ? "awaiting a person" : s.decision}
                    </PfBadge>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{s.decidedBy ? `${s.decidedBy} · ${s.decidedAt}` : "no decision yet"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 9 }}>
                    <PfBadge tone="purple">proposed {s.suggestedCategory}</PfBadge>
                    {s.overrodeTo && (
                      <>
                        <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                        <PfBadge tone="green">assigned {s.overrodeTo}</PfBadge>
                      </>
                    )}
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>article: {art?.title ?? s.suggestedKbId}</span>
                    <span style={{ flex: 1 }} />
                    <PfSegments score={s.confidence * 5} tone={s.confidence >= 0.8 ? "green" : s.confidence >= 0.6 ? "yellow" : "red"} />
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)" }}>{Math.round(s.confidence * 100)}%</span>
                  </div>
                  {s.overrideReason && (
                    <div style={{ border: "1px solid var(--pf-n100)", borderLeft: "3px solid var(--pf-n900)", borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <Ic name="user" size={14} color="var(--pf-n900)" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-n900)" }}>Why the human disagreed</span>
                        <PfBadge tone="grey">human-authored</PfBadge>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.7 }}>{s.overrideReason}</div>
                    </div>
                  )}
                  <div style={{ marginTop: 9 }}>
                    <WhyThisPanel
                      why={triageWhy(s)}
                      notInputs={[
                        "Who raised it, their department, worker type, grade or tenure",
                        "Performance, engagement, attendance or leave-risk signals",
                        "Any disciplinary case, open or closed",
                        "Nationality and host community — NCDMB reporting fields, never model inputs",
                      ]}
                    />
                  </div>
                </div>
              );
            })}
            <Foot icon="robot">
              {MC08.purpose}. Inputs: {MC08.inputs.toLowerCase()}. {MC08.humanGate}
            </Foot>
          </PfCard>

          {/* volume + satisfaction */}
          <PfCard>
            <PfCardHead title="What people actually ask" sub="Volume by category, on the desk right now. Small numbers, honestly small — this is one cycle, not a year." />
            <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 11 }}>
              {byCategory().map((c) => (
                <div key={c.category}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <Ic name={CATEGORY_ICON[c.category]} size={13} color="var(--pf-n400)" />
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)" }}>{c.category}</span>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c.open} open</span>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n900)", width: 18, textAlign: "right" }}>{c.n}</span>
                  </div>
                  <PfProgress pct={(c.n / Math.max(1, TICKETS.length)) * 100} tone={c.open ? "blue" : "grey"} height={6} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Satisfaction</span>
              <Stars n={Math.round(live.satisfaction)} />
              <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{live.satisfaction} / 5</span>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1, minWidth: 240 }}>
                From {live.rated} resolved tickets. Asked once, on resolution, and never chased — a satisfaction score collected under pressure measures the pressure.
              </span>
            </div>
          </PfCard>

          {/* access log */}
          <PfCard>
            <PfCardHead
              title="Desk access log"
              sub="Every open, every reply, every triage decision — who, when, what. Including the entries this session wrote."
            >
              <PfBadge tone="grey">{log.length} entries</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px", background: "var(--pf-n25)" }}>
              <PfTh style={{ width: 110 }}>When</PfTh>
              <PfTh style={{ width: 230 }}>Who</PfTh>
              <PfTh style={{ flex: 1 }}>What</PfTh>
              <PfTh style={{ width: 250, textAlign: "right" }}>Scope</PfTh>
            </div>
            {log.map((r, i) => {
              const emp = r.who.startsWith("Employee");
              return (
                <div key={`${r.at}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <span style={{ width: 110, flex: "none", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{r.at}</span>
                  <div style={{ width: 230, flex: "none", display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: emp ? "var(--pf-purple-500)" : "var(--pf-primary-500)", flex: "none" }} />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.who}</span>
                  </div>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n600)" }}>{r.action}</span>
                  <span style={{ width: 250, flex: "none", textAlign: "right", fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.scope}</span>
                </div>
              );
            })}
            <Foot icon="shield">
              A ticket is the employee&rsquo;s own words about their own situation, so reading one is a sensitive read and is logged like any other.
              The person who raised it sees the whole thread — there is no internal note field on this desk, which is the simplest way to guarantee it.
              This log cannot be edited or deleted from this screen, by anyone, including People Ops.
            </Foot>
          </PfCard>
        </div>
      )}
    </div>
  );
}
