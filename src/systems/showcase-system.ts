import {
  AssetManager,
  Box3,
  BufferGeometry,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';

const HAND_SCAN_SEC = 1;
const DIM_RATE = 0.4;

/**
 * Showcase mode (desktop emulator, screenshots, demo video): surrounds the
 * dream with what a headset user would see through passthrough — a real room
 * backdrop that dims while the Dreamer sleeps, a real wooden table where the
 * table was detected, and solid skin-shaded hands instead of the passthrough
 * outline. Does nothing on a real headset.
 *
 * The room is an inward-facing sphere (not scene.background, which three.js
 * skips in AR sessions) that follows the head's position, never its rotation.
 */
export class ShowcaseSystem extends createSystem({
  director: { required: [Ritual, RoomSlots] },
}) {
  private backdrop?: Mesh;
  private backdropMat?: MeshBasicMaterial;
  private level = 1;
  private tableState: 'none' | 'loading' | 'done' = 'none';
  private handTimer = 0;
  private skin!: MeshStandardMaterial;
  private seenGeometry = new Set<BufferGeometry>();

  init(): void {
    if (!Showcase.enabled) return;
    this.skin = new MeshStandardMaterial({ color: Showcase.skinColor, roughness: 0.62, metalness: 0 });
    void this.buildBackdrop();
  }

  update(delta: number): void {
    if (!Showcase.enabled) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;

    if (this.backdrop) {
      this.player.head.getWorldPosition(this.backdrop.position);
      const night = d.getValue(Ritual, 'phase') === RitualPhase.Asleep;
      const target = night ? Showcase.nightIntensity : Showcase.dayIntensity;
      this.level += Math.sign(target - this.level) * Math.min(Math.abs(target - this.level), delta * DIM_RATE);
      this.backdropMat!.color.setScalar(this.level);
    }

    if (this.tableState === 'none' && d.getValue(RoomSlots, 'tableFound')) {
      this.tableState = 'loading';
      void this.placeTable(d);
    }

    this.handTimer -= delta;
    if (this.handTimer <= 0) {
      this.handTimer = HAND_SCAN_SEC;
      this.solidHands();
    }
  }

  private async buildBackdrop(): Promise<void> {
    try {
      const tex = await AssetManager.loadTextureById('showcase-backdrop');
      tex.colorSpace = SRGBColorSpace;
      this.backdropMat = new MeshBasicMaterial({ map: tex, depthWrite: false });
      // Flipped so the panorama reads un-mirrored from inside.
      const geo = new SphereGeometry(Showcase.backdropRadius, 48, 24).scale(-1, 1, 1);
      this.backdrop = new Mesh(geo, this.backdropMat);
      this.backdrop.name = 'ShowcaseRoom';
      this.backdrop.rotation.y = Showcase.backdropYaw;
      this.backdrop.renderOrder = -100;
      this.backdrop.frustumCulled = false;
      this.world.createTransformEntity(this.backdrop);
    } catch {
      // Showcase is a presentation aid; the experience works without it.
    }
  }

  /** A real wooden table, scaled to the detected table's top. */
  private async placeTable(d: Entity): Promise<void> {
    try {
      const gltf = await AssetManager.loadGLTFById('showcase-table');
      const model = gltf.scene.clone(true);
      const box = new Box3().setFromObject(model);
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      model.position.set(-center.x, -box.min.y, -center.z);
      model.traverse((o) => {
        if ((o as Mesh).isMesh) o.receiveShadow = true;
      });
      const c = d.getVectorView(RoomSlots, 'tableCenter');
      const wrap = new Group();
      wrap.name = 'ShowcaseTable';
      wrap.add(model);
      wrap.position.set(c[0], 0, c[2]);
      wrap.rotation.y = d.getValue(RoomSlots, 'tableYaw') ?? 0;
      wrap.scale.set(
        (d.getValue(RoomSlots, 'tableWidth') ?? size.x) / size.x,
        c[1] / size.y,
        (d.getValue(RoomSlots, 'tableDepth') ?? size.z) / size.z,
      );
      this.world.createTransformEntity(wrap);
      this.tableState = 'done';
    } catch {
      this.tableState = 'none';
    }
  }

  /** Swap the passthrough-style outline hands for solid skin-shaded hands. */
  private solidHands(): void {
    this.scene.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!(m as { isSkinnedMesh?: boolean }).isSkinnedMesh || m.material === this.skin) return;
      if (!(m.material instanceof ShaderMaterial)) return;
      // The outline style draws each hand twice (stencil + outline): keep one.
      if (this.seenGeometry.has(m.geometry)) {
        m.visible = false;
        return;
      }
      this.seenGeometry.add(m.geometry);
      m.material = this.skin;
      m.castShadow = true;
    });
  }
}
