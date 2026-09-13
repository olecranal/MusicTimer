// @ts-check
/* Music Timer - structured logger, shared by all three execution contexts.
 *
 * A classic script on purpose: the service worker pulls it in with importScripts(), the
 * content script gets it from the manifest's js array, and the popup from a <script> tag.
 * None of those three can agree on ES modules without also breaking the vm-based test
 * harness, so the module hands itself over on globalThis instead.
 *
 * Call sites look like:  log.warn("adapter:track-failed", { site, error: String(err) })
 * The event string is a stable identifier so the console can be filtered by prefix; the
 * varying detail belongs in the context object, never interpolated into the string.
 */
"use strict";

(() => {
  const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };
  const CONSOLE_METHOD = { debug: "log", info: "info", warn: "warn", error: "error" };

  // Conditions that repeat every poll (a drifted selector, a dead port) would otherwise
  // emit once a second forever. Keys seen here have already been reported.
  const seenOnce = {};

  let threshold = LEVELS[globalThis.MT_LOG_LEVEL] || LEVELS.debug;

  function emit(scope, level, event, context) {
    if (LEVELS[level] < threshold) return;
    const line = `[${new Date().toISOString()}] [${level}] [${scope}] ${event}`;
    if (context === undefined) console[CONSOLE_METHOD[level]](line);
    else console[CONSOLE_METHOD[level]](line, context);
  }

  /**
   * @param {string} scope - which context this logger belongs to ("background", "content",
   *   "popup"), so a console shared with the host page stays readable.
   */
  function mtLogger(scope) {
    return {
      debug: (event, context) => emit(scope, "debug", event, context),
      info: (event, context) => emit(scope, "info", event, context),
      warn: (event, context) => emit(scope, "warn", event, context),
      error: (event, context) => emit(scope, "error", event, context),

      /** Report a persistent condition once per key, for paths a poll can reach. */
      warnOnce(key, event, context) {
        if (seenOnce[key]) return;
        seenOnce[key] = true;
        emit(scope, "warn", event, { ...context, note: "reported once per session" });
      },
    };
  }

  mtLogger.setLevel = (level) => {
    if (level in LEVELS) threshold = LEVELS[level];
  };

  /**
   * Catches what never reached a try/catch. Guarded because the test harness runs the
   * worker in a bare vm context with no event-target plumbing.
   */
  mtLogger.installGlobalErrorHandlers = (scope) => {
    if (typeof globalThis.addEventListener !== "function") return;
    const log = mtLogger(scope);
    globalThis.addEventListener("error", (event) => {
      log.error("uncaught-error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
      });
    });
    globalThis.addEventListener("unhandledrejection", (event) => {
      log.error("unhandled-rejection", { reason: String(event.reason) });
    });
  };

  globalThis.mtLogger = mtLogger;
})();
