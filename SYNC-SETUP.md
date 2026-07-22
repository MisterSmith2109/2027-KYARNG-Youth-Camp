# Live multi-computer sync — setup (about 5 minutes)

By default each computer keeps its own board in its browser. **Live Sync** lets
several computers share **one** board that updates on all of them within a few
seconds — useful when more than one TOC laptop is running the display.

It works through a tiny **Google Apps Script** that you deploy once. It's free,
uses your existing Google account, and needs no Google Sheet or extra service.

> **Privacy:** the sync link is a *capability URL* — anyone who has it can read
> and edit the board, which includes camper names on the roster. Share the link
> only with your camp staff. Don't post it publicly.

---

## 1. Create the script

1. Go to **https://script.google.com** and click **New project**.
2. Delete the sample code in `Code.gs`.
3. Open **`sync/Code.gs`** from this project, copy all of it, and paste it in.
4. Click the **Save** icon. Name the project something like *Camp Board Sync*.

## 2. Deploy it as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Description:** anything (e.g. "camp board")
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
4. Click **Deploy**.
5. The first time, Google asks you to **authorize**. Click through:
   *Authorize access → pick your Google account → Advanced → Go to Camp Board
   Sync (unsafe) → Allow.* (It's "unsafe" only because it's your own
   unverified script — that's expected.)
6. Copy the **Web app URL**. It ends in **`/exec`** and looks like:
   `https://script.google.com/macros/s/AKfy…long…/exec`

## 3. Connect the board

1. Open `index.html` on the first computer.
2. Scroll to the **Live Sync** panel near the bottom.
3. Paste the `/exec` URL into the box and press **Connect**.
   - The dot turns green and it says *"sharing this board"* — this computer just
     seeded the shared board with what's on screen.
4. On every other computer, open `index.html`, paste the **same** URL, and press
   **Connect**. Each one says *"joined shared board"* and pulls the current board.

That's it. From now on, changes on any connected computer (roster sign-in,
incidents, heat flag, schedule edits, header fields) appear on the others within
a few seconds. Each computer remembers the link, so it reconnects automatically
next time you open the board.

Press **Disconnect** to go back to a private, local-only board on that computer.

---

## How it behaves

- **Changes merge — they don't clobber each other.** The server combines edits
  from every computer instead of letting the last save overwrite the board. So
  if one laptop signs a camper in while another edits the schedule, **both**
  survive; and two people signing different campers in at the same time both
  stick. This matters most when you're running **more than one TOC laptop**.
  Lists (roster, incidents, sensitive items, GSAs, heat casualties) merge person
  by person / item by item, including deletions. The only case that still falls
  back to last-write-wins is two people editing the **exact same record's fields**
  (e.g. the same camper) within the same moment — rare in practice.
- **Clocks should be roughly in sync.** The merge uses each computer's clock to
  decide which edit is newer, so keep the laptops' clocks set correctly (normal
  internet time-sync is fine).
- **Offline is fine.** If a computer loses internet, it keeps working locally and
  resumes syncing when it's back; the status shows *"offline — retrying."*
- **The schedule syncs too**, so if you rename a platoon or tweak an activity on
  one machine, the others get it.

## Updating the script later

If you ever change `sync/Code.gs`, open the Apps Script project, paste the new
code, then **Deploy → Manage deployments → edit (pencil) → Version: New version →
Deploy**. The `/exec` URL stays the same, so you don't need to re-paste it.

> **Upgrading to the safe-merge version:** if you set sync up before merging was
> added, redeploy `sync/Code.gs` as a **New version** (above) **and** open the
> updated `index.html` on every computer so they all speak the same format. Until
> the script is redeployed it still works, but falls back to last-write-wins.

## Troubleshooting

- **"could not reach the sync link"** — make sure the URL ends in `/exec` (not
  `/dev`) and that **Who has access** is **Anyone**.
- **Nothing syncs** — confirm each computer shows the green dot and *"synced"*.
  Re-paste the URL and press Connect again.
- **Want to wipe the shared board** — in the Apps Script project, run
  *Project Settings → Script Properties → delete all*, or just Connect one
  computer with a fresh board and let it overwrite.
