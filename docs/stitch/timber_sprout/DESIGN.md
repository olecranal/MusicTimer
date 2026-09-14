---
name: Timber & Sprout
colors:
  surface: '#1f0f0c'
  surface-dim: '#1f0f0c'
  surface-bright: '#483430'
  surface-container-lowest: '#190a07'
  surface-container-low: '#281713'
  surface-container: '#2c1b17'
  surface-container-high: '#382621'
  surface-container-highest: '#44302b'
  on-surface: '#fbdcd4'
  on-surface-variant: '#c3c8ba'
  inverse-surface: '#fbdcd4'
  inverse-on-surface: '#3f2c27'
  outline: '#8d9385'
  outline-variant: '#43483d'
  surface-tint: '#abd28d'
  primary: '#abd28d'
  on-primary: '#193703'
  primary-container: '#84a968'
  on-primary-container: '#1e3d08'
  inverse-primary: '#46672e'
  secondary: '#edbd97'
  on-secondary: '#472a0e'
  secondary-container: '#613f22'
  on-secondary-container: '#dbac87'
  tertiary: '#f7b89f'
  on-tertiary: '#4c2615'
  tertiary-container: '#ca9179'
  on-tertiary-container: '#522b19'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c7efa7'
  primary-fixed-dim: '#abd28d'
  on-primary-fixed: '#0b2000'
  on-primary-fixed-variant: '#2f4f18'
  secondary-fixed: '#ffdcc2'
  secondary-fixed-dim: '#edbd97'
  on-secondary-fixed: '#2e1500'
  on-secondary-fixed-variant: '#613f22'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#f7b89f'
  on-tertiary-fixed: '#331204'
  on-tertiary-fixed-variant: '#673c29'
  background: '#1f0f0c'
  on-background: '#fbdcd4'
  surface-variant: '#44302b'
typography:
  headline-xl:
    fontFamily: Epilogue
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Epilogue
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Epilogue
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Epilogue
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system blends the nostalgic, rustic comfort of handcrafted countryside gaming with the crisp precision of modern desktop productivity. It translates pastoral warmth—timber framing, sunlit parchment, and winding foliage—into an ergonomic, polished interface that feels tactile rather than retro-clunky.

The design movement is **Tactile Warm Modern**:
- **Tactility without clutter**: Subtle wooden bevels, debossed content wells, and soft dimensional insets evoke physical woodcraft and carved markers without sacrificing modern density or clarity.
- **Atmospheric grounding**: Deep bark tones anchor the visual weight, while golden parchment hues provide readable, glare-free luminance.
- **Organic vitality**: Vibrant moss and leafy greens signify focus states, live progression, timers, and affirmative feedback.
- **Refined contrast**: Clean contemporary grotesque typography balances the rustic palette, preventing the interface from dissolving into novelty pixel kitsch.

## Colors

The palette operates under a cozy dark mode baseline, evoking sun setting over dense pine forests and warm cabin interiors.

### Palette Architecture
- **Primary (`#84A968`)**: Lush sprout green used for running timers, primary calls-to-action, success states, and progress meters.
  - Active / Focus variant: `#6B8C52`
  - Shaded accent variant: `#4E6E38`
- **Secondary (`#C89B77`)**: Sunlit honey pine, used for subtle borders, secondary action markers, icons, and muted tags.
  - Parchment highlight: `#EBD5B3` (utilized for high-contrast typography, glyph highlights, and hero metrics).
- **Tertiary (`#784A36`)**: Aged cedar, providing structural boundaries, elevated interactive cards, dividers, and pill backgrounds.
- **Neutral Baseline (`#241410`)**: Deep heartwood bark, serving as the deep viewport canvas.
  - Elevated container tone: `#3D211A` (cabin plank surface for panels, modals, and input fields).

### Semantic & Interaction Roles
- **Canvas Base**: `#241410`
- **Surface (Panels, Drawers)**: `#3D211A`
- **Surface Raised (Cards, Item Planks)**: `#4A2A22` with a 1px border of `#784A36`
- **Surface Inset (Inputs, Progress Wells)**: `#1E100D` with inset shadow
- **Text Primary (Parchment Glow)**: `#EBD5B3`
- **Text Secondary (Weathered Pine)**: `#C89B77`
- **Text Muted**: `#937057`
- **Active / Running Accent**: `#84A968`

## Typography

The type system brings modern craftsmanship to a cozy setting. 

- **Display & Headlines (`Epilogue`)**: Offers sculpted character, sturdy vertical stems, and architectural warmth. It hints at artisanal wooden signage without resorting to unreadable pixel or ornate blackletter scripts.
- **Body & Functional UI (`Plus Jakarta Sans`)**: Soft, humanist geometric styling that remains legible at dense scale within browser extensions, status trackers, and multi-column lists.

Ensure numbers within running counters, clocks, and resource stats use tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout shift during tick cycles.

## Layout & Spacing

This system utilizes an 8-point base spatial grid (with a 4-point micro-step) designed for compact modular widgets and expandable panel views.

### Structure & Grids
- **Modular Fluid Extension Layout**: Defaults to a fluid single or dual-pane container on viewports under 600px, expanding into a responsive 12-column system on full-width viewports.
- **Gutter Rhythm**: Compact `1rem` on narrow viewports to preserve workspace real estate; relaxing to `1.5rem` on larger screen sizes.
- **Canvas Edge Margins**: `1rem` standard padding around dashboard shells, framing UI modules like clean joinery planks.

### Density & Grouping
- Components use `space-xs` (4px) for micro badge padding and icon-to-label gaps.
- Field grouping, item list rows, and timer controls adhere to `space-md` (12px) for a tidy, pocket-inventory feel.
- Sections, plank headers, and nested panels maintain `space-lg` (20px) to give content breathing room against deep bark backgrounds.

## Elevation & Depth

Visual hierarchy abandons sterile cold dropshadows in favor of **Carved Plank Tiers**—a mixture of warm ambient occlusion, directional wood grain edge-lighting, and debossed wells.

- **Level 0 (Canvas Base - `#241410`)**: The deepest foundation. Flat, matte, texture-absorbing ground.
- **Level 1 (Panels & Grouping Planks - `#3D211A`)**:
  - Border: 1px solid `#4E2E25`
  - Shadow: `0 2px 8px rgba(18, 9, 7, 0.6), inset 0 1px 0 rgba(235, 213, 179, 0.08)` (subtle top highlight mimics light hitting timber bevel).
- **Level 2 (Active Cards & Floating Menus - `#4A2A22`)**:
  - Border: 1px solid `#784A36`
  - Shadow: `0 8px 20px rgba(18, 9, 7, 0.7), 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(235, 213, 179, 0.15)`
- **Level -1 (Debossed Insets - Inputs, Empty Slots, Trackers - `#1E100D`)**:
  - Border: 1px solid `#341913`
  - Shadow: `inset 0 2px 4px rgba(10, 5, 4, 0.8), 0 1px 0 rgba(235, 213, 179, 0.05)`
- **Organic Luminescence (Active State / Running Timer)**:
  - Foliage Glow: Elements in active execution cast a soft, diffused moss aura: `0 0 14px rgba(132, 169, 104, 0.25)`.

## Shapes

The design system adopts **Roundedness Level 2** (`0.5rem` / `8px` default radius) to capture the soft, planed corners of hand-carved wood crafts without drifting into childish bubbles.

- **Base Radius (`0.5rem` / `8px`)**: Applied to buttons, inputs, list items, and standard chip badges.
- **Large Radius (`1rem` / `16px`)**: Applied to primary plank containers, modal sheets, and standalone widget cards.
- **Well Radius (`0.375rem` / `6px`)**: Applied to progress tracks and inner sunken slots to seat neatly inside outer shells.
- **Pill Exceptions (`9999px`)**: Reserved exclusively for active status tags, live timer displays, and micro counter pips.

## Components

### Buttons
- **Primary (Moss Harvest)**: Solid `#84A968` fill with `#1C2E11` bold text. Top interior bevel `inset 0 1px 0 rgba(255, 255, 255, 0.35)`, bottom drop lip `0 2px 0 #4E6E38`. Hover transitions to `#95BD76`.
- **Secondary (Wood Plank)**: Surface `#4A2A22`, border 1px solid `#784A36`, text `#EBD5B3`. Hover deepens tone to `#573229` with lightened border `#C89B77`.
- **Tertiary (Ghost Amber)**: Transparent background, text `#C89B77`, hover background `rgba(200, 155, 119, 0.1)`.

### Input Fields
- **Container**: Inset well style (`#1E100D`), 1px solid `#4A2A22`. Height: 40px with `space-md` horizontal padding.
- **Text & Placeholder**: Value in `#EBD5B3`, placeholder in `#784A36`.
- **Focus State**: 1px solid `#84A968` with moss ring `0 0 0 3px rgba(132, 169, 104, 0.2)`.

### Cards & Planks
- Outer container `#3D211A` with a 1px perimeter of `#784A36`.
- Padding configured at `space-lg` (20px).
- Optional header accent: bottom divider 1px solid `#2F1813` accompanied by a highlight line `0 1px 0 rgba(235, 213, 179, 0.05)`.

### Lists & Inventory Cells
- Individual list entries sit on Level 1 surface with transparent borders until hovered.
- Hover state: Background lifts to `#4A2A22` with a left border pip in `#84A968` (3px thickness).
- Slot-style items (e.g., inventory grid or task cards) use square aspect ratios, sunken `#1E100D` surfaces, and pop with secondary `#C89B77` icons.

### Checkboxes & Radio Buttons
- Base box: 18x18px sunken well (`#1E100D`), 1.5px border `#784A36`, rounded to 4px (radios use 50%).
- Checked state: Background `#84A968`, check glyph or pip rendered in deep forest bark (`#1E100D`).

### Chips & Badges
- **Static Tag**: Inset `#241410`, text `#C89B77`, 1px border `#3D211A`, padding `4px 10px`, font `label-sm`.
- **Active State / Sprout Badge**: Background `rgba(132, 169, 104, 0.15)`, text `#84A968`, border `1px solid rgba(132, 169, 104, 0.4)`.

### Specialized Feature: Cozy Timer & Progress Well
- **Track**: Sunken groove (`#1A0E0B`), 10px height, fully rounded.
- **Indicator Fill**: Vibrant gradient `#6B8C52` to `#84A968` with a bright trailing edge glow (`#A5CE83`).
- **Digits Display**: High-contrast `#EBD5B3`, monospaced tabular numbers, paired with a blinking sprout green pulse dot.