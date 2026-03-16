import { type Hand, type ProfileSnapshot } from '@krimblokk/core';
import { analyzeCompletedTest } from '../testAnalysis.ts';
import { buildCompareTags } from '../testProtocolUtils.ts';
import type { AttemptSample, CompletedTestResult, LivePanelId, TestProtocol } from '../types.ts';
import type { ConnectedDeviceInfo } from '../../../types/force.ts';
import { bestPeakOfAttempts } from './liveCapture.ts';

interface BuildCompletedResultsArgs {
  protocol: TestProtocol;
  hand: Hand;
  secondaryHand: Hand;
  alternateHands: boolean;
  targetKg: number | null;
  oppositeHandBestPeakKg: number | null;
  profile: ProfileSnapshot | null;
  device: ConnectedDeviceInfo;
  visibleLivePanels: LivePanelId[];
  attemptsByHand: Record<Hand, AttemptSample[][]>;
  startedAtIsoByHand: Record<Hand, string>;
  completed?: boolean;
}

export function buildCompletedResults({
  protocol,
  hand,
  secondaryHand,
  alternateHands,
  targetKg,
  oppositeHandBestPeakKg,
  profile,
  device,
  visibleLivePanels,
  attemptsByHand,
  startedAtIsoByHand,
  completed,
}: BuildCompletedResultsArgs): CompletedTestResult | CompletedTestResult[] {
  // Guided capture stores per-finger data in canonical anatomical order for both
  // hands, so result assembly must not re-map fingers here.
  const sessionId = crypto.randomUUID();
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
      deviceType: device.deviceType,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      sampleSource: device.sourceKind,
      protocolVersion: 1,
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

  primaryResult.sessionId = sessionId;
  if (completed !== undefined) primaryResult.completed = completed;

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
      deviceType: device.deviceType,
      deviceName: device.deviceName,
      capabilities: device.capabilities,
      sampleSource: device.sourceKind,
      protocolVersion: 1,
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

  secondaryResult.sessionId = sessionId;
  if (completed !== undefined) secondaryResult.completed = completed;

  return [primaryResult, secondaryResult];
}
