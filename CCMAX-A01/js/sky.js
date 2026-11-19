(function () {
  const PK = (window.PK = window.PK || {});

  const U = (PK.U = {
    uTime: { value: 0 },
    uZen: { value: new THREE.Color() },
    uHor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1) },
    uSunCol: { value: new THREE.Color() },
    uSunVis: { value: 1 },
    uMoonDir: { value: new THREE.Vector3(0, 0.3, -1) },
    uMoonVis: { value: 0 },
    uNight: { value: 0 },
    uLamp: { value: 0 },
    uCloudCol: { value: new THREE.Color() },
    uFogCol: { value: new THREE.Color() },
    uFogDen: { value: 0.0034 },
    uPlayer: { value: new THREE.Vector3() },
    uPlayerDir: { value: 0 },
    uHeadlight: { value: 0 },
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
    uKeyCol: { value: new THREE.Color() },
  });

  const K = [
    { t: 0.0, name: '黄昏', el: 9, zen: '#35558f', hor: '#ffb46a', sun: '#ffc27c', cloud: '#e98f6a', amb: 0.95, night: 0, lamp: 0 },
    { t: 0.09, name: '日落', el: 0.5, zen: '#2c3c76', hor: '#ff7b45', sun: '#ff8a4a', cloud: '#d8645a', amb: 0.75, night: 0, lamp: 0.25 },
    { t: 0.17, name: '暮光', el: -5, zen: '#1c2452', hor: '#c35c63', sun: '#ff6a55', cloud: '#7a3f58', amb: 0.5, night: 0.12, lamp: 0.85 },
    { t: 0.27, name: '蓝调时刻', el: -12, zen: '#0e1636', hor: '#34477c', sun: '#8a96d0', cloud: '#26304f', amb: 0.36, night: 0.55, lamp: 1 },
    { t: 0.37, name: '星空月夜', el: -28, zen: '#040918', hor: '#142347', sun: '#a9bdf0', cloud: '#141c33', amb: 0.3, night: 1, lamp: 1 },
    { t: 0.72, name: '星空月夜', el: -28, zen: '#040918', hor: '#142347', sun: '#a9bdf0', cloud: '#141c33', amb: 0.3, night: 1, lamp: 1 },
    { t: 0.8, name: '黎明', el: -8, zen: '#121b40', hor: '#4a4475', sun: '#9d8fc8', cloud: '#3a3458', amb: 0.4, night: 0.5, lamp: 1 },
    { t: 0.86, name: '晨曦', el: 0.5, zen: '#2c3d78', hor: '#f0906c', sun: '#ffae7a', cloud: '#e7987e', amb: 0.7, night: 0.04, lamp: 0.3 },
    { t: 0.92, name: '白昼', el: 24, zen: '#3e78c4', hor: '#bfdcf0', sun: '#fff2dc', cloud: '#f4f1ea', amb: 1.15, night: 0, lamp: 0 },
    { t: 1.0, name: '黄昏', el: 9, zen: '#35558f', hor: '#ffb46a', sun: '#ffc27c', cloud: '#e98f6a', amb: 0.95, night: 0, lamp: 0 },
  ].map((k) => ({ ...k, zen: new THREE.Color(k.zen), hor: new THREE.Color(k.hor), sun: new THREE.Color(k.sun), cloud: new THREE.Color(k.cloud) }));

  const NOISE = `
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
  `;
  PK.NOISE = NOISE;

  const skyVert = `
  varying vec3 vDir;
  void main(){ vDir=position; vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; }`;

  const skyFrag = `
  uniform vec3 uZen,uHor,uSunCol,uSunDir,uMoonDir,uCloudCol; uniform float uNight,uTime,uSunVis,uMoonVis;
  varying vec3 vDir;
  ${NOISE}
  void main(){
    vec3 d=normalize(vDir); float y=d.y; float h=max(y,0.);
    vec3 col=mix(uHor,uZen,pow(h,.45));
    if(y<0.) col=mix(uHor,uHor*.5,min(-y*5.,1.));
    float sd=max(dot(d,uSunDir),0.);
    vec2 a1=normalize(d.xz+1e-4), a2=normalize(uSunDir.xz+1e-4);
    float az=max(dot(a1,a2),0.);
    col+=uSunCol*(pow(sd,6.)*.3+pow(sd,90.)*.5)*uSunVis;
    col+=uSunCol*pow(az,3.)*exp(-h*7.)*.3*uSunVis;
    col+=uSunCol*2.5*smoothstep(.99935,.9997,sd)*uSunVis;

    vec3 sp=d*230.; vec3 cell=floor(sp); vec3 f=fract(sp)-.5; float r=hash3(cell);
    float star=0.;
    if(r>.982){ vec3 o=(vec3(hash3(cell+1.3),hash3(cell+2.7),hash3(cell+5.1))-.5)*.5;
      float dd=length(f-o); float b=(r-.982)/.018;
      star=smoothstep(.3,.0,dd)*(.35+b*b*1.4)*(.65+.35*sin(uTime*(1.5+r*25.)+r*90.)); }
    float band=exp(-pow(dot(d,normalize(vec3(.35,.4,-.85)))*3.2,2.));
    float mw=band*fbm(d.xy*6.+d.z*3.)*.5;

    float cl=0.;
    if(y>0.){ vec2 uv=d.xz/(y+.12)*.9+vec2(uTime*.006,uTime*.002);
      cl=smoothstep(.52,.9,fbm(uv*.7+vec2(fbm(uv*.35),0.)*.6))*smoothstep(.0,.12,y); }
    float hot=pow(sd,3.)*uSunVis;
    vec3 cc=uCloudCol*(.75+.5*fbm(d.xz*9.))+uSunCol*hot*.6;

    float mv=uMoonVis;
    vec3 mu=normalize(cross(uMoonDir,vec3(0.,1.,0.))); vec3 mvv=cross(mu,uMoonDir);
    float md=dot(d,uMoonDir);
    vec2 mp=vec2(dot(d,mu),dot(d,mvv))/.03;
    float disc=md>0.?smoothstep(1.,.95,length(mp)):0.;
    float cr=fbm(mp*2.2+3.)*.6+noise(mp*8.)*.15;
    vec3 mc=vec3(1.,.97,.88)*(1.15-cr*.5);
    vec3 glow=vec3(.55,.65,.95)*(pow(max(md,0.),600.)*.35+pow(max(md,0.),40.)*.08)*mv;

    col+=vec3(.85,.9,1.)*star*uNight*(1.-cl)*smoothstep(-.02,.12,y);
    col+=vec3(.55,.6,.8)*mw*uNight*.35*(1.-cl);
    col+=glow;
    col=mix(col,mc,disc*mv*(1.-cl*.85));
    col=mix(col,cc+glow*1.5,cl*.88);
    gl_FragColor=vec4(col,1.);
  }`;

  function lerpKey(t) {
    t = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < K.length - 2 && K[i + 1].t <= t) i++;
    const a = K[i], b = K[i + 1];
    const f = (t - a.t) / (b.t - a.t);
    const s = f * f * (3 - 2 * f);
    return {
      a, b, s, f,
      el: a.el + (b.el - a.el) * s,
      zen: a.zen.clone().lerp(b.zen, s),
      hor: a.hor.clone().lerp(b.hor, s),
      sun: a.sun.clone().lerp(b.sun, s),
      cloud: a.cloud.clone().lerp(b.cloud, s),
      amb: a.amb + (b.amb - a.amb) * s,
      night: a.night + (b.night - a.night) * s,
      lamp: a.lamp + (b.lamp - a.lamp) * s,
      name: f < 0.5 ? a.name : b.name,
    };
  }

  PK.Sky = class {
    constructor(scene) {
      this.cycle = 300;
      this.t = 0.02;
      this.mesh = new THREE.Mesh(
        new THREE.SphereGeometry(900, 48, 24),
        new THREE.ShaderMaterial({ uniforms: U, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false })
      );
      this.mesh.renderOrder = -10;
      this.mesh.frustumCulled = false;
      scene.add(this.mesh);

      this.key = new THREE.DirectionalLight(0xffffff, 1);
      this.key.position.set(-10, 10, -10);
      scene.add(this.key, this.key.target);
      this.hemi = new THREE.HemisphereLight(0xffffff, 0x334455, 0.6);
      scene.add(this.hemi);
      scene.fog = new THREE.FogExp2(0x000000, 0.0022);
      this.scene = scene;
      this.state = {};
      this.nightTime = 0;
      this.moonTint = new THREE.Color();
    }

    update(dt, camera, playerPos) {
      this.t = (this.t + dt / this.cycle) % 1;
      const k = lerpKey(this.t);
      const el = (k.el * Math.PI) / 180;
      U.uSunDir.value.set(-0.72 * Math.cos(el), Math.sin(el), -0.7 * Math.cos(el)).normalize();

      const mt = (this.t - 0.16) / 0.72;
      const mEl = mt > 0 && mt < 1 ? Math.sin(mt * Math.PI) * 0.36 - 0.05 : -0.2;
      U.uMoonDir.value.set(-0.5 - 0.3 * (mt - 0.5), mEl, -0.85).normalize();
      const moonVis = Math.max(0, Math.min(1, (mEl + 0.02) * 12)) * Math.min(1, k.night * 1.6 + 0.15);

      U.uZen.value.copy(k.zen);
      U.uHor.value.copy(k.hor);
      U.uSunCol.value.copy(k.sun);
      U.uCloudCol.value.copy(k.cloud);
      U.uSunVis.value = Math.max(0, Math.min(1, (k.el + 6) / 6));
      U.uMoonVis.value = moonVis;
      U.uNight.value = k.night;
      U.uLamp.value = k.lamp;
      U.uFogCol.value.copy(k.hor).lerp(k.zen, 0.35);
      U.uHeadlight.value = Math.min(1, k.lamp * 1.2);

      const sunW = U.uSunVis.value;
      const keyDir = U.uSunDir.value.clone().lerp(U.uMoonDir.value, 1 - sunW).normalize();
      if (keyDir.y < 0.15) keyDir.y = 0.15;
      keyDir.normalize();
      U.uKeyDir.value.copy(keyDir);
      const kc = k.sun.clone().multiplyScalar(sunW > 0 ? 0.6 + 0.9 * sunW : 0.35 * moonVis + 0.15);
      U.uKeyCol.value.copy(kc);

      this.key.color.copy(k.sun);
      this.key.intensity = sunW > 0.01 ? 0.4 + 1.1 * sunW : 0.25 + 0.35 * moonVis;
      this.key.position.copy(playerPos).addScaledVector(keyDir, 30);
      this.key.target.position.copy(playerPos);
      this.hemi.color.copy(k.zen).lerp(k.hor, 0.5).multiplyScalar(1.4).add(this.moonTint.setRGB(0.2, 0.26, 0.42).multiplyScalar(k.night));
      this.hemi.groundColor.copy(k.hor).multiplyScalar(0.35);
      this.hemi.intensity = k.amb + k.night * 0.35;
      this.scene.fog.color.copy(U.uFogCol.value);
      this.scene.fog.density = U.uFogDen.value;

      this.mesh.position.copy(camera.position);
      if (k.night > 0.95) this.nightTime += dt;
      this.state = { name: k.name, night: k.night, lamp: k.lamp, t: this.t };
      return this.state;
    }
  };
})();
