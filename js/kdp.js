// Thông số kỹ thuật Amazon KDP cho sách in (paperback).
// Đơn vị: inch. Nguồn: KDP Help — "Set Trim Size, Bleed, and Margins" và "Cover calculator".
(function (global) {
  'use strict';

  const TRIM_SIZES = [
    { id: '5x8', w: 5, h: 8, label: '5" x 8" (12.7 x 20.32 cm)' },
    { id: '5.06x7.81', w: 5.06, h: 7.81, label: '5.06" x 7.81" (12.85 x 19.84 cm)' },
    { id: '5.25x8', w: 5.25, h: 8, label: '5.25" x 8" (13.34 x 20.32 cm)' },
    { id: '5.5x8.5', w: 5.5, h: 8.5, label: '5.5" x 8.5" (13.97 x 21.59 cm)' },
    { id: '6x9', w: 6, h: 9, label: '6" x 9" (15.24 x 22.86 cm) — phổ biến nhất' },
    { id: '6.14x9.21', w: 6.14, h: 9.21, label: '6.14" x 9.21" (15.6 x 23.39 cm)' },
    { id: '6.69x9.61', w: 6.69, h: 9.61, label: '6.69" x 9.61" (17 x 24.4 cm)' },
    { id: '7x10', w: 7, h: 10, label: '7" x 10" (17.78 x 25.4 cm)' },
    { id: '7.44x9.69', w: 7.44, h: 9.69, label: '7.44" x 9.69" (18.9 x 24.61 cm)' },
    { id: '7.5x9.25', w: 7.5, h: 9.25, label: '7.5" x 9.25" (19.05 x 23.5 cm)' },
    { id: '8x10', w: 8, h: 10, label: '8" x 10" (20.32 x 25.4 cm)' },
    { id: '8.25x6', w: 8.25, h: 6, label: '8.25" x 6" (20.96 x 15.24 cm) — ngang' },
    { id: '8.25x8.25', w: 8.25, h: 8.25, label: '8.25" x 8.25" (20.96 x 20.96 cm) — vuông' },
    { id: '8.5x8.5', w: 8.5, h: 8.5, label: '8.5" x 8.5" (21.59 x 21.59 cm) — vuông' },
    { id: '8.5x11', w: 8.5, h: 11, label: '8.5" x 11" (21.59 x 27.94 cm) — khổ Letter' },
    { id: '8.27x11.69', w: 8.27, h: 11.69, label: '8.27" x 11.69" (21 x 29.7 cm) — A4' },
  ];

  // Độ dày mỗi trang (inch) theo loại giấy.
  const PAPER = {
    white: { label: 'Giấy trắng, in đen trắng', perPage: 0.002252, maxPages: 828 },
    cream: { label: 'Giấy kem, in đen trắng', perPage: 0.0025, maxPages: 776 },
    stdColor: { label: 'Giấy trắng, in màu tiêu chuẩn', perPage: 0.002252, maxPages: 600 },
    premColor: { label: 'Giấy trắng, in màu cao cấp', perPage: 0.002347, maxPages: 828 },
  };

  const MIN_PAGES = 24;
  const BLEED = 0.125;
  // Sách phải có NHIỀU HƠN số trang này mới được in chữ trên gáy.
  const SPINE_TEXT_MIN_PAGES = 79;

  // Lề trong (gáy) tối thiểu theo số trang.
  function minGutter(pages) {
    if (pages <= 150) return 0.375;
    if (pages <= 300) return 0.5;
    if (pages <= 500) return 0.625;
    if (pages <= 700) return 0.75;
    return 0.875;
  }

  // Lề ngoài / trên / dưới tối thiểu.
  function minOutside(bleed) {
    return bleed ? 0.375 : 0.25;
  }

  function trimById(id) {
    return TRIM_SIZES.find((t) => t.id === id) || TRIM_SIZES[4];
  }

  // Kích thước trang PDF (đã gồm bleed nếu có).
  function pageSize(trim, bleed) {
    return bleed
      ? { w: trim.w + BLEED, h: trim.h + 2 * BLEED }
      : { w: trim.w, h: trim.h };
  }

  // Trang 1 là trang phải (recto): gáy nằm bên trái.
  function isRecto(pageNumber) {
    return pageNumber % 2 === 1;
  }

  // Tính hộp an toàn (vùng vẽ nội dung) cho một trang, toạ độ tính từ góc trên-trái của trang PDF.
  function contentBox(cfg, pageNumber) {
    const trim = cfg.trim;
    const recto = isRecto(pageNumber);
    // Vị trí khung xén trong trang PDF: bleed nằm ở mép ngoài, trên và dưới.
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

  // Kiểm tra cấu hình; trả về danh sách {level: 'error'|'warn'|'ok', msg}.
  function validate(cfg) {
    const out = [];
    const pages = cfg.pages;
    const paper = PAPER[cfg.paper];
    if (pages % 2 !== 0) out.push({ level: 'error', msg: 'Số trang phải là số chẵn.' });
    if (pages < MIN_PAGES) out.push({ level: 'error', msg: `KDP yêu cầu tối thiểu ${MIN_PAGES} trang.` });
    if (pages > paper.maxPages) out.push({ level: 'error', msg: `Loại giấy này cho phép tối đa ${paper.maxPages} trang.` });
    const g = minGutter(pages);
    if (cfg.margins.inside < g) out.push({ level: 'error', msg: `Lề gáy phải ≥ ${g}" cho ${pages} trang (hiện tại ${cfg.margins.inside}").` });
    const o = minOutside(cfg.bleed);
    ['outside', 'top', 'bottom'].forEach((k) => {
      if (cfg.margins[k] < o) out.push({ level: 'error', msg: `Lề ${LABEL[k]} phải ≥ ${o}" (hiện tại ${cfg.margins[k]}").` });
    });
    if (pages <= SPINE_TEXT_MIN_PAGES) out.push({ level: 'warn', msg: `Từ ${SPINE_TEXT_MIN_PAGES} trang trở xuống: KDP không cho in chữ trên gáy sách.` });
    if (!out.some((m) => m.level === 'error')) out.push({ level: 'ok', msg: 'Cấu hình đạt chuẩn KDP.' });
    return out;
  }

  const LABEL = { outside: 'ngoài', top: 'trên', bottom: 'dưới', inside: 'gáy' };

  global.KDP = {
    TRIM_SIZES, PAPER, MIN_PAGES, BLEED, SPINE_TEXT_MIN_PAGES,
    minGutter, minOutside, trimById, pageSize, isRecto, contentBox,
    spineWidth, coverSize, validate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
