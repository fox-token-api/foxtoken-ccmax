(function () {
  const PB = (window.PB = window.PB || {});
  const S = PB.Sky.U;

  const FOG = {
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 60 },
    uFogFar: { value: 420 }
  };
  PB.FOG = FOG;

  const SHORE = 14.8;
  const SEA_Y = -1.5;
  PB.SHORE = SHORE;
  PB.SEA_Y = SEA_Y;

  const common = {
    uTime: S.uTime, uTop: S.uTop, uHor: S.uHor, uSunCol: S.uSunCol,
    uSunDir: S.uSunDir, uMoonDir: S.uMoonDir, uNight: S.uNight,
    uDist: { value: 0 },
    uAmb: { value: new THREE.Color() },
    uLight: { value: new THREE.Color() },
    uDetail: { value: 1 },
    ...FOG
  };

  const PERIOD = 4000;
  const NOISE = `
    float hp(vec2 c, float per) {
      c = vec2(mod(c.x, 512.0), mod(c.y, per));
      vec3 p3 = fract(vec3(c.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float pn(vec2 p, float sy) {
      float per = ${PERIOD.toFixed(1)} * sy;
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hp(i, per), hp(i + vec2(1, 0), per), f.x), mix(hp(i + vec2(0, 1), per), hp(i + vec2(1, 1), per), f.x), f.y);
    }`;

  const P = (n) => (6.2831853 * n / 400).toFixed(6);

  const WAVE_FN = `
    uniform float uTime; uniform float uDist;
    void addWave(vec2 p, float kx, float kz, float A, float Q, float damp, inout vec3 d, inout vec2 g) {
      float k = length(vec2(kx, kz));
      float w = sqrt(9.8 * k);
      float f = kx * p.x + kz * p.y + w * uTime;
      float a = A * damp;
      d.y += a * sin(f);
      d.xz += Q * a * vec2(kx, kz) / k * cos(f);
      g += a * vec2(kx, kz) * cos(f);
    }
    float breaker(vec2 p, out float crest) {
      float ph = (p.x - ${SHORE.toFixed(1)}) * 0.32 + uTime * 0.95 + 0.6 * sin(p.y * ${P(6)}) + 0.3 * sin(p.y * ${P(17)} + 1.3);
      float s = 0.5 + 0.5 * sin(ph);
      float env = smoothstep(42.0, 24.0, p.x) * smoothstep(${(SHORE - 0.4).toFixed(1)}, ${(SHORE + 6).toFixed(1)}, p.x);
      crest = pow(s, 6.0) * env;
      return pow(s, 3.0) * env * 0.42;
    }
    vec3 oceanDisp(vec2 p, out vec2 g, out float crest) {
      vec3 d = vec3(0.0); g = vec2(0.0);
      float damp = smoothstep(${(SHORE + 2).toFixed(1)}, 50.0, p.x);
      addWave(p, 0.16, ${P(4)}, 0.34, 0.6, damp, d, g);
      addWave(p, 0.30, -${P(10)}, 0.17, 0.7, damp, d, g);
      addWave(p, 0.55, ${P(30)}, 0.08, 0.8, damp, d, g);
      addWave(p, 0.90, -${P(50)}, 0.04, 0.8, 1.0, d, g);
      addWave(p, 1.60, ${P(90)}, 0.02, 0.6, 1.0, d, g);
      float b = breaker(p, crest);
      d.y += b;
      g.x += b * 0.35;
      return d;
    }`;

  const oceanVert = `
    ${WAVE_FN}
    varying vec3 vW; varying vec3 vN; varying float vCrest; varying float vH; varying vec2 vP;
    void main() {
      vec3 pos = position;
      vec2 p = vec2(pos.x, pos.z - uDist);
      vec2 g; float crest;
      vec3 d = oceanDisp(p, g, crest);
      pos += d;
      vN = normalize(vec3(-g.x, 1.0, -g.y));
      vCrest = crest; vH = d.y; vP = p;
      vec4 w = modelMatrix * vec4(pos, 1.0);
      vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;

  const oceanFrag = `
    uniform float uDist; uniform float uTime;
    uniform vec3 uAmb; uniform vec3 uLight; uniform float uDetail;
    uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
    varying vec3 vW; varying vec3 vN; varying float vCrest; varying float vH; varying vec2 vP;
    ${PB.SKY_FN}
    ${NOISE}
    void main() {
      vec3 v = normalize(cameraPosition - vW);
      float dist = length(cameraPosition - vW);
      vec2 p = vP;
      float t = uTime;
      vec3 n = vN;
      float fade = 1.0 - smoothstep(30.0, 160.0, dist);
      vec2 rip = vec2(
        sin(p.x * 2.3 + p.y * ${P(140)} + t * 2.1) + sin(p.x * 3.7 - p.y * ${P(220)} + t * 2.9) * 0.6,
        cos(p.x * 1.9 - p.y * ${P(180)} - t * 2.4) + cos(p.x * 4.1 + p.y * ${P(260)} + t * 3.3) * 0.6);
      n = normalize(n + vec3(rip.x, 0.0, rip.y) * 0.06 * fade * uDetail);

      float ndv = max(dot(n, v), 0.0);
      float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
      vec3 r = reflect(-v, n); r.y = abs(r.y) + 0.02;
      vec3 refl = skyBase(normalize(r));

      vec3 deep = mix(vec3(0.012, 0.06, 0.1), vec3(0.004, 0.015, 0.035), uNight);
      vec3 shal = mix(vec3(0.05, 0.28, 0.32), vec3(0.01, 0.06, 0.09), uNight);
      float sss = clamp(vH * 1.6 + 0.25, 0.0, 1.0) * (1.0 - smoothstep(25.0, 120.0, vP.x) * 0.6);
      vec3 body = mix(deep, shal, sss) * (0.6 + 0.6 * uAmb);
      vec3 col = mix(body, refl, fres);

      vec3 sd = normalize(uSunDir);
      float sunUp = smoothstep(-0.12, 0.02, sd.y);
      float sp = max(dot(r, sd), 0.0);
      col += uSunCol * (pow(sp, 600.0) * 6.0 + pow(sp, 60.0) * 0.5 + pow(sp, 12.0) * 0.12) * sunUp;

      vec3 md = normalize(uMoonDir);
      float mp = max(dot(r, md), 0.0);
      float glint = smoothstep(0.62, 0.95, pn(p * 3.0 + vec2(t * 1.5), 3.0));
      col += vec3(0.7, 0.8, 1.0) * (pow(mp, 300.0) * 3.0 + pow(mp, 30.0) * glint * 1.4 + pow(mp, 8.0) * 0.05) * uNight;

      float fn = pn(p * 1.4 + vec2(t * 0.6, 0.0), 1.4) * 0.6 + pn(p * 4.0 - vec2(t, 0.0), 4.0) * 0.4;
      float foam = smoothstep(0.25, 0.6, vCrest * (0.6 + fn));
      float trail = smoothstep(26.0, ${SHORE.toFixed(1)}, vP.x) * smoothstep(0.55, 0.8, fn) * 0.6;
      float edge = smoothstep(${(SHORE + 2.2).toFixed(1)}, ${SHORE.toFixed(1)}, vP.x) * (0.5 + 0.5 * fn);
      float fm = clamp(foam + trail + edge, 0.0, 1.0);
      vec3 foamCol = vec3(0.92, 0.95, 0.97) * (uAmb * 0.75 + uLight * 0.35 + 0.05);
      col = mix(col, foamCol, fm * 0.9);

      float fogF = smoothstep(uFogNear, uFogFar * 1.6, dist);
      col = mix(col, uFogColor, fogF * 0.85);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const beachVert = `
    ${WAVE_FN}
    varying vec3 vW; varying vec2 vP;
    void main() {
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz; vP = vec2(position.x, position.z - uDist);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;

  const beachFrag = `
    uniform float uDist; uniform float uTime;
    uniform vec3 uAmb; uniform vec3 uLight; uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform float uNight;
    uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
    varying vec3 vW; varying vec2 vP;
    ${NOISE}
    void main() {
      vec2 p = vP; float t = uTime;
      float n1 = pn(p * 0.6, 0.6), n2 = pn(p * 3.0, 3.0), n3 = pn(p * 14.0, 14.0);
      vec3 sand = mix(vec3(0.78, 0.66, 0.48), vec3(0.88, 0.78, 0.6), n1) * (0.85 + 0.15 * n2) * (0.92 + 0.08 * n3);
      float sw = 0.5 + 0.5 * sin(t * 0.62 + p.y * ${P(3)} + 0.8 * sin(p.y * ${P(7)} + 2.0));
      sw = pow(sw, 1.6);
      float xw = ${SHORE.toFixed(1)} - sw * 2.8 - 0.15 * n2;
      float wet = smoothstep(xw - 3.2, xw - 0.2, p.x);
      sand *= mix(1.0, 0.55, wet);
      float film = smoothstep(xw - 0.05, xw + 0.25, p.x);
      vec3 water = vec3(0.06, 0.22, 0.25);
      vec3 col = mix(sand, mix(sand * 0.6, water, 0.55), film);
      float lace = smoothstep(0.5, 0.0, abs(p.x - xw - 0.2)) * smoothstep(0.3, 0.7, n2 * 0.6 + n3 * 0.5);
      lace += film * smoothstep(0.68, 0.85, pn(p * 2.5 + vec2(t * 0.4, 0.0), 2.5)) * 0.5;
      col = mix(col, vec3(0.95), clamp(lace, 0.0, 1.0) * 0.85);
      float rock = smoothstep(0.78, 0.84, pn(p * vec2(0.9, 0.35) + 13.0, 0.35)) * (1.0 - film);
      col = mix(col, vec3(0.25, 0.23, 0.22) * (0.7 + 0.5 * n3), rock);

      vec3 nrm = normalize(vec3(0.13, 1.0, 0.0));
      vec3 ld = uSunDir.y > -0.06 ? normalize(uSunDir) : normalize(uMoonDir);
      float diff = max(dot(nrm, ld), 0.0);
      vec3 lit = col * (uAmb * 0.75 + uLight * diff * 0.9);
      float spec = film * pow(max(dot(reflect(-normalize(cameraPosition - vW), vec3(0,1,0)), ld), 0.0), 40.0);
      lit += uLight * spec * 0.6;
      float dist = length(cameraPosition - vW);
      lit = mix(lit, uFogColor, smoothstep(uFogNear, uFogFar, dist));
      gl_FragColor = vec4(lit, 1.0);
    }`;

  function gridGeo(nx, nz, fx, fz) {
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
    let k = 0;
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        pos[k++] = fx(i / nx); pos[k++] = 0; pos[k++] = fz(j / nz);
      }
    }
    const idx = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }

  const zMap = (v) => { const t = v * 2 - 1; return t < 0 ? -700 * Math.pow(-t, 1.7) : 120 * Math.pow(t, 1.4); };

  const Ocean = {
    U: common,
    init(scene) {
      this.scene = scene;
      const og = gridGeo(120, 160, (u) => SHORE - 2 + 700 * Math.pow(u, 2.3), zMap);
      og.computeBoundingSphere();
      og.boundingSphere.radius = 2000;
      const om = new THREE.ShaderMaterial({ uniforms: common, vertexShader: oceanVert, fragmentShader: oceanFrag });
      this.ocean = new THREE.Mesh(og, om);
      this.ocean.position.y = SEA_Y;
      this.ocean.frustumCulled = false;
      scene.add(this.ocean);

      const x0 = 4.6, x1 = 26;
      const bg = gridGeo(40, 90, (u) => x0 + (x1 - x0) * u, zMap);
      const bp = bg.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const x = bp.getX(i);
        const tt = (x - x0) / (x1 - x0);
        bp.setY(i, -0.25 + (SEA_Y + 0.25) * (x - x0) / (SHORE - x0) - Math.pow(tt, 3) * 0.6);
      }
      bg.computeVertexNormals();
      const bm = new THREE.ShaderMaterial({ uniforms: common, vertexShader: beachVert, fragmentShader: beachFrag });
      this.beach = new THREE.Mesh(bg, bm);
      this.beach.receiveShadow = true;
      this.beach.frustumCulled = false;
      scene.add(this.beach);
    },
    update(dist, amb, light, detail) {
      const f = this.scene.fog;
      FOG.uFogColor.value.copy(f.color); FOG.uFogNear.value = f.near; FOG.uFogFar.value = f.far;
      common.uDist.value = dist % PERIOD;
      common.uAmb.value.copy(amb);
      common.uLight.value.copy(light);
      common.uDetail.value = detail;
    }
  };

  PB.Ocean = Ocean;
})();
