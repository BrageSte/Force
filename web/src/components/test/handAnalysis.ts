import type { CompletedTestResult } from './types.ts';

export type AnalysisHandView = 'left' | 'right' | 'both';

export interface AnalysisHandContext {
  leftResult: CompletedTestResult | null;
  rightResult: CompletedTestResult | null;
  currentView: Exclude<AnalysisHandView, 'both'> | null;
}

function slotResultByHand(
  result: CompletedTestResult | null,
  slot: CompletedTestResult | null,
  hand: 'Left' | 'Right',
): CompletedTestResult | null {
  if (!result || result.hand !== hand) return slot;
  return slot ?? result;
}

export function buildAnalysisHandContext(
  currentResult: CompletedTestResult | null,
  oppositeResult: CompletedTestResult | null,
): AnalysisHandContext {
  const leftResult = slotResultByHand(oppositeResult, slotResultByHand(currentResult, null, 'Left'), 'Left');
  const rightResult = slotResultByHand(oppositeResult, slotResultByHand(currentResult, null, 'Right'), 'Right');

  return {
    leftResult,
    rightResult,
    currentView:
      currentResult?.hand === 'Left'
        ? 'left'
        : currentResult?.hand === 'Right'
          ? 'right'
          : null,
  };
}

export function availableAnalysisHandViews(context: AnalysisHandContext): AnalysisHandView[] {
  const views: AnalysisHandView[] = [];
  if (context.leftResult) views.push('left');
  if (context.rightResult) views.push('right');
  if (context.leftResult && context.rightResult) views.push('both');
  return views;
}

export function defaultAnalysisHandView(context: AnalysisHandContext): AnalysisHandView {
  if (context.currentView === 'left' && context.leftResult) return 'left';
  if (context.currentView === 'right' && context.rightResult) return 'right';
  if (context.leftResult) return 'left';
  if (context.rightResult) return 'right';
  return 'left';
}

export function normalizeAnalysisHandView(
  view: AnalysisHandView,
  context: AnalysisHandContext,
): AnalysisHandView {
  if (view === 'both' && context.leftResult && context.rightResult) return 'both';
  if (view === 'left' && context.leftResult) return 'left';
  if (view === 'right' && context.rightResult) return 'right';
  return defaultAnalysisHandView(context);
}

export function resultForAnalysisHand(
  view: Exclude<AnalysisHandView, 'both'>,
  context: AnalysisHandContext,
): CompletedTestResult | null {
  return view === 'left' ? context.leftResult : context.rightResult;
}
