export interface LightingSettings {
  direction: [number, number, number];
  intensity: number;
  ambientIntensity: number;
  shininess: number;
}

export const DEFAULT_LIGHTING: LightingSettings = {
  direction: [0.16, 1.0, -0.11],
  intensity: 0.87,
  ambientIntensity: 0.74,
  shininess: 4.0,
};
