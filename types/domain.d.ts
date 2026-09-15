/**
 * The shapes that cross a boundary - between content script, worker, popup, and storage.
 *
 * They live here rather than beside any one module because no single module owns them:
 * that is exactly what makes a typo in one of them expensive. `src/shared/contract.js`
 * names the messages; this file describes what those messages carry.
 */

/** What a timer's clock does when music stops. */
type TimerMode = "auto" | "sticky";

/** Which of a timer's three playlist-matching rules is in effect. */
type FilterMode = "current" | "any" | "specific";

/** A site the content script can report playback from - matches PlaybackReport's `site`. */
type SiteKey = "ytmusic" | "spotify" | "youtube";

/** Where the music is playing from - a playlist, album, or page context. */
interface PlaylistContext {
  /** Stable-ish identifier, namespaced by site, e.g. "ytmusic:PL123". */
  id: string;
  name: string;
  url?: string;
  /** True when inferred from the open page rather than the real playing context. */
  weak?: boolean;
  site?: string;
  siteLabel?: string;
}

interface Track {
  title: string | null;
  artist: string | null;
}

/** One content script's view of its tab, as sent on every heartbeat. */
interface PlaybackReport {
  site: string;
  siteLabel: string;
  playing: boolean;
  track: Track;
  context: PlaylistContext | null;
  url: string;
}

/** A PlaybackReport once the worker has stamped its arrival time. */
interface PlaybackSource extends PlaybackReport {
  updatedAt: number;
}

/** What was last counted, shown in the popup when nothing is playing. */
interface LastActive {
  siteLabel: string;
  title: string | null;
  artist: string | null;
  contextName: string | null;
}

interface Timer {
  id: string;
  name: string;
  mode: TimerMode;
  /** Which of filter / (none) / specificPlaylists actually governs matching. */
  filterMode: FilterMode;
  /** The "Use current" capture. Only meaningful when filterMode is "current". */
  filter: PlaylistContext | null;
  /** Explicit list for "specific" mode - matches if any one entry is playing. */
  specificPlaylists: PlaylistContext[];
  /**
   * Which sites this timer will count at all - independent of, and applied before,
   * filterMode. An empty array means nothing ever matches, on any site: a deliberate
   * per-timer pause switch, not an oversight.
   */
  sites: SiteKey[];
  running: boolean;
  /** Epoch ms the current run began, or null when stopped. */
  runningSince: number | null;
  accumulatedMs: number;
  /** Sticky mode: music has started the clock. */
  armed: boolean;
  /** Sticky mode: stopped by hand; wait for silence before re-arming. */
  rearmBlocked: boolean;
  /** "YYYY-MM-DD" -> ms committed that day. */
  daily: Record<string, number>;
  lastActive: LastActive | null;
  /** Closed laps, oldest first, as offsets into elapsed time so pauses never inflate them. */
  laps: Lap[];
  /** Elapsed-time offset where the lap in progress began. */
  lapStartMs: number;
}

/** One closed lap. start/end are offsets into the parent timer's elapsed time, not wall clock. */
interface Lap {
  id: string;
  name: string;
  startMs: number;
  endMs: number;
}

/** Which playlist most recently decided the active timer, and for which timer. */
interface ActiveClaim {
  timerId: string;
  contextId: string | null;
}

/** The whole persisted state, as stored under "mt.state". */
interface MusicTimerState {
  version: number;
  activeId: string;
  /** Display order; also the order in which timers get to claim the active slot. */
  order: string[];
  timers: Record<string, Timer>;
  lastClaim?: ActiveClaim | null;
  /** Derived on each evaluate(), persisted so the popup can read one object. */
  anyPlaying?: boolean;
  eligible?: boolean;
}

/** One row of the popup's timer list. */
interface TimerSummary {
  id: string;
  name: string;
  elapsedMs: number;
  running: boolean;
  filterName: string | null;
}

/** One row of the popup's footer. */
interface TabSummary {
  siteLabel: string;
  playing: boolean;
  title: string | null;
  contextName: string | null;
  contextWeak: boolean;
}

/** One row of the popup's lap list: the parent timer's laps array, with duration derived. */
interface LapSummary {
  id: string;
  name: string;
  durationMs: number;
}

/** The lap in progress. Has no id yet - it is not a Lap until it closes. */
interface CurrentLap {
  name: string;
  durationMs: number;
}

/** Everything the popup needs, in one round trip. */
interface PopupSnapshot {
  activeId: string;
  timers: TimerSummary[];
  name: string;
  mode: TimerMode;
  filter: PlaylistContext | null;
  running: boolean;
  elapsedMs: number;
  todayMs: number;
  /** Newest first - the lap you just took is the one you want to read or rename. */
  laps: LapSummary[];
  currentLap: CurrentLap;
  anyPlaying: boolean;
  eligible: boolean;
  lastActive: LastActive | null;
  candidate: PlaylistContext | null;
  tabs: TabSummary[];
}

/** A message the worker's command() knows how to handle. */
interface CommandMessage {
  type: string;
  action: string;
  id?: string;
  name?: string;
  mode?: TimerMode;
  filter?: PlaylistContext | null;
  filterMode?: FilterMode;
  specificPlaylists?: PlaylistContext[];
  sites?: SiteKey[];
}

/** One entry in the settings page's "Target timer" dropdown. */
interface TimerOption {
  id: string;
  name: string;
}

/**
 * Everything the settings page needs for one timer, in one round trip. Unlike
 * PopupSnapshot, this can describe any timer, not only the active one - the page lets you
 * configure one without switching to it.
 */
interface SettingsSnapshot {
  timers: TimerOption[];
  id: string;
  name: string;
  mode: TimerMode;
  filterMode: FilterMode;
  filter: PlaylistContext | null;
  specificPlaylists: PlaylistContext[];
  sites: SiteKey[];
  /** What's playing right now, offered as the "Use current" capture target. */
  candidate: PlaylistContext | null;
}
