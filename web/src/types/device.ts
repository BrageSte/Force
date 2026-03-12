import type { AcquisitionSample } from './force.ts';
import type { DeviceStreamMode } from '@krimblokk/core';

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
