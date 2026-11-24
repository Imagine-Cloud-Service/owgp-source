import * as THREE from 'three';

const MODES = [
  { name: 'COCKPIT', localPos: new THREE.Vector3(-0.08, 0.78, 0), lookAhead: new THREE.Vector3(14, 0.65, 0), smooth: 0 },
  { name: 'T-CAM',   localPos: new THREE.Vector3(-0.55, 1.38, 0), lookAhead: new THREE.Vector3(18, 0.75, 0), smooth: 0.05 },
  { name: 'CHASE',   localPos: new THREE.Vector3(-5.8,  2.15, 0), lookAhead: new THREE.Vector3(8,  0.85, 0), smooth: 0.12 },
  { name: 'NOSE',    localPos: new THREE.Vector3(1.55,  0.52, 0), lookAhead: new THREE.Vector3(22, 0.45, 0), smooth: 0 },
];

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

export class CameraRig {
  constructor(camera, horizontalFov = 70, gForceScale = 1) {
    this.camera = camera;
    this.horizontalFov = horizontalFov;
    this.gForceScale = gForceScale;
    this.index = 0;
    this.hideCenterPillar = false;
    this.snap = true;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.transition = {
      active: false,
      elapsed: 0,
      duration: 0.45,
      fromPos: new THREE.Vector3(),
      fromLook: new THREE.Vector3(),
    };
  }

  get name() {
    return MODES[this.index].name;
  }

  toggle() {
    this.transition.active = true;
    this.transition.elapsed = 0;
    this.transition.fromPos.copy(this.pos);
    this.transition.fromLook.copy(this.look);
    this.index = (this.index + 1) % MODES.length;
  }

  toggleHalo() {
    this.hideCenterPillar = !this.hideCenterPillar;
  }

  _applyFov(drs) {
    const hFov = THREE.MathUtils.degToRad(Math.max(45, this.horizontalFov) + (drs ? 3 : 0));
    const vFov = 2 * Math.atan(Math.tan(hFov / 2) / Math.max(0.5, this.camera.aspect));
    const targetDeg = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(vFov), 35, 95);
    if (Math.abs(this.camera.fov - targetDeg) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetDeg, 0.15);
      this.camera.updateProjectionMatrix();
    }
  }

  update(dt, s, car, { drs = false } = {}) {
    const mode = MODES[this.index];
    this._applyFov(drs);

    const settledCockpit = mode.name === 'COCKPIT' && (!this.transition.active || this.transition.elapsed > this.transition.duration * 0.65);
    if (car.helmetPivot) car.helmetPivot.visible = !settledCockpit;
    if (car.haloCenterPillar) car.haloCenterPillar.visible = !(settledCockpit && this.hideCenterPillar);

    const c = Math.cos(s.th);
    const n = Math.sin(s.th);
    const toWorld = v => new THREE.Vector3(s.x + v.x * c - v.z * n, v.y, s.z + v.x * n + v.z * c);

    const localOffset = mode.localPos.clone();
    if (mode.name === 'COCKPIT') {
      const latG = THREE.MathUtils.clamp((s.ay || 0) / 9.81, -3, 3);
      localOffset.z -= latG * 0.018 * this.gForceScale;
    }

    const desiredPos = toWorld(localOffset);
    const desiredLook = toWorld(mode.lookAhead);

    if (this.snap) {
      this.pos.copy(desiredPos);
      this.look.copy(desiredLook);
      this.transition.active = false;
      this.snap = false;
    } else if (this.transition.active) {
      this.transition.elapsed += dt;
      const t = Math.min(1, this.transition.elapsed / this.transition.duration);
      const k = easeOutCubic(t);
      this.pos.lerpVectors(this.transition.fromPos, desiredPos, k);
      this.look.lerpVectors(this.transition.fromLook, desiredLook, k);
      if (t >= 1) this.transition.active = false;
    } else if (mode.smooth === 0) {
      this.pos.copy(desiredPos);
      this.look.copy(desiredLook);
    } else {
      const alpha = 1 - Math.exp(-dt / mode.smooth);
      this.pos.lerp(desiredPos, alpha);
      this.look.lerp(desiredLook, alpha);
    }

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}