/** AI Copilot rail content, keyed by stage id (from the design). */
export type CopilotItem = {
  kind: string;
  icon: string;
  tint: string;
  bg: string;
  confidence: number | null;
  title: string;
  body: string;
  action: string | null;
};
export type CopilotPanel = { stage: string; assist: number; items: CopilotItem[] };

export const COPILOT: Record<string, CopilotPanel> = {
  dashboard: {
    stage: "Recruitment overview",
    assist: 84,
    items: [
      { kind: "PRIORITY", icon: "✦", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "12 shortlist matches ready to review", body: "Overnight screening for Senior Product Designer finished at 04:12. 12 of 47 applicants cleared knockout + role-fit thresholds.", action: "Open shortlist" },
      { kind: "RISK", icon: "⚠", tint: "#EBA308", bg: "#FEF7E6", confidence: 78, title: "Backend Engineer req aging past SLA", body: "14 days open with no shortlist. Sourcing yield is below forecast — recommend adding 2 channels.", action: "Fix sourcing" },
      { kind: "FORECAST", icon: "📈", tint: "#16B364", bg: "#F4FBF7", confidence: 71, title: "Product team likely needs +2 hires in Q3", body: "Attrition + backlog growth signals predict capacity shortfall by August. Draft requisitions ready.", action: "Review forecast" },
    ],
  },
  planning: {
    stage: "Stage 01 · Workforce Planning",
    assist: 79,
    items: [
      { kind: "DEMAND FORECAST", icon: "📈", tint: "#16B364", bg: "#F4FBF7", confidence: 71, title: "Predicting 3 net-new hires for Product, Q3", body: "Time-series model on attrition + ticket-queue depth + team velocity. Confidence rises as Q2 actuals land.", action: "Generate requisition" },
      { kind: "ATTRITION RISK", icon: "⚠", tint: "#EBA308", bg: "#FEF7E6", confidence: 66, title: "Design pod at elevated departure risk", body: "2 of 5 ICs show engagement decline + tenure cliff. Hiring proactively avoids a Q3 capacity gap.", action: null },
      { kind: "SKILL GAP", icon: "◈", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "Gap: senior product design + design systems", body: "Current team skill graph is light on systems thinking vs. your H2 roadmap priorities.", action: null },
    ],
  },
  role: {
    stage: "Stage 02 · Role Definition",
    assist: 92,
    items: [
      { kind: "JD DRAFT", icon: "✎", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "JD generated from your one-line brief", body: "Full first-draft JD, must-have / nice-to-have split, and scorecard produced in 38 seconds. Edit anything inline.", action: "Accept draft" },
      { kind: "BIAS FLAG", icon: "⚠", tint: "#EBA308", bg: "#FEF7E6", confidence: null, title: "2 exclusionary phrases flagged", body: '"young & energetic" signals age bias; "rockstar" narrows the funnel. Inclusive rewrites suggested inline.', action: "Apply rewrites" },
      { kind: "COMP BENCHMARK", icon: "₦", tint: "#16B364", bg: "#F4FBF7", confidence: 88, title: "Recommended band: ₦9.5M–₦13.2M", body: "Live Nigerian + global market data, adjusted for Lagos / hybrid / senior. Sources cited per dimension.", action: null },
    ],
  },
  sourcing: {
    stage: "Stage 03 · Sourcing",
    assist: 81,
    items: [
      { kind: "TALENT POOL", icon: "◎", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "9 warm matches already in your database", body: "Silver-medallists & inbound from past designer roles. 3 are open to a move based on recent activity.", action: "Surface warm list" },
      { kind: "CHANNEL MIX", icon: "⇶", tint: "#16B364", bg: "#F4FBF7", confidence: 74, title: "LinkedIn + design communities = best yield", body: "Predicted highest source-to-applicant conversion for senior design roles. WhatsApp groups low-yield here.", action: null },
      { kind: "OUTREACH", icon: "✎", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "18 personalised messages drafted", body: "Tailored to each profile in Hirebrew’s employer voice. You review & edit before anything sends.", action: "Review drafts" },
    ],
  },
  screening: {
    stage: "Stage 04 · Screening",
    assist: 94,
    items: [
      { kind: "RANKING", icon: "✦", tint: "#AF52DE", bg: "#F7EEFC", confidence: 91, title: "Adaeze Okafor ranks #1 (role-fit 92)", body: "Strongest on portfolio depth & systems thinking. Per-dimension breakdown and transcript citations attached.", action: "Open profile" },
      { kind: "KNOCKOUT", icon: "⛒", tint: "#E81E17", bg: "#FDE8E8", confidence: null, title: "9 auto-rejected — each cites a JD criterion", body: 'e.g. "No portfolio of shipped product work" (JD must-have #2). Explainable, replayable, appealable.', action: null },
      { kind: "FAIRNESS AUDIT", icon: "⚖", tint: "#16B364", bg: "#ECF9F3", confidence: null, title: "Demographic parity check passed", body: "Ranking shows no statistical correlation with protected attributes. Logged before shown to you.", action: null },
    ],
  },
  assessment: {
    stage: "Stage 05 · Assessment",
    assist: 88,
    items: [
      { kind: "GENERATED TEST", icon: "◳", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "Design brief generated from must-haves", body: "Drafted from the Stage-02 must-haves and mapped to the scorecard dimensions. Needs hiring-manager approval before it can be sent.", action: "Open brief for review" },
      { kind: "ANTI-CHEAT", icon: "⚠", tint: "#EBA308", bg: "#FEF7E6", confidence: 64, title: "1 submission flagged AI-generated", body: "Surfaced for your review — never auto-rejection. False-positive tolerance kept deliberately conservative.", action: null },
      { kind: "GRADING", icon: "✓", tint: "#16B364", bg: "#ECF9F3", confidence: 86, title: "5 submissions graded against rubric", body: "Each score cites evidence. Sampled against a human reviewer for agreement.", action: null },
    ],
  },
  interview: {
    stage: "Stage 06 · Interviewing",
    assist: 90,
    items: [
      { kind: "LIVE TRANSCRIPT", icon: "◉", tint: "#E81E17", bg: "#FDE8E8", confidence: null, title: "Transcribing — Adaeze, Round 2 (live)", body: "Real-time ASR with speaker separation. Scoring against the rubric as the conversation unfolds.", action: null },
      { kind: "FOLLOW-UP", icon: "✦", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "Ask about cross-functional conflict", body: '"Collaboration" still needs evidence on the scorecard. Suggested probe surfaced to the interviewer.', action: "Insert question" },
      { kind: "BIAS FLAG", icon: "⚠", tint: "#EBA308", bg: "#FEF7E6", confidence: null, title: "Unequal speaking time detected", body: "Interviewer is at 61% talk-time vs. a 35% panel average. Gentle nudge sent privately.", action: null },
    ],
  },
  selection: {
    stage: "Stage 07 · Selection & Decision",
    assist: 87,
    items: [
      { kind: "DECISION CONFIDENCE", icon: "◆", tint: "#16B364", bg: "#ECF9F3", confidence: 83, title: "Panel agreement is high on Adaeze", body: "Consistent strength across all rounds. Confidence score reflects low inter-rater variance.", action: null },
      { kind: "DEVIL'S ADVOCATE", icon: "⚑", tint: "#EBA308", bg: "#FEF7E6", confidence: null, title: "Strongest case against the frontrunner", body: "Limited B2B experience vs. the runner-up. Surfaced to counter confirmation bias before you commit.", action: null },
      { kind: "FAIRNESS CHECK", icon: "⚖", tint: "#16B364", bg: "#ECF9F3", confidence: null, title: "Selection not correlated with protected attributes", body: "Checked against the runner-up cohort at decision time. Logged for audit.", action: null },
    ],
  },
  reference: {
    stage: "Stage 08 · Reference & Background",
    assist: 85,
    items: [
      { kind: "REFERENCE CALLS", icon: "☎", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "2 referees contacted, 1 call complete", body: "AI conducted a structured 10-min call (with consent), transcribed & scored against the role rubric.", action: null },
      { kind: "CONTRADICTION", icon: "⚠", tint: "#EBA308", bg: "#FEF7E6", confidence: null, title: "Minor claim mismatch on tenure", body: "Candidate stated 3 yrs; referee recalls ~2.5. Amber, not red — worth a clarifying question.", action: null },
      { kind: "RIGHT-TO-WORK", icon: "⛉", tint: "#16B364", bg: "#ECF9F3", confidence: 97, title: "ID verified via Smile ID — valid", body: "OCR + face match on NIN slip. No expiry concerns. Routed through your background-check partners.", action: null },
    ],
  },
  offer: {
    stage: "Stage 09 · Offer & Negotiation",
    assist: 86,
    items: [
      { kind: "OFFER DRAFT", icon: "✎", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "Offer letter drafted & ready for sign-off", body: "₦11.8M base + equity, Nigerian-law-compliant template, pre-filled. Awaiting legal review.", action: "Send for sign-off" },
      { kind: "ACCEPTANCE", icon: "◑", tint: "#16B364", bg: "#ECF9F3", confidence: 79, title: "79% predicted acceptance likelihood", body: "High engagement & fast responses, no competing offer detected. Above the ≥75% target band.", action: null },
      { kind: "COUNTER STRATEGY", icon: "♟", tint: "#16B364", bg: "#F4FBF7", confidence: null, title: "If she counters: lead with sign-on bonus", body: "Higher predicted impact than base bump at this band. Negotiation rehearsal available before the call.", action: "Rehearse call" },
    ],
  },
  onboarding: {
    stage: "Stage 10 · Onboarding",
    assist: 83,
    items: [
      { kind: "DOCUMENTS", icon: "◳", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "Contract, NDA & ESOP letter generated", body: "Pre-filled from the accepted package, watermarked with template version. Ready to send for e-sign.", action: "Send documents" },
      { kind: "PROVISIONING", icon: "⚙", tint: "#16B364", bg: "#F4FBF7", confidence: null, title: "Accounts queued: Google, Slack, Figma, GitHub", body: "Scheduled to activate on day one. Access logged for SOC 2 control evidence.", action: null },
      { kind: "30/60/90 PLAN", icon: "◷", tint: "#16B364", bg: "#ECF9F3", confidence: null, title: "Personalised ramp plan + buddies matched", body: "Drafted from the role + team priorities. Culture buddy: Ngozi. Domain buddy: Tobi.", action: null },
    ],
  },
  posthire: {
    stage: "Stage 11 · Post-Hire / Evaluation",
    assist: 80,
    items: [
      { kind: "QUALITY OF HIRE", icon: "★", tint: "#16B364", bg: "#ECF9F3", confidence: null, title: "30-day quality-of-hire tracking at 4.3 / 5", body: "Composite of manager + peer feedback, output velocity & engagement. Above the ≥4.0 target.", action: null },
      { kind: "FEEDBACK LOOP", icon: "↻", tint: "#AF52DE", bg: "#F7EEFC", confidence: null, title: "Outcome fed back into screening models", body: "This hire’s 90-day signal recalibrates the stage-04 model & stage-02 scorecard. The platform learns.", action: null },
      { kind: "RETENTION RISK", icon: "⚠", tint: "#16B364", bg: "#ECF9F3", confidence: null, title: "No early disengagement signals", body: "Calendar, engagement & sentiment all healthy at day 30. Will re-check at 60 & 90.", action: null },
    ],
  },
};

/** Resolve the Copilot panel for a stage, falling back to the dashboard panel. */
export const copilotFor = (stage: string): CopilotPanel => COPILOT[stage] ?? COPILOT.dashboard;
