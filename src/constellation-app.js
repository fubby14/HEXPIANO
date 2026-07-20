import { PianoEngine } from "./engine.js";
import { MOTION_MODES, buildMotionSequence, stepDurationSeconds } from "./arp-patterns.js";
import { TUNINGS, noteName } from "./tuning.js";

const FIELD_WIDTH = 720;
const FIELD_HEIGHT = 560;
const GRID_RADIUS = 2;
const LOOKAHEAD_SECONDS = 0.14;
const SCHEDULER_INTERVAL = 25;

const engine = new PianoEngine();
const field = document.querySelector("#hex-field");
const path = document.querySelector("#constellation-path");
const shadowPath = document.querySelector("#constellation-shadow");
const sequenceNames = document.querySelector("#sequence-names");
const statusMessage = document.querySelector("#status-message");
const playButton = document.querySelector("#play-button");
const clearButton = document.querySelector("#clear-button");
const voiceCount = document.querySelector("#voice-count");
const pulseDot = document.querySelector("#pulse-dot");
const motionDescription = document.querySelector("#motion-description");
const tempoInput = document.querySelector("#tempo");
const rateInput = document.querySelector("#rate");
const gateInput = document.querySelector("#gate");
const swingInput = document.querySelector("#swing");
const octavesInput = document.querySelector("#octaves");
const resonanceInput = document.querySelector("#resonance");

const nodes = [];
const nodesById = new Map();
let selectedIds = [];
let motion = "orbit";
let painting = null;
let playing = false;
let schedulerTimer = null;
let nextNoteTime = 0;
let noteIndex = 0;
let globalStep = 0;
let cycle = 0;
let performanceSequence = [];
let activePulseTimer = null;

function makeGrid() {
  for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r += 1) {
    const qMin = Math.max(-GRID_RADIUS, -r - GRID_RADIUS);
    const qMax = Math.min(GRID_RADIUS, -r + GRID_RADIUS);
    for (let q = qMin; q <= qMax; q += 1) {
      const x = q * 108 + r * 54;
      const y = r * 93.5;
      const midi = 60 + q * 7 + r * 4;
      const node = { id: `${q}:${r}`, q, r, midi, x, y };
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hex-note";
      button.dataset.nodeId = node.id;
      button.dataset.midi = String(midi);
      button.style.setProperty("--node-left", `${((FIELD_WIDTH / 2 + x) / FIELD_WIDTH) * 100}%`);
      button.style.setProperty("--node-top", `${((FIELD_HEIGHT / 2 + y) / FIELD_HEIGHT) * 100}%`);
      button.setAttribute("aria-label", `${noteName(midi)}; fifth coordinate ${q}; third coordinate ${r}`);
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `
        <span class="note-name">${noteName(midi)}</span>
        <span class="harmonic-coordinate">${q >= 0 ? "+" : ""}${q}Ⅴ · ${r >= 0 ? "+" : ""}${r}Ⅲ</span>
      `;
      button.addEventListener("pointerdown", (event) => beginPaint(event, node));
      button.addEventListener("click", (event) => {
        if (event.detail !== 0) return;
        toggleNode(node);
        audition(node.midi);
      });
      node.element = button;
      nodes.push(node);
      nodesById.set(node.id, node);
      field.append(button);
    }
  }

  selectedIds = ["0:0", "0:1", "1:0", "2:0"];
  renderSelection();
}

function selectionNodes() {
  return selectedIds.map((id) => nodesById.get(id)).filter(Boolean);
}

function beginPaint(event, node) {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  event.preventDefault();
  const isSelected = selectedIds.includes(node.id);
  painting = { mode: isSelected ? "remove" : "add", visited: new Set() };
  paintNode(node);
}

function paintNode(node) {
  if (!painting || painting.visited.has(node.id)) return;
  painting.visited.add(node.id);
  const isSelected = selectedIds.includes(node.id);
  if (painting.mode === "add" && !isSelected) {
    selectedIds.push(node.id);
    audition(node.midi);
  }
  if (painting.mode === "remove" && isSelected) {
    selectedIds = selectedIds.filter((id) => id !== node.id);
  }
  renderSelection();
}

function toggleNode(node) {
  if (selectedIds.includes(node.id)) {
    selectedIds = selectedIds.filter((id) => id !== node.id);
  } else {
    selectedIds.push(node.id);
  }
  renderSelection();
}

function renderSelection() {
  nodes.forEach((node) => {
    const selected = selectedIds.includes(node.id);
    node.element.classList.toggle("selected", selected);
    node.element.setAttribute("aria-pressed", String(selected));
  });

  const selected = selectionNodes();
  const points = selected
    .map((node) => `${(FIELD_WIDTH / 2 + node.x).toFixed(1)},${(FIELD_HEIGHT / 2 + node.y).toFixed(1)}`)
    .join(" ");
  path.setAttribute("points", points);
  shadowPath.setAttribute("points", points);
  sequenceNames.textContent = selected.length ? selected.map((node) => noteName(node.midi)).join(" · ") : "No notes drawn";

  if (playing) refreshSequence();
  if (!selected.length) {
    statusMessage.textContent = "Draw at least one star";
    if (playing) stop();
  } else if (!playing) {
    statusMessage.textContent = `${selected.length} star${selected.length === 1 ? "" : "s"} ready`;
  }
}

async function audition(midi) {
  try {
    await engine.noteOn(midi, 0.72);
    window.setTimeout(() => engine.noteOff(midi), 520);
  } catch {
    statusMessage.textContent = "Audio could not start in this browser";
  }
}

function buildPerformanceSequence() {
  const base = buildMotionSequence(
    selectionNodes().map((node) => node.midi),
    motion,
    cycle,
  );
  const octaves = Number(octavesInput.value);
  return Array.from({ length: octaves }, (_, octave) =>
    base.map((sourceMidi) => ({ sourceMidi, midi: sourceMidi + octave * 12 })),
  ).flat();
}

function refreshSequence() {
  performanceSequence = buildPerformanceSequence();
  noteIndex = 0;
  cycle = 0;
}

async function start() {
  if (playing || !selectedIds.length) return;
  try {
    const context = await engine.ensureReady();
    if (playing) return;
    playing = true;
    cycle = 0;
    noteIndex = 0;
    globalStep = 0;
    performanceSequence = buildPerformanceSequence();
    nextNoteTime = context.currentTime + 0.055;
    document.body.classList.add("is-playing");
    playButton.querySelector("strong").textContent = "Stop orbit";
    statusMessage.textContent = `${MOTION_MODES[motion].name} in motion`;
    schedule();
  } catch {
    statusMessage.textContent = "Audio could not start in this browser";
  }
}

function stop() {
  if (schedulerTimer) window.clearTimeout(schedulerTimer);
  schedulerTimer = null;
  playing = false;
  performanceSequence = [];
  document.body.classList.remove("is-playing");
  playButton.querySelector("strong").textContent = "Begin orbit";
  engine.allNotesOff();
  clearActivePulse();
  statusMessage.textContent = selectedIds.length
    ? `${selectedIds.length} star${selectedIds.length === 1 ? "" : "s"} ready`
    : "Draw at least one star";
}

function schedule() {
  if (!playing || !engine.context) return;
  while (nextNoteTime < engine.context.currentTime + LOOKAHEAD_SECONDS) {
    if (!performanceSequence.length) {
      stop();
      return;
    }
    if (noteIndex >= performanceSequence.length) {
      cycle += 1;
      noteIndex = 0;
      performanceSequence = buildPerformanceSequence();
    }

    const entry = performanceSequence[noteIndex];
    const duration = stepDurationSeconds(tempoInput.value, rateInput.value, swingInput.value, globalStep);
    const gateDuration = Math.max(0.045, duration * Number(gateInput.value));
    const when = nextNoteTime;
    const velocity = 0.64 + (globalStep % 4 === 0 ? 0.11 : 0) + (entry.midi % 12) * 0.003;

    engine.noteOn(entry.midi, velocity, when).then(() => engine.noteOff(entry.midi, when + gateDuration));
    schedulePulse(entry.sourceMidi, entry.midi, when, duration);
    nextNoteTime += duration;
    noteIndex += 1;
    globalStep += 1;
  }
  schedulerTimer = window.setTimeout(schedule, SCHEDULER_INTERVAL);
}

function schedulePulse(sourceMidi, soundingMidi, when, duration) {
  const delay = Math.max(0, (when - engine.context.currentTime) * 1000);
  window.setTimeout(() => {
    if (!playing) return;
    nodes.forEach((node) => node.element.classList.toggle("active", node.midi === sourceMidi));
    pulseDot.classList.add("flash");
    statusMessage.textContent = `${noteName(soundingMidi)} · ${MOTION_MODES[motion].name}`;
    if (activePulseTimer) window.clearTimeout(activePulseTimer);
    activePulseTimer = window.setTimeout(clearActivePulse, Math.max(80, duration * 620));
  }, delay);
}

function clearActivePulse() {
  nodes.forEach((node) => node.element.classList.remove("active"));
  pulseDot.classList.remove("flash");
  activePulseTimer = null;
}

function chooseMotion(nextMotion) {
  motion = MOTION_MODES[nextMotion] ? nextMotion : "orbit";
  document.querySelectorAll("[data-motion]").forEach((button) => {
    const selected = button.dataset.motion === motion;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  motionDescription.textContent = MOTION_MODES[motion].description;
  if (playing) {
    refreshSequence();
    statusMessage.textContent = `${MOTION_MODES[motion].name} in motion`;
  }
}

function chooseTuning(tuning) {
  engine.tuning = TUNINGS[tuning] ? tuning : "equal";
  document.querySelectorAll("[data-tuning]").forEach((button) => {
    const selected = button.dataset.tuning === engine.tuning;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  document.querySelector("#tuning-description").textContent = TUNINGS[engine.tuning].description;
}

function bindRange(input, output, format, apply = () => {}) {
  const update = () => {
    output.textContent = format(Number(input.value));
    apply(Number(input.value));
  };
  input.addEventListener("input", update);
  update();
}

document.addEventListener("pointermove", (event) => {
  if (!painting) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".hex-note");
  const node = target ? nodesById.get(target.dataset.nodeId) : null;
  if (node) paintNode(node);
});

document.addEventListener("pointerup", () => {
  painting = null;
});
document.addEventListener("pointercancel", () => {
  painting = null;
});

playButton.addEventListener("click", () => (playing ? stop() : start()));
clearButton.addEventListener("click", () => {
  stop();
  selectedIds = [];
  renderSelection();
});
document.querySelectorAll("[data-motion]").forEach((button) => {
  button.addEventListener("click", () => chooseMotion(button.dataset.motion));
});
document.querySelectorAll("[data-tuning]").forEach((button) => {
  button.addEventListener("click", () => chooseTuning(button.dataset.tuning));
});

bindRange(tempoInput, document.querySelector("#tempo-output"), (value) => `${value} BPM`);
bindRange(gateInput, document.querySelector("#gate-output"), (value) => `${Math.round(value * 100)}%`);
bindRange(swingInput, document.querySelector("#swing-output"), (value) => `${Math.round(value * 100)}%`);
bindRange(octavesInput, document.querySelector("#octaves-output"), (value) => String(value), () => {
  if (playing) refreshSequence();
});
bindRange(
  resonanceInput,
  document.querySelector("#resonance-output"),
  (value) => `${Math.round(value * 100)}%`,
  (value) => {
    engine.body = 0.62 + value * 0.36;
    engine.setRoom(0.08 + value * 0.22);
  },
);

rateInput.addEventListener("change", () => {
  if (playing) nextNoteTime = Math.max(nextNoteTime, engine.context.currentTime + 0.025);
});

engine.addEventListener("statechange", ({ detail }) => {
  voiceCount.textContent = String(detail.voices).padStart(2, "0");
});

window.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;
  if (event.code !== "Space" || event.repeat || ["INPUT", "SELECT", "BUTTON"].includes(tag)) return;
  event.preventDefault();
  if (playing) stop();
  else start();
});
window.addEventListener("blur", () => {
  painting = null;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) stop();
});
window.addEventListener("beforeunload", stop);

makeGrid();
chooseMotion("orbit");
chooseTuning("equal");

window.HEXPIANO = {
  engine,
  get playing() {
    return playing;
  },
  get selection() {
    return selectionNodes().map((node) => node.midi);
  },
  start,
  stop,
  chooseMotion,
  chooseTuning,
};
