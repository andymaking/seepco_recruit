"use client";
import type { ReactNode } from "react";

/**
 * Talent OS icon set — Phosphor-style 24×24 line glyphs (the Propflow kit uses
 * Phosphor icons: HouseSimple, CaretRight, DotsThreeVertical, …).
 * Usage: <Ic name="users" size={18} color="var(--pf-n400)" />
 */
const P: Record<string, ReactNode> = {
  gauge: <><path d="M4 14a8 8 0 1 1 16 0" /><path d="M12 14l4-4" /><path d="M3 19h18" /></>,
  orbit: <><circle cx="12" cy="12" r="3.2" /><path d="M2.8 12c0-2.5 4.1-4.6 9.2-4.6s9.2 2.1 9.2 4.6-4.1 4.6-9.2 4.6S2.8 14.5 2.8 12z" transform="rotate(-24 12 12)" /><circle cx="19.4" cy="6.6" r="1.4" fill="currentColor" stroke="none" /></>,
  flask: <><path d="M9.5 3h5" /><path d="M10 3v5.2L4.8 17.5A2 2 0 0 0 6.6 20.5h10.8a2 2 0 0 0 1.8-3L14 8.2V3" /><path d="M7.5 14.5h9" /></>,
  sparkle: <><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" /><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  users: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M15.5 6a3 3 0 0 1 0 5.6" /><path d="M17.5 14.4a5.5 5.5 0 0 1 3 5.1" /></>,
  treemap: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" /><path d="M11 4.5v15" /><path d="M11 12h9.5" /><path d="M16 12v7.5" /></>,
  pulse: <><path d="M3 12h4l2.2-6 3.6 12 2.2-6H21" /></>,
  heart: <><path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.4 3.7 4.5 6.8 4.5c2 0 3.7 1.1 4.6 2.8h1.2c.9-1.7 2.6-2.8 4.6-2.8 3.1 0 5.2 2.9 4 6.2C19.5 15.4 12 20 12 20z" /></>,
  file: <><path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5z" /><path d="M14 3v4.5h4.5" /><path d="M9 12.5h6M9 16h6" /></>,
  shield: <><path d="M12 3l7.5 2.8v5.4c0 4.6-3.2 7.9-7.5 9.8-4.3-1.9-7.5-5.2-7.5-9.8V5.8z" /><path d="M9 11.7l2.2 2.2 4-4.2" /></>,
  door: <><path d="M4 21h16" /><path d="M6.5 21V4.8A1.3 1.3 0 0 1 7.8 3.5h8.4a1.3 1.3 0 0 1 1.3 1.3V21" /><circle cx="14.6" cy="12.3" r="1" fill="currentColor" stroke="none" /></>,
  house: <><path d="M4.5 11.2L12 4.2l7.5 7v8.1a1.2 1.2 0 0 1-1.2 1.2H5.7a1.2 1.2 0 0 1-1.2-1.2z" /><path d="M9.8 20.5v-6h4.4v6" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  clipboard: <><rect x="5.5" y="4.5" width="13" height="16" rx="1.5" /><path d="M9 4.5a3 3 0 0 1 6 0" /><path d="M9 11h6M9 14.5h6M9 18h3.5" /></>,
  chat: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H12l-4.6 3.4a.6.6 0 0 1-1-.5V17H6.5A2.5 2.5 0 0 1 4 14.5z" /><path d="M8.5 9h7M8.5 12.2h4.5" /></>,
  megaphone: <><path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H8l7.5 4.5a.8.8 0 0 0 1.2-.7V5.2a.8.8 0 0 0-1.2-.7L8 9H5.5A1.5 1.5 0 0 0 4 10.5z" /><path d="M19.5 10a3 3 0 0 1 0 4" /><path d="M8 15v4.2a1.3 1.3 0 0 0 2.6 0V16" /></>,
  trend: <><path d="M3.5 17.5L9.7 11l3.6 3.5 7.2-7.5" /><path d="M15.5 7h5v5" /></>,
  book: <><path d="M5 5.2A1.7 1.7 0 0 1 6.7 3.5H19v15.3H6.8A1.8 1.8 0 0 0 5 20.6z" /><path d="M5 18.8V5.2" /><path d="M19 18.8v1.7H6.8" /><path d="M9 8h6" /></>,
  lifebuoy: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.8" /><path d="M6 6l3.3 3.3M18 6l-3.3 3.3M18 18l-3.3-3.3M6 18l3.3-3.3" /></>,
  swap: <><path d="M7.5 4L4 7.5l3.5 3.5" /><path d="M4 7.5h11a4 4 0 0 1 4 4" /><path d="M16.5 20l3.5-3.5-3.5-3.5" /><path d="M20 16.5H9a4 4 0 0 1-4-4" /></>,
  graph: <><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="7.5" r="2.2" /><circle cx="8" cy="18" r="2.2" /><circle cx="17.5" cy="16.5" r="2.2" /><path d="M8 7l7.8.6M7 8.1l.6 7.7M9.9 16.9l5.5-.3M16.6 9.6l.6 4.7" /></>,
  stack: <><path d="M12 3.5l9 4.5-9 4.5-9-4.5z" /><path d="M3.5 12.5L12 16.8l8.5-4.3" /><path d="M3.5 16.5L12 20.8l8.5-4.3" /></>,
  paperplane: <><path d="M20.5 3.8L3.6 10.2a.7.7 0 0 0 .05 1.3l6.1 2 2 6.1a.7.7 0 0 0 1.3.05z" /><path d="M9.7 13.5l4.5-4.5" /></>,
  robot: <><rect x="4.5" y="8" width="15" height="11" rx="2" /><path d="M12 5v3" /><circle cx="12" cy="4" r="1.1" fill="currentColor" stroke="none" /><circle cx="9" cy="12.5" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="12.5" r="1.1" fill="currentColor" stroke="none" /><path d="M9 16h6" /></>,
  arrowsq: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M10 9h5v5" /><path d="M15 9l-6 6" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" /></>,
  bell: <><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.3 1.5 5.3H4.5S6 14 6 10z" /><path d="M10 18.8a2.2 2.2 0 0 0 4 0" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  caretright: <path d="M9 5.5l6.5 6.5L9 18.5" />,
  caretdown: <path d="M5.5 9l6.5 6.5L18.5 9" />,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="1.8" /><path d="M8 3.5v3.5M16 3.5v3.5M4 10h16" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3.8l1 2.3 2.5-.5 1 2.3 2.4.9-.5 2.5 1.6 1.9-1.6 1.9.5 2.5-2.4.9-1 2.3-2.5-.5-1 2.3-1-2.3-2.5.5-1-2.3-2.4-.9.5-2.5L3.6 12l1.6-1.9-.5-2.5 2.4-.9 1-2.3 2.5.5z" /></>,
  question: <><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.4A2.6 2.6 0 0 1 12 7.5c1.4 0 2.6 1 2.6 2.3 0 1.9-2.6 2-2.6 3.7" /><circle cx="12" cy="16.6" r="1" fill="currentColor" stroke="none" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
  dots: <><circle cx="12" cy="5.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="18.5" r="1.3" fill="currentColor" stroke="none" /></>,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  arrowup: <><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></>,
  arrowright: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  warning: <><path d="M12 4L2.8 19.5a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.6" r="1" fill="currentColor" stroke="none" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" /></>,
  wallet: <><path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h12A2.5 2.5 0 0 1 20.5 7v10A2.5 2.5 0 0 1 18 19.5H6A2.5 2.5 0 0 1 3.5 17z" /><path d="M15 12h5.5" /><circle cx="15.8" cy="12" r=".9" fill="currentColor" stroke="none" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  play: <path d="M8 5.5v13l10-6.5z" />,
  pause: <path d="M8.5 5.5v13M15.5 5.5v13" />,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" /><path d="M12 18v3" /></>,
  download: <><path d="M12 4v11" /><path d="M7 10.5l5 5 5-5" /><path d="M4.5 19.5h15" /></>,
  star: <path d="M12 4l2.3 4.9 5.2.7-3.8 3.7.9 5.2L12 16l-4.6 2.5.9-5.2L4.5 9.6l5.2-.7z" />,
};

export function Ic({ name, size = 18, color = "currentColor", weight = 1.7 }: { name: keyof typeof P | string; size?: number; color?: string; weight?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      {P[name as string] ?? P.sparkle}
    </svg>
  );
}
