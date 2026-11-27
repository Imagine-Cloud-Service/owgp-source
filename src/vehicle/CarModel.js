import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function createLimb(radius, material) {
  const geo = new THREE.CylinderGeometry(radius * 0.85, radius, 1, 10);
  geo.translate(0, 0.5, 0);
  geo.rotateX(Math.PI / 2); // align along +Z for lookAt()
  return new THREE.Mesh(geo, material);
}

function makePaintMaterial(color, finish = 'gloss') {
  if (finish === 'matte') {
    return new THREE.MeshPhysicalMaterial({ color, roughness: 0.78, metalness: 0.08, clearcoat: 0.04 });
  }
  if (finish === 'metallic') {
    return new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, metalness: 0.85, clearcoat: 0.9, clearcoatRoughness: 0.14 });
  }
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.24, metalness: 0.25, clearcoat: 1.0, clearcoatRoughness: 0.1 });
}

function makeDecalTexture(text, textColor = '#ffffff', font = '800 92px Barlow Condensed, Arial, sans-serif') {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = textColor;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text), 128, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function addBox(parent, w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildDetailedWheel(radius, width, mat) {
  const spin = new THREE.Group();

  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 28), mat.tyre);
  tyre.rotation.x = Math.PI / 2;
  tyre.castShadow = true;
  tyre.receiveShadow = true;
  spin.add(tyre);

  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, 0.011, 8, 28), mat.accent);
    stripe.position.z = side * (width * 0.502);
    spin.add(stripe);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.04, 20), mat.rim);
    rim.rotation.x = Math.PI / 2;
    rim.position.z = side * (width * 0.46);
    spin.add(rim);
  }

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.56, 0.026, 0.03), mat.carbon);
    spoke.position.set(Math.cos(a) * radius * 0.25, Math.sin(a) * radius * 0.25, width * 0.49);
    spoke.rotation.z = a;
    spin.add(spoke);
  }

  const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.055, 12), mat.accent);
  nut.rotation.x = Math.PI / 2;
  nut.position.z = width * 0.5;
  spin.add(nut);

  return spin;
}

export function buildCar(livery = {}) {
  const primary = livery.primary || '#e54b45';
  const secondary = livery.secondary || '#f4f6f8';
  const haloColor = livery.halo || '#1d2228';
  const rimColor = livery.rims || '#dfe6ec';
  const helmetColor = livery.helmet || '#ffcc39';
  const finish = livery.finish || 'gloss';
  const sponsor = livery.sponsor || 'APEX';
  const driverNumber = livery.number ?? 7;

  const group = new THREE.Group();

  const mat = {
    primary: makePaintMaterial(primary, finish),
    secondary: makePaintMaterial(secondary, finish),
    halo: new THREE.MeshStandardMaterial({ color: haloColor, roughness: 0.35, metalness: 0.55 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.48, metalness: 0.35 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.3, metalness: 0.85 }),
    alcantara: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95, metalness: 0.05 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.88, metalness: 0.05 }),
    rim: new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.25, metalness: 0.78 }),
    accent: new THREE.MeshStandardMaterial({ color: primary, roughness: 0.3, metalness: 0.4 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xd8e8f5, roughness: 0.05, metalness: 0.98 }),
    harness: new THREE.MeshStandardMaterial({ color: 0xd92626, roughness: 0.7, metalness: 0.1 }),
    brakeDisc: new THREE.MeshStandardMaterial({ color: 0x3b322e, roughness: 0.4, metalness: 0.7 }),
    suit: new THREE.MeshStandardMaterial({ color: primary, roughness: 0.78, metalness: 0.08 }),
    glove: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.65 }),
    helmet: makePaintMaterial(helmetColor, 'gloss'),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x050912, roughness: 0.05, metalness: 0.95, clearcoat: 1 }),
    drs: makePaintMaterial(secondary, finish),
  };

  // --- 1. VENTURI FLOOR & REAR DIFFUSER (+X is forward) ---
  addBox(group, 4.1, 0.06, 1.56, mat.carbon, -0.1, 0.1, 0);
  for (const side of [-1, 1]) {
    addBox(group, 2.35, 0.07, 0.06, mat.secondary, -0.15, 0.12, side * 0.79);
    addBox(group, 0.65, 0.16, 0.03, mat.carbon, 0.85, 0.18, side * 0.69, 0, side * 0.15, 0);
    addBox(group, 0.52, 0.2, 0.025, mat.carbon, -1.96, 0.19, side * 0.36, 0, 0, 0.24);
    addBox(group, 0.52, 0.2, 0.025, mat.carbon, -1.96, 0.19, side * 0.14, 0, 0, 0.24);
  }
  addBox(group, 0.55, 0.04, 1.05, mat.carbon, -1.98, 0.19, 0, 0, 0, 0.28);

  // --- 2. MONOCOQUE TUB, TAPERED NOSE & ENGINE COVER ---
  // Open-top cockpit tub walls so interior is clearly visible
  addBox(group, 1.38, 0.44, 0.12, mat.primary, 0.08, 0.39, -0.34);
  addBox(group, 1.38, 0.44, 0.12, mat.primary, 0.08, 0.39, 0.34);
  addBox(group, 1.38, 0.08, 0.62, mat.carbon, 0.08, 0.17, 0);

  // Forward bulkhead & sculpted tapered nose cone
  addBox(group, 0.95, 0.36, 0.62, mat.primary, 1.15, 0.37, 0, 0, 0, -0.08);
  const noseGeo = new THREE.CylinderGeometry(0.11, 0.28, 1.36, 16);
  noseGeo.rotateZ(-Math.PI / 2);
  noseGeo.scale(1, 0.62, 1.12);
  const nose = new THREE.Mesh(noseGeo, mat.primary);
  nose.position.set(2.14, 0.26, 0);
  nose.rotation.z = -0.09;
  nose.castShadow = true;
  nose.receiveShadow = true;
  group.add(nose);

  // Secondary nose stripe & driver number decal
  addBox(group, 1.45, 0.03, 0.18, mat.secondary, 1.74, 0.43, 0, 0, 0, -0.11);
  const numTex = makeDecalTexture(driverNumber, secondary === '#f4f6f8' ? '#101820' : '#ffffff');
  const noseNum = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.22),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false })
  );
  noseNum.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
  noseNum.position.set(1.7, 0.455, 0);
  group.add(noseNum);

  // Nose camera pods
  for (const side of [-1, 1]) {
    addBox(group, 0.14, 0.04, 0.16, mat.carbon, 1.98, 0.32, side * 0.24);
  }

  // Engine cover, airbox intake, shark fin & broadcast T-cam
  addBox(group, 1.42, 0.5, 0.56, mat.primary, -1.16, 0.45, 0, 0, 0, 0.12);
  addBox(group, 0.65, 0.34, 0.34, mat.carbon, -1.94, 0.34, 0, 0, 0, 0.08);
  addBox(group, 0.55, 0.32, 0.34, mat.primary, -0.58, 0.84, 0, 0, 0, 0.14);
  addBox(group, 0.08, 0.18, 0.24, mat.carbon, -0.32, 0.86, 0);
  addBox(group, 1.15, 0.3, 0.03, mat.primary, -1.28, 0.84, 0, 0, 0, 0.06);
  addBox(group, 1.05, 0.06, 0.036, mat.secondary, -1.26, 0.98, 0, 0, 0, 0.06);
  addBox(group, 0.12, 0.12, 0.05, mat.carbon, -0.48, 1.06, 0);
  addBox(group, 0.09, 0.045, 0.38, new THREE.MeshStandardMaterial({ color: 0xffd000, roughness: 0.3 }), -0.48, 1.12, 0);

  // --- 3. UNDERCUT SIDEPODS, COOLING LOUVRES & SPONSOR DECALS ---
  const sponsorTex = makeDecalTexture(sponsor, '#ffffff', '800 62px Barlow Condensed, sans-serif');
  const sponsorMat = new THREE.MeshBasicMaterial({ map: sponsorTex, transparent: true, depthWrite: false });
  for (const side of [-1, 1]) {
    addBox(group, 1.68, 0.34, 0.44, mat.primary, -0.45, 0.39, side * 0.56, 0, side * -0.05, 0.05);
    addBox(group, 1.38, 0.18, 0.34, mat.secondary, -0.52, 0.22, side * 0.51, 0, side * -0.06, 0.04);
    addBox(group, 0.12, 0.24, 0.36, mat.carbon, 0.38, 0.41, side * 0.58, 0, side * -0.1, 0);
    for (let i = 0; i < 4; i++) {
      addBox(group, 0.09, 0.015, 0.22, mat.carbon, -0.22 - i * 0.18, 0.57 - i * 0.01, side * 0.53);
    }
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.26), sponsorMat);
    decal.position.set(-0.45, 0.4, side * 0.785);
    decal.rotation.y = side > 0 ? 0 : Math.PI;
    group.add(decal);
  }

  // --- 4. MULTI-ELEMENT FRONT WING ---
  addBox(group, 0.38, 0.03, 1.9, mat.carbon, 2.56, 0.12, 0, 0, 0, 0.05);
  addBox(group, 0.22, 0.025, 1.84, mat.primary, 2.42, 0.18, 0, 0, 0, 0.22);
  addBox(group, 0.16, 0.02, 1.78, mat.secondary, 2.3, 0.23, 0, 0, 0, 0.34);
  for (const side of [-1, 1]) {
    addBox(group, 0.24, 0.16, 0.03, mat.carbon, 2.46, 0.21, side * 0.11);
    addBox(group, 0.5, 0.28, 0.035, mat.primary, 2.46, 0.24, side * 0.95);
    addBox(group, 0.34, 0.025, 0.1, mat.secondary, 2.46, 0.27, side * 0.99, 0, 0, 0.22);
  }

  // --- 5. REAR WING + ANIMATED DRS FLAP + EXHAUST + FIA RAIN LIGHT ---
  for (const side of [-1, 1]) {
    addBox(group, 0.16, 0.44, 0.03, mat.carbon, -2.14, 0.61, side * 0.14, 0, 0, -0.14);
    addBox(group, 0.5, 0.56, 0.035, mat.primary, -2.22, 0.68, side * 0.53);
    addBox(group, 0.46, 0.05, 0.04, mat.secondary, -2.22, 0.94, side * 0.53);
  }
  addBox(group, 0.2, 0.03, 1.0, mat.carbon, -2.18, 0.43, 0, 0, 0, 0.22);
  addBox(group, 0.26, 0.035, 1.02, mat.carbon, -2.24, 0.8, 0, 0, 0, 0.14);

  const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.032, 1.0), mat.drs);
  drsFlap.position.set(-2.28, 0.92, 0);
  drsFlap.castShadow = true;
  group.add(drsFlap);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.25, 14), mat.darkMetal);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-2.22, 0.4, 0);
  group.add(exhaust);

  const rainLightMat = new THREE.MeshStandardMaterial({
    color: 0xff1a1a,
    emissive: 0xff1a1a,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.06), rainLightMat);
  rainLight.position.set(-2.26, 0.28, 0);
  group.add(rainLight);

  // --- 6. DOUBLE-WISHBONE SUSPENSION, BRAKE DISCS & 4 DETAILED WHEELS ---
  const makeWheel = (x, z, isFront) => {
    const side = Math.sign(z);
    if (isFront) {
      addBox(group, 0.04, 0.024, 0.68, mat.carbon, x - 0.03, 0.36, side * 0.46, 0, side * -0.14, 0);
      addBox(group, 0.04, 0.024, 0.68, mat.carbon, x - 0.03, 0.22, side * 0.46, 0, side * 0.1, 0);
      addBox(group, 0.025, 0.025, 0.64, mat.darkMetal, x - 0.18, 0.32, side * 0.45, side * 0.25, side * -0.18, 0);
    } else {
      addBox(group, 0.045, 0.026, 0.7, mat.carbon, x + 0.03, 0.37, side * 0.46, 0, side * 0.12, 0);
      addBox(group, 0.045, 0.026, 0.7, mat.carbon, x + 0.03, 0.22, side * 0.46, 0, side * -0.1, 0);
    }

    const pivot = new THREE.Group();
    pivot.position.set(x, isFront ? 0.35 : 0.36, z);

    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 18), mat.brakeDisc);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = -side * 0.15;
    pivot.add(disc);

    const spin = buildDetailedWheel(isFront ? 0.35 : 0.36, isFront ? 0.32 : 0.4, mat);
    pivot.add(spin);
    group.add(pivot);
    return { pivot, spin, isFront };
  };

  const wheels = [
    makeWheel(1.75, -0.92, true),
    makeWheel(1.75, 0.92, true),
    makeWheel(-1.55, -0.94, false),
    makeWheel(-1.55, 0.94, false),
  ];

  // --- 7. DETAILED COCKPIT INTERIOR (SEAT, HARNESS, MIRRORS, HALO, WHEEL, DRIVER) ---
  const cockpit = new THREE.Group();
  group.add(cockpit);

  addBox(cockpit, 0.08, 0.52, 0.42, mat.carbon, -0.34, 0.44, 0, 0, 0, 0.34);
  addBox(cockpit, 0.28, 0.2, 0.46, mat.alcantara, -0.36, 0.64, 0);

  for (const side of [-1, 1]) {
    addBox(cockpit, 0.62, 0.1, 0.07, mat.alcantara, 0.02, 0.6, side * 0.28);
    addBox(cockpit, 0.32, 0.025, 0.055, mat.harness, -0.12, 0.48, side * 0.1, 0, 0, 0.34);
    // Wing mirrors with reflective glass
    addBox(cockpit, 0.05, 0.1, 0.18, mat.carbon, 0.46, 0.64, side * 0.46);
    addBox(cockpit, 0.12, 0.07, 0.16, mat.primary, 0.47, 0.69, side * 0.58);
    addBox(cockpit, 0.015, 0.055, 0.13, mat.mirror, 0.41, 0.69, side * 0.58);
  }

  // Halo (hoop + toggleable center pillar)
  const haloHoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.028, 12, 28, Math.PI * 1.15),
    mat.halo
  );
  haloHoop.rotation.x = Math.PI / 2;
  haloHoop.rotation.z = -Math.PI * 0.575;
  haloHoop.position.set(0.08, 0.84, 0);
  cockpit.add(haloHoop);

  const haloCenterPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.36, 10),
    mat.halo
  );
  haloCenterPillar.position.set(0.46, 0.72, 0);
  haloCenterPillar.rotation.z = -0.52;
  cockpit.add(haloCenterPillar);

  // --- STEERING WHEEL + LIVE OLED DISPLAY + SHIFT PADDLES ---
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0.32, 0.62, 0);
  wheelPivot.rotation.z = 0.24; // tilt face toward driver (-X)
  cockpit.add(wheelPivot);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), mat.darkMetal);
  column.rotation.z = Math.PI / 2;
  column.position.x = 0.12;
  wheelPivot.add(column);

  const wheelBody = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.145, 0.28), mat.carbon);
  wheelPivot.add(wheelBody);

  [-0.13, 0.13].forEach((z) => {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.095, 6, 10), mat.alcantara);
    grip.position.set(-0.005, 0, z);
    wheelPivot.add(grip);
  });

  [0xff2222, 0x22cc44, 0x2288ff, 0xffcc00].forEach((col, i) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.009, 0.009, 0.012, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 })
    );
    btn.rotation.z = Math.PI / 2;
    btn.position.set(-0.015, -0.042, -0.075 + i * 0.05);
    wheelPivot.add(btn);
  });

  // Live Canvas OLED Dash
  const dashCanvas = document.createElement('canvas');
  dashCanvas.width = 256;
  dashCanvas.height = 128;
  const dashCtx = dashCanvas.getContext('2d');
  const dashTexture = new THREE.CanvasTexture(dashCanvas);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.115, 0.058),
    new THREE.MeshBasicMaterial({ map: dashTexture })
  );
  screen.rotation.y = -Math.PI / 2; // face driver (-X)
  screen.position.set(-0.014, 0.016, 0);
  wheelPivot.add(screen);

  // Shift paddles behind wheel
  const paddleGeo = new THREE.BoxGeometry(0.006, 0.024, 0.058);
  const leftPaddle = new THREE.Mesh(paddleGeo, mat.darkMetal);
  leftPaddle.position.set(0.022, 0.01, -0.085);
  wheelPivot.add(leftPaddle);

  const rightPaddle = new THREE.Mesh(paddleGeo, mat.darkMetal);
  rightPaddle.position.set(0.022, 0.01, 0.085);
  wheelPivot.add(rightPaddle);

  // Hand anchor targets on wheel grips
  const leftHandTarget = new THREE.Object3D();
  leftHandTarget.position.set(-0.016, 0, -0.13);
  wheelPivot.add(leftHandTarget);

  const rightHandTarget = new THREE.Object3D();
  rightHandTarget.position.set(-0.016, 0, 0.13);
  wheelPivot.add(rightHandTarget);

  // --- ARTICULATED DRIVER ---
  const driverGroup = new THREE.Group();
  cockpit.add(driverGroup);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.28, 8, 14), mat.suit);
  torso.position.set(-0.14, 0.48, 0);
  torso.rotation.z = 0.34;
  driverGroup.add(torso);

  const helmetPivot = new THREE.Group();
  helmetPivot.position.set(-0.12, 0.74, 0);
  driverGroup.add(helmetPivot);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 20), mat.helmet);
  helmet.scale.set(1.08, 1.0, 0.95);
  helmetPivot.add(helmet);

  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.137, 20, 14, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.34, Math.PI * 0.24),
    mat.visor
  );
  visor.rotation.y = Math.PI / 2; // face +X
  helmetPivot.add(visor);

  const leftShoulder = new THREE.Vector3(-0.1, 0.59, -0.17);
  const rightShoulder = new THREE.Vector3(-0.1, 0.59, 0.17);

  const leftArm = createLimb(0.036, mat.suit);
  const rightArm = createLimb(0.036, mat.suit);
  const handGeo = new THREE.SphereGeometry(0.036, 10, 10);
  const leftHand = new THREE.Mesh(handGeo, mat.glove);
  const rightHand = new THREE.Mesh(handGeo, mat.glove);
  driverGroup.add(leftArm, rightArm, leftHand, rightHand);

  return {
    group,
    wheels,
    drsFlap,
    haloCenterPillar,
    rainLightMat,
    helmetPivot,
    wheelPivot,
    leftPaddle,
    rightPaddle,
    leftHandTarget,
    rightHandTarget,
    driverGroup,
    leftShoulder,
    rightShoulder,
    leftArm,
    rightArm,
    leftHand,
    rightHand,
    dashCtx,
    dashTexture,
    anim: {
      wheelSpin: 0,
      steerAngle: 0,
      lastGear: 1,
      shiftTimer: 0,
      shiftDir: 0,
      lastTime: performance.now(),
    },
  };
}

export function buildSafetyCar() {
  const group = new THREE.Group();
  const bodyMat = makePaintMaterial('#0d6e4e', 'metallic');
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0c1620, roughness: 0.08, metalness: 0.85, clearcoat: 1 });
  const mat = {
    carbon: new THREE.MeshStandardMaterial({ color: 0x181c22, roughness: 0.5, metalness: 0.4 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.88 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 0.25, metalness: 0.85 }),
    accent: new THREE.MeshStandardMaterial({ color: 0xe5ff00, roughness: 0.3 }),
  };

  addBox(group, 4.45, 0.58, 1.88, bodyMat, 0, 0.49, 0);
  addBox(group, 2.05, 0.46, 1.56, glassMat, -0.2, 0.95, 0);
  addBox(group, 0.45, 0.06, 1.92, mat.carbon, 2.1, 0.2, 0);
  addBox(group, 0.26, 0.05, 1.82, mat.carbon, -2.02, 0.97, 0, 0, 0, 0.16);
  for (const side of [-1, 1]) {
    addBox(group, 0.14, 0.24, 0.04, mat.carbon, -2.0, 0.85, side * 0.65);
  }

  const beacon0 = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.5 });
  const beacon1 = new THREE.MeshStandardMaterial({ color: 0x22ff55, emissive: 0x22ff55, emissiveIntensity: 1.5 });
  addBox(group, 0.18, 0.08, 0.86, mat.carbon, -0.15, 1.22, 0);
  addBox(group, 0.16, 0.09, 0.34, beacon0, -0.15, 1.25, -0.22);
  addBox(group, 0.16, 0.09, 0.34, beacon1, -0.15, 1.25, 0.22);

  const wheels = [];
  for (const [x, z, isFront] of [[1.42, -0.92, true], [1.42, 0.92, true], [-1.38, -0.92, false], [-1.38, 0.92, false]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.34, z);
    const spin = buildDetailedWheel(0.34, 0.28, mat);
    pivot.add(spin);
    group.add(pivot);
    wheels.push({ pivot, spin, isFront });
  }

  return { group, beacons: [beacon0, beacon1], wheels, anim: { wheelSpin: 0, lastTime: performance.now() } };
}

function updateArm(driverGroup, armMesh, handMesh, shoulderPos, worldTarget) {
  const localTarget = driverGroup.worldToLocal(worldTarget.clone());
  handMesh.position.copy(localTarget);
  armMesh.position.copy(shoulderPos);
  armMesh.lookAt(worldTarget);
  armMesh.scale.set(1, 1, Math.max(0.05, shoulderPos.distanceTo(localTarget)));
}

function drawDash(ctx, texture, gear, rpm, speedKmh) {
  ctx.fillStyle = '#080b10';
  ctx.fillRect(0, 0, 256, 128);

  const ratio = clamp(rpm / 13500, 0, 1);
  for (let i = 0; i < 15; i++) {
    const lit = ratio > (i + 1) / 16;
    ctx.fillStyle = !lit ? '#22262e' : i < 5 ? '#00ff55' : i < 10 ? '#ff2222' : '#3388ff';
    ctx.beginPath();
    ctx.arc(16 + i * 16, 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 62px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(gear <= 0 ? 'N' : String(gear), 128, 86);

  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 22px monospace';
  ctx.fillText(`${Math.round(speedKmh)} KM/H`, 128, 116);
  texture.needsUpdate = true;
}

export function poseCar(car, s, drsOpen = false) {
  const now = performance.now();
  const dt = Math.min(0.05, (now - (car.anim?.lastTime || now)) / 1000);
  if (car.anim) car.anim.lastTime = now;

  // Position & orientation (+X forward -> rotation.y = -s.th)
  car.group.position.set(s.x, 0, s.z);
  car.group.rotation.y = -s.th;

  // Spin & steer wheels
  const speed = Math.hypot(s.vx || 0, s.vy || 0);
  if (car.anim) car.anim.wheelSpin += (speed * dt) / 0.35;
  for (const w of car.wheels || []) {
    w.spin.rotation.z = -car.anim.wheelSpin;
    if (w.isFront) w.pivot.rotation.y = -(s.delta || 0);
  }

  // DRS flap
  if (car.drsFlap) {
    car.drsFlap.rotation.z = THREE.MathUtils.lerp(car.drsFlap.rotation.z, drsOpen ? -0.45 : 0.08, Math.min(1, dt * 15));
  }

  // Flashing FIA rear rain/ERS light
  if (car.rainLightMat) {
    const blink = Math.floor(now / 160) % 2 === 0;
    car.rainLightMat.emissiveIntensity = (s.ax < -8 || blink) ? 2.4 : 0.35;
  }

  if (!car.wheelPivot) return; // safety car stops here

  // Steering wheel rotation (rotates around local X)
  const targetWheel = clamp((s.delta || 0) * 3.8, -1.9, 1.9);
  car.anim.steerAngle = THREE.MathUtils.lerp(car.anim.steerAngle, targetWheel, Math.min(1, dt * 18));
  car.wheelPivot.rotation.x = car.anim.steerAngle;

  // Gear shift paddle flick
  const gear = s.gear ?? 1;
  if (gear !== car.anim.lastGear) {
    car.anim.shiftDir = gear > car.anim.lastGear ? 1 : -1;
    car.anim.shiftTimer = 0.16;
    car.anim.lastGear = gear;
  }

  let leftPull = 0;
  let rightPull = 0;
  if (car.anim.shiftTimer > 0) {
    car.anim.shiftTimer = Math.max(0, car.anim.shiftTimer - dt);
    const pulse = Math.sin((car.anim.shiftTimer / 0.16) * Math.PI);
    if (car.anim.shiftDir > 0) rightPull = pulse;
    else leftPull = pulse;
  }

  car.rightPaddle.rotation.y = rightPull * 0.35;
  car.leftPaddle.rotation.y = -leftPull * 0.35;
  car.rightHandTarget.position.x = -0.016 + rightPull * 0.018;
  car.leftHandTarget.position.x = -0.016 + leftPull * 0.018;

  // Lock driver hands & arms to wheel grips
  car.group.updateMatrixWorld(true);
  const leftWorld = new THREE.Vector3();
  const rightWorld = new THREE.Vector3();
  car.leftHandTarget.getWorldPosition(leftWorld);
  car.rightHandTarget.getWorldPosition(rightWorld);

  updateArm(car.driverGroup, car.leftArm, car.leftHand, car.leftShoulder, leftWorld);
  updateArm(car.driverGroup, car.rightArm, car.rightHand, car.rightShoulder, rightWorld);

  // Driver helmet looks into corners
  car.helmetPivot.rotation.y = THREE.MathUtils.lerp(
    car.helmetPivot.rotation.y,
    -(s.delta || 0) * 0.55,
    Math.min(1, dt * 10)
  );

  // Update steering wheel OLED screen
  drawDash(car.dashCtx, car.dashTexture, gear, s.rpm || 3500, speed * 3.6);
}