import * as THREE from 'three';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function createLimb(radius, material) {
  const geo = new THREE.CylinderGeometry(radius * 0.85, radius, 1, 10);
  geo.translate(0, 0.5, 0);
  geo.rotateX(Math.PI / 2); // align along +Z for lookAt()
  return new THREE.Mesh(geo, material);
}

export function buildCar(livery = {}) {
  const primary = livery.primary || '#e54b45';
  const secondary = livery.secondary || '#20252c';
  const helmetColor = livery.helmet || '#ffcc39';

  const group = new THREE.Group();

  const mat = {
    primary: new THREE.MeshStandardMaterial({ color: primary, roughness: 0.28, metalness: 0.35 }),
    secondary: new THREE.MeshStandardMaterial({ color: secondary, roughness: 0.4, metalness: 0.3 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.48, metalness: 0.35 }),
    alcantara: new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.95, metalness: 0.05 }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.88, metalness: 0.05 }),
    rim: new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.35, metalness: 0.75 }),
    suit: new THREE.MeshStandardMaterial({ color: primary, roughness: 0.78, metalness: 0.08 }),
    glove: new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.65 }),
    helmet: new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.15, metalness: 0.4 }),
    visor: new THREE.MeshStandardMaterial({ color: 0x050912, roughness: 0.05, metalness: 0.95 }),
    drs: new THREE.MeshStandardMaterial({ color: secondary, roughness: 0.3, metalness: 0.4 }),
  };

  // --- CHASSIS & AERO (+X is forward) ---
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 1.55), mat.carbon);
  floor.position.set(-0.1, 0.12, 0);
  floor.castShadow = true;
  group.add(floor);

  const monocoque = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 0.72), mat.primary);
  monocoque.position.set(0.35, 0.38, 0);
  monocoque.castShadow = true;
  group.add(monocoque);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.2, 0.38), mat.primary);
  nose.position.set(2.15, 0.27, 0);
  nose.rotation.z = -0.08;
  nose.castShadow = true;
  group.add(nose);

  // Sidepods
  [-0.58, 0.58].forEach((z) => {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.38, 0.48), mat.primary);
    pod.position.set(-0.25, 0.35, z);
    pod.castShadow = true;
    group.add(pod);

    const intake = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.34), mat.carbon);
    intake.position.set(0.66, 0.38, z);
    group.add(intake);
  });

  // Engine cover & airbox
  const engineCover = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.46, 0.52), mat.secondary);
  engineCover.position.set(-1.15, 0.54, 0);
  engineCover.castShadow = true;
  group.add(engineCover);

  const airbox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.32, 0.34), mat.primary);
  airbox.position.set(-0.48, 0.88, 0);
  group.add(airbox);

  // Front Wing
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 1.95), mat.secondary);
  frontWing.position.set(2.75, 0.16, 0);
  group.add(frontWing);

  // Rear Wing + DRS Flap
  const rearWingMain = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 1.1), mat.carbon);
  rearWingMain.position.set(-2.22, 0.86, 0);
  group.add(rearWingMain);

  const drsFlap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 1.08), mat.drs);
  drsFlap.position.set(-2.28, 0.96, 0);
  group.add(drsFlap);

  [-0.54, 0.54].forEach((z) => {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.48, 0.04), mat.primary);
    endplate.position.set(-2.22, 0.78, z);
    group.add(endplate);
  });

  // --- WHEELS ---
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.34, 24);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.36, 12);
  rimGeo.rotateX(Math.PI / 2);

  const makeWheel = (x, z, isFront) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.34, z);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, mat.tyre);
    tyre.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, mat.rim);
    spin.add(tyre, rim);
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

  // --- DETAILED COCKPIT INTERIOR ---
  const cockpit = new THREE.Group();
  group.add(cockpit);

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.42), mat.carbon);
  seatBack.position.set(-0.34, 0.44, 0);
  seatBack.rotation.z = 0.34;
  cockpit.add(seatBack);

  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.46), mat.alcantara);
  headrest.position.set(-0.36, 0.64, 0);
  cockpit.add(headrest);

  // Halo (hoop + toggleable center pillar)
  const haloHoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.026, 12, 28, Math.PI * 1.15),
    mat.carbon
  );
  haloHoop.rotation.x = Math.PI / 2;
  haloHoop.rotation.z = -Math.PI * 0.575;
  haloHoop.position.set(0.08, 0.84, 0);
  cockpit.add(haloHoop);

  const haloCenterPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.36, 10),
    mat.carbon
  );
  haloCenterPillar.position.set(0.46, 0.72, 0);
  haloCenterPillar.rotation.z = -0.52;
  cockpit.add(haloCenterPillar);

  // --- STEERING WHEEL + LIVE OLED DISPLAY + SHIFT PADDLES ---
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(0.32, 0.62, 0);
  wheelPivot.rotation.z = 0.24; // tilt face toward driver (-X)
  cockpit.add(wheelPivot);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 10), mat.carbon);
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

  // Buttons & rotary dials
  [0xff2222, 0x22cc44, 0x2288ff, 0xffcc00].forEach((col, i) => {
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 })
    );
    btn.rotation.z = Math.PI / 2;
    btn.position.set(-0.014, -0.042, -0.075 + i * 0.05);
    wheelPivot.add(btn);
  });

  // Live Canvas OLED Dash
  const dashCanvas = document.createElement('canvas');
  dashCanvas.width = 256;
  dashCanvas.height = 128;
  const dashCtx = dashCanvas.getContext('2d');
  const dashTexture = new THREE.CanvasTexture(dashCanvas);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.055),
    new THREE.MeshBasicMaterial({ map: dashTexture })
  );
  screen.rotation.y = -Math.PI / 2; // face driver (-X)
  screen.position.set(-0.014, 0.016, 0);
  wheelPivot.add(screen);

  // Shift paddles behind wheel
  const paddleGeo = new THREE.BoxGeometry(0.006, 0.024, 0.058);
  const leftPaddle = new THREE.Mesh(paddleGeo, mat.carbon);
  leftPaddle.position.set(0.022, 0.01, -0.085);
  wheelPivot.add(leftPaddle);

  const rightPaddle = new THREE.Mesh(paddleGeo, mat.carbon);
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
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc9d2db, roughness: 0.25, metalness: 0.65 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.6 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.65, 1.85), bodyMat);
  body.position.set(0, 0.52, 0);
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.52, 1.5), darkMat);
  cabin.position.set(-0.2, 1.02, 0);
  group.add(cabin);

  const beacon0 = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 1.5 });
  const beacon1 = new THREE.MeshStandardMaterial({ color: 0x22ff55, emissive: 0x22ff55, emissiveIntensity: 1.5 });
  const bLeft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.42), beacon0);
  bLeft.position.set(-0.1, 1.35, -0.26);
  const bRight = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.42), beacon1);
  bRight.position.set(-0.1, 1.35, 0.26);
  group.add(bLeft, bRight);

  return { group, beacons: [beacon0, beacon1], wheels: [], anim: { wheelSpin: 0 } };
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
  if (car.anim) car.anim.wheelSpin += (speed * dt) / 0.34;
  for (const w of car.wheels || []) {
    w.spin.rotation.z = -car.anim.wheelSpin;
    if (w.isFront) w.pivot.rotation.y = -(s.delta || 0);
  }

  // DRS flap
  if (car.drsFlap) {
    car.drsFlap.rotation.z = THREE.MathUtils.lerp(car.drsFlap.rotation.z, drsOpen ? -0.45 : 0.08, Math.min(1, dt * 15));
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