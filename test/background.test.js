/* Clock, mode, playlist-filter and multi-timer behaviour. */
const { createWorker, check, finish } = require("./harness");

const { report, get, cmd, advance, closeTab } = createWorker();
const secs = (s) => Math.round(s.elapsedMs / 1000);


(async () => {
  console.log("--- auto mode ---");
  await report(1, { playing: true });
  advance(10000);
  await report(1, { playing: true });
  let s = await get();
  check("counts while playing", secs(s), 10);
  check("running", s.running, true);

  await report(1, { playing: false });
  advance(30000);
  await report(1, { playing: false });
  s = await get();
  check("frozen while paused", secs(s), 10);
  check("not running", s.running, false);

  await report(1, { playing: true });
  advance(5000);
  s = await get();
  check("resumes", secs(s), 15);

  console.log("\n--- stale tab (browser/tab died) ---");
  advance(60000); // no reports at all
  s = await get();
  // 10s banked earlier + the 12s staleness window we credit a silent tab, and no more.
  check("stale tab is credited only up to the staleness cutoff", secs(s), 22);
  check("stopped after stale", s.running, false);
  check("no tabs listed", s.tabs.length, 0);

  console.log("\n--- reset + sticky mode ---");
  await cmd("reset");
  await cmd("setMode", { mode: "sticky" });
  s = await get();
  check("reset to zero", secs(s), 0);
  check("mode is sticky", s.mode, "sticky");

  await report(2, { playing: true });
  advance(4000);
  await report(2, { playing: true, });
  await report(2, { playing: false });
  advance(20000);
  await report(2, { playing: false });
  s = await get();
  check("keeps counting through a pause", secs(s), 24);
  check("still running", s.running, true);

  await report(2, { playing: true }); // music is on at the moment the user hits stop
  await cmd("stop");
  advance(10000);
  await report(2, { playing: true }); // music still on after a manual stop
  advance(5000);
  await report(2, { playing: true });
  s = await get();
  check("manual stop is not undone by ongoing music", secs(s), 24);
  check("stays stopped", s.running, false);

  await report(2, { playing: false }); // silence clears the latch
  await report(2, { playing: true });  // fresh play re-arms
  advance(3000);
  await report(2, { playing: true });
  s = await get();
  check("re-arms after real silence", secs(s), 27);

  console.log("\n--- playlist filter ---");
  await cmd("setMode", { mode: "auto" });
  await cmd("reset");
  const focus = { id: "ytmusic:PL_focus", name: "Focus", site: "ytmusic" };
  const other = { id: "ytmusic:PL_other", name: "Party", site: "ytmusic" };
  await report(3, { playing: true, context: focus });
  s = await get();
  check("candidate offered", s.candidate.id, "ytmusic:PL_focus");
  await cmd("setFilter", { filter: focus });

  advance(8000);
  await report(3, { playing: true, context: focus });
  s = await get();
  check("counts the chosen playlist", secs(s), 8);

  await report(3, { playing: true, context: other });
  advance(30000);
  await report(3, { playing: true, context: other });
  s = await get();
  check("ignores other playlists", secs(s), 8);
  check("reports music playing elsewhere", [s.anyPlaying, s.eligible], [true, false]);

  await report(3, { playing: true, context: focus });
  advance(2000);
  await report(3, { playing: true, context: focus });
  s = await get();
  check("resumes on the chosen playlist", secs(s), 10);

  await cmd("clearFilter");
  await report(3, { playing: true, context: other });
  advance(5000);
  await report(3, { playing: true, context: other });
  s = await get();
  check("clearing the filter counts everything", secs(s), 15);

  console.log("\n--- two tabs ---");
  await report(3, { playing: false, context: other }); // retire the tab from the last case
  await cmd("reset");
  await report(4, { playing: false, site: "spotify", siteLabel: "Spotify" });
  await report(5, { playing: true, site: "youtube", siteLabel: "YouTube" });
  advance(6000);
  await report(4, { playing: false, site: "spotify", siteLabel: "Spotify" });
  await report(5, { playing: true, site: "youtube", siteLabel: "YouTube" });
  s = await get();
  check("one playing tab is enough", secs(s), 6);
  await closeTab(5);
  advance(9000);
  await report(4, { playing: false, site: "spotify", siteLabel: "Spotify" });
  s = await get();
  check("closing the playing tab stops the clock", secs(s), 6);

  console.log("\n--- several timers ---");
  const byName = (st, n) => st.timers.find((t) => t.name === n);
  const work = { id: "ytmusic:PL_work", name: "Deep Focus", site: "ytmusic" };
  const game = { id: "ytmusic:PL_game", name: "Hype Mix", site: "ytmusic" };

  await report(4, { playing: false });
  await cmd("renameTimer", { name: "Work" });
  await cmd("reset");
  await cmd("setFilter", { filter: work });
  await cmd("addTimer", { name: "Gaming" });
  await cmd("setFilter", { filter: game });
  s = await get();
  check("two timers exist", s.timers.map((t) => t.name), ["Work", "Gaming"]);
  check("the new timer is active", s.name, "Gaming");

  // Each timer keeps its own clock: time on one must not appear on the other.
  await report(6, { playing: true, context: game });
  advance(9000);
  await report(6, { playing: true, context: game });
  s = await get();
  check("gaming counts its own playlist", secs(s), 9);
  check("work is untouched", Math.round(byName(s, "Work").elapsedMs / 1000), 0);

  // The work playlist starting should hand the active slot to Work automatically.
  await report(6, { playing: true, context: work });
  advance(7000);
  await report(6, { playing: true, context: work });
  s = await get();
  check("work playlist claims the active slot", s.name, "Work");
  check("work counts from the switch", secs(s), 7);
  check("gaming banked its 9s", Math.round(byName(s, "Gaming").elapsedMs / 1000), 9);
  check("only one timer runs at a time", s.timers.filter((t) => t.running).map((t) => t.name), ["Work"]);

  // A manual switch must not be undone by the playlist that is still playing.
  await cmd("selectTimer", { id: byName(s, "Gaming").id });
  advance(5000);
  await report(6, { playing: true, context: work });
  s = await get();
  check("manual choice survives the auto-switch", s.name, "Gaming");
  check("work banked its time on the way out", Math.round(byName(s, "Work").elapsedMs / 1000), 7);

  // ...but once that playlist stops and starts again, it claims again.
  await report(6, { playing: false, context: work });
  await report(6, { playing: true, context: work });
  advance(4000);
  await report(6, { playing: true, context: work });
  s = await get();
  check("a fresh start re-claims", s.name, "Work");
  check("work resumes on its own total", secs(s), 11);

  console.log("\n--- per-timer settings ---");
  await cmd("setMode", { mode: "sticky" });
  await cmd("selectTimer", { id: byName(s, "Gaming").id });
  s = await get();
  check("gaming kept its own mode", s.mode, "auto");
  await cmd("selectTimer", { id: byName(s, "Work").id });
  s = await get();
  check("work kept its own mode", s.mode, "sticky");
  check("work kept its own playlist", s.filter.name, "Deep Focus");

  console.log("\n--- delete ---");
  await cmd("deleteTimer", { id: byName(s, "Gaming").id });
  s = await get();
  check("gaming is gone", s.timers.map((t) => t.name), ["Work"]);
  await cmd("deleteTimer", { id: s.activeId });
  s = await get();
  check("the last timer cannot be deleted", s.timers.length, 1);

  finish();
})();
