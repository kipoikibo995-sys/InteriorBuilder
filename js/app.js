// Giao diện: đọc cấu hình từ form, vẽ xem trước, tải PDF.
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'interiorbuilder.v1';

  const state = {
    tab: 'interior',
    page: 1, // trang đang xem (spread chứa trang này)
    tplOpts: {}, // tuỳ chọn theo từng mẫu: { [tplId]: {key: value} }
    font: { name: 'helvetica', custom: false },
    coverImage: null, // { el, raw, cache: {aspect, img} }
  };

  // ---------- Khởi tạo form ----------

  KDP.TRIM_SIZES.forEach((t) => $('trim').add(new Option(t.label, t.id)));
  $('trim').value = '6x9';
  Object.entries(KDP.PAPER).forEach(([id, p]) => $('paper').add(new Option(p.label, id)));

  const groups = {};
  Templates.list.forEach((t) => {
    if (!groups[t.group]) {
      groups[t.group] = document.createElement('optgroup');
      groups[t.group].label = t.group;
      $('template').appendChild(groups[t.group]);
    }
    groups[t.group].appendChild(new Option(t.name, t.id));
  });
  $('template').value = 'lined';

  function defaultsFor(tpl) {
    const o = {};
    tpl.options.forEach((opt) => { if (opt.type !== 'preset') o[opt.key] = opt.default; });
    return o;
  }

  function optsFor(id) {
    const tpl = Templates.byId(id);
    state.tplOpts[id] = { ...defaultsFor(tpl), ...(state.tplOpts[id] || {}) };
    return state.tplOpts[id];
  }

  function buildTemplateOptions() {
    const id = $('template').value;
    const tpl = Templates.byId(id);
    const values = optsFor(id);
    const wrap = $('tplOptions');
    wrap.innerHTML = '';
    tpl.options.forEach((opt) => {
      const label = document.createElement('label');
      let input;
      if (opt.type === 'select' || opt.type === 'preset') {
        input = document.createElement('select');
        if (opt.type === 'preset') input.add(new Option('— Chọn để điền nhanh —', ''));
        opt.choices.forEach(([v, text]) => input.add(new Option(text, v)));
      } else {
        input = document.createElement('input');
        input.type = opt.type;
        if (opt.min !== undefined) input.min = opt.min;
        if (opt.max !== undefined) input.max = opt.max;
        if (opt.step !== undefined) input.step = opt.step;
      }
      if (opt.type === 'checkbox') {
        label.className = 'check';
        input.checked = !!values[opt.key];
        label.append(input, ' ' + opt.label);
      } else {
        if (opt.type !== 'preset') input.value = values[opt.key];
        label.append(opt.label, input);
      }
      input.addEventListener('input', () => {
        if (opt.type === 'preset') {
          if (!input.value) return;
          values[opt.target] = input.value;
          buildTemplateOptions();
        } else if (opt.type === 'checkbox') values[opt.key] = input.checked;
        else if (opt.type === 'number') values[opt.key] = parseFloat(input.value) || opt.default;
        else values[opt.key] = input.value;
        update();
      });
      wrap.appendChild(label);
    });
  }

  // ---------- Cấu hình ----------

  function num(id, fallback) {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : fallback;
  }

  function config() {
    const pages = Math.round(num('pages', 120));
    if ($('autoGutter').checked) $('mInside').value = (KDP.minGutter(pages) + 0.125).toFixed(3);
    const tplId = $('template').value;
    return {
      trim: KDP.trimById($('trim').value),
      pages,
      paper: $('paper').value,
      bleed: $('bleed').checked,
      margins: {
        inside: num('mInside', 0.5), outside: num('mOutside', 0.5),
        top: num('mTop', 0.5), bottom: num('mBottom', 0.6),
      },
      template: tplId,
      tplOpts: optsFor(tplId),
      ownerPage: $('ownerPage').checked,
      bookTitle: $('bookTitle').value,
      rectoOnly: $('rectoOnly').checked,
      pageNum: $('pageNum').value,
      style: {
        line: $('cLine').value, dark: $('cDark').value, text: $('cText').value,
        fill: $('cFill').value, lineW: num('lineW', 0.5),
      },
      font: state.font,
      docTitle: $('cvTitle').value || Templates.byId(tplId).name,
      cover: {
        title: $('cvTitle').value, subtitle: $('cvSubtitle').value, author: $('cvAuthor').value,
        spine: $('cvSpine').value, bg: $('cvBg').value, fg: $('cvFg').value,
        guides: $('cvGuides').checked, image: null,
      },
    };
  }

  // ---------- Xem trước ----------

  const canvas = $('canvas');

  function stageScale(wIn, hIn) {
    const stage = $('stage');
    const availW = Math.max(stage.clientWidth - 40, 200);
    const availH = Math.max(stage.clientHeight - 40, 300);
    return Math.min(availW / wIn, availH / hIn, 110);
  }

  function setupCanvas(wIn, hIn) {
    const scale = stageScale(wIn, hIn);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(wIn * scale * dpr);
    canvas.height = Math.round(hIn * scale * dpr);
    canvas.style.width = `${Math.round(wIn * scale)}px`;
    canvas.style.height = `${Math.round(hIn * scale)}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { ctx, scale: scale * dpr };
  }

  function canvasFont() {
    if (state.font.custom) return `"${state.font.name}", sans-serif`;
    return { helvetica: 'Helvetica, Arial, sans-serif', times: '"Times New Roman", Times, serif', courier: '"Courier New", Courier, monospace' }[state.font.name];
  }

  // Trang trái/phải của spread chứa trang n. Trang 1 đứng một mình bên phải.
  function spreadOf(n, total) {
    if (n <= 1) return [null, 1];
    const left = n % 2 === 0 ? n : n - 1;
    return [left, left + 1 <= total ? left + 1 : null];
  }

  function renderInteriorPreview(cfg) {
    const size = KDP.pageSize(cfg.trim, cfg.bleed);
    const gap = 0.06;
    const [l, r] = spreadOf(state.page, cfg.pages);
    const { ctx, scale } = setupCanvas(size.w * 2 + gap, size.h);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#ddd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    [[l, 0], [r, size.w + gap]].forEach(([n, xOff]) => {
      if (!n) return;
      ctx.save();
      ctx.translate(xOff * scale, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.w * scale, size.h * scale);
      Book.renderPage(new CanvasPainter(ctx, scale, canvasFont()), cfg, n, { guides: $('showGuides').checked });
      ctx.restore();
    });
    const label = [l, r].filter(Boolean).join('–');
    $('pageLabel').textContent = `Trang ${label} / ${cfg.pages}`;
  }

  function coverImageFor(aspect) {
    const ci = state.coverImage;
    if (!ci) return null;
    if (ci.cache && Math.abs(ci.cache.aspect - aspect) < 1e-4) return ci.cache.img;
    // Cắt ảnh theo tỉ lệ mặt trước (kiểu "cover"), giữ tối đa 300 dpi.
    const src = ci.el;
    let sw = src.naturalWidth, sh = src.naturalHeight;
    if (sw / sh > aspect) sw = sh * aspect; else sh = sw / aspect;
    const c = document.createElement('canvas');
    c.width = Math.round(sw);
    c.height = Math.round(sh);
    c.getContext('2d').drawImage(src, (src.naturalWidth - sw) / 2, (src.naturalHeight - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    const img = { el: c, dataUrl: c.toDataURL('image/jpeg', 0.92), format: 'JPEG', key: `cover-${aspect.toFixed(4)}` };
    ci.cache = { aspect, img };
    return img;
  }

  function withCoverImage(cfg) {
    const L = Book.coverLayout(cfg);
    cfg.cover.image = coverImageFor((L.w - L.frontX) / L.h);
    return cfg;
  }

  function renderCoverPreview(cfg) {
    const L = Book.coverLayout(cfg);
    const { ctx, scale } = setupCanvas(L.w, L.h);
    Book.renderCover(new CanvasPainter(ctx, scale, canvasFont()), cfg, { guides: cfg.cover.guides });
  }

  function renderCoverDims(cfg) {
    const L = Book.coverLayout(cfg);
    const f = (v) => `${v.toFixed(3)}" (${(v * 25.4).toFixed(1)} mm)`;
    const px = (v) => Math.round(v * 300);
    const frontW = L.w - L.frontX;
    $('coverDims').innerHTML = `
      <dt>Toàn bộ bìa</dt><dd>${f(L.w)} × ${f(L.h)}</dd>
      <dt>Độ dày gáy</dt><dd>${f(L.spine)}</dd>
      <dt>Ảnh 300 dpi</dt><dd>${px(L.w)} × ${px(L.h)} px</dd>
      <dt>Ảnh mặt trước</dt><dd>${px(frontW)} × ${px(L.h)} px</dd>
      <dt>Chữ trên gáy</dt><dd>${cfg.pages > KDP.SPINE_TEXT_MIN_PAGES ? 'Được phép' : 'Không (≤ 79 trang)'}</dd>`;
  }

  function renderMessages(cfg) {
    const list = KDP.validate(cfg);
    if (cfg.font.custom === false && /[^\x00-\xFF]/.test(JSON.stringify([cfg.tplOpts, cfg.bookTitle, cfg.cover]))) {
      list.push({ level: 'warn', msg: 'Có ký tự tiếng Việt/đặc biệt: hãy tải phông .ttf để in đúng dấu.' });
    }
    $('messages').innerHTML = '';
    list.forEach((m) => {
      const li = document.createElement('li');
      li.className = m.level;
      li.textContent = m.msg;
      $('messages').appendChild(li);
    });
    $('downloadInterior').disabled = list.some((m) => m.level === 'error');
    return list;
  }

  let raf = 0;
  function update() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const cfg = config();
      state.page = Math.min(Math.max(1, state.page), cfg.pages);
      $('bookTitleWrap').hidden = !$('ownerPage').checked;
      renderMessages(cfg);
      renderCoverDims(cfg);
      if (state.tab === 'cover') renderCoverPreview(withCoverImage(cfg));
      else renderInteriorPreview(cfg);
      save();
    });
  }

  // ---------- Lưu cấu hình trong trình duyệt ----------

  const FIELDS = ['trim', 'pages', 'paper', 'bleed', 'template', 'ownerPage', 'bookTitle', 'rectoOnly', 'pageNum',
    'mInside', 'mOutside', 'mTop', 'mBottom', 'autoGutter', 'cLine', 'cDark', 'cText', 'cFill', 'lineW',
    'cvTitle', 'cvSubtitle', 'cvAuthor', 'cvSpine', 'cvBg', 'cvFg', 'cvGuides', 'showGuides'];

  function save() {
    try {
      const data = { tplOpts: state.tplOpts };
      FIELDS.forEach((id) => { const el = $(id); data[id] = el.type === 'checkbox' ? el.checked : el.value; });
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch (e) { /* bộ nhớ trình duyệt không khả dụng */ }
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (!data) return;
      FIELDS.forEach((id) => {
        if (!(id in data)) return;
        const el = $(id);
        if (el.type === 'checkbox') el.checked = data[id]; else el.value = data[id];
      });
      if (!Templates.byId($('template').value)) $('template').value = 'lined';
      state.tplOpts = data.tplOpts || {};
    } catch (e) { /* bỏ qua */ }
  }

  // ---------- Sự kiện ----------

  document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => {
    state.tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.panel !== state.tab; });
    const cover = state.tab === 'cover';
    $('pageNav').style.visibility = cover ? 'hidden' : 'visible';
    $('downloadInterior').hidden = cover;
    $('downloadCover').hidden = !cover;
    $('showGuides').parentElement.hidden = cover;
    update();
  }));

  document.querySelectorAll('.panel input, .panel select, #showGuides').forEach((el) => {
    if (el.closest('#tplOptions') || el.type === 'file') return;
    el.addEventListener('input', update);
  });
  ['mInside'].forEach((id) => $(id).addEventListener('input', () => { $('autoGutter').checked = false; }));
  $('template').addEventListener('input', buildTemplateOptions);

  function step(d) {
    const total = config().pages;
    const [l, r] = spreadOf(state.page, total);
    state.page = d > 0 ? (r || l) + 1 : (l || r) - 1;
    state.page = Math.min(Math.max(1, state.page), total);
    update();
  }
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || state.tab !== 'interior') return;
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });
  window.addEventListener('resize', update);

  // Phông chữ tuỳ chỉnh
  $('font').addEventListener('change', () => {
    if ($('font').value === 'custom') {
      $('fontFile').click();
      return;
    }
    state.font = { name: $('font').value, custom: false };
    $('fontNote').hidden = true;
    update();
  });
  $('fontFile').addEventListener('change', async () => {
    const file = $('fontFile').files[0];
    if (!file) {
      $('font').value = state.font.custom ? 'custom' : state.font.name;
      return;
    }
    const buf = await file.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    const name = 'UserFont';
    try {
      const face = new FontFace(name, buf);
      await face.load();
      document.fonts.add(face);
    } catch (e) {
      $('fontNote').hidden = false;
      $('fontNote').textContent = 'Không đọc được phông này. Hãy thử file .ttf khác.';
      $('font').value = 'helvetica';
      state.font = { name: 'helvetica', custom: false };
      update();
      return;
    }
    state.font = { name, custom: true, base64: btoa(bin) };
    $('fontNote').hidden = false;
    $('fontNote').textContent = `Đang dùng phông: ${file.name} (chữ đậm hiển thị như chữ thường).`;
    update();
  });

  // Ảnh bìa
  $('cvImage').addEventListener('change', () => {
    const file = $('cvImage').files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      state.coverImage = { el: img };
      $('cvImageClear').hidden = false;
      update();
    };
    img.src = URL.createObjectURL(file);
  });
  $('cvImageClear').addEventListener('click', () => {
    state.coverImage = null;
    $('cvImage').value = '';
    $('cvImageClear').hidden = true;
    update();
  });

  // ---------- Xuất PDF ----------

  function slug(s) {
    return String(s || 'book').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
      .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'book';
  }

  $('downloadInterior').addEventListener('click', async () => {
    const cfg = config();
    if (renderMessages(cfg).some((m) => m.level === 'error')) return;
    const btn = $('downloadInterior');
    btn.disabled = true;
    $('progress').hidden = false;
    try {
      const doc = await Book.buildInteriorPdf(cfg, (f) => {
        $('progressBar').style.width = `${Math.round(f * 100)}%`;
        $('progressText').textContent = `Đang tạo ${Math.round(f * cfg.pages)} / ${cfg.pages} trang`;
      });
      $('progressText').textContent = 'Đang lưu file…';
      await new Promise((r) => setTimeout(r, 0));
      doc.save(`${slug(cfg.docTitle)}-interior-${cfg.trim.id}-${cfg.pages}p.pdf`);
      $('progressText').textContent = 'Xong!';
    } catch (e) {
      $('progressText').textContent = `Lỗi: ${e.message}`;
    } finally {
      btn.disabled = false;
      setTimeout(() => { $('progress').hidden = true; }, 2500);
    }
  });

  $('downloadCover').addEventListener('click', () => {
    const cfg = withCoverImage(config());
    const doc = Book.buildCoverPdf(cfg);
    doc.save(`${slug(cfg.docTitle)}-cover-${cfg.trim.id}-${cfg.pages}p.pdf`);
  });

  // ---------- Bắt đầu ----------
  load();
  buildTemplateOptions();
  update();
})();
