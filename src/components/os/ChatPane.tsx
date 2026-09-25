"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { PfBadge, PfBtn, PfCard, PfCardHead, PfTile } from "./ui";

/**
 * ChatPane — the app's ONE conversational surface.
 *
 * Lifted verbatim out of SourcingChat.tsx (the user/agent bubbles with their
 * asymmetric border radii, the ✦ Reasoning purple block, the animated
 * ✦ reasoning dots, the suggestion-chip row and the Enter-to-send composer)
 * so the pattern exists once and both callers — Sourcing Chat and the
 * "Describe the role" intake in Requisitions — render identical chat.
 *
 * It owns the scroll-to-bottom effect and nothing else. The 620ms exchange()
 * timing stays with each caller, because SourcingChat's run-log side effects
 * and Requisitions' field-filling are different jobs.
 */

export type Msg = { id: number; role: "user" | "agent"; text: string; reasoning?: string[] };

export type ChatSuggestion = { label: string; run: () => void };

function SuggestionChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "inherit", fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 99,
        cursor: "pointer", whiteSpace: "nowrap", border: "1px solid var(--pf-n100)",
        background: "var(--pf-n0)", color: "var(--pf-n500)",
      }}
    >
      {label}
    </button>
  );
}

export default function ChatPane({
  title, sub, headRight, msgs, typing, draft, onDraft, onSend,
  suggestions = [], agentLabel = "Agent", placeholder = "Type a message…", height = 660,
  sendLabel = "Send", sendIcon = "paperplane", footer,
}: {
  title: ReactNode;
  sub?: ReactNode;
  headRight?: ReactNode;
  msgs: Msg[];
  typing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onSend: () => void;
  suggestions?: ChatSuggestion[];
  agentLabel?: string;
  placeholder?: string;
  height?: number;
  sendLabel?: string;
  sendIcon?: string;
  footer?: ReactNode;
}) {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length, typing]);

  return (
    <PfCard style={{ display: "flex", flexDirection: "column", height, overflow: "hidden" }}>
      <PfCardHead title={title} sub={sub}>
        {headRight ?? <PfBadge tone="purple" dot>Agent live</PfBadge>}
      </PfCardHead>

      {/* messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} style={{ alignSelf: "flex-end", maxWidth: "84%", background: "var(--pf-n900)", color: "#fff", borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5, animation: "scIn .18s ease" }}>
              {m.text}
            </div>
          ) : (
            <div key={m.id} style={{ alignSelf: "flex-start", maxWidth: "92%", animation: "scIn .18s ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <PfTile icon="sparkle" tone="purple" size={18} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--pf-n400)" }}>{agentLabel}</span>
              </div>
              <div style={{ background: "var(--pf-n25)", border: "1px solid var(--pf-n50)", borderRadius: "3px 12px 12px 12px", padding: "10px 13px", fontSize: 13, color: "var(--pf-n600)", lineHeight: 1.55 }}>
                {m.text}
                {m.reasoning && (
                  <div style={{ background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 8, padding: "8px 11px", marginTop: 9 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-purple-500)", letterSpacing: ".3px", marginBottom: 5 }}>✦ Reasoning</div>
                    {m.reasoning.map((r) => (
                      <div key={r} style={{ display: "flex", gap: 6, fontSize: 11.5, color: "var(--pf-purple-500)", opacity: 0.9, lineHeight: 1.55 }}>
                        <span>·</span><span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {typing && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, background: "var(--pf-purple-50)", border: "1px solid var(--pf-purple-100)", borderRadius: 10, padding: "8px 12px" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-purple-500)" }}>✦ reasoning</span>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--pf-purple-500)", animation: "pulseDot 1s ease infinite", animationDelay: `${i * 0.18}s` }} />
            ))}
          </div>
        )}
      </div>

      {footer}

      {/* suggestion chips */}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", flexWrap: "wrap" }}>
          {suggestions.map((s) => <SuggestionChip key={s.label} label={s.label} onClick={s.run} />)}
        </div>
      )}

      {/* composer */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 16px", alignItems: "center" }}>
        <input
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder={placeholder}
          style={{ flex: 1, fontFamily: "inherit", fontSize: 13, padding: "9px 12px", borderRadius: 8, border: "1px solid var(--pf-n100)", outline: "none", color: "var(--pf-n900)", background: "var(--pf-n0)" }}
        />
        <PfBtn variant="primary" icon={sendIcon} onClick={onSend}>{sendLabel}</PfBtn>
      </div>
    </PfCard>
  );
}
