import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeAppSettings, normalizeCalibrationData } from '../types/settings.ts'

describe('settings normalization', () => {
  it('migrates invalid values to safe defaults', () => {
    const migrated = normalizeAppSettings({
      inputMode: 'MODE_RAW',
      preferredSource: 'invalid',
      handDefault: 'Left',
      smoothingMode: 'EMA',
      ringBufferSeconds: 2,
      calibration: {
        offsets: [1, 2, 3],
        scales: [0.1, 0.2, 0.3, -1],
      },
    })

    expect(migrated.inputMode).toBe('MODE_RAW')
    expect(migrated.preferredSource).toBe('Serial')
    expect(migrated.handDefault).toBe('Left')
    expect(migrated.ringBufferSeconds).toBe(15)
    expect(migrated.calibration.offsets).toEqual([0, 0, 0, 0])
    expect(migrated.calibration.scales).toEqual([0.1, 0.2, 0.3, 0])
  })

  it('normalizes nested calibration arrays without mutating defaults', () => {
    const calibration = normalizeCalibrationData({
      offsets: [10, 20, 30, 40],
      scales: [0.00001, 0.00002, '0.00003', 0.00004],
    })

    expect(calibration.offsets).toEqual([10, 20, 30, 40])
    expect(calibration.scales).toEqual([0.00001, 0.00002, 0.00003, 0.00004])
    expect(DEFAULT_SETTINGS.calibration.offsets).toEqual([0, 0, 0, 0])
  })
})
