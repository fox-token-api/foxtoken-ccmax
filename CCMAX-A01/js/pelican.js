(function () {
  const PK = window.PK;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);

  function limb(mat, r) {
    const g = new THREE.CylinderGeometry(r, r * 0.85, 1, 8);
    g.translate(0, 0.5, 0);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = true;
    return m;
  }
  function setLimb(m, a, b) {
    m.position.copy(a);
    const d = b.clone().sub(a);
    m.scale.set(1, d.length(), 1);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
  }
  function scarfTex() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#d6302a'; g.fillRect(0, 0, 32, 256);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < 256; y += 6) g.fillRect(0, y, 32, 2);
    g.fillStyle = '#f3ebd3';
    g.fillRect(0, 214, 32, 6); g.fillRect(0, 228, 32, 3);
    g.fillStyle = '#8f1d18';
    for (let x = 0; x < 32; x += 4) g.fillRect(x, 246, 2, 10);
    return new THREE.CanvasTexture(c);
  }

  PK.Pelican = class {
    constructor(scene) {
      this.scene = scene;
      this.rig = new THREE.Group();
      this.pivot = new THREE.Group();
      this.pivot.position.z = 0.55;
      this.bike = new THREE.Group();
      this.bike.position.z = -0.55;
      this.rig.add(this.pivot);
      this.pivot.add(this.bike);
      scene.add(this.rig);
      this.buildBike();
      this.buildBird();
      this.buildScarf();
      this.t = 0;
      this.gulp = 0;
    }

    buildBike() {
      const b = this.bike;
      const frameM = new THREE.MeshPhongMaterial({ color: 0x2fb7a6, shininess: 80 });
      const metal = new THREE.MeshPhongMaterial({ color: 0xc8ccd2, shininess: 90 });
      const tire = new THREE.MeshLambertMaterial({ color: 0x1b1b1f });
      const R = V(0, 0.36, 0.55), F = V(0, 0.36, -0.55), BB = V(0, 0.36, 0.05), S = V(0, 0.95, 0.3), H = V(0, 1.0, -0.38), Hb = V(0, 0.8, -0.42);
      [[BB, S], [S, H], [BB, Hb], [Hb, H]].forEach(([a, c]) => b.add(PK.rod(a, c, 0.032, frameM)));
      [-0.06, 0.06].forEach((x) => {
        b.add(PK.rod(V(x, R.y, R.z), S, 0.018, frameM));
        b.add(PK.rod(V(x, R.y, R.z), BB, 0.02, frameM));
        b.add(PK.rod(V(x * 0.8, Hb.y, Hb.z), V(x, F.y, F.z), 0.02, metal));
      });
      const bar = V(0, 1.1, -0.44);
      b.add(PK.rod(H, bar, 0.022, metal));
      b.add(PK.rod(V(-0.3, 1.1, -0.42), V(0.3, 1.1, -0.42), 0.018, metal));
      const gripM = new THREE.MeshLambertMaterial({ color: 0xf3ebd3 });
      [-0.27, 0.27].forEach((x) => b.add(PK.rod(V(x - 0.04, 1.1, -0.42), V(x + 0.04, 1.1, -0.42), 0.028, gripM)));
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.26), new THREE.MeshLambertMaterial({ color: 0x3a2a22 }));
      saddle.position.set(0, 0.99, 0.31);
      b.add(saddle);

      this.wheels = [R, F].map((p) => {
        const w = new THREE.Group();
        w.position.copy(p);
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 32), tire);
        t.rotation.y = Math.PI / 2;
        t.castShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 32), metal);
        rim.rotation.y = Math.PI / 2;
        w.add(t, rim);
        for (let i = 0; i < 6; i++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.6, 0.008), metal);
          s.rotation.x = (i / 6) * Math.PI;
          w.add(s);
        }
        b.add(w);
        return w;
      });
      this.crank = new THREE.Group();
      this.crank.position.copy(BB);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 20), metal);
      ring.rotation.z = Math.PI / 2;
      ring.position.x = 0.05;
      this.crank.add(ring);
      [1, -1].forEach((sgn) => {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.03), metal);
        arm.position.set(sgn * 0.09, sgn * 0.085, 0);
        const ped = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), tire);
        ped.position.set(sgn * 0.13, sgn * 0.17, 0);
        this.crank.add(arm, ped);
      });
      b.add(this.crank);

      const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12), metal);
      lampBody.rotation.x = Math.PI / 2;
      lampBody.position.set(0, 1.0, -0.5);
      this.lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.042, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }));
      this.lampLens.position.set(0, 1.0, -0.547);
      this.lampLens.rotation.y = Math.PI;
      this.head = new THREE.SpotLight(0xfff0d0, 0, 38, 0.42, 0.55, 1.2);
      this.head.position.set(0, 1.0, -0.55);
      this.head.target.position.set(0, -0.6, -12);
      this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: PK.glowTex('rgba(255,245,220,1)', 'rgba(255,220,160,0.35)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.lampGlow.position.set(0, 1.0, -0.6);
      this.lampGlow.scale.set(0.8, 0.8, 1);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      tail.position.set(0, 0.92, 0.42);
      this.tailLight = tail;
      b.add(lampBody, this.lampLens, this.head, this.head.target, this.lampGlow, tail);
      this.beamPool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: PK.glowTex('rgba(255,240,205,0.85)', 'rgba(255,220,160,0.3)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.beamPool.rotation.x = -Math.PI / 2;
      this.beamPool.scale.set(4.5, 13, 1);
      this.beamPool.position.set(0, 0.04, -7.5);
      this.rig.add(this.beamPool);
    }

    buildBird() {
      const b = this.bike;
      const white = new THREE.MeshLambertMaterial({ color: 0xece8de });
      const grey = new THREE.MeshLambertMaterial({ color: 0xbfc0bd });
      const beakM = new THREE.MeshPhongMaterial({ color: 0xf2b33d, shininess: 40 });
      const pouchM = new THREE.MeshPhongMaterial({ color: 0xee8a4c, shininess: 25 });
      const legM = new THREE.MeshLambertMaterial({ color: 0xe8873a });

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), white);
      body.scale.set(1, 0.95, 1.6);
      body.position.set(0, 1.35, 0.12);
      body.rotation.x = 0.35;
      body.castShadow = true;
      const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 6), grey);
      tailF.rotation.x = Math.PI / 2 + 0.5;
      tailF.position.set(0, 1.42, 0.62);
      tailF.scale.x = 1.5;
      b.add(body, tailF);

      const neckPath = new THREE.CatmullRomCurve3([V(0, 1.45, -0.22), V(0, 1.72, -0.28), V(0, 1.93, -0.14), V(0, 2.08, -0.2)]);
      const neck = new THREE.Mesh(new THREE.TubeGeometry(neckPath, 16, 0.075, 10), white);
      neck.castShadow = true;
      b.add(neck);
      this.headG = new THREE.Group();
      this.headG.position.set(0, 2.1, -0.24);
      b.add(this.headG);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), white);
      head.scale.set(0.95, 1, 1.15);
      head.castShadow = true;
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 5), new THREE.MeshLambertMaterial({ color: 0xf6e7a8 }));
      crest.position.set(0, 0.1, 0.12);
      crest.rotation.x = 1.9;

      const upperG = new THREE.ConeGeometry(0.065, 0.78, 10);
      upperG.rotateX(-Math.PI / 2);
      upperG.translate(0, 0, -0.39);
      const upper = new THREE.Mesh(upperG, beakM);
      upper.scale.set(1.15, 0.45, 1);
      upper.position.set(0, -0.01, -0.08);
      upper.rotation.x = 0.13;
      const hook = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd8552a }));
      hook.position.set(0, -0.11, -0.84);
      this.pouch = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), pouchM);
      this.pouch.scale.set(0.75, 0.75, 3.1);
      this.pouch.position.set(0, -0.1, -0.42);
      this.pouch.rotation.x = 0.12;
      this.beakTip = new THREE.Object3D();
      this.beakTip.position.set(0, -0.12, -0.75);
      this.eyeAnchor = new THREE.Object3D();
      this.eyeAnchor.position.set(0, 0.07, -0.06);

      const helmM = new THREE.MeshPhongMaterial({ color: 0x1f2f4a, shininess: 70 });
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmM);
      helm.scale.set(1, 0.95, 1.3);
      helm.position.set(0, 0.03, 0.02);
      const stripeM = new THREE.MeshPhongMaterial({ color: 0xffb347, shininess: 60 });
      const stripes = [Math.PI / 2, Math.PI * 1.5].map((c) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.163, 6, 10, c - 0.18, 0.36, 0, Math.PI / 2), stripeM);
        m.scale.copy(helm.scale);
        m.position.copy(helm.position);
        return m;
      });
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.09), helmM);
      visor.position.set(0, 0.04, -0.2);
      visor.rotation.x = 0.25;
      const strapM = new THREE.MeshLambertMaterial({ color: 0x111418 });
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.008, 4, 20, Math.PI), strapM);
      strap.rotation.set(0, Math.PI / 2, Math.PI);
      strap.position.set(0, 0.03, 0);

      const shadesM = new THREE.MeshPhongMaterial({ color: 0x0b0d12, specular: 0x9fb4ff, shininess: 120, side: THREE.DoubleSide });
      const shades = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.13, 0.065, 24, 1, true, Math.PI - 1.45, 2.9), shadesM);
      shades.position.set(0, 0.03, 0.0);
      shades.scale.set(1, 1, 1.18);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.139, 0.008, 4, 24, 2.9), new THREE.MeshPhongMaterial({ color: 0xffb347, shininess: 90 }));
      frame.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 1.45 + Math.PI);
      frame.position.set(0, 0.063, 0);
      frame.scale.set(1, 1.18, 1);
      this.headG.add(head, crest, upper, hook, this.pouch, this.beakTip, this.eyeAnchor, helm, ...stripes, visor, strap, shades, frame);
      this.povHide = [head, crest, helm, ...stripes, visor, strap, shades, frame];

      const knot = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.04, 8, 18), new THREE.MeshLambertMaterial({ color: 0xd6302a }));
      knot.position.set(0, 1.6, -0.25);
      knot.rotation.x = Math.PI / 2 - 0.2;
      const knotB = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), knot.material);
      knotB.position.set(0, 1.58, -0.35);
      b.add(knot, knotB);

      this.wings = [1, -1].map((sgn) => {
        const g = new THREE.Group();
        g.position.set(0.24 * sgn, 1.47, 0.0);
        const shp = new THREE.Shape();
        shp.moveTo(0, 0.1); shp.lineTo(0.38, 0.16); shp.lineTo(0.78, 0.12); shp.lineTo(1.12, 0.02);
        shp.lineTo(1.0, -0.08); shp.lineTo(0.8, -0.16); shp.lineTo(0.42, -0.24); shp.lineTo(0, -0.22);
        const geo = new THREE.ShapeGeometry(shp);
        geo.rotateX(-Math.PI / 2);
        const w = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xe9e5da, side: THREE.DoubleSide }));
        const tipS = new THREE.Shape();
        tipS.moveTo(0.74, 0.12); tipS.lineTo(1.12, 0.02); tipS.lineTo(1.0, -0.08); tipS.lineTo(0.8, -0.16); tipS.lineTo(0.7, -0.1);
        const tg = new THREE.ShapeGeometry(tipS);
        tg.rotateX(-Math.PI / 2);
        tg.translate(0, 0.004, 0);
        const tip = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: 0x23252b, side: THREE.DoubleSide }));
        w.castShadow = true;
        const inner = new THREE.Group();
        inner.scale.x = sgn;
        inner.add(w, tip);
        g.add(inner);
        b.add(g);
        g.userData.sgn = sgn;
        return g;
      });

      this.legs = [1, -1].map((sgn) => {
        const thigh = limb(white, 0.06), shin = limb(legM, 0.03);
        const foot = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 3), legM);
        foot.scale.y = 0.25;
        b.add(thigh, shin, foot);
        return { sgn, thigh, shin, foot };
      });
    }

    buildScarf() {
      this.W = 4; this.H = 20;
      this.segA = 0.05; this.segL = 0.07;
      const n = this.W * this.H;
      this.P = new Float32Array(n * 3);
      this.O = new Float32Array(n * 3);
      const geo = new THREE.BufferGeometry();
      const uv = [], idx = [];
      for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) uv.push(i / (this.W - 1), 1 - j / (this.H - 1));
      for (let j = 0; j < this.H - 1; j++) for (let i = 0; i < this.W - 1; i++) {
        const a = j * this.W + i, b = a + 1, c = a + this.W, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
      this.posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
      geo.setAttribute('position', this.posAttr);
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      this.scarf = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: scarfTex(), side: THREE.DoubleSide }));
      this.scarf.frustumCulled = false;
      this.scarf.castShadow = true;
      this.scene.add(this.scarf);
      this.anchors = [];
      for (let i = 0; i < this.W; i++) this.anchors.push(V((i - (this.W - 1) / 2) * this.segA, 1.6, -0.12));
      this.cons = [];
      const C = (a, b) => {
        const pa = a * 3, pb = b * 3;
        this.cons.push([pa, pb, 0]);
      };
      for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
        const k = j * this.W + i;
        if (i < this.W - 1) C(k, k + 1);
        if (j < this.H - 1) C(k, k + this.W);
        if (i < this.W - 1 && j < this.H - 1) { C(k, k + this.W + 1); C(k + 1, k + this.W); }
        if (j < this.H - 2) C(k, k + 2 * this.W);
      }
      this.inited = false;
      this.tmp = V(0, 0, 0);
      this.bodyC = V(0, 0, 0);
    }

    initScarf() {
      this.rig.updateMatrixWorld(true);
      for (let j = 0; j < this.H; j++) for (let i = 0; i < this.W; i++) {
        const k = (j * this.W + i) * 3;
        this.tmp.copy(this.anchors[i]);
        this.tmp.z += j * this.segL;
        this.tmp.y -= j * 0.01;
        this.bike.localToWorld(this.tmp);
        this.P[k] = this.O[k] = this.tmp.x;
        this.P[k + 1] = this.O[k + 1] = this.tmp.y;
        this.P[k + 2] = this.O[k + 2] = this.tmp.z;
      }
      for (const c of this.cons) {
        const dx = this.P[c[0]] - this.P[c[1]], dy = this.P[c[0] + 1] - this.P[c[1] + 1], dz = this.P[c[0] + 2] - this.P[c[1] + 2];
        c[2] = Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      this.inited = true;
    }

    stepScarf(dt, speed, latVel, iters) {
      if (!this.inited) this.initScarf();
      const P = this.P, O = this.O, W = this.W, H = this.H;
      const sub = 2, h = dt / sub;
      this.bike.localToWorld(this.bodyC.set(0, 1.35, 0.12));
      for (let s = 0; s < sub; s++) {
        this.t += h;
        for (let j = 1; j < H; j++) {
          const fl = j / H;
          for (let i = 0; i < W; i++) {
            const k = (j * W + i) * 3;
            const vx = (P[k] - O[k]) / h, vy = (P[k + 1] - O[k + 1]) / h, vz = (P[k + 2] - O[k + 2]) / h;
            const sv = Math.min(speed, 18);
            const flut = Math.sin(this.t * (9 + sv * 0.5) - j * 0.75 + i * 0.3) * sv * 0.55 * fl;
            const flut2 = Math.cos(this.t * 6.3 - j * 0.5) * sv * 0.3 * fl;
            const lift = Math.min(speed, 16) * 0.38;
            const ax = (-latVel - vx) * 2.6 + flut2 * 4;
            const ay = -9.8 + lift + (0 - vy) * 1.2 + flut * 6;
            const az = (speed - vz) * 2.6;
            const nx = P[k] + (P[k] - O[k]) * 0.985 + ax * h * h;
            const ny = P[k + 1] + (P[k + 1] - O[k + 1]) * 0.985 + ay * h * h;
            const nz = P[k + 2] + (P[k + 2] - O[k + 2]) * 0.985 + az * h * h;
            O[k] = P[k]; O[k + 1] = P[k + 1]; O[k + 2] = P[k + 2];
            P[k] = nx; P[k + 1] = ny; P[k + 2] = nz;
          }
        }
        for (let i = 0; i < W; i++) {
          this.tmp.copy(this.anchors[i]);
          this.bike.localToWorld(this.tmp);
          const k = i * 3;
          O[k] = P[k] = this.tmp.x; O[k + 1] = P[k + 1] = this.tmp.y; O[k + 2] = P[k + 2] = this.tmp.z;
        }
        for (let it = 0; it < iters; it++) {
          for (const c of this.cons) {
            const a = c[0], b = c[1];
            const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
            if (d < c[2] && c[2] > this.segL * 1.5) continue;
            const f = (d - c[2]) / d;
            const wa = a < W * 3 ? 0 : 0.5, wb = b < W * 3 ? 0 : 0.5;
            const ka = wa === 0 ? 0 : wb === 0 ? 1 : 0.5, kb = wb === 0 ? 0 : wa === 0 ? 1 : 0.5;
            P[a] += dx * f * ka; P[a + 1] += dy * f * ka; P[a + 2] += dz * f * ka;
            P[b] -= dx * f * kb; P[b + 1] -= dy * f * kb; P[b + 2] -= dz * f * kb;
          }
          for (let k = W * 3; k < P.length; k += 3) {
            const dx = P[k] - this.bodyC.x, dy = P[k + 1] - this.bodyC.y, dz = (P[k + 2] - this.bodyC.z) / 1.5;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d < 0.36) { const f = 0.36 / d; P[k] = this.bodyC.x + dx * f; P[k + 1] = this.bodyC.y + dy * f; P[k + 2] = this.bodyC.z + dz * f * 1.5; }
            if (P[k + 1] < 0.03) P[k + 1] = 0.03;
          }
        }
      }
      this.posAttr.array.set(P);
      this.posAttr.needsUpdate = true;
      this.scarf.geometry.computeVertexNormals();
    }

    update(dt, s) {
      this.rig.position.set(s.x, s.y, 0);
      this.rig.rotation.set(0, s.yaw, s.lean);
      this.pivot.rotation.x = s.wheelie;
      this.wheels.forEach((w, i) => { w.rotation.x -= (s.speed * dt) / 0.36; });
      this.crank.rotation.x = -s.crank;
      this.gulp = Math.max(0, this.gulp - dt * 2.5);
      const gp = Math.sin(Math.min(1, this.gulp) * Math.PI);
      this.pouch.scale.set(0.75 + gp * 0.5, 0.75 + gp * 1.1, 3.1);
      this.pouch.position.y = -0.1 - gp * 0.05;
      const pedalBob = Math.sin(s.crank * 2) * 0.012 * Math.min(1, s.speed / 6);
      this.headG.position.y = 2.1 + pedalBob + Math.sin(this.t * 1.7) * 0.01;
      this.headG.rotation.x = -s.wheelie * 0.6 + s.lookUp;
      this.headG.rotation.y = s.headYaw;

      const sp = s.spread, fl = s.flap;
      this.wings.forEach((w) => {
        const g = w.userData.sgn;
        const ry = (1.2 * (1 - sp) - 0.1 * sp) * g;
        const rz = (-0.75 * (1 - sp) + (0.2 + Math.sin(fl) * 0.45) * sp) * g;
        const rx = 0.15 * (1 - sp);
        w.rotation.set(rx, ry, rz);
        w.scale.setScalar(0.72 + 0.28 * sp);
      });

      this.legs.forEach((L) => {
        const a = s.crank + (L.sgn > 0 ? 0 : Math.PI);
        const pedal = V(L.sgn * 0.14, 0.36 + Math.cos(a) * 0.17 + 0.02, 0.05 - Math.sin(a) * 0.17);
        const hip = V(L.sgn * 0.13, 1.18, 0.2);
        const d = hip.distanceTo(pedal);
        const l1 = 0.47, l2 = 0.5;
        const dc = Math.min(d, l1 + l2 - 0.001);
        const ca = (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc);
        const ang = Math.acos(Math.max(-1, Math.min(1, ca)));
        const dir = pedal.clone().sub(hip).normalize();
        const side = V(1, 0, 0);
        const knee = hip.clone().add(dir.clone().applyAxisAngle(side, ang).multiplyScalar(l1));
        knee.x = L.sgn * 0.17;
        setLimb(L.thigh, hip, knee);
        setLimb(L.shin, knee, pedal);
        L.foot.position.copy(pedal).add(V(0, 0.015, -0.04));
        L.foot.rotation.set(-Math.PI / 2, 0, 0);
      });

      const L = s.lamp;
      this.head.intensity = L * 2.4;
      this.lampLens.material.color.setRGB(0.5 + 0.5 * L, 0.5 + 0.46 * L, 0.45 + 0.35 * L);
      this.lampGlow.material.opacity = L;
      this.beamPool.material.opacity = L * 0.5 * (1 - Math.min(1, s.y * 0.8));
      this.beamPool.position.y = 0.04 - s.y;
      this.rig.updateMatrixWorld(true);
      this.stepScarf(Math.min(dt, 1 / 30), s.speed, s.latVel, s.clothIters);
    }

    setPOV(on) { this.povHide.forEach((m) => { m.visible = !on; }); }
    beakWorld(out) { return this.beakTip.getWorldPosition(out); }
    eyeWorld(out) { return this.eyeAnchor.getWorldPosition(out); }
  };
})();
