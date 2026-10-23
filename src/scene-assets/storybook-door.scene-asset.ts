/**
 * Storybook door that appears on the real wall, ~42 cm tall. Origin = bottom
 * center on the wall, front faces +Z (toward the user), Y up. "Panel" hinges
 * at its left edge (rotation.y opens it toward the user); "Light" is the warm
 * glow behind it, revealed as it opens.
 */
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';
import { ADDITIVE_LIGHT } from '../visuals/glow-materials.js';

const W = 0.24;
const H = 0.32;
const ARCH_R = W / 2;
const DEPTH = 0.012;
const frameMat = new MeshStandardMaterial({ color: Palette.paper, roughness: 0.95, flatShading: true });
const panelMat = new MeshStandardMaterial({ color: Palette.pinkSoft, roughness: 0.9, flatShading: true });
const windowMat = new MeshBasicMaterial({ color: Palette.lanternGlow });
const lightMat = new MeshBasicMaterial({ color: Palette.lanternAmber, transparent: true, opacity: 0.9, ...ADDITIVE_LIGHT });

const sideGeo = new BoxGeometry(0.022, H, DEPTH * 1.6);
const archGeo = new CylinderGeometry(ARCH_R + 0.011, ARCH_R + 0.011, DEPTH * 1.6, 20, 1, false, -Math.PI / 2, Math.PI);
const panelGeo = new BoxGeometry(W - 0.006, H - 0.004, DEPTH);
const panelArchGeo = new CylinderGeometry(ARCH_R - 0.003, ARCH_R - 0.003, DEPTH, 20, 1, false, -Math.PI / 2, Math.PI);
const windowGeo = new CircleGeometry(0.028, 16);
const knobGeo = new CylinderGeometry(0.008, 0.008, 0.01, 8);
const lightGeo = new PlaneGeometry(W, H + ARCH_R);

export function createStorybookDoor(): Object3D {
  const root = new Group();
  root.name = 'StorybookDoor';
  for (const side of [-1, 1]) {
    const post = new Mesh(sideGeo, frameMat);
    post.name = side < 0 ? 'PostL' : 'PostR';
    post.position.set((W / 2 + 0.011) * side, H / 2, 0);
    root.add(post);
  }
  const arch = new Mesh(archGeo, frameMat);
  arch.name = 'Arch';
  arch.rotation.x = Math.PI / 2;
  arch.position.y = H;
  root.add(arch);

  const light = new Mesh(lightGeo, lightMat);
  light.name = 'Light';
  light.position.set(0, (H + ARCH_R) / 2, -DEPTH);
  root.add(light);

  const panel = new Group();
  panel.name = 'Panel';
  panel.position.set(-W / 2, 0, 0);
  const slab = new Mesh(panelGeo, panelMat);
  slab.position.set(W / 2, H / 2, 0);
  const top = new Mesh(panelArchGeo, panelMat);
  top.rotation.x = Math.PI / 2;
  top.position.set(W / 2, H, 0);
  const win = new Mesh(windowGeo, windowMat);
  win.name = 'Window';
  win.position.set(W / 2, H * 0.78, DEPTH / 2 + 0.001);
  const knob = new Mesh(knobGeo, frameMat);
  knob.rotation.x = Math.PI / 2;
  knob.position.set(W * 0.82, H * 0.45, DEPTH / 2 + 0.005);
  panel.add(slab, top, win, knob);
  root.add(panel);
  return root;
}

export default createStorybookDoor();
