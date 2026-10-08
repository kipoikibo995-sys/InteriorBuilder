// Low-content page templates. Each template draws inside "box" (the safe area, in inches).
(function (global) {
  'use strict';

  // ---------- Shared helpers ----------

  function st(ctx) {
    return ctx.style; // { line, dark, text, lineW }
  }

  // A "Label: ________" line.
  function labeledLine(p, ctx, label, x, y, w, size = 10) {
    const s = st(ctx);
    p.text(label, x, y, { size, color: s.text, bold: true });
    const lw = p.textWidth(label, { size, bold: true }) + 0.08;
    p.line(x + lw, y + 0.03, x + w, y + 0.03, { color: s.line, w: s.lineW });
  }

  // Page title plus an optional date line. Returns the y where content starts.
  function header(p, box, ctx, title, opts = {}) {
    const s = st(ctx);
    let y = box.y;
    if (title) {
      y += 0.3;
      p.text(title, box.x + box.w / 2, y, { size: opts.titleSize || 18, bold: true, align: 'center', color: s.text });
      y += 0.18;
    }
    if (opts.date) {
      y += 0.25;
      const dw = Math.min(2.6, box.w * 0.55);
      labeledLine(p, ctx, 'Date:', box.x + box.w - dw, y, dw);
      y += 0.12;
    }
    return y + 0.1;
  }

  function hLines(p, ctx, x, y0, w, y1, spacing) {
    const s = st(ctx);
    let n = 0;
    for (let y = y0 + spacing; y <= y1 + 1e-6; y += spacing) {
      p.line(x, y, x + w, y, { color: s.line, w: s.lineW });
      n++;
    }
    return n;
  }

  function checkbox(p, ctx, x, y, size = 0.13) {
    const s = st(ctx);
    p.rect(x, y - size, size, size, { color: s.dark, w: 0.6, radius: 0.015 });
  }

  // Small shaded section heading.
  function sectionTitle(p, ctx, label, x, y, w) {
    const s = st(ctx);
    p.rect(x, y - 0.17, w, 0.24, { fill: s.fill, stroke: false });
    p.text(label, x + 0.08, y, { size: 9.5, bold: true, color: s.text });
  }

  // Lays out sections (heading + n ruled lines) to fill the remaining height.
  function sections(p, box, ctx, y, list) {
    const titleH = 0.32, gap = 0.12;
    const totalLines = list.reduce((a, b) => a + b.lines, 0);
    const avail = box.y + box.h - y - list.length * (titleH + gap);
    const spacing = Math.max(0.22, Math.min(0.38, avail / totalLines));
    list.forEach((sec) => {
      y += 0.2;
      sectionTitle(p, ctx, sec.title, box.x, y, box.w);
      y += titleH - 0.2;
      for (let i = 0; i < sec.lines; i++) {
        y += spacing;
        if (sec.numbered) p.text(`${i + 1}.`, box.x + 0.02, y - 0.04, { size: 9, color: st(ctx).text });
        if (sec.checkbox) checkbox(p, ctx, box.x + 0.02, y - 0.04);
        const off = sec.numbered || sec.checkbox ? 0.25 : 0;
        p.line(box.x + off, y, box.x + box.w, y, { color: st(ctx).line, w: st(ctx).lineW });
      }
      y += gap;
    });
    return y;
  }

  // Evenly spaced grid, centered in the available length.
  function centeredGrid(len, spacing) {
    const n = Math.floor(len / spacing + 1e-6);
    return { n, offset: (len - n * spacing) / 2 };
  }

  // Multi-column table. cols: [{name, weight}]
  function table(p, box, ctx, y, cols, rowH, opts = {}) {
    const s = st(ctx);
    const totalW = cols.reduce((a, c) => a + c.weight, 0);
    const headH = opts.headH || 0.32;
    const rows = Math.floor((box.y + box.h - y - headH) / rowH + 1e-6);
    const bottom = y + headH + rows * rowH;
    p.rect(box.x, y, box.w, headH, { fill: s.fill, stroke: false });
    let x = box.x;
    const xs = [x];
    cols.forEach((c) => {
      const w = (c.weight / totalW) * box.w;
      p.text(c.name, x + w / 2, y + headH / 2 + 0.045, { size: opts.headSize || 8.5, bold: true, align: 'center', color: s.text });
      x += w;
      xs.push(x);
    });
    for (let r = 0; r <= rows; r++) {
      const yy = y + headH + r * rowH;
      p.line(box.x, yy, box.x + box.w, yy, { color: s.line, w: s.lineW });
    }
    p.line(box.x, y, box.x + box.w, y, { color: s.dark, w: 0.8 });
    xs.forEach((xx) => p.line(xx, y, xx, bottom, { color: s.line, w: s.lineW }));
    return { rows, bottom, xs, headH };
  }

  function parseColumns(str) {
    return String(str || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const m = c.match(/^(.*?)\s*\*\s*(\d+(?:\.\d+)?)$/);
        return m ? { name: m[1], weight: parseFloat(m[2]) } : { name: c, weight: 1 };
      });
  }

  // ---------- Templates ----------

  const T = [];

  T.push({
    id: 'blank', name: 'Blank', group: 'Basics',
    options: [],
    draw() {},
  });

  T.push({
    id: 'lined', name: 'Lined / Ruled', group: 'Basics',
    options: [
      { key: 'spacing', label: 'Line spacing', type: 'select', default: '0.28125', choices: [
        ['0.34375', 'Wide ruled — 8.7 mm'], ['0.28125', 'College ruled — 7.1 mm'], ['0.25', 'Narrow — 6.35 mm'] ] },
      { key: 'head', label: 'Header', type: 'select', default: 'date', choices: [
        ['none', 'None'], ['date', 'Date line'], ['title', 'Title + date'] ] },
      { key: 'title', label: 'Title', type: 'text', default: 'Notes' },
      { key: 'marginLine', label: 'Vertical margin line', type: 'checkbox', default: false },
    ],
    draw(p, box, o, ctx) {
      let y = box.y;
      if (o.head === 'date') y = header(p, box, ctx, null, { date: true });
      if (o.head === 'title') y = header(p, box, ctx, o.title, { date: true });
      const sp = parseFloat(o.spacing);
      hLines(p, ctx, box.x, y, box.w, box.y + box.h, sp);
      if (o.marginLine) {
        const mx = box.x + (ctx.recto ? 0.6 : box.w - 0.6);
        p.line(mx, y, mx, box.y + box.h, { color: ctx.style.dark, w: 0.6 });
      }
    },
  });

  T.push({
    id: 'dotgrid', name: 'Dot grid', group: 'Basics',
    options: [
      { key: 'spacing', label: 'Dot spacing', type: 'select', default: '0.19685', choices: [
        ['0.19685', '5 mm'], ['0.25', '1/4 inch'], ['0.3937', '10 mm'] ] },
      { key: 'dot', label: 'Dot size (pt)', type: 'number', default: 1.3, min: 0.5, max: 4, step: 0.1 },
    ],
    draw(p, box, o, ctx) {
      const sp = parseFloat(o.spacing);
      const gx = centeredGrid(box.w, sp), gy = centeredGrid(box.h, sp);
      const d = o.dot / 72;
      for (let i = 0; i <= gx.n; i++)
        for (let j = 0; j <= gy.n; j++)
          p.dot(box.x + gx.offset + i * sp, box.y + gy.offset + j * sp, d, ctx.style.dark);
    },
  });

  T.push({
    id: 'graph', name: 'Graph / Grid', group: 'Basics',
    options: [
      { key: 'spacing', label: 'Square size', type: 'select', default: '0.25', choices: [
        ['0.125', '1/8 inch'], ['0.19685', '5 mm'], ['0.2', '5 squares / inch'], ['0.25', '1/4 inch'], ['0.3937', '10 mm'] ] },
      { key: 'major', label: 'Bold line every N squares (0 = off)', type: 'number', default: 0, min: 0, max: 10, step: 1 },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style, sp = parseFloat(o.spacing);
      const gx = centeredGrid(box.w, sp), gy = centeredGrid(box.h, sp);
      const x0 = box.x + gx.offset, y0 = box.y + gy.offset;
      const x1 = x0 + gx.n * sp, y1 = y0 + gy.n * sp;
      const major = parseInt(o.major, 10) || 0;
      const opt = (i, n) => (major && i % major === 0) || i === 0 || i === n
        ? { color: s.dark, w: 0.6 } : { color: s.line, w: s.lineW * 0.8 };
      for (let i = 0; i <= gx.n; i++) p.line(x0 + i * sp, y0, x0 + i * sp, y1, opt(i, gx.n));
      for (let j = 0; j <= gy.n; j++) p.line(x0, y0 + j * sp, x1, y0 + j * sp, opt(j, gy.n));
    },
  });

  T.push({
    id: 'handwriting', name: 'Handwriting practice', group: 'Kids',
    options: [
      { key: 'row', label: 'Row height', type: 'select', default: '0.75', choices: [
        ['0.5', '1/2 inch (older kids)'], ['0.75', '3/4 inch'], ['1', '1 inch (preschool)'] ] },
      { key: 'name', label: 'Name / Date line', type: 'checkbox', default: true },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y;
      if (o.name) {
        y += 0.25;
        labeledLine(p, ctx, 'Name:', box.x, y, box.w * 0.6 - 0.15);
        labeledLine(p, ctx, 'Date:', box.x + box.w * 0.6, y, box.w * 0.4);
        y += 0.2;
      }
      const h = parseFloat(o.row), gap = h * 0.35;
      while (y + h <= box.y + box.h + 1e-6) {
        p.line(box.x, y, box.x + box.w, y, { color: s.dark, w: 0.8 });
        p.line(box.x, y + h / 2, box.x + box.w, y + h / 2, { color: s.line, w: 0.6, dash: [0.06, 0.05] });
        p.line(box.x, y + h, box.x + box.w, y + h, { color: s.dark, w: 1.2 });
        y += h + gap;
      }
    },
  });

  T.push({
    id: 'music', name: 'Music staff', group: 'Basics',
    options: [
      { key: 'staves', label: 'Staves per page', type: 'number', default: 10, min: 4, max: 14, step: 1 },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style, n = parseInt(o.staves, 10);
      const slot = box.h / n;
      const ls = Math.min(0.09, slot / 7);
      for (let i = 0; i < n; i++) {
        const top = box.y + i * slot + (slot - 4 * ls) / 2;
        for (let k = 0; k < 5; k++) p.line(box.x, top + k * ls, box.x + box.w, top + k * ls, { color: s.dark, w: 0.6 });
        p.line(box.x, top, box.x, top + 4 * ls, { color: s.dark, w: 0.6 });
        p.line(box.x + box.w, top, box.x + box.w, top + 4 * ls, { color: s.dark, w: 0.6 });
      }
    },
  });

  T.push({
    id: 'sketch', name: 'Sketchbook', group: 'Creative',
    options: [
      { key: 'caption', label: 'Title / Date line at bottom', type: 'checkbox', default: true },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      const capH = o.caption ? 0.55 : 0;
      p.rect(box.x, box.y, box.w, box.h - capH, { color: s.dark, w: 1 });
      if (o.caption) {
        const y = box.y + box.h - 0.1;
        labeledLine(p, ctx, 'Title:', box.x, y, box.w * 0.62 - 0.15);
        labeledLine(p, ctx, 'Date:', box.x + box.w * 0.62, y, box.w * 0.38);
      }
    },
  });

  T.push({
    id: 'gratitude', name: 'Gratitude journal', group: 'Journals',
    options: [
      { key: 'title', label: 'Title', type: 'text', default: 'Gratitude Journal' },
      { key: 'affirm', label: 'Affirmation section', type: 'checkbox', default: true },
    ],
    draw(p, box, o, ctx) {
      let y = header(p, box, ctx, o.title, { date: true, titleSize: 16 });
      const list = [
        { title: 'Today I am grateful for...', lines: 3, numbered: true },
        { title: 'What would make today great?', lines: 3, numbered: true },
        { title: 'Today\'s highlight', lines: 3 },
        { title: 'Something I learned today', lines: 2 },
      ];
      if (o.affirm) list.push({ title: 'Daily affirmation', lines: 2 });
      sections(p, box, ctx, y, list);
    },
  });

  T.push({
    id: 'daily', name: 'Daily planner', group: 'Planners',
    options: [
      { key: 'start', label: 'Start hour', type: 'number', default: 6, min: 0, max: 12, step: 1 },
      { key: 'end', label: 'End hour', type: 'number', default: 21, min: 13, max: 23, step: 1 },
      { key: 'h24', label: '24-hour format', type: 'checkbox', default: false },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y + 0.28;
      labeledLine(p, ctx, 'Date:', box.x, y, box.w * 0.5);
      const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const dx = box.w * 0.5 / 7;
      days.forEach((d, i) => {
        const cx = box.x + box.w * 0.5 + dx * (i + 0.5);
        p.circle(cx, y - 0.04, 0.1, { stroke: true, color: s.dark, w: 0.5 });
        p.text(d, cx, y - 0.01, { size: 7.5, align: 'center', color: s.text });
      });
      y += 0.2;
      const colGap = 0.2, lw = box.w * 0.52, rw = box.w - lw - colGap;
      const rx = box.x + lw + colGap;
      const top = y;
      // Hourly schedule
      sectionTitle(p, ctx, 'Schedule', box.x, y + 0.2, lw);
      const hours = [];
      for (let h = parseInt(o.start, 10); h <= parseInt(o.end, 10); h++) hours.push(h);
      const sy = y + 0.33, rowH = (box.y + box.h - sy) / hours.length;
      hours.forEach((h, i) => {
        const yy = sy + (i + 1) * rowH;
        const lab = o.h24 ? `${String(h).padStart(2, '0')}:00` : `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
        p.text(lab, box.x + 0.03, yy - rowH / 2 + 0.04, { size: 8, color: s.text });
        p.line(box.x, yy, box.x + lw, yy, { color: s.line, w: s.lineW });
        p.line(box.x + 0.5, yy - rowH + rowH * 0.5, box.x + lw, yy - rowH + rowH * 0.5, { color: s.line, w: 0.35, dash: [0.03, 0.04] });
      });
      p.line(box.x + 0.45, sy, box.x + 0.45, box.y + box.h, { color: s.line, w: s.lineW });
      // Right column
      const right = { x: rx, y: top, w: rw, h: box.y + box.h - top - 0.95 };
      sections(p, right, ctx, top, [
        { title: 'Top priorities', lines: 3, numbered: true },
        { title: 'To do', lines: 8, checkbox: true },
        { title: 'Notes', lines: 5 },
      ]);
      // Water intake
      const wy = box.y + box.h - 0.55;
      sectionTitle(p, ctx, 'Water', rx, wy, rw);
      const gw = rw / 8;
      for (let i = 0; i < 8; i++) p.rect(rx + i * gw + gw * 0.2, wy + 0.17, gw * 0.6, 0.3, { color: s.dark, w: 0.5, radius: 0.03 });
    },
  });

  T.push({
    id: 'weekly', name: 'Weekly planner', group: 'Planners',
    options: [
      { key: 'monday', label: 'Week starts on Monday', type: 'checkbox', default: true },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y + 0.28;
      p.text('Weekly Planner', box.x, y, { size: 15, bold: true, color: s.text });
      labeledLine(p, ctx, 'Week of:', box.x + box.w * 0.5, y, box.w * 0.5);
      y += 0.2;
      const days = o.monday
        ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Notes']
        : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Notes'];
      const gap = 0.12, cw = (box.w - gap) / 2, ch = (box.y + box.h - y - gap * 3) / 4;
      days.forEach((d, i) => {
        const cx = box.x + (i % 2) * (cw + gap), cy = y + Math.floor(i / 2) * (ch + gap);
        p.rect(cx, cy, cw, ch, { color: s.dark, w: 0.6, radius: 0.05 });
        p.text(d, cx + 0.1, cy + 0.22, { size: 9.5, bold: true, color: s.text });
        hLines(p, ctx, cx + 0.1, cy + 0.3, cw - 0.2, cy + ch - 0.08, 0.26);
      });
    },
  });

  T.push({
    id: 'habit', name: 'Habit tracker', group: 'Planners',
    options: [
      { key: 'title', label: 'Title', type: 'text', default: 'Habit Tracker' },
      { key: 'rows', label: 'Number of habits', type: 'number', default: 15, min: 5, max: 30, step: 1 },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y + 0.3;
      p.text(o.title, box.x, y, { size: 15, bold: true, color: s.text });
      labeledLine(p, ctx, 'Month:', box.x + box.w * 0.55, y, box.w * 0.45);
      y += 0.25;
      const rows = parseInt(o.rows, 10);
      const nameW = Math.max(1.2, box.w * 0.28);
      const dayW = (box.w - nameW) / 31;
      const headH = 0.25;
      const rowH = Math.min(0.45, (box.y + box.h - y - headH) / rows);
      p.rect(box.x, y, box.w, headH, { fill: s.fill, stroke: false });
      p.text('Habit', box.x + 0.08, y + 0.17, { size: 8.5, bold: true, color: s.text });
      for (let d = 1; d <= 31; d++)
        p.text(String(d), box.x + nameW + (d - 0.5) * dayW, y + 0.165, { size: Math.min(7, dayW * 72 * 0.55), align: 'center', color: s.text });
      const bottom = y + headH + rows * rowH;
      for (let r = 0; r <= rows; r++) {
        const yy = y + headH + r * rowH;
        p.line(box.x, yy, box.x + box.w, yy, { color: s.line, w: s.lineW });
      }
      p.line(box.x, y, box.x + box.w, y, { color: s.dark, w: 0.8 });
      p.line(box.x, y, box.x, bottom, { color: s.line, w: s.lineW });
      for (let d = 0; d <= 31; d++) {
        const xx = box.x + nameW + d * dayW;
        p.line(xx, y, xx, bottom, { color: s.line, w: d === 0 ? 0.8 : s.lineW * 0.8 });
      }
    },
  });

  T.push({
    id: 'logbook', name: 'Log book (custom columns)', group: 'Log books',
    options: [
      { key: 'title', label: 'Title', type: 'text', default: 'Mileage Log' },
      { key: 'columns', label: 'Columns (comma-separated, "*2" = double width)', type: 'text', default: 'Date, Start, End, Miles, Purpose*2.5' },
      { key: 'rowH', label: 'Row height (in)', type: 'number', default: 0.32, min: 0.2, max: 1, step: 0.01 },
      { key: 'presets', label: 'Column presets', type: 'preset', target: 'columns', choices: [
        ['Date, Start, End, Miles, Purpose*2.5', 'Mileage log'],
        ['Date, Time In, Time Out, Name*2, Signature*1.5', 'Visitor log'],
        ['Date, Description*3, Income, Expense, Balance', 'Budget log'],
        ['Date, Time, Location*2, Depth, Duration, Notes*2', 'Dive log'],
        ['Date, Medication*2, Dose, Time, Notes*2', 'Medication log'],
        ['Date, Exercise*2, Sets, Reps, Weight, Notes*1.5', 'Workout log'],
        ['Date, Book Title*2.5, Author*1.5, Pages, Rating', 'Reading log'],
      ] },
    ],
    draw(p, box, o, ctx) {
      let y = header(p, box, ctx, o.title, { titleSize: 15 });
      const cols = parseColumns(o.columns);
      if (!cols.length) return;
      table(p, box, ctx, y, cols, Math.max(0.2, parseFloat(o.rowH) || 0.32));
    },
  });

  T.push({
    id: 'password', name: 'Password log', group: 'Log books',
    options: [
      { key: 'per', label: 'Entries per page', type: 'number', default: 4, min: 2, max: 6, step: 1 },
      { key: 'az', label: 'A–Z letter tab box', type: 'checkbox', default: true },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y;
      if (o.az) {
        p.rect(box.x + box.w - 0.5, y, 0.5, 0.42, { color: s.dark, w: 0.8, radius: 0.05 });
        y += 0.55;
      }
      const n = parseInt(o.per, 10), gap = 0.15;
      const eh = (box.y + box.h - y - gap * (n - 1)) / n;
      const fields = ['Website:', 'Username:', 'Email:', 'Password:', 'Notes:'];
      for (let i = 0; i < n; i++) {
        const ey = y + i * (eh + gap);
        p.rect(box.x, ey, box.w, eh, { color: s.dark, w: 0.6, radius: 0.06 });
        const fh = (eh - 0.1) / fields.length;
        fields.forEach((f, k) => {
          labeledLine(p, ctx, f, box.x + 0.12, ey + 0.05 + (k + 1) * fh - fh * 0.25, box.w - 0.24, Math.min(10, fh * 72 * 0.45));
        });
      }
    },
  });

  T.push({
    id: 'recipe', name: 'Recipe book', group: 'Journals',
    options: [],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y + 0.3;
      labeledLine(p, ctx, 'Recipe:', box.x, y, box.w, 12);
      y += 0.38;
      const q = box.w / 4;
      ['Serves:', 'Prep:', 'Cook:', 'Temp:'].forEach((f, i) => labeledLine(p, ctx, f, box.x + i * q, y, q - 0.12, 9));
      y += 0.3;
      p.text('Rating:', box.x, y, { size: 9, bold: true, color: s.text });
      for (let i = 0; i < 5; i++) star(p, box.x + 0.65 + i * 0.22, y - 0.05, 0.08, s.dark);
      y += 0.05;
      sections(p, box, ctx, y, [
        { title: 'Ingredients', lines: 8, checkbox: true },
        { title: 'Directions', lines: 10, numbered: true },
        { title: 'Notes', lines: 3 },
      ]);
    },
  });

  function star(p, cx, cy, r, color) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    for (let i = 0; i < 10; i++) {
      const a = pts[i], b = pts[(i + 1) % 10];
      p.line(a[0], a[1], b[0], b[1], { color, w: 0.5 });
    }
  }

  T.push({
    id: 'todo', name: 'To-do list', group: 'Planners',
    options: [
      { key: 'title', label: 'Title', type: 'text', default: 'To Do List' },
      { key: 'spacing', label: 'Line spacing (in)', type: 'number', default: 0.36, min: 0.25, max: 0.6, step: 0.01 },
    ],
    draw(p, box, o, ctx) {
      let y = header(p, box, ctx, o.title, { date: true, titleSize: 16 });
      const sp = parseFloat(o.spacing);
      for (let yy = y + sp; yy <= box.y + box.h + 1e-6; yy += sp) {
        checkbox(p, ctx, box.x, yy - 0.06);
        p.line(box.x + 0.25, yy, box.x + box.w, yy, { color: ctx.style.line, w: ctx.style.lineW });
      }
    },
  });

  T.push({
    id: 'cornell', name: 'Cornell notes', group: 'Basics',
    options: [
      { key: 'spacing', label: 'Line spacing (in)', type: 'number', default: 0.28, min: 0.22, max: 0.4, step: 0.01 },
    ],
    draw(p, box, o, ctx) {
      const s = ctx.style;
      let y = box.y + 0.25;
      labeledLine(p, ctx, 'Topic:', box.x, y, box.w * 0.6 - 0.15);
      labeledLine(p, ctx, 'Date:', box.x + box.w * 0.6, y, box.w * 0.4);
      y += 0.15;
      const sumH = Math.min(1.8, box.h * 0.2);
      const sumY = box.y + box.h - sumH;
      const cueW = box.w * 0.3;
      p.line(box.x, y, box.x + box.w, y, { color: s.dark, w: 1 });
      p.line(box.x + cueW, y, box.x + cueW, sumY, { color: s.dark, w: 1 });
      p.line(box.x, sumY, box.x + box.w, sumY, { color: s.dark, w: 1 });
      p.text('Cues / Questions', box.x + 0.05, y + 0.2, { size: 8, bold: true, color: s.text });
      p.text('Notes', box.x + cueW + 0.08, y + 0.2, { size: 8, bold: true, color: s.text });
      hLines(p, ctx, box.x + cueW + 0.08, y + 0.1, box.w - cueW - 0.08, sumY - 0.05, parseFloat(o.spacing));
      p.text('Summary', box.x + 0.05, sumY + 0.2, { size: 8, bold: true, color: s.text });
      hLines(p, ctx, box.x, sumY + 0.1, box.w, box.y + box.h, parseFloat(o.spacing));
    },
  });

  // ---------- Puzzles ----------
  // A puzzle template has a `puzzle` block instead of `draw`. The book planner (book.js) gives each
  // puzzle page its own items and adds answer-key pages at the end of the book.

  const PZ = global.Puzzles;

  // Text vertically centered on y.
  function ctext(p, str, x, y, o) {
    p.text(str, x, y + ((o.size || 10) * 0.35) / 72, o);
  }

  // Splits a rect into a cols x rows grid of cells.
  function cells(rect, cols, rows, gap = 0.25) {
    const w = (rect.w - gap * (cols - 1)) / cols, h = (rect.h - gap * (rows - 1)) / rows;
    const out = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) out.push({ x: rect.x + c * (w + gap), y: rect.y + r * (h + gap), w, h });
    return out;
  }

  const LAYOUTS = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 6: [2, 3], 9: [3, 3] };

  function layoutFor(n, rect) {
    const [a, b] = LAYOUTS[n] || [1, n];
    // Landscape pages get more columns than rows.
    return rect.w > rect.h ? cells(rect, b, a) : cells(rect, a, b);
  }

  const SUDOKU = {
    make(o, index, total) {
      let level = o.level;
      if (level === 'progressive') {
        const steps = ['easy', 'medium', 'hard', 'expert'];
        level = steps[Math.min(3, Math.floor((index / Math.max(1, total)) * 4))];
      }
      return { kind: 'sudoku', ...PZ.sudoku(`${o.seed}|sudoku|${index}`, level) };
    },
    draw(p, rect, item, num, ctx, solution) {
      const s = ctx.style;
      const labelH = solution ? 0.22 : 0.32;
      const side = Math.min(rect.w, rect.h - labelH);
      const x0 = rect.x + (rect.w - side) / 2;
      const y0 = rect.y + labelH + (rect.h - labelH - side) / 2;
      const label = `${solution ? '#' : 'Sudoku #'}${num}`;
      const levelName = PZ.SUDOKU_LEVELS[item.level].label;
      const ls = solution ? 8 : 10;
      p.text(label, x0, y0 - 0.09, { size: ls, bold: true, color: s.text });
      p.text(levelName, x0 + side, y0 - 0.09, { size: ls - 1, color: s.text, align: 'right' });
      const cs = side / 9;
      for (let i = 0; i <= 9; i++) {
        const thick = i % 3 === 0;
        const o = { color: thick ? s.text : s.line, w: thick ? (solution ? 1.2 : 1.8) : 0.5 };
        p.line(x0 + i * cs, y0, x0 + i * cs, y0 + side, o);
        p.line(x0, y0 + i * cs, x0 + side, y0 + i * cs, o);
      }
      const size = cs * 72 * 0.58;
      for (let i = 0; i < 81; i++) {
        const given = item.puzzle[i];
        const v = given || (solution ? item.solution[i] : 0);
        if (!v) continue;
        const cx = x0 + (i % 9 + 0.5) * cs, cy = y0 + (Math.floor(i / 9) + 0.5) * cs;
        ctext(p, String(v), cx, cy, { size, align: 'center', bold: !!given, color: given ? s.text : s.line });
      }
    },
  };

  const WORDSEARCH = {
    make(o, index) {
      const lists = PZ.parseWordLists(o.words);
      const list = lists.length ? lists[index % lists.length] : { theme: 'Word Search', words: ['EMPTY'] };
      return {
        kind: 'wordsearch',
        ...PZ.wordSearch(`${o.seed}|ws|${index}`, {
          size: parseInt(o.size, 10), level: o.wsLevel, words: list.words,
          count: parseInt(o.count, 10), theme: list.theme,
        }),
      };
    },
    draw(p, rect, item, num, ctx, solution) {
      const s = ctx.style;
      let y = rect.y;
      if (solution) {
        p.text(`#${num} ${item.theme}`, rect.x + rect.w / 2, y + 0.14, { size: 8, bold: true, align: 'center', color: s.text });
        y += 0.24;
      } else {
        p.text(item.theme, rect.x + rect.w / 2, y + 0.3, { size: 18, bold: true, align: 'center', color: s.text });
        p.text(`Word Search #${num}`, rect.x + rect.w / 2, y + 0.52, { size: 9, align: 'center', color: s.text });
        y += 0.72;
      }
      const words = item.placed.map((w) => w.word.toUpperCase());
      const cols = rect.w > 4.5 ? 4 : 3;
      const listRows = Math.ceil(words.length / cols);
      const listH = solution ? 0 : listRows * 0.24 + 0.25;
      const side = Math.min(rect.w, rect.y + rect.h - y - listH);
      const x0 = rect.x + (rect.w - side) / 2;
      const cs = side / item.size;
      if (solution) {
        // Each found word gets a rounded outline: a thick dark stroke with a slightly thinner light stroke on top.
        const ends = item.placed.map((w) => [
          x0 + (w.c + 0.5) * cs, y + (w.r + 0.5) * cs,
          x0 + (w.c + w.dc * (w.len - 1) + 0.5) * cs, y + (w.r + w.dr * (w.len - 1) + 0.5) * cs,
        ]);
        const wOuter = cs * 72 * 0.8;
        ends.forEach(([ax, ay, bx, by]) => p.line(ax, ay, bx, by, { color: s.dark, w: wOuter }));
        ends.forEach(([ax, ay, bx, by]) => p.line(ax, ay, bx, by, { color: s.fill, w: wOuter - 1.4 }));
      }
      p.rect(x0, y, side, side, { color: s.dark, w: solution ? 0.6 : 1, radius: 0.04 });
      const size = cs * 72 * (solution ? 0.62 : 0.58);
      for (let r = 0; r < item.size; r++)
        for (let c = 0; c < item.size; c++)
          ctext(p, item.grid[r][c], x0 + (c + 0.5) * cs, y + (r + 0.5) * cs, { size, align: 'center', color: s.text, bold: !solution });
      if (solution) return;
      const ly = y + side + 0.35, colW = rect.w / cols;
      words.forEach((w, i) => {
        const cx = rect.x + (i % cols) * colW, cy = ly + Math.floor(i / cols) * 0.24;
        p.rect(cx + 0.05, cy - 0.1, 0.1, 0.1, { color: s.dark, w: 0.5, radius: 0.015 });
        p.text(w, cx + 0.22, cy, { size: Math.min(10, colW * 72 / Math.max(8, w.length) * 1.3), color: s.text });
      });
    },
  };

  const KINDS = { sudoku: SUDOKU, wordsearch: WORDSEARCH };

  const SEED = { key: 'seed', label: 'Puzzle seed (change for a new set)', type: 'seed', default: 'book-1' };
  const SOLUTIONS = { key: 'solutions', label: 'Answer key at the back', type: 'checkbox', default: true };
  const SUDOKU_LEVEL = { key: 'level', label: 'Difficulty', type: 'select', default: 'medium', choices: [
    ['easy', 'Easy (~40 clues)'], ['medium', 'Medium (~32 clues)'], ['hard', 'Hard (~27 clues)'],
    ['expert', 'Expert (~24 clues)'], ['progressive', 'Progressive: easy → expert'] ] };
  const WS_OPTS = [
    { key: 'size', label: 'Grid size', type: 'select', default: '15', choices: [
      ['10', '10 x 10 (kids)'], ['12', '12 x 12'], ['15', '15 x 15'], ['17', '17 x 17'], ['20', '20 x 20'] ] },
    { key: 'count', label: 'Words per puzzle', type: 'number', default: 16, min: 5, max: 30, step: 1 },
    { key: 'wsLevel', label: 'Word directions', type: 'select', default: 'medium',
      choices: Object.entries(PZ.WS_LEVELS) },
    { key: 'words', label: 'Word lists — one puzzle theme per line: "Theme: word, word, ..."', type: 'textarea', default: PZ.WORD_BANK },
  ];

  T.push({
    id: 'sudoku', name: 'Sudoku', group: 'Puzzles',
    options: [
      SUDOKU_LEVEL,
      { key: 'perPage', label: 'Puzzles per page', type: 'select', default: '2', choices: [
        ['1', '1 (large print)'], ['2', '2'], ['4', '4'], ['6', '6'] ] },
      SOLUTIONS,
      { key: 'solPerPage', label: 'Solutions per page', type: 'select', default: '6', choices: [['4', '4'], ['6', '6'], ['9', '9']] },
      SEED,
    ],
    puzzle: {
      perPage: (o) => parseInt(o.perPage, 10),
      solPerPage: (o) => parseInt(o.solPerPage, 10),
      kind: () => SUDOKU,
    },
  });

  T.push({
    id: 'wordsearch', name: 'Word search', group: 'Puzzles',
    options: [...WS_OPTS, SOLUTIONS, SEED],
    puzzle: {
      perPage: () => 1,
      solPerPage: () => 4,
      kind: () => WORDSEARCH,
    },
  });

  T.push({
    id: 'mixed', name: 'Mixed puzzles (Sudoku + Word search)', group: 'Puzzles',
    options: [
      { key: 'pattern', label: 'Page order', type: 'select', default: 'alternate', choices: [
        ['alternate', 'Alternate: word search, sudoku, ...'], ['halves', 'Word searches first, then sudoku'] ] },
      SUDOKU_LEVEL,
      ...WS_OPTS, SOLUTIONS, SEED,
    ],
    puzzle: {
      perPage: () => 1,
      solPerPage: () => 4,
      kind: (o, index, total) => (o.pattern === 'halves'
        ? (index < Math.ceil(total / 2) ? WORDSEARCH : SUDOKU)
        : (index % 2 ? SUDOKU : WORDSEARCH)),
    },
  });

  // Draws one puzzle page or one answer-key page. items: [{ num, data }]
  function drawPuzzlePage(p, box, items, ctx, solution) {
    const s = ctx.style;
    let rect = box;
    if (solution) {
      p.text(ctx.firstSolutionPage ? 'Solutions' : 'Solutions (continued)', box.x + box.w / 2, box.y + 0.25,
        { size: ctx.firstSolutionPage ? 18 : 12, bold: true, align: 'center', color: s.text });
      rect = { x: box.x, y: box.y + 0.45, w: box.w, h: box.h - 0.45 };
    }
    const slots = layoutFor(ctx.slots, rect);
    items.forEach((it, i) => KINDS[it.data.kind].draw(p, slots[i], it.data, it.num, ctx, solution));
  }

  // "This book belongs to" page (front matter).
  const OWNER = {
    id: 'owner', name: 'This book belongs to',
    draw(p, box, o, ctx) {
      const s = ctx.style;
      const cy = box.y + box.h * 0.38;
      p.rect(box.x + box.w * 0.08, cy - 0.9, box.w * 0.84, 2.2, { color: s.dark, w: 1, radius: 0.15 });
      p.text(o.bookTitle || 'This Book Belongs To', box.x + box.w / 2, cy - 0.35, { size: 18, bold: true, align: 'center', color: s.text });
      const lw = box.w * 0.6;
      ['Name', 'Phone', 'Email'].forEach((f, i) => {
        labeledLine(p, ctx, `${f}:`, box.x + (box.w - lw) / 2, cy + 0.2 + i * 0.35, lw);
      });
    },
  };

  global.Templates = { list: T, byId: (id) => T.find((t) => t.id === id), OWNER, parseColumns, drawPuzzlePage };
})(typeof window !== 'undefined' ? window : globalThis);
