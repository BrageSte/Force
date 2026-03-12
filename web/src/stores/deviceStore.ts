import { create } from 'zustand';
import type { DataSource } from '../types/device.ts';
import type { InputMode, SourceKind } from '../types/settings.ts';
import { SimulatedSource } from '../device/SimulatedSource.ts';
import { WebSerialSource } from '../device/WebSerialSource.ts';
import { loadSettings } from '../storage/settingsStore.ts';
import { serializeDeviceCommand, type DeviceCommand } from '@krimblokk/core';

interface DeviceState {
  sourceKind: SourceKind;
  connected: boolean;
  statusMessages: string[];
  source: DataSource | null;

  setSourceKind: (kind: SourceKind) => void;
  setConnected: (c: boolean) => void;
  addStatus: (msg: string) => void;
  createSource: (kind: SourceKind, inputMode: InputMode) => DataSource;
  setSource: (source: DataSource | null) => void;
  sendCommand: (cmd: string) => void;
  sendDeviceCommand: (cmd: DeviceCommand) => void;
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
  sourceKind: loadSettings().preferredSource,
  connected: false,
  statusMessages: [],
  source: null,

  setSourceKind: (kind) => set({ sourceKind: kind }),
  setConnected: (c) => set({ connected: c }),
  addStatus: (msg) => set(s => ({
    statusMessages: [...s.statusMessages.slice(-99), msg],
  })),
  createSource: (kind, inputMode) => {
    if (kind === 'Serial') return new WebSerialSource(115200, inputMode);
    if (kind === 'Simulator') return new SimulatedSource(inputMode === 'MODE_RAW' ? 'raw' : 'kg');
    throw new Error('BLE_UART is not implemented in web yet. Use Serial or Simulator.');
  },
  setSource: (source) => set({ source }),
  sendCommand: (cmd) => {
    const s = get().source;
    if (s?.sendCommand) s.sendCommand(cmd);
  },
  sendDeviceCommand: (cmd) => {
    const source = get().source;
    if (source?.sendCommand) {
      source.sendCommand(serializeDeviceCommand(cmd));
    }
  },
}));
