window.PG = window.PG || {};

PG.U = {
  uDist: { value: 0 }, uTime: { value: 0 },
  uLightDir: { value: new THREE.Vector3(0, 1, 0) }, uLightCol: { value: new THREE.Color() },
  uAmbS: { value: new THREE.Color() }, uAmbG: { value: new THREE.Color() },
  uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0.003 },
  uLamps: { value: 0 }, uNight: { value: 0 },
  uHeadPos: { value: new THREE.Vector3() }, uHeadDir: { value: new THREE.Vector3(0, 0, -1) }, uHeadOn: { value: 0 },
};

PG.GL = `
  uniform float uDist, uTime, uLamps, uNight, uFogDensity, uHeadOn;
  uniform vec3 uLightDir, uLightCol, uAmbS, uAmbG, uFogColor, uHeadPos, uHeadDir;
  float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
  float fbm3(vec2 p){ return vn(p)*0.55 + vn(p*2.1+3.1)*0.3 + vn(p*4.3+7.7)*0.15; }
  vec3 lampAt(vec3 wp, vec3 N, float k){
    float lz = uDist - k*40.0;
    vec3 L = vec3(3.0, 6.3, lz) - wp;
    float d2 = dot(L,L);
    float ndl = max(dot(N, normalize(L)), 0.0);
    return vec3(1.0,0.72,0.38) * ndl * 26.0 / (1.0 + d2*1.1);
  }
  vec3 lit(vec3 alb, vec3 N, vec3 wp){
    float ndl = max(dot(N, uLightDir), 0.0);
    vec3 amb = mix(uAmbG, uAmbS, N.y*0.5+0.5);
    vec3 c = alb * (amb + uLightCol*ndl);
    if (uLamps > 0.01) {
      float D = uDist - wp.z;
      float k = floor(D/40.0 + 0.5);
      vec3 lp = lampAt(wp, N, k) + lampAt(wp, N, k + sign(D/40.0 - k));
      c += alb * lp * uLamps;
    }
    if (uHeadOn > 0.01) {
      vec3 L = uHeadPos - wp; float d = length(L);
      float sp = smoothstep(0.88, 0.97, dot(-L/d, uHeadDir));
      c += alb * vec3(1.0,0.95,0.85) * sp * max(dot(N, L/d), 0.0) * 7.0 / (1.0 + d*d*0.06) * uHeadOn;
    }
    return c;
  }
  vec3 fogit(vec3 c, float vd){
    float f = 1.0 - exp(-uFogDensity*uFogDensity*vd*vd);
    return mix(c, uFogColor, clamp(f,0.0,1.0));
  }
`;

PG.Scenery = (function () {
  const W = PG.W;
  const items = [];
  let scene, lampGlowMat, beam, lhLamp, boatLight;

  function shaderMat(vert, frag, extra) {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: PG.U, vertexShader: vert,
      fragmentShader: PG.GL + frag,
    }, extra || {}));
  }

  function gridGeom(xs, zs) {
    const pos = new Float32Array(xs.length * zs.length * 3);
    let k = 0;
    for (const z of zs) for (const x of xs) { pos[k++] = x; pos[k++] = 0; pos[k++] = z; }
    const idx = [], w = xs.length;
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < w - 1; i++) {
      const a = j * w + i, b = a + 1, c = a + w, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 5000);
    return g;
  }
  const zsSpan = (n, near, far) => {
    const a = [];
    for (let j = 8; j >= 1; j--) a.push(near * j / 8);
    for (let j = 0; j <= n; j++) a.push(-far * Math.pow(j / n, 1.8));
    return a;
  };

  function makeRoad() {
    const g = new THREE.PlaneGeometry(9.4, 820, 1, 120);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -370);
    const vert = `varying vec3 vW; varying float vVD;
      void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vVD = -mv.z; gl_Position = projectionMatrix*mv; }`;
    const frag = `varying vec3 vW; varying float vVD;
      void main(){
        float D = uDist - vW.z; float x = vW.x; float ax = abs(x);
        vec3 alb = vec3(0.16,0.16,0.18) * (0.85 + 0.3*fbm3(vec2(x*2.0, D*2.0)));
        alb *= 0.92 + 0.08*vn(vec2(x*0.4, D*0.15));
        float lane = step(abs(ax-1.3), 0.07) * step(0.45, fract(D/9.0));
        float edge = step(abs(ax-3.95), 0.09);
        float m = max(lane, edge);
        alb = mix(alb, vec3(0.85,0.85,0.8), m*0.9);
        float curb = smoothstep(4.35, 4.45, ax);
        alb = mix(alb, mix(vec3(0.7,0.7,0.68), vec3(0.75,0.2,0.18), step(0.5, fract(D/2.0))*step(0.0,x)), curb);
        vec3 c = lit(alb, vec3(0,1,0), vW);
        float wet = 0.08*uNight;
        c += vec3(0.6,0.7,1.0)*wet*m;
        c = fogit(c, vVD);
        gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    const m = new THREE.Mesh(g, shaderMat(vert, frag));
    m.frustumCulled = false;
    scene.add(m);
  }

  function makeBeach() {
    const xs = [-4.7, -5.0, -5.4, -5.8];
    for (let i = 1; i <= 46; i++) xs.push(-5.8 - 70 * Math.pow(i / 46, 1.6));
    const g = gridGeom(xs, zsSpan(110, 40, 820));
    const vert = `
      uniform float uDist;
      varying vec3 vW; varying float vVD; varying float vS; varying vec3 vN;
      float shoreX(float d){ return -16.0 + 2.5*sin(d*0.013) + 1.2*sin(d*0.041+1.0); }
      float sandY(float x, float d){
        float s = x - shoreX(d);
        float y = -2.4 + s*0.075 + 0.08*sin(d*0.21 + x*0.3)*clamp(s/4.0,0.0,1.0);
        return clamp(y, -7.0, -1.45);
      }
      float hAt(float x, float d){
        float sy = sandY(-5.8, d);
        if (x > -5.8) return mix(0.0, sy, smoothstep(-4.7, -5.8, x));
        return sandY(x, d);
      }
      void main(){
        vec4 w = modelMatrix*vec4(position,1.0);
        float d = uDist - w.z;
        w.y = hAt(w.x, d);
        float e = 0.25;
        vec3 N = normalize(vec3(hAt(w.x-e,d)-hAt(w.x+e,d), 2.0*e, -(hAt(w.x,d-e)-hAt(w.x,d+e))));
        vN = N; vW = w.xyz; vS = w.x - shoreX(d);
        vec4 mv = viewMatrix*w; vVD = -mv.z; gl_Position = projectionMatrix*mv;
      }`;
    const frag = `varying vec3 vW; varying float vVD; varying float vS; varying vec3 vN;
      void main(){
        float D = uDist - vW.z;
        vec3 sand = vec3(0.78,0.66,0.48) * (0.88 + 0.2*fbm3(vec2(vW.x*1.3, D*1.3)));
        float wet = 1.0 - smoothstep(-0.5, 3.5, vS + 0.6*sin(uTime*0.9 + D*0.03));
        sand = mix(sand, vec3(0.42,0.34,0.26), wet*0.8);
        vec3 wall = vec3(0.45,0.43,0.4) * (0.8 + 0.35*vn(vec2(vW.y*3.0, D*1.5)));
        vec3 alb = mix(sand, wall, step(-5.75, vW.x));
        vec3 c = lit(alb, normalize(vN), vW);
        c = fogit(c, vVD);
        gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    const m = new THREE.Mesh(g, shaderMat(vert, frag));
    m.frustumCulled = false;
    scene.add(m);
  }

  function makeLand() {
    const xs = [4.65, 5.2, 6, 7];
    for (let i = 1; i <= 60; i++) xs.push(7 + 420 * Math.pow(i / 60, 1.9));
    const g = gridGeom(xs, zsSpan(110, 40, 880));
    const H = `
      float lh(float x, float d){
        float t = smoothstep(5.0, 9.0, x);
        float dune = 0.6*vn(vec2(x*0.15, mod(d,900.0)*0.05))*smoothstep(12.0, 18.0, x);
        float hill = smoothstep(14.0, 60.0, x) * (6.0 + 22.0*fbm3(vec2(x*0.018, mod(d,9000.0)*0.012)));
        float mtn = smoothstep(90.0, 300.0, x) * (40.0 + 90.0*fbm3(vec2(x*0.006+4.0, d*0.004)));
        return t*(0.3 + dune) + hill + mtn - (1.0-t)*0.02;
      }`;
    const vert = `
      uniform float uDist;
      varying vec3 vW; varying float vVD; varying vec3 vN; varying float vH;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hh(i),hh(i+vec2(1,0)),f.x),mix(hh(i+vec2(0,1)),hh(i+vec2(1,1)),f.x),f.y); }
      float fbm3(vec2 p){ return vn(p)*0.55 + vn(p*2.1+3.1)*0.3 + vn(p*4.3+7.7)*0.15; }
      ${H}
      void main(){
        vec4 w = modelMatrix*vec4(position,1.0);
        float d = uDist - w.z;
        w.y = lh(w.x, d);
        float e = 0.5 + w.x*0.01;
        vec3 N = normalize(vec3(lh(w.x-e,d)-lh(w.x+e,d), 2.0*e, -(lh(w.x,d-e)-lh(w.x,d+e))));
        vN = N; vW = w.xyz; vH = w.y;
        vec4 mv = viewMatrix*w; vVD = -mv.z; gl_Position = projectionMatrix*mv;
      }`;
    const frag = `varying vec3 vW; varying float vVD; varying vec3 vN; varying float vH;
      void main(){
        float D = uDist - vW.z;
        vec3 N = normalize(vN);
        float n = fbm3(vec2(vW.x*0.6, D*0.6));
        vec3 grass = mix(vec3(0.26,0.36,0.14), vec3(0.42,0.44,0.2), n);
        vec3 dry = vec3(0.6,0.52,0.34);
        vec3 rock = vec3(0.38,0.34,0.3)*(0.8+0.4*n);
        vec3 alb = mix(dry, grass, smoothstep(5.5, 9.0, vW.x));
        alb = mix(alb, rock, smoothstep(0.75, 0.55, N.y));
        alb = mix(alb, vec3(0.32,0.3,0.36), smoothstep(60.0, 120.0, vH));
        vec3 c = lit(alb, N, vW);
        c = fogit(c, vVD);
        gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    const m = new THREE.Mesh(g, shaderMat(vert, frag, { side: THREE.BackSide }));
    m.frustumCulled = false;
    scene.add(m);
    PG.Scenery.landHeight = (x) => {
      const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      return ss(5, 9, x) * 0.3;
    };
  }

  function std(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, o || {})); }

  function glowTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(0.15, 'rgba(255,200,130,0.6)');
    gr.addColorStop(0.5, 'rgba(255,160,80,0.12)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function recycle(make, count, spacing, jitter, init) {
    for (let i = 0; i < count; i++) {
      const obj = make(i);
      scene.add(obj);
      const it = { obj, d: i * spacing + Math.random() * jitter, spacing: count * spacing, jitter, init };
      init(it, true);
      items.push(it);
    }
  }

  function makeLamps() {
    const poleM = std('#5a6068', { metalness: 0.6, roughness: 0.45 });
    const headM = std('#2a2e33', { metalness: 0.5, roughness: 0.5 });
    const bulbM = new THREE.MeshBasicMaterial({ color: '#fff0c8' });
    lampGlowMat = new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 6.6, 8); pole.translate(0, 3.3, 0);
    const arm = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6); arm.rotateZ(Math.PI / 2); arm.translate(-1.15, 6.5, 0);
    const head = new THREE.BoxGeometry(0.8, 0.16, 0.34); head.translate(-2.3, 6.42, 0);
    const bulb = new THREE.BoxGeometry(0.6, 0.04, 0.22); bulb.translate(-2.3, 6.33, 0);
    recycle(() => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(pole, poleM), new THREE.Mesh(arm, poleM), new THREE.Mesh(head, headM), new THREE.Mesh(bulb, bulbM));
      const s = new THREE.Sprite(lampGlowMat); s.position.set(-2.3, 6.2, 0); s.scale.set(5, 5, 1);
      g.add(s);
      g.children.slice(0, 3).forEach(m => { m.castShadow = true; });
      return g;
    }, 20, 40, 0, (it) => { it.obj.position.x = 5.3; });
  }

  function makeRail() {
    const railM = std('#b8bcc0', { metalness: 0.7, roughness: 0.35 });
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.28, 820), railM);
    r.position.set(-4.62, 0.62, -370);
    r.frustumCulled = false;
    scene.add(r);
    const postG = new THREE.BoxGeometry(0.1, 0.75, 0.1); postG.translate(0, 0.37, 0);
    const N = 110;
    const inst = new THREE.InstancedMesh(postG, std('#8a8e94', { metalness: 0.5 }), N);
    inst.frustumCulled = false;
    scene.add(inst);
    const m = new THREE.Matrix4();
    PG.Scenery.updatePosts = (dist) => {
      const base = Math.floor(dist / 4) * 4;
      for (let i = 0; i < N; i++) {
        const d = base + (i - 8) * 4;
        m.makeTranslation(-4.7, 0, dist - d);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
    };
  }

  function makePalms() {
    const trunkM = std('#6b5238', { roughness: 0.95 });
    const leafM = std('#3d6a2a', { roughness: 0.8, side: THREE.DoubleSide });
    const leafG = (() => {
      const g = new THREE.BufferGeometry();
      const pts = [], idx = [];
      const L = 10;
      for (let i = 0; i <= L; i++) {
        const t = i / L, x = t * 3.2, y = -t * t * 1.6, w = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.45 + 0.03;
        pts.push(x, y, -w, x, y + 0.08, 0, x, y, w);
        if (i < L) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.setIndex(idx); g.computeVertexNormals();
      return g;
    })();
    recycle(() => {
      const g = new THREE.Group();
      let y = 0, x = 0;
      const segs = 7, lean = 0.06 + Math.random() * 0.08;
      for (let i = 0; i < segs; i++) {
        const h = 1.1;
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.012, 0.2 - i * 0.012, h, 7), trunkM);
        c.position.set(x, y + h / 2, 0); c.rotation.z = lean * i * 0.5;
        c.castShadow = true;
        g.add(c);
        y += h * Math.cos(lean * i * 0.5); x -= h * Math.sin(lean * i * 0.5);
      }
      const top = new THREE.Group(); top.position.set(x, y, 0);
      for (let k = 0; k < 9; k++) {
        const l = new THREE.Mesh(leafG, leafM);
        l.rotation.y = k / 9 * Math.PI * 2 + Math.random() * 0.3;
        l.rotation.z = 0.25 + Math.random() * 0.3;
        l.castShadow = true;
        top.add(l);
      }
      g.add(top);
      g.userData.top = top;
      g.userData.ph = Math.random() * 6;
      return g;
    }, 26, 26, 20, (it) => {
      const x = 7 + Math.random() * 6;
      it.obj.position.x = x;
      it.obj.position.y = PG.Scenery.landHeight(x) - 0.2;
      it.obj.rotation.y = Math.random() * 6.28;
      it.obj.scale.setScalar(0.85 + Math.random() * 0.4);
    });
  }

  function makeRocks() {
    const rockM = std('#5c564e', { roughness: 0.95, flatShading: true });
    const geo = new THREE.DodecahedronGeometry(1, 0);
    recycle(() => {
      const m = new THREE.Mesh(geo, rockM); m.castShadow = true; return m;
    }, 30, 18, 14, (it) => {
      const sx = W.shoreX(it.d);
      const x = sx + 1 + Math.random() * 9;
      const s = 0.25 + Math.random() * 0.9;
      it.obj.position.set(x, W.sandY(x, it.d) + s * 0.2, 0);
      it.obj.scale.set(s * (1 + Math.random()), s * (0.6 + Math.random() * 0.5), s * (1 + Math.random()));
      it.obj.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    });
  }

  function makeDistant() {
    const isl = new THREE.Group();
    const rockM = std('#2e3238', { roughness: 1, flatShading: true });
    const hill = new THREE.Mesh(new THREE.ConeGeometry(38, 16, 9, 1), rockM);
    hill.scale.set(1.6, 1, 1); hill.position.y = 3;
    isl.add(hill);
    const towerM = std('#e8e4dc');
    const stripeM = std('#b33a2e');
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 9, 12), towerM); t1.position.y = 15.5;
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.4, 3, 12), stripeM); t2.position.y = 21.5;
    const t3 = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.25, 2.5, 12), towerM); t3.position.y = 24.2;
    lhLamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff1b8' }));
    lhLamp.position.y = 26.2;
    const lhGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    lhGlow.scale.set(30, 30, 1); lhGlow.position.y = 26.2;
    isl.add(t1, t2, t3, lhLamp, lhGlow);
    const bg = new THREE.ConeGeometry(5, 160, 24, 1, true);
    bg.translate(0, -80, 0); bg.rotateZ(Math.PI / 2);
    beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } },
      vertexShader: `varying float vT; void main(){ vT = clamp(-position.x/160.0,0.0,1.0); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uA; varying float vT; void main(){ gl_FragColor = vec4(vec3(1.0,0.92,0.7), uA*pow(1.0-vT,1.6)*0.32); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.y = 26.2;
    isl.add(beam);
    isl.position.set(-330, -2, -560);
    isl.userData.glow = lhGlow;
    scene.add(isl);
    PG.Scenery.island = isl;

    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 1.6), std('#ddd8cc'));
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7), std('#999'));
    mast.position.y = 4;
    const sailG = new THREE.BufferGeometry();
    sailG.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 0, 7.2, 0, 2.6, 1, 0], 3));
    sailG.computeVertexNormals();
    const sail = new THREE.Mesh(sailG, std('#f4efe6', { side: THREE.DoubleSide }));
    boatLight = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    boatLight.position.y = 7.6; boatLight.scale.set(6, 6, 1);
    boat.add(hull, mast, sail, boatLight);
    boat.position.set(-130, PG.W.SEA_Y + 0.3, -300);
    scene.add(boat);
    PG.Scenery.boat = boat;
  }

  function create(s) {
    scene = s;
    makeRoad(); makeBeach(); makeLand(); makeLamps(); makeRail(); makePalms(); makeRocks(); makeDistant();
  }

  function update(dt, dist, time, sky) {
    for (const it of items) {
      let z = dist - it.d;
      if (z > 30) {
        it.d += it.spacing;
        it.init(it, false);
        z = dist - it.d;
      }
      it.obj.position.z = z;
      if (it.obj.userData.top) {
        const t = it.obj.userData.top;
        t.rotation.x = Math.sin(time * 1.3 + it.obj.userData.ph) * 0.06;
        t.rotation.z = Math.sin(time * 0.9 + it.obj.userData.ph) * 0.05;
      }
    }
    PG.Scenery.updatePosts(dist);
    lampGlowMat.opacity = sky.lamps * 0.95;
    const n = sky.night;
    beam.material.uniforms.uA.value = Math.max(n, sky.lamps * 0.6);
    beam.rotation.y = time * 0.9;
    PG.Scenery.island.userData.glow.material.opacity = Math.max(n, sky.lamps * 0.6) * (0.6 + 0.4 * Math.max(0, Math.cos(time * 0.9 - 0.5)));
    boatLight.material.opacity = sky.lamps * (0.7 + 0.3 * Math.sin(time * 3.0));
    const b = PG.Scenery.boat;
    b.position.z = -300 + Math.sin(time * 0.02) * 80;
    b.position.y = PG.W.SEA_Y + 0.3 + Math.sin(time * 1.1) * 0.25;
    b.rotation.z = Math.sin(time * 0.9) * 0.05;
  }

  return { create, update, std, glowTex };
})();
