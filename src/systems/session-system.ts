import {
  BackSide,
  createSystem,
  Entity,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  UIKit,
  UIKitMLAsset,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import { DreamDirector } from '../components/dream.js';
import { Gestures } from '../components/hands.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Tuning } from '../config/tuning.js';
import { MemoryStore } from '../memory/store.js';

const PANEL_DISTANCE = 0.6;
const PANEL_DROP = 0.08;
const UNLOCK_OFF = 'Judges and demo: unlock all dreams';
const UNLOCK_ON = 'All dreams unlocked (tap to undo)';

/**
 * Session handling: loads the night and unlocks from the Memory Shelf store,
 * opens the pause panel on a held palm-out (Resume, Restart dream, Unlock all,
 * Exit), freezes the dream while it is open, and fades back in after a pause or
 * after the headset is put back on.
 */
export class SessionSystem extends createSystem({
  director: { required: [Session, Ritual, DreamDirector, Gestures, Caption] },
}) {
  private panel?: Entity;
  private pauseBound = false;
  private welcomeBound = false;
  private ui?: UIKitMLAsset;
  private fade!: Mesh;
  private fadeMat!: MeshBasicMaterial;
  private lastVisibility: string = VisibilityState.NonImmersive;
  private head = new Vector3();
  private quat = new Quaternion();
  private fwd = new Vector3();

  init(): void {
    this.fadeMat = new MeshBasicMaterial({ color: 0x000000, side: BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
    this.fade = new Mesh(new SphereGeometry(0.4, 16, 8), this.fadeMat);
    this.fade.name = 'ResumeFade';
    this.fade.renderOrder = 100;
    this.fade.visible = false;
    this.world.createTransformEntity(this.fade);

    this.cleanupFuncs.push(
      this.queries.director.subscribe('qualify', (d) => {
        d.setValue(Session, 'night', MemoryStore.night());
        d.setValue(Session, 'unlockAll', MemoryStore.unlockAll());
        this.refreshLabels(d);
      }),
    );

  }

  /** Panels' documents load after init: wire the buttons once their elements exist. */
  private bindUi(d: Entity): void {
    if (!this.panel) {
      this.panel = this.world.getSceneEntity?.('pause-panel');
      if (this.panel) this.showPanel(false);
    }
    if (!this.pauseBound) {
      this.ui = this.world.getSceneObject<UIKitMLAsset>('pause-panel');
      this.pauseBound =
        this.on(this.ui, 'btn-resume', () => this.resume()) &&
        this.on(this.ui, 'btn-restart', () => this.restart()) &&
        this.on(this.ui, 'btn-unlock', () => this.toggleUnlock()) &&
        this.on(this.ui, 'btn-exit', () => {
          this.resume();
          this.world.exitXR();
        });
      if (this.pauseBound) this.refreshLabels(d);
    }
    if (!this.welcomeBound) {
      // The browser landing panel offers unlock-all too, before entering the headset.
      this.welcomeBound = this.on(this.world.getSceneObject<UIKitMLAsset>('welcome-panel'), 'unlock-button', () => this.toggleUnlock());
      if (this.welcomeBound) this.refreshLabels(d);
    }
  }

  update(realDelta: number): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    if (!this.pauseBound || !this.welcomeBound || !this.panel) this.bindUi(d);
    const visibility = this.visibilityState.peek();
    if (visibility === VisibilityState.Visible && this.lastVisibility === VisibilityState.VisibleBlurred) {
      // Headset back on: a soft fade-in, then exactly where the dream left off.
      d.setValue(Session, 'fadeIn', Tuning.session.resumeFadeSec);
    }
    this.lastVisibility = visibility;
    if (visibility !== VisibilityState.Visible) return;

    const phase = d.getValue(Ritual, 'phase');
    if (d.getValue(Gestures, 'palmOut') && !d.getValue(Session, 'paused') && phase !== RitualPhase.Idle) this.pause(d);

    this.player.head.getWorldPosition(this.head);
    const fadeIn = Math.max(0, (d.getValue(Session, 'fadeIn') ?? 0) - realDelta);
    d.setValue(Session, 'fadeIn', fadeIn);
    this.fade.visible = fadeIn > 0;
    this.fade.position.copy(this.head);
    this.fadeMat.opacity = fadeIn / Tuning.session.resumeFadeSec;
  }

  private pause(d: Entity): void {
    d.setValue(Session, 'paused', true);
    Sound.suspend();
    this.refreshLabels(d);
    const obj = this.panel?.object3D;
    if (!obj) return;
    this.player.head.getWorldPosition(this.head);
    this.player.head.getWorldQuaternion(this.quat);
    this.fwd.set(0, 0, -1).applyQuaternion(this.quat).setY(0).normalize();
    obj.position.copy(this.head).addScaledVector(this.fwd, PANEL_DISTANCE);
    obj.position.y -= PANEL_DROP;
    obj.lookAt(this.head.x, obj.position.y, this.head.z);
    this.showPanel(true);
  }

  private resume(): void {
    const d = this.queries.director.entities.values().next().value;
    this.showPanel(false);
    if (!d || !d.getValue(Session, 'paused')) return;
    d.setValue(Session, 'paused', false);
    d.setValue(Session, 'fadeIn', Tuning.session.resumeFadeSec * 0.5);
  }

  /** Back to the start of tonight's dream: Bigfoot asleep on the bed, the shelf kept. */
  private restart(): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    d.setValue(Session, 'generation', ((d.getValue(Session, 'generation') ?? 0) + 1) % 30000);
    d.setValue(Session, 'replay', '');
    d.setValue(Ritual, 'phase', RitualPhase.Arrival);
    d.setValue(Ritual, 'phaseTime', 0);
    d.setValue(Ritual, 'asleepAt', -1);
    for (const f of ['chapterId', 'beatId', 'lastChoice', 'lastChoiceBy', 'choices', 'signal'] as const) {
      d.setValue(DreamDirector, f, '');
    }
    for (const f of ['beatTime', 'dreamClock', 'idleGaze', 'catches'] as const) d.setValue(DreamDirector, f, 0);
    d.setValue(DreamDirector, 'started', false);
    d.setValue(DreamDirector, 'completed', false);
    this.resume();
  }

  private toggleUnlock(): void {
    const d = this.queries.director.entities.values().next().value;
    const on = !(d ? d.getValue(Session, 'unlockAll') : MemoryStore.unlockAll());
    MemoryStore.setUnlockAll(on);
    if (d) {
      d.setValue(Session, 'unlockAll', on);
      this.refreshLabels(d);
      if (on && d.getValue(Session, 'paused')) {
        d.setValue(Caption, 'text', 'All dreams are open.');
        d.setValue(Caption, 'ttl', 3);
      }
    }
  }

  private refreshLabels(d: Entity): void {
    const text = d.getValue(Session, 'unlockAll') ? UNLOCK_ON : UNLOCK_OFF;
    this.ui?.getElementById<UIKit.Text>('unlock-label')?.setProperties({ text });
    this.world.getSceneObject<UIKitMLAsset>('welcome-panel')?.getElementById<UIKit.Text>('unlock-button-label')?.setProperties({ text });
    const n = MemoryStore.orbs().length;
    const status = `Night ${d.getValue(Session, 'night') ?? 1} - ${n} ${n === 1 ? 'memory' : 'memories'} on your shelf`;
    this.ui?.getElementById<UIKit.Text>('pause-status')?.setProperties({ text: status });
  }

  private showPanel(show: boolean): void {
    const p = this.panel;
    if (!p?.object3D) return;
    p.object3D.visible = show;
    // Hidden: parked out of reach, so no ray can hit it.
    if (!show) p.object3D.position.set(0, -10, 0);
  }

  /**
   * A press then release on the same button. Not 'click': that is dropped when a
   * pinch is held longer than the pointer library's click threshold.
   */
  private on(ui: UIKitMLAsset | undefined, id: string, fn: () => void): boolean {
    const el = ui?.getElementById(id);
    if (!el) return false;
    let armed = false;
    const down = () => (armed = true);
    const leave = () => (armed = false);
    const up = () => {
      if (!armed) return;
      armed = false;
      fn();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerup', up);
    this.cleanupFuncs.push(
      () => el.removeEventListener('pointerdown', down),
      () => el.removeEventListener('pointerleave', leave),
      () => el.removeEventListener('pointerup', up),
    );
    return true;
  }
}
