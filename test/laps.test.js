/* Laps: splitting the active timer, naming the splits, and how they interact with
 * pausing, timer switching and reset. */
const { createWorker, check, finish } = require("./harness");

const { report, get, cmd, advance } = createWorker();
const secs = (ms) => Math.round(ms / 1000);

(async () => {
  console.log("--- lapping a running timer ---");
  await cmd("renameTimer", { name: "Work" });
  let s = await get();
  check("no laps to begin with", s.laps.length, 0);
  check("the lap in progress is named after its timer", s.currentLap.name, "Work - lap 1");

  await report(1, { playing: true });
  advance(30000);
  await report(1, { playing: true });
  s = await get();
  check("the open lap tracks the clock", secs(s.currentLap.durationMs), 30);

  await cmd("lap");
  s = await get();
  check("lapping records the split", s.laps.map((l) => l.name), ["Work - lap 1"]);
  check("the split has the elapsed duration", secs(s.laps[0].durationMs), 30);
  check("the next lap starts from zero", secs(s.currentLap.durationMs), 0);
  check("and is numbered next", s.currentLap.name, "Work - lap 2");
  check("the timer total is unaffected", secs(s.elapsedMs), 30);

  advance(20000);
  await report(1, { playing: true });
  await cmd("lap");
  s = await get();
  check("laps come back newest first", s.laps.map((l) => l.name), ["Work - lap 2", "Work - lap 1"]);
  check("each lap measures its own stretch", s.laps.map((l) => secs(l.durationMs)), [20, 30]);
  check("laps sum to the total", secs(s.laps.reduce((a, l) => a + l.durationMs, 0)), secs(s.elapsedMs));

  console.log("\n--- laps ignore paused time ---");
  await report(1, { playing: false });
  advance(60000); // a minute of silence must not land in the open lap
  await report(1, { playing: false });
  s = await get();
  check("a paused clock does not extend the open lap", secs(s.currentLap.durationMs), 0);

  await report(1, { playing: true });
  advance(10000);
  await report(1, { playing: true });
  s = await get();
  check("the open lap resumes with the clock", secs(s.currentLap.durationMs), 10);

  console.log("\n--- naming ---");
  const lapId = s.laps[0].id;
  await cmd("renameLap", { id: lapId, name: "Spec review" });
  s = await get();
  check("a lap can be renamed", s.laps[0].name, "Spec review");
  check("renaming one leaves the others alone", s.laps[1].name, "Work - lap 1");
  await cmd("renameLap", { id: lapId, name: "   " });
  s = await get();
  check("a blank name is ignored", s.laps[0].name, "Spec review");
  await cmd("renameLap", { id: "nope", name: "ghost" });
  s = await get();
  check("renaming a lap that does not exist is harmless", s.laps.length, 2);

  // Renaming the parent must not rewrite names already committed to laps.
  await cmd("renameTimer", { name: "Deep work" });
  s = await get();
  check("existing lap names are snapshots", s.laps.map((l) => l.name), ["Spec review", "Work - lap 1"]);
  check("new laps follow the new timer name", s.currentLap.name, "Deep work - lap 3");

  console.log("\n--- laps belong to their own timer ---");
  await cmd("addTimer", { name: "Gaming" });
  s = await get();
  check("a new timer starts with no laps", s.laps.length, 0);
  check("and its own lap numbering", s.currentLap.name, "Gaming - lap 1");

  await cmd("lap");
  s = await get();
  check("gaming has one lap", s.laps.length, 1);

  const work = s.timers.find((t) => t.name === "Deep work");
  await cmd("selectTimer", { id: work.id });
  s = await get();
  check("switching back restores that timer's laps", s.laps.map((l) => l.name), ["Spec review", "Work - lap 1"]);

  console.log("\n--- reset ---");
  await cmd("reset");
  s = await get();
  check("reset clears the laps with the total", s.laps.length, 0);
  check("and restarts the numbering", s.currentLap.name, "Deep work - lap 1");
  check("with an empty open lap", secs(s.currentLap.durationMs), 0);

  console.log("\n--- lapping a stopped timer ---");
  await report(1, { playing: false });
  await cmd("lap");
  s = await get();
  check("a stopwatch lets you lap while stopped", s.laps.length, 1);
  check("it just records nothing", secs(s.laps[0].durationMs), 0);

  finish();
})();
