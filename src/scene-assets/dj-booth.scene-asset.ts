import { Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, TorusGeometry, Vector3 } from '@iwsdk/core';
import { alignSpan, bevelBox, placeOnSurface, surfaceFrame } from './lib/hardsurface.js';

/**
 * The rooftop DJ setup. Origin on the floor at the desk's center; the DJ stands
 * behind it (-Z) facing the crowd/camera (+Z). Desk 1.9 x 0.95 x 0.72 m, speaker
 * stacks either side. Named parts: Desk, LedStrip, TurntableL/R (Platter spins),
 * Mixer, SpeakerL/R.
 */
const M = {
  desk: new MeshStandardMaterial({ color: new Color(0x16141c), roughness: 0.45 }),
  trim: new MeshStandardMaterial({ color: new Color(0x2a2733), roughness: 0.3, metalness: 0.6 }),
  deck: new MeshStandardMaterial({ color: new Color(0x2b2b31), roughness: 0.35, metalness: 0.5 }),
  vinyl: new MeshStandardMaterial({ color: new Color(0x08080a), roughness: 0.25 }),
  label: new MeshStandardMaterial({ color: new Color(0xff5fb8), roughness: 0.5, emissive: new Color(0xff5fb8), emissiveIntensity: 0.4 }),
  chrome: new MeshStandardMaterial({ color: new Color(0xd8dbe2), roughness: 0.2, metalness: 0.9 }),
  knob: new MeshStandardMaterial({ color: new Color(0x0d0d10), roughness: 0.5 }),
  cone: new MeshStandardMaterial({ color: new Color(0x1a1a1e), roughness: 0.8 }),
  led: new MeshBasicMaterial({ color: new Color(0x35e0ff) }),
};

const FRONT = new Vector3(0, 0, 1);
const RIGHT = new Vector3(1, 0, 0);

function turntable(name: string, x: number): Group {
  const g = new Group();
  g.name = name;
  const base = new Mesh(bevelBox(0.5, 0.07, 0.38, 0.01), M.deck);
  base.position.y = 0.035;
  const platter = new Group();
  platter.name = 'Platter';
  const ring = new Mesh(new CylinderGeometry(0.155, 0.155, 0.02, 40), M.chrome);
  const record = new Mesh(new CylinderGeometry(0.148, 0.148, 0.006, 40), M.vinyl);
  record.position.y = 0.013;
  const label = new Mesh(new CylinderGeometry(0.05, 0.05, 0.008, 24), M.label);
  label.position.y = 0.014;
  platter.add(ring, record, label);
  platter.position.set(-0.05, 0.08, 0);
  // Tone arm: pivot at the back-right corner, reaching onto the record.
  const pivot = new Vector3(0.18, 0.1, -0.12);
  const tip = new Vector3(0.0, 0.1, 0.06);
  const arm = new Mesh(new CylinderGeometry(0.006, 0.006, 1, 8), M.chrome);
  arm.scale.y = alignSpan(arm, pivot, tip);
  const post = new Mesh(new CylinderGeometry(0.02, 0.025, 0.04, 16), M.chrome);
  post.position.set(pivot.x, 0.09, pivot.z);
  g.add(base, platter, arm, post);
  g.position.set(x, 0.92, 0);
  return g;
}

function mixer(): Group {
  const g = new Group();
  g.name = 'Mixer';
  const body = new Mesh(bevelBox(0.32, 0.07, 0.36, 0.01), M.deck);
  body.position.y = 0.035;
  g.add(body);
  // Knobs in a grid on the top face (the top is axis-aligned: frame = world up).
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 4; r++) {
      const knob = new Mesh(new CylinderGeometry(0.014, 0.016, 0.018, 12), M.knob);
      knob.position.set(-0.08 + c * 0.08, 0.079, -0.13 + r * 0.06);
      g.add(knob);
    }
  }
  for (const x of [-0.06, 0.06]) {
    const fader = new Mesh(bevelBox(0.02, 0.016, 0.03, 0.004), M.chrome);
    fader.position.set(x, 0.078, 0.13);
    g.add(fader);
  }
  g.position.set(0, 0.92, 0);
  return g;
}

function speakerStack(name: string, x: number): Group {
  const g = new Group();
  g.name = name;
  for (let i = 0; i < 2; i++) {
    const cab = new Group();
    const box = new Mesh(bevelBox(0.62, 0.86, 0.5, 0.015), M.desk);
    box.position.y = 0.43;
    cab.add(box);
    // Woofer and tweeter on the front face, placed in the face's own frame.
    const drivers: Array<[number, number]> = [[0.36, 0.2], [0.72, 0.07]];
    for (const [y, r] of drivers) {
      const frame = surfaceFrame(new Vector3(0, y, 0.25), FRONT, RIGHT);
      const driver = new Group();
      const surround = new Mesh(new TorusGeometry(r, r * 0.12, 8, 32), M.trim);
      const cone = new Mesh(new CylinderGeometry(r * 0.92, r * 0.3, r * 0.4, 32, 1, true), M.cone);
      cone.rotation.x = Math.PI / 2;
      cone.position.z = -r * 0.15;
      const cap = new Mesh(new CylinderGeometry(r * 0.28, r * 0.28, 0.01, 20), M.trim);
      cap.rotation.x = Math.PI / 2;
      driver.add(surround, cone, cap);
      placeOnSurface(driver, frame, 0.004);
      cab.add(driver);
    }
    cab.position.y = i * 0.87;
    g.add(cab);
  }
  g.position.set(x, 0, -0.1);
  return g;
}

export function buildDjBooth(): Group {
  const booth = new Group();
  booth.name = 'DjBooth';
  const desk = new Mesh(bevelBox(1.9, 0.92, 0.72, 0.02), M.desk);
  desk.name = 'Desk';
  desk.position.y = 0.46;
  const top = new Mesh(bevelBox(1.96, 0.04, 0.78, 0.008), M.trim);
  top.position.y = 0.9;
  const led = new Group();
  led.name = 'LedStrip';
  for (const y of [0.18, 0.74]) {
    const strip = new Mesh(bevelBox(1.84, 0.025, 0.01, 0.004), M.led);
    strip.position.set(0, y, 0.362);
    led.add(strip);
  }
  booth.add(desk, top, led, turntable('TurntableL', -0.6), mixer(), turntable('TurntableR', 0.6));
  booth.add(speakerStack('SpeakerL', -1.45), speakerStack('SpeakerR', 1.45));
  booth.traverse((o) => {
    if ((o as Mesh).isMesh) o.castShadow = o.receiveShadow = true;
  });
  return booth;
}

export default buildDjBooth();
