# Music Timer — Design Brief

A living brief for the popup's visual design, written to be handed to (or pasted into)
Google Stitch. It grows one directive at a time — see the log at the bottom — rather than
trying to settle everything at once.

## What this is

Music Timer is an Edge/Chrome extension popup that times listening sessions on YouTube
Music, Spotify and YouTube. It's a small, dense, dark-only UI today: a clock, a lap list, a
list of named timers, and a settings panel tucked behind a gear icon. The visual design is
currently placeholder — functional, undecided, ready to be replaced.

## Canvas

- **Width: 330px, fixed.** This matches the real shipped `popup.css` and is the true canvas
  — a Chrome/Edge extension popup isn't user-resizable, so this isn't a suggestion, it's the
  actual frame Stitch's mock has to fit.
- **Height: content-driven, not fixed.** The reference screenshot below is 555px tall at one
  representative state (one running timer with a lap taken, a second idle timer, settings
  collapsed). Fewer laps or timers shrinks it; more grows it; the settings panel adds
  roughly another 140px when open. Design for a range, not one exact box, and lean toward
  Chrome's own convention of no scrolling in the common case.
- **Reference screenshot:** [`design-reference-popup.png`](design-reference-popup.png) — a
  real render of the current shipped UI, not a mockup or a redrawn approximation. Paste this
  in as Stitch's starting reference image rather than reconstructing the layout from
  description alone.

## Current structure

So whatever gets designed has somewhere to put every real piece, even the ones this round
isn't touching:

- **Header** — status dot, active timer's name, "today" running total, settings gear
- **Clock** — the big elapsed-time readout
- **Status line** — track — artist, and which playlist it's from
- **Primary action row** — Lap / Stop / Reset (see directive 1)
- **Laps section** — the lap in progress, then past laps newest-first; click one to rename
- **Timers section** — the list of named timers, with + New / Rename / Delete
- **Settings panel** — collapsed by default behind the gear: a mode switch ("Follow the
  music" / "Only when I say") and a playlist filter ("Use current" / "Any music")
- **Footer** — which open tabs are playing, and from where

## This iteration's directives

Two changes only for this round. Everything else stays as it is in the reference screenshot
until a later entry in the log below changes it.

### 1. Icon buttons instead of text

Replace the three primary action buttons — currently the literal words **Lap**, **Stop**,
**Reset** — with symbols. Starting points to react to, not final answers:

- **Lap** — a flag, or a "split" glyph (two stacked bars, or a bracket) — the usual
  stopwatch-lap convention
- **Stop** — a solid square, the universal media-stop glyph
- **Reset** — a counterclockwise circular arrow

These are still real, distinct actions once the labels are gone, not decoration — whatever
Stitch lands on should stay identifiable at a glance (and eventually needs an accessible
name even without visible text, though that's an implementation detail for later, not
something to solve in Stitch).

### 2. Pastel, cozy color scheme

Move away from the current near-black-and-neon-green combination toward a pastel palette —
soft, muted tones that read as cozy rather than clinical. Deliberately not settled yet:
light base vs. dark base, which pastel family (blush, lavender, sage, and butter are all
fair game), and whether the "running" state keeps one more-saturated accent against the
pastel base or stays pastel all the way through. This is exactly what Stitch's Edit Theme
panel is for — try a few directions at the real 330px width and see what actually feels
cozy, rather than deciding it in the abstract first.

## What's still open

Not part of this round, kept here so it isn't lost: typography, iconography style beyond
these three buttons, spacing and density, motion, a light/dark mode policy, and how many
surface/elevation layers the pastel palette actually needs. Revisit once directives 1 and 2
have landed somewhere good.

## Real content to use

Never lorem ipsum — this is what real usage actually looks like:

- Timer names: **Work**, **Gaming**
- Now playing: *Nuvole Bianche — Ludovico Einaudi*, from the playlist **Deep Focus —
  Instrumental** (YouTube Music)
- A named lap: **Spec review**, `0:21:04`
- A running total: `0:47:13` on **Work**, `today 2h 18m`

## Log

- **2026-09-14** — v1. Directives: icon-only primary actions, pastel/cozy palette.
