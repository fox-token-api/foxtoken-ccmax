(function () {
const PK = window.PK;
const V3 = THREE.Vector3;
const UPY = new V3(0, 1, 0);

function limb(mesh, a, b) {
  const d = new V3().subVectors(b, a);
  const len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(UPY, d.divideScalar(len || 1));
  mesh.scale.set(1, len, 1);
}
function tube(mat, r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat);
  m.castShadow = true;
  return m;
}

PK.createRider = function (scene) {
  const mats = {
    frame: new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.35, metalness: 0.4 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc9ccd2, roughness: 0.25, metalness: 0.9 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1b1b1d, roughness: 0.9 }),
    saddle: new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.6 }),
    feather: new THREE.MeshStandardMaterial({ color: 0xece9e2, roughness: 0.85 }),
    crown: new THREE.MeshStandardMaterial({ color: 0xf1e4b8, roughness: 0.85 }),
    wing: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: 0xeaa53c, roughness: 0.5 }),
    pouch: new THREE.MeshStandardMaterial({ color: 0xd9774a, roughness: 0.55 }),
    leg: new THREE.MeshStandardMaterial({ color: 0xe07b39, roughness: 0.6 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.25, metalness: 0.1 }),
    vent: new THREE.MeshStandardMaterial({ color: 0x1d1d22, roughness: 0.5 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0b0d14, roughness: 0.05, metalness: 0.95 }),
    scarf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4d6 }),
    tail: new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  };

  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.347, 0.52);
  const bike = new THREE.Group();
  bike.position.set(0, -0.347, -0.52);
  root.add(pivot); pivot.add(bike);
  scene.add(root);

  // Wheels
  function wheel(z) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.032, 10, 36), mats.tire);
    tire.rotation.y = Math.PI / 2; tire.castShadow = true; g.add(tire);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.01, 6, 36), mats.chrome);
    rim.rotation.y = Math.PI / 2; g.add(rim);
    const sp = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      sp.push(new V3(0, 0, 0), new V3(0, Math.cos(a) * 0.29, Math.sin(a) * 0.29));
    }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), new THREE.LineBasicMaterial({ color: 0xaab0b8 })));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), mats.chrome);
    hub.rotation.z = Math.PI / 2; g.add(hub);
    g.position.set(0, 0.347, z);
    bike.add(g);
    return g;
  }
  const wF = wheel(-0.52), wR = wheel(0.52);

  const P = {
    rh: new V3(0, 0.347, 0.52), fh: new V3(0, 0.347, -0.52), bb: new V3(0, 0.3, 0.05),
    st: new V3(0, 0.86, 0.2), ht: new V3(0, 0.9, -0.36), hb: new V3(0, 0.7, -0.41)
  };
  [[P.rh, P.bb], [P.bb, P.st], [P.st, P.rh], [P.st, P.ht], [P.bb, P.hb], [P.ht, P.hb]].forEach(([a, b]) => {
    const t = tube(mats.frame, 0.022); limb(t, a, b); bike.add(t);
  });
  for (const s of [-1, 1]) {
    const f = tube(mats.chrome, 0.014); limb(f, P.hb.clone().setX(s * 0.03), P.fh.clone().setX(s * 0.04)); bike.add(f);
  }
  const stemTop = new V3(0, 1.02, -0.4);
  const stem = tube(mats.chrome, 0.016); limb(stem, P.ht, stemTop); bike.add(stem);
  const bar = tube(mats.chrome, 0.014); limb(bar, new V3(-0.27, 1.03, -0.44), new V3(0.27, 1.03, -0.44)); bike.add(bar);
  for (const s of [-1, 1]) {
    const grip = tube(mats.tire, 0.022); limb(grip, new V3(s * 0.18, 1.03, -0.44), new V3(s * 0.28, 1.03, -0.44)); bike.add(grip);
  }
  const sp = tube(mats.chrome, 0.013); limb(sp, P.st, new V3(0, 0.95, 0.23)); bike.add(sp);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), mats.saddle);
  saddle.position.set(0, 0.97, 0.22); saddle.castShadow = true; bike.add(saddle);
  const fender = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 4, 20, Math.PI * 0.55), mats.frame);
  fender.rotation.y = Math.PI / 2; fender.rotation.x = 0.35; fender.position.copy(P.rh); bike.add(fender);

  const crank = new THREE.Group();
  crank.position.copy(P.bb); bike.add(crank);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 24), mats.chrome);
  ring.rotation.y = Math.PI / 2; ring.position.x = 0.05; crank.add(ring);
  const crankArms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.03), mats.chrome);
    arm.geometry.translate(0, 0.085 * s, 0); arm.position.x = s * 0.08;
    crank.add(arm); crankArms.push(arm);
  }

  // Headlight + tail light
  const headLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.07, 12), mats.lamp);
  headLamp.rotation.x = Math.PI / 2; headLamp.position.set(0, 0.92, -0.5); bike.add(headLamp);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PK.glowTex(), color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  lampGlow.scale.set(0.7, 0.7, 1); lampGlow.position.set(0, 0.92, -0.56); bike.add(lampGlow);
  const spot = new THREE.SpotLight(0xfff0cf, 0, 32, 0.42, 0.5, 1.2);
  spot.position.set(0, 0.92, -0.5); bike.add(spot);
  const spotT = new THREE.Object3D(); spotT.position.set(0, 0, -9); bike.add(spotT); spot.target = spotT;
  const tailLamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), mats.tail);
  tailLamp.position.set(0, 0.7, 0.8); bike.add(tailLamp);
  const tailGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PK.glowTex(), color: 0xff3030, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  tailGlow.scale.set(0.5, 0.5, 1); tailGlow.position.set(0, 0.7, 0.83); bike.add(tailGlow);

  // Pelican body
  const bird = new THREE.Group();
  bike.add(bird);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mats.feather);
  body.scale.set(0.3, 0.28, 0.46); body.position.set(0, 1.22, 0.1); body.rotation.x = -0.32; body.castShadow = true;
  bird.add(body);
  const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 8), mats.feather);
  tailF.rotation.x = Math.PI / 2 + 0.5; tailF.position.set(0, 1.3, 0.55); tailF.scale.z = 0.4; bird.add(tailF);

  const neckPivot = new THREE.Group();
  neckPivot.position.set(0, 1.3, -0.18);
  bird.add(neckPivot);
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, -1.3, 0.18);
  neckPivot.add(neckGroup);
  const neckCurve = new THREE.CatmullRomCurve3([new V3(0, 1.3, -0.18), new V3(0, 1.5, -0.2), new V3(0, 1.68, -0.12), new V3(0, 1.84, -0.2)]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 12, 0.085, 10), mats.feather);
  neck.castShadow = true; neckGroup.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 1.88, -0.22);
  neckGroup.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), mats.feather);
  skull.scale.set(0.95, 1, 1.15); skull.castShadow = true; head.add(skull);
  const crownF = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mats.crown);
  crownF.position.set(0, 0.02, 0.13); crownF.scale.set(0.8, 0.6, 1.5); head.add(crownF);

  // Beak: upper mandible fixed, jaw (lower mandible + pouch) hinged
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.8), mats.beak);
  { const pa = upper.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { const z = pa.getZ(i); const t = (0.4 - z) / 0.8; pa.setX(i, pa.getX(i) * (1 - t * 0.45)); } }
  upper.geometry.translate(0, 0, -0.4);
  upper.position.set(0, -0.02, -0.08); upper.rotation.x = -0.22; upper.castShadow = true; head.add(upper);
  const hook = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mats.pouch);
  hook.position.set(0, -0.025, -0.79); upper.add(hook);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.045, -0.08); jaw.rotation.x = -0.22; head.add(jaw);
  const lower = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.76), mats.beak);
  lower.geometry.translate(0, 0, -0.38); jaw.add(lower);
  const pouch = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.pouch);
  pouch.scale.set(0.055, 0.1, 0.34); pouch.position.set(0, 0, -0.34); pouch.castShadow = true; jaw.add(pouch);

  // Helmet
  const helmet = new THREE.Group();
  helmet.position.set(0, 0.04, 0.02); head.add(helmet);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.165, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.helmet);
  shell.scale.set(1, 0.85, 1.3); shell.castShadow = true; helmet.add(shell);
  for (let i = -1; i <= 1; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.22), mats.vent);
    vent.position.set(i * 0.06, 0.135 - Math.abs(i) * 0.03, 0); vent.rotation.z = -i * 0.4; helmet.add(vent);
  }
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.08), mats.helmet);
  visor.position.set(0, 0.02, -0.21); visor.rotation.x = -0.25; helmet.add(visor);
  for (const s of [-1, 1]) {
    const strap = tube(mats.vent, 0.006); limb(strap, new V3(s * 0.135, 0.0, 0.0), new V3(s * 0.06, -0.15, -0.02)); helmet.add(strap);
  }

  // Sunglasses
  const shades = new THREE.Group(); head.add(shades);
  for (const s of [-1, 1]) {
    const lensM = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), mats.lens);
    lensM.scale.set(0.4, 0.7, 1.05); lensM.position.set(s * 0.105, 0.03, -0.065); lensM.rotation.y = s * 0.35; shades.add(lensM);
    const arm = tube(mats.vent, 0.006); limb(arm, new V3(s * 0.12, 0.04, -0.03), new V3(s * 0.13, 0.04, 0.1)); shades.add(arm);
  }
  const bridge = tube(mats.vent, 0.008); limb(bridge, new V3(-0.1, 0.06, -0.1), new V3(0.1, 0.06, -0.1)); shades.add(bridge);

  // Neck ring of the scarf
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 20), new THREE.MeshStandardMaterial({ color: 0xd62f2f, roughness: 0.9 }));
  collar.position.set(0, 1.47, -0.2); collar.rotation.x = Math.PI / 2 + 0.25; collar.castShadow = true; neckGroup.add(collar);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), collar.material);
  knot.position.set(0, 1.45, -0.09); knot.scale.set(1.2, 0.9, 0.8); neckGroup.add(knot);

  // Wings
  const wingShape = new THREE.Shape();
  [[0, 0], [0.4, -0.05], [0.9, -0.03], [1.3, 0.05], [1.26, 0.18], [1.12, 0.26], [1.0, 0.3], [0.86, 0.34], [0.7, 0.4], [0.5, 0.42], [0.3, 0.4], [0, 0.3]]
    .forEach(([x, y], i) => i ? wingShape.lineTo(x, y) : wingShape.moveTo(x, y));
  const wingGeo = new THREE.ShapeGeometry(wingShape);
  wingGeo.rotateX(Math.PI / 2);
  { const pa = wingGeo.attributes.position, col = [];
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), d = THREE.MathUtils.smoothstep(x, 0.8, 1.1);
      col.push(0.93 - d * 0.7, 0.92 - d * 0.7, 0.9 - d * 0.68);
    }
    wingGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  const wings = [];
  const qFold = [], qSpread = [];
  for (const s of [-1, 1]) {
    const pivotW = new THREE.Group();
    pivotW.position.set(s * 0.24, 1.32, -0.02);
    const w = new THREE.Mesh(wingGeo, mats.wing);
    w.castShadow = true;
    if (s < 0) w.scale.x = -1;
    pivotW.add(w);
    bird.add(pivotW);
    const grip = new V3(s * 0.24, 1.03, -0.44).sub(pivotW.position).normalize();
    const qf = new THREE.Quaternion().setFromUnitVectors(new V3(s, 0, 0), grip);
    qf.multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), s * 1.2));
    const qs = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, s * 0.12, s * 0.12));
    qFold.push(qf); qSpread.push(qs);
    wings.push({ pivot: pivotW, mesh: w, s });
  }

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = tube(mats.feather, 0.06), shin = tube(mats.leg, 0.025);
    const foot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 3), mats.leg);
    foot.geometry.rotateX(-Math.PI / 2); foot.scale.y = 0.3; foot.castShadow = true;
    bird.add(thigh, shin, foot);
    legs.push({ s, thigh, shin, foot });
  }

  // Scarf cloth
  const CW = 4, CH = 17, SX = 0.055, SY = 0.075;
  const N = CW * CH;
  const pos = new Float64Array(N * 3), prev = new Float64Array(N * 3);
  const anchorsL = [];
  for (let i = 0; i < CW; i++) anchorsL.push(new V3((i - (CW - 1) / 2) * SX, 1.47, -0.06 + Math.abs(i - 1.5) * 0.015));
  const cons = [];
  const idx = (i, j) => j * CW + i;
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    if (i < CW - 1) cons.push(idx(i, j), idx(i + 1, j), SX);
    if (j < CH - 1) cons.push(idx(i, j), idx(i, j + 1), SY);
    if (i < CW - 1 && j < CH - 1) { const d = Math.hypot(SX, SY); cons.push(idx(i, j), idx(i + 1, j + 1), d, idx(i + 1, j), idx(i, j + 1), d); }
    if (j < CH - 2) cons.push(idx(i, j), idx(i, j + 2), SY * 2);
  }
  const C = new Float32Array(cons);
  const scarfGeo = new THREE.BufferGeometry();
  const gpos = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  gpos.setUsage(THREE.DynamicDrawUsage);
  scarfGeo.setAttribute('position', gpos);
  const sc = [];
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    const stripe = (j === CH - 3 || j === CH - 5) ? 1 : 0;
    const shade = 1 - j / CH * 0.15;
    if (stripe) sc.push(0.96, 0.92, 0.86); else sc.push(0.84 * shade, 0.16 * shade, 0.17 * shade);
  }
  scarfGeo.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const ind = [];
  for (let j = 0; j < CH - 1; j++) for (let i = 0; i < CW - 1; i++) {
    const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1);
    ind.push(a, c, b, b, c, d);
  }
  scarfGeo.setIndex(ind);
  const scarf = new THREE.Mesh(scarfGeo, mats.scarf);
  scarf.castShadow = true; scarf.frustumCulled = false;
  scene.add(scarf);

  const tmp = new V3(), tmp2 = new V3(), bodyC = new V3();
  const anchorsW = anchorsL.map(() => new V3());
  let iters = 8;

  function computeAnchors() {
    root.updateMatrixWorld(true);
    for (let i = 0; i < CW; i++) anchorsW[i].copy(anchorsL[i]).applyMatrix4(neckGroup.matrixWorld);
    bodyC.set(0, 1.18, 0.16).applyMatrix4(bird.matrixWorld);
  }
  function resetCloth() {
    computeAnchors();
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const k = idx(i, j) * 3, a = anchorsW[i];
      pos[k] = prev[k] = a.x; pos[k + 1] = prev[k + 1] = a.y - j * SY * 0.3; pos[k + 2] = prev[k + 2] = a.z + j * SY * 0.95;
    }
  }
  function stepCloth(h, t, speed, groundY) {
    const h2 = h * h, damp = 0.985, k = 2.6;
    for (let j = 1; j < CH; j++) {
      const f = j / (CH - 1);
      const flut = Math.min(speed, 22) * 0.9 * f;
      for (let i = 0; i < CW; i++) {
        const n = idx(i, j) * 3;
        const x = pos[n], y = pos[n + 1], z = pos[n + 2];
        const vx = (x - prev[n]) / h, vy = (y - prev[n + 1]) / h, vz = (z - prev[n + 2]) / h;
        const gust = Math.sin(t * 0.7) * 0.8 + Math.sin(t * 2.3 + 1) * 0.4;
        const ax = -k * vx + flut * Math.sin(t * 17 - j * 0.75 + i * 0.3) + gust;
        const ay = -9.8 - k * vy + flut * 0.55 * Math.sin(t * 13 - j * 0.6 + i * 0.5);
        const az = -k * vz;
        prev[n] = x; prev[n + 1] = y; prev[n + 2] = z;
        pos[n] = x + vx * h * damp + ax * h2;
        pos[n + 1] = y + vy * h * damp + ay * h2;
        pos[n + 2] = z + vz * h * damp + az * h2;
      }
    }
    for (let i = 0; i < CW; i++) { const n = i * 3; prev[n] = pos[n]; prev[n + 1] = pos[n + 1]; prev[n + 2] = pos[n + 2]; pos[n] = anchorsW[i].x; pos[n + 1] = anchorsW[i].y; pos[n + 2] = anchorsW[i].z; }
    const R = 0.29, R2 = R * R;
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < C.length; c += 3) {
        const a = C[c] * 3, b = C[c + 1] * 3, rest = C[c + 2];
        const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = (d - rest) / d;
        const pa = C[c] < CW ? 0 : 0.5, pb = C[c + 1] < CW ? 0 : 0.5;
        const wa = pa + pb ? pa / (pa + pb) : 0, wb = pa + pb ? pb / (pa + pb) : 0;
        pos[a] += dx * diff * wa; pos[a + 1] += dy * diff * wa; pos[a + 2] += dz * diff * wa;
        pos[b] -= dx * diff * wb; pos[b + 1] -= dy * diff * wb; pos[b + 2] -= dz * diff * wb;
      }
      for (let p = CW; p < N; p++) {
        const n = p * 3;
        const dx = pos[n] - bodyC.x, dy = pos[n + 1] - bodyC.y, dz = pos[n + 2] - bodyC.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < R2) { const d = Math.sqrt(d2) || 1e-6, s = R / d; pos[n] = bodyC.x + dx * s; pos[n + 1] = bodyC.y + dy * s; pos[n + 2] = bodyC.z + dz * s; }
        if (pos[n + 1] < groundY + 0.02) pos[n + 1] = groundY + 0.02;
      }
    }
  }

  const R = { root, mats };
  let acc = 0;
  R.setQuality = q => { iters = q >= 2 ? 10 : q === 1 ? 7 : 4; };
  R.resetCloth = resetCloth;
  R.update = function (dt, s) {
    root.position.set(s.x, s.y, s.z);
    root.rotation.z = s.lean;
    root.rotation.y = s.yaw || 0;
    pivot.rotation.x = s.wheelie;
    const roll = s.dist / 0.347;
    wF.rotation.x = -roll; wR.rotation.x = -roll;
    crank.rotation.x = -s.crank;
    const th = s.crank;
    const bob = Math.sin(th * 2) * 0.015;
    bird.position.y = bob;
    neckPivot.rotation.x = Math.sin(th * 2 + 0.6) * 0.03 - s.wheelie * 0.4 + s.look * 0.15;
    head.rotation.y = s.headYaw || 0;
    jaw.rotation.x = -0.22 - s.beakOpen * 0.5;
    const bulge = 1 + s.gulp * 0.9;
    pouch.scale.set(0.055 * (1 + s.gulp * 1.6), 0.1 * bulge, 0.34);
    for (let i = 0; i < 2; i++) {
      const w = wings[i];
      w.pivot.quaternion.copy(qFold[i]).slerp(qSpread[i], s.wing);
      const flap = s.wing * Math.sin(s.t * 9) * 0.18;
      w.pivot.rotateZ(w.s * flap);
      const sc = 0.45 + 0.55 * s.wing;
      w.mesh.scale.set(w.s < 0 ? -sc : sc, 1, 0.55 + 0.45 * s.wing);
    }
    for (const L of legs) {
      const a = th + (L.s > 0 ? 0 : Math.PI);
      const foot = new V3(L.s * 0.13, P.bb.y + 0.165 * Math.cos(a) - bob, P.bb.z - 0.165 * Math.sin(a));
      const hip = new V3(L.s * 0.12, 1.06, 0.14);
      const d = tmp.subVectors(foot, hip);
      const len = Math.min(d.length(), 0.94);
      const dir = d.normalize();
      const l1 = 0.48, l2 = 0.47;
      const aa = (l1 * l1 - l2 * l2 + len * len) / (2 * len);
      const hh = Math.sqrt(Math.max(l1 * l1 - aa * aa, 0));
      const bend = tmp2.set(0, 0.35, -1);
      bend.addScaledVector(dir, -bend.dot(dir)).normalize();
      const knee = hip.clone().addScaledVector(dir, aa).addScaledVector(bend, hh);
      limb(L.thigh, hip, knee); L.thigh.scale.x = L.thigh.scale.z = 1.1;
      limb(L.shin, knee, foot);
      L.foot.position.copy(foot).add(new V3(0, 0.02, -0.04));
    }
    const n = s.night;
    lampGlow.material.opacity = 0.2 + n * 0.8;
    tailGlow.material.opacity = 0.15 + n * 0.85;
    mats.lamp.color.setRGB(0.6 + 0.4 * n, 0.58 + 0.4 * n, 0.5 + 0.35 * n);
    spot.intensity = n * 2.4;

    computeAnchors();
    acc += Math.min(dt, 0.05);
    const H = 1 / 120;
    let steps = 0;
    while (acc >= H && steps < 6) { stepCloth(H, s.t, s.speed, 0); acc -= H; steps++; }
    if (steps === 6) acc = 0;
    gpos.array.set(pos);
    gpos.needsUpdate = true;
    scarfGeo.computeVertexNormals();
    scarfGeo.computeBoundingSphere();
  };
  R.headWorld = out => out.set(0, 0.07, -0.12).applyMatrix4(head.matrixWorld);
  R.povLook = out => out.set(0, -1.2, -10).applyMatrix4(head.matrixWorld);
  R.setPOV = on => { skull.visible = helmet.visible = shades.visible = crownF.visible = !on; };
  R.beakWorld = (out, t) => out.set(0, -0.05, -0.08 - 0.75 * t).applyMatrix4(head.matrixWorld);
  R.forwardWorld = out => out.set(0, 0, -1).transformDirection(head.matrixWorld);
  R.pouchWorld = out => out.set(0, -0.08, -0.4).applyMatrix4(head.matrixWorld);
  return R;
};
})();
