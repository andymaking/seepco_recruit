"use client";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfAvatar, PfTabs, PfPageTabs, PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  LETTER_REQUESTS, LETTER_TEMPLATES, letterSla,
  type LetterKind, type LetterRequest, type LetterState, type LetterTemplate,
} from "@/data/hrops";
import {
  QR_VERIFY, SEED_LEAVE_REQUESTS, activeAdapter,
  type LetterVerification, type LeaveRequestRow,
} from "@/data/adapters";
import { WORKER_TYPE_LABEL, workerById } from "@/data/workforce";
import { MODEL_CARDS } from "@/data/trust";
import {
  ME_ID, ME_PUBLIC, ME_FIRST, MY_MANAGER, MY_TIMELINE_SELF,
  MY_PROFILE_FIELDS, MY_RETENTION_NOTE,
} from "@/data/me";

/**
 * My letters — FR-086, the EMPLOYEE side of HR letter issuance.
 *
 * The Nigerian ritual this replaces: you email HR, HR asks for your details back,
 * you re-key what the company already holds, and three weeks later a letter comes
 * out with your grade wrong. Here you pick the letter, the fields are drawn off
 * your own record, and a 24-hour clock starts running in the open.
 *
 * Reads, not engines (v2.1 §2.2): this page issues nothing. People Ops drafts,
 * edits and approves; the AI only fills a template from record fields, and its
 * "Why this?" names MC-05. Nothing on this page computes pay, and a bank
 * reference states no salary unless HR adds it by hand.
 *
 * The anti-forgery property is the release’s point, so the verify tab explains it
 * in the words a bank teller would use: the QR proves the letter is genuine, and
 * proves it WITHOUT showing whoever scans it what the letter says.
 *
 * Me-pillar scope: E-0214 and nobody else. LETTER_REQUESTS holds four people’s
 * requests; three of them are filtered out here, and the try-it verifier refuses
 * to open a code that belongs to somebody else’s letter.
 */

/* ---------------------------------- subject -------------------------------- */

const ME = ME_PUBLIC;
const ISSUER = "Unrealabs Limited";
const DESK = "People Ops";
const SLA_HOURS = 24;
const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";

const MY_WORKER = workerById(ME_ID);
/** "Employee · Confirmed" — her worker record (FR-082), not a status she typed. */
const MY_STATUS = MY_WORKER
  ? `${WORKER_TYPE_LABEL[MY_WORKER.workerType]} · ${MY_WORKER.state}`
  : "Employee · Confirmed";

/** Her own timeline, self-view: [0] hire, [1] the L5 promotion. */
const MY_START = MY_TIMELINE_SELF[0].date;      // Nov 2023
const MY_PROMO_DATE = MY_TIMELINE_SELF[1].date; // May 2025
/** Her pre-promotion grade — the promotion entry is L5, so the grade it replaced was L4. */
const OLD_GRADE = "L4";

/** Her approved leave — the embassy letter’s dates come from here, not from a form. */
const MY_LEAVE: LeaveRequestRow | undefined =
  SEED_LEAVE_REQUESTS.find((l) => l.workerId === ME_ID && l.state === "Approved");
/** First working day after the leave ends (Sep 18, 2026 is a Friday). */
const RESUME = "Sep 21";

/** Her own requests. The other three rows in the register belong to other people. */
const MY_SEED: LetterRequest[] = LETTER_REQUESTS.filter((r) => r.workerId === ME_ID);
const NOT_MINE = LETTER_REQUESTS.length - MY_SEED.length;

const PROFILE_WRONG = MY_PROFILE_FIELDS.find((f) => f.wrong);

const MC05 = MODEL_CARDS.find((m) => m.id === "MC-05")!;
const VERIFY_ADAPTER = activeAdapter("letter_verify");

/* --------------------------------- templates ------------------------------- */

/** Probation confirmation is not raised by hand — FR-087 emits it on the decision. */
const REQUESTABLE: LetterTemplate[] = LETTER_TEMPLATES.filter((t) => t.kind !== "Probation confirmation");
const PROBATION = LETTER_TEMPLATES.find((t) => t.kind === "Probation confirmation");

const NEEDS_ADDRESS: LetterKind[] = ["Embassy / visa introduction", "Bank reference"];

const ADDRESS_HINT: Partial<Record<LetterKind, { label: string; placeholder: string; salutation: string; chips: string[] }>> = {
  "Embassy / visa introduction": {
    label: "Addressed to",
    placeholder: "e.g. Embassy of the Netherlands, Abuja",
    salutation: "The Visa Section",
    chips: [
      "Embassy of the Netherlands, Abuja",
      "British High Commission, Abuja",
      "U.S. Consulate General, Lagos",
      "High Commission of Canada, Abuja",
    ],
  },
  "Bank reference": {
    label: "Addressed to",
    placeholder: "e.g. Guaranty Trust Bank",
    salutation: "The Branch Manager",
    chips: ["Guaranty Trust Bank", "Access Bank", "Zenith Bank", "Stanbic IBTC"],
  },
};

type Fill = { label: string; value: string; source: string };

/** Every field the draft may touch, and where each one was read from. */
const fillsFor = (kind: LetterKind): Fill[] => {
  const t = LETTER_TEMPLATES.find((x) => x.kind === kind);
  const map: Record<string, Fill> = {
    "Full name": { label: "Full name", value: ME.name, source: "your person record" },
    "Role & grade": { label: "Role & grade", value: `${ME.role} · Grade ${ME.grade}`, source: "your person record" },
    Role: { label: "Role", value: ME.role, source: "your person record" },
    "Start date": { label: "Start date", value: MY_START, source: "your hire record — carried from Pillar 1" },
    "Employment status": { label: "Employment status", value: MY_STATUS, source: "your worker record (FR-082)" },
    Tenure: { label: "Tenure", value: ME.tenure, source: "your person record" },
    "Approved leave dates": {
      label: "Approved leave dates",
      value: MY_LEAVE ? `${MY_LEAVE.id} · ${MY_LEAVE.from}–${MY_LEAVE.to} 2026 (${MY_LEAVE.days}d) · ${MY_LEAVE.state}` : "No approved leave on record",
      source: MY_LEAVE ? `your leave record · approved by ${MY_LEAVE.approver}` : "your leave record",
    },
    "Return date": { label: "Return date", value: `${RESUME} 2026`, source: "first working day after your leave ends" },
    "Old grade": { label: "Old grade", value: OLD_GRADE, source: `your promotion record — ${MY_PROMO_DATE}` },
    "New grade": { label: "New grade", value: ME.grade, source: "your person record" },
    "Effective date": { label: "Effective date", value: MY_PROMO_DATE, source: "your promotion record" },
    "Probation end": { label: "Probation end", value: "—", source: "the confirmation decision (FR-087)" },
    Decision: { label: "Decision", value: "—", source: "the confirmation decision (FR-087)" },
  };
  return (t?.fills ?? []).map((f) => map[f] ?? { label: f, value: "—", source: "your record" });
};

/** A template fill over those fields — never a free composition. */
const previewBody = (kind: LetterKind): string => {
  switch (kind) {
    case "Employment confirmation":
      return `This is to confirm that ${ME.name} has been employed by ${ISSUER} as a ${ME.role} (Grade ${ME.grade}) since ${MY_START}, and remains in our employment as at the date of this letter.`;
    case "Bank reference":
      return `This is to confirm that ${ME.name} is employed by ${ISSUER} as a ${ME.role} and has been in our employment for ${ME.tenure}. This reference is issued at the employee’s request and states no salary information.`;
    case "Embassy / visa introduction":
      return `This is to introduce ${ME.name}, ${ME.role} at ${ISSUER} since ${MY_START}. ${ME_FIRST} has been granted approved annual leave from ${MY_LEAVE?.from ?? "—"} to ${MY_LEAVE?.to ?? "—"} 2026 and is expected to resume duty on ${RESUME} 2026.`;
    case "Promotion":
      return `This is to confirm the promotion of ${ME.name} to ${ME.role}, from Grade ${OLD_GRADE} to Grade ${ME.grade}, effective ${MY_PROMO_DATE}.`;
    default:
      return `This is to confirm the outcome of ${ME.name}’s probation period, as recorded in the confirmation decision.`;
  }
};

/** Notes that belong to a specific letter, not to letters in general. */
const KIND_NOTE: Partial<Record<LetterKind, { icon: string; tone: PfTone; text: string }>> = {
  "Bank reference": {
    icon: "wallet", tone: "yellow",
    text: "Your salary is not stated. A bank reference confirms that you are employed and for how long — People Ops adds a figure only if you ask for one and they agree to it.",
  },
  "Embassy / visa introduction": {
    icon: "calendar", tone: "blue",
    text: "The leave dates are read from your approved leave record, so the letter and the leave register cannot disagree. If your dates change, change the leave first and request the letter after.",
  },
  Promotion: {
    icon: "arrowup", tone: "purple",
    text: "Both grades and the effective date come off your promotion record. Nothing here re-decides a promotion — it restates one that already happened.",
  },
  "Employment confirmation": {
    icon: "shield", tone: "green",
    text: "The most-requested letter in Nigerian HR, by a distance. Landlords, schools and banks all ask for it, and every copy carries a QR they can check themselves.",
  },
};

const STATE_TONE: Record<LetterState, PfTone> = {
  Requested: "grey", Drafted: "blue", Approved: "purple", Issued: "green", Declined: "red",
};

const PIPE: LetterState[] = ["Requested", "Drafted", "Approved", "Issued"];

const PIPE_SUB: Record<string, string> = {
  Requested: `With ${DESK}`,
  Drafted: "AI fills the template from your record",
  Approved: `${DESK} reads it and signs off`,
  Issued: "Letterhead, signature block and QR",
};

const KIND_ICON: Record<LetterKind, string> = Object.fromEntries(
  LETTER_TEMPLATES.map((t) => [t.kind, t.icon]),
) as Record<LetterKind, string>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const nowLabel = () => {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ------------------------------- QR rendering ------------------------------- */

const hash32 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const QR_N = 25;

/**
 * A deterministic module grid for a token — finder patterns, separators, timing
 * rows and an alignment block around a hashed data field. It is a RENDERING of
 * the code, not an encoder: what the resolver reads is the token, not the pixels.
 */
const qrModules = (token: string): boolean[][] => {
  const grid = Array.from({ length: QR_N }, () => Array<boolean>(QR_N).fill(false));
  const held = Array.from({ length: QR_N }, () => Array<boolean>(QR_N).fill(false));

  const finder = (r0: number, c0: number) => {
    for (let r = -1; r < 8; r++) {
      for (let c = -1; c < 8; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= QR_N || cc >= QR_N) continue;
        held[rr][cc] = true;
        const ring = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rr][cc] = ring || core;
      }
    }
  };
  finder(0, 0); finder(0, QR_N - 7); finder(QR_N - 7, 0);

  const a0 = QR_N - 9;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      held[a0 + r][a0 + c] = true;
      grid[a0 + r][a0 + c] = r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2);
    }
  }

  for (let i = 8; i < QR_N - 8; i++) {
    held[6][i] = true; grid[6][i] = i % 2 === 0;
    held[i][6] = true; grid[i][6] = i % 2 === 0;
  }
  held[QR_N - 8][8] = true; grid[QR_N - 8][8] = true; // dark module

  let h = hash32(token);
  for (let r = 0; r < QR_N; r++) {
    for (let c = 0; c < QR_N; c++) {
      if (held[r][c]) continue;
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      grid[r][c] = ((h >>> 13) & 1) === 1;
    }
  }
  return grid;
};

function QrBlock({ token, size = 172 }: { token: string; size?: number }) {
  const g = useMemo(() => qrModules(token), [token]);
  const q = 2;
  const dim = QR_N + q * 2;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--pf-n50)", borderRadius: 12, padding: 10, flex: "none", boxShadow: "0 1px 3px 0 #f3f3f3" }}>
      <svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label={`Verification code ${token}`}>
        <rect x={0} y={0} width={dim} height={dim} fill="#fff" />
        {g.map((row, r) => (
          <g key={r}>
            {row.map((on, c) => (on ? <rect key={c} x={c + q} y={r + q} width={1} height={1} fill="var(--pf-n900)" /> : null))}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* -------------------------------- small pieces ------------------------------ */

const INPUT: CSSProperties = {
  fontFamily: "inherit", fontSize: 13, fontWeight: 500, color: "var(--pf-n900)",
  background: "var(--pf-n0)", border: "1px solid var(--pf-n50)",
  boxShadow: "0 0 0 0.5px rgba(42,42,42,.06)", borderRadius: 8,
  padding: "9px 11px", width: "100%", outline: "none",
};

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{children}</span>
      {hint && <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{hint}</span>}
    </div>
  );
}

function Note({ icon = "info", tone = "grey", children }: { icon?: string; tone?: PfTone; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <Ic name={icon} size={13} color={TONE[tone].fg} />
      <span style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
        padding: "5px 11px", borderRadius: 999, whiteSpace: "nowrap", lineHeight: 1.35,
        color: active ? "var(--pf-primary-600)" : "var(--pf-n500)",
        background: active ? "var(--pf-primary-50)" : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
      }}
    >
      {children}
    </button>
  );
}

function KV({ f }: { f: Fill }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--pf-n25)" }}>
      <div style={{ width: 150, flex: "none" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{f.label}</div>
        <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 2 }}>{f.source}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.45 }}>{f.value}</div>
      <PfBadge tone="green">read</PfBadge>
    </div>
  );
}

/** FR-093 — the same affordance every AI output in the product carries. */
function WhyThisBox({ kind }: { kind: LetterKind }) {
  const [open, setOpen] = useState(false);
  const fills = fillsFor(kind);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n50)", border: "0.6px solid var(--pf-n100)", borderRadius: 5, padding: "4px 9px", cursor: "pointer" }}
      >
        <Ic name="question" size={12} color="var(--pf-n500)" />
        Why this draft?
        <Ic name={open ? "caretdown" : "caretright"} size={11} color="var(--pf-n500)" />
      </button>
      {open && (
        <div style={{ marginTop: 8, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.45 }}>
            Every sentence is a template fill over the fields below. The model composes nothing about you that is not already on your record.
          </div>
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 5 }}>
            {fills.map((f) => (
              <div key={f.label} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <Ic name="check" size={12} color="var(--pf-purple-500)" />
                <span style={{ fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                  <b style={{ color: "var(--pf-n900)" }}>{f.label}</b> — {f.value} · <span style={{ color: "var(--pf-n400)" }}>{f.source}</span>
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 9, borderTop: "1px solid var(--pf-purple-100)" }}>
            <PfBadge tone="purple">{MC05.id} · {MC05.name}</PfBadge>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Inputs: {MC05.inputs}</span>
            <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>· Human gate: {MC05.humanGate}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- SLA clock -------------------------------- */

/** The acceptance criterion made visible: a clock, on the letter, on her page. */
function SlaClock({ r, size = 30 }: { r: LetterRequest; size?: number }) {
  const sla = letterSla(r);
  const t = TONE[sla.tone];
  const frac = r.state === "Issued" ? 1 : Math.min(r.hoursElapsed / SLA_HOURS, 1);
  const R = size / 2 - 2.5;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
      <span style={{ position: "relative", width: size, height: size, display: "inline-flex" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={3.2} />
          <circle
            cx={size / 2} cy={size / 2} r={R} fill="none" stroke={t.fg} strokeWidth={3.2} strokeLinecap="round"
            strokeDasharray={`${frac * C} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Ic name={r.state === "Issued" ? "check" : "clock"} size={size * 0.42} color={t.fg} weight={r.state === "Issued" ? 2.6 : 1.8} />
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.fg, whiteSpace: "nowrap" }}>{sla.label}</span>
        <span style={{ fontSize: 10.5, color: "var(--pf-n300)", whiteSpace: "nowrap" }}>{SLA_HOURS}h target</span>
      </span>
    </div>
  );
}

/** The whole 24-hour track — where this request sits against the promise. */
function SlaTrack({ r }: { r: LetterRequest }) {
  const sla = letterSla(r);
  const pct = Math.min((r.hoursElapsed / SLA_HOURS) * 100, 100);
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>
          {r.hoursElapsed}h since you asked{r.state === "Issued" ? " · closed" : ""}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: TONE[sla.tone].fg }}>{sla.label}</span>
      </div>
      <div style={{ position: "relative" }}>
        <PfProgress pct={pct} tone={sla.tone} height={6} />
        <span style={{ position: "absolute", left: "75%", top: -2, width: 1.5, height: 10, background: "var(--pf-n100)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10.5, color: "var(--pf-n300)" }}>
        <span>0h</span><span>18h</span><span>24h target</span>
      </div>
    </div>
  );
}

function Pipeline({ state }: { state: LetterState }) {
  const idx = PIPE.indexOf(state);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${PIPE.length}, minmax(0,1fr))`, gap: 8 }}>
      {PIPE.map((s, i) => {
        const done = idx >= 0 && i < idx;
        const now = i === idx;
        const tone: PfTone = done ? "green" : now ? "blue" : "grey";
        return (
          <div
            key={s}
            style={{
              background: now ? TONE.blue.soft : "var(--pf-n25)",
              border: `1px solid ${now ? "var(--pf-blue-100)" : "var(--pf-n50)"}`,
              borderRadius: 10, padding: "10px 12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: done || now ? TONE[tone].bg : "var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                {done ? <Ic name="check" size={10} color="#fff" weight={3} /> : <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>{i + 1}</span>}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: done || now ? "var(--pf-n900)" : "var(--pf-n400)" }}>{s}</span>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.4 }}>{PIPE_SUB[s]}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ template cards ------------------------------ */

function TemplateCard({ t, active, onSelect }: { t: LetterTemplate; active: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  const tone: PfTone = active ? "green" : "grey";
  return (
    <button
      {...hoverProps}
      onClick={onSelect}
      style={{
        textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        background: "var(--pf-n0)",
        border: `1px solid ${active ? "var(--pf-primary-500)" : "var(--pf-n50)"}`,
        boxShadow: active ? "0 0 0 3px var(--pf-primary-50)" : hovered ? "0 4px 14px -8px rgba(2,6,23,.22)" : "0 1px 3px 0 #f3f3f3",
        borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 9,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfTile icon={t.icon} tone={active ? "green" : "blue"} size={30} />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{t.kind}</span>
        {active ? <PfBadge tone="green" dot>Selected</PfBadge> : <Ic name="caretright" size={15} color="var(--pf-n300)" />}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>{t.blurb}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
        <PfBadge tone={tone}>{t.fills.length} fields, none typed by you</PfBadge>
        <PfBadge tone="blue">{t.slaHours}h</PfBadge>
        {NEEDS_ADDRESS.includes(t.kind) && <PfBadge tone="purple">needs an addressee</PfBadge>}
      </div>
    </button>
  );
}

/* --------------------------------- letter view ------------------------------ */

function LetterSheet({ kind, addressedTo, body, issuedAt, token }: {
  kind: LetterKind; addressedTo?: string; body: string; issuedAt?: string; token?: string;
}) {
  const hint = ADDRESS_HINT[kind];
  return (
    <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 11, borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTile icon="shield" tone="green" size={26} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{ISSUER}</div>
          <div style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{DESK} · Lagos</div>
        </div>
        <span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{issuedAt ?? "Dated on issue"}</span>
      </div>
      <div style={{ paddingTop: 13, display: "flex", flexDirection: "column", gap: 9 }}>
        {addressedTo && (
          <div style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>
            {hint?.salutation ?? "To whom it may concern"}<br />
            <b style={{ color: "var(--pf-n900)" }}>{addressedTo}</b>
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: ".2px", textTransform: "uppercase" }}>
          {kind}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.65 }}>{body}</div>
        <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.6 }}>Yours faithfully,</div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 9, borderTop: "1px dashed var(--pf-n100)" }}>
          <Ic name={token ? "check" : "clock"} size={14} color={token ? "var(--pf-primary-500)" : "var(--pf-n300)"} />
          <span style={{ fontSize: 11, color: "var(--pf-n400)", flex: 1 }}>
            {token
              ? `Signed for ${DESK}, with verification code ${token} printed under the signature block.`
              : "Letterhead, signature block and the QR code are added when People Ops issues it."}
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================== */

export default function MyLetters() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<"request" | "mine" | "verify">("request");

  /* ------------------------------- the request ------------------------------ */
  const [kind, setKind] = useState<LetterKind>(REQUESTABLE[0].kind);
  const [addressedTo, setAddressedTo] = useState("");
  const [delivery, setDelivery] = useState("Signed PDF");
  const [note, setNote] = useState("");

  /* ------------------------------- session rows ----------------------------- */
  const [sessionRows, setSessionRows] = useState<LetterRequest[]>([]);
  const [openId, setOpenId] = useState<string | null>(MY_SEED[0]?.id ?? null);

  /* --------------------------------- verify --------------------------------- */
  const [probe, setProbe] = useState("");
  const [checked, setChecked] = useState<{ token: string; hit: LetterVerification | null; otherOwner: boolean } | null>(null);

  const template = LETTER_TEMPLATES.find((t) => t.kind === kind) ?? REQUESTABLE[0];
  const hint = ADDRESS_HINT[kind];
  const needsAddress = NEEDS_ADDRESS.includes(kind);
  const fills = useMemo(() => fillsFor(kind), [kind]);
  const body = useMemo(() => previewBody(kind), [kind]);

  const rows: LetterRequest[] = useMemo(() => [...sessionRows, ...MY_SEED], [sessionRows]);
  const issued = rows.filter((r) => r.state === "Issued");
  const inFlight = rows.filter((r) => r.state !== "Issued" && r.state !== "Declined");
  const lastIssued = issued[0];
  const openRow = rows.find((r) => r.id === openId) ?? null;

  /* --------------------------------- actions -------------------------------- */

  const submit = () => {
    if (needsAddress && !addressedTo.trim()) {
      toast(`Say who the ${kind.toLowerCase()} is addressed to — ${hint?.salutation.toLowerCase() ?? "a recipient"} cannot be left blank`, "danger");
      return;
    }
    const id = `LT-${123 + sessionRows.length}`;
    const row: LetterRequest = {
      id, workerId: ME_ID, subject: ME.name, kind,
      state: "Requested", requested: nowLabel(), hoursElapsed: 0,
      addressedTo: addressedTo.trim() || undefined,
      draft: body,
    };
    setSessionRows((prev) => [row, ...prev]);
    setOpenId(id);
    setTab("mine");
    const carried = note.trim() ? ", with your note attached" : "";
    setAddressedTo("");
    setNote("");
    toast(`${kind} requested — ${id} is with ${DESK}${carried} and the ${SLA_HOURS}-hour clock has started`, "success");
  };

  const withdraw = (r: LetterRequest) => {
    setSessionRows((prev) => prev.filter((x) => x.id !== r.id));
    setOpenId(MY_SEED[0]?.id ?? null);
    toast(`${r.id} withdrawn — your ${r.kind.toLowerCase()} request is no longer with ${DESK}`, "danger");
  };

  const check = () => {
    const token = probe.toUpperCase().trim();
    if (!token) { toast("Type a verification code first — it looks like HB-XXXX-XXXX", "danger"); return; }
    const hit = QR_VERIFY.resolve(token);
    /** Me-pillar guard: a code that resolves to somebody else’s letter never renders here. */
    const mine = !!hit && hit.subject === ME.name;
    setChecked({ token, hit: mine ? hit : null, otherOwner: !!hit && !mine });
    if (mine && hit) toast(`${token} resolves — your ${hit.kind.toLowerCase()}, issued ${hit.issued}`, "success");
    else if (hit) toast("That code belongs to someone else’s letter — this checker only opens your own", "danger");
    else toast(`No letter of yours carries the code ${token}`, "danger");
  };

  /* ---------------------------------- view ---------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <PfAvatar init={ME.init} tone={ME.tone} size={30} />
            <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>My letters</div>
            <PfBadge tone="grey">{ME.id}</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 5, lineHeight: 1.5 }}>
            Ask for the letters Nigerian HR actually issues, without re-typing a single thing the company already holds about you.
            You get a {SLA_HOURS}-hour clock you can watch, and every issued letter carries a code a bank or an embassy can check for itself.
          </div>
        </div>
        <PfBtn variant="secondary" icon="shield" onClick={() => setTab("verify")}>How verification works</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => setTab("request")}>Request a letter</PfBtn>
      </div>

      {/* ------------------------------- KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <PfStat
          icon="file" tone="green" label="Issued to you"
          value={issued.length} unit={issued.length === 1 ? "letter" : "letters"}
          delta={issued.length ? "Each one verifiable" : "None yet"} deltaTone={issued.length ? "green" : "grey"}
        />
        <PfStat
          icon="clock" tone="blue" label={`With ${DESK}`}
          value={inFlight.length} unit={inFlight.length === 1 ? "request" : "requests"}
          delta={inFlight.length ? letterSla(inFlight[0]).label : "Nothing pending"}
          deltaTone={inFlight.length ? letterSla(inFlight[0]).tone : "grey"}
        />
        <PfStat
          icon="gauge" tone="purple" label="Your last turnaround"
          value={lastIssued ? `${lastIssued.hoursElapsed}h` : "—"} unit={`against ${SLA_HOURS}h`}
          delta={lastIssued ? "Inside the promise" : "No history"} deltaTone={lastIssued ? "green" : "grey"}
        />
        <PfStat
          icon="stack" tone="yellow" label="You can request"
          value={REQUESTABLE.length} unit="letter types"
          delta="No forms to fill" deltaTone="blue"
        />
      </div>

      {/* ------------------------------ section tabs ---------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as typeof tab)}
          tabs={[
            { key: "request", label: "Request a letter" },
            { key: "mine", label: "My letters", count: String(rows.length) },
            { key: "verify", label: "How verification works" },
          ]}
        />
      </div>

      {/* ================================ REQUEST ================================ */}
      {tab === "request" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="sparkle">
            Pick a letter and it fills itself from your record — name, role, grade, start date, leave dates. The only thing you may
            need to type is who it is addressed to.
          </PfBanner>

          {/* ------------------------------ the choices ------------------------------ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            {REQUESTABLE.map((t) => (
              <TemplateCard key={t.kind} t={t} active={t.kind === kind} onSelect={() => setKind(t.kind)} />
            ))}
          </div>

          {PROBATION && (
            <PfCard>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px" }}>
                <PfTile icon={PROBATION.icon} tone="grey" size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{PROBATION.kind} — not requested by hand</div>
                  <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>{PROBATION.blurb}</div>
                </div>
                <PfBadge tone="grey">Issued automatically</PfBadge>
              </div>
            </PfCard>
          )}

          {/* ---------------------------- the selected one --------------------------- */}
          <PfCard>
            <PfCardHead
              title={template.kind}
              sub={`${template.fills.length} fields, all read from your record · ${DESK} answers within ${template.slaHours} hours`}
            >
              <PfBadge tone="blue" dot>{template.slaHours}h SLA</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 20, padding: "16px 20px" }}>
              {/* ---------------------------- what it contains --------------------------- */}
              <div style={{ minWidth: 0 }}>
                <Label hint="nothing here is typed by you">What this letter will contain</Label>
                <div>
                  {fills.map((f) => <KV key={f.label} f={f} />)}
                </div>

                {PROFILE_WRONG && (
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "10px 13px" }}>
                    <Ic name="warning" size={15} color="var(--pf-yellow-500)" />
                    <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                      A letter is only ever as right as the record behind it. Your import still shows{" "}
                      <b style={{ color: "var(--pf-n900)" }}>{PROFILE_WRONG.field} {PROFILE_WRONG.imported}</b> where it should read{" "}
                      <b style={{ color: "var(--pf-n900)" }}>{PROFILE_WRONG.correct}</b> — fix it before you ask for a letter that quotes it.
                    </span>
                    <PfBtn small variant="secondary" onClick={() => go("myprofile")}>My profile</PfBtn>
                  </div>
                )}

                {/* --------------------------- addressed to --------------------------- */}
                {needsAddress && hint && (
                  <div style={{ marginTop: 14 }}>
                    <Label hint="required for this letter">{hint.label}</Label>
                    <input
                      value={addressedTo}
                      onChange={(e) => setAddressedTo(e.target.value)}
                      placeholder={hint.placeholder}
                      style={INPUT}
                    />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {hint.chips.map((c) => (
                        <Chip key={c} active={addressedTo === c} onClick={() => setAddressedTo(c)}>{c}</Chip>
                      ))}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <Note icon="info">
                        The addressee is the one thing the record cannot know. It goes in the salutation only — it is not stored
                        against your profile and it does not appear on the public verification page.
                      </Note>
                    </div>
                  </div>
                )}

                {/* ------------------------------ delivery ----------------------------- */}
                <div style={{ marginTop: 14 }}>
                  <Label hint="how you want to collect it">Delivery</Label>
                  <PfTabs tabs={["Signed PDF", "Stamped hard copy"]} active={delivery} onChange={setDelivery} />
                  <div style={{ marginTop: 8 }}>
                    <Note icon={delivery === "Signed PDF" ? "download" : "house"} tone={delivery === "Signed PDF" ? "green" : "blue"}>
                      {delivery === "Signed PDF"
                        ? "Lands on this page with the QR block, ready to forward. Most banks and landlords accept it as is."
                        : `Printed on letterhead and stamped — ${DESK} will tell you when it is ready to collect at the Lagos office. Missions usually want the stamped copy.`}
                    </Note>
                  </div>
                </div>

                {/* -------------------------------- note ------------------------------- */}
                <div style={{ marginTop: 14 }}>
                  <Label hint="optional">Anything People Ops should know</Label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. the mission wants it dated within 30 days of my appointment"
                    style={{ ...INPUT, resize: "vertical", lineHeight: 1.5 }}
                  />
                </div>
              </div>

              {/* ------------------------------- preview ------------------------------ */}
              <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <Label hint="drafted, not issued">What the draft will say</Label>
                  <LetterSheet kind={kind} addressedTo={addressedTo.trim() || undefined} body={body} />
                </div>

                <WhyThisBox kind={kind} />

                {KIND_NOTE[kind] && (
                  <div style={{ background: TONE[KIND_NOTE[kind]!.tone].soft, border: `1px solid ${TONE[KIND_NOTE[kind]!.tone].line}`, borderRadius: 10, padding: "11px 13px", display: "flex", gap: 9 }}>
                    <Ic name={KIND_NOTE[kind]!.icon} size={15} color={TONE[KIND_NOTE[kind]!.tone].fg} />
                    <span style={{ fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{KIND_NOTE[kind]!.text}</span>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="user" tone="purple">
                    {DESK} edits and approves every letter before it is issued. The model drafts; it never signs, and it never
                    issues ({MC05.humanGate.toLowerCase()}).
                  </Note>
                  <Note icon="shield" tone="green">
                    A copy stays on your record — {MY_RETENTION_NOTE.toLowerCase()} — and you can re-download it here at any time.
                  </Note>
                </div>
              </div>
            </div>

            {/* --------------------------------- submit -------------------------------- */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", borderRadius: "0 0 12px 12px" }}>
              <PfTile icon="clock" tone="blue" size={30} />
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                  Expect it inside {template.slaHours} hours
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2 }}>
                  The clock starts the moment you press request, and you can watch it on My letters. It does not pause overnight.
                </div>
              </div>
              <PfBtn variant="secondary" onClick={() => toast(`Draft kept on this page — nothing has gone to ${DESK} yet`)}>
                Keep as draft
              </PfBtn>
              <PfBtn variant="primary" icon="paperplane" onClick={submit}>
                Request {template.kind.toLowerCase()}
              </PfBtn>
            </div>
          </PfCard>

          {/* ------------------------- what happens after ------------------------- */}
          <PfCard>
            <PfCardHead title="What happens after you press request" sub="Four steps, one of them yours. FR-086." />
            <div style={{ padding: "16px 20px" }}>
              <Pipeline state="Requested" />
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================== MINE ================================= */}
      {tab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone={inFlight.length ? "blue" : "green"} icon={inFlight.length ? "clock" : "check"}>
            {inFlight.length
              ? `${inFlight.length} ${inFlight.length === 1 ? "request is" : "requests are"} with ${DESK} — ${letterSla(inFlight[0]).label.toLowerCase()} on the oldest.`
              : `Nothing pending. Your last letter came back in ${lastIssued?.hoursElapsed ?? 0} hours against a ${SLA_HOURS}-hour promise.`}
          </PfBanner>

          {/* --------------------------------- table -------------------------------- */}
          <PfCard>
            <PfCardHead title="Your requests" sub={`Only yours. ${NOT_MINE} other requests sit in the register today and none of them render here.`}>
              <PfBtn small variant="secondary" icon="plus" onClick={() => setTab("request")}>New request</PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.1fr 26px", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Letter</PfTh>
              <PfTh>Requested</PfTh>
              <PfTh>Status</PfTh>
              <PfTh>{SLA_HOURS}-hour clock</PfTh>
              <PfTh />
            </div>

            {rows.map((r) => {
              const open = r.id === openId;
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenId(open ? null : r.id)}
                  style={{
                    width: "100%", textAlign: "left", fontFamily: "inherit", cursor: "pointer",
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.1fr 26px", gap: 12, alignItems: "center",
                    padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)",
                    background: open ? "var(--pf-primary-50)" : "var(--pf-n0)", border: "none",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <PfTile icon={KIND_ICON[r.kind] ?? "file"} tone={r.state === "Issued" ? "green" : "blue"} size={30} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.kind}</span>
                      <span style={{ display: "block", fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>
                        <span style={{ fontFamily: MONO }}>{r.id}</span>
                        {r.addressedTo ? ` · ${r.addressedTo}` : ""}
                      </span>
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>{r.requested}</span>
                  <span><PfBadge tone={STATE_TONE[r.state]} dot>{r.state}</PfBadge></span>
                  <SlaClock r={r} size={28} />
                  <Ic name={open ? "caretdown" : "caretright"} size={15} color="var(--pf-n300)" />
                </button>
              );
            })}

            {/* ------------------------------ open row ------------------------------ */}
            {openRow && (
              <div style={{ padding: "18px 20px", background: "var(--pf-n25)", borderRadius: "0 0 12px 12px" }}>
                {openRow.state === "Issued" && openRow.token ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20 }}>
                    {/* the letter itself */}
                    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                      <LetterSheet
                        kind={openRow.kind}
                        addressedTo={openRow.addressedTo}
                        body={openRow.draft ?? previewBody(openRow.kind)}
                        issuedAt={openRow.issued}
                        token={openRow.token}
                      />
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <PfBtn variant="primary" icon="download" onClick={() => toast(`${openRow.kind} downloaded — signed PDF, ${openRow.token} printed under the signature block`, "success")}>
                          Download PDF
                        </PfBtn>
                        <PfBtn variant="secondary" icon="paperplane" onClick={() => toast(`Verification link copied — ${QR_VERIFY.publicUrl(openRow.token!)}`, "success")}>
                          Copy verification link
                        </PfBtn>
                        <PfBtn variant="ghost" icon="clock" onClick={() => toast(`Issued ${openRow.issued} · ${openRow.hoursElapsed}h after you asked, against a ${SLA_HOURS}h promise`)}>
                          Turnaround
                        </PfBtn>
                      </div>
                      <Note icon="shield" tone="green">
                        A copy is held on your record — {MY_RETENTION_NOTE.toLowerCase()}. Re-issuing mints a new code and retires this one.
                      </Note>
                    </div>

                    {/* the QR block */}
                    <div style={{ minWidth: 0 }}>
                      <PfCard pad={16}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                          <PfTile icon="shield" tone="green" size={30} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Anyone can check this letter</div>
                            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{VERIFY_ADAPTER?.provider ?? QR_VERIFY.provider} · live</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "center" }}>
                          <QrBlock token={openRow.token} />
                        </div>

                        <div style={{ marginTop: 12, textAlign: "center" }}>
                          <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginBottom: 4 }}>Verification code</div>
                          <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "1.4px" }}>
                            {openRow.token}
                          </div>
                        </div>

                        <div style={{ marginTop: 12, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "9px 11px", wordBreak: "break-all" }}>
                          <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginBottom: 3 }}>Public page</div>
                          <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n600)" }}>{QR_VERIFY.publicUrl(openRow.token)}</div>
                        </div>

                        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                          <PfBtn small variant="secondary" icon="arrowsq" onClick={() => go("verify")} style={{ flex: 1 }}>Open the public page</PfBtn>
                          <PfBtn small variant="secondary" icon="download" onClick={() => toast(`QR block downloaded — ${openRow.token} as a PNG you can print`, "success")}>QR</PfBtn>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <Note icon="info" tone="blue">
                            Whoever scans it sees that the letter is genuine — not what it says. The body stays with you.
                          </Note>
                        </div>
                      </PfCard>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <SlaTrack r={openRow} />
                      <PfBadge tone={STATE_TONE[openRow.state]} dot>{openRow.state}</PfBadge>
                    </div>
                    <Pipeline state={openRow.state} />
                    <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20 }}>
                      <LetterSheet
                        kind={openRow.kind}
                        addressedTo={openRow.addressedTo}
                        body={openRow.draft ?? previewBody(openRow.kind)}
                      />
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <Note icon="clock" tone="blue">
                          {DESK} has it. When it is approved and issued, the QR block appears here and the code starts resolving publicly.
                        </Note>
                        <Note icon="user" tone="purple">
                          Your manager, {MY_MANAGER.name}, is not in this loop — a letter about your own employment does not need her approval.
                        </Note>
                        <Note icon="shield" tone="green">
                          Nothing you typed leaves this request. The addressee is used in the salutation and nowhere else.
                        </Note>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                          <PfBtn small variant="secondary" icon="chat" onClick={() => toast(`Nudge sent to ${DESK} about ${openRow.id} — they see the same clock you do`)}>
                            Nudge People Ops
                          </PfBtn>
                          {sessionRows.some((x) => x.id === openRow.id) && (
                            <PfBtn small variant="danger" icon="x" onClick={() => withdraw(openRow)}>Withdraw request</PfBtn>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </PfCard>

          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px" }}>
              <PfTile icon="users" tone="grey" size={26} />
              <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                This page is scoped to you. Your letters do not appear on a colleague’s page, and theirs never appear on yours —
                the register holds {NOT_MINE} other requests right now and this surface can read none of them.
              </span>
              <PfBadge tone="grey">{ME.id} only</PfBadge>
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================= VERIFY ================================ */}
      {tab === "verify" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="shield">
            The person you hand the letter to can prove it is real without you proving anything, and without them reading a word of it.
          </PfBanner>

          {/* -------------------------- the privacy property ------------------------- */}
          <PfCard>
            <PfCardHead
              title="What a scan actually shows"
              sub="The whole point of the code: it confirms the letter is genuine, and confirms it without disclosing what the letter says."
            >
              <PfBadge tone="green" dot>letter_verify v1 · live</PfBadge>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: "16px 20px" }}>
              {/* your copy */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <PfTile icon="user" tone="blue" size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Your copy</span>
                  <PfBadge tone="blue">full contents</PfBadge>
                </div>
                <LetterSheet
                  kind={lastIssued?.kind ?? "Employment confirmation"}
                  addressedTo={lastIssued?.addressedTo}
                  body={lastIssued?.draft ?? previewBody("Employment confirmation")}
                  issuedAt={lastIssued?.issued}
                  token={lastIssued?.token}
                />
                <div style={{ marginTop: 10 }}>
                  <Note icon="info" tone="blue">
                    You hold this. So does whoever you give it to. Nobody else — including the resolver — reads the body.
                  </Note>
                </div>
              </div>

              {/* the public page */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <PfTile icon="search" tone="green" size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>What the scanner sees</span>
                  <PfBadge tone="green">authenticity only</PfBadge>
                </div>

                <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px 0 #f3f3f3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 12, borderBottom: "1px solid var(--pf-n50)" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--pf-primary-50)", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                      <Ic name="check" size={17} color="var(--pf-primary-500)" weight={2.6} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--pf-primary-600)" }}>Genuine letter</div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", fontFamily: MONO }}>
                        {QR_VERIFY.publicUrl(lastIssued?.token ?? "HB-7K2Q-9F4L")}
                      </div>
                    </div>
                  </div>

                  <div style={{ paddingTop: 10 }}>
                    {[
                      ["Code", lastIssued?.token ?? "—"],
                      ["Letter type", lastIssued?.kind ?? "—"],
                      ["Issued to", ME.name],
                      ["Issued on", lastIssued?.issued?.split(" · ")[0] ?? "—"],
                      ["Issued by", `${ISSUER} · ${DESK}`],
                      ["Status", "Valid — not withdrawn"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--pf-n25)" }}>
                        <span style={{ width: 92, flex: "none", fontSize: 11.5, color: "var(--pf-n400)" }}>{k}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", fontFamily: k === "Code" ? MONO : "inherit" }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* the masked body — the property that matters */}
                  <div style={{ marginTop: 12, background: "var(--pf-n25)", border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "14px 15px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <Ic name="shield" size={14} color="var(--pf-n400)" />
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n500)" }}>Letter contents — not on this page</span>
                    </div>
                    {[100, 88, 94, 62].map((w, i) => (
                      <div key={i} style={{ height: 7, width: `${w}%`, borderRadius: 4, background: "var(--pf-n100)", marginBottom: 6 }} />
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="check" tone="green">
                    A bank confirms you are employed here. It does not learn your grade, your tenure, your salary, or that you also
                    asked for an embassy letter last month.
                  </Note>
                  <Note icon="warning" tone="yellow">
                    A verifier that can only say yes is not a verifier. If a letter is ever withdrawn, the code still resolves —
                    and resolves as <b style={{ color: "var(--pf-n900)" }}>not valid</b>.
                  </Note>
                </div>
              </div>
            </div>
          </PfCard>

          {/* -------------------------------- try it -------------------------------- */}
          <PfCard>
            <PfCardHead
              title="Try it with your own code"
              sub="The same resolver a bank teller hits. Type the code off your letter, or scan the QR with any phone camera."
            >
              <PfBtn small variant="secondary" icon="arrowsq" onClick={() => go("verify")}>Open the public page</PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 20, padding: "16px 20px" }}>
              <div style={{ minWidth: 0 }}>
                <Label hint="looks like HB-XXXX-XXXX">Verification code</Label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    value={probe}
                    onChange={(e) => setProbe(e.target.value)}
                    placeholder="HB-0000-0000"
                    style={{ ...INPUT, fontFamily: MONO, letterSpacing: ".6px" }}
                  />
                  <PfBtn variant="primary" icon="search" onClick={check}>Check</PfBtn>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {issued.filter((r) => r.token).map((r) => (
                    <Chip key={r.id} active={probe.toUpperCase().trim() === r.token} onClick={() => setProbe(r.token!)}>
                      Use {r.token}
                    </Chip>
                  ))}
                  <Chip active={probe.toUpperCase().trim() === "HB-9999-0000"} onClick={() => setProbe("HB-9999-0000")}>
                    Try a code that does not exist
                  </Chip>
                </div>
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Note icon="info">
                    This checker opens codes on letters issued to you. The real public page resolves any code for whoever holds it —
                    that is what makes it useful to a stranger.
                  </Note>
                  <Note icon="shield" tone="green">
                    {VERIFY_ADAPTER?.note ?? "No third party involved — we are the issuer."} Nothing about the check leaves the page,
                    and no scan is reported back to your manager.
                  </Note>
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                {!checked && (
                  <div style={{ height: "100%", minHeight: 190, border: "1px dashed var(--pf-n100)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, background: "var(--pf-n25)", padding: 20, textAlign: "center" }}>
                    <PfTile icon="search" tone="grey" size={34} />
                    <span style={{ fontSize: 12.5, color: "var(--pf-n400)", maxWidth: 320, lineHeight: 1.5 }}>
                      Enter a code to see exactly what a bank, an embassy or a landlord sees when they check your letter.
                    </span>
                  </div>
                )}

                {checked && checked.hit && (
                  <div style={{ background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <QrBlock token={checked.hit.token} size={92} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <Ic name="check" size={17} color="var(--pf-primary-500)" weight={2.6} />
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-primary-600)" }}>
                            {checked.hit.valid ? "Genuine letter" : "Withdrawn — not valid"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--pf-n600)", marginTop: 5, lineHeight: 1.5 }}>
                          {checked.hit.kind} issued to <b style={{ color: "var(--pf-n900)" }}>{checked.hit.subject}</b> on {checked.hit.issued} by {checked.hit.issuer}.
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n500)", marginTop: 6 }}>{checked.hit.token}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-primary-100)" }}>
                      <Note icon="shield" tone="green">
                        That is the whole answer. No body text, no grade, no salary, no reason you asked — a stranger learns only
                        that {ISSUER} issued this letter and stands behind it.
                      </Note>
                    </div>
                  </div>
                )}

                {checked && !checked.hit && (
                  <div style={{ background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 12, padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Ic name="warning" size={17} color="var(--pf-yellow-500)" />
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--pf-n900)" }}>
                        {checked.otherOwner ? "Not one of your letters" : "No letter of yours carries that code"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n600)", marginTop: 8, lineHeight: 1.55 }}>
                      <span style={{ fontFamily: MONO }}>{checked.token}</span>{" "}
                      {checked.otherOwner
                        ? `is a real code, but it belongs to a letter issued to somebody else. Your page never opens another person’s record — the public page at verify.unrealabs.ng will resolve it for whoever is holding that letter.`
                        : `does not match any letter issued to you. Check the code printed under the signature block, or scan the QR instead of typing.`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </PfCard>

          {/* ------------------------------ plain words ------------------------------ */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            {[
              {
                icon: "shield", tone: "green" as PfTone, title: "A forged letter fails",
                text: "Anyone can retype a letterhead. Nobody can mint a code that resolves on our page. If it does not check out, it did not come from us.",
              },
              {
                icon: "x", tone: "red" as PfTone, title: "A withdrawn letter says so",
                text: "Codes are not one-way. If a letter is withdrawn, the code keeps resolving and reports it as not valid — which is what makes a yes worth anything.",
              },
              {
                icon: "user", tone: "purple" as PfTone, title: "Your business stays yours",
                text: "The page confirms the letter, not its contents. The bank cannot read your grade, and cannot see what else you have asked for.",
              },
            ].map((c) => (
              <PfCard key={c.title} pad={16}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
                  <PfTile icon={c.icon} tone={c.tone} size={30} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{c.title}</span>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{c.text}</div>
              </PfCard>
            ))}
          </div>

          {/* ------------------------------ the adapter ------------------------------ */}
          <PfCard>
            <PfCardHead title="Who runs the checker" sub="FR-086 · letter_verify v1 — the one adapter in the release with no counterparty to wait on." />
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", flexWrap: "wrap" }}>
              {[ISSUER, "letter_verify v1", QR_VERIFY.provider, "Whoever scans it"].map((s, i, arr) => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: i === arr.length - 1 ? "var(--pf-n900)" : "var(--pf-n500)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 999, padding: "6px 12px", whiteSpace: "nowrap" }}>{s}</span>
                  {i < arr.length - 1 && <Ic name="arrowright" size={14} color="var(--pf-n300)" />}
                </span>
              ))}
              <span style={{ flex: 1 }} />
              <PfBadge tone="green" dot>Live day one</PfBadge>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
