/**
 * Requisitions module — modeled 1:1 on the live staging app
 * (seepco-hr-frontend-staging: /organization/requisitions). Statuses, ages,
 * roles and the generated Chemical Engineer artifact mirror the real backend
 * records observed there (test junk rows dropped).
 */

import { SKILL_CLUSTERS } from "./talentos";

export type ReqRecordStatus = "draft" | "pending" | "published" | "rejected";

/**
 * A weighted scoring dimension, drawn from the SEEPCO skills taxonomy
 * (SKILL_CLUSTERS in data/talentos.ts). This is what makes SkillsGraph's
 * FR-076 claim — "powers JD rubrics" — literally true: the rubric that scores
 * every applicant in Stage-04 is assembled from the same 17 skills.
 * Weights always total 100.
 */
export type RubricDim = { dim: string; weight: number; cluster: string };

/** Naira-first comp benchmark — the band is derived from it, not guessed. */
export type SalaryBenchmark = {
  p25: number;
  p50: number;
  p75: number;
  currency: "NGN";
  sample: number;
  sources: string[];
  confidence: number;
};

/** Authored knockout criteria — what Screening's cited rejections trace back to. */
export type Knockout = { q: string; type: "yesno" | "number" | "choice"; autoReject: boolean };

/** The candidate's recorded answer prompts (the portal's "2-minute video"). */
export type VideoPrompt = { prompt: string; seconds: number };

export type Requisition = {
  id: string;
  role: string;
  dept: string;
  loc: string;
  status: ReqRecordStatus;
  statusLabel: string; // table STATUS column, as the real app shows it
  age: string;
  candidates: string;
  seniority: string;
  salaryBand: string;
  /** Derived count of `rubric` — kept so existing copy ("7 weighted dimensions") holds. */
  rubricDims: number;
  /** AI-generated JD (the real app generates this via "✦ Generate with AI"). */
  jd?: string;
  mustHave?: string[];
  /**
   * The four artefacts the recruiter edits and approves. Optional on the type
   * because a workspace persisted before this shipped won't carry them — the
   * `…Of(r)` accessors below regenerate them deterministically instead of
   * rendering an empty card.
   */
  rubric?: RubricDim[];
  salaryBenchmark?: SalaryBenchmark;
  knockouts?: Knockout[];
  videoPrompts?: VideoPrompt[];
  /** Set once a human edits any generated artefact — "AI proposes, humans decide", recorded. */
  editedByHuman?: boolean;
  signoffs: { who: string; init: string; label: string; state: "Signed" | "Awaiting" | "—" }[];
};

const BASE_REQUISITIONS: Omit<Requisition, "rubric" | "salaryBenchmark" | "knockouts" | "videoPrompts">[] = [
  {
    id: "REQ-2214", role: "Chemical Engineer", dept: "Engineering", loc: "Lagos",
    status: "published", statusLabel: "Published", age: "49d", candidates: "—",
    // Naira, like every other band — a Lagos requisition benchmarked on NG data.
    seniority: "Senior", salaryBand: "₦13.7M–22.2M", rubricDims: 7,
    jd: "We are seeking a Senior Chemical Engineer to oversee the selection and application of chemicals in the transformation of crude oil into usable products. This role involves ensuring optimal chemical processes, addressing drilling-related environmental challenges, and collaborating with cross-functional teams to enhance operational efficiency. The ideal candidate will lead initiatives to improve product quality and ensure compliance with environmental regulations.",
    mustHave: [
      "Bachelor's degree in Chemical Engineering or related field",
      "Minimum of 7 years of experience in chemical engineering within the oil and gas industry",
      "Proven expertise in crude oil processing and chemical applications",
      "Strong knowledge of environmental regulations and compliance standards",
      "Excellent problem-solving and analytical skills",
      "Ability to lead projects and collaborate with multidisciplinary teams",
      "Effective communication and leadership abilities",
    ],
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Signed" },
    ],
  },
  {
    id: "REQ-2213", role: "Maintenance Officer", dept: "Engineering", loc: "Lagos",
    status: "pending", statusLabel: "In review", age: "50d", candidates: "—",
    seniority: "Mid", salaryBand: "₦8.5M–11M", rubricDims: 6,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Awaiting" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Awaiting" },
    ],
  },
  {
    id: "REQ-2212", role: "Researcher", dept: "Product", loc: "Lagos",
    status: "published", statusLabel: "Published", age: "54d", candidates: "—",
    seniority: "Mid", salaryBand: "₦9M–12M", rubricDims: 6,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Signed" },
    ],
  },
  {
    id: "REQ-2211", role: "Petroleum Engineer", dept: "Operations", loc: "Lagos",
    status: "draft", statusLabel: "Draft", age: "56d", candidates: "—",
    seniority: "Senior", salaryBand: "₦11.7M–19M", rubricDims: 7,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "—" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "—" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "—" },
    ],
  },
  {
    id: "REQ-2210", role: "Accountant", dept: "Operations", loc: "Lagos",
    status: "published", statusLabel: "Published", age: "57d", candidates: "—",
    seniority: "Mid", salaryBand: "₦7M–9.5M", rubricDims: 5,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Signed" },
    ],
  },
  {
    // Real staging row — someone's test entry, kept for 1:1 fidelity with the backend data.
    id: "REQ-2210B", role: ",mmm", dept: "Design", loc: "Lagos",
    status: "published", statusLabel: "Published", age: "57d", candidates: "—",
    seniority: "Mid", salaryBand: "₦6M–8M", rubricDims: 5,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Signed" },
    ],
  },
  {
    id: "REQ-2209", role: "Hardware Maintenance Technician", dept: "Engineering", loc: "Lagos",
    status: "pending", statusLabel: "In review", age: "57d", candidates: "—",
    seniority: "Junior", salaryBand: "₦4.5M–6M", rubricDims: 5,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Awaiting" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Awaiting" },
    ],
  },
  {
    id: "REQ-2208", role: "AI Engineer", dept: "Engineering", loc: "Lagos",
    status: "rejected", statusLabel: "Rejected", age: "57d", candidates: "—",
    seniority: "Senior", salaryBand: "₦14M–18M", rubricDims: 7,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "—" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "—" },
    ],
  },
  {
    id: "REQ-2207", role: "Customer Support", dept: "Design", loc: "Lagos",
    status: "published", statusLabel: "Published", age: "58d", candidates: "—",
    seniority: "Junior", salaryBand: "₦3.5M–5M", rubricDims: 5,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Signed" },
    ],
  },
  {
    id: "REQ-2206", role: "Financial Expert", dept: "Design", loc: "Lagos",
    status: "published", statusLabel: "Published", age: "58d", candidates: "—",
    seniority: "Lead", salaryBand: "₦16M–20M", rubricDims: 6,
    signoffs: [
      { who: "Finance", init: "F", label: "Budget approval", state: "Signed" },
      { who: "Dept. Head", init: "D", label: "Headcount approval", state: "Signed" },
      { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "Signed" },
    ],
  },
];

export const REQ_DEPARTMENTS = ["Design", "Engineering", "Product", "Marketing", "Operations"] as const;
export const REQ_SENIORITY = ["Junior", "Mid", "Senior", "Lead", "Principal"] as const;

/** Status rail nodes — the staging app's 3-node lifecycle. */
export const REQ_RAIL = [
  { key: "draft", label: "Draft", sub: "Manager drafting role" },
  { key: "pending", label: "Pending Approval", sub: "Awaiting sign-offs" },
  { key: "published", label: "Approved", sub: "Funded & authorized" },
] as const;

/* ========================================================================== */
/* The ONE generator                                                          */
/*                                                                            */
/* Everything a requisition carries — JD, must-haves, the Naira band, the      */
/* scoring rubric, the knockout questions and the video prompts — comes from   */
/* here. The chat intake in Requisitions.tsx is an alternative way to FILL     */
/* this function's arguments; it is never a second generator.                  */
/* ========================================================================== */

/* ------------------------------ Naira money ------------------------------ */

/** Round to the nearest ₦100k so a benchmark never reads like false precision. */
const round100k = (n: number) => Math.round(n / 100_000) * 100_000;

/** 13_700_000 → "₦13.7M" · 19_000_000 → "₦19M" */
export const naira = (n: number): string => {
  const m = round100k(n) / 1_000_000;
  return `₦${Number.isInteger(m) ? m : m.toFixed(1)}M`;
};

export const bandOf = (b: SalaryBenchmark): string => `${naira(b.p25)}–${naira(b.p75)}`;

/* --------------------------- Comp benchmark (NG) -------------------------- */

/** Annual NGN, Lagos-based, before the department adjustment. */
const SENIORITY_BASE: Record<string, [number, number, number]> = {
  Junior: [3_600_000, 4_800_000, 6_200_000],
  Mid: [7_400_000, 9_600_000, 12_100_000],
  Senior: [12_200_000, 15_400_000, 19_800_000],
  Lead: [18_500_000, 23_000_000, 28_400_000],
  Principal: [26_000_000, 32_000_000, 41_000_000],
};

const DEPT_FACTOR: Record<string, number> = {
  Engineering: 1.12, Product: 1.05, Design: 1.0, Operations: 0.96, Marketing: 0.94,
};

/** How many verified comparables the panel holds for each function. */
const DEPT_SAMPLE: Record<string, number> = {
  Design: 249, Engineering: 205, Product: 160, Operations: 190, Marketing: 110,
};

/** Comparables thin out as you go up the ladder — the confidence follows. */
const SENIORITY_SAMPLE: Record<string, number> = {
  Junior: 1.15, Mid: 1.0, Senior: 0.86, Lead: 0.55, Principal: 0.31,
};

/** Named Nigerian sources — a benchmark nobody can trace is not a benchmark. */
const NG_SOURCES = [
  "Hirebrew NG comp panel — verified offers, trailing 12 months",
  "Jobberman Nigeria salary index 2026",
  "MyJobMag Lagos listings — trailing 12 months",
];

const DEPT_SOURCE: Record<string, string> = {
  Design: "Paystack · Kuda · Flutterwave design bands (anonymised)",
  Engineering: "Interswitch · Moniepoint · Flutterwave engineering bands (anonymised)",
  Product: "Andela product-org compensation survey 2026",
  Operations: "NCDMB oil & gas field-operations pay survey 2026",
  Marketing: "Nigeria growth & lifecycle marketing panel 2026",
};

export function benchmarkFor(dept: string, seniority: string): SalaryBenchmark {
  const [p25, p50, p75] = SENIORITY_BASE[seniority] ?? SENIORITY_BASE.Mid;
  const f = DEPT_FACTOR[dept] ?? 1;
  const sample = Math.round((DEPT_SAMPLE[dept] ?? 140) * (SENIORITY_SAMPLE[seniority] ?? 1));
  const confidence = sample >= 180 ? 88 : sample >= 120 ? 79 : sample >= 70 ? 68 : 54;
  return {
    p25: round100k(p25 * f),
    p50: round100k(p50 * f),
    p75: round100k(p75 * f),
    currency: "NGN",
    sample,
    sources: [DEPT_SOURCE[dept] ?? "Nigeria cross-industry pay panel 2026", ...NG_SOURCES],
    confidence,
  };
}

/* ------------------- Scoring rubric, on the skills taxonomy ---------------- */

/** Department → the SKILL_CLUSTERS cluster its rubric is drawn from. */
const DEPT_CLUSTER: Record<string, string> = {
  Design: "Product & Design",
  Product: "Product & Design",
  Engineering: "Engineering",
  Operations: "Operations & HSE",
  Marketing: "Commercial & Finance",
};

/** The three dimensions every SEEPCO rubric carries, whatever the function. */
const CROSS_DIMS: { dim: string; cluster: string }[] = [
  { dim: "Communication & stakeholder management", cluster: "Cross-functional" },
  { dim: "Ownership & judgement", cluster: "Cross-functional" },
  { dim: "Comp & location fit", cluster: "Screening" },
];

/** Weight sets, each summing to exactly 100. */
const WEIGHTS: Record<number, number[]> = {
  4: [32, 26, 22, 20],
  5: [26, 22, 18, 18, 16],
  6: [24, 20, 16, 14, 14, 12],
  7: [22, 18, 14, 12, 12, 12, 10],
};

/** How many dimensions a rubric gets when nothing else says otherwise. */
const DIMS_FOR: Record<string, number> = { Junior: 5, Mid: 6, Senior: 7, Lead: 7, Principal: 7 };

/** The function's own skills, most in-demand first — straight from the taxonomy. */
export function clusterSkillsFor(dept: string): { skill: string; cluster: string; demand: number }[] {
  const name = DEPT_CLUSTER[dept] ?? "Product & Design";
  const cluster = SKILL_CLUSTERS.find((c) => c.name === name) ?? SKILL_CLUSTERS[0];
  return [...cluster.skills]
    .sort((a, b) => b.demand - a.demand)
    .map((s) => ({ skill: s.s, cluster: cluster.name, demand: s.demand }));
}

/**
 * Build a weighted rubric from SKILL_CLUSTERS — this is the artefact that
 * scores every applicant in Stage-04, so it is authored, not asserted.
 */
export function rubricFor(dept: string, seniority: string, dims?: number): RubricDim[] {
  const n = Math.max(4, Math.min(7, dims ?? DIMS_FOR[seniority] ?? 6));
  const skills = clusterSkillsFor(dept);
  const fromSkills = Math.max(1, n - CROSS_DIMS.length);
  const picked = [
    ...skills.slice(0, fromSkills).map((s) => ({ dim: s.skill, cluster: s.cluster })),
    ...CROSS_DIMS.slice(0, n - Math.min(fromSkills, skills.length)),
  ].slice(0, n);
  const w = WEIGHTS[picked.length] ?? WEIGHTS[6];
  return picked.map((p, i) => ({ ...p, weight: w[i] ?? 0 }));
}

export const rubricTotal = (r: RubricDim[]): number => r.reduce((n, d) => n + d.weight, 0);

/* ------------------------------- Knockouts -------------------------------- */

const MIN_YEARS: Record<string, number> = { Junior: 1, Mid: 3, Senior: 5, Lead: 8, Principal: 10 };

/**
 * Authored criteria. Screening.tsx's nine knockout rejections cite a reason —
 * this is the reason they cite.
 */
export function knockoutsFor(title: string, dept: string, seniority: string): Knockout[] {
  const yrs = MIN_YEARS[seniority] ?? 3;
  const top = clusterSkillsFor(dept).slice(0, 2).map((s) => s.skill).join(" · ");
  const list: Knockout[] = [
    { q: "Do you have the right to work in Nigeria without sponsorship?", type: "yesno", autoReject: true },
    { q: `How many years of ${dept.toLowerCase()} experience do you have? (${yrs}+ required)`, type: "number", autoReject: true },
    { q: "Are you based in Lagos, or able to relocate within 60 days?", type: "yesno", autoReject: false },
    { q: `Which of these have you owned end-to-end in a ${(title || "similar").toLowerCase()} role — ${top}?`, type: "choice", autoReject: false },
  ];
  if (dept === "Operations" || dept === "Engineering") {
    list.push({ q: "Do you hold a current HSE Level 3 certification?", type: "yesno", autoReject: false });
  }
  return list;
}

/* ----------------------------- Video prompts ------------------------------ */

export function videoPromptsFor(title: string, dept: string): VideoPrompt[] {
  const top = clusterSkillsFor(dept)[0]?.skill ?? "the work";
  return [
    { prompt: `In two minutes: walk us through a ${top.toLowerCase()} problem you owned end-to-end — what you changed, and what it moved.`, seconds: 120 },
    { prompt: `Why this ${title || "role"}, and why an energy operator now?`, seconds: 90 },
  ];
}

/* ----------------------- Self-healing record accessors -------------------- */
/* A workspace persisted before these fields existed still renders a full
   artefact card: the accessor regenerates from role + dept + seniority. */

export const rubricOf = (r: Requisition): RubricDim[] =>
  r.rubric && r.rubric.length ? r.rubric : rubricFor(r.dept, r.seniority, r.rubricDims);
export const benchmarkOf = (r: Requisition): SalaryBenchmark =>
  r.salaryBenchmark ?? benchmarkFor(r.dept, r.seniority);
export const knockoutsOf = (r: Requisition): Knockout[] =>
  r.knockouts && r.knockouts.length ? r.knockouts : knockoutsFor(r.role, r.dept, r.seniority);
export const videoPromptsOf = (r: Requisition): VideoPrompt[] =>
  r.videoPrompts && r.videoPrompts.length ? r.videoPrompts : videoPromptsFor(r.role, r.dept);

/* ------------------------------- Generator -------------------------------- */

export type GeneratedArtifact = {
  jd: string;
  mustHave: string[];
  salaryBand: string;
  salaryBenchmark: SalaryBenchmark;
  rubric: RubricDim[];
  rubricDims: number;
  knockouts: Knockout[];
  videoPrompts: VideoPrompt[];
};

/** Simulated "✦ Generate with AI" output — every artefact the recruiter edits. */
export function generateArtifact(title: string, dept: string, seniority: string, brief: string): GeneratedArtifact {
  const t = title || "New Role";
  const benchmark = benchmarkFor(dept, seniority);
  const rubric = rubricFor(dept, seniority);
  const yrs = MIN_YEARS[seniority] ?? 3;
  const skills = clusterSkillsFor(dept);
  return {
    jd: `We are seeking a ${seniority} ${t} to strengthen the ${dept} function at SEEPCO's Lagos operation. ${brief ? brief + " " : ""}This role owns outcomes end-to-end: shaping the work, raising the quality bar, and collaborating with cross-functional teams to deliver against H2 priorities. The ideal candidate combines deep craft with the judgment to operate in a regulated, safety-first environment.`,
    mustHave: [
      `Proven ${dept.toLowerCase()} track record at ${seniority} level`,
      `${yrs}+ years of experience, ideally in energy or another regulated industry`,
      skills[0] ? `Demonstrable depth in ${skills[0].skill.toLowerCase()}` : "Relevant degree or equivalent practical experience",
      skills[1] ? `Working command of ${skills[1].skill.toLowerCase()}` : "Strong problem-solving and analytical skills",
      "Effective communication and stakeholder management",
      "Ability to mentor and lift the team's standard",
    ],
    salaryBand: bandOf(benchmark),
    salaryBenchmark: benchmark,
    rubric,
    rubricDims: rubric.length,
    knockouts: knockoutsFor(t, dept, seniority),
    videoPrompts: videoPromptsFor(t, dept),
  };
}

/**
 * The seed rows, enriched by the same generator that drafts new ones — so a
 * 49-day-old requisition and one drafted in chat this morning carry exactly
 * the same artefacts. Bands and dimension counts on the seed rows are
 * preserved; only the structured artefacts are added.
 */
export const REQUISITIONS: Requisition[] = BASE_REQUISITIONS.map((r) => ({
  ...r,
  rubric: rubricFor(r.dept, r.seniority, r.rubricDims),
  salaryBenchmark: benchmarkFor(r.dept, r.seniority),
  knockouts: knockoutsFor(r.role, r.dept, r.seniority),
  videoPrompts: videoPromptsFor(r.role, r.dept),
}));
