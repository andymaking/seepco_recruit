"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PfPageTabs } from "@/components/os/ui";
import { useToast } from "@/state/toast";
import { useGo } from "@/state/app";
import { useHover } from "@/lib/useHover";
import { NEW_HIRE, PLAN_30_60_90, PREBOARD_NUDGES, PROVISIONING, type ProvisionItem } from "@/data/onboarding";

type OnboardTask = { icon: string; name: string; status: string; color: string; bg: string };

const PROV_TONE: Record<ProvisionItem["state"], { icon: string; color: string; bg: string }> = {
  active: { icon: "✓", color: "#129152", bg: "#ECF9F3" },
  scheduled: { icon: "·", color: "#64748B", bg: "#F8FAFC" },
  failed: { icon: "!", color: "#E81E17", bg: "#FDECEC" },
};

/**
 * The provisioning rows are `PROVISIONING` itself, not the raw `SYSTEMS` list.
 * `NEW_HIRE` is already past day one, so the accounts that have been granted
 * have to read the same to the recruiter here as they do to the hire on
 * /welcome. One hire, one live state, held in one place.
 */
const onboardTasks: OnboardTask[] = [
  { icon: "✓", name: "Employment contract", status: "Generated", color: "#129152", bg: "#ECF9F3" },
  { icon: "✓", name: "NDA", status: "Generated", color: "#129152", bg: "#ECF9F3" },
  { icon: "✓", name: "ESOP grant letter", status: "Generated", color: "#129152", bg: "#ECF9F3" },
  ...PROVISIONING.map((p) => ({
    ...PROV_TONE[p.state],
    name: p.sys,
    status:
      p.state === "active" ? (p.grantedAt ? `Granted ${p.grantedAt}` : "Granted")
      : p.state === "failed" ? "Grant failed"
      : "Not granted yet",
  })),
  { icon: "·", name: "Statutory forms (PAYE, pension)", status: "Pending hire", color: "#64748B", bg: "#F8FAFC" },
];

const PROV_LIVE = PROVISIONING.filter((p) => p.state === "active").length;

const DAY_TONE: Record<number, { bg: string; color: string }> = {
  30: { bg: "#ECF9F3", color: "#16B364" },
  60: { bg: "#F7EEFC", color: "#AF52DE" },
  90: { bg: "#ECF9F3", color: "#16B364" },
};

const planApproved = PLAN_30_60_90.approval.state !== "ai-draft";

const TABS = ["docs", "plan", "nudges"] as const;
type TabKey = (typeof TABS)[number];
const isTab = (v: string | null): v is TabKey => TABS.includes(v as TabKey);

function TaskRow({ t, checked, onToggle }: { t: OnboardTask; checked: boolean; onToggle: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onToggle}
      style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 0", borderBottom: "1px solid var(--border2)", cursor: "pointer", opacity: hovered ? 0.85 : 1 }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 6, background: t.bg, color: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{checked ? t.icon : "·"}</span>
      <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{t.name}</div>
      <span style={{ fontSize: 11, fontWeight: 600, color: t.color }}>{t.status}</span>
    </div>
  );
}

function ActionButton({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: "inherit",
        fontWeight: 600,
        fontSize: 12.5,
        padding: "10px 14px",
        borderRadius: 8,
        cursor: "pointer",
        background: primary ? "var(--ink)" : "#fff",
        color: primary ? "#fff" : "var(--ink)",
        border: primary ? "none" : "1px solid var(--border)",
        opacity: hovered ? 0.9 : 1,
      }}
    >
      {label}
    </button>
  );
}

/**
 * The cockpit chases the 30/60/90 approval by deep-linking a manager straight
 * at the draft (`/onboarding?tab=plan`), so the opening tab has to come off the
 * query string. Reading it bails this subtree out of prerendering, which is why
 * the boundary is required rather than decorative — the route is static.
 */
export default function Onboarding() {
  return (
    <Suspense fallback={<OnboardingScreen initialTab="docs" />}>
      <OnboardingDeepLink />
    </Suspense>
  );
}

function OnboardingDeepLink() {
  const tab = useSearchParams().get("tab");
  return <OnboardingScreen initialTab={isTab(tab) ? tab : "docs"} />;
}

function OnboardingScreen({ initialTab }: { initialTab: TabKey }) {
  const toast = useToast();
  const go = useGo();
  const [checked, setChecked] = useState<boolean[]>(() => onboardTasks.map((t) => t.icon !== "·"));
  const [tab, setTab] = useState<string>(initialTab);

  const toggle = (i: number) => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)));
  const done = checked.filter(Boolean).length;

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Header + primary CTA */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>STAGE 10 · ONBOARDING</div>
          <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>A day one that feels intentional</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>AI generates contracts, provisions accounts, builds the 30/60/90 plan, and answers new-hire questions before they ask.</div>
        </div>
        {/* This page is ONE hire. The cohort, the workforce rollout and every
            onboarding metric live in the Talent OS cockpit — linked, never copied. */}
        <div style={{ flex: "none", display: "flex", gap: 10 }}>
          <ActionButton label="Open the cockpit ↗" onClick={() => go("onboardhub")} />
          <ActionButton label="Send documents" primary onClick={() => toast("Onboarding documents sent for e-sign", "success")} />
        </div>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "docs", label: "Documents & provisioning", count: `${done}/${onboardTasks.length}` },
            { key: "plan", label: "30 / 60 / 90 plan", count: String(PLAN_30_60_90.milestones.length), badge: planApproved ? "APPROVED" : "AI DRAFT" },
            { key: "nudges", label: "Pre-boarding nudges", count: String(PREBOARD_NUDGES.length) },
          ]}
        />
      </div>

      {/* DOCUMENTS & PROVISIONING — e-sign pack + day-one accounts */}
      {tab === "docs" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", maxWidth: 680 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 13 }}>Documents &amp; provisioning</div>
          {onboardTasks.map((t, i) => (
            <TaskRow key={t.name} t={t} checked={checked[i]} onToggle={() => toggle(i)} />
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <ActionButton label="Send documents" primary onClick={() => toast("Onboarding documents sent for e-sign", "success")} />
            <ActionButton label="Provision accounts" onClick={() => toast(`Provisioning re-run — ${PROV_LIVE} of ${PROVISIONING.length} already active`, "success")} />
          </div>
        </div>
      )}

      {/* 30/60/90 PLAN — milestones + matched buddies */}
      {tab === "plan" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", maxWidth: 680 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>30 / 60 / 90-day plan</div>
          {!planApproved && (
            <div style={{ marginBottom: 14, padding: "11px 12px", background: "#FEF7E6", border: "1px solid #FDEECE", borderRadius: 10, fontSize: 12, color: "#8F6304", lineHeight: 1.5 }}>
              <b>AI draft — not released.</b> Drafted {PLAN_30_60_90.approval.draftedAt} from {PLAN_30_60_90.approval.drafter}. {PLAN_30_60_90.approval.manager} approves it on her manager home; until she does, {NEW_HIRE.name.split(" ")[0]} sees none of it.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PLAN_30_60_90.milestones.map((m) => {
              const tone = DAY_TONE[m.day];
              return (
                <div key={m.day} style={{ display: "flex", gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: tone.bg, color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flex: "none", fontFamily: "var(--mono)" }}>{m.day}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.45 }}>{m.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, padding: "11px 12px", background: "#F7EEFC", border: "1px solid var(--aibd)", borderRadius: 10, fontSize: 12, color: "#9741CE", lineHeight: 1.5 }}>
            <b>Buddies matched:</b> Ngozi (culture) · Tobi (domain) — by team graph + working-style alignment.
          </div>
        </div>
      )}

      {/* PRE-BOARDING NUDGES — offer accepted → day one */}
      {tab === "nudges" && (
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 13 }}>Pre-boarding nudges <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink3)" }}>· offer accepted → day one</span></div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {PREBOARD_NUDGES.map((n) => (
              <div key={n.when} style={{ flex: "none", width: 200, background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 11, padding: "13px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#AF52DE", letterSpacing: ".4px" }}>{n.when}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: ".3px", padding: "2px 6px", borderRadius: 5, color: n.delivered ? "#129152" : "#8F6304", background: n.delivered ? "#ECF9F3" : "#FEF7E6" }}>
                    {n.delivered ? "DELIVERED" : n.state === "sent" ? "SMS FALLBACK" : "SCHEDULED"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.45 }}>{n.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
