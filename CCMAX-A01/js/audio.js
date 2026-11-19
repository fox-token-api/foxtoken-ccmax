(function () {
  const PK = (window.PK = window.PK || {});
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const DUSK = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 50, 52, 57]];
  const NIGHT = [[50, 54, 57, 61], [42, 45, 49, 52], [43, 47, 50, 54], [40, 43, 47, 50]];
  const ARP = [0, 1, 2, 3, 2, 1, 3, 2];

  const A = (PK.Audio = {
    ctx: null, muted: false, ready: false,
    bpm: 80, step: 0, next: 0, bar: 0, t: 0,

    start() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      this.master.connect(comp).connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master);
      this.fx = c.createGain(); this.fx.gain.value = 0.7; this.fx.connect(this.master);
      this.amb = c.createGain(); this.amb.gain.value = 0.6; this.amb.connect(this.master);

      const delay = c.createDelay(1);
      delay.delayTime.value = 0.28;
      const fb = c.createGain(); fb.gain.value = 0.32;
      const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
      this.echo = c.createGain(); this.echo.gain.value = 0.35;
      this.echo.connect(delay); delay.connect(dl).connect(fb).connect(delay); dl.connect(this.music);

      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(this.amb); s.start(); return { fl, g }; };
      this.ocean = mk('lowpass', 420, 0.4);
      this.wind = mk('bandpass', 700, 0.6);
      this.next = c.currentTime + 0.1;
      this.ready = true;
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
    },

    tone(f, t, dur, o = {}) {
      const c = this.ctx;
      const osc = c.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(f, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
      if (o.detune) osc.detune.value = o.detune;
      const g = c.createGain();
      const v = o.gain ?? 0.2, at = o.attack ?? 0.005;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + at);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc;
      if (o.lp) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = o.lp; node.connect(fl); node = fl; }
      node.connect(g).connect(o.dest || this.fx);
      if (o.send) g.connect(this.echo);
      osc.start(t); osc.stop(t + dur + 0.05);
    },

    noise(t, dur, o = {}) {
      const c = this.ctx;
      const s = c.createBufferSource();
      s.buffer = this.noiseBuf;
      const fl = c.createBiquadFilter();
      fl.type = o.type || 'bandpass';
      fl.frequency.setValueAtTime(o.f || 1000, t);
      if (o.sweep) fl.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      fl.Q.value = o.q ?? 1;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.gain ?? 0.3, t + (o.attack ?? 0.004));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl).connect(g).connect(o.dest || this.fx);
      s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    },

    sfx(name, x = 0) {
      if (!this.ready || this.muted) return;
      const t = this.ctx.currentTime + 0.005;
      switch (name) {
        case 'catch':
          this.tone(880, t, 0.12, { type: 'triangle', gain: 0.18 });
          this.tone(1318, t + 0.06, 0.18, { type: 'triangle', gain: 0.16, send: true });
          this.tone(220, t + 0.04, 0.22, { slide: 90, gain: 0.25 });
          if (x > 4) this.tone(1760, t + 0.12, 0.2, { type: 'sine', gain: 0.1, send: true });
          break;
        case 'gold':
          [0, 4, 7, 12, 16].forEach((s, i) => this.tone(mtof(74 + s), t + i * 0.06, 0.35, { type: 'triangle', gain: 0.14, send: true }));
          this.noise(t, 0.6, { type: 'highpass', f: 6000, gain: 0.08 });
          break;
        case 'jump':
          this.noise(t, 0.3, { f: 500, sweep: 2500, gain: 0.18, q: 2 });
          this.tone(300, t, 0.18, { slide: 620, type: 'sine', gain: 0.12 });
          break;
        case 'land':
          this.tone(130, t, 0.18, { slide: 55, gain: 0.3 });
          this.noise(t, 0.12, { type: 'lowpass', f: 600, gain: 0.2 });
          break;
        case 'crash':
          this.noise(t, 0.5, { type: 'lowpass', f: 1800, sweep: 200, gain: 0.45 });
          this.tone(330, t, 0.25, { type: 'square', slide: 140, gain: 0.08, lp: 1500 });
          this.tone(510, t + 0.02, 0.3, { type: 'square', slide: 230, gain: 0.05, lp: 2200 });
          break;
        case 'splash':
          this.noise(t, 0.45, { f: 1400, sweep: 500, gain: 0.3, q: 0.8 });
          this.noise(t + 0.05, 0.3, { type: 'highpass', f: 3000, gain: 0.1 });
          break;
        case 'flap':
          this.noise(t, 0.12, { type: 'lowpass', f: 900, gain: 0.25 });
          this.noise(t + 0.14, 0.12, { type: 'lowpass', f: 800, gain: 0.2 });
          break;
        case 'lane':
          this.noise(t, 0.16, { type: 'highpass', f: 2500, sweep: 900, gain: 0.07 });
          break;
        case 'ach':
          [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(67 + s), t + i * 0.09, 0.45, { type: 'triangle', gain: 0.15, send: true }));
          this.tone(mtof(79), t + 0.36, 0.8, { type: 'sine', gain: 0.12, send: true });
          break;
        case 'star':
          this.tone(2400, t, 1.2, { slide: 900, gain: 0.05, send: true, attack: 0.05 });
          break;
        case 'click':
          this.tone(1200, t, 0.05, { type: 'square', gain: 0.04, lp: 3000 });
          break;
        case 'miss':
          this.tone(300, t, 0.2, { type: 'triangle', slide: 200, gain: 0.08 });
          break;
      }
    },

    scheduleStep(st, t, s) {
      const prog = s.night > 0.5 ? NIGHT : DUSK;
      const chord = prog[this.bar % 4];
      const sp = Math.min(1, s.speed / 14);
      const stepDur = 60 / this.bpm / 4;
      const M = this.music;
      if (st === 0) {
        const padG = 0.03 + s.night * 0.05;
        chord.forEach((n, i) => {
          this.tone(mtof(n + 12), t, stepDur * 16 + 0.6, { type: 'sawtooth', gain: padG, attack: 0.5, lp: 700 + s.night * -200 + sp * 900, dest: M, detune: i % 2 ? 7 : -7 });
        });
      }
      if (s.speed > 0.8) {
        if (st % 8 === 0 || (sp > 0.55 && st % 4 === 0)) this.tone(110, t, 0.22, { slide: 42, gain: 0.5 * (0.4 + sp * 0.6), dest: M });
        if (st % 4 === 2) this.noise(t, 0.05, { type: 'highpass', f: 7000, gain: 0.05 + sp * 0.08, dest: M });
        if (sp > 0.35 && (st === 4 || st === 12)) this.noise(t, 0.16, { f: 1800, q: 0.7, gain: 0.12 + sp * 0.06, dest: M });
        if (st % 8 === 0 || st === 6 || (sp > 0.6 && st === 14)) this.tone(mtof(chord[0] - 12), t, stepDur * 3, { type: 'triangle', gain: 0.22, dest: M, lp: 900 });
      }
      const every = sp > 0.7 ? 1 : sp > 0.2 ? 2 : 4;
      if (st % every === 0) {
        const idx = ARP[(st / every + this.bar * 3) % ARP.length | 0];
        const oct = (st % 8 === 0 ? 24 : 12) + (s.night > 0.5 && st % 6 === 0 ? 12 : 0);
        this.tone(mtof(chord[idx] + oct), t, 0.28 + s.night * 0.4, { type: s.night > 0.5 ? 'sine' : 'triangle', gain: 0.07 + 0.03 * sp, dest: M, send: true });
      }
      if (s.wheelie && st % 4 === 0) this.tone(mtof(chord[3] + 36), t, 0.4, { type: 'sine', gain: 0.04, dest: M, send: true });
    },

    update(dt, s) {
      if (!this.ready) return;
      const c = this.ctx;
      this.t += dt;
      const target = Math.max(76, Math.min(150, s.rpm || 0));
      this.bpm += (target - this.bpm) * Math.min(1, dt * 0.8);
      const now = c.currentTime;
      if (this.next < now - 0.2) this.next = now + 0.05;
      while (this.next < now + 0.12) {
        if (!this.muted) this.scheduleStep(this.step, this.next, s);
        this.next += 60 / this.bpm / 4;
        this.step = (this.step + 1) % 16;
        if (this.step === 0) this.bar++;
      }
      const swell = 0.5 + 0.5 * Math.sin(this.t * 0.55) * Math.sin(this.t * 0.23 + 1);
      this.ocean.g.gain.setTargetAtTime(0.18 + swell * 0.32, now, 0.2);
      this.ocean.fl.frequency.setTargetAtTime(300 + swell * 500, now, 0.2);
      const w = Math.min(1, s.speed / 18);
      this.wind.g.gain.setTargetAtTime(w * w * 0.4 + (s.air ? 0.1 : 0), now, 0.15);
      this.wind.fl.frequency.setTargetAtTime(500 + w * 900, now, 0.2);
    },
  });
})();
