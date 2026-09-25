"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfPageTabs, PfBanner, PfSegments, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  CATEGORY_ICON, ENGAGE_AI_SURFACES, ENGAGE_MODEL_CARDS, ENGAGE_TODAY,
  HELPDESK_FIREWALL, KB_ARTICLES, SLA_POLICY, TICKETS, TICKET_CATEGORIES,
  deflectionRate, helpdeskKpis, helpfulRate, kbArticle, kbBody, kbDoc,
  slaFor, stateTone, ticketSla, ticketsFor, triageAccuracy,
  type KbArticle, type Ticket, type TicketCategory, type TicketMessage, type TicketState,
} from "@/data/engage";
import { activeAdapter } from "@/data/adapters";
import { ME_ID, ME_PUBLIC, ME_FIRST, MY_MANAGER } from "@/data/me";
import type { WhyThis } from "@/data/trust";

/**
 * My requests — FR-095 from the side of the person who has to ask.
 *
 * Every other helpdesk surface in this product is a desk's screen: a queue, an
 * SLA dashboard, a deflection chart. This one belongs to the employee, and it
 * has exactly one job — make asking cheap enough that she asks, and honest
 * enough that she is not afraid to.
 *
 * Three arguments, in the order the page makes them.
 *
 * 1. THE ANSWER FIRST. Pick a category and the page searches the handbook
 *    BEFORE it offers you a form. Deflection is the number the desk lives on
 *    (563 questions closed by an article, `helpdeskKpis().deflected`) and it is
 *    normally measured on HR's side of the glass, where it reads as a wall. On
 *    this side it has to read as a gift: here is the answer now, at 09:12, not
 *    a ticket number and a four-hour target. The search is a literal word match
 *    over `kbBody()` — not a model — and it shows you the words it matched.
 *
 * 2. THE CLOCK YOU ARE OWED. `slaFor(category)` is a promise made to the asker,
 *    so the asker gets to see it. HD-412 is the interesting one: it sits in
 *    "Waiting on you" and `ticketSla()` returns *Clock paused*. The target
 *    measures how fast HR answers, never how fast you do.
 *
 * 3. WHAT A REQUEST IS NOT. Three claims, and none of them is decoration:
 *      · Not a disciplinary case — `HELPDESK_FIREWALL`, and the absence of an
 *        `escalateToCase()` in engage.ts is the enforcement, not this copy.
 *      · Not visible to your manager unless the category routes through them.
 *        DERIVED: `desksFor()` reads the assignee off every seeded ticket, and
 *        zero of the seven categories resolves to Ngozi Adeyemi. A leave
 *        REQUEST does go to her — LV-221, on /my-leave. A leave QUESTION does
 *        not. Different objects, different pages, and this one says which.
 *      · Not an input to any model that decides something about you. The one
 *        model that reads this text is MC-08, which reads the subject and body
 *        and nothing else, to propose a category to a human. Stated precisely,
 *        because a blanket "no AI touches this" would be a lie and she would
 *        find out.
 *
 * Me-pillar scope: `ticketsFor(ME_ID)` and nothing else. The desk holds six
 * other people's tickets and they are counted, never rendered — including the
 * ones sitting behind an article she is reading.
 *
 * Deterministic — no Date.now(), no Math.random(). Reference day: ENGAGE_TODAY.
 */

/* ---------------------------------- subject -------------------------------- */

const ME = ME_PUBLIC;
const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
/** Blue/500. A raw hex only because PfAvatar interpolates an alpha suffix onto its tone. */
const DESK_TONE = "#007AFF";

/** Hers, and only hers. */
const MY_SEED_TICKETS: Ticket[] = ticketsFor(ME_ID);
/** COUNT ONLY. Six other people's questions live in the same table and never render here. */
const NOT_MINE = TICKETS.length - MY_SEED_TICKETS.length;

const KPI = helpdeskKpis();
const ACC = triageAccuracy();
const MC08 = ENGAGE_MODEL_CARDS.find((m) => m.id === "MC-08")!;
const AS13 = ENGAGE_AI_SURFACES.find((s) => s.id === "AS-13")!;

/** Where anything that moves money leaves. The vendor decision is open; the contract is not. */
const PAY_ROUTE = activeAdapter("payroll_connector");

const TODAY_SHORT = ENGAGE_TODAY.replace(", 2026", "");

const deskTeam = (assignee?: string) => (assignee ? assignee.split("·")[0].trim() : "");
const deskWho = (assignee?: string) => (assignee ? (assignee.split("·")[1] ?? assignee).trim() : "");
const firstName = (n: string) => n.split(" ")[0];

/* --------------------------- derived: who answers what --------------------- */

/**
 * DERIVED, and the derivation is the honest part: a category's desk is whoever
 * has actually answered a ticket in that category. Not a routing table someone
 * typed — a read back off the record. Where nothing has been answered yet there
 * is nothing to infer from, and the page says so instead of guessing.
 */
const desksFor = (c: TicketCategory): string[] =>
  Array.from(new Set(TICKETS.filter((t) => t.category === c && t.assignee).map((t) => t.assignee!)));

/** The claim on the page, computed rather than asserted. It is zero. */
const MANAGER_ROUTED: TicketCategory[] = TICKET_CATEGORIES.filter((c) =>
  desksFor(c).some((d) => d.includes(MY_MANAGER.name)),
);

/**
 * DERIVED: the article a category has actually been answered from. Read off
 * `kbId` on closed and open tickets — a human's decision, never a suggestion.
 * IT & devices and Onboarding resolve to nothing, which is true and rendered.
 */
const ANCHOR_ARTICLES: Record<string, string[]> = TICKET_CATEGORIES.reduce((acc, c) => {
  acc[c] = Array.from(new Set(TICKETS.filter((t) => t.category === c && t.kbId).map((t) => t.kbId!)));
  return acc;
}, {} as Record<string, string[]>);

/* ------------------------------- KB word match ----------------------------- */

/** Common words that match everything and mean nothing. Keeps the ranking honest. */
const STOP = new Set([
  "what", "when", "where", "which", "have", "this", "that", "with", "from", "about", "does", "need",
  "been", "will", "your", "there", "they", "their", "them", "into", "just", "much", "many", "cannot",
  "should", "would", "could", "still", "after", "before", "because", "also", "only", "some", "than",
  "then", "very", "more", "most", "other", "over", "under", "here", "know", "want", "please", "help",
]);

type Match = { article: KbArticle; hits: string[]; score: number; where: string[] };

/** Matches at the START of a word only, so "day" finds "days" and never "holidays". */
const atWordStart = (hay: string, word: string): boolean => {
  let i = hay.indexOf(word);
  while (i !== -1) {
    if (i === 0 || !/[a-z0-9]/.test(hay[i - 1])) return true;
    i = hay.indexOf(word, i + 1);
  }
  return false;
};

/**
 * A LITERAL WORD MATCH. Not a model, not an embedding, not a ranker — three
 * string searches with three weights, run in your browser, sent nowhere. The
 * matched words are shown under every result because a search you cannot audit
 * is a search you have to trust, and she has no reason to.
 *
 * Prefix-at-word-start rather than plain `includes`, which was the difference
 * between "office days lagos" returning the remote-work policy and returning
 * the leave policy because "holidays" contains "days".
 */
function matchKb(text: string): Match[] {
  const words = Array.from(
    new Set(text.toLowerCase().split(/[^a-z0-9₦]+/).filter((w) => w.length >= 4 && !STOP.has(w))),
  );
  if (words.length === 0) return [];
  return KB_ARTICLES.map((a) => {
    const title = a.title.toLowerCase();
    const section = a.section.toLowerCase();
    const body = kbBody(a.id).toLowerCase();
    const hits: string[] = [];
    const where = new Set<string>();
    let score = 0;
    for (const w of words) {
      let hit = false;
      if (atWordStart(title, w)) { score += 3; where.add("title"); hit = true; }
      if (atWordStart(section, w)) { score += 2; where.add("section"); hit = true; }
      if (atWordStart(body, w)) { score += 1; where.add("policy text"); hit = true; }
      if (hit) hits.push(w);
    }
    return { article: a, hits, score, where: Array.from(where) };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.article.views - a.article.views);
}

/* -------------------------------- small pieces ----------------------------- */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13.5, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 10,
  padding: "11px 13px", width: "100%", outline: "none", lineHeight: 1.55,
};

/** Deterministic thousands separator — toLocaleString() varies by locale and breaks hydration. */
const fmtN = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function Note({ icon = "info", tone = "grey", children }: { icon?: string; tone?: PfTone; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Ic name={icon} size={13} color={TONE[tone].fg} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</span>
    </div>
  );
}

function Foot({ icon = "info", children }: { icon?: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function Empty({ icon, title, sub, cta, onCta }: { icon: string; title: string; sub: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={{ background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 11, padding: "28px 22px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", marginBottom: 10 }}><PfTile icon={icon} tone="grey" size={34} /></div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>{sub}</div>
      {cta && <div style={{ marginTop: 14 }}><PfBtn variant="secondary" icon="plus" onClick={onCta}>{cta}</PfBtn></div>}
    </div>
  );
}

/** FR-093 — the one affordance, rendered identically wherever a model speaks. */
function WhyThisPanel({ why, notInputs }: { why: WhyThis; notInputs?: string[] }) {
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
        <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>{why.claim}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "2px 0 6px" }}>Basis</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {why.basis.map((b) => (
              <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                <span>{b}</span>
              </div>
            ))}
          </div>
          {notInputs && notInputs.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".4px", textTransform: "uppercase", margin: "12px 0 6px" }}>Refused as inputs</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {notInputs.map((n) => (
                  <span key={n} style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 999, padding: "3px 9px" }}>{n}</span>
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
            <button
              onClick={() => go("trust")}
              title="Model card index — Trust center"
              style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
            >
              <Ic name="robot" size={12} color="var(--pf-purple-500)" />
              Model card {why.modelCard}{card ? ` · ${card.name}` : ""}
            </button>
            {why.confidence !== undefined && (
              <PfBadge tone={why.confidence >= 0.85 ? "green" : "yellow"}>Confidence {Math.round(why.confidence * 100)}%</PfBadge>
            )}
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)", flex: 1, minWidth: 220, lineHeight: 1.45 }}>
              Human gate: {why.humanGate.toLowerCase()}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/** The NON-model twin. Same shape, grey not purple, because nothing inferred anything. */
function MatchBasis({ m, query }: { m: Match; query: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
      >
        <Ic name="search" size={12} color="var(--pf-n500)" />
        Why this article?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-n500)" />
      </button>
      {open && (
        <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.5 }}>
            {m.hits.length} of your words appear in this article.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
            {m.hits.map((h) => (
              <span key={h} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: "var(--pf-primary-600)", background: "var(--pf-primary-50)", border: "0.6px solid var(--pf-primary-100)", borderRadius: 999, padding: "3px 9px" }}>{h}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
            <Note icon="check" tone="green">
              Matched in the {m.where.join(", ")}. Title matches count 3, section 2, policy text 1 &mdash; that is the whole ranking.
            </Note>
            <Note icon="shield" tone="grey">
              No model ran, so there is no model card. Your {query.trim().split(/\s+/).length}-word query was lowercased, split on
              non-letters, stripped of words under four characters, and matched against the start of words in the handbook text
              &mdash; so &ldquo;day&rdquo; finds &ldquo;days&rdquo; and never &ldquo;holidays&rdquo;. All of it ran in this browser.
              Nothing was sent anywhere and nothing was logged.
            </Note>
          </div>
        </div>
      )}
    </>
  );
}

/* --------------------------------- SLA clock -------------------------------- */

/** The promise, drawn. Elapsed against the two targets the category is owed. */
function SlaClock({ t }: { t: Ticket }) {
  const p = slaFor(t.category);
  const s = ticketSla(t);
  const paused = t.state === "Waiting on you";
  const done = t.state === "Resolved" || t.state === "Closed";
  const target = t.firstResponseHours === undefined ? p.firstResponseHours : p.resolutionHours;
  const pct = Math.min(100, Math.round((t.elapsedHours / target) * 100));
  return (
    <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <Ic name="clock" size={14} color={TONE[s.tone].fg} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, minWidth: 160 }}>{s.label}</span>
        <PfBadge tone={s.tone} dot>{paused ? "Paused" : done ? "Finished" : "Running"}</PfBadge>
      </div>
      <PfProgress pct={paused ? 0 : pct} tone={paused ? "grey" : s.tone} height={8} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--pf-n400)" }}>
        <span>Raised {t.raisedAt}</span>
        <span>{t.elapsedHours}h of working time elapsed</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        {[
          { k: "First reply owed", v: `${p.firstResponseHours}h`, got: t.firstResponseHours !== undefined ? `answered in ${t.firstResponseHours}h` : "not yet" },
          { k: "Resolution owed", v: `${p.resolutionHours}h`, got: done ? `closed at ${t.elapsedHours}h` : "running" },
        ].map((c) => (
          <div key={c.k} style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 10px" }}>
            <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{c.k}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", marginTop: 1 }}>{c.v}</div>
            <div style={{ fontSize: 11, color: "var(--pf-n500)", marginTop: 2 }}>{c.got}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 7 }}>
        <Note icon="info" tone="grey">
          Targets are in <b>working</b> hours, not wall clock. A question raised on Friday at 17:00 is not breached by Monday morning.
        </Note>
        {paused && (
          <Note icon="pause" tone="yellow">
            The clock is stopped while this waits on you. It measures how fast HR answers, never how fast you do &mdash; and this
            ticket will not be auto-closed for going quiet.
          </Note>
        )}
        <Note icon="book" tone="grey">{p.rationale}</Note>
      </div>
    </div>
  );
}

/* --------------------------------- the thread ------------------------------- */

function Bubble({ m, mine }: { m: TicketMessage; mine: boolean }) {
  const sys = m.role === "System";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {sys ? (
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--pf-n50)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Ic name="gear" size={13} color="var(--pf-n400)" />
        </span>
      ) : (
        <PfAvatar init={m.author.split(" ").map((w) => w[0]).slice(0, 2).join("")} tone={mine ? ME.tone : DESK_TONE} size={28} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{mine ? "You" : m.author}</span>
          <PfBadge tone={sys ? "grey" : mine ? "purple" : "blue"}>{sys ? "Helpdesk" : mine ? "You" : m.role}</PfBadge>
          <span style={{ fontSize: 11, color: "var(--pf-n300)", fontFamily: MONO }}>{m.at}</span>
        </div>
        <div
          style={{
            fontSize: 13, color: sys ? "var(--pf-n500)" : "var(--pf-n600)", lineHeight: 1.6, marginTop: 6,
            background: sys ? "var(--pf-n25)" : mine ? "var(--pf-purple-50)" : "var(--pf-n0)",
            border: `1px solid ${sys ? "var(--pf-n50)" : mine ? "var(--pf-purple-100)" : "var(--pf-n50)"}`,
            borderRadius: 10, padding: "11px 13px", fontStyle: sys ? "italic" : "normal",
          }}
        >
          {m.body}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- ticket row -------------------------------- */

function TicketRow({ t, active, session, onClick }: { t: Ticket; active: boolean; session: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const s = ticketSla(t);
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        fontFamily: "inherit", textAlign: "left", width: "100%", cursor: "pointer",
        display: "flex", gap: 11, alignItems: "flex-start", padding: "13px 16px",
        background: active ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "var(--pf-n0)",
        border: "none", borderLeft: `2px solid ${active ? "var(--pf-primary-500)" : "transparent"}`,
        borderBottom: "1px solid var(--pf-n50)",
      }}
    >
      <PfTile icon={CATEGORY_ICON[t.category]} tone={active ? "green" : "grey"} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "var(--pf-n400)" }}>{t.id}</span>
          <PfBadge tone={stateTone(t.state)} dot>{t.state}</PfBadge>
          {session && <PfBadge tone="purple">Raised in this session</PfBadge>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 4, lineHeight: 1.4 }}>{t.subject}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{t.category}</span>
          <span style={{ width: 1, height: 10, background: "var(--pf-n100)" }} />
          <span style={{ fontSize: 11.5, color: TONE[s.tone].fg, fontWeight: 500 }}>{s.label}</span>
        </div>
      </div>
      <Ic name="caretright" size={14} color="var(--pf-n300)" />
    </button>
  );
}

/* ================================== screen ================================== */

type Tab = "raise" | "open" | "answers";
type Overlay = { state?: TicketState; extra: TicketMessage[]; satisfaction?: number };
type OpenFilter = "All" | "Needs you" | "With HR" | "Done";
type KbSort = "Most read" | "Best at deflecting";

export default function MyRequests() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("raise");

  /* --------------------------------- raise flow --------------------------- */
  const [cat, setCat] = useState<TicketCategory | null>(null);
  const [query, setQuery] = useState("");
  const [filing, setFiling] = useState(false);
  const [detail, setDetail] = useState("");
  /** Articles she said answered it. A deflection she performed, counted separately from the desk's 563. */
  const [selfServed, setSelfServed] = useState<string[]>([]);

  /* ------------------------------- my requests ---------------------------- */
  const [sessionTickets, setSessionTickets] = useState<Ticket[]>([]);
  const [overlay, setOverlay] = useState<Record<string, Overlay>>({});
  const [selectedId, setSelectedId] = useState<string>(MY_SEED_TICKETS[0]?.id ?? "");
  const [openFilter, setOpenFilter] = useState<OpenFilter>("All");
  const [reply, setReply] = useState("");
  const [stampSeq, setStampSeq] = useState(0);

  /* --------------------------------- answers ------------------------------ */
  const [kbQuery, setKbQuery] = useState("");
  const [kbCat, setKbCat] = useState<TicketCategory | "All">("All");
  const [kbSort, setKbSort] = useState<KbSort>("Most read");
  const [openArticle, setOpenArticle] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "up" | "down">>({});

  /* ------------------------------- deterministic -------------------------- */
  /** Session stamps come off a counter, so the server and the client agree. */
  const stamp = (n: number) => {
    const mins = 14 + n * 7;
    return `${TODAY_SHORT} · ${String(9 + Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  };

  /* ---------------------------------- derived ----------------------------- */

  const withOverlay = (t: Ticket): Ticket => {
    const o = overlay[t.id];
    if (!o) return t;
    return {
      ...t,
      state: o.state ?? t.state,
      thread: [...t.thread, ...o.extra],
      satisfaction: o.satisfaction ?? t.satisfaction,
    };
  };

  const mine: Ticket[] = useMemo(
    () => [...sessionTickets, ...MY_SEED_TICKETS].map(withOverlay),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionTickets, overlay],
  );

  const isSession = (id: string) => sessionTickets.some((t) => t.id === id);

  const needsMe = mine.filter((t) => t.state === "Waiting on you");
  const withHr = mine.filter((t) => t.state === "New" || t.state === "Open");
  const finished = mine.filter((t) => t.state === "Resolved" || t.state === "Closed");

  const filtered = mine.filter((t) =>
    openFilter === "All" ? true
      : openFilter === "Needs you" ? t.state === "Waiting on you"
        : openFilter === "With HR" ? t.state === "New" || t.state === "Open"
          : t.state === "Resolved" || t.state === "Closed",
  );

  /** The detail pane never shows a row the filter has hidden. */
  const selected: Ticket | undefined = filtered.find((t) => t.id === selectedId) ?? filtered[0];

  /** Her own reply times, off her own tickets. Both inside target — say so, do not imply it. */
  const myReplies = MY_SEED_TICKETS.map((t) => t.firstResponseHours).filter((h): h is number => h !== undefined);
  const slowestReply = myReplies.length ? Math.max(...myReplies) : 0;
  const allInsideTarget = MY_SEED_TICKETS.every(
    (t) => t.firstResponseHours === undefined || t.firstResponseHours <= slaFor(t.category).firstResponseHours,
  );

  /* ------------------------------ raise-flow derived ---------------------- */

  const anchorIds = cat ? (ANCHOR_ARTICLES[cat] ?? []) : [];
  const anchors = anchorIds.map((id) => kbArticle(id)).filter((a): a is KbArticle => Boolean(a));
  const typed = query.trim();
  const searched = useMemo(() => matchKb(typed), [typed]);

  /**
   * Your words win. Where you have not typed any yet, the category's own
   * history stands in — the articles a question in this category was actually
   * answered from. Never the same article twice.
   */
  const suggestions: Match[] = useMemo(() => {
    const fromAnchors: Match[] = anchors.map((a) => ({
      article: a,
      hits: [],
      score: 0,
      where: ["a question in this category that was actually answered from it"],
    }));
    if (searched.length === 0) return fromAnchors.slice(0, 4);
    const seen = new Set(searched.map((m) => m.article.id));
    return [...searched, ...fromAnchors.filter((m) => !seen.has(m.article.id))].slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, searched]);

  const desks = cat ? desksFor(cat) : [];
  const sla = cat ? slaFor(cat) : undefined;

  /* -------------------------------- answers derived ----------------------- */

  const kbMatches = kbQuery.trim() ? matchKb(kbQuery) : [];
  const kbMatchIds = new Set(kbMatches.map((m) => m.article.id));
  const kbList = useMemo(() => {
    let list = kbQuery.trim() ? kbMatches.map((m) => m.article) : [...KB_ARTICLES];
    if (kbCat !== "All") {
      const ids = new Set(ANCHOR_ARTICLES[kbCat] ?? []);
      list = list.filter((a) => ids.has(a.id));
    }
    if (!kbQuery.trim()) {
      list = list.sort((a, b) => (kbSort === "Most read" ? b.views - a.views : deflectionRate(b) - deflectionRate(a)));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kbQuery, kbCat, kbSort]);

  /* --------------------------------- actions ------------------------------ */

  const pickCategory = (c: TicketCategory) => {
    setCat(c);
    setFiling(false);
    const found = ANCHOR_ARTICLES[c]?.length ?? 0;
    toast(
      found > 0
        ? `${c} — ${found} handbook ${found === 1 ? "article has" : "articles have"} already answered a question like this. Read it before you file.`
        : `${c} — nothing in the handbook has answered a question in ${c} yet. Describe it and the words will search anyway.`,
    );
  };

  const served = (a: KbArticle) => {
    if (selfServed.includes(a.id)) return;
    setSelfServed((prev) => [...prev, a.id]);
    setFiling(false);
    toast(`${a.title} answered it — nothing filed, nothing queued, no one waiting on a reply`, "success");
  };

  const fileIt = () => {
    if (!cat) { toast("Pick what this is about first — it decides the clock you are owed", "danger"); return; }
    if (typed.length < 8) { toast("Give the desk a sentence to work with — one line is enough, eight characters is not", "danger"); return; }
    const n = sessionTickets.length;
    const id = `HD-4${16 + n}`;
    const at = stamp(stampSeq);
    setStampSeq((s) => s + 1);
    const body = detail.trim() || typed;
    const t: Ticket = {
      id,
      subject: typed,
      body,
      category: cat,
      raisedBy: ME_ID,
      raisedByName: ME.name,
      init: ME.init,
      tone: ME.tone,
      raisedAt: at,
      state: "New",
      elapsedHours: 0,
      thread: [{ id: `${id}-m1`, at, author: ME.name, role: "Employee", body }],
      note: "Raised on /my-requests in this session.",
    };
    setSessionTickets((prev) => [t, ...prev]);
    setSelectedId(id);
    setOpenFilter("All");
    setTab("open");
    setQuery("");
    setDetail("");
    setFiling(false);
    setCat(null);
    toast(`${id} is with ${deskWho(desks[0]) || "People Ops"} — first reply owed inside ${slaFor(cat).firstResponseHours} working hours`, "success");
  };

  const sendReply = () => {
    if (!selected) return;
    if (reply.trim().length < 2) { toast("Nothing to send yet", "danger"); return; }
    const at = stamp(stampSeq);
    setStampSeq((s) => s + 1);
    const msgs: TicketMessage[] = [
      { id: `${selected.id}-r${stampSeq}`, at, author: ME.name, role: "Employee", body: reply.trim() },
      {
        id: `${selected.id}-s${stampSeq}`, at, author: "Helpdesk", role: "System",
        body: `Back with ${deskWho(selected.assignee) || "the desk"}. The resolution clock restarts from here — the ${slaFor(selected.category).resolutionHours}-working-hour target is theirs, not yours.`,
      },
    ];
    setOverlay((prev) => ({
      ...prev,
      [selected.id]: { state: "Open", extra: [...(prev[selected.id]?.extra ?? []), ...msgs], satisfaction: prev[selected.id]?.satisfaction },
    }));
    setReply("");
    toast(`Replied on ${selected.id} — it is back with ${deskWho(selected.assignee) || "the desk"} and the clock is running again`, "success");
  };

  const closeIt = () => {
    if (!selected) return;
    const at = stamp(stampSeq);
    setStampSeq((s) => s + 1);
    setOverlay((prev) => ({
      ...prev,
      [selected.id]: {
        state: "Closed",
        satisfaction: prev[selected.id]?.satisfaction,
        extra: [
          ...(prev[selected.id]?.extra ?? []),
          { id: `${selected.id}-c${stampSeq}`, at, author: "Helpdesk", role: "System", body: `Closed by ${ME.name}. A resolved ticket is HR's opinion that the question is answered; a closed one is yours.` },
        ],
      },
    }));
    toast(`${selected.id} closed by you — not by the desk, and not by a timer`, "success");
  };

  const rate = (n: number) => {
    if (!selected) return;
    setOverlay((prev) => ({ ...prev, [selected.id]: { ...(prev[selected.id] ?? { extra: [] }), satisfaction: n } }));
    toast(`${n} of 5 on ${selected.id}. Asked once, recorded once, never chased.`, "success");
  };

  const vote = (a: KbArticle, v: "up" | "down") => {
    setVotes((prev) => ({ ...prev, [a.id]: v }));
    toast(
      v === "up"
        ? `Marked helpful — ${a.title} is now ${helpfulRate(a)}% helpful across ${a.helpful + a.unhelpful} votes`
        : `Marked unhelpful. That goes to ${a.owner}, who owns the text — not to a queue.`,
      v === "up" ? "success" : "default",
    );
  };

  const askAbout = (a: KbArticle) => {
    const c = (TICKET_CATEGORIES.find((x) => (ANCHOR_ARTICLES[x] ?? []).includes(a.id)) ?? "Other") as TicketCategory;
    setCat(c);
    setQuery(`About ${a.title.toLowerCase()} — `);
    setFiling(true);
    setTab("raise");
    toast(`Carried ${a.title} across as ${c}. Say what the article did not cover.`);
  };

  /* --------------------------- the MC-08 explanation ---------------------- */

  const triageWhyForMe: WhyThis = {
    claim: `When ${cat ? `a ${cat.toLowerCase()} request` : "a request"} lands on the desk, ${MC08.name} (${MC08.id}) proposes a category, an article and an assignee. It does not apply any of them.`,
    basis: [
      `Inputs: ${MC08.inputs.toLowerCase()} — the subject line and the body you type, and nothing else.`,
      `${MC08.humanGate}`,
      `It has been overridden once in ${ACC.decided} decisions on this desk (${ACC.pct}% accepted). The override that stands is HD-413: a per-diem RATE question the model read as a pay question, corrected by the person who would have received it.`,
      `Registered as AI surface ${AS13.id} on the FR-093 coverage audit. ${AS13.where}.`,
    ],
    modelCard: MC08.id,
    humanGate: MC08.humanGate,
  };

  const NOT_INPUTS = [
    "who you are", "your department", "your grade", "your manager", "your performance",
    "your attendance", "your leave balance", "your case history", "nationality", "host community",
  ];

  /* ----------------------------------- view ------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My requests</div>
            <PfBadge tone="grey">{ME.id}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55 }}>
            Ask People Ops something, and track what you already asked. The page looks for the answer in the handbook before it
            offers you a form &mdash; not to stop you filing, but because an answer at {stamp(0).split("· ")[1]} beats a ticket
            number and a four-hour target.
          </div>
        </div>
        <PfBtn variant="secondary" icon="shield" onClick={() => go("myprivacy")}>My data &amp; privacy</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { setTab("raise"); setFiling(false); }}>Ask a question</PfBtn>
      </div>

      {/* ------------------------------- KPI strip ---------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="chat" tone="green" label="Open right now"
          value={mine.length - finished.length} unit={`of ${mine.length} you have ever raised`}
          delta={needsMe.length > 0 ? `${needsMe.length} waiting on you` : "Nothing needs you"}
          deltaTone={needsMe.length > 0 ? "yellow" : "green"}
        />
        <PfStat
          icon="clock" tone="blue" label="Slowest reply you have had"
          value={`${slowestReply}h`} unit="to a first answer"
          delta={allInsideTarget ? "Both inside target" : "One over target"}
          deltaTone={allInsideTarget ? "green" : "red"}
        />
        <PfStat
          icon="book" tone="purple" label="Answered without a ticket"
          value={KPI.deflected} unit="questions closed by an article"
          delta={`${KPI.deflectionRate}% of everyone who read one`} deltaTone="green"
        />
        <PfStat
          icon="shield" tone="yellow" label="Routes through your manager"
          value={MANAGER_ROUTED.length} unit={`of ${TICKET_CATEGORIES.length} request categories`}
          delta={MANAGER_ROUTED.length === 0 ? `${firstName(MY_MANAGER.name)} sees none of this` : "Check the routing"}
          deltaTone={MANAGER_ROUTED.length === 0 ? "green" : "red"}
        />
      </div>

      {/* --------------------------- the lead insight ------------------------- */}
      <div style={{ marginTop: 12 }}>
        {needsMe.length > 0 ? (
          <PfBanner
            tone="yellow" icon="warning" cta="Open it"
            onCta={() => { setTab("open"); setOpenFilter("Needs you"); setSelectedId(needsMe[0].id); }}
          >
            {needsMe[0].id} is not late &mdash; it is waiting on you. {deskWho(needsMe[0].assignee)} answered in{" "}
            {needsMe[0].firstResponseHours}h and asked you something back on {needsMe[0].thread[2]?.at ?? needsMe[0].raisedAt}.
            The SLA clock stopped the moment it became your turn, and this ticket will never be closed for going quiet.
          </PfBanner>
        ) : (
          <PfBanner tone="green" icon="check" cta="Ask something" onCta={() => setTab("raise")}>
            Nothing is waiting on you. {mine.length - finished.length} of your {mine.length} requests {mine.length - finished.length === 1 ? "is" : "are"} still
            with the desk, and every reply you have ever had arrived inside the target you were owed.
          </PfBanner>
        )}
      </div>

      {/* ------------------------------ section tabs -------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as Tab)}
          tabs={[
            { key: "raise", label: "Raise a request" },
            { key: "open", label: "My open requests", count: String(mine.length - finished.length) },
            { key: "answers", label: "Answers I already have", count: String(KB_ARTICLES.length) },
          ]}
        />
      </div>

      {/* ================================= RAISE =============================== */}
      {tab === "raise" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* ---------------------------- step 1 · category ---------------------- */}
          <PfCard>
            <PfCardHead
              title="What is this about?"
              sub="The category picks the clock you are owed and the desk that answers. It is not a guess about you."
            >
              {selfServed.length > 0 && <PfBadge tone="green" dot>{selfServed.length} answered without filing</PfBadge>}
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TICKET_CATEGORIES.map((c) => {
                  const active = cat === c;
                  const p = slaFor(c);
                  return (
                    <button
                      key={c}
                      onClick={() => pickCategory(c)}
                      style={{
                        fontFamily: "inherit", cursor: "pointer", textAlign: "left",
                        display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 11,
                        background: active ? "var(--pf-primary-50)" : "var(--pf-n0)",
                        border: `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                        boxShadow: "0 0 0 0.5px rgba(42,42,42,.05)",
                      }}
                    >
                      <PfTile icon={CATEGORY_ICON[c]} tone={active ? "green" : "grey"} size={26} />
                      <span>
                        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{c}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>
                          {p.firstResponseHours}h first reply
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {!cat && (
                <div style={{ marginTop: 14 }}>
                  <Note icon="info" tone="grey">
                    Seven categories, seven different promises. IT is the fastest at two hours because a blocked laptop is a
                    blocked day; Benefits is the slowest at 72 because the answer often has to come from a provider. Nothing here
                    is a queue you get lost in &mdash; pick one and the target appears.
                  </Note>
                </div>
              )}

              {cat && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                    <SectionLabel>What you are owed</SectionLabel>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.5px", lineHeight: 1 }}>{sla?.firstResponseHours}h</span>
                      <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>to a first reply · {sla?.resolutionHours}h to a resolution</span>
                    </div>
                    <div style={{ marginTop: 11 }}>
                      <Note icon="book" tone="grey">{sla?.rationale}</Note>
                    </div>
                  </div>
                  <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                    <SectionLabel>Who answers it</SectionLabel>
                    {desks.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {desks.map((d) => (
                          <div key={d} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <PfAvatar init={deskWho(d).split(" ").map((w) => w[0]).slice(0, 2).join("")} tone={DESK_TONE} size={26} />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{deskWho(d)}</span>
                              <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)" }}>{deskTeam(d)}</span>
                            </span>
                          </div>
                        ))}
                        <Note icon="swap" tone="grey">
                          Read back off the record &mdash; {desks.length === 1 ? "this desk has" : "these desks have"} actually
                          answered a {cat.toLowerCase()} question before. It is not a routing table someone typed.
                        </Note>
                      </div>
                    ) : (
                      <Note icon="question" tone="yellow">
                        No {cat.toLowerCase()} question has been answered on this desk yet, so there is nothing to read a desk off.
                        It will be triaged to one by a person when it arrives.
                      </Note>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Foot icon="shield">
              Picking a category tells the desk where to send it. It does not tell anyone anything about you, and it is not stored
              on your record &mdash; a ticket is a question, held on the ticket.
            </Foot>
          </PfCard>

          {/* ------------------------ step 2 · answer first ---------------------- */}
          {cat && (
            <PfCard>
              <PfCardHead
                title="Say it in your own words"
                sub="The handbook is searched as you type. If the answer is already written down, you can have it now."
              >
                <PfBadge tone="grey">Word match · no model</PfBadge>
              </PfCardHead>
              <div style={{ padding: "16px 20px" }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    cat === "Leave" ? "e.g. can I carry unused days into next year"
                      : cat === "Pay & payslips" ? "e.g. where does my pension deduction go"
                        : cat === "IT & devices" ? "e.g. laptop will not rejoin the VPN"
                          : "Describe it the way you would say it out loud"
                  }
                  style={INPUT}
                />

                {typed.length > 0 && typed.length < 8 && (
                  <div style={{ marginTop: 10 }}>
                    <Note icon="info" tone="grey">Keep going &mdash; the search needs whole words, and words under four letters are ignored.</Note>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <SectionLabel>
                      {typed.length >= 8 && searched.length > 0
                        ? `${suggestions.length} ${suggestions.length === 1 ? "article" : "articles"} that may already answer this`
                        : `Already answered questions like this${cat ? ` in ${cat}` : ""}`}
                    </SectionLabel>
                    {typed.length >= 8 && searched.length === 0 && (
                      <div style={{ marginBottom: 11 }}>
                        <Note icon="search" tone="yellow">
                          None of your words appear in any of the {KB_ARTICLES.length} policy cards. What follows is not a match
                          &mdash; it is the {suggestions.length === 1 ? "article" : "articles"} other {cat} questions were answered
                          from. Skim {suggestions.length === 1 ? "it" : "them"}, then file yours.
                        </Note>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {suggestions.map((m) => {
                        const a = m.article;
                        const doc = kbDoc(a.id);
                        const done = selfServed.includes(a.id);
                        return (
                          <div
                            key={a.id}
                            style={{
                              border: `1px solid ${done ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                              background: done ? "var(--pf-primary-50)" : "var(--pf-n0)",
                              borderRadius: 11, padding: "14px 16px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                              <PfTile icon="book" tone={done ? "green" : "blue"} size={28} />
                              <span style={{ flex: 1, minWidth: 200 }}>
                                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.title}</span>
                                <span style={{ display: "block", fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                                  {a.section} · {a.owner} · updated {a.updated}
                                </span>
                              </span>
                              <PfBadge tone={deflectionRate(a) >= 80 ? "green" : "yellow"}>
                                {deflectionRate(a)}% never file after reading
                              </PfBadge>
                            </div>

                            <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.65, marginTop: 11, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
                              {doc?.body ?? kbBody(a.id)}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                              {done ? (
                                <PfBadge tone="green" dot>You said this answered it &mdash; nothing was filed</PfBadge>
                              ) : (
                                <>
                                  <PfBtn small variant="primary" icon="check" onClick={() => served(a)}>That answers it</PfBtn>
                                  <PfBtn small variant="secondary" icon="arrowright" onClick={() => setFiling(true)}>It does not &mdash; file it</PfBtn>
                                </>
                              )}
                              <span style={{ flex: 1 }} />
                              {m.hits.length > 0
                                ? <MatchBasis m={m} query={typed} />
                                : (
                                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
                                    Surfaced because {a.relatedTickets.length} {a.relatedTickets.length === 1 ? "question" : "questions"} in {cat} {a.relatedTickets.length === 1 ? "was" : "were"} answered from it
                                  </span>
                                )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {typed.length >= 8 && suggestions.length === 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Empty
                      icon="search"
                      title="Nothing in the handbook covers this"
                      sub={`All ${KB_ARTICLES.length} policy cards were searched and none of your words appear in any of them. That is a real answer, not a failure — it means the question is worth a person's time.`}
                      cta="File it"
                      onCta={() => setFiling(true)}
                    />
                  </div>
                )}
              </div>
              <Foot icon="search">
                Deflection cuts both ways. The desk counts {KPI.deflected} questions an article answered ({KPI.deflectionRate}% of
                everyone who opened one) and calls it the number that matters &mdash; it is the only reason two people can answer
                for 358 workers. You get the other half of that trade: the answer, now, without waiting for anyone.
              </Foot>
            </PfCard>
          )}

          {/* ------------------------- step 3 · file it -------------------------- */}
          {cat && filing && (
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12, alignItems: "start" }}>
              <PfCard>
                <PfCardHead title="File it" sub={`${cat} · ${sla?.firstResponseHours}h to a first reply, ${sla?.resolutionHours}h to a resolution`} />
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>Subject</div>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} style={INPUT} placeholder="One line" />

                  <div style={{ margin: "14px 0 6px", fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>
                    Anything else the desk should know <span style={{ fontWeight: 400, color: "var(--pf-n400)" }}>(optional)</span>
                  </div>
                  <textarea
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    rows={5}
                    style={{ ...INPUT, resize: "vertical" }}
                    placeholder="Dates, amounts, what you already tried. Leave it blank and your subject line goes on its own."
                  />

                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 14 }}>
                    <PfBtn variant="primary" icon="paperplane" onClick={fileIt}>Send to the desk</PfBtn>
                    <PfBtn variant="secondary" icon="x" onClick={() => setFiling(false)}>Back to the answers</PfBtn>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{typed.length} characters in the subject</span>
                  </div>
                </div>
                <Foot icon="clock">
                  The clock starts when you send, and it counts working hours. If the desk comes back with a question, it stops
                  until you answer &mdash; the target measures them, not you.
                </Foot>
              </PfCard>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* ------------------------- the AI disclosure --------------------- */}
                <PfCard>
                  <PfCardHead title="What reads this" sub={`${AS13.id} · the only model that touches your text`} />
                  <div style={{ padding: "16px 20px" }}>
                    <div style={{ border: "1px solid var(--pf-purple-100)", background: "var(--pf-purple-50)", borderRadius: 11, padding: "13px 15px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 9 }}>
                        <Ic name="robot" size={15} color="var(--pf-purple-500)" />
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)", flex: 1 }}>{MC08.name}</span>
                        <PfBadge tone="purple">{MC08.id}</PfBadge>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                        {MC08.purpose}. It reads your subject and body and nothing else, and a person decides. On this desk it has
                        been accepted {ACC.accepted} time{ACC.accepted === 1 ? "" : "s"} and overridden {ACC.overridden} &mdash; the
                        override is kept with the reason, which is the point of keeping it.
                      </div>
                      <div style={{ marginTop: 11 }}>
                        <WhyThisPanel why={triageWhyForMe} notInputs={NOT_INPUTS} />
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      <Note icon="shield" tone="green">
                        What you type here is not an input to any model that decides something about you. Not your leave-risk score,
                        not your review, not a performance signal, not an attendance flag. Those models read tenure, pay band,
                        review history and clock events &mdash; never a helpdesk ticket.
                      </Note>
                      <Note icon="info" tone="grey">
                        Stated that precisely on purpose. &ldquo;No AI touches this&rdquo; would be false, and you would find out.
                      </Note>
                    </div>
                  </div>
                </PfCard>
              </div>
            </div>
          )}

          {/* ------------------------ what a request is not ---------------------- */}
          <PfCard>
            <PfCardHead
              title="What a request is not"
              sub="Three things, because all three are reasons people do not ask."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {[
                {
                  icon: "shield", tone: "red" as PfTone,
                  head: HELPDESK_FIREWALL.headline,
                  body: HELPDESK_FIREWALL.ticket,
                  more: [HELPDESK_FIREWALL.rule, HELPDESK_FIREWALL.why],
                },
                {
                  icon: "users", tone: "blue" as PfTone,
                  head: `${MANAGER_ROUTED.length === 0 ? "None of it" : "Some of it"} reaches ${firstName(MY_MANAGER.name)}`,
                  body: `Zero of the ${TICKET_CATEGORIES.length} categories on this desk routes through your line manager. Every desk that has ever answered one of these is People Ops, Finance, Platform or HSE.`,
                  more: [
                    `A leave REQUEST does go to ${MY_MANAGER.name} — LV-221, Sep 14–18, approved. That is a different object on a different page.`,
                    "A leave QUESTION does not. HD-408 asked whether the 5-day carry-over cap was firm and it was answered by People Ops; she never saw it.",
                  ],
                },
                {
                  icon: "robot", tone: "purple" as PfTone,
                  head: "Not an input to a decision",
                  body: `One model reads this text: ${MC08.id}, to propose a category to a human. It is registered as ${AS13.id} on the FR-093 coverage audit and it carries a "Why this?" wherever it speaks.`,
                  more: [
                    "It is not an input to your leave-risk score, your review packet, your growth readiness or any attendance signal.",
                    "Asking a question about your payslip does not become a fact about you.",
                  ],
                },
              ].map((c, i) => (
                <div key={c.head} style={{ padding: "16px 20px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <PfTile icon={c.icon} tone={c.tone} size={30} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 10 }}>{c.head}</div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.6 }}>{c.body}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                    {c.more.map((m) => <Note key={m} icon="check" tone={c.tone}>{m}</Note>)}
                  </div>
                </div>
              ))}
            </div>
            <Foot icon="shield">
              The firewall is not a promise in copy. engage.ts has no <code style={{ fontFamily: MONO }}>escalateToCase()</code>,
              no <code style={{ fontFamily: MONO }}>caseId</code> on a ticket and no import of the disciplinary module &mdash; there
              is no code path from here to there, which is a stronger guarantee than a policy.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* ================================== OPEN =============================== */}
      {tab === "open" && (
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 12, alignItems: "start" }}>
          {/* --------------------------------- list ----------------------------- */}
          <PfCard style={{ overflow: "hidden" }}>
            <PfCardHead title="Everything you have asked" sub={`${mine.length} ${mine.length === 1 ? "request" : "requests"} · yours only`} />
            <div style={{ display: "flex", gap: 6, padding: "12px 16px", flexWrap: "wrap", borderBottom: "1px solid var(--pf-n50)" }}>
              {([
                ["All", mine.length],
                ["Needs you", needsMe.length],
                ["With HR", withHr.length],
                ["Done", finished.length],
              ] as [OpenFilter, number][]).map(([f, n]) => {
                const active = openFilter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setOpenFilter(f)}
                    style={{
                      fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer",
                      padding: "5px 11px", borderRadius: 999,
                      color: active ? "var(--pf-n900)" : "var(--pf-n500)",
                      background: active ? "var(--pf-n0)" : "var(--pf-n25)",
                      border: `1px solid ${active ? "var(--pf-n100)" : "var(--pf-n50)"}`,
                      boxShadow: active ? "0 1px 3px rgba(2,6,23,.06)" : "none",
                    }}
                  >
                    {f} <span style={{ fontFamily: MONO, color: active ? "var(--pf-primary-600)" : "var(--pf-n300)" }}>{n}</span>
                  </button>
                );
              })}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: 16 }}>
                <Empty
                  icon="chat"
                  title={`Nothing ${openFilter === "Needs you" ? "is waiting on you" : openFilter === "With HR" ? "is with the desk" : "is finished"}`}
                  sub="That is the good version of an empty list. Change the filter to see the rest."
                />
              </div>
            ) : (
              <div>
                {filtered.map((t) => (
                  <TicketRow
                    key={t.id}
                    t={t}
                    active={selected?.id === t.id}
                    session={isSession(t.id)}
                    onClick={() => setSelectedId(t.id)}
                  />
                ))}
              </div>
            )}

            <Foot icon="shield">
              {NOT_MINE} other people&rsquo;s questions sit in the same table. They are filtered out by worker id, not hidden by
              styling &mdash; and they cannot see yours either.
            </Foot>
          </PfCard>

          {/* -------------------------------- detail ---------------------------- */}
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PfCard>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: "var(--pf-n400)" }}>{selected.id}</span>
                    <PfBadge tone={stateTone(selected.state)} dot>{selected.state}</PfBadge>
                    <PfBadge tone="grey">{selected.category}</PfBadge>
                    {selected.satisfaction !== undefined && <PfBadge tone="green">You rated it {selected.satisfaction}/5</PfBadge>}
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 8, lineHeight: 1.4 }}>{selected.subject}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Raised {selected.raisedAt}</span>
                    {selected.assignee && (
                      <>
                        <span style={{ width: 1, height: 10, background: "var(--pf-n100)" }} />
                        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>With {deskWho(selected.assignee)} · {deskTeam(selected.assignee)}</span>
                      </>
                    )}
                    {!selected.assignee && (
                      <>
                        <span style={{ width: 1, height: 10, background: "var(--pf-n100)" }} />
                        <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Unassigned &mdash; a person picks the desk</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20, padding: "16px 20px" }}>
                  {/* ----------------------------- thread ---------------------------- */}
                  <div>
                    <SectionLabel>The thread</SectionLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {selected.thread.map((m) => (
                        <Bubble key={m.id} m={m} mine={m.role === "Employee"} />
                      ))}
                    </div>

                    {/* --------------------------- reply box ------------------------- */}
                    {selected.state === "Waiting on you" && (
                      <div style={{ marginTop: 16, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 11, padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                          <Ic name="warning" size={14} color="var(--pf-yellow-500)" />
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-yellow-500)" }}>
                            {deskWho(selected.assignee)} is waiting on your answer
                          </span>
                        </div>
                        <textarea
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          rows={3}
                          placeholder="Reply here"
                          style={{ ...INPUT, resize: "vertical" }}
                        />
                        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 11 }}>
                          <PfBtn variant="primary" small icon="paperplane" onClick={sendReply}>Send reply</PfBtn>
                          <PfBtn variant="secondary" small icon="x" onClick={closeIt}>I no longer need this</PfBtn>
                        </div>
                        <div style={{ marginTop: 11, display: "flex", flexDirection: "column", gap: 7 }}>
                          <Note icon="shield" tone="yellow">
                            Reply in the thread rather than by email. Every read of this ticket is access-logged and every message
                            stays on the ticket; an email is neither.
                          </Note>
                        </div>
                      </div>
                    )}

                    {/* ------------------------ satisfaction ------------------------- */}
                    {(selected.state === "Resolved" || selected.state === "Closed") && (
                      <div style={{ marginTop: 16, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "14px 16px" }}>
                        <SectionLabel>Was that a good answer?</SectionLabel>
                        {selected.satisfaction !== undefined ? (
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <PfSegments score={selected.satisfaction} outOf={5} tone="green" />
                              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{selected.satisfaction}<span style={{ fontWeight: 400, color: "var(--pf-n300)" }}>/5</span></span>
                            </div>
                            <div style={{ marginTop: 10 }}>
                              <Note icon="check" tone="green">
                                Asked once, on resolution. Never asked twice and never chased &mdash; a survey that nags is a survey
                                that gets a 5 from everyone who wants it to stop.
                              </Note>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                onClick={() => rate(n)}
                                style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer", width: 36, height: 32, borderRadius: 8, background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", color: "var(--pf-n600)", boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)" }}
                              >
                                {n}
                              </button>
                            ))}
                            <span style={{ fontSize: 11.5, color: "var(--pf-n400)", marginLeft: 4 }}>Optional. It goes to the desk, not to your record.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {selected.state === "New" && (
                      <div style={{ marginTop: 16 }}>
                        <Note icon="clock" tone="blue">
                          Nobody has opened this yet. When they do, the first-reply clock stops and the resolution clock takes over
                          &mdash; you will see both change on this page.
                        </Note>
                      </div>
                    )}
                  </div>

                  {/* ------------------------------ side ----------------------------- */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <SlaClock t={selected} />

                    {selected.kbId && (
                      <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                        <SectionLabel>Answered from</SectionLabel>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <PfTile icon="book" tone="blue" size={28} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{kbArticle(selected.kbId)?.title}</span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{kbArticle(selected.kbId)?.owner}</span>
                          </span>
                        </div>
                        <div style={{ marginTop: 11 }}>
                          <PfBtn small variant="secondary" icon="book" onClick={() => { setTab("answers"); setOpenArticle(selected.kbId!); setKbQuery(""); setKbCat("All"); }}>
                            Read the article
                          </PfBtn>
                        </div>
                      </div>
                    )}

                    {selected.category === "Pay & payslips" && (
                      <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                        <SectionLabel>Where the money part goes</SectionLabel>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {[`${PAY_ROUTE?.contract ?? "payroll_connector"} ${PAY_ROUTE?.version ?? "v1"}`, "the connected payroll source"].map((s, i, arr) => (
                            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>{s}</span>
                              {i < arr.length - 1 && <Ic name="arrowright" size={13} color="var(--pf-n300)" />}
                            </span>
                          ))}
                        </div>
                        <div style={{ marginTop: 11 }}>
                          <Note icon="wallet" tone="grey">
                            This desk can explain a deduction and correct a record. It cannot pay you &mdash; anything that moves
                            money leaves through the {PAY_ROUTE?.contract ?? "payroll_connector"} contract to your payroll system,
                            on the 25th like everything else.
                          </Note>
                        </div>
                      </div>
                    )}

                    {selected.note && !isSession(selected.id) && (
                      <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                        <SectionLabel>On the record</SectionLabel>
                        <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.6 }}>{selected.note}</div>
                      </div>
                    )}

                    <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                      <SectionLabel>Who can read this</SectionLabel>
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        <Note icon="user" tone="green">You, in full, including everything the desk wrote to itself.</Note>
                        <Note icon="users" tone="blue">
                          {selected.assignee ? `${deskWho(selected.assignee)} and the ${deskTeam(selected.assignee)} desk.` : "Whichever desk a person assigns it to."}
                        </Note>
                        <Note icon="x" tone="red">
                          Not {MY_MANAGER.name}. {selected.category} does not route through her, and no category on this desk does.
                        </Note>
                        <Note icon="shield" tone="grey">Every open of this ticket is written to the access log, including yours.</Note>
                      </div>
                    </div>
                  </div>
                </div>

                <Foot icon="shield">
                  {HELPDESK_FIREWALL.rule}
                </Foot>
              </PfCard>
            </div>
          ) : mine.length === 0 ? (
            <Empty
              icon="chat"
              title="You have never raised a request"
              sub="Which is either very good news or a sign that asking felt expensive. Either way, the handbook is searchable without filing anything."
              cta="Ask a question"
              onCta={() => setTab("raise")}
            />
          ) : (
            <Empty
              icon="filter"
              title={`Nothing of yours is ${openFilter === "Needs you" ? "waiting on you" : openFilter === "With HR" ? "with the desk" : "finished"}`}
              sub={`You have ${mine.length} ${mine.length === 1 ? "request" : "requests"} in total. Switch the filter on the left to see the rest of them.`}
              cta="Show everything"
              onCta={() => setOpenFilter("All")}
            />
          )}
        </div>
      )}

      {/* ================================ ANSWERS ============================== */}
      {tab === "answers" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="Answers you already have"
              sub={`${KB_ARTICLES.length} policy cards, ${fmtN(KB_ARTICLES.reduce((a, k) => a + k.views, 0))} reads between them. Searchable without filing anything.`}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {(["Most read", "Best at deflecting"] as KbSort[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setKbSort(s)}
                    style={{
                      fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "5px 11px", borderRadius: 999,
                      color: kbSort === s ? "var(--pf-n900)" : "var(--pf-n500)",
                      background: kbSort === s ? "var(--pf-n0)" : "var(--pf-n25)",
                      border: `1px solid ${kbSort === s ? "var(--pf-n100)" : "var(--pf-n50)"}`,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              <input
                value={kbQuery}
                onChange={(e) => setKbQuery(e.target.value)}
                placeholder="Search the handbook — carry over, RSA PIN, per diem, BOSIET, office days…"
                style={INPUT}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                {(["All", ...TICKET_CATEGORIES] as (TicketCategory | "All")[]).map((c) => {
                  const n = c === "All" ? KB_ARTICLES.length : (ANCHOR_ARTICLES[c] ?? []).length;
                  const active = kbCat === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setKbCat(c)}
                      disabled={n === 0}
                      style={{
                        fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: n === 0 ? "not-allowed" : "pointer",
                        padding: "5px 11px", borderRadius: 999, opacity: n === 0 ? 0.45 : 1,
                        color: active ? "var(--pf-primary-600)" : "var(--pf-n500)",
                        background: active ? "var(--pf-primary-50)" : "var(--pf-n25)",
                        border: `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                      }}
                    >
                      {c} <span style={{ fontFamily: MONO, color: active ? "var(--pf-primary-600)" : "var(--pf-n300)" }}>{n}</span>
                    </button>
                  );
                })}
              </div>
              {kbCat !== "All" && (ANCHOR_ARTICLES[kbCat] ?? []).length > 0 && (
                <div style={{ marginTop: 11 }}>
                  <Note icon="swap" tone="grey">
                    Category filters are read back off the desk: an article belongs to {kbCat} because a {kbCat.toLowerCase()}{" "}
                    question was actually answered from it. IT &amp; devices and Onboarding have no articles here because no
                    question in either has been answered from one yet.
                  </Note>
                </div>
              )}
            </div>
          </PfCard>

          {kbList.length === 0 ? (
            <Empty
              icon="search"
              title={kbQuery.trim() ? `Nothing matches "${kbQuery.trim()}"` : "Nothing in this category yet"}
              sub={`${KB_ARTICLES.length} policy cards, and none of them uses your words. That is worth a ticket — the desk answers what the handbook does not.`}
              cta="Raise a request instead"
              onCta={() => { setTab("raise"); setQuery(kbQuery); setFiling(false); }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {kbList.map((a) => {
                const open = openArticle === a.id;
                const m = kbMatches.find((x) => x.article.id === a.id);
                const mineRelated = a.relatedTickets.filter((id) => MY_SEED_TICKETS.some((t) => t.id === id));
                const othersRelated = a.relatedTickets.length - mineRelated.length;
                const v = votes[a.id];
                return (
                  <PfCard key={a.id}>
                    <button
                      onClick={() => setOpenArticle(open ? null : a.id)}
                      style={{ fontFamily: "inherit", textAlign: "left", width: "100%", cursor: "pointer", background: "none", border: "none", display: "flex", gap: 12, alignItems: "flex-start", padding: "16px 20px" }}
                    >
                      <PfTile icon="book" tone={open ? "green" : "blue"} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{a.title}</span>
                          <PfBadge tone="grey">{a.section}</PfBadge>
                          {kbMatchIds.has(a.id) && m && <PfBadge tone="green" dot>{m.hits.length} word{m.hits.length === 1 ? "" : "s"} matched</PfBadge>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4 }}>
                          {a.owner} · updated {a.updated} · {fmtN(a.views)} reads
                        </div>
                      </div>
                      <div style={{ width: 168, flex: "none" }}>
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>Never filed after reading</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{deflectionRate(a)}%</span>
                        </div>
                        <PfProgress pct={deflectionRate(a)} tone={deflectionRate(a) >= 80 ? "green" : "yellow"} height={6} />
                      </div>
                      <Ic name={open ? "caretdown" : "caretright"} size={15} color="var(--pf-n300)" />
                    </button>

                    {open && (
                      <div style={{ padding: "0 20px 18px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 13.5, color: "var(--pf-n600)", lineHeight: 1.7, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "15px 17px" }}>
                              {kbBody(a.id)}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginTop: 12 }}>
                              {v ? (
                                <PfBadge tone={v === "up" ? "green" : "yellow"} dot>
                                  {v === "up" ? "You marked this helpful" : `Sent to ${a.owner.split("·")[1]?.trim() ?? a.owner}`}
                                </PfBadge>
                              ) : (
                                <>
                                  <PfBtn small variant="secondary" icon="check" onClick={() => vote(a, "up")}>This helped</PfBtn>
                                  <PfBtn small variant="secondary" icon="x" onClick={() => vote(a, "down")}>It did not</PfBtn>
                                </>
                              )}
                              <PfBtn small variant="primary" icon="chat" onClick={() => askAbout(a)}>Ask about this anyway</PfBtn>
                              <span style={{ flex: 1 }} />
                              {m && <MatchBasis m={m} query={kbQuery} />}
                            </div>
                            <div style={{ marginTop: 12 }}>
                              <Note icon="file" tone="grey">
                                This is the handbook&rsquo;s own text, read live from the policy card &mdash; not a copy of it. When{" "}
                                {a.owner.split("·")[1]?.trim() ?? a.owner} changes the policy, this changes with it, and there is no
                                second version to go stale.
                              </Note>
                            </div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                              <SectionLabel>How this article performs</SectionLabel>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {[
                                  { k: "Answered it", v: a.deflected, s: "no ticket followed" },
                                  { k: "Did not", v: a.ticketsAfter, s: "filed anyway" },
                                  { k: "Helpful", v: `${helpfulRate(a)}%`, s: `${a.helpful + a.unhelpful} votes` },
                                  { k: "Reads", v: fmtN(a.views), s: "this year" },
                                ].map((c) => (
                                  <div key={c.k} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "8px 10px" }}>
                                    <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{c.k}</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", marginTop: 1 }}>{c.v}</div>
                                    <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 1 }}>{c.s}</div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 11, padding: "13px 15px" }}>
                              <SectionLabel>Questions answered from it</SectionLabel>
                              {mineRelated.length > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                  {mineRelated.map((id) => {
                                    const t = mine.find((x) => x.id === id);
                                    if (!t) return null;
                                    return (
                                      <button
                                        key={id}
                                        onClick={() => { setTab("open"); setOpenFilter("All"); setSelectedId(id); }}
                                        style={{ fontFamily: "inherit", textAlign: "left", cursor: "pointer", background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "9px 11px", display: "flex", gap: 8, alignItems: "center" }}
                                      >
                                        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: "var(--pf-n400)" }}>{id}</span>
                                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</span>
                                        <PfBadge tone="grey">Yours</PfBadge>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.6 }}>None of yours.</div>
                              )}
                              {othersRelated > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  <Note icon="shield" tone="grey">
                                    {othersRelated} other {othersRelated === 1 ? "person" : "people"} had a question answered from
                                    this article. You get the count and nothing else &mdash; not the subject, not the name, not the
                                    thread. They get the same about you.
                                  </Note>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </PfCard>
                );
              })}
            </div>
          )}

          {/* --------------------------- the deflection case ---------------------- */}
          <PfCard>
            <PfCardHead title="Why the handbook is offered first" sub="The same number read from both sides of the desk" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "16px 20px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 32, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.7px", lineHeight: 1 }}>{KPI.deflected}</span>
                  <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>questions closed by an article</span>
                </div>
                <div style={{ marginTop: 12 }}>
                  <PfProgress pct={KPI.deflectionRate} tone="green" height={9} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--pf-n400)" }}>
                    <span>{KPI.deflectionRate}% read and stopped</span>
                    <span>{100 - KPI.deflectionRate}% read and filed anyway</span>
                  </div>
                </div>
                <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="info" tone="grey">{KPI.kpiNote}</Note>
                  <Note icon="warning" tone="yellow">
                    Read from the desk, that number is efficiency. Read from here it is only good if the answer was actually good
                    &mdash; which is why the &ldquo;It did not&rdquo; button goes to the person who owns the text and not into a
                    satisfaction average.
                  </Note>
                </div>
              </div>
              <div>
                <SectionLabel>The four slowest-deflecting cards</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[...KB_ARTICLES].sort((a, b) => deflectionRate(a) - deflectionRate(b)).slice(0, 4).map((a) => (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
                      <span style={{ width: 110, flex: "none" }}><PfProgress pct={deflectionRate(a)} tone={deflectionRate(a) >= 80 ? "green" : "yellow"} height={6} /></span>
                      <span style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, color: "var(--pf-n900)" }}>{deflectionRate(a)}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 13 }}>
                  <Note icon="trend" tone="grey">
                    Expenses is the worst at 70% and it is not a mystery: 29 people read it and filed anyway. That is a policy that
                    needs rewriting, not employees who need training.
                  </Note>
                </div>
              </div>
            </div>
            <Foot icon="book">
              Every card here is the handbook itself, read through the helpdesk rather than copied into it. {KB_ARTICLES.length} policies,
              one source, and {SLA_POLICY.length} service targets pinned to them &mdash; you can read your own leave rule at 22:00 on a
              Sunday without anyone knowing you asked.
            </Foot>
          </PfCard>
        </div>
      )}

      {/* -------------------------------- page foot ----------------------------- */}
      <div style={{ marginTop: 12 }}>
        <PfCard style={{ background: "var(--pf-n25)" }}>
          <div style={{ display: "flex", gap: 12, padding: "14px 20px", alignItems: "flex-start", flexWrap: "wrap" }}>
            <PfTile icon="lifebuoy" tone="grey" size={30} />
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                {ME_FIRST}, this page is the asking channel and nothing else
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.6 }}>
                It holds {mine.length} of your questions and {NOT_MINE} of other people&rsquo;s that you will never see. It cannot
                open a case, cannot deduct a day, cannot pay you and cannot tell {firstName(MY_MANAGER.name)} that you asked. If a
                request ever appears somewhere you did not expect it, that is a defect &mdash; and{" "}
                <b style={{ color: "var(--pf-n900)" }}>My data &amp; privacy</b> is where you make us answer for it.
              </div>
            </div>
            <PfBtn variant="secondary" icon="calendar" onClick={() => go("myleave")}>My leave</PfBtn>
            <PfBtn variant="secondary" icon="shield" onClick={() => go("myprivacy")}>My data &amp; privacy</PfBtn>
          </div>
        </PfCard>
      </div>
    </div>
  );
}
