/* MV3 only auto-injects a declared content script into tabs that load after the extension
 * does. A tab the user already had open when they installed or reloaded the extension never
 * gets it - not on focus, only on a real navigation or refresh. This is what "the timer
 * doesn't see a tab I already had open" looked like from the outside. background.js closes
 * that gap itself, on both install/update and browser startup, by reading the file list and
 * match patterns straight from the manifest and injecting them into whatever already matches. */
const { createWorker, check, finish } = require("./harness");

const MANIFEST = {
  content_scripts: [
    {
      matches: ["https://music.youtube.com/*", "https://open.spotify.com/*"],
      js: ["src/shared/logger.js", "src/shared/contract.js", "src/shared/playback.js", "src/content.js"],
    },
  ],
};

(async () => {
  console.log("--- backfilling tabs open before the extension loaded ---");
  const openTabs = [
    { id: 1, url: "https://music.youtube.com/watch?v=abc" },
    { id: 2, url: "https://open.spotify.com/playlist/xyz" },
    { id: 3, url: "https://example.com/unrelated" }, // must be left alone
  ];
  const worker = createWorker({ manifest: MANIFEST, openTabs });

  await worker.install();
  check("only the matching tabs are injected", worker.injections.map((i) => i.target.tabId), [1, 2]);
  check("every declared file is injected, in manifest order", worker.injections[0].files, MANIFEST.content_scripts[0].js);

  console.log("\n--- also runs on browser startup ---");
  const restarted = createWorker({ manifest: MANIFEST, openTabs });
  await restarted.restart();
  check("a browser restart backfills too", restarted.injections.map((i) => i.target.tabId), [1, 2]);

  console.log("\n--- edge cases ---");
  const noTabs = createWorker({ manifest: MANIFEST, openTabs: [] });
  await noTabs.install();
  check("no open tabs means nothing to inject, and no crash", noTabs.injections.length, 0);

  const noManifestEntry = createWorker({ manifest: { content_scripts: [] }, openTabs });
  await noManifestEntry.install();
  check("a missing manifest entry is handled without crashing", noManifestEntry.injections.length, 0);

  finish();
})();
