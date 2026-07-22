// Merge-logic test suite for the camp board's live sync.
//
// This is life-safety code: mergeBoards() (sync/Code.gs) decides whether a
// camper's sign-in survives when two computers write at once, and the client
// stamping (syncStampForPush in index.html) decides what the server sees.
// These tests load BOTH from the real shipped files — no copies — so any
// drift between the client and server rules fails here first.
//
// Run:  node tests/merge.test.mjs
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------- tiny test harness ----------
let passed = 0, failed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; console.log("  ok  " + name); }
  else { failed++; console.log("FAIL  " + name + (detail ? " — " + detail : "")); }
}
function deep(a) { return JSON.parse(JSON.stringify(a)); }

// ---------- load the SERVER merge from sync/Code.gs ----------
const gsSrc = fs.readFileSync(path.join(ROOT, "sync/Code.gs"), "utf8");
const server = {};
vm.createContext(server);
vm.runInContext(gsSrc, server); // top-level vars/functions; doGet/doPost are never called here
const mergeBoards = server.mergeBoards;
const TOMB_TTL_MS = server.TOMB_TTL_MS;
if (typeof mergeBoards !== "function") { console.error("could not load mergeBoards from sync/Code.gs"); process.exit(1); }

// ---------- load the CLIENT stamping from index.html ----------
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const cStart = html.indexOf("const SYNC_LISTS=");
const cEnd = html.indexOf("function syncSetStatus");
if (cStart < 0 || cEnd < 0) { console.error("could not locate client sync block in index.html"); process.exit(1); }
const clientSrc = html.slice(cStart, cEnd);

// Each makeDevice() is one laptop: its own state, its own diff base, its own clock.
function makeDevice() {
  const mk = new Function("__now", `
    const Date = { now: () => __now.t };   // controllable clock
    let state;
    ${clientSrc}
    return {
      setState(s) { state = s; },
      getState() { return state; },
      setBase(b) { syncBase = b; },
      stamp() { syncStampForPush(); return state; },
    };
  `);
  const clock = { t: 0 };
  const dev = mk(clock);
  return {
    clock,
    // "pull": accept the server board as both state and diff base
    pull(board) { dev.setState(deep(board || {})); dev.setBase(deep(board || {})); },
    state() { return dev.getState(); },
    // "push": stamp local edits and return the payload the phone/laptop would POST
    push(at) { clock.t = at; return deep(dev.stamp()); },
  };
}

const T0 = 1780000000000; // fixed base time so tests are deterministic
const H = 3600000, D = 24 * H;

function freshBoard() {
  return {
    campName: "Camp 2027", oic: "CPT A", roster: [], incidents: [],
    _m: {}, _tomb: {},
  };
}

// ---------- 1. two devices sign in different campers at once ----------
{
  let stored = mergeBoards(null, freshBoard(), T0);
  const A = makeDevice(), B = makeDevice();
  A.pull(stored); B.pull(stored);
  A.state().roster.push({ id: "rA", name: "Camper Alpha", status: "in" });
  B.state().roster.push({ id: "rB", name: "Camper Bravo", status: "in" });
  stored = mergeBoards(stored, A.push(T0 + 1000), T0 + 1000);
  stored = mergeBoards(stored, B.push(T0 + 1001), T0 + 1001);
  const names = stored.roster.map(r => r.name).sort();
  check("concurrent sign-ins on two laptops both survive",
    names.join(",") === "Camper Alpha,Camper Bravo", "got: " + names.join(","));
}

// ---------- 2. edit-vs-edit on the SAME record: newest wins ----------
{
  let stored = mergeBoards(null, freshBoard(), T0);
  const seed = makeDevice(); seed.pull(stored);
  seed.state().roster.push({ id: "r1", name: "Camper One", status: "out" });
  stored = mergeBoards(stored, seed.push(T0 + 1000), T0 + 1000);

  const A = makeDevice(), B = makeDevice();
  A.pull(stored); B.pull(stored);
  A.state().roster[0].status = "in";   // A signs them in at +2s
  B.state().roster[0].status = "absent"; // B marks absent at +5s (later)
  stored = mergeBoards(stored, A.push(T0 + 2000), T0 + 2000);
  stored = mergeBoards(stored, B.push(T0 + 5000), T0 + 5000);
  check("same-record conflict: the newer edit wins",
    stored.roster[0].status === "absent", "got: " + stored.roster[0].status);

  // and arriving order must not matter — replay reversed
  let stored2 = mergeBoards(null, freshBoard(), T0);
  stored2 = mergeBoards(stored2, seed.push(T0 + 1000), T0 + 1000);
  const A2 = makeDevice(), B2 = makeDevice();
  A2.pull(stored2); B2.pull(stored2);
  A2.state().roster[0].status = "in";
  B2.state().roster[0].status = "absent";
  const pB = B2.push(T0 + 5000), pA = A2.push(T0 + 2000);
  stored2 = mergeBoards(stored2, pB, T0 + 5100);
  stored2 = mergeBoards(stored2, pA, T0 + 5200); // older edit arrives later
  check("same-record conflict: a late-arriving OLDER edit cannot overwrite",
    stored2.roster[0].status === "absent", "got: " + stored2.roster[0].status);
}

// ---------- 3. delete-vs-edit races ----------
{
  // edit AFTER delete → record survives (the edit is newer knowledge)
  let stored = mergeBoards(null, freshBoard(), T0);
  const seed = makeDevice(); seed.pull(stored);
  seed.state().roster.push({ id: "r1", name: "Camper One", status: "in" });
  stored = mergeBoards(stored, seed.push(T0 + 1000), T0 + 1000);

  const A = makeDevice(), B = makeDevice();
  A.pull(stored); B.pull(stored);
  A.state().roster = []; // A deletes at +2s
  stored = mergeBoards(stored, A.push(T0 + 2000), T0 + 2000);
  B.state().roster[0].status = "absent"; // B edits at +5s
  stored = mergeBoards(stored, B.push(T0 + 5000), T0 + 5000);
  check("edit made after a delete brings the record back (newer knowledge wins)",
    stored.roster.length === 1 && stored.roster[0].status === "absent",
    "roster len " + stored.roster.length);

  // delete AFTER edit → record stays deleted
  let s2 = mergeBoards(null, freshBoard(), T0);
  s2 = mergeBoards(s2, seed.push(T0 + 1000), T0 + 1000);
  const C = makeDevice(), E = makeDevice();
  C.pull(s2); E.pull(s2);
  E.state().roster[0].status = "absent"; // edit at +2s
  s2 = mergeBoards(s2, E.push(T0 + 2000), T0 + 2000);
  C.pull(s2);
  C.state().roster = []; // delete at +5s
  s2 = mergeBoards(s2, C.push(T0 + 5000), T0 + 5000);
  check("delete made after an edit stays deleted", s2.roster.length === 0,
    "roster len " + s2.roster.length);
}

// ---------- 4. tombstone TTL: deletes must survive the whole camp week ----------
{
  check("tombstone TTL covers a full camp week plus stale phones (>= 9 days)",
    TOMB_TTL_MS >= 9 * D, "TOMB_TTL_MS = " + TOMB_TTL_MS + " ms (" + (TOMB_TTL_MS / D) + " days)");

  // Deleted on day 1; a phone that last synced BEFORE the delete comes back on day 5
  // (having been off all week) and pushes its stale board. The record must NOT resurrect.
  let stored = mergeBoards(null, freshBoard(), T0);
  const seed = makeDevice(); seed.pull(stored);
  seed.state().roster.push({ id: "r1", name: "Camper One", status: "in" });
  stored = mergeBoards(stored, seed.push(T0 + 1000), T0 + 1000);

  const stalePhone = makeDevice();
  stalePhone.pull(stored); // last sync: before the delete

  const toc = makeDevice(); toc.pull(stored);
  toc.state().roster = [];
  stored = mergeBoards(stored, toc.push(T0 + 2 * H), T0 + 2 * H); // deleted day 1

  // routine merges on days 2-4 (each merge re-prunes tombstones)
  const idle = makeDevice();
  for (let day = 2; day <= 4; day++) { idle.pull(stored); stored = mergeBoards(stored, idle.push(T0 + day * D), T0 + day * D); }

  // day 5: the stale phone finally reconnects and pushes its old board
  stored = mergeBoards(stored, stalePhone.push(T0 + 5 * D), T0 + 5 * D);
  check("a phone that slept through a delete cannot resurrect the record days later",
    stored.roster.length === 0, "roster: " + JSON.stringify(stored.roster));
}

// ---------- 5. sections: different sections merge independently; same section is unit-LWW ----------
{
  let stored = mergeBoards(null, freshBoard(), T0);
  const A = makeDevice(), B = makeDevice();
  A.pull(stored); B.pull(stored);
  A.state().campName = "Renamed Camp";  // header section at +2s
  B.state().wbgt = 88;                  // wbgt section at +5s
  stored = mergeBoards(stored, A.push(T0 + 2000), T0 + 2000);
  stored = mergeBoards(stored, B.push(T0 + 5000), T0 + 5000);
  check("edits to different sections on two laptops both survive",
    stored.campName === "Renamed Camp" && stored.wbgt === 88,
    "campName=" + stored.campName + " wbgt=" + stored.wbgt);

  // Known limitation, pinned down so a change is deliberate: two edits to
  // different FIELDS of the SAME section — newest section-write wins whole.
  const C = makeDevice(), E = makeDevice();
  C.pull(stored); E.pull(stored);
  C.state().campName = "C Name"; // header at +6s
  E.state().oic = "CPT New";     // header at +7s (later)
  stored = mergeBoards(stored, C.push(T0 + 6000), T0 + 6000);
  stored = mergeBoards(stored, E.push(T0 + 7000), T0 + 7000);
  check("documented limitation: same-section field edits are last-write-wins as a unit",
    stored.oic === "CPT New" && stored.campName === "Renamed Camp",
    "campName=" + stored.campName + " oic=" + stored.oic);
}

// ---------- 6. importedKeys accumulate (deleted imported incidents stay gone) ----------
{
  const a = { importedKeys: ["k1", "k2"], _m: {}, _tomb: {} };
  const b = { importedKeys: ["k2", "k3"], _m: {}, _tomb: {} };
  const m = mergeBoards(a, b, T0);
  check("importedKeys union across devices",
    m.importedKeys.slice().sort().join(",") === "k1,k2,k3",
    JSON.stringify(m.importedKeys));
}

// ---------- 7. client/server contract parity (drift guard) ----------
{
  const clientTTL = (clientSrc.match(/now-tomb\[id\]>=(\d+)/) || [])[1];
  check("client tombstone TTL equals server TOMB_TTL_MS",
    clientTTL && +clientTTL === TOMB_TTL_MS,
    "client=" + clientTTL + " server=" + TOMB_TTL_MS);

  const clientLists = JSON.parse((clientSrc.match(/const SYNC_LISTS=(\[[^\]]*\])/) || [])[1].replace(/'/g, '"'));
  const serverLists = server.LIST_KEYS;
  const missing = clientLists.filter(k => serverLists.indexOf(k) < 0);
  check("every client-stamped list is merged per-record by the server",
    missing.length === 0, "missing on server: " + missing.join(","));

  const secMatch = clientSrc.match(/const SYNC_SECTIONS=\{([\s\S]*?)\};/);
  const clientSections = {};
  for (const m of secMatch[1].matchAll(/(\w+):\[([^\]]*)\]/g)) {
    clientSections[m[1]] = m[2].split(",").map(s => s.replace(/["'\s]/g, "")).filter(Boolean);
  }
  const serverSections = server.SECTION_FIELDS;
  let secOk = Object.keys(clientSections).length === Object.keys(serverSections).length;
  for (const k in serverSections) {
    if (!clientSections[k] || clientSections[k].join(",") !== serverSections[k].join(",")) secOk = false;
  }
  check("client SYNC_SECTIONS exactly matches server SECTION_FIELDS", secOk,
    "client=" + JSON.stringify(clientSections) + " server=" + JSON.stringify(serverSections));
}

// ---------- 8. merge is stable: re-merging the same board changes nothing ----------
{
  let stored = mergeBoards(null, freshBoard(), T0);
  const seed = makeDevice(); seed.pull(stored);
  seed.state().roster.push({ id: "r1", name: "Camper One", status: "in" });
  stored = mergeBoards(stored, seed.push(T0 + 1000), T0 + 1000);
  const again = mergeBoards(deep(stored), deep(stored), T0 + 2000);
  const strip = b => { const c = deep(b); delete c._by; return JSON.stringify(c); };
  check("merging a board with itself is a no-op", strip(again) === strip(stored));
}

// ---------- 9. FLASH alerts: broadcast + simultaneous acks from two phones ----------
{
  // TOC sends the alert through the stamped client path (flashAlerts is in SYNC_LISTS)
  let stored = mergeBoards(null, freshBoard(), T0);
  const toc = makeDevice(); toc.pull(stored);
  toc.state().flashAlerts = [{ id: "fa1", kind: "LIGHTNING", text: "shelter now", canceled: false }];
  stored = mergeBoards(stored, toc.push(T0 + 1000), T0 + 1000);
  check("a FLASH alert sent from the TOC survives the merge",
    (stored.flashAlerts || []).some(a => a.id === "fa1"), JSON.stringify(stored.flashAlerts));

  // Two phones ack at the same instant — each ack is its own record, so neither clobbers the other.
  // (Phones push raw boards with self-stamped records, exactly like psg/medic queueSend does.)
  const ackA = { ...deep(stored), flashAcks: [{ id: "ak-fa1-alpha", alert: "fa1", platoon: "Alpha", _m: T0 + 2000 }] };
  const ackB = { ...deep(stored), flashAcks: [{ id: "ak-fa1-medic", alert: "fa1", platoon: "Medic", _m: T0 + 2000 }] };
  stored = mergeBoards(stored, ackA, T0 + 2001);
  stored = mergeBoards(stored, ackB, T0 + 2002);
  const platoons = (stored.flashAcks || []).map(k => k.platoon).sort();
  check("simultaneous acks from two phones both survive",
    platoons.join(",") === "Alpha,Medic", "acks: " + platoons.join(","));

  // All-clear: TOC cancels the alert; a phone that pushes its stale board (alert still
  // uncanceled) must NOT resurrect the alarm — the newer canceled edit wins.
  const stalePhone = deep(stored); // phone board from before the cancel
  const toc2 = makeDevice(); toc2.pull(stored);
  toc2.state().flashAlerts.forEach(a => { a.canceled = true; });
  stored = mergeBoards(stored, toc2.push(T0 + 5000), T0 + 5000);
  stored = mergeBoards(stored, stalePhone, T0 + 6000);
  check("a canceled FLASH stays canceled when a stale phone re-pushes",
    stored.flashAlerts.every(a => a.canceled), JSON.stringify(stored.flashAlerts));
}

// ---------- summary ----------
console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
