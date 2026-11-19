(function () {
  const PB = (window.PB = window.PB || {});
  const V = THREE.Vector3;

  const MODES = [
    { key: 'chase', name: '追尾' },
    { key: 'side', name: '侧拍' },
    { key: 'cine', name: '电影运镜' },
    { key: 'pov', name: '鹈鹕视角' },
    { key: 'drone', name: '航拍' }
  ];

  const CINE_SHOTS = [
    { dur: 7, from: [6, 1.2, -6], to: [3.2, 1.6, -3], look: [0, 1.4, 0], fov: [40, 55] },
    { dur: 6, from: [-1.6, 0.35, -2.4], to: [-1.9, 0.5, 1.6], look: [0, 0.9, 0], fov: [62, 62] },
    { dur: 8, from: [14, 7, 8], to: [9, 4, -10], look: [0, 1, -2], fov: [35, 45] },
    { dur: 6, from: [0.9, 2.3, -1.2], to: [0.7, 2.15, -0.9], look: [0, 1.85, 0.6], fov: [50, 46] },
    { dur: 7, from: [2.5, 0.6, 10], to: [1.2, 1.4, 4.2], look: [0, 1.2, -3], fov: [30, 45] },
    { dur: 7, orbit: true, r: 4.2, h: 1.5, look: [0, 1.3, 0], fov: [50, 50] }
  ];

  const Cams = {
    MODES,
    mode: 0,
    shot: 0,
    shotT: 0,
    init(camera) {
      this.cam = camera;
      this.pos = new V(0, 3, 7);
      this.look = new V(0, 1.4, -4);
      this.shake = 0;
      this.fov = 60;
      this.cineSeen = false;
    },
    set(i) {
      this.mode = ((i % MODES.length) + MODES.length) % MODES.length;
      this.snap = true;
      if (MODES[this.mode].key === 'cine') { this.shot = (Math.random() * CINE_SHOTS.length) | 0; this.shotT = 0; }
    },
    next() { this.set(this.mode + 1); },
    get name() { return MODES[this.mode].name; },
    get key() { return MODES[this.mode].key; },

    update(dt, s, P) {
      const cam = this.cam;
      const tgt = new V(), lk = new V();
      let fov = 60, lerp = 1 - Math.exp(-dt * 6), lerpL = 1 - Math.exp(-dt * 10);
      const k = this.key;
      const sp = s.speed;
      P.root.updateMatrixWorld();

      if (k === 'chase') {
        const back = 5.2 + sp * 0.08;
        tgt.set(s.x * 0.65, 2.3 + sp * 0.02 + s.y * 0.5, back);
        lk.set(s.x * 0.85, 1.35 + s.y * 0.7, -5);
        fov = 58 + sp * 0.7;
      } else if (k === 'side') {
        tgt.set(s.x - 6.5, 1.5 + s.y * 0.6, -1.4);
        lk.set(s.x, 1.2 + s.y * 0.8, -0.6);
        fov = 44;
      } else if (k === 'drone') {
        tgt.set(s.x * 0.5 + 6, 14, 9);
        lk.set(s.x * 0.8 + 1.5, 0, -8);
        fov = 48;
        lerp = 1 - Math.exp(-dt * 2.5);
      } else if (k === 'pov') {
        P.head.localToWorld(tgt.set(0, 0.09, -0.06));
        P.head.localToWorld(lk.set(0, -0.35, -4));
        lk.x += -s.steer * 0.6;
        fov = 78 + sp * 0.5;
        lerp = 1; lerpL = 1 - Math.exp(-dt * 25);
      } else if (k === 'cine') {
        this.shotT += dt;
        let sh = CINE_SHOTS[this.shot];
        if (this.shotT > sh.dur) {
          this.shot = (this.shot + 1 + ((Math.random() * (CINE_SHOTS.length - 1)) | 0)) % CINE_SHOTS.length;
          this.shotT = 0; this.snap = true; sh = CINE_SHOTS[this.shot];
        }
        const u = this.shotT / sh.dur;
        const e = u * u * (3 - 2 * u);
        if (sh.orbit) {
          const a = -0.6 + e * 2.4;
          tgt.set(s.x + Math.sin(a) * sh.r, sh.h + s.y * 0.6, Math.cos(a) * sh.r * -1);
        } else {
          tgt.set(...sh.from).lerp(new V(...sh.to), e);
          tgt.x += s.x; tgt.y += s.y * 0.6;
        }
        lk.set(...sh.look); lk.x += s.x; lk.y += s.y;
        fov = sh.fov[0] + (sh.fov[1] - sh.fov[0]) * e;
        lerp = 1 - Math.exp(-dt * 12); lerpL = 1 - Math.exp(-dt * 12);
      }

      if (this.snap) { this.pos.copy(tgt); this.look.copy(lk); this.fov = fov; this.snap = false; }
      else {
        this.pos.lerp(tgt, lerp); this.look.lerp(lk, lerpL);
        this.fov += (fov - this.fov) * Math.min(1, dt * 3);
      }

      this.shake = Math.max(0, this.shake - dt * 2.2);
      const sh = this.shake * this.shake;
      const jitter = (k !== 'drone' ? 1 : 0.3) * (sp > 12 ? (sp - 12) * 0.0012 : 0);
      const t = s.time;
      cam.position.copy(this.pos).add(new V(
        (Math.sin(t * 47) * 0.12 + Math.sin(t * 31) * 0.08) * sh + Math.sin(t * 23) * jitter,
        (Math.sin(t * 53) * 0.12) * sh + Math.sin(t * 29) * jitter,
        0));
      cam.lookAt(this.look);
      if (k === 'pov') cam.rotateZ(s.lean * 0.8);
      else if (k === 'chase') cam.rotateZ(s.lean * 0.25);
      const near = k === 'pov' ? 0.02 : 0.1;
      P.headCover.forEach((o) => (o.visible = k !== 'pov'));
      if (Math.abs(cam.fov - this.fov) > 0.01 || cam.near !== near) { cam.fov = this.fov; cam.near = near; cam.updateProjectionMatrix(); }
    },
    kick(a) { this.shake = Math.min(1, this.shake + a); }
  };

  PB.Cams = Cams;
})();
