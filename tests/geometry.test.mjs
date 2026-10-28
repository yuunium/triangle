import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTriangle,
  fitEquilateral,
  formatScore,
} from "../src/geometry.mjs";
const equilateral = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 1, y: Math.sqrt(3) },
];
test("equilateral score is invariant under translation, rotation, scale and reflection", () => {
  for (const mirror of [-1, 1]) {
    const theta = 1.234;
    const points = equilateral.map(({ x, y }) => ({
      x: 70 + mirror * 93 * (x * Math.cos(theta) - y * Math.sin(theta)),
      y: -190 + 93 * (x * Math.sin(theta) + y * Math.cos(theta)),
    }));
    assert.ok(Math.abs(evaluateTriangle(points).score - 100) < 1e-10);
    assert.equal(formatScore(evaluateTriangle(points).score), "100.00");
  }
});
test("right isosceles scores sqrt(3)/2; collinear or coincident points score zero", () => {
  assert.ok(
    Math.abs(
      evaluateTriangle([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ]).score -
        50 * Math.sqrt(3),
    ) < 1e-10,
  );
  for (const points of [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    Array(3).fill({ x: 2, y: 5 }),
  ]) {
    assert.equal(evaluateTriangle(points).score, 0);
    assert.equal(evaluateTriangle(points).degenerate, true);
  }
});
test("near-perfect is not falsely displayed as perfect", () => {
  assert.equal(formatScore(99.99998), "99.99");
});
test("overlay is equilateral and preserves centroid in either winding", () => {
  const points = [
    { x: 200, y: 130 },
    { x: 660, y: 225 },
    { x: 510, y: 430 },
  ];
  for (const input of [points, points.toReversed()]) {
    const fit = fitEquilateral(input);
    assert.ok(evaluateTriangle(fit).score > 100 - 1e-10);
    for (const axis of ["x", "y"])
      assert.ok(
        Math.abs(
          input.reduce((s, p) => s + p[axis], 0) -
            fit.reduce((s, p) => s + p[axis], 0),
        ) < 1e-9,
      );
  }
});
test("invalid external coordinates rejected", () => {
  assert.throws(() => evaluateTriangle([]), TypeError);
  assert.throws(
    () => evaluateTriangle([{ x: NaN, y: 0 }, ...equilateral.slice(1)]),
    TypeError,
  );
});
