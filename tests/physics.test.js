// Headless sanity checks for the car model: node tests/physics.test.js
import { CarPhysics } from '../src/physics/CarPhysics.js';
import { STEP } from '../src/config.js';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };

let c = new CarPhysics(), t = 0, t100 = null, t200 = null;
while (t < 40) { c.step(STEP, { throttle: 1, brake: 0, steer: 0 }, { grip: 1 }); t += STEP;
  if (!t100 && c.speed * 3.6 >= 100) t100 = t; if (!t200 && c.speed * 3.6 >= 200) t200 = t; }
console.log(`0-100 km/h ${t100?.toFixed(2)}s, 0-200 km/h ${t200?.toFixed(2)}s, top ${(c.speed * 3.6).toFixed(0)} km/h`);
ok(t100 > 1.8 && t100 < 3.2, '0-100 in a plausible 1.8-3.2 s');
ok(c.speed * 3.6 > 300 && c.speed * 3.6 < 380, 'top speed 300-380 km/h');

const v0 = c.speed; let d = 0;
while (c.speed > 1) { c.step(STEP, { throttle: 0, brake: 1, steer: 0 }, { grip: 1 }); d += c.speed * STEP; }
console.log(`Braking from ${(v0 * 3.6).toFixed(0)} km/h: ${d.toFixed(0)} m`);
ok(d > 80 && d < 200, 'braking distance 80-200 m');

c = new CarPhysics(); c.s.vx = 60;
let maxAy = 0;
for (let i = 0; i < 240 * 6; i++) { c.step(STEP, { throttle: 0.4, brake: 0, steer: 0.6 }, { grip: 1 }); maxAy = Math.max(maxAy, Math.abs(c.s.vx * c.s.r)); }
console.log(`Steady corner at ~216 km/h: lateral accel ${(maxAy / 9.81).toFixed(1)} g`);
ok(maxAy / 9.81 > 2.5 && maxAy / 9.81 < 6.5 && Number.isFinite(c.s.x), 'cornering 2.5-6.5 g, no NaN');

c = new CarPhysics();
for (let i = 0; i < 240 * 10; i++) c.step(STEP, { throttle: 0, brake: 0, steer: 1 }, { grip: 0.55 });
ok(Number.isFinite(c.s.x) && c.speed < 1, 'standing steer input is stable');
