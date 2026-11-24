export const fmt = t => (t == null ? '–:––.–––' : `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`);

export class HUD {
  constructor(track) {
    const $ = id => document.getElementById(id);
    this.el = {
      root: $('hud'), lap: $('lap'), cur: $('cur'), last: $('last'), best: $('best'),
      sector: $('sector'), position: $('position'), driver: $('driverTag'),
      speedVal: $('speedVal'), rpmVal: $('rpmVal'), gearVal: $('gearVal'),
      throttleArc: $('throttleArc'), brakeArc: $('brakeArc'), drsBg: $('drsBg'),
      cam: $('cam'), toast: $('toast'), lights: $('lights'), map: $('map'),
      pit: $('pitButton'), weather: $('weatherReadout'), fuel: $('fuelReadout'),
      tyre: $('tyreReadout'), ers: $('ersReadout'), drs: $('drsReadout'),
      safety: $('safetyReadout'), damage: $('damageReadout'), grip: $('gripReadout'),
      ersButton: $('ersButton'), drsButton: $('drsButton'), haloButton: $('haloButton'),
    };
    this.track = track;
    this.ctx = this.el.map.getContext('2d');
    const xs = track.samples.map(p => p.x), zs = track.samples.map(p => p.z);
    this.b = {
      x0: Math.min(...xs),
      z0: Math.min(...zs),
      s: 160 / Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)),
    };
  }

  show() { this.el.root.hidden = false; }

  setRaceInfo(info) {
    this.raceInfo = info;
    if (this.el.weather) this.el.weather.textContent = String(info.weather).toUpperCase();
    if (this.el.driver) this.el.driver.textContent = `${info.driver} · ${info.team}`;
    if (this.el.pit) this.el.pit.disabled = true;
  }

  lights(n, on = true) {
    this.el.lights.classList.toggle('on', on);
    [...this.el.lights.children].forEach((l, i) => l.classList.toggle('lit', i < n));
  }

  toast(msg, ms = 1800) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._t);
    this._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  update(d) {
    const e = this.el;
    e.lap.textContent = d.lap;
    e.cur.textContent = fmt(d.cur);
    e.last.textContent = fmt(d.last);
    e.best.textContent = fmt(d.best);
    e.sector.textContent = 'S' + (d.sector + 1);
    e.position.textContent = `${d.position} / 6`;
    e.fuel.textContent = `${d.fuel.toFixed(1)} kg`;
    e.tyre.textContent = `${d.tyre.toUpperCase()} ${Math.max(0, 100 - d.tyreWear).toFixed(0)}%`;
    e.ers.textContent = `${d.ers.toFixed(1)} MJ · ${d.ersOn ? 'DEPLOY' : 'HARVEST'}`;
    e.drs.textContent = d.drs ? 'OPEN' : d.drsAllowed ? 'READY · X' : 'UNAVAILABLE';
    e.safety.textContent = d.safetyCar ? `DEPLOYED ${d.safetySeconds.toFixed(0)}s` : 'CLEAR';
    e.damage.textContent = `${Math.round(d.damage * 100)}%`;
    e.grip.textContent = `${Math.round(d.grip * 100)}%`;
    if (e.weather && this.raceInfo?.weather === 'changeable') {
      e.weather.textContent = `S${d.sector + 1} WET ${Math.round(d.wetness * 100)}%`;
    }
    if (e.pit) {
      e.pit.textContent = d.pitUsed ? 'PIT USED' : d.inPitLane ? 'PIT LANE · 70' : 'PIT · M';
      e.pit.disabled = d.pitUsed || !d.pitBox || d.speed * 3.6 > 70;
    }
    e.ersButton.classList.toggle('active', d.ersOn);
    e.drsButton.classList.toggle('active', d.drs);
    e.drsButton.disabled = !d.drsAllowed;
    e.haloButton.textContent = d.haloHidden ? 'HALO OFF' : 'HALO · H';
    e.cam.textContent = d.cam + ' (C)';

    // Update Reference Circular Speedometer
    const speedKmh = Math.round((d.speed || 0) * 3.6);
    if (e.speedVal) e.speedVal.textContent = speedKmh;
    if (e.rpmVal) e.rpmVal.textContent = Math.round(d.rpm || 3500);
    if (e.gearVal) e.gearVal.textContent = d.speed < 1 ? 'N' : d.gear;

    const tArc = Math.max(0, Math.min(1, d.throttle || 0)) * 245;
    const bArc = Math.max(0, Math.min(1, d.brake || 0)) * 122;
    e.throttleArc?.setAttribute('stroke-dasharray', `${tArc} 490`);
    e.brakeArc?.setAttribute('stroke-dasharray', `${bArc} 490`);
    if (e.drsBg) e.drsBg.setAttribute('fill', d.drs ? '#0fa618' : d.drsAllowed ? '#e6a800' : '#2c323a');

    this._map(d.x, d.z);
  }

  _map(x, z) {
    const c = this.ctx, { x0, z0, s } = this.b, T = this.track.samples;
    c.clearRect(0, 0, 180, 180);
    c.strokeStyle = '#f4f6f8';
    c.lineWidth = 3;
    c.beginPath();
    T.forEach((p, i) => {
      const px = 10 + (p.x - x0) * s, pz = 10 + (p.z - z0) * s;
      i ? c.lineTo(px, pz) : c.moveTo(px, pz);
    });
    c.closePath();
    c.stroke();
    c.fillStyle = '#e03a3e';
    c.beginPath();
    c.arc(10 + (x - x0) * s, 10 + (z - z0) * s, 5, 0, 7);
    c.fill();
  }
}