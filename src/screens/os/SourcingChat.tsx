"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PfAvatar, PfBadge, PfBtn, PfCard, PfCardHead, PfProgress } from "@/components/os/ui";
import ChatPane, { type Msg } from "@/components/os/ChatPane";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { SHORTLIST, type ShortlistCandidate } from "@/data/people";

/**
 * SourcingChat — Conversational Sourcing Workspace (FR-041/042/043/044).
 * Left: the recruiter describes the role in chat; the agent captures preferences,
 * shows its reasoning and replies. Right: the ranked Talent Match list with
 * explainable 0–100 scores, filters, shortlist/reject ops and a candidate drawer.
 */

/* ------------------------------ Local data ------------------------------ */

type Dim = { label: string; score: number; ev: string };
type Meta = {
  avail: string; yrs: number; loc: "Lagos" | "Remote"; ask: string;
  dims: Dim[];
  exp: { co: string; role: string; span: string; note: string }[];
  reranked?: string;
};

/** Match evidence per SHORTLIST candidate — one story with the shared dataset. */
const META: Record<string, Meta> = {
  "Adaeze Obi": {
    avail: "Available now", yrs: 5, loc: "Lagos", ask: "₦13.5M — inside band",
    dims: [
      { label: "Design systems", score: 95, ev: "Led Paystack DS 3 yrs — 4 products on one library (CV §2)" },
      { label: "Fintech domain", score: 93, ev: "5 yrs consumer + B2B payments (LinkedIn, verified)" },
      { label: "Product craft", score: 90, ev: "Checkout redesign lifted conversion +14% (Portfolio p.4)" },
      { label: "Comp & location", score: 88, ev: "Lagos · asks ₦13.5M — inside the ₦12–15M band (intake call, 12 Aug)" },
    ],
    exp: [
      { co: "Paystack", role: "Senior Product Designer", span: "2023 → now", note: "Owns the design system across 4 products" },
      { co: "Kuda", role: "Product Designer", span: "2021 – 2023", note: "Onboarding + KYC flows, 2.1M users" },
      { co: "Andela", role: "UI Designer", span: "2019 – 2021", note: "Client design pods, B2B dashboards" },
    ],
    reranked: "▲ #1 after refine · systems 95",
  },
  "Chidi Okafor": {
    avail: "4 wks notice", yrs: 4, loc: "Lagos", ask: "₦12.8M — inside band",
    dims: [
      { label: "Design systems", score: 84, ev: "Core contributor to Flutterwave 'Rivers' DS (CV §3)" },
      { label: "Fintech domain", score: 92, ev: "3 yrs on the merchant dashboard suite (Portfolio p.2)" },
      { label: "Product craft", score: 88, ev: "Reconciliation UI case study — 40% fewer input errors (Portfolio p.6)" },
      { label: "Comp & location", score: 90, ev: "Lagos · asks ₦12.8M — inside band (recruiter note)" },
    ],
    exp: [
      { co: "Flutterwave", role: "Product Designer", span: "2022 → now", note: "Merchant dashboard + reconciliation suite" },
      { co: "Moniepoint", role: "Product Designer", span: "2020 – 2022", note: "POS issuing flows" },
      { co: "Freelance", role: "Product Designer", span: "2018 – 2020", note: "SaaS dashboards for 6 clients" },
    ],
  },
  "Zainab Bello": {
    avail: "Open to offers", yrs: 8, loc: "Lagos", ask: "₦16M+ — above band",
    dims: [
      { label: "Design systems", score: 78, ev: "Governance-level DS work; last hands-on 2 yrs ago (CV §1)" },
      { label: "Fintech domain", score: 90, ev: "7 yrs across Kuda + Interswitch (CV, verified)" },
      { label: "Leadership", score: 94, ev: "Managed 6 designers at Kuda (LinkedIn + 2 references)" },
      { label: "Comp & location", score: 70, ev: "Expects ₦16M+ — above the stated band (intake call)" },
    ],
    exp: [
      { co: "Kuda", role: "Lead Product Designer", span: "2022 → now", note: "Leads a 6-designer team, sets DS governance" },
      { co: "Interswitch", role: "Senior Designer", span: "2019 – 2022", note: "Verve consumer products" },
      { co: "Konga", role: "Product Designer", span: "2016 – 2019", note: "Checkout + logistics tools" },
    ],
  },
  "Tunde Bakare": {
    avail: "Available now", yrs: 7, loc: "Lagos", ask: "₦12.5M — inside band",
    dims: [
      { label: "Design systems", score: 68, ev: "Consumer of a DS, not a builder of one (CV §2)" },
      { label: "UX research", score: 91, ev: "Led a 30-user study for the POS redesign (Portfolio p.3)" },
      { label: "Product craft", score: 76, ev: "Visual polish below the senior bar (panel note, round 1)" },
      { label: "Comp & location", score: 88, ev: "Lagos · asks ₦12.5M — inside band (intake form)" },
    ],
    exp: [
      { co: "Interswitch", role: "Senior UX Designer", span: "2021 → now", note: "POS + agent-banking research programme" },
      { co: "NIBSS", role: "UX Researcher", span: "2018 – 2021", note: "NQR usability studies" },
      { co: "Terragon", role: "Designer", span: "2016 – 2018", note: "Ad-tech dashboards" },
    ],
  },
  "Fatima Yusuf": {
    avail: "Available now", yrs: 3, loc: "Remote", ask: "₦12M — bottom of band",
    dims: [
      { label: "Design systems", score: 64, ev: "Component library scoped to one app (CV §3)" },
      { label: "Fintech domain", score: 80, ev: "3 yrs wealth-tech — Cowrywise, Bamboo (LinkedIn)" },
      { label: "Product craft", score: 82, ev: "Savings app rated 4.7★ — strong mobile patterns (Portfolio)" },
      { label: "Comp & location", score: 92, ev: "Remote · asks ₦12M — bottom of band (intake form)" },
    ],
    exp: [
      { co: "Cowrywise", role: "Product Designer", span: "2023 → now", note: "Savings + investment flows" },
      { co: "Bamboo", role: "Designer", span: "2021 – 2023", note: "Trading app redesign" },
      { co: "NYSC / Intern", role: "Design Intern", span: "2020 – 2021", note: "Fintech incubator rotation" },
    ],
  },
  "Emeka Nwosu": {
    avail: "6 wks notice", yrs: 6, loc: "Lagos", ask: "₦13M — inside band",
    dims: [
      { label: "Design systems", score: 60, ev: "No dedicated DS work on record (CV)" },
      { label: "Fintech domain", score: 85, ev: "5 yrs lending + savings products (CV §1)" },
      { label: "Product craft", score: 78, ev: "Portfolio depth unclear — only 2 case studies (screening note)" },
      { label: "Comp & location", score: 84, ev: "Lagos · asks ₦13M — inside band (recruiter note)" },
    ],
    exp: [
      { co: "PiggyVest", role: "Senior Designer", span: "2022 → now", note: "Savings targets + group features" },
      { co: "Carbon", role: "Product Designer", span: "2019 – 2022", note: "Lending journeys" },
      { co: "Hotels.ng", role: "UI Designer", span: "2017 – 2019", note: "Booking funnel" },
    ],
  },
  "Ngozi Eze": {
    avail: "Available now", yrs: 4, loc: "Remote", ask: "₦11.5M — under band",
    dims: [
      { label: "Design systems", score: 52, ev: "No systems ownership yet (CV §2)" },
      { label: "Fintech domain", score: 62, ev: "1 fintech year of 4 total (LinkedIn)" },
      { label: "Product craft", score: 89, ev: "Motion + UI standout — Dribbble portfolio verified" },
      { label: "Comp & location", score: 90, ev: "Remote · asks ₦11.5M — under band (intake form)" },
    ],
    exp: [
      { co: "Moniepoint (TeamApt)", role: "UI Designer", span: "2022 → now", note: "Marketing site + app UI kits" },
      { co: "Softcom", role: "UI Designer", span: "2020 – 2022", note: "Eyowo visual refresh" },
      { co: "Freelance", role: "Visual Designer", span: "2019 – 2020", note: "Brand + motion work" },
    ],
  },
};

/* ------------------------------- Chat data ------------------------------ */

/* Msg + the whole chat pane now live in components/os/ChatPane.tsx — one
   conversational pattern, two callers (here and the role intake). */

const SEED: Msg[] = [
  { id: 1, role: "user", text: "Senior product designer, fintech, Lagos or remote, ₦12–15M." },
  {
    id: 2, role: "agent",
    text: "Got it — 4 must-haves and a comp band captured to the brief. Sourcing now.",
    reasoning: [
      "Parsing must-haves — role: Senior PD · domain: fintech · location: Lagos / remote · band: ₦12–15M",
      "Searching 3 talent pools + LinkedIn (consented profiles only)",
      "Ranking 47 profiles against the JD rubric — 4 weighted dimensions",
    ],
  },
  {
    id: 3, role: "agent",
    text: "9 strong matches — ranked on the right. Top three: Adaeze (91), Chidi (88), Zainab (85). Two more are held back pending NDPR consent re-verification.",
  },
  { id: 4, role: "user", text: "Prefer design-systems depth over pure visual craft." },
  {
    id: 5, role: "agent",
    text: "Re-ranked; Adaeze moves to #1 (systems 95 — led Paystack's design system for 3 yrs). Zainab drops on hands-on recency; every delta is in the score cards.",
    reasoning: ["Refine captured — rubric weight: design-systems ×1.3", "Re-scored 47 profiles · 2 position changes · run log appended"],
  },
];

const CANNED: { text: string; reasoning?: string[] }[] = [
  {
    text: "Noted — preference captured to the brief and the pool re-scored. No one dropped below threshold; the ranking on the right reflects it.",
    reasoning: ["Updating brief · re-weighting rubric", "Re-scoring 47 profiles against the JD rubric"],
  },
  {
    text: "Added to the JD rubric (weight 0.8). Two profiles shifted one place each — see the right panel. I'll flag new entrants that match this.",
    reasoning: ["Amending rubric dimension", "Re-ranking + diffing against the last run"],
  },
  {
    text: "Captured. I'll keep scanning the pools + LinkedIn overnight and ping you on ranking changes — outreach stays queued until you approve (FR-048).",
    reasoning: ["Persisting preference to saved search", "Scheduling overnight re-scan · alerts armed"],
  },
];

const REJECT_REASONS = ["Not enough seniority", "Comp expectations above band", "Location constraint", "Design-systems gap", "Withdrew interest"];
const POOLS = ["Design — senior bench", "Fintech product guild", "Future leads (2027)"];

type Decision = { s: "short" } | { s: "rej"; reason: string };
type Filters = { avail: boolean; yrs5: boolean; lagos: boolean; remote: boolean };

/* ----------------------------- Small pieces ----------------------------- */

function ringTone(score: number) {
  return score >= 85 ? "var(--pf-primary-500)" : score >= 75 ? "var(--pf-blue-500)" : "var(--pf-yellow-500)";
}

function ScoreRing({ score, size = 42 }: { score: number; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `conic-gradient(${ringTone(score)} ${score * 3.6}deg, var(--pf-n50) 0)`, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <div style={{ width: size - 9, height: size - 9, borderRadius: "50%", background: "var(--pf-n0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size >= 42 ? 12.5 : 11.5, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>
        {score}
      </div>
    </div>
  );
}

function Chip({ label, active, dashed, onClick }: { label: string; active?: boolean; dashed?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 99, cursor: "pointer", whiteSpace: "nowrap",
        border: dashed ? "1px dashed var(--pf-n300)" : `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
        background: active ? "var(--pf-primary-50)" : "var(--pf-n0)",
        color: active ? "var(--pf-primary-500)" : "var(--pf-n500)",
      }}
    >
      {label}
    </button>
  );
}

function DimRow({ d }: { d: Dim }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>{d.label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{d.score}</span>
      </div>
      <PfProgress pct={d.score} tone={d.score >= 85 ? "green" : d.score >= 70 ? "blue" : "yellow"} height={5} />
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.45 }}>{d.ev}</div>
    </div>
  );
}

/* ------------------------------- Match row ------------------------------ */

function MatchRow({ c, rank, pinned, expanded, rejecting, onToggleExpand, onStartReject, onCancelReject, onConfirmReject, onShortlist, onUnshortlist, onOpen }: {
  c: ShortlistCandidate; rank: number; pinned?: boolean; expanded: boolean; rejecting: boolean;
  onToggleExpand: () => void; onStartReject: () => void; onCancelReject: () => void; onConfirmReject: (reason: string) => void;
  onShortlist: () => void; onUnshortlist: () => void; onOpen: () => void;
}) {
  const m = META[c.name];
  return (
    <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", background: pinned ? "var(--pf-primary-50)" : "var(--pf-n0)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 24, fontSize: 12, fontWeight: 600, color: "var(--pf-n300)", flex: "none" }}>#{rank}</span>
        <button onClick={onOpen} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <PfAvatar init={c.init} tone={c.tone} size={34} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <button onClick={onOpen} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>
              {c.name}
            </button>
            {m.reranked && <PfBadge tone="purple">{m.reranked}</PfBadge>}
            {pinned && <PfBadge tone="green" dot>Shortlisted</PfBadge>}
          </div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.title} · {c.co}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 1 }}>
            {m.avail} · {m.yrs} yrs · {m.loc}
          </div>
        </div>
        <ScoreRing score={c.score} />
      </div>

      {/* action row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, paddingLeft: 34 }}>
        <button
          onClick={onToggleExpand}
          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 500, color: "var(--pf-blue-500)", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, padding: 0, whiteSpace: "nowrap" }}
        >
          Why this score?
          <Ic name={expanded ? "caretdown" : "caretright"} size={11} />
        </button>
        <span style={{ flex: 1 }} />
        {pinned ? (
          <PfBtn small onClick={onUnshortlist}>Remove</PfBtn>
        ) : (
          <PfBtn small icon="check" onClick={onShortlist}>Shortlist</PfBtn>
        )}
        <PfBtn small onClick={onStartReject} style={{ color: "var(--pf-red-500)" }}>Reject</PfBtn>
        <PfBtn small icon="user" onClick={onOpen}>Profile</PfBtn>
      </div>

      {/* reject reason select */}
      {rejecting && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, paddingLeft: 34, animation: "scIn .18s ease" }}>
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Reason (logged):</span>
          <select
            defaultValue=""
            onChange={(e) => e.target.value && onConfirmReject(e.target.value)}
            style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "5px 8px", cursor: "pointer", flex: 1 }}
          >
            <option value="" disabled>Select a reason…</option>
            {REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <PfBtn small variant="ghost" onClick={onCancelReject}>Cancel</PfBtn>
        </div>
      )}

      {/* explainability panel */}
      {expanded && (
        <div style={{ marginTop: 10, marginLeft: 34, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px", animation: "scIn .18s ease" }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>
            Score {c.score}/100 — weighted vs JD rubric v3 · refine applied: design-systems ×1.3
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {m.dims.map((d) => <DimRow key={d.label} d={d} />)}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 12, paddingTop: 10, borderTop: "1px dashed var(--pf-n100)" }}>
            <Ic name="shield" size={13} color="var(--pf-n400)" />
            <span style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
              This same explanation serves the candidate&apos;s right-to-explanation (NDPR) — no hidden criteria.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================ Screen ================================ */

export default function SourcingChat() {
  const go = useGo();
  const toast = useToast();

  /* chat state */
  const [msgs, setMsgs] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const idRef = useRef(1000);
  const cannedRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  /* match-list state */
  const [minMatch, setMinMatch] = useState(60);
  const [f, setF] = useState<Filters>({ avail: false, yrs5: false, lagos: false, remote: false });
  const [boost, setBoost] = useState(false);
  const [expanded, setExpanded] = useState<string | null>("Adaeze Obi");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [dec, setDec] = useState<Record<string, Decision>>({});
  const [saved, setSaved] = useState(false);

  /* drawer state */
  const [drawer, setDrawer] = useState<ShortlistCandidate | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pool, setPool] = useState(POOLS[0]);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const exchange = (userText: string, agent: { text: string; reasoning?: string[] }, side?: () => void) => {
    const uid = ++idRef.current;
    setMsgs((m) => [...m, { id: uid, role: "user", text: userText }]);
    setTyping(true);
    timerRef.current = window.setTimeout(() => {
      const aid = ++idRef.current;
      setMsgs((m) => [...m, { id: aid, role: "agent", ...agent }]);
      setTyping(false);
      side?.();
    }, 620);
  };

  const onSend = () => {
    const t = draft.trim();
    if (!t || typing) return;
    setDraft("");
    const reply = CANNED[cannedRef.current++ % CANNED.length];
    exchange(t, reply, () => toast("Sourcing agent replied — brief updated · run log appended", "ai"));
  };

  const SUGGESTIONS: { label: string; run: () => void }[] = [
    {
      label: "More like #1",
      run: () => exchange(
        "More like #1 (Adaeze).",
        {
          text: "Boosted lookalike weighting on Adaeze's profile — design-systems ×1.4, fintech ×1.2. Chidi (88) and Zainab (85) are her closest analogues; 3 LinkedIn lookalikes queued behind a consent check.",
          reasoning: ["Extracting #1's dominant signals — systems, fintech, B2B", "Re-weighting rubric · scanning for analogues"],
        },
        () => { setBoost(true); toast("Rubric re-weighted — design-systems ×1.4 · 3 lookalikes queued", "ai"); },
      ),
    },
    {
      label: "Relax location",
      run: () => exchange(
        "Relax the location constraint.",
        {
          text: "Widened to all-Nigeria + remote — location chips cleared. Fatima (78) and Ngozi (67) now rank without a location penalty.",
          reasoning: ["Dropping location term from the brief", "Re-scoring — comp-&-location dimension re-based"],
        },
        () => { setF((x) => ({ ...x, lagos: false, remote: false })); toast("Location filter cleared — 2 remote profiles unpenalised", "ai"); },
      ),
    },
    {
      label: "Add availability filter",
      run: () => exchange(
        "Only show people who can start now.",
        {
          text: "Availability filter on — 4 of 7 cleared matches can start immediately; the rest show their notice periods in the score cards.",
          reasoning: ["Adding availability = now to the brief", "Filtering ranked list · alerts updated"],
        },
        () => { setF((x) => ({ ...x, avail: true })); toast("Availability filter on — 4 of 7 can start now", "ai"); },
      ),
    },
  ];

  /* --------------------------- derived lists --------------------------- */

  const passes = (c: ShortlistCandidate) => {
    const m = META[c.name];
    if (c.score < minMatch) return false;
    if (f.avail && m.avail !== "Available now") return false;
    if (f.yrs5 && m.yrs < 5) return false;
    if ((f.lagos || f.remote) && !((f.lagos && m.loc === "Lagos") || (f.remote && m.loc === "Remote"))) return false;
    return true;
  };

  const { pinnedRows, rankedRows, rejectedRows, hiddenCount } = useMemo(() => {
    const pinnedRows = SHORTLIST.filter((c) => dec[c.name]?.s === "short");
    const rejectedRows = SHORTLIST.filter((c) => dec[c.name]?.s === "rej");
    const undecided = SHORTLIST.filter((c) => !dec[c.name]);
    const rankedRows = undecided.filter(passes);
    return { pinnedRows, rankedRows, rejectedRows, hiddenCount: undecided.length - rankedRows.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dec, minMatch, f]);

  const rankOf = (c: ShortlistCandidate) => SHORTLIST.indexOf(c) + 1;

  const shortlist = (c: ShortlistCandidate) => {
    setDec((d) => ({ ...d, [c.name]: { s: "short" } }));
    setRejecting(null);
    toast(`${c.name} shortlisted — pinned to your picks · decision logged`, "success");
  };
  const unshortlist = (c: ShortlistCandidate) => {
    setDec((d) => { const n = { ...d }; delete n[c.name]; return n; });
    toast(`${c.name} returned to ranked matches`, "default");
  };
  const confirmReject = (c: ShortlistCandidate, reason: string) => {
    setDec((d) => ({ ...d, [c.name]: { s: "rej", reason } }));
    setRejecting(null);
    setExpanded((e) => (e === c.name ? null : e));
    toast(`Reason logged — auditable · ${c.name} moved to Rejected`, "danger");
  };

  const rowProps = (c: ShortlistCandidate, pinned?: boolean) => ({
    c, rank: rankOf(c), pinned,
    expanded: expanded === c.name,
    rejecting: rejecting === c.name,
    onToggleExpand: () => setExpanded(expanded === c.name ? null : c.name),
    onStartReject: () => setRejecting(rejecting === c.name ? null : c.name),
    onCancelReject: () => setRejecting(null),
    onConfirmReject: (reason: string) => confirmReject(c, reason),
    onShortlist: () => shortlist(c),
    onUnshortlist: () => unshortlist(c),
    onOpen: () => setDrawer(c),
  });

  const drawerMeta = drawer ? META[drawer.name] : null;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ------------------------------ Header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Sourcing Chat</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Describe the role in chat — the agent captures preferences, streams its reasoning and ranks matches beside the thread · FR-041–044
          </div>
        </div>
        <PfBtn icon="play" onClick={() => { setMsgs(SEED); toast("Replaying run SRC-118 — 3 tool calls · 47 profiles scored · 0 policy flags", "ai"); }}>
          Replay run
        </PfBtn>
        <PfBtn
          variant="primary" icon="plus"
          onClick={() => {
            setMsgs([{ id: 990, role: "agent", text: "New thread SRC-119 — describe the role, comp band and location; I'll capture the brief and start ranking." }]);
            setF({ avail: false, yrs5: false, lagos: false, remote: false });
            setMinMatch(60);
            setBoost(false);
            toast("New sourcing thread SRC-119 — describe the role to begin", "default");
          }}
        >
          New search
        </PfBtn>
      </div>

      {/* -------------------------- Saved searches -------------------------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Saved searches</span>
        <Chip active label="Sr PD — Lagos fintech ✓ alerts on" onClick={() => toast('Alerts on "Sr PD — Lagos fintech" — you’ll be pinged on ranking changes', "default")} />
        {saved && <Chip active label="Sr PD — design-systems refine ✓ alerts on" onClick={() => toast("Alerts already on for this refine", "default")} />}
        <Chip dashed label="+ Save this search" onClick={() => { setSaved(true); toast('Search saved — "Sr PD — design-systems refine" · Alerts on changes enabled', "success"); }} />
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Run SRC-118 · replayable · 0 policy flags</span>
      </div>

      {/* ------------------------------ Two panes --------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 5fr) minmax(380px, 6fr)", gap: 12, alignItems: "stretch" }}>
        {/* ============================ Chat pane ============================ */}
        <ChatPane
          title="Sourcing thread"
          sub="Agent: Scout · every step logged & replayable"
          agentLabel="Sourcing agent"
          msgs={msgs}
          typing={typing}
          draft={draft}
          onDraft={setDraft}
          onSend={onSend}
          suggestions={SUGGESTIONS}
          placeholder='Refine the brief — e.g. "must have B2B dashboard work"'
        />

        {/* ========================== Talent Match =========================== */}
        <PfCard style={{ display: "flex", flexDirection: "column", height: 660, overflow: "hidden" }}>
          <PfCardHead title="Talent Match" sub="Run SRC-118 · 47 scanned · 9 matched — 7 cleared NDPR consent, 2 pending">
            <PfBadge tone="grey">{pinnedRows.length + rankedRows.length} shown</PfBadge>
          </PfCardHead>

          {/* controls */}
          <div style={{ padding: "11px 20px", borderBottom: "1px solid var(--pf-n50)", display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>Min match</span>
              <input
                type="range" min={50} max={95} step={1} value={minMatch}
                onChange={(e) => setMinMatch(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--pf-primary-500)" }}
              />
              <PfBadge tone={minMatch >= 80 ? "green" : "grey"}>≥ {minMatch}</PfBadge>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Chip label="Available now" active={f.avail} onClick={() => setF((x) => ({ ...x, avail: !x.avail }))} />
              <Chip label="5+ yrs" active={f.yrs5} onClick={() => setF((x) => ({ ...x, yrs5: !x.yrs5 }))} />
              <Chip label="Lagos" active={f.lagos} onClick={() => setF((x) => ({ ...x, lagos: !x.lagos }))} />
              <Chip label="Remote" active={f.remote} onClick={() => setF((x) => ({ ...x, remote: !x.remote }))} />
              {boost && <PfBadge tone="purple" dot>Rubric boost: systems ×1.4</PfBadge>}
            </div>
          </div>

          {/* rows */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {pinnedRows.length > 0 && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 20px", background: "var(--pf-primary-50)", borderBottom: "1px solid var(--pf-primary-100)" }}>
                  <Ic name="check" size={13} color="var(--pf-primary-500)" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-primary-500)" }}>Shortlisted — your picks ({pinnedRows.length})</span>
                </div>
                {pinnedRows.map((c) => <MatchRow key={c.name} {...rowProps(c, true)} />)}
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)" }}>Ranked matches ({rankedRows.length})</span>
              <span style={{ flex: 1 }} />
              {hiddenCount > 0 && (
                <button
                  onClick={() => { setF({ avail: false, yrs5: false, lagos: false, remote: false }); setMinMatch(60); toast("Filters cleared — full ranking restored", "default"); }}
                  style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, color: "var(--pf-blue-500)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {hiddenCount} hidden by filters — clear
                </button>
              )}
            </div>
            {rankedRows.map((c) => <MatchRow key={c.name} {...rowProps(c)} />)}
            {rankedRows.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n300)" }}>
                No undecided matches pass the current filters.
              </div>
            )}

            {rejectedRows.length > 0 && (
              <>
                <div style={{ padding: "8px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)", fontSize: 12, fontWeight: 600, color: "var(--pf-n400)" }}>
                  Rejected ({rejectedRows.length}) — reasons logged
                </div>
                {rejectedRows.map((c) => {
                  const d = dec[c.name];
                  return (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", opacity: 0.72 }}>
                      <PfAvatar init={c.init} tone={c.tone} size={26} />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", textDecoration: "line-through" }}>{c.name}</span>
                      <PfBadge tone="red">{d?.s === "rej" ? d.reason : ""}</PfBadge>
                      <span style={{ flex: 1 }} />
                      <PfBtn small variant="ghost" onClick={() => unshortlist(c)}>Undo</PfBtn>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </PfCard>
      </div>

      {/* ------------------------------ Footer ------------------------------ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, fontSize: 12, color: "var(--pf-n400)" }}>
        <Ic name="shield" size={14} />
        Agent runs logged &amp; replayable · approval required before outreach (FR-048 default).
      </div>

      {/* -------------------------- Candidate drawer ------------------------- */}
      {drawer && drawerMeta && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
          <div onClick={() => setDrawer(null)} style={{ position: "absolute", inset: 0, background: "rgba(2,6,23,.32)" }} />
          <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 430, maxWidth: "92vw", background: "var(--pf-n0)", borderLeft: "1px solid var(--pf-n100)", boxShadow: "-16px 0 44px rgba(2,6,23,.14)", overflowY: "auto", padding: 22, animation: "scIn .18s ease" }}>
            {/* head */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <PfAvatar init={drawer.init} tone={drawer.tone} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--pf-n900)" }}>{drawer.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>{drawer.title} · {drawer.co}</div>
              </div>
              <ScoreRing score={drawer.score} size={44} />
              <button onClick={() => setDrawer(null)} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 8, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--pf-n500)" }}>
                <Ic name="x" size={15} />
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <PfBadge tone={drawer.score >= 85 ? "green" : drawer.score >= 75 ? "blue" : "yellow"}>Match {drawer.score}/100</PfBadge>
              <PfBadge tone={drawerMeta.avail === "Available now" ? "green" : "grey"}>{drawerMeta.avail}</PfBadge>
              <PfBadge tone="grey">{drawerMeta.yrs} yrs · {drawerMeta.loc}</PfBadge>
            </div>

            {/* summary */}
            <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 13, marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>Profile summary</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{drawer.note}</div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 7 }}>Comp: {drawerMeta.ask} · consented source (NDPR)</div>
            </div>

            {/* skills */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 7 }}>Skills</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {drawer.tags.map((t) => <PfBadge key={t} tone="grey">{t}</PfBadge>)}
            </div>

            {/* experience timeline */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 9 }}>Experience</div>
            <div style={{ position: "relative", paddingLeft: 19, marginBottom: 16 }}>
              <span style={{ position: "absolute", left: 5, top: 6, bottom: 8, width: 2, background: "var(--pf-n50)" }} />
              {drawerMeta.exp.map((e, i) => (
                <div key={e.co} style={{ position: "relative", marginBottom: i === drawerMeta.exp.length - 1 ? 0 : 13 }}>
                  <span style={{ position: "absolute", left: -19, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === 0 ? "var(--pf-primary-500)" : "var(--pf-n0)", border: `2.5px solid ${i === 0 ? "var(--pf-primary-500)" : "var(--pf-n300)"}` }} />
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{e.role}</span>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>{e.span}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", marginTop: 1 }}>{e.co} — {e.note}</div>
                </div>
              ))}
            </div>

            {/* notes */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 7 }}>Recruiter notes (hiring-team only)</div>
            <textarea
              value={notes[drawer.name] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [drawer.name]: e.target.value }))}
              placeholder="e.g. Warm intro via Paystack design lead — probe systems governance in round 1…"
              rows={3}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 12.5, color: "var(--pf-n900)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "9px 11px", resize: "vertical", outline: "none", marginBottom: 8, boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <PfBtn small onClick={() => toast(`Note saved to ${drawer.name}'s file — hiring-team visibility only`, "success")}>Save note</PfBtn>
            </div>

            {/* save to pool */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <select
                value={pool}
                onChange={(e) => setPool(e.target.value)}
                style={{ flex: 1, fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 9px", cursor: "pointer" }}
              >
                {POOLS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <PfBtn icon="stack" onClick={() => toast(`${drawer.name} saved to "${pool}" — consent re-verified (NDPR)`, "success")}>Save to pool</PfBtn>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <PfBtn
                variant="primary" icon="paperplane" full
                onClick={() => {
                  toast(`${drawer.name} queued for outreach sequence — held for your approval (FR-048)`, "ai");
                  setDrawer(null);
                  go("sequences");
                }}
              >
                Add to sequence
              </PfBtn>
              {dec[drawer.name]?.s !== "short" && (
                <PfBtn icon="check" onClick={() => { shortlist(drawer); setDrawer(null); }}>Shortlist</PfBtn>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
