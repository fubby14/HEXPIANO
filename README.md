# HEXPIANO

HEXPIANO is a sound-first browser instrument: one piano identity that can be played through different interfaces and tuned through different temperaments.

The current front door is the **Piano Genome Lab**, a deliberately narrow listening prototype. It presents one octave, three procedural piano engines, and three tuning systems behind identical controls so the core sound can be chosen before the larger instrument is designed.

## Piano Genome Lab

### Voices

- **Crystal Concert** — the default candidate, with register-scaled unison strings, velocity-shaped hammer bands, duplex resonance, long bass decay, and a delayed concert-hall bloom
- **Ivory** — rounded body, defined hammer, and the most familiar piano balance
- **Wire** — the stronger alternate, with a grand strike, stretched metallic harmonics, and long soundboard bloom

All three voices are generated in real time with the native Web Audio API. Crystal Concert remains fully procedural: no piano samples are included yet.

### Tunings

- 12-tone equal temperament
- Just intonation centered on C
- Pythagorean tuning centered on C

### Playing

- Click or touch the displayed one-octave keyboard
- Use computer keys `A W S E D F T G Y H U J K`
- Slide the octave rail from C1–C2 through C6–C7
- Hold `Space` for sustain
- Use `1`, `2`, and `3` to switch sound engines
- Connect a Web MIDI keyboard for note velocity and sustain pedal input

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

This checks the JavaScript syntax and the frequency/tuning contracts with Node's built-in test runner.

## Structure

```text
index.html          Piano Genome Lab interface
styles.css          Instrument-panel presentation
src/engine.js       Web Audio voice generation and master signal path
src/concert-voicing.js  Register, string, strike, and hammer behavior
src/tuning.js       Temperament math and pitch descriptions
src/app.js          Keyboard, MIDI, controls, and visual feedback
test/               Tuning contract tests
cloudstepper.html   Preserved original HEXPIANO interface
HEXPIANO.js         Preserved original HEXPIANO engine
```

## Legacy instrument

`cloudstepper.html` and `HEXPIANO.js` remain untouched as the original instrument. The repository tag `legacy-v0` points to the exact pre-lab state.

## Next sound milestone

Crystal is the current lead after the first low-to-high listening pass. The concert pass adds multi-string scaling, register-dependent decay, duplex bloom, dual-band hammer attack, damper noise, soundboard coupling, and a pre-delayed hall. The next decision should come from listening before adding half-pedaling, a full keyboard, or optional sampled hammer transients.
