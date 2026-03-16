import { describe, expect, it } from 'vitest'
import { buildAttemptSampleFromMeasuredFrame, polylinePathFromCoordinates } from '../components/test/guided/liveCapture.ts'
import type { TestProtocol } from '../components/test/types.ts'

const protocol: TestProtocol = {
  protocolKind: 'builtin',
  id: 'test_protocol',
  name: 'Test Protocol',
  shortName: 'Test',
  tier: 'Core',
  category: 'max_strength',
  family: 'max_pull',
  athleteLevel: 'intermediate',
  gripType: 'edge',
  modality: 'edge',
  supportMode: 'metadata_only',
  purpose: 'test',
  effortType: 'pull',
  durationSec: 5,
  attemptCount: 1,
  countdownSec: 3,
  restSec: 0,
  guidance: [],
  outputs: [],
  handMode: 'current_hand',
  targetMode: 'none',
  targetIntensityLogic: 'Free pull for capture validation.',
  stopConditions: [],
  capabilityRequirements: {
    requiresTotalForce: true,
    requiresPerFingerForce: false,
  },
  warmup: [],
  cooldown: [],
  scoringModel: 'None',
  progressionRule: 'None',
  reportRelativeToBodyweight: false,
  livePanels: [],
  resultWidgets: [],
}

describe('guided test capture', () => {
  it('keeps low-force onset values from measured state even when the display would flatten them', () => {
    const sample = buildAttemptSampleFromMeasuredFrame(
      80,
      {
        latestMeasuredTotalKg: 0.35,
        latestMeasuredKg: [0.1, 0.1, 0.1, 0.05],
        latestMeasuredPct: [28.57, 28.57, 28.57, 14.29],
      },
      protocol,
    )

    expect(sample.totalKg).toBeCloseTo(0.35)
    expect(sample.fingerKg).toEqual([0.1, 0.1, 0.1, 0.05])
    expect(sample.fingerPct[0]).toBeGreaterThan(0)
  })

  it('maps weight to x and time to y for the rotated live trace', () => {
    const points = polylinePathFromCoordinates(
      [0, 2, 4],
      [0, 500, 1000],
      100,
      200,
      4,
      1000,
    )

    expect(points).toBe('0.0,0.0 50.0,100.0 100.0,200.0')
  })
})
