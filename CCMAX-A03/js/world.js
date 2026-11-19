(function () {
const PK = window.PK = window.PK || {};
PK.LANES = [-2.6, 0, 2.6];
PK.SEA_Y = -1.0;
PK.shoreX = z => -14 + 1.6 * Math.sin(z * 0.031) + 0.8 * Math.sin(z * 0.083 + 1.3);

const GLC = `
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hash12(i),hash12(i+vec2(1.,0.)),u.x),mix(hash12(i+vec2(0.,1.)),hash12(i+vec2(1.,1.)),u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+17.1;a*=.5;}return s;}
float shoreX(float z){return -14.+1.6*sin(z*.031)+.8*sin(z*.083+1.3);}
uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar;
vec3 applyFog(vec3 c,float d){return mix(c,uFogCol,smoothstep(uFogNear,uFogFar,d));}
`;
const LIT = `
uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uSkyAmb; uniform vec3 uGndAmb;
vec3 light(vec3 n){float d=max(dot(n,uKeyDir),0.);return uKeyCol*d+mix(uGndAmb,uSkyAmb,n.y*.5+.5);}
`;

const KEYS = [
  { e: -0.42, zen: [0.006, 0.01, 0.035], hor: [0.018, 0.03, 0.07], glow: [0, 0, 0], sun: [0, 0, 0], sky: [0.07, 0.09, 0.17], gnd: [0.02, 0.025, 0.04], deep: [0.004, 0.01, 0.025] },
  { e: -0.15, zen: [0.02, 0.035, 0.1], hor: [0.08, 0.08, 0.18], glow: [0.1, 0.05, 0.12], sun: [0, 0, 0], sky: [0.09, 0.1, 0.2], gnd: [0.03, 0.03, 0.05], deep: [0.008, 0.02, 0.045] },
  { e: -0.045, zen: [0.07, 0.1, 0.27], hor: [0.7, 0.33, 0.32], glow: [0.85, 0.32, 0.16], sun: [0.4, 0.12, 0.05], sky: [0.22, 0.18, 0.3], gnd: [0.1, 0.06, 0.06], deep: [0.03, 0.05, 0.1] },
  { e: 0.03, zen: [0.17, 0.25, 0.5], hor: [1.0, 0.56, 0.3], glow: [1.0, 0.48, 0.16], sun: [1.0, 0.5, 0.22], sky: [0.4, 0.36, 0.45], gnd: [0.22, 0.14, 0.1], deep: [0.04, 0.1, 0.17] },
  { e: 0.18, zen: [0.2, 0.4, 0.75], hor: [0.95, 0.78, 0.6], glow: [1.0, 0.72, 0.42], sun: [1.0, 0.8, 0.58], sky: [0.45, 0.5, 0.62], gnd: [0.25, 0.22, 0.17], deep: [0.03, 0.14, 0.24] },
  { e: 0.6, zen: [0.13, 0.36, 0.8], hor: [0.64, 0.8, 0.94], glow: [0.85, 0.85, 0.78], sun: [1, 0.96, 0.88], sky: [0.5, 0.6, 0.75], gnd: [0.28, 0.27, 0.22], deep: [0.02, 0.16, 0.28] }
];
function sampleKeys(e) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  if (e <= a.e) b = a; else if (e >= b.e) a = b;
  else for (let i = 0; i < KEYS.length - 1; i++) if (e >= KEYS[i].e && e <= KEYS[i + 1].e) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  const t = a === b ? 0 : (e - a.e) / (b.e - a.e);
  const o = {};
  for (const k of ['zen', 'hor', 'glow', 'sun', 'sky', 'gnd', 'deep']) o[k] = new THREE.Color(a[k][0] + (b[k][0] - a[k][0]) * t, a[k][1] + (b[k][1] - a[k][1]) * t, a[k][2] + (b[k][2] - a[k][2]) * t);
  return o;
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

PK.createWorld = function (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 70, 470);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);

  const common = {
    uTime: { value: 0 }, uFogCol: { value: new THREE.Color() }, uFogNear: { value: 70 }, uFogFar: { value: 470 },
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) }, uKeyCol: { value: new THREE.Color() },
    uSkyAmb: { value: new THREE.Color() }, uGndAmb: { value: new THREE.Color() },
    uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uSunVis: { value: 1 }, uMoonVis: { value: 0 }, uStars: { value: 0 }, uDeep: { value: new THREE.Color() },
    uDetail: { value: 1 }, uNight: { value: 0 }
  };

  // Sky dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 48, 24), new THREE.ShaderMaterial({
    uniforms: common, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir;void main(){vec4 wp=modelMatrix*vec4(position,1.);vDir=wp.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: GLC + `
uniform vec3 uZen,uHor,uGlow,uSunDir,uMoonDir,uSunCol;uniform float uSunVis,uMoonVis,uStars,uTime;varying vec3 vDir;
float starL(vec3 d,float k,float th,float r){vec3 p=d*k;vec3 c=floor(p);vec3 h=hash33(c);if(h.x<th)return 0.;
 vec3 sp=c+.25+.5*hash33(c+7.1);float tw=.65+.35*sin(uTime*(1.3+h.y*3.)+h.z*40.);return smoothstep(r,0.,length(p-sp))*tw*(h.y*.8+.2);}
void main(){vec3 d=normalize(vDir);float y=d.y;float hy=max(y,0.);
 vec3 col=mix(uHor,uZen,pow(hy,.42));
 if(y<0.)col=uHor;
 float sd=max(dot(d,uSunDir),0.);
 col+=uGlow*pow(sd,5.)*.75*(1.-hy*.7);col+=uGlow*pow(sd,60.)*.9;
 col=mix(col,uSunCol*1.7+.2,smoothstep(.99935,.9997,sd)*uSunVis);
 float cl=0.;
 if(y>0.){vec2 cp=d.xz/(y+.1)*1.3+vec2(uTime*.006,uTime*.002);cl=smoothstep(.52,.86,fbm(cp))*smoothstep(0.,.2,y)*smoothstep(.95,.5,y);
  vec3 lit=mix(uZen*.5+uHor*.35,uGlow*1.25+uHor*.35,pow(sd,2.5));
  vec3 cc=mix(lit,vec3(.06,.07,.12)*(.4+uMoonVis*.6),uStars*.85);col=mix(col,cc,cl*.75);}
 float st=(starL(d,120.,.955,.16)+starL(d,230.,.975,.2)*.75+starL(d,60.,.993,.12)*1.6)*uStars*smoothstep(0.,.12,y)*(1.-cl);
 float mw=fbm(vec2(atan(d.x,d.z)*3.,d.y*9.))*smoothstep(.35,0.,abs(d.y-.45+d.x*.35))*uStars;
 col+=vec3(st)+vec3(.12,.11,.2)*mw*.6;
 float md=dot(d,uMoonDir);
 vec3 mc=vec3(1.,.96,.86)*(.82+.18*vnoise(d.xy*260.+d.z*130.));
 col+=vec3(.35,.42,.6)*pow(max(md,0.),90.)*.35*uMoonVis;
 col=mix(col,mc,smoothstep(.99965,.99978,md)*uMoonVis);
 gl_FragColor=vec4(col,1.);}`
  }));
  sky.renderOrder = -10;
  scene.add(sky);

  // Sea
  const seaGeo = new THREE.PlaneGeometry(700, 700, 400, 200);
  seaGeo.rotateX(-Math.PI / 2);
  {
    const pa = seaGeo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const u = (350 - pa.getX(i)) / 700;
      pa.setX(i, 350 - 700 * Math.pow(u, 2.2));
    }
    seaGeo.computeBoundingSphere();
  }
  const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({
    uniforms: common, fog: false,
    vertexShader: GLC + `
uniform float uTime;varying vec3 vW;varying vec3 vN;varying float vH;varying float vBreak;
float W(vec2 p,vec2 d,float L,float A,float s,inout vec2 g){float k=6.2831/L;float f=k*dot(d,p)-sqrt(9.8*k)*uTime*s;g+=A*k*d*cos(f);return A*sin(f);}
void main(){vec4 wp=modelMatrix*vec4(position,1.);vec2 p=wp.xz;float ds=shoreX(p.y)-p.x;
 float at=smoothstep(0.,22.,ds);vec2 g=vec2(0.);float h=0.;
 h+=W(p,normalize(vec2(1.,.18)),31.,.34,1.,g);h+=W(p,normalize(vec2(.8,-.55)),17.,.2,1.,g);
 h+=W(p,normalize(vec2(.95,.42)),10.5,.11,1.,g);h+=W(p,normalize(vec2(.25,1.)),46.,.22,1.,g);
 float ph=ds/7.5+uTime*.17;float fr=fract(ph);
 float sw=smoothstep(34.,10.,ds)*smoothstep(0.,5.,ds);float crest=pow(1.-fr,6.)+smoothstep(.9,1.,fr)*.6;
 h=h*at+sw*.5*crest;g*=at;
 wp.y+=h;vH=h;vBreak=sw*crest;vW=wp.xyz;vN=normalize(vec3(-g.x,1.,-g.y));
 gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: GLC + `
uniform float uTime,uSunVis,uMoonVis,uDetail,uNight;uniform vec3 uZen,uHor,uGlow,uSunDir,uMoonDir,uSunCol,uDeep;
varying vec3 vW;varying vec3 vN;varying float vH;varying float vBreak;
vec2 dw(vec2 p,vec2 d,float L,float A){float k=6.2831/L;float f=k*dot(d,p)-sqrt(9.8*k)*uTime;return A*k*d*cos(f);}
void main(){vec3 V=cameraPosition-vW;float dist=length(V);V/=dist;
 float fade=uDetail/(1.+dist*.025);vec2 p=vW.xz;
 vec2 g=dw(p,normalize(vec2(.6,.8)),3.3,.05)+dw(p,normalize(vec2(-.7,.5)),2.1,.03)+dw(p,normalize(vec2(.9,-.3)),1.3,.018)+dw(p,normalize(vec2(.2,-1.)),5.2,.06);
 vec3 N=normalize(vN+vec3(-g.x,0.,-g.y)*fade);
 float ndv=max(dot(N,V),0.);float fres=.02+.98*pow(1.-ndv,5.);
 vec3 R=reflect(-V,N);R.y=abs(R.y);
 vec3 sref=mix(uHor,uZen,pow(R.y,.5))+uGlow*pow(max(dot(R,uSunDir),0.),5.)*.6;
 float ds=shoreX(p.y)-p.x;
 vec3 water=mix(uDeep*1.0,uDeep*1.8+vec3(.03,.09,.08)*(1.-uNight*.8),smoothstep(30.,3.,ds));
 water+=uDeep*max(vH,0.)*.8;
 vec3 col=mix(water,sref,fres);
 float sp=max(dot(R,uSunDir),0.);col+=uSunCol*uSunVis*(pow(sp,700.)*9.+pow(sp,70.)*.25);
 float mp=max(dot(R,uMoonDir),0.);col+=vec3(.75,.82,1.)*uMoonVis*(pow(mp,400.)*5.+pow(mp,40.)*.06);
 float n=vnoise(p*.35+vec2(uTime*.3,0.))*.6+vnoise(p*1.3-uTime*.2)*.4;
 float ph=ds/7.5+uTime*.17;float fr=fract(ph);
 float band=(smoothstep(.0,.04,fr)*smoothstep(.22,.02,fr))*smoothstep(32.,6.,ds)*smoothstep(-.5,2.,ds);
 float foam=band*smoothstep(.25,.6,n)+smoothstep(2.6,0.,ds)*smoothstep(.15,.5,n)+smoothstep(.6,1.,vH)*.25*n;
 foam=clamp(foam+vBreak*.15,0.,1.);
 vec3 fcol=mix(uHor*.45+uZen*.25,vec3(.9,.92,.95),1.-uNight*.75)+uSunCol*uSunVis*.15;
 col=mix(col,fcol,foam*.9);
 gl_FragColor=vec4(applyFog(col,dist),1.);}`
  }));
  scene.add(sea);

  // Beach
  const beachGeo = new THREE.PlaneGeometry(40, 700, 40, 350);
  beachGeo.rotateX(-Math.PI / 2);
  beachGeo.translate(-25.2, 0, 0);
  const beach = new THREE.Mesh(beachGeo, new THREE.ShaderMaterial({
    uniforms: common, fog: false,
    vertexShader: GLC + `varying vec3 vW;varying float vDs;
void main(){vec4 wp=modelMatrix*vec4(position,1.);float sx=shoreX(wp.z);float rel=wp.x-sx;
 float y=-1.+rel*.085;y+=smoothstep(3.,8.,rel)*(vnoise(wp.xz*.25)-.3)*.35;y=min(y,-.12);
 wp.y=y;vW=wp.xyz;vDs=rel;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: GLC + LIT + `uniform float uTime,uNight;varying vec3 vW;varying float vDs;
void main(){vec2 p=vW.xz;float dist=length(cameraPosition-vW);
 float n=vnoise(p*3.)*.5+vnoise(p*.4)*.5;
 vec3 sand=mix(vec3(.62,.5,.34),vec3(.74,.62,.44),n);
 float sw=1.1+1.3*(.5+.5*sin(uTime*.55+p.y*.025))+.4*sin(uTime*1.3+p.y*.11);
 float wet=smoothstep(sw+1.8,sw-.2,vDs);
 sand=mix(sand,sand*vec3(.48,.46,.45),wet);
 vec3 nrm=normalize(vec3(-.085,1.,0.));vec3 col=sand*light(nrm);
 float fl=smoothstep(.35,0.,abs(vDs-sw))*smoothstep(.2,.6,vnoise(p*1.7+uTime*.4));
 float sheen=wet*smoothstep(sw+.4,sw-.6,vDs);
 col=mix(col,uSkyAmb*1.6+uKeyCol*.4,sheen*.25);
 col=mix(col,mix(vec3(.85,.88,.92),uSkyAmb*2.,uNight*.6),fl*.85);
 gl_FragColor=vec4(applyFog(col,dist),1.);}`
  }));
  beach.receiveShadow = false;
  scene.add(beach);

  // Inland hills
  const hillGeo = new THREE.PlaneGeometry(300, 700, 90, 140);
  hillGeo.rotateX(-Math.PI / 2);
  hillGeo.translate(150 + 5.2, 0, 0);
  const hills = new THREE.Mesh(hillGeo, new THREE.ShaderMaterial({
    uniforms: common, fog: false,
    vertexShader: GLC + `varying vec3 vW;varying vec3 vN;
float H(vec2 p){float x=p.x;float b=smoothstep(7.,60.,x);float n=fbm(p*.011);float r=1.-abs(vnoise(p*.017+3.)*2.-1.);
 return smoothstep(5.,9.,x)*1.2+b*(n*55.+r*22.-6.)+smoothstep(80.,260.,x)*40.;}
void main(){vec4 wp=modelMatrix*vec4(position,1.);vec2 p=wp.xz;float h=H(p);
 float e=2.;vN=normalize(vec3(H(p-vec2(e,0.))-H(p+vec2(e,0.)),2.*e,H(p-vec2(0.,e))-H(p+vec2(0.,e))));
 wp.y=h-.05;vW=wp.xyz;gl_Position=projectionMatrix*viewMatrix*wp;}`,
    fragmentShader: GLC + LIT + `varying vec3 vW;varying vec3 vN;
void main(){vec3 N=normalize(vN);float dist=length(cameraPosition-vW);vec2 p=vW.xz;
 float n=vnoise(p*.08)*.6+vnoise(p*.9)*.4;
 vec3 grass=mix(vec3(.22,.3,.12),vec3(.46,.42,.2),n);
 vec3 rock=mix(vec3(.36,.32,.28),vec3(.5,.46,.4),vnoise(p*.3));
 vec3 c=mix(rock,grass,smoothstep(.62,.82,N.y));
 c=mix(vec3(.3,.32,.2),c,smoothstep(5.,8.,vW.x));
 gl_FragColor=vec4(applyFog(c*light(N),dist),1.);}`
  }));
  scene.add(hills);

  // Road
  const rc = document.createElement('canvas');
  rc.width = 256; rc.height = 512;
  const g = rc.getContext('2d');
  g.fillStyle = '#3a3b40'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 9000; i++) {
    const v = 40 + Math.random() * 40 | 0;
    g.fillStyle = `rgba(${v},${v},${v + 4},${0.35 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * 256, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const px = x => (x + 4.5) / 9 * 256;
  g.fillStyle = '#e8e4d8';
  g.fillRect(px(-4.15) - 3, 0, 6, 512);
  g.fillStyle = '#e8c547';
  g.fillRect(px(4.15) - 3, 0, 6, 512);
  g.fillStyle = '#e8e4d8';
  for (const x of [-1.3, 1.3]) { g.fillRect(px(x) - 2.5, 0, 5, 160); g.fillRect(px(x) - 2.5, 256, 5, 160); }
  const roadTex = new THREE.CanvasTexture(rc);
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 700 / 12);
  roadTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 700), new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.88, metalness: 0 }));
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 700), new THREE.MeshStandardMaterial({ color: 0x55513f, roughness: 1 }));
  shoulder.rotation.x = -Math.PI / 2; shoulder.position.set(5.0, 0.01, 0); shoulder.receiveShadow = true;
  scene.add(shoulder);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 700), new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.95 }));
  wall.position.set(-4.85, -0.7, 0); wall.receiveShadow = true;
  scene.add(wall);

  // Far horizon: islands and lighthouse, kept at a fixed offset so they read as distant
  const far = new THREE.Group();
  scene.add(far);
  const islandMat = new THREE.MeshBasicMaterial({ color: 0x2f3a3a, fog: false });
  [[-300, -400, 70, 22], [-420, -260, 110, 30], [-200, -430, 46, 14], [-520, -380, 140, 40]].forEach(([x, z, r, h]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 1), islandMat);
    m.scale.z = 0.5; m.position.set(x, -1 + h / 2 - 3, z); far.add(m);
  });
  const lh = new THREE.Group();
  lh.position.set(-150, -1, -230);
  const rockI = new THREE.Mesh(new THREE.ConeGeometry(14, 7, 8, 1), islandMat);
  rockI.position.y = 2; rockI.scale.z = 0.6; lh.add(rockI);
  const lhMat = new THREE.MeshBasicMaterial({ color: 0xe8e2d8, fog: false });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 15, 12), lhMat);
  tower.position.y = 12; lh.add(tower);
  const bandMat = new THREE.MeshBasicMaterial({ color: 0xb0302a, fog: false });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.85, 3, 12), bandMat);
  band.position.y = 12; lh.add(band);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false }));
  lamp.position.y = 20.5; lh.add(lamp);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff1c0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beamGeo = new THREE.ConeGeometry(5, 75, 16, 1, true);
  beamGeo.translate(0, -37.5, 0); beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Group();
  const b1 = new THREE.Mesh(beamGeo, beamMat), b2 = new THREE.Mesh(beamGeo, beamMat);
  b2.rotation.y = Math.PI; beam.add(b1, b2); beam.position.y = 20.5; lh.add(beam);
  far.add(lh);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 120 });
  key.shadow.bias = -0.0008;
  scene.add(key, key.target);

  const START_H = 17.2;
  const MR = new THREE.Vector3(-0.95, 0, -0.3).normalize(), MU = new THREE.Vector3(-0.1, 0.5, -0.86).normalize();
  const W = {
    renderer, scene, camera, common, hour: START_H, e: 0.1, night: 0, sunDir: new THREE.Vector3(), moonDir: new THREE.Vector3(), key, hemi,
    lighthouseBeam: beam
  };
  const D = new THREE.Vector3(0.6, 0, 0.8).normalize(), S = new THREE.Vector3(-0.8, 0, 0.6), UP = new THREE.Vector3(0, 1, 0);
  function hoursPerSec(h) {
    if (h >= 17 && h < 20.5) return 1 / 42;
    if (h >= 4.5 && h < 7) return 1 / 30;
    if (h >= 20.5 || h < 4.5) return 1 / 20;
    return 1 / 14;
  }
  function dirFor(a, ampY, ampS, out) {
    return out.copy(D).multiplyScalar(Math.cos(a)).addScaledVector(UP, Math.sin(a) * ampY).addScaledVector(S, Math.sin(a) * ampS).normalize();
  }
  W.update = function (dt, t, focusZ) {
    W.hour = (W.hour + dt * hoursPerSec(W.hour)) % 24;
    const a = (W.hour - 6) / 24 * Math.PI * 2;
    dirFor(a, 0.85, 0.35, W.sunDir);
    const b = ((W.hour - 19 + 24) % 24) / 12 * Math.PI;
    W.moonDir.copy(MR).multiplyScalar(Math.cos(b)).addScaledVector(MU, Math.sin(b)).normalize();
    const e = W.e = W.sunDir.y;
    const k = sampleKeys(e);
    const u = common;
    u.uTime.value = t;
    u.uZen.value.copy(k.zen); u.uHor.value.copy(k.hor); u.uGlow.value.copy(k.glow); u.uSunCol.value.copy(k.sun);
    u.uDeep.value.copy(k.deep);
    u.uSunDir.value.copy(W.sunDir); u.uMoonDir.value.copy(W.moonDir);
    u.uSunVis.value = sst(-0.06, 0.0, e);
    const night = W.night = sst(0.0, -0.16, e);
    u.uNight.value = night;
    u.uStars.value = sst(-0.03, -0.2, e);
    u.uMoonVis.value = sst(0.05, -0.12, e) * sst(-0.04, 0.03, W.moonDir.y);
    u.uFogCol.value.copy(k.hor);
    scene.fog.color.copy(u.uFogCol.value);
    const sunI = sst(-0.05, 0.12, e) * 1.25, moonI = sst(-0.02, -0.2, e) * 0.55 * sst(-0.05, 0.1, W.moonDir.y);
    const useSun = sunI >= moonI;
    const kd = useSun ? W.sunDir : W.moonDir;
    u.uKeyDir.value.copy(kd);
    if (useSun) u.uKeyCol.value.copy(k.sun).multiplyScalar(sunI);
    else u.uKeyCol.value.setRGB(0.55, 0.65, 0.95).multiplyScalar(moonI);
    u.uSkyAmb.value.copy(k.sky); u.uGndAmb.value.copy(k.gnd);
    key.color.copy(u.uKeyCol.value);
    key.intensity = 1;
    key.position.set(kd.x * 60, Math.max(kd.y, 0.08) * 60, focusZ + kd.z * 60);
    key.target.position.set(0, 0, focusZ);
    hemi.color.copy(k.sky).multiplyScalar(1.6);
    hemi.groundColor.copy(k.gnd).multiplyScalar(1.6);
    hemi.intensity = 1;

    sky.position.copy(camera.position);
    const sz = Math.round(focusZ / 3.5) * 3.5;
    sea.position.set(-330, PK.SEA_Y, sz - 100);
    beach.position.set(0, 0, Math.round(focusZ / 2) * 2 - 120);
    hills.position.set(0, 0, Math.round(focusZ / 5) * 5 - 120);
    const rz = Math.round(focusZ / 12) * 12;
    road.position.z = rz - 150; shoulder.position.z = rz - 150; wall.position.z = rz - 150;
    far.position.z = focusZ;
    const hz = u.uHor.value, zn = u.uZen.value;
    islandMat.color.setRGB(hz.r * 0.42 + zn.r * 0.2, hz.g * 0.42 + zn.g * 0.2, hz.b * 0.42 + zn.b * 0.22);
    lhMat.color.copy(islandMat.color).lerp(new THREE.Color(0.95, 0.92, 0.86), 0.3 * (1 - night));
    bandMat.color.copy(islandMat.color).lerp(new THREE.Color(0.7, 0.2, 0.17), 0.45 * (1 - night));
    beam.rotation.y = t * 0.9;
    beamMat.opacity = 0.1 * night;
    lamp.material.color.setRGB(1, 0.95, 0.75).multiplyScalar(0.35 + night * 0.9);
  };
  W.clockText = function () {
    const h = Math.floor(W.hour), m = Math.floor((W.hour - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  };
  W.resize = function () {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  return W;
};
})();
