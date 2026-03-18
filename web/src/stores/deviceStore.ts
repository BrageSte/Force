import { create } from 'zustand';
import { streamModeForInputMode, type DeviceCommand, type InputMode, type SourceKind } from '@krimblokk/core';
import { loadSettings } from '../storage/settingsStore.ts';
import { NativeBsDeviceProvider } from '../device/NativeBsDeviceProvider.ts';
import { TindeqDeviceProvider } from '../device/TindeqDeviceProvider.ts';
import type {
  DeviceConnectionState,
  DeviceProvider,
  DeviceScanResult,
} from '../types/device.ts';
import type { ConnectedDeviceInfo } from '../types/force.ts';
import type { RestoreSimulatorArgs, SimulatorRuntimeState } from '../device/simulatorTypes.ts';
import { useVerificationStore } from './verificationStore.ts';

interface DeviceState {
  sourceKind: SourceKind;
  connectionState: DeviceConnectionState;
  connected: boolean;
  statusMessages: string[];
  provider: DeviceProvider | null;
  activeDevice: ConnectedDeviceInfo | null;
  scannedDevices: DeviceScanResult[];

  setSourceKind: (kind: SourceKind) => void;
  setConnectionState: (state: DeviceConnectionState, device?: ConnectedDeviceInfo | null) => void;
  setProvider: (provider: DeviceProvider | null) => void;
  setConnectedDevice: (device: ConnectedDeviceInfo | null) => void;
  setScannedDevices: (devices: DeviceScanResult[]) => void;
  addStatus: (msg: string) => void;
  createProvider: (kind: SourceKind, inputMode: InputMode) => DeviceProvider;
  scanDevices: (inputMode: InputMode) => Promise<DeviceScanResult[]>;
  sendCommand: (cmd: string) => Promise<boolean>;
  sendDeviceCommand: (cmd: DeviceCommand) => Promise<boolean>;
  tare: () => Promise<void>;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  getBatteryStatus: () => Promise<number | null>;
  setInputMode: (inputMode: InputMode) => Promise<void>;
  setSimulatorState: (state: SimulatorRuntimeState) => Promise<void>;
  restoreDefaultSimulatorState: (args?: RestoreSimulatorArgs) => Promise<void>;
}

function createProvider(kind: SourceKind, inputMode: InputMode): DeviceProvider {
  if (kind === 'Serial' || kind === 'Simulator') {
    return new NativeBsDeviceProvider(kind, inputMode);
  }
  if (kind === 'Tindeq') {
    return new TindeqDeviceProvider();
  }

  throw new Error('BLE_UART is reserved for TARGET_XIAO_BLE_HX711 and is not implemented in web yet.');
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  sourceKind: loadSettings().preferredSource,
  connectionState: 'idle',
  connected: false,
  statusMessages: [],
  provider: null,
  activeDevice: null,
  scannedDevices: [],

  setSourceKind: (kind) => set({ sourceKind: kind }),

  setConnectionState: (connectionState, device) => set(state => ({
    connectionState,
    connected: connectionState === 'connected',
    activeDevice: device === undefined
      ? state.activeDevice
      : connectionState === 'idle'
        ? null
        : device,
  })),

  setProvider: (provider) => set({ provider }),

  setConnectedDevice: (activeDevice) => set({ activeDevice }),

  setScannedDevices: (scannedDevices) => set({ scannedDevices }),

  addStatus: (msg) => set(state => ({
    statusMessages: [...state.statusMessages.slice(-99), msg],
  })),

  createProvider: (kind, inputMode) => createProvider(kind, inputMode),

  scanDevices: async (inputMode) => {
    const state = get();
    const provider = state.provider?.sourceKind === state.sourceKind
      ? state.provider
      : createProvider(state.sourceKind, inputMode);

    const devices = await provider.scanDevices();
    set({
      provider,
      scannedDevices: devices,
    });
    return devices;
  },

  sendCommand: async (cmd) => {
    const provider = get().provider;
    if (!provider?.sendCommand) return false;
    return provider.sendCommand(cmd);
  },

  sendDeviceCommand: async (cmd) => {
    const provider = get().provider;
    if (!provider) return false;
    if (cmd.kind === 'tare') {
      await provider.tare();
      return true;
    }
    if (!provider.sendDeviceCommand) return false;
    return provider.sendDeviceCommand(cmd);
  },

  tare: async () => {
    const provider = get().provider;
    if (!provider) return;
    await provider.tare();
  },

  startStreaming: async () => {
    const provider = get().provider;
    if (!provider) return;
    await provider.startStreaming();
  },

  stopStreaming: async () => {
    const provider = get().provider;
    if (!provider) return;
    await provider.stopStreaming();
  },

  getBatteryStatus: async () => {
    const provider = get().provider;
    if (!provider) return null;
    return provider.getBatteryStatus();
  },

  setInputMode: async (inputMode) => {
    const state = get();
    const provider = state.provider;
    if (!provider?.setInputMode) return;
    if (state.connected) {
      useVerificationStore.getState().noteRequestedStreamMode(streamModeForInputMode(inputMode));
    }
    await provider.setInputMode(inputMode);
  },

  setSimulatorState: async (state) => {
    const provider = get().provider;
    if (!provider?.setSimulatorState) return;
    await provider.setSimulatorState(state);
  },

  restoreDefaultSimulatorState: async (args) => {
    const provider = get().provider;
    if (!provider?.restoreDefaultSimulatorState) return;
    await provider.restoreDefaultSimulatorState(args);
  },
}));
