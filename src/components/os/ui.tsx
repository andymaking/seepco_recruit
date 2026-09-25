"use client";
import type { CSSProperties, ReactNode } from "react";
import { Ic } from "./icons";

/**
 * Propflow primitives — the Talent OS component kit.
 * Anatomy follows the Propflow HR UI Kit (see docs/PROPFLOW_DS.md + docs/refs/).
 * All type rides var(--pf-font) (Geist); colors ride the --pf-* tokens.
 */

export type PfTone = "green" | "blue" | "purple" | "yellow" | "red" | "grey";

export const TONE: Record<PfTone, { fg: string; bg: string; soft: string; line: string }> = {
  green: { fg: "var(--pf-primary-500)", bg: "var(--pf-primary-500)", soft: "var(--pf-primary-50)", line: "var(--pf-primary-100)" },
  blue: { fg: "var(--pf-blue-500)", bg: "var(--pf-blue-500)", soft: "var(--pf-blue-50)", line: "var(--pf-blue-100)" },
  purple: { fg: "var(--pf-purple-500)", bg: "var(--pf-purple-500)", soft: "var(--pf-purple-50)", line: "var(--pf-purple-100)" },
  yellow: { fg: "var(--pf-yellow-500)", bg: "var(--pf-yellow-500)", soft: "var(--pf-yellow-50)", line: "var(--pf-yellow-100)" },
  red: { fg: "var(--pf-red-500)", bg: "var(--pf-red-500)", soft: "var(--pf-red-50)", line: "var(--pf-red-100)" },
  grey: { fg: "var(--pf-n500)", bg: "var(--pf-n400)", soft: "var(--pf-n50)", line: "var(--pf-n100)" },
};

/* ------------------------------- Card ------------------------------- */

export function PfCard({ children, style, pad = 0 }: { children: ReactNode; style?: CSSProperties; pad?: number | string }) {
  return (
    <div style={{ background: "var(--pf-n0)", border: "1px solid var(--pf-n50)", borderRadius: 12, boxShadow: "0 1px 3px 0 #f3f3f3", padding: pad, ...style }}>
      {children}
    </div>
  );
}

/** Card header row: title + sub on the left, actions on the right. */
export function PfCardHead({ title, sub, children, divider = true }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; divider?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: divider ? "1px solid var(--pf-n50)" : "none" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--pf-n900)", lineHeight: 1.25 }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: "var(--pf-n400)", marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------- Badge ------------------------------ */

export function PfBadge({ tone = "grey", children, dot }: { tone?: PfTone; children: ReactNode; dot?: boolean }) {
  const t = TONE[tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 500, color: t.fg, background: t.soft, border: `0.6px solid ${t.line}`, padding: "2px 6px", borderRadius: 4, whiteSpace: "nowrap", lineHeight: 1.35 }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.bg }} />}
      {children}
    </span>
  );
}

/* ------------------------------ Button ------------------------------ */

export function PfBtn({ children, variant = "secondary", tone, icon, onClick, full, small, style }: {
  children?: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  tone?: string; icon?: string; onClick?: () => void; full?: boolean; small?: boolean; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    fontFamily: "inherit", fontSize: 12, fontWeight: 500,
    padding: small ? "4px 8px" : "7px 12px", borderRadius: small ? 6 : 8, cursor: "pointer",
    width: full ? "100%" : undefined, lineHeight: 1.35, whiteSpace: "nowrap",
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: tone ?? "var(--pf-primary-500)", color: "#fff", border: "1px solid transparent", boxShadow: "0 6px 12px -6px rgba(22,179,100,.5), inset 0 1px 0 rgba(255,255,255,.22)" },
    secondary: { background: "var(--pf-n0)", color: "var(--pf-n600)", border: "1px solid var(--pf-n50)", boxShadow: "0 0 0 0.5px rgba(42,42,42,.08)" },
    ghost: { background: "transparent", color: "var(--pf-n500)", border: "1px solid transparent" },
    danger: { background: "var(--pf-red-500)", color: "#fff", border: "1px solid transparent", boxShadow: "0 6px 12px -6px rgba(232,30,23,.4), inset 0 1px 0 rgba(255,255,255,.22)" },
  };
  return (
    <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {icon && <Ic name={icon} size={small ? 14 : 16} />}
      {children}
    </button>
  );
}

/* ----------------------------- Icon tile ---------------------------- */

/** Soft-colored rounded square holding an icon — the kit's KPI/section marker. */
export function PfTile({ icon, tone = "green", size = 30 }: { icon: string; tone?: PfTone; size?: number }) {
  const t = TONE[tone];
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.28, background: t.soft, display: "inline-flex", alignItems: "center", justifyContent: "center", color: tone === "yellow" ? "var(--pf-yellow-500)" : t.fg, flex: "none" }}>
      <Ic name={icon} size={size * 0.55} />
    </span>
  );
}

/* ------------------------------ KPI stat ---------------------------- */

export function PfStat({ icon, tone, label, value, unit, delta, deltaTone = "green" }: {
  icon: string; tone: PfTone; label: string; value: ReactNode; unit?: string; delta?: string; deltaTone?: PfTone;
}) {
  return (
    <PfCard>
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 16px", borderBottom: "1px solid var(--pf-n50)" }}>
        <PfTile icon={icon} tone={tone} size={26} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--pf-n900)" }}>{label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px" }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: "var(--pf-n900)", letterSpacing: "-.4px", lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: "var(--pf-n400)" }}>{unit}</span>}
        <span style={{ flex: 1 }} />
        {delta && <PfBadge tone={deltaTone}>{delta}</PfBadge>}
      </div>
    </PfCard>
  );
}

/* ------------------------------ Progress ---------------------------- */

export function PfProgress({ pct, tone = "green", height = 7 }: { pct: number; tone?: PfTone; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, background: "var(--pf-n50)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: height, background: TONE[tone].bg, transition: "width .3s ease" }} />
    </div>
  );
}

/** Segmented 5-block score bar (the kit's employee-score meter). */
export function PfSegments({ score, outOf = 5, tone = "green" }: { score: number; outOf?: number; tone?: PfTone }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: outOf }, (_, i) => {
        const fill = Math.max(0, Math.min(1, score - i));
        return (
          <span key={i} style={{ width: 22, height: 7, borderRadius: 4, background: fill > 0 ? (fill >= 1 ? TONE[tone].bg : `linear-gradient(90deg, ${TONE[tone].bg} ${fill * 100}%, var(--pf-n100) ${fill * 100}%)`) : "var(--pf-n100)" }} />
        );
      })}
    </div>
  );
}

/* ------------------------------- Avatar ----------------------------- */

export function PfAvatar({ init, tone = "#16B364", size = 32 }: { init: string; tone?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: `${tone}1A`, color: tone, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 600, flex: "none", border: `1px solid ${tone}33` }}>
      {init}
    </span>
  );
}

/* -------------------------------- Tabs ------------------------------ */

export function PfTabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, background: "var(--pf-n50)", border: "1px solid var(--pf-n100)", borderRadius: 10, padding: 4, width: "fit-content" }}>
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 500, padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", background: active === t ? "var(--pf-n0)" : "transparent", color: active === t ? "var(--pf-n900)" : "var(--pf-n400)", boxShadow: active === t ? "0 1px 3px rgba(2,6,23,.08)" : "none", whiteSpace: "nowrap" }}>
          {t}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- Page tabs ----------------------------- */

export type PageTab = { key: string; label: string; count?: string; badge?: string; mono?: string };

/**
 * Underline page tabs (DoronStack style): active = dark label + 2px underline,
 * count chips as soft rounded badges. Every page surface is organized by these.
 */
export function PfPageTabs({ tabs, active, onSelect }: { tabs: PageTab[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 26, borderBottom: "1px solid var(--pf-n50)", padding: "0 28px", overflowX: "auto", whiteSpace: "nowrap", background: "var(--pf-n0)" }}>
      {tabs.map((t) => {
        const is = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit", fontSize: 13.5,
              fontWeight: is ? 600 : 500, color: is ? "var(--pf-n900)" : "var(--pf-n400)",
              background: "none", border: "none", cursor: "pointer", padding: "13px 2px 11px",
              borderBottom: is ? "2px solid var(--pf-n900)" : "2px solid transparent", marginBottom: -1,
            }}
          >
            {t.mono && <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: is ? "var(--pf-primary-500)" : "var(--pf-n300)" }}>{t.mono}</span>}
            {t.label}
            {t.count && (
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--mono)", color: is ? "var(--pf-primary-600)" : "var(--pf-n500)", background: is ? "var(--pf-primary-50)" : "var(--pf-n50)", padding: "1px 8px", borderRadius: 999 }}>{t.count}</span>
            )}
            {t.badge && (
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--pf-primary-600)", background: "var(--pf-primary-50)", padding: "1px 6px", borderRadius: 999, letterSpacing: ".3px" }}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Table bits --------------------------- */

export function PfTh({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 12, fontWeight: 500, color: "var(--pf-n400)", ...style }}>{children}</div>;
}

/** Attention/notice banner (the kit's soft-green info strip). */
export function PfBanner({ tone = "green", icon = "info", children, cta, onCta }: { tone?: PfTone; icon?: string; children: ReactNode; cta?: string; onCta?: () => void }) {
  const t = TONE[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: t.soft, border: `1px solid ${tone === "green" ? "var(--pf-primary-100)" : "var(--pf-n100)"}`, borderRadius: 10, padding: "11px 16px" }}>
      <Ic name={icon} size={17} color={t.fg} />
      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: t.fg }}>{children}</div>
      {cta && (
        <button onClick={onCta} style={{ background: "none", border: "none", cursor: "pointer", color: t.fg, display: "flex", alignItems: "center", fontFamily: "inherit" }}>
          <Ic name="arrowright" size={17} color={t.fg} />
        </button>
      )}
    </div>
  );
}
