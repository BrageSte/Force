import type { ConnectedDeviceInfo, DeviceCapabilities, DeviceType } from '../types/force.ts';
import type { SourceKind } from '../types/settings.ts';

export const NATIVE_BS_CAPABILITIES: DeviceCapabilities = {
  totalForce: true,
  perFingerForce: true,
  batteryStatus: false,
  tare: true,
  startStopStreaming: true,
};

export const TINDEQ_CAPABILITIES: DeviceCapabilities = {
  totalForce: true,
  perFingerForce: false,
  batteryStatus: true,
  tare: true,
  startStopStreaming: true,
};

export function deviceTypeLabel(deviceType: DeviceType): string {
  return deviceType === 'tindeq' ? 'Tindeq Progressor' : 'BS Multi-Finger';
}

export function capabilitySummary(capabilities: DeviceCapabilities): string {
  return capabilities.perFingerForce
    ? 'Total force + per-finger force'
    : 'Total force only';
}

export function defaultConnectedDevice(sourceKind: SourceKind): ConnectedDeviceInfo {
  if (sourceKind === 'Tindeq') {
    return {
      deviceType: 'tindeq',
      deviceName: 'Tindeq Progressor',
      deviceLabel: deviceTypeLabel('tindeq'),
      transport: 'ble',
      sourceKind,
      capabilities: TINDEQ_CAPABILITIES,
      batteryMv: null,
      batteryPercent: null,
    };
  }

  return {
    deviceType: 'native-bs',
    deviceName: sourceKind === 'Simulator' ? 'Simulator' : 'BS Multi-Finger',
    deviceLabel: deviceTypeLabel('native-bs'),
    transport: sourceKind === 'Simulator' ? 'simulator' : 'serial',
    sourceKind,
    capabilities: NATIVE_BS_CAPABILITIES,
    batteryMv: null,
    batteryPercent: null,
  };
}
