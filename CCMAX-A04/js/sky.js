window.PG = window.PG || {};

PG.Sky = (function () {
  const C = (h) => new THREE.Color(h);
  const KEYS = [
    { t: 0.00, name: '黄昏', zen: C('#3d6db0'), hor: C('#ffb06a'), glow: C('#ffcf8a'), light: C('#ffcf96'), li: 2.1, hs: C('#a8bde0'), hg: C('#6b4a38'), hi: 0.75, cloud: C('#ffd2a8') },
    { t: 0.16, name: '日落', zen: C('#2c4888'), hor: C('#ff7440'), glow: C('#ff8f4a'), light: C('#ff9a5c'), li: 1.5, hs: C('#8a90c0'), hg: C('#5a3a30'), hi: 0.6, cloud: C('#ff9a70') },
    { t: 0.25, name: '晚霞', zen: C('#1c285a'), hor: C('#c2557a'), glow: C('#ff6a5c'), light: C('#e0708a'), li: 0.55, hs: C('#5a5a96'), hg: C('#2e2232'), hi: 0.45, cloud: C('#d4607a') },
    { t: 0.33, name: '蓝调时刻', zen: C('#0d1640'), hor: C('#36478a'), glow: C('#5a5aa0'), light: C('#7484c0'), li: 0.35, hs: C('#3a4680'), hg: C('#141a2a'), hi: 0.35, cloud: C('#38406e') },
    { t: 0.43, name: '星空月夜', zen: C('#02051a'), hor: C('#0f1a3c'), glow: C('#2a3a6a'), light: C('#a4b8ff'), li: 0.6, hs: C('#26345e'), hg: C('#0a0e18'), hi: 0.32, cloud: C('#1e2846') },
    { t: 0.82, name: '星空月夜', zen: C('#02051a'), hor: C('#0f1a3c'), glow: C('#2a3a6a'), light: C('#a4b8ff'), li: 0.6, hs: C('#26345e'), hg: C('#0a0e18'), hi: 0.32, cloud: C('#1e2846') },
    { t: 0.91, name: '破晓', zen: C('#18204e'), hor: C('#7a5a8c'), glow: C('#c07a7a'), light: C('#c09ab0'), li: 0.5, hs: C('#5a5a8a'), hg: C('#2a2230'), hi: 0.45, cloud: C('#9a6a86') },
    { t: 1.00, name: '黄昏', zen: C('#3d6db0'), hor: C('#ffb06a'), glow: C('#ffcf8a'), light: C('#ffcf96'), li: 2.1, hs: C('#a8bde0'), hg: C('#6b4a38'), hi: 0.75, cloud: C('#ffd2a8') },
  ];

  const state = {
    t: 0, name: '黄昏', night: 0,
    sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), lightDir: new THREE.Vector3(),
    zen: new THREE.Color(), hor: new THREE.Color(), glow: new THREE.Color(),
    light: new THREE.Color(), li: 1, hs: new THREE.Color(), hg: new THREE.Color(), hi: 1,
    cloud: new THREE.Color(), sunVis: 1, moonVis: 0, starVis: 0, lamps: 0,
  };

  const vert = `
    varying vec3 vDir;
    void main(){
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      gl_Position = p.xyww;
    }`;

  const frag = `
    uniform vec3 uZen, uHor, uGlow, uSunDir, uMoonDir, uCloud, uSunCol;
    uniform float uSunVis, uMoonVis, uStarVis, uTime, uNight;
    varying vec3 vDir;
    float h1(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
    vec3 h3(vec3 p){ return vec3(h1(p), h1(p+19.19), h1(p+47.3)); }
    float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
      float a=h1(vec3(i,0.)), b=h1(vec3(i+vec2(1,0),0.)), c=h1(vec3(i+vec2(0,1),0.)), d=h1(vec3(i+vec2(1,1),0.));
      return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
    void main(){
      vec3 d = normalize(vDir);
      float h = d.y;
      float hp = max(h, 0.0);
      vec3 col = mix(uHor, uZen, pow(hp, 0.45));
      float sd = dot(d, uSunDir);
      float side = pow(max(sd,0.0)*0.5+0.5, 4.0);
      col += uGlow * pow(1.0-hp, 7.0) * side * 0.65 * (0.35 + 0.65*uSunVis);
      col += uSunCol * pow(max(sd,0.0), 10.0) * 0.45 * uSunVis;
      col += uSunCol * pow(max(sd,0.0), 300.0) * 1.2 * uSunVis;
      float disk = smoothstep(0.99955, 0.99975, sd);
      col = mix(col, vec3(1.0,0.93,0.75)*1.6, disk*uSunVis);

      vec2 cuv = d.xz / (h + 0.12);
      float cl = fbm(cuv*vec2(1.3,3.2) + vec2(uTime*0.004, 0.0));
      cl = smoothstep(0.52, 0.85, cl) * smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.55, 0.9, h));

      if (uStarVis > 0.001) {
        vec3 p = d * 140.0;
        vec3 c = floor(p); vec3 f = fract(p);
        float r = h1(c);
        vec3 o = 0.2 + 0.6*h3(c);
        float dd = length(f - o);
        float tw = 0.65 + 0.35*sin(uTime*(2.0+r*4.0) + r*90.0);
        float st = step(0.955, r) * smoothstep(0.17, 0.0, dd) * tw * (0.5 + 2.5*(r-0.955)/0.045);
        vec3 sc = mix(vec3(0.75,0.85,1.0), vec3(1.0,0.9,0.75), h1(c+3.1));
        float mw = fbm(vec2(atan(d.z,d.x)*3.0, (d.y - 0.45*sin(atan(d.z,d.x)*1.0+0.7))*9.0));
        float band = exp(-pow((d.y - 0.45*sin(atan(d.z,d.x)+0.7))*3.2, 2.0));
        vec3 milky = vec3(0.35,0.4,0.6) * band * smoothstep(0.35,0.8,mw) * 0.35;
        col += (sc*st + milky) * uStarVis * smoothstep(-0.02, 0.15, h) * (1.0 - cl);
      }

      float md = dot(d, uMoonDir);
      if (uMoonVis > 0.001) {
        vec3 up = abs(uMoonDir.y) < 0.95 ? vec3(0,1,0) : vec3(1,0,0);
        vec3 mx = normalize(cross(up, uMoonDir)); vec3 my = cross(uMoonDir, mx);
        vec2 mp = vec2(dot(d,mx), dot(d,my)) / 0.032;
        float r2 = dot(mp,mp);
        float mdisk = smoothstep(1.0, 0.94, r2) * step(0.0, md);
        float cr = fbm(mp*2.3+3.0)*0.55 + fbm(mp*6.0)*0.25;
        vec3 mcol = vec3(1.0,0.97,0.88) * (1.05 - cr*0.55) * (0.85+0.15*sqrt(max(0.0,1.0-r2)));
        col += vec3(0.55,0.65,1.0) * (pow(max(md,0.0), 400.0)*0.35 + pow(max(md,0.0), 40.0)*0.08) * uMoonVis;
        col = mix(col, mcol*1.3, mdisk*uMoonVis*(1.0-cl*0.85));
      }

      vec3 cc = uCloud * (0.75 + 0.5*pow(max(sd,0.0),3.0)*uSunVis) + vec3(0.25,0.3,0.45)*pow(max(md,0.0),6.0)*uMoonVis;
      col = mix(col, cc, cl*0.8);
      col = mix(col, uHor*0.9, smoothstep(0.02, -0.05, h));
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  let mesh, uniforms;

  function create(scene) {
    uniforms = {
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
      uCloud: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() },
      uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uStarVis: { value: 0 }, uTime: { value: 0 }, uNight: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), mat);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function update(t, time, camPos) {
    t = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const k = sm(0, 1, (t - a.t) / (b.t - a.t));
    for (const f of ['zen', 'hor', 'glow', 'light', 'hs', 'hg', 'cloud']) state[f].copy(a[f]).lerp(b[f], k);
    state.li = a.li + (b.li - a.li) * k;
    state.hi = a.hi + (b.hi - a.hi) * k;
    state.name = k < 0.5 ? a.name : b.name;
    state.t = t;

    const elev = 0.2 * Math.cos(Math.PI * 2 * t) - 0.04;
    state.sunDir.set(-0.55, 0, -0.85).normalize().multiplyScalar(Math.cos(elev)).setY(Math.sin(elev));
    const mElev = -0.12 + 0.36 * sm(0.22, 0.52, t) - 0.36 * sm(0.84, 0.99, t);
    state.moonDir.set(-0.32, 0, -0.95).normalize().multiplyScalar(Math.cos(mElev)).setY(Math.sin(mElev));

    state.sunVis = sm(-0.06, 0.02, elev);
    state.night = sm(0.27, 0.42, t) * (1 - sm(0.86, 0.97, t));
    state.starVis = sm(0.28, 0.44, t) * (1 - sm(0.84, 0.94, t));
    state.moonVis = sm(-0.04, 0.04, mElev) * sm(0.2, 0.4, t);
    state.lamps = sm(0.2, 0.32, t) * (1 - sm(0.9, 0.98, t));

    const sd = state.sunDir.clone(); sd.y = Math.max(sd.y, 0.12); sd.normalize();
    const md = state.moonDir.clone(); md.y = Math.max(md.y, 0.25); md.normalize();
    state.lightDir.copy(sd).lerp(md, sm(0.25, 0.4, t) * (1 - sm(0.9, 1.0, t))).normalize();

    if (uniforms) {
      uniforms.uZen.value.copy(state.zen); uniforms.uHor.value.copy(state.hor); uniforms.uGlow.value.copy(state.glow);
      uniforms.uCloud.value.copy(state.cloud); uniforms.uSunCol.value.copy(state.light);
      uniforms.uSunDir.value.copy(state.sunDir); uniforms.uMoonDir.value.copy(state.moonDir);
      uniforms.uSunVis.value = state.sunVis; uniforms.uMoonVis.value = state.moonVis;
      uniforms.uStarVis.value = state.starVis; uniforms.uTime.value = time; uniforms.uNight.value = state.night;
      if (camPos) mesh.position.copy(camPos);
    }
    return state;
  }

  return { create, update, state };
})();
