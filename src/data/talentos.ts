/**
 * Talent OS v2.0 — shared dataset for Pillars 2 (Manage) & 3 (Grow) and the
 * Recruit v2 upgrades. Single person-record spine per the PRD (FR-075):
 * candidate ↔ employee ↔ alumni is one record. Numbers follow the PRD's own
 * worked examples (§5.1, §6.1) so every surface tells one consistent story.
 */

/* ---------------------------------- Manage ---------------------------------- */

export const COMMAND_KPIS = [
  { label: "Total employees", value: "358", delta: "+12", deltaColor: "#16B364", sub: "8 joined this month" },
  { label: "Open positions", value: "12", delta: "4 critical", deltaColor: "#E81E17", sub: "3 in final stages" },
  { label: "Turnover (monthly)", value: "2.1%", delta: "+0.4pp", deltaColor: "#E81E17", sub: "benchmark 1.6%" },
  { label: "Workforce cost", value: "₦412M", delta: "+5% over", deltaColor: "#EBA308", sub: "vs Q3 budget ₦392M" },
] as const;

export type Anomaly = {
  id: string; severity: "critical" | "warning" | "info"; icon: string;
  title: string; body: string; metric: string; drill: string; // stage id to drill into
  detected: string; status: "new" | "acknowledged" | "assigned";
  assignee?: string;
};

export const ANOMALIES: Anomaly[] = [
  { id: "AN-104", severity: "critical", icon: "▲", title: "Turnover spike — Port Harcourt site", body: "Voluntary exits at 3.8% vs 1.6% benchmark, traced to Field Operations. 5 of 6 exits cite pay vs market in structured exit interviews.", metric: "3.8% vs 1.6%", drill: "attrition", detected: "2h ago", status: "new" },
  { id: "AN-103", severity: "warning", icon: "◆", title: "Engagement drop — Engineering", body: "Pulse score fell 0.7pt in 30 days. Correlates with the payments-platform crunch; 4 engineers show absence-pattern change.", metric: "−0.7pt / 30d", drill: "depthealth", detected: "6h ago", status: "new" },
  { id: "AN-102", severity: "warning", icon: "₦", title: "Cost overrun — contractor spend", body: "Agency/manpower spend is 12% over plan for two consecutive months, concentrated in Drilling Support (Lagos).", metric: "+12% × 2mo", drill: "workforceplan", detected: "1d ago", status: "acknowledged", assignee: "Funke Adebayo" },
  { id: "AN-101", severity: "info", icon: "◔", title: "Absence anomaly — HSE team", body: "Sick-day cluster (4 of 9 staff) around rotation changeover. Pattern seen before August 2025 changeover.", metric: "4/9 staff", drill: "depthealth", detected: "2d ago", status: "assigned", assignee: "Emeka Obi" },
];

export type Department = {
  name: string; head: string; headcount: number; target: number;
  cost: string; health: number; healthTone: string;
  turnover: string; engagement: number; performance: number; absence: string;
  loc: string;
};

export const DEPARTMENTS: Department[] = [
  { name: "Engineering", head: "Ngozi Adeyemi", headcount: 84, target: 92, cost: "₦128M", health: 71, healthTone: "#EBA308", turnover: "1.8%", engagement: 68, performance: 82, absence: "2.1%", loc: "Lagos" },
  { name: "Field Operations", head: "Ibrahim Sani", headcount: 96, target: 90, cost: "₦96M", health: 58, healthTone: "#E81E17", turnover: "3.8%", engagement: 54, performance: 74, absence: "4.6%", loc: "Port Harcourt" },
  { name: "Product & Design", head: "Tobi Balogun", headcount: 38, target: 41, cost: "₦52M", health: 84, healthTone: "#16B364", turnover: "1.1%", engagement: 81, performance: 88, absence: "1.4%", loc: "Lagos" },
  { name: "Commercial", head: "Aisha Bello", headcount: 44, target: 44, cost: "₦48M", health: 79, healthTone: "#16B364", turnover: "1.4%", engagement: 76, performance: 80, absence: "1.9%", loc: "Lagos · Abuja" },
  { name: "HSE & Compliance", head: "Chinedu Eze", headcount: 27, target: 30, cost: "₦31M", health: 74, healthTone: "#EBA308", turnover: "1.2%", engagement: 72, performance: 85, absence: "3.2%", loc: "Port Harcourt" },
  { name: "Finance", head: "Kemi Salami", headcount: 22, target: 22, cost: "₦29M", health: 88, healthTone: "#16B364", turnover: "0.8%", engagement: 84, performance: 86, absence: "1.1%", loc: "Lagos" },
  { name: "People / HR", head: "Funke Adebayo", headcount: 18, target: 19, cost: "₦18M", health: 82, healthTone: "#16B364", turnover: "1.0%", engagement: 80, performance: 83, absence: "1.5%", loc: "Lagos" },
  { name: "Drilling Support", head: "Yusuf Lawal", headcount: 29, target: 24, cost: "₦46M", health: 63, healthTone: "#EBA308", turnover: "2.6%", engagement: 61, performance: 71, absence: "3.9%", loc: "Port Harcourt" },
];

/** One record spine — employees carry hiring artifacts + risk + growth. */
export type Employee = {
  id: string; name: string; init: string; tone: string;
  role: string; dept: string; loc: string; grade: string;
  tenure: string; monthsSincePromo: number;
  status: "active" | "onboarding" | "notice" | "alumni";
  contract: "Permanent" | "Fixed-term" | "Contractor" | "NYSC/Intern";
  contractEnd?: string;
  perf: number; engagement: number; qoh?: number;
  risk?: { tier: "high" | "medium" | "low"; horizon: "30d" | "60d" | "90d"; score: number; reasons: string[] };
  skills: string[]; certs?: { name: string; expires: string; state: "valid" | "expiring" | "expired" }[];
  hiredVia?: string;
};

export const EMPLOYEES: Employee[] = [
  { id: "E-0214", name: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer", dept: "Engineering", loc: "Lagos", grade: "L5", tenure: "2y 8m", monthsSincePromo: 14, status: "active", contract: "Permanent", perf: 91, engagement: 62, qoh: 4.6, risk: { tier: "high", horizon: "30d", score: 78, reasons: ["14 months since promotion", "Pay 12% below market band", "Engagement −0.9pt in 60 days"] }, skills: ["Distributed systems", "Go", "Payments", "Mentoring"], hiredVia: "Pillar 1 · Nov 2023" },
  { id: "E-0198", name: "Adaeze Okafor", init: "AD", tone: "#16B364", role: "Senior Product Designer", dept: "Product & Design", loc: "Lagos", grade: "L5", tenure: "0y 3m", monthsSincePromo: 3, status: "active", contract: "Permanent", perf: 88, engagement: 84, qoh: 4.3, skills: ["Design systems", "Product strategy", "Prototyping", "Research"], hiredVia: "Pillar 1 · Apr 2026" },
  { id: "E-0231", name: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead", dept: "Field Operations", loc: "Port Harcourt", grade: "M2", tenure: "4y 1m", monthsSincePromo: 22, status: "active", contract: "Permanent", perf: 76, engagement: 51, risk: { tier: "high", horizon: "60d", score: 71, reasons: ["Site turnover contagion (3 exits in team)", "22 months since promotion", "Absence pattern change"] }, skills: ["Rig operations", "HSE leadership", "Crew scheduling"], certs: [{ name: "NEBOSH IGC", expires: "Sep 2026", state: "expiring" }, { name: "OPITO BOSIET", expires: "Mar 2027", state: "valid" }] },
  { id: "E-0165", name: "Zainab Yusuf", init: "ZY", tone: "#EBA308", role: "Growth Marketing Manager", dept: "Commercial", loc: "Abuja", grade: "M1", tenure: "1y 9m", monthsSincePromo: 9, status: "active", contract: "Permanent", perf: 83, engagement: 77, qoh: 4.1, skills: ["Lifecycle marketing", "Analytics", "Brand"], },
  { id: "E-0243", name: "Chidi Okeke", init: "CO", tone: "#E81E17", role: "Backend Engineer", dept: "Engineering", loc: "Lagos", grade: "L4", tenure: "0y 1m", monthsSincePromo: 1, status: "onboarding", contract: "Permanent", perf: 0, engagement: 0, skills: ["Go", "PostgreSQL", "Kafka"], hiredVia: "Pillar 1 · Jun 2026" },
  { id: "E-0129", name: "Halima Sule", init: "HS", tone: "#AF52DE", role: "HSE Coordinator", dept: "HSE & Compliance", loc: "Port Harcourt", grade: "L3", tenure: "3y 2m", monthsSincePromo: 18, status: "active", contract: "Permanent", perf: 85, engagement: 73, certs: [{ name: "NEBOSH Diploma", expires: "Jan 2027", state: "valid" }, { name: "First Aid at Work", expires: "Jul 2026", state: "expired" }], skills: ["Incident investigation", "Audit", "Training delivery"] },
  { id: "E-0250", name: "Seyi Ajayi", init: "SA", tone: "#16B364", role: "Contract Rig Technician", dept: "Drilling Support", loc: "Port Harcourt", grade: "C2", tenure: "0y 7m", monthsSincePromo: 7, status: "active", contract: "Contractor", contractEnd: "Aug 30, 2026", perf: 79, engagement: 70, skills: ["Rig maintenance", "Hydraulics"], certs: [{ name: "OPITO BOSIET", expires: "Aug 2026", state: "expiring" }] },
  { id: "E-0187", name: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Finance Analyst", dept: "Finance", loc: "Lagos", grade: "L4", tenure: "2y 0m", monthsSincePromo: 11, status: "active", contract: "Permanent", perf: 87, engagement: 82, qoh: 4.4, skills: ["FP&A", "Power BI", "IFRS"] },
  { id: "E-0092", name: "Tunde Bakare", init: "TB", tone: "#EBA308", role: "Product Manager", dept: "Product & Design", loc: "Lagos", grade: "M1", tenure: "3y 6m", monthsSincePromo: 16, status: "notice", contract: "Permanent", perf: 82, engagement: 44, risk: { tier: "high", horizon: "30d", score: 91, reasons: ["Resignation submitted — offboarding open", "Engagement collapsed post-reorg"] }, skills: ["Product discovery", "B2B SaaS", "Roadmapping"] },
  { id: "E-0011", name: "Bola Adeyemi", init: "BA", tone: "#475569", role: "Ops Supervisor (Alumni)", dept: "Field Operations", loc: "Port Harcourt", grade: "M1", tenure: "5y 3m", monthsSincePromo: 0, status: "alumni", contract: "Permanent", perf: 84, engagement: 0, skills: ["Crew leadership", "Logistics"], hiredVia: "Boomerang pool" },
];

export const ATTRITION_TREND = [
  { m: "Jan", val: 1.4, bench: 1.6 }, { m: "Feb", val: 1.5, bench: 1.6 }, { m: "Mar", val: 1.3, bench: 1.6 },
  { m: "Apr", val: 1.7, bench: 1.6 }, { m: "May", val: 1.9, bench: 1.6 }, { m: "Jun", val: 2.1, bench: 1.6 },
] as const;

export const EXIT_REASONS = [
  { reason: "Pay vs market", pct: 38, tone: "#E81E17" },
  { reason: "Career growth stalled", pct: 24, tone: "#EBA308" },
  { reason: "Relocation / japa", pct: 16, tone: "#16B364" },
  { reason: "Manager relationship", pct: 12, tone: "#AF52DE" },
  { reason: "Rotation / site conditions", pct: 10, tone: "#475569" },
] as const;

export type ContractRow = {
  id: string; name: string; type: string; dept: string;
  start: string; end: string; daysLeft: number; state: "active" | "expiring-90" | "expiring-60" | "expiring-30" | "expired";
};

export const CONTRACTS: ContractRow[] = [
  { id: "CT-882", name: "Seyi Ajayi", type: "Contractor (agency: PrimeStaff)", dept: "Drilling Support", start: "Jan 30, 2026", end: "Aug 30, 2026", daysLeft: 28, state: "expiring-30" },
  { id: "CT-871", name: "Kelechi Umeh", type: "Fixed-term (12m)", dept: "Engineering", start: "Oct 1, 2025", end: "Sep 30, 2026", daysLeft: 59, state: "expiring-60" },
  { id: "CT-869", name: "Maryam Garba", type: "NYSC / Intern", dept: "Finance", start: "Nov 3, 2025", end: "Oct 31, 2026", daysLeft: 90, state: "expiring-90" },
  { id: "CT-854", name: "Osaze Igbinedion", type: "Contractor (agency: RigWorks)", dept: "Field Operations", start: "Mar 14, 2026", end: "Mar 13, 2027", daysLeft: 223, state: "active" },
  { id: "CT-901", name: "Chidi Okeke", type: "Permanent", dept: "Engineering", start: "Jun 1, 2026", end: "—", daysLeft: 9999, state: "active" },
];

/**
 * The six systems a joiner is granted and a leaver is revoked from — the FR-063
 * mirror, held once so the two directions cannot drift apart. Grant and revoke
 * are separate fields because they are genuinely different rails: payroll is
 * granted through SeamlessHR but taken off by hand with Finance.
 */
export type SystemRow = { sys: string; grantVia: string; revokeVia: string };

export const SYSTEMS = [
  { sys: "Google Workspace", grantVia: "SSO · SCIM", revokeVia: "SSO · SCIM" },
  { sys: "Slack", grantVia: "SSO · SCIM", revokeVia: "SSO · SCIM" },
  { sys: "Figma", grantVia: "SSO", revokeVia: "SSO" },
  { sys: "GitHub", grantVia: "SCIM", revokeVia: "SCIM" },
  { sys: "Payroll (HRIS)", grantVia: "SeamlessHR · Finance", revokeVia: "manual · Finance" },
  { sys: "Site access badge", grantVia: "manual · Facilities", revokeVia: "manual · Facilities" },
] as const satisfies readonly SystemRow[];

/**
 * The only legal way to name a system. Grant timestamps and revoke flags are
 * held elsewhere but keyed by this, so renaming a row above breaks compilation
 * at every site that names it instead of silently dropping that row's state.
 */
export type SystemName = (typeof SYSTEMS)[number]["sys"];

/* ----------------------------------- Grow ----------------------------------- */

export type AttentionItem = { icon: string; tone: string; title: string; sub: string; cta: string; go?: string };

export const MANAGER_ATTENTION: AttentionItem[] = [
  { icon: "⚑", tone: "#E81E17", title: "Overdue action from 1-on-1", sub: "\"Share design-system migration plan\" — due 3 days ago (Amara)", cta: "Open 1-on-1" },
  { icon: "◔", tone: "#EBA308", title: "Review closing Friday", sub: "Q2 cycle — 2 of 6 team reviews incomplete", cta: "Open reviews" },
  { icon: "◆", tone: "#16B364", title: "Goal falling behind", sub: "\"Design handoff time −30%\" at 44% with 3 weeks left", cta: "Open goal" },
];

export type OKR = {
  id: string; level: "Company" | "Department" | "Individual"; owner: string;
  objective: string; progress: number; status: "on-track" | "behind" | "at-risk" | "draft";
  quarter: string;
  krs: { kr: string; progress: number; status: "on-track" | "behind" | "at-risk" }[];
};

export const OKRS: OKR[] = [
  { id: "O-01", level: "Company", owner: "Unrealabs", objective: "Become the default talent platform for Nigerian energy employers", progress: 62, status: "on-track", quarter: "Q3 2026", krs: [
    { kr: "10 design partners signed (7 done)", progress: 70, status: "on-track" },
    { kr: "NRR ≥ 120% on live accounts", progress: 55, status: "behind" },
    { kr: "Time-to-hire ≤ 21 days across partners", progress: 61, status: "on-track" },
  ]},
  { id: "O-02", level: "Department", owner: "Product & Design", objective: "Ship a design system every squad builds on", progress: 65, status: "on-track", quarter: "Q3 2026", krs: [
    { kr: "Design-system coverage 94% of new screens", progress: 94, status: "on-track" },
    { kr: "Design handoff time −30%", progress: 44, status: "at-risk" },
    { kr: "a11y audit pass on 100% of flows", progress: 58, status: "behind" },
  ]},
  { id: "O-03", level: "Individual", owner: "Adaeze Okafor", objective: "Own the review-cycle experience end to end", progress: 71, status: "on-track", quarter: "Q3 2026", krs: [
    { kr: "Review-packet UI shipped to 2 partners", progress: 80, status: "on-track" },
    { kr: "Manager NPS on cycle ≥ 40", progress: 62, status: "on-track" },
  ]},
];

export type OneOnOne = {
  with: string; init: string; tone: string; role: string; time: string; state: "today" | "upcoming" | "done";
  agenda: string[]; actions: { item: string; owner: string; due: string; done: boolean }[];
  aiSummary?: string;
};

export const ONE_ON_ONES: OneOnOne[] = [
  { with: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer", time: "Today · 10:00", state: "today", agenda: ["Follow-up: migration plan (overdue)", "Growth: Staff-track expectations", "Payments crunch load check"], actions: [ { item: "Share design-system migration plan", owner: "Amara", due: "Jul 5", done: false }, { item: "Draft Staff-engineer growth plan", owner: "You", due: "Jul 12", done: false } ], aiSummary: "Last week: energy dipped discussing promotion timeline; strong ownership signals on payments incident. Suggested probe: what would make the next 6 months compelling?" },
  { with: "Chidi Okeke", init: "CO", tone: "#E81E17", role: "Backend Engineer (onboarding)", time: "Tomorrow · 14:30", state: "upcoming", agenda: ["30-day check-in", "First goals draft", "Buddy pairing feedback"], actions: [ { item: "Grant staging DB access", owner: "You", due: "Jul 4", done: true } ] },
  { with: "Tunde Bakare", init: "TB", tone: "#EBA308", role: "Product Manager (notice)", time: "Fri · 11:00", state: "upcoming", agenda: ["Handover map", "Knowledge-transfer sessions", "Alumni-network invite"], actions: [] },
];

export type ReviewRow = {
  name: string; init: string; tone: string; role: string;
  self: "done" | "pending"; manager: "done" | "pending" | "in-progress"; peer?: "done" | "pending";
  goalAttainment: number; recommendation?: "Promote" | "Retain" | "Develop";
};

export const REVIEW_CYCLE = {
  name: "Q2 2026 · Mid-year cycle", closes: "Fri, Jul 10", completion: 67,
  rows: [
    { name: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer", self: "done", manager: "in-progress", peer: "done", goalAttainment: 65, recommendation: "Promote" },
    { name: "Adaeze Okafor", init: "AD", tone: "#16B364", role: "Senior Product Designer", self: "done", manager: "done", peer: "done", goalAttainment: 78, recommendation: "Retain" },
    { name: "Zainab Yusuf", init: "ZY", tone: "#EBA308", role: "Growth Marketing Manager", self: "done", manager: "pending", goalAttainment: 71 },
    { name: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Finance Analyst", self: "pending", manager: "pending", goalAttainment: 74 },
    { name: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead", self: "done", manager: "pending", goalAttainment: 58, recommendation: "Develop" },
    { name: "Halima Sule", init: "HS", tone: "#AF52DE", role: "HSE Coordinator", self: "done", manager: "done", goalAttainment: 82, recommendation: "Retain" },
  ] as ReviewRow[],
};

export type Playbook = {
  id: string; for: string; init: string; tone: string; role: string; trigger: string;
  steps: { step: string; state: "done" | "active" | "todo"; note?: string }[];
  saveOdds: number;
};

export const PLAYBOOKS: Playbook[] = [
  { id: "PB-31", for: "Amara Okonkwo", init: "AO", tone: "#AF52DE", role: "Senior Software Engineer", trigger: "High leave-risk (30d) · 14 months since promotion", saveOdds: 72, steps: [
    { step: "Pay check vs benchmark", state: "done", note: "12% below L5 band median — adjustment case drafted" },
    { step: "Growth conversation (template ready)", state: "active", note: "Scheduled into today's 1-on-1" },
    { step: "Internal mobility scan", state: "done", note: "Staff Engineer (Platform) — 87% match" },
    { step: "Workload review", state: "todo" },
  ]},
  { id: "PB-29", for: "Emeka Nwosu", init: "EN", tone: "#16B364", role: "Field Operations Lead", trigger: "High leave-risk (60d) · site turnover contagion", saveOdds: 58, steps: [
    { step: "Pay check vs benchmark", state: "done", note: "Within band" },
    { step: "Rotation-pattern review", state: "active", note: "2-on/1-off proposal with site director" },
    { step: "Growth conversation", state: "todo" },
    { step: "Retention bonus assessment", state: "todo" },
  ]},
];

export type MobilityMatch = {
  role: string; dept: string; loc: string; posted: string;
  candidate: string; init: string; tone: string; match: number;
  dims: [string, number][]; risk?: string;
};

export const MOBILITY: MobilityMatch[] = [
  { role: "Staff Engineer (Platform)", dept: "Engineering", loc: "Lagos", posted: "3d ago", candidate: "Amara Okonkwo", init: "AO", tone: "#AF52DE", match: 87, dims: [["Distributed systems", 95], ["Payments domain", 92], ["Technical leadership", 81], ["Mentoring", 88]], risk: "High leave-risk — proactive match" },
  { role: "Product Ops Lead", dept: "Product & Design", loc: "Lagos", posted: "1w ago", candidate: "Zainab Yusuf", init: "ZY", tone: "#EBA308", match: 74, dims: [["Cross-functional ops", 82], ["Analytics", 79], ["Stakeholder mgmt", 71]] },
  { role: "HSE Manager", dept: "HSE & Compliance", loc: "Port Harcourt", posted: "2d ago", candidate: "Halima Sule", init: "HS", tone: "#AF52DE", match: 81, dims: [["Incident investigation", 90], ["Audit leadership", 84], ["Training delivery", 78]] },
];

/* -------------------------------- Recruit v2 -------------------------------- */

export type Pool = { name: string; count: number; fresh: string; icon: string; tone: string; note: string };

export const POOLS: Pool[] = [
  { name: "Product Design — role family", count: 64, fresh: "72% active < 90d", icon: "◈", tone: "#AF52DE", note: "Auto-fed from Stages 3–4" },
  { name: "Silver medalists", count: 38, fresh: "88% active < 90d", icon: "◉", tone: "#16B364", note: "Auto-pooled from Stage 7 runners-up" },
  { name: "Campus — UNILAG & Covenant '26", count: 112, fresh: "Event: May 2026", icon: "◍", tone: "#16B364", note: "2 career-fair imports" },
  { name: "Boomerang alumni", count: 21, fresh: "3 open to return", icon: "↻", tone: "#EBA308", note: "Fed by offboarding (FR-063)" },
  { name: "Backend / Payments engineers", count: 87, fresh: "61% active < 90d", icon: "⚙", tone: "#16B364", note: "ATS import · deduped 14" },
];

export type Sequence = {
  name: string; role: string; steps: { ch: "Email" | "WhatsApp" | "SMS" | "LinkedIn"; day: number; state: "sent" | "scheduled" | "draft" }[];
  stats: { sent: number; delivered: number; opened: number; replied: number; interested: number; bounced: number };
  state: "running" | "paused" | "draft";
};

export const SEQUENCES: Sequence[] = [
  { name: "Sr. Product Designer — warm pool", role: "SPD-2026", state: "running", steps: [ { ch: "Email", day: 0, state: "sent" }, { ch: "WhatsApp", day: 2, state: "sent" }, { ch: "SMS", day: 5, state: "scheduled" }, { ch: "Email", day: 9, state: "scheduled" } ], stats: { sent: 42, delivered: 41, opened: 33, replied: 17, interested: 9, bounced: 1 } },
  { name: "Backend (Payments) — silver medalists", role: "BE-2031", state: "running", steps: [ { ch: "WhatsApp", day: 0, state: "sent" }, { ch: "Email", day: 3, state: "sent" }, { ch: "LinkedIn", day: 7, state: "draft" } ], stats: { sent: 28, delivered: 28, opened: 24, replied: 11, interested: 6, bounced: 0 } },
  { name: "Campus '26 — grad programme", role: "GRAD-01", state: "paused", steps: [ { ch: "Email", day: 0, state: "sent" }, { ch: "SMS", day: 4, state: "scheduled" } ], stats: { sent: 112, delivered: 104, opened: 61, replied: 19, interested: 14, bounced: 8 } },
];

export type FleetAgent = {
  name: string; template: string; state: "running" | "paused";
  approval: "Require human approval" | "Auto (logged)";
  runs: number; hits: number; saved: string; last: string; linked: string;
};

export const FLEET: FleetAgent[] = [
  { name: "Design warm-pool scout", template: "Auto-sourcer", state: "running", approval: "Require human approval", runs: 128, hits: 23, saved: "≈ 14h", last: "22m ago", linked: "SPD-2026" },
  { name: "Silver-medal re-engager", template: "Re-engagement", state: "running", approval: "Require human approval", runs: 64, hits: 11, saved: "≈ 6h", last: "1h ago", linked: "BE-2031" },
  { name: "Reference chaser", template: "Reference-chaser", state: "running", approval: "Auto (logged)", runs: 41, hits: 38, saved: "≈ 9h", last: "3h ago", linked: "All stage-8 roles" },
  { name: "Interview-prep sender", template: "Interview-prep", state: "paused", approval: "Auto (logged)", runs: 87, hits: 87, saved: "≈ 11h", last: "2d ago", linked: "All stage-6 roles" },
];

/* ------------------------------ Futuristic layer ------------------------------ */

export const SKILL_CLUSTERS = [
  { name: "Product & Design", tone: "#AF52DE", skills: [ { s: "Design systems", n: 14, demand: 92 }, { s: "Product strategy", n: 9, demand: 84 }, { s: "UX research", n: 11, demand: 71 }, { s: "Prototyping", n: 16, demand: 66 } ] },
  { name: "Engineering", tone: "#16B364", skills: [ { s: "Distributed systems", n: 12, demand: 95 }, { s: "Go", n: 18, demand: 88 }, { s: "Payments", n: 8, demand: 97 }, { s: "Kafka", n: 10, demand: 74 }, { s: "PostgreSQL", n: 22, demand: 69 } ] },
  { name: "Operations & HSE", tone: "#16B364", skills: [ { s: "Rig operations", n: 31, demand: 82 }, { s: "Incident investigation", n: 12, demand: 78 }, { s: "Crew scheduling", n: 9, demand: 64 }, { s: "HSE auditing", n: 8, demand: 86 } ] },
  { name: "Commercial & Finance", tone: "#EBA308", skills: [ { s: "FP&A", n: 7, demand: 72 }, { s: "Lifecycle marketing", n: 6, demand: 61 }, { s: "IFRS", n: 5, demand: 58 }, { s: "Partnerships", n: 8, demand: 67 } ] },
] as const;

export type Scenario = {
  id: string; name: string; desc: string;
  effects: { metric: string; before: string; after: string; tone: string }[];
  aiNote: string;
};

export const SCENARIOS: Scenario[] = [
  { id: "SC-1", name: "Lose 3 senior engineers", desc: "Amara-tier departures from Payments squad within 60 days", effects: [ { metric: "Payments delivery", before: "On track", after: "+9 weeks", tone: "#E81E17" }, { metric: "Backfill cost", before: "—", after: "₦38M + 63 days", tone: "#EBA308" }, { metric: "Team engagement", before: "68", after: "−7pt contagion", tone: "#E81E17" }, { metric: "Mitigation", before: "—", after: "2 internal matches cover 70%", tone: "#16B364" } ], aiNote: "Retention playbooks on the 2 flagged engineers are 4× cheaper than the backfill path. Recommend approving the L5 band adjustment first." },
  { id: "SC-2", name: "Freeze hiring for Q4", desc: "Pause all 12 open positions through December", effects: [ { metric: "Savings", before: "—", after: "₦54M", tone: "#16B364" }, { metric: "Field Ops coverage", before: "96/90", after: "Critical by Nov (rotation gaps)", tone: "#E81E17" }, { metric: "Time-to-hire debt", before: "19d", after: "≈ 31d on unfreeze", tone: "#EBA308" }, { metric: "Revenue capacity", before: "100%", after: "−8% Q1 2027", tone: "#EBA308" } ], aiNote: "A selective freeze (exempting the 4 critical roles) keeps 82% of the savings with a fraction of the risk." },
  { id: "SC-3", name: "Open Port Harcourt design pod", desc: "5-person product pod co-located with Field Ops", effects: [ { metric: "Ramp cost", before: "—", after: "₦21M / 2 quarters", tone: "#EBA308" }, { metric: "Field tool adoption", before: "54%", after: "≈ 80% (co-location lift)", tone: "#16B364" }, { metric: "Internal mobility", before: "—", after: "2 transfer matches found", tone: "#16B364" }, { metric: "Attrition risk (PH)", before: "3.8%", after: "−0.9pp (growth paths)", tone: "#16B364" } ], aiNote: "Strongest long-term lever: pairs the mobility loop with the site most at risk. Campus pool covers 2 of 5 seats." },
];

export const NCDMB = {
  ratio: { ng: 91, exp: 9 }, target: 90,
  byFamily: [ { fam: "Drilling & subsurface", ng: 84, exp: 16 }, { fam: "Engineering", ng: 96, exp: 4 }, { fam: "Field operations", ng: 93, exp: 7 }, { fam: "Management", ng: 78, exp: 22 } ],
  filings: [ { name: "NCDMB quarterly composition report", due: "Jul 15, 2026", state: "ready" }, { name: "Expatriate quota renewal (2 roles)", due: "Aug 2, 2026", state: "in-progress" } ],
};
