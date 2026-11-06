import { createSystem, DirectionalLight, Entity, IBLTexture, LevelRoot } from '@iwsdk/core';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { buildNycBedroom, NycLayout } from '../showcase/nyc-bedroom.js';

/** The HDR fill is a daylight room; at night the bedroom's own lamps carry it. */
const NIGHT_IBL = 0.32;

/**
 * Showcase mode (desktop emulator, screenshots, demo video): places the dream
 * in a realistic New York high-rise bedroom at night — standing in for the
 * passthrough room a headset user sees. Hands keep the headset's frosted
 * outline look (HandLookSystem). The room's furniture is fed to the
 * dream as its layout (side table, TV wall). Does nothing on a real headset.
 */
export class ShowcaseSystem extends createSystem({
  director: { required: [RoomSlots] },
  roots: { required: [LevelRoot] },
}) {
  private laidOut = false;

  init(): void {
    if (!Showcase.enabled) return;
    void this.buildRoom();
    this.cleanupFuncs.push(this.queries.roots.subscribe('qualify', (e) => this.nightLighting(e)));
    for (const e of this.queries.roots.entities) this.nightLighting(e);
  }

  update(): void {
    if (!Showcase.enabled) return;
    const d = this.queries.director.entities.values().next().value;
    if (d && !this.laidOut) this.applyLayout(d);
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
    // Seat the viewer where the bed and the TV share one comfortable view.
    this.player.position.copy(NycLayout.seat.position);
    this.player.rotation.y = NycLayout.seat.yaw;
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
    const win = NycLayout.window;
    win.origin.toArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    win.out.toArray(d.getVectorView(RoomSlots, 'windowOut'));
    win.along.toArray(d.getVectorView(RoomSlots, 'windowAlong'));
    d.setValue(RoomSlots, 'windowReady', true);
  }
}
