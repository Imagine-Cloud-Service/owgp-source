import * as THREE from 'three';

export class Track {
  constructor(spec) {
    this.spec = spec;
    this.width = spec.width || 13;
    this.wallOffset = spec.wallOffset || this.width * 0.85;
    this.pitLane = spec.pitLane || null;
    this.group = new THREE.Group();

    const scale = spec.scale || 1.0;
    const ctrl = spec.points.map(([x, y, z]) => new THREE.Vector3(x * scale, 0, z * scale));

    // 'centripetal' prevents spline loops & kinks on tight chicanes/hairpins
    this.curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
    this.length = this.curve.getLength();

    this.step = 2.0;
    this.N = Math.max(160, Math.round(this.length / this.step));
    this.samples = [];
    this.tangents = [];
    this.rights = [];

    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < this.N; i++) {
      const t = i / this.N;
      const p = this.curve.getPointAt(t);
      p.y = 0;
      const tan = this.curve.getTangentAt(t);
      tan.y = 0;
      tan.normalize();
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      this.samples.push(p);
      this.tangents.push(tan);
      this.rights.push(right);
    }

    this._buildRoad();
    this._buildKerbs();
    this._buildWalls();
    this._buildStartLine();
  }

  _buildRibbon(halfWidth, yOffset, material, repeatU = 1) {
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= this.N; i++) {
      const idx = i % this.N;
      const p = this.samples[idx];
      const r = this.rights[idx];

      positions.push(
        p.x - r.x * halfWidth, yOffset, p.z - r.z * halfWidth,
        p.x + r.x * halfWidth, yOffset, p.z + r.z * halfWidth
      );
      const v = (i / this.N) * (this.length / 8) * repeatU;
      uvs.push(0, v, 1, v);

      if (i < this.N) {
        const b = i * 2;
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
  }

  _buildRoad() {
    this.asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.88,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.group.add(this._buildRibbon(this.width / 2, 0.01, this.asphaltMat));
  }

  _buildKerbs() {
    const kerbCanvas = document.createElement('canvas');
    kerbCanvas.width = 64;
    kerbCanvas.height = 64;
    const ctx = kerbCanvas.getContext('2d');
    ctx.fillStyle = '#d92626';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 32, 64, 32);

    const tex = new THREE.CanvasTexture(kerbCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;

    const kerbMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.72,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const kW = this.spec.kerb || 1.4;
    const half = this.width / 2;

    [-1, 1].forEach((side) => {
      const positions = [];
      const uvs = [];
      const indices = [];
      for (let i = 0; i <= this.N; i++) {
        const idx = i % this.N;
        const p = this.samples[idx];
        const r = this.rights[idx];
        const inner = side * half;
        const outer = side * (half + kW);
        positions.push(
          p.x + r.x * inner, 0.025, p.z + r.z * inner,
          p.x + r.x * outer, 0.04, p.z + r.z * outer
        );
        const v = (i / this.N) * (this.length / 4);
        uvs.push(0, v, 1, v);
        if (i < this.N) {
          const b = i * 2;
          if (side > 0) indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
          else indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      this.group.add(new THREE.Mesh(geo, kerbMat));
    });
  }

  _buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: this.spec.theme === 'city' ? 0xc8ccd0 : 0x8d959e,
      roughness: 0.65,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    const h = this.spec.theme === 'city' ? 1.35 : 1.05;

    [-1, 1].forEach((side) => {
      const positions = [];
      const indices = [];
      for (let i = 0; i <= this.N; i++) {
        const idx = i % this.N;
        const p = this.samples[idx];
        const r = this.rights[idx];
        const wx = p.x + r.x * side * this.wallOffset;
        const wz = p.z + r.z * side * this.wallOffset;
        positions.push(wx, 0, wz, wx, h, wz);
        if (i < this.N) {
          const b = i * 2;
          indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      this.group.add(new THREE.Mesh(geo, wallMat));
    });
  }

  _buildStartLine() {
    const p = this.samples[0];
    const tan = this.tangents[0];
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, this.width),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      })
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = -Math.atan2(tan.z, tan.x);
    line.position.set(p.x, 0.035, p.z);
    this.group.add(line);
  }

  setWetness(wetness = 0) {
    if (!this.asphaltMat) return;
    this.asphaltMat.roughness = THREE.MathUtils.lerp(0.88, 0.22, wetness);
    this.asphaltMat.metalness = THREE.MathUtils.lerp(0.08, 0.45, wetness);
  }

  query(x, z, hint = -1) {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hint >= 0 && hint < this.N) {
      for (let offset = -18; offset <= 18; offset++) {
        const i = (hint + offset + this.N) % this.N;
        const p = this.samples[i];
        const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      }
    }

    if (bestDistSq > 900) {
      for (let i = 0; i < this.N; i++) {
        const p = this.samples[i];
        const d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      }
    }

    const p = this.samples[bestIdx];
    const r = this.rights[bestIdx];
    const lateral = (x - p.x) * r.x + (z - p.z) * r.z;

    return {
      index: bestIdx,
      s: (bestIdx / this.N) * this.length,
      lateral,
      right: r,
      y: 0,
    };
  }
}