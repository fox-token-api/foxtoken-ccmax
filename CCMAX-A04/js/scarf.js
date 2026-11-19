window.PG = window.PG || {};

PG.Scarf = function (scene, opts) {
  const CW = opts.cols || 5, CH = opts.rows || 20;
  const SEG = opts.seg || 0.06;
  const N = CW * CH;
  const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3), inv = new Float32Array(N);
  const cons = [];
  const id = (i, j) => j * CW + i;
  let iters = 14;

  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    const k = id(i, j);
    pos[k * 3] = (i - (CW - 1) / 2) * SEG; pos[k * 3 + 1] = 1.5 - j * SEG; pos[k * 3 + 2] = 0;
    prev.set(pos.subarray(k * 3, k * 3 + 3), k * 3);
    inv[k] = j === 0 ? 0 : 1;
  }
  const link = (a, b, stiff) => {
    const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
    cons.push([a, b, Math.hypot(dx, dy, dz), stiff]);
  };
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    if (i < CW - 1) link(id(i, j), id(i + 1, j), 1);
    if (j < CH - 1) link(id(i, j), id(i, j + 1), 1);
    if (i < CW - 1 && j < CH - 1) { link(id(i, j), id(i + 1, j + 1), 0.6); link(id(i + 1, j), id(i, j + 1), 0.6); }
    if (j < CH - 2) link(id(i, j), id(i, j + 2), 0.25);
    if (i < CW - 2) link(id(i, j), id(i + 2, j), 0.25);
  }

  const geo = new THREE.BufferGeometry();
  const rpos = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const uv = new Float32Array(N * 2);
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) { uv[id(i, j) * 2] = i / (CW - 1); uv[id(i, j) * 2 + 1] = j / (CH - 1); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let j = 0; j < CH - 1; j++) for (let i = 0; i < CW - 1; i++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  geo.setIndex(idx);
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#c8161c'; g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#e8343a';
    for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 64, 6);
    g.fillStyle = '#f6e7c8';
    g.fillRect(0, 236, 64, 6); g.fillRect(0, 248, 64, 3);
    for (let x = 0; x < 64; x += 8) { g.fillStyle = '#9a0f14'; g.fillRect(x, 252, 4, 4); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);

  const fx = new Float32Array(N * 3);
  const spheres = [];
  let acc = 0, t = 0, inited = false;
  const tmp = new THREE.Vector3();

  function setPins(pins) {
    for (let i = 0; i < CW; i++) {
      const k = id(i, 0);
      pos[k * 3] = pins[i].x; pos[k * 3 + 1] = pins[i].y; pos[k * 3 + 2] = pins[i].z;
    }
    if (!inited) {
      inited = true;
      for (let j = 1; j < CH; j++) for (let i = 0; i < CW; i++) {
        const k = id(i, j);
        pos[k * 3] = pins[i].x; pos[k * 3 + 1] = pins[i].y - j * SEG * 0.3; pos[k * 3 + 2] = pins[i].z + j * SEG * 0.95;
        prev[k * 3] = pos[k * 3]; prev[k * 3 + 1] = pos[k * 3 + 1]; prev[k * 3 + 2] = pos[k * 3 + 2];
      }
    }
  }

  function windForces(wind, h) {
    fx.fill(0);
    for (let q = 0; q < idx.length; q += 3) {
      const a = idx[q], b = idx[q + 1], c = idx[q + 2];
      const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
      const e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az;
      const e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const len = Math.hypot(nx, ny, nz) + 1e-9;
      const area = len * 0.5;
      const ux = nx / len, uy = ny / len, uz = nz / len;
      let vx = 0, vy = 0, vz = 0;
      for (const p of [a, b, c]) { vx += pos[p * 3] - prev[p * 3]; vy += pos[p * 3 + 1] - prev[p * 3 + 1]; vz += pos[p * 3 + 2] - prev[p * 3 + 2]; }
      vx /= 3 * h; vy /= 3 * h; vz /= 3 * h;
      const rx = wind.x - vx, ry = wind.y - vy, rz = wind.z - vz;
      const dn = rx * ux + ry * uy + rz * uz;
      const f = 1.6 * dn * Math.abs(dn) * area / 3;
      const lift = 0.12 * Math.hypot(rx, ry, rz) * area / 3;
      for (const p of [a, b, c]) {
        fx[p * 3] += f * ux + lift * rx; fx[p * 3 + 1] += f * uy + lift * ry; fx[p * 3 + 2] += f * uz + lift * rz;
      }
    }
  }

  function step(h, wind, frameAccel) {
    windForces(wind, h);
    const mass = 0.006;
    for (let k = 0; k < N; k++) {
      if (!inv[k]) continue;
      const o = k * 3;
      for (let a = 0; a < 3; a++) {
        const p = pos[o + a];
        const vel = (p - prev[o + a]) * 0.992;
        const g = a === 1 ? -9.8 : 0;
        prev[o + a] = p;
        pos[o + a] = p + vel + (g - frameAccel[a] + fx[o + a] / mass) * h * h;
      }
    }
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < cons.length; c++) {
        const [a, b, rest, st] = cons[c];
        const wa = inv[a], wb = inv[b];
        if (wa + wb === 0) continue;
        const ao = a * 3, bo = b * 3;
        const dx = pos[bo] - pos[ao], dy = pos[bo + 1] - pos[ao + 1], dz = pos[bo + 2] - pos[ao + 2];
        const d = Math.hypot(dx, dy, dz) + 1e-9;
        const diff = (d - rest) / (d * (wa + wb)) * st;
        pos[ao] += dx * diff * wa; pos[ao + 1] += dy * diff * wa; pos[ao + 2] += dz * diff * wa;
        pos[bo] -= dx * diff * wb; pos[bo + 1] -= dy * diff * wb; pos[bo + 2] -= dz * diff * wb;
      }
      for (const s of spheres) {
        for (let k = 0; k < N; k++) {
          if (!inv[k]) continue;
          const o = k * 3;
          const dx = pos[o] - s.c.x, dy = pos[o + 1] - s.c.y, dz = pos[o + 2] - s.c.z;
          const d = Math.hypot(dx, dy, dz);
          if (d < s.r && d > 1e-6) {
            const m = s.r / d;
            pos[o] = s.c.x + dx * m; pos[o + 1] = s.c.y + dy * m; pos[o + 2] = s.c.z + dz * m;
          }
        }
      }
      if (opts.floorY !== undefined) {
        for (let k = 0; k < N; k++) if (pos[k * 3 + 1] < opts.floorY) pos[k * 3 + 1] = opts.floorY;
      }
    }
  }

  const lastVel = new THREE.Vector3(), curVel = new THREE.Vector3(), accel = [0, 0, 0];

  function update(dt, pins, wind, frameVel, colliders) {
    spheres.length = 0;
    for (const c of colliders) spheres.push(c);
    const h = 1 / 120;
    dt = Math.min(dt, 0.05);
    curVel.copy(frameVel);
    tmp.copy(curVel).sub(lastVel).divideScalar(Math.max(dt, 1e-3));
    tmp.clampLength(0, 30);
    lastVel.copy(curVel);
    accel[0] = 0; accel[1] = 0; accel[2] = 0;
    acc += dt;
    let n = 0;
    const p0 = pins.map(p => p.clone());
    const p1 = pins;
    const startPins = [];
    for (let i = 0; i < CW; i++) { const k = id(i, 0); startPins.push(new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])); }
    const steps = Math.min(6, Math.floor(acc / h));
    for (let s = 0; s < steps; s++) {
      t += h;
      const f = (s + 1) / steps;
      const ip = startPins.map((sp, i) => sp.clone().lerp(p1[i], f));
      if (!inited) setPins(p0); else setPins(ip);
      const gust = 1 + 0.25 * Math.sin(t * 7.3) + 0.15 * Math.sin(t * 17.1 + 1.3);
      const w = { x: wind.x * gust + Math.sin(t * 5.1) * 0.6, y: wind.y + Math.sin(t * 9.7) * 0.5, z: wind.z * gust };
      step(h, w, accel);
      n++;
    }
    acc -= steps * h;
    if (acc > h * 3) acc = 0;
    if (!inited) setPins(p1);
    rpos.set(pos);
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
    return n;
  }

  function setQuality(q) { iters = q === 'high' ? 14 : q === 'mid' ? 9 : 6; }
  function shift(dx, dy, dz) {
    for (let k = 0; k < N; k++) {
      pos[k * 3] += dx; pos[k * 3 + 1] += dy; pos[k * 3 + 2] += dz;
      prev[k * 3] += dx; prev[k * 3 + 1] += dy; prev[k * 3 + 2] += dz;
    }
  }

  return { mesh, update, setQuality, shift, cols: CW };
};
