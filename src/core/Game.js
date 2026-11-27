import * as THREE from 'three';
import { STEP, TRACK, TRACKS, RACE, WEATHER, ERS, TYRES, PHYSICS } from '../config.js';
import { CarPhysics } from '../physics/CarPhysics.js';
import { Track } from '../world/Track.js';
import { Environment } from '../world/Environment.js';
import { buildCar, buildSafetyCar, poseCar } from '../vehicle/CarModel.js';
import { CameraRig } from '../camera/CameraRig.js';
import { Input } from './Input.js';
import { HUD, fmt } from '../ui/HUD.js';
import { EngineAudio } from '../audio/EngineAudio.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const TEAM_COLORS = [
  { primary: '#28b7d2', secondary: '#f5f2e9', helmet: '#ffcc39', number: 11, sponsor: 'VOLT' },
  { primary: '#e54b45', secondary: '#20252c', helmet: '#ece5d8', number: 16, sponsor: 'APEX' },
  { primary: '#ebbf3c', secondary: '#20252c', helmet: '#e84c43', number: 4, sponsor: 'TURBO' },
  { primary: '#8b6ee8', secondary: '#f5f2e9', helmet: '#64ce93', number: 63, sponsor: 'AEROX' },
  { primary: '#47a76a', secondary: '#20252c', helmet: '#f2e4b8', number: 14, sponsor: 'APEX' },
];

export class Game {
  constructor(container, setup) {
    this.setup = { laps: 3, fuelKg: 40, tyre: 'medium', horizontalFov: 45, startMode: 'grid', ...setup };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const qualityScale = { low: 1, medium: 1.35, high: 1.8 }[this.setup.quality] || 1.8;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, qualityScale));
    this.renderer.shadowMap.enabled = this.setup.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.3, 4000);
    this.track = new Track(TRACKS[this.setup.track] || TRACK);
    this.scene.add(this.track.group);
    this.env = new Environment(this.scene, this.track, this.setup.quality);
    this.weather = { wetness: WEATHER[this.setup.weather] ?? 0 };
    this.env.setWeather?.(this.weather.wetness);
    this.track.setWetness(this.weather.wetness);

    this.car = buildCar(this.setup.livery);
    this.scene.add(this.car.group);
    this.physics = new CarPhysics(this.setup.fuelKg);
    this.ai = this.createOpponents();
    this.safetyCarVisual = buildSafetyCar();
    this.safetyCarVisual.group.visible = false;
    this.scene.add(this.safetyCarVisual.group);
    this.safetyCarPhysics = new CarPhysics(1350);

    this.input = new Input(this.setup);
    this.rig = new CameraRig(this.camera, this.setup.horizontalFov, this.setup.gForce ?? 1);
    document.getElementById('touchControls').style.display = this.setup.controlsMode === 'keyboard' ? 'none' : '';
    this.hud = new HUD(this.track);
    this.audio = new EngineAudio({ volume: this.setup.audioVolume ?? 0.65, muted: this.setup.audioMuted ?? false });

    this.acc = 0;
    this.last = performance.now();
    this.frameId = 0;
    this.prevMode = 'racing';
    this.resizeHandler = () => this.resize();
    addEventListener('resize', this.resizeHandler);
    this.resize();
    this.resetToGrid(this.setup.startMode === 'pitlane');
  }

  createOpponents() {
    const drivers = ['M. Riva', 'A. Novak', 'J. Kim', 'L. Sato', 'E. Silva'];
    const maxLane = Math.min(3.6, this.track.width * 0.28);
    const baseLanes = [-maxLane, maxLane, -maxLane * 0.85, maxLane * 0.85, 0];
    return drivers.map((name, i) => {
      const car = buildCar(TEAM_COLORS[i]);
      this.scene.add(car.group);
      const physics = new CarPhysics(28);
      return {
        name,
        car,
        physics,
        baseLane: baseLanes[i],
        lane: baseLanes[i],
        targetLane: baseLanes[i],
        pace: [0.95, 0.99, 0.92, 1.02, 0.97][i],
        hint: -1,
        previousS: null,
        sectorsHit: 0,
        completedLaps: 0,
        progress: 0,
        tyreWear: 0,
        stuckTimer: 0,
        drs: false,
      };
    });
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  resetToGrid(fromPitlane = false) {
    const start = this.track.N - 7, p = this.track.samples[start], t = this.track.tangents[start];
    if (fromPitlane && this.track.pitLane) {
      const pitIdx = Math.floor(this.track.pitLane.box * this.track.N) % this.track.N;
      const pp = this.track.samples[pitIdx], pr = this.track.rights[pitIdx], pt = this.track.tangents[pitIdx];
      this.physics.reset(pp.x + pr.x * this.track.pitLane.offset, pp.z + pr.z * this.track.pitLane.offset, Math.atan2(pt.z, pt.x));
      this.hint = pitIdx;
      this.hud?.toast('PITLANE START · PENALTY APPLIED', 2200);
    } else {
      this.physics.reset(p.x, p.z, Math.atan2(t.z, t.x));
      this.hint = start;
    }

    const spacing = Math.max(10, Math.min(14, this.track.length / 60));
    this.ai.forEach((driver, i) => {
      const index = (start - Math.floor((i + 1) * spacing / this.track.step) + this.track.N) % this.track.N;
      const q = this.track.samples[index], r = this.track.rights[index], tangent = this.track.tangents[index];
      driver.lane = driver.baseLane;
      driver.targetLane = driver.baseLane;
      driver.physics.reset(q.x + r.x * driver.lane, q.z + r.z * driver.lane, Math.atan2(tangent.z, tangent.x));
      driver.hint = index;
      driver.previousS = null;
      driver.sectorsHit = 0;
      driver.completedLaps = 0;
      driver.progress = -((i + 1) * spacing);
      driver.tyreWear = 0;
      driver.stuckTimer = 0;
      driver.drs = false;
    });

    this.mode = 'countdown'; this.prevMode = 'countdown';
    this.t = 0; this.raceTime = 0; this.lapStart = 0;
    this.lap = 1; this.lastLap = null; this.bestLap = null; this.sectorsHit = 0; this.prevS = null; this.sector = 0;
    this.pitTimer = 0; this.pitUsed = false; this.pitCompound = this.setup.tyre;
    this.pitMiniGame = { active: false, cursor: 0, dir: 1 };
    document.getElementById('pitMiniGame')?.classList.add('gone');

    this.fuelKg = this.setup.fuelKg;
    this.physics.mass = PHYSICS.m + this.fuelKg;
    this.fuelWarning = false;
    this.tyre = this.setup.tyre; this.tyreWear = 0;
    this.ersMJ = ERS.capacityMJ; this.ersEnabled = false;
    this.drsEnabled = false; this.drsAllowed = false;
    this.safetyCarTimer = 0; this.safetyCarLaps = 0;
    this.trackWarnings = 0; this.limitOutsideTime = 0; this.limitArmed = true; this.timePenalty = 0;

    // Component Damage & Sector Weather + Aquaplaning Puddles
    this.damage = 0;
    this.damageParts = { frontWing: 0, sidepod: 0, floor: 0, suspension: 0 };
    this.sectorWetness = [this.weather.wetness, this.weather.wetness * 0.5, this.weather.wetness];
    this.puddles = Array.from({ length: 6 }, (_, i) => ({
      s: ((i + 0.5) / 6) * this.track.length,
      lateral: (i % 2 ? 1 : -1) * (this.track.width * 0.22),
      radius: 6.5,
    }));

    this.collisionCooldown = 0; this.lastContact = 0; this.pitLimiter = false; this.pitLaneS = null;
    this.safetyCarVisual.group.visible = false;
    this.hud?.setRaceInfo({ weather: this.setup.weather, laps: this.setup.laps, track: this.track.spec.name, driver: this.setup.driver, team: this.setup.team });
  }

  start() { this.audio.start(); this.hud.show(); this.rig.snap = true; this.frameId = requestAnimationFrame(t => this.frame(t)); }

  restart() {
    document.getElementById('finishMenu').classList.add('gone');
    document.getElementById('pauseMenu').classList.add('gone');
    this.resetToGrid(this.setup.startMode === 'pitlane');
    this.hud.show();
    this.last = performance.now();
    this.acc = 0;
  }

  stop() {
    cancelAnimationFrame(this.frameId);
    this.audio.stop();
    removeEventListener('resize', this.resizeHandler);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  togglePause() {
    const settingsOpen = !document.getElementById('menu')?.classList.contains('gone');
    if (settingsOpen) return;

    if (this.mode === 'paused') {
      this.resume();
    } else if (this.mode === 'racing' || this.mode === 'countdown') {
      this.prevMode = this.mode;
      this.mode = 'paused';
      document.getElementById('pauseMenu')?.classList.remove('gone');
    }
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = this.prevMode || 'racing';
    document.getElementById('pauseMenu')?.classList.add('gone');
    document.getElementById('menu')?.classList.add('gone');
    document.getElementById('hud').hidden = false;
    this.last = performance.now();
  }

  frame(now) {
    this.frameId = requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.input.poll(dt);
    if (this.input.pressed('KeyP') || this.input.pressed('Escape')) this.togglePause();
    if (this.input.pressed('KeyM')) this.requestPit();
    if (this.input.toggleCamera()) this.rig.toggle();
    if (this.input.toggleHalo()) { this.rig.toggleHalo(); this.hud.toast(this.rig.hideCenterPillar ? 'Halo center pillar hidden' : 'Halo center pillar visible'); }
    if (this.input.toggleERS()) { this.ersEnabled = !this.ersEnabled; this.hud.toast(this.ersEnabled ? 'ERS deployment armed' : 'ERS deployment off'); }
    if (this.input.toggleDRS()) {
      if (this.drsAllowed) { this.drsEnabled = !this.drsEnabled; this.hud.toast(this.drsEnabled ? 'DRS open' : 'DRS closed'); }
      else this.hud.toast('DRS unavailable: zone or gap condition not met');
    }
    if (this.input.reset()) this.recover();
    this.acc += dt;
    for (let n = 0; this.acc >= STEP && n < 12; n++, this.acc -= STEP) this.update(STEP);
    this.render(dt);
    this.input.endFrame();
  }

  update(dt) {
    if (this.mode === 'paused' || this.mode === 'finished') return;
    this.t += dt;
    let cmd = { throttle: this.input.throttle, brake: this.input.brake, steer: this.input.steer };

    if (this.mode === 'countdown') {
      cmd = { throttle: 0, brake: 1, steer: 0 };
      const lit = Math.min(5, Math.floor(this.t - 0.5));
      if (this.t > 6.2) { this.mode = 'racing'; this.hud.lights(0, false); this.hud.toast('Go!', 900); }
      else this.hud.lights(Math.max(0, lit), true);
    } else {
      this.raceTime += dt;
      if (this.setup.weather === 'changeable') {
        this.sectorWetness = [
          clamp(0.35 + Math.sin(this.raceTime * 0.04) * 0.35, 0, 0.8),
          clamp(0.35 + Math.sin(this.raceTime * 0.04 + 2.1) * 0.35, 0, 0.8),
          clamp(0.35 + Math.sin(this.raceTime * 0.04 + 4.2) * 0.35, 0, 0.8),
        ];
        const currentWet = this.sectorWetness[this.sector] ?? this.weather.wetness;
        if (Math.abs(currentWet - this.weather.wetness) > 0.015) {
          this.weather.wetness = currentWet;
          this.env.setWeather(currentWet);
          this.track.setWetness(currentWet);
        }
      }
      if (this.safetyCarTimer > 0) {
        this.safetyCarTimer = Math.max(0, this.safetyCarTimer - dt);
        if (!this.safetyCarTimer) { this.hud.toast('Safety car in this lap'); this.safetyCarLaps = 0; }
      }
      if (this.collisionCooldown > 0) this.collisionCooldown -= dt;

      // Manual Pitstop Mini-Game
      if (this.pitMiniGame.active) {
        cmd = { throttle: 0, brake: 1, steer: 0 };
        this.pitMiniGame.cursor += this.pitMiniGame.dir * dt * 1.45;
        if (this.pitMiniGame.cursor >= 1 || this.pitMiniGame.cursor <= 0) this.pitMiniGame.dir *= -1;
        const el = document.getElementById('pitCursor');
        if (el) el.style.left = `${clamp(this.pitMiniGame.cursor, 0, 0.96) * 100}%`;
        if (this.input.pressed('Space')) {
          const perfect = this.pitMiniGame.cursor >= 0.42 && this.pitMiniGame.cursor <= 0.58;
          this.pitMiniGame.active = false;
          document.getElementById('pitMiniGame')?.classList.add('gone');
          this.pitTimer = perfect ? 2.1 : 4.8;
          this.hud.toast(perfect ? 'PERFECT PITSTOP · 2.1s!' : 'SLOW STOP · 4.8s', 1600);
        }
      } else if (this.pitTimer > 0) {
        this.pitTimer = Math.max(0, this.pitTimer - dt);
        cmd = { throttle: 0, brake: 1, steer: 0 };
        if (!this.pitTimer) {
          this.tyre = this.pitCompound;
          this.tyreWear = 0;
          this.damage = 0;
          this.damageParts = { frontWing: 0, sidepod: 0, floor: 0, suspension: 0 };
          this.hud.toast(`Pit service complete · ${this.tyre.toUpperCase()} tyres fitted`);
        }
      }
    }

    const s = this.physics.s, info = this.track.query(s.x, s.z, this.hint);
    this.hint = info.index;
    this.updateTrackLimits(dt, info);
    this.pitLaneS = this.inPitLane(info) ? info.s : null;
    this.pitLimiter = this.pitLaneS !== null;
    if (this.pitLimiter && this.physics.speed > RACE.pitSpeedKmh / 3.6) { cmd.throttle = 0; cmd.brake = Math.max(cmd.brake, 0.65); }
    if (this.safetyCarTimer > 0) {
      cmd.throttle = Math.min(cmd.throttle, this.physics.speed > 22 ? 0 : 0.2);
      if (this.physics.speed > 23) cmd.brake = Math.max(cmd.brake, 0.55);
      this.drsEnabled = false;
    }

    this.drsAllowed = this.checkDrs(info.s);
    if (!this.drsAllowed) this.drsEnabled = false;
    if (this.fuelKg <= 0) cmd.throttle = 0;

    // Apply realistic component damage effects
    cmd.throttle *= Math.max(0.3, 1 - this.damage * 0.4 - this.damageParts.floor * 0.25);
    cmd.steer = cmd.steer * Math.max(0.45, 1 - this.damageParts.frontWing * 0.35) + this.damageParts.suspension * 0.1;

    cmd.drs = this.drsEnabled;
    cmd.ersPower = this.ersEnabled && this.ersMJ > 0 && cmd.throttle > 0 ? ERS.deploymentKW * 1000 : 0;
    const grip = this.surfaceGrip(info.lateral, this.tyreWear, this.tyre, info.s, true);
    const beforeDistance = this.physics.speed * dt;
    this.physics.step(dt, cmd, { grip });
    this.updateStrategy(dt, beforeDistance, cmd);
    this.handleBarrier(this.physics, info);
    this.updateOpponents(dt);
    if (this.safetyCarTimer > 0) this.updateSafetyCar(dt);
    this.resolveCarCollisions();
    this.laps(info.s);
  }

  surfaceGrip(lateral, wear = 0, tyre = 'medium', sDist = 0, isPlayer = false) {
    const off = Math.abs(lateral), half = this.track.width / 2;
    let grip = off < half ? 1 : off < half + this.track.spec.kerb ? 0.95 : 0.55;
    const sec = Math.min(2, Math.floor((sDist / this.track.length) * 3));
    const localWet = this.sectorWetness?.[sec] ?? this.weather.wetness;

    // Aquaplaning puddle check
    if (isPlayer && localWet > 0.35 && this.puddles?.some(p => Math.abs(p.s - sDist) < p.radius && Math.abs(p.lateral - lateral) < 2.6)) {
      if (this.physics.speed > 42) {
        this.physics.s.r += (Math.random() - 0.5) * 0.16;
        return 0.22;
      }
    }

    return Math.max(0.2, grip * (1 - 0.38 * localWet) * TYRES[tyre].grip * (1 - wear / 100 * 0.38));
  }

  inPitLane(info) {
    const p = this.track.pitLane, q = info.s / this.track.length;
    return p && q >= p.start && q <= p.end && info.lateral >= p.offset - p.width / 2 && info.lateral <= p.offset + p.width / 2;
  }

  checkDrs(distance) {
    return this.isDrsEligible(distance, (this.lap - 1) * this.track.length + distance, this.physics.speed, this.ai);
  }

  isDrsEligible(distance, progress, speed, pack) {
    if (this.safetyCarTimer > 0 || this.weather.wetness > 0.62 || this.setup.weather === 'wet') return false;
    const q = distance / this.track.length;
    const inZone = this.track.spec.drsZones?.some(([a, b]) => q >= a && q <= b);
    if (!inZone || speed < 30) return false;
    const gap = Math.min(...pack.filter(driver => driver.progress > progress).map(driver => driver.progress - progress), Infinity);
    return gap <= speed;
  }

  updateTrackLimits(dt, info) {
    const outside = Math.abs(info.lateral) > this.track.width / 2 + this.track.spec.kerb + 0.2 && !this.inPitLane(info);
    if (outside) { this.limitOutsideTime += dt; return; }
    if (this.limitOutsideTime > 0.65 && this.limitArmed && this.mode === 'racing') {
      this.trackWarnings++; this.limitArmed = false;
      if (this.trackWarnings <= 3) this.hud.toast(`Track limits warning ${this.trackWarnings}/3`, 1400);
      else { this.timePenalty += 5; this.hud.toast('5 second track-limits penalty', 1800); }
    }
    if (!outside) { this.limitOutsideTime = 0; this.limitArmed = true; }
  }

  updateStrategy(dt, distance, cmd) {
    const fuelRate = 0.035 + cmd.throttle * 0.12 + this.physics.speed * 0.0005;
    this.fuelKg = Math.max(0, this.fuelKg - fuelRate * dt);
    this.physics.mass = PHYSICS.m + this.fuelKg;
    if (this.fuelKg < 5 && !this.fuelWarning) { this.fuelWarning = true; this.hud.toast('Low fuel · manage throttle'); }
    if (this.ersEnabled && cmd.ersPower > 0) this.ersMJ = Math.max(0, this.ersMJ - (cmd.ersPower / 1000) * dt / 1000);
    else this.ersMJ = Math.min(ERS.capacityMJ, this.ersMJ + cmd.brake * ERS.regenKW * dt / 1000);
    if (this.ersMJ <= 0.001) this.ersEnabled = false;
    const wearRate = TYRES[this.tyre].wear * (this.weather.wetness > 0.6 ? 0.68 : 1);
    this.tyreWear = clamp(this.tyreWear + distance * 0.0012 * wearRate * (1 + Math.min(2, Math.abs(this.physics.s.ay) / 9.81) * 0.28), 0, 100);
  }

  applyDamage(impactSpeed) {
    const hit = Math.min(0.25, impactSpeed * 0.004);
    this.damageParts.frontWing = clamp(this.damageParts.frontWing + hit, 0, 1);
    this.damageParts.sidepod = clamp(this.damageParts.sidepod + hit * 0.7, 0, 1);
    this.damageParts.floor = clamp(this.damageParts.floor + hit * 0.6, 0, 1);
    this.damageParts.suspension = clamp(this.damageParts.suspension + hit * 0.45, 0, 1);
    this.damage = clamp((this.damageParts.frontWing + this.damageParts.sidepod + this.damageParts.floor + this.damageParts.suspension) / 4, 0, 0.85);
  }

  handleBarrier(physics, info) {
    const off = Math.abs(info.lateral), wall = this.track.wallOffset;
    if (off > wall) {
      const sign = Math.sign(info.lateral), over = off - wall, s = physics.s;
      const normalX = info.right.x * sign, normalZ = info.right.z * sign, velocity = this.worldVelocity(physics);
      const impactSpeed = Math.max(0, velocity.x * normalX + velocity.z * normalZ);
      s.x -= info.right.x * sign * over; s.z -= info.right.z * sign * over;
      physics.collide(normalX, normalZ);
      if (physics === this.physics && impactSpeed > 10 && this.collisionCooldown <= 0) {
        this.collisionCooldown = 1.6;
        this.applyDamage(impactSpeed);
        this.input.forceFeedback(0, Math.min(1, impactSpeed / 28));
        this.deploySafetyCar(impactSpeed);
      }
    }
  }

  resolveCarCollisions() {
    const cars = [{ physics: this.physics, player: true }, ...this.ai.map(driver => ({ physics: driver.physics, player: false }))];
    const radius = RACE.carHitRadius;
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i].physics, b = cars[j].physics, sa = a.s, sb = b.s;
      let dx = sa.x - sb.x, dz = sa.z - sb.z, dist = Math.hypot(dx, dz);
      if (dist >= radius) continue;
      if (dist < 1e-4) { dx = 1; dz = 0; dist = 1; }
      const nx = dx / dist, nz = dz / dist, overlap = radius - dist;
      sa.x += nx * overlap * 0.51; sa.z += nz * overlap * 0.51;
      sb.x -= nx * overlap * 0.49; sb.z -= nz * overlap * 0.49;
      const va = this.worldVelocity(a), vb = this.worldVelocity(b);
      const closing = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
      if (closing >= 0) continue;
      const restitution = 0.28, impulse = -(1 + restitution) * closing / (1 / a.mass + 1 / b.mass);
      va.x += impulse * nx / a.mass; va.z += impulse * nz / a.mass;
      vb.x -= impulse * nx / b.mass; vb.z -= impulse * nz / b.mass;
      this.setWorldVelocity(a, va); this.setWorldVelocity(b, vb);
      sa.r += (nz * 0.12); sb.r -= (nz * 0.12);
      const impact = Math.abs(closing);
      if (cars[i].player || cars[j].player) {
        this.applyDamage(impact);
        if (impact > 1.5) this.input.forceFeedback(0, Math.min(1, impact / 22));
        if (impact > 8 && this.collisionCooldown <= 0) {
          this.collisionCooldown = 1.6;
          this.hud.toast(`Car contact · wing/floor damage`, 1300);
          this.deploySafetyCar(impact);
        }
      }
    }
  }

  worldVelocity(physics) {
    const s = physics.s, c = Math.cos(s.th), n = Math.sin(s.th);
    return { x: s.vx * c - s.vy * n, z: s.vx * n + s.vy * c };
  }

  setWorldVelocity(physics, v) {
    const s = physics.s, c = Math.cos(s.th), n = Math.sin(s.th);
    s.vx = v.x * c + v.z * n; s.vy = -v.x * n + v.z * c;
  }

  deploySafetyCar(impact) {
    if (impact < 13 || this.safetyCarTimer > 0 || this.mode !== 'racing') return;
    this.safetyCarTimer = RACE.safetyCarSeconds; this.safetyCarLaps++;
    const info = this.track.query(this.physics.s.x, this.physics.s.z, this.hint);
    const ahead = (info.index + Math.max(10, Math.floor(350 / this.track.step))) % this.track.N;
    const point = this.track.samples[ahead], tangent = this.track.tangents[ahead];
    this.safetyCarPhysics.reset(point.x, point.z, Math.atan2(tangent.z, tangent.x)); this.safetyHint = ahead;
    this.safetyCarVisual.group.visible = true;
    this.drsEnabled = false;
    this.hud.toast('SAFETY CAR DEPLOYED · HOLD PACE', 2600);
  }

  updateSafetyCar(dt) {
    const s = this.safetyCarPhysics.s, info = this.track.query(s.x, s.z, this.safetyHint); this.safetyHint = info.index;
    const targetIndex = (info.index + Math.max(5, Math.floor(38 / this.track.step))) % this.track.N;
    const target = this.track.samples[targetIndex], desired = Math.atan2(target.z - s.z, target.x - s.x);
    const error = angleDelta(desired, s.th), speed = this.safetyCarPhysics.speed, targetSpeed = 24;
    this.safetyCarPhysics.step(dt, {
      steer: clamp(error * 1.8 - s.r * 0.24, -0.75, 0.75),
      throttle: clamp((targetSpeed - speed) * 0.28, 0, 0.7),
      brake: clamp((speed - targetSpeed - 1) * 0.3, 0, 1),
    }, { grip: this.surfaceGrip(info.lateral, 0, 'medium', info.s) });
  }

  _cornerSpeedLimit(index, grip) {
    const N = this.track.N, step = this.track.step;
    let maxCurvature = 0;
    for (const dist of [35, 70, 110]) {
      const i1 = (index + Math.floor(dist / step)) % N;
      const i2 = (index + Math.floor((dist + 18) / step)) % N;
      const t1 = this.track.tangents[i1], t2 = this.track.tangents[i2];
      const dTheta = Math.abs(angleDelta(Math.atan2(t2.z, t2.x), Math.atan2(t1.z, t1.x)));
      const curvature = dTheta / 18;
      if (curvature > maxCurvature) maxCurvature = curvature;
    }
    if (maxCurvature < 0.003) return 92;
    return clamp(Math.sqrt((grip * 14.5) / maxCurvature), 20, 92);
  }

  updateOpponents(dt) {
    const L = this.track.length;
    const safeLaneLimit = Math.max(1.2, this.track.width * 0.34);
    const playerInfo = this.track.query(this.physics.s.x, this.physics.s.z, this.hint);
    const allCars = [
      { s: playerInfo.s, lateral: playerInfo.lateral, speed: this.physics.speed, ref: null },
      ...this.ai.map(d => {
        const di = this.track.query(d.physics.s.x, d.physics.s.z, d.hint);
        return { s: di.s, lateral: di.lateral, speed: d.physics.speed, ref: d };
      }),
    ];

    for (const driver of this.ai) {
      const phys = driver.physics, s = phys.s;
      const info = this.track.query(s.x, s.z, driver.hint);
      driver.hint = info.index;

      if (this.mode === 'racing') {
        if (phys.speed < 2.5) driver.stuckTimer += dt;
        else driver.stuckTimer = 0;
        if (driver.stuckTimer > 2.2) {
          const recIdx = (info.index + 2) % this.track.N;
          const rp = this.track.samples[recIdx], rt = this.track.tangents[recIdx];
          phys.reset(rp.x, rp.z, Math.atan2(rt.z, rt.x));
          phys.s.vx = 10;
          driver.stuckTimer = 0;
          driver.lane = 0;
          driver.targetLane = 0;
        }
      }

      let desiredLane = driver.baseLane;
      let aheadSpeedCap = Infinity;
      for (const other of allCars) {
        if (other.ref === driver) continue;
        let ds = other.s - info.s;
        if (ds < -L * 0.5) ds += L;
        if (ds > 2 && ds < 24 && Math.abs(other.lateral - info.lateral) < 2.8) {
          const passDir = other.lateral >= 0 ? -1 : 1;
          desiredLane = clamp(other.lateral + passDir * 3.4, -safeLaneLimit, safeLaneLimit);
          if (ds < 10 && Math.abs(other.lateral - info.lateral) < 2.1) {
            aheadSpeedCap = Math.min(aheadSpeedCap, other.speed + 1.5);
          }
        }
      }
      driver.targetLane = clamp(desiredLane, -safeLaneLimit, safeLaneLimit);
      driver.lane += (driver.targetLane - driver.lane) * Math.min(1, dt * 3.2);

      const lookDist = clamp(16 + phys.speed * 0.36, 16, 48);
      const targetIndex = (info.index + Math.max(4, Math.floor(lookDist / this.track.step))) % this.track.N;
      const target = this.track.samples[targetIndex], right = this.track.rights[targetIndex];
      const tx = target.x + right.x * driver.lane, tz = target.z + right.z * driver.lane;
      const desiredHeading = Math.atan2(tz - s.z, tx - s.x);
      const error = angleDelta(desiredHeading, s.th);

      const grip = this.surfaceGrip(info.lateral, driver.tyreWear, 'medium', info.s);
      const cornerLimit = this._cornerSpeedLimit(info.index, grip);
      const straightCap = (this.safetyCarTimer > 0 ? 23 : this.setup.weather === 'wet' ? 68 : 84) * driver.pace;
      const targetSpeed = Math.min(straightCap, cornerLimit * driver.pace, aheadSpeedCap);

      const progress = driver.completedLaps * L + info.s;
      const drs = this.isDrsEligible(info.s, progress, phys.speed, this.ai.filter(other => other !== driver));
      driver.drs = drs;

      const steerGain = clamp(2.0 - phys.speed * 0.008, 1.15, 2.0);
      const input = this.mode === 'racing' ? {
        steer: clamp(error * steerGain - s.r * 0.25, -1, 1),
        throttle: phys.speed < targetSpeed ? clamp((targetSpeed - phys.speed) * 0.35, 0, 1) : 0,
        brake: phys.speed > targetSpeed + 2 ? clamp((phys.speed - targetSpeed) * 0.14, 0, 1) : 0,
        drs,
      } : { throttle: 0, brake: 1, steer: 0 };

      phys.step(dt, input, { grip });
      this.handleBarrier(phys, info);
      driver.tyreWear = clamp(driver.tyreWear + phys.speed * dt * 0.00055, 0, 100);

      const now = this.track.query(s.x, s.z, driver.hint);
      driver.hint = now.index;
      const sec = Math.floor((now.s / L) * 3);
      driver.sectorsHit |= 1 << sec;
      if (driver.previousS != null && driver.previousS > L * 0.85 && now.s < L * 0.15) {
        if (driver.sectorsHit === 7) driver.completedLaps++;
        driver.sectorsHit = 1 << sec;
      }
      driver.previousS = now.s;
      driver.progress = driver.completedLaps * L + now.s;
    }
  }

  laps(sd) {
    const L = this.track.length;
    this.sector = Math.floor((sd / L) * 3);
    this.sectorsHit |= 1 << this.sector;
    if (this.prevS !== null && this.prevS > L * 0.85 && sd < L * 0.15) {
      if (this.sectorsHit === 7 && this.mode === 'racing') {
        const lt = this.raceTime - this.lapStart;
        this.lastLap = lt;
        this.bestLap = this.bestLap == null ? lt : Math.min(this.bestLap, lt);
        this.hud.toast(lt === this.bestLap ? `Best lap ${fmt(lt)}` : `Lap ${fmt(lt)}`);
        this.lap++;
        if (this.lap > this.setup.laps) this.finishRace();
      }
      this.lapStart = this.raceTime;
      this.sectorsHit = 1 << this.sector;
    }
    this.prevS = sd;
  }

  position() {
    const me = (this.lap - 1) * this.track.length + this.track.query(this.physics.s.x, this.physics.s.z, this.hint).s;
    return 1 + this.ai.filter(x => x.progress > me).length;
  }

  requestPit() {
    if (this.mode !== 'racing' || this.pitUsed || this.pitTimer > 0 || this.pitMiniGame.active) return;
    const info = this.track.query(this.physics.s.x, this.physics.s.z, this.hint);
    if (!this.inPitLane(info) || Math.abs(info.s / this.track.length - this.track.pitLane.box) > 0.013) {
      this.hud.toast('Enter the marked pit lane and stop in your pit box'); return;
    }
    if (this.physics.speed * 3.6 > RACE.pitSpeedKmh) { this.hud.toast(`Slow to ${RACE.pitSpeedKmh} km/h to pit`); return; }
    this.pitCompound = document.getElementById('pitTyreSelect').value;
    this.pitUsed = true;
    this.pitMiniGame = { active: true, cursor: 0, dir: 1 };
    document.getElementById('pitMiniGame')?.classList.remove('gone');
  }

  finishRace() {
    this.mode = 'finished'; this.hud.lights(0, false);
    document.getElementById('finishTitle').textContent = this.position() === 1 ? 'Race winner' : 'Race complete';
    document.getElementById('finishSummary').textContent = `${this.setup.driver} finished P${this.position()} · ${this.lap - 1} laps · best lap ${fmt(this.bestLap)}${this.timePenalty ? ` · +${this.timePenalty}s penalty` : ''}`;
    document.getElementById('finishMenu').classList.remove('gone');
  }

  recover() {
    const i = this.track.query(this.physics.s.x, this.physics.s.z, this.hint).index, p = this.track.samples[i], t = this.track.tangents[i];
    this.physics.reset(p.x, p.z, Math.atan2(t.z, t.x)); this.sectorsHit = 0; this.hud.toast('Reset to track', 1000);
  }

  render(dt) {
    const s = this.physics.s;
    const info = this.track.query(s.x, s.z, this.hint);
    poseCar(this.car, s, this.drsEnabled);
    this.env.follow(s.x, s.z);
    this.rig.update(dt, s, this.car, { drs: this.drsEnabled });
    for (const driver of this.ai) poseCar(driver.car, driver.physics.s, driver.drs);
    if (this.safetyCarTimer > 0) {
      poseCar(this.safetyCarVisual, this.safetyCarPhysics.s);
      const flash = Math.floor(performance.now() / 150) % 2;
      this.safetyCarVisual.beacons[0].emissiveIntensity = flash ? 2.4 : 0.25;
      this.safetyCarVisual.beacons[1].emissiveIntensity = flash ? 0.25 : 2.4;
    } else this.safetyCarVisual.group.visible = false;

    const currentGrip = this.surfaceGrip(info.lateral, this.tyreWear, this.tyre, info.s);
    this.audio.update(s.rpm, this.input.throttle, { speed: this.physics.speed, lateralG: s.ay / 9.81, grip: currentGrip, gear: s.gear });
    const me = info.s;
    const position = 1 + this.ai.filter(x => x.progress > (this.lap - 1) * this.track.length + me).length;
    const q = info.s / this.track.length;
    const pitBox = this.inPitLane(info) && Math.abs(q - this.track.pitLane.box) <= 0.013;
    this.input.forceFeedback(clamp(-s.delta * 1.4 - s.ay / 9.81 * 0.18, -1, 1));

    this.hud.update({
      lap: Math.min(this.lap, this.setup.laps), cur: this.raceTime - this.lapStart, last: this.lastLap, best: this.bestLap,
      sector: this.sector, gear: s.gear, speed: this.physics.speed, rpm: s.rpm,
      throttle: this.input.throttle, brake: this.input.brake,
      cam: this.rig.name, x: s.x, z: s.z, position,
      pitUsed: this.pitUsed, inPitLane: this.pitLimiter, pitBox,
      fuel: this.fuelKg, tyre: this.tyre, tyreWear: this.tyreWear,
      ers: this.ersMJ, ersOn: this.ersEnabled, drs: this.drsEnabled, drsAllowed: this.drsAllowed,
      safetyCar: this.safetyCarTimer > 0, safetySeconds: this.safetyCarTimer,
      haloHidden: this.rig.hideCenterPillar, damage: this.damage,
      grip: currentGrip, wetness: this.weather.wetness,
    });
    this.renderer.render(this.scene, this.camera);
  }
}