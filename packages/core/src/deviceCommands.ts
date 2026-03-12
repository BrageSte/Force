import type { Finger4 } from './types.ts';
import type { InputMode } from './settings.ts';

export type DeviceStreamMode = 'raw' | 'kg';

export type DeviceCommand =
  | { kind: 'tare' }
  | { kind: 'print_debug' }
  | { kind: 'set_stream_mode'; mode: DeviceStreamMode }
  | { kind: 'calibrate_channel'; channel: 1 | 2 | 3 | 4; knownKg: number };

export function serializeDeviceCommand(command: DeviceCommand): string {
  switch (command.kind) {
    case 'tare':
      return 't';
    case 'print_debug':
      return 'p';
    case 'set_stream_mode':
      return `m ${command.mode}`;
    case 'calibrate_channel':
      return `c ${command.channel} ${command.knownKg}`;
  }
}

export function streamModeForInputMode(inputMode: InputMode): DeviceStreamMode {
  return inputMode === 'MODE_RAW' ? 'raw' : 'kg';
}

export function isLikelyRawCounts(values: Finger4, threshold = 250): boolean {
  return values.some(value => Math.abs(value) >= threshold);
}
