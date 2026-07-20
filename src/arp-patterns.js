export const MOTION_MODES = Object.freeze({
  orbit: {
    name: "Orbit",
    description: "Follow the drawing in its original direction.",
  },
  bounce: {
    name: "Bounce",
    description: "Travel the line forward, then return without repeating its ends.",
  },
  spill: {
    name: "Spill",
    description: "Release every selected note from the floor to the ceiling.",
  },
  pendulum: {
    name: "Pendulum",
    description: "Alternate between the outer notes and fold toward the center.",
  },
  dust: {
    name: "Dust",
    description: "Scatter the same notes into a new deterministic order each round.",
  },
});

function cleanNotes(notes) {
  return [...new Set(notes.filter(Number.isFinite).map((note) => Math.round(note)))];
}

function pendulumOrder(notes) {
  const ordered = [...notes].sort((a, b) => a - b);
  const result = [];
  let low = 0;
  let high = ordered.length - 1;
  while (low <= high) {
    result.push(ordered[low]);
    if (low !== high) result.push(ordered[high]);
    low += 1;
    high -= 1;
  }
  return result;
}

function seededShuffle(notes, cycle) {
  const result = [...notes];
  let state = (0x484558 ^ (cycle + 1) * 2654435761) >>> 0;
  notes.forEach((note, index) => {
    state = (state ^ ((note + 97) * (index + 17))) >>> 0;
  });

  for (let index = result.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swap = state % (index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function buildMotionSequence(notes, mode = "orbit", cycle = 0) {
  const clean = cleanNotes(notes);
  if (clean.length < 2) return clean;

  switch (mode) {
    case "bounce":
      return [...clean, ...clean.slice(1, -1).reverse()];
    case "spill":
      return [...clean].sort((a, b) => a - b);
    case "pendulum":
      return pendulumOrder(clean);
    case "dust":
      return seededShuffle(clean, Math.max(0, Math.round(cycle)));
    case "orbit":
    default:
      return clean;
  }
}

export function expandAcrossOctaves(sequence, octaveRange = 1) {
  const clean = cleanNotes(sequence);
  const octaves = Math.max(1, Math.min(4, Math.round(octaveRange) || 1));
  return Array.from({ length: octaves }, (_, octave) => clean.map((midi) => midi + octave * 12)).flat();
}

export function stepDurationSeconds(tempo, division = 0.5, swing = 0, stepIndex = 0) {
  const safeTempo = Math.max(24, Math.min(300, Number(tempo) || 108));
  const safeDivision = Math.max(0.125, Math.min(2, Number(division) || 0.5));
  const safeSwing = Math.max(0, Math.min(0.7, Number(swing) || 0));
  const base = (60 / safeTempo) * safeDivision;
  return base * (stepIndex % 2 === 0 ? 1 + safeSwing * 0.5 : 1 - safeSwing * 0.5);
}
