import type { TrainBlock, TrainRepResult } from './types.ts';

interface ExpectedRepSlot {
  sequenceSetNo: number;
  blockId: string;
  blockLabel: string;
  blockPhase: TrainBlock['phase'];
  setNo: number;
  repNo: number;
  plannedRepsInSet: number;
}

export interface AnnotatedTrainRep extends TrainRepResult {
  sequenceSetNo: number;
  blockId?: string;
  blockLabel: string;
  blockPhase: TrainBlock['phase'];
  localSetNo: number;
  plannedRepsInSet: number;
}

export interface TrainFingerSummary {
  fingerIndex: number;
  peakKg: number;
  avgKg: number;
  avgPct: number;
  maxPct: number;
}

export interface TrainSetDetail {
  key: string;
  sequenceSetNo: number;
  blockId?: string;
  blockLabel: string;
  blockPhase: TrainBlock['phase'];
  localSetNo: number;
  plannedRepsInSet: number;
  reps: AnnotatedTrainRep[];
  summary: {
    plannedReps: number;
    completedReps: number;
    peakTotalKg: number;
    avgHoldKg: number;
    avgAdherencePct: number;
    totalTutS: number;
    avgImpulseKgS: number;
  };
  fingerSummaries: TrainFingerSummary[];
  chart: {
    totalKg: number[];
    fingerKg: number[][];
    repBreakpoints: number[];
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildExpectedRepSlots(blocks: TrainBlock[]): ExpectedRepSlot[] {
  const slots: ExpectedRepSlot[] = [];
  let sequenceSetNo = 0;

  for (const block of blocks) {
    for (let setNo = 1; setNo <= block.setCount; setNo += 1) {
      sequenceSetNo += 1;
      for (let repNo = 1; repNo <= block.repsPerSet; repNo += 1) {
        slots.push({
          sequenceSetNo,
          blockId: block.id,
          blockLabel: block.label,
          blockPhase: block.phase,
          setNo,
          repNo,
          plannedRepsInSet: block.repsPerSet,
        });
      }
    }
  }

  return slots;
}

export function annotateTrainReps(blocks: TrainBlock[], reps: TrainRepResult[]): AnnotatedTrainRep[] {
  const slots = buildExpectedRepSlots(blocks);

  return reps.map((rep, index) => {
    const slot = slots[index];
    const blockPhase = rep.blockPhase ?? slot?.blockPhase ?? 'main';
    const localSetNo = slot?.setNo ?? rep.setNo;

    return {
      ...rep,
      sequenceSetNo: rep.sequenceSetNo ?? slot?.sequenceSetNo ?? rep.setNo,
      blockId: rep.blockId ?? slot?.blockId,
      blockLabel: rep.blockLabel ?? slot?.blockLabel ?? 'Workout Block',
      blockPhase,
      localSetNo,
      plannedRepsInSet: slot?.plannedRepsInSet ?? 1,
    };
  });
}

export function buildTrainSetDetails(blocks: TrainBlock[], reps: TrainRepResult[]): TrainSetDetail[] {
  const annotatedReps = annotateTrainReps(blocks, reps);
  const setMap = new Map<number, AnnotatedTrainRep[]>();

  for (const rep of annotatedReps) {
    const group = setMap.get(rep.sequenceSetNo) ?? [];
    group.push(rep);
    setMap.set(rep.sequenceSetNo, group);
  }

  return [...setMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([sequenceSetNo, setReps]) => {
      const firstRep = setReps[0];
      const allSamples = setReps.flatMap(rep => rep.samples);
      const fingerSummaries = Array.from({ length: 4 }, (_, fingerIndex) => {
        const kgValues = allSamples.map(sample => sample.fingerKg[fingerIndex]);
        const pctValues = allSamples.map(sample => sample.fingerPct[fingerIndex]);
        return {
          fingerIndex,
          peakKg: Math.max(0, ...kgValues),
          avgKg: mean(kgValues),
          avgPct: mean(pctValues),
          maxPct: Math.max(0, ...pctValues),
        };
      });

      const totalKg: number[] = [];
      const fingerKg = Array.from({ length: 4 }, () => [] as number[]);
      const repBreakpoints: number[] = [];

      setReps.forEach((rep, repIndex) => {
        rep.samples.forEach(sample => {
          totalKg.push(sample.totalKg);
          fingerKg.forEach((series, fingerIndex) => {
            series.push(sample.fingerKg[fingerIndex]);
          });
        });
        if (repIndex < setReps.length - 1) {
          repBreakpoints.push(totalKg.length);
        }
      });

      return {
        key: `${firstRep.blockId ?? 'set'}:${sequenceSetNo}`,
        sequenceSetNo,
        blockId: firstRep.blockId,
        blockLabel: firstRep.blockLabel,
        blockPhase: firstRep.blockPhase,
        localSetNo: firstRep.localSetNo,
        plannedRepsInSet: firstRep.plannedRepsInSet,
        reps: setReps,
        summary: {
          plannedReps: firstRep.plannedRepsInSet,
          completedReps: setReps.length,
          peakTotalKg: Math.max(0, ...setReps.map(rep => rep.peakTotalKg)),
          avgHoldKg: mean(setReps.map(rep => rep.avgHoldKg)),
          avgAdherencePct: mean(setReps.map(rep => rep.adherencePct)),
          totalTutS: setReps.reduce((sum, rep) => sum + rep.actualHangS, 0),
          avgImpulseKgS: mean(setReps.map(rep => rep.impulseKgS)),
        },
        fingerSummaries,
        chart: {
          totalKg,
          fingerKg,
          repBreakpoints,
        },
      };
    });
}
