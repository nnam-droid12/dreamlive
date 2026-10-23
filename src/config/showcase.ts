/**
 * Showcase mode: how Dreamlive looks when it is NOT seen through a headset's
 * passthrough — the desktop emulator, screenshots and the demo video. It puts a
 * real room (backdrop), a real wooden table and solid hands around the dream,
 * standing in for the passthrough view a headset user gets.
 *
 * On: in the desktop emulator (localhost dev), or anywhere with `?showcase`.
 * Off: on a real headset, which reaches dev over the network address and uses
 * its own passthrough as the stage. (The emulator reports a Quest user agent,
 * so the host name — not the user agent — is the reliable signal.)
 */
const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
const onLocalhost = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

export const Showcase = {
  enabled: params.has('showcase') || (import.meta.env.DEV && onLocalhost && !params.has('passthrough')),
  /** Backdrop brightness while awake, and while the Dreamer sleeps (room dims). */
  dayIntensity: 1,
  nightIntensity: 0.32,
  /** Backdrop yaw so the cozy sofa side sits behind the table. */
  backdropYaw: Math.PI * 0.5,
  backdropRadius: 12,
  skinColor: 0xd9a587,
} as const;
