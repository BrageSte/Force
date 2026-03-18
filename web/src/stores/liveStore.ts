import { create } from 'zustand';
import type { Finger4, ForceSample, EffortMetrics, Hand } from '../types/force.ts';
import { loadSettings } from '../storage/settingsStore.ts';
import {
  createIdleQuickCaptureState,
  DEFAULT_CUSTOM_DASHBOARD_METRICS,
  type LiveMeasureMetricId,
  type LiveMeasurePresetId,
  type QuickCaptureState,
  type QuickMeasureResult,
} from '../live/quickMeasure.ts';

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
  latestKg: Finger4 | null;
  latestTotalKg: number;
  latestPct: Finger4 | null;
  hasMeaningfulLoad: boolean;

  // Latest measured sample before display gating
  latestRaw: Finger4 | null;
  latestChannelRaw: Finger4 | null;
  latestMeasuredKg: Finger4 | null;
  latestMeasuredTotalKg: number;
  latestMeasuredPct: Finger4 | null;

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

  // Quick measure state
  quickMeasurePresetId: LiveMeasurePresetId;
  customDashboardMetrics: LiveMeasureMetricId[];
  quickCapture: QuickCaptureState;
  quickCaptureSamples: ForceSample[];
  quickResult: QuickMeasureResult | null;
  quickLivePeakTotalKg: number;
  quickLivePeakPerFingerKg: Finger4 | null;

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
  discardRecording: () => void;
  appendRecordedSample: (s: ForceSample) => void;
  addRecordedEffort: (e: EffortMetrics) => void;
  setQuickMeasurePreset: (presetId: LiveMeasurePresetId) => void;
  setCustomDashboardMetrics: (metrics: LiveMeasureMetricId[]) => void;
  toggleCustomDashboardMetric: (metricId: LiveMeasureMetricId) => void;
  armQuickCapture: (presetId: LiveMeasurePresetId, hand: Hand) => void;
  startQuickCapture: (sample: ForceSample, autoStopAtMs: number | null) => void;
  appendQuickCaptureSample: (sample: ForceSample) => void;
  completeQuickCapture: (result: QuickMeasureResult) => void;
  cancelQuickCapture: () => void;
  clearQuickMeasureRuntime: (options?: { preservePreset?: boolean }) => void;
  startEffortAccum: (s: ForceSample) => void;
  appendEffortSample: (s: ForceSample) => void;
  clearEffortAccum: () => void;
  setMeasurementHandOverride: (hand: Hand | null) => void;
  setBufferSeconds: (seconds: number) => void;
  resetLiveDashboard: () => void;
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

  latestKg: null,
  latestTotalKg: 0,
  latestPct: null,
  hasMeaningfulLoad: false,
  latestRaw: null,
  latestChannelRaw: null,
  latestMeasuredKg: null,
  latestMeasuredTotalKg: 0,
  latestMeasuredPct: null,
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
  quickMeasurePresetId: 'live_monitor',
  customDashboardMetrics: DEFAULT_CUSTOM_DASHBOARD_METRICS,
  quickCapture: createIdleQuickCaptureState(),
  quickCaptureSamples: [],
  quickResult: null,
  quickLivePeakTotalKg: 0,
  quickLivePeakPerFingerKg: null,
  currentEffortSamples: [],

  pushSample: (s: ForceSample, meta) => {
    const state = get();
    const pos = state.writePos % state.capacity;

    state.timeSeries[pos] = s.tMs;
    const clampedKg: Finger4 | null = s.kg
      ? [
          Math.max(0, s.kg[0]),
          Math.max(0, s.kg[1]),
          Math.max(0, s.kg[2]),
          Math.max(0, s.kg[3]),
        ]
      : null;
    const clampedTotal = Math.max(0, s.totalKg);
    const measuredPct: Finger4 | null = clampedKg && clampedTotal > 1e-9
      ? [
          (clampedKg[0] / clampedTotal) * 100,
          (clampedKg[1] / clampedTotal) * 100,
          (clampedKg[2] / clampedTotal) * 100,
          (clampedKg[3] / clampedTotal) * 100,
        ]
      : clampedKg
        ? [0, 0, 0, 0]
        : null;
    const hasMeaningfulLoad = clampedTotal >= 1;
    const displayKg: Finger4 | null = clampedKg
      ? (hasMeaningfulLoad ? clampedKg : [0, 0, 0, 0])
      : null;
    const total = hasMeaningfulLoad ? clampedTotal : 0;

    for (let i = 0; i < 4; i++) state.fingerSeries[i][pos] = displayKg?.[i] ?? 0;
    state.totalSeries[pos] = total;

    const pct: Finger4 | null = hasMeaningfulLoad && displayKg
      ? [
          (displayKg[0] / total) * 100,
          (displayKg[1] / total) * 100,
          (displayKg[2] / total) * 100,
          (displayKg[3] / total) * 100,
        ]
      : displayKg
        ? [0, 0, 0, 0]
        : null;

    // Sample rate estimation
    const now = performance.now();
    const recent = [...state._recentTimes, now].slice(-30);
    let hz = 0;
    if (recent.length >= 2) {
      const dt = (recent[recent.length - 1] - recent[0]) / 1000;
      if (dt > 0) hz = (recent.length - 1) / dt;
    }

    const nextQuickPeakTotalKg = Math.max(state.quickLivePeakTotalKg, clampedTotal);
    let nextQuickPeakPerFingerKg = state.quickLivePeakPerFingerKg;
    if (clampedKg) {
      nextQuickPeakPerFingerKg = nextQuickPeakPerFingerKg
        ? [
            Math.max(nextQuickPeakPerFingerKg[0], clampedKg[0]),
            Math.max(nextQuickPeakPerFingerKg[1], clampedKg[1]),
            Math.max(nextQuickPeakPerFingerKg[2], clampedKg[2]),
            Math.max(nextQuickPeakPerFingerKg[3], clampedKg[3]),
          ]
        : [...clampedKg] as Finger4;
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
      quickLivePeakTotalKg: nextQuickPeakTotalKg,
      quickLivePeakPerFingerKg: nextQuickPeakPerFingerKg,
    });
  },

  setCurrentEffort: (e) => set({ currentEffort: e }),
  setLastEffort: (e) => set({ lastEffort: e }),

  startRecording: (hand) => {
    if (get().quickCapture.status !== 'idle') return;
    set({
      recording: true,
      recordedSamples: [],
      recordedEfforts: [],
      recordingStartedIso: new Date().toISOString(),
      recordingHand: hand,
    });
  },

  stopRecording: () => set({ recording: false }),

  discardRecording: () => set({
    recording: false,
    recordedSamples: [],
    recordedEfforts: [],
    recordingStartedIso: null,
    recordingHand: null,
  }),

  appendRecordedSample: (s) => set(state => ({
    recordedSamples: [...state.recordedSamples, s],
  })),

  addRecordedEffort: (e) => set(s => ({
    recordedEfforts: [...s.recordedEfforts, e],
  })),

  setQuickMeasurePreset: (presetId) => set({
    quickMeasurePresetId: presetId,
    quickCapture: createIdleQuickCaptureState(),
    quickCaptureSamples: [],
    quickResult: null,
    quickLivePeakTotalKg: 0,
    quickLivePeakPerFingerKg: null,
  }),

  setCustomDashboardMetrics: (metrics) => set({
    customDashboardMetrics: metrics.length > 0 ? metrics : DEFAULT_CUSTOM_DASHBOARD_METRICS,
  }),

  toggleCustomDashboardMetric: (metricId) => set(state => {
    const exists = state.customDashboardMetrics.includes(metricId);
    const next = exists
      ? state.customDashboardMetrics.filter(item => item !== metricId)
      : [...state.customDashboardMetrics, metricId];
    return {
      customDashboardMetrics: next.length > 0 ? next : state.customDashboardMetrics,
    };
  }),

  armQuickCapture: (presetId, hand) => {
    if (get().recording) return;
    set({
      quickCapture: {
        status: 'armed',
        presetId,
        hand,
        startedAtMs: null,
        startedAtIso: null,
        autoStopAtMs: null,
      },
      quickCaptureSamples: [],
      quickResult: null,
    });
  },

  startQuickCapture: (sample, autoStopAtMs) => set(state => ({
    quickCapture: {
      ...state.quickCapture,
      status: 'capturing',
      startedAtMs: sample.tMs,
      startedAtIso: new Date().toISOString(),
      autoStopAtMs,
    },
    quickCaptureSamples: [sample],
    quickResult: null,
  })),

  appendQuickCaptureSample: (sample) => set(state => ({
    quickCaptureSamples: [...state.quickCaptureSamples, sample],
  })),

  completeQuickCapture: (result) => set({
    quickCapture: createIdleQuickCaptureState(),
    quickCaptureSamples: [],
    quickResult: result,
  }),

  cancelQuickCapture: () => set({
    quickCapture: createIdleQuickCaptureState(),
    quickCaptureSamples: [],
  }),

  clearQuickMeasureRuntime: (options) => set(state => ({
    quickMeasurePresetId: options?.preservePreset ? state.quickMeasurePresetId : 'live_monitor',
    quickCapture: createIdleQuickCaptureState(),
    quickCaptureSamples: [],
    quickResult: null,
    quickLivePeakTotalKg: 0,
    quickLivePeakPerFingerKg: null,
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

  resetLiveDashboard: () => set(state => ({
    writePos: 0,
    bufferLength: 0,
    currentEffort: null,
    lastEffort: null,
    latestRaw: null,
    latestChannelRaw: null,
    latestMeasuredKg: null,
    latestMeasuredTotalKg: 0,
    latestMeasuredPct: null,
    latestKg: null,
    latestTotalKg: 0,
    latestPct: null,
    recording: false,
    recordedSamples: [],
    recordedEfforts: [],
    recordingStartedIso: null,
    recordingHand: null,
    quickMeasurePresetId: state.quickMeasurePresetId,
    customDashboardMetrics: state.customDashboardMetrics,
    quickCapture: createIdleQuickCaptureState(),
    quickCaptureSamples: [],
    quickResult: null,
    quickLivePeakTotalKg: 0,
    quickLivePeakPerFingerKg: null,
    currentEffortSamples: [],
    _recentTimes: [],
    hasMeaningfulLoad: false,
    tareRequired: false,
    sampleRateHz: 0,
  })),

  resetSession: () => set({
    writePos: 0,
    bufferLength: 0,
    currentEffort: null,
    lastEffort: null,
    latestRaw: null,
    latestChannelRaw: null,
    latestMeasuredKg: null,
    latestMeasuredTotalKg: 0,
    latestMeasuredPct: null,
    latestKg: null,
    latestTotalKg: 0,
    latestPct: null,
    recording: false,
    recordedSamples: [],
    recordedEfforts: [],
    recordingStartedIso: null,
    recordingHand: null,
    measurementHandOverride: null,
    quickMeasurePresetId: 'live_monitor',
    customDashboardMetrics: DEFAULT_CUSTOM_DASHBOARD_METRICS,
    quickCapture: createIdleQuickCaptureState(),
    quickCaptureSamples: [],
    quickResult: null,
    quickLivePeakTotalKg: 0,
    quickLivePeakPerFingerKg: null,
    currentEffortSamples: [],
    _recentTimes: [],
    hasMeaningfulLoad: false,
    tareRequired: false,
    sampleRateHz: 0,
  }),
}));
