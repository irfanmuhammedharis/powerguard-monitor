export interface ChartPoint {
  t: number; // unix seconds
  v: number;
}

/**
 * Largest-Triangle-Three-Buckets. Returns the input unchanged when it already fits;
 * otherwise exactly `maxPoints` points, always keeping the first and last, in order.
 */
export function downsampleLTTB(
  points: ChartPoint[],
  maxPoints: number,
): ChartPoint[] {
  const n = points.length;
  if (maxPoints >= n || maxPoints < 3) {
    return maxPoints >= n ? points : [points[0], points[n - 1]].slice(0, n);
  }
  const out: ChartPoint[] = [points[0]];
  const bucket = (n - 2) / (maxPoints - 2);
  let a = 0;
  for (let i = 0; i < maxPoints - 2; i += 1) {
    const rangeStart = Math.floor((i + 1) * bucket) + 1;
    const rangeEnd = Math.min(Math.floor((i + 2) * bucket) + 1, n);
    let avgX = 0;
    let avgY = 0;
    const avgLen = Math.max(1, rangeEnd - rangeStart);
    for (let j = rangeStart; j < rangeStart + avgLen && j < n; j += 1) {
      avgX += points[j].t;
      avgY += points[j].v;
    }
    avgX /= avgLen;
    avgY /= avgLen;

    const from = Math.floor(i * bucket) + 1;
    const to = Math.floor((i + 1) * bucket) + 1;
    let best = from;
    let bestArea = -1;
    for (let j = from; j < to; j += 1) {
      const area = Math.abs(
        (points[a].t - avgX) * (points[j].v - points[a].v) -
          (points[a].t - points[j].t) * (avgY - points[a].v),
      );
      if (area > bestArea) {
        bestArea = area;
        best = j;
      }
    }
    out.push(points[best]);
    a = best;
  }
  out.push(points[n - 1]);
  return out;
}
