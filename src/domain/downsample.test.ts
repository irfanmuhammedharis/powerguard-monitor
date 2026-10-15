import { downsampleLTTB, type ChartPoint } from './downsample';

const series = (n: number, f: (i: number) => number = i => Math.sin(i / 7) * 10): ChartPoint[] =>
  Array.from({ length: n }, (_, i) => ({ t: i * 10, v: f(i) }));

describe('downsampleLTTB', () => {
  it('returns the input unchanged when it already fits', () => {
    const s = series(20);
    expect(downsampleLTTB(s, 20)).toBe(s);
    expect(downsampleLTTB(s, 100)).toBe(s);
    expect(downsampleLTTB([], 10)).toEqual([]);
  });

  it('reduces to exactly the cap, keeps first and last, preserves order', () => {
    const s = series(8640);
    const out = downsampleLTTB(s, 150);
    expect(out).toHaveLength(150);
    expect(out[0]).toBe(s[0]);
    expect(out[out.length - 1]).toBe(s[s.length - 1]);
    for (let i = 1; i < out.length; i += 1) expect(out[i].t).toBeGreaterThan(out[i - 1].t);
  });

  it('keeps a lone spike that averaging would hide', () => {
    const s = series(1000, i => (i === 500 ? 500 : 0));
    const out = downsampleLTTB(s, 50);
    expect(Math.max(...out.map(p => p.v))).toBe(500);
  });

  it('returns only endpoints for a cap below 3', () => {
    const s = series(100);
    expect(downsampleLTTB(s, 2)).toEqual([s[0], s[99]]);
  });
});
