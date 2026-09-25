/**
 * Connector catalogue — the one place a vendor is described.
 *
 * Lifted VERBATIM out of Integrations.tsx's module-scope `intCategories`
 * (same five categories, same 19 vendors, same init / tone / name / sub) and
 * given two things it never had:
 *
 *   · `id`      — a stable ConnectorId, so connection state can live in the
 *                 workspace store instead of a hardcoded `connected: boolean`.
 *                 That single change is what makes every in-flow connect
 *                 moment possible: a connection made in Schedule, Screening,
 *                 Sequences or Settings is visible everywhere else.
 *   · `unlocks` — what wiring it actually buys you, in one sentence. Spec
 *                 item 5: never a settings chore, always framed by the moment
 *                 it serves.
 *
 * The four in-flow tools (Google Calendar, Outlook, Slack, WhatsApp Business)
 * and Youverify do NOT author their sentence here — they read it from
 * TOOL_MOMENTS in recruiterOnboarding.ts, so the catalogue card and the
 * in-flow prompt quote the SAME string. One sentence, one place.
 *
 * The `connected` literal is deliberately gone. `useWorkspace().isConnected(id)`
 * is the only source of truth.
 */

import { unlocksFor, type ConnectorId } from "./recruiterOnboarding";

export type ConnectorRow = {
  id: ConnectorId;
  /** Category title this row sits under — carried so a flat lookup keeps its context. */
  category: string;
  init: string;
  tone: string;
  name: string;
  /** The original one-word classification. Kept for search/grouping, no longer the card's subtitle. */
  sub: string;
  /** What wiring it unlocks. The card's subtitle, and the in-flow prompt's sentence. */
  unlocks: string;
};

export type ConnectorCategory = { title: string; items: ConnectorRow[] };

/** Authored here only for vendors with no TOOL_MOMENT of their own. */
const LOCAL_UNLOCKS: Partial<Record<ConnectorId, string>> = {
  greenhouse: "Your Greenhouse backlog lands as applications on a role — nothing re-typed",
  lever: "Same for Lever — pipelines, stages and consent states come across intact",
  workday: "Employee records stay in Workday; new hires flow back the day they sign",
  bamboohr: "New hires sync to BambooHR the day they sign — no re-keying",
  "sap-sf": "Requisitions and headcount reconcile against SuccessFactors nightly",
  linkedin: "Post a role once and it appears on LinkedIn with the JD you approved",
  indeed: "Indeed applications arrive already scored against your rubric",
  jobberman: "The board most Nigerian applicants actually check — post and receive in one hop",
  myjobmag: "A second Nigerian board for the roles Jobberman under-serves",
  "smile-id": "NIN + liveness on the candidate side at offer — never on the employer",
  verifyme: "Employment history checked before the offer letter goes out",
  okta: "Seats provision and de-provision with your directory — a leaver loses access the same hour",
  entra: "SAML single sign-on for the half of SEEPCO on Microsoft 365",
  "google-workspace": "Sign in with the same work account we verified your domain against",
};

/** TOOL_MOMENTS wins; LOCAL_UNLOCKS fills the rest. Never two copies of one sentence. */
const unlocks = (id: ConnectorId): string => unlocksFor(id) || LOCAL_UNLOCKS[id] || "";

const row = (category: string, id: ConnectorId, init: string, tone: string, name: string, sub: string): ConnectorRow => ({
  id,
  category,
  init,
  tone,
  name,
  sub,
  unlocks: unlocks(id),
});

const ATS = "ATS & HRIS";
const BOARDS = "Job boards & sourcing";
const IDENTITY = "Background & identity";
const COMMS = "Calendar & comms";
const SSO = "Identity & SSO";

export const CONNECTOR_CATEGORIES: ConnectorCategory[] = [
  {
    title: ATS,
    items: [
      row(ATS, "greenhouse", "G", "#129152", "Greenhouse", "Applicant tracking"),
      row(ATS, "lever", "L", "#AF52DE", "Lever", "Applicant tracking"),
      row(ATS, "workday", "W", "#16B364", "Workday", "HRIS"),
      row(ATS, "bamboohr", "B", "#16B364", "BambooHR", "HRIS"),
      row(ATS, "sap-sf", "S", "#475569", "SAP SuccessFactors", "HRIS"),
    ],
  },
  {
    title: BOARDS,
    items: [
      row(BOARDS, "linkedin", "in", "#16B364", "LinkedIn", "Recruiter + job posts"),
      row(BOARDS, "indeed", "I", "#16B364", "Indeed", "Job board"),
      row(BOARDS, "jobberman", "J", "#16B364", "Jobberman NG", "Local job board"),
      row(BOARDS, "myjobmag", "M", "#EBA308", "MyJobMag", "Local job board"),
    ],
  },
  {
    title: IDENTITY,
    items: [
      row(IDENTITY, "smile-id", "S", "#AF52DE", "Smile ID", "NIN + liveness"),
      row(IDENTITY, "youverify", "Y", "#16B364", "Youverify", "Credential checks"),
      row(IDENTITY, "verifyme", "V", "#16B364", "VerifyMe", "Employment history"),
    ],
  },
  {
    title: COMMS,
    items: [
      row(COMMS, "google-calendar", "G", "#C21A14", "Google Calendar", "Interview scheduling"),
      row(COMMS, "outlook", "O", "#16B364", "Outlook", "Interview scheduling"),
      row(COMMS, "slack", "#", "#9741CE", "Slack", "Hiring alerts"),
      row(COMMS, "whatsapp", "W", "#16B364", "WhatsApp Business", "Candidate outreach"),
    ],
  },
  {
    title: SSO,
    items: [
      row(SSO, "okta", "O", "#16B364", "Okta", "SSO / SCIM"),
      row(SSO, "entra", "E", "#16B364", "Microsoft Entra ID", "SSO / SAML"),
      row(SSO, "google-workspace", "G", "#475569", "Google Workspace", "SSO"),
    ],
  },
];

/** Flat list — 19 vendors. `seamlesshr` is a valid ConnectorId with no catalogue row; it is offered inside the backlog-import flow, not here. */
export const CONNECTORS: ConnectorRow[] = CONNECTOR_CATEGORIES.flatMap((c) => c.items);

export const CONNECTOR_COUNT = CONNECTORS.length;

export const connectorById = (id: ConnectorId): ConnectorRow | undefined =>
  CONNECTORS.find((c) => c.id === id);

/** Vendor display name without needing the whole row. Falls back to the id. */
export const connectorName = (id: ConnectorId): string => connectorById(id)?.name ?? id;

/** The two calendar providers — either one satisfies the scheduling moment. */
export const CALENDAR_IDS: ConnectorId[] = ["google-calendar", "outlook"];
