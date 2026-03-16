import type {
  AcquisitionSample,
  ConnectedDeviceInfo,
  ForceSample,
} from './force.ts';
import type {
  DeviceCommand,
  DeviceStreamMode,
  InputMode,
  SourceKind,
} from '@krimblokk/core';

export interface DataSource {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;

  sendCommand?(cmd: string): void;
  setStreamMode?(mode: DeviceStreamMode): void;

  onSample: ((sample: AcquisitionSample) => void) | null;
  onStatus: ((message: string) => void) | null;
  onConnectionChange: ((connected: boolean) => void) | null;
}

export type DeviceConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'reconnecting'
  | 'error';

export type DeviceFrame =
  | {
      kind: 'native-acquisition';
      sample: AcquisitionSample;
    }
  | {
      kind: 'force';
      sample: ForceSample;
    };

export type DeviceErrorCode =
  | 'ble_unavailable'
  | 'permissions_denied'
  | 'device_not_found'
  | 'connect_failure'
  | 'dropped_notifications'
  | 'malformed_payload'
  | 'unsupported_command'
  | 'reconnect_failure'
  | 'stale_connection'
  | 'timeout'
  | 'user_cancellation';

export interface DeviceError {
  code: DeviceErrorCode;
  message: string;
  cause?: unknown;
  recoverable?: boolean;
}

export interface DeviceScanResult {
  id: string;
  sourceKind: SourceKind;
  device: ConnectedDeviceInfo;
}

export interface DeviceProvider {
  readonly sourceKind: SourceKind;
  readonly displayName: string;

  onForceData: ((frame: DeviceFrame) => void) | null;
  onConnectionStateChange: ((state: DeviceConnectionState, device: ConnectedDeviceInfo | null) => void) | null;
  onStatus: ((message: string) => void) | null;
  onError: ((error: DeviceError) => void) | null;

  scanDevices(): Promise<DeviceScanResult[]>;
  connect(target?: DeviceScanResult): Promise<void>;
  disconnect(): Promise<void>;
  tare(): Promise<void>;
  startStreaming(): Promise<void>;
  stopStreaming(): Promise<void>;
  getBatteryStatus(): Promise<number | null>;
  sendCommand?(cmd: string): Promise<boolean>;
  sendDeviceCommand?(command: DeviceCommand): Promise<boolean>;
  setInputMode?(inputMode: InputMode): Promise<void> | void;
  isConnected(): boolean;
  getConnectedDevice(): ConnectedDeviceInfo | null;
}
