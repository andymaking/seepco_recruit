# Talent OS screens — build conventions (Propflow design system)

You are implementing ONE module screen of the **Talent OS** (route group `(os)`) in the
Next.js app. The design system is **Propflow** (Figma HR UI kit) — NOT the SEEPCO
system used by the legacy recruit screens.

## Design system (mandatory)
- READ `docs/PROPFLOW_DS.md` (exact values distilled from the Figma kit) if it exists,
  and study the reference screenshots in `docs/refs/*.png` named in your task.
- USE the primitives — import from `@/components/os/ui` and `@/components/os/icons`:
  `PfCard, PfCardHead, PfBadge, PfBtn, PfTile, PfStat, PfProgress, PfSegments,
  PfAvatar, PfTabs, PfTh, PfBanner, TONE` and `Ic` (icon names listed in icons.tsx).
- Tokens: `var(--pf-n0/25/50/100/300/400/500/600/900)` neutrals, `--pf-primary-500`
  (#16B364 green), `--pf-blue/purple/yellow/red-500|100|50`. Font is inherited (Geist)
  from the shell — never set SEEPCO fonts/vars (`--brand`, `--ink`, `--mono`…) here.
- Look & feel rules: page/content bg is **white** (`var(--pf-n0)`, set by the shell — don't set your own); white cards with `--pf-n50` borders, radius 12, soft `0 1px 3px #f3f3f3` shadow via
  `PfCardHead` title rows; 12px gaps between cards; KPI rows via `PfStat`; soft badges;
  small grey table headers (`PfTh`); segmented score bars (`PfSegments`); icon tiles
  (`PfTile`) for section markers; buttons via `PfBtn` (primary = green).
- Page container: `<div style={{ padding: "24px 28px 60px", maxWidth: 1160 }}>` unless
  the task says otherwise. Screens must feel like `docs/refs/kit-dashboard.png`.

## Component contract
- File: `src/screens/os/<Name>.tsx` (overwrite the placeholder). First line `"use client";`
  default-export component named `<Name>`. Render ONLY page content — the OS shell
  (navbar/topbar) is provided by the `(os)` layout.
- Imports: `useGo, useApp` from `@/state/app`; `useToast` from `@/state/toast`;
  `useHover` from `@/lib/useHover`; shared data from `@/data/talentos` (typed exports:
  COMMAND_KPIS, ANOMALIES, DEPARTMENTS, EMPLOYEES, ATTRITION_TREND, EXIT_REASONS,
  CONTRACTS, MANAGER_ATTENTION, OKRS, ONE_ON_ONES, REVIEW_CYCLE, PLAYBOOKS, MOBILITY,
  POOLS, SEQUENCES, FLEET, SKILL_CLUSTERS, SCENARIOS, NCDMB) and `@/data/people`
  (CANDIDATES, SHORTLIST, CANDDIR). Extend locally with typed constants as needed —
  keep names/numbers consistent with the shared data (one story everywhere).
- `go(stage)` ids for OS pages: command, missioncontrol, ask, scenarios, headcount,
  attrition, depthealth, people, employee, contracts, compliance, offboarding, manager,
  goals, reviews, oneonones, feedbackhub, growth, learning, retention, mobility,
  skillsgraph, sourcingchat, talentlibrary, sequences, agentfleet, me — plus legacy
  recruit ids (dashboard, screening, shortlist, planning, …).
- **Me pillar (employee self-service)** ids: me, mygoals, myoneonones, myreview,
  myfeedback, mygrowth, mylearning, mymobility, myprofile, myprivacy, mymobile.
  These render ONE person's record (E-0214). Their data comes from `@/data/me`
  ONLY — never `@/data/talentos` person rows directly — and their writes go
  through `useMe()` (`@/state/me`). `@/data/me` may not import Retention.tsx,
  Attrition.tsx, DeptHealth.tsx, ManagerHome.tsx, Mobility.tsx or SkillsGraph.tsx,
  and never re-exports `risk`, `perf`, `engagement`, `qoh` or `monthsSincePromo`:
  a Me page must never render another person's private data, a team/org rollup,
  or a value about the subject the company has not released to her.

## Behavior (no dead clicks)
- Navigational elements → `go(...)`. Tabs/filters/toggles/steppers → local `useState`.
- Terminal actions → `toast("…", tone)` (`success` positive, `danger` destructive,
  `ai` AI actions, default otherwise). Reference the visible entity in the message.
- Prefer REAL interactivity where the module implies it (drill-downs switching local
  state, acknowledge flows mutating local list state, chat threads appending messages,
  simulators recomputing numbers) — this is a flagship demo, make it feel alive.
- AI must follow the PRD principles: AI proposes → human disposes; every AI claim
  shows evidence/confidence; explanations everywhere; NDPR-conscious copy.

## Charts & viz
No chart libraries. Build visuals with divs/SVG inline (line/area via SVG polyline,
bars via flex divs, donut via conic-gradient, treemap via nested flex) styled with pf
tokens — match the kit's soft grid, green/blue series, tooltip-card look.

## Quality bar
- TypeScript must pass (`npx tsc --noEmit`). No leftover placeholder text. No SEEPCO
  tokens. Nigerian-first content (₦, Lagos/PH/Abuja, Nigerian names) per shared data.
- Do NOT edit files outside your screen file unless your task explicitly says so.
