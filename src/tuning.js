const A4_MIDI = 69;
const A4_FREQUENCY = 440;
const C4_MIDI = 60;

export const OCTAVE_RANGE = Object.freeze({ min: 1, max: 6, initial: 4 });

const JUST_RATIOS = [
  1,
  16 / 15,
  9 / 8,
  6 / 5,
  5 / 4,
  4 / 3,
  45 / 32,
  3 / 2,
  8 / 5,
  5 / 3,
  9 / 5,
  15 / 8,
];

const PYTHAGOREAN_RATIOS = [
  1,
  256 / 243,
  9 / 8,
  32 / 27,
  81 / 64,
  4 / 3,
  729 / 512,
  3 / 2,
  128 / 81,
  27 / 16,
  16 / 9,
  243 / 128,
];

export const TUNINGS = Object.freeze({
  equal: {
    id: "equal",
    name: "12-tone equal",
    shortName: "Equal",
    description: "Modern concert tuning. Every semitone is evenly spaced.",
  },
  just: {
    id: "just",
    name: "Just intonation in C",
    shortName: "Just C",
    description: "Whole-number ratios. Chords lock together and shimmer less.",
  },
  pythagorean: {
    id: "pythagorean",
    name: "Pythagorean in C",
    shortName: "Pythagorean",
    description: "Built from pure fifths. Open, bright, and slightly uncanny.",
  },
});

export const NOTE_NAMES = Object.freeze([
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
]);

export function equalFrequency(midi, a4 = A4_FREQUENCY) {
  return a4 * 2 ** ((midi - A4_MIDI) / 12);
}

export function tuningFrequency(midi, tuningId = "equal") {
  if (tuningId === "equal") return equalFrequency(midi);

  const ratios = tuningId === "just" ? JUST_RATIOS : PYTHAGOREAN_RATIOS;
  const distanceFromC = midi - C4_MIDI;
  const octave = Math.floor(distanceFromC / 12);
  const pitchClass = ((distanceFromC % 12) + 12) % 12;
  return equalFrequency(C4_MIDI) * 2 ** octave * ratios[pitchClass];
}

export function centsFromEqual(midi, tuningId = "equal") {
  return 1200 * Math.log2(tuningFrequency(midi, tuningId) / equalFrequency(midi));
}

export function noteName(midi) {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

export function octaveStartMidi(octave) {
  const rounded = Math.round(Number(octave));
  const safeOctave = Number.isFinite(rounded)
    ? Math.max(OCTAVE_RANGE.min, Math.min(OCTAVE_RANGE.max, rounded))
    : OCTAVE_RANGE.initial;
  return 12 * (safeOctave + 1);
}

export function describePitch(midi, tuningId = "equal") {
  return {
    midi,
    name: noteName(midi),
    frequency: tuningFrequency(midi, tuningId),
    cents: centsFromEqual(midi, tuningId),
  };
}
