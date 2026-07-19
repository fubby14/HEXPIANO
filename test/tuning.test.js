import assert from "node:assert/strict";
import test from "node:test";

import {
  TUNINGS,
  centsFromEqual,
  describePitch,
  equalFrequency,
  noteName,
  tuningFrequency,
} from "../src/tuning.js";

const near = (actual, expected, tolerance = 0.001) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
};

test("equal temperament keeps A4 at concert pitch", () => {
  near(equalFrequency(69), 440);
  near(tuningFrequency(69, "equal"), 440);
});

test("every tuning repeats cleanly at the octave", () => {
  Object.keys(TUNINGS).forEach((tuningId) => {
    near(tuningFrequency(72, tuningId) / tuningFrequency(60, tuningId), 2);
  });
});

test("just intonation exposes its characteristic pure major third", () => {
  near(tuningFrequency(64, "just") / tuningFrequency(60, "just"), 5 / 4);
  near(centsFromEqual(64, "just"), -13.686, 0.01);
});

test("Pythagorean tuning keeps a pure fifth and bright major third", () => {
  near(tuningFrequency(67, "pythagorean") / tuningFrequency(60, "pythagorean"), 3 / 2);
  near(centsFromEqual(64, "pythagorean"), 7.82, 0.01);
});

test("note labels and pitch descriptions remain human-readable", () => {
  assert.equal(noteName(60), "C4");
  assert.equal(noteName(61), "C♯4");
  assert.equal(noteName(72), "C5");
  assert.deepEqual(Object.keys(describePitch(60, "equal")), ["midi", "name", "frequency", "cents"]);
});
