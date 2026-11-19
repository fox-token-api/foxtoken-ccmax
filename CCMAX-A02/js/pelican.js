(function () {
  const PB = (window.PB = window.PB || {});
  const V = THREE.Vector3;
  const UP = new V(0, 1, 0);

  const M = {
    white: new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.85 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.85 }),
    wing: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    beak: new THREE.MeshStandardMaterial({ color: 0xf3b23c, roughness: 0.5 }),
    pouch: new THREE.MeshStandardMaterial({ color: 0xe88f3a, roughness: 0.6 }),
    leg: new THREE.MeshStandardMaterial({ color: 0xf08a24, roughness: 0.6 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0x2462d0, roughness: 0.3, metalness: 0.2 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.05, metalness: 1 }),
    frameG: new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.4, metalness: 0.5 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x23b3a6, roughness: 0.35, metalness: 0.5 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x17171a, roughness: 0.9 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.9 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.7 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x0b0b0b }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff4d6 }),
    tail: new THREE.MeshBasicMaterial({ color: 0x551010 })
  };
  PB.PelicanMats = M;

  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  function limb(mat, r) {
    const m = new THREE.Mesh(cylGeo, mat);
    m.userData.r = r;
    m.castShadow = true;
    return m;
  }
  const _d = new V();
  function place(m, a, b) {
    _d.subVectors(b, a);
    const L = _d.length();
    m.position.copy(a).addScaledVector(_d, 0.5);
    m.quaternion.setFromUnitVectors(UP, _d.normalize());
    m.scale.set(m.userData.r, L, m.userData.r);
  }
  function tube(parent, mat, r, a, b) {
    const m = limb(mat, r);
    place(m, a, b);
    parent.add(m);
    return m;
  }

  function wheel() {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.045, 8, 28), M.tire);
    tire.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.016, 6, 28), M.rim);
    rim.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), M.rim);
    hub.rotation.z = Math.PI / 2;
    g.add(tire, rim, hub);
    const sp = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.58, 0.006), M.rim);
      s.rotation.x = a;
      sp.add(s);
    }
    g.add(sp);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  const WING_N = 20;
  function buildWing() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(WING_N * 2 * 3);
    const col = new Float32Array(WING_N * 2 * 3);
    const idx = [];
    for (let i = 0; i < WING_N - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, c, b, d);
    }
    const white = new THREE.Color(0xf1ede4), grey = new THREE.Color(0xbdb7aa), dark = new THREE.Color(0x26262a);
    for (let i = 0; i < WING_N; i++) {
      const u = i / (WING_N - 1);
      const lead = u > 0.56 ? dark : white;
      const trail = u > 0.5 ? dark : u > 0.3 ? grey : white;
      lead.toArray(col, i * 6);
      trail.toArray(col, i * 6 + 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, M.wing);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const pts = [new V(), new V(), new V(), new V(), new V()];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    return { mesh, geo, pts, curve };
  }

  const _ab = new V(), _pp = new V();
  function ikElbow(a, c, L1, L2, pole, out) {
    _ab.subVectors(c, a);
    let d = _ab.length();
    _ab.divideScalar(d || 1);
    d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(L1 + L2 - 0.005, d));
    const along = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
    _pp.copy(pole).addScaledVector(_ab, -pole.dot(_ab)).normalize();
    return out.copy(a).addScaledVector(_ab, along).addScaledVector(_pp, h);
  }

  function ik2(hip, foot, L1, L2, out) {
    const dy = foot.y - hip.y, dz = foot.z - hip.z;
    let d = Math.hypot(dy, dz);
    d = Math.min(d, L1 + L2 - 0.001);
    const a = Math.atan2(dy, dz);
    const cosB = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d);
    const b = Math.acos(Math.max(-1, Math.min(1, cosB)));
    const ang = a - b;
    out.set(foot.x * 0.5 + hip.x * 0.5, hip.y + Math.sin(ang) * L1, hip.z + Math.cos(ang) * L1);
    return out;
  }

  const Pelican = {
    init(scene) {
      const root = new THREE.Group();
      this.root = root;
      const pivot = new THREE.Group();
      pivot.position.z = 0.56;
      root.add(pivot);
      const bike = new THREE.Group();
      bike.position.z = -0.56;
      pivot.add(bike);
      this.pivot = pivot;
      this.bike = bike;

      const R = 0.375;
      this.rearW = wheel(); this.rearW.position.set(0, R, 0.56);
      this.frontAssy = new THREE.Group();
      this.frontAssy.position.set(0, 1.0, -0.42);
      this.frontW = wheel(); this.frontW.position.set(0, R - 1.0, -0.14);
      this.frontAssy.add(this.frontW);
      bike.add(this.rearW, this.frontAssy);

      const BB = new V(0, 0.36, 0.06), SEAT = new V(0, 0.98, 0.3), HEAD = new V(0, 0.98, -0.4), HEADLO = new V(0, 0.72, -0.44);
      const REAR = new V(0, R, 0.56);
      tube(bike, M.frame, 0.032, BB, SEAT);
      tube(bike, M.frame, 0.036, SEAT.clone().setY(0.9), HEAD);
      tube(bike, M.frame, 0.04, BB, HEADLO);
      tube(bike, M.frame, 0.022, BB, REAR);
      tube(bike, M.frame, 0.02, SEAT.clone().setY(0.9), REAR);
      tube(bike, M.frame, 0.036, HEADLO, HEAD);
      tube(this.frontAssy, M.frame, 0.022, new V(0, 0, 0), new V(0, R - 1.0, -0.14));
      tube(this.frontAssy, M.frameG, 0.025, new V(0, 0, 0), new V(0, 0.12, 0.02));
      const bar = tube(this.frontAssy, M.frameG, 0.022, new V(-0.3, 0.13, 0.06), new V(0.3, 0.13, 0.06));
      bar.castShadow = true;
      for (const sx of [-1, 1]) tube(this.frontAssy, M.tire, 0.03, new V(sx * 0.2, 0.13, 0.06), new V(sx * 0.31, 0.13, 0.06));
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 10), M.lamp);
      lamp.rotation.x = Math.PI / 2; lamp.position.set(0, -0.05, -0.1);
      this.frontAssy.add(lamp);
      this.lampMat = M.lamp;
      const seatM = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.3), M.seat);
      seatM.position.set(0, 1.0, 0.33);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.03), M.tail);
      tl.position.set(0, 0.93, 0.5);
      this.tailLamp = tl;
      bike.add(seatM, tl);

      this.crank = new THREE.Group();
      this.crank.position.copy(BB);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 20), M.rim);
      ring.rotation.y = Math.PI / 2; ring.position.x = 0.06;
      this.crank.add(ring);
      bike.add(this.crank);
      this.armL = tube(this.crank, M.frameG, 0.018, new V(0.08, 0, 0), new V(0.08, 0, -0.17));
      this.armR = tube(this.crank, M.frameG, 0.018, new V(-0.08, 0, 0), new V(-0.08, 0, 0.17));
      this.BB = BB;

      const bird = new THREE.Group();
      bike.add(bird);
      this.bird = bird;

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 14), M.white);
      body.scale.set(0.85, 0.9, 1.3);
      body.position.set(0, 1.32, 0.22);
      body.rotation.x = 0.55;
      body.castShadow = true;
      const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.36, 6), M.cream);
      tailF.rotation.x = Math.PI / 2 + 0.6; tailF.position.set(0, 1.18, 0.62); tailF.scale.set(1, 1, 0.4);
      bird.add(body, tailF);
      this.body = body;

      this.neckBase = new V(0, 1.6, -0.05);
      this.neckSegs = [];
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.008, 10, 8), M.white);
        s.castShadow = true;
        bird.add(s); this.neckSegs.push(s);
      }

      const head = new THREE.Group();
      bird.add(head);
      this.head = head;
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), M.white);
      skull.scale.set(0.9, 0.95, 1.15);
      skull.castShadow = true;
      head.add(skull);

      const beakG = new THREE.Group();
      beakG.position.set(0, -0.02, -0.12);
      beakG.rotation.x = -0.3;
      head.add(beakG);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.78), M.beak);
      upper.position.z = -0.38;
      const hook = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), M.leg);
      hook.rotation.x = Math.PI; hook.position.set(0, -0.03, -0.76);
      beakG.add(upper, hook);
      const pouchGeo = new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      pouchGeo.scale(0.7, 1, 3.6);
      const pouch = new THREE.Mesh(pouchGeo, M.pouch);
      pouch.position.set(0, -0.02, -0.34);
      pouch.castShadow = true;
      beakG.add(pouch);
      this.pouch = pouch;
      this.beak = beakG;
      upper.castShadow = true;

      const helmet = new THREE.Group();
      helmet.position.set(0, 0.03, 0.01);
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet);
      shell.scale.set(1, 0.85, 1.35);
      shell.castShadow = true;
      helmet.add(shell);
      for (const sx of [-0.05, 0.05]) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.4), M.stripe);
        st.position.set(sx, 0.128, 0); st.rotation.x = 0;
        helmet.add(st);
      }
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.08), M.helmet);
      visor.position.set(0, 0.02, -0.21); visor.rotation.x = -0.25;
      helmet.add(visor);
      for (const sx of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.16, 0.02), M.frameG);
        strap.position.set(sx * 0.12, -0.06, -0.02);
        helmet.add(strap);
      }
      head.add(helmet);

      const glasses = new THREE.Group();
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 8), M.lens);
        lens.scale.set(0.45, 0.8, 1.1);
        lens.position.set(sx * 0.105, 0.025, -0.07);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.14), M.frameG);
        arm.position.set(sx * 0.118, 0.04, 0.02);
        glasses.add(lens, arm);
      }
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.014), M.frameG);
      bridge.position.set(0, 0.05, -0.135);
      glasses.add(bridge);
      head.add(glasses);
      this.headCover = [helmet, glasses, skull];

      this.wings = [1, -1].map((side) => {
        const w = buildWing();
        w.side = side;
        w.shoulder = new V(side * 0.25, 1.5, 0.06);
        w.elbow = new V(); w.wrist = new V(); w.grip = new V();
        bird.add(w.mesh);
        return w;
      });

      this.legs = [1, -1].map((side) => {
        const thigh = limb(M.white, 0.075), shin = limb(M.leg, 0.03);
        const foot = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 3), M.leg);
        foot.scale.set(1, 1, 0.3);
        foot.castShadow = true;
        bird.add(thigh, shin, foot);
        return { side, thigh, shin, foot, hip: new V(side * 0.15, 1.12, 0.22) };
      });

      this.scarfAnchor = new THREE.Object3D();
      bird.add(this.scarfAnchor);

      root.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
      scene.add(root);

      this.crankAng = 0;
      this.gulpT = 0;
      this.mouthLocal = new V(0, -0.1, -0.55);
      this.tmpK = new V();
    },

    update(dt, s) {
      const t = s.time;
      this.root.position.set(s.x, s.y, 0);
      this.root.rotation.z = -s.lean;
      this.root.rotation.y = -s.steer * 0.25;
      this.pivot.rotation.x = s.pitch;
      this.frontAssy.rotation.y = -s.steer * 0.6;

      const wr = s.speed / 0.375;
      this.rearW.rotation.x -= wr * dt;
      this.frontW.rotation.x -= wr * dt;
      this.crankAng = s.crank;
      this.crank.rotation.x = -this.crankAng;

      const effort = Math.min(1, s.speed / 14);
      const bob = Math.sin(this.crankAng * 2) * 0.025 * (0.3 + effort);
      this.bird.position.y = bob;
      this.bird.rotation.z = Math.sin(this.crankAng) * 0.04 * effort;
      this.body.rotation.x = 0.55 + effort * 0.15 + s.pitch * -0.6;

      const lean = 0.1 + effort * 0.2 - s.wing * 0.15;
      const base = this.neckBase;
      const headPos = new V(0, 1.98 - effort * 0.12 + s.look * 0.06, -0.3 - effort * 0.12);
      headPos.x = s.steer * 0.08;
      if (s.hitT > 0) headPos.x += Math.sin(t * 40) * 0.05 * s.hitT;
      const ctrl = new V(0, 1.98, 0.02);
      for (let i = 0; i < this.neckSegs.length; i++) {
        const u = (i + 1) / (this.neckSegs.length + 1);
        const a = base.clone().lerp(ctrl, u), b = ctrl.clone().lerp(headPos, u);
        this.neckSegs[i].position.copy(a.lerp(b, u));
      }
      this.head.position.copy(headPos);
      this.head.rotation.set(-lean * 0.4 + s.look * 0.3 - s.pitch * 0.5, -s.steer * 0.3 + s.headYaw, Math.sin(t * 1.3) * 0.03);

      const sw = s.wing;
      const e = sw * sw * (3 - 2 * sw);
      const flap = Math.sin(t * 9) * 0.22 * e;
      this.root.updateMatrixWorld(true);
      this.wings.forEach((w) => this.poseWing(w, e, flap));

      for (const L of this.legs) {
        const a = this.crankAng + (L.side > 0 ? 0 : Math.PI);
        const pedal = new V(L.side * 0.15, this.BB.y - Math.sin(a) * 0.17, this.BB.z - Math.cos(a) * 0.17);
        if (s.airborne) pedal.y += 0.04;
        const knee = ik2(L.hip, pedal, 0.46, 0.5, this.tmpK);
        knee.x = L.side * 0.17;
        place(L.thigh, L.hip, knee);
        place(L.shin, knee, pedal);
        L.foot.position.copy(pedal).add(new V(0, -0.02, -0.06));
        L.foot.rotation.set(-Math.PI / 2 + 0.2, 0, 0);
      }

      this.gulpT = Math.max(0, this.gulpT - dt);
      const g = this.gulpT;
      const bulge = g > 0 ? Math.sin((1 - g / 0.8) * Math.PI) : 0;
      this.pouch.scale.set(1 + bulge * 0.9, 1 + bulge * 1.6, 1 + bulge * 0.15);
      this.beak.rotation.x = -0.3 - bulge * 0.1 - (s.open || 0) * 0.2;

      const n = s.night;
      this.lampMat.color.setRGB(0.6 + n * 0.4, 0.58 + n * 0.38, 0.5 + n * 0.32);
      M.tail.color.setRGB(0.35 + n * 0.65 * (0.6 + 0.4 * Math.sin(t * 6)), 0.05, 0.05);

      this.scarfAnchor.position.set(headPos.x * 0.4, 1.73 - effort * 0.04, -0.12 - effort * 0.04);
    },

    gulp() { this.gulpT = 0.8; },

    poseWing(w, e, flap) {
      const sd = w.side, S = w.shoulder, P = w.pts;
      const g = w.grip;
      this.frontAssy.localToWorld(g.set(sd * 0.25, 0.13, 0.06));
      this.bird.worldToLocal(g);

      const lift = flap * 1.0;
      P[0].copy(S);
      P[2].set(g.x, g.y + 0.055, g.z + 0.045).lerp(_pp.set(sd * 0.95, 1.6 + lift * 0.6, 0.12), e);
      P[3].set(g.x + sd * 0.01, g.y + 0.065, g.z - 0.035).lerp(_pp.set(sd * 1.28, 1.62 + lift * 0.85, 0.16), e);
      P[4].set(g.x + sd * 0.015, g.y - 0.035, g.z - 0.07).lerp(_pp.set(sd * 1.62, 1.6 + lift, 0.26), e);
      const pole = _ab.set(sd * 0.75, 0.55, 0.45).lerp(new V(0, 0.35, -0.6), e);
      ikElbow(S, P[2], 0.36, 0.38, pole.clone(), P[1]);
      w.elbow.copy(P[1]); w.wrist.copy(P[2]);

      const pos = w.geo.attributes.position.array;
      const back = new V(sd * 0.25, -0.75, 0.75).lerp(new V(0, -0.05, 1), e).normalize();
      const pt = new V(), tg = new V(), cd = new V();
      for (let i = 0; i < WING_N; i++) {
        const u = i / (WING_N - 1);
        w.curve.getPoint(u, pt);
        w.curve.getTangent(u, tg);
        cd.copy(back).addScaledVector(tg, -back.dot(tg)).normalize();
        let len = u < 0.5 ? 0.3 - u * 0.2 : (0.2 - (u - 0.5) * 0.34) * (0.45 + e * 0.75);
        if (u > 0.25 && i % 2) len *= 0.78;
        pt.toArray(pos, i * 6);
        pt.addScaledVector(cd, len).toArray(pos, i * 6 + 3);
      }
      w.geo.attributes.position.needsUpdate = true;
      w.geo.computeVertexNormals();
    },

    mouthWorld(out) {
      this.beak.localToWorld(out.copy(this.mouthLocal));
      return out;
    },

    anchorWorld(out) {
      this.root.updateMatrixWorld();
      return this.scarfAnchor.getWorldPosition(out);
    }
  };

  PB.Pelican = Pelican;
})();
