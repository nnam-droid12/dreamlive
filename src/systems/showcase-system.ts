import {
  BufferGeometry,
  createSystem,
  DirectionalLight,
  Entity,
  IBLTexture,
  LevelRoot,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
} from '@iwsdk/core';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { buildNycBedroom, NycLayout } from '../showcase/nyc-bedroom.js';

const HAND_SCAN_SEC = 1;
/** The HDR fill is a daylight room; at night the bedroom's own lamps carry it. */
const NIGHT_IBL = 0.32;

/**
 * Showcase mode (desktop emulator, screenshots, demo video): places the dream
 * in a realistic New York high-rise bedroom at night — standing in for the
 * passthrough room a headset user sees — and draws solid, skin-shaded hands
 * instead of the passthrough outline. The room's furniture is fed to the
 * dream as its layout (side table, TV wall). Does nothing on a real headset.
 */
export class ShowcaseSystem extends createSystem({
  director: { required: [RoomSlots] },
  roots: { required: [LevelRoot] },
}) {
  private handTimer = 0;
  private skin!: MeshStandardMaterial;
  private seenGeometry = new Set<BufferGeometry>();
  private laidOut = false;

  init(): void {
    if (!Showcase.enabled) return;
    this.skin = new MeshStandardMaterial({ color: Showcase.skinColor, roughness: 0.62, metalness: 0 });
    void this.buildRoom();
    this.cleanupFuncs.push(this.queries.roots.subscribe('qualify', (e) => this.nightLighting(e)));
    for (const e of this.queries.roots.entities) this.nightLighting(e);
  }

  update(delta: number): void {
    if (!Showcase.enabled) return;
    const d = this.queries.director.entities.values().next().value;
    if (d && !this.laidOut) this.applyLayout(d);
    this.handTimer -= delta;
    if (this.handTimer <= 0) {
      this.handTimer = HAND_SCAN_SEC;
      this.solidHands();
    }
  }

  private async buildRoom(): Promise<void> {
    try {
      const room = await buildNycBedroom();
      this.renderer.shadowMap.enabled = true;
      const city = new DirectionalLight(0xb8c8ff, 0.55);
      city.name = 'CityGlow';
      city.position.set(6, 5, -1);
      city.target.position.set(-1, 0, -1.5);
      city.castShadow = true;
      city.shadow.mapSize.set(1024, 1024);
      const cam = city.shadow.camera;
      cam.left = cam.bottom = -3.5;
      cam.right = cam.top = 3.5;
      cam.near = 0.5;
      cam.far = 14;
      room.add(city, city.target);
      this.world.createTransformEntity(room);
    } catch {
      // Showcase is a presentation aid; the experience works without it.
    }
  }

  private nightLighting(root: Entity): void {
    if (!root.hasComponent(IBLTexture)) return;
    root.setValue(IBLTexture, 'intensity', NIGHT_IBL);
    root.setValue(IBLTexture, '_needsUpdate', true);
  }

  /** The authored room replaces detection: side table = tuck-in surface, TV = wall anchor. */
  private applyLayout(d: Entity): void {
    this.laidOut = true;
    const t = NycLayout.sideTable;
    const tv = NycLayout.tv;
    d.setValue(RoomSlots, 'locked', true);
    d.setValue(RoomSlots, 'tableFound', true);
    t.center.toArray(d.getVectorView(RoomSlots, 'tableCenter'));
    d.setValue(RoomSlots, 'tableYaw', 0);
    d.setValue(RoomSlots, 'tableWidth', t.radius * 1.7);
    d.setValue(RoomSlots, 'tableDepth', t.radius * 1.7);
    d.setValue(RoomSlots, 'wallFound', true);
    tv.center.toArray(d.getVectorView(RoomSlots, 'wallCenter'));
    d.getVectorView(RoomSlots, 'wallNormal').set([0, 0, 1]);
    d.setValue(RoomSlots, 'ceilingFound', true);
    d.setValue(RoomSlots, 'ceilingHeight', NycLayout.room.height);
    tv.center.toArray(d.getVectorView(RoomSlots, 'anchorPoint'));
    d.getVectorView(RoomSlots, 'anchorPoint')[2] += 0.02;
    d.getVectorView(RoomSlots, 'anchorNormal').set([0, 0, 1]);
    d.setValue(RoomSlots, 'anchorIsBackdrop', false);
    d.setValue(RoomSlots, 'anchorReady', true);
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
