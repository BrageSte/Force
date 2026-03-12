import { FINGER_NAMES } from '../../constants/fingers.ts';
import { bestPeakOfResult } from './testAnalysis.ts';
import type { CompletedTestResult, TestId } from './types.ts';

type CoachingPriority = 'High' | 'Medium' | 'Low';

export interface AiCoachingFocusArea {
  id: string;
  title: string;
  priority: CoachingPriority;
  summary: string;
  action: string;
  evidence: string[];
}

export interface AiCoachingNextStep {
  protocolId: TestId;
  label: string;
  reason: string;
}

export interface AiCoachingReport {
  headline: string;
  overview: string;
  confidence: 'Moderate' | 'Low';
  focusAreas: AiCoachingFocusArea[];
  positives: string[];
  watchouts: string[];
  nextStep: AiCoachingNextStep;
}

interface FocusCandidate extends AiCoachingFocusArea {
  score: number;
}

const RECRUITMENT_FLOORS = [15, 15, 12, 10];

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatPct(value: number, digits = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function protocolLabel(protocolId: string): string {
  if (protocolId === 'distribution_hold') return 'Distribution Hold';
  if (protocolId === 'advanced_repeater') return 'Advanced Repeater';
  if (protocolId === 'explosive_pull') return 'Explosive Pull';
  return 'Standard Max Pull';
}

export function buildAiCoachingReport(
  currentResult: CompletedTestResult,
  history: CompletedTestResult[],
): AiCoachingReport {
  const attempts = currentResult.attempts;
  const bestPeak = bestPeakOfResult(currentResult);
  const avgBalance = mean(attempts.map(attempt => attempt.coaching.balanceScore));
  const avgEarlyLateDropPct = mean(attempts.map(attempt => attempt.core.earlyLateDropPct));
  const currentDateKey = currentResult.completedAtIso.slice(0, 10);

  const sameProtocolHistory = history
    .filter(result =>
      result.hand === currentResult.hand &&
      result.protocolId === currentResult.protocolId,
    )
    .sort((a, b) => a.completedAtIso.localeCompare(b.completedAtIso));
  const previousSameProtocol = sameProtocolHistory.filter(result => result.resultId !== currentResult.resultId);
  const lastSameProtocol = previousSameProtocol.at(-1) ?? null;
  const trendVsLastPct =
    lastSameProtocol && bestPeakOfResult(lastSameProtocol) > 1e-9
      ? ((bestPeak - bestPeakOfResult(lastSameProtocol)) / bestPeakOfResult(lastSameProtocol)) * 100
      : null;

  const oppositeHandReference = history
    .filter(result =>
      result.resultId !== currentResult.resultId &&
      result.protocolId === currentResult.protocolId &&
      result.hand !== currentResult.hand,
    )
    .sort((a, b) => b.completedAtIso.localeCompare(a.completedAtIso))[0] ?? null;

  const sameDayResults = history.filter(result =>
    result.hand === currentResult.hand &&
    result.completedAtIso.slice(0, 10) === currentDateKey,
  );

  const weakestFingerIdx = currentResult.summary.weakestContributor;
  const weakestFinger = FINGER_NAMES[weakestFingerIdx];
  const weakestShareAvg = mean(attempts.map(attempt => attempt.core.fingerShareAtPeakPct[weakestFingerIdx]));
  const weakestUnderFlags = attempts.filter(
    attempt => attempt.coaching.underRecruitmentFlags[weakestFingerIdx],
  ).length;

  const biggestFadeFingerIdx = currentResult.summary.biggestFadeFinger;
  const biggestFadeFinger = FINGER_NAMES[biggestFadeFingerIdx];
  const fadeFingerDriftAvg = mean(
    attempts.map(attempt => attempt.coaching.contributionDriftPct[biggestFadeFingerIdx]),
  );
  const asymmetryPct = currentResult.summary.leftRightAsymmetryPct;
  const explosive = attempts[0]?.experimental?.explosive;

  const focusCandidates: FocusCandidate[] = [];

  const recruitmentGap = RECRUITMENT_FLOORS[weakestFingerIdx] - weakestShareAvg;
  const recruitmentScore = clamp(recruitmentGap * 5 + weakestUnderFlags * 10, 0, 100);
  if (recruitmentScore >= 14) {
    focusCandidates.push({
      id: 'recruitment',
      title: `Build ${weakestFinger} recruitment`,
      priority: recruitmentScore >= 36 ? 'High' : recruitmentScore >= 22 ? 'Medium' : 'Low',
      summary:
        `${weakestFinger} averages ${weakestShareAvg.toFixed(1)}% of peak load, ` +
        `which suggests it is not contributing enough when total force climbs.`,
      action:
        'Bias the next block toward even-pressure holds and slower max pulls where you keep this finger engaged through the whole effort.',
      evidence: [
        `${weakestUnderFlags}/${attempts.length} attempts were flagged as under-recruited`,
        `Average share at peak: ${weakestShareAvg.toFixed(1)}%`,
      ],
      score: recruitmentScore,
    });
  }

  const fatigueScore = clamp(
    Math.max(0, -avgEarlyLateDropPct - 4) * 3 + Math.max(0, -currentResult.summary.sessionTrendPct - 3) * 2,
    0,
    100,
  );
  if (fatigueScore >= 15) {
    focusCandidates.push({
      id: 'fatigue',
      title: 'Improve fatigue resistance',
      priority: fatigueScore >= 34 ? 'High' : fatigueScore >= 22 ? 'Medium' : 'Low',
      summary:
        `You are losing force as the effort or test sequence continues, with ${biggestFadeFinger} fading the most late in the set.`,
      action:
        'Use repeaters or longer controlled holds and keep the first and last efforts within a tighter band before chasing more peak load.',
      evidence: [
        `Early-to-late change: ${avgEarlyLateDropPct.toFixed(1)}%`,
        `Session trend: ${formatPct(currentResult.summary.sessionTrendPct)}`,
        `${biggestFadeFinger} drift late in effort: ${formatPct(fadeFingerDriftAvg)}`,
      ],
      score: fatigueScore,
    });
  }

  const stabilityScore = clamp(
    Math.max(0, 78 - currentResult.summary.repeatabilityScore) * 1.8 + Math.max(0, 76 - avgBalance) * 1.1,
    0,
    100,
  );
  if (stabilityScore >= 14) {
    focusCandidates.push({
      id: 'stability',
      title: 'Stabilize force delivery',
      priority: stabilityScore >= 34 ? 'High' : stabilityScore >= 22 ? 'Medium' : 'Low',
      summary:
        'The strongest attempt is there, but the execution is moving around too much from rep to rep to make progression clean.',
      action:
        'Keep the same setup, ramp speed, and pull direction on every attempt until repeatability and finger balance tighten up.',
      evidence: [
        `Repeatability score: ${currentResult.summary.repeatabilityScore.toFixed(0)}/100`,
        `Average balance score: ${avgBalance.toFixed(0)}/100`,
      ],
      score: stabilityScore,
    });
  }

  if (asymmetryPct !== null && Math.abs(asymmetryPct) >= 6) {
    const asymmetryScore = clamp(Math.abs(asymmetryPct) * 2.2, 0, 100);
    focusCandidates.push({
      id: 'asymmetry',
      title: asymmetryPct < 0 ? 'Close the left/right gap' : 'Protect symmetry between hands',
      priority: asymmetryScore >= 34 ? 'High' : asymmetryScore >= 22 ? 'Medium' : 'Low',
      summary:
        asymmetryPct < 0
          ? `This hand is currently ${Math.abs(asymmetryPct).toFixed(1)}% behind the opposite hand on the same protocol.`
          : `This hand is ${asymmetryPct.toFixed(1)}% ahead of the opposite hand, which can turn into an avoidable imbalance if it keeps widening.`,
      action:
        'Run mirrored testing on both hands and let the weaker side set the control standard for loading and technical quality.',
      evidence: [
        `L/R asymmetry: ${formatPct(asymmetryPct)}`,
        `Opposite-hand reference: ${oppositeHandReference ? 'available' : 'older or missing'}`,
      ],
      score: asymmetryScore,
    });
  }

  if (currentResult.protocolId === 'explosive_pull' && explosive) {
    const explosiveScore = clamp(
      Math.max(0, ((explosive.timeTo90PctPeakMs ?? 0) - 650) / 12) +
      Math.max(0, 20 - explosive.firstSecondPeakKg),
      0,
      100,
    );
    if (explosiveScore >= 12) {
      focusCandidates.push({
        id: 'explosive',
        title: 'Express force faster',
        priority: explosiveScore >= 30 ? 'High' : explosiveScore >= 20 ? 'Medium' : 'Low',
        summary:
          'Peak force is arriving later than ideal, so part of the gain opportunity is in how quickly you can recruit into the pull.',
        action:
          'Keep a few fast singles in the week and start the pull more decisively while preserving the same finger distribution.',
        evidence: [
          `Time to 90% peak: ${explosive.timeTo90PctPeakMs?.toFixed(0) ?? '--'} ms`,
          `First-second peak: ${explosive.firstSecondPeakKg.toFixed(1)} kg`,
        ],
        score: explosiveScore,
      });
    }
  }

  focusCandidates.sort((a, b) => b.score - a.score);

  const focusAreas = focusCandidates.slice(0, 3).map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    priority: candidate.priority,
    summary: candidate.summary,
    action: candidate.action,
    evidence: candidate.evidence,
  }));

  if (focusAreas.length === 0) {
    focusAreas.push({
      id: 'maintain',
      title: 'Maintain a stable base',
      priority: 'Low',
      summary:
        'This result does not show one major bottleneck. The main goal now is to repeat the same quality while gradually nudging total force upward.',
      action:
        'Keep the same protocol rotation and use small load or execution changes rather than large swings in training stress.',
      evidence: [
        `Repeatability score: ${currentResult.summary.repeatabilityScore.toFixed(0)}/100`,
        `Best peak: ${bestPeak.toFixed(1)} kg`,
      ],
    });
  }

  const positives: string[] = [];
  if (trendVsLastPct !== null && trendVsLastPct >= 3) {
    positives.push(`Best peak is up ${trendVsLastPct.toFixed(1)}% versus the last ${currentResult.protocolName.toLowerCase()}.`);
  }
  if (currentResult.summary.repeatabilityScore >= 80) {
    positives.push(`Repeatability is strong at ${currentResult.summary.repeatabilityScore.toFixed(0)}/100.`);
  }
  if (avgBalance >= 80) {
    positives.push(`Finger balance is holding together well at ${avgBalance.toFixed(0)}/100.`);
  }
  if (asymmetryPct !== null && Math.abs(asymmetryPct) < 5) {
    positives.push(`Hands are close to balanced on this protocol (${formatPct(asymmetryPct)}).`);
  }
  if (currentResult.summary.sessionTrendPct >= 0) {
    positives.push(`You finished the test sequence as strong as you started (${formatPct(currentResult.summary.sessionTrendPct)}).`);
  }

  const watchouts: string[] = [];
  if (!lastSameProtocol) {
    watchouts.push('No prior result on the same protocol for this hand yet, so trend confidence is limited.');
  }
  if (asymmetryPct === null) {
    watchouts.push('Run the same protocol on the opposite hand to unlock symmetry coaching.');
  }
  if (sameDayResults.length >= 3) {
    watchouts.push(`You have already logged ${sameDayResults.length} tests on this hand today, so fatigue can distort the coaching priority.`);
  }
  if (currentResult.confidence.experimental === 'Low') {
    watchouts.push('Experimental metrics are informative, but they should not override the core force and repeatability signals.');
  }

  const primaryFocusId = focusAreas[0]?.id;
  let nextProtocolId: TestId = 'standard_max';
  if (primaryFocusId === 'recruitment') nextProtocolId = 'distribution_hold';
  else if (primaryFocusId === 'fatigue') nextProtocolId = 'advanced_repeater';
  else if (primaryFocusId === 'explosive') nextProtocolId = 'explosive_pull';

  const confidence =
    lastSameProtocol || asymmetryPct !== null
      ? 'Moderate'
      : 'Low';

  const headline =
    trendVsLastPct !== null && trendVsLastPct >= 3
      ? 'Capacity is moving up. The next gain will come from cleaning up the weak link.'
      : primaryFocusId === 'fatigue'
        ? 'Your top limiter today is force drop-off as the effort progresses.'
        : primaryFocusId === 'stability'
          ? 'Strength is present, but consistency is costing you usable performance.'
          : primaryFocusId === 'recruitment'
            ? `The cleanest upgrade path is better ${weakestFinger.toLowerCase()} contribution.`
            : 'This profile is stable enough to use targeted coaching cues.';

  const overviewParts = [
    `${currentResult.protocolName} finished at ${bestPeak.toFixed(1)} kg`,
    `repeatability ${currentResult.summary.repeatabilityScore.toFixed(0)}/100`,
  ];
  if (trendVsLastPct !== null) {
    overviewParts.push(`${formatPct(trendVsLastPct)} vs last same-protocol test`);
  }

  return {
    headline,
    overview: overviewParts.join(' | '),
    confidence,
    focusAreas,
    positives: positives.slice(0, 3),
    watchouts: watchouts.slice(0, 3),
    nextStep: {
      protocolId: nextProtocolId,
      label: protocolLabel(nextProtocolId),
      reason:
        nextProtocolId === 'distribution_hold'
          ? 'Best next check for evening out finger contribution under load.'
          : nextProtocolId === 'advanced_repeater'
            ? 'Best next check for fatigue resistance and late-set drop-off.'
            : nextProtocolId === 'explosive_pull'
              ? 'Best next check for how quickly force is expressed.'
              : 'Best next check for clean peak-force progression and repeatability.',
    },
  };
}
