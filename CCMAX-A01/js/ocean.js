(function () {
  const PK = window.PK;
  const U = PK.U;
  const SHORE = -13.4;
  PK.SHORE = SHORE;

  const WAVES = `
  uniform float uTime, uDist;
  float wh(vec2 p){
    float d=${SHORE.toFixed(2)}-p.x; vec2 q=vec2(p.x,p.y-uDist);
    float a=.5+1.*exp(-pow((d-7.)/6.,2.));
    float att=smoothstep(-6.,3.,d);
    float s1=sin(dot(q,vec2(.16,.03))-uTime*1.05);
    float big=.42*(s1>0.?pow(s1,1.6):s1*.8);
    big+=.22*sin(dot(q,vec2(.21,-.09))-uTime*1.3+1.7);
    float h=big*a;
    h+=.12*sin(dot(q,vec2(.05,.33))-uTime*1.7+.4);
    h+=.07*sin(dot(q,vec2(-.35,.42))-uTime*2.3+2.1);
    h+=.04*sin(dot(q,vec2(.62,.51))-uTime*3.1);
    h+=.025*sin(dot(q,vec2(-.8,-.9))-uTime*3.9);
    return h*att;
  }`;

  const vert = `
  ${WAVES}
  varying vec3 vW; varying vec3 vN; varying float vH;
  void main(){
    vec4 w=modelMatrix*vec4(position,1.);
    float e=.35;
    float h=wh(w.xz), hx=wh(w.xz+vec2(e,0.)), hz=wh(w.xz+vec2(0.,e));
    w.y+=h; vH=h;
    vN=normalize(vec3(h-hx,e,h-hz));
    vW=w.xyz;
    gl_Position=projectionMatrix*viewMatrix*w;
  }`;

  const frag = `
  uniform vec3 uZen,uHor,uSunDir,uSunCol,uMoonDir,uFogCol,uKeyCol; uniform float uSunVis,uMoonVis,uFogDen,uNight,uTime,uDist,uLamp;
  varying vec3 vW; varying vec3 vN; varying float vH;
  ${PK.NOISE}
  void main(){
    vec3 n=normalize(vN);
    vec2 q=vec2(vW.x,vW.z-uDist);
    vec2 dn=vec2(noise(q*1.3+uTime*.6),noise(q*1.3-uTime*.5+7.))-.5;
    n=normalize(n+vec3(dn.x,0.,dn.y)*.22);
    vec3 v=normalize(cameraPosition-vW);
    float fr=.03+.97*pow(1.-max(dot(n,v),0.),5.);
    vec3 r=reflect(-v,n); r.y=abs(r.y);
    vec3 sky=mix(uHor,uZen,pow(r.y,.5));
    float d=${SHORE.toFixed(2)}-vW.x;
    float lum=dot(uKeyCol,vec3(.33))*.8+.12;
    vec3 deep=vec3(.015,.07,.12)*lum*2.2, shal=vec3(.08,.36,.38)*lum*2.;
    vec3 body=mix(shal,deep,smoothstep(0.,18.,d));
    body+=vec3(.2,.5,.45)*max(vH,0.)*.25*lum;
    vec3 col=mix(body,sky,fr*.85);
    float ss=pow(max(dot(r,uSunDir),0.),220.);
    col+=uSunCol*(ss*4.+pow(max(dot(r,uSunDir),0.),18.)*.15)*uSunVis;
    float md=max(dot(r,uMoonDir),0.);
    float glit=step(.72,noise(q*5.+uTime*2.));
    col+=vec3(.85,.9,1.)*(pow(md,300.)*3.+pow(md,25.)*.5*glit)*uMoonVis;

    float sw=sin(d*.55+uTime*1.6+noise(q*.3)*4.);
    float band=smoothstep(.55,1.,sw)*exp(-max(d,0.)*.09);
    float shore=smoothstep(3.5,0.,d)*(.55+.45*noise(q*2.+uTime));
    float crest=smoothstep(.45,.75,vH)*smoothstep(25.,2.,d);
    float fo=clamp((band*.85+shore+crest)*(.55+.6*noise(q*3.5+vec2(0.,uTime*.3))),0.,1.);
    col=mix(col,vec3(.92,.95,1.)*(lum*1.4+.08),fo*.85);
    float fd=length(cameraPosition-vW);
    float fog=1.-exp(-pow(uFogDen*fd,2.));
    gl_FragColor=vec4(mix(col,uFogCol,fog),1.);
  }`;

  function sandTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#d9c39a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const v = 160 + Math.random() * 80;
      g.fillStyle = `rgba(${v},${v * 0.9},${v * 0.7},0.35)`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
    g.strokeStyle = 'rgba(150,120,80,0.18)';
    for (let i = 0; i < 18; i++) {
      g.beginPath();
      const y = Math.random() * 256;
      g.moveTo(0, y);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  PK.Ocean = class {
    constructor(scene) {
      this.uDist = { value: 0 };
      const geo = new THREE.PlaneGeometry(420, 520, 150, 170);
      geo.rotateX(-Math.PI / 2);
      this.mat = new THREE.ShaderMaterial({ uniforms: Object.assign({ uDist: this.uDist }, U), vertexShader: vert, fragmentShader: frag });
      this.mesh = new THREE.Mesh(geo, this.mat);
      this.mesh.position.set(SHORE + 4 - 210, -1.0, -170);
      this.mesh.frustumCulled = false;
      scene.add(this.mesh);

      const bg = new THREE.PlaneGeometry(40, 520, 40, 2);
      bg.rotateX(-Math.PI / 2);
      const pos = bg.attributes.position;
      const cols = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) - 24.6;
        const y = -0.12 - (-4.6 - x) * 0.1;
        pos.setY(i, y);
        const wet = THREE.MathUtils.smoothstep(x, SHORE - 1, SHORE + 3.5);
        cols.push(0.62 + 0.38 * wet, 0.6 + 0.4 * wet, 0.58 + 0.42 * wet);
      }
      bg.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      bg.computeVertexNormals();
      this.sand = sandTex();
      this.sand.repeat.set(5, 65);
      const beach = new THREE.Mesh(bg, new THREE.MeshLambertMaterial({ map: this.sand, vertexColors: true }));
      beach.position.set(-24.6, 0, -170);
      beach.receiveShadow = true;
      scene.add(beach);

      this.N = 420;
      const pg = new THREE.BufferGeometry();
      this.pp = new Float32Array(this.N * 3);
      this.pv = new Float32Array(this.N * 3);
      this.pl = new Float32Array(this.N);
      for (let i = 0; i < this.N; i++) this.pp[i * 3 + 1] = -50;
      pg.setAttribute('position', new THREE.BufferAttribute(this.pp, 3));
      pg.setAttribute('life', new THREE.BufferAttribute(this.pl, 1));
      this.pmat = new THREE.ShaderMaterial({
        uniforms: { uKeyCol: U.uKeyCol, uScale: { value: 300 } },
        vertexShader: `attribute float life; varying float vL; uniform float uScale;
          void main(){ vL=life; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=uScale*(.12+.1*(1.-life))/-mv.z; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `varying float vL; uniform vec3 uKeyCol;
          void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; float a=smoothstep(.5,.1,d)*vL*.75;
            gl_FragColor=vec4(vec3(.9,.95,1.)*(dot(uKeyCol,vec3(.33))*1.1+.2),a); }`,
        transparent: true, depthWrite: false,
      });
      this.points = new THREE.Points(pg, this.pmat);
      this.points.frustumCulled = false;
      scene.add(this.points);
      this.cursor = 0;
      this.burstT = 0;
      this.time = 0;
    }

    emit(z, count) {
      for (let k = 0; k < count; k++) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.N;
        this.pp[i * 3] = SHORE - 1.5 - Math.random() * 3;
        this.pp[i * 3 + 1] = -0.9;
        this.pp[i * 3 + 2] = z + (Math.random() - 0.5) * 7;
        this.pv[i * 3] = 1.5 + Math.random() * 3;
        this.pv[i * 3 + 1] = 2 + Math.random() * 3.5;
        this.pv[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
        this.pl[i] = 1;
      }
    }

    update(dt, speed, dist, quality) {
      this.time += dt;
      U.uTime.value = this.time;
      this.uDist.value = dist;
      this.sand.offset.y = (dist / 520) * 65;
      this.burstT -= dt;
      if (this.burstT <= 0) {
        this.burstT = 0.12 + Math.random() * 0.3;
        this.emit(-10 - Math.random() * 110, quality > 1 ? 14 : 6);
      }
      for (let i = 0; i < this.N; i++) {
        if (this.pl[i] <= 0) continue;
        const j = i * 3;
        this.pv[j + 1] -= 9.8 * dt;
        this.pp[j] += this.pv[j] * dt;
        this.pp[j + 1] += this.pv[j + 1] * dt;
        this.pp[j + 2] += (this.pv[j + 2] + speed) * dt;
        this.pl[i] -= dt * 0.9;
        if (this.pl[i] <= 0 || this.pp[j + 1] < -1.3) { this.pl[i] = 0; this.pp[j + 1] = -50; }
      }
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.life.needsUpdate = true;
    }

    setPixelScale(px) { this.pmat.uniforms.uScale.value = px; }
  };
})();
