(function () {
  const PB = (window.PB = window.PB || {});
  const LANES = PB.LANES;

  function fishMesh(gold) {
    const g = new THREE.Group();
    const mat = gold
      ? new THREE.MeshStandardMaterial({ color: 0xffc83a, emissive: 0x6a4200, metalness: 0.8, roughness: 0.25 })
      : new THREE.MeshStandardMaterial({ color: 0x8fb6cc, metalness: 0.6, roughness: 0.3 });
    const belly = new THREE.MeshStandardMaterial({ color: gold ? 0xfff0a0 : 0xe8f0f2, metalness: 0.4, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat);
    body.scale.set(0.55, 0.75, 1.6);
    const under = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), belly);
    under.scale.set(0.5, 0.55, 1.45); under.position.y = -0.04;
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 4), mat);
    tail.rotation.x = -Math.PI / 2; tail.scale.set(0.25, 1, 1.4);
    tail.position.z = 0.42;
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 3), mat);
    fin.position.set(0, 0.17, 0.02); fin.rotation.x = 0.5;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(0.09, 0.05, -0.22);
    const eye2 = eye.clone(); eye2.position.x = -0.09;
    const wings = [];
    for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.22),
        new THREE.MeshStandardMaterial({ color: gold ? 0xffe28a : 0xbfe0f0, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
      w.geometry.translate(0.25, 0, 0);
      w.rotation.x = -Math.PI / 2;
      w.scale.x = sx;
      w.position.set(sx * 0.08, 0.02, -0.05);
      w.visible = false;
      g.add(w); wings.push(w);
    }
    g.add(body, under, tail, fin, eye, eye2);
    g.userData.tail = tail;
    g.userData.wings = wings;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function crabMesh() {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xd9452b, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x8e2416, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), red);
    body.scale.set(1.3, 0.55, 1); body.position.y = 0.28;
    g.add(body);
    const legs = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.42, 5), dark);
        l.geometry.translate(0, -0.21, 0);
        l.position.set(sx * 0.3, 0.28, -0.14 + i * 0.14);
        l.rotation.z = sx * 1.0;
        g.add(l); legs.push(l);
      }
      const arm = new THREE.Group();
      const a1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 5), red);
      a1.rotation.x = Math.PI / 2 - 0.4; a1.position.set(0, 0.06, -0.12);
      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), red);
      claw.scale.set(0.8, 0.7, 1.2); claw.position.set(0, 0.14, -0.28);
      arm.add(a1, claw);
      arm.position.set(sx * 0.22, 0.32, -0.15);
      arm.userData.sx = sx;
      g.add(arm); legs.push(arm);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 4), dark);
      stalk.position.set(sx * 0.1, 0.48, -0.2);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      eye.position.set(sx * 0.1, 0.57, -0.2);
      g.add(stalk, eye);
    }
    g.userData.legs = legs;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  const Particles = {
    N: 500,
    init(scene) {
      const geo = new THREE.BufferGeometry();
      this.pos = new Float32Array(this.N * 3);
      this.col = new Float32Array(this.N * 3);
      this.size = new Float32Array(this.N);
      this.vel = new Float32Array(this.N * 3);
      this.life = new Float32Array(this.N);
      this.max = new Float32Array(this.N);
      this.grav = new Float32Array(this.N);
      this.base = new Float32Array(this.N);
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uScale: { value: 400 } },
        vertexShader: `
          attribute float size; attribute vec3 color; varying vec3 vC;
          uniform float uScale;
          void main() {
            vC = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = size * uScale / max(-mv.z, 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vC;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vC * a, a);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      this.mat = mat;
      this.points = new THREE.Points(geo, mat);
      this.points.frustumCulled = false;
      this.geo = geo;
      this.i = 0;
      scene.add(this.points);
    },
    emit(x, y, z, n, opt) {
      const c = new THREE.Color(opt.color || 0xffffff);
      for (let k = 0; k < n; k++) {
        const i = this.i; this.i = (this.i + 1) % this.N;
        const sp = opt.speed || 3;
        const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
        this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
        const dir = opt.dir || [0, 0, 0];
        this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp + dir[0];
        this.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * (opt.up || 1) + dir[1];
        this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp + dir[2];
        this.life[i] = this.max[i] = (opt.life || 0.8) * (0.6 + Math.random() * 0.6);
        this.grav[i] = opt.grav === undefined ? 9 : opt.grav;
        this.base[i] = (opt.size || 0.12) * (0.6 + Math.random() * 0.8);
        const v = 0.75 + Math.random() * 0.25;
        this.col[i * 3] = c.r * v; this.col[i * 3 + 1] = c.g * v; this.col[i * 3 + 2] = c.b * v;
      }
    },
    update(dt, dz) {
      for (let i = 0; i < this.N; i++) {
        if (this.life[i] <= 0) { this.size[i] = 0; continue; }
        this.life[i] -= dt;
        this.vel[i * 3 + 1] -= this.grav[i] * dt;
        this.pos[i * 3] += this.vel[i * 3] * dt;
        this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
        this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt + dz;
        const t = Math.max(0, this.life[i] / this.max[i]);
        this.size[i] = this.base[i] * Math.sqrt(t);
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  };

  const Spawn = {
    fish: [],
    crabs: [],
    nextFish: 30,
    nextCrab: 70,
    init(scene) {
      this.scene = scene;
      this.fishPool = [];
      this.goldPool = [];
      this.crabPool = [];
      Particles.init(scene);
      this.P = Particles;
    },
    take(pool, make) {
      const m = pool.pop() || make();
      m.visible = true;
      if (!m.parent) this.scene.add(m);
      return m;
    },
    free(pool, m) { m.visible = false; pool.push(m); },

    laneFree(s, lane, gap) {
      return !this.fish.some((f) => f.lane === lane && Math.abs(f.s - s) < gap) &&
             !this.crabs.some((c) => Math.abs(c.s - s) < gap);
    },

    spawnFish(dist, s) {
      const lane = (Math.random() * 3) | 0;
      if (!this.laneFree(s, lane, 5)) return;
      const gold = Math.random() < 0.06;
      const high = !gold && Math.random() < 0.22;
      const mesh = gold ? this.take(this.goldPool, () => fishMesh(true)) : this.take(this.fishPool, () => fishMesh(false));
      mesh.userData.wings.forEach((w) => (w.visible = high));
      const f = {
        s, lane, gold, high, mesh, state: 'wait',
        t: 0, x: 18 + Math.random() * 6, y: PB.SEA_Y, vy: 0, hop: Math.random() * 6,
        phase: Math.random() * 6
      };
      mesh.position.set(f.x, f.y, dist - s);
      this.fish.push(f);
    },

    spawnCrab(dist, s) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const mesh = this.take(this.crabPool, crabMesh);
      const c = {
        s, mesh, dir, x: dir > 0 ? -4.2 : 4.2, speed: 0.9 + Math.random() * 0.7,
        phase: Math.random() * 6, jumped: false, hit: false
      };
      if (!this.laneFree(s, -1, 6)) { this.free(this.crabPool, mesh); return; }
      const startLane = (Math.random() * 3) | 0;
      c.x = LANES[startLane] - dir * c.speed * 3.2;
      mesh.position.set(c.x, 0, dist - s);
      mesh.rotation.y = 0;
      this.crabs.push(c);
    },

    reset() {
      this.fish.forEach((f) => this.free(f.gold ? this.goldPool : this.fishPool, f.mesh));
      this.crabs.forEach((c) => this.free(this.crabPool, c.mesh));
      this.fish = []; this.crabs = [];
    },

    update(dt, dist, dz, time, P1, cb) {
      while (this.nextFish < dist + 95) {
        this.spawnFish(dist, this.nextFish);
        this.nextFish += 9 + Math.random() * 13;
      }
      while (this.nextCrab < dist + 95) {
        this.spawnCrab(dist, this.nextCrab);
        this.nextCrab += 28 + Math.random() * 40;
      }

      const mouth = P1.mouth;
      for (let i = this.fish.length - 1; i >= 0; i--) {
        const f = this.fish[i];
        const z = dist - f.s;
        const lx = LANES[f.lane];
        const m = f.mesh;
        f.t += dt;
        if (f.state === 'wait' && z > -58) {
          f.state = 'leap'; f.t = 0;
          f.x0 = f.x; f.dur = 1.1;
          Particles.emit(f.x, PB.SEA_Y + 0.1, z, 18, { color: 0xcfefff, speed: 2.5, up: 2, life: 0.9, size: 0.18 });
          if (cb.splash) cb.splash(f);
        }
        if (f.state === 'wait') {
          m.visible = false;
        } else if (f.state === 'leap') {
          m.visible = true;
          const u = Math.min(1, f.t / f.dur);
          const endY = f.high ? 3.6 : 0.9;
          f.x = f.x0 + (lx - f.x0) * u;
          f.y = PB.SEA_Y + (endY - PB.SEA_Y) * u + Math.sin(u * Math.PI) * 4.2;
          m.rotation.set(-Math.cos(u * Math.PI) * 1.1, Math.PI / 2 + 0.3, 0);
          m.rotation.z = u * Math.PI * 2;
          if (u >= 1) { f.state = f.high ? 'glide' : 'flop'; f.vy = 2; f.t = 0; }
        } else if (f.state === 'flop') {
          f.vy -= 16 * dt;
          f.y += f.vy * dt;
          if (f.y < 0.18) { f.y = 0.18; f.vy = 3.2 + Math.random() * 2.6; m.userData.flip = (Math.random() - 0.5) * 6; }
          f.x = lx + Math.sin(time * 3 + f.phase) * 0.15;
          m.rotation.set(0, Math.sin(time * 4 + f.phase) * 0.8, Math.sin(time * 14 + f.phase) * 0.5 + (m.userData.flip || 0) * (f.y - 0.18) * 0.3);
        } else if (f.state === 'glide') {
          f.y = 3.6 + Math.sin(time * 2.2 + f.phase) * 0.18;
          f.x = lx + Math.sin(time * 1.3 + f.phase) * 0.2;
          m.rotation.set(Math.sin(time * 2.2 + f.phase) * 0.15, 0, Math.sin(time * 1.3 + f.phase) * 0.2);
          m.userData.wings.forEach((w, k) => (w.rotation.y = (k ? 1 : -1) * Math.sin(time * 18) * 0.35));
        }
        m.userData.tail.rotation.y = Math.sin(time * 16 + f.phase) * 0.5;
        if (f.gold && m.visible && Math.random() < dt * 14) {
          Particles.emit(f.x, f.y, z, 1, { color: 0xffd75e, speed: 0.6, life: 0.6, grav: -1, size: 0.12 });
        }
        m.position.set(f.x, f.y, z);

        if (f.state !== 'wait' && f.state !== 'leap' || (f.state === 'leap' && f.t > f.dur * 0.6)) {
          const dx = Math.abs(f.x - mouth.x), dyy = f.y - mouth.y, dzz = Math.abs(z - mouth.z);
          if (dzz < 1.1 && dx < 1.05 && dyy > -1.9 && dyy < 1.1) {
            Particles.emit(f.x, f.y, z, f.gold ? 40 : 16, {
              color: f.gold ? 0xffd75e : 0xbff3ff, speed: f.gold ? 4 : 2.6, life: 0.8, size: f.gold ? 0.2 : 0.14, grav: 3
            });
            cb.caught(f, z);
            this.free(f.gold ? this.goldPool : this.fishPool, m);
            this.fish.splice(i, 1);
            continue;
          }
        }
        if (z > 14) {
          if (f.state !== 'wait' && cb.missed) cb.missed(f);
          this.free(f.gold ? this.goldPool : this.fishPool, m);
          this.fish.splice(i, 1);
        }
      }

      for (let i = this.crabs.length - 1; i >= 0; i--) {
        const c = this.crabs[i];
        const z = dist - c.s;
        const m = c.mesh;
        if (!c.hit) {
          c.x += c.dir * c.speed * dt;
          if (c.x > 4.1 || c.x < -4.1) c.dir *= -1;
        } else {
          c.vy -= 16 * dt; c.y += c.vy * dt; c.x += c.vx * dt;
          m.rotation.x += dt * 9;
          if (c.y < -3) c.y = -3;
        }
        m.position.set(c.x, c.hit ? c.y : 0, z);
        c.mesh.userData.legs.forEach((l, k) => {
          if (l.userData.sx) l.rotation.x = Math.sin(time * 6 + k) * 0.35;
          else l.rotation.x = Math.sin(time * 20 + k * 1.7 + c.phase) * 0.4;
        });
        if (!c.hit && !c.jumped && Math.abs(z) < 0.9 && Math.abs(c.x - P1.x) < 0.95) {
          if (P1.y > 0.35) { c.jumped = true; cb.jumped(c); }
          else {
            c.hit = true; c.vy = 6; c.y = 0; c.vx = (c.x > P1.x ? 1 : -1) * 4;
            Particles.emit(c.x, 0.4, z, 14, { color: 0xffa070, speed: 3, life: 0.6, size: 0.14 });
            cb.hit(c);
          }
        }
        if (z > 14) {
          this.free(this.crabPool, m);
          this.crabs.splice(i, 1);
        }
      }

      Particles.update(dt, dz);
    },

    nearestTargets(dist) {
      return {
        fish: this.fish.filter((f) => f.s > dist + 2 && f.state !== 'wait' || (f.state === 'wait' && f.s - dist < 60))
          .sort((a, b) => a.s - b.s),
        crabs: this.crabs.filter((c) => !c.hit && c.s > dist - 0.5).sort((a, b) => a.s - b.s)
      };
    }
  };

  PB.Spawn = Spawn;
  PB.Particles = Particles;
})();
