# Best Practices — Websites & Browser Extensions

Reference document for MusicTimer. Rules are grouped by **what they optimize for**, because
most "best practices" arguments are really disagreements about which axis you're optimizing.
When two rules conflict, the priority order for this project is:

> **Correctness → Debugging → Readability → UI → Scalability**

Scalability is last on purpose: premature abstraction is the most common way small projects
become unreadable. Adopt a scalability rule only when the pain it solves is real.

Each rule has a **Rule**, a **Why**, and where useful a **Do / Don't**.

---

## 1. Readability

Optimizes for: *a human (including future-you) understanding a file in under 60 seconds.*

### 1.1 Naming

| Rule | Detail |
|---|---|
| `camelCase` for variables and functions | `remainingMs`, `startTimer()` |
| `PascalCase` for classes and constructors | `TimerEngine`, `TrackQueue` |
| `SCREAMING_SNAKE_CASE` for module-level constants | `DEFAULT_SESSION_MS`, `STORAGE_KEY` |
| `kebab-case` for filenames and CSS classes | `timer-engine.js`, `.timer-display` |
| Booleans read as assertions | `isRunning`, `hasLoaded`, `canSkip` — never `flag`, `status2` |
| Functions are verbs, values are nouns | `formatDuration(ms)` returns a `label`, not `theString` |
| Units in the name when a number has units | `delayMs`, `volumePct`, `durationSec` — this single habit prevents a whole class of bug |

**Why:** Naming is the highest-leverage readability lever because it's the only documentation
that can't go stale silently — a renamed thing with a wrong name is visible at every call site.

**Don't** abbreviate to save typing (`btnHdlr`, `tmr`, `cfg2`). Editors autocomplete; brains don't.

### 1.2 Functions

- **One job per function.** If you need "and" to describe it, split it.
- **Keep them short enough to see whole.** ~30 lines is a smell, not a law.
- **Return early.** Guard clauses at the top beat nested `if` pyramids.
- **Max ~3 positional parameters.** Beyond that, take an options object:
  `startSession({ durationMs, trackId, autoAdvance })` — call sites become self-documenting.
- **No hidden side effects.** A function named `getX` must not also write storage.

```js
// Don't
function handle(a, b, c, d) { if (a) { if (b) { /* ... deep nesting ... */ } } }

// Do
function startSession({ durationMs, trackId }) {
  if (!durationMs) return;            // guard
  if (!trackId) return;               // guard
  // ... one clear job, flat
}
```

### 1.3 Variables & control flow

- `const` by default, `let` when reassigned, **never `var`** (function-scoped, hoisted, a
  reliable source of confusing bugs).
- Name your conditions. `if (isSessionExpired(state))` beats
  `if (state.end - Date.now() <= 0 && !state.paused)`.
- Avoid magic numbers and magic strings. `25 * 60 * 1000` becomes `POMODORO_MS`.
  A string used in two files is a constant, not a literal.
- Prefer `map`/`filter`/`find` over index loops when you're transforming, plain `for...of`
  when you're doing side effects. Don't use `forEach` for async work — it ignores promises.

### 1.4 Comments

- Comment the **why**, never the **what**. The code already says what.
- Every non-obvious constant deserves a one-line justification (`// 30s: matches MV3 SW idle timeout`).
- Delete commented-out code. That's what version control is for.
- Use JSDoc on anything exported across module boundaries — it gives editor autocomplete
  and type-checking for free, without adopting TypeScript.

```js
/**
 * @param {number} ms
 * @returns {string} "MM:SS"
 */
export function formatDuration(ms) { /* ... */ }
```

### 1.5 File & module layout

- One concept per file; filename equals the concept.
- Consistent internal order: imports → constants → types/JSDoc → main export → helpers.
- Named exports over default exports (default exports get renamed arbitrarily at each import,
  which defeats grep).
- No file over ~300 lines without a reason. Length is a proxy for "this file does too much."

### 1.6 CSS readability

- Adopt one naming methodology and never mix. **BEM** is the recommended default:
  `.block__element--modifier` → `.timer__display--paused`.
  - Block = standalone component (`.timer`)
  - Element = part that can't exist alone (`.timer__label`)
  - Modifier = variant/state (`.timer--running`)
- Keep specificity flat. One class per rule; avoid `#id` selectors and descendant chains
  (`.a .b .c span`). Flat specificity means you never fight with `!important`.
- **Design tokens as CSS custom properties**, declared once on `:root`:

```css
:root {
  --color-bg: #0f1115;
  --color-accent: #4f9cf9;
  --space-2: 0.5rem;
  --radius-md: 8px;
  --font-mono: ui-monospace, SFMono-Regular, monospace;
}
```
  Then **never** write a raw hex or pixel value in component CSS. This is what makes theming,
  dark mode, and design changes one-line edits instead of find-and-replace archaeology.
- Group properties in a consistent order (layout → box → typography → visual → motion).

### 1.7 Consistency enforcement

Readability rules that rely on discipline decay. Automate them:

- **Prettier** for formatting (ends all formatting debate; zero config decisions).
- **ESLint** for correctness-adjacent lint (`no-unused-vars`, `eqeqeq`, `no-var`,
  `no-implicit-globals`).
- **`// @ts-check`** at the top of JS files + JSDoc types = ~80% of TypeScript's benefit,
  0% of the build step.
- An `.editorconfig` so indentation survives across editors.

---

## 2. Scalability

Optimizes for: *adding the 10th feature as cheaply as the 2nd.*

### 2.1 Folder structure: feature-first, not type-first

The single biggest structural improvement teams make is organizing by **feature/domain**
rather than by file type.

```
Don't (type-first — a feature is smeared across 5 folders):
  /js        /css       /html
  timer.js   timer.css  popup.html
  audio.js   audio.css

Do (feature-first — a feature is one folder you can delete):
  /src
    /features
      /timer       timer-engine.js  timer-view.js  timer.css
      /player      player.js        track-queue.js player.css
      /settings    settings.js      settings.css
    /shared        storage.js  format.js  logger.js  dom.js
    /core          config.js   constants.js
```

**Why:** Deleting or extracting a feature should touch one directory. When it touches five,
every change becomes a survey of the whole codebase.

### 2.2 Layer boundaries

Define three tiers and enforce the dependency direction:

- **core** — app-wide config, constants, bootstrap. Depends on nothing.
- **shared** — genuinely reusable utilities (formatting, storage wrapper, logger).
  Depends only on core. **Keep it small** — "shared" is where unrelated code goes to hide.
- **features** — isolated domain logic + its UI. May depend on shared and core.
  **Features must not import from other features.** If two features need the same thing,
  it moves to shared, or they talk through an event/store.

### 2.3 Separate logic from the DOM

The most valuable structural rule for a small app:

- **Engine/state modules** contain pure logic and hold no DOM references. They are testable
  in isolation, in Node, with no browser.
- **View modules** read state and write the DOM. They contain no business rules.
- The view subscribes to the engine; the engine never reaches into the view.

```js
// timer-engine.js — pure, testable, no DOM
export function createTimer({ durationMs, onTick, onComplete }) { /* ... */ }

// timer-view.js — DOM only
timer.subscribe(state => { el.textContent = formatDuration(state.remainingMs); });
```

**Why:** Logic tangled with `document.getElementById` can only be tested by clicking, which
means it will never be tested, which means every change is a regression risk.

### 2.4 State management: categorize, don't centralize

The 2026 consensus moved away from "one global store for everything" to
**a store per category of state**:

| Category | Where it belongs |
|---|---|
| Ephemeral UI state (is this menu open) | Local to the component |
| Shared app state (timer running, current track) | One small explicit store / event emitter |
| Persisted state (user settings, session history) | `chrome.storage` / `localStorage`, behind a wrapper |
| Server state (if any API is added) | A fetch/cache layer, never mixed into UI state |
| URL state (deep links, shareable config) | Query params, read as the source of truth |

**Rule:** state has exactly **one** owner. Never mirror the same value in two places — that
"cache" is a future desync bug. Derive instead of duplicating.

For a vanilla project, a 30-line pub/sub store is plenty and beats pulling in a framework:

```js
export function createStore(initial) {
  let state = initial; const subs = new Set();
  return {
    get: () => state,
    set: (patch) => { state = { ...state, ...patch }; subs.forEach(f => f(state)); },
    subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
  };
}
```

### 2.5 Wrap every external dependency

Never call a platform/vendor API directly from feature code. Put a thin adapter in `shared/`:

- `shared/storage.js` wraps `chrome.storage` / `localStorage` — gives you one place to add
  namespacing, defaults, migration, quota handling, and a mock for tests.
- `shared/logger.js` wraps `console` — one place to add levels and ship-time silencing.
- `shared/audio.js` wraps the audio element / Web Audio graph.

**Why:** When the platform changes (MV2→MV3 broke `localStorage` in service workers), you
change one file instead of forty call sites.

### 2.6 Configuration & constants

- One `core/constants.js` for shared magic values; feature-local constants stay in the feature.
- Never hard-code environment assumptions (paths, IDs, URLs) inline.
- Versioned persisted data: store a `schemaVersion` alongside settings from day one, and write
  a migration function. Retrofitting this after users have data is painful.

### 2.7 Performance scalability

- **Don't touch the DOM in a loop.** Batch reads, then batch writes, to avoid layout thrashing.
- Use `requestAnimationFrame` for anything visual; never render faster than the display.
- Cache DOM lookups at module init rather than re-querying every tick.
- Delegate events: one listener on a container beats N listeners on N children.
- Lazy-load anything not needed for first paint (`import()`), especially audio assets.
- Debounce/throttle high-frequency handlers (`resize`, `scroll`, `input`).

### 2.8 Things *not* to do prematurely

- Don't add a framework, bundler, or state library until a concrete pain demands it.
- Don't build an abstraction for a single use case. **Rule of three**: abstract on the third
  occurrence, not the first.
- Don't create a `utils.js` grab-bag. Name modules by purpose (`format.js`, `dom.js`).

---

## 3. Debugging

Optimizes for: *the time between "something is wrong" and "I know which line."*

### 3.1 Make failures loud

- **Fail fast.** Validate inputs at module boundaries and throw with a message naming the
  module, the expected value, and the received value.
- **Never swallow errors.** `catch (e) {}` is the single most expensive line in any codebase.
  If you catch, you must either handle, re-throw, or log with context.
- Install global handlers early, in every context:

```js
window.addEventListener('error', e => log.error('uncaught', { msg: e.message, src: e.filename, line: e.lineno }));
window.addEventListener('unhandledrejection', e => log.error('unhandled-rejection', { reason: e.reason }));
```

### 3.2 Structured logging

Replace ad-hoc `console.log` with a tiny logger that emits **consistent fields**:

```js
// shared/logger.js
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
let threshold = LEVELS.debug;             // set to LEVELS.warn for release builds

function emit(level, event, context = {}) {
  if (LEVELS[level] < threshold) return;
  console[level === 'debug' ? 'log' : level](
    `[${new Date().toISOString()}] [${level}] ${event}`, context
  );
}
export const log = {
  setLevel: (l) => { threshold = LEVELS[l]; },
  debug: (e, c) => emit('debug', e, c),
  info:  (e, c) => emit('info',  e, c),
  warn:  (e, c) => emit('warn',  e, c),
  error: (e, c) => emit('error', e, c),
};
```

Guidelines:
- Log **events with context objects**, not interpolated prose.
  `log.info('timer:start', { durationMs, trackId })` — greppable, filterable, machine-readable.
- Namespace events `feature:action` so you can filter the console by prefix.
- Log **state transitions and boundary crossings** (message sent/received, storage write,
  audio play/pause), not every line of execution.
- Use levels honestly: `debug` for development detail, `info` for lifecycle, `warn` for
  recoverable anomalies, `error` for things that broke.
- Ship with `debug` silenced, not deleted. Deleted logs have to be rewritten during the
  next incident.
- `console.table` for arrays of objects, `console.group` for nested flows, `console.time`
  for timing — they're free signal upgrades.

### 3.3 Debugging technique

- **Breakpoints over `console.log`** once the bug isn't obvious. Place them at architectural
  boundaries (function entry, message handler, state setter), not deep inside implementations.
- **Conditional breakpoints** (`remainingMs < 0`) for bugs that only occur on iteration 4,000.
- **`debugger;` statement** when the file is hard to locate in Sources.
- **"Pause on exceptions"** (including caught) finds swallowed errors instantly.
- **Binary-search the bug**: halve the surface each step rather than reading linearly.
- Reproduce before you fix; write the reproduction down. A bug you can't reproduce is a bug
  you can't verify fixed.

### 3.4 Browser-extension debugging (each context has its own console)

An extension is several isolated programs. **There is no single console.** Know all four:

| Context | How to open DevTools | Common gotcha |
|---|---|---|
| Service worker | `chrome://extensions` → your extension → click **"service worker"** | It dies after 30s idle; the DevTools panel going gray means it terminated, not that it crashed |
| Popup | Right-click the toolbar icon → **Inspect popup** | DevTools closes when the popup closes — losing your logs. Keep the popup open by inspecting it, then interacting via DevTools |
| Content script | Inspect the **host page**, then use the context dropdown (next to `top`) to switch to the extension's isolated world | Logs appear in the *page's* console, not the extension's |
| Options / other pages | Open the page directly and inspect normally | — |

Additional:
- `chrome://extensions` shows an **Errors** button per extension collecting startup and
  manifest errors you'd otherwise never see.
- In DevTools → Settings, **uncheck "ignore content scripts"** or they won't appear in Sources.
- Inspect persisted state under **Application → Storage → Extension storage**.
- Reload the extension after every service-worker change; content-script changes also need a
  host-page refresh.

### 3.5 Source maps & release builds

- If you ever minify or bundle, **generate and keep source maps**, otherwise every production
  stack trace is unreadable garbage.
- Keep error messages descriptive in release; strip only `debug`-level noise.

### 3.6 Testability as a debugging feature

- Pure logic modules (§2.3) let you reproduce a bug in a 5-line test instead of a 20-click
  manual sequence.
- Inject time and randomness rather than calling `Date.now()` / `Math.random()` deep inside
  logic — then you can fast-forward a 25-minute timer in a test in 1ms.

```js
createTimer({ durationMs, now: () => Date.now() });  // swap `now` in tests
```

---

## 4. UI

Optimizes for: *anyone being able to use it, on any device, without thinking.*

### 4.1 Semantics first

- Use the real element: `<button>` for actions, `<a href>` for navigation, `<label for>` on
  every input, `<main>/<nav>/<section>` for landmarks.
  A `<div onclick>` is not a button — it loses keyboard access, focus, and screen-reader role.
- Heading levels descend without skipping (`h1 → h2 → h3`).
- Use ARIA only when semantics can't express it. **No ARIA is better than wrong ARIA.**

### 4.2 Keyboard access (WCAG 2.1.1, Level A)

- Everything interactive must be reachable and operable with **Tab / Shift+Tab / Enter /
  Space / Arrows / Esc**.
- **Never remove focus outlines.** Restyle them instead:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```
- Focus indicators need **≥3:1 contrast** against the unfocused state.
- Tab order must follow visual reading order — avoid positive `tabindex`.
- The focused element must not be hidden behind sticky headers or overlays (WCAG 2.2).
- No keyboard traps: whatever you can Tab into, you must be able to Tab out of. Modals get
  focus trapping *plus* an Esc exit and focus restored to the trigger on close.

### 4.3 Visual design

- **Contrast:** 4.5:1 for normal text, 3:1 for large text and UI component boundaries.
- **Never encode meaning in color alone** — pair color with an icon, label, or shape.
- **Touch/click targets ≥24×24 CSS px** (WCAG 2.2), 44px preferred for touch.
- Respect the user's theme: `color-scheme` plus `prefers-color-scheme` tokens.
- Use a consistent spacing scale (`--space-1..6`) and type scale. Arbitrary pixel values are
  what makes a UI feel subtly wrong.
- Don't restrict zoom: no `user-scalable=no`; the layout must survive 200% zoom and
  400% reflow.

### 4.4 Motion

Always gate animation behind the user's OS preference:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
Animate only `transform` and `opacity` (GPU-composited). Animating `width`/`top`/`left`
forces layout on every frame.

### 4.5 Feedback & state

Every interactive surface needs all five states designed, not just the happy one:
**idle · hover/focus · loading · empty · error**.

- Respond to input within 100ms — even if only with a spinner or disabled state.
- Announce dynamic changes to assistive tech with `aria-live="polite"` (e.g. "Session
  complete"), `assertive` only for genuine urgency.
- Errors must say what went wrong **and what to do next**. "Something went wrong" is not a
  message.
- Confirm destructive actions; better still, make them undoable.

### 4.6 Layout

- Mobile-first: write the small-screen rules, then add `min-width` media queries.
- Prefer intrinsic layout (Flexbox, Grid, `clamp()`, `minmax()`) over breakpoint-by-breakpoint
  pixel tuning.
- Use `rem` for type and spacing so the OS font-size setting is respected.
- Reserve space for async content (`aspect-ratio`, skeletons) to avoid layout shift.

### 4.7 Extension-specific UI

- Popups are small and transient. Give an explicit `width`/`min-height` on `<body>` or the
  popup will size unpredictably, and avoid content that reflows after paint.
- Popup state disappears when it closes — **persist anything the user typed** before it closes.
- Long-running or complex settings belong on an options page, not crammed into the popup.

---

## 5. Cross-cutting: Manifest V3 extension rules

These aren't optional style choices — violating them produces bugs that only appear
intermittently in the wild.

- **The service worker is not persistent.** It terminates after **30 seconds of inactivity**,
  after a single request exceeding 5 minutes, or if a fetch takes over 30 seconds.
- **Never keep state in global variables in the service worker.** It will be lost. Persist to
  `chrome.storage` (`.session` for ephemeral, `.local` for durable). `localStorage` /
  `sessionStorage` are **unavailable** in extension service workers.
- **Register all event listeners synchronously at the top level** of the service worker
  script. A listener registered inside a promise callback or after `await` will miss events
  when the worker is restarted to deliver them.
- **Use `chrome.alarms`, not `setTimeout`/`setInterval`,** for anything scheduled beyond the
  idle timeout — a pending timeout does not survive termination.
- **Return `true` from `chrome.runtime.onMessage` listeners** whenever you call
  `sendResponse` asynchronously, or the message port closes and the response is lost silently.
- Route messages **popup ↔ service worker ↔ content script**. Popup and content script should
  not be tightly coupled directly.
- **Request minimal permissions**, use `optional_permissions` for the rest, and prefer
  `activeTab` over broad host permissions. Over-requesting is the top cause of store review
  rejection.
- Keep all JS in separate files — MV3's CSP forbids inline scripts and `eval`.
- Design the worker to be **resilient to restart at any moment**: every handler should be able
  to rebuild whatever it needs from storage.

---

## 6. Domain notes: timers & audio

Directly relevant to MusicTimer, and a frequent source of "works on my machine" bugs.

### 6.1 Timer drift is guaranteed

`setInterval(fn, 1000)` does **not** fire every 1000ms. Error compounds from three sources:
event-loop scheduling jitter, callback execution time, and background-tab throttling
(Chrome throttles background timers to roughly once per minute).

**Don't** accumulate: `remaining -= 1000` on each tick. After 25 minutes you'll be seconds off.

**Do** compute from an absolute deadline every tick — drift never accumulates:

```js
const endAt = performance.now() + durationMs;      // or Date.now() if it must survive reload
function tick() {
  const remainingMs = Math.max(0, endAt - performance.now());
  render(remainingMs);
  if (remainingMs > 0) requestAnimationFrame(tick); else onComplete();
}
```

- Use `performance.now()` (monotonic) for *measuring elapsed time* — `Date.now()` can jump
  backwards when the system clock syncs.
- Use `Date.now()` / a stored absolute epoch timestamp for *deadlines that must survive*
  reload, sleep, or service-worker termination.
- On `visibilitychange`, recompute from the deadline rather than trusting tick counts.

### 6.2 Precision options, in order of preference

1. **Web Audio API clock** (`audioContext.currentTime`) — runs on a separate high-priority
   audio thread with a hardware clock, immune to main-thread lag and tab throttling. Correct
   choice for anything musically timed (metronome, beat-aligned transitions).
2. **Web Worker timer** — worker timers aren't throttled the way main-thread timers are; the
   worker posts ticks to the main thread for rendering.
3. **`chrome.alarms`** — for extension scheduling that must survive service-worker death.
4. **rAF + absolute deadline** — fine for a visible countdown display.

### 6.3 Audio handling

- Browsers block autoplay: audio must start from a user gesture. Create/resume the
  `AudioContext` inside the first click handler and keep it.
- Schedule audio events with a **lookahead scheduler** (schedule ~100ms ahead on a coarse
  timer, into precise `audioContext.currentTime` offsets) rather than firing sounds from a
  JS timer.
- Always handle the "context is suspended" state on return from a background tab.
- Clean up: disconnect nodes and release object URLs, or long sessions leak.

---

## Quick checklists

**Before committing**
- [ ] Names say what the thing is; units are in numeric names
- [ ] No `var`, no magic numbers, no commented-out code
- [ ] No empty `catch`; new failure paths log with context
- [ ] Logic changes didn't reach into the DOM from an engine module
- [ ] Constants extracted; no string duplicated across files

**Before shipping a UI change**
- [ ] Fully operable with the keyboard alone; focus visible everywhere
- [ ] Contrast checked (4.5:1 text, 3:1 UI)
- [ ] Works at 200% zoom and at the narrowest supported width
- [ ] `prefers-reduced-motion` respected
- [ ] Loading, empty, and error states exist

**Before shipping an extension change**
- [ ] Listeners registered synchronously at top level
- [ ] No state kept in service-worker globals
- [ ] `return true` on every async `onMessage` responder
- [ ] Tested *after* letting the service worker go idle 30+ seconds
- [ ] Permissions still minimal; `chrome://extensions` Errors panel is empty

---

## Sources

Readability
- [JavaScript Best Practices 2026 — Shrivex](https://shrivex.com/blog/modern-javascript-best-practices-in-2026-a-definitive-guide-for-professional-developers)
- [Best practices for writing clean, maintainable JavaScript — Raygun](https://raygun.com/blog/javascript-best-practices/)
- [Improving Code Readability in JavaScript — codeblib](https://codeblib.com/web-development/improving-code-readability-in-javascript-best-practices-for-clean-and-maintainable-code/)
- [Understanding CSS Naming Conventions: BEM, OOCSS, SMACSS — Frontend Mentor](https://www.frontendmentor.io/articles/understanding-css-naming-conventions-bem-oocss-smacss-and-suit-css-V6ZZUYs1xz)
- [Mastering Class Naming Conventions: BEM — Wisp](https://www.wisp.blog/blog/mastering-class-naming-conventions-a-deep-dive-into-bem)

Scalability
- [Signs Your Frontend Architecture Is No Longer Scalable — AlterSquare](https://altersquare.medium.com/signs-your-frontend-architecture-is-no-longer-scalable-89355870e821)
- [Frontend State Management in 2026 — Tech Champion](https://tech-champion.com/websites/frontend-state-management-in-2026-balancing-performance-with-developer-ergonomics/)
- [Frontend System Design: The Complete Guide 2026](https://www.systemdesignhandbook.com/guides/frontend-system-design/)
- [Scalable Frontend Architecture Guide — GitNexa](https://www.gitnexa.com/blogs/scalable-frontend-architecture-guide)
- [How to Structure a Production-Ready Chrome Extension (MV3) — DEV](https://dev.to/hewitt/how-to-structure-a-production-ready-chrome-extension-manifest-v3-2hlf)

Debugging
- [Debug Frontend Apps Like a Pro — Feature-Sliced Design](https://feature-sliced.design/blog/frontend-debugging-guide)
- [Frontend Log Monitoring Guide — Webeyez](https://webeyez.com/insights/guides/frontend-log-monitoring-guide)
- [Error Logging: Client-Side and Server-Side (2026) — Inspectlet](https://www.inspectlet.com/guides/error-logging)
- [Debug extensions — Chrome for Developers](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug)
- [DevTools Tips: Debugging Chrome extensions — Chrome for Developers](https://developer.chrome.com/blog/devtools-tips-27/)
- [Debugging Chrome Extensions — Plasmo](https://www.plasmo.com/blog/posts/debugging-browser-extensions)

UI / Accessibility
- [WCAG 2.1.1 Keyboard Accessibility Guide (2026) — UXPin](https://www.uxpin.com/studio/blog/wcag-211-keyboard-accessibility-explained/)
- [Accessible Responsive Web Design & WCAG 2.2](https://wcagpros.com/wcag-guidelines/in-depth-guide-to-accessible-responsive-web-design-wcag-22/)
- [How to Make Your UI Accessible: A Practical Checklist for 2026 — Muzli](https://muz.li/blog/how-to-make-your-ui-accessible-a-practical-checklist-for-2026/)
- [Accessibility for Design Engineers: WCAG 2.2 Guide — Inhaq](https://inhaq.com/blog/accessibility-for-design-engineers-building-inclusive-uis.html)

Extensions & timing
- [The extension service worker lifecycle — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Migrate to a service worker — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers)
- [Building Chrome Extensions in 2026: A Practical Guide with Manifest V3 — DEV](https://dev.to/ryu0705/building-chrome-extensions-in-2026-a-practical-guide-with-manifest-v3-12h2)
- [Why JavaScript Timers Drift: High-Precision Metronome with Web Audio — DEV](https://dev.to/kandz/why-javascript-timers-drift-building-a-high-precision-metronome-with-web-audio-api-c0a)
- [Why do browsers throttle JavaScript timers? — Nolan Lawson](https://nolanlawson.com/2025/08/31/why-do-browsers-throttle-javascript-timers/)
- [More Accurate JavaScript Timers with Web Workers — HackWild](https://hackwild.com/article/web-worker-timers/)
