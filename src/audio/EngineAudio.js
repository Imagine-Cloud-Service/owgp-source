export class EngineAudio {
  constructor({ volume = 0.65, muted = false } = {}) {
    this.volume = volume;
    this.muted = muted;
    this.ctx = null;
    this.running = false;
    this.lastGear = 1;
    this.shiftCutUntil = 0;

    this._unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('pointerdown', this._unlock);
    window.addEventListener('keydown', this._unlock);
  }

  start() {
    if (this.running) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume * 0.35;
    this.master.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 650;
    this.filter.Q.value = 3.0;

    this.shaper = this.ctx.createWaveShaper();
    this.shaper.curve = this._distortionCurve(26);
    this.shaper.oversample = '2x';

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.001;
    this.engineGain.connect(this.shaper);
    this.shaper.connect(this.filter);
    this.filter.connect(this.master);

    const harmonics = [
      { type: 'sawtooth', mult: 1.0, gain: 0.45 },
      { type: 'triangle', mult: 2.0, gain: 0.30 },
      { type: 'sawtooth', mult: 3.0, gain: 0.16 },
      { type: 'sine',     mult: 0.5, gain: 0.24 },
    ];

    this.oscs = harmonics.map((h) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = h.type;
      g.gain.value = h.gain;
      osc.connect(g);
      g.connect(this.engineGain);
      osc.start();
      return { osc, mult: h.mult };
    });

    this.popBuffer = this._noiseBuffer(0.11);
    this.running = true;
  }

  stop() {
    window.removeEventListener('pointerdown', this._unlock);
    window.removeEventListener('keydown', this._unlock);
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.running = false;
  }

  _distortionCurve(amount) {
    const n = 44100;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  _noiseBuffer(sec) {
    const len = Math.floor(this.ctx.sampleRate * sec);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.25));
    return buf;
  }

  _shiftPop(isUpshift) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (isUpshift) this.shiftCutUntil = now + 0.06;

    const src = this.ctx.createBufferSource();
    src.buffer = this.popBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = isUpshift ? 260 : 420;
    bp.Q.value = 1.4;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(isUpshift ? 0.35 : 0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start(now);
  }

  update(rpm = 3500, throttle = 0, { gear = 1 } = {}) {
    if (!this.ctx || !this.running || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;

    if (gear !== this.lastGear) {
      this._shiftPop(gear > this.lastGear);
      this.lastGear = gear;
    }

    const clampedRpm = Math.max(2500, Math.min(14500, rpm));
    const baseFreq = (clampedRpm / 60) * 1.55;
    for (const { osc, mult } of this.oscs) {
      osc.frequency.setTargetAtTime(baseFreq * mult, now, 0.022);
    }

    const rpmNorm = clampedRpm / 13500;
    const cutoff = 380 + rpmNorm * 2400 + throttle * 1700;
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.03);

    const inCut = now < this.shiftCutUntil;
    const targetGain = inCut ? 0.05 : 0.22 + throttle * 0.45 + rpmNorm * 0.25;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.015);
  }
}