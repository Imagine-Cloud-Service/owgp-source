export const STEP = 1 / 240;

export const PHYSICS = {
  m: 798,             // dry car mass (kg)
  Iz: 1200,           // yaw inertia
  a: 1.75,            // front axle to CG (m)
  b: 1.65,            // rear axle to CG (m)
  rho: 1.225,         // air density (kg/m^3)
  ClA: 4.4,           // stronger F1 downforce
  CdA: 1.05,          // drag coeff * area
  aeroFront: 0.42,    // slightly more rear downforce to prevent oversteer
  mu: 2.15,           // higher peak tyre friction
  kf: 22,             // sharper front turn-in
  kr: 28,             // planted rear axle (stops tail-out drifting)
  rolling: 0.015,     // rolling resistance
  maxSteer: 0.45,     // max steering angle (rad)
  steerFade: 28,      // calmer steering at high speed (m/s)
  power: 740000,      // engine power (W)
  brakeMax: 32000,    // max braking force (N)
  idleRpm: 3500,
  redRpm: 13500,
  gearTop: [28, 40, 52, 64, 76, 86, 94, 102], // 8-speed top speeds (m/s)
};

export const RACE = {
  laps: 3,
  opponents: 5,
  pitServiceSeconds: 4.5,
  pitSpeedKmh: 70,
  safetyCarSeconds: 22,
  carHitRadius: 3.8,
};

export const WEATHER = { dry: 0, changeable: 0.38, wet: 0.78 };
export const WEATHER_DEFAULT = { wetness: 0 };
export const ERS = { capacityMJ: 4, deploymentKW: 120, regenKW: 70 };
export const TYRES = {
  soft: { grip: 1.08, wear: 1.5 },
  medium: { grip: 1, wear: 1 },
  hard: { grip: 0.94, wear: 0.68 },
};

export const TRACKS = {
  monza: {
    id: 'monza',
    name: 'Autodromo Nazionale Monza',
    theme: 'park',
    width: 14,
    kerb: 1.5,
    wallOffset: 10.5,
    drsZones: [[0.88, 0.99], [0.44, 0.57]],
    pitLane: { start: 0.86, end: 0.04, offset: -11.5, width: 5.0, box: 0.96 },
    scale: 1.0,
    points: [
      [0, 0, 0], [240, 0, 0], [280, 0, 18], [305, 0, 14],
      [385, 0, 50], [435, 0, 130], [415, 0, 165], [430, 0, 195],
      [380, 0, 250], [310, 0, 260], [250, 0, 215], [115, 0, 190],
      [85, 0, 165], [55, 0, 185], [20, 0, 165], [-140, 0, 145],
      [-195, 0, 95], [-165, 0, 18], [-80, 0, 0],
    ],
  },
  monaco: {
    id: 'monaco',
    name: 'Circuit de Monaco',
    theme: 'city',
    width: 10.0,
    kerb: 0.9,
    wallOffset: 6.4,
    drsZones: [[0.91, 0.99]],
    pitLane: { start: 0.88, end: 0.03, offset: 8.5, width: 4.5, box: 0.95 },
    scale: 1.0,
    points: [
      [0, 0, 0], [115, 0, -5], [140, 0, -75], [170, 0, -145],
      [215, 0, -165], [255, 0, -135], [235, 0, -95], [268, 0, -75],
      [270, 0, -35], [215, 0, 30], [150, 0, 75], [125, 0, 62],
      [95, 0, 92], [55, 0, 108], [28, 0, 96], [-18, 0, 110],
      [-52, 0, 82], [-42, 0, 18],
    ],
  },
  spa: {
    id: 'spa',
    name: 'Circuit de Spa-Francorchamps',
    theme: 'forest',
    width: 13.5,
    kerb: 1.5,
    wallOffset: 10.5,
    drsZones: [[0.14, 0.30], [0.93, 0.99]],
    pitLane: { start: 0.89, end: 0.06, offset: -11.5, width: 5.2, box: 0.97 },
    scale: 1.0,
    points: [
      [0, 0, 0], [115, 0, 0], [145, 0, 38], [195, 0, 95],
      [250, 0, 125], [385, 0, 175], [445, 0, 175], [465, 0, 215],
      [415, 0, 260], [370, 0, 230], [295, 0, 265], [230, 0, 235],
      [195, 0, 195], [95, 0, 150], [-45, 0, 88], [-82, 0, 58],
      [-65, 0, 26], [-55, 0, 0],
    ],
  },
  interlagos: {
    id: 'interlagos',
    name: 'Interlagos (São Paulo)',
    theme: 'stadium',
    width: 13.0,
    kerb: 1.5,
    wallOffset: 10.0,
    drsZones: [[0.84, 0.99], [0.18, 0.31]],
    pitLane: { start: 0.85, end: 0.05, offset: 11.0, width: 5.0, box: 0.96 },
    scale: 1.0,
    points: [
      [0, 0, 0], [140, 0, 0], [168, 0, -28], [145, 0, -58],
      [188, 0, -100], [275, 0, -155], [298, 0, -198], [215, 0, -215],
      [155, 0, -170], [115, 0, -125], [82, 0, -158], [40, 0, -112],
      [-35, 0, -78], [-98, 0, -38], [-65, 0, -5],
    ],
  },
  suzuka: {
    id: 'suzuka',
    name: 'Suzuka International',
    theme: 'suzuka',
    width: 12.5,
    kerb: 1.4,
    wallOffset: 9.8,
    drsZones: [[0.90, 0.99]],
    pitLane: { start: 0.88, end: 0.04, offset: -11.0, width: 5.0, box: 0.96 },
    scale: 1.0,
    points: [
      [0, 0, 0], [185, 0, 0], [225, 0, 48], [188, 0, 85],
      [215, 0, 122], [178, 0, 158], [115, 0, 180], [72, 0, 148],
      [25, 0, 115], [-28, 0, 168], [-62, 0, 150], [-118, 0, 218],
      [-188, 0, 210], [-145, 0, 115], [25, 0, 115], [95, 0, 62],
      [38, 0, 22], [10, 0, 32], [-48, 0, 8],
    ],
  },
};

export const TRACK = TRACKS.monza;