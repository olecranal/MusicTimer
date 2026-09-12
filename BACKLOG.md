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

## 2. ~~Laps~~ — shipped

Built on the `laps` branch: Lap is now the primary button, laps are stored as offsets into
the parent timer's elapsed time, default to `<timer> - lap N`, and are renameable. Idea 1
below still has to keep them consistent when it rewinds.
