// Amazon KDP print (paperback) specifications.
// Units: inches. Source: KDP Help — "Set Trim Size, Bleed, and Margins" and "Cover calculator".
(function (global) {
  'use strict';

  const TRIM_SIZES = [
    { id: '5x8', w: 5, h: 8, label: '5" x 8" (12.7 x 20.32 cm)' },
    { id: '5.06x7.81', w: 5.06, h: 7.81, label: '5.06" x 7.81" (12.85 x 19.84 cm)' },
    { id: '5.25x8', w: 5.25, h: 8, label: '5.25" x 8" (13.34 x 20.32 cm)' },
    { id: '5.5x8.5', w: 5.5, h: 8.5, label: '5.5" x 8.5" (13.97 x 21.59 cm)' },
    { id: '6x9', w: 6, h: 9, label: '6" x 9" (15.24 x 22.86 cm) — most popular' },
    { id: '6.14x9.21', w: 6.14, h: 9.21, label: '6.14" x 9.21" (15.6 x 23.39 cm)' },
    { id: '6.69x9.61', w: 6.69, h: 9.61, label: '6.69" x 9.61" (17 x 24.4 cm)' },
    { id: '7x10', w: 7, h: 10, label: '7" x 10" (17.78 x 25.4 cm)' },
    { id: '7.44x9.69', w: 7.44, h: 9.69, label: '7.44" x 9.69" (18.9 x 24.61 cm)' },
    { id: '7.5x9.25', w: 7.5, h: 9.25, label: '7.5" x 9.25" (19.05 x 23.5 cm)' },
    { id: '8x10', w: 8, h: 10, label: '8" x 10" (20.32 x 25.4 cm)' },
    { id: '8.25x6', w: 8.25, h: 6, label: '8.25" x 6" (20.96 x 15.24 cm) — landscape' },
    { id: '8.25x8.25', w: 8.25, h: 8.25, label: '8.25" x 8.25" (20.96 x 20.96 cm) — square' },
    { id: '8.5x8.5', w: 8.5, h: 8.5, label: '8.5" x 8.5" (21.59 x 21.59 cm) — square' },
    { id: '8.5x11', w: 8.5, h: 11, label: '8.5" x 11" (21.59 x 27.94 cm) — US Letter' },
    { id: '8.27x11.69', w: 8.27, h: 11.69, label: '8.27" x 11.69" (21 x 29.7 cm) — A4' },
  ];

  // Thickness per page (inches) by paper type.
  const PAPER = {
    white: { label: 'White paper, black & white', perPage: 0.002252, maxPages: 828 },
    cream: { label: 'Cream paper, black & white', perPage: 0.0025, maxPages: 776 },
    stdColor: { label: 'White paper, standard color', perPage: 0.002252, maxPages: 600 },
    premColor: { label: 'White paper, premium color', perPage: 0.002347, maxPages: 828 },
  };

  const MIN_PAGES = 24;
  const BLEED = 0.125;
  // A book needs MORE than this many pages to have spine text.
  const SPINE_TEXT_MIN_PAGES = 79;

  // Minimum inside (gutter) margin by page count.
  function minGutter(pages) {
    if (pages <= 150) return 0.375;
    if (pages <= 300) return 0.5;
    if (pages <= 500) return 0.625;
    if (pages <= 700) return 0.75;
    return 0.875;
  }

  // Minimum outside / top / bottom margin.
  function minOutside(bleed) {
    return bleed ? 0.375 : 0.25;
  }

  function trimById(id) {
    return TRIM_SIZES.find((t) => t.id === id) || TRIM_SIZES[4];
  }

  // PDF page size (including bleed if enabled).
  function pageSize(trim, bleed) {
    return bleed
      ? { w: trim.w + BLEED, h: trim.h + 2 * BLEED }
      : { w: trim.w, h: trim.h };
  }

  // Page 1 is a right-hand (recto) page: the gutter is on its left.
  function isRecto(pageNumber) {
    return pageNumber % 2 === 1;
  }

  // Safe content box for a page, measured from the top-left corner of the PDF page.
  function contentBox(cfg, pageNumber) {
    const trim = cfg.trim;
    const recto = isRecto(pageNumber);
    // Trim box position within the PDF page: bleed sits on the outside, top and bottom edges.
    const trimX = cfg.bleed && !recto ? BLEED : 0;
    const trimY = cfg.bleed ? BLEED : 0;
    const left = recto ? cfg.margins.inside : cfg.margins.outside;
    const right = recto ? cfg.margins.outside : cfg.margins.inside;
    return {
      x: trimX + left,
      y: trimY + cfg.margins.top,
      w: trim.w - left - right,
      h: trim.h - cfg.margins.top - cfg.margins.bottom,
      trimX,
      trimY,
      recto,
    };
  }

  function spineWidth(pages, paper) {
    return pages * PAPER[paper].perPage;
  }

  function coverSize(trim, pages, paper) {
    const spine = spineWidth(pages, paper);
    return {
      spine,
      w: BLEED + trim.w + spine + trim.w + BLEED,
      h: BLEED + trim.h + BLEED,
    };
  }

  // Validates settings; returns a list of {level: 'error'|'warn'|'ok', msg}.
  function validate(cfg) {
    const out = [];
    const pages = cfg.pages;
    const paper = PAPER[cfg.paper];
    if (pages % 2 !== 0) out.push({ level: 'error', msg: 'Page count must be an even number.' });
    if (pages < MIN_PAGES) out.push({ level: 'error', msg: `KDP requires at least ${MIN_PAGES} pages.` });
    if (pages > paper.maxPages) out.push({ level: 'error', msg: `This paper type allows at most ${paper.maxPages} pages.` });
    const g = minGutter(pages);
    if (cfg.margins.inside < g) out.push({ level: 'error', msg: `Gutter margin must be ≥ ${g}" for ${pages} pages (currently ${cfg.margins.inside}").` });
    const o = minOutside(cfg.bleed);
    ['outside', 'top', 'bottom'].forEach((k) => {
      if (cfg.margins[k] < o) out.push({ level: 'error', msg: `${LABEL[k]} margin must be ≥ ${o}" (currently ${cfg.margins[k]}").` });
    });
    if (pages <= SPINE_TEXT_MIN_PAGES) out.push({ level: 'warn', msg: `${SPINE_TEXT_MIN_PAGES} pages or fewer: KDP does not allow spine text.` });
    if (!out.some((m) => m.level === 'error')) out.push({ level: 'ok', msg: 'Settings meet KDP requirements.' });
    return out;
  }

  const LABEL = { outside: 'Outside', top: 'Top', bottom: 'Bottom', inside: 'Gutter' };

  global.KDP = {
    TRIM_SIZES, PAPER, MIN_PAGES, BLEED, SPINE_TEXT_MIN_PAGES,
    minGutter, minOutside, trimById, pageSize, isRecto, contentBox,
    spineWidth, coverSize, validate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
