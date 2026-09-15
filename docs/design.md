# Music Timer — Design Brief

A living brief for the popup's visual design, written to be handed to (or pasted into)
Google Stitch. It grows one iteration at a time — see the log at the bottom — rather than
trying to settle everything at once.

## What this is

Music Timer is an Edge/Chrome extension popup that times listening sessions on YouTube
Music, Spotify and YouTube. It's a small, dense, dark UI: a clock, a lap list, a list of
named timers, and a settings panel tucked behind a gear icon. Its visual design is the
**Timber & Sprout** theme — a warm rustic-wood palette with a moss-green accent, not the
pastel direction originally briefed in iteration 1 (that request produced this instead; see
the log for why it was kept). Built by copying the literal values out of two Stitch exports
(`docs/stitch/`) rather than designing from them — see the v3 log entry for what that
distinction cost the first pass at this.

## Canvas

- **Width: 330px, fixed.** This matches the real shipped `popup.css` and is the true canvas
  — a Chrome/Edge extension popup isn't user-resizable, so this isn't a suggestion, it's the
  actual frame any mock has to fit.
- **Height: content-driven, not fixed.** It ranges roughly 340–590px: Timers and Laps
  default to expanded (matching Stitch's base screen, which has no collapse control at all)
  and can each be collapsed to a one-line summary via a chevron (directive 5); the settings
  panel is collapsed behind the gear until opened. Design for a range, not one exact box, and
  lean toward Chrome's own convention of no scrolling in the common case.
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
- **Current lap** — under the clock: the lap in progress by name only, e.g. "Work - lap 2" —
  no "· now" here; that badge belongs only to the full lap list's open row (a different
  element - the two were briefly conflated, see the v3 log entry)
- **Primary action row** — Lap / Start-or-Stop / Reset, icon-only (directive 1). All three
  share one neutral button style; nothing is filled or outlined as "primary" — Stitch
  distinguishes them only by icon
- **Timers section** — collapsible (directive 5), expanded by default. Its header row holds
  New and Delete as small icon buttons (+ / trash) at the same height as the title - visible
  only while expanded, since there's nothing to act on while collapsed, which shows the
  active timer's name and time instead. There's no Rename button; double-clicking a timer's
  name renames it, any timer in the list, not only the active one. The active row shares its
  background with every other row - it's told apart by text weight and an accent-colored
  time, not a highlight
- **Laps section** — collapsible, same pattern, expanded by default; expanded shows the lap
  in progress then past laps newest-first (click one to rename); collapsed shows one line,
  `<lap name>: <time>` with no "· now" — a single summary line naming one lap is already
  unambiguous. The summary line only shows while collapsed - once the full list is visible it
  would just repeat what the list already says
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
  5. **Timers and Laps are now collapsible**, a one-line summary (name + time) in place of
     the full list, toggled by a chevron. (First built defaulting to collapsed; corrected to
     default expanded in v3 - see below.)
  6. **Playlist names truncate progressively with space**: full ("Deep Focus —
     Instrumental") in the header; shortened to the part before the em dash ("Deep Focus")
     in the timer row; dropped entirely in the collapsed summary.
  7. **The footer dropped its track/context half** - site name only, since the header
     already carries the rest.
  8. **The palette is "Timber & Sprout," not literal pastel** - warm rustic wood browns
     (`#241410`/`#3d211a`/`#4a2a22`) with a moss-green accent (`#84a968`), which is what
     "pastel... cozy" turned into once actually explored in Stitch. Kept as the new
     direction rather than pushed back toward pale pastel.
  9. **The two exports' literal Tailwind values are authoritative**, not `DESIGN.md` -
     corrected in v3 below, where this was originally decided the other way around.
     `popup.css`'s `:root` now holds these as real custom properties either way - the raw hex
     values scattered outside `:root` that iteration 1 flagged (`docs/BEST_PRACTICES.md`
     §1.6) are gone, replaced while every value was being touched anyway.

- **2026-09-14 — v3, corrected to match the exports literally.** Jason's read: "you took a
  lot of liberties with the design" - accurate. v2 had designed *from* the two Stitch
  exports rather than copying them, and line-by-line comparison against
  `docs/stitch/*/code.html` turned up real deviations, all reverted:

  - **Colors came from `DESIGN.md`, not the exports** - flagged by Jason as the single
    biggest problem. Every token in `popup.css` now traces to a literal value in the two
    `code.html` files (verified by reading computed styles back from a real render of them,
    not just the source), not the accompanying system doc, which had drifted from what was
    actually exported. One exception, kept on request: the collapsed Laps summary's lap name
    stays accent-green, which Jason said he liked, even though the export's own markup left
    that line a single uncolored span.
  - **Lap was a filled, accent-colored "primary" button; Stop had its own outlined style.**
    Neither exists in the exports - all three action buttons share one identical neutral
    button style there, distinguished only by which icon sits inside them.
  - **The active timer row had a highlighted background.** The exports give active and
    inactive rows the same background; only text weight and an accent-colored time (plus a
    small running-triangle icon) mark the active one.
  - **"· now" and italics leaked onto the under-clock current-lap label.** That styling
    belongs only to the full lap list's open row, a separate element in the export - the two
    were conflated while building it.
  - **Timers and Laps defaulted to collapsed.** The unsuffixed export (no collapse control at
    all) reads as the base state; "compacted" is the second state its own chevron affordance
    leads to - not the default to open on.
  - Two things intentionally still deviate from a literal copy, both necessary to keep the
    real feature working rather than a static picture of it: the collapse **toggle mechanism
    itself** (reconciling two static screens into one working control), and the **Start
    icon** for when a timer isn't running, which neither export ever depicts (both show the
    timer running).

- **2026-09-15 — v4, Timers management moved to the header.** The full-screen export's own
  layout was still being missed: New/Delete were a text button row (+ New / Rename / Delete)
  under the list, not icon buttons in the header the export actually shows.

  - **New and Delete are icon buttons (+ / trash) at the same height as "Timers"**, matching
    the export exactly - `h-5 w-5` icon buttons beside the title, not a row of labeled
    buttons below the list. They only show while expanded; collapsed, that space holds the
    one-line summary instead, since there's nothing visible left to add to or delete from.
  - **Rename has no button at all now** - double-clicking a timer's name is the only way in,
    per instruction. Works on any row in the list, not only the active timer (an improvement
    over the old button, which could only ever rename whichever timer was already active).
  - Delete's confirm-before-deleting step still exists (deleting is destructive) but is now a
    color change plus an `aria-label`/title swap instead of a text label swap, since there's
    no visible text left to swap - this state isn't in either export; deleting a timer was
    never depicted in either screen.

  Verified: tsc --noEmit clean, all 5 suites pass, and drove the actual double-click-to-
  rename, the delete arm/confirm cycle, and the header icons disappearing behind the summary
  on collapse, in a real render.

- **2026-09-17 — v5, a dedicated Settings page.** Jason brought a third export
  ([`stitch/settings_page/code.html`](stitch/settings_page/code.html)) showing settings as
  their own page - a back arrow, a Save button, and a materially bigger feature set than the
  inline panel it replaces. Four real product decisions came out of this before any code:

  1. **Same popup, not a real Chrome options page.** One `popup.html` now holds two views,
     `#timerView` and `#settingsView`, toggled by hiding one and showing the other - no
     manifest change, no second document.
  2. **Settings are a real staged draft.** Nothing reaches `background.js` until Save sends
     one `SAVE_TIMER_SETTINGS` command for the whole form at once; the back arrow discards
     the draft outright. This replaced `SET_MODE`/`SET_FILTER`/`CLEAR_FILTER` entirely -
     three commands that each applied instantly are now one that applies everything
     together, on Save.
  3. **A "Target timer" dropdown configures any timer, not only the active one.** Every
     command already accepted an optional timer id; the settings page is the first thing
     that actually uses it for something other than the currently active timer. Switching
     the dropdown reloads the draft from that timer's real saved settings, discarding any
     unsaved edits - the same as the back arrow does.
  4. **"Specific playlist(s)" grew into a real fourth filter mode**, `specific` - a whole new
     way for a timer to decide what counts, alongside `current` and `any`. It holds a list,
     matches if **any one** of them is playing (Jason: "if any playlist that had been
     explicitly stated plays, the timer follows any of those playlists"), accepts either a
     typed name or a pasted playlist link (parsed into the same `site:id` scheme
     `content.js`'s own adapters use - e.g. a Spotify playlist link becomes
     `spotify:playlist/<id>`), and a hover-revealed "+" at the bottom of its card adds more
     entries. The first entry pre-fills from whatever "Use current" was bound to, or starts
     empty with guidance text if "Any music" was in effect - a Jason-specified default,
     not inferred.

  Two smaller, self-decided pieces: an "Active" badge on the mode cards shows which one is
  really in effect right now (the loaded baseline), separate from the green border tracking
  the live draft selection - useful precisely because a draft can now disagree with what's
  saved. And the confirm-before-deleting question doesn't arise here; nothing on this page
  deletes anything.

  Verified: `tsc --noEmit` clean; new coverage in `test/settings.test.js` (OR-matching
  across several specific playlists, a timer auto-claiming under `specific` mode exactly
  like it already did under `current`, the settings dropdown listing every timer, an
  out-of-range save clamped to 10 entries) plus a migration case in `test/migration.test.js`
  for timers stored before `filterMode`/`specificPlaylists` existed; all 6 suites pass. Drove
  the real page in a browser: mode/filter selection, the "Active" badge staying on the
  baseline through an unsaved change, add/remove on the specific-playlist list, a pasted
  Spotify link parsed correctly end to end through a real save, the target-timer dropdown
  discarding an unsaved edit on switch, and the back arrow discarding one on exit.
