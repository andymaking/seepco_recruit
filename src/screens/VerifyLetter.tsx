"use client";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfBanner, PfPageTabs, PfTh,
  type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { QR_VERIFY, VERIFICATIONS, activeAdapter, type LetterVerification } from "@/data/adapters";
import { LETTER_TEMPLATES } from "@/data/hrops";
import { MODEL_CARDS } from "@/data/trust";

/**
 * /verify — PRD v2.1 FR-086, the PUBLIC QR verification page.
 *
 * Registered in nav.ts NO_CHROME: no sidebar, no topbar, no persona, no account.
 * Its reader is a bank clerk in Yaba or a visa officer in Abuja who pointed a
 * phone at the footer of a letter thirty seconds ago and has never heard of us.
 * So this file renders its OWN shell — slim wordmark bar, centred column, footer.
 *
 * THE WHOLE DESIGN IS ONE PROPERTY: it confirms AUTHENTICITY without disclosing
 * CONTENTS. Five facts leave this page — kind, subject, issuer, date, status.
 * Nothing else does, ever, and the page says so in plain words in three places:
 * under the verdict, as a standing panel beside it, and as a full disclosure
 * matrix on its own tab — because the subject of the letter is entitled to know
 * exactly what a stranger with her QR code can see about her, and the scanner is
 * entitled to know why he is not being shown the document.
 *
 * Three outcomes, all designed rather than one designed and two handled:
 *   valid   → HB-7K2Q-9F4L  green seal, an affirmative sentence
 *   revoked → HB-5X1V-6C7B  red seal, unsoftened: it is not valid, do not rely on it
 *   unknown → anything else  slate seal: nothing was ever issued under this reference
 *
 * No model runs here (MC-05 covers the DRAFTING of the letter, not this lookup) —
 * it is a resolve against the issuing record through the letter_verify v1 contract,
 * whose day-one adapter is our own public resolver: no counterparty, no API wait.
 */

/* =============================== the issuer =============================== */

const ISSUER = {
  org: "Unrealabs Limited",
  unit: "People Ops",
  email: "peopleops@unrealabs.ng",
  phone: "+234 1 448 0219",
  addr: "12 Kofo Abayomi Street, Victoria Island, Lagos",
  rc: "RC 1442907",
};

/** Scanned, not typed — the page opens with the code already in the field. */
const DEFAULT_TOKEN = "HB-7K2Q-9F4L";

/* ================================ verdicts ================================ */

type Verdict = "valid" | "revoked" | "unknown";

const verdictOf = (r: LetterVerification | null): Verdict =>
  !r ? "unknown" : r.valid ? "valid" : "revoked";

type Skin = {
  band: string; line: string; ink: string; sub: string;
  seal: string; sealInk: string; icon: string;
  eyebrow: string; title: string; chip: string; chipTone: PfTone;
};

const SKIN: Record<Verdict, Skin> = {
  valid: {
    band: "var(--pf-primary-50)", line: "var(--pf-primary-100)",
    ink: "var(--pf-n900)", sub: "var(--pf-n500)",
    seal: "var(--pf-primary-500)", sealInk: "#fff", icon: "check",
    eyebrow: "Verified against the issuing record",
    title: "This letter is genuine", chip: "Issued · not withdrawn", chipTone: "green",
  },
  revoked: {
    band: "var(--pf-red-50)", line: "var(--pf-red-100)",
    ink: "var(--pf-n900)", sub: "var(--pf-n500)",
    seal: "var(--pf-red-500)", sealInk: "#fff", icon: "warning",
    eyebrow: "Found in the issuing record — and withdrawn",
    title: "This letter is not valid", chip: "Revoked by the issuer", chipTone: "red",
  },
  unknown: {
    band: "var(--pf-n900)", line: "var(--pf-n900)",
    ink: "#fff", sub: "rgba(255,255,255,.72)",
    seal: "rgba(255,255,255,.13)", sealInk: "#fff", icon: "x",
    eyebrow: "Nothing found in the issuing record",
    title: "No letter carries this reference", chip: "Not issued by us", chipTone: "red",
  },
};

/* ============================ disclosure matrix =========================== */

/** The five facts that leave this page. The list IS the contract. */
const SHOWN: string[] = [
  "The kind of letter that was issued",
  "The name of the person it was issued to",
  "The employer that issued it",
  "The date it was issued",
  "Whether it is still valid, or has been withdrawn",
];

/** Everything a scanner might expect to be shown, and will not be. */
const WITHHELD: string[] = [
  "The wording of the letter itself",
  "Salary, allowances, or any figure in naira",
  "Grade, band or job level",
  "Home address, phone number or personal email",
  "Leave dates, travel plans or destination",
  "Bank or account details",
  "Employment history beyond the fact of employment",
  "Who asked for the letter, and why",
  "Performance records, cases or HR notes",
  "Who else has scanned this code",
];

const LOGGED: { k: string; v: string; tone: PfTone; icon: string }[] = [
  { k: "The issuer records", v: "That this reference was checked, and the time it was checked.", tone: "blue", icon: "clock" },
  { k: "The issuer does not record", v: "Who you are, who you work for, your device, or where you scanned from. This page sets no account and asks for no identity.", tone: "green", icon: "shield" },
  { k: "The subject can see", v: "A count of how many times her own letter has been checked — never who checked it.", tone: "purple", icon: "user" },
];

/* ============================== small pieces ============================== */

/** A deterministic module pattern from the reference — decorative, not scannable. */
const qrCells = (token: string): boolean[] => {
  const s = token.replace(/[^A-Z0-9]/g, "") || "HB";
  return Array.from({ length: 25 }, (_, i) => (((s.charCodeAt(i % s.length) + i * 7) >> (i % 5)) & 1) === 1);
};

function QrGlyph({ token, size = 58, tone = "var(--pf-n900)" }: { token: string; size?: number; tone?: string }) {
  const pad = size * 0.08;
  const cell = (size - pad * 2) / 9;
  const finder = (cx: number, cy: number) => (
    <g key={`f-${cx}-${cy}`}>
      <rect x={pad + cx * cell} y={pad + cy * cell} width={cell * 3} height={cell * 3} rx={cell * 0.5} fill={tone} />
      <rect x={pad + (cx + 0.55) * cell} y={pad + (cy + 0.55) * cell} width={cell * 1.9} height={cell * 1.9} rx={cell * 0.35} fill="#fff" />
      <rect x={pad + (cx + 1.05) * cell} y={pad + (cy + 1.05) * cell} width={cell * 0.9} height={cell * 0.9} rx={cell * 0.2} fill={tone} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: "none" }} aria-hidden="true">
      <rect width={size} height={size} rx={size * 0.16} fill="#fff" stroke="var(--pf-n100)" />
      {finder(0, 0)}{finder(6, 0)}{finder(0, 6)}
      {qrCells(token).map((on, i) =>
        on ? (
          <rect key={i} x={pad + ((i % 5) + 3) * cell} y={pad + (Math.floor(i / 5) + 3) * cell} width={cell * 0.86} height={cell * 0.86} rx={cell * 0.2} fill={tone} />
        ) : null,
      )}
    </svg>
  );
}

/**
 * The privacy property, drawn: the letter's body is a grey blur that stays with
 * the employer; only the footer code is read by this page.
 */
function LetterFigure() {
  const bars = [148, 126, 158, 112, 150, 96, 134, 84];
  return (
    <svg viewBox="0 0 430 208" width="100%" style={{ maxWidth: 430, display: "block" }} role="img" aria-label="A letter whose body is never shown, with only the footer code read by this page">
      <rect x="12" y="12" width="196" height="184" rx="11" fill="#fff" stroke="var(--pf-n100)" />
      <rect x="30" y="30" width="72" height="7" rx="3.5" fill="var(--pf-n300)" />
      <rect x="30" y="44" width="46" height="6" rx="3" fill="var(--pf-n100)" />
      {bars.map((w, i) => (
        <rect key={i} x="30" y={66 + i * 13} width={w} height="6.5" rx="3.2" fill="var(--pf-n50)" />
      ))}
      <rect x="24" y="58" width="172" height="112" rx="8" fill="var(--pf-n25)" opacity=".55" />
      <rect x="56" y="106" width="108" height="20" rx="10" fill="var(--pf-n100)" />
      <text x="110" y="120" textAnchor="middle" style={{ fontSize: 10, fontWeight: 600, fill: "var(--pf-n500)" }}>never shown here</text>
      <rect x="146" y="146" width="44" height="44" rx="7" fill="#fff" stroke="var(--pf-primary-100)" />
      <rect x="152" y="152" width="10" height="10" rx="2.5" fill="var(--pf-primary-500)" />
      <rect x="174" y="152" width="10" height="10" rx="2.5" fill="var(--pf-primary-500)" />
      <rect x="152" y="174" width="10" height="10" rx="2.5" fill="var(--pf-primary-500)" />
      <rect x="167" y="167" width="5" height="5" rx="1.5" fill="var(--pf-primary-500)" />
      <rect x="176" y="176" width="5" height="5" rx="1.5" fill="var(--pf-primary-500)" />
      <rect x="167" y="178" width="4" height="4" rx="1.2" fill="var(--pf-n300)" />

      <path d="M212 96 H250" stroke="var(--pf-n100)" strokeWidth="1.4" />
      <circle cx="250" cy="96" r="2.6" fill="var(--pf-n300)" />
      <text x="260" y="92" style={{ fontSize: 11.5, fontWeight: 600, fill: "var(--pf-n900)" }}>The letter itself</text>
      <text x="260" y="107" style={{ fontSize: 11, fill: "var(--pf-n400)" }}>stays with the employer.</text>

      <path d="M196 168 H250" stroke="var(--pf-primary-100)" strokeWidth="1.4" />
      <circle cx="250" cy="168" r="2.6" fill="var(--pf-primary-500)" />
      <text x="260" y="164" style={{ fontSize: 11.5, fontWeight: 600, fill: "var(--pf-n900)" }}>The code in the footer</text>
      <text x="260" y="179" style={{ fontSize: 11, fill: "var(--pf-n400)" }}>is all this page reads.</text>
    </svg>
  );
}

/** One line of the verdict sentence, with the load-bearing words emphasised. */
function Say({ parts, ink, sub }: { parts: (string | { b: string })[]; ink: string; sub: string }) {
  return (
    <span style={{ color: sub }}>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} style={{ color: ink, fontWeight: 600 }}>{p.b}</span>
        ),
      )}
    </span>
  );
}

function Row({ label, children, mono, last }: { label: string; children: ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "184px minmax(0,1fr)", gap: 14, alignItems: "center", padding: "13px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <PfTh>{label}</PfTh>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", fontFamily: mono ? "var(--mono)" : undefined, letterSpacing: mono ? ".4px" : undefined, display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

function Tick({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
      <span style={{ width: 18, height: 18, borderRadius: 5, background: ok ? "var(--pf-primary-50)" : "var(--pf-n50)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", marginTop: 1 }}>
        <Ic name={ok ? "check" : "x"} size={12} color={ok ? "var(--pf-primary-500)" : "var(--pf-n300)"} weight={2.4} />
      </span>
      <span style={{ fontSize: 13, color: ok ? "var(--pf-n900)" : "var(--pf-n500)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

/** Sample-reference chip — the demo aid, visibly fenced off as one. */
function Chip({ label, token, onPick }: { label: string; token: string; onPick: (t: string) => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={() => onPick(token)}
      style={{
        fontFamily: "inherit", fontSize: 11.5, fontWeight: 500, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 9px", borderRadius: 7,
        border: "1px dashed var(--pf-n100)", background: hovered ? "var(--pf-n25)" : "transparent",
        color: hovered ? "var(--pf-n900)" : "var(--pf-n500)",
      }}
    >
      {label}
      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n300)" }}>{token}</span>
    </button>
  );
}

const CARD_GRID: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 372px", gap: 12, alignItems: "start" };

/* ================================= screen ================================= */

/** "an employment confirmation" / "a bank reference" — kinds vary, so pick the article. */
const article = (word: string) => (/^[aeiou]/i.test(word.trim()) ? "An " : "A ");

export default function VerifyLetter() {
  const go = useGo();
  const toast = useToast();

  const [token, setToken] = useState(DEFAULT_TOKEN);
  const [query, setQuery] = useState(DEFAULT_TOKEN);
  const [result, setResult] = useState<LetterVerification | null>(() => QR_VERIFY.resolve(DEFAULT_TOKEN));
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string>("moments ago");
  const [tab, setTab] = useState("verified");
  const [scanned, setScanned] = useState(true);

  const stamp = () =>
    new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WAT";

  /**
   * The "checked at" stamp is client-only — rendering `new Date()` during render
   * would mismatch on hydration. Queued rather than set synchronously in the
   * effect, so a first paint is not blocked on a cascading re-render.
   */
  useEffect(() => {
    const t = window.setTimeout(() => setCheckedAt(stamp()), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (raw: string) => {
    const t = raw.toUpperCase().trim();
    if (!t) { toast("Enter the reference printed under the QR code on the letter", "danger"); return; }
    setChecking(true);
    setToken(t);
    window.setTimeout(() => {
      const r = QR_VERIFY.resolve(t);
      setResult(r);
      setQuery(t);
      setCheckedAt(stamp());
      setChecking(false);
      setScanned(false);
      setTab("verified");
    }, 420);
  };

  const pick = (t: string) => { setToken(t); run(t); };

  const v = verdictOf(result);
  const skin = SKIN[v];
  const resolver = activeAdapter("letter_verify");
  const draftCard = MODEL_CARDS.find((m) => m.id === "MC-05");
  const publicUrl = QR_VERIFY.publicUrl(query);

  const statement: (string | { b: string })[] = result
    ? result.valid
      ? [article(result.kind), { b: result.kind.toLowerCase() }, " letter was issued to ", { b: result.subject }, " by ", { b: result.issuer }, " on ", { b: result.issued }, ". It has not been withdrawn."]
      : [article(result.kind), { b: result.kind.toLowerCase() }, " letter was issued to ", { b: result.subject }, " on ", { b: result.issued }, " — and has since been ", { b: "revoked by " + result.issuer }, ". Do not rely on it. Whatever the paper in front of you says, it is no longer a current statement by this employer."]
    : ["Nothing has ever been issued under the reference ", { b: query || "—" }, " by ", { b: ISSUER.org }, ". A document quoting it was not produced by this system, and this page is not confirming anything about it. Treat it as unverified."];

  const tabs = [
    { key: "verified", label: v === "unknown" ? "What we checked" : "What was verified" },
    { key: "shows", label: "What this page shows", badge: "NDPR" },
    { key: "about", label: "About this check" },
  ];

  /* --------------------------------- render -------------------------------- */

  return (
    <div style={{ minHeight: "100vh", background: "var(--pf-n25)", fontFamily: "var(--pf-font)", color: "var(--pf-n900)", fontSize: 14 }}>
      {/* ------------------------------ slim chrome ----------------------------- */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "var(--pf-n0)", borderBottom: "1px solid var(--pf-n50)" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", height: 56, display: "flex", alignItems: "center", gap: 12, padding: "0 28px" }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.25)" }}>
            <Ic name="sparkle" size={16} color="#fff" weight={2} />
          </span>
          <span style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: "-.3px" }}>Hirebrew</span>
          <span style={{ width: 1, height: 18, background: "var(--pf-n100)" }} />
          <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>Letter verification</span>

          <span style={{ flex: 1 }} />

          <PfBadge tone="grey" dot>Public page · no account needed</PfBadge>
          <PfBtn variant="ghost" small icon="user" onClick={() => go("signin")}>Work here? Sign in</PfBtn>
        </div>
      </header>

      {/* ------------------------------- the page ------------------------------- */}
      <div style={{ maxWidth: 1160, margin: "0 auto" }}>
        <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>

          {/* ----------------------------- page title ---------------------------- */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
            <PfTile icon="shield" tone="green" size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ margin: 0, fontSize: 23, fontWeight: 700, letterSpacing: "-.5px", lineHeight: 1.2 }}>
                Is this letter real?
              </h1>
              <div style={{ fontSize: 13.5, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.55, maxWidth: 720 }}>
                Someone has handed you a letter from <strong style={{ color: "var(--pf-n600)", fontWeight: 600 }}>{ISSUER.org}</strong>. This page tells you
                whether that employer really issued it — and deliberately tells you nothing about what it says.
              </div>
            </div>
          </div>

          {/* ------------------------------ the check ---------------------------- */}
          <PfCard style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px", flexWrap: "wrap" }}>
              <QrGlyph token={token} size={62} />
              <div style={{ minWidth: 250 }}>
                <PfTh style={{ marginBottom: 6 }}>Reference printed under the QR code</PfTh>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") run(token); }}
                    spellCheck={false}
                    aria-label="Letter reference"
                    style={{
                      fontFamily: "var(--mono)", fontSize: 15, fontWeight: 600, letterSpacing: "1.2px",
                      color: "var(--pf-n900)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)",
                      borderRadius: 9, padding: "9px 12px", width: 210, outline: "none",
                    }}
                  />
                  <PfBtn variant="primary" icon={checking ? "clock" : "search"} onClick={() => run(token)}>
                    {checking ? "Checking…" : "Verify"}
                  </PfBtn>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 6 }}>
                  Twelve characters in three blocks — e.g. HB-7K2Q-9F4L.
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 240 }}>
                {scanned && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                    <PfBadge tone="blue" dot>Filled in from the code you scanned</PfBadge>
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                  This page
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 6, padding: "2px 6px", marginLeft: 6 }}>{publicUrl}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  <PfBtn small icon="file" onClick={() => toast(`Link to the check on ${query} copied — it resolves to this same page`, "success")}>Copy link</PfBtn>
                  <PfBtn small icon="download" onClick={() => toast(`Confirmation for ${query} prepared for printing — it carries the same five facts and nothing more`)}>Save as PDF</PfBtn>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 20px", borderTop: "1px dashed var(--pf-n100)", background: "var(--pf-n25)", borderRadius: "0 0 12px 12px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase", color: "var(--pf-n300)" }}>Product walkthrough · try each outcome</span>
              <Chip label="Genuine" token={VERIFICATIONS[0].token} onPick={pick} />
              <Chip label="Bank reference" token={VERIFICATIONS[1].token} onPick={pick} />
              <Chip label="Revoked" token={VERIFICATIONS[2].token} onPick={pick} />
              <Chip label="Unknown code" token="HB-0000-0000" onPick={pick} />
            </div>
          </PfCard>

          {/* ------------------------------ the verdict --------------------------- */}
          <PfCard style={{ marginBottom: 12, overflow: "hidden", opacity: checking ? 0.55 : 1, transition: "opacity .18s ease" }}>
            <div style={{ background: skin.band, borderBottom: `1px solid ${skin.line}`, padding: "22px 24px", display: "flex", alignItems: "flex-start", gap: 18 }}>
              <span style={{ width: 60, height: 60, borderRadius: "50%", background: skin.seal, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: v === "unknown" ? "none" : "0 8px 18px -8px rgba(2,6,23,.35)" }}>
                <Ic name={skin.icon} size={30} color={skin.sealInk} weight={2.4} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", color: skin.sub }}>{skin.eyebrow}</div>
                <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-.6px", color: skin.ink, marginTop: 5, lineHeight: 1.15 }}>{skin.title}</div>
                <div style={{ fontSize: 14, marginTop: 8, lineHeight: 1.6, maxWidth: 680 }}>
                  <Say parts={statement} ink={skin.ink} sub={skin.sub} />
                </div>
              </div>
              <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                {v === "unknown" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--pf-red-500)", borderRadius: 6, padding: "4px 9px" }}>
                    <Ic name="x" size={13} color="#fff" weight={2.4} />{skin.chip}
                  </span>
                ) : (
                  <PfBadge tone={skin.chipTone} dot>{skin.chip}</PfBadge>
                )}
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: skin.sub }}>{query || "—"}</span>
              </div>
            </div>

            <div style={{ padding: "12px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--pf-n400)" }}>
                <Ic name="clock" size={14} color="var(--pf-n300)" />Checked {checkedAt}
              </span>
              <span style={{ width: 1, height: 14, background: "var(--pf-n100)" }} />
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Resolved live against {ISSUER.org}&rsquo;s own issuing record.</span>
              <span style={{ flex: 1 }} />
              <PfBtn small icon="warning" onClick={() => toast(`Flagged ${query} to ${ISSUER.unit} — a person reviews suspected forgeries the same working day`, "danger")}>
                This does not match the paper I am holding
              </PfBtn>
            </div>
          </PfCard>

          {/* --------------------- the guarantee, in plain words ------------------- */}
          <PfBanner tone="grey" icon="shield">
            This page confirms that a letter exists and who issued it. It does not show you the letter. You will not see its wording,
            any salary figure, or anything else about this person&rsquo;s employment — not here, and not by asking this page differently.
          </PfBanner>

          {/* -------------------------------- tabs -------------------------------- */}
          <div style={{ margin: "16px -28px 16px" }}>
            <PfPageTabs active={tab} onSelect={setTab} tabs={tabs} />
          </div>

          {/* ============================ TAB · VERIFIED =========================== */}
          {tab === "verified" && (
            <div style={CARD_GRID}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                {result ? (
                  <PfCard>
                    <PfCardHead
                      title="The five facts this page will disclose"
                      sub="Everything below is drawn from the issuing record. Nothing else in that record is readable from here."
                    >
                      <PfBadge tone={v === "valid" ? "green" : "red"}>{v === "valid" ? "Current" : "Withdrawn"}</PfBadge>
                    </PfCardHead>
                    <Row label="Kind of letter">
                      <PfTile icon={LETTER_TEMPLATES.find((t) => t.kind === result.kind)?.icon ?? "file"} tone="blue" size={24} />
                      {result.kind}
                    </Row>
                    <Row label="Issued to">
                      <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", color: "var(--pf-primary-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, flex: "none" }}>
                        {result.subject.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                      </span>
                      {result.subject}
                    </Row>
                    <Row label="Issued by">{result.issuer}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--pf-n400)" }}>· {ISSUER.rc}</span></Row>
                    <Row label="Date of issue">{result.issued}</Row>
                    <Row label="Reference" mono>{result.token}</Row>
                    <Row label="Status" last>
                      {v === "valid" ? (
                        <PfBadge tone="green" dot>Valid — the issuer has not withdrawn it</PfBadge>
                      ) : (
                        <PfBadge tone="red" dot>Revoked — the issuer has withdrawn it</PfBadge>
                      )}
                    </Row>
                  </PfCard>
                ) : (
                  <PfCard>
                    <PfCardHead title="What to do next" sub="An unrecognised reference is not a near miss. Nothing was issued under it." />
                    {[
                      { n: "1", t: "Check the reference character by character", d: "It is twelve characters in three blocks, always beginning HB. A 0 is a zero, never the letter O." },
                      { n: "2", t: "Scan the code rather than typing it", d: "If the letter carries a QR code, point a camera at it. A typed reference is the commonest reason a genuine letter fails to resolve." },
                      { n: "3", t: "Then treat the document as unverified", d: `If it still does not resolve, do not rely on it. Contact ${ISSUER.unit} on ${ISSUER.phone} or ${ISSUER.email} before you act on anything it claims.` },
                    ].map((s) => (
                      <div key={s.n} style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                        <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--pf-n50)", color: "var(--pf-n500)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none", fontFamily: "var(--mono)" }}>{s.n}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.t}</div>
                          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.55 }}>{s.d}</div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: "12px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <PfBtn small icon="chat" onClick={() => toast(`${ISSUER.unit} notified that ${query} failed to resolve — they will call the number on the document`)}>Ask People Ops about this document</PfBtn>
                      <PfBtn small variant="ghost" icon="swap" onClick={() => pick(DEFAULT_TOKEN)}>Try a different reference</PfBtn>
                    </div>
                  </PfCard>
                )}

                {v === "revoked" && (
                  <PfCard style={{ borderColor: "var(--pf-red-100)" }}>
                    <div style={{ display: "flex", gap: 12, padding: "15px 20px" }}>
                      <PfTile icon="warning" tone="red" size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>What &ldquo;revoked&rdquo; means here</div>
                        <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.6 }}>
                          The employer issued this letter and has since withdrawn it. It is not expired, superseded or merely old — it has been
                          cancelled, and the employer is telling you so. This page will not tell you why, and you should not infer a reason. If the
                          bearer needs a current letter, the employer can issue a fresh one with a new reference the same day.
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <PfBtn small icon="chat" onClick={() => toast(`${ISSUER.unit} asked to confirm the status of ${query} — a named officer responds, not this page`, "danger")}>Ask the issuer to confirm in writing</PfBtn>
                        </div>
                      </div>
                    </div>
                  </PfCard>
                )}
              </div>

              {/* --------------------------- standing panel -------------------------- */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PfCard>
                  <PfCardHead title="What you are being shown" sub="And what you are not" />
                  <div style={{ padding: "6px 0 10px" }}>
                    {SHOWN.slice(0, 3).map((s) => <Tick key={s} ok>{s}</Tick>)}
                    {WITHHELD.slice(0, 3).map((s) => <Tick key={s} ok={false}>{s}</Tick>)}
                    <div style={{ padding: "12px 20px 0" }}>
                      <PfBtn small full icon="arrowright" onClick={() => setTab("shows")}>See the full list — {SHOWN.length} shown, {WITHHELD.length} withheld</PfBtn>
                    </div>
                  </div>
                </PfCard>

                <PfCard>
                  <PfCardHead title="Who issued this" sub={`${ISSUER.org} · ${ISSUER.rc}`} />
                  <div style={{ padding: "13px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                    {[
                      { i: "house", t: ISSUER.addr },
                      { i: "chat", t: ISSUER.email },
                      { i: "megaphone", t: ISSUER.phone },
                    ].map((c) => (
                      <div key={c.t} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--pf-n500)" }}>
                        <Ic name={c.i} size={15} color="var(--pf-n300)" />{c.t}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55, borderTop: "1px solid var(--pf-n50)", paddingTop: 10 }}>
                      Verification is offered by the employer, not by a government register. It attests to the fact of issue and nothing beyond it.
                    </div>
                  </div>
                </PfCard>
              </div>
            </div>
          )}

          {/* ============================= TAB · SHOWS ============================= */}
          {tab === "shows" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <PfCard>
                <div style={{ display: "flex", gap: 22, padding: "20px 24px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 300px", minWidth: 260 }}>
                    <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-.2px" }}>Authenticity, without the contents</div>
                    <div style={{ fontSize: 13.5, color: "var(--pf-n500)", marginTop: 7, lineHeight: 1.6 }}>
                      A verification page that showed you the letter would be worse than no verification page: anyone who ever held a
                      person&rsquo;s document could read their salary forever. So this page never receives the letter. It receives a reference,
                      and returns a status. If you need to read the document, the bearer must give it to you — that decision stays theirs.
                    </div>
                    <div style={{ fontSize: 13.5, color: "var(--pf-n500)", marginTop: 10, lineHeight: 1.6 }}>
                      <strong style={{ color: "var(--pf-n900)", fontWeight: 600 }}>If this letter is about you:</strong> the two columns below are the
                      whole of what a stranger holding your QR code can learn. They cannot open the letter, and they cannot ask this page for more.
                    </div>
                  </div>
                  <div style={{ flex: "0 1 430px", minWidth: 280 }}><LetterFigure /></div>
                </div>
              </PfCard>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
                <PfCard>
                  <PfCardHead title="What this page shows you" sub="Five facts, on every letter, without exception">
                    <PfBadge tone="green">{SHOWN.length}</PfBadge>
                  </PfCardHead>
                  {SHOWN.map((s) => <Tick key={s} ok>{s}</Tick>)}
                  <div style={{ padding: "12px 20px", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                    Enough to defeat a forgery. Not enough to profile anybody.
                  </div>
                </PfCard>

                <PfCard>
                  <PfCardHead title="What it will never show you" sub="Not to a bank, not to an embassy, not to us">
                    <PfBadge tone="grey">{WITHHELD.length}</PfBadge>
                  </PfCardHead>
                  {WITHHELD.map((s) => <Tick key={s} ok={false}>{s}</Tick>)}
                  <div style={{ padding: "12px 20px", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                    There is no expanded view, no &ldquo;request full details&rdquo; and no signed-in version of this page that shows more.
                  </div>
                </PfCard>
              </div>

              <PfCard>
                <PfCardHead title="What happens when you scan" sub="NDPR — the record kept about the check itself" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                  {LOGGED.map((l, i) => (
                    <div key={l.k} style={{ display: "flex", gap: 11, padding: "16px 20px", borderRight: i < LOGGED.length - 1 ? "1px solid var(--pf-n50)" : "none" }}>
                      <PfTile icon={l.icon} tone={l.tone} size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{l.k}</div>
                        <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4, lineHeight: 1.55 }}>{l.v}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </PfCard>
            </div>
          )}

          {/* ============================= TAB · ABOUT ============================= */}
          {tab === "about" && (
            <div style={CARD_GRID}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                <PfCard>
                  <PfCardHead title="Why this exists" sub="An employment letter is the easiest document in Nigeria to forge" />
                  <div style={{ padding: "15px 20px", fontSize: 13.5, color: "var(--pf-n500)", lineHeight: 1.65 }}>
                    A letterhead can be copied in an afternoon and a signature scanned in a minute, which is why banks, embassies and landlords
                    end up telephoning switchboards to ask whether a person really works somewhere. {ISSUER.org} publishes this page so that the
                    question has an answer that does not depend on who happens to pick up the phone. Only the employer can settle it — so the
                    employer, not a marketplace or a registry, is who answers here.
                  </div>
                </PfCard>

                <PfCard>
                  <PfCardHead title="How the check works" sub="Three steps, no third party" />
                  {[
                    { n: "1", t: "Every letter is issued with a unique reference", d: "The reference is generated when a named People Ops officer approves the letter — never before, and never in bulk." },
                    { n: "2", t: "The reference is printed as a QR code in the footer", d: "It is the only part of the document this system can read back. The body of the letter is never published anywhere." },
                    { n: "3", t: "This page resolves the reference to a status", d: "Genuine, revoked, or unknown. The lookup returns the five facts on the previous tab and stops there." },
                  ].map((s) => (
                    <div key={s.n} style={{ display: "flex", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                      <span style={{ width: 24, height: 24, borderRadius: 7, background: "var(--pf-primary-50)", color: "var(--pf-primary-600)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none", fontFamily: "var(--mono)" }}>{s.n}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.t}</div>
                        <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.55 }}>{s.d}</div>
                      </div>
                    </div>
                  ))}
                  {resolver && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px", background: "var(--pf-n25)", borderRadius: "0 0 12px 12px", flexWrap: "wrap" }}>
                      <PfBadge tone="green" dot>Live</PfBadge>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n600)" }}>{resolver.contract} {resolver.version}</span>
                      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{resolver.provider} — {resolver.note}</span>
                    </div>
                  )}
                </PfCard>

                <PfCard>
                  <PfCardHead title="Letters this employer issues with a code" sub="Anything outside this list did not come through the verified route">
                    <PfBadge tone="grey">{LETTER_TEMPLATES.length}</PfBadge>
                  </PfCardHead>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>
                    {LETTER_TEMPLATES.map((t) => (
                      <div key={t.kind} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)", borderRight: "1px solid var(--pf-n50)" }}>
                        <PfTile icon={t.icon} tone="blue" size={26} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{t.kind}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "12px 20px", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.55 }}>
                    The kinds are listed so you can recognise the scheme. What any individual letter of that kind says is between the employer and its subject.
                  </div>
                </PfCard>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PfCard style={{ borderColor: "var(--pf-yellow-100)" }}>
                  <div style={{ display: "flex", gap: 11, padding: "15px 20px" }}>
                    <PfTile icon="warning" tone="yellow" size={30} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>No code, no verification</div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 4, lineHeight: 1.6 }}>
                        A paper letter with no QR code, or with a code that does not resolve on this page, has not been verified. Treat it as
                        unverified — not as fake, and not as genuine — until {ISSUER.unit} confirms it directly on {ISSUER.phone}.
                      </div>
                    </div>
                  </div>
                </PfCard>

                <PfCard>
                  <PfCardHead title="No model is involved in this check" sub="FR-093 · explainability" />
                  <div style={{ padding: "14px 20px", fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                    This page performs a lookup. There is no score, no estimate and no inference — a reference either exists in the issuing record
                    or it does not, and the answer is the same for everyone who asks.
                    {draftCard && (
                      <span> The letter itself was drafted from the person record ({draftCard.id} · {draftCard.name}) and, before any code existed,
                        a person approved it: <em style={{ color: "var(--pf-n600)" }}>{draftCard.humanGate.toLowerCase()}</em>.</span>
                    )}
                  </div>
                  <div style={{ padding: "0 20px 14px" }}>
                    <PfBtn small icon="book" onClick={() => toast("Model cards and the security posture live on the public trust page — no login required", "ai")}>Read the trust page</PfBtn>
                  </div>
                </PfCard>

                <PfCard>
                  <PfCardHead title="Report a suspected forgery" sub="A person reviews these, same working day" />
                  <div style={{ padding: "14px 20px", fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                    If a document is quoting {ISSUER.org} and this page cannot confirm it, the employer wants to know — a forged letter is a
                    problem for them long before it is a problem for you.
                  </div>
                  <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <PfBtn small variant="danger" icon="warning" onClick={() => toast(`Report filed against ${query} — ${ISSUER.unit} reviews it today and replies to the address you leave with them`, "danger")}>Report {query}</PfBtn>
                    <PfBtn small variant="ghost" icon="chat" onClick={() => toast(`${ISSUER.unit} · ${ISSUER.email} — quote the reference ${query} in the subject line`)}>Email People Ops</PfBtn>
                  </div>
                </PfCard>
              </div>
            </div>
          )}

          {/* -------------------------------- footer ------------------------------- */}
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--pf-n100)", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <Ic name="shield" size={16} color="var(--pf-n300)" />
            <div style={{ flex: "1 1 460px", minWidth: 280, fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.65 }}>
              This verification is offered by {ISSUER.org} as an anti-forgery measure for the letters it issues. A paper letter with no working
              QR code should be treated as unverified. The page confirms the fact of issue only — never the contents — and keeps no record of who checked.
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Powered by Hirebrew · NDPR-conscious by design</span>
              <PfBtn small variant="ghost" onClick={() => toast("Privacy notice for the public verification page opened — it is one page long")}>Privacy notice</PfBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
