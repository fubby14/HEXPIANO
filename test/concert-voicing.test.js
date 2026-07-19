import assert from "node:assert/strict";
import test from "node:test";

import {
  concertStringDetunes,
  hammerBands,
  registerDecayScale,
  strikeWeight,
} from "../src/concert-voicing.js";

test("Crystal grows from one to three strings across the keyboard", () => {
  assert.equal(concertStringDetunes(24, "crystal").length, 1);
  assert.equal(concertStringDetunes(42, "crystal").length, 2);
  assert.equal(concertStringDetunes(60, "crystal").length, 3);
  assert.deepEqual(concertStringDetunes(60, "wire"), [0]);
});

test("lower registers are allowed to bloom longer", () => {
  assert.ok(registerDecayScale(24) > registerDecayScale(60));
  assert.ok(registerDecayScale(60) > registerDecayScale(96));
  assert.equal(registerDecayScale(-20), registerDecayScale(24));
  assert.equal(registerDecayScale(140), registerDecayScale(96));
});

test("hammer attack brightens and strengthens with touch", () => {
  const soft = hammerBands(440, 0.2, 0.7);
  const hard = hammerBands(440, 0.95, 0.7);
  assert.ok(hard.attackGain > soft.attackGain);
  assert.ok(hard.bodyGain > soft.bodyGain);
  assert.ok(hard.attackFrequency >= 2400 && hard.attackFrequency <= 9200);
});

test("strike-position shaping stays musical rather than nulling partials", () => {
  for (let harmonic = 1; harmonic <= 16; harmonic += 1) {
    assert.ok(strikeWeight(harmonic) >= 0.66);
    assert.ok(strikeWeight(harmonic) <= 1);
  }
});
