// @ts-check
/* Music Timer - popup UI.
 *
 * Owns no truth of its own: every action round-trips to the worker, which answers with a
 * fresh snapshot. The one exception is the local tick, which interpolates between syncs so
 * the clock looks smooth without hammering the worker once a frame.
 */
"use strict";

const log = mtLogger("popup");
mtLogger.installGlobalErrorHandlers("popup");

const LOCAL_TICK_MS = 250; // repaint cadence between syncs
const SYNC_INTERVAL_MS = 2000; // how often we ask the worker for the truth
const MAX_TIMER_NAME_LENGTH = 40;

/* Looked up once: render() runs four times a second and these never move. */
const elements = {
  dot: document.getElementById("dot"),
  activeName: document.getElementById("activeName"),
  today: document.getElementById("today"),
  clock: document.getElementById("clock"),
  status: document.getElementById("status"),
  settingsToggle: /** @type {HTMLButtonElement} */ (document.getElementById("settingsToggle")),
  settingsPanel: document.getElementById("settingsPanel"),
  lap: document.getElementById("lap"),
  toggle: document.getElementById("toggle"),
  reset: document.getElementById("reset"),
  lapSection: document.getElementById("lapSection"),
  laps: document.getElementById("laps"),
  timers: document.getElementById("timers"),
  addTimer: document.getElementById("addTimer"),
  renameTimer: document.getElementById("renameTimer"),
  deleteTimer: /** @type {HTMLButtonElement} */ (document.getElementById("deleteTimer")),
  mode: document.getElementById("mode"),
  modeHint: document.getElementById("modeHint"),
  filterName: document.getElementById("filterName"),
  filterSub: document.getElementById("filterSub"),
  useCurrent: document.getElementById("useCurrent"),
  clearFilter: document.getElementById("clearFilter"),
  tabs: document.getElementById("tabs"),
};

/** @type {PopupSnapshot | null} */
let snapshot = null;
let lastSyncAt = 0;
/** @type {string | null} timer whose name is being edited inline */
let editingId = null;
/** @type {string | null} lap whose name is being edited inline */
let editingLapId = null;
let isConfirmingDelete = false;
/** Purely local UI state - the worker has no notion of whether this panel is open. */
let settingsOpen = false;

/** True while an inline name field is open; a background sync would destroy it. */
const isEditing = () => Boolean(editingId || editingLapId);

/* ---------------------------------------------------------------- formatting */

/**
 * Elapsed time as H:MM:SS, for the big readout and the per-timer rows.
 * @param {number} ms
 * @returns {string}
 */
function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Rounded "42m" / "2h 05m", for the day total where seconds are noise.
 * @param {number} ms
 * @returns {string}
 */
function formatCompact(ms) {
  const minutes = Math.round(ms / 60000);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/* ----------------------------------------------------------------- transport */

/**
 * @param {{ type: string, [key: string]: any }} message
 * @returns {Promise<PopupSnapshot | undefined>}
 */
function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

/**
 * @param {string} action one of MT.ACTION.*
 * @param {Record<string, any>} [extra]
 */
function command(action, extra = {}) {
  return sync({ type: MT.MESSAGE.COMMAND, action, ...extra });
}

/* -------------------------------------------------------------------- render */

/** @returns {string} */
function statusLine() {
  if (!snapshot) return "…";
  const active = snapshot.lastActive;
  if (snapshot.eligible && active) {
    const what = [active.title, active.artist].filter(Boolean).join(" — ") || "Music";
    return `${what}${active.contextName ? `\nfrom ${active.contextName}` : ""}`;
  }
  if (snapshot.anyPlaying && snapshot.filter) {
    return `Music is playing, but not from ${snapshot.filter.name}.`;
  }
  if (snapshot.running && snapshot.mode === "sticky") {
    return "Counting — music is paused but the timer keeps going.";
  }
  if (snapshot.tabs.length === 0) return "Open YouTube Music, Spotify or YouTube to begin.";
  return "Waiting for music…";
}

/** @param {number} liveMs interpolated ms since the last sync */
function renderTimers(liveMs) {
  const box = elements.timers;
  // The local tick must not rebuild a name field the user is typing into.
  const openInput = box.querySelector("input");
  if (editingId && openInput && openInput.dataset.id === editingId) return;
  box.innerHTML = "";

  for (const timer of snapshot.timers) {
    const row = document.createElement("div");
    row.className = "timer-list__row" + (timer.id === snapshot.activeId ? " timer-list__row--active" : "");

    if (timer.id === editingId) {
      row.append(buildNameInput(timer));
      box.append(row);
      const input = row.querySelector("input");
      input.focus();
      input.select();
      continue;
    }

    const name = document.createElement("span");
    name.className = "timer-list__name";
    name.textContent = timer.name;

    const binding = document.createElement("span");
    binding.className = "timer-list__binding";
    binding.textContent = timer.filterName || "";

    const time = document.createElement("span");
    time.className = "timer-list__time";
    // Only the active timer can be running, so it is the only one that needs local ticking.
    time.textContent = formatClock(timer.elapsedMs + (timer.id === snapshot.activeId ? liveMs : 0));

    row.append(name, binding, time);

    if (timer.running) {
      const live = document.createElement("span");
      live.className = "timer-list__live";
      live.textContent = "▶";
      row.append(live);
    }

    row.addEventListener("click", () => {
      if (timer.id === snapshot.activeId) return;
      isConfirmingDelete = false;
      command(MT.ACTION.SELECT_TIMER, { id: timer.id });
    });
    box.append(row);
  }
}

/**
 * An inline name field. Commits on Enter or blur, abandons on Escape.
 *
 * `settled` matters: Escape re-renders, which detaches the input and fires blur, which
 * would otherwise run the commit path we just cancelled.
 *
 * @param {{ id: string, value: string, className: string, onCommit: (name: string) => void, onCancel: () => void }} spec
 * @returns {HTMLInputElement}
 */
function buildInlineNameInput({ id, value, className, onCommit, onCancel }) {
  const input = document.createElement("input");
  input.className = className;
  input.value = value;
  input.maxLength = MAX_TIMER_NAME_LENGTH;
  input.dataset.id = id;

  let settled = false;
  const commit = () => {
    if (settled) return;
    settled = true;
    const name = input.value.trim();
    if (name && name !== value) onCommit(name);
    else onCancel();
  };
  const cancel = () => {
    if (settled) return;
    settled = true;
    onCancel();
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") cancel();
  });
  input.addEventListener("blur", commit);
  return input;
}

/**
 * @param {TimerSummary} timer
 * @returns {HTMLInputElement}
 */
function buildNameInput(timer) {
  return buildInlineNameInput({
    id: timer.id,
    value: timer.name,
    className: "timer-list__input",
    onCommit: (name) => {
      editingId = null;
      command(MT.ACTION.RENAME_TIMER, { id: timer.id, name });
    },
    onCancel: () => {
      editingId = null;
      render();
    },
  });
}

/* ----------------------------------------------------------------------- laps */

function buildLapRow({ modifier, name, durationMs }) {
  const row = document.createElement("div");
  row.className = `lap-list__row lap-list__row--${modifier}`;

  const label = document.createElement("span");
  label.className = "lap-list__name";
  label.textContent = name;

  const time = document.createElement("span");
  time.className = "lap-list__time";
  time.textContent = formatClock(durationMs);

  row.append(label, time);
  return row;
}

/** The lap in progress on top, then completed laps newest first. Hidden until one exists. */
function renderLaps(liveMs) {
  const hasLaps = snapshot.laps.length > 0;
  elements.lapSection.hidden = !hasLaps;
  if (!hasLaps) return;

  const box = elements.laps;
  // The local tick must not rebuild a name field the user is typing into.
  const openInput = box.querySelector("input");
  if (editingLapId && openInput && openInput.dataset.id === editingLapId) return;
  box.innerHTML = "";

  box.append(
    buildLapRow({
      modifier: "open",
      name: `${snapshot.currentLap.name} · now`,
      durationMs: snapshot.currentLap.durationMs + liveMs,
    })
  );

  for (const lap of snapshot.laps) {
    if (lap.id === editingLapId) {
      const row = document.createElement("div");
      row.className = "lap-list__row lap-list__row--closed";
      row.append(
        buildInlineNameInput({
          id: lap.id,
          value: lap.name,
          className: "lap-list__input",
          onCommit: (name) => {
            editingLapId = null;
            command(MT.ACTION.RENAME_LAP, { id: lap.id, name });
          },
          onCancel: () => {
            editingLapId = null;
            render();
          },
        })
      );
      box.append(row);
      const input = row.querySelector("input");
      input.focus();
      input.select();
      continue;
    }

    const row = buildLapRow({ modifier: "closed", name: lap.name, durationMs: lap.durationMs });
    // A div with a click handler is invisible to the keyboard. The timer rows have the
    // same problem (CONFORMANCE U-01/U-07, deferred to a UI pass); no reason to add more.
    row.setAttribute("role", "button");
    row.tabIndex = 0;
    row.setAttribute("aria-label", `Rename lap ${lap.name}`);

    const beginRename = () => {
      editingLapId = lap.id;
      render();
    };
    row.addEventListener("click", beginRename);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        beginRename();
      }
    });
    box.append(row);
  }
}

function renderTabs() {
  elements.tabs.innerHTML = "";
  for (const tab of snapshot.tabs) {
    const row = document.createElement("div");
    row.className = "tab-row";

    const state = document.createElement("span");
    state.textContent = tab.playing ? "▶" : "❚❚";
    if (tab.playing) state.className = "tab-row__state--playing";

    const label = document.createElement("span");
    label.textContent = [tab.siteLabel, tab.contextName || tab.title].filter(Boolean).join(" · ");

    row.append(state, label);
    elements.tabs.append(row);
  }
}

function render() {
  if (!snapshot) return;
  const liveMs = snapshot.running ? Date.now() - lastSyncAt : 0;

  elements.activeName.textContent = snapshot.name;
  elements.activeName.title = snapshot.name;
  elements.clock.textContent = formatClock(snapshot.elapsedMs + liveMs);
  elements.today.textContent = `today ${formatCompact(snapshot.todayMs + liveMs)}`;
  elements.dot.classList.toggle("dot--live", snapshot.running);
  elements.status.textContent = statusLine();

  elements.toggle.textContent = snapshot.running ? "Stop" : "Start";
  elements.toggle.classList.toggle("stop", snapshot.running);

  renderLaps(liveMs);
  renderTimers(liveMs);

  elements.deleteTimer.textContent = isConfirmingDelete ? "Sure?" : "Delete";
  elements.deleteTimer.classList.toggle("danger", isConfirmingDelete);
  elements.deleteTimer.disabled = snapshot.timers.length <= 1;

  for (const button of elements.mode.querySelectorAll("button")) {
    button.classList.toggle("on", button.dataset.mode === snapshot.mode);
  }
  elements.modeHint.textContent =
    snapshot.mode === "auto"
      ? "Runs while music plays, pauses the moment it stops."
      : "Starts when music first plays. Keeps running until you press Stop.";

  if (snapshot.filter) {
    elements.filterName.textContent = snapshot.filter.name;
    elements.filterSub.textContent = snapshot.filter.weak
      ? "Detected from the page you had open — best effort on Spotify."
      : snapshot.filter.siteLabel || "";
  } else {
    elements.filterName.textContent = "Any music counts";
    elements.filterSub.textContent = "";
  }

  renderTabs();
}

/**
 * Round-trip to the worker and repaint from whatever it says.
 * @param {{ type: string, [key: string]: any }} [message]
 */
async function sync(message = { type: MT.MESSAGE.GET }) {
  const next = await send(message);
  if (!next) {
    // The worker did not answer. It may have been restarting; if this repeats, the popup
    // is showing stale numbers and that is worth knowing about.
    log.warn("sync:no-response", { messageType: message.type, action: message.action ?? null });
    return;
  }
  snapshot = next;
  lastSyncAt = Date.now();
  render();
}

/* ------------------------------------------------------------------- events */

/** Mode and playlist binding live behind the gear - settings you set once, not every visit. */
function applySettingsOpen() {
  elements.settingsPanel.hidden = !settingsOpen;
  elements.settingsToggle.setAttribute("aria-expanded", String(settingsOpen));
}

elements.settingsToggle.addEventListener("click", () => {
  settingsOpen = !settingsOpen;
  applySettingsOpen();
});
applySettingsOpen();

elements.toggle.addEventListener("click", () =>
  command(snapshot?.running ? MT.ACTION.STOP : MT.ACTION.START)
);
elements.lap.addEventListener("click", () => command(MT.ACTION.LAP));
elements.reset.addEventListener("click", () => command(MT.ACTION.RESET));

elements.addTimer.addEventListener("click", async () => {
  isConfirmingDelete = false;
  await command(MT.ACTION.ADD_TIMER);
  editingId = snapshot.activeId; // drop straight into naming the new timer
  render();
});

elements.renameTimer.addEventListener("click", () => {
  isConfirmingDelete = false;
  editingId = snapshot?.activeId || null;
  render();
});

elements.deleteTimer.addEventListener("click", () => {
  if (!isConfirmingDelete) {
    isConfirmingDelete = true;
    render();
    return;
  }
  isConfirmingDelete = false;
  command(MT.ACTION.DELETE_TIMER, { id: snapshot.activeId });
});

elements.mode.addEventListener("click", (event) => {
  const mode = /** @type {HTMLElement} */ (event.target).dataset?.mode;
  if (mode) command(MT.ACTION.SET_MODE, { mode });
});

elements.useCurrent.addEventListener("click", () => {
  const candidate = snapshot?.candidate;
  if (!candidate) {
    log.info("filter:no-candidate", { tabs: snapshot?.tabs.length ?? 0 });
    elements.status.textContent = "No playlist detected yet — start playing one first.";
    return;
  }
  command(MT.ACTION.SET_FILTER, { filter: candidate });
});

elements.clearFilter.addEventListener("click", () => command(MT.ACTION.CLEAR_FILTER));

setInterval(render, LOCAL_TICK_MS);
setInterval(() => {
  if (!isEditing()) sync(); // a background sync would blow away an open rename field
}, SYNC_INTERVAL_MS);
sync();
