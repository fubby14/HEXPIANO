import { tuningFrequency } from "./tuning.js";

const ENGINE_PROFILES = Object.freeze({
  crystal: {
    partials: [
      [1, 1, 1.45],
      [2, 0.39, 1.08],
      [3, 0.2, 0.78],
      [4, 0.11, 0.56],
      [5, 0.075, 0.44],
      [6, 0.045, 0.35],
      [8, 0.023, 0.26],
      [10, 0.012, 0.21],
    ],
    stretch: 0.000035,
    attack: 0.003,
    release: 0.62,
    hammer: 0.23,
    color: 1.08,
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
  },
  wire: {
    partials: [
      [1, 1, 1.6],
      [2, 0.31, 1.14],
      [3, 0.18, 0.86],
      [5, 0.095, 0.58],
      [7, 0.052, 0.42],
      [9, 0.028, 0.31],
      [12, 0.013, 0.24],
    ],
    stretch: 0.00012,
    attack: 0.0015,
    release: 0.5,
    hammer: 0.82,
    color: 1.22,
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
  constructor(engine, midi, velocity, profileName) {
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

    const now = this.context.currentTime;
    const frequency = tuningFrequency(midi, engine.tuning);
    const brightness = engine.brightness;
    const body = engine.body;

    this.output = new GainNode(this.context, { gain: 0.0001 });
    this.colorFilter = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: Math.min(18000, 2600 + 10200 * brightness * this.profile.color),
      Q: 0.42,
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
  }

  addModalBody(frequency, now) {
    const { partials, stretch } = this.profile;
    const velocityBrightness = 0.68 + this.velocity * 0.54;

    partials.forEach(([harmonic, level, decay], index) => {
      const stretched = frequency * harmonic * Math.sqrt(1 + stretch * harmonic ** 2);
      const gain = new GainNode(this.context, { gain: 0.0001 });
      const oscillator = new OscillatorNode(this.context, {
        type: index === 0 && this.profileName === "ivory" ? "triangle" : "sine",
        frequency: stretched,
        detune: index % 2 === 0 ? -0.45 : 0.55,
      });

      oscillator.connect(gain).connect(this.colorFilter);
      const peak = Math.max(0.0001, level * velocityBrightness / Math.sqrt(harmonic));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.0025 + index * 0.0003);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + decay * (0.78 + this.engine.body * 1.14) * (0.7 + 0.3 / harmonic),
      );
      oscillator.start(now);
      oscillator.stop(now + 5.4);
      this.sources.push(oscillator);
      this.nodes.push(gain);
    });
  }

  addHammer(frequency, now) {
    const duration = 0.022 + this.profile.hammer * 0.018;
    const frameCount = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, frameCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    const random = seededNoise(this.midi * 4099 + Math.round(this.velocity * 997));

    for (let index = 0; index < frameCount; index += 1) {
      const phase = index / frameCount;
      const snap = Math.sin(index * 0.91) * 0.28;
      data[index] = ((random() * 2 - 1) + snap) * (1 - phase) ** 4;
    }

    const source = new AudioBufferSourceNode(this.context, { buffer });
    const bandpass = new BiquadFilterNode(this.context, {
      type: "bandpass",
      frequency: Math.min(7800, Math.max(1700, frequency * (8 + this.engine.brightness * 9))),
      Q: 0.75 + this.profile.hammer,
    });
    const gain = new GainNode(this.context, {
      gain: (0.035 + 0.12 * this.profile.hammer) * this.velocity ** 1.35,
    });
    source.connect(bandpass).connect(gain).connect(this.colorFilter);
    source.start(now);
    this.sources.push(source);
    this.nodes.push(bandpass, gain);
  }

  addSoundboard(frequency, now) {
    const board = new OscillatorNode(this.context, {
      type: "sine",
      frequency: Math.max(48, frequency / 2),
    });
    const boardFilter = new BiquadFilterNode(this.context, {
      type: "lowpass",
      frequency: 620 + this.engine.body * 720,
      Q: 0.5,
    });
    const boardGain = new GainNode(this.context, { gain: 0.0001 });
    board.connect(boardFilter).connect(boardGain).connect(this.colorFilter);
    boardGain.gain.exponentialRampToValueAtTime(0.045 * this.engine.body * this.velocity, now + 0.012);
    boardGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2 + this.engine.body * 1.6);
    board.start(now);
    board.stop(now + 4.2);
    this.sources.push(board);
    this.nodes.push(boardFilter, boardGain);
  }

  release(force = false) {
    if (this.released) return;
    if (this.engine.sustain && !force) {
      this.sustained = true;
      return;
    }

    this.released = true;
    const now = this.context.currentTime;
    const release = force ? 0.08 : this.profile.release * (0.54 + this.engine.body * 0.72);
    exponentialFade(this.output.gain, now, 0.0001, release);

    window.setTimeout(() => this.dispose(), (release + 0.12) * 1000);
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
    this.engineProfile = "ivory";
    this.tuning = "equal";
    this.brightness = 0.68;
    this.body = 0.62;
    this.room = 0.16;
    this.sustain = false;
  }

  async ensureReady() {
    if (!this.context) this.buildGraph();
    if (this.context.state !== "running") await this.context.resume();
    return this.context;
  }

  buildGraph() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.voiceBus = new GainNode(this.context, { gain: 0.86 });
    this.master = new GainNode(this.context, { gain: 0.72 });
    this.analyser = new AnalyserNode(this.context, { fftSize: 1024, smoothingTimeConstant: 0.72 });
    const compressor = new DynamicsCompressorNode(this.context, {
      threshold: -18,
      knee: 18,
      ratio: 3.4,
      attack: 0.002,
      release: 0.22,
    });
    const warmth = new BiquadFilterNode(this.context, {
      type: "highshelf",
      frequency: 4200,
      gain: 1.4,
    });
    const dry = new GainNode(this.context, { gain: 1 });
    const wet = new GainNode(this.context, { gain: this.room });
    const reverb = new ConvolverNode(this.context, { buffer: this.makeImpulse() });

    this.voiceBus.connect(dry).connect(compressor);
    this.voiceBus.connect(reverb).connect(wet).connect(compressor);
    compressor.connect(warmth).connect(this.master).connect(this.analyser).connect(this.context.destination);
    this.roomGain = wet;
  }

  makeImpulse() {
    const seconds = 1.55;
    const length = Math.floor(this.context.sampleRate * seconds);
    const buffer = this.context.createBuffer(2, length, this.context.sampleRate);
    const random = seededNoise(0x484558);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const position = index / length;
        data[index] = (random() * 2 - 1) * (1 - position) ** 3.1;
      }
    }
    return buffer;
  }

  async noteOn(midi, velocity = 0.82) {
    await this.ensureReady();
    this.enforceVoiceLimit();
    const voice = new PianoVoice(this, midi, Math.max(0.08, Math.min(1, velocity)), this.engineProfile);
    if (!this.voices.has(midi)) this.voices.set(midi, new Set());
    this.voices.get(midi).add(voice);
    this.emitState();
    return voice;
  }

  noteOff(midi) {
    const voices = this.voices.get(midi);
    if (!voices) return;
    voices.forEach((voice) => voice.release());
    if (!this.sustain) this.voices.delete(midi);
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
