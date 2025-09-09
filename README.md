# HEXPIANO.js - Function Interface Documentation

**HEXPIANO.js** https://arweave.net/ykZCJW3NS06m7aw1HGfylsg-pICz6X95H4Fw8KaZ7e8 is the core JavaScript audio engine that powers the HEXPIANO step sequencer. This documentation provides a complete reference for all function interfaces, input/output specifications, and parameter mappings used in the audio synthesis system.

The engine implements real-time audio synthesis using Web Audio API, featuring polyphonic voice management, glitch effects processing, MIDI integration, and note conversion utilities. All functions are designed with clear input/output contracts to enable easy integration and extension.

This reference is intended for developers who want to understand the audio engine architecture, modify existing functionality, or integrate HEXPIANO components into other projects.

## Core Audio Functions

### `createVoice(midi, velocity, when)`
**Inputs:**
- `midi` (number): MIDI note number (0-127)
- `velocity` (number): Note velocity (0-1)
- `when` (number): Audio time to start note

**Returns:** Object containing audio nodes for the voice
```javascript
{
  osc: OscillatorNode,
  gain: GainNode,
  panner: StereoPannerNode,
  startTime: number
}
```

### `enforceVoiceLimit()`
**Inputs:** None
**Returns:** void
**Side Effects:** Removes finished voices from active voices array

### `dispose()`
**Inputs:** None
**Returns:** void
**Side Effects:** Disconnects all audio nodes and cleans up resources

## Glitch Effects Functions

### `createCrusher(bits, downsample)`
**Inputs:**
- `bits` (number): Bit depth (1-16)
- `downsample` (number): Downsample factor (1-16)

**Returns:** ScriptProcessorNode configured for bitcrushing

### `updateCrusher()`
**Inputs:** None (reads from DOM controls)
**Returns:** void
**Side Effects:** Replaces current bitcrusher with new parameters

## Note Conversion Functions

### `noteNameToMidi(note)`
**Inputs:**
- `note` (string): Note name (e.g., "C4", "D#4", "F#5")

**Returns:** number - MIDI note number (0-127)
**Throws:** Error for invalid note format

**Examples:**
```javascript
noteNameToMidi("C4") // returns 60
noteNameToMidi("D#4") // returns 63
noteNameToMidi("F#5") // returns 78
```

### `computeRowMidis()`
**Inputs:** None (uses global `rowMidis` array)
**Returns:** void
**Side Effects:** Updates `rowMidis` array with current octave

## Parameter Update Functions

### Audio Parameter Setters
All take DOM element values and update corresponding audio node parameters:

- `attackCtl` → `attack` (0-0.06 seconds)
- `decayCtl` → `decay` (0.05-1.2 seconds)  
- `sustainCtl` → `sustain` (0-1)
- `releaseCtl` → `release` (0.03-2.5 seconds)
- `toneCtl` → `toneFilter.frequency` (1200-14000 Hz)
- `presenceCtl` → `presenceFilter.gain` (-6 to +12 dB)
- `detuneCtl` → `detuneOsc.frequency` (0-25 Hz)
- `hardCtl` → `hardness` (0-1)
- `keynoiseCtl` → `keynoise` (0-1)
- `reverbCtl` → `reverbGain.gain` (0-1)

### Glitch Parameter Setters
- `glitchMixCtl` → `glitchMix.gain` (0-1)
- `ringRateCtl` → `ringLFO.frequency` (0.5-200 Hz)
- `ringDepthCtl` → `ringDepth.gain` (0-1)
- `crushBitsCtl` → bitcrusher bit depth (4-16)
- `downsampleCtl` → bitcrusher downsample (1-16)
- `jitterCtl` → jitter amount (0-50 ms)
- `stutterProbCtl` → stutter probability (0-0.8)
- `stutterRepeatsCtl` → stutter repetitions (1-4)
- `dropProbCtl` → note drop probability (0-0.6)

## MIDI Functions

### MIDI Event Handlers
**Inputs:** MIDI event objects from `navigator.requestMIDIAccess()`
**Returns:** void
**Side Effects:** Triggers `createVoice()` calls and parameter updates

### MIDI Connection
- `navigator.requestMIDIAccess()` → Promise resolving to MIDIAccess object
- Returns connection status and available MIDI devices

## Global State Variables

### Audio Context
- `context`: AudioContext instance
- `masterGain`: Main output gain node
- `compressor`: Dynamics compressor
- `toneFilter`: Low-pass filter for brightness
- `presenceFilter`: High-shelf filter
- `reverbConvolver`: Reverb effect
- `detuneOsc`: Chorus oscillator

### Glitch Chain
- `ringModGain`: Ring modulation input
- `ringModOsc`: Ring modulation oscillator
- `ringDepth`: Ring modulation depth
- `bitCrusher`: Current bitcrusher processor
- `glitchMixGain`: Glitch effects mix

### Voice Management
- `voices`: Array of active voice objects
- `maxVoices`: Maximum polyphony (8)

## Error Handling

### Audio Context Errors
- Catches `AudioContext` creation failures
- Handles browser audio policy restrictions

### MIDI Errors
- Catches MIDI access permission denials
- Handles device connection failures

### Parameter Validation
- Validates MIDI note ranges (0-127)
- Clamps parameter values to valid ranges
- Handles invalid note name formats

## Browser Compatibility

### Required Web Audio API Features
- `AudioContext` or `webkitAudioContext`
- `GainNode`, `OscillatorNode`, `BiquadFilterNode`
- `ConvolverNode`, `StereoPannerNode`
- `ScriptProcessorNode` (legacy)
- `DynamicsCompressorNode`

### Optional Features
- MIDI API (`navigator.requestMIDIAccess`)
- AudioWorklet (for future bitcrusher replacement)

## Function Call Examples

```javascript
// Create a voice
const voice = createVoice(60, 0.8, context.currentTime);

// Convert note to MIDI
const midiNote = noteNameToMidi("C#4"); // returns 61

// Update audio parameter
toneFilter.frequency.setValueAtTime(8000, context.currentTime);

// Create bitcrusher
const crusher = createCrusher(8, 4);

// Cleanup
dispose();
```

This interface provides complete control over the audio synthesis engine with clear input/output contracts for all functions.
