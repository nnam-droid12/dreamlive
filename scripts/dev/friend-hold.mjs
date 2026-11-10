// Dev probe: hold the friend moment at 0.9 s (mid-reach) and put the right hand up for a high-five.
export default async function run({ page, frame }) {
  return await (frame ?? page).evaluate(async () => {
    window.__friendHold = 0.9;
    const d = window.IWER_DEVICE;
    const h = d.hands.right;
    if (h.pin) h.setPin?.(null);
    h.poseId = 'open';
    h.updateHandPose?.();
    return 'held';
  });
}
