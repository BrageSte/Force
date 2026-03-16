import { describe, expect, it } from 'vitest'
import { KG_TO_N } from '../types/force.ts'
import { TindeqDeviceProvider } from '../device/TindeqDeviceProvider.ts'
import { defaultConnectedDevice } from '../device/deviceProfiles.ts'
import {
  parseTindeqNotification,
  TINDEQ_RESPONSES,
} from '../device/tindeqProtocol.ts'

type TindeqProviderHarness = {
  handleNotification: (event: BluetoothCharacteristicValueChangedEvent) => void
  handleDisconnected: () => void
  device: {
    removeEventListener: () => void
    addEventListener: () => void
    gatt: null
  } | null
  shouldReconnect: boolean
  connectedDevice: ReturnType<typeof defaultConnectedDevice> | null
  reconnectAttempts: number
}

function asHarness(provider: TindeqDeviceProvider): TindeqProviderHarness {
  return provider as unknown as TindeqProviderHarness
}

function makeNotificationEvent(payload: Uint8Array): BluetoothCharacteristicValueChangedEvent {
  return {
    target: {
      value: new DataView(payload.buffer),
    },
  } as unknown as BluetoothCharacteristicValueChangedEvent
}

function makeBatteryPayload(batteryMv: number): Uint8Array {
  const payload = new Uint8Array(6)
  payload[0] = TINDEQ_RESPONSES.batteryVoltage
  payload[1] = 4
  new DataView(payload.buffer).setUint32(2, batteryMv, true)
  return payload
}

function makeWeightPayload(samples: Array<{ weightKg: number; timestampUs: number }>): Uint8Array {
  const payload = new Uint8Array(2 + samples.length * 8)
  payload[0] = TINDEQ_RESPONSES.weightMeasurement
  payload[1] = samples.length * 8
  const view = new DataView(payload.buffer)
  samples.forEach((sample, index) => {
    const offset = 2 + index * 8
    view.setFloat32(offset, sample.weightKg, true)
    view.setUint32(offset + 4, sample.timestampUs, true)
  })
  return payload
}

describe('tindeq protocol adapter', () => {
  it('parses battery notifications', () => {
    expect(parseTindeqNotification(makeBatteryPayload(3980))).toEqual({
      kind: 'battery_voltage',
      batteryMv: 3980,
    })
  })

  it('parses multi-sample weight notifications', () => {
    const notification = parseTindeqNotification(makeWeightPayload([
      { weightKg: 12.5, timestampUs: 1000 },
      { weightKg: 13.25, timestampUs: 26000 },
    ]))

    expect(notification.kind).toBe('weight_measurement')
    if (notification.kind !== 'weight_measurement') return
    expect(notification.samples).toEqual([
      { weightKg: 12.5, timestampUs: 1000 },
      { weightKg: 13.25, timestampUs: 26000 },
    ])
  })

  it('rejects malformed TLV lengths', () => {
    const payload = new Uint8Array([TINDEQ_RESPONSES.weightMeasurement, 8, 1, 2, 3])
    expect(() => parseTindeqNotification(payload)).toThrow('length mismatch')
  })
})

describe('tindeq provider', () => {
  it('normalizes notifications into total-force-only samples', () => {
    const provider = new TindeqDeviceProvider()
    const harness = asHarness(provider)
    const frames: unknown[] = []
    provider.onForceData = frame => frames.push(frame)

    harness.handleNotification(makeNotificationEvent(makeWeightPayload([
      { weightKg: 12.5, timestampUs: 1000 },
      { weightKg: 13.25, timestampUs: 26000 },
    ])))

    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({
      kind: 'force',
      sample: {
        source: 'tindeq',
        raw: null,
        kg: null,
        totalKg: 12.5,
        totalN: 12.5 * KG_TO_N,
        tMs: 0,
      },
    })
    expect(frames[1]).toMatchObject({
      kind: 'force',
      sample: {
        totalKg: 13.25,
        tMs: 25,
      },
    })
  })

  it('surfaces malformed payload errors', () => {
    const provider = new TindeqDeviceProvider()
    const harness = asHarness(provider)
    const errors: string[] = []
    provider.onError = error => errors.push(error.code)

    harness.handleNotification(
      makeNotificationEvent(new Uint8Array([TINDEQ_RESPONSES.weightMeasurement, 8, 1, 2, 3])),
    )

    expect(errors).toContain('malformed_payload')
  })

  it('handles disconnect and reconnect-failure states', () => {
    const provider = new TindeqDeviceProvider()
    const harness = asHarness(provider)
    const states: string[] = []
    const errors: string[] = []
    provider.onConnectionStateChange = state => states.push(state)
    provider.onError = error => errors.push(error.code)

    harness.device = {
      removeEventListener() {},
      addEventListener() {},
      gatt: null,
    }

    harness.shouldReconnect = false
    harness.handleDisconnected()
    expect(states.at(-1)).toBe('idle')

    harness.connectedDevice = defaultConnectedDevice('Tindeq')
    harness.shouldReconnect = true
    harness.reconnectAttempts = 1
    harness.handleDisconnected()
    expect(errors).toContain('reconnect_failure')
    expect(states.at(-1)).toBe('error')
  })
})
