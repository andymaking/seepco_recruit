"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress,
  PfBanner, PfPageTabs, PfTh, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  SECURITY_POSTURE, ANNEX_A, MODEL_CARDS, TRUST_ARTIFACTS, SUBPROCESSORS, SLA,
  AI_SURFACES, auditScore, toneForState,
  type PostureRow, type AnnexControl, type ModelCard, type TrustArtifact,
  type Subprocessor, type SlaRow,
} from "@/data/trust";
import { ADAPTERS } from "@/data/adapters";

/**
 * Trust center — PRD v2.1 FR-092.
 *
 * These are the procurement checkboxes an incumbent answers with an ISO 27001
 * logo on a marketing page. The certificate is on the auditor's clock; every
 * control behind it is code that ships today. This screen keeps those two things
 * visibly apart — the answers that are IN PLACE carry an artifact you can open,
 * the ones IN PROGRESS say what they are waiting on, and the one Annex A gap
 * (A.5.7 threat intelligence) is printed rather than quietly omitted.
 *
 * Nothing on this page is model output. It is the index a procurement reviewer
 * reads: posture, evidence, model cards, subprocessors, SLA.
 */

/* --------------------------------- tenant ---------------------------------- */

/** The workspace record the DPA generator fills from. */
const TENANT = {
  name: "Unrealabs Limited",
  rc: "RC 1439021",
  address: "14 Adeola Odeku Street, Victoria Island, Lagos",
  dpo: "Funke Adebayo · Data Protection Officer",
  basis: "NDPA 2023 · controller-to-processor",
  workspace: "unrealabs.hirebrew.ng",
};

const PUBLIC_URL = "trust.unrealabs.ng";

/* ------------------------------ page constants ----------------------------- */

type PostureMeta = {
  owner: string; reviewed: string;
  /** Only for in-progress answers — what the finish line actually depends on. */
  waitingOn?: string;
  stage?: string; stageLabel?: string;
  /** True where the answer is reproduced verbatim on the public trust page. */
  pub: boolean;
};

const POSTURE_META: Record<string, PostureMeta> = {
  "Data residency": {
    owner: "Ngozi Adeyemi · Engineering", reviewed: "Statement reviewed Aug 04, 2026", pub: true,
  },
  Encryption: {
    owner: "Ngozi Adeyemi · Engineering", reviewed: "Infrastructure config reviewed Aug 04, 2026",
    stage: "contracts", stageLabel: "Document vault", pub: true,
  },
  "Access control": {
    owner: "Funke Adebayo · People / HR", reviewed: "Roles last reviewed Aug 18, 2026",
    stage: "personas", stageLabel: "Roles & permissions", pub: true,
  },
  "Audit logging": {
    owner: "Ngozi Adeyemi · Engineering", reviewed: "Coverage checked Aug 18, 2026",
    stage: "audit", stageLabel: "Audit log", pub: true,
  },
  "NDPR / NDPA": {
    owner: "Funke Adebayo · DPO", reviewed: "Consent register reviewed Jul 30, 2026",
    stage: "myprivacy", stageLabel: "Subject-rights surface", pub: true,
  },
  "ISO 27001": {
    owner: "Chinedu Eze · HSE & Compliance", reviewed: "Audit kickoff Sep 09, 2026", pub: true,
    waitingOn: "A certification body's calendar. Every Annex A artifact the audit will ask for is already mapped — the audit starts from artifacts, not archaeology.",
  },
  "SOC 2 Type II": {
    owner: "Chinedu Eze · HSE & Compliance", reviewed: "Window opens Q1 2027", pub: true,
    waitingOn: "A Type II is an observation window, not a document. The window cannot open until the ISO controls have been operating for a period.",
  },
  DPIAs: {
    owner: "Funke Adebayo · DPO", reviewed: "Templates drafted Aug 20, 2026", pub: false,
    stage: "cases", stageLabel: "Queries & cases",
    waitingOn: "Our own sign-off, not a third party's. Disciplinary (FR-088) and attendance (FR-089) do not go GA on real employee data until the DPIA is signed.",
  },
};

const STATE_LABEL: Record<PostureRow["state"], string> = {
  "in-place": "In place",
  "in-progress": "In progress",
};

const ARTIFACT_TONE: Record<TrustArtifact["state"], PfTone> = { live: "green", generated: "blue", pending: "yellow" };

const ARTIFACT_STATE_LABEL: Record<TrustArtifact["state"], string> = {
  live: "Live",
  generated: "Generate on demand",
  pending: "Waiting on the auditor",
};

const ARTIFACT_ICON: Record<TrustArtifact["kind"], string> = { Page: "arrowsq", Report: "treemap", Document: "file" };

/** What each generated artifact actually produces when a reviewer asks for it. */
const GENERATED_RESULT: Record<string, string> = {
  "Audit-log coverage report": "Audit-log coverage report generated — 14 sensitive tables, 14 covered by the logging middleware, 0 uncovered (PDF + CSV)",
  "Access-review console": "Access review generated — 63 role grants across 8 roles; 4 grants last reviewed over 90 days ago and flagged for re-approval",
};

const SURFACE_STAGE: Record<string, { stage: string; label: string }> = {
  Screening: { stage: "screening", label: "Screening" },
  Attrition: { stage: "attrition", label: "Attrition & risk" },
  "Internal roles": { stage: "mobility", label: "Internal mobility" },
  "Growth plans": { stage: "growth", label: "Growth plans" },
  "HR letters": { stage: "letters", label: "HR letters" },
  Cases: { stage: "cases", label: "Queries & cases" },
  Attendance: { stage: "attendance", label: "Attendance signals" },
};

/** Target-vs-measured needs a third column a table cannot carry: how much room is left. */
const SLA_META: Record<string, { used: number; usedLabel: string; note: string }> = {
  "Platform availability": { used: 58, usedLabel: "58% of the monthly downtime allowance used", note: "0.29% unavailable against a 0.5% allowance, trailing 90 days." },
  "P1 incident response": { used: 63, usedLabel: "63% of the response window used", note: "Median across 6 P1 incidents in the trailing 90 days." },
  "Support first response": { used: 53, usedLabel: "53% of the first-response window used", note: "One business day counted as 8 working hours, Lagos time." },
  "Data export on request": { used: 40, usedLabel: "40% of the export window used", note: "Includes the full-tenant export a buyer's exit clause asks for." },
};

/* --------------------------------- derived --------------------------------- */

const IN_PLACE = SECURITY_POSTURE.filter((p) => p.state === "in-place").length;
const IN_PROGRESS = SECURITY_POSTURE.length - IN_PLACE;

const MAPPED = ANNEX_A.filter((c) => c.state === "mapped").length;
const GAPS = ANNEX_A.filter((c) => c.state === "gap");
const COVERAGE = Math.round((MAPPED / ANNEX_A.length) * 100);

const RESIDENCY = SECURITY_POSTURE.find((p) => p.area === "Data residency")!;

const AUDIT = auditScore();

const NO_DPA = SUBPROCESSORS.filter((s) => !s.dpa);

const SEAMLESS = ADAPTERS.find((a) => a.provider === "SeamlessHR");

/** Where each processor actually sits — the question a Nigerian buyer asks second. */
const REGIONS: { region: string; names: string[]; offshore: boolean }[] =
  [...new Set(SUBPROCESSORS.map((s) => s.region))].map((region) => ({
    region,
    names: SUBPROCESSORS.filter((s) => s.region === region).map((s) => s.name),
    offshore: region !== "NG",
  }));

const surfacesFor = (id: string) => AI_SURFACES.filter((s) => s.modelCard === id);

const slaTone = (used: number): PfTone => (used < 70 ? "green" : used < 100 ? "yellow" : "red");

const dpaMessage = () =>
  `DPA generated for ${TENANT.name} (${TENANT.rc}), ${TENANT.address} — ${TENANT.basis}, ${TENANT.dpo}, covering ${SUBPROCESSORS.length} subprocessors · unsigned PDF ready for counsel`;

/* --------------------------------- grids ----------------------------------- */

const GRID_POSTURE = "162px minmax(260px,1fr) 188px 96px 18px";
const GRID_ANNEX = "78px 176px minmax(240px,1fr) 92px";
const GRID_MODEL = "58px minmax(150px,1fr) minmax(170px,1.05fr) minmax(230px,1.5fr) 130px 18px";
const GRID_SUB = "minmax(150px,1fr) minmax(230px,1.6fr) 104px 128px 96px";

/* ------------------------------- small parts ------------------------------- */

/** The public twin is the point of FR-092 — every section says whether a buyer sees it. */
function TwinChip({ pub }: { pub: boolean }) {
  return pub ? <PfBadge tone="green" dot>On the public page</PfBadge> : <PfBadge tone="grey" dot>Internal only</PfBadge>;
}

function Chip({ label, active, onClick, tone = "green" }: { label: string; active: boolean; onClick: () => void; tone?: PfTone }) {
  const t = TONE[tone];
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 999, cursor: "pointer",
        color: active ? t.fg : "var(--pf-n500)", background: active ? t.soft : "var(--pf-n0)",
        border: `1px solid ${active ? t.line : "var(--pf-n50)"}`, whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <span style={{ display: "inline-flex", transform: open ? "rotate(90deg)" : "none", transition: "transform .15s ease" }}>
      <Ic name="caretright" size={14} color="var(--pf-n300)" />
    </span>
  );
}

/** A claim we make with a named owner behind it — the panel under an expanded row. */
function MetaLine({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--pf-n500)" }}>
      <Ic name={icon} size={13} color="var(--pf-n300)" />
      {children}
    </div>
  );
}

/* ------------------------------ residency hero ----------------------------- */

function ResidencyHero({ onSubprocessors, onArtifact }: { onSubprocessors: () => void; onArtifact: () => void }) {
  const meta = POSTURE_META["Data residency"];
  return (
    <PfCard style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 16, padding: "18px 20px", alignItems: "flex-start", background: "linear-gradient(180deg, var(--pf-primary-50) 0%, var(--pf-n0) 100%)" }}>
        <PfTile icon="shield" tone="green" size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-primary-600)", letterSpacing: ".2px" }}>DATA RESIDENCY</span>
            <PfBadge tone="green" dot>{STATE_LABEL["in-place"]}</PfBadge>
            <TwinChip pub={meta.pub} />
          </div>
          <div style={{ fontSize: 16.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4, letterSpacing: "-.2px" }}>
            {RESIDENCY.answer}
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n500)", marginTop: 8, lineHeight: 1.55, maxWidth: 760 }}>
            The first question a Nigerian buyer asks, and the one a foreign-built HR suite answers with a shrug. Below is
            every processor that touches tenant data and the region it sits in — named, not summarised.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <PfBtn small variant="secondary" icon="file" onClick={onArtifact}>{RESIDENCY.evidence}</PfBtn>
            <PfBtn small variant="ghost" icon="stack" onClick={onSubprocessors}>See all {SUBPROCESSORS.length} subprocessors</PfBtn>
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{meta.owner} · {meta.reviewed}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${REGIONS.length}, minmax(0,1fr))`, borderTop: "1px solid var(--pf-n50)" }}>
        {REGIONS.map((r, i) => (
          <div key={r.region} style={{ padding: "14px 18px", borderLeft: i === 0 ? "none" : "1px solid var(--pf-n50)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: r.offshore ? "var(--pf-n900)" : "var(--pf-primary-500)", letterSpacing: "-.2px" }}>{r.region}</span>
              <PfBadge tone={r.offshore ? "blue" : "green"}>{r.offshore ? "Cross-border" : "In-region"}</PfBadge>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 6, lineHeight: 1.5 }}>{r.names.join(" · ")}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 18px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
        <Ic name="info" size={15} color="var(--pf-n400)" />
        <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
          Cross-border processing is not hidden behind the word &ldquo;in-region&rdquo;: {SUBPROCESSORS.length - NO_DPA.length} of {SUBPROCESSORS.length} processors
          carry a signed DPA and a recorded lawful basis, and the one without a DPA ({NO_DPA.map((s) => s.name).join(", ")}) is Nigerian and is only engaged where a tenant switches it on.
        </span>
      </div>
    </PfCard>
  );
}

/* ------------------------------- posture row ------------------------------- */

function PostureRowView({ row, open, onToggle, onArtifact, onSurface }: {
  row: PostureRow; open: boolean; onToggle: () => void;
  onArtifact: (r: PostureRow) => void; onSurface: (stage: string, label: string) => void;
}) {
  const { hovered, hoverProps } = useHover();
  const meta = POSTURE_META[row.area];
  const tone = toneForState(row.state);
  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: GRID_POSTURE, gap: 12, alignItems: "center",
          padding: "13px 20px", cursor: "pointer",
          background: open ? "var(--pf-n25)" : hovered ? "var(--pf-n25)" : "transparent",
          transition: "background .12s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE[tone].bg, flex: "none" }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.area}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.5 }}>{row.answer}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <Ic name={row.evidence === "—" ? "x" : "file"} size={13} color="var(--pf-n300)" />
          <span style={{ fontSize: 12.5, color: row.evidence === "—" ? "var(--pf-n300)" : "var(--pf-n600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.evidence === "—" ? "No artifact yet" : row.evidence}
          </span>
        </div>
        <div style={{ display: "flex" }}>
          <PfBadge tone={tone} dot>{STATE_LABEL[row.state]}</PfBadge>
        </div>
        <Caret open={open} />
      </div>

      {open && (
        <div style={{ padding: "0 20px 16px 20px", background: "var(--pf-n25)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, paddingTop: 2 }}>
            <MetaLine icon="user">Owner — <span style={{ color: "var(--pf-n900)", fontWeight: 500 }}>{meta.owner}</span></MetaLine>
            <MetaLine icon="clock">{meta.reviewed}</MetaLine>
            <MetaLine icon="shield">{meta.pub ? "Reproduced verbatim on the public trust page" : "Held internally — not published"}</MetaLine>
          </div>

          {meta.waitingOn && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "11px 14px" }}>
              <Ic name="clock" size={15} color="var(--pf-yellow-500)" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-yellow-500)" }}>What this is waiting on</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.55 }}>{meta.waitingOn}</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {meta.stage && (
              <PfBtn small variant="secondary" icon="arrowsq" onClick={() => onSurface(meta.stage!, meta.stageLabel ?? row.area)}>
                See it in the product — {meta.stageLabel}
              </PfBtn>
            )}
            <PfBtn small variant="ghost" icon="download" onClick={() => onArtifact(row)}>
              {row.evidence === "—" ? "No artifact to send yet" : `Add ${row.evidence} to the pack`}
            </PfBtn>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- annex row -------------------------------- */

function AnnexRow({ row, onEvidence }: { row: AnnexControl; onEvidence: (r: AnnexControl) => void }) {
  const { hovered, hoverProps } = useHover();
  const gap = row.state === "gap";
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: GRID_ANNEX, gap: 12, alignItems: "center",
        padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)",
        background: gap ? "var(--pf-red-50)" : hovered ? "var(--pf-n25)" : "transparent",
        transition: "background .12s ease",
      }}
    >
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: gap ? "var(--pf-red-500)" : "var(--pf-n900)" }}>{row.control}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)" }}>{row.name}</span>
      <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{row.artifact}</span>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {gap ? (
          <button
            onClick={() => onEvidence(row)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
          >
            <PfBadge tone="red" dot>Open gap</PfBadge>
          </button>
        ) : (
          <PfBadge tone="green" dot>Mapped</PfBadge>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- artifact row ------------------------------ */

function ArtifactRow({ a, generated, onAction }: { a: TrustArtifact; generated?: string; onAction: (a: TrustArtifact) => void }) {
  const { hovered, hoverProps } = useHover();
  const tone = ARTIFACT_TONE[a.state];
  const label = a.state === "live" ? "Open" : a.state === "generated" ? (generated ? "Download" : "Generate") : "Request status";
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "13px 20px",
        borderBottom: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <PfTile icon={ARTIFACT_ICON[a.kind]} tone={tone} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.name}</span>
          <PfBadge tone={tone} dot>{ARTIFACT_STATE_LABEL[a.state]}</PfBadge>
          {generated && <PfBadge tone="green">{generated}</PfBadge>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>{a.note}</div>
      </div>
      <span style={{ fontSize: 12, color: "var(--pf-n300)", flex: "none" }}>{a.kind}</span>
      <PfBtn
        small
        variant={a.state === "pending" ? "ghost" : "secondary"}
        icon={a.state === "live" ? "arrowsq" : a.state === "generated" ? "download" : "clock"}
        onClick={() => onAction(a)}
      >
        {label}
      </PfBtn>
    </div>
  );
}

/* ------------------------------- model row --------------------------------- */

function ModelRow({ card, open, onToggle, onSurface, onAudit }: {
  card: ModelCard; open: boolean; onToggle: () => void;
  onSurface: (stage: string, label: string) => void; onAudit: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const dest = SURFACE_STAGE[card.surface];
  const govern = surfacesFor(card.id);
  return (
    <div style={{ borderBottom: "1px solid var(--pf-n50)" }}>
      <div
        {...hoverProps}
        onClick={onToggle}
        style={{
          display: "grid", gridTemplateColumns: GRID_MODEL, gap: 12, alignItems: "center",
          padding: "13px 20px", cursor: "pointer",
          background: open || hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
        }}
      >
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-purple-500)" }}>{card.id}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{card.name}</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.45 }}>{card.purpose}</div>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{card.inputs}</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 8, padding: "7px 10px" }}>
          <Ic name="shield" size={14} color="var(--pf-primary-500)" />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-primary-600)", lineHeight: 1.45 }}>{card.humanGate}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); if (dest) onSurface(dest.stage, dest.label); }}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, color: "var(--pf-n600)", fontSize: 12.5, fontWeight: 500 }}
        >
          {card.surface}
          <Ic name="arrowright" size={13} color="var(--pf-n300)" />
        </button>
        <Caret open={open} />
      </div>

      {open && (
        <div style={{ padding: "0 20px 16px 20px", background: "var(--pf-n25)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
              <PfTh>Inputs the model is allowed to see</PfTh>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {card.inputs.split(",").map((i) => (
                  <PfBadge key={i} tone="blue">{i.trim()}</PfBadge>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 10, lineHeight: 1.5 }}>
                No protected attribute and no NCDMB reporting field appears in this list — nationality and host community are
                counted for statutory returns and never enter a model.
              </div>
            </div>
            <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "12px 14px" }}>
              <PfTh>Surfaces this card governs</PfTh>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
                {govern.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--pf-n600)" }}>
                    <PfBadge tone="grey">{s.pillar}</PfBadge>
                    <span style={{ fontWeight: 500, color: "var(--pf-n900)" }}>{s.surface}</span>
                    <span style={{ color: "var(--pf-n400)" }}>— {s.where}</span>
                  </div>
                ))}
                {govern.length === 0 && <span style={{ fontSize: 12.5, color: "var(--pf-n400)" }}>No live surface yet.</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {dest && <PfBtn small variant="secondary" icon="arrowsq" onClick={() => onSurface(dest.stage, dest.label)}>Open {dest.label}</PfBtn>}
                <PfBtn small variant="ghost" icon="robot" onClick={onAudit}>See the &ldquo;Why this?&rdquo; audit</PfBtn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- sub row --------------------------------- */

function SubRow({ s, onRequest }: { s: Subprocessor; onRequest: (s: Subprocessor) => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        display: "grid", gridTemplateColumns: GRID_SUB, gap: 12, alignItems: "center",
        padding: "13px 20px", borderBottom: "1px solid var(--pf-n50)",
        background: !s.dpa ? "var(--pf-yellow-50)" : hovered ? "var(--pf-n25)" : "transparent", transition: "background .12s ease",
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{s.name}</span>
      <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{s.purpose}</span>
      <div style={{ display: "flex" }}>
        <PfBadge tone={s.region === "NG" ? "green" : "blue"}>{s.region}</PfBadge>
      </div>
      <div style={{ display: "flex" }}>
        {s.dpa ? <PfBadge tone="green" dot>DPA signed</PfBadge> : <PfBadge tone="yellow" dot>No DPA yet</PfBadge>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PfBtn small variant="ghost" icon={s.dpa ? "file" : "warning"} onClick={() => onRequest(s)}>
          {s.dpa ? "View DPA" : "Track"}
        </PfBtn>
      </div>
    </div>
  );
}

/* --------------------------------- sla row --------------------------------- */

function SlaCard({ row, onEvidence }: { row: SlaRow; onEvidence: (r: SlaRow) => void }) {
  const meta = SLA_META[row.metric];
  const tone = slaTone(meta?.used ?? 0);
  return (
    <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{row.metric}</span>
            <PfBadge tone={tone} dot>{tone === "green" ? "Within target" : "At the limit"}</PfBadge>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>{meta?.note}</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Target {row.target}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px", marginTop: 2 }}>{row.measured}</div>
        </div>
        <PfBtn small variant="ghost" icon="download" onClick={() => onEvidence(row)}>Evidence</PfBtn>
      </div>
      <div style={{ marginTop: 10 }}>
        <PfProgress pct={meta?.used ?? 0} tone={tone} height={6} />
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 5 }}>{meta?.usedLabel}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- screen --------------------------------- */

export default function TrustCenter() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState("posture");
  const [postureFilter, setPostureFilter] = useState<"all" | PostureRow["state"]>("all");
  const [openArea, setOpenArea] = useState<string | null>("Data residency");
  const [annexFilter, setAnnexFilter] = useState<"all" | AnnexControl["state"]>("all");
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});

  const posture = SECURITY_POSTURE.filter((p) => postureFilter === "all" || p.state === postureFilter);
  const annex = ANNEX_A.filter((c) => annexFilter === "all" || c.state === annexFilter);

  const openPublic = () =>
    toast(`Public trust page opened — ${PUBLIC_URL} · posture, residency, SLA, subprocessors and the model-card index, no login required`);

  const generateDpa = () => {
    setGenerated((g) => ({ ...g, "DPA generator": "Generated just now" }));
    toast(dpaMessage(), "success");
  };

  const surfaceNav = (stage: string, label: string) => {
    toast(`Opening ${label} — the control this trust answer is describing`);
    go(stage);
  };

  const artifactToPack = (r: PostureRow) => {
    if (r.evidence === "—") {
      toast(`${r.area} has no artifact yet — it is listed as in progress rather than claimed`, "danger");
      return;
    }
    toast(`${r.evidence} added to the evidence pack — ${r.area} (${STATE_LABEL[r.state]})`, "success");
  };

  const artifactAction = (a: TrustArtifact) => {
    if (a.state === "live") { openPublic(); return; }
    if (a.state === "pending") {
      toast(`${a.name} — still on the certification body's clock. Audit kickoff Sep 09, 2026; the Annex A pack is already mapped and waiting.`);
      return;
    }
    if (generated[a.name]) {
      toast(`${a.name} downloaded — ${TENANT.name} (${TENANT.workspace})`, "success");
      return;
    }
    if (a.name === "DPA generator") { generateDpa(); return; }
    setGenerated((g) => ({ ...g, [a.name]: "Generated just now" }));
    toast(GENERATED_RESULT[a.name] ?? `${a.name} generated for ${TENANT.name}`, "success");
  };

  const exportPack = () =>
    toast(
      `Evidence pack exported — ${MAPPED} of ${ANNEX_A.length} Annex A controls mapped (1 gap listed), ${IN_PLACE} posture answers with artifacts, ${MODEL_CARDS.length} model cards, ${SUBPROCESSORS.length} subprocessors`,
      "success",
    );

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ------------------------------ header ------------------------------ */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Trust center</span>
            <PfBadge tone="purple">FR-092</PfBadge>
            <PfBadge tone="grey">No model output on this page</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3, lineHeight: 1.5 }}>
            The procurement answers, with the artifact behind each one. Everything codeable ships today; the certificate is on
            an auditor&rsquo;s calendar — and this page says which is which rather than putting a logo over the difference.
          </div>
        </div>
        <PfBtn variant="secondary" icon="arrowsq" onClick={openPublic}>Public page</PfBtn>
        <PfBtn variant="secondary" icon="file" onClick={generateDpa}>Generate DPA</PfBtn>
        <PfBtn variant="primary" icon="download" onClick={exportPack}>Export evidence pack</PfBtn>
      </div>

      {/* ------------------------------- KPIs -------------------------------- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="shield" tone="green" label="Posture answers in place" value={IN_PLACE} unit={`of ${SECURITY_POSTURE.length}`} delta={`${IN_PROGRESS} in progress`} deltaTone="yellow" />
        <PfStat icon="clipboard" tone="blue" label="Annex A controls mapped" value={MAPPED} unit={`of ${ANNEX_A.length} · ${COVERAGE}%`} delta={`${GAPS.length} open gap`} deltaTone="red" />
        <PfStat icon="robot" tone="purple" label="Model cards published" value={MODEL_CARDS.length} unit="with a human gate" delta={`${AUDIT.pct}% explained`} deltaTone="purple" />
        <PfStat icon="pulse" tone="yellow" label="SLA targets met" value={SLA.length} unit={`of ${SLA.length} · trailing 90d`} delta="99.71% uptime" deltaTone="green" />
      </div>

      <PfBanner tone="green" icon="shield" cta="open" onCta={openPublic}>
        <span style={{ fontWeight: 600 }}>This page has a public twin at {PUBLIC_URL} — </span>
        <span style={{ fontWeight: 400 }}>
          posture, residency, SLA, subprocessors and the model-card index are published verbatim, with no login, which is what a
          buyer&rsquo;s security reviewer reads before they ever email you. Control-by-control mappings, owners and access reviews stay in here.
        </span>
      </PfBanner>

      {/* ------------------------------- tabs -------------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "posture", label: "Security posture", count: String(SECURITY_POSTURE.length) },
            { key: "evidence", label: "Evidence pack" },
            { key: "models", label: "Model cards", count: String(MODEL_CARDS.length) },
            { key: "sub", label: "Subprocessors & SLA" },
          ]}
        />
      </div>

      {/* ============================== POSTURE ============================== */}
      {tab === "posture" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ResidencyHero
            onSubprocessors={() => setTab("sub")}
            onArtifact={() => artifactToPack(RESIDENCY)}
          />

          <PfCard>
            <PfCardHead
              title="The answers, one per question"
              sub={`${IN_PLACE} in place with an artifact behind them · ${IN_PROGRESS} in progress with what each is waiting on. Click a row for the owner and the surface.`}
            >
              <TwinChip pub />
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <Ic name="filter" size={14} color="var(--pf-n300)" />
              <Chip label={`All ${SECURITY_POSTURE.length}`} active={postureFilter === "all"} onClick={() => setPostureFilter("all")} />
              <Chip label={`In place ${IN_PLACE}`} active={postureFilter === "in-place"} onClick={() => setPostureFilter("in-place")} />
              <Chip label={`In progress ${IN_PROGRESS}`} tone="yellow" active={postureFilter === "in-progress"} onClick={() => setPostureFilter("in-progress")} />
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{posture.length} shown</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: GRID_POSTURE, gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Area</PfTh>
              <PfTh>The plain answer</PfTh>
              <PfTh>Evidence artifact</PfTh>
              <PfTh>State</PfTh>
              <PfTh />
            </div>

            {posture.map((row) => (
              <PostureRowView
                key={row.area}
                row={row}
                open={openArea === row.area}
                onToggle={() => setOpenArea(openArea === row.area ? null : row.area)}
                onArtifact={artifactToPack}
                onSurface={surfaceNav}
              />
            ))}
          </PfCard>

          <PfCard pad="16px 20px">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <PfTile icon="warning" tone="yellow" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>What we are not claiming</div>
                <div style={{ fontSize: 13, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.6 }}>
                  We do not hold an ISO 27001 certificate. We do not hold a SOC 2 Type II report. The DPIAs for disciplinary and
                  attendance are drafted and unsigned. A certificate we do not have yet is not a control we do not have — the controls
                  are in the product and you can open every one of them; the audit is a date. Anyone who tells you those are the same
                  thing is selling you a logo.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="clipboard" onClick={() => setTab("evidence")}>See the Annex A pack</PfBtn>
                  <PfBtn small variant="ghost" icon="clock" onClick={() => toast("ISO 27001 — certification body engaged, audit kickoff Sep 09, 2026. Status shared with the buyer's security reviewer on request.")}>
                    Certification timeline
                  </PfBtn>
                </div>
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* ============================== EVIDENCE ============================= */}
      {tab === "evidence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12 }}>
            <PfCard pad="18px 20px">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PfTh>Annex A coverage</PfTh>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 30, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.8px", lineHeight: 1 }}>{MAPPED}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n300)" }}>/ {ANNEX_A.length}</span>
                    <PfBadge tone="blue">{COVERAGE}% mapped</PfBadge>
                  </div>
                </div>
                <PfTile icon="clipboard" tone="blue" size={38} />
              </div>
              <div style={{ marginTop: 12 }}>
                <PfProgress pct={COVERAGE} tone="blue" height={8} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 10, lineHeight: 1.55 }}>
                Each mapped control points at a live artifact — permissions, retention rules, logging middleware, consent receipts —
                so the certification audit starts from artifacts rather than archaeology.
              </div>
            </PfCard>

            {GAPS.map((g) => (
              <PfCard key={g.control} style={{ borderColor: "var(--pf-red-100)" }} pad="18px 20px">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <PfTile icon="warning" tone="red" size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-red-500)" }}>{g.control}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{g.name}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 3 }}>{g.artifact}</div>
                  </div>
                  <PfBadge tone="red" dot>Open gap</PfBadge>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 11, lineHeight: 1.6, borderTop: "1px solid var(--pf-n50)", paddingTop: 11 }}>
                  <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Why it is printed here.</span>{" "}A trust page that shows no gaps is not
                  a trustworthy page, it is a brochure. Owner: Chinedu Eze · HSE &amp; Compliance. Target: formalised threat-intel intake
                  before the audit opens on Sep 09, 2026.
                </div>
              </PfCard>
            ))}
          </div>

          <PfCard>
            <PfCardHead
              title="ISO 27001 Annex A — control mapping"
              sub={`${MAPPED} mapped · ${GAPS.length} gap · every row names the artifact an auditor will be handed.`}
            >
              <TwinChip pub={false} />
            </PfCardHead>

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "12px 20px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
              <Ic name="filter" size={14} color="var(--pf-n300)" />
              <Chip label={`All ${ANNEX_A.length}`} active={annexFilter === "all"} onClick={() => setAnnexFilter("all")} />
              <Chip label={`Mapped ${MAPPED}`} active={annexFilter === "mapped"} onClick={() => setAnnexFilter("mapped")} />
              <Chip label={`Gap ${GAPS.length}`} tone="red" active={annexFilter === "gap"} onClick={() => setAnnexFilter("gap")} />
              <span style={{ flex: 1 }} />
              <PfBtn small variant="ghost" icon="download" onClick={exportPack}>Export mapping (CSV)</PfBtn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: GRID_ANNEX, gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Control</PfTh>
              <PfTh>Name</PfTh>
              <PfTh>Artifact in the product</PfTh>
              <PfTh style={{ textAlign: "right" }}>State</PfTh>
            </div>

            {annex.map((row) => (
              <AnnexRow
                key={row.control}
                row={row}
                onEvidence={(r) => toast(`${r.control} ${r.name} — open gap, owner assigned. It stays on this page until the artifact exists.`, "danger")}
              />
            ))}
          </PfCard>

          <PfCard>
            <PfCardHead
              title="Trust artifacts"
              sub="What a reviewer can actually be handed today — generated from the workspace record, not written by hand."
            >
              <PfBtn small variant="secondary" icon="file" onClick={generateDpa}>Generate DPA</PfBtn>
            </PfCardHead>
            {TRUST_ARTIFACTS.map((a) => (
              <ArtifactRow key={a.name} a={a} generated={generated[a.name]} onAction={artifactAction} />
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 20px" }}>
              <Ic name="info" size={15} color="var(--pf-n400)" />
              <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
                Four of the five are ours to produce and ship today. The fifth is a certificate — it arrives when the auditor says so,
                and until then it is listed as pending rather than implied.
              </span>
            </div>
          </PfCard>
        </div>
      )}

      {/* =============================== MODELS ============================== */}
      {tab === "models" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
            <PfCard pad="16px 18px">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PfTile icon="shield" tone="green" size={30} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{MODEL_CARDS.length} of {MODEL_CARDS.length}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>model cards name a human gate</div>
                </div>
              </div>
            </PfCard>
            <PfCard pad="16px 18px">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PfTile icon="robot" tone="purple" size={30} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{AUDIT.covered} of {AUDIT.total}</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>AI outputs carry a &ldquo;Why this?&rdquo;</div>
                </div>
              </div>
            </PfCard>
            <PfCard pad="16px 18px">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PfTile icon="x" tone="red" size={30} />
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>0</div>
                  <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>surfaces that act without a person</div>
                </div>
              </div>
            </PfCard>
          </div>

          <PfBanner tone="yellow" icon="warning">
            <span style={{ fontWeight: 600 }}>Protected attributes and NCDMB fields are reporting fields, never model inputs. </span>
            <span style={{ fontWeight: 400 }}>
              Nationality and host community are counted for statutory local-content returns and appear in no input list below —
              open any card and check the inputs yourself.
            </span>
          </PfBanner>

          <PfCard>
            <PfCardHead
              title="Model cards"
              sub="One card per AI decision surface: what it is for, what it may see, who decides, and where it runs."
            >
              <TwinChip pub />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: GRID_MODEL, gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Card</PfTh>
              <PfTh>Purpose</PfTh>
              <PfTh>Inputs</PfTh>
              <PfTh style={{ color: "var(--pf-primary-600)", fontWeight: 600 }}>The human gate</PfTh>
              <PfTh>Surface</PfTh>
              <PfTh />
            </div>

            {MODEL_CARDS.map((card) => (
              <ModelRow
                key={card.id}
                card={card}
                open={openCard === card.id}
                onToggle={() => setOpenCard(openCard === card.id ? null : card.id)}
                onSurface={surfaceNav}
                onAudit={() => surfaceNav("aisurfaces", "the FR-093 surface audit")}
              />
            ))}
          </PfCard>

          <PfCard pad="16px 20px">
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <PfTile icon="clipboard" tone="red" size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>The one thing the AI is not allowed to do</div>
                <div style={{ fontSize: 13, color: "var(--pf-n500)", marginTop: 5, lineHeight: 1.6 }}>
                  MC-06 drafts a query letter from a case category and dated facts. It never recommends a sanction, and it never
                  proposes an outcome — HR authors that, on the record, with every access logged. The same rule governs MC-07:
                  attendance signals describe a pattern and never trigger automated discipline.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <PfBtn small variant="secondary" icon="clipboard" onClick={() => surfaceNav("cases", "Queries & cases")}>Open Queries &amp; cases</PfBtn>
                  <PfBtn small variant="secondary" icon="pulse" onClick={() => surfaceNav("attendance", "Attendance signals")}>Open Attendance signals</PfBtn>
                  <PfBtn small variant="ghost" icon="robot" onClick={() => surfaceNav("aisurfaces", "the FR-093 surface audit")}>The full surface audit</PfBtn>
                </div>
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* ================================ SUB =============================== */}
      {tab === "sub" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead
              title="Subprocessors"
              sub={`${SUBPROCESSORS.length} processors touch tenant data · ${SUBPROCESSORS.length - NO_DPA.length} under a signed DPA · ${NO_DPA.length} tracked and named.`}
            >
              <TwinChip pub />
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: GRID_SUB, gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <PfTh>Processor</PfTh>
              <PfTh>Purpose</PfTh>
              <PfTh>Region</PfTh>
              <PfTh>DPA</PfTh>
              <PfTh />
            </div>

            {SUBPROCESSORS.map((s) => (
              <SubRow
                key={s.name}
                s={s}
                onRequest={(x) =>
                  x.dpa
                    ? toast(`DPA on file — ${x.name} (${x.region}) · countersigned, covering ${x.purpose.toLowerCase()}`)
                    : toast(`${x.name} — no DPA yet. The connector stays dark until a tenant enables it and the DPA is countersigned.`, "danger")
                }
              />
            ))}

            <div style={{ display: "flex", gap: 10, padding: "13px 20px", background: "var(--pf-yellow-50)", borderTop: "1px solid var(--pf-n50)" }}>
              <Ic name="warning" size={16} color="var(--pf-yellow-500)" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-yellow-500)" }}>SeamlessHR is listed before it is engaged</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n600)", marginTop: 3, lineHeight: 1.6 }}>
                  It carries no DPA yet because no tenant data has reached it. The {SEAMLESS?.contract ?? "payroll_connector"} {SEAMLESS?.version ?? "v1"} adapter is
                  built to the same contract as the CSV drop that ships today and sits at{" "}
                  <span style={{ fontWeight: 600 }}>{SEAMLESS?.state ?? "awaiting-access"}</span> — {SEAMLESS?.note ?? "activates when API access lands."} A processor that is
                  only engaged where a tenant switches it on is still named here, before it processes anything.
                </div>
              </div>
            </div>
          </PfCard>

          <PfCard>
            <PfCardHead
              title="Service levels — target vs measured"
              sub="Measured over the trailing 90 days. The bar is how much of each allowance is being used, not a score."
            >
              <TwinChip pub />
            </PfCardHead>
            {SLA.map((row) => (
              <SlaCard
                key={row.metric}
                row={row}
                onEvidence={(r) => toast(`${r.metric} evidence attached — target ${r.target}, measured ${r.measured} (trailing 90 days, ${TENANT.workspace})`, "success")}
              />
            ))}
          </PfCard>

          <PfCard>
            <PfCardHead title="Data processing agreement" sub="Filled from the workspace record — no re-keying, no template hunt.">
              <TwinChip pub={false} />
            </PfCardHead>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, padding: "16px 20px" }}>
              {[
                { label: "Controller", value: `${TENANT.name} · ${TENANT.rc}` },
                { label: "Registered address", value: TENANT.address },
                { label: "Lawful basis & instrument", value: TENANT.basis },
                { label: "Data protection officer", value: TENANT.dpo },
                { label: "Workspace", value: TENANT.workspace },
                { label: "Subprocessors covered", value: `${SUBPROCESSORS.length} — ${SUBPROCESSORS.map((s) => s.name.split(" (")[0]).join(", ")}` },
              ].map((f) => (
                <div key={f.label} style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "11px 14px" }}>
                  <PfTh>{f.label}</PfTh>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--pf-n900)", marginTop: 4, lineHeight: 1.5 }}>{f.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px 16px 20px" }}>
              <PfBtn variant="primary" icon="file" onClick={generateDpa}>Generate DPA for {TENANT.name}</PfBtn>
              <PfBtn variant="secondary" icon="download" onClick={exportPack}>Export evidence pack</PfBtn>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                Produces an unsigned PDF for counsel. Nothing is executed here — signature stays with the humans who own it.
              </span>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}
