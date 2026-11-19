window.PG = window.PG || {};

PG.Audio = (function () {
  let ctx, master, musicBus, sfxBus, ambBus, comp;
  let windSrc, windFilt, windGain, surfGain, surfFilt, tireGain, tireFilt;
  let started = false, muted = false;
  let bpm = 84, targetBpm = 84, nextStep = 0, step = 0, bar = 0;
  let night = 0, intensity = 0;
  const lookahead = 0.12;

  const scales = {
    day: [0, 2, 4, 7, 9],
    night: [0, 3, 5, 7, 10],
  };
  const progDay = [[0, 4, 7], [9, -3, 4], [5, 9, 12], [7, 11, 14]];
  const progNight = [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]];
  const melDay = [12, -1, 14, 16, -1, 19, 16, -1, 14, -1, 12, 9, -1, 12, -1, -1];
  const melNight = [15, -1, -1, 12, -1, 10, -1, -1, 15, 17, -1, 15, -1, 12, -1, -1];

  function noiseBuf(sec, brown) {
    const n = ctx.sampleRate * sec, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  function loopNoise(buf, filtType, freq, q, bus) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filtType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(bus);
    s.start();
    return { s, f, g };
  }

  let white, brown, reverb;
  function makeReverb() {
    const len = ctx.sampleRate * 2.4, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const cv = ctx.createConvolver(); cv.buffer = b;
    return cv;
  }

  function start() {
    if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    started = true;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    comp.connect(master); master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.7; ambBus.connect(comp);
    reverb = makeReverb();
    const rv = ctx.createGain(); rv.gain.value = 0.35;
    reverb.connect(rv); rv.connect(comp);
    white = noiseBuf(2, false); brown = noiseBuf(4, true);
    const w = loopNoise(white, 'bandpass', 500, 0.6, ambBus); windFilt = w.f; windGain = w.g;
    const s = loopNoise(brown, 'lowpass', 500, 0.5, ambBus); surfFilt = s.f; surfGain = s.g;
    const t = loopNoise(white, 'bandpass', 180, 1.2, ambBus); tireFilt = t.f; tireGain = t.g;
    nextStep = ctx.currentTime + 0.1;
  }

  function env(g, t, a, peak, d, sus, r, dur) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
  }

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function tone(t, midi, dur, type, vol, bus, opt) {
    opt = opt || {};
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(mtof(midi), t);
    if (opt.detune) o.detune.value = opt.detune;
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(mtof(midi + opt.slide), t + dur);
    const g = ctx.createGain();
    let node = o;
    if (opt.cut) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(opt.cut, t); f.Q.value = opt.q || 1;
      if (opt.cutEnd) f.frequency.exponentialRampToValueAtTime(opt.cutEnd, t + dur);
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(bus || musicBus);
    if (opt.rev) { const rg = ctx.createGain(); rg.gain.value = opt.rev; g.connect(rg); rg.connect(reverb); }
    env(g, t, opt.a || 0.008, vol, opt.d || 0.12, opt.s == null ? 0.4 : opt.s, opt.r || 0.15, dur);
    o.start(t); o.stop(t + dur + (opt.r || 0.15) + 0.05);
  }

  function noiseHit(t, dur, freq, type, vol, bus, q) {
    const s = ctx.createBufferSource(); s.buffer = white;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(bus || musicBus);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }

  function kick(t, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
  }

  function scheduleStep(t) {
    const s = step % 16;
    const ch = (night > 0.5 ? progNight : progDay)[bar % 4];
    const root = night > 0.5 ? 45 : 48;
    const lvl = 0.35 + 0.65 * intensity;
    const sixteenth = 60 / bpm / 4;
    if (s % 4 === 0) kick(t, 0.5 * lvl * (night > 0.5 ? 0.7 : 1));
    if (s === 4 || s === 12) noiseHit(t, 0.14, 1800, 'bandpass', 0.22 * lvl, musicBus, 0.8);
    if (s % 2 === 0 || intensity > 0.6) noiseHit(t, 0.035, 8000, 'highpass', (s % 4 === 2 ? 0.09 : 0.04) * lvl);
    if (s % 4 === 0 || s === 6 || s === 14) {
      tone(t, root - 12 + ch[0], sixteenth * 1.6, 'sawtooth', 0.14 * (0.6 + 0.4 * lvl), musicBus, { cut: 700, cutEnd: 220, q: 6, s: 0.3 });
    }
    if (s === 0 || s === 8) {
      for (const n of ch) tone(t, root + 12 + n, sixteenth * 7, 'triangle', 0.035, musicBus, { a: 0.06, d: 0.3, s: 0.6, r: 0.5, rev: 0.6, detune: Math.random() * 8 - 4 });
    }
    if (intensity > 0.25) {
      const m = (night > 0.5 ? melNight : melDay)[s];
      if (m >= 0) tone(t, root + 12 + m + (bar % 4 === 3 && s > 8 ? 2 : 0), sixteenth * 1.8, night > 0.5 ? 'sine' : 'square', (night > 0.5 ? 0.07 : 0.035) * lvl, musicBus, { cut: 2600, s: 0.3, rev: 0.5 });
    }
    if (night > 0.5 && s % 2 === 1 && Math.random() < 0.25) {
      const sc = scales.night;
      tone(t, root + 36 + sc[Math.floor(Math.random() * sc.length)], 0.05, 'sine', 0.025, musicBus, { rev: 1.2, r: 0.6 });
    }
  }

  function update(dt, p) {
    if (!started || !ctx) return;
    const now = ctx.currentTime;
    night = p.night; intensity = Math.min(1, p.speed / 12);
    targetBpm = Math.max(72, Math.min(150, 64 + p.rpm * 0.75));
    bpm += (targetBpm - bpm) * Math.min(1, dt * 1.5);
    while (nextStep < now + lookahead) {
      if (nextStep < now - 0.2) nextStep = now;
      scheduleStep(nextStep);
      nextStep += 60 / bpm / 4;
      step++;
      if (step % 16 === 0) bar++;
    }
    const sp = p.speed;
    windGain.gain.setTargetAtTime(0.02 + Math.min(0.22, sp * sp * 0.0012), now, 0.2);
    windFilt.frequency.setTargetAtTime(300 + sp * 70, now, 0.2);
    tireGain.gain.setTargetAtTime(p.air ? 0 : Math.min(0.12, sp * 0.009), now, 0.08);
    tireFilt.frequency.setTargetAtTime(120 + sp * 22, now, 0.1);
    const surf = 0.18 + 0.14 * Math.pow(0.5 + 0.5 * Math.sin(p.time * 1.5), 3);
    surfGain.gain.setTargetAtTime(surf, now, 0.25);
    surfFilt.frequency.setTargetAtTime(380 + 240 * Math.sin(p.time * 1.5 + 1), now, 0.25);
  }

  const sfx = {
    catch(combo) {
      if (!ctx) return; const t = ctx.currentTime;
      const base = 72 + Math.min(combo, 8) * 2;
      tone(t, base, 0.06, 'square', 0.12, sfxBus, { cut: 4000 });
      tone(t + 0.06, base + 7, 0.1, 'square', 0.12, sfxBus, { cut: 4000, rev: 0.3 });
      noiseHit(t, 0.15, 900, 'bandpass', 0.15, sfxBus, 2);
    },
    gulp() {
      if (!ctx) return; const t = ctx.currentTime;
      tone(t, 50, 0.18, 'sine', 0.3, sfxBus, { slide: -10, s: 0.2 });
    },
    golden() {
      if (!ctx) return; const t = ctx.currentTime;
      [76, 79, 84, 88, 91].forEach((n, i) => tone(t + i * 0.06, n, 0.18, 'triangle', 0.12, sfxBus, { rev: 0.8 }));
    },
    jump() {
      if (!ctx) return; const t = ctx.currentTime;
      tone(t, 60, 0.18, 'triangle', 0.15, sfxBus, { slide: 12, s: 0.3 });
      noiseHit(t, 0.2, 1200, 'bandpass', 0.08, sfxBus);
    },
    land(v) {
      if (!ctx) return; const t = ctx.currentTime;
      kick(t, Math.min(0.6, 0.2 + v * 0.06));
      noiseHit(t, 0.12, 400, 'lowpass', 0.25, sfxBus);
      tone(t + 0.02, 84, 0.04, 'square', 0.03, sfxBus, { cut: 5000 });
    },
    wing() {
      if (!ctx) return; const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) noiseHit(t + i * 0.08, 0.1, 600, 'bandpass', 0.18, sfxBus, 0.8);
    },
    bell() {
      if (!ctx) return; const t = ctx.currentTime;
      for (const [f, v] of [[2800, 0.12], [4200, 0.05], [1900, 0.06]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f; o.type = 'sine';
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1);
      }
    },
    bump() {
      if (!ctx) return; const t = ctx.currentTime;
      noiseHit(t, 0.25, 300, 'lowpass', 0.5, sfxBus);
      tone(t, 40, 0.2, 'sawtooth', 0.15, sfxBus, { cut: 300, s: 0.1 });
    },
    miss() {
      if (!ctx) return; const t = ctx.currentTime;
      tone(t, 64, 0.12, 'sine', 0.08, sfxBus, { slide: -5 });
    },
    achieve() {
      if (!ctx) return; const t = ctx.currentTime;
      [72, 76, 79, 84].forEach((n, i) => tone(t + i * 0.09, n, 0.3, 'triangle', 0.13, sfxBus, { rev: 1 }));
      tone(t + 0.36, 96, 0.6, 'sine', 0.06, sfxBus, { rev: 1.2, r: 0.8 });
    },
    splash() {
      if (!ctx) return; const t = ctx.currentTime;
      noiseHit(t, 0.35, 1400, 'bandpass', 0.18, sfxBus, 0.6);
    },
    gull() {
      if (!ctx) return; const t = ctx.currentTime;
      for (let i = 0; i < 2; i++) tone(t + i * 0.22, 84 + Math.random() * 3, 0.16, 'sawtooth', 0.025, ambBus, { slide: -6, cut: 2500, s: 0.5, rev: 0.8 });
    },
  };

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  return { start, update, sfx, setMuted, get muted() { return muted; }, get bpm() { return bpm; } };
})();
