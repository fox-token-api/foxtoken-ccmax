(function () {
const PK = window.PK;

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
PK.glowTex = glowTex;

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rnd(seed) { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

PK.createProps = function (scene, W) {
  const glow = glowTex();
  const items = [];
  const SPAN = 420;

  // Street lamps on the inland shoulder, arm over the road
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b5058, roughness: 0.6, metalness: 0.5 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  const poolMat = new THREE.MeshBasicMaterial({ map: glow, color: 0xffc77a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const haloMat = new THREE.SpriteMaterial({ map: glow, color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const LAMP_GAP = 35;
  for (let i = 0; i < SPAN / LAMP_GAP; i++) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6.2, 8), poleMat);
    pole.position.set(0, 3.1, 0); pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), poleMat);
    arm.rotation.z = Math.PI / 2; arm.position.set(-1.05, 6.15, 0); g.add(arm);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.32), poleMat);
    hood.position.set(-2.1, 6.1, 0); g.add(hood);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.24), headMat);
    head.position.set(-2.1, 6.02, 0); g.add(head);
    const halo = new THREE.Sprite(haloMat); halo.scale.set(3, 3, 1); halo.position.set(-2.1, 5.9, 0); g.add(halo);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat);
    pool.rotation.x = -Math.PI / 2; pool.position.set(-2.4, 0.03, 0); g.add(pool);
    g.position.set(5.5, 0, -i * LAMP_GAP);
    scene.add(g);
    items.push({ obj: g, gap: LAMP_GAP, count: Math.ceil(SPAN / LAMP_GAP) });
  }

  // Bollards along the sea wall
  const bollGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.8, 8);
  const bollMat = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.7 });
  const refMat = new THREE.MeshBasicMaterial({ color: 0xff6a3d });
  const BOLL_GAP = 7, BN = Math.ceil(SPAN / BOLL_GAP);
  const boll = new THREE.InstancedMesh(bollGeo, bollMat, BN);
  const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.12, 0.2), refMat, BN);
  boll.castShadow = true;
  scene.add(boll, refl);

  // Palms on the inland side
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a6248, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f6b33, roughness: 0.8, side: THREE.DoubleSide });
  function makePalm(seed) {
    const g = new THREE.Group();
    const h = 5 + rnd(seed) * 3.5, lean = (rnd(seed + 1) - 0.5) * 0.9;
    const pts = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(lean * t * t * h * 0.35, t * h, 0)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.17, 7), trunkMat);
    trunk.castShadow = true; g.add(trunk);
    const top = pts[6];
    const leafGeo = new THREE.PlaneGeometry(0.9, 3.6, 1, 6);
    leafGeo.translate(0, 1.8, 0);
    const pa = leafGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i), t = y / 3.6;
      pa.setX(i, pa.getX(i) * Math.sin(t * Math.PI) * 1.1);
      pa.setZ(i, -t * t * 1.6);
    }
    leafGeo.computeVertexNormals();
    const n = 7 + (rnd(seed + 2) * 3 | 0);
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(leafGeo, leafMat);
      l.position.copy(top);
      l.rotation.order = 'YXZ';
      l.rotation.y = i / n * Math.PI * 2 + rnd(seed + i);
      l.rotation.x = -1.0 - rnd(seed + i * 3) * 0.5;
      l.castShadow = true;
      g.add(l);
    }
    return g;
  }
  const PALM_GAP = 14;
  for (let i = 0; i < SPAN / PALM_GAP; i++) {
    const p = makePalm(i * 3.7);
    const x = 7.5 + rnd(i * 9.1) * 3;
    p.position.set(x, ss(5, 9, x) * 1.2 - 0.35, -i * PALM_GAP - rnd(i) * 6);
    p.rotation.y = rnd(i * 2.3) * 6.28;
    scene.add(p);
    items.push({ obj: p, gap: PALM_GAP, count: Math.ceil(SPAN / PALM_GAP), jitter: true });
  }

  // Beach umbrellas and driftwood fires on the sand
  const stripeTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 8;
    const g = c.getContext('2d');
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4efe4' : '#d9433a'; g.fillRect(i * 32, 0, 32, 8); }
    return new THREE.CanvasTexture(c);
  })();
  const umbMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.8, side: THREE.DoubleSide });
  const fireMat = new THREE.SpriteMaterial({ map: glow, color: 0xff7a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const fireCore = new THREE.SpriteMaterial({ map: glow, color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1f, roughness: 1 });
  const fires = [];
  const BEACH_GAP = 60;
  for (let i = 0; i < SPAN / BEACH_GAP; i++) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5), poleMat);
    stick.position.y = 1.1; stick.rotation.z = 0.12; g.add(stick);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 16, 1, true), umbMat);
    canopy.position.set(0.12, 2.15, 0); canopy.rotation.z = 0.12; canopy.castShadow = true; g.add(canopy);
    const fire = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 5), logMat);
      log.rotation.z = Math.PI / 2; log.rotation.y = k * 1.05; log.position.y = 0.06; fire.add(log);
    }
    const f1 = new THREE.Sprite(fireMat); f1.scale.set(2.6, 2.6, 1); f1.position.y = 0.5; fire.add(f1);
    const f2 = new THREE.Sprite(fireCore); f2.scale.set(0.9, 1.3, 1); f2.position.y = 0.35; fire.add(f2);
    fire.position.set(2.4, 0, 1.5); g.add(fire);
    fires.push(f1, f2);
    const bz = -i * BEACH_GAP - 20;
    g.position.set(PK.shoreX(bz) + 4.5, -0.64, bz);
    scene.add(g);
    items.push({ obj: g, gap: BEACH_GAP, count: Math.ceil(SPAN / BEACH_GAP), beach: true });
  }

  // Kilometre posts
  const kmPosts = [];
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160;
    const tex = new THREE.CanvasTexture(c);
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.62, 0.12), [poleMat, poleMat, poleMat, poleMat, new THREE.MeshBasicMaterial({ map: tex }), poleMat]);
    post.position.y = 0.55; post.rotation.y = 0; g.add(post);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), poleMat);
    leg.position.y = 0.15; g.add(leg);
    g.position.set(4.9, 0, 0);
    scene.add(g);
    kmPosts.push({ g, c, tex, km: -1 });
  }
  function drawKm(p, km) {
    const g = p.c.getContext('2d');
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 128, 160);
    g.fillStyle = '#1c6e5a'; g.fillRect(0, 0, 128, 44);
    g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('海岸 S1', 64, 32);
    g.fillStyle = '#1b1b1b'; g.font = 'bold 64px sans-serif'; g.fillText(String(km), 64, 118);
    g.font = '20px sans-serif'; g.fillText('km', 64, 148);
    p.tex.needsUpdate = true;
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const P = {};
  P.update = function (focusZ, dt, t) {
    const back = focusZ + 25;
    for (const it of items) {
      if (it.obj.position.z > back) {
        it.obj.position.z -= it.gap * it.count;
        if (it.beach) it.obj.position.x = PK.shoreX(it.obj.position.z) + 4.5 + Math.sin(it.obj.position.z) * 0.8;
      }
    }
    const base = Math.floor(focusZ / BOLL_GAP) * BOLL_GAP + 3 * BOLL_GAP;
    for (let i = 0; i < BN; i++) {
      v.set(-4.6, 0.4, base - i * BOLL_GAP); m4.compose(v, q, sc); boll.setMatrixAt(i, m4);
      v.set(-4.5, 0.62, base - i * BOLL_GAP); m4.compose(v, q, sc); refl.setMatrixAt(i, m4);
    }
    boll.instanceMatrix.needsUpdate = true; refl.instanceMatrix.needsUpdate = true;
    const n = W.night;
    poolMat.opacity = 0.55 * n; haloMat.opacity = 0.9 * n;
    headMat.color.setRGB(0.25 + 0.75 * n, 0.24 + 0.65 * n, 0.22 + 0.45 * n);
    refMat.color.setRGB(0.5 + 0.5 * n, 0.25 + 0.2 * n, 0.12);
    const fl = 0.75 + 0.25 * Math.sin(t * 13) * Math.sin(t * 7.3);
    fireMat.opacity = n * 0.75 * fl; fireCore.opacity = n * fl;
    const kmNow = Math.floor(-focusZ / 1000);
    for (let i = 0; i < kmPosts.length; i++) {
      const km = kmNow + i;
      const p = kmPosts[i];
      if (p.km !== km) { p.km = km; drawKm(p, km); }
      p.g.position.z = -km * 1000;
      p.g.visible = km > 0;
    }
  };
  return P;
};
})();
