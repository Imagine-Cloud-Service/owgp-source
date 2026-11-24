import * as THREE from 'three';

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Environment {
  constructor(scene, track, quality = 'high') {
    this.scene = scene; this.track = track;
    this.quality = quality;
    scene.background = new THREE.Color(0x9bd7ff);
    scene.fog = new THREE.Fog(0x9bd7ff, 250, 1600);
    scene.add(new THREE.HemisphereLight(0xdff3ff, 0x4d7a3a, 0.85));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = quality !== 'low'; this.sun.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    Object.assign(this.sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun, this.sun.target);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5fae4e, roughness: 1, flatShading: true }));
    ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground); this.ground = ground;

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240 * 2 * 3), 3));
    this.rain = new THREE.LineSegments(this.rainGeometry, new THREE.LineBasicMaterial({ color: 0xc8e5f5, transparent: true, opacity: 0.3 }));
    this.rain.frustumCulled = false; this.rain.visible = false; scene.add(this.rain);

    if (track.spec.venue === 'street') this._cityscape(); else this._trees();
    if (track.spec.venue === 'forest') this._hills();
    this._stands(); this._clouds(); this._gantry(); this._trackside();
  }

  follow(x, z) {
    this.sun.position.set(x + 80, 120, z + 50);
    this.sun.target.position.set(x, 0, z);
    if (this.rain.visible) {
      const a = this.rainGeometry.attributes.position.array, time = performance.now() * 0.035;
      for (let i = 0; i < 240; i++) {
        const px = ((i * 47.31 + time * 0.2) % 90) - 45, pz = ((i * 27.17 + time * 0.1) % 90) - 45;
        const y = 3 + ((i * 13.71 - time) % 55 + 55) % 55, j = i * 6;
        a[j] = x + px; a[j + 1] = y; a[j + 2] = z + pz;
        a[j + 3] = x + px - 0.5; a[j + 4] = y - 2.4; a[j + 5] = z + pz + 0.2;
      }
      this.rainGeometry.attributes.position.needsUpdate = true;
    }
  }

  setWeather(wetness) {
    const wet = Math.max(0, Math.min(1, wetness));
    const clearSky = new THREE.Color(0x9bd7ff), rainSky = new THREE.Color(0x53697e);
    const sky = clearSky.lerp(rainSky, wet);
    this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
    this.ground.material.color.set(0x5fae4e).lerp(new THREE.Color(0x354f43), wet * 0.55);
    this.rain.visible = wet > 0.18; this.rain.material.opacity = 0.12 + wet * 0.32;
  }

  _trees() {
    const r = rng(7), t = this.track, pts = [];
    const count = this.quality === 'low' ? 70 : this.quality === 'medium' ? 150 : 260;
    for (let n = 0; n < count * 3 && pts.length < count; n++) {
      const x = -900 + r() * 1700, z = -900 + r() * 1200;
      let ok = true;
      for (let i = 0; i < t.N; i += 2) { const p = t.samples[i]; if ((x - p.x) ** 2 + (z - p.z) ** 2 < 45 * 45) { ok = false; break; } }
      if (ok) pts.push([x, z, 0.8 + r() * 1.1]);
    }
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.4, 0.5, 3, 6), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }), pts.length);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.6, 7, 7), new THREE.MeshStandardMaterial({ color: 0x2f7d3f, flatShading: true }), pts.length);
    const m = new THREE.Matrix4();
    pts.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 1.5 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); trunk.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, 6 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)); crown.setMatrixAt(i, m);
    });
    crown.castShadow = trunk.castShadow = true;
    this.scene.add(trunk, crown);
  }

  _stand(index, side, length) {
    const t = this.track, p = t.samples[index], tan = t.tangents[index], right = t.rights[index];
    const street = this.track.spec.venue === 'street';
    const g = new THREE.Group(), tiers = street ? 3 : 6, tierH = street ? 0.95 : 1.1;
    const concrete = new THREE.MeshStandardMaterial({ color: 0xc9d0d6, flatShading: true });
    for (let j = 0; j < tiers; j++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(length, tierH, 1.3), concrete);
      b.position.set(0, tierH/2 + j * tierH, side * j * 1.3); b.castShadow = b.receiveShadow = true; g.add(b);
    }
    const roofH = street ? 4.9 : 9;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(length + 2, 0.25, street ? 6 : 9), new THREE.MeshStandardMaterial({ color: street ? 0xf0e7d7 : 0xe03a3e }));
    roof.position.set(0, roofH, side * (street ? 3 : 4.5)); roof.castShadow = true; g.add(roof);
    for (const x of [-length / 2, 0, length / 2]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.4, roofH, 0.4), concrete); c.position.set(x, roofH/2, side * (street ? 5.6 : 8)); g.add(c);
    }
    const per = Math.floor(length / 0.9), crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.85, 0.4), new THREE.MeshStandardMaterial({ flatShading: true }), per * tiers);
    const pal = [0xe03a3e, 0xf4f6f8, 0xffc400, 0x2a6fdb, 0x3ddc84, 0x101820].map(c => new THREE.Color(c));
    const r = rng(index * 13 + 5), m = new THREE.Matrix4(); let n = 0;
    for (let j = 0; j < tiers; j++) for (let i = 0; i < per; i++) {
      m.setPosition(-length / 2 + 0.5 + i * 0.9, 1.3 + j * tierH, side * j * 1.3 - side * 0.1);
      crowd.setMatrixAt(n, m); crowd.setColorAt(n++, pal[Math.floor(r() * pal.length)]);
    }
    g.add(crowd);
    const off = street ? this.track.wallOffset + 10 : this.track.width / 2 + 24;
    g.position.set(p.x + right.x * side * off, 0, p.z + right.z * side * off);
    g.rotation.y = -Math.atan2(tan.z, tan.x);
    this.scene.add(g);
  }
  _stands() {
    const n = this.track.N;
    const style=this.track.spec.venue;
    const places=style==='street'?[[.015,1,30],[.56,-1,28]]:
      style==='forest'?[[.02,1,72],[.48,-1,52],[.78,1,48]]:
      style==='stadium'?[[.02,1,86],[.08,-1,68],[.34,1,62],[.65,-1,70],[.83,1,54]]:
      style==='technical'?[[.02,1,74],[.25,-1,54],[.56,1,62],[.84,-1,54]]:
      [[.02,1,82],[.20,-1,62],[.53,1,72],[.82,-1,60]];
    for(let i=0;i<places.length;i++){
      if(this.quality==='low'&&i>1)break;
      if(this.quality==='medium'&&i>2)break;
      const [q,side,length]=places[i];this._stand(Math.floor(n*q),side,length);
    }
  }

  _cityscape() {
    const t=this.track,r=rng(2405),streetMat=[0xd9c8b0,0xc8d3d7,0xe0d8c8,0xb8c3c6,0xd4b7a9].map(color=>new THREE.MeshStandardMaterial({color,roughness:.92,flatShading:true}));
    const cv=document.createElement('canvas');cv.width=256;cv.height=512;const cx=cv.getContext('2d');cx.clearRect(0,0,256,512);cx.fillStyle='#435e70';
    for(let row=0;row<9;row++)for(let col=0;col<4;col++)cx.fillRect(18+col*59,16+row*54,31,32);
    const windowTexture=new THREE.CanvasTexture(cv);windowTexture.colorSpace=THREE.SRGBColorSpace;
    const windowMat=new THREE.MeshBasicMaterial({map:windowTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false});
    const step=Math.max(42,Math.floor(t.N/(this.quality==='high'?28:18)));
    for(const side of [-1,1]) for(let i=0;i<t.N;i+=step){
      const p=t.samples[i],tan=t.tangents[i],right=t.rights[i],width=22+r()*24,depth=16+r()*14,height=18+r()*40;
      const g=new THREE.Group(),wall=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),streetMat[Math.floor(r()*streetMat.length)]);
      wall.position.y=height/2;wall.castShadow=wall.receiveShadow=true;g.add(wall);
      const facadeZ=-side*(depth/2+.06);
      const windows=new THREE.Mesh(new THREE.PlaneGeometry(width*.88,height*.82),windowMat);windows.position.set(0,height*.52,facadeZ);g.add(windows);
      const awning=new THREE.Mesh(new THREE.BoxGeometry(width*.72,.6,1.4),new THREE.MeshStandardMaterial({color:[0xe3453c,0xeee8dc,0x307c98][Math.floor(r()*3)]}));
      awning.position.set(0,3.8,facadeZ-side*.6);g.add(awning);
      const offset=t.wallOffset+depth/2+8+r()*8;
      g.position.set(p.x+right.x*side*offset,0,p.z+right.z*side*offset);g.rotation.y=-Math.atan2(tan.z,tan.x);this.scene.add(g);
    }
    // Waterfront promenade and simple yacht silhouettes near the harbor-side sector.
    const i=Math.floor(t.N*.24),p=t.samples[i],right=t.rights[i];
    const water=new THREE.Mesh(new THREE.PlaneGeometry(250,145),new THREE.MeshStandardMaterial({color:0x28778f,roughness:.24,metalness:.25}));
    water.rotation.x=-Math.PI/2;water.position.set(p.x+right.x*(t.wallOffset+150),-.08,p.z+right.z*(t.wallOffset+150));this.scene.add(water);
    for(let n=0;n<5;n++){
      const boat=new THREE.Group(),hull=new THREE.Mesh(new THREE.BoxGeometry(13,1.5,3),new THREE.MeshStandardMaterial({color:n%2?0xf1eee4:0xd9e1e6}));hull.position.y=.7;boat.add(hull);
      const cabin=new THREE.Mesh(new THREE.BoxGeometry(5,2.6,2.5),new THREE.MeshStandardMaterial({color:0xf4f6f8}));cabin.position.set(-1,2.6,0);boat.add(cabin);
      boat.position.set(water.position.x-70+n*31,.02,water.position.z-40+(n%2)*30);boat.rotation.y=.4;this.scene.add(boat);
    }
  }

  _hills() {
    const t=this.track,r=rng(506),mat=[0x527b48,0x648952,0x78945a].map(color=>new THREE.MeshStandardMaterial({color,flatShading:true,roughness:1}));
    for(let i=0;i<22;i++){
      const s=t.samples[Math.floor(i/22*t.N)],right=t.rights[Math.floor(i/22*t.N)],side=i%2?1:-1;
      const hill=new THREE.Mesh(new THREE.IcosahedronGeometry(65+r()*110,1),mat[i%mat.length]);
      hill.scale.y=.45+r()*.35;hill.position.set(s.x+right.x*side*(145+r()*230),10+r()*24,s.z+right.z*side*(145+r()*230));this.scene.add(hill);
    }
  }

  _trackside() {
    const t=this.track, step=this.quality==='low'?Math.max(18,Math.floor(t.N/35)):this.quality==='medium'?Math.max(12,Math.floor(t.N/50)):Math.max(8,Math.floor(t.N/72));
    const postMat=new THREE.MeshStandardMaterial({color:0x58636a,metalness:.65,roughness:.45});
    const fenceMat=new THREE.MeshBasicMaterial({color:0xc6d1d5,transparent:true,opacity:.28});
    for(const side of [-1,1]) for(let i=0;i<t.N;i+=step){
      const p=t.samples[i], r=t.rights[i], off=t.width/2+3.5, x=p.x+r.x*side*off, z=p.z+r.z*side*off;
      const post=new THREE.Mesh(new THREE.BoxGeometry(.12,4.5,.12),postMat); post.position.set(x,2.25,z); this.scene.add(post);
      // BoxGeometry's length axis is X. Keep the fence rail parallel to the
      // local track tangent; the old Z-length box crossed the circuit at bends.
      const rail=new THREE.Mesh(new THREE.BoxGeometry(t.step*step*.94,3.5,.055),fenceMat); rail.position.set(x,3.1,z); rail.rotation.y=-Math.atan2(t.tangents[i].z,t.tangents[i].x); this.scene.add(rail);
    }
    const boards=[['150',.17],['100',.20],['50',.23]];
    for(const [label,q] of boards){const i=Math.floor(t.N*q),p=t.samples[i],r=t.rights[i];for(const side of [-1,1]){
      const canvas=document.createElement('canvas');canvas.width=128;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#f3f5f4';ctx.fillRect(0,0,128,96);ctx.fillStyle='#df2636';ctx.fillRect(0,0,128,12);ctx.fillRect(0,84,128,12);ctx.fillStyle='#111820';ctx.font='bold 50px Arial';ctx.textAlign='center';ctx.fillText(label,64,66);
      const tex=new THREE.CanvasTexture(canvas);const board=new THREE.Mesh(new THREE.PlaneGeometry(3.2,2.4),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));board.position.set(p.x+r.x*side*(t.width/2+5),2.2,p.z+r.z*side*(t.width/2+5));board.rotation.y=-Math.atan2(t.tangents[i].z,t.tangents[i].x);this.scene.add(board);
    }}
    const idx=Math.floor(t.N*.04),p=t.samples[idx],r=t.rights[idx];
    for(const side of [-1,1]){const lamp=new THREE.Group();const pole=new THREE.Mesh(new THREE.BoxGeometry(.45,18,.45),postMat);pole.position.y=9;lamp.add(pole);const head=new THREE.Mesh(new THREE.BoxGeometry(1.2,.5,1.2),new THREE.MeshBasicMaterial({color:0xfff4ce}));head.position.y=18;lamp.add(head);lamp.position.set(p.x+r.x*side*(t.width/2+34),0,p.z+r.z*side*(t.width/2+34));this.scene.add(lamp);}
  }

  _gantry() {
    const t = this.track, p = t.samples[0], tan = t.tangents[0], g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x15181d, flatShading: true });
    const w = t.width / 2 + 2;
    for (const z of [-w, w]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), mat); c.position.set(0, 4, z); c.castShadow = true; g.add(c); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, w * 2), new THREE.MeshStandardMaterial({ color: 0xe03a3e, flatShading: true }));
    beam.position.y = 8; beam.castShadow = true; g.add(beam);
    g.position.set(p.x, 0, p.z); g.rotation.y = -Math.atan2(tan.z, tan.x);
    this.scene.add(g);
  }

  _clouds() {
    const r = rng(99), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(30 + r() * 30, 0), mat); s.position.set(k * 40 - 60, r() * 10, r() * 30); s.scale.y = 0.5; c.add(s); }
      c.position.set(-1200 + r() * 2400, 260 + r() * 120, -1200 + r() * 2000); this.scene.add(c);
    }
  }
}
