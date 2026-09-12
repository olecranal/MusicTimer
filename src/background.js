/* Music Timer - background service worker.
 *
 * Owns every timer's clock. MV3 workers get killed at will, so no wall-clock ticking
 * lives here: a timer is stored as { accumulatedMs, runningSince } and elapsed time is
 * always derived from timestamps. Tab reports live in storage.session so they survive a
 * worker restart but not a browser restart (a dead tab should not keep a timer running).
 *
 * Several timers can exist side by side ("Work", "Gaming", ...) but only the active one
 * counts. A timer bound to a playlist claims the active slot when that playlist starts -
 * see claimActive() for the rule that keeps auto-switching from fighting the user.
 */
"use strict";

importScripts("/src/shared/logger.js", "/src/shared/contract.js");

const log = mtLogger("background");
mtLogger.installGlobalErrorHandlers("background");

const STATE_KEY = "mt.state";
const SOURCES_KEY = "mt.sources";
const STALE_MS = 12000; // a tab that has not reported in this long is assumed gone
const TICK_ALARM = "mt.tick";
const TICK_PERIOD_MINUTES = 0.5;

const newTimer = (name) => ({
  id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  name,
  mode: "auto", // "auto" = follows playback | "sticky" = starts on music, stops only by hand
  filter: null, // null = any music counts | { id, name, site, weak }
  running: false,
  runningSince: null,
  accumulatedMs: 0,
  armed: false, // sticky: music has started the clock
  rearmBlocked: false, // sticky: stopped by hand; wait for silence before re-arming
  daily: {}, // "YYYY-MM-DD" -> ms committed that day
  lastActive: null, // last thing counted: { siteLabel, title, artist, contextName }
  laps: [], // closed laps: { id, name, startMs, endMs } as offsets into elapsed time
  lapStartMs: 0, // elapsed offset where the lap in progress began
});

const MAX_NAME_LENGTH = 40;

/** Laps are offsets into elapsed time, so they survive pauses and never depend on wall clock. */
const lapDefaultName = (timer) => `${timer.name} - lap ${timer.laps.length + 1}`;

/* ------------------------------------------------------------------ storage */

/** Applies defaults and migrations so the rest of the worker can assume a valid shape. */
function normalize(raw) {
  const state = raw && raw.timers ? { ...raw } : { version: 2, activeId: null, order: [], timers: {} };

  // v1 kept a single unnamed timer at the top level - carry its time into a real timer.
  if (raw && !raw.timers && typeof raw.accumulatedMs === "number") {
    const t = newTimer("My timer");
    Object.assign(t, {
      mode: raw.mode || "auto",
      filter: raw.filter || null,
      accumulatedMs: raw.accumulatedMs,
      daily: raw.daily || {},
      lastActive: raw.lastActive || null,
    });
    state.timers = { [t.id]: t };
    state.order = [t.id];
    state.activeId = t.id;
    log.info("state:migrated-from-v1", { accumulatedMs: raw.accumulatedMs });
  }

  if (state.order.length === 0) {
    const t = newTimer("Timer 1");
    state.timers[t.id] = t;
    state.order = [t.id];
    state.activeId = t.id;
    log.info("state:created-first-timer", { id: t.id });
  }
  if (!state.timers[state.activeId]) {
    log.warn("state:active-id-missing", { activeId: state.activeId, fallback: state.order[0] });
    state.activeId = state.order[0];
  }

  // Timers stored before laps existed have neither field; give them an empty lap history
  // rather than letting `undefined` reach the arithmetic below.
  for (const id of state.order) {
    const timer = state.timers[id];
    if (!Array.isArray(timer.laps)) timer.laps = [];
    if (typeof timer.lapStartMs !== "number") timer.lapStartMs = 0;
  }
  state.version = 2;
  return state;
}

async function getState() {
  const got = await chrome.storage.local.get(STATE_KEY);
  return normalize(got[STATE_KEY]);
}

function putState(state) {
  return chrome.storage.local.set({ [STATE_KEY]: state });
}

async function getSources() {
  const got = await chrome.storage.session.get(SOURCES_KEY);
  return got[SOURCES_KEY] || {};
}

function putSources(sources) {
  return chrome.storage.session.set({ [SOURCES_KEY]: sources });
}

/* -------------------------------------------------------------------- clock */

const today = () => new Date().toISOString().slice(0, 10);

function elapsedMs(t) {
  return t.accumulatedMs + (t.running && t.runningSince ? Date.now() - t.runningSince : 0);
}

function todayMs(t) {
  const live = t.running && t.runningSince ? Date.now() - t.runningSince : 0;
  return (t.daily[today()] || 0) + live;
}

function startClock(t) {
  if (t.running) return; // already counting - not a transition, nothing to report
  t.running = true;
  t.runningSince = Date.now();
  log.info("clock:start", { timerId: t.id, name: t.name, accumulatedMs: t.accumulatedMs });
}

/** Stop the clock, optionally backdating to `at` (used when a tab dies silently). */
function stopClock(t, at = Date.now()) {
  if (!t.running) return; // already stopped - not a transition
  const delta = Math.max(0, at - t.runningSince);
  t.accumulatedMs += delta;
  t.daily[today()] = (t.daily[today()] || 0) + delta;
  t.running = false;
  t.runningSince = null;
  log.info("clock:stop", { timerId: t.id, name: t.name, bankedMs: delta, totalMs: t.accumulatedMs });
}

/* ------------------------------------------------------------------ matching */

function matchesFilter(filter, context) {
  if (!filter) return true; // no filter: any music counts
  if (!context) return false;
  if (context.id && filter.id && context.id === filter.id) return true;
  // Fall back to comparing names - covers sites that expose no stable id.
  const a = (context.name || "").trim().toLowerCase();
  const b = (filter.name || "").trim().toLowerCase();
  return Boolean(a) && a === b;
}

/** The first playing source that a timer's filter accepts, if any. */
function matchFor(timer, playing) {
  return playing.find((s) => matchesFilter(timer.filter, s.context)) || null;
}

/**
 * A timer bound to a playlist takes over when that playlist starts playing.
 *
 * `lastClaim` records the playlist that most recently decided the active timer, whether
 * the decision was automatic or the user's. While that playlist is still playing we do
 * not re-decide - otherwise manually switching away from an auto-claimed timer would be
 * undone on the next tick. It clears the moment that playlist stops, so starting it again
 * later claims again.
 */
function claimActive(state, playing) {
  const playingContextIds = new Set(playing.map((s) => s.context?.id).filter(Boolean));
  if (state.lastClaim && !playingContextIds.has(state.lastClaim.contextId)) state.lastClaim = null;

  for (const id of state.order) {
    const timer = state.timers[id];
    if (!timer.filter) continue; // unbound timers never claim
    const match = matchFor(timer, playing);
    if (!match) continue;
    const contextId = match.context?.id || null;
    if (id === state.activeId) {
      state.lastClaim = { timerId: id, contextId };
      return;
    }
    // Already decided for this playlist (e.g. the user overrode it) - leave it alone.
    if (state.lastClaim && state.lastClaim.contextId === contextId) return;

    log.info("active:auto-claim", {
      from: state.timers[state.activeId].name,
      to: timer.name,
      contextId,
    });
    stopClock(state.timers[state.activeId]); // bank the outgoing timer, keep it armed
    state.activeId = id;
    state.lastClaim = { timerId: id, contextId };
    return;
  }
}

/* --------------------------------------------------------------- evaluation */

/** Recompute which timer is active and whether its clock should run. */
async function evaluate() {
  const state = await getState();
  const sources = await getSources();
  const now = Date.now();

  let sourcesChanged = false;
  let staleCutoff = null;
  const live = [];

  for (const [tabId, src] of Object.entries(sources)) {
    if (now - src.updatedAt > STALE_MS) {
      // The tab went quiet (crash, discard, extension reload). We cannot know when it
      // really died, so credit it up to the point where we declared it dead and no
      // further - bounded overcount, and the timer never ticks backwards on screen.
      const cutoff = Math.min(now, src.updatedAt + STALE_MS);
      staleCutoff = staleCutoff === null ? cutoff : Math.max(staleCutoff, cutoff);
      log.warn("source:stale", {
        tabId,
        siteLabel: src.siteLabel,
        wasPlaying: src.playing,
        silentForMs: now - src.updatedAt,
      });
      delete sources[tabId];
      sourcesChanged = true;
      continue;
    }
    live.push(src);
  }
  if (sourcesChanged) await putSources(sources);

  const playing = live.filter((s) => s.playing);
  claimActive(state, playing);

  const timer = state.timers[state.activeId];
  for (const id of state.order) if (id !== state.activeId) stopClock(state.timers[id]);

  const match = matchFor(timer, playing);
  const eligible = Boolean(match);

  if (eligible) {
    timer.lastActive = {
      siteLabel: match.siteLabel,
      title: match.track?.title || null,
      artist: match.track?.artist || null,
      contextName: match.context?.name || null,
    };
  }

  if (timer.mode === "auto") {
    if (eligible) startClock(timer);
    else if (staleCutoff !== null && timer.running) stopClock(timer, staleCutoff);
    else stopClock(timer);
  } else {
    // Sticky: music arms the clock, only the user disarms it.
    if (!eligible) timer.rearmBlocked = false; // silence clears the manual-stop latch
    if (eligible && !timer.armed && !timer.rearmBlocked) timer.armed = true;
    if (timer.armed) startClock(timer);
    else stopClock(timer);
  }

  state.anyPlaying = playing.length > 0;
  state.eligible = eligible;

  await putState(state);
  await updateBadge(timer);
  return state;
}

/* ------------------------------------------------------------------- badge */

function formatBadge(ms) {
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? String(mins) : Math.floor(mins / 60) + "h";
}

async function updateBadge(timer) {
  const ms = elapsedMs(timer);
  await chrome.action.setBadgeText({ text: ms >= 60000 ? formatBadge(ms) : timer.running ? "▶" : "" });
  await chrome.action.setBadgeBackgroundColor({ color: timer.running ? "#1db954" : "#5f6368" });
}

/* ----------------------------------------------------------------- commands */

/** Switch the active timer, banking whatever the outgoing one had counted. */
function setActive(state, id, playing) {
  if (!state.timers[id] || id === state.activeId) return;
  log.info("active:manual-select", {
    from: state.timers[state.activeId].name,
    to: state.timers[id].name,
  });
  stopClock(state.timers[state.activeId]);
  state.activeId = id;
  // Record the playlist currently deciding things so auto-switch does not immediately
  // undo this choice; it will claim again once that playlist stops and restarts.
  const claimant = state.order
    .map((tid) => state.timers[tid])
    .find((t) => t.filter && matchFor(t, playing));
  state.lastClaim = claimant ? { timerId: id, contextId: matchFor(claimant, playing).context?.id || null } : null;
}

async function command(msg) {
  const state = await getState();
  const sources = await getSources();
  const now = Date.now();
  const playing = Object.values(sources).filter((s) => s.playing && now - s.updatedAt <= STALE_MS);
  const timer = state.timers[state.activeId];

  log.debug("command:received", { action: msg.action });

  switch (msg.action) {
    case MT.ACTION.START:
      timer.armed = true;
      timer.rearmBlocked = false;
      startClock(timer);
      break;

    case MT.ACTION.STOP:
      stopClock(timer);
      timer.armed = false;
      // In sticky mode, do not let still-playing music immediately restart the clock.
      timer.rearmBlocked = true;
      break;

    case MT.ACTION.RESET:
      stopClock(timer);
      timer.accumulatedMs = 0;
      timer.armed = false;
      timer.rearmBlocked = true;
      // Laps are offsets into a total that no longer exists, so they go with it.
      timer.laps = [];
      timer.lapStartMs = 0;
      break;

    case MT.ACTION.LAP: {
      // Close the lap in progress at wherever the clock stands and open the next one.
      // A stopwatch lets you lap while paused; that just records a zero-length lap.
      const at = elapsedMs(timer);
      const lap = {
        id: "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: lapDefaultName(timer),
        startMs: timer.lapStartMs,
        endMs: at,
      };
      timer.laps.push(lap);
      timer.lapStartMs = at;
      log.info("lap:recorded", { timerId: timer.id, name: lap.name, durationMs: lap.endMs - lap.startMs });
      break;
    }

    case MT.ACTION.RENAME_LAP: {
      const lap = timer.laps.find((l) => l.id === msg.id);
      if (!lap) {
        log.warn("lap:rename-missing", { timerId: timer.id, lapId: msg.id });
        break;
      }
      const name = (msg.name || "").trim();
      if (name) lap.name = name.slice(0, MAX_NAME_LENGTH);
      break;
    }

    case MT.ACTION.SET_MODE:
      if (msg.mode === "auto" || msg.mode === "sticky") {
        timer.mode = msg.mode;
        if (msg.mode === "auto") {
          timer.armed = false;
          timer.rearmBlocked = false;
        } else if (timer.running) {
          timer.armed = true; // keep a running clock running across the switch
        }
      } else {
        log.warn("command:bad-mode", { mode: msg.mode });
      }
      break;

    case MT.ACTION.SET_FILTER:
      timer.filter = msg.filter || null;
      state.lastClaim = null; // let the new binding take effect immediately
      log.info("filter:set", { timerId: timer.id, filter: timer.filter?.name || null });
      break;

    case MT.ACTION.CLEAR_FILTER:
      timer.filter = null;
      break;

    case MT.ACTION.SELECT_TIMER:
      setActive(state, msg.id, playing);
      break;

    case MT.ACTION.ADD_TIMER: {
      const t = newTimer((msg.name || "").trim() || "Timer " + (state.order.length + 1));
      state.timers[t.id] = t;
      state.order.push(t.id);
      setActive(state, t.id, playing);
      break;
    }

    case MT.ACTION.RENAME_TIMER: {
      const t = state.timers[msg.id] || timer;
      const name = (msg.name || "").trim();
      if (name) t.name = name.slice(0, MAX_NAME_LENGTH);
      break;
    }

    case MT.ACTION.DELETE_TIMER: {
      if (state.order.length <= 1) break; // always keep one timer
      const id = msg.id || state.activeId;
      if (!state.timers[id]) break;
      stopClock(state.timers[id]);
      const at = state.order.indexOf(id);
      state.order.splice(at, 1);
      delete state.timers[id];
      if (state.activeId === id) {
        state.activeId = state.order[Math.max(0, at - 1)];
        state.lastClaim = null;
      }
      log.info("timer:deleted", { timerId: id, remaining: state.order.length });
      break;
    }

    default:
      // An action the popup sent that this worker does not know. Silently ignoring it made
      // a typo look like a working no-op, so it is loud now.
      log.warn("command:unknown-action", { action: msg.action });
      break;
  }

  await putState(state);
  return evaluate();
}

/** Best context to offer as a playlist binding: prefer what is playing right now. */
async function candidateContext() {
  const sources = await getSources();
  const list = Object.values(sources)
    .filter((s) => s.context)
    .sort((a, b) => Number(b.playing) - Number(a.playing) || b.updatedAt - a.updatedAt);
  const src = list[0];
  return src ? { ...src.context, site: src.site, siteLabel: src.siteLabel } : null;
}

/** Everything the popup needs, in one round trip. */
async function snapshotForPopup() {
  const state = await evaluate();
  const sources = await getSources();
  const timer = state.timers[state.activeId];
  return {
    activeId: state.activeId,
    timers: state.order.map((id) => {
      const t = state.timers[id];
      return {
        id,
        name: t.name,
        elapsedMs: elapsedMs(t),
        running: t.running,
        filterName: t.filter?.name || null,
      };
    }),
    name: timer.name,
    mode: timer.mode,
    filter: timer.filter,
    running: timer.running,
    elapsedMs: elapsedMs(timer),
    todayMs: todayMs(timer),
    // Newest first: the lap you just took is the one you want to read or rename.
    laps: timer.laps
      .map((lap) => ({ id: lap.id, name: lap.name, durationMs: Math.max(0, lap.endMs - lap.startMs) }))
      .reverse(),
    currentLap: {
      name: lapDefaultName(timer),
      // The popup adds its own live offset on top, the same way it does for the clock.
      durationMs: Math.max(0, elapsedMs(timer) - timer.lapStartMs),
    },
    anyPlaying: Boolean(state.anyPlaying),
    eligible: Boolean(state.eligible),
    lastActive: timer.lastActive,
    candidate: await candidateContext(),
    tabs: Object.values(sources).map((s) => ({
      siteLabel: s.siteLabel,
      playing: s.playing,
      title: s.track?.title || null,
      contextName: s.context?.name || null,
      contextWeak: Boolean(s.context?.weak),
    })),
  };
}

/* ------------------------------------------------------------------- wiring */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === MT.MESSAGE.STATE && sender.tab?.id != null) {
    (async () => {
      const sources = await getSources();
      sources[sender.tab.id] = { ...msg.state, updatedAt: Date.now() };
      await putSources(sources);
      await evaluate();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg?.type === MT.MESSAGE.GET) {
    snapshotForPopup().then(sendResponse);
    return true;
  }

  if (msg?.type === MT.MESSAGE.COMMAND) {
    command(msg).then(() => snapshotForPopup().then(sendResponse));
    return true;
  }

  log.warn("message:unknown-type", { type: msg?.type, fromTab: sender.tab?.id ?? null });
  return false;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const sources = await getSources();
  if (sources[tabId]) {
    log.debug("source:tab-closed", { tabId });
    delete sources[tabId];
    await putSources(sources);
    await evaluate();
  }
});

// Safety net: catches tabs that died without a pagehide and keeps the badge fresh.
chrome.alarms.create(TICK_ALARM, { periodInMinutes: TICK_PERIOD_MINUTES });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) evaluate();
});

/**
 * Chrome only auto-injects a manifest-declared content script into tabs that load *after*
 * the extension does. A tab the user already had open when they installed or reloaded the
 * extension never gets it - not on focus, not on becoming active, only on an actual
 * navigation or refresh. That silent gap is exactly what "the timer doesn't see a tab I
 * already had open" looks like from the outside, so back-fill it ourselves.
 *
 * Reads the file list and match patterns from the manifest itself rather than repeating
 * them here, so the two can never drift apart the way the message-contract strings used to
 * (see the note at the top of shared/contract.js for that history).
 */
async function backfillExistingTabs() {
  const entry = chrome.runtime.getManifest().content_scripts?.[0];
  if (!entry) {
    log.warn("inject:no-manifest-entry", {});
    return;
  }

  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: entry.matches });
  } catch (error) {
    log.warn("inject:tabs-query-failed", { error: String(error) });
    return;
  }

  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: entry.js });
      log.info("inject:backfilled", { tabId: tab.id, url: tab.url });
    } catch (error) {
      // Expected for a tab that navigated away mid-loop, or one Chrome refuses injection
      // into for reasons outside our control. Not worth alarming over per tab.
      log.warnOnce(`inject:${tab.id}`, "inject:backfill-failed", { tabId: tab.id, error: String(error) });
    }
  }
}

chrome.runtime.onStartup.addListener(async () => {
  // A browser restart means nothing is playing yet - bank any in-flight time.
  log.info("worker:startup", {});
  const state = await getState();
  for (const id of state.order) {
    stopClock(state.timers[id]);
    state.timers[id].armed = false;
  }
  state.lastClaim = null;
  await putState(state);
  await putSources({});
  await updateBadge(state.timers[state.activeId]);
  await backfillExistingTabs();
});

chrome.runtime.onInstalled.addListener(async () => {
  // This is the common case: the user reloads the extension from edge://extensions with a
  // music tab already open, then wonders why nothing is happening in it.
  log.info("worker:installed", {});
  await backfillExistingTabs();
  await evaluate();
});
