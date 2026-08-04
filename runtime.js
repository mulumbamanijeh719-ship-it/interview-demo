/* presentation :: runtime.js — keyboard-driven deck runtime */
(function () {
  'use strict';

  const ANIMS = ['fade-up','fade-down','fade-left','fade-right','rise-in','drop-in',
    'zoom-pop','blur-in','glitch-in','typewriter','neon-glow','shimmer-sweep',
    'gradient-flow','stagger-list','counter-up','path-draw','parallax-tilt',
    'card-flip-3d','cube-rotate-3d','page-turn-3d','perspective-zoom',
    'marquee-scroll','kenburns','confetti-burst','spotlight','morph-shape','ripple-reveal'];

  function ready(fn){ if(document.readyState!='loading')fn(); else document.addEventListener('DOMContentLoaded',fn);}

  function getPreviewIdx() {
    const m = /[?&]preview=(\d+)/.exec(location.search || '');
    return m ? parseInt(m[1], 10) - 1 : -1;
  }

  ready(function () {
    const deck = document.querySelector('.deck');
    if (!deck) return;
    const slides = Array.from(deck.querySelectorAll('.slide'));
    if (!slides.length) return;

    const previewOnlyIdx = getPreviewIdx();
    const isPreviewMode = previewOnlyIdx >= 0 && previewOnlyIdx < slides.length;

    if (isPreviewMode) {
      function showSlide(i) {
        slides.forEach((s, j) => {
          const active = (j === i);
          s.classList.toggle('is-active', active);
          s.style.display = active ? '' : 'none';
          if (active) { s.style.opacity = '1'; s.style.transform = 'none'; s.style.pointerEvents = 'auto'; }
        });
      }
      showSlide(previewOnlyIdx);
      const hideSel = '.progress-bar, .notes-overlay, .overview, .notes, aside.notes, .speaker-notes';
      document.querySelectorAll(hideSel).forEach(el => { el.style.display = 'none'; });
      document.documentElement.setAttribute('data-preview', '1');
      document.body.setAttribute('data-preview', '1');
      function getPreviewThemeBase() {
        const base = document.documentElement.getAttribute('data-theme-base');
        if (base) return base;
        const tl = document.getElementById('theme-link');
        if (tl) { const raw = tl.getAttribute('href') || ''; const ls = raw.lastIndexOf('/'); if (ls >= 0) return raw.substring(0, ls + 1); }
        return 'assets/themes/';
      }
      const previewThemeBase = getPreviewThemeBase();
      window.addEventListener('message', function(e) {
        if (!e.data) return;
        if (e.data.type === 'preview-goto') { const n = parseInt(e.data.idx, 10); if (n >= 0 && n < slides.length) showSlide(n); }
        else if (e.data.type === 'preview-theme' && e.data.name) {
          let link = document.getElementById('theme-link');
          if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'theme-link'; document.head.appendChild(link); }
          link.href = previewThemeBase + e.data.name + '.css';
          document.documentElement.setAttribute('data-theme', e.data.name);
        }
      });
      try { window.parent && window.parent.postMessage({ type: 'preview-ready' }, '*'); } catch(e) {}
      return;
    }

    let idx = 0;
    const total = slides.length;
    let editMode = false;
    let scrollMode = false;
    let slideWrappers = [];
    let scrollModeResizeHandler = null;
    let scrollModeScrollHandler = null;
    let wasScrollModeBeforeFullscreen = false;
    const EDITABLE_SELECTOR = 'h1,h2,h3,h4,p,li,.lede,.kicker,.eyebrow,td,th,blockquote';
    const CHANNEL_NAME = 'html-ppt-presenter-' + location.pathname;
    let bc;
    try { bc = new BroadcastChannel(CHANNEL_NAME); } catch(e) { bc = null; }
    const isPresenterWindow = false;

    let bar = document.querySelector('.progress-bar');
    if (!bar) { bar = document.createElement('div'); bar.className = 'progress-bar'; bar.innerHTML = '<span></span>'; document.body.appendChild(bar); }
    const barFill = bar.querySelector('span');

    let notes = document.querySelector('.notes-overlay');
    if (!notes) { notes = document.createElement('div'); notes.className = 'notes-overlay'; document.body.appendChild(notes); }

    let overview = document.querySelector('.overview');
    if (!overview) {
      overview = document.createElement('div');
      overview.className = 'overview';
      slides.forEach((s, i) => {
        const t = document.createElement('div');
        t.className = 'thumb';
        t.style.padding = '0 0 56.25% 0';
        t.style.height = '0';
        t.style.position = 'relative';
        t.style.overflow = 'hidden';
        const title = s.getAttribute('data-title') || (s.querySelector('h1,h2,h3')||{}).textContent || ('Slide '+(i+1));
        const mini = document.createElement('div');
        mini.className = 'mini-slide';
        mini.style.position = 'absolute';
        mini.style.top = '0';
        mini.style.left = '0';
        mini.style.width = '1920px';
        mini.style.height = '1080px';
        mini.style.transformOrigin = 'top left';
        mini.style.pointerEvents = 'none';
        mini.style.background = 'var(--bg)';
        const clone = s.cloneNode(true);
        clone.className = 'slide is-active';
        clone.style.position = 'absolute';
        clone.style.inset = '0';
        clone.style.transform = 'none';
        clone.style.opacity = '1';
        clone.style.padding = '72px 96px';
        mini.appendChild(clone);
        t.appendChild(mini);
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.inset = '0';
        overlay.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 40%, transparent 60%, rgba(0,0,0,0.8) 100%)';
        overlay.style.color = '#fff';
        overlay.style.zIndex = '10';
        overlay.style.pointerEvents = 'none';
        const n = document.createElement('div');
        n.className = 'n';
        n.textContent = i + 1;
        n.style.position = 'absolute';
        n.style.top = '12px';
        n.style.left = '16px';
        n.style.fontWeight = '700';
        n.style.fontSize = '16px';
        n.style.color = '#fff';
        n.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
        const text = document.createElement('div');
        text.className = 't';
        text.textContent = title.trim().slice(0,80);
        text.style.position = 'absolute';
        text.style.bottom = '12px';
        text.style.left = '16px';
        text.style.right = '16px';
        text.style.fontWeight = '600';
        text.style.fontSize = '14px';
        text.style.color = '#fff';
        text.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
        overlay.appendChild(n);
        overlay.appendChild(text);
        t.appendChild(overlay);
        t.addEventListener('click', () => { go(i); toggleOverview(false); });
        overview.appendChild(t);
      });
      document.body.appendChild(overview);
    }

    function go(n, fromRemote){
      n = Math.max(0, Math.min(total-1, n));
      if (!scrollMode) {
        slides.forEach((s,i) => { s.classList.toggle('is-active', i===n); s.classList.toggle('is-prev', i<n); });
      } else { scrollToSlide(n); updateScrollHighlight(n); }
      idx = n;
      barFill.style.width = ((n+1)/total*100)+'%';
      const numEl = document.querySelector('.slide-number');
      if (numEl) { numEl.setAttribute('data-current', n+1); numEl.setAttribute('data-total', total); }
      const note = slides[n].querySelector('.notes, aside.notes, .speaker-notes');
      notes.innerHTML = note ? note.innerHTML : '';
      const hashTarget = '#/'+(n+1);
      if (location.hash !== hashTarget && !isPresenterWindow) { history.replaceState(null,'', hashTarget); }
      if (!scrollMode) {
        slides[n].querySelectorAll('[data-anim]').forEach(el => {
          const a = el.getAttribute('data-anim');
          el.classList.remove('anim-'+a);
          void el.offsetWidth;
          el.classList.add('anim-'+a);
        });
      }
      slides[n].querySelectorAll('.counter').forEach(el => {
        const target = parseFloat(el.getAttribute('data-to')||el.textContent);
        const dur = parseInt(el.getAttribute('data-dur')||'1200',10);
        const start = performance.now();
        const from = 0;
        function tick(now){ const t = Math.min(1,(now-start)/dur); const v = from + (target-from)*(1-Math.pow(1-t,3)); el.textContent = (target % 1 === 0) ? Math.round(v) : v.toFixed(1); if (t<1) requestAnimationFrame(tick); }
        requestAnimationFrame(tick);
      });
      if (!fromRemote && bc) { bc.postMessage({ type: 'go', idx: n }); }
    }

    if (bc) {
      bc.onmessage = function(e) {
        if (!e.data) return;
        if (e.data.type === 'go' && typeof e.data.idx === 'number') { go(e.data.idx, true); }
        else if (e.data.type === 'theme' && e.data.name) { const i = themes.indexOf(e.data.name); if (i >= 0) themeIdx = i; applyTheme(e.data.name); }
      };
    }

    function toggleNotes(force){ notes.classList.toggle('open', force!==undefined?force:!notes.classList.contains('open')); }
    function toggleOverview(force){
      const isOpen = force!==undefined ? force : !overview.classList.contains('open');
      overview.classList.toggle('open', isOpen);
      if (isOpen) { requestAnimationFrame(() => { const thumbs = overview.querySelectorAll('.thumb'); if (thumbs.length) { const scale = thumbs[0].clientWidth / 1920; overview.querySelectorAll('.mini-slide').forEach(m => { m.style.transform = 'scale(' + scale + ')'; }); } }); }
    }

    function toggleEditMode(force) {
      editMode = (force !== undefined) ? force : !editMode;
      document.body.classList.toggle('deck-editing', editMode);
      document.querySelectorAll('.slide').forEach(function(slide) {
        slide.querySelectorAll(EDITABLE_SELECTOR).forEach(function(el) {
          if (editMode) el.setAttribute('contenteditable', 'true');
          else el.removeAttribute('contenteditable');
        });
      });
      let overlay = document.querySelector('.edit-overlay');
      if (!overlay) { overlay = document.createElement('div'); overlay.className = 'edit-overlay'; overlay.textContent = 'Edit Mode - Press Esc to exit'; document.body.appendChild(overlay); }
    }

    function applyScrollModeScale() {
      if (!scrollMode) return;
      const vw = window.innerWidth;
      const ratio = vw / 1920;
      const slideHeight = Math.round(1080 * ratio);
      slideWrappers.forEach(function(wrapper) { wrapper.style.width = '100%'; wrapper.style.height = slideHeight + 'px'; });
      slides.forEach(function(s) { s.style.position = 'absolute'; s.style.top = '0'; s.style.left = '0'; s.style.width = '1920px'; s.style.height = '1080px'; s.style.transform = 'scale(' + ratio + ')'; s.style.transformOrigin = 'top left'; s.style.opacity = '1'; s.style.pointerEvents = 'auto'; s.style.transition = 'none'; });
    }
    function scrollToSlide(n) { if (n < 0 || n >= slideWrappers.length) return; slideWrappers[n].scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    function updateScrollHighlight(n) { slideWrappers.forEach(function(w, i) { w.classList.toggle('scroll-active', i === n); }); }
    function enterScrollMode() {
      if (scrollMode) return;
      scrollMode = true;
      document.documentElement.classList.add('scroll-mode');
      document.body.classList.add('scroll-mode');
      slides.forEach(function(slide) {
        slide.classList.remove('is-active', 'is-prev');
        slide.querySelectorAll('[data-anim]').forEach(function(el) { el.classList.remove('anim-' + el.getAttribute('data-anim')); });
        if (slide.hasAttribute('data-anim')) { slide.classList.remove('anim-' + slide.getAttribute('data-anim')); }
        const wrapper = document.createElement('div');
        wrapper.className = 'slide-scroll-wrapper';
        deck.insertBefore(wrapper, slide);
        wrapper.appendChild(slide);
        slideWrappers.push(wrapper);
      });
      applyScrollModeScale();
      updateScrollHighlight(idx);
      scrollModeResizeHandler = function() { applyScrollModeScale(); };
      window.addEventListener('resize', scrollModeResizeHandler);
      scrollModeScrollHandler = function() {
        const centerY = window.scrollY + window.innerHeight * 0.4;
        let closest = 0, minDist = Infinity;
        slideWrappers.forEach(function(w, i) { const top = w.getBoundingClientRect().top + window.scrollY; const mid = top + w.offsetHeight / 2; const dist = Math.abs(centerY - mid); if (dist < minDist) { minDist = dist; closest = i; } });
        if (closest !== idx) { idx = closest; barFill.style.width = ((idx + 1) / total * 100) + '%'; const numEl = document.querySelector('.slide-number'); if (numEl) { numEl.setAttribute('data-current', idx + 1); numEl.setAttribute('data-total', total); } const note = slides[idx].querySelector('.notes, aside.notes, .speaker-notes'); notes.innerHTML = note ? note.innerHTML : ''; history.replaceState(null, '', '#/' + (idx + 1)); updateScrollHighlight(idx); }
      };
      window.addEventListener('scroll', scrollModeScrollHandler);
      requestAnimationFrame(function() { scrollToSlide(idx); });
    }
    function exitScrollMode() {
      if (!scrollMode) return;
      scrollMode = false;
      document.documentElement.classList.remove('scroll-mode');
      document.body.classList.remove('scroll-mode');
      if (scrollModeResizeHandler) { window.removeEventListener('resize', scrollModeResizeHandler); scrollModeResizeHandler = null; }
      if (scrollModeScrollHandler) { window.removeEventListener('scroll', scrollModeScrollHandler); scrollModeScrollHandler = null; }
      slides.forEach(function(slide, i) { const wrapper = slideWrappers[i]; if (wrapper && wrapper.parentNode) { wrapper.parentNode.insertBefore(slide, wrapper); wrapper.parentNode.removeChild(wrapper); } slide.style.cssText = ''; });
      slideWrappers = [];
      go(idx);
    }

    /* Presenter mode - simplified for this deck */
    let presenterWin = null;
    function openPresenterWindow() {
      if (presenterWin && !presenterWin.closed) { presenterWin.focus(); return; }
      const slideMeta = slides.map((s, i) => {
        const note = s.querySelector('.notes, aside.notes, .speaker-notes');
        return { title: s.getAttribute('data-title') || (s.querySelector('h1,h2,h3')||{}).textContent || ('Slide '+(i+1)), notes: note ? note.innerHTML : '' };
      });
      const currentTheme = root.getAttribute('data-theme') || (themes[themeIdx] || '');
      const deckUrl = location.protocol + '//' + location.host + location.pathname;
      const metaJSON = JSON.stringify(slideMeta);
      const deckUrlJSON = JSON.stringify(deckUrl);
      const channelJSON = JSON.stringify(CHANNEL_NAME);
      const themeJSON = JSON.stringify(currentTheme || '');
      const storageKey = 'html-ppt-presenter:' + location.pathname;
      presenterWin = window.open('', 'html-ppt-presenter', 'width=1280,height=820,menubar=no,toolbar=no');
      if (!presenterWin) { alert('Please allow popups for presenter view'); return; }
      /* Build a simple presenter window */
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Presenter</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1d24;color:#e6edf3;font-family:sans-serif;padding:20px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:16px;height:calc(100vh - 120px)}.card{background:#0d1117;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:16px;overflow:hidden}.card h3{font-size:12px;text-transform:uppercase;letter-spacing:.15em;color:#8b949e;margin-bottom:8px}.card iframe{width:100%;height:calc(100% - 30px);border:none;border-radius:8px}.notes-card{grid-column:span 2}.notes-card .content{font-size:16px;line-height:1.7;color:#d0d7de;max-height:200px;overflow-y:auto}.timer{font-size:36px;font-weight:700;color:#3fb950;font-family:monospace}.controls{display:flex;gap:12px;align-items:center;margin-top:16px}.controls button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#e6edf3;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:14px}.slide-info{font-size:14px;color:#8b949e;margin-left:auto}</style></head><body><div class="cards"><div class="card"><h3>Current</h3><iframe id="cur"></iframe></div><div class="card"><h3>Next</h3><iframe id="nxt"></iframe></div><div class="card notes-card"><h3>Speaker Notes</h3><div class="content" id="notes-content"></div></div></div><div class="controls"><div class="timer" id="timer">00:00</div><button onclick="prev()">Prev</button><button onclick="next()">Next</button><div class="slide-info" id="info">1 / ${total}</div></div><script>var idx=${idx};var total=${total};var bc;try{bc=new BroadcastChannel(${channelJSON})}catch(e){}var tStart=Date.now();setInterval(function(){var s=Math.floor((Date.now()-tStart)/1000);document.getElementById('timer').textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000);function update(n){idx=Math.max(0,Math.min(total-1,n));document.getElementById('cur').src='${deckUrl}?preview='+(idx+1);document.getElementById('nxt').src=idx+1<total?'${deckUrl}?preview='+(idx+2):'';document.getElementById('info').textContent=(idx+1)+' / '+total;var notes=${metaJSON};document.getElementById('notes-content').innerHTML=notes[idx].notes||'(no notes)';if(bc)bc.postMessage({type:'go',idx:idx})}function prev(){update(idx-1)}function next(){update(idx+1)}document.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key===' '){next();e.preventDefault()}if(e.key==='ArrowLeft'){prev();e.preventDefault()}});update(idx);<\/script></body></html>`;
      presenterWin.document.write(html);
      presenterWin.document.close();
    }

    function fullscreen(){
      if (!document.fullscreenElement) {
        wasScrollModeBeforeFullscreen = scrollMode;
        if (scrollMode) exitScrollMode();
        document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen && document.exitFullscreen();
      }
    }
    document.addEventListener('fullscreenchange', function() {
      if (!document.fullscreenElement && wasScrollModeBeforeFullscreen) { wasScrollModeBeforeFullscreen = false; enterScrollMode(); }
    });

    const root = document.documentElement;
    const themesAttr = root.getAttribute('data-themes') || document.body.getAttribute('data-themes');
    const themes = themesAttr ? themesAttr.split(',').map(s=>s.trim()).filter(Boolean) : [];
    let themeIdx = 0;
    let themeBase = root.getAttribute('data-theme-base');
    if (!themeBase) {
      const existingLink = document.getElementById('theme-link');
      if (existingLink) { const raw = existingLink.getAttribute('href') || ''; const lastSlash = raw.lastIndexOf('/'); themeBase = lastSlash >= 0 ? raw.substring(0, lastSlash + 1) : 'assets/themes/'; }
      else { themeBase = 'assets/themes/'; }
    }
    function applyTheme(name) {
      let link = document.getElementById('theme-link');
      if (!link) { link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'theme-link'; document.head.appendChild(link); }
      link.href = themeBase + name + '.css';
      root.setAttribute('data-theme', name);
    }
    function cycleTheme(fromRemote){ if (!themes.length) return; themeIdx = (themeIdx+1) % themes.length; const name = themes[themeIdx]; applyTheme(name); if (!fromRemote && bc) bc.postMessage({ type: 'theme', name: name }); }

    let animIdx = 0;
    function cycleAnim(){
      animIdx = (animIdx+1) % ANIMS.length;
      const a = ANIMS[animIdx];
      const target = slides[idx].querySelector('[data-anim-target]') || slides[idx];
      ANIMS.forEach(x => target.classList.remove('anim-'+x));
      void target.offsetWidth;
      target.classList.add('anim-'+a);
      target.setAttribute('data-anim', a);
    }

    document.addEventListener('keydown', function (e) {
      if (e.metaKey||e.ctrlKey||e.altKey) return;
      if (editMode) { if (e.key === 'Escape') { toggleEditMode(false); e.preventDefault(); } return; }
      switch (e.key) {
        case 'ArrowRight': case ' ': case '.': case 'PageDown': case 'Enter': go(idx+1); e.preventDefault(); break;
        case 'ArrowLeft': case 'PageUp': case 'Backspace': go(idx-1); e.preventDefault(); break;
        case 'ArrowDown': go(idx+1); e.preventDefault(); break;
        case 'ArrowUp': go(idx-1); e.preventDefault(); break;
        case 'Home': go(0); break;
        case 'End': go(total-1); break;
        case 'f': case 'F': fullscreen(); break;
        case 's': case 'S': openPresenterWindow(); break;
        case 'n': case 'N': toggleNotes(); break;
        case 'o': case 'O': toggleOverview(); break;
        case 't': case 'T': cycleTheme(); break;
        case 'a': case 'A': cycleAnim(); break;
        case 'e': case 'E': toggleEditMode(); break;
        case 'Escape': toggleOverview(false); toggleNotes(false); break;
      }
    });

    function fromHash(){ const m = /^#\/(\d+)/.exec(location.hash||''); if (m) go(Math.max(0, parseInt(m[1],10)-1)); }
    window.addEventListener('hashchange', fromHash);
    fromHash();
    go(idx);
    enterScrollMode();
  });
})();
