window.PG = window.PG || {};

PG.Cam = (function () {
  const names = ['追尾镜头', '侧拍镜头', '航拍镜头', '电影运镜', '鹈鹕视角'];
  let cam, pel, lb, pov;
  const pos = new THREE.Vector3(0, 2.2, 5), look = new THREE.Vector3(0, 1, -4);
  const tp = new THREE.Vector3(), tl = new THREE.Vector3(), b = new THREE.Vector3(), eye = new THREE.Vector3();
  let fov = 62, mode = 0, blend = 1, shot = 0, shotT = 0;
  const SHOT_LEN = 6.5;

  const shots = [
    (t) => { const a = 0.6 + t * 1.7; tp.set(b.x + Math.sin(a) * 3.6, 1.3 + t * 0.4, Math.cos(a) * 3.6); tl.set(b.x, b.y + 1.1, 0); return 46; },
    (t) => { tp.set(b.x + 0.7, 0.9 + t * 0.4, -6.5 + t * 3.2); tl.set(b.x, b.y + 1.15, 0.2); return 40; },
    (t) => { tp.set(b.x - 7.5, 0.6 + t * 5.5, 2.5 - t * 5); tl.set(b.x, b.y + 1, -1.5); return 50; },
    (t) => { tp.set(b.x + 0.85, 0.24, 0.5 - t * 1.6); tl.set(b.x, b.y + 0.55, -2.5); return 70; },
    (t) => { tp.set(b.x - 22 + t * 8, 15 + t * 4, 16 - t * 9); tl.set(b.x - 5, 0, -14); return 55; },
    (t) => { tp.set(b.x + 15, 1.4, -1.5 + t * 1.5); tl.set(b.x, b.y + 1.05, 0); return 17; },
  ];

  function create(camera, pelican) {
    cam = camera; pel = pelican;
    lb = document.createElement('div');
    lb.style.cssText = 'position:fixed;inset:0;pointer-events:none;transition:opacity .6s;opacity:0;background:linear-gradient(#000 0,#000 9%,transparent 9%,transparent 91%,#000 91%)';
    pov = document.createElement('div');
    pov.style.cssText = 'position:fixed;inset:0;pointer-events:none;transition:opacity .4s;opacity:0;background:radial-gradient(ellipse 120% 95% at 50% 45%,rgba(60,30,0,0) 55%,rgba(10,6,2,.65) 100%),rgba(70,40,10,.14)';
    document.body.insertBefore(pov, document.getElementById('hud'));
    document.body.insertBefore(lb, document.getElementById('hud'));
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m; blend = 0;
    if (m === 3) { shot = Math.floor(Math.random() * shots.length); shotT = 0; }
    const inPov = m === 4;
    for (const c of pel.head.children) c.visible = inPov ? c === pel.beakG : true;
    lb.style.opacity = m === 3 ? 1 : 0;
    pov.style.opacity = inPov ? 1 : 0;
  }

  function update(dt, s) {
    b.copy(pel.root.position);
    let tf = 62, snap = false, k = 1 - Math.exp(-dt * 5);
    if (mode === 0) {
      tp.set(b.x * 0.75, 2.05 + b.y * 0.5, 4.4 + s.speed * 0.04);
      tl.set(b.x * 0.9, 1.05 + b.y * 0.6, -5);
      tf = 60 + s.speed * 0.7;
      tp.x += Math.sin(s.time * 13) * s.speed * 0.0012;
      tp.y += Math.sin(s.time * 17) * s.speed * 0.001;
    } else if (mode === 1) {
      tp.set(-5.8 + b.x * 0.2, 2.0, -0.6);
      tl.set(b.x, 0.9 + b.y * 0.7, -0.9);
      tf = 50 - b.x * 2;
      k = 1 - Math.exp(-dt * 3);
    } else if (mode === 2) {
      tp.set(b.x - 3.5 + Math.sin(s.time * 0.2) * 2, 9 + Math.sin(s.time * 0.13), 7.5);
      tl.set(b.x - 1, 0.5, -6);
      tf = 55;
      k = 1 - Math.exp(-dt * 2);
    } else if (mode === 3) {
      shotT += dt / SHOT_LEN;
      if (shotT >= 1) { shotT = 0; shot = (shot + 1 + Math.floor(Math.random() * (shots.length - 1))) % shots.length; snap = true; }
      tf = shots[shot](shotT);
      if (blend >= 1) snap = true;
    } else {
      pel.eye(eye);
      tp.copy(eye);
      tl.set(eye.x + Math.sin(-s.headYaw) * 4 + s.lean * -2, eye.y - 0.3, eye.z - 4);
      tf = 78 + s.speed * 0.6;
      snap = true;
    }
    blend = Math.min(1, blend + dt * 1.6);
    if (blend < 1 && mode !== 4) k = Math.max(k, blend * blend * 0.35);
    if (snap && blend >= 1) { pos.copy(tp); look.copy(tl); fov = tf; }
    else if (mode === 4) { pos.lerp(tp, Math.max(blend, 0.25)); look.lerp(tl, Math.max(blend, 0.25)); fov += (tf - fov) * 0.3; }
    else { pos.lerp(tp, k); look.lerp(tl, k); fov += (tf - fov) * k; }
    cam.position.copy(pos);
    cam.up.set(mode === 4 ? -Math.sin(s.lean) * 0.6 : 0, 1, 0).normalize();
    cam.lookAt(look);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
  }

  return { names, create, update, setMode, get mode() { return mode; } };
})();
