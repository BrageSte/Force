import { bestPeakOfResult } from '../test/testAnalysis.ts';
import type { CompletedTestResult } from '../test/types.ts';

export function orderHistoryTestResults(results: CompletedTestResult[]): CompletedTestResult[] {
  return [...results].sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso));
}

export function resolveSelectedHistoryTestResult(
  results: CompletedTestResult[],
  selectedResultId: string | null,
): CompletedTestResult | null {
  const ordered = orderHistoryTestResults(results);
  if (ordered.length === 0) return null;
  return ordered.find(result => result.resultId === selectedResultId) ?? ordered[0];
}

export function findOppositeHandHistoryResult(
  results: CompletedTestResult[],
  selectedResult: CompletedTestResult | null,
): CompletedTestResult | null {
  if (!selectedResult) return null;

  const ordered = orderHistoryTestResults(results);
  return ordered.find(result => {
    if (result.resultId === selectedResult.resultId) return false;
    if (result.hand === selectedResult.hand) return false;

    if (selectedResult.protocolKind === 'custom' && selectedResult.templateId) {
      return result.templateId === selectedResult.templateId;
    }

    return result.protocolId === selectedResult.protocolId;
  }) ?? null;
}

export function sameProtocolHistoryCount(
  results: CompletedTestResult[],
  selectedResult: CompletedTestResult | null,
): number {
  if (!selectedResult) return 0;
  return results.filter(result => {
    if (selectedResult.protocolKind === 'custom' && selectedResult.templateId) {
      return result.templateId === selectedResult.templateId;
    }
    return result.protocolId === selectedResult.protocolId;
  }).length;
}

export function oppositeHandDeltaPct(
  selectedResult: CompletedTestResult | null,
  oppositeResult: CompletedTestResult | null,
): number | null {
  if (!selectedResult || !oppositeResult) return null;
  const selectedPeak = bestPeakOfResult(selectedResult);
  const oppositePeak = bestPeakOfResult(oppositeResult);
  if (oppositePeak <= 1e-9) return null;
  return ((selectedPeak - oppositePeak) / oppositePeak) * 100;
}
