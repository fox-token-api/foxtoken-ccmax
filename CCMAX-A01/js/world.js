(function () {
  const PK = window.PK;
  const U = PK.U;
  const SPAN = 380, NEAR = 40;
  const wrapZ = (base, dist, span = SPAN, near = NEAR) => ((((base + dist) % span) + span) % span) - (span - near);
  PK.LANES = [-2.4, 0, 2.4];
  const hillH = (x) => (x < 7 ? -0.02 : Math.pow((x - 7) / 33, 1.6) * 16);

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  function roadTex() {
    return canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#3a3d44'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14000; i++) {
        const v = 40 + Math.random() * 50;
        g.fillStyle = `rgba(${v},${v},${v + 6},0.5)`;
        g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2);
      }
      const X = (m) => ((m + 4.5) / 9) * w;
      g.fillStyle = '#c9c4b2';
      g.fillRect(X(-3.75), 0, 4, h); g.fillRect(X(3.75) - 4, 0, 4, h);
      g.fillStyle = '#e8c35a';
      [-1.2, 1.2].forEach((m) => g.fillRect(X(m) - 2.5, 0, 5, h * 0.36));
      g.fillStyle = 'rgba(20,20,24,0.35)';
      g.fillRect(X(-4.5), 0, X(-3.9) - X(-4.5), h); g.fillRect(X(3.9), 0, X(4.5) - X(3.9), h);
    });
  }
  function grassTex() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#4d6b3a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 7000; i++) {
        const r = Math.random();
        g.fillStyle = r < 0.5 ? 'rgba(98,130,66,0.5)' : r < 0.85 ? 'rgba(52,78,40,0.5)' : 'rgba(170,150,90,0.35)';
        g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3);
      }
    });
  }
  function glowTex(inner, outer) {
    return canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }
  PK.glowTex = glowTex;

  const lam = (c, o = {}) => new THREE.MeshLambertMaterial(Object.assign({ color: c }, o));
  const flat = (c) => new THREE.MeshPhongMaterial({ color: c, flatShading: true, shininess: 4, specular: 0x111111 });
  PK.lam = lam;

  PK.World = class {
    constructor(scene) {
      this.scene = scene;
      this.items = [];

      this.roadT = roadTex();
      this.roadT.repeat.set(1, SPAN / 12);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(9, SPAN), lam(0xffffff, { map: this.roadT }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, NEAR - SPAN / 2);
      road.receiveShadow = true;
      scene.add(road);

      this.grassT = grassTex();
      this.grassT.repeat.set(8, SPAN / 6);
      const gg = new THREE.PlaneGeometry(80, SPAN, 40, 4);
      gg.rotateX(-Math.PI / 2);
      const gp = gg.attributes.position;
      for (let i = 0; i < gp.count; i++) {
        const x = gp.getX(i) + 44.5;
        gp.setY(i, hillH(x));
      }
      gg.computeVertexNormals();
      const grass = new THREE.Mesh(gg, lam(0xffffff, { map: this.grassT }));
      grass.position.set(44.5, 0, NEAR - SPAN / 2);
      grass.receiveShadow = true;
      scene.add(grass);

      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, SPAN), lam(0xb8b2a2));
      curb.position.set(-4.6, 0.05, NEAR - SPAN / 2);
      scene.add(curb);
      const railM = lam(0xdfe3e6);
      [0.55, 0.9].forEach((y) => {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, SPAN), railM);
        r.position.set(-4.75, y, NEAR - SPAN / 2);
        scene.add(r);
      });
      const postGeo = new THREE.BoxGeometry(0.12, 1, 0.12);
      postGeo.translate(0, 0.5, 0);
      this.posts = new THREE.InstancedMesh(postGeo, railM, Math.ceil(SPAN / 4));
      scene.add(this.posts);
      this.tmpM = new THREE.Matrix4();

      this.bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      this.poolMat = new THREE.MeshBasicMaterial({ map: glowTex('rgba(255,210,150,0.9)', 'rgba(255,170,90,0.35)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      this.haloMat = new THREE.SpriteMaterial({ map: glowTex('rgba(255,230,190,1)', 'rgba(255,190,110,0.35)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      for (let i = 0; i < 10; i++) this.add(this.lamp(), 6.0, i * 38, 0, SPAN);
      for (let i = 0; i < 16; i++) { const x = 7.5 + Math.random() * 6; this.add(this.palm(), x, i * 23 + Math.random() * 12, hillH(x) - 0.1, SPAN); }
      for (let i = 0; i < 14; i++) this.add(this.rock(0.5 + Math.random() * 0.9, 0x8c8577), -6.5 - Math.random() * 6, Math.random() * SPAN, -0.6, SPAN);
      for (let i = 0; i < 26; i++) {
        const s = 5 + Math.random() * 10, x = 26 + Math.random() * 50;
        this.add(this.rock(s, Math.random() < 0.5 ? 0x5b6b4a : 0x6d6a5c), x, Math.random() * SPAN, hillH(x) - s * 0.15, SPAN);
      }
      for (let i = 0; i < 22; i++) { const x = 5.5 + Math.random() * 9; this.add(this.bush(), x, Math.random() * SPAN, hillH(x), SPAN); }

      this.lighthouse(scene);
      this.bursts = new PK.Bursts(scene);
      this.stars = [];
      this.starT = 6;
    }

    add(obj, x, base, y, span, near = NEAR) {
      obj.position.set(x, y, 0);
      obj.rotation.y = obj.rotation.y || 0;
      this.scene.add(obj);
      this.items.push({ obj, base, span, near });
    }

    lamp() {
      const g = new THREE.Group();
      const m = lam(0x39424e);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), m);
      pole.position.y = 3;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.08), m);
      arm.position.set(-1.1, 5.95, 0);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.16, 0.3), m);
      head.position.set(-2.2, 5.88, 0);
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.22), this.bulbMat);
      bulb.position.set(-2.2, 5.78, 0);
      const halo = new THREE.Sprite(this.haloMat);
      halo.position.set(-2.2, 5.6, 0);
      halo.scale.set(3, 3, 1);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), this.poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(-3.4, 0.03, 0);
      pole.castShadow = true;
      g.add(pole, arm, head, bulb, halo, pool);
      return g;
    }

    palm() {
      const g = new THREE.Group();
      const trunkM = flat(0x7a5b3c), leafM = new THREE.MeshPhongMaterial({ color: 0x3f6f3a, side: THREE.DoubleSide, flatShading: true, shininess: 4, specular: 0x111111 });
      const h = 5 + Math.random() * 3, lean = (Math.random() - 0.3) * 0.5;
      let p = new THREE.Vector3(0, 0, 0);
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const t = (i + 1) / segs;
        const q = new THREE.Vector3(-lean * h * t * t, h * t, 0);
        const seg = PK.rod(p, q, 0.2 - 0.08 * t, trunkM);
        seg.castShadow = true;
        g.add(seg);
        p = q;
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2, 1, 4), leafM);
        const lp = leaf.geometry.attributes.position;
        for (let k = 0; k < lp.count; k++) {
          const y = lp.getY(k) + 1.6;
          lp.setZ(k, -0.12 * y * y + Math.abs(lp.getX(k)) * 0.4);
        }
        leaf.geometry.translate(0, 1.6, 0);
        leaf.geometry.computeVertexNormals();
        leaf.position.copy(p);
        leaf.rotation.set(-Math.PI / 2 + 0.5, 0, 0, 'YXZ');
        leaf.rotation.y = a;
        leaf.castShadow = true;
        g.add(leaf);
      }
      g.rotation.y = Math.random() * 6;
      return g;
    }

    rock(s, c) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), flat(c));
      m.scale.set(1, 0.55 + Math.random() * 0.4, 1.2);
      m.rotation.y = Math.random() * 6;
      return m;
    }

    bush() {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.6, 0), flat(Math.random() < 0.5 ? 0x4d7a3d : 0x6b8a44));
      m.scale.y = 0.6;
      return m;
    }

    lighthouse(scene) {
      const g = new THREE.Group();
      const isl = new THREE.Mesh(new THREE.ConeGeometry(26, 9, 9), flat(0x4b4f48));
      isl.position.y = 1;
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 16, 12), lam(0xf2efe6));
      tower.position.y = 13;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.1, 3, 12), lam(0xc0392b));
      band.position.y = 11;
      const band2 = band.clone(); band2.position.y = 17; band2.scale.set(0.87, 1, 0.87);
      this.lhLamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c4 }));
      this.lhLamp.position.y = 22;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2, 12), lam(0x2c3440));
      cap.position.y = 24;
      this.beam = new THREE.Group();
      this.beam.position.y = 22;
      const bm = new THREE.ShaderMaterial({
        uniforms: { uOp: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'uniform float uOp; varying vec2 vUv; void main(){ float a=pow(vUv.y,2.2)*uOp*(0.6+0.4*sin(vUv.x*6.2832)*sin(vUv.x*6.2832)); gl_FragColor=vec4(1.,.94,.75,a); }',
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      this.beamMat = bm;
      const cg = new THREE.ConeGeometry(9, 140, 16, 1, true);
      cg.translate(0, -70, 0);
      cg.rotateZ(Math.PI / 2);
      const b1 = new THREE.Mesh(cg, bm), b2 = new THREE.Mesh(cg, bm);
      b2.rotation.y = Math.PI;
      this.beam.add(b1, b2);
      g.add(isl, tower, band, band2, this.lhLamp, cap, this.beam);
      g.position.set(-150, -1.5, -200);
      scene.add(g);
    }

    update(dt, dist, speed, sky, camera) {
      for (const it of this.items) it.obj.position.z = wrapZ(it.base, dist, it.span, it.near);
      const n = this.posts.count;
      for (let i = 0; i < n; i++) {
        this.tmpM.makeTranslation(-4.75, 0, wrapZ(i * 4, dist));
        this.posts.setMatrixAt(i, this.tmpM);
      }
      this.posts.instanceMatrix.needsUpdate = true;
      this.roadT.offset.y = dist / 12;
      this.grassT.offset.y = dist / 6;

      const L = sky.lamp;
      this.bulbMat.color.setRGB(0.35 + 0.65 * L, 0.33 + 0.52 * L, 0.3 + 0.32 * L);
      this.poolMat.opacity = L * 0.55;
      this.haloMat.opacity = L * 0.9;
      this.beam.rotation.y += dt * 0.8;
      this.beamMat.uniforms.uOp.value = sky.night * 0.35;
      this.lhLamp.material.color.setRGB(0.6 + 0.4 * L, 0.55 + 0.4 * L, 0.45 + 0.3 * L);

      this.bursts.update(dt, speed);
      return this.updateStars(dt, sky, camera);
    }

    updateStars(dt, sky, camera) {
      let seen = false;
      this.starT -= dt;
      if (sky.night > 0.7 && this.starT <= 0) {
        this.starT = 9 + Math.random() * 14;
        const geo = new THREE.PlaneGeometry(1, 1);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
          map: canvasTex(128, 8, (g) => { const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.85, 'rgba(210,225,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 2, 128, 4); }),
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        }));
        const az = -0.6 + Math.random() * 1.2;
        const start = new THREE.Vector3(Math.sin(az) * 500, 160 + Math.random() * 120, -Math.cos(az) * 500);
        const vel = new THREE.Vector3(-1 + Math.random() * 2, -0.35, (Math.random() - 0.5) * 0.4).normalize().multiplyScalar(260);
        this.scene.add(m);
        this.stars.push({ m, start, vel, t: 0, life: 1.1 });
        seen = true;
      }
      for (let i = this.stars.length - 1; i >= 0; i--) {
        const s = this.stars[i];
        s.t += dt;
        const p = s.start.clone().addScaledVector(s.vel, s.t).add(camera.position);
        s.m.position.copy(p);
        s.m.scale.set(60, 1.4, 1);
        s.m.lookAt(camera.position);
        const sp = p.clone().addScaledVector(s.vel, 0.05).project(camera).sub(p.clone().project(camera));
        s.m.rotation.z += Math.atan2(sp.y, sp.x);
        s.m.material.opacity = Math.sin((s.t / s.life) * Math.PI);
        if (s.t > s.life) { this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.map.dispose(); s.m.material.dispose(); this.stars.splice(i, 1); }
      }
      return seen;
    }
  };

  PK.rod = function (a, b, r, mat) {
    const len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  };

  PK.makeFish = function (gold) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshLambertMaterial({ color: gold ? 0xffc93c : 0x8fb8d8, emissive: gold ? 0x8a5a00 : 0x15324a }));
    body.scale.set(0.55, 0.55, 1.6);
    const tailG = new THREE.ConeGeometry(0.18, 0.3, 4);
    tailG.rotateX(-Math.PI / 2);
    tailG.scale(0.25, 1, 1);
    const tail = new THREE.Mesh(tailG, body.material);
    tail.position.z = 0.42;
    const finM = new THREE.MeshLambertMaterial({ color: gold ? 0xffe9a8 : 0xc9e4f4, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: gold ? 0x6a4800 : 0x10283a });
    const finL = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), finM);
    finL.geometry.translate(-0.25, 0, 0);
    finL.rotation.x = -Math.PI / 2;
    const finR = finL.clone();
    finR.rotation.y = Math.PI;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(0.09, 0.04, -0.22);
    const eye2 = eye.clone(); eye2.position.x = -0.09;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: PK.fishGlow || (PK.fishGlow = glowTex('rgba(200,235,255,0.8)', 'rgba(120,190,255,0.25)')), color: gold ? 0xffd060 : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(1.6, 1.6, 1);
    g.add(body, tail, finL, finR, eye, eye2, halo);
    g.userData = { tail, finL, finR, halo };
    body.castShadow = true;
    return g;
  };

  PK.makeCone = function () {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 14), lam(0xff6a1f, { emissive: 0x401000 }));
    c.position.y = 0.42;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.215, 0.13, 14), lam(0xf4f4f4, { emissive: 0x333333 }));
    s.position.y = 0.48;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.62), lam(0x222222));
    b.position.y = 0.03;
    c.castShadow = true;
    g.add(c, s, b);
    return g;
  };

  PK.makePuddle = function () {
    const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshLambertMaterial({ color: 0x2c4c66, emissive: 0x0d1c2a, transparent: true, opacity: 0.85 }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(1.2, 2.1, 1);
    m.position.y = 0.02;
    return m;
  };

  PK.Bursts = class {
    constructor(scene) {
      this.N = 260;
      this.p = new Float32Array(this.N * 3);
      this.v = new Float32Array(this.N * 3);
      this.c = new Float32Array(this.N * 3);
      this.l = new Float32Array(this.N);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
      g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
      g.setAttribute('life', new THREE.BufferAttribute(this.l, 1));
      this.mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 300 } },
        vertexShader: `attribute float life; attribute vec3 color; varying float vL; varying vec3 vC; uniform float uScale;
          void main(){ vL=life; vC=color; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=uScale*.16*(.4+life)/-mv.z; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying float vL; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(vC,smoothstep(.5,0.,d)*min(vL*1.5,1.)); }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      this.pts = new THREE.Points(g, this.mat);
      this.pts.frustumCulled = false;
      scene.add(this.pts);
      this.i = 0;
    }
    emit(pos, n, color, spread = 3, up = 3) {
      const col = new THREE.Color(color);
      for (let k = 0; k < n; k++) {
        const i = this.i; this.i = (this.i + 1) % this.N;
        this.p.set([pos.x, pos.y, pos.z], i * 3);
        this.v.set([(Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread], i * 3);
        this.c.set([col.r, col.g, col.b], i * 3);
        this.l[i] = 0.6 + Math.random() * 0.5;
      }
    }
    update(dt, speed) {
      for (let i = 0; i < this.N; i++) {
        if (this.l[i] <= 0) continue;
        const j = i * 3;
        this.v[j + 1] -= 7 * dt;
        this.p[j] += this.v[j] * dt;
        this.p[j + 1] += this.v[j + 1] * dt;
        this.p[j + 2] += (this.v[j + 2] + speed) * dt;
        this.l[i] -= dt;
        if (this.l[i] <= 0) this.p[j + 1] = -99;
      }
      const a = this.pts.geometry.attributes;
      a.position.needsUpdate = a.life.needsUpdate = a.color.needsUpdate = true;
    }
  };
})();
