// Dev probe: hold the right hand in front of the viewer in one pose.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    const lib = await import('/@id/iwer/lib/device/configs/hand/library.js');
    const d = window.IWER_DEVICE;
    for (const h of [d.hands.left, d.hands.right]) for (const k of Object.getOwnPropertySymbols(h)) { const st = h[k]; if (st?.poses) for (const [id, p] of Object.entries(lib.libraryHandPoses)) if (!(id in st.poses)) st.poses[id] = p; }
    const h = d.hands.right;
    if (h.pin) h.setPin?.(null);
    h.position.set(d.position.x + 0.1, d.position.y - 0.05, d.position.z - 0.5);
    h.quaternion.set(0.7071, 0, 0, 0.7071);
    h.poseId = 'open';
    h.updateHandPose?.();
    return h.poseId;
  });
}
