(function () {
const PK = window.PK;
const V3 = THREE.Vector3;
const $ = id => document.getElementById(id);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const store = {
  get(k, d) { try { const v = localStorage.getItem('pkcoast-a03-' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pkcoast-a03-' + k, JSON.stringify(v)); } catch (e) {} }
};

const W = PK.createWorld($('c'));
const scene = W.scene, camera = W.camera;
const props = PK.createProps(scene, W);
const rider = PK.createRider(scene);
const ent = PK.createEntities(scene);
const audio = PK.createAudio();

const MAX_SPEED = 16.5, CRUISE = 9, MIN_SPEED = 2.5;
const S = {
  z: 0, x: 0, y: 0, vy: 0, lane: 1, speed: 6, crank: 0, dist: 0, lean: 0, wheelie: 0, wing: 0,
  airborne: false, airT: 0, beakOpen: 0, gulp: 0, look: 0, headYaw: 0, t: 0,
  score: 0, fish: 0, combo: 0, bestCombo: 0, mult: 1, gold: 0, high: 0, wingCatch: 0,
  wheelieT: 0, wheelieBest: 0, jumps: 0, crabHits: 0, crabCleared: 0, noHitStreak: 0,
  idle: 0, auto: false, autoTime: 0, everManual: false, laneChanges: 0, nightRide: 0, camsUsed: new Set(),
  pouch: 0, started: false, paused: false, cam: 0
};
const keys = { accel: false, brake: false, wing: false };
let best = Number(store.get('best', 0)) || 0;
$('best').textContent = best;

// Achievements
const ACH = [
  { id: 'first', name: '第一口', desc: '抓到第一条鱼' },
  { id: 'ten', name: '小满一兜', desc: '一局抓到 10 条鱼' },
  { id: 'fifty', name: '渔获颇丰', desc: '一局抓到 50 条鱼' },
  { id: 'combo10', name: '连环嘴', desc: '连击达到 10' },
  { id: 'gold', name: '金鳞', desc: '抓到一条金鱼' },
  { id: 'high', name: '腾空一咬', desc: '跳起来抓到高飞鱼' },
  { id: 'wing', name: '翅膀兜鱼', desc: '展翅时抓到鱼' },
  { id: 'wheelie', name: '独轮表演', desc: '持续抬前轮 4 秒' },
  { id: 'crab', name: '螃蟹跨栏', desc: '跳过 5 只螃蟹' },
  { id: 'speed', name: '海风疾驰', desc: '时速超过 55 km/h' },
  { id: 'km', name: '一公里', desc: '骑完 1 公里' },
  { id: 'night', name: '星空骑士', desc: '在星空下骑满 60 秒' },
  { id: 'director', name: '导演', desc: '试过全部 5 种镜头' },
  { id: 'auto', name: '放手也行', desc: '自动驾驶替你抓到 5 条鱼' }
];
const savedAch = store.get('ach', []);
const got = new Set(Array.isArray(savedAch) ? savedAch.filter(x => typeof x === 'string') : []);
function renderAch() {
  $('achCount').textContent = got.size + '/14';
  $('achSum').textContent = got.size + ' / 14';
  $('alist').innerHTML = ACH.map((a, i) => `<div class="ach${got.has(a.id) ? ' got' : ''}"><div class="medal">${got.has(a.id) ? '★' : i + 1}</div><div><b>${a.name}</b><span>${a.desc}</span></div></div>`).join('');
}
renderAch();
function unlock(id) {
  if (got.has(id) || !S.started) return;
  got.add(id); store.set('ach', [...got]); renderAch();
  const a = ACH.find(x => x.id === id);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="medal">★</div><div><b>成就解锁 · ${a.name}</b><span>${a.desc}</span></div>`;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4200);
  audio.sfx('achieve');
}

// Score popups
const projV = new V3();
function pop(text, worldPos, cls) {
  if (!S.started) return;
  projV.copy(worldPos).project(camera);
  if (projV.z > 1) return;
  const el = document.createElement('div');
  el.className = 'pop' + (cls ? ' ' + cls : '');
  el.textContent = text;
  el.style.left = ((projV.x + 1) / 2 * innerWidth) + 'px';
  el.style.top = ((1 - projV.y) / 2 * innerHeight) + 'px';
  $('pops').appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

// Spawning
let nextSpawnZ = -40, nextCrabZ = -160;
function spawnAhead() {
  while (nextSpawnZ > S.z - 130) {
    const r = Math.random();
    if (r < 0.5) {
      const lane = Math.random() * 3 | 0;
      const roll = Math.random();
      ent.spawnFish(nextSpawnZ, lane, roll < 0.08 ? 'gold' : roll < 0.26 ? 'high' : 'normal');
      nextSpawnZ -= 9 + Math.random() * 9;
    } else if (r < 0.8) {
      let lane = Math.random() * 3 | 0;
      const dir = lane === 0 ? 1 : lane === 2 ? -1 : (Math.random() < 0.5 ? -1 : 1);
      for (let i = 0; i < 3; i++) { ent.spawnFish(nextSpawnZ - i * 5, lane, 'normal'); if (i === 0) lane += dir; }
      nextSpawnZ -= 22 + Math.random() * 8;
    } else {
      for (let i = 0; i < 4; i++) ent.spawnFish(nextSpawnZ - i * 3.2, (Math.random() * 3) | 0, i === 3 && Math.random() < 0.3 ? 'gold' : 'normal');
      nextSpawnZ -= 26 + Math.random() * 10;
    }
  }
  while (nextCrabZ > S.z - 130) {
    ent.spawnCrab(nextCrabZ, Math.random() * 3 | 0);
    nextCrabZ -= 55 + Math.random() * 60;
  }
}
function cleanup() {
  ent.fish = ent.fish.filter(f => { if (f.z > S.z + 30 || f.state === 'caught' && f.z > S.z + 2) { ent.remove(f); return false; } return true; });
  ent.crabs = ent.crabs.filter(c => { if (c.z > S.z + 30) { ent.remove(c); return false; } return true; });
}

// Input
function manual() {
  S.idle = 0;
  if (S.auto) { S.auto = false; $('auto').hidden = true; }
  S.everManual = true;
}
function changeLane(d) {
  const n = clamp(S.lane + d, 0, 2);
  if (n !== S.lane) { S.lane = n; S.laneChanges++; audio.sfx('lane'); }
}
function jump() {
  if (S.airborne) return;
  S.airborne = true; S.vy = 6.4; S.jumps++;
  audio.sfx('jump');
}
const CAMS = ['追尾镜头', '侧面跟拍', '高空俯瞰', '电影运镜', '鹈鹕视角'];
function setCam(i) {
  S.cam = (i + 5) % 5;
  S.camsUsed.add(S.cam);
  $('camName').textContent = CAMS[S.cam];
  document.body.classList.toggle('cine', S.cam === 3);
  rider.setPOV(S.cam === 4);
  camCut = true;
  if (S.camsUsed.size >= 5) unlock('director');
}
let camCut = true;
const keyMap = { KeyW: 'accel', ArrowUp: 'accel', KeyS: 'brake', ArrowDown: 'brake', KeyT: 'wing' };
addEventListener('keydown', e => {
  if (!S.started) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); start(); } return; }
  if (e.code === 'KeyH') { toggleAch(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (S.paused) { if (e.code === 'Escape') toggleAch(); return; }
  if (keyMap[e.code]) { keys[keyMap[e.code]] = true; manual(); e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { manual(); changeLane(-1); e.preventDefault(); }
  else if (e.code === 'KeyD' || e.code === 'ArrowRight') { manual(); changeLane(1); e.preventDefault(); }
  else if (e.code === 'Space') { manual(); jump(); e.preventDefault(); }
  else if (e.code === 'KeyC') setCam(S.cam + 1);
  else if (/^Digit[1-5]$/.test(e.code)) setCam(+e.code.slice(5) - 1);
});
addEventListener('keyup', e => { if (keyMap[e.code]) keys[keyMap[e.code]] = false; });
addEventListener('blur', () => { keys.accel = keys.brake = keys.wing = false; });

const touchEl = $('touch');
if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) {
  touchEl.classList.add('on');
  document.body.classList.add('touch');
  $('auto').textContent = '自动驾驶中 · 点任意按钮接管';
}
touchEl.querySelectorAll('.tb').forEach(b => {
  const k = b.dataset.k;
  const down = e => {
    e.preventDefault(); b.classList.add('down'); manual();
    if (k === 'left') changeLane(-1); else if (k === 'right') changeLane(1); else if (k === 'jump') jump(); else keys[k] = true;
  };
  const up = e => { e.preventDefault(); b.classList.remove('down'); if (keys[k] !== undefined) keys[k] = false; };
  b.addEventListener('pointerdown', down);
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});
let swipe = null;
$('c').addEventListener('pointerdown', e => { if (e.pointerType === 'touch') swipe = { x: e.clientX, y: e.clientY }; });
$('c').addEventListener('pointerup', e => {
  if (!swipe || !S.started) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { manual(); changeLane(dx > 0 ? 1 : -1); }
  else if (dy < -40) { manual(); jump(); }
});
$('bCam').addEventListener('click', () => setCam(S.cam + 1));
$('bAch').addEventListener('click', toggleAch);
$('achClose').addEventListener('click', toggleAch);
$('bMute').addEventListener('click', toggleMute);
function toggleAch() {
  const ov = $('achv');
  ov.hidden = !ov.hidden;
  S.paused = !ov.hidden && S.started;
  if (S.paused) audio.suspend(); else audio.resume();
}
function toggleMute() {
  audio.setMuted(!audio.muted);
  $('bMute').textContent = audio.muted ? '声音 关' : '声音 开';
  store.set('muted', audio.muted);
}
function start() {
  if (S.started) return;
  S.started = true;
  $('start').hidden = true;
  audio.init();
  if (store.get('muted', false) === true) { audio.setMuted(true); $('bMute').textContent = '声音 关'; }
  audio.sfx('bell');
  S.speed = 7;
  S.auto = false; S.idle = 0;
  S.score = S.fish = S.combo = S.bestCombo = S.crabCleared = S.crabHits = S.jumps = S.autoCatch = S.nightRide = 0;
  S.mult = 1; S.distStart = S.dist;
}
$('go').addEventListener('click', start);

// Autopilot: pick the reachable fish with best value, else cruise
function autopilot(dt) {
  let target = null, bestScore = -1;
  for (const f of ent.fish) {
    if (f.state !== 'wait') continue;
    const ahead = S.z - f.z;
    if (ahead < 1 || ahead > 60) continue;
    const t = ahead / Math.max(S.speed, 1);
    const laneDist = Math.abs(f.lane - S.lane);
    if (laneDist * 0.35 > t) continue;
    const v = (f.type === 'gold' ? 3 : f.type === 'high' ? 1.6 : 1) / (1 + ahead * 0.04 + laneDist * 0.3);
    if (v > bestScore) { bestScore = v; target = f; }
  }
  const crab = ent.crabs.find(c => !c.hit && !c.passed && c.lane === S.lane && S.z - c.z > 0 && S.z - c.z < 7);
  S.autoLaneCd = (S.autoLaneCd || 0) - dt;
  if (target && target.lane !== S.lane && S.autoLaneCd <= 0) { changeLane(Math.sign(target.lane - S.lane)); S.autoLaneCd = 0.28; }
  if (crab && S.z - crab.z < 4.2 && !S.airborne) jump();
  if (target && target.type === 'high' && target.lane === S.lane) {
    const ahead = S.z - target.z - 0.9;
    const tFish = ahead / Math.max(S.speed, 1);
    if (Math.abs(tFish - 0.38) < 0.05 && !S.airborne) jump();
  }
  const want = target ? CRUISE + 2 : CRUISE;
  keys.accel = S.speed < want - 0.5;
  keys.brake = S.speed > want + 2.5;
  const close = target && S.z - target.z < 7 && target.lane !== S.lane;
  keys.wing = !!close && !crab;
}

// Catching
const beak = new V3(), tmpV = new V3();
function tryCatch() {
  rider.beakWorld(beak, 0.75);
  const reachX = S.wing > 0.5 ? 1.25 : 0.7;
  let near = 0;
  for (const f of ent.fish) {
    if (f.state !== 'wait' || !f.launched) continue;
    const dz = Math.abs(f.z - beak.z);
    if (dz < 3) near = Math.max(near, 1 - dz / 3);
    const dy = Math.abs(f.y - beak.y), dx = Math.abs(f.x - S.x);
    if (dz < 0.9 && dx < reachX && dy < 0.75) {
      f.state = 'caught';
      f.mesh.visible = false;
      S.combo++;
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      S.mult = 1 + Math.floor(S.combo / 5);
      const base = f.type === 'gold' ? 500 : f.type === 'high' ? 200 : 100;
      const pts = base * S.mult;
      S.score += pts; S.fish++; S.gulp = 1; S.pouch = Math.min(S.pouch + 1, 5);
      if (S.auto) { S.autoCatch = (S.autoCatch || 0) + 1; if (S.autoCatch >= 5) unlock('auto'); }
      tmpV.set(f.x, f.y, f.z);
      ent.burst(tmpV, f.type === 'gold' ? 40 : 18, f.type === 'gold' ? ent.colors.cGold : ent.colors.cSplash, 3, 2.5);
      pop('+' + pts, tmpV, f.type === 'gold' ? 'gold' : '');
      audio.sfx(f.type === 'gold' ? 'gold' : 'catch', S.combo);
      unlock('first');
      if (S.fish >= 10) unlock('ten');
      if (S.fish >= 50) unlock('fifty');
      if (S.combo >= 10) unlock('combo10');
      if (f.type === 'gold') unlock('gold');
      if (f.type === 'high' && S.airborne) unlock('high');
      if (S.wing > 0.5) unlock('wing');
    }
  }
  return near;
}

// Quality
const Q = { level: 2, frames: 0, acc: 0, cool: 3, names: ['低', '中', '高'] };
function applyQuality(l) {
  Q.level = l;
  const dpr = Math.min(devicePixelRatio, 2);
  W.renderer.setPixelRatio([Math.min(dpr, 0.75), Math.min(dpr, 1.25), dpr][l]);
  W.renderer.shadowMap.enabled = l > 0;
  W.key.castShadow = l > 0;
  W.key.shadow.mapSize.set(l === 2 ? 2048 : 1024, l === 2 ? 2048 : 1024);
  if (W.key.shadow.map) { W.key.shadow.map.dispose(); W.key.shadow.map = null; }
  W.common.uDetail.value = l === 0 ? 0.4 : 1;
  rider.setQuality(l);
  W.resize();
  $('qual').textContent = '画质 ' + Q.names[l] + ' · 自适应';
}
function adaptQuality(dt) {
  Q.frames++; Q.acc += dt; Q.cool -= dt;
  if (Q.acc < 1.5) return;
  const fps = Q.frames / Q.acc;
  Q.frames = 0; Q.acc = 0;
  if (Q.cool > 0) return;
  if (fps < 45 && Q.level > 0) { applyQuality(Q.level - 1); Q.cool = 3; }
  else if (fps > 58 && Q.level < 2) { applyQuality(Q.level + 1); Q.cool = 8; }
}
applyQuality(innerWidth < 700 ? 1 : 2);

// Camera
const camPos = new V3(), camLook = new V3(), tmpL = new V3(), head = new V3();
let cineShot = 0, cineT = 0;
function updateCamera(dt) {
  const px = S.x, pz = S.z, py = S.y;
  let p = tmpV, l = tmpL;
  const sp = S.speed / MAX_SPEED;
  if (S.cam === 0) {
    p.set(px * 0.6, 2.6 + sp * 0.3 + py * 0.5, pz + 6.2 + sp * 1.2);
    l.set(px * 0.8, 1.3 + py * 0.6, pz - 4);
    camera.fov = damp(camera.fov, 58 + sp * 10, 3, dt);
  } else if (S.cam === 1) {
    p.set(4.7, 1.5 + py * 0.4, pz + 1.6);
    l.set(px - 1, 1.1 + py * 0.7, pz - 0.6);
    camera.fov = damp(camera.fov, 50, 3, dt);
  } else if (S.cam === 2) {
    p.set(px * 0.3 - 3, 15, pz + 11);
    l.set(px * 0.5 - 1.5, 0, pz - 7);
    camera.fov = damp(camera.fov, 52, 3, dt);
  } else if (S.cam === 3) {
    cineT += dt;
    if (cineT > 7) { cineT = 0; cineShot = (cineShot + 1) % 5; camCut = true; }
    const u = cineT / 7;
    switch (cineShot) {
      case 0: { const a = lerp(-0.6, 0.9, u); p.set(px + Math.sin(a) * 4.5, 1.2 + u * 0.8, pz - Math.cos(a) * 4.5); l.set(px, 1.4, pz); camera.fov = 42; break; }
      case 1: p.set(px - 7.5, 0.5, pz - 3 + u * 2); l.set(px, 1.2, pz); camera.fov = 34; break;
      case 2: { p.set(px + lerp(1, 6, u), lerp(1, 9, u), pz + lerp(3, 14, u)); l.set(px - 3, 1, pz - 8); camera.fov = 55; break; }
      case 3: p.set(-1.5, 0.35, pz - 14 + u * 3); l.set(px, 1.3, pz - 1); camera.fov = 30; break;
      case 4: p.set(px + 1.6, 2.1, pz - 2.6); l.set(px, 1.75, pz); camera.fov = 38; break;
    }
  } else {
    rider.headWorld(head);
    rider.povLook(tmpL);
    p.copy(head);
    l.copy(tmpL);
    camera.fov = damp(camera.fov, 74 + sp * 8, 3, dt);
  }
  if (camCut || S.cam === 4) { camPos.copy(p); camLook.copy(l); camCut = false; }
  else {
    const k = S.cam === 3 ? 6 : 5;
    camPos.x = damp(camPos.x, p.x, k, dt); camPos.y = damp(camPos.y, p.y, k, dt); camPos.z = p.z + (camPos.z - p.z) * Math.exp(-k * 2 * dt);
    camLook.x = damp(camLook.x, l.x, k, dt); camLook.y = damp(camLook.y, l.y, k, dt); camLook.z = l.z + (camLook.z - l.z) * Math.exp(-k * 2 * dt);
  }
  camera.position.copy(camPos);
  if (S.cam !== 4 && S.landShake > 0) camera.position.y += (Math.random() - 0.5) * S.landShake * 0.15;
  camera.lookAt(camLook);
  if (S.cam === 4) camera.rotateZ(-S.lean * 0.6);
  camera.updateProjectionMatrix();
}

// Main loop
let last = performance.now(), hudT = 0;
const startOverlayOrbit = { a: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (S.paused) return;
  S.t += dt;

  if (!S.started) {
    S.auto = true;
  } else {
    S.idle += dt;
    if (!S.auto && S.idle > 6) { S.auto = true; $('auto').hidden = false; }
  }
  if (S.auto) autopilot(dt);

  const accel = keys.accel ? 5.5 : 0, brake = keys.brake ? 9 : 0;
  const drag = 0.012 * S.speed * S.speed + 0.25;
  const pedal = !keys.brake && (keys.accel || S.speed < CRUISE) ? (keys.accel ? 0 : 1.6) : 0;
  S.speed = clamp(S.speed + (accel + pedal - brake - drag + (S.speed < CRUISE && !keys.brake ? 0.6 : 0)) * dt, MIN_SPEED, MAX_SPEED);
  const dz = S.speed * dt;
  S.z -= dz;
  S.dist += dz;
  const coasting = !keys.accel && S.speed > CRUISE + 0.3;
  const cadence = coasting ? 0 : S.speed * 60 / (2 * Math.PI * 0.347 * 2.6) ;
  S.cadenceSm = damp(S.cadenceSm || 0, cadence, 2, dt);
  S.crank += cadence / 60 * Math.PI * 2 * dt;

  const tx = PK.LANES[S.lane];
  const prevX = S.x;
  S.x = damp(S.x, tx, 7, dt);
  const vx = (S.x - prevX) / Math.max(dt, 1e-4);
  S.lean = damp(S.lean, clamp(-vx * 0.09, -0.4, 0.4), 10, dt);
  S.headYaw = damp(S.headYaw, clamp(-vx * 0.05, -0.3, 0.3), 6, dt);

  if (S.airborne) {
    S.vy -= 17 * dt;
    S.y += S.vy * dt;
    S.airT += dt;
    if (S.y <= 0) {
      S.y = 0; S.airborne = false;
      S.landShake = Math.min(1, -S.vy * 0.12);
      audio.sfx('land');
      ent.burst(tmpV.set(S.x, 0.05, S.z + 0.5), 12, ent.colors.cDust, 2, 1.2);
      S.airT = 0;
    }
  }
  S.landShake = Math.max(0, (S.landShake || 0) - dt * 3);

  const wingTarget = keys.wing ? 1 : 0;
  if (keys.wing && S.wing < 0.1 && !S.wingFlapped) { audio.sfx('flap'); S.wingFlapped = true; }
  if (!keys.wing) S.wingFlapped = false;
  S.wing = damp(S.wing, wingTarget, 8, dt);
  const wheelieTarget = keys.wing && !S.airborne ? 0.32 + Math.sin(S.t * 3) * 0.03 : 0;
  S.wheelie = damp(S.wheelie, wheelieTarget, keys.wing ? 4 : 7, dt);
  if (S.wheelie > 0.2) { S.wheelieT += dt; if (S.wheelieT >= 4) unlock('wheelie'); } else S.wheelieT = 0;

  spawnAhead();
  ent.update(dt, S.t, S, dz, f => { if (Math.abs(f.z - S.z) < 60) audio.sfx('splash'); });

  const near = tryCatch();
  S.beakOpen = damp(S.beakOpen, near > 0.1 ? 1 : 0, 12, dt);
  S.gulp = Math.max(0, S.gulp - dt * 2.2);
  S.look = damp(S.look, near, 4, dt);

  for (const f of ent.fish) {
    if (f.state === 'missed' && !f.counted) {
      f.counted = true;
      if (Math.abs(f.lane - S.lane) <= 0 && S.combo > 0) { S.combo = 0; S.mult = 1; audio.sfx('miss'); }
    }
  }
  for (const c of ent.crabs) {
    if (c.hit || c.passed) continue;
    const d = c.z - S.z;
    if (Math.abs(d) < 0.7 && Math.abs(c.x - S.x) < 0.75) {
      if (S.y > 0.35) { c.passed = true; S.crabCleared++; S.score += 50 * S.mult; pop('+' + 50 * S.mult, tmpV.set(c.x, 1, c.z)); if (S.crabCleared >= 5) unlock('crab'); }
      else {
        c.hit = true; c.vy = 6; c.vx = (Math.random() - 0.5) * 6;
        S.speed *= 0.45; S.combo = 0; S.mult = 1; S.crabHits++;
        audio.sfx('bonk'); S.landShake = 1;
        pop('哎哟', tmpV.set(S.x, 2.2, S.z), 'bad');
      }
    } else if (d > 1) c.passed = true;
  }
  cleanup();

  if (S.speed * 3.6 > 55) unlock('speed');
  if (S.dist - (S.distStart || 0) >= 1000) unlock('km');
  if (W.night > 0.8 && S.started) { S.nightRide += dt; if (S.nightRide >= 60) unlock('night'); }

  W.update(dt, S.t, S.z);
  props.update(S.z, dt, S.t);
  rider.update(dt, {
    x: S.x, y: S.y, z: S.z, lean: S.lean, wheelie: S.wheelie, dist: S.dist, crank: S.crank, beakOpen: S.beakOpen,
    gulp: S.gulp, wing: S.wing, t: S.t, look: S.look, headYaw: S.headYaw, speed: S.speed, night: W.night
  });
  if (!S.started) {
    startOverlayOrbit.a += dt * 0.12;
    const a = startOverlayOrbit.a;
    camera.position.set(S.x + Math.sin(a) * 6.5, 2.2, S.z + Math.cos(a) * 6.5 - 0.5);
    camera.lookAt(S.x, 1.3, S.z - 0.5);
    camera.fov = 50; camera.updateProjectionMatrix();
    camCut = true;
  } else updateCamera(dt);
  audio.update({ cadence: S.cadenceSm, speed: S.speed, night: W.night, t: S.t, coasting, cam: S.cam });
  W.renderer.render(scene, camera);
  adaptQuality(dt);

  hudT -= dt;
  if (hudT <= 0) {
    hudT = 0.1;
    $('score').textContent = S.score.toLocaleString('zh-CN');
    $('fish').textContent = S.fish;
    $('combo').textContent = '×' + S.combo + (S.mult > 1 ? ' (倍率' + S.mult + ')' : '');
    $('combo').classList.toggle('hot', S.mult > 1);
    $('kmh').textContent = Math.round(S.speed * 3.6);
    $('rpm').textContent = Math.round(S.cadenceSm);
    $('km').textContent = ((S.dist - (S.distStart || 0)) / 1000).toFixed(2);
    $('clock').textContent = W.clockText();
    if (S.score > best && S.started) { best = S.score; $('best').textContent = best.toLocaleString('zh-CN'); store.set('best', best); }
  }
}
rider.resetCloth();
S.camsUsed.add(0);
addEventListener('resize', () => W.resize());
document.addEventListener('visibilitychange', () => { if (document.hidden) audio.suspend(); else if (!S.paused) audio.resume(); });
requestAnimationFrame(t => { last = t; frame(t); });
})();
