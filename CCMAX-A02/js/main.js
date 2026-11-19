(function () {
  const PB = window.PB;
  const { Sky, Ocean, Road, Spawn, Pelican, Scarf, Cams, UI, Audio, LANES } = PB;
  const V = THREE.Vector3;

  const canvas = document.getElementById('gl');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.getElementById('start').querySelector('p').textContent = '你的浏览器不支持 WebGL，无法运行此演示。';
    return;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);

  const QUALITY = [
    { name: '低', dpr: 0.75, shadow: false, detail: 0, scarf: 0 },
    { name: '中', dpr: 1, shadow: true, detail: 0.6, scarf: 1 },
    { name: '高', dpr: 1.5, shadow: true, detail: 1, scarf: 1 },
    { name: '极高', dpr: 2, shadow: true, detail: 1, scarf: 1 }
  ];
  let qi = Math.min(window.devicePixelRatio || 1, 2) > 1.4 ? 2 : 1;
  if (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) qi = 1;

  Sky.init(scene);
  Ocean.init(scene);
  Road.init(scene, QUALITY[qi].scarf);
  Spawn.init(scene);
  Pelican.init(scene);
  Scarf.init(scene, QUALITY[qi].scarf);
  Cams.init(camera);

  const headLight = new THREE.SpotLight(0xfff0d0, 0, 26, 0.5, 0.6, 1.5);
  scene.add(headLight, headLight.target);

  function applyQuality() {
    const q = QUALITY[qi];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.dpr));
    if (renderer.shadowMap.enabled !== q.shadow) {
      renderer.shadowMap.enabled = q.shadow;
      Sky.sunLight.castShadow = q.shadow;
      scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    Scarf.setQuality(q.scarf);
    resize();
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (Spawn.P) Spawn.P.mat.uniforms.uScale.value = h * renderer.getPixelRatio() * 0.6;
  }
  addEventListener('resize', resize);

  const S = {
    time: 0, dist: 0, speed: 8, x: 0, vx: 0, lane: 1, y: 0, vy: 0, airborne: false,
    lean: 0, steer: 0, pitch: 0, wing: 0, look: 0, headYaw: 0, crank: 0, rpm: 0, open: 0,
    score: 0, fish: 0, combo: 0, comboT: 0, hitT: 0, night: 0,
    auto: false, idle: 0, crabsJumped: 0, wheelieT: 0, camsUsed: new Set([0]),
    paused: true, rate: 1
  };
  const input = { up: false, down: false, wing: false };
  const touch = { up: false, down: false, wing: false };

  const MIN_SP = 3, MAX_SP = 14.5, CRUISE = 8.5;

  function changeLane(d) {
    const nl = Math.max(0, Math.min(2, S.lane + d));
    if (nl !== S.lane) { S.lane = nl; Audio.sfx('lane'); }
  }
  function jump() {
    if (S.airborne) return;
    S.vy = 6.4; S.airborne = true;
    Audio.sfx('jump');
  }
  function setCam(i) {
    Cams.set(i);
    UI.setCam(Cams.name);
    S.camsUsed.add(Cams.mode);
    if (S.camsUsed.size >= 5) ach('director');
    Audio.sfx('ui');
  }
  const RATES = [1, 4, 12];
  function cycleRate() {
    const i = (RATES.indexOf(S.rate) + 1) % RATES.length;
    S.rate = RATES[i]; Sky.rate = S.rate;
    UI.setRate(S.rate);
    Audio.sfx('ui');
  }
  function toggleMute() { Audio.setMuted(!Audio.muted); UI.setMute(Audio.muted); }
  function ach(id) { if (UI.unlock(id)) Audio.sfx('ach'); }

  function wake() { S.idle = 0; if (S.auto) S.auto = false; }

  const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyT: 'wing' };
  addEventListener('keydown', (e) => {
    if (!UI.started) { if (e.code === 'Enter' || e.code === 'Space') { document.getElementById('bGo').click(); e.preventDefault(); } return; }
    if (e.code === 'Escape' && UI.achOpen) { UI.toggleAch(false); return; }
    if (e.code === 'KeyH') { UI.toggleAch(); return; }
    if (UI.achOpen) return;
    Audio.init();
    wake();
    const k = KEYMAP[e.code];
    if (k) { input[k] = true; if (k === 'wing' && !e.repeat) Audio.sfx('wing'); e.preventDefault(); return; }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyA': case 'ArrowLeft': changeLane(-1); break;
      case 'KeyD': case 'ArrowRight': changeLane(1); break;
      case 'Space': jump(); e.preventDefault(); break;
      case 'KeyC': setCam(Cams.mode + 1); break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
        setCam(+e.code.slice(5) - 1); break;
      case 'KeyN': cycleRate(); break;
      case 'KeyM': toggleMute(); break;
      case 'KeyB': Audio.sfx('bell'); break;
    }
  });
  addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
  addEventListener('blur', () => { input.up = input.down = input.wing = false; });

  UI.init({
    start() { Audio.init(); S.paused = false; UI.setCam(Cams.name); },
    cam() { setCam(Cams.mode + 1); },
    time: cycleRate,
    mute: () => { Audio.init(); toggleMute(); },
    pause(p) { S.paused = p || !UI.started; },
    touch(k, on) {
      Audio.init();
      wake();
      if (k === 'left' && on) changeLane(-1);
      else if (k === 'right' && on) changeLane(1);
      else if (k === 'jump' && on) jump();
      else if (k in touch) { touch[k] = on; if (k === 'wing' && on) Audio.sfx('wing'); }
    }
  });

  let swipe = null;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!swipe || !UI.started) return;
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    Audio.init(); wake();
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) changeLane(dx > 0 ? 1 : -1);
    else if (dy < -40) jump();
    swipe = null;
  });

  function autopilot(dt) {
    const T = Spawn.nearestTargets(S.dist);
    let want = 1, wantSp = CRUISE + 1.5, doJump = false, doWing = false;
    const crab = T.crabs.find((c) => c.s - S.dist < 12);
    const fish = T.fish.find((f) => f.s - S.dist > 1.5 && f.s - S.dist < 55 && !(f.high && f.s - S.dist < 3));
    if (fish) {
      want = fish.lane;
      if (fish.gold) wantSp = MAX_SP;
      if (fish.high) {
        const tti = (fish.s - S.dist) / Math.max(S.speed, 1);
        if (tti < 0.42 && tti > 0.2) doJump = true;
      }
    }
    if (crab) {
      const tti = (crab.s - S.dist) / Math.max(S.speed, 1);
      const lx = LANES[S.lane];
      if (Math.abs(crab.x - lx) < 1.4 && tti < 0.36 && tti > 0.08) doJump = true;
    }
    if (want !== S.lane && Math.random() < dt * 6) changeLane(want > S.lane ? 1 : -1);
    if (doJump) jump();
    if (!fish && !crab && Math.sin(S.time * 0.21) > 0.93) doWing = true;
    return { up: S.speed < wantSp - 0.5, down: S.speed > wantSp + 1.5, wing: doWing };
  }

  const tmpV = new V(), mouthV = new V(), anchorV = new V(), bodyCV = new V();
  const frame = { fwd: new V(), right: new V(), up: new V(), q: new THREE.Quaternion() };

  function project(p) {
    tmpV.copy(p).project(camera);
    return [(tmpV.x * 0.5 + 0.5) * innerWidth, (-tmpV.y * 0.5 + 0.5) * innerHeight];
  }

  let seenNight = false;
  Sky.onShootingStar = () => { if (UI.started && !S.paused) ach('meteor'); };

  function updateScarf(dt, sp) {
    const qn = Pelican.root.quaternion;
    frame.q.copy(qn);
    frame.fwd.set(0, 0, -1).applyQuaternion(qn);
    frame.right.set(1, 0, 0).applyQuaternion(qn);
    frame.up.set(0, 1, 0).applyQuaternion(qn);
    Pelican.anchorWorld(anchorV);
    Pelican.body.getWorldPosition(bodyCV);
    const speed = sp === undefined ? S.speed + Math.max(0, -S.vy) * 0.3 : sp;
    Scarf.update(dt, anchorV, frame, speed, S.time, 0, { c: bodyCV, r: 0.34 });
  }

  function step(dt) {
    S.time += dt;
    S.idle += dt;
    if (!S.auto && S.idle > 6) S.auto = true;

    const ctrl = S.auto ? autopilot(dt)
      : { up: input.up || touch.up, down: input.down || touch.down, wing: input.wing || touch.wing };

    let acc = 0;
    if (ctrl.up) acc = 3.4 * (1 - S.speed / (MAX_SP + 1));
    else if (ctrl.down) acc = -7;
    else acc = (CRUISE - S.speed) * 0.25;
    if (ctrl.wing) acc -= 0.6;
    if (S.hitT > 0) acc -= 3;
    S.speed = Math.max(MIN_SP, Math.min(MAX_SP, S.speed + acc * dt));
    const dz = S.speed * dt;
    S.dist += dz;

    const coastOn = S.airborne || ctrl.down;
    const targetRpm = coastOn ? 0 : 38 + S.speed * 6.2 + (ctrl.up ? 12 : 0);
    S.rpm += (targetRpm - S.rpm) * Math.min(1, dt * 3);
    S.crank += (S.rpm / 60) * Math.PI * 2 * dt;

    const tx = LANES[S.lane];
    const k = 60, c = 12;
    const ax = (tx - S.x) * k - S.vx * c;
    S.vx += ax * dt;
    S.x += S.vx * dt;
    S.steer = Math.max(-1, Math.min(1, S.vx / 6));
    S.lean += (S.steer * 0.32 - S.lean) * Math.min(1, dt * 8);

    if (S.airborne) {
      S.vy -= 17 * dt;
      S.y += S.vy * dt;
      if (S.y <= 0) {
        const v = Math.min(1, -S.vy / 8);
        S.y = 0; S.vy = 0; S.airborne = false;
        Audio.sfx('land', { v });
        Cams.kick(0.2 * v);
        Spawn.P.emit(S.x, 0.05, 0.5, 8, { color: 0xc8b89a, speed: 1.5, up: 0.6, life: 0.5, size: 0.1 });
      }
    }

    S.wing += ((ctrl.wing ? 1 : 0) - S.wing) * Math.min(1, dt * 6);
    const wantPitch = ctrl.wing ? 0.42 + Math.sin(S.time * 7) * 0.03 : 0;
    S.pitch += (wantPitch - S.pitch) * Math.min(1, dt * (ctrl.wing ? 4 : 7));
    if (ctrl.wing && S.pitch > 0.3 && !S.airborne) {
      S.wheelieT += dt;
      if (S.wheelieT > 3) ach('wheelie');
    } else S.wheelieT = 0;

    S.look = S.airborne ? 0.4 : 0;
    S.headYaw = Math.sin(S.time * 0.37) * 0.15 * (S.auto ? 1 : 0.4);
    S.open += ((S.airborne ? 1 : 0) - S.open) * Math.min(1, dt * 6);
    S.hitT = Math.max(0, S.hitT - dt);

    if (S.combo > 0) {
      S.comboT -= dt / 4.5;
      if (S.comboT <= 0) { S.combo = 0; S.comboT = 0; }
    }

    S.night = Sky.night;
    if (S.speed * 3.6 >= 45) ach('speed');
    if (S.dist >= 1000) ach('km');
    if (Sky.night > 0.8 && !seenNight) { seenNight = true; ach('night'); }

    Pelican.update(dt, S);
    Pelican.root.updateMatrixWorld(true);
    Pelican.mouthWorld(mouthV);

    Spawn.update(dt, S.dist, dz, S.time, { x: S.x, y: S.y, mouth: mouthV }, {
      caught(f, z) {
        S.fish++;
        S.combo++; S.comboT = 1;
        const mult = Math.min(S.combo, 10);
        let pts = (f.gold ? 500 : f.high ? 150 : 100) * mult;
        if (S.airborne) pts = Math.round(pts * 1.5);
        S.score += pts;
        Pelican.gulp();
        Audio.sfx(f.gold ? 'gold' : 'catch', { combo: S.combo });
        Audio.sfx('gulp');
        const [px, py] = project(mouthV);
        UI.float('+' + pts + (S.combo > 1 ? `  ×${mult}` : ''), px, py - 30, f.gold ? 'gold' : '');
        Cams.kick(f.gold ? 0.35 : 0.08);
        ach('first');
        if (S.fish >= 25) ach('fish25');
        if (S.combo >= 5) ach('combo5');
        if (S.combo >= 12) ach('combo12');
        if (f.gold) ach('gold');
        if (f.high) ach('flyfish');
        if (S.airborne) ach('air');
      },
      jumped(c) {
        S.crabsJumped++;
        S.score += 50;
        Audio.sfx('jumpover');
        const [px, py] = project(tmpV.set(c.x, 0.6, 0));
        UI.float('+50 跨栏', px, py - 40);
        if (S.crabsJumped >= 3) ach('crab3');
      },
      hit(c) {
        S.hitT = 0.8;
        S.combo = 0; S.comboT = 0;
        S.speed = Math.max(MIN_SP, S.speed * 0.55);
        Audio.sfx('hit');
        Cams.kick(0.6);
        const [px, py] = project(tmpV.set(c.x, 0.8, 0));
        UI.float('哎哟！🦀', px, py - 40, 'bad');
      }
    });

    updateScarf(dt);

    Road.update(dt, S.dist, Sky.night, S.time, Sky.hemi.color);
    Ocean.update(S.dist, Sky.hemi.color, Sky.sunLight.color.clone().multiplyScalar(Sky.sunLight.intensity), QUALITY[qi].detail);

    headLight.intensity = Sky.night * 2.2;
    Pelican.frontAssy.getWorldPosition(headLight.position);
    headLight.position.y -= 0.05;
    headLight.target.position.set(S.x + S.steer * 1.5, 0, -14);

    Audio.update(dt, { speed: S.speed, rpm: S.rpm, airborne: S.airborne, night: Sky.night });
  }

  let last = performance.now();
  let fpsAcc = 0, fpsN = 0, fpsT = 0, lowStreak = 0, highStreak = 0, qCool = 3;
  let rendered = 0;

  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt <= 0) return;
    dt = Math.min(dt, 0.05);

    if (!S.paused) step(dt);
    else {
      S.time += dt * 0.3;
      Pelican.update(0, Object.assign({}, S, { speed: 0 }));
      Pelican.root.updateMatrixWorld(true);
      updateScarf(dt * (UI.started ? 0 : 1), 5);
      Road.update(dt, S.dist, Sky.night, S.time, Sky.hemi.color);
      Ocean.update(S.dist, Sky.hemi.color, Sky.sunLight.color.clone().multiplyScalar(Sky.sunLight.intensity), QUALITY[qi].detail);
    }

    const sfoc = tmpV.set(S.x, 1, -2);
    Sky.update(S.paused && UI.started ? 0 : dt * (UI.started ? 1 : 0.5), sfoc, camera.position);
    Cams.update(dt, S, Pelican);
    renderer.render(scene, camera);
    rendered++;

    fpsAcc += dt; fpsN++; fpsT += dt;
    if (fpsT >= 1) {
      const fps = fpsN / fpsAcc;
      fpsAcc = 0; fpsN = 0; fpsT = 0;
      qCool--;
      if (!document.hidden && qCool <= 0) {
        if (fps < 45) { lowStreak++; highStreak = 0; } else if (fps > 58) { highStreak++; lowStreak = 0; } else { lowStreak = highStreak = 0; }
        if (lowStreak >= 2 && qi > 0) { qi--; applyQuality(); lowStreak = 0; qCool = 4; }
        else if (highStreak >= 6 && qi < QUALITY.length - 1 && QUALITY[qi + 1].dpr <= (window.devicePixelRatio || 1) + 0.01) {
          qi++; applyQuality(); highStreak = 0; qCool = 6;
        }
      }
      UI.setQ(`画质 ${QUALITY[qi].name} · ${Math.round(fps)} FPS`);
    }

    if (UI.started) UI.hud({
      score: S.score, fish: S.fish, combo: S.combo, comboT: S.comboT, speed: S.speed, rpm: S.rpm, dist: S.dist,
      icon: Sky.icon, phase: Sky.phase, clock: Sky.clockText(), auto: S.auto
    });
  }

  applyQuality();
  window.__pb = { S, Sky, Cams, renderer, scene };
  requestAnimationFrame(loop);
})();
