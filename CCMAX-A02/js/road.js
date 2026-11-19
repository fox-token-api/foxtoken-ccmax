(function () {
  const PB = (window.PB = window.PB || {});

  const LANES = [-2.2, 0, 2.2];
  PB.LANES = LANES;

  function asphaltTex() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#3a3c42'; g.fillRect(0, 0, 256, 512);
    const img = g.getImageData(0, 0, 256, 512);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(20,20,24,${Math.random() * 0.25})`;
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 512, 6 + Math.random() * 20, 10 + Math.random() * 40, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#e9e3cf';
    g.fillRect(6, 0, 7, 512); g.fillRect(243, 0, 7, 512);
    g.fillStyle = '#efe9d6';
    const lx = (x) => 128 + (x / 8.6) * 256;
    [lx(-1.1), lx(1.1)].forEach((x) => g.fillRect(x - 2.5, 0, 5, 300));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const TILE = 12;
  const SPAN = 480;

  const Road = {
    items: [],
    lampLights: [],
    init(scene, quality) {
      this.scene = scene;
      const tex = asphaltTex();
      tex.repeat.set(1, 640 / TILE);
      this.tex = tex;
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(8.6, 640),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0 })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0, -260);
      road.receiveShadow = true;
      scene.add(road);

      const curbMat = new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: 0.9 });
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 640), curbMat);
      curb.position.set(4.55, 0.02, -260); curb.receiveShadow = true;
      scene.add(curb);
      const curbL = curb.clone(); curbL.position.x = -4.55; scene.add(curbL);

      const grassTex = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = '#4a5a2c'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1400; i++) {
          g.fillStyle = `hsl(${70 + Math.random() * 30},${30 + Math.random() * 25}%,${18 + Math.random() * 22}%)`;
          g.fillRect(Math.random() * w, Math.random() * h, 1.5, 3 + Math.random() * 3);
        }
      });
      grassTex.repeat.set(4, 640 / 6);
      this.grassTex = grassTex;
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(26, 640), new THREE.MeshLambertMaterial({ map: grassTex }));
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(-17.8, 0.01, -260);
      grass.receiveShadow = true;
      scene.add(grass);

      this.buildHills(scene);
      this.buildRail(scene);
      this.buildDecor(scene, quality);
      this.buildHeadlands(scene);
    },

    buildHills(scene) {
      const geo = new THREE.PlaneGeometry(260, 700, 40, 90);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      const colors = new Float32Array(p.count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < p.count; i++) {
        const d = 130 - p.getX(i);
        const z = p.getZ(i);
        const k = (n) => (Math.PI * 2 * n) / 700;
        let y = 0;
        if (d > 6) {
          const r = d - 6;
          y = Math.pow(r, 1.1) * 0.3 + Math.sin(z * k(3)) * r * 0.12 + Math.sin(z * k(1) + 1) * r * 0.15 + Math.sin(z * k(12) + d * 0.2) * 1.2;
        }
        p.setY(i, Math.max(0, y));
        const tt = Math.min(1, y / 60);
        const hn = Math.sin(i * 12.9898) * 43758.5453;
        c.setHSL(0.22 - tt * 0.08, 0.32 - tt * 0.1, 0.2 + tt * 0.08 + (hn - Math.floor(hn)) * 0.03);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const hills = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
      hills.position.set(-160, 0, -230);
      this.hills = hills;
      this.hillLen = 700;
      scene.add(hills);
      const h2 = hills.clone();
      h2.position.z = hills.position.z - 700;
      this.hills2 = h2;
      scene.add(h2);
    },

    buildRail(scene) {
      const postGeo = new THREE.BoxGeometry(0.12, 0.7, 0.12);
      const mat = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 0.6, roughness: 0.4 });
      const N = 60, spacing = 4;
      const posts = new THREE.InstancedMesh(postGeo, mat, N);
      posts.castShadow = true;
      this.posts = posts; this.postN = N; this.postSpacing = spacing;
      scene.add(posts);
      const beamGeo = new THREE.BoxGeometry(0.06, 0.26, N * spacing);
      const beam = new THREE.Mesh(beamGeo, mat);
      beam.position.set(4.8, 0.6, -N * spacing / 2 + 20);
      beam.castShadow = true;
      scene.add(beam);
      const refl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, N * spacing),
        new THREE.MeshBasicMaterial({ color: 0xff7a2a }));
      refl.position.set(4.76, 0.62, beam.position.z);
      scene.add(refl);
      this.reflStrip = refl;
    },

    buildDecor(scene, quality) {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3338, metalness: 0.5, roughness: 0.5 });
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      this.bulbMat = bulbMat;
      const glowTex = canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,220,160,1)'); gr.addColorStop(0.3, 'rgba(255,190,110,0.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
      this.glowMat = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 });
      const poolTex = canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,200,130,0.55)'); gr.addColorStop(1, 'rgba(255,190,120,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
      this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 });

      const lampSpacing = 40;
      for (let i = 0; i < SPAN / lampSpacing; i++) {
        const g = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 6, 8), poleMat);
        pole.position.y = 3; pole.castShadow = true;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.1), poleMat);
        arm.position.set(-0.75, 5.95, 0);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.26), poleMat);
        head.position.set(-1.5, 5.9, 0);
        const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.2), bulbMat);
        bulb.position.set(-1.5, 5.82, 0);
        const glow = new THREE.Sprite(this.glowMat);
        glow.position.set(-1.5, 5.7, 0); glow.scale.set(3, 3, 1);
        const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), this.poolMat);
        pool.rotation.x = -Math.PI / 2; pool.position.set(-1.8, 0.03, 0);
        g.add(pole, arm, head, bulb, glow, pool);
        g.position.x = 5.3;
        this.addItem(g, i * lampSpacing + 10, SPAN);
        g.userData.lamp = true;
      }

      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6e5236 });
      const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6a35, side: THREE.DoubleSide });
      const leafGeo = new THREE.PlaneGeometry(0.7, 3.2, 1, 4);
      const lp = leafGeo.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const y = lp.getY(i) + 1.6;
        lp.setY(i, y); lp.setZ(i, -Math.pow(y / 3.2, 2) * 1.3);
        lp.setX(i, lp.getX(i) * Math.sin((y / 3.2) * Math.PI) * 1.2);
      }
      leafGeo.computeVertexNormals();
      const nPalm = quality > 0 ? 26 : 14;
      for (let i = 0; i < nPalm; i++) {
        const g = new THREE.Group();
        const h = 5 + Math.random() * 3;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, h * 0.4, 0),
          new THREE.Vector3(0.9 + Math.random() * 0.5, h * 0.8, 0.1), new THREE.Vector3(1.4, h, 0.2)
        ]);
        const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.16, 6), trunkMat);
        trunk.castShadow = true;
        g.add(trunk);
        const top = curve.getPoint(1);
        for (let k = 0; k < 8; k++) {
          const leaf = new THREE.Mesh(leafGeo, leafMat);
          leaf.position.copy(top);
          leaf.rotation.order = 'YXZ';
          leaf.rotation.y = (k / 8) * Math.PI * 2 + Math.random() * 0.3;
          leaf.rotation.x = -0.9 + Math.random() * 0.3;
          leaf.castShadow = true;
          g.add(leaf);
        }
        g.rotation.y = Math.random() * Math.PI * 2;
        const left = i % 3 !== 0;
        g.position.x = left ? -6 - Math.random() * 7 : 7.5 + Math.random() * 4;
        g.userData.sway = Math.random() * 6;
        this.addItem(g, (i / nPalm) * SPAN + Math.random() * 10, SPAN);
      }

      const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 1, flatShading: true });
      for (let i = 0; i < 18; i++) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 1.6, 0), rockMat);
        r.scale.set(1, 0.6 + Math.random() * 0.5, 1.3);
        r.rotation.set(Math.random(), Math.random() * 6, Math.random());
        r.position.set(10 + Math.random() * 10, -1.2, 0);
        r.castShadow = false;
        this.addItem(r, Math.random() * SPAN, SPAN);
      }

      const signMat = new THREE.MeshBasicMaterial({
        map: canvasTex(256, 128, (g, w, h) => {
          g.fillStyle = '#1d6b45'; g.fillRect(0, 0, w, h);
          g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
          g.fillStyle = '#fff'; g.font = 'bold 40px "Microsoft YaHei", sans-serif'; g.textAlign = 'center';
          g.fillText('海岸公路', w / 2, 62);
          g.font = 'bold 26px sans-serif'; g.fillText('🐟 鹈鹕湾 →', w / 2, 102);
        })
      });
      for (let i = 0; i < 2; i++) {
        const g = new THREE.Group();
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), poleMat);
        p1.position.set(-0.8, 1.5, 0);
        const p2 = p1.clone(); p2.position.x = 0.8;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), signMat);
        board.position.set(0, 2.8, 0.05);
        g.add(p1, p2, board);
        g.position.x = -6.2;
        this.addItem(g, 120 + i * 240, SPAN);
      }

      for (let i = 0; i < 3; i++) {
        this.lampLights.push(new THREE.PointLight(0xffc888, 0, 14, 2));
        scene.add(this.lampLights[i]);
      }
    },

    buildHeadlands(scene) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x1b2438, fog: false });
      this.headMat = mat;
      const shape = new THREE.Shape();
      shape.moveTo(-180, 0);
      for (let i = 0; i <= 30; i++) {
        const x = -180 + i * 12;
        const y = 18 + Math.sin(i * 0.7) * 6 + Math.sin(i * 1.9) * 3 + (i > 18 ? (30 - i) * 1.5 : 0) + Math.random() * 3;
        shape.lineTo(x, y);
      }
      shape.lineTo(180, 0);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
      m.position.set(220, -1.5, -760);
      m.rotation.y = -0.35;
      scene.add(m);
      const m2 = m.clone(); m2.scale.set(0.7, 0.6, 1); m2.position.set(480, -1.5, -520); m2.rotation.y = -1.1;
      scene.add(m2);

      const lh = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 16, 10), new THREE.MeshBasicMaterial({ color: 0x2a3348, fog: false }));
      tower.position.y = 8;
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c8, fog: false }));
      lamp.position.y = 17;
      const beamGeo = new THREE.ConeGeometry(9, 150, 16, 1, true);
      beamGeo.translate(0, -75, 0);
      beamGeo.rotateZ(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xfff0c0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, fog: false
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 17;
      lh.add(tower, lamp, beam);
      lh.position.set(170, 22, -690);
      scene.add(lh);
      this.beam = beam; this.beamMat = beamMat; this.lhLamp = lamp;
    },

    addItem(obj, s, span) {
      obj.userData.s = s;
      obj.userData.span = span;
      this.scene.add(obj);
      this.items.push(obj);
    },

    update(dt, dist, night, time, ambColor) {
      this.tex.offset.y = (dist / TILE) % 1;
      this.grassTex.offset.y = (dist / 6) % 1;
      const hz = -230 + (dist % this.hillLen);
      this.hills.position.z = hz;
      this.hills2.position.z = hz - this.hillLen;

      const ps = this.postSpacing, m = new THREE.Matrix4();
      const off = dist % ps;
      for (let i = 0; i < this.postN; i++) {
        m.makeTranslation(4.8, 0.35, 20 - i * ps + off);
        this.posts.setMatrixAt(i, m);
      }
      this.posts.instanceMatrix.needsUpdate = true;

      const lampOn = Math.min(1, Math.max(0, night * 1.6 - 0.1));
      this.glowMat.opacity = lampOn;
      this.poolMat.opacity = lampOn * 0.9;
      this.bulbMat.color.setRGB(0.25 + lampOn * 0.75, 0.24 + lampOn * 0.6, 0.22 + lampOn * 0.4);

      const lamps = [];
      for (const it of this.items) {
        const u = it.userData;
        let z = dist - u.s;
        while (z > 30) { u.s += u.span; z -= u.span; }
        while (z < 30 - u.span) { u.s -= u.span; z += u.span; }
        it.position.z = z;
        if (u.sway !== undefined) it.rotation.z = Math.sin(time * 0.9 + u.sway) * 0.03;
        if (u.lamp && z < 25 && z > -60) lamps.push(it);
      }
      lamps.sort((a, b) => Math.abs(a.position.z + 8) - Math.abs(b.position.z + 8));
      this.lampLights.forEach((L, i) => {
        const lp = lamps[i];
        if (lp && lampOn > 0) {
          L.position.set(lp.position.x - 1.5, 5.4, lp.position.z);
          L.intensity = lampOn * 1.6;
        } else L.intensity = 0;
      });

      this.beamMat.opacity = 0.12 * night;
      this.beam.rotation.y = time * 0.7;
      this.lhLamp.material.color.setRGB(0.4 + night * 0.6, 0.38 + night * 0.56, 0.32 + night * 0.46);
      this.headMat.color.copy(ambColor).multiplyScalar(0.35).lerp(new THREE.Color(0x05070d), night * 0.6);
    }
  };

  PB.Road = Road;
})();
