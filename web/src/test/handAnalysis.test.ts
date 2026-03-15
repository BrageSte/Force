import { describe, expect, it } from 'vitest'
import {
  availableAnalysisHandViews,
  buildAnalysisHandContext,
  defaultAnalysisHandView,
  normalizeAnalysisHandView,
  resultForAnalysisHand,
} from '../components/test/handAnalysis.ts'
import type { CompletedTestResult } from '../components/test/types.ts'

function mockResult(resultId: string, hand: 'Left' | 'Right'): CompletedTestResult {
  return {
    resultId,
    hand,
  } as CompletedTestResult
}

describe('test result hand analysis selection', () => {
  it('resolves left, right, and both when both hand results are available', () => {
    const rightResult = mockResult('right-1', 'Right')
    const leftResult = mockResult('left-1', 'Left')

    const context = buildAnalysisHandContext(rightResult, leftResult)

    expect(context.leftResult?.resultId).toBe('left-1')
    expect(context.rightResult?.resultId).toBe('right-1')
    expect(context.currentView).toBe('right')
    expect(availableAnalysisHandViews(context)).toEqual(['left', 'right', 'both'])
    expect(defaultAnalysisHandView(context)).toBe('right')
    expect(normalizeAnalysisHandView('both', context)).toBe('both')
    expect(resultForAnalysisHand('left', context)?.resultId).toBe('left-1')
    expect(resultForAnalysisHand('right', context)?.resultId).toBe('right-1')
  })

  it('falls back to the available hand when the requested view is missing', () => {
    const leftResult = mockResult('left-1', 'Left')
    const context = buildAnalysisHandContext(leftResult, null)

    expect(availableAnalysisHandViews(context)).toEqual(['left'])
    expect(defaultAnalysisHandView(context)).toBe('left')
    expect(normalizeAnalysisHandView('right', context)).toBe('left')
    expect(normalizeAnalysisHandView('both', context)).toBe('left')
    expect(resultForAnalysisHand('left', context)?.resultId).toBe('left-1')
  })
})
