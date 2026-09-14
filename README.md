# Music Timer

A Microsoft Edge extension that runs a timer while your music is playing and stops it when
the music stops. Built for **YouTube Music**, and also works on **Spotify Web** and
**YouTube**.

## Install (unpacked)

1. Open `edge://extensions/`
2. Turn on **Developer mode** (bottom-left toggle)
3. Click **Load unpacked** and pick this folder (`Documents\MusicTimer`)
4. Pin the extension so the icon stays visible

A music tab you already had open gets picked up automatically within a second or two -
no need to reload it.

The same steps work in Chrome at `chrome://extensions/`.

**Updating after pulling new code:** if the update added a new permission (check
`manifest.json`'s `permissions` list against what you last had), clicking the reload icon on
the extension card is not enough - Chromium browsers can silently withhold a newly added
permission from an unpacked extension until it's re-approved, with no visible error. If
something that used to work stops working right after an update, **Remove** the extension
and **Load unpacked** again rather than reloading it in place.

## What it does

**1. Follow the music (default).** The timer runs while audio is playing and pauses the
moment you pause. If you had a music tab open before installing (or before reloading the
extension after an update), it backfills itself into that tab within a second or two - no
manual refresh needed. See *Reaching tabs that were already open* below.

**2. Only when I say.** The timer starts on its own the first time music plays, then keeps
running through pauses, track changes and silence until you press **Stop**. After you stop,
it will not restart while the same music is still going — it re-arms only once playback has
actually stopped and started again. Switch modes under the **⚙ Settings** panel.

**3. Several timers.** Keep `Work` and `Gaming` apart so each tracks its own total.
Every timer carries its own clock, mode and playlist binding. Only the active one counts —
pick it in the **Timers** list, or let it pick itself (below). Use **+ New**, **Rename** and
**Delete** to manage the list; the last timer cannot be deleted.

**4. Count only one playlist.** In the **⚙ Settings** panel, play the playlist you care about
and press **Use current**. From then on only that playlist moves the clock; anything else is
ignored (the popup says so: *"Music is playing, but not from …"*). Press **Any music** to
clear it.

**5. Laps.** **Lap** splits the active timer the way a stopwatch does: it closes the
stretch you were in and opens the next one, leaving the running total alone. Each lap is
named `<timer> - lap N` and can be renamed by clicking it (or focusing it and pressing
Enter). Laps measure counted time, so a pause in the music does not inflate them. They are
per-timer, and **Reset** clears them along with the total.

**Auto-switching.** A timer bound to a playlist takes over automatically when that playlist
starts. Bind `Work` to your focus playlist and `Gaming` to your hype mix, and the music
routes your time for you. If you override it by hand, the choice sticks — auto-switching
won't undo it while that same playlist is still playing, and claims again only once the
playlist stops and starts afresh. Timers with no playlist bound never auto-claim.

The primary button is **Lap**, because in "Follow the music" mode starting and stopping is
the music's job. **Stop** is still there as a manual override, which is what makes "Only
when I say" mode work at all.

The badge on the toolbar icon shows elapsed minutes, green while the clock runs. The popup
also shows a running total for the day, for the active timer.

## Playlist detection, by site

| Site | How the playlist is identified |
| --- | --- |
| YouTube Music | `list=` id from the URL — reliable while you stay on the watch page |
| YouTube | `list=` id from the URL — reliable |
| Spotify | the "playing from" context link when Spotify renders one; otherwise it falls back to the playlist page you have open, and the popup labels that as best effort |

Spotify keeps the playing context out of the DOM more often than the YouTube sites do, so
playlist filtering there is the weakest of the three. Capture the filter from the playlist's
own page for the best result.

## Reaching tabs that were already open

Chrome only auto-injects a manifest-declared content script into tabs that load *after* the
extension does. A tab you already had open when you installed the extension - or when you
reloaded it from `edge://extensions` to pick up an update - never gets the script from the
manifest alone. Not on switching to it, not on it regaining focus; only an actual navigation
or refresh triggers it. From the outside that looks exactly like "the timer doesn't see a
tab I already had open," and for a while it actually was that: nothing patched it.

The background worker now closes that gap itself: on install, on update, and on browser
startup, it reads the exact file list and match patterns out of its own manifest and injects
them into every open tab that matches - reusing the declaration rather than keeping a second
copy that could drift from it. A tab you open after that point is still handled the normal
way, by the manifest.

## How playback is detected

The content script watches the page's `<video>`/`<audio>` element: playing means *not
paused* **and** `currentTime` is actually advancing, which keeps a buffering or wedged
player from being counted. Progress is judged at most once per ~900ms; calls in between
repeat the standing verdict. That matters because the detector runs from the 1s poll *and*
from play/pause events, so several calls can land in the same millisecond — a track change
fires pause+play right next to a poll. Counting those as stalls reported "not playing" over
music that was playing fine.

The site's own play/pause button is used only as a fallback when the page has no media
element yet — YouTube, for example, leaves `playing-mode` on its player before the first
play, so a real media element always wins.

Tabs report in every 4 seconds. The background worker owns the clock and stores it as
`{ accumulatedMs, runningSince }`, so elapsed time is always derived from timestamps and
survives the service worker being shut down. If a tab stops reporting (crash, discard,
extension reload) it is credited up to 12 seconds past its last report and no further, so a
dead tab cannot run the clock forever.

## Layout

```
manifest.json            MV3 manifest
src/content.js           playback + playlist detection, one adapter per site
src/background.js        every timer's clock, mode logic, playlist routing, badge
src/popup.html/css/js    the popup UI
src/shared/logger.js     structured logging, shared by all three contexts
src/shared/contract.js   the message types and command names they agree on
src/shared/playback.js   "is this page making sound?", free of DOM and chrome APIs
types/*.d.ts             hand-declared chrome API + the shapes that cross a boundary
tsconfig.json            type-check config (checkJs, no build, no dependencies)
test/harness.js          stubbed chrome API + fake clock
test/background.test.js  clock, modes, playlist filter, multi-timer routing
test/migration.test.js   upgrading from older stored layouts
test/laps.test.js        lap splitting, naming, isolation and reset
test/playback.test.js    playback detection, including the burst-of-calls regression
test/backfill.test.js    injecting into tabs that were already open at install/startup
docs/BEST_PRACTICES.md   the standards this code is written against
docs/CONFORMANCE.md      those standards as checkable requirements + an audit log
docs/design.md           the popup's visual design brief, for iterating in Google Stitch
BACKLOG.md               ideas raised but not built yet
LICENSE                  MIT
```

## Logs

Every context logs as `[timestamp] [level] [scope] namespace:event { context }`. Read them in
the service worker console (`edge://extensions` → **service worker**), the page console for
the content script, and **Inspect popup** for the popup.

Verbosity is one switch — set `MT_LOG_LEVEL` before the logger loads, or call
`mtLogger.setLevel("debug" | "info" | "warn" | "error" | "silent")` from any console.
Conditions a poll can reach (a drifted selector, a dead message port) report once per
session rather than once a second.

## Checks

Type check — catches typos, wrong arity and misspelled properties before the browser does:

```bash
npx -y -p typescript@5 tsc --noEmit -p tsconfig.json
```

There is no build step and nothing is emitted. `tsconfig.json` turns on `checkJs`, every
file in `src/` opts in with `// @ts-check`, and the types come from JSDoc plus `types/`,
which hand-declares the slice of the extension platform this project uses. That keeps the
repo at zero dependencies — there is no `package.json` and no `node_modules`. VS Code reads
the same config, so the errors appear as you type.

## Tests

```bash
node test/background.test.js && node test/migration.test.js && node test/laps.test.js && node test/playback.test.js && node test/backfill.test.js
```

Runs the real `background.js` against a stubbed `chrome` API and a fake clock, covering
auto mode, sticky mode (including that a manual stop is not undone by still-playing music),
the playlist filter, dead tabs, multiple tabs, per-timer isolation and auto-switching
(including that it does not fight a manual override). The second checks that an upgrade from
the old single-timer layout keeps the time you had banked.

## Known limits

- Only the web players are supported. The Spotify desktop app cannot be seen by an extension.
- Muted playback still counts as playing.
- Upgrading from the single-timer version keeps your total but drops the partial run that
  was in progress at that moment - at most a few minutes.
- Site selectors (track titles, playlist names) can drift when these sites redesign; the
  timer itself keeps working because it relies on the media element, not on selectors.

## License

MIT — see [LICENSE](LICENSE).
