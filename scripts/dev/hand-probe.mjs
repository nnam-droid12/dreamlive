// Dev probe: set the emulator's right hand to each pose and report the index-tip offset and pose id.
export default async function run({ page }) {
  return await page.evaluate(async () => {
    const d = window.IWER_DEVICE;
    if (!d?.hands?.right) return 'no device hands';
    const h = d.hands.right;
    const out = [];
    for (const pose of ['open', 'fist', 'thumbs-up', 'rock', 'point']) {
      h.poseId = pose;
      h.updateHandPose?.();
      await new Promise((r) => setTimeout(r, 300));
      const js = h.inputSource.hand.get('index-finger-tip');
      const sym = Object.getOwnPropertySymbols(js).find((k) => js[k]?.offsetMatrix);
      const m = js[sym].offsetMatrix;
      out.push(`${pose}: poseId=${h.poseId} tip=(${m[12].toFixed(3)},${m[13].toFixed(3)},${m[14].toFixed(3)}) ids=${h.poseIds?.length}`);
    }
    return out.join('\n');
  });
}
