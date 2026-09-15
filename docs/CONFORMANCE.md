# Conformance Checklist

Machine-runnable form of [BEST_PRACTICES.md](BEST_PRACTICES.md). Where that document
explains *why*, this one states **what must be true** and **how to prove it**.

## How to run this audit

Run the `/conform` skill ([.claude/skills/conform/SKILL.md](../.claude/skills/conform/SKILL.md)),
which carries the procedure. Failing that, give an LLM this prompt:

> Audit this repository against `docs/CONFORMANCE.md`. Work through every requirement in
> order. For each, run the stated Check, then record PASS, FAIL, or N/A with one line of
> evidence (file:line). Do not report anything listed under "Accepted debt" unless the
> reason given there has stopped being true. Output a table, then a short list of only the
> FAILs, ranked by the severity column.

Run the automated layer first — it settles several requirements in seconds and tells you
whether the tree is even in a checkable state. Glob the suites rather than listing them;
this line has already gone stale once:

```bash
npx -y -p typescript@5 tsc --noEmit -p tsconfig.json && for f in test/*.test.js; do node "$f" || exit 1; done
```

Rules for the auditor:

- **Evidence or it didn't happen.** Every verdict cites a file and line, or the exact
  command run and its output. "Looks fine" is not a verdict.
- **A Check that finds nothing is a PASS only if the Check was capable of finding
  something.** Confirm the grep pattern matches at least one known-good instance first.
- **Do not fix anything during an audit.** Report only. Fixing is a separate pass.
- **N/A requires a reason.** e.g. "no React in this project".

Severity: **S1** correctness or accessibility failure · **S2** will cause a debugging dead
end · **S3** maintainability drag.

---

## R — Readability

### R-01 — No `var` · S3
**Requirement:** `var` is never used.
**Check:** `grep -rnE "\bvar\b" --include=*.js src/`  (JS only — CSS `var(--x)` is not this)
**Fails if:** any match outside a comment or string.

### R-02 — Units in numeric names · S2
**Requirement:** Any identifier holding a number with a unit names that unit
(`Ms`, `Sec`, `Px`, `Pct`, `Count`).
**Check:** Read every `const`/`let` declaration and parameter whose value is numeric.
**Fails if:** a duration, size, or percentage is named without its unit (`delay`, `timeout`,
`width` where the value is a number).

### R-03 — No abbreviated identifiers · S3
**Requirement:** Identifiers are whole words. Permitted exceptions: loop indices `i`/`j`,
a single-purpose `$` DOM helper, `el`, `id`, `ms`, and conventional short names in a
2-line arrow function.
**Check:** Read all top-level declarations and exported names in `src/`.
**Fails if:** a name is a truncation (`fmt`, `cfg`, `btn`, `hdlr`, `tmr`, `seg`, `snap`).

### R-04 — Booleans read as assertions · S3
**Requirement:** Boolean variables and returns start `is`/`has`/`can`/`should`, or are an
unambiguous adjective (`playing`, `running`, `eligible`, `weak`).
**Check:** Read boolean declarations and object fields.
**Fails if:** a boolean is named as a noun (`flag`, `status`, `state`).

### R-05 — No magic numbers · S3
**Requirement:** Every numeric literal other than `0`, `1`, `-1`, `2`, `100`, and array
indices is a named constant declared at module top.
**Check:** `grep -rnE "[^a-zA-Z0-9_.\"'][0-9]{3,}" src/`
**Fails if:** a multi-digit literal appears inline in a function body.
**Exempt:** CSS values, colour hex, and literals inside a `test/` fixture.

### R-06 — No duplicated string literals across files · S2
**Requirement:** A string used in more than one file is a named constant in one shared
module, imported by the rest. Applies especially to message types and command names.
**Check:** Extract all quoted literals from `src/`, count files each appears in.
**Fails if:** any literal appears in two or more files as a raw literal.

### R-07 — Comments explain why · S3
**Requirement:** Comments state rationale, constraint, or non-obvious consequence.
**Check:** Read every comment in `src/`.
**Fails if:** a comment restates the line below it, or a non-obvious constant has no
justification.

### R-08 — No commented-out code · S3
**Check:** `grep -rnE "^\s*(//|/\*)\s*(const|let|function|if|for|return|await|chrome\.)" src/`
**Fails if:** any match.

### R-09 — File size · S3
**Requirement:** No file in `src/` exceeds 300 lines without an entry in Accepted debt.
**Check:** `wc -l src/**/*.js src/*.css`
**Fails if:** over 300 and unlisted.

### R-10 — CSS naming is one convention · S3
**Requirement:** All CSS class names are kebab-case. Components with internal parts use
BEM (`block__element`, `block--modifier`). Bare element selectors are allowed for
`button`, `header`, `section`, `footer`.
**Check:** `grep -oE "\.[A-Za-z][A-Za-z0-9_-]*" src/*.css | sort -u`
**Fails if:** any class contains an uppercase letter, or a component has parts styled via
descendant selectors on generic names (`.thing .name`).

### R-11 — No class-name collisions across meanings · S2
**Requirement:** A class name means one thing. The same modifier word must not be reused
for two unrelated states on two unrelated blocks.
**Check:** For each class used in two or more rules, confirm one meaning.
**Fails if:** e.g. `.live` styles both a status dot and a list row.

### R-12 — No raw values in component CSS · S3
**Requirement:** Colours, spacing, and radii in component rules reference a `:root` custom
property.
**Check:** `grep -nE "#[0-9a-fA-F]{3,8}|rgba?\(" src/*.css`
**Fails if:** a hex or rgb() value appears outside the `:root` block.
**Exempt:** documented one-off states listed in Accepted debt.

### R-13 — Type check is clean · S1
**Requirement:** `tsc --noEmit` reports zero errors against `tsconfig.json`.
**Check:** `npx -y -p typescript@5 tsc --noEmit -p tsconfig.json; echo $?`
**Fails if:** exit code is not 0.
**Note — the strictness ratchet.** The current config has `strict: false` and
`strictNullChecks: false`, because turning them on today buries real findings under
thousands of "possibly null" notes on DOM lookups that `popup.html` guarantees. That is a
deliberate floor, not a ceiling: raise one flag at a time, fix the fallout, and record the
new floor here. Never lower it to make an error go away.

### R-14 — Every shipped file opts into checking · S2
**Requirement:** Every `.js` file under `src/` begins with `// @ts-check`.
**Check:** `for f in src/**/*.js; do head -1 "$f" | grep -q "@ts-check" || echo "$f"; done`
**Fails if:** any file is listed.
**Why it is separate from R-13:** a file with no `@ts-check` passes R-13 trivially. Opting
out is how a type check quietly stops covering anything.

### R-15 — The checker is known to work · S2
**Requirement:** The type check must be demonstrably capable of failing.
**Check:** Create `src/__probe.js` containing a misspelled property on a declared type, a
bad `MT.ACTION.*` name, and a call with the wrong arity. Run R-13's command. Delete the probe.
**Fails if:** the probe does not produce errors.
**Why:** a green check that cannot go red is worse than no check — it manufactures
confidence. Re-run this whenever `tsconfig.json` or `types/` changes.

---

## S — Scalability

### S-01 — Platform APIs are wrapped · S3
**Requirement:** `chrome.storage` is never called from feature logic; it is reached through
a named accessor pair (get/put) in one place per store.
**Check:** `grep -rn "chrome.storage" src/`
**Fails if:** matches appear in more than one file, or inside a branch of business logic.

### S-02 — One owner per piece of state · S1
**Requirement:** No value is stored in two places. Derived values are computed, not cached.
**Check:** Read the persisted state shape and every in-memory variable.
**Fails if:** the same fact (e.g. elapsed time) is both stored and recomputed from a
second stored field that could disagree.

### S-03 — Logic is separable from the DOM · S2
**Requirement:** No module contains both business rules and `document.*` calls.
**Check:** For each file, `grep -c "document\.\|getElementById" ` and read for branching logic.
**Fails if:** a file both queries the DOM and decides application behaviour.
**N/A:** for files that are purely a view.

### S-04 — Features do not import from features · S3
**Requirement:** Shared code lives in `src/shared/`. No file in one feature references
another feature's internals.
**Check:** Read import/`importScripts`/script-tag graph.
**Fails if:** a cycle exists, or a cross-feature reference is not via `shared/`.

### S-05 — Shared module stays small · S3
**Requirement:** Every file in `src/shared/` is used by two or more contexts.
**Check:** For each shared file, count referencing files.
**Fails if:** a shared file has one consumer (it belongs to that consumer).

### S-06 — Persisted data is versioned · S1
**Requirement:** Anything written to durable storage carries a schema version, and a
migration exists for every version ever shipped.
**Check:** Read the normalize/migrate function; confirm a test seeds each old shape.
**Fails if:** no version field, or a shipped version has no migration test.

### S-07 — DOM lookups are not repeated per frame · S3
**Requirement:** Elements referenced on every render are looked up once at init.
**Check:** Read the render path for `getElementById` / `querySelector` calls.
**Fails if:** a lookup for a static element occurs inside a function called on a timer.

### S-08 — No abstraction with one caller · S3
**Requirement:** Rule of three — a helper exists because it has three uses, or because it
isolates a platform dependency.
**Check:** For each helper, count call sites.
**Fails if:** a single-use indirection exists purely for structure.

### S-09 — No premature restructuring · S3
**Requirement:** Folder depth is justified by file count. Under ~10 source files, flat is
correct.
**Check:** `find src -type f | wc -l` against directory depth.
**Fails if:** nesting exceeds what the file count warrants.

---

## D — Debugging

### D-01 — A logger exists and is shared · S2
**Requirement:** One logging module, used by every execution context.
**Check:** `grep -rln "log\.\(debug\|info\|warn\|error\)" src/`
**Fails if:** no logger module, or any context uses bare `console.*`.

### D-02 — Log lines are structured · S2
**Requirement:** Every log call is `log.<level>("namespace:event", contextObject)`. The
event string is a stable identifier, not interpolated prose.
**Check:** Read every `log.` call site.
**Fails if:** an event string contains a template literal or variable interpolation, or the
second argument is a string rather than an object.

### D-03 — No silent catch · S1
**Requirement:** Every `catch` block does at least one of: rethrow, log, or carry an
`// intentional-silent:` annotation giving the reason.
**Check:** `grep -rn "catch" src/` then read each block.
**Fails if:** a catch body has no `log.`, no `throw`, and no annotation.

### D-04 — Global error handlers in every context · S2
**Requirement:** Each of service worker, content script, and popup installs handlers for
uncaught errors and unhandled rejections.
**Check:** `grep -rn "unhandledrejection\|addEventListener(\"error\"" src/`
**Fails if:** fewer than one per context.

### D-05 — Unknown inputs are loud · S1
**Requirement:** Every `switch` over an external input has a `default` that logs at `warn`
or above. Every message handler rejects unrecognised types visibly.
**Check:** `grep -rn "default:" src/`
**Fails if:** a default silently breaks or returns.

### D-06 — Platform error channels are read · S2
**Requirement:** `chrome.runtime.lastError` is checked and surfaced, not discarded.
**Check:** `grep -rn "lastError" src/`
**Fails if:** a reference exists whose only effect is to suppress the warning.

### D-07 — Degradation is observable · S1
**Requirement:** Any code path that silently falls back to reduced functionality (a drifted
selector, a missing element, a failed detection) logs at `warn` the first time it happens.
**Check:** Identify every fallback branch; confirm each has a log.
**Fails if:** a fallback is reachable with no signal.

### D-08 — Log volume is bounded · S2
**Requirement:** No log line can be emitted by a polling loop on every tick. Repeating
conditions use a once-per-key or throttled emitter.
**Check:** Trace every `log.` call to whether a timer can reach it.
**Fails if:** an unthrottled log sits in a `setInterval` body or a per-tick function.

### D-09 — Levels are honest and adjustable · S3
**Requirement:** A single switch changes verbosity for the whole extension without editing
call sites.
**Check:** Confirm a `setLevel` (or equivalent) exists and is reachable.
**Fails if:** silencing logs requires deleting or commenting them.

### D-10 — Time and randomness are injectable · S2
**Requirement:** Logic that depends on the clock can be driven by a test.
**Check:** Confirm tests advance a fake clock rather than sleeping.
**Fails if:** any test contains a real `setTimeout`/sleep to wait for logic.

### D-11 — Detection and parsing layers have tests · S1
**Requirement:** Any module that reads an external structure it does not control (DOM
selectors, URLs, API shapes) has tests against captured fixtures.
**Check:** `ls test/` against `ls src/`.
**Fails if:** a parsing/detection module has no corresponding test file.

### D-12 — Tests assert behaviour, not implementation · S3
**Requirement:** Tests exercise the real module under a stubbed platform, not a
reimplementation of it.
**Check:** Read the harness for what it stubs.
**Fails if:** the harness reimplements logic that the test then asserts.

---

## U — UI

### U-01 — Interactive elements are interactive elements · S1
**Requirement:** Anything with a click handler is a `<button>`, `<a href>`, or an input —
or carries a role, `tabindex="0"`, and Enter/Space handling.
**Check:** `grep -rn "addEventListener(\"click\"" src/` and read what it is attached to.
**Fails if:** a `<div>`/`<span>` receives a click handler without the full treatment.

### U-02 — Visible focus everywhere · S1
**Requirement:** A `:focus-visible` rule exists and is not overridden to `outline: none`
anywhere.
**Check:** `grep -n "focus-visible\|outline" src/*.css`
**Fails if:** no `:focus-visible` rule, or any `outline: none` without a replacement
indicator.

### U-03 — Focus indicator contrast · S1
**Requirement:** The focus indicator has ≥3:1 contrast against the adjacent background.
**Check:** Compute the ratio between the outline colour and the surface behind it.
**Fails if:** below 3:1.

### U-04 — Dynamic status is announced · S1
**Requirement:** Regions whose text changes without user action carry `aria-live="polite"`.
**Check:** `grep -n "aria-live" src/*.html` against elements written to in the render path.
**Fails if:** a live-updating region has no live region role.

### U-05 — Reduced motion respected · S2
**Requirement:** A `@media (prefers-reduced-motion: reduce)` block neutralises transitions
and animations.
**Check:** `grep -n "prefers-reduced-motion" src/*.css`
**Fails if:** transitions or animations exist with no such block.

### U-06 — Text contrast · S1
**Requirement:** 4.5:1 for body text, 3:1 for large text and UI boundaries.
**Check:** Compute ratios for every foreground/background token pairing actually used.
**Fails if:** any pairing falls short.

### U-07 — Keyboard reachability of every feature · S1
**Requirement:** Every action available by mouse is reachable and operable by keyboard
alone, in a logical tab order, with no traps.
**Check:** Enumerate every user action; trace a keyboard path to each.
**Fails if:** any action is mouse-only.

### U-08 — Destructive actions are confirmed and escapable · S2
**Requirement:** A destructive action requires confirmation, and the pending confirmation
can be cancelled by Escape or by clicking away.
**Check:** Read the handler.
**Fails if:** the pending state has no cancel path.

### U-09 — Five states exist · S2
**Requirement:** Every surface has idle, focus, loading/pending, empty, and error
presentations.
**Check:** Read the render path for each region.
**Fails if:** a region can render blank with no explanatory text.

### U-10 — Document metadata · S3
**Requirement:** `lang` on `<html>`, a `<title>`, a `<label>` or `aria-label` on every
input.
**Check:** Read the HTML.
**Fails if:** any missing.

---

## M — Manifest V3

### M-01 — No state in service-worker globals · S1
**Requirement:** No mutable module-level variable in the service worker holds data that
must outlive an event.
**Check:** Read all top-level `let`/`const` in the worker.
**Fails if:** any is written to from a handler and read by a later one.

### M-02 — Listeners registered synchronously · S1
**Requirement:** Every `chrome.*.addListener` call is at the top level of the worker script,
not inside a callback, `then`, or after an `await`.
**Check:** `grep -n "addListener" src/background.js` and check indentation/scope.
**Fails if:** any is nested.

### M-03 — Async responders return true · S1
**Requirement:** Every `onMessage` branch that calls `sendResponse` asynchronously returns
`true` on the synchronous path.
**Check:** Read every branch of the message listener.
**Fails if:** a branch resolves a promise into `sendResponse` without returning `true`.

### M-04 — Scheduling survives termination · S1
**Requirement:** Recurring work in the worker uses `chrome.alarms`, never
`setTimeout`/`setInterval`.
**Check:** `grep -n "setTimeout\|setInterval" src/background.js`
**Fails if:** any match.

### M-05 — Minimal permissions · S2
**Requirement:** Every entry in `permissions` and `host_permissions` is used.
**Check:** For each permission, grep for the API that needs it.
**Fails if:** a permission has no corresponding call site.

### M-06 — No inline script · S1
**Check:** `grep -n "onclick=\|javascript:\|<script>" src/*.html`
**Fails if:** any match.

---

## T — Timing

### T-01 — Elapsed time derives from timestamps · S1
**Requirement:** Durations are computed as `end - start`, never accumulated per tick.
**Check:** Read the clock module.
**Fails if:** a variable is incremented by a fixed interval amount.

### T-02 — Correct clock for the job · S2
**Requirement:** `performance.now()` for measuring an interval within one page life;
a stored absolute epoch for deadlines that must survive reload or worker death.
**Check:** Read every `Date.now()` / `performance.now()` call.
**Fails if:** `Date.now()` is used for an interval measurement that a clock adjustment
could corrupt, or `performance.now()` is persisted.

### T-03 — Throttling assumptions are documented · S2
**Requirement:** Any reliance on a browser not throttling a timer is stated in a comment
naming the condition that makes it safe.
**Check:** Read every `setInterval` in a page context.
**Fails if:** the interval is load-bearing and the exemption it relies on is unstated.

---


## Accepted debt

Deviations that are known, deliberate, and not to be re-reported. Each needs a reason and a
trigger that would make it worth fixing. **Check the triggers on every audit** — a fired
trigger is a finding — and re-run `wc -l` rather than trusting the counts below, which go
stale.

| Req | Where | Reason | Revisit when |
|---|---|---|---|
| R-09 | `src/content.js` (335 lines) | Three site adapters in one file, each a self-contained object literal sharing the same detection core. Splitting them per-site would create three ~80-line files and a loader, for no reader benefit. | A fourth site is added, or an adapter grows past ~120 lines |
| S-05 | `src/shared/playback.js` has one runtime consumer (`content.js`) | It sits in `shared/` for S-03 and D-10, not for reuse: keeping it free of DOM and chrome APIs is what makes playback detection unit-testable, and `test/playback.test.js` is the second consumer. | A second runtime context needs playback detection, or the testability argument stops holding |
| S-09 | `src/` is near-flat | 6 source files. Feature-first folders would be premature per BEST_PRACTICES §2.8. | Source files exceed ~10, or a second feature appears |

**Retired 2026-09-15.** The R-09 entry for `src/background.js`: its "passes ~600 lines"
trigger fired at 641, so it is an open finding now, not debt. The R-12 entry for one-off
surface tints: its stated reason ("exactly one rule each") stopped being true when
`rgba(42, 26, 22, 0.5)` appeared in a second rule.

---

## Baseline audit — 2026-09-15

Full sweep. The previous baseline was 2026-09-12, which predated laps,
`shared/playback.js`, tab backfill and the Timber & Sprout UI.

**Automated layer:** `tsc --noEmit` exit 0 · 104 assertions pass / 0 fail across 5 suites
(backfill 5, background 40, laps 28, migration 13, playback 18).

| Req | Verdict | Evidence |
|---|---|---|
| R-01 | PASS | no `var` in `src/**/*.js` |
| R-02 | PASS | `STALE_MS`, `POLL_MS`, `STALL_WINDOW_MS`, `LOCAL_TICK_MS`, `SYNC_INTERVAL_MS` |
| R-03 | PASS | no truncated identifiers |
| R-04 | PASS | `isConfirmingDelete`, `isEditing`, `settingsOpen`, `eligible` |
| R-05 | PASS | remaining literals are unit arithmetic (1000, 3600, 60000) inside formatters. Minor: `60000` doubles as a badge threshold at background.js:313 and deserves a name |
| R-06 | PASS | no `mt:*` literal outside `shared/contract.js` |
| R-07 | PASS | spot-checked; comments carry rationale, including the U-01 cross-reference at popup.js:367 |
| R-08 | PASS | none |
| R-09 | **FAIL** | `background.js` 641 (its own ~600 trigger fired), `popup.js` 573, `popup.css` 588 — all over 300, none currently covered by debt |
| R-10 | PASS | no camelCase class in `popup.css` |
| R-11 | PASS | no modifier reused across unrelated blocks |
| R-12 | **FAIL** | 4 raw values outside `:root`; `rgba(42,26,22,0.5)` now in two rules (popup.css:263, :546), so the old debt reason no longer holds |
| R-13 | PASS | `tsc --noEmit` exit 0 |
| R-14 | PASS | 6/6 files in `src/` carry `// @ts-check` |
| R-15 | PASS | probe caught 5/5, including the new `CurrentLap` and `lapStartMs` fields |
| S-01 | PASS | `chrome.storage` only in background.js, behind get/put accessors |
| S-02 | PASS | elapsed derived from `{accumulatedMs, runningSince}`, never stored twice |
| S-03 | **FAIL** | `popup.js` carries 50 `document`/`getElementById` references alongside behaviour — unchanged since the last baseline |
| S-04 | PASS | no cross-feature imports; `shared/` only |
| S-05 | debt | `playback.js` has one runtime consumer — see debt table |
| S-06 | **FAIL** | `state.version` is hard-coded 2 and was never bumped when laps were added. The laps migration shape-sniffs instead (`if (!Array.isArray(timer.laps))`), so the version field no longer identifies the schema it labels |
| S-07 | PASS | no `getElementById` in the render path; `elements` cached at init |
| S-08 | PASS | single-call `render*` helpers are decomposition of one long function, not speculative abstraction |
| S-09 | debt | 6 source files — trigger not fired |
| D-01 | PASS | no bare `console.*` outside `shared/logger.js` |
| D-02 | PASS | 39 call sites, every event string a literal (interpolation appears only in `warnOnce` keys, which is their purpose) |
| D-03 | PASS | 8 catch blocks, all log |
| D-04 | PASS | `installGlobalErrorHandlers` in all three contexts |
| D-05 | PASS | `command:unknown-action` warns at background.js:467 |
| D-06 | PASS | `lastError` read and surfaced at content.js:293 |
| D-07 | PASS | `adapter:*-failed`, `source:stale`, `inject:backfill-failed` |
| D-08 | PASS | `warnOnce` on every poll-reachable path |
| D-09 | PASS | `mtLogger.setLevel` / `MT_LOG_LEVEL` |
| D-10 | PASS | fake clock via `Date.now` proxy + `advance()` |
| D-11 | **FAIL** | narrowed but not closed: `playback.js` now has 18 assertions, but the three site adapters in `content.js` still have no fixture tests — no test file references `adapters`, `buttonPlaying`, or any selector |
| D-12 | PASS | harness stubs `chrome` only |
| U-01 | **FAIL** | lap rows were fixed (role, tabIndex, keydown at popup.js:366-380); timer rows are still a bare `<div>` plus click at popup.js:168/211 |
| U-02 | PASS | `button:focus-visible` and `.lap-list__row--closed:focus-visible`; it cannot reach the timer rows, which U-01 keeps unfocusable |
| U-03 | PASS | focus ring `--accent #72b558` on `--panel` = 6.73:1 (needs 3) |
| U-04 | **FAIL** | no `aria-live` anywhere; the now-playing block rewrites without user action |
| U-05 | **FAIL** | 3 transitions (popup.css:64, :154, :272) with no `prefers-reduced-motion` block |
| U-06 | **FAIL** | `--warm-muted #855e50` on `--bg` = 3.24:1, needs 4.5 — used for the "recorded" label and collapsed-summary times. Every other pairing passes (`--text` 15.75, `--muted` 10.77, `--danger` 8.83) |
| U-07 | **FAIL** | selecting a timer is mouse-only; laps are now keyboard-operable |
| U-08 | **FAIL** | the "Sure?" delete confirmation has no Escape or click-away cancel |
| U-09 | PASS | `statusParts()` branches for playing, filtered-out, sticky-paused, no-tabs and waiting |
| U-10 | PASS | `lang="en"`, `<title>`, `aria-label` on every icon button |
| M-01 | PASS | no mutable worker global carries cross-event state |
| M-02 | PASS | all 5 `addListener` calls at top level, none nested |
| M-03 | PASS | all three async branches `return true` |
| M-04 | PASS | no `setTimeout`/`setInterval` in the worker |
| M-05 | PASS | `storage`, `alarms`, `scripting` all used; `tabs` deliberately not requested — `tabs.query` rides on host permissions |
| M-06 | PASS | no inline script |
| T-01 | PASS | `{accumulatedMs, runningSince}`, never accumulated per tick |
| T-02 | PASS | epoch timestamps, required to survive worker death |
| T-03 | PASS | throttling assumption documented at the content.js poll |

**Open, by severity.** S1: R-09 (background.js past its own trigger), S-06, D-11, U-01,
U-04, U-06, U-07. S2: S-03, U-05, U-08. S3: R-12.

**Movement since 2026-09-12.** Fixed: U-02, and U-01/U-07 for lap rows only. Newly failing:
R-09 (background.js 491 → 641; popup.js and popup.css both newly over), R-12, S-06, U-06.
Unchanged: S-03, D-11 (narrowed), and U-01/U-04/U-05/U-07/U-08 for timer rows.

### Not in the checklist

Observations from this run that no requirement covers. Candidates for new requirements, not
conformance verdicts.

- **Reuse is healthier than the file sizes suggest.** A structural scan for duplicated
  5-line blocks across all six source files found 3, two of which overlap the same region.
  `buildInlineNameInput` already serves both the timer and lap rename flows through an
  `onCommit`/`onCancel` spec, and `firstText` is shared by all three site adapters. The one
  residue is a 4-line `append / querySelector / focus / select` epilogue repeated at
  popup.js:173 and :356.
- **No requirement covers duplication directly.** R-06 catches duplicated *string literals*
  only. A "no duplicated logic block" rule would have to be judgement-based, since the three
  site adapters are deliberately parallel rather than redundant.
- **Contrast is checked by hand.** U-03 and U-06 required computing ratios manually; nothing
  in the toolchain would catch a palette regression.

### Toolchain, as of this audit

| Layer | Covers | Runs |
|---|---|---|
| `tsc --noEmit` + `types/` | R-13, R-14, R-15; mechanically prevents R-06 regressions | editor, on every keystroke; CLI on demand |
| `node test/*.js` (5 suites, 104 assertions) | T-01, T-02, D-10, D-12 | CLI, ~1s |
| `/conform` skill + this document | everything requiring judgement | on request |

`types/` is hand-written rather than `@types/chrome`, so the repo keeps zero dependencies
and no `node_modules`. The trade is that a chrome API we have not declared is an error
rather than a silent any — which is the intended behaviour, not a defect: adding to
`types/chrome.d.ts` should be a conscious act. Not yet automated: ESLint and Prettier, which
would need a `package.json` this project deliberately does not have; and contrast checking,
which caught U-06 this run only because it was computed by hand.
