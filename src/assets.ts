import { AssetType, defineAssets } from '@iwsdk/core';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  // The hero: owner-made in Meshy (CC BY 4.0), rigged and animated with Mixamo.
  bigfoot: {
    url: publicAssetUrl('models/bigfoot.glb'),
    type: AssetType.GLTF,
    name: 'Bigfoot',
    priority: 'lazy',
  },
  'welcome-panel': {
    url: publicAssetUrl('ui/welcome.uikitml'),
    type: AssetType.UIKitML,
    name: 'Welcome Panel',
  },
});
