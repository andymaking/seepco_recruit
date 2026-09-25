"use client";
import { useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useAssessment } from "@/state/assessment";
import { personaById } from "@/data/personas";
import { Ic } from "@/components/os/icons";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfStat, PfTile, PfProgress,
  PfAvatar, PfPageTabs, PfTh, PfBanner, type PfTone, type PageTab,
} from "@/components/os/ui";

/* ─────────────────────────────  DATA  ───────────────────────────── */

/**
 * Identity comes from the persona registry, never from a copy kept here: a
 * second literal is how this portal ended up greeting a hiring manager while
 * showing an applicant's assessment. Name, initials and accent all read
 * through `CANDIDATE`, and the same name is what the assessment store matches
 * dispatch recipients against.
 */
const CANDIDATE = personaById("candidate");
const CANDIDATE_FIRST = CANDIDATE.name.split(" ")[0];
const CANDIDATE_EMAIL = `${CANDIDATE.name.toLowerCase().replace(/\s+/g, ".")}@gmail.com`;
/** The persona title is scoped ("Applicant · Senior Product Designer"); inside her own portal the applicant framing is redundant, so only the role shows. */
const CANDIDATE_ROLE = CANDIDATE.title.split("·").at(-1)?.trim() ?? CANDIDATE.title;

type CandNavName =
  | "Dashboard" | "My Applications" | "Assessments" | "Interviews"
  | "Documents" | "Offers" | "Joining" | "Settings";

/** Section descriptor shown in the topbar context run (was the topbar sub-line). */
const headerSub: Record<CandNavName, string> = {
  "Dashboard": `Welcome back, ${CANDIDATE.name}`,
  "My Applications": "Track all your job applications",
  "Assessments": "Your tests and practice exercises",
  "Interviews": "Upcoming and past interviews",
  "Documents": "Manage your uploaded documents",
  "Offers": "Review and respond to job offers",
  "Joining": "Your onboarding journey",
  "Settings": "Manage your account and preferences",
};

/** Presentation lives in the component; the data carries only semantics + a PfTone. */
type CandEvent = {
  kind: string; kindTone: PfTone; status: string; statusTone: PfTone;
  title: string; org: string; date: string; time: string; cta: string;
};
const candEvents: CandEvent[] = [
  { kind: "Assessment", kindTone: "purple", status: "Scheduled", statusTone: "green", title: "Design Assessment - Senior Product Designer", org: "Paystack", date: "Nov 22, 2025", time: "10:00 AM", cta: "Start" },
  { kind: "Interview", kindTone: "blue", status: "Confirmed", statusTone: "green", title: "HR Round - Product Designer", org: "Flutterwave", date: "Nov 24, 2025", time: "2:30 PM", cta: "Join" },
  { kind: "Interview", kindTone: "blue", status: "Pending", statusTone: "yellow", title: "Portfolio Review - Design Systems Lead", org: "Kuda", date: "Nov 26, 2025", time: "11:00 AM", cta: "Join" },
];

type CandApp = { title: string; org: string; loc: string; stage: string; tone: PfTone; applied: string; pct: number };
const candApps: CandApp[] = [
  { title: "Senior Product Designer", org: "Paystack", loc: "Lagos", stage: "Assessment", tone: "green", applied: "Nov 15, 2025", pct: 60 },
  { title: "Product Designer", org: "Flutterwave", loc: "Abuja", stage: "Interview", tone: "green", applied: "Nov 12, 2025", pct: 75 },
  { title: "Design Systems Lead", org: "Kuda", loc: "Ibadan", stage: "Screening", tone: "green", applied: "Nov 10, 2025", pct: 40 },
];

type Step = { label: string; num: string; state: "done" | "active" | "todo" };
type AppRow = {
  title: string; org: string; loc: string; salary: string;
  stageLabel: string; status: string; applied: string; pct: number;
  kind: string; tone: PfTone; statusTone: PfTone; steps: Step[];
};

const cAllApps: AppRow[] = [
  { title: "Senior Product Designer", org: "Paystack", loc: "Lagos", salary: "₦11M – ₦15M", stageLabel: "Assessment", status: "In Progress", applied: "Nov 15, 2025", pct: 60, cur: 3, kind: "normal" },
  { title: "Product Designer", org: "Flutterwave", loc: "Abuja", salary: "₦10M – ₦13M", stageLabel: "Interview", status: "In Progress", applied: "Nov 12, 2025", pct: 75, cur: 4, kind: "normal" },
  { title: "Design Systems Lead", org: "Kuda", loc: "Ibadan", salary: "₦16M – ₦22M", stageLabel: "Screening", status: "In Progress", applied: "Nov 10, 2025", pct: 40, cur: 2, kind: "normal" },
  { title: "UI/UX Designer", org: "Cowrywise", loc: "Remote (NG)", salary: "₦8M – ₦12M", stageLabel: "Offer", status: "Offer Received", applied: "Nov 8, 2025", pct: 90, cur: 5, kind: "offer" },
  { title: "Senior UX Designer", org: "Interswitch", loc: "Port Harcourt", salary: "₦10M – ₦14M", stageLabel: "Rejected", status: "Not Selected", applied: "Nov 5, 2025", pct: 30, cur: 2, kind: "rejected" },
  { title: "Brand & Marketing Designer", org: "PiggyVest", loc: "Lagos", salary: "₦9M – ₦12M", stageLabel: "Applied", status: "Under Review", applied: "Nov 3, 2025", pct: 20, cur: 1, kind: "review" },
].map((a) => {
  const STATUS_TONE: Record<string, PfTone> = {
    "In Progress": "yellow", "Offer Received": "green",
    "Not Selected": "red", "Under Review": "green",
  };
  const tone: PfTone = a.kind === "rejected" ? "red" : "green";
  const steps: Step[] = ["Applied", "Screening", "Assessment", "Interview", "Offer"].map((label, idx) => {
    const n = idx + 1;
    const state: Step["state"] = n < a.cur ? "done" : n === a.cur ? "active" : "todo";
    return { label, num: String(n), state };
  });
  return { ...a, tone, statusTone: STATUS_TONE[a.status] ?? "grey", steps };
});

type Assessment = {
  title: string; desc: string; type: string; dur: string; qs: string;
  isPending: boolean; isDone: boolean; isCode: boolean; isClip: boolean;
  due?: string; bannerTitle?: string; bannerDate?: string; score?: string;
  /** Set only on the ONE real record dispatched from Stage 05; the rest of this
   *  list is portfolio furniture with nowhere to go. */
  liveId?: string;
  liveDue?: string;
};
const cAssessments: Assessment[] = [
  { title: "Design Assessment - Product Fundamentals", desc: "Multiple choice questions on design systems, accessibility, research methods, and interaction patterns", type: "MCQ", dur: "60 min", qs: "25 questions", icon: "clip", state: "pending", due: "Due: Nov 22, 2025 - 11:59 PM" },
  { title: "Design Systems Exercise", desc: "Rebuild a checkout flow from the provided component library", type: "Take-home", dur: "90 min", qs: "3 tasks", icon: "code", state: "completed", bannerTitle: "Assessment Completed", bannerDate: "Completed on Nov 10, 2025", score: "88%" },
  { title: "Behavioral Assessment", desc: "Personality and behavioral assessment", type: "Psychometric", dur: "45 min", qs: "40 questions", icon: "clip", state: "passed", bannerTitle: "Assessment Passed", bannerDate: "Completed on Nov 8, 2025", score: "75%" },
].map((a) => ({ ...a, isPending: a.state === "pending", isDone: a.state !== "pending", isCode: a.icon === "code", isClip: a.icon !== "code" }));

type Interview = {
  round: string; org: string; interviewer: string; role: string; date: string;
  time: string; mode: string; status: string; statusTone: PfTone;
  isUpcoming: boolean; isCompleted: boolean; isVideo: boolean;
  isPhone?: boolean; feedback?: string;
};
const INTERVIEW_STATUS_TONE: Record<string, PfTone> = { "Confirmed": "green", "Scheduled": "yellow", "Completed": "green" };
const cInterviews: Interview[] = [
  { round: "HR Round", org: "Paystack", interviewer: "Sarah Johnson", role: "HR Manager", date: "Nov 24, 2025", time: "2:30 PM WAT (30 min)", mode: "Video Interview", status: "Confirmed", state: "upcoming" },
  { round: "Portfolio Review - Round 1", org: "Paystack", interviewer: "Chidi Okafor", role: "Design Lead", date: "Nov 26, 2025", time: "11:00 AM WAT (60 min)", mode: "Video Interview", status: "Scheduled", state: "upcoming" },
  { round: "Screening Call", org: "Paystack", interviewer: "Michael Chen", role: "Recruiter", date: "Nov 18, 2025", time: "10:00 AM WAT (20 min)", mode: "Phone Call", status: "Completed", state: "completed", isPhone: true, feedback: "Positive - Moving to next round" },
].map((i) => ({ ...i, statusTone: INTERVIEW_STATUS_TONE[i.status] ?? "grey", isUpcoming: i.state === "upcoming", isCompleted: i.state === "completed", isVideo: !i.isPhone }));

type Doc = {
  name: string; status: string; file?: string; size?: string; uploaded?: string; note?: string;
  tone: PfTone; isUploaded: boolean; isMissing: boolean;
  isVerifiedStatus: boolean; isPendingStatus: boolean; hasNote: boolean;
};
const cDocuments: Doc[] = [
  { name: "ID Proof (NIN Slip)", file: "nin_slip.pdf", size: "245 KB", uploaded: "Nov 15, 2025", status: "Verified" },
  { name: "Degree Certificate", file: "bsc_degree.pdf", size: "1.2 MB", uploaded: "Nov 15, 2025", status: "Verified" },
  { name: "Experience Letter", file: "experience_letter.pdf", size: "320 KB", uploaded: "Nov 15, 2025", status: "Pending", note: "Document is under review. You'll be notified once verified." },
  { name: "Bank Statement (Last 3 months)", status: "Not Uploaded" },
  { name: "Passport Size Photo", file: "passport_photo.jpg", size: "156 KB", uploaded: "Nov 16, 2025", status: "Verified" },
  { name: "Background Check Form", status: "Not Uploaded" },
].map((d) => {
  const DOC_TONE: Record<string, PfTone> = { "Verified": "green", "Pending": "yellow", "Not Uploaded": "grey" };
  const uploaded = d.status !== "Not Uploaded";
  return { ...d, tone: DOC_TONE[d.status] ?? "grey", isUploaded: uploaded, isMissing: !uploaded, isVerifiedStatus: d.status === "Verified", isPendingStatus: d.status === "Pending", hasNote: !!d.note };
});

/** The checklist carries state only — the four hand-built border/background treatments are gone. */
type JoinStep = {
  label: string; sub: string; connector: string;
  state: "done" | "active" | "todo"; isNow: boolean; hasConnector: boolean;
};
const cJoiningSteps: JoinStep[] = (
  [
    { label: "Offer accepted", sub: "Accepted Nov 18", state: "done", connector: "" },
    { label: "Background check", sub: "In progress", state: "active", now: true, connector: "Verify" },
    { label: "Document submission", sub: "3 of 5 verified", state: "active", connector: "Submit" },
    { label: "Equipment & access", sub: "Scheduled Dec 10", state: "todo", connector: "Setup" },
    { label: "First day", sub: "Jan 15, 2026", state: "todo", connector: "Day 1" },
  ] as { label: string; sub: string; state: JoinStep["state"]; connector: string; now?: boolean }[]
).map((s) => ({
  label: s.label, sub: s.sub, connector: s.connector, state: s.state,
  isNow: !!s.now, hasConnector: !!s.connector,
}));

type FormItem = { label: string; checked: boolean };
type Formality = {
  title: string; icon: string; status: string; tone: PfTone;
  hasCta: boolean; cta?: string; isDone: boolean;
  items: FormItem[];
};
/** Status → tone; replaces the 4-tuple hex table that baked sColor/sBg/iconColor/iconBg. */
const FORMALITY_TONE: Record<string, PfTone> = {
  "Completed": "green", "Approved": "green", "In Progress": "yellow", "Pending": "grey",
};
const cFormalities: Formality[] = [
  { title: "Document Verification Summary", icon: "doc", status: "Completed", items: [
    { label: "ID Proof", checked: true }, { label: "Degree Certificates", checked: true }, { label: "Experience Letters", checked: true }, { label: "Bank Statements", checked: true }, { label: "Passport Size Photos", checked: true }] },
  { title: "Bank Details Entry", icon: "card", status: "Completed", items: [
    { label: "Bank Account Number", checked: true }, { label: "Sort Code", checked: true }, { label: "Cancelled Cheque", checked: true }, { label: "Pension (RSA) PIN", checked: true }] },
  { title: "Personal Info Update", icon: "user", status: "Completed", items: [
    { label: "Emergency Contact Details", checked: true }, { label: "Current Address", checked: true }, { label: "Permanent Address", checked: true }, { label: "Blood Group", checked: true }] },
  { title: "Background Verification", icon: "shield", status: "In Progress", items: [
    { label: "Identity Verification", checked: true }, { label: "Education Verification", checked: true }, { label: "Employment Verification", checked: false }, { label: "Criminal Record Check", checked: true }, { label: "Address Verification", checked: false }], cta: "Continue" },
  { title: "Medical Test", icon: "medical", status: "Pending", items: [
    { label: "General Health Checkup", checked: false }, { label: "Medical Certificate Upload", checked: false }], cta: "Start" },
  { title: "IT Asset Request", icon: "monitor", status: "Approved", items: [
    { label: "Laptop - Dell XPS 15", checked: true }, { label: "Monitor - 27 inch", checked: true }, { label: "Keyboard & Mouse", checked: true }, { label: "Headset", checked: true }] },
].map((f) => ({
  ...f,
  tone: FORMALITY_TONE[f.status] ?? "grey",
  hasCta: !!f.cta,
  isDone: f.status === "Completed" || f.status === "Approved",
}));

const prefDefs = [
  { key: "appUpdates", label: "Application updates", sub: "Status changes on your applications", on: true },
  { key: "interviewReminders", label: "Interview reminders", sub: "Alerts before scheduled interviews", on: true },
  { key: "newsletter", label: "Job recommendations", sub: "Weekly roles matched to your profile", on: false },
  { key: "sms", label: "SMS alerts", sub: "Urgent updates by text message", on: true },
] as const;

/* ─────────────────────────────  SMALL UI HELPERS  ───────────────────────────── */

/** Progress donut — the house SVG ring (stroke-dasharray), never a conic-gradient. */
function Ring({ pct, size = 64 }: { pct: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-n50)" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pf-primary-500)" strokeWidth={7} strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray .4s ease" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{pct}%</span>
    </div>
  );
}

/** The kit's 26px square-rounded stage marker (replaces the 34px circle stepper). */
function StepMarker({ s }: { s: Step }) {
  const todo = s.state === "todo";
  return (
    <span
      style={{
        width: 26, height: 26, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
        background: todo ? "var(--pf-n50)" : "var(--pf-primary-50)", color: todo ? "var(--pf-n300)" : "var(--pf-primary-500)",
        fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600,
      }}
    >
      {s.state === "done" ? <Ic name="check" size={13} color="var(--pf-primary-500)" /> : s.num}
    </span>
  );
}

/** Read-only value box — one construction for the joining fields and the profile fields. */
function ReadOnlyField({ label, value, mono, muted }: { label: string; value: string; mono?: boolean; muted?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 5 }}>{label}</div>
      <div
        style={{
          fontSize: 13, fontWeight: muted ? 400 : 600, color: muted ? "var(--pf-n400)" : "var(--pf-n900)",
          padding: "10px 12px", border: "1px solid var(--pf-n50)", borderRadius: 8, background: "var(--pf-n25)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          ...(mono ? { fontFamily: "var(--mono)" } : null),
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** The platform toggle (src/screens/Settings.tsx), on tokens instead of hex. */
function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ width: 38, height: 22, borderRadius: 5, cursor: "pointer", flex: "none", position: "relative", background: on ? "var(--pf-primary-500)" : "var(--pf-n100)", transition: "background .15s ease" }}
    >
      <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: "var(--pf-n0)", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "left .15s ease" }} />
    </div>
  );
}

/* ─────────────────────────────  SECTIONS  ───────────────────────────── */

const STAT_CARDS: { v: string; label: string; icon: string; tone: PfTone }[] = [
  { v: "12", label: "Applied", icon: "file", tone: "green" },
  { v: "5", label: "Screening", icon: "clipboard", tone: "purple" },
  { v: "3", label: "Assessment", icon: "flask", tone: "yellow" },
  { v: "2", label: "Interview", icon: "chat", tone: "yellow" },
  { v: "1", label: "Offer", icon: "star", tone: "green" },
];

const QUICK_ACTIONS: { title: string; sub: string; icon: string; tone: PfTone; go: CandNavName | null }[] = [
  { title: "Browse Jobs", sub: "Find new opportunities", icon: "file", tone: "green", go: "My Applications" },
  { title: "Practice Tests", sub: "Prepare for assessments", icon: "flask", tone: "purple", go: "Assessments" },
  { title: "Career Resources", sub: "Tips and guides", icon: "trend", tone: "green", go: null },
];

function QuickRow({ q, last, onClick }: { q: (typeof QUICK_ACTIONS)[number]; last: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 20px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <PfTile icon={q.icon} tone={q.tone} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{q.sub}</div>
      </div>
      <Ic name="caretright" size={13} color="var(--pf-n300)" />
    </div>
  );
}

function EventRow({ e, last, onOpen }: { e: CandEvent; last: boolean; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <PfTile icon={e.kind === "Assessment" ? "flask" : "chat"} tone={e.kindTone} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{e.org}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--pf-n500)", marginTop: 3 }}>
          <Ic name="calendar" size={12} color="var(--pf-n300)" />{e.date}
          <Ic name="clock" size={12} color="var(--pf-n300)" />{e.time}
        </div>
      </div>
      <PfBadge tone={e.kindTone}>{e.kind}</PfBadge>
      <PfBadge tone={e.statusTone} dot>{e.status}</PfBadge>
      <PfBtn small variant="primary" onClick={onOpen}>{e.cta}</PfBtn>
    </div>
  );
}

const RECENT_GRID = "1.8fr .8fr 1fr .9fr .8fr";

function RecentAppRow({ a, last, onClick }: { a: CandApp; last: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "grid", gridTemplateColumns: RECENT_GRID, gap: 10, alignItems: "center", padding: "11px 20px", cursor: "pointer", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{a.org} · {a.loc}</div>
      </div>
      <div><PfBadge tone={a.tone} dot>{a.stage}</PfBadge></div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}><PfProgress pct={a.pct} tone={a.tone} /></div>
        <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{a.pct}%</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>Applied on {a.applied}</div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <PfBtn small onClick={onClick}>View Details</PfBtn>
      </div>
    </div>
  );
}

function DashboardView({ setNav, toast }: { setNav: (n: CandNavName) => void; toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState("overview");
  const TABS: PageTab[] = [
    { key: "overview", label: "Overview" },
    { key: "events", label: "Upcoming events", count: String(candEvents.length) },
    { key: "applications", label: "Recent applications", count: String(candApps.length) },
  ];
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER — the old gradient hero, rebuilt as the platform title block */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px" }}>Welcome back, {CANDIDATE_FIRST}! 👋</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>You have 3 upcoming events this week</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
          <PfBtn icon="flask" onClick={() => setNav("Assessments")}>Take Assessment</PfBtn>
          <PfBtn variant="primary" icon="clipboard" onClick={() => setNav("My Applications")}>View All Applications</PfBtn>
        </div>
      </div>

      {/* ACTION REQUIRED */}
      <div style={{ marginTop: 16 }}>
        <PfBanner tone="yellow" icon="warning">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1 }}>
              <b style={{ fontWeight: 600 }}>Action Required</b>
              <span style={{ fontWeight: 400 }}> — Complete document upload for Paystack</span>
            </span>
            <PfBtn small onClick={() => setNav("Documents")}>Upload Documents</PfBtn>
          </div>
        </PfBanner>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={TABS} active={tab} onSelect={setTab} />
      </div>

      {tab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12 }}>
            {STAT_CARDS.map((c) => (
              <PfStat key={c.label} icon={c.icon} tone={c.tone} label={c.label} value={c.v} />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, alignItems: "start", marginTop: 12 }}>
            <PfCard>
              <PfCardHead title="Quick Actions" sub="Jump straight to what you need next." />
              {QUICK_ACTIONS.map((q, i) => (
                <QuickRow
                  key={q.title}
                  q={q}
                  last={i === QUICK_ACTIONS.length - 1}
                  onClick={() => (q.go ? setNav(q.go) : toast("Career resources opened", "default"))}
                />
              ))}
            </PfCard>

            <PfCard>
              <PfCardHead title="Profile Completion" sub="Almost there!">
                <PfBadge tone="green">85%</PfBadge>
              </PfCardHead>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px" }}>
                <Ring pct={85} size={64} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <PfProgress pct={85} tone="green" />
                  <div style={{ marginTop: 10 }}>
                    <PfBtn small variant="ghost" onClick={() => setNav("Settings")} style={{ color: "var(--pf-primary-600)", padding: 0 }}>
                      Complete profile <Ic name="arrowright" size={13} color="var(--pf-primary-600)" />
                    </PfBtn>
                  </div>
                </div>
              </div>
            </PfCard>
          </div>
        </>
      )}

      {tab === "events" && (
        <PfCard>
          <PfCardHead title="Upcoming Events" sub="Assessments and interviews scheduled for you.">
            <PfBadge tone="blue" dot>{candEvents.length} this week</PfBadge>
            <PfBtn small onClick={() => setNav("Interviews")}>View All</PfBtn>
          </PfCardHead>
          {candEvents.map((e, i) => (
            <EventRow
              key={e.title}
              e={e}
              last={i === candEvents.length - 1}
              onOpen={() => setNav(e.kind === "Assessment" ? "Assessments" : "Interviews")}
            />
          ))}
        </PfCard>
      )}

      {tab === "applications" && (
        <PfCard>
          <PfCardHead title="Recent Applications" sub="Where each of your live applications stands right now.">
            <PfBtn small onClick={() => setNav("My Applications")}>View All</PfBtn>
          </PfCardHead>
          <div style={{ display: "grid", gridTemplateColumns: RECENT_GRID, gap: 10, padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
            <PfTh>Role</PfTh>
            <PfTh>Stage</PfTh>
            <PfTh>Progress</PfTh>
            <PfTh>Applied</PfTh>
            <PfTh />
          </div>
          {candApps.map((a, i) => (
            <RecentAppRow key={a.title} a={a} last={i === candApps.length - 1} onClick={() => setNav("My Applications")} />
          ))}
        </PfCard>
      )}
    </div>
  );
}


function AppCard({ a, toast }: { a: AppRow; toast: ReturnType<typeof useToast> }) {
  return (
    <PfCard>
      <PfCardHead
        title={<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><PfTile icon="file" tone={a.tone} size={30} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span></span>}
        sub={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <Ic name="house" size={12} color="var(--pf-n300)" />{a.org}
            <Ic name="target" size={12} color="var(--pf-n300)" />{a.loc}
            <Ic name="wallet" size={12} color="var(--pf-n300)" />
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{a.salary}</span>
          </span>
        }
      >
        <PfBadge tone={a.statusTone} dot>{a.status}</PfBadge>
        <PfBadge tone="grey">{a.stageLabel}</PfBadge>
        <PfBtn small onClick={() => toast(`Viewing ${a.title}`, "default")}>View Details</PfBtn>
      </PfCardHead>

      <div style={{ padding: "14px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>Application Progress</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-n900)" }}>{a.pct}%</span>
        </div>
        <PfProgress pct={a.pct} tone={a.tone} />
        <div style={{ display: "flex", alignItems: "flex-start", marginTop: 16 }}>
          {a.steps.map((s) => (
            <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <StepMarker s={s} />
              <span style={{ fontSize: 11.5, fontWeight: 500, color: s.state === "todo" ? "var(--pf-n400)" : "var(--pf-n900)" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
        <Ic name="calendar" size={12} color="var(--pf-n300)" />
        Applied {a.applied}
      </div>
    </PfCard>
  );
}

const APP_STATUSES = Array.from(new Set(cAllApps.map((a) => a.status)));
const APP_STAGES = Array.from(new Set(cAllApps.map((a) => a.stageLabel)));

const APP_TABS: PageTab[] = [
  { key: "all", label: "All applications", count: String(cAllApps.length) },
  { key: "active", label: "In progress", count: String(cAllApps.filter((a) => a.status === "In Progress" || a.status === "Under Review").length) },
  { key: "offer", label: "Offers", count: String(cAllApps.filter((a) => a.kind === "offer").length) },
  { key: "closed", label: "Closed", count: String(cAllApps.filter((a) => a.kind === "rejected").length) },
];

function ApplicationsView({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState("all");
  const search = useHover();
  const visible =
    tab === "active" ? cAllApps.filter((a) => a.status === "In Progress" || a.status === "Under Review")
      : tab === "offer" ? cAllApps.filter((a) => a.kind === "offer")
        : tab === "closed" ? cAllApps.filter((a) => a.kind === "rejected")
          : cAllApps;
  const tabLabel = APP_TABS.find((t) => t.key === tab)?.label ?? "";

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>My Applications</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Track and manage all your job applications</div>
        </div>
        <PfBadge tone="green">{cAllApps.length} Total Applications</PfBadge>
      </div>

      {/* PAGE-LEVEL FILTER RUN — sits above the section tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <div
          {...search.hoverProps}
          onClick={() => toast(`Search across ${cAllApps.length} applications`, "default")}
          style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: `1px solid ${search.hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`, borderRadius: 9, padding: "7px 12px", width: 230, cursor: "pointer" }}
        >
          <Ic name="search" size={14} color="var(--pf-n400)" />
          <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden" }}>Search applications…</span>
        </div>
        <PfBtn small icon="caretdown" onClick={() => toast(`Status filter — ${APP_STATUSES.length} statuses across ${cAllApps.length} applications`, "default")}>Status</PfBtn>
        <PfBtn small icon="caretdown" onClick={() => toast(`Stage filter — ${APP_STAGES.length} stages across ${cAllApps.length} applications`, "default")}>Stage</PfBtn>
        <PfBtn small icon="filter" onClick={() => toast("More filters", "default")}>More Filters</PfBtn>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={APP_TABS} active={tab} onSelect={setTab} />
      </div>

      {visible.length === 0 ? (
        <PfCard>
          <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
            No applications under {tabLabel.toLowerCase()} yet.
          </div>
        </PfCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map((a) => <AppCard key={a.title} a={a} toast={toast} />)}
        </div>
      )}
    </div>
  );
}


/**
 * The portal's soft-green advisory panel. It used to be rendered once per card
 * (so the same four lines appeared twice on a screen) — with section tabs it is
 * hoisted to a single tinted card at the top of the tab that needs it.
 */
function TipsCard({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 20px 10px" }}>
        <Ic name="info" size={15} color="var(--pf-primary-500)" />
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px", color: "var(--pf-n900)" }}>{title}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: "0 20px 16px" }}>
        {items.map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, lineHeight: 1.55, color: "var(--pf-primary-600)" }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--pf-primary-500)", flex: "none" }} />{t}
          </div>
        ))}
      </div>
    </PfCard>
  );
}

/** icon + label + value cell — shared by the interview detail grid and both offer grids. */
function Field({ icon, label, value, span }: { icon: string; label: string; value: React.ReactNode; span?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0, ...(span ? { gridColumn: "1 / -1" } : null) }}>
      <span style={{ display: "inline-flex", flex: "none", marginTop: 2 }}><Ic name={icon} size={14} color="var(--pf-n300)" /></span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}

const instructions = [
  "Ensure stable internet connection",
  "Use a desktop or laptop (mobile not recommended)",
  "Complete in one sitting - no pause/resume",
  "Do not refresh or close the browser",
];

/** Matched against the dispatch recipient list inside the store, exactly as the player matches it. */
const LIVE_CANDIDATE = CANDIDATE.name;

/**
 * The live record's own format words. Written out here rather than imported:
 * the portal reaches the assessment domain through `candidateAssessment()` and
 * nothing else, so an un-dispatched brief has no path onto this screen.
 */
const LIVE_TYPE_LABEL: Record<string, string> = {
  "take-home": "Take-home",
  "timed-test": "Timed test",
  "video-prompt": "Video prompt",
};

/** The assessment types read apart by tone; the data carries only the label. */
const ASSESSMENT_TYPE_TONE: Record<string, PfTone> = {
  "MCQ": "grey", "Coding": "blue", "Psychometric": "purple",
  "Take-home": "purple", "Timed test": "blue", "Video prompt": "green",
};

function AssessmentCard({ a, toast }: { a: Assessment; toast: ReturnType<typeof useToast> }) {
  const go = useGo();
  const tone: PfTone = ASSESSMENT_TYPE_TONE[a.type] ?? "grey";
  return (
    <PfCard>
      <PfCardHead
        title={<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><PfTile icon={a.isCode ? "stack" : "clipboard"} tone={tone} size={30} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span></span>}
        sub={a.desc}
      >
        <PfBadge tone={tone}>{a.type}</PfBadge>
        {a.isPending && (
          <PfBtn small variant="primary" icon="play" onClick={() => (a.liveId ? go("assesstake") : toast(`Starting ${a.title}`, "default"))}>
            Start Assessment
          </PfBtn>
        )}
        {a.isDone && (
          <PfBtn small onClick={() => (a.liveId ? go("assesstake") : toast(`Viewing results for ${a.title}`, "default"))}>
            {a.liveId ? "View what I sent" : "View Results"}
          </PfBtn>
        )}
      </PfCardHead>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 20px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>
          <Ic name="clock" size={13} color="var(--pf-n300)" />{a.dur}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>
          <Ic name="file" size={13} color="var(--pf-n300)" />{a.qs}
        </span>
        {a.isPending && (a.liveDue || a.due) && (
          <PfBadge tone="yellow" dot>{a.liveDue ? `Due ${a.liveDue}` : a.due}</PfBadge>
        )}
      </div>

      {a.isDone && (
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 20px", borderTop: "1px solid var(--pf-n50)" }}>
          <Ic name="check" size={15} color="var(--pf-primary-500)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{a.bannerTitle}</div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{a.bannerDate}</div>
          </div>
          {a.score ? (
            <div style={{ textAlign: "right", flex: "none" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 700, letterSpacing: "-.4px", lineHeight: 1, color: "var(--pf-n900)" }}>{a.score}</div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>Your Score</div>
            </div>
          ) : (
            <PfBadge tone="yellow" dot>Awaiting review</PfBadge>
          )}
        </div>
      )}
    </PfCard>
  );
}

function AssessmentsView({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState("pending");
  const { candidateAssessment, submissionFor } = useAssessment();

  // The ONE real exercise: null until a recruiter's brief has been approved by
  // the named hiring manager and dispatched to this candidate. Everything below
  // it in the list is demo furniture.
  const live = candidateAssessment(LIVE_CANDIDATE);
  const handedIn = live ? submissionFor(live.id, LIVE_CANDIDATE) : undefined;

  const liveCard: Assessment | null = live && {
    title: live.title,
    desc: live.brief,
    type: LIVE_TYPE_LABEL[live.type] ?? live.type,
    dur: `${live.durationMins} min`,
    qs: `${live.questions.length} question${live.questions.length === 1 ? "" : "s"}`,
    isPending: !handedIn,
    isDone: Boolean(handedIn),
    isCode: false,
    isClip: true,
    bannerTitle: handedIn ? "Answers sent" : undefined,
    bannerDate: handedIn ? `Sent ${handedIn.submittedAt}` : undefined,
    score: handedIn?.score != null ? `${handedIn.score}%` : undefined,
    liveId: live.id,
    liveDue: live.dispatch?.dueAt,
  };

  const all = liveCard ? [liveCard, ...cAssessments] : cAssessments;
  const visible = tab === "pending" ? all.filter((a) => a.isPending) : all.filter((a) => a.isDone);

  const pending = all.filter((a) => a.isPending).length;
  const done = all.filter((a) => a.isDone).length;
  const tabs = useMemo<PageTab[]>(
    () => [
      { key: "pending", label: "To do", count: String(pending) },
      { key: "done", label: "Completed", count: String(done) },
    ],
    [pending, done],
  );
  const tabLabel = tabs.find((t) => t.key === tab)?.label ?? "";

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Assessments</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Complete your assessments to move forward in the hiring process</div>
        </div>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "pending" && <TipsCard title="Instructions:" items={instructions} />}
        {visible.length === 0 ? (
          <PfCard>
            <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
              No {tabLabel.toLowerCase()} assessments here yet.
            </div>
          </PfCard>
        ) : (
          visible.map((a) => <AssessmentCard key={a.liveId ?? a.title} a={a} toast={toast} />)
        )}
      </div>
    </div>
  );
}
const interviewTips = [
  "Join 5 minutes before the scheduled time",
  "Test your camera and microphone beforehand",
  "Keep your resume and notepad ready",
  "Ensure you're in a quiet, well-lit environment",
];

const INTERVIEW_TABS: PageTab[] = [
  { key: "upcoming", label: "Upcoming", count: String(cInterviews.filter((i) => i.isUpcoming).length) },
  { key: "past", label: "Past", count: String(cInterviews.filter((i) => i.isCompleted).length) },
];

function InterviewCard({ iv, toast }: { iv: Interview; toast: ReturnType<typeof useToast> }) {
  const modeIcon = iv.isVideo ? "chat" : "mic";
  return (
    <PfCard>
      <PfCardHead
        title={<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><PfTile icon={modeIcon} tone="green" size={30} /><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{iv.round}</span></span>}
        sub={iv.org}
      >
        <PfBadge tone={iv.statusTone} dot>{iv.status}</PfBadge>
        {iv.isUpcoming && (
          <>
            <PfBtn small variant="primary" icon={modeIcon} onClick={() => toast(`Joining ${iv.round}`, "success")}>Join Interview</PfBtn>
            <PfBtn small onClick={() => toast("Reschedule request sent", "default")}>Reschedule</PfBtn>
          </>
        )}
        {iv.isCompleted && <PfBtn small onClick={() => toast(`Viewing ${iv.round}`, "default")}>View Details</PfBtn>}
      </PfCardHead>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "13px 24px", padding: "14px 20px 16px" }}>
        <Field span icon="user" label="Interviewer:" value={<>{iv.interviewer}<PfBadge tone="grey">{iv.role}</PfBadge></>} />
        <Field icon="calendar" label="Date:" value={iv.date} />
        <Field icon={modeIcon} label="Mode:" value={iv.mode} />
        <Field icon="clock" label="Time:" value={iv.time} />
      </div>

      {iv.isCompleted && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)" }}>
          <Ic name="check" size={12} color="var(--pf-primary-500)" />
          <span><b style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Feedback:</b> {iv.feedback}</span>
        </div>
      )}
    </PfCard>
  );
}

function InterviewsView({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState("upcoming");
  const visible = tab === "upcoming" ? cInterviews.filter((i) => i.isUpcoming) : cInterviews.filter((i) => i.isCompleted);
  const tabLabel = INTERVIEW_TABS.find((t) => t.key === tab)?.label ?? "";

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Interview Schedule</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Manage your upcoming and past interviews</div>
        </div>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={INTERVIEW_TABS} active={tab} onSelect={setTab} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "upcoming" && <TipsCard title="Interview Tips:" items={interviewTips} />}
        {visible.length === 0 ? (
          <PfCard>
            <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
              No {tabLabel.toLowerCase()} interviews here yet.
            </div>
          </PfCard>
        ) : (
          visible.map((iv) => <InterviewCard key={iv.round} iv={iv} toast={toast} />)
        )}
      </div>
    </div>
  );
}
const uploadGuidelines = [
  "Accepted formats: PDF, JPG, PNG (Max size: 5MB)",
  "Ensure documents are clear and legible",
  "All documents must be original or certified copies",
  "Verification typically takes 1-2 business days",
];

/** Every count on this page is derived from cDocuments — nothing is typed. */
const DOCS_VERIFIED = cDocuments.filter((d) => d.isVerifiedStatus).length;
const DOCS_MISSING = cDocuments.filter((d) => d.isMissing).length;
const DOCS_PCT = Math.round((DOCS_VERIFIED / cDocuments.length) * 100);

const DOC_TABS: PageTab[] = [
  { key: "all", label: "All documents", count: String(cDocuments.length) },
  { key: "action", label: "Needs action", count: String(cDocuments.filter((d) => d.isMissing || d.isPendingStatus).length) },
  { key: "verified", label: "Verified", count: String(DOCS_VERIFIED) },
];

function DocRow({ d, last, toast }: { d: Doc; last: boolean; toast: ReturnType<typeof useToast> }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      style={{ padding: "11px 20px", background: hovered ? "var(--pf-n25)" : "transparent", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <PfTile icon="file" tone={d.tone} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
          {d.isUploaded && (
            <>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>File: {d.file}</div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n500)", marginTop: 3 }}>
                Size: <span style={{ fontFamily: "var(--mono)" }}>{d.size}</span> &nbsp;·&nbsp; Uploaded: {d.uploaded}
              </div>
            </>
          )}
          {d.isMissing && <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>No file uploaded yet</div>}
        </div>
        <PfBadge tone={d.tone} dot>{d.status}</PfBadge>
        {d.isUploaded && <PfBtn small icon="arrowsq" onClick={() => toast(`Viewing ${d.name}`, "default")}>View</PfBtn>}
        {d.isPendingStatus && (
          <PfBtn small variant="ghost" onClick={() => toast(`Removed ${d.name}`, "danger")} style={{ color: "var(--pf-red-500)" }}>
            <Ic name="x" size={13} color="var(--pf-red-500)" />
          </PfBtn>
        )}
        {d.isMissing && <PfBtn small variant="primary" icon="arrowup" onClick={() => toast(`${d.name} uploaded`, "success")}>Upload</PfBtn>}
      </div>
      {d.hasNote && (
        <div style={{ marginTop: 10 }}>
          <PfBanner tone="yellow" icon="clock">{d.note}</PfBanner>
        </div>
      )}
    </div>
  );
}

function DocumentsView({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState("action");
  const visible =
    tab === "action" ? cDocuments.filter((d) => d.isMissing || d.isPendingStatus)
      : tab === "verified" ? cDocuments.filter((d) => d.isVerifiedStatus)
        : cDocuments;
  const tabLabel = DOC_TABS.find((t) => t.key === tab)?.label ?? "";

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Document Upload &amp; Validation</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Upload required documents for verification</div>
        </div>
      </div>

      {/* VERIFICATION PROGRESS — page-level status, sits above the section tabs */}
      <div style={{ marginTop: 16 }}>
        <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "16px 20px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px", color: "var(--pf-n900)" }}>Document Verification Progress</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--pf-n500)", marginTop: 2 }}>{DOCS_VERIFIED} of {cDocuments.length} documents verified</div>
              <div style={{ marginTop: 10, maxWidth: 340 }}><PfProgress pct={DOCS_PCT} tone="green" /></div>
            </div>
            <Ring pct={DOCS_PCT} size={64} />
          </div>
        </PfCard>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={DOC_TABS} active={tab} onSelect={setTab} />
      </div>

      <PfCard>
        <PfCardHead title={tabLabel} sub={`${DOCS_VERIFIED} of ${cDocuments.length} verified · ${DOCS_MISSING} still to upload`} />
        {visible.length === 0 ? (
          <div style={{ padding: "26px 20px", textAlign: "center", fontSize: 12.5, color: "var(--pf-n400)" }}>
            No documents under {tabLabel.toLowerCase()} yet.
          </div>
        ) : (
          visible.map((d, i) => <DocRow key={d.name} d={d} last={i === visible.length - 1} toast={toast} />)
        )}
      </PfCard>

      {/* Applies to every tab, so it renders outside the switch */}
      <div style={{ marginTop: 12 }}>
        <TipsCard title="Upload Guidelines" items={uploadGuidelines} />
      </div>
    </div>
  );
}
const benefits = [
  "Health Insurance (Self + Family)",
  "Flexible Work Hours",
  "Work from Home (Hybrid Model)",
  "Learning & Development Budget (₦750,000/year)",
  "Performance Bonus (Up to 20%)",
];

const OFFER_TABS: PageTab[] = [
  { key: "indicative", label: "Indicative offer", badge: "REVIEW" },
  { key: "final", label: "Final offer", badge: "ACCEPTED" },
];

/** Sub-panel heading inside an offer card. */
function PanelTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px", color: "var(--pf-n900)", padding: "14px 16px 10px" }}>{children}</div>;
}

function OffersView({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [tab, setTab] = useState("final");
  const ctcBreakup = [
    { label: "Fixed Salary", val: "₦11.5M" },
    { label: "Variable Pay", val: "₦2.1M" },
    { label: "Joining Bonus", val: "₦0.7M" },
  ];

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 820, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Offer Management</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Review and manage your job offers</div>
        </div>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={OFFER_TABS} active={tab} onSelect={setTab} />
      </div>

      {tab === "indicative" && (
        <PfCard>
          <PfCardHead
            title={<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><PfTile icon="wallet" tone="green" size={30} /><span>Indicative Offer</span></span>}
            sub="Preliminary offer details"
          >
            <PfBadge tone="green">Indicative</PfBadge>
          </PfCardHead>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "13px 24px", padding: "14px 20px 16px" }}>
            <Field icon="house" label="Company" value="Paystack" />
            <Field icon="wallet" label="Annual CTC" value={<span style={{ fontFamily: "var(--mono)" }}>₦14.3M</span>} />
            <Field icon="file" label="Position" value={CANDIDATE_ROLE} />
            <Field icon="calendar" label="Validity" value="Valid till Dec 5, 2025" />
          </div>

          {/* CTC BREAKUP */}
          <div style={{ padding: "0 20px 12px" }}>
            <PfCard style={{ background: "var(--pf-n25)" }}>
              <PanelTitle>CTC Breakup</PanelTitle>
              {ctcBreakup.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "7px 16px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>{r.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{r.val}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px 14px", marginTop: 7, borderTop: "1px solid var(--pf-n50)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Total CTC</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>₦14.3M</span>
              </div>
            </PfCard>
          </div>

          {/* ADDITIONAL BENEFITS */}
          <div style={{ padding: "0 20px 14px" }}>
            <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
              <PanelTitle>Additional Benefits</PanelTitle>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "9px 24px", padding: "0 16px 16px" }}>
                {benefits.map((b) => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, lineHeight: 1.55, color: "var(--pf-primary-600)" }}>
                    <span style={{ display: "inline-flex", flex: "none" }}><Ic name="check" size={13} color="var(--pf-primary-500)" /></span>{b}
                  </div>
                ))}
              </div>
            </PfCard>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "0 20px 16px" }}>
            <PfBtn variant="primary" style={{ flex: 1 }} onClick={() => toast("Offer accepted — congratulations!", "success")}>Accept Offer</PfBtn>
            <PfBtn style={{ flex: 1 }} onClick={() => toast("Offer declined", "danger")}>Decline Offer</PfBtn>
          </div>
        </PfCard>
      )}

      {tab === "final" && (
        <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
          <PfCardHead
            title={<span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><PfTile icon="wallet" tone="green" size={30} /><span>Final Offer Letter</span></span>}
            sub="Official offer released"
          >
            <PfBadge tone="green" dot>Final Offer</PfBadge>
          </PfCardHead>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "13px 24px", padding: "14px 20px 16px" }}>
            <Field icon="house" label="Company" value="Paystack" />
            <Field icon="calendar" label="Joining Date" value="January 15, 2026" />
            <Field icon="file" label="Position" value={CANDIDATE_ROLE} />
            <Field icon="check" label="Offer Status" value={<span style={{ color: "var(--pf-primary-600)" }}>Accepted on Nov 18, 2025</span>} />
            <Field icon="wallet" label="Final CTC" value={<span style={{ fontFamily: "var(--mono)" }}>₦14.8M</span>} />
          </div>

          <div style={{ padding: "0 20px 14px" }}>
            <PfCard>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px" }}>
                <span style={{ display: "inline-flex", flex: "none" }}><Ic name="check" size={17} color="var(--pf-primary-500)" /></span>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--pf-n600)" }}>
                  <b style={{ fontWeight: 600, color: "var(--pf-n900)" }}>Congratulations!</b> You have successfully accepted the offer. Please complete the joining formalities to proceed.
                </div>
              </div>
            </PfCard>
          </div>

          <div style={{ display: "flex", gap: 10, padding: "0 20px 16px" }}>
            <PfBtn variant="primary" icon="download" onClick={() => toast("Offer letter downloaded", "success")}>Download Offer Letter</PfBtn>
            <PfBtn icon="file" onClick={() => toast("Opening e-Sign", "default")}>View e-Sign</PfBtn>
          </div>
        </PfCard>
      )}

      {/* Contact details apply to both offers, so they render outside the switch */}
      <div style={{ marginTop: 12 }}>
        <PfCard>
          <PfCardHead title="HR Contact Details" sub="Reach the recruiter handling your offer." />
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, padding: "14px 20px 16px" }}>
            <PfCard style={{ background: "var(--pf-n25)", display: "flex", alignItems: "center", gap: 11, minWidth: 0 }} pad="12px 14px">
              <PfTile icon="mic" tone="green" size={30} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>Phone</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 2 }}>+234 1 700 1234</div>
              </div>
            </PfCard>
            <PfCard style={{ background: "var(--pf-n25)", display: "flex", alignItems: "center", gap: 11, minWidth: 0 }} pad="12px 14px">
              <PfTile icon="paperplane" tone="green" size={30} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>Email</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>hr@paystack.com</div>
              </div>
            </PfCard>
          </div>
        </PfCard>
      </div>
    </div>
  );
}
/** Formality glyphs, from the shared Ic registry (medical no longer reuses `shield`). */
const FORM_ICONS: Record<string, string> = {
  doc: "file", card: "wallet", user: "user", shield: "shield", medical: "heart", monitor: "stack",
};
const afterCompletion = [
  "Your employee ID will be generated and sent via email",
  "You'll receive your onboarding schedule with day 1 agenda",
  "IT assets will be shipped to your address",
  "Access to company systems and tools will be provisioned",
];

/**
 * Overall progress is authored copy (70% / "3 of 6"), not a derivation — it is
 * quoted in three places, so it lives in one constant here rather than being
 * retyped per call site.
 */
const JOIN_PCT = 70;

/** One checklist cell: the shared 26px StepMarker, the label stack and the NOW badge. */
function JoinStepCell({ s, i }: { s: JoinStep; i: number }) {
  const todo = s.state === "todo";
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <StepMarker s={{ label: s.label, num: String(i + 1), state: s.state }} />
        {s.isNow && <PfBadge tone="green" dot>NOW</PfBadge>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: todo ? "var(--pf-n400)" : "var(--pf-n900)" }}>{s.label}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{s.sub}</div>
      </div>
    </div>
  );
}

/** A formality checkbox row — borderless, hairline-divided, one state marker (not two). */
function FormItemRow({ it, last }: { it: FormItem; last: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)" }}>
      <span
        style={{
          width: 18, height: 18, borderRadius: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none",
          background: it.checked ? "var(--pf-primary-500)" : "var(--pf-n0)",
          border: it.checked ? "1px solid transparent" : "1px solid var(--pf-n100)",
        }}
      >
        {it.checked && <Ic name="check" size={12} color="#fff" weight={2} />}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: it.checked ? "var(--pf-n900)" : "var(--pf-n400)" }}>{it.label}</span>
    </div>
  );
}

function FormalityCard({ f, toast }: { f: Formality; toast: ReturnType<typeof useToast> }) {
  return (
    <PfCard>
      <PfCardHead
        title={
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <PfTile icon={FORM_ICONS[f.icon] ?? "file"} tone={f.tone} size={30} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</span>
          </span>
        }
      >
        <PfBadge tone={f.tone} dot>{f.status}</PfBadge>
      </PfCardHead>

      {f.items.map((it, j) => (
        <FormItemRow key={it.label} it={it} last={!f.hasCta && j === f.items.length - 1} />
      ))}

      {f.hasCta && (
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--pf-n50)" }}>
          <PfBtn small variant="primary" onClick={() => toast(`${f.title} — ${f.cta}`, "default")}>{f.cta}</PfBtn>
        </div>
      )}
    </PfCard>
  );
}

/**
 * Joining is the portal's one untabbed view — a single linear checklist surface,
 * per the conformance spec's section-tab mapping.
 */
function JoiningView({ toast }: { toast: ReturnType<typeof useToast> }) {
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Joining Formalities</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Complete all formalities before your joining date</div>
        </div>
      </div>

      {/* OVERALL PROGRESS */}
      <div style={{ marginTop: 16 }}>
        <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "16px 20px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px", color: "var(--pf-n900)" }}>Overall Progress</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--pf-n500)", marginTop: 2 }}>{JOIN_PCT}% complete - Almost there!</div>
              <div style={{ marginTop: 10, maxWidth: 480 }}><PfProgress pct={JOIN_PCT} tone="green" /></div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8 }}>3 of {cFormalities.length} sections completed &nbsp;·&nbsp; Joining date: Jan 15, 2026</div>
            </div>
            <Ring pct={JOIN_PCT} size={64} />
          </div>
        </PfCard>
      </div>

      {/* ONBOARDING CHECKLIST */}
      <div style={{ marginTop: 12 }}>
        <PfCard>
          <PfCardHead title="Onboarding Checklist" sub="Where you are in the journey from offer to first day." />
          <div style={{ display: "flex", alignItems: "stretch", padding: "16px 20px" }}>
            {cJoiningSteps.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                {/* the connector word rides the marker line, so the row reads as one track */}
                {s.hasConnector && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", height: 26, flex: "none" }}>
                    <span style={{ width: 12, height: 1, background: "var(--pf-n100)" }} />
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{s.connector}</span>
                    <span style={{ width: 12, height: 1, background: "var(--pf-n100)" }} />
                  </div>
                )}
                <JoinStepCell s={s} i={i} />
              </div>
            ))}
          </div>
        </PfCard>
      </div>

      {/* FORMALITY SECTIONS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {cFormalities.map((f) => <FormalityCard key={f.title} f={f} toast={toast} />)}

        {/* JOINING DATE CONFIRMATION */}
        <PfCard>
          <PfCardHead
            title={
              <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <PfTile icon="calendar" tone="green" size={30} />
                <span>Joining Date Confirmation</span>
              </span>
            }
          />
          <div style={{ padding: "16px 20px" }}>
            <PfBanner tone="yellow" icon="warning">
              <b style={{ fontWeight: 600 }}>Action Required:</b>
              <span style={{ fontWeight: 400 }}> Complete all pending formalities before you can confirm your joining date. Background verification must be completed first.</span>
            </PfBanner>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, marginTop: 12 }}>
              <ReadOnlyField label="Expected Joining Date" value="15/01/2026" mono />
              <ReadOnlyField label="Employee ID" value="Will be assigned after joining" muted />
            </div>
            <div style={{ marginTop: 14 }}>
              <PfBtn variant="primary" icon="check" onClick={() => undefined} style={{ opacity: .45, pointerEvents: "none" }}>
                Confirm Joining ({JOIN_PCT}% Complete)
              </PfBtn>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 8 }}>You need to complete 100% of formalities to confirm joining</div>
            </div>
          </div>
        </PfCard>

        {/* WHAT HAPPENS AFTER */}
        <TipsCard title="What happens after completion?" items={afterCompletion} />
      </div>
    </div>
  );
}

const PROFILE_FIELDS = [
  { l: "Full Name", v: CANDIDATE.name },
  // Only the phone rides mono — an email contains words, so the kit keeps it sans.
  { l: "Email", v: CANDIDATE_EMAIL },
  { l: "Phone", v: "+234 803 123 4567", mono: true },
  { l: "Location", v: "Lagos, Nigeria" },
];

function SettingsView({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(prefDefs.map((p) => [p.key, p.on])),
  );
  const [tab, setTab] = useState("profile");
  const prefsOn = Object.values(prefs).filter(Boolean).length;
  const tabs: PageTab[] = [
    { key: "profile", label: "Profile" },
    { key: "notifications", label: "Notifications", count: `${prefsOn}/${prefDefs.length}` },
    { key: "security", label: "Security" },
  ];

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 820, fontFamily: "var(--pf-font)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Settings</h1>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>Manage your account and preferences</div>
        </div>
      </div>

      {/* SECTION TABS */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs tabs={tabs} active={tab} onSelect={setTab} />
      </div>

      {tab === "profile" && (
        <PfCard>
          <PfCardHead title="Profile Information" sub="How employers see you across the portal.">
            <PfBtn small onClick={() => toast("Photo updated", "success")}>Change Photo</PfBtn>
          </PfCardHead>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfAvatar init={CANDIDATE.init} size={48} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>{CANDIDATE.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{CANDIDATE_ROLE}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12, padding: "16px 20px" }}>
            {PROFILE_FIELDS.map((f) => <ReadOnlyField key={f.l} label={f.l} value={f.v} mono={f.mono} />)}
          </div>
        </PfCard>
      )}

      {tab === "notifications" && (
        <PfCard>
          <PfCardHead title="Notification Preferences" sub={`${prefsOn} of ${prefDefs.length} channels are on.`} />
          {prefDefs.map((t, i) => (
            <div
              key={t.key}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderBottom: i === prefDefs.length - 1 ? "none" : "1px solid var(--pf-n50)" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{t.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>{t.sub}</div>
              </div>
              <Toggle on={!!prefs[t.key]} onClick={() => setPrefs((p) => ({ ...p, [t.key]: !p[t.key] }))} />
            </div>
          ))}
        </PfCard>
      )}

      {tab === "security" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <PfCard>
            <PfCardHead title="Security" sub="Keep your account protected." />
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Password</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>Last changed 3 months ago</div>
              </div>
              <PfBtn small onClick={() => toast("Password change requested", "default")}>Change</PfBtn>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 20px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Two-factor authentication</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1 }}>Add an extra layer of security</div>
              </div>
              <PfBtn small onClick={() => toast("Two-factor authentication enabled", "success")}>Enable</PfBtn>
            </div>
          </PfCard>

          <PfCard style={{ borderColor: "var(--pf-red-100)" }}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-.2px", color: "var(--pf-red-500)" }}>Danger Zone</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--pf-n500)", marginTop: 2, marginBottom: 12 }}>Permanently delete your account and all associated data.</div>
              <PfBtn small variant="danger" onClick={() => toast("Account deletion requested", "danger")}>Delete Account</PfBtn>
            </div>
          </PfCard>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────  SHELL  ───────────────────────────── */

type RailEntry = { key: CandNavName; icon: string; label: string; count?: string; filled?: boolean };

/** Live counts read off the same arrays the views render — never hand-typed. */
const RAIL_ITEMS: RailEntry[] = [
  { key: "Dashboard", icon: "house", label: "Dashboard" },
  { key: "My Applications", icon: "clipboard", label: "Applications", count: String(cAllApps.length) },
  { key: "Assessments", icon: "flask", label: "Assessments", count: String(cAssessments.filter((a) => a.isPending).length) },
  { key: "Interviews", icon: "calendar", label: "Interviews", count: String(cInterviews.filter((i) => i.isUpcoming).length) },
  { key: "Documents", icon: "file", label: "Documents", count: String(cDocuments.filter((d) => d.isMissing).length) },
  { key: "Offers", icon: "wallet", label: "Offers", count: "1", filled: true },
  { key: "Joining", icon: "stack", label: "Joining" },
];

function RailItem({ it, active, onClick }: { it: RailEntry; active: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onClick} title={it.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", padding: "2px 0", width: "100%" }}>
      <span style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "transparent", transition: "background .15s ease" }}>
        <Ic name={it.icon} size={19} color={active ? "#fff" : "var(--pf-n500)"} />
        {it.count && (
          <span style={{ position: "absolute", top: -3, right: -7, minWidth: 18, height: 17, borderRadius: 9, background: it.filled ? "var(--pf-primary-500)" : "var(--pf-n0)", color: it.filled ? "#fff" : "var(--pf-n500)", border: it.filled ? "2px solid #FBFCFD" : "1px solid var(--pf-n100)", fontSize: 9.5, fontWeight: 600, fontFamily: "var(--mono)", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{it.count}</span>
        )}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 500, color: active ? "var(--pf-n900)" : "var(--pf-n400)", lineHeight: 1.15, textAlign: "center", maxWidth: 76, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
    </div>
  );
}

function CandidateRail({ nav, setNav }: { nav: CandNavName; setNav: (n: CandNavName) => void }) {
  const go = useGo();
  return (
    <aside style={{ width: 88, flex: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 6px 12px", background: "#FBFCFD", borderRight: "1px solid var(--pf-n50)", height: "100%", fontFamily: "var(--pf-font)" }}>
      <span
        onClick={() => setNav("Dashboard")}
        title="Hirebrew · Candidate Portal"
        style={{ width: 42, height: 42, borderRadius: 13, background: "var(--pf-primary-500)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: 6, boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.25)" }}
      >
        <Ic name="sparkle" size={20} color="#fff" weight={2} />
      </span>
      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n300)", marginBottom: 10 }}>MY HIRING</span>

      <nav className="no-scrollbar" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "center", flex: 1, overflowY: "auto", paddingBottom: 8, scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {RAIL_ITEMS.map((it) => (
          <RailItem key={it.key} it={it} active={nav === it.key} onClick={() => setNav(it.key)} />
        ))}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 9, width: "100%", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
        <RailItem it={{ key: "Settings", icon: "gear", label: "Settings" }} active={nav === "Settings"} onClick={() => setNav("Settings")} />
        <RailItem it={{ key: "Settings", icon: "door", label: "Logout" }} active={false} onClick={() => go("signin")} />
        <div onClick={() => go("signin")} title={`${CANDIDATE.name} · Candidate — sign out`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", paddingTop: 2 }}>
          <span style={{ width: 36, height: 36, borderRadius: "50%", background: `${CANDIDATE.tone}1A`, color: CANDIDATE.tone, border: `2px solid ${CANDIDATE.tone}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{CANDIDATE.init}</span>
          <span style={{ fontSize: 9.5, fontWeight: 500, color: "var(--pf-n400)" }}>{CANDIDATE_FIRST}</span>
        </div>
      </div>
    </aside>
  );
}

function CandidateTopbar({ nav, setNav }: { nav: CandNavName; setNav: (n: CandNavName) => void }) {
  const toast = useToast();
  const search = useHover();
  const bell = useHover();
  const help = useHover();
  return (
    <header style={{ height: 60, flex: "none", background: "var(--pf-n0)", borderBottom: "1px solid var(--pf-n50)", display: "flex", alignItems: "center", gap: 12, padding: "0 24px", fontFamily: "var(--pf-font)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, minWidth: 0 }}>
        <span style={{ color: "var(--pf-n300)", fontWeight: 500 }}>Candidate portal</span>
        <span style={{ color: "var(--pf-n300)" }}>/</span>
        <span style={{ color: "var(--pf-n600)", fontWeight: 500, whiteSpace: "nowrap" }}>{nav}</span>
        <span style={{ width: 1, height: 16, background: "var(--pf-n50)", margin: "0 6px" }} />
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n600)", whiteSpace: "nowrap" }}>{headerSub[nav]}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n400)", background: "var(--pf-n25)", border: "0.6px solid var(--pf-n100)", padding: "1px 6px", borderRadius: 4 }}>{CANDIDATE.init}-2025</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 500, color: "var(--pf-primary-500)", background: "var(--pf-primary-50)", border: "0.6px solid var(--pf-primary-100)", padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pf-primary-500)" }} />
          Assessment
        </span>
      </div>

      <span style={{ flex: 1 }} />

      <div
        {...search.hoverProps}
        onClick={() => setNav("My Applications")}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: `1px solid ${search.hovered ? "var(--pf-n300)" : "var(--pf-n100)"}`, borderRadius: 9, padding: "7px 12px", width: 230, cursor: "pointer" }}
      >
        <Ic name="search" size={14} color="var(--pf-n400)" />
        <span style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n400)", whiteSpace: "nowrap", overflow: "hidden" }}>Search applications, roles…</span>
      </div>

      <button
        {...help.hoverProps}
        onClick={() => toast("Support request sent — the recruiting team will reply by email", "default")}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "7px 12px", borderRadius: 8, cursor: "pointer", background: "var(--pf-n0)", color: "var(--pf-n600)", border: `1px solid ${help.hovered ? "var(--pf-n300)" : "var(--pf-n50)"}`, boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)" }}
      >
        <Ic name="lifebuoy" size={14} color="var(--pf-n500)" /> Help
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 11px", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)" }}>
        <Ic name="calendar" size={15} color="var(--pf-n400)" />
        22/11/2025
      </div>

      <div
        {...bell.hoverProps}
        onClick={() => toast("No new notifications", "default")}
        style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--pf-n100)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", background: bell.hovered ? "var(--pf-n25)" : undefined }}
      >
        <Ic name="bell" size={16} color="var(--pf-n500)" />
        <span style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: "var(--pf-red-500)", border: "1.5px solid #fff" }} />
      </div>
    </header>
  );
}

/* ─────────────────────────────  ROOT  ───────────────────────────── */

export default function CandidatePortal() {
  const toast = useToast();
  // Standalone route: `nav` is deliberately local state — the portal does not
  // sync section to the URL the way the recruit shell's `go()` router does.
  const [nav, setNav] = useState<CandNavName>("Dashboard");

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "var(--pf-n25)", color: "var(--pf-n900)", fontSize: 14, fontFamily: "var(--pf-font)", WebkitFontSmoothing: "antialiased" }}>
      <CandidateRail nav={nav} setNav={setNav} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
        <CandidateTopbar nav={nav} setNav={setNav} />

        <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          {nav === "Dashboard" && <DashboardView setNav={setNav} toast={toast} />}
          {nav === "My Applications" && <ApplicationsView toast={toast} />}
          {nav === "Assessments" && <AssessmentsView toast={toast} />}
          {nav === "Interviews" && <InterviewsView toast={toast} />}
          {nav === "Documents" && <DocumentsView toast={toast} />}
          {nav === "Offers" && <OffersView toast={toast} />}
          {nav === "Joining" && <JoiningView toast={toast} />}
          {nav === "Settings" && <SettingsView toast={toast} />}
        </main>
      </div>
    </div>
  );
}

