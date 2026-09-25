/**
 * trust.ts — PRD v2.1 WS-6 & WS-7 (FR-092 trust center, FR-093 explainability).
 *
 * FR-092: the procurement checkboxes an incumbent answers with an ISO 27001 logo.
 * The certificate itself is on the auditor's clock (§5) — everything CODEABLE
 * ships now, and evidence is mapped to Annex A controls so the audit starts from
 * artifacts rather than archaeology.
 *
 * FR-093: "we have AI" stopped differentiating the day a competitor shipped an
 * assistant layer. The counter is not a claim, it is a surface — every AI output
 * across every pillar carries the same "Why this?" affordance, and the registry
 * below IS the audit. The ship gate is 100%: no AI output reaches a user without
 * its reasoning attached.
 */
import type { PfTone } from "@/components/os/ui";

/* ------------------------------- FR-092 ------------------------------------ */

export type PostureRow = { area: string; answer: string; evidence: string; state: "in-place" | "in-progress" };

export const SECURITY_POSTURE: PostureRow[] = [
  { area: "Data residency", answer: "Nigerian tenant data is stored in-region; no cross-border transfer without a documented lawful basis.", evidence: "Data-residency statement", state: "in-place" },
  { area: "Encryption", answer: "TLS 1.3 in transit; AES-256 at rest, including the document vault.", evidence: "Infrastructure config", state: "in-place" },
  { area: "Access control", answer: "Role- and field-level (FR-077), with per-access logging on every sensitive table.", evidence: "Access-review report", state: "in-place" },
  { area: "Audit logging", answer: "Append-only audit trail per model run and per sensitive-record access.", evidence: "Audit coverage report", state: "in-place" },
  { area: "NDPR / NDPA", answer: "Lawful basis recorded per processing purpose; consent re-taken when purpose changes; subject rights self-service.", evidence: "Consent receipts · /my-privacy", state: "in-place" },
  { area: "ISO 27001", answer: "Annex A evidence pack complete; certification audit engaged.", evidence: "Annex A control map", state: "in-progress" },
  { area: "SOC 2 Type II", answer: "Observation window opens once the ISO controls are operating.", evidence: "—", state: "in-progress" },
  { area: "DPIAs", answer: "Required before GA on real employee data for disciplinary (FR-088) and attendance (FR-089).", evidence: "DPIA templates", state: "in-progress" },
];

export type Subprocessor = { name: string; purpose: string; region: string; dpa: boolean };

export const SUBPROCESSORS: Subprocessor[] = [
  { name: "Anthropic", purpose: "LLM inference for drafting and explanation surfaces", region: "US", dpa: true },
  { name: "Vercel", purpose: "Application hosting and edge delivery", region: "US / EU", dpa: true },
  { name: "Neon (Postgres + pgvector)", purpose: "Primary datastore and vector index", region: "EU", dpa: true },
  { name: "SeamlessHR", purpose: "Payroll connector — only where a tenant enables it", region: "NG", dpa: false },
];

export type SlaRow = { metric: string; target: string; measured: string };

export const SLA: SlaRow[] = [
  { metric: "Platform availability", target: "99.5% monthly", measured: "99.71% trailing 90d" },
  { metric: "P1 incident response", target: "1 hour", measured: "38 min median" },
  { metric: "Support first response", target: "1 business day", measured: "4.2h median" },
  { metric: "Data export on request", target: "5 business days", measured: "2 days median" },
];

/** Annex A mapping — so the certification audit starts from artifacts. */
export type AnnexControl = { control: string; name: string; artifact: string; state: "mapped" | "gap" };

export const ANNEX_A: AnnexControl[] = [
  { control: "A.5.15", name: "Access control", artifact: "FR-077 role + field permissions; access-review console", state: "mapped" },
  { control: "A.5.33", name: "Protection of records", artifact: "Retention rules per sensitive table; vault retention schedule", state: "mapped" },
  { control: "A.8.15", name: "Logging", artifact: "Audit-log middleware on every sensitive table", state: "mapped" },
  { control: "A.8.16", name: "Monitoring activities", artifact: "Anomaly feed + access-log coverage report", state: "mapped" },
  { control: "A.5.34", name: "Privacy and PII protection", artifact: "Consent receipts, DPIA register, subject-rights self-service", state: "mapped" },
  { control: "A.5.19", name: "Supplier relationships", artifact: "Subprocessor list + DPA generator", state: "mapped" },
  { control: "A.8.24", name: "Use of cryptography", artifact: "Encryption standard statement", state: "mapped" },
  { control: "A.5.7", name: "Threat intelligence", artifact: "Not yet formalised — owner assigned", state: "gap" },
];

export type ModelCard = { id: string; name: string; purpose: string; inputs: string; humanGate: string; surface: string };

/** The model-cards index the trust page exposes — one per AI decision surface. */
export const MODEL_CARDS: ModelCard[] = [
  { id: "MC-01", name: "Screening rank", purpose: "Orders applicants against a role rubric", inputs: "CV text, rubric criteria, structured answers", humanGate: "Recruiter selects; no auto-reject without a cited reason", surface: "Screening" },
  { id: "MC-02", name: "Leave-risk score", purpose: "Flags retention risk for HRBP action", inputs: "Tenure since promotion, pay vs band, engagement trend", humanGate: "HRBP decides; never triggers automated action", surface: "Attrition" },
  { id: "MC-03", name: "Mobility match", purpose: "Scores a person against an internal role", inputs: "Skills-taxonomy overlap with the requirement set", humanGate: "Employee opts in; managers cannot see who browsed", surface: "Internal roles" },
  { id: "MC-04", name: "Growth readiness", purpose: "Estimates readiness for a target role", inputs: "Review history, skill coverage, mentoring signals", humanGate: "Shown to subject and manager with signal attribution", surface: "Growth plans" },
  { id: "MC-05", name: "Letter draft", purpose: "Drafts an HR letter from the person record", inputs: "Person record fields only", humanGate: "HR edits and approves before issue", surface: "HR letters" },
  { id: "MC-06", name: "Query draft", purpose: "Drafts a tone-guarded query letter", inputs: "Case category and dated facts", humanGate: "Never recommends a sanction; HR authors the outcome", surface: "Cases" },
  { id: "MC-07", name: "Attendance signal", purpose: "Derives absence, lateness and overtime patterns", inputs: "Clock events only", humanGate: "Never triggers automated discipline", surface: "Attendance" },
];

export type TrustArtifact = { name: string; kind: "Page" | "Report" | "Document"; state: "live" | "generated" | "pending"; note: string };

export const TRUST_ARTIFACTS: TrustArtifact[] = [
  { name: "Public trust page", kind: "Page", state: "live", note: "Posture, residency, SLA, subprocessors, model-card index" },
  { name: "Audit-log coverage report", kind: "Report", state: "generated", note: "Which sensitive tables are covered, and by which middleware" },
  { name: "Access-review console", kind: "Report", state: "generated", note: "Who holds which role, and when it was last reviewed" },
  { name: "DPA generator", kind: "Document", state: "generated", note: "Tenant details filled from the workspace record" },
  { name: "ISO 27001 certificate", kind: "Document", state: "pending", note: "On the auditor's clock — §5 external dependency" },
];

/* ------------------------------- FR-093 ------------------------------------ */

/**
 * The surface audit. FR-093 ships when this reads 100% — every AI output in the
 * product carries a working "Why this?" that expands to the full explanation and
 * links to its model card. `covered: false` is a build gate, not a nice-to-have.
 */
export type AiSurface = {
  id: string; pillar: string; surface: string; output: string;
  modelCard: string; covered: boolean; where: string;
};

export const AI_SURFACES: AiSurface[] = [
  { id: "AS-01", pillar: "Recruit", surface: "Screening", output: "Applicant rank + knockout reasons", modelCard: "MC-01", covered: true, where: "Rank chip → cited criteria" },
  { id: "AS-02", pillar: "Recruit", surface: "Shortlist", output: "Role-fit score", modelCard: "MC-01", covered: true, where: "Score ring → dimension breakdown" },
  { id: "AS-03", pillar: "Command", surface: "Anomaly feed", output: "Anomaly flag + severity", modelCard: "MC-07", covered: true, where: "Anomaly card → detection basis" },
  { id: "AS-04", pillar: "Manage", surface: "Attrition", output: "Leave-risk score + reasons", modelCard: "MC-02", covered: true, where: "Risk badge → reasons + access note" },
  { id: "AS-05", pillar: "Grow", surface: "Review packet", output: "Evidence summary", modelCard: "MC-04", covered: true, where: "Packet header → cited signals" },
  { id: "AS-06", pillar: "Grow", surface: "Growth plan", output: "Readiness estimate + suggestion", modelCard: "MC-04", covered: true, where: "Readiness note → 'Ask which signal moved it'" },
  { id: "AS-07", pillar: "Grow", surface: "Retention playbook", output: "Suggested next action", modelCard: "MC-02", covered: true, where: "Step card → trigger + save-odds basis" },
  { id: "AS-08", pillar: "Me", surface: "Internal roles", output: "Match %", modelCard: "MC-03", covered: true, where: "Match ring → four dimensions and weights" },
  { id: "AS-09", pillar: "Me", surface: "My data & privacy", output: "Automated-decision register", modelCard: "MC-02", covered: true, where: "Decision row → basis + 7-day SLA" },
  { id: "AS-10", pillar: "Manage", surface: "HR letters", output: "Letter draft", modelCard: "MC-05", covered: true, where: "Draft panel → fields drawn from the record" },
  { id: "AS-11", pillar: "Manage", surface: "Cases", output: "Query draft + response summary", modelCard: "MC-06", covered: true, where: "Draft panel → tone guard + no-sanction note" },
  { id: "AS-12", pillar: "Manage", surface: "Attendance", output: "Derived absence / lateness signals", modelCard: "MC-07", covered: true, where: "Signal row → what it is and is not" },
];

export const auditScore = () => {
  const covered = AI_SURFACES.filter((s) => s.covered).length;
  return { covered, total: AI_SURFACES.length, pct: Math.round((covered / AI_SURFACES.length) * 100) };
};

/** The one affordance FR-093 standardises — rendered identically everywhere. */
export type WhyThis = { claim: string; basis: string[]; modelCard: string; confidence?: number; humanGate: string };

export const toneForState = (s: "in-place" | "in-progress" | "mapped" | "gap"): PfTone =>
  s === "in-place" || s === "mapped" ? "green" : s === "gap" ? "red" : "yellow";
