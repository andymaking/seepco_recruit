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
  CERTIFICATIONS, MEDICALS, ALERT_DAYS, alertTier, readinessFor, lapsing,
  personById, workerById, companyById, WORKER_TYPE_LABEL,
  type Certification, type MedicalClearance, type CertState,
} from "@/data/workforce";
import { ADAPTERS, type AdapterState } from "@/data/adapters";
import { auditScore } from "@/data/trust";

/**
 * Certifications & medicals — PRD v2.1 FR-083.
 *
 * The register of record for every ticket and every occupational-health
 * clearance across BOTH populations: the v2.0 employee spine and the site
 * workforce that spine could not see. Three things live here and nothing else:
 *
 *   1. the register (what is on file, from whom, expiring when),
 *   2. the medicals (fitness class and restriction — never a diagnosis),
 *   3. the alerts that fire at 90/30/7 days to the person, their manager and HR.
 *
 * DOCTRINE. Site-access readiness is a RULE, not a model: every certification
 * valid AND a medical that is in date AND a fitness class that is not
 * "Temporarily unfit". No AI runs on this page, so no AI output on this page
 * needs a model card (FR-093) — and the rule's basis is spelled out in full
 * under "Why this flag?" instead. Worker type, nationality and host community
 * are NCDMB reporting fields; they are never inputs to the flag.
 *
 * ADAPTER-FIRST. Issuer registries are behind a contract with a CSV/manual
 * adapter that works today. "Awaiting API access" is the honest state of an
 * issuer lookup, not a hole in the product — the register is populated by
 * upload and an API only removes a keystroke.
 */

/* --------------------------------- tokens --------------------------------- */

const STATE_TONE: Record<CertState, PfTone> = { valid: "green", expiring: "yellow", expired: "red" };
const STATE_LABEL: Record<CertState, string> = { valid: "Valid", expiring: "Expiring", expired: "Expired" };

const FIT_TONE: Record<MedicalClearance["fitnessClass"], PfTone> = {
  "Fit — unrestricted": "green",
  "Fit — with restriction": "yellow",
  "Temporarily unfit": "red",
};

const ADAPTER_TONE: Record<AdapterState, PfTone> = { live: "green", ready: "blue", "awaiting-access": "yellow" };
const ADAPTER_LABEL: Record<AdapterState, string> = { live: "Live", ready: "Ready", "awaiting-access": "Awaiting API access" };

const dayTone = (d: number): PfTone => (d <= 7 ? "red" : d <= 30 ? "yellow" : d <= 90 ? "blue" : "green");
const dayLabel = (d: number) => (d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const windowPct = (d: number) => (d < 0 ? 100 : Math.round(((90 - Math.min(d, 90)) / 90) * 100));

/** Mirrors the rule inside readinessFor() so the UI can separate a block from a warning. */
const BLOCKING_RE = /expired|unfit|No medical/;

/* ------------------------------ the register ------------------------------ */

type BoardRow = {
  id: string; name: string; init: string; tone: string; role: string; dept: string; loc: string;
  type: string; company?: string; ncdmb?: boolean;
  ready: boolean; blocking: string[]; advisory: string[];
};

const REGISTER_IDS = Array.from(new Set([...CERTIFICATIONS.map((c) => c.workerId), ...MEDICALS.map((m) => m.workerId)]));

/** Blocked first, then the noisiest — a site clerk reads this top-down at 05:30. */
const BOARD: BoardRow[] = REGISTER_IDS
  .map((id) => {
    const p = personById(id);
    if (!p) return null;
    const w = workerById(id);
    const co = companyById(w?.contractingCompanyId);
    const r = readinessFor(id);
    return {
      id, name: p.name, init: p.init, tone: p.tone, role: p.role, dept: p.dept, loc: p.loc,
      type: w ? WORKER_TYPE_LABEL[w.workerType] : "Worker",
      company: co?.name, ncdmb: co?.ncdmbRegistered,
      ready: r.ready,
      blocking: r.reasons.filter((x) => BLOCKING_RE.test(x)),
      advisory: r.reasons.filter((x) => !BLOCKING_RE.test(x)),
    } as BoardRow;
  })
  .filter((b): b is BoardRow => b !== null)
  .sort((a, b) => Number(a.ready) - Number(b.ready) || b.blocking.length - a.blocking.length || b.advisory.length - a.advisory.length);

const boardFor = (id: string) => BOARD.find((b) => b.id === id);

const GROUPS: { key: CertState; label: string; note: string }[] = [
  { key: "expired", label: "Expired", note: "A worker cannot be rostered against an expired ticket — no grace period, no supervisor override." },
  { key: "expiring", label: "Expiring inside the alert window", note: "Under 90 days. The person, their line manager and HR are already on notice." },
  { key: "valid", label: "Valid", note: "In date at today's register read." },
];

/* --------------------------- alert routing (FR-083) ------------------------ */

const LINE_MANAGER: Record<string, string> = {
  "E-0231": "Ibrahim Sani · HSE & Operations",
  "E-0129": "Ibrahim Sani · HSE & Operations",
  "E-0250": "Lars Pedersen · Drilling Supervisor",
  "W-3301": "Lars Pedersen · Drilling Supervisor",
  "W-3303": "Emeka Nwosu · Field Operations Lead",
  "W-3305": "Emeka Nwosu · Field Operations Lead",
};
const HR_OPS = "Samuel Omosehin · Talent Lead";

const TIER_META: Record<90 | 30 | 7, { label: string; tone: PfTone; what: string }> = {
  90: { label: "90-day notice", tone: "blue", what: "Renewal window opens. Book the course before the next crew change." },
  30: { label: "30-day chase", tone: "yellow", what: "Renewal must be booked. Rotation planning is copied so the roster can absorb the gap." },
  7: { label: "7-day escalation", tone: "red", what: "Site access is at risk. HSE lead and the contracting employer are copied." },
};

/* ----------------------- issuer verification adapters ---------------------- */

const ISSUER_VERIFY: { issuer: string; registry: string; state: AdapterState; note: string }[] = [
  { issuer: "Any issuer", registry: "CSV / manual upload", state: "live", note: "The day-one adapter. Every row on this register can arrive this way, today." },
  { issuer: "Nigerian Red Cross", registry: "Manual attestation", state: "live", note: "Scanned certificate plus HR sign-off — the path that needs no counterparty at all." },
  { issuer: "IWCF", registry: "IWCF verification portal", state: "ready", note: "Built to the same contract, idle. Needs a tenant account, not a code change." },
  { issuer: "LEEA", registry: "LEEA member directory", state: "ready", note: "Built and idle." },
  { issuer: "OPITO", registry: "OPITO Vantage", state: "awaiting-access", note: "Certificate numbers are attested by upload meanwhile; the lookup only removes a keystroke." },
  { issuer: "NEBOSH", registry: "NEBOSH register", state: "awaiting-access", note: "Same contract, same fields. Nothing on this page waits for it." },
];

/* ------------------------------- CSV import -------------------------------- */

const SAMPLE_CSV = `worker_id,certification,issuer,number,expiry
W-3305,Working at Height,NEBOSH,NB-449001,2027-06-30
E-0129,First Aid at Work,Nigerian Red Cross,RC-20981,2027-07-14
W-3302,OPITO BOSIET,OPITO,OP-881120,2028-02-01
X-9999,Rigger Level 2,LEEA,LE-11999,2027-11-03`;

type ImportRow = { workerId: string; name?: string; cert: string; issuer: string; number: string; expiry: string; ok: boolean; clears: boolean; note: string };

const parseCsv = (text: string): ImportRow[] =>
  text.trim().split("\n").slice(1).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [workerId, cert, issuer, number, expiry] = line.split(",").map((s) => (s ?? "").trim());
    const p = personById(workerId);
    const existing = CERTIFICATIONS.find((c) => c.workerId === workerId && c.name.toLowerCase() === (cert || "").toLowerCase());
    const ok = Boolean(p && cert && expiry);
    const clears = Boolean(p && existing && existing.state === "expired");
    const note = !p
      ? `Rejected — “${workerId || "(blank)"}” is not on the worker register`
      : !cert || !expiry
        ? "Rejected — certification and expiry are required"
        : clears
          ? `Renewal — clears an expired ${existing?.name}`
          : existing
            ? `Renewal — replaces the ${existing.expires} record`
            : "New certification for a worker already on the register";
    return { workerId, name: p?.name, cert, issuer, number, expiry, ok, clears, note };
  });

/* -------------------------------- access log ------------------------------- */

type LogEntry = { who: string; what: string; when: string; you?: boolean };

const SEED_LOG: LogEntry[] = [
  { who: "Samuel Omosehin · Talent Lead", what: "opened Halima Sule's fitness restriction", when: "today · 09:12" },
  { who: "Ibrahim Sani · HSE Lead", what: "opened Lars Pedersen's fitness class", when: "yesterday · 16:40" },
  { who: "Samuel Omosehin · Talent Lead", what: "exported the medicals register (6 rows, class + due date only)", when: "Aug 26 · 11:03" },
];

/* ------------------------------- small parts ------------------------------- */

function ReadyPill({ ready, size = "sm" }: { ready: boolean; size?: "sm" | "lg" }) {
  const t = ready ? TONE.green : TONE.red;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999,
      fontSize: size === "lg" ? 11.5 : 11, fontWeight: 700, letterSpacing: ".3px",
      color: t.fg, background: t.soft, border: `0.6px solid ${t.line}`,
      padding: size === "lg" ? "4px 10px" : "2px 8px", whiteSpace: "nowrap",
    }}>
      <Ic name={ready ? "check" : "warning"} size={size === "lg" ? 13 : 12} color={t.fg} weight={2.2} />
      {ready ? "SITE-READY" : "NOT SITE-READY"}
    </span>
  );
}

function ReasonLine({ text, blocking }: { text: string; blocking: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11.5, lineHeight: 1.45, color: blocking ? "var(--pf-red-500)" : "var(--pf-n500)" }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: blocking ? "var(--pf-red-500)" : "var(--pf-n300)", marginTop: 6, flex: "none" }} />
      <span style={{ fontWeight: blocking ? 600 : 500 }}>{text}</span>
    </div>
  );
}

function ReadinessTile({ b, selected, onSelect }: { b: BoardRow; selected: boolean; onSelect: () => void }) {
  const { hovered, hoverProps } = useHover();
  const shown = [...b.blocking.map((r) => ({ r, block: true })), ...b.advisory.map((r) => ({ r, block: false }))].slice(0, 3);
  return (
    <div
      {...hoverProps}
      onClick={onSelect}
      style={{
        background: "var(--pf-n0)", borderRadius: 12, cursor: "pointer", padding: "12px 14px",
        border: `1px solid ${selected ? "var(--pf-n900)" : b.ready ? "var(--pf-n50)" : "var(--pf-red-100)"}`,
        boxShadow: hovered || selected ? "0 2px 8px 0 #eeeeee" : "0 1px 3px 0 #f3f3f3",
        transition: "box-shadow .12s ease, border-color .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <PfAvatar init={b.init} tone={b.tone} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.role} · {b.loc}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", margin: "9px 0 8px" }}>
        <ReadyPill ready={b.ready} />
        <PfBadge tone="grey">{b.type}</PfBadge>
      </div>
      {shown.length === 0 ? (
        <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-primary-500)" }}>All tickets and the medical in date.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {shown.map((s) => <ReasonLine key={s.r} text={s.r} blocking={s.block} />)}
        </div>
      )}
    </div>
  );
}

function WhyPanel({ onClose }: { onClose: () => void }) {
  const go = useGo();
  const audit = auditScore();
  return (
    <PfCard style={{ background: "var(--pf-n25)" }}>
      <PfCardHead
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ic name="question" size={16} color="var(--pf-n500)" />Why this flag?</span>}
        sub="Site-access readiness, stated in full. Read it, argue with it, then act on it."
      >
        <PfBtn small variant="ghost" icon="x" onClick={onClose}>Close</PfBtn>
      </PfCardHead>
      <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 8 }}>The rule, in order</div>
          {[
            "Every certification on file for the worker must be state = valid.",
            "A medical clearance must exist. No clearance on file is a block, not a blank.",
            "The clearance must be in date at today's register read.",
            "The fitness class must not be “Temporarily unfit”. This is tested independently of every date — a fitness class is not a date test.",
            "An expiring ticket is a warning, not a block. An expired one is a block.",
          ].map((r, i) => (
            <div key={r} style={{ display: "flex", gap: 9, padding: "6px 0", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--pf-n300)", flex: "none", marginTop: 1 }}>{i + 1}</span>
              <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>{r}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Ic name="robot" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>No model runs here</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
              Readiness is deterministic. There is no score, no confidence, no model card — because there is no model.
              Every input is a dated document a human uploaded and a human can point at.
            </div>
            <div style={{ marginTop: 9 }}>
              <PfBtn small variant="secondary" icon="shield" onClick={() => go("aisurfaces")}>
                AI surface audit · {audit.covered}/{audit.total} covered
              </PfBtn>
            </div>
          </div>
          <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <Ic name="shield" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>What is never an input</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55 }}>
              Worker type, nationality and host community sit on this register for NCDMB returns only.
              They are reporting fields. They do not touch the flag, and no protected attribute ever will.
            </div>
          </div>
        </div>
      </div>
    </PfCard>
  );
}

/* -------------------------------- registry --------------------------------- */

const REG_COLS = "minmax(190px,1.4fr) minmax(165px,1.2fr) minmax(150px,1fr) 100px 96px 190px";

function CertRow({ c, onVerify, onRenew, onOpenWorker }: {
  c: Certification; onVerify: () => void; onRenew: () => void; onOpenWorker: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const b = boardFor(c.workerId);
  const tier = alertTier(c.daysLeft);
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: REG_COLS, alignItems: "center", gap: 12,
        padding: "11px 20px", borderTop: "1px solid var(--pf-n50)",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <button onClick={onOpenWorker} style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0, fontFamily: "inherit" }}>
        <PfAvatar init={b?.init ?? "—"} tone={b?.tone ?? "#475569"} size={28} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b?.name ?? c.workerId}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>
            <span style={{ fontFamily: "var(--mono)" }}>{c.workerId}</span>
            {b && !b.ready && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-red-500)" }} />}
            {b && !b.ready && <span style={{ color: "var(--pf-red-500)", fontWeight: 600 }}>blocked</span>}
          </span>
        </span>
      </button>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{c.name}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{b?.type ?? "Worker"} · {b?.dept}</div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{c.issuer}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n300)", fontFamily: "var(--mono)", marginTop: 1 }}>{c.number}</div>
      </div>

      <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{c.expires}</div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TONE[dayTone(c.daysLeft)].fg, letterSpacing: "-.2px" }}>{dayLabel(c.daysLeft)}</div>
        {tier !== null && <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)", marginTop: 2 }}>T-{tier} alerted</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <PfBadge tone={STATE_TONE[c.state]} dot>{STATE_LABEL[c.state]}</PfBadge>
        <PfBtn small variant="secondary" onClick={onVerify}>Verify</PfBtn>
        <PfBtn small variant={c.state === "expired" ? "danger" : "secondary"} onClick={onRenew}>Renew</PfBtn>
      </div>
    </div>
  );
}

/* -------------------------------- medicals --------------------------------- */

const MED_COLS = "minmax(190px,1.3fr) minmax(160px,1fr) minmax(210px,1.2fr) 100px 96px 150px";

function MedicalRow({ m, revealed, onReveal, onReview }: {
  m: MedicalClearance; revealed: boolean; onReveal: () => void; onReview: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const b = boardFor(m.workerId);
  const unfit = m.fitnessClass === "Temporarily unfit";
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: MED_COLS, alignItems: "center", gap: 12,
        padding: "12px 20px 12px 17px", borderTop: "1px solid var(--pf-n50)",
        borderLeft: unfit ? "3px solid var(--pf-red-500)" : "3px solid transparent",
        background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <PfAvatar init={b?.init ?? "—"} tone={b?.tone ?? "#475569"} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b?.name ?? m.workerId}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", fontFamily: "var(--mono)" }}>{m.workerId}</div>
        </div>
      </div>

      <div>
        <PfBadge tone={FIT_TONE[m.fitnessClass]} dot>{m.fitnessClass}</PfBadge>
        {unfit && (
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--pf-red-500)", letterSpacing: ".3px", marginTop: 5 }}>
            BLOCKS SITE ACCESS REGARDLESS OF DATES
          </div>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        {!m.restriction ? (
          <span style={{ fontSize: 12.5, color: "var(--pf-n300)" }}>No restriction recorded</span>
        ) : revealed ? (
          <span style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.4 }}>
            {m.restriction}
            <span style={{ display: "block", fontSize: 10.5, color: "var(--pf-n300)", marginTop: 2 }}>Access logged · this view is HR Ops / HSE only</span>
          </span>
        ) : (
          <button
            onClick={onReveal}
            style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: "var(--pf-n500)", background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
          >
            <Ic name="shield" size={13} color="var(--pf-n400)" />
            Reveal · access is logged
          </button>
        )}
      </div>

      <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{m.nextDue}</div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: TONE[dayTone(m.daysLeft)].fg, letterSpacing: "-.2px" }}>{dayLabel(m.daysLeft)}</div>
        <div style={{ fontSize: 10.5, color: "var(--pf-n400)", marginTop: 2 }}>{STATE_LABEL[m.state]}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        {b && <ReadyPill ready={b.ready} />}
        <PfBtn small variant="secondary" onClick={onReview}>Book</PfBtn>
      </div>
    </div>
  );
}

/* --------------------------------- alerts ---------------------------------- */

function Recipient({ icon, role, who, tone = "grey" }: { icon: string; role: string; who: string; tone?: PfTone }) {
  const t = TONE[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: t.soft, border: `0.6px solid ${t.line}`, borderRadius: 8, padding: "5px 9px", minWidth: 0 }}>
      <Ic name={icon} size={14} color={t.fg} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: t.fg, textTransform: "uppercase" }}>{role}</span>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)", whiteSpace: "nowrap" }}>{who}</span>
      </span>
    </span>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function Certifications() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("registry");
  const [sel, setSel] = useState<string | null>(null);
  const [certFilter, setCertFilter] = useState("All states");
  const [why, setWhy] = useState(false);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [log, setLog] = useState<LogEntry[]>(SEED_LOG);
  const [sent, setSent] = useState<string[]>([]);
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [parsed, setParsed] = useState<ImportRow[] | null>(null);
  const [staged, setStaged] = useState(false);

  const alerts = lapsing();
  const blocked = BOARD.filter((b) => !b.ready);
  const readyCount = BOARD.length - blocked.length;
  const expiredNow = CERTIFICATIONS.filter((c) => c.state === "expired").length + MEDICALS.filter((m) => m.state === "expired").length;
  const awaiting = ADAPTERS.filter((a) => a.state === "awaiting-access").length;
  const escalations = alerts.filter((a) => alertTier(a.daysLeft) === 7);

  const selRow = sel ? boardFor(sel) : null;
  const nameOf = (id: string) => boardFor(id)?.name ?? id;

  const visibleCerts = CERTIFICATIONS.filter((c) => (!sel || c.workerId === sel) && (certFilter === "All states" || STATE_LABEL[c.state] === certFilter));
  const visibleMedicals = MEDICALS.filter((m) => !sel || m.workerId === sel);
  const visibleAlerts = alerts.filter((a) => !sel || a.workerId === sel);

  const pickWorker = (id: string) => {
    setSel((prev) => (prev === id ? null : id));
    setCertFilter("All states");
  };

  const reveal = (m: MedicalClearance) => {
    setRevealed((prev) => (prev.includes(m.workerId) ? prev : [...prev, m.workerId]));
    setLog((prev) => [{ who: "You · HR Ops", what: `revealed ${nameOf(m.workerId)}'s fitness restriction`, when: "just now", you: true }, ...prev]);
    toast(`Access logged — you opened ${nameOf(m.workerId)}'s restriction. The worker can see this entry on My data & privacy.`);
  };

  const sendAlert = (key: string, who: string, what: string, count: number) => {
    setSent((prev) => (prev.includes(key) ? prev : [...prev, key]));
    toast(`${what} notice sent for ${who} — ${count} recipients (worker, line manager, HR Ops${count > 3 ? ", contracting employer" : ""}).`, "success");
  };

  const commit = () => {
    if (!parsed) return;
    const ok = parsed.filter((r) => r.ok);
    const clears = parsed.filter((r) => r.clears);
    setStaged(true);
    toast(`${ok.length} of ${parsed.length} CSV rows staged — ${clears.length} would clear a site-access block. HR Ops signs off before the register moves.`, "success");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- header -------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Certifications &amp; medicals</span>
            <PfBadge tone="grey">FR-083</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, maxWidth: 760 }}>
            The register of record for every ticket and every fitness-to-work clearance — employees and the site workforce alike.
            It computes one thing: whether a person may go through the gate.
          </div>
        </div>
        <PfBtn variant="secondary" icon="download" onClick={() => toast(`Register exported — ${CERTIFICATIONS.length} certifications, ${MEDICALS.length} medicals (class and due date only, no clinical detail)`)}>Export</PfBtn>
        <PfBtn variant="primary" icon="plus" onClick={() => { setTab("alerts"); setParsed(null); setStaged(false); toast("CSV importer open — the day-one adapter, no issuer API required"); }}>Bulk import</PfBtn>
      </div>

      {/* --------------------------------- KPIs --------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="users" tone="blue" label="On the register" value={BOARD.length} unit="workers" delta="2 populations" deltaTone="grey" />
        <PfStat icon="shield" tone={blocked.length ? "red" : "green"} label="Site-ready" value={`${readyCount}/${BOARD.length}`} delta={`${blocked.length} blocked`} deltaTone={blocked.length ? "red" : "green"} />
        <PfStat icon="bell" tone="yellow" label="Lapsing ≤ 90 days" value={alerts.length} unit="items" delta={`${escalations.length} at T-7`} deltaTone="red" />
        <PfStat icon="warning" tone="red" label="Expired today" value={expiredNow} unit="records" delta="Gate blocks" deltaTone="red" />
      </div>

      {/* ------------------------------ block banner ---------------------------- */}
      {blocked.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <PfBanner tone="red" icon="warning" cta="Site roster" onCta={() => go("sites")}>
            {blocked.length} of {BOARD.length} workers on the register are not site-ready — {blocked.map((b) => `${b.name} (${b.blocking[0]})`).join(" · ")}.
            This flag feeds the site roster and the anomaly feed; it is not advisory.
          </PfBanner>
        </div>
      )}

      {/* ---------------------------- readiness board --------------------------- */}
      <PfCard style={{ marginBottom: 12 }}>
        <PfCardHead
          title="Site-access readiness"
          sub={sel ? `Filtering every tab to ${selRow?.name}. Click the card again to clear.` : "Valid tickets plus a valid medical. Click a worker to filter the register, the medicals and the alerts."}
        >
          {sel && <PfBtn small variant="ghost" icon="x" onClick={() => setSel(null)}>Clear filter</PfBtn>}
          <PfBtn small variant="secondary" icon="question" onClick={() => setWhy((v) => !v)}>{why ? "Hide basis" : "Why this flag?"}</PfBtn>
        </PfCardHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, padding: 14 }}>
          {BOARD.map((b) => (
            <ReadinessTile key={b.id} b={b} selected={sel === b.id} onSelect={() => pickWorker(b.id)} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
          <Ic name="info" size={13} color="var(--pf-n300)" />
          A fitness class is not a date test — “Temporarily unfit” blocks the gate even when every date on file is green.
        </div>
      </PfCard>

      {why && <div style={{ marginBottom: 12 }}><WhyPanel onClose={() => setWhy(false)} /></div>}

      {/* --------------------------------- tabs --------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "registry", label: "Registry", count: String(CERTIFICATIONS.length) },
            { key: "medicals", label: "Medicals" },
            { key: "alerts", label: "Expiry alerts", count: String(alerts.length) },
          ]}
        />
      </div>

      {/* ------------------------------- REGISTRY ------------------------------- */}
      {tab === "registry" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead
              title="Certification register"
              sub={sel ? `${plural(visibleCerts.length, "record")} for ${selRow?.name}.` : "Every ticket on file, grouped worst-first. Numbers are as issued — verify against the issuer before a first rotation."}
            >
              <PfTabs tabs={["All states", "Expired", "Expiring", "Valid"]} active={certFilter} onChange={setCertFilter} />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: REG_COLS, gap: 12, padding: "9px 20px", background: "var(--pf-n25)" }}>
              <PfTh>Worker</PfTh>
              <PfTh>Certification</PfTh>
              <PfTh>Issuer &amp; number</PfTh>
              <PfTh>Expires</PfTh>
              <PfTh>Days left</PfTh>
              <PfTh style={{ textAlign: "right" }}>State</PfTh>
            </div>

            {GROUPS.map((g) => {
              const rows = visibleCerts.filter((c) => c.state === g.key);
              if (rows.length === 0) return null;
              return (
                <div key={g.key}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 20px", borderTop: "1px solid var(--pf-n50)", background: TONE[STATE_TONE[g.key]].soft }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[STATE_TONE[g.key]].bg }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: TONE[STATE_TONE[g.key]].fg }}>{g.label} · {rows.length}</span>
                    <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{g.note}</span>
                  </div>
                  {rows.map((c) => (
                    <CertRow
                      key={c.id}
                      c={c}
                      onOpenWorker={() => pickWorker(c.workerId)}
                      onVerify={() => toast(`Verification requested — ${c.issuer} ${c.number} for ${nameOf(c.workerId)}. CSV attestation stands until the issuer lookup is live.`)}
                      onRenew={() => toast(`Renewal booked for ${nameOf(c.workerId)} — ${c.name} (${c.issuer}). Rotation planning notified so the roster absorbs the gap.`, "success")}
                    />
                  ))}
                </div>
              );
            })}

            {visibleCerts.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                No certifications match this filter.
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="shield" size={13} color="var(--pf-n300)" />
              Worker type, nationality and host community sit on this register for NCDMB returns only — reporting fields, never inputs to the readiness flag.
            </div>
          </PfCard>

          {/* ------------------------ issuer verification ------------------------ */}
          <PfCard>
            <PfCardHead
              title="Issuer verification"
              sub="Adapter-first. The manual path ships day one; an issuer API only removes a keystroke."
            >
              <PfBadge tone="grey">{awaiting} platform adapters awaiting API access · none block this page</PfBadge>
            </PfCardHead>
            {ISSUER_VERIFY.map((a, i) => (
              <div key={a.issuer + a.registry} style={{ display: "grid", gridTemplateColumns: "160px 200px 1fr 150px", gap: 12, alignItems: "center", padding: "11px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PfTile icon={a.state === "live" ? "check" : a.state === "ready" ? "swap" : "clock"} tone={ADAPTER_TONE[a.state]} size={26} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{a.issuer}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)" }}>{a.registry}</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.45 }}>{a.note}</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <PfBadge tone={ADAPTER_TONE[a.state]} dot>{ADAPTER_LABEL[a.state]}</PfBadge>
                </div>
              </div>
            ))}
          </PfCard>
        </div>
      )}

      {/* ------------------------------- MEDICALS ------------------------------- */}
      {tab === "medicals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead
              title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ic name="shield" size={16} color="var(--pf-red-500)" />Sensitive record · occupational health</span>}
              sub="Health data under NDPR. The governance is on the page because it is enforced in the product, not in a policy PDF."
            >
              <PfBadge tone="blue">Viewing as HR Ops · full record</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 0 }}>
              {[
                { icon: "user", title: "Who can see this", body: "HR Ops, the HSE Lead and the worker. A line manager sees the readiness flag only — never the fitness class, never the restriction." },
                { icon: "clipboard", title: "What is stored", body: "Fitness class, any work restriction, and the next-due date. No diagnosis, no examination report, no clinical note ever enters Hirebrew." },
                { icon: "clock", title: "Retention", body: "Class and due date kept for employment + 10 years per the HSE records schedule, then purged. Every open is written to an append-only access log." },
              ].map((g, i) => (
                <div key={g.title} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <Ic name={g.icon} size={15} color="var(--pf-n400)" />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>{g.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>{g.body}</div>
                </div>
              ))}
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead
              title="Fitness-to-work clearances"
              sub={sel ? `${plural(visibleMedicals.length, "record")} for ${selRow?.name}.` : "A class, a restriction and a date. The class is tested on its own — an in-date “Temporarily unfit” is still a closed gate."}
            >
              <PfBtn small variant="secondary" icon="calendar" onClick={() => toast(`Medical booking sheet drafted — ${MEDICALS.filter((m) => m.daysLeft <= 30).length} clearances due inside 30 days, PH clinic slots requested`)}>Book batch</PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: MED_COLS, gap: 12, padding: "9px 20px 9px 17px", background: "var(--pf-n25)" }}>
              <PfTh>Worker</PfTh>
              <PfTh>Fitness class</PfTh>
              <PfTh>Restriction</PfTh>
              <PfTh>Next due</PfTh>
              <PfTh>Days left</PfTh>
              <PfTh style={{ textAlign: "right" }}>Gate</PfTh>
            </div>

            {visibleMedicals.map((m) => (
              <MedicalRow
                key={m.workerId}
                m={m}
                revealed={revealed.includes(m.workerId)}
                onReveal={() => reveal(m)}
                onReview={() => toast(`Occupational-health review requested for ${nameOf(m.workerId)} — ${m.fitnessClass}. HSE Lead copied; the clinical detail stays with the clinic.`, "success")}
              />
            ))}

            {visibleMedicals.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                No clearance on file for this worker — which is itself a block.
              </div>
            )}
          </PfCard>

          <PfCard>
            <PfCardHead title="Access log" sub="Append-only. Every open of a medical record is written here and mirrored to the worker's own privacy page.">
              <PfBtn small variant="ghost" icon="arrowright" onClick={() => go("trust")}>Trust center</PfBtn>
            </PfCardHead>
            {log.map((e, i) => (
              <div key={`${e.who}-${e.when}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                <PfTile icon={e.you ? "user" : "shield"} tone={e.you ? "purple" : "grey"} size={26} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--pf-n600)" }}>
                  <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{e.who}</span> {e.what}
                </div>
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)", fontFamily: "var(--mono)" }}>{e.when}</span>
              </div>
            ))}
          </PfCard>
        </div>
      )}

      {/* -------------------------------- ALERTS -------------------------------- */}
      {tab === "alerts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard>
            <PfCardHead title="How the alert fires" sub={`Three thresholds — ${ALERT_DAYS.join(" / ")} days — and three recipients every time. An alert nobody owns is a log line, not an alert.`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              {ALERT_DAYS.map((d, i) => {
                const meta = TIER_META[d];
                return (
                  <div key={d} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <PfTile icon="bell" tone={meta.tone} size={26} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{meta.label}</span>
                      <span style={{ flex: 1 }} />
                      <PfBadge tone={meta.tone}>{alerts.filter((a) => alertTier(a.daysLeft) === d).length} live</PfBadge>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5, minHeight: 54 }}>{meta.what}</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                      <PfBadge tone="grey">Worker</PfBadge>
                      <PfBadge tone="grey">Line manager</PfBadge>
                      <PfBadge tone="grey">HR Ops</PfBadge>
                    </div>
                  </div>
                );
              })}
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead
              title="Live alerts"
              sub={sel ? `${plural(visibleAlerts.length, "item")} for ${selRow?.name}, worst first.` : "Worst first — overdue at the top. Certifications and medicals in one queue, because the gate does not distinguish."}
            >
              <PfBtn
                small variant="primary" icon="paperplane"
                onClick={() => { setSent((prev) => Array.from(new Set([...prev, ...escalations.map((a) => `${a.kind}-${a.workerId}-${a.what}`)]))); toast(`${escalations.length} T-7 escalations sent — each to the worker, their line manager and HR Ops, with contracting employers copied.`, "success"); }}
              >
                Send all {escalations.length} escalations
              </PfBtn>
            </PfCardHead>

            {visibleAlerts.map((a) => {
              const key = `${a.kind}-${a.workerId}-${a.what}`;
              const b = boardFor(a.workerId);
              const tier = alertTier(a.daysLeft) ?? 90;
              const meta = TIER_META[tier];
              const isSent = sent.includes(key);
              const recipients = 3 + (b?.company ? 1 : 0);
              return (
                <div key={key} style={{ padding: "14px 20px", borderTop: "1px solid var(--pf-n50)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                    <PfAvatar init={b?.init ?? "—"} tone={b?.tone ?? "#475569"} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{b?.name ?? a.workerId}</span>
                        <PfBadge tone={a.kind === "Medical" ? "purple" : "blue"}>{a.kind}</PfBadge>
                        <span style={{ fontSize: 13, color: "var(--pf-n600)" }}>{a.what}</span>
                        {b && !b.ready && <PfBadge tone="red" dot>Gate closed</PfBadge>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>
                        {b?.role} · {b?.loc} · {b?.type}{b?.company ? ` · ${b.company}${b.ncdmb === false ? " (not NCDMB-registered)" : ""}` : ""}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "9px 0 10px" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: TONE[dayTone(a.daysLeft)].fg, letterSpacing: "-.2px", minWidth: 92 }}>{dayLabel(a.daysLeft)}</span>
                        <div style={{ flex: 1, maxWidth: 300 }}><PfProgress pct={windowPct(a.daysLeft)} tone={dayTone(a.daysLeft)} height={6} /></div>
                        <PfBadge tone={meta.tone} dot>{a.daysLeft < 0 ? "Overdue · escalation" : meta.label}</PfBadge>
                      </div>

                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <Recipient icon="user" role="The person" who={b?.name ?? a.workerId} tone="green" />
                        <Recipient icon="users" role="Line manager" who={LINE_MANAGER[a.workerId] ?? "Unassigned — routes to HR Ops"} tone="blue" />
                        <Recipient icon="shield" role="HR" who={HR_OPS} tone="purple" />
                        {b?.company && <Recipient icon="stack" role="Contracting employer" who={b.company} tone="yellow" />}
                      </div>

                      {a.kind === "Medical" && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 9, fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.45 }}>
                          <Ic name="info" size={13} color="var(--pf-n300)" />
                          The manager and employer copies say only that a medical clearance is due. Fitness class and restriction stay with HR Ops, the HSE Lead and the worker.
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flex: "none" }}>
                      {isSent ? (
                        <PfBadge tone="green" dot>Sent · {recipients} recipients</PfBadge>
                      ) : (
                        <PfBtn small variant="primary" icon="paperplane" onClick={() => sendAlert(key, b?.name ?? a.workerId, a.daysLeft < 0 ? "Overdue" : meta.label, recipients)}>Send now</PfBtn>
                      )}
                      <PfBtn small variant="secondary" onClick={() => toast(a.kind === "Medical" ? `Clinic slot requested for ${b?.name ?? a.workerId} — Port Harcourt occupational health` : `Renewal booked for ${b?.name ?? a.workerId} — ${a.what}`, "success")}>
                        {a.kind === "Medical" ? "Book clinic" : "Book renewal"}
                      </PfBtn>
                      {isSent && <PfBtn small variant="ghost" onClick={() => toast(`Resent for ${b?.name ?? a.workerId} — ${a.what}`)}>Resend</PfBtn>}
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleAlerts.length === 0 && (
              <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 13, color: "var(--pf-n400)", borderTop: "1px solid var(--pf-n50)" }}>
                Nothing lapsing inside 90 days for this worker.
              </div>
            )}
          </PfCard>

          {/* ---------------------------- CSV importer ---------------------------- */}
          <PfCard>
            <PfCardHead
              title="Bulk import · certifications"
              sub="One CSV from the training provider, the agency or a spreadsheet. This is the adapter that ships — an issuer API would only remove a keystroke."
            >
              <PfBadge tone="green" dot>CSV adapter · live</PfBadge>
            </PfCardHead>

            <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>
                  Paste rows <span style={{ fontWeight: 400, color: "var(--pf-n400)" }}>· worker_id, certification, issuer, number, expiry</span>
                </div>
                <textarea
                  value={csv}
                  onChange={(e) => { setCsv(e.target.value); setParsed(null); setStaged(false); }}
                  spellCheck={false}
                  rows={7}
                  style={{
                    width: "100%", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.6, color: "var(--pf-n600)",
                    background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: 11, resize: "vertical", outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  <PfBtn small variant="secondary" icon="filter" onClick={() => { setParsed(parseCsv(csv)); setStaged(false); toast("CSV validated against the worker register — unknown ids are rejected, not guessed"); }}>Validate</PfBtn>
                  <PfBtn small variant="ghost" icon="download" onClick={() => toast("Template downloaded — certifications_import_template.csv")}>Template</PfBtn>
                  <span style={{ flex: 1 }} />
                  <PfBtn small variant="primary" icon="check" onClick={commit} style={{ opacity: parsed && parsed.some((r) => r.ok) ? 1 : 0.45 }}>Stage for HR sign-off</PfBtn>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>
                  {parsed ? `Preview · ${parsed.filter((r) => r.ok).length} of ${parsed.length} rows accepted` : "Preview"}
                </div>
                {!parsed ? (
                  <div style={{ border: "1px dashed var(--pf-n100)", borderRadius: 10, padding: "26px 14px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
                    Validate to see what each row would do to the register. Nothing is written until a human signs it off.
                  </div>
                ) : (
                  <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden" }}>
                    {parsed.map((r, i) => (
                      <div key={`${r.workerId}-${r.cert}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px", borderTop: i === 0 ? "none" : "1px solid var(--pf-n50)", background: r.ok ? "transparent" : "var(--pf-red-50)" }}>
                        <Ic name={r.ok ? "check" : "x"} size={14} color={r.ok ? "var(--pf-primary-500)" : "var(--pf-red-500)"} weight={2.2} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>
                            {r.name ?? r.workerId} · {r.cert || "(no certification)"}
                          </div>
                          <div style={{ fontSize: 11.5, color: r.ok ? (r.clears ? "var(--pf-primary-500)" : "var(--pf-n400)") : "var(--pf-red-500)", marginTop: 1 }}>{r.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {staged && parsed && (
                  <div style={{ marginTop: 9 }}>
                    <PfBanner tone="green" icon="check" cta="Review queue" onCta={() => toast("Sign-off queue opened — HR Ops reviews each staged row against the scanned certificate")}>
                      {parsed.filter((r) => r.ok).length} rows staged. {parsed.filter((r) => r.clears).length} would clear a site-access block once signed off — the register does not move on its own.
                    </PfBanner>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Same pattern as payroll and attendance (§6): the manual adapter is a supported surface, not a stopgap. {awaiting} platform contracts are still awaiting a partner API — none of them gate this import.
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
