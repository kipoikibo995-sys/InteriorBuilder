# InteriorBuilder

A browser-based tool for creating **print-ready book interiors and covers** for **Amazon KDP**: low-content books (notebooks, journals, planners, log books…) and **puzzle books** (Sudoku, Word Search, or both mixed). Nothing to install, works offline, and no data leaves your computer.

## Usage

1. Download the repo and open `index.html` in Chrome, Edge or Firefox.
   Or serve it locally: `python3 -m http.server 8000` and open <http://localhost:8000>.
2. **Interior** tab: pick a trim size, page count and template → check the preview → **Download interior PDF**.
3. **Cover** tab: enter the title, colors and an optional image → turn off guides → **Download cover PDF**.
4. Upload both PDFs to KDP (Paperback). Tick *Low-content book* for journals and notebooks; publish puzzle books as regular paperbacks.

## Features

- **16 KDP trim sizes** (5x8, 6x9, 8.5x11, A4, square, landscape…) with optional bleed.
- **Automatic gutter margin** based on page count, following KDP rules; errors for invalid page counts or margins.
- **16 low-content templates**: blank, lined (wide/college/narrow), dot grid, graph, handwriting practice, music staff, sketchbook, gratitude journal, daily planner, weekly planner, habit tracker, custom-column log book (mileage, visitor, budget, workout…), password log, recipe book, to-do list, Cornell notes.
- **Puzzle books** with a unique puzzle on every page and an answer key at the back:
  - **Sudoku**: Easy / Medium / Hard / Expert or progressive difficulty, 1, 2, 4 or 6 per page; every puzzle has exactly one solution.
  - **Word search**: 10x10 to 20x20 grids, 3 direction levels (up to all 8 directions, including backwards), 20 built-in themed word lists or your own (`Theme: word, word, ...`).
  - **Mixed**: word searches and sudoku alternating, or one half then the other.
  - Puzzles come from a seed: the same seed always gives the same book, and a new seed gives a new set.
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
| `js/puzzles.js` | Seeded Sudoku and Word Search generators, built-in word lists |
| `js/templates.js` | Page templates. Add a new one with another `T.push({...})` entry |
| `js/book.js` | Plans the book (front matter, puzzle and answer pages), builds pages and covers, exports PDFs (no DOM dependency) |
| `js/app.js` | User interface |
| `css/style.css` | UI styles, matching the KoJi Academy look (kojilaunch.com) |
| `vendor/jspdf.umd.min.js` | jsPDF 2.5.2 (MIT) |
| `vendor/fonts/` | DM Sans variable font (SIL OFL), bundled for offline use |

## Tests

```bash
node test/build-all.js            # build every template, check page size/count, puzzle plans,
                                  # sudoku uniqueness and word placement
node test/build-all.js out/       # ...and save the sample PDFs to out/
```
