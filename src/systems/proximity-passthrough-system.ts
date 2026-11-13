import { createSystem, Material, Mesh, Object3D, ShaderMaterial, Vector3, VisibilityState } from '@iwsdk/core';
import { Session } from '../components/session.js';
import { Director } from '../config/director.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { HandSigns } from '../input/hand-signs.js';
import type { EmulatedHand } from './real-hands.js';

const cfg = Tuning.proximity;
/** The scene with proximity passthrough: the garden (a fully virtual world you sit in). */
const WORLD_ROOTS: Record<string, string> = { garden: 'GardenWorld' };

/** The film shows it on cue (0..1; -1 = off): it leans away, the garden fades, the room shows. */
export const ProximityCue = { film: -1 };

interface Faded {
  mat: Material & { opacity: number };
  opacity: number;
  transparent: boolean;
}

/**
 * Proximity passthrough, in the garden. Inside it you cannot see your real room,
 * so if you lean or step away from where you were when it began, or reach a hand
 * far out, the garden fades away and the headset's passthrough shows your real
 * surroundings; settle back and it returns. In the emulator and the film the
 * showcase bedroom stands in for your real room.
 */
export class ProximityPassthroughSystem extends createSystem({
  director: { required: [Session] },
}) {
  private signs = new HandSigns();
  private current = '';
  private rest = new Vector3();
  private head = new Vector3();
  private rightV = new Vector3();
  private amount = 0;
  private root?: Object3D;
  private faded: Faded[] = [];
  private shaderMeshes: Mesh[] = [];
  private hidden = new Set<Mesh>();
  private room?: Object3D;

  update(realDelta: number): void {
    if (this.visibilityState.peek() === VisibilityState.NonImmersive) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const dt = Math.min(realDelta, 0.1);
    const world = d.getValue(Session, 'world') ?? '';
    this.player.head.getWorldPosition(this.head);
    if (world !== this.current) {
      // A world begins (or ends): where you are now is your spot; give back the last world's look.
      this.apply(0);
      this.current = world;
      this.rest.copy(this.head);
      this.amount = 0;
      this.root = WORLD_ROOTS[world] ? (this.scene.getObjectByName(WORLD_ROOTS[world]) ?? undefined) : undefined;
      this.collect();
    }
    if (!this.root) return;

    // How far you have moved from your spot (sideways and up: standing up counts).
    const moved = Math.hypot(this.head.x - this.rest.x, this.head.z - this.rest.z, Math.max(0, this.head.y - this.rest.y));
    let want = smooth01((moved - cfg.headStart) / (cfg.headFull - cfg.headStart));
    // A hand reaching far out from your head.
    const dev = (window as unknown as { IWER_DEVICE?: { hands?: { left?: EmulatedHand; right?: EmulatedHand } } }).IWER_DEVICE;
    if (dev?.hands) this.signs.readEmulator(dev.hands, this.player);
    else this.signs.readFrame(this.xrFrame, this.xrManager.getReferenceSpace(), this.player);
    this.signs.update(dt, this.rightV.set(1, 0, 0));
    for (const side of ['left', 'right'] as const) {
      const h = this.signs[side];
      if (!h.tracked) continue;
      const reach = Math.hypot(h.palm.x - this.head.x, h.palm.z - this.head.z);
      want = Math.max(want, smooth01((reach - cfg.handStart) / (cfg.handFull - cfg.handStart)));
    }
    // The film shows it on cue instead (its camera moves between shots, which is not you leaning).
    if (Director.enabled) want = Math.max(0, ProximityCue.film);
    this.amount += (want - this.amount) * Math.min(1, dt * cfg.fadeRate);
    this.apply(this.amount);
    // Without a headset's passthrough, the showcase bedroom stands in for your real room.
    if (Showcase.enabled && this.amount > 0.02) {
      this.room ??= this.scene.getObjectByName('NycBedroom') ?? undefined;
      if (this.room) this.room.visible = true;
    }
  }

  /** The world's materials (to fade) and its custom-shader meshes (hidden once mostly faded). */
  private collect(): void {
    this.faded = [];
    this.shaderMeshes = [];
    this.root?.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat instanceof ShaderMaterial) {
          this.shaderMeshes.push(m);
          continue;
        }
        const fm = mat as Material & { opacity: number };
        if (!this.faded.some((f) => f.mat === fm)) this.faded.push({ mat: fm, opacity: fm.opacity, transparent: fm.transparent });
      }
    });
  }

  /** 0 = the world as made; 1 = gone (passthrough shows through). */
  private apply(a: number): void {
    for (const f of this.faded) {
      const fading = a > 0.01;
      if (f.mat.transparent !== (fading || f.transparent)) {
        f.mat.transparent = fading || f.transparent;
        f.mat.needsUpdate = true;
      }
      f.mat.opacity = f.opacity * (1 - a);
    }
    // Custom-shader parts can't fade: hide them once mostly faded (only ever giving back what was hidden here).
    if (a >= 0.5) {
      for (const m of this.shaderMeshes) {
        if (m.visible) {
          m.visible = false;
          this.hidden.add(m);
        }
      }
    } else if (this.hidden.size) {
      for (const m of this.hidden) m.visible = true;
      this.hidden.clear();
    }
    if (this.root && a > 0.97) this.root.visible = false;
  }
}

function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
