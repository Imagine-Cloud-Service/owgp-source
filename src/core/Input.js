const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const CONTROL_MODES = ['auto', 'keyboard', 'controller', 'touch'];
const MODE_LABELS = { auto: 'AUTO', keyboard: 'KEYS', controller: 'PAD', touch: 'TOUCH' };

export function detectDevice() {
  const hasTouch =
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    (typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)));

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobileUA = /Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isTabletUA =
    /iPad|Android(?!.*Mobile)|Tablet/i.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);

  const minSide =
    typeof window !== 'undefined'
      ? Math.min(window.innerWidth || 0, window.innerHeight || 0)
      : 0;

  let deviceType = 'desktop';
  if (isMobileUA || (hasTouch && minSide > 0 && minSide < 600)) {
    deviceType = 'mobile';
  } else if (isTabletUA || hasTouch) {
    deviceType = 'tablet';
  }

  const hasGamepad = Boolean(
    typeof navigator !== 'undefined' &&
      [...(navigator.getGamepads?.() || [])].find(p => p && p.connected)
  );

  return { deviceType, hasTouch, hasGamepad };
}

export function resolveControlMode(mode, info = detectDevice()) {
  if (mode && CONTROL_MODES.includes(mode) && mode !== 'auto') return mode;
  if (info.hasGamepad) return 'controller';
  if (info.deviceType === 'mobile' || info.deviceType === 'tablet') return 'touch';
  return 'keyboard';
}

/** Auto-detecting Keyboard + Controller (Gamepad) + Touch input manager. */
export class Input {
  constructor(settings = {}) {
    this.steeringSensitivity = settings.steeringSensitivity ?? 1;
    this.device = detectDevice();
    this.controlMode = CONTROL_MODES.includes(settings.controlsMode)
      ? settings.controlsMode
      : 'auto';
    this.activeMode = resolveControlMode(this.controlMode, this.device);

    this.keys = new Set();
    this.hit = new Set();
    this.padPrev = [];
    this.padHit = new Set();
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.touch = { left: false, right: false, brake: false, throttle: false };
    this.feedbackAt = 0;
    this.forceAt = 0;

    addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea')) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.hit.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.touch = { left: false, right: false, brake: false, throttle: false };
    });

    addEventListener('gamepadconnected', () => {
      this.device = detectDevice();
      this.device.hasGamepad = true;
      if (this.controlMode === 'auto') this.applyControlModeUI();
    });
    addEventListener('gamepaddisconnected', () => {
      this.device = detectDevice();
      if (this.controlMode === 'auto') this.applyControlModeUI();
    });

    document.querySelectorAll('[data-touch]').forEach(button => {
      const key = button.dataset.touch;
      const set = (event, value) => {
        event.preventDefault();
        this.touch[key] = value;
        button.classList.toggle('active', value);
      };
      button.addEventListener('pointerdown', event => {
        set(event, true);
        button.setPointerCapture?.(event.pointerId);
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        button.addEventListener(type, event => set(event, false));
      }
    });

    document.getElementById('touchCamera')?.addEventListener('click', () => this.hit.add('KeyC'));

    this.cycleBtn = document.getElementById('cycleControlBtn');
    this.badgeEl = document.getElementById('deviceInfoBadge');
    this.recenterBtn = document.getElementById('recenterTiltBtn');
    this.settingsSelect = document.getElementById('controlsMode');

    if (this.cycleBtn) {
      this.cycleBtn.onclick = () => this.cycleControlMode();
    }
    if (this.recenterBtn) {
      this.recenterBtn.hidden = true;
    }

    this.applyControlModeUI();
  }

  setControlMode(mode, syncSettingsSelect = true) {
    const normalized = CONTROL_MODES.includes(mode) ? mode : 'auto';
    this.controlMode = normalized;
    if (syncSettingsSelect && this.settingsSelect) {
      this.settingsSelect.value = normalized;
      this.settingsSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    this.applyControlModeUI();
  }

  cycleControlMode() {
    const next = CONTROL_MODES[(CONTROL_MODES.indexOf(this.controlMode) + 1) % CONTROL_MODES.length];
    this.setControlMode(next, true);
  }

  applyControlModeUI() {
    this.device = detectDevice();
    this.activeMode = resolveControlMode(this.controlMode, this.device);

    document.body.dataset.device = this.device.deviceType;
    document.body.dataset.touch = this.device.hasTouch ? 'yes' : 'no';
    document.body.dataset.controls = this.controlMode;
    document.body.dataset.controlMode = this.activeMode;

    const touchNav = document.getElementById('touchControls');
    if (touchNav) touchNav.style.display = this.activeMode === 'touch' ? 'flex' : 'none';

    if (this.badgeEl) {
      this.badgeEl.textContent = `${this.device.deviceType.toUpperCase()} · ${this.activeMode.toUpperCase()}`;
    }
    if (this.cycleBtn) {
      this.cycleBtn.textContent = `CTRL: ${MODE_LABELS[this.controlMode] || this.controlMode.toUpperCase()}`;
    }
  }

  pressed(code) { return this.hit.has(code); }

  _getGamepad() {
    return [...(navigator.getGamepads?.() || [])].find(p => p && p.connected) || null;
  }

  poll(dt) {
    this.padHit = new Set();

    // 1. Controller (Gamepad)
    if (this.activeMode === 'controller') {
      const pad = this._getGamepad();
      if (pad) {
        const dz = v => (Math.abs(v) < 0.08 ? 0 : v);
        const sx = dz(pad.axes[0] || 0);
        const rt = Math.max(pad.buttons[7]?.value || 0, pad.buttons[0]?.pressed ? 1 : 0);
        const lt = Math.max(pad.buttons[6]?.value || 0, pad.buttons[1]?.pressed ? 1 : 0);

        pad.buttons.forEach((b, i) => {
          if (b?.pressed && !this.padPrev[i]) this.padHit.add(i);
          this.padPrev[i] = Boolean(b?.pressed);
        });

        if (this.padHit.has(9)) this.hit.add('Escape');   // Start / Options = Pause
        if (this.padHit.has(12)) this.hit.add('KeyH');    // D-Pad Up = Halo
        if (this.padHit.has(13)) this.hit.add('KeyM');    // D-Pad Down = Pit
        if (this.padHit.has(0)) this.hit.add('Space');    // A / Cross = Pitstop timing

        this.throttle = rt;
        this.brake = lt;
        this.steer = clamp(Math.sign(sx) * Math.abs(sx) ** 1.4 * this.steeringSensitivity, -1, 1);
        return;
      }
    }

    // 2. Keyboard & Touch
    const k = (...c) => c.some(x => this.keys.has(x));
    const useKeys = this.activeMode === 'keyboard';
    const useTouch = this.activeMode === 'touch';

    const tT = ((useKeys && k('KeyW', 'ArrowUp')) || (useTouch && this.touch.throttle)) ? 1 : 0;
    const tB = ((useKeys && k('KeyS', 'ArrowDown')) || (useTouch && this.touch.brake)) ? 1 : 0;

    let tS = 0;
    if (useKeys) {
      tS += k('KeyD', 'ArrowRight') ? 1 : 0;
      tS -= k('KeyA', 'ArrowLeft') ? 1 : 0;
    } else if (useTouch) {
      tS = (this.touch.right ? 1 : 0) - (this.touch.left ? 1 : 0);
    }

    const rate = tS === 0 ? 5 : (Math.sign(tS) !== Math.sign(this.steer) && this.steer !== 0 ? 7 : 3);
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
    if (this.activeMode !== 'controller') return;
    const pad = this._getGamepad();
    if (!pad) return;
    const now = performance.now();
    const wheelForce = pad.forceFeedback?.setConstantForce;
    if (typeof wheelForce === 'function' && now - this.forceAt > 16) {
      try { wheelForce.call(pad.forceFeedback, clamp(force, -1, 1)); } catch {}
      this.forceAt = now;
    }
    if (impact > 0.05 && now - this.feedbackAt > 120) {
      const actuator = pad.vibrationActuator || pad.hapticActuators?.[0];
      if (actuator?.playEffect) {
        try {
          const effect = actuator.playEffect('dual-rumble', {
            duration: 90,
            strongMagnitude: Math.min(1, impact),
            weakMagnitude: Math.min(0.8, impact * 0.65),
          });
          effect?.catch?.(() => {});
        } catch {}
      }
      this.feedbackAt = now;
    }
  }

  endFrame() { this.hit.clear(); }
}