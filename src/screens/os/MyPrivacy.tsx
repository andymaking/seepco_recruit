"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { useMe } from "@/state/me";
import {
  PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfTabs, PfPageTabs,
  PfTh, PfBanner, TONE, type PfTone,
} from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import {
  ME_PUBLIC, MY_MANAGER, MY_VISIBILITY, MY_VISIBILITY_CALLOUT,
  MY_EXPLANATION, MY_CONSENT,
} from "@/data/me";

/**
 * Your data & privacy (route /my-privacy) — the subject's side of the
 * transparency layer.
 *
 * This page invents nothing. All twelve visibility rows, all four automated
 * decisions and the whole consent receipt already exist in the seeded record —
 * they have simply only ever rendered inside HR's /onboarding-hub, which is to
 * say: everywhere except in front of the person they are about.
 *
 * The invariant that shapes every line below: a row may disclose that a value
 * EXISTS and who can see it, and must never disclose the value. The leave-risk
 * score is the worked example — item, why and source render; no number does,
 * here or anywhere else in the Me pillar.
 *
 * Second person throughout, because it is hers. Writes go through useMe(), and
 * they land in the activity log at the foot of the page, which is the other half
 * of the deal: what they hold about you, and what you did.
 */

/* ---------------------------------- types ---------------------------------- */

type See = "sees" | "sees-summary" | "no";
type VisRow = (typeof MY_VISIBILITY)[number];
type Clause = (typeof MY_CONSENT)["clauses"][number];
type Decision = (typeof MY_EXPLANATION)["decisions"][number];

/* --------------------------------- constants -------------------------------- */

/** Three distinct treatments — the whole matrix is legible from the legend alone. */
const SEE: Record<See, { label: string; tone: PfTone; hint: string }> = {
  sees: { label: "Sees", tone: "blue", hint: "the full detail, in your words" },
  "sees-summary": { label: "Summary", tone: "yellow", hint: "an aggregate only — never your wording" },
  no: { label: "Hidden", tone: "green", hint: "not visible to them at all" },
};

const VIS_GRID = "minmax(0,1.15fr) 112px 112px minmax(0,1.5fr)";

const VIS_FILTERS = ["All rows", "Hidden from your manager", "Summary only"] as const;

const CALLOUT: VisRow = MY_VISIBILITY[MY_VISIBILITY_CALLOUT];

const HIDDEN_FROM_MANAGER = MY_VISIBILITY.filter((r) => r.manager === "no").length;

const CLAUSES = MY_CONSENT.clauses;

/** Per-decision framing. The `what` strings are the keys the store records against. */
const DECISION_META: Record<string, { icon: string; tone: PfTone; note: string; link: { label: string; kind: "go" | "tab"; target: string } }> = {
  "Leave-risk score": {
    icon: "warning", tone: "yellow",
    note: "You will not find the value on this page, and you will not find it on any other page in your workspace either. What this page owes you is that the score exists, who holds it, what it is built from — and that it never triggers an automated action on its own.",
    link: { label: "See who can see it", kind: "tab", target: "visibility" },
  },
  "Internal mobility match %": {
    icon: "swap", tone: "blue",
    note: "You are the only viewer. Which roles you browsed, matched or declined is not on anyone else's screen — only an invitation you accept ever surfaces.",
    link: { label: "Open your matches", kind: "go", target: "mymobility" },
  },
  "Growth readiness estimate": {
    icon: "trend", tone: "purple",
    note: "This one is shown to you, which is the point of it — an estimate you can read is an estimate you can argue with in a 1-on-1.",
    link: { label: "Open your growth plan", kind: "go", target: "mygrowth" },
  },
  "Quality-of-hire score, day 90": {
    icon: "star", tone: "grey",
    note: "Clause 2 of your consent receipt — the one that would have kept your screening media attached to this measure — was declined at conversion, and the media was deleted in Nov 2025 on the retention schedule.",
    link: { label: "Open clause 2", kind: "tab", target: "consent" },
  },
};

/** The subject-facing line for each clause: what it means for you, not for the file. */
const CLAUSE_NOTE: Record<string, string> = {
  c1: "This is the clause your employee record stands on — the CV, the skills baseline and the scorecards that became your profile and your competency starting point.",
  c2: "You declined it. That is why your screening video and assessment results were deleted in Nov 2025 rather than kept attached to your record.",
  c3: "Legal obligation, not consent. There is no box to untick: PAYE and pension filings are required by law, so this processing does not depend on your permission and cannot be withdrawn. Showing you a switch that would not work would be the dishonest option.",
  c4: "Revocable at any time, and the channels themselves are yours to turn off one by one.",
  c5: "Accepting this is what made an internal-mobility scan of your profile lawful — it is the basis for every match on your Internal roles page.",
};

const BASIS_CHIPS = (basis: string) => basis.split(",").map((s) => s.trim()).filter(Boolean);

const recordLabel = {
  fontSize: 11, fontWeight: 500, color: "var(--pf-n400)", letterSpacing: ".2px", textTransform: "uppercase" as const,
};

/* ------------------------------- see-glyph -------------------------------- */

/** Full / half / empty ring — so the three states read without the label. */
function SeeGlyph({ kind, size = 13 }: { kind: See; size?: number }) {
  const t = TONE[SEE[kind].tone];
  if (kind === "no") {
    return <span style={{ width: size, height: size, borderRadius: "50%", border: `1.5px dashed var(--pf-n300)`, flex: "none", display: "inline-block" }} />;
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", flex: "none", display: "inline-block",
        border: `1.5px solid ${t.bg}`,
        background: kind === "sees" ? t.bg : `linear-gradient(90deg, ${t.bg} 50%, var(--pf-n0) 50%)`,
      }}
    />
  );
}

function SeeCell({ kind }: { kind: See }) {
  const meta = SEE[kind];
  const t = TONE[meta.tone];
  return (
    <span
      title={meta.hint}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%",
        fontSize: 11.5, fontWeight: 600, color: t.fg, background: t.soft, border: `0.6px solid ${t.line}`,
        borderRadius: 6, padding: "5px 8px", lineHeight: 1.35,
      }}
    >
      <SeeGlyph kind={kind} size={11} />
      {meta.label}
    </span>
  );
}

/* ------------------------------ visibility row ----------------------------- */

function VisibilityRowView({ r, isCallout, last }: { r: VisRow; isCallout: boolean; last: boolean }) {
  const toast = useToast();
  const { hovered, hoverProps } = useHover();
  const bg = isCallout
    ? (hovered ? "var(--pf-yellow-100)" : "var(--pf-yellow-50)")
    : (hovered ? "var(--pf-n25)" : "transparent");
  return (
    <div
      {...hoverProps}
      onClick={() =>
        toast(`${r.item} — your manager: ${SEE[r.manager].label.toLowerCase()}; HR: ${SEE[r.hr].label.toLowerCase()} · cited from ${r.source}`)
      }
      style={{
        display: "grid", gridTemplateColumns: VIS_GRID, gap: 12, alignItems: "flex-start",
        padding: "13px 20px 13px 18px", cursor: "pointer", background: bg,
        borderLeft: `2px solid ${isCallout ? "var(--pf-yellow-500)" : "transparent"}`,
        borderBottom: last ? "none" : "1px solid var(--pf-n50)",
        transition: "background .12s ease",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{r.item}</div>
        {isCallout && (
          <div style={{ marginTop: 6 }}>
            <PfBadge tone="yellow" dot>Access-logged, every single view</PfBadge>
          </div>
        )}
      </div>
      <SeeCell kind={r.manager as See} />
      <SeeCell kind={r.hr as See} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{r.why}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 11, color: "var(--pf-n300)", minWidth: 0 }}>
          <Ic name="file" size={11} color="var(--pf-n300)" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.source}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ decision card ------------------------------ */

function DecisionCard({ d, requested, onRequest, onLink }: {
  d: Decision;
  requested?: { at: string; dueBy: string };
  onRequest: () => void;
  onLink: () => void;
}) {
  const meta = DECISION_META[d.what];
  const { hovered, hoverProps } = useHover();
  return (
    <PfCard style={{ display: "flex", flexDirection: "column", ...(hovered ? { boxShadow: "0 2px 8px 0 #eeeeee" } : {}), transition: "box-shadow .12s ease" }}>
      <div {...hoverProps} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <PfTile icon={meta.icon} tone={meta.tone} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{d.what}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="user" size={12} color="var(--pf-n300)" />
              Seen by <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{d.who}</span>
            </div>
          </div>
        </div>

        <div>
          <div style={recordLabel}>Built from</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
            {BASIS_CHIPS(d.basis).map((b) => (
              <span key={b} style={{ fontSize: 11.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 5, padding: "3px 7px" }}>
                {b}
              </span>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{meta.note}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--pf-n600)", background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "8px 10px" }}>
          <Ic name="arrowright" size={13} color="var(--pf-primary-500)" />
          <span><span style={{ fontWeight: 600 }}>Your move — </span>{d.yourMove}</span>
        </div>

        <div style={{ flex: 1 }} />

        {requested ? (
          <div style={{ background: "var(--pf-blue-50)", border: "1px solid var(--pf-blue-100)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--pf-blue-500)" }}>
              <Ic name="clock" size={14} color="var(--pf-blue-500)" />
              A person answers by {requested.dueBy}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 4 }}>
              Requested {requested.at} · {MY_EXPLANATION.slaDays}-day SLA · your request is on the record
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <PfBtn small variant="primary" icon="question" onClick={onRequest}>Request an explanation</PfBtn>
            <PfBtn small variant="secondary" onClick={onLink}>{meta.link.label}</PfBtn>
          </div>
        )}
        {requested && (
          <PfBtn small variant="secondary" onClick={onLink} style={{ alignSelf: "flex-start" }}>{meta.link.label}</PfBtn>
        )}
      </div>
    </PfCard>
  );
}

/* ------------------------------- clause row -------------------------------- */

function ClauseRow({ c, accepted, last, children }: { c: Clause; accepted: boolean; last: boolean; children?: ReactNode }) {
  const withdrawn = c.id === "c5" && !accepted;
  const basisTone: PfTone = c.lawfulBasis === "Consent" ? "purple" : c.lawfulBasis === "Contract" ? "blue" : "grey";
  return (
    <div style={{ padding: "16px 20px", borderBottom: last ? "none" : "1px solid var(--pf-n50)", display: "flex", gap: 13, alignItems: "flex-start" }}>
      <span
        style={{
          width: 30, height: 30, borderRadius: 8, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11.5, fontWeight: 700, letterSpacing: ".3px",
          color: accepted ? "var(--pf-primary-600)" : "var(--pf-n400)",
          background: accepted ? "var(--pf-primary-50)" : "var(--pf-n50)",
          border: `1px solid ${accepted ? "var(--pf-primary-100)" : "var(--pf-n100)"}`,
        }}
      >
        {c.id}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.4 }}>{c.purpose}</div>
          {withdrawn ? (
            <PfBadge tone="red" dot>Withdrawn</PfBadge>
          ) : accepted ? (
            <PfBadge tone="green">✓ Accepted</PfBadge>
          ) : (
            <PfBadge tone="grey">✕ Declined</PfBadge>
          )}
        </div>

        {/* was → now */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 9 }}>
          {c.wasFor === "—" ? (
            <PfBadge tone="grey">New at conversion</PfBadge>
          ) : (
            <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>
              Was for <span style={{ fontWeight: 600, color: "var(--pf-n500)" }}>{c.wasFor.toLowerCase()}</span>
            </span>
          )}
          <Ic name="arrowright" size={13} color="var(--pf-n300)" />
          <span style={{ fontSize: 12, color: "var(--pf-n600)", fontWeight: 600 }}>{c.nowFor}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 9 }}>
          <PfBadge tone={basisTone}>{c.lawfulBasis}</PfBadge>
          <PfBadge tone="grey">{c.required ? "Required" : "Optional"}</PfBadge>
          {c.lawfulBasis === "Legal obligation" && <PfBadge tone="grey">Cannot be withdrawn</PfBadge>}
          <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Answer recorded {MY_CONSENT.at.split(" · ")[1]}</span>
        </div>

        <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.55, marginTop: 9 }}>{CLAUSE_NOTE[c.id]}</div>

        {children}
      </div>
    </div>
  );
}

/* --------------------------------- screen ---------------------------------- */

export default function MyPrivacy() {
  const go = useGo();
  const toast = useToast();
  const { optIn, setOptIn, explanationRequests, requestExplanation, audit } = useMe();

  const [tab, setTab] = useState("visibility");
  const [visFilter, setVisFilter] = useState<string>(VIS_FILTERS[0]);
  const [allActivity, setAllActivity] = useState(false);

  const answerFor = (c: Clause) => (c.id === "c5" ? optIn : c.accepted);
  const acceptedCount = CLAUSES.filter(answerFor).length;
  const declinedCount = CLAUSES.length - acceptedCount;

  const rows = useMemo(() => {
    if (visFilter === VIS_FILTERS[1]) return MY_VISIBILITY.filter((r) => r.manager === "no");
    if (visFilter === VIS_FILTERS[2]) return MY_VISIBILITY.filter((r) => r.manager === "sees-summary" || r.hr === "sees-summary");
    return MY_VISIBILITY;
  }, [visFilter]);

  const askFor = (d: Decision) => {
    requestExplanation(d.what, MY_EXPLANATION.slaDays);
    toast(`Explanation requested — ${d.what} · ${d.who} answers within ${MY_EXPLANATION.slaDays} days`, "success");
  };

  const followLink = (d: Decision) => {
    const link = DECISION_META[d.what].link;
    if (link.kind === "go") go(link.target);
    else setTab(link.target);
  };

  const withdrawC5 = () => {
    setOptIn(false);
    toast("Consent c5 withdrawn — internal matching is off; your profile will not be scanned for internal roles", "danger");
  };

  const reconfirmC5 = () => {
    setOptIn(true);
    toast("Consent c5 re-confirmed — your profile is back in the internal mobility matcher", "success");
  };

  const shownActivity = allActivity ? audit : audit.slice(0, 7);

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ------------------------------- Header ------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: "var(--pf-n900)" }}>Your data &amp; privacy</div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            What the company holds about you, who can see each piece of it, and every automated call it makes on you.
            None of this is new — it has just never been pointed at you before.
          </div>
        </div>
        <PfBtn icon="user" onClick={() => go("myprofile")}>Your record</PfBtn>
        <PfBtn
          variant="primary"
          icon="download"
          onClick={() =>
            toast(`Your data pack is being prepared — ${MY_VISIBILITY.length} visibility rows, ${CLAUSES.length} consent clauses and your activity log (NDPR subject access)`, "success")
          }
        >
          Download a copy
        </PfBtn>
      </div>

      {/* ------------------------------ KPI strip ------------------------------ */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12, marginBottom: 12 }}>
        <PfStat icon="shield" tone="green" label="Hidden from your manager" value={HIDDEN_FROM_MANAGER} unit={`of ${MY_VISIBILITY.length} rows`} delta="None hidden from you" deltaTone="grey" />
        <PfStat icon="robot" tone="purple" label="Automated calls on you" value={MY_EXPLANATION.decisions.length} unit="decisions" delta={`${MY_EXPLANATION.slaDays}-day SLA`} deltaTone="blue" />
        <PfStat icon="file" tone="blue" label="Consent clauses" value={CLAUSES.length} unit="on your receipt" delta={`${declinedCount} declined`} deltaTone={declinedCount ? "yellow" : "grey"} />
        <PfStat icon="clock" tone="yellow" label="Your activity" value={audit.length} unit="changes logged" delta="This session" deltaTone="grey" />
      </div>

      {/* ----------------------------- Page sections ---------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "visibility", label: "Who sees what", count: String(MY_VISIBILITY.length) },
            { key: "decisions", label: "Automated decisions", count: String(MY_EXPLANATION.decisions.length) },
            { key: "consent", label: "Consent receipt" },
          ]}
        />
      </div>

      {/* =========================== WHO SEES WHAT =========================== */}
      {tab === "visibility" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* The callout row — stated plainly, value never shown */}
          <PfCard style={{ borderColor: "var(--pf-yellow-100)" }}>
            <div style={{ display: "flex", gap: 14, padding: 20, alignItems: "flex-start" }}>
              <PfTile icon="warning" tone="yellow" size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-yellow-500)", letterSpacing: ".3px", textTransform: "uppercase" }}>
                  The row we could have left out
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--pf-n900)", marginTop: 5, letterSpacing: "-.2px" }}>{CALLOUT.item}</div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 11 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pf-n400)" }}>
                    Your manager
                    <span style={{ display: "inline-flex", width: 96 }}><SeeCell kind={CALLOUT.manager as See} /></span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pf-n400)" }}>
                    HR
                    <span style={{ display: "inline-flex", width: 96 }}><SeeCell kind={CALLOUT.hr as See} /></span>
                  </span>
                </div>

                <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 12 }}>{CALLOUT.why}</div>

                <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--pf-n50)" }}>
                  This page tells you that the score exists and who can see it. It does not tell you what it says —
                  and no page in your workspace will, because an unreleased model output about you is not a fact to read off a dashboard.
                  What you can do instead is ask what it was built from: a person answers, within {MY_EXPLANATION.slaDays} days.
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <PfBtn variant="primary" icon="question" onClick={() => setTab("decisions")}>Ask what it was based on</PfBtn>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--pf-n300)" }}>
                    <Ic name="file" size={11} color="var(--pf-n300)" />
                    {CALLOUT.source}
                  </span>
                </div>
              </div>
            </div>
          </PfCard>

          {/* The matrix */}
          <PfCard>
            <PfCardHead
              title="Who sees what"
              sub={`All ${MY_VISIBILITY.length} rows, each one cited to the surface it is assembled from.`}
            >
              <PfTabs tabs={[...VIS_FILTERS]} active={visFilter} onChange={setVisFilter} />
            </PfCardHead>

            {/* legend */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", padding: "10px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              {(["sees", "sees-summary", "no"] as See[]).map((k) => (
                <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--pf-n400)" }}>
                  <SeeGlyph kind={k} />
                  <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>{SEE[k].label}</span>
                  <span>{SEE[k].hint}</span>
                </span>
              ))}
            </div>

            {/* column headers */}
            <div style={{ display: "grid", gridTemplateColumns: VIS_GRID, gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTh>What the company holds</PfTh>
              <PfTh style={{ textAlign: "center" }}>
                Your manager
                <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 1, fontWeight: 400 }}>{MY_MANAGER.name}</div>
              </PfTh>
              <PfTh style={{ textAlign: "center" }}>
                HR
                <div style={{ fontSize: 11, color: "var(--pf-n300)", marginTop: 1, fontWeight: 400 }}>People Ops</div>
              </PfTh>
              <PfTh>Why — and where that comes from</PfTh>
            </div>

            {rows.map((r, i) => (
              <VisibilityRowView key={r.item} r={r} isCallout={r.item === CALLOUT.item} last={i === rows.length - 1} />
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Showing {rows.length} of {MY_VISIBILITY.length}. Every row is a rule the product already enforces — the citation is the surface that enforces it, so a row and the behaviour cannot drift apart.
            </div>
          </PfCard>

          <PfBanner tone="grey" icon="shield">
            <span style={{ fontWeight: 600 }}>Nothing on this matrix is hidden from you. </span>
            <span style={{ fontWeight: 400 }}>
              &ldquo;Hidden&rdquo; and &ldquo;Summary&rdquo; describe what your manager and HR get — you are the one person who sees every row of your own record.
            </span>
          </PfBanner>
        </div>
      )}

      {/* ======================== AUTOMATED DECISIONS ======================== */}
      {tab === "decisions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <PfCard pad={20}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <PfTile icon="robot" tone="purple" size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.2px" }}>{MY_EXPLANATION.headline}</div>
                <div style={{ fontSize: 13, color: "var(--pf-n500)", lineHeight: 1.6, marginTop: 6 }}>{MY_EXPLANATION.body}</div>

                <div style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 12, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "11px 13px" }}>
                  <Ic name="sparkle" size={15} color="var(--pf-purple-500)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-purple-500)" }}>The same right, from the other side of the door</div>
                    <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.55, marginTop: 3 }}>{MY_EXPLANATION.mirrors}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  <PfBadge tone="blue" dot>{MY_EXPLANATION.slaDays}-day SLA</PfBadge>
                  <PfBadge tone="green">A person answers, not a model</PfBadge>
                  <PfBadge tone="grey">
                    {explanationRequests.length} of {MY_EXPLANATION.decisions.length} requested
                  </PfBadge>
                </div>
              </div>
            </div>
          </PfCard>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
            {MY_EXPLANATION.decisions.map((d) => (
              <DecisionCard
                key={d.what}
                d={d}
                requested={explanationRequests.find((r) => r.what === d.what)}
                onRequest={() => askFor(d)}
                onLink={() => followLink(d)}
              />
            ))}
          </div>

          <PfBanner tone="grey" icon="shield">
            <span style={{ fontWeight: 600 }}>{MY_EXPLANATION.logged} </span>
            <span style={{ fontWeight: 400 }}>
              The log is not a courtesy — it is what makes &ldquo;HRBP+ only&rdquo; checkable after the fact rather than a promise.
            </span>
          </PfBanner>
        </div>
      )}

      {/* =========================== CONSENT RECEIPT =========================== */}
      {tab === "consent" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* Receipt header */}
          <PfCard>
            <PfCardHead title="Consent receipt" sub={MY_CONSENT.at}>
              <PfBadge tone="green">{acceptedCount} accepted</PfBadge>
              <PfBadge tone="grey">{declinedCount} declined</PfBadge>
              <PfBtn
                small
                icon="download"
                onClick={() => toast(`Consent receipt exported — ${CLAUSES.length} clauses recorded ${MY_CONSENT.at.split(" · ")[1]} (NDPR record of consent)`, "success")}
              >
                Download receipt
              </PfBtn>
            </PfCardHead>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 1, background: "var(--pf-n50)", borderBottom: "1px solid var(--pf-n50)" }}>
              {[
                { label: "Subject", value: `${MY_CONSENT.subject} · ${ME_PUBLIC.id}` },
                { label: "Recorded at", value: MY_CONSENT.at },
                { label: "Recorded by", value: MY_CONSENT.recordedBy },
              ].map((m) => (
                <div key={m.label} style={{ background: "var(--pf-n0)", padding: "14px 20px", minWidth: 0 }}>
                  <div style={recordLabel}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", marginTop: 5, lineHeight: 1.45 }}>{m.value}</div>
                </div>
              ))}
            </div>

            {/* the honest bit about who ticked the boxes */}
            <div style={{ display: "flex", gap: 11, alignItems: "flex-start", padding: "14px 20px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
              <Ic name="info" size={16} color="var(--pf-n400)" />
              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>
                <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>You did not tick these boxes yourself. </span>
                Self-service consent capture did not exist in Nov 2023, so People Ops recorded your answers on your behalf.
                That stays on the receipt rather than being tidied away — and it is the reason every Consent-basis clause below
                is yours to withdraw or re-confirm from here, now, without asking anyone.
              </div>
            </div>

            <div style={{ padding: "14px 20px", display: "flex", gap: 11, alignItems: "flex-start" }}>
              <PfTile icon="shield" tone="green" size={30} />
              <div style={{ fontSize: 12.5, color: "var(--pf-n500)", lineHeight: 1.6 }}>{MY_CONSENT.ndprNote}</div>
            </div>

            <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "11px 20px", borderTop: "1px solid var(--pf-n50)", background: "var(--pf-n25)" }}>
              <Ic name="clock" size={14} color="var(--pf-n400)" />
              <div style={{ fontSize: 12, color: "var(--pf-n500)" }}>
                <span style={{ fontWeight: 600, color: "var(--pf-n600)" }}>Retention — </span>
                {MY_CONSENT.retention}
              </div>
            </div>
          </PfCard>

          {/* Clauses */}
          <PfCard>
            <PfCardHead title="The five clauses" sub="What you were asked, what you answered, and what you can still change." />

            {CLAUSES.map((c, i) => {
              const accepted = answerFor(c);
              const last = i === CLAUSES.length - 1;
              return (
                <ClauseRow key={c.id} c={c} accepted={accepted} last={last}>
                  {c.id === "c1" && (
                    <div style={{ marginTop: 10 }}>
                      <PfBtn small variant="secondary" icon="user" onClick={() => go("myprofile")}>See what it holds</PfBtn>
                    </div>
                  )}

                  {c.id === "c2" && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <PfBtn small variant="secondary" onClick={() => setTab("decisions")}>Where it would have been used</PfBtn>
                      <span style={{ fontSize: 11.5, color: "var(--pf-n300)" }}>Declining a clause has consequences you can point at — this is one.</span>
                    </div>
                  )}

                  {c.id === "c3" && (
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "8px 11px" }}>
                      <Ic name="shield" size={14} color="var(--pf-n400)" />
                      <span style={{ fontSize: 12, color: "var(--pf-n500)" }}>
                        No withdraw button here, deliberately. Payroll runs on a legal obligation, not on your permission.
                      </span>
                    </div>
                  )}

                  {c.id === "c4" && (
                    <div style={{ marginTop: 10 }}>
                      <PfBtn small variant="secondary" icon="bell" onClick={() => go("mymobile")}>Manage your channels</PfBtn>
                    </div>
                  )}

                  {c.id === "c5" && (
                    <div
                      style={{
                        marginTop: 11, borderRadius: 10, padding: "12px 14px",
                        background: accepted ? "var(--pf-primary-50)" : "var(--pf-red-50)",
                        border: `1px solid ${accepted ? "var(--pf-primary-100)" : "var(--pf-red-100)"}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: accepted ? "var(--pf-primary-600)" : "var(--pf-red-500)" }}>
                        <Ic name={accepted ? "swap" : "x"} size={14} color={accepted ? "var(--pf-primary-500)" : "var(--pf-red-500)"} />
                        {accepted ? "Internal matching is on" : "Internal matching is off"}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--pf-n600)", lineHeight: 1.6, marginTop: 5 }}>
                        {accepted
                          ? "Withdrawing this clause turns internal matching off: your profile stops being scanned for internal roles, your match scores stop updating, and nobody sourcing an internal role sees you. It takes effect the moment you press it, and it is reversible."
                          : "Your profile is no longer scanned for internal roles and your match scores have stopped updating. Nothing else on your record changes, and you can turn it back on whenever you want."}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
                        {accepted ? (
                          <PfBtn small variant="danger" icon="x" onClick={withdrawC5}>Withdraw consent</PfBtn>
                        ) : (
                          <PfBtn small variant="primary" icon="check" onClick={reconfirmC5}>Re-confirm consent</PfBtn>
                        )}
                        <PfBtn small variant="secondary" icon="swap" onClick={() => go("mymobility")}>
                          {accepted ? "See what it powers" : "See what changed"}
                        </PfBtn>
                      </div>
                    </div>
                  )}
                </ClauseRow>
              );
            })}

            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)" }}>
              <Ic name="info" size={13} color="var(--pf-n300)" />
              Withdrawing a Consent-basis clause applies immediately and lands in Your activity below — no ticket, no approval, no waiting on anyone.
            </div>
          </PfCard>

          <PfBanner tone="grey" icon="file" cta="open" onCta={() => setTab("visibility")}>
            <span style={{ fontWeight: 600 }}>Consent says what may be collected. </span>
            <span style={{ fontWeight: 400 }}>Who sees what says where it then travels — the two answers only mean something together.</span>
          </PfBanner>
        </div>
      )}

      {/* ============================ YOUR ACTIVITY ============================ */}
      <div style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <PfTile icon="pulse" tone="green" size={26} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>Your activity</div>
            <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 1 }}>
              The other half of this page. Above: what they hold about you. Here: what you did about it.
            </div>
          </div>
        </div>

        <PfCard>
          <PfCardHead title="Every change you have made, timestamped" sub="Goal check-ins, self-scores, feedback, consent — anywhere in your workspace, it lands here.">
            <PfBadge tone="grey">{audit.length} logged</PfBadge>
            {audit.length > 7 && (
              <PfBtn small variant="ghost" onClick={() => setAllActivity(!allActivity)}>
                {allActivity ? "Show recent" : `Show all ${audit.length}`}
              </PfBtn>
            )}
          </PfCardHead>

          {audit.length === 0 ? (
            <div style={{ padding: "34px 20px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", marginBottom: 10 }}><PfTile icon="clipboard" tone="grey" size={40} /></div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>Nothing logged yet</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 5, maxWidth: 460, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
                Check in on a goal, score yourself in your review, ask for an explanation or withdraw a consent clause —
                each one appears here the moment you do it, with the time you did it.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 13 }}>
                <PfBtn small variant="secondary" icon="question" onClick={() => setTab("decisions")}>Ask for an explanation</PfBtn>
                <PfBtn small variant="secondary" icon="target" onClick={() => go("mygoals")}>Open your goals</PfBtn>
              </div>
            </div>
          ) : (
            shownActivity.map((a, i) => (
              <div
                key={`${a.at}-${a.action}-${i}`}
                style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 20px", borderBottom: i === shownActivity.length - 1 ? "none" : "1px solid var(--pf-n50)" }}
              >
                <div style={{ width: 108, flex: "none", fontSize: 11.5, color: "var(--pf-n400)", paddingTop: 1 }}>{a.at}</div>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pf-primary-500)", flex: "none", marginTop: 5 }} />
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                  <span style={{ color: "var(--pf-n400)" }}>You </span>
                  <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>{a.action}</span>
                  <span style={{ color: "var(--pf-n400)" }}> · </span>
                  <span>{a.subject}</span>
                </div>
              </div>
            ))
          )}

          <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "11px 20px", background: "var(--pf-n25)", borderTop: "1px solid var(--pf-n50)", fontSize: 12, color: "var(--pf-n400)", lineHeight: 1.6 }}>
            <Ic name="shield" size={13} color="var(--pf-n300)" />
            <span>
              This is your copy of the log. The company keeps its own, and the two say the same thing —
              every explanation you request is in it, and so is every view of your leave-risk score, including HR&rsquo;s.
            </span>
          </div>
        </PfCard>
      </div>
    </div>
  );
}
