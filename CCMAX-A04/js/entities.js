window.PG = window.PG || {};

PG.Entities = (function () {
  const W = PG.W;
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5 }, o || {}));
  let scene;
  const fish = [], obs = [], gulls = [], leapers = [];
  let nextSpawn = 40;

  function fishMesh(golden) {
    const g = new THREE.Group();
    const bodyM = golden ? std('#ffc93a', { metalness: 0.8, roughness: 0.25, emissive: '#7a4a00', emissiveIntensity: 0.6 }) : std('#7fa6c4', { metalness: 0.6, roughness: 0.3 });
    const finM = golden ? std('#ffe07a', { side: THREE.DoubleSide, emissive: '#6a4000', emissiveIntensity: 0.5 }) : std('#bcd6ea', { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), bodyM);
    b.scale.set(0.07, 0.08, 0.24);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), std(golden ? '#fff0b0' : '#e8eef2', { metalness: 0.3 }));
    belly.scale.set(0.06, 0.05, 0.2); belly.position.y = -0.03;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), finM);
    tail.rotation.x = -Math.PI / 2; tail.position.z = 0.27; tail.scale.x = 0.2;
    const eyeM = new THREE.MeshBasicMaterial({ color: '#111' });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), eyeM); e.position.set(s * 0.055, 0.02, -0.15); g.add(e);
    }
    const fins = [];
    for (const s of [-1, 1]) {
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.08, s * 0.32, 0, 0.02, 0, 0, 0.12], 3));
      fg.computeVertexNormals();
      const f = new THREE.Mesh(fg, finM); f.position.set(s * 0.04, 0.02, 0);
      g.add(f); fins.push(f);
    }
    g.add(b, belly, tail);
    g.userData = { fins, tail };
    if (golden) {
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PG.Scenery.glowTex(), color: '#ffd24a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      glow.scale.set(1.4, 1.4, 1); g.add(glow);
    }
    return g;
  }

  function crabMesh() {
    const g = new THREE.Group();
    const m = std('#d8402a', { roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), m); body.scale.set(0.3, 0.13, 0.22); body.position.y = 0.2;
    g.add(body);
    for (const s of [-1, 1]) {
      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), m); claw.scale.set(1.2, 0.8, 1.6); claw.position.set(s * 0.32, 0.26, -0.22);
      g.add(claw);
      for (let i = 0; i < 3; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.3, 4), m);
        leg.position.set(s * 0.3, 0.1, -0.06 + i * 0.09); leg.rotation.z = s * 0.9;
        g.add(leg);
      }
      const stalk = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: '#111' }));
      stalk.position.set(s * 0.08, 0.36, -0.15); g.add(stalk);
    }
    g.userData.kind = 'crab';
    return g;
  }

  function coneMesh() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 16), std('#ff7a1a', { roughness: 0.5 }));
    c.position.y = 0.37;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.165, 0.12, 16), std('#ffffff', { emissive: '#666', emissiveIntensity: 0.4 }));
    band.position.y = 0.37;
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), std('#222'));
    base.position.y = 0.025;
    g.add(c, band, base);
    g.userData.kind = 'cone';
    return g;
  }

  function gullMesh() {
    const g = new THREE.Group();
    const m = std('#f4f4f0', { side: THREE.DoubleSide });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), m); body.scale.set(0.12, 0.12, 0.38);
    g.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, s * 0.9, 0, 0.05, s * 0.35, 0, 0.18, 0, 0, 0.16], 3));
      wg.setIndex([0, 1, 2, 0, 2, 3]); wg.computeVertexNormals();
      const w = new THREE.Mesh(wg, m);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.01, 0.1), std('#333'));
      tip.position.set(s * 0.82, 0, 0.06); w.add(tip);
      g.add(w); wings.push(w);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), std('#f0b030'));
    beak.rotation.x = -Math.PI / 2; beak.position.z = -0.42; g.add(beak);
    g.userData.wings = wings;
    return g;
  }

  function create(s) {
    scene = s;
    for (let i = 0; i < 5; i++) {
      const g = gullMesh(); scene.add(g);
      gulls.push({ obj: g, d: 30 + i * 25, x: -8 - Math.random() * 20, y: 8 + Math.random() * 7, ph: Math.random() * 6, sp: 0.6 + Math.random() * 0.5 });
    }
    for (let i = 0; i < 3; i++) {
      const g = fishMesh(false); g.scale.setScalar(1.6); scene.add(g); g.visible = false;
      leapers.push({ obj: g, t: -Math.random() * 6, d: 0, x: 0, dur: 1.1 });
    }
  }

  function addFish(d, lane, y, golden) {
    const obj = fishMesh(golden);
    scene.add(obj);
    fish.push({ obj, d, lane, x: W.LANES[lane], baseY: y, y, golden, ph: Math.random() * 6, prevRel: null, high: y > 2 });
  }
  function addObs(d, lane, kind) {
    const obj = kind === 'crab' ? crabMesh() : coneMesh();
    scene.add(obj);
    obs.push({ obj, d, lane, x: W.LANES[lane], kind, ph: Math.random() * 6, prevRel: null, hit: false });
  }

  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function spawnPattern(d, difficulty) {
    const r = Math.random();
    const L = Math.floor(Math.random() * 3);
    const gold = () => Math.random() < 0.06;
    let len = 0;
    if (r < 0.28) {
      const n = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) addFish(d + i * 3.2, L, 1.55, i === n - 1 && gold());
      len = n * 3.2;
    } else if (r < 0.48) {
      const n = 5;
      let lane = L;
      for (let i = 0; i < n; i++) {
        addFish(d + i * 5.5, lane, 1.55, false);
        lane = Math.max(0, Math.min(2, lane + (Math.random() < 0.5 ? -1 : 1)));
      }
      len = n * 5.5;
    } else if (r < 0.64) {
      addFish(d, L, 1.55, false);
      for (let i = 1; i <= 3; i++) addFish(d + 1.5 + i * 1.3, L, 1.55 + Math.sin(i / 4 * Math.PI) * 1.1, i === 2 && gold());
      addFish(d + 8, L, 1.55, false);
      len = 10;
    } else if (r < 0.78) {
      addObs(d, L, Math.random() < 0.6 ? 'crab' : 'cone');
      addFish(d, L, 2.45, gold());
      const o = (L + 1 + Math.floor(Math.random() * 2)) % 3;
      addFish(d + 4, o, 1.55, false);
      len = 8;
    } else if (r < 0.9) {
      const free = Math.floor(Math.random() * 3);
      for (let k = 0; k < 3; k++) if (k !== free) addObs(d, k, pick(['crab', 'cone']));
      addFish(d, free, 1.55, false);
      addFish(d + 3, free, 1.55, false);
      len = 6;
    } else {
      addFish(d, L, 1.55, true);
      len = 4;
    }
    if (difficulty > 0.4 && Math.random() < difficulty * 0.4) {
      addObs(d + len + 6, Math.floor(Math.random() * 3), 'crab');
      len += 6;
    }
    return len;
  }

  function removeAt(arr, i) { scene.remove(arr[i].obj); arr.splice(i, 1); }

  function update(dt, time, dist, speed, difficulty) {
    while (nextSpawn < dist + 110) {
      const len = spawnPattern(nextSpawn, difficulty);
      nextSpawn += len + 14 + Math.random() * 16 - difficulty * 6;
    }
    for (let i = fish.length - 1; i >= 0; i--) {
      const f = fish[i];
      if (f.caught) {
        f.ct += dt;
        const k = Math.min(1, f.ct / 0.18);
        f.obj.position.lerp(f.target, k);
        f.obj.scale.setScalar(Math.max(0.01, 1 - k));
        if (k >= 1) removeAt(fish, i);
        continue;
      }
      f.z = dist - f.d;
      if (f.z > 3) { removeAt(fish, i); continue; }
      f.obj.scale.setScalar(f.z > 1 ? Math.max(0.01, 1 - (f.z - 1) / 2) : 1);
      f.y = f.baseY + Math.sin(time * 3 + f.ph) * 0.12;
      f.obj.position.set(f.x + Math.sin(time * 1.7 + f.ph) * 0.08, f.y, f.z);
      f.obj.rotation.y = Math.PI + Math.sin(time * 2 + f.ph) * 0.3;
      f.obj.rotation.z = Math.sin(time * 4 + f.ph) * 0.15;
      const fl = Math.sin(time * 22 + f.ph) * 0.5;
      f.obj.userData.fins[0].rotation.z = fl; f.obj.userData.fins[1].rotation.z = -fl;
      f.obj.userData.tail.rotation.y = Math.sin(time * 14 + f.ph) * 0.4;
    }
    for (let i = obs.length - 1; i >= 0; i--) {
      const o = obs[i];
      o.z = dist - o.d;
      if (o.z > 10) { removeAt(obs, i); continue; }
      let x = o.x;
      if (o.kind === 'crab') {
        x += Math.sin(time * 2.2 + o.ph) * 0.45;
        o.obj.rotation.y = Math.sin(time * 9 + o.ph) * 0.12;
        o.obj.position.y = Math.abs(Math.sin(time * 9 + o.ph)) * 0.03;
      }
      if (o.knock) {
        o.knock += dt;
        o.obj.position.y = o.knock * 5 - o.knock * o.knock * 12;
        o.obj.rotation.x += dt * 12;
        x += o.knock * 3 * o.side;
      }
      o.cx = x;
      o.obj.position.x = x; o.obj.position.z = o.z;
    }
    for (const g of gulls) {
      g.d += (speed + g.sp * 6) * dt * 0.6 + g.sp * dt * 4;
      const z = dist - g.d;
      if (z > 40 || z < -260) { g.d = dist + 120 + Math.random() * 120; g.x = -6 - Math.random() * 30; g.y = 7 + Math.random() * 8; }
      const flap = Math.sin(time * 6 * g.sp + g.ph);
      g.obj.position.set(g.x + Math.sin(time * 0.3 + g.ph) * 4, g.y + flap * 0.15, dist - g.d);
      g.obj.rotation.z = Math.sin(time * 0.3 + g.ph) * 0.25;
      g.obj.userData.wings[0].rotation.z = flap * 0.5; g.obj.userData.wings[1].rotation.z = -flap * 0.5;
    }
    for (const l of leapers) {
      l.t += dt;
      if (l.t > l.dur) {
        l.obj.visible = false;
        if (l.t > l.dur + 2 + Math.random() * 4) {
          l.t = 0; l.d = dist + 20 + Math.random() * 60;
          l.x = W.shoreX(l.d) - 12 - Math.random() * 30; l.dur = 0.9 + Math.random() * 0.5; l.dx = (Math.random() - 0.5) * 3;
          if (PG.Audio && Math.random() < 0.3) PG.Audio.sfx.splash();
        }
        continue;
      }
      if (l.t < 0) continue;
      const k = l.t / l.dur;
      l.obj.visible = true;
      const h = 4 * k * (1 - k) * 1.8;
      l.obj.position.set(l.x + l.dx * k, W.SEA_Y + h - 0.1, dist - l.d - k * 4);
      l.obj.rotation.set(-(1 - 2 * k) * 1.1, 0, 0);
    }
  }

  function reset() {
    while (fish.length) removeAt(fish, 0);
    while (obs.length) removeAt(obs, 0);
    nextSpawn = 40;
  }

  return { create, update, fish, obs, reset };
})();
