"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

type Notif = {
  id: string;
  icon: string;
  tone: string;
  tBg: string;
  title: string;
  desc: string;
  time: string;
  unread: boolean;
  mention: boolean;
  go: string;
};

const NOTIFS: Notif[] = [
  { id: "shortlist", icon: "✦", tone: "#AF52DE", tBg: "#F7EEFC", title: "12 shortlist matches ready to review", desc: "Overnight AI screening finished for Senior Product Designer", time: "8m ago", unread: true, mention: false, go: "shortlist" },
  { id: "aging", icon: "⚠", tone: "#EBA308", tBg: "#FEF7E6", title: "Backend Engineer req aging past SLA", desc: "14 days open with no shortlist — sourcing yield below forecast", time: "1h ago", unread: true, mention: false, go: "jobs" },
  { id: "offer", icon: "✓", tone: "#16B364", tBg: "#ECF9F3", title: "Offer accepted — Funmi Alabi", desc: "Product Manager · starts Jul 15", time: "3h ago", unread: true, mention: true, go: "qoh" },
  { id: "panel", icon: "☷", tone: "#16B364", tBg: "#ECF9F3", title: "Panel feedback submitted", desc: "David Mensah completed the scorecard for Adaeze Obi", time: "5h ago", unread: false, mention: true, go: "profile" },
  { id: "bias", icon: "⚖", tone: "#C21A14", tBg: "#FDE8E8", title: "Bias flag — Data Scientist role", desc: "AIR 0.71 below threshold — review recommended", time: "Yesterday", unread: false, mention: false, go: "dei" },
  { id: "reference", icon: "☎", tone: "#AF52DE", tBg: "#F7EEFC", title: "Reference call completed", desc: "Chioma A. reference for Adaeze scored green", time: "Yesterday", unread: false, mention: true, go: "profile" },
];

type FilterKey = "all" | "unread" | "mentions";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
];

function NotifRow({ n, unread, onClick }: { n: Notif; unread: boolean; onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  const rowBg = unread ? "#FBF7FD" : "#fff";
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "15px 18px", borderBottom: "1px solid var(--border2)", cursor: "pointer", background: hovered ? "#F8FAFC" : rowBg }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 10, background: n.tBg, color: n.tone, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flex: "none" }}>{n.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
        <div style={{ fontSize: 12, color: "var(--ink2)", lineHeight: 1.45 }}>{n.desc}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
        <span style={{ fontSize: 11, color: "var(--ink3)" }}>{n.time}</span>
        {unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16B364" }} />}
      </div>
    </div>
  );
}

export default function Notifications() {
  const go = useGo();
  const toast = useToast();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const isUnread = (n: Notif) => n.unread && !readIds.has(n.id);
  const unreadCount = NOTIFS.filter(isUnread).length;
  const mentionCount = NOTIFS.filter((n) => n.mention).length;

  const counts: Record<FilterKey, number> = { all: NOTIFS.length, unread: unreadCount, mentions: mentionCount };

  const visible = NOTIFS.filter((n) => {
    if (filter === "unread") return isUnread(n);
    if (filter === "mentions") return n.mention;
    return true;
  });

  const markAllRead = () => {
    setReadIds(new Set(NOTIFS.map((n) => n.id)));
    toast("All notifications marked as read");
  };

  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: "0 0 3px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Notifications</h1>
          <div style={{ fontSize: 13, color: "var(--ink2)" }}>{unreadCount} unread · pipeline activity</div>
        </div>
        <button
          onClick={markAllRead}
          style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}
        >
          Mark all read
        </button>
      </div>

      {/* Section tabs — All / Unread / Mentions with live counts */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={filter}
          onSelect={(k) => setFilter(k as FilterKey)}
          tabs={FILTERS.map((f) => ({
            key: f.key,
            label: f.label,
            count: counts[f.key] > 0 ? String(counts[f.key]) : undefined,
          }))}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {visible.length === 0 ? (
          <div style={{ padding: "36px 18px", textAlign: "center", fontSize: 13, color: "var(--ink3)" }}>You&rsquo;re all caught up.</div>
        ) : (
          visible.map((n) => <NotifRow key={n.id} n={n} unread={isUnread(n)} onClick={() => go(n.go)} />)
        )}
      </div>
    </div>
  );
}
