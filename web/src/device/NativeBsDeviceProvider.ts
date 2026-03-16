import type { DeviceCommand, InputMode, SourceKind } from '@krimblokk/core';
import { serializeDeviceCommand, streamModeForInputMode } from '@krimblokk/core';
import { SimulatedSource } from './SimulatedSource.ts';
import type { RestoreSimulatorArgs, SimulatorRuntimeState } from './simulatorTypes.ts';
import { WebSerialSource } from './WebSerialSource.ts';
import { defaultConnectedDevice } from './deviceProfiles.ts';
import type { ConnectedDeviceInfo } from '../types/force.ts';
import type {
  DataSource,
  DeviceError,
  DeviceFrame,
  DeviceProvider,
  DeviceScanResult,
  DeviceConnectionState,
} from '../types/device.ts';

export class NativeBsDeviceProvider implements DeviceProvider {
  readonly displayName: string;
  readonly sourceKind: SourceKind;

  onForceData: ((frame: DeviceFrame) => void) | null = null;
  onConnectionStateChange: ((state: DeviceConnectionState, device: ConnectedDeviceInfo | null) => void) | null = null;
  onStatus: ((message: string) => void) | null = null;
  onError: ((error: DeviceError) => void) | null = null;

  private inputMode: InputMode;
  private source: DataSource | null = null;
  private connectedDevice: ConnectedDeviceInfo | null = null;

  constructor(sourceKind: 'Serial' | 'Simulator', inputMode: InputMode) {
    this.sourceKind = sourceKind;
    this.displayName = sourceKind === 'Simulator' ? 'Simulator' : 'BS Multi-Finger';
    this.inputMode = inputMode;
  }

  async scanDevices(): Promise<DeviceScanResult[]> {
    return [{
      id: this.sourceKind === 'Simulator' ? 'native-bs-simulator' : 'native-bs-serial',
      sourceKind: this.sourceKind,
      device: defaultConnectedDevice(this.sourceKind),
    }];
  }

  async connect(): Promise<void> {
    this.emitState('connecting', null);

    const source = this.sourceKind === 'Simulator'
      ? new SimulatedSource(this.inputMode === 'MODE_RAW' ? 'raw' : 'kg')
      : new WebSerialSource(115200, this.inputMode);

    source.onSample = sample => {
      this.onForceData?.({
        kind: 'native-acquisition',
        sample,
      });
    };
    source.onStatus = message => this.onStatus?.(message);
    source.onConnectionChange = connected => {
      if (!connected && this.connectedDevice) {
        this.connectedDevice = null;
        this.emitState('idle', null);
      }
    };

    this.source = source;
    await source.start();
    this.connectedDevice = defaultConnectedDevice(this.sourceKind);
    this.emitState('connected', this.connectedDevice);
  }

  async disconnect(): Promise<void> {
    if (!this.source) {
      this.connectedDevice = null;
      this.emitState('idle', null);
      return;
    }

    this.emitState('disconnecting', this.connectedDevice);
    this.source.stop();
    this.source = null;
    this.connectedDevice = null;
    this.emitState('idle', null);
  }

  async tare(): Promise<void> {
    await this.sendDeviceCommand?.({ kind: 'tare' });
  }

  async startStreaming(): Promise<void> {
    if (!this.source?.setStreamMode) return;
    this.source.setStreamMode(streamModeForInputMode(this.inputMode));
  }

  async stopStreaming(): Promise<void> {
    // Current native runtime streams continuously once connected.
  }

  async getBatteryStatus(): Promise<number | null> {
    return null;
  }

  async sendCommand(cmd: string): Promise<boolean> {
    if (!this.source?.sendCommand) return false;
    this.source.sendCommand(cmd);
    return true;
  }

  async sendDeviceCommand(command: DeviceCommand): Promise<boolean> {
    if (!this.source?.sendCommand) return false;
    this.source.sendCommand(serializeDeviceCommand(command));
    return true;
  }

  async setInputMode(inputMode: InputMode): Promise<void> {
    this.inputMode = inputMode;
    if (!this.source?.setStreamMode) return;
    this.source.setStreamMode(streamModeForInputMode(inputMode));
  }

  async setSimulatorState(state: SimulatorRuntimeState): Promise<void> {
    this.source?.setSimulatorState?.(state);
  }

  async restoreDefaultSimulatorState(args?: RestoreSimulatorArgs): Promise<void> {
    this.source?.restoreDefaultSimulatorState?.(args);
  }

  isConnected(): boolean {
    return this.source?.isRunning() ?? false;
  }

  getConnectedDevice(): ConnectedDeviceInfo | null {
    return this.connectedDevice;
  }

  private emitState(state: DeviceConnectionState, device: ConnectedDeviceInfo | null): void {
    this.onConnectionStateChange?.(state, device);
  }
}
