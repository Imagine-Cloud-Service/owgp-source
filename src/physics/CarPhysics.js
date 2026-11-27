import { PHYSICS as P } from '../config.js';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const g = 9.81;

/**
 * Single-track ("bicycle") car model with a load-sensitive saturating tyre, a friction circle,
 * aero drag + downforce, power-limited traction, brake limits and an 8-speed auto gearbox.
 * Body axes: x = forward, y = right, r = yaw rate (positive = turning right).
 * World axes: heading th -> forward (cos th, sin th), right (-sin th, cos th) in (x, z).
 */
export class CarPhysics {
  constructor(fuelKg = 0) { this.mass = P.m + fuelKg; this.reset(0, 0, 0); }

  reset(x, z, th) {
    this.s = { x, z, th, vx: 0, vy: 0, r: 0, delta: 0, gear: 1, rpm: P.idleRpm, ax: 0, ay: 0, wheelSpin: 0 };
  }

  get speed() { return Math.hypot(this.s.vx, this.s.vy); }

  step(dt, input, surface) {
    const s = this.s, { a, b } = P, m = this.mass, L = a + b;
    const vAbs = Math.abs(s.vx);
    const down = 0.5 * P.rho * P.ClA * s.vx * s.vx * (input.drs ? 0.9 : 1);
    const Fzf = m * g * b / L + down * P.aeroFront;
    const Fzr = m * g * a / L + down * (1 - P.aeroFront);
    const grip = P.mu * surface.grip;

    s.delta = input.steer * P.maxSteer / (1 + (vAbs / P.steerFade) ** 2);

    // --- longitudinal ---
    let Fx = 0;
    if (input.throttle > 0) {
      const Fpower = (P.power + (input.ersPower || 0)) / Math.max(vAbs, 5);
      Fx += input.throttle * Math.min(Fpower, grip * Fzr * 0.95);
    }
    if (input.brake > 0) {
      const Fb = input.brake * Math.min(P.brakeMax, grip * (Fzf + Fzr) * 0.95);
      Fx -= Math.tanh(s.vx * 4) * Fb;
    }
    const dragArea = P.CdA * (input.drs ? 0.78 : 1);
    const Fres = -Math.tanh(s.vx * 5) * (0.5 * P.rho * dragArea * s.vx * s.vx + P.rolling * m * g);

    // Gentler friction circle so throttle/braking doesn't wipe out cornering grip
    const ux = clamp(Math.abs(Fx) / (grip * (Fzf + Fzr)), 0, 0.72);
    const latScale = Math.sqrt(1 - ux * ux * 0.65) * Math.min(1, vAbs / 2);

    // --- lateral (tyre slip angles) ---
    const sg = s.vx >= 0 ? 1 : -1;
    const vxe = Math.max(vAbs, 4);
    const af = Math.atan2(sg * (s.vy + a * s.r), vxe) - sg * s.delta;
    const ar = Math.atan2(sg * (s.vy - b * s.r), vxe);
    const tyre = (alpha, Fz, k) => -sg * grip * Fz * Math.tanh(k * alpha / P.mu) * latScale;
    const Fyf = tyre(af, Fzf, P.kf), Fyr = tyre(ar, Fzr, P.kr);

    const cd = Math.cos(s.delta), sd = Math.sin(s.delta);
    s.ax = (Fx + Fres - Fyf * sd) / m;
    s.ay = (Fyf * cd + Fyr) / m;

    const vxN = s.vx + (s.ax + s.vy * s.r) * dt;
    let vyN = s.vy + (s.ay - s.vx * s.r) * dt;

    // Yaw & lateral damping to prevent endless drifting
    const yawTorque = a * Fyf * cd - b * Fyr - s.r * (P.Iz * 1.8);
    s.r += (yawTorque / P.Iz) * dt;
    vyN *= Math.exp(-3.5 * dt);

    s.vx = vxN;
    s.vy = vyN;
    s.th += s.r * dt;
    const c = Math.cos(s.th), n = Math.sin(s.th);
    s.x += (s.vx * c - s.vy * n) * dt;
    s.z += (s.vx * n + s.vy * c) * dt;
    s.wheelSpin += (s.vx / 0.36) * dt;
    this._gearbox(vAbs, input.throttle);
  }

  _gearbox(v, throttle) {
    const s = this.s, T = P.gearTop;
    if (s.gear < T.length && v > T[s.gear - 1] * 0.97) s.gear++;
    else if (s.gear > 1 && v < T[s.gear - 2] * 0.86) s.gear--;
    const frac = clamp(v / T[s.gear - 1], 0, 1);
    s.rpm = P.idleRpm + (P.redRpm - P.idleRpm) * frac + throttle * 200;
  }

  /** Called by the game when the car hits a barrier: kill the outward component of velocity. */
  collide(nx, nz) {
    const s = this.s, c = Math.cos(s.th), n = Math.sin(s.th);
    let vwx = s.vx * c - s.vy * n, vwz = s.vx * n + s.vy * c;
    const out = vwx * nx + vwz * nz;
    if (out > 0) { vwx -= nx * out * 1.15; vwz -= nz * out * 1.15; }
    vwx *= 0.9; vwz *= 0.9;
    s.vx = vwx * c + vwz * n;
    s.vy = -vwx * n + vwz * c;
    s.r *= 0.6;
  }
}