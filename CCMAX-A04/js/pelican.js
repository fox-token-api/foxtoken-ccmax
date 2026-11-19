window.PG = window.PG || {};

PG.Pelican = (function () {
  const R = 0.36, WB = 0.52;
  const up = new THREE.Vector3(0, 1, 0);
  const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));

  function limb(mesh, a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const L = d.length();
    mesh.position.copy(a).addScaledVector(d, 0.5);
    mesh.quaternion.setFromUnitVectors(up, d.divideScalar(L || 1));
    mesh.scale.set(1, L, 1);
  }
  const unitCyl = (r1, r2, seg) => new THREE.CylinderGeometry(r1, r2, 1, seg || 8);

  function tube(points, radius, mat, segs) {
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, segs || 20, radius, 8, false), mat);
  }

  function wheel(mats) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R - 0.025, 0.028, 8, 32), mats.tire);
    tire.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.055, 0.012, 6, 32), mats.rim);
    rim.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(unitCyl(0.03, 0.03, 10), mats.rim);
    hub.rotation.z = Math.PI / 2; hub.scale.y = 0.1;
    g.add(tire, rim, hub);
    const sg = unitCyl(0.004, 0.004, 3);
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Mesh(sg, mats.spoke);
      const a = i / 16 * Math.PI * 2;
      const side = (i % 2 ? 1 : -1) * 0.03;
      limb(s, new THREE.Vector3(side, 0, 0), new THREE.Vector3(0, Math.cos(a) * (R - 0.06), Math.sin(a) * (R - 0.06)));
      g.add(s);
    }
    const ref = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: '#ff9a20' }));
    ref.position.set(0.0, R * 0.55, 0);
    g.add(ref);
    return g;
  }

  function create(scene) {
    const mats = {
      frame: std('#1f8fd6', { metalness: 0.55, roughness: 0.3 }),
      tire: std('#1a1a1a', { roughness: 0.9 }),
      rim: std('#c9ccd0', { metalness: 0.9, roughness: 0.25 }),
      spoke: std('#d8d8d8', { metalness: 0.9, roughness: 0.3 }),
      black: std('#222', { roughness: 0.6 }),
      feather: std('#f2efe8', { roughness: 0.9 }),
      grey: std('#b9b8b4', { roughness: 0.9 }),
      dark: std('#3c3b3a', { roughness: 0.9 }),
      beak: std('#f2a93b', { roughness: 0.5 }),
      pouch: std('#e88a4a', { roughness: 0.6 }),
      leg: std('#f08a2a', { roughness: 0.6 }),
      helmet: std('#ff3b30', { metalness: 0.2, roughness: 0.35 }),
      stripe: std('#ffffff', { roughness: 0.4 }),
      lens: new THREE.MeshPhysicalMaterial({ color: '#111', metalness: 0.9, roughness: 0.08, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.8 }),
      lamp: new THREE.MeshBasicMaterial({ color: '#fff6dd' }),
      tail: new THREE.MeshBasicMaterial({ color: '#ff2a20' }),
    };

    const root = new THREE.Group();
    const pivot = new THREE.Group(); pivot.position.set(0, R, WB);
    const body = new THREE.Group(); body.position.set(0, -R, -WB);
    pivot.add(body); root.add(pivot);
    scene.add(root);

    const rearW = wheel(mats); rearW.position.set(0, R, WB);
    const frontW = wheel(mats); frontW.position.set(0, R, -WB);
    body.add(rearW);

    const bb = new THREE.Vector3(0, 0.33, 0.04);
    const seatTop = new THREE.Vector3(0, 0.86, 0.22);
    const headTube = new THREE.Vector3(0, 0.78, -0.38);
    const headLow = new THREE.Vector3(0, 0.62, -0.42);
    const tubeG = unitCyl(0.022, 0.022, 8);
    const fr = (a, b, r) => { const m = new THREE.Mesh(tubeG, mats.frame); limb(m, a, b); if (r) m.scale.x = m.scale.z = r; body.add(m); return m; };
    const rearAx = new THREE.Vector3(0, R, WB);
    fr(seatTop, bb); fr(seatTop, headTube); fr(bb, headLow, 1.15);
    for (const s of [-0.05, 0.05]) {
      fr(bb.clone().setX(s * 0.6), rearAx.clone().setX(s), 0.6);
      fr(seatTop.clone().setX(s * 0.4).setY(0.8), rearAx.clone().setX(s), 0.55);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.24), mats.black);
    seat.position.set(0, 0.9, 0.26); body.add(seat);
    const post = new THREE.Mesh(tubeG, mats.rim); limb(post, seatTop, new THREE.Vector3(0, 0.9, 0.25)); body.add(post);

    const steer = new THREE.Group();
    steer.position.copy(headTube);
    steer.rotation.x = -0.3;
    body.add(steer);
    const fork = new THREE.Group(); steer.add(fork);
    const axleLocal = new THREE.Vector3(0, R, -WB).sub(headTube).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
    for (const s of [-0.05, 0.05]) {
      const m = new THREE.Mesh(tubeG, mats.rim); m.scale.x = m.scale.z = 0.8;
      limb(m, new THREE.Vector3(s * 0.6, 0.08, 0), axleLocal.clone().setX(s));
      fork.add(m);
    }
    frontW.position.copy(axleLocal);
    frontW.rotation.x = 0;
    fork.add(frontW);
    const stem = new THREE.Mesh(tubeG, mats.black); limb(stem, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.2, -0.02)); fork.add(stem);
    const bar = new THREE.Mesh(tubeG, mats.black); bar.scale.x = bar.scale.z = 0.9;
    limb(bar, new THREE.Vector3(-0.28, 0.2, 0.02), new THREE.Vector3(0.28, 0.2, 0.02)); fork.add(bar);
    for (const s of [-1, 1]) {
      const gr = new THREE.Mesh(unitCyl(0.03, 0.03, 8), mats.black);
      limb(gr, new THREE.Vector3(s * 0.2, 0.2, 0.02), new THREE.Vector3(s * 0.3, 0.205, 0.05)); fork.add(gr);
    }
    const lampBox = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.08, 12), mats.black);
    lampBox.rotation.x = Math.PI / 2; lampBox.position.set(0, 0.13, -0.08); fork.add(lampBox);
    const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 14), mats.lamp);
    lampLens.position.set(0, 0.13, -0.121); lampLens.rotation.y = Math.PI; fork.add(lampLens);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22, 3, 2, 3), new THREE.MeshStandardMaterial({ color: '#c9a36a', wireframe: true }));
    basket.position.set(0, 0.24, -0.2); fork.add(basket);
    const basketBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.22), std('#8a6a3a'));
    basketBase.position.set(0, 0.16, -0.2); fork.add(basketBase);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.015), mats.tail);
    tailL.position.set(0, 0.84, 0.47); body.add(tailL);

    const crank = new THREE.Group(); crank.position.copy(bb); body.add(crank);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 24), mats.rim); ring.rotation.y = Math.PI / 2; ring.position.x = 0.045;
    crank.add(ring);
    const chain = new THREE.Mesh(tubeG, mats.dark); chain.scale.x = chain.scale.z = 0.25;
    limb(chain, bb.clone().setX(0.045).add(new THREE.Vector3(0, 0.09, 0)), rearAx.clone().setX(0.045).add(new THREE.Vector3(0, 0.04, 0)));
    body.add(chain);
    const arms = [], pedals = [];
    for (const s of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.03), mats.rim);
      arm.geometry.translate(0, -0.085, 0);
      arm.position.x = s * 0.07;
      crank.add(arm); arms.push(arm);
      const pd = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.06), mats.black);
      body.add(pd); pedals.push(pd);
    }

    const bird = new THREE.Group(); body.add(bird);
    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mats.feather);
    torso.scale.set(0.21, 0.24, 0.33);
    torso.position.set(0, 1.12, 0.15); torso.rotation.x = 0.55;
    bird.add(torso);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mats.grey);
    belly.scale.set(0.17, 0.2, 0.24); belly.position.set(0, 1.0, 0.24); bird.add(belly);
    const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 8), mats.dark);
    tailF.position.set(0, 1.05, 0.5); tailF.rotation.x = 1.9; tailF.scale.z = 0.4; bird.add(tailF);

    const neckPts = [new THREE.Vector3(0, 1.24, -0.06), new THREE.Vector3(0, 1.42, -0.12), new THREE.Vector3(0, 1.58, -0.06), new THREE.Vector3(0, 1.7, -0.12)];
    const neck = tube(neckPts, 0.075, mats.feather, 16); bird.add(neck);
    const head = new THREE.Group(); head.position.set(0, 1.74, -0.15); bird.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 14), mats.feather);
    skull.scale.set(0.9, 1, 1.15); head.add(skull);
    const crest = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std('#f5e3a0'));
    crest.scale.set(0.7, 0.6, 1.6); crest.position.set(0, 0.03, 0.12); head.add(crest);

    const beakG = new THREE.Group(); beakG.position.set(0, -0.02, -0.08); beakG.rotation.x = -0.12; head.add(beakG);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.62), mats.beak);
    upper.geometry.translate(0, 0, -0.31);
    upper.scale.x = 1; beakG.add(upper);
    const hook = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), std('#d86a2a'));
    hook.position.set(0, -0.012, -0.62); hook.scale.set(1, 0.8, 1.2); beakG.add(hook);
    const lower = new THREE.Group(); lower.position.set(0, -0.02, 0); beakG.add(lower);
    const lowerBar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.6), mats.beak);
    lowerBar.geometry.translate(0, 0, -0.3); lower.add(lowerBar);
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mats.pouch);
    pouch.scale.set(0.045, 0.09, 0.28); pouch.position.set(0, 0.0, -0.27); lower.add(pouch);
    const pouchFish = new THREE.Group(); pouchFish.position.set(0, -0.04, -0.27); lower.add(pouchFish);

    const helmet = new THREE.Group(); helmet.position.set(0, 0.035, 0.01); head.add(helmet);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.helmet);
    shell.scale.set(0.95, 0.85, 1.18); helmet.add(shell);
    for (const x of [-0.045, 0, 0.045]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.3), mats.stripe);
      st.position.set(x, 0.112 - Math.abs(x) * 0.5, 0); helmet.add(st);
    }
    for (const x of [-0.06, 0.06]) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.12), mats.black);
      vent.position.set(x * 0.8, 0.1, 0.03); vent.rotation.z = x * 3; helmet.add(vent);
    }
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.06), mats.helmet);
    visor.position.set(0, 0.0, -0.16); visor.rotation.x = 0.25; helmet.add(visor);
    for (const s of [-1, 1]) {
      const strap = tube([new THREE.Vector3(s * 0.11, 0.0, 0.0), new THREE.Vector3(s * 0.1, -0.07, -0.03), new THREE.Vector3(s * 0.05, -0.12, -0.05)], 0.006, mats.black, 6);
      helmet.add(strap);
    }

    const shades = new THREE.Group(); shades.position.set(0, 0.015, -0.05); head.add(shades);
    for (const s of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mats.lens);
      lens.rotation.set(Math.PI / 2 + 0.05, 0, s * 0.55);
      lens.position.set(s * 0.06, 0, -0.05);
      lens.scale.set(1.15, 0.5, 0.8);
      shades.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.13), mats.black);
      arm.position.set(s * 0.095, 0.01, 0.02); arm.rotation.y = -s * 0.15; shades.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), mats.black);
    bridge.position.set(0, 0.012, -0.095); shades.add(bridge);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.032, 8, 20), PG.scarfMat || std('#c8161c', { roughness: 0.85 }));
    collar.rotation.x = Math.PI / 2 - 0.35; collar.position.set(0, 1.5, -0.1); collar.scale.set(1, 1.1, 1);
    bird.add(collar);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), collar.material);
    knot.position.set(0, 1.47, -0.0); bird.add(knot);

    const wings = [];
    for (const s of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.17, 1.22, 0.02); bird.add(sh);
      const upperW = new THREE.Group(); sh.add(upperW);
      const uw = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.feather);
      uw.scale.set(0.045, 0.06, 0.2); uw.position.set(0, 0, -0.18);
      upperW.add(uw);
      const elbow = new THREE.Group(); elbow.position.set(0, 0, -0.36); upperW.add(elbow);
      const fw = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.feather);
      fw.scale.set(0.035, 0.05, 0.2); fw.position.set(0, 0, -0.18); elbow.add(fw);
      const prim = new THREE.Group(); prim.position.set(0, 0, -0.34); elbow.add(prim);
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.05, 0.22), mats.dark);
        f.geometry.translate(0, 0, -0.1);
        f.position.set(0, 0, 0); f.rotation.y = s * (i - 2) * 0.14; f.rotation.x = -0.05 * i;
        prim.add(f);
      }
      const sec = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.12, 0.55), mats.dark);
      sec.position.set(0, -0.06, 0.08); sec.scale.y = 0.6;
      elbow.add(sec);
      const sec2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.32), mats.grey);
      sec2.position.set(0, -0.05, -0.18); upperW.add(sec2);
      wings.push({ s, sh, upperW, elbow, prim, sec, sec2 });
    }

    const legs = [];
    for (const s of [1, -1]) {
      const th = new THREE.Mesh(unitCyl(0.035, 0.028, 8), mats.feather);
      const sn = new THREE.Mesh(unitCyl(0.018, 0.016, 6), mats.leg);
      const ft = new THREE.Group();
      const web = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 3), mats.leg);
      web.rotation.x = -Math.PI / 2; web.scale.y = 1; web.scale.z = 0.25; web.position.z = -0.03;
      ft.add(web);
      bird.add(th, sn, ft);
      legs.push({ s, th, sn, ft });
    }

    const headLight = new THREE.SpotLight('#fff4dd', 0, 32, 0.55, 0.5, 1.2);
    headLight.position.set(0, 0.13, -0.1); fork.add(headLight);
    const hlTarget = new THREE.Object3D(); hlTarget.position.set(0, -0.5, -6); fork.add(hlTarget);
    headLight.target = hlTarget;
    const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PG.Scenery.glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    lampGlow.position.set(0, 0.13, -0.16); lampGlow.scale.set(0.7, 0.7, 1); fork.add(lampGlow);

    const shadowTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.012; shadow.renderOrder = 2;
    scene.add(shadow);

    const fishGeo = new THREE.SphereGeometry(1, 8, 6);
    const fishMat = std('#9fb7c8', { metalness: 0.6, roughness: 0.3 });
    function setPouchFish(n) {
      while (pouchFish.children.length < Math.min(n, 4)) {
        const f = new THREE.Mesh(fishGeo, fishMat);
        const k = pouchFish.children.length;
        f.scale.set(0.02, 0.025, 0.08); f.position.set((k % 2 ? 0.01 : -0.01), -k * 0.012, (k - 1.5) * 0.06);
        pouchFish.add(f);
      }
      while (pouchFish.children.length > Math.min(n, 4)) pouchFish.remove(pouchFish.children[0]);
      pouch.scale.y = 0.09 + Math.min(n, 4) * 0.012;
    }

    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpK = new THREE.Vector3();
    const hipL = new THREE.Vector3();
    const ang = { crank: 0 };

    function solveLeg(L, hip, foot) {
      const a = 0.4, b = 0.38;
      const d = tmpA.subVectors(foot, hip);
      let dl = d.length();
      dl = Math.min(dl, a + b - 0.001);
      const dirN = d.clone().normalize();
      const x = (a * a - b * b + dl * dl) / (2 * dl);
      const h = Math.sqrt(Math.max(0, a * a - x * x));
      const fwd = new THREE.Vector3(0, 0, -1);
      const perp = fwd.sub(dirN.clone().multiplyScalar(fwd.dot(dirN))).normalize();
      const knee = tmpK.copy(hip).addScaledVector(dirN, x).addScaledVector(perp, h);
      const footP = hip.clone().addScaledVector(dirN, dl);
      limb(L.th, hip, knee);
      limb(L.sn, knee, footP);
      L.ft.position.copy(footP);
    }

    const pinLocal = [];
    for (let i = 0; i < 4; i++) pinLocal.push(new THREE.Vector3(-0.075 + i * 0.05, 1.49, -0.005));

    const UA = 0.36, FA = 0.34;
    const gripLocal = [new THREE.Vector3(0.25, 0.205, 0.035), new THREE.Vector3(-0.25, 0.205, 0.035)];
    const wv = { g: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), e: new THREE.Vector3(), u: new THREE.Vector3(), f: new THREE.Vector3(),
      x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), inv: new THREE.Matrix4(),
      qU: new THREE.Quaternion(), qF: new THREE.Quaternion(), qE: new THREE.Quaternion(), qS: new THREE.Quaternion(), eu: new THREE.Euler() };
    function boneQuat(dir, out) {
      wv.z.copy(dir).negate();
      wv.y.set(0, 1, 0);
      wv.x.crossVectors(wv.y, wv.z).normalize();
      wv.y.crossVectors(wv.z, wv.x);
      return out.setFromRotationMatrix(wv.m.makeBasis(wv.x, wv.y, wv.z));
    }
    function wingIK(W, idx, w, flap) {
      const sx = W.s;
      fork.updateWorldMatrix(true, false);
      bird.updateWorldMatrix(true, false);
      wv.inv.copy(bird.matrixWorld).invert();
      wv.g.copy(gripLocal[idx]).applyMatrix4(fork.matrixWorld).applyMatrix4(wv.inv).sub(W.sh.position);
      let d = wv.g.length();
      d = Math.min(UA + FA - 0.002, Math.max(Math.abs(UA - FA) + 0.01, d));
      wv.d.copy(wv.g).normalize();
      const a = (UA * UA - FA * FA + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, UA * UA - a * a));
      wv.p.set(sx, -0.35, 0.25);
      wv.p.addScaledVector(wv.d, -wv.d.dot(wv.p)).normalize();
      wv.e.copy(wv.d).multiplyScalar(a).addScaledVector(wv.p, h);
      wv.u.copy(wv.e).normalize();
      wv.f.copy(wv.d).multiplyScalar(d).sub(wv.e).normalize();
      boneQuat(wv.u, wv.qU);
      boneQuat(wv.f, wv.qF);
      wv.qE.copy(wv.qU).invert().multiply(wv.qF);
      W.sh.rotation.set(0, 0, sx * (0.3 * w + flap));
      wv.qS.setFromEuler(wv.eu.set(-0.1, -sx * 1.45, 0));
      W.upperW.quaternion.copy(wv.qU).slerp(wv.qS, w);
      wv.qS.setFromEuler(wv.eu.set(0, -sx * 0.2, 0));
      W.elbow.quaternion.copy(wv.qE).slerp(wv.qS, w);
      W.prim.rotation.set(-0.9 * (1 - w), -sx * 0.2 * w, 0);
    }

    const api = {
      root, pivot, body, bird, head, frontW, rearW, steer, fork, lower, crank, mats, headLight, lampGlow, shadow, beakG,
      wheelie: 0, wing: 0, gulp: 0, flap: 0,
      setPouchFish,
      update(dt, s) {
        ang.crank = s.crank;
        rearW.rotation.x = -s.wheelRot;
        frontW.rotation.x = -s.wheelRot;
        crank.rotation.x = -s.crank;
        for (let i = 0; i < 2; i++) {
          const a = -s.crank + i * Math.PI;
          arms[i].rotation.x = 0;
          const px = (i === 0 ? 1 : -1) * 0.1;
          const pp = new THREE.Vector3(px, bb.y - Math.cos(a) * 0.17, bb.z + Math.sin(a) * 0.17);
          pedals[i].position.copy(pp);
          const L = legs[i];
          hipL.set(L.s * 0.1, 0.98, 0.2);
          solveLeg(L, hipL, pp.clone().add(new THREE.Vector3(L.s * 0.01, 0.03, 0)));
        }
        pivot.rotation.x = s.wheelie * 0.42;
        steer.rotation.y = s.steer * 0.35;
        root.rotation.z = s.lean;
        bird.rotation.x = -s.wheelie * 0.25 + s.tuck * 0.12;
        bird.position.y = Math.sin(s.crank * 2) * 0.008;
        head.rotation.x = s.headPitch + s.wheelie * 0.2;
        head.rotation.y = s.headYaw;
        lower.rotation.x = -s.beakOpen * 0.55;
        const w = s.wing;
        const flap = Math.sin(s.time * 9) * 0.3 * w;
        for (let i = 0; i < wings.length; i++) {
          const W = wings[i];
          wingIK(W, i, w, flap);
          W.sec.visible = w > 0.03;
          W.sec.scale.set(1, 0.6 + 0.4 * w, Math.max(0.05, w));
        }
        head.position.y = 1.74 - s.gulp * 0.04;
        shadow.position.x = root.position.x;
        shadow.position.z = root.position.z;
        const sc = Math.max(0.3, 1 - root.position.y * 0.35);
        shadow.scale.set(sc, sc, 1);
        shadow.material.opacity = sc;
      },
      scarfPins(out) {
        bird.updateWorldMatrix(true, false);
        for (let i = 0; i < pinLocal.length; i++) out[i].copy(pinLocal[i]).applyMatrix4(bird.matrixWorld);
        return out;
      },
      colliders() {
        bird.updateWorldMatrix(true, false);
        const t = torso.position.clone().applyMatrix4(bird.matrixWorld);
        const n = new THREE.Vector3(0, 1.38, -0.08).applyMatrix4(bird.matrixWorld);
        return [{ c: t.add(new THREE.Vector3(0, 0.02, 0)), r: 0.25 }, { c: n, r: 0.09 }];
      },
      eye(out) { head.updateWorldMatrix(true, false); return out.set(0, 0.2, 0.04).applyMatrix4(head.matrixWorld); },
      beakTip(out) { beakG.updateWorldMatrix(true, false); return out.set(0, 0, -0.62).applyMatrix4(beakG.matrixWorld); },
    };
    return api;
  }

  return { create, R };
})();
