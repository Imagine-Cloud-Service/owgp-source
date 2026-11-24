# Open-Wheel Grand Prix — Phase 1

A browser-based stylised 3D open-wheel racing project built with Three.js and Vite. The project layout follows the example you provided: simulation, circuit, environment, vehicle, camera, input, HUD, and audio are separate modules.

## Included in Phase 1

- Five selectable Grand Prix circuits based on the real Monza, Monaco, Spa-Francorchamps, Interlagos, and Suzuka layouts. Each course uses its published lap length, track-specific width, DRS/pit zones, and a venue-specific stadium scene. The control-point outlines are map-traced game geometry scaled to those official centreline lengths, not surveyed GPS polylines.
- Kerbs, barriers, runoff, start lights, multi-tier crowd stands, catch fencing, floodlights, braking boards, trees, city blocks, hills, and a live track map.
- Five AI opponents following the circuit with braking, steering, lane placement, and lap progress.
- Three-lap sprint and five-lap Grand Prix race distances, grid countdown, position, sectors, lap times, best lap, pause, reset, and finish results.
- Procedurally built low-poly open-wheel cars with sculpted chassis, multi-element wings, Halo, driver helmet, numbered nose and engine cover, steerable front wheels, rotating tyres, and animated DRS flap.
- A live 3D workshop home screen and rotating garage display with the player's car staged beside the Garage & Skins controls, plus presets and color controls for body, wings, Halo, rims, and helmet. Driver, team, and number are saved in browser storage.
- Separate Home, Garage & Skins, and Settings screens. Camera, graphics, control layout, race setup, and livery preferences save automatically in browser storage.
- Dry, changeable, and wet conditions. Wet grip affects car handling and AI pace; changeable conditions shift during the race and rain is rendered in the scene.
- DRS zones with an activation gate, one-second gap check, weather/safety-car lockout, drag reduction, and a speed HUD.
- Track-limit warnings with a five-second penalty after repeated violations.
- A marked parallel pit lane with a 70 km/h limiter, pit box, and selectable tyre change.
- Collision response for car-to-car and barrier impacts, damage-related handling loss, impact feedback, and safety-car deployment after heavy crashes.
- Fuel load changes vehicle mass and fuel burns over the race. ERS deployment and braking regeneration use a finite battery. Soft, medium, and hard tyres have different grip and wear rates.
- Cockpit/Helmet and TV Pod/T-Cam views. The cockpit eye point stays locked to the chassis during acceleration and braking, with subtle speed-linked FOV widening, slight steering look-to-apex, and a Halo center-pillar toggle.
- The cockpit steering wheel animates with front-wheel steering angle; automatic 8-speed shifts drive upshift cuts and downshift bark/crackle cues.
- Low / Medium / High graphics profiles adjust pixel density, shadows, tree/crowd detail, and stadium scenery.
- Keyboard, gamepad, and touch driving controls.
- Pit service with a low-speed requirement and a time penalty.
- Fixed-step single-track vehicle physics with tyre slip, a friction circle, aerodynamic drag and downforce, power-limited traction, braking, and an automatic eight-speed gearbox.
- Procedural engine audio through Web Audio.
- Synthesized hybrid engine layers, turbo whine, speed-based wind, lift-off pops, shift thumps, and tyre scrub. Master volume and mute save with the setup; audio starts on Start Race and fades when leaving the race.

Physics is a tunable game simulation using SI units and a single-track bicycle model. It is not a validated F1 engineering simulator. Phase 1 is local single-player; online multiplayer and licensed real-world F1 content remain future work.

## Circuit reference data

The selectable layouts and published lap lengths are based on circuit reference maps/data: [Monza](https://www.monzanet.it/en/circuit/) (5.793 km), [Monaco FIA circuit map](https://www.fia.com/system/files/decision-document/2025_monaco_grand_prix_-_race_directors_event_notes_-_circuit_map_pit_lane_map_ers_battery_containment_area_red_zones.pdf) (3.337 km), [Spa-Francorchamps](https://www.formula1.com/en/information/belgium-circuit-de-spa-francorchamps.3LltuYaAXVRU8iezEsjzGw) (7.004 km), [Interlagos official circuit](https://autodromodeinterlagos.prefeitura.sp.gov.br/pistaoficial) (4.309 km), and [Suzuka course guide](https://www.suzukacircuit.jp/eng/course_s/) (5.807 km). The in-game spline control points are simplified map traces, normalized to each published lap length.

Wheel input uses the browser Gamepad API (steering axis and analog throttle/brake triggers). Collision rumble works on compatible gamepads. Constant-force output is sent only if a wheel/browser adapter exposes it; standard browser gamepad support does not provide universal steering torque feedback.

## Project structure

```text
Open-Wheel-Grand-Prix/
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── config.js
│   ├── style.css
│   ├── audio/EngineAudio.js
│   ├── camera/CameraRig.js
│   ├── core/Game.js
│   ├── core/Input.js
│   ├── physics/CarPhysics.js
│   ├── ui/HUD.js
│   ├── vehicle/CarModel.js
│   ├── vehicle/GaragePreview.js
│   └── world/{Environment,Track}.js
└── tests/physics.test.js
```

## Install and run on Windows

1. Install **Node.js 18 or newer** from [nodejs.org](https://nodejs.org/). The installer includes npm.
2. Extract the project ZIP to a folder you can write to, such as `C:\Games\Open-Wheel-Grand-Prix`.
3. In File Explorer, open that folder. Click the address bar, type `powershell`, then press Enter. PowerShell should open in the project folder.
4. Install the project dependencies:

   ```powershell
   npm install
   ```

5. Start the development server:

   ```powershell
   npm run dev
   ```

6. Open the local address shown in PowerShell, normally [http://localhost:5173](http://localhost:5173).
7. The Home screen opens with a live garage display. Use **Garage & Skins** to customize the driver, number, and livery, and **Settings** to choose the circuit, weather, race distance, fuel, tyres, camera FOV, camera movement, controls, and graphics quality. Changes save automatically. Choose **Start Race** when ready.
8. To stop the server, return to PowerShell and press **Ctrl+C**.

For a production build, run `npm run build`. To preview that build locally, run `npm run preview`.

## Controls

| Action | Keyboard | Gamepad | Touch screen |
| --- | --- | --- | --- |
| Throttle | W or ↑ | RT | GO |
| Brake | S or ↓ | LT | BRAKE |
| Steer | A/D or ←/→ | Left stick | ◀ / ▶ |
| Toggle camera | C | Y | CAM |
| ERS deployment | E | LB | ERS button |
| DRS | X (in a DRS zone, within 1 second of the car ahead) | RB | DRS button |
| Toggle Halo center pillar | H | — | HALO button |
| Reset to track | R | X | — |
| Pause / resume | P or Esc | — | Pause button |
| Pit service | M | — | PIT button |

For pit service, turn right onto the marked pit lane, reach your pit box, and slow to **70 km/h or below**. The limiter engages while driving in the marked lane. Press **M** or select the PIT button to fit the compound selected in the pit HUD. One stop is available per race and service takes 4.5 seconds.

ERS stores up to 4 MJ. Toggle deployment on and it adds power while charge remains; braking recharges the pack. Fuel choice sets starting vehicle mass and fuel is consumed as you drive. Soft tyres provide the most grip and wear fastest; hard tyres last longer. Pitting replaces the tyres but does not refuel the car. Repeated excursions beyond the kerbs earn warnings and then a five-second penalty. A heavy collision can deploy a pace-controlled safety car, disable DRS, and limit the field speed.

## Circuits and physics tuning

Circuit control points and widths are in `src/config.js`. Track geometry is generated from a centripetal Catmull–Rom spline in `src/world/Track.js`. Vehicle parameters such as mass, power, aero, tyres, steering, brakes, and gearbox speeds are in `src/config.js` under `PHYSICS`.

The headless physics checks are available with:

```powershell
npm run test:physics
```

## Suggested Phase 2

Add race-control yellow flags, improved safety-car restart and passing procedures, damage/repair strategy, more expressive AI overtaking, audio samples, saveable career progression, and server-authoritative multiplayer.
