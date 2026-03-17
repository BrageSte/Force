import { useLiveStore } from '../../stores/liveStore.ts';

export type FingerSeriesVisibility = [boolean, boolean, boolean, boolean];

export interface ForceChartSeriesVisibility {
  total: boolean;
  fingers: FingerSeriesVisibility;
}

export interface LiveSeriesSnapshot {
  times: number[];
  total: number[];
  fingers: [number[], number[], number[], number[]];
  maxTotalKg: number;
  maxFingerKg: number;
}

type LiveStoreState = ReturnType<typeof useLiveStore.getState>;

export const SHOW_ALL_FINGER_SERIES: FingerSeriesVisibility = [true, true, true, true];
export const HIDE_ALL_FINGER_SERIES: FingerSeriesVisibility = [false, false, false, false];

export const NATIVE_PER_FINGER_SERIES_VISIBILITY: ForceChartSeriesVisibility = {
  total: false,
  fingers: SHOW_ALL_FINGER_SERIES,
};

export const TOTAL_ONLY_SERIES_VISIBILITY: ForceChartSeriesVisibility = {
  total: true,
  fingers: HIDE_ALL_FINGER_SERIES,
};

export function readLiveSeriesSnapshot(state: LiveStoreState, maxPoints = 120): LiveSeriesSnapshot {
  const available = state.bufferLength;
  if (available === 0) {
    return {
      times: [],
      total: [],
      fingers: [[], [], [], []],
      maxTotalKg: 0,
      maxFingerKg: 0,
    };
  }

  const pointCount = Math.min(Math.max(2, maxPoints), available);
  const firstAbsoluteIndex = state.writePos - available;
  const times = new Array<number>(pointCount);
  const total = new Array<number>(pointCount);
  const fingers: [number[], number[], number[], number[]] = [
    new Array<number>(pointCount),
    new Array<number>(pointCount),
    new Array<number>(pointCount),
    new Array<number>(pointCount),
  ];

  let maxTotalKg = 0;
  let maxFingerKg = 0;

  for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
    const sourceIndex = pointCount === 1
      ? 0
      : Math.round((pointIndex / (pointCount - 1)) * (available - 1));
    const ringIndex = (firstAbsoluteIndex + sourceIndex) % state.capacity;
    const safeRingIndex = ringIndex < 0 ? ringIndex + state.capacity : ringIndex;

    const timeValue = state.timeSeries[safeRingIndex] ?? 0;
    const totalValue = state.totalSeries[safeRingIndex] ?? 0;

    times[pointIndex] = timeValue;
    total[pointIndex] = totalValue;
    maxTotalKg = Math.max(maxTotalKg, totalValue);

    for (let fingerIndex = 0; fingerIndex < 4; fingerIndex += 1) {
      const fingerValue = state.fingerSeries[fingerIndex][safeRingIndex] ?? 0;
      fingers[fingerIndex][pointIndex] = fingerValue;
      maxFingerKg = Math.max(maxFingerKg, fingerValue);
    }
  }

  return {
    times,
    total,
    fingers,
    maxTotalKg,
    maxFingerKg,
  };
}
