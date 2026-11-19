window.PG = window.PG || {};

PG.W = {
  SEA_Y: -2.4,
  LANES: [-2.6, 0, 2.6],
  shoreX(d) { return -16 + 2.5 * Math.sin(d * 0.013) + 1.2 * Math.sin(d * 0.041 + 1.0); },
  sandY(x, d) {
    const s = x - PG.W.shoreX(d);
    let y = -2.4 + s * 0.075 + 0.08 * Math.sin(d * 0.21 + x * 0.3) * Math.max(0, Math.min(1, s / 4));
    return Math.max(-7, Math.min(-1.45, y));
  },
};

PG.Ocean = (function () {
  const TAU = Math.PI * 2;
  const WAVES = [
    [0.18, TAU * 3 / 400, 0.26],
    [0.11, -TAU * 7 / 400, 0.17],
    [0.33, TAU * 13 / 400, 0.08],
    [0.55, -TAU * 25 / 400, 0.04],
    [0.85, TAU * 41 / 400, 0.022],
  ];
  const waveGLSL = WAVES.map((w, i) => {
    const k = Math.hypot(w[0], w[1]);
    const om = Math.sqrt(9.8 * k);
    const f = (v) => v.toFixed(5);
    const q = Math.min(1, 0.55 / (k * w[2] * WAVES.length));
    return `wave(vec2(${f(w[0] / k)},${f(w[1] / k)}), ${f(k)}, ${f(w[2])}, ${f(om)}, ${f(q)}, p, amp, P, T, B);`;
  }).join('\n      ');

  const vert = `
    uniform float uTime, uDistW, uDistS;
    varying vec3 vWorld; varying vec3 vNormal; varying float vFoam; varying float vS; varying float vDF; varying float vFog;
    float shoreX(float d){ return -16.0 + 2.5*sin(d*0.013) + 1.2*sin(d*0.041+1.0); }
    void wave(vec2 dir, float k, float a, float om, float q, vec2 p, float amp, inout vec3 P, inout vec3 T, inout vec3 B){
      float th = k*dot(dir,p) - om*uTime;
      float c = cos(th), s = sin(th);
      a *= amp;
      P.x += q*a*dir.x*c; P.z += q*a*dir.y*c; P.y += a*s;
      float wa = k*a;
      T += vec3(-q*dir.x*dir.x*wa*s, dir.x*wa*c, -q*dir.x*dir.y*wa*s);
      B += vec3(-q*dir.x*dir.y*wa*s, dir.y*wa*c, -q*dir.y*dir.y*wa*s);
    }
    void main(){
      vec3 wp = (modelMatrix * vec4(position,1.0)).xyz;
      float dS = uDistS - wp.z;
      vec2 p = vec2(wp.x, uDistW - wp.z);
      float s = wp.x - shoreX(dS);
      float camD = length(wp.xz - cameraPosition.xz);
      float amp = (1.0 - smoothstep(180.0, 650.0, camD)) * (0.35 + 0.65*(1.0 - smoothstep(-40.0, -6.0, s)));
      vec3 P = vec3(0.0); vec3 T = vec3(1.0,0.0,0.0); vec3 B = vec3(0.0,0.0,1.0);
      ${waveGLSL}
      float ph = s*0.42 - uTime*1.5 + sin(dS*0.045)*1.2 + sin(dS*0.11+2.0)*0.5;
      float zone = smoothstep(-32.0, -13.0, s) * (1.0 - smoothstep(-5.5, -0.5, s));
      float cr = pow(0.5 + 0.5*sin(ph), 4.0);
      float sw = 0.45 * zone;
      P.y += sw * cr;
      float dcr = 4.0*pow(0.5+0.5*sin(ph),3.0)*0.5*cos(ph)*0.42*sw;
      T.y += dcr;
      P.x += sw * cr * 0.6;
      float swash = 0.17*sin(uTime*0.9 + dS*0.03) * smoothstep(-9.0, 0.0, s);
      P.y += swash;
      vFoam = cr * smoothstep(-16.0, -6.0, s) * (1.0 - smoothstep(-1.5, 2.0, s));
      vec3 N = normalize(cross(B, T));
      wp += P;
      vWorld = wp; vNormal = N; vS = s; vDF = dS;
      vec4 mv = viewMatrix * vec4(wp,1.0);
      vFog = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`;

  const frag = `
    uniform vec3 uZen, uHor, uGlow, uSunDir, uMoonDir, uLight, uFogColor, uAmb;
    uniform float uSunVis, uMoonVis, uTime, uFogDensity, uNight, uSeaY;
    varying vec3 vWorld; varying vec3 vNormal; varying float vFoam; varying float vS; varying float vDF; varying float vFog;
    float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y); }
    float shoreX(float d){ return -16.0 + 2.5*sin(d*0.013) + 1.2*sin(d*0.041+1.0); }
    float sandY(float x, float d){
      float s = x - shoreX(d);
      float y = -2.4 + s*0.075 + 0.08*sin(d*0.21 + x*0.3)*clamp(s/4.0,0.0,1.0);
      return clamp(y, -7.0, -1.45);
    }
    vec3 skyCol(vec3 r){
      float h = max(r.y, 0.0);
      vec3 c = mix(uHor, uZen, pow(h, 0.45));
      float sd = max(dot(r, uSunDir), 0.0);
      c += uGlow * pow(1.0-h, 6.0) * pow(sd*0.5+0.5, 4.0) * 0.6 * (0.35+0.65*uSunVis);
      return c;
    }
    void main(){
      vec3 V = normalize(cameraPosition - vWorld);
      vec2 q = vec2(vWorld.x, vDF);
      float dist = length(cameraPosition - vWorld);
      float detail = 1.0 - smoothstep(30.0, 220.0, dist);
      vec2 rip = vec2(n2(q*0.9 + vec2(uTime*0.6, uTime*0.3)) - 0.5, n2(q*0.9 + vec2(-uTime*0.4, uTime*0.5) + 17.0) - 0.5);
      rip += 0.5*vec2(n2(q*2.7 + uTime*0.9) - 0.5, n2(q*2.7 - uTime*0.8 + 5.0) - 0.5);
      vec3 N = normalize(vNormal + vec3(rip.x, 0.0, rip.y) * (0.35*detail + 0.06));
      float ndv = max(dot(N, V), 0.0);
      float fres = 0.02 + 0.98*pow(1.0 - ndv, 5.0);
      vec3 R = reflect(-V, N); R.y = abs(R.y);
      vec3 refl = skyCol(R);
      float depth = vWorld.y - sandY(vWorld.x, vDF);
      vec3 deep = vec3(0.02, 0.10, 0.16);
      vec3 shallow = vec3(0.10, 0.42, 0.45);
      vec3 body = mix(shallow, deep, smoothstep(0.2, 3.5, depth));
      body *= (uAmb + uLight*0.35*max(dot(N, normalize(uSunDir + vec3(0,0.3,0))),0.0)) ;
      vec3 col = mix(body, refl, clamp(fres*1.1, 0.0, 1.0));
      float sp = max(dot(R, uSunDir), 0.0);
      col += uLight * (pow(sp, 600.0)*6.0 + pow(sp, 60.0)*0.35) * uSunVis;
      float mp = max(dot(R, uMoonDir), 0.0);
      float glit = smoothstep(0.55, 0.95, n2(q*3.0 + uTime*1.7));
      col += vec3(0.75,0.82,1.0) * (pow(mp, 900.0)*5.0 + pow(mp, 70.0)*0.5*glit) * uMoonVis;
      float fn = n2(q*vec2(1.6,0.9) + vec2(uTime*0.3, 0.0)) * 0.6 + n2(q*4.5 - uTime*0.5)*0.4;
      float crest = smoothstep(0.35, 0.85, vFoam + fn*0.35 - 0.1);
      float wl = 1.0 - smoothstep(0.02, 0.22 + fn*0.25, depth);
      float foam = max(crest*0.95, wl*0.9);
      vec3 foamCol = uAmb*1.25 + uLight*0.55;
      col = mix(col, foamCol, clamp(foam, 0.0, 1.0));
      float alpha = mix(0.0, 1.0, smoothstep(0.0, 0.08, depth));
      alpha = max(alpha, foam*smoothstep(-0.05, 0.04, depth));
      float fog = 1.0 - exp(-uFogDensity*uFogDensity*vFog*vFog);
      col = mix(col, uFogColor, clamp(fog, 0.0, 1.0));
      gl_FragColor = vec4(col, alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  let mesh, mat;
  const geoms = {};

  function buildGeom(nx, nzA, nzB) {
    const xs = [], zs = [];
    for (let i = 0; i <= nx; i++) xs.push(-5.6 - 1194 * Math.pow(i / nx, 2.6));
    for (let j = nzB; j >= 1; j--) zs.push(220 * Math.pow(j / nzB, 2.0));
    for (let j = 0; j <= nzA; j++) zs.push(-950 * Math.pow(j / nzA, 2.2));
    const pos = new Float32Array(xs.length * zs.length * 3);
    let k = 0;
    for (let j = 0; j < zs.length; j++) for (let i = 0; i < xs.length; i++) { pos[k++] = xs[i]; pos[k++] = 0; pos[k++] = zs[j]; }
    const idx = [];
    const W = xs.length;
    for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 5000);
    return g;
  }

  function create(scene) {
    mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uDistW: { value: 0 }, uDistS: { value: 0 }, uSeaY: { value: PG.W.SEA_Y },
        uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() }, uLight: { value: new THREE.Color() },
        uAmb: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() }, uFogDensity: { value: 0.003 },
        uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uNight: { value: 0 },
      },
      vertexShader: vert, fragmentShader: frag, transparent: true,
    });
    mesh = new THREE.Mesh(getGeom('high'), mat);
    mesh.position.y = PG.W.SEA_Y;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
    Spray.create(scene);
    return mesh;
  }

  function getGeom(q) {
    if (!geoms[q]) {
      const cfg = { high: [170, 170, 30], mid: [115, 120, 22], low: [75, 80, 14] }[q];
      geoms[q] = buildGeom(cfg[0], cfg[1], cfg[2]);
    }
    return geoms[q];
  }

  function setQuality(q) { if (mesh) mesh.geometry = getGeom(q); Spray.setQuality(q); }

  function update(time, dist, sky, fog, amb) {
    const u = mat.uniforms;
    u.uTime.value = time;
    u.uDistW.value = dist % 400;
    u.uDistS.value = dist;
    u.uZen.value.copy(sky.zen); u.uHor.value.copy(sky.hor); u.uGlow.value.copy(sky.glow);
    u.uSunDir.value.copy(sky.sunDir); u.uMoonDir.value.copy(sky.moonDir);
    u.uLight.value.copy(sky.light).multiplyScalar(Math.min(1.2, sky.li * 0.7));
    u.uAmb.value.copy(amb);
    u.uSunVis.value = sky.sunVis; u.uMoonVis.value = sky.moonVis; u.uNight.value = sky.night;
    u.uFogColor.value.copy(fog.color); u.uFogDensity.value = fog.density;
  }

  const Spray = (function () {
    let pts, geo, N = 360, active = 360, P = [];
    const tex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    function create(scene) {
      geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1));
      const m = new THREE.ShaderMaterial({
        uniforms: { uTex: { value: tex }, uCol: { value: new THREE.Color(1, 1, 1) }, uScale: { value: 300 } },
        vertexShader: `attribute float alpha; varying float vA; uniform float uScale;
          void main(){ vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = uScale*(0.25+0.6*alpha)/max(-mv.z,1.0); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform sampler2D uTex; uniform vec3 uCol; varying float vA;
          void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(uCol, t.a*vA*0.55);
          #include <colorspace_fragment>
          }`,
        transparent: true, depthWrite: false,
      });
      pts = new THREE.Points(geo, m);
      pts.frustumCulled = false;
      pts.renderOrder = 3;
      scene.add(pts);
      for (let i = 0; i < N; i++) P.push({ d: 0, x: 0, y: -99, vx: 0, vy: 0, vd: 0, life: 0, max: 1 });
    }
    function emit(p, dist, time) {
      const d = dist - 15 + Math.random() * 150;
      const s = -6.5 - Math.random() * 4;
      p.d = d; p.x = PG.W.shoreX(d) + s; p.y = PG.W.SEA_Y + 0.2 + Math.random() * 0.3;
      p.vx = 1 + Math.random() * 2.5; p.vy = 1.5 + Math.random() * 2.8; p.vd = (Math.random() - 0.5) * 1.2;
      p.max = 0.8 + Math.random() * 1.0; p.life = p.max;
    }
    function update(dt, dist, time, col) {
      if (!pts) return;
      const pos = geo.attributes.position.array, al = geo.attributes.alpha.array;
      for (let i = 0; i < N; i++) {
        const p = P[i];
        if (i >= active) { al[i] = 0; continue; }
        p.life -= dt;
        if (p.life <= 0) { if (Math.random() < 0.5) emit(p, dist, time); else { p.life = Math.random() * 0.6; p.y = -99; } }
        p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.d += p.vd * dt;
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = -(p.d - dist);
        const a = p.y < -50 ? 0 : Math.sin(Math.PI * Math.max(0, p.life / p.max));
        al[i] = a;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
      pts.material.uniforms.uCol.value.copy(col);
    }
    function setQuality(q) { active = q === 'high' ? N : q === 'mid' ? 220 : 110; }
    function setScale(s) { if (pts) pts.material.uniforms.uScale.value = s; }
    return { create, update, setQuality, setScale };
  })();

  return { create, update, setQuality, Spray };
})();
