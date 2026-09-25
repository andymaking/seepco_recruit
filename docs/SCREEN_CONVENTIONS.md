# SEEPCO Recruit (Next.js) — screen build conventions

You are implementing ONE screen of the SEEPCO Recruit **Next.js (App Router)** app,
recreating it **pixel-perfectly** from the source design prototype.

## Source of truth
- Design file: `/Users/samuelomosehin/developer/seepco-handoff/seepco-webapp-design/project/SEEPCO Recruit.dc.html`
- Your screen's **markup** lives in a `<sc-if value="{{ isXxx }}">...</sc-if>` block (line range in your task).
- The markup uses `{{ bindings }}` resolving to **data getters** in the `<script>` logic section (lines ~3580–4853 of the same file). For every `{{ name }}`, grep the logic section, find its definition, and **inline that data** as typed constants. Resolve every binding — no `{{ }}` may remain.

## This is a Next.js client component
- File: `src/screens/<Name>.tsx`, **default export** a component named `<Name>`.
- The FIRST line MUST be: `"use client";` (these screens use hooks/state/handlers).
- Render ONLY the screen's content. Do **NOT** render the sidebar/topbar/copilot rail — the `(app)` layout already provides them. (EXCEPTION: the three standalone screens — Signin, CandidatePortal, AdminPortal — are full-page and render their own layout; your task will say if you're one of those.)

## Imports (use the `@/` alias → `src/`)
```ts
import { useGo, useApp } from "@/state/app";   // const go = useGo(); go("screening")  navigates
import { useToast } from "@/state/toast";       // const toast = useToast(); toast("Sent", "success")
import { useHover } from "@/lib/useHover";        // const { hovered, hoverProps } = useHover()
import { C } from "@/lib/tokens";                 // optional color constants
import { CANDIDATES, SHORTLIST, CANDDIR } from "@/data/people"; // shared candidate data if needed
```
`go(...)` stage ids: dashboard, planning, role, sourcing, screening, assessment, interview, selection, reference, offer, onboarding, posthire, jobs, candidates, calendar, messages, analytics, audit, dei, qoh, integrations, settings, shortlist, schedule, profile, newrole, notifications, search, offerletter, assesstake, processing, signin, cportal, aportal.

## Translation rules (inline styles → JSX)
- `style="a:b;c:d"` → `style={{ a: "b", c: "d" }}` with **camelCase** keys.
- Keep `var(--brand)` etc. verbatim. For the **mono font use `fontFamily: "var(--mono)"`** (do NOT use the literal `'IBM Plex Mono'` — fonts are loaded via next/font and only resolve through the variable).
- Keep exact px values (e.g. `fontSize: 12.5`).
- `<sc-for list="{{ xs }}" as="x">` → `{xs.map((x, i) => ...)}` (stable `key`).
- `<sc-if value="{{ cond }}">` → `{cond && (...)}`.
- `style-hover="background:#F3F4F7"` → use `useHover()`. **Never put a `border` shorthand and a `borderColor`/`borderLeft` longhand on the same element if either changes on hover** — recompute the full `border` shorthand instead (avoids a React shorthand-collision warning).
- Inline SVGs: copy into JSX, camelCase attrs (`stroke-width`→`strokeWidth`, etc.). Unicode glyphs (✦ ↻ ⚖ → ● ★ etc.) stay as literal characters.
- Sub-view state (tabs/toggles/steps) → local `useState`.

## Buttons must be functional (no dead clicks)
Every `<button>` / `cursor:pointer` element must do something:
- **Navigational** ("View all", "Open …", "Back", breadcrumbs) → `go("<stage>")`.
- **Tabs / toggles / filters** → local `useState`.
- **Terminal actions** (Send, Save, Submit, Accept, Reject, Export, Generate, Schedule, Invite, "+ New…") → `toast("<concise confirmation>", "<tone>")`. Tone: `success` (positive), `danger` (reject/delete), `ai` (AI actions), `default` otherwise. Reference the visible entity, e.g. `toast("Interview invite sent to Adaeze Obi", "success")`.

## Reference & scope
- `src/screens/Dashboard.tsx` is a fully-built reference — match its style and helper usage.
- Create ONLY your `src/screens/<Name>.tsx`. Do not edit routes, data, components, or other screens.
- TypeScript must stay clean. Match every color, font-size, padding, radius, and label exactly.
