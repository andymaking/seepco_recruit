"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { PfBadge, PfBtn, PfCard, PfPageTabs, PfProgress, PfTabs, PfTile, type PfTone } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------- Constants -------------------------------- */

/** FR-081 — employer-funded L&D credit pool, drawn as entitlements. */
const POOL_TOTAL = 2_400_000;
const SEED_CONSUMED = Math.round(POOL_TOTAL * 0.38); // ₦912k · 38%
const COURSE_COST = 45_000;
const COACHING_COST = 120_000;

const naira = (n: number) =>
  n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M` : `₦${Math.round(n / 1000)}k`;

type ItemType = "Course" | "Coaching session" | "Company lesson";

const TYPE_TONE: Record<ItemType, PfTone> = { Course: "blue", "Coaching session": "purple", "Company lesson": "grey" };

type CatalogItem = {
  id: string; type: ItemType; title: string;
  provider: "Doronstack" | "Company library";
  attribution: string;        // provider attribution line under the title
  time: string;               // estimated time (FR-071)
  tag: string;                // unified-taxonomy tag (FR-076)
  enrolled: number; cost: number;
};

/** 9-card catalog — company content + Doronstack (launch partner). */
const CATALOG: CatalogItem[] = [
  { id: "C-01", type: "Course", title: "Distributed Systems Design Masterclass", provider: "Doronstack", attribution: "Doronstack · Kora AI Practice Studio", time: "6h 30m", tag: "Distributed systems", enrolled: 24, cost: COURSE_COST },
  { id: "C-02", type: "Course", title: "Deep Work — Time Management for Senior ICs", provider: "Doronstack", attribution: "Doronstack ✦", time: "3h 15m", tag: "Time management", enrolled: 41, cost: COURSE_COST },
  { id: "K-01", type: "Coaching session", title: "Staff-track Career Coaching", provider: "Doronstack", attribution: "1:1 with a Doronstack specialist", time: "45m / session", tag: "Leadership", enrolled: 12, cost: COACHING_COST },
  { id: "L-01", type: "Company lesson", title: "HSE Incident Command — Level 2", provider: "Company library", attribution: "Company library · HSE & Compliance", time: "2h 10m", tag: "Incident investigation", enrolled: 27, cost: 0 },
  { id: "C-03", type: "Course", title: "Payments Domain Bootcamp", provider: "Doronstack", attribution: "Doronstack · Kora AI Practice Studio", time: "8h 00m", tag: "Payments", enrolled: 9, cost: COURSE_COST },
  { id: "K-02", type: "Coaching session", title: "New-Manager Transition Coaching", provider: "Doronstack", attribution: "1:1 with a Doronstack specialist", time: "60m / session", tag: "Leadership", enrolled: 8, cost: COACHING_COST },
  { id: "L-02", type: "Company lesson", title: "NCDMB Compliance Essentials", provider: "Company library", attribution: "Company library · HSE & Compliance", time: "45m", tag: "HSE auditing", enrolled: 63, cost: 0 },
  { id: "C-04", type: "Course", title: "Data Storytelling with Power BI", provider: "Doronstack", attribution: "Doronstack ✦", time: "4h 00m", tag: "Analytics", enrolled: 17, cost: COURSE_COST },
  { id: "L-03", type: "Company lesson", title: "Rig Rotation Safety Onboarding", provider: "Company library", attribution: "Company library · Field Operations", time: "1h 20m", tag: "Rig operations", enrolled: 96, cost: 0 },
];

const TAB_TYPE: Record<string, ItemType | null> = { All: null, Courses: "Course", Coaching: "Coaching session", Company: "Company lesson" };

/** FR-071 — AI milestone proposals from competency gaps. AI proposes, you approve. */
type Rec = {
  id: string; person: string; first: string; init: string; tone: string;
  title: string; type: ItemType; provider: string; time: string;
  reason: string; source: string; sourceGo: string; confidence: number;
  state: "open" | "accepted";
};

const SEED_RECS: Rec[] = [
  { id: "R-1", person: "Amara Okonkwo", first: "Amara", init: "AO", tone: "#AF52DE", title: "Deep Work — Time Management for Senior ICs", type: "Course", provider: "Doronstack ✦", time: "3h 15m", reason: "Time management scored at-risk in Q2 review", source: "Q2 2026 review packet", sourceGo: "reviews", confidence: 0.84, state: "open" },
  { id: "R-2", person: "Amara Okonkwo", first: "Amara", init: "AO", tone: "#AF52DE", title: "Distributed Systems Design Masterclass", type: "Course", provider: "Doronstack ✦", time: "6h 30m", reason: "Systems design is the open Staff-track gap (Staff Engineer match 87%)", source: "Staff-track readiness scan", sourceGo: "mobility", confidence: 0.79, state: "open" },
  { id: "R-3", person: "Halima Sule", first: "Halima", init: "HS", tone: "#AF52DE", title: "HSE Incident Command — Level 2", type: "Company lesson", provider: "Company library", time: "2h 10m", reason: "Incident command gap vs the HSE Manager mobility match (81%)", source: "Skills-graph gap scan", sourceGo: "skillsgraph", confidence: 0.81, state: "open" },
];

type LearningRow = { title: string; provider: string; pct: number; meta: string };

const SEED_LEARNING: LearningRow[] = [
  { title: "Coaching Skills for Engineering Leads", provider: "Doronstack ✦", pct: 58, meta: "3 of 5 modules" },
  { title: "Advanced Go Concurrency Patterns", provider: "Doronstack ✦", pct: 72, meta: "6 of 8 modules" },
  { title: "First Aid at Work Refresher", provider: "Company library", pct: 35, meta: "2 of 6 lessons" },
];

/* ------------------------------- Small bits -------------------------------- */

function ProviderChip({ children, dashed, onClick }: { children: ReactNode; dashed?: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
        color: dashed ? "var(--pf-n400)" : "var(--pf-n900)", background: hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        border: `1px ${dashed ? "dashed var(--pf-n300)" : "solid var(--pf-n100)"}`, borderRadius: 999,
        padding: "7px 13px", cursor: "pointer", lineHeight: 1.3, whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/** Taxonomy tag chip — clicking it filters the catalog by that tag. */
function TagChip({ tag, onClick }: { tag: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      title="Unified taxonomy tag (FR-076) — click to filter"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500,
        color: hovered ? "var(--pf-n900)" : "var(--pf-n500)", background: hovered ? "var(--pf-n100)" : "var(--pf-n50)",
        border: "0.6px solid var(--pf-n100)", borderRadius: 999, padding: "3px 9px", cursor: "pointer",
        whiteSpace: "nowrap", lineHeight: 1.35,
      }}
    >
      <Ic name="graph" size={11} />
      {tag}
    </button>
  );
}

/* --------------------------------- Screen ---------------------------------- */

export default function LearningHub() {
  const go = useGo();
  const toast = useToast();

  const [tab, setTab] = useState<"recommended" | "catalog" | "mylearning">("recommended");
  const [cat, setCat] = useState<"All" | "Courses" | "Coaching" | "Company">("All");
  const [q, setQ] = useState("");
  const [recs, setRecs] = useState<Rec[]>(SEED_RECS);
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [myLearning, setMyLearning] = useState<LearningRow[]>(SEED_LEARNING);
  const [consumed, setConsumed] = useState(SEED_CONSUMED);

  const pct = Math.round((consumed / POOL_TOTAL) * 100);
  const poolTone: PfTone = pct > 85 ? "red" : pct > 65 ? "yellow" : "green";
  const openRecs = recs.filter((r) => r.state === "open").length;

  const shown = useMemo(() => {
    const t = TAB_TYPE[cat];
    const needle = q.trim().toLowerCase();
    return CATALOG.filter(
      (c) =>
        (!t || c.type === t) &&
        (needle === "" || `${c.title} ${c.tag} ${c.attribution} ${c.provider} ${c.type}`.toLowerCase().includes(needle)),
    );
  }, [cat, q]);

  /* ------------------------------ Interactions ----------------------------- */

  const acceptRec = (r: Rec) => {
    setRecs((rs) => rs.map((x) => (x.id === r.id ? { ...x, state: "accepted" } : x)));
    toast(`Added to growth plan — “${r.title}” is now a milestone on ${r.first}’s plan; completion feeds their next review packet (FR-081).`, "success");
  };

  const dismissRec = (r: Rec) => {
    setRecs((rs) => rs.filter((x) => x.id !== r.id));
    toast(`Dismissed — logged with your decision; the model won’t re-propose “${r.title}” for ${r.first} this quarter.`);
  };

  const takeItem = (c: CatalogItem) => {
    const coaching = c.type === "Coaching session";
    if (taken[c.id]) {
      toast(coaching ? `“${c.title}” already requested — the specialist confirms within 24h.` : `“${c.title}” is already in My learning — continue from the My learning tab.`);
      return;
    }
    setTaken((d) => ({ ...d, [c.id]: true }));
    setMyLearning((m) => [...m, { title: c.title, provider: c.provider === "Doronstack" ? "Doronstack ✦" : "Company library", pct: 0, meta: coaching ? "Session requested" : "Just enrolled" }]);
    setConsumed((v) => Math.min(POOL_TOTAL, v + c.cost));
    if (coaching) {
      toast(`Session requested — a Doronstack specialist confirms within 24h · ${naira(COACHING_COST)} coaching entitlement held from the pool.`, "success");
    } else if (c.provider === "Doronstack") {
      toast(`Enrolled in “${c.title}” via Doronstack SSO handoff — minimal PII under DPA · ${naira(COURSE_COST)} entitlement drawn from the pool.`, "success");
    } else {
      toast(`Enrolled in “${c.title}” — internal lesson, no pool credits consumed.`, "success");
    }
  };

  const filterByTag = (tag: string) => { setCat("All"); setQ(tag); };

  /* --------------------------------- Render -------------------------------- */

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* -------------------------------- Header ------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0, lineHeight: 1.2 }}>Learning Hub</h1>
            <PfBadge tone="green">FR-071 · FR-081</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Company lessons plus partner courses & coaching in one catalog — funded by the employer credit pool; completions feed growth plans and reviews.
          </div>
        </div>
        <PfBtn variant="secondary" icon="trend" onClick={() => go("growth")}>Growth plans</PfBtn>
      </div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={(k) => setTab(k as typeof tab)}
          tabs={[
            { key: "recommended", label: "Recommended", count: String(openRecs) },
            { key: "catalog", label: "Catalog", count: String(CATALOG.length) },
            { key: "mylearning", label: "My learning", count: String(myLearning.length) },
          ]}
        />
      </div>

      {/* ---------------- RECOMMENDED — credit pool + AI proposals --------------- */}
      {tab === "recommended" && (<>
      {/* --------------------------- L&D credit pool ---------------------------- */}
      <PfCard>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", flexWrap: "wrap" }}>
          <PfTile icon="wallet" tone="green" size={34} />
          <div style={{ minWidth: 170 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>L&D credit pool</span>
              <PfBadge tone="green">FR-081</PfBadge>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 3 }}>
              <span style={{ fontSize: 21, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", lineHeight: 1.1 }}>{naira(POOL_TOTAL)}</span>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>annual pool · 2026</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n600)" }}>{naira(consumed)} consumed</span>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{pct}% of pool</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>{naira(POOL_TOTAL - consumed)} remaining</span>
            </div>
            <PfProgress pct={pct} tone={poolTone} height={8} />
            <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 7, lineHeight: 1.5 }}>
              Credits consumed as course & coaching entitlements · one monthly invoice · employees never pay out of pocket.
            </div>
          </div>
          <PfBtn variant="secondary" small icon="download" onClick={() => toast(`August statement drafted — ${naira(consumed - SEED_CONSUMED)} in new entitlements this session, one consolidated invoice to Finance · employees paid ₦0 out of pocket.`)}>
            Monthly statement
          </PfBtn>
        </div>
      </PfCard>

      {/* --------------------- ✦ Recommended for your gaps ---------------------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 18, marginBottom: 10 }}>
        <PfTile icon="sparkle" tone="purple" size={26} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--pf-n900)" }}>✦ Recommended for your gaps</div>
          <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>
            AI proposes milestones from competency gaps across your team — you approve what lands on a growth plan (FR-071).
          </div>
        </div>
        <PfBadge tone="purple">AI · {openRecs} open</PfBadge>
      </div>

      {recs.length === 0 ? (
        <PfCard pad="26px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>No open recommendations</div>
          <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginTop: 3 }}>The gap scan runs nightly against reviews, the skills graph and mobility matches.</div>
        </PfCard>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {recs.map((r) => (
            <PfCard key={r.id} pad="13px 14px" style={{ display: "flex", flexDirection: "column", gap: 9, background: r.state === "accepted" ? "var(--pf-primary-50)" : "var(--pf-n0)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: `${r.tone}1A`, color: r.tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flex: "none", border: `1px solid ${r.tone}33` }}>{r.init}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.person}</span>
                <PfBadge tone={TYPE_TONE[r.type]}>{r.type}</PfBadge>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{r.title}</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)", marginTop: 3 }}>{r.provider} · {r.time}</div>
              </div>
              <div style={{ background: r.state === "accepted" ? "var(--pf-n0)" : "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                  <Ic name="sparkle" size={12} color="var(--pf-purple-500)" />
                  <span style={{ fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.45 }}>
                    <span style={{ fontWeight: 600 }}>Recommended because:</span> {r.reason}
                  </span>
                </div>
                <button
                  onClick={() => go(r.sourceGo)}
                  style={{ background: "none", border: "none", padding: 0, marginTop: 5, marginLeft: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 11, color: "var(--pf-n400)", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  {r.source} · confidence {r.confidence.toFixed(2)} <Ic name="arrowright" size={10} />
                </button>
              </div>
              <div style={{ display: "flex", gap: 7, marginTop: "auto" }}>
                {r.state === "accepted" ? (
                  <>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--pf-primary-500)" }}>
                      <Ic name="check" size={13} /> Added to growth plan
                    </span>
                    <span style={{ flex: 1 }} />
                    <PfBtn small variant="secondary" onClick={() => go("growth")}>View plan</PfBtn>
                  </>
                ) : (
                  <>
                    <PfBtn small variant="primary" icon="check" onClick={() => acceptRec(r)}>Accept</PfBtn>
                    <PfBtn small variant="ghost" icon="x" onClick={() => dismissRec(r)}>Dismiss</PfBtn>
                  </>
                )}
              </div>
            </PfCard>
          ))}
        </div>
      )}
      </>)}

      {/* ------------------------------- CATALOG -------------------------------- */}
      {tab === "catalog" && (
        <div style={{ minWidth: 0 }}>
          {/* Provider chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)" }}>Providers</span>
            <ProviderChip onClick={() => toast("Company library — internal lessons maintained by L&D, tagged to the same unified taxonomy as partner content (FR-076).")}>
              <Ic name="book" size={13} color="var(--pf-n500)" />
              Company library
              <PfBadge tone="grey">3 in catalog</PfBadge>
            </ProviderChip>
            <ProviderChip onClick={() => toast("Doronstack (Doron × MyStack) — launch partner: courses, Kora AI Practice Studio and 1:1 specialist coaching · SSO handoff with minimal PII under the NDPR DPA · billed as pool entitlements.", "ai")}>
              <span style={{ color: "var(--pf-primary-500)", fontSize: 13, lineHeight: 1 }}>✦</span>
              Doronstack
              <PfBadge tone="green">Launch partner</PfBadge>
            </ProviderChip>
            <ProviderChip dashed onClick={() => toast("Provider marketplace — new providers plug into the same SSO-handoff + NDPR-DPA pattern Doronstack launched with. Coursera & AltSchool integrations are on the roadmap.")}>
              <Ic name="plus" size={12} />
              Add provider
            </ProviderChip>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <PfTabs tabs={["All", "Courses", "Coaching", "Company"]} active={cat} onChange={(t) => setCat(t as typeof cat)} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "6px 11px", flex: 1, minWidth: 160, maxWidth: 240 }}>
              <Ic name="search" size={14} color="var(--pf-n400)" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search catalog…"
                style={{ border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "var(--pf-n900)", width: "100%" }}
              />
              {q !== "" && (
                <button onClick={() => setQ("")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--pf-n400)", display: "flex" }}>
                  <Ic name="x" size={12} />
                </button>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{shown.length} of {CATALOG.length} items</span>
          </div>

          {shown.length === 0 ? (
            <PfCard pad="34px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><PfTile icon="search" tone="grey" size={34} /></div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 3 }}>Nothing matches “{q}”</div>
              <div style={{ fontSize: 12.5, color: "var(--pf-n400)", marginBottom: 12 }}>Try another taxonomy tag, or clear the filters.</div>
              <PfBtn variant="secondary" onClick={() => { setQ(""); setCat("All"); toast("Filters cleared"); }}>Clear filters</PfBtn>
            </PfCard>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {shown.map((c) => {
                const coaching = c.type === "Coaching session";
                const isTaken = !!taken[c.id];
                return (
                  <PfCard key={c.id} pad="13px 14px" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <PfBadge tone={TYPE_TONE[c.type]} dot>{c.type}</PfBadge>
                      <span style={{ flex: 1 }} />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
                        <Ic name="clock" size={12} /> {c.time}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.35 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: "var(--pf-n400)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                        {c.provider === "Doronstack" && <span style={{ color: "var(--pf-primary-500)", fontSize: 11, lineHeight: 1 }}>✦</span>}
                        {c.attribution}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
                      <TagChip tag={c.tag} onClick={() => filterByTag(c.tag)} />
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
                        <Ic name="users" size={12} /> {c.enrolled + (isTaken ? 1 : 0)} {coaching ? "booked" : "enrolled"}
                      </span>
                      <span style={{ flex: 1 }} />
                      {isTaken ? (
                        <PfBtn small variant="secondary" icon="check" onClick={() => takeItem(c)}>{coaching ? "Requested" : "Enrolled"}</PfBtn>
                      ) : (
                        <PfBtn small variant="primary" icon={coaching ? "calendar" : "play"} onClick={() => takeItem(c)}>{coaching ? "Book session" : "Enroll"}</PfBtn>
                      )}
                    </div>
                  </PfCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------- MY LEARNING ------------------------------ */}
      {tab === "mylearning" && (
        <PfCard style={{ maxWidth: 560 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTile icon="book" tone="green" size={26} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>My learning</span>
            <PfBadge tone="green">12 completed</PfBadge>
          </div>
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 13 }}>
            {myLearning.map((m, i) => (
              <div key={`${m.title}-${i}`}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pf-n900)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--pf-n900)" }}>{m.pct}%</span>
                </div>
                <PfProgress pct={m.pct} tone={m.pct === 0 ? "grey" : "green"} height={6} />
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: 11.5, color: "var(--pf-n400)", flex: 1 }}>{m.provider} · {m.meta}</span>
                  <PfBtn small variant="ghost" icon="play" onClick={() => toast(`Resuming “${m.title}” — progress syncs back nightly via the completion webhook.`)}>Continue</PfBtn>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => go("growth")}
            style={{ display: "flex", alignItems: "flex-start", gap: 8, width: "100%", textAlign: "left", background: "var(--pf-n25)", border: "none", borderTop: "1px solid var(--pf-n50)", padding: "11px 14px", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Ic name="trend" size={14} color="var(--pf-primary-500)" />
            <span style={{ flex: 1, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.5 }}>
              Completion webhooks feed the <span style={{ fontWeight: 600, color: "var(--pf-n900)" }}>growth plan & review packet</span> (FR-081)
            </span>
            <Ic name="arrowright" size={13} color="var(--pf-n400)" />
          </button>
        </PfCard>
      )}

      {/* --------------------------------- Footer -------------------------------- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 24, fontSize: 12, color: "var(--pf-n400)" }}>
        <Ic name="shield" size={13} />
        Catalog synced nightly, tagged to the unified taxonomy (FR-076) · NDPR DPA in force.
      </div>
    </div>
  );
}
