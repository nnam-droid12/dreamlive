import { Color, createSystem, Mesh, MeshStandardMaterial, SphereGeometry, VisibilityState } from '@iwsdk/core';
import { DreamDirector } from '../components/dream.js';
import { StageAnchor } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { findChapter } from '../dreams/registry.js';

/**
 * Phase 2 stand-in for chapter scenery: one glowing orb above the stage center
 * whose color follows the current beat's tint, so branching is visible before
 * the real sea, lighthouse and fish exist. Removed when Phase 3 lands.
 */
export class DreamPlaceholderSystem extends createSystem({
  director: { required: [DreamDirector] },
  stage: { required: [StageAnchor] },
}) {
  private orb?: Mesh;
  private mat?: MeshStandardMaterial;
  private target = new Color();
  private time = 0;

  update(delta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(DreamDirector, 'started')) return;
    if (!this.orb && !this.build()) return;
    this.time += delta;
    const beat = findChapter(d.getValue(DreamDirector, 'chapterId') ?? '')?.beats[
      d.getValue(DreamDirector, 'beatId') ?? ''
    ];
    if (beat) this.target.setHex(Palette[beat.tint]);
    const done = !!d.getValue(DreamDirector, 'completed');
    const k = Math.min(1, 2 * delta);
    this.mat!.color.lerp(this.target, k);
    this.mat!.emissive.lerp(this.target, k);
    this.mat!.opacity += ((done ? 0 : 0.85) - this.mat!.opacity) * k;
    this.orb!.position.y = 0.36 + 0.01 * Math.sin(this.time * 1.3);
  }

  private build(): boolean {
    const stage = this.queries.stage.entities.values().next().value;
    if (!stage) return false;
    this.mat = new MeshStandardMaterial({
      color: Palette.moonBlue,
      emissive: Palette.moonBlue,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0,
    });
    this.orb = new Mesh(new SphereGeometry(0.03, 20, 14), this.mat);
    this.orb.name = 'BeatOrb';
    this.orb.position.set(0, 0.36, -0.18);
    this.world.createTransformEntity(this.orb, { parent: stage });
    return true;
  }
}
