import { AssetType, defineAssets } from '@iwsdk/core';

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
