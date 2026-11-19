(function () {
  const PK = window.PK;
  const $ = (id) => document.getElementById(id);

  const ACH = [
    ['first', '第一口', '抓到第一条鱼'],
    ['fish25', '小有收获', '累计抓到 25 条鱼'],
    ['fish100', '鹈鹕之胃', '累计抓到 100 条鱼'],
    ['gold', '金光闪闪', '抓到一条金色飞鱼'],
    ['combo10', '十连捞', '连击达到 10'],
    ['air', '空中接力', '跳在半空中抓到鱼'],
    ['speed', '风驰电掣', '时速达到 60 km/h'],
    ['km5', '长途骑手', '单次骑行满 5 公里'],
    ['wheelie', '翘头大师', '连续展翅翘头 5 秒'],
    ['night', '星空月夜', '一直骑到满天星斗'],
    ['star', '许个愿', '看到一颗流星'],
    ['cams', '导演', '用过全部 5 种镜头'],
    ['auto', '全自动捕鱼', '自动驾驶抓到 10 条鱼'],
    ['clean', '一路平安', '连续 1 公里没撞上路锥'],
  ];

  const store = {
    get(k, d) { try { const v = localStorage.getItem('pelican-coast-' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('pelican-coast-' + k, JSON.stringify(v)); } catch (e) {} },
  };

  const input = (PK.input = { w: false, s: false, t: false, events: [], last: -1e9, touch: false });
  const now = () => performance.now() / 1000;
  const poke = () => { input.last = now(); };

  const UI = (PK.UI = {
    got: new Set(store.get('ach', [])),
    totalFish: store.get('fish', 0),
    best: store.get('best', 0),

    unlock(id) {
      if (!PK.live || this.got.has(id)) return;
      this.got.add(id);
      store.set('ach', [...this.got]);
      const a = ACH.find((x) => x[0] === id);
      const idx = ACH.indexOf(a) + 1;
      const el = document.createElement('div');
      el.className = 'toast panel';
      el.innerHTML = `<i>${idx}</i><div><b>成就解锁 · ${a[1]}</b><span>${a[2]}</span></div>`;
      $('toasts').appendChild(el);
      setTimeout(() => el.remove(), 4200);
      PK.Audio.sfx('ach');
      this.renderAch();
    },

    addFish(n) {
      this.totalFish += n;
      store.set('fish', this.totalFish);
      if (this.totalFish >= 25) this.unlock('fish25');
      if (this.totalFish >= 100) this.unlock('fish100');
    },

    saveBest(score) {
      if (score > this.best) { this.best = score; store.set('best', score); }
    },

    renderAch() {
      $('hAch').textContent = `${this.got.size}/${ACH.length}`;
      $('achList').innerHTML = ACH.map((a, i) => `<div class="ai ${this.got.has(a[0]) ? 'got' : ''}"><i>${i + 1}</i><div><b>${a[1]}</b><span>${a[2]}</span></div></div>`).join('');
    },

    flashT: 0,
    flash(text, dur = 1.1) {
      const m = $('msg');
      m.textContent = text;
      m.classList.add('show');
      this.flashT = dur;
    },

    hudCache: {},
    set(id, v) { if (this.hudCache[id] !== v) { this.hudCache[id] = v; $(id).textContent = v; } },

    hud(dt, g) {
      this.set('hScore', String(Math.floor(g.score)));
      this.set('hFish', String(g.fish));
      this.set('hCombo', '×' + g.combo);
      this.set('hDist', (g.dist / 1000).toFixed(2) + ' km');
      this.set('hSpd', String(Math.round(g.speed * 3.6)));
      this.set('hRpm', String(Math.round(g.rpm)));
      this.set('hTime', g.timeName);
      this.set('hCam', '镜头 · ' + g.camName);
      this.set('hQ', g.qName);
      this.set('hFps', String(Math.round(g.fps)));
      $('hAuto').hidden = !g.auto;
      if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) $('msg').classList.remove('show'); }
      this.drawGauge(g.speed * 3.6, g.rpm);
    },

    gaugeLast: -1,
    drawGauge(kmh, rpm) {
      const k = Math.round(kmh * 2) / 2;
      if (k === this.gaugeLast) return;
      this.gaugeLast = k;
      const c = $('gauge'), g = c.getContext('2d');
      const W = c.width, H = c.height, cx = W / 2, cy = H - 18, r = 104;
      g.clearRect(0, 0, W, H);
      const a0 = Math.PI * 1.08, a1 = Math.PI * 1.92, max = 80;
      g.lineCap = 'round';
      g.lineWidth = 10;
      g.strokeStyle = 'rgba(243,235,211,0.12)';
      g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
      const f = Math.min(1, kmh / max);
      const grd = g.createLinearGradient(cx - r, 0, cx + r, 0);
      grd.addColorStop(0, '#3fb6c4'); grd.addColorStop(0.6, '#ffb347'); grd.addColorStop(1, '#e8432e');
      g.strokeStyle = grd;
      g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * f); g.stroke();
      g.lineWidth = 2;
      g.fillStyle = 'rgba(169,180,198,0.9)';
      g.font = '600 15px "Chakra Petch", sans-serif';
      g.textAlign = 'center';
      for (let v = 0; v <= max; v += 10) {
        const a = a0 + ((a1 - a0) * v) / max;
        const major = v % 20 === 0;
        g.strokeStyle = v >= 60 ? 'rgba(232,67,46,0.9)' : 'rgba(243,235,211,0.5)';
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14));
        g.lineTo(cx + Math.cos(a) * (r - (major ? 24 : 19)), cy + Math.sin(a) * (r - (major ? 24 : 19)));
        g.stroke();
        if (major) g.fillText(String(v), cx + Math.cos(a) * (r - 38), cy + Math.sin(a) * (r - 38) + 5);
      }
    },

    init(onStart) {
      this.renderAch();
      $('go').addEventListener('click', () => {
        $('start').hidden = true;
        PK.Audio.start();
        poke();
        onStart();
      });
      const openAch = () => { $('achPanel').hidden = false; PK.paused = true; };
      const closeAch = () => { $('achPanel').hidden = true; PK.paused = false; };
      $('bAch').addEventListener('click', openAch);
      $('achClose').addEventListener('click', closeAch);
      $('bCam').addEventListener('click', (e) => { input.events.push('cam'); e.currentTarget.blur(); });
      $('bMute').addEventListener('click', (e) => { this.toggleMute(); e.currentTarget.blur(); });

      const keys = { KeyW: 'w', ArrowUp: 'w', KeyS: 's', ArrowDown: 's', KeyT: 't' };
      addEventListener('keydown', (e) => {
        if (e.repeat && !keys[e.code]) return;
        if (keys[e.code]) { input[keys[e.code]] = true; poke(); }
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') { input.events.push('left'); poke(); }
        if (e.code === 'KeyD' || e.code === 'ArrowRight') { input.events.push('right'); poke(); }
        if (e.code === 'Space') { input.events.push('jump'); poke(); e.preventDefault(); }
        if (e.code === 'KeyC') input.events.push('cam');
        if (e.code === 'KeyM') this.toggleMute();
        if (e.code === 'KeyH') { $('achPanel').hidden ? openAch() : closeAch(); }
        if (e.code === 'Enter' && !$('start').hidden) $('go').click();
        if (e.code === 'Escape' && !$('achPanel').hidden) closeAch();
      });
      addEventListener('keyup', (e) => { if (keys[e.code]) input[keys[e.code]] = false; });
      addEventListener('blur', () => { input.w = input.s = input.t = false; });

      const hold = (id, k) => {
        const el = $(id);
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); input[k] = true; el.classList.add('act'); poke(); PK.Audio.start(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, () => { input[k] = false; el.classList.remove('act'); }));
      };
      const tap = (id, ev) => {
        const el = $(id);
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); input.events.push(ev); el.classList.add('act'); poke(); PK.Audio.start(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((x) => el.addEventListener(x, () => el.classList.remove('act')));
      };
      hold('tW', 'w'); hold('tS', 's'); hold('tT', 't');
      tap('tL', 'left'); tap('tR', 'right'); tap('tJ', 'jump');
      const enableTouch = () => { input.touch = true; $('touch').classList.add('on'); document.body.classList.add('touchmode'); };
      if (matchMedia('(pointer: coarse)').matches) enableTouch();
      addEventListener('touchstart', enableTouch, { once: true, passive: true });
    },

    toggleMute() {
      PK.Audio.setMuted(!PK.Audio.muted);
      $('bMute').textContent = PK.Audio.muted ? '声音：关' : '声音：开';
    },

    setPOV(on) { $('pov').classList.toggle('on', on); $('tint').classList.toggle('on', on); },
  });
})();
