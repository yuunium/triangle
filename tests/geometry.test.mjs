import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTriangle,
  fitEquilateral,
  formatScore,
  evaluatePolygon,
  fitRegularPolygon,
  SIDE_COUNTS,
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

const regular = (n) =>
  Array.from({ length: n }, (_, i) => ({
    x: Math.cos((i * 2 * Math.PI) / n),
    y: Math.sin((i * 2 * Math.PI) / n),
  }));
test("every regular polygon from triangle through heptagon scores 100 in either winding", () => {
  for (const n of SIDE_COUNTS) {
    const shape = regular(n);
    for (const input of [
      shape,
      shape.toReversed(),
      [...shape.slice(2), ...shape.slice(0, 2)],
    ]) {
      const transformed = input.map((p) => ({
        x: 93 + 15 * (p.x * Math.cos(0.8) - p.y * Math.sin(0.8)),
        y: 72 + 15 * (p.y * Math.cos(0.8) + p.x * Math.sin(0.8)),
      }));
      const result = evaluatePolygon(transformed);
      assert.equal(formatScore(result.score), "100.00");
      assert.equal(result.selfIntersecting, false);
      assert.equal(result.sides, n);
    }
  }
});
test("rectangle is not a square; a bow tie or star cannot receive a regular polygon score", () => {
  assert.ok(
    Math.abs(
      evaluatePolygon([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 0, y: 1 },
      ]).score - 80,
    ) < 1e-10,
  );
  const bow = evaluatePolygon([
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
  ]);
  assert.equal(bow.score, 0);
  assert.equal(bow.selfIntersecting, true);
  const pentagon = regular(5),
    star = [0, 2, 4, 1, 3].map((i) => pentagon[i]);
  assert.equal(evaluatePolygon(star).score, 0);
  assert.equal(evaluatePolygon(star).selfIntersecting, true);
});
test("regular fits preserve centroid and are regular for all supported shapes", () => {
  for (const n of SIDE_COUNTS)
    for (const winding of [1, -1]) {
      const input = regular(n).map((p, i) => ({
        x: p.x * 30 + 100 + (i === 0 ? 2 : 0),
        y: p.y * 40 * winding + 60,
      }));
      const fit = fitRegularPolygon(input);
      assert.ok(evaluatePolygon(fit).score > 100 - 1e-10);
      for (const axis of ["x", "y"])
        assert.ok(
          Math.abs(
            input.reduce((s, p) => s + p[axis], 0) -
              fit.reduce((s, p) => s + p[axis], 0),
          ) < 1e-9,
        );
    }
});
test("tiny polygons remain scale invariant and unsupported counts are rejected", () => {
  for (const n of SIDE_COUNTS)
    assert.equal(
      formatScore(
        evaluatePolygon(
          regular(n).map((p) => ({ x: p.x * 1e-9, y: p.y * 1e-9 })),
        ).score,
      ),
      "100.00",
    );
  assert.throws(() => evaluatePolygon(regular(8)), TypeError);
  assert.throws(() => fitRegularPolygon(regular(8)), TypeError);
  assert.throws(() => evaluatePolygon(regular(9)), TypeError);
});
