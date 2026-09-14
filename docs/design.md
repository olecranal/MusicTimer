# Music Timer — Design Brief

A living brief for the popup's visual design, written to be handed to (or pasted into)
Google Stitch. It grows one iteration at a time — see the log at the bottom — rather than
trying to settle everything at once.

## What this is

Music Timer is an Edge/Chrome extension popup that times listening sessions on YouTube
Music, Spotify and YouTube. It's a small, dense, dark UI: a clock, a lap list, a list of
named timers, and a settings panel tucked behind a gear icon. Its visual design is the
**Timber & Sprout** theme, designed in Google Stitch and shipped in iteration 2 (see the
log) — a warm rustic-wood palette with a moss-green accent, not the pastel direction
originally briefed in iteration 1 (that request produced this instead; see the log entry
for why it was kept).

## Canvas

- **Width: 330px, fixed.** This matches the real shipped `popup.css` and is the true canvas
  — a Chrome/Edge extension popup isn't user-resizable, so this isn't a suggestion, it's the
  actual frame any mock has to fit.
- **Height: content-driven, not fixed.** It ranges roughly 340–560px depending on how much
  is expanded: Timers and Laps each collapse to a one-line summary by default (directive 5,
  iteration 2), and the settings panel is collapsed behind the gear until opened. Design for
  a range, not one exact box, and lean toward Chrome's own convention of no scrolling in the
  common case.
- **Reference screenshot:** [`design-reference-popup.png`](design-reference-popup.png) — a
  real render of the current shipped UI, not a mockup or a redrawn approximation, kept in
  sync with whatever iteration is live. Paste this in as Stitch's starting reference image
  rather than reconstructing the layout from description alone.

## Current structure

- **Header** — status dot, then the *now-playing* block: track — artist on one line, "from
  &lt;playlist&gt;" on the next (or a status message in the same spot when nothing eligible is
  playing — see `statusParts()` in `popup.js`); the settings gear on the right. The active
  timer's own name and its daily total are no longer here (moved / dropped — see iteration 2).
- **Timer label** — small caps, above the clock: the active timer's name (e.g. "WORK")
- **Clock** — the big elapsed-time readout
- **Current lap** — under the clock: the lap in progress, e.g. "Work - lap 2 · now"
- **Primary action row** — Lap / Start-or-Stop / Reset, icon-only (directive 1, iteration 2)
- **Timers section** — collapsible (directive 5): expanded shows the full list with
  + New / Rename / Delete; collapsed shows one line, the active timer's name and time
- **Laps section** — collapsible, same pattern; expanded shows the lap in progress then past
  laps newest-first (click one to rename); collapsed shows one line, `<lap name>: <time>`
  with no "· now" — a single summary line naming one lap is already unambiguous
- **Settings panel** — collapsed by default behind the gear: a mode switch ("Follow the
  music" / "Only when I say") and a playlist filter ("Use current" / "Any music")
- **Footer** — which open tabs are playing (site name only, no track/context — the header
  already carries that)

## What's still open

Not decided yet: typography beyond the clock's monospace digits (still the system font
stack — Stitch's own type spec for this theme, Epilogue + Plus Jakarta Sans, was not
adopted, since loading a web font would break the project's zero-dependency, no-build-step
rule), general spacing/density polish, motion (`docs/CONFORMANCE.md` U-05 is still open),
and a light-mode variant (this theme is dark-only, undecided whether that's permanent).

## Real content to use

Never lorem ipsum — this is what real usage actually looks like:

- Timer names: **Work**, **Gaming**
- Now playing: *Nuvole Bianche — Ludovico Einaudi*, from the playlist **Deep Focus —
  Instrumental** (YouTube Music)
- A named lap: **Spec review**, `0:21:04`
- A running total: `0:47:13` on **Work**

## Log

- **2026-09-14 — v1.** Directives: icon-only primary actions, pastel/cozy palette.

- **2026-09-14 — v2, "Timber & Sprout" shipped.** Jason brought back two Stitch exports
  (archived at [`stitch/rustic_wood_forest_green/`](stitch/rustic_wood_forest_green/code.html),
  [`stitch/compacted_laps_timers/`](stitch/compacted_laps_timers/code.html), and Stitch's own
  system doc at [`stitch/timber_sprout/DESIGN.md`](stitch/timber_sprout/DESIGN.md)). Cross-
  checking repeated text/values across the two screens and the real data model surfaced nine
  concrete questions; approved outcomes, folded into `popup.html`/`.css`/`.js`:

  1. **Header now shows now-playing, not the timer name.** The active timer's name moved to
     a small label above the clock instead.
  2. **The "today" total was dropped from the UI.** `daily`/`todayMs` tracking still exists
     in `background.js` unchanged - only removed from what the popup displays.
  3. **Lap count counts every row shown, closed and in-progress** (`laps.length + 1`), not
     just finished laps — the word "recorded" was dropped from the label since it isn't true
     of the open one.
  4. **Two different lap-summary formats, both intentional.** The full list keeps
     "`<lap> · now`" (needed - a second, finished lap is also visible there, so which one is
     current isn't obvious without it). The collapsed one-line summary drops "now" and uses
     "`<lap>: <time>`" instead (a single line naming one lap is already unambiguous).
  5. **Timers and Laps are now collapsible**, each defaulting to collapsed - a one-line
     summary (name + time) in place of the full list, toggled by a chevron.
  6. **Playlist names truncate progressively with space**: full ("Deep Focus —
     Instrumental") in the header; shortened to the part before the em dash ("Deep Focus")
     in the timer row; dropped entirely in the collapsed summary.
  7. **The footer dropped its track/context half** - site name only, since the header
     already carries the rest.
  8. **The palette is "Timber & Sprout," not literal pastel** - warm rustic wood browns
     (`#241410`/`#3d211a`/`#4a2a22`) with a moss-green accent (`#84a968`), which is what
     "pastel... cozy" turned into once actually explored in Stitch. Kept as the new
     direction rather than pushed back toward pale pastel.
  9. **`DESIGN.md`'s documented tokens took precedence** over the two exports' own slightly
     different ad hoc Tailwind values for the same roles (e.g. its `primary: #84a968` over
     the exports' `foliage-400: #72B558`), since it's the more deliberately named, complete
     system. `popup.css`'s `:root` now holds these as real custom properties - the raw hex
     values scattered outside `:root` that iteration 1 flagged (`docs/BEST_PRACTICES.md`
     §1.6) are gone, replaced while every value was being touched anyway.
