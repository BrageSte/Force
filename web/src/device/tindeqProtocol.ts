export const TINDEQ_SERVICE_UUID = '7e4e1701-1ea6-40c9-9dcc-13d34ffead57';
export const TINDEQ_DATA_CHAR_UUID = '7e4e1702-1ea6-40c9-9dcc-13d34ffead57';
export const TINDEQ_CONTROL_CHAR_UUID = '7e4e1703-1ea6-40c9-9dcc-13d34ffead57';
export const TINDEQ_NAME_PREFIX = 'Progressor';

export const TINDEQ_COMMANDS = {
  tare: 0x64,
  startWeightMeasurement: 0x65,
  stopWeightMeasurement: 0x66,
  shutdown: 0x6e,
  sampleBatteryVoltage: 0x6f,
} as const;

export const TINDEQ_RESPONSES = {
  batteryVoltage: 0x00,
  weightMeasurement: 0x01,
  lowPowerWarning: 0x04,
} as const;

export interface TindeqWeightSample {
  weightKg: number;
  timestampUs: number;
}

export type TindeqNotification =
  | {
      kind: 'battery_voltage';
      batteryMv: number;
    }
  | {
      kind: 'weight_measurement';
      samples: TindeqWeightSample[];
    }
  | {
      kind: 'low_power_warning';
    };

export class TindeqProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TindeqProtocolError';
  }
}

function toUint8Array(payload: Uint8Array | ArrayBuffer | DataView): Uint8Array {
  if (payload instanceof Uint8Array) return payload;
  if (payload instanceof DataView) {
    return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  return new Uint8Array(payload);
}

export function encodeTindeqCommand(opcode: number, payload?: Uint8Array): Uint8Array {
  const value = payload ?? new Uint8Array(0);
  const out = new Uint8Array(2 + value.length);
  out[0] = opcode;
  out[1] = value.length;
  out.set(value, 2);
  return out;
}

export function parseTindeqNotification(payload: Uint8Array | ArrayBuffer | DataView): TindeqNotification {
  const bytes = toUint8Array(payload);
  if (bytes.length < 2) {
    throw new TindeqProtocolError('Progressor payload is too short to contain a TLV header.');
  }

  const responseCode = bytes[0];
  const declaredLength = bytes[1];
  const value = bytes.slice(2);

  if (value.length !== declaredLength) {
    throw new TindeqProtocolError(
      `Progressor payload length mismatch: declared ${declaredLength}, received ${value.length}.`,
    );
  }

  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);

  if (responseCode === TINDEQ_RESPONSES.batteryVoltage) {
    if (value.length !== 4) {
      throw new TindeqProtocolError('Battery voltage response must contain exactly 4 payload bytes.');
    }
    return {
      kind: 'battery_voltage',
      batteryMv: view.getUint32(0, true),
    };
  }

  if (responseCode === TINDEQ_RESPONSES.weightMeasurement) {
    if (value.length === 0 || value.length % 8 !== 0) {
      throw new TindeqProtocolError('Weight measurement payload must contain one or more 8-byte samples.');
    }

    const samples: TindeqWeightSample[] = [];
    for (let offset = 0; offset < value.length; offset += 8) {
      samples.push({
        weightKg: view.getFloat32(offset, true),
        timestampUs: view.getUint32(offset + 4, true),
      });
    }

    return {
      kind: 'weight_measurement',
      samples,
    };
  }

  if (responseCode === TINDEQ_RESPONSES.lowPowerWarning) {
    if (value.length !== 0) {
      throw new TindeqProtocolError('Low-power warning should not include a payload.');
    }
    return { kind: 'low_power_warning' };
  }

  throw new TindeqProtocolError(`Unsupported Progressor response code 0x${responseCode.toString(16)}.`);
}
