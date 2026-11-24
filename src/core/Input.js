const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

/** Keyboard + gamepad. Whichever device is active this frame wins. */
export class Input {
  constructor(settings = {}) {
    this.steeringSensitivity = settings.steeringSensitivity ?? 1;
    this.keys = new Set(); this.hit = new Set(); this.padPrev = []; this.padHit = new Set();
    this.throttle = 0; this.brake = 0; this.steer = 0; this.usingPad = false; this.touch = { left:false, right:false, brake:false, throttle:false };
    this.feedbackAt = 0; this.forceAt = 0;
    addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea')) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.hit.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.querySelectorAll('[data-touch]').forEach(button => {
      const key = button.dataset.touch;
      const set = (event, value) => { event.preventDefault(); this.touch[key] = value; button.classList.toggle('active', value); };
      button.addEventListener('pointerdown', event => { set(event, true); button.setPointerCapture(event.pointerId); });
      for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, event => set(event, false));
    });
    document.getElementById('touchCamera')?.addEventListener('click', () => this.hit.add('KeyC'));
  }
  pressed(code) { return this.hit.has(code); }

  poll(dt) {
    const k = (...c) => c.some(x => this.keys.has(x));
    const tT = k('KeyW', 'ArrowUp') || this.touch.throttle ? 1 : 0, tB = k('KeyS', 'ArrowDown') || this.touch.brake ? 1 : 0;
    const tS = Math.max(k('KeyD', 'ArrowRight') || this.touch.right ? 1 : 0, 0) - Math.max(k('KeyA', 'ArrowLeft') || this.touch.left ? 1 : 0, 0);
    if (tT || tB || tS) this.usingPad = false;
    const rate = tS === 0 ? 5 : (Math.sign(tS) !== Math.sign(this.steer) && this.steer !== 0 ? 7 : 3);

    const pad = [...(navigator.getGamepads?.() || [])].find(p => p && p.connected);
    this.padHit = new Set();
    if (pad) {
      const dz = v => (Math.abs(v) < 0.08 ? 0 : v);
      const sx = dz(pad.axes[0]), rt = pad.buttons[7]?.value || 0, lt = pad.buttons[6]?.value || 0;
      if (rt > 0.02 || lt > 0.02 || sx !== 0) this.usingPad = true;
      pad.buttons.forEach((b, i) => { if (b.pressed && !this.padPrev[i]) this.padHit.add(i); this.padPrev[i] = b.pressed; });
      if (this.usingPad) {
        this.throttle = rt; this.brake = lt; this.steer = Math.max(-1,Math.min(1,Math.sign(sx) * Math.abs(sx) ** 1.4 * this.steeringSensitivity));
        return;
      }
    }
    this.throttle = approach(this.throttle, tT, dt * (tT ? 5 : 9));
    this.brake = approach(this.brake, tB, dt * (tB ? 6 : 10));
    this.steer = approach(this.steer, tS * this.steeringSensitivity, dt * rate);
  }
  toggleCamera() { return this.pressed('KeyC') || this.padHit.has(3); }
  toggleHalo() { return this.pressed('KeyH'); }
  toggleERS() { return this.pressed('KeyE') || this.padHit.has(4); }
  toggleDRS() { return this.pressed('KeyX') || this.padHit.has(5); }
  reset() { return this.pressed('KeyR') || this.padHit.has(2); }
  forceFeedback(force, impact = 0) {
    const pad = [...(navigator.getGamepads?.() || [])].find(p => p && p.connected);
    if (!pad) return;
    const now = performance.now();
    const wheelForce = pad.forceFeedback?.setConstantForce;
    if (typeof wheelForce === 'function' && now - this.forceAt > 16) {
      try { wheelForce.call(pad.forceFeedback, Math.max(-1, Math.min(1, force))); } catch {}
      this.forceAt = now;
    }
    if (impact > 0.05 && now - this.feedbackAt > 120) {
      const actuator = pad.vibrationActuator || pad.hapticActuators?.[0];
      if (actuator?.playEffect) {
        try {
          const effect = actuator.playEffect('dual-rumble', {
            duration: 90, strongMagnitude: Math.min(1, impact), weakMagnitude: Math.min(0.8, impact * 0.65),
          });
          effect?.catch?.(() => {});
        } catch {}
      }
      this.feedbackAt = now;
    }
  }
  endFrame() { this.hit.clear(); }
}
