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
  timerView: document.getElementById("timerView"),
  dot: document.getElementById("dot"),
  statusTitle: document.getElementById("statusTitle"),
  statusContext: document.getElementById("statusContext"),
  timerLabel: document.getElementById("timerLabel"),
  clock: document.getElementById("clock"),
  currentLap: document.getElementById("currentLap"),
  settingsToggle: /** @type {HTMLButtonElement} */ (document.getElementById("settingsToggle")),
  lap: document.getElementById("lap"),
  toggle: document.getElementById("toggle"),
  toggleIcon: document.getElementById("toggleIcon"),
  reset: document.getElementById("reset"),
  timersToggle: /** @type {HTMLButtonElement} */ (document.getElementById("timersToggle")),
  timersBody: document.getElementById("timersBody"),
  timersCount: document.getElementById("timersCount"),
  timersActions: document.getElementById("timersActions"),
  timersSummary: document.getElementById("timersSummary"),
  timers: document.getElementById("timers"),
  lapSection: document.getElementById("lapSection"),
  lapsToggle: /** @type {HTMLButtonElement} */ (document.getElementById("lapsToggle")),
  lapsBody: document.getElementById("lapsBody"),
  lapsCount: document.getElementById("lapsCount"),
  lapsSummary: document.getElementById("lapsSummary"),
  laps: document.getElementById("laps"),
  addTimer: document.getElementById("addTimer"),
  deleteTimer: /** @type {HTMLButtonElement} */ (document.getElementById("deleteTimer")),
  tabs: document.getElementById("tabs"),
  settingsView: document.getElementById("settingsView"),
  settingsBack: document.getElementById("settingsBack"),
  settingsSave: document.getElementById("settingsSave"),
  modeOptions: document.getElementById("modeOptions"),
  targetTimer: /** @type {HTMLSelectElement} */ (document.getElementById("targetTimer")),
  filterOptions: document.getElementById("filterOptions"),
};

/** @type {PopupSnapshot | null} */
let snapshot = null;
let lastSyncAt = 0;
/** @type {string | null} timer whose name is being edited inline */
let editingId = null;
/** @type {string | null} lap whose name is being edited inline */
let editingLapId = null;
let isConfirmingDelete = false;
/** Purely local UI state - the worker has no notion of whether these are open. */
let timersExpanded = true;
let lapsExpanded = true;

/**
 * The settings page's draft - null when the page is closed. Nothing here reaches
 * background.js until Save sends it as one SAVE_TIMER_SETTINGS command; the back arrow
 * just discards it. `baselineMode`/`baselineFilterMode` are what's actually saved right
 * now, kept alongside the editable draft so the "Active" badge can show the real value even
 * after you've moved the radio selection away from it.
 * @type {{
 *   id: string, name: string, timers: TimerOption[], candidate: PlaylistContext | null,
 *   mode: TimerMode, filterMode: FilterMode, filter: PlaylistContext | null,
 *   specificPlaylists: { raw: string }[],
 *   baselineMode: TimerMode, baselineFilterMode: FilterMode,
 * } | null}
 */
let settingsDraft = null;

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
 * The playlist filter and status line show a playlist's full name; the timer row is too
 * narrow for that, so it shows only the part before an em dash - "Deep Focus —
 * Instrumental" becomes "Deep Focus". Falls back to the full name when there's no dash.
 * @param {string} name
 * @returns {string}
 */
function shortenPlaylistName(name) {
  const cut = name.indexOf(" — ");
  return cut === -1 ? name : name.slice(0, cut);
}

/* ----------------------------------------------------------------- transport */

/**
 * @template [T=PopupSnapshot]
 * @param {{ type: string, [key: string]: any }} message
 * @returns {Promise<T | undefined>}
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

/**
 * What the header's now-playing block shows: a title line and an optional context line.
 * When music is playing and matched to this timer, that's the track and its playlist;
 * otherwise the title line carries a status message instead, with no context line.
 * @returns {{ title: string, context: string }}
 */
function statusParts() {
  if (!snapshot) return { title: "…", context: "" };
  const active = snapshot.lastActive;
  if (snapshot.eligible && active) {
    const what = [active.title, active.artist].filter(Boolean).join(" — ") || "Music";
    return { title: what, context: active.contextName ? `from ${active.contextName}` : "" };
  }
  if (snapshot.anyPlaying && snapshot.filter) {
    return { title: `Music is playing, but not from ${snapshot.filter.name}.`, context: "" };
  }
  if (snapshot.running && snapshot.mode === "sticky") {
    return { title: "Counting — music is paused but the timer keeps going.", context: "" };
  }
  if (snapshot.tabs.length === 0) {
    return { title: "Open YouTube Music, Spotify or YouTube to begin.", context: "" };
  }
  return { title: "Waiting for music…", context: "" };
}

/**
 * The one line shown in place of the full list while Timers is collapsed: the active
 * timer's name and running time - the same numbers the clock above is already showing.
 * @param {number} liveMs
 */
function renderTimersSummary(liveMs) {
  const summary = elements.timersSummary;
  summary.textContent = "";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = snapshot.name;
  summary.append(name, document.createTextNode(" " + formatClock(snapshot.elapsedMs + liveMs)));
}

/** @param {number} liveMs interpolated ms since the last sync */
function renderTimers(liveMs) {
  elements.timersCount.textContent = String(snapshot.timers.length);
  renderTimersSummary(liveMs);

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
    name.title = "Double-click to rename";
    // The only way to rename now - no separate button. Renames this row specifically, not
    // only the active timer, so it works regardless of which one is currently running.
    name.addEventListener("dblclick", (event) => {
      event.stopPropagation(); // the row's own click handler would otherwise also select it
      isConfirmingDelete = false;
      editingId = timer.id;
      render();
    });

    const binding = document.createElement("span");
    binding.className = "timer-list__binding";
    binding.textContent = timer.filterName ? shortenPlaylistName(timer.filterName) : "";

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

/**
 * The one line shown in place of the full list while Laps is collapsed. Unlike the full
 * list's open-lap row, this doesn't add "· now" - a single summary line naming one lap is
 * already unambiguously the current one, so the label would be pure repetition here.
 * @param {number} liveMs
 */
function renderLapsSummary(liveMs) {
  const summary = elements.lapsSummary;
  summary.textContent = "";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = snapshot.currentLap.name;
  const duration = formatClock(snapshot.currentLap.durationMs + liveMs);
  summary.append(name, document.createTextNode(`: ${duration}`));
}

/** The lap in progress on top, then completed laps newest first. Hidden until one exists. */
function renderLaps(liveMs) {
  const hasLaps = snapshot.laps.length > 0;
  elements.lapSection.hidden = !hasLaps;
  if (!hasLaps) return;

  // Every row the full list would show, open lap included - not just the ones that have
  // actually finished, which "recorded" would otherwise imply.
  elements.lapsCount.textContent = String(snapshot.laps.length + 1);
  renderLapsSummary(liveMs);

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
    label.textContent = tab.siteLabel;

    row.append(state, label);
    elements.tabs.append(row);
  }
}

/** The label under the clock: just the lap in progress by name - plain, no "· now" (that
 * badge belongs only to the full lap list's open row, a different element). */
function renderCurrentLap() {
  elements.currentLap.textContent = snapshot.currentLap.name;
}

/** @param {boolean} running */
function setToggleIcon(running) {
  elements.toggleIcon.innerHTML = running
    ? '<rect x="5" y="5" width="14" height="14" rx="1.5"></rect>'
    : '<path d="M8 5v14l11-7z"></path>';
}

function render() {
  if (!snapshot) return;
  if (elements.timerView.hidden) return; // nothing here is visible on the settings page
  const liveMs = snapshot.running ? Date.now() - lastSyncAt : 0;

  const status = statusParts();
  elements.statusTitle.textContent = status.title;
  elements.statusContext.textContent = status.context;

  elements.timerLabel.textContent = snapshot.name;
  elements.timerLabel.title = snapshot.name;
  elements.clock.textContent = formatClock(snapshot.elapsedMs + liveMs);
  renderCurrentLap();
  elements.dot.classList.toggle("dot--live", snapshot.running);

  elements.toggle.setAttribute("aria-label", snapshot.running ? "Stop timer" : "Start timer");
  elements.toggle.title = snapshot.running ? "Stop timer" : "Start timer";
  setToggleIcon(snapshot.running);

  renderTimers(liveMs);
  renderLaps(liveMs);

  // Icon-only, so the confirm step is a color change instead of a text swap. Neither export
  // shows a delete flow - deleting a timer was never depicted in either screen.
  elements.deleteTimer.classList.toggle("section-action--confirm", isConfirmingDelete);
  elements.deleteTimer.setAttribute(
    "aria-label",
    isConfirmingDelete ? "Click again to confirm delete" : "Delete timer"
  );
  elements.deleteTimer.title = isConfirmingDelete ? "Click again to confirm delete" : "Delete timer";
  elements.deleteTimer.disabled = snapshot.timers.length <= 1;

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

/* ---------------------------------------------------------------- settings page */

/**
 * A pasted playlist link becomes a stable id the same way content.js's own adapters build
 * one, so it matches a real playback report by id rather than only by name. Anything that
 * isn't a recognized link is treated as a typed name instead - both are valid input.
 * @param {string} raw
 * @returns {PlaylistContext | null} null only for blank input
 */
function parsePlaylistLink(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^(www|m)\./, "");
    const list = url.searchParams.get("list");

    if (host === "music.youtube.com" && list) {
      return { id: "ytmusic:" + list, name: null, url: trimmed, site: "ytmusic", siteLabel: "YouTube Music" };
    }
    if (host === "youtube.com" && list) {
      return { id: "youtube:" + list, name: null, url: trimmed, site: "youtube", siteLabel: "YouTube" };
    }
    if (host === "open.spotify.com") {
      const match = url.pathname.match(/^\/(playlist|album|artist|collection)\/([^/]+)/);
      if (match) {
        return {
          id: "spotify:" + match[1] + "/" + match[2],
          name: null,
          url: trimmed,
          site: "spotify",
          siteLabel: "Spotify",
        };
      }
    }
    // A URL, but not one of the three sites (or missing the piece we need) - fall through
    // and treat it as a typed name, same as any other text that isn't a link.
  } catch {
    // Not a URL at all - the expected case for a typed name.
  }
  return { id: null, name: trimmed };
}

/**
 * What to show in a "Specific playlist(s)" input for an entry that came back from
 * background.js - whichever of these is the most recognizable to the person who typed it.
 * @param {PlaylistContext} entry
 * @returns {string}
 */
function displayTextFor(entry) {
  return entry.url || entry.name || entry.id || "";
}

/** @returns {boolean} whether the settings page is the one currently on screen */
const isOnSettingsPage = () => Boolean(settingsDraft);

/**
 * Fetches one timer's full settings and opens the page on them. Called both when the gear
 * is first pressed and whenever the "Target timer" dropdown changes - either way, any
 * unsaved edits to whatever was open before are discarded, the same as the back arrow does.
 * @param {string} [id]
 */
async function openSettings(id) {
  const data = /** @type {SettingsSnapshot | undefined} */ (await send({ type: MT.MESSAGE.SETTINGS, id }));
  if (!data) {
    log.warn("settings:no-response", { id: id ?? null });
    return;
  }
  settingsDraft = {
    ...data,
    specificPlaylists: data.specificPlaylists.map((entry) => ({ raw: displayTextFor(entry) })),
    baselineMode: data.mode,
    baselineFilterMode: data.filterMode,
  };
  renderSettingsPage();
  elements.timerView.hidden = true;
  elements.settingsView.hidden = false;
}

/** Discards the draft and returns to the timer view, re-syncing it - it may be stale. */
function closeSettings() {
  settingsDraft = null;
  elements.settingsView.hidden = true;
  elements.timerView.hidden = false;
  sync();
}

/**
 * One radio-style card, shared by both settings-page option lists.
 * @param {{ selected: boolean, title: string, description: string, badge?: string, onSelect: () => void }} spec
 * @returns {HTMLButtonElement}
 */
function buildOptionCard({ selected, title, description, badge, onSelect }) {
  const card = /** @type {HTMLButtonElement} */ (document.createElement("button"));
  card.type = "button";
  card.className = "option-card" + (selected ? " option-card--selected" : "");

  const dot = document.createElement("span");
  dot.className = "option-card__dot";

  const body = document.createElement("span");
  body.className = "option-card__body";

  const row = document.createElement("span");
  row.className = "option-card__row";
  const titleEl = document.createElement("span");
  titleEl.className = "option-card__title";
  titleEl.textContent = title;
  row.append(titleEl);
  if (badge) {
    const badgeEl = document.createElement("span");
    badgeEl.className = "option-card__badge";
    badgeEl.textContent = badge;
    row.append(badgeEl);
  }

  const desc = document.createElement("p");
  desc.className = "option-card__description";
  desc.textContent = description;

  body.append(row, desc);
  card.append(dot, body);
  card.addEventListener("click", onSelect);
  return card;
}

function renderModeOptions() {
  const box = elements.modeOptions;
  box.innerHTML = "";
  const draft = settingsDraft;

  box.append(
    buildOptionCard({
      selected: draft.mode === "auto",
      title: "Follow the music",
      description: "Pauses the timer as soon as music stops or the tab pauses.",
      badge: draft.baselineMode === "auto" ? "Active" : undefined,
      onSelect: () => {
        draft.mode = "auto";
        renderModeOptions();
      },
    }),
    buildOptionCard({
      selected: draft.mode === "sticky",
      title: "Only when I say",
      description: "Timer keeps ticking continuously until stopped manually.",
      badge: draft.baselineMode === "sticky" ? "Active" : undefined,
      onSelect: () => {
        draft.mode = "sticky";
        renderModeOptions();
      },
    })
  );
}

/** @param {number} index */
function removeSpecificEntry(index) {
  settingsDraft.specificPlaylists.splice(index, 1);
  renderFilterOptions();
}

/**
 * The "Specific playlist(s)" card's own body: one input per entry (each with a remove
 * button) and, revealed on hover over the card, a "+" to add another. Rendered whenever
 * this card exists, not only while it's selected - matching the reference mockup, which
 * shows this field regardless of which option is currently chosen.
 * @returns {HTMLElement}
 */
function buildSpecificPlaylistsBody() {
  const wrap = document.createElement("span");
  wrap.className = "playlist-entries";

  settingsDraft.specificPlaylists.forEach((entry, index) => {
    const row = document.createElement("span");
    row.className = "playlist-entry";

    const input = document.createElement("input");
    input.type = "text";
    input.value = entry.raw;
    input.placeholder = "Paste a playlist link, or type its name";
    input.addEventListener("click", (event) => event.stopPropagation()); // don't also select the card
    input.addEventListener("input", () => {
      entry.raw = input.value;
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "playlist-entry__remove";
    remove.setAttribute("aria-label", "Remove this playlist");
    remove.title = "Remove this playlist";
    remove.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>';
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      removeSpecificEntry(index);
    });

    row.append(input, remove);
    wrap.append(row);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "playlist-add";
  add.setAttribute("aria-label", "Add another playlist");
  add.title = "Add another playlist";
  add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path></svg>';
  add.addEventListener("click", (event) => {
    event.stopPropagation();
    settingsDraft.specificPlaylists.push({ raw: "" });
    renderFilterOptions();
  });
  wrap.append(add);

  return wrap;
}

function renderFilterOptions() {
  const box = elements.filterOptions;
  box.innerHTML = "";
  const draft = settingsDraft;

  const useCurrentCard = buildOptionCard({
    selected: draft.filterMode === "current",
    title: "Use current",
    description: "Locked to the currently active album or playlist.",
    badge: draft.filter?.name || undefined,
    onSelect: () => {
      draft.filterMode = "current";
      // Selecting this is the capture moment, same as the old "Use current" button - lock
      // to whatever is playing right now, if anything is.
      if (draft.candidate) draft.filter = { ...draft.candidate };
      renderFilterOptions();
    },
  });

  const anyMusicCard = buildOptionCard({
    selected: draft.filterMode === "any",
    title: "Any music",
    description: "Responds to playback across YouTube, YT Music & Spotify.",
    onSelect: () => {
      draft.filterMode = "any";
      renderFilterOptions();
    },
  });

  const specificCard = buildOptionCard({
    selected: draft.filterMode === "specific",
    title: "Specific playlist(s)",
    description: "Ticks when any one of these is playing.",
    onSelect: () => {
      // First time in: seed one entry so there's something to type into right away,
      // rather than an empty list with only the hover-revealed "+" to discover.
      if (draft.specificPlaylists.length === 0) {
        const seed = draft.baselineFilterMode === "current" && draft.filter ? draft.filter.name : "";
        draft.specificPlaylists.push({ raw: seed || "" });
      }
      draft.filterMode = "specific";
      renderFilterOptions();
    },
  });
  specificCard.querySelector(".option-card__body").append(buildSpecificPlaylistsBody());

  box.append(useCurrentCard, anyMusicCard, specificCard);
}

function renderSettingsPage() {
  const draft = settingsDraft;

  elements.targetTimer.innerHTML = "";
  for (const option of draft.timers) {
    const el = document.createElement("option");
    el.value = option.id;
    el.textContent = option.name;
    if (option.id === draft.id) el.selected = true;
    elements.targetTimer.append(el);
  }

  renderModeOptions();
  renderFilterOptions();
}

elements.settingsToggle.addEventListener("click", () => openSettings());
elements.settingsBack.addEventListener("click", () => closeSettings());
elements.targetTimer.addEventListener("change", () => openSettings(elements.targetTimer.value));

elements.settingsSave.addEventListener("click", async () => {
  const draft = settingsDraft;
  const specificPlaylists = draft.specificPlaylists
    .map((entry) => parsePlaylistLink(entry.raw))
    .filter((entry) => entry !== null);

  await command(MT.ACTION.SAVE_TIMER_SETTINGS, {
    id: draft.id,
    mode: draft.mode,
    filterMode: draft.filterMode,
    filter: draft.filter,
    specificPlaylists,
  });
  closeSettings();
});

/**
 * Also local-only: collapsing Timers/Laps to one summary line is a display choice, not
 * state. The header row shows either the management icons or the summary, never both - New
 * and Delete only mean anything while the list they'd act on is actually visible.
 */
function applyTimersExpanded() {
  elements.timersToggle.setAttribute("aria-expanded", String(timersExpanded));
  elements.timersBody.hidden = !timersExpanded;
  elements.timersActions.hidden = !timersExpanded;
  elements.timersSummary.hidden = timersExpanded;
}

function applyLapsExpanded() {
  elements.lapsToggle.setAttribute("aria-expanded", String(lapsExpanded));
  elements.lapsBody.hidden = !lapsExpanded;
  elements.lapsSummary.hidden = lapsExpanded;
}

elements.timersToggle.addEventListener("click", () => {
  timersExpanded = !timersExpanded;
  applyTimersExpanded();
});
elements.lapsToggle.addEventListener("click", () => {
  lapsExpanded = !lapsExpanded;
  applyLapsExpanded();
});
applyTimersExpanded();
applyLapsExpanded();

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

elements.deleteTimer.addEventListener("click", () => {
  if (!isConfirmingDelete) {
    isConfirmingDelete = true;
    render();
    return;
  }
  isConfirmingDelete = false;
  command(MT.ACTION.DELETE_TIMER, { id: snapshot.activeId });
});

setInterval(render, LOCAL_TICK_MS);
setInterval(() => {
  // A background sync would blow away an open rename field, and there is nothing for it
  // to refresh while the settings page - a separate draft, not part of this snapshot - is
  // what's actually on screen.
  if (!isEditing() && !isOnSettingsPage()) sync();
}, SYNC_INTERVAL_MS);
sync();
