"use client";
import { useState } from "react";
import { PfPageTabs } from "@/components/os/ui";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

const channels = [
  { name: "LinkedIn (senior)", yield: 92, label: "High", color: "#16B364" },
  { name: "Design communities", yield: 80, label: "High", color: "#16B364" },
  { name: "Internal talent pool", yield: 68, label: "Med", color: "#16B364" },
  { name: "Referrals", yield: 55, label: "Med", color: "#16B364" },
  { name: "WhatsApp groups", yield: 24, label: "Low", color: "#EBA308" },
];

const warm = [
  { init: "AO", name: "Adaeze Okafor", tone: "#AF52DE", note: "Silver-medallist · Senior PD role, Q4 2025", tag: "Open to move", tagColor: "#16B364", tagBg: "#ECF9F3" },
  { init: "KU", name: "Kemi Uche", tone: "#16B364", note: "Inbound · strong systems portfolio", tag: "Warm", tagColor: "#16B364", tagBg: "#ECF9F3" },
  { init: "DI", name: "David Igwe", tone: "#475569", note: "Past applicant · now 2 yrs more senior", tag: "Re-engage", tagColor: "#475569", tagBg: "#F8FAFC" },
];

function WarmRow({ w }: { w: typeof warm[number] }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div {...hoverProps} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 10, background: hovered ? "#FBFCFD" : undefined }}>
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: w.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>{w.init}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{w.name}</div>
        <div style={{ fontSize: 11, color: "var(--ink3)" }}>{w.note}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: w.tagColor, background: w.tagBg, padding: "3px 9px", borderRadius: 5 }}>{w.tag}</span>
    </div>
  );
}

export default function Sourcing() {
  const toast = useToast();
  const [tab, setTab] = useState("channels");
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>
      {/* Stage header — stays above the section-tab bar */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".7px", color: "#16B364", marginBottom: 5 }}>STAGE 03 · SOURCING</div>
      <h1 style={{ margin: "0 0 4px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>A targeted funnel, not a hopeful broadcast</h1>
      <div style={{ fontSize: 13, color: "var(--ink2)" }}>AI mines the internal pool, predicts the highest-yield channels, and drafts personalised outreach in Hirebrew&apos;s voice.</div>

      {/* Section tabs — the page's own sections, tabbed */}
      <div style={{ margin: "16px -28px 16px" }}>
        <PfPageTabs
          active={tab}
          onSelect={setTab}
          tabs={[
            { key: "channels", label: "Channel mix & warm matches", count: "9" },
            { key: "outreach", label: "Drafted outreach", count: "18" },
          ]}
        />
      </div>

      {/* CHANNEL MIX + WARM MATCHES — where the pipeline comes from */}
      {tab === "channels" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Channel mix · projected yield</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {channels.map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 140, fontSize: 12.5, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ flex: 1, height: 8, borderRadius: 5, background: "var(--border2)", overflow: "hidden" }}><div style={{ height: "100%", width: `${c.yield}%`, background: c.color, borderRadius: 5 }} /></div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, width: 48, textAlign: "right", color: c.color }}>{c.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 15, padding: "11px 12px", background: "#ECF9F3", border: "1px solid #B7EBD1", borderRadius: 10, fontSize: 12, color: "#129152", lineHeight: 1.5 }}><b>Diversity nudge:</b> add Women in Tech NG + Nairobi design guild — historically yielded more diverse senior pipelines for this role family.</div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 8 }}>
            <div style={{ padding: "11px 13px 9px", display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".4px", color: "var(--ink3)" }}>WARM MATCHES · INTERNAL TALENT POOL</span><span style={{ fontSize: 11, fontWeight: 600, color: "#AF52DE" }}>9 found</span></div>
            {warm.map((w) => <WarmRow key={w.init} w={w} />)}
          </div>
        </div>
      )}

      {/* DRAFTED OUTREACH — review before anything is sent */}
      {tab === "outreach" && (
        <div style={{ maxWidth: 680, background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}><span style={{ color: "#AF52DE" }}>✎</span><div style={{ fontWeight: 700, fontSize: 14 }}>Drafted outreach · review before send</div></div>
          <div style={{ background: "#FBFCFD", border: "1px solid var(--border2)", borderRadius: 10, padding: "13px 14px", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.6 }}>Hi Adaeze — your work on Paystack&apos;s checkout redesign caught our eye. At Hirebrew we&apos;re building payments for thousands of NG businesses and want a senior designer to own it end-to-end. Worth a 20-min chat this week?</div>
          <div style={{ display: "flex", gap: 9, marginTop: 12 }}><button onClick={() => toast("18 outreach messages approved & queued", "success")} style={{ background: "#AF52DE", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}>Approve all 18</button><button onClick={() => toast("Opening outreach editor")} style={{ background: "#fff", border: "1px solid var(--border)", color: "var(--ink2)", fontFamily: "inherit", fontWeight: 600, fontSize: 12.5, padding: "9px 14px", borderRadius: 8, cursor: "pointer" }}>Edit each</button></div>
        </div>
      )}
    </div>
  );
}
