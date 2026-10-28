export const SCORING_VERSION = "equilateral-q-v1";
export function evaluateTriangle(points) {
  if (
    points.length !== 3 ||
    points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    throw new TypeError("Three finite points are required.");
  const [a, b, c] = points;
  const sum =
    (b.x - a.x) ** 2 +
    (b.y - a.y) ** 2 +
    (c.x - b.x) ** 2 +
    (c.y - b.y) ** 2 +
    (a.x - c.x) ** 2 +
    (a.y - c.y) ** 2;
  const twiceArea = Math.abs(
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
  );
  const score =
    sum === 0
      ? 0
      : Math.min(100, Math.max(0, (200 * Math.sqrt(3) * twiceArea) / sum));
  return {
    score,
    scoringVersion: SCORING_VERSION,
    degenerate: sum === 0 || twiceArea / sum < 1e-12,
  };
}
// A merely close triangle must not round up to a perfect score.
export function formatScore(score) {
  return (score >= 100 - 1e-10 ? 100 : Math.min(99.99, score)).toFixed(2);
}
// Least-squares equilateral fit, preserving centroid and vertex order.
export function fitEquilateral(points) {
  if (points.length !== 3) return [];
  const center = points.reduce(
    (s, p) => ({ x: s.x + p.x / 3, y: s.y + p.y / 3 }),
    { x: 0, y: 0 },
  );
  const cross =
    (points[1].x - points[0].x) * (points[2].y - points[0].y) -
    (points[1].y - points[0].y) * (points[2].x - points[0].x);
  const direction = cross < 0 ? -1 : 1;
  const basis = points.map((_, i) => ({
    x: Math.cos((i * 2 * Math.PI) / 3),
    y: direction * Math.sin((i * 2 * Math.PI) / 3),
  }));
  let real = 0,
    imaginary = 0;
  points.forEach((p, i) => {
    const x = p.x - center.x,
      y = p.y - center.y;
    real += (x * basis[i].x + y * basis[i].y) / 3;
    imaginary += (y * basis[i].x - x * basis[i].y) / 3;
  });
  return basis.map((p) => ({
    x: center.x + real * p.x - imaginary * p.y,
    y: center.y + imaginary * p.x + real * p.y,
  }));
}
export function scoreMessage(score) {
  if (score >= 100 - 1e-10)
    return ["完璧な正三角形。", "3つの辺が、ぴったり揃いました。"];
  if (score >= 99.5)
    return ["見事な、さんかく。", "あと少しのずれまで、見抜けますか？"];
  if (score >= 95) return ["いい勘、してます。", "正三角形は、すぐそこです。"];
  if (score >= 80)
    return ["なかなかの、さんかく。", "もうひと調整で、もっと近づけそう。"];
  if (score >= 50)
    return ["まだ、伸びしろあり。", "3つの辺が同じ長さになるように。"];
  return [
    "ここからが、腕の見せどころ。",
    "点を広げて、バランスを探ってみよう。",
  ];
}
