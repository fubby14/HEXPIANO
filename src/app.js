import { PianoEngine } from "./engine.js";
import { OCTAVE_RANGE, TUNINGS, centsFromEqual, describePitch, noteName, octaveStartMidi } from "./tuning.js";

const engine = new PianoEngine();
const keyboard = document.querySelector("#keyboard");
const engineButtons = [...document.querySelectorAll("[data-engine]")];
const tuningButtons = [...document.querySelectorAll("[data-tuning]")];
const tuningDescription = document.querySelector("#tuning-description");
const noteReadout = document.querySelector("#note-readout");
const frequencyReadout = document.querySelector("#frequency-readout");
const centsReadout = document.querySelector("#cents-readout");
const voiceReadout = document.querySelector("#voice-readout");
const sustainButton = document.querySelector("#sustain-button");
const midiButton = document.querySelector("#midi-button");
const octaveSlider = document.querySelector("#octave-slider");
const octaveReadout = document.querySelector("#octave-readout");
const statusMessage = document.querySelector("#status-message");
const canvas = document.querySelector("#scope");
const canvasContext = canvas.getContext("2d");

const keyBindings = ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j", "k"];
const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
const heldInputs = new Map();
const activeCounts = new Map();
let midiAccess = null;
let scopeFrame = null;
let baseMidi = octaveStartMidi(octaveSlider.value);

function buildKeyboard() {
  keyboard.replaceChildren();
  for (let offset = 0; offset <= 12; offset += 1) {
    const midi = baseMidi + offset;
    const key = document.createElement("button");
    const keyBinding = keyBindings[offset];
    const isBlack = blackPitchClasses.has(midi % 12);
    key.className = `piano-key ${isBlack ? "black" : "white"}`;
    key.dataset.midi = String(midi);
    key.dataset.note = noteName(midi);
    key.setAttribute("aria-label", `${noteName(midi)}, computer key ${keyBinding.toUpperCase()}`);
    key.innerHTML = `<span class="key-note">${noteName(midi)}</span><kbd>${keyBinding.toUpperCase()}</kbd>`;
    key.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      key.setPointerCapture(event.pointerId);
      beginInput(`pointer-${event.pointerId}`, midi, currentVelocity());
    });
    key.addEventListener("pointerup", (event) => endInput(`pointer-${event.pointerId}`));
    key.addEventListener("pointercancel", (event) => endInput(`pointer-${event.pointerId}`));
    keyboard.append(key);
  }
  keyboard.setAttribute("aria-label", `${noteName(baseMidi)} to ${noteName(baseMidi + 12)} piano keyboard`);
}

function stopPerformance() {
  heldInputs.clear();
  activeCounts.clear();
  document.querySelectorAll(".piano-key.active").forEach((key) => key.classList.remove("active"));
  engine.allNotesOff();
}

function setOctave(octave) {
  stopPerformance();
  baseMidi = octaveStartMidi(octave);
  const selectedOctave = Math.floor(baseMidi / 12) - 1;
  octaveSlider.value = String(selectedOctave);
  octaveReadout.textContent = `${noteName(baseMidi)} — ${noteName(baseMidi + 12)}`;
  buildKeyboard();
  showPitch(baseMidi);
  statusMessage.textContent = `Octave window ${selectedOctave}`;
}

async function beginInput(token, midi, velocity) {
  if (heldInputs.has(token)) return;
  heldInputs.set(token, midi);
  activeCounts.set(midi, (activeCounts.get(midi) || 0) + 1);
  setKeyActive(midi, true);
  showPitch(midi);
  statusMessage.textContent = "Listening";
  await engine.noteOn(midi, velocity);
  if (!heldInputs.has(token)) engine.noteOff(midi);
}

function endInput(token) {
  const midi = heldInputs.get(token);
  if (midi == null) return;
  heldInputs.delete(token);
  const remaining = Math.max(0, (activeCounts.get(midi) || 1) - 1);
  if (remaining === 0) {
    activeCounts.delete(midi);
    setKeyActive(midi, false);
    engine.noteOff(midi);
  } else {
    activeCounts.set(midi, remaining);
  }
}

function setKeyActive(midi, active) {
  document.querySelector(`[data-midi="${midi}"]`)?.classList.toggle("active", active);
}

function currentVelocity() {
  return Number(document.querySelector("#velocity").value);
}

function showPitch(midi) {
  const pitch = describePitch(midi, engine.tuning);
  const cents = pitch.cents;
  noteReadout.dataset.midi = String(midi);
  noteReadout.textContent = pitch.name;
  frequencyReadout.textContent = `${pitch.frequency.toFixed(2)} Hz`;
  centsReadout.textContent = `${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents`;
}

function chooseEngine(profile) {
  engine.engineProfile = profile;
  engineButtons.forEach((button) => {
    const selected = button.dataset.engine === profile;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.body.dataset.engine = profile;
  const displayName = profile === "crystal" ? "Crystal Concert" : `${profile[0].toUpperCase()}${profile.slice(1)}`;
  statusMessage.textContent = `${displayName} voice armed`;
}

function chooseTuning(tuningId) {
  engine.tuning = tuningId;
  tuningButtons.forEach((button) => {
    const selected = button.dataset.tuning === tuningId;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  tuningDescription.textContent = TUNINGS[tuningId].description;
  const displayedMidi = Number(noteReadout.dataset.midi || baseMidi);
  showPitch(displayedMidi);
}

function updateParameter(input, formatter, apply) {
  const output = document.querySelector(`[data-output="${input.id}"]`);
  const update = () => {
    const value = Number(input.value);
    output.textContent = formatter(value);
    apply(value);
  };
  input.addEventListener("input", update);
  update();
}

function setSustain(enabled) {
  engine.setSustain(enabled);
  sustainButton.classList.toggle("engaged", enabled);
  sustainButton.setAttribute("aria-pressed", String(enabled));
  sustainButton.querySelector("strong").textContent = enabled ? "Sustain on" : "Sustain";
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    midiButton.textContent = "MIDI unavailable";
    midiButton.disabled = true;
    return;
  }

  try {
    midiAccess = await navigator.requestMIDIAccess();
    bindMidiInputs();
    midiAccess.addEventListener("statechange", bindMidiInputs);
    midiButton.textContent = `${midiAccess.inputs.size} MIDI input${midiAccess.inputs.size === 1 ? "" : "s"}`;
    midiButton.classList.add("connected");
  } catch {
    midiButton.textContent = "MIDI permission denied";
  }
}

function bindMidiInputs() {
  if (!midiAccess) return;
  midiAccess.inputs.forEach((input) => {
    input.onmidimessage = ({ data }) => {
      const [status, note, value] = data;
      const command = status & 0xf0;
      const channel = status & 0x0f;
      const token = `midi-${channel}-${note}`;
      if (command === 0x90 && value > 0) beginInput(token, note, value / 127);
      if (command === 0x80 || (command === 0x90 && value === 0)) endInput(token);
      if (command === 0xb0 && note === 64) setSustain(value >= 64);
    };
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function playPhrase() {
  const button = document.querySelector("#phrase-button");
  button.disabled = true;
  const phrase = [0, 4, 7, 12, 7, 4, 2, 5, 9, 12].map((offset) => baseMidi + offset);
  for (let index = 0; index < phrase.length; index += 1) {
    const midi = phrase[index];
    const token = `phrase-${index}`;
    beginInput(token, midi, 0.58 + (index % 4) * 0.09);
    await wait(index === 3 ? 390 : 190);
    endInput(token);
  }
  button.disabled = false;
}

function resizeCanvas() {
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(bounds.width * ratio));
  canvas.height = Math.max(1, Math.round(bounds.height * ratio));
  canvasContext.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function drawScope() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvasContext.clearRect(0, 0, width, height);

  if (!engine.analyser) {
    canvasContext.strokeStyle = "rgba(126, 104, 77, 0.35)";
    canvasContext.lineWidth = 1;
    canvasContext.beginPath();
    canvasContext.moveTo(0, height / 2);
    canvasContext.lineTo(width, height / 2);
    canvasContext.stroke();
  } else {
    const waveform = new Uint8Array(engine.analyser.fftSize);
    engine.analyser.getByteTimeDomainData(waveform);
    canvasContext.strokeStyle = getComputedStyle(document.body).getPropertyValue("--voice-color").trim();
    canvasContext.lineWidth = 1.65;
    canvasContext.beginPath();
    waveform.forEach((sample, index) => {
      const x = (index / (waveform.length - 1)) * width;
      const y = (sample / 255) * height;
      if (index === 0) canvasContext.moveTo(x, y);
      else canvasContext.lineTo(x, y);
    });
    canvasContext.stroke();
  }

  scopeFrame = window.requestAnimationFrame(drawScope);
}

engineButtons.forEach((button) => button.addEventListener("click", () => chooseEngine(button.dataset.engine)));
tuningButtons.forEach((button) => button.addEventListener("click", () => chooseTuning(button.dataset.tuning)));
sustainButton.addEventListener("click", () => setSustain(!engine.sustain));
midiButton.addEventListener("click", connectMidi);
document.querySelector("#phrase-button").addEventListener("click", playPhrase);
document.querySelector("#panic-button").addEventListener("click", stopPerformance);
octaveSlider.addEventListener("input", () => setOctave(octaveSlider.value));

updateParameter(document.querySelector("#brightness"), (value) => `${Math.round(value * 100)}%`, (value) => {
  engine.brightness = value;
});
updateParameter(document.querySelector("#body"), (value) => `${Math.round(value * 100)}%`, (value) => {
  engine.body = value;
});
updateParameter(document.querySelector("#room"), (value) => `${Math.round(value * 100)}%`, (value) => {
  engine.setRoom(value);
});
updateParameter(document.querySelector("#velocity"), (value) => `${Math.round(value * 127)}`, () => {});

engine.addEventListener("statechange", ({ detail }) => {
  voiceReadout.textContent = String(detail.voices).padStart(2, "0");
});

window.addEventListener("keydown", (event) => {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.code === "Space") {
    event.preventDefault();
    setSustain(true);
    return;
  }
  if (["Digit1", "Digit2", "Digit3"].includes(event.code)) {
    chooseEngine(["crystal", "ivory", "wire"][Number(event.code.at(-1)) - 1]);
    return;
  }
  const offset = keyBindings.indexOf(event.key.toLowerCase());
  if (offset >= 0) beginInput(`keyboard-${event.code}`, baseMidi + offset, currentVelocity());
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    setSustain(false);
    return;
  }
  endInput(`keyboard-${event.code}`);
});

window.addEventListener("blur", () => {
  [...heldInputs.keys()].forEach(endInput);
  setSustain(false);
});
window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", () => window.cancelAnimationFrame(scopeFrame));

octaveSlider.min = String(OCTAVE_RANGE.min);
octaveSlider.max = String(OCTAVE_RANGE.max);
setOctave(OCTAVE_RANGE.initial);
chooseEngine("crystal");
chooseTuning("equal");
resizeCanvas();
drawScope();

// A compact inspection surface for browser tests and future wrappers.
window.HEXPIANO = {
  engine,
  chooseEngine,
  chooseTuning,
  setOctave,
  tuningFrequency: (midi) => describePitch(midi, engine.tuning).frequency,
  centsFromEqual: (midi) => centsFromEqual(midi, engine.tuning),
};
