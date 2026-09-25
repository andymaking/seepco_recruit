/** Shared candidate datasets (from the design's CANDIDATES / SHORTLIST / CANDDIR). */

export type Candidate = {
  name: string; loc: string; score: number; init: string; tone: string;
  tag: string; yrs: string; src: string;
  dims: [string, number][];
  why: string; voice: string;
};

/** Detailed candidate cards — used by Screening & Candidate Profile. */
export const CANDIDATES: Candidate[] = [
  { name: "Adaeze Okafor", loc: "Lagos, NG", score: 92, init: "AO", tone: "#AF52DE", tag: "Top match", yrs: "7 yrs", src: "LinkedIn",
    dims: [["Portfolio depth", 95], ["Systems thinking", 93], ["Visual craft", 90], ["Communication", 88], ["Collaboration", 82]],
    why: "Shipped a design-system used across 4 products; portfolio shows end-to-end ownership of a payments flow — directly relevant to the JD must-haves.", voice: "Clear structured answers; led with user outcomes over aesthetics. Sentiment positive, no fraud signals." },
  { name: "Tunde Bakare", loc: "Abuja, NG", score: 88, init: "TB", tone: "#16B364", tag: "Strong", yrs: "6 yrs", src: "Talent pool",
    dims: [["Portfolio depth", 90], ["Systems thinking", 85], ["Visual craft", 92], ["Collaboration", 84], ["Communication", 80]],
    why: "Exceptional craft and motion work. Slightly lighter on systems/governance experience versus the top candidate.", voice: "Confident, portfolio-forward. Gave concrete metrics on a redesign that lifted activation 18%." },
  { name: "Chiamaka Eze", loc: "Remote, NG", score: 85, init: "CE", tone: "#16B364", tag: "Strong", yrs: "8 yrs", src: "Referral",
    dims: [["Systems thinking", 91], ["Collaboration", 88], ["Portfolio depth", 82], ["Communication", 84], ["Visual craft", 78]],
    why: "Deep systems & accessibility expertise; strongest collaborator signal. Visual craft a notch below the leaders.", voice: "Thoughtful, process-driven. Strong on stakeholder alignment and design ops." },
  { name: "Emeka Nwosu", loc: "Lagos, NG", score: 83, init: "EN", tone: "#475569", tag: "Consider", yrs: "5 yrs", src: "Job board",
    dims: [["Visual craft", 88], ["Portfolio depth", 82], ["Communication", 82], ["Systems thinking", 79], ["Collaboration", 80]],
    why: "Promising mid-senior profile with sharp craft. Less evidence of leading 0→1 product work at scale.", voice: "Energetic, growth-minded. Needs probing on ambiguity and prioritisation." },
  { name: "Fatima Bello", loc: "Kano, NG", score: 81, init: "FB", tone: "#475569", tag: "Consider", yrs: "6 yrs", src: "Careers page",
    dims: [["Collaboration", 86], ["Communication", 85], ["Portfolio depth", 78], ["Systems thinking", 79], ["Visual craft", 77]],
    why: "Strong communicator and cross-functional partner; portfolio leans more UX research than product UI.", voice: "Articulate on research-to-design handoff. Calm, structured delivery." },
  { name: "Oluwaseun Adeyemi", loc: "Ibadan, NG", score: 79, init: "OA", tone: "#475569", tag: "Consider", yrs: "5 yrs", src: "LinkedIn",
    dims: [["Visual craft", 84], ["Communication", 80], ["Portfolio depth", 76], ["Systems thinking", 75], ["Collaboration", 78]],
    why: "Solid generalist. Borderline against the senior bar; would shine in a mid-level brief.", voice: "Friendly, coachable. Some answers stayed high-level under follow-up." },
];

export type ShortlistCandidate = {
  init: string; tone: string; name: string; score: number;
  title: string; co: string; note: string; tags: string[];
};

/** Ranked shortlist — used by the Shortlist screen (tiered Strong/Good/Possible). */
export const SHORTLIST: ShortlistCandidate[] = [
  { init: "AO", tone: "#AF52DE", name: "Adaeze Obi", score: 91, title: "Senior Product Designer", co: "Paystack", note: "Strong portfolio in fintech, 5 yrs exp, meets all scorecard criteria.", tags: ["Figma", "Design Systems", "Research", "B2B", "Fintech"] },
  { init: "CO", tone: "#16B364", name: "Chidi Okafor", score: 88, title: "Product Designer", co: "Flutterwave", note: "Deep B2B SaaS experience, excellent systems thinking, slightly junior.", tags: ["Figma", "Prototyping", "SaaS", "Design Ops"] },
  { init: "ZB", tone: "#16B364", name: "Zainab Bello", score: 85, title: "Lead Product Designer", co: "Kuda", note: "Strong leadership and mentoring track record, less hands-on lately.", tags: ["Leadership", "Strategy", "Figma", "Fintech"] },
  { init: "TB", tone: "#E81E17", name: "Tunde Bakare", score: 81, title: "Senior UX Designer", co: "Interswitch", note: "Solid UX research depth, portfolio lighter on visual polish.", tags: ["UX Research", "Wireframing", "Accessibility"] },
  { init: "FY", tone: "#AF52DE", name: "Fatima Yusuf", score: 78, title: "Product Designer", co: "Cowrywise", note: "Promising generalist, fewer years than the senior bar requires.", tags: ["Figma", "Branding", "Mobile"] },
  { init: "EN", tone: "#475569", name: "Emeka Nwosu", score: 74, title: "Senior Designer", co: "PiggyVest", note: "Relevant industry, portfolio depth unclear from CV alone.", tags: ["Figma", "Fintech", "Illustration"] },
  { init: "NE", tone: "#16B364", name: "Ngozi Eze", score: 67, title: "UI Designer", co: "TeamApt", note: "Strong visual craft, limited B2B/product depth for this role.", tags: ["UI", "Motion", "Visual Design"] },
];

export type DirCandidate = {
  name: string; init: string; tone: string; role: string;
  stage: string; score: number; source: string;
};

/** Candidate directory — used by the Candidates kanban. */
export const CANDDIR: DirCandidate[] = [
  { name: "Adaeze Okafor", init: "AO", tone: "#AF52DE", role: "Senior Product Designer", stage: "Interview", score: 92, source: "LinkedIn" },
  { name: "Funmi Alabi", init: "FA", tone: "#16B364", role: "Product Manager", stage: "Offer", score: 90, source: "LinkedIn" },
  { name: "Tunde Bakare", init: "TB", tone: "#16B364", role: "Senior Product Designer", stage: "Interview", score: 88, source: "Talent pool" },
  { name: "David Mensah", init: "DM", tone: "#E81E17", role: "Product Manager", stage: "Interview", score: 86, source: "Referral" },
  { name: "Chiamaka Eze", init: "CE", tone: "#16B364", role: "Senior Product Designer", stage: "Assessment", score: 85, source: "Referral" },
  { name: "Emeka Nwosu", init: "EN", tone: "#475569", role: "Senior Product Designer", stage: "Assessment", score: 83, source: "Job board" },
  { name: "Ibrahim Sani", init: "IS", tone: "#AF52DE", role: "Backend Engineer (Go)", stage: "Screening", score: 81, source: "Job board" },
  { name: "Zainab Yusuf", init: "ZY", tone: "#16B364", role: "Growth Marketer", stage: "Screening", score: 79, source: "WhatsApp" },
  { name: "Ngozi Obi", init: "NO", tone: "#16B364", role: "Backend Engineer (Go)", stage: "Screening", score: 78, source: "LinkedIn" },
  { name: "Sadia Bello", init: "SB", tone: "#E81E17", role: "Growth Marketer", stage: "Sourcing", score: 74, source: "Careers page" },
  { name: "Kwame Asante", init: "KA", tone: "#16B364", role: "Backend Engineer (Go)", stage: "Sourcing", score: 72, source: "GitHub" },
  { name: "Bola Adeyemi", init: "BA", tone: "#AF52DE", role: "Growth Marketer", stage: "Sourcing", score: 70, source: "LinkedIn" },
  { name: "Chidi Okeke", init: "CO", tone: "#16B364", role: "Backend Engineer (Go)", stage: "Assessment", score: 80, source: "Referral" },
  { name: "Halima Sule", init: "HS", tone: "#E81E17", role: "Product Manager", stage: "Offer", score: 87, source: "LinkedIn" },
];
