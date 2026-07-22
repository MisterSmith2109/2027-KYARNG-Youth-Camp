# KYARNG Youth Camp — TOC Status Board (2027)

## New for 2027 — the freshness guarantee

**No page will ever present old data as current.** Every screen that reads the
shared board (TOC, PSG phones, Medic dashboard) now runs a freshness contract:

- **LIVE / STALE / OFFLINE status** — the header chip shows the data's true age
  ("LIVE · 3s ago"). It can only read LIVE while a pull has *confirmed* the
  board against the server within the last few seconds. After that it degrades
  to STALE, then OFFLINE — with a loud banner ("DATA MAY BE OLD — last updated
  2m ago — reconnecting…") so nobody can mistake a cached board for a live one.
- **Cache-proof reads** — every GET is uniquely cache-busted and sent
  `no-store`, so no browser, proxy, or webview can hand back a cached response.
  A response carrying an older revision than what's on screen is dropped, never
  displayed (monotonic revision guard).
- **Self-healing pull** — a 1-second watchdog forces a pull if none has landed
  recently, and the page pulls *immediately* when the phone wakes, the tab
  regains focus, or signal returns — before the user even reads the screen.
- **Medic dispatch age** — each medic request card shows "received Xs ago",
  live, so a medic never has to guess how old a dispatch is.
- **App-version check** — `version.json` is bumped on each deploy; a page
  running an outdated cached copy shows a **"New version — tap to update"** bar
  that reloads the newest code. (Skips silently when run as a local file.)

**When you deploy an update:** bump the version string in `version.json` *and*
the matching `APP_VERSION` constant near the bottom of `index.html`,
`psg.html`, `medic.html`, and `dc.html`. Phones already in the field will see
the update bar within 5 minutes (or the next time the page is opened).

Also new for 2027:

- **Tested merge logic** — the sync merge (the code that decides whether a
  camper's sign-in survives when two computers write at once) now has a test
  suite: `node tests/merge.test.mjs`. It loads the *real* shipped code from
  `sync/Code.gs` and `index.html` — including a drift guard that fails if the
  client and server rules ever fall out of step — and simulates multi-device
  races: concurrent sign-ins, edit-vs-edit, delete-vs-edit, and stale phones
  reconnecting days later. Run it after touching `sync/Code.gs` or the sync
  block in `index.html`.
- **Deletes stick for the whole camp** — deletion tombstones now live 14 days
  (was 24 hours), so a phone that slept through a roster delete can no longer
  resurrect the record when it reconnects later in the week.
- **Roster CSV import** — in *Roster · Sign-In*, **⬆ Import roster CSV** loads
  the whole camp from a spreadsheet export instead of typing names. It
  auto-detects columns (`Name` or `First/Last Name`, `Platoon`/`Group`,
  `Role`) and also accepts a plain headerless `name, group, role` list.
  People already on the roster are skipped, so re-importing an updated
  manifest only adds the new folks. Everyone imports as signed **Out** —
  first formation signs them in.

---

A single-file operations/status board for running a youth camp. It keeps the
familiar military TOC (Tactical Operations Center) look — DTG/Zulu clock,
PERSTAT, SITREP export — but adds plain-English helper text so any
volunteer, military or not, can pick it up quickly.

Everything lives in one file, **`index.html`**. There is nothing to install and
no server to run — double-click the file (or open it in any modern browser) and
it works, online or offline. It's **phone-friendly** too: on a small screen the
panels stack, the glance tiles go two-across, dense tables scroll sideways within
their panel, and the controls are touch-sized — so the full TOC board is usable
from a phone, not just a laptop or wall display.

## What's on the board

- **Header & DTG clock** — camp name, Zulu + local time, Camp Day, Battle
  Captain/OIC, TOC NCO, Weather/FPCON.
- **Live weather** from the National Weather Service (set your camp coordinates,
  or press *Locate*), with a near-term forecast strip and a **next-day forecast**
  *(new)* — tomorrow's daytime high / overnight low, conditions, precip chance,
  and wind — plus a **48-hour forecast chart** *(new)* — an hourly
  temperature curve with day/night shading, a "now" marker, high/low labels, and
  precipitation chance along the bottom (hover for the exact hour). Needs
  internet; everything else works offline.
- **Glance tiles** — On Ground (present), Incident Reports, GSAs (with a
  *signed out* count), and **Accountability %**.
- **GSAs** *(new)* — track government vehicles/equipment. List each GSA and
  **who has it**; if it isn't signed out to anyone, note **where it is** instead.
  The GSA tile shows the total and how many are signed out, and the roster
  flows into the SITREP.
- **Roster · Sign-In** *(new)* — list campers and staff by name and sign them
  **In / Out / Absent**. Type a name and press Enter to add-and-sign-in, or use
  *Sign all in* / *Sign all out*. When anyone is on the roster it drives the
  Accountability tile (present ÷ accountable, with absentees excluded).
- **Accountability · Formation** *(new)* — a big, glanceable view built from the
  roster for use at a formation. A green/red banner reads **ALL ACCOUNTED FOR**
  or **N NOT SIGNED IN**; the not-signed-in people are listed and grouped
  (Campers / Staff·Support / Volunteers) with their group and last-seen time, and
  absent/excused people are shown separately. A **head-count check** lets you
  enter the number of heads counted on the ground and reconciles it against who's
  signed In (flagging "+2 more on ground" or "2 short"). A **By platoon** rollup
  *(new)* breaks accountability out per platoon — each shows **signed-in / total**
  and how many are still out — grouped from each person's roster *Group*, with
  renamed-platoon aliases folded in, plus a *Staff* bucket for anyone whose
  group doesn't match a platoon.
- **PERSTAT** — personnel counts by group (assigned vs. present). Works two ways:
  **type the counts in** directly, or let it fill from the roster. Any group that
  has people on the sign-in roster is counted from it automatically; groups with
  no one on the roster stay editable so the numbers-only workflow still works.
- **Heat Condition · WBGT** *(new)* — a Category 1–5 heat flag driven by a Wet
  Bulb Globe Temperature reading, with activity and hydration guidance for each
  level. **Auto** builds a real full-sun **outdoor** WBGT from the live weather —
  temperature and humidity (National Weather Service) plus **solar radiation and
  wind** (Open-Meteo) — using the standard `0.7·wet-bulb + 0.2·black-globe +
  0.1·dry-bulb` formula. At night or under overcast it reads as a shade value;
  if solar data can't be reached it falls back to a clearly-labeled shade
  estimate. Turn Auto off to key in a heat-stress meter reading (still the gold
  standard). Guidance is a guideline — always follow your camp medical SOP.
- **Work/Rest + Hydration timer** *(new)* — a countdown that loops active-play
  and rest periods sized to the **current heat category** (e.g. 30 min active /
  30 min rest at Category 3), with the hourly water guideline shown. It chimes
  and flashes at each switch, survives a page refresh (for a wall display), and
  stops itself if the category rises to a suspend-activity level.
- **Heat Casualties** *(new)* — a quick log for heat cases as they happen (time,
  name, type — cramps / exhaustion / **heat stroke** / precaution — and action
  taken), with a prominent heat-stroke emergency reminder. Heat-stroke entries
  are highlighted, counted on the panel, and included in the SITREP. Sits with
  the Incident Report Log near the bottom of the board.
- **Prior Heat Casualty · Watch List** *(new)* — an editable list of campers/staff
  with a **known prior history of heat illness** (name, group, notes), so staff
  can watch them proactively and pull them early in high-heat categories. Syncs
  and appears in the SITREP.
- **Daily Schedule** *(new)* — a full **week × platoon** schedule. Pick a **day**
  (Saturday–Friday), then a **platoon** (Alpha–Hotel), to see that platoon's
  activities for that day. The 2026 camp week is pre-loaded from the schedule
  workbook, with **locations** filled in from the workbook's Locations &
  Trainers sheet where they could be matched. **Status advances automatically
  with the clock** — each event reads Upcoming, then Now, then Done as its time
  passes (the current day of the week runs live; past days read Done, future
  days Upcoming). Rename, add, and remove platoons; edit any activity. On a fresh
  board it opens to today's day of the week. **Fill from shared events** (on a
  platoon's controls) populates that platoon's whole week with the events the
  other platoons all do at the same time — flag formations, meals, wake-up,
  lights out — handy for an **HQ / staff platoon** that mirrors the camp-wide
  schedule.
- **Incident Report Log** — one row per report. Log incidents by hand, or
  **auto-import** them from a Google Form: paste the responses sheet's
  *published CSV* link and new submissions drop in automatically (deduped;
  deleting an imported entry keeps it from returning). Columns are auto-detected,
  so it adapts to your form. A "Load CSV file" button is a manual fallback.
- **Supply Requests** *(new)* — an inbox of requests from the platoons (sent from
  the PSG phone page) plus anything you add by hand: platoon, priority
  (Routine/Priority/Urgent), item, quantity, notes. Urgent open requests are
  highlighted; mark each **Filled** when handled. Open requests appear in the SITREP.
- **RFIs & Suggestions** *(new)* — questions (RFIs) and suggestions from the
  platoons (sent from the PSG phone page). Type a **Response** and set the status
  to **Answered** or **Closed** — the platoon sees your reply on their phone. Open
  items are counted on the panel and listed in the Daily AAR.
- **Copy SITREP** — one-tap plain-text situation report (accountability, who's
  not signed in, PERSTAT, schedule, incidents) ready to paste into an email or chat.
- **Daily AAR** *(new)* — an after-action / end-of-day summary that auto-fills from
  the board: accountability (by platoon), heat and casualties, the day's incidents,
  supply and medic activity, and equipment — plus blank prompts for **Significant
  activities**, **Sustain**, **Improve**, and **Recommendations** to fill in. Review/edit
  it in place, then **Copy** or **Download** it as a dated `.txt` for the record.
- **Live Sync** *(new, optional)* — share one live board across multiple
  computers through a small Google Apps Script you deploy once. See
  [SYNC-SETUP.md](SYNC-SETUP.md).
- **Kiosk mode** — full-screen with screen wake-lock for a wall display.
- **PSG Field View (`psg.html`)** *(new)* — a separate **phone-first, read-only** page
  for Platoon Sergeants out with the campers. It connects to the same live board
  (via the sync link) and shows just what they need: their platoon's **Now / Next**
  activity and location, the **heat flag + water/work-rest guidance** (with an
  optional work/rest timer), a **Notes** button (a private, on-phone notepad for
  AAR comments and reminders — timestamped, saved offline, with *copy all* to
  paste into an AAR later), a **Documents** button (tap to open reference files —
  non-sensitive ones served from the project's `docs/` folder and listed from
  `docs/manifest.json`, plus **secure links** the TOC posts under *Field / PSG
  Broadcast → Field documents*: host each file somewhere access-controlled
  (e.g. Google Drive, "anyone with the link") and paste its share link at the
  TOC. Those links ride the private sync link and are **never** written to the
  public repo, so keep sensitive material such as maps and emergency plans there
  rather than in `docs/`),
  a **Platoon Roster**
  button (their platoon's people and live sign-in status, built from the TOC
  sign-in roster — a person's platoon comes from their roster *Group*, and anyone
  whose role is explicitly **Staff/Support** (or whose group matches no platoon)
  rolls up to **Lifeline**), and three quick things
  the phone can send straight to the TOC board. The **Lifeline (HQ)** phone additionally gets a
  **platoon picker** — tap any platoon to browse its Now / Next and rest-of-day
  schedule (their own pre-event alerts still follow Lifeline); regular platoons
  just see their own.
  - **Supply Request** (item, quantity, priority) → lands in the TOC's Supply
    Requests panel.
  - **RFI / Suggestion** → ask the TOC a question (RFI) or send a suggestion; it
    lands in the TOC's RFIs & Suggestions panel, and the TOC's reply shows back on
    the phone (Open → Answered/Closed).
  - **Report to TOC** → a native quick-report (no Google Form) that posts an
    **incident** (with quick-pick types) or a **heat casualty** (name, type,
    action, with a heat-stroke 911 reminder) directly into the TOC's Incident Log
    / Heat Casualties panels, tagged with the platoon. The medic's incident form
    isn't needed for the PSG/APSG.

  Below the buttons a **"{platoon} — sent to TOC"** list shows everything that
  platoon has sent — supply requests **and** reports — read from the shared board,
  so the **PSG and APSG both see the same list** even when they send from
  different phones. Each row is tagged (SUPPLY / INCIDENT / HEAT) with a live
  status: supply reads **Pending → Open → Filled** as the TOC works it, reports
  read **Pending → Logged**. Everything the phone sends is **queued and
  auto-retried**, so a request or report made with poor signal isn't lost — it
  shows as *Pending* and goes out as soon as signal returns (the header shows how
  many are waiting). The page also **caches the last board**, so the schedule,
  heat flag, and the send buttons still work with no signal.
- **Medic Dashboard (`medic.html`)** *(new)* — a phone/tablet page for the medic
  team, connected to the same live board. The PSG page's **Request Medic** button
  sends a low-detail dispatch — location, platoon, urgency (Routine / Priority /
  **Emergency**), and category (Injury / Heat / Illness / Other) — that lands on
  the medic dashboard and **pages every medic device** (chime, vibration, banner,
  optional lock-screen push). Medics work each request **New → Acknowledged →
  En route → Resolved**, and that status flows back to the requesting PSG's list.
  The dashboard also shows the **heat flag**, the **Incident Report Form** button,
  a one-tap **Call 911**, and a **medic-posting plan** the **Lead Medic** can edit
  (where medics are stationed through the week). A private, on-device **Encounter
  Log** holds the medic's working notes.
  - **By design it carries no camper medical information (HIPAA-conscious).** The
    dispatch is operational only — no names or clinical detail on the shared board.
    The encounter log is **local to the device**, never synced. Camper medical
    profiles, medication authorizations, and treatment records belong in the camp's
    official medical records, not this app.
  - Requests and postings are new synced lists, so this needs the updated
    **`sync/Code.gs` deployed** — see [SYNC-SETUP.md](SYNC-SETUP.md).

  A **10-minute heads-up** fires before each of the platoon's activities: an
  in-app banner plus a chime and vibration (works whenever the page is open),
  and — for phones that opt in with the **🔔 bell** toggle — a **lock-screen
  notification** so a pocketed phone still gets the alert. (On iPhone the
  lock-screen alerts need the page **Added to Home Screen** first; the in-app
  banner works either way.) The phones are read-only apart from these sends — a phone can only *add*
  a request or report, never change anything else on the board. Set the
  announcement and TOC phone number in the **Field / PSG Broadcast** panel on the
  main board, which also shows a **QR code and "Copy PSG link"** — a PSG scans the
  code or taps the link and the page opens with the sync link already filled in;
  they just pick their platoon. The same panel also has a **"Copy Medic link" +
  QR** that opens the medic dashboard (`medic.html`) with the sync link filled in.
  (This broadcast channel is synced, so it needs the
  updated `sync/Code.gs` deployed — see [SYNC-SETUP.md](SYNC-SETUP.md).)

## Saving & moving the board between computers

- **Automatic save:** the board saves itself in *this* browser as you type. Close
  and reopen and it's still there.
- **The catch:** that saved data lives in the browser on one computer. Open the
  file on a different computer and you start with a blank board. That's normal
  for a browser-only app — and it's why the original "only worked on one computer."
- **Carry it with you — `Save file` / `Load file`:** click **Save file** to
  download the whole board as a small `.json` file. On another computer, open
  `index.html` and click **Load file** to restore it exactly. This is the
  reliable way to hand the board off between shifts or laptops.

### Want a single live board that everyone sees at once?

Use **Live Sync** (the panel near the bottom of the board). Several computers
share one board that updates on all of them within a few seconds — roster
sign-in, incidents, heat flag, schedule edits, and header fields all sync. Each
device keeps its own day/platoon *view*.

Edits from different computers **merge** rather than overwrite each other: the
server combines them under a lock, so a roster sign-in on one laptop and a
schedule edit on another both survive, and two people signing different campers
in at once both stick. Lists merge record-by-record (including deletions); only
two edits to the *same* record at the same instant fall back to last-write-wins.

It runs through a tiny **Google Apps Script** you deploy once (free, uses your
existing Google account, no Google Sheet needed). Paste the resulting link into
the Live Sync box on each computer and press **Connect**. Full step-by-step
setup is in **[SYNC-SETUP.md](SYNC-SETUP.md)**; the script is in
**[`sync/Code.gs`](sync/Code.gs)**.

> The sync link lets anyone who has it read and edit the board (including camper
> names), so share it only with your camp staff.

If you'd rather not set that up, the `Save file` / `Load file` buttons still let
you move a board between computers by hand.

## First-time setup

1. Open `index.html`.
2. Edit the **camp name** in the header.
3. In the **Weather** panel, type your camp's `lat, lon` and press *Set* (or
   press *Locate* to use the device's location).
4. Add your campers/staff in **Roster · Sign-In**. In **Daily Schedule**, pick a
   day and platoon; the 2026 camp week is already loaded. Rename platoons once
   the campers choose names, and tweak any activities as needed.
5. In **Heat Condition · WBGT**, enter a meter reading or press *Use weather
   estimate* to set the heat flag for the day.
6. In the **Incident Report Log**, log incidents by hand or connect your Google
   Form: publish the responses sheet to the web as CSV (File → Share → Publish to
   web → the responses tab → CSV), paste that link, and tick *Auto-import*. New
   form submissions then appear on the board automatically.
7. Click **Save file** whenever you want a portable backup.

## Notes

- All data stays on your device (browser storage) plus any files you save. The
  only network call is to the National Weather Service, for the weather panel.
- **Automatic backups** *(new)* — the board keeps rolling local snapshots on this
  computer (as you work, and automatically **before a Reset or a Load file**). Open
  **Backups** in the top toolbar to see them and **Restore** any one — restoring
  snapshots the current board first, so it's undoable. This protects against an
  accidental reset or a bad edit. It's per-computer, so for off-machine safety also
  use **Save file** now and then.
- **Reset board** clears everything on the current computer — a snapshot is taken
  first (see **Backups**), and you can still export a `Save file` too.
