import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMotionSequence,
  expandAcrossOctaves,
  stepDurationSeconds,
} from "../src/arp-patterns.js";

test("orbit keeps the drawn order and removes duplicate notes", () => {
  assert.deepEqual(buildMotionSequence([60, 67, 64, 67], "orbit"), [60, 67, 64]);
});

test("bounce returns through the interior without repeating endpoints", () => {
  assert.deepEqual(buildMotionSequence([60, 64, 67, 74], "bounce"), [60, 64, 67, 74, 67, 64]);
});

test("spill rises by pitch while pendulum folds from the outside", () => {
  const notes = [67, 60, 74, 64, 71];
  assert.deepEqual(buildMotionSequence(notes, "spill"), [60, 64, 67, 71, 74]);
  assert.deepEqual(buildMotionSequence(notes, "pendulum"), [60, 74, 64, 71, 67]);
});

test("dust is repeatable within a cycle and evolves between cycles", () => {
  const notes = [60, 64, 67, 71, 74, 79];
  const first = buildMotionSequence(notes, "dust", 2);
  assert.deepEqual(first, buildMotionSequence(notes, "dust", 2));
  assert.notDeepEqual(first, buildMotionSequence(notes, "dust", 3));
  assert.deepEqual([...first].sort((a, b) => a - b), notes);
});

test("octave expansion preserves each pass before rising", () => {
  assert.deepEqual(expandAcrossOctaves([60, 64, 67], 3), [60, 64, 67, 72, 76, 79, 84, 88, 91]);
  assert.deepEqual(expandAcrossOctaves([60], 99), [60, 72, 84, 96]);
});

test("swing lengthens then shortens a pair without changing its total", () => {
  const straight = stepDurationSeconds(120, 0.5, 0, 0);
  const long = stepDurationSeconds(120, 0.5, 0.4, 0);
  const short = stepDurationSeconds(120, 0.5, 0.4, 1);
  assert.equal(straight, 0.25);
  assert.ok(long > straight);
  assert.ok(short < straight);
  assert.equal(Number((long + short).toFixed(8)), Number((straight * 2).toFixed(8)));
});
