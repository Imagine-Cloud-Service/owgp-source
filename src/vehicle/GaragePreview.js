import * as THREE from 'three';
import { buildCar } from './CarModel.js';

const palette = { primary: '#e03a3e', secondary: '#f4f6f8', helmet: '#ffc400', halo: '#20252c', rims: '#f4f6f8', number: 1 };

export class GaragePreview {
  constructor(container, livery = palette, quality = 'high') {
    this.container = container;
    this.livery = { ...palette, ...livery };
    this.quality = quality;
    this.focus = 'home';
    this.dragging = false;
    this.lastX = 0;
    this.yaw = -0.65;
    this.targetYaw = -0.65;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : 1.6));
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101820);
    this.scene.fog = new THREE.Fog(0x101820, 20, 46);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camPos = new THREE.Vector3(7.2, 2.8, 7.6);
    this.camTarget = new THREE.Vector3(0, 0.65, 0);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    // Brighter studio lighting so livery, rims, and halo pop
    this.scene.add(new THREE.HemisphereLight(0xdceeff, 0x222a34, 1.5));
    this.key = new THREE.SpotLight(0xffffff, 280, 40, Math.PI / 3.5, 0.45, 1.4);
    this.key.position.set(2, 11, 5);
    this.key.castShadow = quality !== 'low';
    this.scene.add(this.key, this.key.target);

    const rimLight = new THREE.PointLight(0x70c0ff, 95, 28);
    rimLight.position.set(-7, 4.5, -4);
    this.scene.add(rimLight);

    const fill = new THREE.PointLight(0xffb090, 55, 24);
    fill.position.set(7, 3, 5);
    this.scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 0.28, metalness: 0.55 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.025;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.turntable = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.45, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: 0x262d36, roughness: 0.3, metalness: 0.7 })
    );
    this.turntable.position.set(0, 0.02, 0);
    this.turntable.receiveShadow = true;
    this.scene.add(this.turntable);

    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.05, 0.032, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xe03a3e })
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.set(0, 0.11, 0);
    this.scene.add(this.ring);

    this._buildGarage();
    this.updateCar(this.livery);
    this._bindDrag();

    this.resizeHandler = () => this.resize();
    addEventListener('resize', this.resizeHandler);
    this.resize();
    this.running = false;
    this.last = 0;
  }

  _bindDrag() {
    const el = this.renderer.domElement;
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', e => {
      this.dragging = true;
      this.lastX = e.clientX;
      el.style.cursor = 'grabbing';
    });
    window.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      this.targetYaw += (e.clientX - this.lastX) * 0.01;
      this.lastX = e.clientX;
    });
    window.addEventListener('pointerup', () => {
      this.dragging = false;
      el.style.cursor = 'grab';
    });
  }

  setFocus(mode) {
    this.focus = mode;
    this.resize();
  }

  _buildGarage() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x171e26, roughness: 0.8, metalness: 0.18 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 0.6), wallMat); back.position.set(0, 5.7, -11); this.scene.add(back);
    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 12, 24), wallMat); sideL.position.set(-17, 5.7, 0); this.scene.add(sideL);
    const sideR = sideL.clone(); sideR.position.x = 17; this.scene.add(sideR);
    for (let i = 0; i < 5; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.045, 0.22), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xb9d7f0 : 0xffffff }));
      strip.position.set(-8 + i * 4, 10.6, -1.5); this.scene.add(strip);
    }
  }

  updateCar(livery) {
    if (this.car) {
      this.scene.remove(this.car.group);
      this.car.group.traverse(obj => {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => { m.map?.dispose(); m.dispose(); });
        else if (obj.material) { obj.material.map?.dispose(); obj.material.dispose(); }
      });
    }
    this.livery = { ...palette, ...livery };
    this.car = buildCar(this.livery);
    this.car.group.position.set(0, 0.14, 0);
    this.car.group.rotation.y = this.yaw;
    this.car.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.car.group);
  }

  setQuality(quality) {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'low' ? 1 : quality === 'medium' ? 1.3 : 1.8));
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.key.castShadow = quality === 'high';
    this.key.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
    this.key.shadow.needsUpdate = true;
  }

  resize() {
    const w = this.container.clientWidth || innerWidth;
    const h = this.container.clientHeight || innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;

    // Shift the 3D viewport center to the right on desktop so the left UI panel never covers the car
    if (w >= 760) {
      const shiftX = this.focus === 'garage' ? -w * 0.20 : -w * 0.14;
      this.camera.setViewOffset(w, h, shiftX, 0, w, h);
    } else {
      this.camera.clearViewOffset();
    }
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frameId = requestAnimationFrame(t => this.frame(t));
  }

  frame(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (!this.dragging) this.targetYaw += dt * 0.25;
    this.yaw += (this.targetYaw - this.yaw) * Math.min(1, dt * 8);
    this.turntable.rotation.y = this.yaw;
    if (this.car) this.car.group.rotation.y = this.yaw;

    const desiredPos = this.focus === 'garage'
      ? new THREE.Vector3(6.8, 2.55, 7.2)
      : new THREE.Vector3(8.4, 3.2, 9.2);
    const desiredTarget = new THREE.Vector3(0, 0.55, 0);

    const k = Math.min(1, dt * 5);
    this.camPos.lerp(desiredPos, k);
    this.camTarget.lerp(desiredTarget, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);

    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(t => this.frame(t));
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }
}