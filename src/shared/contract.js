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
    },

    /** Every `action` the worker's command() accepts. */
    ACTION: {
      START: "start",
      STOP: "stop",
      RESET: "reset",
      SET_MODE: "setMode",
      SET_FILTER: "setFilter",
      CLEAR_FILTER: "clearFilter",
      SELECT_TIMER: "selectTimer",
      ADD_TIMER: "addTimer",
      RENAME_TIMER: "renameTimer",
      DELETE_TIMER: "deleteTimer",
    },
  };
})();
