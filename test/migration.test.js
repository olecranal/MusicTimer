/* The v1 build stored a single unnamed timer at the top level of chrome.storage.local.
 * Anyone upgrading must keep the time they had already banked. */
const { createWorker, check, finish } = require("./harness");

const V1 = {
  "mt.state": {
    mode: "sticky",
    filter: { id: "ytmusic:PL_old", name: "Old Playlist", site: "ytmusic" },
    running: true,
    runningSince: 1699999990000, // mid-run when the upgrade happened
    accumulatedMs: 3 * 60 * 60 * 1000 + 25 * 60 * 1000, // 3h25m
    armed: true,
    rearmBlocked: false,
    daily: { "2026-09-10": 5000 },
    lastActive: { siteLabel: "YouTube Music", title: "Old song", artist: null, contextName: "Old Playlist" },
  },
};

(async () => {
  const { get, cmd, report } = createWorker({ seedLocal: V1 });

  let s = await get();
  check("v1 time is preserved", Math.round(s.elapsedMs / 60000), 205);
  check("v1 mode is preserved", s.mode, "sticky");
  check("v1 playlist binding is preserved", s.filter.name, "Old Playlist");
  check("it becomes a single named timer", s.timers.map((t) => t.name), ["My timer"]);
  check("and that timer is active", s.activeId, s.timers[0].id);

  // The migrated timer must behave like any other - it can be joined by new ones.
  await cmd("addTimer", { name: "Gaming" });
  s = await get();
  check("new timers sit alongside it", s.timers.map((t) => t.name), ["My timer", "Gaming"]);
  check("the migrated total is untouched", Math.round(s.timers[0].elapsedMs / 60000), 205);

  // A second load must not migrate again and duplicate the timer.
  await report(1, { playing: false });
  s = await get();
  check("migration is not repeated", s.timers.length, 2);

  // Timers saved before laps shipped have no `laps` / `lapStartMs` at all.
  const PRE_LAPS = {
    "mt.state": {
      version: 2,
      activeId: "t1",
      order: ["t1"],
      timers: {
        t1: {
          id: "t1",
          name: "Work",
          mode: "auto",
          filter: null,
          running: false,
          runningSince: null,
          accumulatedMs: 90 * 60 * 1000,
          armed: false,
          rearmBlocked: false,
          daily: {},
          lastActive: null,
        },
      },
    },
  };

  const preLaps = createWorker({ seedLocal: PRE_LAPS });
  let older = await preLaps.get();
  check("a pre-lap timer keeps its total", Math.round(older.elapsedMs / 60000), 90);
  check("and gains an empty lap history", older.laps.length, 0);
  check("with the open lap covering everything so far", Math.round(older.currentLap.durationMs / 60000), 90);

  await preLaps.cmd("lap");
  older = await preLaps.get();
  check("lapping a pre-lap timer banks the time it already had", Math.round(older.laps[0].durationMs / 60000), 90);
  check("named from its timer", older.laps[0].name, "Work - lap 1");

  finish();
})();
