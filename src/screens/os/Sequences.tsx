"use client";
import { useState, type CSSProperties, type ReactNode } from "react";
import { PfCard, PfCardHead, PfBadge, PfBtn, PfPageTabs, PfTile, TONE, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { useHover } from "@/lib/useHover";
import { SEQUENCES, type Sequence } from "@/data/talentos";
import { toolMoment } from "@/data/recruiterOnboarding";

/**
 * Multi-channel Outreach Sequences — PRD FR-046 + FR-047.
 * AI-generated multi-step sequences on the channels Nigerian talent actually
 * answers (email, WhatsApp, SMS, LinkedIn optional), per-step editing, consent
 * & approval gates, per-sequence funnel analytics with channel comparison and
 * auto-pause on bounce thresholds. AI proposes → a human approves every launch.
 */

type Channel = Sequence["steps"][number]["ch"];
type StepState = Sequence["steps"][number]["state"];
type Lang = "English" | "Pidgin-friendly" | "Formal";

type Step = { ch: Channel; day: number; state: StepState; body: string };
type Seq = {
  id: string; name: string; role: string; roleLabel: string;
  state: Sequence["state"]; lang: Lang; aiDraft?: boolean; grounding?: string;
  steps: Step[]; stats: Sequence["stats"] | null;
  autoPaused: { rate: string; threshold: string } | null;
};

/* ------------------------------ Channel styling ------------------------------ */

const CH_TONE: Record<Channel, PfTone> = { Email: "blue", WhatsApp: "green", SMS: "purple", LinkedIn: "grey" };
const STEP_GLYPH: Record<StepState, { g: string; label: string }> = {
  sent: { g: "✓", label: "sent" },
  scheduled: { g: "◔", label: "scheduled" },
  draft: { g: "✎", label: "draft" },
};

/* --------------------------------- Roles --------------------------------- */

const ROLES = [
  { id: "SPD-2026", label: "Sr. Product Designer" },
  { id: "BE-2031", label: "Backend (Payments)" },
  { id: "GRAD-01", label: "Campus '26 grads" },
  { id: "FO-2029", label: "Field Ops Supervisor" },
] as const;

const roleLabelFor = (id: string) => ROLES.find((r) => r.id === id)?.label ?? id;

/* ----------------------- AI-written copy (Hirebrew voice) ----------------------- */

function aiBody(ch: Channel, lang: Lang, role: string): string {
  if (ch === "Email") {
    if (lang === "Pidgin-friendly")
      return `Hi {{first_name}},\n\nNa Adaeze from the Hirebrew talent team. Your experience fit the ${role} role wey we dey hire now — Lagos base, Port Harcourt rotation possible.\n\nYou get 20 minutes this week make we yarn? Pick a slot: {{scheduling_link}}`;
    if (lang === "Formal")
      return `Dear {{first_name}},\n\nI write on behalf of Hirebrew's talent acquisition team regarding the ${role} position. Your background was identified as a strong match during our talent-pool review.\n\nKindly indicate a convenient time for a brief introductory call: {{scheduling_link}}`;
    return `Hi {{first_name}},\n\nI'm Adaeze on the Hirebrew talent team. We're hiring a ${role} and your profile stood out in our talent pool — Lagos-based, with a Port Harcourt rotation option.\n\nOpen to a 20-minute intro this week? Grab a slot: {{scheduling_link}}`;
  }
  if (ch === "WhatsApp") {
    if (lang === "Pidgin-friendly")
      return `{{first_name}}, how far? Na Adaeze from Hirebrew Talent. That ${role} role still dey open o — make I send you the brief and pay band here? Reply STOP if you no wan hear from us again.`;
    if (lang === "Formal")
      return `Good day {{first_name}}, this is Adaeze from Hirebrew Talent Acquisition, following up on our email regarding the ${role} position. Kindly advise if you would like the full role brief. Reply STOP to opt out.`;
    return `Hello {{first_name}}, Adaeze from Hirebrew Talent here — following up on my email about the ${role} role. Happy to share the brief and pay band right here if that's easier. Reply STOP to opt out.`;
  }
  if (ch === "SMS") {
    if (lang === "Pidgin-friendly")
      return `Hirebrew Talent: {{first_name}}, the ${role} role never close. Book quick 15-min chat: {{scheduling_link}}. Reply STOP to opt out.`;
    if (lang === "Formal")
      return `Hirebrew Talent: Dear {{first_name}}, the ${role} position remains open. Kindly book an introductory call: {{scheduling_link}}. Reply STOP to opt out.`;
    return `Hirebrew Talent: {{first_name}}, still keen on the ${role} role? Book a quick intro: {{scheduling_link}}. Reply STOP to opt out.`;
  }
  return `{{first_name}}, I lead hiring for ${role} at Hirebrew. Your recent work lines up with what the team is building this quarter — open to connecting?`;
}

/* --------------------------------- Seed data --------------------------------- */

const SEED_ROLE_LABEL: Record<string, string> = { "SPD-2026": "Sr. Product Designer", "BE-2031": "Backend (Payments)", "GRAD-01": "Campus '26 grads" };

const SEED: Seq[] = [
  ...SEQUENCES.map((s, i): Seq => ({
    id: `SQ-${i + 1}`, name: s.name, role: s.role, roleLabel: SEED_ROLE_LABEL[s.role] ?? s.role,
    state: s.state, lang: "English", stats: s.stats,
    steps: s.steps.map((st) => ({ ...st, body: aiBody(st.ch, "English", SEED_ROLE_LABEL[s.role] ?? s.role) })),
    autoPaused: s.role === "GRAD-01" ? { rate: "7.1%", threshold: "5%" } : null,
  })),
  {
    id: "SQ-4", name: "Boomerang alumni — payments returners", role: "BE-2031", roleLabel: "Backend (Payments)",
    state: "draft", lang: "English", stats: null, autoPaused: null, aiDraft: true,
    grounding: "Grounded in JD BE-2031.pdf + 21 boomerang-pool profiles · confidence 86%",
    steps: [
      { ch: "Email", day: 0, state: "draft", body: aiBody("Email", "English", "Backend (Payments)") },
      { ch: "WhatsApp", day: 3, state: "draft", body: aiBody("WhatsApp", "English", "Backend (Payments)") },
      { ch: "SMS", day: 7, state: "draft", body: aiBody("SMS", "English", "Backend (Payments)") },
    ],
  },
  {
    id: "SQ-5", name: "Field Ops Supervisors — PH rotation backfill", role: "FO-2029", roleLabel: "Field Ops Supervisor",
    state: "draft", lang: "Pidgin-friendly", stats: null, autoPaused: null, aiDraft: true,
    grounding: "Grounded in JD FO-2029.pdf + PH rotation-gap brief · confidence 81%",
    steps: [
      { ch: "WhatsApp", day: 0, state: "draft", body: aiBody("WhatsApp", "Pidgin-friendly", "Field Ops Supervisor") },
      { ch: "SMS", day: 3, state: "draft", body: aiBody("SMS", "Pidgin-friendly", "Field Ops Supervisor") },
      { ch: "Email", day: 6, state: "draft", body: aiBody("Email", "Pidgin-friendly", "Field Ops Supervisor") },
    ],
  },
];

/* Generation cadence — first N of these become the drafted steps. */
const CADENCE: { ch: Channel; day: number }[] = [
  { ch: "Email", day: 0 }, { ch: "WhatsApp", day: 2 }, { ch: "SMS", day: 5 },
  { ch: "Email", day: 9 }, { ch: "WhatsApp", day: 13 }, { ch: "LinkedIn", day: 18 },
];

/* Channel comparison (open rates across all Hirebrew sends, last 90 days). */
const CH_COMPARE: { ch: Channel; open: number; reply: number; note?: string }[] = [
  { ch: "Email", open: 41, reply: 9 },
  { ch: "WhatsApp", open: 78, reply: 26, note: "Best-responding channel" },
  { ch: "SMS", open: 62, reply: 12 },
];

const ST_BADGE: Record<Sequence["state"], { label: string; tone: PfTone; dot: boolean }> = {
  running: { label: "Running", tone: "green", dot: true },
  paused: { label: "Paused", tone: "yellow", dot: true },
  draft: { label: "Draft", tone: "grey", dot: false },
};

const LANGS: Lang[] = ["English", "Pidgin-friendly", "Formal"];

/* -------------------------------- Small bits -------------------------------- */

function Lab({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 6 }}>{children}</div>;
}

function Chip({ label, active, tone = "green", dashed, icon, onClick }: {
  label: string; active: boolean; tone?: PfTone; dashed?: boolean; icon?: string; onClick: () => void;
}) {
  const t = TONE[tone];
  return (
    <button onClick={onClick} style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 99, cursor: "pointer", border: `1px ${dashed ? "dashed" : "solid"} ${active ? t.fg : "var(--pf-n100)"}`, background: active ? t.soft : "var(--pf-n0)", color: active ? t.fg : "var(--pf-n500)" }}>
      {icon && <Ic name={icon} size={13} />}
      {label}
    </button>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ fontFamily: "inherit", width: 26, height: 26, borderRadius: 7, border: "1px solid var(--pf-n100)", background: "var(--pf-n0)", color: "var(--pf-n600)", fontSize: 15, fontWeight: 600, cursor: "pointer", lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      {label}
    </button>
  );
}

const TEXTAREA: CSSProperties = { fontFamily: "inherit", fontSize: 13, lineHeight: 1.55, color: "var(--pf-n900)", padding: "10px 12px", border: "1px solid var(--pf-n100)", borderRadius: 8, outline: "none", width: "100%", minHeight: 104, resize: "vertical", background: "var(--pf-n0)", boxSizing: "border-box" };

/* ------------------------------ Step timeline chip ------------------------------ */

function StepChip({ step, index, editing, onClick }: { step: Step; index: number; editing: boolean; onClick: () => void }) {
  const t = TONE[CH_TONE[step.ch]];
  const glyph = STEP_GLYPH[step.state];
  return (
    <button
      onClick={onClick}
      title={`Step ${index + 1} · ${step.ch} · ${glyph.label} — click to edit`}
      style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 11px", borderRadius: 9, cursor: "pointer", background: t.soft, border: `1px ${step.state === "draft" ? "dashed" : "solid"} ${editing ? t.fg : t.line}`, boxShadow: editing ? `0 0 0 3px ${t.soft}` : "none", whiteSpace: "nowrap" }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.bg, flex: "none" }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: t.fg }}>{step.ch}</span>
      <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Day {step.day}</span>
      <span style={{ fontSize: 12, color: step.state === "sent" ? "var(--pf-primary-500)" : "var(--pf-n400)" }}>{glyph.g}</span>
    </button>
  );
}

/* --------------------------------- Funnel bars --------------------------------- */

function Funnel({ stats, autoPaused }: { stats: NonNullable<Seq["stats"]>; autoPaused: Seq["autoPaused"] }) {
  const rows = [
    { label: "Sent", n: stats.sent },
    { label: "Delivered", n: stats.delivered },
    { label: "Opened", n: stats.opened },
    { label: "Replied", n: stats.replied },
    { label: "Interested", n: stats.interested },
  ];
  const bounceRate = stats.sent ? Math.round((stats.bounced / stats.sent) * 1000) / 10 : 0;
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 10 }}>Funnel — this sequence</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map((r) => {
          const pct = stats.sent ? Math.round((r.n / stats.sent) * 100) : 0;
          return (
            <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 66, fontSize: 12, color: "var(--pf-n500)", flex: "none" }}>{r.label}</span>
              <div style={{ flex: 1, height: 14, background: "var(--pf-n50)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${Math.max(pct, 2)}%`, height: "100%", borderRadius: 5, background: "var(--pf-primary-500)", opacity: 0.45 + 0.55 * (pct / 100), transition: "width .3s ease" }} />
              </div>
              <span style={{ width: 30, textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{r.n}</span>
              <span style={{ width: 34, textAlign: "right", fontSize: 11.5, color: "var(--pf-n300)", fontVariantNumeric: "tabular-nums", flex: "none" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
      {/* bounced — red aside */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, background: "var(--pf-red-50)", border: "0.6px solid var(--pf-red-100)", borderRadius: 8, padding: "7px 10px" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-red-500)", flex: "none" }} />
        <span style={{ fontSize: 12, color: "var(--pf-red-500)", fontWeight: 500 }}>
          Bounced {stats.bounced} · {bounceRate}% {autoPaused ? `— crossed the ${autoPaused.threshold} auto-pause threshold` : "— within the 5% threshold"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------ Channel comparison ------------------------------ */

function ChannelCompare() {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", marginBottom: 10 }}>Channel comparison — open & reply rates (90d)</div>
      <div style={{ border: "1px solid var(--pf-n50)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 62px", gap: 8, padding: "8px 12px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Channel</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)" }}>Open</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", textAlign: "right" }}>Reply</span>
        </div>
        {CH_COMPARE.map((c) => {
          const t = TONE[CH_TONE[c.ch]];
          const best = !!c.note;
          return (
            <div key={c.ch} style={{ padding: "9px 12px", borderBottom: "1px solid var(--pf-n50)", background: best ? "var(--pf-primary-50)" : "var(--pf-n0)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 92px 62px", gap: 8, alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.bg }} />{c.ch}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 44, height: 6, background: best ? "var(--pf-primary-100)" : "var(--pf-n50)", borderRadius: 4, overflow: "hidden", display: "inline-block" }}>
                    <span style={{ display: "block", width: `${c.open}%`, height: "100%", background: t.bg, borderRadius: 4 }} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", fontVariantNumeric: "tabular-nums" }}>{c.open}%</span>
                </span>
                <span style={{ fontSize: 12.5, color: "var(--pf-n600)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.reply}%</span>
              </div>
              {best && (
                <div style={{ marginTop: 5, display: "flex" }}>
                  <PfBadge tone="green" dot>Best-responding channel — lead with WhatsApp</PfBadge>
                </div>
              )}
            </div>
          );
        })}
        <div style={{ padding: "7px 12px", fontSize: 11.5, color: "var(--pf-n400)" }}>LinkedIn optional — 23% open where profiles exist.</div>
      </div>
    </div>
  );
}

/* -------------------------------- Sequence card -------------------------------- */

const WHATSAPP_MOMENT = toolMoment("whatsapp");

function SeqCard({ q, edit, onStepClick, onEditChange, onInsert, onSaveStep, onCloseEdit, onFlip, onApprove, analyticsOpen, onAnalytics, onReviewList, whatsappOn, onConnectWhatsApp }: {
  q: Seq;
  edit: { idx: number; val: string } | null;
  onStepClick: (idx: number) => void;
  onEditChange: (val: string) => void;
  onInsert: (tag: string) => void;
  onSaveStep: () => void;
  onCloseEdit: () => void;
  onFlip: () => void;
  onApprove: () => void;
  analyticsOpen: boolean;
  onAnalytics: () => void;
  onReviewList: () => void;
  whatsappOn: boolean;
  onConnectWhatsApp: () => void;
}) {
  const { hovered, hoverProps } = useHover();
  const badge = q.autoPaused ? { label: "Auto-paused", tone: "yellow" as PfTone, dot: true } : ST_BADGE[q.state];
  const channels = Array.from(new Set(q.steps.map((s) => s.ch))).join(" + ");
  const editingStep = edit ? q.steps[edit.idx] : null;
  /**
   * This page treats WhatsApp as a first-class channel a dozen times over and
   * never once asks you to connect it. A draft that contains a WhatsApp step
   * can't launch until WhatsApp Business is wired — so the launch control
   * becomes the connect prompt, framed off the 78% already on the page.
   * The FR-046 human-approval gate is untouched: this sits in front of it.
   */
  const whatsappSteps = q.steps.filter((s) => s.ch === "WhatsApp").length;
  const blockedOnWhatsApp = q.state === "draft" && whatsappSteps > 0 && !whatsappOn;

  return (
    <PfCard {...hoverProps} style={{ boxShadow: hovered ? "0 4px 14px rgba(2,6,23,.06)" : "0 1px 3px 0 #F3F3F3", transition: "box-shadow .15s ease", borderStyle: q.state === "draft" ? "dashed" : "solid", borderColor: q.state === "draft" ? "var(--pf-n100)" : "var(--pf-n50)" }}>
      {/* head */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
        <PfTile icon="paperplane" tone={q.state === "running" ? "green" : q.state === "paused" ? "yellow" : "grey"} size={32} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>{q.name}</span>
            <PfBadge tone="grey">{q.role} · {q.roleLabel}</PfBadge>
            {q.aiDraft && <PfBadge tone="purple">✦ AI draft</PfBadge>}
          </div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3 }}>
            {q.steps.length} steps · {channels} · {q.lang}{q.stats ? ` · ${q.stats.sent} contacted` : " · nothing sent yet"}
          </div>
        </div>
        <PfBadge tone={badge.tone} dot={badge.dot}>{badge.label}</PfBadge>
        {blockedOnWhatsApp ? (
          <PfBtn variant="primary" small icon="chat" onClick={onConnectWhatsApp}>Connect WhatsApp Business</PfBtn>
        ) : q.state === "draft" ? (
          <PfBtn variant="primary" small icon="check" onClick={onApprove}>Approve & launch</PfBtn>
        ) : (
          <PfBtn variant="secondary" small icon={q.state === "running" ? "pause" : "play"} onClick={onFlip}>
            {q.state === "running" ? "Pause" : "Resume"}
          </PfBtn>
        )}
        {q.stats && (
          <PfBtn variant="secondary" small icon="trend" onClick={onAnalytics} style={analyticsOpen ? { background: "var(--pf-n50)", color: "var(--pf-n900)" } : undefined}>
            Analytics
          </PfBtn>
        )}
      </div>

      {/* WhatsApp not wired — the launch blocker, framed by what it unlocks */}
      {blockedOnWhatsApp && WHATSAPP_MOMENT && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", background: "var(--pf-yellow-50)", borderBottom: "1px solid var(--pf-n50)", flexWrap: "wrap" }}>
          <Ic name="chat" size={14} color="var(--pf-yellow-500)" />
          <div style={{ flex: 1, minWidth: 240, fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
            <b style={{ color: "var(--pf-n900)" }}>{WHATSAPP_MOMENT.unlocks}.</b>{" "}
            {whatsappSteps} of {q.steps.length} steps here {whatsappSteps === 1 ? "is" : "are"} WhatsApp, and {WHATSAPP_MOMENT.withoutIt}. {WHATSAPP_MOMENT.proof}.
          </div>
          <button onClick={onConnectWhatsApp} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, color: "var(--pf-primary-500)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Connect &amp; continue →
          </button>
        </div>
      )}

      {/* AI grounding line (drafts) */}
      {q.aiDraft && q.grounding && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "var(--pf-purple-50)", borderBottom: "1px solid var(--pf-n50)" }}>
          <Ic name="sparkle" size={13} color="var(--pf-purple-500)" />
          <span style={{ fontSize: 12, color: "var(--pf-purple-500)", fontWeight: 500 }}>{q.grounding} · nothing sends until you approve</span>
        </div>
      )}

      {/* step timeline */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 8, padding: "13px 16px" }}>
        {q.steps.map((s, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span style={{ width: 18, height: 2, background: "var(--pf-n100)", margin: "0 4px", flex: "none" }} />}
            <StepChip step={s} index={i} editing={edit?.idx === i} onClick={() => onStepClick(i)} />
          </span>
        ))}
        <span style={{ marginLeft: 10, fontSize: 11.5, color: "var(--pf-n300)" }}>click a step to edit</span>
      </div>

      {/* inline step editor */}
      {edit && editingStep && (
        <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "12px 16px 14px", background: "var(--pf-n25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: TONE[CH_TONE[editingStep.ch]].bg }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)" }}>
              Step {edit.idx + 1} — {editingStep.ch} · Day {editingStep.day}
            </span>
            <PfBadge tone={CH_TONE[editingStep.ch]}>{STEP_GLYPH[editingStep.state].label}</PfBadge>
            <span style={{ flex: 1 }} />
            <PfBtn small variant="ghost" icon="x" onClick={onCloseEdit} />
          </div>
          <textarea value={edit.val} onChange={(e) => onEditChange(e.target.value)} style={TEXTAREA} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Insert:</span>
            {["{{first_name}}", "{{role}}"].map((tag) => (
              <button key={tag} onClick={() => onInsert(tag)} style={{ fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
                {tag}
              </button>
            ))}
            <button onClick={() => onInsert("{{scheduling_link}}")} style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--pf-blue-500)", background: "var(--pf-blue-50)", border: "0.6px solid var(--pf-blue-100)", borderRadius: 6, padding: "3px 8px", cursor: "pointer" }}>
              <Ic name="calendar" size={12} />{"{{scheduling_link}}"}
            </button>
            <span style={{ flex: 1 }} />
            <PfBtn small variant="primary" icon="check" onClick={onSaveStep}>Save step</PfBtn>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, fontSize: 12, color: "var(--pf-n400)" }}>
            <Ic name="shield" size={13} color="var(--pf-primary-500)" />
            Sends only to consented contacts — NDPR opt-outs are excluded automatically and every send is logged.
          </div>
        </div>
      )}

      {/* analytics */}
      {analyticsOpen && q.stats && (
        <div style={{ borderTop: "1px solid var(--pf-n50)", padding: "14px 16px 16px" }}>
          {q.autoPaused && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pf-yellow-50)", border: "0.6px solid var(--pf-yellow-100)", borderRadius: 9, padding: "9px 12px", marginBottom: 14, flexWrap: "wrap" }}>
              <Ic name="warning" size={15} color="var(--pf-yellow-500)" />
              <span style={{ flex: 1, minWidth: 220, fontSize: 12.5, fontWeight: 500, color: "var(--pf-yellow-500)" }}>
                Paused automatically — bounce rate {q.autoPaused.rate} crossed the {q.autoPaused.threshold} threshold (FR-047 guard)
              </span>
              <PfBtn small variant="secondary" onClick={onReviewList}>Review list quality</PfBtn>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }}>
            <Funnel stats={q.stats} autoPaused={q.autoPaused} />
            <ChannelCompare />
          </div>
        </div>
      )}
    </PfCard>
  );
}

/* ----------------------------------- Screen ----------------------------------- */

export default function Sequences() {
  const go = useGo();
  const toast = useToast();
  const { isConnected, connect } = useWorkspace();
  const whatsappOn = isConnected("whatsapp");

  const [seqs, setSeqs] = useState<Seq[]>(SEED);
  const [edit, setEdit] = useState<{ seq: string; idx: number; val: string } | null>(null);
  const [analytics, setAnalytics] = useState<string | null>("SQ-1");
  const [tab, setTab] = useState("sequences");
  const [gRole, setGRole] = useState<string>("SPD-2026");
  const [gJd, setGJd] = useState(true);
  const [gLang, setGLang] = useState<Lang>("English");
  const [gSteps, setGSteps] = useState(4);
  const [genCount, setGenCount] = useState(0);

  const drafts = seqs.filter((s) => s.state === "draft").length;
  const running = seqs.filter((s) => s.state === "running").length;

  /* ------------------------------- actions ------------------------------- */

  const generate = () => {
    const label = roleLabelFor(gRole);
    const n = genCount + 1;
    const id = `SQ-G${n}`;
    const seq: Seq = {
      id, name: `${label} — AI outreach${n > 1 ? ` v${n}` : ""}`, role: gRole, roleLabel: label,
      state: "draft", lang: gLang, stats: null, autoPaused: null, aiDraft: true,
      grounding: `Grounded in ${gJd ? `JD ${gRole}.pdf + ` : ""}Hirebrew voice profile v3 · ${gLang} · confidence 84%`,
      steps: CADENCE.slice(0, gSteps).map((c) => ({ ...c, state: "draft" as StepState, body: aiBody(c.ch, gLang, label) })),
    };
    setSeqs((xs) => [...xs, seq]);
    setGenCount(n);
    setTab("sequences");
    toast("Drafted in Hirebrew's employer voice — review before anything sends", "ai");
  };

  const flip = (q: Seq) => {
    if (q.state === "running") {
      const held = q.steps.filter((s) => s.state === "scheduled").length;
      setSeqs((xs) => xs.map((x) => (x.id === q.id ? { ...x, state: "paused" } : x)));
      toast(`"${q.name}" paused — ${held} scheduled send${held === 1 ? "" : "s"} held`);
    } else {
      const wasAuto = !!q.autoPaused;
      setSeqs((xs) => xs.map((x) => (x.id === q.id ? { ...x, state: "running", autoPaused: null } : x)));
      toast(wasAuto ? `"${q.name}" resumed after list review — bounce guard re-armed at 5%` : `"${q.name}" resumed — next step sends on schedule`, "success");
    }
  };

  const approve = (q: Seq) => {
    setSeqs((xs) => xs.map((x) => (x.id === q.id ? { ...x, state: "running", aiDraft: false, steps: x.steps.map((s) => ({ ...s, state: s.state === "draft" ? "scheduled" : s.state })) } : x)));
    toast(`"${q.name}" approved & launched — ${q.steps.length} steps scheduled to consented contacts only`, "success");
  };

  const saveStep = () => {
    if (!edit) return;
    const q = seqs.find((x) => x.id === edit.seq);
    const st = q?.steps[edit.idx];
    setSeqs((xs) => xs.map((x) => (x.id === edit.seq ? { ...x, steps: x.steps.map((s, i) => (i === edit.idx ? { ...s, body: edit.val } : s)) } : x)));
    if (st) toast(`Step ${edit.idx + 1} (${st.ch} · Day ${st.day}) saved — sends only to consented contacts`, "success");
    setEdit(null);
  };

  const reviewList = () => {
    toast("List-quality report: 6 of 8 bounces are stale @unilag.edu.ng addresses from the May career-fair import — remove to resume", "ai");
  };

  /** In-flow, at the moment it blocks a launch — never a settings chore. */
  const connectWhatsApp = () => {
    connect("whatsapp");
    toast(
      WHATSAPP_MOMENT
        ? `WhatsApp Business connected — ${WHATSAPP_MOMENT.unlocks}. ${WHATSAPP_MOMENT.proof}.`
        : "WhatsApp Business connected",
      "success",
    );
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, flex: 1, minWidth: 280 }}>
          <PfTile icon="paperplane" tone="green" size={34} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>Outreach Sequences</div>
            <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 1 }}>
              Email · WhatsApp · SMS — the channels Nigerian talent actually answers · {running} running
            </div>
          </div>
        </div>
        <PfBtn variant="primary" icon="sparkle" onClick={() => setTab(tab === "generator" ? "sequences" : "generator")}>Generate sequence</PfBtn>
      </div>

      {/* Approval gate banner — page-wide, stays above the section bar */}
      {drafts > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 10, padding: "11px 16px" }}>
          <Ic name="warning" size={17} color="var(--pf-yellow-500)" />
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "var(--pf-yellow-500)" }}>
            {drafts} sequence{drafts === 1 ? "" : "s"} awaiting your approval — nothing sends without human sign-off (FR-046 gate).
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--pf-primary-50)", border: "1px solid var(--pf-primary-100)", borderRadius: 10, padding: "11px 16px" }}>
          <Ic name="check" size={17} color="var(--pf-primary-500)" />
          <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: "var(--pf-primary-500)" }}>
            All sequences approved — human sign-off recorded on every launch (FR-046 gate).
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "sequences", label: "Sequences", count: String(seqs.length) },
            { key: "generator", label: "Generator" },
          ]}
        />
      </div>

      {/* GENERATOR */}
      {tab === "generator" && (
        <PfCard style={{ marginBottom: 12, borderColor: "var(--pf-primary-100)" }}>
          <PfCardHead title={<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Ic name="sparkle" size={15} color="var(--pf-purple-500)" />Generate a sequence</span>} sub="AI drafts every step in Hirebrew's employer voice — it launches only after your approval">
            <PfBadge tone="purple">AI proposes · you approve</PfBadge>
          </PfCardHead>
          <div style={{ padding: "14px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <Lab>Role</Lab>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ROLES.map((r) => (
                  <Chip key={r.id} label={`${r.label} · ${r.id}`} active={gRole === r.id} onClick={() => setGRole(r.id)} />
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <Lab>Grounding</Lab>
                <Chip
                  label={gJd ? `JD linked · ${gRole}.pdf` : "Link JD"}
                  active={gJd} tone="blue" dashed={!gJd} icon="file"
                  onClick={() => setGJd((v) => !v)}
                />
              </div>
              <div>
                <Lab>Language</Lab>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LANGS.map((l) => <Chip key={l} label={l} active={gLang === l} onClick={() => setGLang(l)} />)}
                </div>
              </div>
              <div>
                <Lab>Steps (3–6)</Lab>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StepBtn label="−" onClick={() => setGSteps((n) => Math.max(3, n - 1))} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--pf-n900)", width: 58, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{gSteps} steps</span>
                  <StepBtn label="+" onClick={() => setGSteps((n) => Math.min(6, n + 1))} />
                </div>
              </div>
            </div>
            {/* cadence preview */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 6 }}>
              {CADENCE.slice(0, gSteps).map((c, i) => {
                const t = TONE[CH_TONE[c.ch]];
                return (
                  <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
                    {i > 0 && <span style={{ width: 14, height: 2, background: "var(--pf-n100)", margin: "0 4px" }} />}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: t.fg, background: t.soft, border: `0.6px solid ${t.line}`, borderRadius: 6, padding: "3px 8px" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.bg }} />{c.ch} · Day {c.day}
                    </span>
                  </span>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1 }}>Drafts land below for review — nothing is sent until a human approves (FR-046).</span>
              <PfBtn variant="secondary" onClick={() => setTab("sequences")}>Cancel</PfBtn>
              <PfBtn variant="primary" icon="sparkle" onClick={generate}>Generate</PfBtn>
            </div>
          </div>
        </PfCard>
      )}

      {/* SEQUENCES */}
      {tab === "sequences" && (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {seqs.map((q) => (
          <SeqCard
            key={q.id}
            q={q}
            edit={edit && edit.seq === q.id ? { idx: edit.idx, val: edit.val } : null}
            onStepClick={(idx) => setEdit(edit && edit.seq === q.id && edit.idx === idx ? null : { seq: q.id, idx, val: q.steps[idx].body })}
            onEditChange={(val) => setEdit((e) => (e ? { ...e, val } : e))}
            onInsert={(tag) => setEdit((e) => (e ? { ...e, val: e.val + (e.val.endsWith(" ") || e.val === "" ? "" : " ") + tag } : e))}
            onSaveStep={saveStep}
            onCloseEdit={() => setEdit(null)}
            onFlip={() => flip(q)}
            onApprove={() => approve(q)}
            analyticsOpen={analytics === q.id}
            onAnalytics={() => { setAnalytics(analytics === q.id ? null : q.id); }}
            onReviewList={reviewList}
            whatsappOn={whatsappOn}
            onConnectWhatsApp={connectWhatsApp}
          />
        ))}
      </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 22, fontSize: 12.5, color: "var(--pf-n400)", flexWrap: "wrap" }}>
        <Ic name="shield" size={14} color="var(--pf-primary-500)" />
        <span>Consent-gated (NDPR) · every send logged · replies land in</span>
        <button onClick={() => go("messages")} style={{ fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--pf-primary-500)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          Messages<Ic name="arrowright" size={13} />
        </button>
      </div>
    </div>
  );
}
