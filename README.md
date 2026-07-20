# HEXPIANO

HEXPIANO is a sound-first browser instrument: the Crystal Concert procedural piano played through interfaces that make harmony feel spatial, tactile, and strange.

The release-facing instrument is **Constellation**, a harmonic hex field and performance arpeggiator. The sound-development interface remains available at [`/lab/`](./lab/).

## Constellation

Notes are arranged by musical relationship rather than keyboard order:

- move horizontally through perfect fifths
- move diagonally through major thirds
- drag across stars to draw a harmony and establish its path
- tap any star to audition it through Crystal Concert

The opening constellation is playable immediately: press **Begin orbit** or hit `Space` while focus is outside a control.

### Motion modes

- **Orbit** follows the drawing in its original direction
- **Bounce** travels forward and returns through the interior
- **Spill** rises from the lowest selected pitch to the highest
- **Pendulum** alternates outer notes and folds toward the middle
- **Dust** creates a deterministic new scatter on every cycle

Tempo, note division, gate, swing, octave range, resonance, and temperament remain live while the instrument plays. Audio notes use a Web Audio lookahead scheduler so timing is anchored to the audio clock rather than browser animation frames.

## Crystal Concert

Crystal Concert is generated in real time with the native Web Audio API. It combines register-scaled unison strings, velocity-shaped hammer bands, duplex resonance, long bass decay, soundboard coupling, and a delayed filtered concert-hall bloom. No piano samples or external audio files are included.

The Piano Genome Lab also retains two comparison voices:

- **Ivory** — rounded body and a familiar reference balance
- **Wire** — a grander strike, stretched metallic harmonics, and long bloom

### Tunings

- 12-tone equal temperament
- Just intonation centered on C
- Pythagorean tuning centered on C

## Run locally

The app uses browser modules, so serve the directory rather than opening `index.html` directly:

```bash
npm run serve
```

Then open [http://localhost:4177](http://localhost:4177).

No dependency installation is required.

## Verify

```bash
npm run verify
```

This checks JavaScript syntax plus the deterministic motion, rhythm, concert-voicing, octave, and tuning contracts with Node's built-in test runner.

## Package a single-file edition

```bash
npm run package:otad
```

This writes `dist/hexpiano-otad.html`: a self-contained release page with the styles and JavaScript inlined, the external font import removed, and an embed-aware view that opens directly on the instrument inside an iframe. Pass an output path directly to `node scripts/package-otad.mjs` to place the artifact in another static-site project.

## Structure

```text
index.html                 Constellation release instrument
release.css                Constellation visual system
lab/index.html             Piano Genome Lab
styles.css                 Genome Lab presentation
src/constellation-app.js   Harmonic field, gestures, transport, audio scheduler
src/arp-patterns.js        Pure deterministic motion and rhythm logic
src/engine.js              Crystal Concert Web Audio voice and signal path
src/concert-voicing.js     Register, string, strike, and hammer behavior
src/tuning.js              Temperament math and pitch descriptions
src/app.js                 Genome Lab keyboard, MIDI, and controls
test/                      Motion, timing, voicing, octave, and tuning contracts
cloudstepper.html          Preserved original HEXPIANO interface
HEXPIANO.js                Preserved original HEXPIANO engine
```

## Legacy instrument

`cloudstepper.html` and `HEXPIANO.js` remain untouched as the original instrument. The repository tag `legacy-v0` points to the exact pre-lab state.
