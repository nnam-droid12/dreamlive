import type { TowerMaterials } from '../scene-assets/lib/modern-tower.js';

/**
 * The city's tower materials once they are fully dressed (glass reflections,
 * lit windows, concrete): the Rooftop Party builds them; other New York views
 * (the street walk's canyon of towers) reuse the very same materials.
 */
export const TowerShared: { mats?: TowerMaterials } = {};
