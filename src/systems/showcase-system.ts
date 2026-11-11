import { createSystem, DirectionalLight, Entity, IBLTexture, LevelRoot } from '@iwsdk/core';
import { RoomSlots } from '../components/stage.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { buildNycBedroom, NycLayout } from '../showcase/nyc-bedroom.js';

/** The HDR fill is a daylight room; at night the bedroom's own lamps carry it. */

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
  private ibl = -1;

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
    if (d) this.goldenIbl(d);
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
    root.setValue(IBLTexture, 'intensity', Tuning.transform.iblNight);
    root.setValue(IBLTexture, '_needsUpdate', true);
  }

  /** The room's ambient light follows the sky: bright and warm at golden hour and sunrise, dim at night. */
  private goldenIbl(d: Entity): void {
    const t = Tuning.transform;
    const k = Math.max(d.getValue(RoomSlots, 'dusk') ?? 0, d.getValue(RoomSlots, 'dawn') ?? 0);
    // (Movie Night is a cinema: the room's ambient light all but goes out while the film plays.)
    const ibl = (t.iblNight + (t.iblGolden - t.iblNight) * k) * (1 - (1 - Tuning.movie.cinemaLights * 0.5) * (d.getValue(RoomSlots, 'movieDim') ?? 0));
    if (Math.abs(ibl - this.ibl) < 0.03) return;
    this.ibl = ibl;
    for (const root of this.queries.roots.entities) {
      if (!root.hasComponent(IBLTexture)) continue;
      root.setValue(IBLTexture, 'intensity', ibl);
      root.setValue(IBLTexture, '_needsUpdate', true);
    }
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
