import './style.css';
import { Game } from './core/Game.js';
import { detectDevice, resolveControlMode } from './core/Input.js';
import { GaragePreview } from './vehicle/GaragePreview.js';
import { TRACKS } from './config.js';

const $ = id => document.getElementById(id), SAVE_KEY = 'owgp.phase1.setup';
const presets = {
  volt: ['#b7e52d', '#f4f6f8', '#20252c', '#c8ef33', '#ffe44c'],
  scuderia: ['#df2636', '#f4f6f8', '#15191e', '#f4f6f8', '#ffd447'],
  ocean: ['#147fc1', '#32d2d0', '#12212d', '#31d4d2', '#e9f2ff'],
  midnight: ['#29234b', '#d3a943', '#15151b', '#d6ad4c', '#f6f0e4'],
};

const deviceInfo = detectDevice();
document.body.dataset.device = deviceInfo.deviceType;
document.body.dataset.touch = deviceInfo.hasTouch ? 'yes' : 'no';

let game = null, audioMuted = false, openedSettingsFromPause = false;
const controls = ['driver', 'team', 'driverNumber', 'presetLivery', 'paintFinish', 'sponsorLogo', 'cPrimary', 'cSecondary', 'cHalo', 'cRims', 'cHelmet', 'trackSelect', 'weatherSelect', 'lapsSelect', 'startMode', 'fuelSelect', 'tyreSelect', 'controlsMode', 'screenSize', 'viewDistance', 'baseFov', 'gForce', 'steeringSensitivity', 'quality', 'audioVolume'];

function applyModeDataset(mode) {
  const selected = ['auto', 'keyboard', 'controller', 'touch'].includes(mode) ? mode : 'auto';
  const active = resolveControlMode(selected, detectDevice());
  document.body.dataset.controls = selected;
  document.body.dataset.controlMode = active;
}

function livery() {
  return {
    primary: $('cPrimary').value,
    secondary: $('cSecondary').value,
    halo: $('cHalo').value,
    rims: $('cRims').value,
    helmet: $('cHelmet').value,
    finish: $('paintFinish')?.value || 'gloss',
    sponsor: $('sponsorLogo')?.value || 'APEX',
    number: Math.max(1, Math.min(99, Number($('driverNumber').value) || 7)),
  };
}

function save() {
  const data = readSetup();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

function readSetup() {
  const fov = Math.max(35, Math.min(50, Number($('baseFov').value) || 44));
  return {
    driver: $('driver').value.trim().slice(0, 18) || 'A. Driver',
    team: $('team').value.trim().slice(0, 22) || 'Apex Works',
    presetLivery: $('presetLivery').value,
    track: $('trackSelect').value,
    weather: $('weatherSelect').value,
    laps: Number($('lapsSelect').value),
    startMode: $('startMode')?.value || 'grid',
    fuelKg: Number($('fuelSelect').value),
    tyre: $('tyreSelect').value,
    horizontalFov: fov,
    gForce: Number($('gForce').value),
    steeringSensitivity: Number($('steeringSensitivity').value),
    controlsMode: $('controlsMode').value,
    quality: $('quality').value,
    audioVolume: Number($('audioVolume').value),
    audioMuted,
    screenSize: Number($('screenSize').value),
    viewDistance: Number($('viewDistance').value),
    livery: livery(),
  };
}

try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (saved) {
    if (saved.driver) $('driver').value = saved.driver;
    if (saved.team) $('team').value = saved.team;
    audioMuted = Boolean(saved.audioMuted);
    const assign = {
      driverNumber: saved.livery?.number,
      presetLivery: saved.presetLivery,
      paintFinish: saved.livery?.finish,
      sponsorLogo: saved.livery?.sponsor,
      cPrimary: saved.livery?.primary,
      cSecondary: saved.livery?.secondary,
      cHalo: saved.livery?.halo,
      cRims: saved.livery?.rims,
      cHelmet: saved.livery?.helmet,
      trackSelect: TRACKS[saved.track] ? saved.track : 'monza',
      weatherSelect: saved.weather,
      lapsSelect: saved.laps,
      startMode: saved.startMode,
      fuelSelect: saved.fuelKg,
      tyreSelect: saved.tyre,
      controlsMode: ['auto', 'keyboard', 'controller', 'touch'].includes(saved.controlsMode) ? saved.controlsMode : 'auto',
      screenSize: saved.screenSize,
      viewDistance: saved.viewDistance,
      baseFov: saved.horizontalFov,
      gForce: saved.gForce,
      steeringSensitivity: saved.steeringSensitivity,
      quality: saved.quality,
      audioVolume: saved.audioVolume,
    };
    for (const [id, v] of Object.entries(assign)) if (v !== undefined && $(id)) $(id).value = String(v);
  }
} catch { try { localStorage.removeItem(SAVE_KEY); } catch {} }

const preview = new GaragePreview($('garagePreview'), livery(), $('quality').value);
preview.start();

function showPage(name) {
  $('menu').dataset.activePage = name;
  document.querySelectorAll('.menu-page').forEach(p => p.classList.toggle('active', p.id === `page${name[0].toUpperCase()}${name.slice(1)}`));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('selected', b.dataset.page === name));
  preview.setFocus?.(name === 'garage' ? 'garage' : 'home');
}

document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', e => {
  e.preventDefault();
  if (b.dataset.page === 'home' && openedSettingsFromPause && (game || window.owgpGame)) {
    openedSettingsFromPause = false;
    $('menu').classList.add('gone');
    $('hud').hidden = false;
    $('pauseMenu').classList.remove('gone');
    return;
  }
  showPage(b.dataset.page);
}));
showPage('home');

function syncLabels() {
  $('fovValue').value = $('fovValue').textContent = `${$('baseFov').value}°`;
  $('gForceValue').value = $('gForceValue').textContent = `${Number($('gForce').value).toFixed(1)}×`;
  $('steeringValue').value = $('steeringValue').textContent = `${Number($('steeringSensitivity').value).toFixed(2)}×`;
  $('monitorValue').value = $('monitorValue').textContent = `${$('screenSize').value} in`;
  $('distanceValue').value = $('distanceValue').textContent = `${$('viewDistance').value} cm`;
  $('volumeValue').value = $('volumeValue').textContent = `${Math.round(Number($('audioVolume').value) * 100)}%`;
}
syncLabels();
applyModeDataset($('controlsMode').value);

for (const id of controls) {
  const el = $(id);
  if (!el) continue;
  el.addEventListener('input', () => {
    syncLabels();
    save();
    if (id === 'quality') preview.setQuality(el.value);
    if (['cPrimary', 'cSecondary', 'cHalo', 'cRims', 'cHelmet', 'driverNumber', 'paintFinish', 'sponsorLogo'].includes(id)) preview.updateCar(livery());
    if (id === 'controlsMode') {
      applyModeDataset(el.value);
      if (game?.input && game.input.controlMode !== el.value) game.input.setControlMode(el.value, false);
    }
    if (id === 'audioVolume') game?.audio.setVolume?.(el.value);
  });
  el.addEventListener('change', () => {
    syncLabels();
    save();
    if (id === 'controlsMode') {
      applyModeDataset(el.value);
      if (game?.input && game.input.controlMode !== el.value) game.input.setControlMode(el.value, false);
    }
  });
}

$('muteAudio').setAttribute('aria-pressed', String(audioMuted));
$('muteAudio').textContent = audioMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO';
$('muteAudio').addEventListener('click', () => {
  audioMuted = !audioMuted;
  $('muteAudio').setAttribute('aria-pressed', String(audioMuted));
  $('muteAudio').textContent = audioMuted ? 'UNMUTE AUDIO' : 'MUTE AUDIO';
  game?.audio.setMuted?.(audioMuted);
  save();
});

$('presetLivery').addEventListener('change', () => {
  const colors = presets[$('presetLivery').value];
  if (colors) {
    ['cPrimary', 'cSecondary', 'cHalo', 'cRims', 'cHelmet'].forEach((id, i) => $(id).value = colors[i]);
    preview.updateCar(livery());
  }
  save();
});

// --- About Modal ---
const aboutModal = $('aboutModal');
$('aboutBtn')?.addEventListener('click', () => aboutModal.classList.remove('gone'));
$('closeAboutModal')?.addEventListener('click', () => aboutModal.classList.add('gone'));
aboutModal?.addEventListener('click', e => { if (e.target === aboutModal) aboutModal.classList.add('gone'); });

// --- Circuit Selector Popup ---
const circuitModal = $('circuitModal');
const circuitGrid = $('circuitGrid');

function openCircuitModal() {
  const current = $('trackSelect').value;
  circuitGrid.querySelectorAll('.circuit-card').forEach(c => c.classList.toggle('selected', c.dataset.track === current));
  circuitModal.classList.remove('gone');
}

function closeCircuitModal() {
  circuitModal.classList.add('gone');
}

function returnToHome() {
  openedSettingsFromPause = false;
  (game || window.owgpGame)?.stop();
  game = null;
  window.owgpGame = null;
  $('hud').hidden = true;
  $('finishMenu').classList.add('gone');
  $('pauseMenu').classList.add('gone');
  $('pitMiniGame')?.classList.add('gone');
  $('menu').classList.remove('gone');
  preview.start();
  showPage('home');
}

function startRace(trackId) {
  if (trackId && TRACKS[trackId]) $('trackSelect').value = trackId;
  const setup = readSetup();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(setup)); } catch {}
  closeCircuitModal();
  preview.stop();
  $('menu').classList.add('gone');
  $('pauseMenu').classList.add('gone');
  $('finishMenu').classList.add('gone');
  if (game) game.stop();
  game = new Game($('app'), setup);
  window.owgpGame = game;
  game.start();
}

$('start').addEventListener('click', openCircuitModal);
$('garageStart').addEventListener('click', openCircuitModal);
$('closeCircuitModal').addEventListener('click', closeCircuitModal);
circuitModal.addEventListener('click', e => { if (e.target === circuitModal) closeCircuitModal(); });
circuitGrid.addEventListener('click', e => {
  const card = e.target.closest('.circuit-card');
  if (card) startRace(card.dataset.track);
});

// --- Pause & Race Controls ---
$('pauseButton')?.addEventListener('click', () => {
  $('pauseButton').blur();
  (game || window.owgpGame)?.togglePause();
});
$('resumeButton')?.addEventListener('click', () => {
  $('resumeButton').blur();
  openedSettingsFromPause = false;
  (game || window.owgpGame)?.resume();
});
$('pauseSettingsButton')?.addEventListener('click', () => {
  $('pauseSettingsButton').blur();
  openedSettingsFromPause = true;
  $('pauseMenu').classList.add('gone');
  $('hud').hidden = true;
  $('menu').classList.remove('gone');
  showPage('settings');
});
$('pauseHomeButton')?.addEventListener('click', () => {
  $('pauseHomeButton').blur();
  returnToHome();
});
$('menuButton')?.addEventListener('click', returnToHome);

$('pitButton').addEventListener('click', () => game?.requestPit());
$('ersButton').addEventListener('click', () => { if (game) game.ersEnabled = !game.ersEnabled; });
$('drsButton').addEventListener('click', () => {
  if (!game) return;
  if (game.drsAllowed) game.drsEnabled = !game.drsEnabled;
  else game.hud.toast('DRS unavailable: zone or gap condition not met');
});
$('haloButton').addEventListener('click', () => { if (game) game.rig.toggleHalo(); });
$('againButton').addEventListener('click', () => game?.restart());

// --- 3-Stage Splash Screen Sequence ---
(function runSplash() {
  const splash = $('splashScreen');
  if (!splash) return;

  const slides = [...splash.querySelectorAll('.splash-slide')];
  let index = 0;
  let timer = null;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    window.removeEventListener('keydown', finish);
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 650);
  };

  const nextSlide = () => {
    if (done) return;
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    if (index >= slides.length) {
      finish();
      return;
    }
    index++;
    timer = setTimeout(nextSlide, 2100);
  };

  splash.addEventListener('click', finish);
  window.addEventListener('keydown', finish, { once: true });
  requestAnimationFrame(nextSlide);
})();