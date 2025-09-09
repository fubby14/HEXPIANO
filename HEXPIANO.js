// __    __   __________   ___    .______    __       ___      .__   __.   ______   
// |  |  |  | |   ____\  \ /  /    |   _  \  |  |     /   \     |  \ |  |  /  __  \  
// |  |__|  | |  |__   \  V  /     |  |_)  | |  |    /  ^  \    |   \|  | |  |  |  | 
// |   __   | |   __|   >   <      |   ___/  |  |   /  /_\  \   |  . `  | |  |  |  | 
// |  |  |  | |  |____ /  .  \     |  |      |  |  /  _____  \  |  |\   | |  `--'  | 
// |__|  |__| |_______/__/ \__\    | _|      |__| /__/     \__\ |__| \__|  \______/  
//                                                                                 

(() => {
  const context = new (window.AudioContext || window.webkitAudioContext)();

  // === Master spellchain: where tones are bound and tamed ===
  const preGain = new GainNode(context, { gain: 0.9 });
  const comp = new DynamicsCompressorNode(context, { threshold: -14, knee: 24, ratio: 2.8, attack: 0.003, release: 0.18 });

  // Conjured hall: a spectral reverb cauldron
  const convolver = context.createConvolver();
  const wetGain = new GainNode(context, { gain: 0.12 });
  const dryGain = new GainNode(context, { gain: 1.0 });

  // High-shelf charm for presence: a glimmering hex
  const hiShelf = new BiquadFilterNode(context, { type: 'highshelf', frequency: 3200, gain: 4 });

  // Glitch cauldron: ring mod + bitcrusher with mix
  const glitchMix = new GainNode(context, { gain: 0.35 });
  const cleanMix = new GainNode(context, { gain: 0.65 });
  const glitchBus = new GainNode(context, { gain: 1 });

  // Ring mod: multiply signal by LFO
  const ringLFO = new OscillatorNode(context, { type: 'sine', frequency: 12 });
  const ringDepth = new GainNode(context, { gain: 0.6 });
  const ringOffset = new ConstantSourceNode(context, { offset: 1.0 });
  const ringGain = new GainNode(context, { gain: 0 });
  ringLFO.connect(ringDepth); ringDepth.connect(ringGain.gain);
  ringOffset.connect(ringGain.gain);
  ringLFO.start(); ringOffset.start();

  // Bitcrusher via AudioWorklet fallback to ScriptProcessor if not available
  let crusherNode = null;
  function createCrusher(bits = 8, downsample = 4) {
    if (crusherNode && crusherNode.context) try { crusherNode.disconnect(); } catch(e){}
    const sp = context.createScriptProcessor(1024, 1, 1);
    let ph = 0, last = 0;
    sp.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);
      const step = Math.pow(2, bits) / 2;
      for (let i=0;i<input.length;i++) {
        ph += 1;
        if (ph >= downsample) { ph = 0; last = Math.round(input[i]*step)/step; }
        output[i] = last;
      }
    };
    crusherNode = sp;
    return sp;
  }
  let currentCrusher = createCrusher(8, 4);

  preGain.connect(comp);
  comp.connect(dryGain);
  comp.connect(convolver);
  convolver.connect(wetGain);
  const mix = new GainNode(context, { gain: 1 });
  dryGain.connect(mix);
  wetGain.connect(mix);

  // Insert glitch parallel bus after master comp
  const postComp = new GainNode(context, { gain: 1 });
  comp.connect(postComp);
  postComp.connect(ringGain);
  ringGain.connect(glitchBus);
  glitchBus.connect(currentCrusher);
  currentCrusher.connect(glitchMix);

  // Sum clean and glitch, then EQ to destination
  const sum = new GainNode(context, { gain: 1 });
  mix.connect(cleanMix).connect(sum);
  glitchMix.connect(sum);
  sum.connect(hiShelf).connect(context.destination);

  function buildImpulse(seconds = 1.8, decay = 2.6) {
    const rate = context.sampleRate;
    const length = rate * seconds | 0;
    const impulse = context.createBuffer(2, length, rate);
    for (let ch=0; ch<2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i=0; i<length; i++) {
        const t = i / length;
        data[i] = (Math.random()*2 - 1) * Math.pow(1 - t, decay);
      }
    }
    convolver.buffer = impulse;
  }
  buildImpulse();

  // === Hand of the Witch: bindings to mortal sliders ===
  const attack = document.getElementById('attack');
  const decay = document.getElementById('decay');
  const sustain = document.getElementById('sustain');
  const release = document.getElementById('release');
  const tone = document.getElementById('tone');
  const detune = document.getElementById('detune');
  const reverb = document.getElementById('reverb');
  const presence = document.getElementById('presence');
  const hard = document.getElementById('hard');
  const keynoise = document.getElementById('keynoise');
  const sustainBtn = document.getElementById('sustainBtn');
  const midiStatus = document.getElementById('midiStatus');
  const octaveVal = document.getElementById('octaveVal');
  const octDown = document.getElementById('octDown');
  const octUp = document.getElementById('octUp');

  const valEls = {
    attackVal: v => `${(+v).toFixed(3)}s`,
    decayVal: v => `${(+v).toFixed(2)}s`,
    sustainVal: v => `${(+v).toFixed(2)}`,
    releaseVal: v => `${(+v).toFixed(2)}s`,
    toneVal: v => `${(v/1000).toFixed(1)}kHz`,
    detuneVal: v => `${(+v).toFixed(1)}c`,
    reverbVal: v => `${Math.round(v*100)}%`,
    presenceVal: v => `${(+v>=0?'+':'')}${(+v).toFixed(1)} dB`,
    hardVal: v => `${(+v).toFixed(2)}`,
    keynoiseVal: v => `${(+v).toFixed(2)}`,
    bpmVal: v => `${(+v).toFixed(0)}`,
    swingVal: v => `${(+v).toFixed(2)}`,
    glitchMixVal: v => `${(+v).toFixed(2)}`,
    ringRateVal: v => `${(+v).toFixed(1)}Hz`,
    ringDepthVal: v => `${(+v).toFixed(2)}`,
    crushBitsVal: v => `${(+v).toFixed(0)}`,
    downsampleVal: v => `${(+v).toFixed(0)}`,
    jitterVal: v => `${(+v).toFixed(0)}ms`,
    stutterProbVal: v => `${(+v).toFixed(2)}`,
    stutterRepeatsVal: v => `${(+v).toFixed(0)}`,
    dropProbVal: v => `${(+v).toFixed(2)}`,
  };
  for (const id in valEls) {
    const input = document.getElementById(id.replace('Val',''));
    const out = document.getElementById(id);
    if (input && out) {
      input.addEventListener('input', () => out.textContent = valEls[id](input.value));
      out.textContent = valEls[id](input.value);
    }
  }

  reverb.addEventListener('input', () => wetGain.gain.value = +reverb.value);
  presence.addEventListener('input', () => hiShelf.gain.setValueAtTime(+presence.value, context.currentTime));

  // Sequencer controls — levers and dials for the marching spirits
  const playBtn = document.getElementById('playBtn');
  const bpm = document.getElementById('bpm');
  const bpmVal = document.getElementById('bpmVal');
  const stepsSel = document.getElementById('stepsSel');
  const swing = document.getElementById('swing');
  const swingVal = document.getElementById('swingVal');
  const clearBtn = document.getElementById('clearBtn');
  const gridEl = document.getElementById('grid');
  const notesInput = document.getElementById('notesInput');
  const notesApplyBtn = document.getElementById('notesApplyBtn');
  const notesPreset = document.getElementById('notesPreset');

  // Glitch UI hooks
  const glitchMixCtl = document.getElementById('glitchMix');
  const ringRateCtl = document.getElementById('ringRate');
  const ringDepthCtl = document.getElementById('ringDepth');
  const crushBitsCtl = document.getElementById('crushBits');
  const downsampleCtl = document.getElementById('downsample');
  const jitterCtl = document.getElementById('jitter');
  const stutterProbCtl = document.getElementById('stutterProb');
  const stutterRepeatsCtl = document.getElementById('stutterRepeats');
  const dropProbCtl = document.getElementById('dropProb');

  if (glitchMixCtl) glitchMixCtl.addEventListener('input', () => glitchMix.gain.value = +glitchMixCtl.value);
  if (ringRateCtl) ringRateCtl.addEventListener('input', () => ringLFO.frequency.setValueAtTime(+ringRateCtl.value, context.currentTime));
  if (ringDepthCtl) ringDepthCtl.addEventListener('input', () => ringDepth.gain.value = +ringDepthCtl.value);
  function updateCrusher() {
    const bits = +(crushBitsCtl?.value || 8);
    const down = +(downsampleCtl?.value || 4);
    const newNode = createCrusher(bits, down);
    glitchBus.disconnect();
    try { currentCrusher.disconnect(); } catch(e){}
    glitchBus.connect(newNode);
    newNode.connect(glitchMix);
    currentCrusher = newNode;
  }
  if (crushBitsCtl) crushBitsCtl.addEventListener('input', updateCrusher);
  if (downsampleCtl) downsampleCtl.addEventListener('input', updateCrusher);

  let baseOctave = 4;
  function setOctave(o) { baseOctave = Math.min(7, Math.max(1, o)); octaveVal.textContent = baseOctave; buildSequencer(); }
  octDown.onclick = () => setOctave(baseOctave-1);
  octUp.onclick = () => setOctave(baseOctave+1);

  let sustainPedal = false;
  sustainBtn.onclick = () => { sustainPedal = !sustainPedal; sustainBtn.textContent = sustainPedal ? 'On' : 'Off'; if (!sustainPedal) releaseAllSustained(); };

  // === Summoning a Voice Familiar ===
  const MAX_VOICES = 32;
  const active = new Map();
  function midiToFreq(m) { return 440 * Math.pow(2, (m-69)/12); }

  class PianoVoice {
    constructor(midi, velocity=0.85) {
      this.midi = midi;
      this.velocity = velocity;
      this.startTime = context.currentTime;
      this.isReleased = false;
      this.sustained = false;

      // Filter and amp per voice: the vessel and breath of the spirit
      this.filter = new BiquadFilterNode(context, { type: 'lowpass', frequency: +tone.value, Q: 0.7 });
      this.amp = new GainNode(context, { gain: 0.0001 });
      this.pan = new StereoPannerNode(context, { pan: ((midi % 12) - 6) / 22 });
      this.filter.connect(this.amp).connect(this.pan).connect(preGain);

      const freq = midiToFreq(midi);
      const det = +detune.value; // detune measured in witch-cents
      const now = context.currentTime;

      // Inharmonicity rune: a subtle warp that swells with pitch
      const B = 0.00002 * Math.min(1.5, freq/220);

      // Choir of partial spirits
      const partials = [
        { n:1, mult:1.0,  gain:1.00, decay:1.2 },
        { n:2, mult:2.0,  gain:0.60, decay:0.9 },
        { n:3, mult:3.0,  gain:0.38, decay:0.65 },
        { n:4, mult:4.0,  gain:0.20, decay:0.5 },
        { n:5, mult:5.0,  gain:0.12, decay:0.42 },
        { n:6, mult:6.0,  gain:0.08, decay:0.35 },
      ];
      this.oscs = [];
      this.partialGains = [];

      for (const p of partials) {
        const g = new GainNode(context, { gain: 0 });
        g.connect(this.filter);
        const inh = 1 + B * (p.n*p.n); // slight spectral stretch
        const base = freq * p.mult * inh;
        const o1 = new OscillatorNode(context, { type:'sine', frequency: base });
        const o2 = new OscillatorNode(context, { type:'sine', frequency: base * Math.pow(2, det/1200) });
        o1.connect(g); o2.connect(g);
        o1.start(now); o2.start(now);
        this.oscs.push(o1, o2);
        this.partialGains.push(g);

        // Swift strikes stoke the brighter spirits more
        const velBright = 0.6 + 0.4*this.velocity;
        const pg = p.gain * velBright * this.velocity;
        const a=+attack.value, d=+decay.value, s=+sustain.value;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pg), now + Math.max(0.002, a));
        const tail = now + d * p.decay;
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pg * s * (0.6 + 0.4*(1/p.mult))), tail);
      }

      // Hammer sprite hiss — band-passed for glitter
      const hn = this._noiseBurst(0.02, 0.18 * (0.3 + 0.7*+hard.value) * this.velocity);
      const bp = new BiquadFilterNode(context, { type:'bandpass', frequency: 3200, Q: 1.0 });
      hn.connect(bp).connect(this.filter);

      // A needle-prick click to awaken the note
      const click = new GainNode(context, { gain: 0.002 * (+hard.value) * this.velocity });
      const clickOsc = new OscillatorNode(context, { type:'square', frequency: 2000 });
      clickOsc.connect(click).connect(this.filter);
      click.gain.setValueAtTime(click.gain.value, now);
      click.gain.exponentialRampToValueAtTime(0.00001, now + 0.01);
      clickOsc.start(now); clickOsc.stop(now + 0.01);

      // Envelope incantation to swell and fade the breath
      const a=+attack.value, d=+decay.value, s=+sustain.value;
      this.amp.gain.setValueAtTime(0.0001, now);
      this.amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.9*this.velocity), now + Math.max(0.002, a));
      this.amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.9*this.velocity * s), now + a + d);

      // The veil lifts bright, then dims in a blink
      this.filter.frequency.setValueAtTime(+tone.value * (0.9 + this.velocity*0.7), now);
      this.filter.frequency.exponentialRampToValueAtTime(Math.max(1200, +tone.value*0.28), now + 0.9);

      // Tether the spirit for its dismissal
      this.stopTime = null;
    }

    _noiseBurst(seconds, gainLevel) {
      const noise = context.createBuffer(1, Math.max(1, seconds*context.sampleRate|0), context.sampleRate);
      const ndata = noise.getChannelData(0);
      for (let i=0;i<ndata.length;i++) ndata[i] = Math.random()*2 - 1;
      const src = new AudioBufferSourceNode(context, { buffer: noise });
      const g = new GainNode(context, { gain: gainLevel });
      src.connect(g);
      const now = context.currentTime;
      src.start(now); src.stop(now + seconds);
      return g;
    }

    release() {
      if (this.isReleased) return;
      this.isReleased = true;
      const now = context.currentTime;
      const r=+release.value;
      // Damper goblins rattling on release
      const knAmt = +keynoise.value * 0.15;
      if (knAmt>0) {
        const kn = this._noiseBurst(0.02, knAmt);
        const hp = new BiquadFilterNode(context, { type:'highpass', frequency: 2500, Q: 0.7 });
        kn.connect(hp).connect(this.filter);
      }
      this.amp.gain.cancelScheduledValues(now);
      this.amp.gain.setTargetAtTime(0.0001, now, r*0.4);
      this.stopTime = now + r + 0.05;
      for (const o of this.oscs) o.stop(this.stopTime);
      setTimeout(() => this.dispose(), (this.stopTime - context.currentTime + 0.1)*1000);
    }
    dispose() {
      try { this.pan.disconnect(); } catch(e){}
      try { this.filter.disconnect(); } catch(e){}
    }
  }

  function noteOn(midi, vel=0.9) {
    resume();
    enforceVoiceLimit();
    const v = new PianoVoice(midi, vel);
    const id = Symbol(midi);
    active.set(id, v);
    return id;
  }

  function noteOffByMidi(midi) {
    for (const [id, v] of active) {
      if (v.midi === midi) {
        if (sustainPedal) {
          v.sustained = true;
        } else {
          v.release();
          active.delete(id);
        }
      }
    }
  }

  function releaseAllSustained() {
    for (const [id, v] of active) {
      if (v.sustained) { v.release(); active.delete(id); }
    }
  }

  function enforceVoiceLimit() {
    if (active.size < MAX_VOICES) return;
    let oldestId = null, oldestTime = Infinity;
    for (const [id, v] of active) {
      if (v.sustained) continue;
      if (v.startTime < oldestTime) { oldestTime = v.startTime; oldestId = id; }
    }
    if (oldestId) { active.get(oldestId).release(); active.delete(oldestId); }
  }

  function resume() { if (context.state !== 'running') context.resume(); }

  // === The Procession Engine: a humble step sequencer ===
  const WHITE_OFFSETS = [0,2,4,5,7,9,11,12];
  let numRows = 8;
  let numSteps = 16;
  let rowMidis = [];
  let gridState = [];
  let isPlaying = false;
  let currentStep = 0;
  let nextStepTime = 0;
  const scheduleAhead = 0.15; // seconds
  let schedulerTimer = null;

  function computeRowMidis() {
    const startMidi = 12*(baseOctave+1);
    const rows = [];
    for (let r=0; r<numRows; r++) {
      // Top row highest note
      const off = WHITE_OFFSETS[WHITE_OFFSETS.length-1 - (r % WHITE_OFFSETS.length)];
      rows.push(startMidi + off);
    }
    return rows;
  }

  function noteNameToMidi(name) {
    if (!name) return null;
    const m = String(name).trim().toUpperCase().match(/^([A-G])([#B]?)(-?\d{1,2})$/);
    if (!m) return null;
    const baseMap = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
    let semis = baseMap[m[1]];
    if (m[2] === '#') semis += 1; else if (m[2] === 'B') semis -= 1;
    const octave = parseInt(m[3], 10);
    return 12 * (octave + 1) + semis;
  }

  function ensureGridState() {
    if (!gridState.length) gridState = Array.from({length:numRows}, () => Array.from({length:numSteps}, () => false));
    // Resize rows
    if (gridState.length !== numRows) {
      gridState = Array.from({length:numRows}, (_, r) => gridState[r] ? gridState[r].slice(0, numSteps) : Array.from({length:numSteps}, () => false));
    }
    // Resize columns
    for (let r=0; r<numRows; r++) {
      const row = gridState[r] || [];
      if (row.length < numSteps) row.push(...Array.from({length: numSteps - row.length}, () => false));
      gridState[r] = row.slice(0, numSteps);
    }
  }

  function clearGridState() {
    for (let r=0; r<numRows; r++) for (let c=0; c<numSteps; c++) gridState[r][c] = false;
    gridEl.querySelectorAll('.cell.active').forEach(el => el.classList.remove('active'));
  }

  function stepDuration() {
    const bpmValNum = +bpm?.value || 120;
    const bar = 4 * (60 / bpmValNum);
    return bar / numSteps;
  }

  function schedule() {
    const now = context.currentTime;
    while (nextStepTime < now + scheduleAhead) {
      scheduleStep(currentStep, nextStepTime);
      nextStepTime += stepDuration();
      currentStep = (currentStep + 1) % numSteps;
    }
  }

  function scheduleStep(stepIdx, when) {
    let t = when;
    if ((stepIdx % 2) === 1) t += (+swing?.value || 0) * stepDuration() * 0.5;

    // Glitchy timing: jitter and drop
    const jitterMs = +(jitterCtl?.value || 0);
    if (jitterMs > 0) t += (Math.random()*2 - 1) * (jitterMs/1000);
    const dropProb = +(dropProbCtl?.value || 0);
    const doDrop = Math.random() < dropProb;

    const noteLen = stepDuration() * 0.9;
    // UI playhead update
    const deltaMs = Math.max(0, (t - context.currentTime) * 1000);
    setTimeout(() => updatePlayhead(stepIdx), deltaMs);

    // Stutter decision
    const stProb = +(stutterProbCtl?.value || 0);
    const repeats = +(stutterRepeatsCtl?.value || 1);
    const doStutter = Math.random() < stProb;

    function triggerRowAtTime(rowIdx, atTime) {
      const midi = rowMidis[rowIdx];
      const dMs = Math.max(0, (atTime - context.currentTime) * 1000);
      setTimeout(() => {
        noteOn(midi, 0.95);
        setTimeout(() => noteOffByMidi(midi), Math.max(10, noteLen*1000));
      }, dMs);
    }

    for (let r=0; r<numRows; r++) {
      if (!gridState[r][stepIdx]) continue;
      if (doDrop) continue;
      if (!doStutter) {
        triggerRowAtTime(r, t);
      } else {
        const dt = stepDuration() / (repeats + 1);
        for (let k=0; k<=repeats; k++) {
          triggerRowAtTime(r, t + dt*k);
        }
      }
    }
  }

  function updatePlayhead(stepIdx) {
    gridEl.querySelectorAll('.cell.playhead').forEach(el => el.classList.remove('playhead'));
    gridEl.querySelectorAll(`.cell[data-c="${stepIdx}"]`).forEach(el => el.classList.add('playhead'));
  }

  function togglePlay() {
    if (!isPlaying) {
      resume();
      isPlaying = true;
      playBtn && (playBtn.textContent = 'Stop');
      currentStep = 0;
      nextStepTime = context.currentTime + 0.1;
      schedulerTimer = setInterval(schedule, 25);
    } else {
      isPlaying = false;
      playBtn && (playBtn.textContent = 'Play');
      if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
      gridEl.querySelectorAll('.cell.playhead').forEach(el => el.classList.remove('playhead'));
    }
  }

  function buildSequencer() {
    if (!gridEl) return;
    numSteps = +(stepsSel?.value || 16);
    rowMidis = computeRowMidis();
    ensureGridState();
    gridEl.innerHTML = '';
    for (let r=0; r<numRows; r++) {
      const row = document.createElement('div');
      row.className = 'seq-row';
      const lab = document.createElement('div');
      lab.className = 'label-cell';
      lab.textContent = midiToKeyLabel(rowMidis[r]);
      row.appendChild(lab);
      for (let c=0; c<numSteps; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell' + (gridState[r][c] ? ' active' : '');
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          const rr = +cell.dataset.r, cc = +cell.dataset.c;
          gridState[rr][cc] = !gridState[rr][cc];
          cell.classList.toggle('active', gridState[rr][cc]);
        });
        row.appendChild(cell);
      }
      gridEl.appendChild(row);
    }
  }

  function applyCustomNotesFromInput() {
    if (!notesInput) return;
    const parts = notesInput.value.split(/[\,\s]+/).filter(Boolean);
    const midis = parts.map(noteNameToMidi).filter(m => m !== null);
    if (!midis.length) return;
    // Map provided notes top-to-bottom; pad or trim to numRows
    const mapped = Array.from({length:numRows}, (_, i) => midis[i % midis.length]);
    rowMidis = mapped;
    // Update row labels without disturbing gridState
    const labels = gridEl.querySelectorAll('.label-cell');
    labels.forEach((el, idx) => { if (rowMidis[idx] != null) el.textContent = midiToKeyLabel(rowMidis[idx]); });
  }

  // Wire sequencer controls
  playBtn && (playBtn.onclick = () => togglePlay());
  bpm && bpm.addEventListener('input', () => bpmVal && (bpmVal.textContent = `${(+bpm.value).toFixed(0)}`));
  stepsSel && stepsSel.addEventListener('change', () => { buildSequencer(); });
  swing && swing.addEventListener('input', () => swingVal && (swingVal.textContent = `${(+swing.value).toFixed(2)}`));
  clearBtn && (clearBtn.onclick = () => clearGridState());
  notesApplyBtn && (notesApplyBtn.onclick = () => applyCustomNotesFromInput());
  notesPreset && notesPreset.addEventListener('change', () => {
    const val = notesPreset.value;
    const presets = {
      C_MAJOR: ['C4','D4','E4','F4','G4','A4','B4','C5'],
      A_NAT_MINOR: ['A3','B3','C4','D4','E4','F4','G4','A4'],
      C_MIN_PENT: ['C4','EB4','F4','G4','BB4','C5','EB5','F5'],
      C_MAJ7_ARP: ['C4','E4','G4','B4','C5','E5','G5','B5'],
      C_CHROMATIC: ['C4','C#4','D4','D#4','E4','F4','F#4','G4']
    };
    if (val && presets[val]) {
      const list = presets[val];
      if (notesInput) notesInput.value = list.join(' ');
      applyCustomNotesFromInput();
    }
  });

  // The witch's labels for the staves
  function midiToKeyLabel(m) {
    const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return names[m%12]+Math.floor(m/12-1);
  }

  // Initialize sequencer
  setOctave(4);

  // Stir the brew while it boils: live tone tweaks
  tone.addEventListener('input', () => { for (const [,v] of active) v.filter.frequency.setValueAtTime(+tone.value, context.currentTime); });

  // MIDI familiars welcomed at the door
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(access => {
      midiStatus.textContent = 'connected';
      for (const input of access.inputs.values()) {
        input.onmidimessage = msg => {
          const [status,data1,data2] = msg.data;
          const cmd = status & 0xf0;
          if (cmd === 0x90 && data2>0) { noteOn(data1, Math.max(0.2, data2/127)); }
          else if ((cmd === 0x80) || (cmd===0x90 && data2===0)) { noteOffByMidi(data1); }
          else if (cmd === 0xB0 && data1 === 64) { sustainPedal = data2 >= 64; sustainBtn.textContent = sustainPedal ? 'On' : 'Off'; if (!sustainPedal) releaseAllSustained(); }
        }
      }
    }).catch(() => { midiStatus.textContent = 'no access'; });
  }

  // Unseal the cauldron on the first touch
  window.addEventListener('pointerdown', () => { if (context.state !== 'running') context.resume(); }, { once:true });
})();


