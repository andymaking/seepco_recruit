# Propflow Design System — OS Screen Spec

Source of truth: **Propflow HR UI Kit** (Figma `bORias87d80kmuWwIZek4c`, Dashboard node `10528:12338`, 1440×1043).
All values below are quoted verbatim from the Figma MCP reference code. Replicate them exactly — do not approximate,
do not substitute SEEPCO brand tokens. Type family is **Geist** throughout (one exception: the "PropFlow" wordmark is Inter).

---

## 1. Design tokens

### 1.1 Colors (Figma variable → hex)

| Variable | Hex | Used for |
|---|---|---|
| `Primary/500` | `#16B364` | Brand green: primary buttons, progress fills, green badge text, chart "Performance" line, banner border |
| `Primary/600` | `#129152` | Banner text (both weights) |
| `Primary/100` | `#DAF3E6` | Green badge/chip border |
| `Primary/50` | `#ECF9F3` | Green badge/chip bg |
| `Neutral/900` | `#020617` | Primary text, active nav label, table cell text, notch pill |
| `Neutral/600` | `#334155` | Breadcrumb current page + separator |
| `Neutral/500` | `#475569` | Inactive nav label, gray badge text |
| `Neutral/400` | `#64748B` | Subtitles, table header labels, axis labels, meta text |
| `Neutral/300` | `#94A3B8` | Section labels ("Main"/"Activity"), breadcrumb parent, muted "/5" text, placeholder text |
| `Neutral/100` | `#E2E8F0` | Gray badge border, pending progress ticks |
| `Neutral/50` | `#F1F5F9` | **The** hairline border everywhere; gray badge bg; meter track bg |
| `Neutral/25` | `#F8FAFC` | Table header row bg, tinted CTA card bg, end-message pill bg |
| `Neutral/0` | `#FFFFFF` | Card bg, page bg, active nav item bg |
| `Grey/grey-900` | `#101010` | Wordmark, user name, some titles/score values |
| `Grey/grey-500` | `#262626` | KPI label + KPI value text |
| `Grey/grey-200` | `#9B9B9B` | KPI unit/suffix text |
| `Blue/500` | `#007AFF` | Chart "Target" line, blue chip icon |
| `Blue/100` / `Blue/50` | `#CCE5FF` / `#E5F2FF` | Blue chip border / bg |
| `Purple/500` | `#AF52DE` | Purple chip icon |
| `Purple/100` / `Purple/50` | `#EFDDF8` / `#F7EEFC` | Purple chip border / bg |
| `Yellow/500` | `#EBA308` | Yellow badge text, partial-progress ticks |
| `Yellow/100` / `Yellow/50` | `#FDEECE` / `#FEF7E6` | Yellow badge border / bg |
| `Red/500` | `#E81E17` | Red badge text |
| `Red/100` / `Red/50` | `#FAD2D1` / `#FDE8E8` | Red badge border / bg |

Raw (non-variable) colors that appear in the code:

| Value | Where |
|---|---|
| `#FBFCFD` | Left navbar background |
| `#F3F3F3` | Card shadow color (`0px 1px 3px 0px #F3F3F3` and `0px 6px 16px -8px #F3F3F3`) |
| `#23C45D`, `rgba(35,196,93,0.08)`, `rgba(35,129,69,0.12)` | KPI delta badge (text / bg / border) — a distinct green from Primary/500 |
| `rgba(42,42,42,0.08)` / `rgba(42,42,42,0.14)` | Micro-shadows on outline buttons and logo tile |
| `rgba(22,179,100,0.14)` / `rgba(22,179,100,0.08)` | Green glow shadow on primary button + progress fills |
| `rgba(255,255,255,0.12)` | Logo tile border + gradient stop |
| `black` | Greeting headline (`text-black`) |

### 1.2 Typography (family: **Geist**; token names from the kit)

| Token | Size / weight / line-height | Usage |
|---|---|---|
| `Body/Regular/XXS (11)` | 11px · 400 · 1.45 | Axis labels, user role, "/5" in tooltips |
| `Body/Medium/XXS (11)` | 11px · 500 · 1.45 | Score-change % in table |
| `Body/Regular/XS (12)` | 12px · 400 · 1.35 | Subtitles, table headers, breadcrumbs, meta, legends |
| `Body/Medium/XS (12)` | 12px · 500 · 1.35 | ALL button labels, ALL badge labels, tooltip date |
| `Body/Semibold/XS (12)` | 12px · 600 · 1.35 | Tooltip values |
| `Body/Regular/SM (13)` | 13px · 400 · 1.25 | Table cell text |
| `Body/Medium/SM (13)` | 13px · 500 · 1.25 | Table score value, progress-entry titles |
| `Body/Regular/Base (14)` | 14px · 400 · 1.4 | Inactive nav labels, banner body, empty-state text |
| `Body/Medium/Base (14)` | 14px · 500 · 1.4 | Active nav label, KPI label, user name, meeting name |
| `Body/Semibold/Base (14)` | 14px · 600 · 1.4 | Card titles |
| `Body/Medium/XL (16)` | 16px · 500 · 1.25 | Greeting headline |
| `Body/Semibold/XL (16)` | 16px · 600 · 1.25 | Progress % figures ("100%") |
| *(raw)* | 18px · 500 · 1.3 · `tracking-[-0.18px]` | KPI value number |
| *(raw, Inter)* | 16px · 600 · 1.3 | "PropFlow" wordmark only (`font-['Inter:Semi_Bold']`) |

Negative tracking appears only on small numerics: `tracking-[-0.18px]` (18px values), `tracking-[-0.12px]` (12px suffix/delta text, `leading-[16px]`).

### 1.3 Radii · borders · shadows

| Token | Value | Usage |
|---|---|---|
| radius-4 | `rounded-[4px]` | Badges, delta badge, progress fills |
| radius-6 | `rounded-[6px]` | Small (S) buttons, logo tile, KPI icon chip, meter track |
| radius-8 | `rounded-[8px]` | M buttons, nav items, end-message pill, chart card |
| radius-10 | `rounded-[10px]` | Banner, tooltips, CTA icon chip, user block |
| radius-12 | `rounded-[12px]` | Cards (default) |
| radius-99/100 | `rounded-[99px]` / `rounded-[100px]` | Notch pill, avatars |
| hairline | `border #F1F5F9` (1px) | Card borders, all dividers, nav/topbar borders |
| badge border | `border-[0.6px]` | All badges + KPI icon chips (0.6px, tint-100 color) |
| card shadow | `shadow-[0px_1px_3px_0px_#f3f3f3]` | Standard cards |
| KPI shadow | `shadow-[0px_6px_16px_-8px_#f3f3f3]` | KPI cards |
| button micro-shadow | `shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]` | Outline/ghost buttons |
| green glow | `shadow-[0px_1.5px_2px_-0.5px_rgba(22,179,100,0.14),0px_0.5px_0.5px_0px_rgba(22,179,100,0.08)]` | Primary button (progress fills use `1.5px 4px -0.5px` spread) |
| bevel inset | `shadow-[inset_0px_0px_0px_0.5px_rgba(0,0,0,0.2),inset_0px_1.5px_1.5px_0px_rgba(255,255,255,0.1),inset_0px_-1.5px_1.5px_0px_rgba(0,0,0,0.1)]` | Overlay div on every solid-green surface (logo tile, primary button, progress fills) — this is the kit's signature "candy" finish |
| active nav shadow | `shadow-[0px_4px_4px_-2px_rgba(0,0,0,0.04)]` | Active nav item |
| avatar shadow | `shadow-[0px_4px_12px_-2px_rgba(2,6,23,0.08),0px_0.5px_0.5px_0px_rgba(2,6,23,0.04)]` | 36px avatar (white 1px border) |
| tooltip shadow | `drop-shadow-[0px_1px_1.5px_rgba(0,0,0,0.03)]` + `border-[0.8px] #F1F5F9` | Chart tooltip |

### 1.4 Spacing rhythm

`2 / 4 / 6 / 8 / 12 / 16 / 18 / 24` px. Card grid gap is **12px** everywhere (KPI gap-12, column gap-12, stacked card gap-12). Card padding is **12px**; KPI card padding is **16px**. Icon-to-label gaps: 6px (nav), 8px (logo, table avatar), 10px (KPI header).

---

## 2. Layout anatomy

### 2.1 Page grid (1440 frame)

```
┌──────────┬──────────────────────────────────────────────┐
│ Navbar   │ Topbar 1160×60 (border-b #F1F5F9)            │
│ 280×full ├──────────────────────────────────────────────┤
│ (border-r│ Content: bg WHITE, px-24 pt-24 → inner 1112  │
│ #F1F5F9) │  Greeting (40h) ·gap20· Banner (36h) ·gap16· │
│          │  KPI row 4×(flex-1) gap-12 (97h) ·gap12·     │
│          │  [Left col 726] gap-12 [Right col 374]       │
└──────────┴──────────────────────────────────────────────┘
```

- Content background is `#FFFFFF` (cards sit white-on-white, separated by the `#F1F5F9` border + `#F3F3F3` shadow, NOT by bg contrast).
- Ambient decor: a ~326×326 Primary-tinted blurred blob sits behind the top of the content area (Figma "Rectangle 28"); optional, purely decorative.
- Left column stacks: Employee table card (354h) → Team Performance chart card; right column: CTA card (128h) → Goals Progress card (354h) → Today's 1-on-1s card. All vertical gaps 12px.

### 2.2 Left Navbar (280px)

- Root: `bg-[#fbfcfd] border-r border-[#f1f5f9] w-[280px] flex flex-col h-full overflow-clip`; content uses `justify-between` (header groups top, help+user pinned bottom).
- **Logo block**: `pl-[16px] pr-[12px] py-[18px] border-b border-[#f1f5f9]`; row `gap-[8px]`: 24px logo tile (`rounded-[6px]`, solid `#16b364` + white→transparent gradient overlay `linear-gradient(177.61deg, rgba(255,255,255,0) 2%, rgba(255,255,255,0.12) 98.167%)` + bevel inset + `border rgba(255,255,255,0.12)` + `shadow-[0px_1.5px_2px_-0.5px_rgba(42,42,42,0.14),0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]`; logomark leaf 14.25×18 centered) + wordmark **"PropFlow" Inter SemiBold 16 `#101010`**.
- **Menu section**: wrapper `px-[16px] py-[12px] flex flex-col gap-[6px]`; section label `px-[8px]` Geist Regular 12 `#94A3B8` ("Main", "Activity"); items list `gap-[2px]`.
- **Nav item** (≈36px tall): `flex gap-[6px] items-center p-[8px] rounded-[8px] w-full`; icon wrapper `p-px` around a **16px** icon; label 14px.
  - **Active**: `bg-white border border-[#f1f5f9] shadow-[0px_4px_4px_-2px_rgba(0,0,0,0.04)]`, label `font-medium text-[#020617]`, icon fill `#020617`.
  - **Inactive**: no bg/border, label `font-normal text-[#475569]`, icon fill `#475569`.
  - **Notch**: active row also gets an edge pill on the navbar itself: `absolute left-[-4px] w-[8px] h-[16px] rounded-[99px] bg-[#020617]`, vertically centered on the active item.
- **Bottom block**: `px-[16px] py-[20px] flex flex-col gap-[24px]` — Help Center + Settings items (same anatomy), then **user block**: `flex gap-[8px] p-[8px] rounded-[10px]`; avatar 36px `rounded-[100px] border border-white` + avatar shadow; name Geist Medium 14 `#101010`; role Geist Regular 11 `#94A3B8`; right caret `CaretUpDown` 12px in `p-[2px]`.
- Decorative star flourish SVG bleeds off the bottom-left (absolute, behind content).

### 2.3 Topbar (h-60)

`flex gap-[12px] items-center px-[24px] py-[14px] border-b border-[#f1f5f9]` (transparent bg over white page).
- **Left — breadcrumb** (no searchbar on OS screens): 12px Geist Regular, `gap-[3px]`: parent `#94a3b8` → `/` `#334155` → current `#334155`.
- **Right** (`gap-[6px]`, right-aligned):
  - Date button (32h): `bg-white border border-[#f1f5f9] rounded-[8px] p-[6px] shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]`; label in `p-[2px]` Geist Medium 12 `#020617`; 12px calendar icon in `px-[2px] py-[4px]`.
  - Icon button 32×32: same chrome, `p-[6px]`; 16px bell icon in `p-[2px]`; notification dot = 8px circle overlapping top-right (`left-[17px] top-[6px]`, orange/red with white ring).

### 2.4 Content area

Greeting: title Geist Medium 16 `text-black`, subtitle Geist Regular 12 `#64748b` `tracking-[-0.12px] leading-[16px]`, `gap-[4px]`.

Alert banner: `bg-white border border-[#16b364] rounded-[10px] px-[12px] py-[8px] flex gap-[12px] items-start`; 16px `Info` icon; copy 14px `#129152` — bold lead `font-medium` + rest `font-normal`, `gap-[8px]`; 16px `ArrowRight` at right; decorative star SVGs absolutely positioned behind, `overflow-clip`.

---

## 3. Core primitives

### 3.1 Card (default recipe)

```
bg-white border border-[#f1f5f9] rounded-[12px] shadow-[0px_1px_3px_0px_#f3f3f3] overflow-clip
```
- **Header row**: `p-[12px] border-b border-[#f1f5f9] flex items-center justify-between`; Title Geist SemiBold 14 `#020617` (or `#101010`), Subtitle Geist Regular 12 `#64748b`, stacked `gap-[2px]`; actions right as Ghost S buttons `gap-[8px]`.
- Tinted variant (CTA card): swap bg to `#f8fafc`, `p-[12px]`, no header divider.
- Chart card uses `rounded-[8px]` (only observed exception).

### 3.2 KPI / Overview card

```html
<div class="bg-white border border-[#f1f5f9] rounded-[12px] shadow-[0px_6px_16px_-8px_#f3f3f3] overflow-clip flex flex-col">
  <!-- header -->
  <div class="px-[16px] py-[10px] border-b border-[#f1f5f9] flex items-center gap-[10px]">
    <div class="bg-[#ecf9f3] border-[0.6px] border-[#daf3e6] rounded-[6px] p-[5px]"><img class="size-[12px]" /></div>
    <p class="font-medium text-[14px] text-[#262626] leading-[1.4]">Team Size</p>
  </div>
  <!-- body -->
  <div class="p-[16px]">
    <div class="flex gap-[2px] items-baseline">
      <p class="font-medium text-[18px] leading-[1.3] tracking-[-0.18px] text-[#262626]">9</p>
      <p class="font-normal text-[12px] leading-[16px] tracking-[-0.12px] text-[#9b9b9b]">Employees</p>
    </div>
  </div>
</div>
```
- Icon-chip tint pairs (bg / border / icon): green `#ECF9F3/#DAF3E6/#16B364` · blue `#E5F2FF/#CCE5FF/#007AFF` · purple `#F7EEFC/#EFDDF8/#AF52DE` · yellow `#FEF7E6/#FDEECE/#EBA308`.
- **Delta badge** (optional, right of value row): `bg-[rgba(35,196,93,0.08)] border-[0.6px] border-[rgba(35,129,69,0.12)] rounded-[4px] px-[3px] py-[2px]` + 14px arrow icon + `font-medium text-[12px] leading-[16px] tracking-[-0.12px] text-[#23c45d]`.

### 3.3 Badge

Recipe: `border-[0.6px] rounded-[4px] flex items-center` + Geist **Medium 12** `leading-[1.35]`.
Sizes: **Badge L** `px-[4px] py-[2px]` (≈20h, tables) · **Badge S** `px-[4px]` no py (≈16h, inline meta).

| Variant | bg | border | text |
|---|---|---|---|
| Gray | `#F1F5F9` | `#E2E8F0` | `#475569` |
| Green | `#ECF9F3` | `#DAF3E6` | `#16B364` |
| Red | `#FDE8E8` | `#FAD2D1` | `#E81E17` |
| Yellow | `#FEF7E6` | `#FDEECE` | `#EBA308` |
| Blue *(kit)* | `#E5F2FF` | `#CCE5FF` | `#007AFF` |
| Purple *(kit)* | `#F7EEFC` | `#EFDDF8` | `#AF52DE` |

Semantics on Dashboard: Gray = contract type; Green = Good/Completed; Red = At Risk; Yellow = Average/On track.

### 3.4 Buttons (label is always Geist Medium 12)

| Type | Chrome | Height |
|---|---|---|
| **Primary M** | `bg-[#16b364] rounded-[8px] p-[6px]` + green glow `shadow-[0px_1.5px_2px_-0.5px_rgba(22,179,100,0.14),0px_0.5px_0.5px_0px_rgba(22,179,100,0.08)]` + bevel-inset overlay; text white in `p-[2px]` | 32px |
| **Secondary / Outline M** | `bg-white border border-[#f1f5f9] rounded-[8px] p-[6px] shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]`; text `#020617` | 32px |
| **Ghost S** | `bg-white border border-[#f1f5f9] rounded-[6px] p-[4px] shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]`; text `#020617` in `p-[2px]`; trailing 12px icon in `px-[2px] py-[4px]` | 28px |
| **Icon-only 32** | Outline M chrome, `p-[6px]`, 16px icon in `p-[2px]` | 32×32 |

Full-width primary: add `w-full justify-center` (see CTA card "View Reviews").

### 3.5 Table / list rows

- **Header row**: `bg-[#f8fafc] border-y border-[#f1f5f9]`; cells `pl-[12px] pr-[16px] py-[10px]` (first col `pr-[64px]`); labels Geist Regular 12 `#64748b`. Flexible cols `flex-1`; fixed status col `w-[120px]`.
- **Data row**: `h-[64px] border-b border-[#f1f5f9] flex items-center`; cells `px-[12px] py-[16px]` (badge cells `py-[11px]`); text Geist Regular 13 `#020617` `leading-[1.25]`; avatar 20px + `gap-[8px]` before name.
- **Score cell**: value `font-medium 13 #020617` + `/5` `font-normal 13 #94a3b8` (baseline-aligned), optional delta `font-medium 11 #16b364` + 8px arrow; below (`gap-[10px]`) the segment meter.
- **Meeting row** (lists): 40px avatar + `gap-[8px]`; name Medium 14 `#020617`; meta row `gap-[4px]` Regular 12 `#64748b` with 12px vertical hairline divider between time and duration.
- **Empty state**: `bg-[#f8fafc] rounded-[8px] px-[8px] py-[12px]` centered, text Geist Regular 14 `#94a3b8`.

### 3.6 Progress indicators (three kinds)

1. **Score meter** (tables): 5 segments `w-[128px] gap-[2px]`; each segment `flex-1 rounded-[6px] bg-[#f1f5f9]`; filled part `h-[6px] rounded-[4px] bg-[#16b364]` + green glow `shadow-[0px_1.5px_4px_-0.5px_rgba(22,179,100,0.14),0px_0.5px_0.5px_0px_rgba(22,179,100,0.08)]` + bevel inset. Partial fill = fixed width on last active segment (e.g. `w-[8px]`/`w-[10px]`/`w-[16px]`).
2. **Solid progress bar** (goal entries): track `h-[8px] w-full rounded-[4px] bg-white` on `bg-[#f1f5f9] rounded-[6px]` container, glow + bevel inset; fill `bg-[#16b364] h-[8px] rounded-[4px]` at N%.
3. **Ticked strip** (remaining portion): `flex gap-[2px] h-[8px] overflow-clip rounded-[4px]` of `w-[2px] h-[24px]` bars — `#EBA308` for in-progress remainder, `#E2E8F0` for untouched.

Entry layout: title Medium 13 `#020617` + meta Regular 12 `#64748b` left, % SemiBold 16 `#020617` right → `gap-[16px]` → bar → footer row: deadline Regular 12 `#64748b` + Badge S.

### 3.7 Avatars

20px (table) · 36px (navbar user; `border border-white rounded-[100px]` + `shadow-[0px_4px_12px_-2px_rgba(2,6,23,0.08),0px_0.5px_0.5px_0px_rgba(2,6,23,0.04)]`) · 40px (meeting rows). Always full-round.

### 3.8 Chart conventions

- Legend: `gap-[12px]`; item = 12px dot marker + Geist Regular 12 `#020617`, `gap-[4px]`.
- Series colors: Performance `#16B364`, Target `#007AFF`.
- Axes: Geist Regular 11 `#64748b`; Y labels 1.0–5.0; hairline grid `#F1F5F9`-weight.
- Tooltip: `bg-white border-[0.8px] border-[#f1f5f9] rounded-[10px] p-[10px] drop-shadow-[0px_1px_1.5px_rgba(0,0,0,0.03)] flex flex-col gap-[10px]`; date Medium 12 `#020617`; rows `gap-[8px]`: 12px marker + label Regular 12 `#64748b` + value SemiBold 12 `#101010` + `/5` Regular 11 `#94a3b8`. Point markers: 8px dots on the lines.
- Tabs: no tab menu appears on Dashboard; if needed, mirror the nav-item active/inactive pattern (white card + border vs. transparent).
- Search: no search input on this screen; build inputs from the Outline-M chrome (`bg-white border #F1F5F9 rounded-[8px]`, 12px text).

---

## 4. Verbatim reference snippets

### 4.1 Left Navbar (trimmed JSX, classes exact)

```jsx
<div className="bg-[#fbfcfd] border-[#f1f5f9] border-r border-solid flex flex-col h-full w-[280px] overflow-clip relative">
  {/* Logo Section */}
  <div className="border-[#f1f5f9] border-b flex flex-col pl-[16px] pr-[12px] py-[18px] w-full">
    <div className="flex gap-[8px] items-center w-full">
      <div className="border border-[rgba(255,255,255,0.12)] relative rounded-[6px] shadow-[0px_1.5px_2px_-0.5px_rgba(42,42,42,0.14),0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)] size-[24px] overflow-clip">
        <div aria-hidden className="absolute bg-[#16b364] inset-0 rounded-[6px]" />
        <div className="absolute inset-[-1px]" style={{ backgroundImage: "linear-gradient(177.61deg, rgba(255,255,255,0) 2%, rgba(255,255,255,0.12) 98.167%)" }} />
        <img src="/propflow/propflow-logomark.svg" className="-translate-x-1/2 -translate-y-1/2 absolute h-[18px] w-[14.25px] left-1/2 top-1/2" alt="" />
        <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_0px_0.5px_rgba(0,0,0,0.2),inset_0px_1.5px_1.5px_0px_rgba(255,255,255,0.1),inset_0px_-1.5px_1.5px_0px_rgba(0,0,0,0.1)]" />
      </div>
      <p className="font-['Inter:Semi_Bold'] font-semibold text-[#101010] text-[16px] leading-[1.3]">PropFlow</p>
    </div>
  </div>
  {/* Menu group */}
  <div className="flex flex-col gap-[6px] px-[16px] py-[12px] w-full">
    <div className="flex px-[8px] w-full"><p className="font-['Geist:Regular'] text-[#94a3b8] text-[12px] leading-[1.35]">Main</p></div>
    <div className="flex flex-col gap-[2px] w-full">
      {/* Active item */}
      <div className="bg-white border border-[#f1f5f9] flex gap-[6px] items-center p-[8px] rounded-[8px] shadow-[0px_4px_4px_-2px_rgba(0,0,0,0.04)] w-full">
        <div className="flex items-center p-px"><img src="/propflow/icon-house-simple.svg" className="size-[16px]" alt="" /></div>
        <p className="font-['Geist:Medium'] font-medium text-[#020617] text-[14px] leading-[1.4]">Dashboard</p>
      </div>
      {/* Inactive item */}
      <div className="flex gap-[6px] items-center p-[8px] rounded-[8px] w-full">
        <div className="flex items-center p-px"><img src="/propflow/icon-users-four.svg" className="size-[16px]" alt="" /></div>
        <p className="font-['Geist:Regular'] font-normal text-[#475569] text-[14px] leading-[1.4]">Employee</p>
      </div>
    </div>
  </div>
  {/* Bottom user block */}
  <div className="flex gap-[8px] items-center p-[8px] rounded-[10px] w-full">
    <div className="border border-white relative rounded-[100px] shadow-[0px_4px_12px_-2px_rgba(2,6,23,0.08),0px_0.5px_0.5px_0px_rgba(2,6,23,0.04)] size-[36px]">
      <img className="absolute inset-0 object-cover rounded-[100px] size-full" src="…avatar…" alt="" />
    </div>
    <div className="flex flex-1 flex-col">
      <p className="font-['Geist:Medium'] font-medium text-[#101010] text-[14px] leading-[1.4]">John Smith</p>
      <p className="font-['Geist:Regular'] text-[#94a3b8] text-[11px] leading-[1.45]">Team Manager</p>
    </div>
    <div className="flex items-center p-[2px]"><img src="/propflow/icon-caret-up-down.svg" className="size-[12px]" alt="" /></div>
  </div>
  {/* Active notch (navbar edge) */}
  <div className="absolute bg-[#020617] h-[16px] left-[-4px] rounded-[99px] top-[108px] w-[8px]" />
</div>
```

### 4.2 Topbar + date "searchbar-slot" button

```jsx
<div className="border-[#f1f5f9] border-b flex gap-[12px] items-center px-[24px] py-[14px] w-full">
  <div className="flex flex-1 items-center">
    <div className="flex font-['Geist:Regular'] gap-[3px] items-center leading-[1.35] text-[12px]">
      <p className="text-[#94a3b8]">Dashboard</p><p className="text-[#334155]">/</p><p className="text-[#334155]">Overview</p>
    </div>
  </div>
  <div className="flex gap-[6px] items-center justify-end">
    <div className="bg-white border border-[#f1f5f9] flex items-center justify-center p-[6px] rounded-[8px] shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]">
      <div className="flex items-center justify-center p-[2px]">
        <p className="font-['Geist:Medium'] font-medium text-[#020617] text-[12px] leading-[1.35]">10/12/2026</p>
      </div>
      <div className="flex items-center px-[2px] py-[4px]"><img src="/propflow/icon-calendar-blank.svg" className="size-[12px]" alt="" /></div>
    </div>
    <div className="relative flex items-center">
      <div className="bg-white border border-[#f1f5f9] flex items-center justify-center p-[6px] rounded-[8px] shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]">
        <div className="flex items-center p-[2px]"><img src="/propflow/icon-bell-simple.svg" className="size-[16px]" alt="" /></div>
      </div>
      <div className="absolute left-[17px] top-[6px] size-[8px]">{/* notification dot svg */}</div>
    </div>
  </div>
</div>
```

### 4.3 KPI card (with delta badge)

```jsx
<div className="bg-white border border-[#f1f5f9] flex flex-1 flex-col overflow-clip rounded-[12px] shadow-[0px_6px_16px_-8px_#f3f3f3]">
  <div className="border-[#f1f5f9] border-b flex items-start px-[16px] py-[10px] w-full">
    <div className="flex flex-1 gap-[10px] items-center">
      <div className="bg-[#e5f2ff] border-[#cce5ff] border-[0.6px] flex items-center overflow-clip p-[5px] rounded-[6px]">
        <img className="size-[12px]" src="…star-fill…" alt="" />
      </div>
      <p className="font-['Geist:Medium'] font-medium leading-[1.4] text-[#262626] text-[14px]">Avg. Performance</p>
    </div>
  </div>
  <div className="bg-white flex flex-col justify-center overflow-clip p-[16px] w-full">
    <div className="flex items-center justify-between w-full">
      <div className="flex gap-[2px] items-baseline">
        <p className="font-['Geist:Medium'] font-medium leading-[1.3] text-[#262626] text-[18px] tracking-[-0.18px]">82.4</p>
        <p className="font-['Geist:Regular'] leading-[16px] text-[#9b9b9b] text-[12px] tracking-[-0.12px]">Average</p>
      </div>
      <div className="bg-[rgba(35,196,93,0.08)] border-[0.6px] border-[rgba(35,129,69,0.12)] flex items-center px-[3px] py-[2px] rounded-[4px]">
        <img className="size-[14px]" src="…arrow-up-right…" alt="" />
        <p className="font-['Geist:Medium'] font-medium leading-[16px] text-[#23c45d] text-[12px] tracking-[-0.12px]">2.1%</p>
      </div>
    </div>
  </div>
</div>
```

### 4.4 Badge (Green, Badge L)

```jsx
<div className="bg-[#ecf9f3] border-[#daf3e6] border-[0.6px] border-solid flex items-center px-[4px] py-[2px] rounded-[4px]">
  <p className="font-['Geist:Medium'] font-medium leading-[1.35] text-[#16b364] text-[12px]">Good</p>
</div>
```

### 4.5 Buttons (Primary M · Ghost S)

```jsx
{/* Primary M — 32h */}
<div className="relative flex items-center justify-center overflow-clip p-[6px] rounded-[8px] w-full
     shadow-[0px_1.5px_2px_-0.5px_rgba(22,179,100,0.14),0px_0.5px_0.5px_0px_rgba(22,179,100,0.08)]">
  <div aria-hidden className="absolute bg-[#16b364] inset-0 rounded-[8px]" />
  <div className="flex items-center justify-center p-[2px] relative">
    <p className="font-['Geist:Medium'] font-medium leading-[1.35] text-[12px] text-white">View Reviews</p>
  </div>
  <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_0px_0.5px_rgba(0,0,0,0.2),inset_0px_1.5px_1.5px_0px_rgba(255,255,255,0.1),inset_0px_-1.5px_1.5px_0px_rgba(0,0,0,0.1)]" />
</div>

{/* Ghost S — 28h */}
<div className="bg-white border border-[#f1f5f9] flex items-center justify-center overflow-clip p-[4px] rounded-[6px] shadow-[0px_0.5px_0.5px_0px_rgba(42,42,42,0.08)]">
  <div className="flex items-center justify-center p-[2px]">
    <p className="font-['Geist:Medium'] font-medium leading-[1.35] text-[#020617] text-[12px]">View Detail</p>
  </div>
  <div className="flex items-center px-[2px] py-[4px]"><img src="/propflow/icon-caret-right.svg" className="size-[12px]" alt="" /></div>
</div>
```

---

## 5. Assets (`/public/propflow/`)

Downloaded from the Figma MCP export (exact bytes). SVG fills are **baked in** (`#020617` dark, `#475569` gray, `#64748B`); recolor via CSS `mask-image` or swap fills — or use the Phosphor icon set, since every icon in this kit is a **Phosphor glyph** (names below are the Figma component names: HouseSimple, UsersFour, CaretRight, FunnelSimple, …). Builders may substitute inline Phosphor SVGs matching those names/weights (Regular for nav, Fill for chips, Bold for 12px button carets).

| File | What it is |
|---|---|
| `propflow-logomark.svg` | PropFlow logomark (white glyph w/ gradient, sits on the green 24px tile) |
| `brand-star-flourish.svg` | Decorative gradient star (navbar bottom / banner backgrounds) |
| `icon-house-simple.svg` | HouseSimple — Dashboard nav (active, `#020617`) |
| `icon-users-four.svg` | UsersFour — Employee nav (`#475569`) |
| `icon-target.svg` | Target — Goals & OKR nav |
| `icon-files.svg` | Files — Review nav |
| `icon-chats.svg` | Chats — Feedback nav |
| `icon-question.svg` | Question — Help Center nav |
| `icon-gear-six.svg` | GearSix — Settings nav |
| `icon-caret-up-down.svg` | CaretUpDown — user block chevron (`#64748B`) |
| `icon-calendar-blank.svg` | CalendarBlank — topbar date button |
| `icon-bell-simple.svg` | BellSimple — topbar notification button |
| `icon-funnel-simple.svg` | FunnelSimple — "Filter" ghost button |
| `icon-caret-right.svg` | CaretRight — "View Detail" ghost buttons |

Other Phosphor names referenced on this screen (not downloaded — remote URLs expire in ~7 days): Star (KPI), ArrowUpRight (delta), ArrowUp (score delta), Info + ArrowRight (banner), Notepad (CTA chip), DiamondsFour. Avatar photos are placeholder PNGs — use project imagery.

---

## 6. Rules for builders

- [ ] **Font**: Geist for everything (`next/font` → `var(--font-geist)` with `font-family: var(--font-geist), -apple-system, sans-serif`). Only the "PropFlow" wordmark is Inter SemiBold — keep Geist if rebranding the wordmark.
- [ ] **Page**: white content bg (`#FFFFFF`); navbar `#FBFCFD` + `border-r #F1F5F9`; topbar transparent + `border-b #F1F5F9`; content padding 24px; inner max width 1112 on a 1440 design.
- [ ] **Card recipe**: `bg-white border border-[#f1f5f9] rounded-[12px] shadow-[0px_1px_3px_0px_#f3f3f3] overflow-clip` + header `p-[12px] border-b` (SemiBold 14 title / Regular 12 `#64748b` subtitle). KPI cards: `shadow-[0px_6px_16px_-8px_#f3f3f3]`, header `px-[16px] py-[10px]`.
- [ ] **Badge recipe**: `px-[4px] py-[2px] rounded-[4px] border-[0.6px]` + Medium 12; tint triplets from §3.3 (50-bg / 100-border / 500-text).
- [ ] **Buttons**: labels always Medium 12; Primary = `#16B364` + glow + bevel-inset overlay; Outline/Ghost = white + `#F1F5F9` border + `0.5px rgba(42,42,42,0.08)` shadow; heights 28 (S) / 32 (M).
- [ ] **Green surfaces get the candy finish**: every solid `#16B364` fill (buttons, logo tile, progress fills) carries the bevel inset `inset 0 0 0 0.5px rgba(0,0,0,.2) / inset 0 1.5px 1.5px rgba(255,255,255,.1) / inset 0 -1.5px 1.5px rgba(0,0,0,.1)`.
- [ ] **Spacing rhythm**: 12px grid gaps between all cards/columns; 12px card padding; 2/4/6/8 micro-gaps; table rows h-64; hairlines are always `#F1F5F9`.
- [ ] **Icons**: Phosphor glyphs — 16px nav/buttons, 12px small buttons/chips/legends, 14px delta, 20px CTA chip; wrappers add 1–2px padding (document sizes, don't scale globally).
- [ ] **DO NOT** use SEEPCO tokens (`--brand`, etc.) on Propflow OS screens — those are for the SEEPCO-branded marketing/recruit surfaces only. OS screens use only the palette in §1.
- [ ] Numbers get negative tracking (`-0.18px` @18px, `-0.12px` @12px meta); body text never does.
