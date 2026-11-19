(function () {
  const $ = (id) => document.getElementById(id);
  const W = PG.W;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x88aacc, 0.0035);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2000);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 40 });
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);
  const lampLight = new THREE.PointLight(0xffb870, 0, 16, 1.6);
  scene.add(lampLight);

  PG.Sky.create(scene);
  PG.Ocean.create(scene);
  PG.Scenery.create(scene);
  const pel = PG.Pelican.create(scene);
  const scarf = PG.Scarf(scene, { cols: 4, rows: 22, seg: 0.05, floorY: 0.02 });
  PG.Entities.create(scene);
  PG.Cam.create(camera, pel);

  const shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.35 }));
  shadowCatcher.rotation.x = -Math.PI / 2; shadowCatcher.position.y = 0.006; shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);
  pel.root.traverse(o => { if (o.isMesh && o !== pel.shadow) o.castShadow = true; });

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    PG.Ocean.Spray.setScale(h * renderer.getPixelRatio() * 0.5);
  }
  addEventListener('resize', resize);

  const Q = ['high', 'mid', 'low'], QN = { high: '高', mid: '中', low: '低' };
  let qi = 0;
  function applyQuality(i) {
    qi = i;
    const q = Q[i];
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q === 'high' ? 2 : q === 'mid' ? 1.25 : 0.85));
    PG.Ocean.setQuality(q);
    scarf.setQuality(q);
    sun.castShadow = q !== 'low';
    shadowCatcher.visible = q !== 'low';
    pel.shadow.visible = q === 'low';
    $('q').textContent = QN[q];
    resize();
  }
  applyQuality(matchMedia('(pointer:coarse)').matches ? 1 : 0);

  const keys = {}, pressed = {};
  let lastInput = -10;
  const KM = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'jump', KeyT: 'wing', KeyC: 'cam', KeyJ: 'ach', KeyM: 'mute', KeyN: 'ff' };
  function press(k) { if (!keys[k]) pressed[k] = true; keys[k] = true; if (k !== 'cam' && k !== 'ach' && k !== 'mute' && k !== 'ff') lastInput = G.time; startAudio(); }
  function release(k) { keys[k] = false; }
  addEventListener('keydown', (e) => {
    if (/^Digit[1-5]$/.test(e.code)) { setCam(+e.code[5] - 1); startAudio(); return; }
    const k = KM[e.code]; if (!k) return;
    e.preventDefault();
    if (e.repeat) return;
    press(k);
  });
  addEventListener('keyup', (e) => { const k = KM[e.code]; if (k) release(k); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  if (matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window) $('touch').classList.add('show');
  for (const b of document.querySelectorAll('#touch .tb')) {
    const k = b.dataset.k;
    const down = (e) => { e.preventDefault(); b.classList.add('on'); press(k); };
    const up = (e) => { e.preventDefault(); b.classList.remove('on'); release(k); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }

  let audioOn = false;
  function startAudio() { if (!audioOn) { audioOn = true; PG.Audio.start(); } }
  $('go').addEventListener('click', () => {
    $('start').classList.add('hide'); startAudio();
    G.running = true; lastInput = G.time;
    G.score = 0; G.fish = 0; G.combo = 0; G.autoFish = 0;
  });
  $('closePanel').addEventListener('click', () => togglePanel(false));
  function togglePanel(v) { $('panel').classList.toggle('hide', !v); }

  const G = {
    running: false, time: 0, dist: 0, speed: 9, lane: 1, x: 0, vx: 0, y: 0, vy: 0, air: false,
    wheelie: 0, wheelieT: 0, wingAmt: 0, crank: 0, wheelRot: 0, rpm: 0,
    score: 0, fish: 0, totalFish: 0, combo: 0, comboT: 0, pouch: 0, gulpT: 0, beakOpen: 0,
    dayT: 0.02, auto: false, autoFish: 0, autoLane: 1, autoNextJump: 0, autoWheelie: 0, bump: 0,
    camsUsed: new Set([0]), headYaw: 0, headPitch: 0, lean: 0,
  };
  try { G.totalFish = +localStorage.getItem('pelican_total') || 0; } catch (e) {}
  const DAY_LEN = 300, VMAX = 16, VMIN = 3;
  const unlock = (id) => G.running && PG.Ach.unlock(id);

  function setCam(m) {
    PG.Cam.setMode(m);
    G.camsUsed.add(m);
    $('camTag').textContent = PG.Cam.names[m];
    if (G.camsUsed.size >= 5) unlock('cams');
  }

  PG.Ach.init((a) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${a.ic} 成就解锁：<b>${a.n}</b> · ${a.d}`;
    $('toasts').appendChild(t);
    setTimeout(() => t.remove(), 3900);
    if (audioOn) PG.Audio.sfx.achieve();
  });

  const v3 = new THREE.Vector3();
  function popAt(worldPos, text, cls) {
    v3.copy(worldPos).project(camera);
    if (v3.z > 1) return;
    const el = document.createElement('div');
    el.className = 'pop' + (cls ? ' ' + cls : '');
    el.textContent = text;
    el.style.left = ((v3.x * 0.5 + 0.5) * innerWidth) + 'px';
    el.style.top = ((-v3.y * 0.5 + 0.5) * innerHeight) + 'px';
    $('pops').appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  const tip = new THREE.Vector3();
  function catchFish(f) {
    f.caught = true; f.ct = 0; f.target = pel.beakTip(new THREE.Vector3()).clone();
    G.combo++; G.comboT = 3;
    G.fish++;
    if (G.running) { G.totalFish++; try { localStorage.setItem('pelican_total', G.totalFish); } catch (e) {} }
    const mult = 1 + Math.min(G.combo - 1, 9) * 0.5;
    let pts = Math.round((f.golden ? 500 : 100) * mult * (G.air ? 1.5 : 1));
    G.score += pts;
    G.pouch++; G.beakOpen = 1;
    pel.setPouchFish(G.pouch);
    popAt(f.obj.position, (f.golden ? '金鱼 ' : '') + '+' + pts + (G.combo > 1 ? ` ×${G.combo}` : ''), f.golden ? 'gold' : '');
    if (audioOn) { f.golden ? PG.Audio.sfx.golden() : PG.Audio.sfx.catch(G.combo); }
    if (G.pouch >= 4) { G.gulpT = 0.6; G.pouch = 0; if (audioOn) PG.Audio.sfx.gulp(); }
    if (G.auto) { G.autoFish++; if (G.autoFish >= 10) unlock('autopilot'); }
    unlock('first_fish');
    if (G.totalFish >= 25) unlock('fish_25');
    if (G.totalFish >= 100) unlock('fish_100');
    if (G.combo >= 5) unlock('combo_5');
    if (G.combo >= 12) unlock('combo_12');
    if (f.golden) unlock('golden');
    if (G.air && f.high) unlock('airfish');
    if (PG.Sky.state.night > 0.7) unlock('night');
  }

  function hitObstacle(o) {
    o.hit = true; o.knock = 0.001; o.side = o.cx < G.x ? -1 : 1;
    G.speed *= 0.45; G.bump = 0.5;
    if (G.combo > 1) popAt(pel.root.position.clone().setY(1.8), '连击中断', 'bad');
    G.combo = 0;
    if (audioOn) PG.Audio.sfx.bump();
  }

  function autopilot(dt) {
    const fishL = PG.Entities.fish, obs = PG.Entities.obs;
    const score = [0, 0, 0];
    for (const f of fishL) {
      if (f.caught || f.z > -1 || f.z < -40) continue;
      const w = (f.golden ? 4 : 1) / (1 + (-f.z) * 0.08);
      score[f.lane] += w;
    }
    for (const o of obs) {
      if (o.hit || o.z > 0 || o.z < -22) continue;
      score[o.lane] -= 1.2 / (1 + (-o.z) * 0.15);
    }
    for (let l = 0; l < 3; l++) score[l] -= Math.abs(l - G.lane) * 0.05;
    let best = G.lane;
    for (let l = 0; l < 3; l++) if (score[l] > score[best] + 0.05) best = l;
    if (best !== G.lane) G.lane += Math.sign(best - G.lane);
    let want = 12;
    for (const o of obs) if (!o.hit && o.lane === G.lane && o.z < 0 && o.z > -10) want = 10;
    G.speed += Math.sign(want - G.speed) * Math.min(Math.abs(want - G.speed), 4 * dt);
    if (!G.air) {
      const lead = 0.38 * G.speed;
      let jump = false;
      for (const f of fishL) if (!f.caught && f.high && Math.abs(f.x - G.x) < 0.9 && f.z < -lead + 0.6 && f.z > -lead - 1.4) jump = true;
      for (const o of obs) if (!o.hit && Math.abs(o.cx - G.x) < 0.7 && o.z < -lead * 0.55 && o.z > -lead * 0.55 - 1.2) jump = true;
      if (jump) doJump();
    }
    G.autoWheelie -= dt;
    if (G.autoWheelie < -9 && !G.air && Math.random() < dt * 0.3) G.autoWheelie = 1.6 + Math.random();
  }

  function doJump() {
    if (G.air) return;
    G.air = true; G.vy = 5.2 + G.speed * 0.05;
    if (audioOn) PG.Audio.sfx.jump();
  }

  const pins = [0, 1, 2, 3].map(() => new THREE.Vector3());
  const frameVel = new THREE.Vector3(), wind = { x: 0, y: 0, z: 0 };
  const fogCol = new THREE.Color(), ambC = new THREE.Color(), tmpC = new THREE.Color();
  let fpsAcc = 0, fpsN = 0, fpsShown = 60, qTimer = 0, hudT = 0, lastTimeName = '';

  function step(dt) {
    G.time += dt;
    const idle = G.time - lastInput > 4;
    if (G.running && idle !== G.auto) {
      G.auto = idle;
      $('autoTag').style.display = idle ? '' : 'none';
      if (!idle) G.autoFish = 0;
    }
    if (!G.running) G.auto = true;

    if (pressed.cam) setCam((PG.Cam.mode + 1) % 5);
    if (pressed.ach) togglePanel($('panel').classList.contains('hide'));
    if (pressed.mute) { PG.Audio.setMuted(!PG.Audio.muted); $('bM').classList.toggle('on', PG.Audio.muted); }

    let wingHeld = !!keys.wing;
    if (G.auto) {
      autopilot(dt);
      wingHeld = G.autoWheelie > 0;
    } else {
      if (pressed.left) G.lane = Math.max(0, G.lane - 1);
      if (pressed.right) G.lane = Math.min(2, G.lane + 1);
      if (pressed.jump) doJump();
      if (keys.up) G.speed += 5.5 * dt;
      else if (keys.down) G.speed -= 9 * dt;
      else G.speed += (9 - G.speed) * 0.15 * dt;
    }
    if (pressed.wing && audioOn) PG.Audio.sfx.wing();
    if (keys.ff) G.dayT += dt / DAY_LEN * 12;
    for (const k in pressed) pressed[k] = false;

    G.speed = Math.max(VMIN, Math.min(VMAX, G.speed - (wingHeld ? 0.6 * dt : 0)));
    G.dist += G.speed * dt;
    G.dayT += dt / DAY_LEN;

    const tx = W.LANES[G.lane];
    const ax = (tx - G.x) * 42 - G.vx * 11;
    G.vx += ax * dt; G.x += G.vx * dt;
    G.lean += ((-G.vx * 0.09 - ax * 0.004) - G.lean) * Math.min(1, dt * 8);
    G.lean = Math.max(-0.4, Math.min(0.4, G.lean));

    if (G.air) {
      G.vy -= 14 * (wingHeld && G.vy < 0 ? 0.45 : 1) * dt;
      G.y += G.vy * dt;
      if (G.y <= 0) {
        G.y = 0; G.air = false;
        if (audioOn) PG.Audio.sfx.land(Math.min(1, -G.vy / 7));
        G.bump = Math.min(0.4, -G.vy * 0.05);
        G.vy = 0;
      }
    }
    const wantW = wingHeld && !G.air ? 1 : 0;
    G.wheelie += (wantW - G.wheelie) * Math.min(1, dt * (wantW ? 4 : 6));
    G.wingAmt += ((wingHeld ? 1 : 0) - G.wingAmt) * Math.min(1, dt * 7);
    if (G.wheelie > 0.8) { G.wheelieT += dt; if (G.wheelieT >= 3) unlock('wheelie'); } else G.wheelieT = 0;

    G.wheelRot += G.speed * dt / PG.Pelican.R;
    const pedal = G.air ? 0.25 : 1;
    G.crank += G.speed * dt / 2.8 * pedal;
    G.rpm += ((G.air ? 0 : G.speed / 2.8 * 60 / (Math.PI * 2) * 2.2) - G.rpm) * Math.min(1, dt * 3);

    G.bump = Math.max(0, G.bump - dt);
    G.comboT -= dt;
    if (G.comboT <= 0 && G.combo) G.combo = 0;
    G.beakOpen = Math.max(0, G.beakOpen - dt * 3);
    if (G.gulpT > 0) { const p = G.gulpT; G.gulpT -= dt; if (p > 0.3 && G.gulpT <= 0.3) pel.setPouchFish(0); }

    const kmh = G.speed * 3.6;
    if (kmh >= 55) unlock('speed');
    if (G.dist >= 1000) unlock('dist_1');
    if (G.dist >= 5000) unlock('dist_5');

    const sky = PG.Sky.update(G.dayT, G.time, camera.position);
    const name = sky.name;
    if (name !== lastTimeName) { lastTimeName = name; $('timeTag').textContent = name; }

    const difficulty = Math.min(1, G.dist / 4000);
    PG.Entities.update(dt, G.time, G.dist, G.speed, difficulty);

    pel.root.position.set(G.x, G.y + Math.sin(G.time * 40) * G.bump * 0.03, 0);
    let nearest = null, nd = 1e9;
    for (const f of PG.Entities.fish) {
      if (f.caught) continue;
      const dz = -f.z;
      if (dz > 0 && dz < 7 && Math.abs(f.x - G.x) < 1.5 && dz < nd) { nd = dz; nearest = f; }
    }
    const targetYaw = nearest ? Math.atan2(-(nearest.x - G.x), nd + 1) * 0.6 : -G.lean * 0.4;
    G.headYaw += (targetYaw - G.headYaw) * Math.min(1, dt * 6);
    const targetPitch = nearest ? Math.max(-0.3, Math.min(0.3, -(nearest.y - 1.7) * 0.25)) : 0.05;
    G.headPitch += (targetPitch - G.headPitch) * Math.min(1, dt * 5);
    if (nearest && nd < 2.2) G.beakOpen = Math.max(G.beakOpen, 1 - nd / 2.2);

    pel.update(dt, {
      crank: G.crank, wheelRot: G.wheelRot, wheelie: G.wheelie, steer: -G.vx * 0.12, lean: G.lean,
      tuck: Math.min(1, G.speed / VMAX), headPitch: G.headPitch, headYaw: G.headYaw,
      beakOpen: G.beakOpen, wing: G.wingAmt, time: G.time, gulp: G.gulpT > 0 ? Math.sin((0.6 - G.gulpT) / 0.6 * Math.PI) : 0,
    });

    pel.beakTip(tip);
    for (const f of PG.Entities.fish) {
      if (f.caught) continue;
      if (f.z > tip.z - 0.6 && f.z < tip.z + 0.5 && Math.abs(f.x - tip.x) < 0.9 && Math.abs(f.y - tip.y) < 0.6) catchFish(f);
    }
    for (const o of PG.Entities.obs) {
      if (o.hit) continue;
      if (Math.abs(o.z) < 0.9 && Math.abs(o.cx - G.x) < 0.65 && G.y < 0.35) hitObstacle(o);
    }
    if (Math.random() < dt * 0.05 && audioOn) PG.Audio.sfx.gull();

    pel.scarfPins(pins);
    frameVel.set(G.vx, G.vy, -G.speed);
    wind.x = -G.vx * 0.5 + 0.8; wind.y = -G.vy * 0.4; wind.z = G.speed;
    scarf.update(dt, pins, wind, frameVel.set(0, 0, 0), pel.colliders());

    PG.Scenery.update(dt, G.dist, G.time, sky);
    const U = PG.U;
    U.uDist.value = G.dist; U.uTime.value = G.time;
    U.uLightDir.value.copy(sky.lightDir);
    U.uLightCol.value.copy(sky.light).multiplyScalar(sky.li);
    U.uAmbS.value.copy(sky.hs).multiplyScalar(sky.hi);
    U.uAmbG.value.copy(sky.hg).multiplyScalar(sky.hi);
    U.uLamps.value = sky.lamps; U.uNight.value = sky.night;
    fogCol.copy(sky.hor).lerp(sky.zen, 0.25);
    const fd = 0.0032 + sky.night * 0.0016;
    scene.fog.color.copy(fogCol); scene.fog.density = fd;
    U.uFogColor.value.copy(fogCol); U.uFogDensity.value = fd;

    const headOn = Math.max(sky.lamps, sky.night);
    pel.headLight.intensity = headOn * 18;
    pel.lampGlow.material.opacity = headOn * 0.9;
    pel.headLight.getWorldPosition(U.uHeadPos.value);
    pel.headLight.target.getWorldPosition(v3);
    U.uHeadDir.value.copy(v3).sub(U.uHeadPos.value).normalize();
    U.uHeadOn.value = headOn;

    hemi.color.copy(sky.hs); hemi.groundColor.copy(sky.hg); hemi.intensity = sky.hi * Math.PI;
    sun.color.copy(sky.light); sun.intensity = sky.li * Math.PI;
    sun.position.copy(sky.lightDir).multiplyScalar(20).add(pel.root.position);
    sun.target.position.copy(pel.root.position);
    shadowCatcher.position.x = G.x;
    shadowCatcher.material.opacity = 0.35 * Math.min(1, sky.li * 1.5);

    const lampD = Math.round(G.dist / 40) * 40;
    lampLight.position.set(3.0, 6.3, G.dist - lampD);
    lampLight.intensity = sky.lamps * 40;

    ambC.copy(sky.hs).multiplyScalar(sky.hi);
    PG.Ocean.update(G.time, G.dist, sky, { color: fogCol, density: fd }, ambC);
    tmpC.copy(sky.light).multiplyScalar(0.4 + sky.li * 0.5).add(ambC);
    tmpC.r = Math.min(1, tmpC.r + 0.15); tmpC.g = Math.min(1, tmpC.g + 0.15); tmpC.b = Math.min(1, tmpC.b + 0.18);
    PG.Ocean.Spray.update(dt, G.dist, G.time, tmpC);

    PG.Cam.update(dt, { speed: G.speed, time: G.time, lean: G.lean, headYaw: G.headYaw });

    if (audioOn) PG.Audio.update(dt, { night: sky.night, speed: G.speed, rpm: G.rpm, air: G.air, time: G.time });

    hudT -= dt;
    if (hudT <= 0) {
      hudT = 0.1;
      $('score').textContent = G.score.toLocaleString();
      $('fish').textContent = G.fish;
      $('combo').textContent = G.combo > 1 ? `连击 ×${G.combo}` : '';
      $('spd').textContent = Math.round(kmh);
      $('dist').textContent = (G.dist / 1000).toFixed(2);
      $('rpm').textContent = Math.round(G.rpm);
      $('bpm').textContent = audioOn ? Math.round(PG.Audio.bpm) : '—';
    }
  }

  function adaptQuality(dt) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) {
      fpsShown = fpsN / fpsAcc;
      $('fps').textContent = Math.round(fpsShown);
      fpsAcc = 0; fpsN = 0;
      if (fpsShown < 42 && qi < 2) { qTimer++; if (qTimer >= 2) { applyQuality(qi + 1); qTimer = -2; } }
      else if (fpsShown > 57 && qi > 0) { qTimer--; if (qTimer <= -6) { applyQuality(qi - 1); qTimer = 0; } }
      else if (qTimer > 0) qTimer = 0;
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) return;
    step(dt);
    adaptQuality(dt);
    renderer.render(scene, camera);
  }
  PG.Game = G;
  requestAnimationFrame(frame);
})();
