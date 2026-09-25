/**
 * Hirebrew — design tokens as TS constants.
 * Mirrors the CSS custom properties in globals.css. Use `C.brand` etc. in
 * inline styles, or the `var(--brand)` form directly — both resolve the same.
 */
export const C = {
  bg: "#F8FAFC",
  surface: "#ffffff",
  border: "#E2E8F0",
  border2: "#F1F5F9",
  ink: "#020617",
  ink2: "#475569",
  ink3: "#64748B",
  brand: "#16B364",
  brandbg: "#ECF9F3",
  ai: "#AF52DE",
  aibg: "#F7EEFC",
  aibd: "#EFDDF8",
  green: "#16B364",
  greenbg: "#ECF9F3",
  amber: "#EBA308",
  amberbg: "#FEF7E6",
  red: "#E81E17",
  redbg: "#FDE8E8",
  mono: "var(--mono)",
} as const;

/** Mono font stack — wired to the Geist Mono next/font variable. */
export const MONO = "var(--mono)";
