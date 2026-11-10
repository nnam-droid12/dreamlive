// Dev probe: register IWER's pose library into the running emulator and check the poses take effect.
export default async function run({ page }) {
  return await page.evaluate(async () => {
    const lib = await import('/@id/iwer/lib/device/configs/hand/library.js');
    const d = window.IWER_DEVICE;
    const out = [];
    for (const h of [d.hands.left, d.hands.right]) {
      for (const k of Object.getOwnPropertySymbols(h)) {
        const st = h[k];
        if (st?.poses) for (const [id, p] of Object.entries(lib.libraryHandPoses)) if (!(id in st.poses)) st.poses[id] = p;
      }
    }
    const h = d.hands.right;
    for (const pose of ['open', 'fist', 'thumbs-up', 'rock', 'point']) {
      h.poseId = pose;
      h.updateHandPose?.();
      await new Promise((r) => setTimeout(r, 300));
      const tip = (name) => {
        const js = h.inputSource.hand.get(name);
        const sym = Object.getOwnPropertySymbols(js).find((k) => js[k]?.offsetMatrix);
        const m = js[sym].offsetMatrix;
        return `(${m[12].toFixed(3)},${m[13].toFixed(3)},${m[14].toFixed(3)})`;
      };
      out.push(`${pose}: id=${h.poseId} index=${tip('index-finger-tip')} pinky=${tip('pinky-finger-tip')} thumb=${tip('thumb-tip')} upd=${typeof h.updateHandPose}`);
    }
    return out.join('\n');
  });
}
