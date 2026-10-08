# InteriorBuilder

A browser-based tool for creating **print-ready low-content book interiors and covers** (notebooks, journals, planners, log books…) for **Amazon KDP**. Nothing to install, works offline, and no data leaves your computer.

## Usage

1. Download the repo and open `index.html` in Chrome, Edge or Firefox.
   Or serve it locally: `python3 -m http.server 8000` and open <http://localhost:8000>.
2. **Interior** tab: pick a trim size, page count and template → check the preview → **Download interior PDF**.
3. **Cover** tab: enter the title, colors and an optional image → turn off guides → **Download cover PDF**.
4. Upload both PDFs to KDP (Paperback → tick *Low-content book*).

## Features

- **16 KDP trim sizes** (5x8, 6x9, 8.5x11, A4, square, landscape…) with optional bleed.
- **Automatic gutter margin** based on page count, following KDP rules; errors for invalid page counts or margins.
- **16 page templates**: blank, lined (wide/college/narrow), dot grid, graph, handwriting practice, music staff, sketchbook, gratitude journal, daily planner, weekly planner, habit tracker, custom-column log book (mileage, visitor, budget, workout…), password log, recipe book, to-do list, Cornell notes.
- "This book belongs to" page, right-hand-pages-only mode, page numbers.
- Custom line colors, line weight and fonts (upload a `.ttf` for accented or non-Latin text).
- **Cover calculator**: spine width by paper type, full cover size and 300 dpi image size.
- **Cover builder**: background color, title, subtitle, spine text (over 79 pages), front image, safe-zone and barcode guides.
- Vector PDFs with small file sizes (a 300-page dot grid book is about 2 MB).

## Source layout

| File | Purpose |
|---|---|
| `js/kdp.js` | KDP specs: trim sizes, margins, paper thickness, validation |
| `js/painter.js` | Shared drawing layer for canvas (preview) and jsPDF (export) |
| `js/templates.js` | Page templates. Add a new one with another `T.push({...})` entry |
| `js/book.js` | Builds pages and covers, exports PDFs (no DOM dependency) |
| `js/app.js` | User interface |
| `vendor/jspdf.umd.min.js` | jsPDF 2.5.2 (MIT) |

## Tests

```bash
node test/build-all.js            # build a PDF for every template and check page size and count
node test/build-all.js out/       # ...and save the sample PDFs to out/
```
