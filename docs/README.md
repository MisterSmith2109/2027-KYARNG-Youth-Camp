# PSG Documents

Reference files shown by the **Documents** button on the PSG page (`psg.html`).

> ⚠️ **Public folder.** This project is served by GitHub Pages from a public repo,
> so everything in `docs/` is downloadable by anyone at a guessable URL — it is
> **not** protected by the sync link. Put **only non-sensitive** material here
> (e.g. cadences). Do **not** store operational or sensitive documents such as
> emergency/contingency plans, site maps, rosters, or anything CUI/FOUO.

## How it works
The Documents button reads **`manifest.json`** in this folder and lists each entry.
Tapping a document opens the file (PDFs and images open right in the phone browser).

## To add or change a document
1. Put the file in this `docs/` folder. **PDF or image (PNG/JPG)** open cleanly on
   phones. For a PowerPoint/Word doc, export it to **PDF** first so it opens without
   an app.
2. Add a line to `manifest.json`:
   ```json
   { "title": "What it's called", "file": "your-file.pdf", "kind": "Map" }
   ```
   - `title` — shown to the PSG.
   - `file` — the file name in this folder (no path).
   - `kind` — a short label under the title (e.g. Map, Cadences, Plan, SOP). Optional.
3. Commit both the file and the manifest change. It appears on the phones on their
   next load.

To remove a document, delete its line from `manifest.json` (and optionally the file).

Keep files reasonably small so they load quickly on a phone connection.
