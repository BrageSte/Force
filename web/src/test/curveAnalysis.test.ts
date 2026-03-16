import { describe, expect, it } from 'vitest';
import { analyzeForceCurve, type CurveSeries4 } from '@krimblokk/core';

function fingerSeries(rows: number[][]): CurveSeries4 {
  return [
    rows.map(row => row[0] ?? 0),
    rows.map(row => row[1] ?? 0),
    rows.map(row => row[2] ?? 0),
    rows.map(row => row[3] ?? 0),
  ];
}

describe('force curve analysis', () => {
  it('handles irregular timestamps and interpolated RFD windows', () => {
    const analysis = analyzeForceCurve({
      timesMs: [0, 70, 160, 260],
      totalKg: [0, 4, 10, 10],
      fingerKg: fingerSeries([
        [0, 0, 0, 0],
        [1.5, 1.2, 0.8, 0.5],
        [3.5, 2.8, 2, 1.7],
        [3.5, 2.8, 2, 1.7],
      ]),
    });

    expect(analysis.totalMetrics.rfd100KgS).toBeCloseTo(60, 0);
    expect(analysis.totalMetrics.rfd200KgS).toBeCloseTo(50, 0);
    expect(analysis.totalMetrics.timeToPeakMs).toBe(160);
    expect(analysis.totalRateKgS).toHaveLength(4);
  });

  it('returns stable defaults for single-point traces', () => {
    const analysis = analyzeForceCurve({
      timesMs: [0],
      totalKg: [3],
      fingerKg: fingerSeries([[1, 1, 0.5, 0.5]]),
    });

    expect(analysis.totalRateKgS).toEqual([0]);
    expect(analysis.totalMetrics.peakKg).toBe(3);
    expect(analysis.totalMetrics.timeToPeakMs).toBe(0);
    expect(analysis.fingerMetrics[0].peakKg).toBe(1);
  });

  it('keeps flat traces at zero rate of force', () => {
    const analysis = analyzeForceCurve({
      timesMs: [0, 100, 200, 300],
      totalKg: [5, 5, 5, 5],
      fingerKg: fingerSeries([
        [2, 1.5, 1, 0.5],
        [2, 1.5, 1, 0.5],
        [2, 1.5, 1, 0.5],
        [2, 1.5, 1, 0.5],
      ]),
    });

    expect(analysis.totalMetrics.rfd100KgS).toBeCloseTo(0);
    expect(analysis.totalMetrics.maxRiseRateKgS).toBeCloseTo(0);
    expect(analysis.totalRateKgS.every(value => Math.abs(value) < 1e-9)).toBe(true);
  });

  it('smooths noisy rising traces into readable rate curves', () => {
    const analysis = analyzeForceCurve({
      timesMs: [0, 50, 100, 150, 200, 250, 300, 350, 400, 450],
      totalKg: [0, 1, 0.9, 1.8, 1.7, 2.7, 2.5, 3.6, 3.3, 4.2],
      fingerKg: fingerSeries([
        [0, 0, 0, 0],
        [0.4, 0.3, 0.2, 0.1],
        [0.35, 0.3, 0.15, 0.1],
        [0.7, 0.5, 0.35, 0.25],
        [0.65, 0.5, 0.3, 0.25],
        [1, 0.8, 0.5, 0.4],
        [0.95, 0.75, 0.45, 0.35],
        [1.35, 1.05, 0.7, 0.5],
        [1.2, 1.0, 0.65, 0.45],
        [1.5, 1.2, 0.85, 0.65],
      ]),
    });

    expect(analysis.totalRateKgS.every(value => Number.isFinite(value))).toBe(true);
    expect(analysis.totalMetrics.maxRiseRateKgS).toBeGreaterThan(0);
    expect(analysis.totalMetrics.maxRiseRateKgS).toBeLessThan(20);
  });

  it('computes per-finger timing and RFD metrics independently', () => {
    const analysis = analyzeForceCurve({
      timesMs: [0, 100, 200, 300],
      totalKg: [0, 6, 9, 10],
      fingerKg: fingerSeries([
        [0, 0, 0, 0],
        [3, 1.5, 1, 0.5],
        [4, 2.5, 1.5, 1],
        [4.5, 3, 1.7, 1.2],
      ]),
    });

    expect(analysis.fingerMetrics[0].rfd100KgS).toBeGreaterThan(analysis.fingerMetrics[1].rfd100KgS);
    expect(analysis.fingerMetrics[0].timeToPeakMs).toBe(300);
    expect(analysis.fingerMetrics[3].peakKg).toBeCloseTo(1.2);
  });
});
