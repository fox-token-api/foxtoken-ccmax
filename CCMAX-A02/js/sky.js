(function () {
  const PB = (window.PB = window.PB || {});

  const KEYS = [
    { e: -22, top: 0x03060f, hor: 0x111c36, sun: 0x000000, amb: 0x2a3a64, gnd: 0x0a0d16, light: 0x8ea6d8 },
    { e: -12, top: 0x070c20, hor: 0x1c2b4e, sun: 0x000000, amb: 0x2c3a66, gnd: 0x0a0d16, light: 0x8ea6d8 },
    { e: -5,  top: 0x172150, hor: 0x7a4f78, sun: 0x9a4a5a, amb: 0x3a3a68, gnd: 0x120e14, light: 0xb0a0d0 },
    { e: 0,   top: 0x2a3a72, hor: 0xff7040, sun: 0xff5a26, amb: 0x6a5070, gnd: 0x2a1a14, light: 0xff8a50 },
    { e: 5,   top: 0x41639e, hor: 0xffb46c, sun: 0xffa050, amb: 0x8a8098, gnd: 0x3a2a20, light: 0xffb070 },
    { e: 14,  top: 0x3d73bf, hor: 0xf5d6a8, sun: 0xffe2b0, amb: 0xa0b0c8, gnd: 0x4a4030, light: 0xfff0d8 },
    { e: 40,  top: 0x3570c4, hor: 0xb5d8f0, sun: 0xfff6e8, amb: 0xb8cce0, gnd: 0x505040, light: 0xffffff }
  ].map((k) => ({
    e: k.e,
    top: new THREE.Color(k.top), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun),
    amb: new THREE.Color(k.amb), gnd: new THREE.Color(k.gnd), light: new THREE.Color(k.light)
  }));

  const U = {
    uTop: { value: new THREE.Color() },
    uHor: { value: new THREE.Color() },
    uSunCol: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1) },
    uMoonDir: { value: new THREE.Vector3(0, 0.3, -1) },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uCloudOff: { value: new THREE.Vector2() },
    uSS0: { value: new THREE.Vector3(0, 0.5, -1) },
    uSS1: { value: new THREE.Vector3(0, 0.4, -1) },
    uSSP: { value: -1 }
  };

  const vert = `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      gl_Position = p.xyww;
    }`;

  const SKY_FN = `
    uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunCol;
    uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform float uNight;
    vec3 skyBase(vec3 d) {
      float h = max(d.y, 0.0);
      vec3 c = mix(uHor, uTop, pow(h, 0.45));
      float sd = max(dot(d, normalize(uSunDir)), 0.0);
      float sunUp = smoothstep(-0.25, 0.05, uSunDir.y);
      c += uSunCol * (pow(sd, 6.0) * 0.45 + pow(sd, 48.0) * 0.6) * sunUp;
      float md = max(dot(d, normalize(uMoonDir)), 0.0);
      c += vec3(0.55, 0.65, 0.9) * pow(md, 30.0) * 0.18 * uNight;
      c = mix(c, uHor * 0.6, smoothstep(0.0, -0.3, d.y));
      return c;
    }`;
  PB.SKY_FN = SKY_FN;

  const frag = `
    varying vec3 vDir;
    uniform float uTime; uniform vec2 uCloudOff;
    uniform vec3 uSS0; uniform vec3 uSS1; uniform float uSSP;
    ${SKY_FN}
    float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vn(vec2 p) {
      vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
    }
    float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s; }
    float segDist(vec3 p, vec3 a, vec3 b) {
      vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      return length(pa - ba * h);
    }
    void main() {
      vec3 d = normalize(vDir);
      vec3 col = skyBase(d);
      float up = max(d.y, 0.0);

      if (uNight > 0.01 && d.y > -0.02) {
        vec3 sp = d * 130.0; vec3 cell = floor(sp); vec3 fr = fract(sp) - 0.5;
        float r = h31(cell);
        float star = 0.0;
        if (r > 0.94) {
          vec3 off = vec3(h31(cell + 3.1), h31(cell + 7.7), h31(cell + 1.3)) - 0.5;
          float dd = length(fr - off * 0.5);
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + r * 6.0) + r * 60.0);
          star = smoothstep(0.3, 0.02, dd) * tw * (0.35 + (r - 0.94) * 28.0);
        }
        vec3 band = normalize(vec3(0.6, 0.35, -0.72));
        float mw = exp(-pow(dot(d, band) * 4.5, 2.0)) * fbm(d.xz * 9.0 + d.y * 4.0);
        vec3 sc = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.9, 0.75), fract(h31(cell) * 13.0));
        col += (sc * star + vec3(0.25, 0.28, 0.42) * mw * 0.55) * uNight * smoothstep(-0.02, 0.15, d.y);
      }

      vec3 md = normalize(uMoonDir);
      float mdot = dot(d, md);
      if (uNight > 0.01 && mdot > 0.98) {
        float ang = acos(clamp(mdot, -1.0, 1.0));
        float disk = smoothstep(0.034, 0.03, ang);
        vec3 t1 = normalize(cross(md, vec3(0, 1, 0))); vec3 t2 = cross(t1, md);
        vec2 uv = vec2(dot(d - md, t1), dot(d - md, t2)) / 0.032;
        float shade = smoothstep(-0.4, 0.6, length(uv - vec2(-0.55, 0.15)));
        float crat = fbm(uv * 3.5 + 5.0);
        vec3 mc = vec3(1.0, 0.97, 0.88) * (0.75 + 0.35 * crat) * mix(0.18, 1.0, shade);
        col = mix(col, mc * 1.15, disk * uNight);
        col += vec3(0.6, 0.7, 0.95) * exp(-ang * 30.0) * 0.4 * uNight;
      } else if (uNight > 0.01) {
        float ang = acos(clamp(mdot, -1.0, 1.0));
        col += vec3(0.6, 0.7, 0.95) * exp(-ang * 30.0) * 0.4 * uNight;
      }

      vec3 sdv = normalize(uSunDir);
      float sang = acos(clamp(dot(d, sdv), -1.0, 1.0));
      col += uSunCol * smoothstep(0.03, 0.024, sang) * 2.2 * smoothstep(-0.05, 0.02, sdv.y);

      if (d.y > 0.0) {
        vec2 cp = d.xz / (d.y + 0.12) * 1.3 + uCloudOff;
        float cl = fbm(cp * 0.8) * 0.75 + fbm(cp * 2.3) * 0.25;
        float cover = smoothstep(0.52, 0.78, cl) * smoothstep(0.0, 0.08, d.y) * (1.0 - smoothstep(0.35, 0.75, d.y));
        float lit = pow(max(dot(d, sdv), 0.0), 3.0);
        vec3 cc = mix(uTop * 0.7 + uHor * 0.35, uSunCol * 1.2 + uHor * 0.3, lit * 0.8 + 0.2);
        cc = mix(cc, vec3(0.08, 0.1, 0.17) + vec3(0.25, 0.3, 0.42) * pow(max(mdot, 0.0), 8.0), uNight * 0.85);
        col = mix(col, cc, cover * 0.85);
      }

      if (uSSP >= 0.0 && uSSP <= 1.2) {
        float p = clamp(uSSP, 0.0, 1.0);
        vec3 head = normalize(mix(uSS0, uSS1, p));
        vec3 tail = normalize(mix(uSS0, uSS1, max(p - 0.35, 0.0)));
        float sd = segDist(d, tail, head);
        float along = clamp(dot(d - tail, head - tail) / max(dot(head - tail, head - tail), 1e-6), 0.0, 1.0);
        float fade = 1.0 - smoothstep(0.9, 1.2, uSSP);
        col += vec3(0.9, 0.95, 1.0) * smoothstep(0.0025, 0.0, sd) * along * fade * uNight * 1.6;
      }

      col += (h21(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }`;

  function lerpKeys(e, field, out) {
    if (e <= KEYS[0].e) return out.copy(KEYS[0][field]);
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], b = KEYS[i + 1];
      if (e <= b.e) {
        const t = (e - a.e) / (b.e - a.e);
        const s = t * t * (3 - 2 * t);
        return out.copy(a[field]).lerp(b[field], s);
      }
    }
    return out.copy(KEYS[KEYS.length - 1][field]);
  }

  const Sky = {
    U,
    hour: 17.3,
    rate: 1,
    elev: 0,
    night: 0,
    phase: '黄昏',
    icon: '🌅',
    sunLight: null,
    hemi: null,
    mesh: null,
    ssCooldown: 12,
    shootingSeen: false,
    onShootingStar: null,
    fogColor: new THREE.Color(),

    init(scene) {
      const geo = new THREE.SphereGeometry(900, 48, 24);
      const mat = new THREE.ShaderMaterial({
        uniforms: U, vertexShader: vert, fragmentShader: frag,
        side: THREE.BackSide, depthWrite: false, fog: false
      });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.frustumCulled = false;
      this.mesh.renderOrder = -10;
      scene.add(this.mesh);

      this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
      this.sunLight.castShadow = true;
      const sc = this.sunLight.shadow.camera;
      sc.left = -14; sc.right = 14; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 80;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.bias = -0.0008;
      this.sunLight.shadow.normalBias = 0.03;
      scene.add(this.sunLight, this.sunLight.target);

      this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.6);
      scene.add(this.hemi);

      scene.fog = new THREE.Fog(0x000000, 60, 420);
      this.scene = scene;
    },

    hourRate(h) {
      if (h >= 7.5 && h < 16.5) return 0.12;
      if (h >= 16.5 && h < 20) return 0.022;
      if (h >= 20 || h < 4) return 0.06;
      return 0.025;
    },

    update(dt, focus, camPos) {
      U.uTime.value += dt;
      this.hour = (this.hour + dt * this.hourRate(this.hour) * this.rate) % 24;
      const h = this.hour;

      const sunAng = ((h - 6) / 12) * Math.PI;
      const elevRad = Math.sin(sunAng) * 1.05;
      const azim = Math.cos(sunAng);
      const sun = U.uSunDir.value;
      sun.set(0.65 - azim * 0.15, Math.sin(elevRad), -0.75 + azim * 0.55).normalize();
      this.elev = Math.asin(sun.y) * 180 / Math.PI;

      const moonAng = ((h - 17.5 + 24) % 24 / 13) * Math.PI;
      const mv = U.uMoonDir.value;
      mv.set(0.42 + Math.cos(moonAng) * 0.3, Math.max(-0.2, Math.sin(moonAng) * 0.36), -0.9).normalize();

      const e = this.elev;
      lerpKeys(e, 'top', U.uTop.value);
      lerpKeys(e, 'hor', U.uHor.value);
      lerpKeys(e, 'sun', U.uSunCol.value);
      this.night = Math.min(1, Math.max(0, (-e - 4) / 10));
      U.uNight.value = this.night;

      U.uCloudOff.value.x += dt * 0.004;
      U.uCloudOff.value.y -= dt * 0.012;

      this.fogColor.copy(U.uHor.value).lerp(U.uTop.value, 0.25);
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.near = 60 + this.night * 10;
      this.scene.fog.far = 420 - this.night * 120;

      const useMoon = sun.y < -0.06;
      const ld = useMoon ? mv : sun;
      const L = this.sunLight;
      const tmp = new THREE.Color();
      if (useMoon) {
        L.color.set(0x9db4e8);
        L.intensity = 0.55 * Math.min(1, Math.max(0, mv.y * 3)) * this.night + 0.04;
      } else {
        lerpKeys(e, 'light', L.color);
        L.intensity = 0.25 + 1.1 * Math.min(1, Math.max(0, (sun.y + 0.06) * 4));
      }
      const ly = Math.max(ld.y, 0.18);
      L.position.set(focus.x + ld.x * 40, focus.y + ly * 40, focus.z + ld.z * 40);
      L.target.position.copy(focus);

      lerpKeys(e, 'amb', this.hemi.color);
      lerpKeys(e, 'gnd', this.hemi.groundColor);
      this.hemi.intensity = 0.55 + (1 - this.night) * 0.25;
      tmp.copy(this.hemi.color);

      this.mesh.position.copy(camPos);

      if (h >= 12 && h < 17.9) { this.phase = '黄昏'; this.icon = '🌅'; }
      else if (h >= 17.9 && h < 18.35) { this.phase = '日落'; this.icon = '🌇'; }
      else if (h >= 18.35 && h < 18.8) { this.phase = '蓝调时刻'; this.icon = '🌆'; }
      else if (h >= 18.8 || h < 5.2) { this.phase = '星空月夜'; this.icon = '🌙'; }
      else if (h >= 5.2 && h < 7) { this.phase = '黎明'; this.icon = '🌄'; }
      else { this.phase = '白昼'; this.icon = '☀️'; }

      this.updateShooting(dt);
    },

    updateShooting(dt) {
      const p = U.uSSP;
      if (p.value >= 0) {
        p.value += dt * 1.1;
        if (p.value > 1.25) p.value = -1;
        return;
      }
      if (this.night < 0.75) return;
      this.ssCooldown -= dt;
      if (this.ssCooldown <= 0) {
        this.ssCooldown = 14 + Math.random() * 22;
        const az = -0.5 + Math.random() * 1.6;
        const a = new THREE.Vector3(Math.sin(az), 0.45 + Math.random() * 0.25, -Math.cos(az)).normalize();
        const b = a.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.18 - Math.random() * 0.12, (Math.random() - 0.5) * 0.2)).normalize();
        U.uSS0.value.copy(a); U.uSS1.value.copy(b);
        p.value = 0;
        if (this.onShootingStar) this.onShootingStar();
      }
    },

    clockText() {
      const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
  };

  PB.Sky = Sky;
})();
