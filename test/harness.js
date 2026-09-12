/* Runs src/background.js against a stubbed chrome API and a fake clock.
 * `seedLocal` pre-populates chrome.storage.local, which is how migrations get tested. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src", "background.js");

function createWorker({ seedLocal = {}, now = 1700000000000, manifest = {}, openTabs = [] } = {}) {
  let NOW = now;
  const listeners = { message: [], removed: [], alarm: [], startup: [], installed: [] };
  const local = JSON.parse(JSON.stringify(seedLocal));
  const session = {};
  const badge = {};
  const injections = []; // every chrome.scripting.executeScript call, for backfill tests

  const area = (store) => ({
    async get(key) {
      return key in store ? { [key]: JSON.parse(JSON.stringify(store[key])) } : {};
    },
    async set(obj) {
      Object.assign(store, JSON.parse(JSON.stringify(obj)));
    },
  });

  const chrome = {
    storage: { local: area(local), session: area(session) },
    action: {
      async setBadgeText(o) { badge.text = o.text; },
      async setBadgeBackgroundColor(o) { badge.color = o.color; },
    },
    runtime: {
      onMessage: { addListener: (f) => listeners.message.push(f) },
      onStartup: { addListener: (f) => listeners.startup.push(f) },
      onInstalled: { addListener: (f) => listeners.installed.push(f) },
      getManifest: () => manifest,
    },
    tabs: {
      onRemoved: { addListener: (f) => listeners.removed.push(f) },
      // Real tabs.query filters by matching against each tab's URL; a plain "does this
      // pattern list include this tab" is close enough for what the tests need.
      query: async ({ url: patterns } = {}) =>
        openTabs.filter(
          (tab) => !patterns || patterns.some((p) => new RegExp("^" + p.replace(/\*/g, ".*") + "$").test(tab.url))
        ),
    },
    scripting: {
      executeScript: async (call) => {
        injections.push(call);
      },
    },
    alarms: { create: () => {}, onAlarm: { addListener: (f) => listeners.alarm.push(f) } },
  };

  const ctx = vm.createContext({
    chrome,
    console,
    Date: new Proxy(Date, { get: (t, p) => (p === "now" ? () => NOW : Reflect.get(t, p)) }),
    JSON, Math, Object, Number, Boolean, String, Promise, Infinity, Set, Array,
    // The worker pulls in src/shared/* the way a real MV3 service worker does. Paths are
    // extension-root-absolute, so resolve them against the project root.
    importScripts: (...paths) => {
      for (const p of paths) {
        const file = path.join(ROOT, p.replace(/^\//, ""));
        vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: path.basename(file) });
      }
    },
    // Keep test output readable: real problems still surface, routine transitions do not.
    MT_LOG_LEVEL: "error",
  });
  vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx, { filename: "background.js" });

  const msg = (message, sender = {}) =>
    new Promise((resolve) => {
      for (const f of listeners.message) {
        if (f(message, sender, resolve) === true) return;
      }
      resolve(null);
    });

  return {
    badge,
    listeners,
    injections,
    msg,
    report: (tabId, state) =>
      msg(
        { type: "mt:state", state: { site: "ytmusic", siteLabel: "YouTube Music", track: {}, ...state } },
        { tab: { id: tabId } }
      ),
    get: () => msg({ type: "mt:get" }),
    cmd: (action, extra = {}) => msg({ type: "mt:command", action, ...extra }),
    advance: (ms) => { NOW += ms; },
    closeTab: (id) => listeners.removed[0](id),
    restart: () => Promise.all(listeners.startup.map((f) => f())),
    install: () => Promise.all(listeners.installed.map((f) => f())),
  };
}

/* Shared assertion helper. */
const results = { failures: 0 };
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) results.failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`)
  );
}
function finish() {
  console.log(`\n${results.failures === 0 ? "ALL PASS" : results.failures + " FAILURE(S)"}`);
  process.exit(results.failures ? 1 : 0);
}

module.exports = { createWorker, check, finish, results };
