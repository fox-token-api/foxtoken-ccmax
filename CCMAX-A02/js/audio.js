(function () {
  const PB = (window.PB = window.PB || {});

  let ctx = null, master, comp, musicBus, sfxBus, ambBus, noiseBuf;
  let wind, windF, windG, surf, surfF, surfG, hum, humG, musicLP;
  let muted = false, started = false;
  let bpm = 80, nextT = 0, step = 0, bar = 0, nightMix = 0, energy = 0;

  const A4 = 440;
  const mtof = (m) => A4 * Math.pow(2, (m - 69) / 12);
  const PROG = [
    [57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]
  ];
  const PENTA = [69, 72, 74, 76, 79, 81, 84, 86];

  function makeNoise() {
    const len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.6 + w * 0.4;
      d[i] = last;
    }
    return b;
  }

  function loopNoise(dest) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.loopStart = Math.random(); s.start(0, Math.random() * 1.5);
    s.connect(dest);
    return s;
  }

  function init() {
    if (started) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    started = true;
    noiseBuf = makeNoise();

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8;
    master.connect(comp); comp.connect(ctx.destination);

    musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 5000;
    musicBus = ctx.createGain(); musicBus.gain.value = 0.32;
    musicBus.connect(musicLP); musicLP.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.5; ambBus.connect(master);

    windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.Q.value = 0.7; windF.frequency.value = 500;
    windG = ctx.createGain(); windG.gain.value = 0;
    windF.connect(windG); windG.connect(ambBus);
    wind = loopNoise(windF);

    surfF = ctx.createBiquadFilter(); surfF.type = 'lowpass'; surfF.frequency.value = 650;
    surfG = ctx.createGain(); surfG.gain.value = 0;
    surfF.connect(surfG); surfG.connect(ambBus);
    surf = loopNoise(surfF);

    hum = ctx.createOscillator(); hum.type = 'triangle'; hum.frequency.value = 40;
    const humF = ctx.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 180;
    humG = ctx.createGain(); humG.gain.value = 0;
    hum.connect(humF); humF.connect(humG); humG.connect(ambBus); hum.start();

    nextT = ctx.currentTime + 0.1;
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(freq, t, dur, type, vol, dest, opts) {
    opts = opts || {};
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    let node = o;
    if (opts.lp) {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; f.Q.value = opts.q || 0.7;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(dest);
    env(g, t, opts.a || 0.005, vol, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noiseHit(t, dur, freq, vol, dest, type, q) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(dest);
    env(g, t, 0.003, vol, dur);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return f;
  }

  function scheduleStep(t, s, spb) {
    const st = s % 16;
    const chord = PROG[bar % 4];
    const root = chord[0] - 24;
    const sixteenth = spb / 4;
    const e = energy;

    if (st === 0) {
      chord.forEach((m, i) => {
        tone(mtof(m), t, spb * 3.8, 'sawtooth', 0.018 + nightMix * 0.01, musicBus,
          { a: 0.35, lp: 900 + (1 - nightMix) * 900, detune: (i - 1.5) * 7 });
      });
      if (nightMix > 0.4) tone(mtof(chord[3] + 24), t, spb * 4, 'sine', 0.012 * nightMix, musicBus, { a: 0.8 });
    }
    if (e > 0.15 && (st === 0 || st === 8 || (e > 0.75 && st === 10))) {
      tone(110, t, 0.28, 'sine', 0.5 * Math.min(1, e + 0.2), musicBus, { to: 38 });
    }
    if (e > 0.45 && (st === 4 || st === 12)) {
      noiseHit(t, 0.16, 1800, 0.18, musicBus, 'bandpass', 0.8);
    }
    if (e > 0.25 && st % 4 === 2) noiseHit(t, 0.05, 8000, 0.06 + e * 0.07, musicBus, 'highpass', 0.5);
    if (e > 0.85 && st % 2 === 1) noiseHit(t, 0.03, 9000, 0.035, musicBus, 'highpass', 0.5);

    if (st % 2 === 0) {
      const bassPat = [0, 0, 12, 0, 7, 0, 12, 10];
      const m = root + bassPat[(st / 2) % 8];
      if (e > 0.05 || st % 8 === 0) tone(mtof(m), t, sixteenth * 1.8, 'triangle', 0.16, musicBus, { lp: 600 });
    }
    if (st % 2 === 0 || e > 0.6) {
      const idx = [0, 1, 2, 3, 2, 1][(s >> (e > 0.6 ? 0 : 1)) % 6];
      const m = chord[idx] + 12;
      tone(mtof(m), t, sixteenth * 1.5, 'square', 0.022 + e * 0.01, musicBus, { lp: 1600 + e * 1500, q: 2 });
    }
    if (st % 4 === 0 && Math.random() < 0.18 + e * 0.25) {
      const m = PENTA[(Math.random() * PENTA.length) | 0] - (nightMix > 0.5 ? 12 : 0);
      tone(mtof(m), t, spb * 0.9, 'sine', 0.05, musicBus, { a: 0.02 });
      tone(mtof(m) * 2.005, t, spb * 0.6, 'sine', 0.012, musicBus, { a: 0.02 });
    }
  }

  function update(dt, s) {
    if (!started || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const sp = s.speed || 0;
    windG.gain.setTargetAtTime(Math.min(0.5, sp * sp * 0.0016 + (s.airborne ? 0.08 : 0)), t, 0.15);
    windF.frequency.setTargetAtTime(300 + sp * 70, t, 0.2);
    const swell = 0.5 + 0.5 * Math.sin(t * 0.45) * Math.sin(t * 0.17 + 1);
    surfG.gain.setTargetAtTime(0.06 + swell * 0.16, t, 0.4);
    surfF.frequency.setTargetAtTime(350 + swell * 700, t, 0.4);
    hum.frequency.setTargetAtTime(25 + sp * 7, t, 0.1);
    humG.gain.setTargetAtTime(s.airborne ? 0 : Math.min(0.12, sp * 0.008), t, 0.05);

    nightMix += ((s.night || 0) - nightMix) * Math.min(1, dt);
    musicLP.frequency.setTargetAtTime(2200 + (1 - nightMix) * 5000, t, 0.5);
    const rpm = s.rpm || 0;
    const targetBpm = Math.max(64, Math.min(138, rpm < 30 ? 64 : rpm));
    bpm += (targetBpm - bpm) * Math.min(1, dt * 1.5);
    energy += (Math.min(1, Math.max(0, (rpm - 35) / 75)) - energy) * Math.min(1, dt * 0.8);

    if (nextT < t - 0.5) nextT = t + 0.05;
    while (nextT < t + 0.12) {
      const spb = 60 / bpm;
      scheduleStep(nextT, step, spb);
      step++;
      if (step % 16 === 0) bar++;
      nextT += spb / 4;
    }
  }

  function sfx(name, o) {
    if (!started || muted || ctx.state !== 'running') return;
    o = o || {};
    const t = ctx.currentTime + 0.005;
    const B = sfxBus;
    switch (name) {
      case 'catch': {
        const base = 72 + Math.min(12, (o.combo || 0));
        [0, 4, 7, 12].forEach((iv, i) => tone(mtof(base + iv), t + i * 0.045, 0.16, 'triangle', 0.22, B));
        noiseHit(t, 0.08, 2500, 0.1, B);
        break;
      }
      case 'gold':
        [0, 7, 12, 16, 19, 24].forEach((iv, i) => {
          tone(mtof(84 + iv), t + i * 0.06, 0.6, 'sine', 0.14, B);
          tone(mtof(84 + iv) * 2.76, t + i * 0.06, 0.3, 'sine', 0.03, B);
        });
        break;
      case 'gulp':
        tone(300, t, 0.18, 'sine', 0.25, B, { to: 90 });
        break;
      case 'jump':
        noiseHit(t, 0.3, 900, 0.18, B, 'bandpass', 0.6);
        tone(220, t, 0.22, 'sine', 0.12, B, { to: 520 });
        break;
      case 'land':
        tone(130, t, 0.2, 'sine', 0.4 * (o.v || 1), B, { to: 45 });
        noiseHit(t, 0.12, 400, 0.25 * (o.v || 1), B, 'lowpass');
        break;
      case 'hit':
        tone(90, t, 0.3, 'square', 0.22, B, { to: 40, lp: 500 });
        noiseHit(t, 0.25, 1200, 0.3, B, 'bandpass', 0.5);
        tone(1400, t + 0.05, 0.05, 'square', 0.06, B);
        tone(1700, t + 0.12, 0.05, 'square', 0.06, B);
        break;
      case 'jumpover':
        tone(mtof(79), t, 0.12, 'triangle', 0.15, B);
        tone(mtof(86), t + 0.08, 0.2, 'triangle', 0.15, B);
        break;
      case 'lane':
        noiseHit(t, 0.12, 1400 + Math.random() * 400, 0.07, B, 'bandpass', 1.5);
        break;
      case 'wing':
        for (let i = 0; i < 3; i++) noiseHit(t + i * 0.09, 0.08, 500, 0.14, B, 'bandpass', 0.8);
        break;
      case 'bell':
        [0, 0.22].forEach((d) => {
          tone(2350, t + d, 0.5, 'sine', 0.12, B);
          tone(2350 * 2.4, t + d, 0.25, 'sine', 0.03, B);
        });
        break;
      case 'ach': {
        const seq = [72, 76, 79, 84, 79, 84, 88];
        seq.forEach((m, i) => tone(mtof(m), t + i * 0.08, 0.35, 'triangle', 0.15, B));
        [72, 76, 79].forEach((m) => tone(mtof(m), t + 0.56, 0.9, 'sawtooth', 0.04, B, { lp: 2000, a: 0.02 }));
        break;
      }
      case 'ui':
        tone(880, t, 0.06, 'sine', 0.1, B);
        break;
    }
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  PB.Audio = { init, update, sfx, setMuted, get muted() { return muted; }, get bpm() { return bpm; } };
})();
