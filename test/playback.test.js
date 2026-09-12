/* Playback detection: is this page making sound?
 *
 * The regression that prompted this file: the stall check counted *calls* rather than
 * elapsed time, so a burst of reports (a track change fires pause+play right next to the
 * 1s poll) looked like a frozen player and reported "not playing" over music that was
 * playing perfectly well. */
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const { check, finish } = require("./harness");

/* Load the detector the way a content script does: a classic script onto a global. */
const sandbox = { globalThis: null, Math, Array, WeakMap, Date };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "..", "src", "shared", "playback.js"), "utf8"),
  sandbox,
  { filename: "playback.js" }
);
const { createPlaybackDetector } = sandbox.MTPlayback;

/** A stand-in for <audio>/<video>: only the properties the detector reads. */
const media = (over = {}) => ({ paused: false, ended: false, readyState: 4, currentTime: 0, ...over });

let NOW = 0;
const detector = () => createPlaybackDetector({ now: () => NOW });

(async () => {
  console.log("--- the basics ---");
  let d = detector();
  check("no media at all is unknown", d.detect([]), null);
  check("a paused element is a definite no", d.detect([media({ paused: true })]), false);
  check("an ended element is a definite no", d.detect([media({ ended: true })]), false);
  check("an unloaded element is a definite no", d.detect([media({ readyState: 0 })]), false);

  d = detector();
  const song = media({ currentTime: 12 });
  check("a playing element is a yes", d.detect([song]), true);

  console.log("\n--- a burst of calls is not a stall ---");
  // This is the regression. Five calls in the same millisecond, music playing fine.
  d = detector();
  const live = media({ currentTime: 30 });
  const burst = [d.detect([live]), d.detect([live]), d.detect([live]), d.detect([live]), d.detect([live])];
  check("every call in a burst still says playing", burst, [true, true, true, true, true]);

  // A real track change: pause and play events fire together, then the poll lands.
  d = detector();
  const track = media({ currentTime: 5 });
  d.detect([track]);
  NOW += 2;
  d.detect([track]);
  NOW += 3;
  check("a track change does not fake a stall", d.detect([track]), true);

  console.log("\n--- a genuinely wedged player ---");
  d = detector();
  const stuck = media({ currentTime: 60 }); // paused === false but frozen
  check("first look is optimistic", d.detect([stuck]), true);
  NOW += 1000;
  check("one still second is not enough", d.detect([stuck]), true);
  NOW += 1000;
  check("nor two", d.detect([stuck]), true);
  NOW += 1000;
  check("three still seconds means stopped", d.detect([stuck]), false);
  // Calls between windows must repeat the verdict, not flap.
  check("and it stays stopped between windows", d.detect([stuck]), false);

  stuck.currentTime = 61;
  NOW += 1000;
  check("progress clears it immediately", d.detect([stuck]), true);

  console.log("\n--- normal playback over time ---");
  d = detector();
  const playing = media({ currentTime: 0 });
  let verdicts = [];
  for (let second = 0; second < 10; second += 1) {
    NOW += 1000;
    playing.currentTime += 1;
    verdicts.push(d.detect([playing]));
    // The poll is not alone: events fire alongside it.
    NOW += 5;
    verdicts.push(d.detect([playing]));
  }
  check("ten seconds of playback never reports a stop", verdicts.every(Boolean), true);

  console.log("\n--- picking the right element ---");
  d = detector();
  const silentPreload = media({ currentTime: 0 });
  const realTrack = media({ currentTime: 45 });
  check("the furthest-along element wins", d.detect([silentPreload, realTrack]), true);
  d = detector();
  check(
    "a paused main element with a playing ad still counts",
    d.detect([media({ paused: true, currentTime: 90 }), media({ currentTime: 3 })]),
    true
  );

  console.log("\n--- looping and seeking ---");
  d = detector();
  const looper = media({ currentTime: 178 });
  d.detect([looper]);
  NOW += 1000;
  looper.currentTime = 0; // wrapped around
  check("a loop back to zero counts as progress", d.detect([looper]), true);
  NOW += 1000;
  looper.currentTime = 40; // user scrubbed forward
  check("a seek counts as progress", d.detect([looper]), true);

  finish();
})();
