/**
 * Showcase mode: how Dreamlive looks when it is NOT seen through a headset's
 * passthrough — the desktop emulator, screenshots and the demo video. It puts a
 * real room (backdrop), a real wooden table and solid hands around the dream,
 * standing in for the passthrough view a headset user gets.
 *
 * On: wherever the built-in headset emulator runs (a computer: localhost dev
 * or the published site), or anywhere with `?showcase`. Off: on a real headset
 * (Meta Quest Browser uses its own WebXR and passthrough as the stage), or with
 * `?passthrough`.
 */
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const onLocalhost = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
/** The built-in headset emulator is running (a computer, not a real headset). */
const emulated = () =>
  typeof window !== 'undefined' &&
  !!(window as unknown as { __IWSDK_EMULATION_PROFILE?: { active?: boolean } }).__IWSDK_EMULATION_PROFILE?.active;
let decided: boolean | undefined;

export const Showcase = {
  /** Decided on first use (after the emulator has started), then fixed for the session. */
  get enabled(): boolean {
    decided ??= params.has('showcase') || ((emulated() || (import.meta.env.DEV && onLocalhost)) && !params.has('passthrough'));
    return decided;
  },
  /** Backdrop brightness while awake, and while the Dreamer sleeps (room dims). */
  dayIntensity: 1,
  nightIntensity: 0.32,
  /** Backdrop yaw so the cozy sofa side sits behind the table. */
  backdropYaw: Math.PI * 0.5,
  backdropRadius: 12,
} as const;
