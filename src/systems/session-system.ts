import {
  BackSide,
  createSystem,
  InputComponent,
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
import { onPress } from '../ui/press.js';
import { DreamDirector } from '../components/dream.js';
import { Gestures, HandGestureState } from '../components/hands.js';
import { Caption, Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { Tuning } from '../config/tuning.js';
import { dreamNight } from '../dreams/nights.js';
import { MemoryStore } from '../memory/store.js';

const PANEL_DISTANCE = 0.6;
const PANEL_DROP = 0.08;
const UNLOCK_OFF = 'Unlock all dreams (judges)';
const UNLOCK_ON = 'All unlocked - tap to undo';

/**
 * Session handling: loads the night and unlocks from the Memory Shelf store,
 * opens the pause panel on a held palm-out (Resume, Restart dream, Unlock all,
 * Exit), freezes the dream while it is open, and fades back in after a pause or
 * after the headset is put back on.
 */
export class SessionSystem extends createSystem({
  director: { required: [Session, Ritual, DreamDirector, Gestures, Caption] },
  hands: { required: [HandGestureState] },
}) {
  private panel?: Entity;
  private pauseBound = false;
  private welcomeBound = false;
  private ui?: UIKitMLAsset;
  private fade!: Mesh;
  private fadeMat!: MeshBasicMaterial;
  private lastVisibility: string = VisibilityState.NonImmersive;
  private seenHands = false;
  private handsGone = 0;
  private toldHandsGone = false;
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
        d.setValue(Session, 'highContrast', MemoryStore.settings().highContrast);
        d.setValue(Session, 'reducedMotion', MemoryStore.settings().reducedMotion);
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
        this.on(this.ui, 'btn-contrast', () => this.toggleSetting('highContrast')) &&
        this.on(this.ui, 'btn-motion', () => this.toggleSetting('reducedMotion')) &&
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
    // Controllers: B, Y or Menu toggles the pause panel (palm-out needs hands).
    if (phase !== RitualPhase.Idle && this.menuPressed()) {
      if (d.getValue(Session, 'paused')) this.resume();
      else this.pause(d);
    }
    this.watchHands(d, phase ?? '', realDelta);

    this.player.head.getWorldPosition(this.head);
    const fadeIn = Math.max(0, (d.getValue(Session, 'fadeIn') ?? 0) - realDelta);
    d.setValue(Session, 'fadeIn', fadeIn);
    this.fade.visible = fadeIn > 0;
    this.fade.position.copy(this.head);
    this.fadeMat.opacity = fadeIn / Tuning.session.resumeFadeSec;
  }

  private menuPressed(): boolean {
    for (const pad of [this.input.xr.gamepads.left, this.input.xr.gamepads.right]) {
      if (!pad) continue;
      if (pad.getButtonDown(InputComponent.B_Button) || pad.getButtonDown(InputComponent.Y_Button) || pad.getButtonDown(InputComponent.Menu)) return true;
    }
    return false;
  }

  /** Hand tracking lost mid-dream: say so once; the dream never needs hands to go on. */
  private watchHands(d: Entity, phase: string, realDelta: number): void {
    let tracked = false;
    for (const h of this.queries.hands.entities) if (h.getValue(HandGestureState, 'tracked')) tracked = true;
    if (tracked) {
      this.seenHands = true;
      this.handsGone = 0;
      this.toldHandsGone = false;
      return;
    }
    if (!this.seenHands || phase !== RitualPhase.Asleep) return;
    this.handsGone += realDelta;
    if (this.handsGone > Tuning.session.handsLostNoticeSec && !this.toldHandsGone) {
      this.toldHandsGone = true;
      d.setValue(Caption, 'text', 'Hands out of view - the dream carries on.');
      d.setValue(Caption, 'ttl', 4);
    }
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

  private toggleSetting(key: 'highContrast' | 'reducedMotion'): void {
    const d = this.queries.director.entities.values().next().value;
    if (!d) return;
    const on = !d.getValue(Session, key);
    d.setValue(Session, key, on);
    MemoryStore.setSetting(key, on);
    this.refreshLabels(d);
  }

  private refreshLabels(d: Entity): void {
    const contrast = `Big captions: ${d.getValue(Session, 'highContrast') ? 'on' : 'off'}`;
    const motion = `Calm motion: ${d.getValue(Session, 'reducedMotion') ? 'on' : 'off'}`;
    this.ui?.getElementById<UIKit.Text>('contrast-label')?.setProperties({ text: contrast });
    this.ui?.getElementById<UIKit.Text>('motion-label')?.setProperties({ text: motion });
    const text = d.getValue(Session, 'unlockAll') ? UNLOCK_ON : UNLOCK_OFF;
    this.ui?.getElementById<UIKit.Text>('unlock-label')?.setProperties({ text });
    this.world.getSceneObject<UIKitMLAsset>('welcome-panel')?.getElementById<UIKit.Text>('unlock-button-label')?.setProperties({ text });
    const n = MemoryStore.orbs().length;
    const night = d.getValue(Session, 'night') ?? 1;
    const fps = Math.round(d.getValue(Session, 'fps') ?? 0);
    const status = `Night ${night}: ${dreamNight(night).title} - ${n} ${n === 1 ? 'memory' : 'memories'} - ${fps} fps`;
    this.ui?.getElementById<UIKit.Text>('pause-status')?.setProperties({ text: status });
  }

  private showPanel(show: boolean): void {
    const p = this.panel;
    if (!p?.object3D) return;
    p.object3D.visible = show;
    // Hidden: parked out of reach, so no ray can hit it.
    if (!show) p.object3D.position.set(0, -10, 0);
  }

  /** A pinch on the button (hands or controllers); see ui/press.ts. */
  private on(ui: UIKitMLAsset | undefined, id: string, fn: () => void): boolean {
    return onPress(ui?.getElementById(id), fn, this.cleanupFuncs);
  }
}
