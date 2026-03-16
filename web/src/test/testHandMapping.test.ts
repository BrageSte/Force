import { describe, expect, it } from 'vitest'
import { buildCompletedResults } from '../components/test/guided/resultAssembly.ts'
import { getProtocolById } from '../components/test/testLibrary.ts'
import type { AttemptSample, CompletedTestResult } from '../components/test/types.ts'
import { defaultConnectedDevice } from '../device/deviceProfiles.ts'

function sample(tMs: number, fingerKg: [number, number, number, number]): AttemptSample {
  const totalKg = fingerKg[0] + fingerKg[1] + fingerKg[2] + fingerKg[3]
  const fingerPct: [number, number, number, number] = totalKg > 0
    ? [
        (fingerKg[0] / totalKg) * 100,
        (fingerKg[1] / totalKg) * 100,
        (fingerKg[2] / totalKg) * 100,
        (fingerKg[3] / totalKg) * 100,
      ]
    : [0, 0, 0, 0]

  return {
    tMs,
    totalKg,
    fingerKg,
    fingerPct,
  }
}

function asArray(result: CompletedTestResult | CompletedTestResult[]): CompletedTestResult[] {
  return Array.isArray(result) ? result : [result]
}

describe('guided test hand mapping', () => {
  it('preserves canonical finger indices for a left-hand result', () => {
    const protocol = getProtocolById('standard_max')
    const leftAttempt = [
      sample(0, [12, 6, 4, 2]),
      sample(100, [11, 5, 3, 2]),
      sample(200, [10, 5, 3, 1]),
    ]

    const [result] = asArray(buildCompletedResults({
      protocol,
      hand: 'Left',
      secondaryHand: 'Right',
      alternateHands: false,
      targetKg: null,
      oppositeHandBestPeakKg: null,
      profile: null,
      device: defaultConnectedDevice('Serial'),
      visibleLivePanels: protocol.livePanels,
      attemptsByHand: {
        Left: [leftAttempt],
        Right: [],
      },
      startedAtIsoByHand: {
        Left: '2026-03-14T10:00:00.000Z',
        Right: '',
      },
    }))

    expect(result.hand).toBe('Left')
    expect(result.attempts[0]?.samples[0]?.fingerKg).toEqual([12, 6, 4, 2])
    expect(result.summary.strongestFinger).toBe(0)
    expect(result.summary.weakestContributor).toBe(3)
  })

  it('keeps alternate-hand results in canonical order without cross-hand flipping', () => {
    const protocol = getProtocolById('standard_max')
    const leftAttempt = [
      sample(0, [12, 6, 4, 2]),
      sample(100, [11, 5, 3, 2]),
    ]
    const rightAttempt = [
      sample(0, [3, 5, 8, 12]),
      sample(100, [2, 5, 7, 10]),
    ]

    const results = asArray(buildCompletedResults({
      protocol,
      hand: 'Left',
      secondaryHand: 'Right',
      alternateHands: true,
      targetKg: null,
      oppositeHandBestPeakKg: null,
      profile: null,
      device: defaultConnectedDevice('Serial'),
      visibleLivePanels: protocol.livePanels,
      attemptsByHand: {
        Left: [leftAttempt],
        Right: [rightAttempt],
      },
      startedAtIsoByHand: {
        Left: '2026-03-14T10:00:00.000Z',
        Right: '2026-03-14T10:10:00.000Z',
      },
    }))

    const leftResult = results.find(result => result.hand === 'Left')
    const rightResult = results.find(result => result.hand === 'Right')

    expect(leftResult?.summary.strongestFinger).toBe(0)
    expect(rightResult?.summary.strongestFinger).toBe(3)
    expect(leftResult?.attempts[0]?.samples[0]?.fingerKg).toEqual([12, 6, 4, 2])
    expect(rightResult?.attempts[0]?.samples[0]?.fingerKg).toEqual([3, 5, 8, 12])
    expect(leftResult?.summary.leftRightAsymmetryPct).toBeCloseTo(((24 - 28) / 28) * 100)
    expect(rightResult?.summary.leftRightAsymmetryPct).toBeCloseTo(((28 - 24) / 24) * 100)
  })
})
