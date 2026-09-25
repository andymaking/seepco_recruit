"use client";
import { useState } from "react";
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
  QR_VERIFY, VERIFICATIONS, SEED_LEAVE_REQUESTS, activeAdapter,
  type LetterVerification,
} from "@/data/adapters";
import { ALL_WORKERS, personById, workerById, WORKER_TYPE_LABEL } from "@/data/workforce";
import { MODEL_CARDS, type WhyThis } from "@/data/trust";
import { EMPLOYEES } from "@/data/talentos";

/**
 * HR letters — PRD v2.1 FR-086 (HR side; the employee raises these from
 * /my-letters). Three things happen here and nothing else:
 *   1. the AI DRAFTS from the person record — fields only, no free invention;
 *   2. HR EDITS and APPROVES — the model never issues anything;
 *   3. issue MINTS a QR that resolves on a public page a bank or an embassy can
 *      check without ever seeing the letter's contents.
 * The verification adapter (`letter_verify` v1) is live day one because there is
 * no counterparty: we are the issuer. And a verifier that can only say "yes" is
 * not a verifier — a revoked letter resolves, and resolves as NOT valid.
 */

/* --------------------------------- helpers -------------------------------- */

const MONO = "ui-monospace, SFMono-Regular, Menlo, 'Liberation Mono', monospace";
const ISSUER = "Unrealabs · People Ops";
const SLA_HOURS = 24;

const first = (name: string) => name.split(" ")[0];

const hash32 = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The workspace's "today" is August 2026 — tenure resolves back from there. */
const startFromTenure = (tenure?: string): string | null => {
  if (!tenure) return null;
  const m = /(\d+)y\s*(\d+)m/.exec(tenure);
  if (!m) return null;
  const back = Number(m[1]) * 12 + Number(m[2]);
  const idx = 7 - back;
  return `${MONTHS[((idx % 12) + 12) % 12]} ${2026 + Math.floor(idx / 12)}`;
};

const empOf = (id: string) => EMPLOYEES.find((e) => e.id === id);

const startOf = (id: string): string | null => {
  const e = empOf(id);
  const viaDate = e?.hiredVia?.split("·").pop()?.trim();
  if (viaDate && /\d{4}/.test(viaDate)) return viaDate;
  return startFromTenure(e?.tenure);
};

const leaveFor = (workerId: string) => SEED_LEAVE_REQUESTS.find((l) => l.workerId === workerId);

/** "an HSE Coordinator", "a Finance Analyst" — letters are read by strangers. */
const article = (role: string) =>
  /^(HSE|HR|IT|NDT|QA|QC|MEP|L\d)\b/.test(role.trim()) || /^[aeiou]/i.test(role.trim()) ? "an" : "a";

const nowLabel = () => {
  const d = new Date();
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const STATE_TONE: Record<LetterState, PfTone> = {
  Requested: "grey", Drafted: "blue", Approved: "purple", Issued: "green", Declined: "red",
};

const PIPE: LetterState[] = ["Requested", "Drafted", "Approved", "Issued"];

const KIND_ICON: Record<LetterKind, string> = Object.fromEntries(
  LETTER_TEMPLATES.map((t) => [t.kind, t.icon]),
) as Record<LetterKind, string>;

const MC05 = MODEL_CARDS.find((m) => m.id === "MC-05")!;

/** Requestable by hand — probation confirmation comes out of FR-087 instead. */
const REQUESTABLE = LETTER_TEMPLATES.filter((t) => t.kind !== "Probation confirmation");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";

/** Deterministic token mint — same shape as the seeded HB-xxxx-xxxx codes. */
const mintToken = (seed: string): string => {
  let h = hash32(`token:${seed}`);
  const block = () =>
    Array.from({ length: 4 }, () => {
      h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
      return CHARS[h % CHARS.length];
    }).join("");
  return `HB-${block()}-${block()}`;
};

/* ---------------------------- record → draft ------------------------------- */

type Field = { label: string; value: string; source: string };

/** Every field the draft is allowed to touch, and where each one came from. */
const recordFields = (r: LetterRequest): Field[] => {
  const p = personById(r.workerId);
  const e = empOf(r.workerId);
  const w = workerById(r.workerId);
  const out: Field[] = [
    { label: "Full name", value: p?.name ?? r.subject, source: "person record" },
    { label: "Role & grade", value: `${p?.role ?? "—"}${e ? ` · ${e.grade}` : ""}`, source: "person record" },
    { label: "Start date", value: startOf(r.workerId) ?? "—", source: e?.hiredVia ? "hire record (Pillar 1)" : "derived from tenure" },
    {
      label: "Employment status",
      value: w ? `${WORKER_TYPE_LABEL[w.workerType]} · ${w.state}` : "Employee · Confirmed",
      source: "worker record (FR-082)",
    },
    { label: "Location", value: p?.loc ?? "—", source: "person record" },
  ];
  if (e) out.push({ label: "Tenure", value: e.tenure, source: "person record" });
  const lv = leaveFor(r.workerId);
  if (r.kind === "Embassy / visa introduction" && lv) {
    out.push({ label: "Approved leave", value: `${lv.id} · ${lv.from}–${lv.to} (${lv.days}d) · ${lv.state}`, source: `leave record${lv.againstRotation ? ` · ${lv.againstRotation}` : ""}` });
  }
  if (r.addressedTo) out.push({ label: "Addressed to", value: r.addressedTo, source: "typed by the requester" });
  return out;
};

/** The AI draft — a template fill over record fields, never a free composition. */
const aiDraft = (r: LetterRequest): string => {
  const p = personById(r.workerId);
  const e = empOf(r.workerId);
  const name = p?.name ?? r.subject;
  const role = p?.role ?? "—";
  const grade = e ? ` (Grade ${e.grade})` : "";
  const since = startOf(r.workerId);
  switch (r.kind) {
    case "Employment confirmation":
      return `This is to confirm that ${name} has been employed by Unrealabs Limited as ${article(role)} ${role}${grade}${since ? ` since ${since}` : ""}, and remains in our employment as at the date of this letter.`;
    case "Bank reference":
      return `This is to confirm that ${name} is employed by Unrealabs Limited as ${article(role)} ${role} and has been in our employment for ${e?.tenure ?? "the period stated on the record"}. This reference is issued at the employee's request and states no salary information.`;
    case "Embassy / visa introduction":
      return `This is to introduce ${name}, ${role} at Unrealabs Limited${since ? ` since ${since}` : ""}. ${first(name)}'s leave dates are as stated on the leave record, and ${first(name)} is expected to resume duty at the end of that period.`;
    case "Promotion":
      return `This is to confirm the promotion of ${name} to ${role}${grade}, effective from the date recorded against the grade change.`;
    default:
      return `This is to confirm the outcome of ${name}'s probation period, as decided in the confirmation review.`;
  }
};

const whyFor = (r: LetterRequest): WhyThis => ({
  claim: `Drafted from ${first(personById(r.workerId)?.name ?? r.subject)}'s record — every sentence is a template fill over the fields below.`,
  basis: recordFields(r).map((f) => `${f.label} — ${f.value} · ${f.source}`),
  modelCard: MC05.id,
  humanGate: MC05.humanGate,
});

/* --------------------------------- QR block -------------------------------- */

const QR_N = 25;

/**
 * A deterministic module grid for a token — finder patterns, separators, timing
 * rows and an alignment block around a hashed data field. It is a rendering of
 * the code, not an encoder: the resolver is the token, not the pixels.
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

function QrBlock({ token, muted, size = 168 }: { token: string; muted?: boolean; size?: number }) {
  const g = qrModules(token);
  const q = 2;
  const dim = QR_N + q * 2;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--pf-n50)", borderRadius: 12, padding: 10, flex: "none", boxShadow: "0 1px 3px 0 #f3f3f3", position: "relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`} shapeRendering="crispEdges" role="img" aria-label={`Verification code ${token}`}>
        <rect x={0} y={0} width={dim} height={dim} fill="#fff" />
        {g.map((row, r) => (
          <g key={r}>
            {row.map((on, c) => (on ? <rect key={c} x={c + q} y={r + q} width={1} height={1} fill={muted ? "var(--pf-n300)" : "var(--pf-n900)"} /> : null))}
          </g>
        ))}
      </svg>
      {muted && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ background: "var(--pf-red-500)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: ".8px", padding: "4px 10px", borderRadius: 5, transform: "rotate(-8deg)", boxShadow: "0 6px 14px -6px rgba(232,30,23,.6)" }}>REVOKED</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- SLA clock -------------------------------- */

function SlaClock({ r, projected }: { r: LetterRequest; projected: boolean }) {
  const sla = letterSla(r);
  const t = TONE[sla.tone];
  const frac = r.state === "Issued" ? 1 : Math.min(r.hoursElapsed / SLA_HOURS, 1);
  const R = 11;
  const C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "none" }}>
      <span style={{ position: "relative", width: 26, height: 26, display: "inline-flex" }}>
        <svg width={26} height={26} viewBox="0 0 26 26">
          <circle cx={13} cy={13} r={R} fill="none" stroke="var(--pf-n50)" strokeWidth={3} />
          <circle cx={13} cy={13} r={R} fill="none" stroke={t.fg} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${frac * C} ${C}`} transform="rotate(-90 13 13)" style={{ transition: "stroke-dasharray .3s ease" }} />
        </svg>
        {r.state === "Issued" && (
          <span style={{ position: "absolute", inset: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Ic name="check" size={11} color={t.fg} weight={2.6} />
          </span>
        )}
      </span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.fg, whiteSpace: "nowrap" }}>{sla.label}</span>
        <span style={{ fontSize: 10.5, color: "var(--pf-n300)", whiteSpace: "nowrap" }}>
          {projected && r.state !== "Issued" ? "projected" : `${SLA_HOURS}h target`}
        </span>
      </span>
    </div>
  );
}

/** The full 24h track — where this request sits against the target. */
function SlaTrack({ r }: { r: LetterRequest }) {
  const sla = letterSla(r);
  const pct = Math.min((r.hoursElapsed / SLA_HOURS) * 100, 100);
  return (
    <div style={{ minWidth: 168, flex: "none" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{r.hoursElapsed}h elapsed</span>
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

/* ------------------------------- queue rows -------------------------------- */

function RequestRow({ r, selected, projected, onSelect }: { r: LetterRequest; selected: boolean; projected: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  const p = personById(r.workerId);
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer",
        borderBottom: "1px solid var(--pf-n50)",
        background: selected ? "var(--pf-primary-50)" : hovered ? "var(--pf-n25)" : "transparent",
        boxShadow: selected ? "inset 2px 0 0 var(--pf-primary-500)" : "none",
        transition: "background .12s ease",
      }}
    >
      <PfAvatar init={p?.init ?? r.subject.slice(0, 2).toUpperCase()} tone={p?.tone ?? "#475569"} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</span>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: "var(--pf-n300)", flex: "none" }}>{r.id}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3, minWidth: 0 }}>
          <Ic name={KIND_ICON[r.kind] ?? "file"} size={12} color="var(--pf-n300)" />
          <span style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.kind}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          <PfBadge tone={STATE_TONE[r.state]} dot>{r.state}</PfBadge>
          <span style={{ fontSize: 11, color: "var(--pf-n300)" }}>{r.requested}</span>
        </div>
      </div>
      <SlaClock r={r} projected={projected} />
    </div>
  );
}

/* ------------------------------ template card ------------------------------ */

function TemplateCard({ t, issued, onUse, onConfirmations }: { t: LetterTemplate; issued: number; onUse: () => void; onConfirmations: () => void }) {
  const { hovered, hoverProps } = useHover();
  const auto = t.kind === "Probation confirmation";
  return (
    <PfCard style={{ display: "flex", flexDirection: "column", ...(hovered ? { borderColor: "var(--pf-n100)" } : {}), transition: "border-color .12s ease" }}>
      <div {...hoverProps} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 11, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PfTile icon={t.icon} tone={auto ? "purple" : "green"} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{t.kind}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n300)", marginTop: 2 }}>
              {issued} issued from this template
            </div>
          </div>
          <PfBadge tone={auto ? "purple" : "blue"}>{t.slaHours}h SLA</PfBadge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{t.blurb}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".2px", textTransform: "uppercase", marginBottom: 6 }}>
            Filled from the record
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {t.fills.map((f) => (
              <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 5, padding: "3px 7px" }}>
                <Ic name="check" size={10} color="var(--pf-primary-500)" weight={2.4} />
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "11px 18px", display: "flex", alignItems: "center", gap: 8, background: auto ? "var(--pf-purple-50)" : "var(--pf-n25)", borderRadius: "0 0 12px 12px" }}>
        {auto ? (
          <>
            <Ic name="info" size={14} color="var(--pf-purple-500)" />
            <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-purple-500)", fontWeight: 500 }}>
              Not requested by hand — the FR-087 decision issues it.
            </span>
            <PfBtn small variant="secondary" icon="arrowright" onClick={onConfirmations}>Confirmations</PfBtn>
          </>
        ) : (
          <>
            <Ic name="clock" size={14} color="var(--pf-n300)" />
            <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n400)" }}>Nothing to re-key — HR edits and approves.</span>
            <PfBtn small variant="secondary" icon="plus" onClick={onUse}>Use template</PfBtn>
          </>
        )}
      </div>
    </PfCard>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function Letters() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("queue");
  const [rows, setRows] = useState<LetterRequest[]>(LETTER_REQUESTS);
  const [vers, setVers] = useState<LetterVerification[]>(VERIFICATIONS);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(LETTER_REQUESTS.filter((r) => r.draft).map((r) => [r.id, r.draft as string])),
  );
  const [sel, setSel] = useState("LT-121");
  const [stateFilter, setStateFilter] = useState<LetterState | null>(null);
  const [proj, setProj] = useState(0);
  const [why, setWhy] = useState(false);

  const [compOpen, setCompOpen] = useState(false);
  const [compKind, setCompKind] = useState<LetterKind>("Employment confirmation");
  const [compWorker, setCompWorker] = useState("E-0165");
  const [compTo, setCompTo] = useState("");

  const [selIssued, setSelIssued] = useState("HB-7K2Q-9F4L");
  const [check, setCheck] = useState("");
  const [checked, setChecked] = useState<{ token: string; hit: LetterVerification | null } | null>(null);

  /* ------------------------------- derived -------------------------------- */

  const project = (r: LetterRequest): LetterRequest =>
    r.state === "Issued" ? r : { ...r, hoursElapsed: r.hoursElapsed + proj };

  const open = rows.filter((r) => r.state !== "Issued");

  const revoked = vers.filter((v) => v.revoked);
  const breaching = open.filter((r) => project(r).hoursElapsed >= SLA_HOURS).length;

  const visible = (stateFilter ? rows.filter((r) => r.state === stateFilter) : rows)
    .slice()
    .sort((a, b) => PIPE.indexOf(a.state) - PIPE.indexOf(b.state));

  const cur = rows.find((r) => r.id === sel) ?? visible[0] ?? rows[0];
  const curPerson = personById(cur.workerId);
  const curFields = recordFields(cur);
  const curWhy = whyFor(cur);
  const curDraft = drafts[cur.id] ?? "";
  const curLeave = cur.kind === "Embassy / visa introduction" ? leaveFor(cur.workerId) : undefined;
  const leaveWarn = !!curLeave && curLeave.state !== "Approved" && cur.state !== "Issued";

  const adapter = activeAdapter("letter_verify");

  const resolve = (token: string): LetterVerification | null =>
    vers.find((v) => v.token === token.toUpperCase().trim()) ?? QR_VERIFY.resolve(token);

  const curIssued = vers.find((v) => v.token === selIssued) ?? vers[0];

  const publicLine = (v: LetterVerification | null, token: string): string =>
    !v
      ? `No letter was issued against ${token.toUpperCase().trim() || "that code"}. Treat any document quoting it as unverified.`
      : v.revoked
        ? `Not valid — this letter was revoked by ${v.issuer}. Do not rely on any copy presented to you.`
        : `Genuine — a ${v.kind.toLowerCase()} issued by ${v.issuer} on ${v.issued}. The contents of the letter are not disclosed here.`;

  /* ------------------------------- actions -------------------------------- */

  const patch = (id: string, next: Partial<LetterRequest>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));

  const draftWithAi = (r: LetterRequest) => {
    const text = aiDraft(r);
    setDrafts((d) => ({ ...d, [r.id]: text }));
    patch(r.id, { state: "Drafted" });
    setWhy(true);
    toast(`Draft written for ${r.subject} — ${r.kind.toLowerCase()}. Edit it before you approve.`, "ai");
  };

  const saveEdits = (r: LetterRequest) =>
    toast(`Edits saved on ${r.id} — ${r.subject}'s ${r.kind.toLowerCase()} (not yet issued)`);

  const approveAndIssue = (r: LetterRequest) => {
    const body = (drafts[r.id] ?? "").trim();
    if (!body) { toast(`${r.id} has no draft yet — draft it before approving`, "danger"); return; }
    const token = mintToken(r.id + r.workerId);
    const stamp = nowLabel();
    patch(r.id, { state: "Issued", token, issued: stamp, hoursElapsed: r.hoursElapsed });
    setVers((prev) => [
      { token, issued: stamp.replace(" · ", ", 2026 · "), kind: r.kind, subject: r.subject, issuer: ISSUER, valid: true },
      ...prev,
    ]);
    setSelIssued(token);
    setTab("issued");
    toast(`${r.subject}'s ${r.kind.toLowerCase()} issued — QR ${token} now resolves publicly`, "success");
  };

  const declineRequest = (r: LetterRequest) => {
    patch(r.id, { state: "Declined" });
    toast(`${r.id} declined — ${r.subject} is notified with the reason on My letters`, "danger");
  };

  const revoke = (v: LetterVerification) => {
    setVers((prev) => prev.map((x) => (x.token === v.token ? { ...x, valid: false, revoked: true } : x)));
    toast(`${v.token} revoked — the public page now reports ${v.subject}'s ${v.kind.toLowerCase()} as NOT valid`, "danger");
  };

  const addRequest = () => {
    const p = personById(compWorker);
    if (!p) { toast("Pick the person the letter is about"); return; }
    const id = `LT-${123 + (rows.length - LETTER_REQUESTS.length)}`;
    const row: LetterRequest = {
      id, workerId: compWorker, subject: p.name, kind: compKind, state: "Requested",
      requested: nowLabel(), hoursElapsed: 0, addressedTo: compTo.trim() || undefined,
    };
    setRows((prev) => [...prev, row]);
    setSel(id);
    setStateFilter(null);
    setCompOpen(false);
    setCompTo("");
    toast(`${id} added to the queue — ${p.name}, ${compKind.toLowerCase()} · 24h clock started`, "success");
  };

  const startFromTemplate = (kind: LetterKind) => {
    setCompKind(kind);
    setCompOpen(true);
    setTab("queue");
    toast(`${kind} template loaded — pick the employee to start the request`);
  };

  const runCheck = () => {
    const t = check.trim();
    if (!t) { toast("Paste a verification code to resolve it"); return; }
    const hit = resolve(t);
    setChecked({ token: t.toUpperCase(), hit });
    toast(hit ? (hit.revoked ? `${t.toUpperCase()} resolves as NOT valid — revoked` : `${t.toUpperCase()} resolves as genuine`) : `${t.toUpperCase()} matches no issued letter`, hit && !hit.revoked ? "success" : "danger");
  };

  const fieldStyle = {
    fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", background: "var(--pf-n0)",
    border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none",
  } as const;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header ------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>HR letters</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            The AI drafts from the person record, HR edits and approves, and every issued letter carries a QR a bank or an embassy can verify on a public page (FR-086).
          </div>
        </div>
        <PfBtn variant="secondary" icon="shield" onClick={() => go("verify")}>Verification page</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { setCompOpen(true); setTab("queue"); }}>New request</PfBtn>
      </div>

      {/* adapter honesty strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "9px 14px", marginBottom: 12 }}>
        <Ic name="shield" size={15} color="var(--pf-primary-500)" />
        <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-600)" }}>letter_verify v1</span>
        <PfBadge tone="green" dot>{adapter?.provider ?? QR_VERIFY.provider} · live</PfBadge>
        <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>
          {adapter?.note ?? "No third party involved — we are the issuer."} Codes resolve at{" "}
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n600)" }}>verify.unrealabs.ng</span>.
        </span>
      </div>

      {/* --------------------------------- KPIs -------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 4 }}>
        <PfStat icon="file" tone="blue" label="In the queue" value={open.length} unit="requests" delta={`${breaching} over SLA`} deltaTone={breaching ? "red" : "green"} />
        <PfStat icon="clock" tone="yellow" label="Median time to issue" value="5.5" unit="hours" delta="vs 24h target" deltaTone="green" />
        <PfStat icon="shield" tone="green" label="Verifiable letters" value={vers.length} unit="with a QR" delta="resolver live" deltaTone="green" />
        <PfStat icon="x" tone="red" label="Revoked" value={revoked.length} unit="still resolve" delta="reported not valid" deltaTone="red" />
      </div>

      {/* -------------------------------- tabs --------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "queue", label: "Request queue", count: String(open.length) },
            { key: "templates", label: "Templates", count: String(LETTER_TEMPLATES.length) },
            { key: "issued", label: "Issued & verifiable", count: String(vers.length) },
          ]}
        />
      </div>

      {/* ================================ QUEUE ================================ */}
      {tab === "queue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* pipeline + clock projection */}
          <PfCard>
            <PfCardHead title="Request pipeline" sub="Requested → Drafted → Approved → Issued. Every request runs a 24-hour clock from the moment the employee raises it.">
              <PfTabs
                tabs={["Now", "+12h", "+24h"]}
                active={proj === 0 ? "Now" : proj === 12 ? "+12h" : "+24h"}
                onChange={(t) => setProj(t === "Now" ? 0 : t === "+12h" ? 12 : 24)}
              />
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
              {PIPE.map((s, i) => {
                const n = rows.filter((r) => r.state === s).length;
                const on = stateFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStateFilter(on ? null : s)}
                    style={{
                      fontFamily: "inherit", textAlign: "left", cursor: "pointer", padding: "14px 18px",
                      background: on ? "var(--pf-primary-50)" : "transparent",
                      border: "none", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)",
                      boxShadow: on ? "inset 0 -2px 0 var(--pf-primary-500)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[STATE_TONE[s]].bg }} />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n500)" }}>{s}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", marginTop: 6 }}>{n}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "10px 18px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)" }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)" }}>SLA bands</span>
              {([["blue", "On track"], ["yellow", "Under 6h left"], ["red", "Breached — 24h+"], ["green", "Issued"]] as [PfTone, string][]).map(([tone, label]) => (
                <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n500)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[tone].bg }} />{label}
                </span>
              ))}
              <span style={{ flex: 1 }} />
              {proj > 0 && (
                <PfBadge tone={breaching ? "red" : "yellow"}>
                  Projected +{proj}h · {breaching ? `${breaching} would breach` : "none would breach"}
                </PfBadge>
              )}
              {stateFilter && <PfBtn small variant="ghost" icon="x" onClick={() => setStateFilter(null)}>Clear filter</PfBtn>}
            </div>
          </PfCard>

          {/* composer */}
          {compOpen && (
            <PfCard>
              <PfCardHead title="New request" sub="HR can raise on an employee's behalf — the employee's own route is My letters.">
                <PfBtn small variant="ghost" icon="x" onClick={() => setCompOpen(false)}>Close</PfBtn>
              </PfCardHead>
              <div style={{ padding: "14px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 210 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)" }}>Letter</span>
                  <select value={compKind} onChange={(e) => setCompKind(e.target.value as LetterKind)} style={fieldStyle}>
                    {REQUESTABLE.map((t) => <option key={t.kind} value={t.kind}>{t.kind}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 230 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)" }}>Subject (one record, every worker)</span>
                  <select value={compWorker} onChange={(e) => setCompWorker(e.target.value)} style={fieldStyle}>
                    {ALL_WORKERS.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.role}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 220 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)" }}>Addressed to (optional)</span>
                  <input
                    value={compTo}
                    onChange={(e) => setCompTo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addRequest(); }}
                    placeholder="e.g. Guaranty Trust Bank · Embassy of Canada, Abuja"
                    style={{ ...fieldStyle, width: "100%" }}
                  />
                </label>
                <PfBtn variant="primary" icon="plus" onClick={addRequest}>Add to queue</PfBtn>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
                <Ic name="info" size={13} color="var(--pf-n300)" />
                Probation confirmation is not in this list — it is issued by the FR-087 confirmation decision, not requested by hand.
              </div>
            </PfCard>
          )}

          {/* list + draft panel */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,344px) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            <PfCard>
              <PfCardHead title={stateFilter ? `${stateFilter} (${visible.length})` : `All requests (${visible.length})`} sub="Selecting a request opens its draft." />
              {visible.map((r) => (
                <RequestRow key={r.id} r={project(r)} projected={proj > 0} selected={r.id === cur.id} onSelect={() => { setSel(r.id); setWhy(false); }} />
              ))}
              {!visible.length && (
                <div style={{ padding: "26px 18px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
                  Nothing in {stateFilter}.
                </div>
              )}
              <button
                onClick={() => go("myletters")}
                style={{ fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, width: "100%", padding: "12px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n500)" }}
              >
                <Ic name="user" size={14} color="var(--pf-n400)" /> Where employees raise these — My letters
              </button>
            </PfCard>

            {/* ------------------------- draft panel ------------------------- */}
            <PfCard>
              <PfCardHead
                title={
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                    <PfAvatar init={curPerson?.init ?? cur.subject.slice(0, 2)} tone={curPerson?.tone ?? "#475569"} size={26} />
                    {cur.subject}
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n400)" }}>· {cur.kind}</span>
                  </span>
                }
                sub={`${cur.id} · requested ${cur.requested}${cur.addressedTo ? ` · addressed to ${cur.addressedTo}` : ""}${cur.issued ? ` · issued ${cur.issued}` : ""}`}
              >
                <PfBadge tone={STATE_TONE[cur.state]} dot>{cur.state}</PfBadge>
              </PfCardHead>

              {/* SLA + record fields */}
              <div style={{ display: "flex", gap: 18, padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                    <Ic name="clipboard" size={14} color="var(--pf-n400)" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Read straight off the record</span>
                    <PfBadge tone="grey">no re-keying</PfBadge>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "9px 14px" }}>
                    {curFields.map((f) => (
                      <div key={f.label} style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{f.label}</div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{f.value}</div>
                        <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 1 }}>{f.source}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <SlaTrack r={project(cur)} />
              </div>

              {/* the draft */}
              <div style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                  <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-purple-500)" }}>AI draft</span>
                  <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>— editable. Nothing issues until you approve it.</span>
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={() => setWhy((v) => !v)}
                    style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-purple-50)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                  >
                    <Ic name="question" size={12} color="var(--pf-purple-500)" />
                    Why this?
                    <Ic name={why ? "caretdown" : "caretright"} size={11} color="var(--pf-purple-500)" />
                  </button>
                </div>

                {why && (
                  <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "12px 14px", marginBottom: 11 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{curWhy.claim}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 9 }}>
                      {curWhy.basis.map((b) => (
                        <div key={b} style={{ display: "flex", gap: 7, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                          <Ic name="check" size={12} color="var(--pf-purple-500)" weight={2.2} />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 11, paddingTop: 10, borderTop: "1px solid var(--pf-purple-100)" }}>
                      <button
                        onClick={() => go("trust")}
                        title="Model card index — Trust center"
                        style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-purple-500)", background: "var(--pf-n0)", border: "0.6px solid var(--pf-purple-100)", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                      >
                        <Ic name="robot" size={12} color="var(--pf-purple-500)" />
                        Model card {MC05.id} · {MC05.name}
                      </button>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                        Inputs: {MC05.inputs.toLowerCase()} · Human gate: {MC05.humanGate.toLowerCase()}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 7, marginTop: 9, fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.45 }}>
                      <Ic name="shield" size={12} color="var(--pf-n400)" />
                      <span>
                        No confidence score — this is a template fill, not a prediction. Nationality and host-community are NCDMB <b>reporting</b> fields: they are never model inputs and never appear on a letter.
                      </span>
                    </div>
                  </div>
                )}

                {leaveWarn && curLeave && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "11px 14px", marginBottom: 11 }}>
                    <Ic name="warning" size={15} color="var(--pf-yellow-500)" />
                    <div style={{ flex: 1, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                      The draft speaks to leave dates that {curLeave.id} still records as <b>{curLeave.state}</b> — awaiting {curLeave.approver}
                      {curLeave.againstRotation ? `, booked against the ${curLeave.againstRotation} rotation` : ""}. Approve the leave or edit the sentence before issuing.
                    </div>
                    <PfBtn small variant="secondary" onClick={() => go("myleave")}>Open leave</PfBtn>
                  </div>
                )}

                {cur.state === "Requested" && !curDraft ? (
                  <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "22px 18px", textAlign: "center", background: "var(--pf-n25)" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>No draft yet</div>
                    <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 4, marginBottom: 12 }}>
                      {first(cur.subject)}&rsquo;s {cur.kind.toLowerCase()} drafts from the {curFields.length} record fields above — nothing else.
                    </div>
                    <PfBtn
                      variant="primary" icon="sparkle" tone={TONE.purple.bg as string}
                      style={{ boxShadow: "0 6px 12px -6px rgba(175,82,222,.45), inset 0 1px 0 rgba(255,255,255,.22)" }}
                      onClick={() => draftWithAi(cur)}
                    >
                      Draft with AI
                    </PfBtn>
                  </div>
                ) : (
                  <>
                    <textarea
                      value={curDraft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [cur.id]: e.target.value }))}
                      readOnly={cur.state === "Issued"}
                      rows={6}
                      style={{
                        width: "100%", fontFamily: "inherit", fontSize: 13, lineHeight: 1.65, color: "var(--pf-n900)",
                        background: cur.state === "Issued" ? "var(--pf-n25)" : "var(--pf-n0)",
                        border: "1px solid var(--pf-n100)", borderRadius: 10, padding: "12px 14px", outline: "none", resize: "vertical",
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, fontSize: 11.5, color: "var(--pf-n300)" }}>
                      <span>{curDraft.trim().split(/\s+/).filter(Boolean).length} words</span>
                      <span>·</span>
                      <span>{cur.state === "Issued" ? "Issued copy — locked. Re-issue creates a new code." : "Letterhead, signature block and QR are added at issue."}</span>
                    </div>
                  </>
                )}
              </div>

              {/* actions */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)", borderRadius: "0 0 12px 12px", flexWrap: "wrap" }}>
                {cur.state === "Issued" ? (
                  <>
                    <Ic name="shield" size={15} color="var(--pf-primary-500)" />
                    <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>Verifiable at</span>
                    <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "var(--pf-n900)" }}>{cur.token}</span>
                    <span style={{ flex: 1 }} />
                    <PfBtn small variant="secondary" icon="download" onClick={() => toast(`${cur.subject}'s ${cur.kind.toLowerCase()} downloaded — signed PDF with the QR block`)}>PDF</PfBtn>
                    <PfBtn small variant="primary" icon="arrowright" onClick={() => { setSelIssued(cur.token as string); setTab("issued"); }}>Open verification</PfBtn>
                  </>
                ) : (
                  <>
                    <PfBtn small variant="ghost" icon="x" onClick={() => declineRequest(cur)}>Decline</PfBtn>
                    <span style={{ flex: 1 }} />
                    {cur.state !== "Requested" && <PfBtn small variant="secondary" onClick={() => saveEdits(cur)}>Save edits</PfBtn>}
                    {cur.state === "Requested" && curDraft && <PfBtn small variant="secondary" icon="sparkle" onClick={() => draftWithAi(cur)}>Re-draft</PfBtn>}
                    <PfBtn small variant="primary" icon="check" onClick={() => approveAndIssue(cur)}>
                      {cur.state === "Approved" ? "Issue & mint QR" : "Approve & issue"}
                    </PfBtn>
                  </>
                )}
              </div>
            </PfCard>
          </div>
        </div>
      )}

      {/* ============================== TEMPLATES ============================== */}
      {tab === "templates" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfBanner tone="green" icon="file">
            <span style={{ fontWeight: 600 }}>Five letters, not a document builder — </span>
            <span style={{ fontWeight: 400 }}>
              these are what Nigerian HR is actually asked for. Each one fills from the person record and carries the same 24-hour SLA.
            </span>
          </PfBanner>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            {LETTER_TEMPLATES.map((t) => (
              <TemplateCard
                key={t.kind}
                t={t}
                issued={rows.filter((r) => r.kind === t.kind && r.state === "Issued").length}
                onUse={() => startFromTemplate(t.kind)}
                onConfirmations={() => go("confirmations")}
              />
            ))}
          </div>

          <PfCard>
            <PfCardHead title="What a letter never does" sub="The limits are part of the template, not a policy PDF nobody reads." />
            {[
              { icon: "wallet", tone: "yellow" as PfTone, head: "Never states salary by default", body: "A bank reference confirms employment and tenure. Pay is added only if HR types it in, on that letter, deliberately." },
              { icon: "shield", tone: "blue" as PfTone, head: "Never prints a protected or NCDMB attribute", body: "Nationality and host-community are reporting fields for local-content returns. They are not model inputs and they do not appear on a letter." },
              { icon: "robot", tone: "purple" as PfTone, head: "Never issues itself", body: `${MC05.humanGate}. The model has no issue action — approval mints the code, and only a person can approve.` },
              { icon: "clock", tone: "green" as PfTone, head: "Never sits without a clock", body: "Every request runs against 24 hours from the moment the employee raises it, breach shown in red on the queue." },
            ].map((r, i, a) => (
              <div key={r.head} style={{ display: "flex", gap: 12, padding: "13px 20px", borderBottom: i === a.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfTile icon={r.icon} tone={r.tone} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.head}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{r.body}</div>
                </div>
              </div>
            ))}
          </PfCard>
        </div>
      )}

      {/* =============================== ISSUED ================================ */}
      {tab === "issued" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,344px) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
            {/* issued list */}
            <PfCard>
              <PfCardHead title={`Issued letters (${vers.length})`} sub="Each one carries a code that resolves publicly." />
              {vers.map((v) => {
                const row = rows.find((r) => r.token === v.token);
                const p = row ? personById(row.workerId) : undefined;
                const on = v.token === curIssued?.token;
                return (
                  <button
                    key={v.token}
                    onClick={() => setSelIssued(v.token)}
                    style={{
                      fontFamily: "inherit", textAlign: "left", width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "12px 14px", cursor: "pointer", border: "none", borderBottom: "1px solid var(--pf-n50)",
                      background: on ? "var(--pf-primary-50)" : "transparent",
                      boxShadow: on ? "inset 2px 0 0 var(--pf-primary-500)" : "none",
                    }}
                  >
                    <PfAvatar init={p?.init ?? v.subject.slice(0, 2).toUpperCase()} tone={p?.tone ?? "#475569"} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{v.subject}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.kind}</div>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: "var(--pf-n300)", marginTop: 3 }}>{v.token}</div>
                    </div>
                    <PfBadge tone={v.revoked ? "red" : "green"} dot>{v.revoked ? "Revoked" : "Valid"}</PfBadge>
                  </button>
                );
              })}
            </PfCard>

            {/* the hero — QR verification */}
            {curIssued && (
              <PfCard>
                <PfCardHead
                  title="Anti-forgery verification"
                  sub="Printed on the letter. Scanned by a bank, an embassy or a next employer — no account, no login."
                >
                  <PfBadge tone={curIssued.revoked ? "red" : "green"} dot>{curIssued.revoked ? "Not valid" : "Genuine"}</PfBadge>
                </PfCardHead>
                <div style={{ display: "flex", gap: 20, padding: 20, flexWrap: "wrap" }}>
                  <QrBlock token={curIssued.token} muted={curIssued.revoked} />
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)", letterSpacing: ".2px", textTransform: "uppercase" }}>Verification code</div>
                    <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "1px", marginTop: 5 }}>{curIssued.token}</div>
                    <div
                      onClick={() => toast(`Public link copied — ${QR_VERIFY.publicUrl(curIssued.token)}`)}
                      style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "8px 11px", cursor: "pointer" }}
                    >
                      <Ic name="arrowsq" size={14} color="var(--pf-n400)" />
                      <span style={{ fontFamily: MONO, fontSize: 12, color: "var(--pf-n600)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {QR_VERIFY.publicUrl(curIssued.token)}
                      </span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-500)", flex: "none" }}>Copy</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "10px 14px", marginTop: 14 }}>
                      {[
                        ["Subject", curIssued.subject],
                        ["Letter", curIssued.kind],
                        ["Issued", curIssued.issued],
                        ["Issuer", curIssued.issuer],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 11, color: "var(--pf-n400)" }}>{k}</div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                      <PfBtn variant="primary" icon="shield" onClick={() => go("verify")}>Open verification page</PfBtn>
                      <PfBtn variant="secondary" icon="download" onClick={() => toast(`${curIssued.subject}'s ${curIssued.kind.toLowerCase()} downloaded — QR block bottom-right`)}>Download PDF</PfBtn>
                      {!curIssued.revoked && (
                        <PfBtn variant="danger" icon="x" onClick={() => revoke(curIssued)}>Revoke</PfBtn>
                      )}
                    </div>
                  </div>
                </div>

                {/* what the public page says — the honest half */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "13px 20px", borderTop: "1px solid var(--pf-n50)", background: curIssued.revoked ? "var(--pf-red-50)" : "var(--pf-primary-50)", borderRadius: "0 0 12px 12px" }}>
                  <Ic name={curIssued.revoked ? "warning" : "check"} size={16} color={curIssued.revoked ? "var(--pf-red-500)" : "var(--pf-primary-500)"} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: curIssued.revoked ? "var(--pf-red-500)" : "var(--pf-primary-600)", letterSpacing: ".2px", textTransform: "uppercase" }}>
                      The public page reports
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 4, lineHeight: 1.5 }}>
                      {publicLine(curIssued, curIssued.token)}
                    </div>
                  </div>
                </div>
              </PfCard>
            )}
          </div>

          {/* verifier simulator — resolve any code against the contract */}
          <PfCard>
            <PfCardHead
              title="Resolve a code"
              sub={`What a verifier sees when they type the code into ${QR_VERIFY.publicUrl("…")}. A system that can only say yes is not a verification system.`}
            >
              <PfBadge tone="grey">{QR_VERIFY.provider}</PfBadge>
            </PfCardHead>
            <div style={{ display: "flex", gap: 8, padding: "14px 20px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={check}
                onChange={(e) => setCheck(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runCheck(); }}
                placeholder="HB-XXXX-XXXX"
                style={{ ...fieldStyle, fontFamily: MONO, letterSpacing: ".5px", flex: 1, minWidth: 220 }}
              />
              <PfBtn variant="primary" icon="search" onClick={runCheck}>Resolve</PfBtn>
              {["HB-5X1V-6C7B", "HB-0000-0000"].map((t) => (
                <PfBtn key={t} small variant="secondary" onClick={() => { setCheck(t); setChecked({ token: t, hit: resolve(t) }); }}>
                  Try {t === "HB-0000-0000" ? "an unknown code" : "the revoked one"}
                </PfBtn>
              ))}
            </div>
            {checked && (
              <div style={{ margin: "0 20px 18px", border: `1px solid ${checked.hit && !checked.hit.revoked ? "var(--pf-primary-100)" : "var(--pf-red-100)"}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: checked.hit && !checked.hit.revoked ? "var(--pf-primary-50)" : "var(--pf-red-50)" }}>
                  <Ic name={checked.hit && !checked.hit.revoked ? "check" : "warning"} size={16} color={checked.hit && !checked.hit.revoked ? "var(--pf-primary-500)" : "var(--pf-red-500)"} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: checked.hit && !checked.hit.revoked ? "var(--pf-primary-600)" : "var(--pf-red-500)" }}>
                    {checked.hit ? (checked.hit.revoked ? "Not valid — revoked by the issuer" : "Genuine letter") : "No such letter"}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: "var(--pf-n400)" }}>{checked.token}</span>
                </div>
                <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55, background: "var(--pf-n0)" }}>
                  {publicLine(checked.hit, checked.token)}
                  {checked.hit && (
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 6 }}>
                      Disclosed to the verifier: subject name, letter type, issue date, issuer. Nothing else — not the body, not the salary, not the reason it was asked for.
                    </div>
                  )}
                </div>
              </div>
            )}
          </PfCard>

          {/* the ledger */}
          <PfCard>
            <PfCardHead title="Verification ledger" sub="Every code ever minted, and exactly what a scan of it returns today." >
              <PfBtn small variant="secondary" icon="download" onClick={() => toast(`Verification ledger exported — ${vers.length} codes, ${revoked.length} revoked (CSV)`)}>Export</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 90px", gap: 12, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Code</PfTh>
              <PfTh>Letter &amp; what a scan returns</PfTh>
              <PfTh>Issued</PfTh>
              <PfTh style={{ textAlign: "right" }}>State</PfTh>
            </div>
            {vers.map((v, i) => (
              <div
                key={v.token}
                onClick={() => setSelIssued(v.token)}
                style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px 90px", gap: 12, padding: "12px 20px", borderBottom: i === vers.length - 1 ? "none" : "1px solid var(--pf-n50)", cursor: "pointer", alignItems: "center" }}
              >
                <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: v.revoked ? "var(--pf-n300)" : "var(--pf-n900)" }}>{v.token}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{v.subject} · {v.kind}</div>
                  <div style={{ fontSize: 11.5, color: v.revoked ? "var(--pf-red-500)" : "var(--pf-n400)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{publicLine(v, v.token)}</div>
                </div>
                <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{v.issued}</span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <PfBadge tone={v.revoked ? "red" : "green"} dot>{v.revoked ? "Revoked" : "Valid"}</PfBadge>
                </div>
              </div>
            ))}
          </PfCard>

          <PfBanner tone="green" icon="shield" cta="open" onCta={() => go("verify")}>
            <span style={{ fontWeight: 600 }}>The public page is the product here — </span>
            <span style={{ fontWeight: 400 }}>
              it confirms a letter is genuine without disclosing a word of its contents, and it says &ldquo;not valid&rdquo; out loud when a letter has been revoked.
            </span>
          </PfBanner>
        </div>
      )}
    </div>
  );
}
