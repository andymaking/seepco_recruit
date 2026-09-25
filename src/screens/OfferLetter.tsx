"use client";
import { useGo } from "@/state/app";
import { useToast } from "@/state/toast";
import { useHover } from "@/lib/useHover";

const offerTermsList = [
  { k: "Role", v: "Senior Product Designer" },
  { k: "Base salary", v: "₦11.8M / year" },
  { k: "Sign-on bonus", v: "₦1.2M" },
  { k: "Equity (ESOP)", v: "0.15%" },
  { k: "Start date", v: "15 Jul 2026" },
  { k: "Location", v: "Lagos (Hybrid)" },
];

const offerSigners = [
  { name: "Adaeze Obi", role: "Candidate", init: "AO", tone: "#AF52DE", status: "Pending", sColor: "#8F6304", sBg: "#FEF7E6" },
  { name: "Samuel Omosehin", role: "Talent Lead", init: "SO", tone: "#020617", status: "Signed", sColor: "#129152", sBg: "#ECF9F3" },
  { name: "Legal (NG)", role: "Counsel", init: "LG", tone: "#475569", status: "Signed", sColor: "#129152", sBg: "#ECF9F3" },
];

function Breadcrumb({ onClick }: { onClick: () => void }) {
  const { hovered, hoverProps } = useHover();
  return (
    <div
      {...hoverProps}
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: hovered ? "#16B364" : "var(--ink3)", cursor: "pointer", marginBottom: 14 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>{" "}
      Adaeze Obi
    </div>
  );
}

export default function OfferLetter() {
  const go = useGo();
  const toast = useToast();
  return (
    <div style={{ padding: "24px 28px 60px", maxWidth: 1180 }}>
      <Breadcrumb onClick={() => go("offer")} />
      <h1 style={{ margin: "0 0 18px", fontSize: 23, fontWeight: 700, letterSpacing: "-.5px" }}>Offer letter</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "34px 38px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 24 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#16B364", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>S</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Hirebrew</div>
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "var(--ink)" }}>
            <div style={{ color: "var(--ink3)", fontSize: 12, marginBottom: 16 }}>22 June 2026</div>
            <p style={{ margin: "0 0 13px" }}>Dear <b>Adaeze Obi</b>,</p>
            <p style={{ margin: "0 0 13px" }}>We are delighted to offer you the position of <b>Senior Product Designer</b> at Hirebrew, reporting to the Head of Design and based in Lagos (hybrid).</p>
            <p style={{ margin: "0 0 13px" }}>Your annual base salary will be <b>₦11,800,000</b>, with a sign-on bonus of <b>₦1,200,000</b> and an equity grant of <b>0.15%</b> under our ESOP. Your anticipated start date is <b>15 July 2026</b>.</p>
            <p style={{ margin: "0 0 13px" }}>This offer is contingent on satisfactory references and right-to-work verification, both of which are complete.</p>
            <p style={{ margin: "0 0 22px" }}>We&apos;re excited about the impact you&apos;ll have on our payments experiences. Welcome to the team.</p>
            <p style={{ margin: "0 0 3px" }}>Warm regards,</p>
            <p style={{ margin: 0, fontWeight: 600 }}>Samuel Omosehin</p>
            <p style={{ margin: 0, color: "var(--ink3)", fontSize: 12 }}>Talent Lead, Hirebrew</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 13 }}>Package terms</div>
            {offerTermsList.map((t) => (
              <div key={t.k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border2)", fontSize: 12.5 }}>
                <span style={{ color: "var(--ink3)" }}>{t.k}</span>
                <span style={{ fontWeight: 600 }}>{t.v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 13 }}>E-signature status</div>
            {offerSigners.map((s) => (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border2)" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.tone, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 10, flex: "none" }}>{s.init}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink3)" }}>{s.role}</div>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: s.sColor, background: s.sBg, padding: "3px 9px", borderRadius: 5 }}>{s.status}</span>
              </div>
            ))}
            <button
              onClick={() => toast("Offer letter sent for e-signature", "success")}
              style={{ width: "100%", marginTop: 14, background: "#16B364", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600, fontSize: 13, padding: 11, borderRadius: 8, cursor: "pointer" }}
            >
              Send to candidate for signature
            </button>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink3)", textAlign: "center" }}>Audit-logged · NG-law template · DocuSign</div>
          </div>
        </div>
      </div>
    </div>
  );
}
