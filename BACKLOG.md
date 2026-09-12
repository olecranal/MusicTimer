# Backlog

Ideas raised but not built yet, kept here so they don't get lost.

## 1. Song history + rewind the timer to a song

**Problem it solves:** you leave music running after you've stopped working. The timer keeps
counting and the total is badly wrong. Right now the only fix is Reset, which throws
everything away.

**Idea:** record every song counted during a timer, with the timestamp it started. Show that
list in the popup. Picking a song rewinds the timer to that song's start time — so instead of
a wildly wrong total you get an approximately right one.

Notes for whoever builds it:
- The content script already reports `track.title` / `track.artist` on every heartbeat; the
  background would need to append to a per-timer list on each change, not on every report.
- Rewinding means setting `accumulatedMs` back to its value at that song's start, so the
  history entries should store the timer's elapsed value at the moment the song began
  rather than only wall-clock time.
- The same rewind has to correct `daily[today]`, which is committed separately.
- Worth capping the list (a few hundred entries) so storage doesn't grow without bound.

## 2. Laps, like a stopwatch

**Idea:** a Lap button that splits the running timer. Each lap gets a name, defaulting to
`<parent timer> - lap N`, and can be renamed.

Notes for whoever builds it:
- A lap is a `{ id, name, startedAtMs, endedAtMs }` range within its parent timer's elapsed
  time, so laps survive a rewind (idea 1) and can be recomputed from it.
- Popup needs somewhere to show laps for the active timer without crowding the timer list —
  probably a collapsible section under the clock.
- Decide whether lapping while paused is allowed (a stopwatch lets you; it just makes a
  zero-length lap).
