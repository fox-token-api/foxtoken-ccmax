(function () {
const PK = window.PK;
const V3 = THREE.Vector3;

function fishGeo() {
  const g = new THREE.SphereGeometry(1, 14, 10);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const z = pa.getZ(i);
    const taper = z > 0 ? 1 - z * 0.55 : 1 + z * 0.15;
    pa.setX(i, pa.getX(i) * 0.09 * taper);
    pa.setY(i, pa.getY(i) * 0.12 * taper);
    pa.setZ(i, z * 0.26);
  }
  g.computeVertexNormals();
  return g;
}

PK.createEntities = function (scene) {
  const bodyG = fishGeo();
  const tailG = new THREE.ConeGeometry(0.1, 0.14, 4);
  tailG.rotateX(Math.PI / 2); tailG.scale(0.25, 1, 1);
  const finG = new THREE.PlaneGeometry(0.42, 0.16);
  const silver = new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.25, metalness: 0.65, emissive: 0x0a1820 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc531, roughness: 0.2, metalness: 0.8, emissive: 0x6a3a00 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x4c7fb0, roughness: 0.3, metalness: 0.55, emissive: 0x08121e });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xb8d4e6, roughness: 0.4, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const glowMat = new THREE.SpriteMaterial({ map: PK.glowTex(), color: 0xffd36a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });

  function makeFish(type) {
    const g = new THREE.Group();
    const mat = type === 'gold' ? gold : type === 'high' ? blue : silver;
    const b = new THREE.Mesh(bodyG, mat); b.castShadow = true; g.add(b);
    const t = new THREE.Mesh(tailG, mat); t.position.z = 0.3; g.add(t);
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(finG, finMat);
      f.position.set(s * 0.22, 0.02, -0.04); f.rotation.x = -Math.PI / 2; f.rotation.y = s * 0.2;
      g.add(f); g.userData['fin' + s] = f;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), eyeMat);
      e.position.set(s * 0.06, 0.03, -0.17); g.add(e);
    }
    if (type === 'gold') { const sp = new THREE.Sprite(glowMat); sp.scale.set(1.3, 1.3, 1); g.add(sp); }
    g.userData.tail = t;
    scene.add(g);
    return g;
  }

  // Crab
  const crabMat = new THREE.MeshStandardMaterial({ color: 0xd8452c, roughness: 0.5 });
  const crabEye = new THREE.MeshBasicMaterial({ color: 0x111111 });
  function makeCrab() {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), crabMat);
    shell.scale.set(1.2, 0.55, 0.85); shell.position.y = 0.12; shell.castShadow = true; g.add(shell);
    const legs = [];
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.32, 4), crabMat);
        l.position.set(s * 0.36, 0.08, -0.12 + i * 0.12); l.rotation.z = s * 1.1; g.add(l); legs.push(l);
      }
      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), crabMat);
      claw.scale.set(0.8, 0.6, 1.2); claw.position.set(s * 0.3, 0.2, -0.32); claw.castShadow = true; g.add(claw);
      g.userData['claw' + s] = claw;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 4), crabMat);
      stalk.position.set(s * 0.08, 0.3, -0.18); g.add(stalk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), crabEye);
      eye.position.set(s * 0.08, 0.38, -0.18); g.add(eye);
    }
    g.userData.legs = legs;
    scene.add(g);
    return g;
  }

  // Particles
  const PN = 600;
  const ppos = new Float32Array(PN * 3), pcol = new Float32Array(PN * 3);
  const pvel = new Float32Array(PN * 3), plife = new Float32Array(PN);
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3).setUsage(THREE.DynamicDrawUsage));
  pgeo.setAttribute('color', new THREE.BufferAttribute(pcol, 3).setUsage(THREE.DynamicDrawUsage));
  const pmat = new THREE.PointsMaterial({ size: 0.16, map: PK.glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(pgeo, pmat);
  points.frustumCulled = false;
  scene.add(points);
  let pHead = 0;
  for (let i = 0; i < PN; i++) ppos[i * 3 + 1] = -999;
  function burst(p, n, col, spread, up) {
    for (let k = 0; k < n; k++) {
      const i = pHead; pHead = (pHead + 1) % PN;
      ppos[i * 3] = p.x; ppos[i * 3 + 1] = p.y; ppos[i * 3 + 2] = p.z;
      pvel[i * 3] = (Math.random() - 0.5) * spread;
      pvel[i * 3 + 1] = up * (0.5 + Math.random());
      pvel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      plife[i] = 0.6 + Math.random() * 0.6;
      pcol[i * 3] = col.r; pcol[i * 3 + 1] = col.g; pcol[i * 3 + 2] = col.b;
    }
  }
  const cSplash = new THREE.Color(0.75, 0.85, 0.95), cGold = new THREE.Color(1, 0.8, 0.3), cWhite = new THREE.Color(0.9, 0.9, 0.85), cDust = new THREE.Color(0.5, 0.45, 0.4);

  const E = { fish: [], crabs: [], burst };
  const tmp = new V3();
  E.spawnFish = function (z, lane, type) {
    const apexY = type === 'high' ? 3.05 : 1.75 + Math.random() * 0.2;
    const D = 32 + Math.random() * 10;
    const sx = PK.shoreX(z) - 3 - Math.random() * 4;
    const f = { type, lane, x: sx, y: PK.SEA_Y, z, sx, apexY, D, mesh: makeFish(type), state: 'wait', u: 0, launched: false, wig: Math.random() * 6 };
    f.mesh.position.set(sx, -3, z);
    f.mesh.visible = false;
    E.fish.push(f);
    return f;
  };
  E.spawnCrab = function (z, lane) {
    const c = { lane, x: PK.LANES[lane], z, mesh: makeCrab(), hit: false, passed: false, ph: Math.random() * 6, scuttle: (Math.random() - 0.5) * 0.3, vx: 0, vy: 0 };
    c.mesh.position.set(c.x, 0, z);
    E.crabs.push(c);
    return c;
  };
  E.remove = function (o) {
    scene.remove(o.mesh);
    o.mesh.traverse(m => { if (!m.isSprite && m.geometry && m.geometry !== bodyG && m.geometry !== tailG && m.geometry !== finG) m.geometry.dispose(); });
  };

  E.update = function (dt, t, player, dz, onLaunch) {
    for (const f of E.fish) {
      if (f.state === 'caught' || f.state === 'gone') continue;
      if (!f.launched) {
        if (player.z - 0.9 - f.z > f.D) continue;
        f.launched = true; f.mesh.visible = true; f.u = 0;
        tmp.set(f.sx, PK.SEA_Y + 0.1, f.z); burst(tmp, 26, cSplash, 3.5, 4);
        onLaunch && onLaunch(f);
      }
      f.u += dz / f.D;
      const lx = PK.LANES[f.lane];
      const u = f.u;
      const x = f.sx + (lx - f.sx) * u;
      const top = f.apexY - PK.SEA_Y;
      const y = PK.SEA_Y + top * (1 - (u - 1) * (u - 1));
      const vx = (lx - f.sx), vy = -2 * top * (u - 1);
      f.x = x; f.y = y;
      f.mesh.position.set(x, y, f.z);
      f.mesh.rotation.set(0, 0, 0);
      f.mesh.rotation.order = 'YXZ';
      f.mesh.rotation.y = Math.PI / 2 * (vx > 0 ? -1 : 1);
      f.mesh.rotation.x = Math.atan2(vy, Math.abs(vx)) * 0.8;
      f.mesh.userData.tail.rotation.y = Math.sin(t * 22 + f.wig) * 0.6;
      f.mesh.userData.fin1.rotation.z = Math.sin(t * 30) * 0.3;
      f.mesh.userData['fin-1'].rotation.z = -Math.sin(t * 30) * 0.3;
      if (u > 1.08 && f.state === 'wait') f.state = 'missed';
      if (u > 1 && y < 0.05) { f.state = 'gone'; f.mesh.visible = false; tmp.set(x, 0.1, f.z); burst(tmp, 10, cWhite, 2, 2); }
    }
    for (const c of E.crabs) {
      c.ph += dt * 8;
      if (c.hit) {
        c.vy -= 20 * dt; c.x += c.vx * dt;
        c.mesh.position.set(c.x, Math.max(-0.5, c.mesh.position.y + c.vy * dt), c.z);
        c.mesh.rotation.z += dt * 9;
        continue;
      }
      c.x = PK.LANES[c.lane] + Math.sin(c.ph * 0.18) * 0.35 + c.scuttle;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = Math.sin(c.ph * 0.18) * 0.3;
      c.mesh.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(c.ph * 2 + i) * 0.4; });
      c.mesh.userData.claw1.position.y = 0.2 + Math.max(0, Math.sin(c.ph)) * 0.08;
      c.mesh.userData['claw-1'].position.y = 0.2 + Math.max(0, Math.sin(c.ph + 1.5)) * 0.08;
    }
    for (let i = 0; i < PN; i++) {
      if (plife[i] <= 0) continue;
      plife[i] -= dt;
      const k = i * 3;
      pvel[k + 1] -= 9 * dt;
      ppos[k] += pvel[k] * dt; ppos[k + 1] += pvel[k + 1] * dt; ppos[k + 2] += pvel[k + 2] * dt;
      pcol[k] *= 0.985; pcol[k + 1] *= 0.985; pcol[k + 2] *= 0.985;
      if (plife[i] <= 0) ppos[k + 1] = -999;
    }
    pgeo.attributes.position.needsUpdate = true;
    pgeo.attributes.color.needsUpdate = true;
  };
  E.colors = { cSplash, cGold, cWhite, cDust };
  return E;
};
})();
