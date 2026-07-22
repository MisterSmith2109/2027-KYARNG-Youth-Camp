/**
 * Camp Status Board — live sync backend (Google Apps Script)
 *
 * Stores the shared board as text in the script's own storage (Script
 * Properties), split into chunks so it can hold the full week schedule.
 * No Google Sheet or Drive file to set up.
 *
 * Deploy this as a Web App (Deploy > New deployment > Web app):
 *   - Execute as:  Me
 *   - Who has access:  Anyone
 * Then copy the resulting /exec URL and paste it into the board's
 * "Live Sync" box on every computer that should share the board.
 *
 * The URL is a capability link: anyone who has it can read and edit the
 * board, so share it only with your camp staff.
 *
 * SAFE MERGE (v2): a POST no longer overwrites the whole board. Under a
 * script lock (so two computers can't race), the server MERGES the incoming
 * board into the stored one:
 *   - Lists (roster, incidents, sensitive items, GSAs, heat casualties) merge
 *     per record by a stable id + last-modified time, with tombstones so a
 *     delete on one computer isn't undone by another. Two people editing the
 *     roster at once no longer clobber each other.
 *   - Other sections (header, WBGT, schedule, incident feed) merge per section
 *     by last-modified time, so a roster sign-in and a schedule edit made on
 *     two computers both survive.
 * The merge rules here mirror the ones in index.html.
 */

var CHUNK = 8000; // characters per Script-Property value (limit is ~9 KB)
var TOMB_TTL_MS = 1209600000; // remember deletions for 14 days — must outlast the camp week
// plus any phone that slept through a delete, or a stale device can resurrect the record.
// Keep in step with the same constant in index.html (tests/merge.test.mjs enforces this).

// Fields grouped into sections that merge as a unit (newest wins).
var SECTION_FIELDS = {
  header:   ['campName', 'day', 'oic', 'nco', 'wx', 'wxCoords', 'volLabel', 'vol', 'gsaLabel'],
  wbgt:     ['wbgt', 'wbgtAuto'],
  feed:     ['feedUrl', 'feedAuto'],
  platoons: ['platoons'],
  misc:     ['siCheck', 'perstat'],
  psg:      ['psgMsg', 'psgFormUrl', 'tocPhone', 'psgDocs']
};
// Lists that merge per record (each record has an id + _m modified time).
var LIST_KEYS = ['roster', 'incidents', 'sensitive', 'gsas', 'heatCas', 'supplyRequests', 'medicRequests', 'medicPlan', 'rfis', 'dcScores', 'psgAars', 'flashAlerts', 'flashAcks'];

function unionArr(a, b) {
  var seen = {}, out = [];
  [a || [], b || []].forEach(function (arr) {
    arr.forEach(function (v) {
      var k = String(v);
      if (!seen[k]) { seen[k] = 1; out.push(v); }
    });
  });
  return out;
}

// Merge incoming board (b) into stored board (a, may be null). Pure function.
function mergeBoards(a, b, now) {
  if (!b || typeof b !== 'object') return a; // nothing usable coming in
  if (!a || typeof a !== 'object') a = {};
  var out = {};
  var am = a._m || {}, bm = b._m || {};
  var atomb = a._tomb || {}, btomb = b._tomb || {};

  // Sections: whichever side changed the section most recently wins it whole.
  for (var sec in SECTION_FIELDS) {
    var useB = (bm[sec] || 0) >= (am[sec] || 0); // tie -> incoming (the arriving writer)
    var src = useB ? b : a;
    SECTION_FIELDS[sec].forEach(function (f) { if (src[f] !== undefined) out[f] = src[f]; });
  }
  // importedKeys accumulates (so deleted imported incidents don't come back).
  out.importedKeys = unionArr(a.importedKeys, b.importedKeys);

  // Lists: union by id, newest _m wins; drop ids with a tombstone newer than the record.
  var tombOut = {};
  LIST_KEYS.forEach(function (k) {
    var byId = {};
    (a[k] || []).forEach(function (r) { if (r && r.id != null) byId[r.id] = r; });
    (b[k] || []).forEach(function (r) {
      if (!r || r.id == null) return;
      var ex = byId[r.id];
      if (!ex || (r._m || 0) >= (ex._m || 0)) byId[r.id] = r;
    });
    var tk = {};
    var at = atomb[k] || {}, bt = btomb[k] || {}, id;
    for (id in at) tk[id] = at[id];
    for (id in bt) tk[id] = Math.max(tk[id] || 0, bt[id]);
    var arr = [];
    for (id in byId) {
      var rec = byId[id], ts = tk[id] || 0;
      if (ts && ts >= (rec._m || 0)) continue; // deleted after last edit
      arr.push(rec);
    }
    // stable order by id (ids embed creation time), keeps "added" order across computers
    arr.sort(function (x, y) { return String(x.id) < String(y.id) ? -1 : (String(x.id) > String(y.id) ? 1 : 0); });
    out[k] = arr;
    var pruned = {};
    for (id in tk) { if (now - tk[id] < TOMB_TTL_MS) pruned[id] = tk[id]; }
    tombOut[k] = pruned;
  });

  // Section modified-times: max per section.
  var mout = {}, s;
  for (s in am) mout[s] = am[s];
  for (s in bm) mout[s] = Math.max(mout[s] || 0, bm[s]);
  out._m = mout;
  out._tomb = tombOut;

  // Per-device view prefs are irrelevant to the shared board; carry incoming's.
  ['activeDay', 'activePlatoon'].forEach(function (f) { if (b[f] !== undefined) out[f] = b[f]; });
  out._by = b._by;
  return out;
}

function readBoard(props) {
  var n = parseInt(props.getProperty('n') || '0', 10), body = '';
  for (var i = 0; i < n; i++) body += props.getProperty('c' + i) || '';
  if (!body) return null;
  try { return JSON.parse(body); } catch (e) { return null; }
}

function writeBoard(props, board, rev) {
  var body = JSON.stringify(board);
  var n = Math.ceil(body.length / CHUNK) || 0;
  var map = { 'rev': String(rev), 'n': String(n) };
  for (var j = 0; j < n; j++) map['c' + j] = body.substr(j * CHUNK, CHUNK);
  props.setProperties(map, true); // drops leftover chunks from a previously larger board
}

// GET returns {"_rev": <number>, "board": <stored board JSON, or null>}.
// The server owns the revision number so devices never disagree about ordering.
function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var rev = props.getProperty('rev') || '0';
  var n = parseInt(props.getProperty('n') || '0', 10), body = '';
  for (var i = 0; i < n; i++) body += props.getProperty('c' + i) || '';
  if (!body) body = 'null';
  var out = '{"_rev":' + rev + ',"board":' + body + '}';
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// POST merges the incoming board into the stored one (under a lock) and bumps the revision.
function doPost(e) {
  var incoming = null;
  try { incoming = JSON.parse((e && e.postData) ? e.postData.contents : 'null'); } catch (err) { incoming = null; }
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { /* proceed best-effort if the lock is busy */ }
  var rev;
  try {
    var props = PropertiesService.getScriptProperties();
    var stored = readBoard(props);
    var merged = mergeBoards(stored, incoming, Date.now());
    rev = parseInt(props.getProperty('rev') || '0', 10) + 1;
    writeBoard(props, merged, rev);
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
  return ContentService
    .createTextOutput('{"ok":true,"rev":' + rev + '}')
    .setMimeType(ContentService.MimeType.JSON);
}
