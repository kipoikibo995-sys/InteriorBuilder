// Builds interior pages and the cover, and exports PDFs. No DOM dependency, so it runs in the browser and in Node.
(function (global) {
  'use strict';

  const KDP = global.KDP;
  const Templates = global.Templates;

  // Splits the book into front matter, puzzle pages and answer-key pages.
  // Puzzle templates fill as many pages as fit; any leftover pages go blank at the very end.
  function plan(cfg) {
    const tpl = Templates.byId(cfg.template) || Templates.list[0];
    const front = cfg.ownerPage ? 2 : 0;
    if (!tpl.puzzle) return { tpl, front };
    const o = cfg.tplOpts;
    const per = tpl.puzzle.perPage(o), solPer = tpl.puzzle.solPerPage(o);
    const solPages = (p) => (o.solutions ? Math.ceil((p * per) / solPer) : 0);
    let puzzlePages = Math.max(0, cfg.pages - front);
    while (puzzlePages > 0 && front + puzzlePages + solPages(puzzlePages) > cfg.pages) puzzlePages--;
    return {
      tpl, front, per, solPer, puzzlePages,
      solutionPages: solPages(puzzlePages),
      count: puzzlePages * per,
    };
  }

  // Puzzles are generated on demand and cached, so the preview only builds what it shows.
  let cache = { key: '', items: new Map() };

  function puzzleItem(cfg, pl, index) {
    const key = JSON.stringify([cfg.template, cfg.tplOpts, pl.count]);
    if (cache.key !== key) cache = { key, items: new Map() };
    if (!cache.items.has(index)) {
      const kind = pl.tpl.puzzle.kind(cfg.tplOpts, index, pl.count);
      cache.items.set(index, kind.make(cfg.tplOpts, index, pl.count));
    }
    return { num: index + 1, data: cache.items.get(index) };
  }

  function range(from, to) {
    const out = [];
    for (let i = from; i < to; i++) out.push(i);
    return out;
  }

  // Kind of page n (1-based), plus the puzzle items it shows.
  function pageInfo(cfg, n, pl = plan(cfg)) {
    if (cfg.ownerPage && n === 1) return { kind: 'owner' };
    if (cfg.ownerPage && n === 2) return { kind: 'blank' };
    if (!pl.tpl.puzzle) {
      if (cfg.rectoOnly && !KDP.isRecto(n)) return { kind: 'blank' };
      return { kind: 'template' };
    }
    const i = n - pl.front - 1;
    if (i < pl.puzzlePages) {
      return { kind: 'puzzle', items: range(i * pl.per, (i + 1) * pl.per), slots: pl.per };
    }
    const si = i - pl.puzzlePages;
    if (si < pl.solutionPages) {
      return { kind: 'solution', items: range(si * pl.solPer, Math.min((si + 1) * pl.solPer, pl.count)), slots: pl.solPer, first: si === 0 };
    }
    return { kind: 'blank' };
  }

  function drawGuides(p, cfg, box) {
    const size = KDP.pageSize(cfg.trim, cfg.bleed);
    if (cfg.bleed) {
      p.rect(0, 0, size.w, size.h, { fill: 'rgba(220,38,38,0.06)', stroke: false });
      p.rect(box.trimX, box.trimY, cfg.trim.w, cfg.trim.h, { fill: '#ffffff', color: '#dc2626', w: 0.75, dash: [0.06, 0.04] });
    }
    p.rect(box.x, box.y, box.w, box.h, { color: '#2563eb', w: 0.5, dash: [0.04, 0.04] });
    const gx = box.recto ? box.trimX : box.trimX + cfg.trim.w;
    p.text('spine', gx + (box.recto ? 0.06 : -0.06), box.trimY + cfg.trim.h / 2, {
      size: 7, color: '#2563eb', align: box.recto ? 'left' : 'right',
    });
  }

  function drawPageNumber(p, cfg, box, n) {
    if (cfg.pageNum === 'none') return;
    const y = box.trimY + cfg.trim.h - Math.max(0.25, cfg.margins.bottom / 2) + 0.04;
    const opts = { size: 9, color: cfg.style.text };
    if (cfg.pageNum === 'center') {
      p.text(String(n), box.x + box.w / 2, y, { ...opts, align: 'center' });
    } else if (box.recto) {
      p.text(String(n), box.x + box.w, y, { ...opts, align: 'right' });
    } else {
      p.text(String(n), box.x, y, opts);
    }
  }

  // Draws page n. options.guides: draw margins and trim lines (preview only).
  function renderPage(p, cfg, n, options = {}) {
    const box = KDP.contentBox(cfg, n);
    if (options.guides) drawGuides(p, cfg, box);
    const ctx = { style: cfg.style, recto: box.recto, page: n };
    const pl = options.plan || plan(cfg);
    const info = pageInfo(cfg, n, pl);
    if (info.kind === 'owner') {
      Templates.OWNER.draw(p, box, { bookTitle: cfg.bookTitle }, ctx);
    } else if (info.kind === 'template') {
      pl.tpl.draw(p, box, cfg.tplOpts, ctx);
      drawPageNumber(p, cfg, box, n);
    } else if (info.kind === 'puzzle' || info.kind === 'solution') {
      const items = info.items.map((i) => puzzleItem(cfg, pl, i));
      Templates.drawPuzzlePage(p, box, items, { ...ctx, slots: info.slots, firstSolutionPage: info.first }, info.kind === 'solution');
      drawPageNumber(p, cfg, box, n);
    }
    return info.kind;
  }

  function newDoc(w, h) {
    const { jsPDF } = global.jspdf;
    return new jsPDF({ unit: 'in', format: [w, h], orientation: w > h ? 'landscape' : 'portrait', compress: true });
  }

  function registerFont(doc, font) {
    if (font && font.custom) {
      doc.addFileToVFS('user-font.ttf', font.base64);
      doc.addFont('user-font.ttf', font.name, 'normal');
      doc.setFont(font.name, 'normal');
    }
  }

  const tick = () => new Promise((r) => setTimeout(r, 0));

  async function buildInteriorPdf(cfg, onProgress) {
    const size = KDP.pageSize(cfg.trim, cfg.bleed);
    const doc = newDoc(size.w, size.h);
    registerFont(doc, cfg.font);
    const painter = new global.PdfPainter(doc, cfg.font);
    const pl = plan(cfg);
    for (let n = 1; n <= cfg.pages; n++) {
      if (n > 1) doc.addPage([size.w, size.h], size.w > size.h ? 'landscape' : 'portrait');
      renderPage(painter, cfg, n, { plan: pl });
      if (n % 8 === 0) {
        if (onProgress) onProgress(n / cfg.pages);
        await tick();
      }
    }
    if (onProgress) onProgress(1);
    doc.setProperties({ title: cfg.docTitle || 'Interior', creator: 'InteriorBuilder' });
    return doc;
  }

  // ---------- Cover ----------

  function coverLayout(cfg) {
    const dims = KDP.coverSize(cfg.trim, cfg.pages, cfg.paper);
    const B = KDP.BLEED;
    const backX = B, spineX = B + cfg.trim.w, frontX = spineX + dims.spine;
    return { ...dims, B, backX, spineX, frontX, trimY: B };
  }

  function wrap(p, text, maxW, o) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    words.forEach((w) => {
      const t = cur ? `${cur} ${w}` : w;
      if (p.textWidth(t, o) <= maxW || !cur) cur = t;
      else {
        lines.push(cur);
        cur = w;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function renderCover(p, cfg, options = {}) {
    const L = coverLayout(cfg);
    const c = cfg.cover;
    const fg = c.fg;
    p.rect(0, 0, L.w, L.h, { fill: c.bg, stroke: false });
    if (c.image) p.image(c.image, L.frontX, 0, L.w - L.frontX, L.h);

    // Front: title, subtitle and author inside the safe zone (0.25" from trim).
    const safe = 0.25;
    const fx = L.frontX + safe, fw = cfg.trim.w - 2 * safe;
    const cx = L.frontX + cfg.trim.w / 2;
    let y = L.trimY + cfg.trim.h * 0.3;
    const titleSize = Math.min(40, cfg.trim.w * 6.2);
    const tOpt = { size: titleSize, bold: true, color: fg, align: 'center' };
    wrap(p, c.title, fw, tOpt).forEach((line) => {
      p.text(line, cx, y, tOpt);
      y += (titleSize * 1.15) / 72;
    });
    if (c.title && c.subtitle) {
      y += 0.08;
      p.line(cx - 0.6, y - 0.12, cx + 0.6, y - 0.12, { color: fg, w: 1 });
      y += 0.15;
    }
    const sOpt = { size: titleSize * 0.42, color: fg, align: 'center' };
    wrap(p, c.subtitle, fw, sOpt).forEach((line) => {
      p.text(line, cx, y, sOpt);
      y += (sOpt.size * 1.3) / 72;
    });
    if (c.author) {
      p.text(c.author, cx, L.trimY + cfg.trim.h - safe - 0.35, { size: titleSize * 0.4, color: fg, align: 'center' });
    }

    // Spine: text runs top to bottom (US convention), only when the page count allows it.
    const spineOk = cfg.pages > KDP.SPINE_TEXT_MIN_PAGES && c.spine;
    if (spineOk) {
      const size = Math.min(14, L.spine * 72 * 0.5);
      const o = { size, bold: true, color: fg };
      const tw = p.textWidth(c.spine, o);
      const scx = L.spineX + L.spine / 2;
      p.text(c.spine, scx - (size * 0.35) / 72, L.trimY + cfg.trim.h / 2 - tw / 2, { ...o, angle: -90 });
    }

    if (options.guides) drawCoverGuides(p, cfg, L);
    return L;
  }

  function drawCoverGuides(p, cfg, L) {
    const red = '#dc2626', blue = '#2563eb', green = '#16a34a';
    p.rect(L.B, L.B, L.w - 2 * L.B, L.h - 2 * L.B, { color: red, w: 0.75, dash: [0.08, 0.05] });
    p.line(L.spineX, 0, L.spineX, L.h, { color: blue, w: 0.75, dash: [0.08, 0.05] });
    p.line(L.frontX, 0, L.frontX, L.h, { color: blue, w: 0.75, dash: [0.08, 0.05] });
    const s = 0.25;
    p.rect(L.backX + s, L.B + s, cfg.trim.w - 2 * s, cfg.trim.h - 2 * s, { color: green, w: 0.5, dash: [0.04, 0.04] });
    p.rect(L.frontX + s, L.B + s, cfg.trim.w - 2 * s, cfg.trim.h - 2 * s, { color: green, w: 0.5, dash: [0.04, 0.04] });
    // KDP barcode area: 2" x 1.2", 0.25" from trim at the bottom-right of the back cover.
    const bx = L.spineX - s - 2, by = L.B + cfg.trim.h - s - 1.2;
    p.rect(bx, by, 2, 1.2, { fill: '#ffffff', color: red, w: 0.75 });
    p.text('BARCODE', bx + 1, by + 0.65, { size: 9, color: red, align: 'center', bold: true });
    p.text('Back', L.backX + cfg.trim.w / 2, L.B + 0.2, { size: 8, color: blue, align: 'center' });
    p.text('Front', L.frontX + cfg.trim.w / 2, L.B + 0.2, { size: 8, color: blue, align: 'center' });
  }

  function buildCoverPdf(cfg) {
    const L = coverLayout(cfg);
    const doc = newDoc(L.w, L.h);
    registerFont(doc, cfg.font);
    renderCover(new global.PdfPainter(doc, cfg.font), cfg, { guides: cfg.cover.guides });
    doc.setProperties({ title: `${cfg.docTitle || 'Book'} — Cover`, creator: 'InteriorBuilder' });
    return doc;
  }

  global.Book = { plan, pageInfo, renderPage, buildInteriorPdf, coverLayout, renderCover, buildCoverPdf };
})(typeof window !== 'undefined' ? window : globalThis);
