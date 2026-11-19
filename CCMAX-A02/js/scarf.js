(function () {
  const PB = (window.PB = window.PB || {});
  const V = THREE.Vector3;

  const Scarf = {
    init(scene, quality) {
      this.scene = scene;
      this.build(quality > 0 ? { W: 4, H: 16, ring: 12 } : { W: 3, H: 10, ring: 8 });
    },

    build(cfg) {
      if (this.mesh) { this.scene.remove(this.mesh, this.knot, this.tail2); }
      const W = cfg.W, H = cfg.H;
      this.W = W; this.H = H;
      this.seg = 0.07;
      this.width = 0.16;
      this.p = []; this.o = [];
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const v = new V((i / (W - 1) - 0.5) * this.width, 1.7 - j * this.seg, 0.2 + j * 0.02);
        this.p.push(v.clone()); this.o.push(v.clone());
      }
      this.cons = [];
      const idx = (i, j) => j * W + i;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        if (i < W - 1) this.cons.push([idx(i, j), idx(i + 1, j), this.width / (W - 1), 1]);
        if (j < H - 1) this.cons.push([idx(i, j), idx(i, j + 1), this.seg, 1]);
        if (i < W - 1 && j < H - 1) {
          const d = Math.hypot(this.width / (W - 1), this.seg);
          this.cons.push([idx(i, j), idx(i + 1, j + 1), d, 0.5]);
          this.cons.push([idx(i + 1, j), idx(i, j + 1), d, 0.5]);
        }
        if (j < H - 2) this.cons.push([idx(i, j), idx(i, j + 2), this.seg * 2, 0.3]);
      }

      const geo = new THREE.BufferGeometry();
      this.pos = new Float32Array(W * H * 3);
      const uv = new Float32Array(W * H * 2);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        uv[(j * W + i) * 2] = i / (W - 1); uv[(j * W + i) * 2 + 1] = j / (H - 1);
      }
      const ix = [];
      for (let j = 0; j < H - 1; j++) for (let i = 0; i < W - 1; i++) {
        const a = idx(i, j), b = idx(i + 1, j), c = idx(i, j + 1), d = idx(i + 1, j + 1);
        ix.push(a, c, b, b, c, d);
      }
      geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(ix);
      this.geo = geo;

      const c = document.createElement('canvas'); c.width = 64; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#d42a1f'; g.fillRect(0, 0, 64, 256);
      for (let y = 0; y < 256; y += 4) { g.fillStyle = `rgba(0,0,0,${0.06 + (y % 8 ? 0 : 0.05)})`; g.fillRect(0, y, 64, 2); }
      g.fillStyle = '#f5e8d0';
      [196, 212].forEach((y) => g.fillRect(0, y, 64, 6));
      g.fillStyle = '#b81d14';
      for (let x = 2; x < 64; x += 8) g.fillRect(x, 238, 4, 18);
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
      this.mesh = new THREE.Mesh(geo, mat);
      this.mesh.castShadow = true;
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.05, 8, cfg.ring), mat);
      ring.rotation.x = Math.PI / 2 - 0.2;
      ring.scale.set(1, 1.1, 0.8);
      ring.castShadow = true;
      this.knot = ring;
      this.scene.add(ring);
      const tail2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat);
      tail2.castShadow = true;
      this.tail2 = tail2;
      this.scene.add(tail2);
      this.inited = false;
    },

    setQuality(q) {
      const want = q > 0 ? 16 : 10;
      if (want !== this.H) this.build(q > 0 ? { W: 4, H: 16, ring: 12 } : { W: 3, H: 10, ring: 8 });
    },

    update(dt, anchor, frame, speed, time, groundY, bodyC) {
      const W = this.W, H = this.H;
      const fwd = frame.fwd, right = frame.right, up = frame.up;
      if (!this.inited) {
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const k = j * W + i;
          this.p[k].copy(anchor).addScaledVector(right, (i / (W - 1) - 0.5) * this.width).addScaledVector(fwd, -j * this.seg);
          this.o[k].copy(this.p[k]);
        }
        this.inited = true;
      }

      const steps = 3;
      const h = Math.min(dt, 1 / 30) / steps;
      const wind = new V().copy(fwd).multiplyScalar(-speed);
      const gust = 1 + 0.35 * Math.sin(time * 3.1) * Math.sin(time * 1.7 + 0.4);
      const g = new V(0, -9.8, 0);
      const tmp = new V(), nrm = new V(), a = new V(), b = new V(), rel = new V();

      for (let s = 0; s < steps; s++) {
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
          const k = j * W + i;
          const p = this.p[k], o = this.o[k];
          if (j === 0) continue;
          const vel = tmp.subVectors(p, o);
          const i0 = Math.max(0, i - 1), i1 = Math.min(W - 1, i + 1);
          const j0 = Math.max(0, j - 1), j1 = Math.min(H - 1, j + 1);
          a.subVectors(this.p[j * W + i1], this.p[j * W + i0]);
          b.subVectors(this.p[j1 * W + i], this.p[j0 * W + i]);
          nrm.crossVectors(a, b).normalize();
          rel.copy(wind).multiplyScalar(gust).sub(vel.clone().divideScalar(h));
          const flutter = Math.sin(time * 23 + j * 0.9 + i * 0.6) * 0.5 + Math.sin(time * 37 + j * 1.7) * 0.3;
          rel.addScaledVector(up, flutter * Math.min(1, speed / 10) * 2.5);
          rel.addScaledVector(right, Math.cos(time * 19 + j * 1.1) * Math.min(1, speed / 10) * 1.2);
          const fn = nrm.dot(rel);
          const drag = 0.9;
          const acc = new V().copy(g).addScaledVector(nrm, fn * drag).addScaledVector(rel, 0.25);
          const damp = 0.985;
          const np = new V().copy(p).addScaledVector(vel, damp).addScaledVector(acc, h * h);
          o.copy(p); p.copy(np);
        }

        for (let it = 0; it < 4; it++) {
          for (const [ia, ib, rest, stiff] of this.cons) {
            const pa = this.p[ia], pb = this.p[ib];
            tmp.subVectors(pb, pa);
            const d = tmp.length() || 1e-6;
            const diff = ((d - rest) / d) * 0.5 * stiff;
            const fa = ia < W ? 0 : 1, fb = ib < W ? 0 : 1;
            const tot = fa + fb;
            if (!tot) continue;
            tmp.multiplyScalar(diff * 2 / tot);
            if (fa) pa.add(tmp);
            if (fb) pb.sub(tmp);
          }
          for (let i = 0; i < W; i++) {
            this.p[i].copy(anchor).addScaledVector(right, (i / (W - 1) - 0.5) * this.width).addScaledVector(fwd, 0.04);
          }
          for (let k = W; k < W * H; k++) {
            const p = this.p[k];
            if (p.y < groundY + 0.02) p.y = groundY + 0.02;
            if (bodyC) {
              rel.subVectors(p, bodyC.c);
              rel.y *= 1.25;
              const d = rel.length();
              if (d < bodyC.r) {
                rel.normalize();
                p.addScaledVector(rel, bodyC.r - d);
              }
            }
          }
        }
      }

      for (let k = 0; k < W * H; k++) {
        this.pos[k * 3] = this.p[k].x; this.pos[k * 3 + 1] = this.p[k].y; this.pos[k * 3 + 2] = this.p[k].z;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.computeVertexNormals();
      this.geo.computeBoundingSphere();

      this.knot.position.copy(anchor).addScaledVector(up, -0.02);
      this.knot.quaternion.copy(frame.q);
      this.knot.rotateX(Math.PI / 2 - 0.25);
      const last = this.p[(H - 1) * W + 1];
      this.tail2.position.copy(anchor).addScaledVector(fwd, -0.02).addScaledVector(right, 0.07).addScaledVector(up, -0.09);
      this.tipPos = last;
    }
  };

  PB.Scarf = Scarf;
})();
