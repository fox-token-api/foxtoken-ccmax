(function () {
  const PK = window.PK;
  const U = PK.U;
  const input = PK.input;
  const LANES = PK.LANES;
  const CAMS = ['追尾', '侧拍', '航拍', '电影运镜', '鹈鹕视角'];
  const QN = ['省电', '标准', '精细', '极致'];

  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 2000);

  const sky = new PK.Sky(scene);
  const ocean = new PK.Ocean(scene);
  const world = new PK.World(scene);
  const bird = new PK.Pelican(scene);
  sky.key.castShadow = true;
  sky.key.shadow.mapSize.set(1024, 1024);
  Object.assign(sky.key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 70 });
  sky.key.shadow.bias = -0.0008;

  const g = {
    started: false, dist: 0, speed: 0, rpm: 0, crank: 0, lane: 1, x: 0, xv: 0, y: 0, vy: 0, air: false,
    wheelie: 0, spread: 0, flap: 0, wheelieT: 0, score: 0, fish: 0, combo: 0, comboT: 0, crashT: 0,
    cam: 0, camsUsed: new Set([0]), autoFish: 0, cleanDist: 0, auto: false, autoJumpCD: 0,
    q: 2, fps: 60, fpsAcc: 0, fpsN: 0, qTimer: 0, shot: 0, shotT: 0, time: 0, lookUp: 0,
  };
  let ents = [];
  let spawnAt = 40;
  const tmpV = new THREE.Vector3(), beak = new THREE.Vector3();

  function setQuality(q) {
    g.q = Math.max(0, Math.min(3, q));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ratio = [0.6, 0.85, 1, 1.25][g.q] * Math.min(dpr, 1.6);
    renderer.setPixelRatio(Math.min(ratio, dpr));
    sky.key.castShadow = g.q >= 1;
    sky.key.shadow.mapSize.setScalar(g.q >= 3 ? 2048 : 1024);
    if (sky.key.shadow.map) { sky.key.shadow.map.dispose(); sky.key.shadow.map = null; }
    resize();
  }
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const px = h * renderer.getPixelRatio();
    ocean.setPixelScale(px);
    world.bursts.mat.uniforms.uScale.value = px;
  }
  addEventListener('resize', resize);

  function spawn() {
    while (spawnAt < g.dist + 170) {
      const r = Math.random();
      const lane = Math.floor(Math.random() * 3);
      if (r < 0.62) {
        const gold = Math.random() < 0.07;
        const high = Math.random() < (gold ? 0.6 : 0.3);
        const run = Math.random() < 0.35 ? 3 : 1;
        for (let k = 0; k < run; k++) addEnt('fish', lane, spawnAt + k * 3.2, { gold: gold && k === 0, high });
        spawnAt += 8 + Math.random() * 9 + run * 3;
      } else if (r < 0.84) {
        addEnt('cone', lane, spawnAt);
        if (Math.random() < 0.3) addEnt('cone', (lane + 1 + Math.floor(Math.random() * 2)) % 3, spawnAt);
        spawnAt += 14 + Math.random() * 10;
      } else {
        addEnt('puddle', lane, spawnAt);
        spawnAt += 12 + Math.random() * 10;
      }
    }
  }
  function addEnt(type, lane, s, o = {}) {
    if (ents.some((e) => e.lane === lane && Math.abs(e.s - s) < 2.5)) return;
    const mesh = type === 'fish' ? PK.makeFish(o.gold) : type === 'cone' ? PK.makeCone() : PK.makePuddle();
    mesh.position.x = LANES[lane];
    scene.add(mesh);
    ents.push({ type, lane, s, mesh, gold: !!o.gold, high: !!o.high, ph: Math.random() * 6, hit: false, fly: null });
  }
  function removeEnt(e) {
    scene.remove(e.mesh);
    e.mesh.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    e.dead = true;
  }

  function catchFish(e) {
    bird.gulp = 1;
    world.bursts.emit(e.mesh.position, e.gold ? 40 : 18, e.gold ? 0xffd75e : 0xbfe6ff, 3, 3);
    if (!g.started) { removeEnt(e); return; }
    g.combo++;
    g.comboT = 3;
    g.fish++;
    const pts = (e.gold ? 500 : 100) * (1 + Math.min(g.combo, 20) * 0.1) * (g.air ? 1.5 : 1);
    g.score += pts;
    PK.Audio.sfx(e.gold ? 'gold' : 'catch', g.combo);
    PK.UI.addFish(1);
    PK.UI.unlock('first');
    if (e.gold) { PK.UI.unlock('gold'); PK.UI.flash('金色飞鱼！+' + Math.round(pts)); }
    else if (g.combo > 1 && g.combo % 5 === 0) PK.UI.flash('连击 ×' + g.combo);
    if (g.air) PK.UI.unlock('air');
    if (g.combo >= 10) PK.UI.unlock('combo10');
    if (g.auto && ++g.autoFish >= 10) PK.UI.unlock('auto');
    removeEnt(e);
  }

  function crash(e) {
    e.hit = true;
    e.fly = new THREE.Vector3((Math.random() - 0.5) * 6, 6, -4 - g.speed * 0.4);
    g.speed *= 0.35;
    g.crashT = 1;
    g.combo = 0;
    g.cleanDist = 0;
    g.score = Math.max(0, g.score - 50);
    PK.Audio.sfx('crash');
    PK.UI.flash('哎哟！');
  }

  function autopilot(dt) {
    let best = null, bestScore = -1e9, threat = null;
    for (const e of ents) {
      const ahead = e.s - g.dist;
      if (ahead < 1 || ahead > 60 || e.dead) continue;
      if (e.type === 'fish') {
        const sc = (e.gold ? 3 : 1) - ahead * 0.03 - Math.abs(e.lane - g.lane) * 0.25;
        if (sc > bestScore) { bestScore = sc; best = e; }
      }
    }
    const blocked = (lane, from, to) => ents.some((e) => !e.dead && !e.hit && e.type === 'cone' && e.lane === lane && e.s - g.dist > from && e.s - g.dist < to);
    let want = best ? best.lane : 1;
    g.autoLaneCD = (g.autoLaneCD || 0) - dt;
    if (want !== g.lane && g.autoLaneCD <= 0) {
      const step = want > g.lane ? 1 : -1;
      if (!blocked(g.lane + step, -1, 8)) { input.events.push(step > 0 ? 'right' : 'left'); g.autoLaneCD = 0.35; }
    }
    for (const e of ents) {
      const ahead = e.s - g.dist;
      if (e.dead || e.hit || e.lane !== g.lane || ahead < 0) continue;
      const v = g.speed;
      if (e.type === 'cone' && ahead < 0.7 + 0.4 * v && ahead > 0.7 + 0.12 * v) threat = e;
      const ideal = 1 + 0.38 * (v + 1.5);
      if (e.type === 'fish' && e.high && ahead < ideal + 0.6 && ahead > ideal - 1.5) threat = threat || e;
      if (e.type === 'puddle' && ahead < 9) g.autoT = true;
    }
    if (threat && !g.air && g.autoJumpCD <= 0) { input.events.push('jump'); g.autoJumpCD = 0.6; }
    const target = best && best.gold ? 15 : 12.5;
    return { w: g.speed < target, s: g.speed > target + 2 };
  }

  function physics(dt) {
    const idle = performance.now() / 1000 - input.last;
    g.auto = !g.started || idle > 4;
    let W = input.w, S = input.s, T = input.t;
    g.autoT = false;
    g.autoJumpCD -= dt;
    if (g.auto) { const a = autopilot(dt); W = a.w; S = a.s; T = g.autoT; }

    const maxV = 22;
    if (W) g.speed += (7.5 * (1 - g.speed / maxV) + 0.6) * dt;
    else g.speed -= (0.4 + g.speed * 0.025) * dt;
    if (S) g.speed -= 13 * dt;
    if (g.wheelie > 0.2) g.speed -= 0.6 * dt;
    g.speed = Math.max(0, Math.min(maxV, g.speed));
    g.dist += g.speed * dt;
    g.cleanDist += g.speed * dt;
    g.crank += (g.speed / (2.26 * 2.6)) * Math.PI * 2 * dt;
    g.rpm += ((g.speed / (2.26 * 2.6)) * 60 - g.rpm) * Math.min(1, dt * 4);

    while (input.events.length) {
      const ev = input.events.shift();
      if (ev === 'left' && g.lane > 0) { g.lane--; PK.Audio.sfx('lane'); }
      if (ev === 'right' && g.lane < 2) { g.lane++; PK.Audio.sfx('lane'); }
      if (ev === 'jump' && !g.air) { g.vy = 7.6; g.air = true; PK.Audio.sfx('jump'); }
      if (ev === 'cam') {
        g.cam = (g.cam + 1) % CAMS.length;
        g.camsUsed.add(g.cam);
        g.shotT = 0;
        PK.Audio.sfx('click');
        if (g.camsUsed.size === CAMS.length) PK.UI.unlock('cams');
      }
    }
    const tx = LANES[g.lane];
    const prevX = g.x;
    const k = 9;
    g.xv += ((tx - g.x) * k * k - 2 * k * g.xv) * dt;
    g.x += g.xv * dt;
    g.latVel = (g.x - prevX) / Math.max(dt, 1e-4);

    if (g.air) {
      g.vy -= 20 * dt;
      g.y += g.vy * dt;
      if (g.y <= 0) { g.y = 0; g.vy = 0; g.air = false; PK.Audio.sfx('land'); world.bursts.emit(new THREE.Vector3(g.x, 0.1, 0.5), 8, 0xcfc6b0, 2, 1); }
    }
    const wantW = T && g.speed > 2 ? 0.42 : 0;
    const prevSpread = g.spread;
    g.wheelie += (wantW - g.wheelie) * Math.min(1, dt * (wantW ? 5 : 7));
    g.spread += ((T ? 1 : 0) - g.spread) * Math.min(1, dt * 6);
    if (prevSpread < 0.5 && g.spread >= 0.5) PK.Audio.sfx('flap');
    g.flap += dt * (5 + g.speed * 0.25);
    if (T && g.wheelie > 0.3) { g.wheelieT += dt; g.score += dt * 30; if (g.wheelieT >= 5) PK.UI.unlock('wheelie'); }
    else g.wheelieT = 0;
    g.crashT = Math.max(0, g.crashT - dt * 1.4);
    g.comboT -= dt;
    if (g.comboT <= 0 && g.combo > 0) g.combo = 0;
    g.score += g.speed * dt * 0.5;

    if (g.speed * 3.6 >= 60) PK.UI.unlock('speed');
    if (g.dist >= 5000) PK.UI.unlock('km5');
    if (g.cleanDist >= 1000) PK.UI.unlock('clean');
  }

  function updateEnts(dt) {
    spawn();
    bird.beakWorld(beak);
    for (const e of ents) {
      const z = -(e.s - g.dist);
      const m = e.mesh;
      e.ph += dt;
      if (e.type === 'fish') {
        const baseY = e.high ? 3.55 : 2.0;
        m.position.set(LANES[e.lane] + Math.sin(e.ph * 1.3) * 0.15, baseY + Math.sin(e.ph * 3) * 0.12, z);
        e.s -= dt * 1.5;
        const u = m.userData;
        u.tail.rotation.y = Math.sin(e.ph * 14) * 0.5;
        u.finL.rotation.z = Math.sin(e.ph * 9) * 0.25;
        u.finR.rotation.z = -Math.sin(e.ph * 9) * 0.25;
        u.halo.material.opacity = 0.25 + U.uNight.value * 0.6;
        const dx = Math.abs(m.position.x - beak.x), dy = Math.abs(m.position.y - beak.y), dz = Math.abs(m.position.z - beak.z);
        if (dx < 0.9 && dy < 0.85 && dz < 1.0) { catchFish(e); continue; }
      } else if (e.type === 'cone') {
        if (e.fly) {
          e.fly.y -= 18 * dt;
          m.position.addScaledVector(e.fly, dt);
          m.position.z += g.speed * dt;
          m.rotation.x += dt * 9; m.rotation.z += dt * 5;
          e.s = g.dist - m.position.z;
        } else {
          m.position.set(LANES[e.lane], 0, z);
          if (!e.hit && Math.abs(z) < 0.7 && Math.abs(g.x - LANES[e.lane]) < 0.8 && g.y < 0.65) crash(e);
        }
      } else {
        m.position.set(LANES[e.lane], 0.02, z);
        if (!e.hit && Math.abs(z) < 1.5 && Math.abs(g.x - LANES[e.lane]) < 1.0 && g.y < 0.2) {
          e.hit = true;
          world.bursts.emit(new THREE.Vector3(g.x, 0.2, 0), 30, 0x9fd4ff, 4, 3);
          PK.Audio.sfx('splash');
          if (g.wheelie > 0.25) { g.score += 150; PK.UI.flash('漂亮的翘头！+150', 0.9); }
          else { g.speed *= 0.6; g.combo = 0; }
        }
      }
      if (z > 14 || m.position.y < -20) {
        if (e.type === 'fish' && !e.dead) g.combo = 0;
        removeEnt(e);
      }
    }
    ents = ents.filter((e) => !e.dead);
  }

  const camPos = new THREE.Vector3(0, 3, 7), camLook = new THREE.Vector3(0, 1.5, -6);
  function updateCamera(dt) {
    const p = new THREE.Vector3(g.x, g.y, 0);
    let pos, look, fov = 62, lerp = 4;
    UI_POV(g.cam === 4);
    if (g.cam === 0) {
      const back = 5.2 + g.speed * 0.08;
      pos = new THREE.Vector3(g.x * 0.7, 2.6 + g.y * 0.6, back);
      look = new THREE.Vector3(g.x * 0.9, 1.6 + g.y * 0.5, -8);
      fov = 60 + g.speed * 0.5;
    } else if (g.cam === 1) {
      pos = new THREE.Vector3(8.5, 2.1 + g.y * 0.3, -2.5);
      look = new THREE.Vector3(g.x, 1.3 + g.y * 0.7, -0.8);
      fov = 46;
    } else if (g.cam === 2) {
      pos = new THREE.Vector3(g.x * 0.3 - 3, 15, 11);
      look = new THREE.Vector3(g.x * 0.5, 0, -6);
      fov = 55;
    } else if (g.cam === 3) {
      g.shotT -= dt;
      if (g.shotT <= 0) { g.shot = (g.shot + 1) % 5; g.shotT = 6.5; g.shotAge = 0; lerp = 100; }
      g.shotAge = (g.shotAge || 0) + dt;
      const a = g.shotAge;
      if (g.shot === 0) { pos = new THREE.Vector3(g.x + 1.6 - a * 0.1, 0.45, -4 + a * 0.3); look = new THREE.Vector3(g.x, 1.4 + g.y, 0); fov = 48; }
      else if (g.shot === 1) { const t = a * 0.35 + 1; pos = new THREE.Vector3(g.x + Math.cos(t) * 4.5, 1.8 + g.y, Math.sin(t) * 4.5); look = p.clone().setY(1.5 + g.y); fov = 55; }
      else if (g.shot === 2) { pos = new THREE.Vector3(-7 - a * 2.2, 1 + a * 2.6, 6 + a * 1.4); look = new THREE.Vector3(g.x, 1.2 + g.y, -3); fov = 58; }
      else if (g.shot === 3) { pos = new THREE.Vector3(g.x + 0.9, 0.38, 1.5); look = new THREE.Vector3(g.x + 0.2, 0.9 + g.y, -1.5); fov = 70; }
      else { pos = new THREE.Vector3(-26, 2.5, -14 + a * 0.8); look = new THREE.Vector3(g.x, 1.5 + g.y, -2); fov = 30 - a * 1.2; }
      if (lerp !== 100) lerp = 30;
    } else {
      bird.eyeWorld(tmpV);
      pos = tmpV.clone().add(new THREE.Vector3(0, 0.2, 0.16));
      look = pos.clone().add(new THREE.Vector3(Math.sin(g.flap * 0.2) * 0.2, -0.45, -5));
      fov = 74;
      lerp = 100;
    }
    const f = Math.min(1, dt * lerp);
    camPos.lerp(pos, f);
    camLook.lerp(look, f);
    if (g.crashT > 0) camPos.add(new THREE.Vector3((Math.random() - 0.5) * g.crashT * 0.25, (Math.random() - 0.5) * g.crashT * 0.25, 0));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.near = g.cam === 4 ? 0.02 : 0.1;
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  let povOn = null;
  function UI_POV(on) { if (on !== povOn) { povOn = on; PK.UI.setPOV(on); bird.setPOV(on); } }

  function adaptQuality(dt) {
    g.fpsAcc += dt; g.fpsN++;
    if (g.fpsAcc >= 1) {
      g.fps = g.fpsN / g.fpsAcc;
      g.fpsAcc = 0; g.fpsN = 0;
      g.qTimer++;
      if (g.fps < 42 && g.q > 0 && g.qTimer >= 2) { setQuality(g.q - 1); g.qTimer = 0; }
      else if (g.fps > 58 && g.q < 3 && g.qTimer >= 6) { setQuality(g.q + 1); g.qTimer = -6; }
    }
  }

  let last = performance.now();
  let starSeen = false;
  function frame(nowMs) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (nowMs - last) / 1000);
    last = nowMs;
    if (PK.paused || document.hidden) { dt = 0; }
    g.time += dt;
    if (dt > 0) {
      physics(dt);
      updateEnts(dt);
    }
    const st = sky.update(dt, camera, new THREE.Vector3(g.x, 0, 0));
    if (st.night > 0.95) PK.UI.unlock('night');
    ocean.update(dt, g.speed, g.dist, g.q);
    if (world.update(dt, g.dist, g.speed, st, camera) && !starSeen) { starSeen = true; setTimeout(() => { PK.UI.unlock('star'); PK.Audio.sfx('star'); starSeen = false; }, 500); }

    const wob = g.crashT > 0 ? Math.sin(g.time * 30) * 0.25 * g.crashT : 0;
    bird.update(dt || 1e-4, {
      x: g.x, y: g.y, yaw: -g.xv * 0.04, lean: -g.xv * 0.06 + wob, wheelie: g.wheelie, speed: g.speed, crank: g.crank,
      spread: g.spread, flap: g.flap, lamp: st.lamp, latVel: g.latVel || 0, clothIters: [2, 3, 4, 5][g.q],
      lookUp: g.air ? 0.15 : 0, headYaw: g.xv * 0.03,
    });
    updateCamera(dt || 0.016);
    PK.Audio.update(dt, { speed: g.speed, rpm: g.rpm, night: st.night, wheelie: g.wheelie > 0.3, air: g.air });
    adaptQuality((nowMs - (frame.prev || nowMs)) / 1000 || 0.016);
    frame.prev = nowMs;
    if (g.started) PK.UI.saveBest(Math.floor(g.score));

    PK.UI.hud(dt, {
      score: g.score, fish: g.fish, combo: g.combo, dist: g.dist, speed: g.speed, rpm: g.rpm,
      timeName: st.name, camName: CAMS[g.cam] + (g.cam === 3 ? ' ' + (g.shot + 1) + '/5' : ''), qName: QN[g.q], fps: g.fps, auto: g.auto,
    });
    renderer.render(scene, camera);
  }

  PK.UI.init(() => {
    g.started = true;
    PK.live = true;
    g.score = 0; g.fish = 0; g.combo = 0; g.dist = 0; g.cleanDist = 0;
    ents.forEach(removeEnt); ents = [];
    spawnAt = 30;
  });
  setQuality(innerWidth * innerHeight > 2.5e6 ? 1 : 2);
  g.cam = 3; g.shot = 0; g.shotT = 6.5;
  document.getElementById('go').addEventListener('click', () => { g.cam = 0; camera.fov = 62; });
  PK.game = { g, sky, camera };
  requestAnimationFrame(frame);
})();
