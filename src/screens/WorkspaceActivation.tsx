"use client";
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useWorkspace } from "@/state/workspace";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfProgress, PfAvatar, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { OS_NAV } from "@/data/osnav";
import {
  ACTIVATION_CLOCK,
  FREE_EMAIL_DOMAINS,
  PILLAR_FOOTER,
  PILLAR_SWITCHES,
  SEAT_LIMIT,
  SEAT_ROLES,
  SEED_WORKSPACE,
  VERIFY_RAIL,
  isPillarLocked,
  isWorkEmail,
  seatRole,
  verifyRailIndex,
  type PillarKey,
  type SeatRole,
  type VerificationState,
} from "@/data/recruiterOnboarding";

/**
 * Workspace activation — spec item 1, and the only writable home for
 * verification, seats and pillars in the whole app.
 *
 * A FLOW, not a settings page: three numbered steps in one scroll, with the
 * clock in the header and a step rail that tracks (and scrolls to) where you
 * are. The verification step re-composes Requisitions' proven approval idiom —
 * multi-node status rail, ledger of named approvers, purple human-approval
 * advisory, transition log — rather than inventing a second one, and the RBAC
 * grid stays in AdminPortal (linked, never duplicated).
 */

const STATE_LABEL: Record<VerificationState, string> = {
  unverified: "Unverified",
  domain_matched: "Domain matched",
  cac_submitted: "CAC checked",
  in_review: "In manual review",
  verified: "Verified workspace",
  rejected: "Verification rejected",
};

const STATE_TONE: Record<VerificationState, PfTone> = {
  unverified: "grey",
  domain_matched: "blue",
  cac_submitted: "blue",
  in_review: "yellow",
  verified: "green",
  rejected: "red",
};

const ALL_ROLES: SeatRole[] = SEAT_ROLES.map((r) => r.role);

const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "1px solid var(--pf-n100)",
  borderRadius: 8,
  background: "var(--pf-n0)",
  outline: "none",
  fontFamily: "inherit",
  fontSize: 13,
  color: "var(--pf-n900)",
  padding: "8px 11px",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
  flex: "none",
  cursor: "pointer",
  color: "var(--pf-n600)",
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: ".5px",
  color: "var(--pf-n400)",
  marginBottom: 7,
};

/* ------------------------------ Small parts ------------------------------ */

function StepHead({ num, title, sub, done }: { num: string; title: string; sub: string; done: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, margin: "26px 0 12px" }}>
      <span
        style={{
          width: 30, height: 30, borderRadius: 9, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700,
          background: done ? "var(--pf-primary-500)" : "var(--pf-n900)", color: "#fff",
        }}
      >
        {done ? <Ic name="check" size={15} color="#fff" weight={2.6} /> : num}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-.2px", color: "var(--pf-n900)" }}>{title}</h2>
          {done && <PfBadge tone="green" dot>Done</PfBadge>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

/** The kit has no switch — this is the one new primitive, built from PfCard tokens. */
function Switch({ on, locked, onToggle }: { on: boolean; locked?: boolean; onToggle: () => void }) {
  return (
    <span
      onClick={locked ? undefined : onToggle}
      title={locked ? "Always on" : on ? "Switch off" : "Switch on"}
      style={{
        width: 40, height: 23, borderRadius: 999, flex: "none", position: "relative",
        cursor: locked ? "not-allowed" : "pointer",
        background: on ? "var(--pf-primary-500)" : "var(--pf-n100)",
        opacity: locked ? 0.55 : 1,
        transition: "background .18s ease",
        display: "inline-block",
      }}
    >
      <span
        style={{
          position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: "50%",
          background: "#fff", boxShadow: "0 1px 3px rgba(2,6,23,.25)", transition: "left .18s ease",
        }}
      />
    </span>
  );
}

function KeyRow({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ color: "var(--pf-n400)" }}>{k}</span>
      <span style={{ fontWeight: 500, color: tone ?? "var(--pf-n900)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

function SeatRow({
  name, email, init, tone, state, role, canWrite, onRole, onRemove,
}: {
  name: string; email: string; init: string; tone: string;
  state: "Owner" | "Active" | "Invited"; role: SeatRole; canWrite: boolean;
  onRole: (r: SeatRole) => void; onRemove: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const isOwner = state === "Owner";
  return (
    <div
      {...hoverProps}
      style={{
        display: "flex", alignItems: "center", gap: 11, padding: "10px 20px",
        borderBottom: "1px solid var(--pf-n50)", background: hovered ? "var(--pf-n25)" : undefined,
      }}
    >
      <PfAvatar init={init} tone={tone} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
      </div>
      <PfBadge tone={state === "Owner" ? "red" : state === "Active" ? "green" : "yellow"} dot={state !== "Invited"}>
        {state}
      </PfBadge>
      <select
        value={role}
        disabled={!canWrite || isOwner}
        onChange={(e) => onRole(e.target.value as SeatRole)}
        style={{ ...selectStyle, width: 158, opacity: !canWrite || isOwner ? 0.55 : 1, cursor: !canWrite || isOwner ? "not-allowed" : "pointer" }}
      >
        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <span
        onClick={canWrite && !isOwner ? onRemove : undefined}
        title={isOwner ? "The owner seat can't be removed" : "Remove seat"}
        style={{
          display: "inline-flex", padding: 5, borderRadius: 7, flex: "none",
          cursor: canWrite && !isOwner ? "pointer" : "not-allowed", opacity: canWrite && !isOwner ? 1 : 0.3,
        }}
      >
        <Ic name="x" size={14} color="var(--pf-n400)" />
      </span>
    </div>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function WorkspaceActivation() {
  const go = useGo();
  const toast = useToast();
  const {
    workspace, seats, pillars, pillarsChosenAt, audit, hydrated,
    submitCac, submitForReview, reviewDecision, submitSignup,
    inviteSeat, changeSeatRole, removeSeat,
    togglePillar, markPillarsChosen, markDone, resetWorkspace,
  } = useWorkspace();

  const [step, setStep] = useState<"verify" | "seats" | "pillars">("verify");
  const [rc, setRc] = useState(workspace.cacNumber || "");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SeatRole>("Recruiter");

  const verifyRef = useRef<HTMLDivElement>(null);
  const seatsRef = useRef<HTMLDivElement>(null);
  const pillarsRef = useRef<HTMLDivElement>(null);
  const refs = { verify: verifyRef, seats: seatsRef, pillars: pillarsRef };

  /* The in-screen gate. No new persona, no seventh role — one boolean. */
  const canWrite = workspace.isWorkspaceOwner;
  const guard = (fn: () => void) => () => {
    if (!canWrite) {
      toast("Ask your workspace admin — only the owner can change verification, seats or pillars", "danger");
      return;
    }
    fn();
  };
  const gateNote = !canWrite && (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--pf-n400)", marginTop: 9 }}>
      <Ic name="shield" size={13} color="var(--pf-n400)" />
      Ask your workspace admin — this seat can read the record but not change it.
    </div>
  );

  const verified = workspace.state === "verified";
  const rejected = workspace.state === "rejected";
  const railIdx = rejected ? 2 : Math.max(verifyRailIndex(workspace.state), 0);

  const s1done = verified;
  const s2done = seats.filter((s) => s.state !== "Owner").length > 0;
  const s3done = Boolean(pillarsChosenAt);
  const doneCount = [s1done, s2done, s3done].filter(Boolean).length;

  const jump = (k: "verify" | "seats" | "pillars") => {
    setStep(k);
    refs[k].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSeats = seats.length;
  const activeSeats = seats.filter((s) => s.state !== "Invited").length;
  const invitedSeats = seats.filter((s) => s.state === "Invited").length;

  /* Pillars → the rail the OS shell will actually render. */
  const railPreview = OS_NAV.filter((sec) => pillars.includes(sec.label as PillarKey));
  const railModules = railPreview.reduce((n, s) => n + s.items.length, 0);

  const runCac = guard(() => {
    if (!rc.trim()) { toast("Enter the RC number from your CAC certificate", "danger"); return; }
    submitCac(rc);
    const digits = rc.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 8) toast("That RC number isn't well-formed — check the certificate", "danger");
    else if (digits === "1042887") toast("Youverify matched RC 1042887 to the CAC register", "success");
    else toast("No CAC match — the record routes to a human reviewer instead of a dead end", "ai");
  });

  const sendInvite = guard(() => {
    const addr = inviteEmail.trim().toLowerCase();
    if (!addr.includes("@") || !addr.includes(".")) { toast("Enter a valid work email address", "danger"); return; }
    if (seats.some((s) => s.email === addr)) { toast("That person already holds a seat", "danger"); return; }
    if (onSeats >= SEAT_LIMIT) { toast(`All ${SEAT_LIMIT} seats on the design-partner plan are taken`, "danger"); return; }
    inviteSeat(addr, inviteRole);
    setInviteEmail("");
    toast(`Invite sent — ${addr} joins as ${inviteRole}`, "success");
  });

  /* Group the seat list by role, in the vocabulary's own order. */
  const grouped = ALL_ROLES
    .map((role) => ({ role, rows: seats.filter((s) => s.role === role) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100, fontFamily: "var(--pf-font)" }}>
      {/* ------------------------------- HEADER ------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)" }}>
            WORKSPACE ACTIVATION · {workspace.orgName.toUpperCase()}
          </div>
          <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>
            Activate your workspace
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--pf-n400)", marginTop: 4 }}>
            <Ic name="clock" size={14} color="var(--pf-primary-500)" />
            {ACTIVATION_CLOCK}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PfBadge tone={STATE_TONE[workspace.state]} dot>{STATE_LABEL[workspace.state]}</PfBadge>
          <PfBtn
            small
            variant="ghost"
            onClick={guard(() => { resetWorkspace(); setRc(SEED_WORKSPACE.cacNumber); toast("Workspace reset to the seeded SEEPCO record", "default"); })}
          >
            Reset (demo)
          </PfBtn>
        </div>
      </div>

      {/* Progress rail */}
      <PfCard pad={"14px 18px"} style={{ marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 9 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Activation progress</span>
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
            {doneCount} of 3 steps · {s1done ? "verified" : "verification pending"} · {s2done ? "seats set" : "team to invite"} ·{" "}
            {s3done ? "pillars chosen" : "pillars to choose"}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)" }}>
            {Math.round((doneCount / 3) * 100)}%
          </span>
        </div>
        <PfProgress pct={(doneCount / 3) * 100} />
      </PfCard>

      {/* Step rail — the platform's page-tab pattern used as step navigation. */}
      <div style={{ margin: "12px -28px 0" }}>
        <PfPageTabs
          active={step}
          onSelect={(k) => jump(k as "verify" | "seats" | "pillars")}
          tabs={[
            { key: "verify", label: "Verify this workspace", mono: "01", badge: s1done ? "DONE" : undefined },
            { key: "seats", label: "Seats & permissions", mono: "02", count: `${onSeats}/${SEAT_LIMIT}` },
            { key: "pillars", label: "Pillars", mono: "03", count: `${pillars.length}/5` },
          ]}
        />
      </div>

      {!canWrite && (
        <div style={{ marginTop: 16 }}>
          <PfCard pad={"12px 16px"} style={{ background: "var(--pf-yellow-50)", borderColor: "var(--pf-yellow-100)" }}>
            <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
              <Ic name="shield" size={15} color="var(--pf-yellow-500)" />
              <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                <b style={{ color: "var(--pf-yellow-500)" }}>Read-only</b> — verification, seats and pillars belong to the
                workspace admin. Ask your workspace admin to make changes; everything below is visible to you either way.
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* =============================== STEP 1 =============================== */}
      <div ref={verifyRef} style={{ scrollMarginTop: 12 }}>
        <StepHead
          num="01"
          title="Verify this workspace"
          sub="Domain match, then a CAC registry check, then a human at Hirebrew signs off"
          done={s1done}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Org card + the two checks */}
            <PfCard>
              <PfCardHead
                title={workspace.orgName}
                sub={`${workspace.domain} · carried over from your work-email signup`}
              >
                <PfBadge tone={workspace.designPartner ? "purple" : "grey"}>
                  {workspace.designPartner ? "DESIGN PARTNER" : "SELF-SERVE"}
                </PfBadge>
              </PfCardHead>

              {/* Row A — domain match */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span
                    style={{
                      width: 30, height: 30, borderRadius: 9, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: workspace.domainMatch ? "var(--pf-primary-50)" : "var(--pf-red-50)",
                    }}
                  >
                    <Ic name={workspace.domainMatch ? "check" : "x"} size={15} weight={2.4} color={workspace.domainMatch ? "var(--pf-primary-500)" : "var(--pf-red-500)"} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>Domain match</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)", fontFamily: "var(--mono)" }}>
                      {workspace.workEmail} ↔ {workspace.domain}
                    </div>
                  </div>
                  <PfBadge tone={workspace.domainMatch ? "green" : "red"}>
                    {workspace.domainMatch ? "Passed automatically" : "Free mailbox — rejected"}
                  </PfBadge>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 9, paddingLeft: 41 }}>
                  Free mailboxes ({FREE_EMAIL_DOMAINS.slice(0, 3).join(", ")}, …) are rejected at signup.
                  We verify the employer, not the person — a personal inbox can&apos;t prove a company exists.
                </div>
              </div>

              {/* Row B — CAC check */}
              <div style={{ padding: "14px 20px" }}>
                <div style={labelStyle}>CAC CHECK · RC NUMBER</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: canWrite ? 1 : 0.55 }}>
                  <input
                    value={rc}
                    disabled={!canWrite}
                    onChange={(e) => setRc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") runCac(); }}
                    placeholder="e.g. RC 1042887"
                    style={{ ...inputStyle, fontFamily: "var(--mono)" }}
                  />
                  <PfBtn variant="primary" icon="search" onClick={runCac}>Run CAC check</PfBtn>
                </div>

                {workspace.cacStatus !== "pending" && (
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 11, marginTop: 11, padding: "11px 14px", borderRadius: 10,
                      border: `1px solid ${workspace.cacStatus === "matched" ? "var(--pf-primary-100)" : "var(--pf-yellow-100)"}`,
                      background: workspace.cacStatus === "matched" ? "var(--pf-primary-50)" : "var(--pf-yellow-50)",
                    }}
                  >
                    <Ic
                      name={workspace.cacStatus === "matched" ? "check" : "warning"}
                      size={16}
                      weight={2.2}
                      color={workspace.cacStatus === "matched" ? "var(--pf-primary-500)" : "var(--pf-yellow-500)"}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
                        <b style={{ fontFamily: "var(--mono)", color: "var(--pf-n900)" }}>{workspace.cacNumber}</b>
                        {" → "}
                        <b style={{ color: "var(--pf-n900)" }}>{workspace.cacName}</b>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{workspace.cacProvider}</div>
                    </div>
                    <PfBadge tone={workspace.cacStatus === "matched" ? "green" : "yellow"}>
                      {workspace.cacStatus === "matched" ? "Registry match" : "No match · goes to review"}
                    </PfBadge>
                  </div>
                )}

                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 10 }}>
                  A mismatch never blocks you — plenty of Nigerian employers trade under a name their CAC registration
                  doesn&apos;t spell out (SEEPCO among them). It routes to a human instead of a dead end.
                </div>
                {gateNote}
              </div>
            </PfCard>

            {/* Status rail — the REQ_RAIL idiom, 4 nodes */}
            <PfCard>
              <PfCardHead title="Verification status" sub="Every transition is logged with actor & timestamp" />
              <div style={{ display: "flex", gap: 8, padding: "16px 20px" }}>
                {VERIFY_RAIL.map((n, i) => {
                  const done = rejected ? i < 2 : i < railIdx;
                  const isNow = i === railIdx;
                  const bad = rejected && isNow;
                  const accent = bad ? "var(--pf-red-500)" : "var(--pf-primary-500)";
                  return (
                    <div
                      key={n.key}
                      style={{
                        flex: 1,
                        border: `1px solid ${isNow ? accent : done ? "var(--pf-primary-100)" : "var(--pf-n50)"}`,
                        background: isNow ? (bad ? "var(--pf-red-50)" : "var(--pf-primary-50)") : "var(--pf-n0)",
                        borderRadius: 10, padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
                          color: isNow ? (bad ? "var(--pf-red-500)" : "var(--pf-primary-600)") : done ? "var(--pf-primary-600)" : "var(--pf-n400)",
                        }}
                      >
                        {done ? (
                          <Ic name="check" size={12} weight={2.4} color="var(--pf-primary-500)" />
                        ) : isNow ? (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: bad ? "var(--pf-red-500)" : "var(--pf-primary-500)" }} />
                        ) : null}
                        {bad ? "Rejected" : n.label}
                        {isNow && !verified && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".4px", marginLeft: 2 }}>· NOW</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2, lineHeight: 1.4 }}>
                        {bad ? "Sent back by the reviewer" : n.sub}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "0 20px 16px" }}>
                <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>AVAILABLE TRANSITIONS</span>

                {(workspace.state === "domain_matched" || workspace.state === "cac_submitted") && (
                  <PfBtn
                    small
                    variant="primary"
                    onClick={guard(() => { submitForReview(); toast(`Submitted — ${SEED_WORKSPACE.reviewer} picks this up`, "success"); })}
                  >
                    Submit for review
                  </PfBtn>
                )}

                {workspace.state === "in_review" && (
                  <>
                    <PfBtn
                      small
                      variant="primary"
                      onClick={guard(() => {
                        reviewDecision("verified", SEED_WORKSPACE.reviewer ?? "Trust & Safety");
                        markDone("verify");
                        toast("Workspace verified — seats, pillars and public posting unlocked", "success");
                      })}
                    >
                      Record decision as reviewer (demo) · Verify
                    </PfBtn>
                    <PfBtn
                      small
                      variant="danger"
                      onClick={guard(() => {
                        reviewDecision("rejected", SEED_WORKSPACE.reviewer ?? "Trust & Safety");
                        toast("Rejected — the reason is logged and the employer can resubmit", "danger");
                      })}
                    >
                      Reject
                    </PfBtn>
                  </>
                )}

                {verified && (
                  <>
                    <PfBtn small icon="arrowsq" onClick={() => go("requisitions")}>Open your first role →</PfBtn>
                    <PfBtn
                      small
                      variant="ghost"
                      onClick={guard(() => {
                        submitSignup(workspace.orgName, workspace.workEmail);
                        setRc("");
                        toast("Verification reopened — walk the flow from the domain check", "default");
                      })}
                    >
                      Re-run verification (demo)
                    </PfBtn>
                  </>
                )}

                {rejected && (
                  <PfBtn
                    small
                    onClick={guard(() => { submitForReview(); toast("Resubmitted for manual review", "default"); })}
                  >
                    Resubmit for review
                  </PfBtn>
                )}
              </div>
            </PfCard>
          </div>

          {/* Right column — ledger, advisory, log */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PfCard>
              <PfCardHead title="Who signs this off" sub="Two machine checks, one named human" />
              <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 11 }}>
                {[
                  {
                    who: "Hirebrew · automatic",
                    init: "HB",
                    label: "Work email ↔ company domain",
                    state: workspace.domainMatch ? "Signed" : "Blocked",
                  },
                  {
                    who: workspace.cacProvider || "Youverify · CAC registry lookup",
                    init: "YV",
                    label: "RC number ↔ Corporate Affairs Commission",
                    state: workspace.cacStatus === "matched" ? "Signed" : workspace.cacStatus === "mismatch" ? "Escalated" : "Awaiting",
                  },
                  {
                    who: SEED_WORKSPACE.reviewer ?? "Trust & Safety",
                    init: "IN",
                    label: "Manual review — the final call",
                    state: verified ? "Signed" : rejected ? "Rejected" : workspace.state === "in_review" ? "Awaiting" : "Not started",
                  },
                ].map((s) => (
                  <div key={s.who} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 30, height: 30, borderRadius: "50%", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", flex: "none",
                      }}
                    >
                      {s.init}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{s.who}</div>
                      <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{s.label}</div>
                    </div>
                    <PfBadge tone={s.state === "Signed" ? "green" : s.state === "Awaiting" ? "yellow" : s.state === "Escalated" ? "purple" : s.state === "Rejected" || s.state === "Blocked" ? "red" : "grey"}>
                      {s.state}
                    </PfBadge>
                  </div>
                ))}
              </div>
            </PfCard>

            <PfCard pad={"12px 16px"} style={{ background: "var(--pf-purple-50)", borderColor: "var(--pf-purple-100)" }}>
              <div style={{ display: "flex", gap: 9 }}>
                <Ic name="shield" size={15} color="var(--pf-purple-500)" />
                <div style={{ fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                  <b style={{ color: "var(--pf-purple-500)" }}>Manual review at launch</b> — volume is low and the trust payoff
                  is high, so a human at Hirebrew signs off every employer. It costs you one wait; it costs a fake employer
                  the whole workspace.
                </div>
              </div>
            </PfCard>

            {verified && (
              <PfCard pad={"12px 16px"}>
                <div style={labelStyle}>VERIFIED RECORD</div>
                <KeyRow k="Submitted" v={workspace.submittedAt ?? "—"} />
                <KeyRow k="Decided" v={workspace.decidedAt ?? "—"} />
                <KeyRow k="Reviewer" v={workspace.reviewer ?? "—"} />
                <KeyRow k="Registered name" v={workspace.cacName || "—"} />
              </PfCard>
            )}

            {audit.length > 0 && (
              <PfCard pad={"12px 16px"}>
                <div style={labelStyle}>TRANSITION LOG</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {audit.slice(0, 6).map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--pf-primary-500)", marginTop: 5, flex: "none" }} />
                      <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--pf-n500)" }}>
                        <b style={{ color: "var(--pf-n900)" }}>{a.actor}</b> {a.action}
                        <span style={{ color: "var(--pf-n300)" }}> · {a.at}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </PfCard>
            )}
          </div>
        </div>
      </div>

      {/* =============================== STEP 2 =============================== */}
      <div ref={seatsRef} style={{ scrollMarginTop: 12 }}>
        <StepHead
          num="02"
          title="Seats & permissions"
          sub="The first recruiter in owns the workspace — and decides who else gets one"
          done={s2done}
        />

        <PfCard pad={"13px 16px"} style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <PfAvatar init={seats.find((s) => s.state === "Owner")?.init ?? "SO"} tone="#16B364" size={34} />
            <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
              <b style={{ color: "var(--pf-primary-600)" }}>You&apos;re the first recruiter in — this workspace is yours.</b>{" "}
              Workspace admin owns verification, seats and which pillars are switched on. Everyone else gets exactly the
              surface their role needs.
            </div>
            <PfBadge tone="green">{onSeats} of {SEAT_LIMIT} seats</PfBadge>
          </div>
        </PfCard>

        <PfCard style={{ marginBottom: 12 }}>
          <PfCardHead
            title="Invite your hiring team"
            sub="Written to the workspace record and logged — not a notification that goes nowhere"
          >
            <PfBadge tone={onSeats >= SEAT_LIMIT ? "red" : "grey"}>{SEAT_LIMIT - onSeats} seats left</PfBadge>
          </PfCardHead>
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", opacity: canWrite ? 1 : 0.55 }}>
              <input
                value={inviteEmail}
                disabled={!canWrite}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendInvite(); }}
                placeholder={`name@${workspace.domain}`}
                style={inputStyle}
              />
              <select
                value={inviteRole}
                disabled={!canWrite}
                onChange={(e) => setInviteRole(e.target.value as SeatRole)}
                style={{ ...selectStyle, width: 172 }}
              >
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <PfBtn variant="primary" icon="plus" onClick={sendInvite}>Send invite</PfBtn>
            </div>

            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 9, lineHeight: 1.55 }}>
              <b style={{ color: "var(--pf-n600)" }}>{inviteRole}</b> — {seatRole(inviteRole).perms}. {seatRole(inviteRole).unlocks}.
              {inviteEmail.includes("@") && !inviteEmail.trim().toLowerCase().endsWith(`@${workspace.domain}`) && (
                <span style={{ color: "var(--pf-yellow-500)" }}>
                  {" "}Outside {workspace.domain} — they&apos;ll join as an external collaborator.
                </span>
              )}
              {inviteEmail.includes("@") && !isWorkEmail(inviteEmail) && (
                <span style={{ color: "var(--pf-red-500)" }}> That looks like a personal mailbox.</span>
              )}
            </div>
            {gateNote}
          </div>
        </PfCard>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, alignItems: "start" }}>
          <PfCard>
            <PfCardHead
              title="Seats in this workspace"
              sub={`${activeSeats} active · ${invitedSeats} invited · grouped by role`}
            />
            {grouped.map((g) => (
              <div key={g.role}>
                <div
                  style={{
                    display: "flex", alignItems: "center", gap: 9, padding: "8px 20px",
                    background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)",
                  }}
                >
                  <PfBadge tone={seatRole(g.role).tone}>{g.role}</PfBadge>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{seatRole(g.role).perms}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n400)" }}>{g.rows.length}</span>
                </div>
                {g.rows.map((s) => (
                  <SeatRow
                    key={s.email}
                    name={s.name ?? s.email}
                    email={s.email}
                    init={s.init}
                    tone={s.tone}
                    state={s.state}
                    role={s.role}
                    canWrite={canWrite}
                    onRole={(r) => guard(() => { changeSeatRole(s.email, r); toast(`${s.name ?? s.email} is now ${r}`, "success"); })()}
                    onRemove={() => guard(() => { removeSeat(s.email); toast(`Seat removed — ${s.email} loses access, the record stays`, "danger"); })()}
                  />
                ))}
              </div>
            ))}
            {gateNote && <div style={{ padding: "0 20px 14px" }}>{gateNote}</div>}
          </PfCard>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PfCard>
              <PfCardHead title="What each role can do" sub="One vocabulary across the workspace" />
              <div style={{ padding: "12px 20px 14px", display: "flex", flexDirection: "column", gap: 11 }}>
                {SEAT_ROLES.map((r) => (
                  <div key={r.role}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PfBadge tone={r.tone}>{r.role}</PfBadge>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--pf-n300)" }}>
                        {seats.filter((s) => s.role === r.role).length}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5, marginTop: 4 }}>{r.perms}</div>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>{r.unlocks}</div>
                  </div>
                ))}
              </div>
              <div
                onClick={() => { toast("Opening the platform console — tenant-wide RBAC lives there, not here", "default"); go("aportal"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderTop: "1px solid var(--pf-n50)",
                  fontSize: 12, fontWeight: 600, color: "var(--pf-primary-600)", cursor: "pointer",
                }}
              >
                Platform-wide RBAC matrix &amp; permission grid · admin console
                <Ic name="arrowright" size={14} color="var(--pf-primary-600)" />
              </div>
            </PfCard>

            <PfCard pad={"12px 16px"}>
              <div style={labelStyle}>LICENCE</div>
              <KeyRow k="Plan" v="Design partner" />
              <KeyRow k="Seats used" v={`${onSeats} of ${SEAT_LIMIT}`} />
              <KeyRow k="Active" v={activeSeats} />
              <KeyRow k="Invited" v={invitedSeats} />
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.55, marginTop: 8 }}>
                Seats are the only thing that scales with price. Pillars don&apos;t — switching one on adds modules, not a
                migration.
              </div>
            </PfCard>
          </div>
        </div>
      </div>

      {/* =============================== STEP 3 =============================== */}
      <div ref={pillarsRef} style={{ scrollMarginTop: 12 }}>
        <StepHead
          num="03"
          title="Choose which pillars are switched on"
          sub="This is where onboarding scales from “Recruit only” to the full Talent OS"
          done={s3done}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PILLAR_SWITCHES.map((p) => {
              const on = pillars.includes(p.key);
              const locked = isPillarLocked(p.key);
              return (
                <PfCard
                  key={p.key}
                  pad={"14px 18px"}
                  style={{
                    borderColor: on ? "var(--pf-primary-100)" : "var(--pf-n50)",
                    background: on ? "var(--pf-primary-50)" : "var(--pf-n0)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--pf-n900)" }}>{p.label}</span>
                        <PfBadge tone={p.plan === "Recruit" ? "green" : "purple"}>{p.plan}</PfBadge>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--pf-n400)" }}>
                          {p.modules} module{p.modules === 1 ? "" : "s"}
                        </span>
                        {locked && <PfBadge tone="grey">Always on</PfBadge>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 3 }}>{p.sub}</div>
                      <div style={{ fontSize: 11.5, color: on ? "var(--pf-primary-600)" : "var(--pf-n400)", lineHeight: 1.5, marginTop: 6 }}>
                        <b>{on ? "Adds to your rail:" : "Would add:"}</b> {p.adds}
                      </div>
                    </div>
                    <Switch
                      on={on}
                      locked={locked}
                      onToggle={guard(() => {
                        togglePillar(p.key);
                        const n = `${p.modules} module${p.modules === 1 ? "" : "s"}`;
                        toast(
                          on ? `${p.label} switched off — ${n} leave the rail` : `${p.label} switched on — ${n} join the rail`,
                          on ? "default" : "success",
                        );
                      })}
                    />
                  </div>
                </PfCard>
              );
            })}
            {gateNote}
          </div>

          {/* Live consequence — the rail this entitlement actually renders */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <PfCard>
              <PfCardHead
                title="Your rail right now"
                sub={`${railPreview.length} groups · ${railModules} modules`}
              >
                <PfBadge tone="green" dot>LIVE</PfBadge>
              </PfCardHead>
              <div style={{ padding: "12px 16px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                {railPreview.map((sec) => (
                  <div key={sec.label}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".4px", color: "var(--pf-n300)" }}>
                        {sec.label.toUpperCase()}
                      </span>
                      <span style={{ flex: 1, height: 1, background: "var(--pf-n50)" }} />
                      <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--pf-n300)" }}>{sec.items.length}</span>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {sec.items.slice(0, 5).map((it) => (
                        <span
                          key={it.stage}
                          style={{
                            fontSize: 10.5, fontWeight: 500, padding: "2px 7px", borderRadius: 5,
                            background: "var(--pf-n25)", border: "0.6px solid var(--pf-n100)", color: "var(--pf-n500)",
                          }}
                        >
                          {it.label}
                        </span>
                      ))}
                      {sec.items.length > 5 && (
                        <span style={{ fontSize: 10.5, color: "var(--pf-n300)", padding: "2px 4px" }}>
                          +{sec.items.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {railPreview.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>Nothing switched on yet.</div>
                )}
              </div>
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--pf-n50)", fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5 }}>
                This is the Talent OS rail, not a mock-up of it — switch a pillar and the navigation changes on your next
                screen. {hydrated ? "" : "Loading your entitlement…"}
              </div>
            </PfCard>

            <PfCard pad={"12px 16px"} style={{ background: "var(--pf-n900)", borderColor: "var(--pf-n900)" }}>
              <div style={{ display: "flex", gap: 9 }}>
                <Ic name="sparkle" size={15} color="#57CB92" />
                <div style={{ fontSize: 11.5, color: "#CBD5E1", lineHeight: 1.6 }}>{PILLAR_FOOTER}</div>
              </div>
            </PfCard>
          </div>
        </div>
      </div>

      {/* ------------------------------- FOOTER ------------------------------- */}
      <PfCard style={{ marginTop: 22, background: "var(--pf-n900)", borderColor: "var(--pf-n900)" }} pad={"20px 22px"}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-.2px" }}>
              {doneCount === 3 ? "Workspace activated." : "That's the setup — the rest is hiring."}
            </div>
            <div style={{ fontSize: 12.5, color: "#94A3B8", lineHeight: 1.55, marginTop: 4 }}>
              Next: describe your first role in a sentence. Brew drafts the JD, the Naira band, the knockout questions,
              the video prompts and the rubric — and you edit every one of them before anything goes live.
            </div>
          </div>
          <button
            onClick={() => { markPillarsChosen(); go("requisitions"); }}
            style={{
              flex: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "11px 20px", borderRadius: 999,
              border: "none", cursor: "pointer", background: "#fff", color: "var(--pf-n900)",
            }}
          >
            Continue to your first role →
          </button>
        </div>
      </PfCard>
    </div>
  );
}
