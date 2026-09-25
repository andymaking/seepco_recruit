"use client";
import { useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfBanner, PfPageTabs, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_SKIP, MY_FEEDBACK, MY_FEEDBACK_GIVEN,
  canSubjectSee, MY_VISIBILITY, MY_PLAN, MY_CYCLE, type MyFeedbackItem,
} from "@/data/me";

/**
 * My feedback — the subject's side of the feedback stream (PRD FR-069, §7).
 *
 * /feedback-hub renders the WHOLE org stream and filters it by type, never by
 * viewer — which is why peer-to-peer notes between other people, several of them
 * marked "Private to them", are readable there today. This page filters by
 * VIEWER first: every note on it ran through `canSubjectSee` from @/data/me, so
 * the only items that can reach the screen are notes she was sent or wrote.
 * There is no org stream, no team scoreboard and no colleague directory here —
 * the recipient picker is derived from people she has already exchanged
 * feedback with, so the page cannot become a roster.
 */

/* -------------------------------- constants -------------------------------- */

type TypeFilter = "All" | "Praise" | "Constructive";
type Visibility = "Private to them" | "Them + their manager";

const VISIBILITIES: Visibility[] = ["Private to them", "Them + their manager"];

/** The same 5-point taxonomy as your interview scorecards and review packet. */
const COMPETENCIES = [
  "Technical depth", "Technical leadership", "Execution & ownership",
  "Collaboration", "Communication", "Mentoring",
] as const;
type Competency = (typeof COMPETENCIES)[number];

type Counterparty = { name: string; init: string; tone: string; rel: string };

/**
 * Derived, never listed: the only people this page can name are people already
 * on a note she is party to. `init`/`tone` on a MyFeedbackItem always belong to
 * the OTHER party, which is what makes this derivation safe.
 */
const COUNTERPARTIES: Counterparty[] = (() => {
  const seen = new Map<string, Counterparty>();
  for (const f of [...MY_FEEDBACK, ...MY_FEEDBACK_GIVEN]) {
    const other = f.giver === ME_PUBLIC.name ? f.receiver : f.giver;
    if (other === ME_PUBLIC.name || seen.has(other)) continue;
    seen.set(other, { name: other, init: f.init, tone: f.tone, rel: f.rel ?? "Colleague" });
  }
  return [...seen.values()];
})();

const byName = (n: string): Counterparty | undefined => COUNTERPARTIES.find((c) => c.name === n);

const initialsOf = (n: string) => n.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/** Situation · behaviour · impact — the scaffold, not the words. You write the words. */
const SBI = [
  { label: "Situation", hint: "one moment, not a pattern", line: "When we [the moment — a review, an incident, a launch]," },
  { label: "Behaviour", hint: "what you saw, not who they are", line: "you [what they actually did]," },
  { label: "Impact", hint: "the part they can act on", line: "which meant [what changed because of it]." },
];

/** Inclusive-language check — the model flags coded wording, you decide what ships. */
const LANGUAGE_FLAGS: { w: string; tip: string }[] = [
  { w: "aggressive", tip: "reads as a verdict on the person — name the behaviour instead, e.g. “pushed the decision before the team had aligned”." },
  { w: "bossy", tip: "frequently gendered coding — describe the impact instead, e.g. “set direction without gathering input”." },
  { w: "abrasive", tip: "a label rather than an observation — cite the moment and what it affected." },
  { w: "emotional", tip: "vague and often coded — say what happened and what outcome it changed." },
];

/** The two rows of the transparency matrix that govern THIS page. */
const FEEDBACK_VISIBILITY = MY_VISIBILITY.filter((v) => v.item.toLowerCase().startsWith("feedback"));

/** The one row that governs what you WRITE — the only thing on your record HR cannot open. */
const GIVE_ROW = FEEDBACK_VISIBILITY.find((v) => v.item.toLowerCase().includes("you give"));

type Who = "sees" | "sees-summary" | "no";
const WHO_LABEL: Record<Who, string> = { sees: "Sees it", "sees-summary": "Summary only", no: "Cannot see it" };
const WHO_TONE: Record<Who, PfTone> = { sees: "blue", "sees-summary": "yellow", no: "green" };

/** `canSubjectSee`, said in words — rendered per note so the rule is legible. */
const whySeen = (f: MyFeedbackItem): string => {
  if (f.receiver !== ME_PUBLIC.name) {
    return `You wrote it. It sits on ${f.receiver}’s timeline and in your own record — your manager and HR never see feedback you give.`;
  }
  if (f.visibility === "Private to them") {
    return `Marked “Private to them” — and “them” is you. Only you and ${f.giver} can open this note; it is not on your manager’s screen, and not on HR’s.`;
  }
  return `Marked “${f.visibility}” — you and your manager can both read it, and it is summarised into your review packet.`;
};

const isNew = (t: string) => t.includes("ago");

const fieldStyle = {
  fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "8px 11px", outline: "none",
} as const;

/* ------------------------------- small pieces ------------------------------ */

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
        transition: "background .12s ease, border-color .12s ease",
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "none" }} />}
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 7 }}>{children}</div>;
}

/** Soft explainer strip — the "why you can see this" body of a note. */
function WhyStrip({ children, icon = "shield", cite }: { children: React.ReactNode; icon?: string; cite?: string }) {
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "10px 12px", marginTop: 10 }}>
      <Ic name={icon} size={14} color="var(--pf-n400)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>{children}</div>
        {cite && <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 4 }}>{cite}</div>}
      </div>
    </div>
  );
}

function ActionChip({ label, icon, tone = "grey", done, onClick }: { label: string; icon: string; tone?: PfTone; done?: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const t = TONE[tone];
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500,
        color: done ? "var(--pf-primary-600)" : hovered ? t.fg : "var(--pf-n500)",
        background: done ? "var(--pf-primary-50)" : hovered ? t.soft : "var(--pf-n25)",
        border: `1px solid ${done ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
        padding: "4px 10px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1.35,
        transition: "background .12s ease, color .12s ease",
      }}
    >
      <Ic name={done ? "check" : icon} size={11} />
      {label}
    </button>
  );
}

/* -------------------------------- note cards ------------------------------- */

function ReceivedCard({ f, open, onWhy, onThanks, onAgenda, agendaDone, onCite }: {
  f: MyFeedbackItem; open: boolean; onWhy: () => void; onThanks: () => void;
  onAgenda: () => void; agendaDone: boolean; onCite: () => void;
}) {
  return (
    <PfCard>
      <div style={{ display: "flex", gap: 11, padding: "14px 16px" }}>
        <PfAvatar init={f.init} tone={f.tone} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{f.giver}</span>
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{f.rel}</span>
            <span style={{ flex: 1 }} />
            {isNew(f.time) && <PfBadge tone="green" dot>New</PfBadge>}
            <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{f.time}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <PfBadge tone="grey">{f.competency}</PfBadge>
            <PfBadge tone={f.type === "Praise" ? "green" : "yellow"} dot>{f.type}</PfBadge>
            <button
              onClick={onWhy}
              title="Why this note is on your page"
              style={{
                fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500,
                color: open ? "var(--pf-n900)" : "var(--pf-n400)", background: open ? "var(--pf-n50)" : "transparent",
                border: "1px solid var(--pf-n50)", borderRadius: 999, padding: "2px 8px", cursor: "pointer", lineHeight: 1.4,
              }}
            >
              <Ic name="shield" size={12} />
              {f.visibility}
              <Ic name={open ? "caretdown" : "caretright"} size={10} />
            </button>
          </div>

          <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 10 }}>{f.text}</div>

          {open && (
            <WhyStrip cite={`Rule applied once in @/data/me · note ${f.id}`}>
              <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Why you can see this: </span>
              {whySeen(f)}
            </WhyStrip>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
            <ActionChip label={`Thank ${f.giver.split(" ")[0]}`} icon="heart" tone="green" onClick={onThanks} />
            <ActionChip
              label={agendaDone ? "On your 1-on-1 agenda" : "Bring to your 1-on-1"}
              icon="chat" tone="blue" done={agendaDone} onClick={onAgenda}
            />
            <ActionChip label="Cite in your self-assessment" icon="clipboard" tone="purple" onClick={onCite} />
          </div>
        </div>
      </div>
    </PfCard>
  );
}

function GivenCard({ to, init, tone, rel, competency, type, visibility, time, text, why }: {
  to: string; init: string; tone: string; rel?: string; competency: string;
  type?: "Praise" | "Constructive"; visibility?: string; time: string; text: string; why: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PfCard>
      <div style={{ display: "flex", gap: 11, padding: "14px 16px" }}>
        <PfAvatar init={init} tone={tone} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>To</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{to}</span>
            {rel && <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{rel}</span>}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{time}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <PfBadge tone="grey">{competency}</PfBadge>
            {type && <PfBadge tone={type === "Praise" ? "green" : "yellow"} dot>{type}</PfBadge>}
            {visibility && (
              <button
                onClick={() => setOpen((o) => !o)}
                style={{
                  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500,
                  color: open ? "var(--pf-n900)" : "var(--pf-n400)", background: open ? "var(--pf-n50)" : "transparent",
                  border: "1px solid var(--pf-n50)", borderRadius: 999, padding: "2px 8px", cursor: "pointer", lineHeight: 1.4,
                }}
              >
                <Ic name="shield" size={12} />
                {visibility}
                <Ic name={open ? "caretdown" : "caretright"} size={10} />
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 10 }}>{text}</div>
          {open && <WhyStrip icon="paperplane">{why}</WhyStrip>}
        </div>
      </div>
    </PfCard>
  );
}

/* ------------------------------ side-rail cards ---------------------------- */

function SourceRow({ c, count, last, active, onClick }: {
  c: Counterparty; count: number; last: boolean; active: boolean; onClick: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        padding: "10px 16px", border: "none", borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        background: active ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "transparent",
        transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfAvatar init={c.init} tone={c.tone} size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.rel}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: active ? "var(--pf-primary-600)" : "var(--pf-n600)", flex: "none" }}>{count}</span>
      </div>
      <div style={{ marginTop: 7 }}><PfProgress pct={(count / 2) * 100} height={4} tone={active ? "green" : "grey"} /></div>
    </button>
  );
}

function NextTile({ icon, tone, title, sub, onClick, last }: { icon: string; tone: PfTone; title: string; sub: string; onClick: () => void; last?: boolean }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", fontFamily: "inherit",
        padding: "11px 16px", border: "none", borderBottom: last ? "none" : "1px solid var(--pf-n50)", cursor: "pointer",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <PfTile icon={icon} tone={tone} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{sub}</div>
      </div>
      <Ic name="arrowright" size={14} color={hovered ? "var(--pf-n600)" : "var(--pf-n300)"} />
    </button>
  );
}

/* --------------------------------- picker ---------------------------------- */

function PersonPicker({ label, picked, onPick, custom, onCustom, hint }: {
  label: string; picked: string | null; onPick: (n: string | null) => void;
  custom: string; onCustom: (v: string) => void; hint: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {COUNTERPARTIES.map((c) => (
          <Chip
            key={c.name}
            label={c.name}
            dot={c.tone}
            active={picked === c.name}
            onClick={() => { onPick(picked === c.name ? null : c.name); onCustom(""); }}
          />
        ))}
        <input
          value={custom}
          onChange={(e) => { onCustom(e.target.value); if (e.target.value) onPick(null); }}
          placeholder="or type any name…"
          style={{ ...fieldStyle, width: 190, borderRadius: 999, padding: "6px 14px", fontSize: 12.5 }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8 }}>
        <Ic name="info" size={12} color="var(--pf-n300)" />
        {hint}
      </div>
    </div>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function MyFeedback() {
  const go = useGo();
  const toast = useToast();
  const { feedbackSent, fbRequests, agendaAdds, sendFeedback, requestFeedback, addAgendaItem } = useMe();

  const [tab, setTab] = useState("received");

  /* Received */
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("All");
  const [fromFilter, setFromFilter] = useState<string | null>(null);
  /** The newest note opens explaining itself — the point of the page in one glance. */
  const [whyOpen, setWhyOpen] = useState<string[]>(["F-106"]);

  /* Give composer */
  const [gPicked, setGPicked] = useState<string | null>(null);
  const [gCustom, setGCustom] = useState("");
  const [gComp, setGComp] = useState<Competency | null>(null);
  const [gType, setGType] = useState<"Praise" | "Constructive">("Praise");
  const [gText, setGText] = useState("");
  const [gVis, setGVis] = useState<Visibility>("Private to them");
  const [gKeep, setGKeep] = useState(false);
  const [sentMeta, setSentMeta] = useState<Record<string, { type: "Praise" | "Constructive"; visibility: Visibility }>>({});

  /* Request composer */
  const [rPicked, setRPicked] = useState<string | null>(null);
  const [rCustom, setRCustom] = useState("");
  const [rComp, setRComp] = useState<Competency | null>(null);
  const [reqMeta, setReqMeta] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);

  /* ------------------------------ derived data ----------------------------- */

  /** The whole point: viewer-scoped BEFORE anything else touches the list. */
  const received = useMemo(() => MY_FEEDBACK.filter(canSubjectSee).filter((f) => f.receiver === ME_PUBLIC.name), []);
  const givenSeed = useMemo(() => MY_FEEDBACK_GIVEN.filter(canSubjectSee), []);

  const shown = useMemo(
    () => received.filter((f) => (typeFilter === "All" || f.type === typeFilter) && (!fromFilter || f.giver === fromFilter)),
    [received, typeFilter, fromFilter],
  );

  const sources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of received) counts.set(f.giver, (counts.get(f.giver) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ c: byName(name) ?? { name, init: "?", tone: "#475569", rel: "Colleague" }, count }))
      .sort((a, b) => b.count - a.count);
  }, [received]);

  const givenCount = givenSeed.length + feedbackSent.length;
  const givenPeople = new Set([...givenSeed.map((f) => f.receiver), ...feedbackSent.map((s) => s.to)]).size;
  const constructive = received.filter((f) => f.type === "Constructive").length;

  const gTo = (gCustom.trim() || gPicked || "").trim();
  const rTo = (rCustom.trim() || rPicked || "").trim();

  const flags = useMemo(() => {
    const t = gText.toLowerCase();
    return LANGUAGE_FLAGS.filter((f) => t.includes(f.w));
  }, [gText]);

  /** Everything the send button checks, said once — the preview badge reads the same rule. */
  const draftReady = Boolean(gTo && gComp && gText.trim().length > 11 && (flags.length === 0 || gKeep));

  const suggestions = useMemo(
    () => [
      {
        id: "S-1", from: MY_SKIP.name, competency: "Communication" as Competency,
        insight: `Your May note from ${MY_SKIP.name} asked for more of your design-doc framing in cross-team forums — you have run two since, and nothing has come back on it.`,
        ask: "Ask whether the last two forums landed.",
        evidence: "your own note F-094 · Communication · May 2026", confidence: 81,
      },
      {
        id: "S-2", from: MY_MANAGER.name, competency: "Technical leadership" as Competency,
        insight: `Technical leadership is the open competency on your ${MY_PLAN.target} plan, and your most recent note on it is from July.`,
        ask: "Ask for a read before the cycle closes.",
        evidence: `your ${MY_PLAN.track} plan · sponsor ${MY_PLAN.sponsor}`, confidence: 74,
      },
    ].filter((s) => !dismissed.includes(s.id) && !fbRequests.some((r) => r.from === s.from)),
    [dismissed, fbRequests],
  );

  /* -------------------------------- handlers ------------------------------- */

  const toggleWhy = (id: string) => setWhyOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  const agendaLabel = (f: MyFeedbackItem) => `Feedback from ${f.giver} — ${f.competency}`;

  const toAgenda = (f: MyFeedbackItem) => {
    const label = agendaLabel(f);
    if (agendaAdds.includes(label)) { toast(`Already on your 1-on-1 agenda — ${f.competency} note from ${f.giver}.`); return; }
    addAgendaItem(label);
    toast(`Added to your next 1-on-1 agenda — ${f.giver}’s ${f.competency} note.`, "success");
  };

  const send = () => {
    if (!gTo) { toast("Pick who this note is for, or type a name."); return; }
    if (!gComp) { toast("Tag a competency — same taxonomy as your review packet."); return; }
    if (gText.trim().length < 12) { toast("Add a specific observation — situation, behaviour, impact."); return; }
    if (flags.length > 0 && !gKeep) {
      toast(`Inclusive-language check flagged “${flags[0].w}” — rewrite it, or choose Send as written.`, "ai");
      setGKeep(true);
      return;
    }
    sendFeedback(gTo, gComp, gText.trim());
    setSentMeta((m) => ({ ...m, [`${gTo}|${gText.trim()}`]: { type: gType, visibility: gVis } }));
    toast(`Feedback sent to ${gTo} — ${gVis.toLowerCase()}. Your manager and HR do not see notes you give.`, "success");
    setGPicked(null); setGCustom(""); setGComp(null); setGText(""); setGType("Praise"); setGVis("Private to them"); setGKeep(false);
  };

  const insertScaffold = () => {
    const scaffold = SBI.map((s) => s.line).join(" ");
    setGText((t) => (t.trim() ? `${t.trim()}\n${scaffold}` : scaffold));
    setGKeep(false);
    toast("Scaffold dropped in — swap the brackets for the moment you actually saw.", "ai");
  };

  const ask = (name: string, competency: Competency | null) => {
    if (!name) { toast("Pick who to ask, or type a name."); return; }
    if (fbRequests.some((r) => r.from === name)) { toast(`You already have an open request with ${name} — nudge it instead.`); return; }
    requestFeedback(name);
    if (competency) setReqMeta((m) => ({ ...m, [name]: competency }));
    toast(`Request sent to ${name}${competency ? ` — ${competency}` : ""}. They see your name on it; nothing here is anonymous.`, "success");
  };

  const segBtn = (label: "Praise" | "Constructive"): React.CSSProperties => {
    const active = gType === label;
    const t = label === "Praise" ? TONE.green : TONE.yellow;
    return {
      fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
      border: `1px solid ${active ? "transparent" : "var(--pf-n100)"}`,
      background: active ? t.soft : "var(--pf-n0)", color: active ? t.fg : "var(--pf-n500)",
      display: "inline-flex", alignItems: "center", gap: 6, lineHeight: 1.3,
    };
  };

  /* ---------------------------------- view --------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- Header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your feedback</span>
            <PfBadge tone="green" dot>Only notes you are on</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Everything written to you, and everything you have written. Notes between other people never reach this page &mdash; and nothing here is anonymous.
          </div>
        </div>
        <PfBtn variant="secondary" icon="megaphone" onClick={() => { setTab("requests"); toast("Pick who to ask — they will see your name and what you asked for."); }}>
          Request feedback
        </PfBtn>
        <PfBtn variant="primary" icon="chat" onClick={() => { setTab("given"); toast("Composer ready — be specific: situation, behaviour, impact."); }}>
          Give feedback
        </PfBtn>
      </div>

      {/* -------------------------------- Your counts ------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginTop: 16 }}>
        <PfStat icon="megaphone" tone="green" label="Received" value={received.length} unit="notes" delta={`newest · ${received[0]?.time ?? "—"}`} deltaTone="blue" />
        <PfStat icon="paperplane" tone="blue" label="Given" value={givenCount} unit="written" delta={`${givenPeople} ${givenPeople === 1 ? "person" : "people"}`} deltaTone="grey" />
        <PfStat icon="chat" tone="purple" label="Constructive" value={constructive} unit={`of ${received.length}`} delta="the asks" deltaTone="grey" />
        <PfStat icon="clock" tone="yellow" label="Open requests" value={fbRequests.length} unit="waiting" delta="never anonymous" deltaTone="grey" />
      </div>

      {/* -------------------------------- Page tabs ------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "received", label: "Received", count: String(received.length) },
            { key: "given", label: "Given", count: String(givenCount) },
            { key: "requests", label: "Requests", count: fbRequests.length ? String(fbRequests.length) : undefined },
          ]}
        />
      </div>

      {/* ================================ RECEIVED =============================== */}
      {tab === "received" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 316px", gap: 12, alignItems: "start" }}>
          {/* ------------------------------ note stream ----------------------------- */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfBanner tone="green" icon="shield" cta="open" onCta={() => go("myprivacy")}>
              <span style={{ fontWeight: 600 }}>Filtered by viewer, not by type. </span>
              <span style={{ fontWeight: 400 }}>
                Every note below is one you were sent or wrote &mdash; the check runs once, in your record, before the page draws.
              </span>
            </PfBanner>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {(["All", "Praise", "Constructive"] as TypeFilter[]).map((t) => (
                <Chip
                  key={t}
                  label={t}
                  dot={t === "Praise" ? TONE.green.bg : t === "Constructive" ? TONE.yellow.bg : undefined}
                  active={typeFilter === t}
                  onClick={() => setTypeFilter(t)}
                />
              ))}
              {fromFilter && (
                <Chip label={`From ${fromFilter} ×`} active onClick={() => setFromFilter(null)} />
              )}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                {shown.length} of {received.length} shown
              </span>
            </div>

            {shown.map((f) => (
              <ReceivedCard
                key={f.id}
                f={f}
                open={whyOpen.includes(f.id)}
                onWhy={() => toggleWhy(f.id)}
                onThanks={() => toast(`Thank-you sent to ${f.giver} — re: your ${f.competency.toLowerCase()} note.`, "success")}
                onAgenda={() => toAgenda(f)}
                agendaDone={agendaAdds.includes(agendaLabel(f))}
                onCite={() => { go("myreview"); toast(`Carried into your self-assessment draft — ${f.giver}’s ${f.competency.toLowerCase()} note.`); }}
              />
            ))}

            {shown.length === 0 && (
              <PfCard pad="26px 20px">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, textAlign: "center" }}>
                  <PfTile icon="filter" tone="grey" size={34} />
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing matches that filter</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", maxWidth: 340, lineHeight: 1.55 }}>
                    You have {received.length} notes in total. Clear the filters to see all of them.
                  </div>
                  <PfBtn small variant="secondary" onClick={() => { setTypeFilter("All"); setFromFilter(null); }}>Clear filters</PfBtn>
                </div>
              </PfCard>
            )}
          </div>

          {/* -------------------------------- side rail ------------------------------ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfCard>
              <PfCardHead title="Who wrote to you" sub="Tap a name to filter your notes." />
              {sources.map((s, i) => (
                <SourceRow
                  key={s.c.name}
                  c={s.c}
                  count={s.count}
                  last={i === sources.length - 1}
                  active={fromFilter === s.c.name}
                  onClick={() => setFromFilter(fromFilter === s.c.name ? null : s.c.name)}
                />
              ))}
            </PfCard>

            <PfCard>
              <PfCardHead title="Where your feedback goes" sub="Two rows from your transparency record." />
              {FEEDBACK_VISIBILITY.map((v, i) => (
                <div key={v.item} style={{ padding: "12px 16px", borderBottom: i === FEEDBACK_VISIBILITY.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{v.item}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    <PfBadge tone={WHO_TONE[v.manager]}>Manager &middot; {WHO_LABEL[v.manager]}</PfBadge>
                    <PfBadge tone={WHO_TONE[v.hr]}>HR &middot; {WHO_LABEL[v.hr]}</PfBadge>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.55 }}>{v.why}</div>
                  <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 5 }}>Cited from {v.source}</div>
                </div>
              ))}
              <button
                onClick={() => go("myprivacy")}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 16px", background: "var(--pf-n25)", border: "none", borderTop: "1px solid var(--pf-n50)", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--pf-n500)" }}
              >
                <Ic name="shield" size={13} color="var(--pf-n400)" /> All 12 rows in your data &amp; privacy page
                <span style={{ flex: 1 }} />
                <Ic name="arrowright" size={13} color="var(--pf-n300)" />
              </button>
            </PfCard>

            <PfCard>
              <PfCardHead title="What to do with it" sub="Feedback is only worth what it changes." />
              <NextTile
                icon="clipboard" tone="blue" title="Your self-assessment"
                sub="Quote these notes as evidence"
                onClick={() => { go("myreview"); toast("Opening your self-assessment — your received notes sit beside the competency scale."); }}
              />
              <NextTile
                icon="target" tone="purple" title={`Your ${MY_PLAN.target} plan`}
                sub="Map the constructive note to a gap"
                onClick={() => { go("mygrowth"); toast(`Opening your growth plan — ${MY_PLAN.track}.`); }}
              />
              <NextTile
                last
                icon="chat" tone="green" title="Your next 1-on-1"
                sub={agendaAdds.length ? `${agendaAdds.length} item${agendaAdds.length > 1 ? "s" : ""} you added` : "Add a note to the agenda"}
                onClick={() => { go("myoneonones"); toast(`Opening your 1-on-1 with ${MY_MANAGER.name}.`); }}
              />
            </PfCard>
          </div>
        </div>
      )}

      {/* ================================= GIVEN ================================= */}
      {tab === "given" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 316px", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* ------------------------------- composer ------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Write feedback to someone"
              sub="Specific beats kind: situation, behaviour, impact. You choose who else can read it."
            >
              <PfBadge tone="grey">Your name is on it</PfBadge>
            </PfCardHead>

            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <PersonPicker
                label="To"
                picked={gPicked}
                onPick={setGPicked}
                custom={gCustom}
                onCustom={setGCustom}
                hint="These are people you have already exchanged feedback with — Talent OS does not hand you a colleague directory."
              />

              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <FieldLabel>Competency</FieldLabel>
                  <button
                    onClick={() => toast("One taxonomy end to end — the competencies you score yourself against are the same ids used here.")}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, color: "var(--pf-n400)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 7 }}
                  >
                    <Ic name="info" size={12} /> same taxonomy as your review packet
                  </button>
                </div>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {COMPETENCIES.map((c) => (
                    <Chip key={c} label={c} active={gComp === c} onClick={() => setGComp(gComp === c ? null : c)} />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Type</FieldLabel>
                <div style={{ display: "flex", gap: 7 }}>
                  <button style={segBtn("Praise")} onClick={() => setGType("Praise")}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE.green.bg }} /> Praise
                  </button>
                  <button style={segBtn("Constructive")} onClick={() => setGType("Constructive")}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE.yellow.bg }} /> Constructive
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel>Note</FieldLabel>
                <textarea
                  value={gText}
                  onChange={(e) => { setGText(e.target.value); setGKeep(false); }}
                  placeholder={gType === "Praise" ? "What did they do, and what did it change?" : "What did you observe, and what would you like instead?"}
                  style={{
                    width: "100%", minHeight: 84, resize: "vertical", boxSizing: "border-box", background: "var(--pf-n0)",
                    border: `1px solid ${flags.length ? "var(--pf-yellow-100)" : "var(--pf-n100)"}`, borderRadius: 9,
                    padding: "10px 12px", fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.55, outline: "none",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>{gText.trim().length} characters</span>
                  <span style={{ flex: 1 }} />
                  {flags.length === 0 && gText.trim().length > 11 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-primary-600)" }}>
                      <Ic name="check" size={12} color="var(--pf-primary-500)" /> Language check clear
                    </span>
                  )}
                </div>

                {flags.length > 0 && (
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 9, padding: "10px 12px", marginTop: 8 }}>
                    <Ic name="warning" size={14} color="var(--pf-yellow-500)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                        <span style={{ fontWeight: 700, color: "var(--pf-n900)" }}>&ldquo;{flags[0].w}&rdquo; </span>
                        {flags[0].tip}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 5 }}>
                        Inclusive-language check &middot; runs before send, never after &middot; it suggests, you decide.
                      </div>
                      <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                        <PfBtn small variant="secondary" onClick={() => { setGText(gText.replace(new RegExp(flags[0].w, "ig"), "")); setGKeep(false); toast(`Removed “${flags[0].w}” — add the behaviour you actually saw in its place.`, "ai"); }}>
                          Take it out
                        </PfBtn>
                        <PfBtn small variant="ghost" onClick={() => { setGKeep(true); toast("Kept as written — your call. The flag is not stored against you."); }}>
                          {gKeep ? "Kept as written" : "Keep as written"}
                        </PfBtn>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>Who can read it</FieldLabel>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {VISIBILITIES.map((v) => (
                    <Chip key={v} label={v} active={gVis === v} onClick={() => setGVis(v)} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8 }}>
                  <Ic name="shield" size={12} color="var(--pf-n300)" />
                  {gVis === "Private to them"
                    ? `Only ${gTo || "the person you pick"} can open it. Your manager and HR cannot.`
                    : `${gTo || "The person you pick"} and their manager can open it. Yours still cannot.`}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--pf-n50)", paddingTop: 13, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1, minWidth: 200 }}>
                  Lands on their timeline with your name on it &mdash; nothing here is anonymous, per PRD &sect;7.
                </span>
                <PfBtn
                  variant="ghost"
                  onClick={() => { setGPicked(null); setGCustom(""); setGComp(null); setGText(""); setGKeep(false); toast("Draft cleared."); }}
                >
                  Clear
                </PfBtn>
                <PfBtn variant="primary" icon="paperplane" onClick={send}>
                  {flags.length > 0 && gKeep ? "Send as written" : "Send feedback"}
                </PfBtn>
              </div>
            </div>
          </PfCard>

          {/* ------------------------------ what you sent ---------------------------- */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 2 }}>
            <PfTile icon="paperplane" tone="blue" size={26} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Notes you have written</span>
            <PfBadge tone="grey">{givenCount}</PfBadge>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Newest first</span>
          </div>

          {feedbackSent.map((s, i) => {
            const c = byName(s.to);
            const meta = sentMeta[`${s.to}|${s.text}`];
            return (
              <GivenCard
                key={`sent-${i}-${s.at}`}
                to={s.to}
                init={c?.init ?? initialsOf(s.to)}
                tone={c?.tone ?? "#0A84FF"}
                rel={c?.rel}
                competency={s.competency}
                type={meta?.type}
                visibility={meta?.visibility}
                time={s.at}
                text={s.text}
                why={`Sent from this page. It sits on ${s.to}’s timeline and in your own record — feedback you give is the one thing on your record your manager and HR cannot read.`}
              />
            );
          })}

          {givenSeed.map((f) => (
            <GivenCard
              key={f.id}
              to={f.receiver}
              init={f.init}
              tone={f.tone}
              rel={f.rel}
              competency={f.competency}
              type={f.type}
              visibility={f.visibility}
              time={f.time}
              text={f.text}
              why={whySeen(f)}
            />
          ))}

          <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "12px 16px", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 12 }}>
            <Ic name="shield" size={15} color="var(--pf-n400)" />
            <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Feedback you give is yours. </span>
              {GIVE_ROW?.why ?? "It goes to the person you wrote it about, and nobody else."}
            </div>
          </div>
          </div>

          {/* -------------------------------- side rail ------------------------------ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            {/* live preview — the note as the recipient will read it */}
            <PfCard>
              <PfCardHead title="As they will read it" sub="Your draft, on their screen.">
                <PfBadge tone={draftReady ? "green" : "grey"} dot={draftReady}>{draftReady ? "Ready" : "Draft"}</PfBadge>
              </PfCardHead>
              <div style={{ padding: "13px 16px" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <PfAvatar init={ME_PUBLIC.init} tone={ME_PUBLIC.tone} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{ME_PUBLIC.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{gTo ? `to ${gTo.split(" ")[0]}` : "to whoever you pick"}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
                      <PfBadge tone="grey">{gComp ?? "no competency yet"}</PfBadge>
                      <PfBadge tone={gType === "Praise" ? "green" : "yellow"} dot>{gType}</PfBadge>
                    </div>
                    <div style={{ fontSize: 12.5, color: gText.trim() ? "var(--pf-n600)" : "var(--pf-n300)", lineHeight: 1.6, marginTop: 9, fontStyle: gText.trim() ? "normal" : "italic" }}>
                      {gText.trim() || "Your words land here, exactly as you type them — no model rewrites them on the way."}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                <Ic name="shield" size={13} color="var(--pf-n300)" />
                {gVis === "Private to them" ? "Only they can open it — your manager and HR cannot." : "They and their manager can open it — yours still cannot."}
              </div>
            </PfCard>

            {/* the scaffold, not the words */}
            <PfCard>
              <PfCardHead title="Situation · behaviour · impact" sub="The shape of a note worth reading." />
              {SBI.map((s, i) => (
                <div key={s.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 16px", borderBottom: i === SBI.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--pf-n50)", color: "var(--pf-n500)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.label}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.5 }}>{s.hint}</div>
                  </div>
                </div>
              ))}
              <button
                onClick={insertScaffold}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 16px", background: "var(--pf-purple-50)", border: "none", borderTop: "1px solid var(--pf-n50)", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--pf-purple-500)" }}
              >
                <Ic name="sparkle" size={13} color="var(--pf-purple-500)" /> Drop the scaffold into your draft
                <span style={{ flex: 1 }} />
                <Ic name="arrowright" size={13} color="var(--pf-purple-500)" />
              </button>
            </PfCard>

            {/* where a note you give travels */}
            {GIVE_ROW && (
              <PfCard>
                <PfCardHead title="Where it goes" sub="One row from your transparency record." />
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{GIVE_ROW.item}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    <PfBadge tone={WHO_TONE[GIVE_ROW.manager]}>Your manager &middot; {WHO_LABEL[GIVE_ROW.manager]}</PfBadge>
                    <PfBadge tone={WHO_TONE[GIVE_ROW.hr]}>HR &middot; {WHO_LABEL[GIVE_ROW.hr]}</PfBadge>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 8 }}>Cited from {GIVE_ROW.source}</div>
                </div>
                <button
                  onClick={() => go("myprivacy")}
                  style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "10px 16px", background: "var(--pf-n25)", border: "none", borderTop: "1px solid var(--pf-n50)", cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--pf-n500)" }}
                >
                  <Ic name="shield" size={13} color="var(--pf-n400)" /> All 12 rows in your privacy page
                  <span style={{ flex: 1 }} />
                  <Ic name="arrowright" size={13} color="var(--pf-n300)" />
                </button>
              </PfCard>
            )}
          </div>
        </div>
      )}

      {/* =============================== REQUESTS ================================ */}
      {tab === "requests" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 316px", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfBanner tone="purple" icon="user" cta="open" onCta={() => go("myprivacy")}>
            <span style={{ fontWeight: 600 }}>Nothing here is anonymous. </span>
            <span style={{ fontWeight: 400 }}>
              Whoever you ask sees your name and what you asked for, and their reply arrives with their name on it &mdash; PRD &sect;7.
            </span>
          </PfBanner>

          {/* ------------------------------- ask someone ----------------------------- */}
          <PfCard>
            <PfCardHead title="Ask for feedback" sub="Name the competency you want a read on — vague asks get vague answers." />
            <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
              <PersonPicker
                label="Ask"
                picked={rPicked}
                onPick={setRPicked}
                custom={rCustom}
                onCustom={setRCustom}
                hint="Only you and the person you ask can see the request — it is not routed through your manager."
              />
              <div>
                <FieldLabel>What you want a read on</FieldLabel>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {COMPETENCIES.map((c) => (
                    <Chip key={c} label={c} active={rComp === c} onClick={() => setRComp(rComp === c ? null : c)} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--pf-n50)", paddingTop: 13, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1, minWidth: 200 }}>
                  They get an in-app and WhatsApp nudge; the reply lands in your Received tab.
                </span>
                <PfBtn
                  variant="primary"
                  icon="megaphone"
                  onClick={() => { ask(rTo, rComp); setRPicked(null); setRCustom(""); setRComp(null); }}
                >
                  Send request
                </PfBtn>
              </div>
            </div>
          </PfCard>

          {/* ----------------------------- pending requests -------------------------- */}
          <PfCard>
            <PfCardHead title="Waiting on a reply" sub="Yours only — requests other people make are not on this page.">
              <PfBadge tone={fbRequests.length ? "yellow" : "grey"}>{fbRequests.length} open</PfBadge>
            </PfCardHead>

            {fbRequests.length === 0 ? (
              <div style={{ padding: "26px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, textAlign: "center" }}>
                <PfTile icon="clock" tone="grey" size={34} />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>No open requests</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", maxWidth: 380, lineHeight: 1.55 }}>
                  Feedback you ask for is usually more useful than feedback you wait for. Pick a competency above, or take one of the suggestions below.
                </div>
                <PfBtn small variant="secondary" icon="megaphone" onClick={() => ask(MY_MANAGER.name, "Technical leadership")}>
                  Ask {MY_MANAGER.name}
                </PfBtn>
              </div>
            ) : (
              fbRequests.map((r, i) => {
                const c = byName(r.from);
                return (
                  <div
                    key={`${r.from}-${i}`}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: i === fbRequests.length - 1 ? "none" : "1px solid var(--pf-n50)", flexWrap: "wrap" }}
                  >
                    <PfAvatar init={c?.init ?? initialsOf(r.from)} tone={c?.tone ?? "#AF52DE"} size={28} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.from}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{c?.rel ?? "Asked directly"} &middot; requested {r.at}</div>
                    </div>
                    {reqMeta[r.from] && <PfBadge tone="grey">{reqMeta[r.from]}</PfBadge>}
                    <PfBadge tone="yellow" dot>Waiting</PfBadge>
                    <span style={{ flex: 1 }} />
                    <PfBtn small variant="secondary" icon="bell" onClick={() => toast(`Nudge sent to ${r.from} — in-app and WhatsApp, re: your request from ${r.at}.`, "success")}>
                      Nudge
                    </PfBtn>
                  </div>
                );
              })
            )}
          </PfCard>

          {/* ------------------------------ suggested asks --------------------------- */}
          {suggestions.length > 0 && (
            <PfCard>
              <PfCardHead title="Two asks worth making" sub="Drawn from your own notes and your own plan — nothing about anyone else.">
                <PfBadge tone="purple" dot>Suggested</PfBadge>
              </PfCardHead>
              {suggestions.map((s, i) => (
                <div key={s.id} style={{ display: "flex", gap: 10, padding: "13px 16px", borderBottom: i === suggestions.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <Ic name="sparkle" size={16} color="var(--pf-purple-500)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6 }}>
                      {s.insight}{" "}
                      <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{s.ask}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5 }}>
                      Confidence {s.confidence}% &middot; evidence: {s.evidence}
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                      <PfBtn
                        small variant="primary" tone={TONE.purple.bg}
                        style={{ boxShadow: "0 6px 12px -6px rgba(175,82,222,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
                        onClick={() => ask(s.from, s.competency)}
                      >
                        Ask {s.from.split(" ")[0]}
                      </PfBtn>
                      <PfBtn small variant="secondary" onClick={() => { setDismissed((d) => [...d, s.id]); toast("Suggestion dismissed — nothing was sent, and nobody was told."); }}>
                        Not now
                      </PfBtn>
                    </div>
                  </div>
                </div>
              ))}
            </PfCard>
          )}
          </div>

          {/* -------------------------------- side rail ------------------------------ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
            <PfCard>
              <PfCardHead title="How your request travels" sub="Three steps, none of them anonymous." />
              {[
                { icon: "paperplane", tone: "purple" as PfTone, title: "You ask, by name", body: `${rTo || "Whoever you pick"} sees that it came from you${rComp ? `, and that you asked about ${rComp.toLowerCase()}` : ", and what you asked for"}.` },
                { icon: "user", tone: "blue" as PfTone, title: "They write it themselves", body: "No template answer, no anonymous option, and nothing routed through your manager on the way." },
                { icon: "megaphone", tone: "green" as PfTone, title: "It lands in Received", body: "With their name on it — and the same visibility rule as every other note on this page." },
              ].map((s2, i, arr) => (
                <div key={s2.title} style={{ display: "flex", gap: 10, padding: "12px 16px", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                  <PfTile icon={s2.icon} tone={s2.tone} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s2.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.55 }}>{s2.body}</div>
                  </div>
                </div>
              ))}
            </PfCard>

            <PfCard>
              <PfCardHead title="Worth timing it" sub="A reply is only useful while it can still be used." />
              <NextTile
                icon="clipboard" tone="yellow" title={`Your cycle closes ${MY_CYCLE.closes}`}
                sub="Replies that arrive before it can be cited"
                onClick={() => { go("myreview"); toast(`Opening your self-assessment — ${MY_CYCLE.name} closes ${MY_CYCLE.closes}.`); }}
              />
              <NextTile
                icon="chat" tone="green" title={`Ask ${MY_MANAGER.name.split(" ")[0]} in person too`}
                sub="Put it on your next 1-on-1 agenda"
                onClick={() => { go("myoneonones"); toast(`Opening your 1-on-1 with ${MY_MANAGER.name} — add the ask to the agenda.`); }}
              />
              <NextTile
                last
                icon="shield" tone="blue" title="What a request reveals"
                sub="Your privacy record, all 12 rows"
                onClick={() => { go("myprivacy"); toast("Opening your data & privacy page — including who can see a request you make."); }}
              />
            </PfCard>
          </div>
        </div>
      )}
    </div>
  );
}
