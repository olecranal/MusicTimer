# Known Bugs

Confirmed problems, not yet fixed. Unlike `BACKLOG.md` (ideas not yet built), everything
here is existing behavior that's wrong. Numbered so a fix can reference "bug #N" in its
commit message and mark it done here.

## 1. Back-navigating to a playlist can leave the timer bound to what's no longer playing

**Reported:** 2026-09-16, on YouTube.

**Steps:**
1. Play playlist A.
2. Start a different playlist, B.
3. Navigate back two pages (browser back button) to playlist A.

**Observed:** YouTube keeps playing playlist B in the background, but the tab's URL/page now
shows playlist A again (a `history.pushState`-style SPA navigation, not a real page load).
Music Timer kept counting as if playlist A were still playing, because the timer bound to A
matched what the content script reported.

**Suspected cause:** `src/content.js`'s YouTube adapter (`adapters.youtube.context()`) reads
the current playlist purely from the `list=` URL parameter — it never checks that the URL
actually corresponds to what the `<video>` element is playing. Back/forward navigation can
change the URL without the player's actual source changing to match, so the reported context
goes stale. The YouTube Music adapter's `context()` has the same `urlParam("list")`
dependency and is presumably vulnerable the same way, untested.

**Reported specifically on an auto-generated playlist** (a YouTube "Mix"/radio-style
playlist, not one the user created) — not yet confirmed either way on a real, user-created
playlist. Worth checking whether auto-generated playlists behave differently here (e.g. an
unstable or regenerated `list=` id) before assuming this affects both equally.

**Not fixed yet.**
