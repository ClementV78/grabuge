export const TERRAINS = {
  pirate: { name: 'Îles pirates', image: '/pirate-bg.png' },
  snow: { name: 'Banquise', image: '/snow-bg.png' },
  canyon: { name: 'Canyon rocheux', image: '/canyon-bg.png' },
} as const;
export type TerrainId = keyof typeof TERRAINS;
export const isTerrainId = (value: unknown): value is TerrainId =>
  typeof value === 'string' && Object.hasOwn(TERRAINS, value);
