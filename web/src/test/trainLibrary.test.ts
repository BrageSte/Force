import { describe, expect, it } from 'vitest'
import { getTrainProtocolById, TRAIN_LIBRARY } from '../components/train/trainLibrary.ts'
import { formatGripSpec } from '../components/train/trainUtils.ts'

describe('train preset library', () => {
  it('includes the built-in workout engine presets with benchmark-linked structure', () => {
    expect(TRAIN_LIBRARY).toHaveLength(7)

    const strength = getTrainProtocolById('strength_10s')
    expect(strength.tier).toBe('Core')
    expect(strength.blocks[1]).toMatchObject({
      phase: 'main',
      setCount: 2,
      repsPerSet: 3,
      hangSec: 10,
      restBetweenRepsSec: 120,
    })
    expect(strength.targetLogic.percent).toBeCloseTo(0.85)

    const repeated = getTrainProtocolById('repeated_strength_7_53')
    expect(repeated.tier).toBe('Advanced')
    expect(repeated.blocks[1]).toMatchObject({
      setCount: 3,
      repsPerSet: 3,
      hangSec: 7,
      restBetweenRepsSec: 53,
      restBetweenSetsSec: 180,
    })

    const accessory = getTrainProtocolById('finger_bias_accessory')
    expect(accessory.tier).toBe('Advanced')
    expect(accessory.recommendationTags).toContain('weak_finger')
    expect(formatGripSpec(accessory.gripType, accessory.modality)).toContain('ergonomic block')
  })
})
