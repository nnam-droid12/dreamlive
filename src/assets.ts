import { AssetType, defineAssets } from '@iwsdk/core';
import dreamFish from './scene-assets/dream-fish.scene-asset.js';
import dreamer from './scene-assets/dreamer.scene-asset.js';
import lighthouse from './scene-assets/lighthouse.scene-asset.js';
import paperBoat from './scene-assets/paper-boat.scene-asset.js';
import storybookDoor from './scene-assets/storybook-door.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  dreamer,
  'paper-boat': paperBoat,
  lighthouse,
  'dream-fish': dreamFish,
  'storybook-door': storybookDoor,
  // Showcase mode only (desktop / video): Poly Haven CC0, lazy-loaded.
  'showcase-backdrop': {
    url: publicAssetUrl('env/wooden_lounge_4k.jpg'),
    type: AssetType.Texture,
    name: 'Wooden Lounge backdrop (showcase)',
    priority: 'lazy',
  },
  'showcase-table': {
    url: publicAssetUrl('models/wooden-table.glb'),
    type: AssetType.GLTF,
    name: 'Wooden Table (showcase)',
    priority: 'lazy',
  },
  'welcome-panel': {
    url: publicAssetUrl('ui/welcome.uikitml'),
    type: AssetType.UIKitML,
    name: 'Welcome Panel',
  },
});
