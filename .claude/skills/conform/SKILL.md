---
name: conform
description: Audit the MusicTimer codebase against docs/CONFORMANCE.md, the project's checkable coding standard. Runs the type check and test suites first, then works through the numbered requirements and reports PASS/FAIL/N-A with file:line evidence. Use when asked to review the code, run a conformance audit, check quality or standards, find what regressed, or sanity-check before shipping. Accepts an optional scope argument - a category letter (R, S, D, U, M, T), a single requirement id (D-03), or "diff" to check only uncommitted changes.
---

# Conform — audit against the project standard

Audit this repository against [`docs/CONFORMANCE.md`](../../../docs/CONFORMANCE.md).

That document is the source of truth for *what must be true* and *how to prove it*. This
skill is the procedure for working through it. **Do not restate its requirements here and
do not invent new ones** — read it at the start of every run, because it changes.
[`docs/BEST_PRACTICES.md`](../../../docs/BEST_PRACTICES.md) explains the reasoning behind
each rule; consult it only when a verdict is genuinely arguable.

## Step 1 — the automated layer, first

It settles several requirements in seconds and tells you whether the tree is even in a
checkable state. Never skip it and never audit a tree that fails it: a type error can make
every downstream reading unreliable.

```bash
npx -y -p typescript@5 tsc --noEmit -p tsconfig.json
```

```bash
node test/background.test.js && node test/migration.test.js && node test/laps.test.js && node test/playback.test.js && node test/backfill.test.js
```

Report the real numbers — assertions passed, assertions failed, exit codes. If either
command fails, **stop and report that**. A failing build or suite outranks every style
finding in the document, and fixing it changes what the rest of the audit would say.

If new test files have appeared since this skill was written, run those too:
`ls test/*.test.js`.

## Step 2 — work the requirement list

Go through `docs/CONFORMANCE.md` in order. For each requirement, run its stated Check, then
record a verdict with one line of evidence.

Rules, which are the whole point of the exercise:

- **Evidence or it didn't happen.** Every verdict cites `file.js:123`, or the exact command
  run and its output. "Looks fine" is not a verdict.
- **A Check that finds nothing is a PASS only if the Check could have found something.**
  Before trusting a clean grep, confirm the pattern matches a known-good instance. This is
  R-15 generalised: a check that cannot go red manufactures confidence.
- **Do not fix anything.** Report only. Fixing is a separate pass the user asks for
  explicitly — mixing them means the user never sees the true state of the tree.
- **Respect Accepted debt.** That table lists deviations that are deliberate. Do not
  re-report them. Do check each one's "Revisit when" trigger — if a trigger has fired (a
  file outgrew its stated size, a fourth adapter appeared), say so; that is a real finding.
- **N/A requires a reason.** "No React in this project", not a blank.
- **Verify the debt table's own numbers.** It cites line counts that go stale. Run
  `wc -l` rather than trusting them.

## Scope argument

Default is a full sweep. When the user passes a scope, honour it and say what you skipped:

| Argument | Meaning |
|---|---|
| *(none)* | Every requirement in the document |
| `R` / `S` / `D` / `U` / `M` / `T` | That category only — Readability, Scalability, Debugging, UI, Manifest V3, Timing |
| `D-03` | That single requirement, in depth |
| `diff` | Only requirements reachable from the uncommitted changes (`git status --short`, `git diff`). Still run Step 1 in full. |

## Output

1. **Header line:** type check result, test result, scope audited.
2. **A table:** `Req | Verdict | Evidence`. Every requirement in scope gets a row.
3. **Then only the FAILs**, ranked by the document's severity column (S1 correctness or
   accessibility, S2 debugging dead end, S3 maintainability drag). For each: what is wrong,
   where, and what the fix would be — one or two sentences, no patches.
4. **Anything the document does not cover** but that you believe is a real defect, in a
   clearly separate "Not in the checklist" section, so it never gets confused with a
   conformance verdict. If a finding there is worth enforcing from now on, propose it as a
   new numbered requirement — new rules belong in `docs/CONFORMANCE.md`, not in an
   ad-hoc opinion.

Keep it terse. A long audit that nobody reads is worse than a short one that gets acted on.

## Updating the baseline

The document ends with a dated **Baseline audit** table. After a *full* sweep — never after
a scoped one — offer to replace it with the run you just did, and to date it today. Do not
overwrite it without being asked: the old baseline is what makes the new one a diff rather
than an isolated snapshot.

If the existing baseline is more than a few commits old, say so in the header line. A stale
baseline invites the reader to trust verdicts that no longer hold.
