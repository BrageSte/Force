import type {
  DataSource,
  DeviceConnectionState,
  DeviceError,
  DeviceFrame,
  DeviceProvider,
} from '../types/device.ts';
import type { AcquisitionSample, ConnectedDeviceInfo, Finger4, ForceSample, Hand } from '../types/force.ts';
import { MultiChannelSmoother } from '../analytics/smoothing.ts';
import { OnlineEffortDetector } from '../analytics/segmentation.ts';
import { analyzeEffortSamples } from '../analytics/metrics.ts';
import { rawToKg } from '../calibration/CalibrationProfile.ts';
import { remapMeasurementToCanonicalFingers } from '../constants/fingers.ts';
import { useDeviceStore } from '../stores/deviceStore.ts';
import { useLiveStore } from '../stores/liveStore.ts';
import { useAppStore } from '../stores/appStore.ts';
import { isLikelyRawCounts, KG_TO_N, streamModeForInputMode, type InputMode } from '@krimblokk/core';
import { defaultConnectedDevice } from '../device/deviceProfiles.ts';

class InlineNativeSourceProvider implements DeviceProvider {
  readonly displayName: string;
  readonly sourceKind: 'Serial' | 'Simulator';

  onForceData: ((frame: DeviceFrame) => void) | null = null;
  onConnectionStateChange: ((state: DeviceConnectionState, device: ConnectedDeviceInfo | null) => void) | null = null;
  onStatus: ((message: string) => void) | null = null;
  onError: ((error: DeviceError) => void) | null = null;

  private readonly source: DataSource;
  private readonly device: ConnectedDeviceInfo;

  constructor(source: DataSource, sourceKind: 'Serial' | 'Simulator') {
    this.source = source;
    this.sourceKind = sourceKind;
    this.displayName = sourceKind === 'Simulator' ? 'Simulator' : 'BS Multi-Finger';
    this.device = defaultConnectedDevice(sourceKind);
  }

  async scanDevices() {
    return [{
      id: this.sourceKind === 'Simulator' ? 'inline-native-simulator' : 'inline-native-serial',
      sourceKind: this.sourceKind,
      device: this.device,
    }];
  }

  async connect(): Promise<void> {
    this.onConnectionStateChange?.('connecting', null);
    this.source.onSample = sample => this.onForceData?.({ kind: 'native-acquisition', sample });
    this.source.onStatus = message => this.onStatus?.(message);
    this.source.onConnectionChange = connected => {
      this.onConnectionStateChange?.(connected ? 'connected' : 'idle', connected ? this.device : null);
    };
    await this.source.start();
    this.onConnectionStateChange?.('connected', this.device);
  }

  async disconnect(): Promise<void> {
    this.onConnectionStateChange?.('disconnecting', this.device);
    this.source.stop();
    this.onConnectionStateChange?.('idle', null);
  }

  async tare(): Promise<void> {
    this.source.sendCommand?.('t');
  }

  async startStreaming(): Promise<void> {}
  async stopStreaming(): Promise<void> {}
  async getBatteryStatus(): Promise<number | null> {
    return null;
  }

  async sendCommand(cmd: string): Promise<boolean> {
    if (!this.source.sendCommand) return false;
    this.source.sendCommand(cmd);
    return true;
  }

  async setInputMode(inputMode: InputMode): Promise<void> {
    this.source.setStreamMode?.(streamModeForInputMode(inputMode));
  }

  isConnected(): boolean {
    return this.source.isRunning();
  }

  getConnectedDevice() {
    return this.source.isRunning() ? this.device : null;
  }
}

/** Singleton pipeline that wires a DataSource to the Zustand stores. */
export class SamplePipeline {
  private provider: DeviceProvider | null = null;
  private nativeSmoother: MultiChannelSmoother;
  private detector: OnlineEffortDetector;
  private sampleCounter = 0;
  private rawAutoswitchDone = false;
  private measurementHand: Hand | null = null;
  private totalEmaState: number | null = null;
  private totalMaBuf: number[] = [];

  constructor() {
    const settings = useAppStore.getState().settings;
    this.nativeSmoother = new MultiChannelSmoother(
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
    this.nativeSmoother.reconfigure(
      settings.smoothingMode,
      settings.smoothingAlpha,
      settings.smoothingWindow,
    );
    this.resetTotalSmoother();
    this.detector = new OnlineEffortDetector({
      startThresholdKg: settings.startThresholdKg,
      stopThresholdKg: settings.stopThresholdKg,
      startHoldMs: settings.startHoldMs,
      stopHoldMs: settings.stopHoldMs,
    });
  }

  async connect(sourceOverride?: DeviceProvider | DataSource): Promise<void> {
    this.disconnect();

    const deviceStore = useDeviceStore.getState();
    const settings = useAppStore.getState().settings;
    const provider = this.createProvider(sourceOverride, deviceStore.sourceKind, settings.inputMode);
    this.provider = provider;
    this.sampleCounter = 0;
    this.rawAutoswitchDone = false;
    this.measurementHand = null;
    this.nativeSmoother.reset();
    this.resetTotalSmoother();
    this.detector.reset();
    useLiveStore.getState().setBufferSeconds(settings.ringBufferSeconds);

    provider.onForceData = this.handleFrame;
    provider.onStatus = (msg) => useDeviceStore.getState().addStatus(msg);
    provider.onError = (error) => useDeviceStore.getState().addStatus(error.message);
    provider.onConnectionStateChange = (state, device) => {
      useDeviceStore.getState().setConnectionState(state, device);
    };

    deviceStore.setProvider(provider);
    await provider.connect();
  }

  disconnect(): void {
    this.finalizeActiveEffort();

    if (this.provider) {
      void this.provider.disconnect();
      this.provider = null;
    }

    this.detector.reset();
    this.nativeSmoother.reset();
    this.resetTotalSmoother();
    this.rawAutoswitchDone = false;
    this.measurementHand = null;
    useDeviceStore.getState().setProvider(null);
    useDeviceStore.getState().setConnectedDevice(null);
    useDeviceStore.getState().setConnectionState('idle', null);
  }

  finalizeActiveEffort(): void {
    if (useLiveStore.getState().currentEffortSamples.length > 0) {
      this.finalizeCurrentEffort();
    }
  }

  private handleFrame = (frame: DeviceFrame): void => {
    if (frame.kind === 'native-acquisition') {
      this.handleNativeSample(frame.sample);
      return;
    }

    this.handleNormalizedSample(frame.sample);
  };

  private handleNativeSample(acq: AcquisitionSample): void {
    this.sampleCounter++;
    let settings = useAppStore.getState().settings;
    this.maybeAutoSwitchToRaw(acq.values, settings);
    settings = useAppStore.getState().settings;
    const measurementHand = this.resolveMeasurementHand();
    this.syncMeasurementHand(measurementHand);

    // Calibration (raw → kg)
    const channelRaw = acq.values;
    let kgValues: Finger4 = channelRaw;
    if (settings.inputMode === 'MODE_RAW') {
      kgValues = rawToKg(settings.calibration, channelRaw);
    }
    // Normalize all force data to canonical anatomical order exactly once here.
    const rawByFinger = remapMeasurementToCanonicalFingers(measurementHand, channelRaw);
    const kgByFinger = remapMeasurementToCanonicalFingers(measurementHand, kgValues);

    // Smoothing
    const kgSmoothed = this.nativeSmoother.apply(kgByFinger);
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
      source: 'native-bs',
      raw: rawByFinger,
      kg: kgClamped,
      totalKg: kgClamped[0] + kgClamped[1] + kgClamped[2] + kgClamped[3],
      totalN: (kgClamped[0] + kgClamped[1] + kgClamped[2] + kgClamped[3]) * KG_TO_N,
      stability: null,
    };

    this.commitSample(forceSample, { tareRequired, channelRaw });
  }

  private handleNormalizedSample(sample: ForceSample): void {
    this.sampleCounter++;
    const totalSmoothed = this.applyTotalSmoothing(sample.totalKg);
    const totalClamped = Math.max(0, totalSmoothed);
    const normalizedSample: ForceSample = {
      ...sample,
      totalKg: totalClamped,
      totalN: totalClamped * KG_TO_N,
      raw: null,
      kg: null,
    };

    this.commitSample(normalizedSample, {
      tareRequired: totalSmoothed <= -1,
    });
  }

  private commitSample(sample: ForceSample, meta?: { tareRequired?: boolean; channelRaw?: Finger4 }): void {
    const liveStore = useLiveStore.getState();
    const settings = useAppStore.getState().settings;

    // Push to ring buffer
    liveStore.pushSample(sample, meta);

    // Recording
    if (liveStore.recording) {
      liveStore.appendRecordedSample(sample);
    }

    // Segmentation
    const evt = this.detector.update(this.sampleCounter, sample.tMs, sample.totalKg);

    if (evt.started) {
      liveStore.startEffortAccum(sample);
    } else if (this.detector.active) {
      liveStore.appendEffortSample(sample);
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
  }

  private resolveMeasurementHand(): Hand {
    const live = useLiveStore.getState();
    return live.recordingHand ?? live.measurementHandOverride ?? useAppStore.getState().hand;
  }

  private syncMeasurementHand(hand: Hand): void {
    if (this.measurementHand === hand) return;
    this.measurementHand = hand;
    this.nativeSmoother.reset();
    this.resetTotalSmoother();
    this.detector.reset();
    useLiveStore.getState().clearEffortAccum();
  }

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
    void useDeviceStore.getState().setInputMode('MODE_RAW');
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

  private createProvider(
    sourceOverride: DeviceProvider | DataSource | undefined,
    sourceKind: ReturnType<typeof useDeviceStore.getState>['sourceKind'],
    inputMode: InputMode,
  ): DeviceProvider {
    if (!sourceOverride) {
      return useDeviceStore.getState().createProvider(sourceKind, inputMode);
    }
    if ('scanDevices' in sourceOverride) {
      return sourceOverride;
    }
    const nativeKind = sourceKind === 'Simulator' ? 'Simulator' : 'Serial';
    return new InlineNativeSourceProvider(sourceOverride, nativeKind);
  }

  private resetTotalSmoother(): void {
    this.totalEmaState = null;
    this.totalMaBuf = [];
  }

  private applyTotalSmoothing(totalKg: number): number {
    const settings = useAppStore.getState().settings;
    if (settings.smoothingMode === 'NONE') return totalKg;

    if (settings.smoothingMode === 'EMA') {
      if (this.totalEmaState === null) {
        this.totalEmaState = totalKg;
      } else {
        this.totalEmaState = settings.smoothingAlpha * totalKg + (1 - settings.smoothingAlpha) * this.totalEmaState;
      }
      return this.totalEmaState;
    }

    this.totalMaBuf.push(totalKg);
    if (this.totalMaBuf.length > settings.smoothingWindow) {
      this.totalMaBuf.shift();
    }
    const sum = this.totalMaBuf.reduce((acc, value) => acc + value, 0);
    return sum / this.totalMaBuf.length;
  }
}

// Global singleton
export const pipeline = new SamplePipeline();
