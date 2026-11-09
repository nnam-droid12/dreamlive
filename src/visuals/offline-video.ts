import { VideoTexture } from '@iwsdk/core';
import { DirectorFrame } from '../config/director.js';

/**
 * Offline Director renders: show a video's picture at exactly `time`. The
 * render holds (DirectorFrame.busy) until the browser has seeked there, then
 * the texture takes the new picture, so a film plays frame-exact in the trailer
 * however slowly the laptop renders. (Never holds longer than 3 s.)
 */
export function seekForRender(v: HTMLVideoElement, tex: VideoTexture | undefined, time: number): void {
  if (!v.paused) v.pause();
  if (v.readyState < 1 || v.seeking || !v.duration) return;
  const t = time % v.duration;
  if (Math.abs(v.currentTime - t) < 1 / 120) return;
  DirectorFrame.busy++;
  let done = false;
  const release = () => {
    if (done) return;
    done = true;
    v.removeEventListener('seeked', release);
    if (tex) tex.needsUpdate = true;
    DirectorFrame.busy--;
  };
  v.addEventListener('seeked', release);
  setTimeout(release, 3000);
  v.currentTime = t;
}
