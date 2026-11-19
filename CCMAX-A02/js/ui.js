(function () {
  const PB = (window.PB = window.PB || {});
  const $ = (id) => document.getElementById(id);

  const ACH = [
    { id: 'first', ic: '🐟', name: '第一口', desc: '抓到第一条鱼' },
    { id: 'fish25', ic: '🧺', name: '满载而归', desc: '累计抓到 25 条鱼' },
    { id: 'combo5', ic: '🔥', name: '连击 ×5', desc: '连续抓鱼达到 5 连击' },
    { id: 'combo12', ic: '⚡', name: '鱼群收割机', desc: '连续抓鱼达到 12 连击' },
    { id: 'gold', ic: '✨', name: '金色传说', desc: '抓到一条金鱼' },
    { id: 'air', ic: '🪽', name: '空中接鱼', desc: '在跳跃中抓到鱼' },
    { id: 'flyfish', ic: '🎏', name: '飞鱼猎手', desc: '抓到一条高空滑翔的飞鱼' },
    { id: 'crab3', ic: '🦀', name: '螃蟹跨栏', desc: '跳过 3 只螃蟹' },
    { id: 'wheelie', ic: '🦅', name: '展翅独轮', desc: '连续抬前轮 3 秒' },
    { id: 'speed', ic: '💨', name: '海风疾驰', desc: '速度达到 45 km/h' },
    { id: 'km', ic: '🛣️', name: '一公里海岸线', desc: '累计骑行 1 公里' },
    { id: 'night', ic: '🌙', name: '月光骑士', desc: '骑到星空月夜' },
    { id: 'meteor', ic: '🌠', name: '许个愿吧', desc: '看见一颗流星' },
    { id: 'director', ic: '🎬', name: '导演模式', desc: '用过全部 5 种镜头' }
  ];

  const UI = {
    ACH,
    got: new Set(),
    init(handlers) {
      this.h = handlers;
      try {
        const s = JSON.parse(localStorage.getItem('pb-a02-ach') || '[]');
        s.forEach((id) => this.got.add(id));
      } catch (e) {}
      this.el = {
        score: $('score'), fish: $('fish'), combo: $('combo'), comboBar: $('comboBar'),
        kmh: $('kmh'), rpm: $('rpm'), dist: $('dist'), gArc: $('gArc'), gCad: $('gCad'),
        clockIcon: $('clockIcon'), clockTxt: $('clockTxt'), clockTime: $('clockTime'),
        camName: $('camName'), achCount: $('achCount'), timeRate: $('timeRate'),
        mute: $('bMute'), auto: $('auto'), toasts: $('toasts'), floats: $('floats'), q: $('qInfo')
      };
      $('bCam').onclick = (e) => { e.currentTarget.blur(); handlers.cam(); };
      $('bAch').onclick = (e) => { e.currentTarget.blur(); this.toggleAch(); };
      $('bTime').onclick = (e) => { e.currentTarget.blur(); handlers.time(); };
      $('bMute').onclick = (e) => { e.currentTarget.blur(); handlers.mute(); };
      $('bAchClose').onclick = () => this.toggleAch(false);
      $('achPanel').addEventListener('pointerdown', (e) => { if (e.target.id === 'achPanel') this.toggleAch(false); });
      $('bGo').onclick = () => { $('start').hidden = true; handlers.start(); };
      this.renderAchCount();

      const touchCapable = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (touchCapable && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
      window.addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
      document.querySelectorAll('#touch button').forEach((b) => {
        const k = b.dataset.k;
        const on = (e) => { e.preventDefault(); b.classList.add('on'); handlers.touch(k, true); try { b.setPointerCapture(e.pointerId); } catch (_) {} };
        const off = (e) => { e.preventDefault(); b.classList.remove('on'); handlers.touch(k, false); };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointercancel', off);
        b.addEventListener('lostpointercapture', off);
      });
    },

    get achOpen() { return !$('achPanel').hidden; },
    get started() { return $('start').hidden; },

    toggleAch(force) {
      const p = $('achPanel');
      const open = force === undefined ? p.hidden : force;
      p.hidden = !open;
      if (open) {
        $('achList').innerHTML = ACH.map((a) =>
          `<div class="ach ${this.got.has(a.id) ? 'ok' : ''}"><span class="ic">${a.ic}</span><div><b>${a.name}</b><small>${a.desc}</small></div></div>`).join('');
        $('achSum').textContent = `${this.got.size} / ${ACH.length}`;
      }
      if (this.h.pause) this.h.pause(open);
    },

    unlock(id) {
      if (this.got.has(id)) return false;
      const a = ACH.find((x) => x.id === id);
      if (!a) return false;
      this.got.add(id);
      try { localStorage.setItem('pb-a02-ach', JSON.stringify([...this.got])); } catch (e) {}
      const d = document.createElement('div');
      d.className = 'toast';
      d.innerHTML = `<span class="ic">${a.ic}</span><div>成就解锁 · <b>${a.name}</b><small>${a.desc}</small></div>`;
      this.el.toasts.appendChild(d);
      setTimeout(() => d.remove(), 3800);
      this.renderAchCount();
      return true;
    },

    renderAchCount() { if (this.el) this.el.achCount.textContent = `${this.got.size}/${ACH.length}`; },

    float(text, x, y, cls) {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { x = innerWidth / 2; y = innerHeight * 0.4; }
      const d = document.createElement('div');
      d.className = 'fl ' + (cls || '');
      d.textContent = text;
      d.style.left = x + 'px'; d.style.top = y + 'px';
      this.el.floats.appendChild(d);
      setTimeout(() => d.remove(), 1000);
    },

    hud(s) {
      const e = this.el;
      const kmh = s.speed * 3.6;
      e.score.textContent = s.score.toLocaleString();
      e.fish.textContent = s.fish;
      e.combo.textContent = '×' + s.combo;
      e.comboBar.style.width = (s.comboT * 100).toFixed(1) + '%';
      e.kmh.textContent = kmh.toFixed(0);
      e.rpm.textContent = s.rpm.toFixed(0);
      e.dist.textContent = (s.dist / 1000).toFixed(2);
      e.gArc.setAttribute('stroke-dasharray', `${(Math.min(1, kmh / 55) * 150.8).toFixed(1)} 201`);
      e.gCad.setAttribute('stroke-dasharray', `${(Math.min(1, s.rpm / 130) * 103.7).toFixed(1)} 139`);
      e.clockIcon.textContent = s.icon;
      e.clockTxt.textContent = s.phase;
      e.clockTime.textContent = s.clock;
      e.auto.hidden = !s.auto;
    },

    setCam(name) { this.el.camName.textContent = name; },
    setRate(r) { this.el.timeRate.textContent = '×' + r; },
    setMute(m) { this.el.mute.textContent = m ? '🔇' : '🔊'; },
    setQ(t) { this.el.q.textContent = t; }
  };

  PB.UI = UI;
})();
