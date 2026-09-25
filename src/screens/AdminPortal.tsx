"use client";
import { useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

/* ============================ DATA (inlined bindings) ============================ */

type NavName =
  | "Dashboard"
  | "User Management"
  | "RBAC Permissions"
  | "Assessment Config"
  | "Interview Config"
  | "Global Settings";

const NAV_ITEMS: { label: NavName; icon: React.ReactNode }[] = [
  {
    label: "Dashboard",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    label: "User Management",
    icon: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
        <circle cx="18" cy="8" r="2" />
      </>
    ),
  },
  {
    label: "RBAC Permissions",
    icon: <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />,
  },
  {
    label: "Assessment Config",
    icon: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
  },
  {
    label: "Interview Config",
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    label: "Global Settings",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

const HEADER_SUB: Record<NavName, string> = {
  Dashboard: "System overview and activity",
  "User Management": "Manage platform users and access",
  "RBAC Permissions": "Role-based access control",
  "Assessment Config": "Configure assessment templates",
  "Interview Config": "Configure interview stages",
  "Global Settings": "Platform-wide configuration",
};

const adminKpis = [
  { label: "Total Users", value: "248", delta: "+12 this month", color: "#16B364", bg: "#ECF9F3" },
  { label: "Active Roles", value: "6", delta: "RBAC configured", color: "#AF52DE", bg: "#F7EEFC" },
  { label: "Assessments", value: "18", delta: "4 templates", color: "#EBA308", bg: "#FEF7E6" },
  { label: "Interviews Today", value: "9", delta: "3 pending", color: "#16B364", bg: "#ECF9F3" },
];

const adminActivity = [
  { who: "Tobi Balogun", init: "TB", tone: "#AF52DE", action: "updated the Senior Designer scorecard", time: "12 min ago" },
  { who: "Samuel Omosehin", init: "SO", tone: "#16B364", action: "added a new Recruiter user", time: "1 hr ago" },
  { who: "System", init: "AI", tone: "#9741CE", action: "screened 47 applicants for SPD-2026", time: "2 hrs ago" },
  { who: "Kemi Salami", init: "KS", tone: "#16B364", action: "approved requisition REQ-0441", time: "4 hrs ago" },
];

const aUserKpis = [
  { label: "Total Users", value: "1,247", color: "#16B364", bg: "#ECF9F3" },
  { label: "Active Users", value: "1,189", color: "#16B364", bg: "#ECF9F3" },
  { label: "Admins", value: "42", color: "#AF52DE", bg: "#F7EEFC" },
  { label: "Hiring Managers", value: "287", color: "#EBA308", bg: "#FEF7E6" },
];

type StatusKey = "Active" | "Inactive" | "Invited" | "Suspended";
const STATUS_MAP: Record<StatusKey, [string, string]> = {
  Active: ["#129152", "#ECF9F3"],
  Inactive: ["#475569", "#F1F5F9"],
  Invited: ["#B87F06", "#FEF7E6"],
  Suspended: ["#C21A14", "#FDE8E8"],
};

const adminUsersRaw: {
  name: string; email: string; init: string; tone: string; phone: string;
  role: string; roleColor: string; roleBg: string; tenant: string; status: StatusKey; last: string;
}[] = [
  { name: "Tobi Balogun", email: "tobi@hirebrew.com", init: "TB", tone: "#16B364", phone: "+234 802 345 6710", role: "Hiring Manager", roleColor: "#16B364", roleBg: "#ECF9F3", tenant: "Hirebrew HQ", status: "Active", last: "2 hours ago" },
  { name: "Ngozi Adeyemi", email: "ngozi@hirebrew.com", init: "NA", tone: "#16B364", phone: "+234 802 345 6711", role: "Recruiter", roleColor: "#16B364", roleBg: "#ECF9F3", tenant: "Hirebrew HQ", status: "Active", last: "1 day ago" },
  { name: "Emeka Obi", email: "emeka@cloudtech.ng", init: "EO", tone: "#16B364", phone: "+234 803 211 4422", role: "Admin", roleColor: "#AF52DE", roleBg: "#F7EEFC", tenant: "CloudTech NG", status: "Active", last: "5 hours ago" },
  { name: "Aisha Bello", email: "aisha@cloudtech.ng", init: "AB", tone: "#16B364", phone: "+234 803 211 4423", role: "Hiring Manager", roleColor: "#16B364", roleBg: "#ECF9F3", tenant: "CloudTech NG", status: "Inactive", last: "30 days ago" },
  { name: "Chinedu Eze", email: "chinedu@innovate.ng", init: "CE", tone: "#AF52DE", phone: "+234 805 778 9014", role: "Recruiter", roleColor: "#16B364", roleBg: "#ECF9F3", tenant: "InnovateSoft", status: "Active", last: "3 hours ago" },
  { name: "Funke Adebayo", email: "funke@innovate.ng", init: "FA", tone: "#EBA308", phone: "+234 805 778 9015", role: "Viewer", roleColor: "#475569", roleBg: "#F1F5F9", tenant: "InnovateSoft", status: "Active", last: "6 hours ago" },
];

const adminUsers = adminUsersRaw.map((u, idx) => ({
  ...u,
  idx,
  sColor: STATUS_MAP[u.status][0],
  sBg: STATUS_MAP[u.status][1],
}));

const aUserActivity = [
  { action: "Logged in", time: "2 hours ago" },
  { action: "Updated job posting", time: "5 hours ago" },
  { action: "Scheduled interview", time: "1 day ago" },
  { action: "Reviewed candidate", time: "2 days ago" },
];

const PERM_MAP: Record<string, [string, string]> = {
  Create: ["#16B364", "#ECF9F3"],
  View: ["#16B364", "#ECF9F3"],
  Edit: ["#EBA308", "#FEF7E6"],
  Approve: ["#AF52DE", "#F7EEFC"],
};

const rbacRoles = [
  { role: "Super Admin", users: "3 users", perms: ["Create", "View", "Edit", "Approve"] },
  { role: "Tenant Admin", users: "8 users", perms: ["Create", "View", "Edit", "Approve"] },
  { role: "Hiring Manager", users: "25 users", perms: ["Create", "View", "Edit"] },
  { role: "Recruiter", users: "45 users", perms: ["Create", "View"] },
  { role: "Finance", users: "5 users", perms: ["View", "Approve"] },
  { role: "HRBP", users: "12 users", perms: ["Create", "View", "Edit"] },
].map((r) => ({
  ...r,
  permChips: r.perms.map((p) => ({ label: p, color: PERM_MAP[p][0], bg: PERM_MAP[p][1] })),
}));

const rbacMatrixCols = ["Create", "View", "Edit", "Approve"];
const rbacMatrix = [
  { role: "Super Admin", vals: [true, true, true, true] },
  { role: "Tenant Admin", vals: [true, true, true, true] },
  { role: "Hiring Manager", vals: [true, true, true, false] },
  { role: "Recruiter", vals: [true, true, false, false] },
  { role: "Finance", vals: [false, true, false, true] },
  { role: "HRBP", vals: [true, true, true, false] },
];

const rbacAudit = [
  { name: "Aisha Bello", ip: "192.168.1.45", action: "Created new tenant: Acme Corp", time: "2025-11-18 14:30:25" },
  { name: "Emeka Obi", ip: "192.168.1.52", action: "Updated role permissions: Recruiter", time: "2025-11-18 13:15:10" },
  { name: "Funke Adebayo", ip: "192.168.1.67", action: "Deleted user: john.doe@example.com", time: "2025-11-18 11:45:33" },
  { name: "Yusuf Lawal", ip: "192.168.1.88", action: "Modified API key: SAP Integration", time: "2025-11-18 10:22:18" },
];

const rbacEmails = ["Candidate Invite", "Assessment Link", "Interview Schedule", "Offer Letter", "Rejection Notice"];

const rbacIntegrations = [
  { name: "SAP SuccessFactors", status: "Connected" },
  { name: "ATS System", status: "Connected" },
  { name: "HRMS", status: "Pending" },
  { name: "Slack", status: "Connected" },
].map((i) => ({
  ...i,
  sColor: i.status === "Connected" ? "#129152" : "#B87F06",
  sBg: i.status === "Connected" ? "#ECF9F3" : "#FEF7E6",
}));

const assessKpis = [
  { label: "Total Assessments", value: "18", kind: "clip", color: "#16B364", bg: "#ECF9F3" },
  { label: "Active Tests", value: "12", kind: "target", color: "#16B364", bg: "#ECF9F3" },
  { label: "Question Bank", value: "342", kind: "book", color: "#AF52DE", bg: "#F7EEFC" },
  { label: "Avg Completion", value: "87%", kind: "gear", color: "#EBA308", bg: "#FEF7E6" },
];

const assessTabs = ["Assessment List", "Create Assessment", "Question Bank", "Settings"] as const;
type AssessTab = (typeof assessTabs)[number];

const adminAssessRaw = [
  { title: "Technical (MCQ)", meta: "25 questions · 60 min · Pass 70%", on: true },
  { title: "Coding Challenge", meta: "5 problems · 90 min · Pass 60%", on: true },
  { title: "Psychometric", meta: "40 questions · 45 min · No cutoff", on: true },
  { title: "Take-home Assignment", meta: "3 day window · Manual review", on: false },
];

const assessBank = [
  { cat: "JavaScript", count: "68 questions", color: "#EBA308", bg: "#FEF7E6" },
  { cat: "React", count: "54 questions", color: "#16B364", bg: "#ECF9F3" },
  { cat: "System Design", count: "41 questions", color: "#AF52DE", bg: "#F7EEFC" },
  { cat: "Data Structures", count: "73 questions", color: "#16B364", bg: "#ECF9F3" },
  { cat: "Behavioral", count: "58 questions", color: "#C21A14", bg: "#FDE8E8" },
  { cat: "SQL & Databases", count: "48 questions", color: "#475569", bg: "#F1F5F9" },
];

const intKpis = [
  { label: "Interview Rounds", value: "8", kind: "chat", color: "#16B364", bg: "#ECF9F3" },
  { label: "Scheduled Today", value: "12", kind: "cal", color: "#16B364", bg: "#ECF9F3" },
  { label: "Active Interviewers", value: "24", kind: "users", color: "#AF52DE", bg: "#F7EEFC" },
  { label: "Pending Feedback", value: "7", kind: "alert", color: "#EBA308", bg: "#FEF7E6" },
];

const intTabs = ["Interview Rounds", "Schedule", "Feedback", "Create Round"] as const;
type IntTab = (typeof intTabs)[number];

const intRounds = [
  { name: "HR Round", type: "HR", typeColor: "#16B364", dur: "30 min", people: "Ngozi Adeyemi, Funke Adebayo" },
  { name: "Technical Round 1", type: "Technical", typeColor: "#16B364", dur: "60 min", people: "Tobi Balogun, Emeka Obi" },
  { name: "Technical Round 2", type: "Technical", typeColor: "#16B364", dur: "60 min", people: "Chinedu Eze, Aisha Bello" },
  { name: "Managerial Round", type: "Managerial", typeColor: "#16B364", dur: "45 min", people: "Yusuf Lawal, Kemi Salami" },
];

const intScheduled = [
  { name: "Adaeze Nwosu", role: "Senior Full Stack Developer", round: "Technical Round 1", date: "Nov 20, 2025", time: "10:00 AM", interviewer: "Tobi Balogun" },
  { name: "Ngozi Adeyemi", role: "DevOps Engineer", round: "HR Round", date: "Nov 20, 2025", time: "2:00 PM", interviewer: "Funke Adebayo" },
  { name: "Emeka Obi", role: "Backend Engineer", round: "Technical Round 2", date: "Nov 21, 2025", time: "11:30 AM", interviewer: "Chinedu Eze" },
];

const intPending = [
  { name: "Aisha Bello", role: "UI/UX Designer - Technical Round 1", meta: "Interviewed by: Chinedu Eze on Nov 18, 2025" },
  { name: "Tobi Balogun", role: "Senior Full Stack Developer - HR Round", meta: "Interviewed by: Ngozi Adeyemi on Nov 17, 2025" },
];

const feedSkills = [
  { label: "Technical Skills", ph: "Rate technical skills" },
  { label: "Communication", ph: "Rate communication" },
  { label: "Problem Solving", ph: "Rate problem solving" },
  { label: "Cultural Fit", ph: "Rate cultural fit" },
];

const adminGlobal = [
  { label: "Organization Name", value: "Hirebrew" },
  { label: "Data Region", value: "Lagos · af-west-1 (NDPR)" },
  { label: "Default Language", value: "English (UK)" },
  { label: "Time Zone", value: "WAT (UTC+1)" },
];

/* ============================ SMALL HELPERS ============================ */

const Svg = ({
  size = 20,
  stroke = "currentColor",
  sw = 2,
  children,
}: {
  size?: number;
  stroke?: string;
  sw?: number;
  children: React.ReactNode;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

/** A pill toggle switch. */
function Toggle({
  on,
  onClick,
  w = 40,
  h = 23,
  knob = 19,
  onBg = "#129152",
}: {
  on: boolean;
  onClick: () => void;
  w?: number;
  h?: number;
  knob?: number;
  onBg?: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{ width: w, height: h, borderRadius: 5, cursor: "pointer", flex: "none", position: "relative", background: on ? onBg : "#CBD5E1" }}
    >
      <div style={{ position: "absolute", top: 2, left: on ? w - knob - 2 : 2, width: knob, height: knob, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

function NavRow({
  item,
  active,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 13px",
        borderRadius: 10,
        cursor: "pointer",
        background: active ? "#129152" : "transparent",
        color: active ? "#fff" : "var(--ink2)",
        boxShadow: active ? "0 2px 8px rgba(20,58,140,.25)" : undefined,
      }}
    >
      <Svg size={18} stroke={active ? "#fff" : "#64748B"}>{item.icon}</Svg>
      <span style={{ fontSize: 13.5, fontWeight: active ? 700 : 600 }}>{item.label}</span>
    </div>
  );
}

/** A grid/flex row card with a hover background. */
function RowCard({ children, hoverBg = "#FBFCFD", style }: { children: React.ReactNode; hoverBg?: string; style: React.CSSProperties }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} style={{ ...style, background: hovered ? hoverBg : style.background }}>
      {children}
    </div>
  );
}

const kpiIcon = (kind: string) => {
  switch (kind) {
    case "clip":
      return (
        <>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
      );
    case "gear":
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
      );
    case "chat":
      return <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
    case "cal":
      return (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </>
      );
    case "users":
      return (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case "alert":
    default:
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </>
      );
  }
};

const headerIconBtn: React.CSSProperties = { width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", color: "var(--ink2)" };
const sectionCard: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "22px 24px" };
const sectionIcon: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, background: "#129152", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" };
const primaryBtn: React.CSSProperties = { background: "#129152", color: "#fff", fontWeight: 600, fontSize: 13, padding: "11px 20px", borderRadius: 8, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontWeight: 600, fontSize: 13, padding: "11px 20px", borderRadius: 8, cursor: "pointer" };
const fieldBox: React.CSSProperties = { fontSize: 13, color: "var(--ink3)", background: "#F8FAFC", borderRadius: 8, padding: "12px 14px" };
const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 7 };
const caret = (
  <Svg size={14} stroke="#64748B" sw={2.2}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

/* ============================ MAIN COMPONENT ============================ */

export default function AdminPortal() {
  const go = useGo();
  const toast = useToast();

  const [nav, setNav] = useState<NavName>("Dashboard");
  const [activeUser, setActiveUser] = useState<number | null>(null);
  const [assessTab, setAssessTab] = useState<AssessTab>("Settings");
  const [intTab, setIntTab] = useState<IntTab>("Interview Rounds");
  const [feedRating, setFeedRating] = useState(0);

  // Toggle groups
  const [assessGlobal, setAssessGlobal] = useState({ proctoring: false, plagiarism: true, emails: true });
  const [rbacEng, setRbacEng] = useState({ autograde: true, plagiarism: true, proctoring: false });
  const [gset, setGset] = useState({ sso: true, mfa: true, audit: true, retention: false });
  const [assessRows, setAssessRows] = useState(adminAssessRaw.map((a) => a.on));

  const goSignin = () => go("signin");

  /* ----- ADMIN DASHBOARD ----- */
  const renderDashboard = () => (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {adminKpis.map((k) => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Svg size={20}>
                  <circle cx="9" cy="7" r="3" />
                  <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
                </Svg>
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 13, color: "var(--ink2)", fontWeight: 600, marginTop: 6 }}>{k.label}</div>
            <div style={{ fontSize: 11.5, color: "var(--ink3)", marginTop: 3 }}>{k.delta}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={sectionCard}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Recent Activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {adminActivity.map((a) => (
              <div key={a.who + a.time} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 0", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: a.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 11, flex: "none" }}>{a.init}</div>
                <div style={{ flex: 1, fontSize: 13.5, color: "var(--ink2)" }}>
                  <b style={{ color: "var(--ink)" }}>{a.who}</b> {a.action}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink3)", whiteSpace: "nowrap" }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={sectionCard}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>System Health</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Uptime", val: "99.98%", w: "99%", c: "#16B364", valColor: "#129152" },
              { label: "API usage", val: "84%", w: "84%", c: "#16B364", valColor: "var(--ink)" },
              { label: "Storage", val: "42%", w: "42%", c: "#AF52DE", valColor: "var(--ink)" },
            ].map((m) => (
              <div key={m.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
                  <span style={{ color: "var(--ink2)", fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: m.valColor }}>{m.val}</span>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "#F1F5F9", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: m.w, background: m.c, borderRadius: 5 }} />
                </div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6, borderTop: "1px solid var(--border2)", fontSize: 12.5, fontWeight: 600, color: "#129152" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16B364" }} />
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </>
  );

  /* ----- USER MANAGEMENT ----- */
  const renderUsers = () => {
    if (activeUser != null) {
      const u = adminUsers[activeUser];
      return (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
            <div>
              <div onClick={() => setActiveUser(null)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink3)", cursor: "pointer", marginBottom: 12 }}>
                <Svg size={15} sw={2.2}><path d="M15 18l-6-6 6-6" /></Svg>
                Back
              </div>
              <h1 style={{ margin: "0 0 3px", fontSize: 23, fontWeight: 700, letterSpacing: "-.4px" }}>{u.name}</h1>
              <div style={{ fontSize: 13.5, color: "var(--ink3)" }}>{u.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
              <div onClick={() => toast("Editing…")} style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", border: "1px solid var(--border)", padding: "10px 18px", borderRadius: 10, cursor: "pointer" }}>Edit User</div>
              <div onClick={() => toast("User deactivated", "danger")} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: "#C21A14", padding: "10px 18px", borderRadius: 10, cursor: "pointer" }}>Deactivate User</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 18, alignItems: "start" }}>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>User Information</div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 4 }}>Full Name</div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{u.name}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 4 }}>Email</div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{u.email}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 4 }}>Phone</div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{u.phone}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 6 }}>Role</div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: u.roleColor, background: u.roleBg, padding: "4px 12px", borderRadius: 5 }}>{u.role}</span>
              </div>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 6 }}>Status</div>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: u.sColor, background: u.sBg, padding: "4px 12px", borderRadius: 5 }}>{u.status}</span>
              </div>
            </div>
            <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px" }}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 18 }}>Activity Log</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {aUserActivity.map((a) => (
                  <div key={a.action} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 11, padding: "15px 18px" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{a.action}</span>
                    <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-.4px" }}>User Management</h1>
            <div style={{ fontSize: 13.5, color: "var(--ink3)" }}>Manage users across all tenants</div>
          </div>
          <div onClick={() => toast("Invitation sent", "success")} style={{ display: "flex", alignItems: "center", gap: 8, background: "#129152", color: "#fff", fontWeight: 600, fontSize: 13, padding: "11px 17px", borderRadius: 10, cursor: "pointer", flex: "none" }}>
            <Svg size={15} stroke="#fff" sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
            Add New User
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          {aUserKpis.map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--ink3)", fontWeight: 600, marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1 }}>{k.value}</div>
              </div>
              <span style={{ width: 42, height: 42, borderRadius: 11, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Svg size={20}>
                  <circle cx="9" cy="7" r="3" />
                  <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
                  <circle cx="18" cy="8" r="2" />
                </Svg>
              </span>
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px", marginBottom: 18, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px", flex: 1, minWidth: 240 }}>
            <Svg size={15} stroke="#94A3B8"><circle cx="11" cy="11" r="7" /><path d="M21 21l-3.5-3.5" /></Svg>
            <span style={{ fontSize: 13, color: "var(--ink3)" }}>Search users by name, email, or phone…</span>
          </div>
          {["All Tenants", "All Roles", "All Status"].map((f, idx) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "var(--ink2)", fontWeight: 600, minWidth: [150, 130, 120][idx] }}>
              <span style={{ flex: 1 }}>{f}</span>
              {caret}
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1.3fr 1fr 1.1fr 0.8fr 0.9fr 0.9fr", gap: 14, padding: "14px 22px", borderBottom: "1px solid var(--border2)", fontSize: 11, fontWeight: 700, letterSpacing: ".3px", color: "var(--ink3)" }}>
            <div>USER</div><div>CONTACT</div><div>ROLE</div><div>TENANT</div><div>STATUS</div><div>LAST LOGIN</div><div>ACTIONS</div>
          </div>
          {adminUsers.map((u) => (
            <RowCard key={u.email} style={{ display: "grid", gridTemplateColumns: "1.8fr 1.3fr 1fr 1.1fr 0.8fr 0.9fr 0.9fr", gap: 14, padding: "15px 22px", borderBottom: "1px solid var(--border2)", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: u.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flex: "none" }}>{u.init}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{u.phone}</div>
              <div><span style={{ fontSize: 11.5, fontWeight: 600, color: u.roleColor, background: u.roleBg, padding: "4px 11px", borderRadius: 5 }}>{u.role}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>{u.tenant}</div>
              <div><span style={{ fontSize: 11.5, fontWeight: 600, color: u.sColor, background: u.sBg, padding: "4px 11px", borderRadius: 5 }}>{u.status}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{u.last}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span onClick={() => setActiveUser(u.idx)} style={{ cursor: "pointer", color: "var(--ink3)" }}>
                  <Svg size={17}><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></Svg>
                </span>
                <span onClick={() => toast("Editing…")} style={{ cursor: "pointer", color: "var(--ink3)" }}>
                  <Svg size={16}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>
                </span>
                <span onClick={() => toast("User deactivated", "danger")} style={{ cursor: "pointer", color: "#C21A14" }}>
                  <Svg size={16}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Svg>
                </span>
              </div>
            </RowCard>
          ))}
        </div>
      </>
    );
  };

  /* ----- RBAC PERMISSIONS ----- */
  const renderRbac = () => {
    const rbacEngList = [
      { key: "autograde" as const, label: "Auto-grading", sub: "Automatically grade MCQ assessments" },
      { key: "plagiarism" as const, label: "Code Plagiarism Detection", sub: "Check for copied code in assessments" },
      { key: "proctoring" as const, label: "Proctoring Integration", sub: "Enable camera monitoring" },
    ];
    return (
      <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start", marginBottom: 18 }}>
          {/* USER ROLES */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <span style={sectionIcon}><Svg size={19} stroke="#fff"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></Svg></span>
                <div style={{ fontWeight: 700, fontSize: 16 }}>User Roles</div>
              </div>
              <div onClick={() => toast("Invitation sent", "success")} style={{ display: "flex", alignItems: "center", gap: 7, background: "#129152", color: "#fff", fontWeight: 600, fontSize: 12.5, padding: "9px 15px", borderRadius: 8, cursor: "pointer" }}>
                <Svg size={14} stroke="#fff" sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
                Add Role
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rbacRoles.map((r) => (
                <div key={r.role} style={{ border: "1px solid var(--border2)", borderRadius: 12, padding: "15px 17px", background: "#FBFCFD" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{r.role}</div>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", background: "#F1F5F9", padding: "3px 11px", borderRadius: 5 }}>{r.users}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {r.permChips.map((p) => (
                      <span key={p.label} style={{ fontSize: 11.5, fontWeight: 600, color: p.color, background: p.bg, padding: "4px 12px", borderRadius: 7 }}>{p.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* PERMISSIONS MATRIX */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Svg></span>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Permissions Matrix</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr repeat(4,1fr)", gap: 8, padding: "0 4px 12px", borderBottom: "1px solid var(--border2)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink2)" }}>Role</div>
              {rbacMatrixCols.map((c) => (
                <div key={c} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink2)", textAlign: "center" }}>{c}</div>
              ))}
            </div>
            {rbacMatrix.map((r) => (
              <div key={r.role} style={{ display: "grid", gridTemplateColumns: "1.6fr repeat(4,1fr)", gap: 8, padding: "13px 4px", borderBottom: "1px solid var(--border2)", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.role}</div>
                {r.vals.map((v, ci) => (
                  <div key={ci} style={{ display: "flex", justifyContent: "center" }}>
                    {v ? (
                      <Svg size={19} stroke="#16B364"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Svg>
                    ) : (
                      <Svg size={19} stroke="#CBD5E1"><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></Svg>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* AUDIT LOGS */}
        <div style={{ ...sectionCard, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
            <span style={sectionIcon}><Svg size={19} stroke="#fff"><path d="M3 12h4l2 6 4-12 2 6h6" /></Svg></span>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Audit Logs</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rbacAudit.map((a) => (
              <div key={a.time} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, border: "1px solid var(--border2)", borderRadius: 12, padding: "15px 18px", background: "#FBFCFD" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "#16B364", background: "#ECF9F3", padding: "2px 9px", borderRadius: 6 }}>{a.ip}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink2)" }}>{a.action}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink3)", whiteSpace: "nowrap", flex: "none" }}>
                  <Svg size={14} stroke="#64748B"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
                  {a.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start", marginBottom: 18 }}>
          {/* ASSESSMENT ENGINE SETTINGS */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff">{kpiIcon("gear")}</Svg></span>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Assessment Engine Settings</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rbacEngList.map((t) => (
                <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 12, padding: "15px 17px", background: "#FBFCFD", border: "1px solid var(--border2)" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{t.sub}</div>
                  </div>
                  <Toggle on={rbacEng[t.key]} onClick={() => setRbacEng((s) => ({ ...s, [t.key]: !s[t.key] }))} w={42} h={24} knob={20} onBg="#020617" />
                </div>
              ))}
            </div>
          </div>
          {/* EMAIL TEMPLATES */}
          <div style={sectionCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Svg></span>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Email Templates</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {rbacEmails.map((e) => (
                <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "15px 17px", background: "#FBFCFD", border: "1px solid var(--border2)" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{e}</span>
                  <span onClick={() => toast("Editing…")} style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink2)" }}>
                    <Svg size={15}><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></Svg>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* API KEYS / INTEGRATIONS */}
        <div style={{ ...sectionCard, maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
            <span style={sectionIcon}><Svg size={19} stroke="#fff"><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.5 12.5L20 3M16 7l3 3M13 10l3 3" /></Svg></span>
            <div style={{ fontWeight: 700, fontSize: 16 }}>API Keys / Integrations</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rbacIntegrations.map((i) => (
              <div key={i.name} style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 12, padding: "15px 17px", background: "#FBFCFD", border: "1px solid var(--border2)" }}>
                <span style={{ width: 36, height: 36, borderRadius: 8, background: "#ECF9F3", color: "#16B364", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <Svg size={18}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></Svg>
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>{i.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: i.sColor, background: i.sBg, padding: "3px 10px", borderRadius: 5 }}>{i.status}</span>
                </div>
                <div onClick={() => toast("Editing…")} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink2)", border: "1px solid var(--border)", background: "#fff", padding: "9px 16px", borderRadius: 8, cursor: "pointer" }}>Configure</div>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  };

  /* ----- ASSESSMENT CONFIG ----- */
  const renderAssess = () => {
    const assessToggles = [
      { key: "proctoring" as const, label: "Enable Proctoring", sub: "Camera and screen monitoring during assessments" },
      { key: "plagiarism" as const, label: "AI-Based Plagiarism Detection", sub: "Detect code similarity and plagiarism" },
      { key: "emails" as const, label: "Email Notifications", sub: "Send assessment results to candidates" },
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
          {assessKpis.map((k) => (
            <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 7 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1 }}>{k.value}</div>
              </div>
              <span style={{ width: 44, height: 44, borderRadius: 11, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <Svg size={21}>{kpiIcon(k.kind)}</Svg>
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "inline-flex", gap: 6, background: "#F1F5F9", borderRadius: 11, padding: 5, width: "max-content" }}>
          {assessTabs.map((t) => {
            const active = assessTab === t;
            return (
              <div key={t} onClick={() => setAssessTab(t)} style={{ fontSize: 13.5, fontWeight: 600, padding: "10px 16px", cursor: "pointer", borderRadius: 8, ...(active ? { background: "#fff", color: "#020617", boxShadow: "0 1px 3px rgba(0,0,0,.1)", border: "1px solid var(--border)" } : { background: "transparent", color: "var(--ink3)", border: "1px solid transparent" }) }}>{t}</div>
            );
          })}
        </div>

        {assessTab === "Assessment List" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13, maxWidth: 880 }}>
            {adminAssessRaw.map((a, i) => (
              <div key={a.title} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px", display: "flex", alignItems: "center", gap: 15 }}>
                <span style={{ width: 42, height: 42, borderRadius: 11, background: "#F7EEFC", color: "#AF52DE", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <Svg size={20}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Svg>
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{a.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{a.meta}</div>
                </div>
                <div onClick={() => toast("Editing…")} style={{ fontSize: 12.5, fontWeight: 600, color: "#16B364", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>Edit</div>
                <Toggle on={assessRows[i]} onClick={() => setAssessRows((s) => s.map((v, j) => (j === i ? !v : v)))} w={40} h={23} knob={19} onBg="#129152" />
              </div>
            ))}
          </div>
        )}

        {assessTab === "Create Assessment" && (
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px", maxWidth: 880 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>New Assessment</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              <div><div style={fieldLabel}>Assessment Title</div><div style={fieldBox}>e.g. Frontend Engineer — Technical</div></div>
              <div><div style={fieldLabel}>Assessment Type</div><div style={{ ...fieldBox, color: "var(--ink2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>MCQ {caret}</div></div>
              <div><div style={fieldLabel}>Duration (min)</div><div style={fieldBox}>60</div></div>
              <div><div style={fieldLabel}>Cutoff Score (%)</div><div style={fieldBox}>70</div></div>
            </div>
            <div style={fieldLabel}>Linked Role</div>
            <div style={{ ...fieldBox, color: "var(--ink2)", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>Senior Product Designer {caret}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <div onClick={() => toast("Settings saved", "success")} style={primaryBtn}>Create Assessment</div>
              <div onClick={() => setAssessTab("Assessment List")} style={ghostBtn}>Cancel</div>
            </div>
          </div>
        )}

        {assessTab === "Question Bank" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, maxWidth: 880 }}>
            {assessBank.map((b) => (
              <div key={b.cat} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
                <span style={{ display: "inline-flex", width: 38, height: 38, borderRadius: 10, background: b.bg, color: b.color, alignItems: "center", justifyContent: "center", marginBottom: 13 }}>
                  <Svg size={19}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Svg>
                </span>
                <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>{b.cat}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{b.count}</div>
              </div>
            ))}
          </div>
        )}

        {assessTab === "Settings" && (
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "26px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 24 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff">{kpiIcon("gear")}</Svg></span>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Global Assessment Settings</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Default Settings</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 28 }}>
              <div><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Default Assessment Duration</div><div style={{ fontSize: 14, color: "var(--ink)", background: "#F8FAFC", borderRadius: 8, padding: "13px 15px" }}>60</div></div>
              <div><div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Default Cutoff Score (%)</div><div style={{ fontSize: 14, color: "var(--ink)", background: "#F8FAFC", borderRadius: 8, padding: "13px 15px" }}>70</div></div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Advanced Settings</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {assessToggles.map((t) => (
                <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 14, borderRadius: 12, padding: "16px 18px", background: "#F8FAFC" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{t.sub}</div>
                  </div>
                  <Toggle on={assessGlobal[t.key]} onClick={() => setAssessGlobal((s) => ({ ...s, [t.key]: !s[t.key] }))} w={44} h={25} knob={21} onBg="#020617" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ----- INTERVIEW CONFIG ----- */
  const renderInterview = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {intKpis.map((k) => (
          <div key={k.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 7 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.6px", lineHeight: 1 }}>{k.value}</div>
            </div>
            <span style={{ width: 44, height: 44, borderRadius: 11, background: k.bg, color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Svg size={21}>{kpiIcon(k.kind)}</Svg>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "inline-flex", gap: 6, background: "#F1F5F9", borderRadius: 11, padding: 5, width: "max-content" }}>
        {intTabs.map((t) => {
          const active = intTab === t;
          return (
            <div key={t} onClick={() => setIntTab(t)} style={{ fontSize: 13.5, fontWeight: 600, padding: "10px 16px", cursor: "pointer", borderRadius: 8, ...(active ? { background: "#fff", color: "#020617", boxShadow: "0 1px 3px rgba(0,0,0,.1)", border: "1px solid var(--border)" } : { background: "transparent", color: "var(--ink3)", border: "1px solid transparent" }) }}>{t}</div>
          );
        })}
      </div>

      {intTab === "Interview Rounds" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Svg></span>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Interview Rounds</div>
            </div>
            <div onClick={() => toast("Settings saved", "success")} style={{ display: "flex", alignItems: "center", gap: 8, ...primaryBtn, padding: "10px 16px" }}>
              <Svg size={14} stroke="#fff" sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
              Add Round
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {intRounds.map((r) => (
              <div key={r.name} style={{ background: "#F8FAFC", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: 15 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: "#16B364", padding: "3px 10px", borderRadius: 7 }}>Active</span>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: r.typeColor, padding: "3px 10px", borderRadius: 7 }}>{r.type}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
                    <div><div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 3 }}>Duration</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.dur}</div></div>
                    <div><div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 3 }}>Interviewers</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{r.people}</div></div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flex: "none" }}>
                  <span onClick={() => toast("Editing…")} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Svg size={15} stroke="#475569"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></Svg>
                  </span>
                  <span onClick={() => toast("Invitation sent", "success")} style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid var(--border)", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Svg size={15} stroke="#475569"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {intTab === "Schedule" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Svg></span>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Scheduled Interviews</div>
            </div>
            <div onClick={() => toast("Invitation sent", "success")} style={{ display: "flex", alignItems: "center", gap: 8, ...primaryBtn, padding: "10px 16px" }}>
              <Svg size={14} stroke="#fff" sw={2.4}><path d="M12 5v14M5 12h14" /></Svg>
              Schedule Interview
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {intScheduled.map((s) => (
              <div key={s.name + s.round} style={{ background: "#F8FAFC", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "#fff", background: "#16B364", padding: "3px 10px", borderRadius: 7 }}>Scheduled</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink3)", marginBottom: 15 }}>{s.role}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 16 }}>
                  <div><div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 3 }}>Round</div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.round}</div></div>
                  <div><div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 3 }}>Date</div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.date}</div></div>
                  <div><div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 3 }}>Time</div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.time}</div></div>
                  <div><div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600, marginBottom: 3 }}>Interviewer</div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.interviewer}</div></div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <div onClick={() => toast("Editing…")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink)", fontWeight: 600, fontSize: 12.5, padding: "9px 18px", borderRadius: 8, cursor: "pointer" }}>Reschedule</div>
                  <div onClick={() => toast("Interview cancelled", "danger")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink)", fontWeight: 600, fontSize: 12.5, padding: "9px 18px", borderRadius: 8, cursor: "pointer" }}>Cancel</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {intTab === "Feedback" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
              <span style={{ ...sectionIcon, background: "#EBA308" }}><Svg size={19} stroke="#fff"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></Svg></span>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Pending Feedback</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {intPending.map((p) => (
                <div key={p.name} style={{ background: "#F8FAFC", borderRadius: 12, padding: "18px 20px", display: "flex", alignItems: "center", gap: 15 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 3 }}>{p.name}</div>
                    <div style={{ fontSize: 12.5, color: "var(--ink2)", marginBottom: 4 }}>{p.role}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink3)" }}>{p.meta}</div>
                  </div>
                  <div onClick={() => toast("Settings saved", "success")} style={{ ...primaryBtn, fontSize: 12.5, padding: "9px 16px", flex: "none" }}>Submit Feedback</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
              <span style={sectionIcon}><Svg size={19} stroke="#fff"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></Svg></span>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Interview Feedback Form</div>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 12, padding: "18px 20px", marginBottom: 22 }}>
              <div style={{ fontSize: 11.5, color: "var(--ink3)", fontWeight: 600 }}>Candidate</div>
              <div style={{ fontWeight: 600, fontSize: 15, margin: "2px 0 4px" }}>Aisha Bello</div>
              <div style={{ fontSize: 12.5, color: "var(--ink2)" }}>Position: UI/UX Designer</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Rating (1-5 Scale)</div>
            <div style={{ display: "flex", gap: 11, marginBottom: 22 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const active = feedRating === n;
                return (
                  <div key={n} onClick={() => setFeedRating(n)} style={{ width: 48, height: 48, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, cursor: "pointer", ...(active ? { background: "#129152", color: "#fff", border: "1px solid #129152" } : { background: "#fff", color: "var(--ink)", border: "1px solid var(--border)" }) }}>{n}</div>
                );
              })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
              {feedSkills.map((s) => (
                <div key={s.label}>
                  <div style={fieldLabel}>{s.label}</div>
                  <div style={{ ...fieldBox, display: "flex", alignItems: "center", justifyContent: "space-between" }}>{s.ph} {caret}</div>
                </div>
              ))}
            </div>
            <div style={fieldLabel}>Comments</div>
            <div style={{ ...fieldBox, padding: 14, minHeight: 80, marginBottom: 18 }}>Provide detailed feedback about the candidate…</div>
            <div style={fieldLabel}>Final Recommendation</div>
            <div style={{ ...fieldBox, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>Select recommendation {caret}</div>
            <div style={{ borderTop: "1px solid var(--border2)", paddingTop: 18, display: "flex", gap: 10 }}>
              <div onClick={() => toast("Settings saved", "success")} style={{ display: "flex", alignItems: "center", gap: 8, ...primaryBtn }}>
                <Svg size={15} stroke="#fff"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></Svg>
                Submit Feedback
              </div>
              <div onClick={() => toast("Draft saved", "success")} style={{ ...ghostBtn, color: "var(--ink)" }}>Save as Draft</div>
            </div>
          </div>
        </div>
      )}

      {intTab === "Create Round" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "24px 26px", maxWidth: 980 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
            <span style={sectionIcon}><Svg size={19} stroke="#fff" sw={2.4}><path d="M12 5v14M5 12h14" /></Svg></span>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Create Interview Round</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div><div style={fieldLabel}>Round Name *</div><div style={fieldBox}>e.g., Technical Round 1</div></div>
            <div><div style={fieldLabel}>Round Type *</div><div style={{ ...fieldBox, display: "flex", alignItems: "center", justifyContent: "space-between" }}>Select type {caret}</div></div>
            <div><div style={fieldLabel}>Duration (minutes) *</div><div style={fieldBox}>60</div></div>
            <div><div style={fieldLabel}>Sequence Order *</div><div style={fieldBox}>1</div></div>
          </div>
          <div style={fieldLabel}>Description</div>
          <div style={{ ...fieldBox, padding: 14, minHeight: 80, marginBottom: 18 }}>Describe the focus areas and objectives of this round…</div>
          <div style={fieldLabel}>Assign Interviewers</div>
          <div style={{ ...fieldBox, marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "space-between" }}>Select interviewers {caret}</div>
          <div style={{ borderTop: "1px solid var(--border2)", paddingTop: 18, display: "flex", gap: 10 }}>
            <div onClick={() => toast("Settings saved", "success")} style={primaryBtn}>Create Round</div>
            <div onClick={() => setIntTab("Interview Rounds")} style={{ ...ghostBtn, color: "var(--ink)" }}>Cancel</div>
          </div>
        </div>
      )}
    </div>
  );

  /* ----- GLOBAL SETTINGS ----- */
  const gsetList = [
    { key: "sso" as const, label: "Single Sign-On (SSO)", sub: "Microsoft Entra ID & Google Workspace" },
    { key: "mfa" as const, label: "Enforce MFA", sub: "Require 2FA for all admins" },
    { key: "audit" as const, label: "Immutable audit log", sub: "Append-only event ledger" },
    { key: "retention" as const, label: "Auto data purge", sub: "Delete candidate data after 2 years" },
  ];
  const renderGlobal = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 880 }}>
      <div style={sectionCard}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Organization</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {adminGlobal.map((g) => (
            <div key={g.label}>
              <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 600, marginBottom: 5 }}>{g.label}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 8, background: "#FBFCFD" }}>{g.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={sectionCard}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Security &amp; Compliance</div>
        {gsetList.map((t) => (
          <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: "1px solid var(--border2)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.label}</div>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>{t.sub}</div>
            </div>
            <Toggle on={gset[t.key]} onClick={() => setGset((s) => ({ ...s, [t.key]: !s[t.key] }))} />
          </div>
        ))}
      </div>
      <div>
        <div onClick={() => toast("Settings saved", "success")} style={{ ...primaryBtn, display: "inline-block" }}>Save changes</div>
      </div>
    </div>
  );

  /* ============================ LAYOUT ============================ */
  return (
    <div style={{ display: "flex", minHeight: "100%", background: "#F8FAFC" }}>
      {/* ADMIN SIDEBAR */}
      <aside style={{ width: 248, flex: "none", background: "#fff", borderRight: "1px solid var(--border)", position: "sticky", top: 0, height: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 18px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid var(--border2)" }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "linear-gradient(135deg,#16B364,#129152)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Svg size={20} stroke="#fff"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></Svg>
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-.3px", color: "#020617" }}>Hirebrew</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>Admin Console</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_ITEMS.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              active={nav === item.label}
              onClick={() => {
                setNav(item.label);
                setActiveUser(null);
              }}
            />
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: "1px solid var(--border2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: 10, borderRadius: 11, background: "#F8FAFC", marginBottom: 9 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#16B364", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12, flex: "none" }}>AD</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#020617" }}>Admin User</div>
              <div style={{ fontSize: 11.5, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>admin@hirebrew.com</div>
            </div>
          </div>
          <div onClick={goSignin} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer" }}>
            <Svg size={17} stroke="#64748B"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Svg>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#475569" }}>Logout</span>
          </div>
        </div>
      </aside>

      {/* ADMIN CONTENT */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 72, flex: "none", background: "#fff", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 16, padding: "0 28px", position: "sticky", top: 0, zIndex: 10 }}>
          <div onClick={goSignin} style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink3)" }}>
            <Svg size={18}><path d="M18 6L6 18M6 6l12 12" /></Svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-.3px" }}>{nav}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{HEADER_SUB[nav]}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div onClick={() => go("notifications")} style={headerIconBtn}>
            <Svg size={19}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></Svg>
            <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--red)", border: "1.5px solid #fff" }} />
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 48px" }}>
          {nav === "Dashboard" && renderDashboard()}
          {nav === "User Management" && renderUsers()}
          {nav === "RBAC Permissions" && renderRbac()}
          {nav === "Assessment Config" && renderAssess()}
          {nav === "Interview Config" && renderInterview()}
          {nav === "Global Settings" && renderGlobal()}
        </div>
      </div>
    </div>
  );
}
