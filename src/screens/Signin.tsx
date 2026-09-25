"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useWorkspace } from "@/state/workspace";
import { FREE_EMAIL_DOMAINS, SAMPLE_TOUR, SANDBOX_COPY, domainOf, isWorkEmail } from "@/data/recruiterOnboarding";

type Role = "Candidate" | "Hiring Manager" | "Admin";

const fieldInput: CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: "inherit",
  fontSize: 13.5,
  color: "var(--ink)",
  padding: "13px 0",
};

const MailIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const BuildingIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h6" />
  </svg>
);

const PersonIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="3.4" />
    <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
  </svg>
);

/** The signin form's own input anatomy, lifted so signup reuses it exactly. */
function Field({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 7 }}>{label}</div>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, background: "var(--bg)",
          border: "1px solid var(--border)", borderRadius: 10, padding: "0 13px", marginBottom: 18,
        }}
      >
        {icon}
        {children}
      </div>
    </>
  );
}

function RoleTab({
  role,
  active,
  onClick,
  children,
}: {
  role: Role;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        fontSize: 13,
        fontWeight: 600,
        padding: "9px 6px",
        borderRadius: 8,
        cursor: "pointer",
        background: active ? "#fff" : "transparent",
        color: active ? "#129152" : "var(--ink3)",
        boxShadow: active ? "0 1px 3px rgba(15,23,41,.1)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function OtpButton({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        width: "100%",
        background: "#fff",
        color: "var(--ink)",
        border: `1px solid ${hovered ? "#CBD5E1" : "var(--border)"}`,
        fontFamily: "inherit",
        fontWeight: 600,
        fontSize: 14,
        padding: 14,
        borderRadius: 11,
        cursor: "pointer",
      }}
    >
      Login with OTP
    </button>
  );
}

export default function Signin() {
  const go = useGo();
  const toast = useToast();
  const { setPersona, setTourOpen, setTourStep } = useApp();
  const { submitSignup, startSandbox } = useWorkspace();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [role, setRole] = useState<Role>("Candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  // Work-email signup — the handoff into workspace activation.
  const [suEmail, setSuEmail] = useState("");
  const [suOrg, setSuOrg] = useState("");
  const [suName, setSuName] = useState("");
  const suDomain = domainOf(suEmail);
  const suFree = suEmail.includes("@") && !isWorkEmail(suEmail);

  // Signing in also assumes the matching persona (FR-077 role-aware access).
  const signIn = () => {
    if (role === "Candidate") { setPersona("candidate"); go("cportal"); }
    else if (role === "Admin") { setPersona("sysadmin"); go("aportal"); }
    else { setPersona("hr"); go("dashboard"); }
  };

  /**
   * The first recruiter in becomes the workspace admin: the store creates the
   * workspace with their seat as Owner, drops the entitlement to "Recruit
   * only", and parks verification at domain_matched for activation to finish.
   */
  const createWorkspace = () => {
    if (!suEmail.includes("@") || !isWorkEmail(suEmail)) {
      toast("Use your work email — we verify the employer, not the person", "danger");
      return;
    }
    if (!suOrg.trim()) {
      toast("We need the company name — it's what the CAC check is matched against", "danger");
      return;
    }
    submitSignup(suOrg, suEmail, suName);
    setPersona("hr");
    toast(`${suOrg.trim()} created — you're the workspace admin`, "success");
    go("activation");
  };

  /** Pre-commitment sandbox: the seeded Senior Product Designer role, 90 seconds. */
  const openSandbox = () => {
    startSandbox();
    setPersona("hr");
    setTourStep(0);
    setTourOpen(true);
    toast(SANDBOX_COPY.body, "ai");
    go(SAMPLE_TOUR[0].stage);
  };

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#fff",
        padding: "40px 56px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 38 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg,#16B364,#129152)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 20,
            flex: "none",
          }}
        >
          ▤
        </div>
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-.3px" }}>Hirebrew</div>
          <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>Enterprise Recruitment Platform</div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 64,
          alignItems: "center",
          maxWidth: 1320,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {/* LEFT: FORM */}
        <div style={{ maxWidth: 460, width: "100%", justifySelf: "center" }}>
          {mode === "signup" ? (
          <>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-.5px" }}>
            Create your workspace
          </h1>
          <div style={{ fontSize: 14, color: "var(--ink3)", marginBottom: 26 }}>
            First role live in ~15 minutes. First ranked shortlist by morning.
          </div>

          <Field label="Work email" icon={MailIcon}>
            <input
              value={suEmail}
              onChange={(e) => setSuEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createWorkspace(); }}
              placeholder="you@yourcompany.com"
              style={fieldInput}
            />
          </Field>
          <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: -12, marginBottom: 18, color: suFree ? "#C21A14" : suDomain ? "#129152" : "var(--ink3)" }}>
            {suFree
              ? `Use your work email — we verify the employer, not the person. ${FREE_EMAIL_DOMAINS.slice(0, 3).join(", ")} and other free mailboxes can't prove a company exists.`
              : suDomain
                ? `We'll match ${suDomain} against your CAC registration, then a human at Hirebrew signs it off.`
                : "Work email only. The domain is checked against your company's CAC registration."}
          </div>

          <Field label="Company name" icon={BuildingIcon}>
            <input
              value={suOrg}
              onChange={(e) => setSuOrg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createWorkspace(); }}
              placeholder="e.g. SEEPCO Energy Ltd"
              style={fieldInput}
            />
          </Field>

          <Field label="Your full name" icon={PersonIcon}>
            <input
              value={suName}
              onChange={(e) => setSuName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createWorkspace(); }}
              placeholder="e.g. Samuel Omosehin"
              style={fieldInput}
            />
          </Field>

          <button
            onClick={createWorkspace}
            style={{
              width: "100%", background: "#129152", color: "#fff", border: "none", fontFamily: "inherit",
              fontWeight: 600, fontSize: 14.5, padding: 14, borderRadius: 11, cursor: "pointer",
            }}
          >
            Create workspace →
          </button>

          <div style={{ fontSize: 12.5, color: "var(--ink3)", lineHeight: 1.6, marginTop: 16 }}>
            You&apos;re the first recruiter in, so this workspace is <b style={{ color: "var(--ink2)" }}>yours</b>{" "}— you&apos;ll set
            seats and permissions, and choose which pillars are switched on, from Recruit only up to the full Talent OS.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
            <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>Or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
          </div>

          <OtpButton onClick={() => toast("OTP sent to your device", "success")} />

          <div style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink3)", marginTop: 30 }}>
            Already have a workspace?{" "}
            <span onClick={() => setMode("signin")} style={{ fontWeight: 600, color: "#16B364", cursor: "pointer" }}>
              Sign in
            </span>
          </div>
          </>
          ) : (
          <>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 700, letterSpacing: "-.5px" }}>
            Welcome Back
          </h1>
          <div style={{ fontSize: 14, color: "var(--ink3)", marginBottom: 26 }}>
            Sign in to access your account
          </div>

          <div
            style={{
              display: "flex",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 11,
              padding: 5,
              marginBottom: 24,
            }}
          >
            <RoleTab role="Candidate" active={role === "Candidate"} onClick={() => setRole("Candidate")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3" />
                <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
                <circle cx="18" cy="8" r="2" />
              </svg>
              Candidate
            </RoleTab>
            <RoleTab role="Hiring Manager" active={role === "Hiring Manager"} onClick={() => setRole("Hiring Manager")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M8 4v16M8 9h4M8 13h4" />
              </svg>
              Hiring Manager
            </RoleTab>
            <RoleTab role="Admin" active={role === "Admin"} onClick={() => setRole("Admin")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
              </svg>
              Admin
            </RoleTab>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 7 }}>
            Email / Mobile Number
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "0 13px",
              marginBottom: 18,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email or mobile number"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: "inherit",
                fontSize: 13.5,
                color: "var(--ink)",
                padding: "13px 0",
              }}
            />
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 7 }}>
            Password
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "0 13px",
              marginBottom: 16,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="11" width="16" height="9" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Enter your password"
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: "inherit",
                fontSize: 13.5,
                color: "var(--ink)",
                padding: "13px 0",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 22,
            }}
          >
            <div
              onClick={() => setRememberMe((v) => !v)}
              style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
              <span
                style={{
                  width: 19,
                  height: 19,
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  background: rememberMe ? "#129152" : "#fff",
                  border: rememberMe ? "1px solid #129152" : "1px solid #CBD5E1",
                }}
              >
                {rememberMe && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink2)", fontWeight: 500 }}>Remember me</span>
            </div>
            <span
              onClick={() => toast("Password reset link sent", "success")}
              style={{ fontSize: 13, fontWeight: 600, color: "#16B364", cursor: "pointer" }}
            >
              Forgot Password?
            </span>
          </div>

          <button
            onClick={signIn}
            style={{
              width: "100%",
              background: "#129152",
              color: "#fff",
              border: "none",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: 14.5,
              padding: 14,
              borderRadius: 11,
              cursor: "pointer",
            }}
          >
            Sign In
          </button>

          {/* Sandbox before commitment — feel the ranked shortlist before touching real data. */}
          <div
            onClick={openSandbox}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, textAlign: "center", marginTop: 14, fontSize: 12.5, fontWeight: 600, color: "#AF52DE", cursor: "pointer" }}
          >
            <span style={{ fontSize: 13 }}>✦</span> {SANDBOX_COPY.entry}
          </div>

          <div onClick={() => go("personas")} style={{ textAlign: "center", marginTop: 10, fontSize: 12.5, fontWeight: 600, color: "var(--brand)", cursor: "pointer" }}>
            Explore all six workspaces →
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0" }}>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
            <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>Or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border2)" }} />
          </div>

          <OtpButton onClick={() => toast("OTP sent to your device", "success")} />

          <div style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink3)", marginTop: 30 }}>
            Don&apos;t have an account?{" "}
            <span
              onClick={() => setMode("signup")}
              style={{ fontWeight: 600, color: "#16B364", cursor: "pointer" }}
            >
              Register Now
            </span>
          </div>
          </>
          )}
        </div>

        {/* RIGHT: MARKETING PANEL */}
        <div
          style={{
            background: "linear-gradient(150deg,#129152 0%,#16B364 55%,#2FBF74 100%)",
            borderRadius: 24,
            padding: "46px 44px",
            color: "#fff",
            boxShadow: "0 30px 60px rgba(20,58,140,.28)",
            alignSelf: "stretch",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <h2 style={{ margin: "0 0 18px", fontSize: 25, fontWeight: 700, letterSpacing: "-.4px" }}>
            Transform Your Hiring Process
          </h2>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "rgba(255,255,255,.88)",
              marginBottom: 34,
            }}
          >
            Streamline recruitment with AI-powered insights, automated workflows, and comprehensive
            candidate management.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: 12,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "rgba(255,255,255,.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="7" r="3" />
                  <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" />
                  <circle cx="18" cy="8" r="2" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 3 }}>
                  Smart Candidate Matching
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", lineHeight: 1.45 }}>
                  AI-driven profile matching with job requirements
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: 12,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "rgba(255,255,255,.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M8 4v16M8 9h4M8 13h4" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 3 }}>
                  End-to-End Workflow
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", lineHeight: 1.45 }}>
                  From sourcing to onboarding in one platform
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(255,255,255,.12)",
                border: "1px solid rgba(255,255,255,.16)",
                borderRadius: 12,
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: "rgba(255,255,255,.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15.5, marginBottom: 3 }}>
                  Enterprise Security
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.82)", lineHeight: 1.45 }}>
                  Bank-grade security with role-based access control
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
