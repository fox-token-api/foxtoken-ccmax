(function () {
const PK = window.PK = window.PK || {};

PK.createAudio = function () {
  const A = { ready: false, muted: false };
  let ctx, master, musicBus, sfxBus, windGain, windFilter, surfGain, surfFilter, chainGain, delay, fb;
  let nextBeat = 0, step = 0, bar = 0, beatLen = 0.5;
  let cadence = 60, nightAmt = 0;

  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  const PROG = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 65]];
  const BASS = [45, 41, 36, 43];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function noiseBuf(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
    return b;
  }
  let nbuf;
  function loopNoise() {
    const s = ctx.createBufferSource(); s.buffer = nbuf; s.loop = true; s.start(); return s;
  }

  A.init = function () {
    if (ctx) { ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    delay = ctx.createDelay(1.5); delay.delayTime.value = 0.375;
    fb = ctx.createGain(); fb.gain.value = 0.32;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(musicBus);
    nbuf = noiseBuf(3);

    const wn = loopNoise();
    windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.7;
    windGain = ctx.createGain(); windGain.gain.value = 0;
    wn.connect(windFilter); windFilter.connect(windGain); windGain.connect(sfxBus);

    const sn = loopNoise();
    surfFilter = ctx.createBiquadFilter(); surfFilter.type = 'lowpass'; surfFilter.frequency.value = 600;
    surfGain = ctx.createGain(); surfGain.gain.value = 0.05;
    sn.connect(surfFilter); surfFilter.connect(surfGain); surfGain.connect(sfxBus);

    const cn = loopNoise();
    const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 5000;
    chainGain = ctx.createGain(); chainGain.gain.value = 0;
    cn.connect(cf); cf.connect(chainGain); chainGain.connect(sfxBus);

    nextBeat = ctx.currentTime + 0.1;
    A.ready = true;
  };

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(type, f, t, a, peak, d, dest, f2) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    env(g, t, a, peak, d);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + a + d + 0.05);
    return o;
  }
  function noiseHit(t, type, freq, q, peak, d, dest) {
    const s = ctx.createBufferSource(); s.buffer = nbuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, 0.002, peak, d);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 2); s.stop(t + d + 0.05);
  }

  function kick(t) { tone('sine', 140, t, 0.003, 0.9, 0.28, musicBus, 42); }
  function hat(t, v) { noiseHit(t, 'highpass', 8000, 0.7, 0.12 * v, 0.05, musicBus); }
  function snare(t) { noiseHit(t, 'bandpass', 1800, 0.8, 0.35, 0.16, musicBus); tone('triangle', 220, t, 0.002, 0.15, 0.08, musicBus, 160); }
  function bass(t, m, len) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + len);
    env(g, t, 0.01, 0.32, len);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + len + 0.1);
  }
  function pad(t, notes, len) {
    for (const m of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
        f.type = 'lowpass'; f.frequency.value = 900 + (1 - nightAmt) * 900;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.022, t + len * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, t + len);
        o.connect(f); f.connect(g); g.connect(musicBus);
        o.start(t); o.stop(t + len + 0.05);
      }
    }
  }
  function pluck(t, m, v) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = nightAmt > 0.5 ? 'sine' : 'triangle';
    o.frequency.value = mtof(m);
    env(g, t, 0.004, 0.16 * v, 0.35);
    o.connect(g); g.connect(musicBus); g.connect(delay);
    o.start(t); o.stop(t + 0.45);
  }

  function schedule() {
    const now = ctx.currentTime;
    if (nextBeat < now - 0.2) nextBeat = now + 0.05;
    while (nextBeat < now + 0.12) {
      const t = nextBeat;
      const s16 = step % 16;
      const chord = bar % 4;
      const intensity = Math.min(1, Math.max(0, (cadence - 40) / 60));
      if (s16 % 4 === 0 && (intensity > 0.05 || s16 === 0)) kick(t);
      if (s16 % 8 === 4 && intensity > 0.35) snare(t);
      if (s16 % 2 === 1 && intensity > 0.15) hat(t, 0.6 + intensity * 0.6);
      if (s16 % 2 === 0 && intensity > 0.7) hat(t, 0.4);
      if (s16 % 4 === 0 || (s16 % 4 === 3 && intensity > 0.5)) bass(t, BASS[chord] + (s16 === 12 ? 7 : 0), beatLen * 0.45);
      if (s16 === 0) pad(t, PROG[chord], beatLen * 4 * 1.05);
      const pat = [0, -1, 2, -1, 4, 3, -1, 5, 0, -1, 7, -1, 6, 4, -1, 2];
      const deg = pat[(s16 + bar * 3) % 16];
      if (deg >= 0 && (intensity > 0.25 || s16 % 4 === 0)) {
        const root = PROG[chord][0] + 12;
        pluck(t, root + SCALE[(deg + chord) % SCALE.length] - (chord === 1 ? 0 : 0), 0.6 + intensity * 0.5);
      }
      step++;
      if (step % 16 === 0) bar++;
      nextBeat += beatLen / 4;
    }
  }

  A.update = function (s) {
    if (!ctx || !A.ready) return;
    cadence = s.cadence;
    nightAmt = s.night;
    const bpm = Math.max(76, Math.min(148, 60 + cadence * 0.62));
    beatLen = 60 / bpm;
    delay.delayTime.setTargetAtTime(beatLen * 0.75, ctx.currentTime, 0.3);
    const t = ctx.currentTime;
    windGain.gain.setTargetAtTime(Math.min(0.35, s.speed * s.speed * 0.0009) * (s.cam === 4 ? 1.4 : 1), t, 0.2);
    windFilter.frequency.setTargetAtTime(300 + s.speed * 45, t, 0.2);
    const sw = 0.5 + 0.5 * Math.sin(s.t * 0.55);
    surfGain.gain.setTargetAtTime(0.035 + sw * 0.06, t, 0.3);
    surfFilter.frequency.setTargetAtTime(350 + sw * 700, t, 0.3);
    chainGain.gain.setTargetAtTime(s.coasting ? Math.min(0.03, s.speed * 0.003) : 0.004, t, 0.1);
    schedule();
  };

  A.sfx = function (name, v) {
    if (!ctx || !A.ready) return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case 'catch': {
        noiseHit(t, 'lowpass', 400, 1, 0.5, 0.12);
        tone('sine', 180, t, 0.005, 0.5, 0.18, sfxBus, 70);
        const base = 72 + Math.min(v || 0, 12);
        [0, 4, 7].forEach((d, i) => tone('triangle', mtof(base + d), t + 0.05 + i * 0.055, 0.004, 0.18, 0.22));
        break;
      }
      case 'gold':
        [0, 4, 7, 12, 16, 19].forEach((d, i) => tone('square', mtof(79 + d), t + i * 0.05, 0.003, 0.07, 0.3));
        tone('sine', 180, t, 0.005, 0.5, 0.18, sfxBus, 70);
        break;
      case 'splash': noiseHit(t, 'bandpass', 900, 0.6, 0.18, 0.35); break;
      case 'jump': tone('sine', 220, t, 0.01, 0.2, 0.18, sfxBus, 520); noiseHit(t, 'highpass', 3000, 0.5, 0.05, 0.1); break;
      case 'land': tone('sine', 90, t, 0.003, 0.5, 0.15, sfxBus, 45); noiseHit(t, 'lowpass', 600, 0.7, 0.3, 0.12); break;
      case 'lane': noiseHit(t, 'bandpass', 2400, 2, 0.05, 0.08); break;
      case 'flap': noiseHit(t, 'bandpass', 600, 0.9, 0.25, 0.14); noiseHit(t + 0.12, 'bandpass', 500, 0.9, 0.18, 0.14); break;
      case 'bonk':
        tone('square', 160, t, 0.003, 0.18, 0.2, sfxBus, 60);
        noiseHit(t, 'lowpass', 900, 1, 0.4, 0.2);
        break;
      case 'achieve':
        [0, 7, 12, 16].forEach((d, i) => tone('triangle', mtof(72 + d), t + i * 0.09, 0.005, 0.2, 0.5));
        tone('sine', mtof(96), t + 0.36, 0.005, 0.1, 0.9);
        break;
      case 'bell':
        tone('sine', 1320, t, 0.002, 0.18, 0.5); tone('sine', 1320 * 2.76, t, 0.002, 0.05, 0.3);
        tone('sine', 1320, t + 0.16, 0.002, 0.14, 0.6);
        break;
      case 'tick': tone('sine', 1800, t, 0.002, 0.05, 0.05); break;
      case 'miss': tone('triangle', 330, t, 0.005, 0.08, 0.22, sfxBus, 220); break;
    }
  };
  A.setMuted = function (m) {
    A.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
  };
  A.suspend = () => ctx && ctx.suspend();
  A.resume = () => ctx && ctx.resume();
  return A;
};
})();
