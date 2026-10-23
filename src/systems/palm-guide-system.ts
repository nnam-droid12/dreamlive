import {
  CanvasTexture,
  Color,
  createSystem,
  DoubleSide,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { HandGestureState, Handedness } from '../components/hands.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { makeRingMaterial } from '../visuals/glow-materials.js';

const GUIDE_SIZE = 0.17;
const GUIDE_SPACING = 0.13;
const HOLD_RING_SIZE = 0.16;
const r = Tuning.ritual;

/**
 * Arrival feedback: two glowing palm outlines show where to put your hands, and
 * a starlight ring grows under each real palm the moment it is flat. Both
 * brighten with hold progress, so the gesture is visibly "being recognized".
 */
export class PalmGuideSystem extends createSystem({
  director: { required: [Ritual, RoomSlots] },
  hands: { required: [HandGestureState] },
}) {
  private guide!: Group;
  private guideMat!: MeshBasicMaterial;
  private holdRings: Record<string, { mesh: Mesh; mat: ShaderMaterial }> = {};
  private visibility = 0;
  private placed = false;
  private time = 0;
  private head = new Vector3();
  private headQuat = new Quaternion();
  private target = new Vector3();
  private toward = new Vector3();
  private table = new Vector3();
  private calm = new Color(Palette.moonBlueSoft);
  private warm = new Color(Palette.lanternAmber);

  init(): void {
    const texture = new CanvasTexture(drawPalmOutline());
    texture.colorSpace = SRGBColorSpace;
    this.guideMat = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      color: this.calm.clone(),
    });
    this.guide = new Group();
    this.guide.name = 'PalmGuide';
    const geo = new PlaneGeometry(GUIDE_SIZE, GUIDE_SIZE);
    for (const side of [-1, 1]) {
      const palm = new Mesh(geo, this.guideMat);
      palm.name = side < 0 ? 'PalmGuideL' : 'PalmGuideR';
      palm.rotation.x = -Math.PI / 2;
      palm.position.x = side * GUIDE_SPACING;
      palm.scale.x = side < 0 ? -1 : 1;
      this.guide.add(palm);
    }
    this.guide.visible = false;
    this.world.createTransformEntity(this.guide);

    const ringGeo = new PlaneGeometry(HOLD_RING_SIZE, HOLD_RING_SIZE);
    for (const hand of [Handedness.Left, Handedness.Right]) {
      const mat = makeRingMaterial(Palette.starWhite);
      const mesh = new Mesh(ringGeo, mat);
      mesh.name = `HoldRing-${hand}`;
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.world.createTransformEntity(mesh);
      this.holdRings[hand] = { mesh, mat };
    }
  }

  update(delta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    this.time += delta;
    const arriving = d.getValue(Ritual, 'phase') === RitualPhase.Arrival;
    const hold = d.getValue(Ritual, 'holdProgress') ?? 0;
    this.visibility += ((arriving ? 1 : 0) - this.visibility) * Math.min(1, 4 * delta);
    this.guide.visible = this.visibility > 0.01;
    if (this.guide.visible) this.placeGuide(d, delta, hold);
    else this.placed = false;

    for (const e of this.queries.hands.entities) this.updateHoldRing(e, arriving, hold);
  }

  private placeGuide(d: Entity, delta: number, hold: number): void {
    this.player.head.getWorldPosition(this.head);
    if (d.getValue(RoomSlots, 'tableFound')) {
      this.table.fromArray(d.getVectorView(RoomSlots, 'tableCenter'));
      this.toward.subVectors(this.head, this.table).setY(0);
      const dist = this.toward.length();
      const halfMin = 0.5 * Math.min(
        d.getValue(RoomSlots, 'tableWidth') ?? 0,
        d.getValue(RoomSlots, 'tableDepth') ?? 0,
      );
      const shift = Math.max(0, Math.min(dist - 0.35, halfMin - 0.1));
      this.target.copy(this.table).addScaledVector(this.toward.normalize(), shift);
      this.target.y += 0.004;
    } else {
      this.player.head.getWorldQuaternion(this.headQuat);
      this.toward.set(0, 0, -1).applyQuaternion(this.headQuat).setY(0).normalize();
      this.target.copy(this.head).addScaledVector(this.toward, r.guideForward);
      this.target.y = this.head.y - r.guideDrop;
    }
    if (!this.placed) this.guide.position.copy(this.target);
    else this.guide.position.lerp(this.target, Math.min(1, 3 * delta));
    this.placed = true;
    this.guide.rotation.y = Math.atan2(
      this.head.x - this.guide.position.x,
      this.head.z - this.guide.position.z,
    );
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2);
    this.guideMat.opacity = this.visibility * (0.45 + 0.2 * pulse + 0.35 * hold);
    this.guideMat.color.copy(this.calm).lerp(this.warm, hold);
    this.guide.scale.setScalar(1 + 0.08 * hold);
  }

  private updateHoldRing(e: Entity, arriving: boolean, hold: number): void {
    const ring = this.holdRings[e.getValue(HandGestureState, 'hand') ?? ''];
    if (!ring) return;
    const flat =
      arriving &&
      e.getValue(HandGestureState, 'tracked') &&
      e.getValue(HandGestureState, 'palmDown');
    ring.mesh.visible = !!flat;
    if (!flat) return;
    const c = e.getVectorView(HandGestureState, 'palmCenter');
    ring.mesh.position.set(c[0], c[1] - Tuning.palmCalibration.palmSurfaceOffset + 0.003, c[2]);
    ring.mesh.scale.setScalar(0.45 + 0.55 * hold);
    ring.mat.uniforms.opacity.value = 0.35 + 0.65 * hold;
    ring.mat.uniforms.time.value = this.time;
  }
}

/** White glowing outline of a right hand, fingers toward +V (texture up). */
function drawPalmOutline(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (!g) return c;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 7;
  g.lineCap = g.lineJoin = 'round';
  g.shadowColor = '#ffffff';
  g.shadowBlur = 14;
  const finger = (x: number, top: number, w: number) => {
    g.beginPath();
    g.moveTo(x - w / 2, 150);
    g.lineTo(x - w / 2, top + w / 2);
    g.arc(x, top + w / 2, w / 2, Math.PI, 0);
    g.lineTo(x + w / 2, 150);
    g.stroke();
  };
  finger(92, 48, 30);
  finger(124, 30, 30);
  finger(156, 40, 30);
  finger(186, 70, 26);
  g.beginPath();
  g.moveTo(77, 150);
  g.quadraticCurveTo(70, 230, 128, 236);
  g.quadraticCurveTo(190, 236, 199, 150);
  g.stroke();
  g.beginPath();
  g.moveTo(77, 175);
  g.quadraticCurveTo(40, 150, 36, 118);
  g.arc(50, 112, 14, Math.PI, -0.3);
  g.quadraticCurveTo(70, 140, 80, 152);
  g.stroke();
  return c;
}
