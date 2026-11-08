import { AssetType, defineAssets } from '@iwsdk/core';
import djBooth from './scene-assets/dj-booth.scene-asset.js';
import dove from './scene-assets/dove.scene-asset.js';
import popcorn from './scene-assets/popcorn.scene-asset.js';
import landmarkDeco from './scene-assets/landmark-deco.scene-asset.js';
import landmarkGlass from './scene-assets/landmark-glass.scene-asset.js';
import skis from './scene-assets/skis.scene-asset.js';
import surfboard from './scene-assets/surfboard.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  // The hero: Meshy concept -> TRELLIS.2 mesh -> Mixamo rig/animations -> Blender slim (see CREDITS.md).
  bigfoot: {
    url: publicAssetUrl('models/bigfoot.glb'),
    type: AssetType.GLTF,
    name: 'Bigfoot',
    priority: 'lazy',
  },
  // Party guests: Quaternius Universal Base Characters (CC0), simplified; moves from the Universal Animation Library (CC0).
  'person-male': { url: publicAssetUrl('models/people/male.glb'), type: AssetType.GLTF, name: 'Party guest (male)', priority: 'lazy' },
  'person-female': { url: publicAssetUrl('models/people/female.glb'), type: AssetType.GLTF, name: 'Party guest (female)', priority: 'lazy' },
  // Dream-act props (procedural; the TV worlds build their own copies).
  surfboard,
  skis,
  'dj-booth': djBooth,
  dove,
  popcorn,
  'landmark-deco': landmarkDeco,
  'landmark-glass': landmarkGlass,
  'palm-panel': {
    url: publicAssetUrl('ui/palm.uikitml'),
    type: AssetType.UIKitML,
    name: 'Palm Panel',
  },
  'pause-panel': {
    url: publicAssetUrl('ui/pause.uikitml'),
    type: AssetType.UIKitML,
    name: 'Pause Panel',
  },
  'welcome-panel': {
    url: publicAssetUrl('ui/welcome.uikitml'),
    type: AssetType.UIKitML,
    name: 'Welcome Panel',
  },
});
