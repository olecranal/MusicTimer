// @ts-check
/* Music Timer - the message contract between content script, popup and worker.
 *
 * These strings crossed three files as raw literals, which meant a typo in a command name
 * landed in the worker's default branch and did nothing, silently. Naming them here gives
 * one place to read the protocol and makes a typo a ReferenceError instead of a no-op.
 *
 * Classic script for the same reason as logger.js - see the note at the top of that file.
 */
"use strict";

(() => {
  globalThis.MT = {
    /** Message envelope types. */
    MESSAGE: {
      STATE: "mt:state", // content script -> worker, a playback report
      GET: "mt:get", // popup -> worker, fetch a snapshot
      COMMAND: "mt:command", // popup -> worker, mutate then snapshot
      SETTINGS: "mt:settings", // popup -> worker, fetch one timer's full editable settings
    },

    /** Every `action` the worker's command() accepts. */
    ACTION: {
      START: "start",
      STOP: "stop",
      RESET: "reset",
      SELECT_TIMER: "selectTimer",
      ADD_TIMER: "addTimer",
      RENAME_TIMER: "renameTimer",
      DELETE_TIMER: "deleteTimer",
      LAP: "lap",
      RENAME_LAP: "renameLap",
      // Settings are a staged draft on their own page now - one save writes the whole
      // form for one timer at once, rather than each control round-tripping on its own
      // (that's what SET_MODE/SET_FILTER/CLEAR_FILTER used to do; this replaces all three).
      SAVE_TIMER_SETTINGS: "saveTimerSettings",
    },

    /** The three ways a timer can decide what counts as "its" music. */
    FILTER_MODE: {
      CURRENT: "current", // locked to whatever was playing when you picked "Use current"
      ANY: "any", // no filter - any music counts
      SPECIFIC: "specific", // an explicit list; matches if any one of them is playing
    },
  };
})();
