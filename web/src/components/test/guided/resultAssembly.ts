import { type Hand, type ProfileSnapshot } from '@krimblokk/core';
import { analyzeCompletedTest } from '../testAnalysis.ts';
import { buildCompareTags } from '../testProtocolUtils.ts';
import type { AttemptSample, CompletedTestResult, LivePanelId, TestProtocol } from '../types.ts';
import { bestPeakOfAttempts } from './liveCapture.ts';

interface BuildCompletedResultsArgs {
  protocol: TestProtocol;
  hand: Hand;
  secondaryHand: Hand;
  alternateHands: boolean;
  targetKg: number | null;
  oppositeHandBestPeakKg: number | null;
  profile: ProfileSnapshot | null;
  visibleLivePanels: LivePanelId[];
  attemptsByHand: Record<Hand, AttemptSample[][]>;
  startedAtIsoByHand: Record<Hand, string>;
}

export function buildCompletedResults({
  protocol,
  hand,
  secondaryHand,
  alternateHands,
  targetKg,
  oppositeHandBestPeakKg,
  profile,
  visibleLivePanels,
  attemptsByHand,
  startedAtIsoByHand,
}: BuildCompletedResultsArgs): CompletedTestResult | CompletedTestResult[] {
  const primaryAttempts = attemptsByHand[hand];
  const secondaryAttempts = attemptsByHand[secondaryHand];
  const primaryOppositeBest = alternateHands
    ? bestPeakOfAttempts(secondaryAttempts) ?? oppositeHandBestPeakKg
    : oppositeHandBestPeakKg;

  const primaryResult = analyzeCompletedTest(
    protocol,
    hand,
    startedAtIsoByHand[hand] || new Date().toISOString(),
    primaryAttempts,
    targetKg,
    {
      oppositeHandBestPeakKg: primaryOppositeBest,
      profile,
      dashboardSnapshot: {
        livePanels: visibleLivePanels,
        resultWidgets: protocol.resultWidgets,
        compareDefaults: protocol.compareDefaults,
      },
      compareTags: buildCompareTags(
        protocol.family,
        protocol.targetMode,
        Boolean(protocol.repeater),
        protocol.templateId ? { id: protocol.templateId, name: protocol.name } : undefined,
      ),
    },
  );

  if (!alternateHands || secondaryAttempts.length === 0) {
    return primaryResult;
  }

  const secondaryResult = analyzeCompletedTest(
    protocol,
    secondaryHand,
    startedAtIsoByHand[secondaryHand] || new Date().toISOString(),
    secondaryAttempts,
    targetKg,
    {
      oppositeHandBestPeakKg: bestPeakOfAttempts(primaryAttempts),
      profile,
      dashboardSnapshot: {
        livePanels: visibleLivePanels,
        resultWidgets: protocol.resultWidgets,
        compareDefaults: protocol.compareDefaults,
      },
      compareTags: buildCompareTags(
        protocol.family,
        protocol.targetMode,
        Boolean(protocol.repeater),
        protocol.templateId ? { id: protocol.templateId, name: protocol.name } : undefined,
      ),
    },
  );

  return [primaryResult, secondaryResult];
}
