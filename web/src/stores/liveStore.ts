import { create } from 'zustand';
import type { Finger4, ForceSample, EffortMetrics, Hand } from '../types/force.ts';
import { loadSettings } from '../storage/settingsStore.ts';

function bufferCapacityForSeconds(seconds: number): number {
  return Math.max(250, Math.round(Math.max(15, seconds) * 50));
}

function createFingerSeries(capacity: number): [Float64Array, Float64Array, Float64Array, Float64Array] {
  return [
    new Float64Array(capacity),
    new Float64Array(capacity),
    new Float64Array(capacity),
    new Float64Array(capacity),
  ];
}

interface LiveState {
  // Ring buffer — pre-allocated typed arrays
  capacity: number;
  timeSeries: Float64Array;
  totalSeries: Float64Array;
  fingerSeries: [Float64Array, Float64Array, Float64Array, Float64Array];
  writePos: number;
  bufferLength: number;

  // Latest display sample for KPI cards and UI noise gating
  latestKg: Finger4;
  latestTotalKg: number;
  latestPct: Finger4;
  hasMeaningfulLoad: boolean;

  // Latest measured sample before display gating
  latestRaw: Finger4;
  latestChannelRaw: Finger4;
  latestMeasuredKg: Finger4;
  latestMeasuredTotalKg: number;
  latestMeasuredPct: Finger4;

  tareRequired: boolean;
  sampleRateHz: number;

  // Effort state
  currentEffort: EffortMetrics | null;
  lastEffort: EffortMetrics | null;

  // Recording state
  recording: boolean;
  recordedSamples: ForceSample[];
  recordedEfforts: EffortMetrics[];
  recordingStartedIso: string | null;
  recordingHand: Hand | null;
  measurementHandOverride: Hand | null;

  // Current effort accumulation
  currentEffortSamples: ForceSample[];

  // Sample rate tracking
  _recentTimes: number[];

  // Actions
  pushSample: (s: ForceSample, meta?: { tareRequired?: boolean; channelRaw?: Finger4 }) => void;
  setCurrentEffort: (e: EffortMetrics | null) => void;
  setLastEffort: (e: EffortMetrics | null) => void;
  startRecording: (hand: Hand) => void;
  stopRecording: () => void;
  appendRecordedSample: (s: ForceSample) => void;
  addRecordedEffort: (e: EffortMetrics) => void;
  startEffortAccum: (s: ForceSample) => void;
  appendEffortSample: (s: ForceSample) => void;
  clearEffortAccum: () => void;
  setMeasurementHandOverride: (hand: Hand | null) => void;
  setBufferSeconds: (seconds: number) => void;
  resetSession: () => void;
}

const initialCapacity = bufferCapacityForSeconds(loadSettings().ringBufferSeconds);

export const useLiveStore = create<LiveState>((set, get) => ({
  capacity: initialCapacity,
  timeSeries: new Float64Array(initialCapacity),
  totalSeries: new Float64Array(initialCapacity),
  fingerSeries: createFingerSeries(initialCapacity),
  writePos: 0,
  bufferLength: 0,

  latestKg: [0, 0, 0, 0],
  latestTotalKg: 0,
  latestPct: [0, 0, 0, 0],
  hasMeaningfulLoad: false,
  latestRaw: [0, 0, 0, 0],
  latestChannelRaw: [0, 0, 0, 0],
  latestMeasuredKg: [0, 0, 0, 0],
  latestMeasuredTotalKg: 0,
  latestMeasuredPct: [0, 0, 0, 0],
  tareRequired: false,
  sampleRateHz: 0,
  _recentTimes: [],

  currentEffort: null,
  lastEffort: null,

  recording: false,
  recordedSamples: [],
  recordedEfforts: [],
  recordingStartedIso: null,
  recordingHand: null,
  measurementHandOverride: null,
  currentEffortSamples: [],

  pushSample: (s: ForceSample, meta) => {
    const state = get();
    const pos = state.writePos % state.capacity;

    state.timeSeries[pos] = s.tMs;
    const clampedKg: Finger4 = [
      Math.max(0, s.kg[0]),
      Math.max(0, s.kg[1]),
      Math.max(0, s.kg[2]),
      Math.max(0, s.kg[3]),
    ];
    const clampedTotal = clampedKg[0] + clampedKg[1] + clampedKg[2] + clampedKg[3];
    const measuredPct: Finger4 = clampedTotal > 1e-9
      ? [
          (clampedKg[0] / clampedTotal) * 100,
          (clampedKg[1] / clampedTotal) * 100,
          (clampedKg[2] / clampedTotal) * 100,
          (clampedKg[3] / clampedTotal) * 100,
        ]
      : [0, 0, 0, 0];
    const hasMeaningfulLoad = clampedTotal >= 1;
    const displayKg: Finger4 = hasMeaningfulLoad ? clampedKg : [0, 0, 0, 0];
    const total = hasMeaningfulLoad ? clampedTotal : 0;

    for (let i = 0; i < 4; i++) state.fingerSeries[i][pos] = displayKg[i];
    state.totalSeries[pos] = total;

    const pct: Finger4 = hasMeaningfulLoad
      ? [
          (displayKg[0] / total) * 100,
          (displayKg[1] / total) * 100,
          (displayKg[2] / total) * 100,
          (displayKg[3] / total) * 100,
        ]
      : [0, 0, 0, 0];

    // Sample rate estimation
    const now = performance.now();
    const recent = [...state._recentTimes, now].slice(-30);
    let hz = 0;
    if (recent.length >= 2) {
      const dt = (recent[recent.length - 1] - recent[0]) / 1000;
      if (dt > 0) hz = (recent.length - 1) / dt;
    }

    set({
      writePos: state.writePos + 1,
      bufferLength: Math.min(state.writePos + 1, state.capacity),
      latestRaw: s.raw,
      latestChannelRaw: meta?.channelRaw ?? s.raw,
      latestMeasuredKg: clampedKg,
      latestMeasuredTotalKg: clampedTotal,
      latestMeasuredPct: measuredPct,
      latestKg: displayKg,
      latestTotalKg: total,
      latestPct: pct,
      hasMeaningfulLoad,
      tareRequired: meta?.tareRequired ?? false,
      sampleRateHz: hz,
      _recentTimes: recent,
    });
  },

  setCurrentEffort: (e) => set({ currentEffort: e }),
  setLastEffort: (e) => set({ lastEffort: e }),

  startRecording: (hand) => set({
    recording: true,
    recordedSamples: [],
    recordedEfforts: [],
    recordingStartedIso: new Date().toISOString(),
    recordingHand: hand,
  }),

  stopRecording: () => set({ recording: false }),

  appendRecordedSample: (s) => set(state => ({
    recordedSamples: [...state.recordedSamples, s],
  })),

  addRecordedEffort: (e) => set(s => ({
    recordedEfforts: [...s.recordedEfforts, e],
  })),

  startEffortAccum: (s) => set({ currentEffortSamples: [s] }),

  appendEffortSample: (s) => set(state => ({
    currentEffortSamples: [...state.currentEffortSamples, s],
  })),

  clearEffortAccum: () => set({ currentEffortSamples: [], currentEffort: null }),

  setMeasurementHandOverride: (hand) => set({ measurementHandOverride: hand }),

  setBufferSeconds: (seconds) => {
    const capacity = bufferCapacityForSeconds(seconds);
    set({
      capacity,
      timeSeries: new Float64Array(capacity),
      totalSeries: new Float64Array(capacity),
      fingerSeries: createFingerSeries(capacity),
      writePos: 0,
      bufferLength: 0,
    });
  },

  resetSession: () => set({
    writePos: 0,
    bufferLength: 0,
    currentEffort: null,
    lastEffort: null,
    latestRaw: [0, 0, 0, 0],
    latestChannelRaw: [0, 0, 0, 0],
    latestMeasuredKg: [0, 0, 0, 0],
    latestMeasuredTotalKg: 0,
    latestMeasuredPct: [0, 0, 0, 0],
    latestKg: [0, 0, 0, 0],
    latestTotalKg: 0,
    latestPct: [0, 0, 0, 0],
    recording: false,
    recordedSamples: [],
    recordedEfforts: [],
    recordingStartedIso: null,
    recordingHand: null,
    measurementHandOverride: null,
    currentEffortSamples: [],
    _recentTimes: [],
    hasMeaningfulLoad: false,
    tareRequired: false,
    sampleRateHz: 0,
  }),
}));
