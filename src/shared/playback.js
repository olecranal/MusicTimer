// @ts-check
/* Music Timer - "is this page actually playing audio?"
 *
 * Pulled out of content.js so it can be tested without a browser: it touches only the
 * media-element properties it reads, never the DOM or chrome APIs.
 *
 * The subtle part is the stall check. `paused === false` is not enough - a buffering or
 * wedged player reports exactly that while sitting still - so we also require currentTime
 * to advance. But "did it advance?" is only a meaningful question across real elapsed
 * time. The detector is called from the 1s poll AND from play/pause events, so several
 * calls can land in the same millisecond (a track change fires pause+play right next to a
 * poll). Counting those as stalls reported "not playing" over music that was playing fine,
 * which is the bug this file exists to prevent: progress is only judged once per window,
 * and calls in between repeat the standing verdict.
 *
 * Classic script rather than a module for the same reason as logger.js - see that file.
 */
"use strict";

(() => {
  const STALL_WINDOW_MS = 900; // minimum real time between two progress judgements
  const STALL_STRIKES = 3; // consecutive windows with no progress before we call it stopped
  const PROGRESS_EPSILON_SECONDS = 0.01; // below this, currentTime has not meaningfully moved

  /**
   * The element that is actually producing sound, or null.
   * Furthest-along wins, which skips the silent preload/ad elements these sites keep around.
   * @param {HTMLMediaElement[]} elements
   * @returns {HTMLMediaElement | null}
   */
  function activeMediaElement(elements) {
    /** @type {HTMLMediaElement | null} */
    let best = null;
    for (const element of elements) {
      if (element.paused || element.ended) continue;
      if (element.readyState === 0) continue;
      if (!best || element.currentTime > best.currentTime) best = element;
    }
    return best;
  }

  /**
   * @param {{ now?: () => number }} [options] - `now` is injectable so tests can drive a clock.
   * @returns {MtPlaybackDetector}
   */
  function createPlaybackDetector({ now = () => Date.now() } = {}) {
    /** @type {WeakMap<HTMLMediaElement, { currentTime: number, at: number, strikes: number }>} */
    const observations = new WeakMap();

    /**
     * @param {Iterable<HTMLMediaElement>} elements
     * @returns {boolean | null}
     */
    function detect(elements) {
      const list = Array.from(elements);
      const element = activeMediaElement(list);

      if (!element) {
        // A media element that exists and is paused is a definitive "not playing". Only a
        // page with no media element at all is genuinely unknown - YouTube leaves
        // "playing-mode" on its player while unstarted, so a real element must always win.
        return list.length > 0 ? false : null;
      }

      const at = now();
      const seen = observations.get(element);

      if (!seen) {
        observations.set(element, { currentTime: element.currentTime, at, strikes: 0 });
        return true;
      }

      // Too soon to tell whether it moved; repeat the standing verdict rather than
      // charging this call as a stall.
      if (at - seen.at < STALL_WINDOW_MS) return seen.strikes < STALL_STRIKES;

      const advanced = Math.abs(element.currentTime - seen.currentTime) >= PROGRESS_EPSILON_SECONDS;
      seen.strikes = advanced ? 0 : seen.strikes + 1;
      seen.currentTime = element.currentTime;
      seen.at = at;
      return seen.strikes < STALL_STRIKES;
    }

    return { detect };
  }

  globalThis.MTPlayback = { createPlaybackDetector, STALL_WINDOW_MS, STALL_STRIKES };
})();
