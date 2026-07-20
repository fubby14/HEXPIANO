import { tuningFrequency } from "./tuning.js";
import {
  concertStringDetunes,
  hammerBands,
  registerDecayScale,
  strikeWeight,
} from "./concert-voicing.js";

const ENGINE_PROFILES = Object.freeze({
  crystal: {
    partials: [
      [1, 1, 2.58],
      [2, 0.46, 1.92],
      [3, 0.25, 1.42],
      [4, 0.14, 1.02],
      [5, 0.092, 0.78],
      [6, 0.058, 0.62],
      [8, 0.03, 0.46],
      [10, 0.017, 0.35],
      [12, 0.009, 0.27],
      [14, 0.005, 0.21],
    ],
    stretch: 0.000048,
    attack: 0.0022,
    release: 0.96,
    hammer: 0.39,
    color: 1.16,
    soundboard: 1.08,
    bloom: 1.58,
    duplex: 0.92,
    partialFalloff: 0.3,
  },
  ivory: {
    partials: [
      [1, 1, 1.28],
      [2, 0.48, 0.94],
      [3, 0.22, 0.66],
      [4, 0.13, 0.5],
      [5, 0.07, 0.38],
      [7, 0.034, 0.29],
      [9, 0.016, 0.22],
    ],
    stretch: 0.000055,
    attack: 0.004,
    release: 0.76,
    hammer: 0.58,
    color: 0.92,
    soundboard: 0.44,
    bloom: 0.82,
    duplex: 0.12,
    partialFalloff: 0.58,
  },
  wire: {
    partials: [
      [1, 1, 2.08],
      [2, 0.34, 1.56],
      [3, 0.21, 1.12],
      [5, 0.11, 0.8],
      [7, 0.058, 0.58],
      [9, 0.032, 0.43],
      [12, 0.015, 0.32],
    ],
    stretch: 0.00012,
    attack: 0.0015,
    release: 0.84,
    hammer: 0.82,
    color: 1.22,
    soundboard: 1.12,
    bloom: 1.46,
    duplex: 0.38,
    partialFalloff: 0.48,
  },
});

function seededNoise(seed) {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function exponentialFade(param, now, peak, duration) {
  if (typeof param.cancelAndHoldAtTime === "function") {
    param.cancelAndHoldAtTime(now);
  } else {
    param.cancelScheduledValues(now);
    param.setValueAtTime(Math.max(0.0001, param.value || 0.0001), now);
  }
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + duration);
}

class PianoVoice {
  constructor(engine, midi, velocity, profileName, startAt = null) {
    this.engine = engine;
    this.context = engine.context;
    this.midi = midi;
    this.velocity = velocity;
    this.profileName = profileName;
    this.profile = ENGINE_PROFILES[profileName];
    this.sources = [];
    this.nodes = [];
    this.released = false;
    this.sustained = false;

    const now = Math.max(this.context.currentTime, startAt ?? this.context.currentTime);
    const frequency = tuningFrequency(midi, engine.tuning);
    const brightness = engine.brightness;
    const body = engine.body;
    const register = Math.max(0, Math.min(1, (midi - 24) / 72));

    this.output = new GainNode(this.context, { gain: 0.0001 });
    this.colorFilter = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: Math.min(19000, 2800 + 10800 * brightness * this.profile.color * (0.84 + register * 0.2)),
      Q: 0.48,
    });
    this.pan = new StereoPannerNode(this.context, {
      pan: Math.max(-0.38, Math.min(0.38, (midi - 66) / 34)),
    });
    this.colorFilter.connect(this.output).connect(this.pan).connect(engine.voiceBus);
    this.nodes.push(this.output, this.colorFilter, this.pan);

    const attack = this.profile.attack + (1 - velocity) * 0.004;
    this.output.gain.setValueAtTime(0.0001, now);
    this.output.gain.exponentialRampToValueAtTime(0.56 * velocity, now + attack);
    this.output.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, 0.21 * velocity * (0.68 + body * 0.5)),
      now + 0.86 + body * 0.58,
    );

    this.addModalBody(frequency, now);
    this.addHammer(frequency, now);
    this.addSoundboard(frequency, now);
    this.addDuplexResonance(frequency, now);
  }

  addModalBody(frequency, now) {
    const { partials, stretch, partialFalloff } = this.profile;
    const velocityBrightness = 0.64 + this.velocity * 0.62;
    const stringDetunes = concertStringDetunes(this.midi, this.profileName);
    const decayScale = registerDecayScale(this.midi);

    partials.forEach(([harmonic, level, decay], index) => {
      const stretched = frequency * harmonic * Math.sqrt(1 + stretch * harmonic ** 2);
      const partialDetunes = harmonic <= 4 ? stringDetunes : [0];
      const partialDuration =
        decay * (0.96 + this.engine.body * 1.48) * decayScale * (0.72 + 0.28 / harmonic);
      const gain = new GainNode(this.context, { gain: 0.0001 });
      gain.connect(this.colorFilter);
      const hammerNode = strikeWeight(harmonic);
      const peak = Math.max(
        0.0001,
        (level * velocityBrightness * hammerNode) /
          (harmonic ** partialFalloff * partialDetunes.length),
      );
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.0018 + index * 0.00026);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + partialDuration);

      partialDetunes.forEach((stringDetune, stringIndex) => {
        const oscillator = new OscillatorNode(this.context, {
          type: index === 0 && this.profileName === "ivory" ? "triangle" : "sine",
          frequency: stretched,
          detune: stringDetune + (index % 2 === 0 ? -0.14 : 0.16) * stringIndex,
        });
        oscillator.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + partialDuration + 0.18);
        this.sources.push(oscillator);
      });
      this.nodes.push(gain);
    });
  }

  addHammer(frequency, now) {
    const duration = 0.018 + this.profile.hammer * 0.024;
    const buffer = this.makeNoiseBuffer(duration, this.midi * 4099 + Math.round(this.velocity * 997), 4.4);
    const source = new AudioBufferSourceNode(this.context, { buffer });
    const bands = hammerBands(frequency, this.velocity, this.engine.brightness);
    const attackFilter = new BiquadFilterNode(this.context, {
      type: "bandpass",
      frequency: bands.attackFrequency,
      Q: 1.15 + this.profile.hammer * 0.9,
    });
    const attackGain = new GainNode(this.context, {
      gain: bands.attackGain * (0.7 + this.profile.hammer * 0.55),
    });
    const bodyFilter = new BiquadFilterNode(this.context, {
      type: "bandpass",
      frequency: bands.bodyFrequency,
      Q: 0.68,
    });
    const bodyGain = new GainNode(this.context, {
      gain: bands.bodyGain * (0.72 + this.profile.soundboard * 0.35),
    });
    source.connect(attackFilter).connect(attackGain).connect(this.colorFilter);
    source.connect(bodyFilter).connect(bodyGain).connect(this.colorFilter);
    source.start(now);
    this.sources.push(source);
    this.nodes.push(attackFilter, attackGain, bodyFilter, bodyGain);
  }

  addSoundboard(frequency, now) {
    const boardFilter = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: 720 + this.engine.body * 880,
      Q: 0.62,
    });
    boardFilter.connect(this.colorFilter);
    this.nodes.push(boardFilter);

    const lowRatio = frequency >= 70 ? 0.5 : 1;
    const resonances = [
      [lowRatio, 0.052, 1.2],
      [1, 0.036, 1],
      [1.5, 0.018, 0.72],
    ];
    const bloom =
      this.profile.bloom * (1.5 + this.engine.body * 2.4) * registerDecayScale(this.midi);

    resonances.forEach(([ratio, level, decay], index) => {
      const board = new OscillatorNode(this.context, {
        type: "sine",
        frequency: Math.max(27.5, frequency * ratio),
        detune: index === 0 ? -1.2 : index === 2 ? 1.4 : 0,
      });
      const boardGain = new GainNode(this.context, { gain: 0.0001 });
      board.connect(boardGain).connect(boardFilter);
      const peak = level * this.profile.soundboard * this.engine.body * this.velocity;
      boardGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.018 + index * 0.006);
      boardGain.gain.exponentialRampToValueAtTime(0.0001, now + bloom * decay);
      board.start(now);
      board.stop(now + bloom * decay + 0.2);
      this.sources.push(board);
      this.nodes.push(boardGain);
    });
  }

  addDuplexResonance(frequency, now) {
    if (!this.profile.duplex) return;
    const decayScale = registerDecayScale(this.midi);
    const resonances = [
      [2.012, 0.012, 2.4],
      [3.018, 0.007, 2.05],
      [4.036, 0.0038, 1.6],
    ];

    resonances.forEach(([ratio, level, duration], index) => {
      const oscillator = new OscillatorNode(this.context, {
        type: "sine",
        frequency: frequency * ratio,
        detune: index % 2 === 0 ? 1.2 : -1.1,
      });
      const gain = new GainNode(this.context, { gain: 0.0001 });
      const peak = level * this.profile.duplex * this.engine.body * (0.5 + this.velocity * 0.5);
      oscillator.connect(gain).connect(this.colorFilter);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.048 + index * 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration * decayScale);
      oscillator.start(now);
      oscillator.stop(now + duration * decayScale + 0.18);
      this.sources.push(oscillator);
      this.nodes.push(gain);
    });
  }

  makeNoiseBuffer(duration, seed, falloff) {
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    const random = seededNoise(seed);
    for (let index = 0; index < frameCount; index += 1) {
      const phase = index / frameCount;
      const snap = Math.sin(index * 0.91) * 0.28;
      data[index] = ((random() * 2 - 1) + snap) * (1 - phase) ** falloff;
    }
    return buffer;
  }

  addDamperNoise(now) {
    const buffer = this.makeNoiseBuffer(0.032, this.midi * 2027 + 17, 3.2);
    const source = new AudioBufferSourceNode(this.context, { buffer });
    const filter = new BiquadFilterNode(this.context, {
      type: "bandpass",
      frequency: Math.min(5200, 1800 + this.midi * 28),
      Q: 0.82,
    });
    const gain = new GainNode(this.context, {
      gain: 0.0065 * this.profile.soundboard * (0.45 + this.velocity * 0.55),
    });
    source.connect(filter).connect(gain).connect(this.colorFilter);
    source.start(now);
    this.sources.push(source);
    this.nodes.push(filter, gain);
  }

  release(force = false, releaseAt = null) {
    if (this.released) {
      if (force) this.dispose();
      return;
    }
    if (this.engine.sustain && !force) {
      this.sustained = true;
      return;
    }

    this.released = true;
    const now = Math.max(this.context.currentTime, releaseAt ?? this.context.currentTime);
    const release = force ? 0.08 : this.profile.release * (0.54 + this.engine.body * 0.72);
    if (!force) this.addDamperNoise(now);
    exponentialFade(this.output.gain, now, 0.0001, release);

    const waitForScheduledRelease = Math.max(0, now - this.context.currentTime);
    window.setTimeout(() => this.dispose(), (waitForScheduledRelease + release + 0.12) * 1000);
  }

  dispose() {
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // One-shot sources may already have ended.
      }
      try {
        source.disconnect();
      } catch {
        // Nodes are allowed to be disconnected more than once.
      }
    });
    this.nodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // Nodes are allowed to be disconnected more than once.
      }
    });
    this.engine.forget(this);
  }
}

export class PianoEngine extends EventTarget {
  constructor() {
    super();
    this.context = null;
    this.voiceBus = null;
    this.master = null;
    this.analyser = null;
    this.voices = new Map();
    this.engineProfile = "crystal";
    this.tuning = "equal";
    this.brightness = 0.76;
    this.body = 0.86;
    this.room = 0.22;
    this.sustain = false;
  }

  async ensureReady() {
    if (!this.context) this.buildGraph();
    if (this.context.state !== "running") await this.context.resume();
    return this.context;
  }

  buildGraph() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.voiceBus = new GainNode(this.context, { gain: 0.8 });
    this.master = new GainNode(this.context, { gain: 0.76 });
    this.analyser = new AnalyserNode(this.context, { fftSize: 1024, smoothingTimeConstant: 0.72 });
    const compressor = new DynamicsCompressorNode(this.context, {
      threshold: -16,
      knee: 16,
      ratio: 2.6,
      attack: 0.009,
      release: 0.28,
    });
    const warmth = new BiquadFilterNode(this.context, {
      type: "highshelf",
      frequency: 6800,
      gain: 1.25,
    });
    const bodyShelf = new BiquadFilterNode(this.context, {
      type: "lowshelf",
      frequency: 155,
      gain: 3.2,
    });
    const presence = new BiquadFilterNode(this.context, {
      type: "peaking",
      frequency: 2850,
      Q: 0.72,
      gain: 1.8,
    });
    const subsonicGuard = new BiquadFilterNode(this.context, {
      type: "highpass",
      frequency: 25,
      Q: 0.7,
    });
    const dry = new GainNode(this.context, { gain: 1 });
    const wet = new GainNode(this.context, { gain: this.room });
    const reverb = new ConvolverNode(this.context, { buffer: this.makeImpulse() });
    const hallPreDelay = new DelayNode(this.context, { delayTime: 0.022, maxDelayTime: 0.1 });
    const hallHighpass = new BiquadFilterNode(this.context, {
      type: "highpass",
      frequency: 105,
      Q: 0.5,
    });
    const hallTone = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: 6900,
      Q: 0.42,
    });

    this.voiceBus.connect(dry).connect(compressor);
    this.voiceBus
      .connect(hallPreDelay)
      .connect(reverb)
      .connect(hallHighpass)
      .connect(hallTone)
      .connect(wet)
      .connect(compressor);
    compressor
      .connect(subsonicGuard)
      .connect(bodyShelf)
      .connect(presence)
      .connect(warmth)
      .connect(this.master)
      .connect(this.analyser)
      .connect(this.context.destination);
    this.roomGain = wet;
  }

  makeImpulse() {
    const seconds = 2.45;
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    const random = seededNoise(0x484558);
    const earlyReflections = [
      [0.019, 0.58],
      [0.034, 0.42],
      [0.052, 0.31],
      [0.079, 0.22],
    ];
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const position = index / length;
        const tail = (random() * 2 - 1) * (1 - position) ** 2.65 * 0.42;
        let early = 0;
        for (const [time, level] of earlyReflections) {
          if (Math.abs(index - time * this.context.sampleRate) < 2) {
            early += level * (channel === 0 ? 1 : 0.91);
          }
        }
        data[index] = tail + early;
      }
    }
    return buffer;
  }

  async noteOn(midi, velocity = 0.82, startAt = null) {
    await this.ensureReady();
    this.enforceVoiceLimit();
    const voice = new PianoVoice(
      this,
      midi,
      Math.max(0.08, Math.min(1, velocity)),
      this.engineProfile,
      startAt,
    );
    if (!this.voices.has(midi)) this.voices.set(midi, new Set());
    this.voices.get(midi).add(voice);
    this.emitState();
    return voice;
  }

  noteOff(midi, releaseAt = null) {
    const voices = this.voices.get(midi);
    if (!voices) return;
    voices.forEach((voice) => voice.release(false, releaseAt));
    this.emitState();
  }

  setSustain(enabled) {
    this.sustain = Boolean(enabled);
    if (!this.sustain) {
      this.voices.forEach((voices) => {
        voices.forEach((voice) => {
          if (voice.sustained) voice.release(true);
        });
      });
    }
    this.emitState();
  }

  setRoom(amount) {
    this.room = amount;
    if (this.context && this.roomGain) {
      this.roomGain.gain.setTargetAtTime(amount, this.context.currentTime, 0.035);
    }
  }

  allNotesOff() {
    this.voices.forEach((voices) => voices.forEach((voice) => voice.release(true)));
    this.voices.clear();
    this.setSustain(false);
  }

  enforceVoiceLimit() {
    const current = [...this.voices.values()].reduce((total, set) => total + set.size, 0);
    if (current < 28) return;
    const firstSet = this.voices.values().next().value;
    const firstVoice = firstSet?.values().next().value;
    firstVoice?.release(true);
  }

  forget(voice) {
    const voices = this.voices.get(voice.midi);
    if (!voices) return;
    voices.delete(voice);
    if (voices.size === 0) this.voices.delete(voice.midi);
    this.emitState();
  }

  emitState() {
    const count = [...this.voices.values()].reduce((total, set) => total + set.size, 0);
    this.dispatchEvent(new CustomEvent("statechange", { detail: { voices: count, sustain: this.sustain } }));
  }
}
