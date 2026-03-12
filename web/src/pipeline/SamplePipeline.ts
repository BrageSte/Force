import type { DataSource } from '../types/device.ts';
import type { AcquisitionSample, Finger4, ForceSample } from '../types/force.ts';
import { MultiChannelSmoother } from '../analytics/smoothing.ts';
import { OnlineEffortDetector } from '../analytics/segmentation.ts';
import { analyzeEffortSamples } from '../analytics/metrics.ts';
import { rawToKg } from '../calibration/CalibrationProfile.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';
import { useAppStore } from '../stores/appStore.ts';
import { isLikelyRawCounts } from '@krimblokk/core';

/** Singleton pipeline that wires a DataSource to the Zustand stores. */
export class SamplePipeline {
  private source: DataSource | null = null;
  private smoother: MultiChannelSmoother;
  private detector: OnlineEffortDetector;
  private sampleCounter = 0;
  private rawAutoswitchDone = false;

  constructor() {
    const settings = useAppStore.getState().settings;
    this.smoother = new MultiChannelSmoother(
      settings.smoothingMode,
      settings.smoothingAlpha,
      settings.smoothingWindow,
    );
    this.detector = new OnlineEffortDetector({
      startThresholdKg: settings.startThresholdKg,
      stopThresholdKg: settings.stopThresholdKg,
      startHoldMs: settings.startHoldMs,
      stopHoldMs: settings.stopHoldMs,
    });
  }

  /** Rebuild smoother/detector when settings change. */
  reconfigure(): void {
    const settings = useAppStore.getState().settings;
    this.rawAutoswitchDone = false;
    useLiveStore.getState().setBufferSeconds(settings.ringBufferSeconds);
    this.smoother.reconfigure(
      settings.smoothingMode,
      settings.smoothingAlpha,
      settings.smoothingWindow,
    );
    this.detector = new OnlineEffortDetector({
      startThresholdKg: settings.startThresholdKg,
      stopThresholdKg: settings.stopThresholdKg,
      startHoldMs: settings.startHoldMs,
      stopHoldMs: settings.stopHoldMs,
    });
  }

  async connect(sourceOverride?: DataSource): Promise<void> {
    this.disconnect();

    const deviceStore = useDeviceStore.getState();
    const settings = useAppStore.getState().settings;
    const source = sourceOverride ?? deviceStore.createSource(deviceStore.sourceKind, settings.inputMode);
    this.source = source;
    this.sampleCounter = 0;
    this.rawAutoswitchDone = false;
    this.smoother.reset();
    this.detector.reset();
    useLiveStore.getState().setBufferSeconds(settings.ringBufferSeconds);

    source.onSample = this.handleSample;
    source.onStatus = (msg) => useDeviceStore.getState().addStatus(msg);
    source.onConnectionChange = (c) => useDeviceStore.getState().setConnected(c);

    deviceStore.setSource(source);
    await source.start();
  }

  disconnect(): void {
    this.finalizeActiveEffort();

    if (this.source) {
      this.source.stop();
      this.source = null;
    }

    this.detector.reset();
    this.smoother.reset();
    this.rawAutoswitchDone = false;
    useDeviceStore.getState().setSource(null);
    useDeviceStore.getState().setConnected(false);
  }

  finalizeActiveEffort(): void {
    if (useLiveStore.getState().currentEffortSamples.length > 0) {
      this.finalizeCurrentEffort();
    }
  }

  private handleSample = (acq: AcquisitionSample): void => {
    this.sampleCounter++;
    let settings = useAppStore.getState().settings;
    this.maybeAutoSwitchToRaw(acq.values, settings);
    settings = useAppStore.getState().settings;

    // Calibration (raw → kg)
    let kgValues: Finger4 = acq.values;
    if (settings.inputMode === 'MODE_RAW') {
      kgValues = rawToKg(settings.calibration, acq.values);
    }

    // Smoothing
    const kgSmoothed = this.smoother.apply(kgValues);
    const rawTotal = kgSmoothed[0] + kgSmoothed[1] + kgSmoothed[2] + kgSmoothed[3];
    const tareRequired = rawTotal <= -1 || kgSmoothed.some(v => v <= -1);
    const kgClamped: Finger4 = [
      Math.max(0, kgSmoothed[0]),
      Math.max(0, kgSmoothed[1]),
      Math.max(0, kgSmoothed[2]),
      Math.max(0, kgSmoothed[3]),
    ];

    const forceSample: ForceSample = {
      tMs: acq.tMs,
      raw: acq.values,
      kg: kgClamped,
    };

    const liveStore = useLiveStore.getState();

    // Push to ring buffer
    liveStore.pushSample(forceSample, { tareRequired });

    // Recording
    if (liveStore.recording) {
      liveStore.appendRecordedSample(forceSample);
    }

    // Segmentation
    const total = kgClamped[0] + kgClamped[1] + kgClamped[2] + kgClamped[3];
    const evt = this.detector.update(this.sampleCounter, forceSample.tMs, total);

    if (evt.started) {
      liveStore.startEffortAccum(forceSample);
    } else if (this.detector.active) {
      liveStore.appendEffortSample(forceSample);
    }

    // Live effort analysis (every few samples during active effort)
    if (this.detector.active && liveStore.currentEffortSamples.length >= 3 && this.sampleCounter % 5 === 0) {
      const metrics = analyzeEffortSamples(
        liveStore.currentEffortSamples,
        0,
        {
          tutThresholdKg: settings.tutThresholdKg,
          holdPeakFraction: settings.holdPeakFraction,
          stabilizationShiftThreshold: settings.stabilizationShiftThreshold,
          stabilizationHoldMs: settings.stabilizationHoldMs,
        },
      );
      useLiveStore.setState({ currentEffort: metrics });
    }

    if (evt.ended) {
      this.finalizeCurrentEffort();
    }
  };

  private maybeAutoSwitchToRaw(
    values: Finger4,
    settings: ReturnType<typeof useAppStore.getState>['settings'],
  ): void {
    if (settings.inputMode !== 'MODE_KG_DIRECT') return;
    if (this.rawAutoswitchDone) return;

    const sourceKind = useDeviceStore.getState().sourceKind;
    if (sourceKind !== 'Serial' && sourceKind !== 'BLE_UART') return;
    if (!isLikelyRawCounts(values)) return;

    this.rawAutoswitchDone = true;
    useAppStore.getState().updateSettings({ inputMode: 'MODE_RAW' });
    if (this.source?.setStreamMode) {
      this.source.setStreamMode('raw');
    } else {
      useDeviceStore.getState().sendCommand('m raw');
    }
    useDeviceStore.getState().addStatus(
      'Detected raw counts while MODE_KG_DIRECT was active. Switched to MODE_RAW automatically.',
    );
  }

  private finalizeCurrentEffort(): void {
    const liveStore = useLiveStore.getState();
    const samples = liveStore.currentEffortSamples;
    if (samples.length < 2) {
      liveStore.clearEffortAccum();
      return;
    }

    const settings = useAppStore.getState().settings;
    const effortId = liveStore.recordedEfforts.length + 1;
    const metrics = analyzeEffortSamples(samples, effortId, {
      tutThresholdKg: settings.tutThresholdKg,
      holdPeakFraction: settings.holdPeakFraction,
      stabilizationShiftThreshold: settings.stabilizationShiftThreshold,
      stabilizationHoldMs: settings.stabilizationHoldMs,
    });

    useLiveStore.setState({ lastEffort: metrics, currentEffort: null, currentEffortSamples: [] });

    if (liveStore.recording) {
      liveStore.addRecordedEffort(metrics);
    }
  }
}

// Global singleton
export const pipeline = new SamplePipeline();
