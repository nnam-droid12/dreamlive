// Dev probe: the running emulator's hand pose store and pose format.
export default async function run({ page }) {
  return await page.evaluate(() => {
    const h = window.IWER_DEVICE?.hands?.right;
    if (!h) return 'no hand';
    const sym = Object.getOwnPropertySymbols(h).find((k) => h[k]?.poses);
    const st = h[sym];
    const pose = st.poses.default;
    const jt = pose.jointTransforms;
    const first = Object.keys(jt)[0];
    return JSON.stringify({ poses: Object.keys(st.poses), poseKeys: Object.keys(pose), joint: first, jointKeys: Object.keys(jt[first]), stateKeys: Object.keys(st) });
  });
}
