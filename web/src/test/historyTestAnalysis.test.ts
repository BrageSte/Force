import { describe, expect, it } from 'vitest'
import {
  findOppositeHandHistoryResult,
  oppositeHandDeltaPct,
  orderHistoryTestResults,
  resolveSelectedHistoryTestResult,
  sameProtocolHistoryCount,
} from '../components/history/historyTestAnalysis.ts'
import type { CompletedTestResult } from '../components/test/types.ts'

function mockResult(
  resultId: string,
  hand: 'Left' | 'Right',
  completedAtIso: string,
  protocolId = 'standard_max',
  peak = 30,
): CompletedTestResult {
  return {
    resultId,
    hand,
    completedAtIso,
    protocolId,
    protocolKind: 'builtin',
    attempts: [
      {
        attemptNo: 1,
        core: {
          peakTotalKg: peak,
        },
      },
    ],
  } as CompletedTestResult
}

describe('history test analysis helpers', () => {
  it('orders results newest first and falls back to the latest selection', () => {
    const older = mockResult('older', 'Left', '2026-03-10T10:00:00.000Z')
    const newer = mockResult('newer', 'Right', '2026-03-12T10:00:00.000Z')

    const ordered = orderHistoryTestResults([older, newer])

    expect(ordered.map(result => result.resultId)).toEqual(['newer', 'older'])
    expect(resolveSelectedHistoryTestResult([older, newer], null)?.resultId).toBe('newer')
    expect(resolveSelectedHistoryTestResult([older, newer], 'older')?.resultId).toBe('older')
  })

  it('finds the opposite hand result for the same protocol and reports delta', () => {
    const left = mockResult('left', 'Left', '2026-03-10T10:00:00.000Z', 'standard_max', 30)
    const right = mockResult('right', 'Right', '2026-03-11T10:00:00.000Z', 'standard_max', 24)
    const otherProtocol = mockResult('other', 'Right', '2026-03-12T10:00:00.000Z', 'explosive_pull', 20)

    const opposite = findOppositeHandHistoryResult([left, right, otherProtocol], left)

    expect(opposite?.resultId).toBe('right')
    expect(sameProtocolHistoryCount([left, right, otherProtocol], left)).toBe(2)
    expect(oppositeHandDeltaPct(left, opposite)).toBeCloseTo(25)
  })
})
