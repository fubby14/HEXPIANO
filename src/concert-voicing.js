const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function concertStringDetunes(midi, profileName) {
  if (profileName !== "crystal") return [0];
  if (midi < 36) return [0];
  if (midi < 48) return [-0.72, 0.78];
  return [-1.65, 0, 1.48];
}

export function registerDecayScale(midi) {
  const position = clamp((midi - 24) / 72, 0, 1);
  return 1.42 - position * 0.66;
}

export function strikeWeight(harmonic, strikePosition = 0.135) {
  const nodeShape = Math.abs(Math.sin(Math.PI * harmonic * strikePosition));
  return 0.66 + nodeShape * 0.34;
}

export function hammerBands(frequency, velocity, brightness) {
  const safeVelocity = clamp(velocity, 0, 1);
  const safeBrightness = clamp(brightness, 0, 1);
  return {
    bodyFrequency: clamp(260 + frequency * 0.82, 320, 1500),
    bodyGain: 0.026 + safeVelocity * 0.036,
    attackFrequency: clamp(2100 + frequency * (4.2 + safeBrightness * 4.5), 2400, 9200),
    attackGain: 0.044 + safeVelocity ** 1.45 * (0.11 + safeBrightness * 0.055),
  };
}
