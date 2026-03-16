import { describe, expect, it } from 'vitest';
import { buildTrainRepCurveSummary } from '../components/analysis/forceCurveViewModel.ts';
import { getTrainProtocolById } from '../components/train/trainLibrary.ts';
import { annotateTrainReps, buildTrainSetDetails } from '../components/train/trainResultAnalysis.ts';
import type { TrainRepResult } from '../components/train/types.ts';

function createRep(setNo: number, repNo: number, peakTotalKg: number): TrainRepResult {
  return {
    setNo,
    repNo,
    plannedHangSec: 10,
    actualHangS: 9.5,
    peakTotalKg,
    avgHoldKg: peakTotalKg - 2,
    impulseKgS: peakTotalKg * 10,
    adherencePct: 80 + repNo,
    samples: [
      {
        tMs: 0,
        totalKg: peakTotalKg - 3,
        fingerKg: [8, 9, 7, 6],
        fingerPct: [27, 30, 23, 20],
        targetKg: 50,
      },
      {
        tMs: 500,
        totalKg: peakTotalKg,
        fingerKg: [9, 10, 8, 7],
        fingerPct: [26, 31, 24, 19],
        targetKg: 50,
      },
    ],
  };
}

describe('train result analysis', () => {
  it('annotates reps with sequential set numbers across workout blocks', () => {
    const protocol = getTrainProtocolById('strength_10s');
    const reps = [
      createRep(1, 1, 50),
      createRep(1, 2, 51),
      createRep(1, 3, 52),
      createRep(1, 1, 56),
    ];

    const annotated = annotateTrainReps(protocol.blocks, reps);

    expect(annotated.map(rep => rep.sequenceSetNo)).toEqual([1, 1, 1, 2]);
    expect(annotated[0]?.blockLabel).toBe('Warm-up Primer');
    expect(annotated[3]?.blockLabel).toBe('Main Strength Block');
    expect(annotated[3]?.blockPhase).toBe('main');
  });

  it('builds set details with finger summaries and partial-set progress', () => {
    const protocol = getTrainProtocolById('strength_10s');
    const reps = [
      createRep(1, 1, 50),
      createRep(1, 2, 51),
      createRep(1, 3, 52),
      createRep(1, 1, 56),
    ];

    const setDetails = buildTrainSetDetails(protocol.blocks, reps);

    expect(setDetails).toHaveLength(2);
    expect(setDetails[0]?.sequenceSetNo).toBe(1);
    expect(setDetails[0]?.summary.completedReps).toBe(3);
    expect(setDetails[0]?.summary.plannedReps).toBe(3);
    expect(setDetails[1]?.sequenceSetNo).toBe(2);
    expect(setDetails[1]?.summary.completedReps).toBe(1);
    expect(setDetails[1]?.summary.plannedReps).toBe(3);
    expect(setDetails[1]?.fingerSummaries[1]?.peakKg).toBeCloseTo(10);
  });

  it('builds rep-level curve summaries from stored rep samples', () => {
    const rep = createRep(1, 1, 54);

    const summary = buildTrainRepCurveSummary(rep, 50, 1);

    expect(summary.repMetrics.peakTotalKg).toBe(54);
    expect(summary.repMetrics.targetKg).toBe(50);
    expect(summary.fingerMetrics.peakKg).toBeCloseTo(10);
    expect(summary.fingerMetrics.rfd100KgS).toBeGreaterThan(0);
  });
});
