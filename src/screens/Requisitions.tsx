"use client";
import { useRef, useState } from "react";
import { useApp, useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useLifecycle } from "@/state/lifecycle";
import { useWorkspace } from "@/state/workspace";
import { personaById } from "@/data/personas";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfTh, type PfTone } from "@/components/os/ui";
import ChatPane, { type Msg, type ChatSuggestion } from "@/components/os/ChatPane";
import { Ic } from "@/components/os/icons";
import {
  REQ_DEPARTMENTS, REQ_SENIORITY, REQ_RAIL, generateArtifact, benchmarkFor, rubricFor,
  bandOf, naira, rubricTotal, rubricOf, benchmarkOf, knockoutsOf, videoPromptsOf,
  type Requisition, type ReqRecordStatus, type GeneratedArtifact, type SalaryBenchmark,
} from "@/data/requisitions";
import {
  ROLE_INTAKE_SCRIPT, INTAKE_OPENER, INTAKE_SUGGESTIONS, INTAKE_APPROVAL_NOTE, type IntakeField,
} from "@/data/recruiterOnboarding";
import type { AuditEntry } from "@/state/lifecycle";

/* Modeled on the live staging app: /organization/requisitions (list + draft
   tabs, per-requisition detail with status rail, sign-off ledger and the
   AI-generated JD artifact) — extended so the first role can be opened as a
   CONVERSATION, and so every artefact Brew drafts is edited and approved by a
   human before it is saved. */

const STATUS_TONE: Record<ReqRecordStatus, PfTone> = { draft: "grey", pending: "yellow", published: "green", rejected: "red" };
const STAGE_LABEL: Record<ReqRecordStatus, string> = { draft: "Draft", pending: "Pending Approval", published: "Published", rejected: "Rejected" };

/* ------------------------------ Shared bits ----------------------------- */

const inputStyle = {
  width: "100%", fontFamily: "inherit", fontSize: 12.5, color: "var(--pf-n900)", background: "var(--pf-n0)",
  border: "1px solid var(--pf-n100)", borderRadius: 8, padding: "7px 10px", outline: "none", boxSizing: "border-box" as const,
};

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)" }}>{children}</span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
  );
}

function MiniBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, cursor: "pointer",
        border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", color: tone ?? "var(--pf-n500)", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/* -------------------------- Comp benchmark card -------------------------- */
/* Re-composes Role.tsx's "Comp benchmark" visual — one comp story, no second
   comp screen. Naira-first, with the NG sources named. */

function BenchmarkCard({ b, compact }: { b: SalaryBenchmark; compact?: boolean }) {
  const toast = useToast();
  return (
    <div style={{ background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 12, padding: compact ? "12px 14px" : "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--pf-primary-600)" }}>Naira salary benchmark</div>
        <PfBadge tone="green">{b.confidence}% conf.</PfBadge>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: compact ? 18 : 22, fontWeight: 700, color: "var(--pf-primary-600)", marginBottom: 8 }}>
        {naira(b.p25)} – {naira(b.p75)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
        {([["p25", b.p25], ["median", b.p50], ["p75", b.p75]] as const).map(([k, v]) => (
          <div key={k} style={{ flex: 1, background: "var(--pf-n0)", border: "1px solid var(--pf-primary-100)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "var(--pf-n400)", letterSpacing: ".3px" }}>{k}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{naira(v)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>
        {b.sample} verified NG comparables · adjusted for Lagos.{" "}
        <button
          onClick={() => toast(`Sources — ${b.sources.join(" · ")}`, "ai")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--pf-primary-600)", textDecoration: "underline" }}
        >
          {b.sources.length} sources cited
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- List row ------------------------------- */

function Row({ r, onOpen }: { r: Requisition; onOpen: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} onClick={onOpen} style={{ display: "grid", gridTemplateColumns: "2.2fr 1.2fr 0.9fr 0.7fr 1fr", padding: "12px 20px", alignItems: "center", borderBottom: "1px solid var(--pf-n50)", cursor: "pointer", background: hovered ? "var(--pf-n25)" : undefined }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--pf-n900)", textDecorationLine: hovered ? "underline" : "none", textDecorationColor: "var(--pf-n300)", textUnderlineOffset: 3 }}>{r.role}</div>
        <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{r.dept} · {r.loc}</div>
      </div>
      <div><PfBadge tone={STATUS_TONE[r.status]}>{STAGE_LABEL[r.status]}</PfBadge></div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--pf-n500)" }}>{r.candidates}</div>
      <div style={{ fontSize: 12.5, color: "var(--pf-n500)", fontWeight: 500 }}>{r.age}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n500)" }}>{r.statusLabel}</span>
        <Ic name="caretright" size={13} color={hovered ? "var(--pf-n500)" : "var(--pf-n300)"} />
      </div>
    </div>
  );
}

/* ------------------------------ Detail view ----------------------------- */

function Detail({ r, onBack, onTransition, log }: { r: Requisition; onBack: () => void; onTransition: (to: ReqRecordStatus) => void; log: AuditEntry[] }) {
  const go = useGo();
  const toast = useToast();
  const railIdx = r.status === "draft" ? 0 : r.status === "pending" ? 1 : 2;
  const rubric = rubricOf(r);
  const bench = benchmarkOf(r);
  const knockouts = knockoutsOf(r);
  const prompts = videoPromptsOf(r);
  return (
    <div>
      <div onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--pf-n400)", cursor: "pointer", marginBottom: 14 }}>
        <Ic name="caretright" size={12} color="var(--pf-n400)" weight={2.2} /> <span style={{ transform: "scaleX(-1)" }} /> ← Requisitions
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)" }}>REQUISITION · {r.id}</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 21, fontWeight: 700, letterSpacing: "-.3px", color: "var(--pf-n900)" }}>{r.role}</h1>
        </div>
        <span style={{ flex: 1 }} />
        <PfBadge tone={STATUS_TONE[r.status]} dot>{STAGE_LABEL[r.status]}</PfBadge>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Status rail — the staging app's 3 nodes */}
          <PfCard>
            <PfCardHead title="Requisition status" sub="Every transition is logged with approver & timestamp" />
            <div style={{ display: "flex", gap: 8, padding: "16px 20px" }}>
              {REQ_RAIL.map((n, i) => {
                const done = r.status === "rejected" ? i === 0 : i < railIdx;
                const now = r.status === "rejected" ? i === 1 : i === railIdx;
                const tone = r.status === "rejected" && now ? "var(--pf-red-500)" : "var(--pf-primary-500)";
                return (
                  <div key={n.key} style={{ flex: 1, border: `1px solid ${now ? tone : done ? "var(--pf-primary-100)" : "var(--pf-n50)"}`, background: now ? (r.status === "rejected" ? "var(--pf-red-50)" : "var(--pf-primary-50)") : "var(--pf-n0)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: now ? (r.status === "rejected" ? "var(--pf-red-500)" : "var(--pf-primary-600)") : done ? "var(--pf-primary-600)" : "var(--pf-n400)" }}>
                      {done ? <Ic name="check" size={12} weight={2.4} color="var(--pf-primary-500)" /> : now ? <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.status === "rejected" ? "var(--pf-red-500)" : "var(--pf-primary-500)" }} /> : null}
                      {r.status === "rejected" && now ? "Rejected" : n.label}
                      {now && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".4px", marginLeft: 2 }}>· NOW</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 2 }}>{r.status === "rejected" && now ? "Sent back by approver" : n.sub}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 20px 16px" }}>
              <span style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>AVAILABLE TRANSITIONS</span>
              {r.status === "published" && <PfBtn small icon="arrowsq" onClick={() => go("jobs")}>View open role →</PfBtn>}
              {r.status === "pending" && <>
                <PfBtn small variant="primary" onClick={() => { onTransition("published"); toast("Sign-offs recorded — approved, published & open role created", "success"); }}>Record sign-offs · Approve</PfBtn>
                <PfBtn small variant="danger" onClick={() => { onTransition("rejected"); toast("Requisition rejected — reason logged for audit", "danger"); }}>Reject</PfBtn>
              </>}
              {r.status === "draft" && <PfBtn small variant="primary" onClick={() => { onTransition("pending"); toast("Submitted for approval — Finance, Dept Head & HRBP notified", "success"); }}>Submit for approval</PfBtn>}
              {r.status === "rejected" && <PfBtn small onClick={() => { onTransition("draft"); toast("Reopened as draft — feedback attached", "default"); }}>Reopen as draft</PfBtn>}
            </div>
          </PfCard>

          {/* Generated artifact — mirrors the staging record for Chemical Engineer */}
          <PfCard>
            <PfCardHead
              title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ic name="sparkle" size={15} color="var(--pf-purple-500)" /> Generated job description</span>}
              sub="Full JD, requirements, salary band and scoring rubric — drafted by AI, owned by you"
            >
              <PfBadge tone="purple">✦ GENERATED</PfBadge>
              {r.editedByHuman && <PfBadge tone="green" dot>Edited by you</PfBadge>}
            </PfCardHead>
            <div style={{ padding: "16px 20px" }}>
              {r.jd ? (
                <>
                  <div style={{ fontSize: 13.5, color: "var(--pf-n600)", lineHeight: 1.65, marginBottom: 14 }}>{r.jd}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 8 }}>MUST-HAVE</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {r.mustHave?.map((m) => (
                      <div key={m} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
                        <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5 }}>{m}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 14 }}>No JD generated yet — open “Describe the role” and tell Brew what you’re hiring for.</div>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginBottom: 2 }}>Salary band</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", fontFamily: "var(--mono)" }}>{r.salaryBand}</div>
                </div>
                <div style={{ flex: 1, border: "1px solid var(--pf-n50)", borderRadius: 10, padding: "10px 14px", cursor: "pointer" }} onClick={() => toast(`Rubric: ${rubric.length} weighted dimensions, ${rubricTotal(rubric)}/100 — powers Stage-04 screening`, "ai")}>
                  <div style={{ fontSize: 11, color: "var(--pf-n400)", marginBottom: 2 }}>Scoring rubric</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{rubric.length} weighted dimensions</div>
                </div>
              </div>
            </div>
          </PfCard>

          {/* The three artefacts Screening & the candidate portal actually consume */}
          <PfCard>
            <PfCardHead title="Screening artefacts" sub="What the overnight run scores against — authored here, cited there" >
              <PfBadge tone="blue">Skills taxonomy</PfBadge>
            </PfCardHead>
            <div style={{ padding: "14px 20px" }}>
              <Label right={<PfBadge tone={rubricTotal(rubric) === 100 ? "green" : "yellow"}>{rubricTotal(rubric)}/100</PfBadge>}>SCORING RUBRIC</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                {rubric.map((d) => (
                  <div key={d.dim} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", borderBottom: "1px solid var(--pf-n50)" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", flex: 1 }}>{d.dim}</span>
                    <PfBadge tone="grey">{d.cluster}</PfBadge>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--pf-n500)", width: 30, textAlign: "right" }}>{d.weight}</span>
                  </div>
                ))}
              </div>

              <Label>KNOCKOUT QUESTIONS</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {knockouts.map((k) => (
                  <div key={k.q} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <PfBadge tone={k.autoReject ? "red" : "grey"}>{k.autoReject ? "AUTO-REJECT" : "FLAG ONLY"}</PfBadge>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5, flex: 1 }}>{k.q}</span>
                  </div>
                ))}
              </div>

              <Label>VIDEO PROMPTS</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {prompts.map((p) => (
                  <div key={p.prompt} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <PfBadge tone="purple">{p.seconds}s</PfBadge>
                    <span style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.5, flex: 1 }}>{p.prompt}</span>
                  </div>
                ))}
              </div>
            </div>
          </PfCard>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <BenchmarkCard b={bench} compact />

          {/* Sign-off ledger */}
          <PfCard>
            <PfCardHead title="Sign-offs required" sub="Headcount stays a human approval" />
            <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {r.signoffs.map((s) => (
                <div key={s.who} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", flex: "none" }}>{s.init}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>{s.who}</div>
                    <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>{s.label}</div>
                  </div>
                  <PfBadge tone={s.state === "Signed" ? "green" : s.state === "Awaiting" ? "yellow" : "grey"}>{s.state}</PfBadge>
                </div>
              ))}
            </div>
          </PfCard>

          <PfCard pad={"12px 16px"} style={{ background: "var(--pf-purple-50)", borderColor: "var(--pf-purple-100)" }}>
            <div style={{ display: "flex", gap: 9 }}>
              <Ic name="shield" size={15} color="var(--pf-purple-500)" />
              <div style={{ fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                <b style={{ color: "var(--pf-purple-500)" }}>AI advisory only</b> — headcount stays a human approval. Every transition is logged with approver &amp; timestamp.
              </div>
            </div>
          </PfCard>

          {log.length > 0 && (
            <PfCard pad={"12px 16px"}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 8 }}>TRANSITION LOG</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {log.slice(0, 5).map((a, i) => (
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

          <PfCard pad={"12px 16px"}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".5px", color: "var(--pf-n400)", marginBottom: 8 }}>RECORD</div>
            {[["Department", r.dept], ["Location", r.loc], ["Seniority", r.seniority], ["Opened", `${r.age} ago`], ["Candidates", r.candidates === "—" ? "Not yet sourcing" : r.candidates]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ color: "var(--pf-n400)" }}>{k}</span>
                <span style={{ fontWeight: 500, color: "var(--pf-n900)" }}>{v}</span>
              </div>
            ))}
          </PfCard>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Artefact editor — "AI proposes, humans decide", as UX                      */
/* ========================================================================== */

function ArtifactEditor({
  art, setArt, edited, phase, title, dept, seniority, onSave, onRegenerate,
}: {
  art: GeneratedArtifact | null;
  setArt: (fn: (a: GeneratedArtifact) => GeneratedArtifact) => void;
  edited: boolean;
  phase: "idle" | "generating" | "done";
  title: string; dept: string; seniority: string;
  onSave: () => void;
  onRegenerate: () => void;
}) {
  const toast = useToast();

  if (phase !== "done" || !art) {
    return (
      <PfCard style={{ borderStyle: "dashed" }}>
        <div style={{ padding: "56px 32px", textAlign: "center" }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Ic name="sparkle" size={19} color="var(--pf-purple-500)" />
          </span>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 5 }}>
            {phase === "generating" ? "Drafting your job description…" : "Brew drafts here — you edit every line"}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", lineHeight: 1.55, maxWidth: 340, margin: "0 auto" }}>
            {phase === "generating"
              ? "JD · Naira band · knockout questions · video prompts · scoring rubric"
              : "You'll get a full JD, a Naira band with its sources, knockout questions, video prompts and a rubric built on the skills taxonomy. Nothing saves until you approve it."}
          </div>
        </div>
      </PfCard>
    );
  }

  const total = rubricTotal(art.rubric);
  const balanced = total === 100;

  const setMust = (i: number, v: string) => setArt((a) => ({ ...a, mustHave: a.mustHave.map((m, j) => (j === i ? v : m)) }));
  const setKo = (i: number, patch: Partial<GeneratedArtifact["knockouts"][number]>) =>
    setArt((a) => ({ ...a, knockouts: a.knockouts.map((k, j) => (j === i ? { ...k, ...patch } : k)) }));
  const setVp = (i: number, patch: Partial<GeneratedArtifact["videoPrompts"][number]>) =>
    setArt((a) => ({ ...a, videoPrompts: a.videoPrompts.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const normalise = () => {
    setArt((a) => {
      const t = rubricTotal(a.rubric) || 1;
      const scaled = a.rubric.map((d) => ({ ...d, weight: Math.max(1, Math.round((d.weight / t) * 100)) }));
      const drift = 100 - scaled.reduce((n, d) => n + d.weight, 0);
      return { ...a, rubric: scaled.map((d, i) => (i === 0 ? { ...d, weight: d.weight + drift } : d)) };
    });
    toast("Weights normalised to 100 — the rubric stays comparable across candidates", "ai");
  };

  return (
    <PfCard>
      <PfCardHead title={title || "Generated role"} sub={`${seniority} · ${dept} · Lagos`}>
        <PfBadge tone="purple">✦ GENERATED</PfBadge>
        {edited && <PfBadge tone="green" dot>Edited by you</PfBadge>}
      </PfCardHead>

      <div style={{ padding: "14px 20px", maxHeight: 540, overflowY: "auto" }}>
        {/* JD */}
        <Label right={<MiniBtn onClick={onRegenerate}>✦ Regenerate</MiniBtn>}>JOB DESCRIPTION</Label>
        <textarea
          value={art.jd}
          onChange={(e) => setArt((a) => ({ ...a, jd: e.target.value }))}
          rows={6}
          style={{ ...inputStyle, lineHeight: 1.6, resize: "vertical", marginBottom: 16 }}
        />

        {/* Must-haves */}
        <Label right={<MiniBtn onClick={() => setArt((a) => ({ ...a, mustHave: [...a.mustHave, ""] }))}>+ Add</MiniBtn>}>MUST-HAVE</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {art.mustHave.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Ic name="check" size={13} color="var(--pf-primary-500)" weight={2.2} />
              <input value={m} onChange={(e) => setMust(i, e.target.value)} placeholder="Add a requirement…" style={{ ...inputStyle, flex: 1 }} />
              <MiniBtn tone="var(--pf-red-500)" onClick={() => setArt((a) => ({ ...a, mustHave: a.mustHave.filter((_, j) => j !== i) }))}>✕</MiniBtn>
            </div>
          ))}
        </div>

        {/* Salary band + benchmark */}
        <Label right={<MiniBtn onClick={() => { setArt((a) => ({ ...a, salaryBand: bandOf(a.salaryBenchmark) })); toast("Band reset to the p25–p75 benchmark", "default"); }}>Use p25–p75</MiniBtn>}>SALARY BAND (NAIRA)</Label>
        <input
          value={art.salaryBand}
          onChange={(e) => setArt((a) => ({ ...a, salaryBand: e.target.value }))}
          style={{ ...inputStyle, fontFamily: "var(--mono)", fontWeight: 600, marginBottom: 10 }}
        />
        <div style={{ marginBottom: 16 }}><BenchmarkCard b={art.salaryBenchmark} compact /></div>

        {/* Rubric */}
        <Label right={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <PfBadge tone={balanced ? "green" : "red"}>{total}/100</PfBadge>
            {!balanced && <MiniBtn onClick={normalise}>Normalise</MiniBtn>}
          </span>
        }>
          SCORING RUBRIC · SKILLS TAXONOMY
        </Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
          {art.rubric.map((d, i) => (
            <div key={d.dim} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--pf-n900)", flex: 1, minWidth: 0 }}>{d.dim}</span>
              <PfBadge tone="grey">{d.cluster}</PfBadge>
              <input
                type="number" min={0} max={100} value={d.weight}
                onChange={(e) => {
                  const w = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                  setArt((a) => ({ ...a, rubric: a.rubric.map((x, j) => (j === i ? { ...x, weight: w } : x)) }));
                }}
                style={{ ...inputStyle, width: 62, flex: "none", fontFamily: "var(--mono)", fontWeight: 700, textAlign: "center" }}
              />
            </div>
          ))}
        </div>
        {!balanced && (
          <div style={{ fontSize: 11.5, color: "var(--pf-red-500)", marginTop: -8, marginBottom: 16 }}>
            Weights must total 100 before this rubric can score anyone.
          </div>
        )}

        {/* Knockouts */}
        <Label right={<MiniBtn onClick={() => setArt((a) => ({ ...a, knockouts: [...a.knockouts, { q: "", type: "yesno", autoReject: false }] }))}>+ Add</MiniBtn>}>
          KNOCKOUT QUESTIONS
        </Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {art.knockouts.map((k, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <input value={k.q} onChange={(e) => setKo(i, { q: e.target.value })} placeholder="Ask a knockout question…" style={{ ...inputStyle, flex: 1 }} />
              <button
                onClick={() => setKo(i, { autoReject: !k.autoReject })}
                style={{
                  fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, letterSpacing: ".3px", padding: "5px 8px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
                  border: `1px solid ${k.autoReject ? "var(--pf-red-100)" : "var(--pf-n100)"}`,
                  background: k.autoReject ? "var(--pf-red-50)" : "var(--pf-n0)",
                  color: k.autoReject ? "var(--pf-red-500)" : "var(--pf-n400)",
                }}
              >
                {k.autoReject ? "AUTO-REJECT" : "FLAG ONLY"}
              </button>
              <MiniBtn tone="var(--pf-red-500)" onClick={() => setArt((a) => ({ ...a, knockouts: a.knockouts.filter((_, j) => j !== i) }))}>✕</MiniBtn>
            </div>
          ))}
        </div>

        {/* Video prompts */}
        <Label right={<MiniBtn onClick={() => setArt((a) => ({ ...a, videoPrompts: [...a.videoPrompts, { prompt: "", seconds: 90 }] }))}>+ Add</MiniBtn>}>
          VIDEO PROMPTS
        </Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {art.videoPrompts.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <input value={p.prompt} onChange={(e) => setVp(i, { prompt: e.target.value })} placeholder="What should they record?" style={{ ...inputStyle, flex: 1 }} />
              <input
                type="number" min={15} max={300} step={15} value={p.seconds}
                onChange={(e) => setVp(i, { seconds: Math.max(15, Math.min(300, Number(e.target.value) || 90)) })}
                style={{ ...inputStyle, width: 66, flex: "none", fontFamily: "var(--mono)", fontWeight: 600, textAlign: "center" }}
              />
              <span style={{ fontSize: 11, color: "var(--pf-n400)" }}>sec</span>
              <MiniBtn tone="var(--pf-red-500)" onClick={() => setArt((a) => ({ ...a, videoPrompts: a.videoPrompts.filter((_, j) => j !== i) }))}>✕</MiniBtn>
            </div>
          ))}
        </div>

        <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "10px 13px", marginBottom: 14, display: "flex", gap: 9 }}>
          <Ic name="shield" size={15} color="var(--pf-purple-500)" />
          <span style={{ fontSize: 11.5, color: "var(--pf-n600)", lineHeight: 1.55 }}>{INTAKE_APPROVAL_NOTE}</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <PfBtn
            variant="primary" icon="check"
            style={{ opacity: balanced && art.jd.trim() ? 1 : 0.55 }}
            onClick={() => {
              if (!balanced) { toast(`Rubric weights total ${total} — they must total 100 before you approve`, "danger"); return; }
              if (!art.jd.trim()) { toast("The JD is empty — Brew can regenerate it, or write your own", "default"); return; }
              onSave();
            }}
          >
            Approve &amp; save draft
          </PfBtn>
          <PfBtn icon="sparkle" onClick={onRegenerate}>Regenerate</PfBtn>
        </div>
      </div>
    </PfCard>
  );
}

/* --------------------------- Structured intake --------------------------- */

function IntakeForm({
  title, setTitle, dept, setDept, seniority, setSeniority, brief, setBrief, phase, onGenerate,
}: {
  title: string; setTitle: (v: string) => void;
  dept: string; setDept: (v: string) => void;
  seniority: string; setSeniority: (v: string) => void;
  brief: string; setBrief: (v: string) => void;
  phase: "idle" | "generating" | "done";
  onGenerate: () => void;
}) {
  const chip = (active: boolean) => ({
    fontFamily: "inherit", fontSize: 12.5, fontWeight: 500 as const, padding: "6px 13px", borderRadius: 8, cursor: "pointer",
    background: active ? "var(--pf-primary-50)" : "var(--pf-n0)", color: active ? "var(--pf-primary-600)" : "var(--pf-n500)",
    border: `1px solid ${active ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
  });
  return (
    <PfCard>
      <PfCardHead title="Role details" sub="Give the basics and a rough description — Brew drafts, you decide." />
      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Job title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Product Designer" style={{ ...inputStyle, fontSize: 13, background: "var(--pf-n25)", padding: "10px 12px", borderRadius: 9 }} />
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Department</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REQ_DEPARTMENTS.map((d) => <button key={d} onClick={() => setDept(d)} style={chip(dept === d)}>{d}</button>)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Seniority</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REQ_SENIORITY.map((s) => <button key={s} onClick={() => setSeniority(s)} style={chip(seniority === s)}>{s}</button>)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 6 }}>Describe what this person will do</div>
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Own the design system across the field-ops apps." rows={3} style={{ ...inputStyle, fontSize: 13, background: "var(--pf-n25)", padding: "10px 12px", borderRadius: 9, resize: "vertical" }} />
        </div>
        <div>
          <PfBtn variant="primary" tone="var(--pf-purple-500)" icon="sparkle" onClick={onGenerate}>
            {phase === "generating" ? "Generating…" : "Generate with AI"}
          </PfBtn>
        </div>
      </div>
    </PfCard>
  );
}

/* -------------------------------- Screen -------------------------------- */

export default function Requisitions({ initialTab = "list" }: { initialTab?: "list" | "draft" | "describe" }) {
  const go = useGo();
  const { persona } = useApp();
  const toast = useToast();
  const actor = `${personaById(persona).name} (${personaById(persona).title})`;
  const { requisitions: items, createRequisition, transitionRequisition, audit } = useLifecycle();
  const { markDone } = useWorkspace();
  const [tab, setTab] = useState<"list" | "draft" | "describe">(initialTab);
  const [openId, setOpenId] = useState<string | null>(null);

  /* ---- ONE intake state, shared by the form tab and the chat tab ---- */
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState<string>("Engineering");
  const [seniority, setSeniority] = useState<string>("Senior");
  const [brief, setBrief] = useState("");
  const [phase, setPhase] = useState<"idle" | "generating" | "done">("idle");
  const [art, setArtState] = useState<GeneratedArtifact | null>(null);
  const [edited, setEdited] = useState(false);

  /* Any write to the artefact is a human decision — stamp it. */
  const setArt = (fn: (a: GeneratedArtifact) => GeneratedArtifact) => {
    setArtState((a) => (a ? fn(a) : a));
    setEdited(true);
  };

  const generate = (t = title, d = dept, s = seniority, b = brief) => {
    if (!t.trim()) { toast("Give the role a title first", "default"); return; }
    setPhase("generating");
    setEdited(false);
    toast("Drafting JD, Naira band, knockouts, video prompts & rubric…", "ai");
    window.setTimeout(() => { setArtState(generateArtifact(t.trim(), d, s, b.trim())); setPhase("done"); }, 900);
  };

  const save = () => {
    if (!art) return;
    const rec: Requisition = {
      id: `REQ-${Math.floor(2215 + (title.length * 7) % 80)}`, role: title.trim() || "New role", dept, loc: "Lagos",
      status: "draft", statusLabel: "Draft", age: "now", candidates: "—", seniority,
      salaryBand: art.salaryBand, rubricDims: art.rubric.length, jd: art.jd, mustHave: art.mustHave.filter(Boolean),
      rubric: art.rubric, salaryBenchmark: art.salaryBenchmark,
      knockouts: art.knockouts.filter((k) => k.q.trim()), videoPrompts: art.videoPrompts.filter((p) => p.prompt.trim()),
      editedByHuman: edited,
      signoffs: [
        { who: "Finance", init: "F", label: "Budget approval", state: "—" },
        { who: "Dept. Head", init: "D", label: "Headcount approval", state: "—" },
        { who: "HR Business Partner", init: "H", label: "Requisition owner", state: "—" },
      ],
    };
    createRequisition(rec, actor);
    // The activation clock measures APPROVAL, not drafting — only this path,
    // never generate/regenerate, closes checklist step 2.
    markDone("firstrole");
    setTab("list");
    toast(
      edited
        ? `${rec.role} saved — your edits are the record, Brew's draft is kept beside it`
        : `Draft saved — ${rec.role} added to requisitions`,
      "success",
    );
  };

  /* ------------------------------ Chat intake ---------------------------- */

  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 1, role: "agent", text: INTAKE_OPENER },
    { id: 2, role: "agent", text: ROLE_INTAKE_SCRIPT[0].agent },
  ]);
  const [chatDraft, setChatDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(0);
  const idRef = useRef(100);
  const turn = ROLE_INTAKE_SCRIPT[Math.min(step, ROLE_INTAKE_SCRIPT.length - 1)];

  const push = (m: Omit<Msg, "id">) => setMsgs((prev) => [...prev, { id: ++idRef.current, ...m }]);

  /** The chat FILLS the same fields the form does, then calls the same generate(). */
  const answer = (raw: string) => {
    const v = raw.trim();
    if (!v || typing) return;
    setChatDraft("");
    push({ role: "user", text: v });

    const field: IntakeField = turn.field;
    // Capture into the shared intake state, then read back locally so the
    // confirm turn can generate from values React hasn't committed yet.
    const next = { title, dept, seniority, brief };
    if (field === "title") { setTitle(v); next.title = v; }
    if (field === "dept") { setDept(v); next.dept = v; }
    if (field === "seniority") { setSeniority(v); next.seniority = v; }
    if (field === "brief") { setBrief(v); next.brief = v; }

    // The last SCRIPTED turn is the confirmation; answering the one before it
    // (the 90-day brief) is what triggers the draft.
    const lastIdx = ROLE_INTAKE_SCRIPT.length - 1;
    const triggersDraft = field === "confirm" || step >= lastIdx - 1;

    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (triggersDraft) {
        const confirmTurn = ROLE_INTAKE_SCRIPT[lastIdx];
        push({ role: "agent", text: confirmTurn.agent, reasoning: confirmTurn.reasoning });
        setStep(lastIdx);
        generate(next.title, next.dept, next.seniority, next.brief);
        return;
      }
      const nextTurn = ROLE_INTAKE_SCRIPT[step + 1];
      push({ role: "agent", text: nextTurn.agent });
      setStep(step + 1);
    }, 620);
  };

  /** Post-draft refinements — each one changes the artefact for real. */
  const refine = (label: string) => {
    if (!art) { answer(label); return; }
    push({ role: "user", text: label });
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      if (label === "Make it hybrid Lagos") {
        setArt((a) => ({ ...a, jd: `${a.jd} This role is hybrid: three days a week on the Lagos site, two remote.` }));
        push({ role: "agent", text: "Added the hybrid Lagos pattern to the JD. The location knockout still asks about relocation — leave it on unless you want remote-only applicants counted." });
      } else if (label === "Add HSE certification as a must-have") {
        setArt((a) => ({
          ...a,
          mustHave: [...a.mustHave, "Current HSE Level 3 certification (or willingness to certify within 90 days)"],
          knockouts: a.knockouts.some((k) => /HSE/i.test(k.q)) ? a.knockouts : [...a.knockouts, { q: "Do you hold a current HSE Level 3 certification?", type: "yesno", autoReject: false }],
        }));
        push({ role: "agent", text: "HSE Level 3 added as a must-have and mirrored as a knockout — set to flag, not auto-reject, so you don't lose someone who can certify in 90 days.", reasoning: ["Must-have appended", "Knockout mirrored · auto-reject OFF"] });
      } else if (label === "Lower the seniority bar") {
        const i = REQ_SENIORITY.indexOf(seniority as (typeof REQ_SENIORITY)[number]);
        const lower = REQ_SENIORITY[Math.max(0, i - 1)];
        setSeniority(lower);
        const b = benchmarkFor(dept, lower);
        setArt((a) => ({ ...a, salaryBenchmark: b, salaryBand: bandOf(b), rubric: rubricFor(dept, lower) }));
        push({ role: "agent", text: `Dropped to ${lower}. The Naira band re-based to ${bandOf(b)} on ${b.sample} comparables and the rubric re-weighted — check the years-of-experience knockout still reads right.`, reasoning: [`Re-basing comp · ${lower} · ${dept}`, "Re-weighting rubric against the skills taxonomy"] });
      } else {
        setArt((a) => ({
          ...a,
          salaryBenchmark: { ...a.salaryBenchmark, sources: Array.from(new Set([...a.salaryBenchmark.sources, "Flutterwave · Interswitch published bands (peer set)"])) },
        }));
        push({ role: "agent", text: "Peer set added — Flutterwave and Interswitch bands are now cited alongside the NG panel. The band itself didn't move; they sit inside p25–p75 already.", reasoning: ["Appending peer comparables", "Re-checking band against the widened set"] });
      }
      toast("Brew applied your refinement — every change is yours to undo", "ai");
    }, 620);
  };

  const suggestions: ChatSuggestion[] =
    art
      ? INTAKE_SUGGESTIONS.map((s) => ({ label: s, run: () => refine(s) }))
      : (turn.chips ?? []).map((c) => ({ label: c, run: () => answer(c) }));

  const captured: [string, string][] = [["Title", title], ["Dept", dept], ["Seniority", seniority], ["First 90 days", brief]];

  if (openId) {
    const open = items.find((r) => r.id === openId) ?? null;
    if (open) {
      return (
        <div style={{ padding: "24px 28px 60px", maxWidth: 1100, fontFamily: "var(--pf-font)" }}>
          <Detail
            r={open}
            onBack={() => setOpenId(null)}
            onTransition={(to) => transitionRequisition(open.id, to, actor)}
            log={audit.filter((a) => a.subject === open.role)}
          />
        </div>
      );
    }
  }

  const published = items.filter((i) => i.status === "published").length;
  const pending = items.filter((i) => i.status === "pending").length;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1100, fontFamily: "var(--pf-font)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>Requisitions</h1>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>Describe the role in a sentence — first role live in ~15 minutes.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PfBtn icon="target" onClick={() => go("planning")}>Signal analysis</PfBtn>
          <PfBtn variant="primary" icon="chat" onClick={() => setTab("describe")}>Describe a role</PfBtn>
        </div>
      </div>

      {/* AI recommendation strip — the staging app's planner verdict */}
      <PfCard pad={"13px 16px"} style={{ background: "var(--pf-purple-50)", borderColor: "var(--pf-purple-100)", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Ic name="sparkle" size={17} color="var(--pf-purple-500)" />
          <div style={{ flex: 1, fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.5 }}>
            <b style={{ color: "var(--pf-purple-500)" }}>RECOMMENDATION READY · 71% CONFIDENCE</b> — Open requisition now: <b>Chemical Engineer</b>. The business case, budget envelope and time-to-fill are drafted and ready for your review.
          </div>
          <PfBtn small variant="primary" tone="var(--pf-purple-500)" onClick={() => setOpenId("REQ-2214")}>Review requisition draft →</PfBtn>
        </div>
      </PfCard>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as "list" | "draft" | "describe")}
          tabs={[
            { key: "list", label: "Open requisitions", count: String(items.length) },
            { key: "describe", label: "Describe the role", badge: "✦ CHAT" },
            { key: "draft", label: "Requisition draft" },
          ]}
        />
      </div>

      {tab === "describe" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
          <ChatPane
            title="Describe the role"
            sub="Brew asks five things, then drafts every artefact for your approval"
            agentLabel="Brew"
            headRight={<PfBadge tone="purple" dot>{art ? "Draft ready" : `Step ${Math.min(step + 1, ROLE_INTAKE_SCRIPT.length)} of ${ROLE_INTAKE_SCRIPT.length}`}</PfBadge>}
            msgs={msgs}
            typing={typing}
            draft={chatDraft}
            onDraft={setChatDraft}
            onSend={() => (art ? refine(chatDraft.trim() || INTAKE_SUGGESTIONS[0]) : answer(chatDraft))}
            suggestions={suggestions}
            placeholder={art ? "Refine the draft — Brew edits, you approve" : turn.placeholder}
            height={540}
            sendIcon="paperplane"
            footer={
              <div style={{ display: "flex", gap: 6, padding: "0 16px", flexWrap: "wrap" }}>
                {captured.filter(([, v]) => v).map(([k, v]) => (
                  <PfBadge key={k} tone="green">{k}: {v.length > 26 ? `${v.slice(0, 26)}…` : v}</PfBadge>
                ))}
              </div>
            }
          />
          <ArtifactEditor
            art={art} setArt={setArt} edited={edited} phase={phase}
            title={title} dept={dept} seniority={seniority}
            onSave={save} onRegenerate={() => generate()}
          />
        </div>
      )}

      {tab === "draft" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
          <IntakeForm
            title={title} setTitle={setTitle} dept={dept} setDept={setDept}
            seniority={seniority} setSeniority={setSeniority} brief={brief} setBrief={setBrief}
            phase={phase} onGenerate={() => generate()}
          />
          <ArtifactEditor
            art={art} setArt={setArt} edited={edited} phase={phase}
            title={title} dept={dept} seniority={seniority}
            onSave={save} onRegenerate={() => generate()}
          />
        </div>
      )}

      {tab === "list" && (
        <PfCard>
          <PfCardHead title="Open requisitions" sub={`${published} published · ${pending} awaiting sign-offs · statuses live from the approval chain`} />
          <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1.2fr 0.9fr 0.7fr 1fr", padding: "9px 20px", borderBottom: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
            <PfTh>Role</PfTh><PfTh>Stage</PfTh><PfTh>Candidates</PfTh><PfTh>Age</PfTh><PfTh>Status</PfTh>
          </div>
          {items.map((r) => <Row key={r.id} r={r} onOpen={() => setOpenId(r.id)} />)}
        </PfCard>
      )}
    </div>
  );
}
