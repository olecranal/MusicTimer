/* The settings page: saving a whole timer's config at once, targeting any timer (not only
 * the active one), and the "specific playlist(s)" mode's OR-matching across several entries. */
const { createWorker, check, finish } = require("./harness");

const { report, get, cmd, settings, advance } = createWorker();
const secs = (ms) => Math.round(ms / 1000);

(async () => {
  console.log("--- specific mode matches any one of several playlists ---");
  const focus = { id: "ytmusic:PL_focus", name: "Focus", site: "ytmusic" };
  const hype = { id: "ytmusic:PL_hype", name: "Hype", site: "ytmusic" };
  const other = { id: "ytmusic:PL_other", name: "Other", site: "ytmusic" };

  await cmd("saveTimerSettings", {
    mode: "auto",
    filterMode: "specific",
    filter: null,
    specificPlaylists: [focus, hype],
  });

  await report(1, { playing: true, context: focus });
  advance(5000);
  await report(1, { playing: true, context: focus });
  let s = await get();
  check("the first entry counts", secs(s.elapsedMs), 5);

  await report(1, { playing: true, context: hype });
  advance(4000);
  await report(1, { playing: true, context: hype });
  s = await get();
  check("the second entry also counts", secs(s.elapsedMs), 9);

  await report(1, { playing: true, context: other });
  advance(30000);
  await report(1, { playing: true, context: other });
  s = await get();
  check("a playlist not on the list does not count", secs(s.elapsedMs), 9);
  check("but is correctly seen as playing elsewhere", [s.anyPlaying, s.eligible], [true, false]);

  console.log("\n--- an empty specific list never claims or counts ---");
  await cmd("saveTimerSettings", {
    mode: "auto",
    filterMode: "specific",
    filter: null,
    specificPlaylists: [],
  });
  await report(1, { playing: true, context: focus });
  advance(9999);
  await report(1, { playing: true, context: focus });
  s = await get();
  check("nothing counts with an empty list", secs(s.elapsedMs), 9);

  // Done with tab 1 - silence it explicitly so it cannot go on quietly deciding claims in
  // every section below (a stale-but-still-"playing" source is exactly the kind of leftover
  // state that makes a later assertion pass for the wrong reason).
  await report(1, { playing: false, context: focus });

  console.log("\n--- the settings page can target a timer that is not active ---");
  await cmd("renameTimer", { name: "Work" });
  await cmd("addTimer", { name: "Gaming" });
  let snap = await get();
  const gaming = snap.timers.find((t) => t.name === "Gaming").id;
  const work = snap.timers.find((t) => t.name === "Work").id;
  check("gaming is the active one now", snap.activeId, gaming);

  // Bind Work to something nobody is currently playing, so configuring it cannot also
  // trigger an auto-claim - that would muddy this section's actual point, which is that
  // setting Work's config never requires switching to it first.
  await cmd("saveTimerSettings", {
    id: work,
    mode: "sticky",
    filterMode: "current",
    filter: hype,
    specificPlaylists: [],
  });
  snap = await get();
  check("switching away was not required", snap.activeId, gaming);
  check("gaming's own settings are untouched", snap.mode, "auto");

  let workSettings = await settings(work);
  check("work's settings were saved", [workSettings.mode, workSettings.filterMode], ["sticky", "current"]);
  check("work's filter was saved", workSettings.filter.name, "Hype");

  console.log("\n--- the settings dropdown lists every timer ---");
  check("both timers are offered", workSettings.timers.map((t) => t.name).sort(), ["Gaming", "Work"]);

  console.log("\n--- requesting a timer that no longer exists falls back to the active one ---");
  const fallback = await settings("not-a-real-id");
  check("falls back to the active timer", fallback.id, gaming);

  console.log("\n--- the specific-playlist list is capped ---");
  const many = Array.from({ length: 15 }, (_, i) => ({ id: `ytmusic:PL_${i}`, name: `List ${i}` }));
  await cmd("saveTimerSettings", { id: work, mode: "auto", filterMode: "specific", filter: null, specificPlaylists: many });
  workSettings = await settings(work);
  check("saved lists are capped at 10", workSettings.specificPlaylists.length, 10);

  console.log("\n--- the timer list badge summarizes whichever mode is in effect ---");
  await cmd("saveTimerSettings", { id: work, mode: "auto", filterMode: "any", filter: null, specificPlaylists: [] });
  snap = await get();
  check("ANY mode shows no badge", snap.timers.find((t) => t.id === work).filterName, null);

  await cmd("saveTimerSettings", { id: work, mode: "auto", filterMode: "specific", filter: null, specificPlaylists: [focus] });
  snap = await get();
  check("one specific entry shows its name", snap.timers.find((t) => t.id === work).filterName, "Focus");

  await cmd("saveTimerSettings", {
    id: work,
    mode: "auto",
    filterMode: "specific",
    filter: null,
    specificPlaylists: [focus, hype, other],
  });
  snap = await get();
  check("several entries show the first plus a count", snap.timers.find((t) => t.id === work).filterName, "Focus +2");

  console.log("\n--- specific mode lets a timer auto-claim, same as current mode ---");
  await cmd("saveTimerSettings", { id: gaming, mode: "auto", filterMode: "any", filter: null, specificPlaylists: [] });
  await cmd("selectTimer", { id: gaming }); // start from a known active timer
  await report(2, { playing: true, context: focus }); // Work's binding, Work not active
  advance(3000);
  await report(2, { playing: true, context: focus });
  snap = await get();
  check("work auto-claims on its bound playlist starting", snap.activeId, work);

  console.log("\n--- the site toggle restricts which sites count at all ---");
  await report(2, { playing: false, context: focus }); // done with tab 2
  await cmd("selectTimer", { id: work });
  await cmd("reset");

  await cmd("saveTimerSettings", {
    id: work,
    mode: "auto",
    filterMode: "any",
    filter: null,
    specificPlaylists: [],
    sites: ["spotify"],
  });

  await report(3, { playing: true, site: "ytmusic", siteLabel: "YouTube Music" });
  advance(5000);
  await report(3, { playing: true, site: "ytmusic", siteLabel: "YouTube Music" });
  s = await get();
  check("a site not on the list does not count, even with no playlist filter", secs(s.elapsedMs), 0);

  await report(3, { playing: false, site: "ytmusic", siteLabel: "YouTube Music" });
  await report(3, { playing: true, site: "spotify", siteLabel: "Spotify" });
  advance(6000);
  await report(3, { playing: true, site: "spotify", siteLabel: "Spotify" });
  s = await get();
  check("the allowed site counts", secs(s.elapsedMs), 6);

  console.log("\n--- an empty site list is a real, deliberate pause switch ---");
  await report(3, { playing: false, site: "spotify", siteLabel: "Spotify" });
  await cmd("saveTimerSettings", {
    id: work,
    mode: "auto",
    filterMode: "any",
    filter: null,
    specificPlaylists: [],
    sites: [],
  });
  await report(3, { playing: true, site: "spotify", siteLabel: "Spotify" });
  advance(9999);
  await report(3, { playing: true, site: "spotify", siteLabel: "Spotify" });
  s = await get();
  check("nothing counts on any site with an empty list", secs(s.elapsedMs), 6);
  check("but the worker still sees the music playing", [s.anyPlaying, s.eligible], [true, false]);

  console.log("\n--- omitting sites entirely defaults to unrestricted, not empty ---");
  await report(3, { playing: false, site: "spotify", siteLabel: "Spotify" });
  await cmd("saveTimerSettings", { id: work, mode: "auto", filterMode: "any", filter: null, specificPlaylists: [] });
  const workSettingsNoSites = await settings(work);
  check("a missing sites field falls back to every site", workSettingsNoSites.sites.sort(), ["spotify", "youtube", "ytmusic"]);

  finish();
})();
