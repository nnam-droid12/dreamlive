/**
 * Folded paper boat, ~11 cm long. Origin = waterline center, bow toward +Z,
 * Y up. "Seat" marks where the tiny dreaming Dreamer sits (stern).
 */
import {
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from '@iwsdk/core';
import { Palette } from '../config/palette.js';

const paper = new MeshStandardMaterial({
  color: Palette.paper,
  emissive: new Color(Palette.moonBlue),
  emissiveIntensity: 0.15,
  roughness: 0.95,
  flatShading: true,
  side: DoubleSide,
});
const edge = new LineBasicMaterial({ color: Palette.moonBlueSoft, transparent: true, opacity: 0.9 });

type V = readonly [number, number, number];
/** Triangles from a list of [a, b, c] vertex triples. */
function tris(list: ReadonlyArray<readonly [V, V, V]>): BufferGeometry {
  const pos: number[] = [];
  for (const [a, b, c] of list) pos.push(...a, ...b, ...c);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const K = 0.013; // keel half-width
const KL = 0.034; // keel half-length
const G = 0.026; // gunwale half-width
const GL = 0.042; // gunwale half-length
const H = 0.026; // hull height
const TIP = 0.058; // bow/stern tip
const kfr: V = [K, 0, KL], kfl: V = [-K, 0, KL], kbr: V = [K, 0, -KL], kbl: V = [-K, 0, -KL];
const gfr: V = [G, H, GL], gfl: V = [-G, H, GL], gbr: V = [G, H, -GL], gbl: V = [-G, H, -GL];
const bow: V = [0, H + 0.006, TIP], stern: V = [0, H + 0.006, -TIP];
const peak: V = [0, H + 0.042, 0];
const tl: V = [-0.015, H - 0.002, -0.032], tr: V = [0.015, H - 0.002, -0.032];
const tlf: V = [-0.015, H - 0.002, 0.032], trf: V = [0.015, H - 0.002, 0.032];

const hullGeo = tris([
  [kbr, kfr, gfr], [kbr, gfr, gbr],
  [kfl, kbl, gbl], [kfl, gbl, gfl],
  [kfr, kfl, bow], [kfr, bow, gfr], [kfl, gfl, bow],
  [kbl, kbr, stern], [kbr, gbr, stern], [kbl, stern, gbl],
  [kfl, kfr, kbr], [kfl, kbr, kbl],
]);
const tentGeo = tris([
  [tl, tlf, peak], [tr, peak, trf], [tl, peak, tr], [tlf, trf, peak],
]);

export function createPaperBoat(): Object3D {
  const root = new Group();
  root.name = 'PaperBoat';
  const hull = new Mesh(hullGeo, paper);
  hull.name = 'Hull';
  hull.castShadow = true;
  const tent = new Mesh(tentGeo, paper);
  tent.name = 'Tent';
  tent.castShadow = true;
  const lines = new LineSegments(new EdgesGeometry(hullGeo, 20), edge);
  lines.name = 'FoldLines';
  const tentLines = new LineSegments(new EdgesGeometry(tentGeo, 20), edge);
  tentLines.name = 'TentFoldLines';
  const seat = new Group();
  seat.name = 'Seat';
  seat.position.set(0, H - 0.008, -0.034);
  root.add(hull, tent, lines, tentLines, seat);
  return root;
}

export default createPaperBoat();
