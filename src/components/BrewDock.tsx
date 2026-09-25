"use client";
import { useEffect, useRef, useState } from "react";
import { PfCard, PfBadge, PfTile } from "@/components/os/ui";
import { Ic } from "@/components/os/icons";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";
import {
  BREW_ESCALATE,
  BREW_INTRO,
  BREW_QA,
  BREW_SCOPE,
  HANDBOOK,
  type BrewQA,
} from "@/data/onboarding";

/**
 * Brew · the onboarding buddy (PATH A · A3 — "Brew rides along").
 *
 * RAG over the company handbook and nothing else: 8 documents, every answer
 * carries its citations, and a question outside the corpus escalates to People
 * Ops rather than being guessed at. Docked as a persistent right rail on all
 * three /welcome sections — it is not a tab, because the spec says it rides
 * along with the whole journey.
 *
 * The answer shape (scope line + cited evidence + escalation) is AskBar.tsx's,
 * deliberately — this is the same idiom, not a fourth chat pattern. The corpus
 * and the canned answers live in @/data/onboarding; nothing is defined twice.
 */

type ThreadItem =
  | { kind: "q"; id: string; text: string }
  | { kind: "a"; id: string; a: BrewQA; unmatched?: boolean };

/** Out-of-corpus fallback — Brew says what it cannot see rather than improvising. */
const OUT_OF_SCOPE = (q: string): BrewQA => ({
  q,
  a: "That is not in the handbook, and the handbook is all I read — so I would only be guessing. People Ops answers anything outside it, usually the same day.",
  cites: [],
  escalate: BREW_ESCALATE,
});

/** Plain keyword routing onto the governed answers in BREW_QA. */
function matchBrew(q: string): BrewQA {
  const s = q.toLowerCase();
  const has = (...k: string[]) => k.some((w) => s.includes(w));
  if (has("expense", "claim", "reimburs", "receipt")) return BREW_QA[0];
  if (has("paid", "pay ", "payslip", "salary", "payroll", "25th", "paye", "pension")) return BREW_QA[1];
  if (has("leave", "holiday", "vacation", "time off", "annual")) return BREW_QA[2];
  if (has("bosiet", "nebosh", "medical", "hse", "offshore", "safety", "fitness")) return BREW_QA[3];
  if (has("course", "learn", "training", "kafka", "budget", "coach", "l&d")) return BREW_QA[4];
  if (has("office", "remote", "days a week", "wfh", "desk", "hq", "onsite", "on-site")) return BREW_QA[5];
  return OUT_OF_SCOPE(q);
}

/* ------------------------------- Small bits ------------------------------- */

function AskChip({ q, onClick }: { q: string; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left", fontFamily: "inherit",
        fontSize: 12, fontWeight: 500, lineHeight: 1.4,
        color: hovered ? "var(--pf-n900)" : "var(--pf-n500)",
        background: "var(--pf-n0)",
        border: `1px solid ${hovered ? "var(--pf-purple-100)" : "var(--pf-n100)"}`,
        borderRadius: 9, padding: "7px 11px", cursor: "pointer",
      }}
    >
      {q}
    </button>
  );
}

function CiteChip({ id, open, onClick }: { id: string; open: boolean; onClick: () => void }) {
  const doc = HANDBOOK.find((d) => d.id === id);
  const { hovered, hoverProps } = useHover();
  if (!doc) return null;
  return (
    <button
      {...hoverProps}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit",
        fontSize: 11, fontWeight: 500, cursor: "pointer",
        color: open ? "var(--pf-purple-500)" : hovered ? "var(--pf-n900)" : "var(--pf-n500)",
        background: open ? "var(--pf-purple-50)" : "var(--pf-n25)",
        border: `1px solid ${open ? "var(--pf-purple-100)" : "var(--pf-n100)"}`,
        borderRadius: 6, padding: "3px 7px", lineHeight: 1.35,
      }}
    >
      <Ic name="book" size={11} color={open ? "var(--pf-purple-500)" : "var(--pf-n400)"} />
      {doc.title}
    </button>
  );
}

function DocPanel({ id }: { id: string }) {
  const doc = HANDBOOK.find((d) => d.id === id);
  if (!doc) return null;
  return (
    <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n100)", borderRadius: 9, padding: "9px 11px", marginTop: 7 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".5px", color: "var(--pf-purple-500)", textTransform: "uppercase" }}>{doc.section}</span>
        <span style={{ fontSize: 10.5, color: "var(--pf-n300)" }}>·</span>
        <span style={{ fontSize: 10.5, color: "var(--pf-n400)" }}>{doc.owner}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-n900)", marginBottom: 4 }}>{doc.title}</div>
      <div style={{ fontSize: 11.5, color: "var(--pf-n500)", lineHeight: 1.55 }}>{doc.body}</div>
      <div style={{ fontSize: 10.5, color: "var(--pf-n300)", marginTop: 6 }}>Last updated {doc.updated}</div>
    </div>
  );
}

/* --------------------------------- Rail --------------------------------- */

export default function BrewDock({
  open,
  onToggle,
  onOpenTask,
}: {
  open: boolean;
  onToggle: () => void;
  onOpenTask: (taskId: string) => void;
}) {
  const toast = useToast();
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [draft, setDraft] = useState("");
  const [openCite, setOpenCite] = useState<string | null>(null);
  const [corpusOpen, setCorpusOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thread.length > 1) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [thread.length]);

  const ask = (raw: string) => {
    const text = raw.trim();
    if (!text) {
      toast("Ask Brew anything from the handbook — expenses, leave, pay, HSE");
      return;
    }
    const a = matchBrew(text);
    idRef.current += 1;
    const n = idRef.current;
    setThread((t) => [
      ...t,
      { kind: "q", id: `q-${n}`, text },
      { kind: "a", id: `a-${n}`, a, unmatched: a.cites.length === 0 },
    ]);
    setDraft("");
    setOpenCite(null);
    toast(
      a.cites.length
        ? `Brew answered from ${a.cites.length} handbook document${a.cites.length > 1 ? "s" : ""} — citations on the answer`
        : "Brew could not find that in the handbook — escalate to People Ops",
      a.cites.length ? "ai" : "default",
    );
  };

  /* Collapsed — a slim launcher, so the rail is never in the way. */
  if (!open) {
    return (
      <div style={{ position: "sticky", top: 128, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button
          onClick={onToggle}
          title="Open Brew"
          style={{
            width: 52, height: 52, borderRadius: 16, cursor: "pointer",
            background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Ic name="sparkle" size={22} color="var(--pf-purple-500)" />
        </button>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--pf-n400)", writingMode: "vertical-rl", letterSpacing: ".4px" }}>
          Ask Brew
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "sticky", top: 128, display: "flex", flexDirection: "column", gap: 12 }}>
      <PfCard style={{ overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", borderBottom: "1px solid var(--pf-n50)" }}>
          <PfTile icon="sparkle" tone="purple" size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--pf-n900)" }}>{BREW_INTRO}</div>
            <div style={{ fontSize: 11, color: "var(--pf-n400)", marginTop: 1 }}>Awake at 9pm, same as at 9am.</div>
          </div>
          <button
            onClick={onToggle}
            title="Hide Brew"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: "var(--pf-n300)" }}
          >
            <Ic name="x" size={15} color="var(--pf-n300)" />
          </button>
        </div>

        {/* Scope — stated before the first answer, not buried after it */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "9px 15px", background: "var(--pf-n25)", borderBottom: "1px solid var(--pf-n50)" }}>
          <span style={{ marginTop: 1 }}><Ic name="shield" size={12} color="var(--pf-n400)" /></span>
          <span style={{ fontSize: 11, color: "var(--pf-n500)", lineHeight: 1.5 }}>{BREW_SCOPE}</span>
        </div>

        {/* Thread */}
        <div style={{ maxHeight: 430, overflowY: "auto", padding: "12px 15px", display: "flex", flexDirection: "column", gap: 10 }}>
          {thread.length === 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              <PfTile icon="sparkle" tone="purple" size={24} />
              <div style={{ flex: 1, fontSize: 12, color: "var(--pf-n500)", lineHeight: 1.55, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: "10px 10px 10px 3px", padding: "9px 11px" }}>
                Hi Chidi. Ask me anything from the handbook — expenses, leave, pay, what your Lagos role actually needs. You will not be pinging HR at 9pm for it.
              </div>
            </div>
          )}

          {thread.map((item) =>
            item.kind === "q" ? (
              <div key={item.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ background: "var(--pf-n900)", color: "#fff", borderRadius: "12px 12px 3px 12px", padding: "8px 12px", fontSize: 12, fontWeight: 500, lineHeight: 1.45, maxWidth: 250 }}>
                  {item.text}
                </div>
              </div>
            ) : (
              <div key={item.id} style={{ display: "flex", gap: 8 }}>
                <PfTile icon="sparkle" tone={item.unmatched ? "grey" : "purple"} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12, color: "var(--pf-n600)", lineHeight: 1.55,
                      background: item.unmatched ? "var(--pf-n25)" : "var(--pf-purple-50)",
                      border: `1px solid ${item.unmatched ? "var(--pf-n100)" : "var(--pf-purple-100)"}`,
                      borderRadius: "10px 10px 10px 3px", padding: "9px 11px",
                    }}
                  >
                    {item.a.a}
                  </div>

                  {item.a.cites.length > 0 && (
                    <>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                        <span style={{ fontSize: 10.5, color: "var(--pf-n300)", alignSelf: "center" }}>From:</span>
                        {item.a.cites.map((c) => (
                          <CiteChip
                            key={c}
                            id={c}
                            open={openCite === `${item.id}:${c}`}
                            onClick={() => setOpenCite((o) => (o === `${item.id}:${c}` ? null : `${item.id}:${c}`))}
                          />
                        ))}
                      </div>
                      {item.a.cites
                        .filter((c) => openCite === `${item.id}:${c}`)
                        .map((c) => <DocPanel key={c} id={c} />)}
                    </>
                  )}

                  {item.a.task && (
                    <button
                      onClick={() => {
                        onOpenTask(item.a.task as string);
                        toast("Jumped to that item on your checklist", "success");
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7,
                        fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                        color: "var(--pf-primary-600)", background: "var(--pf-primary-50)",
                        border: "1px solid var(--pf-primary-100)", borderRadius: 7, padding: "4px 9px",
                      }}
                    >
                      Open it on your checklist <Ic name="arrowright" size={12} color="var(--pf-primary-600)" />
                    </button>
                  )}

                  {item.unmatched && (
                    <button
                      onClick={() => toast("Sent to People Ops · Funke Adebayo — she replies inside a working day", "success")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7,
                        fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                        color: "var(--pf-n600)", background: "var(--pf-n0)",
                        border: "1px solid var(--pf-n100)", borderRadius: 7, padding: "4px 9px",
                      }}
                    >
                      {BREW_ESCALATE}
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 13px", borderTop: "1px solid var(--pf-n50)" }}>
          <div
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "var(--pf-n0)",
              border: `1px solid ${focused ? "var(--pf-purple-500)" : "var(--pf-n100)"}`,
              borderRadius: 10, padding: "5px 5px 5px 11px",
              boxShadow: focused ? "0 0 0 3px rgba(175,82,222,.1)" : "none",
              transition: "border-color .15s ease, box-shadow .15s ease",
            }}
          >
            <Ic name="sparkle" size={14} color="var(--pf-purple-500)" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => { if (e.key === "Enter") ask(draft); }}
              placeholder="How do I claim expenses?"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "inherit", fontSize: 12.5, color: "var(--pf-n900)", padding: "6px 2px" }}
            />
            <button
              onClick={() => ask(draft)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer", background: "var(--pf-purple-500)", flex: "none" }}
            >
              <Ic name="arrowup" size={15} color="#fff" weight={2} />
            </button>
          </div>
        </div>
      </PfCard>

      {/* Suggested questions — real ones, from the real corpus */}
      <PfCard>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 15px", borderBottom: "1px solid var(--pf-n50)" }}>
          <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>Things new joiners ask</div>
          <PfBadge tone="grey">{BREW_QA.length}</PfBadge>
        </div>
        <div style={{ padding: "10px 13px", display: "flex", flexDirection: "column", gap: 6 }}>
          {BREW_QA.map((qa) => <AskChip key={qa.q} q={qa.q} onClick={() => ask(qa.q)} />)}
        </div>
      </PfCard>

      {/* The corpus, stated — what Brew can and cannot read */}
      <PfCard>
        <button
          onClick={() => setCorpusOpen((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 15px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}
        >
          <Ic name="book" size={15} color="var(--pf-n400)" />
          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: "var(--pf-n900)" }}>What Brew can read</span>
          <PfBadge tone="grey">{HANDBOOK.length} docs</PfBadge>
          <Ic name={corpusOpen ? "caretdown" : "caretright"} size={13} color="var(--pf-n300)" />
        </button>
        {corpusOpen && (
          <div style={{ borderTop: "1px solid var(--pf-n50)" }}>
            {HANDBOOK.map((d, i) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 15px", borderBottom: i === HANDBOOK.length - 1 ? "none" : "1px solid var(--pf-n50)" }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".4px", color: "var(--pf-n300)", textTransform: "uppercase", width: 62, flex: "none" }}>{d.section}</span>
                <span style={{ flex: 1, fontSize: 11.5, color: "var(--pf-n600)" }}>{d.title}</span>
                <span style={{ fontSize: 10.5, color: "var(--pf-n300)" }}>{d.updated}</span>
              </div>
            ))}
            <div style={{ padding: "9px 15px", background: "var(--pf-n25)", fontSize: 11, color: "var(--pf-n500)", lineHeight: 1.5, borderTop: "1px solid var(--pf-n50)" }}>
              Not in here: your pay, your review, your manager&apos;s notes, anyone else&apos;s record. Brew cannot see them, so it cannot leak them.
            </div>
          </div>
        )}
      </PfCard>
    </div>
  );
}
