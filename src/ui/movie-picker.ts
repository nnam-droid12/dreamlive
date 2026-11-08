import { MovieChoice } from '../systems/movie-night-system.js';

/**
 * On the 2D start page (before entering XR): an optional "Pick a movie for
 * Movie Night" button. The chosen video stays on the device (a blob URL); the
 * palm menu's Movie night then plays it instead of Big Buck Bunny.
 */
export function mountMoviePicker(): void {
  if (typeof document === 'undefined') return;
  const label = document.createElement('label');
  label.style.cssText =
    'position:fixed;left:16px;bottom:16px;z-index:10;padding:10px 14px;border-radius:12px;' +
    'background:rgba(20,16,12,0.78);color:#ffe2a8;font:14px Georgia,serif;cursor:pointer;';
  label.textContent = 'Pick a movie for Movie Night (optional)';
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    if (MovieChoice.url) URL.revokeObjectURL(MovieChoice.url);
    MovieChoice.url = URL.createObjectURL(f);
    label.firstChild!.textContent = `Movie Night will play: ${f.name}`;
  });
  label.appendChild(input);
  document.body.appendChild(label);
}
