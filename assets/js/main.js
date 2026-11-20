(() => {
  const doc = document.documentElement;
  doc.classList.remove('no-js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Sketch intro (pages built with sketch: true): the visible layout is first drawn in pencil over the
     real page, with sticky notes where photos and video go, then the real page fades in. Runs once per
     tab session, never with reduced motion, and any click or key skips it. The head script adds
     .sketching before first paint; the CSS shows the page anyway after 5s if this never runs. */
  const SKETCH_MS = 1800;
  if (doc.classList.contains('sketching')) {
    const NS = 'http://www.w3.org/2000/svg';
    const jitter = (n) => (Math.random() - 0.5) * n;
    const wobble = (x1, y1, x2, y2, amp) => {
      const len = Math.hypot(x2 - x1, y2 - y1), steps = Math.max(2, Math.round(len / 22));
      let d = `M${(x1 + jitter(3)).toFixed(1)} ${(y1 + jitter(amp)).toFixed(1)}`;
      for (let i = 1; i <= steps; i++) { const t = i / steps; d += ` L${(x1 + (x2 - x1) * t + jitter(1.5)).toFixed(1)} ${(y1 + (y2 - y1) * t + jitter(amp)).toFixed(1)}`; }
      return d;
    };
    const box = (r, o = 4) => [
      wobble(r.left - o, r.top, r.right + o, r.top, 2), wobble(r.right, r.top - o, r.right, r.bottom + o, 2),
      wobble(r.right + o, r.bottom, r.left - o, r.bottom, 2), wobble(r.left, r.bottom + o, r.left, r.top - o, 2),
    ];
    const seen = (r) => r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    const lines = (el) => {
      const range = document.createRange(); range.selectNodeContents(el);
      const rows = new Map();
      for (const r of range.getClientRects()) {
        if (!seen(r)) continue;
        const k = Math.round(r.top / 4);
        const row = rows.get(k);
        rows.set(k, row ? { top: Math.min(row.top, r.top), bottom: Math.max(row.bottom, r.bottom), left: Math.min(row.left, r.left), right: Math.max(row.right, r.right) } : { top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      }
      return [...rows.values()];
    };
    const start = () => {
      const layer = document.createElement('div');
      layer.className = 'sketch'; layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = `<svg width="${innerWidth}" height="${innerHeight}"><defs><filter id="sketch-grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter></defs><g filter="url(#sketch-grain)"></g></svg>`;
      const g = layer.querySelector('g');
      const marks = [];
      const draw = (d, top, w = 1.4) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('stroke-width', w); g.append(p); marks.push({ el: p, top }); };
      const note = (full, label) => {
        /* place the note on the part of the photo that is on screen */
        const r = { left: Math.max(0, full.left), right: Math.min(innerWidth, full.right), top: Math.max(0, full.top), bottom: Math.min(innerHeight, full.bottom) };
        r.width = r.right - r.left; r.height = r.bottom - r.top;
        if (r.width < 80 || r.height < 24) return;
        const n = document.createElement('div');
        const size = Math.max(70, Math.min(150, full.width * 0.5, full.height * 0.7));
        /* when only a strip of the photo is on screen, the note peeks up from the bottom edge */
        const top = r.height < size + 20 ? r.top + 14 : r.top + r.height / 2 - size / 2 + jitter(r.height * 0.15);
        n.className = 'sketch__note'; n.textContent = label;
        n.style.cssText = `width:${size}px;height:${size}px;left:${r.left + r.width / 2 - size / 2 + jitter(r.width * 0.15)}px;top:${top}px;--r:${jitter(9).toFixed(1)}deg`;
        layer.append(n); marks.push({ el: n, top: r.top + 1 });
      };
      /* photos and video: a rough frame with a cross, and a sticky note */
      const media = [...document.querySelectorAll('main .cover, main .fig img, main .video, .door__img')].filter((m) => !m.closest('.cover') || m.classList.contains('cover'));
      for (const m of media) {
        const r = m.getBoundingClientRect();
        if (!seen(r)) continue;
        for (const d of box(r)) draw(d, r.top);
        draw(wobble(r.left + 6, r.top + 6, r.right - 6, r.bottom - 6, 1), r.top, 0.8);
        draw(wobble(r.right - 6, r.top + 6, r.left + 6, r.bottom - 6, 1), r.top, 0.8);
        note(r, m.classList.contains('cover') ? 'splash photo' : m.classList.contains('video') ? 'video' : 'photo');
      }
      /* the sidebar panel and the details list rules */
      for (const el of document.querySelectorAll('.sidebar, .facts')) {
        const r = el.getBoundingClientRect();
        if (!seen(r)) continue;
        if (el.classList.contains('facts')) { draw(wobble(r.left, r.top, r.right, r.top, 1.5), r.top, 1); draw(wobble(r.left, r.bottom, r.right, r.bottom, 1.5), r.bottom, 1); }
        else for (const d of box(r, 2)) draw(d, r.top, 1.1);
      }
      /* words become pencil strokes, heavier for headings */
      const heavy = 'h1, h2, .brand__name';
      for (const el of document.querySelectorAll('h1, h2, .lead, .eyebrow, .crumbs, .facts dt, .facts dd, .prose p, .prose li, .steps b, .brand__name, .brand__tag, .nav__link, .sidebar__note, .btn')) {
        if (el.closest('.sketch, template')) continue;
        const big = el.matches(heavy);
        for (const r of lines(el)) {
          const h = r.bottom - r.top;
          draw(wobble(r.left, r.top + h * 0.6, r.right, r.top + h * 0.6, big ? 2.4 : 1.2), r.top, big ? Math.min(5, Math.max(2.2, h * 0.14)) : 1.3);
        }
      }
      document.body.append(layer);
      /* stagger from top to bottom */
      marks.sort((a, b) => a.top - b.top);
      const spread = SKETCH_MS * 0.8;
      marks.forEach((m, i) => {
        const delay = Math.round((i / Math.max(1, marks.length - 1)) * spread);
        if (m.el.tagName === 'path') {
          const len = m.el.getTotalLength();
          m.el.style.strokeDasharray = len; m.el.style.strokeDashoffset = len;
          m.el.style.transition = `stroke-dashoffset ${Math.min(500, 120 + len * 0.6)}ms ease-out ${delay}ms`;
        } else m.el.style.transitionDelay = `${delay}ms`;
      });
      layer.getBoundingClientRect(); /* commit the hidden state so the transitions run */
      for (const m of marks) m.el.tagName === 'path' ? (m.el.style.strokeDashoffset = 0) : m.el.classList.add('is-on');
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        try { sessionStorage.setItem('sketched:' + location.pathname, '1'); } catch {}
        doc.classList.remove('sketching');
        layer.classList.add('is-leaving');
        setTimeout(() => layer.remove(), 700);
        removeEventListener('pointerdown', finish); removeEventListener('keydown', finish);
      };
      addEventListener('pointerdown', finish); addEventListener('keydown', finish);
      setTimeout(finish, SKETCH_MS + 700);
    };
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 900))]).then(start);
  }

  /* Mobile drawer */
  const menuBtn = document.querySelector('.menu-btn');
  const scrim = document.querySelector('.scrim');
  const setNav = (open) => {
    doc.classList.toggle('nav-open', open);
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setNav(!doc.classList.contains('nav-open')));
  scrim?.addEventListener('click', () => setNav(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setNav(false); });

  /* Home: once the wide reel scrolls up, the top menu fades out and the sidebar fades in */
  const heroWrap = doc.classList.contains('is-home') && document.querySelector('.home-hero');
  if (heroWrap) {
    /* The line, name and menu animate on load and each time the top menu comes back */
    const playIntro = () => { doc.classList.remove('intro-play'); void doc.offsetWidth; doc.classList.add('intro-play'); };
    let past = null;
    const sync = () => {
      const now = heroWrap.getBoundingClientRect().bottom < innerHeight * 0.5;
      if (now === past) return;
      past = now;
      doc.classList.toggle('side-in', now);
      if (!now) playIntro();
    };
    addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    sync();
  }

  /* Pencil marks: drag with a mouse on any empty spot to draw. The layer ignores all pointer
     input, so links, forms, video, text selection, keyboard and touch scrolling work as usual.
     Marks are kept in page coordinates so they scroll with the page; they clear on leaving it. */
  const PENCIL_WIDTH = 3;
  const PENCIL_COLOURS = ['#ab4adf', '#3bfbfa', '#fcd41a', '#db53ae', '#2776e0', '#f98a27', '#a4ec91', '#5f9e10', '#4cefaa', '#c9786a'];
  const NO_DRAW = 'a, button, input, textarea, select, option, label, summary, video, audio, iframe, text, [role="button"], [contenteditable], [tabindex]:not([tabindex="-1"]), .zoomable, .lightbox, .scrim, .menu-btn';
  const layer = document.createElement('canvas');
  layer.className = 'pencil-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const pen = layer.getContext('2d');
  const marks = [];
  let mark = null, colourAt = 0, queued = false;
  const paint = () => {
    queued = false;
    const dpr = devicePixelRatio || 1, w = innerWidth, h = innerHeight;
    if (layer.width !== Math.round(w * dpr) || layer.height !== Math.round(h * dpr)) { layer.width = Math.round(w * dpr); layer.height = Math.round(h * dpr); }
    pen.setTransform(dpr, 0, 0, dpr, -scrollX * dpr, -scrollY * dpr);
    pen.clearRect(scrollX, scrollY, w, h);
    pen.lineWidth = PENCIL_WIDTH; pen.lineCap = 'round'; pen.lineJoin = 'round';
    for (const m of marks) {
      if (m.maxY < scrollY - PENCIL_WIDTH || m.minY > scrollY + h + PENCIL_WIDTH) continue;
      const p = m.points;
      pen.strokeStyle = m.colour;
      pen.beginPath();
      pen.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length - 2; i += 2) pen.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      pen.lineTo(p[p.length - 2], p[p.length - 1]);
      pen.stroke();
    }
  };
  const repaint = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
  /* Pressing on words keeps normal text selection */
  const onText = (e) => {
    const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY);
    const node = pos ? pos.offsetNode : document.caretRangeFromPoint?.(e.clientX, e.clientY)?.startContainer;
    if (!node || node.nodeType !== 3 || !node.nodeValue.trim()) return false;
    const range = document.createRange();
    range.selectNodeContents(node);
    return [...range.getClientRects()].some((r) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
  };
  const onScrollbar = (e) => e.target.clientWidth > 0 && (e.offsetX > e.target.clientWidth || e.offsetY > e.target.clientHeight);
  const stopMark = () => { mark = null; doc.classList.remove('is-drawing'); };
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    if (!(e.target instanceof Element) || e.target.closest(NO_DRAW) || onScrollbar(e) || onText(e)) return;
    mark = { colour: PENCIL_COLOURS[colourAt], points: [e.pageX, e.pageY], minY: e.pageY, maxY: e.pageY, shown: false };
    doc.classList.add('is-drawing');
  });
  addEventListener('pointermove', (e) => {
    if (!mark) return;
    if (!e.buttons) { stopMark(); return; }
    const p = mark.points, dx = e.pageX - p[p.length - 2], dy = e.pageY - p[p.length - 1];
    if (dx * dx + dy * dy < 4) return;
    /* A plain click leaves nothing behind: the mark only appears once the mouse moves */
    if (!mark.shown) {
      mark.shown = true;
      marks.push(mark);
      colourAt = (colourAt + 1) % PENCIL_COLOURS.length;
    }
    p.push(e.pageX, e.pageY);
    mark.minY = Math.min(mark.minY, e.pageY);
    mark.maxY = Math.max(mark.maxY, e.pageY);
    repaint();
  });
  addEventListener('pointerup', stopMark);
  addEventListener('pointercancel', stopMark);
  addEventListener('blur', stopMark);
  /* Right-click on an empty spot erases every mark. The browser's menu stays for links, controls,
     the home carousel, words and selected text, and everywhere once there is nothing left to erase. */
  addEventListener('contextmenu', (e) => {
    if (!marks.length || e.button !== 2 || !(e.target instanceof Element)) return;
    if (e.target.closest(NO_DRAW) || e.target.closest('.reel') || onText(e) || getSelection().toString()) return;
    e.preventDefault();
    stopMark();
    marks.length = 0;
    repaint();
  });
  addEventListener('dragstart', (e) => { if (mark) e.preventDefault(); });
  addEventListener('scroll', repaint, { passive: true });
  addEventListener('resize', repaint);

  /* Rotating tiles: every ROTATE_MS one tile switches straight to a waiting photo. Kinds are tile--*
     classes. If the grid sets data-kind with data-min and data-max, the count of that kind on screen
     stays in range, and a tile switches kind whenever the range allows it, so the mix keeps moving; otherwise tiles swap like for like. The photo that leaves goes to the back of its
     kind's queue. Waiting photos are decoded first so the switch never flashes. Off for reduced motion. */
  const ROTATE_MS = 3000;
  const ROTATE_ORDER = [0, 5, 2, 7, 4, 1, 6, 3];
  const ROTATE_ATTRS = ['src', 'srcset', 'sizes', 'alt', 'data-full', 'style', 'class'];
  const kindOf = (el) => [...el.classList].find((c) => c.startsWith('tile--')) || '';
  document.querySelectorAll('.figs--rotate').forEach((grid) => {
    const tiles = [...grid.querySelectorAll('.fig img')];
    const waiting = {};
    for (const t of grid.querySelectorAll('.rotate-pool')) for (const el of t.content.querySelectorAll('img')) (waiting[kindOf(el)] ||= []).push(el);
    const order = ROTATE_ORDER.filter((n) => n < tiles.length);
    if (reduce || !order.length || !Object.keys(waiting).length) return;
    const { kind, min, max } = grid.dataset;
    const inRange = (n) => !kind || (n >= +min && n <= +max);
    const warm = (el) => { const p = new Image(); for (const at of ['sizes', 'srcset', 'src']) if (el.hasAttribute(at)) p.setAttribute(at, el.getAttribute(at)); return p.decode().catch(() => {}); };
    Object.values(waiting).flat().forEach(warm);
    let turn = 0;
    setInterval(() => {
      if (document.hidden) return;
      for (let tries = 0; tries < order.length; tries++) {
        const el = tiles[order[turn++ % order.length]];
        const from = kindOf(el);
        const count = kind ? tiles.filter((t) => kindOf(t) === kind).length : 0;
        const options = Object.keys(waiting).filter((k) => waiting[k].length && (!kind ? k === from : inRange(count - (from === kind) + (k === kind))));
        if (!options.length) continue;
        const change = options.filter((k) => k !== from);
        const to = change.length ? change[Math.floor(Math.random() * change.length)] : from;
        const next = waiting[to].shift();
        (waiting[from] ||= []).push(el.cloneNode());
        for (const at of ROTATE_ATTRS) next.hasAttribute(at) ? el.setAttribute(at, next.getAttribute(at)) : el.removeAttribute(at);
        el.loading = 'eager';
        break;
      }
    }, ROTATE_MS);
  });

  /* Scroll reveal: stagger siblings marked .reveal */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    if (sibs.length > 1 && !el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 6) * 90}ms`);
    io.observe(el);
  });

  /* Bead dividers pop in one by one */
  document.querySelectorAll('.beads').forEach((row) => {
    [...row.children].forEach((b, i) => { b.style.transitionDelay = `${i * 70}ms`; });
    io.observe(row);
  });

  /* Hero reel */
  const reel = document.querySelector('.reel');
  if (reel) {
    const slides = [...reel.querySelectorAll('.reel__slide')];
    const dots = [...reel.querySelectorAll('.reel__dot')];
    const cap = reel.querySelector('.reel__caption');
    const pauseBtn = reel.querySelector('.reel__pause');
    const ms = Number(reel.dataset.ms || 6000);
    reel.style.setProperty('--reel-ms', `${ms}ms`);
    let i = 0, timer = null, paused = reduce;
    const show = (n) => {
      /* The outgoing slide keeps its slow zoom until it has fully faded, so it never snaps back to size */
      const out = slides[i];
      out.classList.remove('is-active'); dots[i]?.classList.remove('is-active');
      out.classList.add('is-leaving');
      setTimeout(() => { if (!out.classList.contains('is-active')) out.classList.remove('is-leaving'); }, 1700);
      i = (n + slides.length) % slides.length;
      const s = slides[i];
      s.classList.remove('is-leaving');
      s.classList.add('is-active');
      const d = dots[i]; if (d) { d.classList.remove('is-active'); void d.offsetWidth; d.classList.add('is-active'); }
      if (cap) { cap.href = s.dataset.href; cap.querySelector('[data-cap]').innerHTML = s.dataset.cap; }
      s.querySelectorAll('img[loading="lazy"]').forEach((im) => im.removeAttribute('loading'));
      const nxt = slides[(i + 1) % slides.length]; nxt.querySelector('img')?.removeAttribute('loading');
    };
    const tick = () => { clearTimeout(timer); if (!paused) timer = setTimeout(() => { show(i + 1); tick(); }, ms); };
    dots.forEach((d, n) => d.addEventListener('click', () => { show(n); tick(); }));
    pauseBtn?.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow');
      pauseBtn.innerHTML = paused ? '&#9654;' : '&#10073;&#10073;';
      reel.classList.toggle('is-paused', paused);
      tick();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else tick(); });
    show(0); tick();
  }

  /* Dot in: a dotted line keeps its dots and is revealed dot by dot, through a mask that draws along it.
     Returns a function that starts the reveal. */
  let dotMasks = 0;
  const dotIn = (path, duration, delay = 0) => {
    const svg = path.ownerSVGElement, NS = 'http://www.w3.org/2000/svg';
    const defs = svg.querySelector('defs') || svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
    const mask = document.createElementNS(NS, 'mask');
    mask.id = `dot-in-${++dotMasks}`;
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    for (const [k, v] of [['x', -5000], ['y', -5000], ['width', 10000], ['height', 10000]]) mask.setAttribute(k, v);
    const reveal = document.createElementNS(NS, 'path');
    reveal.setAttribute('d', path.getAttribute('d'));
    if (path.getAttribute('transform')) reveal.setAttribute('transform', path.getAttribute('transform'));
    const len = path.getTotalLength();
    Object.assign(reveal.style, { fill: 'none', stroke: '#fff', strokeWidth: '24', strokeLinecap: 'round', strokeDasharray: `${len}`, strokeDashoffset: `${len}` });
    mask.append(reveal); defs.append(mask);
    path.setAttribute('mask', `url(#${mask.id})`);
    return () => reveal.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration, delay, easing: 'cubic-bezier(.4,.1,.2,1)', fill: 'forwards' })
      .finished.then(() => { path.removeAttribute('mask'); mask.remove(); });
  };

  /* Map path on the home doors: dots in, then beads appear along it */
  const map = document.querySelector('.map-path');
  if (map) {
    const path = map.querySelector('path');
    const beads = [...map.querySelectorAll('.bead')];
    const len = path.getTotalLength();
    /* the path starts off to the left, behind the side menu; beads go on the stretch beside the doors (x >= 150) */
    let lo = 0, hi = len;
    while (hi - lo > 1) { const mid = (lo + hi) / 2; if (path.getPointAtLength(mid).x < 150) lo = mid; else hi = mid; }
    beads.forEach((b, n) => {
      const p = path.getPointAtLength(hi + (len - hi) * (n + 1) / (beads.length + 1));
      b.setAttribute('cx', p.x); b.setAttribute('cy', p.y);
    });
    if (!reduce) {
      const start = dotIn(path, 3400);
      const mo = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        start();
        beads.forEach((b, n) => b.animate(
          [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 700, delay: 1400 + n * 520, fill: 'forwards', easing: 'ease-out' }));
        mo.disconnect();
      }, { threshold: 0.3 });
      mo.observe(map.parentElement);
    } else beads.forEach((b) => { b.style.opacity = 1; });
  }

  /* Pool map on the home page, in the same style as the doors path: the dotted outline and the cut
     lines dot in, then the red centre dot pops in. */
  const pools = document.querySelector('.pools__map');
  if (pools && !reduce) {
    const cuts = [...pools.querySelectorAll('.pools__cuts path')];
    const ember = pools.querySelector('.pools__ember');
    const starts = cuts.map((p, n) => dotIn(p, n === 0 ? 2600 : 600, n === 0 ? 0 : 900 + n * 160));
    if (ember) ember.style.opacity = 0;
    const po = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      starts.forEach((go) => go());
      if (ember) ember.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.6)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 700, delay: 900 + cuts.length * 160 + 300, fill: 'forwards', easing: 'ease-out' });
      po.disconnect();
    }, { threshold: 0.3 });
    po.observe(pools);
  }

  /* Filters */
  document.querySelectorAll('[data-filters]').forEach((bar) => {
    const target = document.querySelector(bar.dataset.filters);
    const label = document.querySelector('[data-showing]');
    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      bar.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      const f = chip.dataset.f;
      target.querySelectorAll('[data-kind]').forEach((card) => {
        const show = f === 'all' || card.dataset.kind.split(' ').includes(f);
        if (show && card.hidden) {
          card.hidden = false;
          if (!reduce) card.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'ease-out' });
        } else if (!show) card.hidden = true;
      });
      if (label) label.textContent = `Showing: ${f === 'all' ? 'All stories' : chip.textContent}`;
    });
  });

  /* Flipbook (The Deceiviest) */
  document.querySelectorAll('.flipbook').forEach((fb) => {
    const pages = [...fb.querySelectorAll('.flip__page')];
    const roles = [...fb.querySelectorAll('.flip__roles li')];
    const count = fb.querySelector('.flip__count');
    let n = 0, t = null;
    const go = (k) => {
      const prev = pages[n];
      n = (k + pages.length) % pages.length;
      pages.forEach((p) => p.classList.remove('is-active', 'is-gone'));
      if (prev !== pages[n]) prev.classList.add('is-gone');
      pages[n].classList.add('is-active');
      const role = Number(pages[n].dataset.role);
      roles.forEach((r, ri) => r.classList.toggle('is-on', ri === role));
      if (count) count.textContent = `${n + 1} / ${pages.length}`;
    };
    const auto = () => { clearInterval(t); if (!reduce) t = setInterval(() => go(n + 1), 3200); };
    fb.querySelector('[data-prev]')?.addEventListener('click', () => { go(n - 1); auto(); });
    fb.querySelector('[data-next]')?.addEventListener('click', () => { go(n + 1); auto(); });
    const vo = new IntersectionObserver(([e]) => { if (e.isIntersecting) auto(); else clearInterval(t); });
    vo.observe(fb);
    go(0);
  });

  /* Lightbox */
  const zoomables = [...document.querySelectorAll('.zoomable')];
  if (zoomables.length) {
    const lb = document.createElement('div');
    lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML = '<figure style="margin:0;display:grid;justify-items:center"><img alt=""><figcaption class="lightbox__cap"></figcaption></figure>' +
      '<button class="lightbox__close" aria-label="Close">&#10005;</button><button class="lightbox__prev" aria-label="Previous image">&#8592;</button><button class="lightbox__next" aria-label="Next image">&#8594;</button>';
    document.body.append(lb);
    const img = lb.querySelector('img'), cap = lb.querySelector('.lightbox__cap');
    let cur = 0, last = null;
    const group = (el) => zoomables.filter((z) => z.closest('[data-gallery]') === el.closest('[data-gallery]') && z.getClientRects().length);
    const open = (el) => {
      cur = zoomables.indexOf(el);
      const src = el.dataset.full || el.currentSrc || el.src;
      img.src = src; img.alt = el.alt || '';
      cap.textContent = el.dataset.caption || el.closest('figure')?.querySelector('figcaption')?.textContent || el.alt || '';
      lb.classList.add('is-open'); last = document.activeElement; lb.querySelector('.lightbox__close').focus();
    };
    const step = (d) => { const g = group(zoomables[cur]); const k = g.indexOf(zoomables[cur]); open(g[(k + d + g.length) % g.length]); };
    const close = () => { lb.classList.remove('is-open'); last?.focus(); };
    zoomables.forEach((z) => {
      z.tabIndex = 0; z.setAttribute('role', 'button');
      z.addEventListener('click', () => open(z));
      z.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(z); } });
    });
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.querySelector('.lightbox__close').addEventListener('click', close);
    lb.querySelector('.lightbox__prev').addEventListener('click', () => step(-1));
    lb.querySelector('.lightbox__next').addEventListener('click', () => step(1));
    addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  }

  /* Contact form: posts to the form service set in build.js. The site's code never holds an email address. */
  const form = document.querySelector('#contact-form');
  if (form) {
    const status = form.querySelector('.form-status');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (data.get('website')) return; // honeypot
      const endpoint = form.dataset.endpoint;
      if (!endpoint) { status.textContent = 'This form isn’t connected yet, so your message wasn’t sent.'; return; }
      status.textContent = 'Sending…';
      try {
        const r = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error();
        form.reset(); status.textContent = 'Thank you. Your note is on its way, and Julie will reply soon.';
      } catch { status.textContent = 'That didn’t send. Please try again in a little while.'; }
    });
  }
})();
