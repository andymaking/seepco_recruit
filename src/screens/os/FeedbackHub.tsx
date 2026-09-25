"use client";
import { useMemo, useRef, useState } from "react";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import { EMPLOYEES, REVIEW_CYCLE } from "@/data/talentos";
import { PfAvatar, PfBadge, PfBtn, PfCard, PfPageTabs, PfTile, TONE } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";

/* ------------------------------- Constants ------------------------------- */

/** Unified competency taxonomy — the SAME ids as hiring scorecards & review packets. */
const COMPETENCIES = ["Communication", "Collaboration", "Technical depth", "Leadership", "Time management"] as const;
type Competency = (typeof COMPETENCIES)[number];

type FbType = "Praise" | "Constructive";
type Visibility = "Private to them" | "Them + manager";

/** The signed-in manager (Ngozi's team — Engineering lead persona). */
const ME = { name: "You", init: "NA", tone: "#16B364" };

/** 6 team members — exactly the Q2 review-cycle roster (one story everywhere). */
const TEAM = REVIEW_CYCLE.rows;

const PEOPLE: Record<string, { init: string; tone: string }> = Object.fromEntries([
  ...TEAM.map((r) => [r.name, { init: r.init, tone: r.tone }]),
  ["You", { init: ME.init, tone: ME.tone }],
]);

type FbItem = {
  id: string; giver: string; receiver: string; competency: Competency;
  type: FbType; text: string; time: string; visibility: Visibility;
};

const SEED_FEED: FbItem[] = [
  { id: "F-106", giver: "You", receiver: "Amara Okonkwo", competency: "Technical depth", type: "Praise", time: "2h ago", visibility: "Private to them", text: "Your payments-incident writeup was the clearest I have read all year — root cause, blast radius and the fix on one page. Exactly the Staff-track signal we talked about in our 1-on-1." },
  { id: "F-105", giver: "Adaeze Okafor", receiver: "You", competency: "Leadership", type: "Constructive", time: "1d ago", visibility: "Them + manager", text: "The design-system decision sat a full week waiting on your sign-off. A named deputy or a 48-hour escalation path would keep squads moving while you are in Port Harcourt." },
  { id: "F-104", giver: "Emeka Nwosu", receiver: "Halima Sule", competency: "Collaboration", type: "Praise", time: "1d ago", visibility: "Them + manager", text: "Halima turned the rotation-changeover audit around in 48 hours and walked my crew leads through every finding — the PH sick-day cluster is finally getting fixed." },
  { id: "F-103", giver: "Zainab Yusuf", receiver: "Adaeze Okafor", competency: "Communication", type: "Praise", time: "2d ago", visibility: "Private to them", text: "Adaeze's review-packet walkthrough for Commercial was completely jargon-free — my team finally understands what feeds their Q2 packet." },
  { id: "F-102", giver: "Ngozi Obi", receiver: "Zainab Yusuf", competency: "Time management", type: "Constructive", time: "3d ago", visibility: "Private to them", text: "Campaign cost reports keep landing a day after month-end close. Moving your export to the 28th would save Finance a full reconciliation cycle." },
  { id: "F-101", giver: "Halima Sule", receiver: "Ngozi Obi", competency: "Collaboration", type: "Praise", time: "4d ago", visibility: "Them + manager", text: "Ngozi rebuilt the HSE training-budget tracker with us line by line — audit prep took half the usual time." },
];

type PendingReq = { to: string; competency: Competency; when: string };

const SEED_PENDING: PendingReq[] = [
  { to: "Ngozi Obi", competency: "Technical depth", when: "2d ago" },
  { to: "Emeka Nwosu", competency: "Leadership", when: "5d ago" },
];

/** Feedback health — given / received this quarter, Ngozi's team. Emeka: zero received. */
const HEALTH: { name: string; given: number; received: number }[] = [
  { name: "Amara Okonkwo", given: 2, received: 5 },
  { name: "Adaeze Okafor", given: 6, received: 4 },
  { name: "Zainab Yusuf", given: 3, received: 3 },
  { name: "Ngozi Obi", given: 4, received: 2 },
  { name: "Halima Sule", given: 5, received: 4 },
  { name: "Emeka Nwosu", given: 1, received: 0 },
];
const HEALTH_MAX = 6;

const THEMES = [
  { label: "Payments crunch", n: 4, tone: "#16B364", note: "clustered across Engineering praise + workload notes" },
  { label: "Review-packet clarity", n: 3, tone: "#AF52DE", note: "cross-dept praise for packet walkthroughs" },
  { label: "PH rotation changeover", n: 2, tone: "#EBA308", note: "Field Ops ↔ HSE collaboration notes" },
] as const;

/** Inclusive-language check — Stage-2 model flags coded wording before send. */
const LANGUAGE_FLAGS: { w: string; tip: string }[] = [
  { w: "aggressive", tip: "often reads as a personality verdict — name the behaviour instead (e.g. “pushed the decision without aligning the team”)." },
  { w: "bossy", tip: "frequently gendered coding — describe the impact instead (e.g. “set direction without gathering input”)." },
  { w: "abrasive", tip: "a label, not an observation — cite the specific moment and its effect on the team." },
  { w: "emotional", tip: "vague and often coded — say what happened and what outcome it affected." },
];

/* ------------------------------- Small bits ------------------------------- */

function Chip({ label, active, dot, onClick }: { label: string; active: boolean; dot?: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit",
        fontSize: 12.5, fontWeight: 500, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
        border: `1px solid ${active ? "var(--pf-n900)" : "var(--pf-n100)"}`,
        background: active ? "var(--pf-n900)" : hovered ? "var(--pf-n50)" : "var(--pf-n0)",
        color: active ? "#fff" : "var(--pf-n500)", whiteSpace: "nowrap", lineHeight: 1.3,
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flex: "none" }} />}
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n500)", marginBottom: 7 }}>{children}</div>;
}

function FlowChip({ label, onClick }: { label: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 11.5, fontWeight: 500,
        color: hovered ? "var(--pf-n900)" : "var(--pf-n400)", background: hovered ? "var(--pf-n50)" : "var(--pf-n25)",
        border: "1px solid var(--pf-n50)", padding: "4px 10px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", lineHeight: 1.35,
      }}
    >
      <Ic name="arrowright" size={11} />
      {label}
    </button>
  );
}

/* ------------------------------- Stream card ------------------------------ */

function FbCard({ f, onOpenPerson }: { f: FbItem; onOpenPerson: (name: string) => void }) {
  const toast = useToast();
  const giver = PEOPLE[f.giver] ?? { init: "?", tone: "#475569" };
  const poss = f.receiver === "You" ? "your" : `${f.receiver}’s`;
  const nameBtn = (n: string): React.CSSProperties => ({
    background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13.5,
    fontWeight: 600, color: "var(--pf-n900)", cursor: "pointer", lineHeight: 1.3,
  });
  return (
    <PfCard pad="14px 16px">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <PfAvatar init={giver.init} tone={giver.tone} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <button onClick={() => onOpenPerson(f.giver)} style={nameBtn(f.giver)}>{f.giver}</button>
            <Ic name="arrowright" size={13} color="var(--pf-n300)" />
            <button onClick={() => onOpenPerson(f.receiver)} style={nameBtn(f.receiver)}>{f.receiver}</button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{f.time}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
            <PfBadge tone="grey">{f.competency}</PfBadge>
            <PfBadge tone={f.type === "Praise" ? "green" : "yellow"} dot>{f.type}</PfBadge>
            <span style={{ fontSize: 11.5, color: "var(--pf-n400)", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Ic name="shield" size={12} />{f.visibility}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.55, marginTop: 9 }}>{f.text}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 11, flexWrap: "wrap" }}>
            <FlowChip
              label="Profile timeline"
              onClick={() => toast(`This note sits on ${poss} profile timeline — one record spine, hiring → employment → alumni (FR-075).`)}
            />
            <FlowChip
              label="Feeds Q2 review packet"
              onClick={() => toast(`Auto-summarised into ${poss} Q2 2026 review packet (FR-067) — one stream, no separate feedback silo.`, "ai")}
            />
          </div>
        </div>
      </div>
    </PfCard>
  );
}

/* --------------------------------- Screen --------------------------------- */

export default function FeedbackHub() {
  const go = useGo();
  const toast = useToast();
  const nid = useRef(107);

  /* Composer state (shared person/competency; give adds type/text/visibility) */
  const [composer, setComposer] = useState<"give" | "request" | null>(null);
  const [person, setPerson] = useState<string | null>(null);
  const [comp, setComp] = useState<Competency | null>(null);
  const [fbType, setFbType] = useState<FbType>("Praise");
  const [text, setText] = useState("");
  const [vis, setVis] = useState<Visibility>("Private to them");

  /* Stream + pending state */
  const [feed, setFeed] = useState<FbItem[]>(SEED_FEED);
  const [pending, setPending] = useState<PendingReq[]>(SEED_PENDING);
  const [typeFilter, setTypeFilter] = useState<"All" | "Praise" | "Constructive" | "Mine">("All");
  const [compFilter, setCompFilter] = useState<string>("All");
  const [tab, setTab] = useState("stream");

  const flags = useMemo(() => {
    const t = text.toLowerCase();
    return LANGUAGE_FLAGS.filter((f) => t.includes(f.w));
  }, [text]);

  const shown = useMemo(
    () =>
      feed.filter(
        (f) =>
          (typeFilter === "All" || (typeFilter === "Mine" ? f.giver === "You" || f.receiver === "You" : f.type === typeFilter)) &&
          (compFilter === "All" || f.competency === compFilter),
      ),
    [feed, typeFilter, compFilter],
  );
  const quarterTotal = 18 + feed.length; // seeded quarter volume + live additions

  const openComposer = (mode: "give" | "request") => {
    if (composer === mode) { setComposer(null); return; }
    setTab("stream"); // composers live with the stream
    setComposer(mode); setPerson(null); setComp(null);
  };

  const openPerson = (name: string) => {
    if (name === "You") { go("me"); toast("Opening your portal — feedback shows on your own timeline too."); return; }
    const emp = EMPLOYEES.find((e) => e.name === name);
    go("employee");
    toast(`Opening record${emp ? ` ${emp.id}` : ""} — ${name}`);
  };

  const sendGive = () => {
    if (!person) { toast("Pick who this feedback is for."); return; }
    if (!comp) { toast("Tag a competency — same taxonomy as hiring & reviews."); return; }
    if (text.trim().length < 8) { toast("Add a specific observation before sending."); return; }
    const item: FbItem = { id: `F-${nid.current++}`, giver: "You", receiver: person, competency: comp, type: fbType, text: text.trim(), time: "Just now", visibility: vis };
    setFeed((f) => [item, ...f]);
    setComposer(null); setPerson(null); setComp(null); setText(""); setFbType("Praise"); setVis("Private to them");
    setTypeFilter("All"); setCompFilter("All");
    toast(`Feedback sent to ${person} — on their profile timeline now; feeds the Q2 2026 review packet (FR-067).`, "success");
  };

  const sendRequest = () => {
    if (!person) { toast("Pick who to request feedback from."); return; }
    if (!comp) { toast("Pick the competency you want input on."); return; }
    setPending((p) => [{ to: person, competency: comp, when: "Just now" }, ...p]);
    const who = person;
    setComposer(null); setPerson(null); setComp(null);
    toast(`Feedback request sent to ${who} (${comp}) — added to pending; their reply lands in this stream.`, "success");
  };

  const segBtn = (label: FbType): React.CSSProperties => {
    const active = fbType === label;
    const t = label === "Praise" ? TONE.green : TONE.yellow;
    return {
      fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
      border: `1px solid ${active ? "transparent" : "var(--pf-n100)"}`,
      background: active ? t.soft : "var(--pf-n0)", color: active ? t.fg : "var(--pf-n500)",
      display: "inline-flex", alignItems: "center", gap: 6, lineHeight: 1.3,
    };
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* ------------------------------- Header ------------------------------- */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.3px", margin: 0, lineHeight: 1.2 }}>Feedback</h1>
            <PfBadge tone="green">One stream · FR-069</PfBadge>
          </div>
          <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 3 }}>
            Continuous feedback tied to the unified competency taxonomy — it lands on profile timelines and feeds review packets.
          </div>
        </div>
        <PfBtn variant="secondary" icon="megaphone" onClick={() => openComposer("request")}>Request feedback</PfBtn>
        <PfBtn variant="primary" icon="chat" onClick={() => openComposer("give")}>Give feedback</PfBtn>
      </div>

      {/* ----------------------------- Section tabs ----------------------------- */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "stream", label: "Stream", count: String(feed.length) },
            { key: "requests", label: "Requests", count: String(pending.length) },
            { key: "insights", label: "Insights" },
          ]}
        />
      </div>

      {/* ----------------- Inline composer — lives with the stream ----------------- */}
      {tab === "stream" && composer && (
        <PfCard style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
            <PfTile icon={composer === "give" ? "chat" : "megaphone"} tone={composer === "give" ? "green" : "blue"} size={28} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--pf-n900)" }}>
                {composer === "give" ? "Give feedback" : "Request feedback"}
              </div>
              <div style={{ fontSize: 12, color: "var(--pf-n400)" }}>
                {composer === "give"
                  ? "Specific, competency-tagged, on the record — the receiver sees it on their timeline."
                  : "They get an in-app + WhatsApp nudge; their reply lands in this same stream."}
              </div>
            </div>
            <button onClick={() => setComposer(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pf-n400)", display: "flex", padding: 4 }}>
              <Ic name="x" size={15} />
            </button>
          </div>

          <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Person chips */}
            <div>
              <FieldLabel>{composer === "give" ? "To" : "Request from"}</FieldLabel>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {TEAM.map((m) => (
                  <Chip key={m.name} label={m.name} dot={m.tone} active={person === m.name} onClick={() => setPerson(person === m.name ? null : m.name)} />
                ))}
              </div>
            </div>

            {/* Competency chips + taxonomy note */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <FieldLabel>Competency</FieldLabel>
                <button
                  onClick={() => toast("One taxonomy end-to-end — interview scorecards, feedback and review packets share the same competency ids (no re-mapping).")}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, color: "var(--pf-n400)", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 7 }}
                >
                  <Ic name="info" size={12} /> same taxonomy as hiring &amp; reviews
                </button>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {COMPETENCIES.map((c) => (
                  <Chip key={c} label={c} active={comp === c} onClick={() => setComp(comp === c ? null : c)} />
                ))}
              </div>
            </div>

            {composer === "give" && (
              <>
                {/* Type toggle */}
                <div>
                  <FieldLabel>Type</FieldLabel>
                  <div style={{ display: "flex", gap: 7 }}>
                    <button style={segBtn("Praise")} onClick={() => setFbType("Praise")}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE.green.bg }} /> Praise
                    </button>
                    <button style={segBtn("Constructive")} onClick={() => setFbType("Constructive")}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: TONE.yellow.bg }} /> Constructive
                    </button>
                  </div>
                </div>

                {/* Note + live inclusive-language check */}
                <div>
                  <FieldLabel>Note</FieldLabel>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What did you observe? Be specific — situation, behaviour, impact…"
                    style={{ width: "100%", minHeight: 76, resize: "vertical", boxSizing: "border-box", background: "var(--pf-n0)", border: `1px solid ${flags.length ? "var(--pf-yellow-100)" : "var(--pf-n100)"}`, borderRadius: 9, padding: "10px 12px", fontFamily: "inherit", fontSize: 13, color: "var(--pf-n900)", lineHeight: 1.5, outline: "none" }}
                  />
                  {flags.length > 0 && (
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--pf-yellow-50)", border: "1px solid var(--pf-yellow-100)", borderRadius: 9, padding: "9px 12px", marginTop: 8 }}>
                      <Ic name="warning" size={14} color="#B87F06" />
                      <div style={{ fontSize: 12, color: "#B87F06", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700 }}>Inclusive-language check — &ldquo;{flags[0].w}&rdquo;:</span> {flags[0].tip}{" "}
                        <span style={{ color: "var(--pf-n400)" }}>Stage-2 language model · runs before send · you decide what ships.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Visibility */}
                <div>
                  <FieldLabel>Visibility</FieldLabel>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {(["Private to them", "Them + manager"] as Visibility[]).map((v) => (
                      <Chip key={v} label={v} active={vis === v} onClick={() => setVis(v)} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--pf-n50)", paddingTop: 13, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--pf-n400)", flex: 1, minWidth: 220 }}>
                {composer === "give"
                  ? "Lands on the profile timeline · auto-feeds the Q2 2026 review packet (FR-067)."
                  : "Requests are visible to you and the person asked — nothing anonymous, per PRD §7."}
              </span>
              <PfBtn variant="ghost" onClick={() => setComposer(null)}>Cancel</PfBtn>
              {composer === "give"
                ? <PfBtn variant="primary" icon="paperplane" onClick={sendGive}>Send feedback</PfBtn>
                : <PfBtn variant="primary" icon="paperplane" onClick={sendRequest}>Send request</PfBtn>}
            </div>
          </div>
        </PfCard>
      )}

      {/* --------------------------- Pending requests -------------------------- */}
      {tab === "requests" && (
      <PfCard>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
          <PfTile icon="clock" tone="yellow" size={26} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Pending requests</span>
          <PfBadge tone="yellow">{pending.length} open</PfBadge>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>Replies land in the stream below</span>
        </div>
        {pending.map((p, i) => {
          const pi = PEOPLE[p.to] ?? { init: "?", tone: "#475569" };
          return (
            <div key={`${p.to}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: i === pending.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
              <PfAvatar init={pi.init} tone={pi.tone} size={28} />
              <span style={{ fontSize: 13, color: "var(--pf-n900)", fontWeight: 600 }}>{p.to}</span>
              <PfBadge tone="grey">{p.competency}</PfBadge>
              <span style={{ fontSize: 12, color: "var(--pf-n400)" }}>requested {p.when}</span>
              <span style={{ flex: 1 }} />
              <PfBtn small variant="secondary" icon="bell" onClick={() => toast(`Nudge sent to ${p.to} on WhatsApp + in-app — re: your ${p.competency} feedback request (${p.when}).`, "success")}>
                Nudge
              </PfBtn>
            </div>
          );
        })}
      </PfCard>
      )}

      {/* -------------------------------- Stream -------------------------------- */}
      {tab === "stream" && (
        <div style={{ minWidth: 0, maxWidth: 800 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {(["All", "Praise", "Constructive", "Mine"] as const).map((t) => (
              <Chip
                key={t}
                label={t}
                dot={t === "Praise" ? TONE.green.bg : t === "Constructive" ? TONE.yellow.bg : undefined}
                active={typeFilter === t}
                onClick={() => setTypeFilter(t)}
              />
            ))}
            <select
              value={compFilter}
              onChange={(e) => setCompFilter(e.target.value)}
              style={{ fontFamily: "inherit", fontSize: 12.5, fontWeight: 500, color: "var(--pf-n600)", background: "var(--pf-n0)", border: "1px solid var(--pf-n100)", borderRadius: 999, padding: "6px 10px", cursor: "pointer", outline: "none" }}
            >
              <option value="All">All competencies</option>
              {COMPETENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>
              {shown.length} shown · {quarterTotal} items this quarter
            </span>
          </div>

          {shown.length === 0 ? (
            <PfCard pad="38px 24px" style={{ textAlign: "center", borderStyle: "dashed" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><PfTile icon="chat" tone="grey" size={36} /></div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 3 }}>Nothing matches these filters</div>
              <div style={{ fontSize: 13, color: "var(--pf-n400)", marginBottom: 13 }}>The stream is one feed — try widening type or competency.</div>
              <PfBtn variant="secondary" onClick={() => { setTypeFilter("All"); setCompFilter("All"); toast("Filters cleared"); }}>Clear filters</PfBtn>
            </PfCard>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shown.map((f) => <FbCard key={f.id} f={f} onOpenPerson={openPerson} />)}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------- Insights ------------------------------- */}
      {tab === "insights" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, alignItems: "start", maxWidth: 920 }}>
          {/* Feedback health */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="pulse" tone="green" size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Feedback health</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Ngozi&rsquo;s team · given vs received · Q2 to date</div>
              </div>
            </div>
            <div style={{ padding: "10px 14px 14px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 9 }}>
                <span style={{ fontSize: 11.5, color: "var(--pf-n500)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--pf-primary-500)" }} /> Given
                </span>
                <span style={{ fontSize: 11.5, color: "var(--pf-n500)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--pf-blue-500)" }} /> Received
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {HEALTH.map((h) => {
                  const zero = h.received === 0;
                  return (
                    <div key={h.name} style={{ padding: "7px 8px", borderRadius: 8, background: zero ? "var(--pf-red-50)" : "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.name}</span>
                        {zero
                          ? <PfBadge tone="red">0 received</PfBadge>
                          : <span style={{ fontSize: 11, color: "var(--pf-n400)", whiteSpace: "nowrap" }}>{h.given} given · {h.received} received</span>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <div style={{ height: 5, borderRadius: 5, background: "var(--pf-n50)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(h.given / HEALTH_MAX) * 100}%`, borderRadius: 5, background: "var(--pf-primary-500)" }} />
                        </div>
                        <div style={{ height: 5, borderRadius: 5, background: "var(--pf-n50)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(h.received / HEALTH_MAX) * 100}%`, borderRadius: 5, background: "var(--pf-blue-500)" }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 11 }}>
                <PfBtn variant="secondary" small full icon="sparkle" onClick={() => toast("AI drafted nudges to the 3 teammates who haven’t given Emeka Nwosu feedback this quarter — review and approve before anything sends.", "ai")}>
                  Nudge team
                </PfBtn>
              </div>
            </div>
          </PfCard>

          {/* Themes this quarter */}
          <PfCard>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", borderBottom: "1px solid var(--pf-n50)" }}>
              <PfTile icon="sparkle" tone="purple" size={26} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>Themes this quarter</div>
                <div style={{ fontSize: 11.5, color: "var(--pf-n400)" }}>Clustered by the Stage-2 model — tap for evidence</div>
              </div>
            </div>
            <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
              {THEMES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => toast(`Theme “${t.label}” — ${t.n} feedback items, ${t.note} (Stage-2 clustering, confidence 0.8). Evidence stays linked to each item.`, "ai")}
                  style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: 9, padding: "9px 11px", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.tone, flex: "none" }} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)", flex: 1 }}>{t.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n400)" }}>×{t.n}</span>
                </button>
              ))}
              <div style={{ fontSize: 11.5, color: "var(--pf-n400)", lineHeight: 1.5, marginTop: 3 }}>
                AI proposes themes; nothing is filed to a packet without a human in the loop.
              </div>
            </div>
          </PfCard>
        </div>
      )}

      {/* --------------------------- Governance footer -------------------------- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 24, fontSize: 12, color: "var(--pf-n400)" }}>
        <Ic name="shield" size={13} />
        One stream — feedback lives on the profile and feeds review packets; there is no separate silo (PRD §7).
      </div>
    </div>
  );
}
