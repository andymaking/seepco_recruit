"use client";
import { useState } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfAvatar, PfTh, PfBanner, PfPageTabs, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { EMPLOYEES, NCDMB, type Employee } from "@/data/talentos";

/**
 * Certifications & Compliance — PRD FR-062 + Appendix B (Oil & Gas industry pack).
 * Role-required certs with expiry tracking + issuer verification, site-level
 * compliance, medicals & fitness-to-work, and NCDMB Nigerian-content reporting.
 */

/* ------------------------------ derived data ------------------------------ */

const byId = (id: string) => EMPLOYEES.find((e) => e.id === id)!;
const EMEKA = byId("E-0231");   // NEBOSH IGC (expiring Sep 2026) · OPITO BOSIET (valid Mar 2027)
const HALIMA = byId("E-0129");  // NEBOSH Diploma (valid Jan 2027) · First Aid at Work (expired Jul 2026)
const SEYI = byId("E-0250");    // OPITO BOSIET (expiring Aug 2026)

const certOf = (e: Employee, name: string) => e.certs?.find((c) => c.name === name);

type CertState = "valid" | "expiring" | "expired";
type Holder = { emp: Employee; cert: string; expires: string; state: CertState; note?: string };

type MatrixRow = {
  id: string; cert: string; issuer: string; registry: string; requiredFor: string;
  holders: number; expiring: number; expired: number; coverage: number;
  people: Holder[]; gapNote?: string;
};

const nebEmeka = certOf(EMEKA, "NEBOSH IGC")!;
const nebHalima = certOf(HALIMA, "NEBOSH Diploma")!;
const bosietEmeka = certOf(EMEKA, "OPITO BOSIET")!;
const bosietSeyi = certOf(SEYI, "OPITO BOSIET")!;
const faHalima = certOf(HALIMA, "First Aid at Work")!;

const MATRIX: MatrixRow[] = [
  {
    id: "neb-igc", cert: "NEBOSH IGC", issuer: "NEBOSH (UK)", registry: "NEBOSH registry",
    requiredFor: "HSE roles & site leads", holders: 24, expiring: 1, expired: 0, coverage: 96,
    people: [
      { emp: EMEKA, cert: nebEmeka.name, expires: nebEmeka.expires, state: nebEmeka.state, note: "Renewal lands before the Sep 2 crew change" },
      { emp: HALIMA, cert: nebHalima.name, expires: nebHalima.expires, state: nebHalima.state, note: "Diploma — supersedes IGC requirement" },
    ],
    gapNote: "1 incoming site lead enrols in the Q4 IGC cohort.",
  },
  {
    id: "bosiet", cert: "OPITO BOSIET", issuer: "OPITO", registry: "OPITO Vantage registry",
    requiredFor: "All offshore rotations", holders: 41, expiring: 1, expired: 0, coverage: 98,
    people: [
      { emp: EMEKA, cert: bosietEmeka.name, expires: bosietEmeka.expires, state: bosietEmeka.state },
      { emp: SEYI, cert: bosietSeyi.name, expires: bosietSeyi.expires, state: bosietSeyi.state, note: "Rotates to Offshore Delta on Sep 2 — renewal blocks boarding" },
    ],
    gapNote: "1 new rotator booked into the Sep OPITO intake.",
  },
  {
    id: "first-aid", cert: "First Aid at Work", issuer: "St John Ambulance NG", registry: "St John Ambulance NG register",
    requiredFor: "Designated site first-aiders", holders: 18, expiring: 0, expired: 1, coverage: 90,
    people: [
      { emp: HALIMA, cert: faHalima.name, expires: faHalima.expires, state: faHalima.state, note: "Off-rota for site duties until renewal is verified" },
    ],
    gapNote: "Halima Sule's lapse leaves Port Harcourt one first-aider short per shift.",
  },
  {
    id: "h2s", cert: "H2S Awareness", issuer: "IOGP-aligned provider", registry: "IOGP training registry",
    requiredFor: "Drilling & subsurface crews", holders: 52, expiring: 0, expired: 0, coverage: 100,
    people: [
      { emp: EMEKA, cert: "H2S Awareness", expires: "Feb 2027", state: "valid" },
      { emp: SEYI, cert: "H2S Awareness", expires: "Nov 2026", state: "valid" },
    ],
  },
  {
    id: "medical", cert: "Fitness-to-work medical", issuer: "DPR-accredited clinic", registry: "DPR-accredited clinic register",
    requiredFor: "All site-based staff", holders: 146, expiring: 0, expired: 0, coverage: 94,
    people: [
      { emp: EMEKA, cert: "Fitness-to-work medical", expires: "Oct 2026", state: "valid", note: "Renewal due Sep 30 — booked ahead of offshore rotation" },
      { emp: SEYI, cert: "Fitness-to-work medical", expires: "Oct 2026", state: "valid" },
      { emp: HALIMA, cert: "Fitness-to-work medical", expires: "Nov 2026", state: "valid" },
    ],
    gapNote: "9 recent joiners pending first medical — clinic invites sent.",
  },
];

type Site = { name: string; staff: number; pct: number; tone: PfTone; gap: string };
/** Staff totals reconcile with the 358-employee org (142 + 168 + 48). Weighted score ⇒ 94%. */
const SITES: Site[] = [
  { name: "Lagos HQ", staff: 142, pct: 99, tone: "green", gap: "1 fire-warden refresher due Oct" },
  { name: "Port Harcourt base", staff: 168, pct: 91, tone: "yellow", gap: "First Aid expired — Halima Sule (HSE)" },
  { name: "Offshore Delta", staff: 48, pct: 88, tone: "red", gap: "2 cert renewals land before the Sep 2 crew change" },
];

const MEDICALS: { emp: Employee; site: string; due: string; state: string; tone: PfTone }[] = [
  { emp: EMEKA, site: "Offshore Delta", due: "Sep 30, 2026", state: "Due soon", tone: "yellow" },
  { emp: SEYI, site: "Port Harcourt base", due: "Oct 6, 2026", state: "Booked", tone: "green" },
  { emp: HALIMA, site: "Port Harcourt base", due: "Nov 20, 2026", state: "Scheduled", tone: "grey" },
];

const EXPIRY_BADGE: Record<CertState, { tone: PfTone; label: (d: string) => string }> = {
  valid: { tone: "green", label: (d) => `Valid · ${d}` },
  expiring: { tone: "yellow", label: (d) => `Expires ${d}` },
  expired: { tone: "red", label: (d) => `Expired ${d}` },
};

/* -------------------------------- widgets -------------------------------- */

function SiteRing({ pct, tone }: { pct: number; tone: PfTone }) {
  return (
    <div style={{ width: 66, height: 66, borderRadius: "50%", background: `conic-gradient(${TONE[tone].bg} ${pct * 3.6}deg, var(--pf-n50) 0)`, display: "grid", placeItems: "center", flex: "none" }}>
      <div style={{ width: 50, height: 50, borderRadius: "50%", background: "var(--pf-n0)", display: "grid", placeItems: "center", fontSize: 14.5, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>
        {pct}%
      </div>
    </div>
  );
}

function SiteCard({ site, onView }: { site: Site; onView: () => void }) {
  return (
    <PfCard pad={16}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <SiteRing pct={site.pct} tone={site.tone} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{site.name}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2 }}>{site.staff} staff on register</div>
          <PfBadge tone={site.tone} dot>{site.pct >= 95 ? "Compliant" : site.pct >= 90 ? "Gaps open" : "Below threshold"}</PfBadge>
        </div>
      </div>
      <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--pf-n50)" }}>
        <Ic name="warning" size={13} color={TONE[site.tone].fg} />
        <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.4 }}>Top gap: {site.gap}</span>
      </div>
      <PfBtn small full icon="caretright" onClick={onView} style={{ marginTop: 10, flexDirection: "row-reverse" }}>View site</PfBtn>
    </PfCard>
  );
}

function NcdmbDial({ ng, target }: { ng: number; target: number }) {
  const R = 56, C = 2 * Math.PI * R;
  const a = (-90 + target * 3.6) * (Math.PI / 180);
  const tick = { x1: 75 + Math.cos(a) * 45, y1: 75 + Math.sin(a) * 45, x2: 75 + Math.cos(a) * 68, y2: 75 + Math.sin(a) * 68 };
  return (
    <svg width={150} height={150} viewBox="0 0 150 150" style={{ flex: "none" }}>
      <circle cx={75} cy={75} r={R} fill="none" stroke="var(--pf-n100)" strokeWidth={15} />
      <circle cx={75} cy={75} r={R} fill="none" stroke="var(--pf-primary-500)" strokeWidth={15} strokeLinecap="round" strokeDasharray={`${(ng / 100) * C} ${C}`} transform="rotate(-90 75 75)" />
      <line {...tick} stroke="var(--pf-n900)" strokeWidth={2.5} strokeLinecap="round" />
      <text x={75} y={73} textAnchor="middle" fontSize={26} fontWeight={700} fill="var(--pf-n900)" letterSpacing="-0.5">{ng}%</text>
      <text x={75} y={91} textAnchor="middle" fontSize={10.5} fill="var(--pf-n400)">Nigerian content</text>
    </svg>
  );
}

function FamilyBar({ fam, ng, target }: { fam: string; ng: number; target: number }) {
  const passing = ng >= target;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>{fam}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: passing ? "var(--pf-primary-500)" : "var(--pf-red-500)" }}>
          {ng}% NG{!passing && <span style={{ fontWeight: 500, color: "var(--pf-n400)" }}> · {target - ng}pp short</span>}
        </span>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: 5, background: "var(--pf-n100)" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${ng}%`, borderRadius: 5, background: "var(--pf-primary-500)" }} />
        <div style={{ position: "absolute", left: `${target}%`, top: -3, width: 2, height: 16, borderRadius: 1, background: "var(--pf-n900)" }} />
      </div>
    </div>
  );
}

const GRID = "1.9fr 1.5fr 0.65fr 0.85fr 0.75fr 1.2fr 24px";

function MatrixRowView({ row, open, onToggle, reminded, onRemind, onVerify }: {
  row: MatrixRow; open: boolean; onToggle: () => void;
  reminded: Set<string>; onRemind: (h: Holder, row: MatrixRow) => void; onVerify: (row: MatrixRow) => void;
}) {
  const { hovered, hoverProps } = useHover();
  const covTone: PfTone = row.coverage >= 95 ? "green" : row.coverage >= 90 ? "yellow" : "red";
  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", background: hovered || open ? "var(--pf-n25)" : "transparent", transition: "background .15s ease" }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{row.cert}</div>
          <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{row.issuer}</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n500)" }}>{row.requiredFor}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{row.holders}</div>
        <div>{row.expiring > 0 ? <PfBadge tone="yellow">{row.expiring} in 30d</PfBadge> : <span style={{ fontSize: 12.5, color: "var(--pf-n300)" }}>—</span>}</div>
        <div>{row.expired > 0 ? <PfBadge tone="red">{row.expired}</PfBadge> : <span style={{ fontSize: 12.5, color: "var(--pf-n300)" }}>—</span>}</div>
        <div>
          <PfProgress pct={row.coverage} tone={covTone} height={6} />
          <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 4 }}>{row.coverage}% covered</div>
        </div>
        <Ic name={open ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
      </div>

      {open && (
        <div style={{ background: "var(--pf-n25)", padding: "2px 16px 13px", borderTop: "1px dashed var(--pf-n100)" }}>
          {row.people.map((h, i) => {
            const b = EXPIRY_BADGE[h.state];
            const key = `${row.id}:${h.emp.id}`;
            const sent = reminded.has(key);
            return (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderBottom: i < row.people.length - 1 ? "1px solid var(--pf-n50)" : "none", flexWrap: "wrap" }}>
                <PfAvatar init={h.emp.init} tone={h.emp.tone} size={30} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
                    {h.emp.name}
                    <span style={{ fontWeight: 400, color: "var(--pf-n400)" }}> · {h.emp.role} · {h.emp.loc}</span>
                  </div>
                  {h.note && <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{h.note}</div>}
                </div>
                <PfBadge tone="grey">{h.cert}</PfBadge>
                <PfBadge tone={b.tone} dot>{b.label(h.expires)}</PfBadge>
                <PfBtn small icon={sent ? "check" : "paperplane"} onClick={() => !sent && onRemind(h, row)} style={sent ? { color: "var(--pf-primary-600)", cursor: "default" } : undefined}>
                  {sent ? "Reminder sent" : "Send renewal reminder"}
                </PfBtn>
                <PfBtn small icon="sparkle" onClick={() => onVerify(row)} style={{ color: "var(--pf-purple-500)" }}>Verify with issuer</PfBtn>
              </div>
            );
          })}
          {row.gapNote && (
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 10, fontSize: 11.5, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" /> Coverage gap: {row.gapNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- screen --------------------------------- */

export default function Compliance() {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>("neb-igc");
  const [reminded, setReminded] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState("sites");

  const remind = (h: Holder, row: MatrixRow) => {
    setReminded((s) => new Set(s).add(`${row.id}:${h.emp.id}`));
    toast(`Renewal reminder sent to ${h.emp.name} — ${row.cert}`, "success");
  };
  const verify = (row: MatrixRow) => toast(`Issuer verification via existing stack — ${row.registry} ✓`, "ai");

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0 }}>Certifications & Compliance</h1>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--pf-n900)", color: "#fff", borderRadius: 99, padding: "4px 11px", fontSize: 11.5, fontWeight: 500 }}>
              <Ic name="sparkle" size={12} color="var(--pf-primary-500)" /> Oil & Gas pack · flagship design partner
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 4 }}>
            Role-required certifications, site readiness, medicals and NCDMB statutory reporting — one register.
          </div>
        </div>
        <PfBtn icon="clipboard" onClick={() => toast("Compliance audit trail opened — 214 logged events, all attributable")}>Audit trail</PfBtn>
      </div>

      {/* Page-wide alert */}
      <div>
        <PfBanner tone="red" icon="warning" cta="Review" onCta={() => { setTab("sites"); setOpen("first-aid"); toast("First Aid at Work holders expanded in the matrix below"); }}>
          1 expired certification — Halima Sule (First Aid at Work) is off-rota for site duties until renewal is verified.
        </PfBanner>
      </div>

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "sites", label: "Sites & certification matrix", count: String(MATRIX.length) },
            { key: "medicals", label: "Medicals", count: String(MEDICALS.length) },
            { key: "ncdmb", label: "NCDMB Nigerian content", count: String(NCDMB.filings.length) },
            { key: "union", label: "Union" },
          ]}
        />
      </div>

      {tab === "sites" && (
      <>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        <PfStat icon="shield" tone="green" label="Compliance" value="94%" unit="org-wide" delta="+1.2pp vs Q2" deltaTone="green" />
        <PfStat icon="clock" tone="yellow" label="Expiring in 30 days" value="2" unit="certs" delta="renewals queued" deltaTone="yellow" />
        <PfStat icon="warning" tone="red" label="Expired" value={<span style={{ color: "var(--pf-red-500)" }}>1</span>} unit="cert" delta="off-rota risk" deltaTone="red" />
        <PfStat icon="house" tone="blue" label="Sites tracked" value="3" unit="locations" delta="1 offshore" deltaTone="blue" />
      </div>

      {/* Site compliance */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
        {SITES.map((s) => (
          <SiteCard key={s.name} site={s} onView={() => toast(`${s.name} compliance register opened — ${s.staff} staff, ${s.pct}% compliant`)} />
        ))}
      </div>

      {/* Certification matrix */}
          <PfCard style={{ overflow: "hidden" }}>
            <PfCardHead title="Certification matrix" sub="Role-required certs × holders, expiries and coverage">
              <PfBadge tone="grey">5 role-required certs</PfBadge>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 12, padding: "9px 16px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Certification</PfTh><PfTh>Required for</PfTh><PfTh>Holders</PfTh><PfTh>Expiring</PfTh><PfTh>Expired</PfTh><PfTh>Coverage</PfTh><PfTh />
            </div>
            {MATRIX.map((row) => (
              <MatrixRowView
                key={row.id}
                row={row}
                open={open === row.id}
                onToggle={() => setOpen(open === row.id ? null : row.id)}
                reminded={reminded}
                onRemind={remind}
                onVerify={verify}
              />
            ))}
          </PfCard>
      </>
      )}

      {/* Medicals & fitness-to-work */}
      {tab === "medicals" && (
          <PfCard>
            <PfCardHead title="Medicals & fitness-to-work" sub="Occupational health schedule — DPR-accredited clinics">
              <PfBtn small variant="primary" icon="plus" onClick={() => toast("Fitness-to-work medical requested — Lifeline Clinic, Port Harcourt", "success")}>Schedule medical</PfBtn>
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1.2fr 0.9fr 0.8fr", gap: 12, padding: "9px 16px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>Person</PfTh><PfTh>Site</PfTh><PfTh>Due</PfTh><PfTh>Status</PfTh>
            </div>
            {MEDICALS.map((m) => (
              <div key={m.emp.id} style={{ display: "grid", gridTemplateColumns: "1.7fr 1.2fr 0.9fr 0.8fr", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                  <PfAvatar init={m.emp.init} tone={m.emp.tone} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.emp.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{m.emp.role}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)" }}>{m.site}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)" }}>{m.due}</div>
                <div><PfBadge tone={m.tone} dot>{m.state}</PfBadge></div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "11px 16px", fontSize: 11.5, color: "var(--pf-n400)" }}>
              <Ic name="shield" size={14} color="var(--pf-n300)" />
              Results are stored in the vault under retention rules — HSE sees fitness status only, never diagnoses.
            </div>
          </PfCard>
      )}

      {/* NCDMB Nigerian content — the pack's crown jewel */}
      {tab === "ncdmb" && (
        <div style={{ maxWidth: 480 }}>
          <PfCard>
            <PfCardHead title="NCDMB Nigerian content" sub="Statutory composition reporting — Appendix B">
              <PfBadge tone="green" dot>Passing</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 16px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <NcdmbDial ng={NCDMB.ratio.ng} target={NCDMB.target} />
                <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                  {[
                    { c: "var(--pf-primary-500)", l: "Nigerian staff", v: `${NCDMB.ratio.ng}%` },
                    { c: "var(--pf-n100)", l: "Expatriate", v: `${NCDMB.ratio.exp}%` },
                    { c: "var(--pf-n900)", l: "Statutory target", v: `${NCDMB.target}%` },
                  ].map((r) => (
                    <div key={r.l} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--pf-n500)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: r.c, flex: "none" }} />
                      <span style={{ flex: 1 }}>{r.l}</span>
                      <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{r.v}</span>
                    </div>
                  ))}
                  <PfBadge tone="green">+1pp above target</PfBadge>
                </div>
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", margin: "14px 0 10px", textTransform: "uppercase" as const, letterSpacing: ".4px" }}>By role family</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {NCDMB.byFamily.map((f) => <FamilyBar key={f.fam} fam={f.fam} ng={f.ng} target={NCDMB.target} />)}
              </div>

              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)", margin: "16px 0 8px", textTransform: "uppercase" as const, letterSpacing: ".4px" }}>Filings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {NCDMB.filings.map((f) => (
                  <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "9px 10px" }}>
                    <PfTile icon="file" tone={f.state === "ready" ? "green" : "yellow"} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", lineHeight: 1.3 }}>{f.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Due {f.due}</div>
                    </div>
                    <PfBadge tone={f.state === "ready" ? "green" : "yellow"}>{f.state === "ready" ? "Ready" : "In progress"}</PfBadge>
                  </div>
                ))}
              </div>

              <PfBtn variant="primary" full icon="download" style={{ marginTop: 12 }} onClick={() => toast("NCDMB composition report exported (PDF)", "success")}>
                Export statutory report
              </PfBtn>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 9, lineHeight: 1.45 }}>
                A compliance obligation no general HR product serves — filed straight from the register, no re-keying.
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* Union-awareness footnote */}
      {tab === "union" && (
        <div style={{ maxWidth: 480 }}>
          <PfCard pad={16}>
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <PfTile icon="users" tone="blue" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Union-aware analytics</div>
                <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>
                  Workforce analytics segmented to respect collective-bargaining categories — PENGASSAN (senior staff) and NUPENG (junior staff) cuts are never mixed in reporting.
                </div>
                <button
                  onClick={() => toast("Collective-bargaining segmentation template opened — PENGASSAN / NUPENG categories")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 8, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--pf-blue-500)" }}
                >
                  View segmentation template <Ic name="arrowright" size={13} />
                </button>
              </div>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
