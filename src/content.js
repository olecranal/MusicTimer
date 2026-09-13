// @ts-check
/* Music Timer - content script.
 * Detects playback state + "what is playing from" on YouTube Music, Spotify and YouTube,
 * and reports it to the background service worker.
 *
 * Detection strategy:
 *   1. Primary signal: a <video>/<audio> element that is not paused AND whose currentTime
 *      is actually advancing (guards against buffering players reporting paused === false).
 *   2. Secondary signal: site-specific play/pause button state, used only when no media
 *      element is present yet (early page load).
 * Everything site-specific sits behind a small adapter so a drifted selector degrades to
 * "unknown" instead of throwing.
 */
(() => {
  "use strict";

  const log = mtLogger("content");
  mtLogger.installGlobalErrorHandlers("content");

  const HEARTBEAT_MS = 4000; // resend at least this often (background treats >12s as dead)
  const POLL_MS = 1000;      // how often we inspect the page
  const STALL_TICKS = 3;     // polls with no currentTime movement before we call it stopped

  const SITE = (() => {
    const h = location.hostname;
    if (h.includes("music.youtube.com")) return "ytmusic";
    if (h.includes("spotify.com")) return "spotify";
    return "youtube";
  })();

  const SITE_LABEL = { ytmusic: "YouTube Music", spotify: "Spotify", youtube: "YouTube" }[SITE];

  /* ---------------------------------------------------------------- helpers */

  const text = (sel, root = document) => {
    try {
      const el = root.querySelector(sel);
      if (!el) return null;
      const t = (el.getAttribute("title") || el.textContent || "").trim();
      return t || null;
    } catch (error) {
      // An invalid selector, not a missing element - that means this adapter's selector
      // list has drifted out of date and the site has changed under us.
      log.warnOnce(`selector:${sel}`, "adapter:selector-invalid", { site: SITE, selector: sel, error: String(error) });
      return null;
    }
  };

  /** First non-empty result from a list of selectors. */
  const firstText = (selectors, root = document) => {
    for (const sel of selectors) {
      const t = text(sel, root);
      if (t) return t;
    }
    return null;
  };

  const urlParam = (name) => {
    try {
      return new URLSearchParams(location.search).get(name);
    } catch (error) {
      log.warnOnce(`urlparam:${name}`, "adapter:url-parse-failed", {
        site: SITE,
        param: name,
        error: String(error),
      });
      return null;
    }
  };

  /* ------------------------------------------------------- playback signal */

  const progress = new WeakMap(); // media element -> { ct, stalledTicks }

  /** @returns {HTMLMediaElement | null} the playing element furthest along, if any */
  function activeMediaElement() {
    /** @type {HTMLMediaElement | null} */
    let best = null;
    const media = /** @type {NodeListOf<HTMLMediaElement>} */ (
      document.querySelectorAll("video, audio")
    );
    for (const el of media) {
      if (el.paused || el.ended) continue;
      if (el.readyState === 0) continue;
      // Prefer the element furthest along - avoids silent preload/ad elements.
      if (!best || el.currentTime > best.currentTime) best = el;
    }
    return best;
  }

  /** @returns {boolean | null} null means "no media element, cannot tell" */
  function mediaPlaying() {
    const el = activeMediaElement();
    if (!el) {
      // A media element that exists and is paused is a definitive "not playing".
      // Only a page with no media element at all is genuinely unknown - YouTube for
      // example leaves "playing-mode" on the player while the video is unstarted, so
      // the button fallback must never override a real element.
      return document.querySelector("video, audio") ? false : null;
    }
    const prev = progress.get(el);
    const ct = el.currentTime;
    if (prev && Math.abs(ct - prev.ct) < 0.01) {
      prev.stalledTicks += 1;
      prev.ct = ct;
      if (prev.stalledTicks >= STALL_TICKS) return false; // paused === false but frozen
    } else {
      progress.set(el, { ct, stalledTicks: 0 });
    }
    return true;
  }

  /* ---------------------------------------------------------- site adapters */

  const adapters = {
    ytmusic: {
      buttonPlaying() {
        const button = document.querySelector("#play-pause-button");
        if (!button) return null;
        const label = (button.getAttribute("title") || button.getAttribute("aria-label") || "").toLowerCase();
        if (!label) return null;
        return label.includes("pause"); // the button reads "Pause" while music plays
      },
      track() {
        return {
          title: firstText([
            "ytmusic-player-bar .title.ytmusic-player-bar",
            "ytmusic-player-bar .title",
            ".ytmusic-player-bar .title",
          ]),
          artist: firstText([
            "ytmusic-player-bar .byline.ytmusic-player-bar",
            "ytmusic-player-bar .byline",
            ".ytmusic-player-bar .subtitle",
          ]),
        };
      },
      context() {
        const list = urlParam("list");
        const name = firstText([
          "ytmusic-player-queue #header .title",
          "ytmusic-player-queue .queue-header .title",
          "ytmusic-player-page #header .title",
          ".queue-header-title",
        ]);
        if (!list && !name) return null;
        return {
          id: list ? "ytmusic:" + list : "ytmusic:name:" + name.toLowerCase(),
          name: name || "Playlist " + list,
          url: list ? "https://music.youtube.com/playlist?list=" + list : location.href,
          weak: !list,
        };
      },
    },

    youtube: {
      buttonPlaying() {
        const player = document.querySelector(".html5-video-player");
        if (!player) return null;
        // "unstarted-mode" can sit alongside "playing-mode" before the first play.
        if (player.classList.contains("unstarted-mode")) return false;
        if (player.classList.contains("playing-mode")) return true;
        if (player.classList.contains("paused-mode")) return false;
        return null;
      },
      track() {
        return {
          title: firstText([
            "h1.ytd-watch-metadata yt-formatted-string",
            "h1.title.ytd-video-primary-info-renderer",
            "#title h1",
          ]),
          artist: firstText(["#owner #channel-name a", "ytd-channel-name#channel-name a"]),
        };
      },
      context() {
        const list = urlParam("list");
        if (!list) return null;
        const name = firstText([
          "ytd-playlist-panel-renderer #playlist-title",
          "#playlist-title",
          "ytd-playlist-panel-renderer .title",
        ]);
        return {
          id: "youtube:" + list,
          name: name || "Playlist " + list,
          url: "https://www.youtube.com/playlist?list=" + list,
          weak: false,
        };
      },
    },

    spotify: {
      buttonPlaying() {
        const button = document.querySelector('[data-testid="control-button-playpause"]');
        if (!button) return null;
        const label = (button.getAttribute("aria-label") || button.getAttribute("title") || "").toLowerCase();
        if (label.includes("pause")) return true;
        if (label.includes("play")) return false;
        return null; // localized UI - fall back to the media element
      },
      track() {
        return {
          title: firstText([
            '[data-testid="context-item-info-title"]',
            '[data-testid="nowplaying-track-link"]',
            '[data-testid="now-playing-widget"] a[href^="/track/"]',
          ]),
          artist: firstText([
            '[data-testid="context-item-info-artist"]',
            '[data-testid="now-playing-widget"] a[href^="/artist/"]',
          ]),
        };
      },
      context() {
        // Strong signal: Spotify renders a link back to whatever the queue plays from.
        const strong = [
          'a[data-testid="context-link"]',
          '[data-testid="now-playing-widget"] a[href^="/playlist/"]',
          '[data-testid="track-info-context"] a',
        ];
        for (const sel of strong) {
          let a = null;
          try {
            a = document.querySelector(sel);
          } catch (error) {
            log.warnOnce(`selector:${sel}`, "adapter:selector-invalid", {
              site: "spotify",
              selector: sel,
              error: String(error),
            });
            a = null;
          }
          const href = a && a.getAttribute("href");
          if (href) {
            return {
              id: "spotify:" + href.replace(/^\//, ""),
              name: (a.getAttribute("aria-label") || a.textContent || "").trim() || href,
              url: "https://open.spotify.com" + href,
              weak: false,
            };
          }
        }
        // Weak signal: Spotify often keeps the context out of the DOM, so fall back to the
        // playlist page currently open. Flagged weak so the UI can say where it came from.
        const m = location.pathname.match(/^\/(playlist|album|artist|collection)\/?([^/]*)/);
        if (m) {
          const name =
            firstText(['[data-testid="entityTitle"] h1', 'h1[data-encore-id="text"]', "main h1"]) ||
            m[1] + " " + m[2];
          return {
            id: "spotify:" + m[1] + (m[2] ? "/" + m[2] : ""),
            name,
            url: location.origin + location.pathname,
            weak: true,
          };
        }
        return null;
      },
    },
  };

  const adapter = adapters[SITE];

  /* -------------------------------------------------------------- reporting */

  let lastSent = 0;
  let lastKey = "";
  let dead = false;

  /** @returns {PlaybackReport} */
  function snapshot() {
    let playing = mediaPlaying();
    if (playing === null) {
      try {
        playing = adapter.buttonPlaying();
      } catch (error) {
        log.warnOnce("adapter:button", "adapter:button-failed", { site: SITE, error: String(error) });
        playing = null;
      }
    }
    playing = playing === true;

    let track = { title: null, artist: null };
    let context = null;
    try {
      track = adapter.track() || track;
    } catch (error) {
      // Not fatal - the timer runs off the media element, not off these selectors. But a
      // permanent loss of track names is exactly the drift the README warns about, so say so.
      log.warnOnce("adapter:track", "adapter:track-failed", { site: SITE, error: String(error) });
    }
    try {
      context = adapter.context();
    } catch (error) {
      // Losing context silently would break playlist filtering with no visible cause.
      log.warnOnce("adapter:context", "adapter:context-failed", { site: SITE, error: String(error) });
    }

    if (playing && !context) {
      log.warnOnce("context:none-while-playing", "adapter:no-context-while-playing", {
        site: SITE,
        note: "playlist filtering cannot work on this page",
      });
    }

    return { site: SITE, siteLabel: SITE_LABEL, playing, track, context, url: location.href };
  }

  /** @param {PlaybackReport} state */
  function send(state) {
    try {
      chrome.runtime.sendMessage({ type: MT.MESSAGE.STATE, state }, () => {
        // Reading lastError is what suppresses the console warning, but discarding it
        // hides a worker that is failing to receive every report.
        const error = chrome.runtime.lastError;
        if (error) log.warnOnce("runtime:last-error", "runtime:last-error", { message: error.message });
      });
    } catch (error) {
      dead = true; // extension reloaded - stop touching the dead context
      log.warn("runtime:context-invalidated", { error: String(error) });
    }
  }

  /** @param {boolean} force send even if nothing changed since the last report */
  function report(force) {
    if (dead) return;
    const state = snapshot();
    const key = JSON.stringify(state);
    const now = Date.now();
    if (!force && key === lastKey && now - lastSent < HEARTBEAT_MS) return;
    if (lastKey && state.playing !== JSON.parse(lastKey).playing) {
      log.debug("playback:changed", { site: SITE, playing: state.playing });
    }
    lastKey = key;
    lastSent = now;
    send(state);
  }

  /* Load-bearing assumption: this is a main-thread interval, and Chrome throttles timers in
   * hidden tabs to roughly once a minute - far slower than the background's 12s staleness
   * cutoff. What saves us is that Chrome exempts tabs that are *playing audio* from that
   * throttling, which is precisely when the report matters. A backgrounded tab that is
   * muted may not qualify for the exemption; if reports go stale on muted playback, this
   * interval is the cause, and the fix is to move it into a Web Worker. */
  setInterval(() => report(false), POLL_MS);

  // React immediately to play/pause instead of waiting for the next poll.
  for (const evt of ["play", "pause", "ended"]) {
    document.addEventListener(evt, () => report(true), true);
  }
  window.addEventListener("pagehide", () => {
    if (!dead) send({ ...snapshot(), playing: false });
  });

  log.info("content:ready", { site: SITE, url: location.href });
  report(true);
})();
