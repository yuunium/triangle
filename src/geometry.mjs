export const SCORING_VERSION = "regular-polygon-q-v1";
export const POLYGON_NAMES = {
  3: "正三角形",
  4: "正方形",
  5: "正五角形",
  6: "正六角形",
  7: "正七角形",
  8: "正八角形",
};
export const SIDE_COUNTS = [3, 4, 5, 6, 7, 8];
export const MAIN_SIDES = 7;
export const PRACTICE_SIDE_COUNTS = [3, 4, 5, 6];

function validatePoints(points) {
  if (
    !Array.isArray(points) ||
    !SIDE_COUNTS.includes(points.length) ||
    points.some((p) => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new TypeError("3–8 finite points are required.");
}

function intersects(a, b, c, d) {
  const cross = (p, q, r) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const epsilon = 1e-12;
  const sign = (x) => (Math.abs(x) <= epsilon ? 0 : Math.sign(x));
  const on = (p, q, r) =>
    r.x >= Math.min(p.x, q.x) - epsilon &&
    r.x <= Math.max(p.x, q.x) + epsilon &&
    r.y >= Math.min(p.y, q.y) - epsilon &&
    r.y <= Math.max(p.y, q.y) + epsilon;
  const abC = sign(cross(a, b, c)),
    abD = sign(cross(a, b, d)),
    cdA = sign(cross(c, d, a)),
    cdB = sign(cross(c, d, b));
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return (
    (!abC && on(a, b, c)) ||
    (!abD && on(a, b, d)) ||
    (!cdA && on(c, d, a)) ||
    (!cdB && on(c, d, b))
  );
}

export function evaluatePolygon(points) {
  validatePoints(points);
  const n = points.length;
  // Translate and normalize before computing area; retain accuracy for tiny shapes.
  const translated = points.map((p) => ({
    x: p.x - points[0].x,
    y: p.y - points[0].y,
  }));
  const extent = Math.max(
    ...translated.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]),
  );
  if (!Number.isFinite(extent))
    throw new TypeError("Coordinates exceed the supported range.");
  const normalized = translated.map((p) => ({
    x: extent ? p.x / extent : 0,
    y: extent ? p.y / extent : 0,
  }));
  let squaredEdges = 0,
    signedTwiceArea = 0,
    selfIntersecting = false;
  for (let i = 0; i < n; i++) {
    const a = normalized[i],
      b = normalized[(i + 1) % n];
    squaredEdges += (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    signedTwiceArea += a.x * b.y - a.y * b.x;
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (intersects(a, b, normalized[j], normalized[(j + 1) % n]))
        selfIntersecting = true;
    }
  }
  const reference = normalized.find((p) => Math.hypot(p.x, p.y) > 1e-12) || {
    x: 0,
    y: 0,
  };
  const degenerate =
    squaredEdges === 0 ||
    normalized.every(
      (p) => Math.abs(reference.x * p.y - reference.y * p.x) < 1e-12,
    );
  const score =
    degenerate || selfIntersecting
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            (200 * Math.tan(Math.PI / n) * Math.abs(signedTwiceArea)) /
              squaredEdges,
          ),
        );
  return {
    score,
    sides: n,
    scoringVersion: SCORING_VERSION,
    degenerate,
    selfIntersecting,
  };
}

// Preserve the original public triangle helper and its scoring version.
export function evaluateTriangle(points) {
  if (!Array.isArray(points) || points.length !== 3)
    throw new TypeError("Three finite points are required.");
  return { ...evaluatePolygon(points), scoringVersion: "equilateral-q-v1" };
}
// A merely close triangle must not round up to a perfect score.
export function formatScore(score) {
  return (score >= 100 - 1e-10 ? 100 : Math.min(99.99, score)).toFixed(2);
}
// Least-squares equilateral fit, preserving centroid and vertex order.
export function fitRegularPolygon(points) {
  validatePoints(points);
  const n = points.length;
  const center = points.reduce(
    (s, p) => ({ x: s.x + p.x / n, y: s.y + p.y / n }),
    { x: 0, y: 0 },
  );
  const candidates = [-1, 1].map((direction) => {
    const basis = points.map((_, i) => ({
      x: Math.cos((i * 2 * Math.PI) / n),
      y: direction * Math.sin((i * 2 * Math.PI) / n),
    }));
    let real = 0,
      imaginary = 0;
    points.forEach((p, i) => {
      const x = p.x - center.x,
        y = p.y - center.y;
      real += (x * basis[i].x + y * basis[i].y) / n;
      imaginary += (y * basis[i].x - x * basis[i].y) / n;
    });
    const vertices = basis.map((p) => ({
      x: center.x + real * p.x - imaginary * p.y,
      y: center.y + imaginary * p.x + real * p.y,
    }));
    const loss = vertices.reduce(
      (sum, p, i) => sum + (p.x - points[i].x) ** 2 + (p.y - points[i].y) ** 2,
      0,
    );
    return { vertices, loss };
  });
  return candidates[0].loss <= candidates[1].loss
    ? candidates[0].vertices
    : candidates[1].vertices;
}
export function fitEquilateral(points) {
  return points.length === 3 ? fitRegularPolygon(points) : [];
}
export function scoreMessage(score, sides = 3) {
  const name = POLYGON_NAMES[sides];
  if (score >= 100 - 1e-10)
    return [`完璧な${name}。`, `${sides}つの辺と角が、ぴったり揃いました。`];
  if (score >= 99.5)
    return [
      sides === 3 ? "見事な、さんかく。" : "見事な、かたち。",
      "あと少しのずれまで、見抜けますか？",
    ];
  if (score >= 95) return ["いい勘、してます。", `${name}は、すぐそこです。`];
  if (score >= 80)
    return [
      sides === 3 ? "なかなかの、さんかく。" : "なかなかの、かたち。",
      "もうひと調整で、もっと近づけそう。",
    ];
  if (score >= 50)
    return ["まだ、伸びしろあり。", "辺と角のバランスを、もう少し。"];
  return [
    "ここからが、腕の見せどころ。",
    "点を広げて、バランスを探ってみよう。",
  ];
}
