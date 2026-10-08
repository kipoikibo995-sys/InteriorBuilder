// Smoke test: builds a PDF for every page template plus a cover, in Node.
// Usage: node test/build-all.js [output-dir]
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
globalThis.jspdf = require(path.join(root, 'vendor/jspdf.umd.min.js'));
['js/kdp.js', 'js/painter.js', 'js/puzzles.js', 'js/templates.js', 'js/book.js'].forEach((f) =>
  require(path.join(root, f)));
const { KDP, Templates, Book, Puzzles } = globalThis;

const outDir = process.argv[2];
if (outDir) fs.mkdirSync(outDir, { recursive: true });

function cfgFor(tpl, extra = {}) {
  const opts = {};
  tpl.options.forEach((o) => { if (o.type !== 'preset') opts[o.key] = o.default; });
  const pages = extra.pages || 24;
  return {
    trim: KDP.trimById(extra.trim || '6x9'), pages, paper: 'white', bleed: !!extra.bleed,
    margins: { inside: KDP.minGutter(pages) + 0.125, outside: 0.5, top: 0.5, bottom: 0.6 },
    template: tpl.id, tplOpts: opts, ownerPage: true, bookTitle: 'This Book Belongs To',
    rectoOnly: false, pageNum: 'outside',
    style: { line: '#9a9a9a', dark: '#555555', text: '#222222', fill: '#ececec', lineW: 0.5 },
    font: { name: 'helvetica', custom: false }, docTitle: tpl.name,
    cover: { title: 'Test Journal', subtitle: 'Subtitle here', author: 'Brand', spine: 'Test Journal',
      bg: '#2f4858', fg: '#ffffff', guides: true, image: null },
  };
}

(async () => {
  let failed = 0;
  for (const tpl of Templates.list) {
    for (const extra of [{}, { trim: '8.5x11', bleed: true }]) {
      const cfg = cfgFor(tpl, extra);
      const errs = KDP.validate(cfg).filter((m) => m.level === 'error');
      try {
        if (errs.length) throw new Error(errs.map((e) => e.msg).join('; '));
        const doc = await Book.buildInteriorPdf(cfg);
        const n = doc.getNumberOfPages();
        const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
        const want = KDP.pageSize(cfg.trim, cfg.bleed);
        if (n !== cfg.pages) throw new Error(`pages ${n} != ${cfg.pages}`);
        if (Math.abs(w - want.w) > 1e-3 || Math.abs(h - want.h) > 1e-3) throw new Error(`size ${w}x${h}`);
        const buf = Buffer.from(doc.output('arraybuffer'));
        if (outDir && !extra.trim) fs.writeFileSync(path.join(outDir, `${tpl.id}.pdf`), buf);
        console.log(`ok   ${tpl.id.padEnd(12)} ${cfg.trim.id.padEnd(7)} bleed=${cfg.bleed} ${n}p ${(buf.length / 1024).toFixed(0)} KB`);
      } catch (e) {
        failed++;
        console.log(`FAIL ${tpl.id} ${cfg.trim.id}: ${e.message}`);
      }
    }
  }
  // Puzzle books: page plan, answer key and unique sudoku solutions
  for (const id of ['sudoku', 'wordsearch', 'mixed']) {
    const cfg = cfgFor(Templates.byId(id), { pages: 120 });
    cfg.tplOpts.level = 'progressive';
    const pl = Book.plan(cfg);
    const kinds = {};
    for (let n = 1; n <= cfg.pages; n++) {
      const info = Book.pageInfo(cfg, n, pl);
      kinds[info.kind] = (kinds[info.kind] || 0) + 1;
    }
    const ok = pl.front + pl.puzzlePages + pl.solutionPages <= cfg.pages && pl.solutionPages > 0 && kinds.puzzle === pl.puzzlePages;
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id} 120p plan: ${pl.count} puzzles, ${JSON.stringify(kinds)}`);
    const doc = await Book.buildInteriorPdf(cfg);
    if (outDir) fs.writeFileSync(path.join(outDir, `${id}-120p.pdf`), Buffer.from(doc.output('arraybuffer')));
  }
  for (let i = 0; i < 20; i++) {
    const s = Puzzles.sudoku(`t${i}`, 'expert');
    const solved = s.puzzle.slice();
    if (Puzzles.solve(solved, 2, null, true) !== 1 || solved.join() !== s.solution.join()) {
      failed++;
      console.log(`FAIL sudoku t${i} not unique`);
    }
  }
  const lists = Puzzles.parseWordLists(Puzzles.WORD_BANK);
  for (const [i, l] of lists.entries()) {
    const ws = Puzzles.wordSearch(`w${i}`, { size: 15, level: 'hard', words: l.words, count: 16, theme: l.theme });
    for (const w of ws.placed) {
      const letters = Array.from({ length: w.len }, (_, k) => ws.grid[w.r + w.dr * k][w.c + w.dc * k]).join('');
      if (letters !== Puzzles.cleanWord(w.word)) { failed++; console.log(`FAIL word ${w.word} misplaced`); }
    }
    if (ws.placed.length < 16) { failed++; console.log(`FAIL ${l.theme}: only ${ws.placed.length} words placed`); }
  }
  console.log('ok   sudoku uniqueness and word placement checks');

  // Cover
  const ccfg = cfgFor(Templates.byId('lined'), { pages: 120 });
  const cover = Book.buildCoverPdf(ccfg);
  const L = Book.coverLayout(ccfg);
  console.log(`ok   cover ${cover.internal.pageSize.getWidth().toFixed(3)}" x ${cover.internal.pageSize.getHeight().toFixed(3)}" (spine ${L.spine.toFixed(4)}")`);
  if (outDir) fs.writeFileSync(path.join(outDir, 'cover.pdf'), Buffer.from(cover.output('arraybuffer')));

  // Large book: check file size
  const big = cfgFor(Templates.byId('dotgrid'), { pages: 300 });
  const t0 = Date.now();
  const bigDoc = await Book.buildInteriorPdf(big);
  console.log(`ok   dotgrid 300 pages: ${(bigDoc.output('arraybuffer').byteLength / 1048576).toFixed(1)} MB, ${Date.now() - t0} ms`);

  process.exit(failed ? 1 : 0);
})();
