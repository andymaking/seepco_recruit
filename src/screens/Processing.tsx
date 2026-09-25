"use client";
import { useEffect, useMemo, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useWorkspace } from "@/state/workspace";
import { PfBadge, PfBtn, PfCard, PfCardHead, PfProgress, PfTile } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { SCREEN_STEPS, SANDBOX_ROLE, SEED_BACKLOG } from "@/data/recruiterOnboarding";

/**
 * The overnight screening run.
 *
 * This surface was fully designed and completely orphaned — nothing in the app
 * ever navigated to it, and it hardcoded "68%" and "32 of 47". It is now the
 * bridge the aha moment was missing: the backlog import hands it a real
 * BacklogImport record (imported count + target role, via the workspace
 * store's `lastImport`, falling back to the seeded backlog on a cold visit),
 * it drives the five SCREEN_STEPS on their real shares, and it ends where the
 * story has always ended — Screening's ranked, explained shortlist.
 */

/** Total run length. Long enough to read, short enough to sit through. */
const RUN_MS = 13_000;
const TICK_MS = 80;

/** Where each step starts and ends on the 0–100 bar (shares sum to 1). */
const BOUNDS = SCREEN_STEPS.reduce<{ from: number; to: number }[]>((acc, s) => {
  const from = acc.length ? acc[acc.length - 1].to : 0;
  return [...acc, { from, to: from + s.share * 100 }];
}, []);

export default function Processing() {
  const go = useGo();
  const toast = useToast();
  const { workspace, lastImport, markDone, hydrated } = useWorkspace();

  const [pct, setPct] = useState(0);

  const sample = workspace.sandbox;
  const imp = lastImport ?? SEED_BACKLOG;

  const total = sample ? SANDBOX_ROLE.applicants : imp.imported;
  const roleTitle = sample ? SANDBOX_ROLE.title : imp.targetRole;
  const startedAt = sample ? "22:40" : imp.at;
  const readyAt = imp.screenedAt ?? "04:12";

  /* The outcome, scaled from the run the whole app already narrates: 212 in,
     12 ranked, 9 knocked out with cited reasons. */
  const shortlisted = sample ? SANDBOX_ROLE.shortlisted : imp.shortlisted ?? Math.max(5, Math.round((total * 12) / 212));
  const knockedOut = sample ? SANDBOX_ROLE.knockedOut : imp.knockedOut ?? Math.max(3, Math.round((total * 9) / 212));

  const done = pct >= 100;

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setPct((p) => Math.min(100, p + (100 / (RUN_MS / TICK_MS)) * (0.8 + Math.random() * 0.4))), TICK_MS);
    return () => clearInterval(t);
  }, [done]);

  /* Stamp the clock the moment the shortlist exists — sample runs never do. */
  useEffect(() => {
    if (!done || sample || !hydrated) return;
    markDone("shortlist");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, sample, hydrated]);

  const rows = useMemo(
    () =>
      SCREEN_STEPS.map((s, i) => {
        const { from, to } = BOUNDS[i];
        const span = Math.max(0.0001, to - from);
        const p = Math.max(0, Math.min(1, (pct - from) / span));
        return { ...s, p, state: p >= 1 ? "done" : p > 0 ? "running" : "queued", count: Math.round(p * total) };
      }),
    [pct, total],
  );

  const running = rows.find((r) => r.state === "running");
  const scored = Math.round((pct / 100) * total);
  const eta = Math.max(0, Math.round(((100 - pct) / 100) * (RUN_MS / 1000)));

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 780, margin: "0 auto", fontFamily: "var(--pf-font)" }}>
      {/* ------------------------------ Headline ------------------------------ */}
      <PfCard style={{ marginBottom: 12 }}>
        <div style={{ padding: "30px 32px", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <span style={{ width: 60, height: 60, borderRadius: 14, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", color: "var(--pf-purple-500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
              <span style={{ display: "inline-block", animation: done ? "none" : "pulseDot 1.6s infinite" }}>{done ? "✓" : "✦"}</span>
            </span>
          </div>

          <h1 style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700, letterSpacing: "-.4px", color: "var(--pf-n900)" }}>
            {done ? `${total} applications became a ranked ${shortlisted}` : "AI is screening your backlog…"}
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--pf-n400)", marginBottom: 18 }}>
            {roleTitle} · {total} CVs · scored against the rubric you approved
          </div>

          <div style={{ maxWidth: 440, margin: "0 auto 8px" }}>
            <PfProgress pct={pct} tone={done ? "green" : "purple"} height={9} />
          </div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)", fontFamily: "var(--mono)" }}>
            {done
              ? `${total} of ${total} scored · finished ${readyAt}`
              : `${scored} of ${total} scored · ~${eta}s remaining`}
          </div>

          {!done && (
            <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 999, padding: "6px 14px" }}>
              <Ic name="clock" size={13} color="var(--pf-n400)" />
              <span style={{ fontSize: 11.5, color: "var(--pf-n500)" }}>
                Imported {startedAt} · you&apos;ll have a ranked, explained shortlist by morning. Close the laptop.
              </span>
            </div>
          )}
        </div>
      </PfCard>

      {/* ------------------------------- Steps -------------------------------- */}
      <PfCard style={{ marginBottom: 12 }}>
        <PfCardHead title="Run detail" sub={running ? running.detail : "Every step is logged — the run is replayable and auditable"}>
          <PfBadge tone={done ? "green" : "purple"} dot>{done ? "Complete" : "Running"}</PfBadge>
        </PfCardHead>
        <div style={{ padding: "6px 22px 16px" }}>
          {rows.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--pf-n50)" }}>
              <span
                style={{
                  width: 22, height: 22, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: s.state === "queued" ? "var(--pf-n400)" : "#fff",
                  background: s.state === "done" ? "var(--pf-primary-500)" : s.state === "running" ? "var(--pf-purple-500)" : "var(--pf-n50)",
                  animation: s.state === "running" ? "pulseDot 1.4s infinite" : "none",
                }}
              >
                {s.state === "done" ? "✓" : s.state === "running" ? "✦" : "·"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.state === "queued" ? "var(--pf-n400)" : "var(--pf-n900)" }}>{s.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 1, lineHeight: 1.45 }}>{s.detail}</div>
              </div>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 600, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
                {s.state === "queued" ? "Queued" : `${s.count} / ${total}`}
              </span>
            </div>
          ))}
        </div>
      </PfCard>

      {/* ------------------------------ The payoff ---------------------------- */}
      {done ? (
        <PfCard style={{ background: "var(--pf-primary-50)", borderColor: "var(--pf-primary-100)" }}>
          <div style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <PfTile icon="check" tone="green" size={30} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>Shortlist ready · {readyAt}</div>
                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", marginTop: 2 }}>
                  {shortlisted} ranked matches · {knockedOut} knockout rejections, each with its cited reason · fairness audit attached
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PfBtn
                variant="primary" icon="users"
                onClick={() => {
                  if (!sample) markDone("shortlist");
                  toast(`${total} screened → ${shortlisted} ranked, ${knockedOut} rejected with reasons. Every score opens into its evidence.`, "ai");
                  go("screening");
                }}
              >
                Review the ranked {shortlisted} →
              </PfBtn>
              <PfBtn icon="star" onClick={() => go("shortlist")}>Open the tiered shortlist</PfBtn>
              <PfBtn icon="shield" onClick={() => toast("Run log — every parse, knockout, score and fairness check is replayable and NDPR-explainable", "default")}>
                View the run log
              </PfBtn>
            </div>
          </div>
        </PfCard>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>You&apos;ll be notified the moment the shortlist is ready.</span>
          <PfBtn onClick={() => { setPct(100); toast("Fast-forwarded — this run normally finishes while you sleep", "default"); }}>
            Skip to the result →
          </PfBtn>
        </div>
      )}
    </div>
  );
}
